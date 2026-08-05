# Hướng dẫn deploy

| Phần | Deploy ở đâu | Vì sao |
|---|---|---|
| **Frontend** (Vite/React) | **Vercel** | Chỉ là file tĩnh sau khi build — đúng thứ Vercel sinh ra để làm |
| **Backend** (Express) | **Render** | Cần tiến trình chạy liên tục |

## Vì sao KHÔNG đặt backend trên Vercel

Vercel chạy **serverless**: mỗi request là một hàm ngắn hạn, xong là tắt. Backend
này cần hai thứ mà mô hình đó không cho:

1. **Kết nối giữ lâu.** `/api/events/stream` (SSE) phải mở liên tục để đẩy sự kiện
   "có đơn mới", "đã thanh toán" xuống trình duyệt. Serverless có giới hạn thời
   gian mỗi lần chạy nên tính năng cập nhật tức thời sẽ hỏng.

2. **Trạng thái trong bộ nhớ.** Bảy chỗ đang dùng `Map` trong RAM: danh sách kết
   nối SSE, vé vào luồng, bộ đệm chatbot, ngân sách gọi Gemini, giới hạn tần
   suất. Serverless mỗi request có thể rơi vào máy khác nhau → mất sạch.

Muốn ép backend lên Vercel thì phải bỏ SSE quay về hỏi lặp và chuyển toàn bộ
trạng thái sang Redis — nhiều việc và kém hơn hẳn. Render có gói miễn phí, dùng
thẳng được.

---

# PHẦN 1 — Backend lên Render

### 1.1. Chuẩn bị khoá Firebase

Trên Render không tải file lên được, mà `firebase-service-account.json` lại bị
`.gitignore` nên cũng không theo mã nguồn lên được. Phải đưa nó vào biến môi
trường:

```bash
# Chạy ở thư mục backend — in ra chuỗi base64 để dán vào Render
node -e "console.log(Buffer.from(require('fs').readFileSync('firebase-service-account.json','utf8')).toString('base64'))"
```

Chép nguyên chuỗi in ra. (Dán thẳng nội dung JSON cũng được, nhưng base64 an
toàn hơn vì không bị hỏng xuống dòng.)

### 1.2. Tạo dịch vụ

Render → **New** → **Blueprint** → trỏ vào repo này (đã có sẵn `render.yaml`).

Hoặc tạo **Web Service** thủ công:

| Mục | Giá trị |
|---|---|
| Root Directory | `DoAnMonHocNoSQL/backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/` |

### 1.3. Khai báo biến môi trường

| Biến | Giá trị |
|---|---|
| `NEO4J_URI` | `neo4j+s://xxxxxxxx.databases.neo4j.io` |
| `NEO4J_USERNAME` | `neo4j` |
| `NEO4J_PASSWORD` | mật khẩu Aura |
| `FIREBASE_SERVICE_ACCOUNT` | chuỗi base64 ở bước 1.1 |
| `FIREBASE_WEB_API_KEY` | Firebase Console → Project settings |
| `GEMINI_API_KEY` | khoá Gemini |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` |
| `SEPAY_ACCOUNT_NUMBER` / `SEPAY_BANK` / `SEPAY_WEBHOOK_APIKEY` | xem `SEPAY_SETUP.md` |
| `CORS_ORIGIN` | **điền sau** ở bước 2.4 |
| `NODE_ENV` | `production` |

> **KHÔNG** khai báo `PORT` — Render tự cấp, code đã đọc `process.env.PORT`.
>
> **KHÔNG** khai báo biến nào có tiền tố `VITE_` ở đây — chúng thuộc về frontend.

### 1.4. Tạo ràng buộc cơ sở dữ liệu

Chạy một lần từ máy mình (trỏ vào đúng Neo4j sẽ dùng khi chạy thật):

```bash
cd DoAnMonHocNoSQL/backend
npm run setup:auth
npm run setup:payment
```

Ràng buộc nằm trong database chứ không nằm trong mã nguồn, nên deploy không tự
tạo giúp.

### 1.5. Ghi lại địa chỉ

Render cho địa chỉ dạng `https://neo4j-marketplace-api.onrender.com`. Cần nó ở
bước sau.

> **Gói miễn phí của Render ngủ sau 15 phút không ai truy cập.** Lần gọi kế tiếp
> mất khoảng 30–60 giây để dậy. Trước buổi demo nhớ mở trang trước vài phút.

---

