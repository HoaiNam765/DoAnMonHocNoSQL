import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import { getProductById } from "../services/productService";

import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import RecommendationList from "../components/RecommendationList";
import ErrorMessage from "../components/ErrorMessage";
import AlertDialog from "../components/AlertDialog";

function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addItem } = useCart();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [buying, setBuying] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const [added, setAdded] = useState(false);

    // Chuỗi khách đang gõ trong ô số lượng, tách khỏi `quantity` đã chuẩn hoá
    const [soLuongNhap, setSoLuongNhap] = useState("1");

    // Thông báo lỗi thao tác — hiện bằng hộp thoại thay cho alert() của trình duyệt
    const [thongBao, setThongBao] = useState(null);

    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        async function loadProduct() {
            try {
                setLoading(true);
                setError(null);

                let token = null;
                if (user) {
                    token = await user.getIdToken();
                }

                const result = await getProductById(id, token);
                setProduct(result.data);
            } catch (err) {
                console.error(err);
                setProduct(null);

                // 404 nghĩa là sản phẩm không tồn tại — đó không phải sự cố hệ
                // thống nên vẫn hiện thông báo cũ. Các lỗi còn lại (mất kết nối,
                // 500) mới hiện hộp lỗi kèm nút thử lại.
                setError(err.status === 404 ? null : err);
            } finally {
                setLoading(false);
            }
        }

        loadProduct();
    }, [id, user, retryCount]);

    /** Nút +/− đổi số lượng thì ô nhập phải đi theo. */
    useEffect(() => {
        setSoLuongNhap(String(quantity));
    }, [quantity]);

    /** Chuẩn hoá giá trị khách gõ khi rời ô. */
    const chotSoLuong = () => {
        const sl = Number(soLuongNhap);

        if (!Number.isInteger(sl) || sl < 1 || sl > 99) {
            setThongBao("Số lượng phải là số nguyên từ 1 đến 99.");
            setSoLuongNhap(String(quantity)); // trả về giá trị hợp lệ gần nhất
            return;
        }

        setQuantity(sl);
    };

    /** Thêm vào giỏ (nút "Thêm vào giỏ"). */
    const handleAddToCart = async () => {
        if (!user) return navigate("/login");

        try {
            setBuying(true);
            await addItem(id, quantity);
            setAdded(true);
            setTimeout(() => setAdded(false), 1800);
        } catch (err) {
            console.error(err);
            setThongBao(err.message || "Không thêm được vào giỏ hàng.");
        } finally {
            setBuying(false);
        }
    };

    /**
     * Mua ngay — đi thẳng sang trang đặt hàng, KHÔNG bỏ vào giỏ.
     *
     * Trước đây nút này thêm sản phẩm vào giỏ rồi mới chuyển trang, dẫn tới hai
     * chuyện khó chịu: khách đổi ý bỏ ngang thì món đó vẫn nằm lại trong giỏ,
     * và lần "mua ngay" sau sẽ hiện kèm cả hàng cũ trong giỏ. Nay mã sản phẩm
     * và số lượng đi theo đường dẫn, đơn chỉ gồm đúng món vừa bấm.
     *
     * Dữ liệu hiển thị gửi kèm qua router state để trang sau khỏi gọi lại API;
     * mất state (khi tải lại trang) thì trang đó tự lấy theo mã trên đường dẫn.
     */
    const handleBuyNow = () => {
        if (!user) return navigate("/login");

        navigate(`/checkout?muaNgay=${encodeURIComponent(id)}&sl=${quantity}`, {
            state: {
                muaNgay: {
                    productId: id,
                    quantity,
                    title: product?.title,
                    image: product?.image,
                    final_price: product?.final_price,
                },
            },
        });
    };

    if (loading) {
        return <h2>Đang tải...</h2>;
    }

    if (error) {
        return (
            <ErrorMessage
                error={error}
                onRetry={() => setRetryCount(retryCount + 1)}
            />
        );
    }

    if (!product) {
        return <h2>Không tìm thấy sản phẩm.</h2>;
    }

    return (
        <>
            <Link
                to="/"
                style={{
                    textDecoration: "none",
                    color: "#1976d2",
                    fontWeight: "bold",
                }}
            >
                ← Quay lại
            </Link>

            <div
                style={{
                    display: "flex",
                    gap: "40px",
                    marginTop: "30px",
                    alignItems: "flex-start",
                }}
            >
                <img
                    src={product.image}
                    alt={product.title}
                    style={{
                        width: "350px",
                        borderRadius: "10px",
                        background: "#fafafa",
                    }}
                />

                <div>
                    <h1>{product.title}</h1>

                    <h2
                        style={{
                            color: "#e53935",
                        }}
                    >
                        {Number(product.final_price).toLocaleString("vi-VN")} đ
                    </h2>

                    <p>
                        <strong>Danh mục:</strong> {product.category_name}
                    </p>

                    <p>
                        <strong>Đánh giá:</strong> ⭐ {product.rating}
                    </p>

                    {/* Chọn số lượng */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "24px" }}>
                        <span style={{ fontWeight: 500 }}>Số lượng</span>
                        <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            disabled={quantity <= 1}
                            style={qtyButton}
                        >
                            −
                        </button>

                        {/* Gõ thẳng số lượng. Giữ nguyên chuỗi khách đang gõ (kể cả
                            lúc rỗng) rồi mới chuẩn hoá khi rời ô, không thì xoá hết
                            để gõ số mới là ô tự nhảy về 1 giữa chừng. */}
                        <input
                            type="number"
                            min="1"
                            max="99"
                            value={soLuongNhap}
                            onChange={(e) => setSoLuongNhap(e.target.value)}
                            onBlur={chotSoLuong}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            style={qtyInput}
                            aria-label="Số lượng mua"
                        />

                        <button
                            onClick={() => setQuantity(Math.min(99, quantity + 1))}
                            disabled={quantity >= 99}
                            style={qtyButton}
                        >
                            +
                        </button>
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginTop: "20px", flexWrap: "wrap" }}>
                        <button
                            onClick={handleAddToCart}
                            disabled={buying}
                            style={{
                                padding: "12px 24px",
                                background: added ? "#2e7d32" : "white",
                                color: added ? "white" : "#2e7d32",
                                border: "2px solid #2e7d32",
                                borderRadius: "6px",
                                fontSize: "16px",
                                fontWeight: "bold",
                                cursor: buying ? "default" : "pointer",
                                transition: "background .2s, color .2s",
                            }}
                        >
                            {added ? "✓ Đã thêm vào giỏ" : "🛒 Thêm vào giỏ"}
                        </button>

                        <button
                            onClick={handleBuyNow}
                            disabled={buying}
                            style={{
                                padding: "12px 32px",
                                background: "#e53935",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "16px",
                                fontWeight: "bold",
                                cursor: buying ? "default" : "pointer",
                            }}
                        >
                            {buying ? "Đang xử lý..." : "Mua ngay"}
                        </button>
                    </div>
                </div>
            </div>
            {/* Thuộc tính tuỳ ý do admin thêm — mỗi sản phẩm một bộ khác nhau,
                không có danh sách cố định nào ở đây. */}
            {Object.keys(product.attributes ?? {}).length > 0 && (
                <div style={thuocTinhKhung}>
                    <h3 style={{ margin: "0 0 14px", fontSize: "18px" }}>Thông tin chi tiết</h3>

                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                            {Object.entries(product.attributes).map(([ten, giaTri]) => (
                                <tr key={ten}>
                                    <td style={thuocTinhTen}>{ten}</td>
                                    <td style={thuocTinhGiaTri}>
                                        {typeof giaTri === "boolean" ? (giaTri ? "Có" : "Không") : String(giaTri)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <hr style={{ margin: "40px 0" }} />

            <RecommendationList productId={id} />

            <AlertDialog
                open={Boolean(thongBao)}
                message={thongBao}
                onClose={() => setThongBao(null)}
            />
        </>
    );
}

const qtyButton = {
    width: "36px",
    height: "36px",
    border: "1px solid #ccc",
    background: "white",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "20px",
};

const thuocTinhKhung = {
    marginTop: "34px",
    padding: "18px 20px",
    border: "1px solid #e3e8ef",
    borderRadius: "10px",
    background: "#fbfcfe",
};

const thuocTinhTen = {
    padding: "9px 12px 9px 0",
    borderBottom: "1px solid #eef1f5",
    color: "#6b7a90",
    fontSize: "14px",
    width: "34%",
    verticalAlign: "top",
    whiteSpace: "nowrap",
};

const thuocTinhGiaTri = {
    padding: "9px 0",
    borderBottom: "1px solid #eef1f5",
    color: "#1f2d3d",
    fontSize: "14px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
};

const qtyInput = {
    width: "64px",
    height: "36px",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "17px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    padding: "0 4px",
    boxSizing: "border-box",
};

export default ProductDetail;