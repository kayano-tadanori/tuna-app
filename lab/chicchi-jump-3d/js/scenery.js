// ============================================================
// scenery.js — 背景の風景
//
//   地上   … ビル群のあいだを登る。少し向こうにスカイツリー。
//   中ほど … 富士山の向こうへ、太陽が沈んでいく。
//   宇宙   … 地球が球になって、だんだん離れていく。
//
//  ★遠さは「動かなさ」で表す。
//    近いビルは登るとすぐ足元へ消える。富士山はゆっくり沈む。
//    地球はほとんど動かず、ただ小さくなっていく。
//    この差が「どれだけ登ったか」を体に伝える。
// ============================================================
'use strict';

// ---------------- 🏢 ビル ----------------
// 箱に窓の帯を貼るだけ。小さく映るので、これで十分「街」に見える。
// 大事なのは形より「高さと間隔がばらばらであること」。
function buildBuildingMesh() {
  const b = new PropBuilder();
  const ROWS = 34;
  // ★窓は「別の板」を貼らないこと。
  //   ビルは高さでメッシュごと縦に引き伸ばすので、板の厚みまで一緒に伸びて
  //   巨大な看板になってしまう（実際にそうなった）。
  //   本体を細かく輪切りにして、頂点の色で窓の帯を描くのが正しい。
  b.add(loftGeometry({
    rings: ROWS * 2, radial: 4, k: 6.0, minR: 0.02,
    profile: t => { const r = 0.5 - t * 0.05; return [r, r]; },
    spine: t => [0, t, 0],
  }), {
    center: [0, 0.5, 0], flat: true,
    colFn: (px, py) => {
      const t = clamp(py, 0, 1);
      // 上へ行くほど明るい（空の光を受ける）
      const wall = 0.40 + t * 0.34;
      // 窓の帯。1フロアごとに、明るい窓と壁がくり返す。
      const f = t * ROWS;
      const win = (Math.floor(f) % 3 !== 2) ? smoothstep(0.26, 0.40, f % 1) * smoothstep(0.74, 0.60, f % 1) : 0;
      // すべての階が同じ明るさだと作り物っぽい。すこしむらを付ける。
      const lit = 0.55 + 0.45 * Math.abs(Math.sin(Math.floor(f) * 2.7 + px * 5.1));
      const c = [wall, wall * 1.04, wall * 1.22];
      const w = 1.55 * lit;
      return [lerp(c[0], w, win), lerp(c[1], w * 0.97, win), lerp(c[2], w * 0.72, win)];
    },
  });
  // 屋上のちいさな塔屋
  b.add(loftGeometry({
    rings: 2, radial: 4, k: 6.0, minR: 0.01,
    profile: () => [0.16, 0.16],
    spine: t => [0, 1.0 + t * 0.045, 0],
  }), { center: [0, 0.5, 0], flat: true, col: [0.74, 0.78, 0.90] });
  return b.build();
}

// ---------------- 🗼 スカイツリー ----------------
// てっぺんが細く長い、あの独特のシルエット。
// 下は三角、上は円へと変わっていくのが本物の特徴だが、
// ここでは「根もとが広がって、上へすっと伸びる」形で読ませる。
function buildSkytreeMesh() {
  const b = new PropBuilder();
  const H = 1.0;
  // 塔体：根もとで広がり、途中でくびれ、上へ細く伸びる
  // ★高さでメッシュごと拡大するので、横はばも同じ倍率で太る。
  //   本物の根もとは約68m＝全高634mの 0.107 倍。半径ならその半分。
  const prof = [0.054, 0.030, 0.020, 0.015, 0.013, 0.015, 0.012, 0.007, 0.005];
  b.add(loftGeometry({
    rings: 26, radial: 9, k: 2.2, minR: 0.006,
    profile: t => { const r = catmull(prof, t); return [r, r]; },
    spine: t => [0, t * H * 0.80, 0],
  }), { center: [0, H * 0.4, 0],
        colFn: (px, py) => { const k = clamp(py / H, 0, 1);
          return [0.86 + k * 0.30, 0.90 + k * 0.30, 1.00 + k * 0.26]; } });

  // 展望台（2段）。ここがあると一目でスカイツリーになる。
  for (const [y, r, h] of [[0.44, 0.028, 0.016], [0.63, 0.021, 0.013]]) {
    b.add(loftGeometry({
      rings: 2, radial: 12, k: 2.0, minR: 0.006,
      profile: () => [r, r],
      spine: t => [0, y + t * h, 0],
    }), { center: [0, H * 0.4, 0], col: [1.5, 1.55, 1.7] });
  }
  // アンテナ（てっぺんの細い針）
  b.add(tubeGeometry(t => [0, 0.80 + t * 0.20, 0], 0.003, 6, 5),
        { center: [0, 0.9, 0], col: [1.2, 1.25, 1.4] });
  // 先端の赤い航空障害灯
  b.add(sphereGeometry(6, 5), {
    offset: [0, 1.0, 0], scale: [0.008, 0.008, 0.008],
    center: [0, 1.0, 0], col: [3.0, 0.5, 0.4],
  });
  return b.build();
}

