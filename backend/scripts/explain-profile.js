/**
 * Task 2.6 — EXPLAIN / PROFILE cho Query A & Query B
 *
 * Script này:
 *   1. Kiểm tra các unique constraint / index đã tồn tại chưa
 *      (Product.id, Customer.customer_id, Category.category_id).
 *   2. Chạy EXPLAIN cho Query A (collaborative filtering) & Query B (co-purchase)
 *      → in kế hoạch thực thi (execution plan) để chứng minh dùng Index Seek.
 *   3. Chạy PROFILE cho Query A & Query B
 *      → in số db hits thực tế và thời gian chạy, chứng minh < 1 giây.
 *
 * Cách chạy:
 *   cd backend
 *   node scripts/explain-profile.js
 *
 * Kết quả có thể copy trực tiếp vào báo cáo đồ án (Tiêu chí 3).
 */
const { driver, closeDriver, int } = require('../db');

// ─── Câu Cypher gốc (copy từ queries/cypher.js) ─────────────────────────────
// Giữ nguyên ở đây để chạy độc lập, không cần import module queries.

const QUERY_A = `
MATCH (c1:Customer {customer_id: $customerId})-[:BOUGHT]->(p1:Product)
      <-[:BOUGHT]-(c2:Customer)-[:BOUGHT]->(p2:Product)
WHERE c1 <> c2
  AND NOT (c1)-[:BOUGHT]->(p2)
WITH p2, count(DISTINCT c2) AS score
OPTIONAL MATCH (p2)-[:BELONGS_TO]->(cat:Category)
RETURN p2.id            AS id,
       p2.title         AS title,
       p2.final_price   AS final_price,
       p2.rating        AS rating,
       p2.image         AS image,
       cat.category_name AS category_name,
       score
ORDER BY score DESC, coalesce(p2.rating, 0) DESC, p2.id ASC
LIMIT $limit
`;

