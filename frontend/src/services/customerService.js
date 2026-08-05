import { apiUrl } from "../config/api";

const API_URL = apiUrl("/customers");

export async function getCustomers() {
    const response = await fetch(API_URL);

    if (!response.ok) {
        throw new Error("Không lấy được danh sách khách hàng");
    }

    return response.json();
}

/**
 * Gợi ý cá nhân hoá (Query A).
 * @param {object} filters { categoryId, minPrice, maxPrice } — bỏ trống thì không lọc
 */
export async function getCustomerRecommendations(customerId, limit = 20, filters = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    appendFilters(params, filters);

    const response = await fetch(`${API_URL}/${customerId}/recommendations?${params}`);

    if (!response.ok) {
        throw new Error("Không lấy được gợi ý");
    }

    return response.json();
}

/**
 * Ghép tham số lọc vào query string, bỏ qua giá trị rỗng.
 * Tách riêng để danh sách sản phẩm / gợi ý / bán chạy dùng chung một cách gửi.
 */
export function appendFilters(params, { categoryId, minPrice, maxPrice, sort } = {}) {
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

export async function buyProduct(productId, token) {
    const response = await fetch(`${API_URL}/me/buy/${productId}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error("Không thể mua sản phẩm");
    }

    return response.json();
}