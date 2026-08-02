import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getFriendlyErrorMessage } from "../utils/authErrors";

function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);


    const handleRegister = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            return setError("Mật khẩu xác nhận không khớp.");
        }
        
        try {
            setError("");
            setLoading(true);
            await register(email, password, displayName);
            navigate("/");
        } catch (err) {
            console.error("[Register]:", err.code, err);
            setError(getFriendlyErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: "400px", margin: "40px auto", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
            <h2 style={{ textAlign: "center", color: "#1976d2" }}>Đăng ký tài khoản</h2>
            {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}
            
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "20px" }}>
                <input
                    type="text"
                    placeholder="Tên hiển thị (Ví dụ: Nguyễn Văn A)"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
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
                    placeholder="Mật khẩu (ít nhất 6 ký tự)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength="6"
                    style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
                <input
                    type="password"
                    placeholder="Xác nhận mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength="6"
                    style={{ padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
                <button disabled={loading} type="submit" style={{ padding: "10px", background: "#4caf50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
                    {loading ? "Đang xử lý..." : "Đăng ký"}
                </button>
            </form>
            
            <p style={{ textAlign: "center", marginTop: "20px" }}>
                Đã có tài khoản? <Link to="/login" style={{ color: "#1976d2" }}>Đăng nhập</Link>
            </p>
        </div>
    );
}

export default Register;
