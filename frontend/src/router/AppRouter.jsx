import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import ErrorBoundary from "../components/ErrorBoundary";
import NotFound from "../pages/NotFound";

import Home from "../pages/Home";
import ProductDetail from "../pages/ProductDetail";
import Login from "../pages/Login";
import Register from "../pages/Register";

import Cart from "../pages/Cart";
import Checkout from "../pages/Checkout";
import Orders from "../pages/Orders";
import OrderDetail from "../pages/OrderDetail";
import Profile from "../pages/Profile";

import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminOrders from "../pages/admin/AdminOrders";

function AppRouter() {
    return (
        <BrowserRouter>
            <ErrorBoundary>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/admin" element={<AdminDashboard />} />

                <Route element={<MainLayout />}>
                    {/* Công khai */}
                    <Route path="/" element={<Home />} />
                    <Route path="/product/:id" element={<ProductDetail />} />

                    {/* Cần đăng nhập */}
                    <Route
                        path="/cart"
                        element={
                            <ProtectedRoute>
                                <Cart />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/checkout"
                        element={
                            <ProtectedRoute>
                                <Checkout />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/orders"
                        element={
                            <ProtectedRoute>
                                <Orders />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/orders/:orderId"
                        element={
                            <ProtectedRoute>
                                <OrderDetail />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/profile"
                        element={
                            <ProtectedRoute>
                                <Profile />
                            </ProtectedRoute>
                        }
                    />

                    {/* Quản lý đơn hàng — dùng chung layout để nhân viên vẫn thấy Header */}
                    <Route
                        path="/admin/orders"
                        element={
                            <ProtectedRoute>
                                <AdminOrders />
                            </ProtectedRoute>
                        }
                    />

                    {/* Bắt mọi đường dẫn không khớp route nào ở trên.
                        Thiếu route này thì URL lạ sẽ ra trang trắng hoàn toàn. */}
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
            </ErrorBoundary>
        </BrowserRouter>
    );
}

export default AppRouter;
