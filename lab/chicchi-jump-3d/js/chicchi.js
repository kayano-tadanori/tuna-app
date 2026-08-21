// ============================================================
// chicchi.js — チッチ（黄色いボタンインコ）の3Dモデル
//
//  ボクセル（積み木）ではなく、断面リングを積んだ一体成型のメッシュ。
//  モデリングソフトは使わない。全部この中の数値から生成する。
//  体型を変えたいときは BODY_PROFILE の制御点の数字を触るだけでいい。
//
//  ボタンインコの見た目（実素材 素材/chicchi.png より）
//    ・2頭身。頭がほぼ体と同じ大きさの球、胴は一回り大きい卵型
//    ・体は黄色、顔はオレンジのマスク（目のまわり〜ほお〜あご下）
//    ・目は大きい黒丸 ＋ 白いアイリング（これがボタンインコの目じるし）
//    ・くちばしは短く尖った朱赤
//    ・翼の風切羽の先がオリーブグリーン ← チッチの識別ポイント
//    ・足はサーモンピンク
// ============================================================
'use strict';

// ---------------- 色 ----------------
const CC = {
  body:      '#ffd93b',   // 体の黄色
  bodyLo:    '#f0c42c',   // 体の下側（わずかに沈む）
  face:      '#ff9d5c',   // 顔のオレンジ
  faceDeep:  '#f5a03c',
  beak:      '#e84a2e',   // くちばしの朱赤
  beakHi:    '#ff6a3d',
  wing:      '#e8b923',   // 翼の付け根
  wingTip:   '#6e9e2e',   // 風切羽の先（オリーブグリーン）
  wingMid:   '#8fbf3a',
  foot:      '#f0907a',   // 足のサーモンピンク
  eye:       '#1a1a1a',
  eyeRing:   '#ffffff',
  helmet:    '#cfd8ff',   // 宇宙ヘルメット
};

// ---------------- 体型の制御点 ----------------
// ここだけ触れば体型が変わる。t=0 がお尻、t=1 が頭のてっぺん。
// t=0.5 あたりを絞ると首ができて、2頭身（頭と胴が別のかたまりに見える）になる。
// 実物のチッチはほぼ「ひとつの丸いかたまり」で、首はほとんど無い。
// 頭と胴を分けているのは輪郭ではなく顔のオレンジの色。
// くびれを強くすると雪だるまになってしまうので、ごく浅くとどめる。
//
// ★かわいさの定石：頭を胴より「大きく」する。
//   頭が小さいと大人びて、とたんに不気味に見える。
//   ここでは頭の最大(0.322)＞胴の最大(0.310)にしてある。
const BODY_PROFILE = [0.026, 0.236, 0.298, 0.310, 0.301, 0.281, 0.303, 0.322, 0.303, 0.222, 0.028];
// 奥行き（Z方向）の倍率。鳥は横幅より前後がすこし厚い。
const BODY_DEPTH   = [1.00,  1.08,  1.10,  1.10,  1.06,  1.01,  0.99,  0.98,  0.97,  0.97,  1.00];
const BODY_H = 1.0;                 // モデル高さ（描画時にワールド単位へスケールする）
const BODY_K = 2.30;                // 超楕円の指数。2=真円、上げるほどぷっくりする

const bodyRadius = t => catmull(BODY_PROFILE, t);
const bodyProfile = t => {
  const r = catmull(BODY_PROFILE, t);
  return [r, r * catmull(BODY_DEPTH, t)];
};
const bodySpine = t => [0, t * BODY_H, 0];

// 体の表面上の点を引く。目やヘルメットを「顔にぴったり」置くのに使う。
// a は角度（rad）。正面は +Z なので a = π/2。
function bodySurface(t, a) {
  const [rx, rz] = bodyProfile(t);
  const c = Math.cos(a), s = Math.sin(a);
  const e = 2 / BODY_K;
  return [
    Math.sign(c) * Math.pow(Math.abs(c), e) * rx,
    t * BODY_H,
    Math.sign(s) * Math.pow(Math.abs(s), e) * rz,
  ];
}

// ============================================================
//  骨（9本）
//   root ─ spine ─┬ head
//                 ├ wingL ─ wingLTip
//                 ├ wingR ─ wingRTip
//                 └ footL / footR
//
//  スクワッシュ&ストレッチは root の非一様スケールでかける。
//  翼の「しなり」は先端の骨を位相を遅らせて振ることで作る。
//  （頂点シェーダで小細工するより、骨を1本足すほうが素直で正しく出る）
// ============================================================
const BONE = {
  root:0, spine:1, head:2,
  wingL:3, wingLTip:4, wingR:5, wingRTip:6,
  footL:7, footR:8,
};
const BONE_COUNT = 9;

const D2R = Math.PI / 180;

