# DoAnMonHocNoSQL
Nam Nhiên Vỹ Trường

Các bước khởi chạy chương trình
(Chuyển sang Command Prompt nếu báo lỗi "cannot be loaded because running scripts is disabled on this system")
1. Khởi chạy backend:
    cd backend
    npm run dev
Kết quả đúng khi kết nối được với database neo4j: 
    ✅ [Neo4j] Kết nối thành công tới Database!
    Address: p-mt-2e58c6e6c448-11-0086.production-orch-0703.neo4j.io:7687 | Agent: Neo4j/5.27-aura
    🚀 [Server] Đang chạy tại http://localhost:5000

<<<<<<< Updated upstream
2. Khởi chạy frontend:
    Mở 1 terminal khác (Command Prompt)
    cd frontend
    npm install
    npm run dev
=======
```bash
cd backend
npm run dev
```

Kết quả đúng khi kết nối được với database Neo4j:

```
✅ [Neo4j] Kết nối thành công tới Database!
   Address: ...neo4j.io:7687 | Agent: Neo4j/5.27-aura
🚀 [Server] Đang chạy tại http://localhost:5000
```

## 4. Khởi chạy frontend

Mở 1 terminal khác (Command Prompt):

```bash
cd frontend
npm install
npm run dev
```

## 5. Kiểm thử API

Server phải đang chạy trước.

```bash
cd backend
npm run test:api
```

## 6. Kiểm tra hiệu năng EXPLAIN / PROFILE (Task 2.6)

Server **không** cần chạy. Script kết nối trực tiếp tới Neo4j:

```bash
cd backend
npm run explain
```

Script sẽ:
- Kiểm tra 3 unique constraint (Product.id, Customer.customer_id, Category.category_id)
- Chạy `EXPLAIN` cho Query A & B → in kế hoạch thực thi, xác nhận Index Seek
- Chạy `PROFILE` cho Query A & B → in db hits, thời gian, xác nhận < 1 giây
- In sẵn cú pháp Cypher để copy vào Neo4j Browser chạy thủ công cho báo cáo

## API endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/products?page=&limit=&search=&categoryId=` | Danh sách sản phẩm, phân trang + tìm kiếm theo tên |
| GET | `/api/products/:id` | Chi tiết 1 sản phẩm + tên danh mục + **ghi VIEWED** (Task 2.5) |
| GET | `/api/products/:id/recommendations?limit=` | **Query B** — gợi ý mua kèm theo sản phẩm đang xem |
| GET | `/api/customers?page=&limit=&search=` | Danh sách khách hàng (dropdown "đăng nhập giả lập") |
| GET | `/api/customers/:id` | Thông tin 1 khách hàng |
| GET | `/api/customers/:id/recommendations?limit=` | **Query A** — gợi ý cá nhân hoá theo khách hàng |

### Task 2.5 — Header `x-customer-id`

Khi gọi `GET /api/products/:id`, nếu request có header `x-customer-id` (ví dụ `C008`),
backend sẽ tự động ghi nhận quan hệ `VIEWED` vào đồ thị bằng `MERGE` (không trùng lặp).
Nếu không có header này (khách vãng lai), chỉ trả dữ liệu sản phẩm bình thường.

Toàn bộ câu Cypher nằm ở [`backend/queries/cypher.js`](backend/queries/cypher.js) — tiện copy vào báo cáo.

## Cấu trúc thư mục

```
backend/
  db.js                    kết nối Neo4j + helper readQuery/writeQuery
  server.js                khởi tạo Express, gắn route, error handler
  queries/cypher.js        toàn bộ câu Cypher (Query A, Query B, ...)
  routes/products.js       task 2.1, 2.2, 2.3, 2.5
  routes/customers.js      task 2.4
  utils/http.js            asyncHandler, HttpError, phân trang
  scripts/
    generate-bought.js     sinh dữ liệu BOUGHT mô phỏng
    import.js              xoá sạch + import lại Neo4j
    test-api.js            smoke test toàn bộ endpoint
    explain-profile.js     task 2.6: EXPLAIN/PROFILE Query A & B
frontend/                  React (Vite) + React Router
data2/                     6 file CSV gốc + bought_relations_full.csv
```

## Task 2.7.1 - Xây dựng ProductCard

### Mục tiêu
Tạo component hiển thị thông tin một sản phẩm để tái sử dụng trong nhiều màn hình của hệ thống.

### Công việc thực hiện
- Tạo component `ProductCard`.
- Hiển thị hình ảnh, tên sản phẩm, giá bán và đánh giá.
- Thêm nút **Xem chi tiết** sử dụng React Router.
- Thiết kế giao diện dạng Card với bo góc và đổ bóng.

### Kết quả
- Hoàn thành component `ProductCard`.
- Sẵn sàng sử dụng trong danh sách sản phẩm và khu vực gợi ý mua kèm.

## Task 2.7.2 - Xây dựng ProductList

### Mục tiêu
Tạo component quản lý việc hiển thị danh sách sản phẩm theo dạng lưới.

