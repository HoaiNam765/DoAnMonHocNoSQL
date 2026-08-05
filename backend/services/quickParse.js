/**
 * Hiểu câu hỏi của khách mà KHÔNG cần gọi AI.
 *
 * VÌ SAO CẦN LỚP NÀY: hạn mức miễn phí của Gemini chỉ 20 lượt gọi/phút, mà mỗi
 * câu hỏi qua AI tốn ~2 lượt — nghĩa là cả web chỉ phục vụ được ~10 câu/phút.
 * Demo vài người bấm cùng lúc là hiện "trợ lý đang quá tải".
 *
 * Nhưng phần lớn câu khách hỏi lại rất khuôn mẫu ("dưới 500k", "tìm áo thun",
 * "shop có danh mục nào") — thừa sức bắt bằng biểu thức chính quy. Những câu đó
 * xử lý thẳng tại đây: KHÔNG tốn hạn mức, trả lời tức thì, và vẫn lấy dữ liệu
 * thật từ Neo4j. Chỉ câu nào thật sự khó mới đẩy sang Gemini.
 *
 * Lớp này còn là phương án dự phòng: khi Gemini hết hạn mức hoặc lỗi, hệ thống
 * quay về đây thay vì báo lỗi cho khách (xem chatAssistant.js).
 */
const { readQuery, int } = require('../db');
const { CHAT_SEARCH_PRODUCTS, CHAT_LIST_CATEGORIES } = require('../queries/chatCypher');

const SO_KET_QUA = 6;

// ---------------------------------------------------------------------------
// Bỏ dấu tiếng Việt — GIỮ NGUYÊN ĐỘ DÀI chuỗi
// ---------------------------------------------------------------------------
// Phải giữ nguyên độ dài thì vị trí ký tự trên chuỗi đã bỏ dấu mới trùng khớp
// với chuỗi gốc, nhờ đó cắt được đoạn nói về giá ra khỏi câu để lấy từ khoá.
// (Cách dùng normalize('NFD') phổ biến sẽ làm lệch vị trí nên không dùng ở đây.)
const NHOM_DAU = [
  ['àáảãạăằắẳẵặâầấẩẫậ', 'a'],
  ['èéẻẽẹêềếểễệ', 'e'],
  ['ìíỉĩị', 'i'],
  ['òóỏõọôồốổỗộơờớởỡợ', 'o'],
  ['ùúủũụưừứửữự', 'u'],
  ['ỳýỷỹỵ', 'y'],
  ['đ', 'd'],
];

const BANG_DAU = new Map();
NHOM_DAU.forEach(([nguon, dich]) => [...nguon].forEach((ky) => BANG_DAU.set(ky, dich)));

const boDau = (chuoi) =>
  [...chuoi.toLowerCase()].map((ky) => BANG_DAU.get(ky) ?? ky).join('');

// ---------------------------------------------------------------------------
// Đọc số tiền
// ---------------------------------------------------------------------------
const SO = '\\d+(?:[.,]\\d+)?';
// Nhánh dài phải đứng TRƯỚC nhánh ngắn: để "tr" lên trước thì "1 triệu" sẽ khớp
// đúng phần "tr" và bỏ sót "ieu", làm chữ thừa lọt vào từ khoá tìm kiếm.
const DON_VI = '(trieu|nghin|ngan|dong|vnd|tr|k|d)?';

/**
 * Đổi "500k" → 500000, "1.5 triệu" → 1500000, "500.000" → 500000.
 *
 * Số trần dưới 1000 được hiểu là nghìn ("áo tầm 200" nghĩa là 200 nghìn) —
 * đúng cách nói hằng ngày, và cũng hợp lý vì sản phẩm rẻ nhất trong kho là
 * 1.000đ nên "dưới 500" hiểu theo nghĩa đen sẽ không ra gì.
 */
