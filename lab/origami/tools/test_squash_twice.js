'use strict';
/* 🧺🧺 1作品で2回目の袋折り：半分折り2回 → 袋折り → 裏返す → 反対側の袋折り（2026-09-15）。
   ★engine（squash_v2.js ②-L）が決めること
     5枚以上の紙は「局所照合」：モデルの動く3区間（P1〜P3）と両端の止まる光線（R1・R4）の姿・上下が直前状態と同じ読みかえが1通りのときだけ受理し、
     周囲の紙（1回目の袋折りでできた紙）について 出発の上下・止まる光線の上の一周の順 を見る。結びの種類は確定形の置かれ方から決める。
   ★この検査が**engine の判定を使わずに**確かめること（周囲の紙との関係はモデルの証明では言えないので、別の手で見る）
     P 経路：1回目を表・裏返しの角の選び方ぜんぶ（17経路）で作り、裏返し v・h のあと、袋が1つに決まり確定できる
     G 形：確定形が4枚重ねの正方形（面積の合計4・外形の面積1）・結びの両側が同じ所・折り目は同じ置かれ方・背は光線で鏡映
     M 運動（途中のコマ・補助）：動かない区間は止まったまま／結びの両側の点が全コマで離れない／動く区間の頂点（O と止まる光線の端以外）は z>0
       ／動く三角形が z=0 に触れる所は止まる光線の上だけ（止まった紙の中に入らない）
     R 止まる光線の上の断面の一周の順を、コマの3D座標から作り直して、弦が交差しない・途中で順が変わらない（engine の ringAtAnchor は使わない）
     L 層：重なる2枚の上下が、確定の直前（t=1-ε）の高さと一致（止まる紙どうしは直前の上下のまま）／flatState（fold_crossing）が確定前後で成立
     S 保存→再読込→undo/redo で同じ面・結び・層（hash）／面と結びの並びを入れかえても同じ候補
     F 2回目のあとの ふつうの折り：総当りで 成立（ぜんぶ確定・flatState）／裂け・上に紙・下に紙で断る・代表例の保存→再読込→undo/redo
     N 断る：裏返していない紙（袋の上に紙）／角を折ったあとの紙（区間の途中で割れた紙）／合成：止まる光線の上の弦が交差する紙／失敗時に正式状態と候補を保つ
   ⛔言わないこと：厚みのある紙／degree4-45 以外の袋／頂点がまん中以外／区間の途中で割れた紙・頂点を通らない結びのある紙（未検証として断る）
   使い方： node test_squash_twice.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'fold_crossing.js']) vm.runInThisContext(rd(f));
const E = FreeFoldEngine, N = FreeFoldSnap, V2 = SquashV2, M = SquashModel, X = FoldCrossing;
V2.useV1Validator(OrigamiRecipe.validate, JSON.parse(rd('origami_recipe.schema.json')));
const C = x => JSON.parse(JSON.stringify(x)), J = JSON.stringify;
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const throws = (fn, re, msg) => assert.throws(fn, e => { assert.match(e.message, re, msg + '｜出た理由: ' + e.message); return true }, msg);
const load = r => { const st = E.create(); st.recipe = C(r); st.cache = E.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache; return st };
const snap = st => J({ r: st.recipe, rev: st.revision, h: st.cache.hash, redo: st.redoStack, p: st.pending });
const ap = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const inv = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const area = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1] } return Math.abs(s) / 2 };
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0));
const sectorCenter = s => { const a = M.RAY[s], b = M.RAY[(s + 1) % 8]; return [(a[0] + b[0]) / 3, (a[1] + b[1]) / 3] };
const faceOfSector = (faces, s) => faces.find(f => V2.pointIn(f.poly.map(p => inv(f.xf, p)), sectorCenter(s)));

/* 画面と同じ2回の半分折り（test_squash_flip.js と同じ手順） */
const VW = { toScreen: p => [p[0] * 240, -p[1] * 240] }, SC = p => VW.toScreen(p);
function tsuru2(axis, c1, c2) {
 const t = E.create(); if (axis) E.flip(t, axis);
 let g = N.grab(t, SC(c1), VW), cr = N.creaseForCorners(t, g.point, [-c1[0], -c1[1]]);
 E.proposeOnFace(t, cr.line[0], cr.line[1], cr.faceId, { layers: 1 }); E.setSide(t, cr.sidePoint); E.select(t, t.pending.candidates); E.confirm(t);
 g = N.grab(t, SC(c2), VW);
 const to = SC([-c2[0], -c2[1]]), s = N.foldTarget(t, g, [to[0] - 10 * Math.sign(-c2[0]), to[1] - 6 * Math.sign(c2[1])], [0, 0], VW, false);
 const c = N.creaseForCorners(t, g.point, s.target);
 E.proposeOnFace(t, c.line[0], c.line[1], c.faceId, { layers: 1 }); E.setSide(t, c.sidePoint); E.setLayers(t, 2, c.sidePoint);
 E.select(t, t.pending.candidates); E.confirm(t);
 return t;
}
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]], PATHS = [];
for (const axis of [null, 'v']) for (const c1 of CORNERS) for (const c2 of [[-c1[1], c1[0]], [c1[1], -c1[0]]]) PATHS.push({ axis, c1, c2 });
PATHS.push({ axis: 'h', c1: [-1, -1], c2: [-1, 1] });

