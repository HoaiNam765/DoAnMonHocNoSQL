import { Component } from "react";

/**
 * Lưới an toàn cuối cùng cho giao diện.
 *
 * VÌ SAO CẦN: khi một component ném lỗi lúc render, React gỡ bỏ TOÀN BỘ cây
 * giao diện — người dùng chỉ thấy trang trắng, không thông báo, không biết làm
 * gì tiếp. Có ErrorBoundary thì lỗi bị chặn lại tại đây và hiện ra một trang
 * xin lỗi tử tế kèm nút thoát.
 *
 * Đây là chốt chặn, KHÔNG phải cách sửa lỗi: mỗi lần màn hình này hiện ra nghĩa
 * là có một lỗi thật cần tìm và sửa. Thông tin lỗi được in ra console để còn lần
 * theo được.
 *
 * Bắt buộc phải viết bằng class — React không có hook tương đương.
 */
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error("[ErrorBoundary] Giao diện gặp lỗi:", error, info?.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div style={styles.wrap}>
                <div style={styles.card}>
                    <div style={styles.icon}>😵</div>
                    <h2 style={styles.title}>Trang này gặp sự cố</h2>
                    <p style={styles.text}>
                        Có lỗi ngoài dự tính khi hiển thị nội dung. Bạn thử tải lại trang, hoặc quay về
                        trang chủ để tiếp tục mua sắm nhé.
                    </p>

                    <div style={styles.actions}>
                        <button style={styles.primary} onClick={() => window.location.reload()}>
                            Tải lại trang
                        </button>
                        <button
                            style={styles.secondary}
                            onClick={() => {
                                window.location.href = "/";
                            }}
                        >
                            Về trang chủ
                        </button>
                    </div>

                    {/* Chi tiết kỹ thuật để báo lỗi cho nhóm phát triển, mặc định thu gọn */}
                    <details style={styles.details}>
                        <summary style={styles.summary}>Chi tiết kỹ thuật</summary>
                        <pre style={styles.pre}>{String(this.state.error?.message ?? this.state.error)}</pre>
                    </details>
                </div>
            </div>
        );
    }
}

const styles = {
    wrap: {
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
    },
    card: {
        maxWidth: "480px",
        width: "100%",
        background: "white",
        border: "1px solid #e3e8ef",
        borderRadius: "12px",
        padding: "28px",
        textAlign: "center",
        boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
    },
    icon: { fontSize: "44px", marginBottom: "8px" },
    title: { margin: "0 0 10px", color: "#1f2d3d" },
    text: { color: "#5b6b7f", lineHeight: 1.6, margin: "0 0 20px" },
    actions: { display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" },
    primary: {
        padding: "10px 20px",
        background: "#1976d2",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
    },
    secondary: {
        padding: "10px 20px",
        background: "white",
        color: "#1976d2",
        border: "1px solid #1976d2",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
    },
    details: { marginTop: "18px", textAlign: "left" },
    summary: { cursor: "pointer", color: "#8492a6", fontSize: "13px" },
    pre: {
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        background: "#f5f7fb",
        padding: "10px",
        borderRadius: "6px",
        fontSize: "12px",
        color: "#b3261e",
        marginTop: "8px",
    },
};

export default ErrorBoundary;
