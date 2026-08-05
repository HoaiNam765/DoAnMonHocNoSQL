import { useEffect, useState } from "react";

/**
 * Khung sửa THUỘC TÍNH TUỲ Ý của sản phẩm.
 *
 * Admin tự đặt tên thuộc tính ("Mô tả", "Xuất xứ", "Bảo hành"...) — không có
 * danh sách cố định nào ở phía giao diện lẫn cơ sở dữ liệu. Đây là phần thể
 * hiện tính schema-less của Neo4j: hai sản phẩm cùng nhãn :Product vẫn có thể
 * mang hai bộ thuộc tính hoàn toàn khác nhau.
 *
 * Component này KHÔNG tự gọi API. Nó chỉ giữ danh sách dòng và báo ra ngoài qua
 * `onChange`, còn việc lưu do modal cha lo cùng lúc với các trường khác — để
 * admin bấm "Lưu" một lần là xong, không phải lưu hai chỗ.
 */

/** Vài tên hay dùng, bấm là thêm nhanh — chỉ là gợi ý, admin gõ tên gì cũng được. */
const GOI_Y = ["Mô tả", "Xuất xứ", "Bảo hành", "Chất liệu", "Khối lượng", "Kích thước"];

/** Cho admin thấy trước giá trị sẽ được lưu thành kiểu gì. */
const doanKieu = (giaTri) => {
    const sach = String(giaTri ?? "").trim();
    if (sach === "") return null;
    if (["true", "false"].includes(sach.toLowerCase())) return "đúng/sai";
    if (/^-?\d+(\.\d+)?$/.test(sach) && !/^0\d/.test(sach)) return "số";
    return "chữ";
};

function ProductAttributes({ value, onChange }) {
    // Dùng mảng chứ không dùng object: object không giữ được dòng đang gõ dở tên,
    // và hai dòng cùng để trống tên sẽ đè lên nhau.
    const [dong, setDong] = useState([]);

    // Nạp từ dữ liệu ngoài vào đúng một lần cho mỗi sản phẩm
    useEffect(() => {
        setDong(
            Object.entries(value ?? {}).map(([ten, giaTri]) => ({
                ten,
                giaTri: String(giaTri),
                tenGoc: ten, // nhớ tên cũ để biết đường xoá khi admin đổi tên
            }))
        );
    }, [value]);

    const capNhat = (dongMoi) => {
        setDong(dongMoi);
        onChange(dongMoi);
    };

    const suaDong = (i, truong, giaTri) => {
        const banSao = [...dong];
        banSao[i] = { ...banSao[i], [truong]: giaTri };
        capNhat(banSao);
    };

    const themDong = (ten = "") => capNhat([...dong, { ten, giaTri: "", tenGoc: null }]);
    const xoaDong = (i) => capNhat(dong.filter((_, j) => j !== i));

    const daDung = new Set(dong.map((d) => d.ten.trim()).filter(Boolean));

    return (
        <div style={styles.khung}>
            <div style={styles.dau}>
                <strong style={styles.tieuDe}>Thuộc tính tuỳ ý</strong>
                <span style={styles.moTa}>
                    Tự đặt tên thuộc tính bất kỳ — sẽ hiện ở trang chi tiết sản phẩm
                </span>
            </div>

            {dong.length === 0 && (
                <p style={styles.trong}>Chưa có thuộc tính nào. Thêm bằng nút bên dưới.</p>
            )}

            {dong.map((d, i) => {
                const kieu = doanKieu(d.giaTri);
                return (
                    <div key={i} style={styles.hang}>
                        <input
                            style={styles.oTen}
                            placeholder="Tên (vd: Mô tả)"
                            value={d.ten}
                            onChange={(e) => suaDong(i, "ten", e.target.value)}
                        />
                        <input
                            style={styles.oGiaTri}
                            placeholder="Giá trị"
                            value={d.giaTri}
                            onChange={(e) => suaDong(i, "giaTri", e.target.value)}
                        />
                        {kieu && <span style={styles.nhanKieu}>{kieu}</span>}
                        <button
                            type="button"
                            style={styles.nutXoa}
                            onClick={() => xoaDong(i)}
                            title="Xoá thuộc tính này"
                        >
                            ✕
                        </button>
                    </div>
                );
            })}

            <div style={styles.goiY}>
                <button type="button" style={styles.nutThem} onClick={() => themDong()}>
                    + Thêm thuộc tính
                </button>

                {GOI_Y.filter((g) => !daDung.has(g)).map((g) => (
                    <button key={g} type="button" style={styles.chip} onClick={() => themDong(g)}>
                        {g}
                    </button>
                ))}
            </div>
        </div>
    );
}

const styles = {
    khung: {
        marginTop: "14px",
        padding: "12px 14px",
        border: "1px dashed #c9d3e0",
        borderRadius: "10px",
        background: "#fafcff",
    },
    dau: { marginBottom: "10px" },
    tieuDe: { fontSize: "14px", color: "#1f2d3d" },
    moTa: { display: "block", fontSize: "12px", color: "#7b8794", marginTop: "2px" },
    trong: { fontSize: "13px", color: "#8b97a6", margin: "6px 0 10px" },
    hang: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" },
    oTen: {
        flex: "0 0 34%",
        padding: "7px 10px",
        border: "1px solid #cbd4e1",
        borderRadius: "6px",
        fontSize: "13px",
    },
    oGiaTri: {
        flex: 1,
        minWidth: 0,
        padding: "7px 10px",
        border: "1px solid #cbd4e1",
        borderRadius: "6px",
        fontSize: "13px",
    },
    nhanKieu: {
        flexShrink: 0,
        fontSize: "11px",
        color: "#1976d2",
        background: "#e8f1fc",
        border: "1px solid #bcd9f7",
        borderRadius: "10px",
        padding: "2px 8px",
    },
    nutXoa: {
        flexShrink: 0,
        border: "none",
        background: "transparent",
        color: "#b3261e",
        cursor: "pointer",
        fontSize: "15px",
        padding: "4px 6px",
    },
    goiY: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" },
    nutThem: {
        padding: "6px 12px",
        border: "1px solid #1976d2",
        background: "#1976d2",
        color: "white",
        borderRadius: "6px",
        fontSize: "12px",
        cursor: "pointer",
    },
    chip: {
        padding: "6px 10px",
        border: "1px dashed #a9b6c6",
        background: "white",
        color: "#5b6b7f",
        borderRadius: "14px",
        fontSize: "12px",
        cursor: "pointer",
    },
};

export default ProductAttributes;
