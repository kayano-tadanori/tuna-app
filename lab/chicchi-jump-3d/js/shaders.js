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
uniform float uCFloor;      // チッチの明るさの床。太陽から遠くても、ここより暗くしない
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
  // 🚨 プレイヤーは、いつでも画面でいちばん明るい（プラン §9 観点5）。
  //   光の逆二乗で遠くほど暗くするのは正しいが、チッチまで暗くすると
  //   頭のてっぺんが黒くつぶれて「黒いかぶりもの」に見える（実際そうなった）。
  //   自発光だけでは足りないので、床をつくる。
  c = max(c, base * uCFloor);

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
uniform float uGlass;    // 1=ガラス（ヘルメット）。ふちだけ光り、まん中はほぼ透ける
uniform float uFloor;    // 足場の明るさの床。太陽から遠くても、ここより暗くしない
out vec4 o;
void main(){
  if (vFade <= 0.02) discard;
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);

  // --- ガラス ---
  // ★面ぜんたいを同じ明るさで光らせると、ガラスではなく「かぶりもの」になる。
  //   本物のガラスは、正面はほとんど見えず、ふち（視線と面が浅い角度で交わるところ）
  //   だけが強く光る。それを fresnel で作る。
  // --- 🌍 大気のふち ---
  // 地球のふちが青く光って見えるのは、そこだけ空気を長く突きぬけて見ているから。
  // ふち（視線と面が浅く交わるところ）だけ光らせれば、それがそのまま出る。
  // --- ☄️ 自分で光るもの（彗星のコマとしっぽ）---
  // ★ここをふつうのトゥーンで描くと、光の当たらない側が暗くなって
  //   **黒い円すい**になる（実際そうなった）。彗星は自分で光っている。
  // ★正面ほど明るく、ふち（視線と面が浅く交わるところ）ほど暗くする。
  //   球なら「まん中が明るい玉」に、円すいなら「ふちのやわらかいしっぽ」になる。
  //   加算合成とあわせて、これで**にじみ**が出る。
  if (uGlass > 2.5) {
    o = vec4(vCol * max(dot(N, V), 0.0), vFade);
    return;
  }
  if (uGlass > 1.5) {
    float f = pow(1.0 - max(dot(N, V), 0.0), 3.4);
    o = vec4(vCol * f, vFade);
    return;
  }

  if (uGlass > 0.5) {
    float f = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    // ★fresnel だけだと、正面は f=0＝透明＝うしろが黒いと「黒いカツラ」になる。
    //   光の当たっている一点だけ、背景に関係なく光らせる。これでガラスに見える。
    vec3 H = normalize(uLightDir + V);
    // ★ハイライトは広めに。狭いと1pxしか光らず、小さく表示したときに消える。
    float sp = pow(max(dot(N, H), 0.0), 26.0);
    // ★ここで vFade を色にかけないこと。混ぜるときに SRC_ALPHA でもう一度かかるので、
    //   二重にかけると（0.55²＝0.3）ほとんど消えてしまう。
    // ★まん中を 0.10 でも塗ってはいけない。黒い空では、そのわずかな灰色が
    //   「かぶりもの」に見える（実際、おかっぱ頭に見えると指摘された）。
    //   塗るのはふちと、光の当たる一点だけ。あいだは何も描かない＝ガラス。
    o = vec4(vCol * f * 1.25 + uRimCol * f * 0.70 + vec3(1.0) * sp * 1.35, vFade);
    return;
  }

  float h = dot(N, uLightDir) * 0.5 + 0.5;
  float s = smoothstep(uToonEdge.x, uToonEdge.y, h);
  vec3 c = mix(vCol * uShadowTint, vCol, s) * uBaseTint;
  // 🚨 足場だけは、ここより暗くしない。
  //   太陽から遠いほど暗くする（光の逆二乗）のは正しいが、そのままだと
  //   **次に乗る足場が背景に沈んで見えなくなる**（実測でコントラスト比1.0台だった）。
  //   きれいさより先に「見えること」を守る。背景にはかけない（奥ゆきが死ぬので）。
  if (uFloor > 0.001) c = max(c, vCol * uFloor);
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
//
//  ★画面のuvではなく「その画素を見ている向き」で描く（＝本物のスカイボックス）。
//    画面座標だけで散らすと、カメラが回ったとき星が画面に貼りついてきて、
//    宇宙に見えなくなる。向きで描けば、星も星雲も銀河もワールドに固定される。
//
//  中身は biome.js から数字で渡ってくる。ここは「絵にする」係。
//    星／天の川の帯／星雲／暗黒星雲／銀河・星団／ビーコン／重力レンズ。
//  ★描くのは1枚だけ。biome の切りかわりは数字のほうで混ぜてある。
SH.skyFS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 o;

