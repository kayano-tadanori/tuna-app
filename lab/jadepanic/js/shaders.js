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
in float i_core;  // 白く焼けた芯の量（0=背景の線 / 1=主役）

uniform mat4 u_proj;
uniform float u_px;    // 1ピクセルのワールド単位（細すぎる線を守る）

out vec2 v_local;      // x: p0からの距離 / y: 横方向の距離
out float v_len;
out float v_hw;
out vec3 v_col;
out float v_glow;
out float v_core;

void main() {
  vec2 axis = i_p1 - i_p0;
  float len = length(axis);
  vec2 dir = len > 1e-5 ? axis / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  // 画面上で最低でも 1.1px は太さを確保する（スマホで線が消えないように）
  float hw = max(i_w, u_px * 1.45);

  float along = a_corner.x * len + (a_corner.x * 2.0 - 1.0) * hw;  // 端をhwぶん延長＝丸いキャップ
  float across = a_corner.y * hw;

  vec2 world = i_p0 + dir * along + nrm * across;

  v_local = vec2(along, across);
  v_len = len;
  v_hw = hw;
  v_col = i_col;
  v_glow = i_glow;
  v_core = i_core;

  gl_Position = u_proj * vec4(world, 0.0, 1.0);
}`;

SH.lineFS = `#version 300 es
precision highp float;

in vec2 v_local;
in float v_len;
in float v_hw;
in vec3 v_col;
in float v_glow;
in float v_core;

out vec4 outColor;

