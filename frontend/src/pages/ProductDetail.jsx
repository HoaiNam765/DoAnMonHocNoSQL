import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getProductById } from "../services/productService";

import { CustomerContext } from "../context/CustomerContext";
import RecommendationList from "../components/RecommendationList";

function ProductDetail() {
    const { id } = useParams();
    const { customerId } = useContext(CustomerContext);

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProduct() {
            try {
                const result = await getProductById(id, customerId);
                setProduct(result.data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }

        loadProduct();
    }, [id, customerId]);

    if (loading) {
        return <h2>Đang tải...</h2>;
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
                </div>
            </div>
            <hr style={{ margin: "40px 0" }} />

<RecommendationList productId={id} />
        </>
    );
}

export default ProductDetail;