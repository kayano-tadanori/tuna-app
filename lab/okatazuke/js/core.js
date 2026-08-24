// ============================================================
// core.js — ゲームのルール（絵とは切りはなす）
//
// ★ルールは NotebookLM の資料から起こした仕様どおり：
//   ・動けるのは 上下左右の4方向だけ。ななめ移動なし
//   ・にもつは「おす」だけ。引けない
//   ・おした先が かべ／別のにもつ なら 動けない（2個まとめ押しもできない）
//   ・おきば ぜんぶに にもつが乗ったら クリア（自動判定）
//   ・もどす（1手ずつ）と やりなおし（最初から）は かならず用意する
//   ・手数は「歩数(moves)」と「おした数(pushes)」の2本立て
// ============================================================
'use strict';

const OKZ = {};

OKZ.DIRS = {
  U: { dx: 0, dy: -1 },
  D: { dx: 0, dy: 1 },
  L: { dx: -1, dy: 0 },
  R: { dx: 1, dy: 0 },
};

// ---- 盤面テキストを読む ----------------------------------------------
//   #かべ / 空白ゆか / $にもつ / .おきば / *おきばの上のにもつ / @オカン / +おきばの上のオカン
OKZ.parse = function (text) {
  const rows = text.replace(/\r/g, '').split('\n');
  while (rows.length && rows[0].trim() === '') rows.shift();
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const wall = [], goal = [];
  const boxes = [];
  let player = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y][x] || ' ';
      const i = y * w + x;
      wall[i] = (c === '#');
      goal[i] = (c === '.' || c === '*' || c === '+');
      if (c === '$' || c === '*') boxes.push({ x, y });
      if (c === '@' || c === '+') player = { x, y };
    }
  }
  return { w, h, wall, goal, boxes, player };
};

