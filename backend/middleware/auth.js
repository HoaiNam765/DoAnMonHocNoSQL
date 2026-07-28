/**
 * Middleware xác thực Firebase ID Token (Task A3).
 *
 * verifyToken  — bắt buộc token hợp lệ, dùng cho endpoint cần auth
 * optionalAuth — có token thì gắn req.user, không có thì cho qua
 */
const admin = require('../firebase');
const { HttpError } = require('../utils/http');

/**
 * Trợ giúp lấy Auth instance an toàn trên mọi phiên bản SDK
 */
const getAuth = () => {
  if (typeof admin.auth === 'function') {
    return admin.auth();
  }
  // eslint-disable-next-line global-require
  const { getAuth: getAuthModular } = require('firebase-admin/auth');
  return getAuthModular();
};

/**
 * Trích xuất Bearer token từ header Authorization.
 * @returns {string|null} token hoặc null nếu không có / sai format
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
};

/**
 * Middleware bắt buộc xác thực.
 * - Header: Authorization: Bearer <token>
 * - Thành công → gắn req.user = { uid, email, name }
 * - Thất bại  → ném HttpError(401)
 */
const verifyToken = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new HttpError(401, 'Thiếu token xác thực. Gửi header Authorization: Bearer <token>');
    }

    const decoded = await getAuth().verifyIdToken(token);

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || decoded.email || null,
    };

    next();
  } catch (err) {
    if (err instanceof HttpError) return next(err);
    // Token hết hạn, sai chữ ký, bị revoke, v.v.
    next(new HttpError(401, 'Token không hợp lệ hoặc đã hết hạn'));
  }
};

/**
 * Middleware xác thực tuỳ chọn.
 * - Có token hợp lệ  → gắn req.user
 * - Không có / sai    → req.user = null, tiếp tục bình thường
 * Dùng cho endpoint phục vụ cả khách vãng lai lẫn user đăng nhập.
 */
const optionalAuth = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = await getAuth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || decoded.email || null,
    };
  } catch {
    // Token sai → coi như khách vãng lai, không block request
    req.user = null;
  }
  next();
};

module.exports = { verifyToken, optionalAuth };
