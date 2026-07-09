// sansu_tokusan.json を独立実装で再検証
const data = require('../data/sansu_tokusan.json');
let checked = 0, failed = 0;
const fail = (q, detail) => { failed++; console.log(`NG ${q.id}: ${q.question} => ${q.answer}  [${detail}]`); };

data.forEach(q => {
  let m;
  if ((m = q.question.match(/^長さ(\d+)mの道に、はしからはしまで(\d+)mおきに木を植えます/))) {
    checked++;
    const [N, d] = [Number(m[1]), Number(m[2])];
    if (N % d !== 0) return fail(q, '割り切れない');
    const expected = N / d + 1;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = q.question.match(/^2つの数があります。和は(\d+)、差は(\d+)です。大きい方の数/))) {
    checked++;
    const [sum, diff] = [Number(m[1]), Number(m[2])];
    if ((sum + diff) % 2 !== 0) return fail(q, '奇数和');
    const expected = (sum + diff) / 2;
    if (String(expected) !== q.answer) fail(q, `期待${expected}`);
  } else if ((m = q.question.match(/^子どもたちにあめを配ります。1人に(\d+)個ずつ配ると(\d+)個あまり、1人に(\d+)個ずつ配ると(\d+)個たりません/))) {
    checked++;
    const [a, b, c, d] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const n = (b + d) / (c - a);
    if (!Number.isInteger(n) || String(n) !== q.answer) fail(q, `期待${n}`);
    // 総数の整合性チェック
    const total1 = a * n + b, total2 = c * n - d;
    if (total1 !== total2) fail(q, `総数不一致 ${total1} vs ${total2}`);
  } else if ((m = q.question.match(/^つるとかめが合わせて(\d+)匹います。足の数の合計は(\d+)本です/))) {
    checked++;
    const [N, L] = [Number(m[1]), Number(m[2])];
    if ((4 * N - L) % 2 !== 0) return fail(q, '割り切れない');
    const t = (4 * N - L) / 2;
    if (t < 0 || t > N || String(t) !== q.answer) fail(q, `期待${t}`);
  } else if ((m = q.question.match(/^1個(\d+)円のりんごと1個(\d+)円のみかんを合わせて(\d+)個買ったところ、代金の合計は(\d+)円/))) {
    checked++;
    const [p1, p2, N, Y] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const num = p2 * N - Y, den = p2 - p1;
    if (den === 0 || num % den !== 0) return fail(q, '不整合');
    const a = num / den;
    if (a < 0 || a > N || String(a) !== q.answer) fail(q, `期待${a}`);
  } else if ((m = q.question.match(/^りんご(\d+)個とみかん(\d+)個で代金は(\d+)円、りんご(\d+)個とみかん(\d+)個で代金は(\d+)円/))) {
    checked++;
    const [c1, d1, S1, c2, d2, S2] = m.slice(1).map(Number);
    const det = c1 * d2 - c2 * d1;
    if (det === 0) return fail(q, '行列式0');
    const x = (S1 * d2 - S2 * d1) / det;
    if (!Number.isInteger(x) || String(x) !== q.answer) fail(q, `期待${x}`);
  } else if ((m = q.question.match(/^ある仕事をAさん1人ですると(\d+)日、Bさん1人ですると(\d+)日かかります/))) {
    checked++;
    const [a, b] = [Number(m[1]), Number(m[2])];
    const num = a * b, den = a + b;
    if (num % den !== 0) return fail(q, '割り切れない');
    const days = num / den;
    if (String(days) !== q.answer) fail(q, `期待${days}`);
  } else if ((m = q.question.match(/^現在、父は(\d+)才、子は(\d+)才です。父の年れいが子の年れいのちょうど(\d+)倍になるのは何年後/))) {
    checked++;
    const [father, child, k] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const x = (father - k * child) / (k - 1);
    if (!Number.isInteger(x) || x < 0 || String(x) !== q.answer) fail(q, `期待${x}`);
    if ((father + x) !== k * (child + x)) fail(q, '倍率不一致');
  } else if ((m = q.question.match(/^おかしを子どもたちに配ります。1人に(\d+)個ずつ配ると(\d+)個あまり、1人に(\d+)個ずつ配ると(\d+)個あまります/))) {
    checked++;
    const [a, b1, c, b2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const num = b1 - b2, den = c - a;
    if (den === 0 || num % den !== 0) return fail(q, '不整合');
    const n = num / den;
    if (n <= 0 || String(n) !== q.answer) fail(q, `期待${n}`);
  } else if ((m = q.question.match(/^水そうをいっぱいにするのに、A管だけだと(\d+)分、A管とB管を同時に使うと(\d+)分かかります/))) {
    checked++;
    const [a, x] = [Number(m[1]), Number(m[2])];
    const num = a * x, den = a - x;
    if (den <= 0 || num % den !== 0) return fail(q, '不整合');
    const b = num / den;
    if (String(b) !== q.answer) fail(q, `期待${b}`);
  } else if ((m = q.question.match(/^1個(\d+)円のA、1個(\d+)円のB、1個(\d+)円のCを合わせて(\d+)個買い、代金は合計(\d+)円でした。Aの個数はBの個数のちょうど2倍/))) {
    checked++;
    const [p1, p2, p3, N, Y] = m.slice(1).map(Number);
    // a=2b, a+b+c=N, p1*a+p2*b+p3*c=Y を全探索で検証
    let found = null;
    for (let b = 0; b <= N; b++) {
      const a = 2 * b, c = N - a - b;
      if (c < 0) continue;
      if (p1 * a + p2 * b + p3 * c === Y) { found = { a, b, c }; break; }
    }
    if (!found || String(found.c) !== q.answer) fail(q, `期待${found ? found.c : '解なし'}`);
  } else if ((m = q.question.match(/^赤玉と白玉が合わせて(\d+)個あり、重さの合計は(\d+)gです。赤玉1個は(\d+)g、白玉1個は(\d+)gで、赤玉の個数は白玉の個数より(\d+)個多い/))) {
    checked++;
    const [N, Y, p1, p2, k] = m.slice(1).map(Number);
    // (p1+p2)*w + p1*k = Y
    const num = Y - p1 * k, den = p1 + p2;
    if (den === 0 || num % den !== 0) return fail(q, '不整合');
    const w = num / den;
    if (w < 0 || (2 * w + k) !== N || String(w) !== q.answer) fail(q, `期待${w}`);
  } else {
    console.log('UNMATCHED PATTERN:', q.id, q.question);
  }
});

console.log(`\n検証: ${checked}問 / 不一致: ${failed}問 / 総数: ${data.length}`);
for (let g = 4; g <= 6; g++) for (let d = 1; d <= 4; d++) {
  const c = data.filter(q => q.grade === g && q.difficulty === d).length;
  if (c !== 20) console.log(`⚠ grade${g} diff${d}: ${c}問`);
}
const ids = new Set(data.map(q => q.id));
console.log('ID重複:', ids.size !== data.length ? 'あり' : 'なし');
