// ============================================================
// props.js — 足場・アイテムのモデル
//
//  ★同じ球を並べただけの形にしない。それが「安っぽさ」の正体になる。
//    種類ごとに、シルエットと手ざわりが読めるところまで作りこむ。
//      雲     … 底は平ら、上はふくらみの大きさをバラバラにする
//      バネ雲 … 上にコイルばねを立てる
//      氷雲   … 角のある結晶。面ごとに法線を切ってエッジを立てる
//      こわれ雲 … ひび割れて、いまにも崩れそうな形
//      岩     … 面を切った多面体。丸い玉には絶対にしない
//
//  頂点は pos(3) / nrm(3) / onrm(3) / col(3) の12float。
//  col は「インスタンスの色にかける倍率」。白=そのまま、他=部分的な色替え。
// ============================================================
'use strict';

const P_STRIDE = 12;

class PropBuilder {
  constructor() { this.v = []; this.idx = []; this.count = 0; }

  // opt:
  //   offset/scale  … 置き場所と大きさ
  //   center        … 輪郭線を押し出す向きの基準点
  //   col           … 頂点カラー（インスタンス色への倍率）。省略で白
  //   colFn         … (x,y,z) => [r,g,b] 位置で色を変えたいとき
  //   displace      … (x,y,z) => 法線方向へずらす量。岩のデコボコに使う
  //   flat          … true で面ごとに法線を切る（角が立つ）
  add(geo, opt) {
    const {
      offset = [0,0,0], scale = [1,1,1], center = [0,0,0], rot = null,
      col = [1,1,1], colFn = null, displace = null, flat = false,
    } = opt || {};

    // 回転（かたまりごとに向きを変えると、同じ形でも並んで見えない）
    let M = null, MN = null;
    if (rot) { M = M4.compose([0,0,0], rot, [1,1,1]); MN = M4.normalMat(M); }
    const xf = (x, y, z, m) => [
      m[0]*x + m[4]*y + m[8]*z, m[1]*x + m[5]*y + m[9]*z, m[2]*x + m[6]*y + m[10]*z,
    ];

    const n = geo.pos.length / 3;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let nx = geo.nrm[i*3] / scale[0], ny = geo.nrm[i*3+1] / scale[1], nz = geo.nrm[i*3+2] / scale[2];
      const nl = Math.hypot(nx, ny, nz) || 1; nx/=nl; ny/=nl; nz/=nl;
      let px = geo.pos[i*3]   * scale[0];
      let py = geo.pos[i*3+1] * scale[1];
      let pz = geo.pos[i*3+2] * scale[2];
      if (displace) {
        const d = displace(geo.pos[i*3], geo.pos[i*3+1], geo.pos[i*3+2]);
        px += nx * d; py += ny * d; pz += nz * d;
      }
      if (M) {
        const p2 = xf(px, py, pz, M);  px = p2[0]; py = p2[1]; pz = p2[2];
        const n2 = xf(nx, ny, nz, MN);
        const l2 = Math.hypot(n2[0], n2[1], n2[2]) || 1;
        nx = n2[0]/l2; ny = n2[1]/l2; nz = n2[2]/l2;
      }
      px += offset[0]; py += offset[1]; pz += offset[2];
      P[i*3]=px; P[i*3+1]=py; P[i*3+2]=pz;
      N[i*3]=nx; N[i*3+1]=ny; N[i*3+2]=nz;
    }

    const emit = (px,py,pz, nx,ny,nz) => {
      let ox = px-center[0], oy = py-center[1], oz = pz-center[2];
      const ol = Math.hypot(ox,oy,oz) || 1; ox/=ol; oy/=ol; oz/=ol;
      const c = colFn ? colFn(px,py,pz) : col;
      this.v.push(px,py,pz, nx,ny,nz, ox,oy,oz, c[0],c[1],c[2]);
      return this.count++;
    };

    if (flat) {
      // 面ごとに頂点を分けて、面の法線を割りあてる＝角が立つ
      for (let i = 0; i < geo.idx.length; i += 3) {
        const a = geo.idx[i], b = geo.idx[i+1], c = geo.idx[i+2];
        const ax=P[a*3],ay=P[a*3+1],az=P[a*3+2];
        const bx=P[b*3],by=P[b*3+1],bz=P[b*3+2];
        const cx=P[c*3],cy=P[c*3+1],cz=P[c*3+2];
        let fx=(by-ay)*(cz-az)-(bz-az)*(cy-ay);
        let fy=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);
        let fz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
        const fl=Math.hypot(fx,fy,fz)||1; fx/=fl; fy/=fl; fz/=fl;
        const i0=emit(ax,ay,az,fx,fy,fz), i1=emit(bx,by,bz,fx,fy,fz), i2=emit(cx,cy,cz,fx,fy,fz);
        this.idx.push(i0,i1,i2);
      }
    } else {
      const base = this.count;
      for (let i = 0; i < n; i++) emit(P[i*3],P[i*3+1],P[i*3+2], N[i*3],N[i*3+1],N[i*3+2]);
      for (let i = 0; i < geo.idx.length; i++) this.idx.push(base + geo.idx[i]);
    }
    return this;
  }

  build() {
    // ★見た目の「上のはし」を実測して持たせる。
    //   これを定数で決め打ちすると、形を変えたとたんにチッチが
    //   足場に めりこんだり 浮いたり する（実際に一度そうなった）。
    let top = -1e9;
    for (let i = 1; i < this.v.length; i += P_STRIDE) {
      if (this.v[i] > top) top = this.v[i];
    }
    return {
      vertices: new Float32Array(this.v),
      indices: this.count > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx),
      indexCount: this.idx.length,
      vertexCount: this.count,
      u32: this.count > 65535,
      top,
    };
  }
}

