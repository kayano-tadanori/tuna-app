'use strict';
/* 🪝 中割り（op:'reverse'）の engine 検査（2026-09-18・recipe_crane13.md 第22段）。
   役割を固定：本番は履歴（engine の order／層番号）、外からの監査は幾何と目標。入れ子の規則そのものを正解にしない。
   R3 つる⑫の紙 → ⑬（脚1・脚2）：背は1本に自動・位置＝fold・脚1は保存した目標の上下と全組一致・背の反転・平ら/再生/保存/undo
      ＋⑬の結果の固定（2026-09-19・第24段）：根元の頂点の規則は⑬では発動しない（root=null・途中の姿も規則なしと同じ）・digest と原本の sha1 が規則を足す前と同じ
   R4 本人の1枚模型の2手目：正方形 → 半分 → 中割り（⑬相当）→ その先をもう一度中割り（⑭相当）。頂点の位置3 × θ 2通り。
      背の根元が中割りの頂点なので「根元の頂点へ開きを伝える」規則で動く：各コマで 閉路（結びが離れない）・剛体（面の中の距離が変わらない）・
      突き抜けなし／終わり＝確定の再生結果／終端が平ら・頭は首の2層のあいだ（入れ子）・位置＝fold・背の反転・再生/保存/undo
   R5 つる⑭（頭）：⑫→⑬脚2本→⑭。線は ORIPA の元の端点（crane14_headline.json・⑬と同じ原紙の向き）を⑬のあとの面の xf で写したもの。
      根元＝⑬の頂点・各コマで閉路と突き抜けなし・終端が平ら・頭は首の層のあいだ・位置＝fold・背の反転・再生/保存/undo。上下は履歴（order）に任せて記録だけ
   R1 本人の1枚模型：正方形 → 半分に折る → 任意の線で中割り。θ＝90・45・15・75.96° × 線の位置3通り × 線の傾き（先へ／元へ）。
      ① 候補：背は1本に決まる（自動）② 終端の位置＝同じフラップを同じ線で fold した結果と、素材点2000個で一致
      ③ 並び（目標）：4枚が重なる所で 下の元／下の先／上の先／上の元（教科書の中割り＝規則とは別に書いた目標）
      ④ 背の先の区間の山谷が反転（reversedBy）し、それが静的な側の入れかわりと一致 ⑤ flatState・再生一致・保存→再読込・undo/redo
      ⑥ プレビュー：始まり＝いまの紙・終わり＝確定の再生結果（位置）・途中の結びが離れない・終わりの手前の上下＝確定の層順
   使い方： node test_reverse_fold.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname, rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'petal_v2.js', 'fold_crossing.js']) vm.runInThisContext(rd(f));
SquashV2.useV1Validator(OrigamiRecipe.validate, JSON.parse(rd('origami_recipe.schema.json')));
const E = FreeFoldEngine, X = FoldCrossing;
const C = x => JSON.parse(JSON.stringify(x));
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const load = r => { const st = E.create(); st.recipe = C(r); st.cache = E.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache; return st };
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const inv = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rad = d => d * Math.PI / 180;
/* Python 独立照合（test_reverse_python.py）へ渡す書き出し。ORIGAMI_DUMP_REVERSE を渡したときだけ（検査の判定は変えない） */
const DUMP = process.env.ORIGAMI_DUMP_REVERSE ? [] : null;
const faceDump = cache => cache.faces.map(f => ({ faceId: f.faceId, layerPath: f.layerPath, poly: f.poly, xf: f.xf, layer: f.layer }));
const revPairs = (cache, sid) => cache.bonds.filter(b => b.reversedBy && b.reversedBy.includes(sid)).map(b => b.faceIds.slice());
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

/* 素材点ごとの「いまの位置」：素材の点を含む面を探して xf で写す */
function whereIs(cache, m) {
 for (const f of cache.faces) { const mp = f.poly.map(p => inv(f.xf, p)); if (E.inside(m, mp)) return { faceId: f.faceId, p: apply(f.xf, m), layer: f.layer, det: E.detXf(f.xf) } }
 return null;
}
function samePositions(ca, cb, N = 2000) {
 let worst = 0, miss = 0;
 for (let i = 0; i < N; i++) { const m = [rnd() * 2 - 1, rnd() * 2 - 1], a = whereIs(ca, m), b = whereIs(cb, m);
  if (!a || !b) { miss++; continue } worst = Math.max(worst, dist(a.p, b.p)); if (a.det !== b.det) worst = Infinity }
 return { worst, miss };
}
function checksAll(st, label, k) {
 assert.equal(X.flatState(st.cache).ok, true, `${label} flatState が成立しない`);
 assert.equal(E.replay(st.recipe).hash, st.cache.hash, `${label} 再生が一致しない`);
 const saved = C(E.verifiedRecipe(st)), re = load(saved);
 assert.equal(re.cache.hash, st.cache.hash, `${label} 保存→再読込で別の紙`);
 const h = st.cache.hash, txt = JSON.stringify(st.recipe);
 for (let i = 0; i < k; i++) E.undo(st); for (let i = 0; i < k; i++) E.redo(st);
 assert.equal(st.cache.hash, h, `${label} undo/redo で戻らない`); assert.equal(JSON.stringify(st.recipe), txt, `${label} undo/redo で原本が変わった`);
}
/* 結びの静的な側：畳まれた結び a|b で、b が a の表の側(+1)か裏の側(-1)か（層の上下 × a の表裏）。 */
function bondSide(cache, b) { const fa = cache.faces.find(f => f.faceId === b.faceIds[0]), fb = cache.faces.find(f => f.faceId === b.faceIds[1]);
 if (!fa || !fb || E.detXf(fa.xf) * E.detXf(fb.xf) > 0) return 0; return Math.sign(fb.layer - fa.layer) * Math.sign(E.detXf(fa.xf)) }
