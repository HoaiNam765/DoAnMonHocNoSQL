/**
 * Tạo ràng buộc cho thanh toán chuyển khoản.
 *
 * VÌ SAO BẮT BUỘC CHẠY: câu PAYMENT_TX_RECORD dùng MERGE theo tx_id để chặn xử
 * lý trùng. Nhưng MERGE chỉ thật sự an toàn khi có ràng buộc UNIQUE — không có
 * nó, hai webhook về CÙNG LÚC cho một giao dịch có thể tạo ra hai node, và cả
 * hai đều tưởng mình là lần đầu. Hậu quả: một lần chuyển tiền bị xử lý hai lần.
 *
 * Chạy: npm run setup:payment
 */
require('dotenv').config();
const { driver, closeDriver } = require('../db');

(async () => {
  const session = driver.session();

  try {
    console.log('Đang tạo ràng buộc cho giao dịch thanh toán...');

    await session.run(`
      CREATE CONSTRAINT payment_tx_id_unique IF NOT EXISTS
      FOR (t:PaymentTx) REQUIRE t.tx_id IS UNIQUE
    `);
    console.log('  ✅ payment_tx_id_unique');

    const rows = await session.run(`SHOW CONSTRAINTS YIELD name WHERE name = 'payment_tx_id_unique' RETURN name`);
    if (rows.records.length === 0) {
      console.error('  ⚠️  Không xác nhận được ràng buộc — kiểm tra lại quyền trên Neo4j');
      process.exitCode = 1;
    } else {
      console.log('\nXong. Giờ webhook SePay đã an toàn trước việc gửi lại nhiều lần.');
    }
  } catch (err) {
    console.error('Lỗi:', err.message);
    process.exitCode = 1;
  } finally {
    await session.close();
    await closeDriver();
  }
})();
