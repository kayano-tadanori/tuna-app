'use strict';
/* 🌸 花弁折り（つる⑧⑨・1回目）の **v2 の手（op:'petal'）の検査・認識・再生・動きの座標**（2026-09-15）。
   根拠：check_petal_fold.py（独立の剛体モデル・59項目）／動画照合（bheH5wZckps 1回目 2:38〜3:21）／recipe_petal_format.md（記録形式）。
   🚪 入口は engine の共通入口 1本。SquashV2.replayWith が op:'petal' の手をここの applyStep へ渡す（v1 の手は engine の内部の再生器）。

   ★ 認識（手番号・固定 faceId を使わない）
     検証モデルの10面（花弁2・一番上の脇2・2枚目の脇2・止まる4）の素材の三角形を、原紙の対称 D（8通り）で写し、
     いまの紙の面の素材の形とちょうど一致する面を探す。置かれ方は「いまの xf ＝ G ∘ モデルの置き方 ∘ D⁻¹」を
     **1つの向きを保つ平面の等長変換 G** で満たすときだけ（G が裏返しを含む組は、モデルの左右の鏡映で同じ花弁の読みかえになる）。
     そのうえで 層（モデルと同じ上下）・結び（種類と相手）・周囲の紙（出発で上に紙が無い・軸の一周で上の紙が触れない）を見る。
   ★ 運動（check_petal_fold.py と同じ式）
     θ＝花弁が P'→P の軸まわり（開いた角が +z へ上がる向き）、φ＝2·atan(cos67.5°·tan(θ/2))。
     T1R＝花弁の中で P→Q まわり +φ／S2R＝止まる紙の P→Q まわり −φ／T1L＝花弁の中で P'→Q まわり −φ／S2L＝P'→Q まわり +φ。
   ★ 終端の上下は計算する（stack は検算値）。θ=π(1-ε) の高さで、ε を縮めても変わらないことを見る。動く面が同着なら断る。
   ⛔ 厚みは0。受理するのは1回目の花弁折り（検証ずみの形）だけ。反対側の花弁折り・変形した形は断る。
*/
globalThis.PetalV2 = (() => {

const MODEL = 'petal-rhombus-67.5';
const LINKAGE = 'tan-half-cos67.5';
const BRANCH = { linkage: LINKAGE, name: 'petal', sideFold: 'toward-petal-underside', drive: { fromDeg: 0, toDeg: 180 } };
const ROLES = ['drive', 'petal-kite', 'side-hinge', 'fixed-kite', 'fixed-fold'];
const MAX_FACES = 64;
const TOL = 1e-7, TIE = 1e-12, MIN_AREA = 1e-9;
const EPS_LIST = [1e-2, 1e-3, 1e-4, 1e-5, 1e-6];
const COS675 = Math.cos(67.5 * Math.PI / 180);

const C = x => JSON.parse(JSON.stringify(x));
const bad = m => { throw Error('v2 花弁折り：' + m); };

/* ================= 検証モデル（check_petal_fold.py の MAT・FACES・QUAD と同じ数） ================= */
const S2 = 2 - Math.SQRT2;
const MAT = { O: [0, 0], P: [S2, 0], "P'": [0, -S2], M: [S2 / 2, -S2 / 2], Q3: [1, -1], Q2R: [1, 1], Q2L: [-1, -1], B: [1, 0], A: [0, -1] };
const QUAD = { Q3: [0, 1, 1, 0], QR: [0, -1, 1, 0], QL: [0, 1, -1, 0] };
const FACES = {
 T2R: { v: ['Q3', 'M', 'P'], q: 'Q3', layer: 3, role: 'petal' },
 T2L: { v: ["P'", 'M', 'Q3'], q: 'Q3', layer: 3, role: 'petal' },
 T1R: { v: ['Q3', 'P', 'B'], q: 'Q3', layer: 3, role: 'side3' },
 T1L: { v: ['A', "P'", 'Q3'], q: 'Q3', layer: 3, role: 'side3' },
 S2R: { v: ['Q2R', 'P', 'B'], q: 'QR', layer: 2, role: 'side2' },
 S2L: { v: ['A', "P'", 'Q2L'], q: 'QL', layer: 2, role: 'side2' },
 T3R: { v: ['M', 'O', 'P'], q: 'Q3', layer: 3, role: 'fixed' },
 T3L: { v: ["P'", 'O', 'M'], q: 'Q3', layer: 3, role: 'fixed' },
 G2R: { v: ['Q2R', 'O', 'P'], q: 'QR', layer: 2, role: 'fixed' },
 G2L: { v: ["P'", 'O', 'Q2L'], q: 'QL', layer: 2, role: 'fixed' },
};
const NAMES = Object.keys(FACES);
const MOVING = NAMES.filter(k => FACES[k].role !== 'fixed');
/* 局所の結び（⑦のあと）。種類は直前の状態で照合する。 */
const BONDS = [
 ['T2R', 'T2L', 'Q3', 'M', 'crease'], ['T2R', 'T3R', 'M', 'P', 'crease'], ['T2L', 'T3L', "P'", 'M', 'crease'],
 ['T2R', 'T1R', 'Q3', 'P', 'crease'], ['T2L', 'T1L', "P'", 'Q3', 'crease'], ['T1R', 'S2R', 'P', 'B', 'hinge'],
 ['T1L', 'S2L', 'A', "P'", 'hinge'], ['S2R', 'G2R', 'Q2R', 'P', 'crease'], ['S2L', 'G2L', "P'", 'Q2L', 'crease'],
 ['T3R', 'T3L', 'O', 'M', 'crease'], ['T3R', 'G2R', 'O', 'P', 'hinge'], ['T3L', 'G2L', "P'", 'O', 'hinge'],
];
/* 原紙の対称（素材座標の 2×2）。 */
const SYM = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0], [-1, 0, 0, 1], [1, 0, 0, -1], [0, 1, 1, 0], [0, -1, -1, 0]];

