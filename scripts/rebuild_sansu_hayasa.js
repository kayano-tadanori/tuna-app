// 速さ（sansu_hayasa.json）を「間引き＋多様化＋図の追加」で再構成する。
// 既存は 小5/小6 × 難易度1〜4 の8セル各60問だが、各セル2〜4テンプレしかなく
// 「数字だけ違う同一問題」が最大114問も連続していた。図も0枚だった。
// 本スクリプトは各セルを 6〜8テンプレ・1テンプレ最大8問に制限し、旅人算/流水算/
// 通過算/ダイヤグラムに線分図・図を付与する。答えはすべてコードで計算する。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_hayasa.json');
const old = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let idN = 0;
const nid = () => 'sh' + String(++idN).padStart(3, '0');

// ---------- SVG ヘルパー ----------
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12) => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="middle" font-family="sans-serif" font-weight="bold">${s}</text>`;
// 右向き矢印
const arrowR = (x1, x2, y, c = RD) => `<line x1="${x1}" y1="${y}" x2="${x2 - 6}" y2="${y}" stroke="${c}" stroke-width="2.5"/><polygon points="${x2},${y} ${x2 - 8},${y - 4} ${x2 - 8},${y + 4}" fill="${c}"/>`;
const arrowL = (x1, x2, y, c = PK) => `<line x1="${x1 + 6}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c}" stroke-width="2.5"/><polygon points="${x2},${y} ${x2 + 8},${y - 4} ${x2 + 8},${y + 4}" fill="${c}"/>`;
const dot = (x, y, c) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/>`;

// 道のり線分図：1人がスタートからゴールまで
function figRoad(distLabel, whoL = 'スタート', whoR = 'ゴール') {
  const b = `<line x1="30" y1="55" x2="210" y2="55" stroke="${BL}" stroke-width="3"/>` +
    dot(30, 55, YE) + dot(210, 55, YE) +
    txt(30, 78, whoL, '#cdd6f4', 10) + txt(210, 78, whoR, '#cdd6f4', 10) +
    arrowR(40, 200, 42, RD) + txt(120, 34, distLabel, YE, 12);
  return S('240 90', b);
}
// 出会い算：A←→B、距離ラベル
function figMeet(distLabel, aLabel = 'A', bLabel = 'B') {
  const b = `<line x1="30" y1="55" x2="210" y2="55" stroke="${BL}" stroke-width="3"/>` +
    dot(30, 55, YE) + dot(210, 55, YE) +
    arrowR(38, 105, 42, RD) + arrowL(202, 135, 42, PK) +
    txt(30, 78, aLabel, RD, 12) + txt(210, 78, bLabel, PK, 12) +
    txt(120, 34, distLabel, YE, 12);
  return S('240 90', b);
}
// 追いつき算：同じ向き、先行と後追い
function figChase(gapLabel, backL = '自転車', frontL = '人') {
  const b = `<line x1="20" y1="58" x2="220" y2="58" stroke="${BL}" stroke-width="3"/>` +
    dot(45, 58, RD) + dot(150, 58, PK) +
    arrowR(52, 92, 44, RD) + arrowR(157, 190, 44, PK) +
    txt(45, 80, backL, RD, 10) + txt(150, 80, frontL, PK, 10) +
    txt(97, 34, gapLabel, YE, 12) +
    `<line x1="45" y1="24" x2="150" y2="24" stroke="${YE}" stroke-width="1" stroke-dasharray="3 2"/>`;
  return S('240 92', b);
}
// 流水算：川の流れと船
function figRiver(dir) { // 'up' 上り / 'down' 下り
  const flow = arrowR(60, 180, 30, GN);
  const boat = dir === 'up'
    ? arrowL(180, 70, 60, PK) + txt(125, 82, '上り（流れに逆らう）', PK, 10)
    : arrowR(60, 190, 60, RD) + txt(125, 82, '下り（流れに乗る）', RD, 10);
  const b = `<rect x="20" y="18" width="200" height="52" fill="${BL}" opacity="0.18"/>` +
    flow + txt(120, 15, '川の流れ →', GN, 10) + boat;
  return S('240 92', b);
}
// ダイヤグラム（進行グラフ）
function figDia(hLabel, vLabel) {
  const ox = 34, oy = 92, w = 175, h = 74;
  const b = `<line x1="${ox}" y1="${oy}" x2="${ox + w}" y2="${oy}" stroke="#cdd6f4" stroke-width="1.5"/>` +
    `<line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy - h}" stroke="#cdd6f4" stroke-width="1.5"/>` +
    `<line x1="${ox}" y1="${oy}" x2="${ox + w}" y2="${oy - h}" stroke="${RD}" stroke-width="2.5"/>` +
    `<line x1="${ox + w}" y1="${oy}" x2="${ox}" y2="${oy - h}" stroke="${PK}" stroke-width="2.5"/>` +
    txt(ox + w / 2, oy + 14, hLabel, '#cdd6f4', 10) +
    `<text x="12" y="${oy - h / 2}" fill="#cdd6f4" font-size="10" text-anchor="middle" font-family="sans-serif" font-weight="bold" transform="rotate(-90 12 ${oy - h / 2})">${vLabel}</text>`;
  return S('220 108', b);
}
// 通過算：列車とトンネル/鉄橋
function figTrain(label) {
  const b = `<rect x="24" y="46" width="70" height="22" rx="4" fill="${BL}"/>` +
    `<circle cx="40" cy="72" r="5" fill="#cdd6f4"/><circle cx="78" cy="72" r="5" fill="#cdd6f4"/>` +
    arrowR(96, 150, 40, RD) +
    `<rect x="150" y="36" width="70" height="46" fill="none" stroke="${YE}" stroke-width="2.5"/>` +
    txt(185, 30, label, YE, 11) + txt(59, 40, '列車', '#fff', 10);
  return S('240 92', b);
}

