import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import ErrorMessage from "../components/ErrorMessage";
import { getMyProfile, updateMyProfile, formatPrice, formatDate } from "../services/shopService";

/** Trang thông tin cá nhân + vài số liệu tổng hợp lấy từ đồ thị. */
function Profile() {
    const { user, refreshCustomer } = useAuth();

    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState({ customerName: "", phone: "", address: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const token = await user.getIdToken();
            const { data } = await getMyProfile(token);
            setProfile(data);
            setForm({
                customerName: data.customer_name || "",
                phone: data.phone || "",
                address: data.address || "",
            });
        } catch (err) {
            console.error(err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [user, retryCount]);

    useEffect(() => {
        load();
    }, [load]);

    const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSave = async (e) => {
        e.preventDefault();

        if (form.phone.trim() && !/^0\d{8,10}$/.test(form.phone.trim())) {
            setMessage("❌ Số điện thoại không hợp lệ (bắt đầu bằng 0, 9–11 chữ số).");
            return;
        }

        try {
            setSaving(true);
            setMessage("");
            const token = await user.getIdToken();
            const { data } = await updateMyProfile(token, form);
            setProfile({ ...profile, ...data });
            await refreshCustomer(); // cập nhật tên hiển thị trên Header
            setMessage("✅ Đã lưu thông tin.");
        } catch (err) {
            console.error(err);
            setMessage(`❌ ${err.message || "Lưu thất bại."}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <h2>Đang tải thông tin...</h2>;
    if (error) return <ErrorMessage error={error} onRetry={() => setRetryCount(retryCount + 1)} />;
    if (!profile) return <h2>Không tải được hồ sơ.</h2>;

    return (
        <>
            <h1>Thông tin tài khoản</h1>

            {/* Số liệu tổng hợp từ đồ thị */}
            <div style={statsGrid}>
                <Stat icon="📦" label="Đơn hàng" value={profile.order_count} />
                <Stat icon="💰" label="Đã chi tiêu" value={formatPrice(profile.total_spent)} />
                <Stat icon="🛍️" label="Sản phẩm đã mua" value={profile.bought_count} />
                <Stat icon="👀" label="Sản phẩm đã xem" value={profile.viewed_count} />
            </div>

            <div style={{ display: "flex", gap: "30px", marginTop: "30px", flexWrap: "wrap" }}>
                {/* Form chỉnh sửa */}
                <form onSubmit={handleSave} style={{ flex: "1 1 360px" }}>
                    <h3>Chỉnh sửa thông tin</h3>

                    {message && (
                        <p style={{ ...msgStyle, background: message.startsWith("✅") ? "#e8f5e9" : "#ffebee" }}>
                            {message}
                        </p>
                    )}

                    <label style={labelStyle}>Họ tên</label>
                    <input value={form.customerName} onChange={update("customerName")} style={inputStyle} />

                    <label style={labelStyle}>Số điện thoại</label>
                    <input
                        value={form.phone}
                        onChange={update("phone")}
                        placeholder="0901234567"
                        style={inputStyle}
                    />

                    <label style={labelStyle}>Địa chỉ mặc định</label>
                    <textarea
                        value={form.address}
                        onChange={update("address")}
                        rows={3}
                        placeholder="Dùng để điền sẵn khi đặt hàng"
                        style={{ ...inputStyle, resize: "vertical" }}
                    />

                    <button type="submit" disabled={saving} style={saveButton(saving)}>
                        {saving ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                </form>

                {/* Thông tin cố định */}
                <div style={{ flex: "1 1 300px" }}>
                    <h3>Thông tin tài khoản</h3>
                    <div style={infoBox}>
                        <Row label="Email" value={profile.email} />
                        <Row label="Mã khách hàng" value={<code>{profile.customer_id}</code>} />
                        <Row label="Vai trò" value={profile.role === "admin" ? "Quản trị viên" : "Khách hàng"} />
                        <Row label="Ngày tham gia" value={formatDate(profile.created_at)} />
                    </div>

                    <Link to="/orders">
                        <button style={ordersButton}>📦 Xem đơn hàng của tôi</button>
                    </Link>

                    {profile.role === "admin" && (
                        <Link to="/admin">
                            <button style={{ ...ordersButton, background: "#7b1fa2" }}>
                                ⚙️ Trang quản trị
                            </button>
                        </Link>
                    )}
                </div>
            </div>
        </>
    );
}

function Stat({ icon, label, value }) {
    return (
        <div style={statCard}>
            <div style={{ fontSize: "26px" }}>{icon}</div>
            <div style={{ fontSize: "22px", fontWeight: "bold", marginTop: "6px" }}>{value}</div>
            <div style={{ color: "#888", fontSize: "13px" }}>{label}</div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div style={{ display: "flex", gap: "12px", padding: "8px 0", flexWrap: "wrap" }}>
            <span style={{ color: "#888", minWidth: "130px" }}>{label}</span>
            <span style={{ flex: 1, wordBreak: "break-all" }}>{value || "—"}</span>
        </div>
    );
}

const statsGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "16px",
    marginTop: "20px",
};

const statCard = {
    padding: "20px",
    background: "white",
    border: "1px solid #eee",
    borderRadius: "10px",
    textAlign: "center",
};

const labelStyle = { display: "block", marginTop: "14px", marginBottom: "6px", fontWeight: 500 };

const inputStyle = {
    width: "100%",
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    fontSize: "15px",
    fontFamily: "inherit",
    boxSizing: "border-box",
};

const msgStyle = { padding: "10px 14px", borderRadius: "6px", margin: "12px 0" };

const saveButton = (busy) => ({
    marginTop: "20px",
    padding: "12px 28px",
    background: busy ? "#90caf9" : "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: busy ? "default" : "pointer",
    fontWeight: "bold",
});

const infoBox = { border: "1px solid #eee", borderRadius: "10px", padding: "16px" };

const ordersButton = {
    width: "100%",
    marginTop: "16px",
    padding: "12px",
    background: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
};

export default Profile;
