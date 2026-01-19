export default async function handler(req, res) {
  // 1. Setup connections (CORS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { items, email, totalPrice } = req.body;

    // --- PASTE YOUR API KEY HERE ---
    const API_KEY = "apik_WZYCVcy73GyIM_C4154396_C_b5d0a03c0f03bf3a5cfcd9f1af7c8a9143ad62eb2c5538f086fdd15d891f02"; 
    // (Ova e klucot od tvojata slika)
    // -------------------------------

    // 2. Combine all product names into ONE string
    // This fixes the "plan_id" error by making Whop think it's just 1 custom item
    const productNames = items.map(item => 
      `${item.quantity}x ${item.title} ${item.variant_title ? `(${item.variant_title})` : ''}`
    ).join(', ');

    // Safety check: Cut text if it's too long for Whop
    const finalTitle = productNames.length > 200 
      ? productNames.substring(0, 197) + "..." 
      : productNames;

    // 3. Convert total price to cents
    const finalPrice = Math.round(parseFloat(totalPrice) * 100);

    // 4. Send as ONE item to Whop
    const response = await fetch("https://api.whop.com/api/v2/checkout_sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [
          {
            name: finalTitle, // The list is hidden here in the name!
            base_price: finalPrice,
            quantity: 1
          }
        ],
        email: email,
        require_email: true
      })
    });

    const data = await response.json();

    if (data.url) {
      return res.status(200).json({ url: data.url });
    } else {
      console.error("Whop Error:", data);
      return res.status(500).json({ error: "Whop Error" });
    }

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
