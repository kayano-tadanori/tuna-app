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

// ---------------- はじまりの公園 ----------------
// チッチは空から始まらない。近所の公園の、バネの遊具の上に立っている。
// ベンチのラジオからボイジャー1号の声が聞こえて、返事をしに飛び出す。
const CJ_PARK_TOP  = 0.95;                 // 乗る面の高さ（world）
const CJ_PARK_CAMY = CJ_PARK_TOP - 5.45;   // 公園を見ているときのカメラ
const CJ_LAUNCH_V  = 15.5 * F2W_V * 1.06;  // ズギューンの初速（バネ雲より少し強い）
const CJ_FIRST_PLAT_Y = 5.2;               // 打ち上げのあと、最初に降りる雲

// ✉️ 父からの手紙を出す場所（プラン §5.6）。ここを変えるときは、
//    「その子が自分の指で辿り着けるか」を必ず時間で確かめる。
// ✉️ 父から息子への手紙は、**行けるいちばん遠いところ**で1回だけ。
//   ★アンドロメダ（250万光年）から「観測できる宇宙のはて（465億光年）」へ移した
//     （本人の指示 2026-08-21）。ここは**光がまだ届いていない**ので、
//     これより遠くは だれにも見えない。手紙を置くのに、ここ以上の場所はない。
const CJ_LETTER_AT = '観測できる宇宙のはて';
const CJ_LETTER_P  = 190000;

// 🛑 ヘリオポーズ。ここが物語の分水嶺（プラン §5.3）
const CJ_HELIO_P = 13000;

// 🔇 完全な無音にする3か所（progress, 秒）
const CJ_SILENCE_AT = [[1000, 2.4], [13000, 3.0], [15040, 2.6]];

const CJ_HAWK_MIN_M = 15;
const CJ_HAWK_SPEED = 1.8 * F2W_V;
const CJ_HAWK_SIZE  = 26 * S;

// ---------------- 進行度・スコア ----------------
const CJ_GOAL_M = 3000;              // 月
const CJ_MARS_M = 5000;              // 火星
const CJ_BALLOON_M = 1000, CJ_SPACE_M = 1500;
const CJ_STATION_M = 2000, CJ_UFO_M = 2500, CJ_SHOOT_M = 2500;
// ★桁で驚かせない。距離のほうが本物の数字なので、点は「競うのに要るだけ」でいい。
//   もとの表だと深宇宙で1,500万点まで行き、8桁になって読めなくなっていた。
const CJ_SCORE_TIERS = [[500,10],[1500,20],[2500,30],[3000,50],[CJ_MARS_M,80],[Infinity,40]];
const CJ_STAR_BASE = 300, CJ_STAR_COMBO_MS = 3000, CJ_STAR_COMBO_MAX = 5;
const CJ_BREAK_KICK = 1.15;    // 💥 こわれ雲の反動（プラン §3.2）
// ---------------- 難易度のつまみ（プラン §3.5）----------------
// ★上げるのはゆっくり、下げるのは すぐ。子ども向けは、寛容がわに非対称にする。
//   動かすのは「操作精度（足場のはば・間かく）」だけ。実距離のインフレとは切りはなす。
const CJ_DIFF_UP   = 0.055;    // 着地1回ごとに、じわっと上げる
const CJ_DIFF_DOWN = 0.55;     // ひやっとしたら、その場でどんと下げる

// ---------------- 🌈 レリック（プラン §3.4）----------------
//  そのラン限り。最大3つ。効果は3〜4語で言いきる（説明文を読ませない）。
//  ★強さは「勉強で買う道具」の側に置き、ここには置かない。
//    レリックは**そのランの遊び方が変わる**もので、育成ではない。
const CJ_RELICS = [
  { key: 'star2',     icon: '⭐', name: '⭐が2ばい' },
  { key: 'wide',      icon: '☁️', name: '足場が広い' },
  { key: 'ice2spring',icon: '🧊', name: '氷雲がバネになる' },
  { key: 'noFoe',     icon: '🕊', name: 'じゃま役が来ない' },
  { key: 'dive',      icon: '⬇️', name: 'たたむと 速い' },
  { key: 'softBreak', icon: '💪', name: 'こわれ雲がこわれない' },
];
// 🚩 途中から始められる場所（プラン §5.4）
//   ★一度でも自分の足で着いた場所からだけ。**強くはならない**ので §3.8 に触れない。
//     これが無いと、ボイジャーも深宇宙も手紙も「17分ノーミス」の向こう側になり、
//     いちばん時間をかけたところを、子どもが一生見られない。
const CJ_START_POINTS = [
  { p: 0,     icon: '🌳', name: '公園から',     stamp: null },
  { p: 3000,  icon: '🌙', name: '月から',       stamp: '月' },
  { p: 5000,  icon: '🔴', name: '火星から',     stamp: '火星' },
  { p: 15000, icon: '🛰', name: 'ボイジャーから', stamp: 'ボイジャー1号' },
];

