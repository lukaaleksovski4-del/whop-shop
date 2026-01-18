import { Whop } from '@whop/sdk';
import axios from 'axios';

const whop = new Whop(process.env.WHOP_API_KEY);

// Функција за генерирање на привремен Shopify клуч (2026 метод)
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
  // Дозволуваме Shopify да збори со овој код (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ДЕЛ 1: КРЕИРАЊЕ ЛИНК ЗА НАПЛАТА (Кога кликаат КУПИ)
    if (req.body.action === 'create_checkout') {
      const { items, email } = req.body;
      
      // Пресметуваме цена
      let totalCents = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Пакуваме информации за Shopify
      const cartData = items.map(i => ({ id: i.variant_id, qty: i.quantity }));

      // Бараме линк од Whop
      const checkout = await whop.checkoutConfigurations.create({
        plan: {
          plan_type: 'one_time',
          initial_price: totalCents / 100, // Whop сака долари
          currency: 'usd',
          title: 'Naracka'
        },
        metadata: {
          shopify_payload: JSON.stringify(cartData),
          customer_email: email |

| ''
        },
        redirect_url: `https://${process.env.SHOPIFY_DOMAIN}/pages/thank-you`
      });

      return res.status(200).json({ url: checkout.purchase_url });
    }

    // ДЕЛ 2: АВТОМАТСКИ ВНЕС ВО SHOPIFY (Откако ќе платат)
    if (req.body.type === 'payment.succeeded') {
      const payment = req.body.data;
      const metadata = payment.metadata |

| {};
      
      if (!metadata.shopify_payload) return res.status(200).send('Ok');

      // 1. Земаме свеж клуч од Shopify
      const shopifyToken = await getShopifyToken();
      
      const items = JSON.parse(metadata.shopify_payload);
      const userEmail = payment.user?.email |

| metadata.customer_email;

      // 2. Внесуваме нарачка
      await axios.post(
        `https://${process.env.SHOPIFY_DOMAIN}/admin/api/2024-01/orders.json`,
        {
          order: {
            email: userEmail,
            financial_status: 'paid', // Ова прави да пишува PAID
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
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
