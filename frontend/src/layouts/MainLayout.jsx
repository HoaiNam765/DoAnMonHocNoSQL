import { Outlet } from "react-router-dom";
import Header from "../components/Header";

function MainLayout() {
    return (
        <>
            <Header />

            <main
                style={{
                    maxWidth: "1200px",
                    margin: "30px auto",
                    padding: "0 20px",
                }}
            >
                <Outlet />
            </main>
        </>
    );
}

export default MainLayout;