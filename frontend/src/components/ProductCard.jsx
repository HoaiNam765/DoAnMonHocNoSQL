import { Link } from "react-router-dom";

function ProductCard({ product }) {
    return (
        <div
            style={{
                background: "#fff",
                borderRadius: "10px",
                overflow: "hidden",
                boxShadow: "0 2px 8px rgba(0,0,0,.1)",
                transition: ".2s",
            }}
        >
            <img
                src={product.image}
                alt={product.title}
                style={{
                    width: "100%",
                    height: "200px",
                    objectFit: "cover",
                }}
            />

            <div style={{ padding: "15px" }}>
                <h3
                    style={{
                        fontSize: "18px",
                        height: "48px",
                        overflow: "hidden",
                    }}
                >
                    {product.title}
                </h3>

                <p
                    style={{
                        color: "#e53935",
                        fontWeight: "bold",
                        margin: "10px 0",
                    }}
                >
                    {Number(product.final_price).toLocaleString("vi-VN")} đ
                </p>

                <p
                    style={{
                        color: "#666",
                        fontSize: "14px",
                    }}
                >
                    {product.category_name}
                </p>

                <p>⭐ {product.rating}</p>

                <Link to={`/product/${product.id}`}>
                    <button
                        style={{
                            width: "100%",
                            marginTop: "10px",
                            padding: "10px",
                            border: "none",
                            borderRadius: "5px",
                            cursor: "pointer",
                            background: "#1976d2",
                            color: "white",
                        }}
                    >
                        Xem chi tiết
                    </button>
                </Link>
            </div>
        </div>
    );
}

export default ProductCard;