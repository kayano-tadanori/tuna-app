'use strict';
/* 袋折りの連動運動を描く WebGL（squash_preview.html から切り出し、自由折り画面と共用する）。
   ★ 渡された座標（squash_model / SquashV2.positions が作った配列）を**そのまま** GPU へ送る。ここで幾何を作らない。
   ★ 奥行きは depth バッファが決める（面の固定の描画順では並べない）。
   ★ 表と裏は三角形の巻き順（gl_FrontFacing）で描き分ける。
   ⛔ 厚みは 0。紙どうしの貫通（すり抜け）は**未検証**。
   カメラ（行列）は呼ぶ側が決める＝透視（独立プレビュー）でも正射影（自由折り画面）でも同じ描画を通す。 */
globalThis.SquashGL = (() => {
/* ⚠varying の精度は VS と FS でそろえる。VS の既定は highp・FS の既定は mediump なので、
   そろえないと **リンクに失敗して何も描かれない**（実機で踏んだ。エラーも出ない）。 */
const VS = `attribute vec3 p; uniform mat4 mvp; varying highp vec3 w;
 void main(){ w = p; gl_Position = mvp * vec4(p,1.0); }`;
const FS = `precision mediump float; varying highp vec3 w; uniform vec3 front; uniform vec3 back; uniform vec4 edge;
 void main(){
   if (edge.a > 0.5) { gl_FragColor = vec4(edge.rgb, 1.0); return; }   /* 面のふちの線（depth つき） */
   vec3 c = gl_FrontFacing ? front : back;       /* 表と裏＝三角形の巻き順 */
   float sh = 0.86 + 0.14 * clamp(w.z*6.0+0.5, 0.0, 1.0);
   gl_FragColor = vec4(c*sh, 1.0);
 }`;
function create(canvas, opt = {}) {
 const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true, alpha: true });
 if (!gl) return { ok: false, reason: 'この画面は WebGL が要ります' };
 const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s)); return s };
 const prog = gl.createProgram();
 gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
 gl.linkProgram(prog);
 if (!gl.getProgramParameter(prog, gl.LINK_STATUS))   /* 黙って描かれないのを防ぐ＝必ず気づく */
  return { ok: false, reason: 'WebGL リンク失敗: ' + gl.getProgramInfoLog(prog) };
 gl.useProgram(prog);
 const aP = gl.getAttribLocation(prog, 'p'), uMVP = gl.getUniformLocation(prog, 'mvp');
 const uFront = gl.getUniformLocation(prog, 'front'), uBack = gl.getUniformLocation(prog, 'back'), uEdge = gl.getUniformLocation(prog, 'edge');
 const lineBuf = gl.createBuffer();
 const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
 gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
 gl.enable(gl.DEPTH_TEST);                      /* ★奥行きは depth バッファが決める */
 gl.disable(gl.CULL_FACE);                      /* 裏も描く */
 const front = opt.front || [0.98, 0.86, 0.36], back = opt.back || [0.99, 0.99, 0.97];
 const clear = opt.clear || [0.78, 0.85, 0.90, 1];
 /* opt.edges＝面のふちの色。渡したときだけ、三角形のふちを depth バッファつきで描く（隠れた線は透けない）。 */
 const edges = opt.edges || null;
 /* 1コマ。positions は 3成分×頂点の Float32Array。返すのは「GPU へ送ったもの」そのもの。 */
 function draw(positions, mvp) {
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(clear[0], clear[1], clear[2], clear[3]); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
  gl.uniform3fv(uFront, front); gl.uniform3fv(uBack, back); gl.uniform4f(uEdge, 0, 0, 0, 0);
  if (edges) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1) }
  gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
  if (edges) { gl.disable(gl.POLYGON_OFFSET_FILL);
   const L = new Float32Array(positions.length * 2);
   for (let t = 0; t < positions.length / 9; t++) for (let e = 0; e < 3; e++) for (const [k, v] of [[0, e], [1, (e + 1) % 3]])
    for (let c = 0; c < 3; c++) L[(t * 6 + e * 2 + k) * 3 + c] = positions[(t * 3 + v) * 3 + c];
   gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); gl.bufferData(gl.ARRAY_BUFFER, L, gl.DYNAMIC_DRAW);
   gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
   gl.uniform4f(uEdge, edges[0], edges[1], edges[2], 1); gl.drawArrays(gl.LINES, 0, L.length / 3);
   gl.uniform4f(uEdge, 0, 0, 0, 0) }
  return { positions: Array.from(positions), mvp: Array.from(mvp) };
 }
 function clearOnly() { gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(clear[0], clear[1], clear[2], clear[3]); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT) }
 /* 実際に塗られた画素（preserveDrawingBuffer で読める）。分類は呼ぶ側が渡す。 */
 function pixels(classify) {
  const w = canvas.width, h = canvas.height, px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const out = {}; for (let i = 0; i < px.length; i += 4) { const k = classify(px[i], px[i + 1], px[i + 2], px[i + 3]); out[k] = (out[k] || 0) + 1 }
  out.total = w * h; return out;
 }
 function pixelAt(x, y) { const px = new Uint8Array(4); gl.readPixels(x, canvas.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return Array.from(px) }
 return { ok: true, gl, draw, clearOnly, pixels, pixelAt };
}
return { create, VS, FS };
})();
