// ============================================================
// core.js — ゲームロジック（描画を一切知らない）
//   SRS回転＋壁蹴り / 7種袋 / ホールド / ロックディレイ / T-Spin判定
//   スコアはガイドライン準拠（B2B・コンボ・パーフェクトクリア）
// ============================================================
'use strict';

// 形は各回転状態を「セル座標の配列」で持つ（SRSの基準枠に合わせた並び）
const PIECES = {
  I: { color: '#22d3ee', glow: '#a5f6ff', cells: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ], size: 4 },
  O: { color: '#facc15', glow: '#fff3a8', cells: [
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
  ], size: 4 },
  T: { color: '#c084fc', glow: '#efd6ff', cells: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]],
  ], size: 3 },
  S: { color: '#34d399', glow: '#c2ffe8', cells: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]],
  ], size: 3 },
  Z: { color: '#fb7185', glow: '#ffd0d8', cells: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,0],[0,1],[1,1],[0,2]],
  ], size: 3 },
  J: { color: '#60a5fa', glow: '#cfe4ff', cells: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]],
  ], size: 3 },
  L: { color: '#fb923c', glow: '#ffdcb8', cells: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]],
  ], size: 3 },
};
const PIECE_KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// SRS 壁蹴り（yは「上が＋」の表記。盤面の行に直すとき符号を反転する）
const KICKS_JLSTZ = {
  '0>1': [[0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
  '1>0': [[0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
  '1>2': [[0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
  '2>1': [[0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
  '2>3': [[0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
  '3>2': [[0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
  '3>0': [[0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
  '0>3': [[0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
};
const KICKS_I = {
  '0>1': [[0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2]],
  '1>0': [[0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2]],
  '1>2': [[0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1]],
  '2>1': [[0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1]],
  '2>3': [[0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2]],
  '3>2': [[0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2]],
  '3>0': [[0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1]],
  '0>3': [[0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1]],
};

const DIFFICULTY = {
  easy:   { gravityMul: 1.5, minDrop: 0.30, lockDelay: 0.62, das: 0.16, arr: 0.045, levelLines: 12 },
  normal: { gravityMul: 1.0, minDrop: 0.10, lockDelay: 0.50, das: 0.13, arr: 0.033, levelLines: 10 },
  hard:   { gravityMul: 0.6, minDrop: 0.05, lockDelay: 0.42, das: 0.10, arr: 0.022, levelLines: 10 },
};

class TetrisCore {
  constructor(hooks = {}, diff = 'normal') {
    this.hooks = hooks;
    this.cfg = DIFFICULTY[diff] || DIFFICULTY.normal;
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(null));
    this.bag = [];
    this.queue = [];
    for (let i = 0; i < 5; i++) this.queue.push(this.pull());
    this.hold = null;
    this.holdUsed = false;
    this.score = 0; this.lines = 0; this.level = 1; this.combo = -1;
    this.b2b = false;
    this.over = false;
    this.piecesPlaced = 0;
    this.slowLeft = 0;   // 🐢の残り秒（ポーズ中は減らない）
    this.lockTimer = 0; this.lockResets = 0; this.grounded = false;
    this.dropAcc = 0;
    this.lastKick = 0;
    this.lastActionRotate = false;
    this.cur = null;
    this.spawn();
  }

  pull() {
    if (!this.bag.length) {
      this.bag = PIECE_KEYS.slice();
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  gravity() { // 1セル落ちるのにかかる秒
    const l = this.level;
    let s = Math.pow(0.80 - (l - 1) * 0.007, l - 1);
    s *= this.cfg.gravityMul;
    s = Math.max(this.cfg.minDrop, s);
    if (this.slowLeft > 0) s *= 3;   // 🐢アイテム
    return s;
  }

  spawn(type) {
    const t = type || this.queue.shift();
    if (!type) this.queue.push(this.pull());
    const p = PIECES[t];
    this.cur = {
      type: t, rot: 0,
      x: 3,                        // 標準スポーン位置
      y: 0,
      spawnAt: performance.now(),
    };
    this.lockTimer = 0; this.lockResets = 0; this.grounded = false;
    this.lowest = -99;
    this.dropAcc = 0;
    this.lastActionRotate = false;
    if (this.collide(this.cur.x, this.cur.y, this.cur.rot)) {
      // 1マス上に逃がしてもダメならゲームオーバー
      if (this.collide(this.cur.x, this.cur.y - 1, this.cur.rot)) {
        this.over = true;
        this.hooks.onGameOver && this.hooks.onGameOver();
        return;
      }
      this.cur.y -= 1;
    }
    this.hooks.onSpawn && this.hooks.onSpawn(this.cur);
  }

  cellsOf(type, rot, x, y) {
    const c = PIECES[type].cells[rot & 3];
    const out = [];
    for (const [cx, cy] of c) out.push([x + cx, y + cy]);
    return out;
  }

  curCells(dx = 0, dy = 0, rot = this.cur.rot) {
    return this.cellsOf(this.cur.type, rot, this.cur.x + dx, this.cur.y + dy);
  }

  collide(x, y, rot) {
    for (const [cx, cy] of this.cellsOf(this.cur.type, rot, x, y)) {
      if (cx < 0 || cx >= BOARD_W || cy >= BOARD_H) return true;
      if (cy >= 0 && this.board[cy][cx]) return true;
    }
    return false;
  }

  move(dx) {
    if (this.over || !this.cur) return false;
    if (this.collide(this.cur.x + dx, this.cur.y, this.cur.rot)) return false;
    this.cur.x += dx;
    this.lastActionRotate = false;
    this.touchLock();
    this.hooks.onMove && this.hooks.onMove(dx);
    return true;
  }

  rotate(dir) { // dir: +1 右回り / -1 左回り
    if (this.over || !this.cur) return false;
    const from = this.cur.rot & 3;
    const to = (from + (dir > 0 ? 1 : 3)) & 3;
    const table = this.cur.type === 'I' ? KICKS_I : KICKS_JLSTZ;
    const kicks = this.cur.type === 'O' ? [[0, 0]] : (table[`${from}>${to}`] || [[0, 0]]);
    for (let i = 0; i < kicks.length; i++) {
      const dx = kicks[i][0], dy = -kicks[i][1];   // 表記のyを行方向へ
      if (!this.collide(this.cur.x + dx, this.cur.y + dy, to)) {
        this.cur.x += dx; this.cur.y += dy; this.cur.rot = to;
        this.lastKick = i;
        this.lastActionRotate = true;
        this.touchLock();
        this.hooks.onRotate && this.hooks.onRotate(dir, i);
        return true;
      }
    }
    this.hooks.onRotateFail && this.hooks.onRotateFail();
    return false;
  }

  touchLock() {
    // 接地中に動かしたらロック猶予をリセット（回数制限つき）
    if (this.grounded && this.lockResets < 15) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  }

  softDrop() {
    if (this.over || !this.cur) return false;
    if (this.collide(this.cur.x, this.cur.y + 1, this.cur.rot)) return false;
    this.cur.y++;
    this.score += 1;
    this.lastActionRotate = false;
    this.dropAcc = 0;
    return true;
  }

  ghostY() {
    let y = this.cur.y;
    while (!this.collide(this.cur.x, y + 1, this.cur.rot)) y++;
    return y;
  }

  hardDrop() {
    if (this.over || !this.cur) return;
    const from = this.cur.y;
    const to = this.ghostY();
    this.score += (to - from) * 2;
    this.cur.y = to;
    this.hooks.onHardDrop && this.hooks.onHardDrop(from, to);
    this.lock(true);
  }

  holdPiece() {
    if (this.over || !this.cur || this.holdUsed) return false;
    const cur = this.cur.type;
    if (this.hold) {
      const h = this.hold;
      this.hold = cur;
      this.spawn(h);
    } else {
      this.hold = cur;
      this.spawn();
    }
    this.holdUsed = true;
    this.hooks.onHold && this.hooks.onHold();
    return true;
  }

  // ---- T-Spin判定（3コーナー則） ----
  checkTSpin() {
    if (this.cur.type !== 'T' || !this.lastActionRotate) return null;
    const cx = this.cur.x + 1, cy = this.cur.y + 1;   // Tの中心
    const at = (x, y) => (x < 0 || x >= BOARD_W || y >= BOARD_H) ? true : (y < 0 ? false : !!this.board[y][x]);
    const corners = [[cx-1, cy-1], [cx+1, cy-1], [cx+1, cy+1], [cx-1, cy+1]];
    const filled = corners.map(c => at(c[0], c[1]));
    const total = filled.filter(Boolean).length;
    if (total < 3) return null;
    // 回転状態ごとの「前2つ」のコーナー
    const frontIdx = [[0, 1], [1, 2], [2, 3], [3, 0]][this.cur.rot & 3];
    const front = filled[frontIdx[0]] && filled[frontIdx[1]];
    if (front || this.lastKick === 4) return 'full';
    return 'mini';
  }

  lock(hard) {
    const tspin = this.checkTSpin();
    const placed = [];
    for (const [cx, cy] of this.curCells()) {
      if (cy < 0) continue;
      this.board[cy][cx] = this.cur.type;
      placed.push([cx, cy]);
    }
    // 盤外で固定＝天井オーバー
    if (placed.length < 4) {
      this.over = true;
      this.hooks.onLock && this.hooks.onLock(placed, hard);
      this.hooks.onGameOver && this.hooks.onGameOver();
      return;
    }
    this.piecesPlaced++;
    this.hooks.onLock && this.hooks.onLock(placed, hard);

    // ---- ライン判定 ----
    const full = [];
    for (let r = 0; r < BOARD_H; r++) if (this.board[r].every(v => v)) full.push(r);

    let gain = 0, label = '', b2bUsed = false;
    const n = full.length;
    if (tspin) {
      const base = tspin === 'full'
        ? [400, 800, 1200, 1600][n] || 400
        : [100, 200, 400, 400][n] || 100;
      gain = base;
      label = (tspin === 'mini' ? 'T-SPIN MINI' : 'T-SPIN') +
              ['', ' SINGLE', ' DOUBLE', ' TRIPLE'][n];
      if (n > 0) { if (this.b2b) { gain = Math.floor(gain * 1.5); b2bUsed = true; } this.b2b = true; }
    } else if (n > 0) {
      gain = [0, 100, 300, 500, 800][n];
      label = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'][n];
      if (n === 4) {
        if (this.b2b) { gain = Math.floor(gain * 1.5); b2bUsed = true; }
        this.b2b = true;
      } else {
        this.b2b = false;
      }
    }

    if (n > 0) {
      this.combo++;
      if (this.combo > 0) gain += 50 * this.combo;
    } else {
      this.combo = -1;
    }

    // ---- 消去 ----
    let perfect = false;
    if (n) {
      for (const r of full) { this.board.splice(r, 1); this.board.unshift(Array(BOARD_W).fill(null)); }
      perfect = this.board.every(row => row.every(v => !v));
      if (perfect) gain += [0, 800, 1200, 1800, 2000][n];
      this.lines += n;
      const newLevel = Math.floor(this.lines / this.cfg.levelLines) + 1;
      if (newLevel > this.level) {
        this.level = newLevel;
        this.hooks.onLevelUp && this.hooks.onLevelUp(this.level);
      }
    }
    this.score += gain * this.level;

    this.hooks.onResolve && this.hooks.onResolve({
      rows: full, n, tspin, label, gain: gain * this.level,
      combo: this.combo, b2b: b2bUsed, perfect,
    });

    this.holdUsed = false;
    if (!this.over) this.spawn();
  }

  // ---- 毎フレームの重力とロック ----
  step(dt, softHeld) {
    if (this.over || !this.cur) return;
    if (this.slowLeft > 0) this.slowLeft = Math.max(0, this.slowLeft - dt);
    const g = softHeld ? Math.min(this.gravity(), 0.035) : this.gravity();
    this.dropAcc += dt;
    while (this.dropAcc >= g) {
      this.dropAcc -= g;
      if (!this.collide(this.cur.x, this.cur.y + 1, this.cur.rot)) {
        this.cur.y++;
        this.lastActionRotate = false;
        if (softHeld) this.score += 1;
      } else break;
    }
    // より下まで落ちたら猶予の回数をリセット（正当な進行）
    if (this.cur.y > this.lowest) { this.lowest = this.cur.y; this.lockResets = 0; }

    const onGround = this.collide(this.cur.x, this.cur.y + 1, this.cur.rot);
    if (onGround) {
      if (!this.grounded) {
        this.grounded = true;
        if (this.lockResets < 15) this.lockTimer = 0;   // 上限を超えたら猶予は戻さない
      }
      this.lockTimer += dt;
      if (this.lockTimer >= this.cfg.lockDelay) this.lock(false);
    } else {
      // 壁蹴りで持ち上がった等で接地が外れたとき。
      // 上限内なら猶予を戻すが、超えていたら戻さない（回転連打で永久に固定されない対策）
      if (this.grounded) {
        this.grounded = false;
        if (this.lockResets < 15) { this.lockResets++; this.lockTimer = 0; }
      }
    }
  }

  // 一番高いブロックの行（危険度の判定用）
  highest() {
    for (let r = 0; r < BOARD_H; r++) if (this.board[r].some(v => v)) return r;
    return BOARD_H;
  }
}
