// ============================================================
// park.js — はじまりの公園
//
//  チッチは、いきなり空にいるのではない。
//  近所の公園の、バネの遊具に乗っている。
//  ベンチには だれかの忘れものの ラジオ。そこから声が聞こえてくる。
//
//    ザーッ…「こちら ボイジャー1号。」
//          「だれか、聞いていますか。」
//          「その声は、23時間まえの声。」
//          「へんじを、しに行こう。」
//                 ズギューン
//
//  ★この公園には、あとで効く仕掛けが3つある。
//    ① 電波では間に合わない（23時間かかる）＝自分で行く理由になる
//    ② バネの遊具＝「ズギューン」の理由であり、バネ雲の使いかたの練習でもある
//    ③ ここが「地球」。何光年先へ行っても、帰る場所はこの公園のこの一点。
// ============================================================
'use strict';

// 立方体。radial=4 の断面は「軸の上に4点」＝ひし形なので、
// 45°回して置くと、ふつうの箱になる。
function parkBoxGeo() {
  return loftGeometry({
    rings: 1, radial: 4, k: 6.0, minR: 0.01,
    profile: () => [Math.SQRT1_2, Math.SQRT1_2],
    spine: t => [0, t - 0.5, 0],
  });
}
const PARK_BOX_ROT = [0, Math.PI / 4, 0];
// b … PropBuilder、pos … 中心、size … 各辺の長さ
function parkBox(b, pos, size, col, rotY) {
  b.add(parkBoxGeo(), {
    offset: pos, scale: size,
    rot: rotY === undefined ? PARK_BOX_ROT : [0, Math.PI / 4 + rotY, 0],
    center: pos, col, flat: true,
  });
}

// ---------------- 🌱 公園の地面 ----------------
// まん中が土の広場、まわりが芝生、そのむこうは木立と、もやで空に溶ける。
function buildParkGroundMesh() {
  const b = new PropBuilder();
  // ★1枚の輪でつくらない。ringGeometry の頂点は内と外の2周しかないので、
  //   色は「まん中の色 → ふちの色」の2点補間になってしまう。
  //   土の広場も、芝生の色むらも、もやも、ぜんぶ消えて のっぺりした一色になる
  //   （実際、公園ぜんたいが土の色になった）。同心の輪を重ねて刻みを持たせる。
  const RN = 18;
  const colFn = (x, y, z) => {
      const r = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      // 土の広場（遊具のまわり）。ふちをくねらせる。
      // ★ここを広げすぎると、見えるところが全部 土 になって芝生が消える
      //   （円ばんの半径は34あるので、0.13 でも 4.4world ＝ 画面いっぱい）。
      const dirt = smoothstep(0.105 + Math.sin(a * 3.1) * 0.016, 0.055, r);
      // 芝の色むら。一様な緑は「板」に見える。
      const n = Math.sin(r * 41 + a * 2.3) * 0.5 + Math.sin(a * 7.7 - r * 23) * 0.5;
      const grass = [0.30 + n * 0.05, 0.56 + n * 0.07, 0.26 + n * 0.04];
      const soil  = [0.64, 0.52, 0.38];
      let c = [lerp(grass[0], soil[0], dirt), lerp(grass[1], soil[1], dirt), lerp(grass[2], soil[2], dirt)];
      // 遠くほど もや。地平線で空に溶ける。
      // ★外がわを「空の色」に溶かしてはいけない。公園ごと消えて見えなくなり、
      //   その向こうの地図とも つながらない。土地の色へ溶かす。
      const haze = smoothstep(0.55, 1.0, r);
      return [lerp(c[0], 0.40, haze), lerp(c[1], 0.46, haze), lerp(c[2], 0.40, haze)];
  };
  for (let i = 0; i < RN; i++) {
    // 近くほど細かく刻む（手前ほど大きく映るので）
    const t0 = Math.max(0.002, Math.pow(i / RN, 1.7));
    const t1 = Math.pow((i + 1) / RN, 1.7);
    b.add(ringGeometry(t0, t1, 64), { center: [0, 0, 0], colFn });
  }
  return b.build();
}