// ============================================================
//  雲
// ============================================================
// もこもこの正体は「底が平らで、上のふくらみの大きさがバラバラ」なこと。
// 同じ大きさの玉を等間隔で並べると、とたんに毛虫みたいになる。
// ここでは各玉の“底”を同じ高さにそろえて置く（大きい玉ほど中心が高くなる）。
const CLOUD_BOTTOM = -0.20;

// [x, z, 半径, 縦のつぶれ]
const CLOUD_LUMPS = [
  [-0.02,  0.02, 0.335, 0.86],   // 主役の大きいふくらみ
  [-0.38, -0.03, 0.245, 0.82],
  [ 0.35,  0.02, 0.270, 0.84],
  [-0.19,  0.14, 0.215, 0.80],   // 上のこぶ（奥へずらす）
  [ 0.16,  0.16, 0.190, 0.78],
  [-0.60, -0.02, 0.155, 0.76],   // はしの小さいの
  [ 0.60,  0.00, 0.145, 0.74],
  [ 0.06, -0.19, 0.225, 0.80],   // 手前へふくらませて奥ゆきを出す
  [-0.10, -0.16, 0.185, 0.78],
];

function cloudLumps(b, seg, opt, flatten) {
  const s = sphereGeometry(seg[0], seg[1]);
  const f = flatten === undefined ? 1 : flatten;
  for (const [x, z, r, sq] of CLOUD_LUMPS) {
    const ry = r * sq * f;
    b.add(s, {
      offset: [x, CLOUD_BOTTOM + ry, z],
      scale: [r, ry, r],
      center: [0, 0, 0],
      ...(opt || {}),
    });
  }
  return b;
}

function buildCloudMesh() {
  return cloudLumps(new PropBuilder(), [12, 8]).build();
}

// ---------------- バネ雲 ----------------
// 雲の上にコイルばねを立てる。緑に塗るだけだと、なぜ高く跳ねるのか伝わらない。
// 土台の雲はぺたんこにしておくこと。ふつうの厚みのままだと
// コイルが雲に埋もれて、ただの緑の雲に見えてしまう。
// そして「ふた」の上のはしが、他の足場の上のはし（=乗る高さ 0.32）と
// そろうように高さを組む。ずれるとバネだけ浮いて見える。
const SPRING_FLAT = 0.46;
function springParts(b, seg, opt) {
  // ★コイルは「ふた」より外へ張り出させること。ふたのほうが広いと、
  //   少し見おろす角度のせいでコイルがまるごと隠れてしまう。
  const TURNS = 2.2, RAD = 0.225, H = 0.175;
  const Y0 = CLOUD_BOTTOM + 0.24;          // コイルの根もと
  const PAD_R = 0.095;                     // ふたの厚みの半分
  // ★らせんは tubeGeometry で作ること。loftGeometry は断面を必ず水平に置くので、
  //   横へ回りこむらせんに使うと、断面が進行方向とそろって平たい輪になる。
  const coil = tubeGeometry(
    t => [Math.cos(t * Math.PI * 2 * TURNS) * RAD, t * H, Math.sin(t * Math.PI * 2 * TURNS) * RAD],
    0.075, 66, 9);
  // ★宇宙では足場の色じたいが明るい（uFloor）ので、ここを 2.1倍のままだと
  //   白（＝バイオームの色）に振り切れて、らせんが**のっぺりした塊**に見えた。
  //   dim で落として、陰影＝らせんの形を見えるようにする。
  const K = (opt && opt.dim) || 1;
  b.add(coil, { offset: [0, Y0, 0], center: [0, Y0, 0],
                col: [2.1 * K, 2.1 * K, 2.15 * K] });
  // ばねの上のふた（ここに乗る）。明るくして、跳ねる場所だと分かるようにする。
  b.add(sphereGeometry(14, 5, { vFrom: 0.40, vTo: 1 }), {
    offset: [0, Y0 + H, 0], scale: [0.195, PAD_R, 0.195],
    center: [0, Y0 + H, 0], col: [2.4 * K, 2.4 * K, 2.45 * K],
  });
  return b;
}

function buildSpringMesh() {
  const b = new PropBuilder();
  cloudLumps(b, [12, 8], null, SPRING_FLAT);
  springParts(b);
  return b.build();
}

