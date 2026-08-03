import { useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { getAdminOrderDetail } from "../../services/adminService";
import { formatPrice, formatDate, statusInfo } from "../../services/shopService";

/**
 * Hộp thoại xem chi tiết một đơn hàng ở phía quản trị.
 *
 * Nhân viên cần thấy khách đã chọn những sản phẩm nào trước khi xác nhận đã
 * thanh toán — nếu chỉ có tổng tiền thì không đối chiếu được với hàng thực giao.
 * Dùng được cho cả đơn đang chờ lẫn đơn đã thanh toán.
 */
function OrderItemsModal({ orderId, onClose }) {
    const { user } = useAuth();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setError("");
                const token = await user.getIdToken();
                const { data } = await getAdminOrderDetail(token, orderId);
                if (!cancelled) setOrder(data);
            } catch (err) {
                console.error(err);
                if (!cancelled) setError(err.message || "Không tải được chi tiết đơn hàng.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [user, orderId]);

    // Cho phép đóng bằng phím Esc
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const info = order ? statusInfo(order.status) : null;

    return (
        <div style={overlay} onClick={onClose}>
            <div style={panel} onClick={(e) => e.stopPropagation()}>
                <div style={header}>
                    <div>
                        <span style={{ fontSize: "12px", color: "#64748b", letterSpacing: "1px" }}>
                            CHI TIẾT ĐƠN HÀNG
                        </span>
                        <h3 style={{ margin: "4px 0 0", fontFamily: "monospace" }}>{orderId}</h3>
                    </div>
                    <button onClick={onClose} style={closeButton} title="Đóng">
                        ✕
                    </button>
                </div>

                {loading ? (
                    <p style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                        Đang tải chi tiết đơn hàng...
                    </p>
                ) : error ? (
                    <p style={{ padding: "30px", textAlign: "center", color: "#dc2626" }}>{error}</p>
                ) : (
                    <>
                        <div style={metaRow}>
                            <span style={badge(info)}>{info.label}</span>
                            <span style={{ color: "#64748b", fontSize: "14px" }}>
                                Đặt lúc {formatDate(order.created_at)}
                            </span>
                            {order.paid_at && (
                                <span style={{ color: "#16a34a", fontSize: "14px" }}>
                                    Thanh toán {formatDate(order.paid_at)}
                                </span>
                            )}
                        </div>

                        {/* Sản phẩm khách đã chọn */}
                        <h4 style={sectionTitle}>Sản phẩm khách đã chọn ({order.items.length})</h4>
                        <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                            {order.items.map((item) => (
                                <div key={item.id} style={itemRow}>
                                    <img src={item.image} alt={item.title} style={thumb} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 500, fontSize: "14px" }}>{item.title}</div>
                                        <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
                                            {formatPrice(item.unit_price)} × {item.quantity}
                                        </div>
                                    </div>
                                    <strong style={{ whiteSpace: "nowrap", color: "#dc2626" }}>
                                        {formatPrice(item.line_total)}
                                    </strong>
                                </div>
                            ))}

                            <div style={{ ...itemRow, background: "#f8fafc", borderBottom: "none" }}>
                                <strong style={{ flex: 1 }}>Tổng cộng</strong>
                                <strong style={{ fontSize: "20px", color: "#dc2626" }}>
                                    {formatPrice(order.total)}
                                </strong>
                            </div>
                        </div>

                        {/* Thông tin giao hàng */}
                        <h4 style={sectionTitle}>Thông tin người nhận</h4>
                        <div style={infoBox}>
                            <Row label="Khách hàng" value={`${order.customer_name} (${order.customer_id})`} />
                            <Row label="Người nhận" value={order.receiver_name} />
                            <Row label="Điện thoại" value={order.phone} />
                            <Row label="Địa chỉ" value={order.address} />
                            {order.note && <Row label="Ghi chú" value={order.note} />}
                            {order.paid_note && <Row label="Ghi chú thanh toán" value={order.paid_note} />}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div style={{ display: "flex", gap: "12px", padding: "7px 0", flexWrap: "wrap" }}>
            <span style={{ color: "#64748b", minWidth: "140px", fontSize: "14px" }}>{label}</span>
            <span style={{ flex: 1, fontSize: "14px" }}>{value || "—"}</span>
        </div>
    );
}

const overlay = {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 1000,
};

const panel = {
    background: "white",
    borderRadius: "16px",
    padding: "24px",
    width: "100%",
    maxWidth: "640px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 25px 60px rgba(0,0,0,.25)",
};

const header = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "18px",
};

const closeButton = {
    border: "none",
    background: "#f1f5f9",
    width: "34px",
    height: "34px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "16px",
    color: "#475569",
};

const metaRow = {
    display: "flex",
    gap: "14px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "20px",
};

const badge = (info) => ({
    padding: "5px 14px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "bold",
    color: info.color,
    background: info.bg,
});

const sectionTitle = { margin: "22px 0 10px", fontSize: "15px" };

const itemRow = {
    display: "flex",
    gap: "14px",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid #f1f5f9",
};

const thumb = { width: "52px", height: "52px", objectFit: "cover", borderRadius: "6px", background: "#f8fafc" };

const infoBox = { border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px" };

export default OrderItemsModal;
