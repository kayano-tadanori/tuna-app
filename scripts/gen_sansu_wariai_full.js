// sansu_wariai.json（割合と比）を小5〜6全難易度で3倍に拡張（グレード5-6のみ、grade4は履修範囲外のため無し）
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }

// ===== 小5 難易度1：割合⇔百分率の基礎 =====
function g5_d1a() { // 小数を百分率に
  const n = randInt(1, 199);
  const dec = n / 100;
  return { question: `小数${dec}を百分率で表すと何%ですか？`, answer: String(n), meaning: `${dec}×100＝${n}%` };
}
function g5_d1b() { // 百分率を小数に
  const n = randInt(1, 199);
  const dec = n / 100;
  return { question: `${n}%を小数で表すと？`, answer: String(dec), meaning: `${n}÷100＝${dec}` };
}
function g5_d1c() { // AはBの何%
  const b = randInt(2, 40) * 5, pct = pick([10, 20, 25, 40, 50, 60, 75, 80]);
  const a = b * pct / 100;
  if (!Number.isInteger(a)) return null;
  return { question: `${a}は${b}の何%ですか？`, answer: String(pct), meaning: `${a}÷${b}×100＝${pct}%` };
}
function g5_d1d() { // BのA%はいくつ
  const b = randInt(2, 40) * 5, pct = pick([10, 20, 25, 40, 50, 60, 75, 80]);
  const a = b * pct / 100;
  if (!Number.isInteger(a)) return null;
  return { question: `${b}の${pct}%はいくつですか？`, answer: String(a), meaning: `${b}×${pct}÷100＝${a}` };
}
function g5_d1() { return pick([g5_d1a, g5_d1b, g5_d1c, g5_d1d])(); }

// ===== 小5 難易度2：割合の応用 =====
function g5_d2a() { // 割N分N厘を%に
  const wari = randInt(1, 9), bu = randInt(0, 9);
  const pct = wari * 10 + bu;
  return { question: `${wari}割${bu}分は何%ですか？`, answer: String(pct), meaning: `${wari}割＝${wari * 10}%、${bu}分＝${bu}%、合計${pct}%` };
}
function g5_d2b() { // 割合から全体を求める逆算
  const pct = pick([10, 20, 25, 40, 50]);
  const total = randInt(2, 60) * (100 / gcd(100, pct));
  const part = total * pct / 100;
  if (!Number.isInteger(part) || part <= 0) return null;
  return { question: `ある数の${pct}%が${part}です。ある数はいくつですか？`, answer: String(total), meaning: `${part}÷${pct}×100＝${total}` };
}
function g5_d2c() { // 割増し
  const base = randInt(50, 500), pct = pick([10, 15, 20, 25, 30]);
  const val = base * (100 + pct) / 100;
  if (!Number.isInteger(val)) return null;
  return { question: `${base}円の${pct}%増しは何円ですか？`, answer: String(val), meaning: `${base}×(1＋${pct}/100)＝${val}` };
}
function g5_d2d() { // 割引
  const base = randInt(50, 500), pct = pick([10, 15, 20, 25, 30]);
  const val = base * (100 - pct) / 100;
  if (!Number.isInteger(val)) return null;
  return { question: `${base}mの${pct}%引きは何mですか？`, answer: String(val), meaning: `${base}×(1－${pct}/100)＝${val}` };
}
function g5_d2() { return pick([g5_d2a, g5_d2b, g5_d2c, g5_d2d])(); }