/* ================= 小道具 ================= */
const V2 = () => globalThis.SquashV2;
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const invPt = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const lin = (A, p) => [A[0] * p[0] + A[1] * p[1], A[2] * p[0] + A[3] * p[1]];
const mul2 = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];
const compose = (a, b) => { const l = mul2(a, b), t = apply(a, [b[4], b[5]]); return [l[0], l[1], l[2], l[3], t[0], t[1]] };
const inv2x3 = m => { const d = m[0] * m[3] - m[1] * m[2], l = [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d], t = lin(l, [m[4], m[5]]); return [l[0], l[1], l[2], l[3], -t[0], -t[1]] };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const near = (a, b, e = TOL) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= e);
const rd = (p, n = 6) => p.map(v => Math.round(v * 10 ** n) / 10 ** n + 0);
const keySet = poly => JSON.stringify(poly.map(p => rd(p)).sort((u, v) => u[0] - v[0] || u[1] - v[1]));
const polyArea = poly => { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1] } return s / 2 };
/* 直線 a-b での鏡映（2×3） */
function reflXf(a, b) {
 const d = [b[0] - a[0], b[1] - a[1]], n = Math.hypot(d[0], d[1]), u = [d[0] / n, d[1] / n];
 const R = [2 * u[0] * u[0] - 1, 2 * u[0] * u[1], 2 * u[0] * u[1], 2 * u[1] * u[1] - 1], t = lin(R, a);
 return [R[0], R[1], R[2], R[3], a[0] - t[0], a[1] - t[1]];
}
/* 3D の回転（ロドリゲス）。k は単位ベクトル。 */
function rot(k, ang, v) {
 const c = Math.cos(ang), s = Math.sin(ang), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
 const cr = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
 return [0, 1, 2].map(i => v[i] * c + cr[i] * s + k[i] * d * (1 - c));
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const unit3 = v => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n] };
const phiOf = th => th >= Math.PI ? Math.PI : 2 * Math.atan(COS675 * Math.tan(th / 2));
/* 線分 A-B のうち凸多角形（ふち含む）に入る区間 [lo, hi]（入らなければ null） */
function segRangeInConvex(A, B, poly) {
 let lo = 0, hi = 1; const sg = polyArea(poly) > 0 ? 1 : -1;
 for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length];
  const f = X => sg * ((q[0] - p[0]) * (X[1] - p[1]) - (q[1] - p[1]) * (X[0] - p[0]));
  const fa = f(A), fb = f(B);
  if (fa < -1e-12 && fb < -1e-12) return null;
  if (fa < -1e-12) lo = Math.max(lo, fa / (fa - fb));
  if (fb < -1e-12) hi = Math.min(hi, fa / (fa - fb));
 }
 return hi - lo > 1e-12 ? [lo, hi] : null;
}
/* 凸多角形の厳密な内側（ふちから 1e-9 より内） */
const insideStrict = (p, poly) => { const sg = polyArea(poly) > 0 ? 1 : -1;
 return poly.every((a, i) => { const b = poly[(i + 1) % poly.length]; return sg * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / dist(a, b) > 1e-9 }) };
const areaOf = polys => { const q = V2().intersect(polys); return q.length >= 3 ? Math.abs(polyArea(q)) : 0 };

