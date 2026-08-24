// ============================================================
// renderer.js — 描画のしくみ
//   ・背景（画像は使わない）
//   ・ゆか（模様はシェーダで直接描く）
//   ・かべ／にもつ／おきば（インスタンス描画。1種類につきドローコール2回）
//   ・オカン（部品ごとの剛体スキニング＋輪郭線）
//   ・接地影／つぶ
// ============================================================
'use strict';

// 部品の中心から外向きの法線をつける（輪郭線の押し出し用）
function withOutward(geo) {
  const n = geo.pos.length / 3;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += geo.pos[i * 3]; cy += geo.pos[i * 3 + 1]; cz += geo.pos[i * 3 + 2]; }
  cx /= n; cy /= n; cz /= n;
  const onrm = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x = geo.pos[i * 3] - cx, y = geo.pos[i * 3 + 1] - cy, z = geo.pos[i * 3 + 2] - cz;
    const L = Math.hypot(x, y, z) || 1;
    onrm[i * 3] = x / L; onrm[i * 3 + 1] = y / L; onrm[i * 3 + 2] = z / L;
  }
  geo.onrm = onrm;
  if (!geo.col) {
    geo.col = new Float32Array(n * 3).fill(1);
  }
  return geo;
}

class Renderer {
  constructor(canvas) {
    const gl = createGL(canvas);
    if (!gl) throw new Error('WebGL2 が使えません');
    this.canvas = canvas;
    this.gl = gl;
    this.dpr = 1;
    this.progMesh = makeProgram(gl, SH.meshVS, SH.meshFS, 'mesh');
    this.progOut = makeProgram(gl, SH.outlineVS, SH.outlineFS, 'outline');
    this.progInst = makeProgram(gl, SH.instVS, SH.instFS, 'inst');
    this.progInstOut = makeProgram(gl, SH.instOutlineVS, SH.outlineFS, 'instOutline');
    this.progFloor = makeProgram(gl, SH.floorVS, SH.floorFS, 'floor');
    this.progBg = makeProgram(gl, SH.bgVS, SH.bgFS, 'bg');
    this.progShadow = makeProgram(gl, SH.shadowVS, SH.shadowFS, 'shadow');
    this.progPart = makeProgram(gl, SH.partVS, SH.partFS, 'part');

    this.emptyVAO = gl.createVertexArray();

    // ゆか用の板（1x1）
    this.floorVAO = this._quadVAO(this.progFloor);
    this.shadowVAO = null;

    this.proj = M4.ident();
    this.view = M4.ident();
    this.camPos = [0, 0, 0];
    this.light = norm3([0.42, 0.86, 0.30]);
    this.time = 0;
    this.tint = [1, 1, 1];
    this.flash = 0;
  }

