import { useEffect, useState } from "react";
import { getRecommendations } from "../services/productService";
import ProductCard from "./ProductCard";

function RecommendationList({ productId }) {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadRecommendations() {
            try {
                const result = await getRecommendations(productId);

                setRecommendations(result.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }

        if (productId) {
            loadRecommendations();
        }
    }, [productId]);

    if (loading) {
        return <p>Đang tải gợi ý...</p>;
    }

    return (
        <>
            <h2 style={{ marginBottom: "20px" }}>
                Khách khác cũng mua
            </h2>

            {recommendations.length === 0 ? (
                <p>Chưa có gợi ý.</p>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fill,minmax(220px,1fr))",
                        gap: "20px",
                    }}
                >
                    {recommendations.map((item) => (
                        <ProductCard
                            key={item.id}
                            product={item}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

export default RecommendationList;