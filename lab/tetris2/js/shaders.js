// ============================================================
// shaders.js — GLSL ES 3.00
//   背景 / ブロック / パーティクル / ポストプロセス
// ============================================================
'use strict';

const SH = {};

// ------------------------------------------------------------
// 全画面三角形（頂点属性なし）
// ------------------------------------------------------------
SH.quadVS = `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// ------------------------------------------------------------
// 背景：ネオン・グリッドトンネル＋星＋オーロラ
// ------------------------------------------------------------
SH.bgFS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2  uRes;
uniform float uTime;
uniform float uHue;     // レベルで色相を回す 0..1
uniform float uPulse;   // BGMの拍で 0..1
uniform float uSpeed;   // 速度感 0..1
uniform float uDanger;  // ピンチ度 0..1

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 hue2rgb(float h){
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
  return clamp(min(k, 4.0 - k), 0.0, 1.0);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;   // 中心原点・アスペクト補正
  float t = uTime;

  vec3 baseA = vec3(0.008, 0.011, 0.034);
  vec3 baseB = vec3(0.026, 0.012, 0.062);
  vec3 col = mix(baseA, baseB, smoothstep(-0.6, 0.7, uv.y));

  // --- 遠景の星 ---
  vec2 sp = uv * 22.0 + vec2(0.0, t * 0.25 * (0.4 + uSpeed));
  vec2 cell = floor(sp);
  vec2 f = fract(sp) - 0.5;
  float h = hash(cell);
  if (h > 0.93) {
    float tw = 0.55 + 0.45 * sin(t * 3.0 + h * 40.0);
    float d = length(f);
    col += vec3(0.75, 0.85, 1.0) * tw * smoothstep(0.16, 0.0, d) * 0.40;
  }

  // --- オーロラ（低周波の帯） ---
  float a1 = sin(uv.x * 2.1 + t * 0.35) * 0.28 + sin(uv.x * 4.7 - t * 0.21) * 0.12;
  float band = exp(-pow((uv.y - 0.22 + a1) * 3.4, 2.0));
  vec3 auroraC = mix(vec3(0.10, 0.55, 1.0), hue2rgb(uHue + 0.12), 0.55);
  col += auroraC * band * 0.085;
  float band2 = exp(-pow((uv.y + 0.34 - a1 * 0.8) * 4.2, 2.0));
  col += mix(vec3(0.95, 0.20, 0.75), hue2rgb(uHue + 0.5), 0.4) * band2 * 0.06;

  // --- 上下のパースグリッド（シンセウェイブ） ---
  float horizon = 0.03;
  float ay = abs(uv.y - horizon);
  if (ay > 0.012) {
    float z = 0.55 / ay;                             // 奥行き
    float scroll = t * (1.1 + uSpeed * 2.2);
    float gz = fract(z * 0.90 + scroll);
    float gx = fract(uv.x * z * 2.20 + 0.5);
    float w = clamp(0.035 * z, 0.035, 0.35);         // 遠くの線は太らせる（ジャギ防止）
    float lineZ = smoothstep(1.0 - w, 1.0, gz) + smoothstep(w, 0.0, gz);
    float lineX = smoothstep(0.965, 1.0, gx) + smoothstep(0.035, 0.0, gx);
    float fade = exp(-z * 0.055) * smoothstep(0.0, 0.10, ay);
    vec3 gcol = mix(vec3(0.15, 0.75, 1.0), hue2rgb(uHue), 0.45);
    if (uv.y < horizon) gcol = mix(gcol, vec3(1.0, 0.25, 0.7), 0.35);
    col += gcol * (lineZ * 0.42 + lineX * 0.26) * fade * (0.34 + 0.30 * uPulse);
  }

  // --- 盤面の後ろの大きな光（ステージ照明） ---
  float glow = exp(-dot(uv * vec2(1.55, 0.85), uv * vec2(1.55, 0.85)) * 2.6);
  col += mix(vec3(0.12, 0.30, 0.85), hue2rgb(uHue + 0.05), 0.4) * glow * (0.13 + 0.09 * uPulse);

  // --- 上へ流れるスピードライン ---
  float sl = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float x = fract(hash(vec2(fi, 3.0)) + fi * 0.37) * 2.0 - 1.0;
    float y = fract(hash(vec2(fi, 7.0)) - t * (0.25 + 0.55 * uSpeed) - fi * 0.2) * 2.4 - 1.2;
    sl += exp(-pow((uv.x - x) * 60.0, 2.0)) * exp(-pow((uv.y - y) * 3.0, 2.0));
  }
  col += vec3(0.5, 0.85, 1.0) * sl * 0.20 * uSpeed;

  // --- ピンチ時は画面のふちが赤く脈打つ ---
  col += vec3(0.42, 0.03, 0.10) * uDanger * (0.35 + 0.30 * sin(t * 7.0))
         * smoothstep(0.15, 0.80, length(uv * vec2(1.3, 0.9)));

  outColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------
// ブロック（インスタンシング／擬似ベベル＋ネオン枠）
// ------------------------------------------------------------
SH.blockVS = `#version 300 es
in vec3 aPos;
in vec3 aNrm;
in vec3 aTan;
in vec3 aBit;
in vec2 aUv;

