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

---

# Bổ sung — Admin Management Dashboard

> **Ngày thực hiện:** 31/07/2026
> **Phạm vi:** Giao diện quản trị, gọi API Admin và bảo vệ quyền truy cập

## 8. Service gọi API Admin

**File tạo mới:**
- `frontend/src/services/adminService.js`

Service tập trung các request tới `/api/admin` và tự động gửi Firebase ID Token trong header `Authorization`.

Các nhóm hàm đã triển khai:
- Thống kê: `getAdminStats`.
- Danh mục: lấy danh sách, tạo, cập nhật và ẩn danh mục.
- Sản phẩm: lấy danh sách có `page`, `limit`, `search`, tạo, cập nhật và ẩn sản phẩm.
- Người dùng: lấy danh sách, xem chi tiết, đổi role và khóa/mở khóa tài khoản.

Service dùng chung xử lý response JSON và chuyển lỗi HTTP thành Error để giao diện hiển thị thông báo.

## 9. Trang Admin Dashboard

**File tạo mới:**
- `frontend/src/pages/admin/AdminDashboard.jsx`
- `frontend/src/pages/admin/AdminDashboard.css`

Đã tạo trang quản trị tại route `/admin`, gồm các khu vực:

### Tổng quan
- KPI doanh thu, tổng lượt mua, tổng số khách hàng và tổng số sản phẩm.
- Số lượng danh mục đang dùng.
- Bảng doanh thu theo danh mục với thanh tỷ lệ trực quan.
- Danh sách lượt mua gần nhất.

### Quản lý danh mục
- Hiển thị mã, tên, số lượng sản phẩm và trạng thái.
- Modal thêm danh mục.
- Modal chỉnh sửa tên/trạng thái.
- Ẩn danh mục bằng API `DELETE`.

### Quản lý sản phẩm
- Bảng sản phẩm có hình ảnh, mã, danh mục, giá, rating, tồn kho và trạng thái.
- Tìm kiếm theo tên và phân trang.
- Modal thêm/chỉnh sửa sản phẩm.
- Quản lý giá bán, rating, hình ảnh, tồn kho và danh mục.
- Ẩn sản phẩm khỏi hệ thống.

### Quản lý người dùng
- Tìm kiếm theo tên, email hoặc mã khách hàng.
- Phân trang.
- Xem hồ sơ chi tiết và lịch sử hoạt động cơ bản.
- Đổi role giữa `user` và `admin`.
- Khóa/mở khóa tài khoản.

## 10. Component Admin dùng riêng

**File tạo mới:**
- `frontend/src/components/admin/AdminSidebar.jsx` — sidebar điều hướng các khu vực Admin và nút đăng xuất.
- `frontend/src/components/admin/AdminStatCard.jsx` — thẻ KPI tái sử dụng cho trang tổng quan.

Giao diện có responsive layout cho desktop, tablet và mobile; bảng có thể cuộn ngang trên màn hình nhỏ, form chuyển sang một cột, đồng thời có trạng thái loading, lỗi API, modal form và phân trang.

## 11. Kết nối route và phân quyền frontend

**File cập nhật:**
- `frontend/src/router/AppRouter.jsx`.
- `frontend/src/pages/Login.jsx`.
- `frontend/src/context/AuthContext.jsx`.
- `frontend/src/services/authService.js`.

Thay đổi đã thực hiện:
- Thêm route `/admin`.
- Sau khi đăng nhập, gọi `/api/auth/sync` và chuyển tài khoản có `role === 'admin'` thẳng tới `/admin`.
- Tài khoản thường vẫn được chuyển tới `/`.
- Trang Admin chờ Firebase hoàn tất khôi phục phiên trước khi kiểm tra quyền.
- Refresh lại thông tin Customer từ backend trước khi quyết định redirect, tránh lỗi role cũ sau khi chạy `setup-admin`.
- Role được chuẩn hóa không phân biệt chữ hoa/chữ thường.
- Nếu không có quyền Admin, người dùng được đưa về trang chủ.
- `refreshCustomer` được ổn định bằng `useCallback`, tránh chạy lặp effect khi cập nhật role.
- Bổ sung `getCurrentCustomer` trong `authService.js` cho luồng lấy thông tin tài khoản hiện tại.

## 12. Khắc phục lỗi không vào được trang Admin

Nguyên nhân là `AdminDashboard` kiểm tra `customer.role` quá sớm. Khi role vừa được cấp bằng `setup-admin`, frontend có thể vẫn giữ dữ liệu Customer cũ và chuyển hướng về `/` ngay lập tức.

Đã sửa bằng cách:
1. Hiển thị loading trong lúc xác minh quyền.
2. Gọi lại `/api/auth/sync` để lấy role mới nhất.
3. Chỉ redirect sau khi quá trình kiểm tra quyền hoàn tất.
4. Hiển thị thông báo rõ ràng khi tài khoản chưa có quyền Admin.

## 13. Kiểm tra sau triển khai

- Không có lỗi diagnostics trong các file Admin, AuthContext, Login và AppRouter.
- Lệnh `npm.cmd run build` tại thư mục `frontend` chạy thành công.
- Route `/admin` đã được tích hợp vào React Router.
- Các API Admin sử dụng Bearer Token, không dùng customer ID tùy ý từ client để xác thực quyền.

## Chatbot tư vấn khách hàng

**File mới:**
- `frontend/src/components/ChatWidget.jsx` — khung chat nổi góc phải.
- `frontend/src/services/chatService.js` — gọi `POST /api/chat`.