/* ---------- 独立の見張り（engine の判定を使わない） ---------- */
/* M・R 用：区間ごとの3D三角形（素材の頂点の順：O, 光線 s の端, 光線 s+1 の端） */
const tris = (d, t) => V2.frames(d, t).map(f => f.tri);
function motionChecks(tag, before, after, d) {
 const T0 = tris(d, 0), T1 = tris(d, 1), nF = 400;
 /* 両端：t=0 はいまの紙、t=1 は確定形 */
 for (let s = 0; s < 8; s++) {
  const fb = faceOfSector(before.faces, s), fa = faceOfSector(after.faces, s);
  [[0, 0], M.RAY[s], M.RAY[(s + 1) % 8]].forEach((p, k) => {
   assert.ok(d3(T0[s][k], [...ap(fb.xf, p), 0]) < 1e-9, `${tag} M t=0 の区間 ${s} がいまの紙と違う`);
   assert.ok(d3(T1[s][k], [...ap(fa.xf, p), 0]) < 1e-9, `${tag} M t=1 の区間 ${s} が確定形と違う`) });
 }
 const moving = [...Array(8).keys()].filter(s => T0[s].some((v, k) => d3(v, T1[s][k]) > 1e-9));
 assert.equal(moving.length, 3, `${tag} M 動く区間が3つでない: ${moving}`);
 /* 止まる光線＝動く区間と止まる区間の境目（動く区間の並びの両端） */
 const anchorsRay = [...Array(8).keys()].filter(k => moving.includes((k + 7) % 8) !== moving.includes(k));
 assert.equal(anchorsRay.length, 2, `${tag} M 止まる光線が2本でない`);
 let worstBond = 0, minZ = Infinity, touch = 0;
 const bondRays = after.bonds.map(b => { const far = b.seg.find(p => Math.hypot(p[0], p[1]) > 1e-9); return M.RAY.findIndex(r => Math.abs(r[0] * far[1] - r[1] * far[0]) < 1e-9 && r[0] * far[0] + r[1] * far[1] > 0) });
 const before0 = tris(d, 0);
 for (let i = 1; i < nF; i++) { const t = i / nF, TT = tris(d, t);
  for (let s = 0; s < 8; s++) if (!moving.includes(s)) TT[s].forEach((v, k) => assert.ok(d3(v, before0[s][k]) < 1e-12, `${tag} M 止まる区間 ${s} が t=${t} で動いた`));
  /* 結び：光線 k の端は、区間 k-1 の3つめの頂点と区間 k の2つめの頂点（両側で同じ点） */
  for (const k of bondRays) worstBond = Math.max(worstBond, d3(TT[(k + 7) % 8][2], TT[k][1]));
  for (const s of moving) TT[s].forEach((v, k) => { const onAnchor = k === 0 || (k === 1 && anchorsRay.includes(s)) || (k === 2 && anchorsRay.includes((s + 1) % 8));
   if (!onAnchor) minZ = Math.min(minZ, v[2]) });
  /* 補助：動く三角形の z=0 との交わりが、止まった紙の中（止まる光線の外）に入らない */
  for (const s of moving) { const tri = TT[s], pts = [];
   for (let a = 0; a < 3; a++) { const p = tri[a], q = tri[(a + 1) % 3];
    if (Math.abs(p[2]) <= 1e-12) pts.push([p[0], p[1]]);
    if ((p[2] > 1e-12 && q[2] < -1e-12) || (p[2] < -1e-12 && q[2] > 1e-12)) { const u = p[2] / (p[2] - q[2]); pts.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]) } }
   for (let a = 0; a < pts.length; a++) for (const c of [pts[a], pts[(a + 1) % pts.length]].map((p, j, arr) => j ? [(arr[0][0] + p[0]) / 2, (arr[0][1] + p[1]) / 2] : p)) {
    if (Math.hypot(c[0], c[1]) < 1e-9) continue;
    const onAnchor = anchorsRay.some(k => { const e = before0[k][1]; return Math.abs(e[0] * c[1] - e[1] * c[0]) < 1e-9 });
    if (onAnchor) continue;
    for (let u = 0; u < 8; u++) if (!moving.includes(u) && V2.pointIn(before0[u].map(v => [v[0], v[1]]), c, 1e-9)) touch++ } }
 }
 assert.ok(worstBond < 1e-12, `${tag} M 結びの両側が途中で離れた（${worstBond}）`);
 assert.ok(minZ > 0, `${tag} M 動く区間の頂点が z≦0 へ（${minZ}）`);
 assert.equal(touch, 0, `${tag} M 動く三角形が止まる光線の外で止まった紙に触れた`);
 return { moving, anchorsRay };
}
/* R：止まる光線 k の上の断面の一周の順（コマの3D座標から）。弦＝結び（光線の両側の区間の面）と、光線をまたぐ1枚の面。 */
function ringAt(d, before, after, t, k, moving) {
 const TT = tris(d, t), dir = M.RAY[k], e = tris(d, 0)[k][1], L = Math.hypot(e[0], e[1]);
 const u = [e[0] / L, e[1] / L], nrm = [-u[1], u[0]];
 /* 光線 k を辺に持つのは区間 k-1（3つめの頂点）と区間 k（2つめの頂点）。ほかの区間の辺が同じ直線に重なる場合も拾う */
 const rays = [];
 for (let s = 0; s < 8; s++) { const tri = TT[s];
  for (const [a, b, c] of [[0, 1, 2], [0, 2, 1]]) { const p = tri[b];
   /* 頂点 b が光線 k の直線の上（同じ向き・z=0）にある＝辺 O-b がこの光線に乗っている */
   const along = p[0] * u[0] + p[1] * u[1];
   if (Math.abs(p[0] * u[1] - p[1] * u[0]) > 1e-9 || Math.abs(p[2]) > 1e-9 || along <= 1e-9) continue;
   const w = tri[c], ang = Math.atan2(w[2], w[0] * nrm[0] + w[1] * nrm[1]);
   const fb = faceOfSector(before.faces, s);
   rays.push({ s, face: fb.faceId, layer: fb.layer, ang: Math.abs(ang) < 1e-9 ? 0 : Math.abs(Math.abs(ang) - Math.PI) < 1e-9 ? Math.PI : ang });
  } }
 assert.ok(rays.every(r => r.ang >= 0), 'R 下半分に紙がある（前提が崩れた）');
 const right = rays.filter(r => r.ang === 0).sort((a, b) => a.layer - b.layer), mid = rays.filter(r => r.ang > 0 && r.ang < Math.PI).sort((a, b) => a.ang - b.ang),
  left = rays.filter(r => r.ang === Math.PI).sort((a, b) => b.layer - a.layer);
 const ring = [...right, ...mid, ...left];
 const pos = s => ring.findIndex(r => r.s === s);
 const chords = [];
 /* 同じ面の2区間が光線の両側 */
 for (let a = 0; a < ring.length; a++) for (let b = a + 1; b < ring.length; b++) if (ring[a].face === ring[b].face && !moving.includes(ring[a].s)) chords.push([a, b]);
 /* 結び（確定形の結びのうち、この光線の上のもの）＝光線 k の両側の区間 k-1 と k */
 const onK = after.bonds.some(b => { const far = b.seg.find(p => Math.hypot(p[0], p[1]) > 1e-9); return Math.abs(dir[0] * far[1] - dir[1] * far[0]) < 1e-9 && dir[0] * far[0] + dir[1] * far[1] > 0 });
 if (onK && pos((k + 7) % 8) >= 0 && pos(k) >= 0) chords.push([Math.min(pos((k + 7) % 8), pos(k)), Math.max(pos((k + 7) % 8), pos(k))]);
 /* 光線 k 以外の光線が同じ直線の同じ向きに来ている所の結び（止まる紙どうし） */
 for (const b of before.bonds) { const far = b.seg.find(p => Math.hypot(p[0], p[1]) > 1e-9), kk = M.RAY.findIndex(r => Math.abs(r[0] * far[1] - r[1] * far[0]) < 1e-9 && r[0] * far[0] + r[1] * far[1] > 0);
  if (kk === k) continue; const p1 = pos((kk + 7) % 8), p2 = pos(kk);
  if (p1 >= 0 && p2 >= 0) {
   const e1 = TT[(kk + 7) % 8][2], e2 = TT[kk][1];
   if (Math.abs(e1[0] * u[1] - e1[1] * u[0]) < 1e-9 && Math.abs(e2[0] * u[1] - e2[1] * u[0]) < 1e-9) chords.push([Math.min(p1, p2), Math.max(p1, p2)]) } }
 const cross = chords.some(([a, b]) => chords.some(([c, e]) => a < c && c < b && b < e));
 return { order: ring.map(r => r.s + (r.ang === 0 ? 'R' : r.ang === Math.PI ? 'L' : 'M')).join(','), cross, chords: chords.length };
}
function layerChecks(tag, before, after, d, moving) {
 const eps = 1e-4, TT = tris(d, 1 - eps), T1 = tris(d, 1);
 const zAt = (s, q) => { const tri = T1[s].map(v => [v[0], v[1]]), now = TT[s];
  const [[x1, y1], [x2, y2], [x3, y3]] = tri, D = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  const a = ((y2 - y3) * (q[0] - x3) + (x3 - x2) * (q[1] - y3)) / D, b = ((y3 - y1) * (q[0] - x3) + (x1 - x3) * (q[1] - y3)) / D;
  return a * now[0][2] + b * now[1][2] + (1 - a - b) * now[2][2] };
 const F = after.faces; let pairs = 0;
 for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
  const I = V2.intersect([F[i].poly, F[j].poly]); if (I.length < 3 || area(I) < 1e-9) continue;
  pairs++;
  const q = [I.reduce((s, p) => s + p[0], 0) / I.length, I.reduce((s, p) => s + p[1], 0) / I.length];
  const secOf = f => [...Array(8).keys()].find(s => faceOfSector([f], s) && V2.pointIn(T1[s].map(v => [v[0], v[1]]), q, -1e-9));
  const si = secOf(F[i]), sj = secOf(F[j]);
  const zi = zAt(si, q), zj = zAt(sj, q);
  let want;
  if (Math.abs(zi - zj) > 1e-12) want = Math.sign(zi - zj);
  else { const pi = faceOfSector(before.faces, si), pj = faceOfSector(before.faces, sj); want = Math.sign(pi.layer - pj.layer) }
  assert.equal(Math.sign(F[i].layer - F[j].layer), want, `${tag} L ${F[i].faceId} と ${F[j].faceId} の上下が、確定直前の高さ（同じ高さなら直前の上下）と違う`);
 }
 return pairs;
}
function shapeChecks(tag, cache) {
 const sum = cache.faces.reduce((s, f) => s + area(f.poly), 0);
 assert.ok(Math.abs(sum - 4) < 1e-9, `${tag} G 面積の合計が4でない`);
 const xs = cache.faces.flatMap(f => f.poly.map(p => p[0])), ys = cache.faces.flatMap(f => f.poly.map(p => p[1]));
 assert.ok(Math.abs((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) - 1) < 1e-9, `${tag} G 外形が面積1の正方形でない`);
 for (const b of cache.bonds) {
  const fa = cache.faces.find(f => f.faceId === b.faceIds[0]), fb = cache.faces.find(f => f.faceId === b.faceIds[1]);
  for (const p of b.seg) assert.ok(Math.hypot(...[0, 1].map(i => ap(fa.xf, p)[i] - ap(fb.xf, p)[i])) < 1e-9, `${tag} G 結び ${b.bondId} の両側が離れている`);
  const same = fa.xf.every((v, i) => Math.abs(v - fb.xf[i]) < 1e-9);
  assert.equal(b.kind === 'crease', same, `${tag} G 結び ${b.bondId}（${b.kind}）の種類と置かれ方が合わない`);
 }
 /* 折り目の記録（creases）は、いま平らな結び（crease）の上だけ＝背になった所に古い折り目の線が残らない */
 for (const c of cache.creases) {
  const on = cache.bonds.filter(b => { if (!b.faceIds.includes(c.faceId)) return false;/* 持ち主の面の結びだけ（同じ直線に別の面の結びが重なる） */
   const f = cache.faces.find(v => v.faceId === b.faceIds[0]), seg = b.seg.map(p => ap(f.xf, p));
   return c.seg.every(q => Math.abs((seg[1][0] - seg[0][0]) * (q[1] - seg[0][1]) - (seg[1][1] - seg[0][1]) * (q[0] - seg[0][0])) < 1e-9) });
  assert.ok(on.length && on.every(b => b.kind === 'crease'), `${tag} G 折り目 ${c.creaseId} が背の上に残っている`);
 }
}

