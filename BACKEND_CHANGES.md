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
