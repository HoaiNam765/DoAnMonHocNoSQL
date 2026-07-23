import { useContext, useEffect, useState } from "react";
import { CustomerContext } from "../context/CustomerContext";
import { getCustomers } from "../services/customerService";

function Header() {
    const [customers, setCustomers] = useState([]);

    const { customerId, setCustomerId } = useContext(CustomerContext);

    useEffect(() => {
        async function loadCustomers() {
            try {
                const result = await getCustomers();

                setCustomers(result.data);

                if (result.data.length > 0 && !customerId) {
                    setCustomerId(result.data[0].customer_id);
                }
            } catch (error) {
                console.error(error);
            }
        }

        loadCustomers();
    }, []);

    return (
        <header
            style={{
                background: "#1976d2",
                color: "white",
                padding: "18px 40px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            }}
        >
            <h2>Neo4j E-Commerce</h2>

            <div>
                <strong>Khách hàng: </strong>

                <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    style={{
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "none",
                        outline: "none",
                    }}
                >
                    {customers.map((customer) => (
                        <option
                            key={customer.customer_id}
                            value={customer.customer_id}
                        >
                            {customer.customer_name}
                        </option>
                    ))}
                </select>
            </div>
        </header>
    );
}

export default Header;