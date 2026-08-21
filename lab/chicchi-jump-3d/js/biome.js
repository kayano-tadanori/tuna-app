// ============================================================
// biome.js — 深宇宙の背景（どこを飛んでいるか）
//
//  ヘリオポーズから先は、もう惑星が出てこない。
//  そこで「どんな場所を通っているか」を空そのもので見せる。
//
//  ★大事なのは、同じ絵が二度続かないこと。
//    エンドレスの本当の敵は難しさではなく、飽きること。
//
//  しくみ
//    ① biome は「数字の集合」ひとつで表す（星の量・星雲の色・銀河の向き…）。
//       絵を描くのではなく数字を渡すので、あいだを混ぜられる。
//    ② 30,000 から先は「7種袋」で引く。袋が空になるまで同じものは出ない
//       ＝連続で同じ場所が出ることが、しくみとして起こらない。
//    ③ 出るたびに色あいを ±0.045 だけ回す。同じ星雲でも毎回ちがう色になる。
//       ★±0.12 は ±43度。「青い星雲(198°)」が緑(155°)になって名前と合わなくなった。
//       ★名前に色が入っているものは、そもそも振らない（hueLock）。
//    ④ 切りかわりは 250 progress かけて、2つの数字の集合を混ぜる
//       （絵を2枚描いて重ねるのではない。混ぜるのは数字のほう＝軽い）。
//    ⑤ 名前のついた場所（オリオン大星雲・天の川の中心…）は、袋の巡回に
//       割りこんで出す。行きあたりばったりの旅に、筋書きを1本通すため。
//
//  ここは描画を知らない。返すのは数字だけ。絵にするのは shaders.js。
// ============================================================
'use strict';

const CJ_BIOME_START = 30000;   // ここから先が袋の巡回
const CJ_BIOME_FADE  = 250;     // 切りかわりにかける progress（決まった道のり用の予備）

// 🚨 biome の長さは「何 progress」ではなく「**何秒もつか**」で決める。
//   深いところほど 1秒に進む progress が増える（ペース倍率が 1→24）。
//   progress で決め打ちすると、深宇宙では **1つ 1.7〜3.1 秒** しかもたない（実測）。
//   プランの「1,200〜2,200 progress」は、地上のペース（約25/秒）で
//   48〜88秒のつもりで書かれた数字。**その秒数のほうを守る。**
//   → tools/pace_check.js で測りなおせる
const CJ_BIOME_SEC_MIN  = 45;   // 1つの biome がもつ時間（秒）
const CJ_BIOME_SEC_MAX  = 80;
// ✉️ 手紙（＝観測できる宇宙のはて）までに、**用意した場所を全部1回ずつ通す**
//   （本人の指示 2026-08-21「盛り込んだ宇宙のギミックは全て体験できるように」）。
//   ★ここだけは短くする。11か所ぜんぶを 45秒ずつ通すと、それだけで8分以上かかる。
//     短いといっても、直す前（1.7〜3.1秒）とは桁がちがう。
// ★本人の判断「一つの表示時間を短くしたら？」。全部を通すほうを優先する。
//   18〜28秒。直す前（1.7〜3.1秒）とは桁がちがうので、コマ送りにはならない。
const CJ_FIRST_SEC_MIN  = 18;
const CJ_FIRST_SEC_MAX  = 28;
// これより短い切れはしは作らない（名前つきの場所の手前で余ったぶんは、そこへ足す）
const CJ_MIN_SEC        = 12;
const CJ_BIOME_FADE_SEC = 3.5;  // 切りかわりにかける時間（秒）
const CJ_EVENT_SEC      = 55;   // 名前のついた場所（オリオン等）にいる時間（秒）
// 1秒に何メートル登るか。★実測して合わせること（tools/pace_check.js）。
//   25 だと式が 600/秒 と見こむのに実測は 701/秒で、biome が狙いより 14% 短くなった。
const CJ_CLIMB_RAW_PER_SEC = 28;

// その地点で 1秒あたり progress がどれだけ進むか。
// ★CJ_PACE_TIERS / cjRawFromProgress は core.js にある。
//   読み込みは biome.js が先だが、**呼ばれるのは core の reset のあと**なので届く。
function cjProgressPerSec(progress) {
  const raw = cjRawFromProgress(progress);
  for (const [to, r] of CJ_PACE_TIERS) if (raw <= to) return CJ_CLIMB_RAW_PER_SEC * r;
  return CJ_CLIMB_RAW_PER_SEC * CJ_PACE_TIERS[CJ_PACE_TIERS.length - 1][1];
}

