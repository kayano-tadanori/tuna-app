// 「□に入る数」形式・文章題形式の問題を個別パターンで再検証
const data = require('../data/sansu_keisan.json');

function toHalf(s) {
  return s.replace(/[０-９．：]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/＋/g, '+').replace(/－/g, '-').replace(/×/g, '×').replace(/÷/g, '÷')
    .replace(/＝/g, '=').replace(/　/g, ' ').replace(/\s+/g, '');
}

let totalChecked = 0, totalFailed = 0;
const fail = (q, detail) => { totalFailed++; console.log(`NG ${q.id}: ${q.question} => ${q.answer}  [${detail}]`); };

// 1) grade1 diff3: "□ ＋ a ＝ b"
data.filter(q => q.grade === 1 && q.difficulty === 3).forEach(q => {
  const m = toHalf(q.question).match(/^□\s*\+\s*(\d+)\s*=\s*(\d+)$/);
  if (!m) return fail(q, 'パターン不一致');
  const [, a, b] = m.map(Number).length === 3 ? m : m;
  const A = Number(m[1]), B = Number(m[2]);
  totalChecked++;
  if (Number(q.answer) !== B - A) fail(q, `期待${B - A}`);
});

// 2) grade4 diff2: "n1/den － n2/den ＝ □/den　□に入る数は？"
data.filter(q => q.grade === 4 && q.difficulty === 2).forEach(q => {
  const m = toHalf(q.question).match(/^(\d+)\/(\d+)-(\d+)\/(\d+)/);
  if (!m) return fail(q, 'パターン不一致');
  const [, n1, den1, n2, den2] = m.map(Number).length === 5 ? m : m;
  totalChecked++;
  if (Number(q.answer) !== Number(m[1]) - Number(m[3])) fail(q, `期待${Number(m[1]) - Number(m[3])}`);
});

// 3) grade4 diff3: "a×b＋cn÷□＝final　□に入る数は？"
data.filter(q => q.grade === 4 && q.difficulty === 3).forEach(q => {
  const m = toHalf(q.question).match(/^([\d.]+)×(\d+)\+([\d.]+)÷□=([\d.]+)/);
  if (!m) return fail(q, 'パターン不一致');
  const a = parseFloat(m[1]), b = parseFloat(m[2]), cn = parseFloat(m[3]), final = parseFloat(m[4]);
  totalChecked++;
  const computed = a * b + cn / Number(q.answer);
  if (Math.abs(computed - final) > 1e-6) fail(q, `計算結果${computed}≠${final}`);
});

// 4) grade4 diff4: "whole と b1n/b1d × □ ＝ target　□に入る数は？"
data.filter(q => q.grade === 4 && q.difficulty === 4).forEach(q => {
  const m = toHalf(q.question).match(/^(\d+)と(\d+)\/(\d+)\s*×\s*□\s*=\s*(\d+)/);
  if (!m) return fail(q, 'パターン不一致');
  const whole = Number(m[1]), n = Number(m[2]), d = Number(m[3]), target = Number(m[4]);
  totalChecked++;
  const mixedVal = whole + n / d;
  let ansVal;
  const mixedAns = q.answer.match(/^(\d+)と(\d+)\/(\d+)$/);
  const fracAns = q.answer.match(/^(\d+)\/(\d+)$/);
  if (mixedAns) ansVal = Number(mixedAns[1]) + Number(mixedAns[2]) / Number(mixedAns[3]);
  else if (fracAns) ansVal = Number(fracAns[1]) / Number(fracAns[2]);
  else ansVal = parseFloat(q.answer);
  const computed = mixedVal * ansVal;
  if (Math.abs(computed - target) > 1e-6) fail(q, `計算結果${computed}≠${target}`);
});

// 5) grade5 diff1: "num/den を小数で表すと？"
data.filter(q => q.grade === 5 && q.difficulty === 1).forEach(q => {
  const m = toHalf(q.question).match(/^(\d+)\/(\d+)/);
  if (!m) return fail(q, 'パターン不一致');
  const num = Number(m[1]), den = Number(m[2]);
  totalChecked++;
  if (Math.abs(num / den - parseFloat(q.answer)) > 1e-9) fail(q, `期待${num / den}`);
});

// 6) grade5 diff2: "n1/d1 ＋ n2/d2 ＝ □/lcm　□に入る数は？"
data.filter(q => q.grade === 5 && q.difficulty === 2).forEach(q => {
  const m = toHalf(q.question).match(/^(\d+)\/(\d+)\+(\d+)\/(\d+)=□\/(\d+)/);
  if (!m) return fail(q, 'パターン不一致');
  const [, n1, d1, n2, d2, lcm] = m.map(Number);
  totalChecked++;
  const expected = n1 * (lcm / d1) + n2 * (lcm / d2);
  if (Number(q.answer) !== expected) fail(q, `期待${expected}`);
});

// 7) grade5 diff3: "a×b＋(cn－dn)÷□＝final　□に入る数は？"
data.filter(q => q.grade === 5 && q.difficulty === 3).forEach(q => {
  const m = toHalf(q.question).match(/^([\d.]+)×(\d+)\+\(([\d.]+)-([\d.]+)\)÷□=([\d.]+)/);
  if (!m) return fail(q, 'パターン不一致');
  const a = parseFloat(m[1]), b = parseFloat(m[2]), cn = parseFloat(m[3]), dn = parseFloat(m[4]), final = parseFloat(m[5]);
  totalChecked++;
  const computed = a * b + (cn - dn) / Number(q.answer);
  if (Math.abs(computed - final) > 1e-6) fail(q, `計算結果${computed}≠${final}`);
});

// 8) grade6 diff2 比の文章題: "totalをr1：r2の比で分けると、大きい方は？"
data.filter(q => q.grade === 6 && q.difficulty === 2 && q.question.includes('比で分ける')).forEach(q => {
  const m = toHalf(q.question).match(/^(\d+)を(\d+):(\d+)の比で分けると/);
  if (!m) return fail(q, 'パターン不一致');
  const [, total, r1, r2] = m.map(Number);
  totalChecked++;
  const expected = total * Math.max(r1, r2) / (r1 + r2);
  if (Number(q.answer) !== expected) fail(q, `期待${expected}`);
});

console.log(`\n検証対象: ${totalChecked}問 / 不一致: ${totalFailed}問`);
