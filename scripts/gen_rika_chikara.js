// rika_chikara.json の拡張：
// 1) 既存240問すべてに choices（4択・正解含む）を追加する（既存データにはchoicesが無いバグの修正）
// 2) 各(学年×難易度)セルに新規20問ずつ（計240問）を追加し、全体を約2倍にする
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
  const correctStr = typeof correct === 'number' ? fmt(correct) : String(correct);
  const set = new Set([String(correctStr)]);
  const ds = distractorPool.map(v => typeof v === 'number' ? fmt(v) : String(v)).filter(d => !set.has(d));
  const chosen = [];
  for (const d of ds) {
    if (chosen.length >= 3) break;
    if (!set.has(d)) { set.add(d); chosen.push(d); }
  }
  let guard = 0;
  const numCorrect = Number(correctStr);
  while (chosen.length < 3 && guard < 200) {
    guard++;
    let noise;
    if (!isNaN(numCorrect) && String(correctStr).trim() !== '' && /^-?\d+(\.\d+)?$/.test(correctStr)) {
      noise = numCorrect + randInt(-20, 20) * (guard % 5 + 1);
      if (noise === numCorrect || noise <= 0) noise = numCorrect + guard + 1;
      noise = fmt(noise);
    } else {
      noise = String(correctStr).replace(/\d+(\.\d+)?/, m => {
        const isDec = m.includes('.');
        let v = parseFloat(m) + randInt(-20, 20) * (guard % 5 + 1);
        if (v <= 0) v = parseFloat(m) + guard + 1;
        if (isDec) v = Math.round(v * 10) / 10;
        return String(v);
      });
      if (noise === String(correctStr)) noise = String(correctStr) + '_';
    }
    if (!set.has(String(noise))) { set.add(String(noise)); chosen.push(String(noise)); }
  }
  const all = [String(correctStr), ...chosen];
  for (let i = all.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

// ================================================================
// STAGE 1: 既存240問に choices を追加
// ================================================================

// ---- 知識問題（固定文言）の choices 辞書 ----
const knowledgeChoices = {
  'ばねにおもりをつるすと、ばねののびはおもりの重さに（　）する。': ['比例', '反比例', '無関係', '反対'],
  '力の大きさをはかる道具は？': ['ばねはかり', '上皿てんびん', '温度計', '雨りょう計'],
  'てこで、棒を支えている点を何という？': ['支点', '力点', '作用点', '中心点'],
  'てこで、手で力を加える点を何という？': ['力点', '支点', '作用点', '重点'],
  'てこで、ものに力がはたらく点を何という？': ['作用点', '支点', '力点', '重心'],
  'シーソーは何のしくみを利用した道具？': ['てこ', '輪じく', 'かっ車', '浮力'],
  'ゴムをのばすと、元にもどろうとする力がはたらく。この力を利用した道具は？': ['ゴム動力の車', 'かっ車', 'てんびん', 'ばねはかり'],
  '上皿てんびんがつり合うのは、左右の何が等しいとき？': ['重さ', '体積', '色', '形'],
  'くぎぬきで、くぎに力がはたらく部分は？': ['作用点', '支点', '力点', '重心'],
  'はさみで厚紙を小さい力で切るには、刃のどこで切るとよい？': ['根もと', '先端', '真ん中', '持ち手'],

  'てこがつり合う条件は、左右で何が等しいとき？': ['おもりの重さ×支点からのきょり', 'おもりの重さだけ', '支点からのきょりだけ', 'おもりの体積×きょり'],
  'ピンセットの支点・力点・作用点のならび方は？': ['支点→力点→作用点', '支点→作用点→力点', '力点→支点→作用点', '作用点→支点→力点'],
  'くぎぬきが小さい力でくぎをぬける理由は？': ['支点から力点までが長いから', '支点から作用点までが長いから', 'くぎが軽いから', '力点が支点に近いから'],
  'せんぬきの3つの点のならび方は？': ['支点→作用点→力点', '支点→力点→作用点', '作用点→支点→力点', '力点→作用点→支点'],
  '実験用てこの左うで目盛り3に10gのおもり2個、右うで目盛り2に10gのおもり3個。てこはどうなる？': ['つり合う', '左に傾く', '右に傾く', '上下にゆれ続ける'],
  '空気中でばねはかりにつるした100gの物体を水の中に入れると、目盛りは？': ['100gより小さくなる', '100gより大きくなる', '変わらず100g', '0gになる'],
  '台ばかり（キッチンスケール）の中に使われているものは？': ['ばね', 'かっ車', '輪じく', '磁石'],

  'ドライバーでねじを回す道具は、何のしくみを利用している？': ['輪じく', 'てこ', 'かっ車', '浮力'],
  '動かっ車を1個使って荷物を持ち上げると、引く力は？': ['半分になる', '2倍になる', '変わらない', '4分の1になる'],
  '定かっ車のはたらきは？': ['力の向きを変える', '力の大きさを半分にする', '力の大きさを2倍にする', '力をなくす'],
  'さおばかりは何のしくみを利用している？': ['てこ', '輪じく', 'かっ車', '浮力'],
  '自転車のペダルとギアは何のしくみ？': ['輪じく', 'てこ', 'かっ車', 'ばね'],

  '定かっ車を使うと、引く力の大きさは？': ['変わらない', '半分になる', '2倍になる', '4分の1になる'],
  '動かっ車1個で荷物を1m持ち上げるとき、ひもを引く長さは？': ['2m', '1m', '0.5m', '4m'],
  '輪じくとは、大きい輪と小さい（　）を組み合わせた道具。': ['じく', 'ばね', '支点', '歯車'],
  '旗をポールの上まで揚げるときに使われているかっ車は？': ['定かっ車', '動かっ車', '輪じく', 'てんびん'],
  'クレーン車が重い荷物を小さい力でつり上げるのに使うかっ車は？': ['動かっ車', '定かっ車', '輪じく', 'ばねはかり'],
  'ばねはかりが利用しているばねの性質は？': ['のびが力に比例する', 'のびが力に反比例する', 'ちぢみが力に比例する', 'のびが一定である'],
  'てこの3つの点のうち、位置を変えられない道具はどれ？': ['どの道具にも3つの点がある', '支点がない道具もある', '力点がない道具もある', '作用点がない道具もある'],

  '動かっ車を使うと力は半分になるが、そのかわりに？': ['引く長さが2倍になる', '引く長さが半分になる', '力の向きが変わる', '何も変わらない'],
  '実験用てこで、うでが水平になってつり合ったときに等しいのは左右の？': ['おもりの重さ×目盛りの数', 'おもりの重さだけ', '目盛りの数だけ', 'おもりの個数だけ'],
  '同じばねを2本並列にすると、同じおもりをつるしたときののびは1本のときの？': ['半分', '2倍', '同じ', '4分の1'],
  'てんびんとてこに共通するしくみは？': ['支点を中心としたつり合い', '浮力のつり合い', '磁力のつり合い', '気圧のつり合い'],
  '棒はかり（さおばかり）で重いものをはかるには、分銅を支点から？': ['遠ざける', '近づける', 'はずす', '2個にする'],

  '水の中の物体にはたらく上向きの力を何という？': ['浮力', '重力', '摩擦力', '弾性力'],
  '動かっ車を2個使うと、引く力は元の何分の一？': ['4分の1', '2分の1', '8分の1', '3分の1'],
  '輪じくで小さい力で回すには、力を加えるのは？': ['大きい輪', '小さいじく', '支点', '中心'],
  'かっ車を組み合わせて使う利点は？': ['小さい力で持ち上げられて向きも変えられる', '力が2倍になる', '重さがなくなる', '浮力が発生する'],
  'ばねはかりと上皿てんびん、月面で表示が変わるのは？': ['ばねはかり', '上皿てんびん', 'どちらも変わる', 'どちらも変わらない'],

  '浮力の向きは？': ['上向き', '下向き', '横向き', '向きはない'],
  '水に浮かんで静止している物体では、浮力と何がつり合っている？': ['物体の重さ', '水の重さ', '空気の重さ', '摩擦力'],
  '木が水に浮くのは、同じ体積の水とくらべて？': ['軽いから', '重いから', '同じ重さだから', '色がちがうから'],
  '鉄の船が水に浮くことができる理由は？': ['中が空どうで全体として水より軽いから', '鉄が水に浮く性質だから', '浮力が発生しないから', '船の形が丸いから'],
  '氷が水に浮くとき、水面より上に出ているのは全体のおよそ？': ['10分の1', '2分の1', '3分の1', '4分の1'],
  '海水（食塩水）ではまっすぐな水よりも体が浮きやすい理由は？': ['浮力が大きくなるから', '浮力が小さくなるから', '重さが軽くなるから', '体積が増えるから'],
  '水中で石を持つと軽く感じる理由は？': ['浮力がはたらくから', '水圧がないから', '重さが減るから', '水が支えないから'],

  '物体を水にしずめたとき、浮力の大きさと等しいのは？': ['おしのけた水の重さ', '物体の重さ', '水そう全体の重さ', '物体の体積の数値'],
  '同じ物体を深くしずめると、浮力は？': ['変わらない', '大きくなる', '小さくなる', '0になる'],
  '太さが一様な棒の重心はどこにある？': ['棒の真ん中', '棒の一方のはし', '支点の位置', '両はし'],
  '仕事の原理とは、道具を使っても変わらないものは何？': ['力×動かすきょり', '力の大きさだけ', '動かすきょりだけ', '時間だけ'],
  '100gの物体にはたらく重力を1として、月面では約いくつ？': ['6分の1', '2分の1', '3分の1', '10分の1'],
};

let assigned = 0;
let unmatched = [];

for (const q of data) {
  if (knowledgeChoices[q.question]) {
    const choices = knowledgeChoices[q.question];
    if (!choices.includes(q.answer)) throw new Error('知識辞書の答え不一致: ' + q.id);
    q.choices = choices.slice();
    assigned++;
    continue;
  }
  let m;
  const t = q.question;

  // T1: 10gのおもりをつるすと2cmのびるばねがあります。30gのおもりでは何cmのびる？
  if ((m = t.match(/^(\d+)gのおもりをつるすと(\d+)cmのびるばねがあります。(\d+)gのおもりでは何cmのびる？$/))) {
    const [_, w1, e1, w2] = m.map(Number);
    const ans = e1 * w2 / w1;
    q.choices = uniqShuffle4(ans, [e1 * w1 / w2, e1 * w2, ans * 2]);
    assigned++; continue;
  }
  // T1b: 20gで3cmのびるばねがあります。60gでは何cmのびる？
  if ((m = t.match(/^(\d+)gで(\d+)cmのびるばねがあります。(\d+)gでは何cmのびる？$/))) {
    const [_, w1, e1, w2] = m.map(Number);
    const ans = e1 * w2 / w1;
    q.choices = uniqShuffle4(ans, [e1 * w1 / w2, e1 * w2, ans / 2]);
    assigned++; continue;
  }
  // T1c: 25gで2cmのびるばね。100gでは何cmのびる？（小数も可）
  if ((m = t.match(/^(\d+)gで(\d+)cmのびるばね。(\d+)gでは何cmのびる？（小数も可）$/))) {
    const [_, w1, e1, w2] = m.map(Number);
    const ans = e1 * w2 / w1;
    q.choices = uniqShuffle4(ans, [e1 * w1 / w2, e1 * w2, ans + w1]);
    assigned++; continue;
  }
  // T2: 自然の長さ10cmのばねは、10gで1cmのびます。20gをつるすとばね全体の長さは何cm？
  if ((m = t.match(/^自然の長さ(\d+)cmのばねは、(\d+)gで(\d+)cmのびます。(\d+)gをつるすとばね全体の長さは何cm？$/))) {
    const [_, nat, w1, e1, w2] = m.map(Number);
    const ext = e1 * w2 / w1;
    const ans = nat + ext;
    q.choices = uniqShuffle4(ans, [nat + e1 * w1 / w2, ext, nat - ext]);
    assigned++; continue;
  }
  // T2b: 自然の長さ10cmのばねは20gで2cmのびます。60gをつるすと全体の長さは？
  if ((m = t.match(/^自然の長さ(\d+)cmのばねは(\d+)gで(\d+)cmのびます。(\d+)gをつるすと全体の長さは？$/))) {
    const [_, nat, w1, e1, w2] = m.map(Number);
    const ext = e1 * w2 / w1;
    const ans = nat + ext;
    q.choices = uniqShuffle4(ans, [nat + e1 * w1 / w2, ext, nat - ext]);
    assigned++; continue;
  }
  // T3: てこがつり合っています。支点から左に4cmの位置に30gのおもり。支点から右に6cmの位置には何gのおもりがある？
  if ((m = t.match(/^てこがつり合っています。支点から左に(\d+)cmの位置に(\d+)gのおもり。支点から右に(\d+)cmの位置には何gのおもりがある？$/))) {
    const [_, d1, w1, d2] = m.map(Number);
    const ans = w1 * d1 / d2;
    q.choices = uniqShuffle4(ans, [w1 * d2 / d1, w1 * d1, w1 * d2]);
    assigned++; continue;
  }
  // T4: てこがつり合っています。支点から左4cmに30g。右側の20gのおもりは支点から何cmの位置？
  if ((m = t.match(/^てこがつり合っています。支点から左(\d+)cmに(\d+)g。右側の(\d+)gのおもりは支点から何cmの位置？$/))) {
    const [_, d1, w1, w2] = m.map(Number);
    const ans = w1 * d1 / w2;
    q.choices = uniqShuffle4(ans, [w2 * d1 / w1, d1, ans * 2]);
    assigned++; continue;
  }
  // T4c: てこの支点から左6cmに20g。右4cmに何gでつり合う？
  if ((m = t.match(/^てこの支点から左(\d+)cmに(\d+)g。右(\d+)cmに何gでつり合う？$/))) {
    const [_, d1, w1, d2] = m.map(Number);
    const ans = w1 * d1 / d2;
    q.choices = uniqShuffle4(ans, [w1 * d2 / d1, w1 * d1, w1 * d2]);
    assigned++; continue;
  }
  // T4d: 支点から左4cmに45gのおもり。右側の20gは支点から何cmでつり合う？
  if ((m = t.match(/^支点から左(\d+)cmに(\d+)gのおもり。右側の(\d+)gは支点から何cmでつり合う？$/))) {
    const [_, d1, w1, w2] = m.map(Number);
    const ans = w1 * d1 / w2;
    q.choices = uniqShuffle4(ans, [w2 * d1 / w1, d1, ans * 2]);
    assigned++; continue;
  }
  // T5: 支点の左に2つのおもり：20g（3cm）と10g（6cm）。右の4cmの位置に何gでつり合う？
  if ((m = t.match(/^支点の左に2つのおもり：(\d+)g（(\d+)cm）と(\d+)g（(\d+)cm）。右の(\d+)cmの位置に何gでつり合う？$/))) {
    const [_, w1, d1, w2, d2, d3] = m.map(Number);
    const ans = (w1 * d1 + w2 * d2) / d3;
    q.choices = uniqShuffle4(ans, [(w1 * d1 - w2 * d2) / d3, w1 + w2, (w1 * d1 + w2 * d2) / (d3 * 2)]);
    assigned++; continue;
  }
  // T5b: 支点の左に30g（6cm）と20g（3cm）の2つのおもり。右の8cmの位置に何gでつり合う？
  if ((m = t.match(/^支点の左に(\d+)g（(\d+)cm）と(\d+)g（(\d+)cm）の2つのおもり。右の(\d+)cmの位置に何gでつり合う？$/))) {
    const [_, w1, d1, w2, d2, d3] = m.map(Number);
    const ans = (w1 * d1 + w2 * d2) / d3;
    q.choices = uniqShuffle4(ans, [(w1 * d1 - w2 * d2) / d3, w1 + w2, (w1 * d1 + w2 * d2) / (d3 * 2)]);
    assigned++; continue;
  }
  // T5c: 支点の左に20g（4cm）と30g（2cm）。右10cmには何gでつり合う？
  if ((m = t.match(/^支点の左に(\d+)g（(\d+)cm）と(\d+)g（(\d+)cm）。右(\d+)cmには何gでつり合う？$/))) {
    const [_, w1, d1, w2, d2, d3] = m.map(Number);
    const ans = (w1 * d1 + w2 * d2) / d3;
    q.choices = uniqShuffle4(ans, [(w1 * d1 - w2 * d2) / d3, w1 + w2, (w1 * d1 + w2 * d2) / (d3 * 2)]);
    assigned++; continue;
  }
  // T6: 同じばね2本をたてにつなぎ（直列）、10gのおもりをつるすと、ばね1本は1cmのびます。2本全体では何cmのびる？
  if ((m = t.match(/^同じばね2本をたてにつなぎ（直列）、(\d+)gのおもりをつるすと、ばね1本は(\d+)cmのびます。2本全体では何cmのびる？$/))) {
    const [_, w, e] = m.map(Number);
    const ans = e * 2;
    q.choices = uniqShuffle4(ans, [e, e * 3, e / 2]);
    assigned++; continue;
  }
  // T7: 100gの荷物を動かっ車1個で持ち上げます。ひもを引く力は何g？（かっ車やひもの重さは考えない）
  if ((m = t.match(/^(\d+)gの荷物を動かっ車1個で持ち上げます。ひもを引く力は何g？（かっ車やひもの重さは考えない）$/))) {
    const [_, w] = m.map(Number);
    const ans = w / 2;
    q.choices = uniqShuffle4(ans, [w, w / 4, w * 2]);
    assigned++; continue;
  }
  // T7b: 300gの荷物を動かっ車1個で持ち上げるとき、ひもを引く力は何g？（かっ車の重さは考えない）
  if ((m = t.match(/^(\d+)gの荷物を動かっ車1個で持ち上げるとき、ひもを引く力は何g？（かっ車の重さは考えない）$/))) {
    const [_, w] = m.map(Number);
    const ans = w / 2;
    q.choices = uniqShuffle4(ans, [w, w / 4, w * 2]);
    assigned++; continue;
  }
  // T8: 実験用てこの左うで目盛り3に同じおもりを4個つるしました。右うで目盛り6には何個つるすとつり合う？
  if ((m = t.match(/^実験用てこの左うで目盛り(\d+)に同じおもりを(\d+)個つるしました。右うで目盛り(\d+)には何個つるすとつり合う？$/))) {
    const [_, d1, n1, d2] = m.map(Number);
    const ans = d1 * n1 / d2;
    q.choices = uniqShuffle4(ans, [d2 * n1 / d1, n1, ans + 1]);
    assigned++; continue;
  }
  // T9: 同じばね2本を横にならべて（並列）、100gのおもりをつるしました。ばね1本にかかる力は何g？
  if ((m = t.match(/^同じばね2本を横にならべて（並列）、(\d+)gのおもりをつるしました。ばね1本にかかる力は何g？$/))) {
    const [_, w] = m.map(Number);
    const ans = w / 2;
    q.choices = uniqShuffle4(ans, [w, w / 4, w * 2]);
    assigned++; continue;
  }
  // T10: 200gの荷物を、動かっ車1個と定かっ車1個を組み合わせて持ち上げます。ひもを引く力は何g？
  if ((m = t.match(/^(\d+)gの荷物を、動かっ車1個と定かっ車1個を組み合わせて持ち上げます。ひもを引く力は何g？$/))) {
    const [_, w] = m.map(Number);
    const ans = w / 2;
    q.choices = uniqShuffle4(ans, [w, w / 4, w * 2]);
    assigned++; continue;
  }
  // T11: 同じばね2本を直列につないで30gをつるしました。このばねは1本だと10gで2cmのびます。全体ののびは何cm？
  if ((m = t.match(/^同じばね2本を直列につないで(\d+)gをつるしました。このばねは1本だと(\d+)gで(\d+)cmのびます。全体ののびは何cm？$/))) {
    const [_, wt, wu, eu] = m.map(Number);
    const per = eu * wt / wu;
    const ans = per * 2;
    q.choices = uniqShuffle4(ans, [per, eu, ans / 2]);
    assigned++; continue;
  }
  // T12: 輪じくがあります。半径10cmのじくに60gのおもり。半径30cmの輪を引く力は何gでつり合う？
  if ((m = t.match(/^輪じくがあります。半径(\d+)cmのじくに(\d+)gのおもり。半径(\d+)cmの輪を引く力は何gでつり合う？$/))) {
    const [_, rj, w, rw] = m.map(Number);
    const ans = w * rj / rw;
    q.choices = uniqShuffle4(ans, [w * rw / rj, w, ans * 2]);
    assigned++; continue;
  }
  // T12b: 輪じくのじく（半径10cm）に40gのおもりをつるしました。輪（半径20cm）を引く力は何g？
  if ((m = t.match(/^輪じくのじく（半径(\d+)cm）に(\d+)gのおもりをつるしました。輪（半径(\d+)cm）を引く力は何g？$/))) {
    const [_, rj, w, rw] = m.map(Number);
    const ans = w * rj / rw;
    q.choices = uniqShuffle4(ans, [w * rw / rj, w, ans * 2]);
    assigned++; continue;
  }
  // T12c: 輪じくのじく（半径10cm）に90g。輪（半径30cm）を引く力は何g？
  if ((m = t.match(/^輪じくのじく（半径(\d+)cm）に(\d+)g。輪（半径(\d+)cm）を引く力は何g？$/))) {
    const [_, rj, w, rw] = m.map(Number);
    const ans = w * rj / rw;
    q.choices = uniqShuffle4(ans, [w * rw / rj, w, ans * 2]);
    assigned++; continue;
  }
  // T12d: 輪じくのじく（半径10cm）に90gのおもり。輪（半径30cm）を引く力は何g？
  if ((m = t.match(/^輪じくのじく（半径(\d+)cm）に(\d+)gのおもり。輪（半径(\d+)cm）を引く力は何g？$/))) {
    const [_, rj, w, rw] = m.map(Number);
    const ans = w * rj / rw;
    q.choices = uniqShuffle4(ans, [w * rw / rj, w, ans * 2]);
    assigned++; continue;
  }
  // T12e: 輪じくのじく（半径10cm）に600gの荷物をつるし、輪（半径30cm）にひもをかけて引きます。引く力は何g？
  if ((m = t.match(/^輪じくのじく（半径(\d+)cm）に(\d+)gの荷物をつるし、輪（半径(\d+)cm）にひもをかけて引きます。引く力は何g？$/))) {
    const [_, rj, w, rw] = m.map(Number);
    const ans = w * rj / rw;
    q.choices = uniqShuffle4(ans, [w * rw / rj, w, ans * 2]);
    assigned++; continue;
  }
  // T13: 200gの荷物を動かっ車2個を使って持ち上げます。ひもを引く力は何g？（かっ車の重さは考えない）
  if ((m = t.match(/^(\d+)gの荷物を動かっ車2個を使って持ち上げます。ひもを引く力は何g？（かっ車の重さは考えない）$/))) {
    const [_, w] = m.map(Number);
    const ans = w / 4;
    q.choices = uniqShuffle4(ans, [w / 2, w, w / 8]);
    assigned++; continue;
  }
  // T13b: 400gの荷物を動かっ車2個と定かっ車1個を組み合わせて持ち上げます。ひもを引く力は何g？
  if ((m = t.match(/^(\d+)gの荷物を動かっ車2個と定かっ車1個を組み合わせて持ち上げます。ひもを引く力は何g？$/))) {
    const [_, w] = m.map(Number);
    const ans = w / 4;
    q.choices = uniqShuffle4(ans, [w / 2, w, w / 8]);
    assigned++; continue;
  }
  // T14: 動かっ車1個を使って荷物を2m持ち上げます。ひもを引く長さは何m？（小数も可）
  if ((m = t.match(/^動かっ車1個を使って荷物を([\d.]+)m持ち上げます。ひもを引く長さは何m？（小数も可）$/))) {
    const dist = Number(m[1]);
    const ans = dist * 2;
    q.choices = uniqShuffle4(ans, [dist, dist * 4, dist / 2]);
    assigned++; continue;
  }
  // T14b: 動かっ車1個で荷物を3m持ち上げるには、ひもを何m引く必要がある？（小数も可）
  if ((m = t.match(/^動かっ車1個で荷物を([\d.]+)m持ち上げるには、ひもを何m引く必要がある？（小数も可）$/))) {
    const dist = Number(m[1]);
    const ans = dist * 2;
    q.choices = uniqShuffle4(ans, [dist, dist * 4, dist / 2]);
    assigned++; continue;
  }
  // T15: 長さ60cmの軽い棒の左はしが支点です。右はしに20gのおもり。支点から30cmの位置を上向きに何gの力で支えるとつり合う？
  if ((m = t.match(/^長さ(\d+)cmの軽い棒の左はしが支点です。右はしに(\d+)gのおもり。支点から(\d+)cmの位置を上向きに何gの力で支えるとつり合う？$/))) {
    const [_, L, w, d] = m.map(Number);
    const ans = w * L / d;
    q.choices = uniqShuffle4(ans, [w * d / L, w, ans / 2]);
    assigned++; continue;
  }
  // T16: 10gで1cmのびるばねAと、10gで2cmのびるばねBを直列につなぎ、30gのおもりをつるしました。全体ののびは何cm？
  if ((m = t.match(/^(\d+)gで(\d+)cmのびるばねAと、(\d+)gで(\d+)cmのびるばねBを直列につなぎ、(\d+)gのおもりをつるしました。全体ののびは何cm？$/))) {
    const [_, wA, eA, wB, eB, wt] = m.map(Number);
    const extA = eA * wt / wA, extB = eB * wt / wB;
    const ans = extA + extB;
    q.choices = uniqShuffle4(ans, [extA, extB, Math.abs(extA - extB)]);
    assigned++; continue;
  }
  // T17: ある物体の重さは空気中で100g、水中では70gでした。この物体にはたらく浮力は何g？
  if ((m = t.match(/^ある物体の重さは空気中で(\d+)g、水中では(\d+)gでした。この物体にはたらく浮力は何g？$/))) {
    const [_, air, water] = m.map(Number);
    const ans = air - water;
    q.choices = uniqShuffle4(ans, [air + water, air, water]);
    assigned++; continue;
  }
  // T18: 体積50cm³の物体を水の中に完全にしずめました。この物体にはたらく浮力は何g分？（水1cm³＝1g）
  if ((m = t.match(/^体積(\d+)cm³の物体を水の中に完全にしずめました。この物体にはたらく浮力は何g分？（水1cm³＝1g）$/))) {
    const [_, v] = m.map(Number);
    const ans = v;
    q.choices = uniqShuffle4(ans, [v * 2, v / 2, v + 10]);
    assigned++; continue;
  }
  // T19: 長さ100cm・重さ100gの太さが一様な棒があります。左はしから40cmの位置を支点にすると、左はしに何gのおもりをつるすとつり合う？（棒の重さは中央にかかる）
  if ((m = t.match(/^長さ(\d+)cm・重さ(\d+)gの太さが一様な棒があります。左はしから(\d+)cmの位置を支点にすると、左はしに何gのおもりをつるすとつり合う？（棒の重さは中央にかかる）$/))) {
    const [_, L, W, d] = m.map(Number);
    const ans = W * (L / 2 - d) / d;
    q.choices = uniqShuffle4(ans, [W * (L / 2 + d) / d, W, ans * 2]);
    assigned++; continue;
  }
  // T20: 重さ80gの木片が水に浮かんで静止しています。木片がおしのけている水は何cm³？（水1cm³＝1g）
  if ((m = t.match(/^重さ(\d+)gの木片が水に浮かんで静止しています。木片がおしのけている水は何cm³？（水1cm³＝1g）$/))) {
    const [_, w] = m.map(Number);
    const ans = w;
    q.choices = uniqShuffle4(ans, [w * 2, w / 2, w + 15]);
    assigned++; continue;
  }
  // T21: 体積100cm³・重さ180gの物体を水中に完全にしずめて、ばねはかりでつるしました。ばねはかりの目盛りは何g？
  if ((m = t.match(/^体積(\d+)cm³・重さ(\d+)gの物体を水中に完全にしずめて、ばねはかりでつるしました。ばねはかりの目盛りは何g？$/))) {
    const [_, v, w] = m.map(Number);
    const ans = w - v;
    q.choices = uniqShuffle4(ans, [w + v, w, v]);
    assigned++; continue;
  }
  // T22: 支点の左5cmに60g、右5cmに40gがあります。さらに右側に20gを置いてつり合わせるには、支点から何cmの位置？
  if ((m = t.match(/^支点の左(\d+)cmに(\d+)g、右(\d+)cmに(\d+)gがあります。さらに右側に(\d+)gを置いてつり合わせるには、支点から何cmの位置？$/))) {
    const [_, dL, wL, dR, wR, wN] = m.map(Number);
    const ans = (wL * dL - wR * dR) / wN;
    q.choices = uniqShuffle4(ans, [(wL * dL + wR * dR) / wN, ans * 2, ans / 2]);
    assigned++; continue;
  }
  // T23: 長さ60cm・重さ60gの一様な棒の左はしが支点です。右はしに30gのおもりをつるしました。右はしを上向きに持ち上げる力は何g？
  if ((m = t.match(/^長さ(\d+)cm・重さ(\d+)gの一様な棒の左はしが支点です。右はしに(\d+)gのおもりをつるしました。右はしを上向きに持ち上げる力は何g？$/))) {
    const [_, L, Wrod, Wobj] = m.map(Number);
    const ans = Wrod / 2 + Wobj;
    q.choices = uniqShuffle4(ans, [Wrod + Wobj, Wobj, Wrod / 2]);
    assigned++; continue;
  }
  // T24: 1cm³あたり0.6gの木片200cm³が水に浮かんでいます。水中にしずんでいる部分の体積は何cm³？
  if ((m = t.match(/^1cm³あたり([\d.]+)gの木片(\d+)cm³が水に浮かんでいます。水中にしずんでいる部分の体積は何cm³？$/))) {
    const density = Number(m[1]), vol = Number(m[2]);
    const ans = density * vol;
    q.choices = uniqShuffle4(ans, [vol, vol - ans, ans / 2]);
    assigned++; continue;
  }

  unmatched.push(q.id + ': ' + q.question);
}

if (unmatched.length) {
  console.log('未一致の既存問題:', unmatched.length);
  unmatched.forEach(u => console.log(' -', u));
  throw new Error('既存問題に choices を割り当てられないものがあります');
}
console.log('既存240問への choices 割り当て完了:', assigned);

// ================================================================
// STAGE 2: 新規問題の生成（各セル20問ずつ、計240問）
// ================================================================

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }

