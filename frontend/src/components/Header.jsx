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
        <header className="topbar">
            <div className="topbar__brand">
                <div className="topbar__brand-mark">N</div>
                <div>
                    <div>Neo4j Commerce</div>
                    <small style={{ opacity: 0.75, fontSize: "0.8rem" }}>Cửa hàng thông minh</small>
                </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <strong>Khách hàng:</strong>
                <select
                    className="topbar__select"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                >
                    {customers.map((customer) => (
                        <option key={customer.customer_id} value={customer.customer_id}>
                            {customer.customer_name}
                        </option>
                    ))}
                </select>
            </div>
        </header>
    );
}

export default Header;