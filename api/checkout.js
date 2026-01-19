import { Whop } from '@whop/sdk';
import axios from 'axios';

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
// Allow Shopify to talk to this code (CORS)
res.setHeader('Access-Control-Allow-Credentials', true);
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

if (req.method === 'OPTIONS') return res.status(200).end();

try {
// PART 1: CREATE CHECKOUT LINK (When user clicks PROCEED TO CHECKOUT)
if (req.body.action === 'create_checkout') {
const { items, email } = req.body;

// Calculate total price
let totalCents = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

// Pack data for Shopify
const cartData = items.map(i => ({ id: i.variant_id, qty: i.quantity }));

// Request link from Whop
const checkout = await whop.checkoutConfigurations.create({
plan: {
plan_type: 'one_time',
initial_price: totalCents / 100, // Whop needs dollars
currency: 'usd',
title: 'Demano Order'
},
metadata: {
shopify_payload: JSON.stringify(cartData),
customer_email: email || '' // Fixed syntax here
},
redirect_url: `https://${process.env.SHOPIFY_DOMAIN}/pages/thank-you`
});

// Returns the correct URL to Shopify
return res.status(200).json({ url: checkout.url || checkout.purchase_url });
}

// PART 2: SYNC TO SHOPIFY (After payment is successful)
if (req.body.type === 'payment.succeeded') {
const payment = req.body.data;
const metadata = payment.metadata || {}; // Fixed syntax here

if (!metadata.shopify_payload) return res.status(200).send('Ok');

// 1. Get fresh Shopify Token
const shopifyToken = await getShopifyToken();

const items = JSON.parse(metadata.shopify_payload);
const userEmail = payment.user?.email || metadata.customer_email; // Fixed syntax here

// 2. Create Order in Shopify
await axios.post(
`https://${process.env.SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json`,
{
order: {
email: userEmail,
financial_status: 'paid', // Marks order as PAID
tags: 'Whop Order',
line_items: items.map(i => ({ variant_id: i.id, quantity: i.qty })),
note: `Whop Payment ID: ${payment.id}`
}
},
{ headers: { 'X-Shopify-Access-Token': shopifyToken } }
);

return res.status(200).send('Success');
}

return res.status(400).json({ error: 'Invalid action' });

} catch (err) {
console.error(err);
return res.status(500).json({ error: err.message });
}
}
