// biome の道のりを機械で検査する。
//   ① 区間にすきま・重なりが無いか
//   ② 同じ場所が2回つづけて出ないか（袋の変わり目もふくめて）
//   ③ 名前のついた場所が、決めた progress にちゃんと入っているか
//   ④ 0〜200,000 を1刻みで走らせて、数字がすべて有限か
//   ⑤ 明滅は 2Hz を超えないか（子どもの目を守るため）
//
//   node lab/chicchi-jump-3d/tools/biome_check.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const dir = path.join(__dirname, '..', 'js');
const src = ['gl.js', 'biome.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8'));
// gl.js は WebGL を触らないところ（小物と乱数）だけ要る。
// document を使わないので、そのまま素の文脈で走る。
const ctx = { module: { exports: {} }, console, Math, performance: { now: () => 0 } };
ctx.window = ctx;
vm.createContext(ctx);
// gl.js の頭のほうに WebGL の呼び出しは無く、定義だけなので通る
vm.runInContext(src[0], ctx);
vm.runInContext(src[1], ctx);
// ★core.js も要る。biome の長さは「何秒もつか」で決めるようになり、
//   そのために core の CJ_PACE_TIERS / cjRawFromProgress を使う。
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8'), ctx);
// ★const で書いた定数は、この文脈の「持ちもの」にはならない（関数宣言だけが載る）。
//   同じ文脈でもう1回走らせて、明示的に取り出す。
vm.runInContext('globalThis.__C = { CJ_BIOME_EVENTS, CJ_BIOME_POOL, CJ_BIOME_START, CJ_BIOME_DEFS, CJ_BIOME_SEC_MIN, CJ_BIOME_SEC_MAX, cjProgressPerSec };', ctx);
Object.assign(ctx, ctx.__C);

let bad = 0;
const ng = (m) => { console.log('  NG: ' + m); bad++; };

const SEEDS = [12345, 1, 777, 20260820, 99991];
for (const seed of SEEDS) {
  const tl = ctx.cjBiomeTimeline(seed, 220000);
  // ① すきま・重なり
  for (let i = 1; i < tl.length; i++) {
    if (Math.abs(tl[i].from - tl[i - 1].to) > 1e-9) {
      ng(`seed=${seed} 区間 ${i} にすきま/重なり: ${tl[i - 1].to} → ${tl[i].from}`);
    }
    if (tl[i].to <= tl[i].from) ng(`seed=${seed} 区間 ${i} の長さが0以下`);
  }
  // ② 連続重複
  for (let i = 1; i < tl.length; i++) {
    if (tl[i].key === tl[i - 1].key) {
      ng(`seed=${seed} 同じ場所が2回つづく: ${tl[i].key} (${tl[i].from})`);
    }
  }
  // ③ 名前のついた場所
  for (const ev of ctx.CJ_BIOME_EVENTS) {
    const o = ctx.cjBiomeAt(tl, ev.from + ev.len * 0.5);
    if (o.key !== ev.key) ng(`seed=${seed} ${ev.from} が ${ev.key} でなく ${o.key}`);
  }
  // ④ 数字がすべて有限か（1刻みは重いので 5 刻み）
  const out = ctx.cjBiomeOut();
  for (let p = 0; p <= 200000; p += 5) {
    ctx.cjBiomeAt(tl, p, out);
    for (const k in out) {
      const v = out[k];
      if (typeof v === 'number' && !Number.isFinite(v)) { ng(`seed=${seed} p=${p} ${k} が ${v}`); p = 1e9; break; }
      if (Array.isArray(v)) for (const x of v) if (!Number.isFinite(x)) { ng(`seed=${seed} p=${p} ${k} に ${x}`); p = 1e9; break; }
    }
    // 向きは長さ1か
    for (const k of ['bandDir', 'galDir', 'lensDir']) {
      const d = out[k], l = Math.hypot(d[0], d[1], d[2]);
      if (Math.abs(l - 1) > 1e-3) { ng(`seed=${seed} p=${p} ${k} の長さが ${l}`); p = 1e9; break; }
    }
    // ⑤ 明滅
    if (out.bA.hz > 2 || out.bB.hz > 2) { ng(`seed=${seed} p=${p} 明滅が ${Math.max(out.bA.hz, out.bB.hz)}Hz`); p = 1e9; }
  }
}

