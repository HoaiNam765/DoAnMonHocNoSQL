import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";

// CartProvider nằm TRONG AuthProvider vì nó cần useAuth() để lấy token.
ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <AuthProvider>
            <CartProvider>
                <App />
            </CartProvider>
        </AuthProvider>
    </React.StrictMode>
);