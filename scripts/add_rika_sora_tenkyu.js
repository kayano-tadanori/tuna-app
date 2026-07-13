// rika_sora.json に「天球（天の北極・天の赤道、緯度と北極星の高度）」
// 「月の公転周期の逆算」の新規オリジナル問題を追加
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'rika_sora.json');
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
    if (!set.has(d) && Number(d) > 0) { set.add(d); chosen.push(d); }
    if (chosen.length >= 3) break;
  }
  let guard = 0;
  while (chosen.length < 3 && guard < 100) {
    guard++;
    const noise = fmt(Number(correctStr) + randInt(-10, 10) * (guard % 4 + 1) || 1);
    if (!set.has(noise) && Number(noise) > 0 && Number(noise) < 90) { set.add(noise); chosen.push(noise); }
  }
  const all = [correctStr, ...chosen];
  for (let i = all.length - 1; i > 0; i--) { const j = randInt(0, i); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}

let nextNum = Math.max(...data.map(x => parseInt(x.id.replace('rk', '')))) + 1;
const out = [];
function add(question, answer, choices, meaning, grade, difficulty) {
  out.push({ id: 'rk' + (nextNum++), question, answer: String(answer), choices, meaning, grade, difficulty });
}

// ── 天球の基礎知識 ──
const tenkyuFacts = [
  ['観測者を中心として、星や太陽がはりついているように見える見かけ上の大きな球を何という？', '天球', ['天球', '天の川', '公転面', '黄道']],
  ['地球の地じくをそのまま北にのばして天球にぶつかる点を何という？', '天の北極', ['天の北極', '天の南極', '天頂', '天の赤道']],
  ['地球の赤道をそのまま広げて天球にぶつかる、天球上の大きな円を何という？', '天の赤道', ['天の赤道', '天の北極', '天頂', '黄道']],
  ['北極星は、天球上のどこに最も近い位置にある？', '天の北極', ['天の北極', '天の赤道', '天頂', '天の南極']],
  ['観測者の真上にあたる、天球上の点を何という？', '天頂', ['天頂', '天の北極', '天の赤道', '天の南極']],
];
tenkyuFacts.forEach(([q, a, c]) => {
  add(q, a, c, '観測者を中心とした見かけ上の球を天球といい、地じくの延長上に天の北極・天の南極、地球の赤道の延長上に天の赤道があります。観測者の真上の点は天頂とよばれ、北極星は天の北極のすぐ近くにあるため、1日じゅうほとんど動かないように見えます。よって、答えは' + a + 'です。', 6, 2);
});

// ── 北極星の高度＝観測地の緯度（順算） ──
for (let i = 0; i < 5; i++) {
  const lat = pick([25, 30, 33, 35, 38, 40, 43]);
  add(
    `北緯${lat}度の地点で北極星を観測すると、地平線からの高度はおよそ何度になりますか？`,
    lat,
    uniqShuffle4(lat, [90 - lat, lat + 10, lat - 10 > 0 ? lat - 10 : lat + 15]),
    `北極星が見える高度は、観測地の緯度とほぼ等しくなります。①観測地は北緯${lat}度なので、②北極星の高度もおよそ${lat}度になります。よって、答えは${lat}です。`,
    6, 2
  );
}

// ── 北極星の高度から緯度を逆算 ──
for (let i = 0; i < 5; i++) {
  const lat = pick([28, 32, 34, 36, 39, 41, 44]);
  add(
    `ある地点で北極星の高度を測定したところ、${lat}度でした。この地点の緯度はおよそ何度ですか？`,
    lat,
    uniqShuffle4(lat, [90 - lat, lat + 8, lat - 8 > 0 ? lat - 8 : lat + 12]),
    `北極星の高度は、その地点の緯度とほぼ等しくなります。①北極星の高度が${lat}度なので、②この地点の緯度もおよそ${lat}度と分かります。よって、答えは${lat}です。`,
    6, 3
  );
}

// ── 月の公転周期の逆算（満ち欠け周期と地球の公転から求める）──
// 公式: 1/恒星周期 = 1/満ち欠け周期(会合周期) + 1/地球の公転日数
// （月と地球はどちらも同じ向きに公転しているため、地球から見た満ち欠け周期は
//   月の公転周期よりも少し長くなる。差分を埋め合わせる関係として上の式が成り立つ）
for (let i = 0; i < 5; i++) {
  const synodic = pick([29, 29.5, 30, 30.5]);
  const year = 360; // 授業の慣例で1年を360日として計算する設定
  const sidereal = 1 / (1 / synodic + 1 / year);
  const ans = Math.round(sidereal * 10) / 10;
  add(
    `月が満ち欠けをくり返す周期（新月から次の新月まで）は${synodic}日です。地球が太陽のまわりを1周する日数を360日とするとき、月が地球のまわりを1周する公転周期は約何日ですか。小数第2位を四捨五入して、小数第1位まで答えなさい。（月と地球は同じ向きに公転しているものとします）`,
    fmt(ans),
    uniqShuffle4(ans, [synodic, synodic - 2, ans + 3]),
    `月の満ち欠けの周期（会合周期）は、月が地球のまわりを1周する公転周期（恒星周期）よりも少し長くなります。これは、月が地球を1周する間に、地球も太陽のまわりを少し公転してしまい、太陽・地球・月が同じならびになるまでにもう少し時間がかかるためです。①1÷${synodic}＋1÷360＝1÷（公転周期）という関係が成り立つので、②公転周期＝1÷（1÷${synodic}＋1÷360）を計算すると、約${fmt(ans)}日になります。よって、答えは${fmt(ans)}です。`,
    6, 4
  );
}

// ── 星の日周運動と年周運動の複合計算（天球の回転を使った角度問題） ──
for (let i = 0; i < 4; i++) {
  const hours = pick([2, 3, 4, 5]);
  const months = pick([1, 2, 3]);
  const dayAngle = hours * 15;
  const yearAngle = months * 30;
  const ans = dayAngle + yearAngle;
  add(
    `ある日の午後8時に、北の空のある星が北極星の真上（0度の位置）に見えました。この星を${months}か月後の同じ日に、${hours}時間おそい時こくに観察すると、北極星を中心にして何度回転した位置に見えますか？（1日の動き：1時間に15度、1か月の動き：30度、どちらも同じ向きに回転するものとします）`,
    ans,
    uniqShuffle4(ans, [dayAngle, yearAngle, ans - 30]),
    `星の見える位置は、1日の中での動き（日周運動）と、季節による動き（年周運動）を合わせて考えます。①日周運動は1時間に15度なので、15×${hours}＝${dayAngle}度。②年周運動は1か月に30度なので、30×${months}＝${yearAngle}度。③合わせて${dayAngle}＋${yearAngle}＝${ans}度回転した位置に見えます。よって、答えは${ans}です。`,
    6, 4
  );
}

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
