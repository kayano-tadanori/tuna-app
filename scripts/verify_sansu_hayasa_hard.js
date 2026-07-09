// sansu_hayasa.json の小5・小6 難易度3-4を独立実装で再検証
const data = require('../data/sansu_hayasa.json').filter(q => (q.grade === 5 || q.grade === 6) && (q.difficulty === 3 || q.difficulty === 4));
let checked = 0, failed = 0;
const fail = (q, detail) => { failed++; console.log(`NG ${q.id}: ${q.question} => ${q.answer}  [${detail}]`); };

data.forEach(q => {
  let m;
  if ((m = q.question.match(/^上りの速さが時速(\d+)km、下りの速さが時速(\d+)kmの船があります。この船の静水での速さは時速何kmですか。/))) {
    checked++;
    const [up, down] = [Number(m[1]), Number(m[2])];
    if (String((up + down) / 2) !== q.answer) fail(q, `期待${(up + down) / 2}`);
  } else if ((m = q.question.match(/^上りの速さが時速(\d+)km、下りの速さが時速(\d+)kmの船があります。この川の流れの速さは時速何kmですか。/))) {
    checked++;
    const [up, down] = [Number(m[1]), Number(m[2])];
    if (String((down - up) / 2) !== q.answer) fail(q, `期待${(down - up) / 2}`);
  } else if ((m = q.question.match(/^静水での速さが時速(\d+)kmのA船と時速(\d+)kmのB船が、(\d+)kmはなれた川の両岸から同時に向かい合って出発しました/))) {
    checked++;
    const [a, b, dist] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (dist % (a + b) !== 0 || String(dist / (a + b)) !== q.answer) fail(q, `期待${dist / (a + b)}`);
  } else if ((m = q.question.match(/^分速(\d+)mの自転車が、分速(\d+)mで歩いている人を追いかけます。人が(\d+)m先を歩いているとき、自転車が追いつくのは何分後ですか。/))) {
    checked++;
    const [a, b, head] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (a <= b || head % (a - b) !== 0 || String(head / (a - b)) !== q.answer) fail(q, `期待${head / (a - b)}`);
  } else {
    console.log('UNMATCHED PATTERN:', q.id, q.question);
  }
});

console.log(`\n検証: ${checked}問 / 不一致: ${failed}問 / 総数: ${data.length}`);
const all = require('../data/sansu_hayasa.json');
console.log('全体総数:', all.length);
for (let g = 5; g <= 6; g++) for (let d = 1; d <= 4; d++) {
  const c = all.filter(q => q.grade === g && q.difficulty === d).length;
  if (c !== 20) console.log(`⚠ grade${g} diff${d}: ${c}問`);
}
const ids = new Set(all.map(q => q.id));
console.log('ID重複:', ids.size !== all.length ? 'あり' : 'なし');
