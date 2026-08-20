// ============================================================
// shaders.js — GLSL
//   キャラ（トゥーン＋スキニング）／輪郭線（背面法）／接地影／背景
// ============================================================
'use strict';

const SH = {};

// 骨の本数。chicchi.js の BONE_COUNT と必ずそろえること。
SH.BONES = 9;

// ---------------- 全画面クアッド（3頂点の三角形1枚で覆う） ----------------
SH.quadVS = `#version 300 es
precision highp float;
out vec2 vUV;
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// ============================================================
//  キャラ本体
// ============================================================

// 骨のブレンドは2本まで。この形なら十分で、uniform も軽い。
const SKIN_CHUNK = `
  mat4 sk  = uBones[int(aBone.x)]  * aBone.y + uBones[int(aBone.z)]  * aBone.w;
  mat4 skN = uBonesN[int(aBone.x)] * aBone.y + uBonesN[int(aBone.z)] * aBone.w;
`;

SH.toonVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aNrm;
in vec3 aONrm;
in vec2 aUV;
in vec3 aCol;
in vec4 aParam;   // x=faceMask, y=予備, z=texBlend, w=予備
in vec4 aBone;    // x=骨1, y=重み1, z=骨2, w=重み2

uniform mat4 uProj, uView, uModel, uModelN;
uniform mat4 uBones[${SH.BONES}];
uniform mat4 uBonesN[${SH.BONES}];

out vec3 vN;
out vec3 vW;
out vec2 vUV;
out vec3 vCol;
out vec3 vParam;

void main(){
${SKIN_CHUNK}
  vec4 p = sk * vec4(aPos, 1.0);
  vec3 n = mat3(skN) * aNrm;
  vec4 wp = uModel * p;
  vW = wp.xyz;
  vN = normalize(mat3(uModelN) * n);
  vUV = aUV; vCol = aCol; vParam = aParam.xyz;
  gl_Position = uProj * uView * wp;
}`;

SH.toonFS = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vW;
in vec2 vUV;
in vec3 vCol;
in vec3 vParam;

uniform vec3  uLightDir;    // 光の向き（面から光源へ、正規化ずみ）
uniform vec3  uCamPos;
uniform vec3  uBaseTint;    // 全体にかける明るさ。太陽から遠いほど暗くする（逆二乗）
uniform vec3  uShadowTint;  // 影の色。明度を落とすのではなく色相を青紫へ回す
uniform vec3  uRimCol;
uniform float uRimAmt;
uniform vec2  uToonEdge;    // 影の境目の幅。せまい=硬い、広い=やわらかい
uniform float uEmis;        // 自発光。深宇宙でチッチ自身がうっすら光る
uniform float uFlash;       // 被弾の白フラッシュ
uniform sampler2D uTex;

out vec4 o;

void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  vec3 base = mix(vCol, texture(uTex, vUV).rgb, vParam.z);

  // --- 2段トゥーン。3段以上にすると急に安っぽくなる ---
  // ただし境目を鋭くしすぎると、体に泥をなすったような硬い影が出て
  // 「不気味」に見える。子ども向けのマスコットは、ここをやわらかくとる。
  float h = dot(N, uLightDir) * 0.5 + 0.5;
  float s = smoothstep(uToonEdge.x, uToonEdge.y, h);
  // 顔には影を落とさない。目に影がかかった瞬間に不気味になる。
  s = mix(s, max(s, 0.86), vParam.x);

  vec3 c = mix(base * uShadowTint, base, s);
  c *= uBaseTint;

  // --- リムライト。この1行で立体が背景から抜ける ---
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  c += uRimCol * rim * uRimAmt;

  c += base * uEmis;
  c = mix(c, vec3(1.0), uFlash);
  o = vec4(c, 1.0);
}`;

// ---------------- 輪郭線（背面法／inverted hull） ----------------
// 表面を裏返して法線方向へふくらませ、黒で描く。
// ★押し出しには aONrm（部品中心から外向き）を使う。陰影用の aNrm で押すと
//   UV継ぎ目やふたの境目で線が割れる。
SH.outlineVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aONrm;
in vec4 aBone;

uniform mat4 uProj, uView, uModel, uModelN;
uniform mat4 uBones[${SH.BONES}];
uniform mat4 uBonesN[${SH.BONES}];
uniform float uOutline;   // 画面上の線の太さ（NDC）
uniform float uAspect;

void main(){
${SKIN_CHUNK}
  vec4 p = sk * vec4(aPos, 1.0);
  vec3 n = mat3(skN) * aONrm;
  vec4 wp = uModel * p;
  vec3 wn = normalize(mat3(uModelN) * n);

  vec4 clip = uProj * uView * wp;
  // クリップ空間で押すと、遠近によらず画面上の太さが一定になる
  vec3 vn = normalize(mat3(uView) * wn);
  vec2 nClip = (uProj * vec4(vn, 0.0)).xy;
  float L = length(nClip);
  if (L > 1e-5) {
    nClip /= L;
    clip.xy += nClip * uOutline * clip.w * vec2(1.0, uAspect);
  }
  gl_Position = clip;
}`;