// ---------- 数値ユーティリティ ----------
const rng = (a, b) => a + ((idN * 7 + a * 3 + b) % (b - a + 1)); // 疑似乱数（決定的）
function pick(arr, i) { return arr[i % arr.length]; }
const fmt = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

const out = [];
function add(grade, diff, question, answer, meaning, svg) {
  out.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, ...(svg ? { svg } : {}) });
}
// 既存から間引いて最大 cap 問残す（テンプレ単位）
function keep(grade, diff, matcher, cap) {
  const got = old.filter(q => q.grade === grade && q.difficulty === diff && matcher(q.question)).slice(0, cap);
  got.forEach(q => out.push({ ...q, id: nid() }));
  return got.length;
}

// ============================================================
// 小5-1：速さの三公式・単位換算（基礎）＋道のり線分図
// ============================================================
keep(5, 1, q => q.includes('時速何km'), 8);   // 道のり÷時間
keep(5, 1, q => q.includes('進むと何km'), 8);  // 速さ×時間
keep(5, 1, q => q.includes('秒速') && q.includes('時速何km'), 7); // 秒速→時速
keep(5, 1, q => q.includes('時速') && q.includes('秒速何m'), 7);  // 時速→秒速
[[240, 4], [360, 6], [420, 7], [300, 5], [560, 8], [450, 9], [630, 7], [480, 6]].forEach(([d, t]) =>
  add(5, 1, `${d}kmの道のりを${t}時間で走ると、時速何kmですか？`, d / t, `速さ＝道のり÷時間。${d}÷${t}＝${d / t}より時速${d / t}kmです。`, figRoad(`${d}km`)));
[[60, 5], [80, 4], [120, 6], [90, 3], [140, 7], [100, 8], [75, 5], [96, 8]].forEach(([s, t]) =>
  add(5, 1, `分速${s}mで${t}分歩くと、何m進みますか？`, s * t, `道のり＝速さ×時間。${s}×${t}＝${s * t}mです。`, figRoad(`分速${s}m × ${t}分`)));
