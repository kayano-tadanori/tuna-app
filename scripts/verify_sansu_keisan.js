// 生成された sansu_keisan.json を独立した数式パーサーで再検証する
const fs = require('fs');
const path = require('path');

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
class F {
  constructor(n, d = 1) { const g = gcd(n, d) || 1; const sign = d < 0 ? -1 : 1; this.n = sign * n / g; this.d = sign * d / g; }
  add(o) { return new F(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new F(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new F(this.n * o.n, this.d * o.d); }
  div(o) { return new F(this.n * o.d, this.d * o.n); }
  toDecimalString() {
    let d = this.d;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    if (d !== 1) return null;
    return Number((this.n / this.d).toFixed(10)).toString();
  }
  toAnswerCandidates() {
    // 整数 / 小数 / 仮分数 / 帯分数 のいずれの表記でも一致すればOKとする
    const cands = new Set();
    if (this.d === 1) cands.add(String(this.n));
    const dec = this.toDecimalString();
    if (dec !== null) cands.add(dec);
    cands.add(`${this.n}/${this.d}`);
    if (Math.abs(this.n) > this.d) {
      const whole = Math.trunc(this.n / this.d);
      const rem = Math.abs(this.n - whole * this.d);
      if (rem !== 0) cands.add(`${whole}と${rem}/${this.d}`);
    }
    return cands;
  }
}

// 全角→半角変換（÷は分数の「/」と区別するため独立した記号のまま残す）
function toHalfWidth(s) {
  return s.replace(/[０-９．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/＋/g, '+').replace(/－/g, '-').replace(/×/g, '*')
    .replace(/｛/g, '(').replace(/｝/g, ')').replace(/　/g, ' ');
}

// 「aとb/c」帯分数を仮分数トークンに変換してから式パース（再帰下降パーサー、F型で厳密計算）
function evalExpr(qRaw) {
  let s = toHalfWidth(qRaw);
  // 帯分数 "3と1/4" → "(3+1/4)" に変換
  s = s.replace(/(\d+)と(\d+)\/(\d+)/g, '($1+$2/$3)');
  s = s.replace(/□/g, '').trim();
  // 末尾の "= " や "="以降を除去（呼び出し側でLHSのみ渡す）
  let i = 0;
  function peek() { return s[i]; }
  function skipSpace() { while (s[i] === ' ') i++; }
  function parseNumber() {
    skipSpace();
    let start = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    const numStr = s.slice(start, i);
    let val;
    if (numStr.includes('.')) {
      const [ip, fp] = numStr.split('.');
      const d = Math.pow(10, fp.length);
      val = new F(parseInt(ip || '0') * d + parseInt(fp), d);
    } else {
      val = new F(parseInt(numStr), 1);
    }
    // 分数リテラル "n/d"（÷演算子とは別物の「/」区切り）
    if (s[i] === '/') {
      i++;
      let dstart = i;
      while (i < s.length && /[0-9]/.test(s[i])) i++;
      val = val.div(new F(parseInt(s.slice(dstart, i)), 1));
    }
    return val;
  }
  function parseFactor() {
    skipSpace();
    if (s[i] === '(') {
      i++;
      const v = parseAddSub();
      skipSpace();
      if (s[i] !== ')') throw new Error('括弧不一致: ' + s);
      i++;
      return v;
    }
    return parseNumber();
  }
  function parseMulDivFrac() {
    let v = parseFactor();
    for (;;) {
      skipSpace();
      if (s[i] === '*') { i++; v = v.mul(parseFactor()); }
      else if (s[i] === '÷') { i++; v = v.div(parseFactor()); }
      else break;
    }
    return v;
  }
  function parseAddSub() {
    let v = parseMulDivFrac();
    for (;;) {
      skipSpace();
      if (s[i] === '+') { i++; v = v.add(parseMulDivFrac()); }
      else if (s[i] === '-') { i++; v = v.sub(parseMulDivFrac()); }
      else break;
    }
    return v;
  }
  const result = parseAddSub();
  skipSpace();
  if (i !== s.length) throw new Error('パース残り: "' + s.slice(i) + '" in "' + s + '"');
  return result;
}

const filePath = path.join(__dirname, '..', 'data', 'sansu_keisan.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let checked = 0, skipped = 0, failed = 0;
const failures = [];

data.forEach(q => {
  // 「＝ □」で終わる直接評価可能な式のみ対象（□に入る数、文章題は対象外）
  const m = q.question.match(/^(.*)＝\s*□\s*$/);
  if (!m) { skipped++; return; }
  const lhs = m[1];
  try {
    const result = evalExpr(lhs);
    const candidates = result.toAnswerCandidates();
    checked++;
    if (!candidates.has(q.answer)) {
      failed++;
      failures.push({ id: q.id, question: q.question, expected: q.answer, computed: [...candidates] });
    }
  } catch (e) {
    failed++;
    failures.push({ id: q.id, question: q.question, error: e.message });
  }
});

console.log(`検証対象: ${checked}問 / スキップ(□に入る数・文章題等): ${skipped}問 / 不一致: ${failed}問`);
if (failures.length) {
  console.log('\n=== 不一致・エラー詳細 ===');
  failures.slice(0, 30).forEach(f => console.log(JSON.stringify(f, null, 0)));
}

// スキーマ・件数チェック
console.log('\n=== 件数チェック ===');
for (let g = 1; g <= 6; g++) {
  for (let d = 1; d <= 4; d++) {
    const cnt = data.filter(q => q.grade === g && q.difficulty === d).length;
    if (cnt !== 20) console.log(`⚠ grade${g} diff${d}: ${cnt}問（期待値20）`);
  }
}
console.log(`総数: ${data.length}（期待値480）`);
const ids = new Set(data.map(q => q.id));
console.log(`ID重複: ${ids.size !== data.length ? 'あり!' : 'なし'}`);