// ---------------- 氷雲 ----------------
// 丸い雲ではなく、角のある結晶にする。面ごとに法線を切ってエッジを立てる。
function buildIceMesh() {
  const b = new PropBuilder();
  const s = sphereGeometry(9, 6);
  const h = (x,y,z) => { // 決定的なデコボコ
    const v = Math.sin(x*7.3+1.1)*Math.cos(y*6.1+2.3)*Math.sin(z*8.7+0.7);
    return v * 0.055;
  };
  const shards = [
    [-0.02, 0.02, 0.34, 0.80], [-0.36, -0.02, 0.25, 0.76],
    [ 0.34, 0.02, 0.27, 0.78], [-0.17, 0.13, 0.20, 0.72],
    [ 0.15, 0.15, 0.18, 0.70], [ 0.05, -0.18, 0.22, 0.74],
    [-0.58, -0.02, 0.15, 0.70], [ 0.58, 0.00, 0.14, 0.70],
  ];
  for (const [x, z, r, sq] of shards) {
    const ry = r * sq;
    b.add(s, {
      offset: [x, CLOUD_BOTTOM + ry, z], scale: [r, ry, r],
      center: [0,0,0], displace: h, flat: true,
    });
  }
  // 上に突き出るとがった氷（ここが「氷だ」と分かる決め手）
  const spike = loftGeometry({
    rings: 5, radial: 6, k: 2.0, minR: 0.006,
    profile: t => { const r = 0.085 * (1 - t * 0.92); return [r, r]; },
    spine: t => [0, t * 0.30, 0],
  });
  for (const [x, z, sc] of [[-0.13, 0.06, 1.0], [0.15, -0.04, 0.78], [0.02, 0.12, 0.62]]) {
    b.add(spike, {
      offset: [x, CLOUD_BOTTOM + 0.22, z], scale: [sc, sc, sc],
      center: [x, CLOUD_BOTTOM + 0.22, z], flat: true, col: [1.25, 1.3, 1.4],
    });
  }
  return b.build();
}

// ---------------- こわれ雲 ----------------
// ふくらみを離して、割れ目が見えるようにする。上面もへこませて「もろさ」を出す。
function buildBreakMesh() {
  const b = new PropBuilder();
  const s = sphereGeometry(10, 7);
  const chunks = [
    [-0.30, 0.00, 0.245, 0.72], [ 0.02, 0.03, 0.255, 0.70],
    [ 0.33, -0.01, 0.235, 0.72], [-0.56, -0.03, 0.150, 0.68],
    [ 0.58,  0.01, 0.145, 0.68], [ 0.00, -0.20, 0.180, 0.66],
    [-0.16,  0.16, 0.140, 0.64], [ 0.19,  0.15, 0.135, 0.64],
  ];
  for (const [x, z, r, sq] of chunks) {
    const ry = r * sq;
    b.add(s, {
      offset: [x, CLOUD_BOTTOM + ry * 0.92, z], scale: [r, ry, r],
      center: [0,0,0], flat: true,
      // 上ほど暗くして、ひび割れて陰った感じにする
      colFn: (px, py) => { const k = clamp((py - CLOUD_BOTTOM) / 0.4, 0, 1); return [1 - k*0.28, 1 - k*0.30, 1 - k*0.26]; },
    });
  }
  return b.build();
}

// ---------------- ☄️ 小惑星（宇宙ゾーンの足場）----------------
// ★宇宙に雲が浮いていてはおかしい。色を変えただけの雲は、いくら暗くしても
//   「灰色の雲」にしか見えない。ここは形そのものを別物にする。
//
//  雲との決定的なちがい
//    ・底が平らでない（宇宙に「下」は無い）
//    ・同じ大きさのふくらみを横に並べない。大中小をばらばらに置く
//    ・かたまりごとに向きを変える（軸にそろえない）
//    ・面を切って角を立てる。丸い玉のままだと絶対に岩に見えない
const ASTEROID_CHUNKS = [
  // [x,      y,     z,     大きさ, つぶし,  回転(rx,ry,rz)]
  // ★かたまりは**重ねる**。すきまを空けると、遠目に「割れた破片の散らばり」に
  //   見えて、乗れる岩に見えなかった（実測）。
  [-0.05, -0.02,  0.00, 0.400, 0.66, [ 0.45,  0.9,  0.30]],   // 主役
  [ 0.29,  0.03, -0.04, 0.290, 0.72, [ 1.10, -0.5, -0.75]],
  [-0.32, -0.04,  0.05, 0.270, 0.70, [-0.60,  1.7,  0.95]],
  [ 0.13,  0.11,  0.10, 0.190, 0.74, [ 1.90,  0.3, -0.40]],
  [-0.17,  0.11, -0.08, 0.170, 0.72, [ 0.25, -1.2,  1.40]],
  [ 0.50, -0.05,  0.02, 0.175, 0.64, [-1.30,  0.7,  0.20]],
  [-0.52, -0.03, -0.03, 0.160, 0.66, [ 0.80,  2.2, -0.90]],
  [ 0.02, -0.13,  0.13, 0.155, 0.62, [ 1.55, -1.8,  0.55]],
];
// ゴツゴツ。決まった式なので、毎回まったく同じ岩になる（ちらつかない）
const rockBump = (x, y, z) =>
    Math.sin(x * 6.3 + 0.4) * Math.cos(z * 5.1 + 1.7) * 0.16 +
    Math.sin(y * 8.9 + 2.2) * Math.cos(x * 7.7 - 0.9) * 0.11 +
    Math.sin(z * 11.7 + 3.3) * 0.06;

// ---- クレーター -------------------------------------------------
//  小惑星が小惑星に見える決め手は、ゴツゴツではなく**クレーター**。
//  [向き(x,y,z), 半径(ラジアン), 深さ]
//  ★深さは浅め。深くするとチッチが浮いて見える（足場の上面は物理では平ら）。
const ROCK_CRATERS = [
  [ 0.62,  0.55,  0.56, 0.62, 0.135],
  [-0.78,  0.20,  0.59, 0.46, 0.110],
  [ 0.10, -0.35, -0.93, 0.52, 0.120],
  [-0.30,  0.86, -0.41, 0.34, 0.080],
  [ 0.88, -0.30,  0.36, 0.30, 0.070],
];

