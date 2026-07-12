const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'sansu_baai.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const lo = data.filter(d => d.difficulty === 1 || d.difficulty === 2);

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function nPr(n, r) {
  let res = 1;
  for (let i = 0; i < r; i++) res *= (n - i);
  return res;
}
function nCr(n, r) {
  return nPr(n, r) / factorial(r);
}

const results = [];
const seen = new Set();

function push(d, meaning, expectAnswer) {
  const wantNum = String(d.answer).replace(/[^0-9]/g, '');
  const gotNum = String(expectAnswer);
  if (wantNum !== gotNum) {
    throw new Error(`MISMATCH id=${d.id} answer=${d.answer} computed=${expectAnswer} question=${d.question}`);
  }
  if (!meaning.includes(`＝${gotNum}`)) {
    throw new Error(`ENDING FORMAT WRONG id=${d.id} meaning=${meaning}`);
  }
  if (seen.has(d.id)) throw new Error('DUP ' + d.id);
  seen.add(d.id);
  results.push({ id: d.id, meaning });
}

for (const d of lo) {
  const q = d.question;
  let m;

  // 1. row permutation: N人が横一列にならびます
  if ((m = q.match(/^([0-9]+)人が横一列にならびます。ならび方は全部で何通りありますか？/))) {
    const n = +m[1];
    const ans = factorial(n);
    const meaning = `${n}人を一列に並べるとき、並ぶ順番がちがえば別の並べ方になるので順列の考え方を使います。1番目の人は${n}通りの中から選べますが、2番目は残りの${n - 1}通り、3番目はさらに残りの${n - 2}通り、というように選べる人数が1人ずつ減っていきます。これらをすべてかけ合わせると${n}×${n - 1}×…×1＝${ans}通りです。`;
    push(d, meaning, ans);
    continue;
  }

  // 2. shirt-pants product rule
  if ((m = q.match(/シャツが([0-9]+)種類、ズボンが([0-9]+)種類あります。組み合わせは全部で何通りありますか？/))) {
    const a = +m[1], b = +m[2];
    const ans = a * b;
    const meaning = `シャツの選び方が${a}通りあり、そのシャツ1着ごとにズボンの選び方が${b}通りずつあります。シャツとズボンの組み合わせ方は、この2つの選び方をかけ合わせる積の法則で求められるので、${a}×${b}＝${ans}通りです。`;
    push(d, meaning, ans);
    continue;
  }

  // 3. candy choose 2 (types)
  if ((m = q.match(/([0-9]+)種類の.+あめの中から([0-9]+)種類を選ぶとき、選び方は全部で何通りありますか？/))) {
    const n = +m[1], k = +m[2];
    if (k !== 2) throw new Error('unexpected k ' + d.id);
    const ans = nCr(n, 2);
    const meaning = `${n}種類の中から2種類を選ぶとき、選ぶ順番は関係ないので組み合わせの考え方を使います。1種類目の選び方は${n}通り、2種類目は残りの${n - 1}通りですが、これでは同じ2種類の組を2回ずつ数えてしまうので2でわって重なりを取り除きます。${n}×${n - 1}÷2＝${ans}通りです。`;
    push(d, meaning, ans);
    continue;
  }

  // 4. people choose 2, simple phrasing "N人の中から2人を選ぶとき、選び方は..."
  if ((m = q.match(/^([0-9]+)人の中から([0-9]+)人を選ぶとき、選び方は全部で何通りありますか？/))) {
    const n = +m[1], k = +m[2];
    if (k !== 2) throw new Error('unexpected k ' + d.id);
    const ans = nCr(n, 2);
    const meaning = `${n}人の中から2人を選ぶとき、選ぶ順番は関係ないので組み合わせの考え方を使います。1人目の選び方は${n}通り、2人目は残りの${n - 1}通りですが、これでは同じ2人の組を2回ずつ数えてしまうので2でわって重なりを取り除きます。${n}×${n - 1}÷2＝${ans}通りです。`;
    push(d, meaning, ans);
    continue;
  }

  // 5. polygon diagonal
  if ((m = q.match(/正([0-9]+)角形の対角線は全部で何本ありますか？/))) {
    const n = +m[1];
    const ans = (n * (n - 3)) / 2;
    const meaning = `正${n}角形には頂点が${n}個あります。異なる2つの頂点を結ぶ線分の数は組み合わせの考え方で${n}×${n - 1}÷2通りですが、このうち隣り合う頂点どうしを結んだ${n}本は対角線ではなく辺です。頂点2つを選ぶ組み合わせから辺の本数を引くと、${n}×(${n}－3)÷2＝${ans}本になります。`;
    push(d, meaning, ans);
    continue;
  }

  // 6. digit cards
  if ((m = q.match(/([0-9]+)〜([0-9]+)の([0-9]+)種類の数字が書かれたカードから([0-9]+)枚使って([0-9]+)けたの数を作ります/))) {
    const kinds = +m[3], take = +m[4];
    const leading = kinds - 1;
    const remaining = nPr(kinds - 1, take - 1);
    const ans = leading * remaining;
    const meaning = `一番上の位には0を使えないので、0を除いた${leading}通りの数字（1〜${kinds - 1}）の中から選びます。残りの${take - 1}個の位には、すでに使った数字を除いた${kinds - 1}種類の数字から順に${take - 1}個を選んで並べればよいので、その並べ方は${remaining}通りです。位ごとの決め方は同時に決まるので積の法則によりかけ合わせて、${leading}×${remaining}＝${ans}通りです。`;
    push(d, meaning, ans);
    continue;
  }

  // 7. dice sum
  if ((m = q.match(/サイコロを2個ふって、目の合計が([0-9]+)になる出方は何通りありますか？/))) {
    const s = +m[1];
    const pairs = [];
    for (let a = 1; a <= 6; a++) {
      const b = s - a;
      if (b >= 1 && b <= 6) pairs.push(`(${a}，${b})`);
    }
    const ans = pairs.length;
    const list = pairs.join('');
    const meaning = `1個目のサイコロの目をa、2個目の目をbとして、a＋b＝${s}になる組を1から6までの範囲ですべて探すと、(a，b)＝${list}が見つかります。1個目と2個目は別々のサイコロなので区別して数えるので、あてはまる組の数＝${ans}通りです。`;
    push(d, meaning, ans);
    continue;
  }

  // 8. coin
  if ((m = q.match(/コインを([0-9]+)回投げたとき、表裏の出方は全部で何通りありますか？/))) {
    const n = +m[1];
    const ans = Math.pow(2, n);
    const meaning = `コインを1回投げるごとに表・裏の2通りの出方があります。${n}回投げると、そのたびに2通りの出方を順に選んでいくことになるので、積の法則により2を${n}回かけ合わせます。2×2×…×2（${n}回）＝2^${n}＝${ans}通りです。`;
    push(d, meaning, ans);
    continue;
  }

  // 9. people choose formal "N人の中からK人を選ぶ選び方は..."
  if ((m = q.match(/^([0-9]+)人の中から([0-9]+)人を選ぶ選び方は全部で何通りありますか？/))) {
    const n = +m[1], k = +m[2];
    const ans = nCr(n, k);
    let meaning;
    if (k === 2) {
      meaning = `${n}人の中から2人を選ぶとき、選ぶ順番は関係ないので組み合わせの考え方を使います。1人目の選び方は${n}通り、2人目は残りの${n - 1}通りですが、これでは同じ2人の組を2回ずつ数えてしまうので2でわって重なりを取り除きます。${n}×${n - 1}÷2＝${ans}通りです。`;
    } else if (k === 3) {
      const perm = nPr(n, 3);
      meaning = `${n}人の中から3人を選ぶとき、選ぶ順番は関係ないので組み合わせの考え方を使います。3人を選んで一列に並べる場合の数は${n}×${n - 1}×${n - 2}＝${perm}通りですが、これは同じ3人の組でも並び方のちがいで3！＝6通りずつ重複して数えています。そこで6でわると、${perm}÷6＝${ans}通りです。`;
    } else {
      throw new Error('unexpected k for formal ' + d.id + ' k=' + k);
    }
    push(d, meaning, ans);
    continue;
  }

  // 10. circular table
  if ((m = q.match(/^([0-9]+)人が円形のテーブルにすわるすわり方は何通りありますか？/))) {
    const n = +m[1];
    const ans = factorial(n - 1);
    const meaning = `${n}人を一列に並べる並べ方は${n}！通りありますが、円形にすわる場合は全員が同じ向きに1つずつ席をずらしても見た目のすわり方は変わらないため、回転して重なる${n}通りをまとめて1通りと数えます。そこで1人を基準の位置に固定し、残りの${n - 1}人のすわる順番だけを考えると、(${n}－1)！＝${ans}通りです。`;
    push(d, meaning, ans);
    continue;
  }

  // 11. people permutation "N人の中からK人を選んで一列にならべる..."
  if ((m = q.match(/^([0-9]+)人の中から([0-9]+)人を選んで一列にならべるならべ方は全部で何通りありますか？/))) {
    const n = +m[1], k = +m[2];
    const ans = nPr(n, k);
    let meaning;
    if (k === 2) {
      meaning = `${n}人の中から2人を選んで一列に並べるので、並ぶ順番も区別する順列の考え方を使います。1番目に並ぶ人は${n}通り、2番目に並ぶ人は残りの${n - 1}通りなので、これらをかけ合わせて${n}×${n - 1}＝${ans}通りです。`;
    } else if (k === 3) {
      meaning = `${n}人の中から3人を選んで一列に並べるので、並ぶ順番も区別する順列の考え方を使います。1番目に並ぶ人は${n}通り、2番目は残りの${n - 1}通り、3番目はさらに残りの${n - 2}通りなので、これらをかけ合わせて${n}×${n - 1}×${n - 2}＝${ans}通りです。`;
    } else {
      throw new Error('unexpected k for perm ' + d.id + ' k=' + k);
    }
    push(d, meaning, ans);
    continue;
  }

  // 12. lattice path
  if ((m = q.match(/図のような碁盤の目の道（右へ([0-9]+)区間・上へ([0-9]+)区間）を、遠回りせずに行く行き方は何通りありますか？/))) {
    const a = +m[1], b = +m[2];
    const ans = nCr(a + b, a);
    const meaning = `最短で行くには、右への移動${a}回と上への移動${b}回を合計${a + b}回、順番を入れかえながら行うことになります。この${a + b}回の移動のうち、どの${a}回を「右」にするかを選べば道順が1通り決まると考えられるので、${a + b}個から${a}個選ぶ組み合わせの数と考えます。(${a}＋${b})C${a}＝${ans}通りです。`;
    push(d, meaning, ans);
    continue;
  }

  // 13. round robin
  if ((m = q.match(/^([0-9]+)チームが総当たり戦（リーグ戦）をします。全部で何試合行われますか？/))) {
    const n = +m[1];
    const ans = nCr(n, 2);
    const meaning = `総当たり戦では、どの2チームの組み合わせも必ず1回ずつ対戦します。試合数は、対戦する2チームを${n}チームの中から選ぶ組み合わせの数と同じになるので、順番を考えない組み合わせ${n}×${n - 1}÷2＝${ans}試合になります。`;
    push(d, meaning, ans);
    continue;
  }

  // 14. tournament
  if ((m = q.match(/^([0-9]+)チームがトーナメント戦（勝ちぬき戦）をします。優勝が決まるまで全部で何試合行われますか？/))) {
    const n = +m[1];
    const ans = n - 1;
    const meaning = `トーナメント戦では、1試合ごとに必ず1チームが負けて姿を消します。優勝チーム以外の${n - 1}チームがそれぞれ1回ずつ負けるまで試合が続くので、試合数はチーム数${n}から優勝する1チームを除いた${n}－1＝${ans}試合になります。`;
    push(d, meaning, ans);
    continue;
  }

  throw new Error('UNMATCHED question: ' + q + ' id=' + d.id);
}

console.log('total processed:', results.length, 'of', lo.length);

if (results.length !== 400) {
  throw new Error('Expected 400, got ' + results.length);
}

// dup / missing id check
const loIds = new Set(lo.map(d => d.id));
const resIds = new Set(results.map(r => r.id));
if (loIds.size !== resIds.size) throw new Error('id set size mismatch');
for (const id of loIds) if (!resIds.has(id)) throw new Error('missing id ' + id);

const outPath = path.join(__dirname, 'meanings_baai_lo.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 1), 'utf8');
console.log('written to', outPath);