function genUnique(genFn, n, seenGlobal) {
  const out = [];
  let tries = 0;
  while (out.length < n && tries < 30000) {
    tries++;
    const r = genFn();
    if (!r) continue;
    if (seenGlobal.has(r.question)) continue;
    seenGlobal.add(r.question);
    out.push(r);
  }
  if (out.length < n) throw new Error(`生成不足: ${n}問中${out.length}問 (${genFn.name})`);
  return out;
}

// 支点からのきょり×重さ型の「整数保証」パラメータ生成: ans = k*keep, other = k*divisorSide
function ratioParams(divRange, keepRange, kRange) {
  const divisor = randInt(divRange[0], divRange[1]);
  const keep = randInt(keepRange[0], keepRange[1]);
  const k = randInt(kRange[0], kRange[1]);
  return { divisor, keep, other: k * divisor, ans: k * keep, k };
}

// 3つのおもりのモーメント合成: w1*d1 + w2*d2 = ans*d3 となるように整数保証
function threeWeightParams() {
  const w1 = randInt(2, 18) * 5;
  const w2 = randInt(2, 18) * 5;
  const d1 = randInt(2, 9);
  const d2 = randInt(2, 9);
  if (d1 === d2) return null;
  const moment = w1 * d1 + w2 * d2;
  const divs = [];
  for (let i = 2; i <= 12; i++) {
    if (moment % i === 0 && i !== d1 && i !== d2) divs.push(i);
  }
  if (!divs.length) return null;
  const d3 = pick(divs);
  const ans = moment / d3;
  if (ans <= 0 || ans > 500) return null;
  return { w1, d1, w2, d2, d3, ans, moment };
}

