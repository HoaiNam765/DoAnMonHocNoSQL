const API_URL = "http://localhost:5000/api/customers";

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