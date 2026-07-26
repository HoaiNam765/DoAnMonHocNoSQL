import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./index.css";

import { CustomerProvider } from "./context/CustomerContext";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <CustomerProvider>
            
                <App />
            
        </CustomerProvider>
    </React.StrictMode>
);