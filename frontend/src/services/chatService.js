import { apiUrl } from "../config/api";

const API_URL = apiUrl("/chat");

/**
 * Gửi câu hỏi cho trợ lý.
 *
 * Không gọi thẳng Gemini từ đây: API key phải nằm ở backend, nếu để trong mã
 * frontend thì ai mở DevTools cũng lấy được và xài hết hạn mức của mình.
 *
 * @param {string} message  Câu hỏi của khách
 * @param {Array}  history  [{ role: 'user'|'model', text }] — vài lượt gần nhất
 * @returns {{ reply: string, products: Array }}
 */
export async function sendChatMessage(message, history = []) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
    });

    let body = null;
    try {
        body = await response.json();
    } catch {
        /* lỗi mạng có thể không kèm JSON */
    }

    if (!response.ok) {
        const error = new Error(body?.message || "Trợ lý đang bận, bạn thử lại sau nhé.");
        error.status = response.status;
        throw error;
    }

    return body.data;
}
