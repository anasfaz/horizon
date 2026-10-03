/**
 * Cloudflare Worker proxy for the Delhivery Expected TAT API.
 *
 * Keeps your Delhivery API token server-side and adds CORS so the
 * `delivery-estimate` theme block can call it from the storefront.
 *
 * Secrets / vars (Cloudflare dashboard → Worker → Settings → Variables):
 *   DELHIVERY_TOKEN   (secret)  your Delhivery API token
 *   DELHIVERY_HOST    (var)     https://track.delhivery.com            (production)
 *                               https://staging-express.delhivery.com  (staging)
 *   ALLOWED_ORIGINS   (var)     comma-separated, e.g. https://yourstore.com,https://yourstore.myshopify.com
 */

const PIN = /^[1-9][0-9]{5}$/;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
    const corsOrigin = allowed.length === 0 || allowed.includes(origin) ? origin || '*' : allowed[0];
    const cors = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Content-Type',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, cors);

    const params = new URL(request.url).searchParams;
    const origin_pin = params.get('origin_pin') || '';
    const destination_pin = params.get('destination_pin') || '';
    if (!PIN.test(origin_pin) || !PIN.test(destination_pin)) {
      return json({ error: 'Invalid pincode' }, 400, cors);
    }

    const upstream = new URL('/api/dc/expected_tat', env.DELHIVERY_HOST || 'https://track.delhivery.com');
    upstream.searchParams.set('origin_pin', origin_pin);
    upstream.searchParams.set('destination_pin', destination_pin);
    upstream.searchParams.set('mot', params.get('mot') === 'E' ? 'E' : 'S');
    upstream.searchParams.set('pdt', 'B2C');
    const pickup = params.get('expected_pickup_date');
    if (pickup) upstream.searchParams.set('expected_pickup_date', pickup);

    // Cache identical lookups at the edge for 6 hours to save API quota.
    const cache = caches.default;
    const cacheKey = new Request(upstream.toString());
    let response = await cache.match(cacheKey);

    if (!response) {
      const res = await fetch(upstream, {
        headers: { Authorization: `Token ${env.DELHIVERY_TOKEN}`, Accept: 'application/json' },
      });
      const body = await res.text();
      response = new Response(body, {
        status: res.status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=21600' },
      });
      if (res.ok) await cache.put(cacheKey, response.clone());
    }

    const out = new Response(response.body, response);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
