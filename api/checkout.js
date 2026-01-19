export default async function handler(req, res) {
  // 1. Set CORS headers to allow Shopify to talk to Vercel
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle pre-flight check
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 2. Get data sent from Shopify
    const { items, email } = req.body;

    // --- PASTE YOUR WHOP API KEY BELOW ---
    const API_KEY = "apik_WZYCVcy73GyIM_C4154396_C_b5d0a03c0f03bf3a5cfcd9f1af7c8a9143ad62eb2c5538f086fdd15d891f02"; 
    // -------------------------------------

    // 3. Format Shopify items into Whop line items
    // This creates a list: Name, Variant, Price, and Image for each item
    const lineItems = items.map(item => {
      // Create a clear name like "Hoodie (Large)"
      const fullName = item.variant_title 
        ? `${item.title} (${item.variant_title})` 
        : item.title;

      return {
        name: fullName, 
        base_price: Math.round(item.price * 100), // Convert price to cents
        quantity: item.quantity,
        image_url: item.image // Send the image URL to Whop
      };
    });

    // 4. Send the request to Whop to create the checkout link
    const response = await fetch("https://api.whop.com/api/v2/checkout_sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: lineItems, // Sending the specific list of products
        email: email, // Auto-fill the customer's email
        require_email: true
      })
    });

    const data = await response.json();

    // 5. Send the Checkout URL back to your website
    if (data.url) {
      return res.status(200).json({ url: data.url });
    } else {
      console.error("Whop Error:", data);
      return res.status(500).json({ error: "Failed to create checkout link" });
    }

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
