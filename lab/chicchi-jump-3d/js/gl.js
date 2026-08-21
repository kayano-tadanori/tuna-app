// ============================================================
// gl.js — 依存ライブラリなしの WebGL2 ミニフレームワーク
//   行列計算 / シェーダ / VAO / オフスクリーンFBO / ジオメトリ生成
//
//   lab/tetris2/js/gl.js が土台。チッチジャンプ3D 用に足したもの:
//     M4.compose / invert / normalMat  … スキニング（骨アニメ）用
//     catmull()                        … 制御点から曲線をひく
//     loftGeometry()                   … 断面リングを積んで一体メッシュを作る
//     sphereGeometry() / ringGeometry() … 惑星と環
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

  // --- ここから下はチッチジャンプ3Dの追加分 ---

  // TRS を1つの行列に。r は [rx,ry,rz]（ラジアン・XYZ順）、s は [sx,sy,sz]
  // 骨アニメの基本。スクワッシュ&ストレッチは s を非一様にすることで作る。
  compose(t, r, s, out) {
    const o = out || new Float32Array(16);
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]);
    const cy = Math.cos(r[1]), sy = Math.sin(r[1]);
    const cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    // R = Rz * Ry * Rx
    const m00 =  cz*cy,  m01 =  cz*sy*sx - sz*cx,  m02 =  cz*sy*cx + sz*sx;
    const m10 =  sz*cy,  m11 =  sz*sy*sx + cz*cx,  m12 =  sz*sy*cx - cz*sx;
    const m20 = -sy,     m21 =  cy*sx,             m22 =  cy*cx;
    o[0]=m00*s[0]; o[1]=m10*s[0]; o[2]=m20*s[0]; o[3]=0;
    o[4]=m01*s[1]; o[5]=m11*s[1]; o[6]=m21*s[1]; o[7]=0;
    o[8]=m02*s[2]; o[9]=m12*s[2]; o[10]=m22*s[2]; o[11]=0;
    o[12]=t[0]; o[13]=t[1]; o[14]=t[2]; o[15]=1;
    return o;
  },

  invert(m, out) {
    const o = out || new Float32Array(16);
    const a00=m[0],a01=m[1],a02=m[2],a03=m[3];
    const a10=m[4],a11=m[5],a12=m[6],a13=m[7];
    const a20=m[8],a21=m[9],a22=m[10],a23=m[11];
    const a30=m[12],a31=m[13],a32=m[14],a33=m[15];
    const b00=a00*a11-a01*a10, b01=a00*a12-a02*a10, b02=a00*a13-a03*a10;
    const b03=a01*a12-a02*a11, b04=a01*a13-a03*a11, b05=a02*a13-a03*a12;
    const b06=a20*a31-a21*a30, b07=a20*a32-a22*a30, b08=a20*a33-a23*a30;
    const b09=a21*a32-a22*a31, b10=a21*a33-a23*a31, b11=a22*a33-a23*a32;
    let det = b00*b11 - b01*b10 + b02*b09 + b03*b08 - b04*b07 + b05*b06;
    if (!det) { o.set(M4.ident()); return o; }
    det = 1 / det;
    o[0]=(a11*b11-a12*b10+a13*b09)*det;  o[1]=(a02*b10-a01*b11-a03*b09)*det;
    o[2]=(a31*b05-a32*b04+a33*b03)*det;  o[3]=(a22*b04-a21*b05-a23*b03)*det;
    o[4]=(a12*b08-a10*b11-a13*b07)*det;  o[5]=(a00*b11-a02*b08+a03*b07)*det;
    o[6]=(a32*b02-a30*b05-a33*b01)*det;  o[7]=(a20*b05-a22*b02+a23*b01)*det;
    o[8]=(a10*b10-a11*b08+a13*b06)*det;  o[9]=(a01*b08-a00*b10-a03*b06)*det;
    o[10]=(a30*b04-a31*b02+a33*b00)*det; o[11]=(a21*b02-a20*b04-a23*b00)*det;
    o[12]=(a11*b07-a10*b09-a12*b06)*det; o[13]=(a00*b09-a01*b07+a02*b06)*det;
    o[14]=(a31*b01-a30*b03-a32*b00)*det; o[15]=(a20*b03-a21*b01+a22*b00)*det;
    return o;
  },

  // 法線用行列 = transpose(inverse(M)) の上3x3。mat4 のまま返す（上3x3だけ使う）。
  // 非一様スケール（潰れ・伸び）をかけたとき、これが無いと陰影が壊れる。
  normalMat(m, out) {
    const inv = M4.invert(m);
    const o = out || new Float32Array(16);
    o[0]=inv[0];  o[1]=inv[4];  o[2]=inv[8];  o[3]=0;
    o[4]=inv[1];  o[5]=inv[5];  o[6]=inv[9];  o[7]=0;
    o[8]=inv[2];  o[9]=inv[6];  o[10]=inv[10]; o[11]=0;
    o[12]=0; o[13]=0; o[14]=0; o[15]=1;
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
// 足場（雲・岩）用。フラグメント側で擬似ベベルとクレーターを焼く。
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

// ============================================================
//  ここから下がチッチジャンプ3Dの新規ジオメトリ
// ============================================================

// ---------------- Catmull-Rom（制御点をなめらかに通る曲線） ----------------
// 制御点の配列 pts（数値の配列）に対し、t=0..1 の位置の値を返す。
// チッチの体型は、この制御点6個の数値を触るだけで変えられる。
function catmull(pts, t) {
  const n = pts.length;
  if (n === 0) return 0;
  if (n === 1) return pts[0];
  const x = clamp(t, 0, 1) * (n - 1);
  const i = Math.min(Math.floor(x), n - 2);
  const f = x - i;
  const p0 = pts[Math.max(i - 1, 0)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(i + 2, n - 1)];
  const f2 = f * f, f3 = f2 * f;
  return 0.5 * ((2*p1) + (-p0 + p2)*f + (2*p0 - 5*p1 + 4*p2 - p3)*f2 + (-p0 + 3*p1 - 3*p2 + p3)*f3);
}

// ---------------- ロフト（断面リングを積んで一体メッシュにする） ----------------
// これがチッチの体を作る中心の道具。球やカプセルを並べるのと違って
// 継ぎ目ができないので「モデリングした」形になる。
//
//  opt.rings   … 縦の分割数 N（断面の枚数-1）
//  opt.radial  … 横の分割数 M（1周の分割）
//  opt.profile … t(0..1) → [rx, rz]  その高さでの太さ（x方向とz方向で別々）
//  opt.spine   … t(0..1) → [cx, cy, cz]  背骨の位置
//  opt.k       … 超楕円の指数。2=真円、2.6=角の丸い四角（ぷっくり感）
//  opt.capTop / opt.capBottom … 端にふたをするか
//
// 法線は「面法線の平均」ではなく、曲面のパラメータ微分から解析的に出す。
// 平均だと頭のてっぺんとお尻の極で破綻する。
function loftGeometry(opt) {
  const N = opt.rings  || 18;
  const M = opt.radial || 16;
  const k = opt.k ?? 2.0;
  const profile = opt.profile;
  const spine   = opt.spine || (t => [0, t, 0]);
  const capTop    = opt.capTop !== false;
  const capBottom = opt.capBottom !== false;
  // 極を1点に縮退させないための最小半径。0にすると法線・UV・輪郭線が同時に壊れる。
  const minR = opt.minR ?? 0.02;

  // 超楕円の断面。k=2 で真円、k を上げるほど角が張ってぷっくりする。
  const sup = (a, e) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [
      Math.sign(c) * Math.pow(Math.abs(c), 2 / e),
      Math.sign(s) * Math.pow(Math.abs(s), 2 / e),
    ];
  };

  // 曲面上の1点。t=縦(0..1)、a=角度(rad)
  const surf = (t, a) => {
    const tc = clamp(t, 0, 1);
    const p = profile(tc);
    const c = spine(tc);
    const [cu, su] = sup(a, k);
    return [
      c[0] + Math.max(p[0], minR) * cu,
      c[1],
      c[2] + Math.max(p[1], minR) * su,
    ];
  };

  const pos = [], nrm = [], uv = [], idx = [];
  const h = 1e-3;

  for (let i = 0; i <= N; i++) {
    const t = i / N;
    for (let j = 0; j <= M; j++) {          // M+1 列（UV継ぎ目のため最後を二重化）
      const a = (j / M) * Math.PI * 2;
      const P = surf(t, a);

      // 解析的な法線：接ベクトル2本の外積。
      //   dP/dt × dP/da の順だと内向きになるので dP/dt から dP/da の順で外積を取る。
      const Pt1 = surf(t + h, a), Pt0 = surf(t - h, a);
      const Pa1 = surf(t, a + h), Pa0 = surf(t, a - h);
      const dt = [Pt1[0]-Pt0[0], Pt1[1]-Pt0[1], Pt1[2]-Pt0[2]];
      const da = [Pa1[0]-Pa0[0], Pa1[1]-Pa0[1], Pa1[2]-Pa0[2]];
      let nx = dt[1]*da[2] - dt[2]*da[1];
      let ny = dt[2]*da[0] - dt[0]*da[2];
      let nz = dt[0]*da[1] - dt[1]*da[0];
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      pos.push(P[0], P[1], P[2]);
      nrm.push(nx, ny, nz);
      uv.push(j / M, t);
    }
  }

  const stride = M + 1;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      // 外から見て反時計回り（GLの既定 CCW = 表）になる並び
      idx.push(a, c, d,  a, d, b);
    }
  }

  // ふた。極を縮退させていないぶん、中心1点を足して扇状に閉じる。
  const addCap = (t, up) => {
    const c = spine(clamp(t, 0, 1));
    const center = pos.length / 3;
    pos.push(c[0], c[1], c[2]);
    nrm.push(0, up ? 1 : -1, 0);
    uv.push(0.5, t);
    const ringStart = up ? N * stride : 0;
    for (let j = 0; j < M; j++) {
      const a = ringStart + j, b = ringStart + j + 1;
      // ★巻き順に注意。リングは +Y から見ると時計回りに並んでいるので、
      //   (center,a,b) の法線は -Y を向く。上ぶたは逆順にしないと裏返る。
      //   裏返ったふたは本体パスで消え、輪郭パスだけが残って黒い点になる。
      if (up) idx.push(center, b, a);
      else    idx.push(center, a, b);
    }
  };
  if (capBottom) addCap(0, false);
  if (capTop)    addCap(1, true);

  // ★裏返り防止。spine が下向き（t とともに y が減る）だと接ベクトルの向きが
  //   ひっくり返り、法線が内側を向いてメッシュが裏返る。裏返ったまま描くと
  //   本体パスでカリングされて消え、輪郭パスだけが残って「真っ黒な塊」になる。
  //   ここで実測して、裏返っていたら法線と巻き順をまとめて直す。
  {
    let cx = 0, cy = 0, cz = 0;
    const vn = pos.length / 3;
    for (let i = 0; i < vn; i++) { cx += pos[i*3]; cy += pos[i*3+1]; cz += pos[i*3+2]; }
    cx /= vn; cy /= vn; cz /= vn;
    let vote = 0;
    for (let i = 0; i < vn; i += Math.max(1, (vn / 40) | 0)) {
      const dx = pos[i*3] - cx, dy = pos[i*3+1] - cy, dz = pos[i*3+2] - cz;
      vote += (nrm[i*3]*dx + nrm[i*3+1]*dy + nrm[i*3+2]*dz) >= 0 ? 1 : -1;
    }
    if (vote < 0) {
      for (let i = 0; i < nrm.length; i++) nrm[i] = -nrm[i];
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i+1]; idx[i+1] = idx[i+2]; idx[i+2] = t; }
    }
  }

  return {
    pos: new Float32Array(pos),
    nrm: new Float32Array(nrm),
    uv:  new Float32Array(uv),
    idx: (pos.length / 3) > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
    vertexCount: pos.length / 3,
  };
}

