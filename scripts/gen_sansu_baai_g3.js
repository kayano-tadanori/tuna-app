// sansu_baai.json に小3（場合の数）を追加するスクリプト。既存の小4〜6（240問）はそのまま残す
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function nCr(n, r) { return fact(n) / (fact(r) * fact(n - r)); }

const ITEM_WORDS = ['りんご', 'みかん', 'バナナ', 'いちご', 'メロン', 'ぶどう'];

// ===== 小3 難易度1：積の法則・基礎の並べ方 =====
function g3_d1() {
  if (Math.random() < 0.6) {
    const a = randInt(2, 7), b = randInt(2, 7);
    return { question: `シャツが${a}種類、ズボンが${b}種類あります。組み合わせは全部で何通りありますか？`, answer: String(a * b), meaning: `${a}×${b}＝${a * b}通り` };
  }
  const n = pick([3, 4]);
  return { question: `${n}人が横一列にならびます。ならび方は全部で何通りありますか？`, answer: String(fact(n)), meaning: `${n}×${n - 1}×…×1＝${fact(n)}通り` };
}

// ===== 小3 難易度2：組み合わせ基礎 C(n,2) =====
function g3_d2() {
  const n = randInt(4, 10);
  if (Math.random() < 0.5) {
    return { question: `${n}人の中から2人を選ぶとき、選び方は全部で何通りありますか？`, answer: String(nCr(n, 2)), meaning: `${n}×(${n}－1)÷2＝${nCr(n, 2)}通り` };
  }
  const word = pick(ITEM_WORDS);
  return { question: `${n}種類の${word}あめの中から2種類を選ぶとき、選び方は全部で何通りありますか？`, answer: String(nCr(n, 2)), meaning: `${n}×(${n}－1)÷2＝${nCr(n, 2)}通り` };
}

// ===== 小3 難易度3：リーグ戦・組み合わせ応用 C(n,3) =====
function g3_d3() {
  if (Math.random() < 0.5) {
    const n = randInt(5, 20);
    return { question: `${n}チームが総当たり戦（リーグ戦）をします。全部で何試合行われますか？（引き分けなし・全チーム1回ずつ対戦）`, answer: String(nCr(n, 2)), meaning: `${n}×(${n}－1)÷2＝${nCr(n, 2)}試合` };
  }
  const n = randInt(5, 15);
  return { question: `${n}人の中から3人を選ぶとき、選び方は全部で何通りありますか？`, answer: String(nCr(n, 3)), meaning: `${n}×(${n}－1)×(${n}－2)÷(3×2×1)＝${nCr(n, 3)}通り` };
}

// ===== 小3 難易度4：トーナメント戦・複合の組み合わせ =====
function g3_d4() {
  if (Math.random() < 0.5) {
    const n = randInt(8, 40);
    return { question: `${n}チームがトーナメント戦（勝ちぬき戦）をします。優勝が決まるまで全部で何試合行われますか？（引き分けなし）`, answer: String(n - 1), meaning: `1試合ごとに1チームが負けて消えるので、${n}－1＝${n - 1}試合で優勝が決まる` };
  }
  const boys = randInt(3, 6), girls = randInt(2, 4);
  const pickBoys = randInt(1, boys - 1), pickGirls = randInt(1, girls);
  const ways = nCr(boys, pickBoys) * nCr(girls, pickGirls);
  return { question: `男子${boys}人・女子${girls}人の中から、男子${pickBoys}人と女子${pickGirls}人を選ぶとき、選び方は全部で何通りありますか？`, answer: String(ways), meaning: `男子の選び方${nCr(boys, pickBoys)}通り×女子の選び方${nCr(girls, pickGirls)}通り＝${ways}通り` };
}

const GENERATORS = [g3_d1, g3_d2, g3_d3, g3_d4];

function genN(fn, n) {
  const out = []; const seen = new Set(); let tries = 0;
  while (out.length < n && tries < 40000) {
    tries++;
    const r = fn();
    if (!r) continue;
    if (seen.has(r.question)) continue;
    seen.add(r.question);
    out.push(r);
  }
  if (out.length < n) throw new Error(`生成不足: ${n}問中${out.length}問`);
  return out;
}

const filePath = path.join(__dirname, '..', 'data', 'sansu_baai.json');
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
let idCounter = existing.length + 1;

const newItems = [];
for (let diff = 1; diff <= 4; diff++) {
  const items = genN(GENERATORS[diff - 1], 20);
  items.forEach(it => {
    newItems.push({ id: `sc${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade: 3, difficulty: diff });
    idCounter++;
  });
  console.log(`grade3 diff${diff}: OK`);
}

const all = [...existing, ...newItems];
fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`小3を${newItems.length}問追加、合計${all.length}問`);
