const data = require('../data/sansu_zu.json').filter(q => q.grade === 3 && (q.difficulty === 3 || q.difficulty === 4));
let checked = 0, failed = 0;
const fail = (q, d) => { failed++; console.log(`NG ${q.id}: ${q.question} => ${q.answer} [${d}]`); };

data.forEach(q => {
  let m;
  const qt = q.question;
  if ((m = qt.match(/^二等辺三角形で、底角がそれぞれ(\d+)°のとき、頂角は何度ですか？$/))) {
    checked++; const b = Number(m[1]); if (String(180 - 2 * b) !== q.answer) fail(q, `期待${180 - 2 * b}`);
  } else if ((m = qt.match(/^二等辺三角形で、頂角が(\d+)°のとき、底角は何度ですか？$/))) {
    checked++; const a = Number(m[1]); if (String((180 - a) / 2) !== q.answer) fail(q, `期待${(180 - a) / 2}`);
  } else if ((m = qt.match(/^正三角形の1つの頂点に、底角(\d+)°の二等辺三角形がくっついています/))) {
    checked++; const b = Number(m[1]); if (String(60 + b) !== q.answer) fail(q, `期待${60 + b}`);
  } else if ((m = qt.match(/^長さ([\d cm・]+)cmの棒が1本ずつあります/))) {
    checked++;
    const nums = m[1].split('cm・').map(s => Number(s.replace('cm', '')));
    let count = 0;
    for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) for (let k = j + 1; k < nums.length; k++) {
      const [x, y, z] = [nums[i], nums[j], nums[k]].sort((a, b) => a - b);
      if (x + y > z) count++;
    }
    if (String(count) !== q.answer) fail(q, `期待${count}`);
  } else if ((m = qt.match(/^1辺に小さい正三角形が(\d+)つならぶ大きい正三角形があります/))) {
    checked++;
    const n = Number(m[1]);
    const up = n * (n + 1) / 2;
    let down = 0; for (let k = 1; k <= n - 2; k++) down += k;
    if (String(up + down) !== q.answer) fail(q, `期待${up + down}`);
  } else {
    console.log('UNMATCHED:', q.id, qt);
  }
});
console.log(`\n検証: ${checked}問 / 不一致: ${failed}問 / 総数: ${data.length}`);
const all = require('../data/sansu_zu.json');
console.log('全体総数:', all.length);
const ids = new Set(all.map(q => q.id));
console.log('ID重複:', ids.size !== all.length ? 'あり' : 'なし');
