// ============================================================
// core.js — ゲームのルール（描画のことは一切知らない層）
//
//  js/jump.js（チッチジャンプ2）の定数・確率・当たり判定を 1:1 で移植する。
//  変えるのは次の2点だけ。
//
//  ① 横方向が「平面のループ」から「円筒のまわり」になる
//     左右ドラッグ＝円周方向の移動。指の操作は元のまま（指の位置へ鳥が来る）で、
//     カメラが遅れて追いかけるので、はしへ寄せ続ければぐるっと一周できる。
//
//  ② 毎フレーム固定から dt秒ベースへ
//     ★これは必須。jump.js は deltaTime を一切使っておらず 60fps 前提で
//       `p.vy += J_GRAVITY` を1回足している。そのまま3Dへ持ってくると、
//       描画が重い端末でジャンプの高さが変わってしまう。
//       さらに可変dtだと足場をすり抜けるので、固定サブステップで積分する。
// ============================================================
'use strict';

// ---------------- 元の px 単位 → world 単位 ----------------
const J_W = 260, J_H = 420;                  // 元のキャンバス
const CJ_VIEW_W = 6.0;                       // 画面に映る横はば（world）
const S = CJ_VIEW_W / J_W;                   // px → world  ≒ 0.023077
const CJ_VIEW_H = J_H * S;                   // 画面に映る縦はば ≒ 9.69

// 円筒。1周は画面2.5枚ぶん。裏側がちゃんと隠れて「回りこむ」意味が出る。
const CJ_CIRC = CJ_VIEW_W * 2.5;             // 15.0
const CJ_RADIUS = CJ_CIRC / (2 * Math.PI);   // ≒ 2.387

// 1 world = 何メートルか。元は「10px = 1m」だった。
const CJ_M_PER_WORLD = 1 / (10 * S);         // ≒ 4.3333

// ---------------- 物理（元の px/frame から換算）----------------
// 速度   : px/frame × 60 × S = world/s
// 加速度 : px/frame² × 3600 × S = world/s²
const F2W_V = 60 * S;
const F2W_A = 3600 * S;

const CJ_GRAVITY   = 0.32 * F2W_A;   // ≒ 26.6  world/s²（下向き）
const CJ_JUMP_V    = 9.5  * F2W_V;   // ≒ 13.15 world/s（上向き＝正）
const CJ_SPRING_V  = 15.5 * F2W_V;   // ≒ 21.46
const CJ_ROCKET_V  = 17   * F2W_V;
const CJ_ROCKET_THRUST_V = 13 * F2W_V;
const CJ_WING_V    = 3    * F2W_V;
const CJ_ICE_DRIFT = 1.7  * F2W_V;
const CJ_KNOCK_VX  = 4.5  * F2W_V;
const CJ_KNOCK_VY  = 4    * F2W_V;
const CJ_KNOCK_FRICTION = 0.92;      // 1フレームあたり → dt で指数減衰にする
const CJ_STUN_MS   = 500;
const CJ_ROCKET_MS = 850;
const CJ_WING_MS   = 6000;
const CJ_BARRIER_MS = 6000;
const CJ_BREAK_FADE_MS = 260;

const CJ_PLAYER_W = 24 * S;          // ≒ 0.554
const CJ_PLAYER_H = 34 * S;          // ≒ 0.785
const CJ_PLAT_W     = 54 * S;        // ≒ 1.246
const CJ_PLAT_MIN_W = 30 * S;        // ≒ 0.692
const CJ_PLAT_H     = 12 * S;        // ≒ 0.277
const CJ_PLAT_SHRINK_SCORE = 300;
const CJ_LAND_TOL   = (12 + 8) * S;  // 元の「足場の高さ+8px」の着地の猶予
const CJ_GAP_MIN = 60 * S, CJ_GAP_MAX = 105 * S;
const CJ_PLAT_VX = 0.8 * F2W_V;

// カメラ：プレイヤーを画面の上から42%の高さに保つ（元の J_SCROLL_Y と同じ）
const CJ_SCROLL_FRAC = 0.42;

// 腕前の伸びしろ
const CJ_JUST_MS = 130;        // ジャストジャンプの受付（着地の前後）
const CJ_JUST_BOOST = 1.25;    // そのときの跳躍力
const CJ_DIVE_MUL = 1.85;      // 「たたむ」ときの落下の速さ
const CJ_SPRING_FROM_FALL = 1.30;  // バネ雲：落ちてきた速さをこの倍で返す

const CJ_HAWK_MIN_M = 15;
const CJ_HAWK_SPEED = 1.8 * F2W_V;
const CJ_HAWK_SIZE  = 26 * S;

