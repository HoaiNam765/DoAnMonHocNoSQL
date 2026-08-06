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

## Hộp thoại thông báo + ô nhập số lượng

**File mới:** `components/AlertDialog.jsx`

### Lỗi thao tác không được thay thế cả trang

Trang giỏ hàng trước đây gom mọi lỗi vào một state rồi render `ErrorMessage`
thay cho toàn bộ nội dung. Hệ quả: khách chỉ bấm dấu cộng vượt tồn kho một cái
là mất luôn cả giỏ hàng trước mắt, phải bấm "Thử lại" mới thấy lại.

Cần phân biệt hai loại lỗi:
- **Lỗi tải trang** (không lấy được dữ liệu) → thay cả nội dung là hợp lý.
- **Lỗi thao tác** (hết hàng, mất mạng lúc bấm) → chỉ hỏng đúng hành động đó,
  phải giữ nguyên màn hình và báo bằng hộp thoại.

Ở trang giỏ hàng thì `CartContext` đã nuốt lỗi tải và trả giỏ rỗng, nên mọi lỗi
lọt tới đây đều là lỗi thao tác — không có trường hợp nào đáng thay cả trang.

`AlertDialog` cũng thay cho `alert()` ở trang chi tiết sản phẩm: `alert()` khoá
cứng cả tab và không đặt được chữ tiếng Việt cho nút.

### Ô nhập số lượng

Giỏ hàng và trang chi tiết sản phẩm nay gõ thẳng được số lượng, vẫn giữ nút +/−.

**Số đang gõ được tách khỏi số lượng thật**, chỉ gửi lên máy chủ khi rời ô hoặc
bấm Enter. Không tách thì mỗi ký tự lại bắn một lượt gọi API — gõ "10" sẽ thành
đặt 1 rồi mới đặt 10. Cũng nhờ tách mà xoá trắng ô để gõ số mới không bị nhảy
về 1 giữa chừng.

Nhập sai (0, quá 99, để trống, chữ cái) thì báo hộp thoại và trả ô về số lượng
thật, **không gọi API**. Nhập đúng khoảng nhưng vượt tồn kho thì máy chủ từ chối,
hộp thoại hiện "Chỉ còn N sản phẩm trong kho" và ô cũng trả về giá trị cũ.

## Thuộc tính tuỳ ý của sản phẩm

**File mới:** `pages/admin/ProductAttributes.jsx`

Trong modal sửa sản phẩm, admin thêm được thuộc tính bất kỳ theo cặp tên–giá trị,
có sẵn vài gợi ý bấm nhanh (Mô tả, Xuất xứ, Bảo hành...) nhưng gõ tên gì cũng được.
Mỗi dòng hiện nhãn kiểu dữ liệu sẽ được lưu (chữ / số / đúng-sai) để admin thấy
trước, không bị bất ngờ.

Trang chi tiết sản phẩm hiện các thuộc tính này trong mục "Thông tin chi tiết".
Sản phẩm chưa có thuộc tính nào thì mục tự ẩn.

**Hai chỗ dễ sai khi sửa tiếp:**

1. Danh sách thuộc tính giữ dạng MẢNG chứ không phải object. Dùng object thì
   không giữ được dòng đang gõ dở tên, và hai dòng cùng để trống tên sẽ đè nhau.

2. Khi lưu phải gửi kèm những thuộc tính ĐÃ XOÁ hoặc ĐỔI TÊN với giá trị `null`.
   Máy chủ chỉ ghi đè theo map nhận được, không tự biết thuộc tính nào vừa biến
   mất khỏi form — thiếu bước này thì xoá một dòng xong tải lại trang là nó hiện
   về như cũ.

## Cập nhật đơn hàng thời gian thực

**File mới:** `hooks/useOrderEvents.js`

Gắn vào ba trang: `pages/admin/AdminOrders.jsx`, `pages/Orders.jsx`,
`pages/OrderDetail.jsx`. Mỗi trang vốn đã có sẵn hàm `load` dạng `useCallback`
nên chỉ cần một dòng `useOrderEvents({ user, onChange: load })`.

Trang chi tiết đơn lọc thêm một bước: chỉ tải lại khi sự kiện nói về ĐÚNG đơn
đang xem, tránh gọi API thừa khi khách có nhiều đơn khác cùng thay đổi.

**Hai chỗ dễ sai khi sửa tiếp:**

1. `onChange` được giữ trong `useRef`, KHÔNG đưa vào mảng phụ thuộc của
   `useEffect`. Đưa vào thì mỗi lần trang vẽ lại là một hàm mới → đóng/mở luồng
   liên tục, vừa tốn vừa dễ sót sự kiện.

