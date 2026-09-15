'use strict';
/* ✏️ 折り目だけ（op:'crease'）の「上からN枚」＝ engine の creasability（2026-09-15）。
   ★なぜ：画面は指を離したあと「この場所の重なり」の上から1枚に候補を作り直す（computeLayerPick → setLayers）。
     setLayers は折りの foldability をかけていたので、確定（confirm の crease）と再生では通る折り目を断っていた。
     つる⑦の上の三角 P→P'：上から1枚＝一番上の紙の左右の半分と凧形の外側の4面（片面へ縮めてはいない）。
     一番上の脇と2枚目の脇をつなぐ背 P-B を「動く側に残った結び＝裂け」と数えて断っていた（1〜4枚のどれでも）。
   ★見ること
     A 画面と同じ道（freeCreaseStart → freeCreaseLine → proposeOnFace → setSide → 上から1枚）で ⑦の上の三角を折り目だけで確定 → 花弁が選べる → 保存・再読込・undo/redo
     B 枚数の意味は折りと同じ：候補＝topFaces（この場所の上からN枚＋平らな折り目でつながる面）。内部の面数と枚数は別（1枚＝4面）
       折りは今までどおり断る（理由も同じ）／断っても候補を保つ
     C creasability の3つの門を合成で鳴らす：上から続けて・線が選んだ紙を分ける・平らな折り目でつながる分かれる面の取りこぼし
     D 確定（飛び飛び＝確定の段だけの決まり・操作の食い違い）と再生（取りこぼした crease・同じ対象を fold にすると断る）も同じ芯
     E 折り目を付けてそのまま折る：前半は折り目だけ・後半の折りは foldability で断り、正式状態と派生状態を保つ
   仕様：recipe_crease.md（crease は紙を動かさず折り目を記録する。実物で折って戻す過程の成立は保証しない）
   使い方： node test_crease_layers.js
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
const VW = { toScreen: p => [p[0] * 240, -p[1] * 240] }, SC = p => VW.toScreen(p);
const r7 = JSON.parse(rd('crane_step7_recipe.json')), kites = { ...r7, steps: r7.steps.slice(0, 7) };
const P = [0, 1 - Math.tan(Math.PI / 8)], Pp = [-(1 - Math.tan(Math.PI / 8)), 0];
const inward = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
/* 画面の「折り目を引く」と同じ道で候補を作る（指を離す前まで） */
function lineProposal(st, op = 'crease') {
 const a = inward(P, Pp, .04), b = inward(Pp, P, .04);
 const s = N.freeCreaseStart(st, SC(a), a, VW);
 assert.ok(s.point, '引きはじめが紙の上にならない');
 const aim = N.linePointAim(s.corners, s.guides, SC(b), b, VW, false);
 const cr = N.freeCreaseLine(st, { ...s, faceId: s.faceId }, aim.point);
 E.proposeOnFace(st, cr.line[0], cr.line[1], cr.faceId, { layers: 1, op }); st.pending.kind = 'V'; E.setSide(st, cr.sidePoint);
 return { s, aim, cr };
}
const layerOf = (st, id) => st.cache.faces.find(f => f.faceId === id).layer;

