const API_URL = "http://localhost:5000/api/auth";

/**
 * Tạo Error có kèm mã HTTP để giao diện bắt lỗi dễ dàng
 */
function httpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

/**
 * Gửi token lên backend để đồng bộ Firebase user vào Neo4j (Customer)
 */
export async function syncUser(token) {
    const response = await fetch(`${API_URL}/sync`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw httpError("Lỗi đồng bộ dữ liệu với máy chủ", response.status);
    }

    return response.json();
}

export async function getCurrentCustomer(token) {
    const response = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw httpError(body.message || "Không thể lấy thông tin tài khoản", response.status);
    }

    return response.json();
}
