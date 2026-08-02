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
        <div className="product-card">
            <img className="product-card__image" src={product.image} alt={product.title} />

            <div className="product-card__body">
                <h3 className="product-card__title" title={product.title}>
                    {product.title}
                </h3>

                <div className="product-card__price">
                    {Number(product.final_price).toLocaleString("vi-VN")} đ
                </div>

                <div className="product-card__meta">
                    {product.category_name || "Danh mục"}
                </div>

                <div className="product-card__rating">★ {Number(product.rating || 0).toFixed(1)}</div>

                <div className="product-card__actions">
                    <Link to={`/product/${product.id}`}>
                        <button className="product-card__button">Xem chi tiết</button>
                    </Link>

                    <button
                        className={`product-card__button--secondary ${added ? "is-added" : ""}`}
                        onClick={handleAddToCart}
                        disabled={adding}
                    >
                        {added ? "✓ Đã thêm" : adding ? "Đang thêm..." : "🛒 Thêm vào giỏ"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProductCard;