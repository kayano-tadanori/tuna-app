'use strict';
/* 🔄🧺 どの角から2回半分に折った紙でも、つる③の袋折り（2026-09-14）。
   新しい紙（表／裏返す v・h）→ 2回対角に半分折り（1回目の角4通り × 2回目の角2通り・画面と同じ吸着の手順）→ 袋を選ぶ → 確定。
   ★対応：G·(いまの紙) ＝ 検証ずみの状態② ∘ D（D 素材の対称・G 平面の対称・高さはそのまま）。運動は「Gᵀ ∘ 検証ずみの運動 ∘ D」。
   ⚠前は G を恒等に固定していて、検査と違う角から折ると候補0件だった（本人の実機で発覚）。
     独立検証は check_squash_flip.py（Python の再生器と素材の座標で組み直した骨の木）。
   見ること：候補・途中表示・確定形の表裏・層・共有境界／原本の flip と fold の kind は書きかえない／
            保存→再読込・undo/redo／表から始める経路は変えない／対応が1通りに決まらなければ断る（合成入力）。
   ⛔ 厚みは0。紙どうしの貫通は未検証。
   使い方： node test_squash_flip.js            （--write で squash_flip_states.json を書く＝Python の突き合わせ用）
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const src = f => fs.readFileSync(path.join(DIR, f), 'utf8');
function load() {
 const ctx = { console }; ctx.globalThis = ctx; vm.createContext(ctx);
 for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js']) vm.runInContext(src(f), ctx);
 ctx.SquashV2.useV1Validator(ctx.OrigamiRecipe.validate, JSON.parse(src('origami_recipe.schema.json')));
 return ctx;
}
const X = load(), E = X.FreeFoldEngine, N = X.FreeFoldSnap, V2 = X.SquashV2, M = X.SquashModel;
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
/* vm の別の realm の配列は deepStrictEqual で型が合わない＝JSON で比べる */
const sameJ = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m), diffJ = (a, b, m) => assert.notEqual(JSON.stringify(a), JSON.stringify(b), m);
const V = { toScreen: p => [p[0] * 240, -p[1] * 240] }, S = p => V.toScreen(p);
const C = x => JSON.parse(JSON.stringify(x));
const det = xf => xf[0] * xf[3] - xf[1] * xf[2];
const ap = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const key = ps => JSON.stringify(ps.map(p => p.map(v => Math.round(v * 1e6) / 1e6 + 0)).sort());

/* 画面と同じ2回の半分折り（test_half_fold.js と同じ吸着の手順）。1回目は角 c1→向かいの角、2回目は鋭角 c2→もう一方の鋭角・上から2枚。 */
function tsuru2(axis, c1 = [-1, -1], c2 = [-1, 1]) {
 const t = E.create(); if (axis) E.flip(t, axis);
 let g = N.grab(t, S(c1), V), cr = N.creaseForCorners(t, g.point, [-c1[0], -c1[1]]);
 E.proposeOnFace(t, cr.line[0], cr.line[1], cr.faceId, { layers: 1 }); E.setSide(t, cr.sidePoint); E.select(t, t.pending.candidates); E.confirm(t);
 g = N.grab(t, S(c2), V);
 const to = S([-c2[0], -c2[1]]), s = N.foldTarget(t, g, [to[0] - 10 * Math.sign(-c2[0]), to[1] - 6 * Math.sign(c2[1])], [0, 0], V, false);
 assert.equal(s.snapKind, 'diagonal', '2回目で相手の角に吸いつかない（半分折りの吸着が壊れた）');
 const c = N.creaseForCorners(t, g.point, s.target);
 E.proposeOnFace(t, c.line[0], c.line[1], c.faceId, { layers: 1 }); E.setSide(t, c.sidePoint); E.setLayers(t, 2, c.sidePoint);
 E.select(t, t.pending.candidates); E.confirm(t);
 return t;
}
/* 素材の区間 s（光線 s と s+1 のあいだ）を含む面 */
const sectorCenter = s => { const a = M.RAY[s], b = M.RAY[(s + 1) % 8]; return [(a[0] + b[0]) / 3, (a[1] + b[1]) / 3] };
const inv = (xf, p) => { const d = det(xf), x = p[0] - xf[4], y = p[1] - xf[5]; return [(xf[3] * x - xf[1] * y) / d, (-xf[2] * x + xf[0] * y) / d] };
const faceOfSector = (faces, s) => faces.find(f => V2.pointIn(f.poly.map(p => inv(f.xf, p)), sectorCenter(s)));