// おわん＋ふちの盛りあがり。ふちがあるだけで一気に「クレーター」に見える。
function craterBump(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  const ux = x / l, uy = y / l, uz = z / l;
  let d = 0;
  for (const [cx, cy, cz, R, dp] of ROCK_CRATERS) {
    const dot = clamp(ux * cx + uy * cy + uz * cz, -1, 1);
    const t = Math.acos(dot) / R;             // 0=まん中 1=ふち
    if (t > 1.45) continue;
    if (t < 1) d -= dp * (1 - t * t);         // へこみ
    const e = (t - 1.0) / 0.24;
    d += dp * 0.62 * Math.exp(-e * e);        // ふち
  }
  return d;
}

// 大きなかたまり用。ゴツゴツを弱めてクレーターを主役にし、
// 上のめんをすこし平らにする（そこがチッチの降りる場所なので）。
function rockSurface(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  const uy = y / l;
  let d = rockBump(x, y, z) * 0.45 + craterBump(x, y, z);
  if (uy > 0.5) d -= (uy - 0.5) * 0.30;      // 天びんを平らに
  return d;
}

function asteroidChunks(b, colFn) {
  const s = sphereGeometry(11, 8);    // クレーターを刻むので、少し細かく
  const sSmall = sphereGeometry(7, 5);
  for (const [x, y, z, r, sq, rot] of ASTEROID_CHUNKS) {
    // 大きなかたまりだけクレーターを彫る。小石に彫っても分からないうえ重い。
    const big = r >= 0.20;
    b.add(big ? s : sSmall, {
      offset: [x, y, z], scale: [r, r * sq, r * 0.92], rot,
      center: [0, 0, 0], displace: big ? rockSurface : rockBump, flat: true, colFn,
    });
  }
  return b;
}

// 上にちょこんと乗せる小石。大小の差がつくと、岩が大きく見える。
const ROCK_PEBBLES = [
  [-0.15, 0.20,  0.06, 0.052, [0.4, 1.1, 0.2]],
  [ 0.26, 0.17, -0.05, 0.038, [1.3, 0.2, 0.9]],
  [ 0.02, 0.22, -0.13, 0.030, [0.7, 2.0, 1.4]],
];
function rockPebbles(b, colFn) {
  const s = sphereGeometry(6, 4);
  for (const [x, y, z, r, rot] of ROCK_PEBBLES) {
    b.add(s, { offset: [x, y, z], scale: [r, r * 0.78, r * 0.92], rot,
               center: [0, 0, 0], displace: rockBump, flat: true, colFn });
  }
  return b;
}

function buildRockMesh() {
  // 上の面を明るく、下を暗く。岩の重さはこれで出る。
  const colFn = (px, py) => {
    const k = clamp((py + 0.22) / 0.46, 0, 1);
    return [0.70 + k * 0.50, 0.70 + k * 0.48, 0.72 + k * 0.46];
  };
  const b = asteroidChunks(new PropBuilder(), colFn);
  rockPebbles(b, colFn);
  return b.build();
}

// 宇宙ゾーンのバネ／氷／こわれは、岩のかたまりに同じ飾りを足す
function buildRockSpringMesh() {
  const b = new PropBuilder();
  const s = sphereGeometry(7, 5);
  // バネを立てるので、土台の岩は低く平たくする
  for (const [x, y, z, r, sq, rot] of ASTEROID_CHUNKS.slice(0, 5)) {
    b.add(s, {
      offset: [x, y * 0.5 - 0.06, z], scale: [r, r * sq * 0.52, r * 0.92], rot,
      center: [0, 0, 0], displace: rockSurface, flat: true,
    });
  }
  springParts(b, null, { dim: 0.62 });   // 岩の上の金属バネ。明るさを落として形を見せる
  return b.build();
}

