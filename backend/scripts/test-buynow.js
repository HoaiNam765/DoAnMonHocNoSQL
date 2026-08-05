/**
 * Kiểm chứng nghiệp vụ "Mua ngay" theo đúng tình huống khách mô tả:
 *
 *   Khách bấm mua ngay sản phẩm A → đổi ý, bỏ ngang → bấm mua ngay sản phẩm B
 *   → trang thanh toán chỉ được có B, không có A, và không lẫn hàng trong giỏ.
 *
 * Yêu cầu: server đang chạy.
 * Chạy: npm run test:buynow
 */
require('dotenv').config();
const admin = require('../firebase');
const { driver, closeDriver } = require('../db');

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const TEST_UID = 'test-buynow-user';

let dat = 0, hong = 0;
const check = (ten, ok, chiTiet = '') => {
  if (ok) { dat++; console.log(`  DAT  ${ten}`); }
  else { hong++; console.log(`  HONG ${ten}${chiTiet ? ' -- ' + chiTiet : ''}`); }
};

const getAuth = () => (typeof admin.auth === 'function' ? admin.auth() : require('firebase-admin/auth').getAuth());

const getIdToken = async (uid) => {
  const customToken = await getAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
  );
  const body = await res.json();
  if (!body.idToken) throw new Error(`Khong lay duoc idToken: ${JSON.stringify(body)}`);
  return body.idToken;
};

const api = (token) => async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* có thể không có body */ }
  return { status: res.status, body: json };
};

const THONG_TIN = { receiverName: 'Nguoi Nhan Test', phone: '0901234567', address: 'So 1 Duong Test' };