// ⑥ 切りかわりがなめらかか（数字がガクッと飛ばないか）
//    ★ここが飛ぶと、空の色や星の量が1フレームで変わって「バグに見える」。
{
  const tl = ctx.cjBiomeTimeline(20260820, 220000);
  const a = ctx.cjBiomeOut(), b = ctx.cjBiomeOut();
  let worst = 0, worstAt = 0, worstKey = '';
  for (let p = 12000; p <= 120000; p += 1) {
    ctx.cjBiomeAt(tl, p, a);
    ctx.cjBiomeAt(tl, p + 1, b);
    for (const k of ['starAmt', 'bandAmt', 'nebAmt', 'galAmt', 'darkAmt', 'lensAmt', 'skyMix', 'dustAmt']) {
      const d = Math.abs(a[k] - b[k]);
      if (d > worst) { worst = d; worstAt = p; worstKey = k; }
    }
  }
  console.log(`いちばん大きい1歩の変化: ${worstKey} ${worst.toFixed(4)} (progress ${worstAt})`);
  // 250 progress かけて 0→1.5 まで動いても、1歩ぶんは 0.006 くらい
  if (worst > 0.02) ng(`切りかわりが急すぎる（${worstKey} が1歩で ${worst.toFixed(3)}）`);
}

// 袋を長く回して、出方のかたよりを見る
{
  const tl = ctx.cjBiomeTimeline(4242, 400000);
  const cnt = {};
  for (const s of tl) if (s.from >= ctx.CJ_BIOME_START) cnt[s.key] = (cnt[s.key] || 0) + 1;
  const pool = ctx.CJ_BIOME_POOL;
  const vals = pool.map(k => cnt[k] || 0);
  console.log('区間の数:', tl.length, ' 巡回の出方:', pool.map((k, i) => `${k}=${vals[i]}`).join(' '));
  const mn = Math.min(...vals), mx = Math.max(...vals);
  if (mx - mn > 2) ng(`出方のかたよりが大きい（最小${mn} 最大${mx}）`);
}

// いくつかの地点で、何が見えるかを出す（目で見るための一覧）
{
  const tl = ctx.cjBiomeTimeline(12345, 220000);
  console.log('\n--- seed 12345 の道のり ---');
  for (const s of tl.slice(0, 26)) {
    console.log(`${String(Math.round(s.from)).padStart(7)} 〜 ${String(Math.round(s.to)).padStart(7)}  ${s.key}`);
  }
}


// ⑧ 1つの biome が何秒もつか（プランの狙いは 45〜80秒）
//   ★progress の長さではなく**秒**で見ること。深いほど1秒に進む progress が増えるので、
//     progress だけ見ていると「長くなった」と勘違いする（実際に勘違いした）。
console.log('\n--- 1つの biome がもつ時間 ---');
{
  const tl = ctx.cjBiomeTimeline(20260821, 220000);
  let worstShort = 1e9, worstLong = 0, n = 0;
  for (const s of tl) {
    if (s.from < ctx.__C.CJ_BIOME_START) continue;
    const sec = (s.to - s.from) / ctx.__C.cjProgressPerSec(s.from);
    worstShort = Math.min(worstShort, sec); worstLong = Math.max(worstLong, sec); n++;
  }
  console.log(`  ${n}区間  いちばん短い ${worstShort.toFixed(1)}秒 ／ いちばん長い ${worstLong.toFixed(1)}秒`);
  // 名前つきの手前でぴったり終わる区間は短くなることがある。10秒を切ったらさすがに困る
  if (worstShort < 10) ng(`biome が ${worstShort.toFixed(1)}秒しかもたない区間がある`);
  if (worstLong > 150) ng(`biome が ${worstLong.toFixed(1)}秒も続く区間がある`);
}

console.log(bad === 0 ? '\n✅ すべて通った' : `\n❌ ${bad} 件`);
process.exit(bad === 0 ? 0 : 1);