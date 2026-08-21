// 物理が fps に左右されないことを、機械で確かめる（プラン §10-3）。
//
//  ★これがプランで「最大の落とし穴」と書かれていた項目。
//    元の jump.js は deltaTime を使っておらず、毎フレーム 1回だけ
//    `vy += GRAVITY` していた（＝60fps前提）。そのまま3Dへ持ってくると、
//    描画が重い端末では**ジャンプの高さが変わってしまう**。
//    dt秒＋固定サブステップに直してあるので、ここで裏を取る。
//
//  たしかめること
//    ① どのフレームレートでも、ジャンプの到達高度が同じか
//    ② 足場をすり抜けないか（トンネリング）
//
//    node lab/chicchi-jump-3d/tools/physics_check.js
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
vm.runInContext('globalThis.__C = { ChicchiCore, CJ_JUMP_V, CJ_SPRING_V, CJ_PLAT_W, CJ_PLAT_H, CJ_VIEW_H };', ctx);
const C = ctx.__C;

let bad = 0;
const ng = m => { console.log('  NG: ' + m); bad++; };

// ---------------- ① ジャンプの到達高度 ----------------
function apexAt(dt) {
  const c = new C.ChicchiCore(12345, 0);
  c.reset();
  c.platforms.length = 0;
  c.coins.length = 0;
  c.spawnY = 1e9;                       // 足場を作らない
  const p = c.player;
  const y0 = p.y;
  p.vy = C.CJ_JUMP_V;
  let top = p.y;
  for (let i = 0; i < 4000; i++) {
    c.step(dt);
    top = Math.max(top, p.y);
    if (p.vy < 0 && p.y < top - 0.01) break;   // 頂点をこえた
  }
  return top - y0;
}

console.log('--- ジャンプの高さ（フレームレート別）---');
const rates = [[1 / 120, '120fps'], [1 / 60, '60fps'], [1 / 30, '30fps'], [1 / 20, '20fps（重い端末）']];
const heights = rates.map(([dt, name]) => {
  const h = apexAt(dt);
  console.log(`  ${name.padEnd(16)} ${h.toFixed(4)} world`);
  return h;
});
const hMin = Math.min(...heights), hMax = Math.max(...heights);
const spread = (hMax - hMin) / hMax;
console.log(`  ちらばり: ${(spread * 100).toFixed(2)} %`);
// 固定サブステップなので、どのfpsでも 1% 以内におさまるはず
if (spread > 0.01) ng(`fps でジャンプの高さが ${(spread * 100).toFixed(1)}% 変わる`);

// ---------------- ② 足場をすり抜けないか ----------------
// いちばん速く落ちてくる状況（バネの初速ぶんを落下に使う）で、
// うすい足場（高さ0.28）を踏み外さずに拾えるか。
function landsOn(dt, fall) {
  const c = new C.ChicchiCore(999, 0);
  c.reset();
  c.platforms.length = 0;
  c.coins.length = 0;
  c.spawnY = 1e9;
  const p = c.player;
  const platY = p.y - 6;
  c.platforms.push({ px: p.px, y: platY, w: C.CJ_PLAT_W, type: 'normal',
                     used: false, breakAt: 0, seed: 0.5, vx: 0 });
  p.vy = -fall;                          // 落ちてくる速さ
  for (let i = 0; i < 600; i++) {
    c.step(dt);
    if (p.vy > 0) return true;           // はね返った＝ちゃんと乗った
    if (p.y < platY - 2) return false;   // 通りぬけた
    if (c.over) return false;
  }
  return false;
}

console.log('\n--- 足場のすり抜け（速く落ちてきたとき）---');
for (const [dt, name] of rates) {
  for (const fall of [C.CJ_JUMP_V, C.CJ_SPRING_V, C.CJ_SPRING_V * 1.75]) {
    const ok = landsOn(dt, fall);
    if (!ok) ng(`${name} で 落下 ${fall.toFixed(1)} のとき すり抜けた`);
  }
}
console.log('  どのフレームレート・どの落下速度でも すり抜けなし');

console.log(bad === 0 ? '\n✅ すべて通った' : `\n❌ ${bad} 件`);
process.exit(bad === 0 ? 0 : 1);