/* 背の反転の照合：この手で印が付いたかと、同じ結び（bondId）の前後の静的な側の入れかわりが一致すること */
function reversalConsistent(before, after, stepId) {
 const bad = [];
 for (const b of after.bonds) { if (b.kind !== 'hinge') continue;
  /* 同じ結びの区間は、面の親子（面ID の前方一致）で前後を対応づける（bondId は区間に分かれても同じ） */
  const anc = (id, a) => id === a || id.startsWith(a + '/');
  const b0 = before.bonds.find(x => x.bondId === b.bondId && ((anc(b.faceIds[0], x.faceIds[0]) && anc(b.faceIds[1], x.faceIds[1])) || (anc(b.faceIds[0], x.faceIds[1]) && anc(b.faceIds[1], x.faceIds[0])))); if (!b0) continue;
  const s0 = bondSide(before, b0), s1 = bondSide(after, b); if (!s0 || !s1) continue;
  const flippedNow = (b.reversedBy || []).includes(stepId);
  if ((s0 !== s1) !== flippedNow) bad.push(`${b.bondId}：側 ${s0}→${s1}・反転の印 ${flippedNow}`) }
 return bad;
}
/* 半分に折った紙：y=0 で上の半分を下の半分へ（谷）。背＝y=0（x∈[-1,1]）。紙は y∈[-1,0]。 */
function halfFolded() {
 const st = E.create();
 E.proposeOnFace(st, [-1, 0], [1, 0], 'paper', { layers: 1, op: 'fold' }); st.pending.kind = 'V'; E.setSide(st, [0, .5]);
 E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' });
 return st;
}
/* 線：背の上の点 (vx,0) を通り、先（+x）の側で測った鋭角 θ。lean='tip'＝紙の中の半直線が先へ傾く／'base'＝元へ傾く。 */
function lineFor(vx, thDeg, lean) {
 const t = rad(thDeg), r = lean === 'tip' ? [Math.cos(t), -Math.sin(t)] : [-Math.cos(t), -Math.sin(t)];
 const V = [vx, 0];
 return { V, a: [V[0] + r[0] * 3, V[1] + r[1] * 3], b: [V[0] - r[0] * 3, V[1] - r[1] * 3], r };
}
/* つかむ所：くさびが鋭角の側（先へ傾く線なら +x、元へ傾く線なら −x ＝「先の側から測り直した同じ線」）。obtuse=true で鈍角の側 */
function grabPoint(st, L, obtuse = false) {
 const dir = (L.r[0] >= 0) !== obtuse ? 1 : -1, end = dir > 0 ? 1 : -1;
 for (const s of [.5, .3, .7, .15, .85, .05, .95]) for (const y of [-.1, -.3, -.5, -.05, -.7, -.9]) {
  const p = [L.V[0] + (end - L.V[0]) * s, y];
  const side = E.side(p, L.a, L.b), tipSide = E.side([L.V[0] + dir * 1e-3, -1e-4], L.a, L.b);
  if (Math.sign(side) !== Math.sign(tipSide)) continue;
  if (Math.abs(side) / dist(L.a, L.b) < .05) continue;
  if (E.stackAt(st, p).length >= 2) return p }
 return null;
}