// ---------------- 裏返り検出 ----------------
// このプロジェクトで4回踏んだバグ：メッシュが裏返ると、本体パスで裏面カリング
// されて消え、輪郭パス（表を切って裏を描く）だけが残って「真っ黒な塊」になる。
// 三角形の巻き順から出した面の向きと、頂点にもたせた法線がそろっているかを
// 実測して、食いちがっていたら巻き順をまとめて直す。
function fixWinding(pos, nrm, idx) {
  let vote = 0;
  const step = Math.max(3, ((idx.length / 3 / 24) | 0) * 3);
  for (let i = 0; i + 2 < idx.length; i += step) {
    const a = idx[i], b = idx[i+1], c = idx[i+2];
    const ax=pos[a*3],ay=pos[a*3+1],az=pos[a*3+2];
    const bx=pos[b*3],by=pos[b*3+1],bz=pos[b*3+2];
    const cx=pos[c*3],cy=pos[c*3+1],cz=pos[c*3+2];
    const fx=(by-ay)*(cz-az)-(bz-az)*(cy-ay);
    const fy=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);
    const fz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
    const d = fx*nrm[a*3] + fy*nrm[a*3+1] + fz*nrm[a*3+2];
    if (d > 0) vote++; else if (d < 0) vote--;
  }
  if (vote < 0) {
    for (let i = 0; i + 2 < idx.length; i += 3) {
      const t = idx[i+1]; idx[i+1] = idx[i+2]; idx[i+2] = t;
    }
    return true;
  }
  return false;
}

