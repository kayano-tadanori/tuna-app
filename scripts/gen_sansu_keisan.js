// sansu_keisan.json 生成スクリプト（Node.jsで実行、厳密な分数計算で答えを検証）
const fs = require('fs');
const path = require('path');

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
class Frac {
  constructor(n, d = 1) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = g === 0 ? 0 : n / g; this.d = g === 0 ? 1 : d / g;
  }
  add(o) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Frac(this.n * o.n, this.d * o.d); }
  div(o) { return new Frac(this.n * o.d, this.d * o.n); }
  isInt() { return this.d === 1; }
  toDecimalString() {
    let d = this.d;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    if (d !== 1) return null;
    return Number((this.n / this.d).toFixed(10)).toString();
  }
  // アプリの解答欄フォーマット（整数 / 小数 / 仮分数 / 帯分数）を返す。優先順位: 整数 > 有限小数 > 分数
  toAnswerString(preferMixed) {
    if (this.d === 1) return String(this.n);
    const dec = this.toDecimalString();
    if (dec !== null && !preferMixed) return dec;
    if (Math.abs(this.n) > this.d && preferMixed) {
      const whole = Math.trunc(this.n / this.d);
      const rem = Math.abs(this.n - whole * this.d);
      if (rem === 0) return String(whole);
      return `${whole}と${rem}/${this.d}`;
    }
    return `${this.n}/${this.d}`;
  }
  toString() { return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`; }
}
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

// ============================================================
// 小1
// ============================================================
function g1_d1() { // 1桁+1桁（繰り上がりなし中心）
  const a = randInt(1, 8), b = randInt(1, 9 - a);
  return { question: `${a} ＋ ${b} ＝ □`, answer: String(a + b), meaning: `${a}＋${b}＝${a + b}` };
}
function g1_d2() { // 1桁ひき算
  const a = randInt(2, 9), b = randInt(1, a);
  return { question: `${a} － ${b} ＝ □`, answer: String(a - b), meaning: `${a}－${b}＝${a - b}` };
}
function g1_d3() { // くり上がり逆算 □+a=b
  const a = randInt(1, 9), ans = randInt(1, 9), b = a + ans;
  return { question: `□ ＋ ${a} ＝ ${b}`, answer: String(ans), meaning: `${b}－${a}＝${ans}` };
}
function g1_d4() { // 3口のたし算
  const a = randInt(1, 6), b = randInt(1, 6), c = randInt(1, 6);
  return { question: `${a} ＋ ${b} ＋ ${c} ＝ □`, answer: String(a + b + c), meaning: `${a}＋${b}＋${c}＝${a + b + c}` };
}

// ============================================================
// 小2
// ============================================================
function g2_d1() { // 2桁+1〜2桁
  const a = randInt(10, 89), b = randInt(1, 10);
  return { question: `${a} ＋ ${b} ＝ □`, answer: String(a + b), meaning: `${a}＋${b}＝${a + b}` };
}
function g2_d2() { // 2桁ひき算（繰り下がりあり）
  const b = randInt(11, 89), a = b + randInt(1, 20);
  return { question: `${a} － ${b} ＝ □`, answer: String(a - b), meaning: `${a}－${b}＝${a - b}` };
}
function g2_d3() { // 九九
  const a = randInt(2, 9), b = randInt(2, 9);
  return { question: `${a} × ${b} ＝ □`, answer: String(a * b), meaning: `${a}×${b}＝${a * b}` };
}
function g2_d4() { // かけ算+たし算複合
  const a = randInt(2, 9), b = randInt(2, 9), c = randInt(1, 9);
  return { question: `${a} × ${b} ＋ ${c} ＝ □`, answer: String(a * b + c), meaning: `${a}×${b}＝${a * b}、${a * b}＋${c}＝${a * b + c}` };
}

// ============================================================
// 小3
// ============================================================
function g3_d1() { // 3桁たし算
  const a = randInt(100, 899), b = randInt(10, 99);
  return { question: `${a} ＋ ${b} ＝ □`, answer: String(a + b), meaning: `${a}＋${b}＝${a + b}` };
}
function g3_d2() { // わり算（あまりなし）
  const d = randInt(2, 9), q = randInt(2, 12), n = d * q;
  return { question: `${n} ÷ ${d} ＝ □`, answer: String(q), meaning: `${n}÷${d}＝${q}` };
}
function g3_d3() { // 型F：分数÷分数（単発）
  const target = new Frac(randInt(1, 6), randInt(1, 4));
  const qn = randInt(2, 9), qd = randInt(2, 9);
  if (gcd(qn, qd) !== 1) return null;
  const q = new Frac(qn, qd);
  const p = target.mul(q);
  const inflate = randInt(2, 6);
  const pi = { n: p.n * inflate, d: p.d * inflate };
  if (pi.n > 80 || pi.d > 80 || pi.n === 0) return null;
  const ansStr = target.toAnswerString(false);
  if (ansStr === null) return null;
  if (ansStr.includes('.') && ansStr.split('.')[1].length > 2) return null;
  return { question: `${pi.n}/${pi.d} ÷ ${qn}/${qd} ＝ □`, answer: ansStr, meaning: `${new Frac(pi.n, pi.d)}÷${q}＝${target}` };
}
function g3_d4() { // 型G：帯分数÷整数
  const X = randInt(3, 30);
  const targetDenom = pick([1, 2, 4, 5, 10]);
  const targetNum = randInt(1, targetDenom * 6);
  const target = new Frac(targetNum, targetDenom);
  const mixedA = target.mul(new Frac(X, 1));
  if (mixedA.d > 12) return null;
  const whole = Math.floor(mixedA.n / mixedA.d);
  const remN = mixedA.n - whole * mixedA.d;
  if (remN === 0 || whole < 1 || whole > 6) return null;
  const ansStr = target.toAnswerString(false);
  if (ansStr === null) return null;
  if (ansStr.includes('.') && ansStr.split('.')[1].length > 2) return null;
  return { question: `${whole}と${remN}/${mixedA.d} ÷ ${X} ＝ □`, answer: ansStr, meaning: `${mixedA}÷${X}＝${target}` };
}

// ============================================================
// 小4
// ============================================================
function g4_d1() { // 同分母分数たし算（分数のまま答える。1を超える場合は帯分数）
  const den = randInt(3, 9);
  const n1 = randInt(1, den - 1), n2 = randInt(1, den - 1);
  const sum = new Frac(n1 + n2, den);
  const ansStr = sum.toAnswerString(true);
  if (ansStr === null) return null;
  return { question: `${n1}/${den} ＋ ${n2}/${den} ＝ □`, answer: ansStr, meaning: `${n1}/${den}＋${n2}/${den}＝${sum}` };
}
function g4_d2() { // 同分母分数ひき算（□に入る数）
  const den = randInt(4, 12);
  const n2 = randInt(1, den - 2), diff = randInt(1, den - 1 - n2), n1 = n2 + diff;
  return { question: `${n1}/${den} － ${n2}/${den} ＝ □/${den}　□に入る数は？`, answer: String(diff), meaning: `${n1}－${n2}＝${diff}` };
}
function g4_d3() { // 型D簡易版：小数の逆算（1ステップ）
  const a = randInt(2, 20) / 2;
  const b = randInt(2, 20);
  const left = a * b;
  const divisor = pick([2, 4, 5]);
  const cn = Math.round(randInt(10, 90) / divisor) * divisor / 100;
  const rightPart = Number((cn / divisor).toFixed(4));
  const final = Number((left + rightPart).toFixed(4));
  if (!Number.isInteger(final * 100)) return null;
  return { question: `${a}×${b}＋${cn.toFixed(2)}÷□＝${final}　□に入る数は？`, answer: String(divisor), meaning: `${a}×${b}＝${left}、${cn.toFixed(2)}÷□＝${rightPart}` };
}
function g4_d4() { // 型C：帯分数×□＝target
  const target = randInt(2, 12);
  const b1d = randInt(2, 6), b1n = randInt(1, b1d - 1);
  if (gcd(b1n, b1d) !== 1) return null;
  const whole = randInt(1, 3);
  const mixed1 = new Frac(whole * b1d + b1n, b1d);
  const X = new Frac(target, 1).div(mixed1);
  if (X.d > 30 || X.n > 100) return null;
  const ansStr = X.toAnswerString(true);
  if (ansStr === null) return null;
  if (ansStr.includes('.') && ansStr.split('.')[1].length > 2) return null;
  return { question: `${whole}と${b1n}/${b1d} × □ ＝ ${target}　□に入る数は？`, answer: ansStr, meaning: `${mixed1}×X=${target} → X=${X}` };
}

// ============================================================
// 小5
// ============================================================
function g5_d1() { // 分数⇔小数変換
  const den = pick([2, 4, 5, 8, 10, 20, 25]);
  const num = randInt(1, den - 1);
  const f = new Frac(num, den);
  const dec = f.toDecimalString();
  if (dec === null) return null;
  return { question: `${num}/${den} を小数で表すと？`, answer: dec, meaning: `${num}÷${den}＝${dec}` };
}
function g5_d2() { // 異分母分数たし算（□に入る数、通分先固定）
  const d1 = randInt(2, 6), d2 = randInt(2, 6);
  if (d1 === d2) return null;
  const lcm = d1 * d2 / gcd(d1, d2);
  const n1 = randInt(1, d1 - 1), n2 = randInt(1, d2 - 1);
  const sumNum = n1 * (lcm / d1) + n2 * (lcm / d2);
  if (sumNum >= lcm * 2) return null;
  return { question: `${n1}/${d1} ＋ ${n2}/${d2} ＝ □/${lcm}　□に入る数は？`, answer: String(sumNum), meaning: `通分して${n1 * (lcm / d1)}/${lcm}＋${n2 * (lcm / d2)}/${lcm}＝${sumNum}/${lcm}` };
}
function g5_d3() { // 型D：小数の逆算（浜学園④相当）
  const a = randInt(2, 20) / 2, b = randInt(2, 30);
  const left = a * b;
  const cn = randInt(10, 99) / 100, dn = randInt(10, 99) / 100;
  if (cn <= dn) return null;
  const diff = Number((cn - dn).toFixed(2));
  const divisor = pick([2, 4, 5, 10]);
  const rightPart = Number((diff / divisor).toFixed(4));
  const final = Number((left + rightPart).toFixed(4));
  if (!Number.isInteger(final * 100)) return null;
  return {
    question: `${a}×${b}＋(${cn.toFixed(2)}－${dn.toFixed(2)})÷□＝${final}　□に入る数は？`,
    answer: String(divisor),
    meaning: `${a}×${b}＝${left}、(${cn.toFixed(2)}－${dn.toFixed(2)})＝${diff}、÷□＝${rightPart}`
  };
}
function g5_d4_typeA() { // 分配法則型
  const a = randInt(4, 25);
  const partsCount = pick([3, 4]);
  const total10 = randInt(8, 30);
  let remain = total10 * 10;
  const parts = [];
  for (let i = 0; i < partsCount - 1; i++) {
    const maxPart = remain - (partsCount - 1 - i);
    const p = randInt(1, Math.max(1, maxPart - 1));
    parts.push(p); remain -= p;
  }
  parts.push(remain);
  if (parts.some(p => p <= 0)) return null;
  const decs = parts.map(p => (p / 100).toFixed(2));
  const answer = new Frac(a * total10, 10);
  const ansStr = answer.toAnswerString(false);
  if (ansStr === null) return null;
  return { question: decs.map(d => `${a}×${d}`).join('＋') + ' ＝ □', answer: ansStr, meaning: `${a}×(${decs.join('+')})=${a}×${(total10 / 10).toFixed(1)}` };
}
function g5_d4_typeB() { // 分数約分誘導型
  const target = randInt(1, 8);
  const xn = randInt(2, 9), xd = randInt(2, 9);
  if (gcd(xn, xd) !== 1) return null;
  const x = new Frac(xn, xd);
  const yn = randInt(2, 9), yd = randInt(2, 9);
  if (gcd(yn, yd) !== 1) return null;
  const y = new Frac(yn, yd);
  let z = new Frac(target, 1).mul(y).div(x);
  if (z.n <= 0 || z.d <= 0 || z.n > 400 || z.d > 400) return null;
  const inflate = (f) => { const k = randInt(2, 6); return { n: f.n * k, d: f.d * k }; };
  const xi = inflate(x), yi = inflate(y), zi = { n: z.n, d: z.d };
  if (xi.n > 90 || xi.d > 90 || yi.n > 90 || yi.d > 90) return null;
  const fmt = (f) => f.d === 1 ? `${f.n}` : `${f.n}/${f.d}`;
  return { question: `${xi.n}/${xi.d} ÷ ${yi.n}/${yi.d} × ${fmt(zi)} ＝ □`, answer: String(target), meaning: `${x}÷${y}×${z}=${target}` };
}
function g5_d4() { return Math.random() < 0.5 ? g5_d4_typeA() : g5_d4_typeB(); }

// ============================================================
// 小6
// ============================================================
function g6_d1() { // 分数のわり算基礎
  const an = randInt(1, 8), ad = randInt(2, 9);
  if (gcd(an, ad) !== 1) return null;
  const bn = randInt(1, 8), bd = randInt(2, 9);
  if (gcd(bn, bd) !== 1) return null;
  const A = new Frac(an, ad), B = new Frac(bn, bd);
  const ans = A.div(B);
  const ansStr = ans.toAnswerString(true);
  if (ansStr === null) return null;
  if (/\.\d{3,}/.test(ansStr)) return null;
  return { question: `${an}/${ad} ÷ ${bn}/${bd} ＝ □`, answer: ansStr, meaning: `${A}÷${B}＝${ans}` };
}
function g6_d2() { // 比+分数四則（基礎）
  if (Math.random() < 0.5) {
    const total = randInt(3, 12) * randInt(2, 6);
    const r1 = randInt(1, 5), r2 = randInt(1, 5);
    if (gcd(r1, r2) !== 1) return null;
    const unit = total / (r1 + r2);
    if (!Number.isInteger(unit)) return null;
    return { question: `${total}を${r1}：${r2}の比で分けると、大きい方は？`, answer: String(unit * Math.max(r1, r2)), meaning: `${total}÷${r1 + r2}＝${unit}、${unit}×${Math.max(r1, r2)}＝${unit * Math.max(r1, r2)}` };
  }
  const an = randInt(1, 6), ad = randInt(2, 8);
  if (gcd(an, ad) !== 1) return null;
  const bn = randInt(1, 6), bd = randInt(2, 8);
  if (gcd(bn, bd) !== 1) return null;
  const A = new Frac(an, ad), B = new Frac(bn, bd);
  const ans = A.mul(B);
  const ansStr = ans.toAnswerString(true);
  if (ansStr === null) return null;
  return { question: `${an}/${ad} × ${bn}/${bd} ＝ □`, answer: ansStr, meaning: `${A}×${B}＝${ans}` };
}
function g6_d3_typeA() { // 分配法則型（項数5・小6版）
  const a = randInt(15, 60);
  const partsCount = 5;
  const total10 = randInt(15, 40);
  let remain = total10 * 10;
  const parts = [];
  for (let i = 0; i < partsCount - 1; i++) {
    const maxPart = remain - (partsCount - 1 - i);
    const p = randInt(1, Math.max(1, maxPart - 1));
    parts.push(p); remain -= p;
  }
  parts.push(remain);
  if (parts.some(p => p <= 0)) return null;
  const decs = parts.map(p => (p / 100).toFixed(2));
  const answer = new Frac(a * total10, 10);
  const ansStr = answer.toAnswerString(false);
  if (ansStr === null) return null;
  return { question: decs.map(d => `${a}×${d}`).join('＋') + ' ＝ □', answer: ansStr, meaning: `${a}×(${decs.join('+')})=${a}×${(total10 / 10).toFixed(1)}` };
}
function g6_d3_typeB() { // 分数約分誘導型（4項連鎖）
  const target = randInt(1, 10);
  const xn = randInt(2, 12), xd = randInt(2, 12);
  if (gcd(xn, xd) !== 1) return null;
  const x = new Frac(xn, xd);
  const yn = randInt(2, 12), yd = randInt(2, 12);
  if (gcd(yn, yd) !== 1) return null;
  const y = new Frac(yn, yd);
  const wn = randInt(2, 12), wd = randInt(2, 12);
  if (gcd(wn, wd) !== 1) return null;
  const w = new Frac(wn, wd);
  let z = x.div(y).mul(w).div(new Frac(target, 1));
  if (z.n <= 0 || z.d <= 0) return null;
  const inflate = (f) => { const k = randInt(2, 5); return { n: f.n * k, d: f.d * k }; };
  const xi = inflate(x), yi = inflate(y), wi = inflate(w), zi = { n: z.n, d: z.d };
  if ([xi, yi, wi, zi].some(f => f.n > 90 || f.d > 90)) return null;
  const fmt = (f) => f.d === 1 ? `${f.n}` : `${f.n}/${f.d}`;
  return { question: `${xi.n}/${xi.d} ÷ ${yi.n}/${yi.d} × ${wi.n}/${wi.d} ÷ ${fmt(zi)} ＝ □`, answer: String(target), meaning: `${x}÷${y}×${w}÷${z}=${target}` };
}
function g6_d3() { return Math.random() < 0.5 ? g6_d3_typeA() : g6_d3_typeB(); }
function g6_d4() { // 型E：波かっこ入れ子型
  const a2 = randInt(2, 8), a1 = randInt(1, a2 - 1);
  if (gcd(a1, a2) !== 1) return null;
  const b2 = randInt(2, 8), b1 = randInt(1, b2 - 1);
  if (gcd(b1, b2) !== 1) return null;
  const A = new Frac(a1, a2), B = new Frac(b1, b2);
  const inner1 = A.add(B);
  const c2 = randInt(2, 8), c1 = randInt(1, c2 * 2);
  if (gcd(c1, c2) !== 1 || c1 === 0) return null;
  const C = new Frac(c1, c2);
  const d2 = randInt(2, 6), d1 = randInt(1, d2 - 1);
  if (gcd(d1, d2) !== 1) return null;
  const D = new Frac(d1, d2);
  const inner2 = inner1.div(C).sub(D);
  const eWhole = randInt(2, 8);
  const e2 = randInt(2, 6), e1 = randInt(1, e2 - 1);
  if (gcd(e1, e2) !== 1) return null;
  const E = new Frac(eWhole * e2 + e1, e2);
  const beforeF = inner2.mul(E);
  const target = randInt(1, 15);
  const F = beforeF.sub(new Frac(target, 1));
  if (F.n <= 0 || F.d <= 0 || F.d > 40 || F.n > 200) return null;
  const fWhole = Math.floor(F.n / F.d);
  const fRemN = F.n - fWhole * F.d;
  const fStr = fRemN === 0 ? `${fWhole}` : (fWhole > 0 ? `${fWhole}と${fRemN}/${F.d}` : `${F.n}/${F.d}`);
  const question = `｛(${a1}/${a2}＋${b1}/${b2})÷${C.n}/${C.d}－${d1}/${d2}｝×${eWhole}と${e1}/${e2}－${fStr} ＝ □`;
  return { question, answer: String(target), meaning: `(${A}+${B})=${inner1}, ÷${C}-${D}=${inner2}, ×${E}=${beforeF}, -${F}=${target}` };
}

// ============================================================
// 生成実行
// ============================================================
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
  while (out.length < n && tries < 30000) {
    tries++;
    const r = fn();
    if (!r) continue;
    const key = r.question;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  if (out.length < n) throw new Error(`生成不足: ${n}問中${out.length}問しか作れませんでした`);
  return out;
}

const all = [];
let idCounter = 1;
for (let grade = 1; grade <= 6; grade++) {
  for (let diff = 1; diff <= 4; diff++) {
    const fn = GENERATORS[grade][diff - 1];
    const items = genN(fn, 20);
    items.forEach(it => {
      all.push({
        id: `sk${String(idCounter).padStart(3, '0')}`,
        question: it.question,
        answer: it.answer,
        meaning: it.meaning,
        grade, difficulty: diff,
      });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: 20問生成OK`);
  }
}

const outPath = path.join(__dirname, '..', 'data', 'sansu_keisan.json');
fs.writeFileSync(outPath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`\n合計${all.length}問を書き出しました: ${outPath}`);
