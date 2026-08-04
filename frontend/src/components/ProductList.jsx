import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";

function ProductList({ products, itemsPerPage = 8, showPagination = false }) {
    if (!products || products.length === 0) {
        return (
            <div className="empty-state">
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📦</div>
                <h3>Không có sản phẩm</h3>
                <p>Hãy thử tìm kiếm với từ khóa khác.</p>
            </div>
        );
    }

    const totalPages = showPagination ? Math.ceil(products.length / itemsPerPage) : 0;
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (showPagination) {
            setPage(1);
        }
    }, [products, showPagination]);

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