// ---------------- 数字の集合のひな型 ----------------
// 足りない項目はここから埋まる。新しい biome は差分だけ書けばいい。
const CJ_BIOME_BASE = {
  name: '',
  top: [0.016, 0.024, 0.059], bot: [0, 0, 0],
  skyMix: 1,                       // 空の地の色を、高度別の色からどれだけ置きかえるか
  starAmt: 1.0, starDense: 1.0, starCol: [0.92, 0.95, 1.00],
  bandAmt: 0,   bandCol: [0.74, 0.78, 0.96],   // 天の川の帯
  nebAmt: 0,    nebCol1: [1.00, 0.34, 0.62], nebCol2: [0.24, 0.52, 1.00],
  nebScale: 1.0, nebGain: 1.0,
  darkAmt: 0,                                  // 暗黒星雲（星を減らす）
  galAmt: 0, galCol: [1.00, 0.93, 0.80], galSize: 0.22, galKind: 0,
  galSquash: 0.42, galRoll: 0.6,
  beaconA: null, beaconB: null,                // {col, amt, size, hz, elev}
  lensAmt: 0, lensSize: 0.055,                 // ブラックホールの重力レンズ
  dustAmt: 0, dustCol: [0.55, 0.62, 0.85],     // 中景の塵（つぶで出す）
};