// モーメントの差（左-右）= ans*wNew となるように整数保証
function momentDiffParams() {
  const wKnown1 = randInt(4, 20) * 5; // 既知側1
  const dKnown1 = randInt(2, 9);
  const wKnown2 = randInt(2, 12) * 5; // 既知側2（反対側）
  const dKnown2 = randInt(2, 9);
  const diff = wKnown1 * dKnown1 - wKnown2 * dKnown2;
  if (diff <= 0) return null;
  const divs = [];
  for (let i = 2; i <= 60; i++) if (diff % i === 0) divs.push(i);
  if (!divs.length) return null;
  const wNew = pick(divs.filter(d => d >= 5 && d <= 60));
  if (!wNew) return null;
  const ans = diff / wNew;
  if (ans <= 0 || ans > 30) return null;
  return { wKnown1, dKnown1, wKnown2, dKnown2, wNew, ans };
}

const seenGlobal = new Set(data.map(q => q.question));
let idCounter = Math.max(...data.map(q => Number(q.id.replace(/\D/g, '')))) + 1;
const prefix = data[0].id.replace(/\d+$/, '');
const newItems = [];

function pushItems(items, grade, difficulty) {
  items.forEach(it => {
    newItems.push({
      id: `${prefix}${String(idCounter).padStart(3, '0')}`,
      question: it.question,
      answer: it.answer,
      choices: it.choices,
      meaning: it.meaning,
      grade, difficulty,
    });
    idCounter++;
  });
}

