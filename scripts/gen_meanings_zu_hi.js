const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'sansu_zu.json');
const outPath = path.join(__dirname, 'meanings_zu_hi.json');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const target = data.filter(d => d.grade === 5 || d.grade === 6);

if (target.length !== 480) {
  throw new Error('expected 480 records, got ' + target.length);
}

const results = [];
const seenIds = new Set();

function approxEq(a, b, eps) {
  return Math.abs(a - b) <= eps;
}

for (const d of target) {
  const { id, question, answer } = d;
  const ansNum = parseFloat(answer);
  let m;
  let meaning = null;

  // T1: triangle area from base & height
  if ((m = question.match(/^底辺(\d+)cm・高さ(\d+)cmの三角形の面積は何cm²ですか？$/))) {
    const base = +m[1], height = +m[2];
    const computed = (base * height) / 2;
    if (!approxEq(computed, ansNum, 0.001)) throw new Error('T1 mismatch ' + id);
    meaning = `三角形の面積は「底辺×高さ÷2」の公式で求められます。底辺${base}cm、高さ${height}cmなので、${base}×${height}÷2＝${answer}cm²です。`;
  }
  // T2: circle circumference from diameter
  else if ((m = question.match(/^直径(\d+)cmの円のまわりの長さ（円周）は何cmですか？（円周率([\d.]+)）$/))) {
    const diameter = +m[1], pi = m[2];
    const computed = diameter * parseFloat(pi);
    if (!approxEq(computed, ansNum, 0.001)) throw new Error('T2 mismatch ' + id);
    meaning = `円周の長さは「直径×円周率」の公式で求められます。直径${diameter}cm、円周率${pi}として計算すると、${diameter}×${pi}＝${answer}cmです。`;
  }
  // T3: parallelogram split by diagonal
  else if ((m = question.match(/^底辺(\d+)cm・高さ(\d+)cmの平行四辺形の中に、対角線を(\d+)本ひいてできる三角形(\d+)つの面積は何cm²ですか？$/))) {
    const base = +m[1], height = +m[2];
    const computed = (base * height) / 2;
    if (!approxEq(computed, ansNum, 0.001)) throw new Error('T3 mismatch ' + id);
    meaning = `平行四辺形に対角線を1本ひくと、面積が等しい2つの合同な三角形に分けられます。つまりできる三角形1つの面積は、もとの平行四辺形の面積のちょうど半分です。平行四辺形の面積は「底辺×高さ」なので、底辺${base}cm×高さ${height}cm÷2＝${answer}cm²です。`;
  }
  // T4: square minus inscribed circle
  else if ((m = question.match(/^1辺(\d+)cmの正方形の中に、ぴったり入る円をかきました。正方形から円をのぞいた部分の面積は何cm²ですか？（円周率([\d.]+)）$/))) {
    const side = +m[1], pi = m[2];
    const radius = side / 2;
    const computed = side * side - parseFloat(pi) * radius * radius;
    if (!approxEq(computed, ansNum, 0.02)) throw new Error('T4 mismatch ' + id + ' ' + computed + ' vs ' + ansNum);
    const radiusStr = Number.isInteger(radius) ? String(radius) : radius.toFixed(1);
    meaning = `正方形にぴったり入る円の半径は、正方形の1辺の長さの半分になります。求める面積は「正方形の面積－円の面積」で求められます。正方形の面積は1辺×1辺、円の面積は半径×半径×円周率なので、1辺${side}cm、半径${radiusStr}cmとして計算すると、${side}×${side}－${pi}×${radiusStr}×${radiusStr}＝${answer}cm²です。`;
  }
  // T5: sector (おうぎ形) area
  else if ((m = question.match(/^半径(\d+)cm・中心角(\d+)°のおうぎ形の面積は何cm²ですか？（円周率([\d.]+)）$/))) {
    const r = +m[1], angle = +m[2], pi = m[3];
    const computed = parseFloat(pi) * r * r * angle / 360;
    if (!approxEq(computed, ansNum, 0.02)) throw new Error('T5 mismatch ' + id + ' ' + computed + ' vs ' + ansNum);
    meaning = `おうぎ形の面積は「半径×半径×円周率×(中心角÷360)」の公式で求められます。これは、半径${r}cmの円全体の面積のうち、中心角${angle}°の割合（360分の${angle}）を占める部分だからです。よって、${pi}×${r}×${r}×${angle}/360＝${answer}cm²です。`;
  }
  // T6: quarter circle minus right isosceles triangle
  else if ((m = question.match(/^半径(\d+)cmの四分円から直角二等辺三角形を切り取ったのこりの面積は何cm²ですか？（円周率([\d.]+)）$/))) {
    const r = +m[1], pi = m[2];
    const computed = (parseFloat(pi) * r * r) / 4 - (r * r) / 2;
    if (!approxEq(computed, ansNum, 0.02)) throw new Error('T6 mismatch ' + id + ' ' + computed + ' vs ' + ansNum);
    meaning = `半径${r}cmの四分円は円の4分の1のおうぎ形で、面積は「半径×半径×円周率÷4」で求められます。この四分円の中から、2つの半径を直角をはさむ2辺（長さ${r}cm・${r}cm）とする直角二等辺三角形（面積は半径×半径÷2）を切り取るので、残りの面積は四分円の面積から三角形の面積を引けば求まります。よって、${pi}×${r}×${r}÷4－${r}×${r}÷2＝${answer}cm²です。`;
  }
  // T7: leaf shape (two overlapping quarter circles in a square)
  else if ((m = question.match(/^1辺(\d+)cmの正方形の中の葉っぱ形（四分円2つの重なり）の面積は何cm²ですか？（円周率([\d.]+)）$/))) {
    const side = +m[1], pi = m[2];
    const quarterTotal = (side * side * parseFloat(pi)) / 2; // two quarter circles combined
    const computed = quarterTotal - side * side;
    if (!approxEq(computed, ansNum, 0.02)) throw new Error('T7 mismatch ' + id + ' ' + computed + ' vs ' + ansNum);
    const quarterTotalStr = quarterTotal.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    meaning = `正方形の中に2つの四分円（半径${side}cmの円の4分の1）をかくと、重なった部分が葉っぱのような形になります。この葉っぱ形の面積は「四分円2つ分の面積の合計－正方形の面積」で求められます。四分円1つの面積は${side}×${side}×${pi}÷4なので、2つ分は${side}×${side}×${pi}÷4×2＝${quarterTotalStr}cm²です。正方形の面積は${side}×${side}＝${side * side}cm²なので、葉っぱ形の面積は${quarterTotalStr}－${side * side}＝${answer}cm²です。`;
  }
  // T8: Hippocrates' lune(s)
  else if ((m = question.match(/^直角をはさむ2辺が(\d+)cm・(\d+)cmの直角三角形で、ヒポクラテスの三日月（2つの三日月形）の面積の合計は何cm²ですか？$/))) {
    const a = +m[1], b = +m[2];
    const computed = (a * b) / 2;
    if (!approxEq(computed, ansNum, 0.001)) throw new Error('T8 mismatch ' + id);
    meaning = `ヒポクラテスの定理により、直角三角形の各辺を直径とする半円を描いてできる2つの三日月形の面積の合計は、もとの直角三角形の面積と等しくなることが知られています。直角をはさむ2辺が${a}cmと${b}cmの直角三角形の面積は${a}×${b}÷2＝${answer}cm²なので、三日月の面積の合計も${answer}cm²です。`;
  }

  if (!meaning) {
    throw new Error('No template matched for id ' + id + ': ' + question);
  }
  if (seenIds.has(id)) throw new Error('duplicate id ' + id);
  seenIds.add(id);

  // final rule check: meaning must end with ＝ followed by the exact answer string
  const suffix = `＝${answer}`;
  if (!meaning.includes(suffix)) {
    throw new Error('meaning does not contain exact answer suffix for id ' + id + ': ' + meaning);
  }

  results.push({ id, meaning });
}

if (results.length !== 480) throw new Error('result count mismatch: ' + results.length);

fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
console.log('wrote', results.length, 'entries to', outPath);
