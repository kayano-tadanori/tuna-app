'use strict';
/* 🪶 つる⑫（まんなかにむけて折る・表裏4本）の engine の道（2026-09-16・本人指示）。
   ★見ること
     A 調査の固定（p12c.js から移した）：⑪の紙で、脚の側の外形の背を先端の二等分線で中心線へ合わせる軸について、
       動く側の面の部分集合を総当りすると、全部より小さい谷折りの成立はちょうど1通りで、それが「つながっているフラップ」（結びでたどる集合）と同じ。
       上からN枚はどれも断る・この側を全部はそれより大きい（既存の選び方の意味は変えない）。面の数・面ID は条件にしない。
     B ⑫の表裏4本を、外形の背の辺合わせ＋つながっているフラップ＋既存の fold で → 平ら・再生一致 → 保存→再読込 → undo/redo
     C 外形の背だけがつかむ元になる（見えている内部の背・隠れた背は入らない）
     D 生のふちをつかむ既存の辺合わせ（E2・H2・E3）の候補・軸・理由が、⑫の前の commit（3fa105a）の engine と同じ
   --write で crane12_state.json（⑫のあとの原本・⑬の構造確認の材料）を書く。
   使い方： node test_crane12.js [--write]
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

/* ================= 共通：⑪までを engine の道で（test_petal_v2 と同じ操作。準備した原本は使わない） ================= */
function birdBase() {
 const st = prelimByUI(); foldOpen7(st);
 let o = E.petalOptions(st); E.proposePetal(st, o.options[0].petalId); E.confirm(st);
 E.flip(st, 'v'); kitesFoldOpen(st); o = E.petalOptions(st); E.proposePetal(st, o.options[0].petalId); E.confirm(st);
 assert.equal(st.recipe.steps.filter(s => s.op === 'petal').length, 2, '⑪まで作れない');
 return st;
}
/* 脚の側の外形の背：見えている生のふち（中心線の上）と端を共有する外形の背（面ID・手番号は使わない） */
function legEdges(st) {
 /* 見えている生のふち（最上面の面の内側から見てその面がいちばん上）と、端を共有する外形の背 */
 const vis = E.rimEdges(st).filter(e => { const f = st.cache.faces.find(v => v.faceId === e.faceId); if (!f) return false;
  const c = f.poly.reduce((s, p) => [s[0] + p[0] / f.poly.length, s[1] + p[1] / f.poly.length], [0, 0]), m = [(e.seg[0][0] + e.seg[1][0]) / 2, (e.seg[0][1] + e.seg[1][1]) / 2];
  const q = [m[0] + (c[0] - m[0]) * .02, m[1] + (c[1] - m[1]) * .02], top = E.stackAt(st, q)[0]; return !!top && top.faceId === e.faceId });
 /* 花弁の先端：再生結果の花弁の記録（cache.petals の花弁の面 T2R/T2L）の頂点。脚の側＝そこではない方の先端 */
 const petalPts = (st.cache.petals || []).flatMap(pt => ['T2R', 'T2L'].map(k => st.cache.faces.find(f => f.faceId === pt.faceOf[k])).filter(Boolean).flatMap(f => f.poly));
 return E.outlineHingeEdges(st).filter(h => h.seg.some(p => vis.some(r => r.seg.some(q => dist(p, q) < 1e-9)) && !petalPts.some(q => dist(p, q) < 1e-9)));
}
/* 外形の背 h を、先端（h の端のうち、見えている生のふちと共有する点）を通る軸で中心線へ合わせる候補 */
function narrowOption(st, h) {
 const rimEnds = E.rimEdges(st).flatMap(e => e.seg), petalPts = (st.cache.petals || []).flatMap(pt => ['T2R', 'T2L'].map(k => st.cache.faces.find(f => f.faceId === pt.faceOf[k])).filter(Boolean).flatMap(f => f.poly));
 const tip = h.seg.find(p => rimEnds.some(q => dist(p, q) < 1e-9) && !petalPts.some(q => dist(p, q) < 1e-9));
 assert.ok(tip, '外形の背の端に、生のふちと共有する先端がない');
 const intent = E.hingeEdgeIntent(st, h.edgeId), r = E.edgeToCreaseOptions(st, intent);
 const good = r.options.filter(o => o.ok && distLine(tip, o.axis) < 1e-9);
 assert.ok(good.length, '先端を通る合わせ方が無い');
 const ax = good[0].axis; assert.ok(good.every(o => distLine(o.axis[0], ax) < 1e-9 && distLine(o.axis[1], ax) < 1e-9), '先端を通る合わせ方の軸が1本に決まらない');
 return { intent, option: good[0], tip };
}
const distLine = (p, s) => { const d = [s[1][0] - s[0][0], s[1][1] - s[0][1]], L = Math.hypot(...d); return Math.abs((p[0] - s[0][0]) * d[1] - (p[1] - s[0][1]) * d[0]) / L };
/* ⑫の1本を、画面と同じ engine の道で：候補の軸と動く側の点で提案 → つながっているフラップ → 確定（辺合わせの意図を渡す） */
function narrowOne(st, h, label) {
 const { intent, option } = narrowOption(st, h);
 E.proposeOnFace(st, option.axis[0], option.axis[1], intent.faceId, { layers: 1, op: 'fold' }); st.pending.kind = 'V'; E.setSide(st, option.sidePoint);
 assert.doesNotThrow(() => E.setFlap(st, st.pending.at), e => { throw new assert.AssertionError({ message: `${label}：つながっているフラップが断られた：${e.message}` }) });
 const ids = st.pending.candidates.map(c => c.faceId);
 E.select(st, st.pending.candidates);
 assert.doesNotThrow(() => E.confirm(st, { op: 'fold', edgeToCrease: { edge: intent, crease: E.creaseIntent(st, option.target.intervalId) } }), e => { throw new assert.AssertionError({ message: `${label}：外形の背の辺合わせの確定が断られた：${e.message}` }) });
 return ids;
}


