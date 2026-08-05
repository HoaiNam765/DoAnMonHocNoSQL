const { HttpError } = require('./http');

/**
 * Xử lý THUỘC TÍNH TUỲ Ý của sản phẩm — phần thể hiện tính schema-less.
 *
 * Người quản trị được tự đặt tên thuộc tính lúc chạy ("Mô tả", "Xuất xứ",
 * "Bảo hành"...), nên toàn bộ việc kiểm tra đầu vào dồn về đây.
 */

/**
 * Những thuộc tính KHÔNG được đụng tới qua đường thuộc tính tuỳ ý.
 *
 * Chúng có ô nhập riêng trong form và có ràng buộc kiểu dữ liệu rõ ràng. Nếu để
 * admin ghi đè qua đây thì chỉ cần gõ nhầm tên "final_price" rồi nhập chữ là
 * giá sản phẩm thành chuỗi, kéo theo mọi phép tính tiền và mọi bộ lọc giá hỏng
 * theo. `id` còn nguy hơn: đổi id là mất dấu mọi quan hệ đã trỏ tới sản phẩm.
 */
const CORE_KEYS = new Set(['id', 'title', 'final_price', 'rating', 'image', 'stock', 'status']);

/** Giới hạn để một lần gọi không thể bơm hàng nghìn thuộc tính vào một node. */
const MAX_ATTRS = 30;
const MAX_KEY_LENGTH = 50;
const MAX_VALUE_LENGTH = 2000;

/**
 * Tách phần thuộc tính tuỳ ý ra khỏi map thuộc tính đầy đủ của node.
 * @param {object} props kết quả của properties(p) trong Cypher
 */
const extractCustomAttributes = (props) =>
  Object.fromEntries(
    Object.entries(props ?? {}).filter(([khoa]) => !CORE_KEYS.has(khoa))
  );

/**
 * Đoán kiểu dữ liệu cho giá trị người dùng nhập.
 *
 * Ô nhập trên web luôn trả về chuỗi, nhưng lưu tất cả thành chuỗi thì mất hẳn
 * một điểm đáng khoe của NoSQL: mỗi thuộc tính có kiểu riêng, số vẫn là số và
 * so sánh được. Nên "12" lưu thành số 12, "true" thành boolean, còn lại giữ chữ.
 *
 * Cố ý KHÔNG đổi những chuỗi số có số 0 ở đầu ("0901234567") thành số — đó
 * thường là số điện thoại hay mã hàng, đổi sang số là mất luôn số 0 đứng đầu.
 */
const doanKieu = (giaTri) => {
  if (typeof giaTri !== 'string') return giaTri;

  const sach = giaTri.trim();

  if (sach.toLowerCase() === 'true') return true;
  if (sach.toLowerCase() === 'false') return false;

  const laSoThuan = /^-?\d+(\.\d+)?$/.test(sach);
  const coSoKhongDauDong = /^0\d/.test(sach);

  if (laSoThuan && !coSoKhongDauDong) {
    const so = Number(sach);
    if (Number.isFinite(so)) return so;
  }

  return giaTri;
};

/**
 * Kiểm tra và chuẩn hoá map thuộc tính do admin gửi lên.
 *
 * @param {object} thoc map { tên: giá trị }. Giá trị null nghĩa là XOÁ thuộc tính.
 * @returns {object} map đã chuẩn hoá, dùng thẳng cho `SET p += $attrs`
 */
const parseAttributes = (thoc) => {
  if (thoc === null || typeof thoc !== 'object' || Array.isArray(thoc)) {
    throw new HttpError(400, 'Danh sách thuộc tính không hợp lệ');
  }

  const cacKhoa = Object.keys(thoc);
  if (cacKhoa.length > MAX_ATTRS) {
    throw new HttpError(400, `Mỗi sản phẩm chỉ nhận tối đa ${MAX_ATTRS} thuộc tính tuỳ ý`);
  }

  const ketQua = {};

  for (const khoaThô of cacKhoa) {
    const khoa = String(khoaThô).trim();

    if (!khoa) throw new HttpError(400, 'Tên thuộc tính không được để trống');
    if (khoa.length > MAX_KEY_LENGTH) {
      throw new HttpError(400, `Tên thuộc tính "${khoa}" quá dài (tối đa ${MAX_KEY_LENGTH} ký tự)`);
    }
    if (CORE_KEYS.has(khoa)) {
      throw new HttpError(
        400,
        `"${khoa}" là thuộc tính có sẵn của sản phẩm, hãy sửa ở ô riêng của nó thay vì thêm mới`
      );
    }

    const giaTri = thoc[khoaThô];

    // null = yêu cầu xoá thuộc tính. Giữ nguyên để `SET p += {khoa: null}` xoá giúp.
    if (giaTri === null) {
      ketQua[khoa] = null;
      continue;
    }

    if (typeof giaTri === 'object') {
      throw new HttpError(400, `Giá trị của "${khoa}" phải là chữ, số hoặc đúng/sai`);
    }

    const chuoi = String(giaTri);
    if (chuoi.length > MAX_VALUE_LENGTH) {
      throw new HttpError(400, `Giá trị của "${khoa}" quá dài (tối đa ${MAX_VALUE_LENGTH} ký tự)`);
    }

    // Chuỗi rỗng cũng coi là xoá — admin xoá trắng ô nghĩa là không muốn giữ nữa
    ketQua[khoa] = chuoi.trim() === '' ? null : doanKieu(chuoi);
  }

  return ketQua;
};

module.exports = { CORE_KEYS, extractCustomAttributes, parseAttributes, doanKieu, MAX_ATTRS };
