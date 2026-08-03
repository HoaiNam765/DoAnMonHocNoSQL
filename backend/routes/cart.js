const express = require('express');

const { readQuery, writeQuery, int } = require('../db');
const q = require('../queries/shopCypher');
const stockQ = require('../queries/adminStatsCypher');
const { CHECK_PRODUCT_EXISTS } = require('../queries/cypher');
const { asyncHandler, HttpError } = require('../utils/http');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const MAX_QUANTITY = 99;

// Toàn bộ endpoint giỏ hàng đều cần đăng nhập.
// customer_id LUÔN lấy từ token, không bao giờ từ URL/body — nếu không, khách A
// có thể sửa giỏ hàng của khách B chỉ bằng cách đổi tham số.
router.use(verifyToken);

const customerIdOf = (req) => `U_${req.user.uid}`;

/** Đọc & kiểm tra số lượng gửi lên. */
const parseQuantity = (raw, { allowZero = false } = {}) => {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new HttpError(400, 'quantity phải là số nguyên');
  if (n < (allowZero ? 0 : 1)) {
    throw new HttpError(400, `quantity phải >= ${allowZero ? 0 : 1}`);
  }
  if (n > MAX_QUANTITY) throw new HttpError(400, `quantity tối đa là ${MAX_QUANTITY}`);
  return n;
};

/** Trả giỏ hàng kèm tổng tiền — dùng lại ở nhiều endpoint. */
const loadCart = async (customerId) => {
  const items = await readQuery(q.CART_LIST, { customerId });
  return {
    items,
    item_count: items.length,
    total_quantity: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.line_total, 0),
  };
};

/** GET /api/cart — xem giỏ hàng */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ data: await loadCart(customerIdOf(req)) });
  })
);

/** GET /api/cart/count — chỉ lấy số lượng, cho badge trên Header */
router.get(
  '/count',
  asyncHandler(async (req, res) => {
    const rows = await readQuery(q.CART_COUNT, { customerId: customerIdOf(req) });
    res.json({
      data: {
        item_count: rows[0]?.item_count ?? 0,
        total_quantity: rows[0]?.total_quantity ?? 0,
      },
    });
  })
);

/** POST /api/cart/items — thêm sản phẩm (cộng dồn nếu đã có) */
router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const customerId = customerIdOf(req);
    const productId = String(req.body?.productId ?? '').trim();
    const quantity = parseQuantity(req.body?.quantity ?? 1);

    if (!productId) throw new HttpError(400, 'Thiếu productId');

    const exists = await readQuery(CHECK_PRODUCT_EXISTS, { productId });
    if (exists.length === 0) {
      throw new HttpError(404, `Không tìm thấy sản phẩm có id = ${productId}`);
    }

    // Không cho bỏ vào giỏ nhiều hơn tồn kho. Phải cộng cả phần đã có sẵn
    // trong giỏ vì endpoint này cộng dồn số lượng.
    const [stockRow] = await readQuery(stockQ.GET_PRODUCT_STOCK, { productId, customerId });
    const stock = stockRow?.stock ?? 0;
    const inCart = stockRow?.in_cart ?? 0;

    if (stock === 0) throw new HttpError(409, 'Sản phẩm đã hết hàng');
    if (inCart + quantity > stock) {
      throw new HttpError(
        409,
        `Chỉ còn ${stock} sản phẩm trong kho` + (inCart > 0 ? ` (giỏ của bạn đã có ${inCart})` : '')
      );
    }

    const rows = await writeQuery(q.CART_ADD_ITEM, { customerId, productId, quantity: int(quantity) });
    if (rows.length === 0) {
      throw new HttpError(404, 'Không tìm thấy khách hàng. Gọi POST /api/auth/sync trước.');
    }

    res.status(201).json({ data: await loadCart(customerId) });
  })
);

/** PATCH /api/cart/items/:productId — đặt số lượng (0 = xoá khỏi giỏ) */
router.patch(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const customerId = customerIdOf(req);
    const productId = String(req.params.productId);
    const quantity = parseQuantity(req.body?.quantity, { allowZero: true });

    if (quantity > 0) {
      const [stockRow] = await readQuery(stockQ.GET_PRODUCT_STOCK, { productId, customerId });
      const stock = stockRow?.stock ?? 0;
      if (quantity > stock) throw new HttpError(409, `Chỉ còn ${stock} sản phẩm trong kho`);
    }

    const rows =
      quantity === 0
        ? await writeQuery(q.CART_REMOVE_ITEM, { customerId, productId })
        : await writeQuery(q.CART_SET_QUANTITY, { customerId, productId, quantity: int(quantity) });

    if (rows.length === 0 || (quantity === 0 && rows[0].removed === 0)) {
      throw new HttpError(404, 'Sản phẩm không có trong giỏ hàng');
    }

    res.json({ data: await loadCart(customerId) });
  })
);

/** DELETE /api/cart/items/:productId — xoá 1 sản phẩm khỏi giỏ */
router.delete(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const customerId = customerIdOf(req);
    const rows = await writeQuery(q.CART_REMOVE_ITEM, {
      customerId,
      productId: String(req.params.productId),
    });

    if (rows[0]?.removed === 0) throw new HttpError(404, 'Sản phẩm không có trong giỏ hàng');

    res.json({ data: await loadCart(customerId) });
  })
);

/** DELETE /api/cart — xoá sạch giỏ */
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const customerId = customerIdOf(req);
    await writeQuery(q.CART_CLEAR, { customerId });
    res.json({ data: await loadCart(customerId) });
  })
);

module.exports = router;
