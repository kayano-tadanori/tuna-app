'use strict';
/* 🌸 花弁折り（つる⑧⑨・1回目）の組込み：engine の道（候補→プレビュー→確定→保存・再読込→undo/redo）と、再生の門（2026-09-15）。
   ★見ること
     A 代表例：画面と同じ道で ①〜⑦ → 花弁の候補1つ → proposePetal は正式状態を動かさない → プレビューの座標
       （t=0 はいまの面・t=1 は確定後の面・途中は辺長が保たれる・描画に渡す配列＝面ごとの座標を描く順に並べたもの・表裏の巻き順）
       → 確定（v2・1手・revision+1）→ 保存→再読込で同じ hash → undo/redo が1手単位
     B 失敗しても正式状態と候補を保つ（候補を作ったときと再生結果が違う・古い候補）
     C 再生の門：stack の上下／領域・base.faceId・pivots・axes・branch・model・未知の項目・花弁の読み手が無い・v1 の読み手 を断る
     D 確定のあとも通常の操作（裏返し・折り目）→ 保存→再読込
     E 表裏・回転・角の選び方：squash_twice_states.json の34経路（①②の角・1回目の袋折りの表裏・裏返し v/h）ぜんぶで ⑦ → 花弁1つ → 確定 → 再読込
       ＋ ⑦のあと裏返す（その側に⑦の折り目が無い＝理由つきで断る）→ もう一度裏返すと戻る
       ＋ 裏返してから ⑦（上に来たもう一方のフラップ）→ 受理
       ＋ ⑦が足りない（凧形を上から1枚だけ・上の三角なし）→ 理由つきで断る
   --write で check_petal_engine.py（Python の独立照合）の材料 petal_engine_states.json を書く。
   使い方： node test_petal_v2.js [--write]
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'petal_v2.js', 'fold_crossing.js']) vm.runInThisContext(rd(f));
const E = FreeFoldEngine, N = FreeFoldSnap, X = FoldCrossing;
SquashV2.useV1Validator(OrigamiRecipe.validate, JSON.parse(rd('origami_recipe.schema.json')));
const C = x => JSON.parse(JSON.stringify(x));
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const load = r => { const st = E.create(); st.recipe = C(r); st.cache = E.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache; return st };
const snap = st => JSON.stringify({ r: st.recipe, rev: st.revision, h: st.cache.hash, redo: st.redoStack || [], p: st.pending });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const invPt = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const SYM_ALL = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0], [-1, 0, 0, 1], [1, 0, 0, -1], [0, 1, 1, 0], [0, -1, -1, 0]];
const VW = { toScreen: p => [p[0] * 240, -p[1] * 240] }, SC = p => VW.toScreen(p);

/* ⑦（凧形の折り目2本を上から2枚・上の三角の折り目を一番上の左右の半分）を、いまの正方基本形の向きから作る（test_crane_progress.js と同じ操作の道） */
function step7(st, opt = {}) {
 const corner = st.cache.faces.map(f => f.poly.find(q => { const m = invPt(f.xf, q); return Math.abs(Math.abs(m[0]) - 1) < 1e-9 && Math.abs(Math.abs(m[1]) - 1) < 1e-9 })).filter(Boolean);
 const Q = corner[0]; assert.ok(corner.every(p => dist(p, Q) < 1e-9), '紙の4つの角が1点に集まっていない');
 const O = apply(st.cache.faces[0].xf, [0, 0]);
 const sides = E.rimEdges(st).filter(e => e.seg.some(p => dist(p, Q) < 1e-9));
 const dirs = [];
 for (const e of sides) { const far = e.seg.find(p => dist(p, Q) > 1e-9), d = [far[0] - Q[0], far[1] - Q[1]], L = Math.hypot(...d), u = [d[0] / L, d[1] / L];
  if (!dirs.some(v => Math.abs(v[0] * u[1] - v[1] * u[0]) < 1e-9 && v[0] * u[0] + v[1] * u[1] > 0)) dirs.push(u) }
 assert.equal(dirs.length, 2, '開いた角からのふちが2本でない');
 for (const u of dirs) {
  const rims = E.rimEdges(st).filter(e => e.seg.every(p => Math.abs((p[0] - Q[0]) * u[1] - (p[1] - Q[1]) * u[0]) < 1e-9));
  const top = rims.sort((a, b) => st.cache.faces.find(f => f.faceId === b.faceId).layer - st.cache.faces.find(f => f.faceId === a.faceId).layer)[0];
  const o = E.edgeToCreaseOptions(st, E.edgeIntent(st, top.faceId, top.rimId)).options.filter(v => v.ok)
   .find(v => { const d = [v.axis[1][0] - v.axis[0][0], v.axis[1][1] - v.axis[0][1]]; return Math.abs((Q[0] - v.axis[0][0]) * d[1] - (Q[1] - v.axis[0][1]) * d[0]) < 1e-9 });
  assert.ok(o, '開いた角を通る凧形の軸が出ない');
  E.proposeOnFace(st, o.axis[0], o.axis[1], top.faceId, { layers: 1 }); st.pending.kind = 'V'; E.setSide(st, o.sidePoint);
  if ((opt.kiteLayers || 2) > 1) E.setLayers(st, opt.kiteLayers || 2, st.pending.at);
  E.select(st, st.pending.candidates); E.confirm(st, { op: 'crease' });
 }
 if (opt.noTop) return st;
 const L = dist(Q, O) / Math.SQRT2, t8 = Math.tan(Math.PI / 8);
 const ends = []; for (const p of E.creaseIntervals(st).flatMap(c => c.seg))
  if (Math.abs(dist(p, O) - L * (1 - t8)) < 1e-9 && !ends.some(q => dist(p, q) < 1e-9)) ends.push(p);
 assert.equal(ends.length, 2, '凧形の折り目の端 P・P\' が2点にならない');
 const [P, Pp] = ends, Mid = [(P[0] + Pp[0]) / 2, (P[1] + Pp[1]) / 2];
 const side = [Mid[0] + (O[0] - Mid[0]) * .3 + (P[0] - Mid[0]) * .2, Mid[1] + (O[1] - Mid[1]) * .3 + (P[1] - Mid[1]) * .2];
 E.proposeOnFace(st, P, Pp, E.stackAt(st, side)[0].faceId, { layers: 1 }); st.pending.kind = 'V'; E.setSide(st, side);
 assert.equal(st.pending.candidates.length, 2, '上の三角の候補が左右の半分にならない');
 E.select(st, st.pending.candidates); E.confirm(st, { op: 'crease' });
 return st;
}
/* 画面と同じ道の ①〜⑥（test_crane_progress.js A と同じ） */
function prelimByUI() {
 const st = E.create();
 let g = N.grab(st, SC([-1, -1]), VW), cr = N.creaseForCorners(st, g.point, [1, 1]);
 E.proposeOnFace(st, cr.line[0], cr.line[1], cr.faceId, { layers: 1 }); E.setSide(st, cr.sidePoint); E.select(st, st.pending.candidates); E.confirm(st);
 g = N.grab(st, SC([-1, 1]), VW);
 const to = SC([1, -1]), s = N.foldTarget(st, g, [to[0] - 10, to[1] - 6], [0, 0], VW, false), c = N.creaseForCorners(st, g.point, s.target);
 E.proposeOnFace(st, c.line[0], c.line[1], c.faceId, { layers: 1 }); E.setSide(st, c.sidePoint); E.setLayers(st, 2, c.sidePoint); E.select(st, st.pending.candidates); E.confirm(st);
 let o = E.squashOptions(st); E.proposeSquash(st, o.options[0].pocketId); E.confirm(st);
 E.flip(st, 'v'); o = E.squashOptions(st); E.proposeSquash(st, o.options[0].pocketId); E.confirm(st);
 return st;
}
const detOf = m => m[0] * m[3] - m[1] * m[2];
const dump = [];
/* 候補→プレビュー→確定→保存・再読込→undo/redo（1手単位）。返すのは Python 照合の材料。 */
function throughPetal(st, label, checks = true) {
 const o = E.petalOptions(st);
 assert.equal(o.options.length, 1, `${label}：花弁の候補が1つでない（${o.options.length}・${o.reason}）`);
 const before = snap(st), beforeCache = C(st.cache);
 E.proposePetal(st, o.options[0].petalId);
 assert.equal(JSON.stringify({ r: st.recipe, rev: st.revision, h: st.cache.hash }), JSON.stringify((({ r, rev, h }) => ({ r, rev, h }))(JSON.parse(before))), `${label}：候補を作ったら正式状態が動いた`);
 const pv = E.petalPreview(st);
 const ts = [0, 0.25, 0.5, 0.75, 1], frames = ts.map(t => pv.frames(t));
 if (checks) {
  const byId = fr => new Map(fr.map(f => [f.faceId, f]));
  /* t=0 いまの面・t=1 確定後の面と同じ所 */
  for (const [fr, faces] of [[frames[0], pv.before], [frames[4], pv.after]]) {
   const m = byId(fr);
   for (const f of faces) for (const q of m.get(f.faceId).pts) { const want = apply(f.xf, q.m);
    assert.ok(dist(want, q.p) < 1e-9 && Math.abs(q.p[2]) < 1e-9, `${label}：プレビューの端の座標が面と違う（${f.faceId}）`) }
  }
  /* 途中：面ごとに辺長（剛体）＝素材の長さ／動かない面は z=0 のまま／動く面は z≥0 */
  for (const fr of frames) for (const f of fr) {
   for (let i = 0; i < f.pts.length; i++) { const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length];
    assert.ok(Math.abs(Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) - dist(a.m, b.m)) < 1e-9, `${label}：途中で辺長が変わる`) }
   assert.ok(f.pts.every(q => f.moving ? q.p[2] > -1e-9 : Math.abs(q.p[2]) < 1e-12), `${label}：途中で止まる面が浮く／動く面が下へ潜る`);
  }
  /* 描画に渡す配列＝面ごとの座標を drawOrder の順に扇で割ったもの。巻き順は素材の表（素材で左回り）→ t=0/1 で z 成分の向き＝det の符号 */
  for (const [i, t] of ts.entries()) {
   const pos = pv.positions(t), m = byId(frames[i]); let k = 0;
   for (const id of pv.drawOrder) { const pts = m.get(id).pts;
    for (let j = 1; j + 1 < pts.length; j++) for (const q of [pts[0], pts[j], pts[j + 1]]) {
     for (let c = 0; c < 3; c++) assert.ok(Math.abs(pos[k * 3 + c] - q.p[c]) < 1e-6, `${label}：描画に渡す座標が面の座標と違う`); k++ } }
   assert.equal(k * 3, pos.length, `${label}：描画に渡す三角形の数が違う`);
  }
  for (const [fr, faces] of [[frames[0], pv.before], [frames[4], pv.after]]) {
   const m = byId(fr);
   for (const f of faces) { const p = m.get(f.faceId).pts.map(q => q.p), nz = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
    assert.equal(Math.sign(nz), Math.sign(detOf(f.xf)), `${label}：表裏の巻き順が面の向きと違う（${f.faceId}）`) }
  }
 }
 const rev = st.revision;
 E.confirm(st, { name: 'つる' });
 const step = st.recipe.steps[st.recipe.steps.length - 1];
 assert.equal(step.op, 'petal'); assert.equal(st.recipe.version, 2); assert.equal(st.revision, rev + 1); assert.equal(st.pending, null);
 assert.equal(X.flatState(st.cache).ok, true, `${label}：確定後の平らな状態が成立しない`);
 const saved = C(E.verifiedRecipe(st)), re = load(JSON.parse(JSON.stringify(saved)));
 assert.equal(re.cache.hash, st.cache.hash, `${label}：保存→再読込で別の紙`);
 const h1 = st.cache.hash;
 E.undo(st); assert.equal(st.cache.hash, beforeCache.hash, `${label}：undo で花弁折りの前に戻らない`);
 E.redo(st); assert.equal(st.cache.hash, h1, `${label}：redo で同じ面・結び・層に戻らない`);
 assert.equal(JSON.stringify(st.recipe), JSON.stringify(saved), `${label}：undo/redo で原本の文字が変わった`);
 dump.push({ label, step: C(step), before: { faces: beforeCache.faces, bonds: beforeCache.bonds }, after: { faces: C(st.cache.faces), bonds: C(st.cache.bonds), creases: C(st.cache.creases) },
  frames: ts.map((t, i) => ({ t, faces: frames[i] })), drawOrder: pv.drawOrder, moving: pv.moving, faceOf: pv.faceOf });
 return { st, saved, step };
}

