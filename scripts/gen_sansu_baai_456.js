// sansu_baai.json の小4〜6を拡張（代表的な組み合わせ論の型を難易度に応じてスケールさせ3倍に）
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function nPr(n, r) { return fact(n) / fact(n - r); }
function nCr(n, r) { return fact(n) / (fact(r) * fact(n - r)); }

// 型1：n人を一列にならべる（並べる人数を変えて難易度調整）
function typeNarabu(nRange) {
  const n = randInt(...nRange);
  return { question: `${n}人が横一列にならびます。ならび方は全部で何通りありますか？`, answer: String(fact(n)), meaning: `${n}！＝${fact(n)}通り` };
}
// 型2：n人からr人選ぶ組み合わせ
function typeSentaku(nRange, rRange) {
  const n = randInt(...nRange), r = Math.min(randInt(...rRange), n - 1);
  if (r < 1) return null;
  return { question: `${n}人の中から${r}人を選ぶ選び方は全部で何通りありますか？`, answer: String(nCr(n, r)), meaning: `${n}C${r}＝${nCr(n, r)}通り` };
}
// 型3：n人からr人選んでならべる（順列）
function typeJunretsu(nRange, rRange) {
  const n = randInt(...nRange), r = Math.min(randInt(...rRange), n - 1);
  if (r < 1) return null;
  return { question: `${n}人の中から${r}人を選んで一列にならべるならべ方は全部で何通りありますか？`, answer: String(nPr(n, r)), meaning: `${n}P${r}＝${nPr(n, r)}通り` };
}
// 型4：コインを投げる
function typeCoin(nRange) {
  const n = randInt(...nRange);
  return { question: `コインを${n}回投げたとき、表裏の出方は全部で何通りありますか？`, answer: String(Math.pow(2, n)), meaning: `2^${n}＝${Math.pow(2, n)}通り` };
}
// 型5：サイコロの目の和
function typeDiceSum(diceCount, target) {
  // 全探索でtargetになる出方を数える
  function count(dice, tgt) {
    if (dice === 0) return tgt === 0 ? 1 : 0;
    let c = 0;
    for (let i = 1; i <= 6; i++) if (tgt - i >= 0) c += count(dice - 1, tgt - i);
    return c;
  }
  const n = diceCount, minSum = n, maxSum = n * 6;
  const t = randInt(minSum, maxSum);
  const ways = count(n, t);
  return { question: `サイコロを${n}個ふって、目の合計が${t}になる出方は何通りありますか？`, answer: String(ways), meaning: `${n}個のサイコロで合計${t}になる場合の数＝${ways}通り` };
}
// 型6：格子路（右a区間・上b区間）
function typeLattice(range) {
  const a = randInt(...range), b = randInt(...range);
  const ways = nCr(a + b, a);
  if (ways > 5000) return null;
  return { question: `図のような碁盤の目の道（右へ${a}区間・上へ${b}区間）を、遠回りせずに行く行き方は何通りありますか？`, answer: String(ways), meaning: `(${a}＋${b})C${a}＝${ways}通り` };
}
// 型7：円順列
function typeEnjunretsu(nRange) {
  const n = randInt(...nRange);
  return { question: `${n}人が円形のテーブルにすわるすわり方は何通りありますか？（回転して同じものは1通りと数えます）`, answer: String(fact(n - 1)), meaning: `(${n}－1)！＝${fact(n - 1)}通り` };
}
// 型8：n角形の対角線
function typeTaikakusen(nRange) {
  const n = randInt(...nRange);
  const diag = n * (n - 3) / 2;
  return { question: `正${n}角形の対角線は全部で何本ありますか？`, answer: String(diag), meaning: `${n}×(${n}－3)÷2＝${diag}本` };
}
// 型9：総当たり戦・トーナメント戦
function typeLeague(nRange) {
  const n = randInt(...nRange);
  if (Math.random() < 0.5) {
    return { question: `${n}チームが総当たり戦（リーグ戦）をします。全部で何試合行われますか？`, answer: String(nCr(n, 2)), meaning: `${n}C2＝${nCr(n, 2)}試合` };
  }
  return { question: `${n}チームがトーナメント戦（勝ちぬき戦）をします。優勝が決まるまで全部で何試合行われますか？`, answer: String(n - 1), meaning: `${n}－1＝${n - 1}試合` };
}
// 型10：カードで整数を作る（0が先頭に使えない）
function typeCardNumber(digitRange, useRange) {
  const digits = randInt(...digitRange); // 使うカードの種類数
  const use = Math.min(randInt(...useRange), digits);
  // カードは 0〜(digits-1) のdigits種類、そこからuse枚使ってuse桁の数を作る（先頭は0不可）
  if (use < 2) return null;
  const total = (digits - 1) * nPr(digits - 1, use - 1); // 先頭:0以外(digits-1通り)、残りuse-1枚を残りdigits-1枚から順列
  return { question: `0〜${digits - 1}の${digits}種類の数字が書かれたカードから${use}枚使って${use}けたの数を作ります。何通りできますか？（同じ数字は2度使えません、0は先頭に使えません）`, answer: String(total), meaning: `先頭(${digits - 1}通り)×残り(${nPr(digits - 1, use - 1)}通り)＝${total}通り` };
}

// ===== 難易度ごとのパラメータ設定 =====
function buildGenerators(nBase) {
  // nBaseで学年ごとの数値スケールをずらす（階乗が絡む型は現実的な範囲に上限をつける）
  return {
    1: () => typeNarabu([3, Math.min(4 + nBase, 8)]), // 8!=40320が上限
    2: () => typeSentaku([4 + nBase, 8 + nBase], [2, 3]),
    3: () => typeJunretsu([4 + nBase, 8 + nBase], [2, 3]),
    4: () => typeCoin([2, Math.min(5 + nBase, 10)]), // 2^10=1024が上限
    5: () => typeDiceSum(2, null),
    6: () => typeLattice([2, 4 + nBase]),
    7: () => typeEnjunretsu([4, Math.min(7 + nBase, 9)]), // (9-1)!=40320が上限
    8: () => typeTaikakusen([5, 12 + nBase]),
    9: () => typeLeague([4, 12 + nBase]),
    10: () => typeCardNumber([4, 6], [2, 3]),
  };
}

function genCell(diff, grade) {
  const nBase = (grade - 4) * 2 + diff; // 学年・難易度が上がるほど数値スケールが大きくなる
  const gens = buildGenerators(nBase);
  const keys = Object.keys(gens);
  const fn = gens[pick(keys)];
  return fn();
}

function genN(diff, grade, n) {
  const out = []; const seen = new Set(); let tries = 0;
  while (out.length < n && tries < 40000) {
    tries++;
    const r = genCell(diff, grade);
    if (!r) continue;
    if (seen.has(r.question)) continue;
    seen.add(r.question);
    out.push(r);
  }
  if (out.length < n) throw new Error(`生成不足 grade${grade} diff${diff}: ${n}問中${out.length}問`);
  return out;
}

const filePath = path.join(__dirname, '..', 'data', 'sansu_baai.json');
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const kept = existing.filter(q => q.grade === 3); // 小3は前回の拡張済みデータをそのまま維持
let idCounter = Math.max(...existing.map(q => Number(q.id.replace(/\D/g, '')))) + 1;
const prefix = existing[0].id.replace(/\d+$/, '');

const newItems = [];
[4, 5, 6].forEach(grade => {
  for (let diff = 1; diff <= 4; diff++) {
    const items = genN(diff, grade, 60);
    items.forEach(it => {
      newItems.push({ id: `${prefix}${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  }
});

const all = [...kept, ...newItems];
fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問`);
