const express = require('express');

const { readQuery, writeQuery, int } = require('../db');
const q = require('../queries/shopCypher');
const stockQ = require('../queries/adminStatsCypher');
const { asyncHandler, HttpError, parsePagination, buildPagination } = require('../utils/http');
const { verifyToken } = require('../middleware/auth');
const { generateOrderCode } = require('../utils/orderCode');
const { thongBaoDonThayDoi } = require('../services/eventBus');
const { taoUrlQr, daCauHinh, cauHinh } = require('../services/sepay');

const router = express.Router();

router.use(verifyToken);

const customerIdOf = (req) => `U_${req.user.uid}`;

/**
 * POST /api/orders — đặt hàng từ giỏ
 *
 * Body: { receiverName, phone, address, note? }
 *
 * Đơn luôn tạo ở trạng thái PENDING (chờ thanh toán). Khách cầm mã đơn tới
 * cửa hàng trả tiền, nhân viên vào trang quản trị bấm "Đã thanh toán".
 * Cạnh BOUGHT chỉ sinh ra ở bước đó, không phải lúc đặt hàng — để gợi ý chỉ
 * dựa trên hàng thực sự đã bán được.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const customerId = customerIdOf(req);
    const { receiverName, phone, address, note, paymentMethod = 'COD' } = req.body ?? {};

    if (!String(receiverName ?? '').trim()) throw new HttpError(400, 'Thiếu tên người nhận');
    if (!String(phone ?? '').trim()) throw new HttpError(400, 'Thiếu số điện thoại');
    if (!String(address ?? '').trim()) throw new HttpError(400, 'Thiếu địa chỉ');

    // Giỏ rỗng thì Cypher không khớp dòng nào và sẽ tạo ra đơn 0 đồng — chặn trước.
    const cart = await readQuery(q.CART_LIST, { customerId });
    if (cart.length === 0) throw new HttpError(400, 'Giỏ hàng đang trống');

    // Kiểm lại tồn kho ngay trước khi chốt đơn: hàng có thể đã bán hết trong
    // khoảng thời gian sản phẩm nằm chờ trong giỏ.
    const shortage = await readQuery(stockQ.CHECK_STOCK_FOR_CART, { customerId });
    if (shortage.length > 0) {
      const detail = shortage
        .map((s) => `"${s.title}" (còn ${s.stock}, cần ${s.requested})`)
        .join('; ');
      throw new HttpError(409, `Không đủ hàng: ${detail}`);
    }

    const normalizedPaymentMethod = String(paymentMethod || 'COD').toUpperCase();
    if (!['COD', 'ZALOPAY'].includes(normalizedPaymentMethod)) {
      throw new HttpError(400, 'Phương thức thanh toán không hợp lệ');
    }

    const rows = await writeQuery(q.ORDER_CREATE_FROM_CART, {
      customerId,
      orderId: generateOrderCode(),
      status: 'PENDING',
      paymentMethod: normalizedPaymentMethod,
      receiverName: String(receiverName).trim(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      note: String(note ?? '').trim(),
    });

    if (rows.length === 0) throw new HttpError(500, 'Không tạo được đơn hàng');

    // Báo ngay cho trang quản trị đang mở, khỏi phải tải lại trang mới thấy đơn mới
    thongBaoDonThayDoi({
      customerId,
      orderId: rows[0].order_id,
      status: rows[0].status,
      hanhDong: 'tao',
    });

    res.status(201).json({ data: rows[0] });
  })
);

/**
 * POST /api/orders/buy-now — đặt hàng thẳng cho MỘT sản phẩm ("Mua ngay")
 *
 * Body: { productId, quantity, receiverName, phone, address, note?, paymentMethod? }
 *
 * KHÁC luồng giỏ hàng ở chỗ hoàn toàn không đụng tới IN_CART:
 *   - Khách bấm "Mua ngay" rồi bỏ ngang → không có gì đọng lại trong giỏ.
 *   - Đơn chỉ gồm đúng sản phẩm vừa bấm, không lẫn hàng có sẵn trong giỏ.
 *
 * Vẫn tạo ở trạng thái PENDING và vẫn trừ kho ở bước xác nhận thanh toán,
 * giống hệt đơn đặt từ giỏ.
 */
