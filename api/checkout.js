export default async function handler(req, res) {
  // 1. Set CORS headers (Allows Shopify to talk to Vercel)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle pre-flight check
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 2. Get data sent from Shopify
    const { items, email, totalPrice } = req.body;

    // --- PASTE YOUR WHOP BUSINESS API KEY HERE ---
    // It starts with "apik_..."
    const API_KEY = "apik_WZYCVcy73GyIM_C4154396_C_b5d0a03c0f03bf3a5cfcd9f1af7c8a9143ad62eb2c5538f086fdd15d891f02"; 
    // ---------------------------------------------

    // 3. Create a summary string of all products
    // This creates a text like: "1x Black Hoodie (L), 1x White Tee (M)"
    const productNames = items.map(item => 
      `${item.quantity}x ${item.title} ${item.variant_title ? `(${item.variant_title})` : ''}`
    ).join(', ');

    // Whop has a character limit for names, so we cut it off if it's too long
    const finalTitle = productNames.length > 200 
      ? productNames.substring(0, 197) + "..." 
      : productNames;

    // Convert total price to cents (e.g., 199.99 becomes 19999)
    // We use the total price calculated by Shopify to be exact
    const finalPrice = Math.round(parseFloat(totalPrice) * 100);

    // 4. Send request to Whop
    // We send ONE item with the combined title and total price
    const response = await fetch("https://api.whop.com/api/v2/checkout_sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [
          {
            name: finalTitle, // This is the list of products!
            base_price: finalPrice, // This is the total price
            quantity: 1
          }
        ],
        email: email, // Auto-fill customer email
        require_email: true
      })
    });

    const data = await response.json();

    // 5. Send the URL back to Shopify
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
