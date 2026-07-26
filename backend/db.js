const neo4j = require('neo4j-driver');
require('dotenv').config();

const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, NEO4J_DATABASE } = process.env;

// Để trống NEO4J_DATABASE -> dùng database mặc định (home database) của tài khoản.
// Aura đặt tên database trùng instance id, Neo4j Desktop mặc định là "neo4j",
// nên hardcode một tên cụ thể sẽ hỏng khi đổi môi trường.
const database = NEO4J_DATABASE || undefined;

// Khởi tạo Neo4j Driver
// disableLosslessIntegers: trả về số JS thường thay vì object Integer {low, high}
// -> JSON gửi cho frontend gọn và đúng kiểu.
const driver = neo4j.driver(
  NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(NEO4J_USERNAME || 'neo4j', NEO4J_PASSWORD || 'password'),
  { disableLosslessIntegers: true }
);

/**
 * Hàm kiểm tra kết nối tới Neo4j database
 */
const verifyConnection = async () => {
  try {
    const serverInfo = await driver.getServerInfo();
    console.log('✅ [Neo4j] Kết nối thành công tới Database!');
    console.log(`   Address: ${serverInfo.address} | Agent: ${serverInfo.agent}`);
    return true;
  } catch (error) {
    console.error('❌ [Neo4j] Lỗi kết nối tới Database:');
    console.error(`   ${error.message}`);
    return false;
  }
};

/**
 * Chạy 1 câu Cypher đọc dữ liệu và trả về mảng object thuần.
 * Tự mở/đóng session nên các route không cần quan tâm vòng đời session.
 */
const readQuery = async (cypher, params = {}) => {
  const session = driver.session({ database, defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => record.toObject());
  } finally {
    await session.close();
  }
};

/** Tương tự readQuery nhưng dùng cho câu lệnh ghi (CREATE/MERGE/SET). */
const writeQuery = async (cypher, params = {}) => {
  const session = driver.session({ database, defaultAccessMode: neo4j.session.WRITE });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => record.toObject());
  } finally {
    await session.close();
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
  database,
  verifyConnection,
  readQuery,
  writeQuery,
  closeDriver,
  int: neo4j.int,
};
