import { Link } from "react-router-dom";

function ProductDetail() {
    return (
        <>
            <h1>Chi tiết sản phẩm</h1>

            <div
                style={{
                    marginTop: "20px",
                    border: "2px dashed #bbb",
                    borderRadius: "8px",
                    height: "220px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                Thông tin sản phẩm
            </div>

            <h2 style={{ marginTop: "30px" }}>
                Gợi ý mua kèm
            </h2>

            <div
                style={{
                    marginTop: "15px",
                    border: "2px dashed #bbb",
                    borderRadius: "8px",
                    height: "180px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                Danh sách sản phẩm gợi ý
            </div>

            <div style={{ marginTop: "20px" }}>
                <Link to="/">
                    ← Quay lại
                </Link>
            </div>
        </>
    );
}

export default ProductDetail;