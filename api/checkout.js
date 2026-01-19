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

    // --- YOUR API KEY ---
    const API_KEY = "apik_WZYCVcy73GyIM_C4154396_C_b5d0a03c0f03bf3a5cfcd9f1af7c8a9143ad62eb2c5538f086fdd15d891f02"; 
    // --------------------

    // 2. DYNAMIC LOOKUP: Fetch the correct Plan ID for EACH product
    const lineItems = await Promise.all(items.map(async (item) => {
      let foundPlanId = null;

      // Only try to find a tag if the item has a handle (URL slug)
      if (item.handle) {
        try {
          // We fetch the public product data from your store to read the tags
          const productUrl = `https://demano.online/products/${item.handle}.js`;
          const response = await fetch(productUrl);
          
          if (response.ok) {
            const productData = await response.json();
            // Search for the tag starting with "whop:plan_"
            const whopTag = productData.tags.find(t => t.includes('whop:plan_'));
            
            if (whopTag) {
              // Extract the ID (remove "whop:" part)
              // Example: "whop:plan_123" -> "plan_123"
              foundPlanId = whopTag.split(':')[1];
            }
          }
        } catch (err) {
          console.error(`Could not fetch tags for ${item.handle}`);
        }
      }

      // 3. Construct the item for Whop
      if (foundPlanId) {
        // SUCCESS: We found the specific Plan ID for this product!
        return {
          plan_id: foundPlanId,
          quantity: item.quantity
        };
      } else {
        // FALLBACK: If no tag is found, sell as a custom item with the price
        // This ensures the checkout never fails, even if a tag is missing.
        const fullName = item.variant_title 
          ? `${item.title} (${item.variant_title})` 
          : item.title;

        return {
          name: fullName,
          base_price: Math.round(item.price * 100), // Convert to cents
          quantity: item.quantity
        };
      }
    }));

    // 4. Send the list to Whop
    const response = await fetch("https://api.whop.com/api/v2/checkout_sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: lineItems, // This now contains the correct Plan IDs for all 60 products
        email: email,
        require_email: true
      })
    });

    const data = await response.json();

    if (data.url) {
      return res.status(200).json({ url: data.url });
    } else {
      console.error("Whop Error:", JSON.stringify(data));
      return res.status(500).json({ error: JSON.stringify(data) });
    }

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
