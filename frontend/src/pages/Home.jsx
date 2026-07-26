import { useEffect, useState } from "react";

import ProductList from "../components/ProductList";
import RecommendationSection from "../components/RecommendationSection";

import { getProducts } from "../services/productService";

function Home() {
    const [products, setProducts] = useState([]);
    const [pagination, setPagination] = useState(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProducts() {
            try {
                setLoading(true);

                const result = await getProducts(page, 12, search);

                setProducts(result.data || []);
                setPagination(result.pagination);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }

        loadProducts();
    }, [page, search]);

    return (
        <div>
            {/* Task 3.3 */}
            <RecommendationSection />

            <h1
                style={{
                    marginBottom: "20px",
                }}
            >
                Danh sách sản phẩm
            </h1>

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
                                Trang {pagination.page} /{" "}
                                {pagination.totalPages}
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
    );
}

export default Home;