/**
 * Cypher cho thống kê quản trị và quản lý tồn kho.
 *
 * Tách riêng vì hai lý do:
 *   - `cypher.js` giữ phần Cypher của Tiêu chí 3 mà báo cáo trích dẫn nguyên văn
 *   - `shopCypher.js` giữ nghiệp vụ giỏ hàng / đơn hàng
 */

// ---------------------------------------------------------------------------
// THỐNG KÊ — dựa trên node Order (số liệu giao dịch thật)
// ---------------------------------------------------------------------------

/**
 * Doanh thu theo thời gian, gộp theo tháng hoặc theo ngày.
 *
 * VÌ SAO LẤY TỪ Order CHỨ KHÔNG TỪ CẠNH BOUGHT:
 * BOUGHT là tín hiệu đầu vào cho thuật toán gợi ý, và phần lớn đến từ dữ liệu
 * import mô phỏng — nó không mang ý nghĩa doanh thu. Chỉ node Order mới có số
 * tiền thật và mốc thời gian của giao dịch.
 *
 * Doanh thu ghi nhận tại thời điểm THANH TOÁN (paid_at), không phải lúc đặt
 * hàng: đơn còn PENDING thì tiền chưa vào nên chưa tính.
 */
const REVENUE_BY_PERIOD = `
MATCH (o:Order)
WHERE o.status IN ['PAID', 'COMPLETED']
WITH o, coalesce(o.paid_at, o.created_at) AS ts
WHERE ($fromDate IS NULL OR date(ts) >= date($fromDate))
  AND ($toDate   IS NULL OR date(ts) <= date($toDate))
WITH o,
     CASE $groupBy
       WHEN 'day' THEN toString(date(ts))
       WHEN 'month' THEN toString(ts.year) + '-' + right('0' + toString(ts.month), 2)
       ELSE toString(ts.year)
     END AS period
RETURN period,
       sum(o.total) AS revenue,
       count(o)     AS order_count
ORDER BY period
`;

/** Số liệu tổng hợp về đơn hàng thật, tách khỏi thống kê trên đồ thị BOUGHT. */
const ORDER_SUMMARY = `
MATCH (o:Order)
WITH collect(o) AS orders
RETURN size(orders)                                          AS total_orders,
       size([o IN orders WHERE o.status = 'PENDING'])         AS pending_orders,
       size([o IN orders WHERE o.status = 'PAID'])            AS paid_orders,
       size([o IN orders WHERE o.status = 'COMPLETED'])       AS completed_orders,
       size([o IN orders WHERE o.status = 'CANCELLED'])       AS cancelled_orders,
       reduce(s = 0, o IN [x IN orders WHERE x.status IN ['PAID', 'COMPLETED']] | s + o.total)
                                                              AS real_revenue
`;

/**
 * Hoạt động mua hàng gần nhất.
 *
 * SỬA LỖI: bản cũ duyệt cạnh BOUGHT rồi dùng `coalesce(b.bought_at, datetime())`.
 * Do 24.815/24.819 cạnh BOUGHT nhập từ CSV không có `bought_at`, tất cả đều
 * nhận giá trị "bây giờ" nên luôn xếp đầu và che mất các lượt mua thật.
 * Bản này duyệt node Order — mọi Order đều có `created_at` chính xác.
 */
const RECENT_ACTIVITY = `
MATCH (c:Customer)-[:PLACED]->(o:Order)
OPTIONAL MATCH (o)-[ct:CONTAINS]->(p:Product)
WITH c, o, count(ct) AS item_count, collect(p)[0] AS first_product
RETURN o.order_id             AS order_id,
       o.status               AS status,
       o.total                AS total,
       toString(o.created_at) AS created_at,
       c.customer_id          AS customer_id,
       c.customer_name        AS customer_name,
       first_product.title    AS product_title,
       first_product.image    AS image,
       item_count
ORDER BY o.created_at DESC
LIMIT 10
`;

