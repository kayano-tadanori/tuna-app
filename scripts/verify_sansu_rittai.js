// sansu_rittai.json を独立実装で再検証
const data = require('../data/sansu_rittai.json');
let checked = 0, failed = 0;
const fail = (q, detail) => { failed++; console.log(`NG ${q.id}: ${q.question} => ${q.answer}  [${detail}]`); };

data.forEach(q => {
  let m;
  const qt = q.question;
  if ((m = qt.match(/^1辺(\d+)cmの立方体の体積は何cm³ですか？$/))) {
    checked++; const a = Number(m[1]); if (String(a ** 3) !== q.answer) fail(q, `期待${a ** 3}`);
  } else if ((m = qt.match(/^たて(\d+)cm・よこ(\d+)cm・高さ(\d+)cmの直方体の体積は何cm³ですか？$/))) {
    checked++; const [l, w, h] = m.slice(1).map(Number); if (String(l * w * h) !== q.answer) fail(q, `期待${l * w * h}`);
  } else if ((m = qt.match(/^たて(\d+)cm・よこ(\d+)cm・高さ(\d+)cmの直方体の表面積は何cm²ですか？$/))) {
    checked++; const [l, w, h] = m.slice(1).map(Number); const exp = 2 * (l * w + w * h + h * l); if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^たて(\d+)cm・よこ(\d+)cmの水そうに(\d+)cm³の水を入れると、深さは何cmになりますか？$/))) {
    checked++; const [d, w, vol] = m.slice(1).map(Number); if (vol % (d * w) !== 0 || String(vol / (d * w)) !== q.answer) fail(q, `期待${vol / (d * w)}`);
  } else if ((m = qt.match(/^たて(\d+)cm・よこ(\d+)cmの水そうに深さ(\d+)cmまで水が入っています。底面がたて(\d+)cm・よこ(\d+)cmの四角い棒/))) {
    checked++;
    const [td, tw, depth, bd, bw] = m.slice(1).map(Number);
    const vol = td * tw * depth, newArea = td * tw - bd * bw;
    const expected = Math.round(vol / newArea * 100) / 100;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/^底面の半径(\d+)cm・高さ(\d+)cmの円柱の体積は何cm³ですか？/))) {
    checked++; const [r, h] = m.slice(1).map(Number); const exp = Math.round(3.14 * r * r * h * 100) / 100; if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^底面の半径(\d+)cm・高さ(\d+)cmの円柱の表面積は何cm²ですか？/))) {
    checked++; const [r, h] = m.slice(1).map(Number); const exp = Math.round(3.14 * (2 * r * r + 2 * r * h) * 100) / 100; if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^底面の半径(\d+)cm・高さ(\d+)cmの円すいの体積は何cm³ですか？/))) {
    checked++; const [r, h] = m.slice(1).map(Number); const exp = Math.round(3.14 * r * r * h / 3 * 100) / 100; if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^たて(\d+)cm・よこ(\d+)cmの長方形を、たての辺を軸として1回転させてできる立体の体積は何cm³ですか？/))) {
    checked++; const [h, w] = m.slice(1).map(Number); const exp = Math.round(3.14 * w * w * h * 100) / 100; if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^底辺(\d+)cm・高さ(\d+)cmの直角三角形を、高さの辺を軸として1回転させてできる立体の体積は何cm³ですか？/))) {
    checked++; const [base, h] = m.slice(1).map(Number); const exp = Math.round(3.14 * base * base * h / 3 * 100) / 100; if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^1辺(\d+)cmの立方体を、向かい合う面の対角線をふくむ平面で半分に切りました。できた三角柱1つの体積は何cm³ですか？$/))) {
    checked++; const a = Number(m[1]); const exp = a * a * a / 2; if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^1辺(\d+)cmの立方体を、向かい合う面の対角線をふくむ平面で切ります。切り口の長方形の面積は何cm²ですか？/))) {
    checked++; const a = Number(m[1]); const diag = Math.round(a * 1.41421356 * 100) / 100; const exp = Math.round(a * diag * 100) / 100; if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else if ((m = qt.match(/^1辺(\d+)cmの立方体の1つの頂点に集まる3つの辺の中点を通る平面で角を切り落とします。切り口の正三角形の1辺は([\d.]+)cmです/))) {
    checked++; const a = Number(m[1]); const legDiag = Number(m[2]); const expLegDiag = Math.round((a / 2) * 1.41421356 * 100) / 100;
    if (legDiag !== expLegDiag) fail(q, `辺の長さ不一致 期待${expLegDiag}`);
    const exp = Math.round(legDiag * legDiag * 0.433 * 100) / 100;
    if (String(exp) !== q.answer) fail(q, `期待${exp}`);
  } else {
    console.log('UNMATCHED PATTERN:', q.id, qt);
  }
});

console.log(`\n検証: ${checked}問 / 不一致: ${failed}問 / 総数: ${data.length}`);
for (let g = 5; g <= 6; g++) for (let d = 1; d <= 4; d++) {
  const c = data.filter(q => q.grade === g && q.difficulty === d).length;
  if (c !== 20) console.log(`⚠ grade${g} diff${d}: ${c}問`);
}
const withoutSvg = data.filter(q => !q.svg);
console.log('SVGなし件数:', withoutSvg.length, '/', data.length);
const ids = new Set(data.map(q => q.id));
console.log('ID重複:', ids.size !== data.length ? 'あり' : 'なし');
