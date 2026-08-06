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

## 6. Chatbot tư vấn khách hàng (Gemini)

**File mới:**
- `backend/queries/chatCypher.js` — chỉ chứa câu lệnh ĐỌC (`CHAT_SEARCH_PRODUCTS`, `CHAT_LIST_CATEGORIES`).
- `backend/services/geminiChat.js` — cầu nối giữa Gemini và Neo4j theo cơ chế function calling.
- `backend/routes/chat.js` — `POST /api/chat`.

**File cập nhật:**
- `backend/server.js` — mount `/api/chat`.
- `.env` (thư mục gốc) — thêm `GEMINI_API_KEY`, `GEMINI_MODEL`.

### Vì sao an toàn

Mô hình ngôn ngữ **không bao giờ sinh Cypher**. Nó chỉ được điền giá trị vào
tham số `$...` của hai câu lệnh đọc viết sẵn. Danh sách công cụ khai báo cho
Gemini chỉ có `search_products` và `list_categories` — không có công cụ ghi nào,
nên chatbot không thể thêm/sửa/xoá sản phẩm kể cả khi bị dụ.

Việc thêm vào giỏ do **khách tự bấm nút** trên thẻ sản phẩm, đi qua đúng API
giỏ hàng có xác thực như mọi chỗ khác — chatbot không tự thao tác thay khách.

### Chống bịa dữ liệu

Đo thực tế thấy mô hình có lúc trả lời về sản phẩm mà không hề tra cứu. Đã xử lý:
1. Cấm rõ trong system prompt: chưa gọi công cụ thì không được nêu tên/giá nào.
2. Lưới an toàn trong code: nếu chưa tra cứu lần nào mà câu trả lời đã chứa chữ
   số, backend bỏ câu đó và ép mô hình tra cứu lại (`functionCallingConfig.mode = ANY`).

### Hạn mức API (đo thực tế trên gói miễn phí)

| Model | Giới hạn | Ghi chú |
|---|---|---|
| `gemini-2.5-flash-lite` | 20 req/phút | **Đang dùng** |
| `gemini-2.5-flash` | 5 req/phút | Quá thấp, mỗi câu hỏi tốn ~2 lượt gọi |
| `gemini-2.0-flash` | 0 | Bị khoá trên gói miễn phí |

Mỗi câu hỏi đi qua Gemini tốn khoảng 2 lượt gọi API (một lượt chọn công cụ, một
lượt viết câu trả lời) — tức chỉ khoảng 10 câu/phút cho toàn hệ thống. Gặp lỗi
503 (Google quá tải nhất thời) thì tự thử lại một lần.

Con số đó quá thấp để demo, nên đã bổ sung kiến trúc bốn tầng ở mục 7.

## 7. Bốn tầng trả lời — để demo không bị "trợ lý đang quá tải"

**File mới:**
- `backend/services/quickParse.js` — hiểu câu hỏi bằng biểu thức chính quy, không cần AI.
- `backend/services/chatAssistant.js` — điều phối bốn tầng + bộ nhớ đệm + ngân sách Gemini.

Câu hỏi đi lần lượt qua bốn tầng, rẻ trước đắt sau:

| Tầng | Xử lý gì | Lượt gọi Gemini | Thời gian đo được |
|---|---|---|---|
| 1. Bộ nhớ đệm | Câu vừa có người hỏi y hệt (hạn 5 phút) | 0 | ~13 ms |
| 2. Lọc nhanh | Câu khuôn mẫu: "dưới 500k", "tìm áo thun", "danh mục nào" | 0 | 50–170 ms |
| 3. Gemini | Câu phức tạp, diễn đạt tự do | ~2 | 2–3 giây |
| 4. Hạ cấp | Gemini lỗi hoặc hết ngân sách → quay về tầng 2 | 0 | như tầng 2 |

Nhờ tầng 4, khách **không còn nhìn thấy thông báo lỗi kỹ thuật**: xấu nhất là bot
trả lời cộc hơn nhưng vẫn ra đúng sản phẩm lấy từ Neo4j.

### Lọc nhanh hiểu được những gì

Khoảng giá (`dưới 500k`, `trên 200k`, `từ 100k đến 300k`, `khoảng 200k`, `dưới 1
triệu`, `500.000`), sắp xếp (`rẻ nhất`, `đắt nhất`), liệt kê danh mục, chào hỏi,
cảm ơn, và từ chối yêu cầu sửa/xoá dữ liệu. Không chắc thì trả `null` để nhường
cho Gemini — thà nhờ AI còn hơn đoán bừa rồi trả lời sai.

