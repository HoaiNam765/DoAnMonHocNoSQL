import { useEffect, useRef } from "react";

/**
 * Hộp thoại thông báo một nút.
 *
 * Dùng cho những lỗi THAO TÁC — kiểu "chỉ còn 10 sản phẩm trong kho" — tức là
 * thứ chỉ làm hỏng đúng một hành động chứ không làm hỏng cả trang. Trước đây
 * loại lỗi này bị đem hiển thị như lỗi tải trang, thay thế sạch nội dung giỏ
 * hàng: khách chỉ bấm nhầm dấu cộng một cái mà mất luôn cả giỏ trước mắt.
 *
 * Thay cho alert() của trình duyệt vì alert() khoá cứng cả tab, không đặt được
 * tiếng Việt cho nút, và trông lạc lõng so với phần còn lại của giao diện.
 */
function AlertDialog({ open, title = "Thông báo", message, onClose }) {
    const nutRef = useRef(null);

    // Cho phép đóng bằng phím Esc — thói quen thông thường với hộp thoại
    useEffect(() => {
        if (!open) return undefined;

        const onKey = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);

        // Đưa con trỏ vào nút OK để bấm Enter là đóng được ngay
        nutRef.current?.focus();

        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            style={styles.lop}
            onClick={onClose}
            role="presentation"
        >
            {/* Chặn sự kiện nổi lên lớp phủ, không thì bấm vào trong hộp cũng đóng */}
            <div
                style={styles.hop}
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-label={title}
            >
                <div style={styles.icon}>⚠️</div>
                <h3 style={styles.tieuDe}>{title}</h3>
                <p style={styles.noiDung}>{message}</p>

                <button ref={nutRef} style={styles.nut} onClick={onClose}>
                    Đã hiểu
                </button>
            </div>
        </div>
    );
}

const styles = {
    lop: {
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 2000,
    },
    hop: {
        background: "white",
        borderRadius: "12px",
        padding: "26px 28px",
        maxWidth: "400px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
    },
    icon: { fontSize: "40px", marginBottom: "6px" },
    tieuDe: { margin: "0 0 10px", color: "#1f2d3d", fontSize: "18px" },
    noiDung: { margin: "0 0 22px", color: "#5b6b7f", lineHeight: 1.6, fontSize: "15px" },
    nut: {
        padding: "10px 30px",
        background: "#1976d2",
        color: "white",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "15px",
        fontWeight: 600,
    },
};

export default AlertDialog;
