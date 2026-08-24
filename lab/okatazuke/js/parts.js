// ============================================================
// parts.js — 部品を1つのメッシュにまとめる道具
//   ・部品ごとに「骨番号」を持たせて、1ドローコールで全部描く
//   ・aONrm（部品の中心から外向き）は部品ごとに計算する
//     ★輪郭線をこれで押し出す。陰影用の法線で押すと継ぎ目で線が割れる
//   ・鏡うつし（左右対称の部品）は行列式が負になるので巻き順を直す
// ============================================================
'use strict';

class PartBuilder {
  constructor() {
    this.pos = []; this.nrm = []; this.onrm = []; this.uv = [];
    this.col = []; this.param = []; this.bone = []; this.bone2 = []; this.idx = [];
    this.base = 0;
  }

  // geo … {pos,nrm,uv,idx}
  // o   … {bone, mat, col, faceMask, shine, tex, uvRect, bone2, weight}
  add(geo, o = {}) {
    const mat = o.mat || M4.ident();
    const nMat = M4.normalMat(mat, new Float32Array(16));
    const det = detOf(mat);
    const col = o.col ? hex2rgb(o.col) : [1, 1, 1];
    const bone = o.bone || 0;
    const bone2 = (o.bone2 === undefined) ? bone : o.bone2;
    const wgt = (o.weight === undefined) ? 1 : o.weight;
    const uvRect = o.uvRect || [0, 0, 1, 1];
    const n = geo.pos.length / 3;

    // 部品の中心（輪郭を押し出す向きの基準）
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += geo.pos[i * 3]; cy += geo.pos[i * 3 + 1]; cz += geo.pos[i * 3 + 2]; }
    cx /= n; cy /= n; cz /= n;

    for (let i = 0; i < n; i++) {
      const x = geo.pos[i * 3], y = geo.pos[i * 3 + 1], z = geo.pos[i * 3 + 2];
      this.pos.push(
        mat[0] * x + mat[4] * y + mat[8] * z + mat[12],
        mat[1] * x + mat[5] * y + mat[9] * z + mat[13],
        mat[2] * x + mat[6] * y + mat[10] * z + mat[14],
      );
      const nx = geo.nrm[i * 3], ny = geo.nrm[i * 3 + 1], nz = geo.nrm[i * 3 + 2];
      let tx = nMat[0] * nx + nMat[4] * ny + nMat[8] * nz;
      let ty = nMat[1] * nx + nMat[5] * ny + nMat[9] * nz;
      let tz = nMat[2] * nx + nMat[6] * ny + nMat[10] * nz;
      let L = Math.hypot(tx, ty, tz) || 1;
      this.nrm.push(tx / L, ty / L, tz / L);

      // 外向き（部品の中心から）
      let ox = x - cx, oy = y - cy, oz = z - cz;
      L = Math.hypot(ox, oy, oz) || 1;
      ox /= L; oy /= L; oz /= L;
      let px = mat[0] * ox + mat[4] * oy + mat[8] * oz;
      let py = mat[1] * ox + mat[5] * oy + mat[9] * oz;
      let pz = mat[2] * ox + mat[6] * oy + mat[10] * oz;
      L = Math.hypot(px, py, pz) || 1;
      this.onrm.push(px / L, py / L, pz / L);

      const u = geo.uv ? geo.uv[i * 2] : 0.5;
      const v = geo.uv ? geo.uv[i * 2 + 1] : 0.5;
      this.uv.push(uvRect[0] + u * (uvRect[2] - uvRect[0]),
                   uvRect[1] + v * (uvRect[3] - uvRect[1]));
      this.col.push(col[0], col[1], col[2]);
      this.param.push(o.faceMask || 0, o.shine || 0, o.tex || 0, 0);
      this.bone.push(bone, wgt, bone2, 1 - wgt);
      this.bone2.push(0, 0, 0, 0);      // 手組みは 2本で足りる
    }

    const flip = det < 0;   // 鏡うつしは裏返るので巻き順を入れかえる
    for (let i = 0; i < geo.idx.length; i += 3) {
      const a = this.base + geo.idx[i], b = this.base + geo.idx[i + 1], c = this.base + geo.idx[i + 2];
      if (flip) this.idx.push(a, c, b); else this.idx.push(a, b, c);
    }
    this.base += n;
    return this;
  }

  build(gl) {
    const idx = this.base > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx);
    return {
      pos: new Float32Array(this.pos), nrm: new Float32Array(this.nrm),
      onrm: new Float32Array(this.onrm), uv: new Float32Array(this.uv),
      col: new Float32Array(this.col), param: new Float32Array(this.param),
      bone: new Float32Array(this.bone), bone2: new Float32Array(this.bone2),
      idx, count: this.idx.length,
    };
  }
}