/* ================= A 代表例 ================= */
const rep = step7(prelimByUI());
assert.deepEqual(rep.recipe.steps.map(s => s.op), ['fold', 'fold', 'squash', 'flip', 'squash', 'crease', 'crease', 'crease']);
const repState = C(rep.recipe);
const A = throughPetal(rep, '代表例');
ok('A 代表例：①〜⑦ → 花弁1つ → 候補は正式状態を動かさない → プレビュー（両端＝面・途中は剛体・描画の配列・表裏の巻き順）→ 確定（v2 の1手）→ 保存→再読込 → undo/redo');

/* ================= B 失敗しても保つ ================= */
{
 const st = load(repState); const o = E.petalOptions(st); E.proposePetal(st, o.options[0].petalId);
 const keep = snap(st);
 st.pending.hash = 'x';
 const keep2 = snap(st);
 assert.throws(() => E.confirm(st), /候補を作ったときと再生結果が違います/);
 assert.equal(snap(st), keep2, 'B 断ったのに正式状態か候補が変わった');
 st.pending = JSON.parse(keep).p; st.pending.revision = st.revision - 1; const keep3 = snap(st);
 assert.throws(() => E.confirm(st), /古くなっています/); assert.equal(snap(st), keep3);
 assert.throws(() => E.undo(st), /確定か取消/); assert.throws(() => E.proposePetal(st), /確定か取消/);
 assert.throws(() => E.proposeOnFace(st, [0, 0], [1, 1], st.cache.faces[0].faceId, { layers: 1 }) && E.setSide(st, [0, 0]), /./);
 E.cancel(st); assert.equal(st.pending, null);
 ok('B 失敗（候補を作ったときと違う・古い候補）で正式状態と候補を保つ／候補のあいだは undo・別の候補を断る');
}

