export default async function handler(req, res) {
  // 1. Setup CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { items, email } = req.body;

    // --- PASTE YOUR WHOP API KEY HERE ---
    const API_KEY = "apik_WZYCVcy73GyIM_C4154396_C_b5d0a03c0f03bf3a5cfcd9f1af7c8a9143ad62eb2c5538f086fdd15d891f02"; 
    // -------------------------------------

    // 2. Process items (Fetch tags from your site to find Plan IDs)
    const lineItems = await Promise.all(items.map(async (item) => {
      let planId = null;

      // Try to find the handle to fetch tags
      if (item.handle) {
        try {
          // Fetch product data from your store to get the tags
          const productRes = await fetch(`https://demano.online/products/${item.handle}.js`);
          if (productRes.ok) {
            const productData = await productRes.json();
            const tags = productData.tags || [];
            
            // Look for the whop plan tag
            const whopTag = tags.find(t => t.toLowerCase().startsWith('whop:'));
            if (whopTag) {
              // Extract ID: "whop:plan_123" -> "plan_123"
              planId = whopTag.split(':')[1];
            }
          }
        } catch (err) {
          console.error("Failed to fetch tags for", item.handle);
        }
      }

      // 3. Return the correct object to Whop
      if (planId) {
        // OPTION A: If we found a Plan ID, use it!
        return {
          plan_id: planId,
          quantity: item.quantity
        };
      } else {
        // OPTION B: Fallback (Custom Item)
        // IMPORTANT: We use 'base_price' (in cents), not 'price'
        const fullName = item.variant_title 
          ? `${item.title} (${item.variant_title})` 
          : item.title;

        return {
          name: fullName,
          base_price: Math.round(item.price * 100), // Correct key is base_price
          quantity: item.quantity
        };
      }
    }));

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

    if (data.url) {
      return res.status(200).json({ url: data.url });
    } else {
      console.error("Whop Error Details:", JSON.stringify(data));
      return res.status(500).json({ error: JSON.stringify(data) });
    }

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
