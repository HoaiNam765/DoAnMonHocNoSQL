# BACKEND_CHANGES.md — Báo cáo thay đổi Backend (Task A2 → A8)

> **Ngày thực hiện:** 28/07/2026  
> **Phạm vi:** Backend authentication & authorization (Firebase Auth + Neo4j)

---

## 📁 Tổng quan thay đổi

| Hành động | File | Task |
|---|---|---|
| **MỚI** | `backend/firebase.js` | A3 |
| **MỚI** | `backend/middleware/auth.js` | A3 |
| **MỚI** | `backend/routes/auth.js` | A4, A5 |
| **MỚI** | `backend/scripts/setup-auth.js` | A2 |
| **SỬA** | `backend/queries/cypher.js` | A4, A5, A6, A7 |
| **SỬA** | `backend/routes/products.js` | A6, A8 |
| **SỬA** | `backend/routes/customers.js` | A7, A8 |
| **SỬA** | `backend/server.js` | A4, A5 |
| **SỬA** | `backend/package.json` | A2, A3 |
| **SỬA** | `.gitignore` | A3 |

---

## 📝 Chi tiết từng task

### Task A2 — Mở rộng schema Customer trong Neo4j

**File tạo mới:**
- `backend/scripts/setup-auth.js` — Script Node.js chạy câu Cypher tạo constraint UNIQUE cho `firebase_uid`:
  ```cypher
  CREATE CONSTRAINT customer_firebase_uid_unique IF NOT EXISTS
  FOR (c:Customer) REQUIRE c.firebase_uid IS UNIQUE
  ```
  Chạy bằng: `npm run setup:auth`

**File sửa:**
- `backend/package.json` — Thêm script `"setup:auth": "node scripts/setup-auth.js"`

---

### Task A3 — Middleware xác thực Firebase token

**File tạo mới:**
- `backend/firebase.js` — Khởi tạo Firebase Admin SDK (singleton). Đọc service account key từ `firebase-service-account.json`. Kiểm tra file tồn tại trước khi init, tránh lỗi khi nodemon restart.

- `backend/middleware/auth.js` — 2 middleware:
  - `verifyToken`: Bắt buộc token hợp lệ. Đọc `Authorization: Bearer <token>`, verify bằng `admin.auth().verifyIdToken()`, gắn `req.user = { uid, email, name }`. Ném `HttpError(401)` nếu thiếu/sai/hết hạn.
  - `optionalAuth`: Có token → gắn `req.user`, không có → `req.user = null`. Không bao giờ ném lỗi. Dùng cho endpoint phục vụ cả khách vãng lai.

**File sửa:**
- `.gitignore` — Thêm 2 dòng:
  ```
  firebase-service-account.json
  backend/firebase-service-account.json
  ```
- `backend/package.json` — Thêm dependency `firebase-admin`

---

### Task A4 — Endpoint POST /api/auth/sync

**File tạo mới:**
- `backend/routes/auth.js` — Route `POST /sync`:
  - Bắt buộc `verifyToken`
  - `MERGE` node Customer theo `customer_id = 'U_' + uid`
  - ON CREATE: gán `firebase_uid`, `customer_name`, `email`, `created_at`
  - ON MATCH: chỉ cập nhật `customer_name`, `email`
  - Trả `{ data: { customer_id, customer_name, email, bought_count } }`

**File sửa:**
- `backend/queries/cypher.js` — Thêm câu Cypher `SYNC_CUSTOMER`
- `backend/server.js` — Import `authRoutes`, mount tại `/api/auth`

---

### Task A5 — Endpoint GET /api/auth/me

**File sửa:**
- `backend/routes/auth.js` — Route `GET /me`:
  - Bắt buộc `verifyToken`
  - Tra cứu node Customer theo `firebase_uid`
  - Chưa sync → `HttpError(404)`
  - Đã sync → trả cùng shape như `/sync`

- `backend/queries/cypher.js` — Thêm câu Cypher `GET_CUSTOMER_BY_FIREBASE_UID`

---

### Task A6 — Endpoint GET /api/products/popular (Query C)

