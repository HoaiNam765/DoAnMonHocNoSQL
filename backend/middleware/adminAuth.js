/**
 * Middleware kiểm tra quyền Admin (Task Admin Dashboard).
 * Kiểm tra xem user đăng nhập có vai trò `admin` trong Neo4j hay không.
 */
const { verifyToken } = require('./auth');
const { readQuery } = require('../db');
const q = require('../queries/cypher');
const { HttpError } = require('../utils/http');

/**
 * Middleware yêu cầu người dùng phải có vai trò Admin.
 * 1. Gọi verifyToken để xác thực Firebase ID Token.
 * 2. Lấy firebase_uid tra cứu trong Neo4j.
 * 3. Kiểm tra trường `role` thu được (từ node Role hoặc c.role).
 * 4. Nếu role !== 'admin' -> trả lỗi 403 Forbidden.
 */
const requireAdmin = async (req, res, next) => {
  verifyToken(req, res, async (err) => {
    if (err) return next(err);

    try {
      if (!req.user || !req.user.uid) {
        throw new HttpError(401, 'Chưa xác thực người dùng.');
      }

      const rows = await readQuery(q.GET_CUSTOMER_BY_FIREBASE_UID, {
        firebaseUid: req.user.uid,
      });

      const customer = rows[0];
      if (!customer) {
        throw new HttpError(404, 'Tài khoản người dùng chưa được đồng bộ vào Neo4j.');
      }

      if (customer.role !== 'admin') {
        throw new HttpError(403, 'Quyền truy cập bị từ chối: Yêu cầu vai trò Admin.');
      }

      req.customer = customer;
      next();
    } catch (error) {
      next(error);
    }
  });
};

module.exports = { requireAdmin };
