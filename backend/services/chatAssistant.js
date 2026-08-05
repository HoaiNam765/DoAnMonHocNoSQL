/**
 * Điều phối trợ lý chat — quyết định câu hỏi nào xử lý bằng cách nào.
 *
 * Thứ tự ưu tiên (rẻ trước, đắt sau):
 *   1. Bộ nhớ đệm      — câu vừa có người hỏi y hệt → trả lại ngay, 0 lượt API
 *   2. Lọc nhanh       — câu khuôn mẫu ("dưới 500k") → tra Neo4j thẳng, 0 lượt API
 *   3. Gemini          — câu phức tạp mới cần tới AI (~2 lượt API)
 *   4. Hạ cấp          — Gemini lỗi/hết hạn mức → quay về lọc nhanh thay vì báo lỗi
 *
 * Nhờ bước 4, khách gần như không bao giờ thấy thông báo "trợ lý đang quá tải":
 * xấu nhất là bot trả lời cộc hơn nhưng vẫn ra đúng sản phẩm từ cơ sở dữ liệu.
 */
const { chat: hoiGemini } = require('./geminiChat');
const { phanTichCauHoi, traLoiKhongCanAI, doanYDinhDuPhong } = require('./quickParse');

// ---------------------------------------------------------------------------
// Bộ nhớ đệm
// ---------------------------------------------------------------------------
// Chỉ đệm câu hỏi ĐẦU TIÊN của một cuộc trò chuyện (history rỗng). Câu hỏi giữa
// chừng phụ thuộc ngữ cảnh phía trước nên đệm sẽ trả lời sai.
//
// Thời hạn ngắn (5 phút) vì admin có thể sửa giá bất cứ lúc nào — quá hạn thì
// truy vấn lại cho chắc. Đủ dài để cả buổi demo bấm đi bấm lại vẫn dùng lại được.
const HAN_MS = 5 * 60 * 1000;
const SO_MUC_TOI_DA = 100;

const boNho = new Map(); // khoá -> { luc, duLieu }

// ---------------------------------------------------------------------------
// Ngân sách gọi Gemini
// ---------------------------------------------------------------------------
// Chỉ những câu THẬT SỰ phải nhờ AI mới tính vào ngân sách này. Câu trả lời từ
// bộ đệm hay lọc nhanh không tốn hạn mức của Google nên không bị tính — nếu
// chặn cả những câu đó thì chính mình lại làm nghẽn demo thay cho Google.
//
// Hết ngân sách thì KHÔNG báo lỗi: câu hỏi đó rơi xuống lọc nhanh, khách vẫn
// nhận được sản phẩm, chỉ là lời văn cộc hơn.
const NGAN_SACH_MS = 5 * 60 * 1000;
const SO_LUOT_GEMINI = 8;

const luotGemini = new Map(); // ip -> number[] (mốc thời gian)

const conNganSach = (ip) => {
  const now = Date.now();
  const ganDay = (luotGemini.get(ip) ?? []).filter((luc) => now - luc < NGAN_SACH_MS);
  luotGemini.set(ip, ganDay);
  return ganDay.length < SO_LUOT_GEMINI;
};

const ghiNhanLuot = (ip) => {
  const ganDay = luotGemini.get(ip) ?? [];
  ganDay.push(Date.now());
  luotGemini.set(ip, ganDay);

  if (luotGemini.size > 500) {
    const now = Date.now();
    for (const [khoa, moc] of luotGemini) {
      if (moc.every((luc) => now - luc >= NGAN_SACH_MS)) luotGemini.delete(khoa);
    }
  }
};

const chuanHoaKhoa = (cauHoi) => cauHoi.trim().toLowerCase().replace(/\s+/g, ' ');

const docDem = (khoa) => {
  const muc = boNho.get(khoa);
  if (!muc) return null;

  if (Date.now() - muc.luc > HAN_MS) {
    boNho.delete(khoa);
    return null;
  }

  // Đưa lên cuối Map để mục hay dùng không bị dọn trước (kiểu LRU đơn giản)
  boNho.delete(khoa);
  boNho.set(khoa, muc);
  return muc.duLieu;
};