// ---------------- 管（曲線にそって太さを持たせる） ----------------
// loftGeometry は断面を必ず XZ 平面に置くので、「上へ伸びる形」しか作れない。
// らせん（バネ）や曲がったパイプは、進む向きに対して垂直な断面が要るので、
// こちらを使う。向きは平行移動枠（ねじれを最小にする枠）で運ぶ。
//   path(t) → [x,y,z]、radius(t) → 太さ
function tubeGeometry(path, radius, segs = 48, radial = 8, closed = false) {
  const pos = [], nrm = [], uv = [], idx = [];
  const h = 1e-4;
  // 進行方向
  const tangent = t => {
    const a = path(Math.max(0, t - h)), b = path(Math.min(1, t + h));
    let d = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    return [d[0]/l, d[1]/l, d[2]/l];
  };
  // 最初の法線：進行方向と平行でない適当な軸から作る
  let T = tangent(0);
  let ref = Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let N = [
    ref[1]*T[2] - ref[2]*T[1],
    ref[2]*T[0] - ref[0]*T[2],
    ref[0]*T[1] - ref[1]*T[0],
  ];
  let nl = Math.hypot(N[0], N[1], N[2]) || 1; N = [N[0]/nl, N[1]/nl, N[2]/nl];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const Tn = tangent(t);
    // 前の法線を、新しい進行方向に垂直な面へ落としなおす（ねじれを最小にする）
    const dot = N[0]*Tn[0] + N[1]*Tn[1] + N[2]*Tn[2];
    let Nn = [N[0] - Tn[0]*dot, N[1] - Tn[1]*dot, N[2] - Tn[2]*dot];
    nl = Math.hypot(Nn[0], Nn[1], Nn[2]);
    if (nl < 1e-6) {
      ref = Math.abs(Tn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      Nn = [ref[1]*Tn[2]-ref[2]*Tn[1], ref[2]*Tn[0]-ref[0]*Tn[2], ref[0]*Tn[1]-ref[1]*Tn[0]];
      nl = Math.hypot(Nn[0], Nn[1], Nn[2]) || 1;
    }
    N = [Nn[0]/nl, Nn[1]/nl, Nn[2]/nl];
    const B = [
      Tn[1]*N[2] - Tn[2]*N[1],
      Tn[2]*N[0] - Tn[0]*N[2],
      Tn[0]*N[1] - Tn[1]*N[0],
    ];
    const c = path(t);
    const r = typeof radius === 'function' ? radius(t) : radius;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = N[0]*ca + B[0]*sa, ny = N[1]*ca + B[1]*sa, nz = N[2]*ca + B[2]*sa;
      pos.push(c[0] + nx*r, c[1] + ny*r, c[2] + nz*r);
      nrm.push(nx, ny, nz);
      uv.push(j / radial, t);
    }
  }
  const stride = radial + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i*stride + j, b = a + 1, c = a + stride, d = c + 1;
      // ★ロフトとは巻き順が逆になる。枠が (N,B,T) の右手系なので、
      //   (a,c,d) の順だと面が内側を向く。裏返ったまま描くと本体パスで
      //   カリングされて消え、輪郭パスだけが残って「黒い筒」になる。
      idx.push(a, d, c, a, b, d);
    }
  }
  // 念のため実測でも確かめる（この手の裏返りは何度も踏んでいる）
  fixWinding(pos, nrm, idx);
  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv),
    idx: (pos.length / 3) > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
    vertexCount: pos.length / 3,
  };
}

