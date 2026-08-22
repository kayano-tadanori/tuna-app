// ============================================================
// fx.js — 粒子と、ベクター図形の描き方
//   ジェイドも バグも 弾も、ぜんぶ線分のあつまりとして描く。
// ============================================================
'use strict';

// ------------------------------------------------------------
// 粒子の乱数は、ゲーム進行の乱数と 別の流れにする。
//   見た目を変えたときに ゲームの展開まで変わってしまうと、
//   同じ場面での A/B 比べができなくなる（2026-08-22 の検証でつまずいた）。
// ------------------------------------------------------------
let _prs = 0x9E3779B9 | 0;
function prnd(a, b) {
  _prs = (_prs + 0x6D2B79F5) | 0;
  let t = Math.imul(_prs ^ (_prs >>> 15), 1 | _prs);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return a === undefined ? u : a + u * (b - a);
}
function prndi(a, b) { return Math.floor(a + prnd() * (b - a + 1)); }

// ------------------------------------------------------------
// 粒子（使い回しの池。毎フレーム new しない）
// ------------------------------------------------------------
const Part = {
  cap: 9000,
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

  // 色をすこしばらす（1つの爆発の中で 白っぽい粒と 濃い粒が混ざる＝紙吹雪に見える）
  ACCENT: [[1.0, 0.62, 0.16], [0.28, 0.95, 1.0], [1.0, 0.32, 0.72], [0.55, 1.0, 0.42]],
  _jit(col) {
    const k = prnd(0.72, 1.28);
    const w = prnd() < 0.16 ? prnd(0.14, 0.34) : 0;
    const c = this._c || (this._c = [0, 0, 0]);
    c[0] = col[0]; c[1] = col[1]; c[2] = col[2];
    // 2割ほどは 別の色にずらす＝1つの爆発の中に色が混ざり、紙吹雪に見える
    if (prnd() < 0.20) {
      const a = this.ACCENT[prndi(0, 3)], m = prnd(0.45, 0.85);
      c[0] += (a[0] - c[0]) * m; c[1] += (a[1] - c[1]) * m; c[2] += (a[2] - c[2]) * m;
    }
    c[0] = Math.min(1.8, c[0] * k + w);
    c[1] = Math.min(1.8, c[1] * k + w);
    c[2] = Math.min(1.8, c[2] * k + w);
    return c;
  },

  // 円形に はじけ飛ぶ
  //   速さは「たまに うんと遠くまで飛ぶ」分布にする。
  //   みんな同じ速さだと 爆発が輪っかに見える（実測で指摘された）
  burst(x, y, n, col, spd, size, life, glow, drag) {
    for (let i = 0; i < n; i++) {
      const a = prnd(0, TAU);
      const u = prnd();
      const s = spd * (0.16 + Math.pow(u, 2.4) * 1.85);
      const r0 = prnd(3, 22);
      const pp = this.spawn(x + Math.cos(a) * r0, y + Math.sin(a) * r0,
                 Math.cos(a) * s, Math.sin(a) * s,
                 life * prnd(0.42, 1.35), this._jit(col), size * prnd(0.40, 1.15), glow * prnd(0.75, 1.15),
                 drag === undefined ? 1.5 : drag);
      // 池がいっぱいのとき spawn は null を返す。ここを素通しにすると 大群の場面で落ちる
      if (pp) pp.spin = prnd(-2.2, 2.2);
    }
  },

  // 一方向に散る（弾が当たったときの火花）
  spray(x, y, ang, n, col, spd, size, life, spread) {
    for (let i = 0; i < n; i++) {
      const a = ang + prnd(-spread, spread), s = spd * (0.25 + Math.pow(prnd(), 2.0) * 1.4);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s,
                 life * prnd(0.4, 1.2), this._jit(col), size * prnd(0.45, 1.1), 1.6, 2.6);
    }
  },

  // リング状に広がる（ボム・復活）
  ring(x, y, n, col, spd, size, life, glow) {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + prnd(-0.08, 0.08);
      const s = spd * prnd(0.78, 1.22);
      this.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, life * prnd(0.8, 1.25),
                 this._jit(col), size * prnd(0.6, 1.15), glow, 1.1);
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
      if (p.spin) {   // まっすぐ飛ぶだけだと 判子に見える。すこし曲げる
        const sn = p.spin * dt;
        const nvx = p.vx - p.vy * sn, nvy = p.vy + p.vx * sn;
        p.vx = nvx; p.vy = nvy;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  },

  boundW: 0, boundH: 0,   // かべの内側。ここから外へ出た粒は消していく

  draw() {
    const a = this.a;
    const col = [0, 0, 0];
    const bw = this.boundW, bh = this.boundH;
    for (let i = 0; i < this.n; i++) {
      const p = a[i];
      const t = p.life / p.max;
      let f = t * t;
      if (bw > 0) {
        const m = Math.max(Math.abs(p.x) / bw, Math.abs(p.y) / bh);
        if (m > 1) {
          f *= Math.max(0, 1 - (m - 1) * 5.0);
          if (f <= 0.004) continue;
        }
      }
      // 生まれた瞬間だけ 白く焼ける → すぐ色にもどる（火花の温度）
      const hot = t > 0.88 ? (t - 0.88) * 3.4 : 0;
      col[0] = p.r + hot; col[1] = p.g + hot; col[2] = p.b + hot;
      // 速いほど 長く伸び、細くなる（＝火花に見える。同じ長さの棒だと 判子に見える）
      const sp = Math.abs(p.vx) + Math.abs(p.vy);
      const st = 0.009 + Math.min(0.030, sp * 0.000040);
      R.line(p.x - p.vx * st, p.y - p.vy * st, p.x, p.y, col,
             p.size * (0.20 + 0.52 * t), p.glow * f * 2.05);
    }
  },

  clear() { this.n = 0; },
};

