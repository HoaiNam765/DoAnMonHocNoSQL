import { useEffect, useState } from "react";
import { getPaymentQr, formatPrice } from "../services/shopService";

/**
 * Khung chuyển khoản: hiện mã QR để khách quét bằng app ngân hàng.
 *
 * Không cần nút "tôi đã chuyển tiền": SePay theo dõi tài khoản ngân hàng của
 * cửa hàng, thấy tiền vào là gọi webhook, backend tự đánh dấu đã thanh toán rồi
 * đẩy sự kiện xuống đây — trang cha tự tải lại và khung này biến mất.
 *
 * Chưa cấu hình tài khoản nhận tiền thì ẩn hẳn, để trang vẫn dùng bình thường
 * với cách trả tiền tại quầy.
 */
function PaymentQr({ user, orderId }) {
    const [tt, setTt] = useState(null);
    const [dangTai, setDangTai] = useState(true);
    const [daChep, setDaChep] = useState("");

    useEffect(() => {
        let huy = false;

        (async () => {
            try {
                setDangTai(true);
                const token = await user.getIdToken();
                const { data } = await getPaymentQr(token, orderId);
                if (!huy) setTt(data);
            } catch (err) {
                // Đơn đã thanh toán hoặc chưa bật chuyển khoản — không phải lỗi
                // đáng báo động, chỉ đơn giản là không hiện khung này.
                console.error("[PaymentQr] Không lấy được thông tin chuyển khoản:", err.message);
                if (!huy) setTt(null);
            } finally {
                if (!huy) setDangTai(false);
            }
        })();

        return () => {
            huy = true;
        };
    }, [user, orderId]);

    const chep = async (giaTri, nhan) => {
        try {
            await navigator.clipboard.writeText(String(giaTri));
            setDaChep(nhan);
            setTimeout(() => setDaChep(""), 1500);
        } catch {
            /* trình duyệt chặn clipboard thì thôi, khách vẫn đọc được trên màn hình */
        }
    };

    if (dangTai || !tt?.available) return null;

    return (
        <div style={styles.khung}>
            <h3 style={styles.tieuDe}>📱 Chuyển khoản để thanh toán ngay</h3>
            <p style={styles.moTa}>
                Mở app ngân hàng, quét mã dưới đây. Số tiền và nội dung đã điền sẵn — bạn không cần gõ gì.
            </p>

            <div style={styles.than}>
                <img src={tt.qrUrl} alt={`Mã QR thanh toán đơn ${orderId}`} style={styles.anhQr} />

                <div style={styles.thongTin}>
                    <Dong nhan="Ngân hàng" giaTri={tt.bank} />
                    <Dong
                        nhan="Số tài khoản"
                        giaTri={tt.accountNumber}
                        onChep={() => chep(tt.accountNumber, "stk")}
                        daChep={daChep === "stk"}
                    />
                    <Dong nhan="Số tiền" giaTri={formatPrice(tt.amount)} noiBat />
                    <Dong
                        nhan="Nội dung"
                        giaTri={tt.transferContent}
                        onChep={() => chep(tt.transferContent, "nd")}
                        daChep={daChep === "nd"}
                        noiBat
                    />

                    <p style={styles.canhBao}>
                        ⚠️ Giữ nguyên nội dung <strong>{tt.transferContent}</strong> khi chuyển khoản. Đây là
                        thứ hệ thống dùng để nhận ra đơn của bạn — sửa đi thì tiền vào mà đơn không tự cập nhật.
                    </p>
                </div>
            </div>

            <p style={styles.chan}>
                Chuyển xong bạn cứ để trang này mở — trạng thái đơn sẽ tự đổi sang{" "}
                <strong>Đã thanh toán</strong> trong vài giây, không cần tải lại trang.
            </p>
        </div>
    );
}

function Dong({ nhan, giaTri, onChep, daChep, noiBat }) {
    return (
        <div style={styles.dong}>
            <span style={styles.nhan}>{nhan}</span>
            <span style={{ ...styles.giaTri, ...(noiBat ? styles.giaTriNoiBat : {}) }}>{giaTri}</span>
            {onChep && (
                <button type="button" style={styles.nutChep} onClick={onChep}>
                    {daChep ? "✓ Đã chép" : "Chép"}
                </button>
            )}
        </div>
    );
}

const styles = {
    khung: {
        marginTop: "24px",
        padding: "20px",
        border: "1px solid #bcd9f7",
        borderRadius: "12px",
        background: "#f5faff",
    },
    tieuDe: { margin: "0 0 6px", fontSize: "17px", color: "#0d47a1" },
    moTa: { margin: "0 0 16px", color: "#5b6b7f", fontSize: "14px", lineHeight: 1.6 },
    than: { display: "flex", gap: "22px", flexWrap: "wrap", alignItems: "flex-start" },
    anhQr: {
        width: "220px",
        height: "220px",
        background: "white",
        border: "1px solid #e3e8ef",
        borderRadius: "10px",
        padding: "6px",
        objectFit: "contain",
    },
    thongTin: { flex: "1 1 280px", minWidth: 0 },
    dong: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 0",
        borderBottom: "1px solid #e6eef8",
    },
    nhan: { width: "108px", flexShrink: 0, color: "#6b7a90", fontSize: "13px" },
    giaTri: { flex: 1, minWidth: 0, color: "#1f2d3d", fontSize: "14px", wordBreak: "break-all" },
    giaTriNoiBat: { fontWeight: 700, color: "#d32f2f", fontSize: "16px" },
    nutChep: {
        flexShrink: 0,
        padding: "4px 10px",
        fontSize: "12px",
        border: "1px solid #1976d2",
        background: "white",
        color: "#1976d2",
        borderRadius: "6px",
        cursor: "pointer",
    },
    canhBao: {
        marginTop: "12px",
        padding: "10px 12px",
        background: "#fff8e1",
        border: "1px solid #ffe0a3",
        borderRadius: "8px",
        fontSize: "13px",
        color: "#6b5320",
        lineHeight: 1.6,
    },
    chan: { margin: "16px 0 0", fontSize: "13px", color: "#5b6b7f", lineHeight: 1.6 },
};

export default PaymentQr;
