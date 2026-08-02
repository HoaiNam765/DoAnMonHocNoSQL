import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

function ProductCard({ product }) {
    const { user } = useAuth();
    const { addItem } = useCart();
    const navigate = useNavigate();

    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);

    const handleAddToCart = async () => {
        if (!user) return navigate("/login");

        try {
            setAdding(true);
            await addItem(product.id, 1);
            setAdded(true);
            setTimeout(() => setAdded(false), 1500);
        } catch (err) {
            console.error(err);
            alert(err.message || "Không thêm được vào giỏ hàng.");
        } finally {
            setAdding(false);
        }
    };

    return (
        <div
            style={{
                background: "#fff",
                borderRadius: "10px",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,.1)",
                transition: ".2s",
            }}
        >
            <img
                src={product.image}
                alt={product.title}
                style={{
                    width: "100%",
                    height: "200px",
                    objectFit: "cover",
                }}
            />

            <div style={{ padding: "15px" }}>
                <h3
                    style={{
                        fontSize: "18px",
                        height: "48px",
                        overflow: "hidden",
                    }}
                >
                    {product.title}
                </h3>

                <p
                    style={{
                        color: "#e53935",
                        fontWeight: "bold",
                        margin: "10px 0",
                    }}
                >
                    {Number(product.final_price).toLocaleString("vi-VN")} đ
                </p>

                <p
                    style={{
                        color: "#666",
                        fontSize: "14px",
                    }}
                >
                    {product.category_name}
                </p>

                <p>⭐ {product.rating}</p>

                <Link to={`/product/${product.id}`}>
                    <button
                        style={{
                            width: "100%",
                            marginTop: "10px",
                            padding: "10px",
                            border: "none",
                            borderRadius: "5px",
                            cursor: "pointer",
                            background: "#1976d2",
                            color: "white",
                        }}
                    >
                        Xem chi tiết
                    </button>
                </Link>

                <button
                    onClick={handleAddToCart}
                    disabled={adding}
                    style={{
                        width: "100%",
                        marginTop: "8px",
                        padding: "10px",
                        border: "1px solid #2e7d32",
                        borderRadius: "5px",
                        cursor: adding ? "default" : "pointer",
                        background: added ? "#2e7d32" : "white",
                        color: added ? "white" : "#2e7d32",
                        fontWeight: "bold",
                        transition: "background .2s, color .2s",
                    }}
                >
                    {added ? "✓ Đã thêm" : adding ? "Đang thêm..." : "🛒 Thêm vào giỏ"}
                </button>
            </div>
        </div>
    );
}

export default ProductCard;