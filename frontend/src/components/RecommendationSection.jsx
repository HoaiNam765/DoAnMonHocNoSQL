import { useContext, useEffect, useState } from "react";
import { CustomerContext } from "../context/CustomerContext";
import { getCustomerRecommendations } from "../services/customerService";
import ProductList from "./ProductList";

function RecommendationSection() {
    const { customerId } = useContext(CustomerContext);

    const [products, setProducts] = useState([]);
    const [customerName, setCustomerName] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadRecommendations() {
            if (!customerId) {
                setProducts([]);
                return;
            }

            try {
                setLoading(true);

                const result = await getCustomerRecommendations(customerId);

                setProducts(result.data || []);
                setCustomerName(result.customerName || "");
            } catch (error) {
                console.error(error);
                setProducts([]);
            } finally {
                setLoading(false);
            }
        }

        loadRecommendations();
    }, [customerId]);

    if (!customerId) return null;

    if (loading) {
        return <p>Đang tải gợi ý...</p>;
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