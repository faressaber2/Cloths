/* BRANDS service worker — بيخزّن هيكل التطبيق بس، ومبيلمسش Firebase/Firestore */
const VER = 'vibewear-v3';
const SHELL = ['./', 'index.html', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Firebase والخطوط تعدّي عادي

  // الصفحة: الشبكة الأول، ولو مفيش نت النسخة المخزّنة
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { const cp = r.clone(); caches.open(VER).then(c => c.put('index.html', cp)); return r; })
        .catch(() => caches.match('index.html'))
    );
    return;
  }
  // باقي الملفات: المخزّن الأول وتحديث في الخلفية
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VER).then(c => c.put(req, cp)); } return r; }).catch(() => hit);
      return hit || net;
    })
  );
});
