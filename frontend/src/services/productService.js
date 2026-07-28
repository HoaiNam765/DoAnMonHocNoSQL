const API_URL = "http://localhost:5000/api/products";

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
 * Danh sách sản phẩm
 */
export async function getProducts(page = 1, limit = 12, search = "") {
    const response = await fetch(
        `${API_URL}?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
    );

    if (!response.ok) {
        throw httpError("Không lấy được danh sách sản phẩm", response.status);
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
export async function getPopularProducts(limit = 8) {
    const response = await fetch(`${API_URL}/popular?limit=${limit}`);

    if (!response.ok) {
        throw httpError("Không lấy được danh sách sản phẩm phổ biến", response.status);
    }

    return response.json();
}

/**
 * Khách khác cũng mua
 */
export async function getRecommendations(productId, limit = 6) {
    const response = await fetch(
        `${API_URL}/${productId}/recommendations?limit=${limit}`
    );

    if (!response.ok) {
        throw httpError("Không lấy được gợi ý sản phẩm", response.status);
    }

    return response.json();
}