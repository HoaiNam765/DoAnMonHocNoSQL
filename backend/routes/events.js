const express = require('express');

const { readQuery } = require('../db');
const q = require('../queries/cypher');
const { asyncHandler, HttpError } = require('../utils/http');
const { verifyToken } = require('../middleware/auth');
const { capVe, dungVe, themKetNoi, boKetNoi } = require('../services/eventBus');

const router = express.Router();

/**
 * POST /api/events/ticket
 * Xin vé để mở luồng sự kiện. Bắt buộc có token — đây là chỗ xác thực thật sự.
 *
 * Vé kèm sẵn thông tin "ai" và "có phải admin không", nên lúc mở luồng không
 * phải tra lại Neo4j nữa.
 */
router.post(
  '/ticket',
  verifyToken,
  asyncHandler(async (req, res) => {
    const customerId = `U_${req.user.uid}`;

    const rows = await readQuery(q.GET_CUSTOMER_BY_FIREBASE_UID, { firebaseUid: req.user.uid });
    const laAdmin = rows[0]?.role === 'admin';

    res.json({ status: 'success', data: { ticket: capVe({ customerId, laAdmin }), laAdmin } });
  })
);

/**
 * GET /api/events/stream?ticket=...
 * Luồng sự kiện SSE. Giữ kết nối mở, máy chủ đẩy dữ liệu xuống khi có đơn đổi.
 */
router.get('/stream', (req, res, next) => {
  const chuVe = dungVe(req.query.ticket);

  if (!chuVe) {
    return next(new HttpError(401, 'Vé không hợp lệ hoặc đã hết hạn'));
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Tắt gom đệm của proxy (nginx), không thì sự kiện bị giữ lại chờ đủ khối
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const id = themKetNoi(res, chuVe);

  // Báo cho trình duyệt biết đã kết nối xong — tiện gỡ lỗi và để giao diện
  // hiện dấu hiệu "đang theo dõi trực tiếp".
  res.write(`event: ready\ndata: ${JSON.stringify({ laAdmin: chuVe.laAdmin })}\n\n`);

  req.on('close', () => boKetNoi(id));

  return undefined;
});

module.exports = router;
