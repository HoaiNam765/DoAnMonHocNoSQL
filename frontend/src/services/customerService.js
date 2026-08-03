import { apiUrl } from "../config/api";

const API_URL = apiUrl("/customers");

export async function getCustomers() {
    const response = await fetch(API_URL);

    if (!response.ok) {
        throw new Error("Không lấy được danh sách khách hàng");
    }

    return response.json();
}

export async function getCustomerRecommendations(customerId, limit = 6) {
    const response = await fetch(
        `${API_URL}/${customerId}/recommendations?limit=${limit}`
    );

    if (!response.ok) {
        throw new Error("Không lấy được gợi ý");
    }

    return response.json();
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