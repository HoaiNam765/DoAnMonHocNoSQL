/**
 * Cypher cho Giỏ hàng · Đơn hàng · Thanh toán.
 *
 * Tách khỏi `cypher.js` cho dễ đọc — file kia đã 484 dòng và đang chứa phần
 * Cypher của Tiêu chí 3 (Query A/B) mà báo cáo trích dẫn trực tiếp.
 *
 * ─── MÔ HÌNH ĐỒ THỊ ───────────────────────────────────────────────────────
 *
 *   (Customer)-[:IN_CART {quantity, added_at}]->(Product)
 *   (Customer)-[:PLACED]->(Order)-[:CONTAINS {quantity, unit_price}]->(Product)
 *   (Customer)-[:BOUGHT {rating_stars, bought_at}]->(Product)   ← KHÔNG ĐỔI
 *
 * ⚠️ QUAN TRỌNG: cạnh BOUGHT được giữ nguyên và vẫn được tạo mỗi khi đơn hàng
 * chuyển sang trạng thái đã thanh toán. Nhờ vậy Query A/B của Tiêu chí 3 chạy
 * y như cũ, không phải sửa một dòng nào, trong khi Order giữ toàn bộ chi tiết
 * giao dịch (số lượng, đơn giá, địa chỉ, trạng thái, thời gian).
 *
 * ─── LUỒNG THANH TOÁN TẠI CỬA HÀNG ───────────────────────────────────────
 *
 *   Khách đặt đơn trên web        → PENDING   (chờ thanh toán)
 *   Admin thấy đơn ở trang quản trị
 *   Khách tới cửa hàng trả tiền
 *   Admin bấm "Đã thanh toán"     → PAID      → sinh cạnh BOUGHT
 *   Giao hàng xong                → COMPLETED
 *   Khách đổi ý / không tới        → CANCELLED
 */

// ---------------------------------------------------------------------------
// GIỎ HÀNG
// ---------------------------------------------------------------------------

/**
 * Thêm sản phẩm vào giỏ. Đã có thì cộng dồn số lượng.
 * MERGE đảm bảo mỗi (khách, sản phẩm) chỉ có đúng 1 cạnh IN_CART.
 */
const CART_ADD_ITEM = `
MATCH (c:Customer {customer_id: $customerId})
MATCH (p:Product {id: $productId})
MERGE (c)-[r:IN_CART]->(p)
  ON CREATE SET r.quantity = $quantity, r.added_at = datetime()
  ON MATCH  SET r.quantity = r.quantity + $quantity
RETURN p.id AS product_id, r.quantity AS quantity
`;

/** Đặt số lượng cụ thể (dùng cho ô nhập số lượng ở trang giỏ hàng). */
const CART_SET_QUANTITY = `
MATCH (c:Customer {customer_id: $customerId})-[r:IN_CART]->(p:Product {id: $productId})
SET r.quantity = $quantity
RETURN p.id AS product_id, r.quantity AS quantity
`;

const CART_REMOVE_ITEM = `
MATCH (c:Customer {customer_id: $customerId})-[r:IN_CART]->(p:Product {id: $productId})
DELETE r
RETURN count(*) AS removed
`;

const CART_CLEAR = `
MATCH (c:Customer {customer_id: $customerId})-[r:IN_CART]->(:Product)
DELETE r
RETURN count(*) AS removed
`;

/** Danh sách sản phẩm trong giỏ + thành tiền từng dòng. */
const CART_LIST = `
MATCH (c:Customer {customer_id: $customerId})-[r:IN_CART]->(p:Product)
OPTIONAL MATCH (p)-[:BELONGS_TO]->(cat:Category)
RETURN p.id             AS id,
       p.title          AS title,
       p.image          AS image,
       p.final_price    AS final_price,
       p.rating         AS rating,
       cat.category_name AS category_name,
       r.quantity       AS quantity,
       p.final_price * r.quantity AS line_total
ORDER BY r.added_at DESC
`;

/** Số lượng mặt hàng trong giỏ — dùng cho badge trên Header. */
const CART_COUNT = `
MATCH (c:Customer {customer_id: $customerId})-[r:IN_CART]->(:Product)
RETURN count(r) AS item_count, sum(r.quantity) AS total_quantity
`;