**File sửa:**
- `backend/queries/cypher.js` — Thêm câu Cypher `POPULAR_PRODUCTS`:
  ```cypher
  MATCH (p:Product)<-[:BOUGHT]-(c:Customer)
  WITH p, count(DISTINCT c) AS score
  OPTIONAL MATCH (p)-[:BELONGS_TO]->(cat:Category)
  RETURN ... ORDER BY score DESC LIMIT $limit
  ```

- `backend/routes/products.js` — Thêm route `GET /popular`:
  - Public (không cần token)
  - Query param `limit` (mặc định 8, tối đa 50)
  - Trả `{ source: "popularity", count, data: [...] }`
  - **Khai báo TRƯỚC `/:id`** để Express không nhầm "popular" là id

---

### Task A7 — Endpoint POST /api/customers/me/buy/:productId

**File sửa:**
- `backend/queries/cypher.js` — Thêm 2 câu Cypher:
  - `BUY_PRODUCT`: MERGE quan hệ BOUGHT, ON CREATE SET `rating_stars = 5`, `bought_at = datetime()`
  - `CHECK_PRODUCT_EXISTS`: Kiểm tra sản phẩm tồn tại trước khi mua

- `backend/routes/customers.js` — Thêm route `POST /me/buy/:productId`:
  - Bắt buộc `verifyToken`
  - `customer_id` lấy từ token (`'U_' + uid`), **KHÔNG** lấy từ URL → chống mua hộ người khác
  - Kiểm tra sản phẩm tồn tại → 404 nếu không
  - MERGE chống trùng: mua lại cùng sản phẩm không tạo thêm cạnh
  - Trả `{ data: { customer_id, product_id, bought_count } }`
  - **Khai báo TRƯỚC `/:id`** để Express không nhầm "me" là id

---

### Task A8 — Bảo vệ Endpoint & Cập nhật VIEWED

**File sửa:**
- `backend/routes/products.js` — Cập nhật `GET /:id`:
  - Thêm middleware `optionalAuth`
  - Ưu tiên `req.user.uid` → `'U_' + uid` cho customerId
  - Fallback sang header `x-customer-id` (tương thích ngược frontend cũ)
  - **Xoá `TODO(security)`** vì đã có auth thực
  - Import `optionalAuth` từ `middleware/auth.js`

- `backend/routes/customers.js`:
  - Import `verifyToken` và `writeQuery` từ modules tương ứng
  - Route `POST /me/buy/:productId` được bảo vệ bằng `verifyToken`

- `backend/routes/auth.js`:
  - `GET /me` được bảo vệ bằng `verifyToken`
  - `POST /sync` được bảo vệ bằng `verifyToken`

---

## 🔐 Bảo mật

- Firebase Admin SDK verify token **server-side** → không trust client-side data
- `customer_id` lấy từ token đã verify, không từ URL → chống giả mạo (IDOR)
- Service account key nằm trong `.gitignore` → không commit lên repo
- Tất cả câu Cypher dùng tham số (`$param`) → chống injection
- Error handler tập trung: lỗi 500 trả message generic, không leak thông tin hệ thống
- Middleware `optionalAuth` cho endpoint hỗn hợp (vãng lai + đăng nhập)

---

## 📋 Endpoint mới (tổng hợp)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| `POST` | `/api/auth/sync` | ✅ verifyToken | Đồng bộ user Firebase ↔ Neo4j |
| `GET` | `/api/auth/me` | ✅ verifyToken | Lấy thông tin user hiện tại |
| `GET` | `/api/products/popular` | ❌ Public | Sản phẩm phổ biến (Query C) |
| `POST` | `/api/customers/me/buy/:productId` | ✅ verifyToken | Mua sản phẩm |

---

## ⚠️ Lưu ý quan trọng

1. **Chạy `npm run setup:auth`** trước khi sử dụng — tạo constraint UNIQUE cho `firebase_uid`
2. **Cài `firebase-admin`**: `npm install firebase-admin` (nếu chưa cài)
3. File `firebase-service-account.json` phải nằm tại `backend/` — tải từ Firebase Console
4. Các endpoint public cũ **không thay đổi hành vi** — test cũ 34/34 phải vẫn pass

---

# Bổ sung — Admin Management Dashboard

> **Ngày thực hiện:** 31/07/2026
> **Phạm vi:** Phân quyền Admin và API quản lý hệ thống

