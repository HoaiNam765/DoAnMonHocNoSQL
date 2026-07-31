function AdminStatCard({ label, value, note, accent }) {
    return (
        <article className={`admin-stat-card ${accent || ""}`}>
            <div className="stat-label">{label}</div>
            <strong>{value}</strong>
            <span>{note}</span>
        </article>
    );
}

export default AdminStatCard;