Khi từ khoá dài mà không ra kết quả, hệ thống rút ngắn dần rồi tìm lại: "nồi cơm
điện loại tốt cho gia đình 4 người" → không có → thử "nồi cơm điện" → có hàng.
Có chặn dưới: không rút xuống một chữ ngắn, vì chữ như "tư" là khúc con của rất
nhiều tên sản phẩm, đưa bừa hàng ra còn tệ hơn nói không tìm thấy.

### Hai giới hạn tần suất, đừng nhầm lẫn

- **Ngân sách Gemini** (`chatAssistant.js`): 8 lượt / 5 phút / IP. Vượt thì hạ cấp
  xuống tầng 2, **không báo lỗi**. Chỉ đếm câu thật sự nhờ tới AI.
- **Giới hạn chống lạm dụng** (`routes/chat.js`): 60 lượt / phút / IP, chỉ để
  chặn vòng lặp gọi API.

Bản đầu đặt chung một giới hạn 20 lượt/5 phút cho mọi request. Thử bắn 18 câu
đồng thời thì chính giới hạn của mình chặn mất 11 câu — dù không tốn lượt AI nào.
Đo lại sau khi tách: **18/18 câu trả lời được, 0 lỗi, 0 lượt Gemini, dưới 1 giây**;
lần chạy thứ hai toàn bộ vào đệm, tổng 112 ms.

## 8. Lọc theo giá / danh mục + tin mua hàng

**File mới:** `backend/utils/filters.js` — đọc tham số lọc và che tên khách.

**Endpoint mới:**
- `GET /api/products/categories` — danh mục cho ô lọc (công khai, bỏ danh mục rỗng).
- `GET /api/products/recent-purchases?limit=` — các lượt mua gần nhất cho dòng tin trang chủ.

**Endpoint cũ nhận thêm tham số** `categoryId`, `minPrice`, `maxPrice`:
`GET /api/products`, `GET /api/products/popular`, `GET /api/customers/:id/recommendations`.

### Giữ nguyên Query A và Query C

Nguyên văn hai câu này đã được trích trong báo cáo (Chương 5). Thêm điều kiện lọc
vào đó thì báo cáo không còn khớp mã nguồn. Nên đã tách thành
`RECOMMEND_FOR_CUSTOMER_FILTERED` và `POPULAR_PRODUCTS_FILTERED`, chỉ dùng khi
khách thật sự bật bộ lọc. Không lọc gì thì vẫn chạy đúng câu gốc như báo cáo mô tả.
Phản hồi có thêm trường `filtered` để biết câu nào đã chạy.

Riêng `LIST_PRODUCTS` / `COUNT_PRODUCTS` được sửa trực tiếp (thêm hai dòng lọc
giá) vì hai câu này không xuất hiện trong báo cáo.

### Che tên khách hàng

`maskCustomerName` giữ tên gọi, viết tắt phần còn lại: "Nam Đặng Hoài" → "Nam Đ. H.".
Che ngay tại backend để tên đầy đủ không rời khỏi máy chủ — dòng tin nằm ở trang
chủ, người chưa đăng nhập cũng đọc được, mà ghép họ tên đầy đủ với món vừa mua là
đủ để lộ thói quen mua sắm của một người có thật.

Giá trị lọc không hợp lệ (chữ, số âm) được coi như không lọc thay vì trả lỗi 400 —
chặn cả trang chỉ vì gõ nhầm một ký tự là quá gắt cho một bộ lọc phụ trợ.

### Sắp xếp theo giá

Tham số `sort` nhận `gia_tang` (giá thấp → cao) hoặc `gia_giam` (cao → thấp).
Bỏ trống hoặc giá trị lạ thì giữ thứ tự mặc định của từng danh sách.

Cypher không cho truyền TÊN CỘT sắp xếp qua tham số, mà nối chuỗi động vào câu
lệnh thì mở đường cho chèn Cypher. Nên dùng `ORDER BY` dạng `CASE`:

```cypher
ORDER BY
  CASE WHEN $sort = 'gia_tang' THEN p.final_price END ASC,
  CASE WHEN $sort = 'gia_giam' THEN p.final_price END DESC,
  coalesce(p.rating, 0) DESC,
  p.id ASC
```

