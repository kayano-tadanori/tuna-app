// ============================================================
// オットンの3Dモデル（Tripo出力）を、アプリに載せられる大きさまで削る。
//
//   もとの素材:  素材/オットン　リギング済.glb   … 97万ポリ・41MB
//   書き出し先:  models/otton.glb                … 2.5万ポリ・1MB弱
//
// ★Tripoの生データは頂点がつながっていない所が多く、ふつうに削ると
//   11万ポリで頭打ちになる。meshoptの 'Permissive' フラグを付けると
//   そこを越えて削れる（2026-08-23に実測して分かった）。
//
// 使い方（依存は npm i meshoptimizer sharp）:
//   node scripts/build_otton3d.js <入力glb> <出力glb> [ポリ数] [テクスチャpx] [画質] [差し替えテクスチャ]
// ============================================================

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { MeshoptSimplifier } = require('meshoptimizer');

const SRC = process.argv[2] || path.join(__dirname, '..', '素材', 'オットン　リギング済.glb');
const OUT = process.argv[3] || path.join(__dirname, '..', 'models', 'otton.glb');
const TARGET_TRIS = parseInt(process.argv[4] || '25000', 10);
const TEX_SIZE = parseInt(process.argv[5] || '1024', 10);
const TEX_QUALITY = parseInt(process.argv[6] || '86', 10);
const TEX_OVERRIDE = process.argv[7] || null;   // ハチマキを直したテクスチャを差し込む用
// UVの重み。小さいとテクスチャが継ぎ目で割れる（0.2で316枚→10で0枚。2026-08-23実測）
const UV_WEIGHT = parseFloat(process.argv[8] || '10');

