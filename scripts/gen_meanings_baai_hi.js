const fs = require('fs');
const path = require('path');

const MINUS = '－'; // －
const PLUS = '＋'; // ＋
const EQ = '＝'; // ＝
const FACT = '！'; // ！

function comb(n, r) {
  let a = 1, b = 1;
  for (let i = 0; i < r; i++) { a *= (n - i); b *= (i + 1); }
  return a / b;
}
function fact(n) {
  let a = 1;
  for (let i = 2; i <= n; i++) a *= i;
  return a;
}
function perm(n, r) {
  let a = 1;
  for (let i = 0; i < r; i++) a *= (n - i);
  return a;
}
function prodTerms(n, r) {
  // n×(n－1)×(n－2)...  r terms
  const terms = [];
  for (let i = 0; i < r; i++) {
    terms.push(i === 0 ? `${n}` : `(${n}${MINUS}${i})`);
  }
  return terms.join('×');
}
function prodTermsDesc(n, r) {
  const ordinals = ['1人目', '2人目', '3人目', '4人目'];
  const parts = [];
  for (let i = 0; i < r; i++) {
    const val = i === 0 ? `${n}通り` : `(${n}${MINUS}${i})通り`;
    parts.push(`${ordinals[i]}は${val}`);
  }
  return parts.join('、');
}
function factTerms(r) {
  const terms = [];
  for (let i = r; i >= 1; i--) terms.push(i);
  return terms.join('×');
}
function factProdTerms(n) {
  const terms = [];
  for (let i = n; i >= 1; i--) terms.push(i);
  return terms.join('×');
}

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '_target_baai_hi.json'), 'utf8'));

const patterns = [
  { name: 'combo', re: /^(\d+)人の中から(\d+)人を選ぶとき、選び方は全部で何通りありますか？$/ },
  { name: 'combo2', re: /^(\d+)人の中から(\d+)人を選ぶ選び方は全部で何通りありますか？$/ },
  { name: 'league_paren', re: /^(\d+)チームが総当たり戦(?:（リーグ戦）)?をします。全部で何試合行われますか？（引き分けなし・全チーム1回ずつ対戦）$/ },
  { name: 'league_noparen', re: /^(\d+)チームが総当たり戦(?:（リーグ戦）)?をします。全部で何試合行われますか？$/ },
  { name: 'tournament_paren', re: /^(\d+)チームがトーナメント戦（勝ちぬき戦）をします。優勝が決まるまで全部で何試合行われますか？（引き分けなし）$/ },
  { name: 'tournament_noparen', re: /^(\d+)チームがトーナメント戦（勝ちぬき戦）をします。優勝が決まるまで全部で何試合行われますか？$/ },
  { name: 'gender', re: /^男子(\d+)人・女子(\d+)人の中から、男子(\d+)人と女子(\d+)人を選ぶとき、選び方は全部で何通りありますか？$/ },
  { name: 'perm', re: /^(\d+)人の中から(\d+)人を選んで一列にならべるならべ方は全部で何通りありますか？$/ },
  { name: 'lineup', re: /^(\d+)人が横一列にならびます。ならび方は全部で何通りありますか？$/ },
  { name: 'dice', re: /^サイコロを2個ふって、目の合計が(\d+)になる出方は何通りありますか？$/ },
  { name: 'grid', re: /^図のような碁盤の目の道（右へ(\d+)区間・上へ(\d+)区間）を、遠回りせずに行く行き方は何通りありますか？$/ },
  { name: 'diagonal', re: /^正(\d+)角形の対角線は全部で何本ありますか？$/ },
  { name: 'circle', re: /^(\d+)人が円形のテーブルにすわるすわり方は何通りありますか？（回転して同じものは1通りと数えます）$/ },
  { name: 'digits', re: /^0〜(\d+)の(\d+)種類の数字が書かれたカードから(\d+)枚使って(\d+)けたの数を作ります。何通りできますか？（同じ数字は2度使えません、0は先頭に使えません）$/ },
  { name: 'coin', re: /^コインを(\d+)回投げたとき、表裏の出方は全部で何通りありますか？$/ },
];

