/**
 * Tập trung toàn bộ câu Cypher của ứng dụng vào một chỗ.
 * Mục đích: dễ đối chiếu với báo cáo (Tiêu chí 3) và dễ chạy thử lại trong Neo4j Browser.
 */

// ---------------------------------------------------------------------------
// Sản phẩm
// ---------------------------------------------------------------------------

/** Đếm tổng số sản phẩm khớp bộ lọc (phục vụ phân trang). */
const COUNT_PRODUCTS = `
MATCH (p:Product)
WHERE ($search = '' OR toLower(p.title) CONTAINS $search)
  AND ($categoryId IS NULL OR EXISTS { (p)-[:BELONGS_TO]->(:Category {category_id: $categoryId}) })
RETURN count(p) AS total
`;

/** Danh sách sản phẩm có phân trang + tìm kiếm theo tên + lọc theo danh mục. */
const LIST_PRODUCTS = `
MATCH (p:Product)
WHERE ($search = '' OR toLower(p.title) CONTAINS $search)
  AND ($categoryId IS NULL OR EXISTS { (p)-[:BELONGS_TO]->(:Category {category_id: $categoryId}) })
OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Category)
RETURN p.id            AS id,
       p.title         AS title,
       p.final_price   AS final_price,
       p.rating        AS rating,
       p.image         AS image,
       coalesce(p.stock, 0) AS stock,
       c.category_id   AS category_id,
       c.category_name AS category_name
ORDER BY coalesce(p.rating, 0) DESC, p.id ASC
SKIP $skip LIMIT $limit
`;

/** Chi tiết 1 sản phẩm kèm tên danh mục + vài chỉ số đồ thị để hiển thị. */
const GET_PRODUCT_BY_ID = `
MATCH (p:Product {id: $productId})
OPTIONAL MATCH (p)-[:BELONGS_TO]->(c:Category)
RETURN p.id            AS id,
       p.title         AS title,
       p.final_price   AS final_price,
       p.rating        AS rating,
       p.image         AS image,
       coalesce(p.stock, 0) AS stock,
       c.category_id   AS category_id,
       c.category_name AS category_name,
       count { (:Customer)-[:BOUGHT]->(p) }  AS bought_count,
       count { (:Customer)-[:VIEWED]->(p) }  AS viewed_count
`;

// ---------------------------------------------------------------------------
// Khách hàng
// ---------------------------------------------------------------------------

/** Đếm tổng số khách hàng khớp bộ lọc. */
const COUNT_CUSTOMERS = `
MATCH (c:Customer)
WHERE $search = ''
   OR toLower(c.customer_name) CONTAINS $search
   OR toLower(c.customer_id) CONTAINS $search
RETURN count(c) AS total
`;

/** Danh sách khách hàng cho dropdown "đăng nhập giả lập". */
const LIST_CUSTOMERS = `
MATCH (c:Customer)
WHERE $search = ''
   OR toLower(c.customer_name) CONTAINS $search
   OR toLower(c.customer_id) CONTAINS $search
RETURN c.customer_id   AS customer_id,
       c.customer_name AS customer_name,
       count { (c)-[:BOUGHT]->(:Product) } AS bought_count
ORDER BY bought_count DESC, c.customer_id ASC
SKIP $skip LIMIT $limit
`;

/** Kiểm tra khách hàng có tồn tại không (để trả 404 cho đúng). */
const GET_CUSTOMER_BY_ID = `
MATCH (c:Customer {customer_id: $customerId})
RETURN c.customer_id   AS customer_id,
       c.customer_name AS customer_name,
       count { (c)-[:BOUGHT]->(:Product) } AS bought_count
`;

// ---------------------------------------------------------------------------
// Gợi ý — 2 câu Cypher chính của Tiêu chí 3
// ---------------------------------------------------------------------------