/** Đơn hàng của một khách cụ thể — dùng ở màn hình chi tiết người dùng. */
const USER_ORDERS = `
MATCH (:Customer {customer_id: $customerId})-[:PLACED]->(o:Order)
OPTIONAL MATCH (o)-[ct:CONTAINS]->(:Product)
WITH o, count(ct) AS item_count, sum(ct.quantity) AS total_quantity
RETURN o.order_id             AS order_id,
       o.status               AS status,
       o.total                AS total,
       toString(o.created_at) AS created_at,
       toString(o.paid_at)    AS paid_at,
       item_count,
       total_quantity
ORDER BY o.created_at DESC
LIMIT 50
`;

// ---------------------------------------------------------------------------
// TỒN KHO
// ---------------------------------------------------------------------------

/**
 * Kiểm tra tồn kho cho toàn bộ giỏ trước khi tạo đơn.
 * Trả về các dòng KHÔNG đủ hàng — mảng rỗng nghĩa là đặt được.
 */
const CHECK_STOCK_FOR_CART = `
MATCH (:Customer {customer_id: $customerId})-[r:IN_CART]->(p:Product)
WHERE coalesce(p.stock, 0) < r.quantity
RETURN p.id                 AS id,
       p.title              AS title,
       coalesce(p.stock, 0) AS stock,
       r.quantity           AS requested
`;

/**
 * Tồn kho của 1 sản phẩm, kèm số lượng khách đã bỏ sẵn trong giỏ.
 * Dùng khi thêm vào giỏ: tổng (đang có trong giỏ + thêm mới) không được vượt kho.
 */
const GET_PRODUCT_STOCK = `
MATCH (p:Product {id: $productId})
OPTIONAL MATCH (:Customer {customer_id: $customerId})-[r:IN_CART]->(p)
RETURN coalesce(p.stock, 0) AS stock,
       coalesce(r.quantity, 0) AS in_cart
`;

/**
 * Trừ kho cho toàn bộ sản phẩm trong đơn.
 *
 * Gọi cùng lúc với việc xác nhận thanh toán. Trừ ở thời điểm THANH TOÁN chứ
 * không phải lúc đặt hàng, vì mô hình bán tại cửa hàng: khách đặt trên web
 * nhưng có thể không tới lấy, giữ hàng sớm sẽ khoá nhầm tồn kho.
 *
 * Dùng CASE để kẹp sàn về 0, tránh tồn kho âm nếu dữ liệu bị lệch.
 */
const DECREASE_STOCK_FOR_ORDER = `
MATCH (o:Order {order_id: $orderId})-[ct:CONTAINS]->(p:Product)
WITH p, ct, coalesce(p.stock, 0) AS current
SET p.stock = CASE WHEN current - ct.quantity < 0 THEN 0 ELSE current - ct.quantity END
RETURN p.id AS product_id, p.stock AS remaining
`;

/** Cộng trả kho khi huỷ đơn đã thanh toán (admin huỷ nhầm / khách trả hàng). */
const RESTORE_STOCK_FOR_ORDER = `
MATCH (o:Order {order_id: $orderId})-[ct:CONTAINS]->(p:Product)
SET p.stock = coalesce(p.stock, 0) + ct.quantity
RETURN p.id AS product_id, p.stock AS remaining
`;

/** Sản phẩm sắp hết hàng — cảnh báo trên trang tổng quan. */
const LOW_STOCK_PRODUCTS = `
MATCH (p:Product)
WHERE coalesce(p.stock, 0) <= $threshold
RETURN p.id                 AS id,
       p.title              AS title,
       p.image              AS image,
       coalesce(p.stock, 0) AS stock
ORDER BY stock ASC, p.title ASC
LIMIT 10
`;

module.exports = {
  REVENUE_BY_PERIOD,
  ORDER_SUMMARY,
  RECENT_ACTIVITY,
  USER_ORDERS,
  CHECK_STOCK_FOR_CART,
  GET_PRODUCT_STOCK,
  DECREASE_STOCK_FOR_ORDER,
  RESTORE_STOCK_FOR_ORDER,
  LOW_STOCK_PRODUCTS,
};
