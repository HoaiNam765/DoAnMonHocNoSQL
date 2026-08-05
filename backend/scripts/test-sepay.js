/**
 * Kiểm thử webhook thanh toán SePay.
 *
 * Không cần tài khoản SePay thật: script tự giả lập đúng gói dữ liệu mà SePay
 * gửi tới, theo tài liệu chính thức (docs.sepay.vn).
 *
 * Yêu cầu: server đang chạy, có SEPAY_WEBHOOK_APIKEY trong .env.
 * Chạy: npm run test:sepay
 */
require('dotenv').config();
const admin = require('../firebase');
const { driver, closeDriver } = require('../db');

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const UID = 'test-sepay-khach';
const KHOA = process.env.SEPAY_WEBHOOK_APIKEY;

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
  return (await r.json()).idToken;
};

const api = (token) => async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* trong */ }
  return { status: res.status, body: json };
};

let demTx = 0;
/** Giả lập một gói webhook y như SePay gửi. */
const goiWebhook = async (thayDoi = {}, khoa = KHOA) => {
  demTx += 1;
  const goi = {
    id: `test-tx-${Date.now()}-${demTx}`,
    gateway: 'Vietcombank',
    transactionDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
    accountNumber: '0010000000355',
    code: null,
    content: 'CT DEN:520123 GD BANG QR',
    transferType: 'in',
    transferAmount: 100000,
    accumulated: 5000000,
    referenceCode: 'FT' + Date.now(),
    ...thayDoi,
  };

  const res = await fetch(`${BASE}/api/webhooks/sepay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(khoa ? { Authorization: `Apikey ${khoa}` } : {}) },
    body: JSON.stringify(goi),
  });

  let json = null;
  try { json = await res.json(); } catch { /* trong */ }
  return { status: res.status, body: json, goi };
};

(async () => {
  if (!KHOA) {
    console.error('Thieu SEPAY_WEBHOOK_APIKEY trong backend/.env — dat mot chuoi bat ky roi chay lai.');
    process.exit(1);
  }

  const s = driver.session();
  const cid = `U_${UID}`;

  try {
    const token = await getIdToken(UID);
    const call = api(token);
    await call('POST', '/api/auth/sync');

    await s.run('MATCH (c:Customer {customer_id:$id})-[:PLACED]->(o:Order) DETACH DELETE o', { id: cid });
    await s.run('MATCH (t:PaymentTx) WHERE t.tx_id STARTS WITH "test-tx-" DETACH DELETE t');

    const sp = (await s.run('MATCH (p:Product) WHERE coalesce(p.stock,0) >= 10 RETURN p.id AS id LIMIT 1'))
      .records[0].get('id');

    const datDon = async () => {
      const r = await call('POST', '/api/orders/buy-now', {
        productId: sp, quantity: 1,
        receiverName: 'Test SePay', phone: '0901234567', address: 'So 1 Test',
      });
      return r.body.data;
    };

    // ------------------------------------------------------------------
    console.log('--- 1. Bao ve webhook ---');
    const khongKhoa = await goiWebhook({}, null);
    check('Khong co khoa -> 401', khongKhoa.status === 401, `nhan ${khongKhoa.status}`);

    const khoaSai = await goiWebhook({}, 'khoa-bay-ba-123');
    check('Khoa sai -> 401', khoaSai.status === 401, `nhan ${khoaSai.status}`);

    const khoaSaiDoDai = await goiWebhook({}, KHOA + 'x');
    check('Khoa sai do dai -> 401', khoaSaiDoDai.status === 401, `nhan ${khoaSaiDoDai.status}`);

    // ------------------------------------------------------------------
    console.log('\n--- 2. Chuyen khoan dung -> tu dong danh dau da thanh toan ---');
    const don1 = await datDon();
    const khoTruoc = (await s.run('MATCH (p:Product {id:$id}) RETURN coalesce(p.stock,0) AS s', { id: sp }))
      .records[0].get('s');

    const ok = await goiWebhook({
      content: `CT DEN:520123 ${don1.order_id} GD BANG QR`,
      transferAmount: Number(don1.total),
    });
    check('Webhook tra 200', ok.status === 200, `nhan ${ok.status}`);
    check('Than phan hoi la {success:true}', ok.body?.success === true, JSON.stringify(ok.body));

    const ct1 = await call('GET', `/api/orders/${don1.order_id}`);
    check('Don da chuyen sang PAID', ct1.body?.data?.status === 'PAID', ct1.body?.data?.status);

    const khoSau = (await s.run('MATCH (p:Product {id:$id}) RETURN coalesce(p.stock,0) AS s', { id: sp }))
      .records[0].get('s');
    check('Da tru kho', Number(khoSau) === Number(khoTruoc) - 1, `truoc ${khoTruoc}, sau ${khoSau}`);

    const noi = await s.run('MATCH (o:Order {order_id:$id})-[:PAID_BY]->(t:PaymentTx) RETURN count(t) AS n',
      { id: don1.order_id });
    check('Da noi giao dich voi don (PAID_BY)', Number(noi.records[0].get('n')) === 1);

    // ------------------------------------------------------------------
    console.log('\n--- 3. Chong xu ly trung (SePay gui lai toi 7 lan) ---');
    const don2 = await datDon();
    const goi2 = {
      id: `test-tx-lap-${Date.now()}`,
      content: `CT DEN ${don2.order_id}`,
      transferAmount: Number(don2.total),
    };
    const lan1 = await goiWebhook(goi2);
    const lan2 = await goiWebhook(goi2);
    const lan3 = await goiWebhook(goi2);
    check('Gui lai 3 lan deu tra 200', [lan1, lan2, lan3].every((r) => r.status === 200));

    const soTx = await s.run('MATCH (t:PaymentTx {tx_id:$id}) RETURN count(t) AS n', { id: goi2.id });
    check('Chi ghi nhan DUNG 1 giao dich', Number(soTx.records[0].get('n')) === 1,
      `co ${soTx.records[0].get('n')}`);

    const khoSau2 = (await s.run('MATCH (p:Product {id:$id}) RETURN coalesce(p.stock,0) AS s', { id: sp }))
      .records[0].get('s');
    check('Kho chi bi tru DUNG 1 lan du gui 3 lan',
      Number(khoSau2) === Number(khoSau) - 1, `truoc ${khoSau}, sau ${khoSau2}`);

    // ------------------------------------------------------------------
    console.log('\n--- 4. Cac truong hop khong duoc tu dong duyet ---');
    const don3 = await datDon();
    const thieuTien = await goiWebhook({
      content: `CT DEN ${don3.order_id}`,
      transferAmount: Math.max(1000, Number(don3.total) - 5000),
    });
    check('Chuyen THIEU tien -> van tra 200', thieuTien.status === 200);
    const ct3 = await call('GET', `/api/orders/${don3.order_id}`);
    check('Chuyen thieu tien thi KHONG danh dau da tra', ct3.body?.data?.status === 'PENDING',
      ct3.body?.data?.status);

    const donKhongCo = await goiWebhook({ content: 'CT DEN DHKHONGCO1 abc', transferAmount: 500000 });
    check('Ma don khong ton tai -> 200 (khong bat SePay gui lai)', donKhongCo.status === 200);

    const khongCoMa = await goiWebhook({ content: 'chuyen tien lung tung', transferAmount: 500000 });
    check('Noi dung khong co ma don -> 200', khongCoMa.status === 200);

    const tienRa = await goiWebhook({
      transferType: 'out', content: `CT ${don3.order_id}`, transferAmount: Number(don3.total),
    });
    check('Tien RA khoi tai khoan -> bo qua', tienRa.status === 200);
    const ct3b = await call('GET', `/api/orders/${don3.order_id}`);
    check('Tien ra khong lam don thanh da tra', ct3b.body?.data?.status === 'PENDING', ct3b.body?.data?.status);

    // ------------------------------------------------------------------
    console.log('\n--- 5. Boc ma don tu nhieu dinh dang khac nhau ---');
    const don4 = await datDon();
    const quaCode = await goiWebhook({
      code: don4.order_id, content: 'noi dung khong he co ma', transferAmount: Number(don4.total),
    });
    check('Boc duoc ma tu truong "code" cua SePay', quaCode.status === 200);
    const ct4 = await call('GET', `/api/orders/${don4.order_id}`);
    check('Don duoc danh dau da tra qua truong code', ct4.body?.data?.status === 'PAID', ct4.body?.data?.status);

    const don5 = await datDon();
    const chuThuong = await goiWebhook({
      content: `ct den ${don5.order_id.toLowerCase()} gd qr`, transferAmount: Number(don5.total),
    });
    check('Boc duoc ma viet chu THUONG', chuThuong.status === 200);
    const ct5 = await call('GET', `/api/orders/${don5.order_id}`);
    check('Don viet thuong van duoc danh dau da tra', ct5.body?.data?.status === 'PAID', ct5.body?.data?.status);

    // ------------------------------------------------------------------
    console.log('\n--- 6. Endpoint lay ma QR ---');
    const don6 = await datDon();
    const qr = await call('GET', `/api/orders/${don6.order_id}/payment-qr`);
    check('Lay duoc thong tin QR -> 200', qr.status === 200, `nhan ${qr.status}`);
    if (qr.body?.data?.available) {
      check('QR tro toi qr.sepay.vn', String(qr.body.data.qrUrl).startsWith('https://qr.sepay.vn/img'),
        qr.body.data.qrUrl);
      check('Noi dung chuyen khoan dung bang ma don',
        qr.body.data.transferContent === don6.order_id, qr.body.data.transferContent);
      check('So tien dung bang tong don', Number(qr.body.data.amount) === Number(don6.total));
    } else {
      console.log('  (chua cau hinh SEPAY_ACCOUNT_NUMBER nen tra available=false — dung nhu thiet ke)');
      check('Bao ro la chua bat chuyen khoan', qr.body?.data?.available === false);
    }

    const cuaNguoiKhac = await api(null)('GET', `/api/orders/${don6.order_id}/payment-qr`);
    check('Khong co token -> 401', cuaNguoiKhac.status === 401, `nhan ${cuaNguoiKhac.status}`);

    const qrDonDaTra = await call('GET', `/api/orders/${don1.order_id}/payment-qr`);
    check('Don da thanh toan thi khong tra QR nua -> 400', qrDonDaTra.status === 400, `nhan ${qrDonDaTra.status}`);
  } finally {
    await s.run('MATCH (c:Customer {customer_id:$id})-[:PLACED]->(o:Order) DETACH DELETE o', { id: cid });
    await s.run('MATCH (t:PaymentTx) WHERE t.tx_id STARTS WITH "test-tx-" DETACH DELETE t');
    await s.close();
    await closeDriver();
  }

  console.log(`\n=====================================`);
  console.log(`DAT: ${dat} | HONG: ${hong}`);
  process.exit(hong > 0 ? 1 : 0);
})().catch((e) => { console.error('LOI:', e.message); process.exit(1); });
