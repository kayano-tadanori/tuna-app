'use strict';
/* 袋折り（つる③「ふくろを ひらいて つぶす」）だけを対象にした **v2 の原本スキーマと再生器**。
   ⛔ 既存アプリ・作品・v1スキーマ・freefold3d.html は触らない。
   🚪 入口は engine の `FreeFoldEngine.replay` 1本（2026-09-14）。engine は version 2 を `replayWith` へ渡し、
      v2 の中の通常の手は **engine が引数で渡す内部の再生器（replayV1）** が再生する＝ここから engine の入口を呼び戻さない。
      この `SquashV2.replay` は外部入力の入口で、engine の共通入口を通して袋折りの結果を返すだけ。

   ★ 二重実装をしない
     - 運動（連動式・骨の木・座標）は `squash_model.js` を**そのまま呼ぶ**。ここでは作り直さない。
     - 閉路が閉じるかも、モデル自身の FK（`SquashModel.rays`）の**輪の1本のすきま**で見る。
     - v1 の手（fold / crease / flip）は engine の内部の再生器（`replayWith` の引数）に**そのまま渡す**。
     - 検算の突き合わせ先（層順・領域）は `check_squash_layers.py` が出した結果と同じもの。

   ★ 決めごと（本人・2026-09-13）
     - 比較点は**全重なり領域から作る**。人が書いた `at` は採用しない。
     - `stack` は**検算用の上下関係**。重ならない面どうしに順位を要求しない。
     - 軸は**素材上の vertex/end と drive/link の役割**で特定する。角度ソートの R 番号は保存の識別子にしない。
     - 受理は**検証ずみの形だけ**。構造が同じでも（中線2回など）受理しない。
     - 同着の継承は固定面どうしだけ。動く面が同着なら拒否。

   ⛔ この再生器が言わないこと
     - **非貫通は未検証。** 閉路が閉じることだけで「物理的に折れる」とは言わない。
     - 厚みは 0。層は「どちらが上か」だけで、すきまの大きさは持たない。
     - 一般の袋折りへは広げない。受理するのは degree4-45 の、つる③の形だけ。
   🔄 どの角から2回半分に折ったつる②でも（2026-09-14）：条件は緩めず、**素材の対称 D と平面の対称 G** で
      検証ずみモデルへ読みかえる（②-0）。G·(いまの紙) ＝ 状態② ∘ D（高さはそのまま）がちょうど1通りのときだけ受理。
      運動は「Gᵀ ∘ 検証ずみの運動 ∘ D」。独立検証は check_squash_flip.py（表・裏返しの角の選び方ぜんぶ）。
*/
globalThis.SquashV2 = (() => {

const E = () => globalThis.FreeFoldEngine;
const M = () => globalThis.SquashModel;

const MODEL = 'degree4-45-tsuru3';
const LINKAGE = 'tan-half-product-sqrt2';
const V1_OPS = ['fold', 'crease', 'flip'];
const OPS = [...V1_OPS, 'squash', 'petal'];
/* 🌸 v2 の特別な手（v1 の検証器へ渡さない手）。petal の中身は petal_v2.js（PetalV2）が持つ。 */
const SPECIAL = ['squash', 'petal'];
const Petal = () => globalThis.PetalV2;
const ROLES = ['drive', 'link', 'folded', 'flat'];
const MAX_STEPS = 100, MAX_FACES = 64;

const TOL = 1e-7;            /* 素材座標で「同じ点・同じ向き」とみなす幅 */
const TIE = 1e-12;           /* 同着のしきい値（この正規化モデル専用。丸め誤差 ~1e-16 と動く面 ~5e-7 のあいだ） */
const EPS = 1e-6;            /* 層順を読む終端手前の位置 t = 1-EPS */
const MIN_AREA = 1e-9;       /* 領域として数える最小の面積 */

const C = x => JSON.parse(JSON.stringify(x));
const bad = m => { throw Error('v2：' + m); };

/* ================= 担当の分けかた =================
   **v1 の部分（format・work・paper・coordinates・座標の範囲・step の必須項目・layerPath・id・手数・
   未知の項目）は、既存の検証器（`origami_recipe.js` の validate ＋ `origami_recipe.schema.json`）に
   そのまま任せる。** ここで書き写すと門が二重になり、片方を壊しても検査が鳴らない。
   v2 の担当は「version が 2 であること」と「op:'squash' の手ぜんぶ」だけ。
   🚨検証器を渡していなければ**再生しない**（黙って v1 の検査を飛ばさない）。 */
let V1 = null;
function useV1Validator(validate, schema) {
 if (typeof validate !== 'function') bad('v1 の検証器（origami_recipe.js の validate）が関数ではありません');
 if (!schema || !schema.properties || !schema.properties.version || schema.properties.version.const !== 1)
  bad('v1 の schema が origami_recipe.schema.json ではありません（version の const が 1 でない）');
 V1 = { validate, schema };
}

/* ================= 小道具（2D） ================= */
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const invPt = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5];
 return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = v => { const n = Math.hypot(v[0], v[1]); return [v[0] / n, v[1] / n] };
const ang = v => { const a = Math.atan2(v[1], v[0]); return a < -1e-12 ? a + 2 * Math.PI : a };
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
const rd = (p, n = 9) => [Math.round(p[0] * 10 ** n) / 10 ** n + 0, Math.round(p[1] * 10 ** n) / 10 ** n + 0];
const keySet = poly => JSON.stringify(poly.map(p => rd(p, 6)).slice().sort((u, v) => u[0] - v[0] || u[1] - v[1]));

const polyArea = poly => { let s = 0;
 for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length];
  s += a[0] * b[1] - b[0] * a[1] } return Math.abs(s) / 2 };
const ccw = poly => { let s = 0;
 for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length];
  s += a[0] * b[1] - b[0] * a[1] } return s > 0 ? poly : poly.slice().reverse() };
/* 線分 a→b の左側で切る（凸多角形どうしの交わり用）。 */
function clipHalf(poly, a, b) {
 const side = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
 const out = [];
 for (let i = 0; i < poly.length; i++) {
  const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
  if (sp >= -1e-12) out.push(p);
  if ((sp > 1e-12 && sq < -1e-12) || (sp < -1e-12 && sq > 1e-12)) {
   const t = sp / (sp - sq);
   out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]) }
 }
 return out;
}
function intersect(polys) {
 let cur = ccw(polys[0].slice());
 for (const raw of polys.slice(1)) { const q = ccw(raw.slice());
  for (let i = 0; i < q.length; i++) { cur = clipHalf(cur, q[i], q[(i + 1) % q.length]);
   if (cur.length < 3) return [] } }
 return cur;
}
function pointIn(poly, p, eps = 1e-9) {
 const q = ccw(poly.slice());
 for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length];
  if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) < eps) return false }
 return true;
}
function hull(pts) {
 const ps = [...new Map(pts.map(p => [JSON.stringify(rd(p, 12)), rd(p, 12)])).values()]
  .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
 if (ps.length < 3) return ps;
 const half = src => { const h = [];
  for (const p of src) { while (h.length >= 2 && cross2([h[h.length - 1][0] - h[h.length - 2][0], h[h.length - 1][1] - h[h.length - 2][1]],
   [p[0] - h[h.length - 2][0], p[1] - h[h.length - 2][1]]) <= 0) h.pop(); h.push(p) } return h };
 const lo = half(ps), up = half(ps.slice().reverse());
 return lo.slice(0, -1).concat(up.slice(0, -1));
}
/* 重なりを**全部**列挙する（凸多角形の包除）。人が書いた点には頼らない。 */
function allRegions(facePolys) {
 const ids = Object.keys(facePolys).sort(), inter = new Map();
 const combos = [];
 for (let mask = 1; mask < (1 << ids.length); mask++) {
  const sub = ids.filter((_, i) => mask & (1 << i));
  combos.push(sub);
  inter.set(sub.join('|'), polyArea(intersect(sub.map(i => facePolys[i]))));
 }
 const cells = [];
 for (const sub of combos) {
  let s = 0;
  for (const sup of combos) {
   if (!sub.every(x => sup.includes(x))) continue;
   s += (-1) ** (sup.length - sub.length) * inter.get(sup.join('|'));
  }
  if (s > MIN_AREA) cells.push({ faces: sub, area: s });
 }
 return cells;
}
const bary = (tri, p) => {
 const [[x1, y1], [x2, y2], [x3, y3]] = tri;
 const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
 const a = ((y2 - y3) * (p[0] - x3) + (x3 - x2) * (p[1] - y3)) / d;
 const b = ((y3 - y1) * (p[0] - x3) + (x1 - x3) * (p[1] - y3)) / d;
 return [a, b, 1 - a - b];
};

/* ================= 入口の検査（format / version / op / 必須項目） ================= */
const STEP_FIELDS = {
 fold:   { req: ['id', 'op', 'kind', 'reference', 'line', 'movingSidePoint'], opt: ['diagramStep', 'targets', 'instruction'] },
 crease: { req: ['id', 'op', 'kind', 'reference', 'line', 'movingSidePoint'], opt: ['diagramStep', 'targets', 'instruction'] },
 flip:   { req: ['id', 'op', 'axis'], opt: ['diagramStep', 'instruction'] },
 squash: { req: ['id', 'diagramStep', 'op', 'instruction', 'model', 'vertex', 'base', 'axes', 'branch', 'stack'], opt: [] },
};
const isPt = p => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && Number.isFinite(v));
/* 原紙の中か（v1 schema の $defs.point と同じ -1〜1）。v2 固有の点にも同じ範囲をかける。 */
const inPaper = p => p.every(v => v >= -1 && v <= 1);