// ---------------------------------------------------------------------------
// ĐƠN HÀNG
// ---------------------------------------------------------------------------

/**
 * Tạo đơn hàng từ toàn bộ giỏ hàng, trong MỘT transaction:
 *   1. Đọc giỏ, chốt đơn giá tại thời điểm đặt (unit_price) — giá sau này đổi
 *      cũng không làm sai đơn cũ.
 *   2. Tạo node Order + cạnh PLACED và CONTAINS.
 *   3. Xoá sạch cạnh IN_CART.
 *
 * CHƯA tạo BOUGHT ở bước này — chỉ tạo khi đơn được thanh toán (xem ORDER_MARK_PAID),
 * để gợi ý chỉ phản ánh hàng thực sự đã mua.
 */
const ORDER_CREATE_FROM_CART = `
MATCH (c:Customer {customer_id: $customerId})-[r:IN_CART]->(p:Product)
WITH c, collect({product: p, quantity: r.quantity, unit_price: p.final_price}) AS items,
     sum(p.final_price * r.quantity) AS total

CREATE (o:Order {
  order_id       : $orderId,
  status         : $status,
  total          : total,
  payment_method : $paymentMethod,
  receiver_name  : $receiverName,
  phone          : $phone,
  address        : $address,
  note           : $note,
  created_at     : datetime()
})
CREATE (c)-[:PLACED]->(o)

WITH c, o, items
UNWIND items AS item
// Phải gán node ra biến riêng — Cypher không cho dùng item.product
// làm điểm cuối của quan hệ trong CREATE.
WITH c, o, item, item.product AS prod
CREATE (o)-[:CONTAINS {quantity: item.quantity, unit_price: item.unit_price}]->(prod)

WITH DISTINCT c, o
MATCH (c)-[cart:IN_CART]->(:Product)
DELETE cart

RETURN o.order_id AS order_id, o.total AS total, o.status AS status
`;

/**
 * Đặt hàng THẲNG cho một sản phẩm — phục vụ nút "Mua ngay".
 *
 * Khác ORDER_CREATE_FROM_CART ở chỗ KHÔNG đọc và KHÔNG xoá quan hệ IN_CART.
 * Nhờ vậy "mua ngay" hoàn toàn tách khỏi giỏ hàng:
 *   - Khách bỏ ngang giữa chừng thì không có gì đọng lại trong giỏ.
 *   - Đơn tạo ra chỉ chứa đúng sản phẩm vừa bấm, không lẫn hàng đang có sẵn trong giỏ.
 *
 * Đơn giá vẫn được chốt tại thời điểm đặt hàng (đọc p.final_price ngay trong
 * câu lệnh tạo đơn), giống hệt luồng giỏ hàng — xem mục 4.4 của báo cáo.
 */
const ORDER_CREATE_DIRECT = `
MATCH (c:Customer {customer_id: $customerId})
MATCH (p:Product {id: $productId})
WITH c, p, p.final_price AS unitPrice, $quantity AS qty

CREATE (o:Order {
  order_id       : $orderId,
  status         : $status,
  total          : unitPrice * qty,
  payment_method : $paymentMethod,
  receiver_name  : $receiverName,
  phone          : $phone,
  address        : $address,
  note           : $note,
  created_at     : datetime()
})
CREATE (c)-[:PLACED]->(o)
CREATE (o)-[:CONTAINS {quantity: qty, unit_price: unitPrice}]->(p)

RETURN o.order_id AS order_id, o.total AS total, o.status AS status
`;

// ---------------------------------------------------------------------------
// Thanh toán chuyển khoản qua SePay
// ---------------------------------------------------------------------------

