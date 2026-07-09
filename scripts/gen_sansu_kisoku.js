// sansu_kisoku.json（規則性）生成スクリプト。小1〜6×難易度1〜4、各20問=480問
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

// ===== 小1 =====
function g1_d1() { // 等差数列（増加、公差1〜3）次の数
  const start = randInt(1, 20), diff = randInt(1, 3);
  const seq = [0, 1, 2, 3].map(i => start + diff * i);
  return { question: `${seq.join('、')}、□`, answer: String(start + diff * 4), meaning: `${diff}ずつ増える数列` };
}
function g1_d2() { // 等差数列（減少）
  const start = randInt(15, 30), diff = randInt(1, 3);
  const seq = [0, 1, 2, 3].map(i => start - diff * i);
  const next = start - diff * 4;
  if (next < 0) return null;
  return { question: `${seq.join('、')}、□`, answer: String(next), meaning: `${diff}ずつ減る数列` };
}
function g1_d3() { // 途中の□
  const start = randInt(1, 10), diff = randInt(1, 3);
  const seq = [0, 1, 2, 3, 4].map(i => start + diff * i);
  const pos = randInt(1, 3);
  const answer = seq[pos];
  const display = seq.map((v, i) => i === pos ? '□' : v);
  return { question: display.join('、'), answer: String(answer), meaning: `${diff}ずつ増える数列` };
}
function g1_d4() { // 連続する5口の足し算
  const start = randInt(1, 30);
  const seq = [0, 1, 2, 3, 4].map(i => start + i);
  return { question: `${seq.join('＋')}＝□`, answer: String(seq.reduce((a, b) => a + b, 0)), meaning: `連続する5つの数の和` };
}

// ===== 小2 =====
function g2_d1() { // 等差数列（公差1桁、2桁範囲）
  const start = randInt(10, 50), diff = randInt(2, 9);
  const seq = [0, 1, 2, 3].map(i => start + diff * i);
  return { question: `${seq.join('、')}、□`, answer: String(start + diff * 4), meaning: `${diff}ずつ増える数列` };
}
function g2_d2() { // 等差数列（公差2桁）
  const start = randInt(10, 100), diff = randInt(10, 20);
  const seq = [0, 1, 2, 3].map(i => start + diff * i);
  return { question: `${seq.join('、')}、□`, answer: String(start + diff * 4), meaning: `${diff}ずつ増える数列` };
}
function g2_d3() { // 階差が変わる数列（+1,+2,+3,...）
  const start = randInt(1, 30);
  const seq = [start];
  for (let i = 1; i <= 4; i++) seq.push(seq[i - 1] + i);
  const next = seq[4] + 5;
  return { question: `${seq.join('、')}、□`, answer: String(next), meaning: `ふえる数が1、2、3、4、5と増えていく数列` };
}
function g2_d4() { // 1からNまでの和（小さいN）
  const N = randInt(5, 40);
  return { question: `1から${N}までの整数をすべて足すといくつですか？`, answer: String(N * (N + 1) / 2), meaning: `1＋2＋…＋${N}＝${N}×(${N}＋1)÷2` };
}

// ===== 小3 =====
function g3_d1() { // 等差数列のn番目
  const start = randInt(1, 10), diff = randInt(2, 8), n = randInt(10, 30);
  const value = start + diff * (n - 1);
  return { question: `${start}から始まり、${diff}ずつ増えていく数列があります。${n}番目の数を求めなさい。`, answer: String(value), meaning: `${start}＋${diff}×(${n}－1)＝${value}` };
}
function g3_d2() { // 等比数列（×2,×3）
  const start = randInt(1, 15), ratio = pick([2, 3]);
  const seq = [0, 1, 2, 3].map(i => start * Math.pow(ratio, i));
  return { question: `${seq.join('、')}、□`, answer: String(start * Math.pow(ratio, 4)), meaning: `${ratio}倍ずつ増える数列` };
}
function g3_d3() { // 階差数列（差が等差）
  const start = randInt(1, 10), d0 = randInt(1, 5), dd = randInt(1, 3);
  const seq = [start];
  for (let i = 0; i < 4; i++) seq.push(seq[i] + d0 + dd * i);
  const next = seq[4] + d0 + dd * 4;
  return { question: `${seq.join('、')}、□`, answer: String(next), meaning: `ふえる数が${d0}、${d0 + dd}、${d0 + dd * 2}…と増えていく数列` };
}
function g3_d4() { // 1からNまでの和（大きめのN）
  const N = randInt(20, 100);
  return { question: `1から${N}までの整数をすべて足すといくつですか？`, answer: String(N * (N + 1) / 2), meaning: `1＋2＋…＋${N}＝${N}×(${N}＋1)÷2` };
}