// ---------------- 進行度・スコア ----------------
const CJ_GOAL_M = 3000;              // 月
const CJ_MARS_M = 5000;              // 火星
const CJ_BALLOON_M = 1000, CJ_SPACE_M = 1500;
const CJ_STATION_M = 2000, CJ_UFO_M = 2500, CJ_SHOOT_M = 2500;
const CJ_SCORE_TIERS = [[500,10],[1500,20],[2500,30],[3000,50],[CJ_MARS_M,100],[Infinity,150]];
const CJ_STAR_BASE = 300, CJ_STAR_COMBO_MS = 3000, CJ_STAR_COMBO_MAX = 5;
const CJ_MOON_BONUS = 50000, CJ_MARS_BONUS = 150000;
// ボイジャー1号を追いこす地点。1回きりの、いちばんの見せ場。
const CJ_VOYAGER_P = 15000;
const CJ_VOYAGER_BONUS = 300000;

// ============================================================
//  今日の宇宙天気
//   1日ごとに変わる。えらべない・すぐ始まる、が大事。
//   プレイ前に選ぶ画面を作ると、息抜きゲームの手ざわりが壊れる。
//   兄弟が同じ日に同じ条件で競えるよう、日付から決める。
// ============================================================
const CJ_WEATHER = [
  { key:'clear',   icon:'☀️', name:'すみわたった空',   desc:'ふつうの日',                 mods:{} },
  { key:'flare',   icon:'🌞', name:'太陽フレア',       desc:'⭐が2ばい',                  mods:{ star:2 } },
  { key:'lowg',    icon:'🌙', name:'無重力デー',       desc:'高く跳ぶけど よくすべる',     mods:{ gravity:0.82, jump:1.10, slip:1.9 } },
  { key:'wind',    icon:'💨', name:'追い風',           desc:'足場がみんな動く',            mods:{ moving:1.0, platVx:1.3 } },
  { key:'starry',  icon:'✨', name:'星ぞら',           desc:'⭐がたくさん出る',            mods:{ starRate:1.7 } },
  { key:'sea',     icon:'☁️', name:'雲海',             desc:'足場が広い',                  mods:{ width:1.25 } },
  { key:'springy', icon:'🟢', name:'ばね日和',         desc:'バネ雲がふえる',              mods:{ spring:2.6 } },
  { key:'frost',   icon:'🧊', name:'こおりの日',       desc:'氷雲がふえる。すべる',        mods:{ ice:2.2 } },
  { key:'heavy',   icon:'🪨', name:'おもい日',         desc:'重いぶん 点は1.3ばい',        mods:{ gravity:1.14, score:1.3 } },
  { key:'brittle', icon:'💥', name:'もろい雲',         desc:'こわれ雲がふえる',            mods:{ brk:2.2, star:1.4 } },
];

// その日の天気（日付から決める。兄弟で同じになる）
function cjTodayWeather(dayIndex) {
  const r = mulberry32(dayIndex * 2654435761 >>> 0);
  r(); r();
  return CJ_WEATHER[Math.floor(r() * CJ_WEATHER.length)];
}

function cjHeightScore(m) {
  let s = 0, prev = 0;
  for (const [to, rate] of CJ_SCORE_TIERS) {
    if (m <= prev) break;
    s += (Math.min(m, to) - prev) * rate;
    prev = to;
  }
  return Math.round(s);
}

// ============================================================
//  距離
//   進行度は2つある。混ぜないこと。
//     rawM     … 実際に登った量（m）。むずかしさはこちらで決める。
//     progress … 見た目の進み具合。宇宙では1mの重みが増える。
//                表示する距離・biome・マイルストーンはこちら。
//
//   ★実距離のインフレを難易度に直結させない。
//     AU や光年は演出のスケールにだけ使う。足場の密度・速さは rawM のまま。
//     ここを混ぜると、数字だけ跳ね上がって中身が同じ「作業」になる。
// ============================================================
// [ここまでの rawM, 1m あたり progress がいくつ増えるか]
// 宇宙では一跳びで進む距離がどんどん伸びる、という納得のさせ方で時間を圧縮する。
const CJ_PACE_TIERS = [
  [5000,     1],    // 火星まで：元とまったく同じ（1m = 1progress）
  [6800,     2],
  [8000,     3],
  [8900,     3.2],  // rawM 8,900 ＝ progress 15,000 ＝ ボイジャー（火星の約1.8倍の道のり）
  [11000,    5],
  [14000,    8],
  [20000,   12],
  [Infinity, 20],
];
function cjProgressFrom(rawM) {
  let p = 0, prev = 0;
  for (const [to, rate] of CJ_PACE_TIERS) {
    if (rawM <= prev) break;
    p += (Math.min(rawM, to) - prev) * rate;
    prev = to;
  }
  return p;
}

