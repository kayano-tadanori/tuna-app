'use strict';
/* 実Chrome：花弁折りの独立プレビュー（petal_preview.html）を**ボタンとスライダーの操作で**確かめる（2026-09-15）。
   データは check_petal_fold.py --preview が書く petal_preview_data.js（検証モデルの座標だけ）。本体の JS は読み込まない。
   見ること：
     - θ ボタン（0/90/180）と視点ボタン（正面・裏面・側面2つ・斜め）が効き、画面の θ と視点が変わる
     - 正面 θ=180 で、終端の積み順の一番上の面の色（表裏）が、その面の向きから決まる色になっている
       （T1R＝裏が上、S2R＝裏が上、L1R＝裏が上：[4e] の表/裏）＋ ドラッグで回転しても例外が出ない
     - 画面写しを保存（目で見る用）
   使い方： node test_petal_preview_browser.js   （写しは ORIGAMI_SHOTS か一時フォルダ）
*/
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http'),
 { spawn } = require('node:child_process'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const SHOTS = process.env.ORIGAMI_SHOTS || os.tmpdir();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function poll(fn, label, tries = 150) { for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await sleep(100) } throw Error('timeout ' + label) }
let browser, ws, server, temp;
async function main() {
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'petal-preview-'));
 server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x').pathname; if (u === '/favicon.ico') return res.writeHead(204).end();
  const f = path.resolve(DIR, '.' + decodeURIComponent(u)); if (!f.startsWith(path.resolve(DIR) + path.sep)) return res.writeHead(403).end();
  try { const b = await fs.readFile(f); res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8'); res.end(b) } catch { res.writeHead(404).end() } });
 await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok) });
 browser = spawn(process.env.ORIGAMI_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + path.join(temp, 'profile'), '--no-first-run', '--no-default-browser-check',
   '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
 const port = await poll(async () => { try { return Number((await fs.readFile(path.join(temp, 'profile', 'DevToolsActivePort'), 'utf8')).split('\n')[0]) } catch { return 0 } }, 'chrome');
 const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
 ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no });
 let n = 0; const pending = new Map(), errors = [];
 ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.no(Error(JSON.stringify(m.error))) : p.ok(m.result) } }
  else if (m.method === 'Runtime.exceptionThrown' || m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m) };
 const cdp = (method, params = {}) => new Promise((ok, no) => { const id = ++n; pending.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params })) });
 const ev = async expression => { const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails).slice(0, 600)); return r.result.value };
 const mouse = (type, q, buttons = 0) => cdp('Input.dispatchMouseEvent', { type, x: q[0], y: q[1], button: 'left', buttons, clickCount: 1 });
 const tap = async q => { await mouse('mousePressed', q, 1); await mouse('mouseReleased', q) };
 const clickBtn = async id => { const r = await ev(`(() => { const b = document.getElementById('${id}'); b.scrollIntoView({block:'center'}); const q = b.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2] })()`); await sleep(50); await tap(r) };
 const shot = async name => { await ev(`document.getElementById('stage').scrollIntoView({block:'start'})`); await sleep(80);
  const png = await cdp('Page.captureScreenshot', { format: 'png' }), f = path.join(SHOTS, name); await fs.writeFile(f, Buffer.from(png.data, 'base64')); return f };
 await cdp('Page.enable'); await cdp('Runtime.enable');
 await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 1100, deviceScaleFactor: 1, mobile: false });
 await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/petal_preview.html` });
 await poll(() => ev('!!window.petalDebug'), 'page');
 const data = await ev('({ order: PETAL.endOrderTopFirst, faces: PETAL.faces.map(f => f.id), last: PETAL.frames[180], first: PETAL.frames[0] })');
 const shots = [];
 const colorAt = async (face, frame) => {   // 面の重心を画面に写した点の色（その面が一番上のはずの点で読む）
  const fi = data.faces.indexOf(face), tri = data[frame][fi]; const c = [0, 1, 2].map(i => (tri[0][i] + tri[1][i] + tri[2][i]) / 3);
  const q = await ev(`petalDebug.project([${c}])`); return ev(`petalDebug.pixel(${q[0]}, ${q[1]})`) };
 const isPink = px => px[0] > 200 && px[1] < 170 && px[2] < 200, isWhite = px => px[0] > 240 && px[1] > 240 && px[2] > 240;
 // 正面 θ=0：一番上の層（花弁・T1）は素材の裏が上＝ピンク
 await clickBtn('vFront'); await clickBtn('t0');
 assert.equal((await ev('petalDebug.state')).theta, 0);
 assert.ok(isPink(await colorAt('T2R', 'first')), '正面 θ=0 で花弁が裏（ピンク）でない');
 shots.push(await shot('petal_front_000.png'));
 for (const [btn, name] of [['t90', 'petal_front_090.png']]) { await clickBtn(btn); shots.push(await shot(name)) }
 await clickBtn('t180'); assert.equal((await ev('petalDebug.state')).theta, 180);
 // 終端・正面：[4e] で一番上の T1R・S2R・L1R は裏が上＝ピンク
 for (const f of ['T1R', 'S2R', 'L1R']) assert.ok(isPink(await colorAt(f, 'last')), `正面 θ=180 で ${f} が裏（ピンク）でない`);
 shots.push(await shot('petal_front_180.png'));
 // 役割の色で終端の正面（どの面が上か）
 await clickBtn('cRole'); shots.push(await shot('petal_front_180_role.png')); await clickBtn('cSide');
 // 裏面
 await clickBtn('vBack'); assert.equal((await ev('petalDebug.state')).view, 'back');
 shots.push(await shot('petal_back_180.png'));
 // 側面・斜め（途中）
 await clickBtn('vSideA'); await clickBtn('t90'); shots.push(await shot('petal_sideA_090.png'));
 await clickBtn('t135'); shots.push(await shot('petal_sideA_135.png'));
 await clickBtn('vSideB'); await clickBtn('t90'); shots.push(await shot('petal_sideB_090.png'));
 await clickBtn('vObl'); await clickBtn('t45'); shots.push(await shot('petal_obl_045.png'));
 await clickBtn('t135'); shots.push(await shot('petal_obl_135.png'));
 // スライダーをつまんで動かす（画面の操作）・ドラッグで回転
 const r = await ev(`(() => { const q = document.getElementById('theta').getBoundingClientRect(); return [q.left, q.width, q.top + q.height / 2] })()`);
 await tap([r[0] + 8 + (r[1] - 16) * 0.5, r[2]]); const th = (await ev('petalDebug.state')).theta; assert.ok(th > 70 && th < 110, 'スライダーの真ん中で θ≈90 にならない: ' + th);
 const s = await ev(`(() => { const q = document.getElementById('stage').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2] })()`);
 await mouse('mousePressed', s, 1); for (let i = 1; i <= 8; i++) await mouse('mouseMoved', [s[0] + i * 12, s[1] + i * 5], 1); await mouse('mouseReleased', [s[0] + 96, s[1] + 40]);
 assert.equal((await ev('petalDebug.state')).view, 'free');
 shots.push(await shot('petal_drag.png'));
 // 携帯の幅（400px）で横にはみ出さない
 await cdp('Emulation.setDeviceMetricsOverride', { width: 400, height: 1300, deviceScaleFactor: 1, mobile: true }); await sleep(300);
 const wd = await ev('[document.documentElement.scrollWidth, innerWidth]');
 assert.ok(wd[0] <= wd[1], '400px 幅で横にはみ出す: ' + wd);
 { const png = await cdp('Page.captureScreenshot', { format: 'png' }), f = path.join(SHOTS, 'petal_narrow.png'); await fs.writeFile(f, Buffer.from(png.data, 'base64')); shots.push(f) }
 assert.deepEqual(errors, [], 'ページで例外: ' + JSON.stringify(errors).slice(0, 400));
 console.log('  ok プレビュー：θ・視点・色のボタン、スライダー、ドラッグ回転。正面の表裏の色（θ=0 花弁／θ=180 T1R・S2R・L1R が裏）');
 console.log('  写し：\n    ' + shots.join('\n    '));
}
main().then(() => 0, e => { console.error(e); return 1 }).then(async code => {
 try { browser && browser.kill() } catch {} try { ws && ws.close() } catch {} try { server && server.close() } catch {}
 await sleep(300); if (temp) await fs.rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
 process.exit(code) });