/* ================= 手の形の検査（v2 の担当＝op:'petal' の手ぜんぶ） ================= */
const FIELDS = ['id', 'diagramStep', 'op', 'instruction', 'model', 'base', 'pivots', 'axes', 'branch', 'stack'];
const isPt = p => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && Number.isFinite(v) && v >= -1 && v <= 1);
function validateStep(st, where) {
 for (const k of FIELDS) if (!Object.prototype.hasOwnProperty.call(st, k)) bad(`${where}に ${k} がありません`);
 for (const k of Object.keys(st)) if (!FIELDS.includes(k)) bad(`${where}に知らない項目があります（${k}）`);
 if (st.op !== 'petal') bad(`${where}の op が petal ではありません`);
 if (typeof st.id !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(st.id)) bad(`${where}の id が原本の決まりに合いません`);
 if (typeof st.diagramStep !== 'string' || !st.diagramStep.length || st.diagramStep.length > 64) bad(`${where}の diagramStep が文字列ではありません`);
 if (typeof st.instruction !== 'string' || st.instruction.length > 400) bad(`${where}の instruction が文字列ではありません`);
 if (st.model !== MODEL) bad(`${where}の model が ${MODEL} ではありません（検証ずみの花弁折りだけ）`);
 if (!st.base || typeof st.base !== 'object' || Array.isArray(st.base) || Object.keys(st.base).join() !== 'faceId' || typeof st.base.faceId !== 'string' || !st.base.faceId.length || st.base.faceId.length > 8192)
  bad(`${where}の base は { faceId }（花弁の右半分の面）だけです`);
 if (!Array.isArray(st.pivots) || st.pivots.length !== 2 || !st.pivots.every(isPt)) bad(`${where}の pivots は原紙の中の2点 [P, P'] です`);
 if (!Array.isArray(st.axes) || st.axes.length !== 9) bad(`${where}の axes が9本ちょうどではありません（${(st.axes || []).length}本）`);
 for (const ax of st.axes) {
  if (!ax || typeof ax !== 'object' || Array.isArray(ax)) bad(`${where}の axes に軸でないものが混じっています`);
  const keys = Object.keys(ax).sort().join();
  if (ax.role === 'drive') { if (keys !== 'from,role,to' || !isPt(ax.from) || !isPt(ax.to)) bad(`${where}の drive の軸は { from, to, role } です`) }
  else if (ROLES.includes(ax.role)) { if (keys !== 'end,role,vertex' || !isPt(ax.vertex) || !isPt(ax.end)) bad(`${where}の軸 ${ax.role} は { vertex, end, role } です`) }
  else bad(`${where}の軸の役割が ${ROLES.join(' / ')} ではありません（${String(ax.role).slice(0, 30)}）`);
 }
 const br = st.branch;
 if (!br || typeof br !== 'object' || Array.isArray(br) || JSON.stringify(br) !== JSON.stringify(BRANCH))
  bad(`${where}の branch は ${JSON.stringify(BRANCH)} だけが検証ずみです`);
 if (!Array.isArray(st.stack) || !st.stack.length) bad(`${where}の stack（検算用の上下関係）がありません`);
 const seen = new Set();
 for (const reg of st.stack) {
  if (!Array.isArray(reg) || reg.length < 2 || !reg.every(v => typeof v === 'string' && v.length && v.length <= 8192))
   bad(`${where}の stack は「重なる領域の面を下から並べた配列」の配列です`);
  if (new Set(reg).size !== reg.length) bad(`${where}の stack の領域に同じ面が2度出ています`);
  const k = reg.slice().sort().join('|'); if (seen.has(k)) bad(`${where}の stack に同じ面の組の領域が2度あります`); seen.add(k);
 }
 return true;
}

