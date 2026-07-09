// sansu_kazu.json（数の性質）生成スクリプト。小4〜6×難易度1〜4、各20問=240問
const fs = require('fs');
const path = require('path');

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function lcm(a, b) { return a / gcd(a, b) * b; }
function lcmAll(arr) { return arr.reduce((a, b) => lcm(a, b)); }
function factorize(n) {
  const f = {};
  let x = n, d = 2;
  while (d * d <= x) {
    while (x % d === 0) { f[d] = (f[d] || 0) + 1; x /= d; }
    d++;
  }
  if (x > 1) f[x] = (f[x] || 0) + 1;
  return f;
}
function countDivisors(n) {
  const f = factorize(n);
  return Object.values(f).reduce((acc, e) => acc * (e + 1), 1);
}
function sumDivisors(n) {
  const f = factorize(n);
  return Object.entries(f).reduce((acc, [p, e]) => {
    p = Number(p);
    let s = 0;
    for (let i = 0; i <= e; i++) s += Math.pow(p, i);
    return acc * s;
  }, 1);
}
function divisorsOf(n) {
  const out = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out;
}
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

// ===== 小4 =====
function g4_d1() { // 約数の個数（基礎）
  const n = randInt(6, 60);
  return { question: `${n}の約数は全部で何個ありますか？`, answer: String(countDivisors(n)), meaning: `約数：${divisorsOf(n).join('、')}` };
}
function g4_d2() { // 最大公約数（基礎）
  const a = randInt(10, 80), b = randInt(10, 80);
  if (a === b) return null;
  return { question: `${a}と${b}の最大公約数を求めなさい。`, answer: String(gcd(a, b)), meaning: `${a}と${b}の最大公約数は${gcd(a, b)}` };
}
function g4_d3() { // 最も大きい素因数
  const n = randInt(20, 200);
  const f = factorize(n);
  const primes = Object.keys(f).map(Number);
  if (primes.length === 0) return null;
  const maxP = Math.max(...primes);
  return { question: `${n}を素因数分解したとき、最も大きい素因数は何ですか？`, answer: String(maxP), meaning: `${n}＝${Object.entries(f).map(([p, e]) => e > 1 ? `${p}^${e}` : p).join('×')}` };
}
function g4_d4() { // あまりの基礎：□でわるとrあまる最大の□
  const d = randInt(6, 20), r = randInt(1, d - 1), k = randInt(2, 6), n = d * k + r;
  const cands = divisorsOf(n - r).filter(x => x > r);
  if (cands.length === 0) return null;
  const maxD = Math.max(...cands);
  return { question: `${n}を□でわると${r}あまります。□にあてはまる数のうち、最も大きいものを求めなさい。`, answer: String(maxD), meaning: `${n}－${r}＝${n - r}の約数のうち${r}より大きいもの：${cands.join('、')}` };
}

// ===== 小5 =====
function g5_d1() { // 約数の個数（中範囲）
  const n = randInt(50, 400);
  return { question: `${n}の約数は全部で何個ありますか？`, answer: String(countDivisors(n)), meaning: `${n}の約数の個数` };
}
function g5_d2() { // 3つの数の最小公倍数
  const a = randInt(4, 30), b = randInt(4, 30), c = randInt(4, 30);
  if (a === b || b === c || a === c) return null;
  const l = lcmAll([a, b, c]);
  if (l > 100000) return null;
  return { question: `${a}と${b}と${c}の最小公倍数を求めなさい。`, answer: String(l), meaning: `${a},${b},${c}の最小公倍数＝${l}` };
}
function g5_d3() { // 剰余の性質（2条件、同じあまり）
  const d1 = randInt(4, 9), d2 = randInt(4, 12);
  if (d1 === d2) return null;
  const r = randInt(1, Math.min(d1, d2) - 1);
  const L = lcm(d1, d2);
  if (L > 60) return null;
  const hi = L <= 20 ? 99 : 999;
  const cands = [];
  for (let n = r + L; n <= hi; n += L) if (n >= 10) cands.push(n);
  if (cands.length < 2) return null;
  const maxN = Math.max(...cands);
  const digitLabel = hi === 99 ? '2けた' : '3けた';
  return { question: `${d1}でわっても${d2}でわっても${r}あまる${digitLabel}の整数のうち、最も大きいものを求めなさい。`, answer: String(maxN), meaning: `${d1}と${d2}の最小公倍数は${L}。${L}×k＋${r}の形で${digitLabel}最大：${maxN}` };
}
function g5_d4() { // 簡単な虫食い算：□XY が 7の倍数になる□を求める（一意になるまで生成）
  const div = pick([7, 11, 13]);
  const suffix = randInt(10, 99);
  const cands = [];
  for (let d = 1; d <= 9; d++) {
    const n = d * 100 + suffix;
    if (n % div === 0) cands.push(d);
  }
  if (cands.length !== 1) return null;
  return { question: `3けたの整数「□${suffix}」は${div}の倍数です。□にあてはまる数字を求めなさい。（□は1〜9のいずれか）`, answer: String(cands[0]), meaning: `${cands[0]}${suffix}＝${cands[0] * 100 + suffix}＝${div}×${(cands[0] * 100 + suffix) / div}` };
}