function fromKnowledge(list) {
  return list.map(k => ({ question: k[0], answer: k[1], choices: k[2], meaning: k[1] }));
}

// ============ 小4 d1 ============
function typeSpringCompare4() {
  const w = pick([10, 20, 25, 50]);
  const a = randInt(1, 9);
  let b = randInt(1, 9);
  if (b === a) b = a === 9 ? a - 1 : a + 1;
  const bigger = a > b ? 'ばねA' : 'ばねB';
  const smaller = a > b ? 'ばねB' : 'ばねA';
  return {
    question: `ばねAは${w}gで${a}cmのび、ばねBは${w}gで${b}cmのびます。同じ重さのおもりをつるしたとき、大きくのびるのはどちら？`,
    answer: bigger,
    meaning: `${a}cmと${b}cmをくらべて、大きい方（${bigger}）がよくのびる＝やわらかいばね`,
    choices: uniqShuffle4(bigger, [smaller, 'どちらも同じ', 'どちらものびない']),
  };
}
function typeTotalLengthReverse4() {
  const w1 = pick([10, 20, 25]);
  const e1 = randInt(1, 5);
  const w2 = w1 * randInt(2, 5);
  const ext2 = e1 * w2 / w1;
  const natural = randInt(5, 20);
  const total = natural + ext2;
  const ans = natural;
  return {
    question: `${w1}gで${e1}cmのびるばねに${w2}gをつるすと全体の長さは${total}cmでした。このばねの自然の長さは何cm？`,
    answer: String(ans),
    meaning: `${w2}gでの伸び${ext2}cmを引く：${total}－${ext2}＝${ans}cm`,
    choices: uniqShuffle4(ans, [total, ext2, ans + ext2 / 2]),
  };
}
const g4d1Knowledge = [
  ['ばねののびとおもりの重さの関係をグラフに表すと、どんな形になる？', '原点を通る直線', ['原点を通る直線', '曲線', '水平な直線', 'ジグザグの線']],
  ['力の大きさの単位としてよく使われるものは？', 'g（グラム）', ['g（グラム）', 'cm（センチメートル）', '℃（度）', 'mL（ミリリットル）']],
  ['てこを使う目的として正しいのは？', '小さい力で大きい力を出すこと', ['小さい力で大きい力を出すこと', '重さをなくすこと', '形を変えること', '色を変えること']],
  ['ペンチで太い針金を切るとき、支点に近いところで切ると？', '小さい力で切れる', ['小さい力で切れる', '大きい力が必要になる', '切れない', '力は変わらない']],
  ['ばねを引っぱりすぎて、元の長さにもどらなくなることがある。これは何をこえたため？', 'ばねののびる限界（弾性の限界）', ['ばねののびる限界（弾性の限界）', 'ばねの重さ', '支点の位置', '力点の位置']],
  ['同じおもりをつるしたとき、やわらかいばねと硬いばねでは、どちらが大きくのびる？', 'やわらかいばね', ['やわらかいばね', '硬いばね', 'どちらも同じ', 'のびない']],
  ['てこの3点（支点・力点・作用点）のうち、力を加える人が実際に手をふれるのは？', '力点', ['力点', '支点', '作用点', '重心']],
];

