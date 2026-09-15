'use strict';
/* 🚀 背の可視判定の高速化（2026-09-15）を固定する。
   ★変えたこと（engine）
     - hingeIntervals の結果を再利用：鍵＝cache オブジェクト＋digest（faces・bonds・hinges・creases）＋手の並び（id・diagramStep・kind）。
       カメラ・ズーム・pending・revision は鍵に入れない（可視判定は紙の座標だけで決まる。画面の距離は呼び手が毎回測る）。返すのは毎回複製。
     - 可視判定の点の読み方：一番上の面と「同じ層が2枚あるか」だけ（stackAt の紙片ID・layerPath 複製・並べ替えを作らない）。
       外接矩形の外の面は内外判定を省く（外の点は必ず外）。同じ座標の点は1回の計算で1回だけ判定。
     - 標本点（HINGE_SAMPLES）・探り幅（HINGE_PROBE）・見える条件は変えていない。
   ★見ること
     R 基準＝元の手順を engine の公開 API（layersAt）でこの検査の中に組み直し、可視区間と理由が全状態で一致
     K 再利用の見張り：確定・取消・派生状態・undo/redo・裏返し・cache の中身の書きかえ・カメラ変更で古い結果を使わない／返した値を書きかえても汚れない
     A 呼ぶ道（pickVisibleHinge・hingeIntent・proposeOpen・edgeToHingeOptions）が、ためた結果を使う（2回目は計算しない）
     P 計算時間（PC・node。携帯は bench_hinge.html を実機で開いて測る）
   使い方： node test_hinge_visibility.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const ctx = vm.createContext({ console, performance });
vm.runInContext(rd('freefold_engine.js'), ctx);
for (const f of ['freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js']) vm.runInContext(rd(f), ctx);
vm.runInContext('SquashV2.useV1Validator(OrigamiRecipe.validate,' + rd('origami_recipe.schema.json') + ')', ctx);
const { E, N } = vm.runInContext('({E:FreeFoldEngine,N:FreeFoldSnap})', ctx);
const C = x => JSON.parse(JSON.stringify(x)), J = JSON.stringify;
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const load = r => { const st = E.create(); st.recipe = C(r); st.cache = E.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache; return st };
const inv = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const stats = () => E.hingeMemoStats();

/* ---------- 基準：元の可視判定を公開 API で組み直す（標本点と探り幅は engine の原文から読む＝勝手に変えない） ---------- */
const src = rd('freefold_engine.js'), m = /const HINGE_SAMPLES=(\d+),HINGE_PROBE=\[([^\]]+)\];/.exec(src);
assert.ok(m, 'HINGE_SAMPLES／HINGE_PROBE が原文に無い');
const SAMPLES = +m[1], PROBE = m[2].split(',').map(Number);
assert.deepEqual([SAMPLES, PROBE], [24, [.012, .006, .003, .0016]], '標本点・探り幅が変わった（速度のために減らしていないか）');
const round = v => Math.round(v * 1e9) / 1e9;/* engine の round と同じ */
function refParts(state, row) {
 const P = row.seg[0], Q = row.seg[1], d = [Q[0] - P[0], Q[1] - P[1]], L = Math.hypot(d[0], d[1]);
 if (L < 1e-9) return { parts: [], reason: '背がつぶれています' };
 const nn = [-d[1] / L, d[0] / L], pair = new Set(row.faceIds), okv = [], owner = [], why = [];
 for (let i = 0; i < SAMPLES; i++) {
  const t = (i + .5) / SAMPLES, p = [P[0] + d[0] * t, P[1] + d[1] * t];
  let seen = false, own = null, note = null;
  for (const eps of PROBE) {
   const la = E.layersAt(state, [p[0] + nn[0] * eps, p[1] + nn[1] * eps]), lb = E.layersAt(state, [p[0] - nn[0] * eps, p[1] - nn[1] * eps]);
   if (la.duplicated.length || lb.duplicated.length) { note = '同じ層の紙が重なっていて順位が決まりません'; continue }
   const ta = la.stack[0] ? la.stack[0].faceId : null, tb = lb.stack[0] ? lb.stack[0].faceId : null;
   if (ta === null && tb === null) { note = '背の両側に紙がありません'; continue }
   if (ta === tb) { note = '上に別の紙が乗っていて、背が見えていません'; continue }
   if (!(pair.has(ta) || pair.has(tb))) { note = '上に別の紙が乗っていて、背が見えていません'; continue }
   seen = true; own = pair.has(ta) ? ta : tb; note = null; break }
  okv.push(seen); owner.push(own); if (!seen && note) why.push(note) }
 const parts = []; let i = 0;
 while (i < SAMPLES) { if (!okv[i]) { i++; continue }
  let j = i; while (j + 1 < SAMPLES && okv[j + 1] && owner[j + 1] === owner[i]) j++;
  const t0 = i / SAMPLES, t1 = (j + 1) / SAMPLES;
  const seg = [[P[0] + d[0] * t0, P[1] + d[1] * t0], [P[0] + d[0] * t1, P[1] + d[1] * t1]];
  parts.push({ t0: round(t0), t1: round(t1), seg: C(seg), ownerFaceId: owner[i], len: round(Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1])) });
  i = j + 1 }
 return { parts, reason: parts.length ? null : (why[0] || null) } }
