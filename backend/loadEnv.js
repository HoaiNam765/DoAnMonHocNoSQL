const path = require('path');
const fs = require('fs');

/**
 * Nạp file .env DÙNG CHUNG ở thư mục gốc dự án.
 *
 * VÌ SAO CẦN FILE NÀY: `require('dotenv').config()` mặc định chỉ tìm .env ở
 * THƯ MỤC ĐANG CHẠY LỆNH. Chạy `npm start` trong backend thì nó tìm
 * backend/.env, nhưng chạy script từ chỗ khác lại tìm nhầm chỗ — đã từng gặp:
 * script trong scratchpad báo "injected env (0)" rồi không kết nối được Neo4j.
 *
 * Ở đây trỏ thẳng tới file gốc bằng đường dẫn tuyệt đối tính từ vị trí file này,
 * nên gọi từ đâu cũng ra đúng một file.
 *
 * Cách dùng: `require('./loadEnv')` (hoặc `../loadEnv` trong scripts/) THAY CHO
 * `require('dotenv').config()`.
 */

const DUONG_DAN = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(DUONG_DAN)) {
  require('dotenv').config({ path: DUONG_DAN });
}

// Không có file .env KHÔNG phải lúc nào cũng là lỗi: khi chạy trên máy chủ thuê
// (Render, Railway, Fly.io...) biến được nền tảng nạp thẳng vào tiến trình, làm
// gì có file nào. Nên chỉ kêu khi thật sự thiếu thứ tối thiểu để chạy — kêu bừa
// trong log production chỉ khiến người đọc tưởng hỏng.
const BAT_BUOC = ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'];
const thieu = BAT_BUOC.filter((k) => !process.env[k]);

if (thieu.length > 0) {
  console.error(`❌ Thiếu cấu hình bắt buộc: ${thieu.join(', ')}`);
  if (fs.existsSync(DUONG_DAN)) {
    console.error(`   Điền các biến này vào ${DUONG_DAN}`);
  } else {
    console.error('   Chạy ở máy mình: chép .env.example thành .env ở thư mục gốc rồi điền vào.');
    console.error('   Chạy trên máy chủ: khai báo trong phần Environment Variables.');
  }
}

module.exports = { DUONG_DAN };