const AU_KM = 149597870.7;
const LY_KM = 9.4607304725808e12;
const LH_KM = AU_KM * 60 / 8.3167;      // 1光時間 ≒ 1.079e9 km
const LD_KM = LH_KM * 24;               // 1光日

// [progress, 実距離km, 名まえ]。全部きちんと増えていくので、
// あいだを対数で補間すれば「表示距離が減る」ことは数学的に起きない。
const CJ_ANCHORS = [
  [0,       0,             '地上'],
  // ★低いところは細かく刻む。ここが粗いと、街を1〜2回ジャンプしただけで
  //   高度1kmに達してしまい、ビル群のあいだを登る時間がなくなる。
  [150,     0.06,          'ビルの上'],
  [400,     0.5,           '雲の上'],
  [700,     5,             '富士山より高く'],
  [1000,    100,           'カーマンライン'],
  [2000,    400,           '宇宙ステーション'],
  [3000,    384400,        '月'],
  [5000,    7.8e7,         '火星'],
  [6500,    2.5 * AU_KM,   '小惑星帯'],
  [7500,    5.2 * AU_KM,   '木星'],
  [8500,    9.5 * AU_KM,   '土星'],
  [9500,    19.2 * AU_KM,  '天王星'],
  [10500,   30 * AU_KM,    '海王星'],
  [11500,   39 * AU_KM,    '冥王星'],
  [13000,   120 * AU_KM,   'ヘリオポーズ'],
  [15000,   168 * AU_KM,   'ボイジャー1号'],
  [20000,   2000 * AU_KM,  'オールトの雲'],
  [30000,   4.24 * LY_KM,  'プロキシマ・ケンタウリ'],
  [40000,   25 * LY_KM,    'ご近所の恒星'],
  [55000,   1344 * LY_KM,  'オリオン大星雲'],
  [70000,   26000 * LY_KM, '天の川の中心'],
  [85000,   100000 * LY_KM,'天の川を出る'],
  [100000,  2.5e6 * LY_KM, 'アンドロメダ銀河'],
];

function cjDistanceKm(p) {
  const A = CJ_ANCHORS;
  if (p <= 0) return 0;
  // ★0のあたりだけ線形。log(0) は扱えない。
  if (p < A[1][0]) return A[1][1] * p / A[1][0];
  for (let i = 1; i < A.length - 1; i++) {
    if (p <= A[i + 1][0]) {
      const t = (p - A[i][0]) / (A[i + 1][0] - A[i][0]);
      return Math.exp(Math.log(A[i][1]) + t * (Math.log(A[i + 1][1]) - Math.log(A[i][1])));
    }
  }
  const n = A.length - 1;   // 最後より先は、最後の勾配をそのまま伸ばす
  const slope = (Math.log(A[n][1]) - Math.log(A[n - 1][1])) / (A[n][0] - A[n - 1][0]);
  return Math.exp(Math.log(A[n][1]) + slope * (p - A[n][0]));
}

// 表示。単位は必ず小さい順に並べる。
//   m < km < 万km < AU < 光時間 < 光日 < 光年 < 万光年 < 億光年
// ★「AU → 光分」の順にしてはいけない。1光分(1,798万km) は 1AU(1億4,960万km) より
//   小さいので、切りかえた瞬間に数字が跳ね上がって直感に反する。
//   光分は主の単位に入れず、AU表示中の小さい注記として使う。
function cjFormatDistance(progress) {
  const km = cjDistanceKm(progress);
  const f1 = v => (Math.round(v * 10) / 10).toLocaleString('ja-JP');
  const f2 = v => (Math.round(v * 100) / 100).toLocaleString('ja-JP');
  if (km * 1000 < 1000)  return { tier:0, value: String(Math.floor(km * 1000)), unit:'m',    sub:'', km };
  if (km < 10000)        return { tier:1, value: f1(km),           unit:'km',   sub:'', km };
  if (km < AU_KM)        return { tier:2, value: Math.round(km / 10000).toLocaleString('ja-JP'), unit:'万km',
                                  sub: km > AU_KM * 0.02 ? `${f2(km / AU_KM)} AU` : '', km };
  if (km < 50 * AU_KM)   return { tier:3, value: f2(km / AU_KM),   unit:'AU',
                                  sub: `光で ${f1(km / (LH_KM / 60))} 分`, km };
  if (km < LD_KM)        return { tier:4, value: f1(km / LH_KM),   unit:'光時間',
                                  sub: `${Math.round(km / AU_KM).toLocaleString('ja-JP')} AU`, km };
  if (km < LY_KM)        return { tier:5, value: f2(km / LD_KM),   unit:'光日',  sub:'', km };
  if (km < 10000 * LY_KM)return { tier:6, value: f2(km / LY_KM),   unit:'光年',  sub:'', km };
  if (km < 1e8 * LY_KM)  return { tier:7, value: Math.round(km / LY_KM / 10000).toLocaleString('ja-JP'), unit:'万光年', sub:'', km };
  return { tier:8, value: Math.round(km / LY_KM / 1e8).toLocaleString('ja-JP'), unit:'億光年', sub:'', km };
}

