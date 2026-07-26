import { useEffect, useState } from "react";
import { getRecommendations } from "../services/productService";
import ProductList from "./ProductList";

function RecommendationList({ productId }) {
    const [products, setProducts] = useState([]);

    useEffect(() => {
        async function loadRecommendations() {
            try {
                const result = await getRecommendations(productId);

                setProducts(result.data || []);
            } catch (error) {
                console.error(error);
            }
        }

        loadRecommendations();
    }, [productId]);

    if (products.length === 0) return null;

    return (
        <div style={{ marginTop: "50px" }}>
            <h2
                style={{
                    color: "#1976d2",
                    marginBottom: "20px",
                }}
            >
                🛒 Khách khác cũng mua
            </h2>

            <ProductList products={products} />
        </div>
    );
}

export default RecommendationList;