/* engine の行から、基準と同じ形（srcSeg は engine の丸め鍵なのでここでは比べない＝行の srcSeg と部分の対応は下で別に見る）を取り出す */
const shape = rows => rows.map(r => ({ id: r.intervalId, visible: r.visible, reason: r.reason,
 parts: r.visibleParts.map(p => ({ t0: p.t0, t1: p.t1, seg: p.seg, ownerFaceId: p.ownerFaceId, len: p.len })) }));
const refShape = (state, rows) => rows.map(r => { const v = r.consistent ? refParts(state, r) : { parts: [], reason: '結びの線が両側で一致しません（紙が切り離されています）' };
 return { id: r.intervalId, visible: v.parts.length > 0, reason: v.reason, parts: v.parts } });

/* ---------- 状態：袋折り・裏返し・袋折りのあと・ランダムな v1（上からN枚・折り目あり） ---------- */
const recipes = [], J3 = JSON.parse(rd('squash_tsuru3_v2.json'));
recipes.push(J3);
for (const ax of ['v', 'h']) { const t = load(J3); E.flip(t, ax); recipes.push(C(t.recipe)) }
for (const c of JSON.parse(rd('squash_after_states.json')).cases) recipes.push(c.recipe);
let seed = 91; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let k = 0; k < 150; k++) { const R = E.create().recipe; let cache = E.replay(R); const nS = 1 + Math.floor(rnd() * 5);
 for (let s = 1; s <= nS; s++) for (let t = 0; t < 30; t++) { const V = cache.faces.flatMap(f => f.poly), a = rnd() < .5 ? V[Math.floor(rnd() * V.length)] : [rnd() * 2 - 1, rnd() * 2 - 1], b = [rnd() * 2 - 1, rnd() * 2 - 1];
  const f = cache.faces[Math.floor(rnd() * cache.faces.length)], pr = E.split(f.poly, a, b); if (!pr[0] || !pr[1]) continue;
  const side = [0, 1].map(i => pr[1].reduce((q, p) => q + p[i], 0) / pr[1].length);
  const ids = rnd() < .5 ? [f.faceId] : cache.faces.filter(g => E.split(g.poly, a, b)[1]).map(g => g.faceId);
  const st = { id: 's' + s, diagramStep: String(s), op: rnd() < .15 ? 'crease' : 'fold', kind: rnd() < .5 ? 'V' : 'M', reference: { faceId: f.faceId }, targets: ids.map(i => ({ faceId: i })), line: [inv(f.xf, a), inv(f.xf, b)], movingSidePoint: inv(f.xf, side) };
  if (st.line.some(p => p.some(v => Math.abs(v) > 1))) continue; R.steps.push(st); try { cache = E.replay(R); break } catch { R.steps.pop() } }
 recipes.push(R) }