/* ================= R1 本人の1枚模型 ================= */
{
 const base = halfFolded();
 const rows = [];
 for (const th of [90, 45, 15, 75.96375653207353]) for (const vx of [-.3, .2, .5]) for (const lean of (th === 90 ? ['tip'] : ['tip', 'base'])) {
  const label = `θ=${th.toFixed(2)}° 頂点 x=${vx} ${lean === 'tip' ? '先へ' : '元へ'}傾く`;
  const st = load(base.recipe), L = lineFor(vx, th, lean), at = grabPoint(st, L);
  assert.ok(at, `${label}：つかむ所が無い`);
  const o = E.reverseOptions(st, L.a, L.b, at);
  assert.equal(o.options.length, 1, `${label}：背の候補が1つでない（${o.options.length}・${o.reason || ''}・${JSON.stringify(o.skipped)}）`);
  assert.ok(Math.abs(o.options[0].thetaDeg - th) < 1e-6, `${label}：θ が線から取れていない（${o.options[0].thetaDeg}）`);
  let pend;
  try { pend = E.proposeReverse(st, L.a, L.b, at) } catch (e) { throw new assert.AssertionError({ message: `${label}：提案で断られた：${e.message}` }) }
  const pv = E.reversePreview(st);
  const before = C(st.cache);
  E.confirm(st);
  const step = st.recipe.steps[st.recipe.steps.length - 1];
  assert.equal(step.op, 'reverse'); assert.ok(!('kind' in step), `${label}：kind が書かれた`);
  if (DUMP) DUMP.push({ name: 'R1 ' + label, kind: 'recipe', recipe: C(st.recipe), faces: faceDump(st.cache), rev: revPairs(st.cache, step.id) });
  /* ② 同じフラップを同じ線で fold した結果と位置が一致 */
  const fo = load(base.recipe); E.proposeOnFace(fo, L.a, L.b, E.stackAt(fo, at)[0].faceId, { layers: 1, op: 'fold' }); fo.pending.kind = 'V'; E.setSide(fo, at); E.setFlap(fo, at);
  E.select(fo, fo.pending.candidates); E.confirm(fo, { op: 'fold' });
  const sp = samePositions(st.cache, fo.cache);
  assert.ok(sp.worst < 1e-9 && sp.miss < 20, `${label}：終端の位置が fold と違う（${sp.worst}・見つからない点 ${sp.miss}）`);
  /* ③ 目標の並び：4枚ぜんぶが重なる点で、下の元／下の先／上の先／上の元 */
  const low = st.cache.faces.filter(f => f.faceId.startsWith('paper/s1.keep')), up = st.cache.faces.filter(f => f.faceId.startsWith('paper/s1.cut'));
  const isTip = f => f.faceId.endsWith('.cut') && f.faceId.split('/').length === 3;
  let checked = 0;
  for (let i = 0; i < 4000 && checked < 50; i++) { const p = [rnd() * 2 - 1, -rnd()];
   const stk = E.stackAt(st, p); if (stk.length !== 4) continue;
   const lab = stk.slice().reverse().map(v => { const f = st.cache.faces.find(g => g.faceId === v.faceId); return (f.faceId.startsWith('paper/s1.keep') ? '下' : '上') + (isTip(f) ? '先' : '元') });
   assert.deepEqual(lab, ['下元', '下先', '上先', '上元'], `${label}：4枚の重なりの並びが中割りでない（${lab.join('/')}）`); checked++ }
  /* ④ 背の先の区間の反転と、静的な側の入れかわり */
  const rb = st.cache.bonds.filter(b => b.reversedBy && b.reversedBy.includes(step.id));
  assert.equal(rb.length, 1, `${label}：反転した背の区間が1本でない`);
  const rc = reversalConsistent(before, st.cache, step.id);
  assert.deepEqual(rc, [], `${label}：背の反転の印と静的な側の入れかわりが合わない：${rc.join('／')}`);
  /* ⑤ 平ら・再生・保存・undo/redo */
  checksAll(st, label, 1);
  /* ⑥ プレビュー：始まり・終わり・結び */
  const faces0 = before.faces;
  let startGap = 0, endGap = 0, bondGap = 0;
  for (const g of faces0) { const s = pv.points(0, g.faceId, g.poly); s.forEach((q, i) => { startGap = Math.max(startGap, Math.hypot(q[0] - g.poly[i][0], q[1] - g.poly[i][1], q[2])) });
   /* 終わり：面を線で分けた各部分の内側の点（重心へ6割寄せた頂点と重心）＝境界のあいまいさを避ける */
   for (const part of E.split(g.poly, L.a, L.b).filter(Boolean)) { const c = part.reduce((s, q) => [s[0] + q[0] / part.length, s[1] + q[1] / part.length], [0, 0]);
    const pts = [c, ...part.map(q => [c[0] + (q[0] - c[0]) * .6, c[1] + (q[1] - c[1]) * .6])];
    const e = pv.points(1, g.faceId, pts);
    e.forEach((q, i) => { const w = whereIs(st.cache, inv(g.xf, pts[i])); assert.ok(w, `${label}：終わりの点が見つからない`); endGap = Math.max(endGap, Math.hypot(q[0] - w.p[0], q[1] - w.p[1], q[2])) }) } }
  for (let k = 0; k <= 40; k++) { const t = k / 40; for (const b of before.bonds) { const fa = faces0.find(f => f.faceId === b.faceIds[0]), fb = faces0.find(f => f.faceId === b.faceIds[1]); if (!fa || !fb) continue;
   const pa = b.seg.map(m => apply(fa.xf, m)); const A = pv.points(t, fa.faceId, pa), B = pv.points(t, fb.faceId, pa);
   A.forEach((q, i) => { bondGap = Math.max(bondGap, Math.hypot(q[0] - B[i][0], q[1] - B[i][1], q[2] - B[i][2])) }) } }
  assert.ok(startGap < 1e-9 && endGap < 1e-9 && bondGap < 1e-9, `${label}：プレビュー 始まり ${startGap}・終わり ${endGap}・結び ${bondGap}`);
  /* 終わりの手前（t=1−1e-4）の高さの並び＝確定の層順（4枚が重なる点で） */
  let pvOrd = 0;
  for (let i = 0; i < 3000 && pvOrd < 20; i++) { const P = [rnd() * 2 - 1, -rnd()], stk = E.stackAt(st, P); if (stk.length !== 4) continue;
   /* 隣り合う2枚（下 a・上 b）：a の平面から見た b の側を、離れている時刻で読み、終わりの a の法線の向きで世界の上下へ写す（厚み0で平らに重なった組もこれで読める） */
   const loc = v => { const fa = st.cache.faces.find(f => f.faceId === v.faceId), m = inv(fa.xf, P), wb = whereIs(before, m), q = apply(faces0.find(f => f.faceId === wb.faceId).xf, m); return { id: wb.faceId, q } };
   const L3 = stk.map(loc);
   const nrm = (t, a) => { const e = 1e-3, P3 = pv.points(t, a.id, [a.q, [a.q[0] + e, a.q[1]], [a.q[0], a.q[1] + e]]);
    const u1 = [0, 1, 2].map(k => P3[1][k] - P3[0][k]), u2 = [0, 1, 2].map(k => P3[2][k] - P3[0][k]);
    const n3 = [u1[1] * u2[2] - u1[2] * u2[1], u1[2] * u2[0] - u1[0] * u2[2], u1[0] * u2[1] - u1[1] * u2[0]], L = Math.hypot(...n3); return { n: n3.map(v => v / L), p: P3[0] } };
   const times = [1 - 1e-4, 1 - 1e-3, 1 - 1e-2, .95, .9, .8, 2 / 3 - 1e-4, 2 / 3 - 1e-3, .6, .5, .45, .4];
   for (let k = 0; k + 1 < stk.length; k++) { const b = L3[k], a = L3[k + 1];
    let side = 0, tt = null;
    for (const t of times) { const A = nrm(t, a), Pb = pv.points(t, b.id, [b.q])[0], dd = A.n[0] * (Pb[0] - A.p[0]) + A.n[1] * (Pb[1] - A.p[1]) + A.n[2] * (Pb[2] - A.p[2]);
     if (Math.abs(dd) > 1e-12) { side = Math.sign(dd); tt = t; break } }
    const nEnd = nrm(1, a).n[2];
    assert.ok(side * Math.sign(nEnd) > 0, `${label}：プレビューの上下が確定の層順と違う（上 ${b.id} が下 ${a.id} の${side > 0 ? '法線の側' : '裏の側'}・t=${tt}・終わりの法線 z ${nEnd.toFixed(3)}）`) }
   pvOrd++ }
  assert.ok(pvOrd >= 5, `${label}：上下を読む点が少ない（${pvOrd}）`);
  rows.push(`${label} 位置 ${sp.worst.toExponential(1)}・並びの点 ${checked}・プレビュー 結び ${bondGap.toExponential(1)}`);
 }
 rows.forEach(r => console.log('    ' + r));
 ok(`R1 本人の1枚模型：${rows.length}例（θ 4通り × 位置3 × 傾き）すべて 候補1つ・位置＝fold・並び＝中割り・背の反転・平ら/再生/保存/undo・プレビューの両端と結び`);
}

