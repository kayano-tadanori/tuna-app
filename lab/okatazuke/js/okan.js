// ============================================================
// okan.js — オカンの3Dモデルと動き
//
// ★形を直す前に必ず 素材/okan.png を見る（チッチのときに一度、
//   実物と違う形を作って指摘された [[project_chicchi_jump_3d]]）。
//   茶色のボブ／白いはちまき（ピンクのしるし）／白い割烹着＋ピンクの袖口／
//   ピンクのたすき／うすピンクのエプロン（OKのポケット）／ピンクのズボン／
//   白いぞうり（ピンクの鼻緒）／頭の上にチッチ。
//
// 骨（部品のまとまり）
//   0 ROOT  … 全体（位置・向き・はずみ・前かがみ）
//   1 TORSO … 胴          2 HEAD … 頭
//   3 ARM_LU 4 ARM_LF     5 ARM_RU 6 ARM_RF
//   7 LEG_L  8 LEG_R      9 CHICCHI
// ============================================================
'use strict';

// ★骨の番号。0〜9 は 手組みオカンのころからの並び（変えると 古い部品がズレる）。
//   10〜16 は 2026-08-24 に足した「関節」。
//   CHEST … 胸。ここから 腕がぶら下がる（腰と胸を分けると 上体をひねれる）
//   ALS/ARS … 鎖骨。**腕を上げたとき 肩も いっしょに動く**ので 肩が裂けない
//   LLK/LRK … ひざ ／ LLF/LRF … 足くび
const OK_BONE = {
  ROOT: 0, TORSO: 1, HEAD: 2, ALU: 3, ALF: 4, ARU: 5, ARF: 6, LL: 7, LR: 8, CHI: 9,
  CHEST: 10, ALS: 11, ARS: 12, LLK: 13, LRK: 14, LLF: 15, LRF: 16,
};
const OK_NBONE = 17;   // シェーダの上限は SH.BONES(24)

const OKCOL = {
  skin:   '#ffe0c0',
  hair:   '#6b4226',
  hair2:  '#8a5a35',
  white:  '#fbfaf6',
  pink:   '#e8447c',
  lpink:  '#f9c3d4',
  ppink:  '#f5a8c2',
  sole:   '#ffffff',
  bird:   '#ffd93b',
  birdF:  '#ff9d5c',
  beak:   '#e84a2e',
  wing:   '#6e9e2e',
  eye:    '#2a1d18',
};

// 体の寸法（1マス = 1.0）
const OKD = {
  hip: 0.315,      // こしの高さ
  waist: 0.33,     // 胴のはじまり
  torsoH: 0.375,   // 胴の高さ
  shoulder: 0.315, // 胴のなかでの肩の高さ
  headY: 0.355,    // 胴のてっぺんからの頭の位置
  headR: 0.213,
  legLen: 0.295,
  armU: 0.162,
  armF: 0.135,
  // ↓ もとは update() に直書きしていた支点。取りこんだモデルは体つきが違うので、
  //   寸法表から引けるようにした（js/char_*.js の dims がこの形で入っている）
  shoulderX: 0.196,   // 肩の支点の左右
  legX: 0.078,        // 脚のつけ根の左右
  armZ: 0.004,        // 肩の支点の前後
  chiZ: -0.012,       // 頭のてっぺんに乗る鳥の前後
  armSwingMax: 99,    // 腕をふれる角度の上限（ラジアン）。手組みオカンは制限なし
};

