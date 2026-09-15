'use strict';
/* 🧺 実Chrome：袋折りの準備（検証器の schema の読込み）を、開き方に依らず確実にする（2026-09-14・本人の実機で発覚）。
   原因：freefold3d.html を file:// で開くと、fetch('origami_recipe.schema.json') を Chrome が「Failed to fetch」で断り、
         その失敗が「詳しく」の「袋を選べない理由」の奥に隠れていた（本人の Chrome 履歴＝file:///…/tools/freefold3d.html）。
   直し：schema は <script src="origami_recipe.schema.js">（正本の JSON から schema_js.js が作る）で読む＝file:// でも http でも同じ。
         読めなければ上の赤い帯「袋折りの準備に失敗しました」＋再試行。再試行はページを読み直さない＝折った紙はそのまま。
   見ること：
   A file:// で開く → 準備OK → 裏返す・2回折る・袋を選ぶ・開く・確定（画面の操作だけ）
   B http で schema を読めない → 赤い帯（「詳しく」の奥に入れない）→ 2回折る → まだ読めないまま再試行（失敗のまま・紙は不変）
     → 読めるようにして再試行 → 準備OK・紙は不変・「袋を選ぶ」が出る
   C 壊れた schema → 検証器が断る（検証を省いて通さない）
   D schema.js が正本の JSON と一致（node schema_js.js --check）
   使い方： ORIGAMI_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" [FEEL_SHOTS=保存先] node test_ready_browser.js
*/
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http'),
 { spawn } = require('node:child_process'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const SHOTS_DIR = process.env.FEEL_SHOTS || os.tmpdir();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mark = s => console.log(new Date().toISOString().slice(11, 19), s);
async function poll(fn, label, tries = 150) { for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await sleep(100) } throw Error('timeout ' + label) }
let browser, ws, server, temp, cdpRef = null;
const MODE = { schema: 'ok' };
async function shutdown() {
 try { await Promise.race([cdpRef && cdpRef('Browser.close'), sleep(3000)]) } catch {}
 try { ws && ws.close() } catch {} try { browser && browser.kill() } catch {} try { server && server.close() } catch {}
 await sleep(300); if (temp) await fs.rm(temp, { recursive: true, force: true, maxRetries: 7, retryDelay: 300 }).catch(() => {});
}
async function main() {
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ready-'));
 await fs.mkdir(SHOTS_DIR, { recursive: true });
 server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x').pathname; if (u === '/favicon.ico') return res.writeHead(204).end();
  const f = path.resolve(DIR, '.' + decodeURIComponent(u)); if (!f.startsWith(path.resolve(DIR) + path.sep)) return res.writeHead(403).end();
  /* 検査用のつまみ：schema の script を 404 にする（サーバーが止まった・ファイルが無い）／壊れた schema を返す（検証を省かない確認） */
  if (u === '/origami_recipe.schema.js' && MODE.schema === 'block') return res.writeHead(404).end();
  if (u === '/origami_recipe.schema.js' && MODE.schema === 'bad') { res.setHeader('Content-Type', 'text/javascript'); return res.end('globalThis.ORIGAMI_RECIPE_SCHEMA = { properties: { version: { const: 2 } } };') }
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
 const hover = q => cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q[0], y: q[1], buttons: 0 });
 const tap = async q => { await press(q); await release(q) };
 const grabAt = async p => press(await point(p)), carryTo = async p => moveTo(await point(p)), dropAt = async p => release(await point(p));
 const hoverTo = async p => hover(await point(p));
 const status = () => ev('freeFoldDebug.status');
 const clickBtn = async id => { const r = await ev(`(() => { const b = document.getElementById('${id}'); if (!b || b.hidden) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, disabled: b.disabled } })()`);
  assert.notEqual(r, null, 'ボタン ' + id + ' が見えていない'); assert.equal(r.disabled, false, 'ボタン ' + id + ' が押せない（' + await status() + '）'); await tap([r.x, r.y]) };
 const btn = id => ev(`(() => { const b = document.getElementById('${id}'); return { hidden: b.hidden, disabled: b.disabled, text: b.textContent } })()`);
 const recipe = () => ev('JSON.parse(JSON.stringify(freeFoldDebug.state.recipe))');
 const snapState = () => ev(`JSON.stringify({ r: freeFoldDebug.state.recipe, h: freeFoldDebug.state.cache.hash, rev: freeFoldDebug.state.revision, redo: freeFoldDebug.state.redoStack })`);
 const shots = [];
 const shotTo = async name => { const png = await cdp('Page.captureScreenshot', { format: 'png' }), f = path.join(SHOTS_DIR, name); await fs.writeFile(f, Buffer.from(png.data, 'base64')); shots.push(f); return f };
 const fxKinds = async () => (await ev('freeFoldDebug.frame.fx')).map(f => f.kind);
 const statusColor = () => ev(`getComputedStyle(document.getElementById('status')).color`);
 const pix = async (p, r, cond) => { const q = await point(p); return ev(`(() => { const d = document.getElementById('view').getContext('2d').getImageData(${Math.round(q[0])} - ${r}, ${Math.round(q[1])} - ${r}, ${2 * r}, ${2 * r}).data; let k = 0; for (let i = 0; i < d.length; i += 4) { const R = d[i], G = d[i + 1], B = d[i + 2]; if (${cond}) k++ } return k })()`) };
 const YEL = 'R>220&&G>180&&B<120', GRN = 'G>190&&R<140&&B>130&&B<200', BLUE = 'R>100&&R<180&&G>180&&B>220';
 const stackBtn = k => ev(`(() => { const b = [...document.querySelectorAll('#stackPick button')].find(b => b.dataset.n === '${k}'); if (!b) return null; const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2] })()`);

 await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Log.enable');
 await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 800, deviceScaleFactor: 1, mobile: false });

 const { execFileSync } = require('node:child_process');
 mark('D schema.js が正本の JSON と一致');
 execFileSync(process.execPath, [path.join(DIR, 'schema_js.js'), '--check'], { stdio: 'inherit', env: { ...process.env, ORIGAMI_SRC_DIR: DIR } });

 const readyOk = () => poll(() => ev('!freeFoldDebug.pocketReady.loading && (freeFoldDebug.pocketReady.ok || freeFoldDebug.pocketReady.failed)'), 'ready');
 const fold2 = async () => {
  await clickBtn('flip');
  await grabAt([-1, -1]); await carryTo([.1, 0]); await carryTo([1, 1]); await dropAt([1, 1]); await clickBtn('confirm');
  await grabAt([-1, 1]); await carryTo([0, 0]); await carryTo([1, -1]); await dropAt([1, -1]);
  const b2 = await poll(() => stackBtn(2), 'stack 2'); await tap(b2); await clickBtn('confirm');
  assert.deepEqual((await recipe()).steps.map(s => s.op), ['flip', 'fold', 'fold'], '2回折れない');
 };

 mark('A file:// で開く：準備OK → 画面の操作だけで袋折りまで');
 const fileUrl = 'file:///' + path.resolve(DIR).replace(/\\/g, '/').split('/').map((seg, k) => k === 0 ? seg : encodeURIComponent(seg)).join('/') + '/freefold3d.html';
 await cdp('Page.navigate', { url: fileUrl });
 await poll(() => ev('!!window.freeFoldDebug'), 'file page');
 assert.equal(await ev('location.protocol'), 'file:', 'A file:// で開けていない');
 await readyOk();
 assert.deepEqual([await ev('freeFoldDebug.pocketReady.ok'), await ev('freeFoldDebug.prep')], [true, null], 'A file:// で袋折りの準備ができない: ' + JSON.stringify(await ev('freeFoldDebug.pocketReady')));
 await fold2();
 assert.equal((await btn('pocketPick')).hidden, false, 'A file:// で「袋を選ぶ」が出ない');
 await clickBtn('pocketPick'); await tap(await point([.66, 0]));
 await clickBtn('pocketOpen'); await poll(() => ev('freeFoldDebug.pocket.t === 1 && freeFoldDebug.pocket.dir === 0'), 'open', 200);
 await clickBtn('confirm');
 assert.deepEqual((await recipe()).steps.map(s => s.op), ['flip', 'fold', 'fold', 'squash'], 'A file:// で袋折りを確定できない');
 await shotTo('ready-A-file.png');

 mark('B http で schema を読めない → 赤い帯（隠さない）→ 折る → 失敗のまま再試行 → 読めるようにして再試行（紙はそのまま）');
 MODE.schema = 'block';
 await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/freefold3d.html` });
 await poll(() => ev('!!window.freeFoldDebug'), 'http page'); await readyOk();
 { const r = await ev('freeFoldDebug.pocketReady');
   assert.deepEqual([r.ok, r.failed], [false, true], 'B 読めないのに準備が失敗にならない: ' + JSON.stringify(r));
   const bar = await ev(`(() => { const e = document.getElementById('prep'), q = e.getBoundingClientRect(); return { hidden: e.hidden, text: e.textContent, h: q.height, inDetails: !!e.closest('details') } })()`);
   assert.equal(bar.hidden, false, 'B 準備の失敗が画面に出ない');
   assert.equal(bar.inDetails, false, 'B 準備の失敗が「詳しく」の奥にある');
   assert.equal(bar.h > 10, true, 'B 準備の失敗の帯が見えていない');
   assert.match(bar.text, /袋折りの準備に失敗しました.*origami_recipe\.schema\.js を読めませんでした.*再試行/, 'B 帯の言葉が違う: ' + bar.text) }
 await fold2();
 assert.equal(await ev('freeFoldDebug.pocketWhy'), null, 'B 準備の失敗が「袋を選べない理由」に入っている');
 assert.equal((await btn('pocketPick')).hidden, true, 'B 準備できていないのに「袋を選ぶ」が出ている（検証を省いている）');
 await shotTo('ready-B-failed.png');
 const s0 = await snapState();
 await clickBtn('prepRetry'); await readyOk();
 assert.equal(await ev('freeFoldDebug.pocketReady.failed'), true, 'B まだ読めないのに再試行で通った');
 assert.equal(await snapState(), s0, 'B 失敗した再試行で折った紙が変わった');
 MODE.schema = 'ok';
 await clickBtn('prepRetry');
 await poll(() => ev('freeFoldDebug.pocketReady.ok'), 'retry ok');
 assert.equal(await ev('freeFoldDebug.prep'), null, 'B 準備できたのに赤い帯が残る');
 assert.equal(await snapState(), s0, 'B 再試行で折った紙（原本・hash・revision・redo）が変わった');
 assert.match(await status(), /袋折りの準備ができました（折った紙はそのままです）/, 'B 再試行の成功の案内が無い: ' + await status());
 await hover(await point([.9, .9]));
 assert.equal((await btn('pocketPick')).hidden, false, 'B 再試行のあと「袋を選ぶ」が出ない');
 await shotTo('ready-B-retried.png');

 mark('C 壊れた schema は検証器が断る（省いて通さない）');
 MODE.schema = 'bad';
 await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/freefold3d.html?bad=1` });
 await poll(() => ev('!!window.freeFoldDebug'), 'bad page'); await readyOk();
 { const r = await ev('freeFoldDebug.pocketReady');
   assert.deepEqual([r.ok, r.failed], [false, true], 'C 壊れた schema で準備が通った: ' + JSON.stringify(r));
   assert.match(r.reason, /schema/, 'C 断った理由が schema でない: ' + r.reason) }
 MODE.schema = 'ok';

 assert.deepEqual(errors.filter(e => !/origami_recipe\.schema\.js|404/.test(JSON.stringify(e))).map(e => JSON.stringify(e).slice(0, 300)), [], 'console にエラー（schema を 404 にした分は除く）');
 console.log(JSON.stringify({ result: 'PASS', screenshots: shots }, null, 1));
}
main().then(async () => { await shutdown(); process.exit(0) }, async e => { console.error(e); await shutdown(); process.exit(1) });
