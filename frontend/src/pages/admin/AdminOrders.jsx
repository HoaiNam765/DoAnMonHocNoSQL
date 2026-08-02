import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import ErrorMessage from "../../components/ErrorMessage";
import {
    adminGetOrders,
    adminMarkPaid,
    adminUpdateOrderStatus,
    formatPrice,
    formatDate,
    statusInfo,
} from "../../services/shopService";

/**
 * Trang quản lý đơn hàng cho nhân viên.
 *
 * Đây là nơi hoàn tất luồng thanh toán tại cửa hàng: khách đọc mã đơn, nhân
 * viên tìm đơn rồi bấm "Đã thanh toán". Ngay lúc đó backend sinh cạnh BOUGHT
 * nên gợi ý của khách cập nhật tức thì.
 */
const FILTERS = [
    { value: "PENDING", label: "Chờ thanh toán" },
    { value: "PAID", label: "Đã thanh toán" },
    { value: "COMPLETED", label: "Hoàn tất" },
    { value: "CANCELLED", label: "Đã huỷ" },
    { value: "", label: "Tất cả" },
];

function AdminOrders({ onOrderChanged }) {
    const { user } = useAuth();

    const [orders, setOrders] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [status, setStatus] = useState("PENDING");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const token = await user.getIdToken();
            const result = await adminGetOrders(token, { status, page });
            setOrders(result.data || []);
            setPagination(result.pagination);
        } catch (err) {
            console.error(err);
            setError(err);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [user, status, page, retryCount]);

    useEffect(() => {
        load();
    }, [load]);

    const handleMarkPaid = async (order) => {
        const note = window.prompt(
            `Xác nhận khách đã thanh toán ${formatPrice(order.total)} cho đơn ${order.order_id}?\n\n` +
                `Ghi chú (tuỳ chọn, ví dụ "Tiền mặt tại quầy"):`,
            "Tiền mặt tại quầy"
        );
        if (note === null) return; // bấm Cancel

        try {
            setBusyId(order.order_id);
            const token = await user.getIdToken();
            await adminMarkPaid(token, order.order_id, note);
            onOrderChanged?.();
            await load();
        } catch (err) {
            console.error(err);
            alert(err.message || "Không xác nhận được thanh toán.");
        } finally {
            setBusyId(null);
        }
    };

    const handleChangeStatus = async (order, newStatus) => {
        const label = statusInfo(newStatus).label;
        if (!window.confirm(`Chuyển đơn ${order.order_id} sang "${label}"?`)) return;

        try {
            setBusyId(order.order_id);
            const token = await user.getIdToken();
            await adminUpdateOrderStatus(token, order.order_id, newStatus);
            onOrderChanged?.();
            await load();
        } catch (err) {
            console.error(err);
            alert(err.message || "Không đổi được trạng thái.");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section className="admin-content">
            <div className="section-toolbar" style={{ marginBottom: "20px" }}>
                <div>
                    <span className="eyebrow">ORDER OPERATIONS</span>
                    <h2>Quản lý đơn hàng khách</h2>
                </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
                {FILTERS.map((f) => (
                    <button
                        key={f.value || "all"}
                        onClick={() => {
                            setStatus(f.value);
                            setPage(1);
                        }}
                        style={filterButton(status === f.value)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="empty-state">Đang tải đơn hàng...</div>
            ) : error ? (
                <div style={{ marginTop: "24px" }}>
                    <ErrorMessage error={error} onRetry={() => setRetryCount(retryCount + 1)} />
                </div>
            ) : orders.length === 0 ? (
                <div style={emptyStyle}>
                    <div style={{ fontSize: "48px" }}>📭</div>
                    <p>Không có đơn hàng nào ở trạng thái này.</p>
                </div>
            ) : (
                <div className="panel table-panel" style={{ overflowX: "auto" }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={{ background: "#f8fafc" }}>
                                <th style={th}>Mã đơn</th>
                                <th style={th}>Khách hàng</th>
                                <th style={th}>Liên hệ</th>
                                <th style={th}>Số món</th>
                                <th style={{ ...th, textAlign: "right" }}>Tổng tiền</th>
                                <th style={th}>Đặt lúc</th>
                                <th style={th}>Trạng thái</th>
                                <th style={th}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => {
                                const info = statusInfo(order.status);
                                const busy = busyId === order.order_id;

                                return (
                                    <tr key={order.order_id} style={{ opacity: busy ? 0.6 : 1 }}>
                                        <td style={td}>
                                            <Link
                                                to={`/orders/${order.order_id}`}
                                                style={{ fontFamily: "monospace", fontWeight: "bold", color: "#2563eb" }}
                                            >
                                                {order.order_id}
                                            </Link>
                                        </td>
                                        <td style={td}>{order.receiver_name}</td>
                                        <td style={td}>{order.phone}</td>
                                        <td style={td}>{order.item_count}</td>
                                        <td style={{ ...td, textAlign: "right", fontWeight: "bold", color: "#dc2626" }}>
                                            {formatPrice(order.total)}
                                        </td>
                                        <td style={{ ...td, fontSize: "13px", color: "#64748b" }}>
                                            {formatDate(order.created_at)}
                                        </td>
                                        <td style={td}>
                                            <span style={badgeStyle(info)}>{info.label}</span>
                                        </td>
                                        <td style={td}>
                                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                                {order.status === "PENDING" && (
                                                    <>
                                                        <button
                                                            onClick={() => handleMarkPaid(order)}
                                                            disabled={busy}
                                                            style={payButton}
                                                        >
                                                            ✓ Đã thanh toán
                                                        </button>
                                                        <button
                                                            onClick={() => handleChangeStatus(order, "CANCELLED")}
                                                            disabled={busy}
                                                            style={ghostButton}
                                                        >
                                                            Huỷ
                                                        </button>
                                                    </>
                                                )}
                                                {order.status === "PAID" && (
                                                    <button
                                                        onClick={() => handleChangeStatus(order, "COMPLETED")}
                                                        disabled={busy}
                                                        style={doneButton}
                                                    >
                                                        Hoàn tất
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

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
        </section>
    );
}

const filterButton = (active) => ({
    padding: "8px 18px",
    border: active ? "none" : "1px solid #ccc",
    background: active ? "#1976d2" : "white",
    color: active ? "white" : "#333",
    borderRadius: "20px",
    cursor: "pointer",
    fontWeight: active ? "bold" : "normal",
});

const tableStyle = { width: "100%", borderCollapse: "collapse", minWidth: "900px" };
const th = { padding: "12px", textAlign: "left", borderBottom: "2px solid #eee", fontSize: "14px" };
const td = { padding: "12px", borderBottom: "1px solid #f0f0f0", fontSize: "14px" };

const badgeStyle = (info) => ({
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "bold",
    color: info.color,
    background: info.bg,
    whiteSpace: "nowrap",
});

const payButton = {
    padding: "6px 14px",
    background: "#2e7d32",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
    whiteSpace: "nowrap",
};

const doneButton = { ...payButton, background: "#1565c0" };

const ghostButton = {
    padding: "6px 14px",
    background: "white",
    color: "#c62828",
    border: "1px solid #c62828",
    borderRadius: "5px",
    cursor: "pointer",
};

const emptyStyle = { textAlign: "center", padding: "60px 20px", color: "#888" };

const pagerStyle = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
    marginTop: "24px",
};

export default AdminOrders;