// ============ 小4 d2 ============
function typeLeverUnknownLeft4() {
  const { divisor: dL, keep: dR, other: wR, ans } = ratioParams([2, 9], [2, 9], [2, 12]);
  return {
    question: `てこがつり合っています。支点から右に${dR}cmの位置に${wR}gのおもり。支点から左に${dL}cmの位置には何gのおもりがある？`,
    answer: String(ans),
    meaning: `右${wR}×${dR}＝左□×${dL}：□＝${ans}g`,
    choices: uniqShuffle4(ans, [wR * dL / dR, wR * dR, wR / dL]),
  };
}
function typeSpringReverseWeight4() {
  const w1 = pick([10, 20, 25, 50]);
  const e1 = randInt(1, 5);
  const k = randInt(2, 6);
  const e2 = e1 * k;
  const ans = w1 * k;
  return {
    question: `ばね1本に${w1}gで${e1}cmのびる。ある重さのおもりをつるすと${e2}cmのびました。おもりは何g？`,
    answer: String(ans),
    meaning: `${w1}×(${e2}÷${e1})＝${ans}g`,
    choices: uniqShuffle4(ans, [w1 * e2, w1 * e1 / e2, ans / 2]),
  };
}
const g4d2Knowledge = [
  ['てこのつり合いの式「重さ×支点からのきょり」を、理科では何とよぶことがある？', 'モーメント', ['モーメント', '浮力', '弾性力', '仕事量']],
  ['支点から力点までのきょりを長くすると、必要な力はどうなる？', '小さくなる', ['小さくなる', '大きくなる', '変わらない', '0になる']],
  ['支点から作用点までのきょりを長くすると、作用点で出せる力はどうなる？', '小さくなる', ['小さくなる', '大きくなる', '変わらない', '2倍になる']],
  ['和ばさみ（左右対称のはさみ）で、支点は刃のどの部分にある？', '刃の付け根（ねじの部分）', ['刃の付け根（ねじの部分）', '刃の先端', '持ち手の先', '刃の真ん中だけ']],
  ['ねこ車（手押し車）で、車輪の位置は、てこでいうとどこにあたる？', '支点', ['支点', '力点', '作用点', '重心']],
  ['つりざお（釣り竿）で魚を持ち上げるとき、力点はどこにあたる？', 'つりざおをにぎる手', ['つりざおをにぎる手', 'さおの先端', '糸の先', '魚のいる場所']],
  ['上皿てんびんで重さをはかるとき、分銅は軽いものから重いものの順に何側にのせる？', '反対側の皿', ['反対側の皿', '同じ側の皿', '支点の上', 'どちらでもよい']],
];

// ============ 小4 d3 ============
function typeLeverUnknownLeftDist4() {
  const wL = pick([10, 15, 20, 25, 30]);
  const dR = randInt(2, 9);
  const k = randInt(2, 8);
  const wR = k * wL;
  const ans = k * dR;
  return {
    question: `てこがつり合っています。支点から右${dR}cmに${wR}g。左側の${wL}gのおもりは支点から何cmの位置？`,
    answer: String(ans),
    meaning: `${wR}×${dR}÷${wL}＝${ans}cm`,
    choices: uniqShuffle4(ans, [wL * dR / wR, dR, ans * 2]),
  };
}
function typeThreeWeightMirrorRight4() {
  const p = threeWeightParams();
  if (!p) return null;
  return {
    question: `支点の右に2つのおもり：${p.w1}g（${p.d1}cm）と${p.w2}g（${p.d2}cm）。左の${p.d3}cmの位置に何gでつり合う？`,
    answer: String(p.ans),
    meaning: `(${p.w1}×${p.d1}＋${p.w2}×${p.d2})÷${p.d3}＝${p.ans}g`,
    choices: uniqShuffle4(p.ans, [(p.w1 * p.d1 - p.w2 * p.d2) / p.d3, p.w1 + p.w2, p.moment / (p.d3 * 2)]),
  };
}
const g4d3Knowledge = [
  ['重いものを動かすときに使う「バール（かなてこ）」で、支点に近づけて使うと？', 'より小さい力で動かせる', ['より小さい力で動かせる', 'より大きい力が必要になる', '動かせなくなる', '力は変わらない']],
  ['洗たくばさみは、てこでいうとどんなならびになっている？', '支点→作用点→力点（にぎる部分が力点）', ['支点→作用点→力点（にぎる部分が力点）', '支点→力点→作用点', '力点→支点→作用点', '作用点→力点→支点']],
  ['重い荷物を運ぶ台車の車輪は、てこでいうと何の役割に近い？', '支点', ['支点', '力点', '作用点', '重心']],
  ['定かっ車を使う一番の利点は？', '力の向きを変えられること', ['力の向きを変えられること', '力が半分になること', '力が2倍になること', '重さがなくなること']],
  ['輪じくのハンドル（大きい輪）を回すとき、じく（小さい輪）に比べて動く道のりは？', '長くなる', ['長くなる', '短くなる', '同じ', '動かない']],
  ['ペンチの支点はどこにある？', 'つなぎ目のねじの部分', ['つなぎ目のねじの部分', '持ち手の先端', '刃の先端', '刃の真ん中']],
  ['くぎぬきを使うとき、支点に近いところに手を置いて力を加えると？', '大きな力が必要になる', ['大きな力が必要になる', '小さな力でぬける', '力は変わらない', 'くぎが曲がらない']],
];

