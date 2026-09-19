'use strict';
/* 🔎 つる⑬（脚の中割り）：観察資料（figs/crane13_video_pa27/README.md）の手順を、engine の**既存操作だけ**で順に通せるかの調査（2026-09-18・本人指示）。
   ⚠調査だけ。engine・UI・保存形式は変えない。候補は engine の既存 API に直接渡す（UI は使わない）。
   手順（観察の①〜③に対応させた本人指示の (a)〜(e)）
     (a) ⑬の線で先の8層を外へ fold（180°・平ら）。8層すべてに⑬の折り目が付いたか（素材座標で）
     (b) 折り目だけ残して紙を元へ：(b1) (a) の背を「背を開く」で戻す／(b2) ⑫の紙へ op:'crease' で8層に一度に
     (c) (b) の紙で、胴の片側を「背を開く」で開く（付け根の背＝中心線の上の背）。脚の先の8層がどう分かれるか
     (d) 開いた紙で、⑬の折り目に沿って折り直す
     (e) 胴を閉じ直して終端と目標を比べる
   各段で見るもの：foldability／creasability の関門・flatState・結びの不変条件（結びの線が両側で一致）・保存→再読込・undo/redo。
   材料：crane12_state.json（⑫のあと）・crane13_cutline.json（⑬の線＝ORIPA の元の端点・脚ごとの素材座標）・crane13_input.json（先端の位置）
   使い方： node probe_crane13_steps.js   →  crane13_steps_probe.log
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), crypto = require('node:crypto');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname, rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'petal_v2.js', 'fold_crossing.js']) vm.runInThisContext(rd(f));
SquashV2.useV1Validator(OrigamiRecipe.validate, JSON.parse(rd('origami_recipe.schema.json')));
const E = FreeFoldEngine, X = FoldCrossing;
const C = x => JSON.parse(JSON.stringify(x));
const out = [];
const say = (...a) => { const s = a.join(' '); out.push(s); console.log(s) };
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const inv = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cen = poly => poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
const distLine = (p, a, b) => { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d); return Math.abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / L };
const load = r => { const st = E.create(); st.recipe = C(r); st.cache = E.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache; return st };
const r4 = p => p.map(v => +v.toFixed(4));

const base = JSON.parse(rd('crane12_state.json')).recipe;
const INPUT = JSON.parse(rd('crane13_input.json'));
const CUT = JSON.parse(rd('crane13_cutline.json'));
const LEG = CUT.legs.find(l => l.leg === 1);
const layerOf = {};/* ⑫のあとの面ID → engine の層（出力の名前にだけ使う） */

/* ---------------- 共通の検査 ---------------- */
function bondGap(st) {/* 結びの不変条件：結びの線（素材座標）を両側の面の xf で置いたときのずれ */
 let g = 0;
 for (const b of st.cache.bonds) { const fa = st.cache.faces.find(f => f.faceId === b.faceIds[0]), fb = st.cache.faces.find(f => f.faceId === b.faceIds[1]);
  if (!fa || !fb) { g = Infinity; continue }
  for (const p of b.seg) g = Math.max(g, dist(apply(fa.xf, p), apply(fb.xf, p))) }
 return g;
}
function checks(st, label, steps) {
 const r = {};
 try { r.flat = X.flatState(st.cache).ok } catch (e) { r.flat = '例外 ' + e.message }
 r.replay = E.replay(st.recipe).hash === st.cache.hash;
 r.bond = bondGap(st);
 try { const saved = C(E.verifiedRecipe(st)), re = load(saved); r.save = re.cache.hash === st.cache.hash } catch (e) { r.save = '断る：' + e.message }
 try { const h = st.cache.hash, txt = JSON.stringify(st.recipe); for (let i = 0; i < steps; i++) E.undo(st); for (let i = 0; i < steps; i++) E.redo(st);
  r.undo = st.cache.hash === h && JSON.stringify(st.recipe) === txt } catch (e) { r.undo = '断る：' + e.message }
 say(`    検査（${label}）：flatState ${r.flat}／再生一致 ${r.replay}／結びの線のずれ ${r.bond.toExponential(1)}／保存→再読込 ${r.save}／undo・redo（${steps}手）${r.undo}`);
 return r;
}
const nameOf = (st, id) => { const root = Object.keys(layerOf).find(k => id === k || id.startsWith(k + '/')); return root ? `脚${layerOf[root] >= 0 ? '+' : ''}${layerOf[root]}` + (id.length > root.length ? id.slice(root.length).replace(/\/s(\d+)\.(keep|cut)/g, (m, s, k) => k === 'keep' ? '·元' : '·先') : '') : '胴等' };

