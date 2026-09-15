'use strict';
/* 原本へ記録する折線の、原紙の外周（±1）ぎりぎりの浮動小数誤差の検査。
   症状（2026-09-14）：対角で折った紙（xf に √2 由来の 2.2e-16 が乗る）を上から2枚で折ると、
   記録した折線が -1.0000000000000002 になり、v1 schema（-1〜1）にも v2 移行にも通らなかった。
   🚨直すのは記録の共通箇所（engine の recordable）だけ。桁の丸め・無条件のクランプ・schema の拡張はしない。
   使い方： node test_record_rim.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const src = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js']) vm.runInThisContext(src(f));
const E = FreeFoldEngine, V = SquashV2, SCHEMA = JSON.parse(src('origami_recipe.schema.json'));
V.useV1Validator(OrigamiRecipe.validate, SCHEMA);
const C = x => JSON.parse(JSON.stringify(x));
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const inRange = r => r.steps.every(s => s.op === 'flip' || s.op === 'squash' || [...s.line, s.movingSidePoint].every(p => p.every(v => v >= -1 && v <= 1)));
const v1ok = r => { try { OrigamiRecipe.validate(C(r), SCHEMA); return 'OK' } catch (e) { return e.message } };
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const side = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

/* 画面と同じ手：角 (-1,-1) を (1,1) へ＝対角の半分折り（画面の1回目が作る原本と同じ手）。 */
function diagFold() {
 const t = E.create();
 E.propose(t, [1, -1], [-1, 1]); t.pending.kind = 'V'; E.setSide(t, [-.5, -.5]); E.select(t, t.pending.candidates); E.confirm(t);
 return t;
}
/* 2回目＝画面が作った pending と同じ数値（実Chrome で記録した displayLine と折る側）。 */
function freeSecond(t, n) {
 E.proposeOnFace(t, [0.5086956558735827, 1.0000000000000004], [0.9999999999999994, 0.5086957295735628], 'paper/s1.cut', { layers: 1 });
 t.pending.kind = 'V';
 const sp = apply(t.cache.faces.find(f => f.faceId === 'paper/s1.cut').xf, [-0.9344927639431414, -0.934492754116478]);
 E.setSide(t, sp); E.setLayers(t, n, sp);
 return sp;
}

/* ================= 1 再現：xf の誤差がそのまま記録に出る（修正前はここで落ちる） ================= */
{
 const t = diagFold();
 const xf = t.cache.faces.find(f => f.faceId === 'paper/s1.cut').xf;
 assert.equal(xf.some(v => v !== 0 && Math.abs(v) < 1e-15), true, '1 前提：対角の鏡映の xf に浮動小数誤差が乗っていない（再現の土台が変わった）');
 const sp = freeSecond(t, 2);
 const q = t.pending;
 assert.equal(q.line.flat().some(v => Math.abs(v) > 1), true, '1 前提：画面の pending の素材座標が ±1 をはみ出していない（再現の土台が変わった）');
 const preview = E.preview(t, 180);
 E.select(t, t.pending.candidates); E.confirm(t);
 const st2 = t.recipe.steps[1];
 assert.equal(inRange(t.recipe), true, '1 記録した折線が原紙の範囲を外れる: ' + JSON.stringify(st2.line));
 assert.equal(v1ok(t.recipe), 'OK', '1 記録した原本が既存の検証器に通らない: ' + v1ok(t.recipe));
 /* 補正は外周の値だけ：外周から離れた座標は1ビットも変えない。 */
 const moved = st2.line.flat().map((v, i) => [v, q.line.flat()[i]]).filter(([a, b]) => a !== b);
 assert.equal(moved.every(([a, b]) => Math.abs(a) === 1 && Math.abs(b) > 1 && Math.abs(b) - 1 <= 1e-12), true,
  '1 外周の誤差以外の座標まで変わった: ' + JSON.stringify(moved));
 assert.deepEqual(st2.movingSidePoint, q.sidePoint, '1 折る側の点が変わった');
 /* 同じ折軸・同じ折る側（現在座標）。 */
 const ref = E.replay(C({ ...t.recipe, steps: t.recipe.steps.slice(0, 1) })).faces.find(f => f.faceId === st2.reference.faceId);
 const axis = st2.line.map(p => apply(ref.xf, p)), L = Math.hypot(q.displayLine[1][0] - q.displayLine[0][0], q.displayLine[1][1] - q.displayLine[0][1]);
 for (const p of axis) assert.equal(Math.abs(side(p, ...q.displayLine)) / L < 1e-12, true, '1 記録した折線が画面の折軸から外れた');
 assert.equal(Math.sign(side(sp, ...axis)) * Math.sign(side(apply(ref.xf, st2.movingSidePoint), ...axis)) > 0, true, '1 折る側が入れかわった');
 /* プレビュー（180°のゴースト）と再生結果の紙が、許容差内で同じ所にある。 */
 const rep = E.replay(C(t.recipe));
 let worst = 0;
 for (const part of preview.parts) for (const v of [...(part.move || []), ...(part.stay || [])]) {
  const p = [v[0], -v[2]]; let d = Infinity;
  for (const f of rep.faces) for (const w of f.poly) d = Math.min(d, Math.hypot(p[0] - w[0], p[1] - w[1]));
  worst = Math.max(worst, d) }
 assert.equal(worst < 1e-9, true, '1 プレビューと再生結果の頂点が食い違う: ' + worst);
 assert.equal(rep.hash, t.cache.hash, '1 記録した原本の再生が表示状態と違う');
 /* 保存→読みこみ→undo/redo でも同じ。 */
 const saved = JSON.parse(JSON.stringify(E.verifiedRecipe(t)));
 assert.equal(E.replay(saved).hash, t.cache.hash, '1 保存→読みこみで紙が変わる');
 const h = t.cache.hash; E.undo(t); E.redo(t);
 assert.equal(t.cache.hash, h, '1 undo/redo でハッシュが戻らない');
 assert.deepEqual(t.recipe.steps[1].line, st2.line, '1 redo で折線が変わった');
 ok('再現：対角で折った紙を上から2枚で折ると -1.0000000000000002 が出る → 外周の値だけ ±1 に戻り、同じ折軸・折る側・プレビュー一致・保存/undo/redo 一致（最大差 ' + worst.toExponential(1) + '）');
}

