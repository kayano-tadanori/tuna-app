'use strict';
/* 実Chrome：自由折り画面（freefold3d.html）で、つる③の袋折りを **画面の操作だけで** 選ぶ・プレビュー・確定する。
   新しい紙 → 画面で2回折る → 袋を選ぶ → 途中を再生 → 確定 → 保存 → undo/redo → 取消。
   🚨袋折りへの移行はボタン・紙のタップ・スライダー・再生ボタンで行う（コンソールで proposeSquash/confirm を呼ばない）。
     コンソールは「読んで確かめる」ためだけに使う（engine の読み取り API・freeFoldDebug・画素）。
   ⛔ 厚みは0。紙どうしの貫通（すり抜け）は未検証。
   使い方： ORIGAMI_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" node test_pocket_ui_browser.js
*/
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http'),
 { spawn } = require('node:child_process'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const SHOTS = process.env.ORIGAMI_SHOTS || os.tmpdir();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mark = s => console.log(new Date().toISOString().slice(11, 19), s);
async function poll(fn, label, tries = 150) { for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await sleep(100) } throw Error('timeout ' + label) }
let browser, ws, server, temp, cdpRef = null;
async function shutdown() {
 try { await Promise.race([cdpRef && cdpRef('Browser.close'), sleep(3000)]) } catch {}
 try { ws && ws.close() } catch {} try { browser && browser.kill() } catch {} try { server && server.close() } catch {}
 await sleep(300); if (temp) await fs.rm(temp, { recursive: true, force: true, maxRetries: 7, retryDelay: 300 }).catch(() => {});
}
async function main() {
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pocket-ui-')); const downloads = path.join(temp, 'downloads'); await fs.mkdir(downloads);
 server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x').pathname; if (u === '/favicon.ico') return res.writeHead(204).end();
  const f = path.resolve(DIR, '.' + decodeURIComponent(u)); if (!f.startsWith(path.resolve(DIR) + path.sep)) return res.writeHead(403).end();
  try { const b = await fs.readFile(f); res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8'); res.end(b) }
  catch { res.writeHead(404).end() } });
 await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok) });
 browser = spawn(process.env.ORIGAMI_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + path.join(temp, 'profile'), '--no-first-run', '--no-default-browser-check',
   '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'],
  { windowsHide: true, stdio: 'ignore' });
 let launch; browser.on('error', e => launch = e);
 const port = await poll(async () => { if (launch) throw launch; try { return Number((await fs.readFile(path.join(temp, 'profile', 'DevToolsActivePort'), 'utf8')).split('\n')[0]) } catch { return 0 } }, 'chrome');
 const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
 ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no });
 let n = 0; const pending = new Map(), errors = [];
 ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.no(Error(JSON.stringify(m.error))) : p.ok(m.result) } }
  else if (m.method === 'Runtime.exceptionThrown' || m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error' || m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m) };
 const cdp = (method, params = {}) => new Promise((ok, no) => { const id = ++n; pending.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params })) }); cdpRef = cdp;
 const ev = async expression => { const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails).slice(0, 600)); return r.result.value };
 const point = async p => ev(`freeFoldDebug.project([${p[0]},0,${-p[1]}])`);
 const press = q => cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: q[0], y: q[1], button: 'left', clickCount: 1 });
 const moveTo = q => cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q[0], y: q[1], button: 'left', buttons: 1 });
 const release = q => cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: q[0], y: q[1], button: 'left', clickCount: 1 });
 const tap = async q => { await press(q); await release(q) };
 const grabAt = async p => press(await point(p)), carryTo = async p => moveTo(await point(p)), dropAt = async p => release(await point(p));
 /* ボタンは画面の位置を押す（element.click() でなく本物のマウス）。 */
 const clickBtn = async id => { const r = await ev(`(() => { const b = document.getElementById('${id}'); if (!b || b.hidden) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, disabled: b.disabled } })()`);
  assert.notEqual(r, null, 'ボタン ' + id + ' が見えていない'); assert.equal(r.disabled, false, 'ボタン ' + id + ' が押せない（' + await status() + '）'); await tap([r.x, r.y]) };
 const status = () => ev('freeFoldDebug.status');
 const btn = id => ev(`(() => { const b = document.getElementById('${id}'); return { hidden: b.hidden, disabled: b.disabled, text: b.textContent } })()`);
 const shot = async name => { const png = await cdp('Page.captureScreenshot', { format: 'png' }), f = path.join(SHOTS, name); await fs.writeFile(f, Buffer.from(png.data, 'base64')); return f };
 const setSlider = async ratio => { const r = await ev(`(() => { const q = document.getElementById('pocketT').getBoundingClientRect(); return { l: q.left, w: q.width, y: q.top + q.height / 2 } })()`);
  /* range の つまみの幅ぶん、端は内側にずれる。押した所の値は画面が決める＝あとで t を読み直す。 */
  await tap([r.l + 8 + (r.w - 16) * ratio, r.y]) };
 const recipe = () => ev('JSON.parse(JSON.stringify(freeFoldDebug.state.recipe))');
 const snapState = () => ev(`JSON.stringify({ r: freeFoldDebug.state.recipe, h: freeFoldDebug.state.cache.hash, rev: freeFoldDebug.state.revision, redo: freeFoldDebug.state.redoStack })`);
 await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Log.enable');
 await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 800, deviceScaleFactor: 1, mobile: false });
 await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
 await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/freefold3d.html` });
 await poll(() => ev('!!window.freeFoldDebug'), 'page');
 await poll(() => ev('freeFoldDebug.pocketReady.ok'), 'pocket validator');
 const shots = [];

 mark('1 新しい紙：袋のボタンは出ない');
 assert.equal((await btn('pocketPick')).hidden, true, '1 新しい紙で「袋を選ぶ」が出ている');

 mark('2 画面で1回目：角 (-1,-1) を (1,1) へ（対角の半分折り）');
 await grabAt([-1, -1]); await carryTo([.1, 0]); await carryTo([1, 1]); await dropAt([1, 1]);
 assert.match(await status(), /確定してください/, '2 候補にならない: ' + await status());
 await clickBtn('confirm');
 assert.equal(await ev('freeFoldDebug.state.cache.faces.length'), 2, '2 面が2枚にならない');
 assert.equal((await btn('pocketPick')).hidden, true, '2 1回折っただけで「袋を選ぶ」が出ている（適用条件を満たしていない）');

 mark('3 画面で2回目：角 (-1,1) を (1,-1) へ、上から2枚');
 await grabAt([-1, 1]); await carryTo([0, 0]); await carryTo([1, -1]); await dropAt([1, -1]);
 await poll(() => ev(`[...document.querySelectorAll('#stackPick button')].some(b => b.dataset.n === '2')`), 'stack pick 2');
 { const r = await ev(`(() => { const b = [...document.querySelectorAll('#stackPick button')].find(b => b.dataset.n === '2').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] })()`); await tap(r) }
 await clickBtn('confirm');
 const r2 = await recipe();
 assert.deepEqual([r2.version, r2.steps.map(s => s.op)], [1, ['fold', 'fold']], '3 2回折った原本が v1 の fold 2手でない');
 const pb = await btn('pocketPick');
 assert.deepEqual([pb.hidden, pb.disabled], [false, false], '3 つる②で「袋を選ぶ」が押せない');

 mark('4 「袋を選ぶ」：engine が示した袋が光る。選ぶまで何も始まらない');
 const s4 = await snapState();
 await clickBtn('pocketPick');
 const pick = await ev('freeFoldDebug.frame.pocket');
 assert.equal(pick && pick.mode, 'pick', '4 袋を選ぶ状態にならない');
 assert.deepEqual(pick.options.map(o => o.faceIds), [['paper/s1.keep/s2.cut', 'paper/s1.cut/s2.cut']], '4 光っている袋が engine の候補と違う');
 assert.deepEqual(pick.options, (await ev('FreeFoldEngine.squashOptions(freeFoldDebug.state).options')).map(o => ({ pocketId: o.pocketId, faceIds: o.faceIds })), '4 画面の袋が engine の squashOptions と違う');
 assert.equal(await snapState(), s4, '4 袋を選ぶ状態に入っただけで原本が変わった');
 assert.equal(await ev('freeFoldDebug.state.pending'), null, '4 選ぶ前に候補ができている');
 { const q = await point([.66, 0]);
   const green = await ev(`(() => { const g = document.getElementById('view').getContext('2d').getImageData(${Math.round(q[0])} - 6, ${Math.round(q[1])} - 6, 12, 12).data; let k = 0; for (let i = 0; i < g.length; i += 4) if (g[i + 1] > g[i] + 10 && g[i + 1] > 120) k++; return k })()`);
   assert.equal(green > 0, true, '4 袋が画面で緑に強調されていない') }
 /* 選ぶ前に角をつかんでも、ふつうの折りへ入らない（視点を回すだけ）。 */
 await grabAt([1, 1]); assert.equal(await ev('freeFoldDebug.dragSession && freeFoldDebug.dragSession.kind'), 'camera', '4 袋を選ぶあいだに角がつかめてしまう'); await dropAt([1, 1]);
 assert.equal(await ev('freeFoldDebug.state.pending'), null, '4 袋を選ぶあいだの角のしぐさで候補ができた');
 for (const id of ['op', 'lineMode', 'flip', 'kind', 'undo', 'save']) assert.equal((await btn(id)).disabled, true, '4 袋を選ぶあいだに ' + id + ' が押せる');
 shots.push(await shot('pocket-1-pick.png'));

 mark('5 紙の上の袋をタップして選ぶ');
 await tap(await point([.66, 0]));
 assert.equal(await ev('freeFoldDebug.pocket && freeFoldDebug.pocket.mode'), 'preview', '5 袋を選べない: ' + await status());
 assert.equal(await ev('freeFoldDebug.state.pending && freeFoldDebug.state.pending.inputMode'), 'squash', '5 engine の候補になっていない');
 assert.equal((await recipe()).version, 1, '5 選んだだけで v2 になった');
 assert.equal((await btn('pocketBar')).hidden, false, '5 プレビューの操作盤が出ない');
 assert.equal((await btn('confirm')).disabled, false, '5 確定が押せない');
 assert.equal(await ev('freeFoldDebug.frame.pocket.drawnBy'), 'engine-layers', '5 t=0 は engine の層で描いていない');

 mark('6 スライダーで途中へ：WebGL（depth バッファ）で連動運動を描く');
 const readMid = async label => {
  const f = await ev('freeFoldDebug.frame.pocket');
  assert.equal(f.drawnBy, 'webgl-depth', label + ' 途中が WebGL で描かれていない（' + f.drawnBy + ' t=' + f.t + '）');
  const want = await ev(`Array.from(FreeFoldEngine.squashPreview(freeFoldDebug.state).positions(${f.t}))`);
  const worst = f.positions.reduce((w, v, i) => Math.max(w, Math.abs(v - want[i])), 0);
  assert.equal(worst < 1e-6, true, label + ' 描いた座標が engine の再生結果（squash_model の連動）と違う: ' + worst);
  const lift = Math.max(...f.positions.filter((_, i) => i % 3 === 2).map(Math.abs));
  return { f, lift };
 };
 await setSlider(.42);
 const m6 = await readMid('6');
 assert.equal(m6.f.t > .3 && m6.f.t < .55, true, '6 スライダーで途中へ行かない: ' + m6.f.t);
 assert.equal(m6.lift > .05, true, '6 途中なのに紙が持ち上がっていない: ' + m6.lift);
 /* WebGL の行列と既存の project() が同じ所へ写す（2D の印と画素でずれない）。 */
 const align = await ev(`(() => { const m = freeFoldDebug.frame.pocket.mvp, P = freeFoldDebug.frame.pocket.positions; let w = 0;
  for (let i = 0; i < P.length; i += 3) { const X = P[i], Y = P[i + 1], Z = P[i + 2];
   const cx = m[0]*X + m[4]*Y + m[8]*Z + m[12], cy = m[1]*X + m[5]*Y + m[9]*Z + m[13];
   const sx = innerWidth / 2 + cx * innerWidth / 2, sy = innerHeight / 2 - cy * innerHeight / 2, q = freeFoldDebug.project([X, Z, -Y]);
   w = Math.max(w, Math.hypot(sx - q[0], sy - q[1])) } return w })()`);
 assert.equal(align < 1e-6, true, '6 WebGL の行列と画面の project() が食い違う: ' + align + 'px');
 const col6 = await ev('freeFoldDebug.pocketColors()');
 /* 上から見るカメラ（pitch 0.2〜1.35）では、つる②もつる③の最終形も見えるのは裏（白）＝赤が無いのは正しい。
   表裏の向きは下の「両端の直前直後が engine の層と同じ見え方か」で確かめる。 */
 assert.equal((col6.front || 0) + (col6.back || 0) > 5000, true, '6 途中で紙が描かれていない: ' + JSON.stringify(col6));
 shots.push(await shot('pocket-2-middle.png'));
 /* 始まりの直後（t=0.001）／終わりの直前（t=0.999）の見え方が、t=0／t=1（engine の層）と同じ
    ＝奥行きの前後・表裏の向きが、engine の層と表裏に食い違わない。 */
 for (const [edge, key] of [[0, 'ArrowRight'], [1, 'ArrowLeft']]) {
  const probes = edge ? [[.5, .35], [.5, -.35], [-.5, .35], [-.5, -.35], [.1, .8], [.1, -.8]] : [[.6, .3], [.6, -.3], [.85, 0]];
  await setSlider(edge); await poll(() => ev('freeFoldDebug.frame.pocket.t === ' + edge), 't=' + edge);
  const at0 = []; for (const p of probes) { const q = await point(p); at0.push(await ev(`Array.from(document.getElementById('view').getContext('2d').getImageData(${Math.round(q[0])}, ${Math.round(q[1])}, 1, 1).data)`)) }
  await ev(`document.getElementById('pocketT').focus()`); const vk = key === 'ArrowRight' ? 39 : 37;
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: vk }); await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: vk });
  await poll(() => ev(edge ? 'freeFoldDebug.frame.pocket.t < 1 && freeFoldDebug.frame.pocket.t > .99' : 'freeFoldDebug.frame.pocket.t > 0 && freeFoldDebug.frame.pocket.t < .01'), 'near ' + edge);
  const kind = c => (c[3] < 10 ? 'empty' : c[0] > 190 && c[1] < 130 && c[2] < 130 ? 'front' : c[0] > 200 && c[1] > 200 && c[2] > 200 ? 'back' : 'other');
  for (let i = 0; i < probes.length; i++) { const q = await point(probes[i]);
   const gl = await ev(`freeFoldDebug.pocketPixelAt(${q[0]}, ${q[1]})`);
   assert.equal(kind(gl), kind(at0[i]), `6 t=${edge} の直近の見え方が engine の層と違う（${probes[i]}：WebGL ${gl} / engine の層 ${at0[i]}）`) }
 }

 mark('7 「袋を開いてつぶす」で再生 → とめる → 逆再生 → 再生で最後まで');
 await clickBtn('pocketOpen');
 await poll(() => ev('freeFoldDebug.pocket.t > .25 && freeFoldDebug.pocket.dir > 0'), 'playing');
 await clickBtn('pocketStop');
 const tStop = await ev('freeFoldDebug.pocket.t'); await sleep(250);
 assert.equal(await ev('freeFoldDebug.pocket.t'), tStop, '7 とめても動いている');
 await readMid('7');
 await clickBtn('pocketBack');
 await poll(() => ev(`freeFoldDebug.pocket.dir < 0 && freeFoldDebug.pocket.t < ${tStop} - .05`), 'reverse');
 await clickBtn('pocketStop');
 await readMid('7逆');
 await clickBtn('pocketPlay');
 await poll(() => ev('freeFoldDebug.pocket.t === 1 && freeFoldDebug.pocket.dir === 0'), 'to the end', 200);
 const end = await ev('freeFoldDebug.frame.pocket');
 assert.equal(end.drawnBy, 'engine-layers', '7 t=1 を engine の層で描いていない');
 assert.equal(end.faces.length, 6, '7 つぶした形が6面でない');
 assert.equal((await recipe()).version, 1, '7 再生しただけで原本が変わった');

 mark('8 カメラを回す・ズーム（プレビューのまま）');
 await setSlider(.6); const before8 = await readMid('8前');
 { const a = [960, 330]; await press(a); await moveTo([900, 360]); await moveTo([860, 390]); await release([860, 390]) }
 await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 500, y: 400, deltaX: 0, deltaY: -240 });
 await sleep(100);
 const after8 = await readMid('8後');
 assert.notDeepEqual(after8.f.mvp, before8.f.mvp, '8 カメラを回しても描画の行列が変わらない');
 assert.equal(after8.f.t, before8.f.t, '8 カメラを回したら t が動いた');
 assert.equal(await ev('freeFoldDebug.pocket.mode'), 'preview', '8 カメラ操作でプレビューが終わった');
 assert.notEqual(await ev('freeFoldDebug.camera.zoom'), 1, '8 ズームしない');
 shots.push(await shot('pocket-3-camera.png'));

 mark('9 確定＝v2 の1手');
 const rev9 = await ev('freeFoldDebug.state.revision');
 await clickBtn('confirm');
 const r9 = await recipe();
 assert.deepEqual([r9.version, r9.steps.map(s => s.op)], [2, ['fold', 'fold', 'squash']], '9 確定で v2 の1手にならない: ' + await status());
 assert.equal(await ev('freeFoldDebug.state.revision'), rev9 + 1, '9 revision が1回だけ増えていない');
 assert.equal(await ev('freeFoldDebug.pocket'), null, '9 確定後も袋のモードが残る');
 assert.equal((await btn('pocketBar')).hidden, true, '9 確定後もプレビューの操作盤が出ている');
 assert.equal(await ev('freeFoldDebug.state.cache.faces.length'), 6, '9 確定後の紙が6面でない');
 assert.match(await status(), /袋を開いてつぶしました.*続けて折れます/, '9 確定後の案内が出ない: ' + await status());
 shots.push(await shot('pocket-4-confirmed.png'));
 /* 袋折りのあと：ふつうの折りのつかみは通る（2026-09-14・折れるかは engine が決める。確定までの検査は test_squash_after_browser.js）。
    ここでは「つかめる／取消で原本は不変／折る・山谷・折り目を引く・裏返す のボタンが押せる」だけを見る。 */
 const s9 = await snapState();
 await grabAt([0, 1]);
 assert.notEqual(await ev('freeFoldDebug.dragSession && freeFoldDebug.dragSession.kind'), 'camera', '9 袋折りのあとに角・辺がつかめない（視点が回った）');
 await carryTo([.3, .3]); await dropAt([.3, .3]);
 if (!(await btn('cancel')).disabled) await clickBtn('cancel');
 assert.equal(await ev('freeFoldDebug.state.pending'), null, '9 取消しても候補が残る');
 assert.equal(await snapState(), s9, '9 袋折りのあとのしぐさ（取消）で原本が変わった');
 for (const id of ['op', 'kind', 'lineMode', 'flip']) assert.equal((await btn(id)).disabled, false, '9 袋折りのあとに ' + id + ' が押せない');
 assert.equal((await btn('pocketPick')).hidden, true, '9 袋折りのあとに「袋を選ぶ」が出ている');

 mark('10 保存（画面のボタン）→ 読み直し');
 for (const f of await fs.readdir(downloads)) if (f.endsWith('.origami.json')) await fs.unlink(path.join(downloads, f)).catch(() => {});
 await clickBtn('save');
 const file = await poll(async () => (await fs.readdir(downloads)).find(v => v.endsWith('.origami.json')), 'download');
 const saved = JSON.parse(await fs.readFile(path.join(downloads, file), 'utf8'));
 assert.equal(saved.version, 2, '10 保存した原本が v2 でない');
 const same10 = await ev(`(() => { const r = FreeFoldEngine.replay(${JSON.stringify(saved)}), st = freeFoldDebug.state;
  return r.hash === st.cache.hash && JSON.stringify(r.squash) === JSON.stringify(st.cache.squash) })()`);
 assert.equal(same10, true, '10 保存した原本を読み直すと紙・運動の枝が違う');

 mark('11 undo / redo（画面のボタン）');
 const h11 = await ev('freeFoldDebug.state.cache.hash');
 await clickBtn('undo');
 assert.deepEqual(await ev('({ v: freeFoldDebug.state.recipe.version, n: freeFoldDebug.state.recipe.steps.length })'), { v: 2, n: 2 }, '11 undo 1回で袋折りだけ外れない');
 assert.equal((await btn('pocketPick')).hidden, false, '11 undo 後に「袋を選ぶ」が戻らない');
 assert.equal((await btn('op')).disabled, false, '11 undo 後にふつうの操作が戻らない');
 await clickBtn('redo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h11, '11 redo で袋折りに戻らない');
 await clickBtn('undo');

 mark('12 取消：袋を選んで途中まで再生 → 取消で正式状態は不変');
 const s12 = await snapState();
 await clickBtn('pocketPick'); await tap(await point([.66, 0]));
 assert.equal(await ev('freeFoldDebug.pocket && freeFoldDebug.pocket.mode'), 'preview', '12 もう一度袋を選べない');
 await clickBtn('pocketOpen');
 await poll(() => ev('freeFoldDebug.pocket.t > .2'), 'playing again');
 await clickBtn('cancel');
 assert.equal(await ev('freeFoldDebug.pocket'), null, '12 取消で袋のモードが終わらない');
 assert.equal(await ev('freeFoldDebug.state.pending'), null, '12 取消で候補が消えない');
 assert.equal(await snapState(), s12, '12 取消で原本・ハッシュ・revision・redo が変わった');
 assert.equal((await btn('pocketBar')).hidden, true, '12 取消後もプレビューの操作盤が出ている');
 assert.equal(await ev('freeFoldDebug.pocketCanvasHidden'), true, '12 取消後も WebGL の紙が残っている');
 await sleep(200); assert.equal(await snapState(), s12, '12 取消のあと再生が裏で動いて原本が変わった');

 assert.deepEqual(errors.map(e => JSON.stringify(e).slice(0, 300)), [], 'console にエラー');
 console.log(JSON.stringify({ result: 'PASS', screenshots: shots, middleLift: m6.lift, glVsProject: align, colorsMiddle: col6,
  note: '厚み0。紙どうしの貫通（すり抜け）は未検証', consoleErrors: errors.length }, null, 1));
}
main().then(async () => { await shutdown(); process.exit(0) }, async e => { console.error(e); await shutdown(); process.exit(1) });
