# TASK: Xác thực người dùng (Firebase Auth + Neo4j)

> **Người nhận task:** thành viên phụ trách Auth
> **Ngày giao:** 27/07/2026
> **Ước lượng:** 4–5 ngày công
> **Nhánh git đề xuất:** `feature/auth`

---

## 0. Đọc phần này trước — 3 điều dễ hiểu sai

### 0.1 Firebase KHÔNG thay thế node `Customer` trong Neo4j

Firebase chỉ trả lời *"người này là ai"*. Toàn bộ tính năng gợi ý của đồ án chạy trên quan hệ
`BOUGHT` trong Neo4j — Firebase không biết gì về đồ thị đó.

Luồng bắt buộc phải là:

```
User đăng nhập Firebase
   → Frontend nhận ID token
   → Backend xác thực token bằng firebase-admin
   → Backend tra/tạo node (:Customer) tương ứng trong Neo4j
   → Chạy Query A trên node đó
```

Nghĩa là **vẫn phải tạo node `Customer`** cho mỗi tài khoản đăng ký, và lưu ánh xạ
`firebase_uid` ↔ `customer_id`.

### 0.2 Không được dùng "lấy max rồi +1" để sinh `customer_id`

Database hiện có 3.539 khách với `customer_id` dạng `C001`–`C3539`, và có **UNIQUE constraint**
trên trường này. Nếu sinh id mới bằng cách đếm max rồi cộng 1, hai người đăng ký cùng lúc sẽ
tạo ra id trùng nhau → bị constraint chặn → lỗi 500.

**Cách làm đúng:** dùng thẳng Firebase UID làm khoá, id có dạng `U_<firebase_uid>`.
Vì id sinh ra từ UID nên `MERGE` là *idempotent* — gọi bao nhiêu lần cũng chỉ ra 1 node,
không cần đếm, không có race condition.

Format sẽ lẫn `C001` với `U_abc123...`, nhưng đây lại là **ưu điểm**: nhìn id là biết ngay đâu là
khách hàng import (dữ liệu nền cho thuật toán) và đâu là tài khoản đăng ký thật. Tiện cho cả demo
lẫn viết báo cáo.

### 0.3 Tài khoản mới sẽ KHÔNG có gợi ý — đó là bài toán cold-start, phải xử lý

Tài khoản vừa đăng ký có 0 lượt mua → Query A trả về rỗng → trang chủ trắng trơn.

Xử lý bằng chiến lược 2 giai đoạn (chi tiết ở task A6 và A10):

| Trạng thái | Section trang chủ | Nguồn |
|---|---|---|
| Chưa mua gì | **"Sản phẩm bán chạy"** | Query C (đếm số cạnh `BOUGHT`) |
| Đã mua ≥ 1 | **"Gợi ý dành cho bạn"** | Query A (pattern đề bài) |

Chỉ cần mua **1 sản phẩm** là Query A ra kết quả ngay (đã kiểm chứng: 1.000/1.000 sản phẩm đều có
đường đi đồng mua). Nên task A11 + A12 (nút "Mua") là **bắt buộc**, không phải tuỳ chọn.

---

## 1. Hiện trạng hệ thống (để khỏi phải đọc hết code)

### Database Neo4j — đã import xong, đừng chạy lại `npm run import`

| Node / Quan hệ | Số lượng | Thuộc tính |
|---|---|---|
| `Product` | 1.000 | `id`, `title`, `final_price`, `rating`, `image` |
| `Category` | 29 | `category_id`, `category_name` |
| `Customer` | 3.539 | `customer_id`, `customer_name` |
| `(Product)-[:BELONGS_TO]->(Category)` | 1.000 | — |
| `(Customer)-[:BOUGHT]->(Product)` | 24.815 | `rating_stars` |
| `(Customer)-[:VIEWED]->(Product)` | ~35.3k | `last_viewed_at` (chỉ có ở bản ghi mới) |