// ------------------------------------------------------------
// ジェイドの形（+X向き・真上から見た鳥）
//   上から見た鳥にすると、大きな翼が一目で「鳥」と分かる。
//   線のにじみ半径より 図形の間隔を広くとらないと、光のかたまりになる。
// ------------------------------------------------------------
// 真上から見た鳥。+X が進行方向。
//   翼を閉じた多角形にすると「輪っか」に見えて 鳥に読めない（実測で3人に指摘された）。
//   前縁と後縁の 2本の開いた線が 翼の先で合流する形にする。
const S_BODY  = [16,6, 4,9, -12,7, -20,0, -12,-7, 4,-9, 16,-6];
const S_HEAD  = [27,0, 22,5, 15,6, 13,0, 15,-5, 22,-5];
const S_BEAK  = [25,2.6, 35,0, 25,-2.6];
// 尾＝3枚の扇（切れこみが見えるように 別々の線で描く）
// 扇はとじた形にする（開いた線は 小さく描くと「引っかき傷」に見える）
const S_TAILF = [-18,3.4, -33,9, -38,0, -33,-9, -18,-3.4];
const S_TAILV1 = [-20,1.2, -35,4.4];
const S_TAILV2 = [-20,-1.2, -35,-4.4];
const S_WING_F = [7,7, -1,23, -13,33];     // 翼の前縁
const S_WING_B = [-13,33, -18,19, -9,8];   // 翼の後縁
const _wf = S_WING_F.slice(), _wb = S_WING_B.slice();
const WHITE = [1, 1, 1];
const _wormCol = [0, 0, 0];