/* ================= R3 つる⑫の紙 → ⑬（脚1・脚2） ================= */
let CRANE13 = null, CRANEDUMP = null;
{
 const CUT = JSON.parse(rd('crane13_cutline.json')), INPUT = JSON.parse(rd('crane13_input.json')), TG = JSON.parse(rd('crane13_terminal_target.json'));
 const st = load(JSON.parse(rd('crane12_state.json')).recipe);
 const tip0 = INPUT.landmarks.legTip;
 if (DUMP) CRANEDUMP = { name: 'つる ⑫→⑬脚1・脚2→⑭', kind: 'start', start: faceDump(st.cache), steps: [], results: [] };
 /* つかむ所：脚の面の、線より先の部分の重心で、いちばん上が脚の面の所 */
 const grabLeg = (s, LEG, A, B, tip) => { for (const id of LEG.faceIds) { const f = s.cache.faces.find(v => v.faceId === id); if (!f) continue;
   for (const p of E.split(f.poly, A, B).filter(Boolean)) { const c = p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]); const t = E.stackAt(s, c)[0];
    if (t && LEG.faceIds.includes(t.faceId) && E.side(c, A, B) * E.side(tip, A, B) > 0 && Math.abs(E.side(c, A, B)) / dist(A, B) > .05) return c } } return null };
 const rows = [];
 for (const legno of [1, 2]) {
  const LEG = CUT.legs.find(l => l.leg === legno), A = LEG.curLine.a, B = LEG.curLine.b, at = grabLeg(st, LEG, A, B, tip0);
  assert.ok(at, `R3 脚${legno}：つかむ所が無い`);
  const o = E.reverseOptions(st, A, B, at);
  assert.equal(o.options.length, 1, `R3 脚${legno}：背の候補が1つでない（${o.options.length}）`);
  assert.equal(o.options[0].hinge.stepId, 's2', `R3 脚${legno}：背が2手目の背でない`);
  const before = C(st.cache), recBefore = C(st.recipe);
  const t0 = Date.now(); E.proposeReverse(st, A, B, at); const ms = Date.now() - t0;
  const pv = E.reversePreview(st);
  E.confirm(st);
  const step = st.recipe.steps[st.recipe.steps.length - 1];
  /* 位置＝同じフラップを同じ線で fold */
  const fo = load(recBefore); E.proposeOnFace(fo, A, B, E.stackAt(fo, at)[0].faceId, { layers: 1, op: 'fold' }); fo.pending.kind = 'V'; E.setSide(fo, at); E.setFlap(fo, at); E.select(fo, fo.pending.candidates); E.confirm(fo, { op: 'fold' });
  const sp = samePositions(st.cache, fo.cache);
  assert.ok(sp.worst < 1e-9, `R3 脚${legno}：終端の位置が fold と違う（${sp.worst}）`);
  /* 上下＝保存した目標（脚1のときだけ。目標は脚1の⑬で作った） */
  let tg = '';
  if (legno === 1) {
   const toEng = id => { if (id.endsWith('#tip')) return id.slice(0, -4) + '/' + step.id + '.cut'; if (id.endsWith('#base')) return id.slice(0, -5) + '/' + step.id + '.keep'; return id };
   let agree = 0, dis = [], skip = 0;
   for (const [a, b, r] of TG.above) { const fa = st.cache.faces.find(f => f.faceId === toEng(a)), fb = st.cache.faces.find(f => f.faceId === toEng(b));
    if (!fa || !fb) { skip++; continue } if (!(E.overlapsArea(fa.poly, fb.poly) || E.overlapsArea(fb.poly, fa.poly))) { skip++; continue }
    const got = Math.sign(fb.layer - fa.layer); if (got === r) agree++; else dis.push(`${TG.names[a]}|${TG.names[b]}`) }
   assert.deepEqual(dis, [], `R3 脚1：目標と上下が違う組（${dis.length}）：${dis.slice(0, 8).join(' ')}`);
   assert.ok(agree >= 400, `R3 脚1：照合した組が400に届かない（${agree}・読めない ${skip}）`);
   tg = `・目標の上下 ${agree}組一致`;
  }
  const rc = reversalConsistent(before, st.cache, step.id);
  assert.deepEqual(rc, [], `R3 脚${legno}：背の反転の印と側の入れかわり：${rc.join('／')}`);
  /* A-3：根元の頂点の規則は⑬では発動しない（背の区間に反転の印が無い）＝途中の姿も規則なしの運動と同じ */
  const mH = E.reverseMotion(before, step, null, { recipe: recBefore }), m0 = E.reverseMotion(before, step);
  assert.equal(mH.root, null, `R3 脚${legno}：⑬で根元の頂点の規則が発動した`);
  for (const t of [.05, .3, .5, .8, .97]) assert.equal(JSON.stringify(mH.frame(t)), JSON.stringify(m0.frame(t)), `R3 脚${legno}：⑬の途中の姿が変わった（t=${t}）`);
  checksAll(st, `R3 脚${legno}`, 1);
  if (DUMP) { CRANEDUMP.steps.push(C(step)); CRANEDUMP.results.push({ faces: faceDump(st.cache), rev: revPairs(st.cache, step.id) }) }
  rows.push(`脚${legno}：θ=${o.options[0].thetaDeg.toFixed(4)}°・提案 ${ms}ms・位置 ${sp.worst.toExponential(1)}${tg}`);
 }
 /* A-3：⑬（脚2本）の結果は、根元の頂点の規則を足す前（2026-09-18 の engine）と1ミリも変わらない */
 const sha1 = x => require('node:crypto').createHash('sha1').update(x).digest('hex');
 assert.equal(sha1(st.cache.hash), '9c78dd42d120f9ca9d68ddb764f041db4b74fa46', 'R3 ⑬の digest が規則を足す前と違う');
 assert.equal(sha1(JSON.stringify(st.recipe)), '767ffed29a8d4ebf74bc796c1c29201939ba3053', 'R3 ⑬の原本が規則を足す前と違う');
 rows.push('⑬の digest・原本の sha1 が規則を足す前と同じ・根元の規則は発動しない（途中の姿も同じ）');
 CRANE13 = C(st.recipe);
 rows.forEach(r => console.log('    ' + r));
 ok(`R3 つる ⑫→⑬（脚1・脚2）：背は1本に自動で決まり、位置＝fold・脚1は目標の上下と全組一致・背の反転・平ら/再生/保存/undo（${st.recipe.steps.length}手）`);
}

