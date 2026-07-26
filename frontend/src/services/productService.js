const API_URL = "http://localhost:5000/api/products";

export async function getProducts() {
    const response = await fetch(API_URL);

    if (!response.ok) {
        throw new Error("Không lấy được danh sách sản phẩm");
    }

    return await response.json();
}

export async function getProductById(id) {
    const response = await fetch(`${API_URL}/${id}`);

    if (!response.ok) {
        throw new Error("Không lấy được chi tiết sản phẩm");
    }

    return await response.json();
}

export async function getRecommendations(id) {

    const response = await fetch(
        `${API_URL}/${id}/recommendations`
    );

    if (!response.ok) {
        throw new Error("Không lấy được sản phẩm gợi ý");
    }

    return await response.json();
}