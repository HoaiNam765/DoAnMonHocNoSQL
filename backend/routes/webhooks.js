const express = require('express');

const { readQuery, writeQuery } = require('../db');
const shopQ = require('../queries/shopCypher');
const statsQ = require('../queries/adminStatsCypher');
const { asyncHandler } = require('../utils/http');
const { khoaHopLe, bocMaDon } = require('../services/sepay');
const { thongBaoDonThayDoi } = require('../services/eventBus');

const router = express.Router();

/**
 * POST /api/webhooks/sepay
 *
 * SePay gọi vào đây mỗi khi tài khoản ngân hàng của cửa hàng có biến động số dư.
 *
 * ĐIỂM KHÁC BIỆT SO VỚI MỌI ENDPOINT KHÁC: người gọi không phải người dùng đăng
 * nhập mà là máy chủ của SePay, nên không dùng Firebase token. Thay vào đó SePay
 * gửi kèm header `Authorization: Apikey <khoá>` — khoá này do mình tự đặt trong
 * bảng điều khiển SePay và lưu ở backend/.env.
 *
 * BỐN ĐIỀU BẮT BUỘC PHẢI ĐÚNG Ở ĐÂY, sai một cái là mất tiền hoặc giao nhầm hàng:
 *
 *  1. Xác thực khoá — không thì ai biết địa chỉ này cũng tự "báo" đã trả tiền.
 *  2. Chống xử lý trùng — SePay gửi lại tới 7 lần trong 5 tiếng nếu chưa nhận
 *     được 200. Không chặn thì một lần chuyển tiền bị tính thành nhiều lần.
 *  3. Đối chiếu SỐ TIỀN THẬT trong giao dịch, không tin con số nào từ nội dung
 *     chuyển khoản — nội dung đó khách gõ được.
 *  4. Chỉ nhận tiền VÀO (transferType = 'in'), bỏ qua tiền ra.
 *
 * Luôn trả 200 kèm {"success": true} khi đã tiếp nhận xong — kể cả những trường
 * hợp không khớp đơn nào. Trả lỗi chỉ khiến SePay gửi lại 7 lần vô ích cho một
 * giao dịch mà mình vốn không xử lý được.
 */
router.post(
  '/sepay',
  asyncHandler(async (req, res) => {
    // ---- 1. Xác thực -------------------------------------------------
    if (!khoaHopLe(req.headers.authorization)) {
      console.warn('[SePay] Từ chối webhook: khoá không hợp lệ');
      return res.status(401).json({ success: false, message: 'Khoá không hợp lệ' });
    }

    const duLieu = req.body ?? {};
    const txId = String(duLieu.id ?? '').trim();
    const soTien = Number(duLieu.transferAmount ?? 0);

    if (!txId) {
      console.warn('[SePay] Webhook thiếu mã giao dịch, bỏ qua');
      return res.json({ success: true });
    }

    // ---- 2. Chỉ xử lý tiền VÀO --------------------------------------
    if (String(duLieu.transferType ?? '').toLowerCase() !== 'in') {
      return res.json({ success: true });
    }

    // ---- 3. Chống xử lý trùng ---------------------------------------
    const maDon = bocMaDon({ code: duLieu.code, content: duLieu.content });

    const [ghiNhan] = await writeQuery(shopQ.PAYMENT_TX_RECORD, {
      txId,
      amount: soTien,
      gateway: String(duLieu.gateway ?? ''),
      content: String(duLieu.content ?? ''),
      orderCode: maDon,
    });

    if (!ghiNhan?.la_moi) {
      console.log(`[SePay] Giao dịch ${txId} đã xử lý trước đó, bỏ qua`);
      return res.json({ success: true });
    }

    // ---- 4. Đối chiếu với đơn hàng ----------------------------------
    if (!maDon) {
      console.warn(`[SePay] Giao dịch ${txId} không tìm thấy mã đơn trong nội dung: "${duLieu.content}"`);
      return res.json({ success: true });
    }

    const [don] = await readQuery(shopQ.ORDER_FIND_FOR_PAYMENT, { orderId: maDon });

    if (!don) {
      console.warn(`[SePay] Không có đơn nào mang mã ${maDon}`);
      return res.json({ success: true });
    }

    // Nối giao dịch với đơn để sau này tra soát được, kể cả khi không đủ tiền
    await writeQuery(shopQ.PAYMENT_TX_LINK_ORDER, { txId, orderId: maDon });

    if (don.status !== 'PENDING') {
      console.warn(`[SePay] Đơn ${maDon} đang ở trạng thái ${don.status}, không phải PENDING`);
      return res.json({ success: true });
    }

    // Chuyển thiếu tiền thì KHÔNG tự đánh dấu đã thanh toán — để nhân viên xem
    // và xử lý tay, vì có thể khách chuyển làm nhiều lần hoặc chuyển nhầm.
    if (soTien < Number(don.total)) {
      console.warn(
        `[SePay] Đơn ${maDon} cần ${don.total} nhưng chỉ nhận được ${soTien} — chờ nhân viên xử lý`
      );
      return res.json({ success: true });
    }

    // ---- 5. Đánh dấu đã thanh toán ----------------------------------
    // ORDER_MARK_PAID chỉ khớp đơn đang PENDING nên bản thân nó đã là chốt chặn
    // cuối: hai webhook về cùng lúc thì chỉ một cái đổi được trạng thái.
    const [ketQua] = await writeQuery(shopQ.ORDER_MARK_PAID, {
      orderId: maDon,
      paidNote: `SePay ${duLieu.gateway ?? ''} — ${soTien.toLocaleString('vi-VN')}đ (GD ${txId})`.trim(),
    });

    if (!ketQua) {
      console.warn(`[SePay] Đơn ${maDon} vừa được xử lý bởi luồng khác`);
      return res.json({ success: true });
    }

    // Trừ kho đúng như khi nhân viên bấm xác nhận tại quầy
    await writeQuery(statsQ.DECREASE_STOCK_FOR_ORDER, { orderId: maDon });

    // Đẩy sự kiện xuống trình duyệt: khách đang mở trang đơn sẽ thấy đổi sang
    // "Đã thanh toán" ngay khi tiền vào, không phải bấm tải lại.
    thongBaoDonThayDoi({
      customerId: don.customer_id,
      orderId: maDon,
      status: ketQua.status,
      hanhDong: 'thanh_toan',
    });

    console.log(`[SePay] Đơn ${maDon} đã thanh toán tự động — ${soTien.toLocaleString('vi-VN')}đ`);

    return res.json({ success: true });
  })
);

module.exports = router;
