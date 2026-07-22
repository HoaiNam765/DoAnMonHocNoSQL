import { Link } from "react-router-dom";

function Header() {
    return (
        <header
            style={{
                height: "70px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 30px",
                backgroundColor: "#1976d2",
                color: "white",
            }}
        >
            <Link
                to="/"
                style={{
                    color: "white",
                    textDecoration: "none",
                    fontWeight: "bold",
                    fontSize: "24px",
                }}
            >
                E-Commerce
            </Link>

            <div>
                <label style={{ marginRight: "10px" }}>
                    Khách hàng:
                </label>

                <select>
                    <option>Nguyễn Văn A</option>
                    <option>Trần Thị B</option>
                    <option>Lê Văn C</option>
                </select>
            </div>
        </header>
    );
}

export default Header;