// 単位が上がるときの注記（1回だけ出す）
const CJ_TIER_NOTE = {
  3: '1AU＝ 地球から太陽までのきょり',
  4: '光の速さで、これだけ時間がかかる',
  5: '光でも まる1日 かかるきょり',
  6: '1光年＝ 光が1年すすむきょり',
};

// ---------------- 円周のヘルパー ----------------
// 円周上の2点の「近いほうの差」。-CIRC/2 .. +CIRC/2 を返す。
function cjWrapDelta(a, b) {
  let d = (a - b) % CJ_CIRC;
  if (d > CJ_CIRC / 2) d -= CJ_CIRC;
  if (d < -CJ_CIRC / 2) d += CJ_CIRC;
  return d;
}
function cjWrap(x) { const v = x % CJ_CIRC; return v < 0 ? v + CJ_CIRC : v; }
// 円周上の位置 → 角度（ラジアン）
const cjAngle = px => (px / CJ_CIRC) * Math.PI * 2;

// ============================================================
//  ゲーム本体
// ============================================================
class ChicchiCore {
  constructor(seed, dayIndex) {
    this.rnd = mulberry32(seed || 12345);
    this.weather = cjTodayWeather(dayIndex === undefined ? 0 : dayIndex);
    this.reset();
  }
  // 天気の効果を引く。無い項目は 1（＝そのまま）
  w(key) { const v = this.weather.mods[key]; return v === undefined ? 1 : v; }

  reset() {
    // px = 円周にそった位置、y = 高さ（上が正）
    this.player = { px: 0, y: 0, vy: 0, vx: 0 };
    this.camPx = 0;
    this.camY = 0;
    this.platforms = [];
    this.coins = [];
    this.hawk = null;
    this.hawkCooldown = 3.0;          // 秒
    this.stunUntil = 0;
    this.spawnY = 0;                  // 次に足場を生やす高さ
    this.climb = 0;                   // 登った累計（world）
    this.meters = 0;
    this.score = 0;
    this.starScore = 0; this.bonusScore = 0;
    this.starsCollected = 0; this.starCombo = 0; this.lastStarAt = -99999;
    this.moonCleared = false; this.marsCleared = false;
    this.nextMilestone = 100;
    this.rawM = 0; this.progress = 0;
    this.distTier = 0; this.dist = cjFormatDistance(0);
    this.nextAnchor = 0; this.reached = [];
    this.voyagerNear = false; this.voyagerDone = false;
    this.over = false;
    this.time = 0;
    this.wingUntil = 0; this.rocketUntil = 0; this.barrierUntil = 0;

    // --- 腕前の伸びしろ ---
    // ジャストジャンプ：着地の前後 130ms に指を置きなおすと跳躍力が上がる。
    //   外してもふつうのジャンプになるだけ（罰は無い）。
    //   だから下手な人には「見えない機能」、上手い人には主戦力になる。
    this.lastTapAt = -9999;
    this.lastLandAt = -9999;
    this.justJumpUsed = true;
    this.justJumpCount = 0;
    // たたむ：指を離すと急降下する。「登らない勇気」を持てるかどうか。
    this.diving = false;
    this.landSpeed = 0;          // 直前の着地の速さ（バネの威力に使う）
    // 直前に起きたできごと。描画・音・演出はこれを見る（core は描画を知らない）
    this.events = [];

    // 足場は円周のどこにでも出すのではなく、前の足場の近くへつないでいく。
    // ★これが無いと、次の足場の6割がタワーの裏側に出て届かない。
    //   近くへつなぐことで「らせん状に登る道」になり、回りこむ意味も出る。
    //
    // 道は2本ある。
    //   A（安全）… ふつうの雲が多め。得点はひかえめ。
    //   B（危険）… タワーの反対がわ。こわれ雲・氷雲が多く、⭐がよく出る。
    // 同じ高さに2つ足場があることで、はじめて「円筒のまわりに並んでいる」
    // ことが目に見える。1本道だと、どれだけ画角を広げても平らに見えてしまう。
    this.pathA = 0;
    this.pathB = CJ_CIRC / 2;

    // 画面の下のほうから始める。下にも足場を敷いて、しくじっても
    // すぐ落ちきらないようにする。
    this.player.y = CJ_VIEW_H * 0.22;
    this.platforms.push({
      px: 0, y: this.player.y - 0.55, w: CJ_PLAT_W, type: 'normal',
      used: false, breakAt: 0, seed: this.rnd(), vx: 0,
    });
    this.spawnY = 0.35;
    while (this.spawnY < CJ_VIEW_H * 1.4) {
      this.genPlatformAt(this.spawnY);
      this.spawnY += this.randGap();
    }
  }

