import { useEffect, useState } from "react";

import ProductList from "../components/ProductList";
import RecommendationSection from "../components/RecommendationSection";
import ErrorMessage from "../components/ErrorMessage";

import { getProducts } from "../services/productService";

function Home() {
    const [products, setProducts] = useState([]);
    const [pagination, setPagination] = useState(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        async function loadProducts() {
            try {
                setLoading(true);
                setError(null);

                const result = await getProducts(page, 12, search);
                setProducts(result.data || []);
                setPagination(result.pagination);
            } catch (err) {
                console.error(err);
                setError(err);
                setProducts([]);
                setPagination(null);
            } finally {
                setLoading(false);
            }
        }

        loadProducts();
    }, [page, search, retryCount]);

    return (
        <div className="app-shell">
            <RecommendationSection />

            <div className="section-heading">
                <div>
                    <h1>Danh sách sản phẩm</h1>
                    <p className="section-subtitle">Khám phá các sản phẩm nổi bật và dễ dàng tìm kiếm.</p>
                </div>

                <input
                    className="search-input"
                    type="text"
                    placeholder="Tìm sản phẩm..."
                    value={search}
                    onChange={(e) => {
                        setPage(1);
                        setSearch(e.target.value);
                    }}
                />
            </div>

            {loading ? (
                <div className="empty-state">Đang tải...</div>
            ) : error ? (
                <ErrorMessage error={error} onRetry={() => setRetryCount(retryCount + 1)} />
            ) : (
                <>
                    <ProductList products={products} />

                    {pagination && pagination.totalPages > 0 && (
                        <div className="page-nav">
                            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                ◀ Trước
                            </button>

                            <span className="page-nav__page">
                                Trang {pagination.page} / {pagination.totalPages}
                            </span>

                            <button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
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