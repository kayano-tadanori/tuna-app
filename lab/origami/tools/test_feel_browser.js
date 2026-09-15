'use strict';
/* 🖐 実Chrome：自由折り画面の「手触り」（2026-09-14・本人指示）。つかむ・吸着する・枚数を選ぶ場面。
   裏返す → 半分折り → 2回目の角合わせ（吸着）→ 上から1枚では折れない → 取消 → もう一度 → 2枚を選ぶ → 確定 → 袋折り → undo/redo。
   見ること：
   ① つかめる所の事前表示（ホバー＝pointerdown と同じ判定）／押した瞬間の一度だけの印と札／着地点が無いあいだ指についてくる印／タッチは触れた瞬間
   ② 吸着した瞬間だけ緑が一度広がる・保持中は出し続けない・離れたら解除の印
   ③ 枚数：動く紙の強調（engine の topFaces／プレビュー）・「角は合っています。重なった紙も一緒に」・枚数を勝手に増やさない
   ④ 常時の説明を減らす：新しい紙で「袋を選べない理由」を出さない・内部IDは「詳しく」・袋を選べるときは「袋をタップして開けます」
   画像：操作前・つかんだ瞬間・吸着時・枚数選択時（FEEL_SHOTS に保存）。
   ⛔ 幾何・成立判定・吸着距離と順位・保存形式は見ない（変えていない）＝既存の test_freefold_browser.js などが見る。
   使い方： ORIGAMI_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" [FEEL_SHOTS=保存先] node test_feel_browser.js
*/
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http'),
 { spawn } = require('node:child_process'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const SHOTS_DIR = process.env.FEEL_SHOTS || os.tmpdir();
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
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'feel-'));
 await fs.mkdir(SHOTS_DIR, { recursive: true });
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
 await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/freefold3d.html` });
 await poll(() => ev('!!window.freeFoldDebug'), 'page');
 await poll(() => ev('freeFoldDebug.pocketReady.ok'), 'pocket validator');

 mark('0 新しい紙：説明は畳まれ、袋の理由も「詳しく」も出ない');
 assert.equal(await ev(`document.getElementById('help').open`), false, '0 操作の説明が開いたまま（常時表示）');
 assert.equal(await ev('freeFoldDebug.pocketWhy'), null, '0 新しい紙で「袋を選べない理由」が出ている');
 assert.equal(await ev('freeFoldDebug.detail'), null, '0 新しい紙で「詳しく」が出ている');
 assert.equal(await ev('freeFoldDebug.pocketHint'), null, '0 新しい紙で袋の案内が出ている');

 mark('1 タッチ：触れた瞬間に、つかんだ角を示す（ホバー無し）');
 { const q = await point([1, -1]);
   await ev(`document.getElementById('view').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: ${q[0]}, clientY: ${q[1]}, button: 0, buttons: 1, bubbles: true }))`);
   assert.equal(await ev('freeFoldDebug.dragSession && freeFoldDebug.dragSession.source && freeFoldDebug.dragSession.source.type'), 'corner', '1 タッチで角をつかめない');
   assert.equal(await ev('freeFoldDebug.hover'), null, '1 タッチなのにホバーが残っている');
   const k = await fxKinds(); assert.equal(k.includes('grab') && k.includes('label'), true, '1 触れた瞬間の印（黄の輪＋札）が出ない: ' + k);
   assert.equal(await pix([1, -1], 16, YEL) > 30, true, '1 触れた角が黄でない');
   await ev(`document.getElementById('view').dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: ${q[0]}, clientY: ${q[1]}, button: 0, buttons: 0, bubbles: true }))`);
   assert.equal(await ev('freeFoldDebug.dragSession'), null, '1 指を離してもセッションが残る');
   assert.equal((await fxKinds()).includes('grab'), false, '1 離したのに、つかんだ瞬間の印が残る') }

 mark('2 裏返す → ホバーで、つかめる角を事前に示す（操作前の画像）');
 await clickBtn('flip');
 await hoverTo([-1, -1]);
 { const f = await ev('freeFoldDebug.frame');
   assert.equal(f.hover, 'corner:-1,-1', '2 ホバーした角が、つかむ対象として示されない: ' + f.hover);
   assert.deepEqual(f.handles.map(h => h.shape + ':' + h.role + ':' + h.color), ['corner-mark:grab:#ffffffaa'], '2 ホバーの印が白の角でない');
   assert.deepEqual(f.chips, ['角をつかめます'], '2 ホバーした角に「角をつかめます」の札が出ない: ' + JSON.stringify(f.chips)) }
 await shotTo('feel-1-before.png');
 await hoverTo([0, 1]); assert.equal(await ev('freeFoldDebug.frame.hover'), 'edge:paper|top', '2 辺のホバーが出ない');
 assert.match((await ev('freeFoldDebug.frame.chips')).join(), /辺をつかめます/, '2 辺のホバーに札が出ない');

 mark('3 1回目：角 (-1,-1) をつかむ（つかんだ瞬間の画像）→ 動かし始めは指についてくる → (1,1) へ');
 await grabAt([-1, -1]);
 { const k = await fxKinds(); assert.equal(k.includes('grab') && k.includes('label'), true, '3 つかんだ瞬間の印が出ない: ' + k);
   const lab = (await ev('freeFoldDebug.frame.fx')).find(f => f.kind === 'label'); assert.equal(lab.text, 'この角をつかみました', '3 札の言葉が違う');
   assert.equal(await pix([-1, -1], 30, YEL) > 60, true, '3 つかんだ角の黄が見えない') }
 await shotTo('feel-2-grab.png');
 { const q = await point([-1, -1]); await moveTo([q[0] + 5, q[1] - 4]);
   const f = await ev('freeFoldDebug.frame');
   assert.equal(!!f.follow && Math.hypot(f.follow[0] - q[0] - 5, f.follow[1] - q[1] + 4) < 1, true, '3 着地点が無いあいだ、指の下に印がつかない: ' + JSON.stringify(f.follow));
   assert.deepEqual(f.handles[0].at, [-1, -1], '3 指についてくる印のせいで、黄の持ち主（角）が動いた') }
 await carryTo([.1, 0]); await carryTo([1, 1]);
 assert.equal(await ev('freeFoldDebug.frame.follow'), null, '3 紙が指の所に着地しているのに、別の追従印も出ている');
 await dropAt([1, 1]);
 await clickBtn('confirm');
 await hoverTo([.9, .9]);
 assert.notEqual(await ev('freeFoldDebug.pocketWhy'), null, '3 折ったあとは「詳しく」に袋を選べない理由が入る');
 assert.equal(await ev(`document.getElementById('detail').open`), false, '3 「詳しく」が開いたまま（常時表示）');

 mark('4 2回目：角 (-1,1) を相手の角へ。吸着した瞬間だけ緑が一度広がる（吸着時の画像）');
 const recBefore = await snapState();
 await grabAt([-1, 1]); await carryTo([.5, .3]);/* どのガイドからも離れた紙の内側（(0,0) は1回目の折り山＝そこへの吸着は正しい） */
 assert.equal((await fxKinds()).includes('snap'), false, '4 吸着していないのに吸着の印が出た');
 const B = await point([1, -1]);
 await moveTo([B[0] - 12, B[1] - 8]);
 assert.equal(await ev('freeFoldDebug.dragSession.aim && freeFoldDebug.dragSession.aim.snapped'), true, '4 相手の角に吸着しない（吸着距離は変えていない）');
 assert.equal((await fxKinds()).includes('snap'), true, '4 吸着した瞬間の印が出ない');
 await shotTo('feel-3-snap.png');
 /* 保持中：少し動かしても新しい印は出ない。時間がたてば印は消え、緑の行き先は残る（点滅しない）。 */
 await sleep(450); await moveTo([B[0] - 10, B[1] - 6]);
 assert.equal(await ev('freeFoldDebug.dragSession.aim.snapped'), true, '4 保持中に吸着が外れた');
 { const k = (await fxKinds()).filter(v => v === 'snap' || v === 'unsnap'); assert.deepEqual(k, [], '4 保持中に吸着の印を出し続けている（点滅）: ' + await fxKinds()) }
 assert.equal(await pix([1, -1], 18, GRN) > 30, true, '4 保持中の緑の行き先が見えない');
 /* 離れる：解除の印（灰の輪が縮む）。戻る：もう一度だけ吸着の印。 */
 await moveTo([B[0] - 90, B[1] - 60]);
 assert.equal(await ev('freeFoldDebug.dragSession.aim ? !!freeFoldDebug.dragSession.aim.snapped : false'), false, '4 離れても吸着が外れない');
 assert.equal((await fxKinds()).includes('unsnap'), true, '4 吸着が外れたことが示されない');
 await sleep(400); await moveTo([B[0] - 12, B[1] - 8]);
 assert.equal((await fxKinds()).filter(k => k === 'snap').length, 1, '4 吸着し直した瞬間の印が一度だけでない');
 await release([B[0] - 12, B[1] - 8]);

 mark('5 上から1枚では折れない：角は合っている／重なった紙も一緒に。枚数は勝手に増やさない');
 await poll(() => ev(`[...document.querySelectorAll('#stackPick button')].length >= 2`), 'stack pick');
 { const lp = await ev('freeFoldDebug.layerPick');
   assert.equal(lp.n, 1, '5 枚数を勝手に変えた: ' + lp.n); assert.equal(lp.ok, false, '5 上から1枚で折れてしまう（検査の前提）');
   assert.match(await status(), /角は合っています。重なった紙も一緒に折ってください/, '5 吸着の成功と折れないことを分けて言っていない: ' + await status());
   assert.notEqual(await statusColor(), 'rgb(255, 155, 155)', '5 吸着は合っているのに、案内が赤（失敗）になっている');
   assert.match(await ev(`document.getElementById('stackWhy').textContent`), /角は合っています。重なった紙も一緒に折ってください/, '5 枚数の欄に案内が無い');
   assert.match(await ev('freeFoldDebug.detail') || '', /折れません：/, '5 折れない理由が「詳しく」に無い: ' + await ev('freeFoldDebug.detail'));
   assert.equal(await ev(`/faceId|paper\\//.test(document.getElementById('status').textContent + document.getElementById('stackWhy').textContent)`), false, '5 内部IDが案内に出ている');
   assert.equal((await btn('confirm')).disabled, true, '5 折れないのに確定できる');
   const f = await ev('freeFoldDebug.frame.pick');
   assert.equal(f.show.n, 1, '5 動く紙（上から1枚）が示されない');
   assert.deepEqual(f.show.faces, await ev('freeFoldDebug.state.pending.candidates.map(v => v.faceId)'), '5 強調している紙が engine の候補と違う');
   assert.equal(f.show.faces.length > 0, true, '5 上から1枚で動かそうとした紙が示されない');
   { const q = await point([.3, .6]), c = await ev(`Array.from(document.getElementById('view').getContext('2d').getImageData(${Math.round(q[0])}, ${Math.round(q[1])}, 1, 1).data)`);
     /* 赤い紙（235,92,92）に青を重ねた色＝赤が下がり、青が緑より上がる */
     assert.equal(c[0] < 230 && c[2] > c[1] + 4, true, '5 動かそうとした紙が青く示されない: ' + c) } }
 await shotTo('feel-4-layers-1.png');
 /* 取消：正式データは不変・枚数の欄も消える。 */
 await clickBtn('cancel');
 assert.equal(await snapState(), recBefore, '5 取消で正式データが変わった');
 assert.equal(await ev(`document.getElementById('layers').hidden`), true, '5 取消しても枚数の欄が残る');

 mark('6 もう一度 2回目 → 「上から2枚」を選ぶ（枚数選択時の画像）→ 確定');
 await grabAt([-1, 1]); await carryTo([0, 0]); await carryTo([1, -1]); await dropAt([1, -1]);
 await poll(() => stackBtn(2), 'stack pick again');
 const b2 = await stackBtn(2);
 assert.equal(await ev('freeFoldDebug.layerPick.n'), 1, '6 枚数を勝手に変えた');
 await tap(b2);
 { const f = await ev('freeFoldDebug.frame.pick');
   assert.equal(f.show.n, 2, '6 選んだ枚数の紙が示されない');
   assert.deepEqual(f.show.faces, await ev('freeFoldDebug.state.pending.candidates.map(v => v.faceId)'), '6 強調している紙が engine の候補と違う');
   assert.equal(f.show.faces.length > 1, true, '6 上から2枚で動く紙が1枚しか示されない: ' + f.show.faces) }
 assert.equal(await ev('freeFoldDebug.layerPick.ok'), true, '6 上から2枚で折れない');
 assert.match(await status(), /^上から2枚を折ります。この形でよければ確定してください$/, '6 枚数の案内が短くない: ' + await status());
 assert.match(await ev('freeFoldDebug.detail') || '', /faceId/, '6 記録のされ方が「詳しく」に無い');
 { const blue = await ev(`(() => { const d = document.getElementById('view').getContext('2d').getImageData(0, 0, innerWidth, innerHeight).data; let k = 0; for (let i = 0; i < d.length; i += 4) { const R = d[i], G = d[i+1], B = d[i+2]; if (${BLUE}) k++ } return k })()`);
   assert.equal(blue > 800, true, '6 動く紙が青く強調されていない: ' + blue) }
 await shotTo('feel-5-layers-2.png');
 await clickBtn('confirm');
 assert.deepEqual((await recipe()).steps.map(s => s.op), ['flip', 'fold', 'fold'], '6 2回目が確定しない');

 mark('7 袋：「袋をタップして開けます」→ 袋を選んで開く → 確定');
 await hoverTo([.9, .9]);
 assert.match(await ev('freeFoldDebug.pocketHint') || '', /袋をタップすると開けます/, '7 袋を選べるのに案内が出ない');
 assert.equal(await ev('freeFoldDebug.pocketWhy'), null, '7 袋を選べるのに理由が出ている');
 await clickBtn('pocketPick');
 assert.equal(await status(), '袋をタップして開けます', '7 袋を選ぶときの案内が短くない: ' + await status());
 await tap(await point([.66, 0]));
 assert.equal(await ev('freeFoldDebug.pocket && freeFoldDebug.pocket.mode'), 'preview', '7 袋を選べない');
 await clickBtn('pocketOpen');
 await poll(() => ev('freeFoldDebug.pocket.t === 1 && freeFoldDebug.pocket.dir === 0'), 'pocket end', 200);
 await clickBtn('confirm');
 const r7 = await recipe(), h7 = await ev('freeFoldDebug.state.cache.hash');
 assert.deepEqual(r7.steps.map(s => s.op), ['flip', 'fold', 'fold', 'squash'], '7 袋折りが確定しない');
 await shotTo('feel-6-pocket.png');

 mark('8 undo / redo');
 await clickBtn('undo');
 assert.equal((await recipe()).steps.length, 3, '8 undo で袋折りが外れない');
 await hoverTo([.9, .9]);
 assert.match(await ev('freeFoldDebug.pocketHint') || '', /袋をタップすると開けます/, '8 undo 後に袋の案内が戻らない');
 await clickBtn('redo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h7, '8 redo で戻らない');

 assert.deepEqual(errors.map(e => JSON.stringify(e).slice(0, 300)), [], 'console にエラー');
 console.log(JSON.stringify({ result: 'PASS', screenshots: shots, consoleErrors: errors.length }, null, 1));
}
main().then(async () => { await shutdown(); process.exit(0) }, async e => { console.error(e); await shutdown(); process.exit(1) });
