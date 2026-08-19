// ============================================================
// gl.js — 依存ライブラリなしの WebGL2 ミニフレームワーク
//   行列計算 / シェーダ / VAO / オフスクリーンFBO / 立方体ジオメトリ
// ============================================================
'use strict';

// ---------------- mat4（列優先。glMatrixと同じ並び） ----------------
const M4 = {
  ident() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },

  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  },

  lookAt(eye, center, up) {
    let z0 = eye[0]-center[0], z1 = eye[1]-center[1], z2 = eye[2]-center[2];
    let len = Math.hypot(z0, z1, z2) || 1; z0/=len; z1/=len; z2/=len;
    let x0 = up[1]*z2 - up[2]*z1, x1 = up[2]*z0 - up[0]*z2, x2 = up[0]*z1 - up[1]*z0;
    len = Math.hypot(x0, x1, x2) || 1; x0/=len; x1/=len; x2/=len;
    const y0 = z1*x2 - z2*x1, y1 = z2*x0 - z0*x2, y2 = z0*x1 - z1*x0;
    return new Float32Array([
      x0, y0, z0, 0,
      x1, y1, z1, 0,
      x2, y2, z2, 0,
      -(x0*eye[0] + x1*eye[1] + x2*eye[2]),
      -(y0*eye[0] + y1*eye[1] + y2*eye[2]),
      -(z0*eye[0] + z1*eye[1] + z2*eye[2]), 1,
    ]);
  },

  mul(a, b) { // a * b
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      const b0 = b[c*4], b1 = b[c*4+1], b2 = b[c*4+2], b3 = b[c*4+3];
      o[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2  + a[12]*b3;
      o[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2  + a[13]*b3;
      o[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
      o[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
    }
    return o;
  },
};

// ---------------- コンテキスト ----------------
function createGL(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: true, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false,
    powerPreference: 'high-performance', desynchronized: true,
  });
  if (!gl) return null;
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
  // uniform をまとめて引く
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
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
  let depth = null;
  if (opt.depth) {
    depth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fb, tex, depth, w, h, hdr: !!half };
}

function disposeFBO(gl, f) {
  if (!f) return;
  gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex);
  if (f.depth) gl.deleteRenderbuffer(f.depth);
}

// ---------------- 立方体（面ごとのUV・接線つき） ----------------
// 面内UV(0..1)と接線・従接線を持たせて、フラグメント側で
//  ・面のふちのネオン枠
//  ・法線を曲げた擬似ベベル（角のハイライト）
// を作れるようにする。
function cubeGeometry() {
  const faces = [
    // normal,        tangent,        bitangent
    [[ 0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[ 0, 0,-1], [-1,0, 0], [0, 1, 0]],
    [[ 1, 0, 0], [0, 0,-1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[ 0, 1, 0], [1, 0, 0], [0, 0,-1]],
    [[ 0,-1, 0], [1, 0, 0], [0, 0, 1]],
  ];
  const pos = [], nrm = [], tan = [], bit = [], uv = [], idx = [];
  faces.forEach((f, fi) => {
    const [n, t, b] = f;
    for (let i = 0; i < 4; i++) {
      const su = (i === 1 || i === 2) ? 1 : -1;
      const sv = (i >= 2) ? 1 : -1;
      pos.push(
        (n[0] + t[0]*su + b[0]*sv) * 0.5,
        (n[1] + t[1]*su + b[1]*sv) * 0.5,
        (n[2] + t[2]*su + b[2]*sv) * 0.5);
      nrm.push(n[0], n[1], n[2]);
      tan.push(t[0], t[1], t[2]);
      bit.push(b[0], b[1], b[2]);
      uv.push(su * 0.5 + 0.5, sv * 0.5 + 0.5);
    }
    const o = fi * 4;
    idx.push(o, o+1, o+2, o, o+2, o+3);
  });
  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm),
    tan: new Float32Array(tan), bit: new Float32Array(bit),
    uv: new Float32Array(uv), idx: new Uint16Array(idx),
  };
}

function makeBuffer(gl, data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) {
  const b = gl.createBuffer();
  gl.bindBuffer(target, b);
  gl.bufferData(target, data, usage);
  return b;
}

function attrib(gl, loc, buf, size, divisor = 0, stride = 0, offset = 0) {
  if (loc === undefined || loc < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
  gl.vertexAttribDivisor(loc, divisor);
}

// ---------------- 便利関数 ----------------
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const rnd = (a, b) => a + Math.random() * (b - a);

function hex2rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
