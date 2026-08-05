import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import ErrorMessage from "../components/ErrorMessage";
import { getMyOrders, formatPrice, formatDate, statusInfo } from "../services/shopService";
import { useOrderEvents } from "../hooks/useOrderEvents";

/** Trang "Đơn hàng của tôi" — danh sách đơn đã đặt, mới nhất lên đầu. */
function Orders() {
    const { user } = useAuth();

    const [orders, setOrders] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const token = await user.getIdToken();
            const result = await getMyOrders(token, page);
            setOrders(result.data || []);
            setPagination(result.pagination);
        } catch (err) {
            console.error(err);
            setError(err);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [user, page, retryCount]);

    useEffect(() => {
        load();
    }, [load]);

    // Nhân viên xác nhận thanh toán thì trạng thái ở đây đổi ngay, khỏi F5
    useOrderEvents({ user, onChange: load });

    if (loading) return <h2>Đang tải đơn hàng...</h2>;

    if (error) {
        return <ErrorMessage error={error} onRetry={() => setRetryCount(retryCount + 1)} />;
    }

    if (orders.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <div style={{ fontSize: "60px" }}>📦</div>
                <h2>Bạn chưa có đơn hàng nào</h2>
                <Link to="/">
                    <button style={primaryButton}>Bắt đầu mua sắm</button>
                </Link>
            </div>
        );
    }

    return (
        <>
            <h1>Đơn hàng của tôi</h1>

            <div style={{ marginTop: "20px" }}>
                {orders.map((order) => {
                    const info = statusInfo(order.status);

                    return (
                        <Link
                            key={order.order_id}
                            to={`/orders/${order.order_id}`}
                            style={{ textDecoration: "none", color: "inherit" }}
                        >
                            <div style={cardStyle}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                        <strong style={{ fontFamily: "monospace", fontSize: "16px" }}>
                                            {order.order_id}
                                        </strong>
                                        <span style={badgeStyle(info)}>{info.label}</span>
                                    </div>

                                    <p style={{ color: "#888", fontSize: "14px", margin: "8px 0 0" }}>
                                        Đặt lúc {formatDate(order.created_at)}
                                        {order.paid_at && ` · Thanh toán ${formatDate(order.paid_at)}`}
                                    </p>

                                    <p style={{ color: "#666", fontSize: "14px", margin: "4px 0 0" }}>
                                        {order.item_count} sản phẩm · {order.total_quantity} món
                                    </p>
                                </div>

                                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                    <strong style={{ fontSize: "20px", color: "#e53935" }}>
                                        {formatPrice(order.total)}
                                    </strong>
                                    <div style={{ color: "#1976d2", fontSize: "14px", marginTop: "6px" }}>
                                        Xem chi tiết →
                                    </div>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {pagination && pagination.totalPages > 1 && (
                <div style={pagerStyle}>
                    <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        ◀ Trước
                    </button>
                    <span>
                        Trang {pagination.page} / {pagination.totalPages}
                    </span>
                    <button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
                        Sau ▶
                    </button>
                </div>
            )}
        </>
    );
}

const cardStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "18px",
    border: "1px solid #eee",
    borderRadius: "10px",
    marginBottom: "14px",
    background: "white",
    flexWrap: "wrap",
};

const badgeStyle = (info) => ({
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "bold",
    color: info.color,
    background: info.bg,
});

const primaryButton = {
    marginTop: "16px",
    padding: "12px 28px",
    background: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
};

const pagerStyle = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
    marginTop: "24px",
};

export default Orders;