function validate(recipe) {
 if (!V1) bad('v1 の検証器が読みこまれていません（SquashV2.useV1Validator を先に呼んでください）');
 /* v2 の担当①＝version。ここだけは v1 の schema（const 1）に任せられない。 */
 if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) bad('原本がオブジェクトではありません');
 if (recipe.version !== 2) bad(recipe.version === 1
  ? 'version 1 はこの再生器の担当ではありません（v1 は freefold_engine.replay へ）'
  : `version が 2 ではありません（${String(recipe.version).slice(0, 20)}）`);
 if (!Array.isArray(recipe.steps)) bad('steps がありません');
 /* v2 の担当②＝squash の手を取り分ける。ほかの op は名前も必須項目も見ない＝v1 の検証器の担当。 */
 const at = [];
 recipe.steps.forEach((st, i) => {
  if (!st || typeof st !== 'object' || Array.isArray(st)) bad(`${i + 1}手目が手の形をしていません`);
  if (SPECIAL.includes(st.op)) at.push(i);
 });
 /* 🧺 squash が0手の v2＝袋折りを巻き戻した原本。**version は勝手に戻さない**（履歴で version を切りかえない）。
    手はぜんぶ v1 の手なので、ぜんぶ既存の検証器へ渡す。
    ⚠手が0本まで巻き戻したときだけ、schema の steps.minItems(1) を 0 にした写しで見る
      （engine の create が作る手0本の原本と同じ状態。ほかの決まりは1つも緩めない）。 */
 if (!at.length) {
  let schema = V1.schema;
  if (!recipe.steps.length) { schema = C(V1.schema); schema.properties.steps.minItems = 0 }
  try { V1.validate({ ...C(recipe), version: 1 }, schema) }
  catch (e) { bad(`袋折りを巻き戻した原本の手（v1）が原本の形になっていません：${e.message}`) }
  return true;
 }
 /* 🧺 袋折りのあとの手も v1 の手（fold / crease / flip）。**袋折りの前と後の手をまとめて**既存の検証器へ渡す
    （2026-09-14・袋折りのあとも折り続ける）。⚠「squash は最後の手」の決まりはここで外した。
    🚨v1 の部分は**既存の検証器へそのまま渡す**＝format・work・paper・coordinates・座標の範囲
    （$defs.point は -1〜1）・step の必須項目・layerPath（side は keep/cut の enum）・id の綴り・
    手数の上限・未知の項目（top も入れ子も additionalProperties:false）・未対応の op。 */
 if (at[0] === 0) bad('袋折り・花弁折りの前の手（v1）がありません');
 /* 🧺 袋折りは何手でもよい（2026-09-15・2回目の袋折り）。袋折りでない手は、前後をまとめて既存の検証器へ（今までどおり）。
    ⚠受理するかは再生の門（1手ごとに、そのときの紙で照合）が決める＝ここで手数を数えて断らない。 */
 const v1 = { ...C(recipe), version: 1, steps: C(recipe.steps.filter(s => !SPECIAL.includes(s.op))) };
 try { V1.validate(v1, V1.schema) }
 catch (e) { bad(`袋折りの前後の手（v1）が原本の形になっていません：${e.message}`) }
 for (const k of at) {
  if (recipe.steps[k].op === 'squash') { validateSquashStep(recipe.steps[k], `${k + 1}手目`); continue }
  /* 🌸 花弁折りの手。読む器（petal_v2.js）が無ければ、黙って飛ばさずに断る。 */
  if (!Petal() || typeof Petal().validateStep !== 'function') bad(`${k + 1}手目は花弁折り（op:'petal'）です。この読み手には花弁折りの再生器（petal_v2.js）が読みこまれていません`);
  Petal().validateStep(recipe.steps[k], `${k + 1}手目`);
 }
 const ids = recipe.steps.map(s => s.id);
 if (new Set(ids).size !== ids.length) bad('手の id が重複しています');
 return true;
}

function validateSquashStep(st, where) {
 /* v1 の step と同じ枠（必須項目・未知の項目・id の綴り）も、ここでは**v2 が持つ**
    ＝squash の手は v1 の検証器へ渡していないので、渡していないぶんだけ自分で見る。 */
 const f = STEP_FIELDS.squash;
 for (const k of f.req) if (!(k in st)) bad(`${where}（squash）に ${k} がありません`);
 for (const k of Object.keys(st)) if (!f.req.includes(k) && !f.opt.includes(k))
  bad(`${where}（squash）に知らない項目があります（${k}）`);
 if (typeof st.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(st.id)) bad(`${where}の id の綴りが原本の決まりに合いません`);
 if (typeof st.diagramStep !== 'string' || !st.diagramStep) bad(`${where}の diagramStep が空か文字列ではありません`);
 if (typeof st.instruction !== 'string' || !st.instruction || st.instruction.length > 2000) bad(`${where}の instruction が空か長すぎます（2000字まで）`);
 if (st.model !== MODEL) bad(`${where}の model が ${MODEL} ではありません（${String(st.model).slice(0, 40)}）`);
 if (!isPt(st.vertex)) bad(`${where}の vertex が素材上の点ではありません`);
 if (!inPaper(st.vertex)) bad(`${where}の vertex が原紙の外です（-1〜1）`);
 if (!st.base || typeof st.base !== 'object' || Array.isArray(st.base) || typeof st.base.faceId !== 'string')
  bad(`${where}の base.faceId がありません（基準面を明示してください）`);
 for (const k of Object.keys(st.base)) if (k !== 'faceId') bad(`${where}の base に知らない項目があります（${k}）`);
 if (!st.base.faceId.length || st.base.faceId.length > 8192) bad(`${where}の base.faceId の長さが原本の決まりに合いません`);
 if (!Array.isArray(st.axes) || st.axes.length !== 8) bad(`${where}の axes が8本ちょうどではありません（${(st.axes || []).length}本）`);
 const seen = new Set();
 for (const ax of st.axes) {
  if (!ax || typeof ax !== 'object') bad(`${where}の axes に軸でないものが混じっています`);
  for (const k of Object.keys(ax)) if (!['vertex', 'end', 'role'].includes(k)) bad(`${where}の軸に知らない項目があります（${k}）`);
  if (!isPt(ax.vertex) || !isPt(ax.end)) bad(`${where}の軸は素材上の vertex と end で書いてください`);
  if (!inPaper(ax.vertex) || !inPaper(ax.end)) bad(`${where}の軸が原紙の外です（-1〜1）`);
  if (!ROLES.includes(ax.role)) bad(`${where}の軸の役割が ${ROLES.join(' / ')} ではありません（${String(ax.role).slice(0, 30)}）`);
  if (dist(ax.vertex, st.vertex) > TOL) bad(`${where}の軸が頂点から出ていません`);
  if (dist(ax.vertex, ax.end) < TOL) bad(`${where}の軸の長さが0です`);
  const k = JSON.stringify(rd(unit([ax.end[0] - ax.vertex[0], ax.end[1] - ax.vertex[1]]), 6));
  if (seen.has(k)) bad(`${where}に同じ向きの軸が2本あります`); seen.add(k);
 }
 const n = r => st.axes.filter(a => a.role === r).length;
 if (n('drive') !== 1) bad(`${where}の drive（駆動）が1本ではありません（${n('drive')}本）`);
 if (n('link') !== 3) bad(`${where}の link（従属）が3本ではありません（${n('link')}本）`);
 if (n('folded') !== 2) bad(`${where}の folded（180°で固定）が2本ではありません（${n('folded')}本）`);
 if (n('flat') !== 2) bad(`${where}の flat（0°で固定）が2本ではありません（${n('flat')}本）`);
 const br = st.branch;
 if (!br || typeof br !== 'object') bad(`${where}の branch（運動の枝）がありません`);
 for (const k of Object.keys(br)) if (!['linkage', 'sign', 'drive'].includes(k)) bad(`${where}の branch に知らない項目があります（${k}）`);
 if (br.linkage !== LINKAGE) bad(`${where}の branch.linkage が ${LINKAGE} ではありません（arcsin 形は端点で崩れるので使いません）`);
 if (br.sign !== 1) bad(`${where}の branch.sign は 1 だけが検証ずみです（${String(br.sign).slice(0, 20)}）`);
 if (!br.drive || typeof br.drive !== 'object' || Array.isArray(br.drive)) bad(`${where}の branch.drive がありません`);
 for (const k of Object.keys(br.drive)) if (!['fromDeg', 'toDeg'].includes(k)) bad(`${where}の branch.drive に知らない項目があります（${k}）`);
 if (br.drive.fromDeg !== 0 || br.drive.toDeg !== 180)
  bad(`${where}の branch.drive は 0°→180° だけが検証ずみです`);
 if (!Array.isArray(st.stack) || !st.stack.length) bad(`${where}の stack（検算用の上下関係）がありません`);
 const seenReg = new Set();
 for (const reg of st.stack) {
  if (!Array.isArray(reg) || reg.length < 2 || !reg.every(v => typeof v === 'string' && v.length && v.length <= 8192))
   bad(`${where}の stack は「重なる領域の面を下から並べた配列」の配列です`);
  if (new Set(reg).size !== reg.length) bad(`${where}の stack の領域に同じ面が2度出ています`);
  const key = reg.slice().sort().join('|');
  if (seenReg.has(key)) bad(`${where}の stack に同じ面の組の領域が2度あります（${key}）`);
  seenReg.add(key);
 }
}

