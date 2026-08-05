/**
 * Routes Quản Lý Admin (Admin Dashboard & Management APIs)
 * Tất cả các endpoint trong file này đều được bảo vệ bởi middleware `requireAdmin`.
 */
const express = require('express');
const { readQuery, writeQuery, int } = require('../db');
const q = require('../queries/cypher');
const shopQ = require('../queries/shopCypher');
const statsQ = require('../queries/adminStatsCypher');
const { asyncHandler, HttpError, parsePagination, buildPagination } = require('../utils/http');
const { requireAdmin } = require('../middleware/adminAuth');
const { parseFilters } = require('../utils/filters');

const router = express.Router();

const randomStock = () => 100 + Math.floor(Math.random() * 101);
const resolveStock = (value) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  return randomStock();
};

// Bắt buộc xác thực Admin cho tất cả các endpoint trong router này
router.use(requireAdmin);

// ===========================================================================
// 1. TỔNG QUAN & THỐNG KÊ DOANH THU
// ===========================================================================

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [statsRows, categoryRevenue, recentOrders, orderSummary, revenueByPeriod, lowStock] =
      await Promise.all([
        readQuery(q.ADMIN_GET_STATS),
        readQuery(q.ADMIN_REVENUE_BY_CATEGORY),
        // Dùng ADMIN_RECENT_ACTIVITY (duyệt node Order) thay cho truy vấn cũ
        // duyệt cạnh BOUGHT — xem ghi chú sửa lỗi trong adminStatsCypher.js
        readQuery(statsQ.RECENT_ACTIVITY),
        readQuery(statsQ.ORDER_SUMMARY),
        readQuery(statsQ.REVENUE_BY_PERIOD, { groupBy: 'month', fromDate: null, toDate: null }),
        readQuery(statsQ.LOW_STOCK_PRODUCTS, { threshold: int(10) }),
      ]);

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
        // Số liệu trên đồ thị BOUGHT (bao gồm dữ liệu mô phỏng)
        summary: stats,
        categoryRevenue,
        // Số liệu giao dịch thật, lấy từ node Order
        orderSummary: orderSummary[0] ?? null,
        revenueByPeriod,
        recentOrders,
        lowStock,
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

    // Dùng chung bộ đọc tham số lọc với trang khách hàng. Bỏ trống thì trả về
    // null / chuỗi rỗng, tức là không lọc và giữ thứ tự mặc định — hành vi cũ
    // của trang quản trị không đổi.
    const { categoryId, minPrice, maxPrice, sort } = parseFilters(req.query);

    const loc = { search, categoryId, minPrice, maxPrice };

    const countRows = await readQuery(q.COUNT_PRODUCTS, loc);
    const total = countRows[0] ? countRows[0].total : 0;

    const products = await readQuery(q.LIST_PRODUCTS, {
      ...loc,
      sort,
      skip: int(skip),
      limit: int(limit),
    });

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
    const { title, final_price, rating = 5.0, image, category_id, stock } = req.body;

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
      stock: resolveStock(stock),
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
      stock: resolveStock(stock),
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

    // Chặn admin tự khoá chính mình — khoá xong sẽ không vào lại được trang
    // quản trị để tự mở khoá, phải sửa tay trong database.
    if (status === 'blocked' && id === `U_${req.user.uid}`) {
      throw new HttpError(400, 'Không thể tự khoá tài khoản của chính mình');
    }

    // Khoá tài khoản đồng thời huỷ các đơn chưa thanh toán của khách đó
    // (xem ghi chú trong ADMIN_UPDATE_USER_STATUS)
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

