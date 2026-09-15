'use strict';
/* engine の共通入口で v1／v2 を扱う検査（袋折り＝つる③の候補・確定・undo/redo・保存・再読込）。
   ⛔ UI は変えていない。UI で袋を選ぶ操作と非貫通の検証は次の段階。
   使い方： node test_squash_engine.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const src = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js']) vm.runInThisContext(src(f));
const E = FreeFoldEngine, V = SquashV2;
const SCHEMA = JSON.parse(src('origami_recipe.schema.json'));
const C = x => JSON.parse(JSON.stringify(x));
const det = x => x[0] * x[3] - x[1] * x[2];
const throws = (fn, re, msg) => assert.throws(fn, e => { assert.match(e.message, re, msg + '｜出た理由: ' + e.message); return true }, msg);
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const J = JSON.parse(src('squash_tsuru3_v2.json'));
const V1_OF_J = { ...C(J), version: 1, steps: C(J.steps.slice(0, 2)) };
/* 原本から state を作る（既存の engine 検査と同じ読みこみ方）。 */
const load = r => { const st = E.create(); st.recipe = C(r); st.cache = E.replay(st.recipe);
 st.cacheRevision = st.revision; st.committed = st.recipe.steps.length ? st.cache : null; return st };
/* 正式な状態と候補をまとめて写す（失敗しても1ミリも動かないことを見る）。 */
const snap = st => JSON.stringify({ recipe: st.recipe, revision: st.revision, hash: st.cache.hash,
 redo: st.redoStack, pending: st.pending, committed: st.committed ? st.committed.hash : null });
const facesOf = cache => cache.faces.map(f => ({ id: f.faceId, path: f.layerPath, side: Math.sign(det(f.xf)), layer: f.layer,
 poly: f.poly.map(p => p.map(v => Math.round(v * 1e9) / 1e9 + 0)) }));