/* ================= 認識：いまの紙に、検証ずみの花弁があるか ================= */
/* 失敗の段（深いほど花弁に近い）と理由。候補が無いとき、いちばん深い段の理由を返す。 */
function recognize(cache) {
 const found = [];
 let best = { depth: -1, reason: '⑦の折り目（凧形の折り目2本を上から2枚・上の三角の折り目）がそろった正方基本形の花弁が見つかりません' };
 const fail = (depth, reason) => { if (depth > best.depth) best = { depth, reason } };
 if (!cache || !Array.isArray(cache.faces)) bad('紙の状態が読めません');
 if (cache.faces.length > MAX_FACES) return { bindings: [], reason: `面が${MAX_FACES}枚を超える紙は未対応です` };
 /* 🧩 認識のためのまとまり（2026-09-15・本人指示）：余分な折り目で面が分かれていても、モデルの1面＝「素材でその三角形をちょうど敷きつめ、
    同じ置かれ方（xf）で、平らな折り目（crease）だけで互いにつながる面の集まり」として照合する。
    ⚠元の面・faceId・折り目は1つも書きかえない（まとまりは認識の中だけ）。まとまりの中の結びは運動の途中でも一致するかを build が見る。 */
 const mats = cache.faces.map(f => { const mp = f.poly.map(p => invPt(f.xf, p)); return { f, mp, area: Math.abs(polyArea(mp)),
  } });
 const groupIn = tri => {
  /* 敷きつめ（1つの条件）：三角形と面積で重なる面は、ぜんぶ三角形の中に収まり（重なりの面積＝面の面積）、合わせて三角形の面積ちょうど。
     ⚠以前は「重心が中にある面」を集めて、はみ出し・面積を別々に見ていた（同じ性質を2か所で守っていた）→ 重なりの面積で1つにした（2026-09-16）。 */
  const members = mats.map(m => ({ ...m, cut: areaOf([m.mp, tri]) })).filter(m => m.cut > MIN_AREA);
  const triArea = Math.abs(polyArea(tri));
  if (!members.length || members.some(m => Math.abs(m.cut - m.area) > 1e-9) || Math.abs(members.reduce((s, m) => s + m.cut, 0) - triArea) > 1e-9) return null;
  const ids = members.map(m => m.f.faceId), set = new Set(ids);
  if (members.some(m => !near(m.f.xf, members[0].f.xf, 1e-9))) return null;/* 置かれ方がそろっていない */
  const inner = cache.bonds.filter(bd => set.has(bd.faceIds[0]) && set.has(bd.faceIds[1]));
  if (inner.some(bd => bd.kind !== 'crease')) return null;/* まとまりの中に背がある */
  const seen = new Set([ids[0]]), q = [ids[0]];
  while (q.length) { const id = q.pop(); for (const bd of inner) { const i = bd.faceIds.indexOf(id); if (i < 0) continue; const o = bd.faceIds[1 - i]; if (!seen.has(o)) { seen.add(o); q.push(o) } } }
  if (seen.size !== ids.length) return null;/* 平らな折り目でつながっていない */
  return members.map(m => m.f).sort((a, b) => a.faceId < b.faceId ? -1 : 1);
 };
 for (let di = 0; di < SYM.length; di++) {
  const D = SYM[di], Dt = [D[0], D[2], D[1], D[3]];
  /* ① 面：モデルの三角形を D で写した所を、まとまり（1面以上）がちょうど敷きつめている */
  const groupOf = {}, faceOf = {};
  let okFaces = true;
  for (const k of NAMES) { const g = groupIn(FACES[k].v.map(n => lin(D, MAT[n])));
   if (!g) { okFaces = false; break } groupOf[k] = g; faceOf[k] = g[0] }
  if (!okFaces) continue;
  fail(1, '花弁の形の面はありますが、つる⑦のあとの置かれ方になっていません');
  /* ② 置かれ方：xf ＝ G ∘ モデルの置き方 ∘ D⁻¹、G は向きを保つ平面の等長変換（1つ） */
  const canonXf = k => [...QUAD[FACES[k].q], 0, 0];
  const g0 = compose(compose(faceOf.T3R.xf, [D[0], D[1], D[2], D[3], 0, 0]), inv2x3(canonXf('T3R')));
  const orth = Math.abs(g0[0] * g0[0] + g0[2] * g0[2] - 1) < 1e-9 && Math.abs(g0[1] * g0[1] + g0[3] * g0[3] - 1) < 1e-9 && Math.abs(g0[0] * g0[1] + g0[2] * g0[3]) < 1e-9;
  const det = g0[0] * g0[3] - g0[1] * g0[2];
  if (!orth || det < 0) continue;
  const G = g0;
  if (!NAMES.every(k => near(faceOf[k].xf, compose(compose(G, canonXf(k)), [Dt[0], Dt[1], Dt[2], Dt[3], 0, 0]), 1e-7))) continue;
  fail(2, '花弁のまわりの紙の上下が、つる⑦のあとと違います（裏返した側で花弁を折るには、その側にも⑦の折り目が要ります）');
  /* ③ 層：局所の10のまとまりで、面積で重なる面の組の上下が、ぜんぶモデルと同じ */
  let okLayers = true;
  for (let i = 0; i < NAMES.length && okLayers; i++) for (let j = i + 1; j < NAMES.length && okLayers; j++) {
   const a = NAMES[i], b = NAMES[j], want = Math.sign(FACES[a].layer - FACES[b].layer);
   for (const fa of groupOf[a]) { for (const fb of groupOf[b]) {
    if (areaOf([fa.poly, fb.poly]) <= MIN_AREA) continue;
    if (!want || want !== Math.sign(fa.layer - fb.layer)) { okLayers = false; break }
   } if (!okLayers) break }
  }
  if (!okLayers) continue;
  fail(3, '花弁の折り目と背のつながり方が、つる⑦のあとと違います');
  /* ④ 結び：局所の12本が、種類つきで素材の区間をちょうど覆う（余分な折り目で何本かに分かれていてよい）／
     動く面の結びは、その12本か、まとまりの中の平らな折り目だけ */
  const mat = {}; for (const n of Object.keys(MAT)) mat[n] = lin(D, MAT[n]);
  const nameOfId = new Map(NAMES.flatMap(k => groupOf[k].map(f => [f.faceId, k])));
  const onLine = (seg, a, b) => { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]);
   return seg.every(q => Math.abs((q[0] - a[0]) * d[1] - (q[1] - a[1]) * d[0]) / L < TOL && ((q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1]) / L > -TOL && ((q[0] - a[0]) * d[0] + (q[1] - a[1]) * d[1]) / L < L + TOL) };
  let okBonds = true;
  const pairKey = (x, y) => [x, y].sort().join('|');
  const modelPair = new Map(BONDS.map(r => [pairKey(r[0], r[1]), r]));
  for (const [x, y, a, b, kind] of BONDS) {
   const hit = cache.bonds.filter(bd => pairKey(nameOfId.get(bd.faceIds[0]), nameOfId.get(bd.faceIds[1])) === pairKey(x, y) && nameOfId.get(bd.faceIds[0]) !== nameOfId.get(bd.faceIds[1]));
   const len = hit.reduce((s, bd) => s + dist(bd.seg[0], bd.seg[1]), 0);
   if (!hit.length || hit.some(bd => bd.kind !== kind || !onLine(bd.seg, mat[a], mat[b])) || Math.abs(len - dist(mat[a], mat[b])) > TOL) { okBonds = false; break }
  }
  if (okBonds) for (const bd of cache.bonds) {
   const [nx, ny] = bd.faceIds.map(id => nameOfId.get(id));
   const touchesMoving = [nx, ny].some(k => k && FACES[k].role !== 'fixed');
   if (!touchesMoving) continue;
   if (nx && nx === ny) continue;/* まとまりの中の平らな折り目（①で crease・同じ xf・つながりを確かめた） */
   if (!(nx && ny && modelPair.has(pairKey(nx, ny)))) { okBonds = false; break }
  }
  if (!okBonds) continue;
  /* 置き場の点（いまの紙面） */
  const pt = {};
  const own = { O: 'T3R', P: 'T3R', "P'": 'T3L', M: 'T3R', Q3: 'T2R', Q2R: 'G2R', Q2L: 'G2L', B: 'T1R', A: 'T1L' };
  for (const n of Object.keys(MAT)) pt[n] = apply(faceOf[own[n]].xf, mat[n]);
  pt.Q = pt.Q3;
  if (dist(pt.Q2R, pt.Q) > TOL || dist(pt.Q2L, pt.Q) > TOL) continue;
  fail(4, '花弁の上に止まった紙が乗っています（持ち上げると突き抜けます）');
  /* ⑤ 周囲の紙（出発）：動く面と面積で重なる止まった紙は、ぜんぶ動く面より下 */
  const movingIds = new Set(MOVING.flatMap(k => groupOf[k].map(f => f.faceId)));
  const stationary = cache.faces.filter(f => !movingIds.has(f.faceId));
  if (stationary.some(f => MOVING.some(k => groupOf[k].some(g => f.layer >= g.layer && areaOf([f.poly, g.poly]) > MIN_AREA)))) continue;
  fail(5, '花弁の軸の上に、その軸より上の層の紙が触れています（軸のまわりを回ると横切ります）');
  /* ⑥ 周囲の紙（軸の一周）：軸（花弁 P-M・P'-M／2枚目の脇 P-Q・P'-Q）に触れる止まった紙が、軸の層より上にない。
     軸の層＝その軸で結ばれた2つのまとまり（T2R|T3R・T2L|T3L・S2R|G2R・S2L|G2L）の、その場所の面。
     🚨layer の番号は**面積で重なる面どうしでしか**上下を意味しない（背を開いた紙は番号が詰め直されない＝離れた面の番号は比べられない）。
       ⚠以前は軸に触れる紙の番号を花弁の面の番号とそのまま比べていた＝折り目だけの⑦（番号 0〜3）では通り、折って開いた⑦（花弁 L3・隣の T3R L15）で誤って断った。
     そこで、止まった紙 f と軸に接するモデルの面 g が軸の上で共有する区間の中点から、軸のすぐ両脇の点を取り、f と g の両方に入る点で layer を比べる。 */
  const AXES6 = [['P', 'M', 'T2R', 'T3R'], ["P'", 'M', 'T2L', 'T3L'], ['P', 'Q', 'S2R', 'G2R'], ["P'", 'Q', 'S2L', 'G2L']];
  const above = AXES6.some(([a, b, mk, fk]) => {
   const A = pt[a], B = pt[b], L = dist(A, B), nrm = [-(B[1] - A[1]) / L, (B[0] - A[0]) / L];
   const refs = [...groupOf[mk], ...groupOf[fk]].map(g => ({ g, r: segRangeInConvex(A, B, g.poly) })).filter(v => v.r);
   return stationary.some(f => { const rf = segRangeInConvex(A, B, f.poly); if (!rf) return false;
    return refs.some(({ g, r }) => { const lo = Math.max(r[0], rf[0]), hi = Math.min(r[1], rf[1]); if ((hi - lo) * L <= 1e-9) return false;
     const t = (lo + hi) / 2, m = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
     return [1, -1].some(sg => { const s = [m[0] + nrm[0] * sg * 1e-6, m[1] + nrm[1] * sg * 1e-6];
      return insideStrict(s, g.poly) && insideStrict(s, f.poly) && f.layer > g.layer }) }) });
  });
  if (above) continue;
  const groups = Object.fromEntries(NAMES.map(k => [k, groupOf[k].map(f => f.faceId)]));
  found.push({ D: D.slice(), G: G.slice(), faceOf: Object.fromEntries(NAMES.map(k => [k, faceOf[k].faceId])), mat, pt,
   ...(NAMES.some(k => groups[k].length > 1) ? { groupOf: groups } : {}),
   moving: [...movingIds].sort(), petalId: `petal:${MODEL}@${rd(mat.P).join(',')}|${rd(mat["P'"]).join(',')}` });
 }
 return { bindings: found, reason: found.length ? null : best.reason };
}

