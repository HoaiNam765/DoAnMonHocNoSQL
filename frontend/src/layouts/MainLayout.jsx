import Header from "./Header";
import { Outlet } from "react-router-dom";

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
        </>
    );
}

export default MainLayout;