'use strict';
/* 実Chrome：つる⑫（まんなかにむけて折る・表裏4本）まで、画面の操作だけで（2026-09-16・本人指示）。
   新しい紙 → ⑪（test_petal_back_browser と同じ操作）→ 外形の背のタップ＝背を選ぶ・紙の外のドラッグ＝視点（回帰）
   → 脚の外形の背を押して（つかんだ印）中心線の吸着点へ運ぶ →「つながっているフラップ」（指の下に無い紙の縁取り）→ 確定 ×2 → 裏返す → ×2
   → engine の⑫（crane12_state.json）と素材の点ごとに同じ → 保存 → 再読込 → undo/redo → 生のふちのつかみ（回帰）。
   以下は test_petal_back_browser の説明：
   ⑦を実際に折って開く → 1回目の花弁 →（ここまで test_fold_open7_browser と同じ操作）
   → 「裏返す」→ 裏側の凧形2本を辺ドラッグ＋上から2枚で折る → 背を2本タップして開く（上の三角の折り目は⑦で裏側にも付いている）
   → 「花弁を選ぶ」→ 確定 → 保存 → undo/redo → 再読込 → undo/redo → 通常の折り1手（辺を中心の折り目へ）→ 保存 → undo/redo。
   以下は test_fold_open7_browser の説明：
   新しい紙 → 2回折る → 袋 → 裏返す → 反対側の袋（正方基本形）
   → 凧形2本を「折る」で上から2枚 → 上の三角を「折り目を引く」で P→P' の線を引き「この線で折る」→ 折る側を指す →「折線のこの側を全部」
   → 背を3本、画面で選んで「背を開く」（上の三角 → 凧形2本）→「花弁を選ぶ」→ 確定 → 保存 → undo/redo → 再読込 → undo/redo。
   🚨折り・枚数・確定・背の選択・開く・花弁・undo/redo・保存はボタンと紙のしぐさで行う。
     コンソールで書くのは「再読込したページへ保存原本を入れる」1か所だけ（画面に読込の UI が無い）。準備した原本の注入はしない。ほかは読んで確かめるだけ。
   ⛔ 厚みは0。
   使い方： node test_fold_open7_browser.js
*/
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http'),
 { spawn } = require('node:child_process'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const SHOTS = process.env.ORIGAMI_SHOTS || os.tmpdir();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mark = s => console.log(new Date().toISOString().slice(11, 19), s);
async function poll(fn, label, tries = 150) { for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await sleep(100) } throw Error('timeout ' + label) }
let browser, ws, server, temp, cdpRef = null;
async function main(after, only) {/* after＝⑫のあとに続ける検査（test_crane13_browser.js）。単独で動かすときは無い／only＝⑫を折らず、開いたページで行う検査（test_crane_progress.js） */
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'crane12-ui-')); const downloads = path.join(temp, 'downloads'); await fs.mkdir(downloads);
 server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x').pathname; if (u === '/favicon.ico') return res.writeHead(204).end();
  const f = path.resolve(DIR, '.' + decodeURIComponent(u)); if (!f.startsWith(path.resolve(DIR) + path.sep)) return res.writeHead(403).end();
  try { const b = await fs.readFile(f); res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8'); res.end(b) }
  catch { res.writeHead(404).end() } });
 await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok) });
 browser = spawn(process.env.ORIGAMI_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + path.join(temp, 'profile'), '--no-first-run', '--no-default-browser-check',
   '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
 let launch; browser.on('error', e => launch = e);
 const port = await poll(async () => { if (launch) throw launch; try { return Number((await fs.readFile(path.join(temp, 'profile', 'DevToolsActivePort'), 'utf8')).split('\n')[0]) } catch { return 0 } }, 'chrome');
 const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
 ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no });
 let n = 0; const pending = new Map(), errors = [];
 ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.no(Error(JSON.stringify(m.error))) : p.ok(m.result) } }
  else if (m.method === 'Runtime.exceptionThrown' || m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m) };
 const cdp = (method, params = {}) => new Promise((ok, no) => { const id = ++n; pending.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params })) }); cdpRef = cdp;
 const ev = async expression => { const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails).slice(0, 600)); return r.result.value };
 const point = async p => ev(`freeFoldDebug.project([${p[0]},0,${-p[1]}])`);
 const press = q => cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: q[0], y: q[1], button: 'left', clickCount: 1 });
 const moveTo = q => cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q[0], y: q[1], button: 'left', buttons: 1 });
 const release = q => cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: q[0], y: q[1], button: 'left', clickCount: 1 });
 const tap = async q => { await press(q); await release(q) };
 const grabAt = async p => press(await point(p)), carryTo = async p => moveTo(await point(p)), dropAt = async p => release(await point(p));
 const status = () => ev('freeFoldDebug.status');
 const btn = id => ev(`(() => { const b = document.getElementById('${id}'); return { hidden: b.hidden, disabled: b.disabled, text: b.textContent } })()`);
 const clickBtn = async id => { const r = await ev(`(() => { const b = document.getElementById('${id}'); if (!b || b.hidden) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, disabled: b.disabled } })()`);
  assert.notEqual(r, null, 'ボタン ' + id + ' が見えていない（' + await status() + '）'); assert.equal(r.disabled, false, 'ボタン ' + id + ' が押せない（' + await status() + '）'); await tap([r.x, r.y]) };
 const stackBtn = async k => { const r = await ev(`(() => { const b = [...document.querySelectorAll('#stackPick button')].find(b => b.dataset.n === '${k}'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2] })()`);
  assert.notEqual(r, null, '枚数の選び方 ' + k + ' のボタンが無い'); await tap(r) };
 const hasStack = k => ev(`[...document.querySelectorAll('#stackPick button')].some(b => b.dataset.n === '${k}')`);
 const shot = async name => { const png = await cdp('Page.captureScreenshot', { format: 'png' }), f = path.join(SHOTS, name); await fs.writeFile(f, Buffer.from(png.data, 'base64')); return f };
 const recipe = () => ev('JSON.parse(JSON.stringify(freeFoldDebug.state.recipe))');
 const snapState = () => ev(`JSON.stringify({ r: freeFoldDebug.state.recipe, h: freeFoldDebug.state.cache.hash, rev: freeFoldDebug.state.revision, redo: freeFoldDebug.state.redoStack })`);
 const pocketPoint = () => ev(`(() => { const o = FreeFoldEngine.squashOptions(freeFoldDebug.state).options[0]; if (!o) return null;
  const f = o.outline[0]; return [f.reduce((s, p) => s + p[0], 0) / f.length, f.reduce((s, p) => s + p[1], 0) / f.length] })()`);
 const petalPoint = () => ev(`(() => { const o = FreeFoldEngine.petalOptions(freeFoldDebug.state).options[0]; if (!o) return null;
  const f = o.outline[0]; return [f.reduce((s, p) => s + p[0], 0) / f.length, f.reduce((s, p) => s + p[1], 0) / f.length] })()`);
 await cdp('Page.enable'); await cdp('Runtime.enable');
 await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 800, deviceScaleFactor: 1, mobile: false });
 await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
 await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/freefold3d.html` });
 await poll(() => ev('!!window.freeFoldDebug'), 'page');
 await poll(() => ev('freeFoldDebug.pocketReady.ok'), 'validators');
 const shots = [];
 const t8 = Math.tan(Math.PI / 8), dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
 if (only) { await only({ ev, cdp, clickBtn, btn, status, recipe, snapState, shot, shots, downloads, errors, mark, sleep, poll, DIR, SHOTS }); assert.deepEqual(errors, [], 'ページで例外: ' + JSON.stringify(errors).slice(0, 400)); return }

 mark('1 画面で ①〜⑥（2回折る → 袋 → 裏返す → 反対側の袋）');
 await grabAt([-1, -1]); await carryTo([.1, 0]); await carryTo([1, 1]); await dropAt([1, 1]); await clickBtn('confirm');
 await grabAt([-1, 1]); await carryTo([0, 0]); await carryTo([1, -1]); await dropAt([1, -1]);
 await poll(() => hasStack('2'), 'stack pick 2');
 await stackBtn(2); await clickBtn('confirm');
 await clickBtn('pocketPick'); await tap(await point(await pocketPoint())); await clickBtn('confirm');
 await clickBtn('flip');
 await clickBtn('pocketPick'); await tap(await point(await pocketPoint())); await clickBtn('confirm');
 assert.deepEqual((await recipe()).steps.map(s => s.op), ['fold', 'fold', 'squash', 'flip', 'squash'], '1 正方基本形にならない: ' + await status());
 /* 紙の角：開いた角 Q（4つの角が集まる）・閉じた角 O・横の角 2つ（読むだけ） */
 const Q = await ev(`(() => { const f = freeFoldDebug.state.cache.faces.flatMap(f => f.poly.map(q => [q, (() => { const m = f.xf, d = m[0]*m[3]-m[1]*m[2], x = q[0]-m[4], y = q[1]-m[5]; return [(m[3]*x-m[1]*y)/d, (-m[2]*x+m[0]*y)/d] })()]));
  const c = f.find(([q, m]) => Math.abs(Math.abs(m[0])-1) < 1e-9 && Math.abs(Math.abs(m[1])-1) < 1e-9); return c[0] })()`);
 const O = [0, 0];
 const sideCorners = (await ev('FreeFoldSnap.outlineCorners(freeFoldDebug.state)')).filter(p => dist(p, Q) > 1e-9 && dist(p, O) > 1e-9);
 assert.equal(sideCorners.length, 2, '1 横の角が2つでない');
 const Ps = sideCorners.map(B => ({ B, P: [O[0] + (B[0] - O[0]) * (1 - t8), O[1] + (B[1] - O[1]) * (1 - t8)] }));
 const h6 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('crane12pre-1-prelim.png'));

 mark('2 凧形2本を「折る」で（辺→対角の折り目・上から2枚）');
 assert.equal(await ev('freeFoldDebug.asCrease'), false, '2 「折る」モードでない');
 /* 順番は test_petal_browser と同じ＝横の角 A 側のふち → B 側のふち */
 for (const far of [[Q[0], O[1]], [O[0], Q[1]]]) {
  const mid = [(Q[0] + far[0]) / 2, (Q[1] + far[1]) / 2], L = Math.hypot(mid[0] - Q[0], mid[1] - Q[1]);
  const u = [(O[0] - Q[0]) / Math.hypot(O[0] - Q[0], O[1] - Q[1]), (O[1] - Q[1]) / Math.hypot(O[0] - Q[0], O[1] - Q[1])];
  const to = [Q[0] + u[0] * L, Q[1] + u[1] * L];
  await grabAt(mid); await carryTo([(mid[0] + to[0]) / 2, (mid[1] + to[1]) / 2]); await carryTo(to); await dropAt(to);
  await poll(() => hasStack('2'), '2 stack pick 2（' + far + '）: ' + await status());
  await stackBtn(2);
  await poll(async () => !(await btn('confirm')).disabled, '2 凧形が上から2枚で確定できる: ' + await status());
  await clickBtn('confirm');
 }
 const r2 = await recipe();
 assert.deepEqual(r2.steps.map(s => s.op).slice(5), ['fold', 'fold'], '2 凧形が「折り」2手で入らない: ' + await status());
 shots.push(await shot('crane12pre-2-kites.png'));

 mark('3 上の三角：「折り目を引く」で P→P\' → 「この線で折る」→ 折る側を指す → 「折線のこの側を全部」');
 const [P, Pp] = Ps.map(v => v.P), Mid = [(P[0] + Pp[0]) / 2, (P[1] + Pp[1]) / 2];
 const sp = [Mid[0] + (O[0] - Mid[0]) * .3 + (P[0] - Mid[0]) * .2, Mid[1] + (O[1] - Mid[1]) * .3 + (P[1] - Mid[1]) * .2];
 const inward = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
 await clickBtn('lineMode');
 await grabAt(inward(P, Pp, .04)); await carryTo(Mid); await carryTo(inward(Pp, P, .04)); await dropAt(inward(Pp, P, .04));
 await poll(async () => !(await btn('lineFold')).hidden, '3 「この線で折る」が出る: ' + await status());
 const line = await ev('freeFoldDebug.state.pending && freeFoldDebug.state.pending.displayLine');
 assert.ok(line && [P, Pp].every(q => line.some(v => dist(v, q) < 1e-9)), '3 引いた線が P・P\' を通らない: ' + JSON.stringify(line));
 const s3 = await snapState();
 await clickBtn('lineFold');
 assert.match(await status(), /線のどちら側を折るか/, '3 折る側の案内が出ない');
 assert.equal(await snapState(), s3, '3 「この線で折る」を押しただけで原本が変わった');
 await tap(await point(sp));
 await poll(() => hasStack('side'), '3 「折線のこの側を全部」が出る: ' + await status());
 /* 上からN枚は今までどおり（1〜4枚では折れない） */
 for (const k of [1, 2, 3, 4]) {
  await stackBtn(k);
  assert.deepEqual(await ev('[freeFoldDebug.layerPick.n, freeFoldDebug.layerPick.ok]'), [k, false], `3 上から${k}枚で折れてしまう（意味が変わった）`);
  assert.equal((await btn('confirm')).disabled, true, `3 上から${k}枚で確定が押せる`);
 }
 await stackBtn('side');
 const lp = await ev('({ n: freeFoldDebug.layerPick.n, ok: freeFoldDebug.layerPick.ok, faces: freeFoldDebug.layerPick.faces.slice(), show: freeFoldDebug.frame.pick && freeFoldDebug.frame.pick.show, under: FreeFoldEngine.stackAt(freeFoldDebug.state, freeFoldDebug.layerPick.at).map(v => v.faceId) })');
 if (lp.faces.length !== 8) { await fs.writeFile(path.join(os.tmpdir(), 'foldopen7_debug.json'), JSON.stringify({ recipe: await recipe(), lp, sp, P, Pp, staged: await ev('JSON.parse(JSON.stringify(freeFoldDebug.state.pending))') })) }
 assert.deepEqual([lp.n, lp.ok, lp.faces.length], ['side', true, 8], '3 この側を全部で8面が成立しない: ' + JSON.stringify(lp) + ' ' + await status());
 assert.ok(lp.faces.some(id => !lp.under.includes(id)), '3 指の下に無い面（左右に分かれた面）が入っていない');
 assert.equal(lp.show.faces.length, 8, '3 選んだ紙が画面に示されていない');
 assert.deepEqual(lp.show.away.slice().sort(), lp.faces.filter(id => !lp.under.includes(id)).sort(), '3 指の下に無い面が別の色で示されていない');
 assert.ok(lp.show.away.length > 0 && lp.show.away.length + lp.show.under.length === 8, '3 選んだ紙の示し方が面の数と合わない');
 assert.match(await ev('document.getElementById("stackWhy").textContent'), new RegExp(`指の下に無い紙 ${lp.show.away.length}面（橙のふち）も一緒に動きます`), '3 離れた紙も動くことが案内に出ない');
 assert.equal(await ev('freeFoldDebug.geometry && freeFoldDebug.geometry.movingIds.length'), 8, '3 ゴーストで動く面が8面でない');
 assert.match(await status(), /折線のこの側の紙ぜんぶを折ります/, '3 案内がこの側を全部になっていない: ' + await status());
 assert.equal(await snapState(), s3, '3 選んだだけで原本が変わった');
 shots.push(await shot('crane12pre-3-side-all.png'));
 await clickBtn('confirm');
 assert.match(await status(), /引いた線で折る1手/, '3 確定の案内: ' + await status());
 await clickBtn('lineMode');
 const r3 = await recipe();
 assert.deepEqual(r3.steps.map(s => s.op).slice(5), ['fold', 'fold', 'fold'], '3 上の三角が「折り」1手で入らない（折り目の手が混ざった？）: ' + await status());
 assert.equal(r3.steps[7].targets.length, 8, '3 上の三角の対象が8面でない');
 shots.push(await shot('crane12pre-4-folded.png'));

 mark('4 背を3本、画面で選んで開く（上の三角 → 凧形2本）');
 const openHingeOf = async (stepId, label) => {
  const vis = await ev(`(() => { const h = FreeFoldEngine.hingeIntervals(freeFoldDebug.state).filter(v => v.stepId === '${stepId}' && v.visible);
   return h.map(v => ({ id: v.intervalId, parts: v.visibleParts.map(p => p.seg) })) })()`);
  assert.ok(vis.length, `${label}：背 ${stepId} が見えていない`);
  const part = vis[0].parts.sort((a, b) => dist(b[0], b[1]) - dist(a[0], a[1]))[0], hm = [(part[0][0] + part[1][0]) / 2, (part[0][1] + part[1][1]) / 2];
  await tap(await point(hm));
  const got = await ev('freeFoldDebug.hingePick && freeFoldDebug.hingePick.stepId');
  assert.equal(got, stepId, `${label}：背を選べない（${await status()}）`);
  await clickBtn('openHinge');
  /* 開く側＝この手で動いた紙（読むだけ：その手の cut の面の中の点） */
  const side = await ev(`(() => { const st = freeFoldDebug.state; const f = st.cache.faces.filter(f => f.layerPath.some(q => q.stepId === '${stepId}' && q.side === 'cut')).sort((a, b) => b.layer - a.layer)[0];
   const c = f.poly.reduce((s, p) => [s[0] + p[0] / f.poly.length, s[1] + p[1] / f.poly.length], [0, 0]); return c })()`);
  const s = await snapState();
  await tap(await point(side));
  const q = await ev('freeFoldDebug.state.pending && { mode: freeFoldDebug.state.pending.inputMode, n: freeFoldDebug.state.pending.candidates.length }');
  assert.equal(q && q.mode, 'open', `${label}：開く候補ができない（${await status()}）`);
  assert.equal(await snapState(), s, `${label}：開く候補を作っただけで原本が変わった`);
  await poll(async () => !(await btn('confirm')).disabled, `${label}：開く手が確定できる（${await status()}）`);
  await clickBtn('confirm');
  return q.n;
 };
 const ids = r3.steps.slice(5).map(s => s.id);
 const n8 = await openHingeOf(ids[2], '上の三角'); const n7 = await openHingeOf(ids[1], '凧形2本目'); const n6 = await openHingeOf(ids[0], '凧形1本目');
 const r4 = await recipe();
 assert.deepEqual(r4.steps.map(s => s.op).slice(5), ['fold', 'fold', 'fold', 'fold', 'fold', 'fold'], '4 開く3手が折り3手で入らない');
 const k4 = await ev(`(() => { const st = freeFoldDebug.state, open = st.recipe.steps.slice(-3).map(s => s.id);
  return { faces: st.cache.faces.length, opened: st.cache.bonds.filter(b => open.includes(b.openedBy)).map(b => b.kind + ':' + b.stepId), backs: FreeFoldEngine.hingeIntervals(st).filter(h => ${JSON.stringify(ids)}.includes(h.stepId)).length } })()`);
 assert.equal(k4.faces, 20, '4 開いた紙が20面でない');
 assert.equal(k4.opened.length, 12, '4 開いた背が12本の折り目にならない: ' + JSON.stringify(k4));
 assert.ok(k4.opened.every(v => v.startsWith('crease:') && ids.includes(v.split(':')[1])), '4 開いた背の種類・由来が違う: ' + JSON.stringify(k4.opened));
 assert.equal(k4.backs, 0, '4 開いた背がまだ背として選べる');
 const h10 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('crane12pre-5-opened.png'));

 mark('5 「花弁を選ぶ」→ 花弁をタップ → 途中 → 確定');
 await poll(async () => !(await btn('petalPick')).hidden, '5 「花弁を選ぶ」が出る: ' + await status());
 await clickBtn('petalPick');
 const pick = await ev('freeFoldDebug.frame.pocket');
 assert.equal(pick && pick.kind + ':' + pick.mode + ':' + pick.options.length, 'petal:pick:1', '5 花弁が1つ光らない');
 await tap(await point(await petalPoint()));
 assert.equal(await ev('freeFoldDebug.pocket && freeFoldDebug.pocket.kind + ":" + freeFoldDebug.pocket.mode'), 'petal:preview', '5 花弁を選べない: ' + await status());
 const rs = await ev('(() => { const q = document.getElementById("pocketT").getBoundingClientRect(); return { l: q.left, w: q.width, y: q.top + q.height / 2 } })()');
 await tap([rs.l + 8 + (rs.w - 16) * .5, rs.y]);
 const f5 = await ev('freeFoldDebug.frame.pocket');
 const want5 = await ev(`Array.from(FreeFoldEngine.petalPreview(freeFoldDebug.state).positions(${f5.t}))`);
 assert.equal(f5.drawnBy, 'webgl-depth', '5 途中が WebGL で描かれていない');
 assert.ok(f5.positions.length === want5.length && f5.positions.reduce((w, v, i) => Math.max(w, Math.abs(v - want5[i])), 0) < 1e-6, '5 描いた座標が engine と違う');
 shots.push(await shot('crane12pre-6-petal-middle.png'));
 await clickBtn('confirm');
 const r5 = await recipe();
 assert.deepEqual([r5.version, r5.steps.slice(-1)[0].op, r5.steps.length], [2, 'petal', 12], '5 花弁折りが1手で確定しない: ' + await status());
 assert.equal(await ev('FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash'), true, '5 表示と原本の再生が違う');
 const h11 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('crane12pre-7-petal.png'));

 mark('6 裏返す（ボタン）→ 裏側には花弁が無い');
 await clickBtn('flip');
 await poll(async () => (await btn('petalPick')).hidden, '6 裏返したら「花弁を選ぶ」が消える');
 /* 裏側の正方基本形の枠（読むだけ）：素材の中心 O・いちばん多くの角が集まる開いた角 Q・横の角（O から Q を ±45° 回して 1/√2） */
 const fr = await ev(`(() => { const st = freeFoldDebug.state, inv = (m, q) => { const d = m[0]*m[3]-m[1]*m[2], x = q[0]-m[4], y = q[1]-m[5]; return [(m[3]*x-m[1]*y)/d, (-m[2]*x+m[0]*y)/d] },
   ap = (m, p) => [m[0]*p[0]+m[1]*p[1]+m[4], m[2]*p[0]+m[3]*p[1]+m[5]], at = mm => { const f = st.cache.faces.find(f => f.poly.map(q => inv(f.xf, q)).some(q => Math.hypot(q[0]-mm[0], q[1]-mm[1]) < 1e-9)); return f && ap(f.xf, mm) };
   const O = at([0, 0]), cs = [[1,1],[1,-1],[-1,1],[-1,-1]].map(at), g = []; for (const p of cs) { const h = g.find(h => Math.hypot(h.p[0]-p[0], h.p[1]-p[1]) < 1e-9); if (h) h.n++; else g.push({ p, n: 1 }) }
   return { O, Q: g.sort((a, b) => b.n - a.n)[0].p } })()`);
 const bO = fr.O, bQ = fr.Q, vq = [(bQ[0] - bO[0]) / Math.SQRT2, (bQ[1] - bO[1]) / Math.SQRT2], rot = a => [bO[0] + vq[0] * Math.cos(a) - vq[1] * Math.sin(a), bO[1] + vq[0] * Math.sin(a) + vq[1] * Math.cos(a)];
 const bBs = [rot(Math.PI / 4), rot(-Math.PI / 4)];
 shots.push(await shot('crane12pre-8-flipped.png'));

 mark('7 裏側の凧形2本を「折る」で（辺→対角の折り目・上から2枚）');
 for (const far of bBs) {
  const mid = [(bQ[0] + far[0]) / 2, (bQ[1] + far[1]) / 2], L = dist(mid, bQ), u = [(bO[0] - bQ[0]) / dist(bO, bQ), (bO[1] - bQ[1]) / dist(bO, bQ)], to = [bQ[0] + u[0] * L, bQ[1] + u[1] * L];
  await grabAt(mid); await carryTo([(mid[0] + to[0]) / 2, (mid[1] + to[1]) / 2]); await carryTo(to); await dropAt(to);
  await poll(() => hasStack('2'), '7 裏側の凧形で枚数が選べる（' + far.map(v => v.toFixed(2)) + '）: ' + await status());
  await stackBtn(2);
  await poll(async () => !(await btn('confirm')).disabled, '7 裏側の凧形が上から2枚で確定できる: ' + await status());
  await clickBtn('confirm');
 }
 const r7 = await recipe();
 assert.deepEqual(r7.steps.map(s => s.op).slice(-3), ['flip', 'fold', 'fold'], '7 裏側の凧形が折り2手で入らない: ' + await status());
 const kites2 = r7.steps.slice(-2).map(s => s.id);
 shots.push(await shot('crane12pre-9-kites.png'));

 mark('8 裏側の凧形の背を2本、画面で選んで開く');
 await openHingeOf(kites2[1], '裏側の凧形2本目'); await openHingeOf(kites2[0], '裏側の凧形1本目');
 const h15 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('crane12pre-10-opened.png'));

 mark('9 「花弁を選ぶ」→ 花弁をタップ → 途中 → 確定（2回目）');
 await poll(async () => !(await btn('petalPick')).hidden, '9 裏側の準備のあと「花弁を選ぶ」が出る: ' + await status());
 await clickBtn('petalPick');
 const pick2 = await ev('freeFoldDebug.frame.pocket');
 assert.equal(pick2 && pick2.kind + ':' + pick2.mode + ':' + pick2.options.length, 'petal:pick:1', '9 花弁が1つ光らない');
 await tap(await point(await petalPoint()));
 assert.equal(await ev('freeFoldDebug.pocket && freeFoldDebug.pocket.kind + ":" + freeFoldDebug.pocket.mode'), 'petal:preview', '9 花弁を選べない: ' + await status());
 const rs2 = await ev('(() => { const q = document.getElementById("pocketT").getBoundingClientRect(); return { l: q.left, w: q.width, y: q.top + q.height / 2 } })()');
 for (const ratio of [.3, .6, .9]) {
  await tap([rs2.l + 8 + (rs2.w - 16) * ratio, rs2.y]);
  const f9 = await ev('freeFoldDebug.frame.pocket'), want9 = await ev(`Array.from(FreeFoldEngine.petalPreview(freeFoldDebug.state).positions(${f9.t}))`);
  assert.ok(f9.drawnBy === 'webgl-depth' && f9.positions.length === want9.length && f9.positions.reduce((w, v, i) => Math.max(w, Math.abs(v - want9[i])), 0) < 1e-6, '9 途中の描画が engine と違う');
  if (ratio === .6) shots.push(await shot('crane12pre-11-petal2-middle.png'));
 }
 await clickBtn('confirm');
 const r9 = await recipe();
 assert.equal(r9.steps.filter(s => s.op === 'petal').length, 2, '9 2回目の花弁折りが入らない: ' + await status());
 assert.equal(await ev('FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash'), true, '9 表示と原本の再生が違う');
 const h16 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('crane12pre-12-petal2.png'));

 mark('10 保存 → undo/redo → 再読込 → undo/redo');
 await clickBtn('save');
 const file = await poll(async () => (await fs.readdir(downloads)).find(v => v.endsWith('.origami.json')), 'download');
 const saved = JSON.parse(await fs.readFile(path.join(downloads, file), 'utf8'));
 assert.equal(await ev(`FreeFoldEngine.replay(${JSON.stringify(saved)}).hash`), h16, '10 保存した原本を再生すると違う');
 await clickBtn('undo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h15, '10 undo で裏側の準備のあとに戻らない');
 await poll(async () => !(await btn('petalPick')).hidden, '10 undo のあと「花弁を選ぶ」が出る');
 await clickBtn('redo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h16, '10 redo で同じ紙に戻らない');
 await cdp('Page.reload', {});
 await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reload');
 await ev(`(() => { const st = freeFoldDebug.state, r = ${JSON.stringify(saved)}; st.recipe = r; st.cache = FreeFoldEngine.replay(r);
  st.revision = 0; st.cacheRevision = 0; st.committed = st.cache; st.redoStack = []; st.pending = null; return true })()`);
 await clickBtn('op'); await clickBtn('op');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h16, '10 再読込で同じ紙にならない');
 await clickBtn('undo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h15, '10 再読込後の undo');
 await clickBtn('redo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h16, '10 再読込後の redo');

 mark('11 回帰：外形の背をタップ＝従来の「背を選ぶ」（視点は回らない）');
 /* 脚の側の外形の背（読むだけ）：花弁の先端（cache.petals の花弁の面の頂点）ではない方の先端を持ち、見えている生のふちと端を共有する外形の背。
    この⑫で自分が足した手の背（もう一度細くする折り）は除く。 */
 const legInfo = async mine => ev(`(() => { const st = freeFoldDebug.state, E = FreeFoldEngine, dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
  const vis = E.rimEdges(st).filter(e => { const f = st.cache.faces.find(v => v.faceId === e.faceId); if (!f) return false;
   const c = f.poly.reduce((s, p) => [s[0] + p[0] / f.poly.length, s[1] + p[1] / f.poly.length], [0, 0]), m = [(e.seg[0][0]+e.seg[1][0])/2, (e.seg[0][1]+e.seg[1][1])/2];
   const q = [m[0] + (c[0]-m[0]) * .02, m[1] + (c[1]-m[1]) * .02], top = E.stackAt(st, q)[0]; return !!top && top.faceId === e.faceId });
  const petalPts = (st.cache.petals || []).flatMap(pt => ['T2R','T2L'].map(k => st.cache.faces.find(f => f.faceId === pt.faceOf[k])).filter(Boolean).flatMap(f => f.poly));
  const mine = new Set(${JSON.stringify(mine)});
  const out = [];
  for (const h of E.outlineHingeEdges(st)) { if (mine.has(h.stepId)) continue;
   const tip = h.seg.find(p => vis.some(r => r.seg.some(q => dist(p, q) < 1e-9)) && !petalPts.some(q => dist(p, q) < 1e-9)); if (!tip) continue;
   const intent = E.hingeEdgeIntent(st, h.edgeId), r = E.edgeToCreaseOptions(st, intent);
   const dl = (p, s) => { const d = [s[1][0]-s[0][0], s[1][1]-s[0][1]], L = Math.hypot(...d); return Math.abs((p[0]-s[0][0])*d[1]-(p[1]-s[0][1])*d[0]) / L };
   const o = r.options.find(o => o.ok && dl(tip, o.axis) < 1e-9); if (!o) continue;
   const mid = [(h.seg[0][0]+h.seg[1][0])/2, (h.seg[0][1]+h.seg[1][1])/2];
   out.push({ edgeId: h.edgeId, seg: h.seg, tip, mid, to: E.reflect(mid, o.axis[0], o.axis[1]), intervalId: h.intervalId }) }
  return out })()`);
 {
  const legs = await legInfo([]);
  assert.ok(legs.length >= 2, '11 脚の側の外形の背が2本ない: ' + JSON.stringify(legs));
  const s11 = await snapState(), cam = await ev('[freeFoldDebug.camera.yaw, freeFoldDebug.camera.pitch]');
  await tap(await point(legs[0].mid));
  assert.equal(await ev('freeFoldDebug.hingePick && freeFoldDebug.hingePick.intervalId'), legs[0].intervalId, '11 外形の背のタップで背が選ばれない: ' + await status());
  assert.equal((await btn('openHinge')).hidden, false, '11 背を選んでも「背を開く」が出ない');
  assert.deepEqual(await ev('[freeFoldDebug.camera.yaw, freeFoldDebug.camera.pitch]'), cam, '11 タップで視点が回った');
  assert.equal(await snapState(), s11, '11 タップで原本が変わった');
  /* 回帰：紙の外をドラッグすると視点が回る */
  const out = [940, 400]; await press(out); await moveTo([900, 430]); await release([900, 430]);
  assert.notDeepEqual(await ev('[freeFoldDebug.camera.yaw, freeFoldDebug.camera.pitch]'), cam, '11 紙の外のドラッグで視点が回らない');
  await press([900, 430]); await moveTo(out); await release(out);
  assert.equal(await snapState(), s11, '11 視点を回して原本が変わった');
 }

 mark('12 ⑫：脚の外形の背を中心線へ運ぶ → つながっているフラップ → 確定（表2本 → 裏返す → 裏2本）');
 const mine = [], sizes = [];
 for (const pass of ['表', '裏']) {
  if (pass === '裏') { await clickBtn('flip'); mine.push((await recipe()).steps.slice(-1)[0].id) }
  for (let k = 0; k < 2; k++) {
   const legs = await legInfo(mine);
   assert.ok(legs.length, `12 ${pass}${k + 1}本目：脚の外形の背が無い`);
   const L = legs[0], n0 = (await recipe()).steps.length;
   await grabAt(L.mid);
   assert.match(await status(), /外形の背をつかみました/, `12 ${pass}${k + 1}本目：押した時点でつかんだ印が出ない: ` + await status());
   const fx = await ev('(freeFoldDebug.frame && freeFoldDebug.frame.fx || []).map(f => f.kind)');
   assert.ok(fx.includes('grab'), `12 ${pass}${k + 1}本目：つかんだ場所の印（grab）が描かれていない: ` + JSON.stringify(fx));
   await carryTo([(L.mid[0] + L.to[0]) / 2, (L.mid[1] + L.to[1]) / 2]); await carryTo(L.to); await dropAt(L.to);
   await poll(() => hasStack('flap'), `12 ${pass}${k + 1}本目：「つながっているフラップ」が出る: ` + await status());
   await stackBtn('flap');
   const lp = await ev('({ n: freeFoldDebug.layerPick.n, ok: freeFoldDebug.layerPick.ok, faces: freeFoldDebug.layerPick.faces.slice(), show: freeFoldDebug.frame.pick && freeFoldDebug.frame.pick.show, reason: freeFoldDebug.layerPick.reason })');
   assert.deepEqual([lp.n, lp.ok], ['flap', true], `12 ${pass}${k + 1}本目：つながっているフラップで成立しない: ` + JSON.stringify(lp) + ' ' + await status());
   assert.ok(lp.show && lp.show.away && lp.show.away.length > 0, `12 ${pass}${k + 1}本目：指の下に無い紙の縁取りが出ない`);
   assert.equal(await ev('JSON.stringify(freeFoldDebug.state.pending.candidates.map(c => c.faceId).sort())'),
    await ev(`(() => { const st = freeFoldDebug.state, q = st.pending, f = st.cache.faces.find(x => x.faceId === q.reference.faceId), E = FreeFoldEngine;
     const ap = (m, p) => [m[0]*p[0]+m[1]*p[1]+m[4], m[2]*p[0]+m[3]*p[1]+m[5]]; let A = q.displayLine[0], B = q.displayLine[1]; if (E.side(ap(f.xf, q.sidePoint), A, B) > 0) [A, B] = [B, A];
     return JSON.stringify(E.flapFaces(st, q.at, A, B).sort()) })()`), `12 ${pass}${k + 1}本目：画面の候補が engine のフラップと違う`);
   if (pass === '表' && k === 0) shots.push(await shot('crane12-1-flap.png'));
   await poll(async () => !(await btn('confirm')).disabled, `12 ${pass}${k + 1}本目：確定できる: ` + await status());
   await clickBtn('confirm');
   const r = await recipe();
   assert.equal(r.steps.length, n0 + 1, `12 ${pass}${k + 1}本目：1手入らない: ` + await status());
   assert.equal(r.steps.slice(-1)[0].op, 'fold', `12 ${pass}${k + 1}本目：fold でない`);
   mine.push(r.steps.slice(-1)[0].id); sizes.push(lp.faces.length);
  }
 }
 assert.equal(await ev('FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash'), true, '12 表示と原本の再生が違う');
 /* 平らな状態（FoldCrossing.flatState）は画面に読み込まれていない＝engine の常設検査 test_crane12.js B が見る */
 /* engine の常設検査が作る⑫の紙（crane12_state.json）と、素材の点ごとの置かれ方が同じ */
 const want12 = JSON.parse(await fs.readFile(path.join(DIR, 'crane12_state.json'), 'utf8')).recipe;
 const cmp12 = await ev(`(() => { const a = freeFoldDebug.state.cache, b = FreeFoldEngine.replay(${JSON.stringify(want12)});
  const inv = (m, p) => { const d = m[0]*m[3]-m[1]*m[2], x = p[0]-m[4], y = p[1]-m[5]; return [(m[3]*x-m[1]*y)/d, (-m[2]*x+m[0]*y)/d] };
  let same = 0, diff = 0; for (let i = 0; i < 41; i++) for (let j = 0; j < 41; j++) { const p = [-1 + i / 20 + 1e-4, -1 + j / 20 + 2e-4];
   const fa = a.faces.find(f => FreeFoldEngine.inside(p, f.poly.map(q => inv(f.xf, q)))), fb = b.faces.find(f => FreeFoldEngine.inside(p, f.poly.map(q => inv(f.xf, q))));
   if (!fa || !fb) continue; if (fa.xf.every((v, k) => Math.abs(v - fb.xf[k]) < 1e-9)) same++; else diff++ } return { same, diff } })()`);
 assert.equal(cmp12.diff, 0, '12 画面で折った⑫が engine の⑫と違う: ' + JSON.stringify(cmp12));
 const h12 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('crane12-2-done.png'));

 mark('13 保存 → 再読込 → undo/redo');
 for (const f of await fs.readdir(downloads)) await fs.rename(path.join(downloads, f), path.join(downloads, 'old-' + f));
 await clickBtn('save');
 const f13 = await poll(async () => (await fs.readdir(downloads)).find(v => v.endsWith('.origami.json') && !v.startsWith('old-')), 'download12');
 const saved12 = JSON.parse(await fs.readFile(path.join(downloads, f13), 'utf8'));
 assert.equal(await ev(`FreeFoldEngine.replay(${JSON.stringify(saved12)}).hash`), h12, '13 保存した原本を再生すると違う');
 await cdp('Page.reload', {});
 await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reload12');
 await ev(`(() => { const st = freeFoldDebug.state, r = ${JSON.stringify(saved12)}; st.recipe = r; st.cache = FreeFoldEngine.replay(r);
  st.revision = 0; st.cacheRevision = 0; st.committed = st.cache; st.redoStack = []; st.pending = null; return true })()`);
 await clickBtn('op'); await clickBtn('op');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h12, '13 再読込で同じ紙にならない');
 for (let i = 0; i < 5; i++) await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h16, '13 undo 5回で⑪に戻らない');
 for (let i = 0; i < 5; i++) await clickBtn('redo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h12, '13 redo 5回で⑫に戻らない');
 assert.equal(await ev('JSON.stringify(freeFoldDebug.state.recipe)'), JSON.stringify(saved12), '13 undo/redo で原本の文字が変わった');

 mark('14 回帰：生のふちをつかむ辺合わせは今までどおり（⑫の紙で、見えている生のふちをつかむと「〜辺をつかみました」）');
 {
  const rim = await ev(`(() => { const st = freeFoldDebug.state; for (const e of FreeFoldEngine.rimEdges(st)) { const m = [(e.seg[0][0]+e.seg[1][0])/2, (e.seg[0][1]+e.seg[1][1])/2];
   const r = FreeFoldSnap.pickRimEdge(st, freeFoldDebug.project([m[0], 0, -m[1]]), { toScreen: p => freeFoldDebug.project([p[0], 0, -p[1]]) }); if (r.edge) return { m, label: r.edge.label } } return null })()`);
  if (rim) { const s14 = await snapState(); await grabAt(rim.m); assert.match(await status(), new RegExp(rim.label + 'をつかみました'), '14 生のふちをつかめない: ' + await status()); await dropAt(rim.m); assert.equal(await snapState(), s14, '14 生のふちを離しただけで原本が変わった') }
  else console.log('    （⑫の紙では、画面でつかめる生のふちが無い＝生のふちの回帰は test_freefold_browser・test_squash_after_browser が見る）');
 }
 void sizes;

 if (after) await after({ ev, cdp, point, press, moveTo, release, tap, clickBtn, btn, status, recipe, snapState, shot, shots, downloads, errors, mark, sleep, poll, dist, DIR, SHOTS });
 assert.deepEqual(errors, [], 'ページで例外: ' + JSON.stringify(errors).slice(0, 400));
 console.log('  ok 画面の操作だけで 新しい紙 → ⑪ → 外形の背のタップ（背を選ぶ）・視点 → ⑫ 表裏4本（外形の背を中心線へ・つながっているフラップ）→ engine の⑫と同じ → 保存 → 再読込 → undo/redo → 生のふち（回帰）');
 console.log('  写し：\n    ' + shots.join('\n    '));
}
function run(after, only) { return main(after, only).then(() => 0, e => { console.error(e); return 1 }).then(async code => {
 try { await Promise.race([cdpRef && cdpRef('Browser.close'), sleep(3000)]) } catch {}
 try { ws && ws.close() } catch {} try { browser && browser.kill() } catch {} try { server && server.close() } catch {}
 await sleep(300); if (temp) await fs.rm(temp, { recursive: true, force: true, maxRetries: 7, retryDelay: 300 }).catch(() => {});
 process.exit(code) }) }
if (require.main === module) run();
module.exports = { run, open: only => run(null, only) };