/* ================= C 再生の門 ================= */
{
 const base = A.saved, k = base.steps.length - 1;
 const reject = (label, edit, re) => { const r = C(base); edit(r.steps[k], r); assert.throws(() => E.replay(r), re, label) };
 const swap = st => { const i = st.stack.findIndex(r => r.length === 2); st.stack[i] = st.stack[i].slice().reverse() };
 reject('stack の上下', swap, /stack の上下が再生結果と違います/);
 reject('stack の領域が足りない', st => st.stack.pop(), /重なっている領域が書かれていません/);
 const faceOf = A.st.cache.petals[0].faceOf;
 reject('base.faceId', st => { st.base.faceId = faceOf.T2L }, /base\.faceId と pivots/);
 reject('pivots の入れかえ', st => { st.pivots = [st.pivots[1], st.pivots[0]] }, /base\.faceId と pivots/);
 reject('axes の役割', st => { const a = st.axes.find(v => v.role === 'side-hinge'); a.role = 'fixed-fold' }, /axes/);
 reject('axes の端', st => { const a = st.axes.find(v => v.role === 'petal-kite'); a.end = [a.end[0] * 0.9, a.end[1] * 0.9] }, /axes/);
 reject('branch', st => { st.branch.sideFold = 'behind-petal' }, /branch/);
 reject('model', st => { st.model = 'petal-rhombus-45' }, /model/);
 reject('未知の項目', st => { st.extra = 1 }, /知らない項目/);
 /* 花弁の読み手が無い（petal_v2.js を読みこんでいない v2 の読み手） */
 const keepP = globalThis.PetalV2; globalThis.PetalV2 = undefined;
 try { assert.throws(() => E.replay(C(base)), /花弁折り（op:'petal'）です。この読み手には花弁折りの再生器（petal_v2\.js）が読みこまれていません/) }
 finally { globalThis.PetalV2 = keepP }
 /* v1 の読み手 */
 /* v1 の読み手（手の op を1手ずつ見る）：花弁折りの手に来たら、名前を出して断る */
 assert.throws(() => E.replay({ ...C(base), version: 1, steps: [C(base.steps[k])] }), /花弁折り（op:petal）は version 2 の手です/);
 /* 花弁折りを巻き戻した v2 は、今までどおり読める */
 assert.equal(E.replay({ ...C(base), steps: base.steps.slice(0, k) }).hash, load(repState).cache.hash);
 ok('C 再生の門：stack の上下・領域・base.faceId・pivots・axes（役割・端）・branch・model・未知の項目を断る／花弁の読み手が無い・v1 の読み手ははっきり断る');
}

/* ================= D 確定のあとの通常の操作 ================= */
{
 const st = load(A.saved), h = st.cache.hash;
 E.flip(st, 'v'); assert.notEqual(st.cache.hash, h);
 const saved = C(E.verifiedRecipe(st)); assert.equal(load(saved).cache.hash, st.cache.hash);
 E.undo(st); assert.equal(st.cache.hash, h); E.redo(st);
 /* 花弁折りのあとの紙の平らな状態・結びの両側の一致 */
 assert.equal(X.flatState(st.cache).ok, true);
 ok('D 確定のあと 裏返し → 保存→再読込 → undo/redo（通常の手は同じ内部の再生器で続く）');
}

/* ================= E 表裏・回転・角の選び方 ================= */
{
 const cases = JSON.parse(rd('squash_twice_states.json')).cases;
 let accepted = 0;
 for (const c of cases) { const st = step7(load(c.recipe)); throughPetal(st, c.label, accepted < 6 || accepted % 5 === 0); accepted++ }
 ok(`E 34経路（①②の角・袋折りの表裏・裏返し v/h）ぜんぶで ⑦ → 花弁1つ → 確定 → 再読込 → undo/redo（${accepted}経路）`);
 /* ⑦のあと裏返す＝上に来るのは凧形の折り目の無いフラップ → 理由つきで断る（準備すれば H で通る）。もう一度裏返すと戻る。 */
 for (const ax of ['v', 'h']) {
  const st = load(repState); E.flip(st, ax);
  const o = E.petalOptions(st);
  assert.equal(o.options.length, 0, `⑦のあと裏返し ${ax} で花弁の候補が出た`);
  assert.match(o.reason, /上下が、つる⑦のあとと違います|見つかりません/, '裏返しの理由が違う: ' + o.reason);
  E.flip(st, ax); assert.equal(E.petalOptions(st).options.length, 1, `裏返しを戻しても花弁が出ない（${ax}）`);
 }
 /* 裏返してから ⑦（上に来たもう一方のフラップ）→ 受理 */
 for (const ax of ['v', 'h']) { const st = load(C(cases[0].recipe)); E.flip(st, ax); step7(st); throughPetal(st, `裏返し${ax}のあとに⑦`) }
 /* ⑦が足りない */
 { const st = step7(load(C(cases[0].recipe)), { noTop: true }); const o = E.petalOptions(st);
  assert.equal(o.options.length, 0); assert.match(o.reason, /見つかりません/, o.reason) }
 { const st = step7(load(C(cases[0].recipe)), { kiteLayers: 1 }); const o = E.petalOptions(st);
  assert.equal(o.options.length, 0); assert.match(o.reason, /見つかりません/, o.reason) }
 ok('E 裏返し：⑦のあと裏返すと理由つきで断る・戻すと出る／裏返してから⑦は受理（v・h）／⑦が足りない（上の三角なし・凧形が上から1枚）は理由つきで断る');
}

