'use strict';
/* 🧷 紙どうしの「すり抜け」を調べる読み取り専用の解析（2026-09-14・判定方式の検証用。engine には組みこんでいない）。
   原本も cache も書きかえない。engine の関数も使わない（別の手で測る）。

   ★2つの問い
   ① flatState(cache)：平らに畳まれた状態が、紙として成り立つか（厚み→0 の極限の「並び」で見る）
      結び（hinge/crease）が乗っている直線ごとに、その直線を横切る断面を考える。
      断面では、紙は軸から右（S>0）か左（S<0）へ伸びる「半直線」になり、同じ側では層の順に積まれる。
      半直線を「右側は下→上、左側は上→下」と一周の順に並べ、つながり（結び・直線をまたぐ1枚の面）を弦で結ぶ。
      **弦が交差したら、紙が紙を突き抜けている**（taco–taco／taco–tortilla の条件を1つにまとめた形）。
      直線上の点は無数にあるが、並びが変わるのは面の頂点・辺・結びの端だけ＝**区切りと区切りのあいだの中点を1つずつ見れば全部**。
   ② simpleFold(before, move)：1本の軸で剛体回転する「ふつうの折り」の途中を調べる
      a. 厚み0の交差：動く面は軸を含む平面（角度 θ）にあり、固定面は z=0 の平面にある。
         0<θ<180° では2つの平面は**軸の直線でしか交わらない**＝交わりは軸上の区間だけ（どの角度でも同じ）。
         その区間を「共有する結び」「辺どうしの接触」「動く辺が固定面の中の線に触れる」に分けて返す。
      b. 並び（厚み→0）＝判定はこれ1本：
         - 出発（θ=0+）：動く部分と面積で重なる固定の紙が、谷折りなら上・山折りなら下にあれば、その紙を通り抜ける（sweep）
           ⚠軸の断面での「出発の並び」も最初は別に見ていたが、軸に接して同じ側に重なる紙は必ず面積でも重なる＝同じ門の二重なので外した
         - 途中（0<θ<180°）の一周の順（ring）は**診断として出すだけ**：始まりの平らな状態が ① で成立し、sweep を通れば、
           動く紙は一周の順の中で1つのかたまりのまま隙間を移るだけ＝弦の交差は起きない（総当り 6,370候補で0件）
         - 着地（θ=180°）：その結果の平らな状態を ① で見る（engine の積み直しがそのまま答え）
   ★「ふつうの折りは engine の既存の①と積み直しで足りる」の**前提・証明の筋・確認**（2026-09-14・分けて書く）
     前提（どれか1つでも外れたら、この結論は使えない）
       P1 始まりの平らな状態が成立している（① flatState の意味：軸の断面の弦が交差しない・同じ層で面積をもって重ならない）
       P2 手は「1本の直線を軸に、選んだ面の動く側を剛体で 0→180° 回す」だけ。止まる紙はぜんぶ始まりの平面にある
       P3 動く紙と止まる紙を結ぶ結び（背・折り目）は、軸の上にしかない（engine の④裂け・②折り目でつながった紙）
       P4 ①が**厳密に**成り立つ：動く部分と面積をもって重なる止まった紙は、谷なら全部下・山なら全部上
          ⚠engine の overlapsArea は 2026-09-14 に標本点から「凸多角形の交わりの最小幅 > 1e-7」へ置きかえた
            （標本点は端のそろった帯などを見逃した＝test_overlap_area.js の R）。倍精度の判定で、幅 1e-7 前後は接触と区別しない＝数学的に厳密ではない。
            ここの sweep は面積 > 1e-9 で見る（別の許容差）。候補探索では食い違い0だが、許容差の間（幅≦1e-7 で面積 >1e-9 等）は一致を保証しない
       P5 積み直しは、動く紙を「重なる（触れるも含む）止まった紙ぜんぶ」より上（谷）／下（山）へ、順を逆にして置く（restack の pivot）
     証明の筋（紙の上の検算ではなく、上の前提からの論証。機械で証明したものではない）
       a 0<θ<180° で動く面は軸を含む傾いた平面、止まる面は始まりの平面＝交わりは軸の直線の上だけ（厚み0で厳密）
       b 出発で紙を通り抜けない ⇔ 動く面の各点で、同じ側の止まる紙が谷なら下にある ⇔ P4
       c 軸の断面の一周の順：止まる紙の並びは動かず、動く紙は P4 によりかたまりのまま隙間（谷＝上半分／山＝下半分）を移るだけ
         ＝一周の順（どの半直線がどの順か）は出発から着地まで同じ ⇒ P1 の非交差がそのまま続く
       d 着地：軸以外の直線 ℓ では、同じ側にある動いた紙と止まった紙は ℓ の近くで重なる ⇒ P5 で動いた紙が全部上
         ＝一周の順は「止まる紙のかたまり」と「動いた紙のかたまり（鏡に映した並び＝非交差のまま）」に分かれ、
           2つのかたまりをまたぐ弦は P3 により軸の上にしか無い ⇒ 着地の平らな状態も成立（P1 が次の手の前提になる＝帰納）
     候補探索での確認（論証とは別。この範囲でしか言えない）
       袋折り直後など6状態・6,370候補／検査に固定したのは4状態・2,156候補（test_crossing_diag.js の E）：
       engine の①と sweep の食い違い0／engine が通した結果はすべて成立／途中だけの交差0
   ⛔これが言わないこと
     - 厚みのある紙（層の数だけ回り込む余裕・折り目のずれ）は見ていない。並びは「厚み→0 の極限」。
     - 複数の軸を同時に動かす運動（袋折りの途中など）は ② の対象外（平面が1枚でないので a の議論が成り立たない）。
*/
globalThis.FoldCrossing = (() => {
const TOL = 1e-9;
/* 判定回数（携帯での見積もり用）：内外判定・面積の交わり・弦の組の数 */
const cost = { inside: 0, clip: 0, chordPairs: 0 };
const resetCost = () => { cost.inside = 0; cost.clip = 0; cost.chordPairs = 0 };
const ap = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const areaOf = P => { let s = 0; for (let i = 0; i < P.length; i++) s += cross(P[i], P[(i + 1) % P.length]); return s / 2 };
const ccw = P => areaOf(P) >= 0 ? P : P.slice().reverse();
/* 凸多角形の厳密な内部（ふちは外） */
function strictIn(P, p) { cost.inside++; const Q = ccw(P);
 for (let i = 0; i < Q.length; i++) if (cross(sub(Q[(i + 1) % Q.length], Q[i]), sub(p, Q[i])) <= 1e-12) return false;
 return true }
function clip(P, Q) { cost.clip++; let out = ccw(P); const q = ccw(Q);
 for (let i = 0; i < q.length && out.length; i++) { const a = q[i], b = q[(i + 1) % q.length], inp = out; out = [];
  for (let j = 0; j < inp.length; j++) { const p = inp[j], r = inp[(j + 1) % inp.length], sp = cross(sub(b, a), sub(p, a)), sr = cross(sub(b, a), sub(r, a));
   if (sp >= -1e-12) out.push(p);
   if ((sp > 1e-12 && sr < -1e-12) || (sp < -1e-12 && sr > 1e-12)) { const t = sp / (sp - sr); out.push([p[0] + (r[0] - p[0]) * t, p[1] + (r[1] - p[1]) * t]) } } }
 return out.length >= 3 ? out : [] }
const overlapArea = (P, Q) => { const I = clip(P, Q); return I.length ? Math.abs(areaOf(I)) : 0 };

/* 直線 L＝点 o と単位ベクトル u、法線 n（右＝S>0 の側）。 */
function lineOf(a, b) { const d = sub(b, a), L = Math.hypot(d[0], d[1]); let u = [d[0] / L, d[1] / L];
 if (u[0] < -TOL || (Math.abs(u[0]) <= TOL && u[1] < 0)) u = [-u[0], -u[1]];
 const n = [-u[1], u[0]], c = dot(n, a);
 return { u, n, c, o: [n[0] * c, n[1] * c], key: [u[0], u[1], c].map(v => Math.round(v * 1e7) / 1e7 + 0).join(',') } }
const along = (L, p) => dot(sub(p, L.o), L.u);
const offLine = (L, p) => dot(L.n, p) - L.c;
/* 直線 L の上での区切り：面の頂点が乗る所・辺が直線を横切る所・結びの端 */
function breaks(L, faces, segs) { const ts = [];
 for (const f of faces) for (let i = 0; i < f.poly.length; i++) { const p = f.poly[i], q = f.poly[(i + 1) % f.poly.length], sp = offLine(L, p), sq = offLine(L, q);
  if (Math.abs(sp) <= 1e-9) ts.push(along(L, p));
  if ((sp > 1e-9 && sq < -1e-9) || (sp < -1e-9 && sq > 1e-9)) { const t = sp / (sp - sq); ts.push(along(L, [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])) } }
 for (const s of segs) for (const p of s) ts.push(along(L, p));
 ts.sort((a, b) => a - b); const out = [];
 for (const t of ts) if (!out.length || t - out[out.length - 1] > 1e-7) out.push(t);
 return out }
/* 点 x（直線上）での半直線：右 R・左 L のどちらに伸びるか */
function raysAt(L, x, faces, h) { const out = [];
 for (const f of faces) { const r = strictIn(f.poly, [x[0] + L.n[0] * h, x[1] + L.n[1] * h]), l = strictIn(f.poly, [x[0] - L.n[0] * h, x[1] - L.n[1] * h]);
  if (r) out.push({ face: f.faceId, side: 'R', layer: f.layer });
  if (l) out.push({ face: f.faceId, side: 'L', layer: f.layer }) }
 return out }
/* 一周の順に並べ、弦の交差と同じ側の同じ層を見る。order: 半直線の並び（配列）、chords: [[i,j]…]（並びの番号） */
function crossings(order, chords) { const bad = [];
 /* 判定は一周を1回たどるだけ（括弧の対応と同じ＝弦が交差しない ⇔ 端に来るたびスタックの一番上が相方）。O(弦の数) */
 const mate = new Map(); chords.forEach(([i, j], c) => { mate.set(i, c); mate.set(j, c) });
 const stack = []; let ok = true;
 for (let v = 0; v < order.length; v++) { if (!mate.has(v)) continue; cost.chordPairs++;
  const c = mate.get(v); if (stack.length && stack[stack.length - 1] === c) stack.pop(); else if (stack.includes(c)) { ok = false; break } else stack.push(c) }
 if (ok) return bad;
 /* 交差したときだけ、どの組かを総当りで挙げる（診断用） */
 for (let a = 0; a < chords.length; a++) for (let b = a + 1; b < chords.length; b++) {
  const [i, j] = chords[a].slice().sort((x, y) => x - y), [k, l] = chords[b].slice().sort((x, y) => x - y);
  if ((i < k && k < j && j < l) || (k < i && i < l && l < j)) bad.push([chords[a], chords[b]].map(c => c.map(v => order[v].face + ':' + order[v].side))) }
 return bad }
/* 断面の弦：結び（素材座標の線を面の xf でいまへ）と、直線をまたぐ1枚の面 */
function chordsAt(L, x, order, bonds, byId) { const idx = (face, side) => order.findIndex(r => r.face === face && (!side || r.side === side));
 const chords = [], anomalies = [];
 for (const f of new Set(order.map(r => r.face))) { const i = idx(f, 'R'), j = idx(f, 'L'); if (i >= 0 && j >= 0) chords.push([i, j]) }
 for (const bd of bonds) { const A = byId.get(bd.faceIds[0]), B = byId.get(bd.faceIds[1]); if (!A || !B) continue;
  const s = bd.seg.map(p => ap(A.xf, p));
  if (Math.abs(offLine(L, s[0])) > 1e-9 || Math.abs(offLine(L, s[1])) > 1e-9) continue;
  const t = along(L, x), t0 = Math.min(along(L, s[0]), along(L, s[1])), t1 = Math.max(along(L, s[0]), along(L, s[1]));
  if (!(t > t0 + 1e-9 && t < t1 - 1e-9)) continue;
  const ra = order.filter(r => r.face === A.faceId), rb = order.filter(r => r.face === B.faceId);
  if (ra.length !== 1 || rb.length !== 1) { anomalies.push(`結び ${bd.bondId} の面が断面で1本の半直線になっていません`); continue }
  chords.push([order.indexOf(ra[0]), order.indexOf(rb[0])]) }
 const deg = new Map(); for (const c of chords) for (const v of c) deg.set(v, (deg.get(v) || 0) + 1);
 for (const [v, d] of deg) if (d > 1) anomalies.push(`半直線 ${order[v].face}:${order[v].side} に弦が${d}本`);
 return { chords, anomalies } }
const sortRing = rays => [...rays.filter(r => r.side === 'R').sort((a, b) => a.layer - b.layer), ...rays.filter(r => r.side === 'L').sort((a, b) => b.layer - a.layer)];
function sameLayer(rays) { const bad = [];
 for (const s of ['R', 'L']) { const rs = rays.filter(r => r.side === s);
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (rs[i].layer === rs[j].layer) bad.push(`${rs[i].face}/${rs[j].face}@${s}`) }
 return bad }

/* ================= ① 平らな状態が紙として成り立つか ================= */
function flatState(cache) { resetCost();
 const faces = cache.faces, byId = new Map(faces.map(f => [f.faceId, f])), lines = new Map();
 for (const bd of cache.bonds) { const A = byId.get(bd.faceIds[0]); if (!A) continue; const s = bd.seg.map(p => ap(A.xf, p));
  if (Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) < 1e-9) continue;
  const L = lineOf(s[0], s[1]); if (!lines.has(L.key)) lines.set(L.key, { L, segs: [] }); lines.get(L.key).segs.push(s) }
 const report = [], violations = [];
 /* 面積をもって重なる2枚が同じ層（断面に出ない所の見張り） */
 for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++)
  if (faces[i].layer === faces[j].layer && overlapArea(faces[i].poly, faces[j].poly) > 1e-9) violations.push({ kind: 'same-layer-overlap', faces: [faces[i].faceId, faces[j].faceId] });
 let samples = 0;
 for (const { L, segs } of lines.values()) { const ts = breaks(L, faces, segs);
  for (let k = 0; k + 1 < ts.length; k++) { const tm = (ts[k] + ts[k + 1]) / 2, len = ts[k + 1] - ts[k];
   const x = [L.o[0] + L.u[0] * tm, L.o[1] + L.u[1] * tm];
   if (!segs.some(s => { const a = along(L, s[0]), b = along(L, s[1]); return tm > Math.min(a, b) + 1e-9 && tm < Math.max(a, b) - 1e-9 })) continue;
   const h = Math.min(1e-6, len / 1e3), order = sortRing(raysAt(L, x, faces, h));
   const { chords, anomalies } = chordsAt(L, x, order, cache.bonds, byId);
   samples++;
   const cr = crossings(order, chords), sl = sameLayer(order);
   report.push({ line: L.key, at: x, ring: order.map(r => `${r.face}:${r.side}${r.layer}`), chords: chords.length, crossings: cr, anomalies, sameLayer: sl });
   for (const c of cr) violations.push({ kind: 'crossing', line: L.key, at: x, pair: c });
   for (const a of anomalies) violations.push({ kind: 'anomaly', line: L.key, at: x, what: a });
   for (const s of sl) violations.push({ kind: 'same-layer-at-edge', line: L.key, at: x, what: s }) } }
 return { ok: !violations.length, violations, samples, lines: lines.size, faces: faces.length, cost: { ...cost }, report } }

