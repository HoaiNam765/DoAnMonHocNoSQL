import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { getCart, addToCart as apiAdd } from "../services/shopService";

/**
 * Quản lý giỏ hàng ở cấp toàn ứng dụng.
 *
 * Giỏ hàng được lưu trong Neo4j (quan hệ IN_CART), không phải localStorage —
 * nên đổi máy hay F5 vẫn còn nguyên. Context này chỉ giữ bản sao để badge trên
 * Header và trang giỏ hàng không phải gọi API lặp lại.
 */

const CartContext = createContext();

const EMPTY = { items: [], item_count: 0, total_quantity: 0, total: 0 };

export function CartProvider({ children }) {
    const { user } = useAuth();

    const [cart, setCart] = useState(EMPTY);
    const [loading, setLoading] = useState(false);

    /** Nạp lại giỏ từ server. Gọi sau mỗi thao tác làm thay đổi giỏ. */
    const refreshCart = useCallback(async () => {
        if (!user) {
            setCart(EMPTY);
            return EMPTY;
        }

        try {
            setLoading(true);
            const token = await user.getIdToken();
            const result = await getCart(token);
            setCart(result.data);
            return result.data;
        } catch (error) {
            console.error("[Cart] Không tải được giỏ hàng:", error);
            setCart(EMPTY);
            return EMPTY;
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Đăng nhập thì nạp giỏ, đăng xuất thì xoá sạch khỏi bộ nhớ
    useEffect(() => {
        refreshCart();
    }, [refreshCart]);

    /** Thêm vào giỏ. Trả về true nếu thành công để trang gọi biết mà báo. */
    const addItem = useCallback(
        async (productId, quantity = 1) => {
            if (!user) return false;
            const token = await user.getIdToken();
            const result = await apiAdd(token, productId, quantity);
            setCart(result.data);
            return true;
        },
        [user]
    );

    return (
        <CartContext.Provider value={{ cart, loading, refreshCart, addItem, setCart }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    return useContext(CartContext);
}