/* ---------------- ⑫の紙 ---------------- */
say('# つる⑬ 既存操作だけで観察の手順を通せるか（' + new Date().toISOString() + '）');
const st0 = load(base);
const fp = crypto.createHash('sha1').update(st0.cache.hash).digest('hex');
say(`⑫の紙：面 ${st0.cache.faces.length}・結び ${st0.cache.bonds.length}・手 ${base.steps.length}／指紋 ${fp.slice(0, 12)}…（crane13_input.json ${INPUT.meta.stateFingerprint.slice(0, 12)}… ${fp === INPUT.meta.stateFingerprint ? '一致' : '**不一致**'}）`);
for (const id of LEG.faceIds) { const f = st0.cache.faces.find(v => v.faceId === id); layerOf[id] = f ? f.layer : NaN }
say(`脚1の8面（crane13_cutline.json）：いまの紙に ${LEG.faceIds.filter(id => st0.cache.faces.some(f => f.faceId === id)).length}/8・層 ${LEG.faceIds.map(id => layerOf[id]).sort((a, b) => a - b).join(',')}`);
let [A, B] = [LEG.curLine.a, LEG.curLine.b];
const tip = INPUT.landmarks.legTip;
say(`⑬の線（いまの座標）：${JSON.stringify(r4(A))}–${JSON.stringify(r4(B))}・長さ ${dist(A, B).toFixed(4)}／脚の先端 ${JSON.stringify(r4(tip))}`);
if (E.side(tip, A, B) > 0) [A, B] = [B, A];/* 動く側（先）が S<0 */
/* 動く側の点：脚の面の先の部分の重心のうち、その場所のいちばん上が脚の面で、線から .03 より離れている点 */
function tipPoint(st) {
 const cands = [];
 for (const id of LEG.faceIds) { const f = st.cache.faces.find(v => v.faceId === id); if (!f) continue;
  const part = E.split(f.poly, A, B)[1]; if (!part || E.area(part) < 1e-6) continue;
  const c = cen(part); if (Math.abs(E.side(c, A, B)) / dist(A, B) < .03) continue;
  const top = E.stackAt(st, c)[0]; if (top && LEG.faceIds.includes(top.faceId)) cands.push({ c, top: top.faceId, area: E.area(part) }) }
 return cands.sort((x, y) => y.area - x.area)[0];
}

/* ================= (a) ⑬の線で先の8層を外へ fold ================= */
say('\n## (a) ⑬の線で先の8層を外へ fold（180°・平ら）');
const resA = {};
for (const kind of ['V', 'M']) {
 const st = load(base), tp = tipPoint(st);
 say(`  [${kind === 'V' ? '谷' : '山'}] 動く側の点 ${JSON.stringify(r4(tp.c))}（いちばん上 ${nameOf(st, tp.top)}）`);
 try {
  E.proposeOnFace(st, A, B, tp.top, { layers: 1, op: 'fold' }); st.pending.kind = kind; E.setSide(st, tp.c);
 } catch (e) { say(`    提案で断る：${e.message}`); continue }
 /* 選び方3つを順に試す（どれが通るか・何で断るか） */
 const tries = [['つながっているフラップ', () => E.setFlap(st, st.pending.at)], ['この側を全部', () => E.setSideAll(st)]];
 const L = E.layersAt(st, st.pending.at).layers.length;
 for (let n = 1; n <= L; n++) tries.push([`上から${n}枚`, () => E.setLayers(st, n, st.pending.at)]);
 let chosen = null;
 for (const [nm, fn] of tries) {
  try { fn(); const ids = st.pending.candidates.map(c => c.faceId).sort();
   const legHit = ids.filter(id => LEG.faceIds.includes(id)).length;
   say(`    ${nm}：通る（${ids.length}面・脚1の面 ${legHit}/8${ids.length > legHit ? '・ほか ' + (ids.length - legHit) : ''}）`);
   if (!chosen && legHit === 8 && ids.length === 8) chosen = nm;
  } catch (e) { say(`    ${nm}：断る「${e.message}」`) }
 }
 if (!chosen) { say('    → 脚1の8面ちょうどを選ぶ選び方が無い'); continue }
 const fn = tries.find(t => t[0] === chosen)[1]; fn();
 E.select(st, st.pending.candidates);
 try { E.confirm(st, { op: 'fold' }) } catch (e) { say(`    確定で断る：${e.message}`); continue }
 const sid = st.recipe.steps[st.recipe.steps.length - 1].id;
 say(`    確定：${chosen}・手 ${sid}・面 ${st.cache.faces.length}`);
 /* 8層すべてに⑬の折り目（素材座標で ORIPA の線の上）が付いたか */
 const got = [];
 for (const ln of LEG.lines) {
  const bs = st.cache.bonds.filter(b => b.stepId === sid && b.faceIds.every(id => id.startsWith(ln.faceId + '/')));
  const on = bs.filter(b => b.seg.every(p => distLine(p, ln.mat[0], ln.mat[1]) < 1e-9));
  got.push({ layer: layerOf[ln.faceId], n: bs.length, on: on.length, kind: [...new Set(bs.map(b => b.kind))].join('/') });
 }
 say(`    ⑬の折り目：` + got.sort((x, y) => x.layer - y.layer).map(g => `層${g.layer} ${g.on}/${g.n}本${g.kind ? '(' + g.kind + ')' : ''}`).join('・')
  + `　→ 8層すべてに素材座標で ORIPA の線の上の結び：${got.every(g => g.on === 1 && g.n === 1) ? '**付いた**' : '付いていない'}`);
 resA[kind] = { st, sid, recipe: C(st.recipe) };
 checks(st, `(a) ${kind}`, 1);
}

