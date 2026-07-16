// Service Worker — オフライン対応

const CACHE_NAME = 'oton-gakuen-v196';

// GitHub Pagesの /tuna-app/ 配下でも動くよう相対パスで指定
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './images/logo.png',
  './data/kotowaza.json',
  './data/kanyoku.json',
  './data/yojijukugo.json',
  './data/gairaigo.json',
  './data/sansu_keisan.json',
  './data/sansu_bun.json',
  './data/sansu_zu.json',
  './data/sansu_kisoku.json',
  './data/sansu_tokusan.json',
  './data/sansu_baai.json',
  './data/sansu_kazu.json',
  './data/sansu_wariai.json',
  './data/sansu_hayasa.json',
  './data/sansu_rittai.json',
  './data/sansu_toranomaki.json',
  './data/sansu_chain.json',
  './data/rika_shokubutsu.json',
  './data/rika_doubutsu.json',
  './data/rika_jintai.json',
  './data/rika_sora.json',
  './data/rika_tenki.json',
  './data/rika_daichi.json',
  './data/rika_mono.json',
  './data/rika_kitai.json',
  './data/rika_suiyoueki.json',
  './data/rika_denki.json',
  './data/rika_chikara.json',
  './data/rika_hikarioto.json',
  './data/rika_science.json',
  './data/rika_lab.json',
  './data/rika_chain.json',
  './data/shakai_kokudo.json',
  './data/shakai_sangyo.json',
  './data/shakai_rekishi.json',
  './data/shakai_komin.json',
  './data/shakai_chain.json',
  './data/shakai_nippon.json',
  './data/japan_map.svg',
  './data/japan_pref_regions.json',
  './data/sanken_cases.json',
  './data/kanji_kaki.json',
  './data/kanji_yomi.json',
  './data/kokugo_keigo.json',
  './data/kokugo_goi.json',
  './data/kokugo_bushu.json',
  './data/kokugo_bungaku.json',
  './data/kokugo_tantei.json',
  './data/kokugo_youyaku.json',
  './data/kokugo_chain.json',
  './data/updates.json'
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

// フェッチ戦略：
//  ・アプリ本体（HTML/JS/JSONデータ）はネット優先＝更新を即反映。失敗時のみキャッシュ。
//  ・画像などの静的ファイルはキャッシュ優先＝速さ重視。
// これで「古いキャッシュが残って更新が見えない」問題を防ぐ。
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isCore = req.mode === 'navigate' || /\.(html|js|json)$/.test(url.pathname);

  if (isCore) {
    // ネット優先。取れたら最新をキャッシュへ更新。オフラインならキャッシュ→最後にindex.html
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(() =>
        caches.match(req).then(cached =>
          cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)
        )
      )
    );
  } else {
    // 画像・SVG・フォント等はキャッシュ優先
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }))
    );
  }
});