// ---------------- 🗻 富士山 ----------------
// なだらかな裾野と、雪をかぶった頂き。この2つで富士山になる。
function buildFujiMesh() {
  const b = new PropBuilder();
  b.add(loftGeometry({
    rings: 22, radial: 26, k: 2.0, minR: 0.01,
    // 裾がゆっくり広がる曲線。まっすぐな円すいだと三角の山になってしまう。
    profile: t => { const r = Math.pow(1 - t, 1.55) * 0.5 + 0.006; return [r, r]; },
    spine: t => [0, t, 0],
    capTop: true, capBottom: false,
  }), {
    center: [0, 0.35, 0],
    // 上のほうだけ雪。境目をぼかしすぎないほうが山らしい。
    colFn: (px, py) => {
      const snow = smoothstep(0.70, 0.80, py);
      const rock = [0.34, 0.36, 0.48], white = [1.35, 1.38, 1.45];
      return [lerp(rock[0], white[0], snow), lerp(rock[1], white[1], snow), lerp(rock[2], white[2], snow)];
    },
  });
  return b.build();
}

// ---------------- ☀️ 太陽 ----------------
// ただの円板。まわりの光はパーティクルで足す。
function buildSunMesh() {
  const b = new PropBuilder();
  b.add(sphereGeometry(20, 14), { center: [0, 0, 0], col: [3.2, 2.5, 1.5] });
  return b.build();
}

// ---------------- 🌍 地球 ----------------
// 海と陸を頂点カラーで描く。テクスチャは使わない。
// 陸のかたちは、いくつかの「大陸のもと」からの距離で決める。
// [緯度, 経度, 大きさ]（rad）。ほんとうの位置で置く。
const EARTH_LAND = [
  // ★大きくしすぎると全部つながって「緑の惑星」になる。
  //   海のすきまが見えるくらい、ひかえめにとる。
  [ 0.95,  1.10, 0.30], [ 0.88,  1.75, 0.26],  // シベリア
  [ 0.75,  0.42, 0.26],                        // ロシア西〜北欧
  [ 0.60,  1.30, 0.30], [ 0.48,  1.62, 0.24],  // 中国北〜モンゴル
  [ 0.38,  1.32, 0.20], [ 0.24,  1.72, 0.14],  // 中国南〜東南アジア
  [ 0.46,  0.16, 0.17],                        // ヨーロッパ
  [ 0.28,  0.60, 0.20],                        // 中東
  [ 0.20,  0.30, 0.24], [ 0.02,  0.40, 0.24],  // サハラ〜アフリカ中央
  [-0.30,  0.45, 0.20],                        // アフリカ南
  [ 0.46, -1.85, 0.24], [ 0.62, -1.55, 0.22],  // 北アメリカ
  [ 0.30, -1.35, 0.16],
  [-0.10, -1.05, 0.18], [-0.40, -1.15, 0.16],  // 南アメリカ
  [-0.42,  2.30, 0.20],                        // オーストラリア
  [ 0.42,  1.50, 0.16],                        // インド
  // ★日本（弓なりに3つ置いて、細長い列島にする）
  [ 0.76,  2.48, 0.045], [ 0.63, 2.42, 0.050], [ 0.55, 2.33, 0.040],
  [ 0.63,  2.20, 0.055],                       // 朝鮮半島
];
const JAPAN_LAT = 0.628, JAPAN_LON = 2.409;