/* 面 → モデルの名前（まとまりがあればその面ぜんぶ） */
const namesOf = bind => new Map(bind.groupOf ? Object.entries(bind.groupOf).flatMap(([k, ids]) => ids.map(id => [id, k])) : Object.entries(bind.faceOf).map(([k, v]) => [v, k]));
/* ================= 運動（check_petal_fold.py の pose_numeric と同じ式） ================= */
function motion(bind, faces) {
 const P = [...bind.pt.P, 0], Pl = [...bind.pt["P'"], 0], Q = [...bind.pt.Q, 0];
 const kP = unit3(sub3(P, Pl)), kQ = unit3(sub3(Q, P)), kQL = unit3(sub3(Q, Pl));
 const nameOf = namesOf(bind);
 const xfOf = new Map(faces.map(f => [f.faceId, f.xf]));
 /* 素材の点 p（面 faceId の上）の、θ での 3D の位置 */
 return (faceId, p, th) => {
  const b = [...apply(xfOf.get(faceId), p), 0], k = nameOf.get(faceId), phi = phiOf(th);
  if (!k || FACES[k].role === 'fixed') return b;
  if (k === 'T2R' || k === 'T2L') return add3(P, rot(kP, th, sub3(b, P)));
  if (k === 'T1R') return add3(P, rot(kP, th, rot(kQ, phi, sub3(b, P))));
  if (k === 'S2R') return add3(P, rot(kQ, -phi, sub3(b, P)));
  if (k === 'T1L') return add3(P, rot(kP, th, add3(sub3(Pl, P), rot(kQL, -phi, sub3(b, Pl)))));
  if (k === 'S2L') return add3(Pl, rot(kQL, phi, sub3(b, Pl)));
  bad(`動く面の役割が決まりません（${faceId}）`);
 };
}
/* 終端（θ=π）の置かれ方：軸での鏡映の合成（z は 0 に戻る）。運動の θ=π と一致することを別に見る。 */
function endXf(bind, face) {
 const k = namesOf(bind).get(face.faceId);
 const { P, Q } = bind.pt, Pl = bind.pt["P'"];
 const Rpp = reflXf(Pl, P), Rpq = reflXf(P, Q), Rlq = reflXf(Pl, Q);
 const L = k === 'T2R' || k === 'T2L' ? Rpp : k === 'T1R' ? compose(Rpp, Rpq) : k === 'S2R' ? Rpq : k === 'T1L' ? compose(Rpp, Rlq) : k === 'S2L' ? Rlq : null;
 return L ? compose(L, face.xf) : face.xf.slice();
}

