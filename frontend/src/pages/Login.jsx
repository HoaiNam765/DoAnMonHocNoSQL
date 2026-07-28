import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Login() {
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const getFriendlyErrorMessage = (code) => {
        switch (code) {
            case "auth/invalid-credential":
            case "auth/user-not-found":
            case "auth/wrong-password":
                return "Email hoặc mật khẩu không đúng.";
            case "auth/invalid-email":
                return "Email không hợp lệ.";
            case "auth/too-many-requests":
                return "Tài khoản tạm thời bị khóa do đăng nhập sai quá nhiều. Vui lòng thử lại sau.";
            default:
                return "Đăng nhập thất bại. Vui lòng thử lại.";
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            setError("");
            setLoading(true);
            await login(email, password);
            navigate("/");
        } catch (err) {
            setError(getFriendlyErrorMessage(err.code));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            setError("");
            setLoading(true);
            await loginWithGoogle();
            navigate("/");
        } catch (err) {
            if (err.code !== "auth/popup-closed-by-user") {
                setError(getFriendlyErrorMessage(err.code));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
            <h2 style={{ textAlign: "center", color: "#1976d2" }}>Đăng nhập</h2>
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