/* ================= A 調査の固定：⑪の紙で、脚の側の外形の背を中心線へ合わせる折り（⑫）の面の選び方 ================= */
{
 const st = birdBase();
 const legs = legEdges(st);
 assert.equal(legs.length >= 2, true, '脚の側の外形の背が2本以上ない');
 for (const h of legs.slice(0, 2)) {
  const { option } = narrowOption(st, h);
  let A = option.axis[0], B = option.axis[1]; if (E.side(option.sidePoint, A, B) > 0) [A, B] = [B, A];
  const probe = load(st.recipe); E.proposeOnFace(probe, option.axis[0], option.axis[1], h.faceId, { layers: 1, op: 'fold' }); probe.pending.kind = 'V'; E.setSide(probe, option.sidePoint);
  const at = probe.pending.at, side = E.sideAllFaces(probe, A, B), under = E.stackAt(probe, at).map(v => v.faceId);
  /* 総当り：動く側の面の部分集合（この場所の面を1つ以上ふくむ）で foldability が通るもの */
  assert.ok(side.length <= 16, '動く側の面が多すぎて総当りできない');
  const valid = { V: [], M: [] };
  for (const kind of ['V', 'M']) for (let m = 1; m < (1 << side.length); m++) { const set = side.filter((_, i) => m >> i & 1); if (!set.some(id => under.includes(id))) continue;
   if (E.foldability(probe, set, A, B, kind, at).ok) valid[kind].push(set.slice().sort()) }
  const flap = E.flapFaces(probe, at, A, B).sort();
  assert.equal(valid.V.filter(s => s.length < side.length).length, 1, '全部より小さい谷折りの成立が1通りでない: ' + valid.V.length);
  assert.deepEqual(valid.V.find(s => s.length < side.length), flap, '成立する1通りが、結びでたどったフラップと違う');
  assert.ok(flap.some(id => !under.includes(id)), 'フラップに指の下に無い面が入っていない（この場合は入るはず）');
  /* 既存の選び方の意味は変わらない：上からN枚はどれも断る・この側を全部はフラップより大きい */
  const L = E.layersAt(probe, at).layers.length;
  for (let k = 1; k <= L; k++) assert.throws(() => E.setLayers(probe, k, at), Error, `上から${k}枚で⑫が通ってしまう（意味が変わった）`);
  E.setSideAll(probe); assert.ok(probe.pending.candidates.length > flap.length, 'この側を全部がフラップと同じになった');
  E.setFlap(probe, at); assert.deepEqual(probe.pending.candidates.map(c => c.faceId).sort(), flap, 'setFlap の候補が flapFaces と違う');
  assert.equal(probe.pending.layerChoice.mode, 'flap');
  assert.equal(E.recordable(probe, flap, probe.pending.reference.faceId, A, B, apply(probe.cache.faces.find(f => f.faceId === probe.pending.reference.faceId).xf, probe.pending.sidePoint)).ok, true, 'フラップが原本に書けない');
 }
 ok(`A ⑪の紙：脚の側の外形の背（${legs.length}本）を先端の二等分線で中心線へ：動く側の部分集合の総当りで谷の成立はちょうど1通り＝結びでたどったフラップ（指の下に無い面も入る）／上からN枚はどれも断る・この側を全部はそれより大きい・setFlap は同じ集合`);
}

