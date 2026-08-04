import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import ErrorMessage from "../components/ErrorMessage";
import {
    getOrderDetail,
    cancelOrder,
    confirmOrderPaid,
    formatPrice,
    formatDate,
    statusInfo,
} from "../services/shopService";

/**
 * Chi tiết đơn hàng.
 *
 * Với đơn đang chờ thanh toán, mã đơn được hiển thị thật to — đây là thứ khách
 * đọc cho nhân viên khi tới cửa hàng trả tiền.
 */
function OrderDetail() {
    const { orderId } = useParams();
    const { user } = useAuth();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const token = await user.getIdToken();
            const { data } = await getOrderDetail(token, orderId);
            setOrder(data);
        } catch (err) {
            console.error(err);
            setOrder(null);
            setError(err.status === 404 ? null : err);
        } finally {
            setLoading(false);
        }
    }, [user, orderId, retryCount]);

    useEffect(() => {
        load();
    }, [load]);

    const handleCancel = async () => {
        if (!window.confirm("Bạn chắc chắn muốn huỷ đơn này?")) return;
        try {
            setCancelling(true);
            const token = await user.getIdToken();
            await cancelOrder(token, orderId);
            await load();
        } catch (err) {
            console.error(err);
            alert(err.message || "Không huỷ được đơn.");
        } finally {
            setCancelling(false);
        }
    };

    const handleConfirmPaid = async () => {
        if (!window.confirm("Xác nhận bạn đã thanh toán đơn này bằng ZaloPay?")) return;
        try {
            setConfirming(true);
            const token = await user.getIdToken();
            await confirmOrderPaid(token, orderId);
            await load();
        } catch (err) {
            console.error(err);
            alert(err.message || "Không xác nhận được thanh toán.");
        } finally {
            setConfirming(false);
        }
    };

    if (loading) return <h2>Đang tải đơn hàng...</h2>;
    if (error) return <ErrorMessage error={error} onRetry={() => setRetryCount(retryCount + 1)} />;
    if (!order) return <h2>Không tìm thấy đơn hàng.</h2>;

    const info = statusInfo(order.status);
    const isPending = order.status === "PENDING";

    return (
        <>
            <Link to="/orders" style={{ color: "#1976d2", textDecoration: "none", fontWeight: "bold" }}>
                ← Danh sách đơn hàng
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "20px", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontFamily: "monospace" }}>{order.order_id}</h1>
                <span style={badgeStyle(info)}>{info.label}</span>
            </div>

            <p style={{ color: "#888", marginTop: "8px" }}>
                Đặt lúc {formatDate(order.created_at)}
                {order.paid_at && ` · Đã thanh toán ${formatDate(order.paid_at)}`}
            </p>

            {/* Hướng dẫn thanh toán — chỉ hiện khi đơn còn chờ */}
            {isPending && (
                <div style={payBoxStyle}>
                    <div style={{ fontSize: "36px" }}>💵</div>
                    <div style={{ flex: 1, minWidth: "260px" }}>
                        <h3 style={{ margin: "0 0 8px", color: "#e65100" }}>Chờ thanh toán tại cửa hàng</h3>
                        <p style={{ margin: 0, color: "#666" }}>
                            Mang mã đơn dưới đây tới cửa hàng và đọc cho nhân viên để thanh toán.
                        </p>
                        <div style={codeStyle}>{order.order_id}</div>
                        <p style={{ margin: "12px 0 0", color: "#666", fontSize: "14px" }}>
                            Số tiền cần thanh toán:{" "}
                            <strong style={{ color: "#e53935", fontSize: "18px" }}>
                                {formatPrice(order.total)}
                            </strong>
                        </p>
                    </div>
                </div>
            )}

            {/* Danh sách sản phẩm */}
            <h3 style={{ marginTop: "30px" }}>Sản phẩm</h3>
            <div style={{ border: "1px solid #eee", borderRadius: "10px", overflow: "hidden" }}>
                {order.items.map((item) => (
                    <div key={item.id} style={itemRow}>
                        <img src={item.image} alt={item.title} style={thumbStyle} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Link
                                to={`/product/${item.id}`}
                                style={{ color: "#1976d2", textDecoration: "none" }}
                            >
                                {item.title}
                            </Link>
                            <p style={{ color: "#888", fontSize: "14px", margin: "6px 0 0" }}>
                                {formatPrice(item.unit_price)} × {item.quantity}
                            </p>
                        </div>
                        <strong style={{ whiteSpace: "nowrap" }}>{formatPrice(item.line_total)}</strong>
                    </div>
                ))}

                <div style={{ ...itemRow, background: "#fafafa", borderBottom: "none" }}>
                    <div style={{ flex: 1 }}>
                        <strong>Tổng cộng</strong>
                    </div>
                    <strong style={{ fontSize: "22px", color: "#e53935" }}>
                        {formatPrice(order.total)}
                    </strong>
                </div>
            </div>

            {/* Thông tin giao hàng */}
            <h3 style={{ marginTop: "30px" }}>Thông tin người nhận</h3>
            <div style={infoBox}>
                <Row label="Họ tên" value={order.receiver_name} />
                <Row label="Điện thoại" value={order.phone} />
                <Row label="Địa chỉ" value={order.address} />
                {order.note && <Row label="Ghi chú" value={order.note} />}
                {order.paid_note && <Row label="Ghi chú thanh toán" value={order.paid_note} />}
            </div>

            {isPending && (
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "24px" }}>
                    {order.payment_method === "ZALOPAY" && (
                        <button onClick={handleConfirmPaid} disabled={confirming} style={confirmButton}>
                            {confirming ? "Đang xác nhận..." : "✅ Xác nhận đã thanh toán"}
                        </button>
                    )}
                    <button onClick={handleCancel} disabled={cancelling} style={cancelButton}>
                        {cancelling ? "Đang huỷ..." : "Huỷ đơn hàng"}
                    </button>
                </div>
            )}
        </>
    );
}

function Row({ label, value }) {
    return (
        <div style={{ display: "flex", gap: "12px", padding: "8px 0" }}>
            <span style={{ color: "#888", minWidth: "150px" }}>{label}</span>
            <span style={{ flex: 1 }}>{value || "—"}</span>
        </div>
    );
}

const badgeStyle = (info) => ({
    padding: "6px 16px",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: "bold",
    color: info.color,
    background: info.bg,
});

const payBoxStyle = {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
    marginTop: "24px",
    padding: "24px",
    background: "#fff8e1",
    border: "2px solid #ffe082",
    borderRadius: "12px",
    flexWrap: "wrap",
};

const codeStyle = {
    marginTop: "14px",
    padding: "14px 20px",
    background: "white",
    border: "2px dashed #ff9800",
    borderRadius: "8px",
    fontFamily: "monospace",
    fontSize: "30px",
    fontWeight: "bold",
    letterSpacing: "3px",
    textAlign: "center",
    color: "#e65100",
};

const itemRow = {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    padding: "16px",
    borderBottom: "1px solid #f0f0f0",
};

const thumbStyle = { width: "64px", height: "64px", objectFit: "cover", borderRadius: "6px" };

const infoBox = { border: "1px solid #eee", borderRadius: "10px", padding: "16px" };

const cancelButton = {
    padding: "12px 24px",
    background: "white",
    color: "#c62828",
    border: "1px solid #c62828",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
};

const confirmButton = {
    padding: "12px 24px",
    background: "#2e7d32",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
};

export default OrderDetail;