uniform vec3  uTop, uBot;
uniform float uStars;      // 高度でじわっと出す（450〜650m）
uniform float uTime;
uniform float uAspect, uTanHalf;
uniform vec3  uRight, uUp, uFwd;    // カメラの向き（ワールド）

uniform float uStarAmt, uStarDense;
uniform vec3  uStarCol;
uniform float uBandAmt;
uniform vec3  uBandCol, uBandDir;
uniform float uNebAmt, uNebScale, uNebGain, uDarkAmt;
uniform vec3  uNebCol1, uNebCol2;
uniform float uGalAmt, uGalSize, uGalRoll, uGalSquash, uGalKind;
uniform vec3  uGalCol, uGalDir;
uniform vec4  uBeaconA, uBeaconB;      // rgb=色 w=強さ
uniform vec4  uBeaconAP, uBeaconBP;    // xyz=向き w=大きさ
uniform vec2  uBeaconHz;               // 明滅（Hz）。0=光りっぱなし。2Hzを超えさせない
uniform float uLensAmt, uLensSize;
uniform vec3  uLensDir;
uniform float uAirGlow;    // 地平線ぎわの空気の帯。高いところでだけ出る
uniform float uSunRing;    // ヘリオポーズで「これが、太陽」と指さすときの小さな輪

float h31(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

// なめらかな雑音（星雲のもと）
float n31(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h31(i), b = h31(i + vec3(1,0,0));
  float c = h31(i + vec3(0,1,0)), d = h31(i + vec3(1,1,0));
  float e = h31(i + vec3(0,0,1)), g = h31(i + vec3(1,0,1));
  float k = h31(i + vec3(0,1,1)), l = h31(i + vec3(1,1,1));
  return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y),
             mix(mix(e,g,f.x), mix(k,l,f.x), f.y), f.z);
}
// 3重ねまで。これ以上重ねても、小さい画面では見分けがつかない。
float fbm3(vec3 p){
  return n31(p) * 0.5 + n31(p * 2.03 + 7.1) * 0.28 + n31(p * 4.11 - 3.7) * 0.14;
}

// 星をひと粒。空を立方体のマスに切り、マスごとに1つ置く。
// ★マスの中心を正規化して「向き」に直してから距離をはかる。
//   そうしないと、球からはずれたマスの星が消えて、まだらになる。
float starAt(vec3 dir, float dens, float seed, float thresh){
  vec3 id = floor(dir * dens);
  float h = h31(id + seed);
  if (h < thresh) return 0.0;
  vec3 c = id + vec3(h31(id + seed + 1.7), h31(id + seed + 3.3), h31(id + seed + 5.9));
  vec3 sd = c / max(length(c), 1e-4);
  float d = length(dir - sd) * dens;
  float tw = 0.62 + 0.38 * sin(uTime * 1.6 + h * 63.0);
  return smoothstep(0.17, 0.0, d) * tw * (0.35 + h * 0.75);
}

