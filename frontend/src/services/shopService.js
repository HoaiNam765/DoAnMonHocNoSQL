import { apiUrl } from "../config/api";

const API = apiUrl();

/**
 * Gọi API cần đăng nhập. Mọi endpoint giỏ hàng / đơn hàng / hồ sơ đều lấy
 * customer_id từ token phía backend, nên frontend chỉ cần gửi token.
 */
async function authFetch(path, token, options = {}) {
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });

    let body = null;
    try {
        body = await response.json();
    } catch {
        /* một số phản hồi không có body */
    }

    if (!response.ok) {
        const error = new Error(body?.message || "Có lỗi xảy ra, vui lòng thử lại.");
        error.status = response.status;
        throw error;
    }

    return body;
}

// ---------------------------------------------------------------------------
// Giỏ hàng
// ---------------------------------------------------------------------------

export const getCart = (token) => authFetch("/cart", token);

export const getCartCount = (token) => authFetch("/cart/count", token);

export const addToCart = (token, productId, quantity = 1) =>
    authFetch("/cart/items", token, {
        method: "POST",
        body: JSON.stringify({ productId, quantity }),
    });

export const setCartQuantity = (token, productId, quantity) =>
    authFetch(`/cart/items/${productId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
    });

export const removeFromCart = (token, productId) =>
    authFetch(`/cart/items/${productId}`, token, { method: "DELETE" });

export const clearCart = (token) => authFetch("/cart", token, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Đơn hàng
// ---------------------------------------------------------------------------

export const createOrder = (token, info) =>
    authFetch("/orders", token, {
        method: "POST",
        body: JSON.stringify(info),
    });

export const getMyOrders = (token, page = 1, limit = 10) =>
    authFetch(`/orders?page=${page}&limit=${limit}`, token);

export const getOrderDetail = (token, orderId) => authFetch(`/orders/${orderId}`, token);

export const cancelOrder = (token, orderId) =>
    authFetch(`/orders/${orderId}/cancel`, token, { method: "POST" });

// ---------------------------------------------------------------------------
// Hồ sơ khách hàng
// ---------------------------------------------------------------------------

export const getMyProfile = (token) => authFetch("/customers/me/profile", token);

export const updateMyProfile = (token, data) =>
    authFetch("/customers/me/profile", token, {
        method: "PATCH",
        body: JSON.stringify(data),
    });

// ---------------------------------------------------------------------------
// Admin — quản lý đơn hàng
// ---------------------------------------------------------------------------

export const adminGetOrders = (token, { status = "", page = 1, limit = 20 } = {}) =>
    authFetch(`/admin/orders?status=${status}&page=${page}&limit=${limit}`, token);

export const adminMarkPaid = (token, orderId, note = "") =>
    authFetch(`/admin/orders/${orderId}/mark-paid`, token, {
        method: "POST",
        body: JSON.stringify({ note }),
    });

export const adminUpdateOrderStatus = (token, orderId, status) =>
    authFetch(`/admin/orders/${orderId}/status`, token, {
        method: "PUT",
        body: JSON.stringify({ status }),
    });

// ---------------------------------------------------------------------------
// Dùng chung
// ---------------------------------------------------------------------------

/** Định dạng tiền Việt: 669000 -> "669.000 đ" */
export const formatPrice = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

/** Nhãn + màu cho từng trạng thái đơn hàng. */
export const ORDER_STATUS = {
    PENDING: { label: "Chờ thanh toán", color: "#f57c00", bg: "#fff3e0" },
    PAID: { label: "Đã thanh toán", color: "#2e7d32", bg: "#e8f5e9" },
    COMPLETED: { label: "Hoàn tất", color: "#1565c0", bg: "#e3f2fd" },
    CANCELLED: { label: "Đã huỷ", color: "#c62828", bg: "#ffebee" },
};

export const statusInfo = (status) =>
    ORDER_STATUS[status] || { label: status, color: "#616161", bg: "#f5f5f5" };

/** Hiện ngày giờ theo định dạng Việt Nam. */
export const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("vi-VN");
};
