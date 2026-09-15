'use strict';
/* 🔺 1回半分に折った紙で、角を相手の角へ運ぶ「2回目の半分折り」（2026-09-14・本人が画像で指摘）。
   症状：角のそばで角に吸いつかず、足元でない方のふちの「線上」に吸いつき、折線が対角から 0.012 ずれていた。
   原因：対角の候補が「原点対称の角」＝折っていない正方形でだけ成り立つ計算で、1手でも折ると候補0。
   直し：候補は「いまの紙の外形の角」から、足元のふちに乗っている角（隣の角）を除いて作る。
   ⛔ 26px 入る／44px 離れる・順位（交点 > 端点 > 角 > 線上）・結びと層の成立判定は変えない。
   使い方： node test_half_fold.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const src = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js']) vm.runInThisContext(src(f));
const E = FreeFoldEngine, N = FreeFoldSnap;
SquashV2.useV1Validator(OrigamiRecipe.validate, JSON.parse(src('origami_recipe.schema.json')));
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const ref = s => s.pending.candidates;
const V = { toScreen: p => [p[0] * 240, -p[1] * 240] }, S = p => V.toScreen(p);
const key = ps => JSON.stringify(ps.map(p => p.map(v => Math.round(v * 1e9) / 1e9 + 0)).sort());
/* 画面と同じ1回目：角 (-1,-1) を (1,1) へ＝対角の半分折り。 */
function tri(flip) {
 const t = E.create(); if (flip) E.flip(t, 'v');
 const g = N.grab(t, S([-1, -1]), V), cr = N.creaseForCorners(t, g.point, [1, 1]);
 E.proposeOnFace(t, cr.line[0], cr.line[1], cr.faceId, { layers: 1 }); E.setSide(t, cr.sidePoint); E.select(t, ref(t)); E.confirm(t);
 return t;
}

/* ================= 1 候補＝いまの紙の外形の角（原点対称は使わない） ================= */
{
 const sq = E.create();
 assert.equal(key(N.outlineCorners(sq)), key([[-1, -1], [1, -1], [1, 1], [-1, 1]]), '1 正方形の外形の角が4隅でない');
 assert.deepEqual(N.diagonalsOf(sq, N.grab(sq, S([1, -1]), V)), [[-1, 1]], '1 正方形で対角が1つだけにならない（従来と違う）');
 for (const flip of [false, true]) {
  const t = tri(flip), lab = flip ? '裏' : '表';
  assert.equal(key(N.outlineCorners(t)), key([[1, -1], [1, 1], [-1, 1]]), '1' + lab + ' 三角形の外形の角が3つでない: ' + JSON.stringify(N.outlineCorners(t)));
  const gA = N.grab(t, S([-1, 1]), V), gB = N.grab(t, S([1, -1]), V), gC = N.grab(t, S([1, 1]), V);
  assert.equal(key(N.diagonalsOf(t, gA)), key([[1, -1]]), '1' + lab + ' 角(-1,1) の相手が (1,-1) だけでない');
  assert.equal(key(N.diagonalsOf(t, gB)), key([[-1, 1]]), '1' + lab + ' 角(1,-1) の相手が (-1,1) だけでない');
  assert.deepEqual(N.diagonalsOf(t, gC), [], '1' + lab + ' 直角の角 (1,1) に相手が出た（足元のふちの角＝隣の角）');
 }
 /* 折り目の端（ふちの途中）と紙の内側の点は角ではない。 */
 const cr = E.create(); E.propose(cr, [0, -1], [0, 1]); E.setSide(cr, [.5, 0]); E.select(cr, ref(cr)); E.confirm(cr, { op: 'crease' });
 assert.equal(key(N.outlineCorners(cr)), key([[-1, -1], [1, -1], [1, 1], [-1, 1]]), '1 折り目の端を外形の角に数えた');
 ok('候補＝外形の角（正方形は対角1つ／三角形は鋭角どうし・直角は0／折り目の端は角でない）');
}

/* ================= 2 吸着：相手の角のそばでは角が線上に勝つ。26px 入る／44px 離れる ================= */
for (const flip of [false, true]) {
 const t = tri(flip), lab = flip ? '裏' : '表', g = N.grab(t, S([-1, 1]), V), B = S([1, -1]);
 const at = (dx, dy, was) => N.foldTarget(t, g, [B[0] + dx, B[1] + dy], [0, 0], V, was);
 const s22 = at(-18, -12, false);
 assert.deepEqual([s22.snapped, s22.snapKind, s22.target], [true, 'diagonal', [1, -1]], '2' + lab + ' 22px で相手の角に吸いつかない: ' + JSON.stringify(s22));
 assert.equal(at(-6, -4, false).snapKind, 'diagonal', '2' + lab + ' ふちの線上が角に勝った');
 assert.notEqual(at(-30, -18, false).snapKind, 'diagonal', '2' + lab + ' 35px で吸いついた（入るのは 26px）');
 assert.equal(at(-30, -18, true).snapKind, 'diagonal', '2' + lab + ' 35px で吸着が外れた（離れるのは 44px）');
 assert.notEqual(at(-60, -40, true).snapKind, 'diagonal', '2' + lab + ' 72px でも吸着が外れない');
 /* 行き先はいまの頂点そのもの＝折線はちょうど対角、動くのは紙の半分。 */
 const c = N.creaseForCorners(t, g.point, s22.target);
 const L = c.line, onDiag = L.every(p => Math.abs(p[0] - p[1]) < 1e-9);
 assert.equal(onDiag, true, '2' + lab + ' 折線が対角 y=x に乗らない: ' + JSON.stringify(L));
 assert.equal(c.half, true, '2' + lab + ' 相手の角への角合わせが半分折りにならない');
 ok('2' + lab + '：相手の角に 26px で吸いつき 44px まで保つ／折線はちょうど対角・半分折り');
}

/* ================= 3 成立判定はそのまま：上から1枚は結びで断る／上から2枚で確定→袋を選べる ================= */
{
 const t = tri(false), g = N.grab(t, S([-1, 1]), V), s = N.foldTarget(t, g, [S([1, -1])[0] - 10, S([1, -1])[1] - 6], [0, 0], V, false);
 const c = N.creaseForCorners(t, g.point, s.target);
 E.proposeOnFace(t, c.line[0], c.line[1], c.faceId, { layers: 1 }); E.setSide(t, c.sidePoint);
 assert.throws(() => E.preview(t, 180), /結びにそって紙が切り離されます/, '3 上から1枚で結びの判定が鳴らない（裂けるゴーストを出してしまう）');
 assert.throws(() => E.setLayers(t, 1, c.sidePoint), /裂け|結び|つながっている/, '3 上から1枚が成立してしまう');
 assert.equal(t.pending.kind, 'V', '3 断っただけで候補が変わった');
 E.setLayers(t, 2, c.sidePoint);
 assert.equal(E.preview(t, 180).parts.length, 2, '3 上から2枚でプレビューできない');
 E.select(t, ref(t)); E.confirm(t);
 const st2 = t.recipe.steps[1];
 assert.equal(st2.line.flat().every(v => Math.abs(v) <= 1), true, '3 記録した折線が原紙の範囲を外れる');
 assert.equal(E.squashOptions(t).options.length, 1, '3 2回の半分折りのあと、袋が候補に出ない: ' + E.squashOptions(t).reason);
 ok('上から1枚は結びの判定で断る（枚数は自動で変えない）／上から2枚で確定→袋を選べる');
}
console.log('');
console.log('ALL OK（' + n + '項目）');