// 渦巻銀河／球状星団
vec3 galaxyAt(vec3 dir){
  vec3 gz = uGalDir;
  float fr = dot(dir, gz);
  if (fr <= 0.0) return vec3(0.0);
  vec3 up0 = abs(gz.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 gx = normalize(cross(up0, gz));
  vec3 gy = cross(gz, gx);
  vec2 q = vec2(dot(dir, gx), dot(dir, gy)) / max(uGalSize, 1e-3);
  float cr = cos(uGalRoll), sr = sin(uGalRoll);
  q = vec2(q.x * cr - q.y * sr, q.x * sr + q.y * cr);
  q.y /= max(uGalSquash, 0.05);          // ねかせる＝こちらへ傾いている
  float r = length(q);
  if (r > 3.2) return vec3(0.0);
  float v;
  if (uGalKind > 0.5) {
    // 球状星団：まん中がぎゅっと詰まった玉。
    // ★のっぺりした丸い光にしない。星の粒が見えてはじめて「星の集まり」になる。
    // ★★ h31(floor(dir*N)) を そのまま使ってはいけない。
    //    それは「四角いマス目の生の乱数」＝テレビの砂あらし であって、星の粒ではない。
    //    すぐ上の starAt() が smoothstep でちゃんと丸い点を作っているので、そちらを使う。
    v = exp(-r * 2.2) * (0.26
        + 0.85 * starAt(dir, 420.0, 21.0, 0.55)
        + 1.55 * starAt(dir, 175.0, 37.0, 0.86));
  } else {
    // 対数らせんの腕。中心のふくらみ（バルジ）と、腕の間の暗い筋。
    float th = atan(q.y, q.x);
    float sp = th - 2.5 * log(max(r, 0.09));
    float arm = pow(0.5 + 0.5 * cos(2.0 * sp), 2.6);
    float lane = pow(0.5 + 0.5 * cos(2.0 * sp + 0.62), 3.0);
    v = (arm * exp(-r * 1.55) * 0.95 + exp(-r * r * 7.0) * 0.85);
    v *= 1.0 - lane * 0.45 * smoothstep(0.12, 0.55, r);
    // むらは なめらかな雑音で（マス目の生ハッシュだとブロックが見える）
    v *= 0.55 + 0.60 * fbm3(dir * 46.0);
    v += exp(-r * 1.7) * starAt(dir, 260.0, 53.0, 0.90) * 0.85;   // 粒だった星
  }
  return uGalCol * v * uGalAmt;
}

// ---------------- ⚫ ブラックホールの降着円盤 ----------------
//  本物の絵（EHT・インターステラー）の形をなぞる。
//    ・真横から見た円盤が、左右へ横一文字に伸びる
//    ・その向こうがわの光が、重力で曲がって **影の上と下にも回りこむ**
//      ＝横の帯と、上下の弧が つながって見える。ここが「ただの輪」との差
//    ・内がわほど熱くて白い。外へ行くほどオレンジ→赤
//    ・回転で近づいてくる側が明るい（ドップラー）
vec3 diskAt(vec3 dir, vec3 bd, float size){
  // 円盤の面の向き。上下が空の上下とそろっていると絵として読みやすい。
  vec3 up0 = abs(bd.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 gx = normalize(cross(up0, bd));
  vec3 gy = cross(bd, gx);
  if (dot(dir, bd) <= 0.0) return vec3(0.0);
  vec2 q = vec2(dot(dir, gx), dot(dir, gy)) / max(size, 1e-4);   // 影の半径を1とした座標
  float r2 = length(q);
  if (r2 > 6.0) return vec3(0.0);

  // (a) 直接見えている円盤（たてにつぶれた楕円の輪）
  const float RIN = 2.35, ROUT = 4.6, SQ = 0.115;
  float re = length(vec2(q.x, q.y / SQ));
  float disk = smoothstep(RIN * 0.86, RIN, re) * (1.0 - smoothstep(ROUT * 0.70, ROUT, re));
  disk *= 0.40 + 0.60 * exp(-(re - RIN) * 0.55);        // 内がわほど明るい
  disk *= 0.72 + 0.28 * sin(re * 6.5 + 1.3);            // 細いすじ

  // (b) 曲がって回りこむ光。影のまわりの弧で、上下が強い
  float a2 = atan(q.y, q.x);
  float hr = (r2 - 2.45) / 0.42;
  float halo = exp(-hr * hr) * (0.20 + 0.80 * abs(sin(a2)));

  // (c) ドップラー。かたっぽうだけ明るい
  float dop = 1.0 + 0.50 * clamp(-q.x / max(re * 0.55, 0.6), -1.0, 1.0);

  float v = (disk * 1.15 + halo * 0.85) * dop;
  // 内がわ＝白熱、外がわ＝赤
  float hot = clamp(exp(-(re - RIN) * 0.75), 0.0, 1.0);
  vec3 col = mix(vec3(1.00, 0.30, 0.04), vec3(1.00, 0.86, 0.55), hot);
  return col * v;
}

// 明るい点（遠い太陽・二重星・パルサー）
//   glowOut … まわりのにじみ。これは「広い面」なので、あとで頭打ちにかける。
//   返り値   … 芯と光条。こちらは点なので、まぶしいままでよい。
vec3 beaconAt(vec3 dir, vec3 bd, vec3 col, float amt, float size, float hz, out vec3 glowOut){
  glowOut = vec3(0.0);
  if (amt <= 0.005) return vec3(0.0);
  float d = length(dir - bd);
  if (d > size * 26.0) return vec3(0.0);
  float core = smoothstep(size, size * 0.12, d);
  // ★にじみは端を必ず0まで落とすこと。途中で切ると、空に丸い切り口が出る
  //   （実際、赤い星のまわりに円のふちが見えた）。
  float glow = exp(-d / (size * 4.5)) * 0.42 * smoothstep(size * 24.0, size * 5.0, d);
  // 十字の光条。これがあると「点」ではなく「星」に見える。
  vec3 t1 = normalize(cross(bd, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0));
  vec3 t2 = cross(bd, t1);
  vec3 rel = dir - bd;
  vec2 pr = vec2(dot(rel, t1), dot(rel, t2));
  // ★光条を長くしすぎない。下にある太陽の縦すじが、チッチの足元を貫いて見えた。
  float spike = (smoothstep(size * 0.55, 0.0, abs(pr.y)) * smoothstep(size * 9.0, 0.0, abs(pr.x))
               + smoothstep(size * 0.55, 0.0, abs(pr.x)) * smoothstep(size * 9.0, 0.0, abs(pr.y))) * 0.30;
  float pulse = hz > 0.001 ? (0.28 + 0.72 * pow(0.5 + 0.5 * sin(uTime * 6.28318 * hz), 8.0)) : 1.0;
  glowOut = col * glow * amt * pulse;
  return col * (core + spike) * amt * pulse;
}

void main(){
  // その画素を見ている向き
  vec2 p = vUV * 2.0 - 1.0;
  vec3 dir = normalize(uFwd + uRight * (p.x * uTanHalf * uAspect) + uUp * (p.y * uTanHalf));
  // ★曲げる前の向きを取っておく。降着円盤は「曲がったあとの見え方」を
  //   そのまま式で描いているので、曲げる前の向きで描かないと二重に曲がる。
  vec3 dir0 = dir;

  // --- ブラックホール：向こうの光が曲がって届く（見る向きのほうを曲げる）---
  float lensDark = 0.0, lensRing = 0.0;
  if (uLensAmt > 0.01) {
    float ca = clamp(dot(dir, uLensDir), -1.0, 1.0);
    float th = acos(ca);
    vec3 tang = dir - uLensDir * ca;
    float tl = length(tang);
    if (tl > 1e-5) {
      tang /= tl;
      float bend = uLensAmt * uLensSize * uLensSize / max(th, uLensSize * 0.55);
      float na = th + bend;
      dir = normalize(uLensDir * cos(na) + tang * sin(na));
    }
    lensDark = smoothstep(uLensSize * 1.04, uLensSize * 0.96, th);
    // 光子のリング（影のふちのごく細い光）
    float rr = (th - uLensSize * 1.10) / (uLensSize * 0.10);
    lensRing = exp(-rr * rr);
  }

  vec3 c = mix(uBot, uTop, pow(vUV.y, 0.85));

  // --- 暗黒星雲。光るのではなく、向こうの光をさえぎる ---
  float dark = 0.0;
  if (uDarkAmt > 0.01) {
    dark = smoothstep(0.30, 0.72, fbm3(dir * 3.6 + 31.0)) * uDarkAmt;
  }
  float clear = 1.0 - dark * 0.92;

  // 広い面で光るもの（帯・星雲・銀河）はここへためる。
  // ★星やビーコンのような「点」と分けておく。あとで面のほうだけ頭打ちにするため。
  vec3 wide = vec3(0.0);

  // --- 天の川の帯 ---
  // ★細い線1本にしない。本物は空の20〜30度をぼんやり覆っていて、
  //   そのまん中に明るい芯がある。細い帯だけだと「白い線」に見えてしまう。
  float halo = 0.0;
  if (uBandAmt > 0.01) {
    float b = dot(dir, uBandDir);
    // ★広すぎる帯は「帯」に見えない。/0.130 だと面から21°も広がって、
    //   縦の画角の2/3を覆う＝ただの もや になる。しぼって「1本の川」にする。
    halo = exp(-b * b / 0.070);                       // ぼんやり広いところ
    float core = exp(-b * b / 0.012);                 // 明るい芯
    // ★天の川を天の川に見せるのは明るさではなく、まん中を走る暗い裂け目のほう。
    float lane = mix(0.15, 1.0, fbm3(dir * 9.0 + 11.0));
    wide += uBandCol * (halo * 0.30 + core * 0.95) * lane * uBandAmt * 0.52 * clear;
  }

  // --- 星雲 ---
  if (uNebAmt > 0.01) {
    vec3 q = dir * (uNebScale * 2.6) + 4.0;
    float f1 = fbm3(q);
    float f2 = fbm3(q * 2.1 + 13.0);
    float m1 = pow(clamp(f1 * 1.35 - 0.28, 0.0, 1.0), 1.7) * uNebGain;
    float m2 = pow(clamp(f2 * 1.35 - 0.34, 0.0, 1.0), 2.1) * uNebGain;
    wide += (uNebCol1 * m1 + uNebCol2 * m2 * 0.75) * uNebAmt * clear;
  }

  // --- 銀河・星団 ---
  if (uGalAmt > 0.01) wide += galaxyAt(dir) * clear;

  // --- 明るい点（遠い太陽・二重星・パルサー）---
  // 芯はあとで足す。まわりのにじみだけ、いま「広い面」に入れておく。
  vec3 glowA, glowB;
  vec3 pointA = beaconAt(dir, uBeaconAP.xyz, uBeaconA.rgb, uBeaconA.w, uBeaconAP.w, uBeaconHz.x, glowA);
  vec3 pointB = beaconAt(dir, uBeaconBP.xyz, uBeaconB.rgb, uBeaconB.w, uBeaconBP.w, uBeaconHz.y, glowB);
  wide += glowA + glowB;

  // ★背景がここまで明るくなる、という頭打ち。
  //   空が明るいと、暗い岩の足場が背景に沈んで見えなくなる。
  //   「次に乗る足場が常に見えること」はゲームの生命線なので、
  //   きれいさより先にこちらを守る。まぶしいところだけ、やわらかく抑える。
  {
    float lum = dot(wide, vec3(0.30, 0.59, 0.11));
    // ★0.34 では緩すぎた。実測で空 0.358・岩 0.368＝コントラスト0.03（見えない）。
    //   0.20 まで下げると、いちばん明るい空でも 0.23 に収まり、岩と 0.38 差がつく。
    const float CEIL = 0.20;
    if (lum > CEIL) wide *= (CEIL + (lum - CEIL) * 0.12) / lum;
  }
  c += wide;

  // --- 星（点なので頭打ちの外。まぶしくてよい）---
  float sAmt = uStars * uStarAmt * clear;
  if (sAmt > 0.003) {
    float dn = max(uStarDense, 0.2);
    float s = starAt(dir, 15.0 * dn, 0.0,  0.90)
            + starAt(dir, 29.0 * dn, 5.3,  0.88) * 0.55
            + starAt(dir, 52.0 * dn, 11.9, 0.86) * 0.30;
    s *= 1.0 + halo * 2.2;                    // 帯のなかは星が濃い
    c += uStarCol * s * sAmt;
  }

  c += pointA + pointB;

  // ⭕ 太陽に小さな輪をつける（ヘリオポーズの「これが、太陽。」の一瞬だけ）
  //    ★矢印や字で説明しない。輪をひとつ置くだけで、目はそこへ行く。
  if (uSunRing > 0.001) {
    float d = length(dir0 - uBeaconAP.xyz);
    float rr = (d - 0.055) / 0.008;
    c += vec3(1.0, 0.95, 0.80) * exp(-rr * rr) * uSunRing * 0.9;
  }

  // --- ブラックホールの穴とリング（最後に置く。星より手前にあるので）---
  if (uLensAmt > 0.01) {
    // 降着円盤 → そのあと影で切り抜く（影のうしろは何も見えない）
    c += diskAt(dir0, uLensDir, uLensSize) * uLensAmt;
    c = mix(c, vec3(0.0), lensDark);
    c += vec3(1.00, 0.93, 0.86) * lensRing * uLensAmt * 0.55;
  }

  // --- 🌏 地平線ぎわの青い帯 ---
  // 高いところから見ると、地面のふちだけが青白く光って見える。
  // 空気を いちばん長く 突きぬけて見ている方向だから。
  // 平らな地面の地平線は、いつでも「目の高さ」＝ dir.y が 0 のところ。
  if (uAirGlow > 0.001) {
    float hy = dir0.y;
    c += vec3(0.34, 0.62, 1.00) * exp(-hy * hy / 0.0022) * uAirGlow;
    c += vec3(0.55, 0.78, 1.00) * exp(-hy * hy / 0.00016) * uAirGlow * 0.9;
  }

  vec2 d = vUV - 0.5;
  c *= 1.0 - dot(d, d) * 0.42;                // ふちを少し落とす
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