Constraint UNIQUE hiện có: `Product.id`, `Category.category_id`, `Customer.customer_id`.

**Chưa có** `email`, `password_hash`, `firebase_uid` — task A2 sẽ thêm.

### Backend (`backend/`) — đã xong task 2.1–2.6

```
db.js                 driver + helper readQuery() / writeQuery() / int
server.js             Express, gắn route, error handler tập trung
queries/cypher.js     TOÀN BỘ câu Cypher — thêm query mới vào đây, đừng viết rải rác
routes/products.js    GET /api/products, /:id, /:id/recommendations
routes/customers.js   GET /api/customers, /:id, /:id/recommendations
utils/http.js         asyncHandler, HttpError, parsePagination, buildPagination
scripts/test-api.js   smoke test — chạy `npm run test:api`, hiện 34/34 pass
```

Endpoint đang có (tất cả đều public, chưa có auth):

| Method | Endpoint |
|---|---|
| GET | `/api/products?page=&limit=&search=&categoryId=` |
| GET | `/api/products/:id` — có ghi `VIEWED` nếu gửi header `x-customer-id` |
| GET | `/api/products/:id/recommendations` — **Query B** |
| GET | `/api/customers?page=&limit=&search=` |
| GET | `/api/customers/:id` |
| GET | `/api/customers/:id/recommendations` — **Query A** |

### Frontend (`frontend/src/`) — đã xong task 2.7–3.3

```
context/CustomerContext.jsx    { customerId, setCustomerId }  ← task A7 sẽ THAY THẾ file này
layouts/Header.jsx             dropdown chọn khách (đăng nhập giả lập) ← A9 thay bằng tên user
layouts/MainLayout.jsx         Header + <Outlet />
router/AppRouter.jsx           / và /product/:id
pages/Home.jsx                 danh sách SP + tìm kiếm + phân trang + section gợi ý
pages/ProductDetail.jsx        chi tiết SP + "Khách khác cũng mua"
components/ProductCard.jsx     thẻ 1 sản phẩm
components/ProductList.jsx     lưới sản phẩm
components/RecommendationList.jsx     "Khách khác cũng mua" (Query B)
components/RecommendationSection.jsx  "Gợi ý dành cho bạn" (Query A)
components/ErrorMessage.jsx    hộp báo lỗi + nút "Thử lại"  ← DÙNG LẠI, đừng viết mới
services/productService.js     gọi API sản phẩm
services/customerService.js    gọi API khách hàng
```

> ⚠️ Có 2 file `Header.jsx` (`components/` và `layouts/`). Bản đang **thực sự chạy** là
> `layouts/Header.jsx`. Bản trong `components/` là code chết — sửa nhầm file đó sẽ không thấy
> gì thay đổi. Nên xoá `components/Header.jsx` khi làm task A9.

---

## 2. Quy ước chung

- **Mọi câu Cypher mới → viết vào `backend/queries/cypher.js`**, không rải trong route.
- Route async → bọc bằng `asyncHandler`, ném lỗi bằng `new HttpError(status, message)`.
- Trả lỗi có chủ đích (400/401/404) bằng `HttpError`; đừng để rơi vào 500.
- Frontend báo lỗi → dùng lại `components/ErrorMessage.jsx`.
- **KHÔNG commit** file service account key của Firebase. Thêm vào `.gitignore` **trước** khi tải về.
- Sau mỗi task backend, chạy `npm run test:api` để chắc chắn 34 test cũ vẫn pass.

---

## 3. Danh sách task

### A1 — Tạo Firebase project · 0.5 ngày

