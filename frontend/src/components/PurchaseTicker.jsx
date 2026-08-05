import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentPurchases } from "../services/productService";

/**
 * Dòng tin mua hàng chạy ngang ở đầu trang chủ.
 *
 * Dữ liệu là ĐƠN HÀNG THẬT đã thanh toán, không phải tin dựng sẵn — nên số lượng
 * phụ thuộc vào lượng đơn có trong hệ thống. Chưa có đơn nào thì cả dải tin ẩn
 * luôn, thay vì bịa ra vài dòng cho đẹp.
 *
 * Tên khách đã được backend che bớt ("Nam Đ. H.") trước khi gửi ra, vì trang chủ
 * là nơi ai cũng xem được.
 *
 * Vì sao đổi tin bằng bộ đếm thay vì animation CSS chạy vô tận: với vài bản tin
 * thì một dải marquee trông thưa thớt và lặp lộ liễu; hiện từng tin một, đổi
 * sau mỗi vài giây, vừa gọn vừa đọc kịp.
 */

const CHU_KY_MS = 4000;

function PurchaseTicker() {
    const [tin, setTin] = useState([]);
    const [viTri, setViTri] = useState(0);
    const dongHo = useRef(null);

    useEffect(() => {
        let huy = false;

        getRecentPurchases(10)
            .then((ket) => {
                if (!huy) setTin(ket.data ?? []);
            })
            .catch((err) => {
                // Hỏng dải tin thì thôi, không được làm hỏng cả trang chủ
                console.error("[Ticker] Không tải được tin mua hàng:", err);
            });

        return () => {
            huy = true;
        };
    }, []);

    useEffect(() => {
        if (tin.length <= 1) return undefined;

        dongHo.current = setInterval(() => {
            setViTri((v) => (v + 1) % tin.length);
        }, CHU_KY_MS);

        return () => clearInterval(dongHo.current);
    }, [tin.length]);

    if (tin.length === 0) return null;

    const hienTai = tin[viTri];
    if (!hienTai) return null;

    return (
        <div style={styles.wrap}>
            <span style={styles.nhan}>🔔 Vừa mua</span>

            {/* key đổi theo vị trí để React dựng lại phần tử, kích hoạt lại hiệu ứng hiện dần */}
            <div key={viTri} style={styles.noiDung}>
                <strong style={styles.ten}>{hienTai.customer_name}</strong>
                <span style={styles.mo}> vừa mua </span>
                <Link to={`/product/${hienTai.product_id}`} style={styles.sanPham} title={hienTai.product_title}>
                    {hienTai.product_title}
                </Link>
                <span style={styles.gia}>{Number(hienTai.price).toLocaleString("vi-VN")} đ</span>
            </div>

            {tin.length > 1 && (
                <span style={styles.dem}>
                    {viTri + 1}/{tin.length}
                </span>
            )}

            <style>{`
                @keyframes tickerVao {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

const styles = {
    wrap: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "linear-gradient(90deg, #fff8e1, #fffdf7)",
        border: "1px solid #ffe0a3",
        borderRadius: "10px",
        padding: "10px 14px",
        marginBottom: "18px",
        overflow: "hidden",
    },
    nhan: {
        flexShrink: 0,
        fontSize: "12px",
        fontWeight: 700,
        color: "#a26b00",
        background: "#ffefc2",
        padding: "4px 10px",
        borderRadius: "12px",
        whiteSpace: "nowrap",
    },
    noiDung: {
        flex: 1,
        minWidth: 0,
        fontSize: "13.5px",
        color: "#4a3b1a",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        animation: "tickerVao 400ms ease",
    },
    ten: { color: "#1f2d3d" },
    mo: { color: "#8a7b5b" },
    sanPham: {
        color: "#1976d2",
        textDecoration: "none",
        fontWeight: 500,
    },
    gia: {
        marginLeft: "8px",
        color: "#d32f2f",
        fontWeight: 700,
        whiteSpace: "nowrap",
    },
    dem: { flexShrink: 0, fontSize: "11px", color: "#a08a5b" },
};

export default PurchaseTicker;
