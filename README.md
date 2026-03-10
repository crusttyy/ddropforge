# DropForge 🔥
### AI-Powered Shopify Store Builder

Turn any AliExpress or Alibaba product into a fully branded Shopify store in seconds.

---

## Deploy to Render (Free)

### Step 1 — Push to GitHub
1. Go to **github.com** → click **New repository**
2. Name it `dropforge` → click **Create repository**
3. On the next page, click **uploading an existing file**
4. Upload ALL files from this folder (drag the whole folder)
5. Click **Commit changes**

### Step 2 — Deploy on Render
1. Go to **render.com** → click **New +** → **Web Service**
2. Click **Connect a repository** → select your `dropforge` repo
3. Fill in the settings:
   - **Name:** dropforge
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Click **Advanced** → **Add Environment Variable**
   - Key: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
5. Click **Create Web Service**
6. Wait ~2 minutes for it to build
7. Your live URL will appear at the top — it'll look like `https://dropforge.onrender.com`

---

## That's it. DropForge is live.

Share that URL with anyone. Your API key is hidden on the server — nobody can see it.

---

## Local Development
```bash
npm install
cp .env.example .env
# Add your API key to .env
npm start
# Open http://localhost:3000
```

---

## How to Use DropForge
1. Open an AliExpress or Alibaba product listing
2. Screenshot the product images / description panels
3. Upload screenshots to DropForge
4. Add your selling price
5. Hit **Forge** ⚡
6. Copy-paste everything into Shopify
