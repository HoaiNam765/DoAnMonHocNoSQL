const express = require('express');

const { asyncHandler, HttpError } = require('../utils/http');
const { traLoi } = require('../services/chatAssistant');

const router = express.Router();

/** Độ dài câu hỏi tối đa — chặn người dùng dán cả quyển sách làm tốn hạn mức API. */
const MAX_MESSAGE_LENGTH = 500;
/** Số lượt hội thoại cũ gửi kèm. Giữ ít để tiết kiệm token mà vẫn đủ ngữ cảnh. */
const MAX_HISTORY = 8;

// ---------------------------------------------------------------------------
// Giới hạn tần suất
// ---------------------------------------------------------------------------
// Giới hạn này CHỈ để chống lạm dụng (ví dụ vòng lặp gọi API trong console),
// không phải để tiết kiệm hạn mức Google. Phần lớn câu hỏi được bộ đệm và lớp
// lọc nhanh xử lý, chỉ tốn một truy vấn Neo4j — rẻ ngang mọi API khác nên
// không có lý do gì chặn sớm.
//
// Việc tiết kiệm hạn mức AI do "ngân sách Gemini" trong chatAssistant lo, và
// vượt ngân sách thì hạ cấp chứ không báo lỗi.
//
// Đặt quá chặt sẽ phản tác dụng: bản đầu tiên để 20 lượt/5 phút, thử bắn 18 câu
// đồng thời thì chính nó chặn mất 11 câu dù không tốn lượt AI nào.
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 phút
const RATE_LIMIT_MAX = 60;

const hits = new Map(); // ip -> number[] (mốc thời gian các request gần đây)

const rateLimit = (req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();

  const recent = (hits.get(ip) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    return next(new HttpError(429, 'Bạn hỏi hơi nhanh, chờ một chút rồi hỏi tiếp giúp mình nhé.'));
  }

  recent.push(now);
  hits.set(ip, recent);

  // Dọn định kỳ để Map không phình mãi khi server chạy lâu
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (times.every((time) => now - time >= RATE_LIMIT_WINDOW_MS)) hits.delete(key);
    }
  }

  return next();
};

/**
 * POST /api/chat
 * Body: { message: string, history?: [{ role: 'user'|'model', text: string }] }
 *
 * Không bắt buộc đăng nhập: xem sản phẩm vốn là chức năng công khai, khách vãng
 * lai cũng hỏi được. Việc thêm vào giỏ mới cần đăng nhập, và việc đó do khách
 * tự bấm nút trên thẻ sản phẩm chứ chatbot không tự làm.
 */
router.post(
  '/',
  rateLimit,
  asyncHandler(async (req, res) => {
    const message = String(req.body?.message ?? '').trim();

    if (!message) {
      throw new HttpError(400, 'Bạn chưa nhập câu hỏi.');
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new HttpError(400, `Câu hỏi quá dài (tối đa ${MAX_MESSAGE_LENGTH} ký tự).`);
    }

    // Lịch sử do frontend gửi lên nên không tin tưởng tuyệt đối:
    // cắt bớt, ép kiểu và chỉ nhận đúng hai vai trò hợp lệ.
    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = rawHistory
      .slice(-MAX_HISTORY)
      .filter((item) => item && typeof item.text === 'string' && item.text.trim())
      .map((item) => ({
        role: item.role === 'model' ? 'model' : 'user',
        text: String(item.text).slice(0, MAX_MESSAGE_LENGTH),
      }));

    const result = await traLoi(message, history, {
      ip: req.ip || req.socket?.remoteAddress || 'chung',
    });

    res.json({
      status: 'success',
      data: {
        reply: result.reply,
        products: result.products,
        // Cho biết câu trả lời đến từ đâu (đệm / lọc nhanh / Gemini / hạ cấp).
        // Frontend không dùng, nhưng rất tiện khi demo và khi gỡ lỗi hạn mức.
        nguon: result.nguon,
      },
    });
  })
);

module.exports = router;
