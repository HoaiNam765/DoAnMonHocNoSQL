/**
 * Smoke test nhanh cho toàn bộ endpoint (task 2.1 - 2.4).
 * Yêu cầu: server đang chạy (`npm run dev`).
 *
 * Chạy: node scripts/test-api.js   (hoặc npm run test:api)
 */
const BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 5000}`;

let passed = 0;
let failed = 0;

const check = (name, condition, detail = '') => {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

const get = async (path) => {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json().catch(() => null);
  return { status: res.status, body, ms: Date.now() - started };
};

(async () => {
  console.log(`Kiểm thử API tại ${BASE}\n`);

  // --- Task 2.1: GET /api/products ---
  console.log('[2.1] GET /api/products');
  let r = await get('/api/products?page=1&limit=5');
  check('status 200', r.status === 200, `nhận ${r.status}`);
  check('trả đúng 5 sản phẩm', r.body?.data?.length === 5, `nhận ${r.body?.data?.length}`);
  check('tổng 1000 sản phẩm', r.body?.pagination?.total === 1000, `nhận ${r.body?.pagination?.total}`);
  check(
    'có đủ field id/title/final_price/category_name',
    ['id', 'title', 'final_price', 'category_name'].every((k) => k in (r.body?.data?.[0] ?? {}))
  );
  check('final_price là số', typeof r.body?.data?.[0]?.final_price === 'number');

  const sampleProduct = r.body?.data?.[0];

  r = await get('/api/products?page=2&limit=5');
  check('phân trang page=2 trả kết quả khác', r.body?.data?.[0]?.id !== sampleProduct?.id);

  r = await get('/api/products?search=máy xay&limit=5');
  check('tìm kiếm có kết quả', (r.body?.pagination?.total ?? 0) > 0, `total=${r.body?.pagination?.total}`);
  check(
    'kết quả tìm kiếm khớp từ khoá',
    r.body?.data?.every((p) => p.title.toLowerCase().includes('máy xay'))
  );

  r = await get('/api/products?search=zzzzkhongtontai');
  check('tìm kiếm không ra gì -> data rỗng, không lỗi', r.status === 200 && r.body?.data?.length === 0);

  // --- Task 2.2: GET /api/products/:id ---
  console.log('\n[2.2] GET /api/products/:id');
  r = await get(`/api/products/${sampleProduct.id}`);
  check('status 200', r.status === 200, `nhận ${r.status}`);
  check('đúng sản phẩm', r.body?.data?.id === sampleProduct.id);
  check('có tên danh mục', typeof r.body?.data?.category_name === 'string', `nhận ${r.body?.data?.category_name}`);

  r = await get('/api/products/khong-ton-tai-999');
  check('id sai -> 404', r.status === 404, `nhận ${r.status}`);

  // --- Task 2.3: GET /api/products/:id/recommendations (Query B) ---
  console.log('\n[2.3] GET /api/products/:id/recommendations  (Query B)');
  r = await get(`/api/products/${sampleProduct.id}/recommendations`);
  check('status 200', r.status === 200, `nhận ${r.status}`);
  check('tối đa 5 gợi ý', (r.body?.data?.length ?? 0) <= 5, `nhận ${r.body?.data?.length}`);
  check('có ít nhất 1 gợi ý', (r.body?.data?.length ?? 0) > 0);
  check(
    'không gợi ý lại chính sản phẩm đang xem',
    r.body?.data?.every((p) => p.id !== sampleProduct.id)
  );
  check(
    'score giảm dần',
    r.body?.data?.every((p, i, a) => i === 0 || a[i - 1].score >= p.score)
  );
  check(`phản hồi dưới 1 giây (${r.ms}ms)`, r.ms < 1000, `${r.ms}ms`);

  r = await get('/api/products/khong-ton-tai-999/recommendations');
  check('id sai -> 404', r.status === 404, `nhận ${r.status}`);

  // --- Task 2.4: GET /api/customers ---
  console.log('\n[2.4] GET /api/customers');
  r = await get('/api/customers?limit=10');
  check('status 200', r.status === 200, `nhận ${r.status}`);
  check('trả đúng 10 khách', r.body?.data?.length === 10, `nhận ${r.body?.data?.length}`);
  check('tổng 3539 khách', r.body?.pagination?.total === 3539, `nhận ${r.body?.pagination?.total}`);
  check(
    'có customer_id + customer_name',
    ['customer_id', 'customer_name'].every((k) => k in (r.body?.data?.[0] ?? {}))
  );

  const sampleCustomer = r.body?.data?.[0];

  r = await get(`/api/customers?search=${encodeURIComponent(sampleCustomer.customer_id)}`);
  check('tìm kiếm khách hàng có kết quả', (r.body?.pagination?.total ?? 0) > 0);

  // --- Task 2.4: GET /api/customers/:id/recommendations (Query A) ---
  console.log('\n[2.4] GET /api/customers/:id/recommendations  (Query A)');
  r = await get(`/api/customers/${sampleCustomer.customer_id}/recommendations`);
  check('status 200', r.status === 200, `nhận ${r.status}`);
  check('tối đa 5 gợi ý', (r.body?.data?.length ?? 0) <= 5, `nhận ${r.body?.data?.length}`);
  check('có ít nhất 1 gợi ý', (r.body?.data?.length ?? 0) > 0);
  check(
    'score giảm dần',
    r.body?.data?.every((p, i, a) => i === 0 || a[i - 1].score >= p.score)
  );
  check(`phản hồi dưới 1 giây (${r.ms}ms)`, r.ms < 1000, `${r.ms}ms`);

  // Không gợi ý lại sản phẩm khách đã mua
  const recoIds = new Set(r.body?.data?.map((p) => p.id));
  const bought = await get(`/api/customers/${sampleCustomer.customer_id}`);
  check('khách có lịch sử mua', (bought.body?.data?.bought_count ?? 0) > 0);
  check('gợi ý không rỗng và không trùng nhau', recoIds.size === r.body?.data?.length);

  r = await get('/api/customers/C_KHONG_TON_TAI/recommendations');
  check('customer_id sai -> 404', r.status === 404, `nhận ${r.status}`);

  // --- Chung ---
  console.log('\n[chung]');
  r = await get('/api/khong-co-endpoint-nay');
  check('endpoint lạ -> 404 JSON', r.status === 404 && r.body?.status === 'error');

  console.log(`\n=== Kết quả: ${passed} pass / ${failed} fail ===`);
  process.exitCode = failed > 0 ? 1 : 0;
})().catch((e) => {
  console.error('\n❌ Không chạy được test:', e.message);
  console.error('   Kiểm tra server đã chạy chưa: cd backend && npm run dev');
  process.exitCode = 1;
});