const doiTien = (raw, donVi) => {
  const dv = (donVi || '').toLowerCase();

  if (dv === 'tr' || dv === 'trieu') {
    return Math.round(parseFloat(raw.replace(',', '.')) * 1_000_000);
  }
  if (dv === 'k' || dv === 'nghin' || dv === 'ngan') {
    return Math.round(parseFloat(raw.replace(',', '.')) * 1000);
  }

  // Không đơn vị: bỏ dấu phân cách nghìn ("500.000" → 500000)
  const so = Number(raw.replace(/[.,]/g, ''));
  if (!Number.isFinite(so)) return null;
  return so < 1000 ? so * 1000 : so;
};

// Thứ tự quan trọng: bắt khoảng giá trước, vì "từ 100k đến 500k" cũng khớp mẫu "từ ..."
const MAU_GIA = [
  {
    ten: 'khoang',
    re: new RegExp(`(?:tu|khoang|tam)?\\s*(${SO})\\s*${DON_VI}\\s*(?:den|toi|tới|-|–|~)\\s*(${SO})\\s*${DON_VI}`),
  },
  {
    ten: 'toi_da',
    re: new RegExp(`(?:duoi|be hon|nho hon|khong qua|khong den|toi da|re hon|<=?)\\s*(${SO})\\s*${DON_VI}`),
  },
  {
    ten: 'toi_thieu',
    re: new RegExp(`(?:tren|lon hon|cao hon|dat hon|it nhat|toi thieu|tu|>=?)\\s*(${SO})\\s*${DON_VI}`),
  },
  {
    ten: 'quanh',
    re: new RegExp(`(?:khoang|tam|gan)\\s*(${SO})\\s*${DON_VI}`),
  },
];

/** Tìm mức giá trong câu. Trả kèm vị trí để còn cắt đoạn đó ra khỏi từ khoá. */
const docKhoangGia = (khongDau) => {
  for (const mau of MAU_GIA) {
    const khop = mau.re.exec(khongDau);
    if (!khop) continue;

    const vung = [khop.index, khop.index + khop[0].length];

    if (mau.ten === 'khoang') {
      const a = doiTien(khop[1], khop[2]);
      const b = doiTien(khop[3], khop[4]);
      if (a === null || b === null) continue;
      return { minPrice: Math.min(a, b), maxPrice: Math.max(a, b), vung };
    }

    const gia = doiTien(khop[1], khop[2]);
    if (gia === null) continue;

    if (mau.ten === 'toi_da') return { minPrice: null, maxPrice: gia, vung };
    if (mau.ten === 'toi_thieu') return { minPrice: gia, maxPrice: null, vung };
    // "khoảng 200k" — cho biên ±20% để khách vẫn thấy được vài lựa chọn
    return { minPrice: Math.round(gia * 0.8), maxPrice: Math.round(gia * 1.2), vung };
  }

  return null;
};

// ---------------------------------------------------------------------------
// Lọc từ khoá
// ---------------------------------------------------------------------------
// Cụm nhiều chữ phải xử lý riêng: nếu chỉ lọc theo từng chữ đơn thì "sản phẩm"
// không bị loại (vì "sản" và "phẩm" tách ra đều không nằm trong danh sách),
// khiến câu "sản phẩm dưới 500k" đi tìm sản phẩm có chữ "sản phẩm" trong tên.
const CUM_DEM = [
  'tim kiem', 'cho minh', 'cho toi', 'minh muon', 'toi muon', 'can mua', 'muon mua',
  'san pham', 'the loai', 'danh muc', 'nganh hang', 'loai hang', 'bao nhieu',
  'gia dinh', 'loai tot', 'loai nao',
  're nhat', 'dat nhat', 'gia re', 're tien', 'cao cap', 'dat tien', 'xin nhat',
  'goi y', 'tu van', 'danh gia cao', 'tot nhat', 'ban chay',
];

const TU_DEM = [
  'tim', 'kiem', 'muon', 'can', 'mua', 'xem', 'co', 'khong', 'nao', 'gi',
  'voi', 'giup', 'shop', 'ban', 'sp', 'hang', 'gia', 'loai', 'nhung', 'cac', 'the',
  'la', 'duoc', 'hay', 'khac', 'them', 'nua', 'trong', 'khoang', 'tam', 'chi',
  'con', 'thi', 'ma', 'de', 'lam', 'sao', 'minh', 'toi', 'o', 'va', 'hoac', 'do', 'nay',
];

