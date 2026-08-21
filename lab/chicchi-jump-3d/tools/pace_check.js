// 登る速さ（progress/秒）を実測する。
//  ★biome の長さも、巡回の始まりも、**これを測らずに決めてはいけない**。
//    机上で「1,200〜2,200 progress」と書いても、実際に何秒もつかは
//    そのときの progress/秒 で決まる（深宇宙ほどペース倍率が大きい）。
//
//    node lab/chicchi-jump-3d/tools/pace_check.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'js');
const ctx = { module: { exports: {} }, console, Math, performance: { now: () => 0 },
              localStorage: { getItem: () => null, setItem: () => {} } };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['gl.js', 'biome.js', 'core.js']) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx);
}
vm.runInContext('globalThis.__C = { ChicchiCore, CJ_BIOME_SEC_MIN, CJ_BIOME_SEC_MAX, CJ_BIOME_START, cjProgressPerSec };', ctx);
const C = ctx.__C;

// 自動操縦：いちばん近い足場へ寄って登り続ける（play.py の AUTOPILOT と同じ考え方）
vm.runInContext('globalThis.__W = { cjWrapDelta, CJ_VIEW_W };', ctx);
const W = ctx.__W;

function run(seconds, seed) {
  const c = new C.ChicchiCore(seed, 0);
  c.reset();
  c.launch();                 // ★公園のバネから飛び出す。これを呼ばないと一歩も進まない
  const dt = 1 / 60, steps = Math.round(seconds / dt);
  const marks = [];
  let deaths = 0;
  for (let i = 0; i < steps; i++) {
    const p = c.player;
    let best = null;
    if (p.vy >= 0) {
      for (const pl of c.platforms) {
        if (pl.used || pl.y <= p.y + 0.05) continue;
        if (!best || pl.y < best.y) best = pl;
      }
    }
    if (!best) {
      for (const pl of c.platforms) {
        if (pl.used || pl.y > p.y - 0.05) continue;
        if (!best || pl.y > best.y) best = pl;
      }
    }
    if (best) {
      const d = W.cjWrapDelta(best.px, c.camPx);
      c.setTargetFromScreen(0.5 + d / W.CJ_VIEW_W);
    }
    c.step(dt);
    // ★月・火星は「ここでやめる／もっと先へ」で止まる。測るときは先へ進める。
    if (c.ending) c.continueFromMoon();
    if (c.over) { deaths++; break; }
    if (i % 60 === 0) marks.push([i * dt, c.progress]);
  }
  marks.push([steps * dt, c.progress]);
  return { marks, deaths };
}

console.log('--- 登る速さ（自動操縦・実測）---');
// ★死んだらそこで止まる。1回のプレイで どこまで行けるかを見たいので、
//   いちばん長く生きのびた回を採用する（下手な回で測ると速さを見誤る）。
let marks = [], deaths = 0;
for (const sd of [4242, 777, 31337, 9001, 20260821]) {
  const r = run(900, sd);
  if (r.marks[r.marks.length - 1][1] > (marks.length ? marks[marks.length - 1][1] : -1)) marks = r.marks;
  deaths += r.deaths;
}
console.log(`  （5回まわして、いちばん進んだ回を採用。落ちた回 ${deaths}/5）`);
const at = p => { for (const [t, pr] of marks) if (pr >= p) return t; return null; };
const pts = [1000, 3000, 5000, 8000, 11500, 13000, 15000, 20000, 25000, 30000, 40000];
let prevT = 0, prevP = 0;
for (const p of pts) {
  const t = at(p);
  if (t == null) { console.log(`  ${String(p).padStart(6)} … 10分では届かない`); continue; }
  const rate = (p - prevP) / Math.max(t - prevT, 1e-6);
  console.log(`  ${String(p).padStart(6)}  ${String(Math.floor(t/60)).padStart(2)}分${String(Math.round(t%60)).padStart(2)}秒` +
              `   この区間 ${rate.toFixed(0)} progress/秒`);
  prevT = t; prevP = p;
}
console.log(`\n--- 速さの見つもりが当たっているか ---`);
const last = marks[marks.length - 1];
const deepRate = (last[1] - marks[Math.max(0, marks.length - 61)][1]) / 60;
console.log(`  最後の1分の実測  : ${deepRate.toFixed(0)} progress/秒`);
// ★biome の長さはこの式で決まる。式が実測とかけ離れていたら、biome の秒数も嘘になる。
console.log(`  式が見こむ速さ    : ${C.cjProgressPerSec(last[1]).toFixed(0)} progress/秒`);
console.log(`  biome の狙い     : ${C.CJ_BIOME_SEC_MIN}〜${C.CJ_BIOME_SEC_MAX}秒（実際の長さは biome_check.js で見る）`);
console.log(`  10分で届く progress: ${Math.round(last[1])}（巡回の始まりは ${C.CJ_BIOME_START}）`);
