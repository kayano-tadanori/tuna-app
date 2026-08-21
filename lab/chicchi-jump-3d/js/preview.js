// ============================================================
// preview.js — チッチ3Dモデルの確認用ハーネス（本番のゲームではない）
//   「安っぽく見えないか」を目で判定するためだけのもの。
//   Playwright から window.__cj で角度・ポーズ・表示を切りかえられる。
// ============================================================
'use strict';

(function () {
const cv = document.getElementById('c');
const hud = document.getElementById('hud');
const errBox = document.getElementById('err');
const showErr = m => { errBox.textContent = String(m && m.stack || m); console.error(m); };
window.addEventListener('error', e => showErr(e.error || e.message));

const gl = createGL(cv);
if (!gl) { showErr('WebGL2 が使えません'); return; }

// ---------------- メッシュ ----------------
let mesh, rig, faceTex;
try {
  mesh = buildChicchiMesh();
  rig  = new ChicchiRig();
} catch (e) { showErr(e); return; }

// ---------------- プログラム ----------------
const progToon    = makeProgram(gl, SH.toonVS, SH.toonFS, 'toon');
const progOutline = makeProgram(gl, SH.outlineVS, SH.outlineFS, 'outline');
const progBg      = makeProgram(gl, SH.quadVS, SH.previewBgFS, 'bg');
const progBlob    = makeProgram(gl, SH.blobVS, SH.blobFS, 'blob');

// ---------------- バッファ ----------------
const F = 4, STRIDE = 22 * F;
const vbo = makeBuffer(gl, mesh.vertices);
const ibo = makeBuffer(gl, mesh.indices, gl.ELEMENT_ARRAY_BUFFER);
const IDX_TYPE = mesh.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

// 属性の並び（chicchi.js の V_STRIDE と対応）
const LAYOUT = [
  ['aPos',   3,  0],
  ['aNrm',   3, 12],
  ['aONrm',  3, 24],
  ['aUV',    2, 36],
  ['aCol',   3, 44],
  ['aParam', 4, 56],
  ['aBone',  4, 72],
];

function makeVAO(prog) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  for (const [name, size, off] of LAYOUT) {
    attrib(gl, prog.a[name], vbo, size, 0, STRIDE, off);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bindVertexArray(null);
  return vao;
}
const vaoToon = makeVAO(progToon);
const vaoOutline = makeVAO(progOutline);

// 影の板
const blobBuf = makeBuffer(gl, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]));
const vaoBlob = gl.createVertexArray();
gl.bindVertexArray(vaoBlob);
attrib(gl, progBlob.a.aCorner, blobBuf, 2);
gl.bindVertexArray(null);

const vaoEmpty = gl.createVertexArray();

// ---------------- 顔テクスチャ ----------------
faceTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, faceTex);
// ★これが無いとテクスチャが上下逆になり、顔のオレンジがおなかに出る。
//   Canvas は上が y=0、GL は下が v=0 なので、そのままだと反転する。
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeChicchiFaceTexture(512));
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
gl.generateMipmap(gl.TEXTURE_2D);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// ---------------- 見た目のパラメータ ----------------
const LOOK = {
  yaw: 0, pitch: 0.06, dist: 3.05, height: 0.50,
  outline: 0.0105,
  outlineCol: [0.055, 0.05, 0.09],
  lightDir: [-0.42, 0.72, 0.55],
  baseTint: [1, 1, 1],
  // 影の色は「暗くする」のではなく色相を青紫へ回す。ここが安っぽさの分かれ目。
  // 落としすぎると顔色が悪くなって不気味になるので、明るめにとる。
  shadowTint: [0.82, 0.80, 0.94],
  toonEdge: [0.38, 0.62],      // 影の境目をやわらかく
  rimCol: [0.62, 0.78, 1.0],
  rimAmt: 0.40,
  emis: 0.0,
  flash: 0.0,
  bgTop: [0.09, 0.11, 0.20],
  bgBot: [0.03, 0.04, 0.09],
  silhouette: false,   // 真っ黒に塗ってシルエットだけ見る（読めるかの検査）
  spin: true,
  // 撮影時に自動更新を止める。止めないと rAF ループが裏で進んでしまい、
  // 「着地の潰れ」のような一瞬のポーズが元に戻ってから撮れてしまう。
  paused: false,
};

