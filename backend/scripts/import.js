/**
 * Xoá sạch database Neo4j và import lại toàn bộ dữ liệu từ thư mục `data2/`.
 *
 * Dùng driver trực tiếp thay vì LOAD CSV để không phải public 6 file CSV lên
 * GitHub raw (task 1.3 của kế hoạch) — chạy được ngay từ máy local với Aura.
 *
 * Schema chuẩn sau khi import (đúng mục 4 của kế hoạch):
 *   (:Product   {id, title, final_price, rating, image})
 *   (:Category  {category_id, category_name})
 *   (:Customer  {customer_id, customer_name})
 *   (:Product)-[:BELONGS_TO]->(:Category)
 *   (:Customer)-[:BOUGHT {rating_stars}]->(:Product)
 *   (:Customer)-[:VIEWED]->(:Product)
 *
 * Chạy: node scripts/import.js
 * Thêm cờ --raw để import file bought gốc thay vì file đã bổ sung mô phỏng.
 */
const path = require('path');
const { readCsv } = require('./lib/csv');
const { driver, closeDriver } = require('../db');

const DATA_DIR = path.join(__dirname, '..', '..', 'data2');
const USE_RAW_BOUGHT = process.argv.includes('--raw');
const BATCH_SIZE = 1000;

const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};
const toFloat = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

