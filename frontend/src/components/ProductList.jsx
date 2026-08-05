import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";

function ProductList({ products, itemsPerPage = 8, showPagination = false }) {
    // LƯU Ý: mọi hook phải nằm TRƯỚC mọi câu return có điều kiện.
    //
    // Bản trước đặt `if (products rỗng) return ...` lên đầu rồi mới gọi useState
    // và useEffect. Khi danh sách chuyển từ có hàng sang rỗng, số hook gọi ở hai
    // lần render khác nhau — React ném lỗi ngay lúc render và xoá sạch giao diện
    // (trang trắng). Ở đây may là component bị gỡ ra gắn lại mỗi lần "Đang tải"
    // nên chưa nổ, nhưng chỉ cần bỏ trạng thái chờ đó đi là dính ngay.
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (showPagination) {
            setPage(1);
        }
    }, [products, showPagination]);

    if (!products || products.length === 0) {
        return (
            <div className="empty-state">
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📦</div>
                <h3>Không có sản phẩm</h3>
                <p>Hãy thử đổi từ khoá hoặc nới bộ lọc.</p>
            </div>
        );
    }

    const totalPages = showPagination ? Math.ceil(products.length / itemsPerPage) : 0;
    const start = (page - 1) * itemsPerPage;
    const visibleProducts = showPagination ? products.slice(start, start + itemsPerPage) : products;

    return (
        <>
            <div className="product-grid">
                {visibleProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
            {showPagination && totalPages > 1 && (
                <div className="page-nav">
                    <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                        ← Trước
                    </button>
                    <span className="page-nav__page">Trang {page} / {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                        Tiếp →
                    </button>
                </div>
            )}
        </>
    );
}

export default ProductList;