/* ================= R2 鈍角の側をつかむと断る（突き抜け）・状態は1ミリも動かない ================= */
{
 const base = halfFolded(), msgs = [];
 for (const th of [45, 15, 75.96375653207353]) for (const vx of [-.3, .5]) {
  const st = load(base.recipe), L = lineFor(vx, th, 'tip'), at = grabPoint(st, L, true);
  assert.ok(at, 'R2 つかむ所が無い');
  const o = E.reverseOptions(st, L.a, L.b, at);
  assert.equal(o.options.length, 1, 'R2 候補が1つでない'); assert.ok(o.options[0].wedgeDeg > 90, `R2 くさびが鈍角でない（θ=${th} x=${vx} つかむ ${at} くさび ${o.options[0].wedgeDeg}）`);
  const snap = JSON.stringify({ r: st.recipe, rev: st.revision, h: st.cache.hash, p: st.pending, redo: st.redoStack || [] });
  assert.throws(() => E.proposeReverse(st, L.a, L.b, at), /突き抜け.*反対側の先をつかんでください/, `R2 θ=${th} 鈍角の側が断られない`);
  assert.equal(JSON.stringify({ r: st.recipe, rev: st.revision, h: st.cache.hash, p: st.pending, redo: st.redoStack || [] }), snap, 'R2 断ったのに状態が動いた');
  msgs.push(`${th.toFixed(1)}°/x=${vx} くさび ${o.options[0].wedgeDeg.toFixed(1)}°`) }
 ok(`R2 鈍角の側（くさび>90°）をつかむと「突き抜け」で断り、状態は不変（${msgs.join('・')}）`);
}

/* 🪝 根元の頂点といっしょに動く中割り（R4・R5 で共通の検査）
   st＝提案して確定する前の紙（pending なし）。A,B＝線・at＝つかむ所。rootId＝根元の中割りの手。
   途中は 96コマ（提案の検査の2倍の細かさ）で見る。 */
function chainCase(st, A, B, at, rootId, label, neckOf, headOf) {
 const before = C(st.cache), recBefore = C(st.recipe);
 const o = E.reverseOptions(st, A, B, at);
 assert.equal(o.options.length, 1, `${label}：背の候補が1つでない（${o.options.length}・${o.reason || ''}）`);
 assert.ok(o.options[0].wedgeDeg <= 90 + 1e-9, `${label}：くさびが鈍角（${o.options[0].wedgeDeg}）`);
 try { E.proposeReverse(st, A, B, at) } catch (e) { throw new assert.AssertionError({ message: `${label}：提案で断られた：${e.message}` }) }
 const pv = E.reversePreview(st);
 assert.ok(pv.root && pv.root.stepId === rootId, `${label}：根元の頂点の規則が発動していない（${JSON.stringify(pv.root)}）`);
 const step = st.pending.step;
 const mot = E.reverseMotion(before, step, null, { recipe: recBefore });
 assert.equal(mot.penetration(96), null, `${label}：96コマで突き抜け`);
 assert.equal(mot.tear(96), null, `${label}：96コマで裂け`);
 /* 閉路：いまの紙のすべての結び（hinge・crease）で、両側の面が結びの線の点を同じ所へ運ぶ。剛体：各部分の中の点どうしの距離が変わらない */
 let bondGap = 0, rigid = 0, startGap = 0, endGap = 0;
 const partsOf = g => E.split(g.poly, A, B).filter(Boolean).map(part => { const c = part.reduce((s, q) => [s[0] + q[0] / part.length, s[1] + q[1] / part.length], [0, 0]); return [c, ...part.slice(0, 3).map(q => [c[0] + (q[0] - c[0]) * .6, c[1] + (q[1] - c[1]) * .6])] });
 const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
 for (let k = 0; k <= 96; k++) { const t = k / 96;
  for (const b of before.bonds) { const fa = before.faces.find(f => f.faceId === b.faceIds[0]), fb = before.faces.find(f => f.faceId === b.faceIds[1]); if (!fa || !fb) continue;
   const q = b.seg.map(m => apply(fa.xf, m)), ps = [q[0], q[1], [(q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2]];
   const PA = pv.points(t, fa.faceId, ps), PB = pv.points(t, fb.faceId, ps); PA.forEach((v, i) => { bondGap = Math.max(bondGap, d3(v, PB[i])) }) }
  for (const g of before.faces) for (const pts of partsOf(g)) { const P = pv.points(t, g.faceId, pts);
   for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) rigid = Math.max(rigid, Math.abs(d3(P[i], P[j]) - dist(pts[i], pts[j]))) } }
 for (const g of before.faces) { const s0 = pv.points(0, g.faceId, g.poly); s0.forEach((q, i) => { startGap = Math.max(startGap, Math.hypot(q[0] - g.poly[i][0], q[1] - g.poly[i][1], q[2])) }) }
 E.confirm(st);
 for (const g of before.faces) for (const pts of partsOf(g)) { const e = pv.points(1, g.faceId, pts);
  e.forEach((q, i) => { const w = whereIs(st.cache, inv(g.xf, pts[i])); assert.ok(w, `${label}：終わりの点が見つからない`); endGap = Math.max(endGap, Math.hypot(q[0] - w.p[0], q[1] - w.p[1], q[2])) }) }
 assert.ok(bondGap < 1e-9, `${label}：閉路が離れる（${bondGap}）`);
 assert.ok(rigid < 1e-9, `${label}：面が剛体でない（${rigid}）`);
 assert.ok(startGap < 1e-9 && endGap < 1e-9, `${label}：プレビューの始まり ${startGap}・終わり ${endGap}`);
 const stepC = st.recipe.steps[st.recipe.steps.length - 1];
 /* 位置＝同じフラップを同じ線で折ったときの置かれ方（§9：動く面の先の部分は線での鏡・ほかは動かない）。
    頭の上に胴が乗る紙では fold の関門①が比較用の fold を断るので、その定義を直接計算する（素材点2000個） */
 const tg = new Set(stepC.targets.map(t => t.faceId)), mv = apply(before.faces.find(f => f.faceId === stepC.reference.faceId).xf, stepC.movingSidePoint);
 const refl = p => { const d = [B[0] - A[0], B[1] - A[1]], L2 = d[0] * d[0] + d[1] * d[1], t = ((p[0] - A[0]) * d[0] + (p[1] - A[1]) * d[1]) / L2, q = [A[0] + d[0] * t, A[1] + d[1] * t]; return [2 * q[0] - p[0], 2 * q[1] - p[1]] };
 let worst = 0, miss = 0;
 for (let i = 0; i < 2000; i++) { const m = [rnd() * 2 - 1, rnd() * 2 - 1], w0 = whereIs(before, m), w1 = whereIs(st.cache, m); if (!w0 || !w1) { miss++; continue }
  const moves = tg.has(w0.faceId) && E.side(w0.p, A, B) * E.side(mv, A, B) > 0, want = moves ? refl(w0.p) : w0.p;
  if (Math.abs(E.side(w0.p, A, B)) / dist(A, B) < 1e-9) continue; worst = Math.max(worst, dist(want, w1.p)) }
 const sp = { worst, miss };
 assert.ok(sp.worst < 1e-9, `${label}：終端の位置が「先は線での鏡・ほかは不動」と違う（${sp.worst}）`);
 /* 入れ子：頭の面は、その場所の首の面（2枚以上あるとき）の層のあいだにある */
 let nest = 0;
 const hb = st.cache.faces.filter(f => headOf(f.faceId)).flatMap(f => f.poly), bx = [Math.min(...hb.map(q => q[0])), Math.max(...hb.map(q => q[0]))], by = [Math.min(...hb.map(q => q[1])), Math.max(...hb.map(q => q[1]))];
 for (let i = 0; i < 20000 && nest < 40; i++) { const P = [bx[0] + rnd() * (bx[1] - bx[0]), by[0] + rnd() * (by[1] - by[0])], stk = E.stackAt(st, P);
  const neck = stk.filter(v => neckOf(v.faceId)), head = stk.filter(v => headOf(v.faceId)); if (neck.length < 2 || !head.length) continue;
  const L = id => st.cache.faces.find(f => f.faceId === id).layer, nl = neck.map(v => L(v.faceId)), lo = Math.min(...nl), hi = Math.max(...nl);
  for (const h of head) assert.ok(L(h.faceId) > lo && L(h.faceId) < hi, `${label}：頭の面が首の層のあいだに無い（${h.faceId}）`);
  nest++ }
 assert.ok(nest >= 5, `${label}：頭と首が重なる点が少ない（${nest}）`);
 const rc = reversalConsistent(before, st.cache, stepC.id);
 assert.deepEqual(rc, [], `${label}：背の反転の印と側の入れかわり：${rc.join('／')}`);
 checksAll(st, label, 2);
 return { text: `θ=${o.options[0].thetaDeg.toFixed(2)}°・根元 ${pv.root.stepId}（θ_root=${pv.root.thetaDeg.toFixed(2)}°）・閉路 ${bondGap.toExponential(1)}・剛体 ${rigid.toExponential(1)}・位置 ${sp.worst.toExponential(1)}・入れ子の点 ${nest}`, step: stepC };
}

