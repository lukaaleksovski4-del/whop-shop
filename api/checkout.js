export default async function handler(req, res) {
  // 1. Allow Shopify to access this API (CORS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { items, email } = req.body;

    // --- YOUR API KEY ---
    const API_KEY = "apik_WZYCVcy73GyIM_C4154396_C_b5d0a03c0f03bf3a5cfcd9f1af7c8a9143ad62eb2c5538f086fdd15d891f02"; 
    // --------------------

    // 2. FORCE CALCULATION: Calculate the total price manually
    // We do not trust the total sent by Shopify, we calculate it here to be safe.
    let calculatedTotal = 0;
    
    items.forEach(item => {
      // Price * Quantity
      calculatedTotal += (item.price * item.quantity);
    });

    // Convert to cents (Whop requires cents, e.g., $10.00 -> 1000)
    const finalPriceCents = Math.round(calculatedTotal * 100);

    // 3. SEND REQUEST TO WHOP
    // We send ONE single item named "Demano Order" with the total price.
    // This bypasses the need for "plan_id".
    const response = await fetch("https://api.whop.com/api/v2/checkout_sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [
          {
            name: "Order from Demano", // Generic name to prevent errors
            base_price: finalPriceCents, // This is the KEY parameter
            quantity: 1
          }
        ],
        email: email,
        require_email: true,
        // We request the phone number here
        require_phone_number: true 
      })
    });

    const data = await response.json();

    // 4. CHECK RESULT
    if (data.url) {
      return res.status(200).json({ url: data.url });
    } else {
      console.error("Whop Error:", JSON.stringify(data));
      // Send the exact error back to the browser so we can see it
      return res.status(500).json({ error: JSON.stringify(data) });
    }

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
