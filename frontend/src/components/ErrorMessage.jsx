/**
 * Hộp thông báo lỗi dùng chung khi gọi API thất bại.
 *
 * Tách riêng để trang chủ, trang chi tiết và khu vực gợi ý báo lỗi giống nhau,
 * thay vì mỗi nơi tự nuốt lỗi rồi hiện "Không có sản phẩm" gây hiểu nhầm.
 */

/** Dịch lỗi kỹ thuật sang câu tiếng Việt người dùng hiểu được. */
function describeError(error) {
    // fetch ném TypeError khi không nối được tới server (backend chưa chạy,
    // sai cổng, hoặc bị chặn CORS) — đây là trường hợp hay gặp nhất khi demo.
    if (error instanceof TypeError) {
        return "Không kết nối được tới máy chủ. Kiểm tra backend đã chạy chưa: mở terminal, chạy cd backend rồi npm run dev.";
    }

    return error?.message || "Đã có lỗi xảy ra.";
}

function ErrorMessage({ error, onRetry }) {
    return (
        <div
            style={{
                textAlign: "center",
                padding: "50px",
                border: "2px solid #ffcdd2",
                background: "#fff5f5",
                borderRadius: "10px",
            }}
        >
            <div style={{ fontSize: "40px" }}>⚠️</div>

            <h3
                style={{
                    margin: "10px 0",
                    color: "#c62828",
                }}
            >
                Không tải được dữ liệu
            </h3>

            <p style={{ color: "#666" }}>{describeError(error)}</p>

            {onRetry && (
                <button
                    onClick={onRetry}
                    style={{
                        marginTop: "15px",
                        padding: "10px 25px",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer",
                        background: "#1976d2",
                        color: "white",
                    }}
                >
                    Thử lại
                </button>
            )}
        </div>
    );
}

export default ErrorMessage;