/**
 * Ghi nhận một giao dịch chuyển khoản, CHỐNG XỬ LÝ TRÙNG.
 *
 * VÌ SAO BẮT BUỘC PHẢI CÓ: SePay gửi lại webhook tới 7 lần trong 5 tiếng nếu
 * chưa nhận được phản hồi 200. Không chặn trùng thì một lần chuyển tiền có thể
 * bị xử lý nhiều lần — đơn được "thanh toán" lặp, kho bị trừ nhiều lần.
 *
 * MERGE theo tx_id (mã giao dịch do SePay cấp) là chốt chặn: lần đầu tạo mới và
 * trả la_moi = true, những lần sau chỉ khớp lại node cũ và trả false.
 *
 * LƯU Ý: phải có ràng buộc UNIQUE trên tx_id thì MERGE mới thật sự an toàn khi
 * hai webhook về cùng lúc — chạy `npm run setup:payment` để tạo ràng buộc đó.
 */
const PAYMENT_TX_RECORD = `
MERGE (t:PaymentTx {tx_id: $txId})
ON CREATE SET t.la_moi     = true,
              t.amount     = $amount,
              t.gateway    = $gateway,
              t.content    = $content,
              t.order_code = $orderCode,
              t.created_at = datetime()
ON MATCH  SET t.la_moi = false
RETURN t.la_moi AS la_moi, t.tx_id AS tx_id
`;

/** Nối giao dịch với đơn hàng để sau này tra soát được tiền vào từ đâu. */
const PAYMENT_TX_LINK_ORDER = `
MATCH (t:PaymentTx {tx_id: $txId})
MATCH (o:Order {order_id: $orderId})
MERGE (o)-[:PAID_BY]->(t)
RETURN t.tx_id AS tx_id, o.order_id AS order_id
`;

/** Đơn hàng kèm chủ đơn — dùng khi đối chiếu tiền chuyển khoản với đơn. */
const ORDER_FIND_FOR_PAYMENT = `
MATCH (c:Customer)-[:PLACED]->(o:Order {order_id: $orderId})
RETURN o.order_id AS order_id,
       o.status   AS status,
       o.total    AS total,
       c.customer_id AS customer_id
`;

/** Danh sách đơn của 1 khách (trang "Đơn hàng của tôi"). */
const ORDER_LIST_BY_CUSTOMER = `
MATCH (c:Customer {customer_id: $customerId})-[:PLACED]->(o:Order)
OPTIONAL MATCH (o)-[ct:CONTAINS]->(:Product)
WITH o, count(ct) AS item_count, sum(ct.quantity) AS total_quantity
RETURN o.order_id       AS order_id,
       o.status         AS status,
       o.total          AS total,
       o.payment_method AS payment_method,
       toString(o.created_at) AS created_at,
       toString(o.paid_at)    AS paid_at,
       item_count,
       total_quantity
ORDER BY o.created_at DESC
SKIP $skip LIMIT $limit
`;

const ORDER_COUNT_BY_CUSTOMER = `
MATCH (:Customer {customer_id: $customerId})-[:PLACED]->(o:Order)
RETURN count(o) AS total
`;

/**
 * Chi tiết 1 đơn. Trả kèm customer_id để tầng route kiểm tra quyền sở hữu —
 * tránh việc khách A đoán mã đơn của khách B rồi xem được.
 */
const ORDER_GET_DETAIL = `
MATCH (c:Customer)-[:PLACED]->(o:Order {order_id: $orderId})
OPTIONAL MATCH (o)-[ct:CONTAINS]->(p:Product)
WITH c, o, collect(CASE WHEN p IS NULL THEN NULL ELSE {
  id          : p.id,
  title       : p.title,
  image       : p.image,
  quantity    : ct.quantity,
  unit_price  : ct.unit_price,
  line_total  : ct.unit_price * ct.quantity
} END) AS items
RETURN o.order_id       AS order_id,
       o.status         AS status,
       o.total          AS total,
       o.payment_method AS payment_method,
       o.receiver_name  AS receiver_name,
       o.phone          AS phone,
       o.address        AS address,
       o.note           AS note,
       toString(o.created_at) AS created_at,
       toString(o.paid_at)    AS paid_at,
       o.paid_note      AS paid_note,
       c.customer_id    AS customer_id,
       c.customer_name  AS customer_name,
       [i IN items WHERE i IS NOT NULL] AS items
`;