// ---- 顔とはちまきの絵（画像ファイルは使わない） ------------------------
function okanFaceTexture() {
  const W = 1024, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  // 上半分（UV v=0.5..1.0）＝ 頭。下半分（v=0..0.5）＝ はちまき
  // ★キャンバスの上下は UV と逆（UNPACK_FLIP_Y_WEBGL を使う）
  //   UV v → キャンバス y = (1 - v) * H
  g.fillStyle = OKCOL.skin; g.fillRect(0, 0, W, H / 2);
  g.fillStyle = OKCOL.white; g.fillRect(0, H / 2, W, H / 2);

  // ---- 顔（頭のUV：u=0.25 が正面／v=t 下から上） ----
  const fx = u => u * W;
  const fy = t => (1 - (0.5 + t * 0.5)) * H;   // 頭の t → キャンバス y
  const cx = fx(0.25);

  const eyeY = fy(0.505), eyeDX = W * 0.052, eyeRX = W * 0.030, eyeRY = W * 0.038;
  // ほっぺ
  g.fillStyle = 'rgba(255,150,165,0.55)';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + s * eyeDX * 1.85, eyeY + eyeRY * 0.95, W * 0.028, W * 0.019, 0, 0, 7);
    g.fill();
  }
  // まゆ
  g.strokeStyle = '#6b4226'; g.lineWidth = W * 0.008; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * eyeDX - s * eyeRX * 0.9, eyeY - eyeRY * 1.75);
    g.quadraticCurveTo(cx + s * eyeDX, eyeY - eyeRY * 2.15, cx + s * eyeDX + s * eyeRX * 0.9, eyeY - eyeRY * 1.6);
    g.stroke();
  }
  // 目（黒目＋ハイライト2つ。ハイライトが1つだと目が死ぬ）
  for (const s of [-1, 1]) {
    const ex = cx + s * eyeDX;
    g.fillStyle = OKCOL.eye;
    g.beginPath(); g.ellipse(ex, eyeY, eyeRX, eyeRY, 0, 0, 7); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(ex - eyeRX * 0.34, eyeY - eyeRY * 0.36, eyeRX * 0.34, eyeRY * 0.30, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(ex + eyeRX * 0.36, eyeY + eyeRY * 0.34, eyeRX * 0.17, eyeRY * 0.15, 0, 0, 7); g.fill();
  }
  // 口（あけて笑っている）
  const my = eyeY + eyeRY * 1.9;
  g.fillStyle = '#c0392b';
  g.beginPath();
  g.moveTo(cx - W * 0.030, my - W * 0.006);
  g.quadraticCurveTo(cx, my + W * 0.036, cx + W * 0.030, my - W * 0.006);
  g.quadraticCurveTo(cx, my + W * 0.006, cx - W * 0.030, my - W * 0.006);
  g.fill();
  g.fillStyle = '#ff8fa0';
  g.beginPath(); g.ellipse(cx, my + W * 0.019, W * 0.014, W * 0.008, 0, 0, 7); g.fill();

  // ---- はちまき（下半分）。正面 u=0.25 に オカン学園のしるし ----
  const by = (1 - 0.25) * H;   // はちまきUVのまんなかあたり
  g.strokeStyle = OKCOL.pink; g.lineWidth = W * 0.012; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const o = (i - 1) * W * 0.020;
    g.beginPath();
    g.moveTo(cx - W * 0.045, by + o + W * 0.010);
    g.quadraticCurveTo(cx, by + o - W * 0.022, cx + W * 0.045, by + o + W * 0.004);
    g.stroke();
  }
  // はちまきの ふちのピンクの線
  g.fillStyle = 'rgba(232,68,124,0.85)';
  g.fillRect(0, H * 0.5, W, H * 0.012);
  return cv;
}

