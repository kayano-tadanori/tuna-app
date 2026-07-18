// 中受ママ伴走アプリ Service Worker
const CACHE_NAME = 'okan-gakuen-v23';
const ASSETS = [
  './',
  './index.html',
  './eraser.html',
  './schedule.html',
  './prints.html',
  './seiseki.html',
  './dark.css',
  './updates.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // HTTPキャッシュを飛ばして必ず最新を取り込む
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      // 現行以外のキャッシュは名前を問わずすべて削除（旧print-eraser-*、旧okan-gakuen-*とも）
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function networkFirst(event) {
  event.respondWith(
    fetch(event.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return res;
    }).catch(() => caches.open(CACHE_NAME).then(c => c.match(event.request, { ignoreSearch: true })))
  );
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // 画面本体（HTML）とアップデート情報は常にネットワーク優先（オフライン時のみキャッシュ）
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') || url.pathname.endsWith('/') ||
      url.pathname.endsWith('updates.json')) {
    networkFirst(event);
    return;
  }

  // 画像などの静的ファイルはキャッシュ優先（現行キャッシュのみ参照）
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached =>
        cached ||
        fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            cache.put(event.request, clone);
          }
          return res;
        })
      )
    )
  );
});
