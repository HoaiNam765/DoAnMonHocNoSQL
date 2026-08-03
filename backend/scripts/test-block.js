/**
 * Kiểm thử tính năng khoá tài khoản.
 *
 * Trước khi sửa, nút "Khoá tài khoản" chỉ ghi `status = 'blocked'` vào Neo4j mà
 * không có middleware nào đọc — tài khoản bị khoá vẫn đăng nhập, thêm giỏ và
 * ĐẶT HÀNG bình thường. Bộ test này khoá lại lỗ hổng đó.
 *
 * Yêu cầu: server đang chạy.
 * Chạy: npm run test:block
 */
const admin = require('../firebase');
const { driver, closeDriver } = require('../db');

const BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 5000}`;
const WEB_KEY = process.env.FIREBASE_WEB_API_KEY;

const VICTIM_UID = 'test-block-victim';
const ADMIN_UID = 'test-block-admin';
const VICTIM_ID = `U_${VICTIM_UID}`;
const ADMIN_ID = `U_${ADMIN_UID}`;

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

const runCypher = async (cypher, params) => {
  const s = driver.session();
  try {
    const r = await s.run(cypher, params);
    return r.records.map((x) => x.toObject());
  } finally {
    await s.close();
  }
};

const cleanup = async () => {
  for (const id of [VICTIM_ID, ADMIN_ID]) {
    await runCypher(
      `MATCH (c:Customer {customer_id: $id})
       OPTIONAL MATCH (c)-[:PLACED]->(o:Order)
       DETACH DELETE o
       WITH c DETACH DELETE c`,
      { id }
    );
  }
};

(async () => {
  if (!WEB_KEY) {
    console.error('❌ Thiếu FIREBASE_WEB_API_KEY trong backend/.env');
    process.exit(1);
  }

  console.log(`Kiểm thử khoá tài khoản tại ${BASE}\n`);

  for (const [uid, name] of [
    [VICTIM_UID, 'Khách Bị Khoá'],
    [ADMIN_UID, 'Quản Trị Test'],
  ]) {
    try {
      await getAuth().updateUser(uid, { email: `${uid}@example.com`, displayName: name });
    } catch {
      await getAuth().createUser({ uid, email: `${uid}@example.com`, displayName: name });
    }
  }
  await cleanup();

  const victim = api(await idTokenFor(VICTIM_UID));
  await victim('POST', '/api/auth/sync');

  const adminCallSetup = api(await idTokenFor(ADMIN_UID));
  await adminCallSetup('POST', '/api/auth/sync');
  await runCypher(`MATCH (c:Customer {customer_id: $id}) SET c.role = 'admin'`, { id: ADMIN_ID });
  const adminCall = api(await idTokenFor(ADMIN_UID));

  // --- Khách tạo 2 đơn: 1 sẽ thanh toán, 1 để chờ ---
  console.log('[Chuẩn bị] Khách tạo 2 đơn hàng');
  const products = (await victim('GET', '/api/products?limit=2')).body.data;

  await victim('POST', '/api/cart/items', { productId: products[0].id, quantity: 1 });
  const paidOrder = (
    await victim('POST', '/api/orders', {
      receiverName: 'Khách Bị Khoá',
      phone: '0900000009',
      address: 'Địa chỉ test',
    })
  ).body.data;

  await victim('POST', '/api/cart/items', { productId: products[1].id, quantity: 1 });
  const pendingOrder = (
    await victim('POST', '/api/orders', {
      receiverName: 'Khách Bị Khoá',
      phone: '0900000009',
      address: 'Địa chỉ test',
    })
  ).body.data;

  await adminCall('POST', `/api/admin/orders/${paidOrder.order_id}/mark-paid`, { note: 'Tiền mặt' });
  check('đơn 1 đã thanh toán', paidOrder.order_id != null);
  check('đơn 2 đang chờ thanh toán', pendingOrder.order_id != null);

  // --- Trước khi khoá: mọi thứ hoạt động ---
  console.log('\n[Trước khi khoá]');
  let r = await victim('GET', '/api/auth/me');
  check('xem được hồ sơ', r.status === 200, `nhận ${r.status}`);
  r = await victim('POST', '/api/cart/items', { productId: products[0].id, quantity: 1 });
  check('thêm được vào giỏ', r.status === 201, `nhận ${r.status}`);

  // --- Khoá tài khoản ---
  console.log('\n[Khoá tài khoản]');
  r = await adminCall('PUT', `/api/admin/users/${VICTIM_ID}/status`, { status: 'blocked' });
  check('khoá thành công', r.status === 200, `nhận ${r.status}`);
  check('trạng thái = blocked', r.body?.data?.status === 'blocked', `nhận ${r.body?.data?.status}`);
  check(
    'tự huỷ 1 đơn chưa thanh toán',
    r.body?.data?.cancelled_orders === 1,
    `nhận ${r.body?.data?.cancelled_orders}`
  );

  const orders = await runCypher(
    `MATCH (:Customer {customer_id: $id})-[:PLACED]->(o:Order)
     RETURN o.order_id AS id, o.status AS status, o.cancel_reason AS reason`,
    { id: VICTIM_ID }
  );
  const pending = orders.find((o) => o.id === pendingOrder.order_id);
  const paid = orders.find((o) => o.id === paidOrder.order_id);

  check('đơn chờ → CANCELLED', pending?.status === 'CANCELLED', `nhận ${pending?.status}`);
  check('có ghi lý do huỷ', /khoá/i.test(pending?.reason ?? ''), `nhận "${pending?.reason}"`);
  check('đơn ĐÃ thanh toán giữ nguyên PAID', paid?.status === 'PAID', `nhận ${paid?.status}`);

  // --- Sau khi khoá: tất cả phải bị chặn ---
  console.log('\n[Sau khi khoá — mọi thao tác phải bị chặn]');
  const blocked = api(await idTokenFor(VICTIM_UID)); // lấy token MỚI, phải vẫn bị chặn

  const guarded = [
    ['POST', '/api/auth/sync', undefined],
    ['GET', '/api/auth/me', undefined],
    ['GET', '/api/cart', undefined],
    ['POST', '/api/cart/items', { productId: products[0].id, quantity: 1 }],
    ['GET', '/api/orders', undefined],
    ['POST', '/api/orders', { receiverName: 'X', phone: '0900000000', address: 'Y' }],
    ['GET', '/api/customers/me/profile', undefined],
  ];

  for (const [method, path, body] of guarded) {
    const res = await blocked(method, path, body);
    check(`${method} ${path} → 403`, res.status === 403, `nhận ${res.status}`);
  }

  r = await blocked('GET', '/api/auth/me');
  check('thông báo lỗi nói rõ bị khoá', /khoá/i.test(r.body?.message ?? ''), `"${r.body?.message}"`);

  // --- Trang công khai vẫn xem được ---
  console.log('\n[Trang công khai vẫn truy cập bình thường]');
  r = await blocked('GET', '/api/products?limit=1');
  check('xem danh sách sản phẩm', r.status === 200, `nhận ${r.status}`);
  r = await blocked('GET', `/api/products/${products[0].id}`);
  check('xem chi tiết sản phẩm', r.status === 200, `nhận ${r.status}`);

  const viewedBefore = await runCypher(
    `MATCH (:Customer {customer_id: $id})-[v:VIEWED]->() RETURN count(v) AS n`,
    { id: VICTIM_ID }
  );
  await blocked('GET', `/api/products/${products[1].id}`);
  const viewedAfter = await runCypher(
    `MATCH (:Customer {customer_id: $id})-[v:VIEWED]->() RETURN count(v) AS n`,
    { id: VICTIM_ID }
  );
  check(
    'KHÔNG ghi VIEWED cho tài khoản bị khoá',
    viewedBefore[0].n === viewedAfter[0].n,
    `${viewedBefore[0].n} → ${viewedAfter[0].n}`
  );

  // --- Admin không tự khoá được mình ---
  console.log('\n[Bảo vệ tài khoản quản trị]');
  r = await adminCall('PUT', `/api/admin/users/${ADMIN_ID}/status`, { status: 'blocked' });
  check('admin không tự khoá được mình → 400', r.status === 400, `nhận ${r.status}`);
  r = await adminCall('GET', '/api/admin/stats');
  check('admin vẫn vào được trang quản trị', r.status === 200, `nhận ${r.status}`);

  // --- Mở khoá ---
  console.log('\n[Mở khoá]');
  r = await adminCall('PUT', `/api/admin/users/${VICTIM_ID}/status`, { status: 'active' });
  check('mở khoá thành công', r.status === 200, `nhận ${r.status}`);

  const reopened = api(await idTokenFor(VICTIM_UID));
  r = await reopened('GET', '/api/auth/me');
  check('đăng nhập lại được ngay', r.status === 200, `nhận ${r.status}`);
  r = await reopened('POST', '/api/cart/items', { productId: products[0].id, quantity: 1 });
  check('mua hàng lại được', r.status === 201, `nhận ${r.status}`);

  const afterUnblock = await runCypher(
    `MATCH (:Customer {customer_id: $id})-[:PLACED]->(o:Order {order_id: $oid}) RETURN o.status AS status`,
    { id: VICTIM_ID, oid: pendingOrder.order_id }
  );
  check(
    'đơn đã huỷ KHÔNG tự khôi phục khi mở khoá',
    afterUnblock[0]?.status === 'CANCELLED',
    `nhận ${afterUnblock[0]?.status}`
  );

  await cleanup();
  await closeDriver();
  for (const uid of [VICTIM_UID, ADMIN_UID]) {
    try {
      await getAuth().deleteUser(uid);
    } catch {
      /* bỏ qua */
    }
  }

  console.log(`\n=== Kết quả: ${passed} pass / ${failed} fail ===`);
  process.exitCode = failed > 0 ? 1 : 0;
})().catch(async (e) => {
  console.error('\n❌ Lỗi khi chạy test:', e.message);
  await closeDriver().catch(() => {});
  process.exitCode = 1;
});
