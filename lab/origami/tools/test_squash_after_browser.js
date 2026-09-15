'use strict';
/* 実Chrome：袋折りのあとも **画面の操作で** ふつうに折り続けられるか（2026-09-14）。
   新しい紙 → 画面で2回折る → 袋を選ぶ → 確定 → 正方形の上の角をつかんで運ぶ → 上から2枚（背が裂ける）・山折り（下に紙）は断る
   → 上から1枚・谷折りへ選び直して確定 → 保存ボタン → undo/redo ボタン → ページ再読込 → 保存原本を入れて undo/redo ボタン。
   🚨折り・枚数・山谷・確定・undo/redo・保存はボタンと紙のしぐさで行う。
     コンソールで書くのは「再読込したページへ保存原本を入れる」1か所だけ（画面に読込の UI が無い）。ほかは読んで確かめるだけ。
   ⛔ 厚みは0。紙どうしの貫通（すり抜け）は未検証。
   使い方： ORIGAMI_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" node test_squash_after_browser.js
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
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'squash-after-')); const downloads = path.join(temp, 'downloads'); await fs.mkdir(downloads);
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

 mark('1 画面で2回折る → 袋を選ぶ → 確定');
 await grabAt([-1, -1]); await carryTo([.1, 0]); await carryTo([1, 1]); await dropAt([1, 1]);
 await clickBtn('confirm');
 await grabAt([-1, 1]); await carryTo([0, 0]); await carryTo([1, -1]); await dropAt([1, -1]);
 await poll(() => ev(`[...document.querySelectorAll('#stackPick button')].some(b => b.dataset.n === '2')`), 'stack pick 2');
 await stackBtn(2); await clickBtn('confirm');
 await clickBtn('pocketPick'); await tap(await point([.66, 0]));
 assert.equal(await ev('freeFoldDebug.pocket && freeFoldDebug.pocket.mode'), 'preview', '1 袋を選べない: ' + await status());
 await clickBtn('confirm');
 const r1 = await recipe();
 assert.deepEqual([r1.version, r1.steps.map(s => s.op)], [2, ['fold', 'fold', 'squash']], '1 袋折りが確定しない');
 assert.match(await status(), /袋を開いてつぶしました.*続けて折れます/, '1 確定後の案内が「続けて折れます」でない: ' + await status());
 for (const id of ['op', 'kind', 'undo', 'save']) assert.equal((await btn(id)).disabled, false, '1 袋折りのあとに ' + id + ' が押せない');
 const hSquash = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('after-1-squashed.png'));

 mark('2 正方形の上の角 (1,1) にホバー → つかむ（視点ではなく角）');
 await moveTo(await point([1, 1]));
 await poll(() => ev('!!freeFoldDebug.hover'), 'hover corner');
 await grabAt([1, 1]);
 const ds = await ev('freeFoldDebug.dragSession && { kind: freeFoldDebug.dragSession.kind, type: freeFoldDebug.dragSession.source && freeFoldDebug.dragSession.source.type }');
 assert.notEqual(ds && ds.kind, 'camera', '2 袋折りのあとに角をつかむと視点が回る（つかめない）');
 assert.equal(ds && ds.type, 'corner', '2 角をつかめていない: ' + JSON.stringify(ds));
 const s2 = await snapState();
 /* 行き先は背（対角・x=0・y=0）から離れた所＝「角を背へ合わせる」吸着に入らない */
 await carryTo([.8, .85]); await carryTo([.35, .65]); await dropAt([.35, .65]);
 assert.equal(await snapState(), s2, '2 運んで離しただけで原本が変わった');
 await poll(() => ev(`[...document.querySelectorAll('#stackPick button')].length >= 2`), 'stack pick');
 assert.equal(await ev('freeFoldDebug.layerPick && freeFoldDebug.layerPick.n'), 1, '2 枚数が 1 から始まらない（勝手に増やした）');
 const q1 = await ev('JSON.parse(JSON.stringify(freeFoldDebug.state.pending))');
 assert.equal(q1.kind, 'V', '2 谷折りで始まらない');
 assert.deepEqual(q1.candidates.map(c => c.faceId).sort(), [P2, P3].sort(), '2 上から1枚の候補が「P3 と折り目でつながった P2」でない: ' + JSON.stringify(q1.candidates));
 assert.match(await status(), /確定してください/, '2 上から1枚で確定できる形にならない: ' + await status());
 assert.equal((await btn('confirm')).disabled, false, '2 確定が押せない');
 shots.push(await shot('after-2-ghost.png'));

 mark('3 断る折り：上から2枚（背が裂ける）→ 候補を保つ');
 await stackBtn(2);
 assert.equal((await btn('confirm')).disabled, true, '3 裂ける枚数なのに確定が押せる');
 assert.match(await why(), /裂け/, '3 裂ける理由が出ない: ' + await why());
 assert.notEqual(await ev('freeFoldDebug.state.pending'), null, '3 断ったら候補が消えた');
 assert.equal(await snapState(), s2, '3 断ったのに原本が変わった');
 mark('3b 上から1枚へ戻す → 山折りに切りかえ（下に紙）→ 谷折りへ戻す');
 await stackBtn(1);
 assert.equal((await btn('confirm')).disabled, false, '3b 上から1枚へ戻しても確定が押せない: ' + await status());
 await clickBtn('kind');
 assert.equal(await ev('freeFoldDebug.state.pending.kind'), 'M', '3b 山折りに切りかわらない');
 assert.equal((await btn('confirm')).disabled, true, '3b 山折り（下に紙）なのに確定が押せる');
 assert.match(await why(), /下に敷かれている紙/, '3b 山折りの理由が出ない: ' + await why());
 assert.equal(await snapState(), s2, '3b 断ったのに原本が変わった');
 await clickBtn('kind');
 assert.equal(await ev('freeFoldDebug.state.pending.kind'), 'V');
 await poll(async () => !(await btn('confirm')).disabled, 'confirm enabled again');
 shots.push(await shot('after-3-rechosen.png'));

 mark('4 確定＝袋折りのあとの1手');
 await clickBtn('confirm');
 const r4 = await recipe();
 assert.deepEqual([r4.version, r4.steps.map(s => s.op)], [2, ['fold', 'fold', 'squash', 'fold']], '4 後続の折りが確定しない: ' + await status());
 const s4 = r4.steps[3];
 assert.equal(s4.kind, 'V'); assert.deepEqual(s4.targets.map(t => t.faceId).sort(), [P2, P3].sort(), '4 対象面が違う');
 assert.equal(await ev('freeFoldDebug.state.cache.faces.length'), 8, '4 面が8枚にならない');
 const h4 = await ev('freeFoldDebug.state.cache.hash');
 assert.equal(await ev(`FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash`), true, '4 表示と原本の再生が違う');
 assert.equal(await ev('document.getElementById("steps").textContent'), '4手', '4 手の数の表示が違う');
 shots.push(await shot('after-4-folded.png'));

 mark('5 保存（画面のボタン）→ 保存原本を再生して同じ');
 for (const f of await fs.readdir(downloads)) if (f.endsWith('.origami.json')) await fs.unlink(path.join(downloads, f)).catch(() => {});
 await clickBtn('save');
 const file = await poll(async () => (await fs.readdir(downloads)).find(v => v.endsWith('.origami.json')), 'download');
 const saved = JSON.parse(await fs.readFile(path.join(downloads, file), 'utf8'));
 assert.deepEqual([saved.version, saved.steps.map(s => s.op)], [2, ['fold', 'fold', 'squash', 'fold']], '5 保存した原本が違う');
 assert.equal(await ev(`FreeFoldEngine.replay(${JSON.stringify(saved)}).hash`), h4, '5 保存した原本を再生すると違う');

 mark('6 undo / redo（画面のボタン）');
 await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), hSquash, '6 undo で袋折り直後に戻らない');
 await clickBtn('redo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h4, '6 redo で後続の折りに戻らない');

 mark('7 ページ再読込 → 保存原本を入れる → undo / redo（画面のボタン）');
 await cdp('Page.reload', {});
 await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reload');
 assert.equal(await ev('freeFoldDebug.state.recipe.steps.length'), 0, '7 再読込したページが新しい紙でない');
 /* 画面に読込の UI が無いので、ここだけコンソールで保存原本を入れる（engine の共通入口で再生した cache を置く） */
 await ev(`(() => { const st = freeFoldDebug.state, r = ${JSON.stringify(saved)}; st.recipe = r; st.cache = FreeFoldEngine.replay(r);
  st.revision = 0; st.cacheRevision = 0; st.committed = st.cache; st.redoStack = []; st.pending = null; return true })()`);
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h4, '7 再読込したページで保存原本が同じ状態にならない');
 /* 画面のボタンの状態を読み直させる＝操作の切りかえボタンを2回押す（押すたびに画面が状態を読み直し、2回で元の操作に戻る） */
 await clickBtn('op'); await clickBtn('op');
 assert.equal(await ev('document.getElementById("steps").textContent'), '4手', '7 再読込したページの手の数が 4手 にならない');
 await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), hSquash, '7 再読込後の undo で袋折り直後に戻らない');
 await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.faces.length'), 4, '7 再読込後の undo 2回で袋折りの前に戻らない');
 await clickBtn('redo'); await clickBtn('redo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h4, '7 再読込後の redo 2回で同じ状態にならない');
 assert.equal(await ev('JSON.stringify(freeFoldDebug.state.recipe)'), JSON.stringify(saved), '7 undo/redo で原本の文字が変わった');
 assert.equal(await ev('document.getElementById("steps").textContent'), '4手');
 shots.push(await shot('after-5-reloaded.png'));

 mark('8 裏返す（画面のボタン）→ 1手戻す');
 await clickBtn('flip');
 const r8 = await recipe();
 assert.deepEqual(r8.steps.map(s => s.op), ['fold', 'fold', 'squash', 'fold', 'flip'], '8 袋折りのあとに裏返せない: ' + await status());
 assert.equal(await ev(`FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash`), true, '8 表示と原本の再生が違う');
 assert.equal(await ev(`freeFoldDebug.state.cache.faces.every(f => { const b = FreeFoldEngine.replay(${JSON.stringify(saved)}).faces.find(g => g.faceId === f.faceId); return b && f.layer === -b.layer && f.poly.every((p, i) => Math.abs(p[0] + b.poly[i][0]) < 1e-12) })`), true, '8 裏返しで形が左右に返らない／層が反転しない');
 shots.push(await shot('after-6-flipped.png'));
 await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h4, '8 裏返しの 1手戻す で戻らない');

 mark('9 折り目を引く（画面のボタン）→ 袋折り直後の正方形を横切る2点ドラッグ → 上から1枚でも折り目は付けられる（確定と同じ判定）→ 上から4枚で確定 → 1手戻す');
 await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), hSquash, '9 袋折り直後に戻らない');
 await clickBtn('lineMode');
 assert.equal(await ev('freeFoldDebug.lineMode'), true, '9 折り目を引く が ON にならない');
 await grabAt([.97, .5]); await carryTo([.6, .5]); await carryTo([.08, .5]); await dropAt([.08, .5]);
 await poll(() => ev(`[...document.querySelectorAll('#stackPick button')].length >= 4`), 'crease stack pick');
 assert.equal(await ev('freeFoldDebug.layerPick.n'), 1, '9 枚数が 1 から始まらない');
 /* ✏️ 2026-09-15（本人判断）：折り目だけは紙が動かない＝確定・再生と同じ判定（creasability）。以前は折りの判定で「背が裂ける」と断っていた。 */
 await poll(async () => !(await btn('confirm')).disabled, '9 上から1枚の折り目が確定できる');
 assert.deepEqual(await ev('[freeFoldDebug.layerPick.ok, freeFoldDebug.layerPick.reason]'), [true, null], '9 上から1枚の折り目が成立しない');
 assert.match(await ev('freeFoldDebug.status'), /上から1枚を折り目をつけます/, '9 案内が折り目になっていない');
 await stackBtn(4);
 await poll(async () => !(await btn('confirm')).disabled, 'crease confirm enabled');
 const s9sel = await ev('freeFoldDebug.state.pending.candidates.length');
 assert.equal(s9sel, 6, '9 上から4枚で、折り目でつながった紙を含めた6面にならない: ' + s9sel);
 await clickBtn('confirm');
 const r9 = await recipe();
 assert.deepEqual(r9.steps.map(s => s.op), ['fold', 'fold', 'squash', 'crease'], '9 袋折りのあとに折り目が入らない: ' + await status());
 assert.equal(await ev(`(() => { const st = freeFoldDebug.state, sv = ${JSON.stringify(saved)}, b = FreeFoldEngine.replay({ ...sv, steps: sv.steps.slice(0, 3) });
  return FreeFoldEngine.replay(st.recipe).hash === st.cache.hash && st.cache.faces.length === 12 && st.cache.faces.every(f => { const par = b.faces.find(g => f.faceId === g.faceId || f.faceId.startsWith(g.faceId + '/s4.')); return par && f.layer === par.layer && f.xf.every((v, i) => Math.abs(v - par.xf[i]) < 1e-12) }) })()`), true, '9 折り目で紙が動いた／12面にならない／表示と原本の再生が違う');
 shots.push(await shot('after-7-crease.png'));
 await clickBtn('lineMode');
 await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), hSquash, '9 折り目の 1手戻す で袋折り直後に戻らない');

 mark('10 背を開く（画面）：正方形の左の背を選ぶ →「背を開く」→ 開く側を指す → engine の理由で断り、原本は不変');
 const s10 = await snapState();
 await tap(await point([.004, .5]));
 const hp = await ev('freeFoldDebug.hingePick && { id: freeFoldDebug.hingePick.intervalId, faces: freeFoldDebug.hingePick.faceIds }');
 assert.ok(hp, '10 袋折りのあとに背を選べない: ' + await status());
 await clickBtn('openHinge');
 assert.equal(await ev('freeFoldDebug.openMode'), true, '10 背を開くモードにならない');
 await tap(await point([.2, .6]));
 assert.doesNotMatch(await status(), /まだ対応していません/, '10 背を開くを判定でなく門で断っている');
 assert.match(await status(), /この背の軸1本では開けません|いちばん上の紙|裂け|上に乗っている|下に敷かれている/, '10 engine の既存の理由が出ない: ' + await status());
 assert.equal(await ev('freeFoldDebug.state.pending'), null, '10 断ったのに候補ができた');
 assert.equal(await snapState(), s10, '10 断ったのに原本が変わった');
 shots.push(await shot('after-8-open-refused.png'));
 await clickBtn('openHinge');

 mark('11 複数面を同じ背の軸で開く（画面）：角を谷折り → 見えている対角の背を選ぶ →「背を開く」→ 右下を指す → 3面いっしょのゴースト → 確定');
 
 await ev('freeFoldDebug.openMode') && await clickBtn('openHinge');
 /* 角を対角の上の点へ運ぶ＝折線が対角に直角（x+y=一定）＝折った角は対角のどちら側にもまたがらない。
    ⚠4 の (.35,.65) は対角に非対称で、折った角が対角をまたぐ＝その紙では s2#1 を開くと「両側にまたがる」で断るのが正しい。 */
 await grabAt([1, 1]); await carryTo([.8, .8]); await carryTo([.6, .6]); await dropAt([.6, .6]);
 await poll(() => ev(`[...document.querySelectorAll('#stackPick button')].length >= 2`), '11 stack pick: ' + await status());
 await poll(async () => !(await btn('confirm')).disabled, '11 confirm enabled');
 await clickBtn('confirm');
 const r11a = await recipe();
 assert.deepEqual(r11a.steps.map(s => s.op), ['fold', 'fold', 'squash', 'fold'], '11 角の谷折りが確定しない: ' + await status());
 const h11a = await ev('freeFoldDebug.state.cache.hash');
 const vis = await ev(`(() => { const h = FreeFoldEngine.hingeIntervals(freeFoldDebug.state).find(v => v.intervalId === 'hinge:s2#1'); return h && h.visibleParts.map(p => p.seg) })()`);
 assert.ok(vis && vis.length, '11 対角の背 s2#1 が見えていない');
 const hm = [(vis[0][0][0] + vis[0][1][0]) / 2, (vis[0][0][1] + vis[0][1][1]) / 2];
 /* 見えている区間は短く、両端が面の角に近い＝そのままでは角のつかみになる。画面のホイールで拡大してから押す（画面の操作）。 */
 const cornerPx = async () => { const sc = await point(hm), cs = await ev('FreeFoldSnap.corners(freeFoldDebug.state)'); let m = Infinity;
  for (const q of cs) { const t = await point(q); m = Math.min(m, Math.hypot(t[0] - sc[0], t[1] - sc[1])) } return m };
 const inView = async () => { const q = await point(hm); return q[0] > 40 && q[0] < 960 && q[1] > 90 && q[1] < 760 };
 for (let k = 0; k < 20 && (await cornerPx() <= 40 || !(await inView())); k++) { const sc = await point(hm);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: sc[0], y: sc[1], deltaX: 0, deltaY: -60 }) }
 assert.ok(await cornerPx() > 40 && await inView(), '11 拡大しても背が角から離れない／画面の外: ' + await cornerPx() + ' ' + JSON.stringify(await point(hm)));
 const s11 = await snapState();
 await tap(await point(hm));
 assert.equal(await ev('freeFoldDebug.hingePick && freeFoldDebug.hingePick.intervalId'), 'hinge:s2#1', '11 見えている対角の背を選べない: ' + await status());
 await clickBtn('openHinge');
 assert.equal(await ev('freeFoldDebug.openMode'), true, '11 背を開くモードにならない');
 await grabAt([.8, .3]); await dropAt([.8, .3]);
 const q11 = await ev('JSON.parse(JSON.stringify(freeFoldDebug.state.pending))');
 assert.ok(q11 && q11.inputMode === 'open', '11 開く候補ができない: ' + await status());
 assert.equal(q11.openHinge.intervalId, 'hinge:s2#1', '11 どの背を開くか残っていない');
 const LR = ['paper/s1.cut/s2.cut/s3.keep', P3 + '/s4.keep', P3 + '/s4.cut'];
 assert.deepEqual(q11.candidates.map(c => c.faceId).sort(), LR.slice().sort(), '11 右下3面いっしょの集合でない: ' + JSON.stringify(q11.candidates));
 assert.equal(q11.kind, 'V', '11 山谷を engine が決めていない');
 const g11 = await ev('freeFoldDebug.frame && freeFoldDebug.frame.ghost');
 assert.equal(g11 && g11.from, 'open', '11 開くゴーストが出ない');
 assert.equal(await ev('freeFoldDebug.geometry.movingIds.length'), 3, '11 ゴーストで動く面が3枚でない');
 assert.match(await status(), /3枚いっしょ/, '11 案内が3枚いっしょを言わない: ' + await status());
 assert.equal(await ev('freeFoldDebug.layerPick'), null, '11 開く手に「上からN枚」を出している');
 assert.equal((await btn('confirm')).disabled, false, '11 確定が押せない');
 assert.equal(await snapState(), s11, '11 提案しただけで原本が変わった');
 shots.push(await shot('after-9-open-multi-ghost.png'));
 await clickBtn('confirm');
 const r11 = await recipe();
 assert.deepEqual(r11.steps.map(s => s.op), ['fold', 'fold', 'squash', 'fold', 'fold'], '11 開く手が確定しない: ' + await status());
 const s5 = r11.steps[4];
 assert.equal(s5.kind, 'V'); assert.deepEqual(s5.targets.map(t => t.faceId).sort(), LR.slice().sort(), '11 対象面が3面でない');
 assert.ok(s5.line.concat([s5.movingSidePoint]).every(q => Math.abs(q[0]) <= 1 && Math.abs(q[1]) <= 1), '11 折線が原紙の外');
 assert.equal(await ev(`freeFoldDebug.state.cache.faces.filter(f => ${JSON.stringify(LR)}.includes(f.faceId) && f.poly.every(p => p[1] >= p[0] - 1e-9)).length`), 3, '11 右下の3面が対角の左上へ開いていない');
 assert.equal(await ev(`FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash`), true, '11 表示と原本の再生が違う');
 assert.equal(await ev('freeFoldDebug.hingePick'), null, '11 確定しても背の選択が残っている');
 const h11 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('after-10-open-multi.png'));

 mark('12 保存（画面のボタン）→ ページ再読込 → 保存原本を入れる → undo / redo（画面のボタン）');
 for (const f of await fs.readdir(downloads)) if (f.endsWith('.origami.json')) await fs.unlink(path.join(downloads, f)).catch(() => {});
 await clickBtn('save');
 const file12 = await poll(async () => (await fs.readdir(downloads)).find(v => v.endsWith('.origami.json')), 'download 12');
 const saved12 = JSON.parse(await fs.readFile(path.join(downloads, file12), 'utf8'));
 assert.deepEqual(saved12.steps.map(s => s.op), ['fold', 'fold', 'squash', 'fold', 'fold'], '12 保存した原本が違う');
 await cdp('Page.reload', {});
 await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reload 12');
 await ev(`(() => { const st = freeFoldDebug.state, r = ${JSON.stringify(saved12)}; st.recipe = r; st.cache = FreeFoldEngine.replay(r);
  st.revision = 0; st.cacheRevision = 0; st.committed = st.cache; st.redoStack = []; st.pending = null; return true })()`);
 await clickBtn('op'); await clickBtn('op');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h11, '12 再読込した保存原本が同じ紙にならない');
 assert.equal(await ev('document.getElementById("steps").textContent'), '5手');
 await clickBtn('undo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h11a, '12 undo で開く前に戻らない');
 await clickBtn('redo');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h11, '12 redo で開いた紙に戻らない');
 assert.equal(await ev('JSON.stringify(freeFoldDebug.state.recipe)'), JSON.stringify(saved12), '12 undo/redo で原本の文字が変わった');

 mark('13 断る：開いた手を戻して、輪の背（x=0）を選んで開く → 複数の軸が要る理由 → 原本・候補なし・背の選択は残る');
 await clickBtn('undo');
 const s13 = await snapState();
 await tap(await point([.004, .5]));
 assert.equal(await ev('freeFoldDebug.hingePick && freeFoldDebug.hingePick.intervalId'), 'hinge:s3#2', '13 x=0 の背を選べない: ' + await status());
 await clickBtn('openHinge');
 await grabAt([.2, .4]); await dropAt([.2, .4]);
 assert.match(await status(), /この背の軸1本では開けません/, '13 複数の軸が要る理由が出ない: ' + await status());
 assert.equal(await ev('freeFoldDebug.state.pending'), null, '13 断ったのに候補ができた');
 assert.equal(await snapState(), s13, '13 断ったのに原本が変わった');
 assert.equal(await ev('freeFoldDebug.hingePick && freeFoldDebug.hingePick.intervalId'), 'hinge:s3#2', '13 断ったら背の選択まで消えた（指し直せない）');
 shots.push(await shot('after-11-open-multi-refused.png'));
 await clickBtn('openHinge');

 assert.deepEqual(errors.map(e => JSON.stringify(e).slice(0, 300)), [], 'console にエラー');
 console.log(JSON.stringify({ result: 'PASS', screenshots: shots, line: s4.line, note: '厚み0。紙どうしの貫通（すり抜け）は未検証', consoleErrors: errors.length }, null, 1));
}
main().then(async () => { await shutdown(); process.exit(0) }, async e => { console.error(e); await shutdown(); process.exit(1) });
