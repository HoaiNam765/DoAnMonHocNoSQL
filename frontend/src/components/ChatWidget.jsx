import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { sendChatMessage } from "../services/chatService";

/**
 * Khung chat tư vấn nổi ở góc phải màn hình.
 *
 * Trợ lý CHỈ tra cứu sản phẩm — nó không tự thêm hàng vào giỏ. Khi tìm được,
 * giao diện dựng thẻ sản phẩm kèm nút "Thêm vào giỏ" để KHÁCH tự bấm, đi qua
 * đúng API giỏ hàng có xác thực như mọi chỗ khác trong web. Nhờ vậy không có
 * đường nào để trợ lý thao tác thay khách ngoài ý muốn.
 */

const GOI_Y = [
    "Sản phẩm dưới 500k",
    "Shop có những danh mục nào?",
    "Tìm sản phẩm rẻ nhất",
];

const LOI_CHAO = {
    role: "model",
    text: "Chào bạn 👋 Mình là trợ lý của shop. Bạn đang tìm sản phẩm gì? Cứ nói khoảng giá hoặc loại hàng, mình tìm giúp nhé!",
    products: [],
};

function ChatWidget() {
    const { user } = useAuth();
    const { addItem } = useCart();
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([LOI_CHAO]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [addingId, setAddingId] = useState(null);
    const [addedId, setAddedId] = useState(null);

    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // Luôn cuộn xuống tin nhắn mới nhất
    useEffect(() => {
        if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, open, sending]);

    // Mở khung thì đưa con trỏ vào ô nhập luôn cho tiện gõ
    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    const send = async (text) => {
        const cauHoi = String(text ?? "").trim();
        if (!cauHoi || sending) return;

        setError("");
        setInput("");

        // Lịch sử gửi lên backend là các lượt TRƯỚC câu hỏi này
        const history = messages
            .filter((m) => m.text)
            .slice(-8)
            .map((m) => ({ role: m.role, text: m.text }));

        setMessages((prev) => [...prev, { role: "user", text: cauHoi, products: [] }]);
        setSending(true);

        try {
            const data = await sendChatMessage(cauHoi, history);
            setMessages((prev) => [
                ...prev,
                { role: "model", text: data.reply, products: data.products ?? [] },
            ]);
        } catch (err) {
            setError(err.message || "Không gửi được câu hỏi.");
        } finally {
            setSending(false);
        }
    };

    const themVaoGio = async (product) => {
        if (!user) {
            setOpen(false);
            return navigate("/login");
        }

        try {
            setAddingId(product.id);
            await addItem(product.id, 1);
            setAddedId(product.id);
            setTimeout(() => setAddedId(null), 1500);
        } catch (err) {
            setError(err.message || "Không thêm được vào giỏ hàng.");
        } finally {
            setAddingId(null);
        }
    };

    // ---------------------------------------------------------------- nút nổi
    if (!open) {
        return (
            <button style={styles.fab} onClick={() => setOpen(true)} title="Trợ lý tư vấn">
                <span style={{ fontSize: "26px" }}>💬</span>
            </button>
        );
    }

    // ------------------------------------------------------------- khung chat
    return (
        <div style={styles.panel}>
            <div style={styles.header}>
                <div>
                    <div style={{ fontWeight: 600 }}>Trợ lý tư vấn</div>
                    <div style={styles.headerSub}>Hỏi mình về sản phẩm nhé</div>
                </div>
                <button style={styles.closeBtn} onClick={() => setOpen(false)} title="Đóng">
                    ✕
                </button>
            </div>

            <div style={styles.body}>
                {messages.map((msg, index) => (
                    <div key={index}>
                        <div style={msg.role === "user" ? styles.bubbleUser : styles.bubbleBot}>
                            {msg.text}
                        </div>

                        {msg.products?.length > 0 && (
                            <div style={styles.productList}>
                                {msg.products.map((product) => (
                                    <div key={product.id} style={styles.productCard}>
                                        <Link to={`/product/${product.id}`} onClick={() => setOpen(false)}>
                                            <img
                                                src={product.image}
                                                alt={product.title}
                                                style={styles.productImage}
                                            />
                                        </Link>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <Link
                                                to={`/product/${product.id}`}
                                                onClick={() => setOpen(false)}
                                                style={styles.productTitle}
                                                title={product.title}
                                            >
                                                {product.title}
                                            </Link>

                                            <div style={styles.productPrice}>
                                                {Number(product.final_price).toLocaleString("vi-VN")} đ
                                            </div>

                                            <div style={styles.productMeta}>
                                                ★ {Number(product.rating || 0).toFixed(1)}
                                                {product.category_name ? ` · ${product.category_name}` : ""}
                                            </div>

                                            <button
                                                style={{
                                                    ...styles.addBtn,
                                                    ...(product.stock === 0 ? styles.addBtnDisabled : {}),
                                                    ...(addedId === product.id ? styles.addBtnAdded : {}),
                                                }}
                                                onClick={() => themVaoGio(product)}
                                                disabled={addingId === product.id || product.stock === 0}
                                            >
                                                {product.stock === 0
                                                    ? "Hết hàng"
                                                    : addedId === product.id
                                                      ? "✓ Đã thêm"
                                                      : addingId === product.id
                                                        ? "Đang thêm..."
                                                        : "🛒 Thêm vào giỏ"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {sending && <div style={styles.bubbleBot}>Đang tìm giúp bạn...</div>}

                {error && <div style={styles.error}>{error}</div>}

                {/* Gợi ý câu hỏi — chỉ hiện lúc mới mở, khi chưa hỏi gì */}
                {messages.length === 1 && !sending && (
                    <div style={styles.suggestions}>
                        {GOI_Y.map((goiY) => (
                            <button key={goiY} style={styles.suggestionBtn} onClick={() => send(goiY)}>
                                {goiY}
                            </button>
                        ))}
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            <form
                style={styles.inputRow}
                onSubmit={(event) => {
                    event.preventDefault();
                    send(input);
                }}
            >
                <input
                    ref={inputRef}
                    style={styles.input}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ví dụ: áo thun dưới 300k"
                    maxLength={500}
                    disabled={sending}
                />
                <button type="submit" style={styles.sendBtn} disabled={sending || !input.trim()}>
                    Gửi
                </button>
            </form>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Style — để inline cho khớp cách các component khác trong dự án đang làm
// ---------------------------------------------------------------------------
const styles = {
    fab: {
        position: "fixed",
        right: "24px",
        bottom: "24px",
        width: "58px",
        height: "58px",
        borderRadius: "50%",
        background: "#1976d2",
        color: "white",
        border: "none",
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        zIndex: 1000,
    },
    panel: {
        position: "fixed",
        right: "24px",
        bottom: "24px",
        width: "min(380px, calc(100vw - 32px))",
        height: "min(560px, calc(100vh - 48px))",
        background: "white",
        borderRadius: "12px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 1000,
    },
    header: {
        background: "#1976d2",
        color: "white",
        padding: "12px 16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    headerSub: { fontSize: "12px", opacity: 0.85 },
    closeBtn: {
        background: "transparent",
        border: "none",
        color: "white",
        fontSize: "18px",
        cursor: "pointer",
        lineHeight: 1,
    },
    body: {
        flex: 1,
        overflowY: "auto",
        padding: "14px",
        background: "#f7f9fc",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    bubbleBot: {
        background: "white",
        border: "1px solid #e3e8ef",
        borderRadius: "10px",
        padding: "10px 12px",
        fontSize: "14px",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        alignSelf: "flex-start",
        maxWidth: "90%",
    },
    bubbleUser: {
        background: "#1976d2",
        color: "white",
        borderRadius: "10px",
        padding: "10px 12px",
        fontSize: "14px",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        alignSelf: "flex-end",
        maxWidth: "90%",
        marginLeft: "auto",
    },
    productList: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" },
    productCard: {
        display: "flex",
        gap: "10px",
        background: "white",
        border: "1px solid #e3e8ef",
        borderRadius: "10px",
        padding: "8px",
    },
    productImage: {
        width: "62px",
        height: "62px",
        objectFit: "cover",
        borderRadius: "6px",
        display: "block",
    },
    productTitle: {
        fontSize: "13px",
        fontWeight: 600,
        color: "#1f2d3d",
        textDecoration: "none",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
    },
    productPrice: { color: "#d32f2f", fontWeight: 700, fontSize: "14px", marginTop: "2px" },
    productMeta: { fontSize: "11px", color: "#6b7a90", marginBottom: "6px" },
    addBtn: {
        width: "100%",
        padding: "6px 8px",
        fontSize: "12px",
        border: "1px solid #1976d2",
        background: "white",
        color: "#1976d2",
        borderRadius: "6px",
        cursor: "pointer",
    },
    addBtnDisabled: { borderColor: "#c4ccd8", color: "#9aa5b4", cursor: "not-allowed" },
    addBtnAdded: { background: "#e8f5e9", borderColor: "#43a047", color: "#2e7d32" },
    suggestions: { display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" },
    suggestionBtn: {
        background: "white",
        border: "1px solid #1976d2",
        color: "#1976d2",
        borderRadius: "16px",
        padding: "6px 12px",
        fontSize: "12px",
        cursor: "pointer",
    },
    error: {
        background: "#fdecea",
        border: "1px solid #f5c2c0",
        color: "#b3261e",
        borderRadius: "8px",
        padding: "8px 10px",
        fontSize: "13px",
    },
    inputRow: {
        display: "flex",
        gap: "8px",
        padding: "10px",
        borderTop: "1px solid #e3e8ef",
        background: "white",
    },
    input: {
        flex: 1,
        padding: "9px 12px",
        border: "1px solid #cbd4e1",
        borderRadius: "20px",
        fontSize: "14px",
        outline: "none",
    },
    sendBtn: {
        padding: "9px 16px",
        background: "#1976d2",
        color: "white",
        border: "none",
        borderRadius: "20px",
        fontSize: "14px",
        cursor: "pointer",
    },
};

export default ChatWidget;
