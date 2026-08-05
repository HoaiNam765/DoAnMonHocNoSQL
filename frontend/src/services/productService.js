import { apiUrl } from "../config/api";

const API_URL = apiUrl("/products");

/**
 * Tạo Error có kèm mã HTTP để phía giao diện phân biệt được các trường hợp:
 * 404 (không tìm thấy) khác với 500 / mất kết nối.
 */
function httpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

/**
 * Ghép tham số lọc vào query string, bỏ qua giá trị rỗng.
 * Dùng chung cho danh sách sản phẩm, gợi ý và bán chạy.
 */
function appendFilters(params, { categoryId, minPrice, maxPrice, sort } = {}) {
    if (categoryId) params.set("categoryId", categoryId);
    if (minPrice !== "" && minPrice !== null && minPrice !== undefined) {
        params.set("minPrice", String(minPrice));
    }
    if (maxPrice !== "" && maxPrice !== null && maxPrice !== undefined) {
        params.set("maxPrice", String(maxPrice));
    }
    if (sort) params.set("sort", sort);
    return params;
}

/**
 * Danh sách sản phẩm
 * @param {object} filters { categoryId, minPrice, maxPrice }
 */
export async function getProducts(page = 1, limit = 12, search = "", filters = {}) {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search,
    });
    appendFilters(params, filters);

    const response = await fetch(`${API_URL}?${params}`);

    if (!response.ok) {
        throw httpError("Không lấy được danh sách sản phẩm", response.status);
    }

    return response.json();
}

/** Danh mục cho ô lọc — công khai, không cần đăng nhập. */
export async function getCategories() {
    const response = await fetch(`${API_URL}/categories`);

    if (!response.ok) {
        throw httpError("Không lấy được danh mục", response.status);
    }

    return response.json();
}

/** Các lượt mua gần nhất cho dòng tin chạy ở trang chủ. */
export async function getRecentPurchases(limit = 10) {
    const response = await fetch(`${API_URL}/recent-purchases?limit=${limit}`);

    if (!response.ok) {
        throw httpError("Không lấy được tin mua hàng", response.status);
    }

    return response.json();
}

/**
 * Chi tiết sản phẩm
 * Có thể truyền token để backend xác thực user và lưu lịch sử VIEWED
 */
export async function getProductById(productId, token = null) {
    const headers = {};

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/${productId}`, {
        headers,
    });

    if (!response.ok) {
        throw httpError("Không lấy được chi tiết sản phẩm", response.status);
    }

    return response.json();
}

/**
 * Lấy danh sách sản phẩm phổ biến
 */
export async function getPopularProducts(limit = 8, filters = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    appendFilters(params, filters);

    const response = await fetch(`${API_URL}/popular?${params}`);

    if (!response.ok) {
        throw httpError("Không lấy được danh sách sản phẩm phổ biến", response.status);
    }

    return response.json();
}

/**
 * Khách khác cũng mua
 */
export async function getRecommendations(productId, limit = 20) {
    const response = await fetch(
        `${API_URL}/${productId}/recommendations?limit=${limit}`
    );

    if (!response.ok) {
        throw httpError("Không lấy được gợi ý sản phẩm", response.status);
    }

    return response.json();
}