/* ================= (b1) (a) の背を「背を開く」で戻す ================= */
say('\n## (b1) (a) で折った⑬の背を「背を開く」で戻す（折り目だけ残して紙は元の位置へ）');
const resB = {};
for (const kind of Object.keys(resA)) {
 const st = load(resA[kind].recipe), sid = resA[kind].sid;
 const rows = E.hingeIntervals(st).filter(h => h.stepId === sid);
 say(`  [${kind === 'V' ? '谷' : '山'}で折った紙] ⑬の背の区間 ${rows.length}（見える ${rows.filter(h => h.visible).length}・両側一致 ${rows.filter(h => h.consistent).length}）`);
 let done = false;
 for (const h of rows.filter(h => h.visible && h.consistent)) {
  for (const fid of h.faceIds) { const f = st.cache.faces.find(v => v.faceId === fid); if (!f) continue;
   const at = cen(f.poly), top = E.stackAt(st, at)[0];
   if (!top || top.faceId !== fid) continue;
   try { E.proposeOpen(st, E.hingeIntent(st, h.intervalId), at); const k = E.pendingCheck(st);
    if (!k.ok) { say(`    背 ${h.intervalId} を ${nameOf(st, fid)} から：pendingCheck で断る「${k.reason}」`); E.cancel(st); continue }
    const ids = st.pending.candidates.map(c => c.faceId);
    E.select(st, st.pending.candidates); E.confirm(st, { op: 'fold' });
    say(`    背 ${h.intervalId} を ${nameOf(st, fid)} から開く：通る（動いた面 ${ids.length}）`);
    done = true; break;
   } catch (e) { say(`    背 ${h.intervalId} を ${nameOf(st, fid)} から：断る「${e.message}」`); try { E.cancel(st) } catch { } }
  }
  if (done) break;
 }
 if (!done) { say('    → 戻せなかった'); continue }
 /* 紙は元の位置か（⑫の紙の面の形の和と同じか）・⑬の結びは残るか */
 const back = st.cache.faces.every(f => { const root = st0.cache.faces.find(g => f.faceId === g.faceId || f.faceId.startsWith(g.faceId + '/')); return !!root && f.xf.every((v, i) => Math.abs(v - root.xf[i]) < 1e-9) });
 const cutB = st.cache.bonds.filter(b => b.stepId === sid);
 say(`    戻したあと：どの面も⑫のときの置かれ方と同じ ${back}／⑬の結び ${cutB.length}本（種類 ${[...new Set(cutB.map(b => b.kind + (b.openedBy ? '・開いた手 ' + b.openedBy : '')))].join(' / ')}）`);
 resB['b1-' + kind] = { recipe: C(st.recipe), sid };
 checks(st, `(b1) ${kind}`, 2);
}

