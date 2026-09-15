'use strict';
/* 実Chrome：1回半分に折った三角形で、角を相手の角へ運ぶ「2回目の半分折り」（2026-09-14・本人が画像で指摘）。
   見ること：つかんだ瞬間の黄の印／相手の角への吸着（26px 入る・44px 離れる）と緑の印／上から1枚で裂けるときは
   ゴーストを出さず印と吸着の文字は残す／上から2枚を自分で選ぶと、その角合わせでプレビュー・確定／「袋を選ぶ」まで。
   表・裏・カメラを回してズームしたあと、の3通り。操作はすべて画面のマウス（コンソールは読むだけ）。
   使い方： ORIGAMI_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" node test_half_fold_browser.js
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
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'half-fold-'));
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
  else if (m.method === 'Runtime.exceptionThrown' || m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error' || m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m) };
 const cdp = (method, params = {}) => new Promise((ok, no) => { const id = ++n; pending.set(id, { ok, no }); ws.send(JSON.stringify({ id, method, params })) }); cdpRef = cdp;
 const ev = async expression => { const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails).slice(0, 600)); return r.result.value };
 const point = async p => ev(`freeFoldDebug.project([${p[0]},0,${-p[1]}])`);
 const press = q => cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: q[0], y: q[1], button: 'left', clickCount: 1 });
 const moveTo = q => cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q[0], y: q[1], button: 'left', buttons: 1 });
 const release = q => cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: q[0], y: q[1], button: 'left', clickCount: 1 });
 const tap = async q => { await press(q); await release(q) };
 const status = () => ev('freeFoldDebug.status');
 const clickBtn = async id => { const r = await ev(`(() => { const b = document.getElementById('${id}'); if (!b || b.hidden) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, disabled: b.disabled } })()`);
  assert.notEqual(r, null, 'ボタン ' + id + ' が見えていない'); assert.equal(r.disabled, false, 'ボタン ' + id + ' が押せない（' + await status() + '）'); await tap([r.x, r.y]) };
 const btn = id => ev(`(() => { const b = document.getElementById('${id}'); return { hidden: b.hidden, disabled: b.disabled } })()`);
 const shot = async name => { const png = await cdp('Page.captureScreenshot', { format: 'png' }), f = path.join(SHOTS, name); await fs.writeFile(f, Buffer.from(png.data, 'base64')); return f };
 const YELLOW = 'R>200&&G>150&&G<235&&B<110', GREEN = 'R<160&&G>180&&B>120&&B<210';
 /* 印の画素数：太い輪＋点は約340、以前の細い輪は約195（実測）＝270 で「はっきり」を分ける。 */
 const CLEAR_PX = 270;
 const colorAt = (q, r, pred) => ev(`(() => { const g = document.getElementById('view').getContext('2d'), d = window.devicePixelRatio || 1, s = Math.round(${r} * d),
  X = Math.round(${q[0]} * d), Y = Math.round(${q[1]} * d), im = g.getImageData(X - s, Y - s, s * 2, s * 2).data; let k = 0;
  for (let i = 0; i < im.length; i += 4) { const R = im[i], G = im[i + 1], B = im[i + 2], A = im[i + 3]; if (A > 40 && (${pred})) k++ } return k })()`);
 const handles = () => ev('(freeFoldDebug.frame.handles || []).map(h => ({ shape: h.shape, role: h.role, at: h.at }))');
 const aim = () => ev('(() => { const d = freeFoldDebug.dragSession, p = freeFoldDebug.pendingProposal, a = (d && d.aim) || (p && p.aim); return a ? { snapped: a.snapped, kind: a.snapKind, target: a.target } : null })()');
 const cleanup = async () => { for (let i = 0; i < 12 && await ev('freeFoldDebug.state.recipe.steps.length || !!freeFoldDebug.state.pending || !!freeFoldDebug.pocket'); i++) {
   if (await ev('!!freeFoldDebug.state.pending || !!freeFoldDebug.pocket')) await clickBtn('cancel'); else await clickBtn('undo') } };
 await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Log.enable');
 await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 800, deviceScaleFactor: 1, mobile: false });
 await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/freefold3d.html` });
 await poll(() => ev('!!window.freeFoldDebug'), 'page'); await poll(() => ev('freeFoldDebug.pocketReady.ok'), 'pocket validator');
 const shots = [], results = [];

 for (const run of [{ name: '表', flip: false, camera: false }, { name: '裏', flip: true, camera: false }, { name: '表・カメラ回転＋ズーム', flip: false, camera: true }]) {
  const L = run.name;
  mark(L + '：新しい紙' + (run.flip ? '→裏返す' : '') + '→1回目の半分折り');
  await cleanup();
  if (await ev('freeFoldDebug.state.recipe.steps.length')) throw Error(L + ' 片づけできない');
  if (run.flip) await clickBtn('flip');
  { const a = await point([-1, -1]); await press(a); await moveTo(await point([.1, 0])); const b = await point([1, 1]); await moveTo(b); await release(b) }
  assert.match(await status(), /確定してください/, L + ' 1回目が候補にならない: ' + await status());
  await clickBtn('confirm');
  assert.equal(await ev('freeFoldDebug.state.cache.faces.length'), 2, L + ' 1回目で面が2枚にならない');
  if (run.camera) {
   const q = [940, 300]; await press(q); await moveTo([900, 330]); await moveTo([860, 370]); await release([860, 370]);
   await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 500, y: 420, deltaX: 0, deltaY: -200 }); await sleep(80);
   const cam = await ev('({ ...freeFoldDebug.camera })');
   assert.equal(cam.yaw !== 0 && cam.zoom !== 1, true, L + ' カメラが回っていない・ズームしていない: ' + JSON.stringify(cam));
  }

  mark(L + '：角 (-1,1) をつかんだ瞬間');
  const A = await point([-1, 1]);
  await press([A[0] + 5, A[1] - 4]);/* 角そのものでなく数px ずれた所を押す＝指の現実 */
  assert.equal(await ev('freeFoldDebug.dragSession && freeFoldDebug.dragSession.source && freeFoldDebug.dragSession.source.type'), 'corner', L + ' 角がつかめない');
  assert.deepEqual(await ev('freeFoldDebug.dragSession.source.point.map(v => Math.round(v * 1e6) / 1e6)'), [-1, 1], L + ' つかんだ角が (-1,1) でない');
  assert.equal((await handles()).some(h => h.shape === 'corner-mark' && h.role === 'grab'), true, L + ' つかんだ角の印が無い');
  const yPress = await colorAt(A, 18, YELLOW); results.push({ run: L, yellowAtPress: yPress });
  assert.equal(yPress > CLEAR_PX, true, L + ' つかんだ瞬間の黄の印がはっきり出ていない（画素 ' + yPress + '）');

  mark(L + '：相手の角 (1,-1) の近くへ運ぶ（26px 入る・44px 離れる）');
  await moveTo(await point([0, 0]));
  const B = await point([1, -1]);
  /* 吸着していない所から近づく：約35px ではまだ吸いつかない（入るのは 26px）。 */
  assert.equal((await aim() || {}).snapped, false, L + ' まん中で何かに吸着している（検査の前提）');
  await moveTo([B[0] - 30, B[1] - 18]);
  assert.notEqual((await aim() || {}).kind, 'diagonal', L + ' 35px で相手の角に吸いついた（入るのは 26px）');
  await moveTo([B[0] - 14, B[1] - 9]);/* 約17px */
  const a1 = await aim();
  assert.deepEqual([a1 && a1.snapped, a1 && a1.kind], [true, 'diagonal'], L + ' 相手の角に吸いつかない: ' + JSON.stringify(a1) + ' ' + await status());
  assert.deepEqual(a1.target.map(v => Math.round(v * 1e9) / 1e9), [1, -1], L + ' 吸いついた行き先が相手の角ちょうどでない: ' + a1.target);
  assert.equal(await ev('freeFoldDebug.geometry'), null, L + ' 上から1枚で裂けるのにゴーストを出している');
  /* 🖐 吸着の成功と、折れない理由を分けて言う（理由は「詳しく」）。 */
  assert.match(await status(), /角は合っています（対角）。重なった紙も一緒に折ってください/, L + ' 吸着の成功が案内に出ない: ' + await status());
  assert.match(await ev('freeFoldDebug.detail') || '', /結びにそって紙が切り離されます/, L + ' 裂ける理由が「詳しく」に無い: ' + await ev('freeFoldDebug.detail'));
  const hs = await handles();
  assert.equal(hs.some(h => h.shape === 'corner-mark' && h.role === 'grab') && hs.some(h => h.shape === 'corner-mark' && h.role === 'target'), true, L + ' 裂けるときに黄の角か緑の行き先の印が消えた');
  const gSnap = await colorAt(B, 18, GREEN); results.push({ run: L, greenAtSnap: gSnap });
  assert.equal(gSnap > CLEAR_PX, true, L + ' 吸着した行き先の緑の印がはっきり出ていない（画素 ' + gSnap + '）');
  assert.equal(await colorAt(A, 18, YELLOW) > CLEAR_PX, true, L + ' 裂けるときに黄の印が消えた');
  assert.deepEqual(await ev('freeFoldDebug.state.pending.displayLine.flat().map(v => Math.round(v * 1e9) / 1e9)').then(l => [Math.abs(l[0] - l[1]) < 1e-9, Math.abs(l[2] - l[3]) < 1e-9]), [true, true], L + ' 折線がちょうど対角に乗っていない');
  if (run.name === '表') shots.push(await shot('halffold-1-snapped-tear.png'));
  await moveTo([B[0] - 30, B[1] - 18]);/* 約35px＝離れる境界の内 */
  assert.equal((await aim()).kind, 'diagonal', L + ' 35px で吸着が外れた（離れるのは 44px）');
  await moveTo([B[0] - 60, B[1] - 40]);/* 約72px */
  assert.notEqual((await aim() || {}).kind, 'diagonal', L + ' 72px でも吸着が外れない');
  /* 紙の外へ出る＝「内側にしてください」で断られる。そのとき古い緑の行き先を残さない。 */
  await moveTo(await point([1.45, -1.25]));
  assert.match(await status(), /行き先は紙の内側にしてください/, L + ' 紙の外で断られない: ' + await status());
  assert.equal((await handles()).some(h => h.role === 'target'), false, L + ' 紙の外で断られたのに、古い緑の行き先の印が残っている');
  await moveTo([B[0] - 8, B[1] - 6]);
  assert.equal((await aim()).kind, 'diagonal', L + ' 戻しても吸いつかない');

  mark(L + '：指を離す→上から1枚は不成立でも印は残す→上から2枚を選ぶ');
  await release([B[0] - 8, B[1] - 6]);
  await poll(() => ev(`[...document.querySelectorAll('#stackPick button')].some(b => b.dataset.n === '2')`), L + ' 枚数の選択');
  const p1 = await ev('freeFoldDebug.frame.pick');
  assert.equal(p1.ok, false, L + ' 上から1枚が成立してしまった');
  assert.equal(p1.n, 1, L + ' 枚数が自動で変わった');
  assert.equal((await btn('confirm')).disabled, true, L + ' 上から1枚で確定できてしまう');
  assert.equal((await handles()).some(h => h.role === 'target'), true, L + ' 離したあと緑の行き先の印が消えた');
  assert.equal((await aim()).kind, 'diagonal', L + ' 離したあと吸着の状態が消えた');
  assert.equal(await colorAt(B, 18, GREEN) > CLEAR_PX && await colorAt(A, 18, YELLOW) > CLEAR_PX, true, L + ' 離したあと黄か緑の印が見えない');
  { const r = await ev(`(() => { const b = [...document.querySelectorAll('#stackPick button')].find(b => b.dataset.n === '2').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] })()`); await tap(r) }
  const p2 = await ev('freeFoldDebug.frame.pick');
  assert.deepEqual([p2.n, p2.ok], [2, true], L + ' 上から2枚で成立しない: ' + JSON.stringify(p2) + ' ' + await status());
  assert.notEqual(await ev('freeFoldDebug.geometry'), null, L + ' 上から2枚でプレビューが出ない');
  if (run.name === '表') shots.push(await shot('halffold-2-two-layers.png'));
  await clickBtn('confirm');
  const r = await ev('JSON.parse(JSON.stringify(freeFoldDebug.state.recipe))');
  assert.deepEqual(r.steps.map(s => s.op).filter(o => o !== 'flip'), ['fold', 'fold'], L + ' 2回目を確定できない');
  assert.equal(r.steps.every(s => s.op === 'flip' || [...s.line, s.movingSidePoint].flat().every(v => Math.abs(v) <= 1)), true, L + ' 記録が原紙の範囲を外れる');
  assert.equal(await ev('FreeFoldEngine.replay(FreeFoldEngine.verifiedRecipe(freeFoldDebug.state)).hash === freeFoldDebug.state.cache.hash'), true, L + ' 保存用の原本の再生が表示と違う');
  const pocket = await btn('pocketPick');
  if (run.flip) {
   /* 裏返してから作ったつる②＝検証ずみの状態② ∘ D（D＝裏返しの軸の鏡映）。袋を選べる（2026-09-14）。
      袋折りそのものの画面の通しは test_squash_flip_browser.js、独立検証は check_squash_flip.py。 */
   assert.deepEqual([pocket.hidden, pocket.disabled], [false, false], L + ' 裏返してから作ったつる②で「袋を選ぶ」が出ない: ' + await ev('FreeFoldEngine.squashOptions(freeFoldDebug.state).reason'));
   results.push({ run: L, pocket: '袋を選べる（検証ずみモデル ∘ D・D は鏡映）' });
  } else {
   mark(L + '：「袋を選ぶ」まで');
   assert.deepEqual([pocket.hidden, pocket.disabled], [false, false], L + ' 2回の半分折りのあと「袋を選ぶ」が押せない');
   await clickBtn('pocketPick');
   assert.equal(await ev('freeFoldDebug.frame.pocket && freeFoldDebug.frame.pocket.mode'), 'pick', L + ' 袋を選ぶ状態にならない');
   if (run.name === '表') shots.push(await shot('halffold-3-pocket-pick.png'));
   await clickBtn('cancel');
   results.push({ run: L, pocket: '袋を選ぶ まで到達' });
  }
 }
 assert.deepEqual(errors.map(e => JSON.stringify(e).slice(0, 300)), [], 'console にエラー');
 console.log(JSON.stringify({ result: 'PASS', runs: results, screenshots: shots, consoleErrors: errors.length }, null, 1));
}
main().then(async () => { await shutdown(); process.exit(0) }, async e => { console.error(e); await shutdown(); process.exit(1) });
