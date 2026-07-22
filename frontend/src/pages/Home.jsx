import { Link } from "react-router-dom";

function Home() {
    return (
        <>
            <h1>Danh sách sản phẩm</h1>

            <div
                style={{
                    marginTop: "20px",
                    border: "2px dashed #bbb",
                    borderRadius: "8px",
                    height: "350px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: "#777",
                }}
            >
                Khu vực hiển thị danh sách sản phẩm
            </div>

            <div style={{ marginTop: "20px" }}>
                <Link to="/product/1">
                    Xem thử trang chi tiết →
                </Link>
            </div>
        </>
    );
}

export default Home;