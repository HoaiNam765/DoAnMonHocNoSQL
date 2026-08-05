/**
 * Kiểm thử THUỘC TÍNH TUỲ Ý của sản phẩm — phần thể hiện tính schema-less.
 *
 * Yêu cầu: server đang chạy.
 * Chạy: npm run test:attrs
 */
require('dotenv').config();
const admin = require('../firebase');
const { driver, closeDriver } = require('../db');

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const UID = 'test-attrs-admin';

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

(async () => {
  const s = driver.session();
  const token = await getIdToken(UID);
  const call = api(token);

  await call('POST', '/api/auth/sync');
  const cid = `U_${UID}`;
  await s.run(`MATCH (c:Customer {customer_id:$id}) SET c.role='admin'
               MERGE (r:Role {role_name:'admin'}) MERGE (c)-[:HAS_ROLE]->(r)`, { id: cid });

  // Lấy 2 sản phẩm để chứng minh mỗi cái mang bộ thuộc tính khác nhau
  const sp = await s.run(`MATCH (p:Product) RETURN p.id AS id, p.title AS title LIMIT 2`);
  const [A, B] = sp.records.map((r) => r.toObject());
  const goc = {};
  for (const p of [A, B]) {
    const r = await s.run(`MATCH (p:Product {id:$id}) RETURN properties(p) AS props`, { id: p.id });
    goc[p.id] = r.records[0].get('props');
  }

  console.log(`San pham thu: A=${A.title.slice(0,32)} | B=${B.title.slice(0,32)}\n`);

  try {
    // ------------------------------------------------------------------
    console.log('--- 1. Them thuoc tinh tuy y ---');
    const them = await call('PUT', `/api/admin/products/${A.id}/attributes`, {
      attributes: { 'Mô tả': 'Hàng chính hãng, bảo hành 12 tháng', 'Xuất xứ': 'Việt Nam', 'Khối lượng': '250' },
    });
    check('Luu thuoc tinh -> 200', them.status === 200, `nhan ${them.status} ${JSON.stringify(them.body)}`);
    const a1 = them.body?.data?.attributes ?? {};
    check('Co thuoc tinh "Mô tả" (ten co dau tieng Viet)', a1['Mô tả'] === 'Hàng chính hãng, bảo hành 12 tháng');
    check('Co thuoc tinh "Xuất xứ"', a1['Xuất xứ'] === 'Việt Nam');
    check('"250" duoc luu thanh SO chu khong phai chuoi', a1['Khối lượng'] === 250, `nhan ${typeof a1['Khối lượng']} ${a1['Khối lượng']}`);

    // ------------------------------------------------------------------
    console.log('\n--- 2. Hien ra trang chi tiet san pham (cong khai) ---');
    const ct = await call('GET', `/api/products/${A.id}`);
    const attrs = ct.body?.data?.attributes ?? {};
    check('API cong khai tra ve attributes', ct.status === 200 && Object.keys(attrs).length === 3, JSON.stringify(attrs));
    check('Khong lan thuoc tinh loi vao attributes',
      !('title' in attrs) && !('final_price' in attrs) && !('id' in attrs));
    check('Cac truong loi van con nguyen', ct.body?.data?.title && ct.body?.data?.final_price !== undefined);

    // ------------------------------------------------------------------
    console.log('\n--- 3. Moi san pham mot bo thuoc tinh khac nhau (schema-less) ---');
    await call('PUT', `/api/admin/products/${B.id}/attributes`, {
      attributes: { 'Dung lượng pin': '5000mAh', 'Chống nước': 'true' },
    });
    const ctB = await call('GET', `/api/products/${B.id}`);
    const attrsB = ctB.body?.data?.attributes ?? {};
    check('San pham B co bo thuoc tinh KHAC han A',
      'Dung lượng pin' in attrsB && !('Xuất xứ' in attrsB), JSON.stringify(attrsB));
    check('"true" duoc luu thanh boolean', attrsB['Chống nước'] === true, `nhan ${typeof attrsB['Chống nước']}`);

    // ------------------------------------------------------------------
    console.log('\n--- 4. Sua va xoa thuoc tinh ---');
    const sua = await call('PUT', `/api/admin/products/${A.id}/attributes`, {
      attributes: { 'Mô tả': 'Đã cập nhật mô tả mới', 'Xuất xứ': null },
    });
    const a2 = sua.body?.data?.attributes ?? {};
    check('Sua duoc gia tri', a2['Mô tả'] === 'Đã cập nhật mô tả mới');
    check('Gui null la XOA thuoc tinh', !('Xuất xứ' in a2), JSON.stringify(a2));
    check('Thuoc tinh khong dong toi van con', a2['Khối lượng'] === 250);

    // ------------------------------------------------------------------
    console.log('\n--- 5. Chan ghi de thuoc tinh loi ---');
    for (const khoa of ['id', 'final_price', 'title', 'stock']) {
      const r = await call('PUT', `/api/admin/products/${A.id}/attributes`, { attributes: { [khoa]: 'pha hoai' } });
      check(`Chan ghi de "${khoa}" -> 400`, r.status === 400, `nhan ${r.status}`);
    }
    const conNguyen = await call('GET', `/api/products/${A.id}`);
    check('Gia san pham khong bi hong sau khi thu ghi de',
      typeof conNguyen.body?.data?.final_price === 'number', `nhan ${typeof conNguyen.body?.data?.final_price}`);

    // ------------------------------------------------------------------
    console.log('\n--- 6. Kiem tra dau vao ---');
    const tenRong = await call('PUT', `/api/admin/products/${A.id}/attributes`, { attributes: { '   ': 'x' } });
    check('Ten thuoc tinh rong -> 400', tenRong.status === 400, `nhan ${tenRong.status}`);

    const quaDai = await call('PUT', `/api/admin/products/${A.id}/attributes`, { attributes: { ['k'.repeat(60)]: 'x' } });
    check('Ten qua dai -> 400', quaDai.status === 400, `nhan ${quaDai.status}`);

    const quaNhieu = {};
    for (let i = 0; i < 40; i++) quaNhieu['tt' + i] = 'v';
    const nhieu = await call('PUT', `/api/admin/products/${A.id}/attributes`, { attributes: quaNhieu });
    check('Qua nhieu thuoc tinh -> 400', nhieu.status === 400, `nhan ${nhieu.status}`);

    const khongToken = await api(null)('PUT', `/api/admin/products/${A.id}/attributes`, { attributes: { x: '1' } });
    check('Khong co token -> 401', khongToken.status === 401, `nhan ${khongToken.status}`);
  } finally {
    // Trả 2 sản phẩm về đúng bộ thuộc tính ban đầu
    for (const p of [A, B]) {
      const hienTai = (await s.run(`MATCH (p:Product {id:$id}) RETURN properties(p) AS props`, { id: p.id }))
        .records[0].get('props');
      const xoa = {};
      Object.keys(hienTai).forEach((k) => { if (!(k in goc[p.id])) xoa[k] = null; });
      if (Object.keys(xoa).length) await s.run(`MATCH (p:Product {id:$id}) SET p += $xoa`, { id: p.id, xoa });
      await s.run(`MATCH (p:Product {id:$id}) SET p += $goc`, { id: p.id, goc: goc[p.id] });
    }
    const sau = (await s.run(`MATCH (p:Product {id:$id}) RETURN properties(p) AS props`, { id: A.id }))
      .records[0].get('props');
    check('Da tra san pham ve nguyen trang',
      JSON.stringify(Object.keys(sau).sort()) === JSON.stringify(Object.keys(goc[A.id]).sort()),
      JSON.stringify(Object.keys(sau)));

    await s.run(`MATCH (c:Customer {customer_id:$id}) REMOVE c.role`, { id: cid });
    await s.run(`MATCH (c:Customer {customer_id:$id})-[h:HAS_ROLE]->(:Role) DELETE h`, { id: cid });
    await s.close();
    await closeDriver();
  }

  console.log(`\n=====================================`);
  console.log(`DAT: ${dat} | HONG: ${hong}`);
  process.exit(hong > 0 ? 1 : 0);
})().catch((e) => { console.error('LOI:', e.message); process.exit(1); });