/**
 * Admin xác nhận khách đã trả tiền tại cửa hàng.
 *
 * Đây là ĐIỂM NỐI giữa phần thương mại và phần gợi ý: ngay khi đơn được xác
 * nhận thanh toán, cạnh BOUGHT được sinh ra → Query A/B lập tức phản ánh hành
 * vi mua mới. Đó cũng là lý do BOUGHT không bị thay bằng Order.
 *
 * Chỉ chuyển khi đơn đang PENDING — admin lỡ bấm hai lần cũng không sinh thêm
 * gì (MERGE + điều kiện status).
 */
const ORDER_MARK_PAID = `
MATCH (c:Customer)-[:PLACED]->(o:Order {order_id: $orderId})
WHERE o.status = 'PENDING'
SET o.status    = 'PAID',
    o.paid_at   = datetime(),
    o.paid_note = $paidNote

WITH c, o
MATCH (o)-[:CONTAINS]->(p:Product)
MERGE (c)-[b:BOUGHT]->(p)
  ON CREATE SET b.rating_stars = 5, b.bought_at = datetime()

WITH DISTINCT o, c
RETURN o.order_id AS order_id,
       o.status   AS status,
       o.total    AS total,
       c.customer_id AS customer_id
`;

const ORDER_CONFIRM_PAID_BY_CUSTOMER = `
MATCH (c:Customer {customer_id: $customerId})-[:PLACED]->(o:Order {order_id: $orderId})
WHERE o.status = 'PENDING' AND o.payment_method = 'ZALOPAY'
SET o.status    = 'PAID',
    o.paid_at   = datetime(),
    o.paid_note = 'Khách xác nhận thanh toán qua ZaloPay'

WITH c, o
MATCH (o)-[:CONTAINS]->(p:Product)
MERGE (c)-[b:BOUGHT]->(p)
  ON CREATE SET b.rating_stars = 5, b.bought_at = datetime()

WITH DISTINCT o, c
RETURN o.order_id AS order_id,
       o.status   AS status,
       o.total    AS total,
       c.customer_id AS customer_id
`;

/** Đổi trạng thái đơn (admin dùng: COMPLETED / CANCELLED). */
const ORDER_UPDATE_STATUS = `
MATCH (o:Order {order_id: $orderId})
SET o.status = $status
WITH o
OPTIONAL MATCH (c:Customer)-[:PLACED]->(o)
RETURN o.order_id AS order_id, o.status AS status, c.customer_id AS customer_id
`;

/** Huỷ đơn — chỉ cho phép khi chưa thanh toán. */
const ORDER_CANCEL = `
MATCH (c:Customer {customer_id: $customerId})-[:PLACED]->(o:Order {order_id: $orderId})
WHERE o.status = 'PENDING'
SET o.status = 'CANCELLED'
RETURN o.order_id AS order_id, o.status AS status
`;

/** Tra cứu nhanh trạng thái đơn theo mã. */
const ORDER_FIND_PENDING = `
MATCH (o:Order {order_id: $orderId})
RETURN o.order_id AS order_id, o.status AS status, o.total AS total
`;

// ---------------------------------------------------------------------------
// ĐƠN HÀNG — PHÍA ADMIN
// ---------------------------------------------------------------------------

/**
 * Danh sách đơn cho trang quản trị, có lọc trạng thái + tìm kiếm + lọc ngày.
 *
 * Tìm kiếm khớp trên: mã đơn, tên người nhận, số điện thoại và tên khách hàng —
 * đây là những thứ nhân viên có trong tay khi khách gọi điện hỏi về đơn.
 *
 * Lọc ngày dựa trên ngày ĐẶT hàng (created_at), không phải ngày thanh toán,
 * vì nhân viên thường tra theo mốc "khách đặt hôm nào".
 */
