/**
 * Sinh dữ liệu BOUGHT mô phỏng bổ sung.
 *
 * LÝ DO: file gốc `data2/bought_relations.csv` có 3.520/3.539 khách hàng chỉ mua
 * ĐÚNG 1 sản phẩm. Pattern gợi ý của đề bài
 *   (c1)-[:BOUGHT]->(p1)<-[:BOUGHT]-(c2)-[:BOUGHT]->(p2)
 * bắt buộc c2 phải mua từ 2 sản phẩm trở lên, nên với dữ liệu gốc chỉ 3,2% khách
 * hàng và 3,2% sản phẩm ra được gợi ý — tính năng chính coi như không chạy.
 *
 * CÁCH LÀM: giữ nguyên 100% dòng gốc, chỉ BỔ SUNG thêm các lượt mua mô phỏng theo
 * sở thích danh mục (mỗi khách có 1-2 danh mục ưa thích, ưu tiên sản phẩm "hot"),
 * để tạo ra tín hiệu đồng mua thật sự. Dùng seed cố định nên chạy lại luôn ra
 * cùng kết quả.
 *
 * LƯU Ý BÁO CÁO: phải ghi rõ đây là dữ liệu mô phỏng, không phải hành vi mua thật.
 *
 * Chạy: node scripts/generate-bought.js
 * Kết quả: data2/bought_relations_full.csv
 */
const path = require('path');
const { readCsv, writeCsv } = require('./lib/csv');

const DATA_DIR = path.join(__dirname, '..', '..', 'data2');
const OUT_FILE = path.join(DATA_DIR, 'bought_relations_full.csv');

const SEED = 20260720;
const MIN_ITEMS = 4; // số sản phẩm tối thiểu mỗi khách sau khi bổ sung
const MAX_ITEMS = 10; // số sản phẩm tối đa mỗi khách
const FAVOURITE_RATIO = 0.75; // tỉ lệ mua trong danh mục ưa thích

/** PRNG mulberry32 — có seed để kết quả tái lập được. */
const makeRandom = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rnd = makeRandom(SEED);

const randInt = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

/** Chọn 1 phần tử theo trọng số tích luỹ đã dựng sẵn. */
const pickWeighted = (items, cumulative) => {
  const target = rnd() * cumulative[cumulative.length - 1];
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return items[lo];
};

const buildCumulative = (weights) => {
  const out = new Array(weights.length);
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i];
    out[i] = sum;
  }
  return out;
};

// ---------- 1. Đọc dữ liệu gốc ----------
const products = readCsv(path.join(DATA_DIR, 'products.csv'));
const customers = readCsv(path.join(DATA_DIR, 'customers.csv'));
const relations = readCsv(path.join(DATA_DIR, 'product_category_relations.csv'));
const bought = readCsv(path.join(DATA_DIR, 'bought_relations.csv'));

const productIds = products.map((p) => p.id);
const productSet = new Set(productIds);

const categoryOfProduct = new Map();
const productsByCategory = new Map();
for (const r of relations) {
  if (!productSet.has(r.product_id)) continue;
  categoryOfProduct.set(r.product_id, r.category_id);
  if (!productsByCategory.has(r.category_id)) productsByCategory.set(r.category_id, []);
  productsByCategory.get(r.category_id).push(r.product_id);
}
const categoryIds = [...productsByCategory.keys()];

// ---------- 2. Gán độ "hot" cho từng sản phẩm (phân phối Zipf) ----------
// Sản phẩm hot được nhiều người mua -> tạo điểm giao nhau cho Query A/B.
const shuffled = [...productIds];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
const popularity = new Map();
shuffled.forEach((id, rank) => popularity.set(id, 1 / Math.pow(rank + 1, 0.6)));

const globalCumulative = buildCumulative(productIds.map((id) => popularity.get(id)));

const categoryPools = new Map();
for (const [catId, ids] of productsByCategory) {
  categoryPools.set(catId, { ids, cumulative: buildCumulative(ids.map((id) => popularity.get(id))) });
}
// Chọn danh mục ưa thích theo số sản phẩm trong danh mục đó.
const categoryCumulative = buildCumulative(categoryIds.map((c) => productsByCategory.get(c).length));

