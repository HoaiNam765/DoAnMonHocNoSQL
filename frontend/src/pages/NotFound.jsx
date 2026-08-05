import { Link } from "react-router-dom";

/**
 * Trang cho đường dẫn không tồn tại.
 *
 * VÌ SAO CẦN: React Router không tự dựng trang 404. Thiếu route bắt-tất-cả thì
 * mọi URL lạ (gõ nhầm, link cũ, bookmark hỏng) đều không khớp route nào và
 * router không render gì — người dùng nhận đúng một trang TRẮNG.
 */
function NotFound() {
    return (
        <div style={styles.wrap}>
            <div style={styles.icon}>🧭</div>
            <h2 style={styles.title}>Không tìm thấy trang này</h2>
            <p style={styles.text}>
                Đường dẫn bạn vừa mở không tồn tại hoặc đã được đổi. Bạn quay về trang chủ để tiếp tục
                mua sắm nhé.
            </p>

            <Link to="/" style={styles.button}>
                Về trang chủ
            </Link>
        </div>
    );
}

const styles = {
    wrap: { textAlign: "center", padding: "60px 24px" },
    icon: { fontSize: "52px", marginBottom: "10px" },
    title: { margin: "0 0 10px", color: "#1f2d3d" },
    text: { color: "#5b6b7f", lineHeight: 1.6, maxWidth: "420px", margin: "0 auto 22px" },
    button: {
        display: "inline-block",
        padding: "10px 22px",
        background: "#1976d2",
        color: "white",
        borderRadius: "8px",
        textDecoration: "none",
        fontSize: "14px",
    },
};

export default NotFound;