function buildEarthMesh() {
  const b = new PropBuilder();
  // ★「宇宙に出るころ、下に日本が見える」ようにする。
  //   地球はプレイヤーの真下にあるので、球の +Y にあたる面がこちらを向く。
  //   そこで、日本の向きが +Y に来るよう座標を回してから緯度経度を引く。
  //   （land の座標はほんものの緯度経度のまま。回すのは引くときだけ）
  const cLon = Math.cos(JAPAN_LON), sLon = Math.sin(JAPAN_LON);
  const a = JAPAN_LAT - Math.PI / 2, cA = Math.cos(a), sA = Math.sin(a);
  const toGeo = (x, y, z) => {
    // Rz(lat-π/2) → Ry(lon)
    const x1 = x * cA - y * sA, y1 = x * sA + y * cA, z1 = z;
    // ★符号に注意。逆に回すと東経138度が西経138度になり、
    //   日本のかわりにカリフォルニア沖が上を向いてしまう。
    return [x1 * cLon - z1 * sLon, y1, x1 * sLon + z1 * cLon];
  };

  b.add(sphereGeometry(52, 34), {
    center: [0, 0, 0],
    colFn: (px, py, pz) => {
      const g = toGeo(px, py, pz);
      const lat = _lat(g[0], g[1], g[2]);
      const lon = _lon(g[0], g[1], g[2]);
      let land = 0;
      for (const [la, lo, sz] of EARTH_LAND) {
        // へりを立てて海岸線をはっきりさせる（ぼかすと大陸がつながる）
        land = Math.max(land, smoothstep(sz, sz * 0.72, _angDist(lat, lon, la, lo)));
      }
      const ice = smoothstep(1.16, 1.42, Math.abs(lat));           // 極の氷
      // 雲。白い渦がすこしあるだけで、ぐっと地球に見える。
      const cloud = smoothstep(0.52, 0.86,
        Math.sin(lat * 5.3 + Math.sin(lon * 2.1) * 1.4) * 0.5 +
        Math.sin(lon * 4.1 - lat * 3.7) * 0.5);
      const sea  = [0.20, 0.44, 0.95];
      const soil = [0.33, 0.64, 0.33];
      const snow = [1.30, 1.34, 1.42];
      let c = [lerp(sea[0], soil[0], land), lerp(sea[1], soil[1], land), lerp(sea[2], soil[2], land)];
      c = [lerp(c[0], snow[0], ice), lerp(c[1], snow[1], ice), lerp(c[2], snow[2], ice)];
      return [lerp(c[0], 1.25, cloud * 0.45), lerp(c[1], 1.28, cloud * 0.45), lerp(c[2], 1.34, cloud * 0.45)];
    },
  });
  return b.build();
}