// ---------------- 球（惑星・目のドーム） ----------------
// 惑星は全部これ1個を使い回し、縞・大赤斑・極冠はフラグメント側で描く。
// vFrom/vTo を狭めるとドーム（目のふた）になる。
function sphereGeometry(segU = 32, segV = 24, opt = {}) {
  const vFrom = opt.vFrom ?? 0;      // 0=南極, 1=北極
  const vTo   = opt.vTo   ?? 1;
  const pos = [], nrm = [], uv = [], idx = [];
  for (let i = 0; i <= segV; i++) {
    const v = vFrom + (vTo - vFrom) * (i / segV);
    const phi = (v - 0.5) * Math.PI;          // -π/2..+π/2（緯度）
    const cy = Math.sin(phi), r = Math.cos(phi);
    for (let j = 0; j <= segU; j++) {
      const u = j / segU;
      const th = u * Math.PI * 2;             // 経度
      const x = r * Math.cos(th), z = r * Math.sin(th);
      pos.push(x, cy, z);
      nrm.push(x, cy, z);                     // 単位球なので位置がそのまま法線
      uv.push(u, v);
    }
  }
  const stride = segU + 1;
  for (let i = 0; i < segV; i++) {
    for (let j = 0; j < segU; j++) {
      const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1;
      idx.push(a, c, d,  a, d, b);
    }
  }
  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm),
    uv: new Float32Array(uv),
    idx: (pos.length / 3) > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
    vertexCount: pos.length / 3,
  };
}