// ===== 小4 =====
function g4_d1() { // 等差数列のn番目（大きいn）
  const start = randInt(1, 20), diff = randInt(3, 12), n = randInt(30, 100);
  const value = start + diff * (n - 1);
  return { question: `${start}から始まり、${diff}ずつ増えていく数列があります。${n}番目の数を求めなさい。`, answer: String(value), meaning: `${start}＋${diff}×(${n}－1)＝${value}` };
}
function g4_d2() { // 等差数列の和
  const start = randInt(1, 10), diff = randInt(2, 8), n = randInt(10, 30);
  const last = start + diff * (n - 1);
  const sum = n * (start + last) / 2;
  return { question: `${start}から始まり${diff}ずつ増えていく数列の、はじめから${n}番目までの和を求めなさい。`, answer: String(sum), meaning: `末項＝${last}、和＝(${start}＋${last})×${n}÷2＝${sum}` };
}
function g4_d3() { // 三角数のn番目
  const n = randInt(10, 40);
  const value = n * (n + 1) / 2;
  return { question: `1、3、6、10、15…（1つずつ増える数を足していく数列）の${n}番目の数を求めなさい。`, answer: String(value), meaning: `${n}×(${n}＋1)÷2＝${value}` };
}
function g4_d4() { // 群数列基礎：同じ数がk回ずつ繰り返される（1,2,2,3,3,3,4,4,4,4...）
  const n = randInt(10, 40);
  const seq = [];
  let num = 1;
  while (seq.length < n) { for (let i = 0; i < num && seq.length < n; i++) seq.push(num); num++; }
  const value = seq[n - 1];
  return { question: `1、2、2、3、3、3、4、4、4、4…（nがn個ずつ並ぶ数列）の${n}番目の数を求めなさい。`, answer: String(value), meaning: `${n}番目は${value}` };
}

// ===== 小5 =====
function g5_d1() { // 周期性（曜日計算）。日＝0、月＝1、火＝2、水＝3、木＝4、金＝5、土＝6の番号で答える（比較的やさしい）
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const startIdx = randInt(0, 6);
  const n = randInt(20, 300);
  const answerIdx = (startIdx + n) % 7;
  return { question: `曜日を日＝0、月＝1、火＝2、水＝3、木＝4、金＝5、土＝6の番号で表します。今日が${days[startIdx]}曜日（${startIdx}）のとき、${n}日後の曜日を番号で答えなさい。`, answer: String(answerIdx), meaning: `(${startIdx}＋${n})÷7のあまり＝${answerIdx}（${days[answerIdx]}曜日）` };
}
function g5_d2() { // 等比数列の和（初項a・公比r・項数n）
  const a = randInt(1, 5), r = pick([2, 3]), n = randInt(3, 6);
  let sum = 0, term = a;
  for (let i = 0; i < n; i++) { sum += term; term *= r; }
  if (sum > 100000) return null;
  return { question: `初項${a}、公比${r}の等比数列の、はじめから${n}項までの和を求めなさい。`, answer: String(sum), meaning: `${a}、${a * r}、${a * r * r}…の${n}項の和` };
}
function g5_d3() { // フィボナッチ的漸化式
  const a1 = randInt(1, 5), a2 = randInt(1, 5), n = randInt(8, 15);
  const seq = [a1, a2];
  for (let i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);
  if (seq[n - 1] > 999999) return null;
  return { question: `${a1}、${a2}から始まり、前の2つの数の和が次の数になる数列があります。${n}番目の数を求めなさい。`, answer: String(seq[n - 1]), meaning: `${seq.slice(0, Math.min(n, 8)).join('、')}${n > 8 ? '…' : ''}` };
}
function g5_d4() { // 群数列（等差数列をグループ分け、第m群のk番目）。小5では最も高度な技法として最終難易度に配置
  const m = randInt(4, 12), k = randInt(1, m);
  const startOfGroup = m * (m - 1) / 2 + 1;
  const value = startOfGroup + (k - 1);
  return { question: `1｜2、3｜4、5、6｜7、8、9、10｜…のように1、2、3、4…個ずつに区切ります。第${m}群の${k}番目の数を求めなさい。`, answer: String(value), meaning: `第${m}群の最初の数は${startOfGroup}` };
}

