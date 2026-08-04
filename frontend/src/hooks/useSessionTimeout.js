import { useCallback, useEffect, useRef } from "react";

/**
 * Tự động đăng xuất theo hai mốc thời gian độc lập nhau.
 *
 *   1. KHÔNG HOẠT ĐỘNG (idle)   — 600 giây không chạm vào trang thì thoát.
 *      Bảo vệ trường hợp bỏ quên máy đang mở, người khác ngồi vào dùng tiếp.
 *
 *   2. TỔNG THỜI GIAN (absolute) — quá 24 giờ kể từ lần đăng nhập thì thoát,
 *      dù có đang dùng liên tục. Giới hạn thiệt hại nếu phiên bị đánh cắp.
 *
 * ─── VÌ SAO LƯU MỐC THỜI GIAN VÀO localStorage, KHÔNG DÙNG BIẾN TRONG BỘ NHỚ ──
 *
 * Biến trong bộ nhớ mất sạch khi tải lại trang. Người dùng chỉ cần nhấn F5 là
 * đồng hồ đếm ngược quay về 0 — coi như không có giới hạn nào. Ghi vào
 * localStorage thì mốc thời gian sống sót qua F5, đóng/mở tab, và được chia sẻ
 * giữa các tab của cùng một trình duyệt.
 *
 * ─── VÌ SAO KHÔNG DÙNG COOKIE / SESSION PHÍA MÁY CHỦ ────────────────────────
 *
 * Hệ thống xác thực bằng Firebase ID token, không dùng cookie phiên. Máy chủ
 * không giữ trạng thái phiên nào để hết hạn. Firebase có cơ chế thu hồi token
 * nhưng chỉ tác động ở lần làm mới tiếp theo (mỗi giờ), quá thô để làm mốc 600
 * giây. Vì vậy đồng hồ đếm đặt ở phía trình duyệt.
 *
 * ─── GIỚI HẠN CẦN THỪA NHẬN TRONG BÁO CÁO ───────────────────────────────────
 *
 * Đây là biện pháp về TRẢI NGHIỆM, không phải rào chắn bảo mật. Người dùng am
 * hiểu có thể tự xoá mốc thời gian trong localStorage để kéo dài phiên. Muốn
 * chặn thật sự thì máy chủ phải tự kiểm tra thời điểm phát token và từ chối
 * token quá cũ. Với phạm vi đồ án, giải pháp phía trình duyệt là đủ và dễ
 * trình bày.
 */

const IDLE_LIMIT_MS = 600 * 1000; // 600 giây không thao tác
const ABSOLUTE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 giờ kể từ lúc đăng nhập
const CHECK_INTERVAL_MS = 15 * 1000; // cứ 15 giây kiểm tra một lần

const KEY_LAST_ACTIVITY = "session:lastActivity";
const KEY_LOGIN_AT = "session:loginAt";

/** Các sự kiện được tính là "người dùng còn đang dùng trang". */
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"];

export function useSessionTimeout({ enabled, onTimeout }) {
    // Giữ hàm onTimeout trong ref để việc thay đổi hàm không làm dựng lại bộ đếm
    const onTimeoutRef = useRef(onTimeout);
    onTimeoutRef.current = onTimeout;

    const markActivity = useCallback(() => {
        localStorage.setItem(KEY_LAST_ACTIVITY, String(Date.now()));
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const now = Date.now();

        // Chưa có mốc đăng nhập (vừa đăng nhập lần đầu) thì đặt mốc mới
        if (!localStorage.getItem(KEY_LOGIN_AT)) {
            localStorage.setItem(KEY_LOGIN_AT, String(now));
        }
        markActivity();

        ACTIVITY_EVENTS.forEach((event) =>
            window.addEventListener(event, markActivity, { passive: true })
        );

        const timer = setInterval(() => {
            const last = Number(localStorage.getItem(KEY_LAST_ACTIVITY) || 0);
            const loginAt = Number(localStorage.getItem(KEY_LOGIN_AT) || 0);
            const current = Date.now();

            if (loginAt && current - loginAt >= ABSOLUTE_LIMIT_MS) {
                onTimeoutRef.current?.("absolute");
                return;
            }

            if (last && current - last >= IDLE_LIMIT_MS) {
                onTimeoutRef.current?.("idle");
            }
        }, CHECK_INTERVAL_MS);

        return () => {
            ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActivity));
            clearInterval(timer);
        };
    }, [enabled, markActivity]);
}

/** Xoá mốc thời gian — gọi khi đăng xuất để phiên sau đếm lại từ đầu. */
export function clearSessionMarks() {
    localStorage.removeItem(KEY_LAST_ACTIVITY);
    localStorage.removeItem(KEY_LOGIN_AT);
}

export const SESSION_LIMITS = {
    idleSeconds: IDLE_LIMIT_MS / 1000,
    absoluteHours: ABSOLUTE_LIMIT_MS / 3600000,
};
