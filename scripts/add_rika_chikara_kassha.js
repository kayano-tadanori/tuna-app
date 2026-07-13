// rika_chikara.json に「滑車（定滑車・動滑車）」の新規オリジナル計算問題を追加
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'rika_chikara.json');
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
    const noise = fmt(Number(correctStr) + randInt(-15, 15) * (guard % 4 + 1) || 1);
    if (!set.has(noise) && Number(noise) > 0) { set.add(noise); chosen.push(noise); }
  }
  const all = [correctStr, ...chosen];
  for (let i = all.length - 1; i > 0; i--) { const j = randInt(0, i); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}

let nextNum = Math.max(...data.map(x => parseInt(x.id.replace('rc', '')))) + 1;
const out = [];
function add(question, answer, choices, meaning, grade, difficulty) {
  out.push({ id: 'rc' + (nextNum++), question, answer: String(answer), choices, meaning, grade, difficulty });
}

// ── 動滑車1個：引く力（重さの半分） ──
for (let i = 0; i < 5; i++) {
  const w = pick([20, 40, 60, 80, 100, 120, 140]);
  const ans = w / 2;
  add(
    `動滑車を1個使って、重さ${w}gのおもりを持ち上げます。ひもを引く力は何gですか？（動滑車自体の重さは考えません）`,
    fmt(ans),
    uniqShuffle4(ans, [w, w * 2, w / 4]),
    `動滑車を1個使うと、おもりを支えるひもが2本になるため、ひもを引く力はおもりの重さの半分ですみます。①${w}÷2＝${fmt(ans)}gです。よって、答えは${fmt(ans)}です。`,
    5, 2
  );
}

// ── 動滑車1個：引くひもの長さ（高さの2倍） ──
for (let i = 0; i < 5; i++) {
  const h = pick([5, 10, 15, 20, 25, 30]);
  const ans = h * 2;
  add(
    `動滑車を1個使って、おもりを${h}cm持ち上げます。ひもを引く長さは何cmですか？`,
    ans,
    uniqShuffle4(ans, [h, h / 2, h * 3]),
    `動滑車を使うと、ひもを引く力は半分になるかわりに、ひもを引く長さはおもりが持ち上がる高さの2倍必要になります。①${h}×2＝${ans}cmです。よって、答えは${ans}です。`,
    5, 2
  );
}

// ── 定滑車：引く力（重さと同じ、向きが変わるだけ） ──
for (let i = 0; i < 3; i++) {
  const w = pick([30, 50, 70, 90, 110]);
  add(
    `天じょうに固定した定滑車を1個使って、重さ${w}gのおもりを持ち上げます。ひもを引く力は何gですか？`,
    w,
    uniqShuffle4(w, [w / 2, w * 2, w + 10]),
    `定滑車は、力の向きを変えるだけのはたらきをする滑車で、ひもを引く力の大きさはおもりの重さと同じです。よって、答えは${w}です。`,
    4, 1
  );
}

// ── 動滑車2個：引く力（重さの4分の1） ──
for (let i = 0; i < 4; i++) {
  const w = pick([40, 80, 120, 160, 200]);
  const ans = w / 4;
  add(
    `動滑車を2個使って、重さ${w}gのおもりを持ち上げます。ひもを引く力は何gですか？（動滑車自体の重さは考えません）`,
    fmt(ans),
    uniqShuffle4(ans, [w / 2, w, w / 8]),
    `動滑車を2個使うと、おもりを支えるひもが4本になるため、ひもを引く力はおもりの重さの4分の1ですみます。①${w}÷4＝${fmt(ans)}gです。よって、答えは${fmt(ans)}です。`,
    6, 3
  );
}

// ── 動滑車2個：引くひもの長さ（高さの4倍） ──
for (let i = 0; i < 4; i++) {
  const h = pick([4, 8, 12, 16, 20]);
  const ans = h * 4;
  add(
    `動滑車を2個使って、おもりを${h}cm持ち上げます。ひもを引く長さは何cmですか？`,
    ans,
    uniqShuffle4(ans, [h * 2, h, h * 8]),
    `動滑車を2個使うと、ひもを引く力は4分の1になるかわりに、ひもを引く長さは持ち上げる高さの4倍必要になります。①${h}×4＝${ans}cmです。よって、答えは${ans}です。`,
    6, 3
  );
}

