// Service Worker — オフライン対応

const CACHE_NAME = 'oton-gakuen-v8';

const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/firebase.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/data/kotowaza.json',
  '/data/kanyoku.json',
  '/data/yojijukugo.json',
  '/data/gairaigo.json',
  '/data/sansu_keisan.json',
  '/data/sansu_bun.json',
  '/data/sansu_zu.json',
  '/data/sansu_kisoku.json',
  '/data/sansu_tokusan.json',
  '/data/sansu_baai.json',
  '/data/sansu_kazu.json'
];

// インストール時：全アセットをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// フェッチ：キャッシュ優先、なければネット
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        // 正常レスポンスのみキャッシュに追加
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        // オフライン時のフォールバック（HTMLの場合はindex.htmlを返す）
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