/* ================= P・G・M・R・L・S 経路ぜんぶ ================= */
const results = [];
{
 let count = 0, ringN = 0, pairN = 0;
 for (const { axis, c1, c2 } of PATHS) for (const flip2 of ['v', 'h']) {
  const tag = `${axis || '表'} [${c1}] [${c2}] → 裏返し${flip2}`;
  const t = tsuru2(axis, c1, c2);
  E.proposeSquash(t); E.confirm(t);
  E.flip(t, flip2);
  const before = C(t.cache), o = E.squashOptions(t);
  assert.equal(o.options.length, 1, `${tag} P 袋が1つに決まらない: ${o.reason}`);
  assert.equal(X.flatState(t.cache).ok, true, `${tag} P 裏返した紙が成立していない（前提）`);
  const s0 = snap(t);
  E.proposeSquash(t, o.options[0].pocketId);
  assert.equal(J({ ...JSON.parse(snap(t)), p: null }), J({ ...JSON.parse(s0), p: null }), `${tag} P 候補を作っただけで正式状態が動いた`);
  const pv = E.squashPreview(t);
  E.confirm(t);
  const after = C(t.cache), d = E.replayDetail(t.recipe).squash;
  assert.deepEqual(t.recipe.steps.map(s => s.op), (axis ? ['flip'] : []).concat(['fold', 'fold', 'squash', 'flip', 'squash']), `${tag} P 手の並びが違う`);
  assert.equal(after.faces.length, 8, `${tag} P 面が8枚にならない`);
  assert.equal(pv.moving.length, 3, `${tag} P 動く面が3枚でない`);
  shapeChecks(tag, after);
  assert.equal(X.flatState(after).ok, true, `${tag} L 確定形が成立しない（flatState）`);
  const { moving, anchorsRay } = motionChecks(tag, before, after, d);
  for (const k of anchorsRay) {
   const rs = [0.02, 0.25, 0.5, 0.75, 0.98].map(tt => ringAt(d, before, after, tt, k, moving));
   for (const r of rs) assert.equal(r.cross, false, `${tag} R 止まる光線 ${k} の上で弦が交差: ${r.order}`);
   assert.equal(new Set(rs.map(r => r.order)).size, 1, `${tag} R 止まる光線 ${k} の上の一周の順が途中で変わった`);
   ringN += rs[0].chords;
  }
  pairN += layerChecks(tag, before, after, d, moving);
  /* S 保存→再読込→undo/redo */
  const saved = C(E.verifiedRecipe(t));
  assert.equal(saved.steps.filter(s => s.op === 'squash').length, 2, `${tag} S 保存に袋折りが2手ない`);
  const re = load(saved);
  assert.equal(re.cache.hash, t.cache.hash, `${tag} S 保存を読み直すと別の紙`);
  const h = t.cache.hash; E.undo(t);
  assert.equal(t.cache.hash, before.hash, `${tag} S undo で裏返した紙に戻らない`);
  E.redo(t); assert.equal(t.cache.hash, h, `${tag} S redo で同じ面・結び・層に戻らない`);
  /* 面と結びの並びを入れかえても同じ候補（決定論） */
  const sh = C(before); sh.faces.reverse(); sh.bonds.reverse();
  assert.equal(J(V2.candidateStep(sh, 'sx', '9')), J(V2.candidateStep(before, 'sx', '9')), `${tag} S 並びを入れかえると候補が変わる`);
  results.push({ tag, t, before, after, d, axis, c1, c2, flip2, recipe: C(t.recipe) });
  count++;
 }
 ok(`P ${count}通り（1回目 表8・裏返しv 8・h 1 × 2回目の前の裏返し v・h）：袋は1つ・候補は正式状態を動かさず・確定で8枚`);
 ok('G 確定形は4枚重ねの正方形・結びの両側が同じ所・折り目は同じ置かれ方／背は別の置かれ方・折り目の記録は平らな結びの上だけ');
 ok(`M 399コマ×${count}：止まる区間は動かない・結びの両側は離れない・動く頂点は z>0・止まった紙の中へ入らない（補助の数値）`);
 ok(`R 止まる光線2本×5コマ×${count}：コマの3D座標から作った一周の順で弦が交差しない・順は途中で変わらない（弦 ${ringN}本）`);
 ok(`L 重なる2枚 ${pairN}組の上下＝確定直前の高さ（同じ高さなら直前の上下）・flatState 成立`);
 ok('S 保存→再読込で同じ hash／undo で裏返した紙・redo で同じ面・結び・層／並びを入れかえても同じ候補');
}

