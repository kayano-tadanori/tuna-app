// すみっこ待ちが本当に成立しなくなったかを、node で core.js だけ回して測る。
//   お手本プレイヤー＝「隅から動かず、いちばん近い敵を撃つだけ」
//   これで長く生き残れてしまうなら、待ちプレイが成立している。
//   usage: node camptest.js <js dir> [seconds] [diff]
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = process.argv[2];
const SECS = Number(process.argv[3] || 180);
const DIFF = process.argv[4] || 'normal';

let src = ['gl.js', 'core.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
src += '\n;globalThis.__G = G; globalThis.__BUG = BUG;';

const ctx = { console, Math, performance: { now: () => 0 }, Date };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const G = ctx.__G;

const FIXED = 1 / 120;
const W = 1500, H = 700;

function run(seed, cornerMode) {
  // 乱数を固定
  let st = seed >>> 0;
  const rng = () => {
    st = (st + 0x6D2B79F5) | 0;
    let t = Math.imul(st ^ (st >>> 15), 1 | st);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ctx.__rng = rng;
  vm.runInContext('Math.random = globalThis.__rng;', ctx);

  G.reset('survival', DIFF, W, H);
  const inp = { mx: 0, my: 0, ax: 1, ay: 0, fire: true, autoAim: false };
  // 隅の座標（左下）
  const cx = -W / 2 + 55, cy = -H / 2 + 55;
  let deaths = 0, t = 0, maxT = 0;
  // すみっこに居られた割合と、脅威が来る向きの広さを測る
  let inCornerN = 0, sampleN = 0, spreadSum = 0, spreadN = 0, distSum = 0;
  const steps = Math.round(SECS / FIXED);
  for (let i = 0; i < steps; i++) {
    const p = G.p;
    if (cornerMode) {
      // 隅へ押しつけ続ける
      const dx = cx - p.x, dy = cy - p.y;
      const d = Math.hypot(dx, dy) || 1;
      inp.mx = d > 12 ? dx / d : 0;
      inp.my = d > 12 ? dy / d : 0;
    } else {
      // 比較用：近い敵から逃げる ふつうのプレイ
      let bx = 0, by = 0;
      for (const e of G.enemies) {
        if (e.age < e.born) continue;
        const ddx = e.x - p.x, ddy = e.y - p.y, dd = Math.hypot(ddx, ddy) || 1;
        if (dd < 300) { bx -= ddx / dd * (300 - dd) / 300; by -= ddy / dd * (300 - dd) / 300; }
      }
      bx += -p.x / 900 * 0.6; by += -p.y / 500 * 0.6;
      const m = Math.hypot(bx, by) || 1;
      inp.mx = bx / m; inp.my = by / m;
    }
    // いちばん近い敵をねらう
    let best = 1e9, tx = 1, ty = 0;
    for (const e of G.enemies) {
      if (e.age < e.born) continue;
      const ddx = e.x - p.x, ddy = e.y - p.y, dd = Math.hypot(ddx, ddy) || 1;
      if (dd < best) { best = dd; tx = ddx / dd; ty = ddy / dd; }
    }
    inp.ax = tx; inp.ay = ty;

    if (i % 12 === 0) {
      sampleN++;
      const rx = Math.abs(p.x) / (W / 2), ry = Math.abs(p.y) / (H / 2);
      if ((rx > 0.60 && ry > 0.52) || rx > 0.80 || ry > 0.76) inCornerN++;
      distSum += Math.hypot(p.x - cx, p.y - cy);
      // 260以内の敵が どれだけ広い角度から来ているか（0〜360度）
      const angs = [];
      for (const e of G.enemies) {
        if (e.age < e.born) continue;
        const ddx = e.x - p.x, ddy = e.y - p.y;
        if (Math.hypot(ddx, ddy) < 320) angs.push(Math.atan2(ddy, ddx));
      }
      if (angs.length >= 2) {
        angs.sort((a, b) => a - b);
        let gap = angs[0] + Math.PI * 2 - angs[angs.length - 1];
        for (let k = 1; k < angs.length; k++) gap = Math.max(gap, angs[k] - angs[k - 1]);
        spreadSum += (Math.PI * 2 - gap) * 180 / Math.PI;   // 脅威が占める角度
        spreadN++;
      }
    }
    const before = G.lives;
    G.update(FIXED, inp);
    G.events.length = 0;
    if (G.lives < before) deaths++;
    t += FIXED;
    if (G.phase === 'over') break;
    maxT = t;
  }
  return { t: maxT, deaths, score: G.score, mult: G.mult, over: G.phase === 'over',
           corner: inCornerN / Math.max(1, sampleN),
           dist: distSum / Math.max(1, sampleN),
           spread: spreadSum / Math.max(1, spreadN) };
}

const rows = [];
for (const seed of [11, 22, 33]) {
  rows.push(['すみっこ待ち', seed, run(seed, true)]);
  rows.push(['ふつうに動く', seed, run(seed, false)]);
}
for (const [name, seed, r] of rows) {
  console.log(`${name} seed=${seed}  死${r.deaths}  score=${(r.score/1e6).toFixed(2)}M x${r.mult}  ` +
              `すみっこ滞在 ${(r.corner*100).toFixed(0)}%  隅からの平均距離 ${r.dist.toFixed(0)}  ` +
              `脅威の角度 ${r.spread.toFixed(0)}度`);
}
