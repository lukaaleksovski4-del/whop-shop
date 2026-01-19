import { Whop } from '@whop/sdk';
import axios from 'axios';

const whop = new Whop(process.env.WHOP_API_KEY);

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
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // --- CREATE CHECKOUT ---
    if (req.body.action === 'create_checkout') {
      const { items, email } = req.body;
      
      let totalCents = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const cartData = items.map(i => ({ id: i.variant_id, qty: i.quantity }));

      const checkout = await whop.checkoutConfigurations.create({
        plan: {
          plan_type: 'one_time', 
          initial_price: totalCents, 
          currency: 'usd',
          title: 'Order from Demano',
          company_id: 'biz_9ouoqD0evDHrfC' 
        },
        // ГО ИЗБРИШАВМЕ REDOT require_email ШТО ПРАВЕШЕ ГРЕШКА
        metadata: {
          shopify_payload: JSON.stringify(cartData),
          customer_email: email || ''
        },
        redirect_url: `https://${process.env.SHOPIFY_DOMAIN}/pages/thank-you`
      });

      return res.status(200).json({ url: checkout.url || checkout.purchase_url });
    }

    // --- PAYMENT SUCCEEDED ---
    if (req.body.type === 'payment.succeeded') {
      const payment = req.body.data;
      const metadata = payment.metadata || {};
      
      if (!metadata.shopify_payload) return res.status(200).send('Ok');

      const shopifyToken = await getShopifyToken();
      
      const items = JSON.parse(metadata.shopify_payload);
      const userEmail = payment.user?.email || metadata.customer_email;
      
      await axios.post(
        `https://${process.env.SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json`,
        {
          order: {
            email: userEmail,
            financial_status: 'paid',
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
    console.error("Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