// 羽ばたきをふくめて ジェイドを描く
function drawJade(x, y, face, flapT, thrust, invulBlink, scale, alphaGlow) {
  const sc = scale === undefined ? 1 : scale;
  const g = (alphaGlow === undefined ? 1 : alphaGlow) * (invulBlink ? 0.45 : 1);
  if (g <= 0.02) return;
  const w = 1.8 * sc;
  const keep = R.coreMul;

  const flap = Math.sin(flapT);
  const fold = 0.84 + 0.16 * flap;      // たたみきらない（鳥に見えなくなる）
  const sweep = -flap * 0.10;

  // シルエット（翼・尾・体）は 芯を弱くして 色を残す
  R.coreMul = keep * 0.28;
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < S_WING_F.length; i += 2) {
      _wf[i] = S_WING_F[i] + (1 - fold) * 10; _wf[i+1] = S_WING_F[i+1] * s * fold;
    }
    for (let i = 0; i < S_WING_B.length; i += 2) {
      _wb[i] = S_WING_B[i] + (1 - fold) * 10; _wb[i+1] = S_WING_B[i+1] * s * fold;
    }
    R.poly(_wf, x, y, face + sweep * s, sc, JADE_COL.wing, w * 1.2, 3.9 * g, false);
    R.poly(_wb, x, y, face + sweep * s, sc, JADE_COL.wing, w * 0.9, 2.9 * g, false);
  }
  R.poly(S_TAILF, x, y, face, sc, JADE_COL.wing, w * 0.95, 2.7 * g, true);
  R.poly(S_TAILV1, x, y, face, sc, JADE_COL.wing, w * 0.6, 1.7 * g, false);
  R.poly(S_TAILV2, x, y, face, sc, JADE_COL.wing, w * 0.6, 1.7 * g, false);
  R.poly(S_BODY, x, y, face, sc, JADE_COL.body, w * 1.25, 3.8 * g, true);

  // 頭とくちばしは 芯を強く＝顔が読める
  R.coreMul = keep * 0.85;
  R.poly(S_HEAD, x, y, face, sc, JADE_COL.head, w, 3.6 * g, true);
  R.poly(S_BEAK, x, y, face, sc, JADE_COL.head, w * 1.05, 3.6 * g, true);

  // 「自分はここ」を示す 白い芯。小さく、でも必ず出す（爆発の中でも沈まないように）
  R.coreMul = keep;
  // まん中の点は「自分はここ」の目印。大きいと目やコックピットに見えるので 控えめに
  R.dot(x, y, WHITE, 1.7 * sc, 3.2 * g);

  // 目は 頭に2つ。ここが光ると 顔の向きが読める
  const ex = 20.5 * sc, ey = 3.8 * sc;
  const cs = Math.cos(face), sn = Math.sin(face);
  R.dot(x + ex * cs - ey * sn, y + ex * sn + ey * cs, WHITE, 1.6 * sc, 3.4 * g);
  R.dot(x + ex * cs + ey * sn, y + ex * sn - ey * cs, WHITE, 1.6 * sc, 3.4 * g);

  if (thrust > 0.05) {
    const bx = x - cs * 24 * sc, by = y - sn * 24 * sc;
    R.dot(bx, by, JADE_COL.body, 4.0 * sc * thrust, 1.5 * thrust * g);
  }
  R.coreMul = keep;
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
      // 踏みこむ瞬間だけ 前へ伸びる（ドクン、と迫ってくるのが 形でも分かる）
      const sq = 1 + (e.squash || 0) * 0.55;
      R.poly([r*1.6*sq,0, 0,r*0.85/sq, -r*0.9,0, 0,-r*0.85/sq], e.x, e.y, e.rot, sc, c, w, (2.8 + (e.squash||0) * 1.6) * glow, true);
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
      // 白い数珠に見えていた原因は「芯が太い」「全部同じ大きさ」「色が抜ける」の3つ。
      // 胴は芯を切って色を残し、うしろほど小さく暗くする。頭だけ熱くする＝弱点が分かる。
      const keepW = R.coreMul;
      const cc = _wormCol;
      if (e.seg) {
        const ns = e.seg.length;
        R.coreMul = keepW * 0.18;
        // まず 節と節をつなぐ胴。これが無いと「数珠つなぎ」に見える
        let lx = e.x, ly = e.y;
        for (let i = 0; i < ns; i++) {
          const sg = e.seg[i];
          const f = 1 - i / ns;
          cc[0] = c[0] * (0.28 + 0.72 * f);
          cc[1] = c[1] * (0.28 + 0.72 * f);
          cc[2] = c[2] * (0.45 + 0.55 * f);
          R.line(lx, ly, sg.x, sg.y, cc, e.r * (0.46 - 0.26 * (i / ns)), (0.45 + f * 1.15) * glow);
          lx = sg.x; ly = sg.y;
        }
        for (let i = ns - 1; i >= 0; i--) {
          const sg = e.seg[i];
          const f = 1 - i / ns;
          const rr = e.r * (0.78 - 0.54 * (i / ns));
          cc[0] = c[0] * (0.30 + 0.70 * f);
          cc[1] = c[1] * (0.30 + 0.70 * f);
          cc[2] = c[2] * (0.45 + 0.55 * f);
          R.circle(sg.x, sg.y, rr, 5, cc, w * 0.5, (0.40 + f * 1.45) * glow, e.rot + i * 0.55);
        }
      }
      // 頭：進行方向に とがったくさび
      R.coreMul = keepW;
      R.poly([r * 1.45, 0, r * 0.30, r * 0.86, -r * 0.75, r * 0.58,
              -r * 0.75, -r * 0.58, r * 0.30, -r * 0.86],
             e.x, e.y, e.rot, 1, c, w * 1.15, 3.8 * glow, true);
      const nx = Math.cos(e.rot), ny = Math.sin(e.rot);
      R.dot(e.x + nx * r * 0.30 - ny * r * 0.40, e.y + ny * r * 0.30 + nx * r * 0.40, [1, 0.22, 0.22], 3.4, 4.4 * glow);
      R.dot(e.x + nx * r * 0.30 + ny * r * 0.40, e.y + ny * r * 0.30 - nx * r * 0.40, [1, 0.22, 0.22], 3.4, 4.4 * glow);
      R.coreMul = keepW;
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
const BULLET_COL = [1.0, 0.72, 0.22];
function drawBullet(b) {
  const cx = Math.cos(b.ang), cy = Math.sin(b.ang);
  // 後ろへ長く尾を引く色の筋
  R.line(b.x - cx * 26, b.y - cy * 26, b.x + cx * 5, b.y + cy * 5, BULLET_COL, 1.75, 2.35);
  // 白く細い芯（ここが「弾」に見えるかどうかを決める）
  R.line(b.x - cx * 9, b.y - cy * 9, b.x + cx * 6, b.y + cy * 6, WHITE, 0.85, 2.9);
  // 先端
  R.dot(b.x + cx * 7, b.y + cy * 7, WHITE, 1.5, 3.4);
}

function drawBit(b, t) {
  const bl = b.life < 2.5 ? (0.35 + 0.65 * Math.abs(Math.sin(t * 9))) : 1;
  const r = 8.4 + Math.sin(t * 3.4 + b.rot) * 1.3;
  // 芯の白を切る。白いと「小さな白い四角」にしか見えず、拾える物に見えない。
  // 中の点もやめて、輪郭だけの ひし形にする＝敵（輪郭＋中身）と形で分かれる
  const keep = R.coreMul;
  R.coreMul = 0.22;
  R.poly([r,0, 0,r*0.86, -r,0, 0,-r*0.86], b.x, b.y, b.rot, 1, BIT_COL, 1.5, 3.5 * bl, true);
  R.coreMul = keep;
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
