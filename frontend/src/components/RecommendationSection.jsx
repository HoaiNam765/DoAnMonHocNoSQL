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
        return <p className="section-subtitle">Đang tải gợi ý...</p>;
    }

    if (error) {
        return (
            <div className="recommend-section">
                <ErrorMessage error={error} onRetry={() => setRetryCount(retryCount + 1)} />
            </div>
        );
    }

    if (products.length === 0) {
        return null;
    }

    return (
        <section className="recommend-section">
            <h2 className="recommend-section__title">
                {isColdStart ? "🔥 Sản phẩm bán chạy" : "🎯 Gợi ý dành cho bạn"}
            </h2>

            {isColdStart ? (
                <p className="recommend-section__subtitle">
                    Mua sản phẩm đầu tiên để nhận gợi ý riêng cho bạn.
                </p>
            ) : (
                <p className="recommend-section__subtitle">
                    Xin chào <strong>{customer.customer_name}</strong> — đây là những mục phù hợp nhất với nhu cầu của bạn.
                </p>
            )}

            <ProductList products={products} itemsPerPage={8} showPagination={true} />
        </section>
    );
}

export default RecommendationSection;