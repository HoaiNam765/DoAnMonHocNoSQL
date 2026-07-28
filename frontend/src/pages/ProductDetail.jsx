import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import { getProductById } from "../services/productService";
import { buyProduct } from "../services/customerService";

import { useAuth } from "../context/AuthContext";
import RecommendationList from "../components/RecommendationList";
import ErrorMessage from "../components/ErrorMessage";

function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, refreshCustomer } = useAuth();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [buying, setBuying] = useState(false);

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

    const handleBuyNow = async () => {
        if (!user) {
            navigate("/login");
            return;
        }

        try {
            setBuying(true);
            const token = await user.getIdToken();
            await buyProduct(id, token);
            alert("Mua hàng thành công!");
            await refreshCustomer();
        } catch (err) {
            console.error(err);
            alert("Lỗi khi mua hàng. Vui lòng thử lại.");
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
                    
                    <button
                        onClick={handleBuyNow}
                        disabled={buying}
                        style={{
                            marginTop: "20px",
                            padding: "12px 24px",
                            background: "#4caf50",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            fontSize: "16px",
                            fontWeight: "bold",
                            cursor: "pointer",
                            width: "200px"
                        }}
                    >
                        {buying ? "Đang xử lý..." : "🛒 Mua ngay"}
                    </button>
                </div>
            </div>
            <hr style={{ margin: "40px 0" }} />

<RecommendationList productId={id} />
        </>
    );
}

export default ProductDetail;