# PHẦN 2 — Frontend lên Vercel

### 2.1. Import dự án

Vercel → **Add New** → **Project** → chọn repo.

### 2.2. Cấu hình

| Mục | Giá trị |
|---|---|
| **Root Directory** | `DoAnMonHocNoSQL/frontend` ← **quan trọng nhất** |
| Framework Preset | Vite (tự nhận) |
| Build Command | `npm run build` (tự nhận) |
| Output Directory | `dist` (tự nhận) |

Repo có backend và frontend nằm chung nên **bắt buộc** chỉ đúng Root Directory,
không thì Vercel không tìm thấy `package.json` và nút Deploy sẽ không bấm được.

### 2.3. Khai báo biến môi trường

**Vercel không nhận file `.env`** — file đó đã bị `.gitignore` nên không lên
GitHub. Khai báo từng biến ở **Settings → Environment Variables**:

| Biến | Giá trị |
|---|---|
| `VITE_FIREBASE_API_KEY` | lấy từ `.env` ở máy bạn |
| `VITE_FIREBASE_AUTH_DOMAIN` | |
| `VITE_FIREBASE_PROJECT_ID` | |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |
| `VITE_FIREBASE_APP_ID` | |
| `VITE_API_URL` | `https://<địa-chỉ-render>/api` ← từ bước 1.5 |

> **Bắt buộc có `VITE_API_URL`.** Không có, frontend sẽ tự đoán địa chỉ backend
> từ địa chỉ đang mở trang và ra `https://ten-app.vercel.app:5000/api` — sai hoàn
> toàn. Ở máy mình thì đoán đúng nên không cần, lên server thì phải khai báo.

Dán hàng loạt cũng được, nhưng **bỏ dòng có giá trị rỗng** (như `NEO4J_DATABASE`)
— Vercel từ chối biến trống.

### 2.4. Nối hai bên lại

Có địa chỉ Vercel rồi, quay lại Render khai báo:

```
CORS_ORIGIN=https://ten-app.vercel.app
```

Nhiều tên miền thì ngăn cách bằng dấu phẩy (Vercel còn sinh địa chỉ preview cho
mỗi nhánh):

```
CORS_ORIGIN=https://ten-app.vercel.app,https://ten-app-git-main-abc.vercel.app
```

Để trống `CORS_ORIGIN` nghĩa là **mọi trang web đều gọi được API của bạn** bằng
phiên đăng nhập của khách đang mở tab. Đừng để trống khi chạy thật.

### 2.5. Cho Firebase biết tên miền mới

Firebase Console → **Authentication → Settings → Authorized domains** → thêm
`ten-app.vercel.app`. Thiếu bước này thì đăng nhập Google báo lỗi
`auth/unauthorized-domain`.

---

# PHẦN 3 — Sau khi deploy

### Cập nhật webhook SePay

SePay → Webhooks → sửa URL thành:

```
https://<địa-chỉ-render>/api/webhooks/sepay
```

Giờ đã có địa chỉ cố định nên **không cần tunnel** như hướng dẫn cũ nữa.

### Kiểm tra nhanh

| Việc | Cách thử |
|---|---|
| Backend sống | Mở `https://<render>/` → thấy JSON danh sách endpoint |
| Frontend gọi được backend | Mở web, xem có hiện sản phẩm không |
| CORS đúng | DevTools → Console, không có lỗi CORS |
| Định tuyến | Vào thẳng `https://<vercel>/orders` rồi F5 → **không được ra 404** |
| Đăng nhập | Thử đăng nhập Google |
| Cập nhật tức thời | Mở hai tab (khách + admin), đặt đơn ở tab này xem tab kia có tự hiện |
| Chatbot | Hỏi "sản phẩm dưới 500k" |

Mục "Định tuyến" đã được `frontend/vercel.json` lo sẵn bằng rewrite mọi đường dẫn
về `index.html` — thiếu nó thì F5 ở trang con nào cũng ra 404 vì Vercel đi tìm
file thật theo đường dẫn đó.

### Những thứ KHÔNG bao giờ khai báo lên Vercel

`NEO4J_PASSWORD`, `GEMINI_API_KEY`, `SEPAY_WEBHOOK_APIKEY`, `FIREBASE_SERVICE_ACCOUNT`.

Chúng thuộc về backend. Đặt lên Vercel là vô ích, và nếu lỡ thêm tiền tố `VITE_`
thì bị ghi thẳng vào file JS ai cũng tải về đọc được.