// ---- ゲームの状態 ------------------------------------------------------
OKZ.Game = class {
  constructor(text) {
    this.def = OKZ.parse(text);
    this.reset();
    this.dead = this._deadSquares();
  }

  reset() {
    const d = this.def;
    this.w = d.w; this.h = d.h;
    this.wall = d.wall; this.goal = d.goal;
    this.boxes = d.boxes.map(b => ({ x: b.x, y: b.y }));
    this.player = { x: d.player.x, y: d.player.y };
    this.face = 'D';
    this.moves = 0;
    this.pushes = 0;
    this.history = [];
  }

  idx(x, y) { return y * this.w + x; }
  isWall(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    return !!this.wall[this.idx(x, y)];
  }
  isGoal(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return !!this.goal[this.idx(x, y)];
  }
  boxAt(x, y) {
    for (let i = 0; i < this.boxes.length; i++) {
      if (this.boxes[i].x === x && this.boxes[i].y === y) return i;
    }
    return -1;
  }

  // ---- 1手 動く ------------------------------------------------------
  // 返り値 null=動けない / {pushed, boxIndex, from, to, ...}
  move(dirKey) {
    const d = OKZ.DIRS[dirKey];
    if (!d) return null;
    const px = this.player.x, py = this.player.y;
    const nx = px + d.dx, ny = py + d.dy;
    this.face = dirKey;                       // 動けなくても向きだけは変える
    if (this.isWall(nx, ny)) return null;
    const bi = this.boxAt(nx, ny);
    if (bi >= 0) {
      const bx = nx + d.dx, by = ny + d.dy;
      // おした先が かべ か 別のにもつ なら 動けない（2個まとめ押しの禁止）
      if (this.isWall(bx, by) || this.boxAt(bx, by) >= 0) return null;
      const wasOn = this.isGoal(nx, ny);
      const nowOn = this.isGoal(bx, by);
      this.history.push({ dir: dirKey, box: bi, from: { x: nx, y: ny } });
      this.boxes[bi].x = bx; this.boxes[bi].y = by;
      this.player.x = nx; this.player.y = ny;
      this.moves++; this.pushes++;
      return {
        pushed: true, boxIndex: bi, dir: dirKey,
        from: { x: nx, y: ny }, to: { x: bx, y: by },
        wasOnGoal: wasOn, onGoal: nowOn,
        cleared: this.isClear(),
      };
    }
    this.history.push({ dir: dirKey, box: -1 });
    this.player.x = nx; this.player.y = ny;
    this.moves++;
    return { pushed: false, dir: dirKey, cleared: this.isClear() };
  }

  // ---- 1手 もどす ----------------------------------------------------
  undo() {
    const h = this.history.pop();
    if (!h) return null;
    const d = OKZ.DIRS[h.dir];
    const px = this.player.x, py = this.player.y;
    this.player.x = px - d.dx; this.player.y = py - d.dy;
    this.moves--;
    let box = null;
    if (h.box >= 0) {
      const b = this.boxes[h.box];
      box = { index: h.box, from: { x: b.x, y: b.y }, to: { x: h.from.x, y: h.from.y } };
      b.x = h.from.x; b.y = h.from.y;
      this.pushes--;
    }
    this.face = h.dir;
    return { dir: h.dir, box, player: { x: this.player.x, y: this.player.y } };
  }

  isClear() {
    for (const b of this.boxes) if (!this.isGoal(b.x, b.y)) return false;
    return true;
  }

  // ---- 詰み（デッドロック）の判定 -------------------------------------
  // 資料の「詰みの4大パターン」のうち、機械で確実に言えるものだけを見る。
  //   ① もう どこへも押し出せないマス（角など）に入った
  //   ② にもつ・かべが 2x2 に固まった
  // ★あいまいなものは「詰み」と言わない。まちがって言うと子どもが混乱する。
  _deadSquares() {
    // おきばから逆向きに「引ける」場所を全部たどる。たどり着けない床が死にマス。
    const w = this.w, h = this.h;
    const alive = new Uint8Array(w * h);
    const q = [];
    for (let i = 0; i < w * h; i++) if (this.goal[i]) { alive[i] = 1; q.push(i); }
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    while (q.length) {
      const i = q.pop();
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of dirs) {
        const bx = x + dx, by = y + dy;          // にもつを引いた先
        const sx = x + dx * 2, sy = y + dy * 2;  // そのときオカンが立つ場所
        if (this.isWall(bx, by) || this.isWall(sx, sy)) continue;
        const bi = this.idx(bx, by);
        if (alive[bi]) continue;
        alive[bi] = 1; q.push(bi);
      }
    }
    const dead = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) dead[i] = (!this.wall[i] && !alive[i]) ? 1 : 0;
    return dead;
  }

  // いま詰んでいるか。詰んでいたら「原因になっている にもつ」の番号を返す
  deadlockedBoxes() {
    const out = [];
    const occupied = (x, y) => this.isWall(x, y) || this.boxAt(x, y) >= 0;
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (this.isGoal(b.x, b.y)) continue;
      if (this.dead[this.idx(b.x, b.y)]) { out.push(i); continue; }
      // 2x2 のかたまり
      let stuck = false;
      for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const cs = [[b.x + ox, b.y + oy], [b.x + ox + 1, b.y + oy],
                    [b.x + ox, b.y + oy + 1], [b.x + ox + 1, b.y + oy + 1]];
        if (cs.every(c => occupied(c[0], c[1]))) {
          // 4マス全部が おきばの上の にもつ なら、それはクリアの形なので詰みではない
          const anyOff = cs.some(c => this.boxAt(c[0], c[1]) >= 0 && !this.isGoal(c[0], c[1]));
          if (anyOff) { stuck = true; break; }
        }
      }
      if (stuck) out.push(i);
    }
    return out;
  }

  // ゆか（オカンが行けるところ）＝盤の外の余白を描かないために使う
  floorCells() {
    const seen = new Uint8Array(this.w * this.h);
    const st = [this.def.player];
    const out = [];
    seen[this.idx(this.def.player.x, this.def.player.y)] = 1;
    while (st.length) {
      const p = st.pop();
      out.push(p);
      for (const k in OKZ.DIRS) {
        const d = OKZ.DIRS[k];
        const x = p.x + d.dx, y = p.y + d.dy;
        if (this.isWall(x, y)) continue;
        const i = this.idx(x, y);
        if (seen[i]) continue;
        seen[i] = 1; st.push({ x, y });
      }
    }
    return out;
  }

  // かべのうち「ゆかに接しているもの」だけ。外がわの余分なかべは描かない
  wallCells() {
    const floor = this.floorCells();
    const near = new Set();
    for (const p of floor) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = p.x + dx, y = p.y + dy;
          if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
          if (this.wall[this.idx(x, y)]) near.add(y * this.w + x);
        }
      }
    }
    return [...near].map(i => ({ x: i % this.w, y: (i / this.w) | 0 }));
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = OKZ;