in vec3  iPos;      // 中心座標
in vec3  iScale;    // 各軸のスケール
in vec3  iColor;
in vec4  iParam;    // x:emissive y:alpha z:edgeGain w:seed
in vec4  iRot;      // x,y,z:回転角(rad) w:未使用

uniform mat4 uVP;
uniform vec3 uEye;

out vec3 vN, vT, vB, vW, vColor;
out vec2 vUv;
out vec4 vParam;

mat3 rotMat(vec3 r){
  float cx = cos(r.x), sx = sin(r.x);
  float cy = cos(r.y), sy = sin(r.y);
  float cz = cos(r.z), sz = sin(r.z);
  mat3 rx = mat3(1.0,0.0,0.0, 0.0,cx,sx, 0.0,-sx,cx);
  mat3 ry = mat3(cy,0.0,-sy, 0.0,1.0,0.0, sy,0.0,cy);
  mat3 rz = mat3(cz,sz,0.0, -sz,cz,0.0, 0.0,0.0,1.0);
  return rz * ry * rx;
}

void main(){
  mat3 R = rotMat(iRot.xyz);
  vec3 world = R * (aPos * iScale) + iPos;
  vW = world;
  vN = normalize(R * aNrm);
  vT = normalize(R * aTan);
  vB = normalize(R * aBit);
  vUv = aUv;
  vColor = iColor;
  vParam = iParam;
  gl_Position = uVP * vec4(world, 1.0);
}`;

SH.blockFS = `#version 300 es
precision highp float;
in vec3 vN, vT, vB, vW, vColor;
in vec2 vUv;
in vec4 vParam;
out vec4 outColor;

uniform vec3  uEye;
uniform float uTime;

void main(){
  float emis  = vParam.x;
  float alpha = vParam.y;
  float edgeG = vParam.z;
  float seed  = vParam.w;

  // edgeGain が負のときは陰影なしのベタ塗り（影・板もの用）
  if (edgeG < 0.0) { outColor = vec4(vColor + vec3(emis), alpha); return; }

  // ---- 擬似ベベル：面のふちで法線をタンジェント方向へ倒す ----
  vec2 e = vUv - 0.5;
  float bw = 0.30;                      // ベベル幅
  vec2 bend = sign(e) * smoothstep(0.5 - bw, 0.5, abs(e)) ;
  vec3 N = normalize(vN + (vT * bend.x + vB * bend.y) * 0.85);

  vec3 V = normalize(uEye - vW);

  // ---- ライティング ----
  vec3 keyDir  = normalize(vec3(-0.35, 0.80, 0.55));
  vec3 fillDir = normalize(vec3( 0.75, 0.05, 0.35));
  vec3 keyCol  = vec3(1.00, 0.95, 0.88) * 0.92;
  vec3 fillCol = vec3(0.25, 0.55, 1.00) * 0.40;

  float nk = max(dot(N, keyDir), 0.0);
  float nf = max(dot(N, fillDir), 0.0);
  vec3 amb = mix(vec3(0.03, 0.04, 0.10), vec3(0.09, 0.13, 0.26), N.y * 0.5 + 0.5);

  vec3 base = vColor;
  vec3 col = base * (amb + keyCol * nk + fillCol * nf) * 1.18;

  // ---- スペキュラ（つやのある樹脂／ガラス感） ----
  vec3 H = normalize(keyDir + V);
  float spec = pow(max(dot(N, H), 0.0), 68.0);
  col += keyCol * spec * 0.55 * min(edgeG, 1.0);
  vec3 H2 = normalize(fillDir + V);
  col += fillCol * pow(max(dot(N, H2), 0.0), 30.0) * 0.3;

  // ---- フレネルのリムライト ----
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
  col += mix(base, vec3(0.55, 0.85, 1.0), 0.45) * fres * 0.75;

  // ---- 面内のネオン枠（TRON風の溝） ----
  float d = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float frame = exp(-pow((d - 0.115) / 0.042, 2.0));
  float pulse = 0.72 + 0.28 * sin(uTime * 2.6 + seed * 6.28);
  col += mix(base, vec3(1.0), 0.30) * frame * (0.75 * edgeG) * pulse;

  // ---- 中央の暗いパネル（コントラストで枠を立たせる） ----
  col *= 1.0 - smoothstep(0.20, 0.44, d) * 0.26;

  // ---- 発光（ロック時・ライン消し時の白飛び） ----
  col += (base * 2.4 + vec3(0.22)) * emis;

  outColor = vec4(col, alpha);
}`;

// ------------------------------------------------------------
// パーティクル（ビルボード／加算合成）
//   kind 0:火花  1:リング  2:ライン光  3:きらめき
// ------------------------------------------------------------
SH.partVS = `#version 300 es
in vec2 aCorner;
in vec3 iPos;
in vec4 iColor;      // rgb + alpha
in vec4 iAttr;       // x:size y:kind z:rot w:aspect

