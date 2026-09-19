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
     E つる完成の原本 crane_full_recipe.json（新しい紙→⑫→⑬脚2本→⑭を画面で折って「保存」したファイルそのもの＝`node test_crane13_browser.js --write` が置く。手で組まない）
          ① 再生一致：2回再生して同じ／⑫までは engine の⑫（crane12_state.json）と素材の点ごとに同じ／
             ⑫から画面と同じ道（線を長さ3にそろえて proposeReverse→confirm）で3手を作り直すと、手の数値は ulp の差・面ID・上下・素材の点の位置が同じ
          ② digest 固定（⑫・⑭）③ flatState 成立
          ④ Python 照合（⑫の袋折り・花弁折りは Python で再生できない＝JS の⑫の面から reverse 3手を test_reverse_python.py --crane-dump で）
     F ⑤ 実 Chrome：原本を読み込む → 再生（node と同じ digest）→ undo/redo → 保存 → 再読込 → undo/redo（test_crane12_browser.js の open＝⑫は折らない）
   使い方： node test_crane_progress.js [--no-browser]
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'petal_v2.js', 'fold_crossing.js']) vm.runInThisContext(rd(f));
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
/* E つる完成の原本 */
const FULL = JSON.parse(rd('crane_full_recipe.json')), sha1 = x => require('node:crypto').createHash('sha1').update(x).digest('hex');
const DIGEST12 = 'd17e1a3e0b07d8dddc86f5aa26a9edf0b1648c46', DIGEST14 = '22f9013f7b4f25a62e9cb07367772542c506a829';
const ap = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]], inv = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
/* 素材の点ごとの位置・面ID・重なる組の上下（読むだけ） */
const samePaper = (a, b) => {
 let worst = 0, n2 = 0, idDiff = 0;
 for (let i = 0; i < 81; i++) for (let j = 0; j < 81; j++) { const m = [-1 + i / 40 + 1e-4, -1 + j / 40 + 2e-4];
  const fa = a.faces.filter(f => E.inside(m, f.poly.map(p => inv(f.xf, p)))), fb = b.faces.filter(f => E.inside(m, f.poly.map(p => inv(f.xf, p))));
  if (fa.length !== 1 || fb.length !== 1) continue; n2++; if (fa[0].faceId !== fb[0].faceId) idDiff++;
  const u = ap(fa[0].xf, m), v = ap(fb[0].xf, m); worst = Math.max(worst, Math.hypot(u[0] - v[0], u[1] - v[1])) }
 const la = new Map(a.faces.map(f => [f.faceId, f.layer])), lb = new Map(b.faces.map(f => [f.faceId, f.layer])), ids = [...la.keys()].sort();
 let order = 0; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (Math.sign(la.get(ids[i]) - la.get(ids[j])) !== Math.sign(lb.get(ids[i]) - lb.get(ids[j]))) order++;
 return { worst, n: n2, idDiff, sameIds: JSON.stringify(ids) === JSON.stringify([...lb.keys()].sort()), order };
};
const numDiff = (x, y) => { let m = 0; const rec = (a, b) => { if (typeof a === 'number') { m = Math.max(m, typeof b === 'number' ? Math.abs(a - b) : Infinity); return }
 if (typeof a !== 'object' || a === null) { if (a !== b) m = Infinity; return } if (typeof b !== 'object' || b === null || Object.keys(a).join() !== Object.keys(b).join()) { m = Infinity; return } for (const k of Object.keys(a)) rec(a[k], b[k]) }; rec(x, y); return m };
