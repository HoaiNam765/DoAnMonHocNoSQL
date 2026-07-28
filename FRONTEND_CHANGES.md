# 📝 Nhật ký thay đổi Frontend (Firebase Auth & Chức năng)

## 1. Cài đặt thư viện & Cấu hình (Task A9)
- **Thư viện mới:** Cài đặt `firebase` qua `npm install firebase --save`. (Đã cập nhật thủ công vào `package.json` để khắc phục lỗi không nhận diện module).
- **Tạo `.env.example`**: Định nghĩa mẫu cho các biến môi trường `VITE_FIREBASE_*` cần thiết.
- **Cấu hình Gitignore**: Đã thêm `.env` và `.env.*` vào `frontend/.gitignore` để bảo mật thông tin cấu hình môi trường, tránh bị push nhầm key lên git.
- **Tạo `src/config/firebase.js`**: Khởi tạo `initializeApp` và `getAuth` dựa trên `.env`. Đã khắc phục lỗi trắng trang bằng cách đảm bảo nạp đủ các biến môi trường từ `.env`.

## 2. Quản lý trạng thái xác thực - AuthContext (Task A9)
- **Xóa bỏ:** Component `CustomerContext.jsx` tĩnh cũ đã được loại bỏ để thay thế hoàn toàn bằng luồng đăng nhập thật.
- **Tạo mới `AuthContext.jsx`**:
  - Lắng nghe phiên qua `onAuthStateChanged`.
  - Cung cấp các hàm đăng nhập/đăng ký (`register`, `login`, `loginWithGoogle`, `logout`).
  - Gọi API `POST /api/auth/sync` sau khi người dùng đăng nhập để đồng bộ thông tin `customer` từ Neo4j Backend.
  - Cung cấp hàm `refreshCustomer` để gọi đồng bộ lại sau khi mua hàng.
- **Cập nhật `main.jsx`**: Thay `<CustomerProvider>` bằng `<AuthProvider>`.

## 3. Các trang Đăng nhập / Đăng ký (Task A10)
- **Tạo `src/pages/Login.jsx`**: Giao diện đăng nhập với Email/Mật khẩu và nút "Đăng nhập bằng Google". Xử lý hiển thị thông báo lỗi tiếng Việt thân thiện.
- **Tạo `src/pages/Register.jsx`**: Giao diện đăng ký với Tên hiển thị, Email, Mật khẩu và Xác nhận mật khẩu. Gọi hàm đăng ký và cập nhật Profile.

## 4. Bảo vệ Route & Giao diện Header (Task A11)
- **Tạo `src/components/ProtectedRoute.jsx`**: Component bọc các route cần bảo vệ (chặn hiển thị và `Navigate` về `/login` nếu chưa có user). Hiện tại được tạo sẵn để có thể bọc trang Profile trong tương lai.
- **Cập nhật `AppRouter.jsx`**: Bổ sung Route cho `/login` và `/register`.
- **Cập nhật `Header.jsx` (layouts)**: 
  - Loại bỏ dropdown chọn user cứng cũ.
  - Hiển thị lời chào "Xin chào, [Tên khách hàng]" dựa theo Neo4j hoặc Firebase profile.
  - Hiển thị nút "Đăng nhập" (nếu khách) và nút "Đăng xuất" (nếu đã đăng nhập).

## 5. Xử lý kịch bản người dùng mới (Cold-start) (Task A12)
- **Cập nhật `RecommendationSection.jsx`**:
  - Đọc `customer` từ `AuthContext`.
  - Nếu khách chưa đăng nhập HOẶC `customer.bought_count === 0` -> Gọi API `getPopularProducts` để lấy "🔥 Sản phẩm bán chạy".
  - Nếu khách đã mua hàng -> Gọi API `getCustomerRecommendations` để lấy "🎯 Gợi ý dành cho bạn".

## 6. Chức năng Mua ngay (Task A13)
- **Cập nhật `ProductDetail.jsx`**:
  - Gắn nút "🛒 Mua ngay". 
  - Khi bấm mua:
    - Nếu chưa đăng nhập: `navigate('/login')`.
    - Nếu đã đăng nhập: Gọi API `buyProduct(id, token)`, hiển thị Alert thành công, và gọi `refreshCustomer()` để backend trả về `bought_count` mới ngay lập tức.
  - Cập nhật logic load API Chi tiết sản phẩm để lấy và đính kèm Bearer token (lưu lịch sử xem hàng `VIEWED` vào Backend Neo4j).

## 7. Cập nhật Services API
- **`authService.js` (Mới)**: Hàm `syncUser(token)` gửi `POST /api/auth/sync`.
- **`customerService.js`**: Bổ sung hàm `buyProduct(productId, token)` gửi `POST /api/customers/me/buy/:productId`.
- **`productService.js`**: 
  - Bổ sung hàm `getPopularProducts(limit)` gọi Query C.
  - Cập nhật `getProductById` đổi header từ `x-customer-id` sang `Authorization: Bearer <token>`.