Mỗi lượt chỉ một nhánh CASE trả giá trị khác NULL, các nhánh còn lại trả NULL
cho mọi dòng nên thành vô hiệu — câu lệnh vẫn cố định.

**Bắt buộc giữ `p.id ASC` ở cuối.** Đây là tiêu chí chốt để thứ tự luôn xác
định. Thiếu nó thì các sản phẩm trùng giá có thể xếp khác nhau giữa hai lần
truy vấn, khiến `SKIP/LIMIT` trả về sản phẩm bị lặp ở trang này và mất ở trang kia.

`sort` cũng được tính vào cờ `coLoc`: chỉ đổi sắp xếp (không lọc gì) vẫn phải
dùng biến thể truy vấn, vì câu gốc có thứ tự cố định.

## 9. Nghiệp vụ "Mua ngay" tách khỏi giỏ hàng

**Cypher mới:** `ORDER_CREATE_DIRECT` (`queries/shopCypher.js`)
**Endpoint mới:** `POST /api/orders/buy-now`
**Test:** `npm run test:buynow` (19 phép kiểm)

### Vấn đề của cách làm cũ

Nút "Mua ngay" trước đây *thêm sản phẩm vào giỏ* rồi mới chuyển sang trang đặt
hàng. Hệ quả:
- Khách đổi ý bỏ ngang → món đó vẫn nằm lại trong giỏ dù họ không hề muốn mua.
- Lần "mua ngay" sau hiện kèm cả hàng cũ trong giỏ, đơn bị lẫn hàng không mong muốn.

### Cách làm mới

`ORDER_CREATE_DIRECT` tạo Order + đúng một cạnh CONTAINS từ `productId` và
`quantity`, **không đọc và không xoá `IN_CART`**. Nhờ vậy:
- Bỏ ngang giữa chừng thì không có gì đọng lại trong giỏ (thực ra chưa gọi API nào).
- Đơn chỉ gồm đúng món vừa bấm.
- Hàng đang có sẵn trong giỏ vẫn nguyên vẹn sau khi mua ngay.

Đơn giá vẫn chốt tại thời điểm đặt (đọc `p.final_price` ngay trong câu tạo đơn),
đơn vẫn ở trạng thái PENDING và kho vẫn chỉ trừ khi xác nhận thanh toán — giống
hệt đơn đặt từ giỏ.

### Hai quyết định đáng ghi lại

**Số lượng trong giỏ KHÔNG trừ vào lượng mua ngay được.** Hàng nằm trong giỏ
chưa hề bị giữ chỗ (kho chỉ trừ khi thanh toán), nên nó không được phép làm giảm
số lượng khách mua ngay. Route cố tình bỏ qua trường `in_cart` mà
`GET_PRODUCT_STOCK` trả về.

**Không kẹp thầm lặng số lượng.** Bản đầu kẹp về khoảng 1–99 rồi mới kiểm kho,
nên gửi 99999 vẫn tạo được đơn 99 món — tạo ra đơn khác với thứ khách yêu cầu.
Nay số lượng ngoài khoảng trả 400 kèm thông báo rõ ràng.

## 10. Thuộc tính tuỳ ý của sản phẩm (thể hiện tính schema-less)

**File mới:** `utils/productAttributes.js`
**Cypher mới:** `ADMIN_SET_PRODUCT_ATTRIBUTES`, `ADMIN_GET_PRODUCT_DETAIL`
**Endpoint mới:** `GET`/`PUT /api/admin/products/:id/attributes`
**Test:** `npm run test:attrs` (22 phép kiểm)

### Vì sao cần

Mô hình cũ đã thể hiện tốt mặt ĐỒ THỊ của NoSQL (duyệt nhiều bậc, thuộc tính
trên cạnh), nhưng chưa thể hiện mặt SCHEMA-LESS: mọi Product đều đúng 6 thuộc
tính cố định, không khác gì một bảng quan hệ.

Nay admin tự đặt tên thuộc tính lúc chạy ("Mô tả", "Xuất xứ", "Bảo hành"...).
Hai node cùng nhãn `:Product` có thể mang hai bộ thuộc tính hoàn toàn khác nhau
— quan hệ muốn làm được phải `ALTER TABLE` hoặc dựng bảng phụ kiểu EAV.

