// sansu_baai.json の小3新規分を独立実装で再検証
const data = require('../data/sansu_baai.json').filter(q => q.grade === 3);
function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function nCr(n, r) { return fact(n) / (fact(r) * fact(n - r)); }

let checked = 0, failed = 0;
const fail = (q, detail) => { failed++; console.log(`NG ${q.id}: ${q.question} => ${q.answer}  [${detail}]`); };

data.forEach(q => {
  let m;
  const qt = q.question;
  if ((m = qt.match(/^シャツが(\d+)種類、ズボンが(\d+)種類あります/))) {
    checked++;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (String(a * b) !== q.answer) fail(q, `期待${a * b}`);
  } else if ((m = qt.match(/^(\d+)人が横一列にならびます/))) {
    checked++;
    const n = Number(m[1]);
    if (String(fact(n)) !== q.answer) fail(q, `期待${fact(n)}`);
  } else if ((m = qt.match(/^(\d+)人の中から2人を選ぶ/))) {
    checked++;
    const n = Number(m[1]);
    if (String(nCr(n, 2)) !== q.answer) fail(q, `期待${nCr(n, 2)}`);
  } else if ((m = qt.match(/^(\d+)種類の.+あめの中から2種類を選ぶ/))) {
    checked++;
    const n = Number(m[1]);
    if (String(nCr(n, 2)) !== q.answer) fail(q, `期待${nCr(n, 2)}`);
  } else if ((m = qt.match(/^(\d+)チームが総当たり戦/))) {
    checked++;
    const n = Number(m[1]);
    if (String(nCr(n, 2)) !== q.answer) fail(q, `期待${nCr(n, 2)}`);
  } else if ((m = qt.match(/^(\d+)人の中から3人を選ぶ/))) {
    checked++;
    const n = Number(m[1]);
    if (String(nCr(n, 3)) !== q.answer) fail(q, `期待${nCr(n, 3)}`);
  } else if ((m = qt.match(/^(\d+)チームがトーナメント戦/))) {
    checked++;
    const n = Number(m[1]);
    if (String(n - 1) !== q.answer) fail(q, `期待${n - 1}`);
  } else if ((m = qt.match(/^男子(\d+)人・女子(\d+)人の中から、男子(\d+)人と女子(\d+)人を選ぶ/))) {
    checked++;
    const [boys, girls, pb, pg] = m.slice(1).map(Number);
    const expected = nCr(boys, pb) * nCr(girls, pg);
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else {
    console.log('UNMATCHED PATTERN:', q.id, qt);
  }
});

console.log(`\n検証: ${checked}問 / 不一致: ${failed}問 / 総数(小3): ${data.length}`);
for (let d = 1; d <= 4; d++) {
  const c = data.filter(q => q.difficulty === d).length;
  if (c !== 20) console.log(`⚠ diff${d}: ${c}問`);
}
const all = require('../data/sansu_baai.json');
const ids = new Set(all.map(q => q.id));
console.log('総数:', all.length, 'ID重複:', ids.size !== all.length ? 'あり' : 'なし');