// ---------------- biome の定義 ----------------
// ★色を変えただけにしない。「何がそこにあるのか」を1つずつ決める。
const CJ_BIOME_DEFS = {
  // --- 30,000 までの決まった道のり ---
  quiet: {
    name: '', skyMix: 0, starAmt: 1.0,
  },
  heliopause: {
    fact: '太陽がふいた風は、ここで止まる。ここまでが 太陽の国。',
    mods: { foe: 0.15, brk: 0.5, ice: 0.5 },   // 見せ場の前の静けさ
    // 太陽の国のはて。にぎやかにしない。この静けさがボイジャーを立たせる。
    name: 'ヘリオポーズ', skyMix: 0.7,
    top: [0.016, 0.024, 0.059], bot: [0.030, 0.020, 0.008],
    starAmt: 1.05, bandAmt: 0.10,
    beaconA: { col: [1.00, 0.94, 0.72], amt: 0.85, size: 0.010, hz: 0, elev: -0.22 },
    dustAmt: 0.25, dustCol: [0.70, 0.74, 0.92],
  },
  interstellar: {
    fact: '太陽は、もう星のひとつ。まわりの星まで 何光年もある。',
    // 太陽が星のひとつに紛れる。かわりに天の川が見えはじめる。
    name: '星の海', top: [0.010, 0.014, 0.038], bot: [0.006, 0.008, 0.020],
    starAmt: 1.25, starDense: 1.1, bandAmt: 0.45,
    beaconA: { col: [1.00, 0.95, 0.80], amt: 0.30, size: 0.005, hz: 0, elev: -0.30 },
    dustAmt: 0.35,
  },
  oort: {
    fact: '氷のかたまりが ゆっくり漂う。彗星のふるさと。',
    mods: { ice: 1.7, foe: 0.7 },              // 氷の彗星核がただよう
    // オールトの雲。氷のかけらがゆっくり漂う。太陽は最後のひと粒。
    name: 'オールトの雲', top: [0.014, 0.020, 0.048], bot: [0.010, 0.014, 0.030],
    starAmt: 1.1, bandAmt: 0.35,
    nebAmt: 0.10, nebCol1: [0.40, 0.62, 0.95], nebCol2: [0.30, 0.46, 0.80], nebScale: 0.7,
    beaconA: { col: [1.00, 0.96, 0.86], amt: 0.16, size: 0.004, hz: 0, elev: -0.34 },
    dustAmt: 0.7, dustCol: [0.72, 0.86, 1.00],
  },

  // --- ここから袋に入る10種 ---
  milkyway: {
    fact: '星が2000億こ。円ばんの形にならんでいる。それが天の川。',
    name: '天の川', top: [0.020, 0.026, 0.062], bot: [0.008, 0.010, 0.026],
    starAmt: 1.35, starDense: 1.25, bandAmt: 1.0,
    dustAmt: 0.4,
  },
  emissionneb: {
    fact: '若い星の光をあびて、水素のガスが赤く光っている。',
    // 散光星雲。生まれたての星に照らされて、水素が赤く光っている。
    name: 'ピンクの星雲', top: [0.075, 0.022, 0.062], bot: [0.030, 0.006, 0.022],
    hueLock: true,
    starAmt: 0.95, bandAmt: 0.20,
    nebAmt: 0.95, nebCol1: [1.00, 0.30, 0.55], nebCol2: [0.30, 0.60, 1.00],
    nebScale: 1.15, nebGain: 1.15,
    dustAmt: 0.5, dustCol: [1.00, 0.62, 0.78],
  },
  comet: {
    fact: 'しっぽは、進む向きではなく、太陽と反対がわへのびる。',
    mods: { ice: 1.5, brk: 1.3 },              // 氷とちりのかけら
    // ☄️ 彗星の群れ。**空はわざと静かにする。**
    //   ここの主役は空ではなく、流れてくる彗星そのもの（scenery.js 側）。
    //   星雲をにぎやかにすると、しっぽが背景に埋もれて見えなくなる。
    name: '彗星の群れ', top: [0.012, 0.021, 0.044], bot: [0.006, 0.012, 0.028],
    hueLock: true,
    starAmt: 1.15, starDense: 1.0, bandAmt: 0.18,
    dustAmt: 0.34, dustCol: [0.74, 0.92, 1.00],
  },
  coldneb: {
    fact: '星の光が こまかいちりに当たって、青い色だけ散っている。',
    mods: { ice: 1.6 },                        // 冷たい星雲
    name: '青い星雲', top: [0.018, 0.048, 0.078], bot: [0.004, 0.020, 0.034],
    hueLock: true,
    starAmt: 1.0, bandAmt: 0.15,
    nebAmt: 0.60, nebCol1: [0.20, 0.72, 0.95], nebCol2: [0.42, 0.32, 0.90],
    nebScale: 0.85, nebGain: 1.0,
    dustAmt: 0.45, dustCol: [0.60, 0.90, 1.00],
  },
  darkneb: {
    fact: 'ちりが濃くて、うしろの星がかくれている。',
    mods: { foe: 0.5, move: 1.2 },             // 見えにくい。だから数を減らす
    // 暗黒星雲。光るのではなく、向こうの星をさえぎる雲。
    // ★暗くするのは空だけ。足場の明るさは変えない（見えなくなったら理不尽）。
    name: '暗黒星雲', top: [0.030, 0.020, 0.026], bot: [0.014, 0.008, 0.006],
    starAmt: 1.15, darkAmt: 0.95,
    nebAmt: 0.30, nebCol1: [0.42, 0.26, 0.20], nebCol2: [0.26, 0.20, 0.24],
    nebScale: 0.6, nebGain: 0.8,
    dustAmt: 0.3, dustCol: [0.50, 0.42, 0.40],
  },
  starforming: {
    fact: 'ガスがちぢんで、いま 星が生まれているところ。',
    mods: { brk: 1.5 },                        // 生まれたての岩。もろい
    // 星のゆりかご。ガスのなかで、いま星が生まれている。
    name: '星のゆりかご', top: [0.062, 0.034, 0.020], bot: [0.030, 0.012, 0.006],
    starAmt: 1.1, starDense: 1.3,
    // ★補色どうしを足すと彩度が消えて茶色になる。近い色相どうしにする。
    nebAmt: 0.85, nebCol1: [1.00, 0.56, 0.20], nebCol2: [0.95, 0.28, 0.42],
    nebScale: 1.3, nebGain: 1.2,
    beaconA: { col: [0.80, 0.92, 1.00], amt: 0.55, size: 0.008, hz: 0, elev: 0.16 },
    beaconB: { col: [1.00, 0.88, 0.72], amt: 0.40, size: 0.006, hz: 0, elev: 0.28 },
    dustAmt: 0.6, dustCol: [1.00, 0.78, 0.55],
  },
  binary: {
    fact: '星は ひとりでいるより、二つで回っていることが多い。',
    mods: { move: 1.4 },                       // ふたつの重力に引かれる
    // 二重星。太陽が2つある空。赤い星と青い星。
    name: 'ふたつの太陽', top: [0.040, 0.026, 0.052], bot: [0.024, 0.010, 0.014],
    starAmt: 0.9, bandAmt: 0.12,
    // ★点1つに身元をあずけない。横の画角は全周の11%しかないので、
    //   その点を見ていない89%のあいだ「ふつうの宇宙」になってしまう。
    nebAmt: 0.35, nebCol1: [1.00, 0.42, 0.30], nebCol2: [0.55, 0.72, 1.00], nebScale: 0.5,
    beaconA: { col: [1.00, 0.44, 0.30], amt: 1.20, size: 0.024, hz: 0, elev: 0.12 },
    beaconB: { col: [0.62, 0.80, 1.00], amt: 1.00, size: 0.016, hz: 0, elev: 0.26 },
    dustAmt: 0.35, dustCol: [1.00, 0.70, 0.62],
  },
  pulsar: {
    fact: '1秒に何回も回る星。灯台のように 光が回ってくる。',
    mods: { foe: 1.4 },                        // 灯台のビーム。にぎやか
    // パルサー。灯台のように、一定のリズムで光る。
    // ★明滅は 1.2Hz。子どもの目を守るため 2Hz を超えさせない。
    name: 'パルサー', top: [0.016, 0.030, 0.058], bot: [0.006, 0.014, 0.030],
    starAmt: 1.0, bandAmt: 0.55,
    nebAmt: 0.25, nebCol1: [0.45, 0.75, 1.00], nebCol2: [0.30, 0.50, 0.95], nebScale: 1.8,
    beaconA: { col: [0.78, 0.90, 1.00], amt: 1.45, size: 0.014, hz: 1.2, elev: 0.22 },
    dustAmt: 0.3, dustCol: [0.70, 0.86, 1.00],
  },
  globular: {
    fact: '10万この星が、ボールのかたちに集まっている。',
    mods: { foe: 1.3 },                        // 星が密集している
    // 球状星団。何十万もの星が、重さで玉の形に集まっている。
    name: '星の玉', top: [0.020, 0.020, 0.044], bot: [0.012, 0.010, 0.020],
    starAmt: 1.15, bandAmt: 0.20,
    galAmt: 1.0, galKind: 1, galCol: [1.00, 0.94, 0.76], galSize: 0.16, galSquash: 0.9,
    dustAmt: 0.35, dustCol: [1.00, 0.92, 0.74],
  },
  spiralgalaxy: {
    fact: 'うずの腕は、星が生まれる場所。',
    name: '渦巻銀河', top: [0.018, 0.020, 0.048], bot: [0.008, 0.008, 0.020],
    starAmt: 0.95,
    galAmt: 1.0, galKind: 0, galCol: [0.96, 0.92, 0.86], galSize: 0.26, galSquash: 0.38,
    dustAmt: 0.3,
  },
  blackhole: {
    fact: '重すぎて、光さえ 出られない。',
    mods: { move: 1.8, brk: 1.4 },             // 潮汐で足場がゆれる
    // ブラックホール。向こうがわの星の光が、まわりを曲がって届く。
    name: 'ブラックホール', top: [0.012, 0.014, 0.030], bot: [0.004, 0.004, 0.012],
    starAmt: 1.2, bandAmt: 0.30,
    lensAmt: 1.0, lensSize: 0.045,
    dustAmt: 0.5, dustCol: [1.00, 0.74, 0.44],
  },

  // --- 名前のついた場所（袋に割りこむ）---
  orion: {
    fact: '目でも見える星雲。1344光年（こうねん）先。',
    mods: { brk: 1.3 },                        // 星のゆりかご
    // オリオン大星雲。冬の夜、三ツ星の下に見えるあれ。
    name: 'オリオン大星雲', top: [0.085, 0.030, 0.070], bot: [0.036, 0.010, 0.028],
    starAmt: 1.0, starDense: 1.2, bandAmt: 0.35,
    nebAmt: 1.00, nebCol1: [1.00, 0.34, 0.48], nebCol2: [0.34, 0.72, 1.00],
    nebScale: 0.9, nebGain: 1.15,
    // トラペジウム（まん中で光る若い星の集まり）。ピンクの星雲との違いはここ。
    beaconA: { col: [0.86, 0.94, 1.00], amt: 0.70, size: 0.010, hz: 0, elev: 0.16 },
    beaconB: { col: [0.94, 0.98, 1.00], amt: 0.45, size: 0.007, hz: 0, elev: 0.21 },
    dustAmt: 0.7, dustCol: [1.00, 0.66, 0.80],
  },
  mwcenter: {
    fact: 'まん中には、太陽400万こぶんの ブラックホール。',
    mods: { foe: 1.5, move: 1.3 },             // 銀河の中心。いちばん荒い
    // 天の川の中心。星が濃い。まん中には巨大なブラックホール（いて座A*）。
    name: '天の川の中心', top: [0.060, 0.044, 0.028], bot: [0.055, 0.030, 0.012],
    starAmt: 1.5, starDense: 1.5, starCol: [1.00, 0.94, 0.82], bandAmt: 0.85,
    nebAmt: 0.45, nebCol1: [1.00, 0.62, 0.30], nebCol2: [0.95, 0.40, 0.34], nebScale: 1.6,
    galAmt: 0.6, galKind: 1, galCol: [1.00, 0.90, 0.66], galSize: 0.30, galSquash: 0.75,
    lensAmt: 0.55, lensSize: 0.030,
    dustAmt: 0.9, dustCol: [1.00, 0.84, 0.56],
  },
  mwedge: {
    fact: 'ここまでが、わたしたちの銀河。さしわたし10万光年。',
    // 天の川を出る。ふり返ると、いままでいた銀河が横一文字に見える。
    name: '天の川を出る', top: [0.014, 0.028, 0.052], bot: [0.004, 0.006, 0.016],
    starAmt: 0.75, starDense: 0.8, bandAmt: 0.9,
    galAmt: 1.15, galKind: 0, galCol: [0.98, 0.94, 0.84], galSize: 0.55, galSquash: 0.10,
    dustAmt: 0.2,
  },
  andromeda: {
    fact: '45億年後（おくねんご）、天の川とぶつかって ひとつになる。',
    mods: { foe: 0.4 },                        // ★手紙が出る場所。静かにする
    // アンドロメダ銀河。天の川のとなりの、うんと大きな渦。
    name: 'アンドロメダ銀河', top: [0.020, 0.024, 0.056], bot: [0.008, 0.010, 0.022],
    starAmt: 0.8,
    galAmt: 1.30, galKind: 0, galCol: [1.00, 0.96, 0.88], galSize: 0.62, galSquash: 0.30,
    dustAmt: 0.25,
  },
};