/**
 * QUERY A — đúng nguyên văn pattern trong đề bài:
 *   (c1)-[:BOUGHT]->(p1)<-[:BOUGHT]-(c2)-[:BOUGHT]->(p2)
 * Gợi ý cá nhân hoá cho khách hàng c1: tìm những khách c2 mua trùng sản phẩm p1
 * với c1, rồi lấy các sản phẩm p2 mà c2 đã mua nhưng c1 thì chưa.
 * Điểm số = số khách hàng c2 khác nhau cùng dẫn tới p2.
 */
const RECOMMEND_FOR_CUSTOMER = `
MATCH (c1:Customer {customer_id: $customerId})-[:BOUGHT]->(p1:Product)
      <-[:BOUGHT]-(c2:Customer)-[:BOUGHT]->(p2:Product)
WHERE c1 <> c2
  AND NOT (c1)-[:BOUGHT]->(p2)
WITH p2, count(DISTINCT c2) AS score
OPTIONAL MATCH (p2)-[:BELONGS_TO]->(cat:Category)
RETURN p2.id            AS id,
       p2.title         AS title,
       p2.final_price   AS final_price,
       p2.rating        AS rating,
       p2.image         AS image,
       cat.category_name AS category_name,
       score
ORDER BY score DESC, coalesce(p2.rating, 0) DESC, p2.id ASC
LIMIT $limit
`;

/**
 * QUERY B — biến thể lấy sản phẩm đang xem làm gốc, phục vụ yêu cầu sản phẩm
 * "khách bấm xem 1 món hàng -> tự động gợi ý mua kèm":
 *   (p1)<-[:BOUGHT]-(c2)-[:BOUGHT]->(p2)
 * Vẫn duyệt đồ thị theo tinh thần BOUGHT-BOUGHT, chỉ khác điểm neo bắt đầu.
 */
const RECOMMEND_FOR_PRODUCT = `
MATCH (p1:Product {id: $productId})<-[:BOUGHT]-(c2:Customer)-[:BOUGHT]->(p2:Product)
WHERE p2.id <> $productId
WITH p2, count(DISTINCT c2) AS score
OPTIONAL MATCH (p2)-[:BELONGS_TO]->(cat:Category)
RETURN p2.id            AS id,
       p2.title         AS title,
       p2.final_price   AS final_price,
       p2.rating        AS rating,
       p2.image         AS image,
       cat.category_name AS category_name,
       score
ORDER BY score DESC, coalesce(p2.rating, 0) DESC, p2.id ASC
LIMIT $limit
`;

// ---------------------------------------------------------------------------
// Task 2.5 — Ghi nhận hành vi VIEWED khi xem chi tiết sản phẩm
// ---------------------------------------------------------------------------

/**
 * Ghi nhận hành vi "đã xem" (VIEWED) cho 1 khách hàng với 1 sản phẩm,
 * đồng thời trả về thông tin chi tiết sản phẩm đó.
 *
 * - MERGE (c)-[:VIEWED]->(p): tạo quan hệ nếu chưa có, không trùng lặp.
 * - SET v.last_viewed_at: cập nhật thời điểm xem lần gần nhất.
 * - Trả về đầy đủ thông tin sản phẩm (giống GET_PRODUCT_BY_ID) để route
 *   handler không cần gọi thêm 1 câu query riêng.
 *
 * Nếu customerId = null (khách vãng lai, chưa chọn trong dropdown),
 * route handler sẽ bỏ qua phần ghi VIEWED và chỉ gọi GET_PRODUCT_BY_ID.
 */