[[300, 60], [480, 80], [540, 90], [420, 70], [360, 60], [600, 75], [450, 90], [560, 70]].forEach(([d, s]) =>
  add(5, 1, `${d}mの道のりを分速${s}mで進むと、何分かかりますか？`, d / s, `時間＝道のり÷速さ。${d}÷${s}＝${d / s}分です。`, figRoad(`${d}m`)));

// ============================================================
// 小5-2：単位混在・平均の速さ（応用）
// ============================================================
keep(5, 2, q => q.includes('分速何m'), 8);
keep(5, 2, q => q.includes('自転車で') && q.includes('進みますか'), 8);
keep(5, 2, q => q.includes('平均'), 8);
[[36, 45], [48, 40], [60, 50], [42, 35], [54, 45], [30, 60], [72, 48], [40, 50]].forEach(([km, min]) =>
  add(5, 2, `${km}kmの道のりを${min}分で進む電車の速さは、時速何kmですか？`, Math.round(km / (min / 60) * 100) / 100,
    `${min}分＝${min / 60}時間。${km}÷${min / 60}＝${fmt(km / (min / 60))}より時速${fmt(km / (min / 60))}kmです。`, figRoad(`${km}km`)));
[[12, 40], [15, 50], [18, 60], [9, 30], [21, 70], [24, 40], [10, 25], [16, 32]].forEach(([km, kmh]) =>
  add(5, 2, `時速${kmh}kmで${km}km進むには、何分かかりますか？`, Math.round(km / kmh * 60 * 100) / 100,
    `時間＝道のり÷速さ＝${km}÷${kmh}時間＝${fmt(km / kmh * 60)}分です。`, figRoad(`${km}km`)));
[[900, 6, 720, 4]].concat([[600, 5, 800, 3], [1200, 8, 480, 4], [720, 6, 630, 3], [840, 7, 520, 4], [960, 8, 700, 2], [560, 4, 810, 6], [640, 5, 990, 4]]).forEach(([d1, t1, d2, t2]) =>
  add(5, 2, `はじめに${d1}mを${t1}分、続けて${d2}mを${t2}分で歩きました。全体の平均の速さは分速何mですか？`, Math.round((d1 + d2) / (t1 + t2) * 100) / 100,
    `平均の速さ＝全体の道のり÷全体の時間。(${d1}＋${d2})÷(${t1}＋${t2})＝${d1 + d2}÷${t1 + t2}＝${fmt((d1 + d2) / (t1 + t2))}mです。`, figRoad(`全${d1 + d2}m`)));

// ============================================================
// 小5-3：旅人算（出会い・追いつき）＋線分図
// ============================================================
keep(5, 3, q => q.includes('上りの速さ') && q.includes('静水'), 8);
keep(5, 3, q => q.includes('流れの速さは時速'), 8);
[[80, 70, 1500], [90, 60, 1800], [75, 85, 3200], [65, 55, 1200], [100, 80, 2700], [70, 90, 1600], [95, 65, 3200], [60, 120, 2700]].forEach(([a, b, d]) =>
  add(5, 3, `2人が${d}mはなれた場所から向かい合って同時に歩き出します。Aは分速${a}m、Bは分速${b}mのとき、何分後に出会いますか？`, d / (a + b),
    `出会うまでの時間＝道のり÷速さの和。${d}÷(${a}＋${b})＝${d}÷${a + b}＝${d / (a + b)}分後です。`, figMeet(`${d}m`)));
[[200, 140, 480], [180, 120, 360], [220, 160, 540], [150, 90, 420], [240, 180, 300], [170, 110, 480], [190, 130, 360], [210, 150, 420]].forEach(([a, b, gap]) =>
  add(5, 3, `分速${a}mの自転車が、${gap}m先を分速${b}mで歩く人を追いかけます。追いつくのは何分後ですか？`, gap / (a - b),
    `追いつく時間＝差÷速さの差。${gap}÷(${a}－${b})＝${gap}÷${a - b}＝${gap / (a - b)}分後です。`, figChase(`${gap}m`)));