const SO_LUONG_TOI_DA = 99;

router.post(
  '/buy-now',
  asyncHandler(async (req, res) => {
    const customerId = customerIdOf(req);
    const {
      productId,
      quantity = 1,
      receiverName,
      phone,
      address,
      note,
      paymentMethod = 'COD',
    } = req.body ?? {};

    if (!String(productId ?? '').trim()) throw new HttpError(400, 'Thiếu mã sản phẩm');
    if (!String(receiverName ?? '').trim()) throw new HttpError(400, 'Thiếu tên người nhận');
    if (!String(phone ?? '').trim()) throw new HttpError(400, 'Thiếu số điện thoại');
    if (!String(address ?? '').trim()) throw new HttpError(400, 'Thiếu địa chỉ');

    // Không kẹp thầm lặng về khoảng hợp lệ: khách gửi 99999 mà hệ thống lặng lẽ
    // tạo đơn 99 món là tạo đơn khác với thứ khách yêu cầu. Báo lỗi rõ ràng hơn.
    const soLuong = Number(quantity);
    if (!Number.isInteger(soLuong) || soLuong < 1 || soLuong > SO_LUONG_TOI_DA) {
      throw new HttpError(400, `Số lượng phải là số nguyên từ 1 đến ${SO_LUONG_TOI_DA}`);
    }

    const normalizedPaymentMethod = String(paymentMethod || 'COD').toUpperCase();
    if (!['COD', 'ZALOPAY'].includes(normalizedPaymentMethod)) {
      throw new HttpError(400, 'Phương thức thanh toán không hợp lệ');
    }

    // Sản phẩm có tồn tại không + còn đủ hàng không.
    //
    // Cố tình BỎ QUA số lượng đang nằm trong giỏ mà câu lệnh này trả về: hàng
    // trong giỏ chưa bị giữ chỗ (kho chỉ trừ khi thanh toán), nên nó không được
    // phép làm giảm số lượng khách mua ngay được.
    const [stockRow] = await readQuery(stockQ.GET_PRODUCT_STOCK, {
      productId: String(productId),
      customerId,
    });

    if (!stockRow) throw new HttpError(404, 'Không tìm thấy sản phẩm');
    if (stockRow.stock < soLuong) {
      throw new HttpError(409, `Không đủ hàng: chỉ còn ${stockRow.stock} sản phẩm`);
    }

    const rows = await writeQuery(q.ORDER_CREATE_DIRECT, {
      customerId,
      productId: String(productId),
      quantity: int(soLuong),
      orderId: generateOrderCode(),
      status: 'PENDING',
      paymentMethod: normalizedPaymentMethod,
      receiverName: String(receiverName).trim(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      note: String(note ?? '').trim(),
    });

    if (rows.length === 0) throw new HttpError(500, 'Không tạo được đơn hàng');

    thongBaoDonThayDoi({
      customerId,
      orderId: rows[0].order_id,
      status: rows[0].status,
      hanhDong: 'tao',
    });

    res.status(201).json({ data: rows[0] });
  })
);

/**
 * GET /api/orders/:orderId/payment-qr
 * Thông tin để khách chuyển khoản: ảnh QR, số tài khoản, nội dung, số tiền.
 *
 * Chỉ chủ đơn xem được, và chỉ khi đơn còn chờ thanh toán.
 */
router.get(
  '/:orderId/payment-qr',
  asyncHandler(async (req, res) => {
    const orderId = String(req.params.orderId);

    const [don] = await readQuery(q.ORDER_FIND_FOR_PAYMENT, { orderId });

    if (!don) throw new HttpError(404, 'Không tìm thấy đơn hàng');
    if (don.customer_id !== customerIdOf(req)) {
      throw new HttpError(403, 'Đơn hàng này không phải của bạn');
    }
    if (don.status !== 'PENDING') {
      throw new HttpError(400, `Đơn đang ở trạng thái ${don.status}, không cần thanh toán nữa`);
    }

    if (!daCauHinh()) {
      // Chưa khai báo tài khoản nhận tiền thì báo rõ thay vì trả QR hỏng
      return res.json({ data: { available: false, reason: 'Cửa hàng chưa bật thanh toán chuyển khoản' } });
    }

    const c = cauHinh();

    return res.json({
      data: {
        available: true,
        qrUrl: taoUrlQr({ orderId, amount: don.total }),
        accountNumber: c.soTaiKhoan,
        bank: c.nganHang,
        amount: don.total,
        // Nội dung chuyển khoản PHẢI đúng mã đơn — đây là thứ duy nhất dùng để
        // đối chiếu tiền vào với đơn hàng.
        transferContent: orderId,
      },
    });
  })
);

/** GET /api/orders — danh sách đơn của chính mình */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const customerId = customerIdOf(req);
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 50 });

    const [countRows, rows] = await Promise.all([
      readQuery(q.ORDER_COUNT_BY_CUSTOMER, { customerId }),
      readQuery(q.ORDER_LIST_BY_CUSTOMER, { customerId, skip: int(skip), limit: int(limit) }),
    ]);

    res.json({
      data: rows,
      pagination: buildPagination(page, limit, countRows[0]?.total ?? 0),
    });
  })
);