/* ================= (b2) ⑫の紙へ op:'crease' で8層に一度に ================= */
say("\n## (b2) ⑫の紙へ op:'crease' で8層に一度に⑬の折り目");
{
 const st = load(base), tp = tipPoint(st);
 try {
  E.proposeOnFace(st, A, B, tp.top, { layers: 1, op: 'crease' }); E.setSide(st, tp.c);
  const tries = [['つながっているフラップ', () => E.setFlap(st, st.pending.at)], ['この側を全部', () => E.setSideAll(st)]];
  const L = E.layersAt(st, st.pending.at).layers.length;
  for (let n = 1; n <= L; n++) tries.push([`上から${n}枚`, () => E.setLayers(st, n, st.pending.at)]);
  let chosen = null;
  for (const [nm, fn] of tries) {
   try { fn(); const ids = st.pending.candidates.map(c => c.faceId), legHit = ids.filter(id => LEG.faceIds.includes(id)).length;
    say(`    ${nm}：通る（${ids.length}面・脚1の面 ${legHit}/8${ids.length > legHit ? '・ほか ' + (ids.length - legHit) : ''}）`);
    if (!chosen && legHit === 8 && ids.length === 8) chosen = nm;
   } catch (e) { say(`    ${nm}：断る「${e.message}」`) }
  }
  if (!chosen) say('    → 脚1の8面ちょうどを選ぶ選び方が無い');
  else {
   tries.find(t => t[0] === chosen)[1](); E.select(st, st.pending.candidates); E.confirm(st, { op: 'crease' });
   const sid = st.recipe.steps[st.recipe.steps.length - 1].id;
   const got = LEG.lines.map(ln => { const bs = st.cache.bonds.filter(b => b.stepId === sid && b.faceIds.every(id => id.startsWith(ln.faceId + '/')));
    return { layer: layerOf[ln.faceId], n: bs.length, on: bs.filter(b => b.seg.every(p => distLine(p, ln.mat[0], ln.mat[1]) < 1e-9)).length, kind: [...new Set(bs.map(b => b.kind))].join('/') } });
   say(`    確定：${chosen}・手 ${sid}／⑬の折り目：` + got.sort((x, y) => x.layer - y.layer).map(g => `層${g.layer} ${g.on}/${g.n}(${g.kind})`).join('・'));
   resB.b2 = { recipe: C(st.recipe), sid };
   checks(st, '(b2)', 1);
  }
 } catch (e) { say(`    断る「${e.message}」`) }
}

