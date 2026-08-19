// ============================================================
// grid.js — ゆがむグリッド
//   バネでつながった格子。爆発で波が広がり、バグホールに吸い寄せられる。
//   このゲームの「世界そのもの」＝ここが揺れるから爽快になる。
// ============================================================
'use strict';

const Grid = {
  cols: 0, rows: 0, sp: 0,
  x0: 0, y0: 0,
  ox: null, oy: null, vx: null, vy: null,   // 元の位置からのズレと速度
  tmpx: null, tmpy: null,

  init(W, H, spacing) {
    this.sp = spacing;
    this.cols = Math.floor(W / spacing) + 1;
    this.rows = Math.floor(H / spacing) + 1;
    const n = this.cols * this.rows;
    this.ox = new Float32Array(n);
    this.oy = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.tmpx = new Float32Array(n);
    this.tmpy = new Float32Array(n);
    this.px = new Float32Array(n);      // 描画用（毎フレーム確保しないため）
    this.py = new Float32Array(n);
    this.x0 = -(this.cols - 1) * spacing / 2;
    this.y0 = -(this.rows - 1) * spacing / 2;
  },

  restX(i) { return this.x0 + (i % this.cols) * this.sp; },
  restY(i) { return this.y0 + Math.floor(i / this.cols) * this.sp; },

  // 爆発などの押し出し
  impulse(x, y, radius, force) {
    const r2 = radius * radius;
    for (let i = 0; i < this.ox.length; i++) {
      const dx = this.restX(i) + this.ox[i] - x;
      const dy = this.restY(i) + this.oy[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 || d2 < 1) continue;
      const d = Math.sqrt(d2);
      const f = (1 - d / radius) * force;
      this.vx[i] += dx / d * f;
      this.vy[i] += dy / d * f;
    }
  },

  // 吸い込み（負の力）
  attract(x, y, radius, force, dt) {
    const r2 = radius * radius;
    for (let i = 0; i < this.ox.length; i++) {
      const dx = x - (this.restX(i) + this.ox[i]);
      const dy = y - (this.restY(i) + this.oy[i]);
      const d2 = dx * dx + dy * dy;
      if (d2 > r2 || d2 < 4) continue;
      const d = Math.sqrt(d2);
      const f = (1 - d / radius) * force * dt;
      this.vx[i] += dx / d * f;
      this.vy[i] += dy / d * f;
    }
  },

  update(dt) {
    const n = this.ox.length, C = this.cols, Rw = this.rows;
    const ox = this.ox, oy = this.oy, vx = this.vx, vy = this.vy;
    const tx = this.tmpx, ty = this.tmpy;

    // 近所とのつながり（波が伝わる）
    for (let r = 0; r < Rw; r++) {
      for (let c = 0; c < C; c++) {
        const i = r * C + c;
        let sx = 0, sy = 0, cnt = 0;
        if (c > 0)      { sx += ox[i-1]; sy += oy[i-1]; cnt++; }
        if (c < C - 1)  { sx += ox[i+1]; sy += oy[i+1]; cnt++; }
        if (r > 0)      { sx += ox[i-C]; sy += oy[i-C]; cnt++; }
        if (r < Rw - 1) { sx += ox[i+C]; sy += oy[i+C]; cnt++; }
        tx[i] = cnt ? sx / cnt - ox[i] : 0;
        ty[i] = cnt ? sy / cnt - oy[i] : 0;
      }
    }

    const stiff = 26;      // 元にもどろうとする力
    const coup = 70;       // 近所に引っぱられる力
    const damp = Math.exp(-3.4 * dt);
    const LIM = this.sp * 2.8;   // 本家はブラックホールに大きく引きちぎられる
    for (let i = 0; i < n; i++) {
      vx[i] += (-ox[i] * stiff + tx[i] * coup) * dt;
      vy[i] += (-oy[i] * stiff + ty[i] * coup) * dt;
      vx[i] *= damp; vy[i] *= damp;
      ox[i] += vx[i] * dt;
      oy[i] += vy[i] * dt;
      // 暴れすぎないように
      if (ox[i] > LIM) { ox[i] = LIM; vx[i] *= 0.4; } else if (ox[i] < -LIM) { ox[i] = -LIM; vx[i] *= 0.4; }
      if (oy[i] > LIM) { oy[i] = LIM; vy[i] *= 0.4; } else if (oy[i] < -LIM) { oy[i] = -LIM; vy[i] *= 0.4; }
    }
  },

  // 描画（横線と縦線）。ズレの大きいところほど明るく光る
  draw(baseCol, hotCol, pulse, calm) {
    const C = this.cols, Rw = this.rows;
    const ox = this.ox, oy = this.oy;
    const w = this.sp * 0.048;
    const g0 = 0.26 + pulse * 0.14;
    const px = this.px, py = this.py;
    for (let i = 0; i < C * Rw; i++) {
      px[i] = this.restX(i) + ox[i];
      py[i] = this.restY(i) + oy[i];
    }
    const col = [0, 0, 0];
    for (let r = 0; r < Rw; r++) {
      for (let c = 0; c < C; c++) {
        const i = r * C + c;
        const disp = Math.min(1, (Math.abs(ox[i]) + Math.abs(oy[i])) / (this.sp * 1.1));
        const t = disp * disp;
        col[0] = baseCol[0] + (hotCol[0] - baseCol[0]) * t;
        col[1] = baseCol[1] + (hotCol[1] - baseCol[1]) * t;
        col[2] = baseCol[2] + (hotCol[2] - baseCol[2]) * t;
        // ゆがみで少しだけ明るくする。ここを強くすると 画面が真っ白になって
        // 主役（ジェイドとバグ）が 見えなくなる（2026-08-19 実測で確認）
        const glow = g0 + t * (calm ? 0.32 : 0.52);
        if (c < C - 1) R.line(px[i], py[i], px[i+1], py[i+1], col, w + t * w * 0.9, glow);
        if (r < Rw - 1) R.line(px[i], py[i], px[i+C], py[i+C], col, w + t * w * 0.9, glow);
      }
    }
  },
};