/* ================= F 2回目の袋折りのあとの、ふつうの折り（2026-09-15） =================
   確定形（4枚重ねの正方形）の上で、折線（外形の格子点どうし）×折る側×山谷×上からN枚を総当りし、
   engine の既存の判定（①上下の紙・②折り目のつながり・④裂け・recordable）で 成立／断る を分ける。
   成立した手は**ぜんぶ**確定して、独立の flatState（fold_crossing）が成立すること・結びの両側が離れないことを見る。
   代表の1手で 操作の道（proposeOnFace→setSide→setLayers→select→confirm）→保存→再読込→undo/redo、
   断る手（裂け・上に紙・下に紙）で 理由と、正式状態・候補が変わらないことを見る。 */
const follow = [];
{
 const S2 = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
 const T = { cand: 0, ok: 0, tear: 0, above: 0, below: 0, other: 0, confirmed: 0, flatBad: 0, bondBad: 0 };
 const ex = {};
 const r0 = results[0], st0 = load(r0.recipe);
 const xs = st0.cache.faces.flatMap(f => f.poly.map(p => p[0])), ys = st0.cache.faces.flatMap(f => f.poly.map(p => p[1]));
 const bx = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], pts = [];
 for (let i = 0; i <= 4; i++) for (let k = 0; k <= 4; k++) pts.push([bx[0] + (bx[1] - bx[0]) * i / 4, bx[2] + (bx[3] - bx[2]) * k / 4]);
 for (let i = 0; i < pts.length; i++) for (let k = i + 1; k < pts.length; k++) {
  const a = pts[i], b = pts[k]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < .3) continue;
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d), nn = [-d[1] / L, d[0] / L];
  for (const sg of [1, -1]) {
   const at = [mid[0] + nn[0] * .15 * sg, mid[1] + nn[1] * .15 * sg]; let la; try { la = E.layersAt(st0, at) } catch { continue }
   if (!la.layers.length || la.duplicated.length) continue;
   let A = a, B = b; if (S2(at, A, B) > 0) [A, B] = [B, A];
   for (const kind of ['V', 'M']) for (let m = 1; m <= la.layers.length; m++) {
    let ids; try { ids = E.topFaces(st0, at, m, A, B) } catch { continue }
    /* 折線が選んだ面のどれも割らない（紙の外周に沿った線など）は、折りの候補にしない（画面の proposeOnFace も断る） */
    if (!ids.some(id => { const q = E.split(st0.cache.faces.find(f => f.faceId === id).poly, a, b); return q[0] && q[1] })) continue;
    T.cand++;
    const r = E.foldableSet(st0.cache.faces, st0.cache.bonds, ids, A, B, kind);
    const key = r.ok ? 'ok' : /裂け/.test(r.reason) ? 'tear' : /上に乗っている/.test(r.reason) ? 'above' : /下に敷かれている/.test(r.reason) ? 'below' : 'other';
    T[key]++; if (!ex[key]) ex[key] = { a, b, at, kind, m, ids };
    if (key !== 'ok') continue;
    const st = load(r0.recipe), top = st.cache.faces.filter(f => ids.includes(f.faceId) && E.strictlyInside(at, f.poly)).sort((x, y) => y.layer - x.layer)[0];
    try { E.proposeOnFace(st, a, b, top.faceId, { layers: 1 }); st.pending.kind = kind; E.setSide(st, at);
     st.pending.candidates = ids.map(id => ({ faceId: id, layerPath: st.cache.faces.find(f => f.faceId === id).layerPath })); E.select(st, st.pending.candidates); E.confirm(st) } catch { continue }
    T.confirmed++;
    if (!X.flatState(st.cache).ok) T.flatBad++;
    for (const bd of st.cache.bonds) { const fa = st.cache.faces.find(f => f.faceId === bd.faceIds[0]), fb = st.cache.faces.find(f => f.faceId === bd.faceIds[1]);
     if (bd.seg.some(q => Math.hypot(ap(fa.xf, q)[0] - ap(fb.xf, q)[0], ap(fa.xf, q)[1] - ap(fb.xf, q)[1]) > 1e-9)) T.bondBad++ }
    if (follow.length < 6 && follow.every(f => f.kind !== kind || f.m !== m)) follow.push({ recipe: C(st.recipe), kind, m, faces: C(st.cache.faces) });
   }
  }
 }
 console.log('    後続の折りの総当り：' + J(T));
 assert.ok(T.ok > 50 && T.tear > 50 && T.above > 20 && T.below > 50, 'F 成立・裂け・上下の紙の例がそろわない');
 assert.equal(T.other, 0, 'F 既存の理由でない断り方がある');
 assert.equal(T.confirmed, T.ok, 'F 判定は通ったのに確定できない手がある');
 assert.equal(T.flatBad + T.bondBad, 0, 'F 確定した後続の折りの平らな状態が成立しない／結びが離れた');
 ok(`F 後続の折り ${T.cand}候補：成立 ${T.ok}（ぜんぶ確定・flatState 成立・結びは離れない）／裂け ${T.tear}・上に紙 ${T.above}・下に紙 ${T.below}`);

 /* 代表の成立例：操作の道 → 保存 → 再読込 → undo/redo */
 const e = ex.ok, st = load(r0.recipe), h0 = st.cache.hash;
 const top = E.stackAt(st, e.at)[0];
 E.proposeOnFace(st, e.a, e.b, top.faceId, { layers: 1 }); st.pending.kind = e.kind; E.setSide(st, e.at);
 if (e.m > 1) E.setLayers(st, e.m, st.pending.at);
 const beforeConfirm = snap(st);
 E.select(st, st.pending.candidates); E.confirm(st);
 assert.deepEqual(st.recipe.steps.slice(-3).map(s => s.op), ['flip', 'squash', 'fold'], 'F 後続の折りが1手の fold として入らない');
 assert.equal(st.recipe.version, 2);
 const saved = C(E.verifiedRecipe(st)), re = load(saved);
 assert.equal(re.cache.hash, st.cache.hash, 'F 保存を読み直すと別の紙');
 const h1 = st.cache.hash; E.undo(st); assert.equal(st.cache.hash, h0, 'F undo で2回目の袋折りの直後に戻らない');
 E.redo(st); assert.equal(st.cache.hash, h1, 'F redo で同じ面・結び・層に戻らない');
 assert.equal(X.flatState(st.cache).ok, true);
 ok('F 代表の成立例：操作の道で1手 → 保存→再読込で同じ hash → undo で袋折り直後・redo で同じ面・結び・層');

 /* 断る例：理由・正式状態・候補を保つ。候補は総当りと同じ「その場所の上からN枚」の面の集合（画面の枚数ボタンと同じ topFaces）で作る */
 for (const [key, re2] of [['tear', /裂け/], ['above', /上に乗っている紙/], ['below', /下に敷かれている紙/]]) {
  const x = ex[key], s = load(r0.recipe);
  const splitFace = x.ids.map(id => s.cache.faces.find(f => f.faceId === id)).find(f => { const q = E.split(f.poly, x.a, x.b); return q[0] && q[1] });
  E.proposeOnFace(s, x.a, x.b, splitFace.faceId, { layers: 1 }); s.pending.kind = x.kind; E.setSide(s, x.at);
  s.pending.candidates = x.ids.map(id => ({ faceId: id, layerPath: s.cache.faces.find(f => f.faceId === id).layerPath })); E.select(s, s.pending.candidates);
  const keep = snap(s); let msg = null;
  try { E.confirm(s) } catch (err) { msg = err.message }
  assert.match(msg || '', re2, 'F ' + key + ' の理由で断らない: ' + msg);
  assert.equal(snap(s), keep, 'F ' + key + ' 断ったのに正式状態か候補が変わった');
 }
 ok('F 断る例（裂け・上に紙・下に紙）：既存の判定の理由を出し、正式状態と候補を保つ');
}