const WANT_D = { v: [-1, 0, 0, 1], h: [1, 0, 0, -1] };
const lin = (A, p) => [A[0] * p[0] + A[1] * p[1], A[2] * p[0] + A[3] * p[1]];
const detM = A => A[0] * A[3] - A[1] * A[2];
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const FRONT = '表 1回目[-1, -1] 2回目[-1, 1]';
const nm = (axis, c1, c2) => (axis ? '裏返し' + axis : '表') + ` 1回目[${c1.join(', ')}] 2回目[${c2.join(', ')}]`;
/* 表と裏返し v は角の選び方ぜんぶ（4×2）、裏返し h は検査の経路1本（check_squash_flip.py と同じ一覧） */
const PATHS = [];
for (const axis of [null, 'v']) for (const c1 of CORNERS) for (const c2 of [[-c1[1], c1[0]], [c1[1], -c1[0]]]) PATHS.push({ axis, c1, c2, label: nm(axis, c1, c2) });
PATHS.push({ axis: 'h', c1: [-1, -1], c2: [-1, 1], label: nm('h', [-1, -1], [-1, 1]) });
const DEPTH_Q = 2 / 0.25 / 2 ** 24;
const cases = {};

/* ================= 0 表の経路（比べる相手） ================= */
{
 const t = tsuru2(null), pre = C(t.recipe.steps);
 E.proposeSquash(t); const pv = E.squashPreview(t); E.confirm(t);
 const d = E.replayDetail(t.recipe);
 sameJ([d.squash.frame.D, d.squash.frame.G], [[1, 0, 0, 1], [1, 0, 0, 1]], '0 表から作ったつる②（検査の経路）の D・G が恒等でない');
 sameJ(t.recipe.steps.slice(0, 2), pre, '0 表の経路で原本の前の手が変わった');
 cases.front = { t, d, pv };
 cases[FRONT] = cases.front;
 ok('表から（検査の経路）：D・G は恒等（従来どおり）');
}