void main() {
  // カプセルまでの距離（0が芯、1がにじみの外周）
  float dx = max(0.0, max(-v_local.x, v_local.x - v_len));
  float d = length(vec2(dx, v_local.y)) / v_hw;
  if (d > 1.0) discard;

  float halo = exp(-3.2 * d * d);           // 外側のにじみ
  float core = pow(max(0.0, 1.0 - d), 7.0); // 白く焼けた芯

  vec3 c = v_col * halo * v_glow * 1.15 + vec3(1.0) * core * v_glow * 0.40 * v_core;
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

// 遠くにただよう データのかけら。奥行きを出すためだけの層
vec3 dust(vec2 uv, float scale, float thin, float bright, float t) {
  vec2 sp = uv * scale;
  vec2 cell = floor(sp), f = fract(sp);
  float h = hash(cell);
  if (h < thin) return vec3(0.0);
  vec2 pp = vec2(hash(cell + 1.37), hash(cell + 7.71));
  float d = length((f - pp) * vec2(1.0, 1.0));
  float tw = 0.55 + 0.45 * sin(t * 1.6 + h * 41.0);
  float g = smoothstep(0.085, 0.0, d) * bright * tw;
  return mix(vec3(0.30, 0.52, 0.95), vec3(0.85, 0.92, 1.0), h) * g;
}

void main() {
  vec2 uv = v_uv;
  vec2 c = uv - 0.5;
  float ar = u_res.x / max(u_res.y, 1.0);
  vec2 ca = vec2(c.x * ar, c.y);

  // データ空間の地。ほぼ黒。ここが濁ると ネオンが立たない
  float r = length(ca) / 0.9;
  vec3 col = mix(vec3(0.011, 0.020, 0.052), vec3(0.001, 0.002, 0.008), smoothstep(0.05, 0.95, r));

  // 中央のうっすらした光（拍で脈打つ）。ひかえめに
  col += vec3(0.03, 0.08, 0.17) * (0.05 + 0.07 * u_beat) * exp(-r * r * 5.0);

  // 遠くの粒（2層。細かいほうを暗く）
  col += dust(vec2(uv.x * ar, uv.y), 34.0, 0.875, 0.20, u_time);
  col += dust(vec2(uv.x * ar, uv.y) + 13.7, 17.0, 0.930, 0.36, u_time * 0.8);
  col += dust(vec2(uv.x * ar, uv.y) + 41.3, 9.0, 0.960, 0.50, u_time * 0.55);

  // 走査線（うんと細く）
  col *= 1.0 + sin(uv.y * u_res.y * 1.15 + u_time * 0.8) * 0.012;

  // 流れるデータの帯
  float band = fract(uv.y * 3.0 - u_time * 0.06);
  col += vec3(0.012, 0.036, 0.062) * smoothstep(0.975, 1.0, band);

  // バグの侵食：横に走るグリッチの帯（四角い塊はバグに見えるので使わない）
  if (u_danger > 0.01) {
    float rows = 150.0;
    float ry = floor(uv.y * rows);
    float seed = hash(vec2(ry, floor(u_time * 11.0)));
    float glitchOn = step(1.0 - u_danger * 0.075, seed);
    float sweep = fract(seed * 7.3 + u_time * 1.7);
    float band2 = smoothstep(0.20, 0.0, abs(fract(uv.x - sweep) - 0.5) - 0.14);
    // 画面のふちほど強く（まん中は プレイの邪魔をしない）
    // 盤の中を横切ると プレイの邪魔になるうえ「描画バグ」に見える。外周だけに出す
    float edge = smoothstep(0.50, 0.92, length(ca));
    col += vec3(0.62, 0.05, 0.15) * glitchOn * band2 * edge * u_danger * 0.36;
    col += vec3(0.04, 0.09, 0.15) * glitchOn * band2 * edge * 0.22;
  }

  outColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------
// ブルーム（ミップ・ピラミッド）
//   本家GW2の「光が画面の遠くまで にじむ」感じは、ぼかし2段では出ない。
//   1/2 → 1/64 まで 6段に落として、また足しながら戻す（COD/Jimenez方式）。
//   ・1段目だけ soft-knee のしきい値と Karis平均（ちらつき止め）
// ------------------------------------------------------------
SH.downFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2  u_texel;
uniform float u_first;    // 1.0 なら しきい値＋Karis平均
uniform float u_thresh;
uniform float u_knee;

vec3 T(vec2 o) { return texture(u_tex, v_uv + o * u_texel).rgb; }

// やわらかいしきい値（急に切ると 光の縁がギザギザになる）
vec3 prefilter(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float kn = max(u_knee, 1e-4);
  float soft = clamp(br - u_thresh + kn, 0.0, 2.0 * kn);
  soft = soft * soft / (4.0 * kn);
  return c * max(soft, br - u_thresh) / max(br, 1e-4);
}

float karis(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }

void main() {
  vec3 a = T(vec2(-2.0,-2.0)), b = T(vec2( 0.0,-2.0)), c = T(vec2( 2.0,-2.0));
  vec3 d = T(vec2(-2.0, 0.0)), e = T(vec2( 0.0, 0.0)), f = T(vec2( 2.0, 0.0));
  vec3 g = T(vec2(-2.0, 2.0)), h = T(vec2( 0.0, 2.0)), i = T(vec2( 2.0, 2.0));
  vec3 j = T(vec2(-1.0,-1.0)), k = T(vec2( 1.0,-1.0));
  vec3 l = T(vec2(-1.0, 1.0)), m = T(vec2( 1.0, 1.0));

  if (u_first > 0.5) {
    a = prefilter(a); b = prefilter(b); c = prefilter(c);
    d = prefilter(d); e = prefilter(e); f = prefilter(f);
    g = prefilter(g); h = prefilter(h); i = prefilter(i);
    j = prefilter(j); k = prefilter(k); l = prefilter(l); m = prefilter(m);
  }

  vec3 g0 = (a + b + d + e) * 0.25;
  vec3 g1 = (b + c + e + f) * 0.25;
  vec3 g2 = (d + e + g + h) * 0.25;
  vec3 g3 = (e + f + h + i) * 0.25;
  vec3 g4 = (j + k + l + m) * 0.25;

  vec3 sum;
  if (u_first > 0.5) {
    // 明るい点1つが 巨大な光の玉になるのを防ぐ（Karis平均）
    float w0 = karis(g0) * 0.125, w1 = karis(g1) * 0.125;
    float w2 = karis(g2) * 0.125, w3 = karis(g3) * 0.125, w4 = karis(g4) * 0.5;
    sum = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / max(w0 + w1 + w2 + w3 + w4, 1e-4);
  } else {
    sum = g0 * 0.125 + g1 * 0.125 + g2 * 0.125 + g3 * 0.125 + g4 * 0.5;
  }
  outColor = vec4(max(sum, vec3(0.0)), 1.0);
}`;

SH.upFS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2  u_texel;
uniform float u_radius;
uniform float u_scale;

vec3 T(vec2 o) { return texture(u_tex, v_uv + o * u_texel * u_radius).rgb; }

void main() {
  // テント9タップ（段どうしの継ぎ目を出さない）
  vec3 s = T(vec2(-1.0,-1.0)) * 1.0 + T(vec2(0.0,-1.0)) * 2.0 + T(vec2(1.0,-1.0)) * 1.0
         + T(vec2(-1.0, 0.0)) * 2.0 + T(vec2(0.0, 0.0)) * 4.0 + T(vec2(1.0, 0.0)) * 2.0
         + T(vec2(-1.0, 1.0)) * 1.0 + T(vec2(0.0, 1.0)) * 2.0 + T(vec2(1.0, 1.0)) * 1.0;
  outColor = vec4(s * (1.0 / 16.0) * u_scale, 1.0);
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
uniform sampler2D u_bloomTex;
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

float aces1(float x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

// 色を残したまま 明るさだけ収める。
//   RGBそれぞれを別々に圧縮すると、明るい所が すべて真っ白になって
//   爆発の中の敵も自機も見えなくなる（実測で3人に指摘された）。
//   いちばん強い channel だけ圧縮し、残りは比率で戻す。
vec3 tonemap(vec3 c) {
  float peak = max(c.r, max(c.g, c.b));
  if (peak < 1e-4) return c;
  vec3 ratio = c / peak;
  float tp = aces1(peak);
  // うんと明るい所だけ ほんの少し白へ寄せる（完全な単色よりは自然）
  ratio = mix(ratio, vec3(1.0), pow(tp, 5.0) * 0.30);
  return ratio * tp;
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
  vec3 bl = texture(u_bloomTex, uv).rgb;
  col += bl * u_bloom;

  // ---- 明るさをつぶさずに収める ----
  col = tonemap(col * 1.08);

  // ---- ビネット ----
  float vig = smoothstep(0.95, 0.25, length(c * vec2(1.1, 1.0)));
  col *= mix(1.0, vig, u_vig);
  // ピンチのときだけ、ふちが赤くにじむ
  col += vec3(0.30, 0.015, 0.055) * u_danger * pow(1.0 - vig, 1.6) * (0.55 + 0.45 * sin(u_time * 5.0));

  // ---- フィルムグレイン ----
  float g = hash(v_uv * 512.0 + fract(u_time) * 91.7) - 0.5;
  col += g * u_grain;

  // ---- フラッシュ ----
  col += u_flashCol * u_flash;

  // ---- ディザ（8bitに落とすときの 暗部の段差を消す）----
  float d1 = hash(v_uv * 431.7 + fract(u_time) * 13.1);
  float d2 = hash(v_uv * 719.3 - fract(u_time) * 7.7);
  col += (d1 + d2 - 1.0) / 255.0;

  outColor = vec4(col, 1.0);
}`;
