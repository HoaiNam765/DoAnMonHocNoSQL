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

module.exports = {
  COUNT_PRODUCTS,
  LIST_PRODUCTS,
  GET_PRODUCT_BY_ID,
  COUNT_CUSTOMERS,
  LIST_CUSTOMERS,
  GET_CUSTOMER_BY_ID,
  RECOMMEND_FOR_CUSTOMER,
  RECOMMEND_FOR_PRODUCT,
};
