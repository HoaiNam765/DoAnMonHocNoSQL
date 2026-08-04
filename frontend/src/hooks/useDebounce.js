import { useEffect, useState } from "react";

/**
 * Trả về giá trị chỉ cập nhật sau khi người dùng ngừng thay đổi một khoảng thời gian.
 *
 * VÌ SAO CẦN: ô tìm kiếm nếu gọi API ngay mỗi lần gõ sẽ bắn hàng chục request
 * cho một từ khoá, vừa nặng máy chủ vừa khiến giao diện nhấp nháy liên tục.
 * Chờ người dùng gõ xong rồi mới gọi một lần là đủ.
 *
 * Cách dùng:
 *   const [search, setSearch] = useState("");
 *   const debouncedSearch = useDebounce(search, 400);
 *   // rồi đưa debouncedSearch vào mảng phụ thuộc của useEffect gọi API
 */
export function useDebounce(value, delay = 400) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        // Gõ tiếp trước khi hết giờ thì huỷ hẹn cũ, đặt hẹn mới
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}

export default useDebounce;
