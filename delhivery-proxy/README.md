# Delhivery delivery estimate

Adds a pincode checker to the product page that shows an estimated delivery
date from Delhivery's Expected TAT API.

```
Product page (blocks/delivery-estimate.liquid)
   │  GET ?origin_pin=…&destination_pin=…&mot=S&expected_pickup_date=…
   ▼
Cloudflare Worker (delhivery-proxy/worker.js)  ← holds DELHIVERY_TOKEN
   │  GET /api/dc/expected_tat  +  Authorization: Token …
   ▼
Delhivery  →  { "data": { "tat": 3 } }
```

The token can't go in theme code because anyone could read it in the page
source, and Delhivery doesn't send CORS headers anyway. That's why the proxy is needed.

## 1. Deploy the proxy (free Cloudflare Worker)

1. Cloudflare dashboard → **Workers & Pages → Create → Worker**, then paste `worker.js` and deploy.
2. **Settings → Variables**:
   - `DELHIVERY_TOKEN` (Secret): your token from Delhivery One → Settings → API Setup
   - `DELHIVERY_HOST`: `https://track.delhivery.com` (use `https://staging-express.delhivery.com` with a staging token)
   - `ALLOWED_ORIGINS`: `https://yourstore.com,https://yourstore.myshopify.com`
3. Test it: `https://<worker>.workers.dev/?origin_pin=110001&destination_pin=400001&mot=S`

## 2. Add the block

Theme editor → Product page → **Add block → Delivery estimate**, then fill in:

- **Proxy URL**: your worker URL
- **Warehouse pincode**: your pickup pincode
- **Processing days / cutoff hour**: used to work out the pickup date. Sundays are skipped.

Estimated date = pickup date + TAT days returned by Delhivery.

This folder isn't part of the theme. It's listed in `.shopifyignore`.