/* ================= B ⑫の表裏4本を既存の fold で ================= */
{
 const st = birdBase(), before = st.recipe.steps.length;
 const sizes = [];
 for (const pass of ['表', '裏']) {
  if (pass === '裏') E.flip(st, 'v');
  for (let k = 0; k < 2; k++) {
   /* 候補から、この⑫で折ってできた背（自分が足した手の背＝もう一度細くする折り）を除く。記録を読むだけ（engine の判定ではない） */
   const mine = new Set(st.recipe.steps.slice(before).map(s => s.id));
   const legs = legEdges(st).filter(h => !mine.has(h.stepId)).filter(h => { try { narrowOption(st, h); return true } catch { return false } });
   const h = legs[0]; assert.ok(h, `${pass}${k + 1}本目：脚の側の外形の背が見つからない`);
   const ids = narrowOne(st, h, `${pass}${k + 1}本目`); sizes.push(ids.length);
   const last = st.recipe.steps[st.recipe.steps.length - 1];
   assert.equal(last.op, 'fold', `${pass}${k + 1}本目が fold でない`);
   assert.equal(X.flatState(st.cache).ok, true, `${pass}${k + 1}本目のあと平らな状態が成立しない`);
   assert.equal(E.replay(st.recipe).hash, st.cache.hash, `${pass}${k + 1}本目のあと再生が一致しない`);
  }
 }
 assert.equal(st.recipe.steps.length, before + 5, '⑫が表裏4本（＋裏返し1）にならない');
 const saved = C(E.verifiedRecipe(st)), re = load(saved);
 assert.equal(re.cache.hash, st.cache.hash, '保存→再読込で別の紙');
 const h = st.cache.hash; for (let i = 0; i < 5; i++) E.undo(st); for (let i = 0; i < 5; i++) E.redo(st);
 assert.equal(st.cache.hash, h, 'undo/redo で戻らない'); assert.equal(JSON.stringify(st.recipe), JSON.stringify(saved), 'undo/redo で原本の文字が変わった');
 if (process.argv.includes('--write')) fs.writeFileSync(path.join(DIR, 'crane12_state.json'), JSON.stringify({ note: 'node test_crane12.js --write が書く（⑫のあと・⑬の構造確認の材料）', recipe: saved }));
 ok(`B ⑫の表裏4本（外形の背→中心線・つながっているフラップ ${sizes.join('/')}面・既存の fold）→ 平ら・再生一致 → 保存→再読込 → undo/redo`);
}

