// ============================================================
// gl.js — WebGL2の土台（行列・シェーダー）
//   otton3d.js の行列・シェーダーの考え方を折り紙用に作り直したもの。
//   ★スキニングは「1頂点=1パネルに100%」の剛体折り紙。ウェイト混ぜ合わせは無い
//     （紙の面は折り目でしか曲がらないので、ふつうのキャラのような
//      複数ボーンのブレンドは要らない＝uBonesを引くだけでよい）。
// ============================================================
'use strict';

const OGL = (function () {
  // ---------- 4x4行列ヘルパー（列優先、otton3d.jsと同じ並び） ----------
  function mat4Identity() {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }
  function mat4Multiply(a, b) {
    const out = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[0 * 4 + r] * b[c * 4 + 0] + a[1 * 4 + r] * b[c * 4 + 1] +
          a[2 * 4 + r] * b[c * 4 + 2] + a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }
  function mat4Translate(t) {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1];
  }
  // 原点を通り axis(単位ベクトル) まわりに angle だけ回す回転行列（ロドリゲスの式）
  function mat4FromAxisAngle(axis, angle) {
    const [x, y, z] = axis;
    const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    return [
      t * x * x + c,     t * x * y + s * z, t * x * z - s * y, 0,
      t * x * y - s * z, t * y * y + c,     t * y * z + s * x, 0,
      t * x * z + s * y, t * y * z - s * x, t * z * z + c,     0,
      0, 0, 0, 1,
    ];
  }
  // 任意の点(origin)を通り axis まわりに angle だけ回す＝ T(o)・R・T(-o)
  function mat4HingeRotate(origin, axis, angle) {
    const R = mat4FromAxisAngle(axis, angle);
    return mat4Multiply(mat4Translate(origin), mat4Multiply(R, mat4Translate([-origin[0], -origin[1], -origin[2]])));
  }
  function vecSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function vecAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function vecScale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function vecDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function vecCross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function vecLen(a) { return Math.hypot(a[0], a[1], a[2]); }
  function vecNorm(a) { const l = vecLen(a) || 1e-9; return [a[0] / l, a[1] / l, a[2] / l]; }
  // 点pに行列mを適用（w=1として）
  function vecApply(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    ];
  }
  // 方向ベクトルvに行列mを適用（w=0）＝平行移動を無視
  function vecApplyDir(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
    ];
  }

  // ---------- カメラ（otton3d.js viewMat と同じ考え方） ----------
  function viewMat(eyeY, dist, pitch, yaw) {
    // 引く(dist) → X軸で見上げ/見下ろし(pitch) → Y軸で回りこみ(yaw) → 中心を原点へ(-eyeY)
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const rotY = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1];
    const rotX = [1, 0, 0, 0, 0, cp, sp, 0, 0, -sp, cp, 0, 0, 0, 0, 1];
    const trans = mat4Translate([0, -eyeY, -dist]);
    return mat4Multiply(trans, mat4Multiply(rotX, rotY));
  }
  function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ];
  }

  // ---------- シェーダー ----------
  function compile(gl, src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('shader compile: ' + log);
    }
    return s;
  }
  function link(gl, vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, vsSrc, gl.VERTEX_SHADER));
    gl.attachShader(p, compile(gl, fsSrc, gl.FRAGMENT_SHADER));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('program link: ' + log);
    }
    return p;
  }

  // 4x4逆行列（タッチ位置→3Dレイの逆投影に使う。一般的なコファクター展開）
  function mat4Invert(m) {
    const inv = new Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    if (Math.abs(det) < 1e-12) return mat4Identity();
    det = 1 / det;
    for (let i = 0; i < 16; i++) inv[i] *= det;
    return inv;
  }
  // w=1の点にmを掛けてw除算まで行う（プロジェクション行列を通すときに使う）
  function vecApplyW(m, p) {
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12] * p[3];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13] * p[3];
    const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14] * p[3];
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15] * p[3];
    return [x, y, z, w];
  }
  // スクリーン座標(px)→ワールド空間のレイ（origin, dir）。逆VP行列でNDCの近遠2点を戻して差を取る。
  function screenToRay(ndcX, ndcY, viewProj) {
    const inv = mat4Invert(viewProj);
    const near = vecApplyW(inv, [ndcX, ndcY, -1, 1]);
    const far = vecApplyW(inv, [ndcX, ndcY, 1, 1]);
    const p0 = [near[0] / near[3], near[1] / near[3], near[2] / near[3]];
    const p1 = [far[0] / far[3], far[1] / far[3], far[2] / far[3]];
    return { origin: p0, dir: vecNorm(vecSub(p1, p0)) };
  }

  return {
    mat4Identity, mat4Multiply, mat4Translate, mat4FromAxisAngle, mat4HingeRotate, mat4Invert,
    vecSub, vecAdd, vecScale, vecDot, vecCross, vecLen, vecNorm, vecApply, vecApplyDir, vecApplyW,
    viewMat, perspective, screenToRay, compile, link,
  };
})();

if (typeof window !== 'undefined') window.OGL = OGL;