/* ================= ② 1本の軸で回す「ふつうの折り」の途中 =================
   move = { a, b（いまの座標の軸）, side（動く側の点・いまの座標）, kind:'V'|'M', moving:[faceId…]（選んだ面） }
   動く部分＝選んだ面を軸で切った、動く側。固定＝選ばなかった面ぜんぶと、選んだ面の止まる側。 */
function splitBy(P, L, sgn) { const out = [];
 for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], sp = offLine(L, p) * sgn, sq = offLine(L, q) * sgn;
  if (sp >= -1e-12) out.push(p);
  if ((sp > 1e-12 && sq < -1e-12) || (sp < -1e-12 && sq > 1e-12)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]) } }
 return out.length >= 3 && Math.abs(areaOf(out)) > 1e-12 ? out : null }
function simpleFold(before, move, opt = {}) { resetCost();
 const L = lineOf(move.a, move.b), mv = offLine(L, move.side) < 0 ? 'L' : 'R', mvSgn = mv === 'R' ? 1 : -1;
 const sel = new Set(move.moving), faces = before.faces, byId = new Map(faces.map(f => [f.faceId, f]));
 const parts = [], fixed = [];
 for (const f of faces) {
  if (sel.has(f.faceId)) { const m = splitBy(f.poly, L, mvSgn), k = splitBy(f.poly, L, -mvSgn);
   if (m) parts.push({ faceId: f.faceId, poly: m, layer: f.layer });
   if (k) fixed.push({ faceId: f.faceId + '#keep', of: f.faceId, poly: k, layer: f.layer }) }
  else fixed.push({ faceId: f.faceId, of: f.faceId, poly: f.poly, layer: f.layer }) }
 const out = { movingSide: mv, kind: move.kind, sweep: [], ring: [], contacts: [], violations: [] };
 /* b-出発（軸から離れた所）：動く部分と面積で重なる固定の紙が、谷なら上・山なら下にあれば通り抜ける */
 for (const p of parts) for (const f of faces) { if (sel.has(f.faceId)) continue;
  if (overlapArea(p.poly, f.poly) <= 1e-9) continue;
  if (move.kind === 'V' ? f.layer > p.layer : f.layer < p.layer) { out.sweep.push([p.faceId, f.faceId]); out.violations.push({ kind: 'sweep', moving: p.faceId, fixed: f.faceId }) } }
 /* 軸の断面：区切りごとに、出発の並び・途中の一周の順 */
 const segs = [[move.a, move.b]];
 const ts = breaks(L, faces, before.bonds.map(bd => { const A = byId.get(bd.faceIds[0]); return A ? bd.seg.map(p => ap(A.xf, p)) : null }).filter(s => s && Math.abs(offLine(L, s[0])) <= 1e-9 && Math.abs(offLine(L, s[1])) <= 1e-9).concat(segs));
 for (let k = 0; k + 1 < ts.length; k++) { const tm = (ts[k] + ts[k + 1]) / 2, len = ts[k + 1] - ts[k], x = [L.o[0] + L.u[0] * tm, L.o[1] + L.u[1] * tm];
  const h = Math.min(1e-6, len / 1e3), rays = raysAt(L, x, faces, h);
  if (!rays.length) continue;
  const movingRays = rays.filter(r => r.side === mv && sel.has(r.face)), other = rays.filter(r => r.side !== mv);
  if (!movingRays.length) continue;
  const fixedSame = rays.filter(r => r.side === mv && !sel.has(r.face));
  /* 途中：一周の順（右＝S>0 は下→上、上半分、左は上→下、下半分）の中で、動く紙だけが谷なら上半分・山なら下半分へ移る。
     ⚠左右を鏡に映して並べると、動く紙どうしの順も逆になる（最初そう書いて、交差していない形を交差と誤判定した）。 */
  const up = a => a.slice().sort((p, q) => p.layer - q.layer), down = a => a.slice().sort((p, q) => q.layer - p.layer);
  const order = mv === 'L'
   ? (move.kind === 'V' ? [...up(other), ...down(movingRays), ...down(fixedSame)] : [...up(other), ...down(fixedSame), ...down(movingRays)])
   : (move.kind === 'V' ? [...up(fixedSame), ...up(movingRays), ...down(other)] : [...up(fixedSame), ...down(other), ...up(movingRays)]);
  const { chords, anomalies } = chordsAt(L, x, order, before.bonds, byId);
  const cr = crossings(order, chords);
  out.ring.push({ at: x, ring: order.map(r => `${r.face}:${r.side === mv ? 'mv' : 'st'}${r.layer}`), crossings: cr, anomalies });
  /* 診断：判定には入れない（上の注） */ }
 /* a. 厚み0の交差：0<θ<180° では交わりは軸上だけ。軸上の区間を、動く部分と固定の面の組ごとに分類する（診断用・opt.contacts のときだけ）。 */
 if (opt.contacts) {
 const onAxis = P => { let lo = Infinity, hi = -Infinity, inside = false;
  for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], sp = offLine(L, p), sq = offLine(L, q);
   if (Math.abs(sp) <= 1e-9) { lo = Math.min(lo, along(L, p)); hi = Math.max(hi, along(L, p)) }
   if ((sp > 1e-9 && sq < -1e-9) || (sp < -1e-9 && sq > 1e-9)) { inside = true; const t = sp / (sp - sq), z = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; lo = Math.min(lo, along(L, z)); hi = Math.max(hi, along(L, z)) } }
  return hi - lo > 1e-9 ? { lo, hi, inside } : null };
 for (const p of parts) { const ip = onAxis(p.poly); if (!ip) continue;
  for (const f of fixed) { const iq = onAxis(f.poly); if (!iq) continue;
   const lo = Math.max(ip.lo, iq.lo), hi = Math.min(ip.hi, iq.hi); if (hi - lo <= 1e-9) continue;
   const same = f.of === p.faceId;
   const bond = before.bonds.find(bd => bd.faceIds.includes(p.faceId) && bd.faceIds.includes(f.of) && (() => { const A = byId.get(bd.faceIds[0]), s = bd.seg.map(q => ap(A.xf, q));
    return Math.abs(offLine(L, s[0])) <= 1e-9 && Math.abs(offLine(L, s[1])) <= 1e-9 && Math.min(along(L, s[0]), along(L, s[1])) < hi - 1e-9 && Math.max(along(L, s[0]), along(L, s[1])) > lo + 1e-9 })());
   out.contacts.push({ moving: p.faceId, fixed: f.faceId, span: [lo, hi], type: same ? 'この手でできる背（同じ面の割れ目）' : bond ? `結び ${bond.bondId}（${bond.kind}）で軸を共有` : iq.inside ? '動く辺が固定面の中の線に触れる' : '辺どうしの接触' }) } } }
 return { ...out, ringCrossings: out.ring.reduce((n, r) => n + r.crossings.length + r.anomalies.length, 0), ok: !out.violations.length, parts: parts.map(p => p.faceId), fixed: fixed.map(f => f.faceId), faces: faces.length, cost: { ...cost } } }

