// Service Worker — オフライン対応

const CACHE_NAME = 'oton-gakuen-v612';

// GitHub Pagesの /tuna-app/ 配下でも動くよう相対パスで指定
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  // app.js を分けたぶん（2026-08-08）。オフラインで動くようにここにも並べる
  './js/game-core.js',
  './js/otton3d.js',
  './models/otton.glb',   // 3Dのオットン（約900KB）
  './js/sansu.js',
  './js/books.js',
  './js/shakai-go.js',
  './js/tetris.js',
  './js/tetris2-embed.js',
  './js/jadepanic-embed.js',
  // おとんテトリス2（iframeの中身。オフラインでも遊べるように全部並べる）
  './images/jadepanic-banner.png',
  './images/tetris2-banner.png',
  './lab/jadepanic/index.html',
  './lab/jadepanic/style.css',
  './lab/jadepanic/js/gl.js',
  './lab/jadepanic/js/shaders.js',
  './lab/jadepanic/js/renderer.js',
  './lab/jadepanic/js/audio.js',
  './lab/jadepanic/js/core.js',
  './lab/jadepanic/js/grid.js',
  './lab/jadepanic/js/fx.js',
  './lab/jadepanic/js/game.js',
  // 🚀 チッチジャンプ3D（本体からは iframe で開く）
  './js/jump3d-embed.js',
  './js/okatazuke-embed.js',
  // 🧹 オカンの おかたづけ（にもつを おす 3Dパズル）
  './lab/okatazuke/index.html',
  './lab/okatazuke/style.css',
  './lab/okatazuke/js/gl.js',
  './lab/okatazuke/js/shaders.js',
  './lab/okatazuke/js/parts.js',
  './lab/okatazuke/js/scene.js',
  // 動きの共通エンジン（lab のゲームで 使いまわす）
  './lab/_lib/motion.js',
  './lab/okatazuke/js/pet.js',
  './lab/okatazuke/js/chars.js',
  // ★あそぶ人は 1人 500〜700KB ある。5人ぶん先に配ると 入れかえのたびに 5MB 落ちる。
  //   最初の1人（オカーン）と ペットだけ 先に置いて、
  //   ほかは えらんだときに 取りにいく（fetch のところで キャッシュに入る）。
  './lab/okatazuke/js/char_okan2.js',
  './lab/okatazuke/okan2_tex.jpg',
  './lab/okatazuke/js/pet_chicchi.js',
  './lab/okatazuke/chicchi_tex.jpg',
  './lab/okatazuke/js/prop_kibako.js',
  './lab/okatazuke/js/prop_renga.js',
  // ※ kibako_tex / renga_tex は 見くらべ用（?box=scan / ?wall=scan）のときだけ
  //    取りにいくので、先に配らない。ふだんの かべ・にもつは 自分で描いている。
  './lab/okatazuke/js/okan.js',
  './lab/okatazuke/js/renderer.js',
  './lab/okatazuke/js/core.js',
  './lab/okatazuke/js/levels.js',
  './lab/okatazuke/js/audio.js',
  './lab/okatazuke/js/bgm.js',
  './lab/okatazuke/js/game.js',
  './images/jump3d-banner.png',
  './lab/chicchi-jump-3d/index.html',
  './lab/chicchi-jump-3d/style.css',
  './lab/chicchi-jump-3d/title.jpg',
  './lab/chicchi-jump-3d/title-portrait.jpg',
  './lab/chicchi-jump-3d/js/audio.js',
  './lab/chicchi-jump-3d/js/biome.js',
  './lab/chicchi-jump-3d/js/chicchi.js',
  './lab/chicchi-jump-3d/js/core.js',
  './lab/chicchi-jump-3d/js/game.js',
  './lab/chicchi-jump-3d/js/gl.js',
  './lab/chicchi-jump-3d/js/park.js',
  './lab/chicchi-jump-3d/js/props.js',
  './lab/chicchi-jump-3d/js/renderer.js',
  './lab/chicchi-jump-3d/js/scenery.js',
  './lab/chicchi-jump-3d/js/shaders.js',
  './lab/tetris2/index.html',
  './lab/tetris2/style.css',
  './lab/tetris2/js/gl.js',
  './lab/tetris2/js/shaders.js',
  './lab/tetris2/js/renderer.js',
  './lab/tetris2/js/audio.js',
  './lab/tetris2/js/core.js',
  './lab/tetris2/js/chars.js',
  './lab/tetris2/js/game.js',
  './js/gacha.js',
  './js/gamify.js',
  './js/sweeper.js',
  './js/jump.js',
  './js/search.js',            // 単元でさがす（2026-08-17）
  './sound.js',
  './firebase.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './images/logo.png',
  './data/sansu_unit_index.json',
  './data/search_index.json',  // 単元でさがす用の索引（2026-08-17）
  './data/hama_kaisetsu.json',
  './data/hama_daimon.json',
  './data/hama_kokugo.json',
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
  './data/sansu_bakuhatsu.json',
  './data/sansu_gachi.json',
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
  './data/rika_gachi.json',
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
  './data/kokugo_bun.json',
  './data/kokugo_wago.json',
  './data/kokugo_sairei5.json',
  './data/kokugo_tantei.json',
  './data/kokugo_youyaku.json',
  './data/kokugo_chain.json',
  './data/hama_map.json',
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