// 袋に入れる10種。ここに無いものは巡回に出ない。
const CJ_BIOME_POOL = [
  'milkyway', 'emissionneb', 'coldneb', 'darkneb', 'starforming',
  'binary', 'pulsar', 'globular', 'spiralgalaxy', 'blackhole', 'comet',
];

// 30,000 までの決まった道のり
const CJ_BIOME_FIXED = [
  { from: 0,     to: 13000, key: 'quiet' },
  { from: 13000, to: 15000, key: 'heliopause' },
  { from: 15000, to: 20000, key: 'interstellar' },
  { from: 20000, to: 30000, key: 'oort' },
];

// 名前のついた場所。CJ_ANCHORS の到達地点にそろえてある。
const CJ_BIOME_EVENTS = [
  { from: 55000, len: 2400, key: 'orion' },
  { from: 70000, len: 2600, key: 'mwcenter' },
  { from: 82000, len: 2400, key: 'mwedge' },
  { from: 92000, len: 3000, key: 'andromeda' },
];

// ---------------- 小物 ----------------
// 色あいだけを回す（明るさ・鮮やかさは変えない）。同じ星雲を毎回ちがう色にする。
function cjHueShift(rgb, d) {
  if (!d) return rgb.slice();
  const [r, g, b] = rgb;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn;
  let h = 0;
  if (df > 1e-6) {
    if (mx === r) h = ((g - b) / df) % 6;
    else if (mx === g) h = (b - r) / df + 2;
    else h = (r - g) / df + 4;
  }
  h = ((h / 6 + d) % 1 + 1) % 1;
  const s = mx <= 1e-6 ? 0 : df / mx, v = mx;
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

// 見上げ角と方位から向きベクトルへ
function cjDirOf(elev, azi) {
  const c = Math.cos(elev);
  return [Math.sin(azi) * c, Math.sin(elev), Math.cos(azi) * c];
}

// ---------------- 道のりの組み立て ----------------
// 決まった道のり → 袋の巡回（名前つきの場所が割りこむ）。
// 同じ種から作れば毎回同じ並びになる＝兄弟が同じ景色を見られる。
function cjBiomeTimeline(seed, upto) {
  const segs = CJ_BIOME_FIXED.map(s => ({
    from: s.from, to: s.to, key: s.key, hue: 0, seed: 0,
    fade: Math.max(CJ_BIOME_FADE, CJ_BIOME_FADE_SEC * cjProgressPerSec(s.to)),
  }));
  const rnd = mulberry32(((seed || 0) ^ 0x5bf03635) >>> 0);
  const limit = upto || 220000;

  // 7種袋。空になったら詰めなおしてシャッフルする。
  // ★詰めなおした1枚目が、前と同じだったら入れかえる。
  //   これをやらないと「袋の変わり目だけ連続する」という穴が残る。
  let bag = [];
  let last = CJ_BIOME_FIXED[CJ_BIOME_FIXED.length - 1].key;
  // ✉️ 手紙までに1回ずつ通す ぶんの列。ここが空になってから、ふつうの袋にうつる。
  //   ★これをやらないと、袋の引きしだいで**ブラックホールを一度も見ないまま**
  //     宇宙のはてに着いてしまう（本人の指摘）。
  const firstRound = CJ_BIOME_POOL.slice();
  for (let i = firstRound.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = firstRound[i]; firstRound[i] = firstRound[j]; firstRound[j] = t;
  }
  const draw = () => {
    if (firstRound.length) { last = firstRound.shift(); return last; }
    if (!bag.length) {
      bag = CJ_BIOME_POOL.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
      if (bag[bag.length - 1] === last && bag.length > 1) {
        const t = bag[bag.length - 1]; bag[bag.length - 1] = bag[0]; bag[0] = t;
      }
    }
    last = bag.pop();
    return last;
  };

  let p = CJ_BIOME_START, fi = 0;
  while (p < limit) {
    const ev = CJ_BIOME_EVENTS[fi];
    // ★名前つきの場所の手前に、ほんの少しだけ余ることがある。
    //   そこに切れはしの biome を置くと、数秒で切りかわって落ちつかない。
    //   余りが小さいときは、名前つきの場所を**そのぶん早く始める**。
    const nearGap = ev ? ev.from - p : Infinity;
    if (ev && nearGap < Math.max(500, CJ_MIN_SEC * cjProgressPerSec(p))) {
      // ★次の名前つきの場所を飲みこまないこと。
      //   名前つきは 15,000 progress おき（本物の距離にひもづくので動かせない）。
      //   その深さでは 15,000 = 約45秒しかないので、55秒のつもりで作ると
      //   オリオン大星雲が天の川の中心を丸ごと飲みこむ（実測で15件のNG）。
      const nextEv = CJ_BIOME_EVENTS[fi + 1];
      const cap = nextEv ? (nextEv.from - ev.from) - 200 : Infinity;
      const evLen = Math.min(CJ_EVENT_SEC * cjProgressPerSec(ev.from), cap);
      segs.push({ from: p, to: ev.from + evLen, key: ev.key, hue: 0, seed: rnd(),
                  fade: CJ_BIOME_FADE_SEC * cjProgressPerSec(ev.from) });
      p = ev.from + evLen; fi++; last = ev.key;
      continue;
    }
    const pps = cjProgressPerSec(p);
    const first = firstRound.length > 0;
    const sMin = first ? CJ_FIRST_SEC_MIN : CJ_BIOME_SEC_MIN;
    const sMax = first ? CJ_FIRST_SEC_MAX : CJ_BIOME_SEC_MAX;
    let len = (sMin + rnd() * (sMax - sMin)) * pps;
    // 🚨 **全部を1回ずつ通すことを、長さのほうで保証する。**
    //   秒数だけで決めていると、登る速さを変えたとたんに取りこぼす
    //   （実際、深部のペースを上げたら ブラックホールが出なくなった）。
    //   残りの場所ぜんぶが はてまでに収まるよう、1つあたりの持ち分で頭を打つ。
    if (first) {
      const evLeft = CJ_BIOME_EVENTS.slice(fi).reduce(
        (a2, e) => a2 + CJ_EVENT_SEC * cjProgressPerSec(e.from), 0);
      const room = (CJ_LETTER_P - p - evLeft) / firstRound.length;
      if (room > 0) len = Math.min(len, room);
      len = Math.max(len, CJ_MIN_SEC * pps);      // ただし短くしすぎない
    }
    if (ev && p + len > ev.from) len = ev.from - p;   // 名前つきの手前でぴったり終わる
    const key = draw();
    const lock = CJ_BIOME_DEFS[key] && CJ_BIOME_DEFS[key].hueLock;
    segs.push({ from: p, to: p + len, key, hue: lock ? 0 : (rnd() * 2 - 1) * 0.045, seed: rnd(),
                fade: CJ_BIOME_FADE_SEC * pps });
    p += len;
  }
  return segs;
}

// 区間ひとつぶんの数字の集合を作る（1回だけ作って区間に持たせる）
function cjSegParams(seg) {
  if (seg.params) return seg.params;
  const def = CJ_BIOME_DEFS[seg.key] || {};
  const o = {};
  for (const k in CJ_BIOME_BASE) {
    const v = def[k] !== undefined ? def[k] : CJ_BIOME_BASE[k];
    o[k] = Array.isArray(v) ? v.slice() : v;
  }
  // 色あいを振る。名前のついた場所は本物に寄せたいので振らない。
  if (seg.hue) {
    o.nebCol1 = cjHueShift(o.nebCol1, seg.hue);
    o.nebCol2 = cjHueShift(o.nebCol2, seg.hue * 0.7);
    o.galCol  = cjHueShift(o.galCol, seg.hue * 0.5);
    o.dustCol = cjHueShift(o.dustCol, seg.hue);
    o.top     = cjHueShift(o.top, seg.hue);
  }
  // 置き場所。空のどこにあるかは毎回ちがう（同じ星雲でも同じ絵にならない）。
  const r = mulberry32((Math.floor((seg.seed || 0.5) * 4294967295) ^ 0x9e3779b9) >>> 0);
  const azi = r() * Math.PI * 2;
  // 天の川の帯は「面の向き」で表す。ねかせすぎると帯が空全体を覆う。
  o.bandDir = cjDirOf(lerp(0.62, 1.35, r()), r() * Math.PI * 2);
  // ★見上げ角の上限に注意。カメラは 0.17 だけ見おろしていて、縦の画角は
  //   ±0.58 しかない。0.4 より上に置くと画面の外へ出て、二度と見られない。
  //   （実際、0.62 に置いて銀河が画面の左上に切れていた）
  o.galDir  = cjDirOf(lerp(0.00, 0.26, r()), azi);
  // ★見上げ角 0.05 はほぼ真横＝チッチと同じ高さ。0.24〜0.36 なら画面に残って、
  //   なおかつチッチより上に来る（画面でいちばん明るいのは、いつもチッチ）。
  o.lensDir = cjDirOf(lerp(0.24, 0.36, r()), azi + Math.PI * (0.6 + r() * 0.8));
  const put = (b, off) => b ? {
    col: b.col, amt: b.amt, size: b.size, hz: b.hz || 0,
    dir: cjDirOf(b.elev, azi + off),
  } : null;
  // ★2つめは1つめのすぐ横に置く。横の画角は 0.34rad しかないので、
  //   ばらばらに置くと「ふたつの太陽」なのに1つしか画面に入らない。
  const baseAzi = Math.PI * (0.25 + r() * 1.5);
  o.bA = put(o.beaconA, baseAzi);
  o.bB = put(o.beaconB, baseAzi + (r() < 0.5 ? -1 : 1) * (0.16 + r() * 0.10));
  o.key = seg.key;
  seg.params = o;
  return o;
}

// ---------------- いまの数字の集合 ----------------
// 区間の終わりぎわは、次の区間と混ぜる。
// ★混ぜるのは「数字」であって「絵」ではない。
//   背景を2枚描いて重ねると2倍重くなるが、数字なら1枚描くだけで済む。
const CJ_BLEND_NUM = ['skyMix', 'starAmt', 'starDense', 'bandAmt', 'nebAmt',
                      'nebScale', 'nebGain', 'darkAmt', 'galAmt', 'galSize',
                      'galSquash', 'galRoll', 'galKind', 'lensAmt', 'lensSize', 'dustAmt'];
const CJ_BLEND_COL = ['top', 'bot', 'starCol', 'bandCol', 'nebCol1', 'nebCol2', 'galCol', 'dustCol'];

// 向きは「強さで重みをつけて」混ぜる。
// 片方に銀河が無いとき、無いほうの向きに引っぱられないようにするため。
function cjMixDir(a, wa, b, wb, out) {
  const sa = wa + 1e-4, sb = wb + 1e-4;
  let x = a[0] * sa + b[0] * sb, y = a[1] * sa + b[1] * sb, z = a[2] * sa + b[2] * sb;
  const l = Math.hypot(x, y, z) || 1;
  out[0] = x / l; out[1] = y / l; out[2] = z / l;
  return out;
}

function cjMixBeacon(a, b, t, out) {
  const wa = a ? a.amt * (1 - t) : 0, wb = b ? b.amt * t : 0;
  out.amt = wa + wb;
  if (out.amt <= 0.001) { out.amt = 0; return out; }
  const k = wb / (wa + wb);
  const ca = a ? a.col : b.col, cb = b ? b.col : a.col;
  out.col[0] = lerp(ca[0], cb[0], k);
  out.col[1] = lerp(ca[1], cb[1], k);
  out.col[2] = lerp(ca[2], cb[2], k);
  out.size = lerp(a ? a.size : b.size, b ? b.size : a.size, k);
  // 明滅は混ぜない（混ぜると中途はんぱな速さになる）。強いほうに合わせる。
  out.hz = k >= 0.5 ? (b ? b.hz : 0) : (a ? a.hz : 0);
  cjMixDir(a ? a.dir : b.dir, wa, b ? b.dir : a.dir, wb, out.dir);
  return out;
}

// 使い回しの入れもの（毎フレーム作らない）
function cjBiomeOut() {
  const o = {};
  for (const k of CJ_BLEND_NUM) o[k] = 0;
  for (const k of CJ_BLEND_COL) o[k] = [0, 0, 0];
  o.bandDir = [0, 1, 0]; o.galDir = [0, 1, 0]; o.lensDir = [0, 1, 0];
  o.bA = { col: [0, 0, 0], amt: 0, size: 0.01, hz: 0, dir: [0, 1, 0] };
  o.bB = { col: [0, 0, 0], amt: 0, size: 0.01, hz: 0, dir: [0, 1, 0] };
  o.name = ''; o.key = 'quiet';
  return o;
}

function cjBiomeAt(tl, progress, out) {
  const o = out || cjBiomeOut();
  let i = 0;
  while (i < tl.length - 1 && progress >= tl[i].to) i++;
  const seg = tl[i];
  const a = cjSegParams(seg);
  const nxt = tl[i + 1];
  // 区間の終わりぎわだけ、次と混ぜる
  // 混ぜ幅も区間ごと。深いところは同じ 250 progress だと 0.3秒で切りかわってしまう。
  const fd = seg.fade || CJ_BIOME_FADE;
  const t = (nxt && progress > seg.to - fd)
    ? clamp((progress - (seg.to - fd)) / fd, 0, 1) : 0;
  const b = t > 0 ? cjSegParams(nxt) : a;

  for (const k of CJ_BLEND_NUM) o[k] = lerp(a[k], b[k], t);
  for (const k of CJ_BLEND_COL) {
    const x = a[k], y = b[k], z = o[k];
    z[0] = lerp(x[0], y[0], t); z[1] = lerp(x[1], y[1], t); z[2] = lerp(x[2], y[2], t);
  }
  cjMixDir(a.bandDir, a.bandAmt * (1 - t), b.bandDir, b.bandAmt * t, o.bandDir);
  cjMixDir(a.galDir,  a.galAmt  * (1 - t), b.galDir,  b.galAmt  * t, o.galDir);
  cjMixDir(a.lensDir, a.lensAmt * (1 - t), b.lensDir, b.lensAmt * t, o.lensDir);
  cjMixBeacon(a.bA, b.bA, t, o.bA);
  cjMixBeacon(a.bB, b.bB, t, o.bB);
  // 名まえは「いま濃いほう」を出す（混ざっている最中に名前が2つ出ない）
  const cur = t < 0.5 ? a : b;
  o.name = cur.name; o.key = cur.key;
  o.segIndex = t < 0.5 ? i : i + 1;
  return o;
}

// node からも使えるようにしておく（機械検査用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CJ_BIOME_DEFS, CJ_BIOME_POOL, CJ_BIOME_FIXED, CJ_BIOME_EVENTS,
    CJ_BIOME_START, CJ_BIOME_FADE,
    cjBiomeTimeline, cjBiomeAt, cjSegParams, cjHueShift, cjDirOf, cjBiomeOut,
  };
}