/* ================= 重なりの領域（包除・重なる面の組だけをたどる） ================= */
function regionsOf(faces) {
 const ids = faces.map(f => f.faceId).sort(), poly = new Map(faces.map(f => [f.faceId, f.poly]));
 const subsets = [];
 const grow = (members, start) => {
  for (let i = start; i < ids.length; i++) {
   const next = [...members, ids[i]], a = areaOf(next.map(id => poly.get(id)));
   if (a <= MIN_AREA) continue;
   subsets.push({ faces: next, area: a }); grow(next, i + 1);
  }
 };
 grow([], 0);
 const byKey = new Map(subsets.map(s => [s.faces.join('|'), s]));
 const cells = [];
 for (const s of subsets) {
  let ex = 0;
  for (const t of subsets) if (t.faces.length >= s.faces.length && s.faces.every(x => t.faces.includes(x))) ex += (-1) ** (t.faces.length - s.faces.length) * t.area;
  if (ex > MIN_AREA) cells.push({ faces: s.faces, area: ex });
 }
 void byKey;
 return cells;
}

/* ================= 再生（1手）：入力の cache は書きかえない ================= */
function bindStep(step, cache) {
 const { bindings, reason } = recognize(cache);
 if (!bindings.length) bad(`いまの紙に検証ずみの花弁がありません（${reason}）`);
 const hit = bindings.filter(b => (b.groupOf ? b.groupOf.T2R.includes(step.base.faceId) : b.faceOf.T2R === step.base.faceId) && near(step.pivots[0], b.mat.P) && near(step.pivots[1], b.mat["P'"]));
 if (!hit.length) bad('原本の base.faceId と pivots が、いまの紙の花弁と合いません');
 if (hit.length > 1) bad(`花弁が1つに決まりません（${hit.length}通り）`);
 const bind = hit[0], want = axesOf(bind);
 const key = ax => JSON.stringify(ax.role === 'drive' ? [ax.role, rd(ax.from), rd(ax.to)] : [ax.role, rd(ax.vertex), rd(ax.end)]);
 const a = step.axes.map(key).sort(), b = want.map(key).sort();
 if (JSON.stringify(a) !== JSON.stringify(b)) bad('原本の axes（素材上の軸と役割）が、いまの紙の花弁の軸と合いません');
 return bind;
}
function axesOf(bind) {
 const m = bind.mat, R = n => rd(m[n], 12);
 return [
  { from: R("P'"), to: R('P'), role: 'drive' },
  { vertex: R('P'), end: R('Q3'), role: 'petal-kite' }, { vertex: R('P'), end: R('B'), role: 'side-hinge' },
  { vertex: R('P'), end: R('Q2R'), role: 'fixed-kite' }, { vertex: R('P'), end: R('O'), role: 'fixed-fold' },
  { vertex: R("P'"), end: R('Q3'), role: 'petal-kite' }, { vertex: R("P'"), end: R('A'), role: 'side-hinge' },
  { vertex: R("P'"), end: R('Q2L'), role: 'fixed-kite' }, { vertex: R("P'"), end: R('O'), role: 'fixed-fold' },
 ];
}
/* 途中の運動でも、動く面に触れる結びはぜんぶ（モデルの12本も、まとまりの中の余分な折り目も）両側で同じ所にあるか。
   θ を 1/16 刻み（端を除く）・結びの両端と中点で、両側の面の運動で写した 3D の点の最大のずれを返す。 */
