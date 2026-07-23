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
    const categoryId = req.query.categoryId ? String(req.query.categoryId).trim() : null;

    const params = { search, categoryId };

    const [countRows, rows] = await Promise.all([
      readQuery(q.COUNT_PRODUCTS, params),
      readQuery(q.LIST_PRODUCTS, { ...params, skip: int(skip), limit: int(limit) }),
    ]);

    const total = countRows[0]?.total ?? 0;

    res.json({
      data: rows,
      pagination: buildPagination(page, limit, total),
    });
  })
);

/**
 * Task 2.2 + Task 2.5 — GET /api/products/:id
 * Chi tiết 1 sản phẩm, kèm tên danh mục.
 *
 * Task 2.5: Nếu header `x-customer-id` có giá trị (do frontend gửi khi đã
 * chọn khách hàng trong dropdown "đăng nhập giả lập"), backend sẽ tự động
 * ghi nhận hành vi VIEWED bằng MERGE — không tạo trùng nếu đã xem trước đó.
 * Khách vãng lai (chưa chọn khách) thì chỉ trả dữ liệu sản phẩm bình thường.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const productId = String(req.params.id);

    // TODO(security): Trong hệ thống thực, customerId phải lấy từ session/JWT
    // đã xác thực. Ở đây dùng header giả lập cho mục đích đồ án.
    const customerId = req.headers['x-customer-id']
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
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 5), MAX_RECOMMENDATIONS);

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