// ============================================================
// 小5-4：旅人算の応用（往復・出会い）＋図
// ============================================================
keep(5, 4, q => q.includes('追いつく'), 8);
keep(5, 4, q => q.includes('静水') && q.includes('出会い'), 8);
[[6, 4, 40], [5, 3, 32], [7, 5, 48], [8, 4, 36], [6, 6, 60], [9, 3, 48], [5, 7, 36], [8, 2, 50]].forEach(([a, b, d]) =>
  add(5, 4, `${d}kmはなれたP・Qから、Aは時速${a}km、Bは時速${b}kmで同時に向かい合って出発します。何時間後に出会いますか？`, d / (a + b),
    `${d}÷(${a}＋${b})＝${d}÷${a + b}＝${d / (a + b)}時間後に出会います。`, figMeet(`${d}km`, 'A(P)', 'B(Q)')));
[[300, 180, 720], [250, 150, 800], [280, 160, 600], [320, 200, 720], [270, 90, 540], [240, 140, 500], [360, 210, 900], [290, 130, 640]].forEach(([a, b, gap]) =>
  add(5, 4, `兄は分速${a}m、弟は分速${b}mで歩きます。弟が${gap}m先に出発したとき、兄が追いつくのは何分後ですか？`, gap / (a - b),
    `${gap}÷(${a}－${b})＝${gap}÷${a - b}＝${gap / (a - b)}分後に追いつきます。`, figChase(`${gap}m`, '兄', '弟')));

// ============================================================
// 小6-1：速さと比・単位換算
// ============================================================
keep(6, 1, q => q.includes('進むと何km') || q.includes('進むと何m'), 8);
keep(6, 1, q => q.includes('速さの比') && q.includes('反対方向'), 8);
keep(6, 1, q => q.includes('秒速何m'), 6);
[[2, 3, 42], [3, 4, 48], [4, 5, 60], [5, 6, 66], [2, 5, 45], [3, 5, 60], [4, 7, 63], [5, 8, 72]].forEach(([ra, rb, min]) =>
  add(6, 1, `同じ道のりを進むのに、AとBの速さの比は${ra}：${rb}です。Aが${min}分かかるとき、Bは何分かかりますか？`, Math.round(min * ra / rb * 100) / 100,
    `速さの比が${ra}：${rb}なら、かかる時間の比は逆の${rb}：${ra}。Aが${min}分なので、B＝${min}×${ra}÷${rb}＝${fmt(min * ra / rb)}分です。`));
[[3, 5, 24], [2, 3, 20], [4, 5, 27], [5, 7, 36], [3, 4, 28], [2, 5, 21], [5, 6, 33], [4, 7, 22]].forEach(([ra, rb, tot]) =>
  add(6, 1, `AとBが同時に反対方向へ歩き出します。速さの比は${ra}：${rb}で、2人合わせて${tot}km歩いたとき、Bは何km歩きましたか？`, Math.round(tot * rb / (ra + rb) * 100) / 100,
    `Bの分は全体の${rb}/${ra + rb}。${tot}×${rb}÷${ra + rb}＝${fmt(tot * rb / (ra + rb))}kmです。`, figMeet(`合計${tot}km`)));

// ============================================================
// 小6-2：流水算・比＋川の図
// ============================================================
keep(6, 2, q => q.includes('川の流れの速さ'), 8);
keep(6, 2, q => q.includes('上りの速さは時速'), 8);
keep(6, 2, q => q.includes('速さの比は') && q.includes('かかりますか'), 8);
[[18, 3], [24, 4], [15, 5], [20, 6], [30, 2], [16, 3], [21, 5], [27, 4]].forEach(([still, cur]) =>
  add(6, 2, `静水での速さが時速${still}kmの船が、流れの速さ時速${cur}kmの川を下ります。下りの速さは時速何kmですか？`, still + cur,
    `下りの速さ＝静水の速さ＋流れの速さ＝${still}＋${cur}＝${still + cur}kmです。`, figRiver('down')));