/* ================= C 外形の背の条件：内部の背・隠れた背はつかまない ================= */
{
 const st = birdBase(); narrowOne(st, legEdges(st)[0], 'C の準備');/* ⑫を1本折った紙＝折り線の背が紙の内部に見える */
 const rows = E.hingeIntervals(st), outs = E.outlineHingeEdges(st);
 let inner = 0, hidden = 0;
 for (const r of rows) {
  if (!r.visible) { hidden++; assert.ok(!outs.some(o => o.intervalId === r.intervalId), `隠れた背 ${r.intervalId} がつかめる`); continue }
  for (const part of r.visibleParts) {
   const mid = [(part.seg[0][0] + part.seg[1][0]) / 2, (part.seg[0][1] + part.seg[1][1]) / 2], d = [part.seg[1][0] - part.seg[0][0], part.seg[1][1] - part.seg[0][1]], L = Math.hypot(...d), nn = [-d[1] / L, d[0] / L];
   const a = E.stackAt(st, [mid[0] + nn[0] * .003, mid[1] + nn[1] * .003]).length, b = E.stackAt(st, [mid[0] - nn[0] * .003, mid[1] - nn[1] * .003]).length;
   const listed = outs.some(o => o.intervalId === r.intervalId && overlap(o.partSrcSeg, part.srcSeg));
   if (a && b) { inner++; assert.equal(listed, false, `紙の内部の背 ${r.intervalId} がつかめる`) }
   else assert.equal(listed, true, `外形の背 ${r.intervalId} がつかめない`);
  }
 }
 assert.ok(inner > 0 && hidden > 0, `内部の背（${inner}）・隠れた背（${hidden}）の例が無い`);
 ok(`C ⑫を1本折った紙：外形の背 ${outs.length}本だけがつかむ元になる（見えている内部の背 ${inner}区間・隠れた背 ${hidden}本は入らない）`);
}
function overlap(a, b) { const d = [a[1][0] - a[0][0], a[1][1] - a[0][1]], L = Math.hypot(...d); if (L < 1e-12) return false;
 return b.every(p => Math.abs((p[0] - a[0][0]) * d[1] - (p[1] - a[0][1]) * d[0]) / L < 1e-6) }

/* ================= D 生のふちをつかむ既存の道は変わらない（変更前の engine と候補・理由を突き合わせる） ================= */
{
 const old = git('show 3fa105a:lab/origami/tools/freefold_engine.js');/* ⑫の変更を入れる前の commit（固定）＝commit したあとも比べる意味が残る */
 const box = { console };
 vm.createContext(box);
 vm.runInContext(old.src, box);
 const OE = box.FreeFoldEngine;
 assert.ok(old.changed, '比べる相手の engine が作業中のものと同じ（比べる意味が無い）');
 const states = [];
 { const s = E.create(); states.push(['平らな紙', s]) }
 { const s = prelimByUI(); states.push(['正方基本形', s]) }
 { const s = birdBase(); states.push(['⑪', s]) }
 /* 目印を延ばすと区間が変わる生のふちの候補がある紙（調べた：squash_twice の34経路・⑦・⑫で 2048件中192件）も入れる */
 states.push(['⑦（折り目だけ）', load(JSON.parse(rd('crane_step7_recipe.json')))]);
 if (fs.existsSync(path.join(DIR, 'crane12_state.json'))) states.push(['⑫', load(JSON.parse(rd('crane12_state.json')).recipe)]);
 for (const c of JSON.parse(rd('squash_twice_states.json')).cases.slice(0, 6)) states.push([c.label, load(c.recipe)]);
 let cmp = 0;
 for (const [lab, s] of states) {
  for (const e of E.rimEdges(s)) {
   const intent = E.edgeIntent(s, e.faceId, e.rimId);
   for (const fn of ['edgeToCreaseOptions', 'edgeToHingeOptions', 'edgeToEdgeOptions']) {
    const a = JSON.stringify(E[fn](s, intent).options.map(o => [o.ok, o.reason, o.axis, o.target && (o.target.seg || o.target.fixedSeg)]));
    const b = JSON.stringify(OE[fn](s, intent).options.map(o => [o.ok, o.reason, o.axis, o.target && (o.target.seg || o.target.fixedSeg)]));
    assert.equal(a, b, `${lab}：生のふち ${e.edgeId} の ${fn} が変更前と違う`); cmp++;
   }
  }
 }
 ok(`D 生のふちの辺合わせ（E2・H2・E3）の候補・軸・理由が、⑫の前の engine（3fa105a）と同じ（${cmp}組）`);
}
function git(args) {
 const { execSync } = require('node:child_process');
 const src = execSync('git ' + args, { cwd: process.env.ORIGAMI_GIT_DIR || DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });/* 壊し検査は写した一時フォルダで走る＝git は元のリポジトリで読む */
 return { src, changed: src !== rd('freefold_engine.js') };
}
console.log(`\n${n} checks passed`);
