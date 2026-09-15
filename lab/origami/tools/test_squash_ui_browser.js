'use strict';
/* 実Chrome：画面の操作で紙を2回折る → 袋折り候補（engine API）→ 確定 → 保存 → 再読込 → undo/redo。
   ⛔袋を選ぶ UI はまだ無い。候補と確定は engine の API をページの上で呼ぶ（freefold3d.html は変えない）。
   🚨再現テスト：修正前は、画面で作ったつる②の折線が 1.0000000000000004 になり、v2 への移行が断られていた。
   使い方： ORIGAMI_CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe" node test_squash_ui_browser.js
*/
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), http = require('node:http'),
 { spawn } = require('node:child_process'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
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
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'squash-ui-')); const downloads = path.join(temp, 'downloads'); await fs.mkdir(downloads);
 server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x').pathname; if (u === '/favicon.ico') return res.writeHead(204).end();
  const f = path.resolve(DIR, '.' + decodeURIComponent(u)); if (!f.startsWith(path.resolve(DIR) + path.sep)) return res.writeHead(403).end();
  try { const b = await fs.readFile(f); res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8'); res.end(b) }
  catch { res.writeHead(404).end() } });
 await new Promise((ok, no) => { server.once('error', no); server.listen(0, '127.0.0.1', ok) });
 browser = spawn(process.env.ORIGAMI_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + path.join(temp, 'profile'), '--no-first-run', '--no-default-browser-check', 'about:blank'],
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
 const grabAt = async p => press(await point(p)), carryTo = async p => moveTo(await point(p)), dropAt = async p => release(await point(p));
 const click = id => ev(`document.getElementById('${id}').click()`), status = () => ev('freeFoldDebug.status');
 await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Log.enable');
 await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 800, deviceScaleFactor: 1, mobile: false });
 await cdp('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
 await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/freefold3d.html` });
 await poll(() => ev('!!window.freeFoldDebug'), 'page'); mark('page ready');
 /* 袋折りの再生器は画面に無い（UI 変更なし）。検査が読みこむだけ。 */
 await ev(`(async () => { for (const f of ['origami_recipe.js', 'squash_model.js', 'squash_v2.js']) (0, eval)(await (await fetch(f)).text());
  SquashV2.useV1Validator(OrigamiRecipe.validate, await (await fetch('origami_recipe.schema.json')).json()); return true })()`);

 const v1check = () => ev(`(async () => { try { OrigamiRecipe.validate(JSON.parse(JSON.stringify(freeFoldDebug.state.recipe)), await (await fetch('origami_recipe.schema.json')).json()); return 'OK' } catch (e) { return e.message } })()`);
 mark('0 再現：対角で折った紙の角 (1,1) を対角へ吸着しない所へ運び、上から2枚で折る');
 /* 修正前：記録した折線が -1.0000000000000002 になり、保存した原本が schema に入らなかった（72通り中6通り）。 */
 if (await ev('freeFoldDebug.op') !== 'fold') await click('op');
 await grabAt([-1, -1]); await carryTo([.1, 0]); await carryTo([1, 1]); await dropAt([1, 1]); await click('confirm');
 {
  const t0 = [0.5086956521739129, 0.5086956521739129];
  await grabAt([1, 1]); await carryTo([(1 + t0[0]) / 2, (1 + t0[1]) / 2]); await carryTo(t0); await dropAt(t0);
  await ev(`[...document.querySelectorAll('#stackPick button')].find(b => b.dataset.n === '2').click()`);
  const q0 = await ev(`(() => { const q = freeFoldDebug.state.pending; return { line: q.line, disabled: document.getElementById('confirm').disabled,
   ghost: freeFoldDebug.geometry.parts.map(p => ({ move: p.move, stay: p.stay })) } })()`);
  assert.equal(q0.line.flat().some(v => Math.abs(v) > 1), true, '0 前提：画面の候補の素材座標が ±1 をはみ出していない（再現の土台が変わった）');
  assert.equal(q0.disabled, false, '0 上から2枚で確定できない');
  await click('confirm');
  const r0 = await ev('freeFoldDebug.state.recipe');
  mark('  記録：' + JSON.stringify(r0.steps[1].line));
  assert.equal(r0.steps.every(s => [...s.line, s.movingSidePoint].every(p => p.every(v => v >= -1 && v <= 1))), true,
   '0 画面で折った原本の座標が原紙の範囲を外れる: ' + JSON.stringify(r0.steps[1].line));
  assert.equal(await v1check(), 'OK', '0 画面で折った原本が既存の検証器に通らない');
  const c0 = await ev(`(() => { const st = freeFoldDebug.state, rep = FreeFoldEngine.replay(JSON.parse(JSON.stringify(FreeFoldEngine.verifiedRecipe(st))));
   const G = ${JSON.stringify(q0.ghost)}; let worst = 0;
   for (const g of G) for (const v of [...(g.move || []), ...(g.stay || [])]) { let d = Infinity;
    for (const f of rep.faces) for (const w of f.poly) d = Math.min(d, Math.hypot(v[0] - w[0], -v[2] - w[1])); worst = Math.max(worst, d) }
   return { worst, hash: rep.hash === st.cache.hash } })()`);
  assert.equal(c0.hash, true, '0 保存用の原本の再生が表示と違う');
  assert.equal(c0.worst < 1e-9, true, '0 プレビューと再生結果の頂点が食い違う: ' + c0.worst);
  mark('  プレビューと再生の最大差 ' + c0.worst);
  await click('undo'); await click('undo');
  assert.equal(await ev('freeFoldDebug.state.recipe.steps.length'), 0, '0 片づけで巻き戻せない');
 }

 mark('1 画面で1回目：角 (-1,-1) を (1,1) へ運んで対角の半分折り');
 if (await ev('freeFoldDebug.op') !== 'fold') await click('op');
 await grabAt([-1, -1]); await carryTo([.2, .2]); await carryTo([1, 1]);
 assert.match(await status(), /対角を合わせて半分折り/, '1 対角に吸いつかない: ' + await status());
 await dropAt([1, 1]); await click('confirm');
 assert.equal(await ev('freeFoldDebug.state.cache.faces.length'), 2, '1 面が2枚にならない');

 mark('2 画面で2回目：2枚重なった三角の角 (-1,1) を (1,-1) へ運び、上から2枚を半分折り');
 await grabAt([-1, 1]); await carryTo([0, 0]); await carryTo([1, -1]);
 const s2 = await status();
 await dropAt([1, -1]);
 const picks = await ev(`[...document.querySelectorAll('#stackPick button')].map(b => b.dataset.n)`);
 assert.deepEqual(picks, ['1', '2', 'side', 'flap'], '2 上からN枚（と、この側を全部・つながっているフラップ）が出ない（' + s2 + '）: ' + JSON.stringify(picks));
 await ev(`[...document.querySelectorAll('#stackPick button')].find(b => b.dataset.n === '2').click()`);
 const pre = await ev(`(() => { const q = freeFoldDebug.state.pending; return { disabled: document.getElementById('confirm').disabled, status: freeFoldDebug.status,
   geomLine: freeFoldDebug.geometry && freeFoldDebug.geometry.line, displayLine: q.displayLine, ref: q.reference.faceId, sidePoint: q.sidePoint,
   ghost: freeFoldDebug.geometry ? freeFoldDebug.geometry.parts.map(p => ({ id: p.faceId, move: p.move })) : null } })()`);
 assert.equal(pre.disabled, false, '2 上から2枚で確定できない: ' + pre.status);
 await click('confirm');
 const rec = await ev('freeFoldDebug.state.recipe');
 assert.equal(rec.steps.length, 2, '2 原本が2手でない');
 mark('  2手目の記録：line=' + JSON.stringify(rec.steps[1].line) + ' side=' + JSON.stringify(rec.steps[1].movingSidePoint) + ' ref=' + rec.steps[1].reference.faceId);
 const inRange = rec.steps.every(s => [...s.line, s.movingSidePoint].every(p => p.every(v => v >= -1 && v <= 1)));
 assert.equal(inRange, true, '2 画面で作った原本の座標が原紙の範囲（-1〜1）を外れる: ' + JSON.stringify(rec.steps.map(s => [s.line, s.movingSidePoint])));
 const v1ok = await ev(`(async () => { try { OrigamiRecipe.validate(JSON.parse(JSON.stringify(freeFoldDebug.state.recipe)), await (await fetch('origami_recipe.schema.json')).json()); return 'OK' } catch (e) { return e.message } })()`);
 assert.equal(v1ok, 'OK', '2 画面で作った v1 原本が既存の検証器に通らない: ' + v1ok);
 /* プレビュー（確定前のゴースト 180°）と、確定した原本の再生が同じ所に紙を置く。 */
 const cmp = await ev(`(() => { const E = FreeFoldEngine, st = freeFoldDebug.state, P = ${JSON.stringify(pre.ghost)};
  const rep = E.replay(JSON.parse(JSON.stringify(st.recipe)));
  let worst = 0, missing = [];
  for (const g of P) { if (!g.move) continue;
   const flat = g.move.map(v => [v[0], -v[2]]);
   for (const p of flat) { let d = Infinity; for (const f of rep.faces) for (const q of f.poly) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1])); worst = Math.max(worst, d) } }
  return { worst, hash: rep.hash === st.cache.hash } })()`);
 assert.equal(cmp.hash, true, '2 保存用の原本を再生すると表示状態と違う');
 assert.equal(cmp.worst < 1e-9, true, '2 プレビューの頂点が再生結果の頂点に乗らない: ' + cmp.worst);

 mark('3 袋折り候補 → 確定（engine API）');
 const cand = await ev(`(() => { const st = freeFoldDebug.state, before = JSON.stringify(st.recipe);
  try { const p = FreeFoldEngine.proposeSquash(st); return { ok: true, same: JSON.stringify(st.recipe) === before, inputMode: p.inputMode, version: st.recipe.version } }
  catch (e) { return { ok: false, reason: e.message, same: JSON.stringify(st.recipe) === before } } })()`);
 assert.equal(cand.ok, true, '3 画面で作ったつる②が袋折り候補にならない: ' + cand.reason);
 assert.deepEqual([cand.same, cand.inputMode, cand.version], [true, 'squash', 1], '3 候補だけで原本が変わった');
 const conf = await ev(`(() => { const E = FreeFoldEngine, st = freeFoldDebug.state; const rev = st.revision; E.confirm(st);
  return { version: st.recipe.version, steps: st.recipe.steps.map(s => s.op), rev: st.revision - rev, faces: st.cache.faces.length,
   sq: st.cache.squash && st.cache.squash.branch, hash: st.cache.hash } })()`);
 assert.deepEqual([conf.version, conf.steps, conf.rev, conf.faces], [2, ['fold', 'fold', 'squash'], 1, 6], '3 確定の結果が違う: ' + JSON.stringify(conf));
 assert.deepEqual(conf.sq, { linkage: 'tan-half-product-sqrt2', sign: 1, driveDeg: [0, 180] }, '3 運動の枝が違う');
 /* 画面で作った紙を袋折りした結果＝検証ずみ原本（squash_tsuru3_v2.json）の再生と、面・表裏・層・結び・枝が一致する。 */
 const same = await ev(`(async () => { const E = FreeFoldEngine, st = freeFoldDebug.state, J = await (await fetch('squash_tsuru3_v2.json')).json();
  const ref = E.replay(J), key = c => JSON.stringify({ f: c.faces.map(f => [f.faceId, Math.sign(f.xf[0]*f.xf[3]-f.xf[1]*f.xf[2]), f.layer]).sort(),
   b: c.bonds.map(b => [b.faceIds, b.kind, b.openedBy || null]).sort((x, y) => JSON.stringify(x) < JSON.stringify(y) ? -1 : 1), s: c.squash });
  return key(ref) === key(st.cache) })()`);
 assert.equal(same, true, '3 画面で作った紙の袋折りが、検証ずみ原本の袋折りと面・表裏・層・結び・枝で一致しない');

 mark('4 保存（画面の保存ボタン）→ 再読込');
 for (const f of await fs.readdir(downloads)) await fs.unlink(path.join(downloads, f)).catch(() => {});
 await click('save');
 const file = await poll(async () => (await fs.readdir(downloads)).find(v => v.endsWith('.origami.json')), 'download');
 const saved = JSON.parse(await fs.readFile(path.join(downloads, file), 'utf8'));
 assert.equal(saved.version, 2, '4 保存した原本が v2 でない');
 const reload = await ev(`(() => { const E = FreeFoldEngine, st = freeFoldDebug.state, r = E.replay(${JSON.stringify(saved)});
  const f = c => JSON.stringify(c.faces.map(x => [x.faceId, x.layerPath, Math.sign(x.xf[0]*x.xf[3]-x.xf[1]*x.xf[2]), x.layer]));
  return { hash: r.hash === st.cache.hash, faces: f(r) === f(st.cache), bonds: JSON.stringify(r.bonds) === JSON.stringify(st.cache.bonds),
   branch: JSON.stringify(r.squash) === JSON.stringify(st.cache.squash) } })()`);
 assert.deepEqual(reload, { hash: true, faces: true, bonds: true, branch: true }, '4 再読込で一致しない: ' + JSON.stringify(reload));

 mark('5 undo / redo（画面のボタン）');
 const hSq = conf.hash;
 await click('undo');
 const u = await ev(`({ v: freeFoldDebug.state.recipe.version, n: freeFoldDebug.state.recipe.steps.length, redo: freeFoldDebug.state.redoStack.length, sq: !!freeFoldDebug.state.cache.squash })`);
 assert.deepEqual(u, { v: 2, n: 2, redo: 1, sq: false }, '5 undo 1回で袋折りだけ外れ v2 のまま、になっていない: ' + JSON.stringify(u));
 await click('redo');
 const r2 = await ev(`({ v: freeFoldDebug.state.recipe.version, n: freeFoldDebug.state.recipe.steps.length, h: freeFoldDebug.state.cache.hash })`);
 assert.deepEqual([r2.v, r2.n, r2.h === hSq], [2, 3, true], '5 redo 1回で袋折りに戻らない: ' + JSON.stringify(r2));

 assert.deepEqual(errors, [], 'console にエラー');
 console.log(JSON.stringify({ result: 'PASS', step2: { line: rec.steps[1].line, movingSidePoint: rec.steps[1].movingSidePoint, reference: rec.steps[1].reference.faceId },
  previewVsReplay: cmp.worst, consoleErrors: errors.length }, null, 1));
}
main().then(async () => { await shutdown(); process.exit(0) }, async e => { console.error(e); await shutdown(); process.exit(1) });
