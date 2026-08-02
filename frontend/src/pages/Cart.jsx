import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import ErrorMessage from "../components/ErrorMessage";
import {
    formatPrice,
    setCartQuantity,
    removeFromCart,
    clearCart,
} from "../services/shopService";

function Cart() {
    const { user } = useAuth();
    const { cart, loading, setCart, refreshCart } = useCart();
    const navigate = useNavigate();

    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState(null);

    /** Bọc chung các thao tác gọi API để xử lý loading + lỗi một chỗ. */
    const runAction = async (productId, action) => {
        try {
            setBusyId(productId);
            setError(null);
            const result = await action(await user.getIdToken());
            setCart(result.data);
        } catch (err) {
            console.error(err);
            setError(err);
        } finally {
            setBusyId(null);
        }
    };

    const changeQuantity = (productId, quantity) => {
        if (quantity < 1 || quantity > 99) return;
        runAction(productId, (token) => setCartQuantity(token, productId, quantity));
    };

    const removeItem = (productId) =>
        runAction(productId, (token) => removeFromCart(token, productId));

    const emptyCart = () => {
        if (!window.confirm("Xoá toàn bộ sản phẩm trong giỏ hàng?")) return;
        runAction("__all__", (token) => clearCart(token));
    };

    if (loading && cart.items.length === 0) return <h2>Đang tải giỏ hàng...</h2>;

    if (error) {
        return <ErrorMessage error={error} onRetry={refreshCart} />;
    }

    if (cart.items.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <div style={{ fontSize: "60px" }}>🛒</div>
                <h2>Giỏ hàng đang trống</h2>
                <p style={{ color: "#666" }}>Hãy chọn vài sản phẩm bạn thích nhé.</p>
                <Link to="/">
                    <button style={primaryButton}>Xem sản phẩm</button>
                </Link>
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

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button
                                onClick={() => changeQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1 || busyId === item.id}
                                style={qtyButton}
                            >
                                −
                            </button>
                            <span style={{ minWidth: "32px", textAlign: "center", fontWeight: "bold" }}>
                                {item.quantity}
                            </span>
                            <button
                                onClick={() => changeQuantity(item.id, item.quantity + 1)}
                                disabled={item.quantity >= 99 || busyId === item.id}
                                style={qtyButton}
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
