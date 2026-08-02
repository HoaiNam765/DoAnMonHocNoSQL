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
} from "../../services/adminService";
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

function Overview({ stats, onNavigate }) {
    const summary = stats?.summary || {};
    const revenueSeries = stats?.revenueByPeriod || [];

    const chartPoints = (() => {
        if (!revenueSeries.length) return "";
        const width = 320;
        const height = 160;
        const maxValue = Math.max(...revenueSeries.map((item) => Number(item.revenue || 0)), 1);
        const stepX = width / Math.max(revenueSeries.length - 1, 1);
        return revenueSeries.map((item, index) => {
            const value = Number(item.revenue || 0);
            const x = index * stepX;
            const y = height - (value / maxValue) * (height - 20) - 10;
            return `${x},${y}`;
        }).join(" ");
    })();

    const areaPath = (() => {
        if (!chartPoints) return "";
        const points = chartPoints.split(" ").map((point) => point.split(",").map(Number));
        const height = 160;
        const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join(" ");
        return `${line} L${points[points.length - 1][0]} ${height} L${points[0][0]} ${height} Z`;
    })();

    return <section className="admin-content"><div className="welcome-band"><div><span className="eyebrow">REAL-TIME SNAPSHOT</span><h2>Nhịp vận hành hôm nay</h2><p>Theo dõi sức khỏe cửa hàng và những chuyển động mới nhất.</p></div><button className="primary-button" onClick={() => onNavigate("products")}>Quản lý kho <span>→</span></button></div><div className="stats-grid"><AdminStatCard label="Doanh thu ghi nhận" value={money(summary.total_revenue)} note="Tổng từ các giao dịch BOUGHT" accent="orange" /><AdminStatCard label="Tổng lượt mua" value={Number(summary.total_orders || 0).toLocaleString("vi-VN")} note="Đơn hàng trong đồ thị" accent="blue" /><AdminStatCard label="Khách hàng" value={Number(summary.total_customers || 0).toLocaleString("vi-VN")} note="Tài khoản đang theo dõi" accent="blue" /><AdminStatCard label="Sản phẩm" value={Number(summary.total_products || 0).toLocaleString("vi-VN")} note={`${summary.total_categories || 0} danh mục đang dùng`} accent="violet" /></div><section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">TREND</span><h3>Doanh thu theo thời gian</h3></div><span className="muted">Biểu đồ theo tháng</span></div>{revenueSeries.length ? <div className="revenue-chart"><svg viewBox="0 0 320 160" role="img" aria-label="Doanh thu theo thời gian"><path className="chart-area" d={areaPath} /><polyline className="chart-line" points={chartPoints} /><g>{revenueSeries.map((item, index) => { const value = Number(item.revenue || 0); const width = 320; const height = 160; const maxValue = Math.max(...revenueSeries.map((entry) => Number(entry.revenue || 0)), 1); const stepX = width / Math.max(revenueSeries.length - 1, 1); const x = index * stepX; const y = height - (value / maxValue) * (height - 20) - 10; return <circle key={item.period} className="chart-point" cx={x} cy={y} r="4" />; })}</g></svg><div className="chart-labels">{revenueSeries.map((item) => <span key={item.period}>{item.period}</span>)}</div></div> : <div className="chart-empty">Chưa có dữ liệu doanh thu để hiển thị.</div>}</section><div className="overview-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">PERFORMANCE</span><h3>Doanh thu theo danh mục</h3></div><span className="muted">Xếp theo doanh thu</span></div><div className="revenue-list">{(stats?.categoryRevenue || []).slice(0, 7).map((item, index) => <div className="revenue-row" key={item.category_id}><span className="rank">0{index + 1}</span><div className="revenue-name"><strong>{item.category_name}</strong><span>{item.sold_count || 0} lượt mua</span></div><div className="bar-track"><i style={{ width: `${Math.min(100, ((item.revenue || 0) / Math.max(1, stats.categoryRevenue[0]?.revenue || 1)) * 100)}%` }} /></div><b>{money(item.revenue)}</b></div>)}</div></section><section className="panel"><div className="panel-heading"><div><span className="eyebrow">LATEST ACTIVITY</span><h3>Lượt mua gần nhất</h3></div></div><div className="activity-list">{(stats?.recentOrders || []).slice(0, 5).map((order) => <div className="activity-row" key={`${order.customer_id}-${order.product_id}-${order.bought_at}`}><span className="activity-avatar">{(order.customer_name || "K").slice(0, 1)}</span><div><strong>{order.customer_name || order.customer_id}</strong><span>{order.product_title}</span></div><b>{money(order.final_price)}</b></div>)}</div></section></div></section>;
}

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
function UserModal({ user, onClose }) { return <Modal title="Hồ sơ người dùng" onClose={onClose}><div className="user-detail"><div className="detail-identity"><span className="detail-avatar">{(user.customer_name || "K").slice(0, 1)}</span><div><h3>{user.customer_name || "Khách hàng nền"}</h3><p>{user.email || "Chưa có email"}</p></div></div><dl><dt>Mã khách hàng</dt><dd>{user.customer_id}</dd><dt>Vai trò</dt><dd>{user.role}</dd><dt>Trạng thái</dt><dd>{user.status}</dd><dt>Lượt mua gần đây</dt><dd>{user.bought_products?.length || 0} sản phẩm</dd></dl></div></Modal>; }

export default AdminDashboard;
