// ============================================================
// renderer.js — 描画パス一式
//   背景 → 線分（全オブジェクト1ドロー） → 明部抽出 → ぼかし2段 → 合成
//
//   使い方:
//     R.init(canvas);
//     R.beginFrame(cam);           // cam = {x,y,w,h}
//     R.line(x0,y0,x1,y1, col, w, glow);
//     R.endFrame(post);            // post = {ca, bloom, flash, ...}
// ============================================================
'use strict';

const R = {
  gl: null,
  canvas: null,
  W: 0, H: 0,            // 実際のバックバッファ画素
  quality: 1.0,          // 0.55〜1.0
  dprCap: 2.0,
  fbo: {},
  mips: [],
  MIPS: 6,
  bloomRadius: 1.0,
  // 描くグループごとに切りかえる「明るさの予算」
  //   グリッドは暗く芯なし／主役は熱く芯あり。ここが本家GW2との いちばんの差だった
  glowMul: 1.0,
  coreMul: 1.0,
  bloomGain: 0.26,
  progs: {},
  inst: null,
  cam: { x: 0, y: 0, w: 1600, h: 900 },
  shocks: [],            // {x,y,t,life,strength}
  _proj: new Float32Array(16),
  _shockUni: new Float32Array(16),
  ok: false,

  // ---------------- 初期化 ----------------
  init(canvas) {
    this.canvas = canvas;
    const gl = createGL(canvas);
    if (!gl) return false;
    this.gl = gl;

    this.progs.line = makeProgram(gl, SH.lineVS, SH.lineFS, 'line');
    this.progs.bg = makeProgram(gl, SH.quadVS, SH.bgFS, 'bg');
    this.progs.down = makeProgram(gl, SH.quadVS, SH.downFS, 'down');
    this.progs.up = makeProgram(gl, SH.quadVS, SH.upFS, 'up');
    this.progs.comp = makeProgram(gl, SH.quadVS, SH.compFS, 'comp');

    // 画面いっぱいの三角形2枚
    this.quadBuf = makeBuffer(gl, new Float32Array([-1,-1, 3,-1, -1,3]));
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    attrib(gl, 0, this.quadBuf, 2);
    gl.bindVertexArray(null);

    // 線分1本ぶんの四角（トライアングルストリップ）
    // x: 0..1 進行方向 / y: -1..1 横
    this.cornerBuf = makeBuffer(gl, new Float32Array([0,-1, 1,-1, 0,1, 1,1]));

    // インスタンス: p0(2) p1(2) col(3) w(1) glow(1) core(1) = 10 floats
    this.inst = new InstanceBuffer(gl, 10, 28000);
    const a = this.progs.line.a;
    this.lineVAO = gl.createVertexArray();
    gl.bindVertexArray(this.lineVAO);
    attrib(gl, 0, this.cornerBuf, 2);
    const S = 10 * 4;
    attrib(gl, a.i_p0,   this.inst.buf, 2, 1, S, 0);
    attrib(gl, a.i_p1,   this.inst.buf, 2, 1, S, 8);
    attrib(gl, a.i_col,  this.inst.buf, 3, 1, S, 16);
    attrib(gl, a.i_w,    this.inst.buf, 1, 1, S, 28);
    attrib(gl, a.i_glow, this.inst.buf, 1, 1, S, 32);
    attrib(gl, a.i_core, this.inst.buf, 1, 1, S, 36);
    gl.bindVertexArray(null);

    this.resize();
    this.ok = true;
    return true;
  },

  // ---------------- 解像度 ----------------
  resize() {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    const W = Math.max(320, Math.round(cw * dpr * this.quality));
    const H = Math.max(200, Math.round(ch * dpr * this.quality));
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.canvas.width = W;
    this.canvas.height = H;

    for (const k in this.fbo) disposeFBO(gl, this.fbo[k]);
    for (const m of this.mips) disposeFBO(gl, m);
    this.fbo = {};
    this.fbo.scene = makeFBO(gl, W, H, { hdr: true });

    // 光のにじみ用のミップ列（1/2 → 1/64）。段数は画面の小さいほうで決める
    this.mips = [];
    let mw = W, mh = H;
    for (let i = 0; i < this.MIPS; i++) {
      mw = Math.max(4, mw >> 1); mh = Math.max(4, mh >> 1);
      this.mips.push(makeFBO(gl, mw, mh, { hdr: true }));
      if (mw <= 8 || mh <= 8) break;
    }
  },

  setQuality(q) {
    q = clamp(q, 0.5, 1.0);
    if (Math.abs(q - this.quality) < 0.04) return;
    this.quality = q;
    this.W = this.H = 0;   // 作り直させる
    this.resize();
  },

  // ---------------- カメラ ----------------
  beginFrame(cam) {
    this.cam.x = cam.x; this.cam.y = cam.y;
    this.cam.w = cam.w; this.cam.h = cam.h;
    this.inst.reset();
  },

  // ---------------- 線を積む ----------------
  // col = [r,g,b] (0..1)、w = にじみ半径（ワールド）、glow = 明るさ
  line(x0, y0, x1, y1, col, w, glow) {
    const i = this.inst.alloc();
    if (i < 0) return;
    const d = this.inst.data;
    d[i] = x0; d[i+1] = y0; d[i+2] = x1; d[i+3] = y1;
    d[i+4] = col[0]; d[i+5] = col[1]; d[i+6] = col[2];
    d[i+7] = w; d[i+8] = glow * this.glowMul; d[i+9] = this.coreMul;
  },

  dot(x, y, col, w, glow) { this.line(x, y, x, y, col, w, glow); },

  // 折れ線（pts = [x0,y0,x1,y1,...]、closed で最後と最初をつなぐ）
  poly(pts, x, y, rot, sc, col, w, glow, closed) {
    const cs = Math.cos(rot) * sc, sn = Math.sin(rot) * sc;
    const n = pts.length >> 1;
    let px = x + pts[0] * cs - pts[1] * sn;
    let py = y + pts[0] * sn + pts[1] * cs;
    const fx = px, fy = py;
    for (let k = 1; k < n; k++) {
      const ax = pts[k*2], ay = pts[k*2+1];
      const qx = x + ax * cs - ay * sn;
      const qy = y + ax * sn + ay * cs;
      this.line(px, py, qx, qy, col, w, glow);
      px = qx; py = qy;
    }
    if (closed) this.line(px, py, fx, fy, col, w, glow);
  },

  // 円（分割数を指定）
  circle(x, y, r, seg, col, w, glow, rot) {
    rot = rot || 0;
    let px = x + Math.cos(rot) * r, py = y + Math.sin(rot) * r;
    for (let k = 1; k <= seg; k++) {
      const a = rot + k / seg * TAU;
      const qx = x + Math.cos(a) * r, qy = y + Math.sin(a) * r;
      this.line(px, py, qx, qy, col, w, glow);
      px = qx; py = qy;
    }
  },

  // ---------------- 衝撃波 ----------------
  addShock(x, y, strength, life) {
    if (this.shocks.length > 6) this.shocks.shift();
    this.shocks.push({ x, y, t: 0, life: life || 0.55, s: strength });
  },

  updateShocks(dt) {
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.t += dt;
      if (s.t >= s.life) this.shocks.splice(i, 1);
    }
  },

  // ---------------- 仕上げ ----------------
  endFrame(post) {
    const gl = this.gl;
    const F = this.fbo;
    const W = this.W, H = this.H;

    // ---- 背景 ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, F.scene.fb);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.BLEND);
    const bp = this.progs.bg;
    gl.useProgram(bp.p);
    gl.bindVertexArray(this.quadVAO);
    gl.uniform1f(bp.u.u_time, post.time);
    gl.uniform1f(bp.u.u_danger, post.danger);
    gl.uniform1f(bp.u.u_beat, post.beat);
    gl.uniform2f(bp.u.u_res, W, H);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // ---- 線（加算合成で1ドロー）----
    const n = this.inst.upload();
    if (n > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      const lp = this.progs.line;
      gl.useProgram(lp.p);
      gl.bindVertexArray(this.lineVAO);
      // 正射影（ワールド → クリップ）
      const p = this._proj;
      p.fill(0);
      p[0] = 2 / this.cam.w;
      p[5] = 2 / this.cam.h;
      p[10] = -1;
      p[12] = -2 * this.cam.x / this.cam.w;
      p[13] = -2 * this.cam.y / this.cam.h;
      p[15] = 1;
      gl.uniformMatrix4fv(lp.u.u_proj, false, p);
      gl.uniform1f(lp.u.u_px, this.cam.w / W);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      gl.bindVertexArray(null);
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.quadVAO);

    // ---- 光のにじみ：ミップを落としながら しきい値をかける ----
    const dp = this.progs.down;
    gl.useProgram(dp.p);
    gl.uniform1f(dp.u.u_thresh, post.threshold);
    gl.uniform1f(dp.u.u_knee, post.knee === undefined ? 0.55 : post.knee);
    for (let i = 0; i < this.mips.length; i++) {
      const src = i === 0 ? F.scene : this.mips[i - 1];
      const dst = this.mips[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(dp.u.u_tex, 0);
      gl.uniform2f(dp.u.u_texel, 1 / src.w, 1 / src.h);
      gl.uniform1f(dp.u.u_first, i === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // ---- 小さいほうから 足しながら戻す（広い光の裾ができる）----
    const up = this.progs.up;
    gl.useProgram(up.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(up.u.u_radius, this.bloomRadius);
    for (let i = this.mips.length - 1; i > 0; i--) {
      const src = this.mips[i], dst = this.mips[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(up.u.u_tex, 0);
      gl.uniform2f(up.u.u_texel, 1 / src.w, 1 / src.h);
      gl.uniform1f(up.u.u_scale, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);

    // ---- 合成 ----
    const cp = this.progs.comp;
    gl.useProgram(cp.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, F.scene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.mips[0].tex);
    gl.uniform1i(cp.u.u_scene, 0);
    gl.uniform1i(cp.u.u_bloomTex, 1);
    gl.uniform1f(cp.u.u_time, post.time);
    gl.uniform1f(cp.u.u_ca, post.ca);
    gl.uniform1f(cp.u.u_bloom, post.bloom * this.bloomGain);
    gl.uniform1f(cp.u.u_flash, post.flash);
    gl.uniform3f(cp.u.u_flashCol, post.flashCol[0], post.flashCol[1], post.flashCol[2]);
    gl.uniform1f(cp.u.u_vig, post.vig);
    gl.uniform1f(cp.u.u_grain, post.grain);
    gl.uniform1f(cp.u.u_danger, post.danger);
    gl.uniform1f(cp.u.u_aspect, W / H);

    // 衝撃波（画面UVに変換して最大4個）
    const su = this._shockUni;
    su.fill(0);
    const cam = this.cam;
    for (let i = 0; i < Math.min(4, this.shocks.length); i++) {
      const s = this.shocks[i];
      const t = s.t / s.life;
      su[i*4]   = (s.x - cam.x) / cam.w + 0.5;
      su[i*4+1] = (s.y - cam.y) / cam.h + 0.5;
      su[i*4+2] = t * 0.75;
      su[i*4+3] = s.s * (1 - t) * (1 - t) * post.fxScale;
    }
    gl.uniform4fv(cp.u.u_shock, su);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  },

};
