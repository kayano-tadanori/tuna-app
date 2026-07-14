// 浜学園 小5 V クラス相当の「規則性」「数の性質」問題を生成
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const load = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const save = (f, d) => fs.writeFileSync(path.join(dir, f), JSON.stringify(d, null, 2), 'utf8');
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/* ══════════ 規則性 (sansu_kisoku.json) ══════════ */
const K = [];
const kadd = (question, answer, meaning, grade, difficulty) =>
  K.push({ question, answer: String(answer), meaning, grade, difficulty });

/* 1. 群数列（1 | 2,3 | 4,5,6 | …） */
[10, 15, 20, 25, 30, 12, 18].forEach(g => {
  const first = g*(g-1)/2 + 1;
  kadd(`1｜2、3｜4、5、6｜7、8、9、10｜… のように、第1組に1個、第2組に2個、第3組に3個…と数が組に分けられています。第 ${g}組 の最初の数はいくつですか？`,
    first,
    `第${g}組の前までに 1＋2＋…＋${g-1}＝${(g-1)*g/2}個の数があります。よって第${g}組の最初の数は${(g-1)*g/2}＋1＝${first}です。`,
    5, 4);
});
[8, 12, 16, 20, 24].forEach(g => {
  const first = g*(g-1)/2 + 1, last = g*(g+1)/2;
  const sum = (first + last) * g / 2;
  kadd(`1｜2、3｜4、5、6｜… のように、第 n 組に n 個の数が入るように分けられています。第 ${g}組 に入っている数の和はいくつですか？`,
    sum,
    `第${g}組の最初は${first}、最後は${last}で、${g}個の数が入っています。和は(${first}＋${last})×${g}÷2＝${sum}です。`,
    5, 5);
});
[30, 50, 70, 100, 45].forEach(n => {
  let g = 1, cnt = 0;
  while (cnt + g < n) { cnt += g; g++; }
  const pos = n - cnt;
  kadd(`1｜2、3｜4、5、6｜7、8、9、10｜… のように分けられた数の列で、はじめから数えて ${n}番目 の数は第何組に入っていますか？`,
    g,
    `第1組から第${g-1}組までに 1＋2＋…＋${g-1}＝${cnt}個の数があります。${n}番目はそれを超えるので第${g}組の${pos}番目です。答えは第${g}組です。`,
    5, 5);
});

/* 2. 分数の群数列 */
[[5,3],[7,4],[9,5],[11,7],[13,6]].forEach(([den, num]) => {
  // 1/2 | 1/3,2/3 | 1/4,2/4,3/4 | ... 群 k は分母 k+1、分子 1〜k
  const before = (den-2)*(den-1)/2;
  const pos = before + num;
  kadd(`1/2｜1/3、2/3｜1/4、2/4、3/4｜1/5、2/5、3/5、4/5｜… と分数が並んでいます。${num}/${den} は、はじめから数えて何番目の分数ですか？`,
    pos,
    `分母が${den}の分数は第${den-1}組にあり、その前までに 1＋2＋…＋${den-2}＝${before}個の分数があります。${num}/${den} は第${den-1}組の${num}番目なので、${before}＋${num}＝${pos}番目です。`,
    5, 5);
});

/* 3. 周期数列（くり返し）の和 */
[[[3,1,4,1,5],50],[[2,7,1,8],30],[[1,2,3,4,5,6],40],[[9,5,2],25]].forEach(([seq, n]) => {
  const p = seq.length, s = seq.reduce((a,b)=>a+b,0);
  const q = Math.floor(n/p), r = n % p;
  const total = s*q + seq.slice(0,r).reduce((a,b)=>a+b,0);
  kadd(`${seq.join('、')}、${seq.join('、')}、… と ${p}個の数がくり返し並んでいます。はじめから ${n}番目 までの数の和はいくつですか？`,
    total,
    `1周期(${p}個)の和は${seq.join('＋')}＝${s}です。${n}÷${p}＝${q}あまり${r}なので、${s}×${q}＝${s*q}に、あまり${r}個分の${seq.slice(0,r).join('＋') || 0}＝${seq.slice(0,r).reduce((a,b)=>a+b,0)}をたして${total}です。`,
    5, 4);
});

