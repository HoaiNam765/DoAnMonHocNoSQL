import { useEffect, useState } from "react";
import { getCategories } from "../services/productService";

/**
 * Thanh lọc theo danh mục + khoảng giá, dùng chung cho danh sách sản phẩm,
 * danh sách gợi ý và danh sách bán chạy.
 *
 * Component này KHÔNG tự gọi API sản phẩm — nó chỉ báo bộ lọc mới ra ngoài qua
 * `onChange`, còn việc tải lại dữ liệu do trang cha lo. Nhờ vậy cùng một thanh
 * lọc dùng được cho ba danh sách chạy ba câu truy vấn khác nhau.
 *
 * Danh mục được nạp một lần rồi giữ lại trong state — danh sách này hiếm khi
 * đổi nên không cần gọi lại mỗi lần lọc.
 */

/** Mức giá gợi ý sẵn, hợp với thang giá thật của cửa hàng (1.000đ – 23 triệu). */
const MUC_GIA = [
    { nhan: "Tất cả", min: "", max: "" },
    { nhan: "Dưới 100k", min: "", max: "100000" },
    { nhan: "100k – 500k", min: "100000", max: "500000" },
    { nhan: "500k – 1 triệu", min: "500000", max: "1000000" },
    { nhan: "Trên 1 triệu", min: "1000000", max: "" },
];

/** Kiểu sắp xếp. Chuỗi rỗng = giữ thứ tự mặc định của từng danh sách. */
const SAP_XEP = [
    { nhan: "Mặc định", value: "" },
    { nhan: "Giá thấp → cao", value: "gia_tang" },
    { nhan: "Giá cao → thấp", value: "gia_giam" },
];

function ProductFilters({ value, onChange, compact = false }) {
    const { categoryId = "", minPrice = "", maxPrice = "", sort = "" } = value ?? {};

    const [categories, setCategories] = useState([]);
    const [moRong, setMoRong] = useState(false);

    useEffect(() => {
        let huy = false;

        getCategories()
            .then((ket) => {
                if (!huy) setCategories(ket.data ?? []);
            })
            .catch((err) => {
                // Không lấy được danh mục thì chỉ mất ô lọc danh mục, phần còn
                // lại của trang vẫn dùng bình thường — không nên làm hỏng cả trang.
                console.error("[Filters] Không tải được danh mục:", err);
            });

        return () => {
            huy = true;
        };
    }, []);

    const capNhat = (thayDoi) => onChange({ categoryId, minPrice, maxPrice, sort, ...thayDoi });

    const dangLoc = Boolean(categoryId) || minPrice !== "" || maxPrice !== "" || sort !== "";

    /** Mức giá dựng sẵn nào đang khớp với khoảng giá hiện tại (để tô đậm nút). */
    const mucDangChon = MUC_GIA.findIndex(
        (m) => String(m.min) === String(minPrice) && String(m.max) === String(maxPrice)
    );

    return (
        <div style={{ ...styles.wrap, ...(compact ? styles.wrapCompact : {}) }}>
            <div style={styles.hang}>
                <select
                    style={styles.select}
                    value={categoryId}
                    onChange={(e) => capNhat({ categoryId: e.target.value })}
                >
                    <option value="">Tất cả danh mục</option>
                    {categories.map((c) => (
                        <option key={c.category_id} value={c.category_id}>
                            {c.category_name} ({c.product_count})
                        </option>
                    ))}
                </select>

                <div style={styles.mucGia}>
                    {MUC_GIA.map((m, i) => (
                        <button
                            key={m.nhan}
                            type="button"
                            style={{
                                ...styles.chip,
                                ...(mucDangChon === i ? styles.chipChon : {}),
                            }}
                            onClick={() => capNhat({ minPrice: m.min, maxPrice: m.max })}
                        >
                            {m.nhan}
                        </button>
                    ))}
                </div>

                <select
                    style={styles.select}
                    value={sort}
                    onChange={(e) => capNhat({ sort: e.target.value })}
                    title="Sắp xếp theo giá"
                >
                    {SAP_XEP.map((s) => (
                        <option key={s.value} value={s.value}>
                            {s.value === "" ? "Sắp xếp: Mặc định" : `Sắp xếp: ${s.nhan}`}
                        </option>
                    ))}
                </select>

                <button type="button" style={styles.link} onClick={() => setMoRong((v) => !v)}>
                    {moRong ? "Ẩn giá tuỳ chọn" : "Giá tuỳ chọn"}
                </button>

                {dangLoc && (
                    <button
                        type="button"
                        style={styles.xoa}
                        onClick={() => onChange({ categoryId: "", minPrice: "", maxPrice: "", sort: "" })}
                    >
                        ✕ Bỏ lọc
                    </button>
                )}
            </div>

            {moRong && (
                <div style={styles.hangPhu}>
                    <label style={styles.label}>
                        Từ
                        <input
                            style={styles.input}
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="0"
                            value={minPrice}
                            onChange={(e) => capNhat({ minPrice: e.target.value })}
                        />
                        đ
                    </label>

                    <label style={styles.label}>
                        đến
                        <input
                            style={styles.input}
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="không giới hạn"
                            value={maxPrice}
                            onChange={(e) => capNhat({ maxPrice: e.target.value })}
                        />
                        đ
                    </label>
                </div>
            )}
        </div>
    );
}

const styles = {
    wrap: {
        background: "white",
        border: "1px solid #e3e8ef",
        borderRadius: "10px",
        padding: "12px 14px",
        marginBottom: "16px",
    },
    wrapCompact: { padding: "10px 12px", marginBottom: "12px", background: "#fbfcfe" },
    hang: { display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" },
    hangPhu: {
        display: "flex",
        gap: "14px",
        alignItems: "center",
        marginTop: "10px",
        paddingTop: "10px",
        borderTop: "1px dashed #e3e8ef",
        flexWrap: "wrap",
    },
    select: {
        padding: "7px 10px",
        border: "1px solid #cbd4e1",
        borderRadius: "8px",
        fontSize: "13px",
        maxWidth: "260px",
        background: "white",
    },
    mucGia: { display: "flex", flexWrap: "wrap", gap: "6px" },
    chip: {
        padding: "6px 12px",
        border: "1px solid #cbd4e1",
        background: "white",
        color: "#42526b",
        borderRadius: "16px",
        fontSize: "12px",
        cursor: "pointer",
    },
    // Ghi lại nguyên thuộc tính `border` chứ không chỉ `borderColor`: trộn dạng
    // viết tắt với dạng tách lẻ cho cùng một thuộc tính khiến React cảnh báo và
    // có thể hiển thị sai khi vẽ lại.
    chipChon: { border: "1px solid #1976d2", background: "#e8f1fc", color: "#1976d2", fontWeight: 600 },
    link: {
        background: "none",
        border: "none",
        color: "#1976d2",
        fontSize: "12px",
        cursor: "pointer",
        textDecoration: "underline",
    },
    xoa: {
        background: "none",
        border: "none",
        color: "#b3261e",
        fontSize: "12px",
        cursor: "pointer",
        marginLeft: "auto",
    },
    label: { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#42526b" },
    input: {
        width: "130px",
        padding: "6px 10px",
        border: "1px solid #cbd4e1",
        borderRadius: "8px",
        fontSize: "13px",
    },
};

export default ProductFilters;
