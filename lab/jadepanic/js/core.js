// ============================================================
// core.js — ゲームのしくみ（描画を知らない層）
//   フィールド・ジェイド・弾・バグ（敵）・ビット・スコア・湧き方
//   演出に必要なことは events に積んで game.js に渡す。
// ============================================================
'use strict';

// ---------------- 敵（バグ）の図鑑 ----------------
// col は #rrggbb、pts は 1体あたりのスコア、bits は落とすビットの数
const BUG = {
  noise:   { name: 'ノイズ',     col: '#b06cff', r: 23, pts: 10,  bits: 1, hp: 1,
             desc: 'ふらふら さまよう。ぶつかると あぶない' },
  chaser:  { name: 'チェイサー', col: '#3ad8ff', r: 21, pts: 15,  bits: 1, hp: 1,
             desc: 'まっすぐ おいかけてくる。はやい' },
  spinner: { name: 'スピナー',   col: '#ff5ce0', r: 24, pts: 20,  bits: 2, hp: 1,
             desc: 'かべで はねまわる。こっちを 見ていない' },
  dodger:  { name: 'ドッジャー', col: '#c6ff3d', r: 23, pts: 30,  bits: 2, hp: 1,
             desc: '弾を よけて 横に にげる' },
  worm:    { name: 'ワーム',     col: '#4f7bff', r: 21, pts: 120, bits: 8, hp: 4,
             desc: 'あたま だけが 弱点。しっぽは こわせない' },
  hole:    { name: 'バグホール', col: '#ff4d6d', r: 34, pts: 200, bits: 14, hp: 12,
             desc: 'なんでも すいこむ。こわすと ビットが どっさり' },
  split:   { name: 'ぶんれつバグ', col: '#ff9d2e', r: 31, pts: 25, bits: 1, hp: 1,
             desc: 'こわすと 2つに わかれる。3だんかい' },
};
for (const k in BUG) BUG[k].rgb = hex2rgb(BUG[k].col);

const JADE_COL = { body: hex2rgb('#ffd23b'), head: hex2rgb('#ff9d2e'), wing: hex2rgb('#5cb03a') };
const BIT_COL = hex2rgb('#63ffb0');

// ---------------- 難易度 ----------------
// 湧きの勢い（rate）は 実測で決めた。ここが低いと画面がスカスカで、
// 上手い人がまったく死なない＝ハラハラしないゲームになる（2026-08-19 計測）
const DIFF = {
  easy:   { label: 'やさしい', lives: 5, bombs: 3, maxEnemies: 50, rate0: 1.45, rateK: 0.020, accel: 0.30, rateMax: 8.0,
            unlockScale: 1.5, speed: 0.82, fireRate: 0.070, multKeep: 1.0, magnet: 140 },
  normal: { label: 'ふつう',   lives: 3, bombs: 3, maxEnemies: 105, rate0: 2.20, rateK: 0.030, accel: 0.75, rateMax: 18.0,
            unlockScale: 1.0, speed: 1.00, fireRate: 0.080, multKeep: 1.0, magnet: 95 },
  hard:   { label: 'むずかしい', lives: 3, bombs: 2, maxEnemies: 150, rate0: 3.00, rateK: 0.045, accel: 1.30, rateMax: 26.0,
            unlockScale: 0.70, speed: 1.16, fireRate: 0.085, multKeep: 1.0, magnet: 55 },
};
const LIVES_MAX = 5;   // ふえすぎると 緊張感がなくなる

// 敵が出てくる時刻（秒・ふつう基準）と、出そろうまでの時間
const UNLOCK = [
  { type: 'noise',   at: 0,   ramp: 10, w: 1.00 },
  { type: 'chaser',  at: 10,  ramp: 20, w: 0.85 },
  { type: 'spinner', at: 26,  ramp: 24, w: 0.55 },
  { type: 'dodger',  at: 42,  ramp: 24, w: 0.50 },
  { type: 'worm',    at: 60,  ramp: 30, w: 0.22 },
  { type: 'hole',    at: 80,  ramp: 40, w: 0.10 },
  { type: 'split',   at: 96,  ramp: 30, w: 0.35 },
];

const MULT_MAX = 9999;      // 実質 上限なし（本家GW2にならう）
const FIELD_H = 900;

