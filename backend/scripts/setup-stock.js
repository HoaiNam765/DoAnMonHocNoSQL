/**
 * Nạp số lượng tồn kho cho các sản phẩm chưa có trường `stock`.
 *
 * VÌ SAO CẦN SCRIPT NÀY:
 * 1.000 sản phẩm nhập từ `products.csv` chỉ có id, tiêu đề, giá, rating, ảnh —
 * không có tồn kho. Trong khi đó trang quản trị lại hiển thị cột "Kho", nên
 * mọi sản phẩm import đều hiện 0 dù thực tế vẫn bán được. Đó là mâu thuẫn giữa
 * giao diện và dữ liệu, phải xử lý bằng một trong hai cách: bỏ cột kho, hoặc
 * nạp dữ liệu tồn kho thật. Nhóm chọn cách thứ hai.
 *
 * CÁCH SINH SỐ LIỆU:
 * Tồn kho tỉ lệ nghịch với mức độ phổ biến — hàng bán chạy thì còn ít, hàng ế
 * thì tồn nhiều. Nhờ vậy con số nhìn hợp lý thay vì ngẫu nhiên đều, và trang
 * "sắp hết hàng" có nội dung để hiển thị.
 *
 * Dùng seed cố định nên chạy lại nhiều lần vẫn ra cùng kết quả.
 *
 * Chạy: npm run setup:stock
 * Thêm cờ --force để ghi đè cả những sản phẩm đã có stock.
 */
const { driver, closeDriver } = require('../db');

const FORCE = process.argv.includes('--force');
const SEED = 20260802;

/** PRNG có seed để kết quả tái lập được. */
const makeRandom = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rnd = makeRandom(SEED);

(async () => {
  const session = driver.session();

  try {
    await driver.getServerInfo();
    console.log('✅ [Neo4j] Kết nối thành công.\n');

    // --- 1. Xem hiện trạng ---
    const before = await session.run(`
      MATCH (p:Product)
      RETURN count(p) AS total,
             count(p.stock) AS has_stock
    `);
    const { total, has_stock } = before.records[0].toObject();
    console.log(`Tổng sản phẩm      : ${total}`);
    console.log(`Đã có tồn kho      : ${has_stock}`);
    console.log(`Chưa có tồn kho    : ${total - has_stock}`);

    if (!FORCE && has_stock === total) {
      console.log('\n→ Mọi sản phẩm đã có tồn kho. Dùng --force nếu muốn nạp lại.');
      return;
    }

    // --- 2. Lấy danh sách cần nạp + số lượt đã bán để suy ra độ phổ biến ---
    const rows = await session.run(
      `
      MATCH (p:Product)
      ${FORCE ? '' : 'WHERE p.stock IS NULL'}
      RETURN p.id AS id, count { (:Customer)-[:BOUGHT]->(p) } AS sold
      `
    );

    const products = rows.records.map((r) => r.toObject());
    if (products.length === 0) {
      console.log('\n→ Không có sản phẩm nào cần nạp.');
      return;
    }

    const maxSold = Math.max(...products.map((p) => p.sold), 1);

    // Hàng càng bán chạy thì tồn càng ít: từ ~20 (hot) tới ~200 (ế)
    const updates = products.map(({ id, sold }) => {
      const popularity = sold / maxSold; // 0..1
      const base = 200 - popularity * 170; // 200 -> 30
      const jitter = 0.75 + rnd() * 0.5; // ±25%
      return { id, stock: Math.max(0, Math.round(base * jitter)) };
    });

    // --- 3. Ghi theo lô ---
    console.log(`\nĐang nạp tồn kho cho ${updates.length} sản phẩm...`);
    const BATCH = 500;
    for (let i = 0; i < updates.length; i += BATCH) {
      await session.run(
        `UNWIND $rows AS row
         MATCH (p:Product {id: row.id})
         SET p.stock = row.stock,
             p.status = coalesce(p.status, 'active')`,
        { rows: updates.slice(i, i + BATCH) }
      );
      process.stdout.write(`\r  ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
    }
    console.log('');

    // --- 4. Đối chiếu ---
    const after = await session.run(`
      MATCH (p:Product)
      RETURN count(p) AS total,
             count(p.stock) AS has_stock,
             min(p.stock) AS min_stock,
             max(p.stock) AS max_stock,
             round(avg(p.stock)) AS avg_stock,
             count(CASE WHEN p.stock <= 10 THEN 1 END) AS low_stock
    `);
    const stats = after.records[0].toObject();

    console.log('\n--- Kết quả ---');
    console.log(`   Sản phẩm có tồn kho : ${stats.has_stock}/${stats.total}`);
    console.log(`   Tồn kho thấp nhất   : ${stats.min_stock}`);
    console.log(`   Tồn kho cao nhất    : ${stats.max_stock}`);
    console.log(`   Trung bình          : ${stats.avg_stock}`);
    console.log(`   Sắp hết (<= 10)     : ${stats.low_stock}`);
    console.log('\n🎉 Hoàn tất.');
  } catch (error) {
    console.error('\n❌ Lỗi:', error.message);
    process.exitCode = 1;
  } finally {
    await session.close();
    await closeDriver();
  }
})();