/* ================= (c) 胴の片側を「背を開く」で開く ================= */
say('\n## (c) (b) の紙で、胴の片側を「背を開く」で開く（付け根の背＝中心線の上の背）');
const cdir = CUT.meta.centerDir, onCenter = p => Math.abs((p[0] - tip[0]) * cdir[1] - (p[1] - tip[1]) * cdir[0]) < 1e-9;
const resC = {};
for (const [key, rb] of Object.entries(resB)) {
 for (const flipped of [false, true]) {
  const st = load(rb.recipe);
  if (flipped) E.flip(st, 'v');
  const tipNow = flipped ? null : tip;
  const rows = E.hingeIntervals(st).filter(h => h.visible && h.consistent && h.seg.every(p => {
   /* 裏返した紙では中心線も写る：中心線＝⑫の紙の中心線を、紙の置かれ方で写したもの＝どの面でも素材座標で同じ線。ここでは結びの素材座標で見る */
   return true }));
  /* 中心線の上の背：結びの素材座標が、どれか1つの面で中心線（いまの座標）に乗る背。裏返しでは写した座標で見る */
  const center = rows.filter(h => { const f = st.cache.faces.find(v => v.faceId === h.faceIds[0]); if (!f) return false;
   const src = h.seg.map(p => p); const f0 = st0.cache.faces.find(g => h.faceIds[0] === g.faceId || h.faceIds[0].startsWith(g.faceId + '/'));
   if (!f0) return false; const mat = h.seg.map(p => inv(f.xf, p)), was = mat.map(p => apply(f0.xf, p)); return was.every(onCenter) });
  say(`  [${key}${flipped ? '・裏返して' : ''}] 見える背 ${rows.length}・そのうち中心線の上 ${center.length}`);
  for (const h of center) {
   const tried = [];
   for (const fid of h.faceIds) { const f = st.cache.faces.find(v => v.faceId === fid); if (!f) continue;
    const at = cen(f.poly), top = E.stackAt(st, at)[0]; if (!top || top.faceId !== fid) { tried.push(`${nameOf(st, fid)}：いちばん上でない`); continue }
    const probe = load(st.recipe);
    try { E.proposeOpen(probe, E.hingeIntent(probe, h.intervalId), at); const k = E.pendingCheck(probe);
     if (!k.ok) { tried.push(`${nameOf(probe, fid)}：pendingCheck「${k.reason}」`); continue }
     const ids = probe.pending.candidates.map(c => c.faceId);
     E.select(probe, probe.pending.candidates); E.confirm(probe, { op: 'fold' });
     /* 脚の先の8層（⑬の先の側の面）がどう分かれたか */
     const legTipIds = probe.cache.faces.filter(v => LEG.faceIds.some(r => v.faceId.startsWith(r + '/')) && v.faceId.split('/').slice(-1)[0].startsWith('s' + rb.sid.slice(1) + '.') ).map(v => v.faceId);
     const tips = legTipIds.filter(id => /\.cut$/.test(id) || /\.keep$/.test(id));
     const mv = new Set(ids);
     const moved = [...new Set(LEG.faceIds.filter(r => ids.some(id => id === r || id.startsWith(r + '/'))).map(r => layerOf[r]))].sort((a, b) => a - b);
     const stay = [...new Set(LEG.faceIds.filter(r => !ids.some(id => id === r || id.startsWith(r + '/'))).map(r => layerOf[r]))].sort((a, b) => a - b);
     tried.push(`${nameOf(probe, fid)} から開く：**通る**（動いた面 ${ids.length}・うち脚1 ${ids.filter(id => LEG.faceIds.some(r => id === r || id.startsWith(r + '/'))).length}／脚1の層：動く ${moved.join(',') || 'なし'}・止まる ${stay.join(',') || 'なし'}）`);
     if (!resC[key + (flipped ? '-flip' : '')]) resC[key + (flipped ? '-flip' : '')] = { recipe: C(probe.recipe), hinge: h.intervalId, moved, stay, ids, from: fid };
    } catch (e) { tried.push(`${nameOf(probe, fid)}：断る「${e.message}」`) }
   }
   say(`    背 ${h.intervalId}（${h.faceIds.map(id => nameOf(st, id)).join('|')}）：` + tried.join('／'));
  }
 }
}
for (const [k, r] of Object.entries(resC)) { const st = load(r.recipe); checks(st, `(c) ${k}`, 1) }
/* ---- (c') 見えない背も含め、中心線の上の背ぜんぶで「一緒に動く紙」を engine と同じ辿り方で数え、輪になる結びを示す ---- */
say("\n## (c') 中心線の上の背ぜんぶ（見えない背も）：一緒に動く紙の集合と、背の相手へ回り込む結びの道");
const EPS = 1e-7;
function inMoving(all, bd, a, b) {/* engine の bondInMovingSide と同じ式（読むだけ） */
 const fx = all.find(v => v.faceId === bd.faceIds[0]), fy = all.find(v => v.faceId === bd.faceIds[1]); if (!fx || !fy) return false;
 const nd = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, sideN = q => E.side(q, a, b) / nd;
 const cur = bd.seg.map(q => apply(fx.xf, q));
 if (sideN(cur[0]) >= -1e-9 && sideN(cur[1]) >= -1e-9) return false;
 const u = E.side(cur[0], a, b), v = E.side(cur[1], a, b);
 let cut;
 if (u >= -EPS && v >= -EPS) cut = null; else if (u <= EPS && v <= EPS) cut = cur; else { const t = u / (u - v), z = [cur[0][0] + (cur[1][0] - cur[0][0]) * t, cur[0][1] + (cur[1][1] - cur[0][1]) * t]; cut = u > 0 ? [z, cur[1]] : [cur[0], z] }
 return !!(cut && dist(cut[0], cut[1]) > 1e-7);
}
function moveSet(cache, startId, a, b) {/* movingSetOf と同じ辿り方＋どの結びで入ったか */
 const set = new Set([startId]), q = [startId], via = { [startId]: null };
 while (q.length) { const x = q.shift();
  for (const bd of cache.bonds) { if (!bd.faceIds.includes(x)) continue; const y = bd.faceIds.find(id => id !== x);
   if (y === undefined || set.has(y) || !inMoving(cache.faces, bd, a, b)) continue; set.add(y); q.push(y); via[y] = { from: x, bd } } }
 return { set, via };
}
for (const [key, rb] of Object.entries(resB)) {
 const st = load(rb.recipe);
 const rows = E.hingeIntervals(st).filter(h => h.consistent && h.seg.every(onCenter));
 say(`  [${key}] 中心線の上の背 ${rows.length}（見える ${rows.filter(h => h.visible).length}）`);
 for (const h of rows) {
  const parts = [];
  for (const fid of h.faceIds) {
   const f = st.cache.faces.find(v => v.faceId === fid), w = E.wholeSideOf(f.poly, h.seg[0], h.seg[1]);
   if (!w) { parts.push(`${nameOf(st, fid)} 側：背の両側にまたがる面`); continue }
   const other = h.faceIds.find(id => id !== fid), { set, via } = moveSet(st.cache, fid, w[0], w[1]);
   const legN = [...set].filter(id => LEG.faceIds.some(r => id === r || id.startsWith(r + '/'))).length;
   if (!set.has(other)) { parts.push(`${nameOf(st, fid)} 側：集合 ${set.size}面（脚1 ${legN}・ほか ${set.size - legN}）＝**輪にならない**`); continue }
   const path = []; let y = other; while (via[y]) { path.push(via[y]); y = via[y].from }
   path.reverse();
   parts.push(`${nameOf(st, fid)} 側：集合 ${set.size}面で相手 ${nameOf(st, other)} に届く＝輪。道 ` + path.map(v => `${nameOf(st, v.from)}→${nameOf(st, v.bd.faceIds.find(id => id !== v.from))}（${v.bd.kind}・手${v.bd.stepId}）`).join(' → '));
  }
  say(`    背 ${h.intervalId}${h.visible ? '' : '（見えない）'} ${h.faceIds.map(id => nameOf(st, id)).join('|')}：` + parts.join('／'));
 }
 break;/* b1-V と b2 は同じ結果になるはずなので、1つで見る（下で b2 も数だけ確かめる） */
}