/* ================= A 画面と同じ道で ⑦の上の三角 ================= */
let savedA;
{
 const st = load(kites);
 const { s, aim } = lineProposal(st);
 assert.ok(s.snapAtCreaseEnd && aim.snapAtCreaseEnd, '引きはじめ・終わりが折り目の端（P・P\'）に吸いつかない');
 /* 指を離したあと：画面は「この場所」の重なりが2枚以上なら上から1枚に作り直す（computeLayerPick → applyLayers(1)） */
 const at = st.pending.at, stack = E.stackAt(st, at);
 assert.ok(stack.length >= 2, 'この場所が重なりになっていない（前提が変わった）');
 { const fo = load(kites); lineProposal(fo, 'fold'); const before = JSON.stringify(fo.pending);
  assert.throws(() => E.setLayers(fo, 1, fo.pending.at), /裂けます/, '同じ線の「折り」を上から1枚で断らない（前提が変わった）');
  assert.equal(JSON.stringify(fo.pending), before, '折りの判定で断ったのに候補が変わった');
  assert.equal(E.pendingCheck(fo).ok, false, '同じ線の「折り」の候補が成立してしまう') }
 assert.equal(E.pendingCheck(st).ok, true, '折り目だけの候補（提案の段）が成立しない: ' + E.pendingCheck(st).reason);
 assert.doesNotThrow(() => E.setLayers(st, 1, at), '折り目だけの上から1枚を engine が断った');
 assert.ok(E.preview(st, 180), '折り目だけのプレビューが出ない');
 const ids = st.pending.candidates.map(c => c.faceId);
 assert.equal(ids.length, 4, '上から1枚が4面（一番上の紙の左右の半分・凧形の外側）にならない');
 assert.ok(ids.every(id => layerOf(st, id) === stack[0].layer), '上から1枚に、ほかの層の紙が入った');
 const rec = E.recordable(st, ids, st.pending.reference.faceId, ...(() => { let A = st.pending.displayLine[0], B = st.pending.displayLine[1]; const f = st.cache.faces.find(x => x.faceId === st.pending.reference.faceId), sp = [f.xf[0] * st.pending.sidePoint[0] + f.xf[1] * st.pending.sidePoint[1] + f.xf[4], f.xf[2] * st.pending.sidePoint[0] + f.xf[3] * st.pending.sidePoint[1] + f.xf[5]]; if (E.side(sp, A, B) > 0) [A, B] = [B, A]; return [A, B, sp] })(), st.pending.line);
 assert.equal(rec.ok, true, '上から1枚の折り目が原本に書けない: ' + rec.reason);
 E.select(st, st.pending.candidates); E.confirm(st, { op: 'crease' });
 assert.deepEqual(st.recipe.steps.map(v => v.op).slice(5), ['crease', 'crease', 'crease']);
 assert.equal(st.cache.faces.length, 14);
 assert.equal(X.flatState(st.cache).ok, true);
 assert.equal(E.petalOptions(st).options.length, 1, '⑦のあとに花弁が選べない');
 savedA = C(E.verifiedRecipe(st));
 assert.equal(load(savedA).cache.hash, st.cache.hash);
 const h = st.cache.hash; E.undo(st); assert.equal(st.cache.hash, load(kites).cache.hash); E.redo(st); assert.equal(st.cache.hash, h);
 ok('A 画面と同じ道（P・P\' の端へ吸いつく2点 → 上から1枚）で ⑦の上の三角を折り目だけで確定 → 14面・平らな状態 → 花弁が選べる → 保存・再読込・undo/redo');
}

/* ================= B 枚数の意味は折りと同じ・折りは今までどおり ================= */
{
 const base = load(kites); lineProposal(base);
 const at = base.pending.at, layers = E.layersAt(base, at).layers;
 const f = base.cache.faces.find(x => x.faceId === base.pending.reference.faceId);
 const sp = [f.xf[0] * base.pending.sidePoint[0] + f.xf[1] * base.pending.sidePoint[1] + f.xf[4], f.xf[2] * base.pending.sidePoint[0] + f.xf[3] * base.pending.sidePoint[1] + f.xf[5]];
 let A = base.pending.displayLine[0], B = base.pending.displayLine[1]; if (E.side(sp, A, B) > 0) [A, B] = [B, A];
 const rows = [];
 for (let k = 1; k <= layers.length; k++) {
  const want = E.topFaces(base, at, k, A, B).slice().sort();
  const fo = load(kites); lineProposal(fo, 'fold');
  const keep = JSON.stringify(fo.pending);
  let foldMsg = null; try { E.setLayers(fo, k, at) } catch (e) { foldMsg = e.message }
  assert.ok(foldMsg, `上から${k}枚：折りの判定が通った（前提が変わった）`);
  assert.equal(JSON.stringify(fo.pending), keep, `上から${k}枚：折りで断ったのに候補が変わった`);
  const st = load(kites); lineProposal(st);
  assert.doesNotThrow(() => E.setLayers(st, k, at), `折り目だけの上から${k}枚を engine が断った`);
  const got = st.pending.candidates.map(c => c.faceId).sort();
  assert.deepEqual(got, want, `上から${k}枚：折り目だけの候補が topFaces と違う`);
  const here = E.stackAt(st, at).filter(v => got.includes(v.faceId)).map(v => v.layer);
  assert.deepEqual(here, layers.slice(0, k), `上から${k}枚：この場所の上から${k}層になっていない`);
  rows.push(`${k}枚=${got.length}面`);
 }
 ok(`B 枚数の意味は折りと同じ（候補＝topFaces・この場所の上からN層）：${rows.join('・')}／折りは今までどおり断り、候補を保つ`);
}