function detOf(m) {
  // 3x3 部分の行列式だけ見れば向きが分かる
  return m[0] * (m[5] * m[10] - m[6] * m[9])
       - m[4] * (m[1] * m[10] - m[2] * m[9])
       + m[8] * (m[1] * m[6] - m[2] * m[5]);
}

// ---- よく使う形 --------------------------------------------------------

// 角のまるい箱。k を上げるほど角ばる（2=まる、6=ほぼ箱）
function roundBox(w, h, d, opt = {}) {
  const k = opt.k ?? 5.0;
  const edge = opt.edge ?? 6.0;      // 上下のまるめ具合
  const rings = opt.rings ?? 14;
  const s = t => Math.pow(Math.max(1e-4, 1 - Math.pow(Math.abs(2 * t - 1), edge)), 1 / edge);
  return loftGeometry({
    rings, radial: opt.radial ?? 20, k,
    profile: t => [w * 0.5 * s(t), d * 0.5 * s(t)],
    spine: t => [0, t * h, 0],
    minR: 0.004,
  });
}

// 球（下が y=0、上が y=2R）。頭・目・つぶ に使う
function ball(r, opt = {}) {
  const sy = opt.sy ?? 1.0;   // 縦のつぶし
  const sz = opt.sz ?? 1.0;   // 前後のつぶし
  return loftGeometry({
    rings: opt.rings ?? 20, radial: opt.radial ?? 26, k: opt.k ?? 2.0,
    profile: t => [r * Math.sin(Math.PI * t), r * sz * Math.sin(Math.PI * t)],
    spine: t => [0, r * sy * (1 - Math.cos(Math.PI * t)), 0],
    minR: 0.004,
  });
}

// 球の一部（帽子やボブのかぶせもの）。t0..t1 は下から上への割合
function ballShell(r, t0, t1, opt = {}) {
  const sy = opt.sy ?? 1.0, sz = opt.sz ?? 1.0;
  const u = t => t0 + (t1 - t0) * t;
  return loftGeometry({
    rings: opt.rings ?? 14, radial: opt.radial ?? 26, k: opt.k ?? 2.0,
    profile: t => [r * Math.sin(Math.PI * u(t)), r * sz * Math.sin(Math.PI * u(t))],
    spine: t => [0, r * sy * (1 - Math.cos(Math.PI * u(t))), 0],
    capBottom: opt.capBottom ?? false, capTop: opt.capTop ?? true,
    minR: 0.004,
  });
}

// つつ（腕・足）。下 r0、上 r1、まっすぐ +Y へ
function limb(len, r0, r1, opt = {}) {
  const round = opt.round ?? 0.55;
  return loftGeometry({
    rings: opt.rings ?? 12, radial: opt.radial ?? 16, k: opt.k ?? 2.2,
    profile: t => {
      const r = r0 + (r1 - r0) * t;
      // 先っぽをまるめる
      const e = Math.min(1, (1 - Math.abs(2 * t - 1)) / round + 0.25);
      const s = Math.pow(Math.min(1, e), 0.5);
      return [r * s, r * (opt.zs ?? 1) * s];
    },
    spine: t => [0, t * len, 0],
    minR: 0.004,
  });
}

// 行列の組み立て（部品を置く用）
function T(x, y, z) { const m = M4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; }
function Rx(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
function Ry(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
function Rz(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
function S(x, y, z) { const m = M4.ident(); m[0] = x; m[5] = y === undefined ? x : y; m[10] = z === undefined ? x : z; return m; }
function mul(...ms) { return ms.reduce((a, b) => M4.mul(a, b)); }

// 制御点のならび（[t, 値, 値, …]）を なめらかにつなぐ。
// 体の断面を「高さごとの表」で書けるようにするための道具。
function curve(rows, t, col) {
  const n = rows.length;
  if (t <= rows[0][0]) return rows[0][col];
  if (t >= rows[n - 1][0]) return rows[n - 1][col];
  let i = 0;
  while (i < n - 2 && t > rows[i + 1][0]) i++;
  const p1 = rows[i], p2 = rows[i + 1];
  const p0 = rows[Math.max(0, i - 1)], p3 = rows[Math.min(n - 1, i + 2)];
  const u = (t - p1[0]) / (p2[0] - p1[0]);
  // Catmull-Rom（角が立たないように）
  const a = p1[col], b = p2[col];
  const m1 = (b - p0[col]) * 0.5, m2 = (p3[col] - a) * 0.5;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * a + (u3 - 2 * u2 + u) * m1
       + (-2 * u3 + 3 * u2) * b + (u3 - u2) * m2;
}
