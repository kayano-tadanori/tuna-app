// つる⑦を「実際に折って開く」工程で試す（engine・fold の判定は既存のまま）。どこで・なぜ断られるかを並べる。
const fs = require('fs'), vm = require('vm');
const T = 'C:/Users/User/Desktop/Claude/tuna app/lab/origami/tools/';
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'petal_v2.js', 'fold_crossing.js']) vm.runInThisContext(fs.readFileSync(T + f, 'utf8'));
SquashV2.useV1Validator(OrigamiRecipe.validate, JSON.parse(fs.readFileSync(T + 'origami_recipe.schema.json', 'utf8')));
const E = FreeFoldEngine, C = x => JSON.parse(JSON.stringify(x));
const r7 = JSON.parse(fs.readFileSync(T + 'crane_step7_recipe.json', 'utf8'));
const prelim = { ...r7, steps: r7.steps.slice(0, 5) };
const load = r => { const st = E.create(); st.recipe = C(r); st.cache = E.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache; return st };
const nm = id => id.replace('paper/', '');
const t8 = Math.tan(Math.PI / 8), Q = [-1, 1], O = [0, 0], P = [0, 1 - t8], Pp = [-(1 - t8), 0], M = [(P[0] + Pp[0]) / 2, (P[1] + Pp[1]) / 2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/* 1手の折り（fold）を、提案→折る側→上からN枚→確定。成立しなければ理由 */
function tryFold(st, a, b, side, n, kind, op = 'fold') {
 const s = C(st.recipe), top = E.stackAt(st, side)[0];
 if (!top) return { ok: false, reason: 'その場所に紙がない' };
 try {
  E.proposeOnFace(st, a, b, top.faceId, { layers: 1, op }); st.pending.kind = kind; E.setSide(st, side);
  const L = E.layersAt(st, side).layers.length;
  if (n > 1 || L > 1) E.setLayers(st, n, st.pending.at);
  const chk = E.pendingCheck(st); if (!chk.ok) { E.cancel(st); return { ok: false, reason: chk.reason, blocking: (chk.blocking || []).map(nm) } }
  E.select(st, st.pending.candidates); E.confirm(st, { op });
  return { ok: true, faces: st.cache.faces.length };
 } catch (e) { if (st.pending) E.cancel(st); return { ok: false, reason: e.message } }
}
const sweep = (label, mk, a, b, sides) => {
 console.log('\n== ' + label);
 for (const [sl, sp] of sides) for (const kind of ['V', 'M']) {
  const base = mk(); const L = E.layersAt(base, sp).layers.length; const row = [];
  for (let n = 1; n <= Math.max(1, L); n++) { const st = mk(); const r = tryFold(st, a, b, sp, n, kind); row.push(`${n}:${r.ok ? 'OK' : r.reason.slice(0, 22)}`) }
  console.log(`  ${sl} ${kind}（この場所 ${L}層）: ` + row.join(' | '));
 }
};
/* ① 凧形（右）：開いた角 Q から、横の角 B へのふち（Q-B）を対角の折り目へ合わせる軸＝Q と P を通る線。動く側＝B の側 */
const kiteR = [Q, P], kiteL = [Q, Pp];
const sideR = [(Q[0] + P[0] + 0 + 0) / 3 + 0.05, (Q[1] + P[1] + 1) / 3], sideL = [(Q[0] + Pp[0] - 1) / 3, (Q[1] + Pp[1] + 0) / 3 + 0.05];
sweep('① 凧形・右（Q-P で B 側を中へ）', () => load(prelim), kiteR[0], kiteR[1], [['B側', sideR]]);
/* 凧形を右・左とも折った紙（折れた枚数で） */
function kitesFolded(nR, nL, kind = 'V') {
 const st = load(prelim);
 const a = tryFold(st, kiteR[0], kiteR[1], sideR, nR, kind); if (!a.ok) return { st, fail: 'R ' + a.reason };
 const b = tryFold(st, kiteL[0], kiteL[1], sideL, nL, kind); if (!b.ok) return { st, fail: 'L ' + b.reason };
 return { st };
}
for (const [nR, nL] of [[1, 1], [2, 2]]) { const k = kitesFolded(nR, nL); console.log(`  凧形を 右${nR}枚・左${nL}枚：`, k.fail || 'OK（面 ' + k.st.cache.faces.length + '）') }
/* ② 凧形を折った紙で、上の三角（P-P'）を折り下げる：動く側＝O 側（閉じた角の三角）。枚数・山谷の総当り */
const sideO = [-0.14, 0.24];
sweep('② 凧形（上から2枚）を折ったあと、上の三角 P-P\' を折る（動く側 O）', () => kitesFolded(2, 2).st, P, Pp, [['O側', sideO]]);
sweep('②\' 凧形を折らずに、上の三角 P-P\' を折る（工程順の違いを見る）', () => load(prelim), P, Pp, [['O側', sideO]]);
/* ③ 成立した組合せがあれば、開く：上の三角を戻す → 凧形を戻す（同じ線で逆へ折る＝背を開く） */
function unfoldProbe(n7, kind7) {
 const k = kitesFolded(2, 2); if (k.fail) return console.log('  凧形で止まる', k.fail);
 const st = k.st; const r = tryFold(st, P, Pp, sideO, n7, kind7);
 if (!r.ok) return console.log(`  上の三角 ${n7}枚 ${kind7}：`, r.reason);
 console.log(`  上の三角 ${n7}枚 ${kind7}：OK → 開く`);
 /* 開く：いま三角が乗っている側（Q 側へ倒れた O の像）を指して、同じ線で折り戻す */
 const Oimg = [2 * M[0] - O[0], 2 * M[1] - O[1]], back = [-0.46, 0.36];
 const hs = E.hingeIntervals(st).filter(h => h.seg && dist(h.seg[0], P) + dist(h.seg[1], Pp) < 1e-6 || h.seg && dist(h.seg[1], P) + dist(h.seg[0], Pp) < 1e-6);
 console.log('   P-P\' の背：', hs.length, '本');
 for (const h of hs.slice(0, 1)) { try { const q = E.proposeOpen(st, E.hingeIntent(st, h.intervalId), back); console.log('   背を開く 提案OK', q.candidates.length + '面'); const c = E.pendingCheck(st); console.log('   成立', c.ok, c.reason || ''); if (c.ok) { E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' }); console.log('   開いた：面', st.cache.faces.length) } else E.cancel(st) } catch (e) { console.log('   背を開く：', e.message); if (st.pending) E.cancel(st) } }
}
console.log('\n== ③ 開く');
for (const n of [1, 2, 3, 4]) for (const kd of ['V', 'M']) unfoldProbe(n, kd);

/* ④ 診断：上の三角の側に面積がある面を「ぜんぶ」選んだら、fold の判定（foldability）は通るか。枚数ごとの断りの中身も出す */
console.log('\n== ④ 診断（UI の枚数選びを通さず、判定だけを見る）');
for (const pre of ['凧形なし', '凧形あり']) {
 const st = pre === '凧形なし' ? load(prelim) : kitesFolded(2, 2).st;
 let A = P, B = Pp; if (E.side(sideO, A, B) > 0) [A, B] = [B, A];
 const moveArea = f => { const c = E.split(f.poly, A, B)[1]; return !!(c && E.area(c) > 1e-9) };
 const all = st.cache.faces.filter(moveArea).map(f => f.faceId);
 for (const kind of ['V', 'M']) {
  const r = E.foldability(st, all, A, B, kind, sideO);
  console.log(`  ${pre} ${kind}：上の三角の側の面ぜんぶ（${all.length}面）→`, r.ok ? 'OK' : r.reason + ' blocking ' + r.blocking.map(nm).join(','));
 }
 for (let n = 1; n <= 4; n++) { const ids = E.topFaces(st, sideO, n, A, B); const r = E.foldability(st, ids, A, B, 'V', sideO);
  const missing = all.filter(id => !ids.includes(id));
  console.log(`   上から${n}枚＝${ids.length}面（ぜんぶのうち選ばれない ${missing.length}面）→ ${r.ok ? 'OK' : r.reason.slice(0, 20)}｜blocking ${(r.blocking || []).map(nm).join(',')}`) }
}
/* ⑤ 全部を折れたら、開く（同じ線の背を開く）→ 凧形も開く → 面・結び・花弁の認識を⑦（折り目だけ）と比べる */
console.log('\n== ⑤ 折って開く');
{
 const k = kitesFolded(2, 2), st = k.st;
 let A = P, B = Pp; if (E.side(sideO, A, B) > 0) [A, B] = [B, A];
 const all = st.cache.faces.filter(f => { const c = E.split(f.poly, A, B)[1]; return !!(c && E.area(c) > 1e-9) });
 const top = E.stackAt(st, sideO)[0];
 E.proposeOnFace(st, P, Pp, top.faceId, { layers: 1, op: 'fold' }); st.pending.kind = 'V'; E.setSide(st, sideO);
 st.pending.candidates = all.map(f => ({ faceId: f.faceId, layerPath: C(f.layerPath) }));
 const c = E.pendingCheck(st); console.log('  上の三角を全部の層で折る：', c.ok ? 'OK' : c.reason);
 if (c.ok) {
  E.select(st, st.pending.candidates);
  try { E.confirm(st, { op: 'fold' }); console.log('  確定 → 面', st.cache.faces.length, '手', st.recipe.steps.map(s => s.op).join(',')) } catch (e) { console.log('  確定で断る：', e.message) }
  const hs = E.hingeIntervals(st).filter(h => h.seg && h.consistent).map(h => ({ id: h.intervalId, seg: h.seg.map(p => p.map(v => +v.toFixed(3))) }));
  console.log('  いま見えている背：', JSON.stringify(hs).slice(0, 400));
 }
}

/* ⑥ 凧形2本（上から2枚）→ 上の三角（その側の面ぜんぶ）→ 開く（上の三角 → 凧形 左 → 凧形 右）を engine の「背を開く」で */
console.log('\n== ⑥ 折って開く（背を開く）');
{
 const k = kitesFolded(2, 2), st = k.st;
 let A = P, B = Pp; if (E.side(sideO, A, B) > 0) [A, B] = [B, A];
 const all = st.cache.faces.filter(f => { const c = E.split(f.poly, A, B)[1]; return !!(c && E.area(c) > 1e-9) });
 E.proposeOnFace(st, P, Pp, E.stackAt(st, sideO)[0].faceId, { layers: 1, op: 'fold' }); st.pending.kind = 'V'; E.setSide(st, sideO);
 st.pending.candidates = all.map(f => ({ faceId: f.faceId, layerPath: C(f.layerPath) }));
 E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' });
 const steps = () => st.recipe.steps.map(s => s.op).join(',');
 const openStep = (stepId, label) => {
  const hs = E.hingeIntervals(st).filter(h => h.stepId === stepId && h.consistent);
  if (!hs.length) { console.log(`  ${label}：${stepId} の見えている背が無い（背の一覧 ${[...new Set(E.hingeIntervals(st).map(h => h.stepId))].join(',')}）`); return false }
  const errs = [];
  for (const h of hs) {
   /* 開く側の点：その背でつながる面のうち、この手で動いた側（layerPath に stepId.cut を持つ面）の中の点 */
   for (const f of st.cache.faces.filter(f => f.layerPath.some(q => q.stepId === stepId && q.side === 'cut'))) {
    const c = f.poly.reduce((s, p) => [s[0] + p[0] / f.poly.length, s[1] + p[1] / f.poly.length], [0, 0]);
    try { E.proposeOpen(st, E.hingeIntent(st, h.intervalId), c);
     const chk = E.pendingCheck(st);
     if (!chk.ok) { errs.push(chk.reason.slice(0, 30)); E.cancel(st); continue }
     E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' });
     console.log(`  ${label}：開いた（${h.intervalId}・${st.pending === null ? '' : ''}面 ${st.cache.faces.length}）`); return true }
    catch (e) { errs.push(e.message.slice(0, 40)); if (st.pending) E.cancel(st) }
   }
  }
  console.log(`  ${label}：開けない｜${[...new Set(errs)].join('｜')}`); return false;
 };
 const s8 = st.recipe.steps[7].id, s6 = st.recipe.steps[5].id, s7 = st.recipe.steps[6].id;
 openStep(s8, '上の三角を開く') && openStep(s7, '凧形（2本目）を開く') && openStep(s6, '凧形（1本目）を開く');
 console.log('  手：', steps());
 const kinds = {}; for (const b of st.cache.bonds) kinds[b.kind] = (kinds[b.kind] || 0) + 1;
 console.log('  結びの種類：', JSON.stringify(kinds), ' 面', st.cache.faces.length);
 const rec = PetalV2.recognize(st.cache); console.log('  花弁の認識：', rec.bindings.length, rec.reason || '');
 const ref = load(r7).cache;
 console.log('  ⑦（折り目だけ）の面', ref.faces.length, ' 結び', JSON.stringify(ref.bonds.reduce((o, b) => (o[b.kind] = (o[b.kind] || 0) + 1, o), {})));
 /* 同じ位置・同じ置かれ方の紙か（素材の形の集合で） */
 const key = c => c.faces.map(f => JSON.stringify([f.xf.map(v => +v.toFixed(6)), f.poly.map(p => p.map(v => +v.toFixed(6))).sort()])).sort();
 const a = key(st.cache), b = key(ref); console.log('  置かれ方の一致：', JSON.stringify(a) === JSON.stringify(b) ? '同じ' : `違う（折って開いた ${a.length} 面・折り目だけ ${b.length} 面）`);
}

/* ⑦ 折って開いた紙を、⑦（折り目だけ）の紙と面ごとに比べる：素材の点を含む⑦の面と xf・層の上下が同じか／開いた線の結びの種類 */
console.log('\n== ⑦ 折って開いた紙 と 折り目だけの⑦ の比較');
{
 const k = kitesFolded(2, 2), st = k.st;
 let A = P, B = Pp; if (E.side(sideO, A, B) > 0) [A, B] = [B, A];
 const all = st.cache.faces.filter(f => { const c = E.split(f.poly, A, B)[1]; return !!(c && E.area(c) > 1e-9) });
 E.proposeOnFace(st, P, Pp, E.stackAt(st, sideO)[0].faceId, { layers: 1, op: 'fold' }); st.pending.kind = 'V'; E.setSide(st, sideO);
 st.pending.candidates = all.map(f => ({ faceId: f.faceId, layerPath: C(f.layerPath) })); E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' });
 for (const sid of [st.recipe.steps[7].id, st.recipe.steps[6].id, st.recipe.steps[5].id]) {
  const h = E.hingeIntervals(st).find(h => h.stepId === sid && h.consistent);
  const f = st.cache.faces.find(f => f.layerPath.some(q => q.stepId === sid && q.side === 'cut'));
  const c = f.poly.reduce((s, p) => [s[0] + p[0] / f.poly.length, s[1] + p[1] / f.poly.length], [0, 0]);
  E.proposeOpen(st, E.hingeIntent(st, h.intervalId), c); E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' });
 }
 const ref = load(r7).cache;
 const inv = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
 let xfSame = 0, xfDiff = 0; const map = new Map();
 for (const f of st.cache.faces) {
  const mp = f.poly.map(p => inv(f.xf, p)), c = mp.reduce((s, p) => [s[0] + p[0] / mp.length, s[1] + p[1] / mp.length], [0, 0]);
  const g = ref.faces.find(g => { const gp = g.poly.map(p => inv(g.xf, p)); return E.inside(c, gp) });
  map.set(f.faceId, g && g.faceId);
  if (g && f.xf.every((v, i) => Math.abs(v - g.xf[i]) < 1e-9)) xfSame++; else xfDiff++;
 }
 console.log('  置かれ方（xf）：⑦の対応する面と同じ', xfSame, '・違う', xfDiff);
 /* 重なる2面の上下が、⑦の対応する面の上下と矛盾しないか */
 let orderOk = 0, orderBad = 0;
 for (const a of st.cache.faces) for (const b of st.cache.faces) {
  if (a.faceId >= b.faceId || !E.overlapsArea(a.poly, b.poly)) continue;
  const ga = ref.faces.find(g => g.faceId === map.get(a.faceId)), gb = ref.faces.find(g => g.faceId === map.get(b.faceId));
  if (!ga || !gb || ga === gb) continue;
  if (Math.sign(a.layer - b.layer) === Math.sign(ga.layer - gb.layer)) orderOk++; else orderBad++;
 }
 console.log('  重なる2面の上下：⑦と同じ', orderOk, '・逆', orderBad);
 const flatHinges = st.cache.bonds.filter(b => { if (b.kind !== 'hinge') return false; const x = st.cache.faces.find(f => f.faceId === b.faceIds[0]), y = st.cache.faces.find(f => f.faceId === b.faceIds[1]); return x.xf.every((v, i) => Math.abs(v - y.xf[i]) < 1e-9) });
 console.log('  種類は hinge なのに両側の置かれ方が同じ（平らに開いた）結び：', flatHinges.length, '本（stepId', [...new Set(flatHinges.map(b => b.stepId))].join(','), '）');
}
