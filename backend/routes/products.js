const express = require('express');

const { readQuery, int } = require('../db');
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
 * Task 2.2 — GET /api/products/:id
 * Chi tiết 1 sản phẩm, kèm tên danh mục.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const rows = await readQuery(q.GET_PRODUCT_BY_ID, { productId: String(req.params.id) });

    if (rows.length === 0) {
      throw new HttpError(404, `Không tìm thấy sản phẩm có id = ${req.params.id}`);
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