### Kỹ thuật: vì sao dùng `SET p += $attrs`

Cypher không cho truyền TÊN thuộc tính qua tham số. Cách hay bị nghĩ tới là nối
chuỗi `'SET p.' + tên` — nhưng tên đó do người dùng nhập, nối thẳng là mở đường
cho chèn Cypher.

Dạng `SET p += $map` nhận nguyên một map làm tham số nên câu lệnh vẫn cố định.
Thêm hai cái lợi: tên thuộc tính có dấu tiếng Việt và khoảng trắng vẫn dùng được
mà không phải escape, và **gán một khoá bằng null chính là xoá thuộc tính** —
nhờ vậy thêm, sửa, xoá dùng chung đúng một câu lệnh.

### Bảo vệ thuộc tính lõi

`id`, `title`, `final_price`, `rating`, `image`, `stock`, `status` bị chặn không
cho ghi qua đường này. Chúng có ô nhập riêng và có ràng buộc kiểu dữ liệu; để
admin gõ nhầm tên "final_price" rồi nhập chữ là giá thành chuỗi, kéo theo mọi
phép tính tiền và bộ lọc giá hỏng theo. Đổi `id` còn nặng hơn — mất dấu toàn bộ
quan hệ đang trỏ tới sản phẩm.

Giới hạn: tối đa 30 thuộc tính/sản phẩm, tên ≤ 50 ký tự, giá trị ≤ 2000 ký tự.

### Kiểu dữ liệu

Ô nhập trên web luôn trả chuỗi, nhưng lưu tất cả thành chuỗi thì mất một điểm
đáng khoe của NoSQL: mỗi thuộc tính giữ kiểu riêng. Nên "250" lưu thành số 250,
"true" thành boolean, còn lại giữ chữ. Cố ý KHÔNG đổi chuỗi số bắt đầu bằng 0
("0901234567") sang số — đó thường là số điện thoại hay mã hàng, đổi sang số là
mất số 0 đứng đầu.

## 11. Cập nhật đơn hàng thời gian thực (SSE)

**File mới:** `services/eventBus.js`, `routes/events.js`
**Endpoint mới:** `POST /api/events/ticket`, `GET /api/events/stream?ticket=`
**Test:** `npm run test:events` (20 phép kiểm)

### Vì sao chọn SSE

| Cách | Nhược điểm |
|---|---|
| Hỏi lặp (polling) | Luôn trễ vài giây, và cứ vài giây một lượt truy vấn Neo4j cho MỖI người đang mở trang — phần lớn thời gian chẳng có gì đổi |
| WebSocket | Mạnh nhưng hai chiều, phải thêm thư viện và tự lo kết nối lại |
| **SSE** | **Đúng nhu cầu: dữ liệu chỉ đi MỘT CHIỀU (máy chủ → trình duyệt). Chạy trên HTTP thường, trình duyệt có sẵn EventSource và tự kết nối lại** |

Không thêm thư viện nào.

### Cơ chế "vé" — vì sao không nhét token vào URL

`EventSource` của trình duyệt **không cho đặt header**, nên không gửi kèm được
`Authorization: Bearer`. Cách hay gặp là nhét token vào query string, nhưng khi
đó token nằm lại trong log truy cập của máy chủ và trong lịch sử trình duyệt.

Thay vào đó: gọi `POST /api/events/ticket` (có xác thực) để xin một vé ngẫu
nhiên **dùng một lần, sống 60 giây**, rồi mới mở luồng bằng vé đó. Vé lộ ra
ngoài cũng gần như vô hại vì hết hạn ngay và đã bị tiêu huỷ khi dùng.

### Dữ liệu gửi đi cố ý rất ít

Sự kiện chỉ gồm `{ orderId, status, hanhDong, luc }` — không có tên, số điện
thoại hay địa chỉ. Trình duyệt nhận tín hiệu rồi tự gọi lại API có xác thực để
lấy dữ liệu đầy đủ. Nhờ vậy luồng sự kiện không mang thông tin cá nhân nào.

Hai kênh tách biệt:
- `orders_changed` → gửi cho **mọi admin** đang mở trang
- `my_orders_changed` → chỉ gửi cho **đúng chủ đơn**

Khách không bao giờ nhận được sự kiện đơn của người khác (có phép kiểm riêng).

### Sáu chỗ phát sự kiện

