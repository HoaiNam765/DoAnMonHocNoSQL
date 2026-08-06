/**
 * Dịch mã lỗi Firebase Auth sang câu tiếng Việt.
 *
 * Quan trọng: với mã lạ, PHẢI in kèm mã gốc thay vì nuốt đi. Trước đây trang
 * Login trả về "Đăng nhập thất bại. Vui lòng thử lại." cho mọi lỗi không nằm
 * trong danh sách, khiến các lỗi cấu hình (sai domain, popup bị chặn) không thể
 * chẩn đoán được — người dùng lẫn lập trình viên đều không biết hỏng ở đâu.
 */

const MESSAGES = {
  // --- Sai thông tin đăng nhập & khôi phục mật khẩu ---
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
  'auth/user-not-found': 'Không tìm thấy tài khoản với email này hoặc thông tin đăng nhập không đúng.',
  'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
  'auth/invalid-email': 'Email không hợp lệ.',
  'auth/missing-email': 'Vui lòng nhập địa chỉ email.',
  'auth/user-disabled': 'Tài khoản này đã bị vô hiệu hoá.',
  'auth/too-many-requests':
    'Tài khoản tạm thời bị khoá do gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',

  // --- Đăng ký ---
  'auth/email-already-in-use': 'Email này đã được đăng ký.',
  'auth/weak-password': 'Mật khẩu quá yếu, vui lòng nhập ít nhất 6 ký tự.',

  // --- Lỗi cấu hình / môi trường (hay gặp khi chạy local) ---
  'auth/unauthorized-domain':
    `Tên miền "${typeof window !== 'undefined' ? window.location.hostname : ''}" chưa được Firebase cho phép. ` +
    'Hãy mở trang bằng http://localhost:5173, hoặc thêm tên miền này vào ' +
    'Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/popup-blocked':
    'Trình duyệt đã chặn cửa sổ đăng nhập Google. Hãy cho phép pop-up cho trang này rồi thử lại.',
  'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập Google.',
  'auth/cancelled-popup-request': 'Yêu cầu đăng nhập trước đó đã bị huỷ. Vui lòng thử lại.',
  'auth/operation-not-allowed':
    'Phương thức đăng nhập này chưa được bật trong Firebase Console → Authentication → Sign-in method.',
  'auth/network-request-failed':
    'Không kết nối được tới Firebase. Kiểm tra lại mạng rồi thử lại.',
  'auth/invalid-api-key': 'Cấu hình Firebase sai. Kiểm tra lại VITE_FIREBASE_API_KEY trong frontend/.env.',
  'auth/api-key-not-valid': 'Cấu hình Firebase sai. Kiểm tra lại VITE_FIREBASE_API_KEY trong frontend/.env.',
};

/** Các mã không cần hiện lỗi vì là hành động cố ý của người dùng. */
export const SILENT_CODES = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

export function getFriendlyErrorMessage(error, defaultPrefix = 'Thao tác thất bại') {
  // Lỗi từ backend (fetch) — không có mã Firebase
  if (error?.status === 403) return 'Tài khoản chưa được cấp quyền Admin.';

  const code = error?.code;
  if (code && MESSAGES[code]) return MESSAGES[code];

  // Mã lạ: vẫn hiện mã gốc để còn tra cứu / báo lỗi được
  return code
    ? `${defaultPrefix} (${code}).`
    : `${defaultPrefix}. ${error?.message || 'Vui lòng thử lại.'}`;
}