// ============================================================
//  アイテム
// ============================================================
// ⭐ 星：角をふくらませた立体。板ポリだと横から見て消える。
function buildStarMesh() {
  const N = 5, RO = 0.5, RI = 0.215, TH = 0.16;
  const pos = [], nrm = [], idx = [];
  const ring = [];
  for (let i = 0; i < N * 2; i++) {
    const a = (i / (N * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = (i % 2 === 0) ? RO : RI;
    ring.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const push = (p, n) => { pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); };
  for (const face of [1, -1]) {
    const tip = pos.length / 3;
    push([0, 0, face * TH], [0, 0, face]);
    const start = pos.length / 3;
    for (const [x, y] of ring) {
      const n = [x * 0.42, y * 0.42, face * 0.88];
      const l = Math.hypot(n[0], n[1], n[2]);
      push([x, y, 0], [n[0]/l, n[1]/l, n[2]/l]);
    }
    for (let i = 0; i < N * 2; i++) {
      const a = start + i, bq = start + (i + 1) % (N * 2);
      if (face > 0) idx.push(tip, a, bq); else idx.push(tip, bq, a);
    }
  }
  const b = new PropBuilder();
  b.add({ pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) },
        { center: [0, 0, 0], flat: true });
  return b.build();
}

// 🍙 おにぎり：角の丸い三角のかたまり ＋ のりの帯
function buildOnigiriMesh() {
  const b = new PropBuilder();
  const body = loftGeometry({
    rings: 12, radial: 16, k: 3.4, minR: 0.02,
    profile: t => { const r = 0.44 * (1 - Math.pow(t, 1.8)) + 0.045; return [r, r * 0.60]; },
    spine: t => [0, t * 0.74 - 0.32, 0],
  });
  b.add(body, { center: [0, 0, 0] });
  // のり：底に巻いた黒い帯。これが無いと、ただの白い三角に見える。
  const nori = loftGeometry({
    rings: 4, radial: 16, k: 3.4, minR: 0.02,
    profile: t => { const u = t * 0.30; const r = 0.44 * (1 - Math.pow(u, 1.8)) + 0.045; return [r * 1.03, r * 0.62]; },
    spine: t => [0, t * 0.222 - 0.32, 0],
    capTop: false,
  });
  b.add(nori, { center: [0, 0, 0], col: [0.16, 0.20, 0.18] });
  return b.build();
}

// ============================================================
//  じゃま役（高度で姿が変わる。中身は同じひとつのオブジェクト）
//    〜1000m … タカ
//    1000m〜 … 気球
//    1500m〜 … 宇宙人
//  どれも「進む向き＝+X」で作る。置くときに iRot で向きを変える。
// ============================================================

// ---------------- 🦅 タカ ----------------
function buildHawkMesh() {
  const b = new PropBuilder();

  // 胴：前後に長い紡錘形。+Y に作ってから寝かせる。
  const bodyR = [0.075, 0.150, 0.170, 0.135, 0.055];
  const body = loftGeometry({
    rings: 12, radial: 12, k: 2.3, minR: 0.02,
    profile: t => { const r = catmull(bodyR, t); return [r, r * 0.86]; },
    spine: t => [0, t * 0.86 - 0.43, 0],
  });
  // Y軸の形を X 方向へ倒す（scale で入れかえるとメッシュが裏返るので使わない）
  const lay = g => {
    const p = new Float32Array(g.pos.length), n = new Float32Array(g.nrm.length);
    for (let i = 0; i < g.pos.length; i += 3) {
      p[i] = g.pos[i+1]; p[i+1] = -g.pos[i]; p[i+2] = g.pos[i+2];
      n[i] = g.nrm[i+1]; n[i+1] = -g.nrm[i]; n[i+2] = g.nrm[i+2];
    }
    return { pos: p, nrm: n, uv: g.uv, idx: g.idx };
  };
  b.add(lay(body), { center: [0,0,0] });

  // 翼：左右へ大きく広げる。シルエットの主役はここ。
  const wing = loftGeometry({
    rings: 8, radial: 8, k: 2.7, minR: 0.006,
    profile: t => [catmull([0.19, 0.21, 0.17, 0.11, 0.04], t) * 0.55,
                   catmull([0.045, 0.042, 0.033, 0.022, 0.008], t)],
    spine: t => [0, t * 0.56, 0],
  });
  for (const s of [-1, 1]) {
    // 少し後ろへ、少し上へ反らせる
    // ★体は +X が進行方向。翼は横（±Z）へ広げたいので X軸まわりに回す。
    //   Z軸まわりに回すと前後に生えて、体の中に埋まって見えなくなる。
    //   さらに、真横（±Z）へ広げるとカメラ方向を向いて短く見える。
    //   45°ほど上へ振って「M字」のシルエットにすると、横から見ても鳥に読める。
    const m = M4.compose([0, 0.02, s * 0.05], [s * 0.72, 0, 0], [1,1,1]);
    const g = { pos: new Float32Array(wing.pos.length), nrm: new Float32Array(wing.nrm.length), uv: wing.uv, idx: wing.idx };
    const nm = M4.normalMat(m);
    for (let i = 0; i < wing.pos.length; i += 3) {
      const x = wing.pos[i], y = wing.pos[i+1], z = wing.pos[i+2];
      g.pos[i]   = m[0]*x + m[4]*y + m[8]*z + m[12];
      g.pos[i+1] = m[1]*x + m[5]*y + m[9]*z + m[13];
      g.pos[i+2] = m[2]*x + m[6]*y + m[10]*z + m[14];
      const nx = wing.nrm[i], ny = wing.nrm[i+1], nz = wing.nrm[i+2];
      g.nrm[i]   = nm[0]*nx + nm[4]*ny + nm[8]*nz;
      g.nrm[i+1] = nm[1]*nx + nm[5]*ny + nm[9]*nz;
      g.nrm[i+2] = nm[2]*nx + nm[6]*ny + nm[10]*nz;
    }
    b.add(g, { center: [0,0,0], col: [0.82, 0.78, 0.76] });
  }

  // 尾：うしろに開く扇
  const tail = loftGeometry({
    rings: 5, radial: 8, k: 2.8, minR: 0.006,
    profile: t => [0.030 - t * 0.017, 0.038 + t * 0.115],
    spine: t => [0, t * 0.24, 0],
  });
  const tm = M4.compose([-0.40, 0.01, 0], [0, 0, Math.PI/2], [1,1,1]);
  const tg = { pos: new Float32Array(tail.pos.length), nrm: new Float32Array(tail.nrm.length), uv: tail.uv, idx: tail.idx };
  const tn = M4.normalMat(tm);
  for (let i = 0; i < tail.pos.length; i += 3) {
    const x = tail.pos[i], y = tail.pos[i+1], z = tail.pos[i+2];
    tg.pos[i] = tm[0]*x + tm[4]*y + tm[8]*z + tm[12];
    tg.pos[i+1] = tm[1]*x + tm[5]*y + tm[9]*z + tm[13];
    tg.pos[i+2] = tm[2]*x + tm[6]*y + tm[10]*z + tm[14];
    const nx = tail.nrm[i], ny = tail.nrm[i+1], nz = tail.nrm[i+2];
    tg.nrm[i] = tn[0]*nx + tn[4]*ny + tn[8]*nz;
    tg.nrm[i+1] = tn[1]*nx + tn[5]*ny + tn[9]*nz;
    tg.nrm[i+2] = tn[2]*nx + tn[6]*ny + tn[10]*nz;
  }
  b.add(tg, { center: [0,0,0], col: [0.80, 0.76, 0.74] });

  // くちばし（黄色）と目（黒）。小さくても、この2つで「鳥」に見える。
  b.add(sphereGeometry(8, 5), {
    offset: [0.50, -0.01, 0], scale: [0.09, 0.045, 0.045],
    center: [0.46, 0, 0], col: [1.9, 1.5, 0.5],
  });
  for (const s of [-1, 1]) {
    b.add(sphereGeometry(8, 5), {
      offset: [0.33, 0.055, s * 0.075], scale: [0.042, 0.042, 0.042],
      center: [0.33, 0.055, s * 0.075], col: [0.08, 0.07, 0.09],
    });
  }
  return b.build();
}

// ---------------- 🎈 気球 ----------------
function buildBalloonMesh() {
  const b = new PropBuilder();
  // ふくらみ：上がまるく、下がすぼまるしずく形
  const env = loftGeometry({
    rings: 16, radial: 16, k: 2.1, minR: 0.012,
    profile: t => { const r = Math.sin(Math.pow(t, 0.78) * Math.PI * 0.92) * 0.34 + 0.02; return [r, r]; },
    spine: t => [0, t * 0.72 - 0.14, 0],
  });
  b.add(env, { center: [0, 0.22, 0] });
  // かご
  b.add(loftGeometry({
    rings: 4, radial: 10, k: 3.4, minR: 0.01,
    profile: () => [0.105, 0.105],
    spine: t => [0, t * 0.15 - 0.44, 0],
  }), { center: [0, -0.37, 0], col: [0.75, 0.55, 0.32] });
  // つりひも3本
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const x0 = Math.cos(a) * 0.22, z0 = Math.sin(a) * 0.22;
    const x1 = Math.cos(a) * 0.085, z1 = Math.sin(a) * 0.085;
    b.add(tubeGeometry(t => [lerp(x0, x1, t), lerp(-0.16, -0.30, t), lerp(z0, z1, t)], 0.014, 6, 5),
          { center: [0, -0.23, 0], col: [0.45, 0.40, 0.36] });
  }
  return b.build();
}

