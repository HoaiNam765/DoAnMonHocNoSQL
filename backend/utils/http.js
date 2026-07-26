/** Bọc route async để lỗi được đẩy về error handler thay vì làm treo request. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Lỗi có kèm HTTP status, dùng cho các trường hợp 400/404. */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Đọc tham số phân trang từ query string, có chặn giá trị vô lý. */
const parsePagination = (query, { defaultLimit = 12, maxLimit = 100 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

/** Chuẩn hoá từ khoá tìm kiếm: bỏ khoảng trắng thừa + hạ chữ thường (khớp toLower trong Cypher). */
const parseSearch = (value) => String(value ?? '').trim().toLowerCase();

const buildPagination = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 0,
});

module.exports = { asyncHandler, HttpError, parsePagination, parseSearch, buildPagination };
