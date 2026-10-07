// Vercel Serverless Function: وسيط بين الموقع و OpenRouter (المفتاح مش بيظهر للمتصفح)
// Environment Variables المطلوبة على Vercel:
//   OPENROUTER_API_KEY  = sk-or-v1-...   (مفتاح جديد!)
//   ALLOWED_ORIGINS     = https://your-domain.com,https://your-app.vercel.app   (اختياري)

const URL_OR = 'https://openrouter.ai/api/v1/chat/completions';
const ALLOWED_MODELS = new Set(['openai/gpt-4o-mini']); // ضيف موديلات تانية هنا لو احتجت
const MAX_TOKENS = 2000;
const RATE_LIMIT = 30;          // طلبات لكل IP
const RATE_WINDOW_MS = 60_000;  // في الدقيقة (best-effort، بيتصفّر مع cold start)
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE_LIMIT;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return res.status(500).json({ error: { message: 'OPENROUTER_API_KEY not set' } });

  // فحص الـ Origin (نفس الدومين دايمًا مسموح)
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (origin && !origin.endsWith('//' + host) && !extra.includes(origin)) {
    return res.status(403).json({ error: { message: 'Forbidden origin' } });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: { message: 'Too many requests' } });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (!Array.isArray(b.messages) || !b.messages.length) {
    return res.status(400).json({ error: { message: 'messages required' } });
  }
  const model = ALLOWED_MODELS.has(b.model) ? b.model : 'openai/gpt-4o-mini';

  const payload = {
    model,
    messages: b.messages,
    temperature: typeof b.temperature === 'number' ? b.temperature : 0.2,
    max_tokens: Math.min(+b.max_tokens || 700, MAX_TOKENS),
  };
  if (b.response_format && b.response_format.type === 'json_object') {
    payload.response_format = { type: 'json_object' };
  }

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 55000);
    const r = await fetch(URL_OR, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + key,
        'HTTP-Referer': origin || ('https://' + host),
        'X-Title': 'Vibe Wear',
      },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    clearTimeout(t);
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (e) {
    res.status(502).json({ error: { message: 'Upstream error' } });
  }
};

// حد حجم الطلب (صور المقاس بتتبعت base64) — Vercel الحد الأقصى 4.5MB
module.exports.config = { api: { bodyParser: { sizeLimit: '4mb' } } };
