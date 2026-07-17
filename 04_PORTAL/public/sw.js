// KTM ポータル Service Worker（課題#48 PWA）
// 目的: インストール可能化＋オフライン時の最低限のフォールバック。
// APIや動的データはキャッシュせず、ナビゲーションのみネットワーク優先＋失敗時フォールバック。
const CACHE = 'ktm-portal-v1';
const OFFLINE_URLS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // GETのページナビゲーションのみ対象。API/POST/クロスオリジンは素通し。
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('/')))
  );
});

// Web Push受信（VAPID購読済みの場合のみ動作。未設定でも無害）
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'KTM ポータル';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.openWindow(url));
});
