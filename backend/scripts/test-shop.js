/**
 * Kiểm thử toàn bộ luồng mua hàng: giỏ hàng → đặt đơn → admin xác nhận thanh
 * toán → sinh cạnh BOUGHT → gợi ý cập nhật.
 *
 * Không cần đăng nhập bằng Firebase thật: script tự tạo custom token cho một
 * tài khoản test qua Firebase Admin SDK, rồi đổi lấy ID token.
 *
 * Yêu cầu: server đang chạy (npm run dev).
 * Chạy: npm run test:shop
 */
const admin = require('../firebase');
const { driver, closeDriver } = require('../db');

const BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 5000}`;
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

const TEST_UID = 'test-shop-user';
const TEST_EMAIL = 'test-shop@example.com';

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

const getAuth = () => (typeof admin.auth === 'function' ? admin.auth() : require('firebase-admin/auth').getAuth());

/** Đổi custom token lấy ID token qua REST API của Firebase Auth. */
const getIdToken = async (uid) => {
  const customToken = await getAuth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
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

/** Dọn dữ liệu test khỏi Neo4j để chạy lại nhiều lần vẫn sạch. */
const cleanup = async (customerId) => {
  const session = driver.session();
  try {
    await session.run(
      `MATCH (c:Customer {customer_id: $customerId})
       OPTIONAL MATCH (c)-[:PLACED]->(o:Order)
       DETACH DELETE o
       WITH c
       DETACH DELETE c`,
      { customerId }
    );
  } finally {
    await session.close();
  }
};

(async () => {
  if (!WEB_API_KEY) {
    console.error('❌ Thiếu FIREBASE_WEB_API_KEY trong backend/.env');
    console.error('   Lấy ở Firebase Console → Project settings → General → Web API Key');
    process.exit(1);
  }

  const customerId = `U_${TEST_UID}`;
  console.log(`Kiểm thử luồng mua hàng tại ${BASE}\n`);

  // Tạo/cập nhật tài khoản test trên Firebase
  try {
    await getAuth().updateUser(TEST_UID, { email: TEST_EMAIL, displayName: 'Khách Test' });
  } catch {
    await getAuth().createUser({ uid: TEST_UID, email: TEST_EMAIL, displayName: 'Khách Test' });
  }

  await cleanup(customerId);

  const token = await getIdToken(TEST_UID);
  const call = api(token);

  // --- Đồng bộ tài khoản sang Neo4j ---
  console.log('[Chuẩn bị] POST /api/auth/sync');
  let r = await call('POST', '/api/auth/sync');
  check('tạo được Customer node', r.status === 200, `nhận ${r.status}`);
  check('bought_count ban đầu = 0', r.body?.data?.bought_count === 0, `nhận ${r.body?.data?.bought_count}`);

  // Lấy 2 sản phẩm thật để mua
  const products = (await call('GET', '/api/products?limit=2')).body.data;
  const [p1, p2] = products;

  // --- Giỏ hàng ---
  console.log('\n[Giỏ hàng]');
  r = await call('GET', '/api/cart');
  check('giỏ ban đầu rỗng', r.body?.data?.items?.length === 0);

  r = await call('POST', '/api/cart/items', { productId: p1.id, quantity: 2 });
  check('thêm sản phẩm 1 (số lượng 2)', r.status === 201, `nhận ${r.status}`);

  r = await call('POST', '/api/cart/items', { productId: p2.id, quantity: 1 });
  check('thêm sản phẩm 2', r.status === 201);
  check('giỏ có 2 dòng', r.body?.data?.item_count === 2, `nhận ${r.body?.data?.item_count}`);

  const expectedTotal = p1.final_price * 2 + p2.final_price;
  check('tổng tiền đúng', r.body?.data?.total === expectedTotal, `nhận ${r.body?.data?.total}, cần ${expectedTotal}`);

  r = await call('POST', '/api/cart/items', { productId: p1.id, quantity: 1 });
  check('thêm lại SP1 → cộng dồn thành 3', r.body?.data?.items?.find((i) => i.id === p1.id)?.quantity === 3);

  r = await call('PATCH', `/api/cart/items/${p1.id}`, { quantity: 2 });
  check('đặt lại số lượng = 2', r.body?.data?.items?.find((i) => i.id === p1.id)?.quantity === 2);

  r = await call('POST', '/api/cart/items', { productId: 'khong-ton-tai' });
  check('thêm SP không tồn tại → 404', r.status === 404, `nhận ${r.status}`);

  r = await call('PATCH', `/api/cart/items/${p1.id}`, { quantity: -1 });
  check('số lượng âm → 400', r.status === 400, `nhận ${r.status}`);

  r = await call('GET', '/api/cart/count');
  check('đếm giỏ = 2 dòng', r.body?.data?.item_count === 2);

  // --- Đặt hàng ---
  console.log('\n[Đặt hàng]');
  r = await call('POST', '/api/orders', { receiverName: 'Khách Test', phone: '0900000000' });
  check('thiếu địa chỉ → 400', r.status === 400, `nhận ${r.status}`);

  r = await call('POST', '/api/orders', {
    receiverName: 'Khách Test',
    phone: '0900000000',
    address: '123 Đường ABC, Quận 1',
    note: 'Giao giờ hành chính',
  });
  check('tạo đơn thành công', r.status === 201, `nhận ${r.status}`);
  check('trạng thái PENDING', r.body?.data?.status === 'PENDING', `nhận ${r.body?.data?.status}`);
  check('tổng tiền đúng', r.body?.data?.total === expectedTotal, `nhận ${r.body?.data?.total}`);
  check('mã đơn dạng DHxxxxxxxx', /^DH[0-9A-Z]{8}$/.test(r.body?.data?.order_id ?? ''), r.body?.data?.order_id);

  const orderId = r.body.data.order_id;

  r = await call('GET', '/api/cart');
  check('giỏ được dọn sạch sau khi đặt', r.body?.data?.items?.length === 0);

  r = await call('POST', '/api/orders', { receiverName: 'X', phone: '0900', address: 'Y' });
  check('đặt khi giỏ rỗng → 400', r.status === 400, `nhận ${r.status}`);

  // --- Chi tiết đơn ---
  console.log('\n[Chi tiết đơn]');
  r = await call('GET', `/api/orders/${orderId}`);
  check('xem được đơn của mình', r.status === 200);
  check('đơn có 2 dòng hàng', r.body?.data?.items?.length === 2, `nhận ${r.body?.data?.items?.length}`);
  check('lưu đúng địa chỉ', r.body?.data?.address === '123 Đường ABC, Quận 1');
  check('chốt đơn giá tại thời điểm mua', r.body?.data?.items?.every((i) => i.unit_price > 0));

  r = await call('GET', '/api/orders/DHKHONGCO1');
  check('đơn không tồn tại → 404', r.status === 404, `nhận ${r.status}`);

  // --- Xác nhận thanh toán (vai admin) ---
  console.log('\n[Admin xác nhận thanh toán]');
  const session = driver.session();
  await session.run(`MATCH (c:Customer {customer_id:$id}) SET c.role='admin'`, { id: customerId });
  await session.close();

  const adminToken = await getIdToken(TEST_UID); // token mới sau khi có role
  const adminCall = api(adminToken);

  r = await adminCall('GET', '/api/admin/orders?status=PENDING');
  check('admin thấy đơn chờ thanh toán', r.body?.data?.some((o) => o.order_id === orderId));

  const before = (await call('GET', '/api/auth/sync')).body;
  r = await adminCall('POST', `/api/admin/orders/${orderId}/mark-paid`, { note: 'Tiền mặt tại quầy' });
  check('xác nhận thanh toán thành công', r.status === 200, `nhận ${r.status} ${JSON.stringify(r.body)}`);
  check('đơn chuyển sang PAID', r.body?.data?.status === 'PAID', `nhận ${r.body?.data?.status}`);

  r = await adminCall('POST', `/api/admin/orders/${orderId}/mark-paid`);
  check('bấm lại lần 2 → 400 (không cộng dồn)', r.status === 400, `nhận ${r.status}`);

  // --- Cạnh BOUGHT đã sinh chưa? ---
  console.log('\n[Đồ thị BOUGHT — nối với Tiêu chí 3]');
  r = await call('POST', '/api/auth/sync');
  check('bought_count = 2 sau khi thanh toán', r.body?.data?.bought_count === 2, `nhận ${r.body?.data?.bought_count}`);

  const s2 = driver.session();
  const bought = await s2.run(
    `MATCH (c:Customer {customer_id:$id})-[b:BOUGHT]->(p:Product)
     RETURN collect(p.id) AS ids, count(b) AS n`,
    { id: customerId }
  );
  await s2.close();
  const boughtIds = bought.records[0].get('ids');
  check('BOUGHT trỏ đúng 2 sản phẩm trong đơn', boughtIds.includes(p1.id) && boughtIds.includes(p2.id));

  r = await call('GET', `/api/customers/${customerId}/recommendations`);
  check('Query A ra gợi ý cho khách mới mua', (r.body?.data?.length ?? 0) > 0, `nhận ${r.body?.data?.length}`);

  // --- Huỷ đơn ---
  console.log('\n[Huỷ đơn]');
  r = await call('POST', `/api/orders/${orderId}/cancel`);
  check('không huỷ được đơn đã thanh toán → 400', r.status === 400, `nhận ${r.status}`);

  // --- Hồ sơ ---
  console.log('\n[Hồ sơ khách hàng]');
  r = await call('GET', '/api/customers/me/profile');
  check('xem được hồ sơ', r.status === 200);
  check('order_count = 1', r.body?.data?.order_count === 1, `nhận ${r.body?.data?.order_count}`);
  check('total_spent đúng', r.body?.data?.total_spent === expectedTotal, `nhận ${r.body?.data?.total_spent}`);

  r = await call('PATCH', '/api/customers/me/profile', { phone: '0911222333', address: 'Địa chỉ mới' });
  check('cập nhật hồ sơ', r.body?.data?.phone === '0911222333');

  // --- Bảo mật ---
  console.log('\n[Bảo mật]');
  const anon = api(null);
  for (const [m, p] of [
    ['GET', '/api/cart'],
    ['POST', '/api/orders'],
    ['GET', '/api/orders'],
    ['GET', '/api/customers/me/profile'],
    ['GET', '/api/admin/orders'],
  ]) {
    const res = await anon(m, p, m === 'POST' ? {} : undefined);
    check(`${m} ${p} không token → 401`, res.status === 401, `nhận ${res.status}`);
  }

  await cleanup(customerId);
  await closeDriver();

  console.log(`\n=== Kết quả: ${passed} pass / ${failed} fail ===`);
  process.exitCode = failed > 0 ? 1 : 0;
})().catch(async (e) => {
  console.error('\n❌ Lỗi khi chạy test:', e.message);
  await closeDriver().catch(() => {});
  process.exitCode = 1;
});
