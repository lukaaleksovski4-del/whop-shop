import { Whop } from '@whop/sdk';
import axios from 'axios';

// Ensure WHOP_API_KEY is set in Vercel Environment Variables
const whop = new Whop(process.env.WHOP_API_KEY);

// Function to generate Shopify Access Token
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
  // 1. Setup CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // --- ACTION: CREATE CHECKOUT LINK ---
    if (req.body.action === 'create_checkout') {
      const { items, email } = req.body;
      
      // Calculate total price in cents
      let totalCents = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const cartData = items.map(i => ({ id: i.variant_id, qty: i.quantity }));

      // Create the checkout session
      const checkout = await whop.checkoutConfigurations.create({
        plan: {
          plan_type: 'one_time', // Attempts to treat it as a one-time purchase
          initial_price: totalCents, 
          currency: 'usd',
          title: 'Order from Demano',
          company_id: 'biz_9ouoqD0evDHrfC' // Your Company ID
        },
        metadata: {
          shopify_payload: JSON.stringify(cartData),
          customer_email: email || ''
        },
        redirect_url: `https://${process.env.SHOPIFY_DOMAIN}/pages/thank-you`
      });

      return res.status(200).json({ url: checkout.url || checkout.purchase_url });
    }

    // --- ACTION: PAYMENT SUCCESS (Webhook) ---
    if (req.body.type === 'payment.succeeded') {
      const payment = req.body.data;
      const metadata = payment.metadata || {};
      
      if (!metadata.shopify_payload) return res.status(200).send('Ok');

      const shopifyToken = await getShopifyToken();
      const items = JSON.parse(metadata.shopify_payload);
      
      // Get customer details
      const userEmail = payment.user?.email || metadata.customer_email;
      const userPhone = payment.user?.phone_number || null; // Will define if available

      // Create Paid Order in Shopify
      await axios.post(
        `https://${process.env.SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json`,
        {
          order: {
            email: userEmail,
            phone: userPhone, 
            financial_status: 'paid', // Mark as Paid/Revenue
            tags: 'Whop Order',
            line_items: items.map(i => ({ variant_id: i.id, quantity: i.qty })),
            note: `Whop Payment ID: ${payment.id}`
          }
        },
        { headers: { 'X-Shopify-Access-Token': shopifyToken } }
      );

      return res.status(200).send('Success');
    }
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
