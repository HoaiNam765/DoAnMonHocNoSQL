const express = require('express');
const cors = require('cors');
require('./loadEnv');

const { verifyConnection, closeDriver } = require('./db');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const chatRoutes = require('./routes/chat');
const eventRoutes = require('./routes/events');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
//
// CORS: chạy ở máy mình thì mở cho tất cả cho tiện (địa chỉ LAN đổi liên tục khi
// bạn bè vào thử bằng điện thoại). Lên server thật thì PHẢI giới hạn — để mở
// nghĩa là bất kỳ trang web nào cũng gọi được API này bằng phiên đăng nhập của
// khách đang mở tab.
//
// Khai báo CORS_ORIGIN bằng danh sách tên miền, ngăn cách bởi dấu phẩy:
//   CORS_ORIGIN=https://shop.vercel.app,https://shop-git-main.vercel.app
const danhSachOrigin = String(process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (danhSachOrigin.length > 0) {
  app.use(
    cors({
      origin: (origin, callback) => {
        // Không có origin = gọi từ curl, Postman, hoặc chính máy chủ — cho qua.
        // Webhook của SePay cũng rơi vào nhóm này.
        if (!origin || danhSachOrigin.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS: tên miền ${origin} không được phép`));
      },
    })
  );
  console.log(`🔒 [CORS] Chỉ cho phép: ${danhSachOrigin.join(', ')}`);
} else {
  app.use(cors());
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  [CORS] Đang mở cho MỌI tên miền. Hãy khai báo CORS_ORIGIN khi chạy thật.');
  }
}

app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Welcome to Fullstack Express & Neo4j API Server',
    endpoints: [
      'GET  /api/products?page=&limit=&search=',
      'GET  /api/products/popular?limit=',
      'GET  /api/products/:id',
      'GET  /api/products/:id/recommendations?limit=',
      'GET  /api/customers?page=&limit=&search=',
      'GET  /api/customers/:id',
      'GET  /api/customers/:id/recommendations?limit=',
      'POST /api/auth/sync',
      'GET  /api/auth/me',
      'POST /api/customers/me/buy/:productId',
      'GET    /api/customers/me/profile',
      'PATCH  /api/customers/me/profile',
      'GET    /api/cart',
      'POST   /api/cart/items',
      'PATCH  /api/cart/items/:productId',
      'DELETE /api/cart/items/:productId',
      'POST   /api/orders',
      'GET    /api/orders',
      'GET    /api/orders/:orderId',
      'POST   /api/orders/:orderId/cancel',
      'GET    /api/admin/orders?status=',
      'POST   /api/admin/orders/:orderId/mark-paid',
      'ADMIN endpoints at /api/admin/*',
      'POST   /api/chat',
      'POST   /api/events/ticket',
      'GET    /api/events/stream?ticket=  (SSE — đẩy sự kiện đơn hàng thời gian thực)',
    ],
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/events', eventRoutes);
// Webhook do máy chủ SePay gọi vào — không dùng Firebase token, tự xác thực
// bằng khoá riêng trong chính route đó.
app.use('/api/webhooks', webhookRoutes);

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

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [Server] Đang chạy tại http://0.0.0.0:${PORT}`);
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
