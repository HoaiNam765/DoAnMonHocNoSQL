const sections = [
    { id: "overview", label: "Tổng quan", icon: "◈" },
    { id: "products", label: "Sản phẩm", icon: "▦" },
    { id: "categories", label: "Danh mục", icon: "⌘" },
    { id: "users", label: "Người dùng", icon: "◎" },
];

function AdminSidebar({ activeSection, onChange, onLogout }) {
    return (
        <aside className="admin-sidebar">
            <div className="admin-brand">
                <span className="admin-brand-mark">N</span>
                <div>
                    <strong>NeoCommerce</strong>
                    <small>CONTROL CENTER</small>
                </div>
            </div>
            <nav className="admin-nav" aria-label="Điều hướng quản trị">
                {sections.map((section) => (
                    <button
                        className={activeSection === section.id ? "admin-nav-item active" : "admin-nav-item"}
                        key={section.id}
                        onClick={() => onChange(section.id)}
                    >
                        <span>{section.icon}</span>{section.label}
                    </button>
                ))}
            </nav>
            <div className="admin-sidebar-footer">
                <div className="admin-secure"><span>●</span> Hệ thống đang hoạt động</div>
                <button className="admin-logout" onClick={onLogout}>Đăng xuất</button>
            </div>
        </aside>
    );
}

export default AdminSidebar;
