const crypto = require('crypto');

/**
 * Đẩy sự kiện đơn hàng từ máy chủ xuống trình duyệt theo thời gian thực.
 *
 * VÌ SAO CHỌN SSE (Server-Sent Events) chứ không phải WebSocket hay hỏi lặp:
 *
 * - Hỏi lặp (polling): đơn giản nhưng luôn trễ vài giây, và cứ vài giây lại một
 *   lượt truy vấn Neo4j cho MỖI người đang mở trang — lãng phí khi phần lớn
 *   thời gian chẳng có gì thay đổi.
 * - WebSocket: mạnh nhưng hai chiều, phải thêm thư viện và tự lo kết nối lại.
 * - SSE: đúng nhu cầu ở đây vì luồng dữ liệu chỉ đi MỘT CHIỀU (máy chủ báo cho
 *   trình duyệt). Chạy trên HTTP thường, trình duyệt có sẵn EventSource và tự
 *   động kết nối lại khi rớt mạng, không cần cài thêm gì.
 *
 * DỮ LIỆU GỬI ĐI CỐ Ý RẤT ÍT: chỉ báo "có đơn vừa đổi", kèm mã đơn và trạng
 * thái. Trình duyệt nhận tín hiệu rồi tự gọi lại API có xác thực để lấy dữ liệu
 * đầy đủ. Nhờ vậy luồng sự kiện không mang thông tin cá nhân nào.
 */

// ---------------------------------------------------------------------------
// Vé vào luồng sự kiện
// ---------------------------------------------------------------------------
// EventSource của trình duyệt KHÔNG cho đặt header, nên không gửi kèm được
// "Authorization: Bearer ...". Cách hay gặp là nhét token vào query string,
// nhưng token khi đó sẽ nằm trong log truy cập của máy chủ và trong lịch sử
// trình duyệt.
//
// Thay vào đó: khách gọi một endpoint có xác thực để xin "vé" — một chuỗi ngẫu
// nhiên dùng MỘT LẦN, sống 60 giây — rồi mới mở luồng bằng vé đó. Vé lộ ra
// ngoài cũng gần như vô hại vì hết hạn ngay và đã bị tiêu huỷ khi dùng.
const VE_SONG_MS = 60 * 1000;
const khoVe = new Map(); // ve -> { customerId, laAdmin, hetHan }

const capVe = ({ customerId, laAdmin }) => {
  const ve = crypto.randomBytes(24).toString('hex');
  khoVe.set(ve, { customerId, laAdmin, hetHan: Date.now() + VE_SONG_MS });

  // Dọn vé quá hạn để Map không phình mãi
  if (khoVe.size > 200) {
    const bayGio = Date.now();
    for (const [khoa, muc] of khoVe) {
      if (muc.hetHan <= bayGio) khoVe.delete(khoa);
    }
  }

  return ve;
};

/** Đổi vé lấy thông tin chủ vé. Dùng xong là huỷ, không dùng lại được. */
const dungVe = (ve) => {
  const muc = khoVe.get(String(ve ?? ''));
  if (!muc) return null;

  khoVe.delete(ve);
  if (muc.hetHan <= Date.now()) return null;

  return muc;
};

// ---------------------------------------------------------------------------
// Danh sách kết nối đang mở
// ---------------------------------------------------------------------------
let idKeTiep = 1;
const dangKetNoi = new Map(); // id -> { res, customerId, laAdmin }

let dongHoNhip = null;

/**
 * Cứ 25 giây gửi một dòng chú thích rỗng để giữ kết nối.
 * Không có nó, proxy hoặc chính trình duyệt có thể cắt kết nối vì tưởng đã chết.
 */
const batDauNhip = () => {
  if (dongHoNhip) return;

  dongHoNhip = setInterval(() => {
    for (const khach of dangKetNoi.values()) {
      try {
        khach.res.write(': nhip\n\n');
      } catch {
        /* kết nối hỏng sẽ được dọn ở sự kiện close */
      }
    }
  }, 25000);

  // Không giữ tiến trình Node sống chỉ vì cái đồng hồ này
  dongHoNhip.unref?.();
};

const dungNhipNeuVang = () => {
  if (dangKetNoi.size === 0 && dongHoNhip) {
    clearInterval(dongHoNhip);
    dongHoNhip = null;
  }
};

const themKetNoi = (res, { customerId, laAdmin }) => {
  const id = idKeTiep++;
  dangKetNoi.set(id, { res, customerId, laAdmin });
  batDauNhip();
  return id;
};

const boKetNoi = (id) => {
  dangKetNoi.delete(id);
  dungNhipNeuVang();
};

const guiCho = (khach, loai, duLieu) => {
  try {
    khach.res.write(`event: ${loai}\ndata: ${JSON.stringify(duLieu)}\n\n`);
  } catch (err) {
    console.error('[Events] Không gửi được sự kiện:', err.message);
  }
};

/**
 * Báo "có đơn hàng vừa thay đổi".
 *
 * Gửi cho TẤT CẢ admin đang mở trang quản trị, và gửi riêng cho đúng chủ đơn.
 * Không gửi cho khách khác — họ không liên quan gì tới đơn này.
 *
 * @param {object} p
 * @param {string} p.customerId chủ đơn
 * @param {string} p.orderId    mã đơn
 * @param {string} p.status     trạng thái mới
 * @param {string} p.hanhDong   'tao' | 'huy' | 'thanh_toan' | 'doi_trang_thai'
 */
const thongBaoDonThayDoi = ({ customerId, orderId, status, hanhDong }) => {
  const duLieu = { orderId, status, hanhDong, luc: new Date().toISOString() };

  for (const khach of dangKetNoi.values()) {
    if (khach.laAdmin) {
      guiCho(khach, 'orders_changed', duLieu);
    } else if (khach.customerId && khach.customerId === customerId) {
      guiCho(khach, 'my_orders_changed', duLieu);
    }
  }
};

/** Số kết nối đang mở — phục vụ kiểm thử và theo dõi. */
const soKetNoi = () => dangKetNoi.size;

module.exports = { capVe, dungVe, themKetNoi, boKetNoi, thongBaoDonThayDoi, soKetNoi };