**File cập nhật:**
- `frontend/src/layouts/MainLayout.jsx` — gắn `<ChatWidget />` để mọi trang khách hàng đều có.

### Cách hoạt động

Khách hỏi bằng lời (ví dụ "áo thun dưới 500k", "shop có danh mục nào"), backend
tra Neo4j rồi trả về câu trả lời kèm danh sách sản phẩm. Giao diện dựng thẻ sản
phẩm ngay trong khung chat, mỗi thẻ có ảnh, giá, đánh giá và nút **Thêm vào giỏ**.

Nút Thêm vào giỏ dùng chung `useCart().addItem` với `ProductCard` nên số lượng
trên biểu tượng giỏ ở Header tự cập nhật. Chưa đăng nhập thì chuyển sang trang
đăng nhập, giống hệt hành vi của thẻ sản phẩm thường. Hết hàng thì nút bị khoá.

**Không gọi Gemini trực tiếp từ frontend**: API key nằm ở backend, nếu để trong
mã frontend thì ai mở DevTools cũng lấy được và dùng hết hạn mức.

## Sửa lỗi trang trắng

**File mới:** `components/ErrorBoundary.jsx`, `pages/NotFound.jsx`

Ba nguyên nhân, sửa cả ba:

1. **Thiếu route bắt-tất-cả** (nguyên nhân chính, tái hiện được). React Router
   không tự dựng trang 404 — mọi URL không khớp route nào đều không render gì,
   ra đúng một trang trắng. Đã thêm `<Route path="*" element={<NotFound />} />`.

2. **Hook gọi sau câu return có điều kiện** trong `ProductList.jsx`. `useState`
   và `useEffect` nằm dưới `if (products rỗng) return ...`, nên khi danh sách
   chuyển giữa rỗng và có hàng thì số hook đổi giữa hai lần render — React ném
   lỗi ngay lúc render. Chưa nổ trong thực tế vì màn hình "Đang tải" gỡ component
   ra gắn lại mỗi lần, nhưng là bom hẹn giờ. Đã đưa hook lên trước.

3. **Không có ErrorBoundary.** Bất kỳ lỗi render nào cũng làm React gỡ sạch cây
   giao diện. Nay lỗi bị chặn lại và hiện trang xin lỗi kèm nút tải lại / về
   trang chủ, đồng thời in chi tiết ra console để còn lần theo được.

## Dòng tin mua hàng ở trang chủ

**File mới:** `components/PurchaseTicker.jsx`

Hiện luân phiên các lượt mua **thật** (đơn đã thanh toán), 4 giây đổi một tin.
Chưa có đơn nào thì ẩn hẳn dải tin thay vì bịa tin cho đẹp.

Tên khách được backend che bớt trước khi gửi ra ("Nam Đặng Hoài" → "Nam Đ. H.")
vì trang chủ ai cũng xem được — ghép họ tên đầy đủ với món vừa mua là đủ để lộ
thói quen mua sắm của người có thật.

## Lọc theo giá và danh mục

**File mới:** `components/ProductFilters.jsx`

Dùng chung cho cả ba danh sách: sản phẩm, gợi ý và bán chạy. Mỗi danh sách giữ
bộ lọc RIÊNG nên lọc mục này không ảnh hưởng mục kia.

Có sẵn 5 mức giá bấm nhanh (dưới 100k, 100k–500k, 500k–1tr, trên 1tr) và ô nhập
giá tuỳ chọn cho ai cần chính xác. Lọc chạy ở phía Neo4j chứ không lọc trong
trình duyệt, nên phân trang và tổng số vẫn đúng.

**Lưu ý khi sửa tiếp:** thanh lọc phải nằm NGOÀI nhánh `loading`. Để bên trong
thì mỗi lần lọc nó bị gỡ ra gắn lại, mất lựa chọn và tải lại danh mục. Tương tự,
khi lọc ra 0 kết quả vẫn phải giữ thanh lọc — nếu ẩn cả mục đi thì khách không
còn chỗ nào bấm "Bỏ lọc", kẹt luôn.

## "Mua ngay" không còn đi qua giỏ hàng

`ProductDetail` tách hẳn hai nút: "Thêm vào giỏ" vẫn như cũ, còn "Mua ngay" nay
chuyển thẳng sang `/checkout?muaNgay=<mã sản phẩm>&sl=<số lượng>` mà **không gọi
API thêm giỏ**. Bỏ ngang giữa chừng thì không có gì đọng lại trong giỏ.

`Checkout` chạy hai chế độ, phân biệt bằng tham số `muaNgay` trên đường dẫn:
- Có tham số → chỉ hiện đúng món đó, đặt qua `POST /api/orders/buy-now`.
- Không có → lấy hàng trong giỏ như cũ.

**Vì sao nhận biết qua ĐƯỜNG DẪN chứ không phải router state hay sessionStorage:**
router state mất khi khách F5; còn nhớ tạm trong bộ nhớ trình duyệt thì lại lẫn
sang lượt sau — khách mua ngay rồi bỏ ngang, lát sau vào giỏ bấm đặt hàng sẽ thấy
nhầm món cũ. Để trên đường dẫn thì F5 vẫn đúng mà vào từ giỏ cũng đúng.

Thông tin hiển thị (tên, ảnh, giá) đi kèm qua router state cho đường thường để
khỏi gọi lại API; mất state thì trang tự tải lại theo mã trên đường dẫn.
