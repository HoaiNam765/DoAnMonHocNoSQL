const API_URL = "http://localhost:5000/api/admin";

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
export async function getAdminProducts(token, { page = 1, limit = 10, search = "", categoryId = "" } = {}) {
    const query = new URLSearchParams({
        page,
        limit,
        search,
        ...(categoryId ? { categoryId } : {}),
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