// ===== 小6 =====
function g6_d1() { // 等差×定数の和の応用（偶数のみの和等）。小6のやさしいはSAPIX偏差値50以下の基礎レベルに揃える
  const N = randInt(20, 80);
  const kind = pick(['even', 'odd']);
  if (kind === 'even') {
    const count = N, last = 2 * count;
    return { question: `2から${last}までの偶数をすべて足すといくつですか？`, answer: String(count * (count + 1)), meaning: `2＋4＋…＋${last}＝${count}×(${count}＋1)` };
  }
  const count = N, last = 2 * count - 1;
  return { question: `1から${last}までの奇数をすべて足すといくつですか？`, answer: String(count * count), meaning: `1＋3＋…＋${last}＝${count}×${count}` };
}
function g6_d2() { // 群数列（第m群、小5より難しい範囲）
  const m = randInt(4, 15), k = randInt(1, m);
  const startOfGroup = m * (m - 1) / 2 + 1;
  const value = startOfGroup + (k - 1);
  return { question: `1｜2、3｜4、5、6｜7、8、9、10｜…のように1、2、3、4…個ずつに区切ります。第${m}群の${k}番目の数を求めなさい。`, answer: String(value), meaning: `第${m}群の最初の数は${startOfGroup}` };
}
function g6_d3() { // 周期性の応用（1〜cycleのくり返し）
  const cycle = randInt(6, 11);
  const n = randInt(100, 999);
  const posInCycle = n % cycle;
  const idx = posInCycle === 0 ? cycle : posInCycle;
  const oneCycle = Array.from({ length: cycle }, (_, i) => i + 1).join('、');
  return { question: `${oneCycle}をくり返し「${oneCycle}、${oneCycle}、…」のように並べます。${n}番目の数字を求めなさい。`, answer: String(idx), meaning: `${n}÷${cycle}のあまりで判断（あまり0のときは${cycle}）＝${idx}` };
}
function g6_d4() { // 灘中レベル：群数列（分数の数列）1/1, 1/2,2/1, 1/3,2/2,3/1... のn番目の分子
  const n = randInt(20, 90);
  // 第m群はm個の分数からなり、分子は1..m、分母はm..1
  let m = 1, cum = 0;
  while (cum + m < n) { cum += m; m++; }
  const posInGroup = n - cum; // 1-indexed
  const numerator = posInGroup, denominator = m - posInGroup + 1;
  return { question: `1/1｜1/2、2/1｜1/3、2/2、3/1｜1/4、2/3、3/2、4/1｜…のように分数を並べます。${n}番目の分数の分子を求めなさい。`, answer: String(numerator), meaning: `第${m}群の${posInGroup}番目：分子${numerator}／分母${denominator}` };
}

const GENERATORS = {
  1: [g1_d1, g1_d2, g1_d3, g1_d4],
  2: [g2_d1, g2_d2, g2_d3, g2_d4],
  3: [g3_d1, g3_d2, g3_d3, g3_d4],
  4: [g4_d1, g4_d2, g4_d3, g4_d4],
  5: [g5_d1, g5_d2, g5_d3, g5_d4],
  6: [g6_d1, g6_d2, g6_d3, g6_d4],
};

function genN(fn, n) {
  const out = []; const seen = new Set(); let tries = 0;
  while (out.length < n && tries < 60000) {
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

const all = [];
let idCounter = 1;
for (let grade = 1; grade <= 6; grade++) {
  for (let diff = 1; diff <= 4; diff++) {
    const fn = GENERATORS[grade][diff - 1];
    const items = genN(fn, 20);
    items.forEach(it => {
      all.push({ id: `sr${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  }
}
fs.writeFileSync(path.join(__dirname, '..', 'data', 'sansu_kisoku.json'), JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問を書き出しました`);
