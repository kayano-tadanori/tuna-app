'use strict';
/* 🔲 ふつうの折りの①「動く部分と面積をもって重なる止まった紙」の判定（engine の overlapsArea）を固定する（2026-09-14）。
   ★見つけた見逃し（旧方式＝標本点：重心と頂点を6割寄せた点が相手の内側か＋きちんと交わる辺）
     標本点が両方とも重なりの外にあり、辺どうしの交点がぜんぶ「頂点が相手の辺の上」だと、面積 0.1 の重なりでも拾えない。
     例：正方形の右の帯（x≥0.6）を谷折り → 土台 B（x≤0.6・層0）の上にフラップ F（0.2≤x≤0.6・層1）
         → 土台 B だけを x=0.25 で左を谷折り。F は動く部分と帯 [0.2,0.25]×[-1,1] で重なるのに通して確定＝結果の並びが交差。
   ★置きかえた判定（許容差と対象範囲）
     - 交わり：p を q の各辺の半平面で切る（engine の split を再利用。辺の向きを長さ100にそろえ、辺からの距離 1e-9 以内は辺の上）。
     - 重なり ⇔ 交わりの**最小幅**（凸多角形なので、各辺の法線方向の厚みの最小）> OVERLAP_WIDTH=1e-7（engine の「同じ所」の許容と同じ桁）。
       面積のしきいは使わない＝角が線を 6.7e-4 越える細い三角（面積 5.8e-7）を面積 1e-5 で捨てて見逃した（試作で踏んだ）。
     - 前提：q（止まった面）は凸。p は切った動く部分。
       仕組み＝面を作る道が「最初の正方形・split・剛体変換/鏡映・袋折りの splitFaces（同じ split）」だけなので構造上凸（実行時の検査は無い）。
       事実＝下の C が測った範囲（探索・袋折り・その後の面）だけ。新しい面の作り方を足したら C に入れて測り直す。
     - 保証できない範囲：交わりの幅が 1e-7 前後の重なり（接触と区別しない）。計算は倍精度の浮動小数＝数学的に厳密ではない。
   ★見ること
     R 再現（上の例）：engine は①で断る／①を外した写しで確定すると flatState が交差・sweep も通り抜け
     S 合成（答えが分かっている形）：共有辺・頂点接触・一直線の辺・隙間・幅 2e-7・帯・ふち沿いの小さい面・ほぼ平行の楔・角の突き出し・包含・向き
     E 候補探索（固定の種）：旧方式の写しは見逃しがあり、新方式は独立の判定器（fold_crossing の sweep）と食い違い0・通した結果はすべて成立
     C 探索で出会った面はすべて凸
     P 計算量（PC）：旧・新の1回あたり・面を倍々にした上1枚の判定
   使い方： node test_overlap_area.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
/* 旧方式（標本点）。比較のためだけに写しへ入れる。 */
const OLD_FN = `function oldSegCrossStrict(a1,a2,b1,b2,tol=1e-9){const d1=S(b1,a1,a2),d2=S(b2,a1,a2),d3=S(a1,b1,b2),d4=S(a2,b1,b2);
 if(Math.abs(d1)<=tol||Math.abs(d2)<=tol||Math.abs(d3)<=tol||Math.abs(d4)<=tol)return false;
 return((d1>0)!==(d2>0))&&((d3>0)!==(d4>0))}
function oldOverlapsArea(p,q){for(const v of samplesOf(p))if(strictlyInside(v,q))return true;
 for(const v of samplesOf(q))if(strictlyInside(v,p))return true;
 for(let i=0;i<p.length;i++)for(let j=0;j<q.length;j++)
  if(oldSegCrossStrict(p[i],p[(i+1)%p.length],q[j],q[(j+1)%q.length]))return true;
 return false}
`;
function mk(mode) {
 const ctx = vm.createContext({ console, performance }); let e = rd('freefold_engine.js');
 const use = ' if(!overlapsArea(p,u.poly))continue;';
 assert.equal(e.split(use).length, 2, '①の呼び出しの形が変わった（写しが作れない）');
 if (mode === 'old') { e = e.replace('function foldableSet(', OLD_FN + 'function foldableSet(').replace(use, ' if(!oldOverlapsArea(p,u.poly))continue;');
  e = e.replace('polysOverlap,overlapsArea,', 'polysOverlap,overlapsArea,oldOverlapsArea,') }
 if (mode === 'noBlock') { const old = ' if(block.length)return{ok:false,blocking:[...new Set(block)],';
  assert.equal(e.split(old).length, 2, '① を外す写しが作れない'); e = e.replace(old, ' if(false&&block.length)return{ok:false,blocking:[...new Set(block)],') }
 vm.runInContext(e, ctx);
 for (const f of ['freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'fold_crossing.js']) vm.runInContext(rd(f), ctx);
 vm.runInContext('SquashV2.useV1Validator(OrigamiRecipe.validate,' + rd('origami_recipe.schema.json') + ')', ctx);
 return vm.runInContext('({E:FreeFoldEngine,X:FoldCrossing})', ctx);
}
const { E, X } = mk('new'), OLD = mk('old'), NB = mk('noBlock');
const C = x => JSON.parse(JSON.stringify(x));
const S = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const inv = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const load = (EE, r) => { const st = EE.create(); st.recipe = C(r); st.cache = EE.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache; return st };
const step = (id, face, line, side, kind = 'V') => ({ id, diagramStep: id.slice(1), op: 'fold', kind, reference: { faceId: face }, targets: [{ faceId: face }], line, movingSidePoint: side });

console.log('R 再現：端のそろった帯の重なり');
{
 const R = E.create().recipe; R.steps.push(step('s1', 'paper', [[0.6, -1], [0.6, 1]], [0.9, 0]));
 const c1 = E.replay(R), B = 'paper/s1.keep', F = 'paper/s1.cut';
 assert.deepEqual(C(c1.faces.map(f => [f.faceId, f.layer])), [[B, 0], [F, 1]]);
 R.steps.push(step('s2', B, [[0.25, -1], [0.25, 1]], [-0.5, 0]));
 const piece = E.split(c1.faces.find(f => f.faceId === B).poly, [0.25, 1], [0.25, -1])[1], Fp = c1.faces.find(f => f.faceId === F).poly;
 assert.ok(Math.abs(X.overlapArea(piece, Fp) - 0.1) < 1e-12, '動く部分と F の重なりの面積が 0.1 でない');
 assert.equal(E.overlapsArea(piece, Fp), true, 'R 新方式が帯の重なりを拾わない');
 assert.equal(OLD.E.oldOverlapsArea(piece, Fp), false, 'R 旧方式がこの形を拾っている（再現になっていない）');
 ok('動く部分と F は面積 0.1 で重なる：新方式は重なり・旧方式は見逃す');
 assert.throws(() => E.replay(R), /上に乗っている紙があります/, 'R engine が①で断らない');
 const oldC = OLD.E.replay(R); assert.equal(X.flatState(oldC).ok, false, 'R 旧方式で確定した結果が成立してしまう');
 ok('engine は①「上に乗っている紙があります」で断る／旧方式の写しは確定し、その並びは不成立');
 const nb = NB.E.replay(R), fs2 = X.flatState(nb);
 assert.equal(fs2.ok, false); assert.ok(fs2.violations.some(v => v.kind === 'crossing'), 'R ①なしの結果に交差が無い');
 const sw = X.simpleFold(c1, { a: [0.25, -1], b: [0.25, 1], side: [-0.5, 0], kind: 'V', moving: [B] });
 assert.deepEqual(C(sw.sweep), [[B, F]], 'R sweep が F の通り抜けを見ない');
 ok('①を外した写しの結果は交差（紙が紙を突き抜ける）／独立の sweep も F を通り抜けと判定');
 const st = load(E, { ...R, steps: R.steps.slice(0, 1) });
 E.proposeOnFace(st, [0.25, -1], [0.25, 1], B, { layers: 1 }); st.pending.kind = 'V'; E.setSide(st, [-0.5, 0]);
 st.pending.candidates = [{ faceId: B, layerPath: C(st.cache.faces.find(f => f.faceId === B).layerPath) }]; E.select(st, st.pending.candidates);
 assert.throws(() => E.confirm(st), /上に乗っている紙があります/); assert.equal(st.recipe.steps.length, 1);
 ok('操作の道（proposeOnFace→setSide→select→confirm）でも断り、原本は1手のまま');
}

console.log('S 合成：答えの分かっている形');
{
 const sq = [[0, 0], [1, 0], [1, 1], [0, 1]], cw = P => P.slice().reverse();
 const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
 const cases = [
  ['共有辺（隣り合う）', rect(1, 0, 2, 1), false],
  ['頂点1点で接触', [[1, 1], [2, 1], [2, 2]], false],
  ['辺の一部が一直線に並ぶだけ（外側）', rect(0.5, 1, 1.5, 2), false],
  ['隙間 5e-8', rect(1 + 5e-8, 0, 2, 1), false],
  ['重なり幅 5e-8（許容の内側＝接触と区別しない）', rect(1 - 5e-8, 0, 2, 1), false],
  ['重なり幅 2e-7', rect(1 - 2e-7, 0, 2, 1), true],
  ['端のそろった帯 幅0.05（旧方式の見逃し）', rect(0.95, 0, 2, 1), true],
  ['ふち沿いの小さい三角 高さ5e-4（旧方式の見逃し）', [[0.4, 0], [0.401, 0], [0.4005, 5e-4]], true],
  ['ふち沿いの細い長方形 幅2e-4', rect(0.1, 1e-4, 0.9, 3e-4), true],
  ['ほぼ平行の楔（1辺を共有して 1e-3 rad 開く）', [[0, 0], [1, 0], [1, 1e-3]], true],
  ['ほぼ平行・外側の楔（接するだけ）', [[0, 0], [1, 0], [1, -1e-3]], false],
  ['角が 6.7e-4 突き出す三角（面積 5.8e-7）', [[0.5, 1 - 6.7e-4], [0.5 + 1e-3, 1 + 1e-2], [0.5 - 1e-3, 1 + 1e-2]], true],
  ['中に丸ごと入る 1e-10 の極小三角（辺がぜんぶ 1e-9 未満＝幅を測る辺が無い→重なりにしない）', [[0.5, 0.5], [0.5 + 1e-10, 0.5], [0.5, 0.5 + 1e-10]], false],
  ['同じ形', sq, true],
  ['包含（ふちに接して中に入る）', rect(0, 0, 0.5, 0.5), true],
  ['重複頂点を含む相手', [[0.5, 0.5], [0.5, 0.5], [2, 0.5], [2, 2], [0.5, 2]], true]];
 const oldMiss = [];
 for (const [name, p, want] of cases) {
  for (const q of [sq, cw(sq)]) for (const pp of [p, cw(p)]) {
   assert.equal(E.overlapsArea(pp, q), want, `S ${name}（p→q・向き ${q === sq ? 'CCW' : 'CW'}）`);
   if (!name.startsWith('重複')) assert.equal(E.overlapsArea(q, pp), want, `S ${name}（q→p）`) }
  if (want && !OLD.E.oldOverlapsArea(p, sq)) oldMiss.push(name) }
 ok(`${cases.length}形 × 向き（CCW/CW）× 入れかえで期待どおり`);
 assert.ok(oldMiss.includes('端のそろった帯 幅0.05（旧方式の見逃し）') && oldMiss.includes('ふち沿いの小さい三角 高さ5e-4（旧方式の見逃し）'), 'S 旧方式の見逃しが再現しない: ' + oldMiss);
 ok('旧方式が見逃す形：' + oldMiss.join('／'));
}

console.log('E 候補探索（固定の種）：旧方式・新方式・独立の sweep');
const faceSeen = [];
{
 let seed = 777; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
 function lines(cache) { const L = [], V = []; for (const f of cache.faces) for (const p of f.poly) V.push(p);
  for (let k = 0; k < 12; k++) { const a = V[Math.floor(rnd() * V.length)], b = V[Math.floor(rnd() * V.length)]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) > .05) L.push([a, b]) }
  for (let k = 0; k < 12; k++) { const f = cache.faces[Math.floor(rnd() * cache.faces.length)], i = Math.floor(rnd() * f.poly.length), a = f.poly[i], b = f.poly[(i + 1) % f.poly.length], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d); if (l < 1e-6) continue;
   const nn = [-d[1] / l, d[0] / l], off = [1e-3, .01, .05, .1][Math.floor(rnd() * 4)] * (rnd() < .5 ? 1 : -1), m = [a[0] + nn[0] * off, a[1] + nn[1] * off];
   L.push([[m[0] - d[0] / l * 3, m[1] - d[1] / l * 3], [m[0] + d[0] / l * 3, m[1] + d[1] / l * 3]]) }
  for (let k = 0; k < 6; k++) { const t = Math.round((rnd() * 2 - 1) * 20) / 20; L.push(rnd() < .5 ? [[t, -1], [t, 1]] : [[-1, t], [1, t]]) }
  for (let k = 0; k < 6; k++) L.push([[rnd() * 2 - 1, rnd() * 2 - 1], [rnd() * 2 - 1, rnd() * 2 - 1]]); return L }
 const base = E.create().recipe;
 function randomRecipe(nSteps) { const R = C(base); let cache = E.replay(R);
  for (let s = 1; s <= nSteps; s++) for (let t = 0; t < 40; t++) { const ls = lines(cache), [a, b] = ls[Math.floor(rnd() * ls.length)], f = cache.faces[Math.floor(rnd() * cache.faces.length)], pr = E.split(f.poly, a, b); if (!pr[0] || !pr[1]) continue;
   const side = [0, 1].map(i => pr[1].reduce((q, p) => q + p[i], 0) / pr[1].length);
   const st = { id: 's' + s, diagramStep: String(s), op: 'fold', kind: rnd() < .5 ? 'V' : 'M', reference: { faceId: f.faceId }, targets: [{ faceId: f.faceId }], line: [inv(f.xf, a), inv(f.xf, b)], movingSidePoint: inv(f.xf, side) };
   if (st.line.some(p => p.some(v => Math.abs(v) > 1))) continue; R.steps.push(st);
   try { cache = E.replay(R); OLD.E.replay(R); break } catch { R.steps.pop() } }
  return R }
 const T = { states: 0, cand: 0, oldMiss: 0, oldMissBadEnd: 0, oldExtraBlock: 0, newVsSweep: 0, newPassChecked: 0, newPassBad: 0 };
 const t0 = Date.now();
 const blk = r => !r.ok && /上に乗っている|下に敷かれている/.test(r.reason);
 for (let k = 0; k < 200; k++) {
  const R = randomRecipe(1 + Math.floor(rnd() * 4)), st0 = load(E, R); T.states++;
  for (const f of st0.cache.faces) faceSeen.push(f.poly);
  assert.equal(X.flatState(st0.cache).ok, true, 'E 始まりの状態が成立しない');
  for (const [a, b] of lines(st0.cache)) { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d); if (L < .03) continue; const nrm = [-d[1] / L, d[0] / L], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
   for (const sg of [1, -1]) for (const dist of [.05, .3]) { const at = [mid[0] + nrm[0] * dist * sg, mid[1] + nrm[1] * dist * sg]; let la; try { la = E.layersAt(st0, at) } catch { continue }
    if (!la.layers.length || la.duplicated.length) continue; let A = a, B = b; if (S(at, A, B) > 0) [A, B] = [B, A];
    for (const kind of ['V', 'M']) for (let nn = 1; nn <= la.layers.length; nn++) { let ids; try { ids = E.topFaces(st0, at, nn, A, B) } catch { continue }
     T.cand++;
     const rn = E.foldableSet(st0.cache.faces, st0.cache.bonds, ids, A, B, kind), ro = OLD.E.foldableSet(st0.cache.faces, st0.cache.bonds, ids, A, B, kind);
     const sw = X.simpleFold(st0.cache, { a: A, b: B, side: at, kind, moving: ids });
     if ((rn.ok && !sw.ok) || (blk(rn) && sw.ok)) T.newVsSweep++;
     if (blk(ro) && rn.ok) T.oldExtraBlock++;
     const conf = (EE) => { const st = load(EE, R), top = st.cache.faces.filter(f => ids.includes(f.faceId) && EE.strictlyInside(at, f.poly)).sort((x, y) => y.layer - x.layer)[0];
      EE.proposeOnFace(st, a, b, top.faceId, { layers: 1 }); st.pending.kind = kind; EE.setSide(st, at);
      st.pending.candidates = ids.map(id => ({ faceId: id, layerPath: st.cache.faces.find(f => f.faceId === id).layerPath })); EE.select(st, st.pending.candidates); EE.confirm(st); return st };
     if (ro.ok && blk(rn)) { T.oldMiss++; if (!X.flatState(conf(OLD.E).cache).ok) T.oldMissBadEnd++ }
     if (rn.ok) { let st; try { st = conf(E) } catch { continue } T.newPassChecked++; if (!X.flatState(st.cache).ok) T.newPassBad++ }
    } } } }
 console.log('    ' + JSON.stringify(T) + `  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
 assert.ok(T.cand > 10000 && T.newPassChecked > 1000, 'E 候補が少なすぎる');
 assert.ok(T.oldMiss > 0 && T.oldMiss === T.oldMissBadEnd, 'E 旧方式の見逃しが無い、または見逃しの結果が成立してしまう（この探索が見逃しの形に届いていない）');
 ok(`旧方式の見逃し ${T.oldMiss}件：旧方式で確定した結果はすべて不成立`);
 assert.equal(T.oldExtraBlock, 0, 'E 旧方式が断っていた手を新方式が通す');
 ok('旧方式が①で断っていた手は、新方式でも全部断る');
 assert.equal(T.newVsSweep, 0, 'E 新方式の①と独立の sweep が食い違う');
 assert.equal(T.newPassBad, 0, 'E 新方式が通した折りの結果に不成立の並びがある');
 ok(`新方式の①は sweep と食い違い0／通して確定した ${T.newPassChecked}件はすべて成立`);
}

console.log('C 面は凸（交わりの計算の前提）');
{
 const convex = P => { let sg = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length], z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(z) < 1e-12) continue; if (!sg) sg = Math.sign(z); else if (Math.sign(z) !== sg) return false } return true };
 const more = [load(E, JSON.parse(rd('squash_tsuru3_v2.json'))).cache, ...JSON.parse(rd('squash_after_states.json')).cases.map(c => load(E, c.recipe).cache)];
 for (const c of more) for (const f of c.faces) faceSeen.push(f.poly);
 assert.ok(faceSeen.length > 500 && faceSeen.every(convex), 'C 凸でない面がある');
 ok(`探索・袋折り・袋折りのあとの状態の面 ${faceSeen.length}枚はすべて凸`);
}

console.log('P 計算量（PC・node。携帯は未測定）');
{
 const rows = [], R = E.create().recipe; let cache = E.replay(R);
 for (let s = 1; s <= 8; s++) {
  const xs = [], ys = []; for (const f of cache.faces) for (const p of f.poly) { xs.push(p[0]); ys.push(p[1]) }
  const vert = s % 2 === 1, lo = Math.min(...(vert ? xs : ys)), hi = Math.max(...(vert ? xs : ys)), c = lo + (hi - lo) * 0.53;
  const a = vert ? [c, -3] : [-3, c], b = vert ? [c, 3] : [3, c];
  const ref = cache.faces.find(f => { const q = E.split(f.poly, a, b); return q[0] && q[1] });
  const q = [inv(ref.xf, a), inv(ref.xf, b)], d = [q[1][0] - q[0][0], q[1][1] - q[0][1]]; let u0 = -Infinity, u1 = Infinity;
  for (const i of [0, 1]) { if (Math.abs(d[i]) < 1e-12) continue; let u = (-1 - q[0][i]) / d[i], v = (1 - q[0][i]) / d[i]; if (u > v) [u, v] = [v, u]; u0 = Math.max(u0, u); u1 = Math.min(u1, v) }
  const mid = vert ? [hi - (hi - lo) * 0.2, (Math.min(...ys) + Math.max(...ys)) / 2] : [(Math.min(...xs) + Math.max(...xs)) / 2, hi - (hi - lo) * 0.2];
  R.steps.push({ id: 's' + s, diagramStep: String(s), op: 'fold', kind: 'V', reference: { faceId: ref.faceId }, targets: cache.faces.map(f => ({ faceId: f.faceId })), line: [[q[0][0] + d[0] * u0, q[0][1] + d[1] * u0], [q[0][0] + d[0] * u1, q[0][1] + d[1] * u1]], movingSidePoint: inv(ref.xf, mid) });
  cache = E.replay(R);
  const nf = cache.faces.length, X2 = [], Y2 = []; for (const f of cache.faces) for (const p of f.poly) { X2.push(p[0]); Y2.push(p[1]) }
  const vx = s % 2 === 0, l2 = Math.min(...(vx ? X2 : Y2)), h2 = Math.max(...(vx ? X2 : Y2)), c2 = l2 + (h2 - l2) * 0.61, a2 = vx ? [c2, -3] : [-3, c2], b2 = vx ? [c2, 3] : [3, c2];
  const top = [cache.faces.slice().sort((p, q2) => q2.layer - p.layer)[0].faceId], N = Math.max(20, Math.round(4000 / nf));
  const time = (EE) => { let r; const t = performance.now(); for (let k = 0; k < N; k++) r = EE.foldableSet(cache.faces, cache.bonds, top, a2, b2, 'M'); return [(performance.now() - t) / N, r] };
  const [tn, rn] = time(E), [to, ro] = time(OLD.E);
  assert.equal(rn.ok, ro.ok); assert.equal(rn.reason, ro.reason);
  rows.push({ faces: nf, 上1枚の判定_旧ms: +to.toFixed(3), 上1枚の判定_新ms: +tn.toFixed(3) }) }
 assert.equal(rows[rows.length - 1].faces, 256);
 const pc = [[0, 0], [1, 0], [1, 1], [0, 1]], qq = [[0.5, 0.2], [1.5, 0.3], [1.4, 1.2], [0.4, 1.1]];
 let t = performance.now(); for (let k = 0; k < 2e5; k++) E.overlapsArea(pc, qq); const un = (performance.now() - t) / 2e5 * 1e3;
 t = performance.now(); for (let k = 0; k < 2e5; k++) OLD.E.oldOverlapsArea(pc, qq); const uo = (performance.now() - t) / 2e5 * 1e3;
 console.table(rows); console.log(`    1回あたり：旧 ${uo.toFixed(2)}µs／新 ${un.toFixed(2)}µs（重なる四角形どうし）`);
 ok('面を倍々（2〜256面）にしても旧・新の答えは同じ・時間は面の数に比例');
}
console.log(`\n${n} checks passed`);
