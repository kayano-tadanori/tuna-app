'use strict';
/* 実Chrome：つる⑦を **実際に折って開く** 工程で、画面の操作だけで花弁折りまで（2026-09-15・本人指示）。
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
async function main() {
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'foldopen7-ui-')); const downloads = path.join(temp, 'downloads'); await fs.mkdir(downloads);
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
 shots.push(await shot('foldopen7-1-prelim.png'));

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
 shots.push(await shot('foldopen7-2-kites.png'));

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
 assert.equal(await ev('freeFoldDebug.geometry && freeFoldDebug.geometry.movingIds.length'), 8, '3 ゴーストで動く面が8面でない');
 assert.match(await status(), /折線のこの側の紙ぜんぶを折ります/, '3 案内がこの側を全部になっていない: ' + await status());
 assert.equal(await snapState(), s3, '3 選んだだけで原本が変わった');
 shots.push(await shot('foldopen7-3-side-all.png'));
 await clickBtn('confirm');
 assert.match(await status(), /引いた線で折る1手/, '3 確定の案内: ' + await status());
 await clickBtn('lineMode');
 const r3 = await recipe();
 assert.deepEqual(r3.steps.map(s => s.op).slice(5), ['fold', 'fold', 'fold'], '3 上の三角が「折り」1手で入らない（折り目の手が混ざった？）: ' + await status());
 assert.equal(r3.steps[7].targets.length, 8, '3 上の三角の対象が8面でない');
 shots.push(await shot('foldopen7-4-folded.png'));

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
 shots.push(await shot('foldopen7-5-opened.png'));

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
 shots.push(await shot('foldopen7-6-petal-middle.png'));
 await clickBtn('confirm');
 const r5 = await recipe();
 assert.deepEqual([r5.version, r5.steps.slice(-1)[0].op, r5.steps.length], [2, 'petal', 12], '5 花弁折りが1手で確定しない: ' + await status());
 assert.equal(await ev('FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash'), true, '5 表示と原本の再生が違う');
 const h11 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('foldopen7-7-petal.png'));

 mark('6 保存 → undo/redo → 再読込 → undo/redo');
 await clickBtn('save');
 const file = await poll(async () => (await fs.readdir(downloads)).find(v => v.endsWith('.origami.json')), 'download');
 const saved = JSON.parse(await fs.readFile(path.join(downloads, file), 'utf8'));
 assert.equal(await ev(`FreeFoldEngine.replay(${JSON.stringify(saved)}).hash`), h11, '6 保存した原本を再生すると違う');
 assert.ok(!/openedBy/.test(JSON.stringify(saved)), '6 原本に結びの印が書かれた');
 await clickBtn('undo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h10, '6 undo で開いた⑦に戻らない');
 await poll(async () => !(await btn('petalPick')).hidden, '6 undo のあと「花弁を選ぶ」が出る');
 await clickBtn('redo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h11, '6 redo で同じ紙に戻らない');
 await cdp('Page.reload', {});
 await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reload');
 await ev(`(() => { const st = freeFoldDebug.state, r = ${JSON.stringify(saved)}; st.recipe = r; st.cache = FreeFoldEngine.replay(r);
  st.revision = 0; st.cacheRevision = 0; st.committed = st.cache; st.redoStack = []; st.pending = null; return true })()`);
 await clickBtn('op'); await clickBtn('op');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h11, '6 再読込で同じ紙にならない');
 await clickBtn('undo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h10, '6 再読込後の undo で開いた⑦に戻らない');
 await clickBtn('redo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h11, '6 再読込後の redo で同じ紙にならない');
 assert.equal(await ev('JSON.stringify(freeFoldDebug.state.recipe)'), JSON.stringify(saved), '6 undo/redo で原本の文字が変わった');
 void h6; void n8; void n7; void n6;

 assert.deepEqual(errors, [], 'ページで例外: ' + JSON.stringify(errors).slice(0, 400));
 console.log(`  ok 画面の操作だけで 正方基本形 → 凧形2本を折る（上から2枚）→ 上の三角を線で折る（この側を全部＝8面）→ 背を3本開く（開く面 ${n8}・${n7}・${n6}）→ 花弁 → 確定 → 保存 → undo/redo → 再読込 → undo/redo`);
 console.log('  写し：\n    ' + shots.join('\n    '));
}
main().then(() => 0, e => { console.error(e); return 1 }).then(async code => {
 try { await Promise.race([cdpRef && cdpRef('Browser.close'), sleep(3000)]) } catch {}
 try { ws && ws.close() } catch {} try { browser && browser.kill() } catch {} try { server && server.close() } catch {}
 await sleep(300); if (temp) await fs.rm(temp, { recursive: true, force: true, maxRetries: 7, retryDelay: 300 }).catch(() => {});
 process.exit(code) });