// ============================================================
const G = {
  // --- 場 ---
  W: 1600, H: FIELD_H,
  mode: 'survival',        // survival | timeattack
  diff: 'normal',
  D: DIFF.normal,

  // --- 状態 ---
  phase: 'idle',           // idle | play | dead | over
  time: 0,                 // ゲーム内経過（スローの影響を受ける）
  wall: 0,                 // 演出用の実時間
  timeLeft: 0,             // 60びょうモード
  score: 0, best: 0,
  mult: 1, bitCount: 0,
  lives: 3, bombs: 3,
  nextLifeAt: 50000, nextBombAt: 75000,
  killTotal: 0, bitTotal: 0, maxMult: 1,
  deadTimer: 0, invul: 0,
  unlocked: {},            // type -> true
  spawnAcc: 0,
  opening: false,          // 最初の群れを出したか
  slow: 1,                 // スローの倍率（1が等速）
  slowTimer: 0,

  // --- もの ---
  p: { x: 0, y: 0, vx: 0, vy: 0, r: 9, aim: 0, face: 0, fireCd: 0, flap: 0, alive: true, thrust: 0 },
  bullets: [], enemies: [], bits: [], spawns: [],
  events: [],

  // ============================================================
  reset(mode, diff, W, H) {
    this.mode = mode;
    this.diff = diff;
    this.D = DIFF[diff] || DIFF.normal;
    this.W = W; this.H = H;
    this.phase = 'play';
    this.time = 0; this.wall = 0;
    this.timeLeft = 60;
    this.score = 0;
    this.mult = 1; this.bitCount = 0;
    this.lives = mode === 'timeattack' ? 99 : this.D.lives;
    this.bombs = this.D.bombs;
    this.nextLifeAt = this.diff === 'easy' ? 50000 : 100000;
    this.nextBombAt = this.nextLifeAt * 3;
    this.killTotal = 0; this.bitTotal = 0; this.maxMult = 1;
    this.deadTimer = 0; this.invul = 2.0;
    this.unlocked = {};
    this.spawnAcc = 0;
    this.opening = false;
    this.slow = 1; this.slowTimer = 0;
    this.bullets.length = 0;
    this.enemies.length = 0;
    this.bits.length = 0;
    this.spawns.length = 0;
    this.events.length = 0;
    const p = this.p;
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.aim = 0; p.face = 0;
    p.fireCd = 0; p.flap = 0; p.alive = true; p.thrust = 0;
  },

  ev(t, o) { o = o || {}; o.t = t; this.events.push(o); },

  // ============================================================
  // 1フレーム
  //   input = { mx,my (移動 -1..1), ax,ay (射撃方向 0でなし), fire(bool), autoAim(bool) }
  // ============================================================
  update(dt, input) {
    if (this.phase !== 'play' && this.phase !== 'dead') return;
    this.wall += dt;

    // スロー（ボム・死亡時の演出）
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      this.slow = lerp(this.slow, 0.30, 1 - Math.exp(-10 * dt));
      if (this.slowTimer <= 0) this.slowTimer = 0;
    } else {
      this.slow = lerp(this.slow, 1, 1 - Math.exp(-4 * dt));
    }
    const sdt = dt * this.slow;
    this.time += sdt;

    if (this.mode === 'timeattack' && this.phase === 'play') {
      const before = Math.ceil(this.timeLeft);
      this.timeLeft -= sdt;
      const after = Math.ceil(this.timeLeft);
      if (after !== before && after <= 5 && after >= 0) this.ev('tick', { n: after });
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish(); return; }
    }

    if (this.invul > 0) this.invul -= sdt;

    if (this.phase === 'dead') {
      this.deadTimer -= dt;
      this.updateBullets(sdt);
      this.updateEnemies(sdt);
      this.updateBits(sdt);
      if (this.deadTimer <= 0) this.respawn();
      return;
    }

    this.updatePlayer(sdt, input);
    this.updateBullets(sdt);
    this.updateEnemies(sdt);
    this.updateBits(sdt);
    this.updateSpawning(sdt);
    this.collide();
    this.checkRewards();
  },

  // ---------------- ジェイド ----------------
  updatePlayer(dt, inp) {
    const p = this.p;
    const D = this.D;
    const MAXV = 520 * (this.diff === 'easy' ? 0.92 : 1.0);

    const ml = Math.hypot(inp.mx, inp.my);
    let tx = 0, ty = 0;
    if (ml > 0.08) {
      const s = Math.min(1, ml);
      tx = inp.mx / ml * s * MAXV;
      ty = inp.my / ml * s * MAXV;
      p.thrust = Math.min(1, p.thrust + dt * 6);
    } else {
      p.thrust = Math.max(0, p.thrust - dt * 4);
    }
    // 追従の速さ。9だと258msかかって「もっさり」する（2026-08-19 計測）
    const k = 1 - Math.exp(-14 * dt);
    p.vx = lerp(p.vx, tx, k);
    p.vy = lerp(p.vy, ty, k);
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // かべ（やわらかく はねかえす）
    const hw = this.W / 2 - p.r - 6, hh = this.H / 2 - p.r - 6;
    if (p.x < -hw) { p.x = -hw; p.vx = Math.abs(p.vx) * 0.35; this.ev('wall', { x: p.x, y: p.y }); }
    if (p.x > hw) { p.x = hw; p.vx = -Math.abs(p.vx) * 0.35; this.ev('wall', { x: p.x, y: p.y }); }
    if (p.y < -hh) { p.y = -hh; p.vy = Math.abs(p.vy) * 0.35; this.ev('wall', { x: p.x, y: p.y }); }
    if (p.y > hh) { p.y = hh; p.vy = -Math.abs(p.vy) * 0.35; this.ev('wall', { x: p.x, y: p.y }); }

    // 向き（進んでいる方をむく）
    if (ml > 0.08) p.face += angDiff(Math.atan2(p.vy, p.vx), p.face) * (1 - Math.exp(-12 * dt));
    p.flap += dt * (7 + p.thrust * 10);

    // ねらう方向
    let aiming = false;
    const al = Math.hypot(inp.ax, inp.ay);
    if (al > 0.25) {
      p.aim += angDiff(Math.atan2(inp.ay, inp.ax), p.aim) * (1 - Math.exp(-24 * dt));
      aiming = true;
    } else if (inp.autoAim) {
      const tgt = this.nearestEnemy(p.x, p.y, 1e9);
      if (tgt) {
        // すこし先を読んで撃つ
        const lead = Math.hypot(tgt.x - p.x, tgt.y - p.y) / 1500;
        const a = Math.atan2(tgt.y + tgt.vy * lead - p.y, tgt.x + tgt.vx * lead - p.x);
        p.aim += angDiff(a, p.aim) * (1 - Math.exp(-16 * dt));
        aiming = true;
      } else if (ml > 0.08) {
        p.aim += angDiff(p.face, p.aim) * (1 - Math.exp(-8 * dt));
      }
    }

    // 撃つ
    p.fireCd -= dt;
    const wantFire = aiming && (inp.autoAim ? true : (al > 0.25 || inp.fire));
    if (wantFire && p.fireCd <= 0) {
      p.fireCd = D.fireRate;
      this.fire(p.aim);
    }
  },

  fire(ang) {
    const p = this.p;
    const SPD = 1450;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const cx = Math.cos(ang), cy = Math.sin(ang);
    const spread = [-0.055, 0.0, 0.055];
    const offs = [-7, 0, 7];
    for (let i = 0; i < 3; i++) {
      const a = ang + spread[i] + rnd(-0.012, 0.012);
      const bx = p.x + cx * 16 + nx * offs[i];
      const by = p.y + cy * 16 + ny * offs[i];
      this.bullets.push({
        x: bx, y: by, px: bx, py: by,
        vx: Math.cos(a) * SPD + p.vx * 0.25,
        vy: Math.sin(a) * SPD + p.vy * 0.25,
        life: 1.05, r: 8, ang: a,
      });
    }
    this.ev('shoot', { x: p.x + cx * 18, y: p.y + cy * 18, a: ang });
  },

  updateBullets(dt) {
    const B = this.bullets;
    const hw = this.W / 2, hh = this.H / 2;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      b.px = b.x; b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) { B.splice(i, 1); continue; }
      if (b.x < -hw || b.x > hw || b.y < -hh || b.y > hh) {
        this.ev('spark', { x: clamp(b.x, -hw, hw), y: clamp(b.y, -hh, hh), a: b.ang, col: JADE_COL.body });
        B.splice(i, 1);
      }
    }
  },

  // ---------------- バグ（敵） ----------------
  spawnEnemy(type, x, y, gen) {
    const d = BUG[type];
    const e = {
      type, x, y, vx: 0, vy: 0, r: d.r, hp: d.hp, rot: rnd(0, TAU), spin: 0,
      age: 0, born: 0.35, settled: false, col: d.rgb, gen: gen || 0, seg: null, wob: rnd(0, TAU),
      dash: 0, grow: 0,
    };
    if (type === 'split' && gen > 0) {
      e.r = d.r * (gen === 1 ? 0.62 : 0.38);
      e.hp = 1;
    }
    if (type === 'worm') {
      e.seg = [];
      const n = 16;                 // 本家のヘビは画面を横切るほど長い
      for (let i = 0; i < n; i++) e.seg.push({ x, y });
      e.vx = rnd(-1, 1); e.vy = rnd(-1, 1);
    }
    if (type === 'spinner') {
      const a = rnd(0, TAU), s = rnd(230, 330) * this.D.speed;
      e.vx = Math.cos(a) * s; e.vy = Math.sin(a) * s;
      e.spin = rnd(6, 11);
    }
    if (type === 'noise') {
      const a = rnd(0, TAU), s = rnd(70, 140) * this.D.speed;
      e.vx = Math.cos(a) * s; e.vy = Math.sin(a) * s;
      e.spin = rnd(-2.5, 2.5);
    }
    if (type === 'hole') { e.r = d.r; e.grow = 0; e.spit = 3.5; }
    this.enemies.push(e);
    return e;
  },

  updateEnemies(dt) {
    const E = this.enemies;
    const p = this.p;
    const hw = this.W / 2, hh = this.H / 2;
    const spdK = this.D.speed * (1 + Math.min(0.45, this.time / 320));
    const alive = this.phase === 'play';

    // バグホールの引力（他のものにも効く）
    const holes = [];
    for (let i = 0; i < E.length; i++) if (E[i].type === 'hole' && E[i].age > E[i].born) holes.push(E[i]);

    for (let i = E.length - 1; i >= 0; i--) {
      const e = E[i];
      e.age += dt;
      if (e.age < e.born) {           // 生まれる途中はまだ動かない・当たらない
        e.rot += dt * 6;
        continue;
      }
      // 生まれた瞬間にジェイドと重なっていたら、外へ押し出す。
      // これが無いと「予告リングに入ってしまった＝理不尽な即死」になる
      if (!e.settled) {
        e.settled = true;
        const sdx = e.x - p.x, sdy = e.y - p.y;
        const sd = Math.hypot(sdx, sdy);
        const need = e.r + p.r + 46;
        if (sd < need) {
          const a = sd < 1 ? rnd(0, TAU) : Math.atan2(sdy, sdx);
          e.x = clamp(p.x + Math.cos(a) * need, -hw + e.r, hw - e.r);
          e.y = clamp(p.y + Math.sin(a) * need, -hh + e.r, hh - e.r);
          if (Math.hypot(e.x - p.x, e.y - p.y) < need * 0.85) {
            e.age = e.born - 0.22;    // まだ近い＝もう少し待たせる
            e.settled = false;
            continue;
          }
          this.ev('shove', { x: e.x, y: e.y, col: e.col });
        }
      }
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;

      switch (e.type) {
        case 'noise': {
          // ときどき ふらっと向きを変える
          e.wob += dt;
          if (e.wob > 1.4) {
            e.wob = rnd(-0.4, 0);
            const a = Math.atan2(e.vy, e.vx) + rnd(-1.1, 1.1);
            const s = Math.hypot(e.vx, e.vy);
            e.vx = Math.cos(a) * s; e.vy = Math.sin(a) * s;
          }
          e.rot += e.spin * dt;
          break;
        }
        case 'chaser': {
          const acc = 900 * spdK;
          e.vx += dx / dist * acc * dt;
          e.vy += dy / dist * acc * dt;
          const sp = Math.hypot(e.vx, e.vy), mx = 330 * spdK;
          if (sp > mx) { e.vx *= mx / sp; e.vy *= mx / sp; }
          e.rot = Math.atan2(e.vy, e.vx);
          break;
        }
        case 'spinner': {
          e.rot += e.spin * dt;
          break;
        }
        case 'dodger': {
          // ふだんは ゆっくり寄ってくる
          const acc = 250 * spdK;
          e.vx += dx / dist * acc * dt;
          e.vy += dy / dist * acc * dt;
          // 弾が近いと 横っ飛び
          if (e.dash > 0) e.dash -= dt;
          else {
            const b = this.nearestBullet(e.x, e.y, 165);
            if (b) {
              const bl = Math.hypot(b.vx, b.vy) || 1;
              const side = ((e.x - b.x) * b.vy - (e.y - b.y) * b.vx) > 0 ? 1 : -1;
              const nx = -b.vy / bl * side, ny = b.vx / bl * side;
              e.vx += nx * 620 * spdK;
              e.vy += ny * 620 * spdK;
              e.dash = 0.45;
              this.ev('dodge', { x: e.x, y: e.y, col: e.col });
            }
          }
          const sp = Math.hypot(e.vx, e.vy), mx = (e.dash > 0 ? 640 : 210) * spdK;
          if (sp > mx) { e.vx *= mx / sp; e.vy *= mx / sp; }
          e.rot += dt * 2.2;
          break;
        }
        case 'worm': {
          e.wob += dt * 4.5;
          const a = Math.atan2(dy, dx) + Math.sin(e.wob) * 0.75;
          const s = 205 * spdK;
          e.vx = lerp(e.vx, Math.cos(a) * s, 1 - Math.exp(-4 * dt));
          e.vy = lerp(e.vy, Math.sin(a) * s, 1 - Math.exp(-4 * dt));
          e.rot = Math.atan2(e.vy, e.vx);
          break;
        }
        case 'hole': {
          e.rot += dt * (0.8 + e.grow * 0.25);
          e.spit -= dt;
          // 育つほど 引力が強くなる
          e.r = BUG.hole.r + e.grow * 1.9;
          if (e.spit <= 0 && e.grow > 3) {
            e.spit = 4.5;
            const a = rnd(0, TAU);
            const ne = this.spawnEnemy('chaser', e.x + Math.cos(a) * (e.r + 24), e.y + Math.sin(a) * (e.r + 24));
            ne.born = 0.12;
            ne.vx = Math.cos(a) * 260; ne.vy = Math.sin(a) * 260;
            this.ev('spit', { x: e.x, y: e.y });
          }
          break;
        }
        case 'split': {
          const acc = (e.gen === 0 ? 190 : e.gen === 1 ? 260 : 330) * spdK;
          e.vx += dx / dist * acc * dt;
          e.vy += dy / dist * acc * dt;
          const sp = Math.hypot(e.vx, e.vy), mx = (e.gen === 0 ? 160 : e.gen === 1 ? 230 : 300) * spdK;
          if (sp > mx) { e.vx *= mx / sp; e.vy *= mx / sp; }
          e.rot += dt * (1.5 + e.gen);
          break;
        }
      }

      // バグホールに 引かれる
      for (let h = 0; h < holes.length; h++) {
        const H2 = holes[h];
        if (H2 === e) continue;
        const ddx = H2.x - e.x, ddy = H2.y - e.y;
        const dd = Math.hypot(ddx, ddy) || 1;
        if (dd < 460) {
          const f = (1 - dd / 460) * 420 * dt;
          e.vx += ddx / dd * f;
          e.vy += ddy / dd * f;
          if (dd < H2.r + e.r * 0.6) {  // のみこまれる
            H2.grow += 0.6;
            this.ev('absorb', { x: e.x, y: e.y, col: e.col });
            E.splice(i, 1);
            break;
          }
        }
      }
      if (E[i] !== e) continue;

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // しっぽ（ワーム）
      if (e.seg) {
        let px = e.x, py = e.y;
        for (let s = 0; s < e.seg.length; s++) {
          const sg = e.seg[s];
          const sdx = px - sg.x, sdy = py - sg.y;
          const sd = Math.hypot(sdx, sdy) || 1;
          const want = e.r * 1.55;
          if (sd > want) {
            sg.x += sdx / sd * (sd - want);
            sg.y += sdy / sd * (sd - want);
          }
          px = sg.x; py = sg.y;
        }
      }

      // かべ
      const m = e.r;
      if (e.x < -hw + m) { e.x = -hw + m; e.vx = Math.abs(e.vx); }
      if (e.x > hw - m) { e.x = hw - m; e.vx = -Math.abs(e.vx); }
      if (e.y < -hh + m) { e.y = -hh + m; e.vy = Math.abs(e.vy); }
      if (e.y > hh - m) { e.y = hh - m; e.vy = -Math.abs(e.vy); }
    }

    // 重ならないように やんわり押しあう
    for (let i = 0; i < E.length; i++) {
      const a = E[i];
      if (a.age < a.born || a.type === 'hole') continue;
      for (let j = i + 1; j < E.length; j++) {
        const b = E[j];
        if (b.age < b.born || b.type === 'hole') continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (rr - d) * 0.22;   // 弱くして 塊のまま群れさせる
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }

    // プレイヤーもホールに引かれる
    if (alive) {
      for (let h = 0; h < holes.length; h++) {
        const H2 = holes[h];
        const ddx = H2.x - p.x, ddy = H2.y - p.y;
        const dd = Math.hypot(ddx, ddy) || 1;
        if (dd < 480) {
          const f = (1 - dd / 480) * 300 * dt;
          p.vx += ddx / dd * f;
          p.vy += ddy / dd * f;
        }
      }
    }
  },

  // ---------------- ビット ----------------
  dropBits(x, y, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), s = rnd(60, spd || 190);
      this.bits.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 11, rot: rnd(0, TAU), spin: rnd(-6, 6), pull: 0,
      });
    }
    // 増えすぎたら 古いものから消す
    while (this.bits.length > 420) this.bits.shift();
  },

  updateBits(dt) {
    const B = this.bits;
    const p = this.p;
    const hw = this.W / 2 - 8, hh = this.H / 2 - 8;
    const MAG = this.D.magnet, MAG2 = MAG * MAG;
    const alive = this.phase === 'play';
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      b.life -= dt;
      if (b.life <= 0) { B.splice(i, 1); continue; }
      b.rot += b.spin * dt;

      if (alive) {
        const dx = p.x - b.x, dy = p.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MAG2) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / MAG);
          b.pull = Math.min(1, b.pull + dt * 4);
          const acc = 1500 * f * f * b.pull;
          b.vx += dx / d * acc * dt;
          b.vy += dy / d * acc * dt;
          if (d < p.r + 21) {           // ついばんだ
            B.splice(i, 1);
            this.eatBit(b.x, b.y);
            continue;
          }
        } else {
          b.pull = Math.max(0, b.pull - dt);
        }
      }

      const drag = Math.exp(-2.2 * dt);
      b.vx *= drag; b.vy *= drag;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -hw) { b.x = -hw; b.vx = Math.abs(b.vx) * 0.6; }
      if (b.x > hw) { b.x = hw; b.vx = -Math.abs(b.vx) * 0.6; }
      if (b.y < -hh) { b.y = -hh; b.vy = Math.abs(b.vy) * 0.6; }
      if (b.y > hh) { b.y = hh; b.vy = -Math.abs(b.vy) * 0.6; }
    }
  },

  // ビット1つで 倍率+1。上限なし。ここが本家GW2の心臓部で、
  // 「3〜20個でようやく1段」にすると 拾う気持ちよさが消える
  eatBit(x, y) {
    this.bitTotal++;
    this.bitCount++;
    this.score += 5 * this.mult;
    if (this.mult < MULT_MAX) {
      this.mult++;
      this.maxMult = Math.max(this.maxMult, this.mult);
    }
    const m = this.mult;
    const milestone = (m === 10 || m === 25 || m === 50 || m === 100 || (m >= 200 && m % 100 === 0));
    this.ev('bit', { x, y, mult: m, milestone });
  },

  // ---------------- 湧き ----------------
  updateSpawning(dt) {
    const D = this.D;
    const t = this.time;
    const us = this.mode === 'timeattack' ? 0.22 : D.unlockScale;

    // 新しい敵の解禁を知らせる
    for (const u of UNLOCK) {
      const at = u.at * us;
      if (!this.unlocked[u.type] && t >= at) {
        this.unlocked[u.type] = true;
        if (u.at > 0) this.ev('newtype', { type: u.type });
      }
    }

    // わいてくる勢い
    // 直線ではなく 加速して増える。本家は「2分後には画面が別の宇宙」
    const tm = t / 60;
    let rate = Math.min(D.rateMax, D.rate0 + t * D.rateK + tm * tm * D.accel);
    if (this.mode === 'timeattack') rate = Math.min(9.0, 2.2 + t * 0.11);
    if (this.enemies.length >= D.maxEnemies) rate *= 0.15;

    // 開始してすぐ、ジェイドを囲むように最初の群れを出す。
    // ここが無いと「最初の30秒がガラガラ」で、何をするゲームか伝わらない
    if (!this.opening && t > 1.1) {
      this.opening = true;
      const n = this.mode === 'timeattack' ? 8 : 6;
      const rr = 360;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + rnd(-0.15, 0.15);
        this.pushSpawn(clamp(this.p.x + Math.cos(a) * rr, -this.W / 2 + 70, this.W / 2 - 70),
                       clamp(this.p.y + Math.sin(a) * rr, -this.H / 2 + 70, this.H / 2 - 70),
                       'noise', 0.75 + i * 0.05);
      }
    }

    this.spawnAcc += dt * rate;
    let guard = 0;
    while (this.spawnAcc >= 1 && guard++ < 5) {
      this.spawnAcc -= this.queueSpawn();
    }

    // 予告 → 実体化
    for (let i = this.spawns.length - 1; i >= 0; i--) {
      const s = this.spawns[i];
      s.t += dt;
      if (s.t >= s.dur) {
        this.spawns.splice(i, 1);
        if (this.enemies.length < this.D.maxEnemies + 6) {
          this.spawnEnemy(s.type, s.x, s.y, 0);
          this.ev('pop', { x: s.x, y: s.y, col: BUG[s.type].rgb });
        }
      }
    }
  },

  queueSpawn() {
    // 重みつきで種類をえらぶ
    const t = this.time;
    const us = this.mode === 'timeattack' ? 0.22 : this.D.unlockScale;
    let total = 0;
    const cand = [];
    for (const u of UNLOCK) {
      const at = u.at * us;
      if (t < at) continue;
      // ホールとワームは 同時に何匹も出さない
      if (u.type === 'hole' && this.countType('hole') >= 2) continue;
      if (u.type === 'worm' && this.countType('worm') >= 4) continue;
      const ramp = clamp((t - at) / (u.ramp * us), 0, 1);
      const w = u.w * (0.25 + 0.75 * ramp);
      if (w <= 0) continue;
      cand.push({ type: u.type, w });
      total += w;
    }
    if (!cand.length) return 1;
    let r = Math.random() * total;
    let type = cand[0].type;
    for (const c of cand) { r -= c.w; if (r <= 0) { type = c.type; break; } }

    // ジェイドから離れたところに
    const hw = this.W / 2 - 70, hh = this.H / 2 - 70;
    let x = 0, y = 0, ok = false;
    for (let i = 0; i < 14; i++) {
      x = rnd(-hw, hw); y = rnd(-hh, hh);
      const d = Math.hypot(x - this.p.x, y - this.p.y);
      if (d > 260) { ok = true; break; }
    }
    if (!ok) {
      const a = rnd(0, TAU);
      x = clamp(this.p.x + Math.cos(a) * 330, -hw, hw);
      y = clamp(this.p.y + Math.sin(a) * 330, -hh, hh);
    }
    // 群れの大きさ（種類と経過時間で変わる）
    const ramp = clamp(t / 90, 0, 1);
    let n = 1;
    if (type === 'noise')        n = 4 + Math.round(rnd(0, 4) + ramp * 8);
    else if (type === 'chaser')  n = 3 + Math.round(rnd(0, 3) + ramp * 6);
    else if (type === 'spinner') n = 2 + Math.round(rnd(0, 3) + ramp * 4);
    else if (type === 'dodger')  n = 2 + Math.round(rnd(0, 2) + ramp * 4);
    else if (type === 'split')   n = 1 + Math.round(rnd(0, 1) + ramp * 2);
    const room = this.D.maxEnemies + 8 - this.enemies.length - this.spawns.length;
    n = Math.max(1, Math.min(n, room));

    // 並べ方：輪 か 線
    const ring = Math.random() < 0.6;
    const rr = 46 + n * 7;
    const la = rnd(0, TAU);
    const hw2 = this.W / 2 - 40, hh2 = this.H / 2 - 40;
    for (let i = 0; i < n; i++) {
      let ox, oy;
      if (ring) {
        const a = i / n * TAU + rnd(-0.1, 0.1);
        ox = Math.cos(a) * rr; oy = Math.sin(a) * rr;
      } else {
        const off = (i - (n - 1) / 2) * (rr * 0.9);
        ox = Math.cos(la) * off; oy = Math.sin(la) * off;
      }
      this.pushSpawn(clamp(x + ox, -hw2, hw2), clamp(y + oy, -hh2, hh2), type,
                     (this.mode === 'timeattack' ? 0.5 : 0.7) + i * 0.035);
    }
    return n;
  },

  pushSpawn(x, y, type, dur) {
    this.spawns.push({ x, y, type, t: 0, dur });
    this.ev('warn', { x, y, col: BUG[type].rgb });
  },

  countType(t) {
    let n = 0;
    for (const e of this.enemies) if (e.type === t) n++;
    return n;
  },

  // ---------------- 当たり ----------------
  collide() {
    const E = this.enemies, B = this.bullets, p = this.p;

    // 弾 × バグ
    for (let i = E.length - 1; i >= 0; i--) {
      const e = E[i];
      if (e.age < e.born) continue;
      for (let j = B.length - 1; j >= 0; j--) {
        const b = B[j];
        if (!segCircle(b.px, b.py, b.x, b.y, e.x, e.y, e.r + b.r)) continue;
        B.splice(j, 1);
        this.ev('spark', { x: b.x, y: b.y, a: b.ang, col: e.col });
        e.hp--;
        if (e.type === 'hole') {
          e.grow += 0.35;
          this.ev('hit', { x: b.x, y: b.y, col: e.col });
        }
        if (e.hp <= 0) {
          this.killEnemy(i, b.vx, b.vy);
          break;
        } else {
          this.ev('hit', { x: b.x, y: b.y, col: e.col });
        }
      }
    }

    // バグ × ジェイド
    if (this.phase === 'play' && this.invul <= 0) {
      for (let i = 0; i < E.length; i++) {
        const e = E[i];
        if (e.age < e.born) continue;
        const rr = e.r + p.r * 0.75;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) { this.playerDie(); return; }
        if (e.seg) {   // しっぽも あたる
          for (const sg of e.seg) {
            const r2 = e.r * 0.8 + p.r * 0.7;
            if ((sg.x - p.x) ** 2 + (sg.y - p.y) ** 2 < r2 * r2) { this.playerDie(); return; }
          }
        }
      }
    }
  },

  killEnemy(i, ivx, ivy, byBomb) {
    const e = this.enemies[i];
    const d = BUG[e.type];
    let pts = d.pts, bits = d.bits;
    if (e.type === 'split') {
      pts = e.gen === 0 ? 25 : e.gen === 1 ? 15 : 10;
      bits = 1;
    }
    if (e.type === 'hole') bits = d.bits + Math.floor(e.grow);

    this.score += pts * this.mult;
    this.killTotal++;
    this.enemies.splice(i, 1);
    this.dropBits(e.x, e.y, bits, e.type === 'hole' ? 320 : 190);
    this.ev('kill', {
      x: e.x, y: e.y, col: e.col, r: e.r, type: e.type,
      vx: (ivx || 0) * 0.12, vy: (ivy || 0) * 0.12,
      big: e.type === 'hole' || e.type === 'worm',
      pts: pts * this.mult,
    });

    // ぶんれつ
    if (e.type === 'split' && e.gen < 2 && !byBomb) {
      for (let k = 0; k < 2; k++) {
        const a = rnd(0, TAU);
        const ne = this.spawnEnemy('split', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, e.gen + 1);
        ne.born = 0.15;
        ne.vx = Math.cos(a) * 200;
        ne.vy = Math.sin(a) * 200;
      }
    }
    // ワームは しっぽからも ビットが出る
    if (e.type === 'worm' && e.seg) {
      for (const sg of e.seg) this.dropBits(sg.x, sg.y, 1, 120);
    }
  },

  // ---------------- ボム（大はばたき）----------------
  useBomb() {
    if (this.phase !== 'play' || this.bombs <= 0) return false;
    this.bombs--;
    const p = this.p;
    this.slowTimer = 0.55;
    this.ev('bomb', { x: p.x, y: p.y });
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.age < e.born) { this.enemies.splice(i, 1); continue; }
      this.killEnemy(i, 0, 0, true);
    }
    this.spawns.length = 0;
    this.ev('bombgather', { n: this.bits.length });
    // ビットを ぜんぶ 引き寄せる
    for (const b of this.bits) {
      const dx = p.x - b.x, dy = p.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      b.vx += dx / d * 420;
      b.vy += dy / d * 420;
      b.pull = 1;
    }
    return true;
  },

  // ---------------- 死 ----------------
  playerDie() {
    const p = this.p;
    const mBefore = this.mult;
    this.lives--;
    // 本家GW2と同じく、やられても倍率は減らさない。
    // 「一度のミスで戦意を失わない」ための いちばん大事な仕様
    this.mult = Math.max(1, Math.round(this.mult * this.D.multKeep));
    this.ev('death', { x: p.x, y: p.y, from: mBefore, to: this.mult });
    this.slowTimer = 0.5;

    // まわりの敵は 消える。遠くの敵は 吹き飛ばすだけ
    const CLEAR = 520;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < CLEAR) {
        this.enemies.splice(i, 1);
        this.ev('vanish', { x: e.x, y: e.y, col: e.col, r: e.r });
      } else {
        const f = 900 * Math.max(0, 1 - (d - CLEAR) / 500);
        e.vx += dx / d * f;
        e.vy += dy / d * f;
      }
    }
    // 予告中のものも 消す（復活した所に湧かないように）
    for (let i = this.spawns.length - 1; i >= 0; i--) {
      if (Math.hypot(this.spawns[i].x - p.x, this.spawns[i].y - p.y) < CLEAR) this.spawns.splice(i, 1);
    }

    if (this.mode === 'timeattack') {
      this.timeLeft = Math.max(0, this.timeLeft - 5);
      this.phase = 'dead';
      this.deadTimer = 0.75;
      if (this.timeLeft <= 0) { this.finish(); return; }
    } else if (this.lives <= 0) {
      this.phase = 'over';
      this.p.alive = false;
      this.ev('gameover', {});
      return;
    } else {
      this.phase = 'dead';
      this.deadTimer = 1.15;
    }
    this.p.alive = false;
  },

  respawn() {
    const p = this.p;
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
    p.alive = true;
    this.phase = 'play';
    this.invul = 2.6;
    this.ev('respawn', { x: 0, y: 0 });
    for (const e of this.enemies) {          // 中央から どかす
      const d = Math.hypot(e.x, e.y) || 1;
      if (d < 300) {
        const f = (300 - d) + 60;
        e.x += e.x / d * f;
        e.y += e.y / d * f;
        e.vx += e.x / d * 120;
        e.vy += e.y / d * 120;
      }
    }
  },

  finish() {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.ev(this.mode === 'timeattack' ? 'timeup' : 'gameover', {});
  },

  // ---------------- ごほうび ----------------
  checkRewards() {
    if (this.mode === 'timeattack') return;
    // ごほうびは「桁が1つ上がるごと」（10万→100万→1000万…）。
    // 倍率が数百倍まで伸びても壊れない、本家と同じ数え方
    if (this.score >= this.nextLifeAt) {
      this.nextLifeAt *= 10;
      if (this.lives < LIVES_MAX) {
        this.lives++;
        this.ev('extralife', {});
      } else {
        this.score += 500 * this.mult;  // もう増やせないときは 点でおかえし
        this.ev('extrabomb', {});
      }
    }
    if (this.score >= this.nextBombAt) {
      this.nextBombAt *= 10;
      this.bombs = Math.min(5, this.bombs + 1);
      this.ev('extrabomb', {});
    }
  },

  // ---------------- 検索 ----------------
  nearestEnemy(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    for (const e of this.enemies) {
      if (e.age < e.born) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },

  nearestBullet(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    for (const b of this.bullets) {
      const d = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  },

  // ピンチ度（0..1）— 音と画面の演出に使う
  danger() {
    if (this.phase !== 'play') return 0;
    const p = this.p;
    let d = 0;
    for (const e of this.enemies) {
      if (e.age < e.born) continue;
      const dd = Math.hypot(e.x - p.x, e.y - p.y);
      if (dd < 300) d += (1 - dd / 300) * (e.type === 'hole' ? 0.45 : 0.22);
    }
    if (this.invul > 0) d *= 0.3;
    return clamp(d, 0, 1);
  },

  // 音の緊張度 0..7
  intensity() {
    const t = this.mode === 'timeattack' ? this.time * 2.2 : this.time;
    let lv = 0;
    if (t > 4) lv = 1;
    if (t > 16) lv = 2;
    if (t > 30) lv = 3;
    if (t > 48) lv = 4;
    if (t > 70) lv = 5;
    if (t > 95) lv = 6;
    if (t > 125) lv = 7;
    if (this.mult >= 8 && lv < 5) lv = 5;
    if (this.mult >= 15 && lv < 6) lv = 6;
    return lv;
  },
};

// 線分と円の当たり（速い弾がすり抜けないように）
function segCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0, dy = y1 - y0;
  const fx = x0 - cx, fy = y0 - cy;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return fx * fx + fy * fy <= r * r;
  let t = -(fx * dx + fy * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = fx + dx * t, py = fy + dy * t;
  return px * px + py * py <= r * r;
}