// ---- モデルを組み立てる -------------------------------------------------
function buildOkan() {
  const B = new PartBuilder();
  const HEAD_UV = [0, 0.5, 1, 1];
  const BAND_UV = [0, 0, 1, 0.5];

  // ===== 足（ズボン＋ぞうり）。骨は こし にあり、下へ伸びる =====
  for (const [bone, sx] of [[OK_BONE.LL, 1], [OK_BONE.LR, -1]]) {
    // ★ロフトは +Y にしか作れないので、Rx(π) を焼きこんで下へ向ける
    const down = mul(Rx(Math.PI), S(sx, 1, 1));
    B.add(limb(OKD.legLen, 0.070, 0.058, { zs: 1.0 }), { bone, mat: down, col: OKCOL.pink, shine: 0.12 });
    // ぞうり（白い底）
    const footM = mul(T(0, -OKD.legLen - 0.012, 0.012), S(1, 1, 1));
    B.add(roundBox(0.115, 0.036, 0.175, { k: 4.2, edge: 3.2 }), { bone, mat: footM, col: OKCOL.sole });
    // 鼻緒
    B.add(roundBox(0.088, 0.020, 0.030, { k: 3.0, edge: 2.4 }),
          { bone, mat: T(0, -OKD.legLen + 0.020, 0.052), col: OKCOL.pink });
  }

  // ===== 胴（白い割烹着） =====
  {
    const h = OKD.torsoH;
    const body = loftGeometry({
      rings: 20, radial: 24, k: 2.75,
      profile: t => {
        // こし → むね → 肩 → 首
        const rx = 0.138 + 0.028 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - 0.075 * Math.pow(Math.max(0, t - 0.86) / 0.14, 2);
        const rz = 0.100 + 0.022 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - 0.055 * Math.pow(Math.max(0, t - 0.86) / 0.14, 2);
        return [rx, rz];
      },
      spine: t => [0, t * h, 0],
      minR: 0.02,
    });
    B.add(body, { bone: OK_BONE.TORSO, col: OKCOL.white, shine: 0.10 });

    // 割烹着の すそ（ひらっとした ふち）
    B.add(loftGeometry({
      rings: 8, radial: 24, k: 2.75,
      profile: t => [0.140 + 0.030 * t, 0.102 + 0.024 * t],
      spine: t => [0, -t * 0.055, 0],
      minR: 0.02, capTop: false,
    }), { bone: OK_BONE.TORSO, mat: T(0, 0.045, 0), col: OKCOL.white, shine: 0.10 });

    // エプロン（うすピンク）。胸から こし まで、前がわに
    const apron = loftGeometry({
      rings: 14, radial: 20, k: 4.5,
      profile: t => {
        // 上（むな当て）はせまく、下は広がる
        const w = t > 0.62 ? 0.058 + 0.006 * (1 - t) : 0.075 + 0.062 * (0.62 - t);
        return [w, 0.020];
      },
      spine: t => [0, t * 0.30, 0.006 * Math.sin(Math.PI * t)],
      minR: 0.006,
    });
    B.add(apron, { bone: OK_BONE.TORSO, mat: T(0, 0.020, 0.108), col: OKCOL.lpink, shine: 0.05 });
    // ポケット
    B.add(roundBox(0.105, 0.062, 0.016, { k: 4.5, edge: 3.0 }),
          { bone: OK_BONE.TORSO, mat: T(0, 0.075, 0.122), col: OKCOL.ppink });

    // たすき（ピンクの帯が むねで交差する）
    for (const s of [-1, 1]) {
      const strap = loftGeometry({
        rings: 12, radial: 12, k: 3.4,
        profile: () => [0.024, 0.015],
        spine: t => [s * (t - 0.5) * 0.20, t * 0.30, 0.100 - 0.030 * Math.pow(2 * t - 1, 2)],
        minR: 0.006,
      });
      B.add(strap, { bone: OK_BONE.TORSO, mat: T(0, 0.045, 0), col: OKCOL.pink, shine: 0.15 });
    }
  }

  // ===== 腕 =====
  for (const [bu, bf, sx] of [[OK_BONE.ALU, OK_BONE.ALF, 1], [OK_BONE.ARU, OK_BONE.ARF, -1]]) {
    const down = mul(Rx(Math.PI), S(sx, 1, 1));
    // 二の腕＝白い そで
    B.add(limb(OKD.armU, 0.056, 0.050), { bone: bu, mat: down, col: OKCOL.white, shine: 0.10 });
    // そで口のピンク
    B.add(limb(0.030, 0.058, 0.056), { bone: bu, mat: mul(T(0, -OKD.armU - 0.004, 0), Rx(Math.PI)), col: OKCOL.pink });
    // 前腕＝はだ
    B.add(limb(OKD.armF, 0.040, 0.036), { bone: bf, mat: down, col: OKCOL.skin });
    // 手
    B.add(ball(0.049, { sy: 0.92, sz: 0.88 }),
          { bone: bf, mat: T(0, -OKD.armF - 0.030, 0), col: OKCOL.skin });
  }

  // ===== 頭 =====
  const R = OKD.headR;
  {
    // 顔（テクスチャつき）
    B.add(ball(R, { sy: 0.99, sz: 0.94, k: 2.1, rings: 26, radial: 34 }),
          { bone: OK_BONE.HEAD, col: '#ffffff', tex: 1, faceMask: 1, uvRect: HEAD_UV });

    // 髪（ボブ）
    // ★房を1本ずつ並べると顔の前に木の板が立ちならぶ（実測でそうなった）。
    //   頭より ひとまわり大きい「かぶせもの」を後ろへ ずらして置き、
    //   前だけ顔が出るようにする。出っぱりの境目が そのまま前髪の線になる。
    // ★断面を「高さごとに前後させる」のがキモ。
    //   ひたいの高さでは前に出して前髪にし、目の高さでは後ろへ引いて顔を出す。
    //   （まん丸のかぶせものを後ろへずらす方式では、顔が全部かくれた＝実測）
    //   OKAN_WIG … [t, 中心y, 中心z, 横はば, 前後はば]
    const OKAN_WIG = [
      [0.00, R - 0.220, -0.080, 0.196, 0.190],   // 首すじ
      [0.16, R - 0.155, -0.100, 0.232, 0.220],   // あご
      [0.36, R - 0.040, -0.112, 0.246, 0.232],   // ほお
      [0.52, R + 0.042, -0.096, 0.243, 0.229],   // 目の高さ（ここで顔が出る）
      [0.62, R + 0.088, -0.046, 0.238, 0.227],   // ひたい（ここから前髪でかくす）
      [0.74, R + 0.140, -0.026, 0.226, 0.218],
      [0.86, R + 0.184, -0.020, 0.196, 0.190],
      [0.94, R + 0.214, -0.018, 0.140, 0.136],
      [1.00, R + 0.232, -0.018, 0.020, 0.020],   // てっぺん
    ];
    const wig = loftGeometry({
      rings: 30, radial: 34, k: 2.95,
      profile: t => [curve(OKAN_WIG, t, 3), curve(OKAN_WIG, t, 4)],
      spine: t => [0, curve(OKAN_WIG, t, 1), curve(OKAN_WIG, t, 2)],
      capBottom: false, minR: 0.01,
    });
    B.add(wig, { bone: OK_BONE.HEAD, col: OKCOL.hair, shine: 0.18 });

    // はちまき（白いバンダナ）。髪より ひとまわり外がわに、前髪の線より上から
    const bandT0 = 0.775;
    const band = loftGeometry({
      rings: 14, radial: 34, k: 2.95,
      profile: t => {
        const u = bandT0 + (0.995 - bandT0) * t;
        return [curve(OKAN_WIG, u, 3) * 1.02 + 0.005, curve(OKAN_WIG, u, 4) * 1.02 + 0.005];
      },
      spine: t => {
        const u = bandT0 + (0.995 - bandT0) * t;
        return [0, curve(OKAN_WIG, u, 1), curve(OKAN_WIG, u, 2)];
      },
      capBottom: false, minR: 0.008,
    });
    B.add(band, { bone: OK_BONE.HEAD, col: '#ffffff', tex: 1, uvRect: BAND_UV, shine: 0.12 });
    // 横の むすび目 と しっぽ
    B.add(ball(0.045, { sy: 0.85, sz: 0.85 }),
          { bone: OK_BONE.HEAD, mat: T(-R * 1.16, R * 1.20, -0.05), col: OKCOL.white });
    for (const s of [0.30, -0.18]) {
      B.add(roundBox(0.042, 0.070, 0.026, { k: 3.0, edge: 2.6 }), {
        bone: OK_BONE.HEAD,
        mat: mul(T(-R * 1.26, R * 1.14, -0.06), Rz(0.7 + s), Rx(s * 0.8)),
        col: OKCOL.white,
      });
    }
  }

  // ===== 頭の上のチッチ（黄色いボタンインコ） =====
  {
    const b = OK_BONE.CHI;
    B.add(ball(0.052, { sy: 1.12, sz: 0.92 }), { bone: b, col: OKCOL.bird });
    B.add(ball(0.040, { sy: 0.95, sz: 0.95 }), { bone: b, mat: T(0, 0.072, 0.010), col: OKCOL.bird });
    B.add(ball(0.030, { sy: 0.90, sz: 0.95 }), { bone: b, mat: T(0, 0.086, 0.030), col: OKCOL.birdF });
    // くちばし
    B.add(loftGeometry({
      rings: 8, radial: 10, k: 2.2,
      profile: t => [0.016 * (1 - t * 0.85), 0.014 * (1 - t * 0.85)],
      spine: t => [0, t * 0.030, 0],
      minR: 0.003,
    }), { bone: b, mat: mul(T(0, 0.098, 0.052), Rx(1.5)), col: OKCOL.beak });
    // 目（白いアイリングが目じるし）
    for (const s of [-1, 1]) {
      B.add(ball(0.013, { sy: 0.9 }), { bone: b, mat: T(s * 0.019, 0.098, 0.037), col: '#ffffff' });
      B.add(ball(0.008, { sy: 0.9 }), { bone: b, mat: T(s * 0.019, 0.103, 0.045), col: OKCOL.eye });
    }
    // しっぽ
    B.add(roundBox(0.030, 0.060, 0.016, { k: 3.0, edge: 2.4 }),
          { bone: b, mat: mul(T(0, 0.020, -0.055), Rx(-0.7)), col: OKCOL.wing });
  }

  return B;
}

