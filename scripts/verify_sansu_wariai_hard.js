// sansu_wariai.json の小5・小6 難易度3-4（連比・差一定算）を独立実装で再検証
const data = require('../data/sansu_wariai.json').filter(q => (q.grade === 5 || q.grade === 6) && (q.difficulty === 3 || q.difficulty === 4));
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }

let checked = 0, failed = 0;
const fail = (q, detail) => { failed++; console.log(`NG ${q.id}: ${q.question} => ${q.answer}  [${detail}]`); };

data.forEach(q => {
  let m;
  if ((m = q.question.match(/^A：B＝(\d+)：(\d+)、B：C＝(\d+)：(\d+)のとき、A：B：Cを最も簡単な整数の比で表すと(\d+)：(\d+)：□です/))) {
    checked++;
    const [a1, b1, b2, c2, p, q2] = m.slice(1).map(Number);
    const L = b1 * b2 / gcd(b1, b2);
    const A = a1 * (L / b1), B = L, C = c2 * (L / b2);
    const g = gcd(gcd(A, B), C);
    const [ep, eq, er] = [A / g, B / g, C / g];
    if (ep !== p || eq !== q2 || String(er) !== q.answer) fail(q, `期待${ep}:${eq}:${er}`);
  } else if ((m = q.question.match(/^A：B＝(\d+)：(\d+)、B：C＝(\d+)：(\d+)のとき、A：B：Cを最も簡単な整数の比で表すと(\d+)：□：(\d+)です/))) {
    checked++;
    const [a1, b1, b2, c2, p, r] = m.slice(1).map(Number);
    const L = b1 * b2 / gcd(b1, b2);
    const A = a1 * (L / b1), B = L, C = c2 * (L / b2);
    const g = gcd(gcd(A, B), C);
    const [ep, eq, er] = [A / g, B / g, C / g];
    if (ep !== p || er !== r || String(eq) !== q.answer) fail(q, `期待${ep}:${eq}:${er}`);
  } else if ((m = q.question.match(/^AさんとBさんの貯金額の比は(\d+)：(\d+)でした。ところが、Aさんが(\d+)円使い、Bさんが(\d+)円貯金したので、Aさんと Bさんの貯金額の比は(\d+)：(\d+)になりました/))) {
    checked++;
    const [a, b, x, y, p, qq] = m.slice(1).map(Number);
    // B0 = b*k を総当たりkで探索し、条件を満たすkを特定
    let foundB0 = null;
    for (let k = 1; k <= 10000; k++) {
      const A0 = a * k, B0 = b * k;
      const newA = A0 - x, newB = B0 + y;
      if (newA <= 0) continue;
      if (newA * qq === newB * p) { foundB0 = B0; break; }
    }
    if (foundB0 === null || String(foundB0) !== q.answer) fail(q, `期待${foundB0}`);
  } else {
    console.log('UNMATCHED PATTERN:', q.id, q.question);
  }
});

console.log(`\n検証: ${checked}問 / 不一致: ${failed}問 / 総数: ${data.length}`);
const all = require('../data/sansu_wariai.json');
console.log('全体総数:', all.length);
for (let g = 5; g <= 6; g++) for (let d = 1; d <= 4; d++) {
  const c = all.filter(q => q.grade === g && q.difficulty === d).length;
  if (c !== 20) console.log(`⚠ grade${g} diff${d}: ${c}問`);
}
const ids = new Set(all.map(q => q.id));
console.log('ID重複:', ids.size !== all.length ? 'あり' : 'なし');
