/**
 * Routes Quản Lý Admin (Admin Dashboard & Management APIs)
 * Tất cả các endpoint trong file này đều được bảo vệ bởi middleware `requireAdmin`.
 */
const express = require('express');
const { readQuery, writeQuery, int } = require('../db');
const q = require('../queries/cypher');
const shopQ = require('../queries/shopCypher');
const { asyncHandler, HttpError, parsePagination, buildPagination } = require('../utils/http');
const { requireAdmin } = require('../middleware/adminAuth');

const router = express.Router();

// Bắt buộc xác thực Admin cho tất cả các endpoint trong router này
router.use(requireAdmin);

// ===========================================================================
// 1. TỔNG QUAN & THỐNG KÊ DOANH THU
// ===========================================================================

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const statsRows = await readQuery(q.ADMIN_GET_STATS);
    const categoryRevenue = await readQuery(q.ADMIN_REVENUE_BY_CATEGORY);
    const recentOrders = await readQuery(q.ADMIN_RECENT_ORDERS);

    const stats = statsRows[0] || {
      total_products: 0,
      total_customers: 0,
      total_categories: 0,
      total_orders: 0,
      total_revenue: 0,
    };

    res.json({
      status: 'success',
      data: {
        summary: stats,
        categoryRevenue,
        recentOrders,
      },
    });
  })
);

// ===========================================================================
// 2. QUẢN LÝ DANH MỤC (CATEGORIES)
// ===========================================================================

router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await readQuery(q.ADMIN_LIST_CATEGORIES);
    res.json({
      status: 'success',
      count: categories.length,
      data: categories,
    });
  })
);

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const { category_id, category_name } = req.body;
    if (!category_id || !category_name) {
      throw new HttpError(400, 'Thiếu thông tin category_id hoặc category_name');
    }

    const rows = await writeQuery(q.ADMIN_CREATE_CATEGORY, {
      categoryId: String(category_id).trim(),
      categoryName: String(category_name).trim(),
    });

    res.json({ status: 'success', data: rows[0] });
  })
);

router.put(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { category_name, status = 'active' } = req.body;

    if (!category_name) {
      throw new HttpError(400, 'Thiếu thông tin category_name');
    }

    const rows = await writeQuery(q.ADMIN_UPDATE_CATEGORY, {
      categoryId: id,
      categoryName: String(category_name).trim(),
      status,
    });

    if (rows.length === 0) {
      throw new HttpError(404, 'Không tìm thấy danh mục');
    }

    res.json({ status: 'success', data: rows[0] });
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await writeQuery(q.ADMIN_DELETE_CATEGORY, { categoryId: id });

    if (rows.length === 0) {
      throw new HttpError(404, 'Không tìm thấy danh mục');
    }

    res.json({ status: 'success', data: rows[0] });
  })
);

// ===========================================================================
// 3. QUẢN LÝ SẢN PHẨM (PRODUCTS)
// ===========================================================================

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';
    const categoryId = req.query.categoryId ? String(req.query.categoryId).trim() : null;

    const countRows = await readQuery(q.COUNT_PRODUCTS, { search, categoryId });
    const total = countRows[0] ? countRows[0].total : 0;

    const products = await readQuery(q.LIST_PRODUCTS, { search, categoryId, skip: int(skip), limit: int(limit) });

    res.json({
      status: 'success',
      pagination: buildPagination(page, limit, total),
      data: products,
    });
  })
);

router.post(
  '/products',
  asyncHandler(async (req, res) => {
    const { title, final_price, rating = 5.0, image, category_id, stock = 100 } = req.body;

    if (!title || final_price === undefined || !category_id) {
      throw new HttpError(400, 'Vui lòng điền đầy đủ tiêu đề, giá bán và danh mục');
    }

    const newId = `P_${Date.now()}`;

    const rows = await writeQuery(q.ADMIN_CREATE_PRODUCT, {
      id: newId,
      title: String(title).trim(),
      finalPrice: Number(final_price),
      rating: Number(rating),
      image: image || 'https://via.placeholder.com/300',
      stock: Number(stock),
      categoryId: String(category_id).trim(),
    });

    res.json({ status: 'success', data: rows[0] });
  })
);

router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, final_price, rating, image, category_id, stock, status = 'active' } = req.body;

    if (!title || final_price === undefined || !category_id) {
      throw new HttpError(400, 'Vui lòng điền đầy đủ tiêu đề, giá bán và danh mục');
    }

    const rows = await writeQuery(q.ADMIN_UPDATE_PRODUCT, {
      id,
      title: String(title).trim(),
      finalPrice: Number(final_price),
      rating: Number(rating || 5.0),
      image: image || 'https://via.placeholder.com/300',
      stock: Number(stock || 100),
      status,
      categoryId: String(category_id).trim(),
    });

    if (rows.length === 0) {
      throw new HttpError(404, 'Không tìm thấy sản phẩm');
    }

    res.json({ status: 'success', data: rows[0] });
  })
);

router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await writeQuery(q.ADMIN_DELETE_PRODUCT, { id });

    if (rows.length === 0) {
      throw new HttpError(404, 'Không tìm thấy sản phẩm');
    }

    res.json({ status: 'success', data: rows[0] });
  })
);