fs.writeFileSync(path.join(DIR, 'crane13_steps_probe.log'), out.join('\n') + '\n');
fs.writeFileSync(path.join(DIR, 'crane13_steps_probe.json'), JSON.stringify({ a: Object.fromEntries(Object.entries(resA).map(([k, v]) => [k, { sid: v.sid, recipe: v.recipe }])), b: resB, c: resC }));
say('\n→ crane13_steps_probe.log ／ crane13_steps_probe.json');

/* ---- (c'') 輪にならない背（見えない背を含む）を、engine の proposeOpen に直接渡して開く ---- */
say("\n## (c'') 輪にならない中心線の背を proposeOpen に直接渡す（画面は見える背しかつかめない＝ここは API で直接）");
const resC2 = {};
for (const [key, rb] of Object.entries(resB)) {
 const st = load(rb.recipe);
 const rows = E.hingeIntervals(st).filter(h => h.consistent && h.seg.every(onCenter));
 for (const h of rows) {
  for (const fid of h.faceIds) {
   const f = st.cache.faces.find(v => v.faceId === fid), w = E.wholeSideOf(f.poly, h.seg[0], h.seg[1]); if (!w) continue;
   const other = h.faceIds.find(id => id !== fid), { set } = moveSet(st.cache, fid, w[0], w[1]);
   if (set.has(other)) continue;
   const ats = [...set].map(id => cen(st.cache.faces.find(v => v.faceId === id).poly)).filter(p => { const t = E.stackAt(st, p)[0]; return t && set.has(t.faceId) });
   let res = null, last = '指せる場所が無い（どの面の重心でも、いちばん上がこの集合の面でない）';
   for (const at of ats) {
    const probe = load(st.recipe);
    try { E.proposeOpen(probe, E.hingeIntent(probe, h.intervalId), at); const k = E.pendingCheck(probe);
     if (!k.ok) { last = `pendingCheck「${k.reason}」`; continue }
     const ids = probe.pending.candidates.map(c => c.faceId); E.select(probe, probe.pending.candidates); E.confirm(probe, { op: 'fold' });
     res = { probe, ids, at }; break;
    } catch (e) { last = `断る「${e.message}」` }
   }
   const legIds = id => LEG.faceIds.find(r => id === r || id.startsWith(r + '/'));
   if (!res) { say(`  [${key}] 背 ${h.intervalId}${h.visible ? '' : '（見えない）'} を ${nameOf(st, fid)} 側（${set.size}面）で開く：${last}`); continue }
   const legMoved = res.ids.filter(legIds).map(id => nameOf(res.probe, id)).sort();
   const legStay = res.probe.cache.faces.map(v => v.faceId).filter(id => legIds(id) && !res.ids.includes(id)).map(id => nameOf(res.probe, id)).sort();
   say(`  [${key}] 背 ${h.intervalId}${h.visible ? '' : '（見えない）'} を ${nameOf(st, fid)} 側から開く：**通る**（動いた面 ${res.ids.length}：脚1 ${legMoved.length}＝${legMoved.join(' ')}／胴等 ${res.ids.length - legMoved.length}）`);
   say(`      止まった脚1の面：${legStay.join(' ')}`);
   const k2 = key + ':' + h.intervalId + ':' + nameOf(st, fid);
   resC2[k2] = { recipe: C(res.probe.recipe), ids: res.ids, sid: rb.sid };
   checks(res.probe, `(c'') ${k2}`, 1);
  }
 }
}
fs.writeFileSync(path.join(DIR, 'crane13_steps_probe.log'), out.join('\n') + '\n');
fs.writeFileSync(path.join(DIR, 'crane13_steps_probe.json'), JSON.stringify({ a: Object.fromEntries(Object.entries(resA).map(([k, v]) => [k, { sid: v.sid, recipe: v.recipe }])), b: resB, c: resC, c2: resC2 }));