// ---------------- ✈️ 飛行機 ----------------
// 気球より上、雲の高さを横切っていく。+X が進む向き。
function buildPlaneMesh() {
  const b = new PropBuilder();
  // 胴体
  b.add(loftGeometry({
    rings: 12, radial: 10, k: 2.2, minR: 0.008,
    profile: t => { const r = catmull([0.030, 0.062, 0.070, 0.062, 0.030], t); return [r, r]; },
    spine: t => [0, t * 0.86 - 0.40, 0],
  }), { center: [0,0,0], rot: [0, 0, -Math.PI/2], col: [1.25, 1.28, 1.35] });
  // 主翼（うしろへ少し後退させる）
  for (const s of [-1, 1]) {
    b.add(loftGeometry({
      rings: 6, radial: 6, k: 2.8, minR: 0.004,
      profile: t => [catmull([0.085, 0.070, 0.050, 0.030], t), catmull([0.018, 0.014, 0.010, 0.005], t)],
      spine: t => [0, t * 0.40, 0],
    }), { offset: [-0.03, -0.01, 0], rot: [s * (Math.PI/2 - 0.10), 0, 0.16],
          center: [0,0,0], col: [1.15, 1.18, 1.28] });
  }
  // 尾翼（水平）
  for (const s of [-1, 1]) {
    b.add(loftGeometry({
      rings: 4, radial: 6, k: 2.8, minR: 0.004,
      profile: t => [catmull([0.042, 0.030, 0.016], t), catmull([0.010, 0.008, 0.004], t)],
      spine: t => [0, t * 0.15, 0],
    }), { offset: [-0.34, 0.01, 0], rot: [s * (Math.PI/2 - 0.14), 0, 0.20],
          center: [0,0,0], col: [1.10, 1.14, 1.24] });
  }
  // 尾翼（垂直）
  b.add(loftGeometry({
    rings: 4, radial: 6, k: 2.8, minR: 0.004,
    profile: t => [catmull([0.010, 0.008, 0.004], t), catmull([0.050, 0.034, 0.016], t)],
    spine: t => [0, t * 0.16, 0],
  }), { offset: [-0.35, 0.02, 0], center: [0,0,0], col: [0.95, 1.05, 1.30] });
  // エンジン2基
  for (const s of [-1, 1]) {
    b.add(loftGeometry({
      rings: 3, radial: 8, k: 2.0, minR: 0.006,
      profile: () => [0.026, 0.026],
      spine: t => [0, t * 0.10 - 0.05, 0],
    }), { offset: [0.02, -0.035, s * 0.17], rot: [0, 0, -Math.PI/2],
          center: [0,0,0], col: [0.80, 0.83, 0.92] });
  }
  // 客室の窓（帯）
  b.add(loftGeometry({
    rings: 2, radial: 4, k: 6.0, minR: 0.004,
    profile: () => [0.5, 0.5],
    spine: t => [0, t * 0.008, 0],
  }), { offset: [0.02, 0.030, 0], scale: [0.34, 1, 0.012],
        center: [0,0,0], col: [2.2, 2.2, 1.7] });
  return b.build();
}

// ============================================================
//  天体
//   ★色を変えただけの球にしない。どの星も、一目で名前が分かる
//     「これがあるからこの星」という特徴をきちんと作る。
//       月     … 本物のクレーターのくぼみと、暗い「海」
//       火星   … 極冠・マリネリス峡谷・暗い模様
//       木星   … 縞と大赤斑
//       土星   … 環とカッシーニの間隙
//       天王星 … 横倒しの環
//       海王星 … 大暗斑と、白い雲すじ
//       冥王星 … ハートのもよう（トンボー領域）
// ============================================================

// 球面上の点 → 緯度・経度
const _lat = (x, y, z) => Math.asin(clamp(y, -1, 1));
const _lon = (x, y, z) => Math.atan2(z, x);
// 経度の差（-π..π）
function _dlon(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI*2; while (d < -Math.PI) d += Math.PI*2; return d; }
// 球面上の2点の角きょり
function _angDist(la1, lo1, la2, lo2) {
  const dl = _dlon(lo1, lo2);
  return Math.hypot(la1 - la2, dl * Math.cos((la1 + la2) * 0.5));
}

// 惑星のひな形。displace と colFn を差しかえるだけで作れる。
function makePlanet(seg, opt) {
  const b = new PropBuilder();
  b.add(sphereGeometry(seg[0], seg[1]), Object.assign({ center: [0, 0, 0] }, opt));
  return b;
}