  emit(type, data) { this.events.push(Object.assign({ type }, data || {})); }

  randGap() { return CJ_GAP_MIN + this.rnd() * (CJ_GAP_MAX - CJ_GAP_MIN); }

  platformWidth(m) {
    const t = Math.min(m / CJ_PLAT_SHRINK_SCORE, 1);
    return CJ_PLAT_W - t * (CJ_PLAT_W - CJ_PLAT_MIN_W);
  }

  // 足場の抽選。確率は jump.js の jGenPlatformAt と同じ。
  // ★元のコメントにある不具合（こわれ雲の条件が重なってバネ雲が出なくなる）は
  //   修正ずみの「取り分を足し上げる」形をそのまま引き継ぐ。
  genPlatformAt(y) {
    // 前の足場から、画面の横はば ±45% の範囲でつなぐ。
    // 空中で指を動かせば必ず届く幅にしてある。
    this.pathA = cjWrap(this.pathA + (this.rnd() - 0.5) * CJ_VIEW_W * 0.9);
    this.pathB = cjWrap(this.pathB + (this.rnd() - 0.5) * CJ_VIEW_W * 0.9);
    // 2本の道が寄ってしまわないよう、反対がわへ静かに引きもどす
    const want = cjWrap(this.pathA + CJ_CIRC / 2);
    this.pathB = cjWrap(this.pathB + cjWrapDelta(want, this.pathB) * 0.12);

    this.pushPlatform(this.pathA, y, false);
    // 危険ルートは高さを半分ずらして置く（同じ高さだと選ぶ間がない）
    this.pushPlatform(this.pathB, y + this.randGap() * 0.5, true);
  }

  // risky = 危険ルート。こわれ雲・氷雲が多く、足場もせまい。そのぶん⭐がよく出る。
  pushPlatform(px, y, risky) {
    // ★難しさは rawM（実際に登った量）で決める。progress を使うと、
    //   深宇宙で数字が伸びるのに合わせて足場まで理不尽になる。
    const m = this.rawM;
    const w = this.platformWidth(m) * (risky ? 0.86 : 1) * this.w('width');

    let type = 'normal';
    const r = this.rnd();
    const pIce    = (m > 45 ? 0.13 : 0) * (risky ? 1.9 : 1) * this.w('ice');
    const pBreak  = (m > 28 ? 0.13 : 0) * (risky ? 1.9 : 1) * this.w('brk');
    const pSpring = (m > 10 ? 0.10 : 0.07) * this.w('spring');
    if (r < pIce) type = 'ice';
    else if (r < pIce + pBreak) type = 'break';
    else if (r < pIce + pBreak + pSpring) type = 'spring';

    // 動く足場はふつうの雲だけ（特殊足場は止めておく：難しすぎ防止）
    const pMove = this.weather.mods.moving !== undefined ? this.weather.mods.moving : 0.3;
    const moving = type === 'normal' && m > 20 && this.rnd() < pMove;
    this.platforms.push({
      px, y, w, type, risky, used: false, breakAt: 0, seed: this.rnd(),
      vx: moving ? (this.rnd() < 0.5 ? 1 : -1) * CJ_PLAT_VX * this.w('platVx') : 0,
    });

    const ir = this.rnd();
    const pStar = (risky ? 0.62 : 0.28) * this.w('starRate');
    if (ir < 0.05)       this.coins.push({ px, y: y + 16 * S, taken: false, kind: 'onigiri' });
    else if (ir < pStar) this.coins.push({ px, y: y + 16 * S, taken: false, kind: 'star' });
  }

