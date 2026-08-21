// ============================================================
// renderer.js — 描画
//   ・空（プロシージャル。画像ファイルは使わない）
//   ・足場／アイテム（インスタンス描画。1種類につきドローコール2回＝本体＋輪郭）
//   ・チッチ（スキニング＋トゥーン＋背面法アウトライン）
//   ・接地影
// ============================================================
'use strict';

// 高度で移り変わる空。jump.js の J_SKY_TIERS をそのまま持ってきた。
const CJ_SKY_TIERS = [
  { min: 0,    top: '#4aa8e8', bot: '#bfe4ff' }, // 昼
  { min: 200,  top: '#3f86d8', bot: '#ffd9a8' }, // 日が傾く
  { min: 380,  top: '#8a4a86', bot: '#ff9e58' }, // 夕やけ
  { min: 560,  top: '#3a2358', bot: '#8a3f5a' }, // 薄暮
  { min: 780,  top: '#0e1230', bot: '#05060f' }, // 夜
  { min: 1500, top: '#0a0512', bot: '#000000' }, // 宇宙
  { min: 3000, top: '#050510', bot: '#000000' }, // 深宇宙
  { min: 4000, top: '#1a0806', bot: '#000000' }, // 火星の赤い光
  { min: 4700, top: '#3a1408', bot: '#120303' }, // 砂嵐
  // ここから先はエンドレスの深宇宙。太陽から遠ざかるほど、光が減っていく。
  { min: 5600,  top: '#140806', bot: '#050203' }, // 火星をはなれる
  { min: 6800,  top: '#0a0d18', bot: '#020308' }, // 小惑星帯〜木星。青みが差す
  { min: 9000,  top: '#080e1c', bot: '#010206' }, // 外がわの惑星。うんと暗い
  { min: 13000, top: '#04060f', bot: '#000000' }, // ヘリオポーズ。太陽はもう星のひとつ
  { min: 17000, top: '#020308', bot: '#000000' }, // 恒星間空間。ほんとうの暗闇
  { min: 30000, top: '#0b0518', bot: '#01000a' }, // 星雲の気配
  { min: 55000, top: '#140828', bot: '#03010c' }, // 大星雲のなか
  { min: 85000, top: '#06101f', bot: '#000208' }, // 銀河を出る
];

// ★空の色は「本当の高度」で決める。
//   進行度で決めていたころは、表示が「5km」なのにもう夜空だった。
//   本当は、空が黒くなるのは日が暮れるからではなく、上に空気が無くなるから。
//   高く行くほど、上は黒く・地平線ぎわだけ青く残る（実際の高高度写真のとおり）。
const CJ_AIR_TIERS = [
  { h: 0,      top: '#3f9adf', bot: '#a8d4f2' },  // 地上。ふつうの昼
  //  ★空を明るくしすぎない。白い雲の足場が抜けなくなる（実測1.5台だった）
  { h: 1200,   top: '#3689d6', bot: '#98c8ea' },  // 雲の高さ
  { h: 6000,   top: '#2568bd', bot: '#8cc3e8' },  // ヒコーキより上
  { h: 15000,  top: '#1b4f9e', bot: '#7fc0ea' },  // 成層圏。青が濃くなる
  { h: 35000,  top: '#0f2a63', bot: '#4a86c4' },
  { h: 60000,  top: '#071335', bot: '#20518c' },  // 上は黒。地平線だけ青い帯
  { h: 100000, top: '#02060f', bot: '#0b2447' },  // カーマンライン
  { h: 200000, top: '#01030a', bot: '#03101f' },
];

function cjTierLookup(tiers, key, v) {
  let i = 0;
  for (let k = 0; k < tiers.length; k++) if (v >= tiers[k][key]) i = k;
  const cur = tiers[i], nxt = tiers[i + 1];
  const a = hex2rgb(cur.top), b = hex2rgb(cur.bot);
  if (!nxt) return [a, b];
  const t = Math.min((v - cur[key]) / (nxt[key] - cur[key]), 1);
  const c = hex2rgb(nxt.top), d = hex2rgb(nxt.bot);
  return [
    [lerp(a[0],c[0],t), lerp(a[1],c[1],t), lerp(a[2],c[2],t)],
    [lerp(b[0],d[0],t), lerp(b[1],d[1],t), lerp(b[2],d[2],t)],
  ];
}