const RECORD_VIEWED_AND_GET_PRODUCT = `
MATCH (p:Product {id: $productId})
OPTIONAL MATCH (p)-[:BELONGS_TO]->(cat:Category)
WITH p, cat
OPTIONAL MATCH (c:Customer {customer_id: $customerId})
FOREACH (_ IN CASE WHEN c IS NOT NULL THEN [1] ELSE [] END |
  MERGE (c)-[v:VIEWED]->(p)
  SET v.last_viewed_at = datetime()
)
RETURN p.id            AS id,
       p.title         AS title,
       p.final_price   AS final_price,
       p.rating        AS rating,
       p.image         AS image,
       coalesce(p.stock, 0) AS stock,
       cat.category_id   AS category_id,
       cat.category_name AS category_name,
       count { (:Customer)-[:BOUGHT]->(p) }  AS bought_count,
       count { (:Customer)-[:VIEWED]->(p) }  AS viewed_count
`;

// ---------------------------------------------------------------------------
// Task A4 — Đồng bộ user từ Firebase vào Neo4j
// ---------------------------------------------------------------------------

/**
 * MERGE node Customer theo customer_id = 'U_' + firebase_uid.
 * - ON CREATE: tạo mới với firebase_uid, tên, email, ngày tạo.
 * - ON MATCH: chỉ cập nhật tên và email (cho phép user đổi tên trên Firebase).
 * - Trả về thông tin kèm bought_count để frontend biết ngay trạng thái cold-start.
 * Idempotent: gọi bao nhiêu lần cũng chỉ tạo 1 node.
 */
const SYNC_CUSTOMER = `
MERGE (c:Customer {customer_id: $customerId})
ON CREATE SET c.firebase_uid  = $firebaseUid,
              c.customer_name = $customerName,
              c.email         = $email,
              c.created_at    = datetime()
ON MATCH  SET c.customer_name = $customerName,
              c.email         = $email
WITH c
OPTIONAL MATCH (c)-[:HAS_ROLE]->(r:Role)
RETURN c.customer_id   AS customer_id,
       c.customer_name AS customer_name,
       c.email         AS email,
       coalesce(r.role_name, c.role, 'user') AS role,
       count { (c)-[:BOUGHT]->(:Product) } AS bought_count
`;

// ---------------------------------------------------------------------------
// Task A5 — Lấy thông tin user đã sync theo firebase_uid
// ---------------------------------------------------------------------------

/**
 * Tra cứu node Customer theo firebase_uid (lấy từ token đã verify).
 * Nếu không tìm thấy → route handler trả 404 (chưa gọi /sync).
 */
const GET_CUSTOMER_BY_FIREBASE_UID = `
MATCH (c:Customer {firebase_uid: $firebaseUid})
OPTIONAL MATCH (c)-[:HAS_ROLE]->(r:Role)
RETURN c.customer_id   AS customer_id,
       c.customer_name AS customer_name,
       c.email         AS email,
       coalesce(r.role_name, c.role, 'user') AS role,
       count { (c)-[:BOUGHT]->(:Product) } AS bought_count
`;

// ---------------------------------------------------------------------------
// Task A6 — Query C: Sản phẩm phổ biến (đếm lượt mua)
// ---------------------------------------------------------------------------

/**
 * QUERY C — đếm số khách hàng đã mua mỗi sản phẩm, sắp xếp theo độ phổ biến.
 * Phục vụ tài khoản mới chưa có lịch sử mua (cold-start).
 * Khác với Query A/B: không duyệt sâu đồ thị, chỉ đếm cạnh BOUGHT trực tiếp.
 */
const POPULAR_PRODUCTS = `
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
`;

// ---------------------------------------------------------------------------
// Task A7 — Mua hàng: tạo quan hệ BOUGHT
// ---------------------------------------------------------------------------

/**
 * MERGE quan hệ BOUGHT giữa Customer và Product.
 * - MERGE chống trùng: mua lại cùng sản phẩm không tạo thêm cạnh.
 * - SET rating_stars = 5 (mặc định), bought_at = thời điểm mua.
 * - Trả về customer_id, product_id và tổng bought_count sau khi mua.
 */
