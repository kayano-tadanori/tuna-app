// ============================================================
// shaders.js — GLSL 一式
//   ネオンの線・背景・ポストプロセス
//
//   ★この game の絵は「すべて線分（カプセル）」でできている。
//     機体も、敵も、弾も、粒子も、ゆがむグリッドも、ぜんぶ同じ 1本の
//     インスタンス描画に相乗りする。＝ シーンの描画ドローコールは 1回。
// ============================================================
'use strict';

const SH = {};

// ------------------------------------------------------------
// 線分（カプセル）: ネオン管ふうに、白い芯＋色のにじみ
// ------------------------------------------------------------
SH.lineVS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_corner;   // x:0..1 進行方向 / y:-1..1 横方向

in vec2 i_p0;
in vec2 i_p1;
in vec3 i_col;
in float i_w;     // にじみをふくめた半径（ワールド単位）
in float i_glow;  // 明るさ

uniform mat4 u_proj;
uniform float u_px;    // 1ピクセルのワールド単位（細すぎる線を守る）

out vec2 v_local;      // x: p0からの距離 / y: 横方向の距離
out float v_len;
out float v_hw;
out vec3 v_col;
out float v_glow;

void main() {
  vec2 axis = i_p1 - i_p0;
  float len = length(axis);
  vec2 dir = len > 1e-5 ? axis / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  // 画面上で最低でも 1.1px は太さを確保する（スマホで線が消えないように）
  float hw = max(i_w, u_px * 1.1);

  float along = a_corner.x * len + (a_corner.x * 2.0 - 1.0) * hw;  // 端をhwぶん延長＝丸いキャップ
  float across = a_corner.y * hw;

  vec2 world = i_p0 + dir * along + nrm * across;

  v_local = vec2(along, across);
  v_len = len;
  v_hw = hw;
  v_col = i_col;
  v_glow = i_glow;

  gl_Position = u_proj * vec4(world, 0.0, 1.0);
}`;

SH.lineFS = `#version 300 es
precision highp float;

in vec2 v_local;
in float v_len;
in float v_hw;
in vec3 v_col;
in float v_glow;

out vec4 outColor;

void main() {
  // カプセルまでの距離（0が芯、1がにじみの外周）
  float dx = max(0.0, max(-v_local.x, v_local.x - v_len));
  float d = length(vec2(dx, v_local.y)) / v_hw;
  if (d > 1.0) discard;

  float halo = exp(-3.2 * d * d);           // 外側のにじみ
  float core = pow(max(0.0, 1.0 - d), 7.0); // 白く焼けた芯

  vec3 c = v_col * halo * v_glow * 1.15 + vec3(1.0) * core * v_glow * 0.40;
  outColor = vec4(c, 1.0);
}`;

// ------------------------------------------------------------
// 背景：暗いデータ空間。バグに侵食されるほど荒れる
// ------------------------------------------------------------
SH.quadVS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;   // -1..1
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

SH.bgFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform float u_time;
uniform float u_danger;   // 0..1 ピンチ度
uniform float u_beat;     // 0..1 キックの脈
uniform vec2  u_res;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = v_uv;
  vec2 c = uv - 0.5;

  // 奥にいくほど暗い、深い藍色のデータ空間
  float r = length(c * vec2(1.15, 1.0));
  vec3 col = mix(vec3(0.035, 0.055, 0.115), vec3(0.006, 0.010, 0.028), smoothstep(0.1, 0.85, r));

  // 中央のうっすらした光（拍で脈打つ）
  col += vec3(0.05, 0.12, 0.22) * (0.10 + 0.10 * u_beat) * exp(-r * r * 6.0);

  // 走査線（横に細く）
  float scan = sin(uv.y * u_res.y * 1.15 + u_time * 0.8);
  col *= 1.0 + scan * 0.020;

  // 流れるデータの帯
  float band = fract(uv.y * 3.0 - u_time * 0.06);
  col += vec3(0.02, 0.06, 0.10) * smoothstep(0.97, 1.0, band) * 0.6;

  // バグの侵食：ピンチになるとブロックノイズが走る
  if (u_danger > 0.01) {
    vec2 g = floor(uv * vec2(28.0, 16.0));
    float n = hash(g + floor(u_time * 9.0));
    float blk = step(1.0 - u_danger * 0.05, n);
    col += vec3(0.16, 0.015, 0.05) * blk * u_danger;
    col += vec3(0.10, 0.0, 0.0) * u_danger * smoothstep(0.35, 0.85, r) * (0.5 + 0.5 * sin(u_time * 6.0));
  }

  outColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------
// 明るいところだけ抜き出す
// ------------------------------------------------------------
SH.brightFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_thresh;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = max(0.0, l - u_thresh) / max(l, 0.0001);
  outColor = vec4(c * k, 1.0);
}`;