/* ================= F 周囲の紙の前提（合成：自然な紙では届かない門を鳴らす） =================
   出発：動く面と面積で重なる止まった紙が、動く面より上（または同じ層）にある → 断る
   軸の一周：軸の層より上の止まった紙が、軸（P-Q）に触れている（動く面とは面積で重ならない高さ）→ 断る */
{
 const base = load(repState).cache;
 const withFace = f => { const c = C(base); c.faces.push(f); return c };
 const faceOf = PetalV2.recognize(base).bindings[0].faceOf, byId = id => base.faces.find(f => f.faceId === id);
 const T2R = byId(faceOf.T2R), G2R = byId(faceOf.G2R);
 const above = withFace({ faceId: 'synthetic/above', layerPath: [], poly: C(T2R.poly), xf: [1, 0, 0, 1, 0, 0], layer: T2R.layer });
 let r = PetalV2.recognize(above);
 assert.equal(r.bindings.length, 0, 'F 花弁の上に止まった紙があっても花弁を受理した');
 assert.match(r.reason, /花弁の上に止まった紙が乗っています/);
 const ring = withFace({ faceId: 'synthetic/ring', layerPath: [], poly: C(G2R.poly), xf: [1, 0, 0, 1, 0, 0], layer: (byId(faceOf.S2R).layer + T2R.layer) / 2 });
 r = PetalV2.recognize(ring);
 assert.equal(r.bindings.length, 0, 'F 2枚目の脇の軸（P-Q）の上に上の層の紙が触れていても受理した');
 assert.match(r.reason, /花弁の軸の上に、その軸より上の層の紙が触れています/);
 /* 合成の紙がそれ以外の門で落ちていないこと（同じ紙を、高さだけ下げると受理される） */
 const low = withFace({ faceId: 'synthetic/low', layerPath: [], poly: C(G2R.poly), xf: [1, 0, 0, 1, 0, 0], layer: -5 });
 assert.equal(PetalV2.recognize(low).bindings.length, 1, 'F 下にある合成の紙で花弁を断った（門の見分けがつかない）');
 ok('F 周囲の紙（合成）：花弁の上に止まった紙・軸の上の層の紙を理由つきで断る／同じ紙を下に置けば受理');
}

/* ================= G ⑦を「実際に折って開く」工程で（2026-09-15・本人指示） =================
   凧形2本を上から2枚で折る → 上の三角を「折線のこの側を全部」で折る → 3手を「背を開く」で開く → 花弁折り。
   ①選び方：「上からN枚」の意味は変えない（1〜4枚は今までどおり断る）／「この側を全部」は紙全体から engine が求め、指の下に無い面・左右に分かれた面も入る／既存の foldability を通る
   ②開いた背：両側の xf が同じ＝0°に開いた＝crease（由来 stepId・素材の区間は保持・openedBy）／鏡映＝180°＝hinge のまま。原本は書きかえず再生で決まる。同じ線で折り直すと背に戻る
   ③花弁の認識：余分な折り目で分かれた面を、同じ置かれ方で平らな折り目でつながるまとまりとして照合。元の面・faceId は保持。運動の途中でも結びがぜんぶ一致 */
