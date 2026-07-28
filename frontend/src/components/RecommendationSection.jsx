import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getCustomerRecommendations } from "../services/customerService";
import { getPopularProducts } from "../services/productService";
import ProductList from "./ProductList";
import ErrorMessage from "./ErrorMessage";

function RecommendationSection() {
    const { customer } = useAuth();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isColdStart, setIsColdStart] = useState(false);

    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        async function loadRecommendations() {
            try {
                setLoading(true);
                setError(null);

                if (!customer || !customer.bought_count || customer.bought_count === 0) {
                    setIsColdStart(true);
                    const result = await getPopularProducts(8);
                    setProducts(result.data || []);
                } else {
                    setIsColdStart(false);
                    const result = await getCustomerRecommendations(customer.customer_id);
                    setProducts(result.data || []);
                }
            } catch (err) {
                console.error(err);
                setError(err);
                setProducts([]);
            } finally {
                setLoading(false);
            }
        }

        loadRecommendations();
    }, [customer, retryCount]);

    if (loading) {
        return <p>Đang tải gợi ý...</p>;
    }

    if (error) {
        return (
            <div style={{ marginBottom: "50px" }}>
                <ErrorMessage
                    error={error}
                    onRetry={() => setRetryCount(retryCount + 1)}
                />
            </div>
        );
    }

    if (products.length === 0) {
        return null;
    }

    return (
        <div style={{ marginBottom: "50px" }}>
            <h2
                style={{
                    color: isColdStart ? "#e53935" : "#1976d2",
                    marginBottom: "5px",
                }}
            >
                {isColdStart ? "🔥 Sản phẩm bán chạy" : "🎯 Gợi ý dành cho bạn"}
            </h2>

            {isColdStart ? (
                <p style={{ color: "#666", marginBottom: "20px" }}>
                    Mua sản phẩm đầu tiên để nhận gợi ý riêng cho bạn
                </p>
            ) : (
                <p style={{ color: "#666", marginBottom: "20px" }}>
                    Xin chào <strong>{customer.customer_name}</strong>
                </p>
            )}

            <ProductList products={products} />

            <hr style={{ marginTop: "40px" }} />
        </div>
    );
}

export default RecommendationSection;