/* ================= R4 本人の1枚模型の2手目（⑬相当 → ⑭相当） ================= */
{
 const base = halfFolded(), rows = [];
 /* 頂点の位置は、1手目の先が胴（y∈[-1,0] の半分）の外へ出るもの＝つるの首と同じく、頭をつかめる所が胴の外にある */
 for (const [th1, th2] of [[75.96375653207353, 54.46], [45, 60]]) for (const vx of [-.3, -.5, -.7]) {
  const label = `R4 θ1=${th1.toFixed(2)}° θ2=${th2}° 頂点 x=${vx}`;
  const st = load(base.recipe), L1 = lineFor(vx, th1, 'tip'), at1 = grabPoint(st, L1);
  E.proposeReverse(st, L1.a, L1.b, at1); E.confirm(st);
  const s1 = st.recipe.steps[st.recipe.steps.length - 1].id, s2 = 's' + (st.recipe.steps.length + 1);
  /* 反転した背の区間（根元＝1手目の頂点・先＝もとの (1,0)） */
  const rb = st.cache.bonds.find(b => b.reversedBy && b.reversedBy.includes(s1)), fa = st.cache.faces.find(f => f.faceId === rb.faceIds[0]);
  const seg = rb.seg.map(m => apply(fa.xf, m)), root = dist(seg[0], L1.V) < 1e-9 ? seg[0] : seg[1], tip = root === seg[0] ? seg[1] : seg[0];
  /* 頭の頂点 H：反転した背のうち胴の外へ出た部分の中ほど */
  const e = [(tip[0] - root[0]) / dist(root, tip), (tip[1] - root[1]) / dist(root, tip)], Ls = dist(root, tip);
  let sOut = 0; for (let k = 1; k <= 1000; k++) { const q = [root[0] + e[0] * Ls * k / 1000, root[1] + e[1] * Ls * k / 1000]; if (q[0] < -1 || q[0] > 1 || q[1] < -1 || q[1] > 0) { sOut = Ls * k / 1000; break } }
  assert.ok(sOut > 0 && sOut < Ls - .1, `${label}：先が胴の外へ出ない`);
  const H = [root[0] + e[0] * (sOut + (Ls - sOut) * .4), root[1] + e[1] * (sOut + (Ls - sOut) * .4)];
  /* 頭の線：H を通り、先の向き e と θ2 をなす2本のうち、つかむ側のくさびが鋭角になる方（＝先の側から測った線） */
  let got = null;
  for (const sg of [1, -1]) { const t = rad(th2) * sg, r = [e[0] * Math.cos(t) - e[1] * Math.sin(t), e[0] * Math.sin(t) + e[1] * Math.cos(t)];
   const A = [H[0] - r[0] * 3, H[1] - r[1] * 3], B = [H[0] + r[0] * 3, H[1] + r[1] * 3];
   for (const k of [.3, .5, .7, .15, .85]) for (const off of [.02, -.02, .05, -.05, .1, -.1]) { const q = [H[0] + (tip[0] - H[0]) * k - e[1] * off, H[1] + (tip[1] - H[1]) * k + e[0] * off];
    if (got || E.stackAt(st, q).length < 2 || E.side(q, A, B) * E.side(tip, A, B) <= 0) continue;
    const o = E.reverseOptions(st, A, B, q); if (o.options.length === 1 && o.options[0].wedgeDeg < 90) got = { A, B, at: q } } }
  assert.ok(got, `${label}：頭のつかむ所が無い`);
  const r = chainCase(st, got.A, got.B, got.at, s1, label, id => id.includes('/' + s1 + '.cut') && !id.includes('/' + s2 + '.cut'), id => id.includes('/' + s2 + '.cut'));
  rows.push(`${label}：${r.text}`);
  if (DUMP) DUMP.push({ name: label, kind: 'recipe', recipe: C(st.recipe), faces: faceDump(st.cache), rev: revPairs(st.cache, r.step.id) });
 }
 rows.forEach(r => console.log('    ' + r));
 ok(`R4 1枚模型の⑬→⑭：${rows.length}例すべて 根元の頂点といっしょに動き、閉路・剛体・突き抜けなし・終わり＝確定・平ら・入れ子・位置＝fold・背の反転・再生/保存/undo`);
}

