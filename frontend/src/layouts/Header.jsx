import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

function Header() {
    const { user, customer, logout } = useAuth();
    const { cart } = useCart();

    const isAdmin = String(customer?.role ?? "").toLowerCase() === "admin";

    return (
        <header style={headerStyle}>
            <Link to="/" style={{ color: "white", textDecoration: "none" }}>
                <h2 style={{ margin: 0 }}>🛒 Neo4j Marketplace</h2>
            </Link>

            {user ? (
                <nav style={navStyle}>
                    {/* Giỏ hàng + badge số lượng */}
                    <Link to="/cart" style={cartLinkStyle} title="Giỏ hàng">
                        <span style={{ fontSize: "22px" }}>🛒</span>
                        {cart.item_count > 0 && <span style={badgeStyle}>{cart.item_count}</span>}
                    </Link>

                    <Link to="/orders" style={navLink}>
                        Đơn hàng
                    </Link>

                    {isAdmin && (
                        <Link to="/admin/orders" style={navLink}>
                            Quản lý đơn
                        </Link>
                    )}

                    <Link to="/profile" style={navLink}>
                        {customer?.customer_name || user.displayName || user.email}
                    </Link>

                    <button onClick={logout} style={logoutButton}>
                        Đăng xuất
                    </button>
                </nav>
            ) : (
                <Link to="/login" style={loginButton}>
                    Đăng nhập
                </Link>
            )}
        </header>
    );
}

const headerStyle = {
    background: "#1976d2",
    color: "white",
    padding: "18px 40px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
};

const navStyle = {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
};

const navLink = {
    color: "white",
    textDecoration: "none",
    fontWeight: 500,
};

const cartLinkStyle = {
    position: "relative",
    display: "inline-flex",
    color: "white",
    textDecoration: "none",
};

const badgeStyle = {
    position: "absolute",
    top: "-6px",
    right: "-10px",
    background: "#e53935",
    color: "white",
    borderRadius: "10px",
    padding: "1px 6px",
    fontSize: "12px",
    fontWeight: "bold",
    minWidth: "18px",
    textAlign: "center",
};

const logoutButton = {
    padding: "6px 12px",
    borderRadius: "4px",
    border: "none",
    background: "#e53935",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
};

const loginButton = {
    color: "white",
    textDecoration: "none",
    fontWeight: "bold",
    padding: "6px 12px",
    border: "1px solid white",
    borderRadius: "4px",
};

export default Header;