function motionBondGap(bind, cache) {
 const moving = new Set(bind.moving), pose = motion(bind, cache.faces), has = new Set(cache.faces.map(f => f.faceId));
 let worst = { max: 0, bondId: null, deg: 0 };
 for (const bd of cache.bonds) {
  const [x, y] = bd.faceIds; if (!moving.has(x) && !moving.has(y)) continue;
  if (!has.has(x) || !has.has(y)) continue;
  const pts = [bd.seg[0], [(bd.seg[0][0] + bd.seg[1][0]) / 2, (bd.seg[0][1] + bd.seg[1][1]) / 2], bd.seg[1]];
  for (let i = 1; i < 16; i++) { const th = Math.PI * i / 16;
   for (const q of pts) { const u = pose(x, q, th), v = pose(y, q, th), d = Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    if (d > worst.max) worst = { max: d, bondId: bd.bondId, deg: 180 * i / 16 } } }
 }
 return worst;
}
/* 終端の面・結び・折り目・層を作る（stack の照合はしない＝候補づくりと再生の共通部分） */
function build(bind, cache, stepId) {
 const moving = new Set(bind.moving), pose = motion(bind, cache.faces);
 const faces = cache.faces.map(f => {
  if (!moving.has(f.faceId)) return { faceId: f.faceId, layerPath: C(f.layerPath), poly: f.poly.map(p => p.slice()), xf: f.xf.slice(), layer: f.layer };
  const xf = endXf(bind, f), matPoly = f.poly.map(p => invPt(f.xf, p));
  /* 運動の θ=π と鏡映の合成が同じ所へ置くこと（式の取り違えの見張り） */
  for (const p of matPoly) { const e = pose(f.faceId, p, Math.PI), q = apply(xf, p);
   if (Math.abs(e[2]) > 1e-9 || dist(e, q) > 1e-9) bad(`面 ${f.faceId} の終端が、運動の θ=180° と一致しません`) }
  return { faceId: f.faceId, layerPath: C(f.layerPath), poly: matPoly.map(p => apply(xf, p)), xf, layer: f.layer };
 });
 const byId = new Map(faces.map(f => [f.faceId, f])), was = new Map(cache.faces.map(f => [f.faceId, f]));
 const gap = motionBondGap(bind, cache);
 if (gap.max > 1e-9) bad(`結び ${gap.bondId} が運動の途中（θ=${gap.deg.toFixed(2)}°）で両側に離れます`);
 /* 結び：終端で両側の置かれ方が同じ＝平ら（crease）／結びの線で鏡に映した置かれ方＝折れている（hinge）／ほかは裂け */
 const bonds = cache.bonds.map(bd => {
  const [x, y] = bd.faceIds, fx = byId.get(x), fy = byId.get(y), out = C(bd);
  if (!fx || !fy) return out;
  if (bd.seg.some(q => dist(apply(fx.xf, q), apply(fy.xf, q)) > 1e-7)) bad(`結び ${bd.bondId} にそって紙が切り離されます`);
  if (!moving.has(x) && !moving.has(y)) return out;
  const same = near(fx.xf, fy.xf, 1e-9), folded = near(fx.xf, compose(fy.xf, reflXf(bd.seg[0], bd.seg[1])), 1e-9);
  const kind = same ? 'crease' : folded ? 'hinge' : bad(`結び ${bd.bondId} の両側が、終端で平らにも折れた形にもなっていません`);
  if (bd.kind === 'hinge' && kind === 'crease') out.openedBy = stepId;
  if (bd.kind === 'crease' && kind === 'hinge') out.closedBy = stepId;
  out.kind = kind;
  return out;
 });
 /* 折り目（いまの座標）：背になった結びの上のものは外す／動いた面の持ち物は一緒に運ぶ／開いた背は折り目として足す */
 const closed = bonds.filter(b => b.closedBy === stepId), opened = bonds.filter(b => b.openedBy === stepId);
 const collinear = (seg, a, b) => { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]);
  return seg.every(q => Math.abs((q[0] - a[0]) * d[1] - (q[1] - a[1]) * d[0]) / L < 1e-7) };
 const creases = [];
 for (const c of cache.creases || []) {
  const owner = was.get(c.faceId);
  if (!owner) bad(`折り目 ${c.creaseId} の持ち主の面がありません`);
  if (closed.some(b => b.faceIds.includes(c.faceId) && collinear(c.seg, apply(owner.xf, b.seg[0]), apply(owner.xf, b.seg[1])))) continue;
  const now = byId.get(c.faceId);
  creases.push({ ...C(c), seg: moving.has(c.faceId) ? c.seg.map(q => apply(now.xf, invPt(owner.xf, q))) : C(c.seg) });
 }
 let cn = creases.length;
 for (const b of opened) { const f = byId.get(b.faceIds.slice().sort()[0]);
  creases.push({ creaseId: `c-${stepId}-${++cn}`, stepId, faceId: f.faceId, seg: b.seg.map(q => apply(f.xf, q)), kind: 'V' }) }
 /* 層：全重なり領域で、θ=π(1-ε) の高さから上下を決める。止まる面どうしの同着は直前の層を継ぐ。動く面の同着は断る。 */
 const cells = regionsOf(faces);
 const total = cells.reduce((s, c) => s + c.area * c.faces.length, 0);
 if (Math.abs(total - 4) > 1e-7) bad(`列挙した領域で紙の面積を使い切っていません（${total}）`);
 const regions = [];
 for (const cell of cells.filter(c => c.faces.length >= 2).sort((a, b) => a.faces.join().localeCompare(b.faces.join()))) {
  const verts = V2().intersect(cell.faces.map(id => byId.get(id).poly));
  const probe = [verts.reduce((s, v) => s + v[0], 0) / verts.length, verts.reduce((s, v) => s + v[1], 0) / verts.length];
  let order = null;
  for (const eps of EPS_LIST) {
   const th = Math.PI * (1 - eps);
   const zs = cell.faces.map(id => ({ id, z: moving.has(id) ? pose(id, invPt(byId.get(id).xf, probe), th)[2] : 0 })).sort((a, b) => a.z - b.z);
   const groups = [];
   for (const it of zs) { if (groups.length && Math.abs(it.z - groups[groups.length - 1][0].z) <= TIE) groups[groups.length - 1].push(it); else groups.push([it]) }
   const o = [];
   for (const g of groups) {
    if (g.length > 1 && g.some(it => moving.has(it.id))) bad(`重なりの上下が決まりません（動く面が同着：${g.map(it => it.id).join(',')}）`);
    o.push(...g.sort((a, b) => was.get(a.id).layer - was.get(b.id).layer).map(it => it.id));
   }
   if (order && JSON.stringify(o) !== JSON.stringify(order)) bad(`ε を縮めると重なりの上下が変わります（${cell.faces.join(',')}）`);
   order = o;
  }
  regions.push({ faces: cell.faces.slice(), area: cell.area, order });
 }
 const below = new Map(faces.map(f => [f.faceId, new Set()]));
 for (const r of regions) for (let i = 1; i < r.order.length; i++) below.get(r.order[i]).add(r.order[i - 1]);
 const layer = new Map(); let left = faces.map(f => f.faceId);
 while (left.length) {
  const ready = left.filter(id => [...below.get(id)].every(x => layer.has(x)));
  if (!ready.length) bad(`重なりの上下に循環があります（${left.join(',')}）`);
  for (const id of ready) layer.set(id, [...below.get(id)].reduce((s, x) => Math.max(s, layer.get(x) + 1), 0));
  left = left.filter(id => !layer.has(id));
 }
 for (const f of faces) f.layer = layer.get(f.faceId);
 return { faces, bonds, creases, hinges: C(cache.hinges || []), regions };
}
function applyStep(step, cache) {
 const bind = bindStep(step, cache);
 const out = build(bind, cache, step.id);
 const got = new Map(out.regions.map(r => [r.faces.slice().sort().join('|'), r.order.join('>')]));
 const want = new Map(step.stack.map(r => [r.slice().sort().join('|'), r.join('>')]));
 for (const [k, v] of want) {
  if (!got.has(k)) bad(`stack に、重なっていない面の組が書かれています（${k.split('|').join(' と ')}）`);
  if (got.get(k) !== v) bad(`stack の上下が再生結果と違います（${k}：原本 ${v}／再生 ${got.get(k)}）`);
 }
 for (const [k, v] of got) if (!want.has(k)) bad(`stack に、重なっている領域が書かれていません（${k}：下から ${v}）`);
 const detail = { model: MODEL, stepId: step.id, petalId: bind.petalId, faceOf: C(bind.faceOf), moving: bind.moving.slice(),
  regions: out.regions.map(r => ({ faces: r.faces.slice().sort(), order: r.order.slice(), area: r.area })),
  bind: C(bind), before: { faces: C(cache.faces), bonds: C(cache.bonds) }, after: C(out.faces),
  note: '厚み0。受理は検証ずみの1回目の花弁折りだけ（check_petal_fold.py）' };
 return { cache: { faces: out.faces, hinges: out.hinges, creases: out.creases, bonds: out.bonds }, detail };
}
/* 候補の手を、いまの cache から組む（受理と同じ認識・同じ終端の計算。stack は計算結果をそのまま入れる） */
function candidateSteps(cache, stepId, diagramStep) {
 const { bindings, reason } = recognize(cache);
 return { reason, steps: bindings.map(bind => {
  const out = build(bind, cache, stepId);
  return { id: stepId, diagramStep, op: 'petal', instruction: 'はしを もちあげて ふくろを つくり、つぶす', model: MODEL,
   base: { faceId: bind.faceOf.T2R }, pivots: [rd(bind.mat.P, 12), rd(bind.mat["P'"], 12)], axes: axesOf(bind), branch: C(BRANCH),
   stack: out.regions.map(r => r.order.slice()) };
 }) };
}