/* ================= 0 入口は1本・内部経路と外部入口を分ける（構造） ================= */
{
 const eng = src('freefold_engine.js'), v2 = src('squash_v2.js');
 assert.equal((eng.match(/function replay\(/g) || []).length, 1, '0 engine に replay の定義が1つでない');
 assert.equal((eng.match(/replayV1\(/g) || []).length, 2, '0 replayV1 を呼ぶのが「定義」と「共通入口の v1」以外にある');
 assert.match(eng, /V2\.replayWith\(recipe,replayV1\)/, '0 v2 の中の通常の手に内部の再生器を渡していない');
 assert.equal('replayV1' in E, false, '0 内部の再生器を外へ出している');
 for (const fn of ['sync', 'confirm', 'flip', 'undo', 'redo', 'verifiedRecipe', 'proposeSquash', 'confirmSquash', 'confirmStaged', 'confirmStagedFold']) {
  const body = eng.slice(eng.indexOf(`function ${fn}(`), eng.indexOf('\nfunction ', eng.indexOf(`function ${fn}(`) + 1));
  assert.equal(body.length > 0, true, '0 ' + fn + ' が読めない');
  assert.equal(/replayV1\(/.test(body), false, '0 ' + fn + ' が共通入口を通らず v1 の再生器を直に呼ぶ');
 }
 const code = v2.replace(/\/\*[\s\S]*?\*\//g, '');
 assert.equal((code.match(/E\(\)\.replay\(/g) || []).length, 0, '0 v2 が engine の入口 replay を呼んでいる（循環の道）');
 const inner = code.slice(code.indexOf('function replayWith('), code.indexOf('function replay('));
 assert.equal(/replayDetail|E\(\)\./.test(inner), false, '0 内部経路 replayWith が engine を呼んでいる');
}
ok('入口は engine.replay 1本／v2 の中の手は引数の内部再生器へ／v2 は engine の入口を呼び戻さない');

/* ================= 1 共通入口の振り分け ================= */
V.useV1Validator(OrigamiRecipe.validate, SCHEMA);
throws(() => E.replay(null), /原本が読めません/, '1 null を断らない');
throws(() => E.replay({ ...V1_OF_J, version: 3 }), /知らない version/, '1 version 3 を断らない');
throws(() => E.replay({ ...V1_OF_J, version: '1' }), /知らない version/, '1 文字列の version を断らない');
{ const r = C(V1_OF_J); delete r.version; throws(() => E.replay(r), /知らない version/, '1 version 欠落を断らない') }
throws(() => E.replay({ ...V1_OF_J, format: 'origami' }), /format が origami-recipe ではありません/, '1 v1 の format 違いを断らない');
{ const r = C(V1_OF_J); delete r.format; throws(() => E.replay(r), /format が origami-recipe ではありません/, '1 v1 の format 欠落を断らない') }
/* v2 の format は v2 側が既存の検証器に渡して断る（入口で二重に見ない）。 */
throws(() => E.replay({ ...C(J), format: 'origami' }), /前後の手（v1）.*format: expected origami-recipe/, '1 v2 の format 違いを断らない');
/* v1 の再生結果は入口を通しても同じ／v1 の hash に袋折りの項目は混ざらない。 */
const c1 = E.replay(V1_OF_J);
assert.equal(c1.faces.length, 4, '1 v1 の2手が4枚にならない');
assert.equal('squash' in c1, false, '1 v1 の cache に squash がある');
assert.equal(/"squash"|"opened"/.test(c1.hash), false, '1 v1 の hash に袋折りの項目が混ざった');
throws(() => E.replay({ ...C(J), version: 1 }), /知らない操作です/, '1 v1 の原本に squash があっても断らない');
ok('version 1→format を見て v1／2→v2／ほかは断る。v1 に squash は入らない');

/* v2 の再生器が無い画面（freefold3d.html と同じ読みこみ）では、v2 を理由つきで断り、v1 はそのまま読める。 */
{
 const ctx = vm.createContext({});
 vm.runInContext(src('freefold_engine.js'), ctx);
 const r = vm.runInContext('FreeFoldEngine', ctx);
 assert.throws(() => r.replay(C(J)), /version 2 の再生器（squash_v2.js）が読みこまれていません/, '1 v2 の再生器なしで v2 を読んでしまう');
 assert.equal(r.replay(C(V1_OF_J)).hash, c1.hash, '1 v2 の再生器なしの画面で v1 の結果が変わる');
}
ok('v2 の再生器を読まない画面では v2 を断り、v1 は同じ結果');

/* 循環の見張り＝入口の中から入口を呼んだら断る（合成入力で直接鳴らす）。 */
{
 const real = globalThis.SquashV2;
 globalThis.SquashV2 = { ...real, replayWith: (recipe) => ({ cache: E.replay({ ...recipe, version: 1, steps: [] }), squash: null }) };
 try { throws(() => E.replay(C(J)), /入口が循環しました/, '1 入口の再入を断らない') }
 finally { globalThis.SquashV2 = real }
 assert.equal(E.replay(C(J)).faces.length, 6, '1 循環を断ったあと入口が戻らない');
 /* 内部経路は、渡された器だけで再生する（engine の入口を止めても動く）。 */
 const saved = E.replayDetail, savedR = E.replay; let calls = 0;
 E.replayDetail = E.replay = () => { throw Error('入口を呼んだ') };
 let got;
 try {
  const ctx = vm.createContext({});
  vm.runInContext(src('freefold_engine.js'), ctx);
  const inner = recipe => { calls++; assert.equal(recipe.version, 1, '1 内部の器へ version 1 以外を渡した'); return vm.runInContext('FreeFoldEngine', ctx).replay(recipe) };
  got = V.replayWith(C(J), inner);
 } finally { E.replayDetail = saved; E.replay = savedR }
 assert.equal(calls, 1, '1 内部の器が1回呼ばれていない: ' + calls);
 assert.equal(got.squash.faces.length, 6, '1 内部経路だけで袋折りを再生できない');
}
ok('入口の再入を断る／v2 の内部経路は渡された器だけで再生する');

/* ================= 2 袋折りの候補＝検証ずみのつる③だけ・候補だけでは原本は変わらない ================= */
const st = load(V1_OF_J);
const s0 = snap(st);
const p = E.proposeSquash(st);
assert.equal(p.inputMode, 'squash', '2 候補の種類が squash でない');
assert.deepEqual(p.step, J.steps[2], '2 組んだ手が、検証ずみの原本（squash_tsuru3_v2.json）の手と違う');
assert.equal(st.recipe.version, 1, '2 候補を作っただけで version が変わった');
assert.equal(JSON.stringify({ ...JSON.parse(snap(st)), pending: null }), JSON.stringify({ ...JSON.parse(s0), pending: null }),
 '2 候補を作っただけで原本・revision・cache・redoStack が変わった');
assert.equal(p.hash, E.replay(J).hash, '2 候補の再生結果が、検証ずみ原本の再生結果と違う');
ok('つる③から組んだ候補の手＝検証ずみ原本の手とぴたり同じ。原本は v1 のまま・revision も不変');

/* 候補にならない状態は、理由をつけて断り、状態を変えない。 */
for (const [name, mk, re] of [
 ['手0本', () => E.create(), /4枚のはず|頂点/],
 ['1手だけ', () => load({ ...V1_OF_J, steps: V1_OF_J.steps.slice(0, 1) }), /4枚のはず/],
 ['中線2回', () => load({ ...V1_OF_J, steps: [
  { ...C(V1_OF_J.steps[0]), line: [[0, -1], [0, 1]], movingSidePoint: [0.5, 0] },
  { ...C(V1_OF_J.steps[1]), line: [[-1, 0], [1, 0]], movingSidePoint: [-0.5, 0.5] }] }), /素材の対角ではありません/],
]) {
 const s = mk(), before = snap(s);
 throws(() => E.proposeSquash(s), re, '2 ' + name + ' を候補にしてしまう');
 assert.equal(snap(s), before, '2 ' + name + ' で断ったのに状態が変わった');
}
/* 範囲外の座標を持つ原本（外から持ちこまれたもの）は、v2 へ移さない＝候補にせず、理由をつけて断る。
   ⚠画面の記録で出ていた外周の浮動小数誤差（-1.0000000000000002）は、記録の共通箇所（recordable）で直した
     ＝そちらの再現と境界は test_record_rim.js。ここは「持ちこまれた範囲外の原本は、補正せずに断る」ことだけ見る。 */
for (const bad of [1.0000000000000002, 1 + 1e-9, 1.5]) {
 /* 対角 [-1,-1]→[1,1] の片端だけを、同じ直線の上で外へ出す（折りの形は変えない）。 */
 const r = C(V1_OF_J); r.steps[1].line = [[-bad, -bad], [1, 1]];
 const t = load(r), before = snap(t);
 throws(() => E.proposeSquash(t), /前後の手（v1）.*out of range/, '2 範囲外（' + bad + '）の原本を v2 の候補にしてしまう');
 assert.equal(snap(t), before, '2 範囲外で断ったのに状態が変わった');
}
ok('つる③でない状態（手0本・1手・中線2回）と、持ちこまれた範囲外の原本は、補正せず理由をつけて断り状態を変えない');

/* 候補のあいだは、折りの道へ入れない／履歴も動かさない。取消で消える。 */
{
 const s = load(V1_OF_J); E.proposeSquash(s); const before = snap(s);
 for (const [name, fn] of [['setSide', () => E.setSide(s, [.5, .5])], ['select', () => E.select(s, [{ faceId: 'paper' }])],
  ['preview', () => E.preview(s, 90)], ['setLayers', () => E.setLayers(s, 1, [.5, .5])],
  ['stage', () => E.stage(s, 'V')], ['stageFold', () => E.stageFold(s)]])
  throws(fn, /袋折りの候補です/, '2 候補のあいだに ' + name + ' が通る');
 throws(() => E.undo(s), /確定か取消/, '2 候補のあいだに undo が通る');
 throws(() => E.flip(s, 'v'), /確定か取消/, '2 候補のあいだに裏返しが通る');
 assert.equal(snap(s), before, '2 候補のあいだの拒否で状態が変わった');
 E.cancel(s);
 assert.equal(s.pending, null, '2 取消で候補が消えない');
}
ok('候補のあいだは setSide/select/preview/setLayers/stage/stageFold/undo/裏返しを断る。取消で消える');

/* ================= 3 確定＝明示的に v2 へ移し、1手として原子的に ================= */
{
 /* 失敗①：候補が古い。 */
 const s = load(V1_OF_J); E.proposeSquash(s); s.pending.revision = -1; const before = snap(s);
 throws(() => E.confirm(s), /確定候補が古くなっています/, '3 古い候補を確定してしまう');
 assert.equal(snap(s), before, '3 古い候補で断ったのに、正式状態か候補が変わった');
}
{
 /* 失敗②：候補の手が再生の門を通らない（stack の上下を入れかえる）。 */
 const s = load(V1_OF_J); E.proposeSquash(s);
 const r = s.pending.step.stack[0]; [r[0], r[1]] = [r[1], r[0]]; const before = snap(s);
 throws(() => E.confirm(s), /stack の上下が再生結果と違います/, '3 門を通らない候補を確定してしまう');
 assert.equal(snap(s), before, '3 再生で断ったのに、正式状態か候補が変わった');
}
{
 /* 失敗③：候補を作ったときの結果と違う。 */
 const s = load(V1_OF_J); E.proposeSquash(s); s.pending.hash = 'x'; const before = snap(s);
 throws(() => E.confirm(s), /候補を作ったときと再生結果が違います/, '3 結果の違う候補を確定してしまう');
 assert.equal(snap(s), before, '3 結果の照合で断ったのに、正式状態か候補が変わった');
}
const rev0 = st.revision;
st.redoStack = [C(V1_OF_J.steps[1])];/* 確定で閉じることを見るための置き物 */
const sq = E.confirm(st);
assert.equal(st.recipe.version, 2, '3 確定で v2 へ移っていない');
assert.deepEqual(st.recipe.steps, J.steps, '3 確定した原本の手が検証ずみ原本と違う');
assert.equal(st.revision, rev0 + 1, '3 revision が1回だけ増えていない');
assert.equal(st.pending, null, '3 確定で候補が消えていない');
assert.deepEqual(st.redoStack, [], '3 確定でやり直しの道が閉じていない');
assert.equal(st.cache.hash, E.replay(J).hash, '3 確定した状態が検証ずみ原本の再生と違う');
assert.equal(sq.faces.length, 6, '3 確定後の面が6枚でない');
assert.match(st.cache.hash, /"squash":/, '3 保存前照合の hash に袋折り（枝・領域）が入っていない');
assert.match(st.cache.hash, /"opened":"s3"/, '3 保存前照合の hash に開いた結びが入っていない');
assert.equal(st.committed, st.cache, '3 committed が確定後の cache でない');
assert.deepEqual(st.cache.squash.branch, { linkage: 'tan-half-product-sqrt2', sign: 1, driveDeg: [0, 180] }, '3 運動の枝が cache に無い');
ok('確定＝v1→v2 へ移して1手（revision +1・redo 閉じる）。失敗3通りとも正式状態と候補を両方保つ');

/* ================= 4 袋折りのあとの操作 =================
   ⚠ふつうの折り・折り目・裏返し・背を開く・通常の手の redo・原本の後続の手は 2026-09-14 から通す（検査は test_squash_after.js）。
   ★2026-09-15 もう一度の袋折りは手数の門で断らない：裏返していない紙は袋の上に紙が乗っていて開けない（幾何の門）ので断る。
     裏返した紙の2回目の袋折りは test_squash_twice.js。 */
{
 const before = snap(st);
 for (const [name, fn] of [
  ['袋折り', () => E.proposeSquash(st)]]) {
  throws(fn, /袋の上に止まった紙が乗っています/, '4 裏返していない紙の ' + name + ' を断らない');
  assert.equal(snap(st), before, '4 ' + name + ' を断ったのに状態が変わった');
 }
 /* ふつうの折りの候補は作れる（確定・整合は test_squash_after.js） */
 E.propose(st, [.5, 1], [1, .5], { layers: 1 }); assert.ok(st.pending, '4 袋折りのあとの折りの候補ができない'); E.cancel(st);
 assert.equal(snap(st), before, '4 候補を取り消したのに状態が変わった');
 /* redo に「いまの紙に無い面」の手が残っている合成状態は、状態を変える前に断る。 */
 const s = load(J); s.redoStack = [C(V1_OF_J.steps[1])]; const b2 = snap(s);
 throws(() => E.redo(s), /基準面がいまの紙にありません/, '4 袋折りで退役した面の手の redo を断らない');
 assert.equal(snap(s), b2, '4 redo を断ったのに状態が変わった');
}
ok('裏返していない紙の もう一度の袋折り は幾何の理由で状態を変える前に断る／ふつうの折りの候補は作れる');

/* ================= 5 保存・再読込 ================= */
const faceKeys = cache => cache.faces.map(f => f.faceId + ':' + (det(f.xf) > 0 ? 'おもて' : 'うら') + '@' + f.layer).sort();
function sameOnReload(s, label) {
 const saved = E.verifiedRecipe(s);
 const text = JSON.stringify(saved, null, 2) + '\n';
 const back = JSON.parse(text);
 assert.equal(back.version, s.recipe.version, label + ' 保存で version が変わった');
 const r = load(back);
 assert.equal(r.cache.hash, s.cache.hash, label + ' 再読込で hash が変わった');
 assert.deepEqual(facesOf(r.cache), facesOf(s.cache), label + ' 再読込で面・表裏・層・形が変わった');
 assert.deepEqual(r.cache.bonds, s.cache.bonds, label + ' 再読込で結び（bondId・stepId・kind・seg・openedBy）が変わった');
 assert.deepEqual(r.cache.squash || null, s.cache.squash || null, label + ' 再読込で運動の枝・領域が変わった');
 return { back, r };
}
{
 const { back, r } = sameOnReload(st, '5 袋折り後');
 assert.deepEqual(back.steps, J.steps, '5 保存した手が検証ずみ原本と違う');
 assert.deepEqual(faceKeys(r.cache), ['paper/s1.cut/s2.cut/s3.cut:うら@3', 'paper/s1.cut/s2.cut/s3.keep:おもて@2',
  'paper/s1.cut/s2.keep:うら@1', 'paper/s1.keep/s2.cut/s3.cut:おもて@0', 'paper/s1.keep/s2.cut/s3.keep:うら@1',
  'paper/s1.keep/s2.keep:おもて@0'], '5 再読込の面・表裏・層が検証ずみと違う');
 assert.equal(r.cache.bonds.filter(b => b.kind === 'crease' && b.openedBy === 's3').length, 2, '5 開いた結びが2本でない');
 const out = V.replay(back);
 assert.deepEqual(out.branch, r.cache.squash.branch, '5 外部入口の枝と共通入口の枝が違う');
 assert.deepEqual(back.steps[2].branch, J.steps[2].branch, '5 原本の枝が変わった');
 /* 保存前の照合＝表示状態と原本の再生が食い違えば書き出さない（袋折り後も同じ門）。 */
 const bad = load(J); bad.cache = { ...bad.cache, hash: bad.cache.hash + 'x' };
 throws(() => E.verifiedRecipe(bad), /一致しないため保存できません/, '5 食い違った袋折り状態を保存してしまう');
}
ok('袋折り後に保存→読みこみ：面・表裏・層・結び・運動の枝・領域が一致／食い違えば保存しない');

/* ================= 6 undo／redo＝1回ずつ・version は切りかえない ================= */
const hSq = st.cache.hash;
E.undo(st);
assert.equal(st.recipe.version, 2, '6 undo で version が勝手に変わった');
assert.deepEqual(st.recipe.steps.map(s => s.op), ['fold', 'fold'], '6 undo 1回で袋折りが外れていない');
assert.equal(st.redoStack.length, 1, '6 undo で redo に1手積まれていない');
assert.equal(st.redoStack[0].op, 'squash', '6 redo に積まれたのが squash でない');
assert.equal(st.cache.squash, undefined, '6 undo 後の cache に袋折りが残った');
assert.deepEqual(facesOf(st.cache), facesOf(c1), '6 undo 後の紙が袋折り前（v1 の2手）と違う');
sameOnReload(st, '6 squash 0手の v2');
/* squash 0手の v2 からも、もう一度候補を作れる（v2 のまま）。 */
{ const s = load(st.recipe); const pp = E.proposeSquash(s); assert.deepEqual(pp.step, J.steps[2], '6 巻き戻した v2 から同じ候補が作れない');
  E.confirm(s); assert.equal(s.cache.hash, hSq, '6 巻き戻した v2 から確定した結果が違う') }
E.undo(st); E.undo(st);
assert.equal(st.recipe.version, 2, '6 手0本まで戻しても version が変わってはいけない');
assert.equal(st.recipe.steps.length, 0, '6 手0本まで戻っていない');
assert.equal(st.committed, null, '6 手0本で committed が残った');
sameOnReload(st, '6 手0本の v2');
throws(() => E.undo(st), /巻き戻す手順がありません/, '6 手0本からさらに undo できる');
E.redo(st); E.redo(st);
assert.equal(st.recipe.version, 2, '6 redo で version が変わった');
const revBefore = st.revision;
E.redo(st);
assert.equal(st.revision, revBefore + 1, '6 袋折りの redo が1回で済んでいない');
assert.equal(st.cache.hash, hSq, '6 redo した袋折りが確定時と違う');
assert.deepEqual(st.recipe.steps, J.steps, '6 redo した原本が違う');
assert.deepEqual(st.redoStack, [], '6 redo のあと置き場が空でない');
throws(() => E.redo(st), /やり直す手順がありません/, '6 置き場が空なのに redo できる');
sameOnReload(st, '6 redo 後');
/* redo の失敗は原子的（合成入力で直接鳴らす）：壊れた squash の手を置いても正式状態は動かない。 */
{
 E.undo(st); const broken = C(st.redoStack[0]); broken.stack = broken.stack.slice(1); st.redoStack = [broken];
 const before = snap(st);
 throws(() => E.redo(st), /stack に、重なっている領域が書かれていません/, '6 壊れた squash の redo を通してしまう');
 assert.equal(snap(st), before, '6 redo を断ったのに状態が変わった');
}
ok('undo 1回で袋折りだけ外れ v2 のまま（squash 0手・手0本も再生・保存できる）／redo 1回で戻る／失敗は原子的');

/* ================= 7 同期・確定・undo・redo・保存前照合が、ぜんぶ共通入口を通る（数えて見る） ================= */
{
 const real = globalThis.SquashV2; let count = 0;
 globalThis.SquashV2 = { ...real, replayWith: (...a) => { count++; return real.replayWith(...a) } };
 try {
  const s = load(V1_OF_J);/* v1 の間は v2 の器を呼ばない */
  assert.equal(count, 0, '7 v1 の再生で v2 の器を呼んだ');
  const step = (label, fn) => { const k = count; fn(); assert.equal(count > k, true, '7 ' + label + ' が共通入口（v2）を通っていない') };
  step('候補づくり', () => E.proposeSquash(s));
  step('確定', () => E.confirm(s));
  step('保存前の照合', () => E.verifiedRecipe(s));
  step('undo', () => E.undo(s));
  step('redo', () => E.redo(s));
  step('読みこみ（replay）', () => load(s.recipe));
 } finally { globalThis.SquashV2 = real }
}
ok('候補づくり・確定・保存前の照合・undo・redo・読みこみが、ぜんぶ共通入口から v2 の器へ届く');

console.log('');
console.log('― この検査が言っていないこと ―');
console.log('  ⛔ 紙どうしの貫通は見ていない。厚みは0');
console.log('  ⛔ 袋折りのあとのもう一度の袋折りは未対応（断ることだけを見た）。折り・折り目・裏返し・背を開くは test_squash_after.js');
console.log('  ⛔ UI で袋を選ぶ操作は無い（engine の API だけ）。受理はつる③1件だけ');
console.log('');
console.log('ALL OK（' + n + '項目）');