/* 補助（保証ではない）：θ のコマごとに、動く三角形と固定三角形が「軸から離れた所」で交わっていないかを数値で見る。 */
function sweepFrames(before, move, frames = 179) {
 const L = lineOf(move.a, move.b), mvSgn = offLine(L, move.side) < 0 ? -1 : 1, sel = new Set(move.moving);
 const tri = P => { const out = []; for (let i = 1; i + 1 < P.length; i++) out.push([P[0], P[i], P[i + 1]]); return out };
 const mov = [], fix = [];
 for (const f of before.faces) {
  if (sel.has(f.faceId)) { const m = splitBy(f.poly, L, mvSgn), k = splitBy(f.poly, L, -mvSgn); if (m) mov.push(...tri(m)); if (k) fix.push(...tri(k)) }
  else fix.push(...tri(f.poly)) }
 const sg = move.kind === 'V' ? 1 : -1, hits = [];
 for (let k = 1; k <= frames; k++) { const th = Math.PI * k / (frames + 1), c = Math.cos(th), s = Math.sin(th);
  const rot = p => { const d = offLine(L, p), t = along(L, p), base = [L.o[0] + L.u[0] * t, L.o[1] + L.u[1] * t], dd = -mvSgn * d;
   return [base[0] - mvSgn * L.n[0] * dd * c, base[1] - mvSgn * L.n[1] * dd * c, sg * dd * s] };
  for (const T of mov) { const R = T.map(rot);
   /* 固定面は z=0。動く三角形と z=0 の交わり（線分）が、固定三角形の内部に「軸から離れて」入るか */
   const pts = [];
   for (let i = 0; i < 3; i++) { const p = R[i], q = R[(i + 1) % 3];
    if (Math.abs(p[2]) <= 1e-12) pts.push([p[0], p[1]]);
    if ((p[2] > 1e-12 && q[2] < -1e-12) || (p[2] < -1e-12 && q[2] > 1e-12)) { const t = p[2] / (p[2] - q[2]); pts.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]) } }
   for (const p of pts) if (Math.abs(offLine(L, p)) > 1e-7 && fix.some(F => strictIn(F, p))) hits.push({ deg: 180 * k / (frames + 1), at: p }) } }
 return { frames, hits } }

return { flatState, simpleFold, sweepFrames, lineOf, overlapArea };
})();
if (typeof module !== 'undefined') module.exports = globalThis.FoldCrossing;
