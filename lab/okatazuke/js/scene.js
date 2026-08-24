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

// ---- 6面ぶんの絵を貼る立方体（木箱・レンガ）------------------------------
// ★もらった GLB は 180万三角の実写スキャン。そのままでは300個ならべられない。
//   tools/bake_prop.py で 6方向から色を焼いて 3x2 のアトラスにしてあるので、
//   ここでは 12三角の箱に その6面を貼るだけ。見た目はほぼそのまま。
//   面のならび（焼いたときと同じ）： +X -X +Y / -Y +Z -Z
SCN.cube6 = function (w, h, d) {
  // ★計算でひねらず、6面の4隅を そのまま書く（前は板になった）。
  //   並びは (0,0)(1,0)(1,1)(0,1)。外から見て 反時計回り＝表。
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const F = [
    { n: [1, 0, 0],  v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [0, 1, 0],  v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
    { n: [0, 0, 1],  v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
  ];
  const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const IU = 1.0 / 768, IV = 1.0 / 512;      // にじみ止め
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  F.forEach((f, k) => {
    const c0 = (k % 3) / 3, r0 = ((k / 3) | 0) / 2;
    const base = pos.length / 3;
    f.v.forEach((p, i) => {
      pos.push(p[0], p[1] + hy, p[2]);        // 底が y=0 になるように 持ちあげる
      nrm.push(f.n[0], f.n[1], f.n[2]);
      const [u, v] = UV[i];
      uv.push(c0 + (u ? 1 / 3 - IU : IU), r0 + (v ? IV : 1 / 2 - IV));
      col.push(1, 1, 1);
    });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm),
    uv: new Float32Array(uv), col: new Float32Array(col),
    idx: new Uint16Array(idx),
  };
};

// ---- レンガの絵（キャンバスで描く。画像ファイルは持たない）----------------
// ★渡された実写スキャンは「不規則な石の塊」で、1マスに丸ごと入ると
//   石ひとつが3〜5pxにしかならず「レンガ積み」に見えなかった（実測）。
//   1マスに3〜4段だけ見えるように、こちらで描く。オカンの絵柄に合わせて
//   色は少なく・目地はくっきり・角はやわらかく。
SCN.brickTexture = function () {
  const W = 512, H = 256;              // 左半分=よこ面 / 右半分=上下の面
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const MORTAR = '#efe4d6';
  const BRICK = ['#b4553e', '#a94c37', '#bd5f45', '#a44733', '#b95a41'];
  const rnd = mulberry32(20260824);

  // --- よこ面（3.5段の 馬目地）---
  g.fillStyle = MORTAR;
  g.fillRect(0, 0, W / 2, H);
  const rows = 4, ph = H / rows;       // 1段の高さ
  const bw = W / 2 / 2;                // よこ2つ
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) ? bw / 2 : 0;  // 一段ごとに 半分ずらす
    for (let c = -1; c <= 2; c++) {
      const x = c * bw + off, y = r * ph;
      const m = 5;                     // 目地のはば
      const x0 = x + m, y0 = y + m, w = bw - m * 2, h = ph - m * 2;
      if (x0 > W / 2 || x0 + w < 0) continue;
      g.save();
      g.beginPath();
      g.rect(Math.max(0, x0), y0, Math.min(w, W / 2 - Math.max(0, x0)), h);
      g.clip();
      g.fillStyle = BRICK[(r * 7 + c * 3 + 5) % BRICK.length];
      g.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
      // 上のふちを明るく、下のふちを暗く（積んで見える）
      g.fillStyle = 'rgba(255,225,205,0.30)';
      g.fillRect(x0 - 2, y0 - 2, w + 4, h * 0.16);
      g.fillStyle = 'rgba(60,20,10,0.22)';
      g.fillRect(x0 - 2, y0 + h * 0.84, w + 4, h * 0.20);
      // ざらつき
      for (let k = 0; k < 26; k++) {
        g.fillStyle = 'rgba(0,0,0,' + (0.03 + rnd() * 0.05) + ')';
        g.fillRect(x0 + rnd() * w, y0 + rnd() * h, 2 + rnd() * 5, 1 + rnd() * 3);
      }
      g.restore();
    }
  }

  // --- 上下の面（レンガの小口が ならんでいる）---
  g.fillStyle = MORTAR;
  g.fillRect(W / 2, 0, W / 2, H);
  const cols = 2, rws = 4;
  for (let r = 0; r < rws; r++) {
    for (let c = 0; c < cols; c++) {
      const x = W / 2 + c * (W / 2 / cols) + 5, y = r * (H / rws) + 5;
      const w = W / 2 / cols - 10, h = H / rws - 10;
      g.fillStyle = BRICK[(r * 3 + c * 5 + 1) % BRICK.length];
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,225,205,0.22)';
      g.fillRect(x, y, w, h * 0.18);
      for (let k = 0; k < 18; k++) {
        g.fillStyle = 'rgba(0,0,0,' + (0.03 + rnd() * 0.05) + ')';
        g.fillRect(x + rnd() * w, y + rnd() * h, 2 + rnd() * 4, 1 + rnd() * 3);
      }
    }
  }
  return cv;
};