// 歩きの関節角の曲線と バネ・IK は lab/_lib/motion.js（共通の動きエンジン）にある。
// ★ここに書き写さない。ほかのゲームでも 同じ動きを使いまわすため。
const OK_GAIT = MOTION.GAIT;
const OK_D2R = MOTION.D2R;
const okCurve = MOTION.curve;

// ---- 骨の支点（ピボット）------------------------------------------------
// 取りこんだモデルは dims.p に「立ち姿での支点の位置」をそのまま持っている。
// 手組みオカン（OKD）は 昔の寸法の形なので、ここで同じ形に変換する。
// ★親からの差だけで組むので、+0.008 のような つじつま合わせが要らない。
function okPivots(D) {
  if (D.p) return D.p;
  const y = D.waist;
  const sh = y + D.shoulder + 0.008;
  const mir = a => [a, [-a[0], a[1], a[2]]];
  return {
    waist: [0, y, 0],
    chest: [0, y + D.torsoH * 0.45, 0],
    head: [0, y + D.torsoH - 0.02, 0],
    headTop: y + D.torsoH - 0.02 + D.headR * 2.02,
    clav: mir([D.shoulderX * 0.45, sh, D.armZ]),
    arm: mir([D.shoulderX, sh, D.armZ]),
    elbow: mir([D.shoulderX, sh - D.armU, D.armZ]),
    hand: mir([D.shoulderX, sh - D.armU - D.armF, D.armZ]),
    hip: mir([D.legX, D.hip, 0]),
    knee: mir([D.legX, D.hip - D.legLen * 0.5, 0]),
    foot: mir([D.legX, D.hip - D.legLen, 0]),
    chiZ: D.chiZ,
    armSwingMax: D.armSwingMax,
  };
}

