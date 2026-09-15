'use strict';
/* 🧺❓ 「袋が1つに決まらない」の門まわりの確認（2026-09-15・本体は無変更＝読み込んだ写しに記録を足すだけ）。
   ★見ること（候補が2つ以上になるときの区別）
     - 同じ袋の重複表現：動く区間と「区間→モデルの区間」の対応が同じなのに、読みかえ (D,G) が別。
       作りの上では起きない（D は区間の並べかえから1つに決まり、G は姿の一致から1つに決まる）→ 探索で0件を確かめる
     - 本当に別の袋：動く区間の組が違う。姿が合う段階では2つある紙が多い（表と裏のフラップ）→ 物理の条件（出発の上下・止まる光線の一周の順）で残るのが0か1つ
   ★言えないこと：物理の条件を通る「別の袋が2つ同時にある紙」は、探索した範囲に無かった＝「1つに決まらない」の門は**未確認**（鳴らせていない）。
     一般に起きないことの証明ではない。探索の範囲＝平らな紙から、中心を通る4本の線の折り（上からN枚・山谷・折る側2点）・裏返し v・袋折り を最大 DEPTH 手。
   使い方： node test_squash_pocket_count.js [--depth 5]
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const DEPTH = process.argv.includes('--depth') ? +process.argv[process.argv.indexOf('--depth') + 1] : 4;
const ctx = vm.createContext({ console, performance }); ctx.globalThis = ctx;
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js']) vm.runInContext(rd(f), ctx);
/* 写し：姿が合った読みかえと、最後まで残った読みかえを記録する（判定は1文字も変えない） */
let v2 = rd('squash_v2.js');
const P1 = "  if (!pose) { note(2, '袋の置かれ方が、検証ずみモデルの直前状態と違います'); continue }";
const P2 = " if (found.length > 1) bad(`袋が1つに決まりません（${found.length}通り）`);";
assert.equal(v2.split(P1).length, 2, '写しが作れない（姿の照合の行が変わった）'); assert.equal(v2.split(P2).length, 2, '写しが作れない（1つに決まらない門の行が変わった）');
v2 = v2.replace(P1, P1 + "\n  if (globalThis.__POSE) globalThis.__POSE.push({ D, G, sec: [S(1), S(2), S(3), S(4)] });")
       .replace(P2, " if (globalThis.__FOUND) globalThis.__FOUND.push(found.map(f => ({ sec: f.follow.slice(), modelOfSector: f.modelOfSector.slice() })));\n" + P2);
