// ============================================================
// shaders.js — オカンの おかたづけ
//   ・mesh   … オカン本体（部品ごとの剛体スキニング＝1ドローコールで全部）
//   ・inst   … かべ・ゆか・にもつ など同じ形をたくさん置くもの
//   ・outline… 背面法の輪郭線（mesh用・inst用）
//   ・bg     … 背景（画像ファイルは使わない）
//   ・shadow … 接地影
// ============================================================
'use strict';

const SH = {};
SH.BONES = 24;   // オカンの部品数の上限

// 部品ごとの剛体スキニング。
// チッチ（なめらかな生きもの）は2骨ブレンドだったが、オカンは服を着た人形なので
// 1頂点＝1部品でよい。aBone.x に部品番号、aBone.y は継ぎ目をなじませる重み。
const BONE_CHUNK = `
  int b0 = int(aBone.x);
  int b1 = int(aBone.z);
  mat4 sk  = uBones[b0]  * aBone.y + uBones[b1]  * aBone.w;
  mat4 skN = uBonesN[b0] * aBone.y + uBonesN[b1] * aBone.w;
`;

SH.meshVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aNrm;
in vec3 aONrm;   // 輪郭を押し出す向き（部品の中心から外向き）
in vec2 aUV;
in vec3 aCol;
in vec4 aParam;  // x=顔マスク(影を落とさない) y=つや z=テクスチャ混ぜ量 w=予備
in vec4 aBone;

uniform mat4 uProj, uView, uModel, uModelN;
uniform mat4 uBones[${SH.BONES}];
uniform mat4 uBonesN[${SH.BONES}];

out vec3 vN, vW, vCol, vParam;
out vec2 vUV;

void main(){
${BONE_CHUNK}
  vec4 p = sk * vec4(aPos, 1.0);
  vec3 n = mat3(skN) * aNrm;
  vec4 wp = uModel * p;
  vW = wp.xyz;
  vN = normalize(mat3(uModelN) * n);
  vUV = aUV; vCol = aCol; vParam = aParam.xyz;
  gl_Position = uProj * uView * wp;
}`;

SH.meshFS = `#version 300 es
precision highp float;
in vec3 vN, vW, vCol, vParam;
in vec2 vUV;

uniform vec3  uLightDir;
uniform vec3  uCamPos;
uniform vec3  uShadowTint;   // 影の色。明るさを落とすのではなく、色を青むらさきへ回す
uniform vec3  uRimCol;
uniform float uRimAmt;
uniform vec2  uToonEdge;     // 影の境目の幅。せまい=かたい／ひろい=やわらかい
uniform float uFlash;        // 白フラッシュ（クリアの瞬間など）
uniform vec3  uTint;
uniform sampler2D uTex;

out vec4 o;

void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  vec3 tex = texture(uTex, vUV).rgb;
  vec3 base = mix(vCol, tex * vCol, vParam.z);

  // 2段トゥーン。3段以上にすると急に安っぽくなる（チッチで実証ずみ）
  float h = dot(N, uLightDir) * 0.5 + 0.5;
  float s = smoothstep(uToonEdge.x, uToonEdge.y, h);
  // 顔には影を落とさない。目に影がかかった瞬間に不気味になる。
  s = mix(s, max(s, 0.88), vParam.x);
  vec3 c = mix(base * uShadowTint, base, s);

  // つや（服のてかり）。顔には出さない
  float spec = pow(max(dot(reflect(-uLightDir, N), V), 0.0), 24.0);
  c += vec3(1.0) * spec * vParam.y * (1.0 - vParam.x) * 0.45;

  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  c += uRimCol * rim * uRimAmt;

  c *= uTint;
  c = mix(c, vec3(1.0), uFlash);
  o = vec4(c, 1.0);
}`;

// ---------------- 輪郭線（背面法） ----------------
// ★押し出しには aONrm（部品中心から外向き）を使う。陰影用の aNrm で押すと
//   継ぎ目やふたの境目で線が割れる。
SH.outlineVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aONrm;
in vec4 aBone;
uniform mat4 uProj, uView, uModel, uModelN;
uniform mat4 uBones[${SH.BONES}];
uniform mat4 uBonesN[${SH.BONES}];
uniform float uOutline, uAspect;
void main(){
${BONE_CHUNK}
  vec4 p = sk * vec4(aPos, 1.0);
  vec3 n = mat3(skN) * aONrm;
  vec4 wp = uModel * p;
  vec3 wn = normalize(mat3(uModelN) * n);
  vec4 clip = uProj * uView * wp;
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
//  インスタンス描画（かべ・ゆか・おきば・にもつ）
//   iPos=置く場所 / iScale=大きさ / iRot=Y軸まわりの向き / iColor=色 / iParam=演出
// ============================================================
const INST_CHUNK = `
  float cy = cos(iRot), sy = sin(iRot);
  vec3 sp = aPos * iScale;
  vec3 rp = vec3(sp.x * cy + sp.z * sy, sp.y, -sp.x * sy + sp.z * cy);
  vec3 world = rp + iPos;
  vec3 rn = vec3(aNrm.x * cy + aNrm.z * sy, aNrm.y, -aNrm.x * sy + aNrm.z * cy);
