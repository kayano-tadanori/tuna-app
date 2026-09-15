'use strict';
/* 実Chrome：試作画面（squash_preview.html）を本当に開いて、往復再生・端点・途中・カメラ変更を見る。
   ★見るのは**実際に塗られた画素**と、画面自身が描画へ渡した座標。内部のフラグでごまかさない。
   ⛔ 既存の自由折り画面・エンジン・作品・JSON形式は触らない。

   使い方：  node test_squash_preview_browser.js
   （Chrome の場所は ORIGAMI_CHROME で変えられる）
*/
const fsp = require('node:fs/promises'), fs = require('node:fs'), path = require('node:path');
const os = require('node:os'), http = require('node:http'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const HERE = __dirname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mark = s => process.stderr.write(new Date().toISOString().slice(11, 19) + ' ' + s + '\n');
async function poll(fn, label, tries = 100) {
 for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await sleep(100); }
 throw Error('timeout ' + label);
}
let browser, ws, server, temp, cdpRef = null;
async function shutdown() {
 try { await Promise.race([cdpRef && cdpRef('Browser.close'), sleep(3000)]) } catch {}
 try { ws && ws.close() } catch {}
 try { browser && browser.kill() } catch {}
 try { server && server.close() } catch {}
}

async function main() {
 temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'squash-preview-'));
 mark('server');
 const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
 server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'squash_preview.html';
  const file = path.join(HERE, rel);
  if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
 });
 await new Promise(r => server.listen(0, '127.0.0.1', r));
 const base = 'http://127.0.0.1:' + server.address().port + '/squash_preview.html';

 mark('chrome spawn');
 browser = spawn(process.env.ORIGAMI_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + path.join(temp, 'profile'),
   /* ⚠--use-gl=swiftshader だけでは WebGL が何も描かない（実機で踏んだ）。ANGLE も指定する。 */
   '--window-size=980,820', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
   '--no-first-run', '--no-default-browser-check', '--disable-gpu-sandbox', base],
  { stdio: ['ignore', 'ignore', 'pipe'] });
 let wsURL = '';
 browser.stderr.on('data', d => { const m = /ws:\/\/[^\s]+/.exec(String(d)); if (m && !wsURL) wsURL = m[0]; });
 await poll(async () => wsURL, 'devtools url');
 ws = new (require('node:worker_threads'), globalThis.WebSocket)(wsURL);
 await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
 let n = 0; const pending = new Map(), errors = [];
 let sessionId = null;
 ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.no(Error(JSON.stringify(m.error))) : p.ok(m.result); } }
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(JSON.stringify(m.params.args));
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' +
   (m.params.exceptionDetails.exception || {}).description);
 };
 const raw = (method, params, sid) => new Promise((ok, no) => {
  const id = ++n; pending.set(id, { ok, no });
  ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params }));
 });
 cdpRef = raw;
 const targets = await poll(async () => {
  const { targetInfos } = await raw('Target.getTargets', {});
  return targetInfos.find(t => t.type === 'page' && t.url.startsWith('http'));
 }, 'page target');
 sessionId = (await raw('Target.attachToTarget', { targetId: targets.targetId, flatten: true })).sessionId;
 const cdp = (m, p) => raw(m, p, sessionId);
 await cdp('Runtime.enable', {}); await cdp('Page.enable', {});
 /* 画面の大きさを決めうちにする＝スクショで下のバーや検証表示が切れない。 */
 await cdp('Emulation.setDeviceMetricsOverride',
  { width: 980, height: 1000, deviceScaleFactor: 1, mobile: false });
 const ev = async expr => {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.text + ' | ' + expr);
  return r.result.value;
 };
 const shot = async name => { const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  const f = path.join(os.tmpdir(), name); await fsp.writeFile(f, Buffer.from(data, 'base64')); return f; };
 const click = id => ev(`document.getElementById('${id}').click()`);
 const setT = v => ev(`squashDebug.t = ${v}`);
 const colors = () => ev('squashDebug.colors()');
 const verify = () => ev('squashDebug.verify()');

 await poll(async () => ev('typeof squashDebug !== "undefined" && !!squashDebug.frame'), 'page ready');
 const shots = [];

 mark('1 はじめの画面：紙とボタンだけ／持ち上げ0（素材の幾何そのまま）');
 assert.equal(await ev('squashDebug.lift'), 0, '1 はじめから持ち上げが入っている');
 assert.equal(await ev('squashDebug.frame.lift'), 0, '1 描画へ渡した座標に持ち上げが入っている');
 assert.equal(await ev('squashDebug.showInsp'), false, '1 検証表示が最初から開いている');
 assert.equal(await ev(`getComputedStyle(document.getElementById('panel')).display`), 'none',
  '1 検証表示のパネルが見えている');
 for (const id of ['play', 'back', 'stop', 'reset', 't', 'insp'])
  assert.equal(await ev(`!!document.getElementById('${id}')`), true, '1 ボタン ' + id + ' が無い');
 assert.match(await ev('squashDebug.stage'), /まだ おっていません/, '1 はじめの案内が違う');
 const c0 = await colors();
 assert.equal(c0.front + c0.back > c0.total * 0.03, true,
  '1 紙が描かれていない（front=' + c0.front + ' back=' + c0.back + '）');
 shots.push(await shot('squash-1-start.png'));

 mark('2 端点と途中：素材の幾何（厚み0）の検証が通る＝共有境界が離れない');
 for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  await setT(t);
  const v = await verify();
  assert.equal(v.ok, true, '2 t=' + t + ' の検証が落ちた: ' +
   v.checks.filter(c => !c.ok).map(c => c.name + '(' + c.detail + ')').join(' / '));
  assert.equal(v.penetration.length, 0, '2 t=' + t + ' で紙の交差を見つけた: ' + v.penetration.join(','));
  /* 共有境界は「離れない（0）」で見る。隙間を許容する基準は使わない。 */
  const gap = await ev(`(() => { const pl = SquashModel.panels(${t}); let g = 0;
   for (const [a, b] of SquashModel.SHARED) g = Math.max(g, Math.hypot(
    pl[a][2][0]-pl[b][1][0], pl[a][2][1]-pl[b][1][1], pl[a][2][2]-pl[b][1][2]));
   return g })()`);
  assert.equal(gap < 1e-9, true, '2 t=' + t + ' で共有境界が離れた: ' + gap);
 }
 await setT(0.5); shots.push(await shot('squash-2-middle.png'));
 assert.match(await ev('squashDebug.stage'), /ひらいて/, '2 途中の案内が違う');
 await setT(1); shots.push(await shot('squash-3-end.png'));
 assert.match(await ev('squashDebug.stage'), /ぺたんと/, '2 終わりの案内が違う');

 mark('3 表と裏を描き分けている（実際の画素で見る）');
 await setT(0.42);
 const cm = await colors();
 assert.equal(cm.front > cm.total * 0.01 && cm.back > cm.total * 0.005, true,
  '3 おもて（きいろ）と うら（しろ）の両方が出ていない: ' + JSON.stringify(cm));

 mark('4 端点と途中で絵が違う（同じ絵を出していない）');
 await setT(0); const p0 = await colors();
 await setT(0.5); const p5 = await colors();
 await setT(1); const p1 = await colors();
 assert.equal(p0.front !== p5.front && p5.front !== p1.front, true,
  '4 端点と途中で絵が変わっていない: ' + JSON.stringify([p0.front, p5.front, p1.front]));

 mark('5 さいせい → 1で折り返して往復する');
 await ev('squashDebug.t = 0.90');
 await click('play');
 assert.equal(await ev('squashDebug.dir'), 1, '5 さいせいで進まない');
 const turned = await poll(async () => (await ev('squashDebug.dir')) === -1, '折り返し', 120);
 assert.equal(turned, true, '5 端で折り返さない');
 const tAfter = await ev('squashDebug.t');
 assert.equal(tAfter <= 1 && tAfter > 0.5, true, '5 折り返しの位置が変: ' + tAfter);
 const back0 = await poll(async () => (await ev('squashDebug.t')) < 0.5, '戻ってくる', 120);
 assert.equal(back0, true, '5 逆向きに戻ってこない');
 shots.push(await shot('squash-4-playing.png'));

 mark('6 ぎゃくさいせい と とめる');
 await ev('squashDebug.t = 0.6');
 await click('back');
 assert.equal(await ev('squashDebug.dir'), -1, '6 ぎゃくさいせいにならない');
 await poll(async () => (await ev('squashDebug.t')) < 0.55, '逆に進む', 60);
 await click('stop');
 assert.equal(await ev('squashDebug.dir'), 0, '6 とまらない');
 const held = await ev('squashDebug.t'); await sleep(400);
 assert.equal(Math.abs(await ev('squashDebug.t') - held) < 1e-9, true, '6 とめたのに動いた');
 await click('reset');
 assert.equal(await ev('squashDebug.t'), 0, '6 さいしょへ戻らない');

 mark('7 カメラを回して・寄って、絵が変わる');
 await setT(0.45);
 const before = await colors();
 await ev('squashDebug.setCam(1.9, 0.35, 3.2)');
 const rotated = await colors();
 assert.equal(rotated.front !== before.front, true, '7 カメラを回しても絵が同じ');
 shots.push(await shot('squash-5-camera.png'));
 await ev('squashDebug.setCam(1.9, 0.35, 1.9)');
 const zoomed = await colors();
 assert.equal(zoomed.front + zoomed.back > rotated.front + rotated.back, true, '7 寄っても大きくならない');
 await ev('squashDebug.setCam(0.62, -0.8, 3.2)');       /* 下から見る */
 const below = await colors();
 assert.equal(below.front + below.back > below.total * 0.03, true, '7 下から見ると紙が消える');
 shots.push(await shot('squash-6-from-below.png'));
 await ev('squashDebug.setCam(0.62, 0.62, 3.2)');

 mark('8 検証表示：中身と「非貫通は未検証」');
 await click('insp');
 assert.equal(await ev('squashDebug.showInsp'), true, '8 検証表示が開かない');
 assert.equal(await ev(`getComputedStyle(document.getElementById('panel')).display`) !== 'none', true,
  '8 検証表示のパネルが出ない');
 const text = await ev(`document.getElementById('panel').textContent`);
 assert.match(text, /非貫通は未検証/, '8 「非貫通は未検証」が出ていない');
 assert.match(text, /tan\(γ1\/2\)/, '8 連動式が出ていない');
 assert.match(text, /共有境界/, '8 共有境界の検証が出ていない');
 assert.equal(/NG/.test(await ev(
  `[...document.querySelectorAll('#panel .ng')].map(e=>e.textContent).join('|')||'なし'`)), false,
  '8 検証表示に NG が出ている: ' + await ev(
   `[...document.querySelectorAll('#panel .ng')].map(e=>e.textContent).join('|')`));
 shots.push(await shot('squash-7-inspect.png'));
 await click('insp');
 assert.equal(await ev('squashDebug.showInsp'), false, '8 検証表示が閉じない');

 mark('9 画面が描画へ渡した座標が、素材の幾何と同じ（持ち上げ0のとき）');
 await setT(0.33);
 assert.equal(await ev(`(() => { const f = squashDebug.frame, pl = SquashModel.panels(f.t);
  return f.lift === 0 && f.positions.every((v, i) =>
   Math.abs(v - pl[Math.floor(i/9)][Math.floor(i/3)%3][i%3]) < 1e-6) })()`), true,
  '9 画面が渡した座標が素材の幾何と違う');

 mark('10 実験設定：持ち上げは検証表示の中だけ／合格基準は厚み0のまま');
 await click('insp');
 assert.equal(await ev(`!!document.getElementById('expLift')`), true, '10 実験のチェックが無い');
 await ev(`document.getElementById('expLift').click()`);
 assert.equal(await ev('squashDebug.lift'), await ev('squashDebug.expLift'), '10 実験を入れても持ち上がらない');
 assert.equal(await ev('squashDebug.frame.lift') > 0, true, '10 描画へ渡す座標に反映されていない');
 assert.equal((await verify()).ok, true, '10 実験を入れたら合格基準が落ちた（分かれていない）');
 const gapExp = await ev(`(() => { const pl = SquashModel.panels(squashDebug.t); let g = 0;
  for (const [a, b] of SquashModel.SHARED) g = Math.max(g, Math.hypot(
   pl[a][2][0]-pl[b][1][0], pl[a][2][1]-pl[b][1][1], pl[a][2][2]-pl[b][1][2])); return g })()`);
 assert.equal(gapExp < 1e-9, true, '10 実験を入れたら素材の幾何まで離れた: ' + gapExp);
 const expText = await ev(`document.getElementById('panel').textContent`);
 assert.match(expText, /描画上の調整（実験・合格基準ではない）/, '10 実験だと書いていない');
 assert.match(expText, /合格基準には使わない/, '10 合格基準に使わないと書いていない');
 shots.push(await shot('squash-8-experiment.png'));
 await ev(`document.getElementById('expLift').click()`);
 assert.equal(await ev('squashDebug.lift'), 0, '10 実験を切っても戻らない');
 await click('insp');

 assert.deepEqual(errors, [], 'console にエラー');
 console.log(JSON.stringify({
  result: 'PASS', url: base,
  checked: ['はじめは紙とボタンだけ（検証表示はしまってある）', '端点と途中で描画座標の検証が通る',
            '表と裏を画素で描き分け', '往復再生（端で折り返す）', 'ぎゃくさいせい・とめる・さいしょへ',
            'カメラ回転・ズーム・下から', '検証表示に非貫通は未検証と明記', '画面の座標＝素材の幾何（持ち上げ0）',
            '実験の持ち上げは検証表示の中だけ・合格基準は厚み0のまま'],
  sharedBoundary: '全コマ 0（離れない）＝合格基準は厚み0の素材の幾何だけ',
  penetrationFound: 'なし（⛔非貫通は未検証。簡易な見張りだけ）',
  consoleErrors: errors.length, screenshots: shots,
 }, null, 1));
}
main().then(shutdown, async e => { await shutdown(); console.error(e); process.exit(1); });