// 各骨の「休めの姿勢」。親からの相対で持つ。
// 翼は最初から下向きに畳んでいるので、その回転もここに入れておく。
const BONE_REST = [
  { name:'root',     parent:-1,           t:[0, 0,    0], r:[0,0,0] },
  { name:'spine',    parent:BONE.root,    t:[0, 0.25, 0], r:[0,0,0] },
  { name:'head',     parent:BONE.spine,   t:[0, 0.35, 0], r:[0,0,0] },   // world y=0.60
  // 翼の付け根は体の中へ食いこませる。外に出すと付け根の断面が見えてしまう。
  // X軸まわりにも倒して、翼を「うしろへ」ねかせる。Z回転だけだと
  // 体の真下へ垂れさがって、おなかに緑の盾がぶら下がったように見える。
  // 角度は「輪郭から翼が出るか」で決める。体にぴったり沿わせると
  // シルエットがただの卵になり、遠目に何のキャラか分からなくなる。
  { name:'wingL',    parent:BONE.spine,   t:[-0.262, 0.22, 0.045], r:[-28*D2R,  14*D2R,  136*D2R] },
  { name:'wingLTip', parent:BONE.wingL,   t:[0, 0.18, 0], r:[0,0,0] },
  { name:'wingR',    parent:BONE.spine,   t:[ 0.262, 0.22, 0.045], r:[-28*D2R, -14*D2R, -136*D2R] },
  { name:'wingRTip', parent:BONE.wingR,   t:[0, 0.18, 0], r:[0,0,0] },
  // 足は 180° 回して下向きにする（ロフト自体は必ず +Y 方向に作る）
  { name:'footL',    parent:BONE.spine,   t:[-0.078,-0.170, 0.090], r:[0,0, Math.PI] },
  { name:'footR',    parent:BONE.spine,   t:[ 0.078,-0.170, 0.090], r:[0,0, Math.PI] },
];

const ONE3 = [1, 1, 1];

// 休めの姿勢でのワールド行列。メッシュを置く場所であり、逆行列が bind pose になる。
function computeRestWorlds() {
  const w = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const b = BONE_REST[i];
    const local = M4.compose(b.t, b.r, ONE3);
    w[i] = b.parent < 0 ? local : M4.mul(w[b.parent], local);
  }
  return w;
}
const BONE_REST_WORLD = computeRestWorlds();
const BONE_INV_BIND   = BONE_REST_WORLD.map(m => M4.invert(m));

// ============================================================
//  メッシュの組み立て
//   全パーツを1本の頂点バッファへ結合する。ドローコールは本体1＋輪郭1の計2。
// ============================================================

// 頂点1個あたり: pos(3) nrm(3) onrm(3) uv(2) col(3) param(4) bone(4) = 22 float
const V_STRIDE = 22;

class MeshBuilder {
  constructor() { this.v = []; this.idx = []; this.count = 0; }

  // geo をそのまま／行列 mat で移してから流し込む
  add(geo, opt) {
    const {
      mat = null,            // 置き場所
      bone = 0,              // この部品がぶら下がる骨
      bone2 = -1,            // 2本目（体だけが spine と head にまたがる）
      weightFn = null,       // (t,u) => 2本目のウェイト
      colorFn = null,        // (t,u) => [r,g,b]
      color = [1,1,1],
      texBlend = 0,          // 1 なら顔テクスチャを使う
      faceMask = 0,          // 1 なら影を落とさない（顔）
      wingPhase = 0,         // 翼のしなり（先端ほど遅れる）
      center = [0,0,0],      // 輪郭線を押し出す向きの基準点
    } = opt || {};

    const nMat = mat ? M4.normalMat(mat) : null;
    const base = this.count;
    const n = geo.pos.length / 3;

    for (let i = 0; i < n; i++) {
      let px = geo.pos[i*3], py = geo.pos[i*3+1], pz = geo.pos[i*3+2];
      let nx = geo.nrm[i*3], ny = geo.nrm[i*3+1], nz = geo.nrm[i*3+2];
      if (mat) {
        const x = mat[0]*px + mat[4]*py + mat[8]*pz + mat[12];
        const y = mat[1]*px + mat[5]*py + mat[9]*pz + mat[13];
        const z = mat[2]*px + mat[6]*py + mat[10]*pz + mat[14];
        px = x; py = y; pz = z;
        const ax = nMat[0]*nx + nMat[4]*ny + nMat[8]*nz;
        const ay = nMat[1]*nx + nMat[5]*ny + nMat[9]*nz;
        const az = nMat[2]*nx + nMat[6]*ny + nMat[10]*nz;
        const l = Math.hypot(ax, ay, az) || 1;
        nx = ax/l; ny = ay/l; nz = az/l;
      }

      const u = geo.uv[i*2], t = geo.uv[i*2+1];

      // 輪郭線用の法線は「部品の中心から外へ」。これなら極やふたの継ぎ目でも
      // なめらかにつながるので、背面法の線が割れない。
      let ox = px - center[0], oy = py - center[1], oz = pz - center[2];
      const ol = Math.hypot(ox, oy, oz) || 1;
      ox /= ol; oy /= ol; oz /= ol;

      const col = colorFn ? colorFn(t, u) : color;
      const w2 = (bone2 >= 0 && weightFn) ? clamp(weightFn(t, u), 0, 1) : 0;

      this.v.push(
        px, py, pz,
        nx, ny, nz,
        ox, oy, oz,
        u, t,
        col[0], col[1], col[2],
        faceMask, wingPhase, texBlend, 0,
        bone, 1 - w2, bone2 < 0 ? 0 : bone2, w2,
      );
    }
    for (let i = 0; i < geo.idx.length; i++) this.idx.push(base + geo.idx[i]);
    this.count += n;
    return this;
  }

