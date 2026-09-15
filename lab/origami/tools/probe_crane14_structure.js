'use strict';
/* 🔎 つる⑬（脚の中割り折り）の事前確認：⑫のあとの紙の構造を実データから取り出す（2026-09-16・本人指示・実装前）。
   材料＝crane12_state.json（node test_crane12.js --write が画面と同じ engine の道で作る⑫のあとの原本）。
   ⚠これは調査の出力だけで、新しい op も保存形式も足さない。面ID・手番号は判定に使わない（出力の名前として出すだけ）。
   見ること
     ① 先端：花弁の先端（cache.petals の花弁の面の頂点）と、そうでない方＝脚の先端
     ② 中割りの線の候補：中心線に直角で、脚の先端から「細くした所の終わり」までの中ほど（線の角度は運動のモデルで決める＝ここでは構造を見るための切り口）
     ③ 線より先端側の面を、先端側の内部へ入る結びでたどってまとまりに分ける（背を開く・フラップと同じ辿り方）
     ④ まとまりごとに：面・表裏（det）・層、まとまりの中の背（外形の背＝片側に紙が無い）、線をまたぐ結び（線の外の胴の面との結び）
     ⑤ 脚の中の1点の重なり（上から）に、どのまとまりの面が並ぶか＝「脚の2枚が背でつながる」「胴の層のあいだに何があるか」
   使い方： node probe_crane14_structure.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname, rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'petal_v2.js', 'fold_crossing.js']) vm.runInThisContext(rd(f));
SquashV2.useV1Validator(OrigamiRecipe.validate, JSON.parse(rd('origami_recipe.schema.json')));
const E = FreeFoldEngine, N = FreeFoldSnap;
const recipe = JSON.parse(rd('crane12_state.json')).recipe;
const st = E.create(); st.recipe = recipe; st.cache = E.replay(recipe); st.committed = st.cache;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), r3 = p => p.map(v => +v.toFixed(3));
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const inv = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const det = m => m[0] * m[3] - m[1] * m[2];
const faceOf = id => st.cache.faces.find(f => f.faceId === id);
const short = id => id.replace(/^paper\//, '').split('/').map(s => s.replace(/\.(keep|cut)$/, m => m === '.keep' ? 'k' : 'c')).join('/');
const out = [];
const say = (...a) => { const s = a.join(' '); out.push(s); console.log(s) };

/* ① 先端 */
const corners = N.outlineCorners(st);
/* 花弁の面は⑫で割れているかもしれない＝その面の子（faceId が前方一致）もふくめる */
const petalPts = (st.cache.petals || []).flatMap(pt => ['T2R', 'T2L'].flatMap(k => st.cache.faces.filter(f => f.faceId === pt.faceOf[k] || f.faceId.startsWith(pt.faceOf[k] + '/'))).flatMap(f => f.poly));
let far = null; for (const a of corners) for (const b of corners) if (!far || dist(a, b) > dist(far[0], far[1])) far = [a, b];
const petalTip = far.find(p => petalPts.some(q => dist(p, q) < 1e-9)), legTip = far.find(p => p !== petalTip);
say('① 外形の角', JSON.stringify(corners.map(r3)), '／花弁の先端', JSON.stringify(r3(petalTip)), '／脚の先端', JSON.stringify(r3(legTip)));
const u = [(legTip[0] - petalTip[0]) / dist(legTip, petalTip), (legTip[1] - petalTip[1]) / dist(legTip, petalTip)], nrm = [-u[1], u[0]];
/* 細くした所の終わり＝脚の先端から見て、外形の角のうち先端でない角（⑫でできた角）の中心線への射影のいちばん遠い所 */
const along = p => (p[0] - legTip[0]) * -u[0] + (p[1] - legTip[1]) * -u[1];
const inner = corners.filter(p => p !== petalTip && p !== legTip).map(along).filter(v => v > 1e-9);
const end12 = Math.min(...inner);/* 脚が胴につながる所＝先端でない外形の角のうち、脚の先端にいちばん近い射影 */
const s = end12 * .5, M = [legTip[0] - u[0] * s, legTip[1] - u[1] * s];
let A = [M[0] - nrm[0], M[1] - nrm[1]], B = [M[0] + nrm[0], M[1] + nrm[1]];
if (E.side(legTip, A, B) > 0) [A, B] = [B, A];/* 先端側が動く側（S<0） */
say('② 切り口：脚の先端から', end12.toFixed(3), 'の所まで細くしてある → その中ほど', s.toFixed(3), 'で中心線に直角');

