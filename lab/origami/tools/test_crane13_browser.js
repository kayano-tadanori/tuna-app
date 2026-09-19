'use strict';
/* 実Chrome：つる⑬（脚2本の中割り）→ ⑭（頭の中割り）を、画面の操作だけで（2026-09-19・recipe_crane13.md 第24段）。
   新しい紙 → ⑫（test_crane12_browser.js と同じ操作。その続きとしてここを走らせる）
   → 画面を大きくしてズーム（カメラ操作）→「折り目を引く」で⑬の線を2点で引く →「この線で中割り」→ 脚の先を指す
   → 背は1本に自動で決まる → 途中（スライダー）＝engine の運動と同じ → 確定 ×2
   → 視点を回す（カメラ操作）→ ⑭の線（ORIPA の頭の線を⑬のあとの面で写したもの）→ 中割り → 根元の頂点もいっしょに動く → 確定
   → engine で同じ線・同じ所を指した紙と、素材の点ごとに同じ → 保存 → 再読込 → undo/redo
   → 新しい紙：半分に折って線を引き、くさびが鈍角の側を指すと「反対側の先をつかんでください」で断る（原本は変わらない）。
   🚨線・タップ・確定・保存・undo/redo はボタンと紙のしぐさで行う。線の端やタップの場所は engine の読み取り（素材の線を写す・面の重心）で決める。
     コンソールで書くのは「再読込したページへ保存原本を入れる」1か所だけ（test_crane12_browser と同じ）。
   ⛔ 厚みは0。
   使い方： node test_crane13_browser.js   （⑫までの操作を含むので数分かかる）
*/
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const CUT = JSON.parse(fs.readFileSync(path.join(DIR, 'crane13_cutline.json'), 'utf8')), HL = JSON.parse(fs.readFileSync(path.join(DIR, 'crane14_headline.json'), 'utf8'));
const TIP = JSON.parse(fs.readFileSync(path.join(DIR, 'crane13_input.json'), 'utf8')).landmarks.legTip;