// ---------------- 👽 宇宙人 ----------------
function buildAlienMesh() {
  const b = new PropBuilder();
  // 頭：横に広い。宇宙人らしさはこの比率で決まる。
  b.add(sphereGeometry(14, 10), {
    offset: [0, 0.16, 0], scale: [0.34, 0.30, 0.30], center: [0, 0.10, 0],
  });
  // 体：小さい
  b.add(sphereGeometry(12, 8), {
    offset: [0, -0.20, 0], scale: [0.18, 0.20, 0.16], center: [0, 0.10, 0],
  });
  // 大きい黒目（つり上がった楕円）
  for (const s of [-1, 1]) {
    const m = M4.compose([s * 0.145, 0.19, 0.235], [0, 0, s * 0.55], [1,1,1]);
    const g = sphereGeometry(12, 7);
    const pg = { pos: new Float32Array(g.pos.length), nrm: new Float32Array(g.nrm.length), uv: g.uv, idx: g.idx };
    for (let i = 0; i < g.pos.length; i += 3) {
      const x = g.pos[i]*0.115, y = g.pos[i+1]*0.062, z = g.pos[i+2]*0.055;
      pg.pos[i]   = m[0]*x + m[4]*y + m[8]*z + m[12];
      pg.pos[i+1] = m[1]*x + m[5]*y + m[9]*z + m[13];
      pg.pos[i+2] = m[2]*x + m[6]*y + m[10]*z + m[14];
      const nx = g.nrm[i]/0.115, ny = g.nrm[i+1]/0.062, nz = g.nrm[i+2]/0.055;
      const l = Math.hypot(nx, ny, nz) || 1;
      pg.nrm[i]   = (m[0]*nx + m[4]*ny + m[8]*nz)/l;
      pg.nrm[i+1] = (m[1]*nx + m[5]*ny + m[9]*nz)/l;
      pg.nrm[i+2] = (m[2]*nx + m[6]*ny + m[10]*nz)/l;
    }
    b.add(pg, { center: [0, 0.10, 0], col: [0.10, 0.10, 0.13] });
  }
  // アンテナ2本
  for (const s of [-1, 1]) {
    b.add(tubeGeometry(t => [s * (0.13 + t * 0.07), 0.36 + t * 0.19, 0], 0.017, 8, 5),
          { center: [0, 0.10, 0], col: [0.85, 0.95, 0.85] });
    b.add(sphereGeometry(8, 6), {
      offset: [s * 0.20, 0.56, 0], scale: [0.048, 0.048, 0.048],
      center: [0, 0.10, 0], col: [1.7, 2.0, 1.4],
    });
  }
  return b.build();
}