/** Chạy 1 câu Cypher với UNWIND $rows theo từng lô, in tiến độ. */
const runBatched = async (session, label, cypher, rows) => {
  const started = Date.now();
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await session.run(cypher, { rows: rows.slice(i, i + BATCH_SIZE) });
    process.stdout.write(`\r   ${label}: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }
  console.log(`\r   ${label}: ${rows.length}/${rows.length} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
};

const wipe = async (session) => {
  console.log('\n[1/3] Dọn dẹp database cũ...');

  // Xoá hết constraint + index cũ (kể cả rác trên các label tên file *.csv)
  const constraints = await session.run('SHOW CONSTRAINTS YIELD name RETURN name');
  for (const r of constraints.records) {
    await session.run(`DROP CONSTRAINT \`${r.get('name')}\` IF EXISTS`);
  }
  console.log(`   Đã xoá ${constraints.records.length} constraint`);

  const indexes = await session.run("SHOW INDEXES YIELD name, type WHERE type <> 'LOOKUP' RETURN name");
  for (const r of indexes.records) {
    await session.run(`DROP INDEX \`${r.get('name')}\` IF EXISTS`);
  }
  console.log(`   Đã xoá ${indexes.records.length} index`);

  // Xoá node theo lô để không vỡ bộ nhớ trên Aura Free
  await session.run('MATCH (n) CALL { WITH n DETACH DELETE n } IN TRANSACTIONS OF 5000 ROWS');
  const left = await session.run('MATCH (n) RETURN count(n) AS c');
  console.log(`   Node còn lại: ${left.records[0].get('c')}`);
};

const createConstraints = async (session) => {
  console.log('\n[2/3] Tạo ràng buộc duy nhất...');
  const stmts = [
    'CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT category_id_unique IF NOT EXISTS FOR (c:Category) REQUIRE c.category_id IS UNIQUE',
    'CREATE CONSTRAINT customer_id_unique IF NOT EXISTS FOR (c:Customer) REQUIRE c.customer_id IS UNIQUE',
  ];
  for (const s of stmts) await session.run(s);
  console.log(`   Đã tạo ${stmts.length} constraint`);
};

const importData = async (session) => {
  console.log('\n[3/3] Import dữ liệu...');

  const boughtFile = USE_RAW_BOUGHT ? 'bought_relations.csv' : 'bought_relations_full.csv';
  console.log(`   (nguồn BOUGHT: ${boughtFile})`);

  const products = readCsv(path.join(DATA_DIR, 'products.csv')).map((r) => ({
    id: r.id,
    title: r.title,
    final_price: toInt(r.final_price),
    rating: toFloat(r.rating),
    image: r.image,
  }));
  const categories = readCsv(path.join(DATA_DIR, 'categories.csv')).map((r) => ({
    category_id: r.category_id,
    category_name: r.category_name,
  }));
  const customers = readCsv(path.join(DATA_DIR, 'customers.csv')).map((r) => ({
    customer_id: r.customer_id,
    customer_name: r.customer_name,
  }));
  const belongsTo = readCsv(path.join(DATA_DIR, 'product_category_relations.csv'));
  const bought = readCsv(path.join(DATA_DIR, boughtFile)).map((r) => ({
    customer_id: r.customer_id,
    product_id: r.product_id,
    rating_stars: toInt(r.rating_stars),
  }));
  const viewed = readCsv(path.join(DATA_DIR, 'viewed_relations.csv'));

  await runBatched(
    session,
    'Product ',
    `UNWIND $rows AS row
     MERGE (p:Product {id: row.id})
     SET p.title = row.title,
         p.final_price = row.final_price,
         p.rating = row.rating,
         p.image = row.image`,
    products
  );

  await runBatched(
    session,
    'Category',
    `UNWIND $rows AS row
     MERGE (c:Category {category_id: row.category_id})
     SET c.category_name = row.category_name`,
    categories
  );

  await runBatched(
    session,
    'Customer',
    `UNWIND $rows AS row
     MERGE (c:Customer {customer_id: row.customer_id})
     SET c.customer_name = row.customer_name`,
    customers
  );

  await runBatched(
    session,
    'BELONGS_TO',
    `UNWIND $rows AS row
     MATCH (p:Product {id: row.product_id})
     MATCH (c:Category {category_id: row.category_id})
     MERGE (p)-[:BELONGS_TO]->(c)`,
    belongsTo
  );

  await runBatched(
    session,
    'BOUGHT  ',
    `UNWIND $rows AS row
     MATCH (cu:Customer {customer_id: row.customer_id})
     MATCH (p:Product {id: row.product_id})
     MERGE (cu)-[b:BOUGHT]->(p)
     SET b.rating_stars = row.rating_stars`,
    bought
  );

  await runBatched(
    session,
    'VIEWED  ',
    `UNWIND $rows AS row
     MATCH (cu:Customer {customer_id: row.customer_id})
     MATCH (p:Product {id: row.product_id})
     MERGE (cu)-[:VIEWED]->(p)`,
    viewed
  );
};

const verify = async (session) => {
  const result = await session.run(`
    CALL { MATCH (p:Product) RETURN count(p) AS product }
    CALL { MATCH (c:Category) RETURN count(c) AS category }
    CALL { MATCH (c:Customer) RETURN count(c) AS customer }
    CALL { MATCH ()-[r:BELONGS_TO]->() RETURN count(r) AS belongs_to }
    CALL { MATCH ()-[r:BOUGHT]->() RETURN count(r) AS bought }
    CALL { MATCH ()-[r:VIEWED]->() RETURN count(r) AS viewed }
    RETURN product, category, customer, belongs_to, bought, viewed
  `);
  const row = result.records[0].toObject();

  console.log('\n--- Đối chiếu số lượng (checklist mục 7) ---');
  for (const [key, value] of Object.entries(row)) {
    console.log(`   ${key.padEnd(12)}: ${value}`);
  }

  const labels = await session.run('CALL db.labels() YIELD label RETURN collect(label) AS l');
  const types = await session.run(
    'CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS r'
  );
  console.log(`   labels      : ${labels.records[0].get('l').join(', ')}`);
  console.log(`   rel types   : ${types.records[0].get('r').join(', ')}`);
};

(async () => {
  const session = driver.session();
  try {
    await driver.getServerInfo();
    console.log('✅ [Neo4j] Kết nối thành công.');
    await wipe(session);
    await createConstraints(session);
    await importData(session);
    await verify(session);
    console.log('\n🎉 Import hoàn tất.');
  } catch (error) {
    console.error('\n❌ Import thất bại:', error.message);
    process.exitCode = 1;
  } finally {
    await session.close();
    await closeDriver();
  }
})();
