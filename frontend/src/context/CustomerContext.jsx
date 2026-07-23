import { createContext, useState } from "react";

export const CustomerContext = createContext();

export function CustomerProvider({ children }) {

    const [customerId, setCustomerId] = useState("");

    return (

        <CustomerContext.Provider
            value={{
                customerId,
                setCustomerId,
            }}
        >
            {children}
        </CustomerContext.Provider>

    );

}