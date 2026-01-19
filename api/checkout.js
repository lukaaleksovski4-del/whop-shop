export default async function handler(req, res) {
  // 1. Setup CORS (Allow Shopify to connect)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 2. Get items and email from Shopify
    const { items, email } = req.body;

    // --- PASTE YOUR WHOP API KEY HERE ---
    const API_KEY = "apik_WZYCVcy73GyIM_C4154396_C_b5d0a03c0f03bf3a5cfcd9f1af7c8a9143ad62eb2c5538f086fdd15d891f02"; 
    // -------------------------------------

    // 3. Process items to find the Whop Plan ID in tags
    const lineItems = items.map(item => {
      // Ensure tags exist (handle case where tags might be missing)
      // We look for a tag that looks like: "whop:plan_..."
      const tags = item.tags || []; 
      const whopTag = tags.find(t => t.toLowerCase().startsWith('whop:'));

      if (whopTag) {
        // FOUND A PLAN ID!
        // Extract the ID part (remove "whop:")
        // Example: "whop:plan_123" -> "plan_123"
        const planId = whopTag.split(':')[1];
        
        return {
          plan_id: planId,
          quantity: item.quantity
        };
      } else {
        // NO PLAN ID FOUND (Fallback)
        // Send as a custom item with name and price
        const fullName = item.variant_title 
          ? `${item.title} (${item.variant_title})` 
          : item.title;

        return {
          name: fullName,
          price: Math.round(item.price * 100), // Convert to cents
          quantity: item.quantity
        };
      }
    });

    // 4. Send to Whop
    const response = await fetch("https://api.whop.com/api/v2/checkout_sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: lineItems,
        email: email,
        require_email: true
      })
    });

    const data = await response.json();

    // 5. Return the URL
    if (data.url) {
      return res.status(200).json({ url: data.url });
    } else {
      console.error("Whop Error:", JSON.stringify(data));
      // Return the specific error from Whop for easier debugging
      return res.status(500).json({ error: data });
    }

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