// ---------- 3. Gom lượt mua gốc theo khách hàng ----------
const owned = new Map(); // customer_id -> Map<product_id, rating_stars>
for (const c of customers) owned.set(c.customer_id, new Map());

let skipped = 0;
for (const b of bought) {
  if (!owned.has(b.customer_id) || !productSet.has(b.product_id)) {
    skipped++;
    continue;
  }
  owned.get(b.customer_id).set(b.product_id, b.rating_stars || '5');
}

// ---------- 4. Bổ sung lượt mua mô phỏng ----------
const randomStars = () => {
  const r = rnd();
  if (r < 0.6) return '5';
  if (r < 0.85) return '4';
  return '3';
};

let added = 0;
for (const [customerId, items] of owned) {
  // Danh mục ưa thích: ưu tiên danh mục của sản phẩm khách đã thực sự mua.
  const favourites = new Set();
  for (const pid of items.keys()) {
    const cat = categoryOfProduct.get(pid);
    if (cat) favourites.add(cat);
  }
  while (favourites.size < 2) {
    favourites.add(pickWeighted(categoryIds, categoryCumulative));
  }
  const favouriteList = [...favourites];

  const target = randInt(MIN_ITEMS, MAX_ITEMS);
  let attempts = 0;
  while (items.size < target && attempts < target * 20) {
    attempts++;
    let productId;
    if (rnd() < FAVOURITE_RATIO) {
      const pool = categoryPools.get(pick(favouriteList));
      productId = pickWeighted(pool.ids, pool.cumulative);
    } else {
      productId = pickWeighted(productIds, globalCumulative);
    }
    if (items.has(productId)) continue;
    items.set(productId, randomStars());
    added++;
  }
}

// ---------- 5. Ghi file ----------
const rows = [];
for (const [customerId, items] of owned) {
  for (const [productId, ratingStars] of items) {
    rows.push({ customer_id: customerId, product_id: productId, rating_stars: ratingStars });
  }
}
writeCsv(OUT_FILE, ['customer_id', 'product_id', 'rating_stars'], rows);

// ---------- 6. Thống kê + kiểm tra độ phủ của Query A / Query B ----------
const buyersOfProduct = new Map();
for (const [customerId, items] of owned) {
  for (const productId of items.keys()) {
    if (!buyersOfProduct.has(productId)) buyersOfProduct.set(productId, []);
    buyersOfProduct.get(productId).push(customerId);
  }
}

let customersWithReco = 0;
for (const [customerId, items] of owned) {
  const mine = new Set(items.keys());
  let found = false;
  outer: for (const p1 of mine) {
    for (const c2 of buyersOfProduct.get(p1)) {
      if (c2 === customerId) continue;
      for (const p2 of owned.get(c2).keys()) {
        if (!mine.has(p2)) {
          found = true;
          break outer;
        }
      }
    }
  }
  if (found) customersWithReco++;
}

let productsWithReco = 0;
for (const [p1, buyers] of buyersOfProduct) {
  let found = false;
  outer: for (const c2 of buyers) {
    for (const p2 of owned.get(c2).keys()) {
      if (p2 !== p1) {
        found = true;
        break outer;
      }
    }
  }
  if (found) productsWithReco++;
}

const pct = (a, b) => `${((a / b) * 100).toFixed(1)}%`;

console.log('--- Sinh dữ liệu BOUGHT mô phỏng ---');
console.log(`Dòng gốc giữ lại       : ${bought.length - skipped}${skipped ? ` (bỏ ${skipped} dòng lỗi khoá)` : ''}`);
console.log(`Dòng mô phỏng bổ sung  : ${added}`);
console.log(`Tổng số quan hệ BOUGHT : ${rows.length}`);
console.log(`Trung bình SP/khách    : ${(rows.length / owned.size).toFixed(2)}`);
console.log(`Sản phẩm được mua      : ${buyersOfProduct.size}/${productIds.length}`);
console.log(`Khách có gợi ý Query A : ${customersWithReco}/${owned.size} (${pct(customersWithReco, owned.size)})`);
console.log(`SP có gợi ý Query B    : ${productsWithReco}/${productIds.length} (${pct(productsWithReco, productIds.length)})`);
console.log(`\nĐã ghi: ${OUT_FILE}`);
