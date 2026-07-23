const API_URL = "http://localhost:5000/api/customers?page=1&limit=50";

export async function getCustomers() {
    const response = await fetch(API_URL);

    if (!response.ok) {
        throw new Error("Không lấy được danh sách khách hàng");
    }

    return await response.json();
}

export async function getCustomerRecommendations(customerId){

    const response = await fetch(

        `http://localhost:5000/api/customers/${customerId}/recommendations`

    );

    if(!response.ok){

        throw new Error("Không lấy được Recommendation");

    }

    return await response.json();

}