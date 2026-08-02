import ProductCard from "./ProductCard";

function ProductList({ products }) {
    if (!products || products.length === 0) {
        return (
            <div className="empty-state">
                <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📦</div>
                <h3>Không có sản phẩm</h3>
                <p>Hãy thử tìm kiếm với từ khóa khác.</p>
            </div>
        );
    }

    return (
        <div className="product-grid">
            {products.map((product) => (
                <ProductCard key={product.id} product={product} />
            ))}
        </div>
    );
}

export default ProductList;