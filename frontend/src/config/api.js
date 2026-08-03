/**
 * Địa chỉ gốc của API backend.
 *
 * VÌ SAO KHÔNG GHI CỨNG "http://localhost:5000":
 * JavaScript chạy trên THIẾT BỊ CỦA NGƯỜI DÙNG, không phải trên máy chủ. Khi
 * bạn bè mở trang từ điện thoại qua địa chỉ LAN, chữ "localhost" sẽ trỏ về
 * chính chiếc điện thoại đó — nơi không có backend nào — nên mọi lời gọi API
 * đều thất bại dù trang vẫn tải được.
 *
 * CÁCH LÀM: suy ra địa chỉ API từ chính địa chỉ đang mở trang.
 *   Mở bằng http://localhost:5173      → API ở http://localhost:5000
 *   Mở bằng http://172.16.40.148:5173  → API ở http://172.16.40.148:5000
 *
 * Nhờ vậy chạy máy mình hay chạy qua mạng LAN đều đúng, không phải sửa code
 * mỗi lần router đổi địa chỉ IP.
 *
 * Muốn trỏ tới máy chủ khác (ví dụ backend chạy trên máy bạn cùng nhóm), tạo
 * file `frontend/.env` với dòng:
 *   VITE_API_URL=http://192.168.1.50:5000/api
 */

const BACKEND_PORT = 5000;

const resolveBaseUrl = () => {
  // Ưu tiên cấu hình thủ công nếu có
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured.replace(/\/+$/, "");

  // Ngược lại lấy đúng giao thức + tên miền của trang hiện tại, đổi cổng
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${BACKEND_PORT}/api`;
};

export const API_BASE_URL = resolveBaseUrl();

/** Ghép đường dẫn con vào địa chỉ gốc, ví dụ apiUrl("/products") */
export const apiUrl = (path = "") => `${API_BASE_URL}${path}`;