uniform mat4 uVP;
uniform vec3 uRight, uUp;

out vec2 vUv;
out vec4 vColor;
out float vKind;

void main(){
  vUv = aCorner;
  vColor = iColor;
  vKind = iAttr.y;
  float s = iAttr.x;
  float c = cos(iAttr.z), sn = sin(iAttr.z);
  vec2 p = vec2(aCorner.x * c - aCorner.y * sn, aCorner.x * sn + aCorner.y * c);
  vec3 world = iPos + uRight * (p.x * s * iAttr.w) + uUp * (p.y * s);
  gl_Position = uVP * vec4(world, 1.0);
}`;

SH.partFS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vColor;
in float vKind;
out vec4 outColor;

void main(){
  float r = length(vUv);
  float a = 0.0;
  if (vKind < 0.5) {                       // 火花：芯のある点光
    a = exp(-r * r * 7.0) + exp(-r * 22.0) * 0.7;
  } else if (vKind < 1.5) {                // リング（衝撃波）
    a = exp(-pow((r - 0.78) * 9.0, 2.0));
  } else if (vKind < 2.5) {                // 横に伸びる光の帯
    a = exp(-pow(vUv.y * 3.2, 2.0)) * smoothstep(1.0, 0.15, abs(vUv.x));
  } else {                                 // 十字のきらめき
    float cross_ = exp(-pow(vUv.x * 22.0, 2.0)) + exp(-pow(vUv.y * 22.0, 2.0));
    a = cross_ * exp(-r * 1.9) + exp(-r * r * 24.0);
  }
  a *= vColor.a;
  if (a < 0.003) discard;
  outColor = vec4(vColor.rgb * a, a);
}`;

// ------------------------------------------------------------
// ポスト：ブライトパス
// ------------------------------------------------------------
SH.brightFS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform float uThreshold, uKnee;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = max(max(c.r, c.g), c.b);
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  outColor = vec4(c * k * uKnee, 1.0);
}`;

// ------------------------------------------------------------
// ポスト：分離ガウスぼかし（9タップ）
// ------------------------------------------------------------
SH.blurFS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uDir;          // テクセル単位の方向
void main(){
  vec3 sum = texture(uTex, vUv).rgb * 0.2270270270;
  sum += (texture(uTex, vUv + uDir * 1.3846153846).rgb
        + texture(uTex, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
  sum += (texture(uTex, vUv + uDir * 3.2307692308).rgb
        + texture(uTex, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
  outColor = vec4(sum, 1.0);
}`;

// ------------------------------------------------------------
// ポスト：合成（ブルーム＋アナモルフィック＋色収差＋衝撃波＋粒子＋トーンマップ）
// ------------------------------------------------------------
SH.compositeFS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene, uBloom1, uBloom2, uStreak;
uniform vec2  uRes;
uniform float uTime;
uniform float uBloom;     // ブルーム強度
uniform float uCA;        // 色収差
uniform float uFlash;     // 白フラッシュ
uniform vec3  uFlashCol;
uniform float uVignette;
uniform float uGrain;
uniform vec4  uShock;     // xy:中心(0..1) z:進行(0..1、0以下で無効) w:強さ
uniform float uSat;
uniform float uFade;      // 0=通常 1=暗転

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 aces(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main(){
  vec2 uv = vUv;
  vec2 center = uv - 0.5;

  // --- 衝撃波によるUVの押し出し ---
  if (uShock.z > 0.0) {
    vec2 d = uv - uShock.xy;
    d.x *= uRes.x / uRes.y;
    float dist = length(d);
    float ring = exp(-pow((dist - uShock.z * 0.85) * 9.0, 2.0));
    uv += normalize(d + 1e-5) * ring * uShock.w * (1.0 - uShock.z) * 0.026;
    center = uv - 0.5;
  }

  // --- 色収差（画面外周ほど強い） ---
  float r2 = dot(center, center);
  vec2 off = center * (uCA * 0.010) * (0.25 + r2 * 2.2);
  vec3 col;
  col.r = texture(uScene, uv + off).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - off).b;

  // --- ブルーム ---
  vec3 b1 = texture(uBloom1, uv).rgb;
  vec3 b2 = texture(uBloom2, uv).rgb;
  vec3 st = texture(uStreak, uv).rgb;
  col += (b1 * 0.42 + b2 * 0.58) * uBloom;
  col += st * vec3(0.55, 0.78, 1.25) * uBloom * 0.16;   // アナモルフィックの青い横流れ

  // --- 画面フラッシュ ---
  col += uFlashCol * uFlash * (0.32 + 0.68 * smoothstep(0.18, 0.55, length(center)));

  // --- トーンマップ＋彩度 ---
  col = aces(col * 1.02);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSat);

  // --- ビネット ---
  float vig = smoothstep(1.15, 0.28, length(center * vec2(1.05, 1.0)));
  col *= mix(1.0, vig, uVignette);

  // --- フィルムグレイン ---
  col += (hash(uv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;

  col *= (1.0 - uFade);
  outColor = vec4(col, 1.0);
}`;