// ---------------- 🌙 月 ----------------
// 本物のクレーターは「くぼみ ＋ もり上がったふち」。この2つが無いと
// ただの まだら模様になり、クレーターに見えない。
const MOON_CRATERS = [
  // [緯度, 経度, 大きさ, 深さ]
  [ 0.30, -0.55, 0.34, 1.0], [-0.42,  0.95, 0.26, 0.9], [ 0.62,  1.85, 0.22, 0.8],
  [-0.15, -1.90, 0.20, 0.85],[ 0.05,  0.35, 0.16, 0.7], [-0.70, -0.40, 0.18, 0.7],
  [ 0.45,  2.70, 0.14, 0.6], [-0.55,  2.10, 0.12, 0.6], [ 0.18,  1.20, 0.11, 0.55],
  [-0.30, -1.05, 0.10, 0.5], [ 0.80, -1.60, 0.13, 0.6], [-0.05,  2.95, 0.09, 0.5],
];
// 暗い「海」（月のもよう。うさぎに見えるところ）
const MOON_MARIA = [
  [ 0.42, -0.30, 0.50], [ 0.18, -0.85, 0.40], [ 0.62,  0.25, 0.34],
  [-0.05, -0.20, 0.30], [ 0.30,  0.55, 0.26],
];
function buildMoonMesh() {
  return makePlanet([56, 38], {
    displace: (x, y, z) => {
      const la = _lat(x, y, z), lo = _lon(x, y, z);
      let d = 0;
      for (const [cla, clo, r, dep] of MOON_CRATERS) {
        const t = _angDist(la, lo, cla, clo) / r;
        if (t > 1.25) continue;
        // 内がわはくぼみ、ふち（t≈0.85〜1.0）はもり上がる
        d += (-dep * 0.055 * smoothstep(1.0, 0.35, t))
           + ( dep * 0.026 * (smoothstep(0.72, 0.95, t) * smoothstep(1.22, 0.98, t)));
      }
      return d;
    },
    colFn: (x, y, z) => {
      const la = _lat(x, y, z), lo = _lon(x, y, z);
      let mare = 0;
      for (const [cla, clo, r] of MOON_MARIA) {
        mare = Math.max(mare, smoothstep(r, r * 0.45, _angDist(la, lo, cla, clo)));
      }
      const n = Math.sin(x * 21.1 + 1.3) * Math.cos(z * 18.7 - 0.7) * 0.05;
      // 白くとばさない。灰色にしておくと、クレーターの陰影が見える。
      const base = lerp(0.78, 0.46, mare) + n;
      return [base, base * 0.99, base * 0.96];
    },
  }).build();
}

// ---------------- 🔴 火星 ----------------
function buildMarsMesh() {
  return makePlanet([56, 38], {
    displace: (x, y, z) => {
      const la = _lat(x, y, z), lo = _lon(x, y, z);
      // オリンポス山（太陽系でいちばん高い山）
      const olymp = smoothstep(0.30, 0.0, _angDist(la, lo, 0.32, -2.30)) * 0.030;
      // マリネリス峡谷（赤道にそった長い谷）
      const val = smoothstep(0.13, 0.0, Math.abs(la + 0.14)) *
                  smoothstep(1.05, 0.75, Math.abs(_dlon(lo, -1.15))) * -0.022;
      return olymp + val;
    },
    colFn: (x, y, z) => {
      const la = _lat(x, y, z), lo = _lon(x, y, z);
      const ice = smoothstep(1.19, 1.40, Math.abs(la));                    // 極冠
      // 暗い模様（大シルチス など）
      let dark = Math.max(
        smoothstep(0.42, 0.10, _angDist(la, lo, 0.16, 1.15)),
        smoothstep(0.34, 0.10, _angDist(la, lo, -0.30, 0.30)));
      const val = smoothstep(0.13, 0.0, Math.abs(la + 0.14)) *
                  smoothstep(1.05, 0.78, Math.abs(_dlon(lo, -1.15)));
      dark = Math.max(dark, val * 0.75);
      const n = Math.sin(x * 15.3 + 0.9) * Math.cos(y * 12.1) * 0.045;
      const soil = [1.00 + n, 0.52 + n * 0.6, 0.33 + n * 0.4];
      const c = [lerp(soil[0], 0.62, dark * 0.55), lerp(soil[1], 0.34, dark * 0.55), lerp(soil[2], 0.26, dark * 0.55)];
      const snow = [1.45, 1.42, 1.40];
      return [lerp(c[0], snow[0], ice), lerp(c[1], snow[1], ice), lerp(c[2], snow[2], ice)];
    },
  }).build();
}

// 縞もようの共通部分。ガス惑星はこれで作る。
function bandColor(bands, y, jitter) {
  const t = (y + 1) * 0.5;
  let i = clamp(Math.floor(t * (bands.length - 1) + jitter), 0, bands.length - 2);
  const f = clamp(t * (bands.length - 1) + jitter - i, 0, 1);
  const a = bands[i], b = bands[i + 1];
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}

