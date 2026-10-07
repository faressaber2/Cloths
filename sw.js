try { importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch (e) {} // إشعارات OneSignal
/* Vibe Wear service worker — بيخزّن هيكل التطبيق بس، ومبيلمسش Firebase/Firestore/Storage/الصور الخارجية */
const VER = 'vibewear-v10';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

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
  // الصور (Unsplash / Storage) متتخزنش هنا: ردودها opaque وبتاكل كوتة كبيرة، والمتصفح بيكاشيها لوحده
  if (req.method !== 'GET' || (url.origin !== location.origin && !/(^|\.)gstatic\.com$|^fonts\.googleapis\.com$/.test(url.hostname))) return;

  // الصفحة: الشبكة الأول، ولو مفيش نت النسخة المخزّنة. بنخزّن الردود السليمة بس (مش 404/500)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { if (r.ok && r.type === 'basic') { const cp = r.clone(); caches.open(VER).then(c => c.put('index.html', cp)); } return r; })
        .catch(() => caches.match('index.html'))
    );
    return;
  }
  // باقي الملفات: المخزّن الأول وتحديث في الخلفية (ردود سليمة وغير opaque بس)
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r.ok && r.type !== 'opaque') { const cp = r.clone(); caches.open(VER).then(c => c.put(req, cp)); } return r; }).catch(() => hit);
      return hit || net;
    })
  );
});

