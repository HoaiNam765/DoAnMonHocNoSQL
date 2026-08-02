import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import { getProductById } from "../services/productService";

import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import RecommendationList from "../components/RecommendationList";
import ErrorMessage from "../components/ErrorMessage";

function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addItem } = useCart();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [buying, setBuying] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [added, setAdded] = useState(false);

    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        async function loadProduct() {
            try {
                setLoading(true);
                setError(null);

                let token = null;
                if (user) {
                    token = await user.getIdToken();
                }

                const result = await getProductById(id, token);
                setProduct(result.data);
            } catch (err) {
                console.error(err);
                setProduct(null);

                // 404 nghĩa là sản phẩm không tồn tại — đó không phải sự cố hệ
                // thống nên vẫn hiện thông báo cũ. Các lỗi còn lại (mất kết nối,
                // 500) mới hiện hộp lỗi kèm nút thử lại.
                setError(err.status === 404 ? null : err);
            } finally {
                setLoading(false);
            }
        }

        loadProduct();
    }, [id, user, retryCount]);

    /**
     * Thêm vào giỏ. `goToCheckout = true` là nút "Mua ngay" — thêm xong đi
     * thẳng sang trang đặt hàng, không tạo BOUGHT ngay như trước nữa.
     * BOUGHT chỉ sinh ra khi nhân viên xác nhận khách đã thanh toán.
     */
    const handleAddToCart = async (goToCheckout = false) => {
        if (!user) return navigate("/login");

        try {
            setBuying(true);
            await addItem(id, quantity);

            if (goToCheckout) {
                navigate("/checkout");
            } else {
                setAdded(true);
                setTimeout(() => setAdded(false), 1800);
            }
        } catch (err) {
            console.error(err);
            alert(err.message || "Không thêm được vào giỏ hàng.");
        } finally {
            setBuying(false);
        }
    };

    if (loading) {
        return <h2>Đang tải...</h2>;
    }

    if (error) {
        return (
            <ErrorMessage
                error={error}
                onRetry={() => setRetryCount(retryCount + 1)}
            />
        );
    }

    if (!product) {
        return <h2>Không tìm thấy sản phẩm.</h2>;
    }

    return (
        <>
            <Link
                to="/"
                style={{
                    textDecoration: "none",
                    color: "#1976d2",
                    fontWeight: "bold",
                }}
            >
                ← Quay lại
            </Link>

            <div
                style={{
                    display: "flex",
                    gap: "40px",
                    marginTop: "30px",
                    alignItems: "flex-start",
                }}
            >
                <img
                    src={product.image}
                    alt={product.title}
                    style={{
                        width: "350px",
                        borderRadius: "10px",
                        background: "#fafafa",
                    }}
                />

                <div>
                    <h1>{product.title}</h1>

                    <h2
                        style={{
                            color: "#e53935",
                        }}
                    >
                        {Number(product.final_price).toLocaleString("vi-VN")} đ
                    </h2>

                    <p>
                        <strong>Danh mục:</strong> {product.category_name}
                    </p>

                    <p>
                        <strong>Đánh giá:</strong> ⭐ {product.rating}
                    </p>

                    {/* Chọn số lượng */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "24px" }}>
                        <span style={{ fontWeight: 500 }}>Số lượng</span>
                        <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            disabled={quantity <= 1}
                            style={qtyButton}
                        >
                            −
                        </button>
                        <span style={{ minWidth: "36px", textAlign: "center", fontWeight: "bold", fontSize: "18px" }}>
                            {quantity}
                        </span>
                        <button
                            onClick={() => setQuantity(Math.min(99, quantity + 1))}
                            disabled={quantity >= 99}
                            style={qtyButton}
                        >
                            +
                        </button>
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
                        <button
                            onClick={() => handleAddToCart(false)}
                            disabled={buying}
                            style={{
                                padding: "12px 24px",
                                background: added ? "#2e7d32" : "white",
                                color: added ? "white" : "#2e7d32",
                                border: "2px solid #2e7d32",
                                borderRadius: "6px",
                                fontSize: "16px",
                                fontWeight: "bold",
                                cursor: buying ? "default" : "pointer",
                                transition: "background .2s, color .2s",
                            }}
                        >
                            {added ? "✓ Đã thêm vào giỏ" : "🛒 Thêm vào giỏ"}
                        </button>

                        <button
                            onClick={() => handleAddToCart(true)}
                            disabled={buying}
                            style={{
                                padding: "12px 32px",
                                background: "#e53935",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "16px",
                                fontWeight: "bold",
                                cursor: buying ? "default" : "pointer",
                            }}
                        >
                            {buying ? "Đang xử lý..." : "Mua ngay"}
                        </button>
                    </div>
                </div>
            </div>
            <hr style={{ margin: "40px 0" }} />

            <RecommendationList productId={id} />
        </>
    );
}

const qtyButton = {
    width: "36px",
    height: "36px",
    border: "1px solid #ccc",
    background: "white",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "20px",
};

export default ProductDetail;