`POST /api/orders`, `POST /api/orders/buy-now`, `POST /api/orders/:id/confirm-paid`,
`POST /api/orders/:id/cancel`, `POST /api/admin/orders/:id/mark-paid`,
`PUT /api/admin/orders/:id/status`.

`ORDER_UPDATE_STATUS` được bổ sung trả về `customer_id` — không có nó thì không
biết phải báo cho khách nào khi admin đổi trạng thái đơn.

### Giữ kết nối

Cứ 25 giây gửi một dòng chú thích rỗng. Không có nhịp này, proxy hoặc chính
trình duyệt có thể cắt kết nối vì tưởng đã chết.

## 12. Thanh toán chuyển khoản tự động qua SePay

**File mới:** `services/sepay.js`, `routes/webhooks.js`, `scripts/setup-payment.js`
**Cypher mới:** `PAYMENT_TX_RECORD`, `PAYMENT_TX_LINK_ORDER`, `ORDER_FIND_FOR_PAYMENT`
**Endpoint mới:** `POST /api/webhooks/sepay`, `GET /api/orders/:id/payment-qr`
**Test:** `npm run test:sepay` (27 phép kiểm, chạy được không cần tài khoản SePay)
**Hướng dẫn cấu hình:** xem `SEPAY_SETUP.md`

SePay không giữ tiền và không xử lý thẻ — nó theo dõi biến động số dư tài khoản
ngân hàng rồi gọi webhook khi có tiền vào. Nhờ vậy không đụng dữ liệu thẻ, không
thuộc phạm vi PCI-DSS.

### Bốn điều bắt buộc đúng ở webhook

Đây là endpoint duy nhất trong hệ thống KHÔNG dùng Firebase token (người gọi là
máy chủ SePay, không phải người dùng), nên phải tự lo an toàn:

1. **Xác thực khoá** — không thì ai biết địa chỉ này cũng tự "báo" đã trả tiền.
   So sánh bằng `crypto.timingSafeEqual` để không lộ khoá qua chênh lệch thời gian.
2. **Chống xử lý trùng** — SePay gửi lại tới 7 lần trong 5 tiếng. Chặn bằng
   `MERGE` theo mã giao dịch + ràng buộc UNIQUE (`npm run setup:payment`).
   Không có ràng buộc thì hai webhook về cùng lúc vẫn tạo được hai node.
3. **Chỉ tin số tiền THẬT** trong `transferAmount`, không tin con số nào lấy từ
   nội dung chuyển khoản — nội dung đó khách gõ được.
4. **Chỉ nhận `transferType = 'in'`**, bỏ qua tiền ra.

### Luôn trả 200

Kể cả khi không khớp đơn nào. Trả lỗi chỉ khiến SePay gửi lại 7 lần vô ích cho
một giao dịch vốn không xử lý được.

### Bóc mã đơn

Ngân hàng hay chèn thêm chữ vào nội dung ("CT DEN:520123 DH1A2B3C4D GD BANG QR"),
nên dò theo mẫu `DH` + 8 ký tự chứ không so cả chuỗi. Ưu tiên trường `code` do
SePay tự tách, không có thì dò trong `content`. Chấp nhận cả chữ thường.

Định dạng mã đơn sẵn có (`DHxxxxxxxx`, sinh bằng `crypto.randomInt`) trùng khớp
đúng khuyến nghị của SePay: mã ngẫu nhiên, không đoán được, không tuần tự.

### Chuyển thiếu tiền

KHÔNG tự đánh dấu đã thanh toán — ghi log để nhân viên xử lý tay, vì có thể
khách chuyển làm nhiều lần hoặc chuyển nhầm.

### Nối vào phần thời gian thực

Sau khi đánh dấu PAID, webhook gọi `thongBaoDonThayDoi` — khách đang mở trang đơn
thấy đổi sang "Đã thanh toán" ngay khi tiền vào, không cần tải lại trang.

## 13. Gộp cấu hình về một file .env duy nhất

**Trước:** `backend/.env` (17 khoá) + `frontend/.env` (6 khoá) + hai file mẫu riêng.
**Sau:** một `.env` và một `.env.example` ở **thư mục gốc dự án**.

**File mới:** `backend/loadEnv.js`

### Vì sao cần loadEnv.js

