import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import {
    createOrder,
    createOrderBuyNow,
    getMyProfile,
    getPaymentMethods,
    formatPrice,
} from "../services/shopService";
import { getProductById } from "../services/productService";

/**
 * Trang đặt hàng: nhập thông tin người nhận rồi tạo đơn.
 *
 * Không có bước thanh toán online — đơn tạo ra ở trạng thái "Chờ thanh toán",
 * khách cầm mã đơn tới cửa hàng trả tiền, nhân viên xác nhận trên trang quản trị.
 *
 * Trang này chạy ở HAI CHẾ ĐỘ:
 *
 *  1. Đặt từ giỏ — vào thẳng /checkout, lấy toàn bộ hàng trong giỏ.
 *  2. Mua ngay  — vào /checkout?muaNgay=<mã sản phẩm>&sl=<số lượng>, chỉ gồm
 *     đúng món đó, KHÔNG đụng gì tới giỏ hàng.
 *
 * Vì sao nhận biết chế độ qua ĐƯỜNG DẪN chứ không phải state của router: state
 * mất khi tải lại trang, còn nhớ tạm trong bộ nhớ trình duyệt thì lại lẫn sang
 * lượt sau — khách bấm mua ngay rồi bỏ ngang, lát sau vào giỏ bấm đặt hàng sẽ
 * thấy nhầm món cũ. Để trên đường dẫn thì F5 vẫn đúng và vào từ giỏ cũng đúng.
 */
const SL_TOI_DA = 99;

/**
 * Danh sách dựng sẵn để trang hiện được ngay, không phải chờ gọi API.
 * Máy chủ trả về danh sách thật (kèm cờ `available`) rồi ghi đè lên.
 */
const MAC_DINH_PHUONG_THUC = [
    {
        value: "COD",
        label: "Tiền mặt tại cửa hàng",
        description: "Mang mã đơn tới cửa hàng trả tiền, nhân viên xác nhận giúp bạn.",
        icon: "💵",
        available: true,
    },
    {
        value: "BANK_QR",
        label: "Chuyển khoản quét mã QR",
        description: "Quét mã bằng app ngân hàng. Hệ thống tự xác nhận ngay khi nhận được tiền.",
        icon: "📱",
        available: true,
    },
];

