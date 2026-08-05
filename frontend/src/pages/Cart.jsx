import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import AlertDialog from "../components/AlertDialog";
import {
    formatPrice,
    setCartQuantity,
    removeFromCart,
    clearCart,
} from "../services/shopService";

const SL_TOI_DA = 99;

function Cart() {
    const { user } = useAuth();
    const { cart, loading, setCart } = useCart();
    const navigate = useNavigate();

    const [busyId, setBusyId] = useState(null);

    // Lỗi thao tác (hết hàng, mất mạng...) hiện bằng hộp thoại, KHÔNG thay thế
    // cả trang. Trước đây chỉ cần bấm nhầm dấu cộng quá tồn kho là mất luôn cả
    // giỏ hàng trước mắt, phải bấm "Thử lại" mới thấy lại — rất khó chịu.
    const [thongBao, setThongBao] = useState(null);

    // Số lượng khách đang gõ dở, tách khỏi số lượng thật trong giỏ.
    // Không tách thì mỗi ký tự gõ vào lại bắn một lượt gọi API: gõ "10" sẽ thành
    // đặt 1 rồi mới đặt 10.
    const [nhapSl, setNhapSl] = useState({});

    const boNhapTam = (productId) =>
        setNhapSl((truoc) => {
            const sau = { ...truoc };
            delete sau[productId];
            return sau;
        });

    /** Bọc chung các thao tác gọi API để xử lý loading + lỗi một chỗ. */
    const runAction = async (productId, action) => {
        try {
            setBusyId(productId);
            const result = await action(await user.getIdToken());
            setCart(result.data);
            boNhapTam(productId);
            return true;
        } catch (err) {
            console.error(err);
            setThongBao(err.message || "Thao tác không thành công, bạn thử lại nhé.");
            // Trả ô nhập về đúng số lượng đang có trong giỏ, vì phía máy chủ
            // không có gì thay đổi khi thao tác bị từ chối.
            boNhapTam(productId);
            return false;
        } finally {
            setBusyId(null);
        }
    };

    const changeQuantity = (productId, quantity) => {
        if (quantity < 1 || quantity > SL_TOI_DA) return;
        runAction(productId, (token) => setCartQuantity(token, productId, quantity));
    };

    /** Chốt giá trị khách gõ trong ô số lượng (khi rời ô hoặc bấm Enter). */
    const chotSoLuongNhap = (item) => {
        const raw = nhapSl[item.id];
        if (raw === undefined) return; // không sửa gì

        const sl = Number(raw);

        if (!Number.isInteger(sl) || sl < 1 || sl > SL_TOI_DA) {
            setThongBao(`Số lượng phải là số nguyên từ 1 đến ${SL_TOI_DA}.`);
            boNhapTam(item.id);
            return;
        }

        if (sl === item.quantity) {
            boNhapTam(item.id);
            return;
        }

        changeQuantity(item.id, sl);
    };

    const removeItem = (productId) =>
        runAction(productId, (token) => removeFromCart(token, productId));

    const emptyCart = () => {
        if (!window.confirm("Xoá toàn bộ sản phẩm trong giỏ hàng?")) return;
        runAction("__all__", (token) => clearCart(token));
    };

    // Hộp thoại phải nằm ngoài mọi nhánh return sớm, không thì giỏ vừa trống đi
    // là thông báo biến mất theo, khách không kịp đọc vì sao thao tác hỏng.
    const hopThoai = (
        <AlertDialog
            open={Boolean(thongBao)}
            message={thongBao}
            onClose={() => setThongBao(null)}
        />
    );

    if (loading && cart.items.length === 0) return <h2>Đang tải giỏ hàng...</h2>;

    if (cart.items.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <div style={{ fontSize: "60px" }}>🛒</div>
                <h2>Giỏ hàng đang trống</h2>
                <p style={{ color: "#666" }}>Hãy chọn vài sản phẩm bạn thích nhé.</p>
                <Link to="/">
                    <button style={primaryButton}>Xem sản phẩm</button>
                </Link>
                {hopThoai}
            </div>
        );
    }

    return (
        <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Giỏ hàng ({cart.item_count} sản phẩm)</h1>
                <button onClick={emptyCart} style={linkButton}>
                    Xoá tất cả
                </button>
            </div>

            <div style={{ marginTop: "20px" }}>
                {cart.items.map((item) => (
                    <div key={item.id} style={rowStyle(busyId === item.id)}>
                        <img src={item.image} alt={item.title} style={thumbStyle} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <Link
                                to={`/product/${item.id}`}
                                style={{ color: "#1976d2", textDecoration: "none", fontWeight: 500 }}
                            >
                                {item.title}
                            </Link>
                            <p style={{ color: "#888", fontSize: "13px", margin: "6px 0 0" }}>
                                {item.category_name}
                            </p>
                            <p style={{ color: "#e53935", fontWeight: "bold", margin: "6px 0 0" }}>
                                {formatPrice(item.final_price)}
                            </p>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                                onClick={() => changeQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1 || busyId === item.id}
                                style={qtyButton}
                                title="Giảm 1"
                            >
                                −
                            </button>

                            {/* Gõ trực tiếp số lượng. Chỉ gửi lên máy chủ khi rời ô
                                hoặc bấm Enter, không gửi theo từng ký tự. */}
                            <input
                                type="number"
                                min="1"
                                max={SL_TOI_DA}
                                value={nhapSl[item.id] ?? String(item.quantity)}
                                disabled={busyId === item.id}
                                onChange={(e) =>
                                    setNhapSl((truoc) => ({ ...truoc, [item.id]: e.target.value }))
                                }
                                onBlur={() => chotSoLuongNhap(item)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") e.currentTarget.blur();
                                    if (e.key === "Escape") boNhapTam(item.id);
                                }}
                                style={qtyInput}
                                aria-label={`Số lượng ${item.title}`}
                            />

                            <button
                                onClick={() => changeQuantity(item.id, item.quantity + 1)}
                                disabled={item.quantity >= SL_TOI_DA || busyId === item.id}
                                style={qtyButton}
                                title="Tăng 1"
                            >
                                +
                            </button>
                        </div>

                        <div style={{ minWidth: "130px", textAlign: "right" }}>
                            <strong style={{ color: "#e53935" }}>{formatPrice(item.line_total)}</strong>
                        </div>

                        <button
                            onClick={() => removeItem(item.id)}
                            disabled={busyId === item.id}
                            title="Xoá khỏi giỏ"
                            style={removeButton}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            <div style={summaryStyle}>
                <div>
                    <span style={{ color: "#666" }}>Tổng cộng </span>
                    <strong style={{ fontSize: "26px", color: "#e53935", marginLeft: "8px" }}>
                        {formatPrice(cart.total)}
                    </strong>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                    <Link to="/">
                        <button style={secondaryButton}>Mua thêm</button>
                    </Link>
                    <button onClick={() => navigate("/checkout")} style={primaryButton}>
                        Đặt hàng →
                    </button>
                </div>
            </div>

            {hopThoai}
        </>
    );
}

// --- style dùng lại ---
const rowStyle = (busy) => ({
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    borderBottom: "1px solid #eee",
    opacity: busy ? 0.5 : 1,
    transition: "opacity .15s",
});

const thumbStyle = {
    width: "80px",
    height: "80px",
    objectFit: "cover",
    borderRadius: "8px",
    background: "#fafafa",
};

const qtyButton = {
    width: "32px",
    height: "32px",
    border: "1px solid #ccc",
    background: "white",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "18px",
};

const qtyInput = {
    width: "58px",
    height: "32px",
    textAlign: "center",
    fontWeight: "bold",
    border: "1px solid #ccc",
    borderRadius: "6px",
    fontSize: "15px",
    padding: "0 4px",
    boxSizing: "border-box",
};

const removeButton = {
    border: "none",
    background: "transparent",
    color: "#999",
    cursor: "pointer",
    fontSize: "18px",
    padding: "8px",
};

const summaryStyle = {
    marginTop: "30px",
    padding: "20px",
    background: "#fafafa",
    borderRadius: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
};

const primaryButton = {
    padding: "12px 28px",
    background: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: "15px",
};

const secondaryButton = {
    padding: "12px 24px",
    background: "white",
    color: "#1976d2",
    border: "1px solid #1976d2",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
};

const linkButton = {
    border: "none",
    background: "transparent",
    color: "#c62828",
    cursor: "pointer",
    textDecoration: "underline",
};

export default Cart;