// ===== 小5 難易度3・4：連比・差一定算 =====
function typeRenpi() {
  const a1 = randInt(2, 9), b1 = randInt(2, 9);
  if (gcd(a1, b1) !== 1 || a1 === b1) return null;
  const b2 = randInt(2, 9), c2 = randInt(2, 9);
  if (gcd(b2, c2) !== 1 || b2 === c2) return null;
  const L = b1 * b2 / gcd(b1, b2);
  const A = a1 * (L / b1), B = L, C = c2 * (L / b2);
  const g = gcd(gcd(A, B), C);
  const p = A / g, q = B / g, r = C / g;
  if (p > 200 || q > 200 || r > 200 || p === q || q === r) return null;
  return {
    question: `A：B＝${a1}：${b1}、B：C＝${b2}：${c2}のとき、A：B：Cを最も簡単な整数の比で表すと${p}：${q}：□です。□に入る数を求めなさい。`,
    answer: String(r),
    meaning: `B を${L}にそろえると A＝${A}、B＝${B}、C＝${C}。最も簡単にすると${p}：${q}：${r}`,
  };
}
function typeRenpiKotae2ban() {
  const a1 = randInt(2, 9), b1 = randInt(2, 9);
  if (gcd(a1, b1) !== 1 || a1 === b1) return null;
  const b2 = randInt(2, 9), c2 = randInt(2, 9);
  if (gcd(b2, c2) !== 1 || b2 === c2) return null;
  const L = b1 * b2 / gcd(b1, b2);
  const A = a1 * (L / b1), B = L, C = c2 * (L / b2);
  const g = gcd(gcd(A, B), C);
  const p = A / g, q = B / g, r = C / g;
  if (p > 200 || q > 200 || r > 200 || p === q || q === r) return null;
  return {
    question: `A：B＝${a1}：${b1}、B：C＝${b2}：${c2}のとき、A：B：Cを最も簡単な整数の比で表すと${p}：□：${r}です。□に入る数を求めなさい。`,
    answer: String(q),
    meaning: `B を${L}にそろえると A＝${A}、B＝${B}、C＝${C}。最も簡単にすると${p}：${q}：${r}`,
  };
}
function typeSaIchitei() {
  const a = randInt(2, 9), b = randInt(2, 9);
  if (gcd(a, b) !== 1 || a === b) return null;
  const k = randInt(2, 30);
  const A0 = a * k, B0 = b * k;
  const p = randInt(2, 9), q = randInt(2, 9);
  if (gcd(p, q) !== 1 || p === q) return null;
  if (a * q <= b * p) return null;
  const loM = Math.floor(B0 / q) + 1;
  const hiM = Math.ceil(A0 / p) - 1;
  if (loM > hiM) return null;
  const m = randInt(loM, hiM);
  const newA = p * m, newB = q * m;
  let x = A0 - newA, y = newB - B0;
  if (x <= 0 || y <= 0) return null;
  const scale = randInt(20, 150);
  x *= scale; y *= scale;
  const B0scaled = B0 * scale;
  if (x > 50000 || y > 50000 || B0scaled > 200000) return null;
  return {
    question: `AさんとBさんの貯金額の比は${a}：${b}でした。ところが、Aさんが${x}円使い、Bさんが${y}円貯金したので、Aさんと Bさんの貯金額の比は${p}：${q}になりました。はじめにBさんは何円貯金していましたか。`,
    answer: String(B0scaled),
    meaning: `比の1あたり＝${k * scale}円、B＝${b}×${k * scale}＝${B0scaled}円`,
  };
}
function g_d3() { return pick([typeRenpi, typeRenpiKotae2ban])(); }
function g_d4() { return typeSaIchitei(); }