// ============ 小4 d4 ============
function typeThreeWeightMirrorRight4b() {
  const p = threeWeightParams();
  if (!p) return null;
  return {
    question: `支点の右に${p.w1}g（${p.d1}cm）と${p.w2}g（${p.d2}cm）の2つのおもり。左の${p.d3}cmの位置に何gでつり合う？`,
    answer: String(p.ans),
    meaning: `(${p.w1}×${p.d1}＋${p.w2}×${p.d2})÷${p.d3}＝${p.ans}g`,
    choices: uniqShuffle4(p.ans, [(p.w1 * p.d1 - p.w2 * p.d2) / p.d3, p.w1 + p.w2, p.moment / (p.d3 * 2)]),
  };
}
function typeParallelSpringReverse4() {
  const per = randInt(2, 30) * 5;
  const ans = per * 2;
  return {
    question: `同じばねを2本横にならべて（並列）つるすと、ばね1本には${per}gの力がかかりました。おもり全体の重さは何g？`,
    answer: String(ans),
    meaning: `1本にかかる力×2本＝${per}×2＝${ans}g`,
    choices: uniqShuffle4(ans, [per, per / 2, ans * 2]),
  };
}
const g4d4Knowledge = [
  ['洗たくばさみやホッチキスのように、てこを利用して物をはさむ道具に共通するのは？', 'てこの原理を利用していること', ['てこの原理を利用していること', '浮力を利用していること', '輪じくを利用していること', '磁力を利用していること']],
  ['さおばかりで、分銅を支点に近づけると、はかれる重さは？', '軽くなる', ['軽くなる', '重くなる', '変わらない', '0になる']],
  ['てこを利用した道具で、力点が支点と作用点の間にあるものは？', 'せんぬき', ['せんぬき', 'はさみ', 'ピンセット', 'くぎぬき']],
  ['輪じくで、じく（小さい輪）に近いところで作業すると、力は？', '大きな力が必要になる', ['大きな力が必要になる', '小さな力ですむ', '力は関係ない', '力が0になる']],
  ['定かっ車と動かっ車を両方使うと、力の大きさと向きはどうなる？', '力は小さくなり、向きも変えられる', ['力は小さくなり、向きも変えられる', '力は大きくなるだけ', '向きだけ変わり力は変わらない', '何も変わらない']],
  ['重い岩を動かすのに、棒をすき間に差しこみ、下に石を置いて支点にする道具の使い方を何という？', 'てこの原理', ['てこの原理', '浮力の原理', '輪じくの原理', '慣性の原理']],
  ['ばねののびを利用して重さを数字で読み取れるようにした道具は？', 'ばねはかり', ['ばねはかり', '上皿てんびん', 'メスシリンダー', '温度計']],
];

// ============ 小5 d1 ============
function typeLeverMirrorLeft5() {
  const { divisor: dL, keep: dR, other: wR, ans } = ratioParams([2, 9], [2, 9], [2, 15]);
  return {
    question: `てこの支点から右${dR}cmに${wR}g。左${dL}cmに何gでつり合う？`,
    answer: String(ans),
    meaning: `${wR}×${dR}÷${dL}＝${ans}g`,
    choices: uniqShuffle4(ans, [wR * dL / dR, wR * dR, wR / dL]),
  };
}
function typeWheelAxleBasic5() {
  const { divisor: rw, keep: rj, other: w, ans } = ratioParams([5, 40], [3, 30], [2, 10]);
  return {
    question: `輪じく。じく半径${rj}cm、荷物${w}g。輪半径${rw}cm。引く力は何g？`,
    answer: String(ans),
    meaning: `${w}×${rj}÷${rw}＝${ans}g`,
    choices: uniqShuffle4(ans, [w * rw / rj, w, ans * 2]),
  };
}
const g5d1Knowledge = [
  ['2つの力が同じ大きさで反対向きにはたらくとき、物体は？', 'つり合って静止する（動かない）', ['つり合って静止する（動かない）', '加速して動く', '2倍の力で動く', '消えてしまう']],
  ['綱引きで両チームが同じ力で引き合っているとき、綱は？', '動かない', ['動かない', '強い方に動く', '真ん中で切れる', 'ゆっくり回転する']],
  ['机の上に置かれた本にはたらく重力とつり合っている力は？', '机が本をおし返す力（垂直抗力）', ['机が本をおし返す力（垂直抗力）', '摩擦力', '浮力', '弾性力だけ']],
  ['力のつり合いを考えるとき、力の大きさだけでなく何も同じかどうか大切？', '力の向き（一直線上で反対向き）', ['力の向き（一直線上で反対向き）', '力の色', '力の重さ', '力の速さ']],
  ['静止している物体には、力がはたらいていないか、力が（　）になっている。', 'つり合っている', ['つり合っている', 'はたらいていない', '一方向にかたよっている', '消えている']],
  ['天びんの左右の皿に同じ重さのものをのせると、うでは？', '水平につり合う', ['水平につり合う', '重い方にかたむく', '軽い方にかたむく', '上下にゆれ続ける']],
  ['ロープにぶら下がって静止している人にはたらく重力とつり合う力は？', 'ロープが引く力（張力）', ['ロープが引く力（張力）', '浮力', '摩擦力', '風の力']],
];

// ============ 小5 d2 ============
function typeLeverMirrorDist5() {
  const { divisor: wL, keep: dR, other: wR, ans } = ratioParams([3, 30], [2, 9], [2, 10]);
  return {
    question: `支点から右${dR}cmに${wR}gのおもり。左側の${wL}gは支点から何cmでつり合う？`,
    answer: String(ans),
    meaning: `${wR}×${dR}÷${wL}＝${ans}cm`,
    choices: uniqShuffle4(ans, [wL * dR / wR, dR, ans * 2]),
  };
}
function typeComboPulleyLength5() {
  const dist = pick([1, 1.5, 2, 2.5, 3, 4, 5, 6]);
  const ans = dist * 2;
  return {
    question: `動かっ車1個と定かっ車1個を組み合わせて、荷物を${dist}m持ち上げます。ひもを引く長さは何m？（小数も可）`,
    answer: fmt(ans),
    meaning: `動かっ車1個分、力は半分・長さは2倍：${dist}×2＝${ans}m`,
    choices: uniqShuffle4(ans, [dist, dist * 4, dist / 2]),
  };
}
const g5d2Knowledge = [
  ['輪じくの「輪」を大きくすると、必要な力は？', '小さくなる', ['小さくなる', '大きくなる', '変わらない', '0になる']],
  ['輪じくの「じく」を太くする（半径を大きくする）と、必要な力は？', '大きくなる', ['大きくなる', '小さくなる', '変わらない', '0になる']],
  ['1つの物体に3つ以上の力がはたらいていても静止していることがある。この条件は？', '力の合計（合力）が0になっていること', ['力の合計（合力）が0になっていること', '力が2つだけであること', '力がすべて同じ向きであること', '重さが0であること']],
  ['壁にもたれて静止している人にはたらく力の組み合わせとして正しいのは？', '重力・垂直抗力・壁からの力などがつり合っている', ['重力・垂直抗力・壁からの力などがつり合っている', '重力だけがはたらいている', '力は何もはたらいていない', '摩擦力だけがはたらいている']],
  ['ばねばかりを2つ使って同じ物体を反対方向から同じ力で引くと、物体は？', '動かない（つり合う）', ['動かない（つり合う）', 'どちらか一方に動く', '2倍の速さで動く', 'ばねが切れる']],
  ['動かっ車を使ったとき、力が半分になる理由は、荷物を何本のひもで支えているから？', '2本', ['2本', '1本', '3本', '4本']],
  ['輪じくで力点を輪の外側ほど遠くに取ると、必要な力は？', '小さくなる', ['小さくなる', '大きくなる', '変わらない', '2倍になる']],
];

// ============ 小5 d3 ============
function typeWheelAxleSolveRadius5() {
  const { divisor: effort, keep: rj, other: w, ans: rw } = ratioParams([2, 20], [3, 30], [2, 15]);
  return {
    question: `輪じくがあります。じくの半径は${rj}cm。荷物${w}gをつるし、輪を${effort}gの力で引くとつり合いました。輪の半径は何cm？`,
    answer: String(rw),
    meaning: `${w}×${rj}÷${effort}＝${rw}cm`,
    choices: uniqShuffle4(rw, [effort * rj / w, rj, rw * 2]),
  };
}
function typeWheelAxleSolveLoad5() {
  const { divisor: rj, keep: rw, other: effort, ans: w } = ratioParams([2, 20], [5, 40], [2, 15]);
  return {
    question: `輪じくがあります。じく半径${rj}cm、輪半径${rw}cm。輪を${effort}gの力で引くと、じくにつるした荷物とつり合いました。荷物は何g？`,
    answer: String(w),
    meaning: `${effort}×${rw}÷${rj}＝${w}g`,
    choices: uniqShuffle4(w, [effort * rj / rw, effort, w / 2]),
  };
}
function typeThreeWeightMirrorRight5() {
  const p = threeWeightParams();
  if (!p) return null;
  return {
    question: `支点の右に${p.w1}g（${p.d1}cm）と${p.w2}g（${p.d2}cm）。左${p.d3}cmには何gでつり合う？`,
    answer: String(p.ans),
    meaning: `(${p.w1}×${p.d1}＋${p.w2}×${p.d2})÷${p.d3}＝${p.ans}g`,
    choices: uniqShuffle4(p.ans, [(p.w1 * p.d1 - p.w2 * p.d2) / p.d3, p.w1 + p.w2, p.moment / (p.d3 * 2)]),
  };
}

