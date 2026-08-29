// バグホールどうしがぶつかったとき、消えずに 合体して強くなるかを node で測る。
//   usage: node holetest.js <js dir>
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = process.argv[2] || path.join(__dirname, '..', 'js');
let src = ['gl.js', 'core.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
src += '\n;globalThis.__G = G; globalThis.__BUG = BUG; globalThis.__TIER = HOLE_TIER;';
const ctx = { console, Math, performance: { now: () => 0 }, Date };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const G = ctx.__G, BUG = ctx.__BUG, TIER = ctx.__TIER;
const FIXED = 1 / 120;

// 場を空にして ホールだけを置く
function stage(n) {
  G.reset('survival', 'normal', 1500, 700);
  G.enemies.length = 0; G.spawns.length = 0;
  G.spawnEnemy = ((orig) => function (type, x, y, gen) {   // 湧きを止める
    return orig.call(this, type, x, y, gen);
  })(G.spawnEnemy);
  const hs = [];
  for (let i = 0; i < n; i++) {
    const h = G.spawnEnemy('hole', -300 + i * 300, -200);
    h.born = 0; h.age = 1; h.settled = true;
    hs.push(h);
  }
  G.p.x = 600; G.p.y = 250;   // 自機は遠くに置く
  return hs;
}

function step(sec) {
  const inp = { mx: 0, my: 0, ax: 1, ay: 0, fire: false, autoAim: false };
  for (let i = 0; i < Math.round(sec / FIXED); i++) {
    G.p.x = 600; G.p.y = 250; G.p.vx = 0; G.p.vy = 0;   // 自機を固定（吸われないように）
    G.update(FIXED, inp);
    const merged = G.events.filter(e => e.k === 'merge' || e.type === 'merge');
    G.events.length = 0;
    // 湧いた敵は じゃまなので ホール以外を消す
    for (let k = G.enemies.length - 1; k >= 0; k--) if (G.enemies[k].type !== 'hole') G.enemies.splice(k, 1);
    G.spawns.length = 0;
  }
}

function holes() { return G.enemies.filter(e => e.type === 'hole'); }
function show(tag) {
  const hs = holes();
  console.log(`${tag}: ホール${hs.length}体 ` + hs.map(h =>
    `[${TIER[h.tier].name} tier=${h.tier} hp=${h.hp} r=${h.r.toFixed(0)} grow=${h.grow.toFixed(1)}]`).join(' '));
  return hs;
}

console.log('■ 素のバグホール hp =', BUG.hole.hp, '（前は12）');
console.log('■ 段:', TIER.map(t => `${t.name}(hp×${t.hp} r×${t.rk} 点×${t.pts})`).join(' / '));

// 1) 2体 → 合体して メガホール
stage(2); show('置いた直後');
step(6);
let hs = show('6びょう後');
if (hs.length !== 1) { console.log('✗ 合体していない'); process.exit(1); }
if (hs[0].tier !== 1) { console.log('✗ 段が上がっていない'); process.exit(1); }
console.log(`✓ 2体 → ${TIER[1].name}（消滅していない）`);

// 2) さらに もう1体ぶつける → ギガホール
const extra = G.spawnEnemy('hole', hs[0].x + 260, hs[0].y);
extra.born = 0; extra.age = 1; extra.settled = true;
step(6);
hs = show('もう1体ぶつけた');
if (hs.length !== 1 || hs[0].tier !== 2) { console.log('✗ 2段目に上がらない'); process.exit(1); }
console.log(`✓ ${TIER[2].name} まで育つ`);

// 3) 上限のホールどうし → 消えずに 体力とビットだけ増える
const e2 = G.spawnEnemy('hole', hs[0].x + 260, hs[0].y);
e2.born = 0; e2.age = 1; e2.settled = true;
const before = { hp: hs[0].hp, grow: hs[0].grow };
step(6);
hs = show('上限どうし');
if (hs.length !== 1) { console.log('✗ 上限どうしで消えた'); process.exit(1); }
if (hs[0].grow <= before.grow) { console.log('✗ 上限どうしで 育っていない'); process.exit(1); }
console.log('✓ 上限どうしでも 消えずに 大きくなる');

// 4) 点とビット
for (const t of [0, 1, 2]) {
  G.enemies.length = 0;
  const h = G.spawnEnemy('hole', 0, 0);
  h.born = 0; h.age = 1; h.settled = true; h.tier = t; h.grow = 0;
  const sc = G.score, bits = G.bits.length;
  G.mult = 1;
  G.killEnemy(0, 0, 0, false);
  console.log(`${TIER[t].name}: ${G.score - sc}点 / ビット${G.bits.length - bits}こ`);
}

// 5) かたさ（3れんしゃを 当てつづけて 何びょうで こわれるか）
for (const t of [0, 1, 2]) {
  G.enemies.length = 0;
  const h = G.spawnEnemy('hole', 0, 0);
  h.born = 0; h.age = 1; h.settled = true; h.tier = t;
  h.hp = Math.round(BUG.hole.hp * TIER[t].hp);
  const rate = G.D.fireRate;
  let sec = 0;
  while (G.enemies.length && sec < 30) { sec += rate; h.hp -= 3; if (h.hp <= 0) { G.enemies.length = 0; } }
  console.log(`${TIER[t].name}: hp=${Math.round(BUG.hole.hp * TIER[t].hp)} ＝ 全弾命中で ${sec.toFixed(2)}秒`);
}
console.log('すべて OK');