/* 4. 循環小数の第N位 */
[[1,7,50],[2,7,100],[1,13,60],[3,11,45],[5,37,80],[1,101,77]].forEach(([n, d, pos]) => {
  // 小数展開
  let rem = n % d, digits = [];
  const seen = {};
  let cycleStart = -1;
  while (rem !== 0) {
    if (seen[rem] !== undefined) { cycleStart = seen[rem]; break; }
    seen[rem] = digits.length;
    rem *= 10;
    digits.push(Math.floor(rem / d));
    rem %= d;
  }
  if (cycleStart !== 0) return; // 純循環のみ扱う
  const cyc = digits;
  const p = cyc.length;
  const idx = (pos - 1) % p;
  kadd(`${n}/${d} を小数で表したとき、小数第 ${pos}位 の数字は何ですか？`,
    cyc[idx],
    `${n}÷${d}＝0.${cyc.join('')}${cyc.join('')}… と、${cyc.join('')}の${p}個がくり返されます。${pos}÷${p}＝${Math.floor(pos/p)}あまり${pos%p}なので、くり返しの${idx+1}番目の数字、つまり${cyc[idx]}です。`,
    5, 5);
});

/* 5. 三角数・四角数 */
[10, 15, 20, 25, 12, 18, 30].forEach(n => {
  kadd(`○を三角形の形に、1段目に1個、2段目に2個、3段目に3個…と並べていきます。${n}段目まで並べたとき、○は全部で何個ありますか？`,
    n*(n+1)/2,
    `1＋2＋3＋…＋${n}＝(1＋${n})×${n}÷2＝${n*(n+1)/2}個です（これを三角数といいます）。`,
    4, 3);
});
[8, 11, 14, 17, 20].forEach(n => {
  kadd(`ご石を正方形の形にすきまなく並べます。1辺に ${n}個ずつ並べたとき、いちばん外側にあるご石は何個ですか？`,
    4*(n-1),
    `外側1周のご石は（1辺の数－1）×4で求められます。(${n}－1)×4＝${4*(n-1)}個です。かどのご石を2回数えないようにするのがポイントです。`,
    4, 3);
});
[[6,3],[8,4],[10,3],[12,5]].forEach(([side, thick]) => {
  const outer = side*side, inner = (side - 2*thick)*(side - 2*thick);
  if (side - 2*thick < 0) return;
  kadd(`1辺に ${side}個ずつご石を並べた正方形から、まわりの ${thick}列 だけを残して中をくりぬいた「中空方陣」を作ります。ご石は全部で何個必要ですか？`,
    outer - inner,
    `全体は${side}×${side}＝${outer}個。くりぬく内側の正方形は1辺が${side}－${thick}×2＝${side-2*thick}個なので${inner}個。よって${outer}－${inner}＝${outer-inner}個です。`,
    5, 4);
});

/* 6. 数表 */
[[7,50],[5,38],[6,44],[8,60],[9,71]].forEach(([cols, n]) => {
  const row = Math.ceil(n/cols), col = n - (row-1)*cols;
  kadd(`1、2、3、… の整数を、左から右へ ${cols}列 ずつ順に並べて表を作ります（1行目は1〜${cols}、2行目は${cols+1}〜${cols*2}、…）。${n} は上から何行目にありますか？`,
    row,
    `1行に${cols}個ずつ並ぶので、${n}÷${cols}＝${Math.floor(n/cols)}あまり${n%cols}。${n % cols === 0 ? `わり切れるので${n/cols}行目のいちばん右です。` : `${Math.floor(n/cols)}行分を使い切って次の行の${n%cols}番目、つまり${row}行目です。`}`,
    5, 4);
});
[[7,12,3],[5,20,4],[6,15,2]].forEach(([cols, row, col]) => {
  const v = (row-1)*cols + col;
  kadd(`1、2、3、… の整数を、左から右へ ${cols}列 ずつ順に並べて表を作ります。上から ${row}行目、左から ${col}番目 の数はいくつですか？`,
    v,
    `${row}行目の左はしの数は ${cols}×(${row}－1)＋1＝${(row-1)*cols+1} です。そこから右へ${col-1}個進むので、${(row-1)*cols+1}＋${col-1}＝${v}です。`,
    5, 4);
});