[[18, 3], [24, 5], [20, 4], [30, 6], [22, 7], [26, 8], [19, 4], [25, 5]].forEach(([still, cur]) =>
  add(6, 2, `静水での速さが時速${still}kmの船が、流れの速さ時速${cur}kmの川を上ります。上りの速さは時速何kmですか？`, still - cur,
    `上りの速さ＝静水の速さ－流れの速さ＝${still}－${cur}＝${still - cur}kmです。`, figRiver('up')));

// ============================================================
// 小6-3：ダイヤグラム・通過算
// ============================================================
keep(6, 3, q => q.includes('上りの速さ') && q.includes('静水'), 8);
keep(6, 3, q => q.includes('流れの速さは時速'), 8);
[[120, 15], [150, 12], [180, 18], [90, 9], [200, 20], [160, 16], [140, 14], [100, 10]].forEach(([len, sec]) =>
  add(6, 3, `長さ${len}mの電車が、電柱を通過するのに${sec}秒かかりました。この電車の速さは秒速何mですか？`, Math.round(len / sec * 100) / 100,
    `電柱の通過では列車の長さ分だけ進む。${len}÷${sec}＝${fmt(len / sec)}m。秒速${fmt(len / sec)}mです。`, figTrain('電柱')));
[[80, 400, 20], [90, 510, 25], [100, 620, 24], [70, 350, 15], [120, 480, 12], [60, 300, 18], [110, 550, 20], [95, 425, 15]].forEach(([len, bridge, sec]) =>
  add(6, 3, `長さ${len}mの電車が、長さ${bridge}mの鉄橋を渡り始めてから渡り終わるまで${sec}秒かかりました。電車の速さは秒速何mですか？`, Math.round((len + bridge) / sec * 100) / 100,
    `鉄橋を渡るには（列車＋鉄橋）の長さを進む。(${len}＋${bridge})÷${sec}＝${len + bridge}÷${sec}＝${fmt((len + bridge) / sec)}mです。`, figTrain('鉄橋')));

// ============================================================
// 小6-4：ダイヤグラム的な出会い・複合＋図
// ============================================================
keep(6, 4, q => q.includes('静水') && q.includes('出会い'), 8);
keep(6, 4, q => q.includes('追いつく'), 8);
[[45, 30, 25], [50, 40, 27], [36, 24, 30], [60, 30, 30], [48, 32, 20], [40, 35, 30], [54, 42, 32], [42, 30, 24]].forEach(([a, b, km]) =>
  add(6, 4, `${km}kmはなれた2地点から、時速${a}kmと時速${b}kmの車が同時に向かい合って走ります。出会うのは何分後ですか？`, Math.round(km / (a + b) * 60 * 100) / 100,
    `出会う時間＝${km}÷(${a}＋${b})時間＝${km}÷${a + b}時間＝${fmt(km / (a + b) * 60)}分後です。`, figMeet(`${km}km`)));
[[100, 60, 8], [120, 80, 12], [90, 54, 6], [150, 90, 10], [110, 66, 8], [80, 48, 4], [135, 81, 9], [105, 63, 7]].forEach(([len, sec, poleSec]) =>
  add(6, 4, `ある電車が長さ${len}mで、秒速${Math.round(len / poleSec * 100) / 100}mで走っています。この電車が長さ${len * 3}mのトンネルに完全にかくれているのは何秒間ですか？`,
    Math.round((len * 3 - len) / (len / poleSec) * 100) / 100,
    `かくれているのはトンネルの長さ－列車の長さ＝${len * 3}－${len}＝${len * 2}mを進む間。${len * 2}÷${fmt(len / poleSec)}＝${fmt((len * 2) / (len / poleSec))}秒です。`, figTrain('トンネル')));