// Playwright から触るための口
window.__cj = {
  look: LOOK,
  set(o) { Object.assign(LOOK, o); },
  setView(yaw, pitch) { LOOK.yaw = yaw; LOOK.pitch = pitch ?? LOOK.pitch; LOOK.spin = false; },
  pose(name) {
    LOOK.spin = false;
    LOOK.paused = true;              // 一瞬のポーズを保つ
    rig.state = CJ_ANIM.IDLE;
    if (name === 'land')   rig.land(1);
    if (name === 'launch') rig.launch(1);
    if (name === 'spring') rig.spring();
    if (name === 'hurt')   rig.hurt();
    if (name === 'flip')   rig.flip(0.5);
  },
  // 何フレームか進めて、決まった見た目にしてから撮る
  step(n, dt, ctx) {
    for (let i = 0; i < (n || 1); i++) rig.update(dt || 1/60, ctx || {});
    draw(performance.now());
  },
  reset() { rig = new ChicchiRig(); LOOK.paused = false; },
  stats: { verts: mesh.vertexCount, tris: mesh.indexCount / 3 },
};

// ---------------- 入力（指で回す） ----------------
let drag = null;
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; LOOK.spin = false; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  LOOK.yaw   += (e.clientX - drag.x) * 0.008;
  LOOK.pitch = clamp(LOOK.pitch - (e.clientY - drag.y) * 0.005, -0.9, 0.9);
  drag = { x: e.clientX, y: e.clientY };
});
cv.addEventListener('pointerup', () => drag = null);
window.addEventListener('keydown', e => {
  if (e.key === 's') LOOK.silhouette = !LOOK.silhouette;
  if (e.key === ' ') LOOK.spin = !LOOK.spin;
  if (e.key === '1') window.__cj.pose('land');
  if (e.key === '2') window.__cj.pose('launch');
  if (e.key === '3') window.__cj.pose('spring');
  if (e.key === '4') window.__cj.pose('flip');
  if (e.key === '5') window.__cj.pose('hurt');
});

// ---------------- 描画 ----------------
let W = 0, H = 0;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  W = Math.round(cv.clientWidth * dpr);
  H = Math.round(cv.clientHeight * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
}

