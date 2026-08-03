/**
 * Middleware xác thực Firebase ID Token (Task A3).
 *
 * verifyToken  — bắt buộc token hợp lệ, dùng cho endpoint cần auth
 * optionalAuth — có token thì gắn req.user, không có thì cho qua
 */
const admin = require('../firebase');
const { HttpError } = require('../utils/http');
const { readQuery } = require('../db');
const { GET_CUSTOMER_STATUS } = require('../queries/cypher');

/**
 * Kiểm tra tài khoản có bị khoá không.
 *
 * VÌ SAO KIỂM Ở ĐÂY: Firebase chỉ trả lời "token có hợp lệ không", nó không
 * biết gì về trạng thái nghiệp vụ. Trạng thái khoá được admin ghi vào Neo4j,
 * nên phải tra Neo4j thì lệnh khoá mới có hiệu lực. Nếu bỏ bước này, nút
 * "Khoá tài khoản" chỉ đổi màu nhãn chứ không chặn được gì.
 *
 * ĐÁNH ĐỔI: mỗi request đã đăng nhập tốn thêm một truy vấn Neo4j. Truy vấn này
 * tra đúng 1 node theo `customer_id` — trường đã có UNIQUE constraint nên
 * Neo4j dùng index seek, chi phí không đáng kể ở quy mô đồ án. Muốn tối ưu
 * thêm thì cache trạng thái trong bộ nhớ với thời hạn ngắn.
 *
 * Ưu điểm so với việc vô hiệu hoá tài khoản trên Firebase: chỉ có MỘT nguồn sự
 * thật (Neo4j), không phải đồng bộ hai chiều giữa hai hệ thống.
 *
 * @returns {boolean} true nếu tài khoản đang bị khoá
 */
const isBlocked = async (uid) => {
  try {
    const rows = await readQuery(GET_CUSTOMER_STATUS, { customerId: `U_${uid}` });
    // Chưa có node Customer (chưa gọi /auth/sync lần nào) → chưa bị khoá
    return rows[0]?.status === 'blocked';
  } catch (err) {
    // Neo4j lỗi thì KHÔNG chặn người dùng — tránh biến sự cố hạ tầng thành
    // sự cố đăng nhập cho toàn bộ khách hàng.
    console.error('[Auth] Không kiểm tra được trạng thái tài khoản:', err.message);
    return false;
  }
};

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

    if (await isBlocked(decoded.uid)) {
      throw new HttpError(
        403,
        'Tài khoản của bạn đã bị khoá. Vui lòng liên hệ cửa hàng để được hỗ trợ.'
      );
    }

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

    // Tài khoản bị khoá → coi như khách vãng lai: vẫn xem được trang công khai
    // nhưng KHÔNG ghi nhận hành vi VIEWED vào đồ thị gợi ý.
    if (await isBlocked(decoded.uid)) {
      req.user = null;
      return next();
    }

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