/* 7. 階差数列 */
[[3,4,20],[2,5,15],[1,3,25],[5,6,18]].forEach(([a, d, n]) => {
  // 階差が a, a+d, a+2d ... の数列。初項 1
  // 第n項 = 1 + Σ(k=1..n-1)(a + (k-1)d)
  const term = 1 + (n-1)*a + d*(n-1)*(n-2)/2;
  kadd(`1、${1+a}、${1+a+(a+d)}、${1+a+(a+d)+(a+2*d)}、… という数の列は、となりとの差が ${a}、${a+d}、${a+2*d}、… と ${d}ずつ増えています。この数列の第 ${n}項 はいくつですか？`,
    term,
    `差の列は初項${a}、公差${d}の等差数列です。第${n}項は 1 に 差を(${n}－1)個たしたもの。差の合計は(${a}＋${a+(n-2)*d})×${n-1}÷2＝${(n-1)*a + d*(n-1)*(n-2)/2}なので、第${n}項は1＋${(n-1)*a + d*(n-1)*(n-2)/2}＝${term}です。`,
    5, 5);
});

/* 8. 等比数列の和 */
[[1,2,10],[1,3,7],[2,2,9],[1,2,12]].forEach(([a, r, n]) => {
  const sum = a * (Math.pow(r, n) - 1) / (r - 1);
  kadd(`${a}、${a*r}、${a*r*r}、${a*r*r*r}、… と、前の数を ${r}倍 していく数の列があります。はじめから ${n}個 の数の和はいくつですか？`,
    sum,
    `和をSとすると、S×${r}－S＝（最後の数×${r}）－（最初の数）なので、S×${r-1}＝${a}×${r}の${n}乗－${a}＝${a*Math.pow(r,n)}－${a}＝${a*Math.pow(r,n)-a}。よってS＝${sum}です。`,
    5, 5);
});

/* ══════════ 数の性質 (sansu_kazu.json) ══════════ */
const N = [];
const nadd = (question, answer, meaning, grade, difficulty) =>
  N.push({ question, answer: String(answer), meaning, grade, difficulty });

/* 9. 階乗の末尾0の個数 */
[20, 30, 50, 100, 125, 250].forEach(n => {
  let c = 0, p = 5;
  const parts = [];
  while (p <= n) { const q = Math.floor(n/p); c += q; parts.push(`${n}÷${p}＝${q}`); p *= 5; }
  nadd(`1 から ${n} までの整数をすべてかけあわせた数（${n}!）を計算すると、一の位から0が何個連続して並びますか？`,
    c,
    `末尾の0は 2×5 の組の数だけできます。2は5よりずっと多いので、5が何個あるかを数えます。${parts.join('、')}（小数点以下切り捨て）を合計して ${parts.map(s=>s.split('＝')[1]).join('＋')}＝${c}個です。`,
    6, 5);
});
[20, 30, 50, 64].forEach(n => {
  let c = 0, p = 2;
  while (p <= n) { c += Math.floor(n/p); p *= 2; }
  nadd(`1 から ${n} までの整数をすべてかけあわせた数（${n}!）は、2 で最大何回わり切れますか？`,
    c,
    `${n}までに2の倍数、4の倍数、8の倍数…がそれぞれいくつあるかを数えて合計します。${n}÷2＝${Math.floor(n/2)}、${n}÷4＝${Math.floor(n/4)}、${n}÷8＝${Math.floor(n/8)}、…（切り捨て）を全部たすと${c}回です。`,
    6, 5);
});

/* 10. 既約分数の個数と和 */
[42, 30, 36, 60, 24, 45].forEach(d => {
  let cnt = 0, sum = 0;
  for (let i = 1; i < d; i++) if (gcd(i, d) === 1) { cnt++; sum += i; }
  nadd(`分母が ${d} で、0 より大きく 1 より小さい分数のうち、これ以上約分できない分数（既約分数）は何個ありますか？`,
    cnt,
    `1から${d-1}までのうち、${d}と最大公約数が1になる数を数えます。${d}を素因数分解して、その素因数の倍数を取りのぞくと${cnt}個になります。`,
    6, 5);
  nadd(`分母が ${d} で、0 より大きく 1 より小さい既約分数をすべてたすと、いくつになりますか？`,
    sum / d,
    `既約分数は${cnt}個あります。分子の和は${sum}なので、和は${sum}/${d}＝${sum/d}です（分子どうしは a と ${d}－a がペアになるので、和は個数の半分×1になります）。`,
    6, 5);
});

