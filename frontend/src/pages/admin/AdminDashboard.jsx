import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Loading from "../../components/Loading";
import ErrorMessage from "../../components/ErrorMessage";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminStatCard from "../../components/admin/AdminStatCard";
import {
    getAdminStats, getAdminCategories, createCategory, updateCategory, deleteCategory,
    getAdminProducts, createProduct, updateProduct, deleteProduct,
    getAdminUsers, getUserDetails, updateUserRole, updateUserStatus,
    getRevenue, getUserOrders,
} from "../../services/adminService";
import { statusInfo, formatPrice } from "../../services/shopService";
import AdminOrders from "./AdminOrders";
import "./AdminDashboard.css";

const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const dateText = (value) => value ? String(value).replace("T", " ").slice(0, 16) : "--";
const emptyProduct = { title: "", final_price: "", rating: 5, image: "", category_id: "", stock: 100 };

function AdminDashboard() {
    const { user, customer, loading: authLoading, logout, refreshCustomer } = useAuth();
    const [section, setSection] = useState("overview");
    const [token, setToken] = useState("");
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState("");
    const [stats, setStats] = useState(null);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState({ data: [], pagination: {} });
    const [users, setUsers] = useState({ data: [], pagination: {} });
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(emptyProduct);
    const [selectedUser, setSelectedUser] = useState(null);
    const [checkingAccess, setCheckingAccess] = useState(true);
    const [statsRefreshKey, setStatsRefreshKey] = useState(0);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setCheckingAccess(false);
            return;
        }

        let active = true;
        refreshCustomer()
            .catch((refreshError) => {
                if (active) setError(refreshError.message || "Không thể xác minh quyền Admin.");
            })
            .finally(() => {
                if (active) setCheckingAccess(false);
            });

        return () => { active = false; };
    }, [authLoading, user, refreshCustomer]);

    useEffect(() => {
        if (user) user.getIdToken().then(setToken).catch(() => setError("Không thể xác thực phiên admin."));
    }, [user]);

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        setBusy(true);
        setError("");
        const load = async () => {
            try {
                if (section === "overview") {
                    const result = await getAdminStats(token);
                    if (!cancelled) setStats(result.data);
                } else if (section === "categories") {
                    const result = await getAdminCategories(token);
                    if (!cancelled) setCategories(result.data || []);
                } else if (section === "products") {
                    const [result, categoryResult] = await Promise.all([
                        getAdminProducts(token, { page, limit: 8, search }),
                        getAdminCategories(token),
                    ]);
                    if (!cancelled) {
                        setProducts(result);
                        setCategories(categoryResult.data || []);
                    }
                } else {
                    const result = await getAdminUsers(token, { page, limit: 8, search });
                    if (!cancelled) setUsers(result);
                }
            } catch (loadError) {
                if (!cancelled) setError(loadError.message);
            } finally {
                if (!cancelled) setBusy(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [token, section, page, search, statsRefreshKey]);

    if (authLoading || checkingAccess) return <Loading />;
    if (!user) return <Navigate to="/login" replace />;
    if (String(customer?.role || "").toLowerCase() !== "admin") return <Navigate to="/" replace />;

    const changeSection = (next) => { setSection(next); setPage(1); setSearch(""); setError(""); };
    const closeModal = () => { setModal(null); setSelectedUser(null); setForm(emptyProduct); };
    const saveCategory = async (event) => {
        event.preventDefault();
        try {
            if (modal?.item) await updateCategory(token, modal.item.category_id, { category_name: form.category_name, status: form.status });
            else await createCategory(token, { category_id: form.category_id, category_name: form.category_name });
            closeModal();
            const result = await getAdminCategories(token); setCategories(result.data || []);
        } catch (saveError) { setError(saveError.message); }
    };
    const saveProduct = async (event) => {
        event.preventDefault();
        try {
            const payload = { ...form, final_price: Number(form.final_price), rating: Number(form.rating), stock: Number(form.stock) };
            if (modal?.item) await updateProduct(token, modal.item.id, payload); else await createProduct(token, payload);
            closeModal(); setPage(1);
            const result = await getAdminProducts(token, { page: 1, limit: 8, search }); setProducts(result);
        } catch (saveError) { setError(saveError.message); }
    };
    const openProduct = (item) => { setForm(item ? { ...emptyProduct, ...item } : emptyProduct); setModal({ type: "product", item }); };
    const openCategory = (item) => { setForm(item ? { ...item } : { category_id: "", category_name: "", status: "active" }); setModal({ type: "category", item }); };
    const openUser = async (item) => { try { const result = await getUserDetails(token, item.customer_id); setSelectedUser(result.data); } catch (loadError) { setError(loadError.message); } };
    const archive = async (type, id) => {
        if (!window.confirm("Ẩn mục này khỏi hệ thống?")) return;
        try { if (type === "product") await deleteProduct(token, id); else await deleteCategory(token, id); setPage(1); if (type === "product") setProducts(await getAdminProducts(token, { page: 1, limit: 8, search })); else setCategories((await getAdminCategories(token)).data || []); } catch (deleteError) { setError(deleteError.message); }
    };

    return (
        <div className="admin-shell">
            <AdminSidebar activeSection={section} onChange={changeSection} onLogout={logout} />
            <main className="admin-main">
                <header className="admin-topbar"><div><span className="eyebrow">ADMINISTRATION / 2026</span><h1>{section === "overview" ? "Tổng quan vận hành" : section === "products" ? "Kho sản phẩm" : section === "categories" ? "Danh mục" : "Người dùng"}</h1></div><div className="admin-profile"><span className="profile-dot">{(customer?.customer_name || "A").slice(0, 1).toUpperCase()}</span><span>{customer?.customer_name || user.email}</span></div></header>
                {error && <ErrorMessage error={new Error(error)} onRetry={() => setError("")} />}
                {busy ? <Loading /> : (
                    <>
                        {section === "overview" && <Overview stats={stats} onNavigate={changeSection} />}
                        {section === "orders" && <AdminOrders onOrderChanged={() => setStatsRefreshKey((value) => value + 1)} />}
                        {section === "categories" && <Categories categories={categories} onAdd={() => openCategory()} onEdit={openCategory} onDelete={(id) => archive("category", id)} />}
                        {section === "products" && <Products products={products} categories={categories} search={search} setSearch={setSearch} page={page} setPage={setPage} onAdd={() => openProduct()} onEdit={openProduct} onDelete={(id) => archive("product", id)} />}
                        {section === "users" && <Users users={users} search={search} setSearch={setSearch} page={page} setPage={setPage} onView={openUser} onRole={async (id, role) => { await updateUserRole(token, id, role); setUsers(await getAdminUsers(token, { page, limit: 8, search })); }} onStatus={async (id, status) => { await updateUserStatus(token, id, status); setUsers(await getAdminUsers(token, { page, limit: 8, search })); }} />}
                    </>
                )}
            </main>
            {modal?.type === "category" && <CategoryModal form={form} setForm={setForm} onSubmit={saveCategory} onClose={closeModal} editing={Boolean(modal.item)} />}
            {modal?.type === "product" && <ProductModal form={form} setForm={setForm} categories={categories} onSubmit={saveProduct} onClose={closeModal} editing={Boolean(modal.item)} />}
            {selectedUser && <UserModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
        </div>
    );
}

/**
 * Trang tổng quan quản trị.
 *
 * PHÂN BIỆT HAI NGUỒN SỐ LIỆU — điểm quan trọng khi đọc bảng điều khiển này:
 *   - Nhóm thẻ "Đồ thị gợi ý": đếm trên cạnh BOUGHT, phần lớn là dữ liệu mô
 *     phỏng nạp từ CSV để thuật toán gợi ý có đủ tín hiệu. KHÔNG phải doanh thu.
 *   - Nhóm thẻ "Kinh doanh thực tế": lấy từ node Order — đơn hàng khách đặt
 *     thật trên web. Đây mới là doanh thu.
 */
function Overview({ stats, onNavigate }) {
    const { user } = useAuth();

    const summary = stats?.summary || {};
    const orderSummary = stats?.orderSummary || {};

    const [groupBy, setGroupBy] = useState("month");
    const [range, setRange] = useState({ from: "", to: "" });
    const [series, setSeries] = useState(stats?.revenueByPeriod || []);
    const [loadingChart, setLoadingChart] = useState(false);

    // Nạp lại biểu đồ mỗi khi đổi cách gộp hoặc khoảng ngày
    useEffect(() => {
        let cancelled = false;

        async function loadRevenue() {
            try {
                setLoadingChart(true);
                const token = await user.getIdToken();
                const result = await getRevenue(token, { groupBy, ...range });
                if (!cancelled) setSeries(result.data || []);
            } catch (err) {
                console.error("[Overview] Không tải được doanh thu:", err);
                if (!cancelled) setSeries([]);
            } finally {
                if (!cancelled) setLoadingChart(false);
            }
        }

        if (user) loadRevenue();
        return () => {
            cancelled = true;
        };
    }, [user, groupBy, range]);

    const applyPreset = (days) => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days + 1);
        const fmt = (d) => d.toISOString().slice(0, 10);
        setGroupBy("day");
        setRange({ from: fmt(from), to: fmt(to) });
    };

    const clearRange = () => setRange({ from: "", to: "" });

    // --- Toạ độ biểu đồ ---
    const WIDTH = 320;
    const HEIGHT = 160;
    const maxValue = Math.max(...series.map((d) => Number(d.revenue || 0)), 1);
    const stepX = WIDTH / Math.max(series.length - 1, 1);
    const pointAt = (item, index) => ({
        x: series.length === 1 ? WIDTH / 2 : index * stepX,
        y: HEIGHT - (Number(item.revenue || 0) / maxValue) * (HEIGHT - 20) - 10,
    });

    const chartPoints = series.map((d, i) => {
        const { x, y } = pointAt(d, i);
        return `${x},${y}`;
    }).join(" ");

    const areaPath = (() => {
        if (!series.length) return "";
        const pts = series.map((d, i) => pointAt(d, i));
        const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
        return `${line} L${pts[pts.length - 1].x} ${HEIGHT} L${pts[0].x} ${HEIGHT} Z`;
    })();

    const totalInRange = series.reduce((s, d) => s + Number(d.revenue || 0), 0);
    const ordersInRange = series.reduce((s, d) => s + Number(d.order_count || 0), 0);

    return (
        <section className="admin-content">
            <div className="welcome-band">
                <div>
                    <span className="eyebrow">REAL-TIME SNAPSHOT</span>
                    <h2>Nhịp vận hành hôm nay</h2>
                    <p>Theo dõi sức khỏe cửa hàng và những chuyển động mới nhất.</p>
                </div>
                <button className="primary-button" onClick={() => onNavigate("orders")}>
                    Xử lý đơn hàng <span>→</span>
                </button>
            </div>

            {/* Số liệu kinh doanh thực tế — từ node Order */}
            <div className="stats-grid">
                <AdminStatCard
                    label="Doanh thu thực tế"
                    value={money(orderSummary.real_revenue)}
                    note="Từ đơn đã thanh toán"
                    accent="orange"
                />
                <AdminStatCard
                    label="Chờ thanh toán"
                    value={Number(orderSummary.pending_orders || 0).toLocaleString("vi-VN")}
                    note="Đơn khách chưa tới trả tiền"
                    accent="orange"
                />
                <AdminStatCard
                    label="Tổng đơn hàng"
                    value={Number(orderSummary.total_orders || 0).toLocaleString("vi-VN")}
                    note={`${orderSummary.completed_orders || 0} đơn đã hoàn tất`}
                    accent="blue"
                />
                <AdminStatCard
                    label="Khách hàng"
                    value={Number(summary.total_customers || 0).toLocaleString("vi-VN")}
                    note={`${summary.total_products || 0} sản phẩm · ${summary.total_categories || 0} danh mục`}
                    accent="violet"
                />
            </div>

            {/* Biểu đồ doanh thu + bộ lọc */}
            <section className="panel chart-panel">
                <div className="panel-heading">
                    <div>
                        <span className="eyebrow">TREND</span>
                        <h3>Doanh thu theo thời gian</h3>
                    </div>
                    <span className="muted">
                        {money(totalInRange)} · {ordersInRange} đơn
                    </span>
                </div>

                <div style={filterBar}>
                    <div style={{ display: "flex", gap: "6px" }}>
                        <button style={chip(groupBy === "month")} onClick={() => setGroupBy("month")}>
                            Theo tháng
                        </button>
                        <button style={chip(groupBy === "day")} onClick={() => setGroupBy("day")}>
                            Theo ngày
                        </button>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                        <button style={chip(false)} onClick={() => applyPreset(7)}>7 ngày</button>
                        <button style={chip(false)} onClick={() => applyPreset(30)}>30 ngày</button>
                    </div>

                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                        <input
                            type="date"
                            value={range.from}
                            onChange={(e) => setRange({ ...range, from: e.target.value })}
                            style={dateInput}
                        />
                        <span style={{ color: "#94a3b8" }}>→</span>
                        <input
                            type="date"
                            value={range.to}
                            onChange={(e) => setRange({ ...range, to: e.target.value })}
                            style={dateInput}
                        />
                        {(range.from || range.to) && (
                            <button style={chip(false)} onClick={clearRange}>Xoá lọc</button>
                        )}
                    </div>
                </div>

                {loadingChart ? (
                    <div className="chart-empty">Đang tải dữ liệu doanh thu...</div>
                ) : series.length ? (
                    <div className="revenue-chart">
                        <svg viewBox="0 0 320 160" role="img" aria-label="Doanh thu theo thời gian">
                            <path className="chart-area" d={areaPath} />
                            <polyline className="chart-line" points={chartPoints} />
                            <g>
                                {series.map((item, index) => {
                                    const { x, y } = pointAt(item, index);
                                    return (
                                        <circle key={item.period} className="chart-point" cx={x} cy={y} r="4">
                                            <title>{`${item.period}: ${money(item.revenue)} (${item.order_count} đơn)`}</title>
                                        </circle>
                                    );
                                })}
                            </g>
                        </svg>
                        <div className="chart-labels">
                            {series.map((item) => (
                                <span key={item.period}>{item.period}</span>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="chart-empty">
                        Chưa có đơn hàng nào đã thanh toán trong khoảng thời gian này.
                    </div>
                )}
            </section>

            <div className="overview-grid">
                {/* Doanh thu theo danh mục — tính trên đồ thị BOUGHT */}
                <section className="panel">
                    <div className="panel-heading">
                        <div>
                            <span className="eyebrow">PERFORMANCE</span>
                            <h3>Danh mục bán chạy</h3>
                        </div>
                        <span className="muted">Theo đồ thị BOUGHT</span>
                    </div>
                    <div className="revenue-list">
                        {(stats?.categoryRevenue || []).slice(0, 7).map((item, index) => (
                            <div className="revenue-row" key={item.category_id}>
                                <span className="rank">0{index + 1}</span>
                                <div className="revenue-name">
                                    <strong>{item.category_name}</strong>
                                    <span>{item.sold_count || 0} lượt mua</span>
                                </div>
                                <div className="bar-track">
                                    <i
                                        style={{
                                            width: `${Math.min(100, ((item.revenue || 0) / Math.max(1, stats.categoryRevenue[0]?.revenue || 1)) * 100)}%`,
                                        }}
                                    />
                                </div>
                                <b>{money(item.revenue)}</b>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Đơn hàng gần nhất — duyệt node Order nên có thời gian chính xác */}
                <section className="panel">
                    <div className="panel-heading">
                        <div>
                            <span className="eyebrow">LATEST ACTIVITY</span>
                            <h3>Đơn hàng gần nhất</h3>
                        </div>
                        <span className="muted">Mới nhất lên đầu</span>
                    </div>
                    <div className="activity-list">
                        {(stats?.recentOrders || []).length ? (
                            stats.recentOrders.slice(0, 6).map((order) => {
                                const info = statusInfo(order.status);
                                return (
                                    <div className="activity-row" key={order.order_id}>
                                        <span className="activity-avatar">
                                            {(order.customer_name || "K").slice(0, 1)}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <strong>{order.customer_name || order.customer_id}</strong>
                                            <span>
                                                {order.product_title || "—"}
                                                {order.item_count > 1 && ` +${order.item_count - 1} món`}
                                            </span>
                                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                                                {dateText(order.created_at)}
                                            </span>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <b>{money(order.total)}</b>
                                            <div
                                                style={{
                                                    fontSize: "11px",
                                                    fontWeight: "bold",
                                                    color: info.color,
                                                    marginTop: "2px",
                                                }}
                                            >
                                                {info.label}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="chart-empty">Chưa có đơn hàng nào.</p>
                        )}
                    </div>
                </section>
            </div>

            {/* Cảnh báo tồn kho */}
            {(stats?.lowStock || []).length > 0 && (
                <section className="panel" style={{ marginTop: "20px" }}>
                    <div className="panel-heading">
                        <div>
                            <span className="eyebrow">INVENTORY</span>
                            <h3>Sản phẩm sắp hết hàng</h3>
                        </div>
                        <button className="primary-button" onClick={() => onNavigate("products")}>
                            Quản lý kho <span>→</span>
                        </button>
                    </div>
                    <div className="revenue-list">
                        {stats.lowStock.map((item) => (
                            <div className="revenue-row" key={item.id}>
                                <div className="product-cell">
                                    {item.image ? <img src={item.image} alt="" /> : <span className="image-placeholder">N</span>}
                                    <div>
                                        <strong>{item.title}</strong>
                                    </div>
                                </div>
                                <b style={{ color: item.stock === 0 ? "#dc2626" : "#f59e0b" }}>
                                    {item.stock === 0 ? "Hết hàng" : `Còn ${item.stock}`}
                                </b>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </section>
    );
}

const filterBar = {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    alignItems: "center",
    padding: "12px 0 18px",
    borderBottom: "1px solid #f1f5f9",
    marginBottom: "16px",
};

const chip = (active) => ({
    padding: "6px 14px",
    border: active ? "none" : "1px solid #cbd5e1",
    background: active ? "#2563eb" : "white",
    color: active ? "white" : "#475569",
    borderRadius: "18px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: active ? "bold" : "normal",
});

const dateInput = {
    padding: "6px 10px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#475569",
};

function SearchBar({ value, onChange, placeholder }) { return <div className="search-box"><span>⌕</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>; }
function Toolbar({ title, count, onAdd, addLabel, children }) { return <div className="section-toolbar"><div><span className="eyebrow">{count} RECORDS</span><h2>{title}</h2></div><div className="toolbar-actions">{children}{addLabel && <button className="primary-button" onClick={onAdd}>＋ {addLabel}</button>}</div></div>; }
function EmptyRow({ colSpan }) { return <tr><td className="empty-row" colSpan={colSpan}>Chưa có dữ liệu phù hợp.</td></tr>; }
function Pagination({ pagination, page, setPage }) { const total = pagination?.totalPages || 1; return <div className="pagination"><span>Trang {page} / {total}</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button><button disabled={page >= total} onClick={() => setPage(page + 1)}>→</button></div></div>; }

function Categories({ categories, onAdd, onEdit, onDelete }) { return <section className="admin-content"><Toolbar title="Danh mục sản phẩm" count={categories.length} onAdd={onAdd} addLabel="Thêm danh mục" /><div className="panel table-panel"><table><thead><tr><th>Mã danh mục</th><th>Tên danh mục</th><th>Sản phẩm</th><th>Trạng thái</th><th /></tr></thead><tbody>{categories.length ? categories.map((item) => <tr key={item.category_id}><td><code>{item.category_id}</code></td><td><strong>{item.category_name}</strong></td><td>{item.product_count}</td><td><span className={`status ${item.status === "hidden" ? "blocked" : "active"}`}>{item.status === "hidden" ? "Đã ẩn" : "Đang hiển thị"}</span></td><td className="row-actions"><button onClick={() => onEdit(item)}>Sửa</button><button className="danger-text" onClick={() => onDelete(item.category_id)}>Ẩn</button></td></tr>) : <EmptyRow colSpan="5" />}</tbody></table></div></section>; }
function Products({ products, categories, search, setSearch, page, setPage, onAdd, onEdit, onDelete }) { return <section className="admin-content"><Toolbar title="Kho sản phẩm" count={products.pagination?.total || 0} onAdd={onAdd} addLabel="Thêm sản phẩm"><SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Tìm theo tên sản phẩm..." /></Toolbar><div className="panel table-panel"><table><thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Đánh giá</th><th>Kho</th><th>Trạng thái</th><th /></tr></thead><tbody>{products.data?.length ? products.data.map((item) => <tr key={item.id}><td><div className="product-cell">{item.image ? <img src={item.image} alt="" /> : <span className="image-placeholder">N</span>}<div><strong>{item.title}</strong><code>{item.id}</code></div></div></td><td>{item.category_name || "--"}</td><td><strong>{money(item.final_price)}</strong></td><td>★ {Number(item.rating || 0).toFixed(1)}</td><td>{item.stock ?? "--"}</td><td><span className="status active">Đang bán</span></td><td className="row-actions"><button onClick={() => onEdit(item)}>Sửa</button><button className="danger-text" onClick={() => onDelete(item.id)}>Ẩn</button></td></tr>) : <EmptyRow colSpan="7" />}</tbody></table><Pagination pagination={products.pagination} page={page} setPage={setPage} /></div></section>; }
function Users({ users, search, setSearch, page, setPage, onView, onRole, onStatus }) { return <section className="admin-content"><Toolbar title="Người dùng" count={users.pagination?.total || 0} onAdd={() => {}} addLabel=""><SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Tìm tên, email hoặc mã khách..." /></Toolbar><div className="panel table-panel"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Lượt mua</th><th>Ngày tạo</th><th /></tr></thead><tbody>{users.data?.length ? users.data.map((item) => <tr key={item.customer_id}><td><div className="user-cell"><span className="activity-avatar">{(item.customer_name || "K").slice(0, 1)}</span><div><strong>{item.customer_name || "Khách hàng nền"}</strong><span>{item.email || item.customer_id}</span></div></div></td><td><select className="inline-select" value={item.role} onChange={(event) => onRole(item.customer_id, event.target.value)}><option value="user">User</option><option value="admin">Admin</option></select></td><td><button className={`status ${item.status === "blocked" ? "blocked" : "active"}`} onClick={() => onStatus(item.customer_id, item.status === "blocked" ? "active" : "blocked")}>{item.status === "blocked" ? "Đã khóa" : "Hoạt động"}</button></td><td>{item.bought_count || 0}</td><td>{dateText(item.created_at)}</td><td className="row-actions"><button onClick={() => onView(item)}>Chi tiết</button></td></tr>) : <EmptyRow colSpan="6" />}</tbody></table><Pagination pagination={users.pagination} page={page} setPage={setPage} /></div></section>; }

function Modal({ title, children, onClose }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="admin-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><h3>{title}</h3><button onClick={onClose}>×</button></div>{children}</div></div>; }
function CategoryModal({ form, setForm, onSubmit, onClose, editing }) { return <Modal title={editing ? "Chỉnh sửa danh mục" : "Thêm danh mục"} onClose={onClose}><form className="admin-form" onSubmit={onSubmit}><label>Mã danh mục<input disabled={editing} required value={form.category_id || ""} onChange={(event) => setForm({ ...form, category_id: event.target.value })} /></label><label>Tên danh mục<input required value={form.category_name || ""} onChange={(event) => setForm({ ...form, category_name: event.target.value })} /></label>{editing && <label>Trạng thái<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Đang hiển thị</option><option value="hidden">Đã ẩn</option></select></label>}<div className="modal-actions"><button type="button" onClick={onClose}>Hủy</button><button className="primary-button" type="submit">Lưu thay đổi</button></div></form></Modal>; }
function ProductModal({ form, setForm, categories, onSubmit, onClose, editing }) { const update = (key, value) => setForm({ ...form, [key]: value }); return <Modal title={editing ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"} onClose={onClose}><form className="admin-form" onSubmit={onSubmit}><label>Tên sản phẩm<input required value={form.title || ""} onChange={(event) => update("title", event.target.value)} /></label><div className="form-grid"><label>Giá bán<input required type="number" min="0" value={form.final_price} onChange={(event) => update("final_price", event.target.value)} /></label><label>Tồn kho<input required type="number" min="0" value={form.stock} onChange={(event) => update("stock", event.target.value)} /></label></div><div className="form-grid"><label>Đánh giá<input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(event) => update("rating", event.target.value)} /></label><label>Danh mục<select required value={form.category_id || ""} onChange={(event) => update("category_id", event.target.value)}><option value="">Chọn danh mục</option>{categories.map((category) => <option key={category.category_id} value={category.category_id}>{category.category_name}</option>)}</select></label></div><label>Ảnh sản phẩm<input value={form.image || ""} onChange={(event) => update("image", event.target.value)} placeholder="https://..." /></label><div className="modal-actions"><button type="button" onClick={onClose}>Hủy</button><button className="primary-button" type="submit">Lưu sản phẩm</button></div></form></Modal>; }
/**
 * Hồ sơ người dùng phía quản trị.
 *
 * Ngoài thông tin tài khoản, tải thêm lịch sử đơn hàng của chính khách này —
 * nhân viên thường cần tra cứu "khách này đã mua gì, còn đơn nào chưa trả tiền"
 * ngay tại chỗ thay vì mở sang trang quản lý đơn rồi tự lọc.
 */
function UserModal({ user, onClose }) {
    const { user: authUser } = useAuth();

    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function loadOrders() {
            try {
                setLoadingOrders(true);
                const token = await authUser.getIdToken();
                const result = await getUserOrders(token, user.customer_id);
                if (!cancelled) setOrders(result.data || []);
            } catch (err) {
                console.error("[UserModal] Không tải được đơn hàng:", err);
                if (!cancelled) setOrders([]);
            } finally {
                if (!cancelled) setLoadingOrders(false);
            }
        }

        loadOrders();
        return () => { cancelled = true; };
    }, [authUser, user.customer_id]);

    const totalSpent = orders
        .filter((o) => ["PAID", "COMPLETED"].includes(o.status))
        .reduce((s, o) => s + Number(o.total || 0), 0);

    return (
        <Modal title="Hồ sơ người dùng" onClose={onClose}>
            <div className="user-detail">
                <div className="detail-identity">
                    <span className="detail-avatar">{(user.customer_name || "K").slice(0, 1)}</span>
                    <div>
                        <h3>{user.customer_name || "Khách hàng nền"}</h3>
                        <p>{user.email || "Chưa có email"}</p>
                    </div>
                </div>

                <dl>
                    <dt>Mã khách hàng</dt><dd>{user.customer_id}</dd>
                    <dt>Vai trò</dt><dd>{user.role}</dd>
                    <dt>Trạng thái</dt><dd>{user.status}</dd>
                    <dt>Sản phẩm đã mua</dt><dd>{user.bought_products?.length || 0} sản phẩm</dd>
                    <dt>Tổng chi tiêu</dt><dd><strong>{formatPrice(totalSpent)}</strong></dd>
                </dl>

                <h4 style={{ margin: "20px 0 10px", fontSize: "15px" }}>
                    Đơn hàng của khách ({orders.length})
                </h4>

                {loadingOrders ? (
                    <p style={{ color: "#64748b", fontSize: "14px" }}>Đang tải đơn hàng...</p>
                ) : orders.length === 0 ? (
                    <p style={{ color: "#64748b", fontSize: "14px" }}>Khách hàng này chưa đặt đơn nào.</p>
                ) : (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", maxHeight: "260px", overflowY: "auto" }}>
                        {orders.map((o) => {
                            const info = statusInfo(o.status);
                            return (
                                <div key={o.order_id} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
                                    <code style={{ fontWeight: "bold", color: "#2563eb", fontSize: "13px" }}>{o.order_id}</code>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: "13px", color: "#64748b" }}>
                                            {o.item_count} sản phẩm · {o.total_quantity} món
                                        </div>
                                        <div style={{ fontSize: "12px", color: "#94a3b8" }}>{dateText(o.created_at)}</div>
                                    </div>
                                    <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold", color: info.color, background: info.bg, whiteSpace: "nowrap" }}>
                                        {info.label}
                                    </span>
                                    <strong style={{ color: "#dc2626", fontSize: "14px", whiteSpace: "nowrap" }}>
                                        {formatPrice(o.total)}
                                    </strong>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default AdminDashboard;