const CJ_PILLAR_FROM = 3400;    // ここから出はじめる（月のあと。それより手前だと月のごほうび中に重なる）
const CJ_PILLAR_GAP  = 1500;    // つぎの柱までの進行度
const CJ_RELIC_MAX   = 3;
const CJ_SKATE_BASE = 250;     // ⛸ 氷を乗りついだときの点
const CJ_MOON_BONUS = 50000, CJ_MARS_BONUS = 150000;
// ボイジャー1号を追いこす地点。1回きりの、いちばんの見せ場。
const CJ_VOYAGER_P = 15000;
// ボイジャーと並走する幅。★game.js にも同じ数字を置かないこと（ずれると
//   「絵は並走しているのにタカが飛んでくる」が起きる）。ここを唯一の出どころにする。
const CJ_VOY_SPAN = 450;
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
// ★実測：ミスなしで登る速さは約 17.5 rawM/秒。
//   もとの表だとボイジャー（progress 15,000）は rawM 8,900＝**8分半**、
//   深宇宙の巡回は11分、手紙は17分。3〜10分の息抜きの外にあった。
//   道のりの「感じ」は変えずに、宇宙で1mの重みを早めに増やして手前へ寄せる。
//   ボイジャー rawM 6,600 ＝ 約6分20秒。
const CJ_PACE_TIERS = [
  [5000,     1],    // 火星まで：元とまったく同じ（1m = 1progress）
  [5600,     4],
  [6200,     8],
  [6600,     7],    // rawM 6,600 ＝ progress 15,000 ＝ ボイジャー
  [9000,     9],
  [14000,   12],
  // ★ここから先は、本人の言うとおり「すごいスピードで飛んでいる」ところ。
  //   銀河のあつまりを こえていく区間なので、1歩で進む距離をぐっと伸ばす。
  //   ★biome の長さは「秒」で決めてあるので、ここを上げても
  //     1つあたりの見えている時間は変わらない（progress の幅が広がるだけ）。
  [16000,   20],
  [18000,   32],
  [Infinity, 48],
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
// 逆引き（progress → 実際に登った量）。確認用にその地点へ飛ぶのに使う。
function cjRawFromProgress(progress) {
  let p = 0, prev = 0;
  for (const [to, rate] of CJ_PACE_TIERS) {
    const span = (to - prev) * rate;
    if (progress <= p + span) return prev + (progress - p) / rate;
    p += span; prev = to;
  }
  return prev;
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
  [82000,   100000 * LY_KM,'天の川を出る'],
  [92000,   2.5e6 * LY_KM, 'アンドロメダ銀河'],
  // ★ここから先は「銀河のあつまり」の階段。数字はぜんぶ本物。
  //   1つ上がるごとに、まとまりが1つ大きくなる（銀河→群→団→超銀河団→あみ目）。
  // ★あいだを広くとってあるのは、**用意した場所を全部1回ずつ通すため**。
  //   つめると、ブラックホールを見ないまま宇宙のはてに着いてしまう（本人の指摘）。
  [110000,  1.0e7 * LY_KM, '局部銀河群'],          // 天の川とアンドロメダの仲間うち
  [128000,  6.5e7 * LY_KM, 'おとめ座銀河団'],      // となりの大きなあつまり
  [145000,  5.2e8 * LY_KM, 'ラニアケア超銀河団'],  // 天の川はこの中にいる
  [160000,  1.0e9 * LY_KM, '宇宙の大きなあみ目'],  // 銀河はあみの目のように並んでいる
  [175000,  1.34e10 * LY_KM, 'いちばん遠い銀河'],  // いま見つかっている いちばん遠いもの
  // 🌌 ここが折りかえし。**これより遠くは、光がまだ届いていないので見えない。**
  [190000,  4.65e10 * LY_KM, '観測できる宇宙のはて'],
];

// ============================================================
//  ☕ ブレイクタイム（ごほうびゾーン）
//
//   月・火星・木星…と、名まえのある場所に着いたすぐあとは、
//   足場が広く、間かくがつまり、こわれ雲も氷雲もじゃま役も出ない。
//   そのかわり ⭐ がたくさん降ってくる。カメラも少し引く。
//
//  ★難しさは まっすぐ上げない。ノコギリ波にする。
//    ずっと張りつめたままだと、息抜きのゲームではなくなる。
//    「着いた → ひと息 → また上る」の 息継ぎ があるから、
//    次の区間へ手が伸びる。
//
//  ★ここは「プレイヤーの いまの進行度」ではなく
//    「その足場が置かれる高さの進行度」で決めること。
//    足場は画面の外まで先に作ってあるので、いまの進行度で決めると
//    ごほうびゾーンが1画面ぶん ずれて置かれる。
// ============================================================
// ============================================================
//  🎛 場所ごとの手ざわり（プラン §6.3）
//
//   じゃま役の出かたと足場の配合を、**高度の直書き分岐ではなく表**で決める。
//   こうすると「その場所らしさ」を数字1つで足せる。
//     小惑星帯 … こわれる岩だらけ
//     海王星   … 猛烈な風＝足場がよく動く
//     カイパー … 氷が多い
//     ヘリオポーズ … ほぼ何も出ない（**見せ場の前の静けさ**。プラン §5.3）
//     ボイジャー … 何も出さない（プラン §5.4「演出中はハザード生成を停止」）
//
//   数字はぜんぶ**かけ算のつまみ**。1 が「いままでどおり」。
//   ★足場は「その足場が置かれる高さ」で引くこと。プレイヤーのいまの進行度で
//     引くと、画面の外に先に作ってある足場が1画面ぶんずれる（ごほうびゾーンと同じ罠）。
// ============================================================
// ============================================================
//  ✈️ ジェット気流（高度およそ 9〜12km）
//
//   ★本当のこと：飛行機が飛ぶ高さには、**西から東へ吹く強い川のような風**がある。
//     速いところで 時速200km をこえる。日本からアメリカへ行く飛行機のほうが
//     帰りより早く着くのは、この風に乗っているから。
//   ★CJ_ANCHORS の [500, 10km, 'ヒコーキの高さ'] とちょうど同じ場所。
//     数字を別に決めない。**同じ高さに、同じものを置く。**
//
//   遊びとしては「**足場のほうが流されていく**」ことにする。
//   チッチを直接おすと、指の位置と体の位置がずれて「バグっぽい」と感じる。
//   足場が流れるなら、目で見えるぶん、追いかけるのが技になる。
const CJ_JET_FROM = 440, CJ_JET_IN = 490, CJ_JET_OUT = 570, CJ_JET_TO = 660;
const CJ_JET_VX   = 1.15;      // world/秒。西→東（＋の向き）
function cjJetWind(progress) {
  return smoothstep(CJ_JET_FROM, CJ_JET_IN, progress) *
         (1 - smoothstep(CJ_JET_OUT, CJ_JET_TO, progress));
}

const CJ_ZONE_BASE = { foe: 1, ice: 1, brk: 1, spring: 1, move: 1 };
const CJ_ZONES = [
  // [この progress まで, 名まえ, つまみ]
  [ 1000, '空',           {}],
  [ 2000, 'カーマンライン', { move: 1.2 }],
  [ 3000, '地球のまわり',   { move: 1.3 }],
  [ 5000, '月から火星へ',   {}],
  [ 6500, '火星のむこう',   { move: 1.25 }],
  [ 7500, '小惑星帯',       { brk: 1.9, ice: 0.5, foe: 1.3 }],   // 岩だらけ
  [ 8500, '木星',           { foe: 1.2 }],
  [ 9500, '土星',           { spring: 1.3 }],                    // 環をくぐる
  [10500, '天王星',         { ice: 1.5, move: 0.8 }],            // 横倒し・メタンの霧
  [11500, '海王星',         { move: 1.8, foe: 1.2 }],            // 猛烈な風
  [13000, 'カイパーベルト', { ice: 1.9, brk: 0.7 }],             // 氷の小天体
  [15000, 'ヘリオポーズ',   { foe: 0.15, brk: 0.5, ice: 0.5 }],  // 見せ場の前の静けさ
  [Infinity, '深宇宙',      {}],
];
function cjZoneAt(progress) {
  for (let i = 0; i < CJ_ZONES.length; i++) {
    if (progress < CJ_ZONES[i][0]) return CJ_ZONES[i][2];
  }
  return CJ_ZONE_BASE;
}
const cjZone = (z, k) => (z[k] === undefined ? 1 : z[k]);

const CJ_BREAK_SPAN = 320;                   // ひと休みの長さ（progress）
// 名まえのある場所のうち、カーマンラインより上。ここに着くたびに ひと息。
const CJ_BREAK_AT = CJ_ANCHORS.filter(a => a[0] >= 1000).map(a => a[0]);

function cjBreakAmt(progress) {
  for (const at of CJ_BREAK_AT) {
    if (progress >= at && progress < at + CJ_BREAK_SPAN) {
      // 終わりぎわは、ふつうの難しさへ戻していく（急に戻すと事故になる）
      return 1 - smoothstep(at + CJ_BREAK_SPAN * 0.55, at + CJ_BREAK_SPAN, progress);
    }
  }
  return 0;
}

// 高さ y の足場は、進行度でいうとどこに置かれるか。
// camY は「プレイヤーの高さ − 5.62」まで上がり、climb はそこから始まっている。
const CJ_SCROLL_OFF = CJ_VIEW_H * (1 - CJ_SCROLL_FRAC) + CJ_PARK_CAMY;
function cjProgressAtY(y) {
  return cjProgressFrom(Math.max(0, y - CJ_SCROLL_OFF) * CJ_M_PER_WORLD);
}
// その逆。progress → その高さ（world）。ゴーストを並走させるのに使う。
function cjYAtProgress(p) {
  return cjRawFromProgress(Math.max(0, p)) / CJ_M_PER_WORLD + CJ_SCROLL_OFF;
}

// ============================================================
//  リザルトの換算（プラン §3.6）
//   「◯◯km」では、子どもには遠さが分からない。
//   歩いたら・新幹線なら・光なら で言いかえる。数字は本物のまま。
// ============================================================
function cjHumanTime(hours) {
  const sec = hours * 3600;
  if (sec < 0.01)      return 'またたくま';
  if (sec < 1)         return `${sec.toFixed(2)}びょう`;
  if (hours < 1 / 60)  return `${Math.round(sec)}びょう`;
  if (hours < 1)       return `${Math.round(hours * 60)}ふん`;
  if (hours < 48)      return `${Math.round(hours)}時間`;
  const days = hours / 24;
  if (days < 400)      return `${Math.round(days)}日`;
  const years = days / 365.25;
  if (years < 10000)   return `${Math.round(years).toLocaleString('ja-JP')}年`;
  return `${Math.round(years / 10000).toLocaleString('ja-JP')}万年`;
}
// [絵, ことば, かかる時間] の3行
function cjTravelLines(km) {
  return [
    ['🚶', 'あるいたら', cjHumanTime(km / 4)],            // 時速4km、休まずに
    ['🚄', '新幹線（しんかんせん）なら', cjHumanTime(km / 300)],
    ['💡', '光（ひかり）なら', cjHumanTime(km / 1079252848.8)],
  ];
}

// 到達地点の名まえ。biome の名まえと二重に出さないために使う。
const CJ_ANCHOR_NAMES = new Set(CJ_ANCHORS.map(a => a[2]));

// 観測できる宇宙のはて（465億光年）。★アンカー表の最後と同じ値にすること。
const CJ_EDGE_KM = CJ_ANCHORS[CJ_ANCHORS.length - 1][1];

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
  // 🌌 いちばん最後のアンカーは「観測できる宇宙のはて」。**そこで止める。**
  //   ★勾配を伸ばして 500億・600億光年…と出してはいけない。
  //     そこから先の光は、宇宙が生まれてから今までのあいだに まだ届いていない。
  //     つまり**見えないので、距離も存在しない**。本人の言うとおり、ここがおしまい。
  //   点は伸びつづけるので、登る理由はなくならない。
  return A[A.length - 1][1];
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
  return { tier:8, value: Math.round(km / LY_KM / 1e8).toLocaleString('ja-JP'), unit:'億光年',
           // はてに着いたら、そこで止まっている理由を小さく書いておく
           sub: km >= CJ_EDGE_KM * 0.999 ? 'これより遠くは 光がまだ届いていない' : '', km };
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
    this.seed = seed || 12345;
    this.rnd = mulberry32(this.seed);
    this.weather = cjTodayWeather(dayIndex === undefined ? 0 : dayIndex);
    // 深宇宙でどんな場所を通るか。種が同じなら毎回同じ道のりになる
    // ＝兄弟が同じ景色を見て競える。
    this.biomeTL = cjBiomeTimeline(this.seed);
    this.biome = cjBiomeOut();
    this.reset();
  }
  // 天気の効果を引く。無い項目は 1（＝そのまま）
  w(key) { const v = this.weather.mods[key]; return v === undefined ? 1 : v; }
  // 🌈 レリックを持っているか
  has(key) { return this.relics.some(r => r.key === key); }

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
    this.bestCombo = 0;               // このプレイの最高れんぞく（結果で渡す）
    this.iceChain = 0;                // ⛸ 氷を続けて乗りついだ数
    // 調子。ミスなしで着地を重ねるほど上がる（0..1）。
    // ★数字では見せない。カメラが少し引いて、視界が広がることで伝える（プラン §2.3）。
    this.calm = 0;
    // -1 = やさしい ／ +1 = 手ごわい。直近の様子で動く（プラン §3.5）。
    this.diff = 0;
    this.lowWarned = false;
    this.relics = [];                 // 🌈 このランだけの力（最大3）
    this.pillars = [];                // いま立っている光の柱
    this.nextPillarP = CJ_PILLAR_FROM;
    this.moonCleared = false; this.marsCleared = false;
    // 🌙 到着でいったん止まる（2D版と同じ作り）。'moon' / 'mars' / null
    this.ending = null;
    this.nextMilestone = 100;
    this.rawM = 0; this.progress = 0;
    this.scoreM = 0; this._lastProgress = 0; this.assisting = false;
    // 🔁 復活（プラン §3.6）。1ランに1回だけ・代償つき・**遊び券は取らない**。
    this.revived = false;       // もう使ったか
    this.scoreHalf = false;     // 使ったあとは、増えるぶんが半分になる
    this.distTier = 0; this.dist = cjFormatDistance(0);
    this.nextAnchor = 0; this.reached = [];
    this.biomeKey = '';               // いまいる場所（変わった瞬間だけ知らせる）
    this.breakAmt = 0;                // ☕ ひと休み中の強さ
    this.silenced = {};               // 🔇 もう無音にした場所
    this.helioWarned = false; this.helioDone = false;
    this.voyagerNear = false; this.voyagerDone = false;
    this.over = false;
    this.time = 0;
    this.wingUntil = 0; this.rocketUntil = 0; this.barrierUntil = 0;
    this.jet = 0;             // ✈️ いまのジェット気流の強さ（見た目に使う）
    this.jumboDone = false;   // ✈️ ジャンボは1回だけ通す
    this.chainBreak = 0;      // 💥 巻きこんだ回数（リザルトの「惜しさ」に使う）

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

    // ★はじまりは地面（公園）。空の途中からではない。
    //   カメラも公園にいる。飛び出すまで climb は増えない（camY が上がらないから）。
    this.player.y = CJ_PARK_TOP;
    this.player.px = 0;
    this.camY = CJ_PARK_CAMY;
    this.launched = false;
    // 打ち上げのあと、まっすぐ上に雲を3つ重ねて置く。
    // ★1つだけだと、外した瞬間に高度40mでゲームオーバーになる（実測でそうなった）。
    //   飛び出しは演出であって、腕前を試す場面ではない。ここは必ず拾わせる。
    for (let i = 0; i < 3; i++) {
      this.platforms.push({
        px: (i - 1) * 0.35, y: CJ_FIRST_PLAT_Y + i * 1.9, w: CJ_PLAT_W, type: 'normal',
        used: false, breakAt: 0, seed: this.rnd(), vx: 0, falling: false, fallV: 0,
      });
    }
    this.spawnY = CJ_FIRST_PLAT_Y + 3 * 1.9 + 0.4;
    while (this.spawnY < CJ_VIEW_H * 1.6) {
      this.genPlatformAt(this.spawnY);
      this.spawnY += this.randGap(this.spawnY);
    }
  }

  emit(type, data) { this.events.push(Object.assign({ type }, data || {})); }

  // y を渡すと、その高さが ひと休み中なら間かくをつめる
  randGap(y) {
    const g = (CJ_GAP_MIN + this.rnd() * (CJ_GAP_MAX - CJ_GAP_MIN))
            * lerp(0.90, 1.06, (this.diff + 1) / 2);
    return y === undefined ? g : g * lerp(1, 0.80, cjBreakAmt(cjProgressAtY(y)));
  }

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
    // ☕ ひと休み中は、足場が広くなり、こわれ雲・氷雲・動く足場が出ない
    const bk = cjBreakAmt(cjProgressAtY(y));
    // 難しさのつまみ（プラン §3.5）。手ごわいほど はばが狭い。
    const dw = lerp(1.16, 0.94, (this.diff + 1) / 2) * (this.has('wide') ? 1.25 : 1);
    const w = this.platformWidth(m) * (risky ? 0.86 : 1) * this.w('width') * lerp(1, 1.40, bk) * dw;

    let type = 'normal';
    const r = this.rnd();
    const calm = 1 - bk;
    // 🎛 その足場が置かれる高さの「場所」で配合を変える（プラン §6.3）
    const zp = cjProgressAtY(y);
    const z = cjZoneAt(zp);
    const zb = this.biomeModsAt(zp);        // 深宇宙の巡回ぶん
    const pIce    = (m > 45 ? 0.13 : 0) * (risky ? 1.9 : 1) * this.w('ice')
                  * calm * cjZone(z, 'ice') * cjZone(zb, 'ice');
    const pBreak  = (m > 28 ? 0.13 : 0) * (risky ? 1.9 : 1) * this.w('brk')
                  * calm * cjZone(z, 'brk') * cjZone(zb, 'brk');
    const pSpring = (m > 10 ? 0.10 : 0.07) * this.w('spring') * cjZone(z, 'spring');
    if (r < pIce) type = 'ice';
    else if (r < pIce + pBreak) type = 'break';
    else if (r < pIce + pBreak + pSpring) type = 'spring';

    // 動く足場はふつうの雲だけ（特殊足場は止めておく：難しすぎ防止）
    const pMove = (this.weather.mods.moving !== undefined ? this.weather.mods.moving : 0.3)
                * cjZone(z, 'move') * cjZone(zb, 'move');
    const moving = type === 'normal' && m > 20 && bk < 0.4 && this.rnd() < pMove;
    this.platforms.push({
      px, y, w, type, risky, used: false, breakAt: 0, seed: this.rnd(),
      falling: false, fallV: 0,
      vx: moving ? (this.rnd() < 0.5 ? 1 : -1) * CJ_PLAT_VX * this.w('platVx') : 0,
    });

    const ir = this.rnd();
    // ひと休み中は ⭐ がたくさん出る（ここが「ごほうび」の中身）
    const pStar = (risky ? 0.62 : 0.28) * this.w('starRate') * lerp(1, 2.3, bk);
    if (ir < 0.05)       this.coins.push({ px, y: y + 16 * S, taken: false, kind: 'onigiri' });
    else if (ir < pStar) this.coins.push({ px, y: y + 16 * S, taken: false, kind: 'star' });
  }

  // 指の位置 → 円周上の目標位置。元の「指の位置へ鳥が来る」操作をそのまま保つ。
  // 画面のはしへ寄せ続けるとカメラが追ってくるので、ぐるっと一周できる。
  setTargetFromScreen(fracX) {
    // ★到着シーンのあいだは動かさない。
    //   正面に立たせても、指が1mm動いた瞬間に元の場所へ戻ってしまい、
    //   うさぎや探査車に重なって半分隠れていた。
    if (this.ending) return;
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
    // 到着シーンのあいだは、ゲームの時間を止める
    if (this.ending) return;
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
    // 🚀🪽 道具を使っているあいだ（この間に登ったぶんは点にならない）
    this.assisting = wingOn || now < this.rocketUntil;
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
      const dive = (this.diving && p.vy < 0) ? CJ_DIVE_MUL * (this.has('dive') ? 1.25 : 1) : 1;
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
    // ✈️ ジェット気流のあいだは、**ぜんぶの足場が west→east へ流される**。
    //    乗っているあいだも流されるので、チッチも一緒に運ばれる（本当の風と同じ）。
    const jet = cjJetWind(this.progress) * CJ_JET_VX;
    this.jet = jet;
    for (const plat of this.platforms) {
      const v = (plat.vx || 0) + jet;
      if (v) plat.px = cjWrap(plat.px + v * dt);
    }
    // 空中では、チッチも少しだけ流される（乗っていないので、足場ほどではない）
    if (jet && p.vy !== 0) p.px = cjWrap(p.px + jet * 0.30 * dt);

    this.checkCoins(now);
    this.updateHawk(dt, now, wingOn, barrierOn);

    // --- カメラ ---
    // 縦：プレイヤーが画面の上から42%より上へ行ったら、そのぶん世界を下げる。
    // ★ぴったり追わない（プラン §2.3）。
    //   上るときは速く追い（k=8）、落ちるときはゆっくり（k=3）。
    //   こうすると、上りは「押し上げられる」感じ、落ちるときは
    //   「まだ間に合う」余白ができる。真値に張りつくと、どちらも消える。
    const want = p.y - CJ_VIEW_H * (1 - CJ_SCROLL_FRAC);
    const deadY = 0.40;                      // ここまでのズレは追わない（酔い対策）
    if (want > this.camY + deadY) {
      const k = p.vy > 0 ? 8 : 3;
      const dy = (want - this.camY) * Math.min(1, dt * k);
      this.camY += dy;
      this.climb += dy;
    }
    // 横：中央から少し離れたぶんだけ、ゆっくり回りこむ。
    // 遊びを持たせないと、少し動かすたびに景色が回って酔う。
    // 🪽 **つばさ＝滑空**（プラン §3.2）。3Dでは「ゆっくり落ちる」だけでは弱い。
    //    滑空中は塔をぐるっと回りこむ速さが上がる＝**円周を大きく移動できる**。
    //    危ない外周から安全な内側へ、その逆へ、乗りかえるための道具になる。
    //    ★操作そのものは変えない（指1本のまま）。回りこむ速さだけが変わる。
    const d = cjWrapDelta(p.px, this.camPx);
    const dead = CJ_VIEW_W * (wingOn ? 0.06 : 0.16);
    if (Math.abs(d) > dead) {
      const over = d - Math.sign(d) * dead;
      this.camPx = cjWrap(this.camPx + over * Math.min(1, dt * (wingOn ? 8 : 3)));
    }

    // --- 🌈 光の柱（プラン §3.4）---
    // 2本立てて、どちらへ寄ったかで、そのランの力が決まる。
    if (this.relics.length < CJ_RELIC_MAX && this.progress >= this.nextPillarP && !this.pillars.length) {
      this.nextPillarP += CJ_PILLAR_GAP;
      const pool = CJ_RELICS.filter(r => !this.relics.some(x => x.key === r.key));
      if (pool.length >= 2) {
        const i = Math.floor(this.rnd() * pool.length);
        let j = Math.floor(this.rnd() * (pool.length - 1)); if (j >= i) j++;
        const y = p.y + CJ_VIEW_H * 0.72;   // 画面に入ってから選べる高さ
        this.pillars = [
          { ang: this.pathA, y, relic: pool[i] },
          { ang: this.pathB, y, relic: pool[j] },
        ];
        this.emit('pillars', { a: pool[i], b: pool[j] });
      }
    }
    if (this.pillars.length) {
      const py = this.pillars[0].y;
      if (p.y > py + 3.2) {
        // どちらに寄っていたかで決まる（いつもの左右の操作が、そのまま選択になる）
        const d0 = Math.abs(cjWrapDelta(p.px, this.pillars[0].ang));
        const d1 = Math.abs(cjWrapDelta(p.px, this.pillars[1].ang));
        const got = (d0 <= d1 ? this.pillars[0] : this.pillars[1]).relic;
        this.relics.push(got);
        this.pillars = [];
        this.emit('relic', { relic: got });
      } else if (p.y < py - CJ_VIEW_H * 1.6) {
        this.pillars = [];            // 下へ遠ざかったら消す
      }
    }

    // ★「ひやっとした」も数える（プラン §3.5）。
    //   落ちなくても、下のふちに近づいたら、そのぶん やさしくする。
    if (!this.lowWarned && p.y < this.camY + CJ_VIEW_H * 0.10) {
      this.lowWarned = true;
      this.diff = Math.max(-1, this.diff - CJ_DIFF_DOWN * 0.6);
    }

    // --- 落ちたら終わり（画面の下のふちを割ったら）---
    if (p.y < this.camY - CJ_PLAYER_H) {
      this.over = true;
      this.emit('gameover');
      return;
    }

    // --- 💥 こわれた足場が落ちて、下の足場を巻きこむ（プラン §3.2）---
    //  ★これが「**下を見る理由**」になる。上ばかり見て登っていると、
    //    引き返そうとしたときに帰り道が消えている。
    //  ★理不尽にしないための決めごと
    //    ・落ちるのはゆっくり（重力の 55%）。**落ちてくる岩そのものが予告**になる
    //    ・巻きこむのは「真下にある」ものだけ（横のずれが幅の半分以内）
    //    ・巻きこみは点になる。危ないほうを選んだごほうびにする
    for (const pl of this.platforms) {
      if (!pl.falling) continue;
      pl.fallV -= CJ_GRAVITY * 0.55 * dt;
      pl.y += pl.fallV * dt;
      for (const other of this.platforms) {
        if (other === pl || other.used) continue;
        if (Math.abs(other.y - pl.y) > CJ_PLAT_H * 1.8) continue;
        if (Math.abs(cjWrapDelta(other.px, pl.px)) > (other.w + pl.w) * 0.5) continue;
        other.used = true; other.breakAt = now;
        other.falling = true; other.fallV = pl.fallV * 0.55;
        this.chainBreak++;
        this.bonusScore += 300;
        this.emit('chainBreak', { px: other.px, y: other.y, n: this.chainBreak });
      }
    }

    // --- 足場の掃除と生成 ---
    const bottom = this.camY - CJ_VIEW_H * 0.2;
    this.platforms = this.platforms.filter(pl =>
      pl.y > bottom &&
      // 落ちているものは、画面の下へ出るまで残す（消えると巻きこみが見えない）
      !(pl.used && !pl.falling && now - pl.breakAt > CJ_BREAK_FADE_MS) &&
      !(pl.falling && now - pl.breakAt > 7000));
    this.coins = this.coins.filter(c => !c.taken && c.y > bottom);
    const top = this.camY + CJ_VIEW_H * 1.4;
    while (this.spawnY < top) {
      this.genPlatformAt(this.spawnY);
      this.spawnY += this.randGap(this.spawnY);
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

        // 空中コンボは着地でリセット（プラン §3.3）。
        // ★「着地せずに ⭐ を取り続けるほど倍率が上がる」ようにすると、
        //   毎秒「もう1個いくか」の判断が生まれる。
        this.starCombo = 0;
        if (plat.type === 'spring') {
          this.iceChain = 0;
          // ★落ちてきた速さがそのままバネの威力になる。
          //   「たたむ」でわざと加速してから踏むと、ふつうの倍近く飛ぶ＝上級の技。
          p.vy = clamp(fall * CJ_SPRING_FROM_FALL, CJ_SPRING_V, CJ_SPRING_V * 1.75);
          this.emit('land', { kind: 'spring', px: plat.px, y: plat.y, impact: 1 });
        } else if (plat.type === 'ice' && this.has('ice2spring')) {
          // 🧊→🟢 レリック：氷がバネになる。すべる足場が、いちばん強い足場に変わる。
          p.vy = clamp(fall * CJ_SPRING_FROM_FALL, CJ_SPRING_V, CJ_SPRING_V * 1.75);
          this.emit('land', { kind: 'spring', px: plat.px, y: plat.y, impact: 1 });
        } else if (plat.type === 'break') {
          // 💥 こわれ雲は、崩れる反動で ふつうより 15% 強く跳ねる（プラン §3.2）。
          //    危ない足場を「あえて選ぶ」意味を作る。
          p.vy = jump * CJ_BREAK_KICK;
          if (!this.has('softBreak')) {
            plat.used = true; plat.breakAt = now;
            plat.falling = true; plat.fallV = 0;   // 消さずに、落としはじめる
          }
          this.iceChain = 0;
          this.emit('land', { kind: 'break', px: plat.px, y: plat.y, impact });
        } else if (plat.type === 'ice') {
          p.vy = jump;
          p.vx = (this.rnd() < 0.5 ? -1 : 1) * CJ_ICE_DRIFT * this.w('slip');
          // ⛸ 氷を続けて乗りつぐと「スケート」。すべる足場を**使いこなす**技（プラン §3.2）。
          this.iceChain++;
          if (this.iceChain >= 2) {
            const gained = Math.round(CJ_SKATE_BASE * Math.min(this.iceChain, 6));
            this.starScore += gained;
            this.emit('skate', { n: this.iceChain, gained, px: plat.px, y: plat.y });
          }
          this.emit('land', { kind: 'ice', px: plat.px, y: plat.y, impact });
        } else {
          p.vy = jump;
          this.iceChain = 0;
          this.emit('land', { kind: 'normal', px: plat.px, y: plat.y, impact });
        }

        // --- ジャストジャンプ：着地の「前」に置きなおしていたら、ここで上乗せ ---
        this.calm = Math.min(1, this.calm + 0.085);   // ミスなしを重ねるほど、視界が広がる
        this.diff = Math.min(1, this.diff + CJ_DIFF_UP);
        this.lowWarned = false;
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
        // 着地でリセットされるので、空中で取り続けたぶんだけ倍率が乗る
        this.starCombo = Math.min(this.starCombo + 1, CJ_STAR_COMBO_MAX);
        this.bestCombo = Math.max(this.bestCombo, this.starCombo);
        this.lastStarAt = now;
        // 道具を使っているあいだは ⭐ も半分（拾い放題にしない）
        const gained = Math.round(CJ_STAR_BASE * this.starCombo * this.w('star')
                                  * (this.assisting ? 0.5 : 1) * (this.has('star2') ? 2 : 1));
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
        this.calm = 0;                 // ミスしたら、視界はまた狭まる
        this.diff = Math.max(-1, this.diff - CJ_DIFF_DOWN);
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
    } else if (this.rawM >= CJ_HAWK_MIN_M && this.rawM < CJ_SHOOT_M &&
               cjBreakAmt(this.progress) < 0.5 && !this.has('noFoe') && this.foeRate() > 0.001) {
      // 🎛 場所ごとに出かたを変える。ヘリオポーズは 0.15倍＝ほとんど出ない。
      this.hawkCooldown -= dt * this.foeRate();
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

  // 🎛 いまの場所の「じゃま役の出やすさ」（0＝出ない）。
  //   ★ボイジャーと並走しているあいだは止める（プラン §5.4）。
  //     見せ場のさなかに撃たれると、読んでいる字から目がそれる。
  foeRate() {
    if (Math.abs(this.progress - CJ_VOYAGER_P) < CJ_VOY_SPAN) return 0;
    return cjZone(cjZoneAt(this.progress), 'foe') *
           cjZone(this.biomeModsAt(this.progress), 'foe');
  }

  // 深宇宙の巡回ぶんのつまみ。決まった道のりのうちは何もしない。
  //   ★毎フレーム・足場ごとに呼ぶので、色の混ぜまではやらない（key だけ引く）。
  biomeModsAt(progress) {
    if (progress < CJ_BIOME_START || !this.biomeTL) return CJ_ZONE_BASE;
    const tl = this.biomeTL;
    let i = 0;
    while (i < tl.length - 1 && progress >= tl[i].to) i++;
    const d = CJ_BIOME_DEFS[tl[i].key];
    return (d && d.mods) || CJ_ZONE_BASE;
  }

  // 🚀 月から先へ出発しなおす。
  // ★高さ（climb）はそのまま引きつぎ、**足場だけ作りなおす**。
  //   月に着いた瞬間は空中なので、そのまま再開すると即落下する（2D版と同じ理由）。
  continueFromMoon() {
    // ★月からも火星からも使う。3D版は火星の先（ボイジャー・深宇宙）が本番。
    if (!this.ending) return;
    this.ending = null;
    const p = this.player;
    this.platforms.length = 0;
    this.coins.length = 0;
    this.hawk = null;
    this.stunUntil = 0;
    const base = this.camY + CJ_VIEW_H * 0.22;
    this.platforms.push({
      px: p.px, y: base, w: CJ_PLAT_W * 1.4, type: 'normal',
      used: false, breakAt: 0, seed: this.rnd(), vx: 0, falling: false, fallV: 0,
    });
    p.y = base + CJ_PLAT_H;
    p.vy = CJ_JUMP_V;
    p.vx = 0;
    this.spawnY = base + 1.5;
    while (this.spawnY < this.camY + CJ_VIEW_H * 1.5) {
      this.genPlatformAt(this.spawnY);
      this.spawnY += this.randGap(this.spawnY);
    }
    this.emit('leaveMoon');
  }

  // 🚩 途中から始める（火星／ボイジャー）。
  //   高さと足場を作りなおすだけ。ボーナスは付けない（自分で着いたぶんだけが点）。
  startFrom(p) {
    if (!p) return;
    const climb = cjRawFromProgress(p) / CJ_M_PER_WORLD;
    this.climb = climb;
    this.camY = climb + CJ_PARK_CAMY;
    this.player.px = 0; this.player.vx = 0; this.player.vy = 0;
    this.player.y = this.camY + CJ_VIEW_H * 0.30;
    this.platforms.length = 0; this.coins.length = 0;
    this.pathA = 0; this.pathB = CJ_CIRC / 2;
    this.launched = true;
    // 足もとに1枚置いて、そこから上へ敷いていく
    this.platforms.push({
      px: 0, y: this.player.y - 0.55, w: CJ_PLAT_W, type: 'normal',
      used: false, breakAt: 0, seed: this.rnd(), vx: 0, falling: false, fallV: 0,
    });
    this.spawnY = this.player.y + 1.0;
    while (this.spawnY < this.camY + CJ_VIEW_H * 1.6) {
      this.genPlatformAt(this.spawnY);
      this.spawnY += this.randGap(this.spawnY);
    }
    // もう通った場所として扱う（到着シーンが出ないように）
    this.moonCleared = p >= CJ_GOAL_M;
    this.marsCleared = p >= CJ_MARS_M;
    this.voyagerDone = p >= CJ_VOYAGER_P;
    this.voyagerNear = this.voyagerDone;
    this.helioWarned = this.helioDone = p >= CJ_HELIO_P;
    for (const [at] of CJ_SILENCE_AT) if (p >= at) this.silenced[at] = true;
    while (this.nextAnchor < CJ_ANCHORS.length && p >= CJ_ANCHORS[this.nextAnchor][0]) this.nextAnchor++;
    this.nextPillarP = Math.max(CJ_PILLAR_FROM, p + 400);
    this.updateInfo();
    // ★点は「ここから登ったぶん」だけ。飛ばしたぶんは点にしない。
    this.scoreM = 0;
    this._lastProgress = this.progress;
    this.score = 0;
  }

  // 🔁 復活できるか（1ランに1回だけ・落ちたときだけ）
  canRevive() { return this.over && !this.revived && this.progress > 300; }

  // 🔁 復活する。いちばん高いところにあった足場の上へ戻す。
  //   ★点は取り消さない。これから増えるぶんが半分になるだけ（プラン §3.6）。
  revive() {
    if (!this.canRevive()) return false;
    this.revived = true;
    this.scoreHalf = true;
    this.over = false;
    const p = this.player;
    // 画面のまん中あたりへ戻して、足場を敷きなおす
    p.y = this.camY + CJ_VIEW_H * 0.45;
    p.vy = 0; p.vx = 0;
    p.px = this.camPx;
    this.platforms.length = 0;
    this.coins.length = 0;
    this.hawk = null;
    this.stunUntil = 0;
    this.spawnY = p.y - CJ_PLAT_H * 2;
    // 足元に1枚、確実に置く（復活した瞬間にまた落ちる、をなくす）
    this.platforms.push({
      px: p.px, y: p.y - CJ_PLAT_H, w: CJ_PLAT_W * 1.25, type: 'normal', risky: false,
      used: false, breakAt: 0, seed: this.rnd(), vx: 0, falling: false, fallV: 0,
    });
    const top = this.camY + CJ_VIEW_H * 1.4;
    while (this.spawnY < top) { this.genPlatformAt(this.spawnY); this.spawnY += this.randGap(this.spawnY); }
    // ひやっとしたぶん、少しやさしくする
    this.diff = Math.max(-1, this.diff - CJ_DIFF_DOWN);
    this.emit('revive');
    return true;
  }

  // ズギューン。公園のバネの遊具から飛び出す。
  launch() {
    this.player.vy = CJ_LAUNCH_V;
    this.launched = true;
    this.emit('launch');
  }

  updateInfo() {
    this.rawM = this.climb * CJ_M_PER_WORLD;       // むずかしさはこちら
    this.progress = cjProgressFrom(this.rawM);      // 見た目・距離はこちら
    this.meters = Math.floor(this.progress);
    // 合計点＝高さ点＋⭐点＋到達ボーナス。ボーナスは加算ずみなので、
    // 先で落ちても消えない（だから安心して先へ挑戦できる）
    // ★道具（🚀ロケット・🪽つばさ）を使っているあいだに登ったぶんは、点にならない。
    //   道具は「もっと先へ行く」ためのもので、「点をかせぐ」ためのものではない。
    //   ここを分けておかないと、勉強で買った道具でスコアが買えてしまい、
    //   自分の腕前で伸ばす意味がなくなる。
    const dP = this.progress - this._lastProgress;
    // 🔁 復活したあとは、伸びるぶんが半分。**取り消しではなく、これから先を軽くする。**
    //   すでに登ったぶんまで削ると、助けたのに罰したことになる。
    if (dP > 0 && !this.assisting) this.scoreM += dP * (this.scoreHalf ? 0.5 : 1);
    this._lastProgress = this.progress;

    this.score = Math.round(cjHeightScore(this.scoreM) * this.w('score'))
               + this.starScore + this.bonusScore;

    // --- いまどんな場所を通っているか ---
    // 名まえが変わったときだけ知らせる。ヘリオポーズより手前は名まえが無い
    // （惑星が主役なので、空の名まえは出さない）。
    this.breakAmt = cjBreakAmt(this.progress);   // ☕ ひと休みの強さ（演出用）
    cjBiomeAt(this.biomeTL, this.progress, this.biome);
    if (this.biome.key !== this.biomeKey) {
      const first = this.biomeKey === '';
      this.biomeKey = this.biome.key;
      // ★到達地点（📍）と同じ名まえのものは出さない。
      //   ヘリオポーズやオリオン大星雲は anchor 側で大きく出るので、
      //   両方出すと同じ名まえが2回ならんで、どちらも安っぽくなる。
      if (!first && this.biome.name && !CJ_ANCHOR_NAMES.has(this.biome.name)) {
        this.emit('biome', { name: this.biome.name, key: this.biome.key });
      }
    }

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

    // 🌙🔴 到着。**ここで一度きる**（2D版と同じ）。
    //   月は「ここでやめる／もっと先へ」の2択。火星は第2ゴール。
    // 🛑 ヘリオポーズ（プラン §5.3）。太陽の国のはて。
    //    予兆 → 壁 → 突きぬける、の3段で知らせる。
    if (!this.helioWarned && this.progress >= CJ_HELIO_P - 600) {
      this.helioWarned = true;
      this.emit('helioNear');
    }
    if (!this.helioDone && this.progress >= CJ_HELIO_P) {
      this.helioDone = true;
      this.emit('helio');
    }

    // 🔇 完全な無音は3回だけ（プラン §5.2）。
    //    空気がなくなる／太陽の国を出る／いちばん遠くへ行ったやつを追いこす。
    for (const [at, sec] of CJ_SILENCE_AT) {
      if (!this.silenced[at] && this.progress >= at) {
        this.silenced[at] = true;
        this.emit('silence', { sec });
      }
    }

    if (!this.moonCleared && this.progress >= CJ_GOAL_M) {
      this.moonCleared = true;
      this.bonusScore += CJ_MOON_BONUS;
      this.ending = 'moon';
      this.emit('moon');
    }
    if (this.moonCleared && !this.marsCleared && this.progress >= CJ_MARS_M) {
      this.marsCleared = true;
      this.bonusScore += CJ_MARS_BONUS;
      this.ending = 'mars';
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
