// ============================================================
// renderer.js — 自作WebGL2レンダラ
//   背景 → 盤面(不透明) → 反射/ゴースト(半透明) → パーティクル(加算)
//   → ブライト → ブラー(2段+横スジ) → 合成(トーンマップ/色収差/衝撃波)
// ============================================================
'use strict';

const BOARD_W = 10, BOARD_H = 20;

// セル座標 → ワールド座標
const cellX = c => c - (BOARD_W - 1) / 2;          // -4.5 .. 4.5
const cellY = r => (BOARD_H - 1) / 2 - r;          //  9.5 .. -9.5
const FLOOR_Y = -BOARD_H / 2 - 3.60;               // 応援ステージの床（反射の鏡面）

const INST_STRIDE = 17;   // pos3 scale3 color3 param4 rot4
const PART_STRIDE = 11;   // pos3 color4 attr4

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = this.gl = createGL(canvas);
    if (!gl) throw new Error('WebGL2 が使えません');

    this.progBg    = makeProgram(gl, SH.quadVS, SH.bgFS, 'bg');
    this.progBlock = makeProgram(gl, SH.blockVS, SH.blockFS, 'block');
    this.progPart  = makeProgram(gl, SH.partVS, SH.partFS, 'part');
    this.progBright= makeProgram(gl, SH.quadVS, SH.brightFS, 'bright');
    this.progBlur  = makeProgram(gl, SH.quadVS, SH.blurFS, 'blur');
    this.progComp  = makeProgram(gl, SH.quadVS, SH.compositeFS, 'comp');

    // --- ジオメトリ ---
    const cube = cubeGeometry();
    this.cubeIdxCount = cube.idx.length;
    this.bufPos = makeBuffer(gl, cube.pos);
    this.bufNrm = makeBuffer(gl, cube.nrm);
    this.bufTan = makeBuffer(gl, cube.tan);
    this.bufBit = makeBuffer(gl, cube.bit);
    this.bufUv  = makeBuffer(gl, cube.uv);
    this.bufIdx = makeBuffer(gl, cube.idx, gl.ELEMENT_ARRAY_BUFFER);
    this.bufCorner = makeBuffer(gl, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]));

    // --- インスタンス ---
    this.maxInst = 4096;
    this.instData = new Float32Array(this.maxInst * INST_STRIDE);
    this.instCount = 0;
    this.bufInst = makeBuffer(gl, this.instData, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);

    this.maxPart = 2600;
    this.partData = new Float32Array(this.maxPart * PART_STRIDE);
    this.bufPart = makeBuffer(gl, this.partData, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
    this.parts = [];
    this.partPool = [];

    this.vaoBlock = gl.createVertexArray();
    this.vaoPart  = gl.createVertexArray();
    this.vaoEmpty = gl.createVertexArray();

    this.quality = 1;          // 1 = 最高、下げるほど軽い
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.fbos = {};
    this.resize(true);

    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => location.reload());
  }

  // ------------------------------------------------------------
  // サイズ
  // ------------------------------------------------------------
  resize(force) {
    const gl = this.gl, cv = this.canvas;
    const cssW = cv.clientWidth || window.innerWidth;
    const cssH = cv.clientHeight || window.innerHeight;
    let scale = this.dpr * this.quality;
    // ピクセル数の上限（モバイルGPU保護）
    const maxPix = 2_400_000;
    if (cssW * cssH * scale * scale > maxPix) scale = Math.sqrt(maxPix / (cssW * cssH));
    const w = Math.max(2, Math.round(cssW * scale));
    const h = Math.max(2, Math.round(cssH * scale));
    if (!force && w === cv.width && h === cv.height) return;
    cv.width = w; cv.height = h;
    this.cssW = cssW; this.cssH = cssH;
    this.pxScale = w / cssW;

    for (const k in this.fbos) disposeFBO(gl, this.fbos[k]);
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    const qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2);
    this.fbos = {
      scene:  makeFBO(gl, w, h, { depth: true, hdr: true }),
      bright: makeFBO(gl, hw, hh, { hdr: true }),
      blurA:  makeFBO(gl, hw, hh, { hdr: true }),
      blurB:  makeFBO(gl, hw, hh, { hdr: true }),
      qA:     makeFBO(gl, qw, qh, { hdr: true }),
      qB:     makeFBO(gl, qw, qh, { hdr: true }),
      streak: makeFBO(gl, qw, qh, { hdr: true }),
    };
  }

  setQuality(q) {
    if (Math.abs(q - this.quality) < 0.01) return;
    this.quality = q;
    this.resize(true);
  }

  // CSSピクセルの矩形 → WebGLのビューポート（左下原点）
  vpRect(r) {
    const s = this.pxScale;
    return [
      Math.round(r.x * s),
      Math.round((this.cssH - r.y - r.h) * s),
      Math.max(1, Math.round(r.w * s)),
      Math.max(1, Math.round(r.h * s)),
    ];
  }

  // ------------------------------------------------------------
  // インスタンス登録
  // ------------------------------------------------------------
  clearInstances() { this.instCount = 0; }

  addBlock(x, y, z, sx, sy, sz, col, emis, alpha, edge, seed, rx, ry, rz) {
    if (this.instCount >= this.maxInst) return;
    const d = this.instData, o = this.instCount * INST_STRIDE;
    d[o] = x; d[o+1] = y; d[o+2] = z;
    d[o+3] = sx; d[o+4] = sy; d[o+5] = sz;
    d[o+6] = col[0]; d[o+7] = col[1]; d[o+8] = col[2];
    d[o+9] = emis; d[o+10] = alpha; d[o+11] = edge; d[o+12] = seed || 0;
    d[o+13] = rx || 0; d[o+14] = ry || 0; d[o+15] = rz || 0; d[o+16] = 0;
    return this.instCount++;
  }

  uploadInstances() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInst);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instData, 0, this.instCount * INST_STRIDE);
  }

  bindBlockVAO(base) {
    const gl = this.gl, a = this.progBlock.a, st = INST_STRIDE * 4, o = base * st;
    gl.bindVertexArray(this.vaoBlock);
    attrib(gl, a.aPos, this.bufPos, 3);
    attrib(gl, a.aNrm, this.bufNrm, 3);
    attrib(gl, a.aTan, this.bufTan, 3);
    attrib(gl, a.aBit, this.bufBit, 3);
    attrib(gl, a.aUv,  this.bufUv,  2);
    attrib(gl, a.iPos,   this.bufInst, 3, 1, st, o);
    attrib(gl, a.iScale, this.bufInst, 3, 1, st, o + 12);
    attrib(gl, a.iColor, this.bufInst, 3, 1, st, o + 24);
    attrib(gl, a.iParam, this.bufInst, 4, 1, st, o + 36);
    attrib(gl, a.iRot,   this.bufInst, 4, 1, st, o + 52);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
  }

  drawBlocks(base, count) {
    if (count <= 0) return;
    const gl = this.gl;
    this.bindBlockVAO(base);
    gl.drawElementsInstanced(gl.TRIANGLES, this.cubeIdxCount, gl.UNSIGNED_SHORT, 0, count);
  }

  // ------------------------------------------------------------
  // パーティクル
  // ------------------------------------------------------------
  spawn(o) {
    if (this.parts.length >= this.maxPart) return;
    const p = this.partPool.pop() || {};
    p.x = o.x; p.y = o.y; p.z = o.z || 0;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.g = o.g === undefined ? -22 : o.g;
    p.drag = o.drag === undefined ? 1.4 : o.drag;
    p.life = 0; p.max = o.life || 0.7;
    p.size = o.size || 0.3; p.size1 = o.size1 === undefined ? 0 : o.size1;
    p.r = o.col[0]; p.g_ = o.col[1]; p.b = o.col[2];
    p.a = o.alpha === undefined ? 1 : o.alpha;
    p.kind = o.kind || 0;
    p.rot = o.rot || 0; p.spin = o.spin || 0;
    p.aspect = o.aspect || 1;
    p.fade = o.fade || 'out';
    this.parts.push(p);
  }

  burst(x, y, z, col, n, opt = {}) {
    const spd = opt.speed || 9;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.5) * 1.6;
      const s = spd * (0.35 + Math.random() * 0.9);
      this.spawn({
        x: x + rnd(-0.3, 0.3), y: y + rnd(-0.3, 0.3), z: z + rnd(-0.2, 0.4),
        vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.9 + (opt.up || 0), vz: e * s * 0.4,
        drag: opt.drag === undefined ? 0.7 : opt.drag,
        col, life: rnd(0.35, 0.85) * (opt.life || 1),
        size: rnd(0.16, 0.42) * (opt.size || 1),
        kind: Math.random() < 0.22 ? 3 : 0,
        g: opt.g === undefined ? -20 : opt.g,
      });
    }
  }

  updateParts(dt) {
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) { ps.splice(i, 1); this.partPool.push(p); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vz *= k;
      p.vy = (p.vy + p.g * dt) * k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
    }
  }

  buildPartBuffer() {
    const d = this.partData, ps = this.parts;
    let n = 0;
    for (let i = 0; i < ps.length && n < this.maxPart; i++) {
      const p = ps[i];
      const t = p.life / p.max;
      let a = p.a;
      if (p.fade === 'out') a *= (1 - t) * (1 - t);
      else if (p.fade === 'inout') a *= Math.sin(Math.PI * t);
      const size = p.size1 ? lerp(p.size, p.size1, easeOut(t)) : p.size * (1 + t * 0.35);
      const o = n * PART_STRIDE;
      d[o] = p.x; d[o+1] = p.y; d[o+2] = p.z;
      d[o+3] = p.r; d[o+4] = p.g_; d[o+5] = p.b; d[o+6] = a;
      d[o+7] = size; d[o+8] = p.kind; d[o+9] = p.rot; d[o+10] = p.aspect;
      n++;
    }
    this.partDrawCount = n;
    if (n) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufPart);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * PART_STRIDE);
    }
  }

  // ------------------------------------------------------------
  // カメラ：盤面が指定の画面矩形に収まるように距離を決める
  // ------------------------------------------------------------
  makeCamera(rect, cam) {
    const aspect = rect.w / rect.h;
    const fov = 46 * Math.PI / 180;
    const halfH = (cam.halfH || BOARD_H / 2 + 1.0) * (cam.zoom || 1);
    const halfW = (cam.halfW || BOARD_W / 2 + 0.9) * (cam.zoom || 1);
    const th = Math.tan(fov / 2);
    const dV = halfH / th;
    const dH = halfW / (th * aspect);
    const dist = Math.max(dV, dH);

    const pitch = (cam.pitch || 0);
    const yaw = (cam.yaw || 0);
    const ty = cam.targetY || 0;
    const eye = [
      Math.sin(yaw) * Math.cos(pitch) * dist + (cam.shakeX || 0),
      Math.sin(pitch) * dist + ty + (cam.shakeY || 0),
      Math.cos(yaw) * Math.cos(pitch) * dist,
    ];
    const target = [(cam.shakeX || 0) * 0.35, ty + (cam.shakeY || 0) * 0.35, 0];
    const roll = cam.roll || 0;
    const up = [Math.sin(roll), Math.cos(roll), 0];
    const proj = M4.perspective(fov, aspect, 0.5, 260);
    const view = M4.lookAt(eye, target, up);
    return { vp: M4.mul(proj, view), eye, right: [Math.cos(roll), Math.sin(roll), 0], up };
  }

  makeHudCamera(rect, spin) {
    const aspect = rect.w / rect.h;
    const fov = 34 * Math.PI / 180;
    const dist = 8.2;
    const eye = [Math.sin(spin) * dist * 0.42, 2.4, Math.cos(spin) * dist];
    const proj = M4.perspective(fov, aspect, 0.5, 60);
    const view = M4.lookAt(eye, [0, 0, 0], [0, 1, 0]);
    return { vp: M4.mul(proj, view), eye };
  }

  // ------------------------------------------------------------
  // 描画
  // ------------------------------------------------------------
  render(o) {
    const gl = this.gl;
    if (this.lost) return;
    const F = this.fbos;
    const W = this.canvas.width, H = this.canvas.height;

    this.uploadInstances();
    this.buildPartBuffer();

    // ---------- シーン ----------
    gl.bindFramebuffer(gl.FRAMEBUFFER, F.scene.fb);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 背景（全画面・深度書き込みなし）
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.useProgram(this.progBg.p);
    gl.bindVertexArray(this.vaoEmpty);
    const ub = this.progBg.u;
    gl.uniform2f(ub.uRes, W, H);
    gl.uniform1f(ub.uTime, o.time);
    gl.uniform1f(ub.uHue, o.bg.hue);
    gl.uniform1f(ub.uPulse, o.bg.pulse);
    gl.uniform1f(ub.uSpeed, o.bg.speed);
    gl.uniform1f(ub.uDanger, o.bg.danger);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 盤面
    const vp = this.vpRect(o.rect);
    gl.viewport(vp[0], vp[1], vp[2], vp[3]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);

    const cam = this.makeCamera(o.rect, o.cam);
    this.lastCam = cam;
    gl.useProgram(this.progBlock.p);
    const ublk = this.progBlock.u;
    gl.uniformMatrix4fv(ublk.uVP, false, cam.vp);
    gl.uniform3fv(ublk.uEye, cam.eye);
    gl.uniform1f(ublk.uTime, o.time);
    this.drawBlocks(o.groups.opaque[0], o.groups.opaque[1]);

    // 半透明（反射・ゴースト）
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    this.drawBlocks(o.groups.trans[0], o.groups.trans[1]);

    // パーティクル（加算）
    if (this.partDrawCount) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.useProgram(this.progPart.p);
      const up = this.progPart.u, ap = this.progPart.a;
      gl.uniformMatrix4fv(up.uVP, false, cam.vp);
      gl.uniform3fv(up.uRight, cam.right);
      gl.uniform3fv(up.uUp, cam.up);
      gl.bindVertexArray(this.vaoPart);
      attrib(gl, ap.aCorner, this.bufCorner, 2);
      const st = PART_STRIDE * 4;
      attrib(gl, ap.iPos,   this.bufPart, 3, 1, st, 0);
      attrib(gl, ap.iColor, this.bufPart, 4, 1, st, 12);
      attrib(gl, ap.iAttr,  this.bufPart, 4, 1, st, 28);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.partDrawCount);
    }

    // HUD の 3D ピース
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.progBlock.p);
    gl.depthMask(true);
    for (const s of o.slots) {
      if (!s.count) continue;
      const r = this.vpRect(s.rect);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(r[0], r[1], r[2], r[3]);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.viewport(r[0], r[1], r[2], r[3]);
      const hc = this.makeHudCamera(s.rect, s.spin);
      gl.uniformMatrix4fv(ublk.uVP, false, hc.vp);
      gl.uniform3fv(ublk.uEye, hc.eye);
      this.drawBlocks(s.base, s.count);
      gl.disable(gl.SCISSOR_TEST);
    }

    // ---------- ポスト ----------
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vaoEmpty);

    // ブライトパス
    this.pass(this.progBright, F.bright, u => {
      gl.uniform1i(u.uTex, 0);
      this.tex(F.scene.tex, 0);
      gl.uniform1f(u.uThreshold, o.post.threshold);
      gl.uniform1f(u.uKnee, 1.0);
    });

    // 1/2 でぼかし
    this.blur(F.bright, F.blurA, F.blurB, 1.0);
    // 1/4 に落としてさらにぼかし（広がる光）
    this.pass(this.progBright, F.qA, u => {
      gl.uniform1i(u.uTex, 0); this.tex(F.blurB.tex, 0);
      gl.uniform1f(u.uThreshold, 0.0); gl.uniform1f(u.uKnee, 1.0);
    });
    this.blur(F.qA, F.qB, F.qA, 2.0);
    // アナモルフィックな横スジ（横だけ強くぼかす）
    this.pass(this.progBlur, F.streak, u => {
      gl.uniform1i(u.uTex, 0); this.tex(F.qA.tex, 0);
      gl.uniform2f(u.uDir, 3.0 / F.streak.w, 0);
    });
    this.pass(this.progBlur, F.qB, u => {
      gl.uniform1i(u.uTex, 0); this.tex(F.streak.tex, 0);
      gl.uniform2f(u.uDir, 7.0 / F.streak.w, 0);
    });
    this.pass(this.progBlur, F.streak, u => {
      gl.uniform1i(u.uTex, 0); this.tex(F.qB.tex, 0);
      gl.uniform2f(u.uDir, 13.0 / F.streak.w, 0);
    });

    // 合成
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.progComp.p);
    const uc = this.progComp.u;
    this.tex(F.scene.tex, 0);  gl.uniform1i(uc.uScene, 0);
    this.tex(F.blurB.tex, 1);  gl.uniform1i(uc.uBloom1, 1);
    this.tex(F.qA.tex, 2);     gl.uniform1i(uc.uBloom2, 2);
    this.tex(F.streak.tex, 3); gl.uniform1i(uc.uStreak, 3);
    gl.uniform2f(uc.uRes, W, H);
    gl.uniform1f(uc.uTime, o.time);
    gl.uniform1f(uc.uBloom, o.post.bloom);
    gl.uniform1f(uc.uCA, o.post.ca);
    gl.uniform1f(uc.uFlash, o.post.flash);
    gl.uniform3fv(uc.uFlashCol, o.post.flashCol);
    gl.uniform1f(uc.uVignette, o.post.vignette);
    gl.uniform1f(uc.uGrain, o.post.grain);
    gl.uniform4fv(uc.uShock, o.post.shock);
    gl.uniform1f(uc.uSat, o.post.sat);
    gl.uniform1f(uc.uFade, o.post.fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  tex(t, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
  }

  pass(prog, target, setup) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
    gl.viewport(0, 0, target.w, target.h);
    gl.useProgram(prog.p);
    setup(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  blur(src, tmp, dst, radius) {
    const gl = this.gl;
    this.pass(this.progBlur, tmp, u => {
      gl.uniform1i(u.uTex, 0); this.tex(src.tex, 0);
      gl.uniform2f(u.uDir, radius / tmp.w, 0);
    });
    this.pass(this.progBlur, dst, u => {
      gl.uniform1i(u.uTex, 0); this.tex(tmp.tex, 0);
      gl.uniform2f(u.uDir, 0, radius / dst.h);
    });
  }
}
