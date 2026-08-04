import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { syncUser } from "../services/authService";
import { getFriendlyErrorMessage, SILENT_CODES } from "../utils/authErrors";

function Login() {
    const { login, loginWithGoogle, blockedMessage, clearBlockedMessage, timeoutMessage, clearTimeoutMessage } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigateAfterLogin = async (userCredential) => {
        const token = await userCredential.user.getIdToken();
        const result = await syncUser(token);
        navigate(result.data?.role === "admin" ? "/admin" : "/");
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setError("");
            clearBlockedMessage();
            clearTimeoutMessage();
            setLoading(true);
            const userCredential = await login(email, password);
            await navigateAfterLogin(userCredential);
        } catch (err) {
            console.error("[Login] email/password:", err.code, err);
            setError(getFriendlyErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setError("");
            clearBlockedMessage();
            clearTimeoutMessage();
            setLoading(true);
            const userCredential = await loginWithGoogle();
            await navigateAfterLogin(userCredential);
        } catch (err) {
            console.error("[Login] Google:", err.code, err);
            if (!SILENT_CODES.includes(err.code)) {
                setError(getFriendlyErrorMessage(err));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
            <h2 style={{ textAlign: "center", color: "#1976d2" }}>Đăng nhập</h2>

            {/* Phiên hết giờ — giải thích vì sao đang dùng thì bị đăng xuất */}
            {timeoutMessage && (
                <div
                    style={{
                        background: "#fff8e1",
                        border: "1px solid #ffe082",
                        borderRadius: "6px",
                        padding: "12px 14px",
                        marginBottom: "14px",
                    }}
                >
                    <strong style={{ color: "#e65100" }}>⏱️ Phiên làm việc đã kết thúc</strong>
                    <p style={{ margin: "6px 0 0", color: "#666", fontSize: "14px" }}>
                        {timeoutMessage}
                    </p>
                </div>
            )}

            {/* Tài khoản vừa bị quản trị viên khoá — giải thích vì sao bị đăng xuất */}
            {blockedMessage && (
                <div
                    style={{
                        background: "#ffebee",
                        border: "1px solid #ffcdd2",
                        borderRadius: "6px",
                        padding: "12px 14px",
                        marginBottom: "14px",
                    }}
                >
                    <strong style={{ color: "#c62828" }}>🔒 Tài khoản bị khoá</strong>
                    <p style={{ margin: "6px 0 0", color: "#666", fontSize: "14px" }}>
                        {blockedMessage}
                    </p>
                </div>
            )}

            {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "20px" }}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
                <input
                    type="password"
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
                <button disabled={loading} type="submit" style={{ padding: "10px", background: "#1976d2", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                    {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                </button>
            </form>
            
            <hr style={{ margin: "20px 0" }} />
            
            <button 
                onClick={handleGoogleLogin} 
                disabled={loading}
                style={{ width: "100%", padding: "10px", background: "#db4437", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
            >
                Đăng nhập bằng Google
            </button>
            
            <p style={{ textAlign: "center", marginTop: "20px" }}>
                Chưa có tài khoản? <Link to="/register" style={{ color: "#1976d2" }}>Đăng ký ngay</Link>
            </p>
        </div>
    );
}

export default Login;