// ---------------- 環（土星・天王星） ----------------
// XZ平面の環状帯。uv.x = 正規化半径(0=内側,1=外側)、uv.y = 角度。
// カッシーニの間隙はフラグメント側で uv.x から切り欠く。
function ringGeometry(rIn = 1.3, rOut = 2.3, seg = 96) {
  const pos = [], nrm = [], uv = [], idx = [];
  for (let ri = 0; ri < 2; ri++) {
    const r = ri === 0 ? rIn : rOut;
    for (let j = 0; j <= seg; j++) {
      const t = j / seg, a = t * Math.PI * 2;
      pos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      nrm.push(0, 1, 0);
      uv.push(ri, t);
    }
  }
  const stride = seg + 1;
  for (let j = 0; j < seg; j++) {
    const a = j, b = j + 1, c = stride + j, d = stride + j + 1;
    idx.push(a, c, d,  a, d, b);
  }
  // ★ここも巻き順が裏返る（面が下を向く）。通し忘れると、上から見たとき
  //   まるごとカリングされて「真っ黒な円ばん」になる。
  fixWinding(pos, nrm, idx);
  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm),
    uv: new Float32Array(uv), idx: new Uint16Array(idx),
    vertexCount: pos.length / 3,
  };
}

// ---------------- バッファ・属性 ----------------
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
const easeInOut = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
// 行きすぎて戻る。宙返りの回転や、ラベルがドンと出る演出に使う。
const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const rnd = (a, b) => a + Math.random() * (b - a);

// クリティカルダンプのバネ。目標値へ「行きすぎずに」追いつく。
// アニメの遷移をこれで作ると、ブレンド処理そのものが要らなくなる。
function spring(cur, vel, target, stiffness, dt) {
  const damping = 2 * Math.sqrt(stiffness);
  const a = (target - cur) * stiffness - vel * damping;
  const nv = vel + a * dt;
  return [cur + nv * dt, nv];
}

function hex2rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// 決定的な擬似乱数（シード付き）。日替わりシードや足場の見た目に使う。
// Math.random() と違って「同じ種なら必ず同じ結果」になる。
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
