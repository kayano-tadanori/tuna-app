'use strict';
/* 実Chrome：つるの花弁折り（⑧⑨・1回目）を **画面の操作で**（2026-09-15）。
   新しい紙 → 2回折る → 袋を選ぶ → 裏返す → 反対側の袋 →（⑦）「折り目だけ」で辺を対角の折り目へ×2（上から2枚）→「折り目を引く」で P→P'
   「折り目を引く」で P→P'（上から1枚＝4面・枚数を変えて戻す・取消）
   →「花弁を選ぶ」→ 花弁をタップ → プレビュー（途中は WebGL・両端は engine の層）→ 確定 → 保存 → undo/redo → 再読込 → 取消。
   🚨折り・枚数・確定・undo/redo・保存・花弁の選択はボタンと紙のしぐさで行う。
     コンソールで書くのは「再読込したページへ保存原本を入れる」1か所だけ（画面に読込の UI が無い）。準備した原本の注入はしない。ほかは読んで確かめるだけ。
   ⛔ 厚みは0。
   使い方： node test_petal_browser.js
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
 temp = await fs.mkdtemp(path.join(os.tmpdir(), 'petal-ui-')); const downloads = path.join(temp, 'downloads'); await fs.mkdir(downloads);
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
  assert.notEqual(r, null, '「上から' + k + '枚」のボタンが無い'); await tap(r) };
 const shot = async name => { const png = await cdp('Page.captureScreenshot', { format: 'png' }), f = path.join(SHOTS, name); await fs.writeFile(f, Buffer.from(png.data, 'base64')); return f };
 const setSlider = async ratio => { const r = await ev(`(() => { const q = document.getElementById('pocketT').getBoundingClientRect(); return { l: q.left, w: q.width, y: q.top + q.height / 2 } })()`);
  await tap([r.l + 8 + (r.w - 16) * ratio, r.y]) };
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

 mark('1 画面で ①〜⑥（2回折る → 袋 → 裏返す → 反対側の袋）');
 await grabAt([-1, -1]); await carryTo([.1, 0]); await carryTo([1, 1]); await dropAt([1, 1]); await clickBtn('confirm');
 await grabAt([-1, 1]); await carryTo([0, 0]); await carryTo([1, -1]); await dropAt([1, -1]);
 await poll(() => ev(`[...document.querySelectorAll('#stackPick button')].some(b => b.dataset.n === '2')`), 'stack pick 2');
 await stackBtn(2); await clickBtn('confirm');
 await clickBtn('pocketPick'); await tap(await point(await pocketPoint())); await clickBtn('confirm');
 await clickBtn('flip');
 await clickBtn('pocketPick'); await tap(await point(await pocketPoint())); await clickBtn('confirm');
 assert.deepEqual((await recipe()).steps.map(s => s.op), ['fold', 'fold', 'squash', 'flip', 'squash'], '1 正方基本形にならない: ' + await status());
 assert.equal((await btn('petalPick')).hidden, true, '1 ⑦の前なのに「花弁を選ぶ」が出ている');
 shots.push(await shot('petal-1-prelim.png'));

 mark('2 ⑦ 画面で：「折り目だけ」で辺→対角の折り目（上から2枚）×2、「折り目を引く」で P→P\'');
 const Q = await ev(`(() => { const f = freeFoldDebug.state.cache.faces.flatMap(f => f.poly.map(q => [q, (() => { const m = f.xf, d = m[0]*m[3]-m[1]*m[2], x = q[0]-m[4], y = q[1]-m[5]; return [(m[3]*x-m[1]*y)/d, (-m[2]*x+m[0]*y)/d] })()]));
  const c = f.find(([q, m]) => Math.abs(Math.abs(m[0])-1) < 1e-9 && Math.abs(Math.abs(m[1])-1) < 1e-9); return c[0] })()`);
 const O = [0, 0], t8 = Math.tan(Math.PI / 8);
 await clickBtn('creaseMode'); assert.equal(await ev('freeFoldDebug.asCrease'), true, '2 折り目だけモードに入れない');
 /* 順番は engine の道の原本（crane_step7_recipe.json）と同じ＝横の角 A 側のふち → B 側のふち（面の ID が同じになる） */
 for (const far of [[Q[0], O[1]], [O[0], Q[1]]]) {
  /* 開いた角 Q からのふち（Q と横の角のあいだ）の中点をつかみ、対角の折り目の上（Q から同じ距離）へ運ぶ */
  const mid = [(Q[0] + far[0]) / 2, (Q[1] + far[1]) / 2], L = Math.hypot(mid[0] - Q[0], mid[1] - Q[1]);
  const u = [(O[0] - Q[0]) / Math.hypot(O[0] - Q[0], O[1] - Q[1]), (O[1] - Q[1]) / Math.hypot(O[0] - Q[0], O[1] - Q[1])];
  const to = [Q[0] + u[0] * L, Q[1] + u[1] * L];
  await grabAt(mid); await carryTo([(mid[0] + to[0]) / 2, (mid[1] + to[1]) / 2]); await carryTo(to); await dropAt(to);
  await poll(() => ev(`[...document.querySelectorAll('#stackPick button')].some(b => b.dataset.n === '2')`), '2 stack pick 2（' + far + '）');
  await stackBtn(2); await clickBtn('confirm');
 }
 await clickBtn('creaseMode'); assert.equal(await ev('freeFoldDebug.asCrease'), false);
 const r2 = await recipe();
 assert.deepEqual(r2.steps.map(s => s.op).slice(5), ['crease', 'crease'], '2 凧形の折り目が2手入らない: ' + await status());
 const P = [O[0] + (Q[0] - O[0] === 0 ? 0 : 0), 0];
 const ends = await ev(`(() => { const out = []; for (const c of FreeFoldEngine.creaseIntervals(freeFoldDebug.state)) for (const p of c.seg)
   if (Math.abs(Math.hypot(p[0], p[1]) - ${1 - t8}) < 1e-9 && !out.some(q => Math.hypot(q[0]-p[0], q[1]-p[1]) < 1e-9)) out.push(p); return out })()`);
 assert.equal(ends.length, 2, '2 凧形の折り目の端 P・P\' が2点にならない');
 void P;
 /* 画面で作った凧形の2本が、engine の道で作った⑦の最初の2本（crane_step7_recipe.json の7手目まで）と同じ紙か */
 const want7 = JSON.parse(await fs.readFile(path.join(DIR, 'crane_step7_recipe.json'), 'utf8'));
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), await ev(`FreeFoldEngine.replay(${JSON.stringify({ ...want7, steps: want7.steps.slice(0, 7) })}).hash`), '2 画面で作った凧形の2本が engine の道と違う紙');
 /* 上の三角（P→P'）：「折り目を引く」で P・P' の近くから引く（折り目の端へ吸いつく）→ 指を離すと「この場所の重なり」の枚数選び。
    ✏️ 折り目だけの枚数は engine の creasability で決まる（2026-09-15）＝上から1枚＝一番上の紙の左右の半分と凧形の外側（4面）。 */
 await clickBtn('lineMode');
 const inward = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
 const s2 = await snapState();
 await grabAt(inward(ends[0], ends[1], .04)); await carryTo([(ends[0][0] + ends[1][0]) / 2, (ends[0][1] + ends[1][1]) / 2]); await carryTo(inward(ends[1], ends[0], .04)); await dropAt(inward(ends[1], ends[0], .04));
 await poll(async () => !(await btn('confirm')).disabled, '2 上の三角の折り目が確定できる（' + await status() + '）');
 /* 「折り目を引く」の表示は平ら（0°）のまま＝折った姿を作ってから平らへ差しかえてはいない */
 assert.deepEqual(await ev('[freeFoldDebug.geometry && freeFoldDebug.geometry.angle, !!(freeFoldDebug.geometry && freeFoldDebug.geometry.shownFlat)]'), [0, false], '2 折り目を引いたあとの表示が 0° の平らな姿でない');
 const lp1 = await ev('({ n: freeFoldDebug.layerPick.n, ok: freeFoldDebug.layerPick.ok, faces: freeFoldDebug.layerPick.faces.length, count: freeFoldDebug.layerPick.count, snapped: [freeFoldDebug.sessionLog.slice(-1)[0].id] })');
 assert.deepEqual([lp1.n, lp1.ok, lp1.faces], [1, true, 4], '2 上から1枚が4面（一番上の紙の左右の半分と凧形の外側）で成立しない: ' + JSON.stringify(lp1));
 assert.match(await status(), /上から1枚を折り目をつけます/, '2 案内が「折り目をつけます」になっていない');
 assert.match(await ev('freeFoldDebug.detail') || '', /上から1枚（4面）/, '2 「詳しく」に枚数と面数が分けて出ない');
 /* 枚数を変えられる：2枚にすると6面、1枚へ戻すと4面（原本は動かない） */
 await stackBtn(2);
 assert.deepEqual(await ev('[freeFoldDebug.layerPick.n, freeFoldDebug.layerPick.ok, freeFoldDebug.layerPick.faces.length]'), [2, true, 6], '2 上から2枚が6面で成立しない');
 await stackBtn(1);
 assert.deepEqual(await ev('[freeFoldDebug.layerPick.n, freeFoldDebug.layerPick.faces.length]'), [1, 4]);
 assert.equal(JSON.stringify(JSON.parse(await snapState()).r), JSON.stringify(JSON.parse(s2).r), '2 枚数を選んだだけで原本が変わった');
 /* 取消：原本も候補も戻る → もう一度引いて確定 */
 await clickBtn('cancel');
 assert.equal(await ev('freeFoldDebug.state.pending'), null, '2 取消しても候補が残る');
 assert.equal(await snapState(), s2, '2 取消で正式状態が変わった');
 await grabAt(inward(ends[0], ends[1], .04)); await carryTo([(ends[0][0] + ends[1][0]) / 2, (ends[0][1] + ends[1][1]) / 2]); await carryTo(inward(ends[1], ends[0], .04)); await dropAt(inward(ends[1], ends[0], .04));
 await poll(async () => !(await btn('confirm')).disabled, '2 もう一度引いた上の三角の折り目が確定できる');
 await clickBtn('confirm'); await clickBtn('lineMode');
 const r3 = await recipe();
 assert.deepEqual(r3.steps.map(s => s.op).slice(5), ['crease', 'crease', 'crease'], '2 上の三角の折り目が入らない: ' + await status());
 assert.equal(r3.steps[7].targets.length, 4, '2 上の三角の折り目の対象が4面でない');
 assert.equal(await ev('freeFoldDebug.state.cache.faces.length'), 14, '2 ⑦のあとの面が14枚でない');
 await poll(async () => !(await btn('petalPick')).hidden, '2 「花弁を選ぶ」が出る');
 assert.match(await ev('freeFoldDebug.pocketHint') || '', /花弁をタップすると持ち上げられます/, '2 花弁が選べるのに案内が出ない');
 assert.equal((await btn('pocketPick')).hidden, true, '2 袋の候補が無いのに「袋を選ぶ」が出ている');
 const h7 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('petal-2-step7.png'));

 mark('3 裏返すと「花弁を選ぶ」は消え、戻すと出る（画面のボタン）');
 await clickBtn('flip');
 await poll(async () => (await btn('petalPick')).hidden, '3 裏返したら花弁のボタンが消える');
 assert.equal(await ev('freeFoldDebug.pocketHint'), null, '3 裏返したのに花弁の案内が残る');
 await clickBtn('undo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h7);
 await poll(async () => !(await btn('petalPick')).hidden, '3 戻したら花弁のボタンが出る');

 mark('4 「花弁を選ぶ」→ 花弁をタップ → プレビュー');
 const s4 = await snapState();
 await clickBtn('petalPick');
 const pick = await ev('freeFoldDebug.frame.pocket');
 assert.equal(pick && pick.kind + ':' + pick.mode, 'petal:pick', '4 花弁を選ぶ状態にならない');
 assert.equal(pick.options.length, 1, '4 光っている花弁が1つでない');
 assert.equal((await btn('petalPick')).text, '花弁を選ぶのをやめる');
 assert.equal((await btn('confirm')).disabled, true, '4 選ぶ前に確定が押せる');
 assert.match(await status(), /花弁をタップすると持ち上げる動きを見られます/);
 await tap(await point(await petalPoint()));
 assert.equal(await ev('freeFoldDebug.pocket && freeFoldDebug.pocket.kind + ":" + freeFoldDebug.pocket.mode'), 'petal:preview', '4 花弁を選べない: ' + await status());
 assert.equal(await ev('freeFoldDebug.state.pending && freeFoldDebug.state.pending.inputMode'), 'petal', '4 engine の候補になっていない');
 assert.equal(await snapState(), s4, '4 選んだだけで原本が変わった');
 assert.equal(await ev('document.getElementById("pocketOpen").textContent'), '花弁を持ち上げてたたむ', '4 プレビューのボタンの文言');
 assert.match(await ev('document.getElementById("pocketNote").textContent'), /花弁折り/, '4 プレビューの説明が花弁になっていない');
 assert.equal((await btn('undo')).disabled, true, '4 プレビュー中に undo が押せる');
 for (const ratio of [.3, .5, .8]) {
  await setSlider(ratio);
  const f = await ev('freeFoldDebug.frame.pocket');
  assert.equal(f.drawnBy, 'webgl-depth', '4 途中が WebGL で描かれていない');
  const want = await ev(`Array.from(FreeFoldEngine.petalPreview(freeFoldDebug.state).positions(${f.t}))`);
  assert.equal(f.positions.length, want.length, '4 描いた三角形の数が engine と違う');
  assert.ok(f.positions.reduce((w, v, i) => Math.max(w, Math.abs(v - want[i])), 0) < 1e-6, '4 描いた座標が engine の再生と違う');
  assert.ok(Math.max(...f.positions.filter((_, i) => i % 3 === 2)) > .05, '4 途中なのに花弁が持ち上がっていない');
  assert.ok(Math.min(...f.positions.filter((_, i) => i % 3 === 2)) > -1e-6, '4 途中で紙が基準面の下へ潜っている');
  if (ratio === .5) { const px = await ev('freeFoldDebug.pocketColors()'); assert.ok(px.front > 0 && px.back > 0, '4 途中の絵に表と裏の色が両方出ていない: ' + JSON.stringify(px)); shots.push(await shot('petal-3-middle.png')) }
 }
 await setSlider(1); await poll(() => ev('freeFoldDebug.frame.pocket.t === 1'), 't=1');
 assert.equal(await ev('freeFoldDebug.frame.pocket.drawnBy'), 'engine-layers', '4 t=1 が engine の層で描かれていない');
 shots.push(await shot('petal-4-end-preview.png'));

 mark('5 確定（1手）→ 保存 → 保存原本を再生して同じ');
 await clickBtn('confirm');
 const r5 = await recipe();
 assert.deepEqual([r5.version, r5.steps.map(s => s.op).slice(-1)[0], r5.steps.length], [2, 'petal', 9], '5 花弁折りが1手で確定しない: ' + await status());
 assert.match(await status(), /花弁を持ち上げてたたみました/);
 assert.equal(await ev('FreeFoldEngine.replay(freeFoldDebug.state.recipe).hash === freeFoldDebug.state.cache.hash'), true, '5 表示と原本の再生が違う');
 assert.equal(await ev('document.getElementById("steps").textContent'), '9手');
 assert.equal((await btn('petalPick')).hidden, true, '5 確定したあとも「花弁を選ぶ」が出ている');
 const h9 = await ev('freeFoldDebug.state.cache.hash');
 shots.push(await shot('petal-5-confirmed.png'));
 await clickBtn('save');
 const file = await poll(async () => (await fs.readdir(downloads)).find(v => v.endsWith('.origami.json')), 'download');
 const saved = JSON.parse(await fs.readFile(path.join(downloads, file), 'utf8'));
 assert.deepEqual(saved.steps.map(s => s.op).slice(-1), ['petal']);
 assert.equal(await ev(`FreeFoldEngine.replay(${JSON.stringify(saved)}).hash`), h9, '5 保存した原本を再生すると違う');

 mark('6 undo / redo（画面のボタン・1手単位）');
 await clickBtn('undo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h7, '6 undo で⑦に戻らない');
 await poll(async () => !(await btn('petalPick')).hidden, '6 undo のあと「花弁を選ぶ」が出る');
 await clickBtn('redo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h9, '6 redo で同じ紙に戻らない');

 mark('7 ページ再読込 → 保存原本を入れる → undo / redo');
 await cdp('Page.reload', {});
 await sleep(300); await poll(() => ev('!!window.freeFoldDebug && freeFoldDebug.pocketReady.ok'), 'reload');
 /* 画面に読込の UI が無いので、ここだけコンソールで保存原本を入れる（engine の共通入口で再生した cache を置く） */
 await ev(`(() => { const st = freeFoldDebug.state, r = ${JSON.stringify(saved)}; st.recipe = r; st.cache = FreeFoldEngine.replay(r);
  st.revision = 0; st.cacheRevision = 0; st.committed = st.cache; st.redoStack = []; st.pending = null; return true })()`);
 await clickBtn('op'); await clickBtn('op');
 assert.equal(await ev('freeFoldDebug.state.cache.hash'), h9, '7 再読込で同じ紙にならない');
 await clickBtn('undo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h7, '7 再読込後の undo で⑦に戻らない');
 await clickBtn('redo'); assert.equal(await ev('freeFoldDebug.state.cache.hash'), h9, '7 再読込後の redo で同じ紙にならない');
 assert.equal(await ev('JSON.stringify(freeFoldDebug.state.recipe)'), JSON.stringify(saved), '7 undo/redo で原本の文字が変わった');

 mark('8 取消：花弁を選んでから取消 → 原本も候補も戻る');
 await clickBtn('undo');
 const s8 = await snapState();
 await clickBtn('petalPick'); await tap(await point(await petalPoint()));
 assert.equal(await ev('freeFoldDebug.pocket && freeFoldDebug.pocket.mode'), 'preview');
 await clickBtn('cancel');
 assert.equal(await ev('freeFoldDebug.pocket'), null, '8 取消しても候補が残る');
 assert.equal(await ev('freeFoldDebug.state.pending'), null);
 assert.equal(await snapState(), s8, '8 取消で原本が変わった');
 /* 選ぶのをやめる（ボタンをもう一度） */
 await clickBtn('petalPick'); await clickBtn('petalPick');
 assert.equal(await ev('freeFoldDebug.pocket'), null, '8 「花弁を選ぶのをやめる」で選ぶ状態が残る');
 assert.equal(await snapState(), s8);

 assert.deepEqual(errors, [], 'ページで例外: ' + JSON.stringify(errors).slice(0, 400));
 console.log('  ok 画面の操作だけで ①〜⑥ → ⑦（凧形2本・上の三角＝上から1枚4面）→ 花弁を選ぶ → プレビュー（途中 WebGL の座標＝engine・両端 engine の層）→ 確定（v2 の1手）→ 保存 → undo/redo → 再読込 → 取消');
 console.log('  写し：\n    ' + shots.join('\n    '));
}
main().then(() => 0, e => { console.error(e); return 1 }).then(async code => {
 try { await Promise.race([cdpRef && cdpRef('Browser.close'), sleep(3000)]) } catch {}
 try { ws && ws.close() } catch {} try { browser && browser.kill() } catch {} try { server && server.close() } catch {}
 await sleep(300); if (temp) await fs.rm(temp, { recursive: true, force: true, maxRetries: 7, retryDelay: 300 }).catch(() => {});
 process.exit(code) });
