import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import Home from "../pages/Home";
import ProductDetail from "../pages/ProductDetail";

function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                <Route element={<MainLayout />}>
                    <Route
                        path="/"
                        element={<Home />}
                    />

                    <Route
                        path="/product/:id"
                        element={<ProductDetail />}
                    />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default AppRouter;