// ============ 小5 d4 ============
function typeMovable2PulleyLength5() {
  const dist = pick([0.5, 1, 1.5, 2, 2.5, 3, 4]);
  const ans = dist * 4;
  return {
    question: `動かっ車2個を使って荷物を${dist}m持ち上げます。ひもを引く長さは何m？（小数も可）`,
    answer: fmt(ans),
    meaning: `動かっ車2個で力は1/4、長さは4倍：${dist}×4＝${ans}m`,
    choices: uniqShuffle4(ans, [dist * 2, dist, dist * 8]),
  };
}
function typeRodMiddleSupport5() {
  const d = randInt(2, 20);
  const rest = randInt(2, 30);
  const L = d + rest;
  const k = randInt(2, 10);
  const w = k * d;
  const ans = k * rest;
  return {
    question: `長さ${L}cmの軽い棒を、左はしから${d}cmの位置を支点にして支えています。右はしに${w}gのおもりをつるしたとき、左はしを何gの力で下向きにおさえるとつり合う？`,
    answer: String(ans),
    meaning: `${w}×(${L}－${d})÷${d}＝${ans}g`,
    choices: uniqShuffle4(ans, [w * d / (L - d), w, ans / 2]),
  };
}
function typeWheelAxleSolveJiku5() {
  const { divisor: w, keep: rw, other: effort, ans: rj } = ratioParams([5, 40], [3, 30], [2, 15]);
  return {
    question: `輪じくの輪（半径${rw}cm）を${effort}gの力で引くと、じくにつるした${w}gの荷物とつり合いました。じくの半径は何cm？`,
    answer: String(rj),
    meaning: `${effort}×${rw}÷${w}＝${rj}cm`,
    choices: uniqShuffle4(rj, [w * rw / effort, rw, rj * 2]),
  };
}

// ============ 小6 d1 ============
function typeBuoyancyLoss6() {
  const air = randInt(6, 60) * 10;
  const loss = randInt(1, Math.floor(air / 10)) * 5;
  const ans = air - loss;
  return {
    question: `物体を水中に沈めると、ばねはかりの目盛りは空気中より${loss}g軽くなりました。空気中での重さが${air}gのとき、水中での目盛りは何g？`,
    answer: String(ans),
    meaning: `${air}－${loss}＝${ans}g`,
    choices: uniqShuffle4(ans, [air + loss, air, loss]),
  };
}
function typeWheelAxleSolveRadius6() {
  const { divisor: effort, keep: rj, other: w, ans: rw } = ratioParams([2, 20], [3, 30], [2, 15]);
  return {
    question: `輪じく。じく半径${rj}cm、荷物${w}g、輪を${effort}gの力で引くとつり合いました。輪の半径は何cm？`,
    answer: String(rw),
    meaning: `${w}×${rj}÷${effort}＝${rw}cm`,
    choices: uniqShuffle4(rw, [effort * rj / w, rj, rw * 2]),
  };
}
const g6d1Knowledge = [
  ['物体の密度が水の密度より小さいとき、その物体は水に入れると？', '浮く', ['浮く', 'しずむ', '水と同じ深さでとまる', '変化しない']],
  ['物体の密度が水の密度より大きいとき、その物体は水に入れると？', 'しずむ', ['しずむ', '浮く', '半分だけ浮く', '変化しない']],
  ['1cm³あたりの重さのことを何という？', '密度', ['密度', '浮力', '質量', '体積']],
  ['同じ体積で重い物体と軽い物体、水中での浮力の大きさは？', '同じ（体積が同じなら浮力も同じ）', ['同じ（体積が同じなら浮力も同じ）', '重い方が浮力が大きい', '軽い方が浮力が大きい', '浮力は発生しない']],
  ['物体がしずんでいくとき、深さが変わっても浮力の大きさが変わらないのはなぜ？', 'おしのけた体積が変わらないから', ['おしのけた体積が変わらないから', '水圧が一定だから', '重さが変わらないから', '密度が変わらないから']],
  ['鉄は密度が水より大きいのに鉄の船が浮くのはなぜ？', '船全体の形で見ると平均の密度が水より小さいから', ['船全体の形で見ると平均の密度が水より小さいから', '鉄そのものが軽いから', '浮力がはたらかないから', '水の密度が特別大きいから']],
  ['食塩水は真水より密度が大きい。同じ物体を入れたとき、浮力は？', '食塩水の方が大きい', ['食塩水の方が大きい', '真水の方が大きい', '同じ', '浮力は発生しない']],
];

// ============ 小6 d2 ============
function typePartialSubmerge6() {
  const percent = pick([10, 20, 25, 40, 50, 60, 75, 80]);
  const g = gcd(100, percent);
  const unit = 100 / g;
  const k = randInt(2, 15);
  const volume = k * unit;
  const ans = volume * percent / 100;
  return {
    question: `体積${volume}cm³の物体が、体積の${percent}％だけ水中にしずんで浮いています。この物体の重さは何g？（水1cm³＝1g）`,
    answer: String(ans),
    meaning: `${volume}×${percent}÷100＝${ans}g`,
    choices: uniqShuffle4(ans, [volume - ans, volume, ans * 2]),
  };
}
function typeRodSolvePosition6() {
  const x = randInt(2, 20);
  const m = randInt(2, 20);
  const L = 2 * (x + m);
  const j = randInt(2, 10);
  const rodWeight = j * x;
  const objWeight = j * m;
  const ans = x;
  return {
    question: `長さ${L}cm・重さ${rodWeight}gの一様な棒があります。左はしに${objWeight}gのおもりをつるし、支点を左はしから何cmの位置にすればつり合いますか？（棒の重さは中央にかかる）`,
    answer: String(ans),
    meaning: `${rodWeight}×(${L / 2}－□)＝${objWeight}×□ を解くと□＝${ans}cm`,
    choices: uniqShuffle4(ans, [L / 2 - x, ans * 2, m]),
  };
}
function typeMovablePulleyLength6() {
  const dist = pick([1, 1.5, 2, 2.5, 3, 4, 5, 6, 7]);
  const ans = dist * 2;
  return {
    question: `動かっ車1個で荷物を${dist}m持ち上げるには、ひもを何m引く必要がありますか？（小数も可）`,
    answer: fmt(ans),
    meaning: `${dist}×2＝${ans}m`,
    choices: uniqShuffle4(ans, [dist, dist * 4, dist / 2]),
  };
}
const g6d2Knowledge = [
  ['太さが一様でない棒（片方が太い棒）の重心はどこにかたよる？', '太い（重い）方にかたよる', ['太い（重い）方にかたよる', '細い方にかたよる', '真ん中のまま', '重心は存在しない']],
  ['物体の重心とは何の位置？', '物体の重さが集まっていると考えられる点', ['物体の重さが集まっていると考えられる点', '物体の中で一番軽い点', '物体の表面の中心', '物体の色が変わる点']],
  ['厚紙を1点でつるしてつり合わせると、その点の真上にあるのは？', '重心', ['重心', '支点', '力点', '作用点']],
  ['重心が低いものほど、たおれ（転倒）に対してどうなる？', 'たおれにくい（安定する）', ['たおれにくい（安定する）', 'たおれやすい', '変わらない', '浮きやすくなる']],
  ['動かっ車と定かっ車を組み合わせた「組かっ車」を使う目的は？', '小さい力で、向きも都合よく持ち上げるため', ['小さい力で、向きも都合よく持ち上げるため', '力を大きくするため', '重さを軽くするため', '浮力を発生させるため']],
  ['浮力が「おしのけた水の重さ」に等しいという法則にちなんだ名前は？', 'アルキメデスの原理', ['アルキメデスの原理', 'フックの法則', 'ニュートンの法則', 'パスカルの原理']],
  ['仕事の原理により、動かっ車を何個使っても、力×きょりの積はどうなる？', '道具を使わないときと変わらない', ['道具を使わないときと変わらない', '半分になる', '2倍になる', '0になる']],
];

