'use strict';
/* 実Chrome：1作品で2回目の袋折りを **画面の操作で**（2026-09-15）。
   新しい紙 → 画面で2回折る → 袋を選ぶ → 確定 → 裏返す（ボタン）→「袋を選ぶ」→ 反対側の袋をタップ → プレビュー（途中）→ 確定
   → 保存ボタン → undo/redo ボタン → ページ再読込 → 保存原本を入れて undo/redo ボタン → 候補を取消。
   🚨折り・枚数・山谷・確定・undo/redo・保存はボタンと紙のしぐさで行う。
     コンソールで書くのは「再読込したページへ保存原本を入れる」1か所だけ（画面に読込の UI が無い）。ほかは読んで確かめるだけ。
   ⛔ 厚みは0。紙どうしの貫通（すり抜け）は未検証。
   使い方： ORIGAMI_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" node test_squash_twice_browser.js
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
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'squash-twice-')); const downloads = path.join(temp, 'downloads'); await fs.mkdir(downloads);
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


 const stackBtn = async n => { const r = await ev(`(() => { const b = [...document.querySelectorAll('#stackPick button')].find(b => b.dataset.n === '${n}'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2] })()`);
  assert.notEqual(r, null, '「上から' + n + '枚」のボタンが無い'); await tap(r) };
 /* 折れない理由は engine の setLayers の答え（画面は「詳しく」に入れる）＝layerPick.reason と「詳しく」の文を読む */
 const why = () => ev('(freeFoldDebug.layerPick && freeFoldDebug.layerPick.reason || "") + "｜" + (freeFoldDebug.detail || "")');
 const P3 = 'paper/s1.cut/s2.cut/s3.cut', P2 = 'paper/s1.keep/s2.cut/s3.keep';
 /* 袋の中の点（読むだけ）：engine が示した袋の面の重心 */
 const pocketPoint = () => ev(`(() => { const o = FreeFoldEngine.squashOptions(freeFoldDebug.state).options[0]; if (!o) return null;
  const f = o.outline[0]; return [f.reduce((s, p) => s + p[0], 0) / f.length, f.reduce((s, p) => s + p[1], 0) / f.length] })()`);

 mark('1 画面で2回折る → 袋を選ぶ → 確定（1回目の袋折り）');
 await grabAt([-1, -1]); await carryTo([.1, 0]); await carryTo([1, 1]); await dropAt([1, 1]);
 await clickBtn('confirm');
 await grabAt([-1, 1]); await carryTo([0, 0]); await carryTo([1, -1]); await dropAt([1, -1]);
 await poll(() => ev(`[...document.querySelectorAll('#stackPick button')].some(b => b.dataset.n === '2')`), 'stack pick 2');
 await stackBtn(2); await clickBtn('confirm');
 await clickBtn('pocketPick'); await tap(await point(await pocketPoint()));
 assert.equal(await ev('freeFoldDebug.pocket && freeFoldDebug.pocket.mode'), 'preview', '1 袋を選べない: ' + await status());
 await clickBtn('confirm');
 assert.deepEqual((await recipe()).steps.map(s => s.op), ['fold', 'fold', 'squash'], '1 1回目の袋折りが確定しない');
 const h1 = await ev('freeFoldDebug.state.cache.hash');
 /* 裏返していない紙：袋は選べない（袋の上に紙が乗っている）＝ボタンも案内も出ない */
 assert.equal((await btn('pocketPick')).hidden, true, '1 裏返していないのに「袋を選ぶ」が出ている');
 assert.match(await ev('FreeFoldEngine.squashOptions(freeFoldDebug.state).reason'), /袋の上に止まった紙が乗っています/, '1 裏返していない紙の理由が違う');
 shots.push(await shot('twice-1-first-squash.png'));

 mark('2 裏返す（画面のボタン）→「袋を選ぶ」と案内が出る');
 await clickBtn('flip');
 assert.deepEqual((await recipe()).steps.map(s => s.op), ['fold', 'fold', 'squash', 'flip'], '2 裏返せない');
 await poll(async () => !(await btn('pocketPick')).hidden, '2 pocketPick after flip');
 assert.match(await ev('freeFoldDebug.pocketHint') || '', /袋をタップすると開けます/, '2 反対側の袋が選べるのに案内が出ない');
 const h2 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('twice-2-flipped.png'));

 mark('3 「袋を選ぶ」→ 袋をタップ → プレビュー（途中は WebGL・両端は engine の層）');
 const s3 = await snapState();
 await clickBtn('pocketPick');
 const pick = await ev('freeFoldDebug.frame.pocket');
 assert.equal(pick && pick.mode, 'pick', '3 袋を選ぶ状態にならない');
 assert.equal(pick.options.length, 1, '3 光っている袋が1つでない');
 await tap(await point(await pocketPoint()));
 assert.equal(await ev('freeFoldDebug.pocket && freeFoldDebug.pocket.mode'), 'preview', '3 袋を選べない: ' + await status());
 assert.equal(await ev('freeFoldDebug.state.pending && freeFoldDebug.state.pending.inputMode'), 'squash', '3 engine の候補になっていない');
 assert.equal(await snapState(), s3, '3 選んだだけで原本が変わった');
 await setSlider(.5);
 const f3 = await ev('freeFoldDebug.frame.pocket');
 assert.equal(f3.drawnBy, 'webgl-depth', '3 途中が WebGL で描かれていない');
 const want3 = await ev(`Array.from(FreeFoldEngine.squashPreview(freeFoldDebug.state).positions(${f3.t}))`);
 assert.ok(f3.positions.reduce((w, v, i) => Math.max(w, Math.abs(v - want3[i])), 0) < 1e-6, '3 描いた座標が engine の再生と違う');
 assert.ok(Math.max(...f3.positions.filter((_, i) => i % 3 === 2)) > .05, '3 途中なのに袋が持ち上がっていない');
 assert.equal(Math.min(...f3.positions.filter((_, i) => i % 3 === 2)) > -1e-6, true, '3 途中で紙が基準面の下へ潜っている（丸め誤差 1e-6 まで）');
 shots.push(await shot('twice-3-middle.png'));
 await setSlider(1); await poll(() => ev('freeFoldDebug.frame.pocket.t === 1'), 't=1');
 assert.equal(await ev('freeFoldDebug.frame.pocket.drawnBy'), 'engine-layers', '3 t=1 が engine の層で描かれていない');
 shots.push(await shot('twice-4-end-preview.png'));

 mark('4 確定＝2回目の袋折り（1手）');
 await clickBtn('confirm');
 const r4 = await recipe();
 assert.deepEqual([r4.version, r4.steps.map(s => s.op)], [2, ['fold', 'fold', 'squash', 'flip', 'squash']], '4 2回目の袋折りが確定しない: ' + await status());
 assert.equal(await ev('freeFoldDebug.state.cache.faces.length'), 8, '4 面が8枚にならない');
 assert.equal(await ev('FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash'), true, '4 表示と原本の再生が違う');
 assert.equal(await ev('document.getElementById("steps").textContent'), '5手', '4 手の数の表示が違う');
 /* 形：外形は面積1の正方形・どこも4枚（読むだけ） */
 assert.equal(await ev(`(() => { const F = freeFoldDebug.state.cache.faces, xs = F.flatMap(f => f.poly.map(p => p[0])), ys = F.flatMap(f => f.poly.map(p => p[1]));
  return Math.abs((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) - 1) < 1e-9 })()`), true, '4 外形が正方形でない');
 const h4 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('twice-5-second-squash.png'));

 mark('5 保存（画面のボタン）→ 保存原本を再生して同じ');
 for (const f of await fs.readdir(downloads)) if (f.endsWith('.origami.json')) await fs.unlink(path.join(downloads, f)).catch(() => {});
 await clickBtn('save');
 const file = await poll(async () => (await fs.readdir(downloads)).find(v => v.endsWith('.origami.json')), 'download');
 const saved = JSON.parse(await fs.readFile(path.join(downloads, file), 'utf8'));
 assert.deepEqual([saved.version, saved.steps.map(s => s.op)], [2, ['fold', 'fold', 'squash', 'flip', 'squash']], '5 保存した原本が違う');
 assert.equal(await ev(`FreeFoldEngine.replay(${JSON.stringify(saved)}).hash`), h4, '5 保存した原本を再生すると違う');

 mark('6 undo / redo（画面のボタン）');
 await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h2, '6 undo で裏返した紙に戻らない');
 await clickBtn('redo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h4, '6 redo で同じ面・結び・層に戻らない');

 mark('7 ページ再読込 → 保存原本を入れる → undo / redo（画面のボタン）');
 await cdp('Page.reload', {});
 await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reload');
 /* 画面に読込の UI が無いので、ここだけコンソールで保存原本を入れる（engine の共通入口で再生した cache を置く） */
 await ev(`(() => { const st = freeFoldDebug.state, r = ${JSON.stringify(saved)}; st.recipe = r; st.cache = FreeFoldEngine.replay(r);
  st.revision = 0; st.cacheRevision = 0; st.committed = st.cache; st.redoStack = []; st.pending = null; return true })()`);
 await clickBtn('op'); await clickBtn('op');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h4, '7 再読込したページで保存原本が同じ状態にならない');
 await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h2, '7 再読込後の undo で裏返した紙に戻らない');
 await clickBtn('undo'); await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.faces.length'), 4, '7 再読込後の undo 3回で袋折りの前に戻らない');
 await clickBtn('redo'); await clickBtn('redo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h2, '7 再読込後の redo 2回で裏返した紙にならない');
 await clickBtn('redo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h4, '7 再読込後の redo 3回で同じ面・結び・層にならない');
 assert.equal(await ev('JSON.stringify(freeFoldDebug.state.recipe)'), JSON.stringify(saved), '7 undo/redo で原本の文字が変わった');
 shots.push(await shot('twice-6-reloaded.png'));

 mark('8 取消：候補も原本も戻る（失敗しても正式状態を保つ）');
 await clickBtn('undo');
 await clickBtn('pocketPick'); await tap(await point(await pocketPoint()));
 assert.equal(await ev('freeFoldDebug.state.pending && freeFoldDebug.state.pending.inputMode'), 'squash', '8 候補にならない');
 await clickBtn('cancel');
 assert.equal(await ev('freeFoldDebug.state.pending'), null, '8 取消で候補が消えない');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h2, '8 取消で紙が変わった');
 assert.deepEqual(errors.map(e => JSON.stringify(e).slice(0, 300)), [], 'console にエラー');
 console.log(JSON.stringify({ result: 'PASS', screenshots: shots, note: '厚み0。紙どうしの貫通（すり抜け）は未検証', consoleErrors: errors.length }, null, 1));
}
main().then(async () => { await shutdown(); process.exit(0) }, async e => { console.error(e); await shutdown(); process.exit(1) });
