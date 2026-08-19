// ============================================================
// gl.js — 依存ライブラリなしの WebGL2 ミニ基盤（2D ネオン用）
//   ジェイドパニック専用。tetris2 の gl.js を 2D 向けに作り直したもの。
//   ・正射影の行列だけ（3Dの透視は要らない）
//   ・シェーダ / VAO / オフスクリーンFBO / 動的インスタンスバッファ
// ============================================================
'use strict';

// ---------------- 便利関数 ----------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const TAU = Math.PI * 2;

// 角度差を -π..π に畳む
function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function hex2rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// HSVからRGB（虹色の演出用）
function hsv2rgb(h, s, v) {
  h = (h % 1 + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

// ---------------- コンテキスト ----------------
function createGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false,
    powerPreference: 'high-performance', desynchronized: true,
  });
  if (!gl) return null;
  // HDR（半精度float）が使えるか。使えなければ RGBA8 に落とす
  gl.hdr = !!gl.getExtension('EXT_color_buffer_half_float') || !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  return gl;
}

// ---------------- シェーダ ----------------
function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    console.error('shader compile error\n' + log + '\n' + numbered);
    throw new Error('shader compile: ' + log);
  }
  return s;
}

function makeProgram(gl, vsSrc, fsSrc, name) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('link ' + (name || '') + ': ' + gl.getProgramInfoLog(p));
  }
  const u = {};
  const un = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < un; i++) {
    const info = gl.getActiveUniform(p, i);
    const nm = info.name.replace(/\[0\]$/, '');
    u[nm] = gl.getUniformLocation(p, nm);
  }
  const a = {};
  const an = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < an; i++) {
    const info = gl.getActiveAttrib(p, i);
    a[info.name] = gl.getAttribLocation(p, info.name);
  }
  return { p, u, a, name };
}

// ---------------- オフスクリーン ----------------
function makeFBO(gl, w, h, opt = {}) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const half = opt.hdr && gl.hdr;
  gl.texImage2D(gl.TEXTURE_2D, 0, half ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA,
                half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, tex, w, h, hdr: !!half };
}

function disposeFBO(gl, f) {
  if (!f) return;
  gl.deleteFramebuffer(f.fb);
  gl.deleteTexture(f.tex);
}

function makeBuffer(gl, data, usage) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
  return b;
}

function attrib(gl, loc, buf, size, divisor = 0, stride = 0, offset = 0) {
  if (loc === undefined || loc < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
  gl.vertexAttribDivisor(loc, divisor);
}

// ------------------------------------------------------------
// InstanceBuffer — 1フレームぶんのインスタンスを詰めて bufferSubData で流す
//   毎フレーム new しないよう、確保ずみの Float32Array を使い回す
// ------------------------------------------------------------
class InstanceBuffer {
  constructor(gl, floatsPerInstance, capacity) {
    this.gl = gl;
    this.fpi = floatsPerInstance;
    this.cap = capacity;
    this.data = new Float32Array(floatsPerInstance * capacity);
    this.n = 0;
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
  }
  reset() { this.n = 0; }
  // 書き込み位置を返す（あふれたら -1）
  alloc() {
    if (this.n >= this.cap) return -1;
    return (this.n++) * this.fpi;
  }
  upload() {
    if (this.n === 0) return 0;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * this.fpi);
    return this.n;
  }
}