const BUY_PRODUCT = `
MATCH (c:Customer {customer_id: $customerId})
MATCH (p:Product {id: $productId})
MERGE (c)-[b:BOUGHT]->(p)
ON CREATE SET b.rating_stars = 5,
              b.bought_at    = datetime()
RETURN c.customer_id AS customer_id,
       p.id          AS product_id,
       count { (c)-[:BOUGHT]->(:Product) } AS bought_count
`;

/**
 * Kiểm tra sản phẩm có tồn tại không (dùng trước khi tạo BOUGHT).
 */
const CHECK_PRODUCT_EXISTS = `
MATCH (p:Product {id: $productId})
RETURN p.id AS id
`;

// ---------------------------------------------------------------------------
// Task Admin — Các câu truy vấn Cypher dành riêng cho Admin Management
// ---------------------------------------------------------------------------

/** Thống kê tổng quan hệ thống cho Admin Dashboard. */
const ADMIN_GET_STATS = `
MATCH (p:Product) WITH count(p) AS total_products
MATCH (c:Customer) WITH total_products, count(c) AS total_customers
MATCH (cat:Category) WITH total_products, total_customers, count(cat) AS total_categories
OPTIONAL MATCH (:Customer)-[b:BOUGHT]->(p:Product)
WITH total_products, total_customers, total_categories, count(b) AS total_orders, sum(p.final_price) AS total_revenue
RETURN total_products, total_customers, total_categories, total_orders, coalesce(total_revenue, 0) AS total_revenue
`;

/** Thống kê doanh thu & sản phẩm bán theo từng danh mục. */
const ADMIN_REVENUE_BY_CATEGORY = `
MATCH (cat:Category)<-[:BELONGS_TO]-(p:Product)
OPTIONAL MATCH (c:Customer)-[b:BOUGHT]->(p)
WITH cat, count(b) AS sold_count, sum(p.final_price) AS category_revenue, count(DISTINCT p) AS product_count
RETURN cat.category_id AS category_id,
       cat.category_name AS category_name,
       product_count,
       sold_count,
       coalesce(category_revenue, 0) AS revenue
ORDER BY revenue DESC, sold_count DESC
`;

/** 10 giao dịch / lượt mua mới nhất trong hệ thống. */
const ADMIN_RECENT_ORDERS = `
MATCH (c:Customer)-[b:BOUGHT]->(p:Product)
OPTIONAL MATCH (p)-[:BELONGS_TO]->(cat:Category)
RETURN c.customer_id AS customer_id,
       c.customer_name AS customer_name,
       p.id AS product_id,
       p.title AS product_title,
       p.final_price AS final_price,
       p.image AS image,
       cat.category_name AS category_name,
       coalesce(b.bought_at, datetime()) AS bought_at
ORDER BY bought_at DESC
LIMIT 10
`;

/** Danh sách tất cả danh mục cùng số lượng sản phẩm. */
const ADMIN_LIST_CATEGORIES = `
MATCH (cat:Category)
OPTIONAL MATCH (p:Product)-[:BELONGS_TO]->(cat)
RETURN cat.category_id AS category_id,
       cat.category_name AS category_name,
       coalesce(cat.status, 'active') AS status,
       count(p) AS product_count
ORDER BY cat.category_name ASC
`;

/** Tạo danh mục sản phẩm mới. */
const ADMIN_CREATE_CATEGORY = `
MERGE (cat:Category {category_id: $categoryId})
ON CREATE SET cat.category_name = $categoryName, cat.status = 'active'
RETURN cat.category_id AS category_id, cat.category_name AS category_name, cat.status AS status
`;

/** Cập nhật tên / trạng thái danh mục. */
const ADMIN_UPDATE_CATEGORY = `
MATCH (cat:Category {category_id: $categoryId})
SET cat.category_name = $categoryName, cat.status = $status
RETURN cat.category_id AS category_id, cat.category_name AS category_name, cat.status AS status
`;

/** Ẩn / Xóa danh mục. */
const ADMIN_DELETE_CATEGORY = `
MATCH (cat:Category {category_id: $categoryId})
SET cat.status = 'hidden'
RETURN cat.category_id AS category_id, cat.status AS status
`;