// ===== 小6 難易度1：比の基礎 =====
function g6_d1a() { // 比の簡約
  const g = randInt(2, 12), m1 = randInt(2, 15), m2 = randInt(2, 15);
  if (m1 === m2 || gcd(m1, m2) !== 1) return null;
  const a = g * m1, b = g * m2;
  return { question: `${a}：${b} を最も簡単な整数の比にすると ${m1}：□ です。□に入る数は？`, answer: String(m2), meaning: `${a}：${b}＝${m1}：${m2}（${g}で約分）` };
}
function g6_d1b() { // 比の値
  const m1 = randInt(2, 15), m2 = randInt(2, 15);
  if (gcd(m1, m2) !== 1) return null;
  let d = m2;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  if (d !== 1) return null; // m2が2・5以外の素因数を持つ→有限小数にならない
  const val = Number((m1 / m2).toFixed(6));
  return { question: `${m1}：${m2} の比の値を小数で表すと？`, answer: String(val), meaning: `${m1}÷${m2}＝${val}` };
}
function g6_d1c() { // 比例式 A:B=C:□
  const a = randInt(2, 12), b = randInt(2, 12);
  if (gcd(a, b) !== 1) return null;
  const k = randInt(2, 15);
  const c = a * k, d = b * k;
  return { question: `${a}：${b} ＝ ${c}：□　□に入る数は？`, answer: String(d), meaning: `${a}：${b}を${k}倍して${c}：${d}` };
}
function g6_d1d() { // 比例式 □:B=C:D
  const a = randInt(2, 12), b = randInt(2, 12);
  if (gcd(a, b) !== 1) return null;
  const k = randInt(2, 15);
  const c = a * k, d = b * k;
  return { question: `□：${b} ＝ ${c}：${d}　□に入る数は？`, answer: String(a), meaning: `${c}：${d}を最も簡単にすると${a}：${b}` };
}
function g6_d1() { return pick([g6_d1a, g6_d1b, g6_d1c, g6_d1d])(); }

// ===== 小6 難易度2：比の応用 =====
function g6_d2a() { // 2者に分ける
  const total = randInt(10, 200), r1 = randInt(1, 9), r2 = randInt(1, 9);
  if (r1 === r2 || total % (r1 + r2) !== 0) return null;
  const unit = total / (r1 + r2);
  return { question: `${total}円を${r1}：${r2}に分けます。多い方は何円ですか？`, answer: String(unit * Math.max(r1, r2)), meaning: `${total}÷(${r1}＋${r2})×${Math.max(r1, r2)}＝${unit * Math.max(r1, r2)}` };
}
function g6_d2b() { // 3者に分ける
  const r1 = randInt(1, 6), r2 = randInt(1, 6), r3 = randInt(1, 6);
  const unit = randInt(2, 30);
  const total = (r1 + r2 + r3) * unit;
  const maxR = Math.max(r1, r2, r3);
  return { question: `${total}こを${r1}：${r2}：${r3}に分けます。一番多い人は何こもらえますか？`, answer: String(unit * maxR), meaning: `${total}÷(${r1}＋${r2}＋${r3})×${maxR}＝${unit * maxR}` };
}
function g6_d2c() { // 男女比文章題
  const r1 = randInt(1, 6), r2 = randInt(1, 6);
  if (r1 === r2) return null;
  const unit = randInt(2, 20);
  const total = (r1 + r2) * unit;
  return { question: `クラスの男子と女子の人数の比は${r1}：${r2}で、全体は${total}人です。男子は何人ですか？`, answer: String(unit * r1), meaning: `${total}÷(${r1}＋${r2})×${r1}＝${unit * r1}` };
}
function g6_d2d() { // AがNのときB
  const r1 = randInt(1, 9), r2 = randInt(1, 9);
  if (gcd(r1, r2) !== 1) return null;
  const k = randInt(2, 20);
  const a = r1 * k, b = r2 * k;
  return { question: `AとBの比は${r1}：${r2}です。Aが${a}のとき、Bはいくつですか？`, answer: String(b), meaning: `${a}÷${r1}×${r2}＝${b}` };
}
function g6_d2() { return pick([g6_d2a, g6_d2b, g6_d2c, g6_d2d])(); }

const GENERATORS = {
  5: [g5_d1, g5_d2, g_d3, g_d4],
  6: [g6_d1, g6_d2, g_d3, g_d4],
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
[5, 6].forEach(grade => {
  for (let diff = 1; diff <= 4; diff++) {
    const fn = GENERATORS[grade][diff - 1];
    const items = genN(fn, 60);
    items.forEach(it => {
      all.push({ id: `sw${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  }
});

const filePath = path.join(__dirname, '..', 'data', 'sansu_wariai.json');
fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問`);