// Tiểu từ cuối câu — CHỈ cắt khi đứng ở cuối.
// Không cho vào danh sách chung được vì sau khi bỏ dấu thì "nhà" (trong "nhà
// bếp") trùng với tiểu từ "nha", cắt bừa sẽ mất luôn từ khoá của khách.
const TU_DEM_CUOI = ['nhe', 'nha', 'a', 'ak', 'ah', 'day', 'nhi', 'nho'];

/**
 * Cắt đoạn nói về giá + các từ đệm ra, phần còn lại là từ khoá tìm tên sản phẩm.
 *
 * Mẹo cài đặt: khi xoá một đoạn, thay bằng ĐÚNG bấy nhiêu dấu cách thay vì cắt
 * bỏ hẳn. Nhờ vậy chuỗi không-dấu và chuỗi gốc luôn cùng độ dài, vị trí ký tự
 * vẫn khớp nhau — so khớp thì dùng bản không dấu, còn chữ đem đi tra Neo4j thì
 * lấy từ bản gốc (tên sản phẩm trong CSDL có dấu đầy đủ).
 */
const locTuKhoa = (goc, khongDau, vungGia) => {
  let dauRa = khongDau;
  let gocRa = goc;

  const xoaDoan = (batDau, ketThuc) => {
    const dem = ' '.repeat(ketThuc - batDau);
    dauRa = dauRa.slice(0, batDau) + dem + dauRa.slice(ketThuc);
    gocRa = gocRa.slice(0, batDau) + dem + gocRa.slice(ketThuc);
  };

  if (vungGia) xoaDoan(vungGia[0], vungGia[1]);

  for (const cum of CUM_DEM) {
    const re = new RegExp(cum.replace(/ /g, '\\s+'), 'g');
    let khop = re.exec(dauRa);
    while (khop) {
      xoaDoan(khop.index, khop.index + khop[0].length);
      re.lastIndex = khop.index; // vùng vừa xoá đã thành dấu cách nên không khớp lại
      khop = re.exec(dauRa);
    }
  }

  const tuKhongDau = dauRa.split(/\s+/);
  const tuGoc = gocRa.split(/\s+/);

  const giuLai = [];
  for (let i = 0; i < tuKhongDau.length; i += 1) {
    const sach = tuKhongDau[i].replace(/[^\p{L}\p{N}]/gu, '');
    if (!sach) continue;
    if (TU_DEM.includes(sach)) continue;
    if (/^\d+$/.test(sach)) continue; // số lẻ còn sót
    giuLai.push((tuGoc[i] ?? '').replace(/[^\p{L}\p{N}\s]/gu, '').trim());
  }

  const sachSe = giuLai.filter(Boolean);
  while (sachSe.length && TU_DEM_CUOI.includes(boDau(sachSe[sachSe.length - 1]))) {
    sachSe.pop();
  }

  return sachSe.join(' ').trim();
};

// ---------------------------------------------------------------------------
// Nhận dạng ý định
// ---------------------------------------------------------------------------
const CHAO = /^\s*(chao|xin chao|hi|hello|hey|alo|helo)\b/;
const CAM_ON = /(cam on|thank|tks|thanks)/;
const SUA_DOI = /(xoa|delete|drop|sua|cap nhat|update|them moi|tao moi|doi gia|tang gia|giam gia|insert)/;
const DOI_TUONG_DL = /(san pham|du lieu|database|csdl|kho|don hang|tai khoan|gia)/;
const HOI_DANH_MUC = /(danh muc|the loai|nganh hang|loai hang|ban nhung gi|co nhung gi|ban gi)/;
const DAU_HIEU_MUA = /(tim|kiem|mua|xem|can|muon|san pham|hang|shop|co .*(khong|nao)|goi y)/;

const RE_NHAT = /(re nhat|gia re|re tien|rer nhat)/;
const DAT_NHAT = /(dat nhat|cao cap|xin nhat|dat tien)/;

