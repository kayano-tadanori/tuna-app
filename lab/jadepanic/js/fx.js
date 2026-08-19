// ============================================================
// fx.js — 粒子と、ベクター図形の描き方
//   ジェイドも バグも 弾も、ぜんぶ線分のあつまりとして描く。
// ============================================================
'use strict';

// ------------------------------------------------------------
// 粒子（使い回しの池。毎フレーム new しない）
// ------------------------------------------------------------
const Part = {
  cap: 5600,
  a: null,
  n: 0,

  init() {
    this.a = new Array(this.cap);
    for (let i = 0; i < this.cap; i++) {
      this.a[i] = { x:0, y:0, vx:0, vy:0, life:0, max:1, r:1, g:1, b:1,
                    size:3, glow:1, drag:1.6, spin:0 };
    }
    this.n = 0;
  },

  spawn(x, y, vx, vy, life, col, size, glow, drag) {
    if (this.n >= this.cap) return null;
    const p = this.a[this.n++];
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life;
    p.r = col[0]; p.g = col[1]; p.b = col[2];
    p.size = size; p.glow = glow; p.drag = drag === undefined ? 1.6 : drag;
    return p;
  },

  // 円形に はじけ飛ぶ
  burst(x, y, n, col, spd, size, life, glow, drag) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), s = spd * rnd(0.25, 1.0);
      this.spawn(x + Math.cos(a) * rnd(0, 6), y + Math.sin(a) * rnd(0, 6),
                 Math.cos(a) * s, Math.sin(a) * s,
                 life * rnd(0.6, 1.2), col, size * rnd(0.7, 1.3), glow,
                 drag === undefined ? 1.5 : drag);
    }
  },

  // 一方向に散る（弾が当たったときの火花）
  spray(x, y, ang, n, col, spd, size, life, spread) {
    for (let i = 0; i < n; i++) {
      const a = ang + rnd(-spread, spread), s = spd * rnd(0.3, 1.0);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s,
                 life * rnd(0.5, 1.1), col, size * rnd(0.6, 1.2), 1.6, 2.6);
    }
  },

  // リング状に広がる（ボム・復活）
  ring(x, y, n, col, spd, size, life, glow) {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + rnd(-0.05, 0.05);
      const s = spd * rnd(0.9, 1.1);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life, col, size, glow, 1.1);
    }
  },

  update(dt) {
    const a = this.a;
    for (let i = this.n - 1; i >= 0; i--) {
      const p = a[i];
      p.life -= dt;
      if (p.life <= 0) {
        // 末尾と入れかえて縮める
        this.n--;
        if (i !== this.n) { a[i] = a[this.n]; a[this.n] = p; }
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  },

  draw() {
    const a = this.a;
    const col = [0, 0, 0];
    for (let i = 0; i < this.n; i++) {
      const p = a[i];
      const t = p.life / p.max;
      const f = t * t;
      col[0] = p.r; col[1] = p.g; col[2] = p.b;
      // 速いほど 尾を引く
      const st = 0.024;
      R.line(p.x - p.vx * st, p.y - p.vy * st, p.x, p.y, col,
             p.size * (0.35 + 0.65 * t), p.glow * f * 1.9);
    }
  },

  clear() { this.n = 0; },
};

// ------------------------------------------------------------
// ジェイドの形（+X向き・真上から見た鳥）
//   上から見た鳥にすると、大きな翼が一目で「鳥」と分かる。
//   線のにじみ半径より 図形の間隔を広くとらないと、光のかたまりになる。
// ------------------------------------------------------------
const S_BODY  = [14,7, 0,10, -14,8, -22,0, -14,-8, 0,-10, 14,-7];
const S_HEAD  = [26,0, 22,6, 15,7, 12,0, 15,-7, 22,-6];
const S_BEAK  = [24,3, 34,0, 24,-3];
const S_TAIL  = [-21,4, -34,8, -30,0, -34,-8, -21,-4];
const S_WING  = [8,7, 2,26, -14,34, -21,19, -10,8];
const _wingScratch = S_WING.slice();   // はばたきの計算用（毎フレーム確保しない）
const WHITE = [1, 1, 1];

// 羽ばたきをふくめて ジェイドを描く
function drawJade(x, y, face, flapT, thrust, invulBlink, scale, alphaGlow) {
  const sc = scale === undefined ? 1 : scale;
  const g = (alphaGlow === undefined ? 1 : alphaGlow) * (invulBlink ? 0.45 : 1);
  if (g <= 0.02) return;
  const w = 1.7 * sc;

  // 翼（左右が同じ位相で 上下に打つ＝真上から見ると 幅が縮む）
  const flap = Math.sin(flapT);
  // 翼は たたみきらない。半分の時間 翼が消えると「鳥」に見えなくなる
  const fold = 0.82 + 0.18 * flap;
  const sweep = -flap * 0.11;           // 打つときは すこし後ろへ
  for (let s = -1; s <= 1; s += 2) {
    const pts = _wingScratch;
    for (let i = 0; i < S_WING.length; i += 2) {
      pts[i] = S_WING[i] + (1 - fold) * 12;
      pts[i+1] = S_WING[i+1] * s * fold;
    }
    R.poly(pts, x, y, face + sweep * s, sc, JADE_COL.wing, w * 1.05, 2.55 * g, true);
  }

  R.poly(S_TAIL, x, y, face, sc, JADE_COL.wing, w, 2.20 * g, true);
  R.poly(S_BODY, x, y, face, sc, JADE_COL.body, w * 1.15, 3.30 * g, true);
  R.poly(S_HEAD, x, y, face, sc, JADE_COL.head, w, 3.30 * g, true);
  R.poly(S_BEAK, x, y, face, sc, JADE_COL.head, w * 1.05, 3.30 * g, true);

  // 白い芯。大群の中でも「自分」が一目で分かるように（本家の自機も白い）
  R.dot(x, y, WHITE, 4.0 * sc, 3.4 * g);

  // 目
  const ex = 19 * sc, ey = 4.4 * sc;
  const cs = Math.cos(face), sn = Math.sin(face);
  R.dot(x + ex * cs - ey * sn, y + ex * sn + ey * cs, WHITE, 1.5 * sc, 2.2 * g);
  R.dot(x + ex * cs + ey * sn, y + ex * sn - ey * cs, WHITE, 1.5 * sc, 2.2 * g);

  // 推進のかがやき
  if (thrust > 0.05) {
    const bx = x - cs * 26 * sc, by = y - sn * 26 * sc;
    R.dot(bx, by, JADE_COL.body, 4.5 * sc * thrust, 1.6 * thrust * g);
  }
}

// ------------------------------------------------------------
// バグたち
// ------------------------------------------------------------
function drawEnemy(e, t) {
  const born = e.age < e.born;
  // 生まれる瞬間は 大きく → きゅっと縮む
  let sc = 1, glow = 1;
  if (born) {
    const k = e.age / e.born;
    sc = 2.4 - 1.4 * easeOut(k);
    glow = 0.35 + k * 0.9;
  }
  const r = e.r * sc;
  const c = e.col;
  const w = 3.5;

  switch (e.type) {
    case 'noise': {
      R.poly([r,0, 0,r, -r,0, 0,-r], e.x, e.y, e.rot, 1, c, w, 2.4 * glow, true);
      R.poly([r*0.5,0, 0,r*0.5, -r*0.5,0, 0,-r*0.5], e.x, e.y, -e.rot * 1.6, 1, c, w * 0.8, 1.7 * glow, true);
      break;
    }
    case 'chaser': {
      R.poly([r*1.6,0, 0,r*0.85, -r*0.9,0, 0,-r*0.85], e.x, e.y, e.rot, sc, c, w, 2.8 * glow, true);
      R.line(e.x, e.y, e.x + Math.cos(e.rot) * r * 1.2 * sc, e.y + Math.sin(e.rot) * r * 1.2 * sc,
             WHITE, w * 0.55, 1.6 * glow);
      break;
    }
    case 'spinner': {
      // 4枚の羽根の風車
      for (let k = 0; k < 4; k++) {
        const a = e.rot + k / 4 * TAU;
        const pts = [0,0, r*0.55,r*0.28, r*1.05,0, r*0.55,-r*0.16];
        R.poly(pts, e.x, e.y, a, sc, c, w * 0.9, 2.5 * glow, true);
      }
      R.circle(e.x, e.y, r * 0.3, 6, c, w, 2.2 * glow, e.rot);
      break;
    }
    case 'dodger': {
      const q = r * 0.9;
      R.poly([q,q, -q,q, -q,-q, q,-q], e.x, e.y, e.rot, 1, c, w, 2.5 * glow, true);
      R.poly([q*0.62,q*0.62, -q*0.62,-q*0.62], e.x, e.y, e.rot, 1, c, w * 0.8, 1.8 * glow, false);
      R.poly([-q*0.62,q*0.62, q*0.62,-q*0.62], e.x, e.y, e.rot, 1, c, w * 0.8, 1.8 * glow, false);
      if (e.dash > 0) R.circle(e.x, e.y, r * 1.5, 10, c, w * 0.6, 1.4 * e.dash * 2, 0);
      break;
    }
    case 'worm': {
      // しっぽ（うしろほど暗い）
      if (e.seg) {
        const ns = e.seg.length;
        for (let i = ns - 1; i >= 0; i--) {
          const sg = e.seg[i];
          const f = 1 - i / ns;
          const rr = e.r * (0.86 - 0.5 * (i / ns));
          R.circle(sg.x, sg.y, rr, 6, c, w * 0.75, (0.55 + f * 1.0) * glow, e.rot + i * 0.4);
        }
      }
      R.circle(e.x, e.y, r, 6, c, w * 1.2, 3.0 * glow, e.rot);
      R.circle(e.x, e.y, r * 0.45, 6, WHITE, w * 0.7, 2.0 * glow, -e.rot);
      // 目（弱点なのが分かるように）
      const nx = Math.cos(e.rot), ny = Math.sin(e.rot);
      R.dot(e.x + nx * r * 0.5 - ny * r * 0.35, e.y + ny * r * 0.5 + nx * r * 0.35, [1,0.3,0.3], 2.4, 3.0 * glow);
      R.dot(e.x + nx * r * 0.5 + ny * r * 0.35, e.y + ny * r * 0.5 - nx * r * 0.35, [1,0.3,0.3], 2.4, 3.0 * glow);
      break;
    }
    case 'hole': {
      const pulse = 1 + Math.sin(t * 4 + e.wob) * 0.06;
      R.circle(e.x, e.y, r * pulse, 20, c, w * 1.1, 2.6 * glow, e.rot);
      R.circle(e.x, e.y, r * 0.78 * pulse, 16, c, w * 0.8, 2.0 * glow, -e.rot * 1.5);
      R.circle(e.x, e.y, r * 0.55 * pulse, 12, [1, 0.85, 0.95], w * 0.7, 1.6 * glow, -e.rot * 2);
      R.dot(e.x, e.y, WHITE, r * 0.30, 2.8 * glow);   // 白熱した芯
      // 吸い込みの渦
      for (let k = 0; k < 6; k++) {
        const a = e.rot * 2.2 + k / 6 * TAU;
        const r1 = r * 1.5 + Math.sin(t * 3 + k) * 8;
        const r2 = r * 2.4 + Math.sin(t * 3 + k) * 8;
        R.line(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1,
               e.x + Math.cos(a + 0.5) * r2, e.y + Math.sin(a + 0.5) * r2,
               c, w * 0.7, 1.1 * glow);
      }
      break;
    }
    case 'split': {
      R.poly([r,0, -r*0.6,r*0.85, -r*0.6,-r*0.85], e.x, e.y, e.rot, 1, c, w, 2.5 * glow, true);
      R.poly([r*0.45,0, -r*0.28,r*0.4, -r*0.28,-r*0.4], e.x, e.y, -e.rot * 1.4, 1, c, w * 0.8, 1.8 * glow, true);
      break;
    }
  }
}

// ------------------------------------------------------------
// 弾・ビット・予告
// ------------------------------------------------------------
function drawBullet(b) {
  const cx = Math.cos(b.ang) * 26, cy = Math.sin(b.ang) * 26;
  R.line(b.x - cx, b.y - cy, b.x + cx * 0.35, b.y + cy * 0.35, JADE_COL.body, 3.0, 2.6);
  R.line(b.x - cx * 0.45, b.y - cy * 0.45, b.x + cx * 0.35, b.y + cy * 0.35, WHITE, 1.9, 3.0);
  R.dot(b.x + cx * 0.35, b.y + cy * 0.35, WHITE, 2.6, 3.2);
}

function drawBit(b, t) {
  const bl = b.life < 2.5 ? (0.35 + 0.65 * Math.abs(Math.sin(t * 9))) : 1;
  const r = 10 + Math.sin(t * 3 + b.rot) * 1.4;
  R.poly([r,0, 0,r, -r,0, 0,-r], b.x, b.y, b.rot, 1, BIT_COL, 2.6, 2.4 * bl, true);
  R.dot(b.x, b.y, WHITE, 2.2, 2.0 * bl);
}

function drawSpawnWarn(s, t) {
  const k = s.t / s.dur;
  const c = BUG[s.type].rgb;
  const r = 40 * (1 - easeOut(k)) + 10;
  const g = 1.4 + Math.sin(k * 34) * 0.6;
  // 破線の輪＝「ここに来る」の合図。敵の実体と見まちがえないよう 線を切る
  const seg = 10;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * TAU + t * 1.6, a1 = a0 + TAU / seg * 0.5;
    R.line(s.x + Math.cos(a0) * r, s.y + Math.sin(a0) * r,
           s.x + Math.cos(a1) * r, s.y + Math.sin(a1) * r, c, 2.2, g);
  }
  R.dot(s.x, s.y, c, 3.2, 1.2 + g * 0.6);
}