  // 指の位置 → 円周上の目標位置。元の「指の位置へ鳥が来る」操作をそのまま保つ。
  // 画面のはしへ寄せ続けるとカメラが追ってくるので、ぐるっと一周できる。
  setTargetFromScreen(fracX) {
    if (this.time * 1000 < this.stunUntil) return;   // 吹っ飛ばされている間は操作不能
    this.player.px = cjWrap(this.camPx + (clamp(fracX, 0, 1) - 0.5) * CJ_VIEW_W);
  }

  // 指を置いた（＝ジャストジャンプの判定）
  tap() {
    const now = this.time * 1000;
    this.lastTapAt = now;
    this.diving = false;
    // 着地の「あと」に置きなおした場合。まだ上りはじめなら、ここで上乗せする。
    if (!this.justJumpUsed && now - this.lastLandAt <= CJ_JUST_MS && this.player.vy > 0) {
      this.justJumpUsed = true;
      this.player.vy *= CJ_JUST_BOOST;
      this.justJumpCount++;
      this.emit('just', { n: this.justJumpCount });
    }
  }

  // 指を離した（＝たたむ）
  release() { this.diving = true; }

  useItem(kind) {
    const now = this.time * 1000;
    if (kind === 'rocket') {
      this.rocketUntil = now + CJ_ROCKET_MS;
      this.player.vy = CJ_ROCKET_V;
      this.emit('rocket');
    } else if (kind === 'wing') {
      this.wingUntil = now + CJ_WING_MS;
      this.emit('wing');
    }
  }