/**
 * GET /api/admin/orders?status=&search=&from=&to=&page=&limit=
 *
 * search khớp trên: mã đơn, tên người nhận, số điện thoại, tên khách hàng.
 * from/to lọc theo NGÀY ĐẶT hàng, định dạng YYYY-MM-DD.
 */
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const status = String(req.query.status ?? '').trim().toUpperCase();

    if (status && !ORDER_STATUSES.includes(status)) {
      throw new HttpError(400, `status phải là một trong: ${ORDER_STATUSES.join(', ')}`);
    }

    // Hạ chữ thường để khớp với toLower() trong Cypher
    const search = String(req.query.search ?? '').trim().toLowerCase();

    const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
    const fromDate = req.query.from ? String(req.query.from) : null;
    const toDate = req.query.to ? String(req.query.to) : null;

    if (fromDate && !isDate(fromDate)) throw new HttpError(400, 'from phải có dạng YYYY-MM-DD');
    if (toDate && !isDate(toDate)) throw new HttpError(400, 'to phải có dạng YYYY-MM-DD');

    const filters = { status, search, fromDate, toDate };

    const [countRows, rows] = await Promise.all([
      readQuery(shopQ.ADMIN_ORDER_COUNT, filters),
      readQuery(shopQ.ADMIN_ORDER_LIST, { ...filters, skip: int(skip), limit: int(limit) }),
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

    // Trừ kho tại thời điểm thanh toán, không phải lúc đặt hàng: khách đặt trên
    // web nhưng có thể không tới lấy, giữ hàng sớm sẽ khoá nhầm tồn kho.
    const stockRows = await writeQuery(statsQ.DECREASE_STOCK_FOR_ORDER, { orderId });

    res.json({ status: 'success', data: { ...rows[0], stock_updated: stockRows } });
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

    const orderId = String(req.params.orderId);

    // Phải đọc trạng thái TRƯỚC khi cập nhật: đọc sau thì giá trị đã là trạng
    // thái mới, không còn biết đơn từng được thanh toán hay chưa.
    const [before] = await readQuery(shopQ.ORDER_FIND_PENDING, { orderId });
    if (!before) throw new HttpError(404, 'Không tìm thấy đơn hàng');

    const rows = await writeQuery(shopQ.ORDER_UPDATE_STATUS, { orderId, status });
    if (rows.length === 0) throw new HttpError(404, 'Không tìm thấy đơn hàng');

    // Huỷ đơn đã trừ kho thì phải hoàn hàng về kho
    if (status === 'CANCELLED' && ['PAID', 'COMPLETED'].includes(before.status)) {
      await writeQuery(statsQ.RESTORE_STOCK_FOR_ORDER, { orderId });
    }

    res.json({ status: 'success', data: rows[0] });
  })
);

// ---------------------------------------------------------------------------
// THỐNG KÊ DOANH THU THEO THỜI GIAN
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/revenue?groupBy=month|day&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Doanh thu lấy từ node Order (giao dịch thật), KHÔNG lấy từ cạnh BOUGHT —
 * BOUGHT phần lớn là dữ liệu mô phỏng phục vụ thuật toán gợi ý.
 */
router.get(
  '/revenue',
  asyncHandler(async (req, res) => {
    const groupBy = String(req.query.groupBy ?? 'month').toLowerCase();
    if (!['month', 'day', 'year'].includes(groupBy)) {
      throw new HttpError(400, "groupBy phải là 'month', 'day' hoặc 'year'");
    }

    const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
    const fromDate = req.query.from ? String(req.query.from) : null;
    const toDate = req.query.to ? String(req.query.to) : null;

    if (fromDate && !isDate(fromDate)) throw new HttpError(400, 'from phải có dạng YYYY-MM-DD');
    if (toDate && !isDate(toDate)) throw new HttpError(400, 'to phải có dạng YYYY-MM-DD');

    const [series, summary] = await Promise.all([
      readQuery(statsQ.REVENUE_BY_PERIOD, { groupBy, fromDate, toDate }),
      readQuery(statsQ.ORDER_SUMMARY),
    ]);

    res.json({
      status: 'success',
      groupBy,
      from: fromDate,
      to: toDate,
      data: series,
      summary: summary[0] ?? null,
    });
  })
);

/** GET /api/admin/users/:id/orders — lịch sử đơn hàng của một khách hàng */
router.get(
  '/users/:id/orders',
  asyncHandler(async (req, res) => {
    const rows = await readQuery(statsQ.USER_ORDERS, { customerId: String(req.params.id) });
    res.json({ status: 'success', count: rows.length, data: rows });
  })
);

/** GET /api/admin/low-stock?threshold= — sản phẩm sắp hết hàng */
router.get(
  '/low-stock',
  asyncHandler(async (req, res) => {
    const threshold = Math.max(0, parseInt(req.query.threshold, 10) || 10);
    const rows = await readQuery(statsQ.LOW_STOCK_PRODUCTS, { threshold: int(threshold) });
    res.json({ status: 'success', threshold, data: rows });
  })
);

module.exports = router;