## 1. Middleware kiểm tra quyền Admin

**File tạo mới:**
- `backend/middleware/adminAuth.js`

Middleware `requireAdmin` thực hiện tuần tự:
1. Dùng lại `verifyToken` để xác thực Firebase ID Token.
2. Lấy `firebase_uid` từ token đã xác thực, không tin dữ liệu do client gửi lên.
3. Tra cứu Customer tương ứng trong Neo4j.
4. Kiểm tra role từ `HAS_ROLE -> Role` hoặc thuộc tính `c.role`.
5. Trả lỗi phù hợp: `401` nếu token không hợp lệ, `404` nếu tài khoản chưa sync, `403` nếu không có role `admin`.

Toàn bộ route trong `backend/routes/admin.js` dùng middleware này ở cấp router, nên các API quản trị đều được bảo vệ.

## 2. Script cấp quyền Admin

**File tạo mới:**
- `backend/scripts/setup-admin.js`

Script cho phép cấp role Admin theo email, `customer_id` hoặc `firebase_uid`.

```bash
cd backend
npm run setup:admin -- admin@example.com
```

Script dùng query `ADMIN_UPDATE_USER_ROLE`, tạo/cập nhật node `Role { role_name: 'admin' }` và quan hệ `HAS_ROLE` với Customer tương ứng.

## 3. API Admin

**File tạo mới:**
- `backend/routes/admin.js`

Router được mount tại `/api/admin` trong `backend/server.js`.

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/admin/stats` | Tổng sản phẩm, khách hàng, danh mục, lượt mua, doanh thu và giao dịch gần nhất |
| `GET` | `/api/admin/categories` | Danh sách danh mục kèm số lượng sản phẩm |
| `POST` | `/api/admin/categories` | Tạo danh mục mới |
| `PUT` | `/api/admin/categories/:id` | Cập nhật tên/trạng thái danh mục |
| `DELETE` | `/api/admin/categories/:id` | Ẩn danh mục |
| `GET` | `/api/admin/products` | Danh sách sản phẩm có tìm kiếm, lọc và phân trang |
| `POST` | `/api/admin/products` | Tạo sản phẩm mới |
| `PUT` | `/api/admin/products/:id` | Cập nhật tên, giá, rating, ảnh, tồn kho và danh mục |
| `DELETE` | `/api/admin/products/:id` | Đánh dấu sản phẩm `deleted` |
| `GET` | `/api/admin/users` | Danh sách người dùng có tìm kiếm và phân trang |
| `GET` | `/api/admin/users/:id` | Chi tiết người dùng và lịch sử mua/xem |
| `PUT` | `/api/admin/users/:id/role` | Đổi role `admin` hoặc `user` |
| `PUT` | `/api/admin/users/:id/status` | Khóa/mở khóa tài khoản |

## 4. Cypher dành cho Admin

**File cập nhật:**
- `backend/queries/cypher.js`

Đã bổ sung các query tập trung trong một file theo quy ước dự án:
- `ADMIN_GET_STATS`, `ADMIN_REVENUE_BY_CATEGORY`, `ADMIN_RECENT_ORDERS`.
- `ADMIN_LIST_CATEGORIES`, `ADMIN_CREATE_CATEGORY`, `ADMIN_UPDATE_CATEGORY`, `ADMIN_DELETE_CATEGORY`.
- `ADMIN_CREATE_PRODUCT`, `ADMIN_UPDATE_PRODUCT`, `ADMIN_DELETE_PRODUCT`.
- `ADMIN_LIST_USERS`, `ADMIN_COUNT_USERS`, `ADMIN_GET_USER_DETAILS`.
- `ADMIN_UPDATE_USER_ROLE`, `ADMIN_UPDATE_USER_STATUS`.

Các query đều dùng tham số Cypher, không ghép trực tiếp dữ liệu người dùng vào câu lệnh.

## 5. Xác nhận triển khai

- Backend đã mount router tại `/api/admin`.
- Endpoint gốc `/` đã liệt kê nhóm Admin endpoints.
- Các endpoint Admin không làm thay đổi hành vi các API public cũ.
- Frontend production build thành công sau khi tích hợp Admin Dashboard.