/* ③ 先端側の面をまとまりに分ける */
const tipSide = E.sideAllFaces(st, A, B), comps = [], seen = new Set();
for (const id of tipSide) { if (seen.has(id)) continue;
 /* flapFaces はその場所のいちばん上から始める。ここでは任意の面から＝ engine の辿り方を同じ規則で写す（movingSetOf は外へ出していないので、結びと flapFaces の結果で確かめる） */
 const set = new Set([id]), q = [id];
 while (q.length) { const x = q.pop(); for (const bd of st.cache.bonds) { const i = bd.faceIds.indexOf(x); if (i < 0) continue; const y = bd.faceIds[1 - i]; if (set.has(y) || !tipSide.includes(y)) continue;
  const fx = faceOf(bd.faceIds[0]), cur = bd.seg.map(p => apply(fx.xf, p)), sd = p => E.side(p, A, B) / dist(A, B);
  if (sd(cur[0]) >= -1e-9 && sd(cur[1]) >= -1e-9) continue;
  set.add(y); q.push(y) } }
 [...set].forEach(v => seen.add(v)); comps.push([...set]) }
say('③ 先端側の面', tipSide.length, '面 → 結びでたどったまとまり', comps.length, '個（面の数', comps.map(c => c.length).join('・'), '）');
/* engine の flapFaces（いちばん上から）と一致するか：各まとまりの中の1点で */
for (const [ci, c] of comps.entries()) {
 const f = faceOf(c[0]), part = E.split(f.poly, A, B)[1], cen = part.reduce((s, p) => [s[0] + p[0] / part.length, s[1] + p[1] / part.length], [0, 0]);
 const top = E.stackAt(st, cen)[0];
 const fl = top && c.includes(top.faceId) ? E.flapFaces(st, cen, A, B).sort() : null;
 say(`   まとまり${ci + 1}：engine の flapFaces（その点のいちばん上から）と`, fl ? (JSON.stringify(fl) === JSON.stringify(c.slice().sort()) ? '同じ' : '違う') : '（その点のいちばん上がこのまとまりでない）');
}

/* ④ まとまりごとの構造 */
const tipSet = new Set(tipSide);
for (const [ci, c] of comps.entries()) {
 const set = new Set(c);
 const faces = c.map(faceOf).sort((a, b) => b.layer - a.layer);
 say(`④ まとまり${ci + 1}（${c.length}面）`);
 for (const f of faces) say('    面', short(f.faceId), 'layer', f.layer, det(f.xf) > 0 ? '表向き' : '裏向き');
 const inside = st.cache.bonds.filter(bd => set.has(bd.faceIds[0]) && set.has(bd.faceIds[1]));
 for (const bd of inside) {
  const fx = faceOf(bd.faceIds[0]), fy = faceOf(bd.faceIds[1]), cur = bd.seg.map(p => apply(fx.xf, p));
  const mid = [(cur[0][0] + cur[1][0]) / 2, (cur[0][1] + cur[1][1]) / 2], d = [cur[1][0] - cur[0][0], cur[1][1] - cur[0][1]], L = Math.hypot(...d), n = [-d[1] / L, d[0] / L];
  const a = E.stackAt(st, [mid[0] + n[0] * .002, mid[1] + n[1] * .002]).length, b = E.stackAt(st, [mid[0] - n[0] * .002, mid[1] - n[1] * .002]).length;
  const where = !a || !b ? '外形（片側に紙なし）' : '内部';
  say('    結び', bd.kind, where, JSON.stringify(cur.map(r3)), short(bd.faceIds[0]), det(fx.xf) > 0 ? '表' : '裏', '↔', short(bd.faceIds[1]), det(fy.xf) > 0 ? '表' : '裏');
 }
 const cross = st.cache.bonds.filter(bd => set.has(bd.faceIds[0]) !== set.has(bd.faceIds[1]));
 for (const bd of cross) { const inId = set.has(bd.faceIds[0]) ? bd.faceIds[0] : bd.faceIds[1], outId = bd.faceIds[0] === inId ? bd.faceIds[1] : bd.faceIds[0];
  const fx = faceOf(inId), cur = bd.seg.map(p => apply(fx.xf, p));
  say('    まとまりの外との結び', bd.kind, JSON.stringify(cur.map(r3)), short(inId), '→', short(outId), 'layer', faceOf(outId).layer, tipSet.has(outId) ? '（先端側の別のまとまり）' : '（胴）') }
}

