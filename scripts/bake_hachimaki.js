// ============================================================
// オットンのハチマキの文字を描き直す。
//
//   Tripoが作った文字は日本語になっていない（「学」が化けている）。
//   ハチマキはUVの島が3つに割れていて、テクスチャ上で直接書くのは無理なので、
//   ★UVではなく3D側で位置を決める（頭の軸まわりの角度θと高さ）。
//     テクスチャの各画素が3Dのどこかを一度求めてから、そこへ文字を貼る。
//
//   踏んだ落とし穴（2026-08-23）:
//     ・3頂点すべてが帯の中の三角形だけを焼くと、帯のふちに古い文字が残る
//       → 三角形は重心で拾い、採用は画素ごとの高さで決める
//     ・高さを決め打ちにすると帯の上の「髪」まで消してしまう
//       → 帯の上下は「白い画素」から角度ごとに実測する
//     ・JPEGのにじみで文字のふちが薄く残る → 消す範囲を1画素太らせる
//
// 使い方（依存は npm i sharp。文字画像は scripts/make_hachimaki_text.py で先に作る）:
//   node scripts/bake_hachimaki.js <入力glb> <文字png> <出力jpg> [debug]
// ============================================================

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = process.argv[2] || path.join(__dirname, '..', '素材', 'オットン　リギング済.glb');
const TEXT_PNG = process.argv[3] || path.join(__dirname, '..', '素材', 'hachimaki_text.png');
const OUT = process.argv[4] || path.join(__dirname, '..', '素材', 'otton_basecolor_fixed.jpg');
const DEBUG = process.argv[5] || '';   // 'debug' か 'unwrap'

// ハチマキがありそうな高さ（身長1.0のモデルでの値）。ここは広めに取り、
// 実際の帯の上下は白い画素から測る
const SCAN_LO = 0.845, SCAN_HI = 0.960;
const WHITE = 185;      // これより明るければ帯の白地
const DARKTEXT = 195;   // これより暗ければ古い文字
// 文字は前面にしか書かれていない。うしろの結び目や影まで消さないよう範囲を切る
const FRONT_ARC = 75 * Math.PI / 180;
// ★前面の絵はまるごと描き直す（マークは元の絵から抜いて置き直すので消してよい）。
//   元の絵は顔の正面から16度ずれていた。詳しくは scripts/make_hachimaki_text.py
const ERASE_FROM = -FRONT_ARC;

function loadGLB(p) {
  const buf = fs.readFileSync(p);
  const total = buf.readUInt32LE(8);
  let off = 12, json = null, bin = null;
  while (off < total) {
    const len = buf.readUInt32LE(off), type = buf.readUInt32LE(off + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.slice(off + 8, off + 8 + len).toString('utf8'));
    else if (type === 0x004e4942) bin = buf.slice(off + 8, off + 8 + len);
    off += 8 + len;
  }
  return { json, bin };
}
const TA = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function acc(g, i) {
  const a = g.json.accessors[i], bv = g.json.bufferViews[a.bufferView];
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const T = TA[a.componentType], n = a.count * NC[a.type];
  return new T(g.bin.buffer.slice(g.bin.byteOffset + start, g.bin.byteOffset + start + n * T.BYTES_PER_ELEMENT));
}