/* ================= N 断る（理由・正式状態・候補を保つ） ================= */
{
 const J3 = JSON.parse(rd('squash_tsuru3_v2.json'));
 /* N1 裏返していない紙：袋の上に紙が乗っている */
 const a = load(J3), sa = snap(a), oa = E.squashOptions(a);
 assert.equal(oa.options.length, 0); assert.match(oa.reason, /袋の上に止まった紙が乗っています/);
 throws(() => E.proposeSquash(a), /袋の上に止まった紙が乗っています/, 'N1 裏返していない紙で袋折りの候補ができた');
 assert.equal(snap(a), sa, 'N1 断ったのに状態が変わった');
 /* N2 角を折ったあとの紙：区間の途中で割れている */
 const A = JSON.parse(rd('squash_after_states.json')).cases.find(c => c.name.startsWith('A ')).recipe;
 const b = load(A); E.flip(b, 'v'); const sb = snap(b);
 throws(() => E.proposeSquash(b), /区間の合併になっていません/, 'N2 区間の途中で割れた紙で袋折りの候補ができた');
 assert.equal(snap(b), sb, 'N2 断ったのに状態が変わった');
 /* N3 合成：止まる光線の上で弦が交差する紙（根元の相手と、その下の紙の上下を入れかえる）＝周囲の紙の検査だけが鳴る */
 const c = load(J3); E.flip(c, 'v');
 const rec = V2.reconstructLocal(c.cache, [0, 0]), fr = V2.checkApplicableLocal(c.cache, rec, [0, 0]);
 const anchorFace = rec.owner[fr.sectorOfModel[0]], af = c.cache.faces.find(f => f.faceId === anchorFace);
 const under = c.cache.faces.find(f => f.faceId !== anchorFace && f.layer < af.layer && V2.intersect([f.poly, af.poly]).length >= 3 && area(V2.intersect([f.poly, af.poly])) > 1e-9);
 assert.ok(under, 'N3 根元の相手の下に紙が無い（合成の前提）');
 const bad = C(c.cache); const fa = bad.faces.find(f => f.faceId === anchorFace), fu = bad.faces.find(f => f.faceId === under.faceId);
 [fa.layer, fu.layer] = [fu.layer, fa.layer];
 throws(() => V2.readPocket(bad, [0, 0]), /途中で紙を突き抜けます/, 'N3 止まる光線の上の弦が交差する紙を断らない');
 /* N4 失敗時は正式状態も候補も保つ（確定の照合で断る） */
 const t = results[0].t; E.undo(t);
 const o = E.squashOptions(t); E.proposeSquash(t, o.options[0].pocketId); t.pending.hash = 'x'; const st = snap(t);
 throws(() => E.confirm(t), /候補を作ったときと再生結果が違います/, 'N4 結果の違う候補を確定した');
 assert.equal(snap(t), st, 'N4 断ったのに正式状態か候補が変わった');
 E.cancel(t);
 ok('N 裏返していない紙（袋の上に紙）・区間の途中で割れた紙・合成の弦の交差を理由つきで断り状態を変えない／確定の失敗で正式状態と候補を保つ');
}
/* --write：独立照合（check_squash_twice.py）の材料。Python は原本の道すじ（axis・角・裏返し）だけを使って紙を自分で作り、
   ここに書く JS の確定形は**突き合わせる相手**としてだけ読む（期待値には使わない）。 */