// m … 進行度（宇宙の色に使う）、h … 本当の高度[m]（空気の色に使う）
function cjSkyColors(m, h) {
  const space = cjTierLookup(CJ_SKY_TIERS, 'min', m);
  if (h === undefined) return space;
  const air = cjTierLookup(CJ_AIR_TIERS, 'h', h);
  // 高度10万m〜25万m で、空気の色から宇宙の色へ渡す
  const k = smoothstep(100000, 250000, h);
  return [
    [lerp(air[0][0], space[0][0], k), lerp(air[0][1], space[0][1], k), lerp(air[0][2], space[0][2], k)],
    [lerp(air[1][0], space[1][0], k), lerp(air[1][1], space[1][1], k), lerp(air[1][2], space[1][2], k)],
  ];
}

// biome を渡されなかったとき（プレビューなど）の空。星だけのふつうの宇宙。
const SKY_NONE = (function () {
  const o = cjBiomeOut();
  o.starAmt = 1; o.starDense = 1; o.starCol = [0.92, 0.95, 1.00];
  o.bandCol = [0.74, 0.78, 0.96]; o.nebScale = 1; o.nebGain = 1;
  o.galSize = 0.22; o.galSquash = 0.42; o.lensSize = 0.055;
  return o;
})();

const MAX_INST = 512;
const INST_STRIDE = 11;   // iInst(3) iScale(3) iRot(1) iColor(3) iParam(1)

