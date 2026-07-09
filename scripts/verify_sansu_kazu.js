// sansu_kazu.json を独立実装で再検証
const data = require('../data/sansu_kazu.json');

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
function lcm(a, b) { return a / gcd(a, b) * b; }
function factorize(n) {
  const f = {}; let x = n, d = 2;
  while (d * d <= x) { while (x % d === 0) { f[d] = (f[d] || 0) + 1; x /= d; } d++; }
  if (x > 1) f[x] = (f[x] || 0) + 1;
  return f;
}
function countDivisors(n) { return Object.values(factorize(n)).reduce((a, e) => a * (e + 1), 1); }
function sumDivisors(n) {
  const f = factorize(n);
  return Object.entries(f).reduce((acc, [p, e]) => { p = Number(p); let s = 0; for (let i = 0; i <= e; i++) s += Math.pow(p, i); return acc * s; }, 1);
}
function divisorsOf(n) { const out = []; for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i); return out; }

let checked = 0, failed = 0;
const fail = (q, detail) => { failed++; console.log(`NG ${q.id}: ${q.question} => ${q.answer}  [${detail}]`); };

data.forEach(q => {
  let m;
  if ((m = q.question.match(/^(\d+)の約数は全部で何個/))) {
    checked++;
    const n = Number(m[1]);
    if (String(countDivisors(n)) !== q.answer) fail(q, `期待${countDivisors(n)}`);
  } else if ((m = q.question.match(/^(\d+)と(\d+)の最大公約数/))) {
    checked++;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (String(gcd(a, b)) !== q.answer) fail(q, `期待${gcd(a, b)}`);
  } else if ((m = q.question.match(/^(\d+)を素因数分解したとき、最も大きい素因数/))) {
    checked++;
    const n = Number(m[1]);
    const primes = Object.keys(factorize(n)).map(Number);
    if (String(Math.max(...primes)) !== q.answer) fail(q, `期待${Math.max(...primes)}`);
  } else if ((m = q.question.match(/^(\d+)を□でわると(\d+)あまります。□にあてはまる数のうち、最も大きい/))) {
    checked++;
    const [n, r] = [Number(m[1]), Number(m[2])];
    const cands = divisorsOf(n - r).filter(x => x > r);
    if (String(Math.max(...cands)) !== q.answer) fail(q, `期待${Math.max(...cands)}`);
  } else if ((m = q.question.match(/^(\d+)と(\d+)と(\d+)の最小公倍数/))) {
    checked++;
    const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const l = lcm(lcm(a, b), c);
    if (String(l) !== q.answer) fail(q, `期待${l}`);
  } else if ((m = q.question.match(/^(\d+)でわっても(\d+)でわっても(\d+)あまる(\d)けたの整数のうち、最も大きい/))) {
    checked++;
    const [d1, d2, r, digits] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const hi = digits === 2 ? 99 : 999;
    const L = lcm(d1, d2);
    let best = null;
    for (let n = r; n <= hi; n += L) if (n >= 10 && n > best) best = n;
    if (String(best) !== q.answer) fail(q, `期待${best}`);
  } else if ((m = q.question.match(/^3けたの整数「□(\d+)」は(\d+)の倍数です/))) {
    checked++;
    const [suffix, div] = [Number(m[1]), Number(m[2])];
    const cands = [];
    for (let d = 1; d <= 9; d++) if ((d * 100 + suffix) % div === 0) cands.push(d);
    if (cands.length !== 1 || String(cands[0]) !== q.answer) fail(q, `期待${cands}`);
  } else if ((m = q.question.match(/^(\d+)の約数の総和/))) {
    checked++;
    const n = Number(m[1]);
    if (String(sumDivisors(n)) !== q.answer) fail(q, `期待${sumDivisors(n)}`);
  } else if ((m = q.question.match(/^連続する(\d+)つの整数の和が(\d+)のとき、真ん中の数/))) {
    checked++;
    const [cnt, sum] = [Number(m[1]), Number(m[2])];
    if (String(sum / cnt) !== q.answer) fail(q, `期待${sum / cnt}`);
  } else if ((m = q.question.match(/^連続する(\d+)つの整数の和が(\d+)のとき、最も大きい数/))) {
    checked++;
    const [cnt, sum] = [Number(m[1]), Number(m[2])];
    const mid = sum / cnt, maxV = mid + Math.floor(cnt / 2);
    if (String(maxV) !== q.answer) fail(q, `期待${maxV}`);
  } else if ((m = q.question.match(/^(\d+)でわっても(\d+)でわっても(\d+)あまる整数のうち、(\d+)に最も近い/))) {
    checked++;
    const [d1, d2, r, target] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const L = lcm(d1, d2);
    let best = null, bestDiff = Infinity;
    for (let n = r; n <= 999; n += L) { if (n < 10) continue; const diff = Math.abs(n - target); if (diff < bestDiff) { bestDiff = diff; best = n; } }
    if (String(best) !== q.answer) fail(q, `期待${best}`);
  } else if ((m = q.question.match(/^(\d+)でわると(\d+)あまり、(\d+)でわると(\d+)あまる3けたの整数のうち、最も小さい/))) {
    checked++;
    const [d1, r1, d2, r2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    let minN = null;
    for (let n = 100; n <= 999; n++) if (n % d1 === r1 && n % d2 === r2) { minN = n; break; }
    if (String(minN) !== q.answer) fail(q, `期待${minN}`);
  } else {
    console.log('UNMATCHED PATTERN:', q.id, q.question);
  }
});

console.log(`\n検証: ${checked}問 / 不一致: ${failed}問 / 総数: ${data.length}`);
for (let g = 4; g <= 6; g++) for (let d = 1; d <= 4; d++) {
  const c = data.filter(q => q.grade === g && q.difficulty === d).length;
  if (c !== 20) console.log(`⚠ grade${g} diff${d}: ${c}問`);
}
const ids = new Set(data.map(q => q.id));
console.log('ID重複:', ids.size !== data.length ? 'あり' : 'なし');