/* ================= C creasability の門（合成） ================= */
{
 const st = load(kites); lineProposal(st);
 const at = st.pending.at, stack = E.stackAt(st, at);
 const f = st.cache.faces.find(x => x.faceId === st.pending.reference.faceId);
 const sp = [f.xf[0] * st.pending.sidePoint[0] + f.xf[1] * st.pending.sidePoint[1] + f.xf[4], f.xf[2] * st.pending.sidePoint[0] + f.xf[3] * st.pending.sidePoint[1] + f.xf[5]];
 let A = st.pending.displayLine[0], B = st.pending.displayLine[1]; if (E.side(sp, A, B) > 0) [A, B] = [B, A];
 const all = E.topFaces(st, at, E.layersAt(st, at).layers.length, A, B);
 const top1 = E.topFaces(st, at, 1, A, B), top2 = E.topFaces(st, at, 2, A, B);
 assert.equal(E.creasability(st, top1, A, B, at).ok, true);
 /* 上から続けて：2層目だけ（1層目を飛ばす） */
 const onlySecond = top2.filter(id => !top1.includes(id));
 assert.match(E.creasability(st, onlySecond, A, B, at).reason || '', /上から続けて/);
 /* 線が分けない：分かれない面だけ（凧形の外側の片） */
 const cuts = id => { const g = st.cache.faces.find(x => x.faceId === id), p = E.split(g.poly, A, B); return !!(p[0] && p[1] && E.area(p[0]) > 1e-9 && E.area(p[1]) > 1e-9) };
 const uncut = top1.filter(id => !cuts(id));
 assert.ok(uncut.length, '分かれない面が無い（合成の前提）');
 assert.match(E.creasability(st, uncut, A, B, at).reason || '', /二つに分けていません/);
 /* 取りこぼし：分かれる面を片方だけ（平らな対角の折り目でつながる左右の半分の片側） */
 const cutOnes = top1.filter(cuts);
 assert.equal(cutOnes.length, 2, '一番上の紙で分かれる面が左右の2面でない');
 assert.match(E.creasability(st, [cutOnes[0]], A, B, at).reason || '', /途切れます/);
 void all; void stack;
 ok('C creasability：上から続けて／線が選んだ紙を分ける／平らな折り目でつながる分かれる面の取りこぼし を合成で鳴らす');

 /* ================= D 確定と再生も同じ芯（画面や枚数選びだけの決まりにしない） ================= */
 /* D1 確定：取りこぼした候補（左右の片側だけ）を折り目だけで確定しようとすると、confirm が断る。正式状態と候補は変わらない */
 {
  /* 確定の段だけにある決まり（その場所で上から続けて選ぶ）で鳴らす＝再生（場所を持たない）では鳴らない形。
     候補を「2層目だけ」（1層目を飛ばす）にし、基準の面もその中へ差しかえる。 */
  const s1 = load(kites); lineProposal(s1);
  s1.pending.candidates = onlySecond.map(id => ({ faceId: id, layerPath: C(s1.cache.faces.find(x => x.faceId === id).layerPath) }));
  const ref2 = onlySecond.find(id => E.stackAt(s1, at).some(v => v.faceId === id)) || onlySecond[0];
  const rf = s1.cache.faces.find(x => x.faceId === ref2);
  s1.pending.reference = { faceId: ref2 };
  s1.pending.line = s1.pending.displayLine.map(q => { const d = rf.xf[0] * rf.xf[3] - rf.xf[1] * rf.xf[2], x = q[0] - rf.xf[4], y = q[1] - rf.xf[5]; return [(rf.xf[3] * x - rf.xf[1] * y) / d, (-rf.xf[2] * x + rf.xf[0] * y) / d] });
  { const d = rf.xf[0] * rf.xf[3] - rf.xf[1] * rf.xf[2], x = at[0] - rf.xf[4], y = at[1] - rf.xf[5]; s1.pending.sidePoint = [(rf.xf[3] * x - rf.xf[1] * y) / d, (-rf.xf[2] * x + rf.xf[0] * y) / d] }
  E.select(s1, s1.pending.candidates);
  const keep = JSON.stringify({ r: s1.recipe, rev: s1.revision, h: s1.cache.hash, p: s1.pending });
  assert.throws(() => E.confirm(s1, { op: 'crease' }), (e) => { console.log('    D1 の理由：' + e.message); return /上から続けて/.test(e.message) && !/JSON再生/.test(e.message) }, 'D1 飛び飛びの折り目だけを confirm が通した');
  assert.equal(JSON.stringify({ r: s1.recipe, rev: s1.revision, h: s1.cache.hash, p: s1.pending }), keep, 'D1 断ったのに正式状態か候補が変わった');
 }
 /* D2 再生：原本の crease の targets を片側だけにすると、再生が断る */
 {
  const rr = C(savedA), k = rr.steps.length - 1;
  const one = rr.steps[k].targets.filter(t => cuts(t.faceId)).slice(0, 1);
  const ref = rr.steps[k].reference.faceId;
  rr.steps[k].targets = one.some(t => t.faceId === ref) ? one : [...one, rr.steps[k].targets.find(t => t.faceId === ref)];
  assert.throws(() => E.replay(rr), (e) => { console.log('    D2 の理由：' + e.message); return /途切れます/.test(e.message) }, 'D2 取りこぼした crease の原本を再生が通した');
 }
 /* D3 同じ対象を fold の手にすると、再生が折りの判定で断る（crease では通る） */
 {
  const rr = C(savedA), k = rr.steps.length - 1;
  assert.doesNotThrow(() => E.replay(rr), 'D3 crease の原本が再生できない');
  rr.steps[k] = { ...rr.steps[k], op: 'fold', instruction: '選んだ面を谷折りする' };
  assert.throws(() => E.replay(rr), (e) => { console.log('    D3 の理由：' + e.message); return /裂けます|乗っている|敷かれている/.test(e.message) }, 'D3 同じ対象の fold を再生が通した');
 }
 /* D4 候補の操作と確定の操作が違えば断る（折り目だけの候補を折りとして確定しない） */
 {
  const s4 = load(kites); lineProposal(s4); E.setLayers(s4, 1, s4.pending.at); E.select(s4, s4.pending.candidates);
  assert.throws(() => E.confirm(s4, { op: 'fold' }), /候補は折り目だけなのに/, 'D4 折り目だけの候補を折りとして確定できた');
 }
 ok('D 確定（取りこぼし・操作の食い違い）と再生（取りこぼした crease・同じ対象の fold）も同じ芯で断る／断っても正式状態と候補を保つ');
}

