import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    updateProfile,
} from "firebase/auth";
import { auth } from "../config/firebase";
import { syncUser } from "../services/authService";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // Firebase User
    const [customer, setCustomer] = useState(null); // Neo4j Customer data
    const [loading, setLoading] = useState(true);
    // Thông báo khi tài khoản bị khoá — trang Login đọc để hiện lý do bị đăng xuất
    const [blockedMessage, setBlockedMessage] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const token = await currentUser.getIdToken();
                    const result = await syncUser(token);
                    setCustomer(result.data);
                    setBlockedMessage("");
                } catch (error) {
                    console.error("Lỗi đồng bộ thông tin khách hàng:", error);
                    setCustomer(null);

                    // 403 = tài khoản bị quản trị viên khoá. Đăng xuất luôn thay vì
                    // để người dùng kẹt trong trạng thái "đã đăng nhập nhưng làm gì
                    // cũng lỗi" — mọi endpoint sau đó đều trả 403.
                    if (error.status === 403) {
                        setBlockedMessage(error.message);
                        await signOut(auth);
                    }
                }
            } else {
                setCustomer(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Hàm làm mới thông tin customer từ backend (cần thiết khi vừa bấm mua hàng)
    const refreshCustomer = useCallback(async () => {
        if (!user) return null;
        try {
            const token = await user.getIdToken(true);
            const result = await syncUser(token);
            setCustomer(result.data);
            return result.data;
        } catch (error) {
            console.error("Lỗi cập nhật lại customer:", error);
            throw error;
        }
    }, [user]);

    const register = async (email, password, displayName) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Cập nhật tên hiển thị trên Firebase
        await updateProfile(userCredential.user, { displayName });
        
        // Gọi sync ngay để đảm bảo Backend lưu tên mới
        const token = await userCredential.user.getIdToken(true);
        const result = await syncUser(token);
        setCustomer(result.data);
        return userCredential;
    };

    const login = async (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
    };

    const logout = async () => {
        return signOut(auth);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                customer,
                loading,
                blockedMessage,
                clearBlockedMessage: () => setBlockedMessage(""),
                register,
                login,
                loginWithGoogle,
                logout,
                refreshCustomer,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