function foldOpen7(st, opt = {}) {
 const corner = st.cache.faces.map(f => f.poly.find(q => { const m = invPt(f.xf, q); return Math.abs(Math.abs(m[0]) - 1) < 1e-9 && Math.abs(Math.abs(m[1]) - 1) < 1e-9 })).filter(Boolean);
 const Q = corner[0], O = apply(st.cache.faces[0].xf, [0, 0]), side = dist(Q, O) / Math.SQRT2, t8 = Math.tan(Math.PI / 8);
 const dirs = [];
 for (const e of E.rimEdges(st).filter(e => e.seg.some(p => dist(p, Q) < 1e-9))) { const far = e.seg.find(p => dist(p, Q) > 1e-9), d = [far[0] - Q[0], far[1] - Q[1]], L = Math.hypot(...d), u = [d[0] / L, d[1] / L];
  if (!dirs.some(v => Math.abs(v[0] * u[1] - v[1] * u[0]) < 1e-9 && v[0] * u[0] + v[1] * u[1] > 0)) dirs.push(u) }
 assert.equal(dirs.length, 2, '開いた角からのふちが2本でない');
 const Ps = dirs.map(u => { const B = [Q[0] + u[0] * side, Q[1] + u[1] * side]; return { B, P: [O[0] + (B[0] - O[0]) * (1 - t8), O[1] + (B[1] - O[1]) * (1 - t8)] } });
 const foldLine = (a, b, sp, choose, kind = 'V') => { E.proposeOnFace(st, a, b, E.stackAt(st, sp)[0].faceId, { layers: 1, op: 'fold' }); st.pending.kind = kind; E.setSide(st, sp); choose(); E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' }) };
 for (const { B, P } of Ps) { const sp = [(Q[0] + B[0] + P[0]) / 3, (Q[1] + B[1] + P[1]) / 3]; foldLine(Q, P, sp, () => E.setLayers(st, 2, st.pending.at)) }
 const [P, Pp] = Ps.map(v => v.P), Mid = [(P[0] + Pp[0]) / 2, (P[1] + Pp[1]) / 2];
 const sp = [Mid[0] + (O[0] - Mid[0]) * .3 + (P[0] - Mid[0]) * .2, Mid[1] + (O[1] - Mid[1]) * .3 + (P[1] - Mid[1]) * .2];
 if (opt.onTop) opt.onTop({ P, Pp, sp });
 foldLine(P, Pp, sp, () => assert.doesNotThrow(() => E.setSideAll(st), e => { throw new assert.AssertionError({ message: '上の三角で「この側を全部」が断られた：' + e.message }) }));
 const folded = C(st.cache);
 const ids = st.recipe.steps.slice(-3).map(s => s.id).reverse();
 for (const sid of ids) {
  const h = E.hingeIntervals(st).find(h => h.stepId === sid && h.consistent);
  assert.ok(h, `背 ${sid} が見えない`);
  const f = st.cache.faces.find(f => f.layerPath.some(q => q.stepId === sid && q.side === 'cut'));
  const c = f.poly.reduce((s, p) => [s[0] + p[0] / f.poly.length, s[1] + p[1] / f.poly.length], [0, 0]);
  E.proposeOpen(st, E.hingeIntent(st, h.intervalId), c);
  const chk = E.pendingCheck(st); assert.ok(chk.ok, `背 ${sid} を開けない：${chk.reason}`);
  E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' });
 }
 return { st, folded, P, Pp, sp, openedSteps: ids };
}
{
 const T0 = Date.now();
 /* ① 選び方 */
 {
  const st = prelimByUI(); let top = null;
  const r = foldOpen7(st, { onTop: v => { top = v } });
  void r;
  /* 上の三角を折る直前の紙で、選び方を比べる（foldOpen7 と同じ手を engine で作り直す） */
  const pre = load({ ...C(st.recipe), steps: st.recipe.steps.slice(0, 7) });
  const { P, Pp, sp } = top;
  const begin = (op = 'fold', kind = 'V') => { E.proposeOnFace(pre, P, Pp, E.stackAt(pre, sp)[0].faceId, { layers: 1, op }); pre.pending.kind = kind; E.setSide(pre, sp) };
  begin(); const count = E.layersAt(pre, pre.pending.at).layers.length; assert.equal(count, 4, '上の三角の場所が4層でない');
  const want = { 1: /裂けます/, 2: /裂けます/, 3: /裂けます/, 4: /上に乗っている紙があります/ };
  for (let k = 1; k <= 4; k++) assert.throws(() => E.setLayers(pre, k, pre.pending.at), want[k], `上から${k}枚の断り方が変わった`);
  const before = snap(pre);
  let q; assert.doesNotThrow(() => { q = E.setSideAll(pre) }, e => { throw new assert.AssertionError({ message: '「この側を全部」が断られた：' + e.message }) });
  let A = P, B = Pp; if (E.side(sp, A, B) > 0) [A, B] = [B, A];
  const mine = pre.cache.faces.filter(f => { const c = E.split(f.poly, A, B)[1]; return c && E.area(c) > 1e-9 }).map(f => f.faceId).sort();
  assert.deepEqual(pre.pending.candidates.map(c => c.faceId).sort(), mine, '「この側を全部」の面が、紙全体から求めた動く側の面と違う');
  assert.equal(mine.length, 8, '上の三角の側の面が8面でない');
  const under = new Set(E.stackAt(pre, sp).map(v => v.faceId));
  assert.ok(mine.some(id => !under.has(id)), '指の下に無い面が入っていない（左右に分かれた面）');
  assert.equal(pre.pending.layerChoice.mode, 'side', '選び方の印が無い');
  assert.ok(q && q.movingIds.length === 8, 'プレビューの動く面が8面でない');
  assert.equal(JSON.stringify({ r: pre.recipe, rev: pre.revision, h: pre.cache.hash }), JSON.stringify((({ r, rev, h }) => ({ r, rev, h }))(JSON.parse(before))), '選んだだけで正式状態が動いた');
  for (const kind of ['V', 'M']) assert.equal(E.foldability(pre, mine, A, B, kind, sp).ok, true, `この側を全部 ${kind} が foldability を通らない`);
  E.cancel(pre);
  begin('fold', 'M'); E.setSideAll(pre); assert.equal(E.pendingCheck(pre).ok, true, '山折りでこの側を全部が通らない'); E.cancel(pre);
  begin('crease'); E.setSideAll(pre); assert.equal(E.pendingCheck(pre).ok, true, '折り目だけでこの側を全部が通らない'); E.cancel(pre);
  /* 記録＝解決した8面の faceId。再生で同じ判定を通る */
  const s8 = st.recipe.steps[7]; assert.deepEqual(s8.targets.map(t => t.faceId).sort(), mine, '記録された対象が8面でない');
  ok('G① 上の三角：上から1〜4枚は今までどおり断る／「折線のこの側を全部」＝紙全体から求めた8面（指の下に無い左右の面も入る）で谷・山・折り目だけが通る・正式状態は動かない・記録は8面の faceId');
 }
 /* ② 開いた背 */
 {
  const { st, folded, openedSteps, P, Pp, sp } = foldOpen7(prelimByUI());
  const cache = st.cache, byId = new Map(cache.faces.map(f => [f.faceId, f])), openers = st.recipe.steps.slice(-3).map(s => s.id);
  const refl = (a, b) => { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d), u = [d[0] / L, d[1] / L]; const R = [2 * u[0] * u[0] - 1, 2 * u[0] * u[1], 2 * u[0] * u[1], 2 * u[1] * u[1] - 1]; return [R[0], R[1], R[2], R[3], a[0] - (R[0] * a[0] + R[1] * a[1]), a[1] - (R[2] * a[0] + R[3] * a[1])] };
  const comp = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[0] * b[4] + a[1] * b[5] + a[4], a[2] * b[4] + a[3] * b[5] + a[5]];
  const eq = (x, y) => x.every((v, i) => Math.abs(v - y[i]) < 1e-9);
  let open = 0, fold = 0;
  for (const bd of cache.bonds) { const x = byId.get(bd.faceIds[0]), y = byId.get(bd.faceIds[1]);
   const same = eq(x.xf, y.xf), flipped = eq(x.xf, comp(y.xf, refl(bd.seg[0], bd.seg[1])));
   assert.ok(same !== flipped, `結び ${bd.bondId} が 0° とも 180° とも決まらない`);
   assert.equal(bd.kind, same ? 'crease' : 'hinge', `結び ${bd.bondId} の種類が置かれ方と違う`);
   const was0 = folded.bonds.find(b => b.bondId === bd.bondId); if (was0 && was0.kind === 'hinge' && same) assert.ok(openers.includes(bd.openedBy), `結び ${bd.bondId} は開いたのに openedBy が開いた手でない`);
   if (openers.includes(bd.openedBy)) { open++; assert.ok(openedSteps.includes(bd.stepId), `開いた背の由来 ${bd.stepId} が消えた`);
    const was = folded.bonds.find(b => b.bondId === bd.bondId); assert.ok(was && was.kind === 'hinge' && JSON.stringify(was.seg) === JSON.stringify(bd.seg) && was.stepId === bd.stepId, `開いた背 ${bd.bondId} の由来・素材の区間が変わった`) }
   if (bd.kind === 'hinge') fold++ }
  assert.equal(open, 12, '平らに開いた背が12本でない');
  const opened = cache.creases.filter(c => openers.includes(c.openedBy)); assert.equal(opened.length, 12, '開いた背の折り目が表示に12本足されない');
  assert.equal(E.hingeIntervals(st).filter(h => openedSteps.includes(h.stepId)).length, 0, '開いた背がまだ背として数えられる');
  assert.equal(new Set(E.creaseIntervals(st).filter(c => c.openedBy !== undefined || openedSteps.includes(c.stepId)).map(c => c.bondId)).has(null), false, '開いた背の折り目が結びと対応しない');
  /* 原本は書きかえない：保存した原本に kind も openedBy も無い／読み直しても同じ種類 */
  const saved = JSON.stringify(E.verifiedRecipe(st)); assert.ok(!/openedBy|"hinge"|"crease"/.test(saved), '原本に結びの種類が書かれた');
  assert.equal(load(JSON.parse(saved)).cache.hash, st.cache.hash, '読み直すと種類が変わる');
  /* 同じ線でもう一度折ると背に戻る（openedBy は外れる） */
  const again = load(JSON.parse(saved));
  E.proposeOnFace(again, P, Pp, E.stackAt(again, sp)[0].faceId, { layers: 1, op: 'fold' }); again.pending.kind = 'V'; E.setSide(again, sp); E.setSideAll(again);
  E.select(again, again.pending.candidates); E.confirm(again, { op: 'fold' });
  const back = again.cache.bonds.filter(b => b.stepId === again.recipe.steps.slice(-1)[0].id);
  assert.ok(back.length > 0 && back.every(b => b.kind === 'hinge' && !b.openedBy), '同じ線で折り直した背が hinge に戻らない／openedBy が残る');
  ok(`G② 3手を開いた紙：結び${cache.bonds.length}本すべて xf で 0°（crease）／180°（hinge ${fold}本）に一意／開いた12本は由来の手・素材の区間を保ち openedBy つき・表示の折り目12本・背の一覧から外れる／原本に種類は書かず再読込で同じ／同じ線で折り直すと背に戻る`);
 }
 /* ③ 花弁：折って開いた⑦ → 花弁 → 確定。折り目だけの⑦の花弁と、素材の点ごとに置かれ方・重なりの上下が同じ */
 {
  const { st } = foldOpen7(prelimByUI());
  const rec = PetalV2.recognize(st.cache); assert.equal(rec.bindings.length, 1, '折って開いた⑦で花弁が1つにならない: ' + rec.reason);
  const b = rec.bindings[0]; assert.ok(b.groupOf && Object.values(b.groupOf).some(g => g.length > 1), 'まとまりが使われていない（余分な折り目で分かれた面がない）');
  for (const id of st.cache.faces.map(f => f.faceId)) assert.ok(st.cache.faces.some(f => f.faceId === id));
  assert.ok(PetalV2.motionBondGap(b, st.cache).max < 1e-9, '運動の途中で結びが離れる');
  const out = throughPetal(st, '折って開いた⑦');
  const ref = throughPetal(step7(prelimByUI()), '（比較用）折り目だけの⑦', false); dump.pop();
  const inv = (m, p) => invPt(m, p), cen = f => { const mp = f.poly.map(p => inv(f.xf, p)); return mp.reduce((s, p) => [s[0] + p[0] / mp.length, s[1] + p[1] / mp.length], [0, 0]) };
  const mapTo = new Map(out.st.cache.faces.map(f => [f.faceId, ref.st.cache.faces.find(g => E.inside(cen(f), g.poly.map(p => inv(g.xf, p))))]));
  for (const f of out.st.cache.faces) { const g = mapTo.get(f.faceId); assert.ok(g && f.xf.every((v, i) => Math.abs(v - g.xf[i]) < 1e-9), `花弁のあと ${f.faceId} の置かれ方が折り目だけの道と違う`) }
  let pairs = 0;
  for (const a of out.st.cache.faces) for (const c of out.st.cache.faces) { if (a.faceId >= c.faceId || !E.overlapsArea(a.poly, c.poly)) continue;
   const ga = mapTo.get(a.faceId), gc = mapTo.get(c.faceId); if (ga === gc) continue; pairs++;
   assert.equal(Math.sign(a.layer - c.layer), Math.sign(ga.layer - gc.layer), `花弁のあと ${a.faceId} と ${c.faceId} の上下が折り目だけの道と違う`) }
  ok(`G③ 折って開いた⑦（20面・分かれた面はまとまりで照合）→ 花弁1つ・運動の途中の結びぜんぶ一致 → 確定 → 保存→再読込 → undo/redo／花弁のあと面ごとの置かれ方と重なる${pairs}組の上下が折り目だけの道と同じ`);
 }
 /* ③' 動く面が余分な折り目で分かれている：折り目だけの⑦に、花弁を横切る折り目を全部の層へ足す → まとまりで照合・途中の結び一致・確定 */
 {
  const st = step7(prelimByUI());
  const b0 = PetalV2.recognize(st.cache).bindings[0], M = [(b0.pt.P[0] + b0.pt["P'"][0]) / 2, (b0.pt.P[1] + b0.pt["P'"][1]) / 2], Qp = b0.pt.Q;
  const d = [b0.pt.P[0] - b0.pt["P'"][0], b0.pt.P[1] - b0.pt["P'"][1]], c = [M[0] + (Qp[0] - M[0]) * .45, M[1] + (Qp[1] - M[1]) * .45];
  const a = [c[0] - d[0], c[1] - d[1]], bb = [c[0] + d[0], c[1] + d[1]], sp = [M[0] + (Qp[0] - M[0]) * .7 + d[0] * .1, M[1] + (Qp[1] - M[1]) * .7 + d[1] * .1];/* 花弁の中心線（T2R|T2L）から少し P の側へ */
  E.proposeOnFace(st, a, bb, E.stackAt(st, sp)[0].faceId, { layers: 1, op: 'crease' }); st.pending.kind = 'V'; E.setSide(st, sp); E.setSideAll(st);
  E.select(st, st.pending.candidates); E.confirm(st, { op: 'crease' });
  const rec = PetalV2.recognize(st.cache); assert.equal(rec.bindings.length, 1, '横切る折り目を足した⑦で花弁が1つにならない: ' + rec.reason);
  const g = rec.bindings[0].groupOf; assert.ok(g && ['T2R', 'T2L', 'T1R', 'T1L'].every(k => g[k].length === 2), '動く面が2つずつのまとまりにならない: ' + JSON.stringify(g && Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.length]))));
  assert.ok(PetalV2.motionBondGap(rec.bindings[0], st.cache).max < 1e-9, '余分な折り目の結びが運動の途中で離れる');
  /* 見張りが空振りでないこと：まとまりの1面を止まる側へ入れかえた読み方では、途中で結びが離れる */
  const t = C(rec.bindings[0]); const x = t.groupOf.T2R.pop(); t.groupOf.T3R.push(x); t.moving = t.moving.filter(id => id !== x);
  assert.ok(PetalV2.motionBondGap(t, st.cache).max > 1e-3, '運動の途中の結びの見張りが、まとまりを取り違えた読み方でも鳴らない');
  const out = throughPetal(st, '横切る折り目を足した⑦');
  assert.equal(out.step.base.faceId, g.T2R[0], 'base.faceId がまとまりの代表（faceId の順で最初）でない');
  ok('G③\' 花弁を横切る折り目を全部の層へ足した⑦：動く4面が2つずつのまとまり・余分な結びも途中で一致（取り違えた読み方では鳴る）→ 確定 → 保存→再読込 → undo/redo');
 }
 /* ③'' まとまりの条件：中に背（hinge）がある・置かれ方がそろわないまとまりは作らない（合成） */
 {
  const { st } = foldOpen7(prelimByUI());
  const b = PetalV2.recognize(st.cache).bindings[0], multi = Object.entries(b.groupOf).find(([, v]) => v.length > 1);
  const inner = st.cache.bonds.find(bd => multi[1].includes(bd.faceIds[0]) && multi[1].includes(bd.faceIds[1]));
  const c1 = C(st.cache); c1.bonds.find(bd => bd.bondId === inner.bondId).kind = 'hinge';
  assert.equal(PetalV2.recognize(c1).bindings.length, 0, 'まとまりの中に背がある紙で花弁を受理した');
  const c2 = C(st.cache); c2.bonds = c2.bonds.filter(bd => bd.bondId !== inner.bondId);
  assert.equal(PetalV2.recognize(c2).bindings.length, 0, 'まとまりの中が結びでつながっていない紙で花弁を受理した');
  ok(`G③'' まとまりの条件（合成）：中の結びが背・中がつながっていない（${multi[0]}）なら花弁にしない`);
 }
 /* 34経路ぜんぶ：折って開く⑦ → 花弁 */
 {
  const cases = JSON.parse(rd('squash_twice_states.json')).cases; let k = 0;
  for (const c of cases) { const { st } = foldOpen7(load(c.recipe)); throughPetal(st, '折って開く：' + c.label, k < 3); k++ }
  ok(`G 34経路（①②の角・袋折りの表裏・裏返し v/h）ぜんぶで 凧形2本を折る→上の三角をこの側を全部で折る→3手を開く→花弁1つ→確定→再読込→undo/redo（${k}経路・${((Date.now() - T0) / 1000).toFixed(1)}s）`);
 }
}

