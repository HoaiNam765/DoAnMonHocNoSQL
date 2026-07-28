/**
 * Task A2 — Tạo constraint UNIQUE cho firebase_uid trên node Customer.
 * Chạy: npm run setup:auth  (hoặc node scripts/setup-auth.js)
 *
 * An toàn khi chạy nhiều lần (IF NOT EXISTS).
 */
const { writeQuery, closeDriver } = require('../db');

const CONSTRAINT_QUERY = `
CREATE CONSTRAINT customer_firebase_uid_unique IF NOT EXISTS
FOR (c:Customer) REQUIRE c.firebase_uid IS UNIQUE
`;

const VERIFY_QUERY = `SHOW CONSTRAINTS`;

(async () => {
  try {
    console.log('🔧 Đang tạo constraint customer_firebase_uid_unique...');
    await writeQuery(CONSTRAINT_QUERY);
    console.log('✅ Constraint đã được tạo (hoặc đã tồn tại).');

    console.log('\n📋 Danh sách constraints hiện tại:');
    const constraints = await writeQuery(VERIFY_QUERY);
    constraints.forEach((c) => {
      console.log(`   - ${c.name}: ${c.type} on ${c.labelsOrTypes} (${c.properties})`);
    });

    // Kiểm tra số lượng Customer không đổi
    const countResult = await writeQuery('MATCH (c:Customer) RETURN count(c) AS total');
    console.log(`\n👥 Tổng số Customer: ${countResult[0]?.total}`);

  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exitCode = 1;
  } finally {
    await closeDriver();
  }
})();