SH.outlineFS = `#version 300 es
precision highp float;
uniform vec3 uOutlineCol;
out vec4 o;
void main(){ o = vec4(uOutlineCol, 1.0); }`;

// ============================================================
//  インスタンス描画（足場・アイテム・岩など、同じ形をたくさん出すもの）
//   1回のドローコールで全部描く。キャラと違って骨は要らない。
// ============================================================
const INST_CHUNK = `
  // 円筒のまわりに置く。iInst.x = 円周上の角度、iInst.y = 高さ、iInst.z = 半径
  float ang = iInst.x;
  float ca = cos(ang), sa = sin(ang);
  vec3 sp = aPos * iScale;
  // Y軸まわりに自分の向きぶん回してから、円筒の位置へ運ぶ
  float sy = sin(iRot), cy = cos(iRot);
  vec3 rp = vec3(sp.x * cy + sp.z * sy, sp.y, -sp.x * sy + sp.z * cy);
  // 円筒の接線方向＝x、法線方向＝外向き
  vec3 tangent = vec3(ca, 0.0, -sa);
  vec3 outward = vec3(sa, 0.0, ca);
  vec3 world = outward * iInst.z + vec3(0.0, iInst.y, 0.0)
             + tangent * rp.x + vec3(0.0, rp.y, 0.0) + outward * rp.z;
  vec3 nrp = vec3(aNrm.x * cy + aNrm.z * sy, aNrm.y, -aNrm.x * sy + aNrm.z * cy);
  vec3 wn = normalize(tangent * nrp.x + vec3(0.0, nrp.y, 0.0) + outward * nrp.z);
`;

SH.instVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aNrm;
in vec3 aONrm;
in vec3 aCol;     // 頂点ごとの色（インスタンス色への倍率）
in vec3 iInst;    // x=角度, y=高さ, z=円筒の半径
in vec3 iScale;
in float iRot;
in vec3 iColor;
in float iParam;  // 0..1 消えかけの足場などのフェード

uniform mat4 uProj, uView;
out vec3 vN, vW, vCol;
out float vFade;

