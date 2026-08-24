// ============================================================
// scene.js — 倉庫の見た目（ゆか・かべ・にもつ・おきば）
//   ★子どもが ひと目で見分けられることを最優先にする
//     かべ ＝ こい茶色・マスいっぱい・高い（動かせない）
//     にもつ＝ うす茶色の 段ボール・ひとまわり小さい・テープの十字（動かせる）
//     おきば＝ ピンクのわく（ゆかの上）
// ============================================================
'use strict';

// 頂点の色をぬり分ける（模様をテクスチャなしで作る）
function paintGeo(geo, fn) {
  const n = geo.pos.length / 3;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = fn(geo.pos[i * 3], geo.pos[i * 3 + 1], geo.pos[i * 3 + 2],
                 geo.nrm[i * 3], geo.nrm[i * 3 + 1], geo.nrm[i * 3 + 2]);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  geo.col = col;
  return geo;
}

// いくつかの形を1つにまとめる（インスタンス描画は1形につき1回なので）
function mergeGeo(list) {
  let np = 0, ni = 0;
  for (const g of list) { np += g.geo.pos.length / 3; ni += g.geo.idx.length; }
  const pos = new Float32Array(np * 3), nrm = new Float32Array(np * 3);
  const uv = new Float32Array(np * 2), col = new Float32Array(np * 3);
  const idx = np > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const geo = g.geo, m = g.mat || M4.ident();
    const nMat = M4.normalMat(m, new Float32Array(16));
    const c = g.col ? hex2rgb(g.col) : null;
    const n = geo.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const x = geo.pos[i * 3], y = geo.pos[i * 3 + 1], z = geo.pos[i * 3 + 2];
      pos[(vo + i) * 3]     = m[0] * x + m[4] * y + m[8] * z + m[12];
      pos[(vo + i) * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      pos[(vo + i) * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const a = geo.nrm[i * 3], b = geo.nrm[i * 3 + 1], d = geo.nrm[i * 3 + 2];
      let tx = nMat[0] * a + nMat[4] * b + nMat[8] * d;
      let ty = nMat[1] * a + nMat[5] * b + nMat[9] * d;
      let tz = nMat[2] * a + nMat[6] * b + nMat[10] * d;
      const L = Math.hypot(tx, ty, tz) || 1;
      nrm[(vo + i) * 3] = tx / L; nrm[(vo + i) * 3 + 1] = ty / L; nrm[(vo + i) * 3 + 2] = tz / L;
      if (geo.uv) { uv[(vo + i) * 2] = geo.uv[i * 2]; uv[(vo + i) * 2 + 1] = geo.uv[i * 2 + 1]; }
      if (c) { col[(vo + i) * 3] = c[0]; col[(vo + i) * 3 + 1] = c[1]; col[(vo + i) * 3 + 2] = c[2]; }
      else if (geo.col) { col[(vo + i) * 3] = geo.col[i * 3]; col[(vo + i) * 3 + 1] = geo.col[i * 3 + 1]; col[(vo + i) * 3 + 2] = geo.col[i * 3 + 2]; }
      else { col[(vo + i) * 3] = 1; col[(vo + i) * 3 + 1] = 1; col[(vo + i) * 3 + 2] = 1; }
    }
    for (let i = 0; i < geo.idx.length; i++) idx[io + i] = geo.idx[i] + vo;
    vo += n; io += geo.idx.length;
  }
  return { pos, nrm, uv, col, idx };
}

const SCN = {};

// ---- ゆかのタイル ----
SCN.tile = () => paintGeo(roundBox(0.99, 0.10, 0.99, { k: 7, edge: 10, rings: 6, radial: 20 }),
  (x, y) => {
    // 上のめんだけ明るく（横のめんは影になって段差が出る）
    const top = y > 0.085 ? 1 : 0.86;
    return [top, top, top];
  });

// ---- かべ（つみあげた木の箱）----
SCN.wall = () => {
  const parts = [];
  // 下の台
  parts.push({ geo: roundBox(1.0, 0.34, 1.0, { k: 7, edge: 12, rings: 6, radial: 20 }), col: '#8a5a34', mat: T(0, 0, 0) });
  // 上の段（すこし小さくして段差を出す）
  parts.push({ geo: roundBox(0.94, 0.28, 0.94, { k: 7, edge: 12, rings: 6, radial: 20 }), col: '#9c6a3e', mat: T(0, 0.34, 0) });
  // てっぺんの ふち
  parts.push({ geo: roundBox(1.0, 0.06, 1.0, { k: 7, edge: 14, rings: 4, radial: 20 }), col: '#6e4526', mat: T(0, 0.61, 0) });
  return mergeGeo(parts);
};

// ---- にもつ（段ボール箱＋ピンクのテープ）----
SCN.box = () => {
  const g = roundBox(0.82, 0.80, 0.82, { k: 6, edge: 12, rings: 18, radial: 44 });
  return paintGeo(g, (x, y, z) => {
    // ★ピンクは「おきば」だけに使う。にもつにも使うと どっちが目的地か分からへん
    const card = [1.00, 0.84, 0.58];      // 段ボール
    const tape = [0.80, 0.62, 0.38];      // クラフトテープ
    const dark = [0.84, 0.66, 0.42];      // したのほうを すこし暗く
    const onTop = y > 0.74;
    // テープの十字（上のめん）と、たての帯（よこのめん）
    if (onTop && (Math.abs(x) < 0.045 || Math.abs(z) < 0.045)) return tape;
    if (!onTop && y > 0.06 && (Math.abs(x) < 0.045 || Math.abs(z) < 0.045)) return tape;
    if (y < 0.10) return dark;
    return card;
  });
};

// ---- おきば（ピンクのわく）----
SCN.goal = () => paintGeo(roundBox(0.70, 0.04, 0.70, { k: 8, edge: 14, rings: 4, radial: 40 }),
  (x, y, z) => {
    const r = Math.max(Math.abs(x), Math.abs(z));
    return r > 0.245 ? [1.0, 0.42, 0.62] : [1.0, 0.80, 0.88];
  });

// ---- 外がわの地面（盤の外に広がる板）----
SCN.ground = () => paintGeo(roundBox(1, 0.08, 1, { k: 8, edge: 20, rings: 3, radial: 12 }), () => [1, 1, 1]);
