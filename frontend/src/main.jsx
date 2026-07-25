import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { CustomerProvider } from "./context/CustomerContext";

ReactDOM.createRoot(document.getElementById("root")).render(
<<<<<<< Updated upstream
  <CustomerProvider>

    <App />

</CustomerProvider>
=======
    <React.StrictMode>
        <CustomerProvider>
            <App />
        </CustomerProvider>
    </React.StrictMode>
>>>>>>> Stashed changes
);