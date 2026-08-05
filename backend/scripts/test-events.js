/**
 * Kiểm thử luồng sự kiện thời gian thực (SSE).
 *
 * Kịch bản đúng như yêu cầu:
 *   - Khách đặt đơn  -> admin nhận sự kiện ngay, không cần tải lại trang
 *   - Khách huỷ đơn  -> admin nhận sự kiện ngay
 *   - Admin xác nhận -> khách nhận sự kiện ngay
 *
 * Yêu cầu: server đang chạy.
 * Chạy: npm run test:events
 */
require('../loadEnv');
const admin = require('../firebase');
const { driver, closeDriver } = require('../db');

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const UID_KHACH = 'test-sse-khach';
const UID_ADMIN = 'test-sse-admin';

let dat = 0, hong = 0;
const check = (ten, ok, chiTiet = '') => {
  if (ok) { dat++; console.log(`  DAT  ${ten}`); }
  else { hong++; console.log(`  HONG ${ten}${chiTiet ? ' -- ' + chiTiet : ''}`); }
};

const getAuth = () => (typeof admin.auth === 'function' ? admin.auth() : require('firebase-admin/auth').getAuth());

const getIdToken = async (uid) => {
  const ct = await getAuth().createCustomToken(uid);
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.FIREBASE_WEB_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ct, returnSecureToken: true }) }
  );
  const b = await r.json();
  if (!b.idToken) throw new Error('Khong lay duoc idToken: ' + JSON.stringify(b));
  return b.idToken;
};

const api = (token) => async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* co the khong co body */ }
  return { status: res.status, body: json };
};

/**
 * Mở một luồng SSE và gom các sự kiện nhận được vào mảng.
 * Node có sẵn fetch dạng luồng nên không cần thư viện EventSource.
 */
const moLuong = async (token, nhan) => {
  const ve = await api(token)('POST', '/api/events/ticket');
  if (ve.status !== 200) throw new Error(`${nhan}: khong xin duoc ve (${ve.status})`);

  const res = await fetch(`${BASE}/api/events/stream?ticket=${ve.body.data.ticket}`);
  if (!res.ok) throw new Error(`${nhan}: khong mo duoc luong (${res.status})`);

  const suKien = [];
  const doc = res.body.getReader();
  const giaiMa = new TextDecoder();
  let dem = '';

  (async () => {
    try {
      for (;;) {
        const { done, value } = await doc.read();
        if (done) break;
        dem += giaiMa.decode(value, { stream: true });

        const khoi = dem.split('\n\n');
        dem = khoi.pop();

        for (const k of khoi) {
          const loai = k.match(/^event: (.+)$/m)?.[1];
          const duLieu = k.match(/^data: (.+)$/m)?.[1];
          if (loai && duLieu) suKien.push({ loai, duLieu: JSON.parse(duLieu) });
        }
      }
    } catch { /* luong bi dong khi ket thuc */ }
  })();

  return { suKien, dong: () => doc.cancel().catch(() => {}), laAdmin: ve.body.data.laAdmin };
};

const cho = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chờ tới khi có sự kiện thoả điều kiện, tối đa `hanMs`. */
const choSuKien = async (suKien, dieuKien, hanMs = 4000) => {
  const het = Date.now() + hanMs;
  while (Date.now() < het) {
    const tim = suKien.find(dieuKien);
    if (tim) return tim;
    await cho(100);
  }
  return null;
};