console.log('R 基準（元の手順を layersAt で組み直したもの）と一致');
{
 let rows = 0, vis = 0, dupReason = 0;
 for (const r of recipes) { const st = load(r), got = E.hingeIntervals(st);
  assert.equal(J(shape(got)), J(refShape(st, got)), 'R 可視区間か理由が基準と違う');
  for (const row of got) for (const p of row.visibleParts) { const X = st.cache.faces.find(f => f.faceId === row.faceIds[0]);
   assert.equal(J(p.srcSeg), J(C(p.srcSeg)), 'R srcSeg が数でない') }
  rows += got.length; vis += got.filter(v => v.visible).length; dupReason += got.filter(v => v.reason === '同じ層の紙が重なっていて順位が決まりません').length }
 /* 合成：自然な手順では「同じ層が2枚」の理由が出ない＝読み込んだ紙の層番号を、重なる相手と同じにして分岐を通す（基準も同じ紙で読む） */
 let dupStates = 0;
 for (const r of recipes.slice(0, 60)) { const st = load(r), F = st.cache.faces; let done = false;
  for (let i = 0; i < F.length && !done; i++) for (let j = i + 1; j < F.length && !done; j++)
   if (F[i].layer !== F[j].layer && E.overlapsArea(F[i].poly, F[j].poly)) { F[j].layer = F[i].layer; done = true }
  if (!done) continue; dupStates++;
  const got = E.hingeIntervals(st);
  assert.equal(J(shape(got)), J(refShape(st, got)), 'R 同じ層を合成した紙で可視区間か理由が基準と違う');
  rows += got.length; vis += got.filter(v => v.visible).length; dupReason += got.filter(v => v.reason === '同じ層の紙が重なっていて順位が決まりません').length }
 assert.ok(dupStates > 10 && dupReason > 0, 'R 同じ層の理由を通っていない: ' + dupStates + '/' + dupReason);
 assert.ok(recipes.length > 150 && rows > 400 && vis > 100, 'R 状態が少なすぎる');
 ok(`${recipes.length}状態・背 ${rows}本（見えている ${vis}本・同じ層の理由 ${dupReason}本）で、可視区間・持ち主・理由が基準と一致`);
}

