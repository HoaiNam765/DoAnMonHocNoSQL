import { useEffect, useRef } from "react";
import { apiUrl } from "../config/api";

/**
 * Nghe sự kiện đơn hàng do máy chủ đẩy xuống (SSE), gọi lại `onChange` mỗi khi
 * có đơn thay đổi — nhờ vậy trang tự cập nhật, không phải tải lại web.
 *
 * @param {object} p
 * @param {object} p.user      người dùng Firebase đang đăng nhập (null thì không nghe)
 * @param {Function} p.onChange gọi khi có đơn đổi, nhận { orderId, status, hanhDong }
 * @param {boolean} p.enabled  bật/tắt (mặc định bật)
 */
export function useOrderEvents({ user, onChange, enabled = true }) {
    // Giữ hàm callback trong ref để nó đổi mà KHÔNG làm mở lại kết nối.
    // Nếu đưa thẳng onChange vào mảng phụ thuộc, mỗi lần trang vẽ lại là một
    // hàm mới → đóng/mở luồng liên tục, vừa tốn vừa dễ sót sự kiện.
    const luuOnChange = useRef(onChange);
    useEffect(() => {
        luuOnChange.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if (!enabled || !user) return undefined;

        let nguon = null;
        let dahuy = false;
        let dongHoKetNoiLai = null;

        const moKetNoi = async () => {
            try {
                const token = await user.getIdToken();

                // EventSource không cho đặt header, nên xin "vé" dùng một lần
                // bằng lời gọi có xác thực rồi mới mở luồng bằng vé đó.
                // Không nhét thẳng token vào URL vì token sẽ nằm lại trong log
                // máy chủ và lịch sử trình duyệt.
                const res = await fetch(apiUrl("/events/ticket"), {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) throw new Error(`Không xin được vé (${res.status})`);
                const { data } = await res.json();
                if (dahuy) return;

                nguon = new EventSource(apiUrl(`/events/stream?ticket=${encodeURIComponent(data.ticket)}`));

                const xuLy = (e) => {
                    try {
                        luuOnChange.current?.(JSON.parse(e.data));
                    } catch {
                        luuOnChange.current?.({});
                    }
                };

                nguon.addEventListener("orders_changed", xuLy);      // dành cho admin
                nguon.addEventListener("my_orders_changed", xuLy);   // đơn của chính khách

                nguon.onerror = () => {
                    // Vé chỉ dùng được một lần nên KHÔNG để EventSource tự kết
                    // nối lại (nó sẽ gọi lại đúng URL cũ với vé đã tiêu huỷ).
                    // Đóng hẳn rồi tự xin vé mới sau vài giây.
                    nguon?.close();
                    nguon = null;
                    if (!dahuy) dongHoKetNoiLai = setTimeout(moKetNoi, 5000);
                };
            } catch (err) {
                console.error("[Events] Không mở được luồng sự kiện:", err.message);
                if (!dahuy) dongHoKetNoiLai = setTimeout(moKetNoi, 5000);
            }
        };

        moKetNoi();

        return () => {
            dahuy = true;
            clearTimeout(dongHoKetNoiLai);
            nguon?.close();
        };
    }, [user, enabled]);
}

export default useOrderEvents;