/* ================= R5 つる⑭（頭） ================= */
{
 const HL = JSON.parse(rd('crane14_headline.json')), CUT = JSON.parse(rd('crane13_cutline.json'));
 assert.equal(HL.meta.symIndex, CUT.meta.symIndex, 'R5 ⑭の線と⑬の線で原紙の向きが違う');
 assert.equal(HL.meta.sourceSha1, CUT.meta.sourceSha1, 'R5 ⑭の線と⑬の線で展開図が違う');
 const st = load(CRANE13);
 /* 8本の素材の線を、⑬のあとの面の xf で「いまの位置」へ。8本とも1本の直線に乗ること */
 const cur = HL.lines.map(l => { const m = [(l.mat[0][0] + l.mat[1][0]) / 2, (l.mat[0][1] + l.mat[1][1]) / 2];
  const own = st.cache.faces.filter(f => E.inside(m, f.poly.map(p => inv(f.xf, p)))); assert.equal(own.length, 1, `R5 ⑭の線 opx#${l.opxIndex} の面が1つに決まらない`);
  return { f: own[0].faceId, seg: l.mat.map(p => apply(own[0].xf, p)) } });
 const P = cur.flatMap(c => c.seg); let a = P[0]; a = P.reduce((b, p) => dist(p, a) > dist(b, a) ? p : b, a); const b = P.reduce((q, p) => dist(p, a) > dist(q, a) ? p : q, a);
 const off = Math.max(...P.map(p => Math.abs(E.side(p, a, b)) / dist(a, b)));
 assert.ok(off < 1e-9, `R5 ⑭の8本が⑬のあとで1本の直線に乗らない（${off}）`);
 const u = [(b[0] - a[0]) / dist(a, b), (b[1] - a[1]) / dist(a, b)], A = [a[0] - u[0] * .3, a[1] - u[1] * .3], B = [b[0] + u[0] * .3, b[1] + u[1] * .3];
 /* ⑭の線がかかる首＝8本の面の⑬の手（どれも同じ1手の先の側） */
 const s13 = [...new Set(cur.map(c => (/\/(s\d+)\.cut$/.exec(c.f) || [])[1]))];
 assert.equal(s13.length, 1, `R5 ⑭の線の面が1本の首に揃わない（${s13}）`);
 const rb = st.cache.bonds.find(x => x.reversedBy && x.reversedBy.includes(s13[0])), fa = st.cache.faces.find(f => f.faceId === rb.faceIds[0]);
 const seg = rb.seg.map(m => apply(fa.xf, m));
 assert.ok(E.side(seg[0], A, B) * E.side(seg[1], A, B) < 0, 'R5 ⑭の線が首の背をまたがない');
 const V13 = CUT.legs[0].V, tip = dist(seg[0], V13) < 1e-9 ? seg[1] : seg[0];
 /* つかむ所：首の先の面で、線より先の側・線から離れた所 */
 let at = null;
 for (const c of cur) { const f = st.cache.faces.find(g => g.faceId === c.f); for (const p of E.split(f.poly, A, B).filter(Boolean)) { const q = p.reduce((s, v) => [s[0] + v[0] / p.length, s[1] + v[1] / p.length], [0, 0]);
  if (!at && E.side(q, A, B) * E.side(tip, A, B) > 0 && Math.abs(E.side(q, A, B)) / dist(A, B) > .01 && E.reverseOptions(st, A, B, q).options.length === 1) at = q } }
 assert.ok(at, 'R5 つかむ所が無い');
 const h = 's' + (st.recipe.steps.length + 1);
 const r = chainCase(st, A, B, at, s13[0], 'R5 つる⑭', id => id.includes('/' + s13[0] + '.cut') && !id.includes('/' + h + '.cut'), id => id.includes('/' + h + '.cut'));
 /* 上下は履歴（order）に任せる＝記録だけ：頭の先の面の層番号 */
 const hs = st.cache.faces.filter(f => f.faceId.includes('/' + h + '.cut')).map(f => f.layer).sort((x, y) => x - y);
 if (DUMP) { CRANEDUMP.steps.push(C(r.step)); CRANEDUMP.results.push({ faces: faceDump(st.cache), rev: revPairs(st.cache, r.step.id) }); DUMP.push(CRANEDUMP) }
 console.log(`    つる⑭：${r.text}・面 ${st.cache.faces.length}・頭の先の面の層 ${hs.join(',')}`);
 ok(`R5 つる⑫→⑬脚2本→⑭（ORIPA の線）：根元＝${s13[0]} の頂点といっしょに動き、閉路・剛体・突き抜けなし・終わり＝確定・平ら・頭は首の層のあいだ・位置＝fold・背の反転・再生/保存/undo`);
 if (process.env.ORIGAMI_WRITE_CRANE14) fs.writeFileSync(process.env.ORIGAMI_WRITE_CRANE14, JSON.stringify({ recipe: st.recipe, line: [A, B], at }, null, 1));
}