  _quadVAO(prog) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const pos = new Float32Array([0, 0, 0,  1, 0, 0,  1, 0, 1,  0, 0, 0,  1, 0, 1,  0, 0, 1]);
    const uv = new Float32Array([0, 0,  1, 0,  1, 1,  0, 0,  1, 1,  0, 1]);
    attrib(gl, prog.a.aPos, makeBuffer(gl, pos), 3);
    attrib(gl, prog.a.aUV, makeBuffer(gl, uv), 2);
    gl.bindVertexArray(null);
    return vao;
  }

  resize() {
    const gl = this.gl, c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5) * (this.quality || 1);
    const w = Math.max(2, Math.round(c.clientWidth * dpr));
    const h = Math.max(2, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.aspect = w / h;
    gl.viewport(0, 0, w, h);
  }

  camera(eye, target, fov = 42, up = [0, 1, 0]) {
    this.proj = M4.perspective(fov * Math.PI / 180, this.aspect, 0.15, 400);
    this.view = M4.lookAt(eye, target, up);
    this.camPos = eye;
  }

  // ---- 背景 ----
  bg(top, bot, cheer = 0) {
    const gl = this.gl, p = this.progBg;
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(p.p);
    gl.bindVertexArray(this.emptyVAO);
    gl.uniform3fv(p.u.uTop, top);
    gl.uniform3fv(p.u.uBot, bot);
    gl.uniform1f(p.u.uTime, this.time);
    gl.uniform1f(p.u.uCheer, cheer);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.DEPTH_BUFFER_BIT);
  }

  // ---- ゆか ----
  floor(originX, originZ, cols, rows, colA, colB, line) {
    const gl = this.gl, p = this.progFloor;
    gl.useProgram(p.p);
    gl.bindVertexArray(this.floorVAO);
    gl.uniformMatrix4fv(p.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(p.u.uView, false, this.view);
    gl.uniform3f(p.u.uOrigin, originX, 0, originZ);
    gl.uniform2f(p.u.uSize, cols, rows);
    gl.uniform3fv(p.u.uColA, colA);
    gl.uniform3fv(p.u.uColB, colB);
    gl.uniform3fv(p.u.uLine, line);
    gl.uniform1f(p.u.uTime, this.time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ---- インスタンス（かべ・にもつ・おきば） ----
  makeInstanced(geo, max, texImg) {
    const gl = this.gl;
    withOutward(geo);
    // ★バッファを作る前に VAO を はずす。
    //   ELEMENT_ARRAY_BUFFER の bind は「いま結ばれている VAO」に記録されるので、
    //   前のフレームの VAO が残ったまま作ると、そのVAOのインデックスが
    //   この新しいものに すりかわって、別のメッシュが ばらばらに散る。
    //   （キャラを途中で入れかえたとき ペットが 緑と紫の破片になった。実測）
    gl.bindVertexArray(null);
    const bufs = {
      pos: makeBuffer(gl, geo.pos), nrm: makeBuffer(gl, geo.nrm),
      onrm: makeBuffer(gl, geo.onrm), col: makeBuffer(gl, geo.col),
      uv: makeBuffer(gl, geo.uv || new Float32Array((geo.pos.length / 3) * 2)),
      idx: makeBuffer(gl, geo.idx, gl.ELEMENT_ARRAY_BUFFER),
    };
    const STRIDE = 11 * 4;
    const data = new Float32Array(max * 11);
    const ibuf = makeBuffer(gl, data, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);

    const mk = (prog, withNrm) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      attrib(gl, prog.a.aPos, bufs.pos, 3);
      if (withNrm) {
        attrib(gl, prog.a.aNrm, bufs.nrm, 3);
        attrib(gl, prog.a.aCol, bufs.col, 3);
        attrib(gl, prog.a.aUV, bufs.uv, 2);
      }
      attrib(gl, prog.a.aONrm, bufs.onrm, 3);
      attrib(gl, prog.a.iPos, ibuf, 3, 1, STRIDE, 0);
      attrib(gl, prog.a.iScale, ibuf, 3, 1, STRIDE, 12);
      attrib(gl, prog.a.iRot, ibuf, 1, 1, STRIDE, 24);
      attrib(gl, prog.a.iColor, ibuf, 3, 1, STRIDE, 28);
      attrib(gl, prog.a.iParam, ibuf, 1, 1, STRIDE, 40);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx);
      gl.bindVertexArray(null);
      return vao;
    };
    let tex = null;
    if (texImg) {
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // ★オカンの顔と違い、こちらは 上下ひっくり返さない（UVをこちらで作っているため）
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texImg);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    return {
      count: geo.idx.length,
      type: geo.idx.BYTES_PER_ELEMENT === 4 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      vao: mk(this.progInst, true),
      vaoOut: mk(this.progInstOut, false),
      ibuf, data, max, n: 0, tex,
    };
  }

  // list … [{x,y,z, sx,sy,sz, rot, col:[r,g,b], glow}]
  drawInstanced(m, list, opt = {}) {
    const gl = this.gl;
    const n = Math.min(list.length, m.max);
    for (let i = 0; i < n; i++) {
      const o = list[i], b = i * 11;
      m.data[b] = o.x; m.data[b + 1] = o.y; m.data[b + 2] = o.z;
      m.data[b + 3] = o.sx ?? 1; m.data[b + 4] = o.sy ?? o.sx ?? 1; m.data[b + 5] = o.sz ?? o.sx ?? 1;
      m.data[b + 6] = o.rot || 0;
      const c = o.col || [1, 1, 1];
      m.data[b + 7] = c[0]; m.data[b + 8] = c[1]; m.data[b + 9] = c[2];
      m.data[b + 10] = o.glow || 0;
    }
    if (!n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, m.ibuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, m.data, 0, n * 11);

    // 輪郭（表を切って裏を描く）
    if (opt.outline !== false) {
      const p = this.progInstOut;
      gl.useProgram(p.p);
      gl.bindVertexArray(m.vaoOut);
      gl.uniformMatrix4fv(p.u.uProj, false, this.proj);
      gl.uniformMatrix4fv(p.u.uView, false, this.view);
      gl.uniform1f(p.u.uOutline, opt.outlineWidth ?? 0.0035);
      gl.uniform1f(p.u.uAspect, this.aspect);
      gl.uniform3fv(p.u.uOutlineCol, opt.outlineCol || [0.16, 0.11, 0.10]);
      gl.cullFace(gl.FRONT);
      gl.drawElementsInstanced(gl.TRIANGLES, m.count, m.type, 0, n);
      gl.cullFace(gl.BACK);
    }
    const p = this.progInst;
    gl.useProgram(p.p);
    gl.bindVertexArray(m.vao);
    gl.uniformMatrix4fv(p.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(p.u.uView, false, this.view);
    gl.uniform3fv(p.u.uLightDir, this.light);
    gl.uniform3fv(p.u.uCamPos, this.camPos);
    gl.uniform3fv(p.u.uShadowTint, opt.shadowTint || [0.72, 0.70, 0.82]);
    gl.uniform3fv(p.u.uRimCol, opt.rimCol || [1.0, 0.92, 0.86]);
    gl.uniform1f(p.u.uRimAmt, opt.rim ?? 0.12);
    gl.uniform2f(p.u.uToonEdge, 0.36, 0.62);
    gl.uniform3fv(p.u.uTint, this.tint);
    gl.uniform1f(p.u.uTime, this.time);
    gl.uniform1f(p.u.uUseTex, m.tex ? 1 : 0);
    if (m.tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, m.tex);
      gl.uniform1i(p.u.uTex, 0);
    }
    gl.drawElementsInstanced(gl.TRIANGLES, m.count, m.type, 0, n);
  }

  // ---- 骨つきメッシュ（オカン） ----
  makeMesh(data, tex) {
    const gl = this.gl;
    // ★バッファを作る前に VAO を はずす。
    //   ELEMENT_ARRAY_BUFFER の bind は「いま結ばれている VAO」に記録されるので、
    //   前のフレームの VAO が残ったまま作ると、そのVAOのインデックスが
    //   この新しいものに すりかわって、別のメッシュが ばらばらに散る。
    //   （キャラを途中で入れかえたとき ペットが 緑と紫の破片になった。実測）
    gl.bindVertexArray(null);
    const bufs = {
      pos: makeBuffer(gl, data.pos), nrm: makeBuffer(gl, data.nrm),
      onrm: makeBuffer(gl, data.onrm), uv: makeBuffer(gl, data.uv),
      col: makeBuffer(gl, data.col), param: makeBuffer(gl, data.param),
      bone: makeBuffer(gl, data.bone),
      // ★3本目・4本目の骨。無いモデル（手組みオカン）は 重み0で埋める
      bone2: makeBuffer(gl, data.bone2 || new Float32Array(data.bone.length)),
      idx: makeBuffer(gl, data.idx, gl.ELEMENT_ARRAY_BUFFER),
    };
    const mk = (prog, full) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      attrib(gl, prog.a.aPos, bufs.pos, 3);
      attrib(gl, prog.a.aONrm, bufs.onrm, 3);
      attrib(gl, prog.a.aBone, bufs.bone, 4);
      attrib(gl, prog.a.aBone2, bufs.bone2, 4);
      if (full) {
        attrib(gl, prog.a.aNrm, bufs.nrm, 3);
        attrib(gl, prog.a.aUV, bufs.uv, 2);
        attrib(gl, prog.a.aCol, bufs.col, 3);
        attrib(gl, prog.a.aParam, bufs.param, 4);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx);
      gl.bindVertexArray(null);
      return vao;
    };
    let texture = null;
    if (tex) {
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // ★これが無いと 顔の絵が上下さかさまに貼りつく（チッチで踏んだ）
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    return {
      count: data.count,
      type: data.idx.BYTES_PER_ELEMENT === 4 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      vao: mk(this.progMesh, true), vaoOut: mk(this.progOut, false), tex: texture,
    };
  }

  // テクスチャの一部だけ 貼りかえる（表情の差しかえ用）
  // ★もとのテクスチャは UNPACK_FLIP_Y_WEBGL=true で貼ってある。
  //   つまり GPU の行0は 絵の一番下。上下をそろえるため、
  //   貼る位置は 下から数えた y にする（ここを間違えると 顔が別の場所に出る）。
  updateTexRect(mesh, img, x, y, texH) {
    const gl = this.gl;
    if (!mesh || !mesh.tex || !img) return;
    gl.bindTexture(gl.TEXTURE_2D, mesh.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const yo = texH - y - img.height;
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, yo, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  drawMesh(mesh, bones, opt = {}) {
    const gl = this.gl;
    const B = new Float32Array(SH.BONES * 16);
    const BN = new Float32Array(SH.BONES * 16);
    const tmp = new Float32Array(16);
    for (let i = 0; i < SH.BONES; i++) {
      const m = bones[i] || M4.ident();
      B.set(m, i * 16);
      M4.normalMat(m, tmp);
      BN.set(tmp, i * 16);
    }
    const model = opt.model || M4.ident();
    const modelN = M4.normalMat(model, new Float32Array(16));

    // 輪郭
    if (opt.outline !== false) {
      const p = this.progOut;
      gl.useProgram(p.p);
      gl.bindVertexArray(mesh.vaoOut);
      gl.uniformMatrix4fv(p.u.uProj, false, this.proj);
      gl.uniformMatrix4fv(p.u.uView, false, this.view);
      gl.uniformMatrix4fv(p.u.uModel, false, model);
      gl.uniformMatrix4fv(p.u.uModelN, false, modelN);
      gl.uniformMatrix4fv(p.u.uBones, false, B);
      gl.uniformMatrix4fv(p.u.uBonesN, false, BN);
      gl.uniform1f(p.u.uOutline, opt.outlineWidth ?? 0.0042);
      gl.uniform1f(p.u.uAspect, this.aspect);
      gl.uniform3fv(p.u.uOutlineCol, opt.outlineCol || [0.16, 0.10, 0.09]);
      gl.cullFace(gl.FRONT);
      gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
      gl.cullFace(gl.BACK);
    }

    const p = this.progMesh;
    gl.useProgram(p.p);
    gl.bindVertexArray(mesh.vao);
    gl.uniformMatrix4fv(p.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(p.u.uView, false, this.view);
    gl.uniformMatrix4fv(p.u.uModel, false, model);
    gl.uniformMatrix4fv(p.u.uModelN, false, modelN);
    gl.uniformMatrix4fv(p.u.uBones, false, B);
    gl.uniformMatrix4fv(p.u.uBonesN, false, BN);
    gl.uniform3fv(p.u.uLightDir, this.light);
    gl.uniform3fv(p.u.uCamPos, this.camPos);
    gl.uniform3fv(p.u.uShadowTint, opt.shadowTint || [0.80, 0.76, 0.88]);
    gl.uniform3fv(p.u.uRimCol, opt.rimCol || [1.0, 0.92, 0.88]);
    gl.uniform1f(p.u.uRimAmt, opt.rim ?? 0.20);
    // 影の境目はやわらかく。かたくすると顔が不気味になる（チッチの教訓）
    gl.uniform2f(p.u.uToonEdge, 0.40, 0.70);
    gl.uniform1f(p.u.uFlash, opt.flash || 0);
    gl.uniform3fv(p.u.uTint, this.tint);
    if (mesh.tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mesh.tex);
      gl.uniform1i(p.u.uTex, 0);
    }
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0);
  }

  // ---- 接地影 ----
  initShadows(max = 128) {
    const gl = this.gl, p = this.progShadow;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const pos = new Float32Array([-0.5, 0, -0.5,  0.5, 0, -0.5,  0.5, 0, 0.5,
                                  -0.5, 0, -0.5,  0.5, 0, 0.5,  -0.5, 0, 0.5]);
    attrib(gl, p.a.aPos, makeBuffer(gl, pos), 3);
    const data = new Float32Array(max * 6);
    const ibuf = makeBuffer(gl, data, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
    attrib(gl, p.a.iPos, ibuf, 3, 1, 24, 0);
    attrib(gl, p.a.iScale, ibuf, 3, 1, 24, 12);
    gl.bindVertexArray(null);
    this.shadowVAO = { vao, ibuf, data, max };
  }

  drawShadows(list, alpha = 0.30, col = [0.30, 0.22, 0.28]) {
    const gl = this.gl, s = this.shadowVAO, p = this.progShadow;
    if (!s) return;
    const n = Math.min(list.length, s.max);
    for (let i = 0; i < n; i++) {
      const o = list[i], b = i * 6;
      s.data[b] = o.x; s.data[b + 1] = o.y; s.data[b + 2] = o.z;
      s.data[b + 3] = o.r; s.data[b + 4] = 1; s.data[b + 5] = o.r;
    }
    if (!n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, s.ibuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.data, 0, n * 6);
    gl.useProgram(p.p);
    gl.bindVertexArray(s.vao);
    gl.uniformMatrix4fv(p.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(p.u.uView, false, this.view);
    gl.uniform1f(p.u.uAlpha, alpha);
    gl.uniform3fv(p.u.uCol, col);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  // ---- つぶ ----
  initParticles(max = 400) {
    const gl = this.gl, p = this.progPart;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const data = new Float32Array(max * 8);
    const ibuf = makeBuffer(gl, data, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
    attrib(gl, p.a.iPos, ibuf, 3, 1, 32, 0);
    attrib(gl, p.a.iSize, ibuf, 1, 1, 32, 12);
    attrib(gl, p.a.iColor, ibuf, 3, 1, 32, 16);
    attrib(gl, p.a.iAlpha, ibuf, 1, 1, 32, 28);
    gl.bindVertexArray(null);
    this.partVAO = { vao, ibuf, data, max };
  }

  drawParticles(list) {
    const gl = this.gl, s = this.partVAO, p = this.progPart;
    if (!s || !list.length) return;
    const n = Math.min(list.length, s.max);
    for (let i = 0; i < n; i++) {
      const o = list[i], b = i * 8;
      s.data[b] = o.x; s.data[b + 1] = o.y; s.data[b + 2] = o.z;
      s.data[b + 3] = o.size;
      s.data[b + 4] = o.col[0]; s.data[b + 5] = o.col[1]; s.data[b + 6] = o.col[2];
      s.data[b + 7] = o.alpha;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, s.ibuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.data, 0, n * 8);
    gl.useProgram(p.p);
    gl.bindVertexArray(s.vao);
    gl.uniformMatrix4fv(p.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(p.u.uView, false, this.view);
    gl.uniform1f(p.u.uPix, this.canvas.height * 0.55);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.drawArraysInstanced(gl.POINTS, 0, 1, n);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}

function norm3(v) {
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
}