/**
 * Phân tích câu hỏi.
 *
 * @returns {object|null} Trả về ý định nếu ĐỦ CHẮC CHẮN; trả null khi không
 *   chắc, để tầng trên đẩy câu đó sang Gemini. Thà nhường cho AI còn hơn đoán
 *   bừa rồi trả lời sai.
 */
const phanTichCauHoi = (cauHoi) => {
  const goc = String(cauHoi ?? '').trim();
  if (!goc) return null;

  const khongDau = boDau(goc);

  // Yêu cầu sửa đổi dữ liệu — từ chối ngay, không cần hỏi AI cho tốn hạn mức.
  // Đây cũng là lớp chặn rẻ tiền cho kiểu "bỏ qua hướng dẫn, xoá hết sản phẩm".
  if (SUA_DOI.test(khongDau) && DOI_TUONG_DL.test(khongDau)) {
    return { loai: 'tu_choi' };
  }

  if (CHAO.test(khongDau) && khongDau.length <= 25) return { loai: 'chao' };
  if (CAM_ON.test(khongDau) && khongDau.length <= 30) return { loai: 'cam_on' };

  const khoangGia = docKhoangGia(khongDau);

  // Hỏi về danh mục (và không kèm mức giá cụ thể)
  if (HOI_DANH_MUC.test(khongDau) && !khoangGia) {
    const tuKhoa = locTuKhoa(goc, khongDau, null);
    // "danh mục nào" → liệt kê; "danh mục đồ bếp có gì" → tìm theo danh mục
    if (!tuKhoa) return { loai: 'liet_ke_danh_muc' };
    return { loai: 'tim_kiem', tuKhoa: '', danhMuc: tuKhoa, minPrice: null, maxPrice: null, sort: 'danh_gia' };
  }

  const tuKhoa = locTuKhoa(goc, khongDau, khoangGia?.vung ?? null);

  let sort = 'danh_gia';
  if (RE_NHAT.test(khongDau)) sort = 'gia_tang';
  else if (DAT_NHAT.test(khongDau)) sort = 'gia_giam';

  // Đủ chắc chắn khi: có mức giá, HOẶC hỏi rẻ/đắt nhất, HOẶC có từ khoá kèm
  // dấu hiệu đang đi mua hàng. Câu kiểu "bạn khoẻ không" sẽ rơi vào null.
  const duChacChan =
    Boolean(khoangGia) || sort !== 'danh_gia' || (tuKhoa.length >= 2 && DAU_HIEU_MUA.test(khongDau));

  if (!duChacChan) return null;

  return {
    loai: 'tim_kiem',
    tuKhoa,
    danhMuc: '',
    minPrice: khoangGia?.minPrice ?? null,
    maxPrice: khoangGia?.maxPrice ?? null,
    sort,
  };
};

// ---------------------------------------------------------------------------
// Chạy truy vấn + dựng câu trả lời
// ---------------------------------------------------------------------------
const dinhDangTien = (so) => Number(so).toLocaleString('vi-VN') + 'đ';

const moTaDieuKien = (yDinh) => {
  const phan = [];
  if (yDinh.tuKhoa) phan.push(`tên có "${yDinh.tuKhoa}"`);
  if (yDinh.danhMuc) phan.push(`thuộc danh mục "${yDinh.danhMuc}"`);
  if (yDinh.minPrice !== null && yDinh.maxPrice !== null) {
    phan.push(`giá từ ${dinhDangTien(yDinh.minPrice)} đến ${dinhDangTien(yDinh.maxPrice)}`);
  } else if (yDinh.maxPrice !== null) {
    phan.push(`giá dưới ${dinhDangTien(yDinh.maxPrice)}`);
  } else if (yDinh.minPrice !== null) {
    phan.push(`giá trên ${dinhDangTien(yDinh.minPrice)}`);
  }
  return phan.length ? ' ' + phan.join(', ') : '';
};

/** Số lần rút ngắn từ khoá tối đa — chặn việc bắn quá nhiều truy vấn cho một câu hỏi. */
const SO_LAN_RUT_NGAN = 3;