// ============ 小6 d3 ============
function typeSinkLossVolume6() {
  const loss = randInt(4, 60) * 5;
  return {
    question: `ある物体を水中に完全にしずめると、ばねはかりの目盛りが空気中より${loss}g軽くなりました。この物体の体積は何cm³？（水1cm³＝1g）`,
    answer: String(loss),
    meaning: `目盛りが軽くなった分＝浮力＝おしのけた水の体積：${loss}cm³`,
    choices: uniqShuffle4(loss, [loss * 2, loss / 2, loss + 15]),
  };
}
function typeMomentDiffMirror6() {
  const p = momentDiffParams();
  if (!p) return null;
  return {
    question: `支点の右${p.dKnown1}cmに${p.wKnown1}g、左${p.dKnown2}cmに${p.wKnown2}gがあります。さらに左側に${p.wNew}gを置いてつり合わせるには、支点から何cmの位置？`,
    answer: fmt(p.ans),
    meaning: `残りのモーメント(${p.wKnown1}×${p.dKnown1}－${p.wKnown2}×${p.dKnown2})÷${p.wNew}＝${fmt(p.ans)}cm`,
    choices: uniqShuffle4(p.ans, [(p.wKnown1 * p.dKnown1 + p.wKnown2 * p.dKnown2) / p.wNew, p.ans * 2, p.ans / 2]),
  };
}
function typeWheelAxleSolveRadius6b() {
  const { divisor: effort, keep: rj, other: w, ans: rw } = ratioParams([2, 20], [3, 30], [2, 15]);
  return {
    question: `輪じくのじく（半径${rj}cm）に${w}gのおもり。輪を${effort}gの力で引くとつり合いました。輪の半径は何cm？`,
    answer: String(rw),
    meaning: `${w}×${rj}÷${effort}＝${rw}cm`,
    choices: uniqShuffle4(rw, [effort * rj / w, rj, rw * 2]),
  };
}

// ============ 小6 d4 ============
function typeRodLiftAtPoint6() {
  const L = randInt(6, 30) * 2; // 偶数
  const rodWeight = randInt(4, 40) * 5;
  const objWeight = randInt(2, 40) * 5;
  const moment = rodWeight * (L / 2) + objWeight * L;
  const half = Math.ceil(L / 2);
  const divs = [];
  for (let i = half; i <= L; i++) if (moment % i === 0) divs.push(i);
  if (!divs.length) return null;
  const p = pick(divs);
  const ans = moment / p;
  if (ans <= 0 || ans > 2000) return null;
  return {
    question: `長さ${L}cm・重さ${rodWeight}gの一様な棒の左はしを支点にして固定しています。右はしに${objWeight}gのおもりをつるし、支点から${p}cmの位置を上向きに持ち上げて水平に支えるには、何gの力が必要ですか？`,
    answer: String(ans),
    meaning: `(${rodWeight}×${L / 2}＋${objWeight}×${L})÷${p}＝${ans}g`,
    choices: uniqShuffle4(ans, [(rodWeight + objWeight), ans * 2, ans / 2]),
  };
}
function typeWheelAxleSolveJiku6() {
  const { divisor: w, keep: rw, other: effort, ans: rj } = ratioParams([5, 40], [3, 30], [2, 15]);
  return {
    question: `輪じくの輪（半径${rw}cm）を${effort}gの力で引くと、じくにつるした${w}gの荷物とつり合いました。じくの半径は何cm？`,
    answer: String(rj),
    meaning: `${effort}×${rw}÷${w}＝${rj}cm`,
    choices: uniqShuffle4(rj, [w * rw / effort, rw, rj * 2]),
  };
}
function typeDensityPercent6() {
  const density = randInt(10, 95) / 100;
  const ans = Math.round(density * 100);
  return {
    question: `1cm³あたり${density}gの物体があります。水に浮かべたとき、体積の何％が水中にしずみますか？（水の密度は1cm³＝1gとします）`,
    answer: String(ans),
    meaning: `密度がそのまま水中にしずむ体積の割合になる：${density}×100＝${ans}％`,
    choices: uniqShuffle4(ans, [100 - ans, ans / 2, Math.min(99, ans + 10)]),
  };
}

// ================================================================
// 生成の実行
// ================================================================
pushItems(genUnique(typeSpringCompare4, 6, seenGlobal)
  .concat(genUnique(typeTotalLengthReverse4, 7, seenGlobal))
  .concat(fromKnowledge(g4d1Knowledge)), 4, 1);

pushItems(genUnique(typeLeverUnknownLeft4, 6, seenGlobal)
  .concat(genUnique(typeSpringReverseWeight4, 7, seenGlobal))
  .concat(fromKnowledge(g4d2Knowledge)), 4, 2);

pushItems(genUnique(typeLeverUnknownLeftDist4, 6, seenGlobal)
  .concat(genUnique(typeThreeWeightMirrorRight4, 7, seenGlobal))
  .concat(fromKnowledge(g4d3Knowledge)), 4, 3);

pushItems(genUnique(typeThreeWeightMirrorRight4b, 6, seenGlobal)
  .concat(genUnique(typeParallelSpringReverse4, 7, seenGlobal))
  .concat(fromKnowledge(g4d4Knowledge)), 4, 4);

pushItems(genUnique(typeLeverMirrorLeft5, 6, seenGlobal)
  .concat(genUnique(typeWheelAxleBasic5, 7, seenGlobal))
  .concat(fromKnowledge(g5d1Knowledge)), 5, 1);

pushItems(genUnique(typeLeverMirrorDist5, 6, seenGlobal)
  .concat(genUnique(typeComboPulleyLength5, 7, seenGlobal))
  .concat(fromKnowledge(g5d2Knowledge)), 5, 2);

pushItems(genUnique(typeWheelAxleSolveRadius5, 6, seenGlobal)
  .concat(genUnique(typeWheelAxleSolveLoad5, 7, seenGlobal))
  .concat(genUnique(typeThreeWeightMirrorRight5, 7, seenGlobal)), 5, 3);

pushItems(genUnique(typeMovable2PulleyLength5, 6, seenGlobal)
  .concat(genUnique(typeRodMiddleSupport5, 7, seenGlobal))
  .concat(genUnique(typeWheelAxleSolveJiku5, 7, seenGlobal)), 5, 4);

pushItems(genUnique(typeBuoyancyLoss6, 6, seenGlobal)
  .concat(genUnique(typeWheelAxleSolveRadius6, 7, seenGlobal))
  .concat(fromKnowledge(g6d1Knowledge)), 6, 1);

pushItems(genUnique(typePartialSubmerge6, 6, seenGlobal)
  .concat(genUnique(typeRodSolvePosition6, 7, seenGlobal))
  .concat(fromKnowledge(g6d2Knowledge)), 6, 2);

pushItems(genUnique(typeSinkLossVolume6, 6, seenGlobal)
  .concat(genUnique(typeMomentDiffMirror6, 7, seenGlobal))
  .concat(genUnique(typeWheelAxleSolveRadius6b, 7, seenGlobal)), 6, 3);

pushItems(genUnique(typeRodLiftAtPoint6, 6, seenGlobal)
  .concat(genUnique(typeWheelAxleSolveJiku6, 7, seenGlobal))
  .concat(genUnique(typeDensityPercent6, 7, seenGlobal)), 6, 4);

// ================================================================
// STAGE 3: 書き出し
// ================================================================
const reordered = data.map(q => ({
  id: q.id, question: q.question, answer: q.answer, choices: q.choices, meaning: q.meaning, grade: q.grade, difficulty: q.difficulty,
}));
const all = [...reordered, ...newItems];

// 検証
const qSet = new Set();
for (const q of all) {
  if (qSet.has(q.question)) throw new Error('重複question: ' + q.question);
  qSet.add(q.question);
  if (!q.choices || q.choices.length !== 4 || new Set(q.choices).size !== 4) throw new Error('choices不正: ' + q.id);
  if (!q.choices.includes(q.answer)) throw new Error('answerがchoicesに無い: ' + q.id);
  if (![4, 5, 6].includes(q.grade)) throw new Error('grade不正: ' + q.id);
  if (![1, 2, 3, 4].includes(q.difficulty)) throw new Error('difficulty不正: ' + q.id);
  const str = JSON.stringify(q);
  if (/NaN/.test(str)) throw new Error('NaNを含む: ' + q.id + ' ' + str);
}

fs.writeFileSync(FILE, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`新規追加: ${newItems.length}問`);
console.log(`合計: ${all.length}問`);
const grades = {};
all.forEach(q => { grades[q.grade] = (grades[q.grade] || 0) + 1; });
console.log('学年別:', grades);
const cells = {};
all.forEach(q => { const k = `g${q.grade}d${q.difficulty}`; cells[k] = (cells[k] || 0) + 1; });
console.log('セル別:', cells);