### Công việc thực hiện
- Tạo component `ProductList`.
- Nhận dữ liệu sản phẩm thông qua props.
- Render nhiều `ProductCard`.
- Hiển thị thông báo khi danh sách sản phẩm rỗng.

### Kết quả
- Hoàn thành component `ProductList`.
- Sẵn sàng kết nối với API lấy danh sách sản phẩm.

## Task 2.7.3 - Kết nối trang chủ với API

### Mục tiêu
Hiển thị danh sách sản phẩm từ Backend trên trang chủ.

### Công việc thực hiện
- Gọi API `GET /api/products`.
- Quản lý trạng thái Loading.
- Lưu dữ liệu sản phẩm vào State.
- Hiển thị danh sách bằng component `ProductList`.

### Kết quả
- Trang chủ hiển thị sản phẩm từ Neo4j.
- Dữ liệu được lấy trực tiếp từ Backend.
- Hoàn thành chức năng hiển thị danh sách sản phẩm.


## Task 2.7.4 - Hoàn thiện trang danh sách sản phẩm

### Mục tiêu
Hoàn thiện giao diện trang chủ với các chức năng hỗ trợ tìm kiếm và phân trang.

### Công việc thực hiện
- Bổ sung ô tìm kiếm theo tên sản phẩm.
- Gọi API với tham số `search`, `page`, `limit`.
- Hiển thị phân trang dựa trên dữ liệu Backend trả về.
- Hiển thị trạng thái Loading trong quá trình tải dữ liệu.

### Kết quả
- Người dùng có thể tìm kiếm sản phẩm theo tên.
- Danh sách sản phẩm hỗ trợ phân trang.
- Giao diện trực quan và dễ sử dụng hơn.

## Task 2.8.1 - Hiển thị chi tiết sản phẩm

### Mục tiêu
Hiển thị đầy đủ thông tin sản phẩm khi người dùng chọn xem chi tiết.

### Công việc thực hiện
- Gọi API `GET /api/products/:id`.
- Gửi Header `x-customer-id` để Backend ghi nhận hành vi xem sản phẩm.
- Hiển thị hình ảnh, tên sản phẩm, giá bán, danh mục và đánh giá.
- Chuẩn bị khu vực hiển thị sản phẩm gợi ý mua kèm.

### Kết quả
- Trang chi tiết hiển thị dữ liệu sản phẩm từ Neo4j.
- Backend ghi nhận quan hệ `VIEWED` giữa khách hàng và sản phẩm.

## Task 2.8.2 - Hiển thị sản phẩm gợi ý

### Mục tiêu
Hiển thị danh sách sản phẩm được Neo4j đề xuất dựa trên lịch sử mua hàng.

### Công việc thực hiện
- Gọi API `GET /api/products/:id/recommendations`.
- Hiển thị tối đa 6 sản phẩm gợi ý.
- Sử dụng lại component `ProductCard`.
- Hiển thị số lượng sản phẩm được đề xuất.

### Kết quả
- Người dùng xem được danh sách sản phẩm mua kèm.
- Dữ liệu được lấy trực tiếp từ Neo4j Recommendation Engine.

## Task 2.8.3 - Gợi ý theo khách hàng

### Mục tiêu
Hiển thị danh sách sản phẩm được đề xuất riêng cho khách hàng đang được chọn.

### Công việc thực hiện
- Gọi API `GET /api/customers/:id/recommendations`.
- Theo dõi thay đổi của `CustomerContext`.
- Hiển thị danh sách sản phẩm gợi ý phía trên danh sách sản phẩm chung.
- Tái sử dụng component `ProductList`.

### Kết quả
- Khi thay đổi khách hàng, hệ thống cập nhật danh sách gợi ý tương ứng.
- Hoàn thiện chức năng gợi ý cá nhân hóa bằng Neo4j.

## Task 3.1 - RecommendationList

- Tách phần gợi ý mua kèm thành component `RecommendationList`.
- Component tự gọi API `/api/products/:id/recommendations`.
- Hiển thị sản phẩm gợi ý dạng Grid bằng `ProductCard`.
- ProductDetail chỉ hiển thị thông tin sản phẩm và nhúng `RecommendationList`.

## Task 3.2 - Bộ chọn khách hàng bằng React Context

### Mục tiêu
Quản lý khách hàng đang được chọn ở phạm vi toàn ứng dụng để phục vụ chức năng gợi ý cá nhân hóa và ghi nhận hành vi xem sản phẩm.

### Công việc thực hiện
- Tạo `CustomerContext` lưu `customerId`.
- Bọc toàn bộ ứng dụng bằng `CustomerProvider`.
- Cập nhật `Header` để thay đổi khách hàng thông qua Context.
- Đồng bộ `ProductDetail` với Context để gửi `x-customer-id` khi xem sản phẩm.

### Kết quả
- Toàn bộ ứng dụng nhận biết được khách hàng đang chọn.
- Backend ghi nhận đúng hành vi `VIEWED` theo từng khách hàng.
>>>>>>> Stashed changes