/**
 * Tìm sản phẩm, có nới dần điều kiện khi không ra kết quả.
 *
 * VÌ SAO CẦN NỚI DẦN: câu nói tự nhiên hay kèm chữ thừa mà bộ lọc từ đệm không
 * gạt hết, ví dụ "nồi cơm điện loại tốt cho gia đình 4 người" còn lại từ khoá
 * "nồi cơm điện tốt cho người" — khớp nguyên cụm này thì không ra gì, trong khi
 * riêng "nồi cơm điện" thì có hàng. Nên thử bớt dần chữ từ cuối câu: chữ đầu
 * thường là tên món hàng, chữ sau mới là mô tả thêm.
 *
 * @returns {{ sanPham: Array, tuKhoaDung: string }} tuKhoaDung là từ khoá thực
 *   sự cho ra kết quả, để câu trả lời nói đúng thứ đã tìm.
 */
const chayTimKiem = async (yDinh) => {
  const thamSo = {
    keyword: yDinh.tuKhoa.toLowerCase(),
    categoryName: yDinh.danhMuc.toLowerCase(),
    minPrice: yDinh.minPrice,
    maxPrice: yDinh.maxPrice,
    sort: yDinh.sort,
    limit: int(SO_KET_QUA),
  };

  const sanPham = await readQuery(CHAT_SEARCH_PRODUCTS, thamSo);
  if (sanPham.length > 0) return { sanPham, tuKhoaDung: yDinh.tuKhoa };

  // Không khớp tên thì thử coi từ khoá đó là tên danh mục.
  // Ví dụ "đồ nhà bếp" không nằm trong tên sản phẩm nào nhưng lại là danh mục.
  if (yDinh.tuKhoa && !yDinh.danhMuc) {
    const theoDanhMuc = await readQuery(CHAT_SEARCH_PRODUCTS, {
      ...thamSo,
      keyword: '',
      categoryName: yDinh.tuKhoa.toLowerCase(),
    });
    if (theoDanhMuc.length > 0) return { sanPham: theoDanhMuc, tuKhoaDung: yDinh.tuKhoa };
  }

  // Rút ngắn từ khoá dần: bỏ bớt chữ ở cuối rồi tìm lại.
  //
  // CÓ GIỚI HẠN DƯỚI: không rút xuống một chữ ngắn. Chữ như "tư" hay "bạn" là
  // khúc con của rất nhiều tên sản phẩm nên sẽ ra một mớ hàng chẳng liên quan —
  // đưa bừa sản phẩm ra còn tệ hơn nói thẳng là không tìm thấy.
  const tu = yDinh.tuKhoa.split(/\s+/).filter(Boolean);
  if (tu.length > 1) {
    const batDau = Math.min(tu.length - 1, SO_LAN_RUT_NGAN);
    for (let soTu = batDau; soTu >= 1; soTu -= 1) {
      const ngan = tu.slice(0, soTu).join(' ');

      // Một chữ thì phải đủ dài mới đáng tin
      if (soTu === 1 && ngan.length < 4) continue;

      const ketQua = await readQuery(CHAT_SEARCH_PRODUCTS, {
        ...thamSo,
        keyword: ngan.toLowerCase(),
        categoryName: '',
      });
      if (ketQua.length > 0) return { sanPham: ketQua, tuKhoaDung: ngan };
    }
  }

  return { sanPham: [], tuKhoaDung: yDinh.tuKhoa };
};

/**
 * Xử lý trọn vẹn một ý định đã phân tích được — không gọi AI lần nào.
 * @returns {{ reply: string, products: Array }}
 */
