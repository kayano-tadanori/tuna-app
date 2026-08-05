// オトン学園 管理ツール Service Worker
// 役割は「ホーム画面に追加して起動できる／オフラインでも画面が開く」ことだけ。
// 管理ツールは Firestore の“今”のデータを見せるものなので、
//   ・同一オリジンのファイル（画面本体・アイコン）だけをキャッシュ対象にし、
//   ・Firebase / gstatic など外部通信には一切介入しない（＝常に最新を取得）。
//   ・画面本体(HTML)はネットワーク優先。更新がすぐ反映され、圏外のときだけキャッシュを使う。
const CACHE_NAME = 'oton-admin-v1';
const ASSETS = [
  './',
  './index.html',
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
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // 外部（Firebase/Firestore/gstatic 等）には介入しない＝常に最新データを取りにいく
  if (url.origin !== location.origin) return;

  // 画面本体（HTML）はネットワーク優先。オフラインのときだけキャッシュから返す。
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => caches.open(CACHE_NAME).then(c => c.match(event.request, { ignoreSearch: true })))
    );
    return;
  }

  // アイコンなどの静的ファイルはキャッシュ優先
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
      )
    )
  );
});