// ------------------------------------------------------------
// ぼかし（縦横に分けて2回かける）
// ------------------------------------------------------------
SH.blurFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_dir;     // (1/w,0) か (0,1/h)
void main() {
  vec3 s = texture(u_tex, v_uv).rgb * 0.2270270270;
  s += texture(u_tex, v_uv + u_dir * 1.3846153846).rgb * 0.3162162162;
  s += texture(u_tex, v_uv - u_dir * 1.3846153846).rgb * 0.3162162162;
  s += texture(u_tex, v_uv + u_dir * 3.2307692308).rgb * 0.0702702703;
  s += texture(u_tex, v_uv - u_dir * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(s, 1.0);
}`;

// ------------------------------------------------------------
// 仕上げ：衝撃波のゆがみ → 色収差 → ブルーム合成 → トーンマップ →
//         ビネット → 粒子ノイズ → 画面フラッシュ
// ------------------------------------------------------------
SH.compFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_scene;
uniform sampler2D u_bloom1;
uniform sampler2D u_bloom2;
uniform float u_time;
uniform float u_ca;        // 色収差の強さ
uniform float u_bloom;     // ブルーム量
uniform float u_flash;     // 白フラッシュ
uniform vec3  u_flashCol;
uniform float u_vig;       // ビネット
uniform float u_grain;
uniform float u_danger;
uniform float u_aspect;
uniform vec4  u_shock[4];  // xy=中心(uv) z=半径 w=強さ

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 uv = v_uv;

  // ---- 衝撃波でUVを押し出す ----
  for (int i = 0; i < 4; i++) {
    vec4 s = u_shock[i];
    if (s.w <= 0.001) continue;
    vec2 d = uv - s.xy;
    d.x *= u_aspect;
    float dist = length(d);
    float ring = exp(-pow((dist - s.z) * 14.0, 2.0));
    uv += normalize(d + 1e-6) * ring * s.w * 0.045 * vec2(1.0 / u_aspect, 1.0);
  }

  // ---- 色収差（画面のふちほど強く）----
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  vec2 off = c * (u_ca * 0.0022 + r2 * u_ca * 0.0075);

  vec3 col;
  col.r = texture(u_scene, uv + off).r;
  col.g = texture(u_scene, uv).g;
  col.b = texture(u_scene, uv - off).b;

  // ---- ブルーム ----
  vec3 bl = texture(u_bloom1, uv).rgb * 0.62 + texture(u_bloom2, uv).rgb * 0.90;
  col += bl * u_bloom;

  // ---- 明るさをつぶさずに収める ----
  col = aces(col * 1.08);

  // ---- ビネット ----
  float vig = smoothstep(0.95, 0.25, length(c * vec2(1.1, 1.0)));
  col *= mix(1.0, vig, u_vig);
  // ピンチのときだけ、ふちが赤くにじむ
  col += vec3(0.42, 0.02, 0.07) * u_danger * (1.0 - vig) * (0.55 + 0.45 * sin(u_time * 5.0));

  // ---- フィルムグレイン ----
  float g = hash(v_uv * 512.0 + fract(u_time) * 91.7) - 0.5;
  col += g * u_grain;

  // ---- フラッシュ ----
  col += u_flashCol * u_flash;

  outColor = vec4(col, 1.0);
}`;
