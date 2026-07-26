const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { verifyConnection, closeDriver } = require('./db');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome to Fullstack Express & Neo4j API Server',
    endpoints: [
      'GET /api/products?page=&limit=&search=',
      'GET /api/products/:id',
      'GET /api/products/:id/recommendations?limit=',
      'GET /api/customers?page=&limit=&search=',
      'GET /api/customers/:id',
      'GET /api/customers/:id/recommendations?limit=',
    ],
  });
});

app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);

// 404 cho các đường dẫn không khớp route nào
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Không có endpoint ${req.method} ${req.originalUrl}`,
  });
});

// Error handler tập trung — mọi lỗi trong route async đều rơi về đây
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[Error]', err);
  res.status(status).json({
    status: 'error',
    message: status >= 500 ? 'Lỗi máy chủ nội bộ' : err.message,
  });
});

// Khởi chạy Server
const startServer = async () => {
  // Test connection tới Neo4j trước khi lắng nghe request
  const connected = await verifyConnection();
  if (!connected) {
    console.error('⚠️  Server vẫn khởi động nhưng mọi request /api sẽ trả lỗi 500.');
    console.error('   Kiểm tra lại NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD trong backend/.env');
    console.error('   và chắc chắn instance Aura không ở trạng thái paused.');
  }

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