/* ================= 2 つる②（折線を紙の端から端まで持つ形）→ v2 へ移せる ================= */
{
 const t = E.create();
 E.propose(t, [-1, 1], [1, -1]); t.pending.kind = 'V'; E.setSide(t, [-.5, -.5]); E.select(t, t.pending.candidates); E.confirm(t);
 const top = E.hitFaces(t, [.3, .5])[0].faceId;
 E.proposeOnFace(t, [-1, -1], [1, 1], top, { layers: 1 }); t.pending.kind = 'V'; E.setSide(t, [-.2, .5]);
 E.setLayers(t, 2, [-.2, .5]);
 const raw = t.pending.line;
 assert.equal(raw.flat().some(v => Math.abs(v) > 1), true, '2 前提：pending の素材座標が ±1 をはみ出していない');
 E.select(t, t.pending.candidates); E.confirm(t);
 assert.equal(v1ok(t.recipe), 'OK', '2 つる②の原本が既存の検証器に通らない: ' + v1ok(t.recipe));
 const before = JSON.stringify(t.recipe);
 const p = E.proposeSquash(t);
 assert.equal(JSON.stringify(t.recipe), before, '2 候補を作っただけで原本が変わった');
 E.confirm(t);
 const J = JSON.parse(src('squash_tsuru3_v2.json')), ref = E.replay(J);
 const key = c => JSON.stringify(c.faces.map(f => [f.faceId, Math.sign(f.xf[0] * f.xf[3] - f.xf[1] * f.xf[2]), f.layer]).sort());
 assert.equal(key(t.cache), key(ref), '2 つる②から袋折りした紙が検証ずみ原本と面・表裏・層で違う');
 assert.deepEqual(t.cache.squash, ref.squash, '2 運動の枝・領域が検証ずみ原本と違う');
 ok('つる②（端から端までの折線・上から2枚）が schema に入り、袋折り候補→確定で検証ずみ原本と同じ紙になる');
}