`;

SH.instVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aNrm;
in vec3 aONrm;
in vec3 aCol;
in vec2 aUV;
in vec3 iPos;
in vec3 iScale;
in float iRot;
in vec3 iColor;
in float iParam;   // 0=ふつう 1=光る（おきばに入ったにもつ など）

uniform mat4 uProj, uView;
out vec3 vN, vW, vCol;
out vec2 vUV;
out float vParam;

void main(){
${INST_CHUNK}
  vN = normalize(rn); vW = world; vCol = aCol * iColor; vUV = aUV; vParam = iParam;
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

SH.instFS = `#version 300 es
precision highp float;
in vec3 vN, vW, vCol;
in vec2 vUV;
in float vParam;

uniform vec3 uLightDir, uCamPos, uShadowTint, uRimCol;
uniform float uRimAmt;
uniform vec2 uToonEdge;
uniform vec3 uTint;
uniform float uTime;
uniform float uUseTex;      // 1 なら 写真のテクスチャを貼る（木箱・レンガ）
uniform sampler2D uTex;
out vec4 o;

void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  vec3 base = vCol;
  if (uUseTex > 0.5) base = texture(uTex, vUV).rgb * vCol;
  float h = dot(N, uLightDir) * 0.5 + 0.5;
  float s = smoothstep(uToonEdge.x, uToonEdge.y, h);
  vec3 c = mix(base * uShadowTint, base, s);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  c += uRimCol * rim * uRimAmt;
  // おきばに入った にもつ は、じんわり光らせる（入った実感）
  c += base * vParam * (0.30 + 0.10 * sin(uTime * 3.0));
  c *= uTint;
  o = vec4(c, 1.0);
}`;

SH.instOutlineVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 aONrm;
in vec3 iPos;
in vec3 iScale;
in float iRot;
uniform mat4 uProj, uView;
uniform float uOutline, uAspect;
void main(){
  float cy = cos(iRot), sy = sin(iRot);
  vec3 sp = aPos * iScale;
  vec3 rp = vec3(sp.x * cy + sp.z * sy, sp.y, -sp.x * sy + sp.z * cy);
  vec3 world = rp + iPos;
  vec3 on = vec3(aONrm.x * cy + aONrm.z * sy, aONrm.y, -aONrm.x * sy + aONrm.z * cy);
  // 大きさで割って、細長い箱でも線の太さがそろうようにする
  vec3 wn = normalize(on / max(iScale, vec3(0.001)));
  vec4 clip = uProj * uView * vec4(world, 1.0);
  vec3 vn = normalize(mat3(uView) * wn);
  vec2 nClip = (uProj * vec4(vn, 0.0)).xy;
  float L = length(nClip);
  if (L > 1e-5) { nClip /= L; clip.xy += nClip * uOutline * clip.w * vec2(1.0, uAspect); }
  gl_Position = clip;
}`;