const QUERY_B = `
MATCH (p1:Product {id: $productId})<-[:BOUGHT]-(c2:Customer)-[:BOUGHT]->(p2:Product)
WHERE p2.id <> $productId
WITH p2, count(DISTINCT c2) AS score
OPTIONAL MATCH (p2)-[:BELONGS_TO]->(cat:Category)
RETURN p2.id            AS id,
       p2.title         AS title,
       p2.final_price   AS final_price,
       p2.rating        AS rating,
       p2.image         AS image,
       cat.category_name AS category_name,
       score
ORDER BY score DESC, coalesce(p2.rating, 0) DESC, p2.id ASC
LIMIT $limit
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEPARATOR = '═'.repeat(80);
const THIN_SEP  = '─'.repeat(80);

/**
 * Đọc đệ quy kế hoạch thực thi từ result.summary.plan hoặc .profile
 * và in ra dạng cây thụt lề (tree), giống Neo4j Browser.
 */
function printPlanTree(plan, indent = 0) {
  if (!plan) return;

  const prefix = '  '.repeat(indent) + (indent > 0 ? '├─ ' : '');
  const op = plan.operatorType || 'Unknown';

  // Thông tin dbHits và rows chỉ có khi chạy PROFILE
  const hits = plan.dbHits != null ? ` | dbHits: ${plan.dbHits}` : '';
  const rows = plan.rows != null ? ` | rows: ${plan.rows}` : '';

  // Các argument quan trọng: Index, LabelName, Details, ...
  const args = plan.arguments || {};
  const details = args.Details || args.details || '';
  const detailStr = details ? ` — ${details}` : '';

  console.log(`${prefix}${op}${detailStr}${hits}${rows}`);

  // Đệ quy in các operator con (children)
  const children = plan.children || [];
  for (const child of children) {
    printPlanTree(child, indent + 1);
  }
}

/**
 * Kiểm tra trong kế hoạch có xuất hiện "NodeIndexSeek" hoặc
 * "NodeUniqueIndexSeek" hay không. Nếu có → Index được tận dụng.
 */
function checkForIndexSeek(plan, found = []) {
  if (!plan) return found;
  const op = (plan.operatorType || '').toLowerCase();
  if (op.includes('indexseek') || op.includes('uniqueindexseek') || op.includes('index seek')) {
    found.push(plan.operatorType);
  }
  for (const child of plan.children || []) {
    checkForIndexSeek(child, found);
  }
  return found;
}

/**
 * Kiểm tra trong kế hoạch có "AllNodesScan" hoặc "NodeByLabelScan" hay không.
 * Nếu có → cảnh báo không dùng Index.
 */
function checkForFullScan(plan, found = []) {
  if (!plan) return found;
  const op = (plan.operatorType || '').toLowerCase();
  if (op.includes('allnodesscan') || op.includes('nodebylabelscan')) {
    const args = plan.arguments || {};
    const details = args.Details || args.details || plan.operatorType;
    found.push(details);
  }
  for (const child of plan.children || []) {
    checkForFullScan(child, found);
  }
  return found;
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  const session = driver.session();
  try {
    await driver.getServerInfo();
    console.log('✅ [Neo4j] Kết nối thành công.\n');

    // ═══════════════════════════════════════════════════════════════════════
    // PHẦN 1: Kiểm tra constraint & index
    // ═══════════════════════════════════════════════════════════════════════
    console.log(SEPARATOR);
    console.log('  PHẦN 1: KIỂM TRA CONSTRAINT & INDEX');
    console.log(SEPARATOR);

    const constraintResult = await session.run(
      'SHOW CONSTRAINTS YIELD name, type, labelsOrTypes, properties RETURN name, type, labelsOrTypes, properties'
    );
    if (constraintResult.records.length === 0) {
      console.log('\n  ⚠️  KHÔNG CÓ constraint nào! Cần chạy lại: npm run import\n');
    } else {
      console.log('\n  Danh sách constraint hiện có:\n');
      console.log('  ' + 'Tên'.padEnd(35) + 'Loại'.padEnd(20) + 'Label'.padEnd(15) + 'Property');
      console.log('  ' + '─'.repeat(85));
      for (const rec of constraintResult.records) {
        const name  = rec.get('name');
        const type  = rec.get('type');
        const label = (rec.get('labelsOrTypes') || []).join(', ');
        const prop  = (rec.get('properties') || []).join(', ');
        console.log(`  ${name.padEnd(35)}${type.padEnd(20)}${label.padEnd(15)}${prop}`);
      }
    }

    const indexResult = await session.run(
      "SHOW INDEXES YIELD name, type, labelsOrTypes, properties, state WHERE type <> 'LOOKUP' RETURN name, type, labelsOrTypes, properties, state"
    );
    if (indexResult.records.length > 0) {
      console.log('\n  Danh sách index hiện có:\n');
      console.log('  ' + 'Tên'.padEnd(35) + 'Loại'.padEnd(15) + 'Label'.padEnd(15) + 'Property'.padEnd(20) + 'State');
      console.log('  ' + '─'.repeat(90));
      for (const rec of indexResult.records) {
        const name  = rec.get('name');
        const type  = rec.get('type');
        const label = (rec.get('labelsOrTypes') || []).join(', ');
        const prop  = (rec.get('properties') || []).join(', ');
        const state = rec.get('state');
        console.log(`  ${name.padEnd(35)}${type.padEnd(15)}${label.padEnd(15)}${prop.padEnd(20)}${state}`);
      }
    }

    // Kiểm tra 3 constraint bắt buộc
    const requiredConstraints = [
      { label: 'Product',  prop: 'id' },
      { label: 'Customer', prop: 'customer_id' },
      { label: 'Category', prop: 'category_id' },
    ];
    console.log('\n  Kiểm tra 3 constraint bắt buộc:');
    for (const { label, prop } of requiredConstraints) {
      const found = constraintResult.records.some((rec) => {
        const labels = rec.get('labelsOrTypes') || [];
        const props  = rec.get('properties') || [];
        return labels.includes(label) && props.includes(prop);
      });
      console.log(`    ${found ? '✅' : '❌'} ${label}(${prop})`);
    }

    // Lấy 1 customerId và 1 productId mẫu để chạy EXPLAIN/PROFILE
    const sampleCustomer = await session.run(
      'MATCH (c:Customer)-[:BOUGHT]->(:Product) WITH c, count(*) AS cnt WHERE cnt > 2 RETURN c.customer_id AS id LIMIT 1'
    );
    const sampleProduct = await session.run(
      'MATCH (:Customer)-[:BOUGHT]->(p:Product) RETURN p.id AS id LIMIT 1'
    );
    const customerId = sampleCustomer.records[0]?.get('id') || 'C001';
    const productId  = sampleProduct.records[0]?.get('id') || '22539952524';

    console.log(`\n  Dữ liệu mẫu dùng để test: customerId = ${customerId}, productId = ${productId}`);

    const params = { customerId, productId, limit: int(5) };

    // ═══════════════════════════════════════════════════════════════════════
    // PHẦN 2: EXPLAIN — Kế hoạch thực thi (không chạy thật)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n' + SEPARATOR);
    console.log('  PHẦN 2: EXPLAIN — KẾ HOẠCH THỰC THI (không chạy thật)');
    console.log(SEPARATOR);

    // --- EXPLAIN Query A ---
    console.log('\n  📋 EXPLAIN Query A (Collaborative Filtering — gợi ý theo khách hàng):');
    console.log(THIN_SEP);
    const explainA = await session.run(`EXPLAIN ${QUERY_A}`, params);
    printPlanTree(explainA.summary.plan);

    const seekA = checkForIndexSeek(explainA.summary.plan);
    const scanA = checkForFullScan(explainA.summary.plan);
    console.log(`\n  → Index Seek: ${seekA.length > 0 ? '✅ CÓ (' + seekA.join(', ') + ')' : '❌ KHÔNG'}`);
    console.log(`  → Full Scan : ${scanA.length > 0 ? '⚠️  CÓ (' + scanA.join(', ') + ')' : '✅ KHÔNG'}`);

    // --- EXPLAIN Query B ---
    console.log('\n  📋 EXPLAIN Query B (Co-purchase — gợi ý mua kèm theo sản phẩm):');
    console.log(THIN_SEP);
    const explainB = await session.run(`EXPLAIN ${QUERY_B}`, params);
    printPlanTree(explainB.summary.plan);

    const seekB = checkForIndexSeek(explainB.summary.plan);
    const scanB = checkForFullScan(explainB.summary.plan);
    console.log(`\n  → Index Seek: ${seekB.length > 0 ? '✅ CÓ (' + seekB.join(', ') + ')' : '❌ KHÔNG'}`);
    console.log(`  → Full Scan : ${scanB.length > 0 ? '⚠️  CÓ (' + scanB.join(', ') + ')' : '✅ KHÔNG'}`);

    // ═══════════════════════════════════════════════════════════════════════
    // PHẦN 3: PROFILE — Chạy thật, đo hiệu năng
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n' + SEPARATOR);
    console.log('  PHẦN 3: PROFILE — CHẠY THẬT, ĐO HIỆU NĂNG');
    console.log(SEPARATOR);

    // --- PROFILE Query A ---
    console.log('\n  ⏱️  PROFILE Query A (Collaborative Filtering):');
    console.log(THIN_SEP);

    const startA = Date.now();
    const profileA = await session.run(`PROFILE ${QUERY_A}`, params);
    const durationA = Date.now() - startA;

    printPlanTree(profileA.summary.profile);

    // Tính tổng db hits
    function totalDbHits(plan) {
      if (!plan) return 0;
      let hits = plan.dbHits || 0;
      for (const child of plan.children || []) {
        hits += totalDbHits(child);
      }
      return hits;
    }

    const hitsA = totalDbHits(profileA.summary.profile);
    console.log(`\n  → Tổng db hits : ${hitsA.toLocaleString()}`);
    console.log(`  → Thời gian     : ${durationA} ms`);
    console.log(`  → Kết quả       : ${profileA.records.length} sản phẩm gợi ý`);
    console.log(`  → Đánh giá      : ${durationA < 1000 ? '✅ ĐẠT (< 1 giây)' : '⚠️  CHẬM (>= 1 giây)'}`);

    // --- PROFILE Query B ---
    console.log('\n  ⏱️  PROFILE Query B (Co-purchase):');
    console.log(THIN_SEP);

    const startB = Date.now();
    const profileB = await session.run(`PROFILE ${QUERY_B}`, params);
    const durationB = Date.now() - startB;

    printPlanTree(profileB.summary.profile);

    const hitsB = totalDbHits(profileB.summary.profile);
    console.log(`\n  → Tổng db hits : ${hitsB.toLocaleString()}`);
    console.log(`  → Thời gian     : ${durationB} ms`);
    console.log(`  → Kết quả       : ${profileB.records.length} sản phẩm gợi ý`);
    console.log(`  → Đánh giá      : ${durationB < 1000 ? '✅ ĐẠT (< 1 giây)' : '⚠️  CHẬM (>= 1 giây)'}`);

    // ═══════════════════════════════════════════════════════════════════════
    // TỔNG KẾT
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n' + SEPARATOR);
    console.log('  TỔNG KẾT');
    console.log(SEPARATOR);
    console.log(`
  ┌──────────────────────────────────────────────────────────────┐
  │                    Query A            Query B                │
  │  Thời gian:        ${String(durationA + ' ms').padEnd(18)}${String(durationB + ' ms').padEnd(18)}│
  │  DB Hits:          ${String(hitsA.toLocaleString()).padEnd(18)}${String(hitsB.toLocaleString()).padEnd(18)}│
  │  Kết quả:          ${String(profileA.records.length + ' sản phẩm').padEnd(18)}${String(profileB.records.length + ' sản phẩm').padEnd(18)}│
  │  Index Seek:       ${(seekA.length > 0 ? '✅ Có' : '❌ Không').padEnd(18)}${(seekB.length > 0 ? '✅ Có' : '❌ Không').padEnd(18)}│
  │  < 1 giây:         ${(durationA < 1000 ? '✅ Đạt' : '❌ Không').padEnd(18)}${(durationB < 1000 ? '✅ Đạt' : '❌ Không').padEnd(18)}│
  └──────────────────────────────────────────────────────────────┘
