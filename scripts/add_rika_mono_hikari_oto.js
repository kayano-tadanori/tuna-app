// rika_mono.json に「光の三原色・レンズ・反射角」「音の複合計算（やまびこ・かみなり・風）」の
// 新規オリジナル問題を追加する（浜学園資料は参考のみ、文面・数値は独自）
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'rika_mono.json');
const data = require(FILE);

function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function fmt(x) {
  x = Math.round(x * 10) / 10;
  if (Object.is(x, -0)) x = 0;
  return String(x);
}
function uniqShuffle4(correct, distractorPool) {
  const correctStr = fmt(correct);
  const set = new Set([correctStr]);
  const chosen = [];
  for (const v of distractorPool) {
    const d = fmt(v);
    if (!set.has(d)) { set.add(d); chosen.push(d); }
    if (chosen.length >= 3) break;
  }
  let guard = 0;
  while (chosen.length < 3 && guard < 100) {
    guard++;
    const noise = fmt(Number(correctStr) + randInt(-15, 15) * (guard % 4 + 1) || 1);
    if (!set.has(noise) && Number(noise) > 0) { set.add(noise); chosen.push(noise); }
  }
  const all = [correctStr, ...chosen];
  for (let i = all.length - 1; i > 0; i--) { const j = randInt(0, i); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}

let nextNum = Math.max(...data.map(x => parseInt(x.id.replace('rm', '')))) + 1;
const out = [];
function add(question, answer, choices, meaning, grade, difficulty) {
  out.push({ id: 'rm' + (nextNum++), question, answer: String(answer), choices, meaning, grade, difficulty });
}

// ── 光の三原色（知識・固定パターン） ──
const colorFacts = [
  ['光の三原色のうち、赤色の光と青色の光を重ねると何色に見える？', '赤紫色（マゼンタ）', ['赤紫色（マゼンタ）', '黄色', '青緑色（シアン）', '白色']],
  ['光の三原色のうち、赤色の光と緑色の光を重ねると何色に見える？', '黄色', ['黄色', '赤紫色（マゼンタ）', '青緑色（シアン）', '白色']],
  ['光の三原色のうち、青色の光と緑色の光を重ねると何色に見える？', '青緑色（シアン）', ['青緑色（シアン）', '黄色', '赤紫色（マゼンタ）', '白色']],
  ['光の三原色である赤・緑・青の光をすべて重ねると何色に見える？', '白色', ['白色', '黒色', '灰色', '透明']],
  ['植物の葉が緑色に見えるのは、緑色の光をどうしているから？', '反射している', ['反射している', '吸収している', '発生させている', '曲げている']],
  ['赤色の光しかない部屋で青色の服を見ると、どう見える？', '黒っぽく見える', ['黒っぽく見える', '青色に見える', '白色に見える', '赤色に見える']],
];
colorFacts.forEach(([q, a, c]) => {
  add(q, a, c, '光の三原色（赤・緑・青）は、混ぜるほど明るくなる性質があります。赤＋青＝赤紫、赤＋緑＝黄、青＋緑＝青緑、3色すべてで白になります。また、ものの色は、そのものが吸収せずに反射した光の色として見えます。よって、答えは' + a + 'です。', 5, 2);
});

// ── 反射角の計算 ──
for (let i = 0; i < 4; i++) {
  const angle = pick([30, 35, 40, 45, 50, 55, 60]);
  add(
    `平面鏡に光が入射角${angle}度で当たりました。このときの反射角は何度ですか？`,
    angle,
    uniqShuffle4(angle, [90 - angle, angle * 2, 180 - angle]),
    `反射の法則により、鏡に光が当たるとき、入射角と反射角は必ず同じ大きさになります。①入射角が${angle}度なので、②反射角も${angle}度です。よって、答えは${angle}です。`,
    5, 2
  );
}
for (let i = 0; i < 4; i++) {
  const angle = pick([30, 40, 50, 60, 70, 80, 90]);
  const half = angle / 2;
  add(
    `平面鏡に光が当たったとき、入射角と反射角を合わせた角度（入射光と反射光の間の角度）は${angle}度でした。入射角は何度ですか？`,
    fmt(half),
    uniqShuffle4(half, [angle, angle * 2, half + 10]),
    `反射の法則により入射角＝反射角なので、①入射光と反射光の間の角度は、入射角の2倍になります。②入射角＝${angle}÷2＝${fmt(half)}度です。よって、答えは${fmt(half)}です。`,
    6, 3
  );
}

// ── ピンホールカメラの像の大きさ（穴とスクリーンのきょりに比例） ──
for (let i = 0; i < 4; i++) {
  const base = pick([2, 3, 4, 5]);
  const times = pick([2, 3, 4]);
  const ans = base * times;
  add(
    `ピンホールカメラで、物体から穴までのきょりを変えないまま、穴からスクリーンまでのきょりを${base}cmから${base * times}cmにしました。このとき、スクリーンにうつる像の大きさは、はじめの何倍になりますか？`,
    times,
    uniqShuffle4(times, [times + 1, times - 1 > 0 ? times - 1 : times + 2, times * 2]),
    `ピンホールカメラの像の大きさは、穴からスクリーンまでのきょりに比例します。①穴からスクリーンまでのきょりが${base}cmから${base * times}cmになったので、②${base * times}÷${base}＝${times}倍になったと分かります。よって、答えは${times}です。`,
    5, 2
  );
}

// ── とつレンズ：同じ大きさの実像ができる位置（焦点きょりの2倍） ──
for (let i = 0; i < 5; i++) {
  const f = pick([3, 4, 5, 6, 7, 8]);
  const ans = f * 2;
  add(
    `焦点きょりが${f}cmのとつレンズを使って、物体と同じ大きさの倒立の実像をスクリーンにうつしたいと思います。物体をレンズから何cm離せばよいですか？`,
    ans,
    uniqShuffle4(ans, [f, f * 3, f + 2]),
    `とつレンズでは、物体を焦点きょりのちょうど2倍の位置に置くと、できる実像も焦点きょりの2倍の位置にでき、物体と同じ大きさになります。①焦点きょりは${f}cmなので、②${f}×2＝${ans}cmの位置に物体を置けばよいと分かります。よって、答えは${ans}です。`,
    6, 3
  );
}

// ── 音速の基本計算 ──
for (let i = 0; i < 4; i++) {
  const v = 340;
  const t = pick([2, 3, 4, 5, 6]);
  const ans = v * t;
  add(
    `音の速さを秒速340mとします。音が出た場所から${ans}m離れた地点まで、音が届くのに何秒かかりますか？`,
    t,
    uniqShuffle4(t, [t + 1, t - 1 > 0 ? t - 1 : t + 2, t * 2]),
    `音が伝わるきょりは「音の速さ×時間」で求められます。①きょり${ans}m、音の速さ秒速340mなので、②時間＝${ans}÷340＝${t}秒です。よって、答えは${t}です。`,
    5, 2
  );
}

// ── かみなりまでのきょり ──
for (let i = 0; i < 4; i++) {
  const t = pick([3, 4, 5, 6, 7, 8]);
  const v = 340;
  const ans = v * t;
  add(
    `かみなりが光ってから、音が聞こえるまで${t}秒かかりました。音の速さを秒速340mとすると、かみなりが発生した場所までのきょりは何mですか？（光が届く時間は考えないものとします）`,
    ans,
    uniqShuffle4(ans, [ans / 2, ans + 340, ans - 340]),
    `光は一瞬で届くとみなせるので、音が聞こえるまでの時間から、きょり＝音の速さ×時間で計算できます。①340×${t}＝${ans}mです。よって、答えは${ans}です。`,
    5, 2
  );
}

// ── やまびこ（こだま）：往復なので÷2 ──
for (let i = 0; i < 5; i++) {
  const t = pick([2, 3, 4, 5, 6, 8]);
  const v = 340;
  const ans = v * t / 2;
  add(
    `がけに向かって大きな音を出したところ、音を出してから${t}秒後にやまびこ（はね返ってきた音）が聞こえました。音の速さを秒速340mとすると、がけまでのきょりは何mですか？`,
    fmt(ans),
    uniqShuffle4(ans, [v * t, ans / 2, ans + 100]),
    `やまびこは、音が「行き」と「帰り」で同じきょりを2回進んでもどってくる現象です。①音が伝わったきょりの合計は340×${t}＝${v * t}m、②がけまでのきょりはその半分なので、${v * t}÷2＝${fmt(ans)}mです。よって、答えは${fmt(ans)}です。`,
    6, 3
  );
}

// ── 風の影響を受けた音速（追い風・向かい風） ──
for (let i = 0; i < 4; i++) {
  const v = 340;
  const w = pick([5, 8, 10, 12, 15]);
  const ans = v + w;
  add(
    `無風のときの音の速さを秒速340mとします。風下に向かって秒速${w}mの風がふいているとき、その向きに進む音の速さは秒速何mになりますか？`,
    ans,
    uniqShuffle4(ans, [v - w, v, v + w * 2]),
    `音が風にのって進むとき、その向きに進む音の速さは「音の速さ＋風の速さ」で求められます。①340＋${w}＝${ans}です。よって、答えは${ans}です。`,
    6, 3
  );
}
for (let i = 0; i < 4; i++) {
  const v = 340;
  const w = pick([5, 8, 10, 12, 15]);
  const ans = v - w;
  add(
    `無風のときの音の速さを秒速340mとします。風上に向かって秒速${w}mの風がふいているとき、風に逆らって進む音の速さは秒速何mになりますか？`,
    ans,
    uniqShuffle4(ans, [v + w, v, v - w * 2]),
    `音が風に逆らって進むとき、音の速さは「音の速さ－風の速さ」で求められます。①340－${w}＝${ans}です。よって、答えは${ans}です。`,
    6, 3
  );
}

// ── 風の影響を受けた音速の応用：きょり計算 ──
for (let i = 0; i < 3; i++) {
  const w = pick([5, 10, 15]);
  const v = 340 + w;
  const t = pick([3, 4, 5]);
  const ans = v * t;
  add(
    `無風のときの音の速さを秒速340mとします。風下に向かって秒速${w}mの風がふいているとき、その向きに音を出してから${t}秒後に、音は何m先まで届いていますか？`,
    ans,
    uniqShuffle4(ans, [340 * t, (340 - w) * t, ans + w]),
    `風下に向かう音の速さは、音の速さ＋風の速さ＝340＋${w}＝秒速${v}mになります。①きょり＝速さ×時間なので、②${v}×${t}＝${ans}mです。よって、答えは${ans}です。`,
    6, 4
  );
}

// ── モノコード（弦の性質、知識） ──
const monoChordFacts = [
  ['モノコードの弦を短くすると、音の高さはどうなる？', '高くなる', ['高くなる', '低くなる', '変わらない', '聞こえなくなる']],
  ['モノコードの弦を太くすると、音の高さはどうなる？', '低くなる', ['低くなる', '高くなる', '変わらない', '聞こえなくなる']],
  ['モノコードの弦を強く張ると、音の高さはどうなる？', '高くなる', ['高くなる', '低くなる', '変わらない', '聞こえなくなる']],
  ['モノコードの弦を強くはじくと、音の大きさはどうなる？', '大きくなる', ['大きくなる', '小さくなる', '変わらない', '高くなる']],
  ['音が空気中を伝わる速さと、水中を伝わる速さでは、どちらが速い？', '水中', ['水中', '空気中', '同じ', '伝わらない']],
  ['真空中（空気のない場所）で音は伝わる？', '伝わらない', ['伝わらない', '空気中より速く伝わる', '空気中と同じ速さで伝わる', '空気中よりおそく伝わる']],
];
monoChordFacts.forEach(([q, a, c]) => {
  add(q, a, c, 'モノコードでは、弦が短い・細い・強く張るほど音は高くなります。音の大きさは、弦をはじく強さ（振れ幅）で決まります。また音は空気などの気体より液体、液体より固体のほうが速く伝わり、真空中では伝わりません。よって、答えは' + a + 'です。', 5, 1);
});

data.push(...out);
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log(FILE, 'added', out.length, 'now', data.length);

// 検証
let problems = [];
const ids = data.map(x => x.id);
if (new Set(ids).size !== ids.length) problems.push('DUPLICATE IDS');
data.forEach(q => {
  if (!q.choices.includes(q.answer)) problems.push(q.id + ': answer not in choices');
  if (new Set(q.choices).size !== 4) problems.push(q.id + ': choices not unique/4');
});
console.log('problems:', problems.length);
problems.slice(0, 20).forEach(p => console.log(p));