  // ---------------- 1フレーム ----------------
  // ★可変 dt をそのまま積分すると、足場（高さ0.28）を1フレームで飛びこえて
  //   すり抜ける。必ず 1/120 秒以下に刻んでから積分する。
  step(dt) {
    this.events.length = 0;
    if (this.over) return;
    dt = Math.min(dt, 0.1);
    const SUB = 1 / 120;
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(SUB, left);
      this.substep(h);
      left -= h;
      if (this.over) break;
    }
    this.updateInfo();
  }

  substep(dt) {
    this.time += dt;
    const now = this.time * 1000;
    const p = this.player;
    const wingOn = now < this.wingUntil;
    const barrierOn = now < this.barrierUntil;
    const rocketOn = now < this.rocketUntil;

    // --- 上下 ---
    if (wingOn) {
      p.vy = CJ_WING_V;
    } else if (rocketOn) {
      p.vy = CJ_ROCKET_THRUST_V;      // 噴射中は落下中でも強制的に上へ
    } else {
      // たたむ（指を離す）と落下が速くなる。上りには効かせない＝
      // 「下がるのを早める」だけの技にして、ズルにならないようにする。
      const dive = (this.diving && p.vy < 0) ? CJ_DIVE_MUL : 1;
      p.vy -= CJ_GRAVITY * this.w('gravity') * dive * dt;
      if (p.vy < 0) this.checkLanding(now);
    }
    p.y += p.vy * dt;

    // --- ノックバックの横すべり ---
    if (p.vx) {
      p.px = cjWrap(p.px + p.vx * dt);
      // 元は毎フレーム ×0.92。dt ベースでは同じ減り方になる指数で書く。
      p.vx *= Math.pow(CJ_KNOCK_FRICTION, dt * 60);
      if (Math.abs(p.vx) < 0.1) p.vx = 0;
    }

    // --- 動く足場（円周なので端で跳ね返らず、そのまま回りつづける）---
    for (const plat of this.platforms) {
      if (plat.vx) plat.px = cjWrap(plat.px + plat.vx * dt);
    }

    this.checkCoins(now);
    this.updateHawk(dt, now, wingOn, barrierOn);

    // --- カメラ ---
    // 縦：プレイヤーが画面の上から42%より上へ行ったら、そのぶん世界を下げる
    const topY = this.camY + CJ_VIEW_H * (1 - CJ_SCROLL_FRAC);
    if (p.y > topY) {
      const dy = p.y - topY;
      this.camY += dy;
      this.climb += dy;
    }
    // 横：中央から少し離れたぶんだけ、ゆっくり回りこむ。
    // 遊びを持たせないと、少し動かすたびに景色が回って酔う。
    const d = cjWrapDelta(p.px, this.camPx);
    const dead = CJ_VIEW_W * 0.16;
    if (Math.abs(d) > dead) {
      const over = d - Math.sign(d) * dead;
      this.camPx = cjWrap(this.camPx + over * Math.min(1, dt * 3));
    }

    // --- 落ちたら終わり（画面の下のふちを割ったら）---
    if (p.y < this.camY - CJ_PLAYER_H) {
      this.over = true;
      this.emit('gameover');
      return;
    }

    // --- 足場の掃除と生成 ---
    const bottom = this.camY - CJ_VIEW_H * 0.2;
    this.platforms = this.platforms.filter(pl =>
      pl.y > bottom && !(pl.used && now - pl.breakAt > CJ_BREAK_FADE_MS));
    this.coins = this.coins.filter(c => !c.taken && c.y > bottom);
    const top = this.camY + CJ_VIEW_H * 1.4;
    while (this.spawnY < top) {
      this.genPlatformAt(this.spawnY);
      this.spawnY += this.randGap();
    }
  }

  // 落下中だけ、足場の上面に足がかかったかを見る（元の AABB そのまま）
  checkLanding(now) {
    const p = this.player;
    const footY = p.y;                       // 足の高さ（p.y が足元）
    for (const plat of this.platforms) {
      if (plat.used) continue;               // こわれ雲は一度きり
      const dx = Math.abs(cjWrapDelta(p.px, plat.px));
      if (dx > (CJ_PLAYER_W + plat.w) / 2) continue;
      if (footY <= plat.y + CJ_PLAT_H && footY >= plat.y - CJ_LAND_TOL + CJ_PLAT_H) {
        const fall = Math.abs(p.vy);
        const impact = Math.min(fall / CJ_SPRING_V, 1);
        this.landSpeed = fall;
        const jump = CJ_JUMP_V * this.w('jump');

        if (plat.type === 'spring') {
          // ★落ちてきた速さがそのままバネの威力になる。
          //   「たたむ」でわざと加速してから踏むと、ふつうの倍近く飛ぶ＝上級の技。
          p.vy = clamp(fall * CJ_SPRING_FROM_FALL, CJ_SPRING_V, CJ_SPRING_V * 1.75);
          this.emit('land', { kind: 'spring', px: plat.px, y: plat.y, impact: 1 });
        } else if (plat.type === 'break') {
          p.vy = jump; plat.used = true; plat.breakAt = now;
          this.emit('land', { kind: 'break', px: plat.px, y: plat.y, impact });
        } else if (plat.type === 'ice') {
          p.vy = jump;
          p.vx = (this.rnd() < 0.5 ? -1 : 1) * CJ_ICE_DRIFT * this.w('slip');
          this.emit('land', { kind: 'ice', px: plat.px, y: plat.y, impact });
        } else {
          p.vy = jump;
          this.emit('land', { kind: 'normal', px: plat.px, y: plat.y, impact });
        }

        // --- ジャストジャンプ：着地の「前」に置きなおしていたら、ここで上乗せ ---
        this.lastLandAt = now;
        if (now - this.lastTapAt <= CJ_JUST_MS) {
          this.justJumpUsed = true;
          p.vy *= CJ_JUST_BOOST;
          this.justJumpCount++;
          this.emit('just', { n: this.justJumpCount, px: plat.px, y: plat.y });
        } else {
          this.justJumpUsed = false;   // 着地の「あと」の受付をひらく
        }
        return;
      }
    }
  }

  checkCoins(now) {
    const p = this.player;
    const R = 9 * S;
    for (const c of this.coins) {
      if (c.taken) continue;
      const dx = Math.abs(cjWrapDelta(p.px, c.px));
      if (dx > CJ_PLAYER_W / 2 + R) continue;
      if (p.y > c.y + R || p.y + CJ_PLAYER_H < c.y - R) continue;
      c.taken = true;
      if (c.kind === 'onigiri') {
        this.barrierUntil = now + CJ_BARRIER_MS;
        this.emit('onigiri', { px: c.px, y: c.y });
      } else {
        // ⭐は高さを水増しせず独立した得点にする（高さを足すとゴール判定がずれる）
        this.starCombo = (now - this.lastStarAt <= CJ_STAR_COMBO_MS)
          ? Math.min(this.starCombo + 1, CJ_STAR_COMBO_MAX) : 1;
        this.lastStarAt = now;
        const gained = Math.round(CJ_STAR_BASE * this.starCombo * this.w('star'));
        this.starScore += gained;
        this.starsCollected++;
        this.emit('star', { px: c.px, y: c.y, combo: this.starCombo, gained });
      }
    }
  }

  updateHawk(dt, now, wingOn, barrierOn) {
    const p = this.player;
    if (this.hawk) {
      const h = this.hawk;
      h.px = cjWrap(h.px + h.dir * CJ_HAWK_SPEED * dt);
      h.traveled += CJ_HAWK_SPEED * dt;
      const dx = Math.abs(cjWrapDelta(p.px, h.px));
      const hit = dx < (CJ_PLAYER_W + CJ_HAWK_SIZE) / 2 &&
                  p.y < h.y + CJ_HAWK_SIZE / 2 && p.y + CJ_PLAYER_H > h.y - CJ_HAWK_SIZE / 2;
      if (hit && (wingOn || barrierOn)) {
        this.emit('repel', { px: h.px, y: h.y });
        this.hawk = null;
        this.hawkCooldown = 3.0 + this.rnd() * 2.5;
      } else if (hit) {
        this.emit('hurt', { px: h.px, y: h.y });
        this.hawk = null;
        p.vx = -h.dir * CJ_KNOCK_VX;
        p.vy = CJ_KNOCK_VY;
        this.stunUntil = now + CJ_STUN_MS;
        this.hawkCooldown = 2.5 + this.rnd() * 2.5;
      } else if (h.traveled > CJ_CIRC * 0.75) {
        this.hawk = null;
        this.hawkCooldown = 3.3 + this.rnd() * 3.3;
      }
    } else if (this.rawM >= CJ_HAWK_MIN_M && this.rawM < CJ_SHOOT_M) {
      this.hawkCooldown -= dt;
      if (this.hawkCooldown <= 0) {
        const dir = this.rnd() < 0.5 ? 1 : -1;
        // 画面のそとから入ってくるように、カメラの反対がわに置く
        this.hawk = {
          px: cjWrap(this.camPx - dir * CJ_VIEW_W * 0.62),
          y: this.camY + CJ_VIEW_H * (0.25 + this.rnd() * 0.5),
          dir, traveled: 0,
        };
        this.emit('hawkWarn', { m: this.progress });
      }
    }
  }

  updateInfo() {
    this.rawM = this.climb * CJ_M_PER_WORLD;       // むずかしさはこちら
    this.progress = cjProgressFrom(this.rawM);      // 見た目・距離はこちら
    this.meters = Math.floor(this.progress);
    // 合計点＝高さ点＋⭐点＋到達ボーナス。ボーナスは加算ずみなので、
    // 先で落ちても消えない（だから安心して先へ挑戦できる）
    this.score = Math.round(cjHeightScore(this.progress) * this.w('score'))
               + this.starScore + this.bonusScore;

    // --- 表示の単位が上がった瞬間 ---
    const d = cjFormatDistance(this.progress);
    this.dist = d;
    if (d.tier > this.distTier) {
      this.distTier = d.tier;
      this.emit('unitUp', { tier: d.tier, unit: d.unit, note: CJ_TIER_NOTE[d.tier] || '' });
    }

    // --- マイルストーン ---
    // 50mごとの機械的なものはやめて、意味のある地点だけにする。
    // どの到達にも名まえと意味が宿るようにしたい。
    while (this.nextAnchor < CJ_ANCHORS.length &&
           this.progress >= CJ_ANCHORS[this.nextAnchor][0]) {
      const a = CJ_ANCHORS[this.nextAnchor];
      this.nextAnchor++;
      if (a[0] === 0) continue;
      this.reached.push(a[2]);
      const bonus = a[0] >= 15000 ? 50000 : a[0] >= 6500 ? 20000 : 0;
      if (bonus) this.bonusScore += bonus;
      this.emit('anchor', { name: a[2], progress: a[0], bonus });
    }
    // 低いところは、こまかく応援したいので 100 ごとにも出す
    if (this.progress < 3000 && this.progress >= this.nextMilestone) {
      this.emit('milestone', { m: this.nextMilestone });
      this.nextMilestone += 100;
    }

    if (!this.moonCleared && this.progress >= CJ_GOAL_M) {
      this.moonCleared = true;
      this.bonusScore += CJ_MOON_BONUS;
      this.emit('moon');
    }
    if (!this.marsCleared && this.progress >= CJ_MARS_M) {
      this.marsCleared = true;
      this.bonusScore += CJ_MARS_BONUS;
      this.emit('mars');
    }
    // --- ボイジャー1号（1回きりの見せ場）---
    // 手前から予告し、しばらく並走してから追いこす。
    // すれちがいは一瞬でも、並走は記憶に残る。
    if (!this.voyagerDone) {
      const p = this.progress;
      if (!this.voyagerNear && p >= CJ_VOYAGER_P - 900) {
        this.voyagerNear = true;
        this.emit('voyagerNear');
      }
      if (p >= CJ_VOYAGER_P) {
        this.voyagerDone = true;
        this.bonusScore += CJ_VOYAGER_BONUS;
        this.emit('voyager');
      }
    }
  }
}
