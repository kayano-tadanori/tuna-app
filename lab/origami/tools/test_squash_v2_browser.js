'use strict';
/* 実Chrome：独立プレビュー（squash_preview.html）を本当に開き、そこへ v2 の再生器を読みこんで
   **画面が描画へ渡した座標**と **v2 の再生結果** を突き合わせる。
   ★内部のフラグではなく、`squashDebug.frame.positions`（WebGL へ送った配列そのもの）と
     実際に塗られた画素で見る。
   ⛔ 既存アプリ・作品・v1スキーマ・freefold_engine.js・freefold3d.html・squash_preview.html は触らない
      （このファイルは読むだけ。ページへは fetch して足すだけで、保存も書きかえもしない）。
   ⛔ 非貫通は未検証。厚みは0。

   使い方：  node test_squash_v2_browser.js
   （Chrome の場所は ORIGAMI_CHROME で変えられる）
*/
const fsp = require('node:fs/promises'), fs = require('node:fs'), path = require('node:path');
const os = require('node:os'), http = require('node:http'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const HERE = __dirname;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mark = s => process.stderr.write(new Date().toISOString().slice(11, 19) + ' ' + s + '\n');
async function poll(fn, label, tries = 100) {
 for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await sleep(100) }
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
 temp = await fsp.mkdtemp(path.join(os.tmpdir(), 'squash-v2-'));
 mark('server');
 const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                 '.json': 'application/json; charset=utf-8' };
 server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'squash_preview.html';
  const file = path.join(HERE, rel);
  if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); return res.end() }
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
 browser.stderr.on('data', d => { const m = /ws:\/\/[^\s]+/.exec(String(d)); if (m && !wsURL) wsURL = m[0] });
 await poll(async () => wsURL, 'devtools url');
 ws = new globalThis.WebSocket(wsURL);
 await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej });
 let n = 0; const pending = new Map(), errors = [];
 let sessionId = null;
 ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.no(Error(JSON.stringify(m.error))) : p.ok(m.result) } }
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(JSON.stringify(m.params.args));
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' +
   (m.params.exceptionDetails.exception || {}).description);
 };
 const raw = (method, params, sid) => new Promise((ok, no) => {
  const id = ++n; pending.set(id, { ok, no });
  ws.send(JSON.stringify(sid ? { id, method, params, sessionId: sid } : { id, method, params }));
 });
 cdpRef = raw;
 const target = await poll(async () => {
  const { targetInfos } = await raw('Target.getTargets', {});
  return targetInfos.find(t => t.type === 'page' && t.url.startsWith('http'));
 }, 'page target');
 sessionId = (await raw('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
 const cdp = (m, p) => raw(m, p, sessionId);
 await cdp('Runtime.enable', {}); await cdp('Page.enable', {});
 await cdp('Emulation.setDeviceMetricsOverride', { width: 980, height: 1000, deviceScaleFactor: 1, mobile: false });
 const ev = async expr => {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.text + ' | ' + expr);
  return r.result.value;
 };
 const shot = async name => { const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  const f = path.join(os.tmpdir(), name); await fsp.writeFile(f, Buffer.from(data, 'base64')); return f };
 const setT = v => ev(`squashDebug.t = ${v}`);
 await poll(async () => ev('typeof squashDebug !== "undefined" && !!squashDebug.frame'), 'page ready');
 const shots = [];

 mark('1 v2 の再生器と原本を、この画面の上へ読みこむ');
 /* 🚨ページには読込のUIを足さない。検査が fetch して足すだけ（画面のファイルは1文字も変えない）。 */
 const loaded = await ev(`(async () => {
  for (const f of ['freefold_engine.js', 'origami_recipe.js', 'squash_v2.js']) (0, eval)(await (await fetch(f)).text());
  /* v1 の部分は既存の検証器に任せる（渡さなければ再生しない）。 */
  SquashV2.useV1Validator(OrigamiRecipe.validate, await (await fetch('origami_recipe.schema.json')).json());
  globalThis.__recipe = await (await fetch('squash_tsuru3_v2.json')).json();
  globalThis.__out = SquashV2.replay(globalThis.__recipe);
  globalThis.__st = SquashV2.toCache(globalThis.__out);
  return { engine: typeof FreeFoldEngine, v2: typeof SquashV2, version: __recipe.version,
           faces: __out.faces.length, bonds: __out.bonds.length, regions: __out.regions.length,
           sides: [...new Set(__out.faces.flatMap(f => f.layerPath.map(p => p.side)))].sort(),
           kinds: __out.bonds.map(b => b.kind).sort() };
 })()`);
 assert.deepEqual(loaded.sides, ['cut', 'keep'], '1 layerPath の side が keep/cut 以外を含む: ' + loaded.sides);
 assert.deepEqual(loaded.kinds, ['crease', 'crease', 'hinge', 'hinge', 'hinge', 'hinge'], '1 結びの kind が違う: ' + loaded.kinds);
 assert.equal(loaded.engine, 'object', '1 v1 エンジンが読めていない');
 assert.equal(loaded.v2, 'object', '1 v2 再生器が読めていない');
 assert.equal(loaded.version, 2, '1 原本が version 2 でない');
 assert.deepEqual([loaded.faces, loaded.bonds, loaded.regions], [6, 6, 3],
  '1 実Chrome での再生結果が node と違う: ' + JSON.stringify(loaded));
 mark('  面6・結び6・領域3');

 mark('2 画面が描画へ渡した座標と、v2 の再生結果を突き合わせる');
 /* `squashDebug.frame.positions` ＝ WebGL へ送った配列そのもの。ここが一致しなければ
    「モデルだけ正しくて画面が違う」か「再生結果が画面と違う」のどちらか。 */
 let worst = 0;
 for (const t of [0, 0.1, 0.25, 0.42, 0.5, 0.75, 0.9, 1]) {
  await setT(t);
  const d = await ev(`(() => {
   const drawn = squashDebug.frame.positions, got = SquashV2.positions(__out, ${t});
   if (drawn.length !== got.length) return { bad: '長さが違う', a: drawn.length, b: got.length };
   let w = 0; for (let i = 0; i < got.length; i++) w = Math.max(w, Math.abs(drawn[i] - got[i]));
   return { w, lift: squashDebug.frame.lift, t: squashDebug.frame.t } })()`);
  assert.equal(d.bad, undefined, '2 t=' + t + ' ' + JSON.stringify(d));
  assert.equal(d.lift, 0, '2 t=' + t + ' 描画へ渡した座標に持ち上げが入っている（合格基準は厚み0）');
  assert.equal(Math.abs(d.t - t) < 1e-12, true, '2 画面の t が動いていない');
  assert.equal(d.w, 0, '2 t=' + t + ' 描画座標と再生結果が違う（最大差 ' + d.w + '）');
  worst = Math.max(worst, d.w);
 }
 mark('  8コマとも最大差 ' + worst);

 mark('3 区間→面の割りつけと、両端の形が、画面の座標と合っている');
 const tiled = await ev(`(() => {
  const M = SquashModel, V = SquashV2, out = __out, keys = p => JSON.stringify(
   p.map(q => q.map(v => Math.round(v * 1e6) / 1e6 + 0)).slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]));
  const drawnTri = (pos, s) => [0,1,2].map(k => [pos[s*9+k*3], pos[s*9+k*3+1], pos[s*9+k*3+2]]);
  const res = { end: [], start: [], sectors: out.sectorFace.slice() };
  squashDebug.t = 1; const p1 = squashDebug.frame.positions;
  for (const f of out.faces) for (const s of f.sectors) {
   const got = M.MATERIAL[s].map(q => V.apply(f.xf, q));
   if (keys(got) !== keys(drawnTri(p1, s).map(v => [v[0], v[1]]))) res.end.push('P' + s + ':' + f.faceId);
  }
  squashDebug.t = 0; const p0 = squashDebug.frame.positions;
  const before = new Map(out.before.faces.map(f => [f.faceId, f]));
  for (const f of out.faces) for (const s of f.sectors) {
   const parent = before.get(f.faceId.replace(/\\/s3\\.(keep|cut)$/, ''));
   const got = M.MATERIAL[s].map(q => V.apply(parent.xf, q));
   if (keys(got) !== keys(drawnTri(p0, s).map(v => [v[0], v[1]]))) res.start.push('P' + s + ':' + f.faceId);
  }
  return res })()`);
 assert.deepEqual(tiled.end, [], '3 最終形で、v2 の面（xf）と画面の三角形が食い違う: ' + tiled.end.join(','));
 assert.deepEqual(tiled.start, [], '3 直前状態で、v1 の面（xf）と画面の三角形が食い違う: ' + tiled.start.join(','));
 assert.equal(new Set(tiled.sectors).size, 6, '3 8区間が6面に割りつけられていない');
 mark('  t=0（v1 engine の面）も t=1（v2 の面）も、画面の8三角形とぴたり一致');

 mark('4 画面自身の検証（厚み0・共有境界は離れない）が、読みこんだあとも通る');
 for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  await setT(t);
  const v = await ev('squashDebug.verify()');
  assert.equal(v.ok, true, '4 t=' + t + ' の検証が落ちた: ' +
   v.checks.filter(c => !c.ok).map(c => c.name + '(' + c.detail + ')').join(' / '));
  assert.equal(v.penetration.length, 0, '4 t=' + t + ' で紙の交差を見つけた: ' + v.penetration.join(','));
 }

 mark('5 実際に塗られた画素＝紙が本当に描かれている（表と裏の描き分けも）');
 await setT(0); const c0 = await ev('squashDebug.colors()');
 assert.equal(c0.front + c0.back > c0.total * 0.03, true, '5 折る前に紙が描かれていない: ' + JSON.stringify(c0));
 shots.push(await shot('squash-v2-start.png'));
 await setT(0.42); const cm = await ev('squashDebug.colors()');
 assert.equal(cm.front > cm.total * 0.01 && cm.back > cm.total * 0.005, true,
  '5 途中でおもて（きいろ）とうら（しろ）の両方が出ていない: ' + JSON.stringify(cm));
 shots.push(await shot('squash-v2-middle.png'));
 await setT(1); const c1 = await ev('squashDebug.colors()');
 assert.equal(c1.front + c1.back > c1.total * 0.03, true, '5 つぶしたあとに紙が描かれていない: ' + JSON.stringify(c1));
 shots.push(await shot('squash-v2-end.png'));

 mark('6 カメラを回して・ズームして・下から見ても、座標の一致は変わらない');
 for (const [y, p, d] of [[0.9, 0.35, 4.2], [-1.2, -0.5, 2.6], [2.4, 1.1, 6.0]]) {
  await ev(`squashDebug.setCam(${y}, ${p}, ${d})`);
  await setT(0.62);
  const w = await ev(`(() => { const a = squashDebug.frame.positions, b = SquashV2.positions(__out, 0.62);
   let w = 0; for (let i = 0; i < b.length; i++) w = Math.max(w, Math.abs(a[i] - b[i])); return w })()`);
  assert.equal(w, 0, '6 カメラを変えると描画座標と再生結果がずれる: ' + w);
  const c = await ev('squashDebug.colors()');
  assert.equal(c.front + c.back > c.total * 0.01, true, '6 このカメラで紙が描かれていない: ' + JSON.stringify(c));
 }
 shots.push(await shot('squash-v2-camera.png'));

 mark('6b 互換 cache を、既存の読み取りAPIが実Chrome でも同じように読める');
 const api = await ev(`(() => {
  const E = FreeFoldEngine, st = __st;
  const sheets = [...new Set(st.cache.faces.map(f => E.sheetOf(st, f.faceId).map(x => x.faceId).sort().join('+')))].sort();
  const hints = E.hingeIntervals(st);
  return { sheets, hinge: hints.length, hingeOk: hints.every(h => h.consistent && h.gap === 0),
           crease: E.creaseIntervals(st).length, rim: E.rimEdges(st).length,
           ne: E.stackAt(st, [0.7, 0.35]).map(r => r.faceId).reverse(),
           faces: st.cache.faces.map(f => f.faceId + '@' + f.layer).sort(),
           same: JSON.stringify(st.cache.faces.map(f => [f.faceId, f.layer, Math.sign(f.xf[0]*f.xf[3]-f.xf[1]*f.xf[2])]))
            === JSON.stringify(__out.faces.map(f => [f.faceId, f.layer, Math.sign(f.xf[0]*f.xf[3]-f.xf[1]*f.xf[2])])) } })()`);
 assert.deepEqual(api.sheets, [
  'paper/s1.cut/s2.cut/s3.cut+paper/s1.keep/s2.cut/s3.keep', 'paper/s1.cut/s2.cut/s3.keep',
  'paper/s1.cut/s2.keep', 'paper/s1.keep/s2.cut/s3.cut+paper/s1.keep/s2.keep'].sort(), '6b 紙片の分かれかたが違う');
 assert.equal(api.hinge, 4, '6b 背が4本でない');
 assert.equal(api.hingeOk, true, '6b 背の線が両側で一致しない');
 assert.equal(api.crease, 2, '6b 開いた折り目が2本でない');
 assert.equal(api.rim, 6, '6b 外周辺が6本でない');
 assert.deepEqual(api.ne, ['paper/s1.keep/s2.keep', 'paper/s1.cut/s2.keep', 'paper/s1.cut/s2.cut/s3.keep', 'paper/s1.cut/s2.cut/s3.cut'],
  '6b 北東の重なりが違う');
 assert.equal(api.same, true, '6b 変換の前後で面ID・層・表裏が食い違う');

 mark('7 断るべきものは、実Chrome でも同じ理由で断る');
 const why = expr => ev(`(() => { try { SquashV2.replay(${expr}); return 'PASSED' } catch (e) { return e.message } })()`);
 const M2 = body => `(() => { const r = JSON.parse(JSON.stringify(__recipe)); ${body}; return r })()`;
 const cases = [
  ['未知 version', M2('r.version = 3'), /version が 2 ではありません/],
  ['v1 は担当外', M2('r.version = 1'), /担当ではありません/],
  ['未知 op（v1 の検証器）', M2("r.steps[0].op = 'squashFold'"), /前後の手（v1）.*未対応の操作/],
  ['top の未知項目（v1 の検証器）', M2("r.note = 'x'"), /前後の手（v1）.*unknown field/],
  ['紙の外の座標（v1 の検証器）', M2('r.steps[0].line[0] = [-2, 1]'), /前後の手（v1）.*out of range/],
  ['keep/cut でない side（v1 の検証器）', M2("r.steps[1].targets[0].layerPath[0].side = 'left'"), /前後の手（v1）.*side: invalid value/],
  ['stack の重複領域（v2）', M2('r.steps[2].stack.push(JSON.parse(JSON.stringify(r.steps[2].stack[0])))'), /同じ面の組の領域が2度/],
  ['squash の紙の外の軸（v2）', M2('r.steps[2].axes[0].end = [2, 0]'), /軸が原紙の外/],
  ['モデルと合わない紙', M2('r.steps = [r.steps[0], r.steps[2]]'), /4枚のはずです/],
  ['軸の役割の改変', M2("const a = r.steps[2].axes; a[1].role = 'drive'; a[2].role = 'link'"), /役割が合いません/],
  ['枝の改変', M2('r.steps[2].branch.sign = -1'), /branch.sign は 1 だけ/],
  ['stack の改変', M2('const s = r.steps[2].stack[0]; [s[0], s[1]] = [s[1], s[0]]'), /stack の上下が再生結果と違います/],
  ['基準面の改変', M2("r.steps[2].base.faceId = 'paper/s1.cut/s2.keep'"), /基準面が違います/],
 ];
 for (const [label, expr, re] of cases) {
  const msg = await why(expr);
  assert.notEqual(msg, 'PASSED', '7 ' + label + ' が実Chrome で通ってしまった');
  assert.match(msg, re, '7 ' + label + ' の理由が違う: ' + msg);
 }
 /* 断ったあと、画面も読みこんだ原本も動いていない。 */
 const still = await ev(`(() => { const o = SquashV2.replay(__recipe);
  return { hash: o.hash === __out.hash, version: __recipe.version, steps: __recipe.steps.length,
           drawn: squashDebug.frame.positions.length } })()`);
 assert.equal(still.hash, true, '7 断ったあとに再生結果が変わった');
 assert.equal(still.version, 2, '7 断ったあとに原本が書きかわった');
 assert.equal(still.steps, 3, '7 断ったあとに手の数が変わった');
 assert.equal(still.drawn, 72, '7 断ったあとに画面の座標が変わった');

 mark('8 engine の共通入口で 候補→確定→保存→再読込→undo→redo（実Chrome）');
 const flow = await ev(`(() => {
  const E = FreeFoldEngine, C = x => JSON.parse(JSON.stringify(x));
  const v1 = { ...C(__recipe), version: 1, steps: C(__recipe.steps.slice(0, 2)) };
  const st = E.create(); st.recipe = C(v1); st.cache = E.replay(st.recipe); st.committed = st.cache;
  const r = {};
  const p = E.proposeSquash(st);
  r.candidateSame = JSON.stringify(p.step) === JSON.stringify(__recipe.steps[2]);
  r.versionAfterPropose = st.recipe.version; r.revAfterPropose = st.revision;
  E.confirm(st);
  r.versionAfterConfirm = st.recipe.version; r.revAfterConfirm = st.revision;
  r.hashIsOriginal = st.cache.hash === E.replay(__recipe).hash;
  /* 袋折りのあとも、ふつうの折りの候補は作れる（2026-09-14。確定・整合は test_squash_after.js／画面は test_squash_after_browser.js）。取消して元へ。 */
  try { E.propose(st, [.5, 1], [1, .5], { layers: 1 }); r.afterFold = 'PASSED'; E.cancel(st) } catch (e) { r.afterFold = e.message }
  const text = JSON.stringify(E.verifiedRecipe(st), null, 2);
  const back = E.replay(JSON.parse(text));
  r.reload = back.hash === st.cache.hash;
  r.reloadBranch = JSON.stringify(back.squash.branch);
  r.faces = back.faces.map(f => f.faceId + ':' + (f.xf[0]*f.xf[3]-f.xf[1]*f.xf[2] > 0 ? 'o' : 'u') + '@' + f.layer).sort();
  r.opened = back.bonds.filter(b => b.openedBy === 's3').length;
  E.undo(st); r.undo = [st.recipe.version, st.recipe.steps.length, st.redoStack.length, JSON.stringify(E.verifiedRecipe(st)).length > 0];
  E.redo(st); r.redo = [st.recipe.version, st.recipe.steps.length, st.cache.hash === back.hash];
  return r })()`);
 assert.equal(flow.candidateSame, true, '8 実Chrome で組んだ候補が検証ずみ原本の手と違う');
 assert.deepEqual([flow.versionAfterPropose, flow.revAfterPropose], [1, 0], '8 候補だけで原本が変わった');
 assert.deepEqual([flow.versionAfterConfirm, flow.revAfterConfirm], [2, 1], '8 確定で v2 へ1手として移っていない');
 assert.equal(flow.hashIsOriginal, true, '8 確定の結果が検証ずみ原本の再生と違う');
 assert.equal(flow.afterFold, 'PASSED', '8 袋折りのあとの折りの候補が作れない: ' + flow.afterFold);
 assert.equal(flow.reload, true, '8 保存→再読込で hash が変わった');
 assert.equal(flow.reloadBranch, JSON.stringify({ linkage: 'tan-half-product-sqrt2', sign: 1, driveDeg: [0, 180] }), '8 再読込の運動の枝が違う');
 assert.equal(flow.faces.length, 6, '8 再読込の面が6枚でない');
 assert.equal(flow.opened, 2, '8 再読込で開いた結びが2本でない');
 assert.deepEqual(flow.undo, [2, 2, 1, true], '8 undo 1回で袋折りだけ外れ v2 のまま保存できる、になっていない');
 assert.deepEqual(flow.redo, [2, 3, true], '8 redo 1回で袋折りに戻らない');
 mark('  候補は原本不変／確定で v2・revision+1／保存→再読込一致／undo・redo 1回ずつ');

 assert.deepEqual(errors, [], 'console にエラー');
 console.log(JSON.stringify({
  result: 'PASS', url: base,
  model: 'degree4-45-tsuru3（つる③「ふくろを ひらいて つぶす」1件だけ）',
  checked: ['独立プレビューの上へ v2 再生器と原本を読みこめる（面6・結び6・領域3）',
            '画面が描画へ渡した座標＝v2 の再生結果（8コマとも最大差 0）',
            't=0 は v1 engine の面・t=1 は v2 の面が、どちらも画面の8三角形と一致',
            '画面自身の検証（厚み0・共有境界0）が通る', '実画素で紙が描かれ、表と裏を描き分けている',
            'カメラ回転・ズーム・下から見ても座標の一致は変わらない',
            '未知 version / 未知 op / 合わない紙 / 軸・枝・stack・基準面の改変を、理由つきで断る',
            '断ったあと、原本も画面の座標も動かない',
            'engine の共通入口で 候補→確定→保存→再読込→undo→redo が通り、袋折りのあとの折りの候補も作れる'],
  drawnVsReplay: '最大差 ' + worst,
  thickness: '0（層は「どちらが上か」だけ）',
  penetration: '⛔未検証（簡易な見張りだけ。見つかっていない、以上のことは言わない）',
  consoleErrors: errors.length, screenshots: shots,
 }, null, 1));
}
main().then(shutdown, async e => { await shutdown(); console.error(e); process.exit(1) });