// a から b への 平行移動
function TD(a, b) { return T(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }

// ---- 骨のポーズを組み立てる ---------------------------------------------
// 返り値：mat4 × OK_NBONE（ワールド行列）
class OkanRig {
  // dims … 骨の支点。手組みオカンは OKD、取りこんだモデルは CHAR_MODELS.<id>.dims を渡す。
  //        動きの式（ふり幅・タイミング）は共通。支点だけ差しかえる。
  constructor(dims) {
    this.D = dims || OKD;
    this.P = okPivots(this.D);
    this.bones = [];
    for (let i = 0; i < OK_NBONE; i++) this.bones.push(M4.ident());
    this.t = 0;
    this.walk = 0;        // 0..1 歩いている強さ
    this.walkPhase = 0;
    this.push = 0;        // 0..1 おしている強さ
    this.cheer = 0;       // 0..1 よろこび
    this.sad = 0;         // 0..1 がっくり（詰み）
    this.wave = 0;        // 0..1 手をふる
    this.bow = 0;         // 0..1 おじぎ
    this.yaw = 0;
    this.pos = [0, 0, 0];
    this._ph = new MOTION.Phase(0.5);   // 歩調（進んだ距離から出す）
    // ★1歩で どれだけ進むか。盤の上は 1マス＝1歩なので game.js が 1.0 を入れる。
    //   0 のままだと 体の大きさから 見つもる（タイトルの演目むけ）。
    this.stride = 0;
    this.scale = 1;   // 盤の上では すこし大きく見せる
  }

  update(dt) {
    this.t += dt;
    const P = this.P;
    const w = this.walk, p = this.push, c = this.cheer, s = this.sad;
    const wv = this.wave, bw = this.bow;

    // ★歩調は「進んだ距離」で決める（motion.js の Phase）。
    //   時間で回すと 足が地面をすべる。1歩＝こしの高さの0.8倍。
    this._ph.stride = this.stride > 0
      ? this.stride : Math.max(0.05, P.hip[0][1] * this.scale * 0.80);
    if (w > 0) this.walkPhase = this._ph.step(this.pos, dt, 7.2 + 1.6 * p);
    else { this._ph.have = false; this._ph.v = this.walkPhase; }
    const ph = this.walkPhase;
    const idle = Math.sin(this.t * 2.1) * 0.012;
    const breathe = Math.sin(this.t * 1.6) * 0.006;

    // よろこびのジャンプ／おすときは 腰を落として ふんばる
    const hop = c > 0 ? Math.abs(Math.sin(this.t * 8.0)) * 0.10 * c : 0;
    const bob = Math.abs(Math.sin(ph)) * 0.024 * w + idle + hop - p * 0.055 - s * 0.03;
    // ★おすときの前かがみは 弱めに。頭の大きい子たちは 深く曲げると
    //   頭が にもつに うずもれて 顔が見えなくなる（実測）。
    const lean = p * 0.11 + w * 0.08 - s * 0.10 + bw * 0.55;

    const root = mul(T(this.pos[0], this.pos[1] + bob, this.pos[2]),
                     Ry(this.yaw), Rx(lean), S(this.scale));
    this.bones[OK_BONE.ROOT] = root;

    // 腰：歩くと左右にゆれ、上体は 進む向きへ すこしひねる
    const twist = Math.sin(ph) * 0.14 * w;
    const torso = mul(root, T(P.waist[0], P.waist[1], P.waist[2]),
                      Rz(Math.sin(ph) * 0.045 * w),
                      Ry(-twist * 0.5),
                      Rx(p * 0.10 + s * 0.22 + bw * 0.35 + breathe));
    this.bones[OK_BONE.TORSO] = torso;

    // 胸：腰と逆にひねる（人は そうやって歩く）。おすときは さらに前へかぶせる
    const chest = mul(torso, TD(P.waist, P.chest),
                      Ry(twist * 0.9),
                      Rz(-Math.sin(ph) * 0.035 * w),
                      Rx(p * 0.12 - c * 0.14 + bw * 0.18 + s * 0.06));
    this.bones[OK_BONE.CHEST] = chest;

    const nod = -p * 0.04 + Math.sin(this.t * 1.7) * 0.02 - s * 0.30 + c * 0.20 + bw * 0.30;
    const head = mul(chest, TD(P.chest, P.head), Rx(nod),
                     Ry(Math.sin(this.t * 0.9) * 0.05 * (1 - w) - twist * 0.4));
    this.bones[OK_BONE.HEAD] = head;

    this.bones[OK_BONE.CHI] = mul(head, T(0, P.headTop - P.head[1], P.chiZ),
                                  Rz(Math.sin(this.t * 3.3) * 0.10),
                                  Ry(Math.sin(this.t * 1.3) * 0.3));

    // ---- 腕 --------------------------------------------------------------
    // ★肩が裂けないように、鎖骨（ALS/ARS）が 腕の上げに ついていく。
    //   むかしは 上腕だけを回していたので、脇の布が 引きちぎられて 板になった。
    const lim = P.armSwingMax === undefined ? 99 : P.armSwingMax;
    const sides = [[OK_BONE.ALS, OK_BONE.ALU, OK_BONE.ALF, 1, 0],
                   [OK_BONE.ARS, OK_BONE.ARU, OK_BONE.ARF, -1, 1]];
    for (const [bs, bu, bf, sx, k] of sides) {
      // 腕は 反対がわの足と 同じ位相（人はそう歩く）
      const swing = Math.sin(ph + (sx > 0 ? Math.PI : 0)) * 0.48 * w * (1 - p * 0.55);
      // おす … 両腕を 前下がりに出して にもつに手をあてる
      const fwd = -p * 1.20;
      const up = -c * 1.95 - (sx < 0 ? wv * 1.5 : 0);
      const ax = Math.max(-lim, Math.min(lim, swing + fwd + up));
      // 鎖骨は 腕の上げ下げの 3割ほど ついていく（＝肩がついてくる）
      const shoulder = mul(chest, TD(P.chest, P.clav[k]),
                           Rx(ax * 0.30),
                           Rz(sx * (0.05 - c * 0.16 - p * 0.05)));
      this.bones[bs] = shoulder;

      // 横への開き：よろこぶと V の字、おすと すこし内向き
      // ★+ が 外。前は -0.06（内向き）で 脇が閉じて見えた
      const open = sx * (0.13 - p * 0.05 - c * 0.42 + s * 0.05 - wv * 0.10);
      const arm = mul(shoulder, TD(P.clav[k], P.arm[k]),
                      Rz(open),
                      Rx(ax * 0.70),
                      Ry(sx * (p * 0.10 - c * 0.08)));
      this.bones[bu] = arm;

      // ひじ：おすときは 曲げて ふんばる。歩くときは 前へ出るとき すこし曲がる
      let elbow = -0.16 - p * 0.26 - c * 0.35
        + Math.max(0, Math.sin(ph + (sx > 0 ? Math.PI : 0))) * 0.22 * w * (1 - p);
      if (wv > 0 && sx < 0) elbow -= wv * (1.05 + Math.sin(this.t * 11.0) * 0.42);
      this.bones[bf] = mul(arm, TD(P.arm[k], P.elbow[k]), Rx(elbow),
                           Rz(sx * p * 0.10));
    }

    // ---- 足 --------------------------------------------------------------
    // ★ひざと足くびを 足した。棒のまま前後にふると 竹馬に見える。
    //   ひざは 前へ振り出すとき いちばん曲がる（地面に つま先を ぶつけないため）。
    const legs = [[OK_BONE.LL, OK_BONE.LLK, OK_BONE.LLF, 1, 0],
                  [OK_BONE.LR, OK_BONE.LRK, OK_BONE.LRF, -1, 1]];
    for (const [bl, bk, bfo, sx, k] of legs) {
      // 左右で 半周期ずらす。u は 0..1 の 歩行周期の位置
      const u = ph / (Math.PI * 2) + (sx > 0 ? 0 : 0.5);
      // ★Rx(+) は 足を うしろへ回す（上は前へ、下は後ろへ 回るため）。
      //   歩行曲線の「前へ振り出す」は + なので、符号を 反転して渡す。
      //   ここを まちがえて 1周期ずっと 足が うしろにあった（実測で発覚）。
      // ★盤の上では 小さく映るので 実測どおりだと「腿が上がっていない」と見える。
      //   1.35倍に 誇張する（アニメの定石）。
      const hipA = -okCurve(OK_GAIT.hip, u) * OK_D2R * w * 1.35
        // ★おすとき 足を うしろへ ずらしすぎると、まっすぐな脚が 弧をえがいて
        //   **かかとが 地面から 浮く**（実測で 両足が 浮いた）。ひかえめに。
        + (p * 0.14 + s * 0.05);
      const thigh = mul(root, T(P.hip[k][0], P.hip[k][1], P.hip[k][2]),
                        Rz(sx * (p * 0.03)), Rx(hipA));
      this.bones[bl] = thigh;

      // ★ひざは **プラス** が正しい向き。
      //   Rx(+) は 骨の下がわを うしろへ回す＝かかとが おしりへ寄る（人のひざ）。
      //   マイナスにすると **鳥のように 逆に折れる**（実機で指摘された）。
      const kneeA = okCurve(OK_GAIT.knee, u) * OK_D2R * w
        + 0.06 + p * 0.20 + c * 0.10 + s * 0.12;
      const knee = mul(thigh, TD(P.hip[k], P.knee[k]), Rx(kneeA));
      this.bones[bk] = knee;

      // 足くび：曲線ぶん＋残った傾きを 打ち消して 足の裏を 地面に近づける
      // ★足くびは 歩行曲線を そのまま出す。前は 打ち消しを強くかけすぎて
      //   ほとんど動かず「足首が稼働していない」と言われた。
      //   打ち消しは 立っているとき（w が小さいとき）だけ 効かせる。
      const flat = -(hipA + kneeA) * (0.55 - 0.42 * w);
      const ankleA = Math.max(-0.9, Math.min(0.9,
        -okCurve(OK_GAIT.ankle, u) * OK_D2R * w * 1.8 + flat + p * 0.16));
      this.bones[bfo] = mul(knee, TD(P.knee[k], P.foot[k]), Rx(ankleA));
    }
    return this.bones;
  }
}

// ---- Tripo から取りこんだモデルを、いまの骨の作りに合わせて組み立てる ----
// js/char_*.js の CHAR_MODELS.<id> は「立ち姿のワールド座標」で入っている。
// シェーダは sk * aPos で描くので、ここで bind 姿勢の逆行列をかけて骨ローカルへ移す。
//
// ★bind 姿勢は同じ OkanRig で作る。取りこみスクリプト（Python）側に骨の式を
//   書き写すと、こちらの式を直したときに黙ってズレて、体がねじれる。
// ★逆行列は「骨ごと」ではなく「頂点ごとに混ぜた行列」に対してかける。
//   シェーダの計算が sk = ΣwB なので、bind でも Σw B_rest を作って逆にしないと戻らない。
function okanB64(s, Type) {
  const b = atob(s);
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return new Type(u.buffer);
}

function buildOkanFromModel(M) {
  if (!M) return null;
  const n = M.n;
  const pos = okanB64(M.pos, Float32Array);
  const nrm = okanB64(M.nrm, Float32Array);
  const onrm = okanB64(M.onrm, Float32Array);
  const bone = okanB64(M.bone, Float32Array);
  // 3・4本目（古いモデルには無いので 重み0で埋める）
  const bone2 = M.bone2 ? okanB64(M.bone2, Float32Array) : new Float32Array(bone.length);

  const rig = new OkanRig(M.dims);
  const B = rig.update(0);                       // ← 立ち止まっている姿＝bind
  const BN = B.map(m => M4.normalMat(m, new Float32Array(16)));

  const mix = new Float32Array(16), mixN = new Float32Array(16);
  const inv = new Float32Array(16), invN = new Float32Array(16);
  const outP = new Float32Array(n * 3);
  const outN = new Float32Array(n * 3);
  const outO = new Float32Array(n * 3);
  let lastKey = '';

  for (let i = 0; i < n; i++) {
    const b0 = bone[i * 4] | 0, w0 = bone[i * 4 + 1];
    const b1 = bone[i * 4 + 2] | 0, w1 = bone[i * 4 + 3];
    const b2 = bone2[i * 4] | 0, w2 = bone2[i * 4 + 1];
    const b3 = bone2[i * 4 + 2] | 0, w3 = bone2[i * 4 + 3];
    // 同じ組み合わせが続くことが多いので、変わったときだけ逆行列を作り直す
    const key = b0 + '|' + w0 + '|' + b1 + '|' + w1 + '|' + b2 + '|' + w2 + '|' + b3;
    if (key !== lastKey) {
      for (let k = 0; k < 16; k++) {
        mix[k] = B[b0][k] * w0 + B[b1][k] * w1 + B[b2][k] * w2 + B[b3][k] * w3;
        mixN[k] = BN[b0][k] * w0 + BN[b1][k] * w1 + BN[b2][k] * w2 + BN[b3][k] * w3;
      }
      M4.invert(mix, inv);
      M4.invert(mixN, invN);
      lastKey = key;
    }
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    outP[i * 3] = inv[0] * x + inv[4] * y + inv[8] * z + inv[12];
    outP[i * 3 + 1] = inv[1] * x + inv[5] * y + inv[9] * z + inv[13];
    outP[i * 3 + 2] = inv[2] * x + inv[6] * y + inv[10] * z + inv[14];
    for (const [src, dst] of [[nrm, outN], [onrm, outO]]) {
      const a = src[i * 3], b = src[i * 3 + 1], c = src[i * 3 + 2];
      let vx = invN[0] * a + invN[4] * b + invN[8] * c;
      let vy = invN[1] * a + invN[5] * b + invN[9] * c;
      let vz = invN[2] * a + invN[6] * b + invN[10] * c;
      const L = Math.hypot(vx, vy, vz) || 1;
      dst[i * 3] = vx / L; dst[i * 3 + 1] = vy / L; dst[i * 3 + 2] = vz / L;
    }
  }

  return {
    pos: outP, nrm: outN, onrm: outO,
    uv: okanB64(M.uv, Float32Array),
    col: okanB64(M.col, Float32Array),
    param: okanB64(M.param, Float32Array),
    bone, bone2,
    idx: okanB64(M.idx, M.idx32 ? Uint32Array : Uint16Array),
    count: M.count,
  };
}