/* ⑤ 脚の中の点の重なり（上から）：どのまとまりの面が、どの順に並ぶか */
const probeAt = [legTip[0] - u[0] * s * .5 + nrm[0] * 1e-3, legTip[1] - u[1] * s * .5 + nrm[1] * 1e-3];
const probe2 = [M[0] + u[0] * -.05 + nrm[0] * 1e-3, M[1] + u[1] * -.05 + nrm[1] * 1e-3];
for (const [lab, p] of [['脚の中（先端寄り）', probeAt], ['切り口のすぐ胴側', probe2]]) {
 const stack = E.stackAt(st, p);
 say(`⑤ ${lab} ${JSON.stringify(r3(p))} の重なり（上から）：` + stack.map(v => { const ci = comps.findIndex(c => c.includes(v.faceId)); return `${ci >= 0 ? 'まとまり' + (ci + 1) : '胴'}:${det(faceOf(v.faceId).xf) > 0 ? '表' : '裏'}:L${v.layer}` }).join(' > '));
}
fs.writeFileSync(path.join(require('node:os').tmpdir(), 'crane14_structure.txt'), out.join('\n'));

/* ⑥ 脚の「表の半分・裏の半分」：まとまりの中の背を、中心線（脚の先端を通り u の向き）の上にあるものと外形のものに分け、
      中心線上の背を1本ずつ外したときにまとまりが2つに割れるか（＝その背が半分どうしをつなぐ唯一の背か） */
const onCenter = seg => seg.every(p => Math.abs((p[0] - legTip[0]) * u[1] - (p[1] - legTip[1]) * u[0]) < 1e-9);
for (const [ci, c] of comps.entries()) {
 const set = new Set(c), inside = st.cache.bonds.filter(bd => set.has(bd.faceIds[0]) && set.has(bd.faceIds[1]));
 const cur = bd => bd.seg.map(p => apply(faceOf(bd.faceIds[0]).xf, p));
 const center = inside.filter(bd => onCenter(cur(bd)));
 const parts = drop => { const rest = inside.filter(bd => !drop.includes(bd)), g = new Map(c.map(id => [id, []]));
  for (const bd of rest) { g.get(bd.faceIds[0]).push(bd.faceIds[1]); g.get(bd.faceIds[1]).push(bd.faceIds[0]) }
  const comp = [], sn = new Set(); for (const id of c) { if (sn.has(id)) continue; const q = [id], cc = []; sn.add(id); while (q.length) { const x = q.pop(); cc.push(x); for (const y of g.get(x)) if (!sn.has(y)) { sn.add(y); q.push(y) } } comp.push(cc) } return comp };
 say(`⑥ まとまり${ci + 1}：中心線上の背 ${center.length}本（${center.map(bd => bd.kind + JSON.stringify(cur(bd).map(r3))).join(' ')}）／外形の背 ${inside.filter(bd => !onCenter(cur(bd))).length}本`);
 for (const bd of center) { const pc = parts([bd]); say(`    中心線上の背 ${JSON.stringify(cur(bd).map(r3))} を外すと ${pc.length}つ（${pc.map(p => p.length + '面・層 ' + p.map(id => faceOf(id).layer).sort((a, b) => b - a).join(',')).join(' ／ ')}）`) }
 const pAll = parts(center); say(`    中心線上の背をぜんぶ外すと ${pAll.length}つ（${pAll.map(p => p.length + '面・層 ' + p.map(id => faceOf(id).layer).sort((a, b) => b - a).join(',')).join(' ／ ')}）`);
}
/* ⑦ 着地先（切り口で脚を折り返した先＝胴の側）の重なり：脚の半分とつながる胴の層と、そのあいだに入っている紙 */
const refl = (p, a, b) => { const d = [b[0] - a[0], b[1] - a[1]], L2 = d[0] * d[0] + d[1] * d[1], t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / L2, f = [a[0] + d[0] * t, a[1] + d[1] * t]; return [2 * f[0] - p[0], 2 * f[1] - p[1]] };
for (const [ci, c] of comps.entries()) {
 const f = faceOf(c[0]), part = E.split(f.poly, A, B)[1], cen = part.reduce((s, p) => [s[0] + p[0] / part.length, s[1] + p[1] / part.length], [0, 0]);
 const land = refl(cen, A, B), set = new Set(c);
 const joined = new Set(st.cache.bonds.filter(bd => set.has(bd.faceIds[0]) !== set.has(bd.faceIds[1])).map(bd => set.has(bd.faceIds[0]) ? bd.faceIds[1] : bd.faceIds[0]));
 const stack = E.stackAt(st, land);
 say(`⑦ まとまり${ci + 1}を切り口で折り返した先 ${JSON.stringify(r3(land))} の重なり（上から）：` + stack.map(v => { const k = comps.findIndex(cc => cc.includes(v.faceId)); return `${k >= 0 ? 'まとまり' + (k + 1) : joined.has(v.faceId) ? '胴（この脚とつながる）' : '胴'}:${det(faceOf(v.faceId).xf) > 0 ? '表' : '裏'}:L${v.layer}` }).join(' > '));
}
fs.writeFileSync(path.join(require('node:os').tmpdir(), 'crane14_structure.txt'), out.join('\n'));
