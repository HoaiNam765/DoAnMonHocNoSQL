import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Header() {
    const { user, customer, logout } = useAuth();

    return (
        <header
            style={{
                background: "#1976d2",
                color: "white",
                padding: "18px 40px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}
        >
            <Link to="/" style={{ color: "white", textDecoration: "none" }}>
                <h2 style={{ margin: 0 }}>🛒 Neo4j Marketplace</h2>
            </Link>

            <div>
                {user ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                        <span>
                            Xin chào, <strong>{customer?.customer_name || user.displayName || user.email}</strong>
                        </span>
                        <button
                            onClick={logout}
                            style={{
                                padding: "6px 12px",
                                borderRadius: "4px",
                                border: "none",
                                background: "#e53935",
                                color: "white",
                                cursor: "pointer",
                                fontWeight: "bold"
                            }}
                        >
                            Đăng xuất
                        </button>
                    </div>
                ) : (
                    <Link to="/login" style={{ color: "white", textDecoration: "none", fontWeight: "bold", padding: "6px 12px", border: "1px solid white", borderRadius: "4px" }}>
                        Đăng nhập
                    </Link>
                )}
            </div>
        </header>
    );
}

export default Header;