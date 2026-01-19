import { Whop } from '@whop/sdk';
import axios from 'axios';

// Initialize Whop SDK
// MAKE SURE 'WHOP_API_KEY' IS SET IN VERCEL ENVIRONMENT VARIABLES
const whop = new Whop(process.env.WHOP_API_KEY);

// Function to generate Shopify Admin Access Token
async function getShopifyToken() {
  const url = `https://${process.env.SHOPIFY_DOMAIN}/admin/oauth/access_token`;
  const response = await axios.post(url, {
    client_id: process.env.SHOPIFY_CLIENT_ID,
    client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    grant_type: 'client_credentials'
  });
  return response.data.access_token;
}

export default async function handler(req, res) {
  // 1. Setup CORS (Allow Shopify to talk to Vercel)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle pre-flight requests
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ==========================================
    // PART 1: CREATE CHECKOUT LINK (User clicks button)
    // ==========================================
    if (req.body.action === 'create_checkout') {
      const { items, email } = req.body;
      
      // Calculate total price in cents (Shopify Price * 100)
      let totalCents = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // Prepare cart data to save in metadata (for later use)
      const cartData = items.map(i => ({ id: i.variant_id, qty: i.quantity }));

      // Create the Checkout Session on Whop
      const checkout = await whop.checkoutConfigurations.create({
        plan: {
          plan_type: 'one_time', // Makes it look like a "Buy Now" purchase
          initial_price: totalCents, 
          currency: 'usd',
          title: 'Demano Order', // Title shown on checkout
          company_id: 'biz_9ouoqD0evDHrfC' // Your Business ID
        },
        // --- REQUIREMENTS ---
        require_phone_number: true, // Forces user to enter phone
        require_email: true,
        // --------------------
        metadata: {
          shopify_payload: JSON.stringify(cartData),
          customer_email: email || ''
        },
        redirect_url: `https://${process.env.SHOPIFY_DOMAIN}/pages/thank-you`
      });

      // Return the URL to Shopify so the user can be redirected
      return res.status(200).json({ url: checkout.url || checkout.purchase_url });
    }

    // ==========================================
    // PART 2: WEBHOOK SYNC (Payment Successful)
    // ==========================================
    if (req.body.type === 'payment.succeeded') {
      const payment = req.body.data;
      const metadata = payment.metadata || {};
      
      // If this isn't a Shopify order, ignore it
      if (!metadata.shopify_payload) return res.status(200).send('Ok');

      // 1. Get a fresh Shopify Token
      const shopifyToken = await getShopifyToken();
      
      // 2. Parse the saved items
      const items = JSON.parse(metadata.shopify_payload);
      
      // 3. Get User Details (Email and Phone)
      const userEmail = payment.user?.email || metadata.customer_email;
      // Try to get phone number from Whop payment data
      const userPhone = payment.user?.phone_number || payment.shipping_address?.phone || null; 

      // 4. Create the Order in Shopify
      await axios.post(
        `https://${process.env.SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json`,
        {
          order: {
            email: userEmail,
            phone: userPhone, // Saves phone number in Shopify
            financial_status: 'paid', // MARKS AS PAID -> GENERATES REVENUE
            tags: 'Whop Order',
            line_items: items.map(i => ({ variant_id: i.id, quantity: i.qty })),
            note: `Whop Payment ID: ${payment.id}`
          }
        },
        { headers: { 'X-Shopify-Access-Token': shopifyToken } }
      );

      return res.status(200).send('Success: Order Created');
    }
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
