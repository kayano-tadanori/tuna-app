// 中受ママ伴走アプリ Service Worker
const CACHE_NAME = 'okan-gakuen-v75';
// 自家製AIのモデルとランタイム（合計18MB）は専用キャッシュに置く。
// アプリ更新（CACHE_NAME変更）では消さず、モデル差し替え時だけ MODEL_CACHE を上げて入れ替える。
const MODEL_CACHE = 'okan-eraser-model-v11';
const MODEL_ASSETS = ['eraser_model_v11.onnx', 'ort.wasm.min.js',
  'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs'];
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
      // 現行のアプリ本体とモデルの2つ以外を削除。
      // → アプリを更新してもモデル(18MB)は残り、再ダウンロードされない
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== MODEL_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// モデル/ランタイムは専用キャッシュにキャッシュ優先で置く（初回だけダウンロード）
function isModelAsset(pathname) {
  return MODEL_ASSETS.some(a => pathname.endsWith('/' + a) || pathname.endsWith(a));
}

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

  // 自家製AIのモデル/ランタイムは専用キャッシュにキャッシュ優先（初回だけ取得、更新では残す）
  if (isModelAsset(url.pathname)) {
    event.respondWith(
      caches.open(MODEL_CACHE).then(cache =>
        cache.match(event.request).then(hit =>
          hit || fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          })
        )
      )
    );
    return;
  }

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
