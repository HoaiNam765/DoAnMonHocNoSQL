/**
 * Kiểm thử tìm kiếm đơn hàng phía quản trị: theo mã đơn, họ tên, số điện thoại
 * và khoảng ngày đặt.
 *
 * Yêu cầu: server đang chạy.
 * Chạy: npm run test:search
 */
const admin = require('../firebase');
const { driver, closeDriver } = require('../db');

const BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 5000}`;
const WEB_KEY = process.env.FIREBASE_WEB_API_KEY;
const UID = 'test-order-search';
const CID = `U_${UID}`;

let passed = 0;
let failed = 0;

const check = (name, ok, detail = '') => {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const getAuth = () =>
  typeof admin.auth === 'function' ? admin.auth() : require('firebase-admin/auth').getAuth();

const idTokenFor = async (uid) => {
  const customToken = await getAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const body = await res.json();
  if (!body.idToken) throw new Error(`Không lấy được idToken: ${JSON.stringify(body)}`);
  return body.idToken;
};

const api = (token) => async (method, path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* body rỗng */
  }
  return { status: res.status, body: json };
};

const cleanup = async () => {
  const s = driver.session();
  try {
    await s.run(
      `MATCH (c:Customer {customer_id: $id})
       OPTIONAL MATCH (c)-[:PLACED]->(o:Order)
       DETACH DELETE o
       WITH c DETACH DELETE c`,
      { id: CID }
    );
  } finally {
    await s.close();
  }
};

(async () => {
  if (!WEB_KEY) {
    console.error('❌ Thiếu FIREBASE_WEB_API_KEY trong backend/.env');
    process.exit(1);
  }

  console.log(`Kiểm thử tìm kiếm đơn hàng tại ${BASE}\n`);

  try {
    await getAuth().updateUser(UID, { email: 'ots@example.com', displayName: 'Nguyễn Văn Tìm' });
  } catch {
    await getAuth().createUser({ uid: UID, email: 'ots@example.com', displayName: 'Nguyễn Văn Tìm' });
  }
  await cleanup();

  const call = api(await idTokenFor(UID));
  await call('POST', '/api/auth/sync');

  const s = driver.session();
  await s.run(`MATCH (c:Customer {customer_id: $id}) SET c.role = 'admin'`, { id: CID });
  await s.close();
  const adminCall = api(await idTokenFor(UID));

  // --- Tạo 2 đơn với thông tin khác nhau ---
  console.log('[Chuẩn bị] Tạo 2 đơn hàng');
  const products = (await call('GET', '/api/products?limit=2')).body.data;

  await call('POST', '/api/cart/items', { productId: products[0].id, quantity: 1 });
  const o1 = (
    await call('POST', '/api/orders', {
      receiverName: 'Trần Thị Bích Ngọc',
      phone: '0912345678',
      address: 'Số 1 Lê Lợi',
    })
  ).body.data;

  await call('POST', '/api/cart/items', { productId: products[1].id, quantity: 1 });
  const o2 = (
    await call('POST', '/api/orders', {
      receiverName: 'Lê Hoàng Nam',
      phone: '0987654321',
      address: 'Số 2 Trần Hưng Đạo',
    })
  ).body.data;

  check('tạo được 2 đơn', Boolean(o1?.order_id && o2?.order_id));

  const idsOf = (r) => (r.body?.data ?? []).map((o) => o.order_id);

  // --- Tìm theo mã đơn ---
  console.log('\n[Tìm theo mã đơn]');
  let r = await adminCall('GET', `/api/admin/orders?status=&search=${o1.order_id}`);
  check('khớp đúng 1 đơn', idsOf(r).length === 1 && idsOf(r)[0] === o1.order_id, JSON.stringify(idsOf(r)));

  r = await adminCall('GET', `/api/admin/orders?status=&search=${o1.order_id.toLowerCase()}`);
  check('không phân biệt hoa thường', idsOf(r).includes(o1.order_id), JSON.stringify(idsOf(r)));

  // --- Tìm theo họ tên ---
  console.log('\n[Tìm theo họ tên]');
  r = await adminCall('GET', `/api/admin/orders?status=&search=${encodeURIComponent('Bích Ngọc')}`);
  check('tìm được theo tên người nhận', idsOf(r).includes(o1.order_id), JSON.stringify(idsOf(r)));
  check('không lẫn đơn của người khác', !idsOf(r).includes(o2.order_id));

  r = await adminCall('GET', `/api/admin/orders?status=&search=${encodeURIComponent('hoàng nam')}`);
  check('khớp một phần tên, chữ thường', idsOf(r).includes(o2.order_id), JSON.stringify(idsOf(r)));

  // --- Tìm theo số điện thoại ---
  console.log('\n[Tìm theo số điện thoại]');
  r = await adminCall('GET', '/api/admin/orders?status=&search=0912345678');
  check('khớp số đầy đủ', idsOf(r).includes(o1.order_id), JSON.stringify(idsOf(r)));

  r = await adminCall('GET', '/api/admin/orders?status=&search=8765');
  check('khớp một phần số', idsOf(r).includes(o2.order_id), JSON.stringify(idsOf(r)));

  // --- Lọc theo ngày đặt ---
  console.log('\n[Lọc theo ngày đặt]');
  const today = new Date().toISOString().slice(0, 10);

  r = await adminCall('GET', `/api/admin/orders?status=&from=${today}&to=${today}`);
  check('lọc đúng hôm nay', idsOf(r).length >= 2, `nhận ${idsOf(r).length} đơn`);

  r = await adminCall('GET', '/api/admin/orders?status=&from=1990-01-01&to=1990-12-31');
  check('khoảng ngày không có đơn → rỗng', idsOf(r).length === 0, `nhận ${idsOf(r).length}`);

  r = await adminCall('GET', '/api/admin/orders?status=&from=02-08-2026');
  check('định dạng ngày sai → 400', r.status === 400, `nhận ${r.status}`);

  // --- Kết hợp bộ lọc ---
  console.log('\n[Kết hợp bộ lọc]');
  r = await adminCall(
    'GET',
    `/api/admin/orders?status=PENDING&search=${encodeURIComponent('Bích Ngọc')}&from=${today}&to=${today}`
  );
  check('trạng thái + tên + ngày cùng lúc', idsOf(r).includes(o1.order_id), JSON.stringify(idsOf(r)));

  r = await adminCall('GET', `/api/admin/orders?status=CANCELLED&search=${encodeURIComponent('Bích Ngọc')}`);
  check('sai trạng thái → không khớp', idsOf(r).length === 0, `nhận ${idsOf(r).length}`);

  // --- Phân trang phải phản ánh bộ lọc ---
  console.log('\n[Tổng số khớp bộ lọc]');
  r = await adminCall('GET', `/api/admin/orders?status=&search=${encodeURIComponent('Bích Ngọc')}`);
  check(
    'pagination.total đếm theo bộ lọc, không phải tổng toàn bộ',
    r.body?.pagination?.total === 1,
    `nhận ${r.body?.pagination?.total}`
  );

  r = await adminCall('GET', '/api/admin/orders?status=&search=khongtontaixyz');
  check('từ khoá vô nghĩa → 0 đơn', r.body?.pagination?.total === 0, `nhận ${r.body?.pagination?.total}`);

  await cleanup();
  await closeDriver();
  try {
    await getAuth().deleteUser(UID);
  } catch {
    /* bỏ qua */
  }

  console.log(`\n=== Kết quả: ${passed} pass / ${failed} fail ===`);
  process.exitCode = failed > 0 ? 1 : 0;
})().catch(async (e) => {
  console.error('\n❌ Lỗi khi chạy test:', e.message);
  await closeDriver().catch(() => {});
  process.exitCode = 1;
});