/* ================= (d) 開いた紙で、⑬の折り目に沿って折り直す ================= */
say("\n## (d) 開いた紙で、⑬の折り目に沿って各層を折り直す（目標：下4層の先は下4層の元の上へ・上4層の先は開いた側で元の上へ＝閉じたあと2つのかたまりのあいだ）");
const resD = {};
for (const key of Object.keys(resC2).filter(k => k.includes('s2#3') || k.includes('s2#1'))) {
 const st = load(resC2[key].recipe), sid = resC2[key].sid;
 /* 開いた紙での⑬の折り目の線（結びの線をいまの座標へ）。脚1の下4層と上4層で分ける */
 const moved = new Set(resC2[key].ids);
 const lines = { 下: [], 上: [] };
 for (const b of st.cache.bonds.filter(b => b.stepId === sid)) {
  const f = st.cache.faces.find(v => v.faceId === b.faceIds[0]); const seg = b.seg.map(p => apply(f.xf, p));
  lines[b.faceIds.some(id => moved.has(id)) ? '上' : '下'].push(seg) }
 const col = segs => segs.every(s => s.every(p => distLine(p, segs[0][0], segs[0][1]) < 1e-9));
 say(`  [${key}] ⑬の折り目：下4層 ${lines.下.length}本（1本の直線 ${col(lines.下)}）・上4層 ${lines.上.length}本（1本の直線 ${col(lines.上)}）／2本の直線のなす角 ` +
  (() => { const u = [lines.下[0][1][0] - lines.下[0][0][0], lines.下[0][1][1] - lines.下[0][0][1]], v = [lines.上[0][1][0] - lines.上[0][0][0], lines.上[0][1][1] - lines.上[0][0][1]];
   return (Math.acos(Math.abs(u[0] * v[0] + u[1] * v[1]) / Math.hypot(...u) / Math.hypot(...v)) * 180 / Math.PI).toFixed(4) + '°' })());
 for (const half of ['下', '上']) {
  let [a, b] = lines[half][0];
  /* 先の側：脚1のその半分の先の面の重心の側 */
  const tipFaces = st.cache.faces.filter(v => LEG.faceIds.some(r => v.faceId.startsWith(r + '/')) && /\.cut$/.test(v.faceId.split('/').pop()) === false && (moved.has(v.faceId) === (half === '上')));
  const tipsOfHalf = st.cache.faces.filter(v => LEG.faceIds.some(r => v.faceId.startsWith(r + '/')) && (moved.has(v.faceId) === (half === '上')));
  const tipSide = tipsOfHalf.map(v => cen(v.poly)).find(p => distLine(p, a, b) > .03 && E.side(p, a, b) * E.side(tip, lines.下[0][0], lines.下[0][1]) !== 0);
  /* 先の面＝その半分の脚の面のうち、⑬の線の「脚の先端がある側」。下は先端そのもの、上は開いたので先端の鏡像の側 */
  const tipPts = tipsOfHalf.filter(v => nameOf(st, v.faceId).endsWith('·先')).map(v => cen(v.poly));
  if (!tipPts.length) { say(`    ${half}4層：先の面が見つからない`); continue }
  const sp = tipPts.map(p => ({ p, top: E.stackAt(st, p)[0] })).find(v => v.top && tipsOfHalf.some(w => w.faceId === v.top.faceId));
  if (!sp) { say(`    ${half}4層：先の面の重心で、いちばん上がその半分の脚の面になる所が無い`); continue }
  if (E.side(sp.p, a, b) > 0) [a, b] = [b, a];
  for (const kind of ['V', 'M']) {
   const probe = load(st.recipe);
   const tries = [];
   try { E.proposeOnFace(probe, a, b, sp.top.faceId, { layers: 1, op: 'fold' }); probe.pending.kind = kind; E.setSide(probe, sp.p) }
   catch (e) { say(`    ${half}4層 ${kind === 'V' ? '谷' : '山'}：提案で断る「${e.message}」`); continue }
   const opts = [['つながっているフラップ', () => E.setFlap(probe, probe.pending.at)], ['この側を全部', () => E.setSideAll(probe)]];
   const L = E.layersAt(probe, probe.pending.at).layers.length;
   for (let n = 1; n <= L; n++) opts.push([`上から${n}枚`, () => E.setLayers(probe, n, probe.pending.at)]);
   let ok = null;
   for (const [nm, fn] of opts) { try { fn(); const ids = probe.pending.candidates.map(c => c.faceId); tries.push(`${nm}：通る（${ids.length}面：${ids.map(id => nameOf(probe, id)).sort().join(' ')}）`); if (!ok) ok = [nm, fn, ids] }
    catch (e) { tries.push(`${nm}：断る「${e.message}」`) } }
   say(`    ${half}4層 ${kind === 'V' ? '谷' : '山'}（動く側の点 ${JSON.stringify(r4(sp.p))}・その場所の層 ${L}）：` + tries.join('／'));
  }
 }
}
fs.writeFileSync(path.join(DIR, 'crane13_steps_probe.log'), out.join('\n') + '\n');

