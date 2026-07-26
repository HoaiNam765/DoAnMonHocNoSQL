import ProductCard from "./ProductCard";

function ProductList({ products }) {
    if (!products || products.length === 0) {
        return (
            <div
                style={{
                    textAlign: "center",
                    padding: "50px",
                    color: "#666",
                    border: "2px dashed #ccc",
                    borderRadius: "10px",
                }}
            >
                <div
    style={{
        textAlign: "center",
        padding: "70px",
        border: "2px dashed #ccc",
        borderRadius: "12px",
        color: "#888",
    }}
>
    📦

    <h3>Không có sản phẩm</h3>

    <p>Hãy thử tìm kiếm với từ khóa khác.</p>

</div>
            </div>
        );
    }

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                gap: "25px",
            }}
        >
            {products.map((product) => (
                <ProductCard
                    key={product.id}
                    product={product}
                />
            ))}
        </div>
    );
}

export default ProductList;