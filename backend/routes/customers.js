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
 * Task 2.4 — GET /api/customers
 * Danh sách khách hàng phục vụ dropdown "đăng nhập giả lập" ở Header.
 * Mặc định trả 50 khách mua nhiều nhất để dropdown luôn có dữ liệu đẹp để demo.
 * Query params: page, limit, search
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
    const search = parseSearch(req.query.search);

    const [countRows, rows] = await Promise.all([
      readQuery(q.COUNT_CUSTOMERS, { search }),
      readQuery(q.LIST_CUSTOMERS, { search, skip: int(skip), limit: int(limit) }),
    ]);

    const total = countRows[0]?.total ?? 0;

    res.json({
      data: rows,
      pagination: buildPagination(page, limit, total),
    });
  })
);

/**
 * GET /api/customers/:id — thông tin 1 khách hàng (tiện cho frontend và cho việc test).
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const rows = await readQuery(q.GET_CUSTOMER_BY_ID, { customerId: String(req.params.id) });

    if (rows.length === 0) {
      throw new HttpError(404, `Không tìm thấy khách hàng có customer_id = ${req.params.id}`);
    }

    res.json({ data: rows[0] });
  })
);

/**
 * Task 2.4 — GET /api/customers/:id/recommendations
 * Gợi ý cá nhân hoá theo khách hàng (Query A — đúng pattern đề bài).
 * Query params: limit (mặc định 5)
 */
router.get(
  '/:id/recommendations',
  asyncHandler(async (req, res) => {
    const customerId = String(req.params.id);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 5), MAX_RECOMMENDATIONS);

    const customer = await readQuery(q.GET_CUSTOMER_BY_ID, { customerId });
    if (customer.length === 0) {
      throw new HttpError(404, `Không tìm thấy khách hàng có customer_id = ${customerId}`);
    }

    const rows = await readQuery(q.RECOMMEND_FOR_CUSTOMER, { customerId, limit: int(limit) });

    res.json({
      source: 'collaborative-filtering', // Query A: (c1)-[:BOUGHT]->(p1)<-[:BOUGHT]-(c2)-[:BOUGHT]->(p2)
      customerId,
      customerName: customer[0].customer_name,
      count: rows.length,
      data: rows,
    });
  })
);

module.exports = router;