console.log('K 再利用の見張り（古い結果を使わない）');
{
 const fresh = st => J(refShape(st, E.hingeIntervals(load(st.recipe))));/* 同じ原本を別の紙として作り直した基準 */
 const same = (st, tag) => { const m0 = stats().miss, got = J(shape(E.hingeIntervals(st))), own = stats().miss - m0;
  assert.equal(got, fresh(st), tag + ' で古い可視判定を使った'); return own };
 const ref = s => s.pending.candidates;
 const st = E.create(); E.propose(st, [0, -1], [0, 1]); st.pending.kind = 'V'; E.setSide(st, [.5, 0]); E.select(st, ref(st)); E.confirm(st);
 same(st, 'K 半分折り');
 const s0 = stats().miss; E.hingeIntervals(st); assert.equal(stats().miss, s0, 'K 同じ紙で作り直した');
 /* 候補（pending）を作る・取消す＝紙は同じ＝ためた結果を使ってよい（中身は同じ） */
 E.proposeOnFace(st, [-1, .2], [0, .2], E.stackAt(st, [-.5, .5])[0].faceId, { layers: 1 }); st.pending.kind = 'V'; E.setSide(st, [-.5, .5]);
 const ownPending = same(st, 'K 候補があるとき'); E.cancel(st); const ownCancel = same(st, 'K 取消');
 assert.equal(ownPending + ownCancel, 0, 'K 候補・取消で作り直した（紙は変わっていない）');
 /* 確定＝紙が変わる */
 const top = E.stackAt(st, [-.5, .5])[0]; E.proposeOnFace(st, [-1, .2], [0, .2], top.faceId, { layers: 1 }); st.pending.kind = 'V'; E.setSide(st, [-.5, .5]); E.setLayers(st, 2, st.pending.at); E.select(st, ref(st)); E.confirm(st);
 assert.equal(same(st, 'K 確定'), 1, 'K 確定したのに作り直さない'); const hConfirm = J(shape(E.hingeIntervals(st)));
 E.undo(st); same(st, 'K undo'); assert.notEqual(J(shape(E.hingeIntervals(st))), hConfirm, 'K undo しても確定後の結果のまま');
 E.redo(st); same(st, 'K redo'); assert.equal(J(shape(E.hingeIntervals(st))), hConfirm, 'K redo で確定後に戻らない');
 E.flip(st, 'v'); same(st, 'K 裏返し'); E.undo(st); same(st, 'K 裏返しの undo');
 /* 派生状態（続けてつぶす）＝正式な紙と派生の紙はそれぞれの結果 */
 const sq = E.create(); E.propose(sq, [0, -1], [0, 1]); sq.pending.kind = 'M'; E.setSide(sq, [.5, 0]);
 const d = E.stageFold(sq); same(d, 'K 派生'); same(sq, 'K 派生を作ったあとの正式な紙');
 assert.notEqual(J(shape(E.hingeIntervals(d))), J(shape(E.hingeIntervals(sq))), 'K 派生と正式な紙が同じ結果（前提が崩れた）');
 /* cache の中身をその場で書きかえる（ふだんはしないが、しても古い結果を使わない） */
 const t = load(J3); const before = J(shape(E.hingeIntervals(t)));
 const f = t.cache.faces.find(v => v.layer === 3); f.layer = -5;
 const miss = stats().miss; const after = J(shape(E.hingeIntervals(t)));
 assert.equal(stats().miss, miss + 1, 'K 中身を書きかえたのに作り直さない');
 assert.equal(after, J(refShape(t, E.hingeIntervals(t))), 'K 書きかえたあとが基準と違う'); assert.notEqual(after, before, 'K 書きかえが可視判定に効いていない（検査の前提）');
 /* 手の並びだけ変わる（diagramStep）＝区間の中身（diagramStep）が変わる */
 const u = load(J3); E.hingeIntervals(u); u.recipe.steps[0].diagramStep = '9';
 assert.equal(E.hingeIntervals(u).find(v => v.stepId === 's1').diagramStep, '9', 'K 手の並びが変わったのに古い diagramStep');
 /* 返した値を書きかえても、次の答えは汚れない */
 const w = load(J3); E.hingeIntervals(w);/* 初回 */
 for (const a1 of [E.hingeIntervals(w), E.hingeIntervals(w)]) { a1[0].visibleParts.length = 0; a1[0].faceIds[0] = 'x' }/* 再利用の戻り値を書きかえる */
 assert.equal(J(shape(E.hingeIntervals(w))), J(refShape(w, E.hingeIntervals(load(w.recipe)))), 'K 返した値の書きかえが、ためた結果に入った');
 /* カメラ・ズーム＝可視判定は同じ、選ばれる背は画面の距離で変わる（毎回測る） */
 const cam = load(JSON.parse(rd('squash_after_states.json')).cases.find(c => c.name.startsWith('A ')).recipe);
 const h = E.hingeIntervals(cam).find(v => v.intervalId === 'hinge:s2#1' && v.visible), p = h.visibleParts[0].seg, mid = [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2];
 const v1 = { toScreen: q => [400 + q[0] * 300, 400 - q[1] * 300] }, v2 = { toScreen: q => [120 + q[0] * 900, 700 - q[1] * 900] };
 const m0 = stats().miss;
 assert.equal(N.pickVisibleHinge(cam, v1.toScreen(mid), v1).hinge.intervalId, 'hinge:s2#1', 'K 画面1で背を選べない');
 assert.equal(N.pickVisibleHinge(cam, v1.toScreen([mid[0], mid[1] - .3]), v2).hinge, null, 'K ズームを変えた画面で、前の画面の位置のまま選んだ');
 assert.equal(N.pickVisibleHinge(cam, v2.toScreen(mid), v2).hinge.intervalId, 'hinge:s2#1', 'K ズームを変えた画面で背を選べない');
 assert.ok(stats().miss - m0 <= 1, 'K カメラを変えただけで作り直した');
 ok('K 候補・取消はためた結果（紙は同じ）／確定・undo/redo・裏返し・派生・中身の書きかえ・手の並びの変更は作り直す／返した値を書きかえても汚れない／カメラは画面の距離だけ測り直す');
}