/**
 * GET /api/orders/:orderId — chi tiết đơn
 *
 * Kiểm tra quyền sở hữu: khách chỉ xem được đơn của mình, admin xem được tất cả.
 * Không kiểm tra thì ai đoán trúng mã đơn là đọc được tên, số điện thoại và
 * địa chỉ của người khác.
 */
router.get(
  '/:orderId',
  asyncHandler(async (req, res) => {
    const customerId = customerIdOf(req);
    const rows = await readQuery(q.ORDER_GET_DETAIL, { orderId: String(req.params.orderId) });

    if (rows.length === 0) throw new HttpError(404, 'Không tìm thấy đơn hàng');

    if (rows[0].customer_id !== customerId) {
      const me = await readQuery(q.CUSTOMER_GET_PROFILE, { customerId });
      if (String(me[0]?.role ?? '').toLowerCase() !== 'admin') {
        throw new HttpError(404, 'Không tìm thấy đơn hàng');
      }
    }

    res.json({ data: rows[0] });
  })
);

/** POST /api/orders/:orderId/cancel — khách tự huỷ đơn khi chưa thanh toán */
router.post(
  '/:orderId/confirm-paid',
  asyncHandler(async (req, res) => {
    const rows = await writeQuery(q.ORDER_CONFIRM_PAID_BY_CUSTOMER, {
      customerId: customerIdOf(req),
      orderId: String(req.params.orderId),
    });

    if (rows.length === 0) {
      throw new HttpError(400, 'Không xác nhận được thanh toán — đơn không tồn tại hoặc chưa dùng ZaloPay');
    }

    thongBaoDonThayDoi({
      customerId: customerIdOf(req),
      orderId: rows[0].order_id,
      status: rows[0].status,
      hanhDong: 'thanh_toan',
    });

    res.json({ data: rows[0] });
  })
);

router.post(
  '/:orderId/cancel',
  asyncHandler(async (req, res) => {
    const rows = await writeQuery(q.ORDER_CANCEL, {
      customerId: customerIdOf(req),
      orderId: String(req.params.orderId),
    });

    if (rows.length === 0) {
      throw new HttpError(400, 'Không huỷ được — đơn không tồn tại hoặc đã thanh toán');
    }

    // Khách huỷ thì trang quản trị cũng phải thấy ngay, không thì nhân viên
    // vẫn ngồi chờ một đơn đã bị bỏ.
    thongBaoDonThayDoi({
      customerId: customerIdOf(req),
      orderId: rows[0].order_id,
      status: rows[0].status,
      hanhDong: 'huy',
    });

    res.json({ data: rows[0] });
  })
);

module.exports = router;