/* 11. 約数の個数（平方数） */
[36, 100, 144, 225, 400].forEach(n => {
  let c = 0;
  for (let i = 1; i <= n; i++) if (n % i === 0) c++;
  nadd(`${n} の約数は何個ありますか？`,
    c,
    `${n}を素因数分解し、それぞれの指数に1をたしてかけあわせると約数の個数になります。${n}は平方数なので約数の個数は奇数個（${c}個）になります。`,
    5, 4);
});

/* 12. がい数の範囲 */
[[3400,100],[7000,1000],[250,10],[46000,1000]].forEach(([v, unit]) => {
  const lo = v - unit/2, hi = v + unit/2;
  nadd(`ある整数を ${unit === 1000 ? '百' : unit === 100 ? '十' : '一'}の位で四捨五入したところ、${v} になりました。もとの整数として考えられるいちばん小さい数はいくつですか？`,
    lo,
    `四捨五入して${v}になるのは、${lo} 以上 ${hi} 未満の数です。よっていちばん小さい整数は${lo}です。`,
    5, 4);
});
[[3400,100],[7000,1000],[250,10],[46000,1000]].forEach(([v, unit]) => {
  const hi = v + unit/2;
  nadd(`ある整数を ${unit === 1000 ? '百' : unit === 100 ? '十' : '一'}の位で四捨五入したところ、${v} になりました。もとの整数として考えられるいちばん大きい数はいくつですか？`,
    hi - 1,
    `四捨五入して${v}になるのは ${v - unit/2} 以上 ${hi} 未満の数です。整数でいちばん大きいのは${hi}－1＝${hi-1}です。`,
    5, 4);
});

/* 13. 商を四捨五入してからの逆算 */
[[7,3.4],[6,2.8],[9,4.5],[8,1.6]].forEach(([d, q]) => {
  // □÷d の商を小数第1位まで四捨五入したら q → □は q±0.05 の範囲 × d
  const lo = (q - 0.05) * d, hi = (q + 0.05) * d;
  nadd(`ある数を ${d} でわり、商を小数第2位で四捨五入したら ${q} になりました。ある数として考えられるいちばん小さい数はいくつですか？`,
    Math.round(lo*1000)/1000,
    `商は ${q - 0.05} 以上 ${q + 0.05} 未満です。もとの数はこれを${d}倍した範囲なので、${(q-0.05)}×${d}＝${Math.round(lo*1000)/1000} 以上 ${Math.round(hi*1000)/1000} 未満。いちばん小さいのは${Math.round(lo*1000)/1000}です。`,
    6, 5);
});

/* 14. 約数の条件（あまり） */
[[[47,71],5],[[38,59],3],[[53,79],7]].forEach(([nums, r]) => {
  // nums のどちらをわっても r あまる数 → 差の公約数で r より大きいもの
  const diff = nums[1] - nums[0];
  const cands = [];
  for (let i = r + 1; i <= nums[0] - r; i++) if ((nums[0]-r) % i === 0 && (nums[1]-r) % i === 0) cands.push(i);
  if (!cands.length) return;
  nadd(`${nums[0]} と ${nums[1]} のどちらをわっても ${r} あまる整数のうち、いちばん大きい数はいくつですか？`,
    cands[cands.length-1],
    `${nums[0]}－${r}＝${nums[0]-r} と ${nums[1]}－${r}＝${nums[1]-r} をどちらもわり切る数です。この2数の最大公約数は${cands[cands.length-1]}で、あまり${r}より大きいので条件に合います。`,
    5, 4);
});

/* ── 保存 ─────────────────────────────────── */
function commit(fname, prefix, items) {
  const src = load(fname);
  const start = src.length;
  const added = items.map((q, i) => ({
    id: prefix + String(start + i + 1).padStart(3, '0'),
    question: q.question, answer: q.answer, meaning: q.meaning,
    grade: q.grade, difficulty: q.difficulty,
  }));
  const all = src.concat(added);
  if (new Set(all.map(q => q.id)).size !== all.length) throw new Error('ID重複 ' + fname);
  added.forEach(q => {
    if (!/^\d+(\.\d+)?$/.test(q.answer) && !/^\d+\/\d+$/.test(q.answer))
      throw new Error('答えが不正: ' + q.id + ' = ' + q.answer);
  });
  save(fname, all);
  console.log(fname, '追加:', added.length, '/ 合計:', all.length);
}
commit('sansu_kisoku.json', 'sr', K);
commit('sansu_kazu.json', 'sn', N);