/* ================= ① モデルの再構成（決定論・入力配列の順に依らない） ================= */
function reconstruct(cache, vertex) {
 const faces = cache.faces;
 if (faces.length !== 4) bad(`袋折りの直前は4枚のはずです（${faces.length}枚）`);
 const corners = new Map();
 for (const f of faces) {
  const mp = f.poly.map(p => invPt(f.xf, p));
  const k = mp.map((p, i) => [p, i]).filter(([p]) => dist(p, vertex) < TOL).map(([, i]) => i);
  if (k.length !== 1) bad(`面 ${f.faceId} が頂点 [${vertex}] を1つの角として持ちません`);
  const i = k[0];
  const a = unit([mp[(i + mp.length - 1) % mp.length][0] - vertex[0], mp[(i + mp.length - 1) % mp.length][1] - vertex[1]]);
  const b = unit([mp[(i + 1) % mp.length][0] - vertex[0], mp[(i + 1) % mp.length][1] - vertex[1]]);
  corners.set(f.faceId, { a, b, mid: unit([a[0] + b[0], a[1] + b[1]]) });
  /* 🚨ここで「内角が90°か」を別に見ない。門は下の「8本が45°おき」1本だけ
     ＝2つ置くと片方を壊しても、もう片方が先に断って**検査が鳴らない**（既存の決めごと）。 */
 }
 const rays = new Map();
 const put = (d, fid) => { const k = Math.round(ang(d) * 1e9) / 1e9;
  if (!rays.has(k)) rays.set(k, []); rays.get(k).push(fid) };
 for (const [fid, c] of corners) { put(c.a, fid); put(c.b, fid) }
 if (rays.size !== 4 || [...rays.values()].some(v => v.length !== 2))
  bad(`頂点まわりの境界の光線が「4本・各2面」になっていません（${rays.size}本）`);
 for (const [fid, c] of corners) put(c.mid, fid);
 if (rays.size !== 8) bad(`光線が8本になりません（${rays.size}本）`);
 const order = [...rays.keys()].sort((x, y) => x - y);
 for (let i = 0; i < 8; i++) {
  const d = (order[(i + 1) % 8] - order[i] + 2 * Math.PI) % (2 * Math.PI) * 180 / Math.PI;
  if (Math.abs(d - 45) > 1e-6) bad(`隣りあう光線の角が45°ではありません（${d.toFixed(4)}°）`);
 }
 const bondAt = new Map();
 for (const bd of cache.bonds) {
  const ends = bd.seg, at = ends.filter(e => dist(e, vertex) < TOL);
  if (at.length !== 1) bad(`結び ${bd.faceIds.join(' | ')} が頂点を端に持ちません`);
  const far = dist(ends[0], vertex) < TOL ? ends[1] : ends[0];
  const key = ang([far[0] - vertex[0], far[1] - vertex[1]]);
  const hit = order.findIndex(o => Math.abs(((o - key + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 1e-6);
  if (hit < 0) bad(`結び ${bd.faceIds.join(' | ')} が光線の上にありません`);
  if (bd.kind !== 'hinge') bad(`結び ${bd.faceIds.join(' | ')} が hinge ではありません（${bd.kind}）`);
  bondAt.set(hit, C(bd));
 }
 if (bondAt.size !== 4) bad(`頂点まわりの結びが4本ではありません（${bondAt.size}本）`);
 if (new Set([...bondAt.keys()].map(i => i % 2)).size !== 1)
  bad(`結びが1本おきに並んでいません（R${[...bondAt.keys()].sort()}）`);
 const owner = [];
 for (let i = 0; i < 8; i++) {
  const mid = order[i] + Math.PI / 8;
  const got = [...corners].filter(([, c]) =>
   Math.abs(((ang(c.mid) - mid + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 23 * Math.PI / 180)
   .map(([fid]) => fid);
  if (got.length !== 1) bad(`区間 P${i} の持ち主の面が決まりません`);
  owner.push(got[0]);
 }
 const rho0 = Array.from({ length: 8 }, (_, i) => bondAt.has(i) ? Math.PI : 0);
 const gap = closureGap(rho0);
 if (gap > 1e-9) bad(`この折り角の組では頂点が閉じません（輪のすきま ${gap.toExponential(2)}）`);
 return { order, raysDeg: order.map(a => Math.round(a * 180 / Math.PI * 1e6) / 1e6), owner,
          bondAt, rho0, closure: gap };
}
/* 輪を閉じる1本（R5）の、枝Aと枝Bのずれ。**モデル自身の FK で測る**＝連動式を書き写さない。 */
function closureGap(rho) {
 const u = M().rays(rho);
 return Math.hypot(u[5][0] - u.b5[0], u[5][1] - u.b5[1], u[5][2] - u.b5[2]);
}

/* ================= ② 直前状態が、検証ずみモデルの適用条件に一致するか ================= */
/* 🚨ここを通らなければ**何も返さない**。状態を見ずに固定の完成図を返す、ということをしない。 */
function checkApplicable(cache, rec, vertex) {
 const m = M();
 if (Math.hypot(vertex[0], vertex[1]) > TOL) bad(`この試作の頂点は原紙のまん中 [0,0] だけです（[${vertex}]）`);
 /* ②-1 光線の向きが、検証ずみモデルの8方向（0°から45°おき）と一致する。 */
 for (let i = 0; i < 8; i++) {
  const want = ang(m.RAY[i]);
  if (Math.abs(rec.order[i] - want) > 1e-6)
   bad(`光線 ${i} が検証ずみモデルの向きと違います（${rec.raysDeg[i]}° ≠ ${(want * 180 / Math.PI).toFixed(3)}°）`);
 }
 /* ②-2 折れている4本は**素材の対角**（奇数の光線）。中線2回は構造が同じでも受理しない。 */
 const at = [...rec.bondAt.keys()].sort((a, b) => a - b);
 if (JSON.stringify(at) !== JSON.stringify([1, 3, 5, 7]))
  bad(`折れている結びが素材の対角ではありません（R${at}）＝検証ずみの形（つる③②）ではありません`);
 /* ②-3／②-4 は、素材の対称 D と平面の対称 G（どちらも正方形の8通り）の組ごとに
    「G·(いまの紙) ＝ 検証ずみの状態② ∘ D（高さ z はそのまま）」かを見て、**ちょうど1通り**のときだけ受理する
    （0通り＝検証ずみの形ではない／2通り以上＝対応が決まらない）。
    ★2回の対角半分折りは、1回目・2回目にどの角を選んでも（表・裏返しとも）ちょうど1通りで一致する＝
      同じつる②が平面上で回った・鏡に映った置かれ方になるだけ（check_squash_flip.py で独立に確かめた）。
      ⚠前は G を恒等に固定していたので、検査と違う角から折ると候補が0件だった（2026-09-14 本人の実機で発覚）。
    🚨条件そのもの（姿勢が頂点ごとにぴたり同じ・層の並びが同じ）は緩めない。
    🚨高さは反転しない＝紙全体を返した対応は採らない（それでは袋が下になる）。 */
 const found = [];
 let why = null;
 for (const D of DIHEDRAL) for (const G of DIHEDRAL) {
  const fr = makeFrame(D, G), r = poseMismatch(cache, rec, fr);
  /* 理由は「姿は合ったが層が違う」読みかえを優先して出す（いちばん近い読みかえの理由）。 */
  if (r) { if (why === null || (why.kind === 'pose' && r.kind === 'layer')) why = r; continue }
  found.push(fr);
 }
 if (!found.length) bad(`${why.msg}（素材の対称 D × 平面の対称 G の64通り＝裏返し・回転を含むどの読みかえでも合いません）`);
 if (found.length > 1) bad(`検証ずみモデルとの対応が1通りに決まりません（${found.length}通り）`);
 return found[0];
}

/* ================= ②-0 検証ずみモデルとの対応＝素材の対称 D と平面の対称 G =================
   **素材の点 p が、検証ずみモデルでは D·p の点として動き、いまの平面では Gᵀ で写した所にいる**
   （いまの紙 ＝ Gᵀ ∘ モデル ∘ D。高さ z はそのまま）。
   ★G が鏡映でも物理的に正しい：3D の置かれ方 diag(Gᵀ,1)·(モデルの回転)·diag(D, det G·det D) は回転（det 1）。
     モデルは色を持たない剛体の折りなので、素材の表裏の対応（det G·det D）は自由に選べる。
   区間・光線の番号は D で写す：素材の光線 k → モデルの光線 modelOfRay[k]、素材の区間 s → モデルの区間 modelOfSector[s]。
   位置・高さ・層・折り角はぜんぶモデルの番号で読み、面・結び・原本（軸・基準面）はぜんぶ素材の番号で書く。
   ★branch（sign・0°→180°）はモデルの座標で書いた値。素材のおもてから見た折り角の向きは det(D) 倍になる
     （det −1 ＝山谷が逆に見えるが、3D の点の動きは検証ずみの運動そのもの）。 */
const DIHEDRAL = [[1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0],
                  [1, 0, 0, -1], [0, 1, 1, 0], [-1, 0, 0, 1], [0, -1, -1, 0]];
const lin = (A, p) => [A[0] * p[0] + A[1] * p[1], A[2] * p[0] + A[3] * p[1]];
function rayIndex(p) {
 const k = M().RAY.findIndex(r => Math.abs(r[0] - p[0]) < TOL && Math.abs(r[1] - p[1]) < TOL);
 if (k < 0) bad(`[${p}] がモデルの光線の端ではありません`);
 return k;
}
function makeFrame(D, G = [1, 0, 0, 1]) {
 const m = M(), modelOfRay = m.RAY.map(r => rayIndex(lin(D, r)));
 /* 素材の区間 s（光線 s と s+1 のあいだ）→ モデルで隣りあう2本のあいだの区間 */
 const modelOfSector = Array.from({ length: 8 }, (_, s) => {
  const a = modelOfRay[s], b = modelOfRay[(s + 1) % 8];
  return (b - a + 8) % 8 === 1 ? a : (a - b + 8) % 8 === 1 ? b : bad('対称 D で区間が隣りあいません');
 });
 const sectorOfModel = new Array(8);
 modelOfSector.forEach((i, s) => { sectorOfModel[i] = s });
 return { D: D.slice(), det: D[0] * D[3] - D[1] * D[2], G: G.slice(), Gt: [G[0], G[2], G[1], G[3]],
          modelOfRay, modelOfSector, sectorOfModel };
}
/* 素材の区間 s の頂点（素材の光線 k の端）が、モデルの panels のどの点か。 */
function modelVertex(fr, pl, s, k) {
 const i = fr.modelOfSector[s], mk = fr.modelOfRay[k];
 if (mk === i) return pl[i][1];
 if (mk === (i + 1) % 8) return pl[i][2];
 return bad(`光線 ${k} が区間 ${s} の端ではありません`);
}
/* G·(いまの紙) が「検証ずみの状態② ∘ D」でなければ理由 {kind:'pose'|'layer', msg} を返す（一致なら null）。 */
function poseMismatch(cache, rec, fr) {
 const m = M(), start = m.panels(0);
 /* ②-3 8区間の姿勢が、モデルの t=0（状態②）と**頂点ごとに**ぴたり同じ。
        ＝engine が出した xf で素材の頂点を写し G で読みかえた位置が、D で写した先のモデルの FK の位置と一致するか。
        （engine と モデルは別々に作られているので、ここが本当の突き合わせになる） */
 for (let s = 0; s < 8; s++) {
  const i = fr.modelOfSector[s], f = cache.faces.find(x => x.faceId === rec.owner[s]);
  if (Math.max(...start[i].map(v => Math.abs(v[2]))) > 1e-9) bad(`モデルの t=0 が平らではありません（検査の土台）`);
  for (const k of [s, (s + 1) % 8]) {
   const got = lin(fr.G, apply(f.xf, m.RAY[k])), want = modelVertex(fr, start, s, k);
   if (dist(got, want) > TOL || dist(lin(fr.G, apply(f.xf, [0, 0])), start[i][0]) > TOL)
    return { kind: 'pose', msg: `区間 P${i}（面 ${f.faceId}）の置かれ方が、検証ずみモデルの直前状態と違います` };
  }
 }
 /* ②-4 重なりの順（層）が、検証ずみの LAYER_START と同じ並び。 */
 const layerOf = new Map(cache.faces.map(f => [f.faceId, f.layer]));
 const own = i => rec.owner[fr.sectorOfModel[i]];
 for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
  if (own(i) === own(j)) continue;
  const a = layerOf.get(own(i)) - layerOf.get(own(j));
  const b = m.LAYER_START[i] - m.LAYER_START[j];
  if (Math.sign(a) !== Math.sign(b))
   return { kind: 'layer', msg: `直前状態の重なりが、検証ずみの層（LAYER_START）と違います（P${i} と P${j}）` };
 }
 return null;
}

/* ================= ②-L 袋折りのあとの紙（5枚以上）：検証ずみモデルを**局所的に**当てる（2026-09-15） =================
   ★再利用できる所（モデルの証明をそのまま使う）
     モデルで動くのは区間 P1・P2・P3 だけで、その運動は止まっている光線 R1（P0|P1）と R4（P3|P4）の置き場所で決まる
     （check_squash_motion.py：R1・R4 は τ の恒等式として動かない／動く面は R1・R4 と頂点 O を除いて z>0）。
     だから「N＝P1+P2 の面・W＝P3+P4 の面の姿と上下」がモデルの直前状態と同じなら、動く3区間の運動は
     Gᵀ ∘ 検証ずみの運動 ∘ D そのもの（動く面どうしの非貫通・共有境界もモデルの証明のまま）。
   ★新しく確かめる所（モデルの証明では言えない＝周囲の紙がモデルと違う）
     1回目の袋折りでできた紙は、モデルの止まる面（P0・P5〜P7）と姿も折り角も違う（根元の結びが平らに開いている等）。
     - 結び：動く区間と止まる区間をまたぐ結びは、止まる光線（R1・R4 の像）の上だけ（構造で決まる＝下の周囲①）
     - 出発：動く区間と面積で重なる止まった紙は、ぜんぶ下（動く面は z>0 へ上がる）
     - 途中：動く面が z=0 に触れるのは R1・R4 の像の上だけ ⇒ そこでの断面の一周の順（止まる紙：右＝下→上・左＝上→下、
       動く面は上半分）で弦が交差しないこと。動く面は (0,1) でずっと上半分にいる（モデルの証明）ので、順は途中で変わらない
     - 着地：層は「動く面は止まる面より上（z>0 から降りる）・動く面どうしはモデルの高さ・止まる面どうしは直前の順」
     - 結びの種類（折り目／背）は**確定形の両側の置かれ方**で決める（根元は「平ら→折れる」でモデルと逆向きになりうる）
   🚨4枚ちょうどの紙（状態②）はこれまでどおり全体照合（reconstruct / checkApplicable）＝理由も結果も変えない。 */
function reconstructLocal(cache, vertex) {
 const m = M();
 if (Math.hypot(vertex[0], vertex[1]) > TOL) bad(`この試作の頂点は原紙のまん中 [0,0] だけです（[${vertex}]）`);
 const owner = [];
 for (let s = 0; s < 8; s++) {
  const c = [(m.RAY[s][0] + m.RAY[(s + 1) % 8][0]) / 3, (m.RAY[s][1] + m.RAY[(s + 1) % 8][1]) / 3];
  const hit = cache.faces.filter(f => pointIn(f.poly.map(p => invPt(f.xf, p)), c));
  if (hit.length !== 1) bad(`区間 P${s} の持ち主の面が1枚に決まりません（${hit.length}枚）`);
  owner.push(hit[0].faceId);
 }
 for (const f of cache.faces) {
  const n = owner.filter(x => x === f.faceId).length, area = polyArea(f.poly.map(p => invPt(f.xf, p)));
  if (!n) bad(`面 ${f.faceId} が頂点のまわりにありません（頂点を持たない面がある紙の袋折りは未検証です）`);
  if (Math.abs(area - n * 0.5) > 1e-9) bad(`面 ${f.faceId} が区間の合併になっていません（区間の途中で割れた紙の袋折りは未検証です）`);
 }
 const bondAt = new Map();
 for (const bd of cache.bonds) {
  const at = bd.seg.filter(e => dist(e, vertex) < TOL);
  if (at.length !== 1) bad(`結び ${bd.faceIds.join(' | ')} が頂点を端に持ちません（頂点を通らない結びがある紙の袋折りは未検証です）`);
  const far = dist(bd.seg[0], vertex) < TOL ? bd.seg[1] : bd.seg[0];
  const k = m.RAY.findIndex(r => Math.abs(cross2(r, [far[0] - vertex[0], far[1] - vertex[1]])) < 1e-9 && r[0] * (far[0] - vertex[0]) + r[1] * (far[1] - vertex[1]) > 0);
  if (k < 0) bad(`結び ${bd.faceIds.join(' | ')} が光線の上にありません`);
  if (bondAt.has(k)) bad(`光線 ${k} に結びが2本あります`);
  if (bd.faceIds.slice().sort().join('|') !== [owner[(k + 7) % 8], owner[k]].sort().join('|'))
   bad(`結び ${bd.faceIds.join(' | ')} が、光線 ${k} の両側の面をつないでいません`);
  bondAt.set(k, C(bd));
 }
 const order = Array.from({ length: 8 }, (_, i) => ang(m.RAY[i]));
 return { order, raysDeg: order.map(a => Math.round(a * 180 / Math.PI * 1e6) / 1e6), owner, bondAt,
          rho0: null, closure: closureGap(m.rhoOf(0)), local: true };
}
/* 断面の一周の順（止まる光線 k の上）。stationary＝{faceId, poly, layer}（止まる紙）、mover＝{faceId, tri}（ここに付いた動く区間）、
   anchorBond＝動く区間と止まる相手をつなぐ結び（止まる側の faceId）。弦が交差したら理由を返す。 */
function ringAtAnchor(end, stationary, mover, chordsOnLine) {
 const len = Math.hypot(end[0], end[1]), u = [end[0] / len, end[1] / len], n = [-u[1], u[0]];
 const off = p => n[0] * p[0] + n[1] * p[1], along = p => u[0] * p[0] + u[1] * p[1];
 const ts = [0, len];
 for (const f of stationary.concat([{ poly: mover.tri }])) for (let i = 0; i < f.poly.length; i++) {
  const p = f.poly[i], q = f.poly[(i + 1) % f.poly.length], sp = off(p), sq = off(q);
  if (Math.abs(sp) <= 1e-9) ts.push(along(p));
  if ((sp > 1e-9 && sq < -1e-9) || (sp < -1e-9 && sq > 1e-9)) { const t = sp / (sp - sq); ts.push(along([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])) }
 }
 for (const c of chordsOnLine) for (const p of c.seg) ts.push(along(p));
 const cuts = [...new Set(ts.filter(t => t >= -1e-9 && t <= len + 1e-9).map(t => Math.round(t * 1e9) / 1e9))].sort((a, b) => a - b);
 for (let i = 0; i + 1 < cuts.length; i++) {
  if (cuts[i + 1] - cuts[i] < 1e-9) continue;
  const tm = (cuts[i] + cuts[i + 1]) / 2, x = [u[0] * tm, u[1] * tm], h = Math.min(1e-6, (cuts[i + 1] - cuts[i]) / 1e3);
  const R = [x[0] + n[0] * h, x[1] + n[1] * h], L = [x[0] - n[0] * h, x[1] - n[1] * h];
  const mvHere = pointIn(mover.tri, R) || pointIn(mover.tri, L);
  if (!mvHere) continue;/* 動く区間がこの区間の上に触れていない */
  const right = stationary.filter(f => pointIn(f.poly, R)).sort((a, b) => a.layer - b.layer).map(f => ({ id: f.faceId, side: 'R' }));
  const left = stationary.filter(f => pointIn(f.poly, L)).sort((a, b) => b.layer - a.layer).map(f => ({ id: f.faceId, side: 'L' }));
  const ring = [...right, { id: mover.faceId, side: 'M' }, ...left];
  const pos = (id, side) => ring.findIndex(r => r.id === id && (!side || r.side === side));
  const chords = [];
  for (const f of stationary) { const a = pos(f.faceId, 'R'), b = pos(f.faceId, 'L'); if (a >= 0 && b >= 0) chords.push([a, b]) }
  for (const c of chordsOnLine) {
   if (along(c.seg[0]) > tm + 1e-9 && along(c.seg[1]) > tm + 1e-9) continue;
   if (along(c.seg[0]) < tm - 1e-9 && along(c.seg[1]) < tm - 1e-9) continue;
   const a = c.faceIds[0] === mover.faceId ? pos(mover.faceId, 'M') : pos(c.faceIds[0]);
   const b = c.faceIds[1] === mover.faceId ? pos(mover.faceId, 'M') : pos(c.faceIds[1]);
   if (a >= 0 && b >= 0 && a !== b) chords.push([Math.min(a, b), Math.max(a, b)]);
  }
  for (const [a, b] of chords) for (const [c, d] of chords)
   if (a < c && c < b && b < d) return `途中で紙を突き抜けます（止まる光線の上の一周の順：${ring.map(r => r.id + ':' + r.side).join(' → ')}）`;
 }
 return null;
}
function checkApplicableLocal(cache, rec, vertex) {
 const m = M(), start = m.panels(0), found = [];
 let why = null;
 const note = (rank, msg) => { if (!why || rank > why.rank) why = { rank, msg } };
 const face = id => cache.faces.find(f => f.faceId === id);
 const count = id => rec.owner.filter(x => x === id).length;
 const triOf = (f, s) => [[0, 0], m.RAY[s], m.RAY[(s + 1) % 8]].map(p => apply(f.xf, p));
 for (const D of DIHEDRAL) for (const G of DIHEDRAL) {
  const fr = makeFrame(D, G), S = i => fr.sectorOfModel[i], F = i => rec.owner[S(i)];
  const matRay = mk => fr.modelOfRay.indexOf(mk);
  /* 形：N（モデルの P1+P2）と W（P3+P4）がそれぞれちょうど2区間の面／根元（R1）と背（R3）に結び・N と W の中の線（R2・R4）に結びが無い */
  if (F(1) !== F(2) || F(3) !== F(4) || F(1) === F(3) || count(F(1)) !== 2 || count(F(3)) !== 2) { note(0, '袋（2区間ずつの2枚が背でつながった形）が見つかりません'); continue }
  if (!rec.bondAt.has(matRay(1)) || !rec.bondAt.has(matRay(3))) { note(1, '袋の根元か背に結びがありません'); continue }
  /* 姿：N と W の4区間が、モデルの直前状態と頂点ごとに同じ（G で読みかえ・高さはそのまま） */
  let pose = true;
  for (const i of [1, 2, 3, 4]) {
   const s = S(i), f = face(F(i));
   for (const k of [s, (s + 1) % 8]) {
    if (dist(lin(fr.G, apply(f.xf, m.RAY[k])), modelVertex(fr, start, s, k)) > TOL || dist(lin(fr.G, apply(f.xf, [0, 0])), start[i][0]) > TOL) pose = false;
   }
  }
  if (!pose) { note(2, '袋の置かれ方が、検証ずみモデルの直前状態と違います'); continue }
  /* 上下（N が W より上＝LAYER_START の 3>2）は門を置かない：下の「出発」が N の区間と W の止まる半分（P4）の重なりで必ず見る
     （モデルの姿では P1 と P4 が面積で重なる）＝同じ条件を2か所で断らない。 */
  const movingSec = new Set([S(1), S(2), S(3)]), stay = S(4), anchors = [matRay(1), matRay(4)];
  /* 周囲①結び：動く区間と止まる区間をまたぐ結びは、止まる光線（R1・R4 の像）の上だけ。
     ⚠門は置かない＝構造で必ず成り立つ：動く3区間は隣りあって並び、その両端の境目がちょうど R1・R4 の像。
       結びはぜんぶ頂点から光線に沿う（reconstructLocal が確かめる）ので、またぐ結びはこの2本の上にしか来られない。
       （検査 test_squash_twice.js が、途中のコマで結びの両側が離れないことを別の手で見る） */
  /* 周囲②出発：動く区間と面積で重なる止まった紙は、ぜんぶ下 */
  const stationary = [];
  for (const f of cache.faces) {
   if (f.faceId === F(1)) continue;
   stationary.push(f.faceId === F(3) ? { faceId: f.faceId, poly: triOf(f, stay), layer: f.layer } : { faceId: f.faceId, poly: f.poly, layer: f.layer });
  }
  let over = null;
  for (const s of movingSec) { const f = face(rec.owner[s]), tri = triOf(f, s);
   for (const g of stationary) if (E().overlapsArea(tri, g.poly) && !(f.layer > g.layer)) over = [f.faceId, g.faceId];
  }
  if (over) { note(5, `袋の上に止まった紙が乗っています（${over[1]} が ${over[0]} の上）＝開くと突き抜けます`); continue }
  /* 周囲③途中：止まる光線 R1・R4 の像の上で、断面の一周の順の弦が交差しない */
  let ring = null;
  for (const [mi, movingS] of [[1, S(1)], [4, S(3)]]) {
   const k = matRay(mi), f = face(rec.owner[movingS]), endPt = apply(f.xf, m.RAY[k]);
   const chords = [];
   for (const bd of cache.bonds) { const host = face(bd.faceIds[0]), seg = bd.seg.map(p => apply(host.xf, p));
    if (Math.abs(cross2(endPt, seg[0])) > 1e-9 || Math.abs(cross2(endPt, seg[1])) > 1e-9) continue;
    chords.push({ faceIds: bd.faceIds.map(id => id === F(1) ? F(1) : id), seg }) }
   /* R4 の像は W の中の線＝割ってできる結び（動く P3 と止まる P4）を弦に足す */
   if (mi === 4) chords.push({ faceIds: [F(3) + '#moving', F(3)], seg: [[0, 0], endPt] });
   const mover = { faceId: mi === 4 ? F(3) + '#moving' : F(1), tri: triOf(f, movingS) };
   const r = ringAtAnchor(endPt, stationary, mover, chords);
   if (r) { ring = r; break }
  }
  if (ring) { note(6, ring); continue }
  fr.follow = [S(1), S(2), S(3), S(4)];
  fr.anchors = anchors;
  found.push(fr);
 }
 if (!found.length) bad(`${why.msg}（素材の対称 D × 平面の対称 G の64通り）`);
 if (found.length > 1) bad(`袋が1つに決まりません（${found.length}通り）`);
 return found[0];
}

/* ================= ③ 軸・基準面・枝が、再構成した光線と合っているか ================= */
/* 折り線 i の役割＝検証ずみモデルの ρ の振るまい（動かない：0→flat／π→folded、動く：駆動1本→drive／ほか→link）。
   原本の照合（bindAxes）と候補づくり（candidateStep）は、この1つの規則だけを使う。 */
const DRIVE_RAY = 2, BASE_SECTOR = 0;
function roleOf(i) {
 const m = M(), r0 = m.rhoOf(0), r1 = m.rhoOf(1);
 const moves = Math.abs(r0[i] - r1[i]) > 1e-9;
 return !moves ? (Math.abs(r0[i]) < 1e-9 ? 'flat' : 'folded') : (i === DRIVE_RAY ? 'drive' : 'link');
}
function bindAxes(step, rec, fr) {
 const m = M();
 const roleAt = new Array(8).fill(null);
 for (const ax of step.axes) {
  const d = unit([ax.end[0] - ax.vertex[0], ax.end[1] - ax.vertex[1]]);
  const i = rec.order.findIndex(o => Math.abs(((o - ang(d) + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 1e-6);
  if (i < 0) bad(`軸 [${ax.vertex}]→[${ax.end}] が、いまの紙の折り線の上にありません`);
  if (roleAt[i] !== null) bad(`同じ折り線に2つの役割が書かれています`);
  roleAt[i] = ax.role;
  /* end は素材の紙のふちまで届いていること＝軸を「向きだけ」で書かせない。 */
  const far = [m.RAY[i][0], m.RAY[i][1]];
  if (dist(ax.end, far) > TOL) bad(`軸 ${ax.role} の end が素材のふち [${far}] ではありません（[${ax.end}]）`);
 }
 /* 役割は、検証ずみモデルの ρ の振るまいと一つずつ突き合わせる（R番号を保存の識別子にしない）。 */
 const r0 = m.rhoOf(0), half = m.rhoOf(0.5);
 for (let i = 0; i < 8; i++) {
  const want = roleOf(fr.modelOfRay[i]);
  if (roleAt[i] !== want)
   bad(`折り線 ${i} の役割が合いません（原本は ${roleAt[i]}／モデルでは ${want}）`);
 }
 /* 基準面＝モデルが z=0 に置く面（モデルの区間 P0 が来る、素材の区間の面）。 */
 if (step.base.faceId !== rec.owner[fr.sectorOfModel[BASE_SECTOR]])
  bad(`基準面が違います（原本 ${step.base.faceId}／モデルの基準面 ${rec.owner[fr.sectorOfModel[BASE_SECTOR]]}）`);
 /* 半分まで来たとき、駆動の軸が本当に動いているか＝「枝」が止まっていないことの最低限の確認。 */
 if (Math.abs(half[DRIVE_RAY] - r0[DRIVE_RAY]) < 1e-9) bad('駆動の軸が動いていません（枝の取り違え）');
 return roleAt;
}

/* ================= ④ 面の分割・faceId・layerPath（決定論） ================= */
/* 🚨子の呼び名は**既存と同じ keep / cut**。v1 の `layerPath.side` は
   `origami_recipe.schema.json` の enum ['keep','cut'] なので、ここで新しい呼び名を作って既存へ渡さない。
   向きの決めかたは engine の `split` そのもの＝軸を**原本に書いた vertex → end** の向きに取り、
   **S>=0 の側が keep・反対が cut**（engine の split も `u>=-E` を keep にしている）。
   割るのも engine に任せ、出てきた2枚と区間の素材三角形が一致することまで見る。 */
function splitFaces(cache, step, rec, roleAt) {
 const m = M();
 const sectorsOf = new Map();
 rec.owner.forEach((fid, i) => { if (!sectorsOf.has(fid)) sectorsOf.set(fid, []); sectorsOf.get(fid).push(i) });
 for (const [fid, ss] of sectorsOf) if (ss.length !== 2 && !(rec.local && ss.length === 1)) bad(`面 ${fid} が2区間になっていません（${ss.length}区間）`);
 const faces = [], sectorFace = new Array(8).fill(null), splits = [];
 for (const f of cache.faces) {
  const ss = sectorsOf.get(f.faceId);
  /* 内側の折り線＝その面の2区間のあいだの1本。動く（drive/link）なら割れる。1区間の面（局所）は割れない。 */
  const inner = ss.length === 1 ? null : ss.includes(7) && ss.includes(0) ? 0 : Math.max(...ss);
  const role = inner === null ? 'flat' : roleAt[inner];
  if (role === 'flat' || role === 'folded' || (rec.local && !ss.every(x => rec.follow.includes(x)))) {
   faces.push({ faceId: f.faceId, layerPath: C(f.layerPath), sectors: ss.slice().sort((a, b) => a - b),
                parent: f.faceId, split: false, side: null });
   for (const s of ss) sectorFace[s] = f.faceId;
   continue;
  }
  const A = [step.vertex[0], step.vertex[1]], B = [m.RAY[inner][0], m.RAY[inner][1]];
  const src = f.poly.map(p => invPt(f.xf, p));
  const parts = E().split(src, A, B);
  if (!parts[0] || !parts[1]) bad(`面 ${f.faceId} が軸 [${A}]→[${B}] で二つに分かれません`);
  const kids = [];
  for (const sec of ss) {
   const mid = [(m.RAY[sec][0] + m.RAY[(sec + 1) % 8][0]) / 2, (m.RAY[sec][1] + m.RAY[(sec + 1) % 8][1]) / 2];
   const probe = [(A[0] + mid[0]) / 2, (A[1] + mid[1]) / 2];
   const side = E().side(probe, A, B) >= 0 ? 'keep' : 'cut';
   /* engine が割った2枚と突き合わせる＝呼び名だけ合わせて中身がずれる、を起こさない。 */
   if (keySet(m.MATERIAL[sec]) !== keySet(side === 'keep' ? parts[0] : parts[1]))
    bad(`区間 P${sec} が、engine が割った ${side} の側と一致しません`);
   const faceId = `${f.faceId}/${step.id}.${side}`;
   kids.push({ faceId, layerPath: C(f.layerPath).concat([{ stepId: step.id, side }]),
               sectors: [sec], parent: f.faceId, split: true, side });
   sectorFace[sec] = faceId;
  }
  if (kids[0].side === kids[1].side) bad(`面 ${f.faceId} の子が両方とも ${kids[0].side} になりました`);
  splits.push({ parent: f.faceId, axis: { vertex: C(A), end: C(B) },
                keep: kids.find(k => k.side === 'keep').faceId,
                cut: kids.find(k => k.side === 'cut').faceId,
                keepSector: kids.find(k => k.side === 'keep').sectors[0],
                cutSector: kids.find(k => k.side === 'cut').sectors[0] });
  faces.push(...kids);
 }
 if (sectorFace.some(v => v === null)) bad('区間の持ち主が決まらない所が残りました');
 return { faces, sectorFace, splits };
}
/* ================= ④-2 結びの継承（由来と素材の共有区間を落とさない） =================
   🚨**名前だけ合わせない。** もとからある結びは **bondId・stepId・seg（素材の共有区間）をそのまま**持ち越し、
   `faceIds` だけを子へ付けかえる。割ってできた軸にだけ、新しい結びを1本ずつ足す。
   ★kind は**終端の折り角**で決める（手で書かない）：
     ρ(1)=0   ＝ その結びは**開いて平らになった** → `crease`（紙は切れていないし曲がってもいない）
     |ρ(1)|=π ＝ 折れたまま                        → `hinge`（＝背）
   これは後続の読み取りに直に効く：`sheetIds` は **crease だけ**で紙片を閉じ、
   `hingeIntervals` は **hinge だけ**を背として返す。だから開いた所を hinge のままにすると、
   ひと続きの平らな紙が別々の紙片に見え、ありもしない背が吸い付き先に出る。 */
function bondsOf(cache, step, rec, roleAt, sectorFace, fr, placed) {
 const m = M(), rEnd = m.rhoOf(1);
 const xfOf = id => { const f = (placed || []).find(v => v.faceId === id); return f && f.xf };
 let bn = 0;
 for (const b of cache.bonds) { const v = /^b(\d+)$/.exec(String(b.bondId)); if (v) bn = Math.max(bn, +v[1]) }
 const out = [];
 for (let i = 0; i < 8; i++) {
  const prev = rec.bondAt.get(i) || null;
  const isNew = roleAt[i] === 'drive' || roleAt[i] === 'link';
  if (!prev && !isNew) continue;
  /* 区間 i は光線 i の左（S>0）、区間 i-1 は右。keep/cut の決めかたは splitFaces と同じ1つの規則。 */
  const cut = sectorFace[(i + 7) % 8], keep = sectorFace[i];
  if (cut === keep) bad(`折り線 ${i} の両側が同じ面です（割れていない）`);
  let kind;
  if (rec.local) {
   /* 局所：確定形で両側が同じ置かれ方＝平ら（crease）／光線で鏡に映した置かれ方＝折れている（hinge）。どちらでもなければ裂けている。 */
   const a = xfOf(keep), b = xfOf(cut), same = a && b && a.every((v, j) => Math.abs(v - b[j]) < 1e-9);
   const dir = unit(m.RAY[i]), R = [2 * dir[0] * dir[0] - 1, 2 * dir[0] * dir[1], 2 * dir[0] * dir[1], 2 * dir[1] * dir[1] - 1];
   /* 素材の点 p を光線 i で鏡に映してから cut の置かれ方で写す＝cut∘R（線形部分は右から R を掛ける） */
   const refl = a && b && [b[0] * R[0] + b[1] * R[2], b[0] * R[1] + b[1] * R[3], b[2] * R[0] + b[3] * R[2], b[2] * R[1] + b[3] * R[3]];
   const folded = a && b && [0, 1, 2, 3].every(j => Math.abs(a[j] - refl[j]) < 1e-9) && Math.abs(a[4] - b[4]) < 1e-9 && Math.abs(a[5] - b[5]) < 1e-9;
   kind = same ? 'crease' : folded ? 'hinge' : bad(`折り線 ${i} の両側が、確定形で平らにも折れた形にもなっていません（裂けています）`);
  } else {
   const r = Math.abs(rEnd[fr.modelOfRay[i]]);
   kind = r <= 1e-9 ? 'crease' : Math.abs(r - Math.PI) <= 1e-9 ? 'hinge'
    : bad(`折り線 ${i} の終端の折り角が 0 でも 180° でもありません（${(r * 180 / Math.PI).toFixed(3)}°）`);
  }
  const bond = { bondId: prev ? prev.bondId : `b${++bn}`, faceIds: [keep, cut].slice().sort(),
                 stepId: prev ? prev.stepId : step.id, kind,
                 seg: prev ? C(prev.seg) : [C(step.vertex), [m.RAY[i][0], m.RAY[i][1]]],
                 origin: prev ? 'inherited' : 'split', keepFace: keep, cutFace: cut };
  if (prev && prev.kind === 'hinge' && kind === 'crease') bond.openedBy = step.id;/* 折れていた背が、この手で開いて平らになった */
  if (prev && prev.kind === 'crease' && kind === 'hinge') bond.closedBy = step.id;/* 平らだった折り目が、この手で折れて背になった（局所） */
  out.push(bond);
 }
 const want = rec.local ? rec.bondAt.size + roleAt.filter((r, i) => (r === 'drive' || r === 'link') && !rec.bondAt.has(i)).length : 6;
 if (out.length !== want) bad(`結びが${want}本になりません（${out.length}本）`);
 return out;
}

/* ================= ⑤ 最終形の置かれ方（xf）と、全重なり領域からの層順 ================= */
function placeFaces(faces, sectorFace, fr, cache, rec) {
 const m = M(), end = m.panels(1);
 if (Math.max(...end.flat().map(v => Math.abs(v[2]))) > 1e-9) bad('モデルの t=1 が平らではありません（検査の土台）');
 for (const f of faces) {
  if (rec && rec.local && !f.sectors.every(x => rec.follow.includes(x))) {
   const was = cache.faces.find(v => v.faceId === f.parent);
   f.xf = was.xf.slice(); f.poly = was.poly.map(p => p.slice());
   continue;
  }
  /* 区間の素材三角形 → 最終形の三角形 へ写す2×3。頂点 O は動かないので平行移動は0。 */
  let xf = null;
  for (const s of f.sectors) {
   /* 素材の区間 s の2頂点を、D で写した先のモデルの最終形の点を Gᵀ でいまの平面へ戻した所へ（頂点 O は動かない）。 */
   const A = m.RAY[s], B = m.RAY[(s + 1) % 8];
   const P = lin(fr.Gt, modelVertex(fr, end, s, s)), Q = lin(fr.Gt, modelVertex(fr, end, s, (s + 1) % 8));
   const det = A[0] * B[1] - A[1] * B[0];
   if (Math.abs(det) < 1e-12) bad(`区間 P${s} の素材の2辺が平行です`);
   const a = (P[0] * B[1] - Q[0] * A[1]) / det, b = (Q[0] * A[0] - P[0] * B[0]) / det;
   const c = (P[1] * B[1] - Q[1] * A[1]) / det, d = (Q[1] * A[0] - P[1] * B[0]) / det;
   const got = [a, b, c, d, 0, 0];
   if (xf && got.some((v, i) => Math.abs(v - xf[i]) > 1e-9))
    bad(`面 ${f.faceId} の2区間が1枚の剛体になっていません（折れていない所で曲がっている）`);
   xf = got;
   /* 写した形がモデルの三角形と一致するか（xf の解き方そのものの見張り）。 */
   const chk = m.MATERIAL[s].map(p => apply(got, p));
   if (keySet(chk) !== keySet(end[fr.modelOfSector[s]].map(v => lin(fr.Gt, v))))
    bad(`区間 P${s} を写した形が、モデルの最終形と一致しません`);
  }
  f.xf = xf;
  f.poly = hull(f.sectors.flatMap(s => m.MATERIAL[s].map(p => apply(xf, p))));
  const area = polyArea(f.poly), want = f.sectors.reduce((s, i) => s + polyArea(m.MATERIAL[i]), 0);
  if (Math.abs(area - want) > 1e-9) bad(`面 ${f.faceId} の最終形が凸になりません（合併の扱いを見直すこと）`);
 }
 return faces;
}

/* 最終形で q に来ている**素材上の点**を、t=1-ε の姿勢で見たときの高さ（基準面の法線＝z）。
   ⚠法線を通すだけの比較にしない＝終端手前で面が動いていても、どの面も必ず値を持つ。 */
function heightAt(q, sector, eps) {
 const m = M(), end = m.panels(1), now = m.panels(1 - eps);
 const w = bary(end[sector].map(v => [v[0], v[1]]), q);
 return w[0] * now[sector][0][2] + w[1] * now[sector][1][2] + w[2] * now[sector][2][2];
}
/* 面のうち q（**モデルの平面の点**＝G で読みかえた点）を含む区間を、**モデルの区間番号**で返す（高さはモデルの panels で読む）。 */
function sectorFor(face, q, fr) {
 const m = M(), end = m.panels(1);
 for (const s of face.sectors) { const i = fr.modelOfSector[s];
  if (pointIn(end[i].map(v => [v[0], v[1]]), q, -1e-9)) return i }
 return null;
}
/* 同着の扱い：継承は**固定面どうしだけ**（直前状態の層を継ぐ）。動く面が同着なら拒否。 */
function orderFaces(zs, movingIds, inherit) {
 const sorted = zs.slice().sort((a, b) => a.z - b.z), groups = [];
 for (const it of sorted) {
  if (groups.length && Math.abs(it.z - groups[groups.length - 1][0].z) <= TIE) groups[groups.length - 1].push(it);
  else groups.push([it]);
 }
 const out = [];
 for (const g of groups) {
  if (g.length > 1 && g.some(it => movingIds.has(it.faceId)))
   bad(`重なりの上下が決まりません（動く面が同着：${g.map(it => it.faceId).sort().join(',')}）`);
  out.push(...g.slice().sort((a, b) => inherit.get(a.faceId) - inherit.get(b.faceId)).map(it => it.faceId));
 }
 return out;
}

function layersOf(faces, cache, rec, fr) {
 const m = M();
 const polys = {}; faces.forEach(f => { polys[f.faceId] = f.poly });
 const cells = allRegions(polys);
 const total = cells.reduce((s, c) => s + c.area * c.faces.length, 0);
 if (Math.abs(total - 4) > 1e-9) bad(`列挙した領域で紙の面積を使い切っていません（Σ面積×枚数 = ${total.toFixed(12)}）`);
 /* 動く区間＝モデルで t=0 と t=1 の置かれ方が違うもの。面の名前ではなく幾何で決める。 */
 const start = m.panels(0), end = m.panels(1);
 const movingIds = new Set();
 for (const f of faces) for (const s of f.sectors)
  if ((!rec.local || rec.follow.includes(s)) && keySet(start[fr.modelOfSector[s]].map(v => [v[0], v[1]])) !== keySet(end[fr.modelOfSector[s]].map(v => [v[0], v[1]]))) movingIds.add(f.faceId);
 const layerOf = new Map(cache.faces.map(f => [f.faceId, f.layer]));
 const inherit = new Map(faces.map(f => [f.faceId, layerOf.get(f.parent)]));
 const byId = new Map(faces.map(f => [f.faceId, f]));
 const regions = [];
 for (const cell of cells.filter(c => c.faces.length >= 2).sort((a, b) => a.faces.join().localeCompare(b.faces.join()))) {
  const verts = intersect(cell.faces.map(i => polys[i]));
  const probe = [verts.reduce((s, v) => s + v[0], 0) / verts.length, verts.reduce((s, v) => s + v[1], 0) / verts.length];
  const qm = lin(fr.G, probe);/* 高さはモデルの平面で読む（z はそのまま） */
  let order = null;
  for (const eps of [1e-2, 1e-3, 1e-4, 1e-5, EPS]) {
   const zs = cell.faces.slice().sort().map(id => {
    const fc = byId.get(id);
    if (rec.local && !fc.sectors.every(x => rec.follow.includes(x))) return { faceId: id, z: 0 };
    const s = sectorFor(fc, qm, fr);
    if (s === null) bad(`領域の比較点が面 ${id} の外に出ました`);
    return { faceId: id, z: heightAt(qm, s, eps) };
   });
   const o = orderFaces(zs, movingIds, inherit);
   if (order && JSON.stringify(o) !== JSON.stringify(order))
    bad(`ε を縮めると重なりの上下が変わります（領域 ${cell.faces.join(',')}）`);
   order = o;
  }
  regions.push({ faces: cell.faces.slice().sort(), area: cell.area, order });
 }
 /* 領域ごとの上下 → 面ごとに1つの layer 値（下から数えた最長の鎖）。循環があればここで止まる。 */
 const below = new Map(faces.map(f => [f.faceId, new Set()]));
 for (const r of regions) for (let i = 1; i < r.order.length; i++) below.get(r.order[i]).add(r.order[i - 1]);
 const layer = new Map(); let left = faces.map(f => f.faceId);
 while (left.length) {
  const ready = left.filter(id => [...below.get(id)].every(x => layer.has(x)));
  if (!ready.length) bad(`重なりの上下に循環があります（${left.sort().join(',')}）`);
  for (const id of ready) layer.set(id, [...below.get(id)].reduce((s, x) => Math.max(s, layer.get(x) + 1), 0));
  left = left.filter(id => !layer.has(id));
 }
 for (const f of faces) f.layer = layer.get(f.faceId);
 return { regions, movingIds: [...movingIds].sort() };
}

/* ================= ⑥ 再生（入力も状態も書きかえない） =================
   🚪 **内部経路** `replayWith(recipe, v1Replay)`＝engine の共通入口だけが呼ぶ。
      v2 の中の通常の手は、引数の `v1Replay`（engine の内部の再生器）に渡す。**engine.replay は呼ばない**（循環させない）。
   🚪 **外部入力の入口** `replay(input)`＝engine の共通入口（FreeFoldEngine.replayDetail）を通して、袋折りの結果を返す。 */
function replayWith(input, v1Replay) {
 if (typeof v1Replay !== 'function') bad('v2 の中の通常の手を再生する器（engine の内部経路）が渡されていません');
 const recipe = C(input);
 validate(recipe);
 if (!recipe.steps.some(s => SPECIAL.includes(s.op))) {
  /* 袋折り・花弁折りを巻き戻した v2（特別な手が0手）＝通常の手だけ。version は原本のまま（写しを v1 の器へ渡すだけ）。 */
  let cache;
  try { cache = v1Replay({ ...recipe, version: 1 }) }
  catch (e) { bad(`袋折りを巻き戻した原本の手（v1）で止まりました：${e.message}`) }
  return { cache, squash: null };
 }
 const ks = recipe.steps.map((s, i) => SPECIAL.includes(s.op) ? i : -1).filter(i => i >= 0);
 let cache;
 try { cache = v1Replay({ ...recipe, version: 1, steps: recipe.steps.slice(0, ks[0]) }) }
 catch (e) { bad(`袋折り・花弁折りの前の手（v1）で止まりました：${e.message}`) }
 const outs = [], petals = [];
 ks.forEach((k, j) => {
  const until = j + 1 < ks.length ? ks[j + 1] : recipe.steps.length;
  if (recipe.steps[k].op === 'petal') {
   /* 🌸 花弁折り：いまの紙（互換 cache）から PetalV2 が認識・照合・再生し、続きの手は同じ内部の再生器へ渡す。 */
   if (!Petal() || typeof Petal().applyStep !== 'function') bad(`${k + 1}手目の花弁折りを読む再生器（petal_v2.js）が読みこまれていません`);
   const r = Petal().applyStep(recipe.steps[k], cache);
   petals.push(r.detail);
   cache = continueFrom(recipe, r.cache, v1Replay, k, until, '花弁折り');
   return;
  }
  const out = squashOn(recipe, k, cache);
  outs.push(out);
  cache = replayAfter(recipe, out, v1Replay, k, until);
 });
 return { cache, squash: outs.length ? outs[outs.length - 1] : null, squashes: outs, petals };
}
function replay(input) {
 /* version 2 以外は engine へ渡さず、v2 の検査の理由で断る（validate は version≠2 を必ず断る）。 */
 if (!input || typeof input !== 'object' || input.version !== 2) { validate(input); bad('version が 2 ではありません') }
 const r = E().replayDetail(input);
 if (!r.squash) bad('squash の手がありません（この関数は袋折りの結果を返します。巻き戻した v2 は FreeFoldEngine.replay で読めます）');
 return r.squash;
}
/* いまの紙の袋を読む：4枚ちょうど＝状態②の全体照合（これまでどおり）／5枚以上＝袋折りのあとの局所照合（②-L）。 */
function readPocket(cache, vertex) {
 if (cache.faces.length > 4) {
  const rec = reconstructLocal(cache, vertex), fr = checkApplicableLocal(cache, rec, vertex);
  rec.follow = fr.follow;
  return { rec, fr };
 }
 const rec = reconstruct(cache, vertex);
 return { rec, fr: checkApplicable(cache, rec, vertex) };
}
function squashOn(recipe, k, cache) {
 const step = recipe.steps[k];
 if (cache.faces.length > MAX_FACES) bad(`面が${MAX_FACES}枚を超えます`);
 const { rec, fr } = readPocket(cache, step.vertex);
 const roleAt = bindAxes(step, rec, fr);
 const { faces, sectorFace, splits } = splitFaces(cache, step, rec, roleAt);
 if (rec.local) placeFaces(faces, sectorFace, fr, cache, rec);
 const bonds = bondsOf(cache, step, rec, roleAt, sectorFace, fr, faces);
 for (const sp of splits) {
  const b = bonds.find(v => v.origin === 'split' && v.keepFace === sp.keep && v.cutFace === sp.cut);
  if (!b) bad(`面 ${sp.parent} を割った軸の結びが、keep/cut と食い違います`);
 }
 if (!rec.local) placeFaces(faces, sectorFace, fr, cache, rec);
 const { regions, movingIds } = layersOf(faces, cache, rec, fr);
 /* stack は**検算値**。engine が全重なり領域から出した答えと突き合わせる（人が書いた点は使わない）。 */
 const got = new Map(regions.map(r => [r.faces.join('|'), r.order.join('>')]));
 const want = new Map(step.stack.map(r => [r.slice().sort().join('|'), r.join('>')]));
 for (const [k, v] of want) {
  if (!got.has(k)) bad(`stack に、重なっていない面の組が書かれています（${k.split('|').join(' と ')}）`);
  if (got.get(k) !== v) bad(`stack の上下が再生結果と違います（${k}：原本 ${v}／再生 ${got.get(k)}）`);
 }
 for (const [k, v] of got) if (!want.has(k)) bad(`stack に、重なっている領域が書かれていません（${k}：下から ${v}）`);
 /* 折り図の層（検証ずみ LAYER_END）と矛盾しないことも見る（値の一致ではなく、上下の矛盾が無いこと）。 */
 const m = M(), diagram = new Map();
 /* 局所：折り図の層（LAYER_END）と比べてよいのは、モデルの区間として置いた面（N・W の子）どうしだけ。 */
 for (const f of faces.filter(f => !rec.local || f.sectors.every(x => rec.follow.includes(x)))) for (const s of f.sectors) {
  const L = m.LAYER_END[fr.modelOfSector[s]];
  if (diagram.has(f.faceId) && diagram.get(f.faceId) !== L)
   bad(`面 ${f.faceId} の折り図の層が区間で食い違います`);
  diagram.set(f.faceId, L);
 }
 for (const r of regions) for (let i = 1; i < r.order.length; i++)
  if (diagram.has(r.order[i - 1]) && diagram.has(r.order[i]) && diagram.get(r.order[i - 1]) >= diagram.get(r.order[i]))
   bad(`折り図の層が、列挙した領域の上下と矛盾します（${r.order[i - 1]} / ${r.order[i]}）`);
 const out = {
  model: MODEL, stepId: step.id,
  faces: faces.map(f => ({ faceId: f.faceId, layerPath: f.layerPath, sectors: f.sectors,
    poly: f.poly.map(p => p.slice()), xf: f.xf.slice(), layer: f.layer,
    diagramLayer: diagram.get(f.faceId), moving: movingIds.includes(f.faceId) })),
  bonds, regions, splits, recipe: C(recipe),
  before: { faces: C(cache.faces), bonds: C(cache.bonds),
            hinges: C(cache.hinges || []), creases: C(cache.creases || []) },
  branch: { linkage: LINKAGE, sign: 1, driveDeg: [0, 180] },
  closure: rec.closure, sectorFace,
  frame: { D: fr.D.slice(), det: fr.det, G: fr.G.slice(), Gt: fr.Gt.slice(), modelOfSector: fr.modelOfSector.slice(), modelOfRay: fr.modelOfRay.slice(),
           ...(rec.local ? { follow: fr.follow.slice(), anchors: fr.anchors.slice() } : {}) },
  note: '⛔非貫通は未検証。厚みは0。閉路が閉じることだけで「物理的に折れる」とは言わない。',
 };
 out.hash = digest(out);
 return out;
}
/* 🧺 袋折りのあとの手（2026-09-14）。袋折りの再生結果（互換 cache）を始まりの紙にして、
   **engine の内部の再生器（引数の v1Replay）へ続きの手をそのまま渡す**＝割る・運ぶ・積み直す・結び・折り目・裂けの見張り・
   上に乗っている紙の判定は、平らな紙から折るときと同じ1本の規則。ここでは幾何を作り直さない。
   🚨袋折りの結果（out）は書きかえない＝袋折りの手の検算（stack・領域・動く面）は袋折りの時点のもの。 */
function replayAfter(recipe, out, v1Replay, k, until) {
 return continueFrom(recipe, toCache(out).cache, v1Replay, k, until, '袋折り');
}
/* 特別な手（袋折り・花弁折り）の結果の cache から、次の特別な手の前までの v1 の手を、同じ内部の再生器で続ける。 */
function continueFrom(recipe, cache, v1Replay, k, until, what) {
 const rest = recipe.steps.slice(k + 1, until);
 if (!rest.length) return cache;
 try { return v1Replay({ ...recipe, version: 1, steps: rest }, cache) }
 catch (e) { bad(`${what}のあとの手（v1）で止まりました：${e.message}`) }
}
/* ================= ⑥-2 袋折りの候補の手を、いまの cache から組む =================
   🚨受理と同じ門を通す：再構成 → 適用条件（検証ずみのつる③か）。通らなければ理由をつけて断る。
   軸の役割は roleOf、基準面は BASE_SECTOR、stack は全重なり領域から出した上下＝**原本の照合と同じ規則**だけで組む。
   組んだ手は engine が共通入口で先頭から再生して、もう一度ぜんぶの門（stack の突き合わせを含む）を通す。 */
function candidateStep(cache, stepId, diagramStep) {
 const m = M(), vertex = [0, 0];/* この試作の頂点は原紙のまん中だけ（checkApplicable も同じことを見る） */
 const { rec, fr } = readPocket(cache, vertex);
 const step = { id: stepId, diagramStep, op: 'squash', model: MODEL, vertex: C(vertex),
  base: { faceId: rec.owner[fr.sectorOfModel[BASE_SECTOR]] },
  axes: Array.from({ length: 8 }, (_, i) => ({ vertex: C(vertex), end: [m.RAY[i][0], m.RAY[i][1]], role: roleOf(fr.modelOfRay[i]) })),
  branch: { linkage: LINKAGE, sign: 1, drive: { fromDeg: 0, toDeg: 180 } },
  stack: [], instruction: 'ふくろを ひらいて つぶす' };
 const roleAt = bindAxes(step, rec, fr);
 const { faces, sectorFace } = splitFaces(cache, step, rec, roleAt);
 placeFaces(faces, sectorFace, fr, cache, rec);
 step.stack = layersOf(faces, cache, rec, fr).regions.map(r => r.order.slice());
 return step;
}
function digest(out) {
 return JSON.stringify({
  faces: out.faces.map(f => ({ id: f.faceId, path: f.layerPath, sec: f.sectors,
   poly: f.poly.map(p => rd(p, 9)), xf: f.xf.map(v => Math.round(v * 1e9) / 1e9 + 0), layer: f.layer })),
  bonds: out.bonds.map(b => ({ f: b.faceIds, k: b.kind, seg: b.seg.map(p => rd(p, 9)), o: b.origin })),
  regions: out.regions.map(r => ({ f: r.faces, o: r.order, a: Math.round(r.area * 1e9) / 1e9 + 0 })),
 });
}

/* ================= ⑧ 互換 cache への変換（**読み取り専用**） =================
   既存の読み取りAPI（`sheetOf`/`sheetIds`・`rimEdges`・`creaseIntervals`・`hingeIntervals`・
   `stackAt`・`hitFaces`・`topFaces`・`layersAt`）と `freefold_snap.js` の `guidesOf` が
   そのまま動く形に直す。返すのは engine と同じ `{recipe, cache:{faces,hinges,creases,bonds}, revision}`。
   🚪engine の共通入口は、この cache の faces/hinges/creases/bonds を使い、hash は engine の digest で付けなおす。
   ⛔ここで付ける hash（cacheDigest）は単体で読むとき用＝保存の照合は engine の digest で行う。 */
function toCache(out) {
 const stepOf = new Map(out.recipe.steps.map(v => [v.id, v]));
 const faces = out.faces.map(f => ({ faceId: f.faceId, layerPath: C(f.layerPath),
   poly: f.poly.map(p => p.slice()), xf: f.xf.slice(), layer: f.layer }));
 const byId = new Map(faces.map(f => [f.faceId, f]));
 const bonds = out.bonds.map(b => ({ bondId: b.bondId, faceIds: C(b.faceIds), stepId: b.stepId,
   kind: b.kind, seg: C(b.seg), ...(b.openedBy ? { openedBy: b.openedBy } : {}), ...(b.closedBy ? { closedBy: b.closedBy } : {}) }));
 /* ⚠もとからある hinges（＝どの手で折ったかの由来）は**消さない**。開いた結びも「その手で折った」
    ことは本当で、いま背かどうかを決めるのは結びの kind のほう（engine の hingeIntervals もそう見ている）。 */
 const hinges = C(out.before.hinges);
 let hn = hinges.length;
 for (const b of bonds) {
  if (b.kind !== 'hinge' || b.stepId !== out.stepId) continue;
  hinges.push({ hingeId: `h-${b.stepId}-${++hn}`, stepId: b.stepId, faceIds: C(b.faceIds),
                sourceLine: C(b.seg), kind: (stepOf.get(b.stepId) || {}).kind || null });
 }
 /* 開いて平らになった結びは「折り目」として creases にも足す＝`guidesOf`（吸い付き先）と
    `creaseIntervals`（区間ID）がそのまま効く。持ち主の面は **keep の側**（splitFaces と同じ1つの規則）。
    seg は v1 の creases と同じ**いまの座標**（bond の seg は素材座標なので、持ち主の xf で写す）。 */
 /* 前からある折り目のうち、持ち主の面がこの手で割れた・動いた・背になったものは、そのままでは置けない。
    背になった（closedBy）ものは外す／それ以外で持ち主が変わるものは未検証として断る（局所）。 */
 const closed = out.bonds.filter(b => b.closedBy === out.stepId);
 const keptFace = id => { const f = byId.get(id), was = out.before.faces.find(v => v.faceId === id);
  return f && was && f.xf.every((v, j) => Math.abs(v - was.xf[j]) < 1e-9) };
 const creases = C(out.before.creases).filter(c => {
  /* 持ち主の面で照合する（同じ直線の上に、別の面の別の結びが重なっていることがある＝線だけで見ない）。
     折り目の持ち主（直前の面）が、背になった結びの片側の面の親で、その結びの線の上にあるときだけ外す。 */
  const onClosed = closed.some(b => {
   if (!b.faceIds.some(id => id === c.faceId || id.startsWith(`${c.faceId}/${out.stepId}.`))) return false;
   const was = out.before.faces.find(v => v.faceId === c.faceId), seg = b.seg.map(p => apply(was.xf, p));
   return c.seg.every(q => Math.abs(cross2([seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]], [q[0] - seg[0][0], q[1] - seg[0][1]])) < 1e-9) });
  if (onClosed) return false;
  if (out.frame.follow && !keptFace(c.faceId)) bad(`折り目 ${c.creaseId} の持ち主の面がこの袋折りで動きます（未検証）`);
  return true });
 let cn = creases.length;
 for (const b of out.bonds) {
  if (b.kind !== 'crease') continue;
  const f = byId.get(b.keepFace);
  if (!f) bad(`開いた折り目 ${b.bondId} の持ち主の面がありません（${b.keepFace}）`);
  creases.push({ creaseId: `c-${b.stepId}-${++cn}`, stepId: b.stepId, faceId: b.keepFace,
                 seg: b.seg.map(p => apply(f.xf, p)), kind: (stepOf.get(b.stepId) || {}).kind || 'V' });
 }
 const cache = { faces, hinges, creases, bonds };
 cache.hash = cacheDigest(cache);
 return { recipe: C(out.recipe), cache, revision: out.recipe.steps.length, readOnly: true };
}
function cacheDigest(cache) {
 const r = n => Math.round(n * 1e9) / 1e9 + 0;
 return JSON.stringify({ faces: cache.faces.map(f => ({ id: f.faceId, path: f.layerPath,
   poly: f.poly.map(p => p.map(r)), xf: f.xf.map(r), layer: f.layer })),
  hinges: cache.hinges, creases: cache.creases.map(c => ({ id: c.creaseId, face: c.faceId,
   seg: c.seg.map(p => p.map(r)), kind: c.kind })),
  bonds: cache.bonds.map(b => ({ faces: b.faceIds, kind: b.kind, seg: b.seg.map(p => p.map(r)) })) });
}

/* ================= ⑦ 動きの座標（描画へ渡すものと同じ配列） ================= */
/* 🚨ここは `SquashModel.panels` を**そのまま**使う＝運動の計算を2つに増やさない。
   区間 → 面の割りつけと、素材の対称 D での番号の読みかえ・平面の対称 Gᵀ でいまの平面へ戻すことだけが v2 の持ちもの（高さはそのまま）。
   三角形は**素材の区間の順・素材の頂点の順**（O, 光線 s の端, 光線 s+1 の端）で並べる
   ＝巻き順が素材のおもてを向く（det(D)=−1 でも表裏が入れかわらない。gl_FrontFacing はこれで決まる）。 */
function frames(out, t) {
 if (typeof t !== 'number' || !(t >= 0 && t <= 1)) bad('t は 0〜1 です');
 const m = M(), pl = m.panels(t), fr = out.frame;
 return out.sectorFace.map((faceId, s) => {
  if (fr.follow && !fr.follow.includes(s)) {
   const f = out.before.faces.find(v => pointIn(v.poly.map(p => invPt(v.xf, p)), [(m.RAY[s][0] + m.RAY[(s + 1) % 8][0]) / 3, (m.RAY[s][1] + m.RAY[(s + 1) % 8][1]) / 3]));
   return { sector: s, faceId, tri: [[0, 0], m.RAY[s], m.RAY[(s + 1) % 8]].map(p => [...apply(f.xf, p), 0]) };
  }
  return { sector: s, faceId,
   tri: [pl[fr.modelOfSector[s]][0], modelVertex(fr, pl, s, s), modelVertex(fr, pl, s, (s + 1) % 8)].map(v => [...lin(fr.Gt, v), v[2]]) };
 });
}
function positions(out, t, order) {
 const fr = frames(out, t), a = new Float32Array(8 * 9), ord = order || [0, 1, 2, 3, 4, 5, 6, 7];
 ord.forEach((s, i) => { for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) a[i * 9 + k * 3 + c] = fr[s].tri[k][c] });
 return a;
}
/* 描く順（素材の区間の番号を、上の層から）。
   厚み0の紙では、動かない面どうしは途中もずっと同じ高さ（同着）＝depth バッファでは上下が決まらず、**先に描いた面が勝つ**
   （depth は LESS）。同着は直前状態（状態②）の層順を継ぐ＝layersOf の同着の規則と同じなので、直前の面の層の上から描く。
   ⚠これは描画の順だけ。位置・表裏（巻き順）・運動は変えない。 */
function drawOrder(out) {
 const layerOfSector = new Array(8).fill(null);
 for (const f of out.before.faces) for (let s = 0; s < 8; s++) {
  const a = M().RAY[s], b = M().RAY[(s + 1) % 8], c = [(a[0] + b[0]) / 3, (a[1] + b[1]) / 3];
  if (pointIn(f.poly.map(p => invPt(f.xf, p)), c)) {
   if (layerOfSector[s] !== null) bad(`区間 ${s} が直前の面2枚に入っています`);
   layerOfSector[s] = f.layer }
 }
 if (layerOfSector.some(v => v === null)) bad('直前の面に入らない区間があります');
 return [0, 1, 2, 3, 4, 5, 6, 7].sort((x, y) => layerOfSector[y] - layerOfSector[x] || x - y);
}

return { MODEL, LINKAGE, OPS, ROLES, TIE, EPS, MAX_STEPS, MAX_FACES,
         useV1Validator, validate, replayWith, candidateStep, roleOf, reconstruct, closureGap, checkApplicable, makeFrame, DIHEDRAL, bindAxes, splitFaces,
         reconstructLocal, checkApplicableLocal, ringAtAnchor, readPocket,
         placeFaces, layersOf, allRegions, heightAt, orderFaces, replay, digest, frames, positions, drawOrder,
         bondsOf, toCache, cacheDigest,
         apply, invPt, intersect, polyArea, pointIn, hull };
})();
