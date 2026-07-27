import { useContext, useEffect, useState } from "react";
import { CustomerContext } from "../context/CustomerContext";
import { getCustomerRecommendations } from "../services/customerService";
import ProductList from "./ProductList";
import ErrorMessage from "./ErrorMessage";

function RecommendationSection() {
    const { customerId } = useContext(CustomerContext);

    const [products, setProducts] = useState([]);
    const [customerName, setCustomerName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        async function loadRecommendations() {
            if (!customerId) {
                setProducts([]);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const result = await getCustomerRecommendations(customerId);

                setProducts(result.data || []);
                setCustomerName(result.customerName || "");
            } catch (err) {
                console.error(err);
                setError(err);
                setProducts([]);
            } finally {
                setLoading(false);
            }
        }

        loadRecommendations();
    }, [customerId, retryCount]);

    if (!customerId) return null;

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
                    color: "#1976d2",
                    marginBottom: "10px",
                }}
            >
                🎯 Gợi ý dành cho bạn
            </h2>

            <p style={{ color: "#666" }}>
                Xin chào <strong>{customerName}</strong>
            </p>

            <ProductList products={products} />

            <hr style={{ marginTop: "40px" }} />
        </div>
    );
}

export default RecommendationSection;