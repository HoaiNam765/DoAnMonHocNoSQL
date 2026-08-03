/**
 * Kiểm thử các endpoint thống kê quản trị mới:
 *   - Doanh thu theo thời gian (lọc theo tháng / ngày / khoảng ngày)
 *   - Hoạt động mua hàng gần nhất (bản đã sửa lỗi timestamp)
 *   - Lịch sử đơn hàng của một khách hàng
 *   - Chi tiết đơn hàng phía admin (kèm danh sách sản phẩm)
 *   - Kiểm soát tồn kho
 *
 * Yêu cầu: server đang chạy.
 * Chạy: npm run test:admin
 */
const admin = require('../firebase');
const { driver, closeDriver } = require('../db');

const BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 5000}`;
const WEB_KEY = process.env.FIREBASE_WEB_API_KEY;
const UID = 'test-admin-stats';
const CUSTOMER_ID = `U_${UID}`;

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
      { id: CUSTOMER_ID }
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

  console.log(`Kiểm thử thống kê quản trị tại ${BASE}\n`);

  try {
    await getAuth().updateUser(UID, { email: 'ts@example.com', displayName: 'Admin Test' });
  } catch {
    await getAuth().createUser({ uid: UID, email: 'ts@example.com', displayName: 'Admin Test' });
  }
  await cleanup();

  const call = api(await idTokenFor(UID));
  await call('POST', '/api/auth/sync');

  // Cấp quyền admin rồi lấy token mới
  const s = driver.session();
  await s.run(`MATCH (c:Customer {customer_id: $id}) SET c.role = 'admin'`, { id: CUSTOMER_ID });
  await s.close();
  const adminCall = api(await idTokenFor(UID));

  // --- Tạo một đơn hoàn chỉnh để có dữ liệu thống kê ---
  console.log('[Chuẩn bị] Tạo đơn hàng mẫu');
  const products = (await call('GET', '/api/products?limit=2')).body.data;
  const [p1, p2] = products;

  await call('POST', '/api/cart/items', { productId: p1.id, quantity: 2 });
  await call('POST', '/api/cart/items', { productId: p2.id, quantity: 1 });

  const created = await call('POST', '/api/orders', {
    receiverName: 'Admin Test',
    phone: '0900000001',
    address: 'Địa chỉ kiểm thử',
  });
  check('tạo được đơn mẫu', created.status === 201, `nhận ${created.status}`);
  const orderId = created.body?.data?.order_id;
  const orderTotal = created.body?.data?.total;

  // --- Tồn kho ---
  console.log('\n[Tồn kho]');
  const stockBefore = (await call('GET', `/api/products/${p1.id}`)).body?.data;
  check('sản phẩm có trường stock', typeof stockBefore?.stock === 'number', `nhận ${stockBefore?.stock}`);

  // Hạ tồn kho xuống 1 rồi thử thêm 5 — phải bị chặn.
  // (không dùng số lượng khổng lồ vì sẽ chạm giới hạn 99/lần trước khi tới bước kiểm kho)
  const sess = driver.session();
  await sess.run(`MATCH (p:Product {id: $id}) SET p.stock = 1`, { id: p2.id });
  await sess.close();

  let r = await call('POST', '/api/cart/items', { productId: p2.id, quantity: 5 });
  check('thêm vượt tồn kho → 409', r.status === 409, `nhận ${r.status}: ${r.body?.message}`);

  // Trả kho về mức đủ để phần kiểm thử phía sau chạy tiếp
  const sess2 = driver.session();
  await sess2.run(`MATCH (p:Product {id: $id}) SET p.stock = 100`, { id: p2.id });
  await sess2.close();

  r = await adminCall('GET', '/api/admin/low-stock?threshold=10');
  check('lấy được danh sách sắp hết hàng', r.status === 200, `nhận ${r.status}`);

  // --- Chi tiết đơn phía admin (phải kèm sản phẩm) ---
  console.log('\n[Chi tiết đơn phía admin]');
  r = await adminCall('GET', `/api/admin/orders/${orderId}`);
  check('status 200', r.status === 200, `nhận ${r.status}`);
  check('trả về danh sách sản phẩm', Array.isArray(r.body?.data?.items), `nhận ${typeof r.body?.data?.items}`);
  check('đúng 2 dòng hàng', r.body?.data?.items?.length === 2, `nhận ${r.body?.data?.items?.length}`);
  check(
    'mỗi dòng có tên, số lượng, đơn giá',
    r.body?.data?.items?.every((i) => i.title && i.quantity > 0 && i.unit_price > 0)
  );
  check('có thông tin người nhận', r.body?.data?.receiver_name === 'Admin Test');

  // --- Xác nhận thanh toán → trừ kho ---
  console.log('\n[Xác nhận thanh toán → trừ kho]');
  const beforeStock = (await call('GET', `/api/products/${p1.id}`)).body.data.stock;
  r = await adminCall('POST', `/api/admin/orders/${orderId}/mark-paid`, { note: 'Tiền mặt' });
  check('xác nhận thanh toán thành công', r.status === 200, `nhận ${r.status}`);

  const afterStock = (await call('GET', `/api/products/${p1.id}`)).body.data.stock;
  check(
    `tồn kho giảm đúng 2 đơn vị (${beforeStock} → ${afterStock})`,
    beforeStock - afterStock === 2,
    `giảm ${beforeStock - afterStock}`
  );

  // --- Doanh thu theo thời gian ---
  console.log('\n[Doanh thu theo thời gian]');
  r = await adminCall('GET', '/api/admin/revenue?groupBy=month');
  check('gộp theo tháng — status 200', r.status === 200, `nhận ${r.status}`);
  check('có dữ liệu chuỗi thời gian', (r.body?.data?.length ?? 0) > 0, `nhận ${r.body?.data?.length}`);
  check(
    'nhãn kỳ đúng dạng YYYY-MM',
    r.body?.data?.every((d) => /^\d{4}-\d{2}$/.test(d.period)),
    JSON.stringify(r.body?.data?.map((d) => d.period))
  );
  check('doanh thu > 0', r.body?.data?.some((d) => d.revenue > 0));

  r = await adminCall('GET', '/api/admin/revenue?groupBy=day');
  check('gộp theo ngày — status 200', r.status === 200);
  check(
    'nhãn kỳ đúng dạng YYYY-MM-DD',
    r.body?.data?.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.period)),
    JSON.stringify(r.body?.data?.map((d) => d.period))
  );

  const today = new Date().toISOString().slice(0, 10);
  r = await adminCall('GET', `/api/admin/revenue?groupBy=day&from=${today}&to=${today}`);
  check('lọc theo khoảng ngày', r.status === 200 && (r.body?.data?.length ?? 0) > 0);

  r = await adminCall('GET', '/api/admin/revenue?groupBy=day&from=1990-01-01&to=1990-12-31');
  check('khoảng ngày không có dữ liệu → mảng rỗng', r.body?.data?.length === 0, `nhận ${r.body?.data?.length}`);

  r = await adminCall('GET', '/api/admin/revenue?groupBy=nam');
  check('groupBy sai → 400', r.status === 400, `nhận ${r.status}`);

  r = await adminCall('GET', '/api/admin/revenue?groupBy=day&from=02-08-2026');
  check('định dạng ngày sai → 400', r.status === 400, `nhận ${r.status}`);

  // --- Hoạt động gần nhất (bản đã sửa lỗi) ---
  console.log('\n[Lượt mua gần nhất]');
  r = await adminCall('GET', '/api/admin/stats');
  const recent = r.body?.data?.recentOrders ?? [];
  check('có dữ liệu hoạt động gần nhất', recent.length > 0, `nhận ${recent.length}`);
  check(
    'đơn vừa tạo nằm trong danh sách',
    recent.some((o) => o.order_id === orderId),
    `top: ${recent[0]?.order_id}`
  );
  check('mỗi dòng có mã đơn và tên khách', recent.every((o) => o.order_id && o.customer_id));
  check(
    'sắp xếp giảm dần theo thời gian',
    recent.every((o, i, a) => i === 0 || a[i - 1].created_at >= o.created_at)
  );
  check('có tổng hợp đơn hàng thật', r.body?.data?.orderSummary?.total_orders > 0);
  check('có chuỗi doanh thu theo kỳ', (r.body?.data?.revenueByPeriod?.length ?? 0) > 0);

  // --- Đơn hàng của một khách hàng ---
  console.log('\n[Đơn hàng của khách hàng]');
  r = await adminCall('GET', `/api/admin/users/${CUSTOMER_ID}/orders`);
  check('status 200', r.status === 200, `nhận ${r.status}`);
  check('trả đúng 1 đơn', r.body?.data?.length === 1, `nhận ${r.body?.data?.length}`);
  check('đúng mã đơn', r.body?.data?.[0]?.order_id === orderId);
  check('đúng tổng tiền', r.body?.data?.[0]?.total === orderTotal);
  check('trạng thái đã cập nhật thành PAID', r.body?.data?.[0]?.status === 'PAID');

  r = await adminCall('GET', '/api/admin/users/U_khong-ton-tai/orders');
  check('khách không có đơn → mảng rỗng', r.body?.data?.length === 0);

  // --- Huỷ đơn đã thanh toán → hoàn kho ---
  console.log('\n[Huỷ đơn → hoàn kho]');
  const stockBeforeCancel = (await call('GET', `/api/products/${p1.id}`)).body.data.stock;
  r = await adminCall('PUT', `/api/admin/orders/${orderId}/status`, { status: 'CANCELLED' });
  check('huỷ đơn thành công', r.status === 200, `nhận ${r.status}`);
  const stockAfterCancel = (await call('GET', `/api/products/${p1.id}`)).body.data.stock;
  check(
    `hoàn trả 2 đơn vị về kho (${stockBeforeCancel} → ${stockAfterCancel})`,
    stockAfterCancel - stockBeforeCancel === 2,
    `chênh ${stockAfterCancel - stockBeforeCancel}`
  );

  // --- Bảo mật ---
  console.log('\n[Bảo mật]');
  const anon = api(null);
  for (const p of ['/api/admin/revenue', '/api/admin/low-stock', `/api/admin/users/${CUSTOMER_ID}/orders`]) {
    const res = await anon('GET', p);
    check(`GET ${p} không token → 401`, res.status === 401, `nhận ${res.status}`);
  }

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