// ---------------- 🌳 木 ----------------
// 葉を1つの球にしない。3つのかたまりを少しずらして重ねると、
// 小さく映っても「木」に見える。
function buildParkTreeMesh() {
  const b = new PropBuilder();
  // 幹（根もとが太い）
  b.add(loftGeometry({
    rings: 8, radial: 7, k: 2.2, minR: 0.01,
    profile: t => { const r = catmull([0.085, 0.058, 0.048, 0.042, 0.036], t); return [r, r]; },
    spine: t => [0, t * 0.52, 0],
  }), { center: [0, 0.26, 0], col: [0.46, 0.34, 0.24] });
  // 枝わかれ（2本）
  for (const s of [-1, 1]) {
    b.add(tubeGeometry(t => [s * t * 0.16, 0.40 + t * 0.22, s * 0.04 * t], 0.022, 6, 5),
          { center: [0, 0.5, 0], col: [0.44, 0.32, 0.22] });
  }
  // 葉のかたまり3つ
  const lumps = [[0, 0.80, 0, 0.40], [-0.25, 0.66, 0.06, 0.29], [0.24, 0.68, -0.05, 0.27]];
  for (const [x, y, z, r] of lumps) {
    b.add(sphereGeometry(16, 11), {
      offset: [x, y, z], scale: [r, r * 0.88, r],
      center: [x, y, z], flat: true,
      displace: (px, py, pz) => (Math.sin(px * 9.1 + py * 7.3) * Math.cos(pz * 8.7) * 0.045),
      colFn: (px, py) => {
        const k = 0.86 + (py - y) * 0.9;      // 上のほうが日を受けて明るい
        return [0.26 * k, 0.56 * k, 0.24 * k];
      },
    });
  }
  return b.build();
}

// ---------------- 🪑 ベンチ ----------------
function buildParkBenchMesh() {
  const b = new PropBuilder();
  const wood = [0.86, 0.60, 0.34], iron = [0.36, 0.38, 0.44];
  // 座面（板を3枚ならべる＝すき間が見えると一気にベンチらしくなる）
  for (let i = 0; i < 3; i++) {
    parkBox(b, [0, 0.26, -0.10 + i * 0.10], [1.10, 0.035, 0.075], wood);
  }
  // 背もたれ
  for (let i = 0; i < 2; i++) {
    parkBox(b, [0, 0.40 + i * 0.11, -0.17], [1.10, 0.035, 0.075], wood);
  }
  // 脚
  for (const s of [-1, 1]) {
    parkBox(b, [s * 0.46, 0.13, 0], [0.05, 0.26, 0.05], iron);
    parkBox(b, [s * 0.46, 0.31, -0.17], [0.045, 0.30, 0.045], iron);
  }
  return b.build();
}

// ---------------- 📻 ラジオ ----------------
// ベンチの上の忘れもの。ここから、ボイジャーの声が聞こえてくる。
// 小さいので、シルエットで読ませる：箱＋丸いスピーカー＋つまみ＋アンテナ。
function buildParkRadioMesh() {
  const b = new PropBuilder();
  parkBox(b, [0, 0.09, 0], [0.30, 0.18, 0.11], [0.72, 0.66, 0.56]);
  // スピーカーの丸（少し前へ出す）
  b.add(loftGeometry({
    rings: 1, radial: 16, k: 2.0, minR: 0.006,
    profile: () => [0.062, 0.062], spine: t => [0, t * 0.012, 0],
  }), { offset: [-0.07, 0.10, 0.058], rot: [Math.PI / 2, 0, 0],
        center: [-0.07, 0.10, 0.058], col: [0.20, 0.19, 0.18] });
  // つまみ2つ
  for (let i = 0; i < 2; i++) {
    b.add(loftGeometry({
      rings: 1, radial: 10, k: 2.0, minR: 0.004,
      profile: () => [0.022, 0.022], spine: t => [0, t * 0.016, 0],
    }), { offset: [0.07, 0.135 - i * 0.06, 0.058], rot: [Math.PI / 2, 0, 0],
          center: [0.07, 0.135 - i * 0.06, 0.058], col: [1.10, 0.94, 0.52] });
  }
  // アンテナ（ななめに伸ばす。これが有ると一目でラジオ）
  b.add(tubeGeometry(t => [0.10 + t * 0.10, 0.18 + t * 0.34, -0.02 - t * 0.03], 0.008, 6, 5),
        { center: [0.15, 0.35, 0], col: [1.15, 1.18, 1.25] });
  return b.build();
}