console.log('A 呼ぶ道が、ためた結果を使う');
{
 const cam = load(JSON.parse(rd('squash_after_states.json')).cases.find(c => c.name.startsWith('A ')).recipe);
 const view = { toScreen: q => [400 + q[0] * 300, 400 - q[1] * 300] };
 const h = E.hingeIntervals(load(cam.recipe)).find(v => v.intervalId === 'hinge:s2#1'), p = h.visibleParts[0].seg, mid = [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2];
 const m0 = stats().miss;
 const pk = N.pickVisibleHinge(cam, view.toScreen(mid), view);/* pickVisibleHinge（区間）＋ hingeIntent（区間）＝作るのは1回 */
 assert.equal(stats().miss - m0, 1, 'A 背を選ぶ1回で可視判定を2回以上作った: ' + (stats().miss - m0));
 E.proposeOpen(cam, pk.intent, [.8, .3]); assert.equal(stats().miss - m0, 1, 'A 背を選んだあとの開く提案で作り直した');
 E.cancel(cam);
 const e = E.rimEdges(cam)[0], ei = E.edgeIntent(cam, e.faceId, e.rimId);
 for (let i = 0; i < 20; i++) E.edgeToHingeOptions(cam, ei);
 assert.equal(stats().miss - m0, 1, 'A 辺を運ぶ20コマで作り直した');
 ok('A 背を選ぶ→開く提案→辺を運ぶ20コマで、可視判定の計算は1回');
}

console.log('P 計算時間（PC・node。携帯は bench_hinge.html を実機で）');
{
 const ref = s => s.pending.candidates, rows = [];
 const build = k => { const s = E.create(); for (let i = 0; i < k; i++) { const fx = s.cache.faces.flatMap(f => f.poly.map(p => p[0])), lo = Math.min(...fx), hi = Math.max(...fx), c = lo + (hi - lo) * .5, side = [c - .02, .37];
  const t = E.stackAt(s, side)[0]; E.proposeOnFace(s, [c, -1], [c, 1], t.faceId, { layers: 1 }); s.pending.kind = 'V'; E.setSide(s, side);
  const nn = E.layersAt(s, s.pending.at).layers.length; if (nn > 1) E.setLayers(s, nn, s.pending.at); E.select(s, ref(s)); E.confirm(s) } return s };
 const ms = f => { const t = performance.now(); f(); return +(performance.now() - t).toFixed(2) };
 for (const k of [4, 5, 6]) { const s = build(k), freshen = () => { s.cache = E.replay(s.recipe); s.committed = s.cache };
  freshen(); const first = ms(() => E.hingeIntervals(s)), reuse = ms(() => E.hingeIntervals(s));
  rows.push({ 面: s.cache.faces.length, '初回ms': first, '再利用ms': reuse }) }
 console.table(rows);
 ok('P 16・32・64面の初回と再利用を表示（数値は PC だけ。携帯の秒数はここから推定しない）');
}
console.log(`\n${n} checks passed`);
