import Header from "./Header";
import { Outlet } from "react-router-dom";
import ChatWidget from "../components/ChatWidget";

function MainLayout() {
    return (
        <>
            <Header />

            <main
                style={{
                    padding: "30px 40px",
                }}
            >
                <Outlet />
            </main>

            {/* Trợ lý tư vấn — nổi ở góc phải, dùng chung cho mọi trang khách hàng */}
            <ChatWidget />
        </>
    );
}

export default MainLayout;