<<<<<<< Updated upstream
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
=======
import { useContext, useEffect, useState } from "react";
import ProductList from "../components/ProductList";
import { getProducts } from "../services/productService";
import { getCustomerRecommendations } from "../services/customerService";
import { CustomerContext } from "../context/CustomerContext";

function Home() {
    const { customerId } = useContext(CustomerContext);

    const [products, setProducts] = useState([]);
    const [recommendProducts, setRecommendProducts] = useState([]);

    const [pagination, setPagination] = useState(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);

                // Danh sách sản phẩm
                const productResult = await getProducts(page, 12, search);

                setProducts(productResult.data);
                setPagination(productResult.pagination);

                // Gợi ý theo khách hàng
                if (customerId) {
                    const recommendResult =
                        await getCustomerRecommendations(customerId);
		    console.log("customerId =", customerId);
console.log("recommendResult =", recommendResult);

                    console.log("Recommend Result:", recommendResult);

                    setRecommendProducts(recommendResult.data || []);
                } else {
                    setRecommendProducts([]);
                }
            } catch (error) {
                console.error(error);
>>>>>>> Stashed changes
            } finally {
                setLoading(false);
            }
        }

<<<<<<< Updated upstream
        loadProducts();
    }, []);
=======
        loadData();
    }, [page, search, customerId]);
>>>>>>> Stashed changes

    return (
        <div>

            {/* Gợi ý dành cho bạn */}

            {recommendProducts.length > 0 && (
                <>
                    <h2
                        style={{
                            color: "#1976d2",
                            marginBottom: "20px",
                        }}
                    >
                        🎯 Gợi ý dành cho bạn
                    </h2>

                    <ProductList products={recommendProducts} />

                    <hr
                        style={{
                            margin: "40px 0",
                        }}
                    />
                </>
            )}

            {/* Danh sách sản phẩm */}

            <h1>Danh sách sản phẩm</h1>

<<<<<<< Updated upstream
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
=======
            <input
                type="text"
                placeholder="Tìm sản phẩm..."
                value={search}
                onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                }}
                style={{
                    width: "350px",
                    padding: "10px",
                    marginBottom: "25px",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                }}
            />

            {loading ? (
                <h2>Đang tải...</h2>
            ) : (
                <>
                    <ProductList products={products} />

                    {pagination && (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "10px",
                                marginTop: "30px",
                            }}
                        >
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                ◀ Trước
                            </button>

                            <span>
                                Trang {pagination.page} / {pagination.totalPages}
                            </span>

                            <button
                                disabled={page === pagination.totalPages}
                                onClick={() => setPage(page + 1)}
                            >
                                Sau ▶
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
>>>>>>> Stashed changes
    );
}

export default Home;