// ============================================================
//  🛰 ボイジャー1号
//   1977年に地球を出た探査機。いちばんの見せ場なので、
//   「それらしい」ではなく、見て分かる特徴をきちんと作る。
//     ・φ3.7m の白いパラボラアンテナ（これがいちばん目立つ）
//     ・金のレコード（円板。ここが光る）
//     ・RTG（黒い円筒が3つ）
//     ・磁力計ブーム（長い細い棒）
//   +X が進む向き。
// ============================================================
function buildVoyagerMesh() {
  const b = new PropBuilder();

  // --- パラボラアンテナ（おわん）---
  // 内がわと外がわを別に張って、おわんの厚みを見せる。
  const DISH_R = 0.62;
  const dishProfile = t => {
    // 中心が深く、ふちが浅い放物線
    const r = DISH_R * t;
    return r;
  };
  const dishSeg = 26, dishRing = 10;
  // ★おわんの「内がわ」と「外がわ」は、同じ形をうすくずらした2枚。
  //   形そのものを反転させると、背中あわせのおわんが2つできてしまい、
  //   カメラを向けた面が裏になって真っ黒に見える（実際に一度やった）。
  for (const side of [1, -1]) {
    const pos = [], nrm = [], idx = [];
    for (let i = 0; i <= dishRing; i++) {
      const t = i / dishRing;
      const r = dishProfile(t);
      const depth = 0.30 * (t * t);             // 放物線。ふちほど +X へ反る
      for (let j = 0; j <= dishSeg; j++) {
        const a = (j / dishSeg) * Math.PI * 2;
        const y = Math.cos(a) * r, z = Math.sin(a) * r;
        // side=+1 が内がわ（くぼみ側／-Xを向く）、-1 が外がわ（背中／+Xを向く）
        pos.push(depth * 0.5 - side * 0.014, y, z);
        const nx = -side, s = 0.6 * t;
        const l = Math.hypot(nx, y * s, z * s) || 1;
        nrm.push(nx / l, (y * s) / l, (z * s) / l);
      }
    }
    const stride = dishSeg + 1;
    for (let i = 0; i < dishRing; i++) {
      for (let j = 0; j < dishSeg; j++) {
        const a = i * stride + j, bq = a + 1, c = a + stride, d = c + 1;
        if (side > 0) idx.push(a, c, d, a, d, bq);
        else          idx.push(a, d, c, a, bq, d);
      }
    }
    const g = { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
    fixWinding(g.pos, g.nrm, g.idx);
    b.add(g, {
      // アンテナは進む向きとは逆、つまり地球のほうを向いている
      offset: [-0.06, 0, 0], center: [0, 0, 0],
      // 内がわは白く光る面、外がわは少し沈んだ白
      col: side > 0 ? [1.45, 1.45, 1.42] : [1.02, 1.02, 1.08],
    });
  }
  // アンテナのふちのリング（形をはっきりさせる）
  b.add(tubeGeometry(
    t => { const a = t * Math.PI * 2; return [0.09, Math.cos(a) * DISH_R, Math.sin(a) * DISH_R]; },
    0.028, 46, 6), { center: [0, 0, 0], col: [1.2, 1.2, 1.2] });

  // --- 給電部（アンテナの前に浮く小さな塔）---
  b.add(tubeGeometry(t => [0.09 + t * 0.30, 0, 0], 0.022, 6, 5),
        { center: [0.2, 0, 0], col: [0.8, 0.8, 0.85] });
  b.add(sphereGeometry(10, 7), {
    offset: [0.40, 0, 0], scale: [0.05, 0.05, 0.05], center: [0.40, 0, 0], col: [1.0, 1.0, 1.05],
  });

  // --- 本体（十角形の箱）---
  b.add(loftGeometry({
    rings: 3, radial: 10, k: 2.0, minR: 0.02,
    profile: () => [0.15, 0.15],
    spine: t => [0, t * 0.16 - 0.08, 0],
  }), { offset: [-0.20, 0, 0], center: [-0.20, 0, 0], col: [0.72, 0.72, 0.78], flat: true });

  // --- 金のレコード（本体の横に貼られた円板。ここが光る）---
  b.add(loftGeometry({
    rings: 2, radial: 18, k: 2.0, minR: 0.01,
    profile: () => [0.115, 0.115],
    spine: t => [0, t * 0.022, 0],
  }), {
    offset: [-0.20, 0.085, 0.02], center: [-0.20, 0.085, 0.02],
    col: [2.6, 2.0, 0.75],           // 金色。まわりより明るくして目を引く
  });

  // --- RTG（黒い円筒が3つ。斜め下へ伸びる腕の先に）---
  for (let i = 0; i < 3; i++) {
    const x = -0.34 - i * 0.17, y = -0.24 - i * 0.05, z = -0.10;
    b.add(loftGeometry({
      rings: 3, radial: 8, k: 2.0, minR: 0.01,
      profile: () => [0.055, 0.055],
      spine: t => [0, t * 0.15 - 0.075, 0],
    }), { offset: [x, y, z], center: [x, y, z], col: [0.30, 0.29, 0.33], flat: true });
  }
  b.add(tubeGeometry(t => [-0.24 - t * 0.44, -0.10 - t * 0.20, -0.02 - t * 0.08], 0.020, 8, 5),
        { center: [-0.4, -0.2, -0.05], col: [0.65, 0.64, 0.70] });

  // --- 磁力計ブーム（とても長い棒。これがあると一気に探査機に見える）---
  b.add(tubeGeometry(t => [-0.26 - t * 1.35, 0.10 + t * 0.42, 0.04], 0.014, 10, 5),
        { center: [-0.9, 0.3, 0.04], col: [0.70, 0.70, 0.76] });
  // アンテナ2本（細長い）
  for (const s of [-1, 1]) {
    b.add(tubeGeometry(t => [-0.24 - t * 0.62, -0.02 + t * 0.10, s * (0.06 + t * 0.78)], 0.012, 8, 5),
          { center: [-0.6, 0.03, s * 0.4], col: [0.70, 0.70, 0.76] });
  }
  return b.build();
}

// ---------------- 🧊 氷の小惑星（宇宙ゾーンの氷足場）----------------
// 雲の氷とちがい、こちらは「割れた氷の岩」。角を立てて、上に結晶をのせる。
// 氷の結晶。**六角柱**にすると、とたんに「氷」に見える（雪の結晶と同じ形）。
//   ただの三角のトゲだと、ガラスの破片か岩のトゲか分からなかった。
const ICE_PRISMS = [
  // [x,     z,     太さ,  高さ,  かたむき(x,z)]
  [-0.09,  0.04, 0.058, 0.52, [ 0.10, -0.06]],
  [ 0.15, -0.06, 0.045, 0.41, [-0.14,  0.22]],
  [-0.01,  0.14, 0.036, 0.31, [ 0.26,  0.10]],
  [-0.30, -0.03, 0.032, 0.26, [-0.05, -0.34]],
  [ 0.34,  0.09, 0.029, 0.23, [ 0.30,  0.16]],
  [ 0.02, -0.15, 0.025, 0.18, [-0.22, -0.12]],
];

function buildRockIceMesh() {
  const b = new PropBuilder();
  // ★粗くしすぎると「割れたガラスの破片」に見えて、乗れる足場に見えなかった。
  //   土台はほどよい粗さで**かたまり**に、とがりは柱で出す。
  const s = sphereGeometry(8, 6);
  for (const [x, y, z, r, sq, rot] of ASTEROID_CHUNKS) {
    b.add(s, {
      offset: [x, y, z], scale: [r * 0.98, r * sq, r * 0.90], rot,
      center: [0, 0, 0], displace: rockBump, flat: true,
      colFn: (px, py) => { const k = clamp((py + 0.22) / 0.46, 0, 1);
        return [0.78 + k * 0.44, 0.86 + k * 0.42, 0.98 + k * 0.36]; },
    });
  }
  // 六角柱＋先っぽのとがり。まっすぐな胴があるから「柱」に見える。
  const prism = loftGeometry({
    rings: 5, radial: 6, k: 1.0, minR: 0.004,
    profile: t => {
      // t 0〜0.62 はまっすぐ、そこから先をとがらせる
      const r = t < 0.62 ? 1.0 : 1.0 - (t - 0.62) / 0.38;
      return [Math.max(r, 0.02), Math.max(r, 0.02)];
    },
    spine: t => [0, t, 0],
  });
  for (const [x, z, w, h, tilt] of ICE_PRISMS) {
    b.add(prism, {
      // 根もとだけ氷へ埋め、胴はしっかり出す。埋めすぎると ただの白い岩になった。
      offset: [x, 0.02, z], scale: [w, h, w], rot: [tilt[0], 0, tilt[1]],
      center: [x, 0.02 + h * 0.4, z], flat: true,
      // 根もとは青く、先は白く光らせる（氷の透けた感じ）
      colFn: (px, py) => { const k = clamp(py / 0.50, 0, 1);
        return [0.92 + k * 0.48, 1.02 + k * 0.40, 1.34 + k * 0.24]; },
    });
  }
  return b.build();
}

function buildRockBreakMesh() {
  const b = new PropBuilder();
  const s = sphereGeometry(6, 4);
  const spread = 1.22;                 // 外へ広げて、すきまを見せる
  for (const [x, y, z, r, sq, rot] of ASTEROID_CHUNKS) {
    b.add(s, {
      offset: [x * spread, y * spread, z * spread],
      scale: [r * 0.82, r * sq * 0.86, r * 0.78], rot,
      center: [0, 0, 0], displace: rockBump, flat: true,
      colFn: (px, py) => { const k = clamp((py + 0.22) / 0.46, 0, 1);
        return [0.58 + k * 0.34, 0.56 + k * 0.32, 0.60 + k * 0.34]; },
    });
  }
  // ★ひび。すきまを広げるだけでは、遠目に「ただの岩」と見分けがつかなかった。
  //   割れ目に暗いくさびを差しこむと、離れていても「これは割れる」と分かる。
  const cube = cubeGeometry();
  const CRACKS = [
    // [x,     y,     z,    長さ,  厚み,  向き]
    [ 0.10,  0.02,  0.02, 0.72, 0.030, [0.0,  0.35, 0.10]],
    [-0.05,  0.04, -0.02, 0.60, 0.026, [0.0, -0.95, 0.18]],
    [ 0.02,  0.05,  0.06, 0.44, 0.022, [0.0,  1.55, -0.12]],
  ];
  for (const [x, y, z, len, th, rot] of CRACKS) {
    b.add(cube, {
      offset: [x, y, z], scale: [len, th * 2.6, th], rot,
      center: [0, -0.6, 0], col: [0.20, 0.18, 0.24],
    });
  }
  return b.build();
}