// ---------------- 🐎 バネの遊具 ----------------
// ここに乗って、ぐっと沈んで、ズギューンと飛ぶ。
// バネ雲とおなじ「コイル＋乗る面」の形にしてある（あとで空で出会う道具の練習）。
function buildParkSpringRideMesh() {
  const b = new PropBuilder();
  // 土台
  b.add(loftGeometry({
    rings: 1, radial: 14, k: 2.0, minR: 0.01,
    profile: () => [0.16, 0.16], spine: t => [0, t * 0.035, 0],
  }), { center: [0, 0.02, 0], col: [0.42, 0.44, 0.50] });
  // コイル（らせんは tubeGeometry。loft だと平たい輪になる）
  const TURNS = 3.0, RAD = 0.085, H = 0.20, Y0 = 0.035;
  b.add(tubeGeometry(
    t => [Math.cos(t * Math.PI * 2 * TURNS) * RAD, t * H, Math.sin(t * Math.PI * 2 * TURNS) * RAD],
    0.026, 74, 8), { offset: [0, Y0, 0], center: [0, Y0 + H / 2, 0], col: [1.30, 1.34, 1.45] });
  // 体（赤い動物の板）。子どもが乗るあの形。
  const bodyY = Y0 + H + 0.075;
  b.add(loftGeometry({
    rings: 10, radial: 12, k: 2.6, minR: 0.01,
    profile: t => [catmull([0.10, 0.17, 0.19, 0.17, 0.11], t), catmull([0.055, 0.075, 0.080, 0.070, 0.050], t)],
    spine: t => [0, t * 0.44 - 0.22, 0],
  }), { offset: [0, bodyY, 0], rot: [Math.PI / 2, 0, 0], center: [0, bodyY, 0],
        col: [1.45, 0.42, 0.36] });
  // 頭。★乗る面より高くしないこと。高いと、チッチが頭の上に立っているように見える。
  const headY = bodyY - 0.012, headZ = 0.245;
  b.add(sphereGeometry(14, 10), {
    offset: [0, headY, headZ], scale: [0.088, 0.084, 0.095],
    center: [0, headY, headZ], col: [1.50, 0.46, 0.40],
  });
  // 耳2つ
  for (const s of [-1, 1]) {
    b.add(sphereGeometry(8, 6), {
      offset: [s * 0.048, headY + 0.068, headZ - 0.02], scale: [0.026, 0.038, 0.019],
      center: [s * 0.048, headY + 0.068, headZ - 0.02], col: [1.35, 0.40, 0.34],
    });
  }
  // 目（黒い点。これが無いと ただの赤い板）
  for (const s of [-1, 1]) {
    b.add(sphereGeometry(8, 6), {
      offset: [s * 0.040, headY + 0.020, headZ + 0.068], scale: [0.017, 0.021, 0.012],
      center: [s * 0.040, headY + 0.020, headZ + 0.068], col: [0.08, 0.07, 0.09],
    });
  }
  // 取っ手（黄色）
  for (const s of [-1, 1]) {
    b.add(tubeGeometry(t => [s * (0.02 + t * 0.10), 0.02 + Math.sin(t * Math.PI) * 0.05, 0],
                       0.016, 8, 6),
          { offset: [0, bodyY + 0.055, 0.10], center: [0, bodyY + 0.08, 0.10],
            col: [1.55, 1.30, 0.30] });
  }
  return b.build();
}
// バネの遊具の「乗る面」の高さ（world 単位のモデル座標）。
// ★決め打ちにせず、ここを唯一の出どころにする（形を変えたらここも直す）。
const PARK_RIDE_TOP = 0.035 + 0.20 + 0.075 + 0.080;   // 土台+コイル+体の中心+体の半分 ≒ 0.39

// ---------------- 💡 街灯 ----------------
function buildParkLampMesh() {
  const b = new PropBuilder();
  b.add(loftGeometry({
    rings: 6, radial: 8, k: 2.2, minR: 0.008,
    profile: t => { const r = 0.038 - t * 0.014; return [r, r]; },
    spine: t => [0, t * 1.45, 0],
  }), { center: [0, 0.7, 0], col: [0.34, 0.36, 0.42] });
  // 笠
  b.add(loftGeometry({
    rings: 4, radial: 12, k: 2.0, minR: 0.01,
    profile: t => { const r = 0.13 - t * 0.09; return [r, r]; },
    spine: t => [0, 1.45 + t * 0.10, 0],
  }), { center: [0, 1.5, 0], col: [0.40, 0.42, 0.48] });
  // 灯り
  b.add(sphereGeometry(12, 8), {
    offset: [0, 1.44, 0], scale: [0.075, 0.055, 0.075],
    center: [0, 1.44, 0], col: [2.6, 2.3, 1.5],
  });
  return b.build();
}
