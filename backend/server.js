const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { verifyConnection, closeDriver } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome to Fullstack Express & Neo4j API Server'
  });
});

// Khởi chạy Server
const startServer = async () => {
  // Test connection tới Neo4j trước khi lắng nghe request
  await verifyConnection();

  const server = app.listen(PORT, () => {
    console.log(`🚀 [Server] Đang chạy tại http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nĐang đóng các kết nối...');
    await closeDriver();
    server.close(() => {
      console.log('Server đã dừng hoàn tất.');
      process.exit(0);
    });
  });
};

startServer();
