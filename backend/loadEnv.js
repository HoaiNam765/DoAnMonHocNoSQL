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

if (!fs.existsSync(DUONG_DAN)) {
  console.error(`⚠️  Không tìm thấy file cấu hình: ${DUONG_DAN}`);
  console.error('   Chép .env.example thành .env rồi điền thông tin vào.');
}

require('dotenv').config({ path: DUONG_DAN });

module.exports = { DUONG_DAN };