class Renderer {
  constructor(canvas) {
    const gl = this.gl = createGL(canvas);
    if (!gl) throw new Error('WebGL2 が使えません');
    this.canvas = canvas;
    this.W = 0; this.H = 0;
    this.quality = 1;

    this.pSky   = makeProgram(gl, SH.quadVS, SH.skyFS, 'sky');
    this.pInst  = makeProgram(gl, SH.instVS, SH.instFS, 'inst');
    this.pInstO = makeProgram(gl, SH.instOutlineVS, SH.instOutlineFS, 'instOutline');
    this.pToon  = makeProgram(gl, SH.toonVS, SH.toonFS, 'toon');
    this.pOut   = makeProgram(gl, SH.outlineVS, SH.outlineFS, 'outline');
    this.pBlob  = makeProgram(gl, SH.blobVS, SH.blobFS, 'blob');

    this.vaoEmpty = gl.createVertexArray();
    this.blobBuf = makeBuffer(gl, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]));
    this.vaoBlob = gl.createVertexArray();
    gl.bindVertexArray(this.vaoBlob);
    attrib(gl, this.pBlob.a.aCorner, this.blobBuf, 2);
    gl.bindVertexArray(null);

    // インスタンス用の使い回しバッファ
    this.instData = new Float32Array(MAX_INST * INST_STRIDE);
    this.instBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.instData.byteLength, gl.DYNAMIC_DRAW);

    this.look = {
      lightDir: [-0.40, 0.74, 0.54],
      baseTint: [1, 1, 1],
      shadowTint: [0.82, 0.80, 0.94],
      toonEdge: [0.38, 0.62],
      rimCol: [0.62, 0.78, 1.0],
      rimAmt: 0.40,
      // ★明るい空では輪郭線がいのち。太くしても、黒い空では見た目が変わらない
      //   （もともとコントラストが足りているので）。安く効いて副作用が無い。
      outline: 0.0100,
      outlineCol: [0.055, 0.05, 0.09],
      emis: 0,
    };
    // カメラのゆれ（trauma方式。2乗で減るので微振動が長引かない）
    this.trauma = 0;
    this.shakeT = 0;

    // ---- つぶ（パーティクル）----
    this.pPart = makeProgram(gl, SH.partVS, SH.partFS, 'part');
    this.maxPart = 420;
    this.parts = [];
    for (let i = 0; i < this.maxPart; i++) {
      this.parts.push({ x:0,y:0,z:0, vx:0,vy:0,vz:0, life:0, max:1,
                        size:0.1, kind:0, rot:0, spin:0, drag:1, g:0, col:[1,1,1] });
    }
    this.partData = new Float32Array(this.maxPart * 10); // pos3 attr4 col3
    this.partBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW);
    const corner = makeBuffer(gl, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]));
    this.vaoPart = gl.createVertexArray();
    gl.bindVertexArray(this.vaoPart);
    attrib(gl, this.pPart.a.aCorner, corner, 2);
    const PS = 10 * 4;
    attrib(gl, this.pPart.a.iPos,  this.partBuf, 3, 1, PS, 0);
    attrib(gl, this.pPart.a.iAttr, this.partBuf, 4, 1, PS, 12);
    attrib(gl, this.pPart.a.iCol,  this.partBuf, 3, 1, PS, 28);
    gl.bindVertexArray(null);
    this.partHead = 0;
  }

  // ---------- つぶ ----------
  spawn(o) {
    // 使い回し。いっぱいなら古いものを上書きする（増やしっぱなしにしない）
    const p = this.parts[this.partHead];
    this.partHead = (this.partHead + 1) % this.maxPart;
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.max = p.life = o.life || 0.5;
    p.size = o.size || 0.1;
    p.kind = o.kind || 0;
    p.rot = o.rot || 0;
    p.spin = o.spin || 0;
    p.drag = o.drag === undefined ? 1.6 : o.drag;
    p.g = o.g === undefined ? 0 : o.g;
    p.col = o.col || [1, 1, 1];
    p.add = !!o.add;
  }

  // 一点からぱっと散らす
  burst(x, y, z, col, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.2) * 1.2;
      const sp = (opt.speed || 2) * (0.4 + Math.random() * 0.8);
      this.spawn({
        x, y, z,
        vx: Math.cos(a) * sp, vy: (opt.up || 0.6) * sp * (0.4 + e), vz: Math.sin(a) * sp * 0.6,
        life: (opt.life || 0.5) * (0.6 + Math.random() * 0.7),
        size: (opt.size || 0.14) * (0.6 + Math.random() * 0.8),
        kind: opt.kind || 0, col, drag: opt.drag, g: opt.g,
        rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 6,
        add: opt.add,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = Math.pow(0.5, dt * p.drag);
      p.vx *= k; p.vz *= k;
      p.vy = p.vy * k - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
    }
  }

  // ★合成のしかたを種類で分ける。ぜんぶ加算にすると、けむりや破片まで
  //   光って見えて、明るい空では真っ白につぶれてしまう。
  //     けむり(0)・破片(2) … ふつうの半とうめい
  //     火花(1)・きらめき(3) … 加算（光っているもの）
  drawParticles() {
    this._drawPartPass(k => k === 0 || k === 2, false);
    this._drawPartPass(k => k === 1 || k === 3, true);
  }

  _drawPartPass(want, additive) {
    const gl = this.gl;
    const d = this.partData;
    let n = 0;
    for (const p of this.parts) {
      if (p.life <= 0 || !want(p.kind)) continue;
      const t = p.life / p.max;
      const b = n * 10;
      d[b] = p.x; d[b+1] = p.y; d[b+2] = p.z;
      d[b+3] = p.size * (p.kind === 0 ? (1.6 - t * 0.6) : t * 0.6 + 0.4);
      d[b+4] = (p.kind === 0 ? t * 0.75 : t * t);   // 濃さ
      d[b+5] = p.kind; d[b+6] = p.rot;
      d[b+7] = p.col[0]; d[b+8] = p.col[1]; d[b+9] = p.col[2];
      n++;
      if (n >= this.maxPart) break;
    }
    if (!n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 10);

    // カメラの向きに合わせて板を立てる
    const v = this.view;
    const right = [v[0], v[4], v[8]];
    const up    = [v[1], v[5], v[9]];

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.pPart.p);
    gl.uniformMatrix4fv(this.pPart.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.pPart.u.uView, false, this.view);
    gl.uniform3fv(this.pPart.u.uRight, right);
    gl.uniform3fv(this.pPart.u.uUp, up);
    gl.uniform1f(this.pPart.u.uPremul, additive ? 1.0 : 0.0);
    gl.bindVertexArray(this.vaoPart);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  // ---------- 形の登録 ----------
  // 種類ごとに VAO を2つ（本体用・輪郭用）作っておく
  makeProp(mesh) {
    const gl = this.gl;
    const vbo = makeBuffer(gl, mesh.vertices);
    const ibo = makeBuffer(gl, mesh.indices, gl.ELEMENT_ARRAY_BUFFER);
    const F = 4, VS = P_STRIDE * F;
    const build = prog => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      attrib(gl, prog.a.aPos,  vbo, 3, 0, VS, 0);
      attrib(gl, prog.a.aNrm,  vbo, 3, 0, VS, 12);
      attrib(gl, prog.a.aONrm, vbo, 3, 0, VS, 24);
      attrib(gl, prog.a.aCol,  vbo, 3, 0, VS, 36);
      const IS = INST_STRIDE * F;
      attrib(gl, prog.a.iInst,  this.instBuf, 3, 1, IS, 0);
      attrib(gl, prog.a.iScale, this.instBuf, 3, 1, IS, 12);
      attrib(gl, prog.a.iRot,   this.instBuf, 1, 1, IS, 24);
      attrib(gl, prog.a.iColor, this.instBuf, 3, 1, IS, 28);
      attrib(gl, prog.a.iParam, this.instBuf, 1, 1, IS, 40);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bindVertexArray(null);
      return vao;
    };
    return {
      vaoMain: build(this.pInst), vaoOutline: build(this.pInstO),
      count: mesh.indexCount,
      type: mesh.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      top: mesh.top === undefined ? 0.32 : mesh.top,   // 見た目の上のはし（実測値）
    };
  }

  // チッチ（骨つき）の登録
  makeSkinned(mesh) {
    const gl = this.gl;
    const vbo = makeBuffer(gl, mesh.vertices);
    const ibo = makeBuffer(gl, mesh.indices, gl.ELEMENT_ARRAY_BUFFER);
    const F = 4, VS = V_STRIDE * F;
    const LAYOUT = [
      ['aPos',3,0], ['aNrm',3,12], ['aONrm',3,24], ['aUV',2,36],
      ['aCol',3,44], ['aParam',4,56], ['aBone',4,72],
    ];
    const build = prog => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      for (const [n, s, o] of LAYOUT) attrib(gl, prog.a[n], vbo, s, 0, VS, o);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bindVertexArray(null);
      return vao;
    };
    return {
      vaoMain: build(this.pToon), vaoOutline: build(this.pOut),
      count: mesh.indexCount,
      type: mesh.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
    };
  }

  makeTexture(canvas) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    // ★Canvas は上が y=0、GL は下が v=0。これを付けないと顔が上下逆になる。
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // fxScale … ✨演出トグルを切ると 0.5（酔い対策。プラン §2.3）
  addTrauma(v) { this.trauma = clamp(this.trauma + v * (this.fxScale === undefined ? 1 : this.fxScale), 0, 1); }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75) * this.quality;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
    }
    this.W = w; this.H = h;
  }

  // ---------- カメラ ----------
  // zoom … 1 より大きいとカメラが後ろへ下がる（ひと休み中に視界を広げる）
  setCamera(camAng, camY, dt, zoom) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.shakeT += dt;
    const aspect = this.W / this.H;
    // 画角は広めにとる。せまいと（＝カメラが遠いと）遠近がほとんど出ず、
    // 円筒を登っているのに平らな板に見えてしまう。
    const fovy = 1.16;
    // 画面の縦に CJ_VIEW_H ぶんが映る距離
    const dist = CJ_VIEW_H / (2 * Math.tan(fovy / 2)) * (zoom || 1);
    const cy = camY + CJ_VIEW_H * 0.5;

    // ゆれ。trauma の2乗で効かせて、画面の3%を超えないようにする
    const t2 = this.trauma * this.trauma;
    const sh = t2 * 0.03 * CJ_VIEW_H;
    const nx = Math.sin(this.shakeT * 41.3) * sh;
    const ny = Math.sin(this.shakeT * 37.7 + 1.7) * sh;

    // ほんの少しだけ見おろす。こうすると足場の並びが楕円に見えて、
    // 「円筒のまわりを登っている」ことが一目で伝わる。
    // 真横から見ると、どれだけ画角を広げても平らな板にしか見えない。
    const PITCH = 0.17;                    // ラジアン（約10°）
    const dh = Math.sin(PITCH) * dist;     // カメラを持ち上げる高さ
    const dr = Math.cos(PITCH) * dist;     // 水平方向の距離

    const sa = Math.sin(camAng), ca = Math.cos(camAng);
    const eye = [sa * (CJ_RADIUS + dr) + ca * nx, cy + dh + ny, ca * (CJ_RADIUS + dr) - sa * nx];
    const tgt = [sa * CJ_RADIUS + ca * nx, cy + ny, ca * CJ_RADIUS - sa * nx];
    this.proj = M4.perspective(fovy, aspect, 0.1, 400);
    this.view = M4.lookAt(eye, tgt, [0, 1, 0]);
    this.eye = eye;
    this.aspect = aspect;
    this.camAng = camAng;
    this.tanHalf = Math.tan(fovy / 2);   // 空を「見ている向き」で描くのに要る
  }

  beginFrame() {
    const gl = this.gl;
    gl.viewport(0, 0, this.W, this.H);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  // bi … biome.js が作った数字の集合（無くても動く）、alt … 本当の高度[m]
  drawSky(meters, time, bi, alt) {
    const gl = this.gl, u = this.pSky.u;
    let [top, bot] = cjSkyColors(meters, alt);
    // 深宇宙では biome が空の地の色を引きつぐ。
    // 低いところ（skyMix=0）では、いままでどおり高度別の色のまま。
    if (bi && bi.skyMix > 0.001) {
      const k = bi.skyMix;
      top = [lerp(top[0], bi.top[0], k), lerp(top[1], bi.top[1], k), lerp(top[2], bi.top[2], k)];
      bot = [lerp(bot[0], bi.bot[0], k), lerp(bot[1], bi.bot[1], k), lerp(bot[2], bi.bot[2], k)];
    }
    // カメラの向き（ワールド）。view の行から引ける。
    // ★これを渡して「見ている向き」で描くから、星も星雲も空に固定される。
    const v = this.view;
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.pSky.p);
    gl.uniform3fv(u.uTop, top);
    gl.uniform3fv(u.uBot, bot);
    // 星は 450m〜650m でじわっと出る（元の演出と同じタイミング）
    // ★星が出るのも高度で決める。空気がある低いところでは、昼の空に星は出ない。
    gl.uniform1f(u.uStars, alt === undefined ? smoothstep(450, 650, meters)
                                             : smoothstep(18000, 65000, alt));
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uAspect, this.aspect);
    gl.uniform1f(u.uTanHalf, this.tanHalf);
    gl.uniform3f(u.uRight, v[0], v[4], v[8]);
    gl.uniform3f(u.uUp,    v[1], v[5], v[9]);
    gl.uniform3f(u.uFwd,  -v[2], -v[6], -v[10]);

    const b = bi || SKY_NONE;
    gl.uniform1f(u.uStarAmt, b.starAmt);
    gl.uniform1f(u.uStarDense, b.starDense);
    gl.uniform3fv(u.uStarCol, b.starCol);
    gl.uniform1f(u.uBandAmt, b.bandAmt);
    gl.uniform3fv(u.uBandCol, b.bandCol);
    gl.uniform3fv(u.uBandDir, b.bandDir);
    gl.uniform1f(u.uNebAmt, b.nebAmt);
    gl.uniform1f(u.uNebScale, b.nebScale);
    gl.uniform1f(u.uNebGain, b.nebGain);
    gl.uniform1f(u.uDarkAmt, b.darkAmt);
    gl.uniform3fv(u.uNebCol1, b.nebCol1);
    gl.uniform3fv(u.uNebCol2, b.nebCol2);
    gl.uniform1f(u.uGalAmt, b.galAmt);
    gl.uniform1f(u.uGalSize, b.galSize);
    gl.uniform1f(u.uGalRoll, b.galRoll);
    gl.uniform1f(u.uGalSquash, b.galSquash);
    gl.uniform1f(u.uGalKind, b.galKind);
    gl.uniform3fv(u.uGalCol, b.galCol);
    gl.uniform3fv(u.uGalDir, b.galDir);
    gl.uniform4f(u.uBeaconA, b.bA.col[0], b.bA.col[1], b.bA.col[2], b.bA.amt);
    gl.uniform4f(u.uBeaconB, b.bB.col[0], b.bB.col[1], b.bB.col[2], b.bB.amt);
    gl.uniform4f(u.uBeaconAP, b.bA.dir[0], b.bA.dir[1], b.bA.dir[2], b.bA.size);
    gl.uniform4f(u.uBeaconBP, b.bB.dir[0], b.bB.dir[1], b.bB.dir[2], b.bB.size);
    gl.uniform2f(u.uBeaconHz, b.bA.hz, b.bB.hz);
    gl.uniform1f(u.uLensAmt, b.lensAmt);
    gl.uniform1f(u.uLensSize, b.lensSize);
    gl.uniform3fv(u.uLensDir, b.lensDir);
    // 地平線の青い帯。平らな地面が見えている高さのあいだだけ。
    gl.uniform1f(u.uSunRing, this.sunRing || 0);
    gl.uniform1f(u.uAirGlow, alt === undefined ? 0
      : smoothstep(12000, 60000, alt) * (1 - smoothstep(120000, 260000, alt)) * 0.85);

    gl.bindVertexArray(this.vaoEmpty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
  }

  setToonUniforms(prog) {
    const gl = this.gl, L = this.look;
    const d = L.lightDir, l = Math.hypot(d[0], d[1], d[2]);
    gl.uniform3f(prog.u.uLightDir, d[0]/l, d[1]/l, d[2]/l);
    gl.uniform3fv(prog.u.uCamPos, this.eye);
    gl.uniform3fv(prog.u.uBaseTint, L.baseTint);
    gl.uniform3fv(prog.u.uShadowTint, L.shadowTint);
    gl.uniform2fv(prog.u.uToonEdge, L.toonEdge);
    gl.uniform3fv(prog.u.uRimCol, L.rimCol);
    gl.uniform1f(prog.u.uRimAmt, L.rimAmt);
    gl.uniform1f(prog.u.uEmis, L.emis);
  }

  // list の各要素: {ang, y, radius, sx, sy, sz, rot, col:[r,g,b], fade}
  //   opt.noDepthWrite … 半とうめいのものに使う。奥ゆきを書きこまないので、
  //                      向こうがわ（ヘルメットごしの顔）がちゃんと見える。
  //   opt.additive     … ガラスのような「明るくするだけ」のもの。
  //     ★ふつうの半とうめいで黒い宇宙に重ねると、明るい色でも
  //       0.3×色＝暗い灰色になり、黒い円盤に見えてしまう（実際にそうなった）。
  drawInstances(prop, list, opt) {
    const noDepthWrite = opt && opt.noDepthWrite;
    const additive = opt && opt.additive;
    if (!list.length) return;
    const gl = this.gl;
    const n = Math.min(list.length, MAX_INST);
    const d = this.instData;
    for (let i = 0; i < n; i++) {
      const o = list[i], b = i * INST_STRIDE;
      d[b]   = o.ang;   d[b+1] = o.y;    d[b+2] = o.radius;
      d[b+3] = o.sx;    d[b+4] = o.sy;   d[b+5] = o.sz;
      d[b+6] = o.rot || 0;
      d[b+7] = o.col[0]; d[b+8] = o.col[1]; d[b+9] = o.col[2];
      d[b+10] = o.fade === undefined ? 1 : o.fade;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * INST_STRIDE);

    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    if (noDepthWrite) gl.depthMask(false);
    gl.useProgram(this.pInst.p);
    gl.uniformMatrix4fv(this.pInst.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.pInst.u.uView, false, this.view);
    this.setToonUniforms(this.pInst);
    // ガラス（ヘルメット）。★毎回わたすこと。前の描画の値が残る。
    // 0=ふつう 1=ガラス（ヘルメット） 2=大気のふち
    gl.uniform1f(this.pInst.u.uGlass, (opt && opt.glass) ? (opt.glass === true ? 1 : opt.glass) : 0);
    // 足場・アイテムだけ「暗くなりすぎない床」を渡す（背景には渡さない）
    gl.uniform1f(this.pInst.u.uFloor, (opt && opt.floor) || 0);
    gl.bindVertexArray(prop.vaoMain);
    gl.drawElementsInstanced(gl.TRIANGLES, prop.count, prop.type, 0, n);

    // 輪郭（表を切って裏だけ描く）。半とうめいのものには付けない。
    // ★opt.noOutline … 画面で数pxしかないものは、輪郭を描いても見えないのに
    //   ジオメトリが倍になる。遠景のビルのように「数が多くて小さい」ものに使う。
    if (!noDepthWrite && !(opt && opt.noOutline)) {
    gl.cullFace(gl.FRONT);
    gl.useProgram(this.pInstO.p);
    gl.uniformMatrix4fv(this.pInstO.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.pInstO.u.uView, false, this.view);
    gl.uniform1f(this.pInstO.u.uOutline, this.look.outline);
    gl.uniform1f(this.pInstO.u.uAspect, this.aspect);
    gl.uniform3fv(this.pInstO.u.uOutlineCol, this.look.outlineCol);
    gl.bindVertexArray(prop.vaoOutline);
    gl.drawElementsInstanced(gl.TRIANGLES, prop.count, prop.type, 0, n);
    }
    gl.cullFace(gl.BACK);
    gl.disable(gl.BLEND);
    if (noDepthWrite) gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  // チッチ。model はワールドへの配置行列。
  drawChicchi(skin, rig, tex, model, flash) {
    const gl = this.gl;
    const modelN = M4.normalMat(model);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.useProgram(this.pToon.p);
    gl.uniformMatrix4fv(this.pToon.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.pToon.u.uView, false, this.view);
    gl.uniformMatrix4fv(this.pToon.u.uModel, false, model);
    gl.uniformMatrix4fv(this.pToon.u.uModelN, false, modelN);
    gl.uniformMatrix4fv(this.pToon.u.uBones, false, rig.skinFlat);
    gl.uniformMatrix4fv(this.pToon.u.uBonesN, false, rig.skinNFlat);
    this.setToonUniforms(this.pToon);
    // チッチだけの床。ここは背景の明るさに関わらず一定でよい（いつも主役なので）。
    gl.uniform1f(this.pToon.u.uCFloor, 0.66);
    gl.uniform1f(this.pToon.u.uFlash, flash || 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(this.pToon.u.uTex, 0);
    gl.bindVertexArray(skin.vaoMain);
    gl.drawElements(gl.TRIANGLES, skin.count, skin.type, 0);

    gl.cullFace(gl.FRONT);
    gl.useProgram(this.pOut.p);
    gl.uniformMatrix4fv(this.pOut.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.pOut.u.uView, false, this.view);
    gl.uniformMatrix4fv(this.pOut.u.uModel, false, model);
    gl.uniformMatrix4fv(this.pOut.u.uModelN, false, modelN);
    gl.uniformMatrix4fv(this.pOut.u.uBones, false, rig.skinFlat);
    gl.uniformMatrix4fv(this.pOut.u.uBonesN, false, rig.skinNFlat);
    gl.uniform1f(this.pOut.u.uOutline, this.look.outline * 1.25);
    gl.uniform1f(this.pOut.u.uAspect, this.aspect);
    gl.uniform3fv(this.pOut.u.uOutlineCol, this.look.outlineCol);
    gl.bindVertexArray(skin.vaoOutline);
    gl.drawElements(gl.TRIANGLES, skin.count, skin.type, 0);
    gl.cullFace(gl.BACK);
    gl.bindVertexArray(null);
  }

  // 着地点の影。3Dで一番よくある事故が「奥ゆきが読めなくて落ちる」なので、
  // これは飾りではなくゲームの一部。
  drawBlob(pos, rx, rz, alpha) {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.useProgram(this.pBlob.p);
    gl.uniformMatrix4fv(this.pBlob.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.pBlob.u.uView, false, this.view);
    gl.uniform3fv(this.pBlob.u.uCenter, pos);
    gl.uniform2f(this.pBlob.u.uRadius, rx, rz);
    gl.uniform1f(this.pBlob.u.uAlpha, alpha);
    gl.uniform3f(this.pBlob.u.uColor, 0.03, 0.03, 0.08);
    gl.bindVertexArray(this.vaoBlob);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
}