`require('dotenv').config()` mặc định chỉ tìm `.env` ở **thư mục đang chạy lệnh**.
Chạy `npm start` trong backend thì nó tìm `backend/.env`, nhưng chạy script từ
chỗ khác lại tìm nhầm chỗ — đã gặp thật: script chạy từ thư mục tạm báo
"injected env (0)" rồi không kết nối được Neo4j.

`loadEnv.js` trỏ thẳng tới file gốc bằng đường dẫn tuyệt đối tính từ vị trí file
đó, nên gọi từ đâu cũng ra đúng một file. Cả 7 chỗ nạp env đã đổi sang
`require('./loadEnv')` / `require('../loadEnv')`.

Phía Vite: đặt `envDir: '..'` trong `vite.config.js`.

### Tại sao gộp chung vẫn an toàn

Vite đọc cả file nhưng **chỉ đưa ra trình duyệt những biến có tiền tố `VITE_`**.
Đã kiểm chứng bằng cách build production rồi dò trong file JS:

| Biến | Trong bundle công khai? |
|---|---|
| `NEO4J_PASSWORD`, `NEO4J_URI`, `NEO4J_USERNAME` | không |
| `GEMINI_API_KEY` | không |
| `SEPAY_WEBHOOK_APIKEY`, `SEPAY_ACCOUNT_NUMBER` | không |
| `VITE_FIREBASE_*` | có — đúng như thiết kế |

> `FIREBASE_WEB_API_KEY` có giá trị **trùng** với `VITE_FIREBASE_API_KEY` (cùng
> là Firebase Web API Key). Chuỗi này nằm trong bundle từ trước khi gộp và vốn
> được thiết kế để công khai — bảo vệ bằng Security Rules và authorized domains,
> không phải bằng cách giấu key.

### ĐÁNH ĐỔI PHẢI NHỚ

Chung một file nghĩa là **chỉ cần đặt nhầm tiền tố `VITE_` cho một bí mật là nó
bị ghi thẳng vào file JS ai cũng tải về đọc được**. Trước đây hai file tách nhau
nên lỡ tay cũng khó lộ. Đã ghi cảnh báo này ngay đầu `.env.example` và trong
`vite.config.js`.

### Dọn cấu hình chết

Bốn khoá trong file mẫu cũ không còn file nào dùng (sót lại từ cách chuyển khoản
trước khi có SePay) nên đã bỏ khỏi file mẫu mới: `BANK_ID`, `BANK_ACCOUNT_NO`,
`BANK_ACCOUNT_NAME`, `PAYMENT_WEBHOOK_SECRET`.

Cũng sửa `.gitignore`: thêm `!.env.example` để file mẫu **được commit** cho
người trong nhóm — trước đó `backend/.env.example` bị chặn nhầm.

## 14. Chọn phương thức thanh toán lúc đặt hàng

**Endpoint mới:** `GET /api/orders/payment-methods`
**Sửa:** `routes/orders.js` (thêm `docPhuongThuc()`, hằng `PHUONG_THUC_HOP_LE`),
`queries/shopCypher.js` (`ORDER_FIND_FOR_PAYMENT` trả thêm `payment_method`)

### Ba giá trị được chấp nhận

| Giá trị | Nghĩa |
|---|---|
| `COD` | Trả tiền mặt tại cửa hàng, nhân viên bấm xác nhận (mặc định) |
| `BANK_QR` | Quét mã QR chuyển khoản, SePay báo về thì hệ thống tự xác nhận |
| `ZALOPAY` | Giữ cho dữ liệu cũ |

Dữ liệu cũ còn giá trị `AT_STORE` — không nhận cho đơn mới nhưng đơn cũ vẫn đọc
và hiển thị bình thường (được coi như trả tiền mặt).

### Chặn sớm thay vì để khách kẹt

`docPhuongThuc()` từ chối ngay `BANK_QR` khi cửa hàng chưa khai báo tài khoản
nhận tiền (`daCauHinh()` = false). Không chặn ở đây thì đơn tạo xong khách mới
phát hiện không có QR để quét, mà đơn thì đã nằm đó.

Endpoint `GET /api/orders/payment-methods` trả kèm cờ `available` để trang đặt
hàng khoá sẵn lựa chọn không dùng được, khỏi hiện ra rồi báo lỗi.

### Ràng buộc ở endpoint QR

