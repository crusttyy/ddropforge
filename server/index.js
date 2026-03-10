require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Access codes — stored as env var on Render as JSON string
// e.g. {"FORGE-ABC123":{"name":"Customer 1","active":true}}
let ACCESS_CODES = {};
try {
  ACCESS_CODES = process.env.ACCESS_CODES ? JSON.parse(process.env.ACCESS_CODES) : { 'FORGE-DEMO': { name: 'Demo', active: true } };
} catch(e) {
  ACCESS_CODES = { 'FORGE-DEMO': { name: 'Demo', active: true } };
}

console.log('DropForge starting...');
console.log('API KEY:', API_KEY ? 'YES (length ' + API_KEY.length + ')' : 'MISSING');
console.log('Access codes:', Object.keys(ACCESS_CODES).length);

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

// Forge — requires access code
app.post('/api/forge', async (req, res) => {
  const code = (req.body.access_code || '').toUpperCase().trim();
  const entry = ACCESS_CODES[code];
  if (!entry || !entry.active) {
    return res.status(403).json({ error: 'Invalid access code.' });
  }
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
