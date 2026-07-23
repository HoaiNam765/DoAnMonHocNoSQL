# DoAnMonHocNoSQL

Nam Nhiên Vỹ Trường

Hệ thống gợi ý sản phẩm trên Neo4j — Node.js/Express + React.

## Yêu cầu

- Node.js 18 trở lên (backend dùng `fetch` có sẵn của Node)
- Một instance Neo4j (Aura Free hoặc Neo4j Desktop)

## 1. Cấu hình kết nối

```bash
cd backend
cp .env.example .env
```

Điền `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` từ file credentials của Aura.
`NEO4J_DATABASE` để trống là dùng database mặc định — chỉ điền khi cần trỏ vào database khác
(kiểm tra bằng `SHOW DATABASES` trong Neo4j Browser).

## 2. Import dữ liệu vào Neo4j

Chỉ cần làm **một lần**. Script sẽ **xoá sạch** database rồi import lại từ thư mục `data2/`.

```bash
cd backend
npm install
npm run generate:bought
npm run import
```

Kết quả đúng:

```
product     : 1000
category    : 29
customer    : 3539
belongs_to  : 1000
bought      : 24815
viewed      : 35311
labels      : Customer, Product, Category
rel types   : VIEWED, BELONGS_TO, BOUGHT
```

### Lưu ý quan trọng về dữ liệu BOUGHT (phải ghi trong báo cáo)

File gốc `data2/bought_relations.csv` có **3.520/3.539 khách hàng chỉ mua đúng 1 sản phẩm**.
Pattern gợi ý của đề bài `(c1)-[:BOUGHT]->(p1)<-[:BOUGHT]-(c2)-[:BOUGHT]->(p2)` bắt buộc `c2`
phải mua từ 2 sản phẩm trở lên, nên với dữ liệu gốc chỉ **3,2%** khách hàng và **3,2%** sản phẩm
ra được gợi ý.

`npm run generate:bought` **giữ nguyên 100% dòng gốc** và **bổ sung thêm** các lượt mua mô phỏng
theo sở thích danh mục (mỗi khách 4–10 sản phẩm), tạo ra `data2/bought_relations_full.csv`.
Sau khi bổ sung: **100%** khách hàng và **100%** sản phẩm đều có gợi ý.

Đây là **dữ liệu mô phỏng**, không phải hành vi mua thật — cần nói rõ điều này trong báo cáo.
Muốn import bản gốc để đối chiếu: `node scripts/import.js --raw`.

## 3. Khởi chạy backend

(Chuyển sang Command Prompt nếu báo lỗi "cannot be loaded because running scripts is disabled on this system")

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

## API endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/products?page=&limit=&search=&categoryId=` | Danh sách sản phẩm, phân trang + tìm kiếm theo tên |
| GET | `/api/products/:id` | Chi tiết 1 sản phẩm + tên danh mục |
| GET | `/api/products/:id/recommendations?limit=` | **Query B** — gợi ý mua kèm theo sản phẩm đang xem |
| GET | `/api/customers?page=&limit=&search=` | Danh sách khách hàng (dropdown "đăng nhập giả lập") |
| GET | `/api/customers/:id` | Thông tin 1 khách hàng |
| GET | `/api/customers/:id/recommendations?limit=` | **Query A** — gợi ý cá nhân hoá theo khách hàng |

Toàn bộ câu Cypher nằm ở [`backend/queries/cypher.js`](backend/queries/cypher.js) — tiện copy vào báo cáo.

## Cấu trúc thư mục

```
backend/
  db.js                    kết nối Neo4j + helper readQuery/writeQuery
  server.js                khởi tạo Express, gắn route, error handler
  queries/cypher.js        toàn bộ câu Cypher (Query A, Query B, ...)
  routes/products.js       task 2.1, 2.2, 2.3
  routes/customers.js      task 2.4
  utils/http.js            asyncHandler, HttpError, phân trang
  scripts/
    generate-bought.js     sinh dữ liệu BOUGHT mô phỏng
    import.js              xoá sạch + import lại Neo4j
    test-api.js            smoke test toàn bộ endpoint
frontend/                  React (Vite) + React Router
data2/                     6 file CSV gốc + bought_relations_full.csv
```