// ---------------- 🟠 木星 ----------------
const JUP_BANDS = [
  [0.72,0.58,0.46],[1.00,0.88,0.72],[0.86,0.62,0.44],[1.05,0.94,0.80],
  [0.78,0.54,0.40],[1.02,0.90,0.74],[0.88,0.66,0.48],[1.00,0.86,0.70],
  [0.74,0.56,0.42],[0.96,0.84,0.70],[0.70,0.56,0.46],
];
function buildJupiterMesh() {
  return makePlanet([60, 40], {
    colFn: (x, y, z) => {
      const la = _lat(x, y, z), lo = _lon(x, y, z);
      // 縞のゆらぎ（帯がまっすぐだと絵に見えない）
      const j = Math.sin(lo * 3.1 + y * 6.0) * 0.22 + Math.sin(lo * 7.7 - y * 3.3) * 0.10;
      let c = bandColor(JUP_BANDS, y, j);
      // 🔴 大赤斑。位置と大きさは本物に寄せる（南半球・横に長い楕円）
      const dl = _dlon(lo, -0.85), dla = la + 0.38;
      const spot = smoothstep(1.0, 0.25, Math.hypot(dl / 0.62, dla / 0.24));
      const red = [1.05, 0.42, 0.30];
      c = [lerp(c[0], red[0], spot), lerp(c[1], red[1], spot), lerp(c[2], red[2], spot)];
      return c;
    },
  }).build();
}

// ---------------- 🪐 土星 ----------------
const SAT_BANDS = [
  [0.86,0.76,0.58],[1.06,0.98,0.80],[0.94,0.84,0.64],[1.10,1.02,0.84],
  [0.98,0.88,0.68],[1.08,1.00,0.82],[0.90,0.80,0.62],[0.84,0.74,0.58],
];
function buildSaturnMesh() {
  return makePlanet([60, 40], {
    colFn: (x, y, z) => {
      const lo = _lon(x, y, z);
      const j = Math.sin(lo * 2.6 + y * 5.0) * 0.16;
      return bandColor(SAT_BANDS, y, j);
    },
  }).build();
}

// 環。すきまは「色を暗くする」のではなく、本当にジオメトリを切って作る。
// 半とうめいが使えない場所なので、切らないと隙間に見えない。
//   bands: [[内半径, 外半径, 明るさ], ...]
function buildRingMesh(bands, tilt) {
  const b = new PropBuilder();
  for (const [ri, ro, br] of bands) {
    const g = ringGeometry(ri, ro, 84);
    b.add(g, {
      center: [0, 0, 0],
      // ★傾きはメッシュに焼きこむ。インスタンスはY軸まわりの回転しか持たないので、
      //   ここで傾けておかないと、環が真上から見た輪にしかならない。
      rot: [tilt || 0, 0, 0],
      colFn: (x, y, z) => {
        const r = Math.hypot(x, z);
        const t = (r - ri) / Math.max(1e-4, ro - ri);
        // 帯のなかの細かい濃淡
        const fine = 0.82 + 0.18 * Math.sin(t * 26 + ri * 9) * Math.cos(t * 11 - ri * 5);
        const k = br * fine;
        return [k, k * 0.95, k * 0.84];
      },
    });
  }
  return b.build();
}
// 土星の環（Cリング／Bリング／カッシーニの間隙／Aリング）
function buildSaturnRingMesh() {
  return buildRingMesh([
    [1.24, 1.52, 0.72],   // C（うすい）
    [1.55, 1.94, 1.35],   // B（いちばん明るい）
    // 1.94〜2.02 がカッシーニの間隙。ここは何も置かない＝本当のすきま
    [2.02, 2.28, 1.05],   // A
  ], 0.44);
}

// ---------------- 🔵 天王星 ----------------
// 横倒しの自転軸。環がほぼ縦向きに見えるのが最大の特徴。
function buildUranusMesh() {
  return makePlanet([48, 32], {
    colFn: (x, y, z) => {
      const la = _lat(x, y, z);
      const k = 0.92 + Math.cos(la * 2.2) * 0.10;
      return [0.52 * k, 0.94 * k, 0.98 * k];
    },
  }).build();
}
function buildUranusRingMesh() {
  // 天王星は横倒し。環がほぼ縦向きに見えるのが最大の特徴。
  return buildRingMesh([[1.55, 1.62, 0.85], [1.72, 1.76, 0.70], [1.86, 1.92, 0.95]], 1.36);
}