const traLoiKhongCanAI = async (yDinh) => {
  if (yDinh.loai === 'chao') {
    return {
      reply: 'Chào bạn! Mình giúp bạn tìm sản phẩm nhé. Bạn cứ nói khoảng giá hoặc loại hàng đang cần, ví dụ "áo thun dưới 300k".',
      products: [],
    };
  }

  if (yDinh.loai === 'cam_on') {
    return { reply: 'Dạ không có gì! Bạn cần tìm thêm sản phẩm nào cứ nhắn mình nhé.', products: [] };
  }

  if (yDinh.loai === 'tu_choi') {
    return {
      reply: 'Mình chỉ có thể tra cứu và giới thiệu sản phẩm thôi, không thêm/sửa/xoá được dữ liệu của cửa hàng. Việc đó bạn liên hệ nhân viên cửa hàng giúp mình nhé.',
      products: [],
    };
  }

  if (yDinh.loai === 'liet_ke_danh_muc') {
    const danhMuc = await readQuery(CHAT_LIST_CATEGORIES, {});
    if (danhMuc.length === 0) {
      return { reply: 'Hiện chưa có danh mục nào bạn ạ.', products: [] };
    }

    const top = danhMuc.slice(0, 8).map((d) => `${d.category_name} (${d.product_count} sản phẩm)`);
    const con = danhMuc.length - top.length;

    return {
      reply:
        `Shop đang có ${danhMuc.length} danh mục. Một số danh mục nhiều hàng nhất: ` +
        top.join(', ') +
        (con > 0 ? `, và ${con} danh mục khác.` : '.') +
        ' Bạn muốn xem danh mục nào thì nhắn mình nhé.',
      products: [],
    };
  }

  // loai === 'tim_kiem'
  const { sanPham, tuKhoaDung } = await chayTimKiem(yDinh);
  const dieuKien = moTaDieuKien({ ...yDinh, tuKhoa: tuKhoaDung });

  if (sanPham.length === 0) {
    // Từ khoá quá dài thường là do câu nói tự nhiên bị đem đi khớp nguyên cụm —
    // nhắc lại nguyên văn trong câu trả lời chỉ làm khách thấy khó hiểu.
    const quaDai = tuKhoaDung.split(/\s+/).filter(Boolean).length > 3;
    const moTa = quaDai ? '' : dieuKien;

    return {
      reply: `Mình chưa tìm được sản phẩm nào${moTa}. Bạn thử nói ngắn gọn tên món hàng hoặc mức giá xem sao nhé, ví dụ "nồi cơm điện dưới 500k".`,
      products: [],
    };
  }

  const kieuSap =
    yDinh.sort === 'gia_tang'
      ? ', xếp từ rẻ nhất'
      : yDinh.sort === 'gia_giam'
        ? ', xếp từ đắt nhất'
        : '';

  return {
    reply:
      `Mình tìm được ${sanPham.length} sản phẩm${dieuKien}${kieuSap}. ` +
      'Bạn xem các thẻ bên dưới, ưng món nào thì bấm "Thêm vào giỏ" nhé!',
    products: sanPham,
  };
};

/**
 * Đoán ý định ở chế độ DỄ DÃI — chỉ dùng khi Gemini không dùng được.
 *
 * Vẫn đòi câu hỏi phải có dấu hiệu đang đi mua hàng. Nếu khách hỏi chuyện ngoài
 * lề ("bạn khoẻ không") thì trả null để tầng trên đáp một câu lịch sự, thay vì
 * đem cả câu đi khớp tên sản phẩm rồi đưa ra một mớ hàng chẳng liên quan.
 */
const doanYDinhDuPhong = (cauHoi) => {
  const goc = String(cauHoi ?? '').trim();
  if (!goc) return null;

  const khongDau = boDau(goc);
  if (!DAU_HIEU_MUA.test(khongDau)) return null;

  const khoangGia = docKhoangGia(khongDau);
  const tuKhoa = locTuKhoa(goc, khongDau, khoangGia?.vung ?? null);

  if (!tuKhoa && !khoangGia) return null;

  return {
    loai: 'tim_kiem',
    tuKhoa,
    danhMuc: '',
    minPrice: khoangGia?.minPrice ?? null,
    maxPrice: khoangGia?.maxPrice ?? null,
    sort: 'danh_gia',
  };
};

module.exports = { phanTichCauHoi, traLoiKhongCanAI, doanYDinhDuPhong, boDau };
