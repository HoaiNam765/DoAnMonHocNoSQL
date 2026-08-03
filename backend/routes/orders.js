const express = require('express');

const { readQuery, writeQuery, int } = require('../db');
const q = require('../queries/shopCypher');
const stockQ = require('../queries/adminStatsCypher');
const { asyncHandler, HttpError, parsePagination, buildPagination } = require('../utils/http');
const { verifyToken } = require('../middleware/auth');
const { generateOrderCode } = require('../utils/orderCode');

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
    const { receiverName, phone, address, note } = req.body ?? {};

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

    const rows = await writeQuery(q.ORDER_CREATE_FROM_CART, {
      customerId,
      orderId: generateOrderCode(),
      status: 'PENDING',
      paymentMethod: 'AT_STORE',
      receiverName: String(receiverName).trim(),
      phone: String(phone).trim(),
      address: String(address).trim(),
      note: String(note ?? '').trim(),
    });

    if (rows.length === 0) throw new HttpError(500, 'Không tạo được đơn hàng');

    res.status(201).json({ data: rows[0] });
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
  '/:orderId/cancel',
  asyncHandler(async (req, res) => {
    const rows = await writeQuery(q.ORDER_CANCEL, {
      customerId: customerIdOf(req),
      orderId: String(req.params.orderId),
    });

    if (rows.length === 0) {
      throw new HttpError(400, 'Không huỷ được — đơn không tồn tại hoặc đã thanh toán');
    }

    res.json({ data: rows[0] });
  })
);

module.exports = router;