// ---------------- 🔷 海王星 ----------------
function buildNeptuneMesh() {
  return makePlanet([48, 32], {
    colFn: (x, y, z) => {
      const la = _lat(x, y, z), lo = _lon(x, y, z);
      const k = 0.90 + Math.cos(la * 2.6) * 0.12;
      let c = [0.24 * k, 0.42 * k, 1.05 * k];
      // 大暗斑
      const dl = _dlon(lo, 0.60), dla = la + 0.30;
      const spot = smoothstep(1.0, 0.3, Math.hypot(dl / 0.42, dla / 0.20));
      c = [lerp(c[0], 0.12, spot), lerp(c[1], 0.20, spot), lerp(c[2], 0.58, spot)];
      // 白いすじ雲
      const cl = smoothstep(0.55, 0.9, Math.sin(la * 9.0 + Math.sin(lo * 3.0) * 1.2));
      return [lerp(c[0], 1.25, cl * 0.55), lerp(c[1], 1.30, cl * 0.55), lerp(c[2], 1.40, cl * 0.55)];
    },
  }).build();
}

// ---------------- 🤍 冥王星 ----------------
// ハートのもよう（トンボー領域）。これがあるだけで冥王星だと分かる。
function buildPlutoMesh() {
  return makePlanet([44, 30], {
    colFn: (x, y, z) => {
      const la = _lat(x, y, z), lo = _lon(x, y, z);
      // ハート＝丸2つ ＋ 下の三角
      const dl = _dlon(lo, 0.0);
      let heart = Math.max(
        smoothstep(0.30, 0.10, Math.hypot(dl + 0.20, (la - 0.10) * 1.15)),
        smoothstep(0.30, 0.10, Math.hypot(dl - 0.20, (la - 0.10) * 1.15)));
      const tri = (la < 0.12 && la > -0.55 && Math.abs(dl) < 0.42 * (1 + (la + 0.55) / 0.67)) ? 1 : 0;
      heart = Math.max(heart, tri * smoothstep(-0.58, -0.40, la));
      const n = Math.sin(x * 13.7) * Math.cos(z * 11.3) * 0.06;
      const rock = [0.62 + n, 0.54 + n, 0.50 + n];
      const ice  = [1.35, 1.30, 1.18];
      return [lerp(rock[0], ice[0], heart), lerp(rock[1], ice[1], heart), lerp(rock[2], ice[2], heart)];
    },
  }).build();
}

// ---------------- 🛰 人工衛星（大気圏を出たあとのお邪魔役）----------------
// 箱の本体 ＋ 左右に伸びる太陽電池パネル ＋ 小さなパラボラ。
// このシルエットなら、小さく映っても「人工衛星」と分かる。
function buildSatelliteMesh() {
  const b = new PropBuilder();
  // 本体（金色の断熱材をまとった箱）
  b.add(loftGeometry({
    rings: 2, radial: 4, k: 6.0, minR: 0.01,
    profile: () => [0.16, 0.16],
    spine: t => [0, t * 0.30 - 0.15, 0],
  }), { center: [0,0,0], flat: true, col: [1.55, 1.20, 0.45] });

  // 太陽電池パネル（左右へ長く。ここがいちばん目立つ）
  for (const s of [-1, 1]) {
    // 支柱
    b.add(tubeGeometry(t => [s * (0.16 + t * 0.16), 0, 0], 0.016, 4, 5),
          { center: [0,0,0], col: [0.85, 0.86, 0.92] });
    // パネル本体（うすい板）
    b.add(loftGeometry({
      rings: 2, radial: 4, k: 6.0, minR: 0.004,
      profile: () => [0.5, 0.5],
      spine: t => [0, t * 0.020, 0],
    }), {
      offset: [s * 0.62, 0, 0], scale: [0.60, 1, 0.30],
      center: [0,0,0], flat: true, col: [0.30, 0.42, 1.35],
    });
    // パネルの枠（ますめが見えると「太陽電池」に見える）
    for (let i = -1; i <= 1; i++) {
      b.add(loftGeometry({
        rings: 1, radial: 4, k: 6.0, minR: 0.003,
        profile: () => [0.5, 0.5],
        spine: t => [0, t * 0.026, 0],
      }), {
        offset: [s * (0.62 + i * 0.20), 0, 0], scale: [0.020, 1, 0.30],
        center: [0,0,0], flat: true, col: [0.95, 1.00, 1.20],
      });
    }
  }
  // 通信用のパラボラ（下向き＝地球を見ている）
  b.add(loftGeometry({
    rings: 5, radial: 12, k: 2.0, minR: 0.006,
    profile: t => [0.02 + t * 0.10, 0.02 + t * 0.10],
    spine: t => [0, -0.15 - t * 0.09, 0],
  }), { center: [0,0,0], col: [1.35, 1.38, 1.45] });
  // アンテナの棒
  b.add(tubeGeometry(t => [0, 0.15 + t * 0.20, 0], 0.010, 4, 5),
        { center: [0,0,0], col: [0.90, 0.92, 1.00] });
  return b.build();
}