// ---------------- ゆか（おきばの枠や 格子を、模様として直接描く） ----------------
SH.floorVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec2 aUV;
uniform mat4 uProj, uView;
uniform vec3 uOrigin;    // ゆかの左おく（マス0,0の中心）
uniform vec2 uSize;      // 盤の大きさ（マス）
out vec2 vCell;          // マス単位の座標
out vec3 vW;
void main(){
  vec3 world = vec3(uOrigin.x + aPos.x * uSize.x, uOrigin.y, uOrigin.z + aPos.z * uSize.y);
  vCell = vec2(aPos.x * uSize.x, aPos.z * uSize.y);
  vW = world;
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

SH.floorFS = `#version 300 es
precision highp float;
in vec2 vCell;
in vec3 vW;
uniform vec3 uColA, uColB, uLine;
uniform float uTime;
out vec4 o;

// 木目っぽいゆらぎ
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.7, 289.1))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

void main(){
  vec2 g = fract(vCell);
  vec2 id = floor(vCell);
  // 市松（うっすら）。マスの区切りが見えないと、押した数を数えられない
  float checker = mod(id.x + id.y, 2.0);
  vec3 c = mix(uColA, uColB, checker * 0.55);
  // 木目
  float wood = noise(vec2(vCell.x * 2.2, vCell.y * 15.0)) * 0.06
             + noise(vec2(vCell.x * 9.0, vCell.y * 3.0)) * 0.04;
  c *= 1.0 - wood;
  // マスの境目の線
  vec2 d = min(g, 1.0 - g);
  float line = 1.0 - smoothstep(0.012, 0.03, min(d.x, d.y));
  c = mix(c, uLine, line * 0.45);
  o = vec4(c, 1.0);
}`;

// ---------------- 背景（画像は使わない） ----------------
SH.bgVS = `#version 300 es
precision highp float;
out vec2 vUV;
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

SH.bgFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec3 uTop, uBot;
uniform float uTime, uCheer;
out vec4 o;
void main(){
  vec3 c = mix(uBot, uTop, pow(vUV.y, 0.85));
  // まんなかが少し明るい（舞台の照明）
  float d = length((vUV - vec2(0.5, 0.62)) * vec2(1.25, 1.0));
  c *= 1.0 + 0.16 * (1.0 - smoothstep(0.10, 0.85, d));
  // クリアのときだけ、後ろにやわらかい光の輪
  if (uCheer > 0.001) {
    float ring = exp(-pow((d - 0.36) * 7.0, 2.0));
    c += vec3(1.0, 0.82, 0.90) * ring * uCheer * 0.5;
  }
  o = vec4(c, 1.0);
}`;

// ---------------- 接地影 ----------------
SH.shadowVS = `#version 300 es
precision highp float;
in vec3 aPos;
in vec3 iPos;
in vec3 iScale;
uniform mat4 uProj, uView;
out vec2 vUV;
void main(){
  vUV = aPos.xz;
  vec3 world = vec3(aPos.x * iScale.x, 0.0, aPos.z * iScale.z) + iPos;
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

SH.shadowFS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform float uAlpha;
uniform vec3 uCol;
out vec4 o;
void main(){
  float d = length(vUV);
  float a = (1.0 - smoothstep(0.25, 0.5, d)) * uAlpha;
  if (a < 0.002) discard;
  o = vec4(uCol, a);
}`;

// ---------------- つぶ（ほこり・きらめき） ----------------
SH.partVS = `#version 300 es
precision highp float;
in vec3 iPos;
in float iSize;
in vec3 iColor;
in float iAlpha;
uniform mat4 uProj, uView;
uniform float uPix;
out vec3 vCol;
out float vA;
void main(){
  vec4 vp = uView * vec4(iPos, 1.0);
  gl_Position = uProj * vp;
  gl_PointSize = max(1.0, iSize * uPix / max(0.2, -vp.z));
  vCol = iColor; vA = iAlpha;
}`;

SH.partFS = `#version 300 es
precision highp float;
in vec3 vCol;
in float vA;
out vec4 o;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float a = (1.0 - smoothstep(0.24, 0.5, r)) * vA;
  if (a < 0.004) discard;
  o = vec4(vCol * a, a);
}`;