  build() {
    return {
      vertices: new Float32Array(this.v),
      indices: this.count > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx),
      indexCount: this.idx.length,
      vertexCount: this.count,
      u32: this.count > 65535,
    };
  }
}

// ---------------- 各パーツ ----------------

// 翼：付け根から先へ、うすく広がって細くなる板。
// rx = 厚み（うすい）、rz = 前後の幅（広い）。
function wingGeometry() {
  const L = 0.395;
  const thick = [0.050, 0.056, 0.049, 0.039, 0.025, 0.008];
  const chord = [0.090, 0.122, 0.130, 0.115, 0.076, 0.020];
  return loftGeometry({
    rings: 14, radial: 12, k: 2.6, minR: 0.006,
    // ★付け根を体の中から生やす。t=0 を体の内側(-0.16L)から始めることで、
    //   平らなふたが体の外に出ず、黒い三角が見えなくなる。
    profile: t => [catmull(thick, t), catmull(chord, t)],
    spine: t => [0, (t * 1.16 - 0.16) * L, 0],
  });
}

// くちばし：インコのくちばし。
//   ・根もとが太くて「背が高い」（縦に深い）
//   ・先はカギ状にぐいっと下へ曲がって尖る
//   ・横から見ると丸みのある三角、正面から見ると細い
// 細い円錐にすると小鳥やアヒルになってしまい、インコに見えない。
//
// ロフトは +Y に伸ばして作り、置くときに X軸まわり 90° 倒して前へ向ける。
// そのとき ロフトのZ（奥ゆき）が「縦の高さ」に、Z方向のドリフトが「下への曲がり」になる。
// 実物の比率：くちばしの幅は頭の幅の約1/4、高さは頭の高さの約3/10。
// 頭の直径は約0.60 なので、幅0.125／高さ0.17 くらいがちょうどいい。
// これより大きいと顔に貼りついた板に見え、小さいとインコに見えない。
const BEAK_L = 0.074;
function beakGeometry() {
  // 先までしっかり肉を残すのがコツ。早く細らせると、カギがただの
  // 細いトゲになって「尖った角」に見えてしまう。
  const w = [0.058, 0.063, 0.059, 0.047, 0.028];   // 横はば
  const d = [0.080, 0.085, 0.080, 0.062, 0.030];   // 縦の深さ（根もとが厚くふくらむ）
  return loftGeometry({
    rings: 14, radial: 14, k: 2.45, minR: 0.007,
    profile: t => [catmull(w, t), catmull(d, t)],
    // Z方向のドリフト＝倒したあとの「下へのカギ」。
    // ★指数を大きくすると、根もとはまっすぐのまま先だけが急に折れる＝カギ。
    //   1.5 くらいだと全体がゆるく反るだけで、ただの尖った角になる。
    // 曲げすぎると先が真下を向き、正面から見たとき「黒い点」になって
    // ホクロや穴のように見える。85%くらいでとめる。
    spine: t => [0, t * BEAK_L, Math.pow(t, 2.4) * 0.086],
  });
}

// 足：みじかい筒。指は3本だが、この大きさでは1本の丸で十分読める。
// ★ロフトは必ず +Y 方向に作る。下向きに作ると法線が裏返る。
//   下へ向けたいときは骨の休めの姿勢で 180° 回す。
function footGeometry() {
  const L = 0.090;
  const r = [0.031, 0.027, 0.025, 0.031, 0.027];
  return loftGeometry({
    rings: 8, radial: 10, k: 2.2, minR: 0.006,
    profile: t => [catmull(r, t), catmull(r, t) * (1 + t * 0.9)],
    spine: t => [0, t * L, 0],
  });
}

// 尾：うしろへ短く伸びる板。翼と同じくグリーンが混じる。
function tailGeometry() {
  const L = 0.26;
  const thick = [0.045, 0.040, 0.030, 0.018, 0.007];
  const chord = [0.070, 0.082, 0.072, 0.048, 0.014];
  return loftGeometry({
    rings: 10, radial: 10, k: 2.6, minR: 0.005,
    profile: t => [catmull(chord, t), catmull(thick, t)],
    spine: t => [0, t * L, 0],
  });
}