(async () => {
  const s = driver.session();
  let luongKhach = null, luongAdmin = null;

  try {
    const tokenKhach = await getIdToken(UID_KHACH);
    const tokenAdmin = await getIdToken(UID_ADMIN);
    const callKhach = api(tokenKhach);
    const callAdmin = api(tokenAdmin);

    await callKhach('POST', '/api/auth/sync');
    await callAdmin('POST', '/api/auth/sync');

    const cidKhach = `U_${UID_KHACH}`;
    await s.run(`MATCH (c:Customer {customer_id:$id}) SET c.role='admin'
                 MERGE (r:Role {role_name:'admin'}) MERGE (c)-[:HAS_ROLE]->(r)`, { id: `U_${UID_ADMIN}` });

    // Dọn dữ liệu cũ
    await s.run(`MATCH (c:Customer {customer_id:$id})-[r:IN_CART]->() DELETE r`, { id: cidKhach });
    await s.run(`MATCH (c:Customer {customer_id:$id})-[:PLACED]->(o:Order) DETACH DELETE o`, { id: cidKhach });

    const sp = (await s.run(`MATCH (p:Product) WHERE coalesce(p.stock,0) >= 5 RETURN p.id AS id LIMIT 1`))
      .records[0].get('id');

    // ------------------------------------------------------------------
    console.log('--- 1. Mo luong su kien ---');
    luongKhach = await moLuong(tokenKhach, 'khach');
    luongAdmin = await moLuong(tokenAdmin, 'admin');
    await cho(500);

    check('Khach mo duoc luong', (await choSuKien(luongKhach.suKien, (e) => e.loai === 'ready')) !== null);
    check('Admin mo duoc luong', (await choSuKien(luongAdmin.suKien, (e) => e.loai === 'ready')) !== null);
    check('He thong nhan dung admin', luongAdmin.laAdmin === true, `nhan ${luongAdmin.laAdmin}`);
    check('Khach KHONG bi coi la admin', luongKhach.laAdmin === false, `nhan ${luongKhach.laAdmin}`);

    // ------------------------------------------------------------------
    console.log('\n--- 2. Khach dat don -> admin phai nhan ngay ---');
    luongAdmin.suKien.length = 0;
    const don = await callKhach('POST', '/api/orders/buy-now', {
      productId: sp, quantity: 1,
      receiverName: 'Test SSE', phone: '0901234567', address: 'So 1 Test',
    });
    check('Tao don thanh cong', don.status === 201, `nhan ${don.status}`);

    const maDon = don.body?.data?.order_id;
    const skTao = await choSuKien(luongAdmin.suKien, (e) => e.loai === 'orders_changed' && e.duLieu.orderId === maDon);
    check('Admin nhan su kien don moi', skTao !== null, JSON.stringify(luongAdmin.suKien));
    check('Su kien ghi dung hanh dong "tao"', skTao?.duLieu?.hanhDong === 'tao', skTao?.duLieu?.hanhDong);
    check('Su kien ghi dung trang thai PENDING', skTao?.duLieu?.status === 'PENDING', skTao?.duLieu?.status);

    // ------------------------------------------------------------------
    console.log('\n--- 3. Admin xac nhan thanh toan -> khach phai nhan ngay ---');
    luongKhach.suKien.length = 0;
    const xacNhan = await callAdmin('POST', `/api/admin/orders/${maDon}/mark-paid`, { note: 'Tien mat' });
    check('Xac nhan thanh toan thanh cong', xacNhan.status === 200, `nhan ${xacNhan.status}`);

    const skTra = await choSuKien(luongKhach.suKien, (e) => e.loai === 'my_orders_changed' && e.duLieu.orderId === maDon);
    check('Khach nhan su kien da thanh toan', skTra !== null, JSON.stringify(luongKhach.suKien));
    check('Trang thai trong su kien la PAID', skTra?.duLieu?.status === 'PAID', skTra?.duLieu?.status);

    // ------------------------------------------------------------------
    console.log('\n--- 4. Khach huy don -> admin phai nhan ngay ---');
    const don2 = await callKhach('POST', '/api/orders/buy-now', {
      productId: sp, quantity: 1,
      receiverName: 'Test SSE 2', phone: '0901234567', address: 'So 1 Test',
    });
    const maDon2 = don2.body?.data?.order_id;
    await cho(300);

    luongAdmin.suKien.length = 0;
    const huy = await callKhach('POST', `/api/orders/${maDon2}/cancel`);
    check('Huy don thanh cong', huy.status === 200, `nhan ${huy.status}`);

    const skHuy = await choSuKien(luongAdmin.suKien, (e) => e.loai === 'orders_changed' && e.duLieu.orderId === maDon2);
    check('Admin nhan su kien huy don', skHuy !== null, JSON.stringify(luongAdmin.suKien));
    check('Su kien ghi dung hanh dong "huy"', skHuy?.duLieu?.hanhDong === 'huy', skHuy?.duLieu?.hanhDong);

    // ------------------------------------------------------------------
    console.log('\n--- 5. Rieng tu: khach KHONG duoc nhan don cua nguoi khac ---');
    const soSuKienKhachTruoc = luongKhach.suKien.length;
    await callAdmin('PUT', `/api/admin/orders/${maDon}/status`, { status: 'COMPLETED' });
    await cho(1200);
    const themCuaKhach = luongKhach.suKien.slice(soSuKienKhachTruoc)
      .filter((e) => e.loai === 'my_orders_changed');
    check('Khach van nhan su kien don CUA MINH', themCuaKhach.length > 0, 'khong nhan duoc');
    check('Khach khong nhan su kien "orders_changed" (kenh danh cho admin)',
      !luongKhach.suKien.some((e) => e.loai === 'orders_changed'));

    // ------------------------------------------------------------------
    console.log('\n--- 6. Bao ve luong su kien ---');
    const khongVe = await fetch(`${BASE}/api/events/stream`);
    check('Mo luong khong co ve -> 401', khongVe.status === 401, `nhan ${khongVe.status}`);
    await khongVe.body?.cancel?.().catch(() => {});

    const veBay = await fetch(`${BASE}/api/events/stream?ticket=khongtontai123`);
    check('Ve bay ba -> 401', veBay.status === 401, `nhan ${veBay.status}`);
    await veBay.body?.cancel?.().catch(() => {});

    const veThat = await api(tokenKhach)('POST', '/api/events/ticket');
    const lan1 = await fetch(`${BASE}/api/events/stream?ticket=${veThat.body.data.ticket}`);
    await lan1.body?.cancel?.().catch(() => {});
    const lan2 = await fetch(`${BASE}/api/events/stream?ticket=${veThat.body.data.ticket}`);
    check('Ve chi dung duoc MOT lan -> lan 2 bi tu choi', lan2.status === 401, `nhan ${lan2.status}`);
    await lan2.body?.cancel?.().catch(() => {});

    const veKhongToken = await api(null)('POST', '/api/events/ticket');
    check('Xin ve khong co token -> 401', veKhongToken.status === 401, `nhan ${veKhongToken.status}`);
  } finally {
    luongKhach?.dong();
    luongAdmin?.dong();

    const cid = `U_${UID_KHACH}`;
    await s.run(`MATCH (c:Customer {customer_id:$id})-[r:IN_CART]->() DELETE r`, { id: cid });
    await s.run(`MATCH (c:Customer {customer_id:$id})-[:PLACED]->(o:Order) DETACH DELETE o`, { id: cid });
    await s.run(`MATCH (c:Customer {customer_id:$id}) REMOVE c.role`, { id: `U_${UID_ADMIN}` });
    await s.run(`MATCH (c:Customer {customer_id:$id})-[h:HAS_ROLE]->(:Role) DELETE h`, { id: `U_${UID_ADMIN}` });
    await s.close();
    await closeDriver();
  }

  console.log(`\n=====================================`);
  console.log(`DAT: ${dat} | HONG: ${hong}`);
  process.exit(hong > 0 ? 1 : 0);
})().catch((e) => { console.error('LOI:', e.message); process.exit(1); });