const ADMIN_ORDER_LIST = `
MATCH (c:Customer)-[:PLACED]->(o:Order)
WHERE ($status = '' OR o.status = $status)
  AND ($search = ''
       OR toLower(o.order_id)      CONTAINS $search
       OR toLower(o.receiver_name) CONTAINS $search
       OR toLower(o.phone)         CONTAINS $search
       OR toLower(coalesce(c.customer_name, '')) CONTAINS $search)
  AND ($fromDate IS NULL OR date(o.created_at) >= date($fromDate))
  AND ($toDate   IS NULL OR date(o.created_at) <= date($toDate))
OPTIONAL MATCH (o)-[ct:CONTAINS]->(:Product)
WITH c, o, count(ct) AS item_count
RETURN o.order_id       AS order_id,
       o.status         AS status,
       o.total          AS total,
       o.payment_method AS payment_method,
       o.receiver_name  AS receiver_name,
       o.phone          AS phone,
       toString(o.created_at) AS created_at,
       c.customer_id    AS customer_id,
       c.customer_name  AS customer_name,
       item_count
ORDER BY o.created_at DESC
SKIP $skip LIMIT $limit
`;

const ADMIN_ORDER_COUNT = `
MATCH (c:Customer)-[:PLACED]->(o:Order)
WHERE ($status = '' OR o.status = $status)
  AND ($search = ''
       OR toLower(o.order_id)      CONTAINS $search
       OR toLower(o.receiver_name) CONTAINS $search
       OR toLower(o.phone)         CONTAINS $search
       OR toLower(coalesce(c.customer_name, '')) CONTAINS $search)
  AND ($fromDate IS NULL OR date(o.created_at) >= date($fromDate))
  AND ($toDate   IS NULL OR date(o.created_at) <= date($toDate))
RETURN count(o) AS total
`;

// ---------------------------------------------------------------------------
// HỒ SƠ KHÁCH HÀNG
// ---------------------------------------------------------------------------

/** Thông tin hồ sơ + vài số liệu tổng hợp để hiển thị trên trang cá nhân. */
const CUSTOMER_GET_PROFILE = `
MATCH (c:Customer {customer_id: $customerId})
OPTIONAL MATCH (c)-[:PLACED]->(o:Order)
WITH c,
     count(o)                                          AS order_count,
     sum(CASE WHEN o.status IN ['PAID','SHIPPING','COMPLETED'] THEN o.total ELSE 0 END) AS total_spent
RETURN c.customer_id   AS customer_id,
       c.customer_name AS customer_name,
       c.email         AS email,
       c.phone         AS phone,
       c.address       AS address,
       c.role          AS role,
       toString(c.created_at) AS created_at,
       order_count,
       total_spent,
       count { (c)-[:BOUGHT]->(:Product) } AS bought_count,
       count { (c)-[:VIEWED]->(:Product) } AS viewed_count
`;

/** Cập nhật hồ sơ. coalesce giữ nguyên giá trị cũ nếu client không gửi trường đó. */
const CUSTOMER_UPDATE_PROFILE = `
MATCH (c:Customer {customer_id: $customerId})
SET c.customer_name = coalesce($customerName, c.customer_name),
    c.phone         = coalesce($phone,        c.phone),
    c.address       = coalesce($address,      c.address)
RETURN c.customer_id   AS customer_id,
       c.customer_name AS customer_name,
       c.email         AS email,
       c.phone         AS phone,
       c.address       AS address
`;

module.exports = {
  // Giỏ hàng
  CART_ADD_ITEM,
  CART_SET_QUANTITY,
  CART_REMOVE_ITEM,
  CART_CLEAR,
  CART_LIST,
  CART_COUNT,
  // Đơn hàng
  ORDER_CREATE_FROM_CART,
  ORDER_CREATE_DIRECT,
  PAYMENT_TX_RECORD,
  PAYMENT_TX_LINK_ORDER,
  ORDER_FIND_FOR_PAYMENT,
  ORDER_LIST_BY_CUSTOMER,
  ORDER_COUNT_BY_CUSTOMER,
  ORDER_GET_DETAIL,
  ORDER_MARK_PAID,
  ORDER_CONFIRM_PAID_BY_CUSTOMER,
  ORDER_UPDATE_STATUS,
  ORDER_CANCEL,
  ORDER_FIND_PENDING,
  // Admin
  ADMIN_ORDER_LIST,
  ADMIN_ORDER_COUNT,
  // Hồ sơ
  CUSTOMER_GET_PROFILE,
  CUSTOMER_UPDATE_PROFILE,
};
