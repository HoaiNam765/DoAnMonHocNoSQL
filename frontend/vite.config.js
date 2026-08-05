import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Đọc file .env DÙNG CHUNG ở thư mục gốc dự án, thay cho frontend/.env riêng.
  //
  // AN TOÀN: Vite đọc cả file nhưng CHỈ đưa ra trình duyệt những biến có tiền tố
  // VITE_. Mật khẩu Neo4j, khoá Gemini, khoá webhook SePay nằm cùng file vẫn
  // không lọt vào mã nguồn tải về máy khách.
  //
  // ĐÁNH ĐỔI PHẢI BIẾT: chỉ cần đặt nhầm tiền tố VITE_ cho một bí mật là nó bị
  // ghi thẳng vào file JS ai cũng tải về đọc được. Trước đây hai file tách nhau
  // nên lỡ tay cũng khó lộ; giờ chung một file thì phải cẩn thận hơn.
  envDir: '..',
})