// ---------------- 本体の組み立て ----------------
function buildChicchiMesh() {
  const mb = new MeshBuilder();
  const bodyCenter = [0, 0.42, 0];

  // --- 体＋頭（1本のロフト＝継ぎ目なし）---
  // spine と head にまたがるので、高さで滑らかに持ち替える。
  const body = loftGeometry({
    rings: 22, radial: 20, k: BODY_K, minR: 0.018,
    profile: bodyProfile, spine: bodySpine,
  });
  mb.add(body, {
    bone: BONE.spine, bone2: BONE.head,
    weightFn: t => smoothstep(0.44, 0.66, t),   // 首のあたりでゆっくり頭へ渡す
    texBlend: 1,                                 // 顔のオレンジはテクスチャで塗る
    faceMask: 0,
    center: bodyCenter,
  });

  // --- くちばし（顔の正面、目より少し下）---
  // X軸まわりに 90° 倒して前へ向ける。これで
  //   ロフトの +Y → 前(+Z)、ロフトの +Z → 下(-Y)
  // になり、根もとの厚みが「縦の深さ」、Zドリフトが「下へのカギ」になる。
  // 根もとは頭へ 0.045 埋めて継ぎ目を隠す。
  // ★埋める量に注意。深く埋めると太い根もとが頭に隠れ、細い先だけが出て
  //   「うすい刃」になってしまう（実際に一度そうなった）。浅く埋めて、
  //   ずんぐりした根もとが見えている状態にするのがインコらしさ。
  // 倒す角を 62° にとどめると、根もとが立ったまま先だけが下へ曲がって
  // 「ひたいから続くアーチ」になる。90°近くまで倒すと寝た板になる。
  // 高さの基準：★くちばしの上のはしが、目の高さのちょうど真ん中にくること。
  //   目の中心は eyeT(=0.745)。くちばしの根もとは上へ 0.076 ほど張り出すので、
  //   根もとを 0.745-0.076 ≒ 0.669 に置く。
  const beakT = 0.672, beakA = Math.PI / 2;
  const bp = bodySurface(beakT, beakA);
  const beakMat = M4.compose(
    [bp[0], bp[1], bp[2] - 0.030], [62 * D2R, 0, 0], ONE3);
  mb.add(beakGeometry(), {
    mat: beakMat, bone: BONE.head,
    colorFn: t => {
      const c0 = hex2rgb(CC.beakHi), c1 = hex2rgb(CC.beak);
      const k = smoothstep(0.0, 0.7, t);
      return [lerp(c0[0],c1[0],k), lerp(c0[1],c1[1],k), lerp(c0[2],c1[2],k)];
    },
    faceMask: 1,                                  // くちばしにも影を落とさない
    center: [bp[0], bp[1], bp[2]],
  });

  // --- 目（白いアイリング＋黒目）---
  // ボタンインコの目じるしなので、テクスチャではなく立体で作る。
  // ★かわいさの定石その2：目は「前に寄せて、低く、大きく」。
  //   横に離れて side についていると、捕食される側の動物の顔になり不気味になる。
  //   前向きに寄っていると赤ちゃんの顔になる。
  const eyeT = 0.728;
  const eyeSpread = 0.455;                         // 正面からの開き（rad）
  for (const side of [-1, 1]) {
    const a = Math.PI / 2 + side * eyeSpread;
    const P = bodySurface(eyeT, a);
    let nx = P[0], ny = 0, nz = P[2];              // 外向き（おおよそで十分）
    const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    ny = 0.16;
    const nl2 = Math.hypot(nx, ny, nz); nx/=nl2; ny/=nl2; nz/=nl2;

    const place = (r, push) => {
      const m = M4.ident();
      // ドームの +Y を法線方向へ向ける基底。
      // ★列は必ず右手系（X×Y=Z）にする。左手系だと形が裏返って
      //   面の向きが反転し、本体パスで裏面カリングに消される。
      let ux = -nz, uy = 0, uz = nx;               // 法線と直交する横向き
      const ul = Math.hypot(ux, uz) || 1; ux/=ul; uz/=ul;
      const vx = uy*nz - uz*ny, vy = uz*nx - ux*nz, vz = ux*ny - uy*nx;  // u × n
      m[0]=ux*r;  m[1]=uy*r;  m[2]=uz*r;  m[3]=0;
      m[4]=nx*r;  m[5]=ny*r;  m[6]=nz*r;  m[7]=0;
      m[8]=vx*r;  m[9]=vy*r;  m[10]=vz*r; m[11]=0;
      m[12]=P[0]+nx*push; m[13]=P[1]+ny*push; m[14]=P[2]+nz*push; m[15]=1;
      return m;
    };
    const domeCenter = [P[0], P[1], P[2]];

    // 「見た目の半径 R」と「ふくらみ h」から球を逆算する。
    // こうしないと、白目のほうが前へ出て黒目を飲みこむ（実際に一度やった）。
    // lift は面からさらに浮かせる量。重なりの順序はここで決める。
    const dome = (R, h, segU, segV, lift = 0) => {
      h = clamp(h, R * 0.12, R);                   // h>R は半球を超える＝形が壊れる
      const r = (R * R + h * h) / (2 * h);         // 球の半径
      const sinPhi = (r - h) / r;                  // ふたの始まる緯度
      const vFrom = 0.5 + Math.asin(clamp(sinPhi, -1, 1)) / Math.PI;
      return {
        geo: sphereGeometry(segU, segV, { vFrom, vTo: 1 }),
        mat: place(r, -(r - h) + lift),
      };
    };

    // 白目（アイリング）：実物は細いリング。太くするとカエルになる。
    const white = dome(0.081, 0.015, 16, 6, 0);
    mb.add(white.geo, {
      mat: white.mat, bone: BONE.head,
      color: hex2rgb(CC.eyeRing), faceMask: 1, center: domeCenter,
    });
    // 黒目：白目より小さく、白目より前へ（だからまわりに白がのぞく）
    // 大きい黒目は、それだけでかわいさに直結する。
    const black = dome(0.065, 0.022, 16, 6, 0.009);
    mb.add(black.geo, {
      mat: black.mat, bone: BONE.head,
      color: hex2rgb(CC.eye), faceMask: 1, center: domeCenter,
    });
    // ハイライト（左上の白い点。これだけで生きた目になる）
    // ★黒目の面より前へ「浮かせる」こと。ふくらみを増やすとイボになる。
    const hi = dome(0.0215, 0.014, 10, 4, 0.028);
    hi.mat[12] += -0.019; hi.mat[13] += 0.019; hi.mat[14] += 0.004;
    mb.add(hi.geo, {
      mat: hi.mat, bone: BONE.head, color: [1, 1, 1], faceMask: 1, center: domeCenter,
    });
    // 小さいほうのハイライト。2つあると目がうるむ。
    const hi2 = dome(0.0105, 0.007, 8, 3, 0.028);
    hi2.mat[12] += 0.020; hi2.mat[13] += -0.020; hi2.mat[14] += 0.004;
    mb.add(hi2.geo, {
      mat: hi2.mat, bone: BONE.head, color: [1, 1, 1], faceMask: 1, center: domeCenter,
    });
  }

  // --- 翼（骨の休めの姿勢に合わせて置く）---
  // 翼の色。実物は「付け根から2/3までは黄色、先の1/3だけが緑」。
  // 緑を早く出すと翼が緑の板になって、黄色いインコに見えなくなる。
  const wingCol = t => {
    const c0 = hex2rgb(CC.wing), c1 = hex2rgb(CC.wingMid), c2 = hex2rgb(CC.wingTip);
    if (t < 0.72) { const k = smoothstep(0.58, 0.72, t);
      return [lerp(c0[0],c1[0],k), lerp(c0[1],c1[1],k), lerp(c0[2],c1[2],k)]; }
    const k = smoothstep(0.72, 0.95, t);
    return [lerp(c1[0],c2[0],k), lerp(c1[1],c2[1],k), lerp(c1[2],c2[2],k)];
  };
  for (const [b, tip] of [[BONE.wingL, BONE.wingLTip], [BONE.wingR, BONE.wingRTip]]) {
    const rw = BONE_REST_WORLD[b];
    mb.add(wingGeometry(), {
      mat: rw, bone: b, bone2: tip,
      // 付け根は wingL、先へ行くほど wingLTip へ持ち替える。
      // 先端の骨を位相を遅らせて振ると、そのまま「しなり」になる。
      weightFn: t => smoothstep(0.30, 0.95, t),
      colorFn: wingCol,
      center: [rw[12], rw[13], rw[14]],
    });
  }

  // --- 尾（うしろへ。符号を間違えると前に生える）---
  const tailMat = M4.compose([0, 0.135, -0.175], [-108 * D2R, 0, 0], ONE3);
  mb.add(tailGeometry(), {
    mat: tailMat, bone: BONE.spine, colorFn: wingCol,
    center: [0, 0.15, -0.16],
  });

  // --- 足 ---
  for (const b of [BONE.footL, BONE.footR]) {
    const rw = BONE_REST_WORLD[b];
    mb.add(footGeometry(), {
      mat: rw, bone: b, color: hex2rgb(CC.foot),
      center: [rw[12], rw[13] - 0.04, rw[14]],
    });
  }

  const mesh = mb.build();
  mesh.boneInvBind = BONE_INV_BIND;
  mesh.height = BODY_H;
  return mesh;
}

