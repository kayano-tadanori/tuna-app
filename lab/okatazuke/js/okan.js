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

const OK_BONE = { ROOT: 0, TORSO: 1, HEAD: 2, ALU: 3, ALF: 4, ARU: 5, ARF: 6, LL: 7, LR: 8, CHI: 9 };
const OK_NBONE = 10;

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

// ---- 骨のポーズを組み立てる ---------------------------------------------
// 返り値：mat4 × OK_NBONE（ワールド行列）
class OkanRig {
  // dims … 骨の支点。手組みオカンは OKD、取りこんだモデルは CHAR_MODELS.<id>.dims を渡す。
  //        動きの式（ふり幅・タイミング）は共通。支点だけ差しかえる。
  constructor(dims) {
    this.D = dims || OKD;
    this.bones = [];
    for (let i = 0; i < OK_NBONE; i++) this.bones.push(M4.ident());
    this.t = 0;
    this.walk = 0;        // 0..1 歩いている強さ
    this.walkPhase = 0;
    this.push = 0;        // 0..1 おしている強さ
    this.cheer = 0;       // 0..1 よろこび
    this.sad = 0;         // 0..1 がっくり（詰み）
    this.wave = 0;        // 0..1 手をふる（★上腕は上げず、ひじから先だけ振る。
                          //      このモデルは脇が閉じていて 上腕を上げると布が裂けるため）
    this.bow = 0;         // 0..1 おじぎ
    this.yaw = 0;
    this.pos = [0, 0, 0];
    this.scale = 1;   // 盤の上では すこし大きく見せる
  }

  update(dt) {
    this.t += dt;
    const D = this.D;
    const w = this.walk, p = this.push, c = this.cheer, s = this.sad;
    const wv = this.wave, bw = this.bow;
    this.walkPhase += dt * (7.2 + 2.4 * p) * w;
    const ph = this.walkPhase;
    const idle = Math.sin(this.t * 2.1) * 0.012;

    // よろこびのジャンプ
    const hop = c > 0 ? Math.abs(Math.sin(this.t * 8.0)) * 0.10 * c : 0;
    const bob = Math.abs(Math.sin(ph)) * 0.028 * w + idle + hop;
    const lean = p * 0.30 + w * 0.10 - s * 0.10 + bw * 0.55;

    const root = mul(T(this.pos[0], this.pos[1] + bob, this.pos[2]), Ry(this.yaw), Rx(lean), S(this.scale));
    this.bones[OK_BONE.ROOT] = root;

    const torso = mul(root, T(0, D.waist, 0),
                      Rz(Math.sin(ph) * 0.05 * w),
                      Rx(p * 0.10 + s * 0.22 + bw * 0.35));
    this.bones[OK_BONE.TORSO] = torso;

    const nod = -p * 0.12 + Math.sin(this.t * 1.7) * 0.02 - s * 0.30 + c * 0.18 + bw * 0.30;
    const head = mul(torso, T(0, D.torsoH - 0.02, 0), Rx(nod), Ry(Math.sin(this.t * 0.9) * 0.05 * (1 - w)));
    this.bones[OK_BONE.HEAD] = head;

    this.bones[OK_BONE.CHI] = mul(head, T(0, D.headR * 2.02, D.chiZ),
                                  Rz(Math.sin(this.t * 3.3) * 0.10),
                                  Ry(Math.sin(this.t * 1.3) * 0.3));

    // 腕：歩くと前後にふる。おすときは前へ出す。よろこぶと上げる
    for (const [bu, bf, sx] of [[OK_BONE.ALU, OK_BONE.ALF, 1], [OK_BONE.ARU, OK_BONE.ARF, -1]]) {
      const swing = Math.sin(ph + (sx > 0 ? Math.PI : 0)) * 0.55 * w;
      const fwd = -p * 1.28;
      const up = -c * 2.35 - (sx < 0 ? wv * 1.6 : 0);   // 手をふるのは 右手だけ
      // ★取りこんだモデルは腕が体に密着していて 脇に すきま が無い。大きくふると
      //   肩まわりの布が引き裂かれて黒い板になる（実測。よろこぶ134°・おす73°で出た）。
      //   手組みオカンは腕が独立した部品なので何度でも回せる。モデルごとに上限を持たせる。
      const lim = D.armSwingMax === undefined ? 99 : D.armSwingMax;
      const ax = Math.max(-lim, Math.min(lim, swing + fwd + up));
      const rot = mul(
        T(sx * D.shoulderX, D.shoulder + 0.008, D.armZ),
        Rz(sx * (-0.06 - p * 0.10 - c * 0.30 + s * 0.05)),
        Rx(ax),
      );
      this.bones[bu] = mul(torso, rot);
      let elbow = -0.18 - p * 0.30 + Math.max(0, Math.sin(ph + (sx > 0 ? Math.PI : 0))) * 0.25 * w - c * 0.5;
      // ★手をふる … ひじから先だけを 左右に。上腕を上げないので 布が裂けない
      if (wv > 0 && sx < 0) elbow -= wv * (1.15 + Math.sin(this.t * 11.0) * 0.45);
      this.bones[bf] = mul(this.bones[bu], T(0, -D.armU, 0), Rx(elbow));
    }

    // 足
    for (const [bl, sx] of [[OK_BONE.LL, 1], [OK_BONE.LR, -1]]) {
      const swing = Math.sin(ph + (sx > 0 ? 0 : Math.PI)) * 0.62 * w;
      this.bones[bl] = mul(root, T(sx * D.legX, D.hip, 0), Rx(swing - p * 0.16));
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
    // 同じ組み合わせが続くことが多いので、変わったときだけ逆行列を作り直す
    const key = b0 + '|' + w0 + '|' + b1;
    if (key !== lastKey) {
      for (let k = 0; k < 16; k++) {
        mix[k] = B[b0][k] * w0 + B[b1][k] * w1;
        mixN[k] = BN[b0][k] * w0 + BN[b1][k] * w1;
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
    bone,
    idx: okanB64(M.idx, M.idx32 ? Uint32Array : Uint16Array),
    count: M.count,
  };
}