let full;
try { full = load(FULL) } catch (e) { assert.fail('E① 原本を再生できない（' + e.message + '）') }
const K = FULL.steps.findIndex(s => s.op === 'reverse'), pre = { ...C(FULL), steps: C(FULL.steps.slice(0, K)) }, c12 = E.replay(pre);
{
 assert.deepEqual(FULL.steps.slice(K).map(s => s.op), ['reverse', 'reverse', 'reverse'], 'E① ⑫のあとが中割り3手（⑬脚2本・⑭）でない');
 assert.equal(E.replay(C(FULL)).hash, full.cache.hash, 'E① 2回再生して違う');
 const e12 = E.replay(C(JSON.parse(rd('crane12_state.json')).recipe)), s12 = samePaper(c12, e12);
 assert.ok(s12.worst < 1e-9 && s12.idDiff === 0 && s12.sameIds && s12.order === 0, 'E① 画面の⑫が engine の⑫（crane12_state.json）と違う: ' + JSON.stringify(s12));
 /* ⑫から画面と同じ道で作り直す：保存した線（基準面の素材）をいまの位置へ写し、同じ直線のまま長さ3にそろえ、同じ動く側の印・同じ背で */
 const t = load(pre);
 for (const s of FULL.steps.slice(K)) {
  const ref = t.cache.faces.find(f => f.faceId === s.reference.faceId); assert.ok(ref, `E① ${s.id} の基準面が⑫からの紙に無い`);
  let A = ap(ref.xf, s.line[0]), B = ap(ref.xf, s.line[1]); const at = ap(ref.xf, s.movingSidePoint);
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  A = [mid[0] - u[0] * 1.5, mid[1] - u[1] * 1.5]; B = [mid[0] + u[0] * 1.5, mid[1] + u[1] * 1.5];
  const o = E.reverseOptions(t, A, B, at).options.filter(v => v.hinge.stepId === s.hinge.stepId);
  assert.equal(o.length, 1, `E① ${s.id} の背の候補が1本に決まらない`);
  E.proposeReverse(t, A, B, at, o[0].bondId); E.confirm(t);
  const got = C(t.recipe.steps.slice(-1)[0]); if (Math.hypot(got.line[0][0] - s.line[0][0], got.line[0][1] - s.line[0][1]) > 1e-6) got.line.reverse();
  assert.ok(numDiff(got, s) < 1e-12, `E① ${s.id}：作り直した手が原本の手と違う（${numDiff(got, s)}）`);
 }
 const sp = samePaper(t.cache, full.cache);
 assert.ok(sp.worst < 1e-12 && sp.idDiff === 0 && sp.sameIds && sp.order === 0, 'E① 作り直した⑭が原本の⑭と違う: ' + JSON.stringify(sp));
 ok(`E① 再生一致：2回再生して同じ／⑫＝engine の⑫（位置の差 ${s12.worst.toExponential(1)}・点 ${s12.n}）／⑫から画面と同じ道で3手を作り直すと、手の数値の差 1e-12 未満・面ID・上下・位置の差 ${sp.worst.toExponential(1)}`);
 assert.equal(sha1(c12.hash), DIGEST12, 'E② ⑫の digest が違う'); assert.equal(sha1(full.cache.hash), DIGEST14, 'E② ⑭の digest が違う');
 ok(`E② digest 固定：⑫ ${DIGEST12.slice(0, 8)}・⑭ ${DIGEST14.slice(0, 8)}（面 ${full.cache.faces.length}）`);
 assert.equal(X.flatState(full.cache).ok, true, 'E③ ⑭の平らな状態が成立しない'); assert.equal(X.flatState(c12).ok, true, 'E③ ⑫の平らな状態が成立しない');
 ok('E③ flatState 成立（⑫・⑭）');
 /* ④ Python：JS の⑫の面から reverse 3手を作り、手ごとに JS の再生と照合 */
 const faceDump = cache => cache.faces.map(f => ({ faceId: f.faceId, layerPath: f.layerPath, poly: f.poly, xf: f.xf, layer: f.layer }));
 const dump = { name: 'つる完成の原本', kind: 'start', start: faceDump(c12), steps: C(FULL.steps.slice(K)), results: [] };
 for (let k = K; k < FULL.steps.length; k++) { const cc = E.replay({ ...C(FULL), steps: C(FULL.steps.slice(0, k + 1)) }), sid = FULL.steps[k].id;
  dump.results.push({ faces: faceDump(cc), rev: cc.bonds.filter(b => b.reversedBy && b.reversedBy.includes(sid)).map(b => b.faceIds.slice()) }) }
 const tmp = path.join(require('node:os').tmpdir(), `crane_full_dump_${process.pid}.json`); fs.writeFileSync(tmp, JSON.stringify(dump));
 const py = require('node:child_process').spawnSync(process.env.ORIGAMI_PYTHON || 'python', ['-B', 'test_reverse_python.py', '--crane-dump', tmp], { cwd: DIR, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
 fs.rmSync(tmp, { force: true });
 assert.equal(py.status, 0, 'E④ Python の照合が通らない: ' + (py.stdout + py.stderr).trim().slice(-400));
 ok('E④ Python 照合（JS の⑫の面から）：' + py.stdout.trim().replace(/^OK /, ''));
}
console.log(`\n${n} checks passed（node）`);
/* F ⑤ 実 Chrome（⑫は折らずにページを開く） */
if (!process.argv.includes('--no-browser')) require(path.join(DIR, 'test_crane12_browser.js')).open(async c => {
 const { ev, cdp, clickBtn, recipe, downloads, mark, sleep, poll } = c, fsp = require('node:fs/promises');
 const hashNow = () => ev('freeFoldDebug.state.cache.hash');
 const inject = r => ev(`(() => { const st = freeFoldDebug.state, r = ${JSON.stringify(r)}; st.recipe = r; st.cache = FreeFoldEngine.replay(r);
  st.revision = 0; st.cacheRevision = 0; st.committed = st.cache; st.redoStack = []; st.pending = null; return true })()`);
 mark('F⑤ 原本を読み込む → 再生 → undo/redo');
 await inject(FULL); await clickBtn('op'); await clickBtn('op');
 assert.equal(await hashNow(), full.cache.hash, 'F⑤ 画面で再生した⑭が node の⑭と違う');
 for (let i = 0; i < 3; i++) await clickBtn('undo');
 assert.equal(await hashNow(), c12.hash, 'F⑤ undo 3回で⑫に戻らない');
 for (let i = 0; i < 3; i++) await clickBtn('redo');
 assert.equal(await hashNow(), full.cache.hash, 'F⑤ redo 3回で⑭に戻らない');
 mark('F⑤ 保存 → 再読込 → undo/redo');
 await clickBtn('save');
 const f = await poll(async () => (await fsp.readdir(downloads)).find(v => v.endsWith('.origami.json')), 'download');
 const saved = JSON.parse(await fsp.readFile(path.join(downloads, f), 'utf8'));
 assert.equal(JSON.stringify(saved), JSON.stringify(FULL), 'F⑤ 保存した原本の文字が読み込んだ原本と違う');
 await cdp('Page.reload', {});
 await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reload');
 await inject(saved); await clickBtn('op'); await clickBtn('op');
 assert.equal(await hashNow(), full.cache.hash, 'F⑤ 再読込で同じ紙にならない');
 for (let i = 0; i < 3; i++) await clickBtn('undo');
 assert.equal(await hashNow(), c12.hash, 'F⑤ 再読込後の undo 3回で⑫に戻らない');
 for (let i = 0; i < 3; i++) await clickBtn('redo');
 assert.equal(await hashNow(), full.cache.hash, 'F⑤ 再読込後の redo 3回で⑭に戻らない');
 assert.equal(JSON.stringify(await recipe()), JSON.stringify(FULL), 'F⑤ undo/redo で原本の文字が変わった');
 console.log('  ok F⑤ 実 Chrome：原本を読み込む → 再生（node と同じ）→ undo/redo → 保存（同じ文字）→ 再読込 → undo/redo');
});
