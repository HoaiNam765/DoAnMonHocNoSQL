import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getCustomerRecommendations } from "../services/customerService";
import { getPopularProducts } from "../services/productService";
import ProductList from "./ProductList";
import ErrorMessage from "./ErrorMessage";
import ProductFilters from "./ProductFilters";

const KHONG_LOC = { categoryId: "", minPrice: "", maxPrice: "", sort: "" };

function RecommendationSection() {
    const { customer } = useAuth();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isColdStart, setIsColdStart] = useState(false);
    const [filters, setFilters] = useState(KHONG_LOC);

    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        async function loadRecommendations() {
            try {
                setLoading(true);
                setError(null);

                if (!customer || !customer.bought_count || customer.bought_count === 0) {
                    setIsColdStart(true);
                    const result = await getPopularProducts(8, filters);
                    setProducts(result.data || []);
                } else {
                    setIsColdStart(false);
                    const result = await getCustomerRecommendations(customer.customer_id, 20, filters);
                    setProducts(result.data || []);
                }
            } catch (err) {
                console.error(err);
                setError(err);
                setProducts([]);
            } finally {
                setLoading(false);
            }
        }

        loadRecommendations();
    }, [customer, retryCount, filters.categoryId, filters.minPrice, filters.maxPrice, filters.sort]);

    const dangLoc =
        Boolean(filters.categoryId) ||
        filters.minPrice !== "" ||
        filters.maxPrice !== "" ||
        filters.sort !== "";

    // Ẩn hẳn mục này khi vừa không có gợi ý vừa không lọc gì (tài khoản mới,
    // chưa có dữ liệu). Nhưng nếu ĐANG lọc thì phải giữ lại — lọc ra 0 kết quả
    // mà cả mục biến mất thì khách không còn chỗ nào để bỏ lọc, kẹt luôn.
    if (!loading && !error && products.length === 0 && !dangLoc) {
        return null;
    }

    return (
        <section className="recommend-section">
            <h2 className="recommend-section__title">
                {isColdStart ? "🔥 Sản phẩm bán chạy" : "🎯 Gợi ý dành cho bạn"}
            </h2>

            {isColdStart ? (
                <p className="recommend-section__subtitle">
                    Mua sản phẩm đầu tiên để nhận gợi ý riêng cho bạn.
                </p>
            ) : (
                <p className="recommend-section__subtitle">
                    Xin chào <strong>{customer?.customer_name}</strong> — đây là những mục phù hợp nhất với nhu cầu của bạn.
                </p>
            )}

            {/* Thanh lọc nằm NGOÀI nhánh loading để không bị gỡ ra gắn lại mỗi
                lần đổi bộ lọc — giữ được lựa chọn và khỏi tải lại danh mục. */}
            <ProductFilters value={filters} onChange={setFilters} compact />

            {loading ? (
                <p className="section-subtitle">Đang tải gợi ý...</p>
            ) : error ? (
                <ErrorMessage error={error} onRetry={() => setRetryCount(retryCount + 1)} />
            ) : (
                <ProductList products={products} itemsPerPage={8} showPagination={true} />
            )}
        </section>
    );
}

export default RecommendationSection;