/* ================= H 反対側の花弁折り（⑩⑪・2026-09-16・本人指示） =================
   実物：折り図 ⑩うらがえす→⑪おなじように。動画 bheH5wZckps は⑦の時点で両面に凧形を折っている（2:02〜2:23）・1回目のあと 3:21 裏返して 3:25 すぐ持ち上げる。
   裏側に既にある折り目＝上の三角 P-P'（⑦を「この側を全部」で折って開いた＝4層）／新しく付ける折り目＝凧形2本（⑦では上2枚だけ）。
   🚨手番号・固定 faceId・「2回目だから」は使わない：準備は1回目と同じ操作（正方基本形の対称から Q・O・横の角を求め、凧形を上から2枚で折って背を開く）、認識は同じ recognize。 */
function frameOf(st) {
 const mats = st.cache.faces.map(f => ({ f, mp: f.poly.map(p => invPt(f.xf, p)) }));
 const at = m => { const hit = mats.find(v => v.mp.some(q => dist(q, m) < 1e-9)); return hit && apply(hit.f.xf, m) };
 const O = at([0, 0]);
 const cs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(at);
 const groups = []; for (const p of cs) { const g = groups.find(g => dist(g.p, p) < 1e-9); if (g) g.n++; else groups.push({ p, n: 1 }) }
 const Q = groups.sort((a, b) => b.n - a.n)[0].p;
 const v = [(Q[0] - O[0]) / Math.SQRT2, (Q[1] - O[1]) / Math.SQRT2], r = a => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
 return { Q, O, Bs: [r(Math.PI / 4), r(-Math.PI / 4)].map(u => [O[0] + u[0], O[1] + u[1]]), corners: groups.map(g => g.n) };
}
/* 凧形2本を上から2枚で折って、背を開く（1回目の foldOpen7 の前半と同じ操作。上の三角は既に折り目があるので折らない） */
function kitesFoldOpen(st) {
 /* 花弁のあとの通常の手で engine が断ったら、例外で止めずに理由つきの AssertionError にする（壊し検査の判定を ABORT にしない） */
 try { return kitesFoldOpenRaw(st) } catch (e) { if (e instanceof assert.AssertionError) throw e; throw new assert.AssertionError({ message: '裏側の凧形の準備が断られた：' + e.message }) }
}
function kitesFoldOpenRaw(st) {
 const { Q, O, Bs } = frameOf(st), t8 = Math.tan(Math.PI / 8);
 for (const B of Bs) { const P = [O[0] + (B[0] - O[0]) * (1 - t8), O[1] + (B[1] - O[1]) * (1 - t8)], sp = [(Q[0] + B[0] + P[0]) / 3, (Q[1] + B[1] + P[1]) / 3];
  E.proposeOnFace(st, Q, P, E.stackAt(st, sp)[0].faceId, { layers: 1, op: 'fold' }); st.pending.kind = 'V'; E.setSide(st, sp); E.setLayers(st, 2, st.pending.at);
  E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' }) }
 for (const sid of st.recipe.steps.slice(-2).map(s => s.id).reverse()) {
  const h = E.hingeIntervals(st).find(h => h.stepId === sid && h.consistent); assert.ok(h, `凧形の背 ${sid} が見えない`);
  const f = st.cache.faces.filter(f => f.layerPath.some(q => q.stepId === sid && q.side === 'cut')).sort((a, b) => b.layer - a.layer)[0];
  E.proposeOpen(st, E.hingeIntent(st, h.intervalId), f.poly.reduce((s, p) => [s[0] + p[0] / f.poly.length, s[1] + p[1] / f.poly.length], [0, 0]));
  const k = E.pendingCheck(st); assert.ok(k.ok, `凧形の背 ${sid} を開けない：${k.reason}`); E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' }) }
 return st;
}
/* 素材の線分 a-b（原紙の座標）の上に、crease の結びがあるか（折り目が既にあるかの確認） */
const creaseOnMat = (st, D, a, b) => st.cache.bonds.filter(bd => bd.kind === 'crease').some(bd => { const A = [D[0] * a[0] + D[1] * a[1], D[2] * a[0] + D[3] * a[1]], B = [D[0] * b[0] + D[1] * b[1], D[2] * b[0] + D[3] * b[1]], d = [B[0] - A[0], B[1] - A[1]], L = Math.hypot(...d);
 return bd.seg.every(q => Math.abs((q[0] - A[0]) * d[1] - (q[1] - A[1]) * d[0]) / L < 1e-7) && dist(bd.seg[0], bd.seg[1]) > 1e-6 });
{
 const T0 = Date.now(), S2 = 2 - Math.SQRT2;
 /* H1 1回目のあと裏返す：花弁は無く、上の三角の折り目は裏側にもある／凧形の折り目は無い → 準備（凧形2本）→ 2回目 */
 for (const ax of ['v', 'h']) {
  const st = prelimByUI(); foldOpen7(st); throughPetal(st, `1回目（裏返し${ax}の前）`, false); dump.pop();
  E.flip(st, ax);
  const o0 = E.petalOptions(st); assert.equal(o0.options.length, 0, `裏返しただけで花弁が出た（${ax}）`);
  /* 裏側の折り目：裏の2層の素材は、表の2層と原紙の対称で写り合う。凧形・上の三角の線に crease があるかを8通りの対称で数える */
  const tri = SYM_ALL.filter(D => creaseOnMat(st, D, [S2, 0], [0, -S2])).length, kite = SYM_ALL.filter(D => creaseOnMat(st, D, [S2, 0], [1, -1])).length;
  kitesFoldOpen(st);
  const tri2 = SYM_ALL.filter(D => creaseOnMat(st, D, [S2, 0], [0, -S2])).length, kite2 = SYM_ALL.filter(D => creaseOnMat(st, D, [S2, 0], [1, -1])).length;
  assert.equal(tri2, tri, `準備で上の三角の折り目が増えた（既にあるはず・${ax}）`); assert.ok(kite2 > kite, `準備で凧形の折り目が増えない（${ax}）`);
  const rec = PetalV2.recognize(st.cache); assert.equal(rec.bindings.length, 1, `裏側の準備のあと花弁が1つでない（${ax}）：${rec.reason}`);
  assert.ok(PetalV2.motionBondGap(rec.bindings[0], st.cache).max < 1e-9, '2回目の運動の途中で結びが離れる');
  const out = throughPetal(st, `2回目（裏返し${ax}のあと準備）`);
  /* 続けて通常の折り1手（全体を半分に：対角 Q-O で「この側を全部」を谷折り）→ 保存 → undo/redo */
  /* 線＝中心線 Q-O に直角で、Q-O の中点を通る（面を横切る）。折る側＝O の側 */
  const { Q, O } = frameOf(out.st), mid = [(Q[0] + O[0]) / 2, (Q[1] + O[1]) / 2], nrm = [-(O[1] - Q[1]) / 2, (O[0] - Q[0]) / 2];
  const la = [mid[0] - nrm[0], mid[1] - nrm[1]], lb = [mid[0] + nrm[0], mid[1] + nrm[1]], sp = [mid[0] + (O[0] - mid[0]) * .3 + nrm[0] * .03, mid[1] + (O[1] - mid[1]) * .3 + nrm[1] * .03];
  const hit = E.stackAt(out.st, sp); assert.ok(hit.length, '通常の折りの側に紙がない');
  E.proposeOnFace(out.st, la, lb, hit[0].faceId, { layers: 1, op: 'fold' }); out.st.pending.kind = 'V'; E.setSide(out.st, sp);
  assert.doesNotThrow(() => E.setSideAll(out.st), e => { throw new assert.AssertionError({ message: '2回目のあとの通常の折りが断られた：' + e.message }) });
  const h2 = out.st.cache.hash; E.select(out.st, out.st.pending.candidates); E.confirm(out.st, { op: 'fold' });
  assert.equal(out.st.recipe.steps.slice(-1)[0].op, 'fold'); assert.equal(X.flatState(out.st.cache).ok, true, '通常の折りのあと平らな状態が成立しない');
  const saved = C(E.verifiedRecipe(out.st)); assert.equal(load(saved).cache.hash, out.st.cache.hash, '通常の折りのあと保存→再読込で別の紙');
  const h3 = out.st.cache.hash; E.undo(out.st); assert.equal(out.st.cache.hash, h2); E.redo(out.st); assert.equal(out.st.cache.hash, h3);
  ok(`H1 裏返し${ax}：裏側に上の三角の折り目は既にある（対称${tri}通り）・凧形は無い（${kite}）→ 凧形2本を折って開く（${kite2}）→ 2回目の花弁1つ・途中の結び一致 → 確定 → 保存→再読込 → undo/redo → 通常の折り1手 → 保存→再読込 → undo/redo`);
 }
 /* H2 動画の順：⑦で両面に凧形を折って開いてから1回目 → 裏返す → 準備なしで2回目 */
 {
  const st = prelimByUI(); foldOpen7(st); E.flip(st, 'v'); kitesFoldOpen(st); E.flip(st, 'v');
  throughPetal(st, '動画の順：両面準備のあと1回目');
  E.flip(st, 'v'); throughPetal(st, '動画の順：裏返してすぐ2回目');
  ok('H2 動画の順（⑦で両面に凧形→1回目→裏返す→すぐ2回目）も同じ認識で通る');
 }
 /* H3 準備が足りない：凧形を折らずに裏返しただけ・凧形を上から1枚だけ → 理由つきで断る */
 {
  const st = prelimByUI(); foldOpen7(st); throughPetal(st, '（H3 1回目）', false); dump.pop(); E.flip(st, 'v');
  assert.equal(E.petalOptions(st).options.length, 0, '凧形の折り目が無い裏側で花弁が出た');
  ok('H3 裏側に凧形の折り目が無ければ、2回目の花弁は出ない');
 }
 /* H4 34経路ぜんぶ：折って開く⑦→1回目→裏返す→凧形→2回目 */
 {
  const cases = JSON.parse(rd('squash_twice_states.json')).cases; let k = 0;
  for (const c of cases) { const st = load(c.recipe); foldOpen7(st); throughPetal(st, '1回目：' + c.label, false); dump.pop(); E.flip(st, 'v'); kitesFoldOpen(st); throughPetal(st, '2回目：' + c.label, k < 2); k++ }
  ok(`H4 34経路ぜんぶで 1回目→裏返す→凧形2本→2回目（${k}経路・${((Date.now() - T0) / 1000).toFixed(1)}s）`);
 }
}

if (process.argv.includes('--write')) {
 fs.writeFileSync(path.join(DIR, 'petal_engine_states.json'), JSON.stringify({ note: 'node test_petal_v2.js --write が書く。check_petal_engine.py が突き合わせの相手として読む（JS の結果は期待値にしない）。', cases: dump }));
 console.log(`  wrote petal_engine_states.json（${dump.length}例）`);
}
console.log(`\n${n} checks passed`);