// ---------------- 🪖 宇宙服のヘルメット ----------------
// 宇宙ステーションで装着する。とうめいなドーム ＋ 首まわりのリング。
// 本体とは別に、いちばん最後に半とうめいで描く。
function buildHelmetMesh() {
  const b = new PropBuilder();
  // ドーム
  b.add(sphereGeometry(24, 16, { vFrom: 0.30, vTo: 1 }), {
    center: [0, 0, 0], col: [1.30, 1.40, 1.65],
  });
  return b.build();
}
// 首まわりのリング（こちらは不とうめいで描く）
function buildHelmetRingMesh() {
  const b = new PropBuilder();
  b.add(loftGeometry({
    rings: 2, radial: 16, k: 2.0, minR: 0.01,
    profile: () => [0.325, 0.325],
    spine: t => [0, t * 0.075 - 0.037, 0],
  }), { center: [0,0,0], col: [1.45, 1.48, 1.60] });
  return b.build();
}

// ---------------- 🌐 地面（地球のおもて）----------------
// ★ここがいちばん大事な考えかた。
//   200mのビルと半径6371kmの地球は、ひとつの物差しには載らない
//   （同じ縮尺だとビルは1ピクセルより小さい）。
//   だから「近くのもの」と「遠くのもの」は別の縮尺で描き、
//   そのあいだを、見た目がつながるように受けわたす。
//
//   その土台になるのがこの地面。
//   低いところでは半径をうんと大きくして「ほぼ平らな地面」に、
//   登るほど半径を小さくしていくと、そのまま地球の丸みになる。
//   富士山も街も、この面の上に置く。だから絶対に宙に浮かない。
function buildGroundMesh() {
  const b = new PropBuilder();
  b.add(sphereGeometry(72, 44), {
    center: [0, 0, 0],
    colFn: (x, y, z) => {
      // 上（＝カメラのま下）が日本のあたり。そこから離れるほど海になる。
      const d = Math.acos(clamp(y, -1, 1));          // 天頂からの角きょり
      // 陸のもよう。まん中に本州、まわりに海。
      const lon = Math.atan2(z, x);
      const island =
        smoothstep(0.34, 0.10, Math.hypot(d - 0.06, 0)) * 1.0 +
        smoothstep(0.20, 0.05, Math.abs(d - 0.30 - Math.sin(lon * 2.0) * 0.07)) * 0.7;
      const land = clamp(island, 0, 1);
      const green = [0.30, 0.52, 0.28];
      const sea   = [0.16, 0.34, 0.62];
      // 遠くの海ほど、もやで白っぽくなる（空気のぶん）
      const haze  = smoothstep(0.55, 1.25, d);
      let c = [lerp(sea[0], green[0], land), lerp(sea[1], green[1], land), lerp(sea[2], green[2], land)];
      c = [lerp(c[0], 0.72, haze), lerp(c[1], 0.80, haze), lerp(c[2], 0.95, haze)];
      // うすい雲
      const cloud = smoothstep(0.55, 0.9, Math.sin(d * 22 + lon * 3.1) * 0.5 + Math.sin(lon * 7.3) * 0.5);
      return [lerp(c[0], 1.15, cloud * 0.30), lerp(c[1], 1.18, cloud * 0.30), lerp(c[2], 1.25, cloud * 0.30)];
    },
  });
  return b.build();
}