// ---------- GLBを読む ----------
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
const TA = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5122: Int16Array, 5121: Uint8Array, 5120: Int8Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
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
  const hasSkin = pr.attributes.JOINTS_0 != null;
  const jnt = hasSkin ? acc(g, pr.attributes.JOINTS_0) : null;
  const wgt = hasSkin ? acc(g, pr.attributes.WEIGHTS_0) : null;
  let idx = acc(g, pr.indices);
  if (!(idx instanceof Uint32Array)) idx = new Uint32Array(idx);
  console.log(`もと: ${idx.length / 3} 三角形 / ${pos.length / 3} 頂点 / ボーン${hasSkin ? g.json.skins[0].joints.length : 0}本`);

  // ---------- 削る ----------
  await MeshoptSimplifier.ready;
  const [sidx, err] = MeshoptSimplifier.simplifyWithAttributes(
    idx, pos, 3, uv, 2, [UV_WEIGHT, UV_WEIGHT], null, TARGET_TRIS * 3, 1.0, ['Prune', 'Permissive']);
  console.log(`削減: -> ${sidx.length / 3} 三角形（誤差 ${(err * 100).toFixed(3)}%）`);

  // 生き残った頂点だけ詰め直す
  const map = new Int32Array(pos.length / 3).fill(-1);
  let nv = 0;
  for (let i = 0; i < sidx.length; i++) if (map[sidx[i]] < 0) map[sidx[i]] = nv++;
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), T2 = new Float32Array(nv * 2);
  const J = hasSkin ? new Uint8Array(nv * 4) : null;
  const W = hasSkin ? new Uint8Array(nv * 4) : null;   // 0-255 の正規化で持つ（floatの1/4）
  for (let o = 0; o < map.length; o++) {
    const n = map[o];
    if (n < 0) continue;
    for (let k = 0; k < 3; k++) { P[n * 3 + k] = pos[o * 3 + k]; N[n * 3 + k] = nrm[o * 3 + k]; }
    T2[n * 2] = uv[o * 2]; T2[n * 2 + 1] = uv[o * 2 + 1];
    if (!hasSkin) continue;
    // 重みを255段階に丸める。合計がちょうど255になるように最大の骨で調整する
    let sum = 0, best = 0, bestW = -1;
    const w = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      w[k] = Math.round(wgt[o * 4 + k] * 255);
      sum += w[k];
      if (wgt[o * 4 + k] > bestW) { bestW = wgt[o * 4 + k]; best = k; }
    }
    w[best] += 255 - sum;
    if (w[best] < 0) w[best] = 0;
    for (let k = 0; k < 4; k++) { J[n * 4 + k] = jnt[o * 4 + k]; W[n * 4 + k] = w[k]; }
  }
  const I = nv <= 65535 ? new Uint16Array(sidx.length) : new Uint32Array(sidx.length);
  for (let i = 0; i < sidx.length; i++) I[i] = map[sidx[i]];
  console.log(`頂点: ${pos.length / 3} -> ${nv}（索引 ${I.BYTES_PER_ELEMENT * 8}bit）`);

  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) {
    const v = P[i * 3 + k];
    if (v < mn[k]) mn[k] = v;
    if (v > mx[k]) mx[k] = v;
  }
  console.log('大きさ:', mn.map(v => v.toFixed(3)).join(','), '〜', mx.map(v => v.toFixed(3)).join(','));

  // ---------- テクスチャ（basecolorだけ。法線と金属粗さは自作シェーダーで使わない） ----------
  const baseIdx = g.json.materials[0].pbrMetallicRoughness.baseColorTexture.index;
  const imgIdx = g.json.textures[baseIdx].source;
  const ibv = g.json.bufferViews[g.json.images[imgIdx].bufferView];
  const rawTex = TEX_OVERRIDE
    ? fs.readFileSync(TEX_OVERRIDE)
    : g.bin.slice(ibv.byteOffset || 0, (ibv.byteOffset || 0) + ibv.byteLength);
  const tex = await sharp(rawTex).resize(TEX_SIZE, TEX_SIZE, { fit: 'fill' })
    .jpeg({ quality: TEX_QUALITY, mozjpeg: true }).toBuffer();
  console.log(`テクスチャ: ${TEX_SIZE}px q${TEX_QUALITY} -> ${(tex.length / 1024).toFixed(0)}KB`);

  // ---------- 骨（そのまま持っていく。アニメはアプリ側でコードから付ける） ----------
  let skin = null, nodes = null;
  if (hasSkin) {
    const s = g.json.skins[0];
    const ibm = acc(g, s.inverseBindMatrices);
    // 使う骨だけの小さな配列に詰め替える（親子は元のnodeで辿る）
    const keep = new Map();     // 元node番号 -> 新番号
    const order = [];
    const walk = ni => {
      if (keep.has(ni)) return;
      keep.set(ni, order.length);
      order.push(ni);
      (g.json.nodes[ni].children || []).forEach(walk);
    };
    // ルート（skinのjointsのうち、他のjointの子でないもの）から辿る
    const isChild = new Set();
    g.json.nodes.forEach(n => (n.children || []).forEach(c => isChild.add(c)));
    s.joints.forEach(j => { if (!isChild.has(j)) walk(j); });
    s.joints.forEach(j => walk(j));
    nodes = order.map(ni => {
      const n = g.json.nodes[ni];
      const o = { name: n.name || ('bone' + ni) };
      if (n.translation) o.translation = n.translation;
      if (n.rotation) o.rotation = n.rotation;
      if (n.scale) o.scale = n.scale;
      if (n.children) o.children = n.children.filter(c => keep.has(c)).map(c => keep.get(c));
      return o;
    });
    skin = { joints: s.joints.map(j => keep.get(j)), ibm: Array.from(ibm) };
    console.log(`骨: ${skin.joints.length}本（ノード${nodes.length}）`);
  }

  // ---------- GLB書き出し ----------
  const pad4 = n => (n + 3) & ~3;
  const parts = [], views = [], accs = [];
  let boff = 0;
  const push = (b, target) => {
    parts.push(b);
    const p = pad4(b.length) - b.length;
    if (p) parts.push(Buffer.alloc(p));
    views.push({ buffer: 0, byteOffset: boff, byteLength: b.length, ...(target ? { target } : {}) });
    boff += b.length + p;
    return views.length - 1;
  };
  const B = ta => Buffer.from(ta.buffer, ta.byteOffset, ta.byteLength);
  const attributes = {};
  const addAcc = (v, comp, count, type, extra) => {
    accs.push({ bufferView: v, componentType: comp, count, type, ...(extra || {}) });
    return accs.length - 1;
  };
  attributes.POSITION = addAcc(push(B(P), 34962), 5126, nv, 'VEC3', { min: mn, max: mx });
  attributes.NORMAL = addAcc(push(B(N), 34962), 5126, nv, 'VEC3');
  attributes.TEXCOORD_0 = addAcc(push(B(T2), 34962), 5126, nv, 'VEC2');
  if (hasSkin) {
    attributes.JOINTS_0 = addAcc(push(B(J), 34962), 5121, nv, 'VEC4');
    attributes.WEIGHTS_0 = addAcc(push(B(W), 34962), 5121, nv, 'VEC4', { normalized: true });
  }
  const iAcc = addAcc(push(B(I), 34963), I.BYTES_PER_ELEMENT === 2 ? 5123 : 5125, I.length, 'SCALAR');
  const vTex = push(tex);

  const json = {
    asset: { version: '2.0', generator: 'oton-gakuen slim (Tripo source)' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'otton' }],
    meshes: [{ name: 'otton', primitives: [{ attributes, indices: iAcc, material: 0 }] }],
    materials: [{ name: 'otton', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.8 } }],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [{ mimeType: 'image/jpeg', bufferView: vTex, name: 'otton_basecolor' }],
    accessors: accs,
    bufferViews: views,
    buffers: [{ byteLength: boff }],
  };
  // 骨はglTF標準のskinではなく、読み手が楽なように extras に平たく入れる
  if (skin) json.extras = { skeleton: { nodes, joints: skin.joints, ibm: skin.ibm } };

  const bin = Buffer.concat(parts);
  let jb = Buffer.from(JSON.stringify(json), 'utf8');
  if (jb.length % 4) jb = Buffer.concat([jb, Buffer.alloc(4 - jb.length % 4, 0x20)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + jb.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jb.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.concat([head, jh, jb, bh, bin]));
  console.log(`==> ${OUT}  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
})();
