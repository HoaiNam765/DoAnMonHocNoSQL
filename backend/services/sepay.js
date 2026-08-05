const crypto = require('crypto');
const { ORDER_PREFIX } = require('../utils/orderCode');

/**
 * Tích hợp thanh toán chuyển khoản qua SePay (https://sepay.vn).
 *
 * CÁCH HOẠT ĐỘNG — khác hẳn cổng thanh toán thẻ:
 * SePay không giữ tiền và không xử lý thẻ. Nó nối vào tài khoản ngân hàng của
 * cửa hàng, theo dõi biến động số dư, và mỗi khi có tiền vào thì gọi webhook
 * báo cho hệ thống mình. Việc của mình là đối chiếu nội dung chuyển khoản với
 * mã đơn rồi tự đánh dấu đã thanh toán.
 *
 * Nhờ vậy không phải đụng tới dữ liệu thẻ, không thuộc phạm vi PCI-DSS, và
 * khách trả tiền bằng chính app ngân hàng quen thuộc.
 *
 * LUỒNG:
 *   1. Khách đặt đơn  -> hệ thống sinh mã đơn DHxxxxxxxx
 *   2. Hiện mã QR có sẵn số tiền + nội dung chuyển khoản là mã đơn
 *   3. Khách quét, chuyển tiền
 *   4. SePay phát hiện tiền vào -> gọi webhook của mình
 *   5. Mình đối chiếu mã đơn -> đánh dấu đã thanh toán -> đẩy sự kiện xuống
 *      trình duyệt (SSE) để khách thấy đổi trạng thái ngay
 */

/** Ảnh QR do SePay dựng sẵn — chỉ là URL ảnh, không cần gọi API, không cần khoá. */
const QR_BASE = 'https://qr.sepay.vn/img';

const cauHinh = () => ({
  soTaiKhoan: process.env.SEPAY_ACCOUNT_NUMBER || '',
  nganHang: process.env.SEPAY_BANK || '',
  khoaWebhook: process.env.SEPAY_WEBHOOK_APIKEY || '',
});

/** Đã khai báo đủ thông tin để nhận chuyển khoản chưa. */
const daCauHinh = () => {
  const c = cauHinh();
  return Boolean(c.soTaiKhoan && c.nganHang);
};

/**
 * Dựng đường dẫn ảnh QR cho một đơn hàng.
 *
 * Nội dung chuyển khoản đặt đúng bằng MÃ ĐƠN — đó là thứ duy nhất dùng để đối
 * chiếu tiền vào với đơn. App ngân hàng tự điền sẵn nên khách không phải gõ tay,
 * tránh được cảnh gõ sai một ký tự là tiền vào mà không biết của đơn nào.
 */
const taoUrlQr = ({ orderId, amount }) => {
  const c = cauHinh();
  if (!daCauHinh()) return null;

  const thamSo = new URLSearchParams({
    acc: c.soTaiKhoan,
    bank: c.nganHang,
    amount: String(Math.round(Number(amount) || 0)),
    des: String(orderId),
  });

  return `${QR_BASE}?${thamSo.toString()}`;
};

/**
 * So sánh khoá webhook theo kiểu chống dò thời gian.
 *
 * Dùng `===` thì thời gian so sánh phụ thuộc số ký tự khớp được, kẻ tấn công đo
 * chênh lệch đó có thể dò ra khoá từng ký tự một. timingSafeEqual luôn tốn thời
 * gian như nhau.
 */
const khoaHopLe = (headerAuth) => {
  const c = cauHinh();
  if (!c.khoaWebhook) return false;

  const nhan = String(headerAuth ?? '').replace(/^Apikey\s+/i, '').trim();
  if (!nhan) return false;

  const a = Buffer.from(nhan);
  const b = Buffer.from(c.khoaWebhook);

  // timingSafeEqual đòi hai buffer bằng độ dài, khác độ dài là chắc chắn sai rồi
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
};

/**
 * Bóc mã đơn ra khỏi dữ liệu webhook.
 *
 * SePay có thể tự tách mã vào trường `code` nếu đã cấu hình mẫu nhận dạng trong
 * bảng điều khiển. Nhưng không phải lúc nào cũng có, nên vẫn tự dò trong
 * `content` làm phương án dự phòng.
 *
 * Ngân hàng hay chèn thêm chữ vào nội dung chuyển khoản ("CT DEN:... DH1A2B3C4D
 * ..."), nên phải dò theo mẫu chứ không so sánh cả chuỗi.
 */
const bocMaDon = ({ code, content }) => {
  const mau = new RegExp(`${ORDER_PREFIX}[0-9A-Z]{8}`, 'i');

  const tuCode = String(code ?? '').match(mau);
  if (tuCode) return tuCode[0].toUpperCase();

  // Nội dung chuyển khoản qua ngân hàng thường bị bỏ dấu và có thể viết thường
  const tuContent = String(content ?? '').match(mau);
  if (tuContent) return tuContent[0].toUpperCase();

  return null;
};

module.exports = { taoUrlQr, khoaHopLe, bocMaDon, daCauHinh, cauHinh };