/* ================= E 折り目を付けてそのまま折る：前半は折り目だけ、後半の折りは必ず foldability ================= */
{
 const st = load(kites);
 /* 同じ線を「折り」で提案（画面の「この折り目で折る」と同じ入口） */
 lineProposal(st, 'fold');
 const derived = E.stage(st, 'V');
 assert.equal(derived.recipe.steps[derived.recipe.steps.length - 1].op, 'crease', 'E 前半が折り目だけにならない');
 /* 後半：折る側を指す → 折りの候補（op:'fold'）→ foldability で断る（上の三角だけを折ると背が裂ける） */
 E.stageSide(derived, [-0.25, 0.2]);
 assert.equal(derived.pending.op, 'fold', 'E 後半の候補が折りになっていない');
 const keepState = JSON.stringify({ r: st.recipe, rev: st.revision, h: st.cache.hash });
 const keepDerived = JSON.stringify({ r: derived.recipe, p: derived.pending });
 assert.throws(() => E.confirmStaged(st, derived, { op: 'fold' }), /裂けます|乗っている|敷かれている/, 'E 後半の折りが foldability を通らずに確定した');
 assert.equal(JSON.stringify({ r: st.recipe, rev: st.revision, h: st.cache.hash }), keepState, 'E 断ったのに正式状態が変わった');
 assert.equal(JSON.stringify({ r: derived.recipe, p: derived.pending }), keepDerived, 'E 断ったのに派生状態が変わった');
 ok('E 折り目を付けてそのまま折る：前半は折り目だけ（creasability）・後半の折りは foldability で断り、正式状態と派生状態を保つ');
}
console.log(`\n${n} checks passed`);
