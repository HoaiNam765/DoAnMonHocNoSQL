import { apiUrl } from "../config/api";

const API_URL = apiUrl("/admin");

function httpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function request(endpoint, token, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
    };

    const config = {
        ...options,
        headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw httpError(data.message || "Lỗi thao tác Admin", response.status);
    }

    return data;
}

// 1. Thống kê
export async function getAdminStats(token) {
    return request("/stats", token);
}

// 2. Danh mục
export async function getAdminCategories(token) {
    return request("/categories", token);
}

export async function createCategory(token, categoryData) {
    return request("/categories", token, {
        method: "POST",
        body: JSON.stringify(categoryData),
    });
}

export async function updateCategory(token, id, categoryData) {
    return request(`/categories/${id}`, token, {
        method: "PUT",
        body: JSON.stringify(categoryData),
    });
}

export async function deleteCategory(token, id) {
    return request(`/categories/${id}`, token, {
        method: "DELETE",
    });
}

// 3. Sản phẩm
export async function getAdminProducts(
    token,
    { page = 1, limit = 10, search = "", categoryId = "", sort = "" } = {}
) {
    const query = new URLSearchParams({
        page,
        limit,
        search,
        ...(categoryId ? { categoryId } : {}),
        ...(sort ? { sort } : {}),
    }).toString();

    return request(`/products?${query}`, token);
}

export async function createProduct(token, productData) {
    return request("/products", token, {
        method: "POST",
        body: JSON.stringify(productData),
    });
}

export async function updateProduct(token, id, productData) {
    return request(`/products/${id}`, token, {
        method: "PUT",
        body: JSON.stringify(productData),
    });
}

export async function deleteProduct(token, id) {
    return request(`/products/${id}`, token, {
        method: "DELETE",
    });
}

/** Đọc các thuộc tính tuỳ ý (do admin tự đặt) của một sản phẩm. */
export async function getProductAttributes(token, id) {
    return request(`/products/${id}/attributes`, token);
}

/**
 * Lưu thuộc tính tuỳ ý. Giá trị null nghĩa là xoá thuộc tính đó.
 * @param {object} attributes { "Mô tả": "...", "Bảo hành": null }
 */
export async function saveProductAttributes(token, id, attributes) {
    return request(`/products/${id}/attributes`, token, {
        method: "PUT",
        body: JSON.stringify({ attributes }),
    });
}

// 4. Người dùng
export async function getAdminUsers(token, { page = 1, limit = 10, search = "" } = {}) {
    const query = new URLSearchParams({ page, limit, search }).toString();
    return request(`/users?${query}`, token);
}

export async function getUserDetails(token, id) {
    return request(`/users/${id}`, token);
}

export async function updateUserRole(token, id, role) {
    return request(`/users/${id}/role`, token, {
        method: "PUT",
        body: JSON.stringify({ role }),
    });
}

export async function updateUserStatus(token, id, status) {
    return request(`/users/${id}/status`, token, {
        method: "PUT",
        body: JSON.stringify({ status }),
    });
}

// ---------------------------------------------------------------------------
// 5. Thống kê doanh thu theo thời gian & tồn kho
// ---------------------------------------------------------------------------

/**
 * Doanh thu theo thời gian.
 * @param {"month"|"day"} groupBy gộp theo tháng hay theo ngày
 * @param {string} from ngày bắt đầu, dạng YYYY-MM-DD (tuỳ chọn)
 * @param {string} to   ngày kết thúc, dạng YYYY-MM-DD (tuỳ chọn)
 */
export async function getRevenue(token, { groupBy = "month", from = "", to = "" } = {}) {
    const params = new URLSearchParams({ groupBy });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return request(`/revenue?${params}`, token);
}

/** Lịch sử đơn hàng của một khách hàng cụ thể. */
export async function getUserOrders(token, customerId) {
    return request(`/users/${customerId}/orders`, token);
}

/** Chi tiết một đơn hàng, kèm danh sách sản phẩm khách đã chọn. */
export async function getAdminOrderDetail(token, orderId) {
    return request(`/orders/${orderId}`, token);
}

/** Sản phẩm sắp hết hàng. */
export async function getLowStock(token, threshold = 10) {
    return request(`/low-stock?threshold=${threshold}`, token);
}