const ghiDem = (khoa, duLieu) => {
  if (boNho.size >= SO_MUC_TOI_DA) {
    // Map giữ nguyên thứ tự chèn nên phần tử đầu là mục lâu chưa dùng nhất
    const cuNhat = boNho.keys().next().value;
    boNho.delete(cuNhat);
  }
  boNho.set(khoa, { luc: Date.now(), duLieu });
};

// ---------------------------------------------------------------------------
// Xử lý chính
// ---------------------------------------------------------------------------

/**
 * @param {string} cauHoi
 * @param {Array}  lichSu  [{ role, text }]
 * @returns {{ reply: string, products: Array, nguon: string }}
 *          nguon: 'dem' | 'loc_nhanh' | 'gemini' | 'ha_cap' — chỉ để theo dõi,
 *          frontend không cần dùng tới.
 */
const traLoi = async (cauHoi, lichSu = [], { ip = 'chung' } = {}) => {
  const dungDemDuoc = lichSu.length === 0;
  const khoa = chuanHoaKhoa(cauHoi);

  // 1. Bộ nhớ đệm
  if (dungDemDuoc) {
    const sanCo = docDem(khoa);
    if (sanCo) return { ...sanCo, nguon: 'dem' };
  }

  // 2. Lọc nhanh — không tốn hạn mức API
  const yDinh = phanTichCauHoi(cauHoi);
  if (yDinh) {
    try {
      const ketQua = await traLoiKhongCanAI(yDinh);
      if (dungDemDuoc) ghiDem(khoa, ketQua);
      return { ...ketQua, nguon: 'loc_nhanh' };
    } catch (err) {
      // Lỗi Neo4j thì để Gemini thử — nó cũng tra cùng cơ sở dữ liệu nên nhiều
      // khả năng hỏng nốt, nhưng vẫn hơn là chết ngay tại đây.
      console.error('[Chat] Lọc nhanh lỗi, chuyển sang Gemini:', err.message);
    }
  }

  // 3. Gemini — chỉ khi còn ngân sách
  let loiGemini = null;

  if (conNganSach(ip)) {
    try {
      ghiNhanLuot(ip);
      const ketQua = await hoiGemini(cauHoi, lichSu);
      if (dungDemDuoc) ghiDem(khoa, ketQua);
      return { ...ketQua, nguon: 'gemini' };
    } catch (err) {
      loiGemini = err;
      console.warn(`[Chat] Gemini không dùng được (${err.status ?? '?'}): ${err.message}`);
    }
  } else {
    console.info('[Chat] Hết ngân sách Gemini của IP này — chuyển sang lọc nhanh.');
  }

  // 4. Hạ cấp — cố trả lời bằng lọc nhanh ở chế độ dễ dãi hơn
  const duPhong = yDinh ?? doanYDinhDuPhong(cauHoi);
  if (duPhong) {
    try {
      const ketQua = await traLoiKhongCanAI(duPhong);
      return { ...ketQua, nguon: 'ha_cap' };
    } catch (loiDb) {
      // Neo4j hỏng nốt thì đây là sự cố thật, phải báo đúng bản chất
      console.error('[Chat] Hạ cấp cũng lỗi:', loiDb.message);
      throw loiGemini ?? loiDb;
    }
  }

  // Câu ngoài phạm vi mua bán (hỏi thăm, tán gẫu) mà lại đúng lúc Gemini bận.
  // Đáp lịch sự và hướng khách về việc tìm hàng — hơn là hiện lỗi kỹ thuật.
  return {
    reply:
      'Mình chuyên giúp tìm sản phẩm trong cửa hàng thôi bạn nhé. ' +
      'Bạn cho mình biết tên món hàng hoặc khoảng giá đang cần nhé, ví dụ "nồi cơm điện dưới 500k".',
    products: [],
    nguon: 'ha_cap',
  };
};

/** Dọn đệm — dùng khi admin sửa sản phẩm để khách không thấy giá cũ. */
const xoaDem = () => boNho.clear();

module.exports = { traLoi, xoaDem };
