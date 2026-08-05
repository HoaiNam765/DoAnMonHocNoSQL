# Hướng dẫn bật thanh toán chuyển khoản qua SePay

Toàn bộ phần lập trình đã xong. Việc còn lại chỉ là **khai báo tài khoản** và
**cho SePay gọi được vào máy chủ của bạn**.

---

## SePay là gì (và không phải gì)

SePay **không phải cổng thanh toán thẻ**. Nó không giữ tiền, không xử lý thẻ.

Nó nối vào tài khoản ngân hàng của cửa hàng, theo dõi biến động số dư, và mỗi
khi có tiền vào thì gọi một địa chỉ web của bạn (webhook) để báo. Việc còn lại
là hệ thống tự đối chiếu nội dung chuyển khoản với mã đơn.

Hệ quả có lợi: không đụng tới dữ liệu thẻ nên **không thuộc phạm vi PCI-DSS**,
và khách trả tiền bằng chính app ngân hàng quen thuộc.

## Luồng hoạt động

```
1. Khách đặt đơn          →  hệ thống sinh mã DHxxxxxxxx
2. Trang chi tiết đơn     →  hiện QR có sẵn số tiền + nội dung = mã đơn
3. Khách quét & chuyển    →  tiền vào tài khoản cửa hàng
4. SePay phát hiện        →  gọi POST /api/webhooks/sepay
5. Backend đối chiếu mã   →  đánh dấu PAID, trừ kho, sinh cạnh BOUGHT
6. Đẩy sự kiện SSE        →  trang của khách tự đổi "Đã thanh toán", không cần F5
```

Bước 5–6 dùng lại đúng cơ chế đã có sẵn của nút "Đã thanh toán" bên quản trị.

---

## CÓ CẦN DEPLOY KHÔNG?

**Không bắt buộc.** Chỉ cần SePay *gọi được* vào máy chủ của bạn từ Internet.
Ba cách, chọn một:

### Cách 1 — Test mode + tunnel (khuyến nghị cho đồ án)

SePay có **Test mode** dùng tài khoản ngân hàng **giả lập**: không cần tài khoản
ngân hàng thật, không cần tiền thật, có nút "Mô phỏng chuyển khoản", và
**webhook vẫn được kích hoạt bình thường**.

Máy chủ vẫn chạy ở `localhost:5000`, chỉ cần mở một đường hầm ra Internet:

```bash
npx cloudflared tunnel --url http://localhost:5000
```

Lệnh này in ra một địa chỉ dạng `https://abc-xyz.trycloudflare.com`. Địa chỉ
webhook khai báo trong SePay sẽ là:

```
https://abc-xyz.trycloudflare.com/api/webhooks/sepay
```

Địa chỉ này đổi mỗi lần chạy lại, nhớ cập nhật lại trong SePay.
(Dùng `ngrok http 5000` cũng được, tương đương.)

### Cách 2 — Deploy backend

Đưa backend lên Render / Railway / Fly.io... rồi lấy địa chỉ cố định. Ổn định
hơn nhưng không cần thiết nếu chỉ để demo.

### Cách 3 — Chỉ demo giao diện

Không khai báo gì cả: khung QR **tự ẩn**, web vẫn chạy bình thường với cách trả
tiền tại quầy như cũ. Không có gì hỏng.

---

## Các bước cụ thể

### 1. Tạo tài khoản SePay

Đăng ký tại https://my.sepay.vn — bật **Test mode** rồi tạo tài khoản ngân hàng
giả lập. Nếu dùng thật thì kết nối tài khoản ngân hàng của bạn.

### 2. Điền vào `.env` ở thư mục gốc dự án

```env
SEPAY_ACCOUNT_NUMBER=<số tài khoản nhận tiền>
SEPAY_BANK=<tên ngân hàng viết liền không dấu, vd: Vietcombank, MBBank, ACB>
SEPAY_WEBHOOK_APIKEY=<chuỗi bí mật bạn tự đặt>
```

> ⚠️ **Số tài khoản phải là của bạn.** Điền nhầm số của người khác thì tiền
> khách chuyển sẽ vào tài khoản đó, hệ thống không lấy lại được.

### 3. Tạo ràng buộc chống trùng giao dịch

```bash
cd backend
npm run setup:payment
```

**Bắt buộc chạy.** SePay gửi lại webhook tới 7 lần trong 5 tiếng nếu chưa nhận
được phản hồi 200. Ràng buộc UNIQUE trên mã giao dịch là thứ đảm bảo một lần
chuyển tiền chỉ được xử lý đúng một lần, kể cả khi hai webhook về cùng lúc.

### 4. Khai báo webhook trong SePay

Vào **Webhooks → Thêm webhook**:

| Mục | Giá trị |
|---|---|
| URL | `https://<địa-chỉ-công-khai>/api/webhooks/sepay` |
| Kiểu xác thực | **API Key** |
| API Key | đúng chuỗi đã đặt ở `SEPAY_WEBHOOK_APIKEY` |
| Sự kiện | Tiền vào (transferType = in) |

### 5. Thử

```bash
cd backend
npm run test:sepay
```

27 phép kiểm, giả lập đúng gói dữ liệu SePay gửi — chạy được **không cần tài
khoản SePay**. Sau đó vào SePay bấm "Mô phỏng chuyển khoản" để thử luồng thật.

---

## Những gì hệ thống tự lo

| Tình huống | Xử lý |
|---|---|
| SePay gửi lại nhiều lần | Chặn bằng mã giao dịch + ràng buộc UNIQUE, chỉ xử lý một lần |
| Khách chuyển **thiếu** tiền | **Không** tự duyệt, để nhân viên xử lý tay |
| Nội dung không có mã đơn | Ghi log, trả 200 (không bắt SePay gửi lại vô ích) |
| Mã đơn không tồn tại | Ghi log, trả 200 |
| Tiền **ra** khỏi tài khoản | Bỏ qua |
| Đơn đã thanh toán/huỷ rồi | Bỏ qua |
| Ngân hàng chèn thêm chữ vào nội dung | Dò mã theo mẫu `DH` + 8 ký tự, chấp nhận cả chữ thường |
| Khoá webhook sai | Trả 401, so sánh khoá theo kiểu chống dò thời gian |

Mỗi giao dịch được lưu thành node `:PaymentTx` và nối với đơn bằng quan hệ
`(:Order)-[:PAID_BY]->(:PaymentTx)` — tra soát được sau này, và cũng là thêm một
quan hệ nữa cho phần mô hình đồ thị trong báo cáo.

---

## Lưu ý khi dùng thật

- **Chuyển khoản không tức thì tuyệt đối.** Liên ngân hàng có thể mất vài giây
  tới vài phút. Khung QR đã ghi rõ điều này cho khách.
- **Đừng xoá `npm run setup:payment`** khi đổi sang cơ sở dữ liệu Neo4j khác —
  ràng buộc nằm trong database, không nằm trong mã nguồn.
- **`SEPAY_WEBHOOK_APIKEY` là bí mật thật.** Ai biết chuỗi này có thể tự gọi
  webhook để "báo" đã trả tiền cho bất kỳ đơn nào. Đừng commit lên GitHub —
  `.env` đã được `.gitignore` sẵn.