vm.runInContext(v2, ctx);
vm.runInContext('SquashV2.useV1Validator(OrigamiRecipe.validate,' + rd('origami_recipe.schema.json') + ')', ctx);
const E = vm.runInContext('FreeFoldEngine', ctx), V = vm.runInContext('SquashV2', ctx);
const C = x => JSON.parse(JSON.stringify(x)), J = JSON.stringify;
const load = r => { const st = E.create(); st.recipe = C(r); st.cache = E.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache; return st };
const S = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const LINES = [[[-1, 0], [1, 0]], [[0, -1], [0, 1]], [[-1, -1], [1, 1]], [[-1, 1], [1, -1]]];
const T = { states: 0, poseStates: 0, poseReps: 0, sameReprDup: 0, posePockets: {}, reachedGate: 0, gateCounts: {}, accepted: 0 };
const seen = new Set();
function analyze(rec) {
 const st = load(rec); if (seen.has(st.cache.hash)) return false; seen.add(st.cache.hash); T.states++;
 ctx.__POSE = []; ctx.__FOUND = [];
 let ok = true; try { V.readPocket(st.cache, [0, 0]) } catch { ok = false }
 if (st.cache.faces.length > 4 && ctx.__POSE.length) {
  T.poseStates++; T.poseReps += ctx.__POSE.length;
  /* 同じ袋の重複表現＝動く区間の並び（モデルの P1〜P4 に来る区間）が同じ読みかえが2つ以上 */
  const keys = ctx.__POSE.map(p => J(p.sec)); T.sameReprDup += keys.length - new Set(keys).size;
  const pockets = new Set(ctx.__POSE.map(p => J(p.sec.slice(0, 3).sort((a, b) => a - b)))).size;
  T.posePockets[pockets] = (T.posePockets[pockets] || 0) + 1;
 }
 for (const f of ctx.__FOUND) { T.reachedGate++; T.gateCounts[f.length] = (T.gateCounts[f.length] || 0) + 1 }
 if (ok && st.cache.faces.length > 4) T.accepted++;
 return true;
}
function foldFrom(rec, x) {
 const st = load(rec); let A = x.a, B = x.b; if (S(x.at, A, B) > 0) [A, B] = [B, A];
 let ids; try { ids = E.topFaces(st, x.at, x.m, A, B) } catch { return null }
 const f = ids.map(id => st.cache.faces.find(g => g.faceId === id)).find(g => { const q = E.split(g.poly, x.a, x.b); return q[0] && q[1] }); if (!f) return null;
 try { E.proposeOnFace(st, x.a, x.b, f.faceId, { layers: 1 }); st.pending.kind = x.kind; E.setSide(st, x.at);
  st.pending.candidates = ids.map(id => ({ faceId: id, layerPath: st.cache.faces.find(g => g.faceId === id).layerPath })); E.select(st, st.pending.candidates); E.confirm(st) } catch { return null }
 return st.recipe;
}
let frontier = [E.create().recipe]; analyze(frontier[0]);
for (let depth = 1; depth <= DEPTH; depth++) {
 const next = [];
 for (const rec of frontier) {
  const st = load(rec), moves = [];
  for (const [a, b] of LINES) { const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d), n = [-d[1] / L, d[0] / L];
   for (const sg of [1, -1]) for (const r of [.3, .6]) { const at = [n[0] * r * sg + d[0] / L * .2, n[1] * r * sg + d[1] / L * .2];
    let la; try { la = E.layersAt(st, at) } catch { continue } if (!la.layers.length || la.duplicated.length) continue;
    for (const kind of ['V', 'M']) for (let m = 1; m <= la.layers.length; m++) moves.push(() => foldFrom(rec, { a, b, at, kind, m })) } }
  moves.push(() => { const s = load(rec); E.flip(s, 'v'); return s.recipe });
  moves.push(() => { const s = load(rec); try { const o = E.squashOptions(s); if (!o.options.length) return null; E.proposeSquash(s, o.options[0].pocketId); E.confirm(s); return s.recipe } catch { return null } });
  for (const mv of moves) { const r = mv(); if (r && analyze(r)) next.push(r) }
 }
 frontier = next.slice(0, 1500);
}
console.log('    探索：' + J(T));
assert.ok(T.poseStates > 100 && T.accepted > 50, '探索が狭すぎる（袋の候補に届いていない）');
assert.equal(T.sameReprDup, 0, '同じ袋を別の読みかえで重複して表す紙がある（1つに決まらない門が、同じ袋で誤って鳴る）');
console.log('  ok 同じ袋の重複表現（動く区間の並びが同じで読みかえが別）：0件');
assert.ok(Object.keys(T.posePockets).some(k => +k >= 2), '姿の段階で別の袋が2つある紙が無い（区別の確認になっていない）');
console.log(`  ok 姿の段階で別の袋が2つある紙 ${T.posePockets[2] || 0}状態：物理の条件で残るのは0か1つ（門に届いた ${T.reachedGate}回すべて ${J(T.gateCounts)}）`);
assert.deepEqual(Object.keys(T.gateCounts), ['1'], '物理の条件を通る別の袋が2つ以上の紙が見つかった（門が鳴る例＝記録すること）');
console.log('  ⚠ 「袋が1つに決まらない」の門は、この探索でも鳴らない＝未確認のまま');
