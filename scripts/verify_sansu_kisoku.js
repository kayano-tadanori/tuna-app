// sansu_kisoku.json を独立実装で再検証
const data = require('../data/sansu_kisoku.json');
let checked = 0, failed = 0;
const fail = (q, detail) => { failed++; console.log(`NG ${q.id}: ${q.question} => ${q.answer}  [${detail}]`); };

data.forEach(q => {
  let m;
  const qt = q.question;
  if ((m = qt.match(/^([\d、]+)、□$/)) && !qt.includes('くり返し')) {
    // 単純な数列（増加・減少・階差・等比のいずれか）：与えられた項から公差or比のパターンを検出し次の項を予測
    checked++;
    const nums = m[1].split('、').map(Number);
    const diffs = [];
    for (let i = 1; i < nums.length; i++) diffs.push(nums[i] - nums[i - 1]);
    let expected = null;
    // 等差（公差一定）
    if (diffs.every(d => d === diffs[0])) {
      expected = nums[nums.length - 1] + diffs[0];
    } else {
      // 階差の階差が一定（階差数列）
      const diffs2 = [];
      for (let i = 1; i < diffs.length; i++) diffs2.push(diffs[i] - diffs[i - 1]);
      if (diffs2.length && diffs2.every(d => d === diffs2[0])) {
        const nextDiff = diffs[diffs.length - 1] + diffs2[0];
        expected = nums[nums.length - 1] + nextDiff;
      } else {
        // 等比
        const ratios = [];
        for (let i = 1; i < nums.length; i++) ratios.push(nums[i] / nums[i - 1]);
        if (ratios.every(r => r === ratios[0])) expected = nums[nums.length - 1] * ratios[0];
      }
    }
    if (expected === null || String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/^([\d、]+)$/))) {
    // 途中に□がある数列（g1_d3）は別マッチ（□を含む）で処理
  } else if (qt.includes('□') && qt.match(/、/) && !qt.includes('から始まり') && !qt.includes('くり返し')) {
    checked++;
    const tokens = qt.split('、');
    const blankPos = tokens.indexOf('□');
    const known = tokens.map(t => t === '□' ? null : Number(t));
    // 等差と仮定して差を検出（□以外の隣接ペアから）
    let diff = null;
    for (let i = 1; i < known.length; i++) {
      if (known[i] !== null && known[i - 1] !== null) { diff = known[i] - known[i - 1]; break; }
    }
    if (diff === null) { console.log('SKIP(diff不明)', q.id, qt); return; }
    const expected = known[blankPos - 1] !== null ? known[blankPos - 1] + diff : known[blankPos + 1] - diff;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/^([\d＋]+)＝□$/))) {
    checked++;
    const nums = m[1].split('＋').map(Number);
    const sum = nums.reduce((a, b) => a + b, 0);
    if (String(sum) !== q.answer) fail(q, `期待${sum}`);
  } else if ((m = qt.match(/^(\d+)から始まり、(\d+)ずつ増えていく数列があります。(\d+)番目の数を求めなさい。$/))) {
    checked++;
    const [start, diff, n] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const expected = start + diff * (n - 1);
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/^(\d+)から始まり(\d+)ずつ増えていく数列の、はじめから(\d+)番目までの和/))) {
    checked++;
    const [start, diff, n] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const last = start + diff * (n - 1);
    const expected = n * (start + last) / 2;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/^1、3、6、10、15…（1つずつ増える数を足していく数列）の(\d+)番目/))) {
    checked++;
    const n = Number(m[1]);
    const expected = n * (n + 1) / 2;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/^1、2、2、3、3、3、4、4、4、4…（nがn個ずつ並ぶ数列）の(\d+)番目/))) {
    checked++;
    const n = Number(m[1]);
    const seq = []; let num = 1;
    while (seq.length < n) { for (let i = 0; i < num && seq.length < n; i++) seq.push(num); num++; }
    const expected = seq[n - 1];
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/第(\d+)群の(\d+)番目の数を求めなさい/))) {
    checked++;
    const [gnum, k] = [Number(m[1]), Number(m[2])];
    const startOfGroup = gnum * (gnum - 1) / 2 + 1;
    const expected = startOfGroup + (k - 1);
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/^初項(\d+)、公比(\d+)の等比数列の、はじめから(\d+)項までの和/))) {
    checked++;
    const [a, r, n] = [Number(m[1]), Number(m[2]), Number(m[3])];
    let sum = 0, term = a;
    for (let i = 0; i < n; i++) { sum += term; term *= r; }
    if (String(sum) !== q.answer) fail(q, `期待${sum}`);
  } else if ((m = qt.match(/今日が(.)曜日（(\d)）のとき、(\d+)日後の曜日を番号で答えなさい/))) {
    checked++;
    const [startIdx, n] = [Number(m[2]), Number(m[3])];
    const expected = (startIdx + n) % 7;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/^(\d+)、(\d+)から始まり、前の2つの数の和が次の数になる数列があります。(\d+)番目の数を求めなさい。$/))) {
    checked++;
    const [a1, a2, n] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const seq = [a1, a2];
    for (let i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);
    if (String(seq[n - 1]) !== q.answer) fail(q, `期待${seq[n - 1]}`);
  } else if ((m = qt.match(/^2から(\d+)までの偶数をすべて足すといくつですか？$/))) {
    checked++;
    const last = Number(m[1]);
    const count = last / 2;
    const expected = count * (count + 1);
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/^1から(\d+)までの奇数をすべて足すといくつですか？$/))) {
    checked++;
    const last = Number(m[1]);
    const count = (last + 1) / 2;
    const expected = count * count;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/^1から(\d+)までの整数をすべて足すといくつですか？$/))) {
    checked++;
    const N = Number(m[1]);
    const expected = N * (N + 1) / 2;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if (qt.includes('くり返し') && (m = qt.match(/^([\d、]+)をくり返し.*?(\d+)番目の数字を求めなさい/))) {
    checked++;
    const cycleArr = m[1].split('、').map(Number);
    const cycle = cycleArr.length;
    const n = Number(m[2]);
    const posInCycle = n % cycle;
    const expected = posInCycle === 0 ? cycle : posInCycle;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = qt.match(/(\d+)番目の分数の分子を求めなさい/))) {
    checked++;
    const n = Number(m[1]);
    let mm = 1, cum = 0;
    while (cum + mm < n) { cum += mm; mm++; }
    const posInGroup = n - cum;
    const expected = posInGroup;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else {
    console.log('UNMATCHED PATTERN:', q.id, qt);
  }
});

console.log(`\n検証: ${checked}問 / 不一致: ${failed}問 / 総数: ${data.length}`);
for (let g = 1; g <= 6; g++) for (let d = 1; d <= 4; d++) {
  const c = data.filter(q => q.grade === g && q.difficulty === d).length;
  if (c !== 20) console.log(`⚠ grade${g} diff${d}: ${c}問`);
}
const ids = new Set(data.map(q => q.id));
console.log('ID重複:', ids.size !== data.length ? 'あり' : 'なし');