// よこ面と 上下の面で 貼りわける立方体（レンガ・木箱で共用）
SCN.cubeSideTop = function (w, h, d) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const F = [
    { n: [1, 0, 0],  s: 1, v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], s: 1, v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [0, 1, 0],  s: 0, v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], s: 0, v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
    { n: [0, 0, 1],  s: 1, v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], s: 1, v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
  ];
  const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const I = 1 / 512;
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  F.forEach(f => {
    const u0 = f.s ? 0 : 0.5;          // s=1 … よこ面（左半分）／s=0 … 上下（右半分）
    const base = pos.length / 3;
    f.v.forEach((p, i) => {
      pos.push(p[0], p[1] + hy, p[2]);
      nrm.push(f.n[0], f.n[1], f.n[2]);
      const [u, v] = UV[i];
      uv.push(u0 + (u ? 0.5 - I : I), v ? I : 1 - I);
      col.push(1, 1, 1);
    });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm),
    uv: new Float32Array(uv), col: new Float32Array(col),
    idx: new Uint16Array(idx),
  };
};

// ---- 木箱の絵（キャンバスで描く）------------------------------------------
// ★遠くからでも「木の箱」と分かるように、板・ふちの角材・ななめの筋かい を
//   はっきり描く。50px でも 形が読めることを優先（実写の木目は つぶれて泥になる）。
SCN.crateTexture = function () {
  const W = 512, H = 256;              // 左半分=よこ面 / 右半分=上下の面
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const rnd = mulberry32(11220824);
  const WOOD = ['#d09a58', '#c68f4e', '#d6a463', '#c58a49'];
  const FRAME = '#96602c';
  const DARK = 'rgba(90,48,14,0.55)';

  function planks(x0, y0, w, h, vertical, n) {
    for (let i = 0; i < n; i++) {
      const t = i / n, t2 = (i + 1) / n;
      const x = vertical ? x0 + w * t : x0;
      const y = vertical ? y0 : y0 + h * t;
      const pw = vertical ? w / n : w;
      const ph = vertical ? h : h / n;
      g.fillStyle = WOOD[i % WOOD.length];
      g.fillRect(x, y, pw, ph);
      // 板のすきま
      g.fillStyle = DARK;
      if (vertical) g.fillRect(x + pw - 3, y, 3, ph);
      else g.fillRect(x, y + ph - 3, pw, 3);
      // 木目
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = 'rgba(120,70,25,0.20)';
        g.lineWidth = 1 + rnd();
        g.beginPath();
        if (vertical) {
          const gx = x + 4 + rnd() * (pw - 8);
          g.moveTo(gx, y + 4); g.lineTo(gx + (rnd() - 0.5) * 6, y + ph - 4);
        } else {
          const gy = y + 4 + rnd() * (ph - 8);
          g.moveTo(x + 4, gy); g.lineTo(x + pw - 4, gy + (rnd() - 0.5) * 6);
        }
        g.stroke();
      }
    }
  }

  function frame(x0, y0, w, h, band) {
    g.fillStyle = FRAME;
    g.fillRect(x0, y0, w, band);
    g.fillRect(x0, y0 + h - band, w, band);
    g.fillRect(x0, y0, band, h);
    g.fillRect(x0 + w - band, y0, band, h);
    // 角材の 上面を明るく
    g.fillStyle = 'rgba(255,225,180,0.22)';
    g.fillRect(x0, y0, w, band * 0.4);
  }

  function nails(x0, y0, w, h, band) {
    g.fillStyle = 'rgba(70,45,20,0.65)';
    const r = 3.2;
    for (const [nx, ny] of [[0.08, 0.10], [0.92, 0.10], [0.08, 0.90], [0.92, 0.90]]) {
      g.beginPath(); g.arc(x0 + w * nx, y0 + h * ny, r, 0, 7); g.fill();
    }
  }

  // --- よこ面：たて板3枚＋ふちの角材＋ななめの筋かい ---
  planks(0, 0, W / 2, H, true, 3);
  g.save();
  g.beginPath(); g.rect(14, 14, W / 2 - 28, H - 28); g.clip();
  g.strokeStyle = FRAME; g.lineWidth = 20;
  g.beginPath(); g.moveTo(10, H - 10); g.lineTo(W / 2 - 10, 10); g.stroke();
  g.strokeStyle = 'rgba(255,225,180,0.20)'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(10, H - 16); g.lineTo(W / 2 - 10, 4); g.stroke();
  g.restore();
  frame(0, 0, W / 2, H, 16);
  nails(0, 0, W / 2, H, 16);

  // --- 上下の面：よこ板4枚＋ふちの角材 ---
  g.save();
  g.beginPath(); g.rect(W / 2, 0, W / 2, H); g.clip();
  planks(W / 2, 0, W / 2, H, false, 4);
  g.restore();
  frame(W / 2, 0, W / 2, H, 16);
  nails(W / 2, 0, W / 2, H, 16);
  return cv;
};
