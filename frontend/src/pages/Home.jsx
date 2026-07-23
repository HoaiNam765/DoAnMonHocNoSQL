import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts } from "../services/productService";
import ProductCard from "../components/ProductCard";

function Home() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProducts() {
            try {
                const result = await getProducts();
                setProducts(result.data);
            } catch (error) {
                console.error("Lỗi khi lấy sản phẩm:", error);
            } finally {
                setLoading(false);
            }
        }

        loadProducts();
    }, []);

    return (
        <>
            <h1>Danh sách sản phẩm</h1>

            <div
                style={{
                    marginTop: "20px",
                    border: "2px dashed #bbb",
                    borderRadius: "8px",
                    minHeight: "350px",
                    padding: "20px",
                }}
            >
                {loading ? (
    <p>Đang tải dữ liệu...</p>
) : (
    <div
        style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
            gap: "20px",
        }}
    >
        {products.map((product) => (
            <ProductCard
                key={product.id}
                product={product}
            />
        ))}
    </div>
)}
            </div>
        </>
    );
}

export default Home;