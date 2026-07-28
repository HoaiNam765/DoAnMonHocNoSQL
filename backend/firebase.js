/**
 * Khởi tạo Firebase Admin SDK (singleton).
 * Đọc service account key từ file JSON trong thư mục backend.
 * File này KHÔNG được commit lên git (đã thêm vào .gitignore).
 */
const rawAdmin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Xử lý CJS/ESM interop linh hoạt cho mọi phiên bản Node.js & firebase-admin SDK
const admin = (rawAdmin && (rawAdmin.credential || rawAdmin.apps || rawAdmin.initializeApp))
  ? rawAdmin
  : (rawAdmin.default || rawAdmin);

const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ [Firebase] Không tìm thấy file firebase-service-account.json');
  console.error('   Tải file từ Firebase Console → Project settings → Service accounts');
  console.error('   Đặt tại: backend/firebase-service-account.json');
  process.exit(1);
}

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
  // eslint-disable-next-line global-require
  const serviceAccount = require(serviceAccountPath);
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