/* ================= R6 断る側（再生の芯が断ること・状態は動かない）＝壊し検査 G386・G387・G390 の相手 =================
   ① 頂点が背の外（線が背の線分をまたがない）② フラップに、背の両側のどちらにも入らない面を混ぜた原本 ③ hinge.seg が結びの素材線分と一致しない原本 */
{
 const base = halfFolded(), msgs = [];
 /* ① 背の延長の上（x=1.3）を通る線で、角のあたりをつかむ：線は紙の中を通るが、背の線分はまたがない */
 {
  const st = load(base.recipe), r = [-Math.cos(rad(45)), -Math.sin(rad(45))], V = [1.3, 0], a = [V[0] - r[0] * 3, V[1] - r[1] * 3], b = [V[0] + r[0] * 3, V[1] + r[1] * 3];
  const at = [.97, -.05];
  assert.ok(E.stackAt(st, at).length === 2 && E.side(at, a, b) * E.side([1, -.01], a, b) > 0, 'R6① つかむ所が角の側に無い');
  const snap = JSON.stringify({ r: st.recipe, h: st.cache.hash, p: st.pending });
  assert.throws(() => E.proposeReverse(st, a, b, at), /中割りにできる背がありません|線が背をまたいでいません/, 'R6① 頂点が背の外なのに断らない');
  assert.equal(JSON.stringify({ r: st.recipe, h: st.cache.hash, p: st.pending }), snap, 'R6① 断ったのに状態が動いた');
  /* 原本に直接書いても、再生の芯が断る（R1 の1例の線を、背の外を通る線に差しかえる） */
  const ok1 = load(base.recipe), L = lineFor(.2, 45, 'tip'); E.proposeReverse(ok1, L.a, L.b, grabPoint(ok1, L)); E.confirm(ok1);
  const bad = C(ok1.recipe), s = bad.steps[bad.steps.length - 1], ref = ok1.cache.faces.find(f => f.faceId.startsWith(s.reference.faceId)) && load(base.recipe).cache.faces.find(f => f.faceId === s.reference.faceId);
  s.line = [[V[0] + r[0] * .6, V[1] + r[1] * .6], [V[0] + r[0] * 1.2, V[1] + r[1] * 1.2]].map(p => inv(ref.xf, p));/* 同じ直線の上で、原紙の中にある2点 */
  s.movingSidePoint = inv(ref.xf, at);
  assert.throws(() => E.replay(bad), /線が背をまたいでいません|頂点が背の外/, 'R6① 背の外を通る線の原本を再生の芯が断らない');
  msgs.push('頂点が背の外');
 }
 /* ② つる⑭の手に、背の両側のどちらにも入らない面（尾の側）を足した原本 */
 {
  const HL = JSON.parse(rd('crane14_headline.json')), st = load(CRANE13);
  const cur = HL.lines.map(l => { const m = [(l.mat[0][0] + l.mat[1][0]) / 2, (l.mat[0][1] + l.mat[1][1]) / 2]; const f = st.cache.faces.find(g => E.inside(m, g.poly.map(p => inv(g.xf, p)))); return l.mat.map(p => apply(f.xf, p)) }).flat();
  let a = cur[0]; a = cur.reduce((b, p) => dist(p, a) > dist(b, a) ? p : b, a); const b = cur.reduce((q, p) => dist(p, a) > dist(q, a) ? p : q, a);
  const u = [(b[0] - a[0]) / dist(a, b), (b[1] - a[1]) / dist(a, b)], A = [a[0] - u[0] * .3, a[1] - u[1] * .3], B = [b[0] + u[0] * .3, b[1] + u[1] * .3];
  let at = null; for (const f of st.cache.faces) for (const p of E.split(f.poly, A, B).filter(Boolean)) { const q = p.reduce((s, v) => [s[0] + v[0] / p.length, s[1] + v[1] / p.length], [0, 0]);
   if (!at && Math.abs(E.side(q, A, B)) / dist(A, B) > .01) { const o = E.reverseOptions(st, A, B, q); if (o.options.length === 1 && o.options[0].wedgeDeg < 90) at = q } }
  E.proposeReverse(st, A, B, at); const step = C(st.pending.step); E.cancel(st);
  const ids = step.targets.map(t => t.faceId), rv = E.reverseSetup(st.cache.faces, st.cache.bonds, step, ids, ...(() => { const ref = st.cache.faces.find(f => f.faceId === step.reference.faceId); let P = apply(ref.xf, step.line[0]), Q = apply(ref.xf, step.line[1]); if (E.side(apply(ref.xf, step.movingSidePoint), P, Q) > 0) [P, Q] = [Q, P]; return [P, Q] })());
  const other = st.cache.faces.find(f => !rv.X.has(f.faceId) && !rv.Y.has(f.faceId) && E.split(f.poly, A, B).every(Boolean));
  const other2 = other || st.cache.faces.find(f => !rv.X.has(f.faceId) && !rv.Y.has(f.faceId));
  assert.ok(other2, 'R6② 背の両側に入らない面が無い');
  const bad = C(CRANE13); bad.steps.push({ ...step, targets: [...step.targets, { faceId: other2.faceId, layerPath: C(other2.layerPath) }] });
  assert.throws(() => E.replay(bad), /フラップが背でつながっていません/, 'R6② 背の両側に入らない面を混ぜた原本を再生の芯が断らない');
  msgs.push('フラップに背の外の面');
 }
 /* ③ hinge.seg を 1e-6 だけずらした原本（識別の照合で断る＝計算には使わない） */
 {
  const st = load(base.recipe), L = lineFor(-.3, 45, 'tip'); E.proposeReverse(st, L.a, L.b, grabPoint(st, L)); E.confirm(st);
  const bad = C(st.recipe); bad.steps[bad.steps.length - 1].hinge.seg[0][0] += 1e-6;
  assert.throws(() => E.replay(bad), /原本の背と一致しません/, 'R6③ seg のずれた原本を断らない');
  const same = C(st.recipe); assert.equal(E.replay(same).hash, st.cache.hash, 'R6③ ずらさない原本が同じ紙にならない');
  msgs.push('seg の不一致');
 }
 ok(`R6 断る側：${msgs.join('・')}（どれも再生の芯が名前を出して断る）`);
}

if (DUMP) fs.writeFileSync(process.env.ORIGAMI_DUMP_REVERSE, JSON.stringify(DUMP));
console.log(`\n${n} checks passed`);