`);

    console.log('  Cú pháp chạy thủ công trong Neo4j Browser (copy vào báo cáo):');
    console.log(THIN_SEP);
    console.log(`
  // EXPLAIN Query A:
  EXPLAIN
  MATCH (c1:Customer {customer_id: '${customerId}'})-[:BOUGHT]->(p1:Product)
        <-[:BOUGHT]-(c2:Customer)-[:BOUGHT]->(p2:Product)
  WHERE c1 <> c2 AND NOT (c1)-[:BOUGHT]->(p2)
  WITH p2, count(DISTINCT c2) AS score
  OPTIONAL MATCH (p2)-[:BELONGS_TO]->(cat:Category)
  RETURN p2.id AS id, p2.title AS title, score
  ORDER BY score DESC LIMIT 5

  // PROFILE Query A:
  PROFILE
  MATCH (c1:Customer {customer_id: '${customerId}'})-[:BOUGHT]->(p1:Product)
        <-[:BOUGHT]-(c2:Customer)-[:BOUGHT]->(p2:Product)
  WHERE c1 <> c2 AND NOT (c1)-[:BOUGHT]->(p2)
  WITH p2, count(DISTINCT c2) AS score
  OPTIONAL MATCH (p2)-[:BELONGS_TO]->(cat:Category)
  RETURN p2.id AS id, p2.title AS title, score
  ORDER BY score DESC LIMIT 5

  // EXPLAIN Query B:
  EXPLAIN
  MATCH (p1:Product {id: '${productId}'})<-[:BOUGHT]-(c2:Customer)-[:BOUGHT]->(p2:Product)
  WHERE p2.id <> '${productId}'
  WITH p2, count(DISTINCT c2) AS score
  OPTIONAL MATCH (p2)-[:BELONGS_TO]->(cat:Category)
  RETURN p2.id AS id, p2.title AS title, score
  ORDER BY score DESC LIMIT 5

  // PROFILE Query B:
  PROFILE
  MATCH (p1:Product {id: '${productId}'})<-[:BOUGHT]-(c2:Customer)-[:BOUGHT]->(p2:Product)
  WHERE p2.id <> '${productId}'
  WITH p2, count(DISTINCT c2) AS score
  OPTIONAL MATCH (p2)-[:BELONGS_TO]->(cat:Category)
  RETURN p2.id AS id, p2.title AS title, score
  ORDER BY score DESC LIMIT 5
`);

    console.log('🎉 Kiểm tra hoàn tất.\n');
  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    process.exitCode = 1;
  } finally {
    await session.close();
    await closeDriver();
  }
})();
