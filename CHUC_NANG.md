# Mô tả chức năng toàn dự án

Tài liệu này liệt kê **mọi chức năng** trong hệ thống, kèm file và hàm tham gia.
Lập từ việc đọc trực tiếp mã nguồn hiện tại (46 file backend, 53 file frontend).

**Quy ước:** `file.js › tenHam()` nghĩa là hàm `tenHam` nằm trong `file.js`.

---

## MỤC LỤC

| # | Nhóm chức năng |
|---|---|
| 0 | [Nền tảng dùng chung](#0-nền-tảng-dùng-chung) |
| 1 | [Xác thực & phân quyền](#1-xác-thực--phân-quyền) |
| 2 | [Duyệt sản phẩm & danh mục](#2-duyệt-sản-phẩm--danh-mục) |
| 3 | [Lọc, sắp xếp, phân trang](#3-lọc-sắp-xếp-phân-trang) |
| 4 | [Thuộc tính động của sản phẩm](#4-thuộc-tính-động-của-sản-phẩm-schema-less) |
| 5 | [Gợi ý sản phẩm (3 truy vấn đồ thị)](#5-gợi-ý-sản-phẩm--trọng-tâm-đồ-án) |
| 6 | [Giỏ hàng](#6-giỏ-hàng) |
| 7 | [Đặt hàng](#7-đặt-hàng) |
| 8 | [Thanh toán (3 hình thức)](#8-thanh-toán--3-hình-thức) |
| 9 | [Quản lý đơn phía khách](#9-quản-lý-đơn-phía-khách) |
| 10 | [Trang quản trị](#10-trang-quản-trị) |
| 11 | [Chatbot tư vấn](#11-chatbot-tư-vấn) |
| 12 | [Cập nhật thời gian thực](#12-cập-nhật-thời-gian-thực-sse) |
| 13 | [Dòng tin mua hàng](#13-dòng-tin-mua-hàng-trang-chủ) |
| 14 | [Xử lý lỗi giao diện](#14-xử-lý-lỗi-giao-diện) |
| 15 | [Hồ sơ cá nhân](#15-hồ-sơ-cá-nhân) |
| 16 | [Script quản trị dữ liệu](#16-script-quản-trị-dữ-liệu) |
| 17 | [Triển khai](#17-triển-khai) |
| — | [Code chết](#code-chết-nên-xoá) |

---

## 0. NỀN TẢNG DÙNG CHUNG

Không phải chức năng người dùng thấy, nhưng mọi chức năng khác đều dựa vào.

### 0.1. Nạp cấu hình

| File | Vai trò |
|---|---|
| `.env` (thư mục gốc) | Một file duy nhất cho cả backend lẫn frontend, 17 biến |
| `.env.example` | Bản mẫu để người trong nhóm biết cần điền gì |
| `backend/loadEnv.js` | Trỏ tuyệt đối tới `.env` gốc; cảnh báo khi thiếu `NEO4J_URI/USERNAME/PASSWORD` |
| `frontend/vite.config.js` | `envDir: '..'` để Vite đọc cùng file |

Chỉ biến có tiền tố `VITE_` mới ra tới trình duyệt.

### 0.2. Kết nối Neo4j

**`backend/db.js`** — tạo driver singleton, xuất ra:
- `driver` — đối tượng driver gốc
- `readQuery(cypher, params)` — chạy truy vấn đọc, trả mảng object đã chuyển kiểu
- `writeQuery(cypher, params)` — chạy truy vấn ghi
- `int(n)` — bọc số nguyên cho Neo4j (dùng cho `SKIP`/`LIMIT`)
- `verifyConnection()` — kiểm tra kết nối lúc khởi động
- `closeDriver()` — đóng khi tắt server

Đặt `disableLosslessIntegers: true` nên số trả về là số JS thường, không phải đối
tượng `Integer`.

### 0.3. Tiện ích HTTP

**`backend/utils/http.js`**
- `asyncHandler(fn)` — bọc route async để lỗi rơi về error handler thay vì treo request
- `HttpError(status, message)` — lỗi kèm mã HTTP
- `parsePagination(query)` — đọc `page`/`limit`, chặn giá trị vô lý
- `parseSearch(value)` — chuẩn hoá từ khoá (trim + hạ chữ thường)
- `buildPagination(page, limit, total)` — dựng object phân trang

### 0.4. Khởi động server

**`backend/server.js`** — gắn 9 router, cấu hình CORS theo `CORS_ORIGIN`, error
handler tập trung, `startServer()` kiểm tra Neo4j trước khi lắng nghe, graceful
shutdown khi nhận SIGINT.

### 0.5. Địa chỉ API phía frontend

**`frontend/src/config/api.js`**
- `API_BASE_URL` — suy từ `VITE_API_URL`, không có thì tự đoán từ địa chỉ đang mở trang
- `apiUrl(path)` — ghép đường dẫn

Nhờ tự đoán mà chạy máy mình hay qua LAN đều đúng, không phải sửa code.

---

## 1. XÁC THỰC & PHÂN QUYỀN

### 1.1. Đăng ký / đăng nhập

| Tầng | File › hàm |
|---|---|
| Giao diện | `pages/Register.jsx › handleRegister()`, `pages/Login.jsx › handleLogin(), handleGoogleLogin(), navigateAfterLogin()` |
| Context | `context/AuthContext.jsx › AuthProvider, useAuth, register(), login(), loginWithGoogle(), logout()` |
| Cấu hình | `config/firebase.js › auth` |
| Dịch vụ | `services/authService.js › syncUser(), getCurrentCustomer()` |
| Thông báo lỗi | `utils/authErrors.js › getFriendlyErrorMessage(), SILENT_CODES` |
| API | `POST /api/auth/sync`, `GET /api/auth/me` → `routes/auth.js` |
| Cypher | `cypher.js › SYNC_CUSTOMER, GET_CUSTOMER_BY_FIREBASE_UID` |

Firebase lo mật khẩu; Neo4j chỉ lưu hồ sơ. `SYNC_CUSTOMER` dùng `MERGE` theo
`customer_id = 'U_' + firebase_uid` nên gọi bao nhiêu lần cũng chỉ một node.

### 1.2. Xác thực token phía server

**`backend/middleware/auth.js`**
- `verifyToken` — bắt buộc token hợp lệ, gắn `req.user`, trả 401 nếu sai
- `optionalAuth` — có token thì gắn, không có vẫn cho qua (dùng cho trang công khai)
- `isBlocked(uid)` — tra Neo4j xem tài khoản có bị khoá không
- `extractToken(req)` — bóc `Authorization: Bearer ...`
- `getAuth()` — lấy Auth instance tương thích nhiều phiên bản SDK

**`backend/firebase.js`** — khởi tạo Admin SDK, `docServiceAccount()` đọc khoá từ
biến `FIREBASE_SERVICE_ACCOUNT` (JSON hoặc base64) hoặc từ file, `getCredential()`
xử lý tương thích SDK.

### 1.3. Phân quyền admin

| Thành phần | File › hàm |
|---|---|
| Middleware | `middleware/adminAuth.js › requireAdmin` |
| Cypher | `cypher.js › GET_CUSTOMER_BY_FIREBASE_UID` (trả `role` từ `HAS_ROLE→Role` hoặc `c.role`) |
| Cấp quyền | `scripts/setup-admin.js` (`npm run setup:admin -- email@...`) |
| Đổi quyền | `PUT /api/admin/users/:id/role` → `cypher.js › ADMIN_UPDATE_USER_ROLE` |

Toàn bộ `routes/admin.js` dùng `requireAdmin` ở cấp router.

### 1.4. Khoá / mở tài khoản

| Thành phần | File › hàm |
|---|---|
| API | `PUT /api/admin/users/:id/status` → `routes/admin.js` |
| Cypher | `cypher.js › ADMIN_UPDATE_USER_STATUS, GET_CUSTOMER_STATUS` |
| Thi hành | `middleware/auth.js › isBlocked()` — mọi request đã đăng nhập đều bị kiểm |
| Giao diện | `pages/admin/AdminDashboard.jsx › toggleUserStatus()` |
| Xử lý phía khách | `context/AuthContext.jsx` — gặp 403 thì tự đăng xuất, hiện `blockedMessage` |
| Kiểm thử | `scripts/test-block.js` |

Khoá tài khoản giữa chừng: đơn chưa thanh toán của người đó chuyển thành đã huỷ.

### 1.5. Hết hạn phiên

**`frontend/src/hooks/useSessionTimeout.js`**
- `useSessionTimeout({ enabled, onTimeout })` — đếm giờ, gọi `onTimeout` khi hết
- `clearSessionMarks()` — xoá mốc thời gian khi đăng xuất
- `SESSION_LIMITS` — `idleSeconds: 600`, `absoluteHours: 24`

Nối vào `AuthContext.jsx › handleSessionTimeout()`. Dùng `localStorage` chứ không
dùng cookie vì hệ thống xác thực bằng ID token không trạng thái.

### 1.6. Chặn truy cập trang cần đăng nhập

**`components/ProtectedRoute.jsx`** — đang tải thì hiện chờ, chưa đăng nhập thì
`<Navigate to="/login" replace />`.

---

## 2. DUYỆT SẢN PHẨM & DANH MỤC

### 2.1. Danh sách sản phẩm

| Tầng | File › hàm |
|---|---|
| Trang | `pages/Home.jsx › Home()`, `doiBoLoc()` |
| Hiển thị | `components/ProductList.jsx › ProductList()`, `components/ProductCard.jsx › ProductCard(), handleAddToCart()` |
| Dịch vụ | `services/productService.js › getProducts()`, `appendFilters()` |
| API | `GET /api/products` → `routes/products.js` |
| Cypher | `cypher.js › LIST_PRODUCTS, COUNT_PRODUCTS` |

### 2.2. Chi tiết sản phẩm + ghi nhận lượt xem

| Tầng | File › hàm |
|---|---|
| Trang | `pages/ProductDetail.jsx › ProductDetail(), chotSoLuong(), handleAddToCart(), handleBuyNow()` |
| Dịch vụ | `services/productService.js › getProductById()` |
| API | `GET /api/products/:id` (dùng `optionalAuth`) |
| Cypher | `cypher.js › RECORD_VIEWED_AND_GET_PRODUCT` (đã đăng nhập), `GET_PRODUCT_BY_ID` (khách vãng lai) |

Đăng nhập rồi xem sản phẩm sẽ tạo/cập nhật cạnh `VIEWED` — ghi nhận trong **cùng
một câu Cypher** với việc lấy chi tiết, không tốn thêm lượt truy vấn.

### 2.3. Danh mục công khai

`GET /api/products/categories` → `cypher.js › LIST_CATEGORIES_PUBLIC` (bỏ danh
mục rỗng) → `services/productService.js › getCategories()` →
`components/ProductFilters.jsx`.

---

## 3. LỌC, SẮP XẾP, PHÂN TRANG

| Thành phần | File › hàm |
|---|---|
| Giao diện | `components/ProductFilters.jsx › ProductFilters()`, `doanKieu()`, hằng `MUC_GIA`, `SAP_XEP` |
| Đọc tham số | `utils/filters.js › parseFilters()` — trả `{categoryId, minPrice, maxPrice, sort, coLoc}` |
| Gửi tham số | `productService.js › appendFilters()`, `customerService.js › appendFilters()` |
| Cypher | `LIST_PRODUCTS`, `COUNT_PRODUCTS`, `POPULAR_PRODUCTS_FILTERED`, `RECOMMEND_FOR_CUSTOMER_FILTERED` |

Áp dụng cho **ba danh sách độc lập**: sản phẩm (Home), gợi ý và bán chạy
(`RecommendationSection`). Mỗi danh sách giữ bộ lọc riêng.

**Sắp xếp** dùng `ORDER BY` dạng `CASE` vì Cypher không cho truyền tên cột qua
tham số. Luôn giữ `p.id ASC` làm tiêu chí chốt — thiếu nó thì sản phẩm trùng giá
xếp khác nhau giữa hai lần truy vấn, khiến `SKIP/LIMIT` trả lặp hoặc sót.

Giá trị lọc không hợp lệ được coi như không lọc thay vì trả 400.

---

## 4. THUỘC TÍNH ĐỘNG CỦA SẢN PHẨM (SCHEMA-LESS)

Phần thể hiện rõ nhất tính schema-less của NoSQL: admin tự đặt tên thuộc tính lúc
chạy ("Mô tả", "Xuất xứ", "Bảo hành"), không khai báo trước ở đâu.

| Tầng | File › hàm |
|---|---|
| Giao diện admin | `pages/admin/ProductAttributes.jsx › ProductAttributes()`, `doanKieu()`, hằng `GOI_Y` |
| Ghép vào form | `pages/admin/AdminDashboard.jsx › ProductModal()`, `dungMapThuocTinh()`, `openProduct()`, `saveProduct()` |
| Dịch vụ | `services/adminService.js › getProductAttributes(), saveProductAttributes()` |
| API | `GET/PUT /api/admin/products/:id/attributes` → `routes/admin.js` |
| Xử lý | `utils/productAttributes.js › parseAttributes(), extractCustomAttributes(), doanKieu()`, hằng `CORE_KEYS`, `MAX_ATTRS` |
| Cypher | `cypher.js › ADMIN_SET_PRODUCT_ATTRIBUTES` (`SET p += $attrs`), `ADMIN_GET_PRODUCT_DETAIL` |
| Hiển thị | `pages/ProductDetail.jsx` — bảng "Thông tin chi tiết" |
| Kiểm thử | `scripts/test-attributes.js` (22 phép kiểm) |

**Điểm kỹ thuật:** dùng `SET p += $attrs` chứ không nối chuỗi tên thuộc tính vào
câu lệnh — nối chuỗi là mở đường cho chèn Cypher. Gán khoá bằng `null` chính là
xoá thuộc tính, nên thêm/sửa/xoá dùng chung một câu lệnh.

**Chặn:** `CORE_KEYS` = `id, title, final_price, rating, image, stock, status`
không cho ghi qua đường này.

---

## 5. GỢI Ý SẢN PHẨM — TRỌNG TÂM ĐỒ ÁN

### 5.1. Truy vấn A — gợi ý cá nhân hoá

Mẫu duyệt 4 bậc `(c1)-[:BOUGHT]->(p1)<-[:BOUGHT]-(c2)-[:BOUGHT]->(p2)`.

| Tầng | File › hàm |
|---|---|
| Cypher | `cypher.js › RECOMMEND_FOR_CUSTOMER` (bản gốc), `RECOMMEND_FOR_CUSTOMER_FILTERED` (có lọc) |
| API | `GET /api/customers/:id/recommendations` → `routes/customers.js` |
| Dịch vụ | `services/customerService.js › getCustomerRecommendations()` |
| Giao diện | `components/RecommendationSection.jsx` |

### 5.2. Truy vấn B — mua kèm theo sản phẩm đang xem

Mẫu 3 bậc `(p1)<-[:BOUGHT]-(c2)-[:BOUGHT]->(p2)`.

| Tầng | File › hàm |
|---|---|
| Cypher | `cypher.js › RECOMMEND_FOR_PRODUCT` |
| API | `GET /api/products/:id/recommendations` |
| Dịch vụ | `services/productService.js › getRecommendations()` |
| Giao diện | `components/RecommendationList.jsx` (trong `ProductDetail`) |

### 5.3. Truy vấn C — sản phẩm bán chạy (khởi đầu nguội)

| Tầng | File › hàm |
|---|---|
| Cypher | `cypher.js › POPULAR_PRODUCTS`, `POPULAR_PRODUCTS_FILTERED` |
| API | `GET /api/products/popular` |
| Dịch vụ | `services/productService.js › getPopularProducts()` |
| Giao diện | `components/RecommendationSection.jsx` — tự chuyển sang Query C khi khách chưa có lượt mua nào |

### 5.4. Đo hiệu năng

**`scripts/explain-profile.js`** (`npm run explain`) — chạy `EXPLAIN`/`PROFILE`,
in kế hoạch thực thi và số `dbHits`. Số liệu này dùng cho Chương 5 báo cáo.

> **Lưu ý bảo trì:** `RECOMMEND_FOR_CUSTOMER` và `POPULAR_PRODUCTS` bản gốc được
> **trích nguyên văn trong báo cáo**. Bộ lọc/sắp xếp nằm ở bản `_FILTERED` riêng
> để báo cáo vẫn khớp mã nguồn. Không bật tuỳ chọn nào thì chạy bản gốc
> (`filtered: false` trong phản hồi).

---

## 6. GIỎ HÀNG

| Tầng | File › hàm |
|---|---|
| Trang | `pages/Cart.jsx › Cart(), runAction(), changeQuantity(), chotSoLuongNhap(), boNhapTam(), removeItem(), emptyCart()` |
| Context | `context/CartContext.jsx › CartProvider, useCart, refreshCart(), addItem()` |
| Dịch vụ | `services/shopService.js › getCart(), getCartCount(), addToCart(), setCartQuantity(), removeFromCart(), clearCart()` |
| API | `GET/DELETE /api/cart`, `GET /api/cart/count`, `POST /api/cart/items`, `PATCH/DELETE /api/cart/items/:productId` → `routes/cart.js` |
| Cypher | `shopCypher.js › CART_LIST, CART_COUNT, CART_ADD_ITEM, CART_SET_QUANTITY, CART_REMOVE_ITEM, CART_CLEAR` |
| Kiểm tồn kho | `adminStatsCypher.js › GET_PRODUCT_STOCK` |
| Hộp thoại lỗi | `components/AlertDialog.jsx › AlertDialog()` |

Giỏ lưu trong đồ thị bằng quan hệ `IN_CART` chứ không lưu ở trình duyệt — đổi
máy vẫn còn, và kiểm tồn kho không thể bị bỏ qua từ phía client.

**Ô nhập số lượng:** số đang gõ tách khỏi số lượng thật, chỉ gửi lên máy chủ khi
rời ô hoặc bấm Enter — không thì gõ "10" sẽ thành đặt 1 rồi mới đặt 10.

---

## 7. ĐẶT HÀNG

### 7.1. Đặt từ giỏ

| Tầng | File › hàm |
|---|---|
| Trang | `pages/Checkout.jsx › Checkout(), handleSubmit(), update()` |
| Dịch vụ | `services/shopService.js › createOrder()` |
| API | `POST /api/orders` → `routes/orders.js` |
| Cypher | `shopCypher.js › ORDER_CREATE_FROM_CART` |
| Kiểm kho | `adminStatsCypher.js › CHECK_STOCK_FOR_CART` |
| Sinh mã đơn | `utils/orderCode.js › generateOrderCode()`, `ORDER_PREFIX` |

`ORDER_CREATE_FROM_CART` làm 4 việc trong **một câu lệnh**: chốt đơn giá, tạo
`Order`, tạo các cạnh `CONTAINS`, xoá sạch `IN_CART`. Lỗi giữa chừng thì Neo4j tự
rollback, không có trạng thái nửa vời.

**Mã đơn** `DHxxxxxxxx` sinh bằng `crypto.randomInt` trên 34⁸ ≈ 1,79 nghìn tỷ tổ
hợp — không đọc giá trị chia sẻ nào nên hai người đặt cùng lúc không tranh chấp.

### 7.2. Mua ngay (không qua giỏ)

| Tầng | File › hàm |
|---|---|
| Nút bấm | `pages/ProductDetail.jsx › handleBuyNow()` |
| Trang | `pages/Checkout.jsx` — chế độ `laMuaNgay`, nhận diện qua tham số `?muaNgay=&sl=` trên URL |
| Dịch vụ | `services/shopService.js › createOrderBuyNow()` |
| API | `POST /api/orders/buy-now` |
| Cypher | `shopCypher.js › ORDER_CREATE_DIRECT` |
| Kiểm thử | `scripts/test-buynow.js` (19 phép kiểm) |

Hoàn toàn **không đụng `IN_CART`**: bỏ ngang không đọng lại gì trong giỏ, đơn chỉ
gồm đúng món vừa bấm.

Nhận diện chế độ qua **đường dẫn** chứ không qua router state hay bộ nhớ tạm —
state mất khi F5, bộ nhớ tạm thì lẫn sang lượt sau.

---

## 8. THANH TOÁN — 3 HÌNH THỨC

### 8.1. Trả tại quầy, nhân viên xác nhận

| Tầng | File › hàm |
|---|---|
| Giao diện admin | `pages/admin/AdminOrders.jsx › handleMarkPaid()` |
| Dịch vụ | `services/shopService.js › adminMarkPaid()` |
| API | `POST /api/admin/orders/:orderId/mark-paid` |
| Cypher | `shopCypher.js › ORDER_MARK_PAID`, `ORDER_FIND_PENDING` |
| Trừ kho | `adminStatsCypher.js › DECREASE_STOCK_FOR_ORDER` |

`ORDER_MARK_PAID` là **cầu nối duy nhất** giữa tầng giao dịch và tầng phân tích:
chuyển đơn sang `PAID` **và** `MERGE` các cạnh `BOUGHT`. Điều kiện
`WHERE o.status = 'PENDING'` đảm bảo chỉ chạy đúng một lần.

Kho trừ ở **thời điểm thanh toán**, không phải lúc đặt hàng — khách đặt trên web
có thể không tới lấy, giữ hàng sớm sẽ khoá nhầm tồn kho.

### 8.2. ZaloPay (khách tự xác nhận)

| Tầng | File › hàm |
|---|---|
| Giao diện | `pages/OrderDetail.jsx › handleConfirmPaid()` |
| Dịch vụ | `services/shopService.js › confirmOrderPaid()` |
| API | `POST /api/orders/:orderId/confirm-paid` |
| Cypher | `shopCypher.js › ORDER_CONFIRM_PAID_BY_CUSTOMER` |

### 8.3. Chuyển khoản tự động qua SePay

| Tầng | File › hàm |
|---|---|
| Hiện QR | `components/PaymentQr.jsx › PaymentQr(), Dong(), chep()` |
| Dịch vụ | `services/shopService.js › getPaymentQr()` |
| API lấy QR | `GET /api/orders/:orderId/payment-qr` → `routes/orders.js` |
| Webhook | `POST /api/webhooks/sepay` → `routes/webhooks.js` |
| Xử lý | `services/sepay.js › taoUrlQr(), khoaHopLe(), bocMaDon(), daCauHinh(), cauHinh()` |
| Cypher | `shopCypher.js › PAYMENT_TX_RECORD, PAYMENT_TX_LINK_ORDER, ORDER_FIND_FOR_PAYMENT` |
| Ràng buộc | `scripts/setup-payment.js` (`npm run setup:payment`) |
| Kiểm thử | `scripts/test-sepay.js` (27 phép kiểm) |
| Hướng dẫn | `SEPAY_SETUP.md` |

**Bốn chốt an toàn trong webhook** (endpoint duy nhất không dùng Firebase token):
1. `khoaHopLe()` so sánh khoá bằng `crypto.timingSafeEqual` — chống dò theo thời gian
2. `PAYMENT_TX_RECORD` chống xử lý trùng (SePay gửi lại tới 7 lần trong 5 tiếng)
3. Chỉ tin `transferAmount` thật, không tin số nào lấy từ nội dung chuyển khoản
4. Chỉ nhận `transferType = 'in'`

Chuyển thiếu tiền thì **không tự duyệt**, ghi log để nhân viên xử lý tay.

Mỗi giao dịch thành node `:PaymentTx`, nối với đơn bằng `(:Order)-[:PAID_BY]->(:PaymentTx)`.

---

## 9. QUẢN LÝ ĐƠN PHÍA KHÁCH

| Chức năng | File › hàm |
|---|---|
| Danh sách đơn | `pages/Orders.jsx › Orders(), load(), badgeStyle()` |
| Chi tiết đơn | `pages/OrderDetail.jsx › OrderDetail(), load(), handleCancel(), handleConfirmPaid()` |
| Dịch vụ | `services/shopService.js › getMyOrders(), getOrderDetail(), cancelOrder()` |
| Hiển thị trạng thái | `services/shopService.js › statusInfo(), ORDER_STATUS, formatPrice(), formatDate()` |
| API | `GET /api/orders`, `GET /api/orders/:orderId`, `POST /api/orders/:orderId/cancel` |
| Cypher | `shopCypher.js › ORDER_LIST_BY_CUSTOMER, ORDER_COUNT_BY_CUSTOMER, ORDER_GET_DETAIL, ORDER_CANCEL` |

`GET /api/orders/:orderId` kiểm tra quyền sở hữu — khách chỉ xem được đơn của
mình, admin xem được tất cả. Không kiểm thì ai đoán trúng mã đơn là đọc được tên,
số điện thoại, địa chỉ người khác.

`ORDER_CANCEL` chỉ khớp đơn `PENDING` — đã thanh toán thì không tự huỷ được.

---

## 10. TRANG QUẢN TRỊ

Khung chung: `pages/admin/AdminDashboard.jsx › AdminDashboard()` +
`components/admin/AdminSidebar.jsx` + `components/admin/AdminStatCard.jsx`.
Các component con: `Overview, SearchBar, Toolbar, EmptyRow, Pagination,
Categories, Products, Users, Modal, CategoryModal, ProductModal, UserModal`.

### 10.1. Thống kê tổng quan

`GET /api/admin/stats` → `cypher.js › ADMIN_GET_STATS, ADMIN_REVENUE_BY_CATEGORY,
ADMIN_RECENT_ORDERS` + `adminStatsCypher.js › ORDER_SUMMARY, RECENT_ACTIVITY,
LOW_STOCK_PRODUCTS` → `services/adminService.js › getAdminStats()` → `Overview()`.

### 10.2. Quản lý danh mục

| Việc | API | Cypher | Hàm giao diện |
|---|---|---|---|
| Liệt kê | `GET /api/admin/categories` | `ADMIN_LIST_CATEGORIES` | `Categories()` |
| Thêm | `POST /api/admin/categories` | `ADMIN_CREATE_CATEGORY` | `openCategory()`, `saveCategory()` |
| Sửa | `PUT /api/admin/categories/:id` | `ADMIN_UPDATE_CATEGORY` | `CategoryModal()` |
| Xoá | `DELETE /api/admin/categories/:id` | `ADMIN_DELETE_CATEGORY` | `archive()` |

Dịch vụ: `adminService.js › getAdminCategories(), createCategory(), updateCategory(), deleteCategory()`.

### 10.3. Quản lý sản phẩm

| Việc | API | Cypher |
|---|---|---|
| Liệt kê + tìm + lọc | `GET /api/admin/products` | `LIST_PRODUCTS`, `COUNT_PRODUCTS` |
| Thêm | `POST /api/admin/products` | `ADMIN_CREATE_PRODUCT` |
| Sửa | `PUT /api/admin/products/:id` | `ADMIN_UPDATE_PRODUCT` |
| Xoá (mềm) | `DELETE /api/admin/products/:id` | `ADMIN_DELETE_PRODUCT` (đặt `status='deleted'`) |
| Thuộc tính động | `GET/PUT .../attributes` | mục 4 |

Giao diện: `Products()`, `ProductModal()`, `openProduct()`, `saveProduct()`.
Ô tìm kiếm dùng `hooks/useDebounce.js › useDebounce()` (400ms) và cờ
`firstLoadDone` để không bị mất con trỏ nhập khi tải lại.

### 10.4. Quản lý người dùng

`GET /api/admin/users`, `GET /api/admin/users/:id`, `PUT .../role`,
`PUT .../status`, `GET .../orders` → `cypher.js › ADMIN_LIST_USERS,
ADMIN_COUNT_USERS, ADMIN_GET_USER_DETAILS, ADMIN_UPDATE_USER_ROLE,
ADMIN_UPDATE_USER_STATUS` + `adminStatsCypher.js › USER_ORDERS`.

Giao diện: `Users()`, `UserModal()`, `openUser()`, `toggleUserStatus()`.
Dịch vụ: `adminService.js › getAdminUsers(), getUserDetails(), updateUserRole(), updateUserStatus(), getUserOrders()`.

### 10.5. Quản lý đơn hàng

**`pages/admin/AdminOrders.jsx › AdminOrders(), load(), handleMarkPaid(), handleChangeStatus()`**
+ `components/admin/OrderItemsModal.jsx › OrderItemsModal(), Row()`.

| Việc | API | Cypher |
|---|---|---|
| Danh sách + lọc trạng thái/tìm/ngày | `GET /api/admin/orders` | `shopCypher.js › ADMIN_ORDER_LIST, ADMIN_ORDER_COUNT` |
| Chi tiết | `GET /api/admin/orders/:orderId` | `ORDER_GET_DETAIL` |
| Xác nhận trả tiền | `POST .../mark-paid` | `ORDER_MARK_PAID` |
| Đổi trạng thái | `PUT .../status` | `ORDER_UPDATE_STATUS` |

Huỷ đơn đã thanh toán thì hoàn kho qua `RESTORE_STOCK_FOR_ORDER`.
Tìm kiếm theo họ tên / số điện thoại / khoảng ngày. Kiểm thử: `scripts/test-order-search.js`.

### 10.6. Doanh thu theo thời gian

`GET /api/admin/revenue?groupBy=month|day|year&from=&to=` →
`adminStatsCypher.js › REVENUE_BY_PERIOD` → `adminService.js › getRevenue()`.

Doanh thu lấy từ node `Order` (giao dịch thật), **không** lấy từ cạnh `BOUGHT` —
phần lớn `BOUGHT` là dữ liệu mô phỏng phục vụ thuật toán gợi ý.

### 10.7. Cảnh báo tồn kho thấp

`GET /api/admin/low-stock?threshold=` → `adminStatsCypher.js › LOW_STOCK_PRODUCTS`
→ `adminService.js › getLowStock()`.

---

## 11. CHATBOT TƯ VẤN

Kiến trúc **4 tầng**, rẻ trước đắt sau:

| Tầng | File › hàm | Lượt gọi AI |
|---|---|---|
| 1. Bộ nhớ đệm | `services/chatAssistant.js › docDem(), ghiDem(), chuanHoaKhoa()` | 0 |
| 2. Lọc nhanh | `services/quickParse.js › phanTichCauHoi(), traLoiKhongCanAI()` | 0 |
| 3. Gemini | `services/geminiChat.js › chat(), callGemini()` | ~2 |
| 4. Hạ cấp | `quickParse.js › doanYDinhDuPhong()` | 0 |

**Điều phối:** `services/chatAssistant.js › traLoi(ip, cauHoi, lichSu)`, `xoaDem()`,
`conNganSach()`, `ghiNhanLuot()`.

**Lọc nhanh** (`quickParse.js`) — hiểu câu hỏi không cần AI:
- `boDau()` — bỏ dấu tiếng Việt, **giữ nguyên độ dài** để vị trí ký tự khớp chuỗi gốc
- `docKhoangGia()` — bắt "dưới 500k", "từ 100k đến 300k", "khoảng 200k"
- `doiTien()` — "500k"→500000, "1.5 triệu"→1500000
- `locTuKhoa()` — cắt đoạn nói về giá + từ đệm, còn lại là từ khoá
- `chayTimKiem()` — tìm, không ra thì rút ngắn từ khoá dần rồi tìm lại
- `moTaDieuKien()`, `dinhDangTien()` — dựng câu trả lời

**Gemini** (`geminiChat.js`) — dùng function calling, chỉ khai báo **công cụ đọc**:
`search_products`, `list_categories`. Không có công cụ ghi nào nên chatbot không
thể sửa/xoá dữ liệu kể cả khi bị dụ. `searchProducts()`, `listCategories()`,
`toPrice()`, `toKeyword()`.

**Lưới an toàn chống bịa:** chưa gọi công cụ lần nào mà câu trả lời đã có chữ số
thì bỏ câu đó, ép tra cứu lại bằng `functionCallingConfig.mode = 'ANY'`.

**Cypher:** `chatCypher.js › CHAT_SEARCH_PRODUCTS, CHAT_LIST_CATEGORIES` — chỉ
câu lệnh đọc, mô hình chỉ điền **giá trị** vào tham số, không bao giờ sinh Cypher.

**API:** `POST /api/chat` → `routes/chat.js › rateLimit` (60 lượt/phút/IP).
**Giao diện:** `components/ChatWidget.jsx › ChatWidget(), send(), themVaoGio()`.
**Dịch vụ:** `services/chatService.js › sendChatMessage()`.

Nút "Thêm vào giỏ" trên thẻ sản phẩm trong chat đi qua `useCart().addItem` như
mọi chỗ khác — chatbot không tự thao tác thay khách.

---

## 12. CẬP NHẬT THỜI GIAN THỰC (SSE)

| Tầng | File › hàm |
|---|---|
| Lõi | `services/eventBus.js › capVe(), dungVe(), themKetNoi(), boKetNoi(), guiCho(), thongBaoDonThayDoi(), soKetNoi(), batDauNhip(), dungNhipNeuVang()` |
| API | `POST /api/events/ticket`, `GET /api/events/stream?ticket=` → `routes/events.js` |
| Giao diện | `hooks/useOrderEvents.js › useOrderEvents()` |
| Gắn vào | `pages/admin/AdminOrders.jsx`, `pages/Orders.jsx`, `pages/OrderDetail.jsx` |
| Kiểm thử | `scripts/test-events.js` (20 phép kiểm) |

**Sáu chỗ phát sự kiện:** `POST /api/orders`, `POST /api/orders/buy-now`,
`POST /api/orders/:id/confirm-paid`, `POST /api/orders/:id/cancel`,
`POST /api/admin/orders/:id/mark-paid`, `PUT /api/admin/orders/:id/status`,
và webhook SePay.

**Cơ chế vé:** `EventSource` không cho đặt header nên không gửi được
`Authorization: Bearer`. Thay vì nhét token vào URL (sẽ nằm lại trong log và lịch
sử trình duyệt), khách xin **vé dùng một lần, sống 60 giây** qua endpoint có xác
thực rồi mới mở luồng.

**Hai kênh tách biệt:** `orders_changed` (mọi admin) và `my_orders_changed` (chỉ
chủ đơn). Khách không bao giờ nhận sự kiện đơn của người khác.

Sự kiện chỉ chứa `{orderId, status, hanhDong, luc}` — không có tên, điện thoại,
địa chỉ. Trình duyệt nhận tín hiệu rồi tự gọi API có xác thực để lấy dữ liệu đầy đủ.

Nhịp giữ kết nối 25 giây một lần.

---

## 13. DÒNG TIN MUA HÀNG (TRANG CHỦ)

| Tầng | File › hàm |
|---|---|
| Giao diện | `components/PurchaseTicker.jsx › PurchaseTicker()` |
| Dịch vụ | `services/productService.js › getRecentPurchases()` |
| API | `GET /api/products/recent-purchases` |
| Cypher | `cypher.js › RECENT_PURCHASES` |
| Che tên | `utils/filters.js › maskCustomerName()` |

Chỉ lấy đơn đã thanh toán (`PAID`/`COMPLETED`). Tên khách **che ngay tại backend**
("Nam Đặng Hoài" → "Nam Đ. H.") vì trang chủ ai cũng xem được — ghép họ tên đầy
đủ với món vừa mua là đủ lộ thói quen mua sắm của người thật.

Chưa có đơn nào thì ẩn hẳn dải tin thay vì bịa tin.

---

## 14. XỬ LÝ LỖI GIAO DIỆN

| Thành phần | File › hàm | Vai trò |
|---|---|---|
| Lưới an toàn | `components/ErrorBoundary.jsx › ErrorBoundary` (class, `getDerivedStateFromError`, `componentDidCatch`) | Chặn lỗi render, thay vì trắng trang thì hiện trang xin lỗi |
| Trang 404 | `pages/NotFound.jsx › NotFound()` | Route `path="*"` trong `router/AppRouter.jsx` |
| Hộp thoại | `components/AlertDialog.jsx › AlertDialog()` | Lỗi thao tác (hết hàng...) — không thay cả trang |
| Lỗi tải dữ liệu | `components/ErrorMessage.jsx` | Có nút thử lại |
| Đang tải | `components/Loading.jsx` | |

**Ba nguyên nhân trang trắng đã sửa:** thiếu route `path="*"`; hook gọi sau câu
`return` có điều kiện trong `ProductList.jsx`; và thiếu `ErrorBoundary`.

---

## 15. HỒ SƠ CÁ NHÂN

| Tầng | File › hàm |
|---|---|
| Trang | `pages/Profile.jsx › Profile(), handleSave(), update()` |
| Dịch vụ | `services/shopService.js › getMyProfile(), updateMyProfile()` |
| API | `GET/PATCH /api/customers/me/profile` → `routes/customers.js` |
| Cypher | `shopCypher.js › CUSTOMER_GET_PROFILE, CUSTOMER_UPDATE_PROFILE` |

Thông tin ở đây được điền sẵn vào form đặt hàng (`Checkout.jsx`).

---

## 16. SCRIPT QUẢN TRỊ DỮ LIỆU

| Lệnh | File | Việc |
|---|---|---|
| `npm run import` | `scripts/import.js` + `scripts/lib/csv.js` | Nạp dữ liệu từ `data2/*.csv` vào Neo4j |
| `npm run generate:bought` | `scripts/generate-bought.js` | Sinh thêm cạnh `BOUGHT` mô phỏng (3,2% → 100% khách có lịch sử mua) |
| `npm run setup:auth` | `scripts/setup-auth.js` | Ràng buộc UNIQUE `firebase_uid` |
| `npm run setup:admin` | `scripts/setup-admin.js` | Cấp quyền admin theo email/id |
| `npm run setup:stock` | `scripts/setup-stock.js` | Gán tồn kho ban đầu |
| `npm run setup:payment` | `scripts/setup-payment.js` | Ràng buộc UNIQUE `PaymentTx.tx_id` |
| `npm run explain` | `scripts/explain-profile.js` | Đo EXPLAIN/PROFILE cho Query A/B/C |

**Bộ kiểm thử** (tổng 201 phép kiểm):

| Lệnh | File | Số phép kiểm |
|---|---|---|
| `npm run test:api` | `scripts/test-api.js` | 34 |
| `npm run test:shop` | `scripts/test-shop.js` | 41 |
| `npm run test:admin` | `scripts/test-admin-stats.js` | 38 |
| `npm run test:sepay` | `scripts/test-sepay.js` | 27 |
| `npm run test:attrs` | `scripts/test-attributes.js` | 22 |
| `npm run test:events` | `scripts/test-events.js` | 20 |
| `npm run test:buynow` | `scripts/test-buynow.js` | 19 |
| `npm run test:block` | `scripts/test-block.js` | — |
| `npm run test:search` | `scripts/test-order-search.js` | — |

---

## 17. TRIỂN KHAI

| File | Vai trò |
|---|---|
| `DEPLOY.md` | Hướng dẫn từng bước |
| `render.yaml` | Cấu hình backend trên Render |
| `frontend/vercel.json` | Cấu hình frontend trên Vercel + rewrite cho React Router |
| `SEPAY_SETUP.md` | Bật thanh toán chuyển khoản |

Frontend lên Vercel, backend lên Render — backend cần giữ kết nối SSE và trạng
thái trong bộ nhớ nên không hợp với mô hình serverless.

---

## CODE CHẾT (NÊN XOÁ)

Phát hiện khi rà soát, **không tham gia chức năng nào**:

| File | Tình trạng |
|---|---|
| `frontend/src/components/Header.jsx` | Không file nào import. Bản đang chạy là `layouts/Header.jsx` |
| `frontend/src/context/CustomerContext.jsx` | Chỉ được `components/Header.jsx` (đã chết) dùng. `CustomerProvider` cũng không gắn trong `main.jsx` |
| `backend/utils/zalopaySandbox.js` | Không nơi nào require |

Riêng `components/Header.jsx` nếu lỡ đem dùng sẽ **lỗi ngay**: nó gọi
`useContext(CustomerContext)` rồi destructure, mà provider không được gắn nên giá
trị là `undefined`.