// ===========================================================================
// 4. QUẢN LÝ NGƯỜI DÙNG (USERS)
// ===========================================================================

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = req.query.search ? req.query.search.trim().toLowerCase() : '';

    const countRows = await readQuery(q.ADMIN_COUNT_USERS, { search });
    const total = countRows[0] ? countRows[0].total : 0;

    const users = await readQuery(q.ADMIN_LIST_USERS, { search, skip: int(skip), limit: int(limit) });

    res.json({
      status: 'success',
      pagination: buildPagination(page, limit, total),
      data: users,
    });
  })
);

router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rows = await readQuery(q.ADMIN_GET_USER_DETAILS, { customerId: id });

    if (rows.length === 0) {
      throw new HttpError(404, 'Không tìm thấy người dùng');
    }

    res.json({ status: 'success', data: rows[0] });
  })
);

router.put(
  '/users/:id/role',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'user'].includes(role)) {
      throw new HttpError(400, 'Vai trò không hợp lệ (chấp nhận: admin, user)');
    }

    const rows = await writeQuery(q.ADMIN_UPDATE_USER_ROLE, { customerId: id, role });

    if (rows.length === 0) {
      throw new HttpError(404, 'Không tìm thấy người dùng');
    }

    res.json({ status: 'success', data: rows[0] });
  })
);

router.put(
  '/users/:id/status',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'blocked'].includes(status)) {
      throw new HttpError(400, 'Trạng thái không hợp lệ (chấp nhận: active, blocked)');
    }

    const rows = await writeQuery(q.ADMIN_UPDATE_USER_STATUS, { customerId: id, status });

    if (rows.length === 0) {
      throw new HttpError(404, 'Không tìm thấy người dùng');
    }

    res.json({ status: 'success', data: rows[0] });
  })
);

// ---------------------------------------------------------------------------
// QUẢN LÝ ĐƠN HÀNG
//
// Đây là nơi nhân viên xử lý luồng thanh toán tại cửa hàng:
//   khách đặt đơn trên web → đơn hiện ở đây với trạng thái "Chờ thanh toán"
//   → khách tới trả tiền → nhân viên bấm "Đã thanh toán"
//   → hệ thống sinh cạnh BOUGHT → gợi ý cập nhật ngay
// ---------------------------------------------------------------------------

const ORDER_STATUSES = ['PENDING', 'PAID', 'COMPLETED', 'CANCELLED'];

/** GET /api/admin/orders?status=&page=&limit= — danh sách toàn bộ đơn */
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const status = String(req.query.status ?? '').trim().toUpperCase();

    if (status && !ORDER_STATUSES.includes(status)) {
      throw new HttpError(400, `status phải là một trong: ${ORDER_STATUSES.join(', ')}`);
    }

    const [countRows, rows] = await Promise.all([
      readQuery(shopQ.ADMIN_ORDER_COUNT, { status }),
      readQuery(shopQ.ADMIN_ORDER_LIST, { status, skip: int(skip), limit: int(limit) }),
    ]);

    res.json({
      status: 'success',
      data: rows,
      pagination: buildPagination(page, limit, countRows[0]?.total ?? 0),
    });
  })
);

/** GET /api/admin/orders/:orderId — chi tiết đơn (admin xem được mọi đơn) */
router.get(
  '/orders/:orderId',
  asyncHandler(async (req, res) => {
    const rows = await readQuery(shopQ.ORDER_GET_DETAIL, { orderId: String(req.params.orderId) });
    if (rows.length === 0) throw new HttpError(404, 'Không tìm thấy đơn hàng');
    res.json({ status: 'success', data: rows[0] });
  })
);

/**
 * POST /api/admin/orders/:orderId/mark-paid
 * Xác nhận khách đã trả tiền tại cửa hàng → sinh cạnh BOUGHT.
 */
router.post(
  '/orders/:orderId/mark-paid',
  asyncHandler(async (req, res) => {
    const orderId = String(req.params.orderId);
    const paidNote = String(req.body?.note ?? '').trim() || null;

    const rows = await writeQuery(shopQ.ORDER_MARK_PAID, { orderId, paidNote });

    if (rows.length === 0) {
      // Phân biệt "không có đơn" với "đơn không còn ở trạng thái chờ thanh toán"
      const found = await readQuery(shopQ.ORDER_FIND_PENDING, { orderId });
      if (found.length === 0) throw new HttpError(404, 'Không tìm thấy đơn hàng');
      throw new HttpError(400, `Đơn đang ở trạng thái ${found[0].status}, không phải PENDING`);
    }

    res.json({ status: 'success', data: rows[0] });
  })
);

/** PUT /api/admin/orders/:orderId/status — đổi trạng thái (COMPLETED / CANCELLED) */
router.put(
  '/orders/:orderId/status',
  asyncHandler(async (req, res) => {
    const status = String(req.body?.status ?? '').trim().toUpperCase();

    if (!ORDER_STATUSES.includes(status)) {
      throw new HttpError(400, `status phải là một trong: ${ORDER_STATUSES.join(', ')}`);
    }
    if (status === 'PAID') {
      throw new HttpError(400, 'Dùng POST /orders/:orderId/mark-paid để xác nhận thanh toán');
    }

    const rows = await writeQuery(shopQ.ORDER_UPDATE_STATUS, {
      orderId: String(req.params.orderId),
      status,
    });

    if (rows.length === 0) throw new HttpError(404, 'Không tìm thấy đơn hàng');

    res.json({ status: 'success', data: rows[0] });
  })
);

module.exports = router;
