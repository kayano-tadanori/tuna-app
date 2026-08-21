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
// 遠くのビル用の、うんと軽いメッシュ。
//  ★近くのビルと同じ 124段のメッシュを遠景にも使うと、620棟で三角が120万枚になり
//    実測で**3倍重くなった**。遠くのビルは画面で1〜5pxしかないので、窓の段は見えない。
//    段を10にして、輪郭線も付けない（`flat` のまま面だけ）。
function buildBuildingFarMesh() {
  const b = new PropBuilder();
  const ROWS = 6;
  b.add(loftGeometry({
    rings: ROWS, radial: 4, k: 6.0, minR: 0.02,
    profile: t => { const r = 0.5 - t * 0.05; return [r, r]; },
    spine: t => [0, t, 0],
  }), {
    center: [0, 0.5, 0], flat: true,
    colFn: (px, py) => {
      const t = clamp(py, 0, 1);
      const wall = 0.44 + t * 0.32;
      // 段は残すが、うんと粗く。遠くでも「窓のある建物」に見える最小限。
      const f = t * ROWS;
      const win = smoothstep(0.30, 0.46, f % 1) * smoothstep(0.72, 0.56, f % 1) * 0.55;
      const c = [wall, wall * 1.04, wall * 1.22];
      return [lerp(c[0], 1.0, win), lerp(c[1], 0.98, win), lerp(c[2], 0.78, win)];
    },
  });
  return b.build();
}