// ===== 小6 =====
function g6_d1() { // 約数の総和
  const n = randInt(100, 999);
  return { question: `${n}の約数の総和を求めなさい。`, answer: String(sumDivisors(n)), meaning: `${n}の約数をすべて足すと${sumDivisors(n)}` };
}
function g6_d2() { // 連続する整数の和
  const count = pick([3, 5]);
  const mid = randInt(20, 300);
  const sum = mid * count;
  const askType = pick(['mid', 'max']);
  if (askType === 'mid') {
    return { question: `連続する${count}つの整数の和が${sum}のとき、真ん中の数を求めなさい。`, answer: String(mid), meaning: `${sum}÷${count}＝${mid}` };
  }
  const maxV = mid + Math.floor(count / 2);
  return { question: `連続する${count}つの整数の和が${sum}のとき、最も大きい数を求めなさい。`, answer: String(maxV), meaning: `真ん中は${mid}、最大は${maxV}` };
}
function g6_d3() { // 剰余（2条件、300に最も近い数を探す）
  const d1 = randInt(6, 15), d2 = randInt(6, 20);
  if (d1 === d2) return null;
  const r = randInt(1, Math.min(d1, d2) - 1);
  const L = lcm(d1, d2);
  if (L > 200 || L < 20) return null;
  const target = randInt(200, 500);
  let best = null, bestDiff = Infinity;
  for (let n = r; n <= 999; n += L) {
    if (n < 10) continue;
    const diff = Math.abs(n - target);
    if (diff < bestDiff) { bestDiff = diff; best = n; }
  }
  if (best === null) return null;
  return { question: `${d1}でわっても${d2}でわっても${r}あまる整数のうち、${target}に最も近いものを求めなさい。`, answer: String(best), meaning: `${d1}と${d2}の最小公倍数は${L}。${L}の倍数＋${r}の中で${target}に最も近いのは${best}` };
}
function g6_d4() { // 灘中レベル複合：2条件の剰余のうち最小の3桁
  const d1 = randInt(6, 15), d2 = randInt(6, 20);
  if (d1 === d2) return null;
  const r1 = randInt(1, d1 - 1), r2 = randInt(1, d2 - 1);
  const cands = [];
  for (let n = 100; n <= 999; n++) {
    if (n % d1 === r1 && n % d2 === r2) cands.push(n);
  }
  if (cands.length === 0) return null;
  const minN = Math.min(...cands);
  return { question: `${d1}でわると${r1}あまり、${d2}でわると${r2}あまる3けたの整数のうち、最も小さいものを求めなさい。`, answer: String(minN), meaning: `条件を満たす最小の3けたの整数：${minN}` };
}

const GENERATORS = {
  4: [g4_d1, g4_d2, g4_d3, g4_d4],
  5: [g5_d1, g5_d2, g5_d3, g5_d4],
  6: [g6_d1, g6_d2, g6_d3, g6_d4],
};

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

const all = [];
let idCounter = 1;
for (let grade = 4; grade <= 6; grade++) {
  for (let diff = 1; diff <= 4; diff++) {
    const fn = GENERATORS[grade][diff - 1];
    const items = genN(fn, 20);
    items.forEach(it => {
      all.push({ id: `sn${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  }
}
fs.writeFileSync(path.join(__dirname, '..', 'data', 'sansu_kazu.json'), JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問を書き出しました`);