/* ================= 動きの座標（描画へ渡すもの） =================
   面ごとに、素材の頂点の順（素材で左回り＝表が手前を向く巻き順）で扇に割った三角形。z は高さ。
   frames は面ごとの「素材の点 → 3D の点」（照合用）、positions は描く順に並べた Float32Array。 */
function frames(detail, t) {
 if (typeof t !== 'number' || !(t >= 0 && t <= 1)) bad('t は 0〜1 です');
 const pose = motion(detail.bind, detail.before.faces), th = Math.PI * t;
 return detail.before.faces.map(f => {
  let mp = f.poly.map(p => invPt(f.xf, p));
  if (polyArea(mp) < 0) mp = mp.slice().reverse();
  return { faceId: f.faceId, moving: detail.moving.includes(f.faceId), pts: mp.map(p => ({ m: p, p: pose(f.faceId, p, th) })) };
 });
}
function drawOrder(detail) {
 return detail.before.faces.slice().sort((a, b) => b.layer - a.layer || a.faceId.localeCompare(b.faceId)).map(f => f.faceId);
}
function positions(detail, t) {
 const fr = new Map(frames(detail, t).map(f => [f.faceId, f])), tris = [];
 for (const id of drawOrder(detail)) { const pts = fr.get(id).pts;
  for (let i = 1; i + 1 < pts.length; i++) tris.push(pts[0].p, pts[i].p, pts[i + 1].p) }
 const a = new Float32Array(tris.length * 3);
 tris.forEach((p, i) => { a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2] });
 return a;
}

return { MODEL, LINKAGE, BRANCH, ROLES, MAT, FACES, BONDS, SYM, validateStep, recognize, applyStep, candidateSteps, frames, positions, drawOrder, regionsOf, axesOf, phiOf, motionBondGap };
})();