for (const { axis, c1, c2, label } of PATHS) {
 if (label === FRONT) continue;
 const lab = label, original = c1.join() === '-1,-1' && c2.join() === '-1,1';
 /* ================= 1 候補：「袋を選ぶ」が出る。原本・revision・hash は動かない ================= */
 const t = tsuru2(axis, c1, c2);
 const beforeSteps = C(t.recipe.steps), h0 = t.cache.hash, rev0 = t.revision;
 sameJ(beforeSteps.map(s => s.op), (axis ? ['flip'] : []).concat(['fold', 'fold']), '1' + lab + ' 手が（flip→）fold→fold でない');
 sameJ(beforeSteps.filter(s => s.op === 'fold').map(s => s.kind), ['V', 'V'], '1' + lab + ' fold の kind が谷折り2回でない');
 const opt = E.squashOptions(t);
 assert.equal(opt.options.length, 1, '1' + lab + ' 袋が候補に出ない: ' + opt.reason);
 const pocketFaces = opt.options[0].faceIds.slice().sort();
 const front = cases.front;
 E.proposeSquash(t, opt.options[0].pocketId);
 sameJ([t.recipe.version, t.revision, t.cache.hash], [1, rev0, h0], '1' + lab + ' 候補を作っただけで正式状態が変わった');
 const step = t.pending.step;
 const pv = E.squashPreview(t), d = E.replayDetail((() => { const r = C(t.recipe); r.version = 2; r.steps.push(C(step)); return r })()), out = d.squash;
 /* 基準面＝検証ずみの P0 が来る面／軸の役割＝D で写したモデルの光線の役割（素材の番号で書く） */
 const fr = V2.makeFrame(out.frame.D, out.frame.G), G = out.frame.G, Gt = out.frame.Gt, sgn = detM(G) * detM(out.frame.D);
 sameJ(step.axes.map(a => a.role), fr.modelOfRay.map(i => V2.roleOf(i)), '1' + lab + ' 軸の役割が D で写したモデルの役割と違う');
 if (original) { /* 検査の経路（1回目 (-1,-1)・2回目 (-1,1)）＝前回の対応そのもの：D は裏返しの軸の鏡映、G は恒等 */
  sameJ([out.frame.D, G], [WANT_D[axis], [1, 0, 0, 1]], '1' + lab + ' 検査の経路の D・G が前回の対応と違う');
  diffJ(step.axes.map(a => a.role), front.d.squash.recipe.steps[2].axes.map(a => a.role), '1' + lab + ' 軸の役割が表と同じ（D を通していない）');
 } else {
  /* 前回までの照合（G を恒等に固定）では断られていた経路か＝候補0件の原因の再現 */
  const was = (detM(G) !== 1 || G[0] !== 1);
  assert.equal(was, true, '1' + lab + ' G が恒等なのに、検査の経路でない（前回も通っていたはず）');
 }
 assert.equal(step.base.faceId, faceOfSector(t.cache.faces, fr.sectorOfModel[0]).faceId, '1' + lab + ' 基準面がモデルの P0 に来る面でない');
 assert.equal(t.cache.faces.find(f => f.faceId === step.base.faceId).layer + 0, 0, '1' + lab + ' 基準面がいちばん下の面でない');
 sameJ(step.branch, { linkage: 'tan-half-product-sqrt2', sign: 1, drive: { fromDeg: 0, toDeg: 180 } }, '1' + lab + ' 枝がモデルの座標の検証ずみの値でない');
 ok(lab + '：候補＝袋1つ（D=' + out.frame.D + ' G=' + G + '）。役割・基準面は D で写したモデルのもの。正式状態は不変');

 /* ================= 2 途中表示：共有境界は離れない／表裏は両端の engine の面と同じ／Gᵀ∘検証ずみの運動∘D ================= */
 let worstShare = 0, worstModel = 0;
 for (let k = 0; k <= 100; k++) {
  const tt = k / 100, P = pv.positions(tt), F = V2.frames(out, tt), pl = M.panels(tt);
  /* 位置は描画へ渡す配列（positions）と frames が同じ */
  pv.drawOrder.forEach((s, i) => F[s].tri.forEach((v, j) => v.forEach((c, q) => assert.equal(Math.abs(P[i * 9 + j * 3 + q] - c) < 1e-6, true, '2 positions と frames（描く順で並べたもの）が違う'))));
  /* 共有境界：素材の区間 s の「光線 s+1 の端」と、区間 s+1 の「光線 s+1 の端」は同じ点（輪を閉じる1本も含めて8本） */
  for (let s = 0; s < 8; s++) {
   const a = F[s].tri[2], b = F[(s + 1) % 8].tri[1];
   worstShare = Math.max(worstShare, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  /* 検証ずみの運動 ∘ D：素材の光線 k の端は、モデルの光線 D·k の端にいる */
  for (let s = 0; s < 8; s++) {
   const i = out.frame.modelOfSector[s];
   for (const [j, k] of [[1, s], [2, (s + 1) % 8]]) {
    const mk = out.frame.modelOfRay[k], m3 = mk === i ? pl[i][1] : pl[i][2], mv = [...lin(Gt, m3), m3[2]];
    worstModel = Math.max(worstModel, Math.hypot(...F[s].tri[j].map((c, q) => c - mv[q])));
   }
  }
 }
 assert.equal(worstShare < 1e-12, true, '2' + lab + ' 途中で共有境界が離れる: ' + worstShare);
 assert.equal(worstModel < 1e-12, true, '2' + lab + ' 途中の位置が Gᵀ∘検証ずみの運動∘D と違う: ' + worstModel);
 /* 表裏：三角形の巻き順（gl_FrontFacing が見るもの）の向きが、t≈0 は候補前の面、t≈1 は確定形の面の xf の行列式と同じ */
 const facing = (tt, s) => { const T = V2.frames(out, tt)[s].tri, u = T[1].map((c, q) => c - T[0][q]), w = T[2].map((c, q) => c - T[0][q]);
  return Math.sign(u[0] * w[1] - u[1] * w[0]) };
 for (let s = 0; s < 8; s++) {
  assert.equal(facing(0.001, s), Math.sign(det(faceOfSector(pv.before, s).xf)), `2${lab} t=0.001 の区間 ${s} の表裏が候補前の面と違う`);
  assert.equal(facing(0.999, s), Math.sign(det(faceOfSector(pv.after, s).xf)), `2${lab} t=0.999 の区間 ${s} の表裏が確定形の面と違う`);
 }
 /* 描画（depth は LESS・24bit）をまねる：描く順に、いちばん高い面が勝つ（depth の分解能より近ければ同着＝先に描いた面）。
    分解能：freefold3d.html の pocketMVP は奥行きを k=0.25 で NDC へ写す＝世界の幅 8 を 2^24 段 → 1段 ≈ 4.8e-7。
    t=0.001／0.999 で、勝った三角形の表裏が engine の層のいちばん上の面の表裏と同じか（紙の上の格子 21×21）。 */
 const topFace = (faces, q) => faces.filter(f => V2.pointIn(f.poly, q, 1e-9)).sort((x, y) => y.layer - x.layer)[0];
 const bary = (T, q) => { const [[x1, y1], [x2, y2], [x3, y3]] = T, D = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  const u = ((y2 - y3) * (q[0] - x3) + (x3 - x2) * (q[1] - y3)) / D, v = ((y3 - y1) * (q[0] - x3) + (x1 - x3) * (q[1] - y3)) / D; return [u, v, 1 - u - v] };
 let probes = 0;
 for (const [tt, faces] of [[0.001, pv.before], [0.999, pv.after]]) {
  const P = pv.positions(tt);
  for (let gx = 0; gx <= 20; gx++) for (let gy = 0; gy <= 20; gy++) {
   const q = [-1 + gx * .1 + .013, -1 + gy * .1 + .007], top = topFace(faces, q);
   if (!top) continue;
   let win = null, wz = -Infinity;
   for (let i = 0; i < 8; i++) {
    const T = [0, 1, 2].map(j => [P[i * 9 + j * 3], P[i * 9 + j * 3 + 1], P[i * 9 + j * 3 + 2]]), w = bary(T, q);
    if (w.some(v => v < 1e-6)) continue;                       /* 三角形のふちちょうどは避ける */
    const z = Math.round((w[0] * T[0][2] + w[1] * T[1][2] + w[2] * T[2][2]) / DEPTH_Q);
    if (z > wz) { wz = z; win = T }
   }
   if (!win) continue;
   const face = Math.sign((win[1][0] - win[0][0]) * (win[2][1] - win[0][1]) - (win[1][1] - win[0][1]) * (win[2][0] - win[0][0]));
   assert.equal(face, Math.sign(det(top.xf)), `2${lab} t=${tt} の [${q.map(v => v.toFixed(3))}] で、描いた一番上の表裏が engine の層（${top.faceId}）と違う`);
   probes++;
  }
 }
 assert.equal(probes > 150, true, '2' + lab + ' 描画の見え方の比較点が少なすぎる: ' + probes);
 /* 両端の位置：t=0 はいまの紙、t=1 は確定形 */
 for (const [tt, faces] of [[0, pv.before], [1, pv.after]]) {
  const F = V2.frames(out, tt);
  for (let s = 0; s < 8; s++) {
   const f = faceOfSector(faces, s), want = [[0, 0], M.RAY[s], M.RAY[(s + 1) % 8]].map(p => ap(f.xf, p));
   F[s].tri.forEach((v, j) => assert.equal(Math.hypot(v[0] - want[j][0], v[1] - want[j][1]) < 1e-9 && Math.abs(v[2]) < 1e-9, true, `2${lab} t=${tt} の区間 ${s} が engine の面と違う`));
  }
 }
 ok(lab + '：途中101コマ 共有境界8本のずれ ' + worstShare.toExponential(1) + '・Gᵀ∘検証ずみの運動∘D との差 ' + worstModel.toExponential(1) + '／両端の位置と表裏が engine の面と一致／描く順（同着は上の層から）で t≈0,1 の見え方が engine の層と一致（' + probes + '点）');

 /* ================= 3 確定：原本の flip と fold の kind は書きかえない。表裏・層・結びは表の場合と対応する ================= */
 const rev = t.revision;
 E.confirm(t);
 sameJ([t.recipe.version, t.revision, t.recipe.steps.map(s => s.op)], [2, rev + 1, beforeSteps.map(s => s.op).concat(['squash'])], '3' + lab + ' 確定で v2 の1手にならない');
 sameJ(t.recipe.steps.slice(0, beforeSteps.length), beforeSteps, '3' + lab + ' 確定で flip／fold（kind・線・対象）が書きかわった');
 const fin = t.cache.faces, fF = front.t.cache.faces, fo = front.d.squash;
 for (let s = 0; s < 8; s++) {
  const i = out.frame.modelOfSector[s], a = faceOfSector(fin, s), b = faceOfSector(fF, i);
  /* 置かれ方：表の区間 i の三角形を Gᵀ で写した所 */
  const tri = f => [[0, 0], M.RAY[f === a ? s : i], M.RAY[((f === a ? s : i) + 1) % 8]].map(p => ap(f.xf, p));
  assert.equal(key(tri(a)), key(tri(b).map(p => lin(Gt, p))), `3${lab} 区間 ${s} の確定形の置かれ方が、表の区間 ${i} を Gᵀ で写した所と違う`);
  /* 表裏：det(G)·det(D) × 表（check_squash_flip.py の素材の FK と同じ関係） */
  assert.equal(Math.sign(det(a.xf)), sgn * Math.sign(det(b.xf)), `3${lab} 区間 ${s} の表裏が det(G)·det(D)×表 でない`);
  /* 層：同じ高さ（同じ物理の紙） */
  assert.equal(a.layer + 0, b.layer + 0, `3${lab} 区間 ${s} の層が表の区間 ${i} と違う`);
 }
 /* 重なりの領域：面の名前を区間で読みかえると、表と同じ上下 */
 const secsOf = (o, id) => o.faces.find(f => f.faceId === id).sectors.map(s => (o.frame ? o.frame.modelOfSector[s] : s)).sort().join('+');
 const regs = o => o.regions.map(r => r.order.map(id => secsOf(o, id)).join('<')).sort();
 sameJ(regs(out), regs(fo), '3' + lab + ' 重なりの領域の上下が、区間で読みかえた表と違う');
 /* 結び：両側の面の xf が、素材の共有区間を同じ所へ写す（離れない）。kind は表と同じ並び */
 let worstBond = 0;
 for (const b of t.cache.bonds) {
  const [f, g] = b.faceIds.map(id => fin.find(x => x.faceId === id));
  for (const p of b.seg) { const u = ap(f.xf, p), w = ap(g.xf, p); worstBond = Math.max(worstBond, Math.hypot(u[0] - w[0], u[1] - w[1])) }
 }
 assert.equal(worstBond < 1e-12, true, '3' + lab + ' 確定形で結びの両側が離れる: ' + worstBond);
 const kinds = o => o.bonds.map(b => { const far = b.seg.find(p => Math.hypot(p[0], p[1]) > .5); return (o.frame ? o.frame.modelOfRay[M.RAY.findIndex(r => Math.abs(r[0] - far[0]) < 1e-9 && Math.abs(r[1] - far[1]) < 1e-9)] : 0) + ':' + b.kind }).sort();
 sameJ(kinds(out), kinds(fo), '3' + lab + ' 開いた折り目／背（crease/hinge）が、光線で読みかえた表と違う');
 sameJ(t.cache.faces.filter(f => out.faces.find(g => g.faceId === f.faceId).moving).map(f => out.faces.find(g => g.faceId === f.faceId).sectors.map(s => out.frame.modelOfSector[s]).join()).sort(),
  fo.faces.filter(f => f.moving).map(f => f.sectors.join()).sort(), '3' + lab + ' 動く面が表と対応しない');
 ok(lab + '：確定＝flip/fold は不変。置かれ方（Gᵀ）・層・領域の上下・結び（ずれ ' + worstBond.toExponential(1) + '）は表と対応、表裏は det(G)·det(D)=' + sgn + ' 倍');

 /* ================= 4 保存 → 再読込・undo/redo ================= */
 const saved = JSON.stringify(t.recipe), hash = t.cache.hash;
 const fresh = load(), re = fresh.FreeFoldEngine.replay(JSON.parse(saved));
 assert.equal(re.hash, hash, '4' + lab + ' 保存した原本を別の読み手で再生すると紙が違う');
 assert.equal(fresh.SquashV2.validate(JSON.parse(saved)), true, '4' + lab + ' 保存した原本が v2 の検査を通らない');
 E.undo(t);
 sameJ([t.recipe.version, t.recipe.steps.length, t.cache.hash], [2, beforeSteps.length, h0], '4' + lab + ' undo 1回で袋折りだけ外れない');
 assert.equal(E.squashOptions(t).options.length, 1, '4' + lab + ' undo 後に袋が候補に戻らない');
 E.redo(t);
 assert.equal(t.cache.hash, hash, '4' + lab + ' redo で袋折りに戻らない');
 ok(lab + '：保存→別の読み手で再読込（hash 一致）・undo で袋折りだけ外れる・redo で戻る');
 cases[label] = { t, d, out };
}

/* ================= 5 断る：対応が1通りに決まらないとき（合成入力）／層が違うとき ================= */
{
 /* 自然な手順では2通り以上は起きない（層の並びが D ごとに違う）。検証ずみの層を全部同着にした合成モデルで直接鳴らす。 */
 const Y = load(); Y.SquashModel.LAYER_START.fill(0);
 const faces = C(E.replay({ ...C(cases.front.t.recipe), version: 1, steps: C(cases.front.t.recipe.steps.slice(0, 2)) }).faces);
 faces.forEach(f => { f.layer = 0 });
 const cache = { ...C(cases.front.d.squash.before), faces };
 const rec = Y.SquashV2.reconstruct(cache, [0, 0]);
 assert.throws(() => Y.SquashV2.checkApplicable(cache, rec, [0, 0]), /1通りに決まりません（\d+通り）/, '5 対応が複数あるのに受理した');
 /* 裏返し経路の層を1か所入れかえると、どの (D, G) でも合わない */
 const u = tsuru2('v'), c2 = C(u.cache), top = c2.faces.find(f => f.layer === 3), under = c2.faces.find(f => f.layer === 2);
 top.layer = 2; under.layer = 3;
 const r2 = V2.reconstruct(c2, [0, 0]);
 assert.throws(() => V2.checkApplicable(c2, r2, [0, 0]), /検証ずみの層（LAYER_START）と違います.*裏返し・回転を含むどの読みかえでも合いません/, '5 層を入れかえた裏返しの紙を受理した');
 ok('断る：層を全部同着にした合成モデル→姿が合う読みかえが複数残り「1通りに決まらない」／裏返しの紙の層を入れかえる→どの (D, G) でも合わない');
}

if (process.argv.includes('--write')) {
 const dump = (label, o, faces) => ({ label, D: o.frame.D, G: o.frame.G,
  faces: faces.map(f => ({ faceId: f.faceId, xf: f.xf, poly: f.poly, layer: f.layer })),
  regions: (o ? o.regions : []).map(r => { const ps = r.faces.map(id => faces.find(f => f.faceId === id).poly), q = V2.intersect(ps);
   return { order: r.order, probe: [q.reduce((a, p) => a + p[0], 0) / q.length, q.reduce((a, p) => a + p[1], 0) / q.length] } }) });
 const data = { note: 'node test_squash_flip.js --write が書く。check_squash_flip.py が素材の FK と突き合わせる。厚み0・非貫通は未検証。',
  cases: PATHS.map(({ label }) => dump(label, cases[label].d.squash, cases[label].t.cache.faces)) };
 fs.writeFileSync(path.join(DIR, 'squash_flip_states.json'), JSON.stringify(data, null, 1));
 console.log('  wrote squash_flip_states.json');
}
console.log('');
console.log('ALL OK（' + n + '項目）');
