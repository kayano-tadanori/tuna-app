// 場所ごとの手ざわり（プラン §6.3）が、ほんとうに効いているか数える。
//  ★表を書いただけで満足しない。**足場の配合が変わっていること**を数えて確かめる。
//    node lab/chicchi-jump-3d/tools/zone_check.js
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
vm.runInContext('globalThis.__C = { ChicchiCore, CJ_ZONES, cjZoneAt, cjRawFromProgress, CJ_M_PER_WORLD, CJ_SCROLL_OFF, cjYAtProgress };', ctx);
const C = ctx.__C;

let bad = 0;
const ng = m => { console.log('  NG: ' + m); bad++; };

// その progress のあたりで足場を1000枚つくって、種類のわりあいを数える
function mix(progress, seed) {
  const c = new C.ChicchiCore(seed || 4242, 0);
  c.reset();
  c.climb = C.cjRawFromProgress(progress) / C.CJ_M_PER_WORLD;
  c.updateInfo();
  const y0 = C.cjYAtProgress(progress);
  c.platforms.length = 0;
  const n = { normal: 0, ice: 0, break: 0, spring: 0, moving: 0 };
  for (let i = 0; i < 1200; i++) {
    c.platforms.length = 0;
    c.genPlatformAt(y0 + (i % 40) * 0.05);
    for (const pl of c.platforms) { n[pl.type]++; if (pl.vx) n.moving++; }
  }
  const t = n.normal + n.ice + n.break + n.spring;
  return { ice: n.ice / t, brk: n.break / t, spring: n.spring / t, move: n.moving / t };
}

console.log('--- 場所ごとの足場の配合 ---');
console.log('  場所                氷      こわれ   バネ    動く');
const rows = [
  [6000,  '火星のむこう'],
  [7000,  '小惑星帯'],
  [10000, '天王星'],
  [11000, '海王星'],
  [12000, 'カイパーベルト'],
  [14000, 'ヘリオポーズ'],
  [17000, '星の海'],
];
const got = {};
for (const [p, name] of rows) {
  const m = mix(p);
  got[name] = m;
  console.log(`  ${name.padEnd(16)} ${(m.ice*100).toFixed(1).padStart(5)}%  ${(m.brk*100).toFixed(1).padStart(5)}%` +
              `  ${(m.spring*100).toFixed(1).padStart(5)}%  ${(m.move*100).toFixed(1).padStart(5)}%`);
}

console.log('\n--- 表のとおりに効いているか ---');
const chk = (a, b, key, what) => {
  if (got[a][key] > got[b][key]) console.log(`  OK: ${what}`);
  else ng(`${what}（${a}=${(got[a][key]*100).toFixed(1)}% / ${b}=${(got[b][key]*100).toFixed(1)}%）`);
};
chk('小惑星帯', '火星のむこう', 'brk', '小惑星帯は こわれる岩が多い');
chk('カイパーベルト', '火星のむこう', 'ice', 'カイパーベルトは 氷が多い');
chk('海王星', '天王星', 'move', '海王星は 風で足場がよく動く');
chk('火星のむこう', 'ヘリオポーズ', 'brk', 'ヘリオポーズは こわれ雲がへる');
chk('火星のむこう', 'ヘリオポーズ', 'ice', 'ヘリオポーズは 氷がへる');

console.log('\n--- じゃま役の出やすさ ---');
{
  const c = new C.ChicchiCore(7, 0); c.reset();
  const at = p => { c.climb = C.cjRawFromProgress(p) / C.CJ_M_PER_WORLD; c.updateInfo(); return c.foeRate(); };
  for (const [p, name] of [[6000,'火星のむこう'],[7000,'小惑星帯'],[11000,'海王星'],
                           [14000,'ヘリオポーズ'],[15000,'ボイジャー並走'],[17000,'星の海']]) {
    const r = at(p);
    console.log(`  ${name.padEnd(16)} ${r.toFixed(2)} 倍`);
  }
  if (at(15000) !== 0) ng('ボイジャーと並走中なのに じゃま役が出る');
  if (at(14000) >= at(6000)) ng('ヘリオポーズが静かになっていない');
  if (at(7000) <= at(6000)) ng('小惑星帯がにぎやかになっていない');
}

console.log(bad === 0 ? '\n✅ すべて通った' : `\n❌ ${bad} 件`);
process.exit(bad === 0 ? 0 : 1);