// ============================================================
//  顔のテクスチャ（実行時に Canvas2D で描く。画像ファイルは使わない）
//   ロフトのUVは u=角度/2π, v=高さ。正面(+Z)は u=0.25。
// ============================================================
function makeChicchiFaceTexture(size = 512) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const S = size;

  // 体の黄色（下へ行くほどわずかに沈む）
  const base = g.createLinearGradient(0, 0, 0, S);
  base.addColorStop(0.0, CC.body);
  base.addColorStop(0.62, CC.body);
  base.addColorStop(1.0, CC.bodyLo);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);

  // v は下が t=0（お尻）、上が t=1（頭）。canvas は上が y=0 なので反転して考える。
  const vy = v => (1 - v) * S;

  // 顔のオレンジのマスク。u=0.25 を中心に、頭の高さへ楕円で乗せる。
  // 実物はひたい〜両目のまわり〜ほお〜あご下までを広く覆う。せまいと
  // 「鼻先だけオレンジ」になって別の鳥になる。頭頂と後頭部は黄色のまま残す。
  const cx = 0.25 * S, cy = vy(0.755);
  const rx = 0.248 * S, ry = 0.163 * S;
  const grd = g.createRadialGradient(cx, cy, ry * 0.25, cx, cy, rx);
  grd.addColorStop(0.0, CC.face);
  grd.addColorStop(0.55, CC.face);
  grd.addColorStop(0.80, CC.faceDeep);
  grd.addColorStop(1.0, 'rgba(245,160,60,0)');
  g.save();
  g.translate(cx, cy); g.scale(1, ry / rx); g.translate(-cx, -cy);
  g.fillStyle = grd;
  g.beginPath(); g.arc(cx, cy, rx, 0, Math.PI * 2); g.fill();
  g.restore();

  // ほおの赤み。うっすらでも入っているだけで、ぐっと「生きた顔」になる。
  // 無いと血の気がなく見えて、そのぶん不気味に寄る。
  g.globalAlpha = 0.42;
  for (const s of [-1, 1]) {
    const hx = cx + s * 0.093 * S, hy = vy(0.686);
    const hg = g.createRadialGradient(hx, hy, 1, hx, hy, 0.056 * S);
    hg.addColorStop(0, '#ff6f5e'); hg.addColorStop(1, 'rgba(255,111,94,0)');
    g.fillStyle = hg;
    g.beginPath(); g.arc(hx, hy, 0.056 * S, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;

  // おなかの明るいところ（正面の下half）
  const bg = g.createRadialGradient(cx, vy(0.30), 0.02 * S, cx, vy(0.30), 0.19 * S);
  bg.addColorStop(0, 'rgba(255,246,190,0.55)');
  bg.addColorStop(1, 'rgba(255,246,190,0)');
  g.fillStyle = bg;
  g.beginPath(); g.arc(cx, vy(0.30), 0.19 * S, 0, Math.PI * 2); g.fill();

  return cv;
}

// ============================================================
//  アニメーション — キーフレームを持たず、全部を時間と状態の関数で作る
//   スクワッシュ&ストレッチ ＝ 骨の非一様スケール（体積保存 sy=s, sx=sz=1/√s）
// ============================================================
const CJ_ANIM = {
  RISE: 'rise', FALL: 'fall', LAND: 'land', FLAP: 'flap',
  ROCKET: 'rocket', HURT: 'hurt', IDLE: 'idle', CHEER: 'cheer',
};

// ---------------- 滑空（つばさ🪽）のポーズ定数 ----------------
// 羽ばたきは「振る」動き、滑空は「止めて開く」動き。
// 見分けがつかないと道具を使った実感が出ないので、羽ばたきの一番開いた瞬間よりも
// さらに開いた角度で静止させる。
//
// ★翼の付け根は休めの姿勢で z=+136°（左）。ロフトの +Y がここでは
//   (-sin136°, cos136°, 0) ＝ 左ななめ下 を向く。つまり
//   「z回転を減らす＝翼が水平へ開く」（z=90° でちょうど真横）。
//   はじめ符号を逆にして、翼が体にめりこんだ。開く向きは必ずマイナス。
// 羽ばたきの最大開き量は -0.12-0.32 = -0.44rad。それより開いた値にする。
const GLIDE_OPEN  = -0.62;   // 136°-36° ≒ 100°。ほぼ真横＋わずかに下がりで「広げたまま」に見える
// 先端だけ少し上へ反らせる＝風を受けて反った形（上反角）。
// 強くするとV字に折れて折り紙飛行機になるので、付け根の 1/4 くらいでとめる。
const GLIDE_TIP   = -0.16;
// 前傾（nose-down）。+X回転は頭(+Y)を前(+Z)へ倒す。
// 20°を超えると頭から落ちているように見えるので 0.30rad(≒17°)まで。
const GLIDE_PITCH = 0.30;
// バンクの上限。0.35rad ≒ 20°。これ以上倒すと翼がシルエットから消えて何をしているか読めない。
const GLIDE_BANK  = 0.35;
// 滑空へ出入りするなめらかさ。dt*7 ≒ 0.15秒で切りかわる。
// ★ここを lerp で挟まずに if で切りかえると、つばさの点滅ごとに翼がカクッと飛ぶ。
const GLIDE_BLEND = 7;

class ChicchiRig {
  constructor() {
    this.bones = [];
    for (let i = 0; i < BONE_COUNT; i++) {
      this.bones.push({ t: [0,0,0], r: [0,0,0], s: [1,1,1] });
    }
    this.world = []; this.skin = []; this.skinN = [];
    for (let i = 0; i < BONE_COUNT; i++) {
      this.world.push(M4.ident()); this.skin.push(M4.ident()); this.skinN.push(M4.ident());
    }
    // uniform へ渡す平たい配列（毎フレーム作り直さない）
    this.skinFlat  = new Float32Array(BONE_COUNT * 16);
    this.skinNFlat = new Float32Array(BONE_COUNT * 16);

    // --- 状態 ---
    this.state = CJ_ANIM.IDLE;
    this.time = 0;
    this.squash = 1; this.squashV = 0;   // 縦の潰れ／伸び（バネで戻る）
    this.flapPhase = 0; this.flapFreq = 0; this.flapAmp = 0;
    this.spin = 0; this.spinning = false; this.spinDur = 0.45; this.spinT = 0;
    this.lean = 0; this.leanV = 0;       // 横向きの傾き（横速度から）
    this.headLag = 0; this.headLagV = 0; // 頭のおくれ追従＝生き物感
    this.blinkT = rnd(1.5, 4.0); this.blink = 0;
    this.gaze = [0, 0]; this.gazeTarget = [0, 0];
    this.hurtT = 0;
    this.breathe = 0;
    // 滑空（つばさ使用中）。0=羽ばたき 1=滑空。この値で既存ポーズと混ぜる。
    this.glide = false;
    this.glideAmt = 0;
    this.glideBank = 0; this.glideBankV = 0;   // 横へ進む向きへ倒す角（バネで追従）
  }

  // 着地。落下の速さで潰れ量が変わる。
  land(impact) {
    const k = clamp(impact, 0, 1);
    this.squash = lerp(0.82, 0.60, k);
    this.squashV = 0;
    this.state = CJ_ANIM.LAND;
    this.time = 0;
    this.gazeTarget = [0, -0.5];
  }
  // バネ雲。潰れの直後に強く伸びる。
  spring() { this.squash = 1.50; this.squashV = 2.0; this.state = CJ_ANIM.RISE; this.time = 0; }
  // ジャンプ発射
  launch(power) {
    this.squash = lerp(1.18, 1.35, clamp(power, 0, 1));
    this.state = CJ_ANIM.RISE; this.time = 0;
    this.flapFreq = 8; this.flapAmp = 1;
    this.gazeTarget = [0, 0.45];
  }
  hurt() { this.state = CJ_ANIM.HURT; this.hurtT = 0.45; this.gazeTarget = [0, 0]; }
  // 宙返り。着地までの残り時間から回転の速さを決め、必ず着地までに終わらせる。
  flip(duration) {
    if (this.spinning) return;
    this.spinning = true; this.spinT = 0;
    this.spinDur = clamp(duration || 0.45, 0.30, 0.85);
  }

  update(dt, ctx) {
    const c = ctx || {};
    this.time += dt;
    dt = Math.min(dt, 1 / 30);

    // --- 潰れ／伸びをバネで 1.0 へ戻す。行きすぎて戻る（オーバーシュート）が
    //     バネ感の正体なので、減衰は弱めにする。
    const stiff = this.state === CJ_ANIM.LAND ? 420 : 260;
    const damp = 2 * Math.sqrt(stiff) * 0.62;
    const acc = (1 - this.squash) * stiff - this.squashV * damp;
    this.squashV += acc * dt;
    this.squash += this.squashV * dt;
    this.squash = clamp(this.squash, 0.45, 1.75);

    // --- 上昇・落下で縦に伸びる（速さの表現）---
    const vy = c.vy || 0, vMax = c.vMax || 14;
    const k = clamp(Math.abs(vy) / vMax, 0, 1);
    if (this.state !== CJ_ANIM.LAND && !this.spinning) {
      const target = 1 + 0.22 * k;
      this.squash += (target - this.squash) * Math.min(1, dt * 6);
    }
    if (this.state === CJ_ANIM.LAND && this.time > 0.18) {
      this.state = vy < 0 ? CJ_ANIM.RISE : CJ_ANIM.FALL;
    }

    // --- 横の傾き（進む向きへ体をかたむける）---
    const vx = c.vx || 0, vxMax = c.vxMax || 6;
    const leanT = -clamp(vx / vxMax, -1, 1) * 0.32;
    [this.lean, this.leanV] = spring(this.lean, this.leanV, leanT, 150, dt);

    // --- 頭のおくれ追従。ほんの少し遅れるだけで生き物に見える ---
    [this.headLag, this.headLagV] = spring(this.headLag, this.headLagV, this.lean * 0.55, 90, dt);

    // --- 滑空（つばさ🪽を使っているあいだ）---
    // 呼び出し側が o.glide を渡す。未指定なら false＝いままで通りの羽ばたき。
    this.glide = !!c.glide;
    // 0→1 を lerp で追わせて、ポーズは必ずこの値ごしに混ぜる。
    this.glideAmt += ((this.glide ? 1 : 0) - this.glideAmt) * Math.min(1, dt * GLIDE_BLEND);
    // バンクの目標。o.vx があればそれ、無ければ既存の lean から逆算する。
    // （lean = -clamp(vx/vxMax)*0.32 なので 0.32 で割れば -1..1 に戻る）
    const bankN = (c.vx !== undefined)
      ? -clamp(vx / vxMax, -1, 1)
      : clamp(this.lean / 0.32, -1, 1);
    // ★生の vx をそのまま角度にすると、左右キーの押し離しで翼がピクつく。
    //   lean と同じくバネを通して鈍らせる。剛性は lean(150)より低めにして
    //   「大きな鳥がゆっくり傾く」感じを出す。
    [this.glideBank, this.glideBankV] =
      spring(this.glideBank, this.glideBankV, bankN * GLIDE_BANK, 110, dt);

    // --- 羽ばたき。ジャンプ直後に速く、だんだん落ちつく ---
    this.flapFreq = Math.max(1.6, this.flapFreq - dt * 9);
    this.flapAmp += ((vy < -1 ? 1 : 0.42) - this.flapAmp) * Math.min(1, dt * 4);
    this.flapPhase += this.flapFreq * dt * Math.PI * 2;

    // --- 宙返り ---
    if (this.spinning) {
      this.spinT += dt;
      const p = clamp(this.spinT / this.spinDur, 0, 1);
      this.spin = easeOutBack(p, 1.05) * Math.PI * 2;
      if (p >= 1) { this.spinning = false; this.spin = 0; }
    }

    // --- 被弾 ---
    if (this.hurtT > 0) this.hurtT = Math.max(0, this.hurtT - dt);

    // --- まばたき（不規則に）---
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinkT = rnd(1.8, 5.2); this.blink = 1; }
    this.blink = Math.max(0, this.blink - dt * 7.5);

    // --- 呼吸。完全に止まる瞬間を作らない ---
    this.breathe = Math.sin(this.time * Math.PI * 2 * 0.8) * 0.5 + 0.5;

    // --- 視線。次の足場を見る／落ちているときは下を見る ---
    if (this.hurtT > 0)      this.gazeTarget = [0, 0];
    else if (vy > vMax * 0.45) this.gazeTarget = [0, -0.55];
    else if (c.lookX !== undefined) this.gazeTarget = [clamp(c.lookX, -1, 1), clamp(c.lookY ?? 0.3, -1, 1)];
    this.gaze[0] += (this.gazeTarget[0] - this.gaze[0]) * Math.min(1, dt * 9);
    this.gaze[1] += (this.gazeTarget[1] - this.gaze[1]) * Math.min(1, dt * 9);

    this.pose();
  }

  // 状態から骨の姿勢を作る
  pose() {
    const B = this.bones;
    // 滑空の混ぜぐあい。g=0 のとき下のどの式も「いままでと完全に同じ値」に戻ること。
    const g = this.glideAmt;

    // root：体積を保った潰れ／伸び ＋ 宙返り ＋ 傾き
    const s = this.spinning ? 1 : this.squash;   // 回っている最中に潰すと形が読めなくなる
    const inv = 1 / Math.sqrt(s);
    const hurtShake = this.hurtT > 0 ? Math.sin(this.hurtT * Math.PI * 2 * 12) * 0.10 : 0;
    B[BONE.root].s = [inv * (1 + hurtShake), s, inv * (1 - hurtShake * 0.5)];
    // 滑空中は lean のかわりにバンクを使う（強さがちがうだけで向きは同じ）。
    // 宙返りの this.spin はさわらないので、滑空中に宙返りしても回りきる。
    B[BONE.root].r = [this.spin, 0, lerp(this.lean, this.glideBank, g)];

    // spine：呼吸でわずかに上下
    const br = 1 + (this.breathe - 0.5) * 0.030;
    B[BONE.spine].s = [1, br, 1];
    // 前傾は root ではなく spine に入れる。
    // ★root に入れると宙返り（root の X回転）と足し算になって、回転の途中で
    //   ヘンな軸まわりに倒れる。spine なら宙返りと独立して効く。
    B[BONE.spine].r = [GLIDE_PITCH * g, 0, 0];

    // head：おくれ追従＋見る方向へすこし向く
    B[BONE.head].r = [
      this.gaze[1] * -0.16,
      this.gaze[0] * 0.26,
      (this.lean - this.headLag) * 0.9,
    ];

    // 翼：羽ばたき。上昇中は大きく、落下中はひかえめ。
    // 振れ幅は控えめでいい。大きすぎるとTの字に開いて鳥に見えなくなる。
    const f = Math.sin(this.flapPhase) * this.flapAmp;
    const flapOpen = -0.12 * this.flapAmp + f * 0.32;
    // 滑空ぶんを混ぜる。混ぜるのは「角度」であって「振るかどうか」ではない点が大事。
    // flapPhase は滑空中も進めたままにしてあるので、滑空をやめた瞬間に位相が
    // 飛ばず、そのまま羽ばたきへ戻れる。
    const openL = lerp(flapOpen, GLIDE_OPEN, g);
    B[BONE.wingL].r = [0, 0,  openL];
    B[BONE.wingR].r = [0, 0, -openL];
    // 先端は位相を遅らせて振る＝しなり。付け根が返しても先はまだ返っていない。
    // 滑空中はしなりを止めて、上へ反った角度で固定する。
    const fLag = Math.sin(this.flapPhase - 0.95) * this.flapAmp * 0.26;
    const tipL = lerp(fLag, GLIDE_TIP, g);
    B[BONE.wingLTip].r = [0, 0,  tipL];
    B[BONE.wingRTip].r = [0, 0, -tipL];

    // 足：落下中はすこし前へ、着地でたたむ
    const footTuck = this.state === CJ_ANIM.LAND ? 0.55 : 0.12;
    B[BONE.footL].r = [footTuck, 0, 0];
    B[BONE.footR].r = [footTuck, 0, 0];

    // --- 骨のワールド行列 → スキン行列 ---
    for (let i = 0; i < BONE_COUNT; i++) {
      const rest = BONE_REST[i], b = B[i];
      const t = [rest.t[0] + b.t[0], rest.t[1] + b.t[1], rest.t[2] + b.t[2]];
      const r = [rest.r[0] + b.r[0], rest.r[1] + b.r[1], rest.r[2] + b.r[2]];
      const local = M4.compose(t, r, b.s);
      this.world[i] = rest.parent < 0 ? local : M4.mul(this.world[rest.parent], local);
      this.skin[i]  = M4.mul(this.world[i], BONE_INV_BIND[i]);
      this.skinN[i] = M4.normalMat(this.skin[i]);
      this.skinFlat.set(this.skin[i], i * 16);
      this.skinNFlat.set(this.skinN[i], i * 16);
    }
  }
}
