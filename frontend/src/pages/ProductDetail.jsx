import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import ProductCard from "../components/ProductCard";

import {
    getProductById,
    getRecommendations,
} from "../services/productService";

import {
    getCustomerRecommendations,
} from "../services/customerService";

import { CustomerContext } from "../context/CustomerContext";

function ProductDetail() {

    const { id } = useParams();

    const { customerId } = useContext(CustomerContext);

    const [product, setProduct] = useState(null);

    const [productRecommendations, setProductRecommendations] = useState([]);

    const [customerRecommendations, setCustomerRecommendations] = useState([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {

        async function loadData() {

            try {

                setLoading(true);

                const productResult = await getProductById(id);

                setProduct(productResult.data);

                const recommendResult = await getRecommendations(id);

                setProductRecommendations(recommendResult.data);

                if (customerId) {

                    const customerResult =
                        await getCustomerRecommendations(customerId);

                    setCustomerRecommendations(customerResult.data);

                }

            } catch (error) {

                console.error(error);

            } finally {

                setLoading(false);

            }

        }

        loadData();

    }, [id, customerId]);

    if (loading) {

        return <h2>Đang tải...</h2>;

    }

    if (!product) {

        return <h2>Không tìm thấy sản phẩm.</h2>;

    }

    return (

        <>

            <Link to="/">← Quay lại</Link>

            <div
                style={{
                    display: "flex",
                    gap: "40px",
                    marginTop: "30px",
                    alignItems: "flex-start",
                }}
            >

                <img
                    src={product.image}
                    alt={product.title}
                    style={{
                        width: "350px",
                        borderRadius: "10px",
                    }}
                />

                <div>

                    <h1>{product.title}</h1>

                    <h2 style={{ color: "#e53935" }}>
                        {Number(product.final_price).toLocaleString("vi-VN")} đ
                    </h2>

                    <p>

                        <strong>Danh mục:</strong>{" "}

                        {product.category_name}

                    </p>

                    <p>

                        <strong>Đánh giá:</strong>{" "}

                        ⭐ {product.rating}

                    </p>

                </div>

            </div>

            <hr style={{ margin: "40px 0" }} />

            <h2>Mua kèm sản phẩm này</h2>

            {productRecommendations.length === 0 ? (

                <p>Chưa có gợi ý.</p>

            ) : (

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fill,minmax(230px,1fr))",
                        gap: "20px",
                        marginTop: "20px",
                    }}
                >

                    {productRecommendations.map((item) => (

                        <ProductCard
                            key={item.id}
                            product={item}
                        />

                    ))}

                </div>

            )}

            <hr style={{ margin: "40px 0" }} />

            <h2>Đề xuất dành cho khách hàng đang chọn</h2>

            {customerRecommendations.length === 0 ? (

                <p>Chưa có gợi ý cho khách hàng này.</p>

            ) : (

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fill,minmax(230px,1fr))",
                        gap: "20px",
                        marginTop: "20px",
                    }}
                >

                    {customerRecommendations.map((item) => (

                        <ProductCard
                            key={item.id}
                            product={item}
                        />

                    ))}

                </div>

            )}

        </>

    );

}

export default ProductDetail;