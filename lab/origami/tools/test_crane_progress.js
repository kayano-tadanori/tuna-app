'use strict';
/* 🕊 つるを自由折りの既存操作でどこまで折れるか（2026-09-15・本体は無変更）。
   折り図（おりがみくらぶ・つる15手）：①② 対角に半分2回 ③ 袋折り ⑤ 裏返す ⑥ 袋折り ⑦ 折って折り目をつけて戻す
     ⑧⑨ 端を持ち上げて袋をつくり、つぶす（花弁折り） ⑩⑪ 裏返して同じ ⑫ まんなかへ ⑬⑬ 中割り折り ⑮ できあがり
   ★この検査が固定すること
     A ①〜⑥：画面と同じ道（角をつかむ吸着・上から2枚・袋を選ぶ）で正方基本形。4枚重ねの正方形。
     B ⑦：凧形の折り目2本＝紙の端（開いた角 Q から横の角へのふち）を対角の折り目へ合わせる軸（engine の edgeToCreaseOptions）を
          「折り目だけ」で上から2枚／上の三角＝凧形の折り目の端 P・P' を結ぶ線を、提案の既定の候補（一番上の左右の半分＝対角の平らな折り目でつながった2面）で。
          ⚠「上からN枚」（setLayers）は押した点の下の面だけを数えるので左右の片側だけになり、N=1 でも「裂けます」で断る。既定の候補なら通る。
            花弁折りで P-P' を使うのは一番上の層だけなので⑦はこれで足りる（2枚目以降に P-P' を入れられるかは見ていない）。
          ⚠「折り目だけ」は、折って戻す運動そのものを検証していない（残る折り目の記録）。
     C ⑦のあと：保存→再読込・undo/redo で同じ紙。flatState 成立。
     D ⑧⑨ 花弁折りは既存の操作では出せない：袋を選ぶ＝局所照合の前提（面が頂点まわりの区間の合併）に合わず断る／
          背を開く＝1本の軸（同じ背の上）でしか動かせない＝花弁の軸 P-P' と、2枚目の脇の三角の軸 Q-P が同時に動く運動は候補にならない。
   使い方： node test_crane_progress.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'fold_crossing.js']) vm.runInThisContext(rd(f));
const E = FreeFoldEngine, N = FreeFoldSnap, V2 = SquashV2, X = FoldCrossing;
V2.useV1Validator(OrigamiRecipe.validate, JSON.parse(rd('origami_recipe.schema.json')));
const C = x => JSON.parse(JSON.stringify(x));
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const load = r => { const st = E.create(); st.recipe = C(r); st.cache = E.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache; return st };
const VW = { toScreen: p => [p[0] * 240, -p[1] * 240] }, SC = p => VW.toScreen(p);
const area = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1] } return Math.abs(s) / 2 };

/* A ①〜⑥（test_squash_twice.js と同じ画面の道） */
const st = E.create();
{
 let g = N.grab(st, SC([-1, -1]), VW), cr = N.creaseForCorners(st, g.point, [1, 1]);
 E.proposeOnFace(st, cr.line[0], cr.line[1], cr.faceId, { layers: 1 }); E.setSide(st, cr.sidePoint); E.select(st, st.pending.candidates); E.confirm(st);
 g = N.grab(st, SC([-1, 1]), VW);
 const to = SC([1, -1]), s = N.foldTarget(st, g, [to[0] - 10, to[1] - 6], [0, 0], VW, false), c = N.creaseForCorners(st, g.point, s.target);
 E.proposeOnFace(st, c.line[0], c.line[1], c.faceId, { layers: 1 }); E.setSide(st, c.sidePoint); E.setLayers(st, 2, c.sidePoint); E.select(st, st.pending.candidates); E.confirm(st);
 let o = E.squashOptions(st); E.proposeSquash(st, o.options[0].pocketId); E.confirm(st);
 E.flip(st, 'v');
 o = E.squashOptions(st); assert.equal(o.options.length, 1, 'A 反対側の袋が出ない'); E.proposeSquash(st, o.options[0].pocketId); E.confirm(st);
 assert.deepEqual(st.recipe.steps.map(s => s.op), ['fold', 'fold', 'squash', 'flip', 'squash']);
 const xs = st.cache.faces.flatMap(f => f.poly.map(p => p[0])), ys = st.cache.faces.flatMap(f => f.poly.map(p => p[1]));
 assert.ok(Math.abs((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) - 1) < 1e-9 && st.cache.faces.length === 8, 'A 正方基本形（4枚重ねの正方形）にならない');
 ok('A ①〜⑥ 画面と同じ道で正方基本形（8面・4枚重ねの正方形）');
}
/* 正方基本形の要所（読むだけ）：閉じた角 O・開いた角 Q（紙の4つの角が集まる所）・横の角 */
const corner = st.cache.faces.map(f => { const d = f.xf[0] * f.xf[3] - f.xf[1] * f.xf[2];
 return f.poly.find(q => { const x = q[0] - f.xf[4], y = q[1] - f.xf[5], m = [(f.xf[3] * x - f.xf[1] * y) / d, (-f.xf[2] * x + f.xf[0] * y) / d]; return Math.abs(Math.abs(m[0]) - 1) < 1e-9 && Math.abs(Math.abs(m[1]) - 1) < 1e-9 }) }).filter(Boolean);
