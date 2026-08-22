// 自動照準（かんたんモード）が ちゃんと効いているかを 数字で測る。
//   プレイヤーは 動くだけで ねらいの入力は一切しない＝自動照準まかせ。
//   比べる相手は「いつも一番近い敵を完璧にねらう」手動プレイ。
//   usage: node aimtest.js <js dir> [seconds] [diff]
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = process.argv[2];
const SECS = Number(process.argv[3] || 120);
const DIFF = process.argv[4] || 'normal';

let src = ['gl.js', 'core.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
src += '\n;globalThis.__G = G;';
const ctx = { console, Math, performance: { now: () => 0 }, Date };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const G = ctx.__G;

const FIXED = 1 / 120;
const W = 1500, H = 700;

function run(seed, mode) {
  let st = seed >>> 0;
  ctx.__rng = () => {
    st = (st + 0x6D2B79F5) | 0;
    let t = Math.imul(st ^ (st >>> 15), 1 | st);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  vm.runInContext('Math.random = globalThis.__rng;', ctx);

  G.reset('survival', DIFF, W, H);
  const inp = { mx: 0, my: 0, ax: 0, ay: 0, fire: true, autoAim: mode === 'auto' };
  let fired = 0, kills = 0, deaths = 0, t = 0;
  const steps = Math.round(SECS / FIXED);
  for (let i = 0; i < steps; i++) {
    const p = G.p;
    // 動きは 両モードで同じ：近い敵から逃げつつ 中央へ寄る
    let bx = 0, by = 0;
    for (const e of G.enemies) {
      if (e.age < e.born) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d < 300) { bx -= dx / d * (300 - d) / 300; by -= dy / d * (300 - d) / 300; }
    }
    bx += -p.x / 900 * 0.6; by += -p.y / 500 * 0.6;
    const m = Math.hypot(bx, by) || 1;
    inp.mx = bx / m; inp.my = by / m;

    if (mode === 'auto') {
      inp.ax = 0; inp.ay = 0;          // ねらいの入力は 一切しない
    } else {
      let best = 1e9, tx = 1, ty = 0;
      for (const e of G.enemies) {
        if (e.age < e.born) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < best) { best = d; tx = dx / d; ty = dy / d; }
      }
      inp.ax = tx; inp.ay = ty;
    }

    const b0 = G.bullets.length, k0 = G.killTotal, l0 = G.lives;
    G.update(FIXED, inp);
    G.events.length = 0;
    if (G.bullets.length > b0) fired += G.bullets.length - b0;
    kills += G.killTotal - k0;
    if (G.lives < l0) deaths++;
    t += FIXED;
    if (G.phase === 'over') break;
  }
  return { t, fired, kills, deaths, score: G.score, mult: G.mult,
           hit: fired ? kills / fired : 0 };
}

for (const seed of [11, 22, 33]) {
  const a = run(seed, 'auto');
  const m = run(seed, 'manual');
  const pct = m.kills ? (a.kills / m.kills * 100) : 0;
  console.log(
    `seed=${seed}  自動: 撃破${String(a.kills).padStart(4)} 命中率${(a.hit*100).toFixed(1)}% 死${a.deaths} score=${(a.score/1e6).toFixed(2)}M` +
    `  ／ 手動(完璧): 撃破${String(m.kills).padStart(4)} 命中率${(m.hit*100).toFixed(1)}% 死${m.deaths} score=${(m.score/1e6).toFixed(2)}M` +
    `  → 自動は手動の ${pct.toFixed(0)}%`);
}
