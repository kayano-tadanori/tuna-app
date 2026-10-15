// ============================================================
// make_hints.js — 🔍 ヒント（サーチ）用の「答えの手順」を PC で前もって作る
//   にもつを おす手を1手とする最良優先探索（見こみ＝にもつ と おきば を近い組から くっつけた きょり）。
//   答えは さいたん とは限らない（ヒントは「その先に クリアが ある1手」なら十分）。
//   ★作った手順は core.js で 1面ずつ再生して、クリアになるものだけ 採用する。
//
//   使い方（tuna app で）：
//     node lab/okatazuke/tools/make_hints.js            … まだ答えの無い面を解いて js/hints.js を書く
//     node lab/okatazuke/tools/make_hints.js 51,54      … その面だけ
//     node lab/okatazuke/tools/make_hints.js --write    … 解かずに js/hints.js だけ作りなおす
//   調べる量：LIMIT（盤面の数・既定 800万） TIME（1面の時間 ms・既定 10分） W（見こみの重み・既定 4）
//   ★むずかしい面は 1面 数分〜。解けなかった面は ヒントが「まだ用意できてへん」と出る（アイテムは へらない）
//   ★面を作りなおしたら（make_levels.py）この道具も流しなおす。面が変わった答えは 名前（ハッシュ）が合わず使われない
// ============================================================
const fs = require('fs'), path = require('path');
const HERE = __dirname;
const CACHE = path.join(HERE, '_hints.json');
const OUT = path.join(HERE, '..', 'js', 'hints.js');
const args = process.argv.slice(2);
const writeOnly = args.includes('--write');
const only = args.find(a => /^[0-9,]+$/.test(a)) ? args.find(a => /^[0-9,]+$/.test(a)).split(',').map(Number) : null;
const LIMIT = +(process.env.LIMIT || 8000000), TIME = +(process.env.TIME || 600000);
const OKZ = require(path.join(HERE, '..', 'js', 'core.js'));
const src = fs.readFileSync(path.join(HERE, '..', 'js', 'levels.js'), 'utf8');
const OK_LEVELS = (new Function(src.replace("'use strict';", '') + '; return OK_LEVELS;'))();
// game.js の okHash と同じ
function okHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function solve(g) {
  const w = g.w, N = w * g.h;
  const wall = new Uint8Array(N), goal = new Uint8Array(N);
  for (let i = 0; i < N; i++) { wall[i] = g.wall[i] ? 1 : 0; goal[i] = g.goal[i] ? 1 : 0; }
  for (let x = 0; x < w; x++) { wall[x] = 1; wall[N - w + x] = 1; }   // 外周は かべ扱い（はみ出し防止）
  for (let y = 0; y < g.h; y++) { wall[y * w] = wall[y * w] || 0; }
  const dead = g.dead;
  const D = [-w, w, -1, 1], DK = 'UDLR';
  const dist = new Uint16Array(N).fill(9999);
  { const q = []; for (let i = 0; i < N; i++) if (goal[i]) { dist[i] = 0; q.push(i); }
    for (let qi = 0; qi < q.length; qi++) { const i = q[qi];
      for (const d of D) { const b = i + d, s = i + 2 * d;
        if (b < 0 || b >= N || s < 0 || s >= N || wall[b] || wall[s] || dist[b] !== 9999) continue;
        dist[b] = dist[i] + 1; q.push(b); } } }
  const occ = new Uint8Array(N), mark = new Uint32Array(N); let stamp = 0;
  const st = new Int32Array(N);
  const reach = (p, boxes) => {   // mark[]==stamp が 行ける所。代表＝最小番号
    stamp++; for (const b of boxes) occ[b] = 1;
    let top = 0, min = p; st[top++] = p; mark[p] = stamp;
    while (top) { const i = st[--top]; if (i < min) min = i;
      for (let k = 0; k < 4; k++) { const j = i + D[k];
        if (j < 0 || j >= N || mark[j] === stamp || wall[j] || occ[j]) continue;
        mark[j] = stamp; st[top++] = j; } }
    for (const b of boxes) occ[b] = 0;
    return min;
  };
  const isBox = new Uint8Array(N);
  const frozen = t => {
    for (const o of [0, -1, -w, -w - 1]) { const a = t + o, cs = [a, a + 1, a + w, a + w + 1];
      let full = true, off = false;
      for (const c of cs) { if (!(wall[c] || isBox[c])) { full = false; break; } if (isBox[c] && !goal[c]) off = true; }
      if (full && off) return true; }
    return false;
  };
  const start = g.boxes.map(b => b.y * w + b.x).sort((a, b) => a - b);
  const p0 = g.player.y * w + g.player.x;
  const nodes = [];   // {boxes, p(押したあと立つ位置), parent, push:{from,dir}}
  const seen = new Map();
  const heap = [];
  const hp = (f, id) => { heap.push([f, id]); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const hpop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  // おきばごとの「おして運べる きょり」。見こみは にもつ と おきば を 近い組から くっつける（貪欲な組み合わせ）
  const goalsL = []; for (let i = 0; i < N; i++) if (goal[i]) goalsL.push(i);
  const gd = goalsL.map(gi => { const a = new Uint16Array(N).fill(9999); a[gi] = 0; const q = [gi];
    for (let qi = 0; qi < q.length; qi++) { const i = q[qi];
      for (const d of D) { const b = i + d, s = i + 2 * d;
        if (b < 0 || b >= N || s < 0 || s >= N || wall[b] || wall[s] || a[b] !== 9999) continue;
        a[b] = a[i] + 1; q.push(b); } }
    return a; });
  const W = +(process.env.W || 4);
  const h = bs => {
    const pairs = [];
    for (let i = 0; i < bs.length; i++) for (let j = 0; j < goalsL.length; j++) pairs.push(gd[j][bs[i]] * 65536 + i * 256 + j);
    pairs.sort((x, y) => x - y);
    const ub = new Uint8Array(bs.length), ug = new Uint8Array(goalsL.length); let s = 0, n = 0;
    for (const v of pairs) { const i = (v >> 8) & 255, j = v & 255, dd = Math.floor(v / 65536);
      if (ub[i] || ug[j]) continue; ub[i] = 1; ug[j] = 1; s += dd; if (++n === bs.length) break; }
    return s;
  };
  nodes.push({ boxes: start, p: p0, parent: -1, g: 0 });
  seen.set(reach(p0, start) + ':' + start.join(','), 0);
  hp(h(start), 0);
  const t0 = Date.now(); let n = 0;
  while (heap.length) {
    if (++n > LIMIT || (n % 5000 === 0 && Date.now() - t0 > TIME)) return { fail: true, n };
    const [, id] = hpop(); const cur = nodes[id];
    reach(cur.p, cur.boxes); const myStamp = stamp;
    const reachable = new Uint8Array(N); for (let i = 0; i < N; i++) if (mark[i] === myStamp) reachable[i] = 1;
    for (const b of cur.boxes) isBox[b] = 1;
    for (let bi = 0; bi < cur.boxes.length; bi++) {
      const b = cur.boxes[bi];
      for (let k = 0; k < 4; k++) {
        const s = b - D[k], t = b + D[k];
        if (s < 0 || t < 0 || s >= N || t >= N || !reachable[s] || wall[t] || isBox[t] || dead[t]) continue;
        isBox[b] = 0; isBox[t] = 1;
        const fr = frozen(t);
        isBox[t] = 0; isBox[b] = 1;
        if (fr) continue;
        const nb = cur.boxes.slice(); nb[bi] = t; nb.sort((a, c) => a - c);
        const key = reach(b, nb) + ':' + nb.join(',');
        if (seen.has(key)) continue;
        const nid = nodes.length;
        nodes.push({ boxes: nb, p: b, parent: id, push: { from: b, dir: k }, g: cur.g + 1 });
        seen.set(key, nid);
        const hh = h(nb);
        if (hh === 0) { for (const x of cur.boxes) isBox[x] = 0; return { id: nid, nodes, n }; }
        hp(cur.g + 1 + W * hh, nid);
      }
    }
    for (const b of cur.boxes) isBox[b] = 0;
  }
  return { fail: true, n };
}

function walk(game, tx, ty) {
  // にもつを よけて (tx,ty) まで歩く道
  const w = game.w, prev = new Map(), q = [[game.player.x, game.player.y]];
  prev.set(game.player.y * w + game.player.x, null);
  while (q.length) { const [x, y] = q.shift(); if (x === tx && y === ty) break;
    for (const k of 'UDLR') { const d = OKZ.DIRS[k], nx = x + d.dx, ny = y + d.dy;
      if (game.isWall(nx, ny) || game.boxAt(nx, ny) >= 0 || prev.has(ny * w + nx)) continue;
      prev.set(ny * w + nx, [x, y, k]); q.push([nx, ny]); } }
  if (!prev.has(ty * w + tx)) return null;
  let s = '', cur = [tx, ty];
  for (;;) { const p = prev.get(cur[1] * w + cur[0]); if (!p) break; s = p[2] + s; cur = [p[0], p[1]]; }
  return s;
}

const result = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
if (!writeOnly) OK_LEVELS.forEach((L, i) => {
  if (only && !only.includes(i + 1)) return;
  const rows = L.rows.join('\n');
  if (result[i] && result[i].h === okHash(rows)) return;      // もう答えがある
  const g = new OKZ.Game(rows);
  const t0 = Date.now();
  const res = solve(g);
  if (res.fail) { console.log(`${i + 1}: 見つからず（${res.n}）${Date.now() - t0}ms`); return; }
  const pushes = []; let id = res.id;
  while (res.nodes[id].parent >= 0) { pushes.push(res.nodes[id].push); id = res.nodes[id].parent; }
  pushes.reverse();
  const game = new OKZ.Game(rows); let sol = '', bad = false;
  for (const pu of pushes) {
    const d = OKZ.DIRS['UDLR'[pu.dir]], bx = pu.from % game.w, by = (pu.from / game.w) | 0;
    const wk = walk(game, bx - d.dx, by - d.dy);
    if (wk === null) { bad = true; break; }
    for (const c of wk) game.move(c);
    const r = game.move('UDLR'[pu.dir]);
    if (!r || !r.pushed) { bad = true; break; }
    sol += wk + 'UDLR'[pu.dir];
  }
  if (bad || !game.isClear()) { console.log(`${i + 1}: 再生できず`); return; }
  result[i] = { h: okHash(rows), s: sol, pushes: pushes.length, par: L.par };
  console.log(`${i + 1}: OK おした${pushes.length}（さいたん${L.par}）あるいた${sol.length} ${Date.now() - t0}ms`);
  fs.writeFileSync(CACHE, JSON.stringify(result));
});

// js/hints.js を書く（再生して クリアになるものだけ）
const outObj = {};
let n = 0;
OK_LEVELS.forEach((L, i) => {
  const r = result[i];
  if (!r) return;
  const rows = L.rows.join('\n');
  if (r.h !== okHash(rows)) return;
  const g = new OKZ.Game(rows);
  for (const c of r.s) if (!g.move(c)) break;
  if (!g.isClear()) { console.log(`${i + 1}: 再生でクリアにならない＝のせない`); return; }
  outObj[i] = { h: r.h, s: r.s };
  n++;
});
const js = `// ============================================================
// hints.js — 🔍 ヒント用の答えの手順（tools/make_hints.js が作る。手で直さない）
//   面の番号（0から）→ { h: 面のハッシュ, s: 手順（UDLR） }。
//   答えがあるのは ${n} / ${OK_LEVELS.length} 面。無い面は「まだ ヒントが 用意できてへん」と出る。
// ============================================================
'use strict';
const OK_HINTS = ${JSON.stringify(outObj)};
`;
fs.writeFileSync(OUT, js);
console.log(`書いた: ${path.normalize(OUT)}（${n} / ${OK_LEVELS.length} 面）`);