1. Tạo project trên [console.firebase.google.com](https://console.firebase.google.com).
2. Bật **Authentication** → Sign-in method → bật **Email/Password** và **Google**.
3. Lấy **web config** (apiKey, authDomain, projectId...) → dùng cho frontend.
4. Vào **Project settings → Service accounts → Generate new private key** → tải file JSON về.
   Đặt tại `backend/firebase-service-account.json`.
5. **Thêm 2 dòng này vào `.gitignore` TRƯỚC khi tải file về:**
   ```
   firebase-service-account.json
   backend/firebase-service-account.json
   ```

**Đạt khi:** đăng ký thử 1 tài khoản trên Firebase Console thấy hiện trong tab Users.

> Nhóm đã từng lỡ commit `backend/.env` chứa mật khẩu Aura lên GitHub. Đừng lặp lại với file này.

---

### A2 — Mở rộng schema `Customer` · 0.5 ngày

Thêm constraint UNIQUE cho `firebase_uid`:

```cypher
CREATE CONSTRAINT customer_firebase_uid_unique IF NOT EXISTS
FOR (c:Customer) REQUIRE c.firebase_uid IS UNIQUE;
```

Node `Customer` của tài khoản đăng ký sẽ có thêm: `firebase_uid`, `email`, `created_at`.
3.539 khách import cũ **không** có các trường này — đó là bình thường, không cần backfill.

**Đạt khi:** `SHOW CONSTRAINTS` thấy constraint mới; 3.539 khách cũ vẫn nguyên vẹn
(`MATCH (c:Customer) RETURN count(c)` vẫn ra 3539).

---

### A3 — Middleware xác thực Firebase token · 0.5 ngày

Cài `firebase-admin`. Tạo `backend/middleware/auth.js`:

- Đọc header `Authorization: Bearer <token>`.
- Verify bằng `admin.auth().verifyIdToken(token)`.
- Gắn kết quả vào `req.user = { uid, email, name }`.
- Token thiếu / sai / hết hạn → `throw new HttpError(401, '...')`.

Làm thêm bản `optionalAuth`: có token thì gắn `req.user`, không có thì cho qua với
`req.user = null` (dùng cho endpoint vừa phục vụ khách vãng lai vừa phục vụ user đăng nhập).

**Đạt khi:** gọi endpoint có bảo vệ mà không gửi token → 401 JSON (không phải 500).

---

### A4 — `POST /api/auth/sync` · 0.5 ngày

Đây là endpoint **quan trọng nhất**. Nó thay cho cả register lẫn login, vì với Firebase thì hai
việc đó kết thúc ở cùng một chỗ: *"tôi có token hợp lệ, hãy đảm bảo tôi có node Customer"*.

- **Header:** `Authorization: Bearer <token>` (bắt buộc)
- **Body:** không cần — tên và email lấy từ token
- **Xử lý:** `MERGE` node `Customer` theo `customer_id = 'U_' + req.user.uid`

Cypher gợi ý (viết vào `queries/cypher.js`):

```cypher
MERGE (c:Customer {customer_id: $customerId})
ON CREATE SET c.firebase_uid  = $firebaseUid,
              c.customer_name = $customerName,
              c.email         = $email,
              c.created_at    = datetime()
ON MATCH  SET c.customer_name = $customerName,
              c.email         = $email
RETURN c.customer_id   AS customer_id,
       c.customer_name AS customer_name,
       c.email         AS email,
       count { (c)-[:BOUGHT]->(:Product) } AS bought_count
```

- **Response 200:**
  ```json
  {
    "data": {
      "customer_id": "U_x7Kf9...",
      "customer_name": "Nguyễn Văn A",
      "email": "a@gmail.com",
      "bought_count": 0
    }
  }
  ```

Frontend gọi endpoint này **ngay sau khi đăng nhập/đăng ký thành công**.

**Đạt khi:** gọi 2 lần liên tiếp với cùng token chỉ tạo ra **1** node
(`MATCH (c:Customer) WHERE c.firebase_uid = '...' RETURN count(c)` = 1).

---

### A5 — `GET /api/auth/me` · 0.25 ngày

- **Header:** `Authorization: Bearer <token>` (bắt buộc)
- Trả về đúng shape như A4.
- Có token hợp lệ nhưng chưa từng gọi `/sync` → **404** (frontend sẽ gọi `/sync` rồi thử lại).

**Đạt khi:** token hỏng → 401; token đúng mà chưa sync → 404; đã sync → 200 kèm `bought_count`.

---

### A6 — `GET /api/products/popular` (Query C) · 0.5 ngày

Phục vụ tài khoản chưa mua gì (mục 0.3). **Public**, không cần token.

```cypher
MATCH (p:Product)<-[:BOUGHT]-(c:Customer)
WITH p, count(DISTINCT c) AS score
OPTIONAL MATCH (p)-[:BELONGS_TO]->(cat:Category)
RETURN p.id             AS id,
       p.title          AS title,
       p.final_price    AS final_price,
       p.rating         AS rating,
       p.image          AS image,
       cat.category_name AS category_name,
       score
ORDER BY score DESC, coalesce(p.rating, 0) DESC, p.id ASC
LIMIT $limit
```

- **Query param:** `limit` (mặc định 8)
- **Response:** `{ "source": "popularity", "count": 8, "data": [...] }`

> Query C **không duyệt sâu đồ thị**, nên không dùng nó để chứng minh Tiêu chí 3. Nó chỉ lấp chỗ
> trống cho tài khoản mới. Khi thuyết trình phải nói rõ điểm khác biệt này so với Query A/B.

**Đạt khi:** trả về 8 sản phẩm, `score` giảm dần, phản hồi < 1 giây.

---

### A7 — `POST /api/customers/me/buy/:productId` · 0.5 ngày

Đây chính là **task 3.4** trong kế hoạch gốc — với auth thì nó thành **bắt buộc**, vì không có
nút mua thì tài khoản mới vĩnh viễn kẹt ở trạng thái cold-start.

- **Header:** `Authorization: Bearer <token>` (bắt buộc)
- Lấy `customer_id` **từ token**, không lấy từ URL (tránh mua hộ người khác).
- `MERGE (c)-[b:BOUGHT]->(p)` + `SET b.rating_stars = 5, b.bought_at = datetime()`
- Sản phẩm không tồn tại → 404.

**Response 200:** `{ "data": { "customer_id": "...", "product_id": "...", "bought_count": 1 } }`

**Đạt khi:** gọi xong → `GET /api/auth/me` thấy `bought_count` tăng; gọi lại lần 2 cùng sản phẩm
thì `bought_count` **không** tăng nữa (MERGE chống trùng).

---

### A8 — Bảo vệ endpoint + chuyển task 2.5 sang dùng token · 0.5 ngày

1. Gắn middleware A3 cho: `/api/auth/me`, `/api/customers/me/*`.
2. `GET /api/products/:id` đang nhận `x-customer-id` qua header (task 2.5, tạm bợ). Đổi sang
   `optionalAuth`: **có token thì ghi `VIEWED` theo user trong token**, không có thì chỉ đọc.
   Giữ nguyên `x-customer-id` thêm một thời gian để không phá frontend đang chạy.
3. Xoá `TODO(security)` trong `routes/products.js` sau khi làm xong.

**Đạt khi:** `npm run test:api` vẫn **34/34 pass** (các endpoint public không được đổi hành vi).

---

### A9 — `AuthContext` thay `CustomerContext` · 1 ngày

Cài `firebase` (SDK web). Tạo `frontend/src/context/AuthContext.jsx` cung cấp:

```
{ user, customer, loading, register(), login(), loginWithGoogle(), logout() }
```

- Dùng `onAuthStateChanged` để **tự khôi phục phiên khi F5** (Firebase tự lo, không cần localStorage).
- Sau khi đăng nhập thành công → gọi `POST /api/auth/sync` → lưu kết quả vào `customer`.
- `customer.customer_id` chính là giá trị thay thế cho `customerId` của `CustomerContext` cũ.

**Phải sửa theo (đây là thay đổi phá vỡ) — đúng 5 file đang dùng `CustomerContext`:**

| File | Việc cần làm |
|---|---|
| `main.jsx` | Đổi `<CustomerProvider>` → `<AuthProvider>`. **Quên file này là cả app hỏng.** |
| `layouts/Header.jsx` | Bỏ dropdown, dùng `user` / `logout` (làm luôn ở A11) |
| `pages/ProductDetail.jsx` | `customerId` → `customer?.customer_id` |
| `components/RecommendationSection.jsx` | `customerId` → `customer?.customer_id` (làm luôn ở A12) |
| `components/Header.jsx` | **File chết** — xoá hẳn, không cần sửa |

`pages/Home.jsx` **không** dùng context (nó chỉ render `<RecommendationSection />`), nên không phải sửa ở task này.

Xoá `context/CustomerContext.jsx` sau khi chuyển xong.

**Đạt khi:** đăng nhập → F5 → **vẫn còn đăng nhập**.

---

### A10 — Trang Đăng ký / Đăng nhập · 1 ngày

- `pages/Register.jsx` — email, mật khẩu, tên hiển thị
- `pages/Login.jsx` — email, mật khẩu + nút **"Đăng nhập bằng Google"**
- Thêm route `/register`, `/login` vào `router/AppRouter.jsx`

Dịch mã lỗi Firebase sang tiếng Việt, đừng để lộ mã kỹ thuật cho người dùng:

| Mã Firebase | Hiển thị |
|---|---|
| `auth/email-already-in-use` | Email này đã được đăng ký |
| `auth/invalid-credential` | Email hoặc mật khẩu không đúng |
| `auth/weak-password` | Mật khẩu phải từ 6 ký tự trở lên |
| `auth/invalid-email` | Email không hợp lệ |

**Đạt khi:** nhập sai hiện lỗi tiếng Việt rõ ràng, không trắng trang, không hiện mã lỗi thô.

---

### A11 — Protected route + Header mới · 0.5 ngày

- Component `ProtectedRoute`: chưa đăng nhập → điều hướng về `/login`.
- Header: **bỏ dropdown chọn khách**, thay bằng tên user + nút "Đăng xuất".
- Đang `loading` (Firebase chưa kiểm tra xong phiên) → hiện `Loading` component, **đừng** đá về
  `/login` vội, nếu không F5 sẽ bị văng ra ngoài.

**Đạt khi:** chưa đăng nhập vào `/` → về `/login`; đăng nhập rồi → vào bình thường, Header hiện tên.

---

### A12 — Section trang chủ 2 trạng thái · 0.5 ngày

Sửa `components/RecommendationSection.jsx`:

| Điều kiện | Tiêu đề | API gọi |
|---|---|---|
| `customer.bought_count === 0` | **"🔥 Sản phẩm bán chạy"** + dòng phụ *"Mua sản phẩm đầu tiên để nhận gợi ý riêng cho bạn"* | `GET /api/products/popular` |
| `customer.bought_count > 0` | **"🎯 Gợi ý dành cho bạn"** | `GET /api/customers/:id/recommendations` |

> **Bắt buộc đổi tiêu đề theo trạng thái.** Để nguyên chữ "Gợi ý dành cho bạn" trong khi thực chất
> đang hiện hàng bán chạy là sai bản chất — hội đồng hỏi *"gợi ý này dựa trên cái gì?"* sẽ không
> trả lời được.

**Đạt khi:** tài khoản mới thấy "Sản phẩm bán chạy"; mua 1 món xong thấy đổi thành "Gợi ý dành cho bạn".

---

### A13 — Nút "Mua" ở trang chi tiết · 0.5 ngày

Đây là **task 3.5** gốc. Thêm nút "Mua ngay" vào `pages/ProductDetail.jsx`:

- Gọi `POST /api/customers/me/buy/:productId` (A7)
- Mua xong → làm mới `customer` trong `AuthContext` để `bought_count` cập nhật
- Chưa đăng nhập → điều hướng sang `/login`

**Đạt khi:** mua 1 sản phẩm → quay về trang chủ thấy section đã đổi sang "Gợi ý dành cho bạn".

---

### A14 — Kiểm thử + viết báo cáo · 1 ngày

Bảng test case tối thiểu:

| # | Kịch bản | Kết quả mong đợi |
|---|---|---|
| 1 | Đăng ký email mới | Tạo 1 node `Customer` mới, `bought_count = 0` |
| 2 | Đăng ký trùng email | Báo "Email này đã được đăng ký" |
| 3 | Đăng nhập sai mật khẩu | Báo "Email hoặc mật khẩu không đúng" |
| 4 | Đăng nhập bằng Google | Tạo node mới, vào thẳng trang chủ |
| 5 | F5 sau khi đăng nhập | Vẫn còn đăng nhập |
| 6 | Gọi `/api/auth/me` không token | 401 |
| 7 | Gọi `/api/auth/me` token rác | 401 |
| 8 | `/api/auth/sync` 2 lần cùng token | Chỉ 1 node được tạo |
| 9 | Tài khoản mới vào trang chủ | Hiện "Sản phẩm bán chạy" |
| 10 | Mua 1 sản phẩm | Section đổi thành "Gợi ý dành cho bạn" |
| 11 | Mua lại đúng sản phẩm đó | `bought_count` không tăng |
| 12 | Đăng xuất | Về `/login`, không vào được `/` |

Phần viết vào báo cáo:
- Sơ đồ luồng: Firebase → ID token → backend verify → node `Customer` → Query A
- **Giải thích vì sao vẫn cần node `Customer`** dù đã có Firebase (mục 0.1)
- Cách xử lý cold-start và **phân biệt rõ Query C với Query A/B** (mục 0.3 + A6)

---

## 4. Kịch bản demo (dùng khi bảo vệ)

1. Đăng ký tài khoản mới **ngay tại chỗ** trước hội đồng
2. Trang chủ hiện **"🔥 Sản phẩm bán chạy"**
3. Bấm vào 1 sản phẩm → mua
4. Về trang chủ → section đổi thành **"🎯 Gợi ý dành cho bạn"**
5. Mua thêm 1 món khác danh mục → gợi ý đổi tiếp

Đây là thứ chứng minh trực quan nhất rằng đồ thị đang thực sự hoạt động.

> **Dự phòng:** chuẩn bị sẵn 1 tài khoản đã có lịch sử mua, phòng khi đăng ký tại chỗ trục trặc.

---

## 5. Nếu nhóm đổi ý, không dùng Firebase nữa

Chuyển sang tự làm JWT + bcrypt thì:

- **A1** → bỏ (không cần Firebase project)
- **A3** → tự verify JWT bằng `jsonwebtoken` thay vì `firebase-admin`
- **A4** → tách thành `POST /api/auth/register` (hash mật khẩu bằng `bcrypt`) và
  `POST /api/auth/login`. Lúc này `customer_id` sinh bằng `randomUUID()` — **vẫn tuyệt đối không
  dùng max+1** (lý do ở mục 0.2)
- **A9/A10** → tự lưu token vào `localStorage`, mất nút "Đăng nhập bằng Google"
- **A2, A5–A8, A11–A14** → giữ nguyên

Công sức hai hướng gần như bằng nhau.

---

## 6. Lưu ý cuối

Phần Auth **không nằm trong Tiêu chí 3** — tiêu chí đó chấm phần biểu diễn đồ thị và câu Cypher
duyệt sâu, không chấm đăng nhập.

Nếu quỹ thời gian eo hẹp, **ưu tiên A6 + A7 + A12 + A13 trước** (cold-start và nút mua) vì chúng
phục vụ trực tiếp phần được chấm điểm. Phần đăng nhập có thể rút gọn.