2. Khi luồng lỗi phải **đóng hẳn rồi tự xin vé mới**, không để `EventSource` tự
   kết nối lại. Vé chỉ dùng được một lần nên nó sẽ gọi lại đúng URL cũ với vé đã
   tiêu huỷ và hỏng vĩnh viễn.

## Khung chuyển khoản QR

**File mới:** `components/PaymentQr.jsx`, gắn vào `pages/OrderDetail.jsx`.

Hiện với đơn đang chờ thanh toán: ảnh QR (do `qr.sepay.vn` dựng, chỉ là URL ảnh
nên không cần gọi API), số tài khoản, số tiền, nội dung chuyển khoản — kèm nút
chép nhanh.

**Không có nút "tôi đã chuyển tiền".** SePay phát hiện tiền vào rồi gọi webhook,
backend đẩy sự kiện SSE xuống, trang tự tải lại và khung QR biến mất. Khách chỉ
việc chuyển tiền rồi ngồi xem.

Chưa khai báo tài khoản nhận tiền thì khung **tự ẩn**, web chạy bình thường với
cách trả tiền tại quầy — xem `SEPAY_SETUP.md`.

## Chọn phương thức thanh toán

`pages/Checkout.jsx` thêm mục **"Cách thanh toán"** với hai thẻ chọn: tiền mặt
tại cửa hàng (mặc định) và chuyển khoản quét mã QR. Khối nhắc bên dưới đổi nội
dung theo lựa chọn để khách biết trước bước tiếp theo.

Danh sách lấy từ `GET /api/orders/payment-methods` (`shopService.js ›
getPaymentMethods()`), có sẵn bản dựng trước trong hằng `MAC_DINH_PHUONG_THUC`
để trang hiện ngay không phải chờ API. Lựa chọn nào cửa hàng chưa bật thì hiện
mờ và không bấm được; nếu đang chọn đúng cái vừa bị tắt thì tự kéo về cách còn
dùng được.

`pages/OrderDetail.jsx` dùng cờ `laChuyenKhoan = order.payment_method === "BANK_QR"`
để hiện **đúng một** trong hai khối: khung QR, hoặc hướng dẫn mang mã đơn ra
cửa hàng. Đơn cũ (`COD`, `AT_STORE`) rơi vào nhánh tiền mặt.

## Lọc và sắp xếp kho sản phẩm bên admin

`pages/admin/AdminDashboard.jsx` — thanh công cụ mục **Sản phẩm** thêm hai ô
chọn cạnh ô tìm kiếm:

- **Danh mục** — liệt kê đủ 30 danh mục kèm số sản phẩm sẵn có, ví dụ
  `Bột pha (31)`. Con số này lấy từ danh sách danh mục đã tải cho mục
  "Danh mục", không phải gọi thêm API.
- **Sắp xếp** — mặc định (đánh giá cao trước), giá thấp→cao, giá cao→thấp,
  đánh giá thấp→cao, đánh giá cao→thấp. Giá trị khớp hằng `SORTS` bên backend.

Nút `✕` chỉ hiện khi đang có lọc hoặc sắp xếp, bấm một cái là về mặc định.

### Ba chi tiết dễ sai nếu làm lại

**Đổi bộ lọc phải về trang 1.** Hàm bọc `doiLoc()` gọi `setPage(1)` kèm mỗi lần
đổi. Đang ở trang 5 mà lọc xuống còn 31 sản phẩm thì trang 5 trống trơn, trông
như mất dữ liệu.

**Lưu/xoá xong phải giữ nguyên bộ lọc.** Hai lời gọi tải lại sau khi lưu và sau
khi xoá đều truyền kèm `categoryId` và `sort` đang chọn. Thiếu chỗ này thì sửa
xong một sản phẩm là danh sách nhảy về mặc định, admin phải chọn lại từ đầu.

**Lọc chạy trên server, không phải trên trang.** `services/adminService.js ›
getAdminProducts()` đẩy `categoryId`/`sort` lên query string và chỉ ghi khoá khi
có giá trị. Lọc ở phía trình duyệt thì chỉ lọc được 10 dòng của trang hiện tại,
vô nghĩa với kho vài trăm sản phẩm.

### Đã xác nhận trên trình duyệt

Chọn "Đánh giá: thấp → cao" — bảng xếp lại 0, 0, 2, 3, 3, 3, 3.5, 3.6. Chọn
thêm danh mục "Bột pha" — còn đúng 31 bản ghi, cột danh mục chỉ một giá trị,
thứ tự sao vẫn tăng dần.