(async () => {
  const token = await getIdToken(TEST_UID);
  const call = api(token);

  await call('POST', '/api/auth/sync');
  const customerId = `U_${TEST_UID}`;

  // Dọn dữ liệu cũ của tài khoản test
  const s = driver.session();
  await s.run(`MATCH (c:Customer {customer_id:$id})-[r:IN_CART]->() DELETE r`, { id: customerId });
  await s.run(`MATCH (c:Customer {customer_id:$id})-[:PLACED]->(o:Order) DETACH DELETE o`, { id: customerId });

  // Lấy 3 sản phẩm còn hàng để thử
  const sp = await s.run(`MATCH (p:Product) WHERE coalesce(p.stock,0) >= 3 RETURN p.id AS id, p.title AS title LIMIT 3`);
  const [A, B, C] = sp.records.map((r) => r.toObject());
  console.log(`San pham dung de thu:\n  A = ${A.title.slice(0,40)}\n  B = ${B.title.slice(0,40)}\n  C = ${C.title.slice(0,40)}\n`);

  // ------------------------------------------------------------------
  console.log('--- 1. Bo ngang giua chung thi KHONG luu vao gio ---');
  // "Bấm mua ngay A rồi thoát" = phía web chỉ điều hướng, không gọi API nào.
  // Kiểm chứng: giỏ vẫn rỗng.
  let gio = await call('GET', '/api/cart');
  check('Gio hang van rong sau khi bam mua ngay A roi thoat', gio.body?.data?.items?.length === 0,
        `co ${gio.body?.data?.items?.length} mon`);

  // ------------------------------------------------------------------
  console.log('\n--- 2. Mua ngay B: don chi gom dung B ---');
  const donB = await call('POST', '/api/orders/buy-now', { productId: B.id, quantity: 2, ...THONG_TIN });
  check('Tao don mua ngay B thanh cong', donB.status === 201, `status ${donB.status} ${JSON.stringify(donB.body)}`);

  const ctB = await call('GET', `/api/orders/${donB.body?.data?.order_id}`);
  const itemsB = ctB.body?.data?.items ?? [];
  check('Don chi co DUNG 1 dong hang', itemsB.length === 1, `co ${itemsB.length} dong`);
  check('Dong hang do dung la san pham B', itemsB[0]?.id === B.id, `nhan ${itemsB[0]?.id}`);
  check('So luong dung = 2', Number(itemsB[0]?.quantity) === 2, `nhan ${itemsB[0]?.quantity}`);

  // ------------------------------------------------------------------
  console.log('\n--- 3. Mua ngay KHONG lam ban gio hang ---');
  gio = await call('GET', '/api/cart');
  check('Gio van rong sau khi mua ngay B', gio.body?.data?.items?.length === 0,
        `co ${gio.body?.data?.items?.length} mon`);

  // ------------------------------------------------------------------
  console.log('\n--- 4. Co hang san trong gio: mua ngay KHONG duoc lan hang do ---');
  await call('POST', '/api/cart/items', { productId: C.id, quantity: 1 });
  gio = await call('GET', '/api/cart');
  check('Da bo C vao gio', gio.body?.data?.items?.length === 1, `co ${gio.body?.data?.items?.length} mon`);

  const donA = await call('POST', '/api/orders/buy-now', { productId: A.id, quantity: 1, ...THONG_TIN });
  const ctA = await call('GET', `/api/orders/${donA.body?.data?.order_id}`);
  const itemsA = ctA.body?.data?.items ?? [];
  check('Don mua ngay A chi co 1 dong hang', itemsA.length === 1, `co ${itemsA.length} dong`);
  check('Khong lan san pham C dang trong gio', !itemsA.some((i) => i.id === C.id));
  check('Dong hang la A', itemsA[0]?.id === A.id, `nhan ${itemsA[0]?.id}`);

  gio = await call('GET', '/api/cart');
  check('Gio VAN CON C (mua ngay khong dong toi gio)', gio.body?.data?.items?.length === 1,
        `con ${gio.body?.data?.items?.length} mon`);

  // ------------------------------------------------------------------
  console.log('\n--- 5. Kiem tra dau vao ---');
  const thieu = await call('POST', '/api/orders/buy-now', { productId: A.id, quantity: 1 });
  check('Thieu thong tin nguoi nhan -> 400', thieu.status === 400, `nhan ${thieu.status}`);

  const khongCo = await call('POST', '/api/orders/buy-now', { productId: 'khong-ton-tai-xyz', quantity: 1, ...THONG_TIN });
  check('San pham khong ton tai -> 404', khongCo.status === 404, `nhan ${khongCo.status}`);

  const ngoaiKhoang = await call('POST', '/api/orders/buy-now', { productId: A.id, quantity: 99999, ...THONG_TIN });
  check('So luong ngoai khoang cho phep -> 400', ngoaiKhoang.status === 400, `nhan ${ngoaiKhoang.status}`);

  const soLe = await call('POST', '/api/orders/buy-now', { productId: A.id, quantity: 'nhieu', ...THONG_TIN });
  check('So luong khong phai so -> 400', soLe.status === 400, `nhan ${soLe.status}`);

  // Mua vượt tồn kho: dựng tạm tình huống kho thấp rồi trả lại nguyên trạng.
  // Tự dựng thay vì đi tìm sản phẩm kho sẵn thấp, để phép kiểm này luôn chạy
  // dù dữ liệu tồn kho có thay đổi thế nào.
  const khoGoc = (await s.run(`MATCH (p:Product {id:$id}) RETURN coalesce(p.stock,0) AS stock`, { id: A.id }))
    .records[0].get('stock');
  try {
    await s.run(`MATCH (p:Product {id:$id}) SET p.stock = 2`, { id: A.id });
    const vuotKho = await call('POST', '/api/orders/buy-now', { productId: A.id, quantity: 3, ...THONG_TIN });
    check('Mua 3 khi kho chi con 2 -> 409', vuotKho.status === 409, `nhan ${vuotKho.status}`);

    const vuaDu = await call('POST', '/api/orders/buy-now', { productId: A.id, quantity: 2, ...THONG_TIN });
    check('Mua dung 2 khi kho con 2 -> 201', vuaDu.status === 201, `nhan ${vuaDu.status}`);
  } finally {
    // Luôn trả lại tồn kho ban đầu, kể cả khi phép kiểm phía trên ném lỗi
    await s.run(`MATCH (p:Product {id:$id}) SET p.stock = $stock`, { id: A.id, stock: Number(khoGoc) });
    const khoSau = (await s.run(`MATCH (p:Product {id:$id}) RETURN coalesce(p.stock,0) AS stock`, { id: A.id }))
      .records[0].get('stock');
    check('Da tra lai ton kho ban dau', Number(khoSau) === Number(khoGoc), `goc ${khoGoc}, hien ${khoSau}`);
  }

  const khongToken = await api(null)('POST', '/api/orders/buy-now', { productId: A.id, quantity: 1, ...THONG_TIN });
  check('Khong co token -> 401', khongToken.status === 401, `nhan ${khongToken.status}`);

  // Dọn dẹp
  await s.run(`MATCH (c:Customer {customer_id:$id})-[r:IN_CART]->() DELETE r`, { id: customerId });
  await s.run(`MATCH (c:Customer {customer_id:$id})-[:PLACED]->(o:Order) DETACH DELETE o`, { id: customerId });
  await s.close();
  await closeDriver();

  console.log(`\n=====================================`);
  console.log(`DAT: ${dat} | HONG: ${hong}`);
  process.exit(hong > 0 ? 1 : 0);
})().catch((e) => { console.error('LOI:', e.message); process.exit(1); });
