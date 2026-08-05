/**
 * Khởi tạo Firebase Admin SDK (singleton).
 *
 * Lấy khoá theo HAI cách, ưu tiên biến môi trường:
 *
 *  1. Biến `FIREBASE_SERVICE_ACCOUNT` — nội dung file JSON nhét vào một biến.
 *     Dùng khi chạy trên máy chủ thuê (Render, Railway, Fly.io...): những nơi đó
 *     chỉ cho khai báo biến môi trường, KHÔNG cho tải file lên. File
 *     firebase-service-account.json lại đang bị .gitignore nên cũng không theo
 *     mã nguồn lên server được — thiếu cách này là backend không khởi động nổi.
 *
 *  2. File `backend/firebase-service-account.json` — tiện khi chạy ở máy mình.
 *
 * Cả hai đều là BÍ MẬT: ai có nó là toàn quyền trên dự án Firebase.
 */
const rawAdmin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Xử lý CJS/ESM interop linh hoạt cho mọi phiên bản Node.js & firebase-admin SDK
const admin = (rawAdmin && (rawAdmin.credential || rawAdmin.apps || rawAdmin.initializeApp))
  ? rawAdmin
  : (rawAdmin.default || rawAdmin);

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

/**
 * Đọc service account, ưu tiên biến môi trường.
 *
 * Chấp nhận cả JSON thô lẫn base64 — dán JSON nhiều dòng vào ô nhập biến môi
 * trường của một số nhà cung cấp hay bị hỏng xuống dòng, base64 thì an toàn hơn.
 */
const docServiceAccount = () => {
  const tuBien = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (tuBien && tuBien.trim()) {
    const chuoi = tuBien.trim();
    const json = chuoi.startsWith('{') ? chuoi : Buffer.from(chuoi, 'base64').toString('utf8');

    try {
      const sa = JSON.parse(json);
      console.log('🔑 [Firebase] Dùng khoá từ biến môi trường FIREBASE_SERVICE_ACCOUNT');
      return sa;
    } catch (err) {
      console.error('❌ [Firebase] FIREBASE_SERVICE_ACCOUNT không phải JSON hợp lệ:', err.message);
      console.error('   Dán nguyên nội dung file JSON, hoặc mã hoá base64 rồi dán.');
      process.exit(1);
    }
  }

  if (fs.existsSync(serviceAccountPath)) {
    // eslint-disable-next-line global-require
    return require(serviceAccountPath);
  }

  console.error('❌ [Firebase] Không tìm thấy khoá dịch vụ.');
  console.error('   Chạy ở máy mình: đặt file tại backend/firebase-service-account.json');
  console.error('   Chạy trên server: khai báo biến FIREBASE_SERVICE_ACCOUNT');
  console.error('   Tải file từ Firebase Console → Project settings → Service accounts');
  process.exit(1);
  return null;
};

// Hàm lấy credential cert tương thích cả bản legacy lẫn modular SDK
const getCredential = (serviceAccount) => {
  if (admin.credential && typeof admin.credential.cert === 'function') {
    return admin.credential.cert(serviceAccount);
  }
  if (rawAdmin.credential && typeof rawAdmin.credential.cert === 'function') {
    return rawAdmin.credential.cert(serviceAccount);
  }
  // eslint-disable-next-line global-require
  const { cert } = require('firebase-admin/app');
  return cert(serviceAccount);
};

const apps = admin.apps || rawAdmin.apps || [];

// Chỉ khởi tạo 1 lần duy nhất (tránh lỗi khi nodemon restart)
if (!apps.length) {
  const serviceAccount = docServiceAccount();
  const credential = getCredential(serviceAccount);

  if (typeof admin.initializeApp === 'function') {
    admin.initializeApp({ credential });
  } else if (typeof rawAdmin.initializeApp === 'function') {
    rawAdmin.initializeApp({ credential });
  } else {
    // eslint-disable-next-line global-require
    const { initializeApp } = require('firebase-admin/app');
    initializeApp({ credential });
  }

  console.log('✅ [Firebase] Admin SDK đã khởi tạo thành công');
}

module.exports = admin;