// ============================================================
// 追加テンプレ（各セルを約60問・多様化するため）
// ============================================================
// 5-3 追加：池のまわりの旅人算（出会い・追いつき）
[[70, 50, 1200], [80, 40, 1440], [90, 60, 1500], [65, 55, 960], [100, 80, 1800], [75, 45, 1200]].forEach(([a, b, d]) =>
  add(5, 3, `1周${d}mの池のまわりを、Aは分速${a}m、Bは分速${b}mで反対向きに同時に回ります。2人が出会うのは何分ごとですか？`, d / (a + b),
    `反対向きなので速さの和で1周分を進む。${d}÷(${a}＋${b})＝${d}÷${a + b}＝${d / (a + b)}分ごとです。`, figMeet(`池1周 ${d}m`)));
[[90, 60, 1200], [100, 70, 1500], [80, 50, 1200], [110, 80, 1800], [95, 65, 900], [120, 90, 1800]].forEach(([a, b, d]) =>
  add(5, 3, `1周${d}mの池のまわりを、Aは分速${a}m、Bは分速${b}mで同じ向きに同時に回ります。速いAが1周差をつけて追いつくのは何分後ですか？`, d / (a - b),
    `同じ向きなので速さの差で1周分の差をつめる。${d}÷(${a}－${b})＝${d}÷${a - b}＝${d / (a - b)}分後です。`, figChase(`池1周 ${d}m`, 'A', 'B')));

// 5-4 追加：出会うまでにAが進む距離／時間差出発
[[6, 4, 40], [5, 3, 32], [8, 4, 36], [7, 5, 48], [9, 6, 45], [6, 2, 40]].forEach(([a, b, d]) =>
  add(5, 4, `${d}kmはなれたP・Qから、Aは時速${a}km、Bは時速${b}kmで同時に向かい合って出発します。出会うのはPから何kmの地点ですか？`, Math.round(d * a / (a + b) * 100) / 100,
    `出会うのは${d}÷(${a}＋${b})＝${d / (a + b)}時間後。Aはその間に${a}×${d / (a + b)}＝${fmt(d * a / (a + b))}km進みます。`, figMeet(`${d}km`, 'A(P)', 'B(Q)')));
[[6, 3, 4], [8, 6, 5], [5, 4, 3], [7, 4, 5], [9, 5, 6], [4, 6, 2]].forEach(([v, wait, back]) =>
  add(5, 4, `弟が分速${back}0mで歩いて家を出た${wait}分後に、兄が分速${v}0mの自転車で追いかけます。兄が追いつくのは兄が出発してから何分後ですか？`, (back * 10 * wait) / (v * 10 - back * 10),
    `弟は${wait}分で${back * 10 * wait}m先行。差÷速さの差＝${back * 10 * wait}÷(${v * 10}－${back * 10})＝${back * 10 * wait}÷${v * 10 - back * 10}＝${(back * 10 * wait) / (v * 10 - back * 10)}分後です。`, figChase(`${back * 10 * wait}m`, '兄', '弟')));

// 6-1 追加：単位換算の連続／時間一定の速さ比
[[36], [54], [72], [90], [45], [63]].forEach(([kmh]) =>
  add(6, 1, `時速${kmh}kmは秒速何mですか？`, Math.round(kmh * 1000 / 3600 * 100) / 100,
    `時速${kmh}km＝${kmh}000m÷3600秒＝${fmt(kmh * 1000 / 3600)}m。秒速${fmt(kmh * 1000 / 3600)}mです。`));