void main(){
${INST_CHUNK}
  vN = wn; vW = world; vCol = iColor * aCol; vFade = iParam;
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

SH.instFS = `#version 300 es
precision highp float;
in vec3 vN, vW, vCol;
in float vFade;
uniform vec3 uLightDir, uCamPos, uBaseTint, uShadowTint, uRimCol;
uniform vec2 uToonEdge;
uniform float uRimAmt, uEmis;
out vec4 o;
void main(){
  if (vFade <= 0.02) discard;
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  float h = dot(N, uLightDir) * 0.5 + 0.5;
  float s = smoothstep(uToonEdge.x, uToonEdge.y, h);
  vec3 c = mix(vCol * uShadowTint, vCol, s) * uBaseTint;
  c += uRimCol * pow(1.0 - max(dot(N, V), 0.0), 3.0) * uRimAmt;
  c += vCol * uEmis;
  o = vec4(c, vFade);
}`;

SH.instOutlineVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aNrm;
in vec3 aONrm;
in vec3 iInst;
in vec3 iScale;
in float iRot;
in float iParam;
uniform mat4 uProj, uView;
uniform float uOutline, uAspect;
out float vFade;
void main(){
${INST_CHUNK}
  // 押し出しには輪郭用の法線（部品中心から外向き）を使う
  vec3 orp = vec3(aONrm.x * cy + aONrm.z * sy, aONrm.y, -aONrm.x * sy + aONrm.z * cy);
  vec3 own = normalize(tangent * orp.x + vec3(0.0, orp.y, 0.0) + outward * orp.z);
  vFade = iParam;
  vec4 clip = uProj * uView * vec4(world, 1.0);
  vec3 vn = normalize(mat3(uView) * own);
  vec2 nClip = (uProj * vec4(vn, 0.0)).xy;
  float L = length(nClip);
  if (L > 1e-5) {
    nClip /= L;
    clip.xy += nClip * uOutline * clip.w * vec2(1.0, uAspect);
  }
  gl_Position = clip;
}`;

SH.instOutlineFS = `#version 300 es
precision highp float;
in float vFade;
uniform vec3 uOutlineCol;
out vec4 o;
void main(){
  if (vFade <= 0.02) discard;
  o = vec4(uOutlineCol, vFade);
}`;

// ============================================================
//  つぶ（パーティクル）
//   着地のけむり、こわれ雲の破片、⭐のきらめき、ロケットの炎。
//   カメラの向きに合わせた板1枚（ビルボード）をインスタンスで並べる。
// ============================================================
SH.partVS = `#version 300 es
precision highp float;
in vec2 aCorner;
in vec3 iPos;
in vec4 iAttr;    // x=大きさ, y=濃さ, z=種類, w=回り
in vec3 iCol;
uniform mat4 uProj, uView;
uniform vec3 uRight, uUp;
out vec2 vUV;
out vec4 vAttr;
out vec3 vCol;
void main(){
  vUV = aCorner;
  vAttr = iAttr;
  vCol = iCol;
  float c = cos(iAttr.w), s = sin(iAttr.w);
  vec2 q = vec2(aCorner.x * c - aCorner.y * s, aCorner.x * s + aCorner.y * c) * iAttr.x;
  vec3 world = iPos + uRight * q.x + uUp * q.y;
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

SH.partFS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec4 vAttr;
in vec3 vCol;
uniform float uPremul;   // 1=加算（色をαで先にかける） 0=ふつうの半とうめい
out vec4 o;
void main(){
  float d = length(vUV);
  float kind = vAttr.z;
  float a;
  if (kind < 0.5) {
    a = smoothstep(1.0, 0.15, d);              // ふんわりしたけむり
  } else if (kind < 1.5) {
    a = smoothstep(1.0, 0.0, d) * smoothstep(0.75, 0.35, d) + smoothstep(0.35, 0.0, d);
  } else if (kind < 2.5) {
    // 破片：四角いかけら
    float m = max(abs(vUV.x), abs(vUV.y));
    a = step(m, 0.72);
  } else {
    // 十字のきらめき
    float cross = min(abs(vUV.x), abs(vUV.y));
    a = smoothstep(0.16, 0.0, cross) * smoothstep(1.0, 0.25, d);
  }
  a *= vAttr.y;
  if (a <= 0.004) discard;
  o = vec4(mix(vCol, vCol * a, uPremul), a);
}`;

// ---------------- 接地影（ブロブシャドウ） ----------------
// 低予算3Dが浮いて見える原因の第一位が「影がないこと」。
// 楕円のぼけた影を1枚落とすだけで地に足がつく。
// ジャンプゲームでは着地点の予測にもなるので、ゲーム性にも効いている。
SH.blobVS = `#version 300 es
precision highp float;
in vec2 aCorner;
uniform mat4 uProj, uView;
uniform vec3 uCenter;
uniform vec2 uRadius;
out vec2 vUV;
void main(){
  vUV = aCorner;
  vec3 p = uCenter + vec3(aCorner.x * uRadius.x, 0.0, aCorner.y * uRadius.y);
  gl_Position = uProj * uView * vec4(p, 1.0);
}`;

SH.blobFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform float uAlpha;
uniform vec3  uColor;
out vec4 o;
void main(){
  float d = length(vUV);
  float a = smoothstep(1.0, 0.15, d) * uAlpha;
  if (a <= 0.001) discard;
  o = vec4(uColor, a);
}`;

// ---------------- 空（プロシージャル。画像ファイルは使わない）----------------
// ★星はカメラの角度を混ぜてから散らす。画面座標だけで散らすと、
//   カメラが回ったとき星が画面に貼りついてきて、宇宙に見えなくなる。
SH.skyFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec3  uTop, uBot;
uniform float uStars;    // 星の濃さ（高度でじわっと出す）
uniform float uTime;
uniform float uCamAng;   // カメラの向き（円筒のまわり）
uniform float uAspect;
out vec4 o;

float hash21(vec2 p){
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

// 星をひと粒描く。セルに区切って、それぞれの中に1つ置く。
float starLayer(vec2 uv, float density, float seed){
  vec2 g = uv * density;
  vec2 id = floor(g), f = fract(g);
  float h = hash21(id + seed);
  if (h < 0.86) return 0.0;                       // まばらに置く
  vec2 c = vec2(hash21(id + seed + 3.1), hash21(id + seed + 7.7));
  float d = length(f - c);
  float tw = 0.65 + 0.35 * sin(uTime * 1.7 + h * 40.0);   // またたき（ゆっくり）
  return smoothstep(0.10, 0.0, d) * tw * (0.4 + h * 0.6);
}

void main(){
  vec3 c = mix(uBot, uTop, pow(vUV.y, 0.85));
  if (uStars > 0.001) {
    // 画面の横位置にカメラの角度を足して、星をワールドに固定する
    vec2 p = (vUV - 0.5) * vec2(uAspect, 1.0);
    vec2 sky = vec2(uCamAng * 0.62 + p.x * 0.9, p.y);
    float s = starLayer(sky, 16.0, 0.0) * 0.9
            + starLayer(sky, 31.0, 5.3) * 0.5
            + starLayer(sky, 55.0, 11.9) * 0.28;
    c += vec3(0.92, 0.95, 1.0) * s * uStars;
  }
  vec2 d = vUV - 0.5;
  c *= 1.0 - dot(d, d) * 0.42;                    // ふちを少し落とす
  o = vec4(c, 1.0);
}`;

// ---------------- プレビュー用の背景 ----------------
// 本番の biome 背景（skyFS）は後のフェーズで作る。
// ここでは「チッチが安っぽく見えないか」を判定するための無地に近い背景。
SH.previewBgFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec3 uTop, uBot;
uniform float uVignette;
out vec4 o;
void main(){
  vec3 c = mix(uBot, uTop, pow(vUV.y, 0.85));
  vec2 d = vUV - 0.5;
  c *= 1.0 - dot(d, d) * uVignette;
  o = vec4(c, 1.0);
}`;