/** Tạo sản phẩm mới kèm liên kết với danh mục. */
const ADMIN_CREATE_PRODUCT = `
CREATE (p:Product {
  id: $id,
  title: $title,
  final_price: $finalPrice,
  rating: $rating,
  image: $image,
  stock: $stock,
  status: 'active'
})
WITH p
MATCH (cat:Category {category_id: $categoryId})
MERGE (p)-[:BELONGS_TO]->(cat)
RETURN p.id AS id, p.title AS title, p.final_price AS final_price, p.rating AS rating, p.image AS image, cat.category_id AS category_id, cat.category_name AS category_name
`;

/** Cập nhật thông tin sản phẩm. */
const ADMIN_UPDATE_PRODUCT = `
MATCH (p:Product {id: $id})
SET p.title = $title,
    p.final_price = $finalPrice,
    p.rating = $rating,
    p.image = $image,
    p.stock = $stock,
    p.status = $status
WITH p
OPTIONAL MATCH (p)-[r:BELONGS_TO]->(:Category)
DELETE r
WITH p
MATCH (cat:Category {category_id: $categoryId})
MERGE (p)-[:BELONGS_TO]->(cat)
RETURN p.id AS id, p.title AS title, p.final_price AS final_price, p.rating AS rating, p.image AS image, cat.category_id AS category_id, cat.category_name AS category_name
`;

/** Đổi trạng thái sản phẩm sang deleted. */
const ADMIN_DELETE_PRODUCT = `
MATCH (p:Product {id: $id})
SET p.status = 'deleted'
RETURN p.id AS id, p.status AS status
`;

/** Danh sách người dùng quản lý. */
const ADMIN_LIST_USERS = `
MATCH (c:Customer)
WHERE $search = ''
   OR toLower(c.customer_name) CONTAINS $search
   OR toLower(c.customer_id) CONTAINS $search
   OR toLower(coalesce(c.email, '')) CONTAINS $search
OPTIONAL MATCH (c)-[:HAS_ROLE]->(r:Role)
OPTIONAL MATCH (c)-[:BOUGHT]->(p:Product)
WITH c, r, count(p) AS bought_count
RETURN c.customer_id AS customer_id,
       c.customer_name AS customer_name,
       c.email AS email,
       c.firebase_uid AS firebase_uid,
       coalesce(r.role_name, c.role, 'user') AS role,
       coalesce(c.status, 'active') AS status,
       bought_count,
       c.created_at AS created_at
ORDER BY CASE WHEN c.email IS NOT NULL AND trim(c.email) <> '' THEN 1 ELSE 0 END DESC, bought_count DESC, c.customer_id ASC
SKIP $skip LIMIT $limit
`;

/** Đếm tổng số người dùng quản lý. */
const ADMIN_COUNT_USERS = `
MATCH (c:Customer)
WHERE $search = ''
   OR toLower(c.customer_name) CONTAINS $search
   OR toLower(c.customer_id) CONTAINS $search
   OR toLower(coalesce(c.email, '')) CONTAINS $search
RETURN count(c) AS total
`;

/** Chi tiết thông tin + lịch sử hoạt động của người dùng. */
const ADMIN_GET_USER_DETAILS = `
MATCH (c:Customer {customer_id: $customerId})
OPTIONAL MATCH (c)-[:HAS_ROLE]->(r:Role)
OPTIONAL MATCH (c)-[b:BOUGHT]->(bp:Product)
OPTIONAL MATCH (c)-[v:VIEWED]->(vp:Product)
RETURN c.customer_id AS customer_id,
       c.customer_name AS customer_name,
       c.email AS email,
       c.firebase_uid AS firebase_uid,
       coalesce(r.role_name, c.role, 'user') AS role,
       coalesce(c.status, 'active') AS status,
       c.created_at AS created_at,
       collect(DISTINCT { id: bp.id, title: bp.title, price: bp.final_price, image: bp.image, bought_at: b.bought_at })[..10] AS bought_products,
       collect(DISTINCT { id: vp.id, title: vp.title, price: vp.final_price, image: vp.image, viewed_at: v.last_viewed_at })[..10] AS viewed_products
`;