`GET /api/orders/:orderId/payment-qr` nay trả `available: false` cho đơn không
phải `BANK_QR`. Khách chọn tiền mặt thì không thấy mã QR — đúng như đã chọn.

**Webhook cố ý KHÔNG kiểm phương thức:** nếu tiền thật sự về tài khoản kèm mã
đơn, hệ thống vẫn xác nhận đã thanh toán dù đơn đó chọn tiền mặt. Tiền đã vào
thì không có lý do từ chối.

### Bài học về kiểm thử

Thay đổi này làm `test:sepay` tụt từ 27 xuống 25 phép kiểm mà **vẫn xanh** —
vì script tạo đơn không nêu phương thức nên rơi vào mặc định COD, khiến nhánh
kiểm mã QR bị bỏ qua lặng lẽ. Đã sửa script tạo đơn `BANK_QR` và thêm hai phép
kiểm cho đơn tiền mặt: nay 29 phép kiểm.

Số phép kiểm giảm mà bộ test vẫn báo xanh là dấu hiệu mất độ phủ, không phải
tin tốt — nên đối chiếu con số này mỗi lần đổi nghiệp vụ.

---

## 15. Lọc + sắp xếp cho kho sản phẩm bên admin

Trang quản trị trước đây chỉ tìm được theo tên. Danh mục có 30 mục, sản phẩm
trải nhiều trang, nên muốn xem "hàng nào rẻ nhất", "hàng nào bị chê" hay "danh
mục này còn gì" đều phải lật từng trang mà đọc.

### Dùng lại đúng câu truy vấn của trang khách

`GET /api/admin/products` nay nhận thêm `categoryId` và `sort`, đọc qua
`utils/filters.js › parseFilters()` — cùng một hàm mà trang sản phẩm, gợi ý và
bán chạy đang dùng. Không viết bộ đọc tham số thứ hai: giá trị hợp lệ, cách xử
lý giá trị rác và tên kiểu sắp xếp đều thống nhất giữa hai phía.

### Thêm sắp xếp theo điểm đánh giá

`SORTS` trong `utils/filters.js` mở rộng từ hai lên bốn giá trị:

    gia_tang / gia_giam   — theo giá bán
    sao_tang / sao_giam   — theo điểm đánh giá   (mới)

`LIST_PRODUCTS` trong `queries/cypher.js` thêm hai nhánh vào mệnh đề `ORDER BY`:

```cypher
ORDER BY
  CASE WHEN $sort = 'gia_tang' THEN p.final_price END ASC,
  CASE WHEN $sort = 'gia_giam' THEN p.final_price END DESC,
  CASE WHEN $sort = 'sao_tang' THEN coalesce(p.rating, 0) END ASC,
  CASE WHEN $sort = 'sao_giam' THEN coalesce(p.rating, 0) END DESC,
  coalesce(p.rating, 0) DESC,
  p.id ASC
```

Ba điểm cần giữ nguyên khi sửa về sau:

- **`CASE WHEN` chứ không nối chuỗi.** Cypher không cho truyền tên cột làm tham
  số; ghép chuỗi vào câu truy vấn là mở đường cho Cypher injection.
- **`coalesce(p.rating, 0)`.** Sản phẩm chưa ai đánh giá không có khoá `rating`.
  Không có `coalesce` thì `null` bị xếp riêng và thứ tự tăng/giảm lệch nhau.
- **`p.id ASC` chốt cuối.** Nhiều sản phẩm cùng 4.8 sao; thiếu tiêu chí phụ này
  thì `SKIP/LIMIT` có thể trả trùng dòng hoặc bỏ sót dòng khi lật trang.

Vì thêm giá trị vào `SORTS` là dùng chung, bốn kiểu sắp xếp này đồng thời có
hiệu lực ở phía khách hàng — cùng một tham số `sort`.

### Kiểm chứng

Script kiểm riêng chạy 10 phép, đạt cả 10: bốn kiểu sắp xếp, lọc theo danh mục
(đúng danh mục + đúng tổng số), kết hợp lọc với sắp xếp, và hai trường hợp biên
(`sort` bịa ra → dùng mặc định chứ không lỗi; `categoryId` không tồn tại → trả
0 sản phẩm chứ không lỗi).

Hồi quy đầy đủ sau thay đổi: api 34, shop 41, admin 38, sepay 29, attrs 22,
events 20, buynow 19 — 203 phép kiểm, 0 hỏng.
