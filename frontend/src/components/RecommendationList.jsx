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
        <div style={{ marginTop: "40px" }}>
            <h2 className="recommend-section__title">🛒 Khách khác cũng mua</h2>
            <ProductList products={products} itemsPerPage={8} showPagination={true} />
        </div>
    );
}

export default RecommendationList;