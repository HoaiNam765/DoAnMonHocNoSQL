/**
 * Routes xác thực — Task A4 & A5
 *
 * POST /api/auth/sync  — đồng bộ user Firebase ↔ Neo4j (tạo hoặc cập nhật node Customer)
 * GET  /api/auth/me    — lấy thông tin user hiện tại từ Neo4j
 */
const express = require('express');

const { writeQuery, readQuery } = require('../db');
const q = require('../queries/cypher');
const { asyncHandler, HttpError } = require('../utils/http');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Task A4 — POST /api/auth/sync
 * Đồng bộ thông tin user từ Firebase vào Neo4j.
 * - MERGE theo customer_id = 'U_' + firebase_uid → idempotent
 * - ON CREATE: tạo node mới với firebase_uid, tên, email, created_at
 * - ON MATCH: cập nhật tên, email (cho phép đổi tên trên Firebase)
 * - Trả về thông tin kèm bought_count
 */
router.post(
  '/sync',
  verifyToken,
  asyncHandler(async (req, res) => {
    const { uid, email, name } = req.user;

    const rows = await writeQuery(q.SYNC_CUSTOMER, {
      customerId: `U_${uid}`,
      firebaseUid: uid,
      customerName: name || email || 'Người dùng',
      email: email || '',
    });

    res.json({ data: rows[0] });
  })
);

/**
 * Task A5 — GET /api/auth/me
 * Lấy thông tin user hiện tại từ Neo4j theo firebase_uid.
 * - Token hợp lệ nhưng chưa gọi /sync → 404
 * - Đã sync → trả thông tin kèm bought_count
 */
router.get(
  '/me',
  verifyToken,
  asyncHandler(async (req, res) => {
    const rows = await readQuery(q.GET_CUSTOMER_BY_FIREBASE_UID, {
      firebaseUid: req.user.uid,
    });

    if (rows.length === 0) {
      throw new HttpError(
        404,
        'Chưa đồng bộ tài khoản. Gọi POST /api/auth/sync trước.'
      );
    }

    res.json({ data: rows[0] });
  })
);

module.exports = router;