/* ================= 3 境界：補正してよい微小誤差／補正してはいけない範囲外 ================= */
/* 平らな紙（xf は恒等）で recordable を直接呼ぶ。materialLine を渡した道と、面で切り直す道の両方を見る。 */
{
 const t = E.create(), a = [-1, 0], b = [1, 0], sp = [0, -.5];
 const R = line => E.recordable(t, ['paper'], 'paper', a, b, sp, line);
 const TOL = 1e-12;
 /* 補正する：外へ TOL 以内。 */
 for (const v of [1 + 2.220446049250313e-16, 1 + 4.440892098500626e-16, 1 + 0.9e-12]) {
  const r = R([[-v, 0], [v, 0]]);
  assert.equal(r.ok, true, '3 外へ ' + (v - 1).toExponential(2) + ' を補正しない: ' + r.reason);
  assert.deepEqual(r.line, [[-1, 0], [1, 0]], '3 外へ ' + (v - 1).toExponential(2) + ' が ±1 ちょうどにならない: ' + JSON.stringify(r.line));
 }
 /* 補正しない（中の値）：1 より小さい値は1ビットも変えない。 */
 { const r = R([[-0.9999999999999998, 0], [0.9999999999999998, 0]]);
   assert.deepEqual(r.line, [[-0.9999999999999998, 0], [0.9999999999999998, 0]], '3 範囲内の値まで変えた: ' + JSON.stringify(r.line)) }
 { const r = R([[-0.3, 0], [0.7, 0]]);
   assert.deepEqual(r.line, [[-0.3, 0], [0.7, 0]], '3 外周から離れた値を変えた') }
 /* 補正しない（TOL を超える）：そのまま書かない。materialLine は捨て、面で切り直した線（±1 ちょうど）を使う。 */
 for (const v of [1 + 1.1e-12, 1 + 1e-9, 1 + 1e-6, 1 + 1e-3, 1.5]) {
  const r = R([[-v, 0], [v, 0]]);
  assert.equal(r.ok, true, '3 ' + v + '：切り直しの道まで断った: ' + r.reason);
  assert.equal(r.line.flat().every(x => Math.abs(x) <= 1), true, '3 ' + v + ' を範囲外のまま書いた: ' + JSON.stringify(r.line));
  assert.equal(r.line.flat().includes(v) || r.line.flat().includes(-v), false, '3 ' + v + ' を書いた（TOL を超えた値を補正か素通し）');
 }
 ok('境界：外へ 1e-12 以内（2.2e-16・4.4e-16・0.9e-12）だけ ±1 に戻す／中の値・1.1e-12 以上の外れは補正しない');
}
/* 明確に範囲外＝面そのものが原紙の外にある（合成入力）。切り直しても外なので、従来どおり理由をつけて断る。 */
{
 const mk = x => { const t = E.create(); const c = C(t.cache);
  c.faces = [{ faceId: 'paper', layerPath: [], poly: [[-1, -1], [x, -1], [x, 1], [-1, 1]], xf: [1, 0, 0, 1, 0, 0], layer: 0 }];
  t.cache = c; return t };
 for (const x of [1 + 1.1e-12, 1 + 1e-9, 1 + 1e-6, 1.5]) {
  const t = mk(x), r = E.recordable(t, ['paper'], 'paper', [x, -1], [x - .5, 1], [-.5, 0]);
  assert.equal(r.ok, false, '3 範囲外 ' + x + ' を書いてしまう: ' + JSON.stringify(r.line));
  assert.match(r.reason, /紙の外に出ます/, '3 範囲外 ' + x + ' の理由が違う: ' + r.reason);
 }
 const t = mk(1 + 0.5e-12), r = E.recordable(t, ['paper'], 'paper', [1 + 0.5e-12, -1], [1 + 0.5e-12 - .5, 1], [-.5, 0]);
 assert.equal(r.ok, true, '3 外へ 0.5e-12 の面で断った: ' + r.reason);
 assert.equal(r.line.flat().every(x => Math.abs(x) <= 1), true, '3 外へ 0.5e-12 を範囲外のまま書いた');
 ok('明確に範囲外（1.1e-12・1e-9・1e-6・0.5）は従来どおり「紙の外に出ます」で断る');
}
/* 折軸の見張り（合成入力で直接鳴らす）：外周へ戻したことで現在座標の点が 1e-9 より動くなら、その補正はしない。
   剛体の xf では届かない（1e-12 の補正は 1e-12 しか動かない）ので、伸びた xf（×1e4）を直接食わせる。 */
{
 const t = E.create(); const c = C(t.cache);
 c.faces = [{ faceId: 'paper', layerPath: [], poly: [[-1e4, -1e4], [1e4 + 1e-8, -1e4], [1e4 + 1e-8, 1e4], [-1e4, 1e4]], xf: [1e4, 0, 0, 1e4, 0, 0], layer: 0 }];
 t.cache = c;
 const v = 1 + 0.9e-12, r = E.recordable(t, ['paper'], 'paper', [0, -1e4], [1e4 * v, 1e4], [-5000, 0], [[0, -1], [v, 1]]);
 assert.equal(r.ok, false, '3 補正で折軸が 1e-8 動くのに書いてしまう: ' + JSON.stringify(r.line));
 /* 同じ形でも剛体（×1）なら補正して書く＝落ちたのは補正の移動量のせい。 */
 const t1 = E.create(), r1 = E.recordable(t1, ['paper'], 'paper', [0, -1], [1, 1], [-.5, 0], [[0, -1], [v, 1]]);
 assert.deepEqual(r1.line, [[0, -1], [1, 1]], '3 剛体の xf で外へ 0.9e-12 を補正しない: ' + JSON.stringify(r1));
 ok('補正で現在座標の点が 1e-9 より動くなら補正しない（剛体なら補正する）');
}
console.log('');
console.log('ALL OK（' + n + '項目）');
