const neo4j = require('neo4j-driver');
require('dotenv').config();

const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;

// Khởi tạo Neo4j Driver
const driver = neo4j.driver(
  NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(NEO4J_USERNAME || 'neo4j', NEO4J_PASSWORD || 'password')
);

/**
 * Hàm kiểm tra kết nối tới Neo4j database
 */
const verifyConnection = async () => {
  try {
    const serverInfo = await driver.getServerInfo();
    console.log('✅ [Neo4j] Kết nối thành công tới Database!');
    console.log(`   Address: ${serverInfo.address} | Agent: ${serverInfo.agent}`);
  } catch (error) {
    console.error('❌ [Neo4j] Lỗi kết nối tới Database:');
    console.error(`   ${error.message}`);
  }
};

/**
 * Hàm đóng driver khi ứng dụng tắt
 */
const closeDriver = async () => {
  await driver.close();
};

module.exports = {
  driver,
  verifyConnection,
  closeDriver,
};
