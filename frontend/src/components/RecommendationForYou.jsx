import { useContext, useEffect, useState } from "react";
import { CustomerContext } from "../context/CustomerContext";
import { getCustomerRecommendations } from "../services/customerService";
import ProductCard from "./ProductCard";

function RecommendationForYou() {
    const { customerId } = useContext(CustomerContext);

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function loadData() {
            if (!customerId) return;

            setLoading(true);

            try {
                const result = await getCustomerRecommendations(customerId);

                setProducts(result.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [customerId]);

    if (!customerId) return null;

    return (
        <div style={{ marginBottom: "50px" }}>
            <h2>🎯 Gợi ý dành cho bạn</h2>

            {loading ? (
                <p>Đang tải...</p>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fill,minmax(220px,1fr))",
                        gap: "20px",
                        marginTop: "20px",
                    }}
                >
                    {products.map((item) => (
                        <ProductCard
                            key={item.id}
                            product={item}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default RecommendationForYou;