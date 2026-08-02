import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { createOrder, getMyProfile, formatPrice } from "../services/shopService";

/**
 * Trang đặt hàng: nhập thông tin người nhận rồi tạo đơn.
 *
 * Không có bước thanh toán online — đơn tạo ra ở trạng thái "Chờ thanh toán",
 * khách cầm mã đơn tới cửa hàng trả tiền, nhân viên xác nhận trên trang quản trị.
 */
function Checkout() {
    const { user, customer } = useAuth();
    const { cart, refreshCart } = useCart();
    const navigate = useNavigate();

    const [form, setForm] = useState({ receiverName: "", phone: "", address: "", note: "" });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Đặt hàng xong thì backend dọn sạch giỏ. Nếu không có cờ này, effect
    // "giỏ rỗng → quay về /cart" bên dưới sẽ chạy đè lên lệnh chuyển sang
    // trang chi tiết đơn, khiến khách đặt hàng xong lại thấy giỏ hàng trống.
    const [placed, setPlaced] = useState(false);

    // Điền sẵn từ hồ sơ để khách không phải gõ lại mỗi lần đặt hàng
    useEffect(() => {
        let cancelled = false;

        async function prefill() {
            try {
                const token = await user.getIdToken();
                const { data } = await getMyProfile(token);
                if (cancelled) return;
                setForm((f) => ({
                    ...f,
                    receiverName: data.customer_name || customer?.customer_name || "",
                    phone: data.phone || "",
                    address: data.address || "",
                }));
            } catch (err) {
                console.error("[Checkout] Không tải được hồ sơ:", err);
            }
        }

        if (user) prefill();
        return () => {
            cancelled = true;
        };
    }, [user, customer]);

    // Giỏ rỗng thì không có gì để đặt — trừ khi vừa đặt hàng xong
    useEffect(() => {
        if (!placed && cart.items.length === 0) navigate("/cart", { replace: true });
    }, [cart.items.length, navigate, placed]);

    const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.receiverName.trim()) return setError("Vui lòng nhập tên người nhận.");
        if (!/^0\d{8,10}$/.test(form.phone.trim())) {
            return setError("Số điện thoại không hợp lệ (bắt đầu bằng 0, 9–11 chữ số).");
        }
        if (!form.address.trim()) return setError("Vui lòng nhập địa chỉ.");

        try {
            setSubmitting(true);
            setError("");

            const token = await user.getIdToken();
            const { data } = await createOrder(token, form);

            setPlaced(true); // chặn effect "giỏ rỗng → /cart" trước khi dọn giỏ
            await refreshCart(); // backend đã xoá giỏ, đồng bộ lại badge trên Header
            navigate(`/orders/${data.order_id}`, { replace: true });
        } catch (err) {
            console.error(err);
            setError(err.message || "Đặt hàng thất bại, vui lòng thử lại.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <h1>Đặt hàng</h1>

            <div style={{ display: "flex", gap: "30px", marginTop: "20px", flexWrap: "wrap" }}>
                {/* Thông tin người nhận */}
                <form onSubmit={handleSubmit} style={{ flex: "1 1 360px" }}>
                    <h3 style={{ marginBottom: "16px" }}>Thông tin người nhận</h3>

                    {error && <p style={errorStyle}>{error}</p>}

                    <label style={labelStyle}>Họ tên người nhận *</label>
                    <input value={form.receiverName} onChange={update("receiverName")} style={inputStyle} />

                    <label style={labelStyle}>Số điện thoại *</label>
                    <input
                        value={form.phone}
                        onChange={update("phone")}
                        placeholder="0901234567"
                        style={inputStyle}
                    />

                    <label style={labelStyle}>Địa chỉ *</label>
                    <textarea
                        value={form.address}
                        onChange={update("address")}
                        rows={3}
                        style={{ ...inputStyle, resize: "vertical" }}
                    />

                    <label style={labelStyle}>Ghi chú</label>
                    <textarea
                        value={form.note}
                        onChange={update("note")}
                        rows={2}
                        placeholder="Ví dụ: giao giờ hành chính"
                        style={{ ...inputStyle, resize: "vertical" }}
                    />

                    <div style={noticeStyle}>
                        <strong>💵 Thanh toán tại cửa hàng</strong>
                        <p style={{ margin: "8px 0 0", color: "#666", fontSize: "14px" }}>
                            Sau khi đặt, bạn sẽ nhận được <strong>mã đơn hàng</strong>. Mang mã này tới
                            cửa hàng để thanh toán. Nhân viên xác nhận xong, đơn sẽ chuyển sang trạng
                            thái <strong>Đã thanh toán</strong>.
                        </p>
                    </div>

                    <button type="submit" disabled={submitting} style={submitButton(submitting)}>
                        {submitting ? "Đang tạo đơn..." : "Xác nhận đặt hàng"}
                    </button>
                </form>

                {/* Tóm tắt đơn */}
                <div style={{ flex: "1 1 320px" }}>
                    <h3 style={{ marginBottom: "16px" }}>Đơn hàng của bạn</h3>

                    <div style={{ border: "1px solid #eee", borderRadius: "10px", padding: "16px" }}>
                        {cart.items.map((item) => (
                            <div key={item.id} style={summaryRow}>
                                <img src={item.image} alt={item.title} style={summaryThumb} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: "14px" }}>{item.title}</div>
                                    <div style={{ color: "#888", fontSize: "13px" }}>
                                        {formatPrice(item.final_price)} × {item.quantity}
                                    </div>
                                </div>
                                <strong style={{ fontSize: "14px", whiteSpace: "nowrap" }}>
                                    {formatPrice(item.line_total)}
                                </strong>
                            </div>
                        ))}

                        <div style={totalRow}>
                            <span>Tổng cộng</span>
                            <strong style={{ fontSize: "22px", color: "#e53935" }}>
                                {formatPrice(cart.total)}
                            </strong>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

const labelStyle = { display: "block", marginTop: "14px", marginBottom: "6px", fontWeight: 500 };

const inputStyle = {
    width: "100%",
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    fontSize: "15px",
    fontFamily: "inherit",
    boxSizing: "border-box",
};

const errorStyle = {
    color: "#c62828",
    background: "#ffebee",
    padding: "10px 14px",
    borderRadius: "6px",
    margin: "0 0 12px",
};

const noticeStyle = {
    marginTop: "20px",
    padding: "16px",
    background: "#e8f5e9",
    border: "1px solid #c8e6c9",
    borderRadius: "8px",
};

const submitButton = (busy) => ({
    width: "100%",
    marginTop: "20px",
    padding: "14px",
    background: busy ? "#90caf9" : "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: busy ? "default" : "pointer",
    fontWeight: "bold",
    fontSize: "16px",
});

const summaryRow = {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    paddingBottom: "12px",
    marginBottom: "12px",
    borderBottom: "1px solid #f0f0f0",
};

const summaryThumb = { width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px" };

const totalRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "8px",
};

export default Checkout;
