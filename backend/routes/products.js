const express = require('express');

const { readQuery, writeQuery, int } = require('../db');
const q = require('../queries/cypher');
const {
  asyncHandler,
  HttpError,
  parsePagination,
  parseSearch,
  buildPagination,
} = require('../utils/http');
const { optionalAuth } = require('../middleware/auth');
const { parseFilters, maskCustomerName } = require('../utils/filters');

const router = express.Router();

const MAX_RECOMMENDATIONS = 20;

/**
 * Task 2.1 — GET /api/products
 * Danh sách sản phẩm, có phân trang và tìm kiếm cơ bản theo tên.
 * Query params: page, limit, search, categoryId
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const search = parseSearch(req.query.search);
    const { categoryId, minPrice, maxPrice, sort } = parseFilters(req.query);

    const params = { search, categoryId, minPrice, maxPrice };

    const [countRows, rows] = await Promise.all([
      // Đếm thì không cần sắp xếp — tổng số không đổi theo thứ tự
      readQuery(q.COUNT_PRODUCTS, params),
      readQuery(q.LIST_PRODUCTS, { ...params, sort, skip: int(skip), limit: int(limit) }),
    ]);

    const total = countRows[0]?.total ?? 0;

    res.json({
      data: rows,
      pagination: buildPagination(page, limit, total),
    });
  })
);

/**
 * Task A6 — GET /api/products/popular
 * Sản phẩm phổ biến (Query C — đếm lượt mua).
 * Phục vụ cold-start: tài khoản mới chưa có lịch sử mua.
 * Public, không cần token.
 * Query params: limit (mặc định 8, tối đa 50)
 */
const MAX_POPULAR = 50;

router.get(
  '/popular',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 8), MAX_POPULAR);
    const { categoryId, minPrice, maxPrice, sort, coLoc } = parseFilters(req.query);

    // Không bật tuỳ chọn nào thì chạy đúng Query C nguyên bản (bản được trích
    // trong báo cáo); có lọc hoặc đổi sắp xếp mới dùng biến thể.
    const rows = coLoc
      ? await readQuery(q.POPULAR_PRODUCTS_FILTERED, {
          limit: int(limit),
          categoryId,
          minPrice,
          maxPrice,
          sort,
        })
      : await readQuery(q.POPULAR_PRODUCTS, { limit: int(limit) });

    res.json({
      source: 'popularity', // Query C: đếm cạnh BOUGHT, không duyệt sâu đồ thị
      filtered: coLoc,
      count: rows.length,
      data: rows,
    });
  })
);

/**
 * GET /api/products/categories
 * Danh mục cho ô lọc phía khách hàng. Công khai, không cần token —
 * trang chủ ai cũng xem được nên bộ lọc cũng phải dùng được khi chưa đăng nhập.
 */
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const rows = await readQuery(q.LIST_CATEGORIES_PUBLIC, {});
    res.json({ count: rows.length, data: rows });
  })
);

/**
 * GET /api/products/recent-purchases
 * Các lượt mua gần nhất, phục vụ dòng tin chạy trên trang chủ.
 *
 * Tên khách được CHE BỚT trước khi trả về: trang chủ là nơi công khai, ghép họ
 * tên đầy đủ với món vừa mua là đủ để lộ thói quen mua sắm của người có thật.
 */
const MAX_RECENT = 20;

router.get(
  '/recent-purchases',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 10), MAX_RECENT);

    const rows = await readQuery(q.RECENT_PURCHASES, { limit: int(limit) });

    res.json({
      count: rows.length,
      data: rows.map((row) => ({
        customer_name: maskCustomerName(row.customer_name),
        product_id: row.product_id,
        product_title: row.product_title,
        price: row.price,
        bought_at: row.bought_at,
      })),
    });
  })
);

/**
 * Task 2.2 + Task 2.5 + Task A8 — GET /api/products/:id
 * Chi tiết 1 sản phẩm, kèm tên danh mục.
 *
 * Ghi nhận hành vi VIEWED:
 * - Ưu tiên 1: user đăng nhập (token) → customerId = 'U_' + uid
 * - Ưu tiên 2: header x-customer-id (tương thích ngược với frontend cũ)
 * - Không có cả hai → chỉ đọc, không ghi VIEWED
 */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const productId = String(req.params.id);

    // Ưu tiên user đã đăng nhập (từ Firebase token), fallback sang header cũ
    const customerId = req.user
      ? `U_${req.user.uid}`
      : req.headers['x-customer-id']
        ? String(req.headers['x-customer-id']).trim()
        : null;

    let rows;
    if (customerId) {
      // Ghi nhận VIEWED + lấy chi tiết sản phẩm trong cùng 1 câu query
      rows = await writeQuery(q.RECORD_VIEWED_AND_GET_PRODUCT, { productId, customerId });
    } else {
      // Khách vãng lai — chỉ đọc, không ghi VIEWED
      rows = await readQuery(q.GET_PRODUCT_BY_ID, { productId });
    }

    if (rows.length === 0) {
      throw new HttpError(404, `Không tìm thấy sản phẩm có id = ${productId}`);
    }

    res.json({ data: rows[0] });
  })
);

/**
 * Task 2.3 — GET /api/products/:id/recommendations
 * Gợi ý mua kèm cho sản phẩm đang xem (Query B).
 * Query params: limit (mặc định 5)
 */
router.get(
  '/:id/recommendations',
  asyncHandler(async (req, res) => {
    const productId = String(req.params.id);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), MAX_RECOMMENDATIONS);

    // Sản phẩm không tồn tại thì trả 404 thay vì mảng rỗng gây hiểu nhầm "không có gợi ý".
    const product = await readQuery(q.GET_PRODUCT_BY_ID, { productId });
    if (product.length === 0) {
      throw new HttpError(404, `Không tìm thấy sản phẩm có id = ${productId}`);
    }

    const rows = await readQuery(q.RECOMMEND_FOR_PRODUCT, { productId, limit: int(limit) });

    res.json({
      source: 'co-purchase', // Query B: (p1)<-[:BOUGHT]-(c2)-[:BOUGHT]->(p2)
      productId,
      count: rows.length,
      data: rows,
    });
  })
);

module.exports = router;
