/**
 * Đọc tham số lọc từ query string + che tên khách hàng.
 * Gom vào một chỗ để danh sách sản phẩm, gợi ý và bán chạy dùng chung một cách hiểu.
 */

/**
 * Các kiểu sắp xếp được chấp nhận. Giá trị lạ thì coi như sắp xếp mặc định.
 *
 *   gia_tang / gia_giam — theo giá bán
 *   sao_tang / sao_giam — theo điểm đánh giá
 */
const SORTS = ['gia_tang', 'gia_giam', 'sao_tang', 'sao_giam'];

/**
 * Đọc bộ lọc danh mục + khoảng giá + kiểu sắp xếp.
 *
 * Giá trị không hợp lệ (chữ, số âm) được coi như KHÔNG lọc thay vì báo lỗi 400:
 * đây là bộ lọc phụ trợ, chặn cả trang chỉ vì gõ nhầm một ký tự là quá gắt.
 *
 * @returns {{ categoryId: string|null, minPrice: number|null, maxPrice: number|null,
 *             sort: string, coLoc: boolean }}
 *   coLoc = true khi khách có đụng tới bất kỳ tuỳ chọn nào (kể cả chỉ đổi sắp
 *   xếp). Route dựa vào cờ này để biết khi nào phải dùng biến thể truy vấn có
 *   lọc thay cho câu gốc.
 */
const parseFilters = (query = {}) => {
  const doc = (giaTri) => {
    if (giaTri === undefined || giaTri === null || String(giaTri).trim() === '') return null;
    const so = Number(giaTri);
    return Number.isFinite(so) && so >= 0 ? so : null;
  };

  let minPrice = doc(query.minPrice);
  let maxPrice = doc(query.maxPrice);

  // Khách nhập ngược (từ 500k xuống 100k) thì đảo lại cho đúng ý
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const categoryId = query.categoryId ? String(query.categoryId).trim() : null;

  const sortThô = String(query.sort ?? '').trim();
  const sort = SORTS.includes(sortThô) ? sortThô : '';

  return {
    categoryId: categoryId || null,
    minPrice,
    maxPrice,
    sort,
    coLoc: Boolean(categoryId) || minPrice !== null || maxPrice !== null || sort !== '',
  };
};

/**
 * Che bớt tên khách hàng trước khi đưa ra chỗ công khai.
 *
 * VÌ SAO: dòng tin mua hàng nằm ở trang chủ, ai vào cũng đọc được — kể cả người
 * chưa đăng nhập. Ghép "họ tên đầy đủ + món vừa mua" là đủ để lộ thói quen mua
 * sắm của một người có thật. Giữ tên gọi cho thân thiện, viết tắt phần còn lại.
 *
 *   "Nam Đặng Hoài"   -> "Nam Đ. H."
 *   "phuongthao1505"  -> "phuongthao1505" (một chữ thì che 3 ký tự cuối)
 */
const maskCustomerName = (ten) => {
  const sach = String(ten ?? '').trim().replace(/\s+/g, ' ');
  if (!sach) return 'Khách hàng';

  const tu = sach.split(' ');

  if (tu.length === 1) {
    // Tên một chữ (thường là tên đăng nhập): giữ đầu, che đuôi
    return tu[0].length <= 3 ? tu[0] : tu[0].slice(0, tu[0].length - 3) + '***';
  }

  return [tu[0], ...tu.slice(1).map((chu) => (chu[0] ? `${chu[0]}.` : ''))].join(' ').trim();
};

module.exports = { parseFilters, maskCustomerName };
