import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getFriendlyErrorMessage } from "../utils/authErrors";

function ForgotPassword() {
    const { resetPassword } = useAuth();
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) {
            return setError("Vui lòng nhập địa chỉ email.");
        }

        try {
            setError("");
            setMessage("");
            setLoading(true);
            await resetPassword(email.trim());
            setMessage(
                `Đã gửi hướng dẫn đặt lại mật khẩu đến email ${email.trim()}. Vui lòng kiểm tra hộp thư của bạn (bao gồm cả thư rác / Spam).`
            );
        } catch (err) {
            console.error("[ForgotPassword]:", err.code, err);
            setError(getFriendlyErrorMessage(err, "Không thể gửi email khôi phục"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
            <h2 style={{ textAlign: "center", color: "#1976d2" }}>Quên mật khẩu</h2>
            <p style={{ color: "#666", fontSize: "14px", textAlign: "center", marginBottom: "20px" }}>
                Nhập địa chỉ email đăng ký tài khoản của bạn để nhận liên kết cập nhật mật khẩu mới.
            </p>

            {message && (
                <div
                    style={{
                        background: "#e8f5e9",
                        border: "1px solid #c8e6c9",
                        borderRadius: "6px",
                        padding: "12px 14px",
                        marginBottom: "16px",
                        color: "#2e7d32",
                        fontSize: "14px",
                        lineHeight: "1.5",
                    }}
                >
                    {message}
                </div>
            )}

            {error && <p style={{ color: "red", textAlign: "center", marginBottom: "16px" }}>{error}</p>}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <input
                    type="email"
                    placeholder="Email của bạn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
                />

                <button
                    disabled={loading}
                    type="submit"
                    style={{
                        padding: "10px",
                        background: "#1976d2",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontWeight: "bold",
                    }}
                >
                    {loading ? "Đang gửi..." : "Gửi yêu cầu khôi phục"}
                </button>
            </form>

            <hr style={{ margin: "20px 0" }} />

            <p style={{ textAlign: "center", margin: 0 }}>
                <Link to="/login" style={{ color: "#1976d2", textDecoration: "none", fontWeight: "500" }}>
                    ← Quay lại trang Đăng nhập
                </Link>
            </p>
        </div>
    );
}

export default ForgotPassword;