/* ---- (d') 止まった理由の中身：裂ける結び・通る選び方が新しい折り目を作るか ---- */
say("\n## (d') (d) の止まった理由の中身（開いた紙 b2:hinge:s2#3 で）");
{
 const key = Object.keys(resC2).find(k => k.startsWith('b2:') && k.includes('s2#3'));
 const st = load(resC2[key].recipe), sid = resC2[key].sid, moved = new Set(resC2[key].ids);
 const legRoot = id => LEG.faceIds.find(r => id === r || id.startsWith(r + '/'));
 for (const half of ['下', '上']) {
  const segs = st.cache.bonds.filter(b => b.stepId === sid && b.faceIds.some(id => moved.has(id)) === (half === '上'))
   .map(b => b.seg.map(p => apply(st.cache.faces.find(v => v.faceId === b.faceIds[0]).xf, p)));
  let [a, b] = segs[0];
  const tips = st.cache.faces.filter(v => legRoot(v.faceId) && nameOf(st, v.faceId).endsWith('·先') && moved.has(v.faceId) === (half === '上'));
  if (E.side(cen(tips[0].poly), a, b) > 0) [a, b] = [b, a];
  for (const kind of ['V', 'M']) {
   const r = E.foldableSet(st.cache.faces, st.cache.bonds, tips.map(v => v.faceId), a, b, kind);
   say(`  ${half}4層の先4面だけを⑬の線（${half}）で${kind === 'V' ? '谷' : '山'}：${r.ok ? '通る' : '断る「' + r.reason + '」'}` + (r.ok ? '' : `・止めた面 ${r.blocking.map(id => nameOf(st, id)).join(' ')}`));
   if (!r.ok && /裂け/.test(r.reason)) {
    /* 裂ける結び＝選んだ面と選ばなかった面をつなぎ、動く側の内部に入る結び */
    const set = new Set(tips.map(v => v.faceId));
    const torn = st.cache.bonds.filter(bd => (set.has(bd.faceIds[0]) !== set.has(bd.faceIds[1])) && inMoving(st.cache.faces, bd, a, b));
    say(`    裂ける結び：` + torn.map(bd => `${nameOf(st, bd.faceIds[0])}|${nameOf(st, bd.faceIds[1])}（${bd.kind}・手${bd.stepId}${bd.openedBy ? '・開いた手 ' + bd.openedBy : ''}）`).join('／'));
   }
  }
  /* 通る選び方（フラップ）は、⑬の線で「いまの結びの無い所」を切るか＝新しい折り目ができるか */
  const flap = [...moveSet(st.cache, E.stackAt(st, cen(tips[0].poly))[0].faceId, a, b).set];
  const fresh = flap.filter(id => { const f = st.cache.faces.find(v => v.faceId === id), p = E.split(f.poly, a, b); return p[0] && p[1] && E.area(p[0]) > 1e-9 && E.area(p[1]) > 1e-9 });
  say(`  ${half}の⑬の線で「つながっているフラップ」（${flap.length}面）：線が面の中を通って新しく割る面 ${fresh.length}（${fresh.map(id => nameOf(st, id)).join(' ')}）`);
 }
}
fs.writeFileSync(path.join(DIR, 'crane13_steps_probe.log'), out.join('\n') + '\n');