function Checkout() {
    const { user, customer } = useAuth();
    const { cart, refreshCart } = useCart();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const muaNgayId = searchParams.get("muaNgay");
    const laMuaNgay = Boolean(muaNgayId);
    const muaNgaySl = Math.min(
        Math.max(1, parseInt(searchParams.get("sl"), 10) || 1),
        SL_TOI_DA
    );

    // Thông tin hiển thị của món "mua ngay". Đường thường thì trang trước đã gửi
    // kèm nên khỏi gọi API; mất state (F5) mới phải tải lại theo mã trên URL.
    const [muaNgayItem, setMuaNgayItem] = useState(() => {
        const guiKem = location.state?.muaNgay;
        return guiKem && guiKem.productId === muaNgayId ? guiKem : null;
    });
    const [dangTaiItem, setDangTaiItem] = useState(laMuaNgay && !location.state?.muaNgay);

    const [form, setForm] = useState({ receiverName: "", phone: "", address: "", note: "" });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Cách thanh toán. Mặc định trả tiền mặt vì đó là cách luôn dùng được —
    // chuyển khoản còn phụ thuộc cửa hàng đã khai báo tài khoản nhận tiền chưa.
    const [phuongThuc, setPhuongThuc] = useState("COD");
    const [phuongThucList, setPhuongThucList] = useState(MAC_DINH_PHUONG_THUC);

    // Đặt hàng xong thì backend dọn sạch giỏ. Nếu không có cờ này, effect
    // "giỏ rỗng → quay về /cart" bên dưới sẽ chạy đè lên lệnh chuyển sang
    // trang chi tiết đơn, khiến khách đặt hàng xong lại thấy giỏ hàng trống.
    const [placed, setPlaced] = useState(false);

    // Điền sẵn từ hồ sơ để khách không phải gõ lại mỗi lần đặt hàng
    useEffect(() => {
        let cancelled = false;

        async function prefill() {
            try {
                const token = await user.getIdToken();
                const { data } = await getMyProfile(token);
                if (cancelled) return;
                setForm((f) => ({
                    ...f,
                    receiverName: data.customer_name || customer?.customer_name || "",
                    phone: data.phone || "",
                    address: data.address || "",
                }));
            } catch (err) {
                console.error("[Checkout] Không tải được hồ sơ:", err);
            }
        }

        if (user) prefill();
        return () => {
            cancelled = true;
        };
    }, [user, customer]);

    // Hỏi máy chủ xem cửa hàng đang bật những cách trả tiền nào
    useEffect(() => {
        let huy = false;

        (async () => {
            try {
                const token = await user.getIdToken();
                const { data } = await getPaymentMethods(token);
                if (huy || !Array.isArray(data)) return;

                setPhuongThucList(data);

                // Đang chọn cách vừa bị tắt thì kéo về cách còn dùng được,
                // không thì khách bấm đặt hàng sẽ bị máy chủ từ chối.
                const dangChon = data.find((p) => p.value === phuongThuc);
                if (dangChon && !dangChon.available) {
                    setPhuongThuc(data.find((p) => p.available)?.value ?? "COD");
                }
            } catch (err) {
                // Không hỏi được thì dùng danh sách dựng sẵn, trang vẫn đặt hàng được
                console.error("[Checkout] Không tải được cách thanh toán:", err.message);
            }
        })();

        return () => {
            huy = true;
        };
        // Cố ý không phụ thuộc `phuongThuc`: chỉ cần hỏi một lần lúc mở trang
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Tải lại thông tin món "mua ngay" khi state bị mất (khách F5 trang này)
    useEffect(() => {
        if (!laMuaNgay || muaNgayItem) return undefined;

        let cancelled = false;

        (async () => {
            try {
                setDangTaiItem(true);
                const token = user ? await user.getIdToken() : null;
                const { data } = await getProductById(muaNgayId, token);
                if (cancelled) return;
                setMuaNgayItem({
                    productId: data.id,
                    quantity: muaNgaySl,
                    title: data.title,
                    image: data.image,
                    final_price: data.final_price,
                });
            } catch (err) {
                console.error("[Checkout] Không tải được sản phẩm mua ngay:", err);
                if (!cancelled) setError("Không tải được sản phẩm. Bạn thử chọn lại sản phẩm nhé.");
            } finally {
                if (!cancelled) setDangTaiItem(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [laMuaNgay, muaNgayId, muaNgaySl, muaNgayItem, user]);

    // Giỏ rỗng thì không có gì để đặt — trừ khi vừa đặt hàng xong.
    // Chế độ mua ngay không liên quan tới giỏ nên bỏ qua kiểm tra này, không thì
    // khách có giỏ rỗng bấm mua ngay sẽ bị đá về trang giỏ hàng.
    useEffect(() => {
        if (laMuaNgay) return;
        if (!placed && cart.items.length === 0) navigate("/cart", { replace: true });
    }, [laMuaNgay, cart.items.length, navigate, placed]);

    // Danh sách hiển thị + tổng tiền, tuỳ chế độ
    const donGia = Number(muaNgayItem?.final_price ?? 0);
    const items = laMuaNgay
        ? muaNgayItem
            ? [
                  {
                      id: muaNgayItem.productId,
                      title: muaNgayItem.title,
                      image: muaNgayItem.image,
                      final_price: donGia,
                      quantity: muaNgaySl,
                      line_total: donGia * muaNgaySl,
                  },
              ]
            : []
        : cart.items;

    const tongTien = laMuaNgay ? donGia * muaNgaySl : cart.total;

    const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!form.receiverName.trim()) return setError("Vui lòng nhập tên người nhận.");
        if (!/^0\d{8,10}$/.test(form.phone.trim())) {
            return setError("Số điện thoại không hợp lệ (bắt đầu bằng 0, 9–11 chữ số).");
        }
        if (!form.address.trim()) return setError("Vui lòng nhập địa chỉ.");

        if (laMuaNgay && !muaNgayItem) return setError("Chưa có sản phẩm để đặt.");

        try {
            setSubmitting(true);
            setError("");

            const token = await user.getIdToken();

            if (laMuaNgay) {
                // Đặt thẳng một sản phẩm — không đọc, không xoá gì trong giỏ,
                // nên cũng không cần làm mới giỏ sau khi đặt xong.
                const { data } = await createOrderBuyNow(token, {
                    productId: muaNgayId,
                    quantity: muaNgaySl,
                    paymentMethod: phuongThuc,
                    ...form,
                });
                navigate(`/orders/${data.order_id}`, { replace: true });
                return;
            }

            const { data } = await createOrder(token, { ...form, paymentMethod: phuongThuc });

            setPlaced(true); // chặn effect "giỏ rỗng → /cart" trước khi dọn giỏ
            await refreshCart(); // backend đã xoá giỏ, đồng bộ lại badge trên Header
            navigate(`/orders/${data.order_id}`, { replace: true });
        } catch (err) {
            console.error(err);
            setError(err.message || "Đặt hàng thất bại, vui lòng thử lại.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <h1>{laMuaNgay ? "Mua ngay" : "Đặt hàng"}</h1>

            {laMuaNgay && (
                <p style={muaNgayNoteStyle}>
                    Bạn đang mua nhanh một sản phẩm. Đơn này <strong>không lấy hàng trong giỏ</strong> và
                    cũng không thêm gì vào giỏ — thoát ra giữa chừng thì giỏ hàng vẫn nguyên như cũ.
                </p>
            )}

            <div style={{ display: "flex", gap: "30px", marginTop: "20px", flexWrap: "wrap" }}>
                {/* Thông tin người nhận */}
                <form onSubmit={handleSubmit} style={{ flex: "1 1 360px" }}>
                    <h3 style={{ marginBottom: "16px" }}>Thông tin người nhận</h3>

                    {error && <p style={errorStyle}>{error}</p>}

                    <label style={labelStyle}>Họ tên người nhận *</label>
                    <input value={form.receiverName} onChange={update("receiverName")} style={inputStyle} />

                    <label style={labelStyle}>Số điện thoại *</label>
                    <input
                        value={form.phone}
                        onChange={update("phone")}
                        placeholder="0901234567"
                        style={inputStyle}
                    />

                    <label style={labelStyle}>Địa chỉ *</label>
                    <textarea
                        value={form.address}
                        onChange={update("address")}
                        rows={3}
                        style={{ ...inputStyle, resize: "vertical" }}
                    />

                    <label style={labelStyle}>Ghi chú</label>
                    <textarea
                        value={form.note}
                        onChange={update("note")}
                        rows={2}
                        placeholder="Ví dụ: giao giờ hành chính"
                        style={{ ...inputStyle, resize: "vertical" }}
                    />

                    <h3 style={{ marginTop: "26px", marginBottom: "10px" }}>Cách thanh toán</h3>

                    <div style={styleDsPhuongThuc}>
                        {phuongThucList.map((pt) => {
                            const dangChon = phuongThuc === pt.value;
                            const khoa = !pt.available;

                            return (
                                <label
                                    key={pt.value}
                                    style={{
                                        ...styleThePhuongThuc,
                                        ...(dangChon ? styleThePhuongThucChon : {}),
                                        ...(khoa ? styleThePhuongThucKhoa : {}),
                                    }}
                                >
                                    <input
                                        type="radio"
                                        name="phuongThuc"
                                        value={pt.value}
                                        checked={dangChon}
                                        disabled={khoa}
                                        onChange={() => setPhuongThuc(pt.value)}
                                        style={{ marginTop: "3px" }}
                                    />
                                    <span style={{ fontSize: "22px", lineHeight: 1 }}>{pt.icon}</span>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <strong style={{ display: "block", color: khoa ? "#9aa5b4" : "#1f2d3d" }}>
                                            {pt.label}
                                        </strong>
                                        <span style={{ fontSize: "13px", color: "#6b7a90", lineHeight: 1.5 }}>
                                            {pt.description}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>

                    {/* Nhắc trước điều gì sẽ xảy ra sau khi bấm đặt hàng */}
                    <div style={noticeStyle}>
                        {phuongThuc === "BANK_QR" ? (
                            <>
                                <strong>📱 Bước tiếp theo: quét mã QR</strong>
                                <p style={{ margin: "8px 0 0", color: "#666", fontSize: "14px" }}>
                                    Đặt xong sẽ hiện <strong>mã QR</strong> có sẵn số tiền và nội dung. Bạn quét
                                    bằng app ngân hàng, chuyển xong thì đơn <strong>tự chuyển sang Đã thanh
                                    toán</strong> trong vài giây — không cần chờ nhân viên duyệt.
                                </p>
                            </>
                        ) : (
                            <>
                                <strong>💵 Thanh toán tại cửa hàng</strong>
                                <p style={{ margin: "8px 0 0", color: "#666", fontSize: "14px" }}>
                                    Sau khi đặt, bạn sẽ nhận được <strong>mã đơn hàng</strong>. Mang mã này tới
                                    cửa hàng để thanh toán. Nhân viên xác nhận xong, đơn sẽ chuyển sang trạng
                                    thái <strong>Đã thanh toán</strong>.
                                </p>
                            </>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || items.length === 0}
                        style={submitButton(submitting || items.length === 0)}
                    >
                        {submitting ? "Đang tạo đơn..." : "Xác nhận đặt hàng"}
                    </button>
                </form>

                {/* Tóm tắt đơn */}
                <div style={{ flex: "1 1 320px" }}>
                    <h3 style={{ marginBottom: "16px" }}>Đơn hàng của bạn</h3>

                    <div style={{ border: "1px solid #eee", borderRadius: "10px", padding: "16px" }}>
                        {dangTaiItem ? (
                            <p style={{ color: "#888", margin: 0 }}>Đang tải sản phẩm...</p>
                        ) : items.length === 0 ? (
                            <p style={{ color: "#888", margin: 0 }}>Chưa có sản phẩm nào.</p>
                        ) : (
                            items.map((item) => (
                                <div key={item.id} style={summaryRow}>
                                    <img src={item.image} alt={item.title} style={summaryThumb} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: "14px" }}>{item.title}</div>
                                        <div style={{ color: "#888", fontSize: "13px" }}>
                                            {formatPrice(item.final_price)} × {item.quantity}
                                        </div>
                                    </div>
                                    <strong style={{ fontSize: "14px", whiteSpace: "nowrap" }}>
                                        {formatPrice(item.line_total)}
                                    </strong>
                                </div>
                            ))
                        )}

                        <div style={totalRow}>
                            <span>Tổng cộng</span>
                            <strong style={{ fontSize: "22px", color: "#e53935" }}>
                                {formatPrice(tongTien)}
                            </strong>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

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

const errorStyle = {
    color: "#c62828",
    background: "#ffebee",
    padding: "10px 14px",
    borderRadius: "6px",
    margin: "0 0 12px",
};

const styleDsPhuongThuc = { display: "flex", flexDirection: "column", gap: "10px" };

const styleThePhuongThuc = {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "14px",
    border: "1px solid #d5dce6",
    borderRadius: "10px",
    cursor: "pointer",
    background: "white",
    transition: "border-color .15s, background .15s",
};

const styleThePhuongThucChon = { border: "2px solid #1976d2", background: "#f2f8fe", padding: "13px" };

const styleThePhuongThucKhoa = { background: "#f6f7f9", cursor: "not-allowed", borderStyle: "dashed" };

const muaNgayNoteStyle = {
    marginTop: "10px",
    padding: "10px 14px",
    background: "#fff8e1",
    border: "1px solid #ffe0a3",
    borderRadius: "8px",
    color: "#6b5320",
    fontSize: "14px",
    lineHeight: 1.6,
};

const noticeStyle = {
    marginTop: "20px",
    padding: "16px",
    background: "#e8f5e9",
    border: "1px solid #c8e6c9",
    borderRadius: "8px",
};

const submitButton = (busy) => ({
    width: "100%",
    marginTop: "20px",
    padding: "14px",
    background: busy ? "#90caf9" : "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: busy ? "default" : "pointer",
    fontWeight: "bold",
    fontSize: "16px",
});

const summaryRow = {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    paddingBottom: "12px",
    marginBottom: "12px",
    borderBottom: "1px solid #f0f0f0",
};

const summaryThumb = { width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px" };

const totalRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "8px",
};

export default Checkout;