const Q = corner[0];
assert.ok(corner.every(p => Math.hypot(p[0] - Q[0], p[1] - Q[1]) < 1e-9), '紙の4つの角が1点に集まっていない');
const O = [0, 0];
/* B ⑦ */
const t8 = Math.tan(Math.PI / 8);
{
 const kite = (onEdge, layers) => {
  const rims = E.rimEdges(st).filter(e => e.seg.every(onEdge));
  const top = rims.sort((a, b) => st.cache.faces.find(f => f.faceId === b.faceId).layer - st.cache.faces.find(f => f.faceId === a.faceId).layer)[0];
  const opt = E.edgeToCreaseOptions(st, E.edgeIntent(st, top.faceId, top.rimId)).options.filter(v => v.ok);
  assert.ok(opt.length, 'B 紙の端を対角の折り目へ合わせる軸が出ない');
  const [a, b] = opt[0].axis;
  E.proposeOnFace(st, a, b, top.faceId, { layers: 1 }); st.pending.kind = 'V'; E.setSide(st, opt[0].sidePoint); if (layers > 1) E.setLayers(st, layers, st.pending.at);
  E.select(st, st.pending.candidates); E.confirm(st, { op: 'crease' });
  return [a, b];
 };
 /* 開いた角 Q から横の角へのふち＝ Q を端に持つ外周辺（2本） */
 const sides = E.rimEdges(st).filter(e => e.seg.some(p => Math.hypot(p[0] - Q[0], p[1] - Q[1]) < 1e-9));
 const dirs = [...new Set(sides.map(e => { const far = e.seg.find(p => Math.hypot(p[0] - Q[0], p[1] - Q[1]) > 1e-9); return JSON.stringify([Math.sign(Math.round((far[0] - Q[0]) * 1e6)), Math.sign(Math.round((far[1] - Q[1]) * 1e6))]) }))].map(JSON.parse);
 assert.equal(dirs.length, 2, 'B 開いた角からのふちが2本でない');
 const onLine = d => p => Math.abs((p[0] - Q[0]) * d[1] - (p[1] - Q[1]) * d[0]) < 1e-9;
 const ax1 = kite(onLine(dirs[0]), 2), ax2 = kite(onLine(dirs[1]), 2);
 /* 凧形の線は Q を通り、対角 O-Q と 22.5° */
 for (const ax of [ax1, ax2]) {
  const d = [ax[1][0] - ax[0][0], ax[1][1] - ax[0][1]], q = [O[0] - Q[0], O[1] - Q[1]];
  assert.ok(Math.abs((Q[0] - ax[0][0]) * d[1] - (Q[1] - ax[0][1]) * d[0]) < 1e-9, 'B 凧形の線が開いた角を通らない');
  const ang = Math.acos(Math.abs(d[0] * q[0] + d[1] * q[1]) / Math.hypot(...d) / Math.hypot(...q)) * 180 / Math.PI;
  assert.ok(Math.abs(ang - 22.5) < 1e-6, 'B 凧形の線が対角と 22.5° でない: ' + ang);
 }
 /* 上の三角：凧形の折り目の端 P・P'（横のふちの上）を結ぶ線を、上から1枚 */
 const L = Math.hypot(Q[0] - O[0], Q[1] - O[1]) / Math.SQRT2;
 const ends = E.creaseIntervals(st).flatMap(c => c.seg).filter(p => Math.hypot(p[0] - O[0], p[1] - O[1]) > 1e-6 && Math.abs(Math.hypot(p[0] - O[0], p[1] - O[1]) - L * (1 - t8)) < 1e-9);
 const P = ends[0], Pp = ends.find(p => Math.hypot(p[0] - P[0], p[1] - P[1]) > 1e-6);
 assert.ok(P && Pp, 'B 凧形の折り目の端 P・P\' が見つからない');
 const Mid = [(P[0] + Pp[0]) / 2, (P[1] + Pp[1]) / 2], side = [Mid[0] + (O[0] - Mid[0]) * .3 + (P[0] - Mid[0]) * .2, Mid[1] + (O[1] - Mid[1]) * .3 + (P[1] - Mid[1]) * .2];
 const top = E.stackAt(st, side)[0];
 const tryLayers = k => { const t = load(st.recipe); E.proposeOnFace(t, P, Pp, top.faceId, { layers: 1 }); t.pending.kind = 'V'; E.setSide(t, side);
  try { E.setLayers(t, k, t.pending.at); return null } catch (e) { return e.message } };
 assert.match(tryLayers(1) || '', /裂け/, 'B 上の三角を「上から1枚」で選んでも裂けで断らない（片側だけの選び方が変わった）');
 E.proposeOnFace(st, P, Pp, top.faceId, { layers: 1 }); st.pending.kind = 'V'; E.setSide(st, side);
 assert.equal(st.pending.candidates.length, 2, 'B 上の三角の上から1枚が、左右の半分（対角の折り目でつながった2面）にならない');
 E.select(st, st.pending.candidates); E.confirm(st, { op: 'crease' });
 assert.deepEqual(st.recipe.steps.map(s => s.op).slice(5), ['crease', 'crease', 'crease']);
 assert.equal(st.cache.faces.length, 14, 'B ⑦のあとの面が14枚でない');
 ok('B ⑦ 凧形の折り目2本（紙の端→対角の折り目の軸・上から2枚）＋上の三角（P-P\'・既定の候補＝一番上の左右の半分）／「上から1枚」は片側だけで裂け');
}
/* C 保存・再読込・undo/redo */
{
 assert.equal(X.flatState(st.cache).ok, true, 'C ⑦のあとの平らな状態が成立しない');
 const saved = C(E.verifiedRecipe(st)); assert.equal(load(saved).cache.hash, st.cache.hash, 'C 保存を読み直すと別の紙');
 const h = st.cache.hash; E.undo(st); E.undo(st); E.undo(st); E.redo(st); E.redo(st); E.redo(st);
 assert.equal(st.cache.hash, h, 'C undo×3/redo×3 で同じ紙に戻らない');
 ok('C ⑦のあと：flatState 成立・保存→再読込・undo/redo で同じ紙');
}
/* D ⑧⑨ 花弁折りは既存の操作では出せない */
{
 const o = E.squashOptions(st);
 assert.equal(o.options.length, 0); assert.match(o.reason, /区間の合併になっていません/, 'D 袋を選ぶの断り方が変わった');
 /* 背を開くで成立する手は、どれも「同じ1本の軸」で動くだけ（花弁折りは P-P' と Q-P の2本の軸が同時に動く） */
 let opens = 0; const axes = new Set();
 for (const h of E.hingeIntervals(st)) for (const f of st.cache.faces) {
  const c = f.poly.reduce((s2, p) => [s2[0] + p[0] / f.poly.length, s2[1] + p[1] / f.poly.length], [0, 0]);
  try { const q = E.proposeOpen(st, E.hingeIntent(st, h.intervalId), c); opens++; axes.add(q.openHinge.intervalId); E.cancel(st) } catch { }
 }
 console.log(`    背を開く：成立 ${opens}件（どれも1本の背の軸だけ＝${[...axes].join(', ')}）`);
 ok('D ⑧⑨ 花弁折りは出せない：袋を選ぶは局所照合の前提外で断り、背を開くは1本の軸の手だけ');
}
/* --write：⑦のあとのレシピと、check_petal_fold.py が**突き合わせの相手**として読む確定形（面・結び・層）。Python は期待値に使わない。 */
if (process.argv.includes('--write')) {
 fs.writeFileSync(path.join(DIR, 'crane_step7_recipe.json'), JSON.stringify(st.recipe, null, 1));
 fs.writeFileSync(path.join(DIR, 'crane_step7_state.json'), JSON.stringify({ note: 'node test_crane_progress.js --write が書く。check_petal_fold.py が突き合わせの相手として読む。',
  faces: st.cache.faces.map(f => ({ faceId: f.faceId, xf: f.xf, layer: f.layer, poly: f.poly })), bonds: st.cache.bonds.map(b => ({ faceIds: b.faceIds, kind: b.kind, seg: b.seg })) }, null, 1));
}
console.log(`\n${n} checks passed`);
