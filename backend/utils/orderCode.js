const crypto = require('crypto');

/**
 * Sinh mã đơn hàng dạng DHxxxxxxxx.
 *
 * Mã này là thứ khách đọc cho nhân viên khi tới cửa hàng thanh toán, nên:
 *   - Không dùng chữ I và O (dễ đọc nhầm thành 1 và 0)
 *   - Toàn chữ IN HOA + số, đọc qua điện thoại không bị nhầm
 *
 * Dùng crypto.randomInt thay vì "lấy max rồi + 1" — hai người đặt đơn cùng lúc
 * mà đếm số thứ tự thì sẽ sinh trùng mã. Không gian mã 32^8 ≈ 1,1 nghìn tỷ nên
 * xác suất trùng ở quy mô đồ án là không đáng kể.
 */

const ORDER_PREFIX = 'DH';
const CODE_LENGTH = 8;
const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const generateOrderCode = () => {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return ORDER_PREFIX + code;
};

module.exports = { ORDER_PREFIX, generateOrderCode };