function buildBuildingMesh() {
  const b = new PropBuilder();
  // ★階の数。少ないと近くで見たとき「太いしま模様」になってしまう。
  const ROWS = 62;
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
      // 窓を明るくしすぎない。近くで見ると まぶしい しま模様になる。
      const w = 1.12 * lit;
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
  // 大きく映すようになったので、分割を上げる（前は 22×26 で稜線がカクカクした）
  // ★雪の線を、尾根や谷なりに少しゆらす。まっすぐな線で切ると
  //   「白いキャップをかぶせた円すい」に見えて、山に見えない。
  const snowLine = (px, pz) => {
    const a = Math.atan2(pz, px);
    return 0.615 + Math.sin(a * 7.0) * 0.028 + Math.sin(a * 3.0 + 1.1) * 0.036;
  };
  const paint = (px, py, pz) => {
    const s0 = snowLine(px, pz);
    const snow = smoothstep(s0, s0 + 0.085, py);
    // ★もやで全部を灰色にしない。岩は青むらさき、雪は白。この差がないと山に見えない。
    const rock = [0.33, 0.39, 0.58], white = [1.46, 1.49, 1.56];
    const c = [lerp(rock[0], white[0], snow), lerp(rock[1], white[1], snow), lerp(rock[2], white[2], snow)];
    // 裾ほど もや に沈む（遠さが出る）。52km まで寄せたので、前より薄くする。
    const haze = smoothstep(0.26, 0.0, py) * 0.20;   // 42km まで寄せたので薄く
    return [lerp(c[0], 0.62, haze), lerp(c[1], 0.70, haze), lerp(c[2], 0.88, haze)];
  };

  b.add(loftGeometry({
    rings: 34, radial: 44, k: 2.0, minR: 0.01,
    // 裾がゆっくり広がる曲線。まっすぐな円すいだと三角の山になってしまう。
    // ★てっぺんを一点にしない。本物の富士山の山頂には直径700mの火口があって
    //   平らに見える。とがらせると「とんがり帽子」になる。
    profile: t => {
      const r = Math.pow(1 - t, 1.55) * 0.5 + 0.006;
      return t > 0.955 ? [0.030, 0.030] : [r, r];
    },
    spine: t => [0, t, 0],
    capTop: true, capBottom: false,
  }), { center: [0, 0.35, 0], colFn: paint });

  // 🏔 宝永山（ほうえいざん）。南東の中腹にある、1707年の噴火でできたこぶ。
  //   ★富士山が「左右対称の三角」でないのは、これがあるから。
  //     これを入れるだけで、絵に描いた山ではなく富士山に見える。
  b.add(loftGeometry({
    rings: 12, radial: 18, k: 2.0, minR: 0.008,
    profile: t => { const r = Math.pow(1 - t, 1.4) * 0.5 + 0.004; return [r, r]; },
    spine: t => [0, t, 0],
    capTop: true, capBottom: false,
  }), {
    offset: [0.196, 0.0, 0.052], scale: [0.30, 0.255, 0.30],
    center: [0, 0.35, 0], colFn: paint,
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

  // ★画面いっぱいに映ることがあるので、粗いと海岸線がカクカクになる
  b.add(sphereGeometry(84, 56), {
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
// ✈️ ジャンボ（747）。**近くをかすめて飛ぶ**ぶんだけ、形を作りこむ。
//  見わけの決め手は3つ。①前のほうの**二階建てのこぶ** ②主翼の下の**4つのエンジン**
//  ③大きくうしろへ寝た主翼。この3つがあれば、一目でジャンボになる。
function buildJumboMesh() {
  const b = new PropBuilder();
  // ★機首は **+X**、しっぽは −X。向きを変えるときはここを思い出すこと。
  const BODY = [1.24, 1.28, 1.36], WING = [1.10, 1.14, 1.24];
  const GLASS = [0.16, 0.20, 0.30], BELLY = [0.86, 0.88, 0.96];
  const STRIPE = [0.30, 0.42, 1.15], ENG = [0.98, 1.02, 1.12];

  // 胴体
  b.add(loftGeometry({
    rings: 22, radial: 14, k: 2.2, minR: 0.008,
    profile: t => { const r = catmull([0.018, 0.070, 0.082, 0.078, 0.026], t); return [r, r]; },
    spine: t => [0, t * 1.30 - 0.62, 0],
  }), { center: [0, 0, 0], rot: [0, 0, -Math.PI / 2],
        colFn: (px, py) => (py < -0.030 ? BELLY : BODY) });   // 下まわりは少し暗く

  // 二階建てのこぶ（ジャンボの決め手その1）
  b.add(loftGeometry({
    rings: 12, radial: 12, k: 2.4, minR: 0.006,
    profile: t => { const r = catmull([0.014, 0.050, 0.054, 0.028], t); return [r, r * 0.66]; },
    spine: t => [0, t * 0.36, 0],
  }), { offset: [0.28, 0.058, 0], rot: [0, 0, -Math.PI / 2], center: [0.28, 0.05, 0], col: BODY });

  // 🪟 コックピットの窓（機首の上）。これがあると一気に「顔」がつく。
  b.add(cubeGeometry(), { offset: [0.545, 0.046, 0], scale: [0.075, 0.026, 0.075],
                          rot: [0, 0, -0.16], center: [0.545, 0.046, 0], flat: true, col: GLASS });
  // 客室の窓の帯（両がわ）
  for (const sgn of [-1, 1]) {
    b.add(cubeGeometry(), { offset: [-0.02, 0.020, sgn * 0.070], scale: [1.00, 0.017, 0.010],
                            center: [0, 0, 0], flat: true, col: GLASS });
    // 塗り分けの線（下の帯）。白一色だと おもちゃに見える。
    b.add(cubeGeometry(), { offset: [-0.02, -0.020, sgn * 0.071], scale: [1.02, 0.022, 0.010],
                            center: [0, 0, 0], flat: true, col: STRIPE });
  }
  // しっぽの塗り（垂直尾翼の色に合わせる）
  b.add(cubeGeometry(), { offset: [-0.50, 0.03, 0], scale: [0.16, 0.10, 0.086],
                          center: [-0.50, 0.03, 0], flat: true, col: STRIPE });

  // 主翼（うしろへ大きく後退）＋ ウイングレット ＋ エンジン4つ
  for (const sgn of [-1, 1]) {
    b.add(loftGeometry({
      rings: 10, radial: 6, k: 2.8, minR: 0.004,
      profile: t => [catmull([0.130, 0.104, 0.070, 0.032], t),
                     catmull([0.022, 0.017, 0.011, 0.005], t)],
      spine: t => [0, t * 0.64, 0],
    }), { offset: [-0.06, -0.014, 0], rot: [sgn * (Math.PI / 2 - 0.10), 0, 0.30],
          center: [0, 0, 0], col: WING });
    // ウイングレット（翼の先が上へ立っている）
    b.add(cubeGeometry(), { offset: [-0.26, 0.030, sgn * 0.62], scale: [0.075, 0.085, 0.012],
                            rot: [0, 0, 0.28], center: [-0.26, 0.03, sgn * 0.62],
                            flat: true, col: STRIPE });
    // ★エンジン4つ（片側2つ）。ジャンボの決め手その2。
    for (const [ex, ez] of [[0.02, 0.21], [-0.05, 0.38]]) {
      b.add(loftGeometry({
        rings: 6, radial: 10, k: 2.0, minR: 0.012,
        profile: t => { const r = catmull([0.034, 0.036, 0.032, 0.024], t); return [r, r]; },
        spine: t => [0, t * 0.15, 0],
      }), { offset: [ex, -0.052, sgn * ez], rot: [0, 0, -Math.PI / 2],
            center: [ex, -0.052, sgn * ez], col: ENG });
      // 吸いこみ口（前を黒く）。これで筒が「エンジン」になる。
      b.add(loftGeometry({
        rings: 2, radial: 10, k: 2.0, minR: 0.004,
        profile: () => [0.026, 0.026], spine: t => [0, t * 0.012, 0],
      }), { offset: [ex + 0.077, -0.052, sgn * ez], rot: [0, 0, -Math.PI / 2],
            center: [ex + 0.077, -0.052, sgn * ez], flat: true, col: GLASS });
      // 翼へつなぐ柱
      b.add(cubeGeometry(), { offset: [ex - 0.02, -0.030, sgn * ez], scale: [0.09, 0.040, 0.016],
                              center: [ex, -0.03, sgn * ez], flat: true, col: WING });
    }
  }
  // 尾翼（水平）
  for (const sgn of [-1, 1]) {
    b.add(loftGeometry({
      rings: 6, radial: 6, k: 2.8, minR: 0.004,
      profile: t => [catmull([0.062, 0.044, 0.020], t), catmull([0.013, 0.010, 0.005], t)],
      spine: t => [0, t * 0.26, 0],
    }), { offset: [-0.54, 0.012, 0], rot: [sgn * (Math.PI / 2 - 0.16), 0, 0.34],
          center: [0, 0, 0], col: WING });
  }
  // 尾翼（垂直）。高く立てるとジャンボらしい。
  b.add(loftGeometry({
    rings: 6, radial: 6, k: 2.8, minR: 0.004,
    profile: t => [catmull([0.013, 0.010, 0.005], t), catmull([0.082, 0.056, 0.026], t)],
    spine: t => [0, t * 0.28, 0],
  }), { offset: [-0.56, 0.02, 0], rot: [0, 0, 0.30], center: [0, 0, 0], col: STRIPE });
  return b.build();
}

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

// ---------------- ☄️ 彗星 ----------------
//  プラン §6.4 の `comet`。**空ではなく「もの」として作る。**
//  彗星は動くので、背景シェーダ（`skyFS`）では表せない。だから
//  惑星と同じインスタンスで置いて、加算合成でにじませる。
//
//  ★本物の彗星のしっぽは、**進む向きのうしろではなく、太陽と反対がわ**へのびる。
//    太陽の光と太陽風に吹かれているから。このゲームは太陽が下にあるので、
//    しっぽが**上へ**のびているのが正しい。ここは事実どおりに作る。
//
//  ★しっぽは2本ある。
//    イオンの尾 … まっすぐ・細い・青。太陽と正反対をきっちり向く
//    ダストの尾 … 太くて短い・黄白・**カーブして遅れる**（つぶが重いので）
//    この2本を描き分けると、一目で「彗星だ」と分かる。
//
//  lean = しっぽのかたむき（ラジアン）。太陽から見て横にいる彗星ほど傾く。
function buildCometMesh(lean) {
  const b = new PropBuilder();
  const L = lean || 0;

  // --- コマ（頭のぼんやり光る部分）---
  //  ★加算合成では、球を1枚置いても「のっぺりした円ばん」にしかならない。
  //    大きさのちがう球を重ねると、**重なった枚数がそのまま明るさ**になって、
  //    まん中ほど明るいにじみが作れる。
  //  色は緑がかった白。本物のコマが緑っぽいのは C₂ という分子が光るから。
  const coma = [
    [0.075, [3.20, 3.50, 2.70]],
    [0.155, [0.80, 1.10, 0.76]],
    [0.290, [0.22, 0.34, 0.24]],
  ];
  for (const [r, c] of coma) {
    b.add(sphereGeometry(14, 10), { scale: [r, r, r], center: [0, 0, 0], col: c });
  }

  // --- しっぽ ---
  //  ★色は colFn で「原点からの距離」を見て決める。y で決めると、
  //    かたむけた（rot）とたんに色の向きだけ回らずに壊れる。
  const tail = (len, w0, w1, curve) => loftGeometry({
    rings: 16, radial: 7, k: 2.0, minR: 0.004,
    profile: t => { const r = lerp(w0, w1, t); return [r, r]; },
    spine: t => [curve * t * t, t * len, 0],
  });
  const fade = (px, py, pz, len, pw) => {
    const d = Math.hypot(px, py, pz) / len;
    const f = Math.pow(Math.max(1 - d, 0), pw);
    return f;
  };
  // イオンの尾：まっすぐ・細い・青
  b.add(tail(3.00, 0.048, 0.215, 0.0), {
    rot: [0, 0, L], center: [0, 0, 0],
    colFn: (px, py, pz) => { const f = fade(px, py, pz, 3.00, 1.7);
      return [0.34 * f, 0.74 * f, 1.70 * f]; },
  });
  // ダストの尾：太く短く、カーブして遅れる・黄白
  // ★2本の角度をしっかり離すこと。近いと、明るいイオンの尾に飲まれて
  //   「尾は1本」に見える（実測でそうなった）。本物も、この2本のひらきで見分ける。
  b.add(tail(1.95, 0.130, 0.560, 0.62), {
    rot: [0, 0, L - 0.44], center: [0, 0, 0],
    colFn: (px, py, pz) => { const f = fade(px, py, pz, 1.95, 1.5);
      return [2.30 * f, 1.90 * f, 1.25 * f]; },
  });
  return b.build();
}

// ---------------- 🌠 流れ星 ----------------
//  彗星とちがって、これは「一瞬で通りすぎる光の帯」。
//  形を作りこむより、**頭が明るく・しっぽへ消えていく** ことだけを正しく出す。
//
//  ★向きは **+X が頭、−X がしっぽ**（飛行機やジャンボと同じ約束）。
//    長さはメッシュ空間で 1.0。頭が原点に来るように作ってあるので、
//    置くがわは「流れ星のいる場所＝頭の位置」として使える。
//
//  ★加算合成で描くので、影も陰もつかない。明暗は**頂点カラーだけ**で作る。
//    ここで一度ひっかかった：面が4頂点しかない箱に colFn で濃淡を描こうとしても、
//    4すみの色が補間されるだけで「にじんだ四角」にしかならない（星条旗と同じ罠）。
//    → ロフトの輪を **22段** に分けて、段ごとに色を変える。
function buildMeteorMesh() {
  const b = new PropBuilder();
  const L = 1.0;                       // 帯の長さ

  // px（最終位置のX）→ 0=しっぽの先, 1=頭。
  //  ★ py で見てはいけない。この帯はロフトを +Y で作ってから rot で倒すので、
  //    倒したあとに色を決めると、y はもう「帯にそった向き」ではない。
  //    colFn には**変換後の位置**が来るので、倒したあとの軸＝X で見るのが正しい。
  const glow = px => {
    const u = clamp(1 + px / L, 0, 1);                 // px は -L..0
    const f = Math.pow(u, 2.8);                        // しっぽへ行くほど急に消える
    // 頭は白、うしろへ行くほど青緑に冷えていく（本物の流星痕の色）
    return [f * (0.90 + 2.50 * u), f * (1.30 + 2.10 * u), f * (1.95 + 1.35 * u)];
  };

  // 光の帯。頭のすこし後ろがいちばん太い しずく形。
  //  ふたは付けない。加算合成ではふたが本体と重なって、そこだけ二重に明るくなる。
  b.add(loftGeometry({
    rings: 22, radial: 8, k: 2.0, minR: 0.003,
    profile: t => { const r = catmull([0.004, 0.020, 0.046, 0.062, 0.048], t); return [r, r]; },
    // t=0 がしっぽ(y=-L)、t=1 が頭(y=0)。
    //  ★ y が増える向きに作ること。減る向きの spine はロフトの法線を裏返す。
    spine: t => [0, t * L - L, 0],
    capTop: false, capBottom: false,
  }), {
    // +Y に作った帯を +X へ倒す（-π/2 まわしで +Y → +X）
    rot: [0, 0, -Math.PI / 2], center: [0, 0, 0],
    colFn: px => glow(px),
  });

  // 頭のにじみ。彗星のコマと同じ手で、大きさちがいの球を重ねて
  // 「重なった枚数＝明るさ」にする。これが無いと帯の先が ぷつっ と切れて見える。
  for (const [r, c] of [[0.030, [3.40, 3.50, 3.20]],
                        [0.062, [1.05, 1.25, 1.15]],
                        [0.110, [0.26, 0.36, 0.42]]]) {
    b.add(sphereGeometry(12, 8), { scale: [r, r, r], center: [0, 0, 0], col: c });
  }
  return b.build();
}

// ---------------- 🪨 目の前を横切る岩（近景）----------------
//  遠くの小惑星ではなく、**すぐそばを かすめていく** 一かたまり。
//  近いので、のっぺりした球だと一発で作り物とばれる。角を立ててゴツゴツさせる。
//  大きさはメッシュ空間で半径 0.2 くらい（かたまり全体の外まわり）。
function buildDebrisMesh() {
  const b = new PropBuilder();

  // ゴツゴツの式。props.js の `rockBump` と同じ考えかたを、この関数の中に持つ。
  //  ★読みこみ順に頼らないため（scenery.js だけ読むページがある）。
  //  ★振れはばに注意。displace の値は**スケールをかけたあとの位置**に足されるので、
  //    props.js の岩（半径0.4）用の強さのまま半径0.15のかけらに使うと、
  //    とげが半径と同じくらい飛び出して「うに」になる。0.28 倍に落とす。
  const bump = (x, y, z) => 0.28 * (
      Math.sin(x * 6.3 + 0.4) * Math.cos(z * 5.1 + 1.7) * 0.16 +
      Math.sin(y * 8.9 + 2.2) * Math.cos(x * 7.7 - 0.9) * 0.11 +
      Math.sin(z * 11.7 + 3.3) * 0.06);

  // 上の面は光を受けて明るく、下は暗く。この差だけで「重い岩」に見える。
  const colFn = (px, py, pz) => {
    const k = clamp((py + 0.16) / 0.34, 0, 1);
    // 一様な灰色は板に見えるので、細かいむらを足す
    const n = Math.sin(px * 19.3 + 0.7) * Math.cos(pz * 16.1 - 1.1) * 0.045;
    const g = 0.40 + k * 0.26 + n;
    return [g, g, g * 1.10];
  };

  // かたまりをいくつか重ねて、ひとつの岩にする。
  // [中心x, y, z, 半径, たての つぶれ, 向き]
  const CHUNKS = [
    [ 0.00,  0.00,  0.00, 0.150, 0.86, [ 0.40,  0.90,  0.30]],   // 主役
    [ 0.11, -0.03,  0.04, 0.088, 0.78, [ 1.10, -0.50, -0.75]],
    [-0.10,  0.04, -0.03, 0.076, 0.82, [-0.60,  1.70,  0.95]],
    [ 0.03,  0.09, -0.07, 0.055, 0.74, [ 1.90,  0.30, -0.40]],
    [-0.06, -0.07,  0.08, 0.048, 0.70, [ 0.25, -1.20,  1.40]],
  ];
  const s = sphereGeometry(10, 8);
  for (const [x, y, z, r, sq, rot] of CHUNKS) {
    b.add(s, {
      offset: [x, y, z], scale: [r, r * sq, r * 0.92], rot,
      // ★flat が要る。displace は位置を動かすだけで法線は球のままなので、
      //   これが無いと でこぼこ が一切 陰にならず、ただの丸い玉に見える。
      center: [0, 0, 0], displace: bump, flat: true, colFn,
    });
  }
  return b.build();
}

// ---------------- 🌏 大気のふち ----------------
// 地球の球より ほんの少し大きい球。ふちだけ青く光らせて、空気の層に見せる。
// ★色のついていない球にすること。地球のメッシュを使い回すと、
//   陸と海の色が そのまま ふちの色になってムラになる。
function buildAtmoMesh() {
  const b = new PropBuilder();
  b.add(sphereGeometry(40, 26), { center: [0, 0, 0], col: [1, 1, 1] });
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

// ---------------- 🟩 平らな地面（低い高度用）----------------
// ★低いところでは「地球の球」は使えない。
//   球の半径をワールドで150にすると、高度60mではカメラが球の面に乗ってしまい、
//   地面が真横から見た薄い帯になって、その下が黒く抜ける。
//   1万mより下は平らな板でいい（そもそも丸みは見えない）。
function buildFlatGroundMesh() {
  const b = new PropBuilder();
  // ★輪を1枚で作らない。ringGeometry の頂点は内と外の2周しかないので、
  //   海岸線も山なみも川も、ぜんぶ「2色の補間」に潰れて消える。
  //   同心の輪を重ねて刻みを持たせる。
  const RN = 40;
  // 「空から見た日本のあたり」。海・平野・山なみ・川。
  //
  //  ★もようは「半径の対数」で作る。
  //    ふつうに半径で作ると、低いところでは外がわの1割しか画面に入らず
  //    （近いところは真下すぎて見えない）、海岸線も山も一度も見えずに終わる。
  //    log で作れば、どの高さで見ても同じくらいの粗さのもようが視野に入る。
  const colFn = (x, y, z) => {
    const r = Math.max(Math.hypot(x, z), 1e-4);   // 0=足もと 1=地平線
    const a = Math.atan2(z, x);
    const L = Math.log(r);

    // --- 陸と海。いくつかの波を重ねて、大陸と湾をつくる
    const f = Math.sin(a * 1.7 + L * 2.3 + 0.6)
            + Math.sin(a * 3.1 - L * 1.4 - 1.1) * 0.62
            + Math.sin(a * 0.9 + L * 3.9 + 2.2) * 0.48
            + Math.sin(a * 6.3 + L * 0.8) * 0.20;
    // ★海岸線はぼかさない。ぼかすと「もやっとした緑と青」になって地形に見えない。
    const land = smoothstep(-0.05, 0.10, f);

    // --- 山なみ。陸のなかで、もう一つの波が高いところ
    const g = Math.sin(a * 2.6 - L * 3.1) + Math.sin(a * 5.3 + L * 1.7) * 0.7;
    const mount = smoothstep(0.55, 1.25, g) * land;

    // --- 街。平野（山でない陸）に、ぽつぽつと灰色のかたまり
    const t2 = Math.sin(a * 8.1 + L * 5.3) * Math.cos(a * 4.7 - L * 6.9);
    const town = smoothstep(0.30, 0.75, t2) * land * (1 - mount * 0.8);

    // --- 川。うねる細い線（まっすぐな線を引かない）
    const w = Math.sin(a * 2.2 - L * 4.1) + Math.sin(a * 5.7 + L * 2.3) * 0.5;
    const river = smoothstep(0.055, 0.0, Math.abs(w)) * land * (1 - mount * 0.6);

    // --- 細かいむら（一様な色は「板」に見える）
    const n = Math.sin(L * 37 + a * 3.1) * 0.5 + Math.sin(a * 23.3 - L * 29) * 0.5;

    const sea   = [0.11, 0.23, 0.40];
    const green = [0.28 + n * 0.04, 0.42 + n * 0.05, 0.25 + n * 0.03];
    const gray  = [0.47 + n * 0.06, 0.46 + n * 0.06, 0.45 + n * 0.06];
    const dark  = [0.17, 0.31, 0.20];
    let c = [lerp(sea[0], green[0], land), lerp(sea[1], green[1], land), lerp(sea[2], green[2], land)];
    c = [lerp(c[0], dark[0], mount), lerp(c[1], dark[1], mount), lerp(c[2], dark[2], mount)];
    c = [lerp(c[0], gray[0], town), lerp(c[1], gray[1], town), lerp(c[2], gray[2], town)];
    c = [lerp(c[0], 0.40, river), lerp(c[1], 0.50, river), lerp(c[2], 0.62, river)];
    // 地平線のきわだけ もや で白ばむ（空気のぶん）。広くとると地形が消える。
    const haze = smoothstep(0.86, 1.0, r);
    return [lerp(c[0], 0.72, haze), lerp(c[1], 0.79, haze), lerp(c[2], 0.90, haze)];
  };
  for (let i = 0; i < RN; i++) {
    const t0 = Math.max(0.003, Math.pow(i / RN, 1.5));
    const t1 = Math.pow((i + 1) / RN, 1.5);
    b.add(ringGeometry(t0, t1, 96), { center: [0, 0, 0], colFn });
  }
  return b.build();
}

// ============================================================
//  🌕 降り立つ地面（月・火星）
//
//   月と火星は「通りすぎる背景」ではなく、**足をつける場所**にする。
//   ここだけ足場が円周ぜんぶ＝どこに落ちても必ず着く。
//   立って、ひと息ついて、また飛ぶ。ここが物語の区切りになる。
//
//  ★平らな灰色の板にしない。クレーターの「くぼみ＋もり上がったふち」が
//    無いと月に見えない（背景の月と同じ理屈）。
// ============================================================
function buildSurfaceMesh(kind) {
  const b = new PropBuilder();
  const RN = 22;
  const moon = kind === 'moon';
  // [中心x, 中心z, 大きさ, 深さ] クレーター（正規化した半径の座標）
  const holes = [];
  {
    const r = mulberry32(moon ? 777001 : 777002);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = 0.08 + Math.pow(r(), 0.7) * 0.85;
      holes.push([Math.cos(a) * d, Math.sin(a) * d, 0.035 + r() * 0.085, 0.5 + r() * 0.5]);
    }
  }
  const colFn = (x, y, z) => {
    const r = Math.hypot(x, z);
    let dip = 0, rim = 0;
    for (const [cx, cz, cr, dep] of holes) {
      const t = Math.hypot(x - cx, z - cz) / cr;
      if (t > 1.3) continue;
      dip = Math.max(dip, smoothstep(1.0, 0.35, t) * dep);
      rim = Math.max(rim, smoothstep(0.75, 0.97, t) * smoothstep(1.25, 1.0, t) * dep);
    }
    const n = Math.sin(x * 37 + z * 23) * 0.5 + Math.sin(z * 41 - x * 29) * 0.5;
    // ★明るくしすぎない。上を向いた面は光をまともに受けるので、
    //   0.74 だと真っ白にとんでクレーターが1つも見えなくなる（実際そうなった）。
    let base = moon ? 0.40 + n * 0.05 : 0.52 + n * 0.06;
    base *= 1 - dip * 0.55;            // くぼみは暗い
    base *= 1 + rim * 0.40;            // ふちは光を受けて明るい
    const c = moon ? [base, base * 0.99, base * 0.97]
                   : [base, base * 0.50, base * 0.34];
    // 遠くはもや（ここでは「地平線が近い」＝小さい星なので、すぐ落ちる）
    const haze = smoothstep(0.66, 1.0, r);
    return [lerp(c[0], moon ? 0.16 : 0.20, haze),
            lerp(c[1], moon ? 0.16 : 0.11, haze),
            lerp(c[2], moon ? 0.19 : 0.09, haze)];
  };
  for (let i = 0; i < RN; i++) {
    const t0 = Math.max(0.003, Math.pow(i / RN, 1.4));
    const t1 = Math.pow((i + 1) / RN, 1.4);
    b.add(ringGeometry(t0, t1, 72), {
      // ★flat が要る。displace は位置を動かすだけで法線は元のまま（真上向き）なので、
      //   これが無いとクレーターが1つも陰影を持たず、のっぺりした灰色の板になる。
      center: [0, 0, 0], colFn, flat: true,
      // クレーターは色だけでなく、面そのものをへこませる
      displace: (px, py, pz) => {
        let d = 0;
        for (const [cx, cz, cr, dep] of holes) {
          const t = Math.hypot(px - cx, pz - cz) / cr;
          if (t > 1.3) continue;
          d += -dep * 0.032 * smoothstep(1.0, 0.35, t)
             +  dep * 0.016 * (smoothstep(0.75, 0.97, t) * smoothstep(1.28, 1.0, t));
        }
        return d;
      },
    });
  }
  const m = b.build();
  m.top = 0;
  return m;
}

// ---------------- 🐰 月のうさぎ（お餅つき）----------------
// 2D版の月面シーンに居るので、そのまま踏襲する。
// 小さく映るので、シルエットで読ませる：まるい体・長い耳・きねを振り上げる。
function buildMoonRabbitMesh() {
  const b = new PropBuilder();
  const fur = [1.35, 1.36, 1.42], pink = [1.30, 0.78, 0.82];
  // 体
  b.add(sphereGeometry(16, 12), {
    offset: [0, 0.20, 0], scale: [0.19, 0.21, 0.17],
    center: [0, 0.20, 0], col: fur,
  });
  // 頭
  b.add(sphereGeometry(16, 12), {
    offset: [0, 0.44, 0.03], scale: [0.135, 0.13, 0.125],
    center: [0, 0.44, 0.03], col: fur,
  });
  // 耳2本（長くて、少し開いている＝これでうさぎになる）
  for (const s of [-1, 1]) {
    b.add(loftGeometry({
      rings: 6, radial: 8, k: 2.4, minR: 0.006,
      profile: t => { const r = catmull([0.030, 0.042, 0.040, 0.022], t); return [r, r * 0.55]; },
      spine: t => [0, t * 0.30, 0],
    }), { offset: [s * 0.05, 0.50, 0.0], rot: [0.12, 0, s * 0.26],
          center: [s * 0.05, 0.62, 0], col: fur });
    b.add(loftGeometry({
      rings: 6, radial: 8, k: 2.4, minR: 0.004,
      profile: t => { const r = catmull([0.018, 0.026, 0.024, 0.012], t); return [r, r * 0.4]; },
      spine: t => [0, t * 0.27, 0],
    }), { offset: [s * 0.05, 0.51, 0.012], rot: [0.12, 0, s * 0.26],
          center: [s * 0.05, 0.62, 0], col: pink });
  }
  // 目
  for (const s of [-1, 1]) {
    b.add(sphereGeometry(8, 6), {
      offset: [s * 0.052, 0.46, 0.115], scale: [0.017, 0.020, 0.012],
      center: [s * 0.052, 0.46, 0.115], col: [0.10, 0.09, 0.11],
    });
  }
  // うで（きねを持ち上げている）
  for (const s of [-1, 1]) {
    b.add(tubeGeometry(t => [s * (0.14 + t * 0.05), 0.30 + t * 0.20, 0.02 + t * 0.06], 0.032, 6, 6),
          { center: [s * 0.16, 0.40, 0.05], col: fur });
  }
  // きね（横棒＋にぎり）
  b.add(tubeGeometry(t => [-0.16 + t * 0.34, 0.52 + t * 0.06, 0.08], 0.026, 8, 6),
        { center: [0, 0.55, 0.08], col: [0.86, 0.66, 0.40] });
  b.add(loftGeometry({
    rings: 2, radial: 10, k: 2.2, minR: 0.01,
    profile: () => [0.058, 0.058], spine: t => [0, t * 0.10 - 0.05, 0],
  }), { offset: [0.20, 0.60, 0.08], rot: [0, 0, -1.35],
        center: [0.20, 0.60, 0.08], col: [0.78, 0.58, 0.34] });
  // うす（前に置く）
  b.add(loftGeometry({
    rings: 5, radial: 14, k: 2.0, minR: 0.01,
    profile: t => { const r = catmull([0.115, 0.095, 0.090, 0.115], t); return [r, r]; },
    spine: t => [0, t * 0.16, 0],
  }), { offset: [0, 0, 0.30], center: [0, 0.08, 0.30], col: [0.62, 0.46, 0.30] });
  // おもち（白い玉）
  b.add(sphereGeometry(12, 8), {
    offset: [0, 0.155, 0.30], scale: [0.085, 0.045, 0.085],
    center: [0, 0.155, 0.30], col: [1.55, 1.55, 1.58],
  });
  return b.build();
}

// ---------------- 🚩 旗 ----------------
// 月面に立てる旗。2D版にもある。
// 🇺🇸 アポロの星条旗（月だけ）。
//  ★いちばん教えたいのは**横の棒**。月には空気がないので風がふかない。
//    だから旗はたれてしまう。そこでアポロは、旗の上に**棒を1本わたして**
//    ぴんと張らせた。写真ではためいて見えるのは、そのおかげ。
//  ★星は数を合わせない（50個は この大きさでは点にもならない）。
//    青い地に白いつぶ、が読めればいい。
function buildUsFlagMesh() {
  const b = new PropBuilder();
  const FW = 0.30, FH = 0.17, FX = 0.15, FY = 0.50;   // はたの 幅・高さ・置きどころ
  const TH = 0.008;
  // ポール
  b.add(tubeGeometry(t => [0, t * 0.62, 0], 0.012, 6, 6),
        { center: [0, 0.31, 0], col: [1.20, 1.24, 1.34] });
  // ★横の棒。これがアポロの旗の目じるし。
  b.add(tubeGeometry(t => [t * FW, 0, 0], 0.009, 6, 6),
        { offset: [0, FY + FH / 2, 0], center: [FX, FY + FH / 2, 0], col: [1.10, 1.14, 1.24] });

  // 🚨 しま模様を colFn で描こうとしてはいけない。
  //    colFn は**頂点ごと**に呼ばれる。箱の面は4頂点しかないので、
  //    赤と白があいだで混ざって「にじんだ四角」になる（実際そうなった）。
  //    → **帯を1本ずつ、別の箱として作る。**
  const cube = cubeGeometry();
  const RED = [1.45, 0.20, 0.22], WHITE = [1.50, 1.52, 1.58], BLUE = [0.20, 0.26, 0.80];
  const N = 13;                                   // はじめの13州
  const bh = FH / N;
  for (let i = 0; i < N; i++) {
    const y = FY - FH / 2 + bh * (i + 0.5);
    b.add(cube, { offset: [FX, y, 0], scale: [FW, bh, TH],
                  center: [FX, y, 0], flat: true, col: i % 2 === 0 ? RED : WHITE });
  }
  // 青い地（カントン）。本物は 横7/13・縦は上から7本ぶん。
  const cw = FW * 0.40, ch = bh * 7;
  const cx = FX - FW / 2 + cw / 2, cy = FY + FH / 2 - ch / 2;
  b.add(cube, { offset: [cx, cy, TH * 0.35], scale: [cw, ch, TH * 0.8],
                center: [cx, cy, 0], flat: true, col: BLUE });
  // 白い星。50個は この大きさでは点にもならないので、読める数だけ置く。
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const sx = cx - cw / 2 + cw * (c + 0.5) / 4;
      const sy = cy - ch / 2 + ch * (r + 0.5) / 3;
      b.add(cube, { offset: [sx, sy, TH * 0.8], scale: [cw * 0.13, ch * 0.13, TH * 0.5],
                    center: [sx, sy, 0], flat: true, col: WHITE });
    }
  }
  return b.build();
}


// 🏠 火星の居住ドーム（火星だけ）。**人が住む計画**があることを、絵で言う。
//   ドーム＋通路＋太陽電池。字で説明しなくても「基地」に見える形にする。
function buildMarsBaseMesh() {
  const b = new PropBuilder();
  // ドーム（半球）。中が見えるように、うっすら明るく。
  b.add(sphereGeometry(18, 10, { vFrom: 0.5, vTo: 1 }), {
    scale: [0.40, 0.30, 0.40], center: [0, 0.15, 0], col: [1.05, 1.12, 1.30],
  });
  // 土台のリング
  b.add(loftGeometry({
    rings: 2, radial: 18, k: 2.0, minR: 0.01,
    profile: () => [0.42, 0.42], spine: t => [0, t * 0.05, 0],
  }), { center: [0, 0.02, 0], flat: true, col: [0.86, 0.82, 0.80] });
  // 通路（横のつつ）
  b.add(tubeGeometry(t => [0.36 + t * 0.34, 0.10, 0], 0.075, 10, 8),
        { center: [0.5, 0.10, 0], col: [0.94, 0.90, 0.88] });
  // 小さいドーム（通路の先）
  b.add(sphereGeometry(14, 8, { vFrom: 0.5, vTo: 1 }), {
    offset: [0.74, 0, 0], scale: [0.20, 0.16, 0.20],
    center: [0.74, 0.08, 0], col: [1.02, 1.08, 1.24],
  });
  // 太陽電池のパネル2枚（青黒くて、ここだけ人工物の色）
  for (const sx of [-0.62, -0.40]) {
    b.add(cubeGeometry(), {
      offset: [sx, 0.20, 0.10], scale: [0.20, 0.012, 0.30], rot: [0.35, 0, 0],
      center: [sx, 0.20, 0.10], flat: true, col: [0.26, 0.34, 0.62],
    });
    b.add(tubeGeometry(t => [0, t * 0.20, 0], 0.014, 5, 5),
          { offset: [sx, 0, 0.10], center: [sx, 0.10, 0.10], col: [0.80, 0.78, 0.76] });
  }
  return b.build();
}

// 👣 月の足あと（月だけ）。
//  ★これが「月には風がない」の証拠になる。字で書くより、
//    地面に残っている絵を見せたほうが、たぶん一生おぼえている。
//  ★くぼみとして作る（浮き出させない）。まわりに少しだけ土手をつける。
function buildFootprintsMesh() {
  const b = new PropBuilder();
  const step = (x, z, rot) => {
    // くぼみ本体。うすい皿を伏せずに、少しへこませて置く。
    b.add(loftGeometry({
      rings: 3, radial: 10, k: 2.6, minR: 0.006,
      profile: t => { const r = 0.055 * (1 - t * 0.25); return [r, r * 1.55]; },
      spine: t => [0, -0.030 + t * 0.030, 0],
    }), { offset: [x, 0, z], rot: [0, rot, 0], center: [x, 0.02, z], flat: true,
          col: [0.62, 0.62, 0.66] });
  };
  // 2本の足で、遠ざかっていく並び
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    step(i * 0.19, (i % 2 ? 0.075 : -0.075) + t * 0.10, 0.10 + t * 0.22);
  }
  return b.build();
}

function buildFlagMesh() {
  const b = new PropBuilder();
  b.add(tubeGeometry(t => [0, t * 0.62, 0], 0.012, 6, 6),
        { center: [0, 0.31, 0], col: [1.20, 1.24, 1.34] });
  // はたの面（風のない月なので、はためかせず ぴんと張る）
  b.add(loftGeometry({
    rings: 1, radial: 4, k: 6.0, minR: 0.004,
    profile: () => [Math.SQRT1_2, Math.SQRT1_2],
    spine: t => [0, t - 0.5, 0],
  }), { offset: [0.13, 0.52, 0], scale: [0.26, 0.16, 0.012],
        rot: [0, Math.PI / 4, 0], center: [0.13, 0.52, 0], flat: true,
        col: [1.55, 0.85, 0.30] });
  return b.build();
}

// ---------------- 🤖 キュリオシティ（火星探査車）----------------
// 2D版の火星エンディングで、左手前からこちらにカメラを向けている あの子。
// シルエットで読ませる：6つの車輪・箱の体・首の長いカメラ・皿のアンテナ。
function buildCuriosityMesh() {
  const b = new PropBuilder();
  const body = [1.05, 0.98, 0.86], metal = [0.72, 0.74, 0.82], dark = [0.16, 0.16, 0.19];
  const box = (pos, size, col) => b.add(loftGeometry({
    rings: 1, radial: 4, k: 6.0, minR: 0.01,
    profile: () => [Math.SQRT1_2, Math.SQRT1_2],
    spine: t => [0, t - 0.5, 0],
  }), { offset: pos, scale: size, rot: [0, Math.PI / 4, 0], center: pos, col, flat: true });

  // 車体
  box([0, 0.30, 0], [0.52, 0.20, 0.34], body);
  // 太陽電池ではなく RTG（うしろの黒い発電機）
  box([-0.32, 0.34, 0], [0.16, 0.14, 0.18], dark);
  // 車輪6つ（左右3つずつ）
  for (const s of [-1, 1]) {
    for (const x of [-0.20, 0, 0.20]) {
      b.add(loftGeometry({
        rings: 2, radial: 12, k: 2.0, minR: 0.01,
        profile: () => [0.105, 0.105], spine: t => [0, t * 0.075 - 0.037, 0],
      }), { offset: [x, 0.105, s * 0.20], rot: [Math.PI / 2, 0, 0],
            center: [x, 0.105, s * 0.20], col: dark });
      // サスペンションの腕
      b.add(tubeGeometry(t => [x * (1 - t) , 0.105 + t * 0.14, s * 0.20], 0.018, 4, 5),
            { center: [x * 0.5, 0.18, s * 0.20], col: metal });
    }
  }
  // 首（マスト）とカメラの頭
  b.add(tubeGeometry(t => [0.16, 0.40 + t * 0.34, 0], 0.022, 6, 6),
        { center: [0.16, 0.57, 0], col: metal });
  box([0.16, 0.79, 0], [0.14, 0.09, 0.16], body);
  for (const s of [-1, 1]) {
    b.add(loftGeometry({
      rings: 1, radial: 10, k: 2.0, minR: 0.006,
      profile: () => [0.028, 0.028], spine: t => [0, t * 0.02, 0],
    }), { offset: [0.235, 0.80, s * 0.045], rot: [0, 0, -Math.PI / 2],
          center: [0.235, 0.80, s * 0.045], col: [0.10, 0.14, 0.22] });
  }
  // アンテナの皿（地球へ向けている）
  b.add(loftGeometry({
    rings: 4, radial: 12, k: 2.0, minR: 0.008,
    profile: t => { const r = 0.03 + t * 0.10; return [r, r]; },
    spine: t => [0, t * 0.08, 0],
  }), { offset: [-0.20, 0.46, 0.10], rot: [-0.5, 0, 0.35],
        center: [-0.20, 0.50, 0.10], col: [1.15, 1.18, 1.28] });
  // 前へ伸びるアーム
  b.add(tubeGeometry(t => [0.28 + t * 0.20, 0.26 - t * 0.10, 0.06], 0.024, 6, 6),
        { center: [0.38, 0.21, 0.06], col: metal });
  return b.build();
}


// ---------------- 🛑 ヘリオポーズの壁 ----------------
//  太陽がふいた風が、まわりの星の風とぶつかって止まるところ。
//  ★のっぺりした板にしない。ふち（視線と浅く交わるところ）だけが強く光る
//    「膜」にする。下から見上げると、光る天井のように見えて、
//    突きぬけた瞬間に足もとへ流れ去る。
function buildHelioWallMesh() {
  const b = new PropBuilder();
  const RN = 14;
  for (let i = 0; i < RN; i++) {
    const t0 = Math.max(0.004, Math.pow(i / RN, 1.6));
    const t1 = Math.pow((i + 1) / RN, 1.6);
    b.add(ringGeometry(t0, t1, 64), {
      center: [0, 0, 0],
      colFn: (x, y, z) => {
        const r = Math.hypot(x, z);
        // うずまく筋（太陽の風がここで滞っている）
        const a = Math.atan2(z, x);
        const w = 0.72 + 0.28 * Math.sin(a * 7 + r * 26);
        const edge = smoothstep(0.25, 1.0, r);
        return [w * (0.35 + edge * 0.5), w * (0.75 + edge * 0.35), w * 1.25];
      },
    });
  }
  return b.build();
}

// ---------------- 🌈 光の柱（プラン §3.4）----------------
//  走行中に、色のちがう柱が2本立つ。どちらへ寄るかで、そのランだけの力を選ぶ。
//  ★選択画面を作らない。**いつもの左右の操作が、そのまま選択になる**のが要点。
function buildPillarMesh() {
  const b = new PropBuilder();
  const H = 7.0;
  // 中の芯（明るい）と、外のにじみ（うすい）の2枚
  b.add(loftGeometry({
    rings: 10, radial: 12, k: 2.0, minR: 0.01,
    profile: t => { const r = 0.085 * (1 - Math.pow(Math.abs(t * 2 - 1), 2.2) * 0.55); return [r, r]; },
    spine: t => [0, t * H, 0],
    capTop: false, capBottom: false,
  }), { center: [0, H / 2, 0], col: [2.4, 2.4, 2.6] });
  b.add(loftGeometry({
    rings: 10, radial: 14, k: 2.0, minR: 0.01,
    profile: t => { const r = 0.26 * (1 - Math.pow(Math.abs(t * 2 - 1), 1.6) * 0.7); return [r, r]; },
    spine: t => [0, t * H, 0],
    capTop: false, capBottom: false,
  }), { center: [0, H / 2, 0], col: [0.85, 0.85, 0.95] });
  const m = b.build();
  m.top = H;
  return m;
}