function genCombo(n) {
  const r = 3;
  const ordered = perm(n, r);
  const ans = ordered / fact(r);
  const text = `「${n}人の中から3人を選ぶ」問題なので、順番を考えない組み合わせの考え方を使います。①まず3人を順番に選んで並べる方法を考えると、1人目は${n}通り、2人目は(${n}${MINUS}1)通り、3人目は(${n}${MINUS}2)通りなので、${prodTerms(n, r)}通りになります。②同じ3人の組は並べ方が3×2×1${EQ}6通りずつ重複して数えられているため、6で割って重複を消すと${prodTerms(n, r)}÷(3×2×1)${EQ}${ans}通りになります。`;
  return { text, ans };
}
function genCombo2(n, r) {
  const ordered = perm(n, r);
  const denom = fact(r);
  const ans = ordered / denom;
  const text = `「${n}人の中から${r}人を選ぶ」問題は、順番を考えない組み合わせnC${r}の考え方を使います。①まず${r}人を順番に選んで並べる方法を考えると、${prodTermsDesc(n, r)}なので、${prodTerms(n, r)}通りになります。②同じ${r}人の組は並べ方が${factTerms(r)}${EQ}${denom}通りずつ重複して数えられているため、${denom}で割って重複を消すと${n}C${r}${EQ}${ans}通りになります。`;
  return { text, ans };
}
function genPerm(n, r) {
  const ans = perm(n, r);
  const text = `「選んで並べる」問題なので、順序を区別する順列の考え方を使います。①${prodTermsDesc(n, r)}なので、これらをかけ合わせると${prodTerms(n, r)}通りになります。②まとめると${n}P${r}${EQ}${ans}通りです。`;
  return { text, ans };
}
function genLineup(n) {
  const ans = fact(n);
  const text = `${n}人全員を一列に並べる問題なので、場所を1つずつ決めていく順列(階乗)の考え方を使います。①一番左の位置は${n}通り、次の位置は残り(${n}${MINUS}1)通り、…というように1人ずつ場所を決めていくと、${factProdTerms(n)}通りになります。②これをまとめると${n}${FACT}${EQ}${ans}通りになります。`;
  return { text, ans };
}
function genCircle(n) {
  const m = n - 1;
  const ans = fact(m);
  const text = `円形に並ぶ問題は、回転して同じ並びを1通りとみなすため、まず1人の座る位置を基準として固定して考えます。①基準の1人を固定すると、残りの(${n}${MINUS}1)人だけを並べる順列を考えればよいので、${factProdTerms(m)}通りになります。②これがそのまま円順列の総数になり、(${n}${MINUS}1)${FACT}${EQ}${ans}通りになります。`;
  return { text, ans };
}
function genDice(s) {
  const pairs = [];
  const lo = Math.max(1, s - 6);
  const hi = Math.min(6, s - 1);
  for (let a = lo; a <= hi; a++) pairs.push(`(${a}、${s - a})`);
  const ans = pairs.length;
  const text = `サイコロ2個の目の出方は全部で6×6${EQ}36通りありますが、その中から目の合計が${s}になる組だけを数え上げます。①1個目の目をa、2個目の目をbとして、a＋b${EQ}${s}となる(a,b)の組をすべて書き出すと、${pairs.join('、')}の${ans}通りです。②これをまとめると、2個のサイコロで合計${s}になる場合の数${EQ}${ans}通りになります。`;
  return { text, ans };
}
function genGrid(a, b) {
  const total = a + b;
  const ans = comb(total, a);
  const text = `最短で目的地まで行くには、右への移動${a}回と上への移動${b}回、合計${total}回の移動の順番を決めることになります。①${total}回の移動のうち、どの${a}回を「右」にするかを選べば道順が1つ決まるので、${total}個から${a}個を選ぶ組み合わせを計算します。②(${a}${PLUS}${b})C${a}${EQ}${ans}通りになります。`;
  return { text, ans };
}
function genDiagonal(n) {
  const ans = (n * (n - 3)) / 2;
  const text = `正${n}角形の対角線は、それぞれの頂点から、自分自身ととなり合う2つの頂点を除いた残りの頂点に向かって引ける線分です。①1つの頂点から引ける対角線は(${n}${MINUS}3)本なので、${n}個の頂点それぞれから引くと${n}×(${n}${MINUS}3)本になりますが、②これは同じ対角線を両端から2回ずつ重複して数えているため、2で割ると${n}×(${n}${MINUS}3)÷2${EQ}${ans}本になります。`;
  return { text, ans };
}
function genDigits(max, total, k) {
  const leading = max;
  let text;
  let remainingVal;
  if (k - 1 === 1) {
    remainingVal = total - 1;
    const ans = leading * remainingVal;
    text = `0を先頭に使えないという条件があるので、位を1つずつ順番に決めていく積の法則を使います。①先頭の位には0が使えないため、1〜${max}の${leading}通りの中から選びます。②残りの1けたは、先頭で使った数字以外の${remainingVal}通り（0を含む）から選べます。③先頭(${leading}通り)×残り(${remainingVal}通り)${EQ}${ans}通りになります。`;
    return { text, ans };
  } else {
    const terms = [];
    for (let i = 1; i <= k - 1; i++) terms.push(total - i);
    remainingVal = terms.reduce((a, b) => a * b, 1);
    const ans = leading * remainingVal;
    text = `0を先頭に使えないという条件があるので、位を1つずつ順番に決めていく積の法則を使います。①先頭の位には0が使えないため、1〜${max}の${leading}通りの中から選びます。②残りの${k - 1}けたは、すでに使った数字以外の${total - 1}個の数字（0を含む）から順に選んでいくので、${terms.join('×')}${EQ}${remainingVal}通りです。③先頭(${leading}通り)×残り(${remainingVal}通り)${EQ}${ans}通りになります。`;
    return { text, ans };
  }
}
function genLeagueParen(n) {
  const ans = (n * (n - 1)) / 2;
  const text = `総当たり戦の試合数は、${n}チームの中から対戦する2チームを選ぶ組み合わせの数と同じです。①1チーム目の選び方は${n}通り、2チーム目は残りの(${n}${MINUS}1)通りなので、順番をつけて数えると${n}×(${n}${MINUS}1)通りになります。②しかし「AとBの対戦」と「BとAの対戦」は同じ1試合を2回数えていることになるので、2で割ると${n}×(${n}${MINUS}1)÷2${EQ}${ans}試合になります。`;
  return { text, ans };
}
function genLeagueNoparen(n) {
  const ans = (n * (n - 1)) / 2;
  const text = `総当たり戦の試合数は、${n}チームの中から対戦する2チームを選ぶ組み合わせnC2で求められます。①1チーム目の選び方は${n}通り、2チーム目は残りの(${n}${MINUS}1)通りなので、順番をつけて数えると${n}×(${n}${MINUS}1)通りになりますが、②「AとBの対戦」と「BとAの対戦」は同じ1試合を2回数えているため2で割ると、${n}C2${EQ}${ans}試合になります。`;
  return { text, ans };
}
function genTournament(n) {
  const ans = n - 1;
  const text = `トーナメント戦では1試合ごとに負けたチームが1つずつ消えていき、最後に優勝チームだけが残ります。①最初${n}チームいたのが、優勝が決まった時点で1チームだけになるので、消えたチームの数は(${n}${MINUS}1)チームです。②1試合につきちょうど1チームが消えるので、必要な試合数も消えたチームの数と同じ${n}${MINUS}1${EQ}${ans}試合になります。`;
  return { text, ans };
}
function genGender(a, b, c, d) {
  const maleC = comb(a, c);
  const femaleC = comb(b, d);
  const ans = maleC * femaleC;
  const text = `男子の中から${c}人を選ぶことと、女子の中から${d}人を選ぶことは、互いに影響しない別々の作業なので、それぞれの選び方の数をかけ合わせる積の法則を使います。①男子${a}人から${c}人を選ぶ組み合わせは${a}C${c}${EQ}${maleC}通りです。②女子${b}人から${d}人を選ぶ組み合わせは${b}C${d}${EQ}${femaleC}通りです。③この2つをかけ合わせると、男子の選び方${maleC}通り×女子の選び方${femaleC}通り${EQ}${ans}通りになります。`;
  return { text, ans };
}
function genCoin(n) {
  const ans = Math.pow(2, n);
  const text = `コインを1回投げるごとに表・裏の2通りの結果があり、${n}回投げてもそれぞれの回の結果は他の回に影響されずに決まるので、積の法則を使います。①1回目は2通り、2回目も2通り、…と${n}回分すべてかけ合わせると2×2×…×2(${n}個)通りになります。②これをまとめると2^${n}${EQ}${ans}通りになります。`;
  return { text, ans };
}