[[2, 3, 60], [3, 4, 84], [4, 5, 90], [5, 6, 66], [3, 5, 80], [4, 7, 88]].forEach(([ta, tb, dist]) =>
  add(6, 1, `同じ時間だけ進むと、AとBの進む道のりの比は${ta}：${tb}でした。Aの速さが時速${dist}kmのとき、Bの速さは時速何kmですか？`, Math.round(dist * tb / ta * 100) / 100,
    `同じ時間なら道のりの比＝速さの比。B＝${dist}×${tb}÷${ta}＝${fmt(dist * tb / ta)}kmです。`));

// 6-2 追加：流水算（上りの所要時間）
[[16, 4, 60], [20, 5, 60], [24, 6, 54], [18, 3, 45], [21, 7, 42], [15, 5, 50]].forEach(([still, cur, dist]) =>
  add(6, 2, `静水時速${still}kmの船が、流れ時速${cur}kmの川を${dist}km上ります。かかる時間は何時間ですか？`, Math.round(dist / (still - cur) * 100) / 100,
    `上りの速さ＝${still}－${cur}＝${still - cur}km。${dist}÷${still - cur}＝${fmt(dist / (still - cur))}時間です。`, figRiver('up')));

// 6-3 追加：電車のすれ違い・追い越し
[[80, 120, 10, 15], [90, 110, 8, 12], [100, 140, 10, 14], [70, 130, 9, 11], [110, 90, 13, 12], [95, 105, 9, 11]].forEach(([l1, l2, s1, s2]) =>
  add(6, 3, `秒速${s1}mで長さ${l1}mの電車と、秒速${s2}mで長さ${l2}mの電車が反対向きにすれちがいます。すれちがいに何秒かかりますか？`, Math.round((l1 + l2) / (s1 + s2) * 100) / 100,
    `すれちがいは両方の長さの和を速さの和で進む。(${l1}＋${l2})÷(${s1}＋${s2})＝${l1 + l2}÷${s1 + s2}＝${fmt((l1 + l2) / (s1 + s2))}秒です。`, figTrain('すれちがい')));

// 6-4 追加：時計算／動く歩道
[[3], [6], [9], [2], [4], [8]].forEach(([h]) =>
  add(6, 4, `時計の長針と短針が${h}時ちょうどにつくる小さいほうの角の大きさは何度ですか？`, Math.min(30 * h, 360 - 30 * h),
    `1時間で短針は30度動く。${h}時は30×${h}＝${30 * h}度、小さいほうは${Math.min(30 * h, 360 - 30 * h)}度です。`));
[[80, 20, 320], [60, 15, 300], [90, 30, 480], [70, 20, 360], [100, 25, 500], [50, 10, 240]].forEach(([walk, belt, dist]) =>
  add(6, 4, `止まっていると分速${belt}mで運ぶ「動く歩道」の上を、分速${walk}mで歩きます。${dist}m進むのに何分かかりますか？`, Math.round(dist / (walk + belt) * 100) / 100,
    `動く歩道の上を歩くと速さは和になる。${dist}÷(${walk}＋${belt})＝${dist}÷${walk + belt}＝${fmt(dist / (walk + belt))}分です。`, figRiver('down')));

// 使わなかった null を除去
const clean = out.filter(Boolean).filter(q => q && q.question);

// 書き込み
fs.writeFileSync(FILE, JSON.stringify(clean, null, 2), 'utf8');

// レポート
function norm(s){return String(s||"").replace(/[0-9０-９]+(\.[0-9]+)?/g,"#").replace(/\s+/g,"").replace(/[、。，．]/g,"");}
const cell={};
clean.forEach(q=>{const k=q.grade+"-"+q.difficulty;(cell[k]=cell[k]||[]).push(q);});
console.log('総数:', clean.length, ' 図あり:', clean.filter(q=>q.svg).length);
Object.keys(cell).sort().forEach(k=>{
  const t=new Set(cell[k].map(q=>norm(q.question)));
  const fig=cell[k].filter(q=>q.svg).length;
  console.log(`  ${k}: ${cell[k].length}問 / ${t.size}テンプレ / 図${fig}`);
});