(async () => {
  const g = loadGLB(SRC);
  const pr = g.json.meshes[0].primitives[0];
  const pos = acc(g, pr.attributes.POSITION);
  const nrm = acc(g, pr.attributes.NORMAL);
  const uv = acc(g, pr.attributes.TEXCOORD_0);
  let idx = acc(g, pr.indices);
  if (!(idx instanceof Uint32Array)) idx = new Uint32Array(idx);

  const imgIdx = g.json.textures[g.json.materials[0].pbrMetallicRoughness.baseColorTexture.index].source;
  const ibv = g.json.bufferViews[g.json.images[imgIdx].bufferView];
  const jpg = g.bin.slice(ibv.byteOffset || 0, (ibv.byteOffset || 0) + ibv.byteLength);
  const { data: pix, info } = await sharp(jpg).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  console.log(`テクスチャ ${W}x${H}x${C}`);

  // ---- 帯まわりの三角形をUV空間に焼いて、画素ごとの3D位置を求める ----
  const scan = new Uint8Array(W * H);        // 1=帯がありそうな高さの画素
  const px3 = new Float32Array(W * H * 3);
  const pnz = new Float32Array(W * H * 2);   // 外向き判定用（法線のx,z）
  let tri = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const ya = pos[a * 3 + 1], yb = pos[b * 3 + 1], yc = pos[c * 3 + 1];
    const ym = (ya + yb + yc) / 3;
    if (ym < SCAN_LO - 0.03 || ym > SCAN_HI + 0.03) continue;
    tri++;
    const ux = [uv[a * 2] * W, uv[b * 2] * W, uv[c * 2] * W];
    const vy = [uv[a * 2 + 1] * H, uv[b * 2 + 1] * H, uv[c * 2 + 1] * H];
    const x0 = Math.max(0, Math.floor(Math.min(...ux)) - 1), x1 = Math.min(W - 1, Math.ceil(Math.max(...ux)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(...vy)) - 1), y1 = Math.min(H - 1, Math.ceil(Math.max(...vy)) + 1);
    if ((x1 - x0) > 512 || (y1 - y0) > 512) continue;   // UVの島をまたぐ壊れ三角形は無視
    const d = (vy[1] - vy[2]) * (ux[0] - ux[2]) + (ux[2] - ux[1]) * (vy[0] - vy[2]);
    if (Math.abs(d) < 1e-9) continue;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const pxc = x + 0.5, pyc = y + 0.5;
      const l0 = ((vy[1] - vy[2]) * (pxc - ux[2]) + (ux[2] - ux[1]) * (pyc - vy[2])) / d;
      const l1 = ((vy[2] - vy[0]) * (pxc - ux[2]) + (ux[0] - ux[2]) * (pyc - vy[2])) / d;
      const l2 = 1 - l0 - l1;
      if (l0 < -0.03 || l1 < -0.03 || l2 < -0.03) continue;
      const yy = l0 * ya + l1 * yb + l2 * yc;
      if (yy < SCAN_LO || yy > SCAN_HI) continue;
      const o = y * W + x;
      scan[o] = 1;
      for (let k = 0; k < 3; k++) px3[o * 3 + k] = l0 * pos[a * 3 + k] + l1 * pos[b * 3 + k] + l2 * pos[c * 3 + k];
      pnz[o * 2] = l0 * nrm[a * 3] + l1 * nrm[b * 3] + l2 * nrm[c * 3];
      pnz[o * 2 + 1] = l0 * nrm[a * 3 + 2] + l1 * nrm[b * 3 + 2] + l2 * nrm[c * 3 + 2];
    }
  }
  let nScan = 0;
  for (let i = 0; i < scan.length; i++) if (scan[i]) nScan++;
  console.log(`走査: 三角形 ${tri} 枚 / 画素 ${nScan}`);

  // ---- 頭の中心軸と、画素ごとの角度θ ----
  let cx = 0, cz = 0, n = 0;
  for (let o = 0; o < scan.length; o++) {
    if (!scan[o]) continue;
    cx += px3[o * 3]; cz += px3[o * 3 + 2]; n++;
  }
  cx /= n; cz /= n;
  const theta = new Float32Array(W * H);
  for (let o = 0; o < scan.length; o++) {
    if (scan[o]) theta[o] = Math.atan2(px3[o * 3] - cx, px3[o * 3 + 2] - cz);   // 正面(z+)が0
  }

  // ---- 角度ごとに、帯（白い所）の上下の高さを実測する ----
  const lum = o => 0.299 * pix[o * C] + 0.587 * pix[o * C + 1] + 0.114 * pix[o * C + 2];
  const BINS = 180;
  const bin = o => Math.min(BINS - 1, Math.max(0, Math.floor((theta[o] + Math.PI) / (2 * Math.PI) * BINS)));
  const topY = new Float32Array(BINS).fill(-9), botY = new Float32Array(BINS).fill(9);
  for (let o = 0; o < scan.length; o++) {
    if (!scan[o] || lum(o) < WHITE) continue;
    const bi = bin(o), y = px3[o * 3 + 1];
    if (y > topY[bi]) topY[bi] = y;
    if (y < botY[bi]) botY[bi] = y;
  }
  for (let pass = 0; pass < 4; pass++) for (let i = 0; i < BINS; i++) {
    const a = (i - 1 + BINS) % BINS, b = (i + 1) % BINS;
    if (topY[i] < -8) topY[i] = Math.max(topY[a], topY[b]);
    if (botY[i] > 8) botY[i] = Math.min(botY[a], botY[b]);
  }
  const sm = arr => {
    const o = new Float32Array(BINS);
    for (let i = 0; i < BINS; i++) {
      let s = 0;
      for (let k = -3; k <= 3; k++) s += arr[(i + k + BINS) % BINS];
      o[i] = s / 7;
    }
    return o;
  };
  const TOP = sm(topY), BOT = sm(botY);
  const front = BINS / 2 | 0;
  console.log(`帯の高さ 正面: ${BOT[front].toFixed(3)} 〜 ${TOP[front].toFixed(3)}`);

  // ---- 帯の内側だけを対象にする ----
  const band = new Uint8Array(W * H);
  let nBand = 0;
  for (let o = 0; o < scan.length; o++) {
    if (!scan[o]) continue;
    const bi = bin(o), y = px3[o * 3 + 1];
    if (y < BOT[bi] - 0.001 || y > TOP[bi] + 0.001) continue;
    band[o] = 1; nBand++;
  }
  console.log(`帯の画素: ${nBand}`);

  // ---- 展開モード：ハチマキ前面を平らな帯の画像にして書き出す ----
  //   元の絵柄（浜学園のマーク）を見ながら新しい帯を作るために使う
  if (DEBUG === 'unwrap') {
    const SW = 1600, SH = 400;
    const strip = Buffer.alloc(SW * SH * 4);
    for (let o = 0; o < band.length; o++) {
      if (!band[o] || Math.abs(theta[o]) > FRONT_ARC) continue;
      if (pnz[o * 2] * Math.sin(theta[o]) + pnz[o * 2 + 1] * Math.cos(theta[o]) < 0.15) continue;
      const bi = bin(o), y = px3[o * 3 + 1];
      const u = (theta[o] + FRONT_ARC) / (2 * FRONT_ARC);
      const v = (TOP[bi] - y) / Math.max(TOP[bi] - BOT[bi], 1e-6);
      if (v < 0 || v > 1) continue;
      const sx = Math.round(u * (SW - 1)), sy = Math.round(v * (SH - 1));
      const q = (sy * SW + sx) * 4;
      strip[q] = pix[o * C]; strip[q + 1] = pix[o * C + 1]; strip[q + 2] = pix[o * C + 2]; strip[q + 3] = 255;
    }
    // すき間を埋める
    for (let pass = 0; pass < 6; pass++) {
      const add = [];
      for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
        const q = (y * SW + x) * 4;
        if (strip[q + 3]) continue;
        let r = 0, gg = 0, bb = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const p2 = ((y + dy) * SW + (x + dx)) * 4;
          if (!strip[p2 + 3]) continue;
          r += strip[p2]; gg += strip[p2 + 1]; bb += strip[p2 + 2]; c++;
        }
        if (c) add.push([q, r / c, gg / c, bb / c]);
      }
      if (!add.length) break;
      for (const [q, r, gg, bb] of add) { strip[q] = r; strip[q + 1] = gg; strip[q + 2] = bb; strip[q + 3] = 255; }
    }
    const sp = OUT.replace(/\.jpg$/, '_strip.png');
    await sharp(strip, { raw: { width: SW, height: SH, channels: 4 } }).png().toFile(sp);
    console.log('展開画像 ==>', sp, `（横=角度 ±${(FRONT_ARC * 180 / Math.PI).toFixed(0)}°）`);
    return;
  }

  // ---- もとの文字を消す ----
  const dark = new Uint8Array(W * H);
  let nd = 0;
  for (let o = 0; o < band.length; o++) {
    if (!band[o] || theta[o] < ERASE_FROM || theta[o] > FRONT_ARC) continue;
    if (lum(o) < DARKTEXT) { dark[o] = 1; nd++; }
  }
  const grow = Uint8Array.from(dark);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const o = y * W + x;
    if (!band[o] || dark[o] || theta[o] < ERASE_FROM || theta[o] > FRONT_ARC) continue;
    if (dark[o - 1] || dark[o + 1] || dark[o - W] || dark[o + W]) { grow[o] = 1; nd++; }
  }
  dark.set(grow);
  console.log(`消す文字の画素: ${nd}`);

  for (let pass = 0; pass < 60; pass++) {
    const todo = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const o = y * W + x;
      if (!dark[o]) continue;
      let r = 0, gg = 0, bb = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const p = (y + dy) * W + (x + dx);
        if (dark[p]) continue;
        r += pix[p * C]; gg += pix[p * C + 1]; bb += pix[p * C + 2]; c++;
      }
      if (c) todo.push([o, r / c, gg / c, bb / c]);
    }
    if (!todo.length) break;
    for (const [o, r, gg, bb] of todo) {
      pix[o * C] = r; pix[o * C + 1] = gg; pix[o * C + 2] = bb;
      dark[o] = 0;
    }
  }
  for (let o = 0; o < dark.length; o++) if (dark[o]) { pix[o * C] = 238; pix[o * C + 1] = 238; pix[o * C + 2] = 234; }

  // ---- 新しい文字を貼る ----
  const t = await sharp(TEXT_PNG).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const TW = t.info.width, TH = t.info.height, TC = t.info.channels, TD = t.data;
  let painted = 0;
  for (let o = 0; o < band.length; o++) {
    if (!band[o]) continue;
    const th = theta[o];
    if (Math.abs(th) > FRONT_ARC) continue;
    // 外を向いている面だけ（裏地に文字が回り込まないように）
    if (pnz[o * 2] * Math.sin(th) + pnz[o * 2 + 1] * Math.cos(th) < 0.15) continue;
    const bi = bin(o), y = px3[o * 3 + 1];
    const v = (TOP[bi] - y) / Math.max(TOP[bi] - BOT[bi], 1e-6);
    const u = (th + FRONT_ARC) / (2 * FRONT_ARC);
    if (v < 0 || v > 1) continue;
    const tx = Math.min(TW - 1, Math.max(0, u * (TW - 1)));
    const ty = Math.min(TH - 1, Math.max(0, v * (TH - 1)));
    const x0 = Math.floor(tx), y0 = Math.floor(ty);
    const fx = tx - x0, fy = ty - y0;
    let r = 0, gg = 0, bb = 0, aa = 0;
    for (let j = 0; j < 2; j++) for (let i2 = 0; i2 < 2; i2++) {
      const w = (i2 ? fx : 1 - fx) * (j ? fy : 1 - fy);
      const p = (Math.min(TH - 1, y0 + j) * TW + Math.min(TW - 1, x0 + i2)) * TC;
      r += TD[p] * w; gg += TD[p + 1] * w; bb += TD[p + 2] * w; aa += TD[p + 3] * w;
    }
    const a = aa / 255;
    if (a < 0.004) continue;
    pix[o * C] = pix[o * C] * (1 - a) + r * a;
    pix[o * C + 1] = pix[o * C + 1] * (1 - a) + gg * a;
    pix[o * C + 2] = pix[o * C + 2] * (1 - a) + bb * a;
    painted++;
  }
  console.log(`文字を貼った画素: ${painted}`);

  await sharp(Buffer.from(pix), { raw: { width: W, height: H, channels: C } })
    .jpeg({ quality: 95, mozjpeg: true }).toFile(OUT);
  console.log('==>', OUT);

  if (DEBUG === 'debug') {
    const dbg = Buffer.alloc(W * H * 3);
    for (let o = 0; o < band.length; o++) {
      if (band[o]) {
        dbg[o * 3] = 255;
        dbg[o * 3 + 1] = (theta[o] >= thC - half && theta[o] <= thC + half) ? 255 : 0;
      } else if (scan[o]) dbg[o * 3 + 2] = 160;
    }
    await sharp(dbg, { raw: { width: W, height: H, channels: 3 } })
      .resize(1024, 1024).png().toFile(OUT.replace(/\.jpg$/, '_mask.png'));
    console.log('debug mask 出力');
  }
})();