// ── 仕事の原理（検算）：動滑車1個 ──
for (let i = 0; i < 5; i++) {
  const w = pick([20, 40, 60, 80, 100]);
  const h = pick([5, 10, 15, 20]);
  const ans = w * h;
  add(
    `動滑車を1個使って、重さ${w}gのおもりを${h}cm持ち上げました。このとき「ひもを引く力×ひもを引いた長さ」で求められる仕事の大きさは何g・cmですか？`,
    ans,
    uniqShuffle4(ans, [ans / 2, ans * 2, w + h]),
    `動滑車を使うと、①ひもを引く力はおもりの重さの半分（${w}÷2＝${fmt(w / 2)}g）、②ひもを引く長さは高さの2倍（${h}×2＝${h * 2}cm）になります。③仕事の大きさは${fmt(w / 2)}×${h * 2}＝${ans}g・cmとなり、道具を使わず直接持ち上げたとき（${w}×${h}＝${ans}）と同じ値になります（仕事の原理）。よって、答えは${ans}です。`,
    6, 4
  );
}

// ── 動滑車＋定滑車の組み合わせ（力は動滑車の数だけで決まる） ──
for (let i = 0; i < 4; i++) {
  const w = pick([30, 60, 90, 120]);
  const ans = w / 2;
  add(
    `定滑車1個と動滑車1個を組み合わせて、重さ${w}gのおもりを持ち上げます。ひもを引く力は何gですか？（滑車自体の重さは考えません）`,
    fmt(ans),
    uniqShuffle4(ans, [w, w * 2, w / 4]),
    `定滑車は力の向きを変えるだけなので、力の大きさには関係しません。動滑車が1個ある分だけ、ひもを引く力はおもりの重さの半分になります。①${w}÷2＝${fmt(ans)}gです。よって、答えは${fmt(ans)}です。`,
    6, 3
  );
}

// ── 滑車の知識問題 ──
const kasshaFacts = [
  ['天じょうなどに固定されていて、ひもを引く力の向きを変えるだけの滑車を何という？', '定滑車', ['定滑車', '動滑車', '輪じく', 'てんびん']],
  ['滑車自体がおもりといっしょに上下に動く滑車を何という？', '動滑車', ['動滑車', '定滑車', '輪じく', 'てんびん']],
  ['動滑車を使うと、ひもを引く力の大きさはどうなる？', '軽くなる', ['軽くなる', '重くなる', '変わらない', '0になる']],
  ['動滑車を使うと、ひもを引く長さはどうなる？', '長くなる', ['長くなる', '短くなる', '変わらない', '0になる']],
  ['旗をポールの上まで揚げるときに使われている滑車は？', '定滑車', ['定滑車', '動滑車', '輪じく', 'てんびん']],
  ['クレーン車が重い荷物を小さい力でつり上げるのに主に使う滑車は？', '動滑車', ['動滑車', '定滑車', '輪じく', 'ばねはかり']],
  ['滑車やてこなどの道具を使っても変わらない、「力の大きさ×動かすきょり」の関係を何という？', '仕事の原理', ['仕事の原理', '浮力の原理', 'てこの原理', 'エネルギー保存の法則']],
];
kasshaFacts.forEach(([q, a, c]) => {
  add(q, a, c, '定滑車は力の向きを変えるだけで力の大きさは変わりません。動滑車はひもが2本になる分、引く力が軽くなるかわりに、引くひもの長さが長くなります。どちらの場合も「力の大きさ×動かすきょり」は変わらず、これを仕事の原理といいます。よって、答えは' + a + 'です。', 4, 1);
});

data.push(...out);
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log(FILE, 'added', out.length, 'now', data.length);

let problems = [];
const ids = data.map(x => x.id);
if (new Set(ids).size !== ids.length) problems.push('DUPLICATE IDS');
data.forEach(q => {
  if (!q.choices.includes(q.answer)) problems.push(q.id + ': answer not in choices');
  if (new Set(q.choices).size !== 4) problems.push(q.id + ': choices not unique/4');
});
console.log('problems:', problems.length);
problems.slice(0, 20).forEach(p => console.log(p));
