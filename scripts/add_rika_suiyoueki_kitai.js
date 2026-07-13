// rika_suiyoueki.json に「気体発生の比例計算（過酸化水素水＋二酸化マンガン→酸素）」の
// 新規オリジナル問題を追加
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'rika_suiyoueki.json');
const data = require(FILE);

function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function fmt(x) {
  x = Math.round(x * 100) / 100;
  if (Object.is(x, -0)) x = 0;
  return String(x);
}
function uniqShuffle4(correct, distractorPool) {
  const correctStr = fmt(correct);
  const set = new Set([correctStr]);
  const chosen = [];
  for (const v of distractorPool) {
    const d = fmt(v);
    if (!set.has(d) && Number(d) > 0) { set.add(d); chosen.push(d); }
    if (chosen.length >= 3) break;
  }
  let guard = 0;
  while (chosen.length < 3 && guard < 100) {
    guard++;
    const noise = fmt(Number(correctStr) + randInt(-20, 20) * (guard % 4 + 1) || 1);
    if (!set.has(noise) && Number(noise) > 0) { set.add(noise); chosen.push(noise); }
  }
  const all = [correctStr, ...chosen];
  for (let i = all.length - 1; i > 0; i--) { const j = randInt(0, i); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}

let nextNum = Math.max(...data.map(x => parseInt(x.id.replace('rs', '')))) + 1;
const out = [];
function add(question, answer, choices, meaning, grade, difficulty) {
  out.push({ id: 'rs' + (nextNum++), question, answer: String(answer), choices, meaning, grade, difficulty });
}

// ── 気体発生の比例計算（二酸化マンガンは十分にあるとし、過酸化水素水の重さと発生する酸素の体積は比例）──
for (let i = 0; i < 6; i++) {
  const w1 = pick([10, 20, 25, 30, 40, 50]);
  const o1 = w1 * pick([5, 8, 10]);
  const times = pick([2, 3, 4]);
  const w2 = w1 * times;
  const ans = o1 * times;
  add(
    `二酸化マンガンに、ある濃さの過酸化水素水${w1}gを加えると、酸素が最大${o1}cm³発生しました。同じ濃さの過酸化水素水を${w2}g使うと（二酸化マンガンは十分な量があるものとします）、発生する酸素は最大何cm³ですか？`,
    ans,
    uniqShuffle4(ans, [o1, o1 * (times - 1 || 1), ans / 2]),
    `二酸化マンガンが十分にあるとき、発生する酸素の体積は、加えた過酸化水素水の重さに比例します。①過酸化水素水の重さが${w1}gから${w2}gになったので、②${w2}÷${w1}＝${times}倍になったと分かります。③発生する酸素も${times}倍になるので、${o1}×${times}＝${ans}cm³です。よって、答えは${ans}です。`,
    6, 3
  );
}

// ── 表を読み取る比例計算（2点から比例定数を求める）──
for (let i = 0; i < 5; i++) {
  const w1 = pick([15, 20, 24, 30]);
  const rate = pick([6, 8, 10]);
  const o1 = w1 * rate;
  const w2 = pick([40, 45, 50, 60]);
  const ans = w2 * rate;
  add(
    `二酸化マンガン1gに、こさの異なる過酸化水素水を加えて、発生する酸素の最大体積を調べる実験をしました。過酸化水素水の重さが${w1}gのとき、酸素は最大${o1}cm³発生しました。同じこさの過酸化水素水を${w2}g使うと、発生する酸素は最大何cm³ですか？（酸素の体積は過酸化水素水の重さに比例するものとします）`,
    ans,
    uniqShuffle4(ans, [o1, o1 + (w2 - w1), ans / 2]),
    `酸素の体積は過酸化水素水の重さに比例するので、まず1gあたりに発生する酸素の体積を求めます。①${o1}÷${w1}＝${rate}cm³（1gあたり）。②過酸化水素水${w2}gでは、${rate}×${w2}＝${ans}cm³発生します。よって、答えは${ans}です。`,
    6, 4
  );
}

// ── 二酸化マンガンの重さ・性質（知識）──
const catalystFacts = [
  ['過酸化水素水に二酸化マンガンを加えると発生する気体は？', '酸素', ['酸素', '二酸化炭素', '水素', 'ちっ素']],
  ['過酸化水素水に二酸化マンガンを加えて酸素を発生させる実験のあと、二酸化マンガンの重さはどうなる？', '変化しない', ['変化しない', '軽くなる', '重くなる', 'すべて溶けてなくなる']],
  ['二酸化マンガンのように、それ自身は変化せず、他の物質の反応の速さを変えるはたらきをするものを何という？', '触媒', ['触媒', '溶媒', '指示薬', '中和剤']],
  ['二酸化マンガンを使わずに過酸化水素水だけを置いておくと、酸素の発生の仕方はどうなる？', '発生するのにかなり時間がかかる', ['発生するのにかなり時間がかかる', '酸素ではない別の気体が発生する', '二酸化マンガンを使ったときと同じ速さで発生する', '酸素は発生しない']],
  ['過酸化水素水を集めるとき、発生する酸素の集め方として最も適するのは？', '水上置換法', ['水上置換法', '上方置換法', '下方置換法', 'ろ過']],
  ['過酸化水素水の量を増やすと、発生する酸素の最大の体積はどうなる？（二酸化マンガンは十分にあるとする）', '多くなる', ['多くなる', '少なくなる', '変わらない', '0になる']],
];
catalystFacts.forEach(([q, a, c]) => {
  add(q, a, c, '過酸化水素水に二酸化マンガンを加えると酸素が発生します。二酸化マンガンはそれ自身は変化せず、反応の速さだけを変える触媒としてはたらくため、実験の前後で重さは変化しません。酸素は水に溶けにくいので水上置換法で集めます。よって、答えは' + a + 'です。', 5, 1);
});

data.push(...out);
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log(FILE, 'added', out.length, 'now', data.length);

let problems = [];
const ids = data.map(x => x.id);
if (new Set(ids).size !== ids.length) problems.push('DUPLICATE IDS');
data.forEach(q => {
  if (!q.choices.includes(q.answer)) problems.push(q.id + ': answer not in choices (' + q.answer + ' vs ' + JSON.stringify(q.choices) + ')');
  if (new Set(q.choices).size !== 4) problems.push(q.id + ': choices not unique/4');
});
console.log('problems:', problems.length);
problems.slice(0, 20).forEach(p => console.log(p));