/** Cập nhật vai trò người dùng (admin / user) thông qua node (:Role) và quan hệ [:HAS_ROLE]. */
const ADMIN_UPDATE_USER_ROLE = `
MATCH (c:Customer {customer_id: $customerId})
OPTIONAL MATCH (c)-[oldRel:HAS_ROLE]->(:Role)
DELETE oldRel
WITH c
MERGE (r:Role {role_name: $role})
MERGE (c)-[:HAS_ROLE]->(r)
SET c.role = $role
RETURN c.customer_id AS customer_id, r.role_name AS role
`;

/** Cập nhật trạng thái người dùng (active / blocked). */
const ADMIN_UPDATE_USER_STATUS = `
MATCH (c:Customer {customer_id: $customerId})
SET c.status     = $status,
    c.blocked_at = CASE WHEN $status = 'blocked' THEN datetime() ELSE null END

// Khoá tài khoản thì huỷ luôn các đơn CHƯA thanh toán của khách đó — không để
// đơn treo vô thời hạn ở trạng thái chờ. Đơn đã thanh toán giữ nguyên vì tiền
// đã thu và hàng đã trừ kho.
//
// Không cần hoàn kho: kho chỉ bị trừ tại bước xác nhận thanh toán, mà đơn
// PENDING thì chưa qua bước đó.
WITH c
OPTIONAL MATCH (c)-[:PLACED]->(o:Order)
WHERE $status = 'blocked' AND o.status = 'PENDING'
SET o.status        = 'CANCELLED',
    o.cancelled_at  = datetime(),
    o.cancel_reason = 'Tài khoản bị khoá bởi quản trị viên'

RETURN c.customer_id AS customer_id,
       c.status      AS status,
       count(o)      AS cancelled_orders
`;

/**
 * Đọc trạng thái tài khoản để middleware quyết định cho qua hay chặn.
 * Truy vấn cực nhẹ: chỉ tra 1 node theo khoá có unique index.
 */
const GET_CUSTOMER_STATUS = `
MATCH (c:Customer {customer_id: $customerId})
RETURN coalesce(c.status, 'active') AS status
`;

module.exports = {
  COUNT_PRODUCTS,
  LIST_PRODUCTS,
  GET_PRODUCT_BY_ID,
  COUNT_CUSTOMERS,
  LIST_CUSTOMERS,
  GET_CUSTOMER_BY_ID,
  RECOMMEND_FOR_CUSTOMER,
  RECOMMEND_FOR_PRODUCT,
  RECORD_VIEWED_AND_GET_PRODUCT,
  SYNC_CUSTOMER,
  GET_CUSTOMER_BY_FIREBASE_UID,
  POPULAR_PRODUCTS,
  BUY_PRODUCT,
  CHECK_PRODUCT_EXISTS,
  ADMIN_GET_STATS,
  ADMIN_REVENUE_BY_CATEGORY,
  ADMIN_RECENT_ORDERS,
  ADMIN_LIST_CATEGORIES,
  ADMIN_CREATE_CATEGORY,
  ADMIN_UPDATE_CATEGORY,
  ADMIN_DELETE_CATEGORY,
  ADMIN_CREATE_PRODUCT,
  ADMIN_UPDATE_PRODUCT,
  ADMIN_DELETE_PRODUCT,
  ADMIN_LIST_USERS,
  ADMIN_COUNT_USERS,
  ADMIN_GET_USER_DETAILS,
  ADMIN_UPDATE_USER_ROLE,
  ADMIN_UPDATE_USER_STATUS,
  GET_CUSTOMER_STATUS,
};