import { useEffect, useState } from "react";

import ProductList from "../components/ProductList";
import RecommendationSection from "../components/RecommendationSection";
import ErrorMessage from "../components/ErrorMessage";
import ProductFilters from "../components/ProductFilters";
import PurchaseTicker from "../components/PurchaseTicker";

import { getProducts } from "../services/productService";

const KHONG_LOC = { categoryId: "", minPrice: "", maxPrice: "", sort: "" };

function Home() {
    const [products, setProducts] = useState([]);
    const [pagination, setPagination] = useState(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState(KHONG_LOC);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        async function loadProducts() {
            try {
                setLoading(true);
                setError(null);

                const result = await getProducts(page, 12, search, filters);
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
        // filters là object mới mỗi lần lọc nên so sánh theo nội dung, tránh gọi lại thừa
    }, [page, search, retryCount, filters.categoryId, filters.minPrice, filters.maxPrice, filters.sort]);

    /** Đổi bộ lọc thì quay về trang 1 — không thì dễ rơi vào trang trống. */
    const doiBoLoc = (moi) => {
        setPage(1);
        setFilters(moi);
    };

    return (
        <div className="app-shell">
            <PurchaseTicker />

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

            <ProductFilters value={filters} onChange={doiBoLoc} />

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