function draw(now) {
  resize();
  gl.viewport(0, 0, W, H);
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // --- 背景 ---
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(progBg.p);
  gl.uniform3fv(progBg.u.uTop, LOOK.silhouette ? [0.85,0.87,0.95] : LOOK.bgTop);
  gl.uniform3fv(progBg.u.uBot, LOOK.silhouette ? [0.72,0.75,0.86] : LOOK.bgBot);
  gl.uniform1f(progBg.u.uVignette, 0.55);
  gl.bindVertexArray(vaoEmpty);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.enable(gl.DEPTH_TEST);

  // --- カメラ ---
  const aspect = W / H;
  const proj = M4.perspective(0.62, aspect, 0.05, 60);
  const cy = Math.cos(LOOK.pitch), sy = Math.sin(LOOK.pitch);
  const eye = [
    Math.sin(LOOK.yaw) * LOOK.dist * cy,
    LOOK.height + sy * LOOK.dist,
    Math.cos(LOOK.yaw) * LOOK.dist * cy,
  ];
  const target = [0, LOOK.height, 0];
  const view = M4.lookAt(eye, target, [0, 1, 0]);

  const model = M4.ident();
  const modelN = M4.normalMat(model);

  // --- 接地影 ---
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.useProgram(progBlob.p);
  gl.uniformMatrix4fv(progBlob.u.uProj, false, proj);
  gl.uniformMatrix4fv(progBlob.u.uView, false, view);
  gl.uniform3f(progBlob.u.uCenter, 0, 0.001, 0);
  gl.uniform2f(progBlob.u.uRadius, 0.34, 0.30);
  gl.uniform1f(progBlob.u.uAlpha, 0.45);
  gl.uniform3f(progBlob.u.uColor, 0.02, 0.02, 0.06);
  gl.bindVertexArray(vaoBlob);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.depthMask(true);
  gl.disable(gl.BLEND);

  // --- 本体 ---
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.useProgram(progToon.p);
  gl.uniformMatrix4fv(progToon.u.uProj, false, proj);
  gl.uniformMatrix4fv(progToon.u.uView, false, view);
  gl.uniformMatrix4fv(progToon.u.uModel, false, model);
  gl.uniformMatrix4fv(progToon.u.uModelN, false, modelN);
  gl.uniformMatrix4fv(progToon.u.uBones, false, rig.skinFlat);
  gl.uniformMatrix4fv(progToon.u.uBonesN, false, rig.skinNFlat);
  const ld = LOOK.lightDir, ll = Math.hypot(ld[0], ld[1], ld[2]);
  gl.uniform3f(progToon.u.uLightDir, ld[0]/ll, ld[1]/ll, ld[2]/ll);
  gl.uniform3fv(progToon.u.uCamPos, eye);
  gl.uniform3fv(progToon.u.uBaseTint, LOOK.silhouette ? [0,0,0] : LOOK.baseTint);
  gl.uniform3fv(progToon.u.uShadowTint, LOOK.silhouette ? [0,0,0] : LOOK.shadowTint);
  gl.uniform3fv(progToon.u.uRimCol, LOOK.silhouette ? [0,0,0] : LOOK.rimCol);
  gl.uniform1f(progToon.u.uRimAmt, LOOK.silhouette ? 0 : LOOK.rimAmt);
  gl.uniform2fv(progToon.u.uToonEdge, LOOK.toonEdge);
  gl.uniform1f(progToon.u.uEmis, LOOK.silhouette ? 0 : LOOK.emis);
  gl.uniform1f(progToon.u.uFlash, LOOK.silhouette ? 0 : LOOK.flash);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, faceTex);
  gl.uniform1i(progToon.u.uTex, 0);
  gl.bindVertexArray(vaoToon);
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, IDX_TYPE, 0);

  // --- 輪郭線（表を切って裏だけ描く）---
  if (!LOOK.silhouette) {
    gl.cullFace(gl.FRONT);
    gl.useProgram(progOutline.p);
    gl.uniformMatrix4fv(progOutline.u.uProj, false, proj);
    gl.uniformMatrix4fv(progOutline.u.uView, false, view);
    gl.uniformMatrix4fv(progOutline.u.uModel, false, model);
    gl.uniformMatrix4fv(progOutline.u.uModelN, false, modelN);
    gl.uniformMatrix4fv(progOutline.u.uBones, false, rig.skinFlat);
    gl.uniformMatrix4fv(progOutline.u.uBonesN, false, rig.skinNFlat);
    gl.uniform1f(progOutline.u.uOutline, LOOK.outline);
    gl.uniform1f(progOutline.u.uAspect, aspect);
    gl.uniform3fv(progOutline.u.uOutlineCol, LOOK.outlineCol);
    gl.bindVertexArray(vaoOutline);
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, IDX_TYPE, 0);
    gl.cullFace(gl.BACK);
  }

  gl.bindVertexArray(null);

  hud.textContent =
    `頂点 ${mesh.vertexCount} / 三角形 ${mesh.indexCount / 3}\n` +
    `yaw ${LOOK.yaw.toFixed(2)}  pitch ${LOOK.pitch.toFixed(2)}\n` +
    `squash ${rig.squash.toFixed(3)}\n` +
    `[s]シルエット [space]回転 [1]着地 [2]発射 [3]バネ [4]宙返り [5]被弾`;
}

// ---------------- ループ ----------------
let prev = performance.now();
function loop(now) {
  const dt = Math.min((now - prev) / 1000, 1 / 20);
  prev = now;
  if (LOOK.spin) LOOK.yaw += dt * 0.55;
  rig.update(dt, { vy: -2, vMax: 14, vx: 0, vxMax: 6, lookX: 0, lookY: 0.25 });
  draw(now);
  requestAnimationFrame(loop);
}
rig.update(1 / 60, {});
requestAnimationFrame(loop);

window.__cjReady = true;
})();