if (process.argv.includes('--write')) {
 const pick = c => ({ faces: c.faces.map(f => ({ faceId: f.faceId, xf: f.xf, layer: f.layer, poly: f.poly })), bonds: c.bonds.map(b => ({ faceIds: b.faceIds, kind: b.kind, seg: b.seg })) });
 const out = results.map(r => ({ label: r.tag, axis: r.axis, c1: r.c1, c2: r.c2, flip2: r.flip2, recipe: r.recipe, flipped: pick(r.before), after: pick(r.after) }));
 /* 後続の折り：Python の再生器（本番 fold2d）に、2回目の袋折りの直後の面を始まりにして続きの手を折らせる（check_squash_after.py と同じ突き合わせ） */
 const last = r => r.steps.map(x => x.op).lastIndexOf('squash');
 const followOut = follow.map((f, i) => ({ name: `F${i + 1} 2回目の袋折りのあと ${f.kind} 上から${f.m}枚`, recipe: f.recipe, squashStep: last(f.recipe),
  seed: C(load({ ...C(f.recipe), steps: f.recipe.steps.slice(0, last(f.recipe) + 1) }).cache.faces), faces: f.faces }));
 fs.writeFileSync(path.join(DIR, 'squash_twice_states.json'), JSON.stringify({ note: 'node test_squash_twice.js --write が書く。check_squash_twice.py が読む（JS の結果は突き合わせの相手）。', cases: out, follow: followOut }, null, 1));
 console.log('  wrote squash_twice_states.json（' + out.length + '経路）');
}
console.log(`\n${n} checks passed`);
