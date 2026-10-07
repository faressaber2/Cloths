// Vercel Serverless Function: /api/push
// وسيط بسيط: بياخد نفس الطلب اللي الكود القديم بيبعته لـ OneSignal
// ويحط المفتاح السري من Vercel بدل ما يبقى في الصفحة.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const key = process.env.ONESIGNAL_REST_KEY;
  if (!key) return res.status(500).json({ error: 'ONESIGNAL_REST_KEY missing' });

  const r = await fetch('https://api.onesignal.com/notifications?c=push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Key ' + key },
    body: JSON.stringify(req.body),
  });
  const data = await r.json().catch(() => ({}));
  return res.status(r.status).json(data);
}

