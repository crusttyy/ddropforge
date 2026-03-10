require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const APP_URL = process.env.APP_URL || 'https://ddropforge.onrender.com';

let ACCESS_CODES = {};
try {
  ACCESS_CODES = process.env.ACCESS_CODES ? JSON.parse(process.env.ACCESS_CODES) : { 'FORGE-DEMO': { name: 'Demo', active: true } };
} catch(e) {
  ACCESS_CODES = { 'FORGE-DEMO': { name: 'Demo', active: true } };
}

// Store shop tokens in memory (in production use a database)
const shopTokens = {};

console.log('DropForge starting...');
console.log('API KEY:', API_KEY ? 'YES' : 'MISSING');
console.log('Shopify Client ID:', SHOPIFY_CLIENT_ID ? 'YES' : 'MISSING');

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Validate access code
app.post('/api/validate', (req, res) => {
  const code = (req.body.code || '').toUpperCase().trim();
  const entry = ACCESS_CODES[code];
  if (!entry || !entry.active) return res.status(403).json({ valid: false });
  res.json({ valid: true, name: entry.name });
});

// SHOPIFY OAUTH — Step 1: Redirect to Shopify install page
app.get('/auth/install', (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Missing shop parameter');

  const state = crypto.randomBytes(16).toString('hex');
  const scopes = 'write_products,write_content,write_themes';
  const redirectUri = `${APP_URL}/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

  res.redirect(installUrl);
});

// SHOPIFY OAUTH — Step 2: Handle callback and get access token
app.get('/auth/callback', async (req, res) => {
  const { shop, code } = req.query;
  if (!shop || !code) return res.status(400).send('Missing parameters');

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('No access token returned');

    shopTokens[shop] = tokenData.access_token;
    console.log('Shop connected:', shop);

    // Redirect back to app with shop param
    res.redirect(`/?shop=${shop}&connected=true`);
  } catch(err) {
    console.error('OAuth error:', err.message);
    res.status(500).send('OAuth failed: ' + err.message);
  }
});

// Check if shop is connected
app.get('/api/shop-status', (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.json({ connected: false });
  res.json({ connected: !!shopTokens[shop] });
});

// Publish product to Shopify
app.post('/api/publish', async (req, res) => {
  const { shop, access_code, product } = req.body;

  // Validate access code
  const entry = ACCESS_CODES[(access_code || '').toUpperCase().trim()];
  if (!entry || !entry.active) return res.status(403).json({ error: 'Invalid access code.' });

  // Check shop token
  const token = shopTokens[shop];
  if (!token) return res.status(401).json({ error: 'Shop not connected. Please connect your Shopify store first.' });

  try {
    // Build Shopify product object
    const shopifyProduct = {
      product: {
        title: product.branded_name,
        body_html: `<p>${product.long}</p><ul>${product.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`,
        vendor: product.brand_name,
        product_type: 'Dropship',
        status: 'draft',
        tags: 'dropforge',
        variants: [{
          price: product.price.replace(/[^0-9.]/g, ''),
          inventory_management: null,
          fulfillment_service: 'manual'
        }]
      }
    };

    const createRes = await fetch(`https://${shop}/admin/api/2024-01/products.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify(shopifyProduct)
    });

    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.errors || 'Shopify API error');

    const productId = createData.product.id;
    const productUrl = `https://${shop}/admin/products/${productId}`;

    res.json({ success: true, productId, productUrl });
  } catch(err) {
    console.error('Publish error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Main forge endpoint
app.post('/api/forge', async (req, res) => {
  const code = (req.body.access_code || '').toUpperCase().trim();
  const entry = ACCESS_CODES[code];
  if (!entry || !entry.active) return res.status(403).json({ error: 'Invalid access code.' });
  if (!API_KEY) return res.status(500).json({ error: 'Server config error.' });

  const { messages, system, max_tokens } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid request.' });

  try {
    console.log('Forge from:', code);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 4000,
        system: system || '',
        messages
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'AI error' });
    res.json(data);
  } catch(err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.listen(PORT, () => console.log('DropForge on port ' + PORT));