require(path.join(DIR, 'test_crane12_browser.js')).run(async c => {
 const { ev, cdp, point, press, moveTo, release, tap, clickBtn, btn, status, recipe, shot, shots, downloads, mark, sleep, poll, dist } = c;
 const fsp = require('node:fs/promises');
 const hover = q => cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q[0], y: q[1], button: 'none', buttons: 0 });
 const hashNow = () => ev('freeFoldDebug.state.cache.hash');
 const r12 = await recipe(), h12 = await hashNow();
 /* 始点 p0・終点 p1 で線を引いたとき、入力層（freefold_snap）が吸着しないか（読むだけ）。crease=true なら「折り目を引く」の関門も通ること。
    ＝狙った直線そのものが引ける所を選ぶ。 */
 const lineOk = (p0, p1, crease) => ev(`(() => { const st = freeFoldDebug.state, N = FreeFoldSnap, E = FreeFoldEngine, view = { toScreen: q => freeFoldDebug.project([q[0], 0, -q[1]]) };
  const p0 = ${JSON.stringify(p0)}, p1 = ${JSON.stringify(p1)};
  if (!E.stackAt(st, p0).length) return false;
  const s0 = N.freeCreaseStart(st, view.toScreen(p0), p0, view); if (!s0.point || s0.snapped) return false;
  const a = N.linePointAim(s0.corners, s0.guides, view.toScreen(p1), p1, view, false); if (a.snapped) return false;
  if (!${!!crease}) return true;
  try { N.freeCreaseLine(st, { ...s0 }, a.point); return true } catch { return false } })()`);
 /* 線を2点で引く。onSeg＝狙った線分の中（首の上など）から引きはじめる（折り目の関門は問わない）／そうでなければ関門も通る所を直線の上で探す */
 const drawLine = async (A, B, label, onSeg) => {
  const u = [(B[0] - A[0]) / dist(A, B), (B[1] - A[1]) / dist(A, B)], L0 = dist(A, B);
  const ks = [.5, .45, .55, .4, .6, .35, .65, .3, .7]; if (!onSeg) for (let t = .1; t <= 1.5; t += .05) ks.push(1 + t / L0, -t / L0);
  let p0 = null, p1 = null;
  for (const k of ks) { const q = [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k];
   for (const L of [.12, -.12, .16, -.16, .2, -.2, .25, -.25, .3, -.3, .4, -.4]) { const r = [q[0] + u[0] * L, q[1] + u[1] * L];
    if (dist(await point(q), await point(r)) > 60 && await lineOk(q, r, !onSeg)) { p0 = q; p1 = r; break } }
   if (p0) break }
  assert.ok(p0, `${label}：狙った直線を引ける始点・終点が無い`);
  await press(await point(p0)); await moveTo(await point([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2])); await moveTo(await point(p1)); await release(await point(p1));
  await poll(async () => !(await btn('reverseFold')).hidden, `${label}：「この線で中割り」が出る: ` + await status());
  /* 引いた線（いまの座標）と、狙った線のずれ。折り目にならない線は lineDraft に入る */
  const draft = await ev('freeFoldDebug.lineDraft && freeFoldDebug.lineDraft.line'), got = draft || await ev('freeFoldDebug.state.pending.displayLine');
  return { off: Math.max(...[A, B].map(q => Math.abs((q[0] - got[0][0]) * (got[1][1] - got[0][1]) - (q[1] - got[0][1]) * (got[1][0] - got[0][0])) / dist(got[0], got[1]))), draft: !!draft, p0 };
 };
 /* 頭の中割り：首の上から線を引き（折り目の関門で断られる線＝入口の手直し①）→「この線で中割り」→ 首の先を**線のすぐ近く**で指す（②＝動く側の印は画面が導く）→ 途中 → 確定 */
 const revIds13 = () => ev(`freeFoldDebug.state.recipe.steps.filter(s => s.op === 'reverse').map(s => s.id)`);
 const doHead = async (A, B, label, extra) => {
  const d = await drawLine(A, B, label, true);
  assert.ok(d.draft, `${label}：首の上から引いた線が、折り目の関門で断られていない（入口の手直しを確かめる前提が崩れた）`);
  assert.match(await status(), /「この線で中割り」なら使えます/, `${label}：折り目にならない線の案内`);
  await clickBtn('reverseFold');
  const ids = await revIds13();
  const near = await ev(`(() => { const st = freeFoldDebug.state, E = FreeFoldEngine, RL = freeFoldDebug.reverse.line, L = Math.hypot(RL[1][0]-RL[0][0], RL[1][1]-RL[0][1]);
   const ap = (m, p) => [m[0]*p[0]+m[1]*p[1]+m[4], m[2]*p[0]+m[3]*p[1]+m[5]], cen = p => p.reduce((s, v) => [s[0] + v[0] / p.length, s[1] + v[1] / p.length], [0, 0]);
   for (const sid of ${JSON.stringify(ids)}) { const rb = st.cache.bonds.find(x => x.reversedBy && x.reversedBy.includes(sid)); if (!rb) continue; const fa = st.cache.faces.find(f => f.faceId === rb.faceIds[0]), seg = rb.seg.map(m => ap(fa.xf, m));
    if (E.side(seg[0], RL[0], RL[1]) * E.side(seg[1], RL[0], RL[1]) >= 0) continue;
    const V = ${JSON.stringify(CUT.legs[0].V)}, tip = Math.hypot(seg[0][0]-V[0], seg[0][1]-V[1]) < 1e-9 ? seg[1] : seg[0];
    for (const f of st.cache.faces) { if (!f.faceId.includes('/' + sid + '.cut')) continue;
     for (const p of E.split(f.poly, RL[0], RL[1]).filter(Boolean)) { const c = cen(p), dn = E.side(c, RL[0], RL[1]) / L; if (dn * E.side(tip, RL[0], RL[1]) <= 0) continue;
      /* 線の上にある、その面の区間の中点 m から、重心の側へ（線からの距離 0.006 まで）入った点 */
      const on = p.filter(v => Math.abs(E.side(v, RL[0], RL[1])) / L < 1e-9); if (on.length < 2) continue;
      const m = cen(on), k = .006 / Math.abs(dn); if (k >= 1) continue;
      const q = [m[0] + (c[0] - m[0]) * k, m[1] + (c[1] - m[1]) * k]; if (!E.stackAt(st, q).length) continue;
      /* 指す所のいちばん上が首の先の面であること（engine の候補の関門＝線から離れた所、はここでは通らない所を指す） */
      const top = E.stackAt(st, q)[0]; if (top && top.faceId.includes('/' + sid + '.cut')) return { at: q, S: Math.abs(E.side(q, RL[0], RL[1])), N: Math.abs(E.side(q, RL[0], RL[1])) / L, root: sid, RL,
       direct: E.reverseOptions(st, RL[0], RL[1], q).options.length } } } } return null })()`);
  assert.ok(near, `${label}：線のすぐ近くの指す所が無い`);
  assert.equal(near.direct, 0, `${label}：指す所が、そのままでも候補が出る所になっている（入口の手直しを確かめる前提が崩れた）`);
  assert.ok(near.S < .03, `${label}：指す所が線に近くない（既存の関門「折線から離れた側」でそのままでは断られる所を指すはず：${near.S}）`);
  await tap(await point(near.at));
  await poll(async () => (await ev('freeFoldDebug.reverse && freeFoldDebug.reverse.phase')) === 'preview', `${label}：プレビューにならない: ` + await status());
  const rv = await ev('freeFoldDebug.reverse');
  assert.equal(rv.root && rv.root.stepId, near.root, `${label}：根元の頂点（⑬の頂点）がいっしょに動かない: ` + JSON.stringify(rv));
  assert.ok(rv.side && dist(rv.side, near.at) > 1e-6, `${label}：動く側の印が、指した点のまま`);
  assert.match(await status(), /根元の頂点（s\d+）もいっしょに動きます/, `${label}：根元の頂点の案内が出ない: ` + await status());
  await previewMatches(label, extra ? [.1, 1 / 3, .6, .9, 1] : [.5, 1]);
  if (extra) await extra();
  await clickBtn('confirm');
  const r = await recipe();
  assert.equal(r.steps.slice(-1)[0].op, 'reverse', `${label}：中割りの1手が入らない: ` + await status());
  assert.equal(await ev('FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash'), true, `${label}：表示と原本の再生が違う`);
  const tm = await ev('freeFoldDebug.revTiming');
  return { off: d.off, side: rv.side, RL: near.RL, root: near.root, tm, line: r.steps.slice(-1)[0].line };
 };
 /* ⑬のつかむ所（R3 と同じ決め方）：脚の面の、線より先の部分の重心で、いちばん上が脚の面の所 */
 const grabLeg = (LEG, A, B) => ev(`(() => { const st = freeFoldDebug.state, E = FreeFoldEngine, A = ${JSON.stringify(A)}, B = ${JSON.stringify(B)}, tip = ${JSON.stringify(TIP)}, ids = ${JSON.stringify(LEG.faceIds)};
  const d = Math.hypot(B[0]-A[0], B[1]-A[1]);
  for (const id of ids) { const f = st.cache.faces.find(v => v.faceId === id); if (!f) continue;
   for (const p of E.split(f.poly, A, B).filter(Boolean)) { const c = p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]); const t = E.stackAt(st, c)[0];
    if (t && ids.includes(t.faceId) && E.side(c, A, B) * E.side(tip, A, B) > 0 && Math.abs(E.side(c, A, B)) / d > .05) return c } } return null })()`);
 /* 途中の姿：画面が描いた多角形＝engine の reversePreview の frame(t) */
 const previewMatches = async (label, ratios) => {
  const rs = await ev('(() => { const q = document.getElementById("revT").getBoundingClientRect(); return { l: q.left, w: q.width, y: q.top + q.height / 2 } })()');
  for (const ratio of ratios) {
   await tap([rs.l + 8 + (rs.w - 16) * ratio, rs.y]);
   const f = await ev('freeFoldDebug.frame.reverse');
   assert.equal(f.drawnBy, f.t > 0 && f.t < 1 ? 'engine-frame' : 'engine-layers', `${label}：途中の描き方`);
   if (f.drawnBy === 'engine-frame') {
    const want = await ev(`FreeFoldEngine.reversePreview(freeFoldDebug.state).frame(${f.t}).map(q => ({ faceId: q.faceId, part: q.part, pts: q.pts }))`);
    assert.equal(f.polys.length, want.length, `${label}：途中の多角形の数が engine と違う`);
    let w = 0; f.polys.forEach((q, i) => { assert.equal(q.faceId + q.part, want[i].faceId + want[i].part); q.pts.forEach((p, j) => { w = Math.max(w, Math.hypot(p[0] - want[i].pts[j][0], p[1] - want[i].pts[j][1], p[2] - want[i].pts[j][2])) }) });
    assert.ok(w < 1e-12, `${label}：途中の座標が engine と違う（${w}）`) }
   const roles = f.paint.map(v => v.role + ':' + v.color);
   assert.ok(roles.includes('target:#62e6a7') && roles.includes('grab:#ffd34e'), `${label}：色の約束（黄＝つかんだ・緑＝行き先）が無い: ` + roles.join(' '));
  }
 };
 /* 素材の点ごとの置かれ方（xf）の差の最大（読むだけ） */
 const cmpWith = rec => ev(`(() => { const a = freeFoldDebug.state.cache, b = FreeFoldEngine.replay(${JSON.stringify(rec)});
  const inv = (m, p) => { const d = m[0]*m[3]-m[1]*m[2], x = p[0]-m[4], y = p[1]-m[5]; return [(m[3]*x-m[1]*y)/d, (-m[2]*x+m[0]*y)/d] }, ap = (m, p) => [m[0]*p[0]+m[1]*p[1]+m[4], m[2]*p[0]+m[3]*p[1]+m[5]];
  let worst = 0, n = 0, flip = 0; for (let i = 0; i < 81; i++) for (let j = 0; j < 81; j++) { const p = [-1 + i / 40 + 1e-4, -1 + j / 40 + 2e-4];
   const fa = a.faces.find(f => FreeFoldEngine.inside(p, f.poly.map(q => inv(f.xf, q)))), fb = b.faces.find(f => FreeFoldEngine.inside(p, f.poly.map(q => inv(f.xf, q))));
   if (!fa || !fb) continue; n++; const u = ap(fa.xf, p), v = ap(fb.xf, p); worst = Math.max(worst, Math.hypot(u[0]-v[0], u[1]-v[1]));
   if (Math.sign(FreeFoldEngine.detXf(fa.xf)) !== Math.sign(FreeFoldEngine.detXf(fb.xf))) flip++ } return { worst, n, flip, fa: a.faces.length, fb: b.faces.length } })()`);
 /* engine で同じ線・同じ所を指した中割り（読むだけの別の紙で） */
 const engineReverse = (rec, lines) => ev(`(() => { const E = FreeFoldEngine, st = E.create(); st.recipe = JSON.parse(JSON.stringify(${JSON.stringify(rec)})); st.cache = E.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache;
  for (const L of ${JSON.stringify(lines)}) { E.proposeReverse(st, L.A, L.B, L.at); E.confirm(st) } return st.recipe })()`);

 mark('15 画面を大きくしてズーム（カメラ操作）');
 await cdp('Emulation.setDeviceMetricsOverride', { width: 2400, height: 2000, deviceScaleFactor: 1, mobile: false });
 await sleep(300);
 for (let i = 0; i < 14; i++) await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 2300, y: 1900, deltaX: 0, deltaY: -200 });
 assert.ok(await ev('freeFoldDebug.camera.zoom') > 2.4, '15 ズームできない');
 assert.equal(await hashNow(), h12, '15 カメラ操作で紙が変わった');
 shots.push(await shot('crane13-0-zoom.png'));

 mark('16 ⑬：脚2本を「折り目を引く」→「この線で中割り」→ 脚の先を指す → 途中 → 確定');
 await clickBtn('lineMode');
 const lines13 = [], offs = [];
 for (const legno of [1, 2]) {
  const LEG = CUT.legs.find(l => l.leg === legno), A = LEG.curLine.a, B = LEG.curLine.b, label = `16 脚${legno}`;
  const off = (await drawLine(A, B, label)).off; offs.push(off);
  const s0 = await c.snapState();
  await clickBtn('reverseFold');
  assert.equal(await ev('freeFoldDebug.reverse && freeFoldDebug.reverse.phase'), 'grab', `${label}：先を指す段にならない`);
  assert.match(await status(), /先の側の紙を、画面で指して/, `${label}：案内`);
  const at = await grabLeg(LEG, A, B); assert.ok(at, `${label}：つかむ所が無い`);
  await hover(await point(at));
  const hv = await ev('freeFoldDebug.frame.reverse.paint.map(v => v.role + ":" + v.color)');
  assert.ok(hv.includes('hover:#ffffffaa'), `${label}：ホバーが白で出ない: ` + hv.join(' '));
  await tap(await point(at));
  await poll(async () => (await ev('freeFoldDebug.reverse && freeFoldDebug.reverse.phase')) === 'preview', `${label}：プレビューにならない: ` + await status());
  const rv = await ev('freeFoldDebug.reverse');
  assert.deepEqual([rv.options.length, rv.options[0].stepId, rv.root], [1, 's2', null], `${label}：背の候補・根元が違う: ` + JSON.stringify(rv));
  assert.equal(JSON.stringify((await recipe())), JSON.stringify(JSON.parse(s0).r), `${label}：プレビューだけで原本が変わった`);
  await previewMatches(label, [.15, .5, .85, 1]);
  if (legno === 1) shots.push(await shot('crane13-1-leg1-preview.png'));
  await clickBtn('confirm');
  const r = await recipe();
  assert.equal(r.steps.slice(-1)[0].op, 'reverse', `${label}：中割りの1手が入らない: ` + await status());
  lines13.push({ A, B, at });
 }
 const r13 = await recipe(), h13 = await hashNow();
 assert.equal(await ev('FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash'), true, '16 表示と原本の再生が違う');
 const want13 = await engineReverse(r12, lines13), cmp13 = await cmpWith(want13);
 console.log(`    ⑬：画面で引いた線と ORIPA の線のずれ ${offs.map(v => v.toExponential(1)).join('・')}／engine（ORIPA の線そのもの）との位置の差 ${cmp13.worst.toExponential(1)}（点 ${cmp13.n}）`);
 assert.ok(cmp13.worst < 1e-6 && cmp13.flip === 0 && cmp13.fa === cmp13.fb, '16 画面の⑬が engine の⑬と違う: ' + JSON.stringify(cmp13));
 shots.push(await shot('crane13-2-legs.png'));

 mark('17 視点を回す（カメラ操作）→ ⑭：頭の線 → 中割り（根元の頂点もいっしょに動く）→ 確定');
 { const cam = await ev('[freeFoldDebug.camera.yaw, freeFoldDebug.camera.pitch]');
  await press([60, 60]); await moveTo([140, 100]); await moveTo([220, 120]); await release([220, 120]);
  assert.notDeepEqual(await ev('[freeFoldDebug.camera.yaw, freeFoldDebug.camera.pitch]'), cam, '17 視点が回らない');
  assert.equal(await hashNow(), h13, '17 視点を回して紙が変わった') }
 /* ⑭の線：ORIPA の頭の線（素材）を、いまの面の xf で写した1本の直線（R5 と同じ） */
 const head = await ev(`(() => { const st = freeFoldDebug.state, E = FreeFoldEngine, inv = (m, p) => { const d = m[0]*m[3]-m[1]*m[2], x = p[0]-m[4], y = p[1]-m[5]; return [(m[3]*x-m[1]*y)/d, (-m[2]*x+m[0]*y)/d] }, ap = (m, p) => [m[0]*p[0]+m[1]*p[1]+m[4], m[2]*p[0]+m[3]*p[1]+m[5]];
  const cur = ${JSON.stringify(HL.lines.map(l => l.mat))}.map(mat => { const m = [(mat[0][0]+mat[1][0])/2, (mat[0][1]+mat[1][1])/2]; const own = st.cache.faces.filter(f => E.inside(m, f.poly.map(p => inv(f.xf, p))));
   return own.length === 1 ? { f: own[0].faceId, seg: mat.map(p => ap(own[0].xf, p)) } : null });
  if (cur.some(v => !v)) return null;
  const P = cur.flatMap(v => v.seg), dd = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]); let a = P[0]; a = P.reduce((b, p) => dd(p, a) > dd(b, a) ? p : b, a); const b = P.reduce((q, p) => dd(p, a) > dd(q, a) ? p : q, a);
  return { a, b, faces: cur.map(v => v.f) } })()`);
 assert.ok(head, '17 ⑭の線を⑬のあとの面へ写せない');
 const h14r = await doHead(head.a, head.b, '17 ⑭', async () => {
  const rs = await ev('(() => { const q = document.getElementById("revT").getBoundingClientRect(); return { l: q.left, w: q.width, y: q.top + q.height / 2 } })()');
  await tap([rs.l + 8 + (rs.w - 16) * .5, rs.y]); shots.push(await shot('crane14-1-preview-middle.png'));
  /* 途中でも視点は回せる（紙は変わらない・描く座標は engine のまま） */
  await press([60, 60]); await moveTo([30, 140]); await release([30, 140]);
  await previewMatches('17 ⑭ 視点を回したあと', [.5]) });
 const r14 = await recipe(), h14 = await hashNow(), faces14 = await ev('freeFoldDebug.state.cache.faces.map(f => f.poly)');
 const want14 = await engineReverse(r13, [{ A: h14r.RL[0], B: h14r.RL[1], at: h14r.side }]), cmp14 = await cmpWith(want14);
 console.log(`    ⑭（首の上から引いた線・線のすぐ近くを指す）：線のずれ ${h14r.off.toExponential(1)}／engine（同じ線・同じ動く側の印）との位置の差 ${cmp14.worst.toExponential(1)}（点 ${cmp14.n}）・面 ${cmp14.fa}`);
 console.log(`    時間（PC・この画面）：動く側の印 ${h14r.tm.side.toFixed(0)}ms・提案 ${h14r.tm.propose.toFixed(0)}ms・プレビュー ${h14r.tm.preview.toFixed(0)}ms・確定 ${h14r.tm.confirm.toFixed(0)}ms`);
 assert.ok(cmp14.worst < 1e-6 && cmp14.flip === 0 && cmp14.fa === cmp14.fb, '17 画面の⑭が engine の⑭と違う: ' + JSON.stringify(cmp14));
 shots.push(await shot('crane14-2-done.png'));
 await clickBtn('lineMode');

 mark('18 保存 → 再読込 → undo/redo');
 for (const f of await fsp.readdir(downloads)) await fsp.rename(path.join(downloads, f), path.join(downloads, 'old14-' + f));
 await clickBtn('save');
 const f18 = await poll(async () => (await fsp.readdir(downloads)).find(v => v.endsWith('.origami.json') && !v.startsWith('old')), 'download14');
 const saved = JSON.parse(await fsp.readFile(path.join(downloads, f18), 'utf8'));
 assert.equal(await ev(`FreeFoldEngine.replay(${JSON.stringify(saved)}).hash`), h14, '18 保存した原本を再生すると違う');
 await cdp('Page.reload', {});
 await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reload14');
 await ev(`(() => { const st = freeFoldDebug.state, r = ${JSON.stringify(saved)}; st.recipe = r; st.cache = FreeFoldEngine.replay(r);
  st.revision = 0; st.cacheRevision = 0; st.committed = st.cache; st.redoStack = []; st.pending = null; return true })()`);
 await clickBtn('op'); await clickBtn('op');
 assert.equal(await hashNow(), h14, '18 再読込で同じ紙にならない');
 await clickBtn('undo'); assert.equal(await hashNow(), h13, '18 undo で⑬に戻らない');
 await clickBtn('undo'); await clickBtn('undo'); assert.equal(await hashNow(), h12, '18 undo 3回で⑫に戻らない');
 for (let i = 0; i < 3; i++) await clickBtn('redo');
 assert.equal(await hashNow(), h14, '18 redo 3回で⑭に戻らない');
 assert.equal(await ev('JSON.stringify(freeFoldDebug.state.recipe)'), JSON.stringify(saved), '18 undo/redo で原本の文字が変わった');
 shots.push(await shot('crane14-3-reloaded.png'));

 mark('20 位置の自由：頭の線を首の先寄り・根元寄りに平行にずらして引く → どちらも通る → 保存 → 再読込 → undo/redo');
 for (let i = 0; i < 14; i++) await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 2300, y: 1900, deltaX: 0, deltaY: -200 });
 await clickBtn('lineMode');
 const spine = await ev(`(() => { const st = freeFoldDebug.state, ap = (m, p) => [m[0]*p[0]+m[1]*p[1]+m[4], m[2]*p[0]+m[3]*p[1]+m[5]], rb = st.cache.bonds.find(x => x.reversedBy && x.reversedBy.includes('${h14r.root}')) || st.cache.bonds.find(x => x.reversedBy && x.reversedBy.includes('${h14r.root}'));
  const fa = st.cache.faces.find(f => f.faceId === rb.faceIds[0]); return rb.seg.map(m => ap(fa.xf, m)) })()`);
 const V0 = CUT.legs[0].V, tipB = dist(spine[0], V0) < 1e-6 ? spine[1] : spine[0], eB = [(tipB[0] - V0[0]) / dist(V0, tipB), (tipB[1] - V0[1]) / dist(V0, tipB)];
 const dumpB = { oripa: faces14, lines: { oripa: [head.a, head.b] } };
 for (const [name, sh] of [['首の先寄り', .08], ['根元寄り', -.15]]) {
  await clickBtn('undo'); assert.equal(await hashNow(), h13, `20 ${name}：undo で⑬に戻らない`);
  const A = [head.a[0] + eB[0] * sh, head.a[1] + eB[1] * sh], B = [head.b[0] + eB[0] * sh, head.b[1] + eB[1] * sh];
  const r = await doHead(A, B, `20 ${name}`);
  const hB = await hashNow(), recB = await recipe();
  assert.notEqual(hB, h14, `20 ${name}：ORIPA の位置と同じ紙になった`);
  for (const f of await fsp.readdir(downloads)) if (!f.startsWith('old')) await fsp.rename(path.join(downloads, f), path.join(downloads, 'old-' + sh + '-' + f));
  await clickBtn('save');
  const fB = await poll(async () => (await fsp.readdir(downloads)).find(v => v.endsWith('.origami.json') && !v.startsWith('old')), 'downloadB');
  const savedB = JSON.parse(await fsp.readFile(path.join(downloads, fB), 'utf8'));
  assert.equal(await ev(`FreeFoldEngine.replay(${JSON.stringify(savedB)}).hash`), hB, `20 ${name}：保存した原本を再生すると違う`);
  dumpB[name] = await ev('freeFoldDebug.state.cache.faces.map(f => f.poly)'); dumpB.lines[name] = [A, B];
  await cdp('Page.reload', {});
  await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reloadB');
  await ev(`(() => { const st = freeFoldDebug.state, r = ${JSON.stringify(savedB)}; st.recipe = r; st.cache = FreeFoldEngine.replay(r);
   st.revision = 0; st.cacheRevision = 0; st.committed = st.cache; st.redoStack = []; st.pending = null; return true })()`);
  await clickBtn('op'); await clickBtn('op');
  assert.equal(await hashNow(), hB, `20 ${name}：再読込で同じ紙にならない`);
  await clickBtn('undo'); assert.equal(await hashNow(), h13, `20 ${name}：再読込後の undo で⑬に戻らない`);
  await clickBtn('redo'); assert.equal(await hashNow(), hB, `20 ${name}：redo で同じ紙に戻らない`);
  assert.equal(await ev('JSON.stringify(freeFoldDebug.state.recipe)'), JSON.stringify(savedB), `20 ${name}：undo/redo で原本の文字が変わった`);
  for (let i = 0; i < 14; i++) await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 2300, y: 1900, deltaX: 0, deltaY: -200 });
  await clickBtn('lineMode');
  console.log(`    ${name}（首の背に沿って ${sh > 0 ? '+' : ''}${sh}）：通る・保存→再読込・undo/redo で同じ紙／原本の線（基準面の素材の2点）${JSON.stringify(recB.steps.slice(-1)[0].line.map(q => q.map(v => +v.toFixed(4))))}／提案 ${r.tm.propose.toFixed(0)}ms・確定 ${r.tm.confirm.toFixed(0)}ms`);
 }
 await clickBtn('lineMode');
 if (process.env.ORIGAMI_DUMP_B) fs.writeFileSync(process.env.ORIGAMI_DUMP_B, JSON.stringify(dumpB));
 shots.push(await shot('crane14-4-positions.png'));

 mark('19 新しい紙：半分に折って線を引き、くさびが鈍角の側を指す → 断る（原本は変わらない）→ 鋭角の側は通る');
 await cdp('Page.reload', {});
 await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reload-new');
 await press(await point([-1, -1])); await moveTo(await point([.1, 0])); await moveTo(await point([1, 1])); await release(await point([1, 1])); await clickBtn('confirm');
 assert.deepEqual((await recipe()).steps.map(s => s.op), ['fold'], '19 半分に折れない');
 await clickBtn('lineMode');
 await press(await point([.5, 0])); await moveTo(await point([.7, 0])); await moveTo(await point([.9, 0])); await release(await point([.9, 0]));
 await poll(async () => !(await btn('reverseFold')).hidden, '19 「この線で中割り」が出る');
 await clickBtn('reverseFold');
 const s19 = await c.snapState();
 await tap(await point([-.5, .8]));
 assert.match(await status(), /反対側の先をつかんでください/, '19 鈍角の側の断りの文言: ' + await status());
 assert.equal(await c.snapState(), s19, '19 断ったのに原本が変わった');
 assert.equal(await ev('freeFoldDebug.reverse && freeFoldDebug.reverse.phase'), 'grab', '19 断ったあとも先を指し直せる段に戻らない');
 await tap(await point([.5, -.3]));
 await poll(async () => (await ev('freeFoldDebug.reverse && freeFoldDebug.reverse.phase')) === 'preview', '19 鋭角の側でプレビューにならない: ' + await status());
 await clickBtn('cancel');
 assert.equal(await c.snapState(), s19, '19 取消で原本が変わった');
 assert.equal(await ev('freeFoldDebug.reverse'), null, '19 取消で中割りの段が残る');
 console.log('  ok ⑫のあと 画面の操作だけで ⑬脚2本（線を引く→中割り→先を指す→途中→確定）→ 視点 → ⑭（根元の頂点もいっしょ）→ engine と同じ → 保存 → 再読込 → undo/redo → 鈍角の側は「反対側の先」で断る');
});
