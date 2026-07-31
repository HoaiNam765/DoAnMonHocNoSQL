/**
 * Script gán quyền Admin cho tài khoản người dùng trong Neo4j.
 * Chạy: npm run setup:admin <email_hoac_customer_id>
 * Ví dụ: node scripts/setup-admin.js admin@gmail.com
 */
const { writeQuery, readQuery, closeDriver } = require('../db');
const q = require('../queries/cypher');

const targetParam = process.argv[2] ? process.argv[2].trim() : '';

(async () => {
  try {
    console.log('🔧 Bắt đầu cấu hình tài khoản Admin...');

    let customerIdToPromote = null;

    if (targetParam) {
      // Tìm theo customer_id hoặc email
      const findRes = await readQuery(
        `MATCH (c:Customer)
         WHERE c.customer_id = $param OR c.email = $param OR c.firebase_uid = $param
         RETURN c.customer_id AS customer_id, c.customer_name AS customer_name, c.email AS email`,
        { param: targetParam }
      );

      if (findRes.length === 0) {
        console.log(`⚠️ Không tìm thấy Customer với thông tin '${targetParam}'.`);
        console.log('💡 Vui lòng đăng ký / đăng nhập tài khoản trên Web trước, sau đó chạy lại lệnh này.');
        return;
      }
      customerIdToPromote = findRes[0].customer_id;
      console.log(`🎯 Tìm thấy tài khoản: ${findRes[0].customer_name} (${findRes[0].email || customerIdToPromote})`);
    } else {
      // Lấy tài khoản đầu tiên có email (đã từng đăng ký qua Auth)
      const findAny = await readQuery(
        `MATCH (c:Customer)
         WHERE c.email IS NOT NULL AND trim(c.email) <> ''
         RETURN c.customer_id AS customer_id, c.customer_name AS customer_name, c.email AS email
         LIMIT 1`
      );

      if (findAny.length > 0) {
        customerIdToPromote = findAny[0].customer_id;
        console.log(`🎯 Chọn tài khoản có email đầu tiên: ${findAny[0].customer_name} (${findAny[0].email})`);
      } else {
        console.log('⚠️ Chưa có tài khoản người dùng nào đăng ký qua Auth trong database.');
        console.log('💡 Vui lòng đăng ký tài khoản trên Web trước, sau đó chạy: npm run setup:admin <email>');
        return;
      }
    }

    if (customerIdToPromote) {
      const updateRes = await writeQuery(q.ADMIN_UPDATE_USER_ROLE, {
        customerId: customerIdToPromote,
        role: 'admin',
      });

      console.log(`✅ Đã nâng cấp thành công tài khoản '${customerIdToPromote}' lên vai trò: ADMIN!`);
      console.log(`   Thông tin cập nhật:`, updateRes[0]);
    }
  } catch (err) {
    console.error('❌ Lỗi thiết lập Admin:', err.message);
    process.exitCode = 1;
  } finally {
    await closeDriver();
  }
})();