const results = [];
const unmatched = [];

for (const d of data) {
  let handled = false;
  for (const p of patterns) {
    const m = d.question.match(p.re);
    if (!m) continue;
    handled = true;
    let out;
    switch (p.name) {
      case 'combo': out = genCombo(+m[1]); break;
      case 'combo2': out = genCombo2(+m[1], +m[2]); break;
      case 'league_paren': out = genLeagueParen(+m[1]); break;
      case 'league_noparen': out = genLeagueNoparen(+m[1]); break;
      case 'tournament_paren': out = genTournament(+m[1]); break;
      case 'tournament_noparen': out = genTournament(+m[1]); break;
      case 'gender': out = genGender(+m[1], +m[2], +m[3], +m[4]); break;
      case 'perm': out = genPerm(+m[1], +m[2]); break;
      case 'lineup': out = genLineup(+m[1]); break;
      case 'dice': out = genDice(+m[1]); break;
      case 'grid': out = genGrid(+m[1], +m[2]); break;
      case 'diagonal': out = genDiagonal(+m[1]); break;
      case 'circle': out = genCircle(+m[1]); break;
      case 'digits': out = genDigits(+m[1], +m[2], +m[3]); break;
      case 'coin': out = genCoin(+m[1]); break;
      default: handled = false;
    }
    if (!out) { handled = false; break; }
    const expected = String(out.ans);
    if (expected !== d.answer) {
      console.error(`MISMATCH id=${d.id} template=${p.name} computed=${expected} answer=${d.answer} q=${d.question}`);
    }
    if (!out.text.endsWith(`${EQ}${d.answer}通り` ) && !out.text.endsWith(`${EQ}${d.answer}試合`) && !out.text.endsWith(`${EQ}${d.answer}本`)) {
      console.error(`TAIL MISMATCH id=${d.id} text_tail=${out.text.slice(-30)}`);
    }
    results.push({ id: d.id, meaning: out.text });
    break;
  }
  if (!handled) unmatched.push(d.id);
}

console.log('total processed:', results.length);
console.log('unmatched:', unmatched.length, unmatched);

const outPath = path.join(__dirname, 'meanings_baai_hi.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
console.log('written to', outPath);

// verify uniqueness
const idSet = new Set(results.map(r => r.id));
console.log('unique ids:', idSet.size, 'total:', results.length);
