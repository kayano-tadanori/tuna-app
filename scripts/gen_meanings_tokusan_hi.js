// data/sansu_tokusan.json の difficulty 3,4 (360件) 向けに詳細な meaning を生成する
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'sansu_tokusan.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const targets = data.filter(d => d.difficulty === 3 || d.difficulty === 4);

if (targets.length !== 360) {
  throw new Error('target count mismatch: ' + targets.length);
}

const results = [];
const usedIds = new Set();

function assertEq(computed, answerStr, id, label) {
  const ans = Number(answerStr);
  if (!Number.isInteger(computed) || computed !== ans) {
    throw new Error(`検算不一致 id=${id} label=${label} computed=${computed} answer=${answerStr}`);
  }
}

for (const item of targets) {
  const { id, question, answer, grade, difficulty } = item;
  let meaning = null;
  let m;

  // ---- grade4, difficulty3: 過不足算 ----
  if (grade === 4 && difficulty === 3) {
    // パターンa: 子どもたちにあめを配ります。1人にa個ずつ配るとb個あまり、1人にc個ずつ配るとd個たりません。
    m = question.match(/子どもたちにあめを配ります。1人に(\d+)個ずつ配ると(\d+)個あまり、1人に(\d+)個ずつ配ると(\d+)個たりません。/);
    if (m) {
      const [, a, b, c, d] = m.map(Number);
      const n = (b + d) / (c - a);
      assertEq(n, answer, id, 'g4d3a');
      meaning = `これは過不足算です。①1人に配る個数を${a}個から${c}個に増やすと、1人あたり${c}－${a}＝${c - a}個ずつ多く必要になります。②配ると${b}個あまっていたのが逆に${d}個たりなくなるので、必要な個数の合計は${b}＋${d}＝${b + d}個増えたことになります。③この増えた分が1人あたりの差${c - a}個の積み重ねなので、子どもの人数は(${b}＋${d})÷(${c}－${a})＝${n}`;
    } else {
      // パターンb: おかしを子どもたちに配ります。1人にa個ずつ配るとb1個あまり、1人にc個ずつ配るとb2個あまります。
      m = question.match(/おかしを子どもたちに配ります。1人に(\d+)個ずつ配ると(\d+)個あまり、1人に(\d+)個ずつ配ると(\d+)個あまります。/);
      if (m) {
        const [, a, b1, c, b2] = m.map(Number);
        const n = (b1 - b2) / (c - a);
        assertEq(n, answer, id, 'g4d3b');
        meaning = `これは過不足算です。①1人に配る個数を${a}個から${c}個に増やすと、1人あたり${c}－${a}＝${c - a}個ずつ多く必要になります。②その分あまりが減り、あまりの個数は${b1}個から${b2}個へと${b1}－${b2}＝${b1 - b2}個だけ少なくなります。③この減った分が1人あたりの差${c - a}個の積み重ねなので、子どもの人数は(${b1}－${b2})÷(${c}－${a})＝${n}`;
      }
    }
  }

  // ---- grade4, difficulty4: つるかめ算 ----
  if (grade === 4 && difficulty === 4) {
    m = question.match(/つるとかめが合わせて(\d+)匹います。足の数の合計は(\d+)本です。/);
    if (m) {
      const [, N, L] = m.map(Number);
      const t = (4 * N - L) / 2;
      assertEq(t, answer, id, 'g4d4a');
      meaning = `これはつるかめ算です。①もし${N}匹すべてがかめだったとすると、足の数は4×${N}＝${4 * N}本になります。②実際の足の数${L}本との差は${4 * N}－${L}＝${4 * N - L}本です。③つる1匹をかめ1匹に置きかえるごとに足は2本ずつ減るので、つるの数は(4×${N}－${L})÷2＝${t}`;
    } else {
      m = question.match(/2輪車と3輪車が合わせて(\d+)台あります。車輪の数の合計は(\d+)個です。/);
      if (m) {
        const [, N, W] = m.map(Number);
        const bike = (3 * N - W) / 1;
        assertEq(bike, answer, id, 'g4d4b');
        meaning = `これはつるかめ算です。①もし${N}台すべてが3輪車だったとすると、車輪の数は3×${N}＝${3 * N}個になります。②実際の車輪の数${W}個との差は${3 * N}－${W}＝${3 * N - W}個です。③3輪車を2輪車に置きかえるごとに車輪は1個ずつ減るので、2輪車の台数は(3×${N}－${W})÷1＝${bike}`;
      }
    }
  }

  // ---- grade5, difficulty3: 仕事算 ----
  if (grade === 5 && difficulty === 3) {
    m = question.match(/ある仕事をAさん1人ですると(\d+)日、Bさん1人ですると(\d+)日かかります。/);
    if (m) {
      const [, a, b] = m.map(Number);
      const whole = a * b;
      const rateA = b, rateB = a;
      const days = whole / (rateA + rateB);
      assertEq(days, answer, id, 'g5d3a');
      meaning = `これは仕事算です。①全体の仕事量を${a}×${b}＝${whole}とおくと、Aさんは1日に${whole}÷${a}＝${rateA}、Bさんは1日に${whole}÷${b}＝${rateB}の仕事をすることになります。②2人が1日にする仕事量の合計は${rateA}＋${rateB}＝${rateA + rateB}です。③よって2人で行うと、${whole}÷(${rateA}＋${rateB})＝${days}`;
    } else {
      m = question.match(/全体の仕事量を(\d+)とします。Aさんは1日に(\d+)、Bさんは1日に(\d+)の仕事ができます。/);
      if (m) {
        const [, L, rateA, rateB] = m.map(Number);
        const days = L / (rateA + rateB);
        assertEq(days, answer, id, 'g5d3b');
        meaning = `これは仕事算です。①Aさんは1日に${rateA}、Bさんは1日に${rateB}の仕事ができるので、2人が1日にする仕事量の合計は${rateA}＋${rateB}＝${rateA + rateB}です。②全体の仕事量${L}をこの1日あたりの合計でわれば、かかる日数が求められます。③よって${L}÷(${rateA}＋${rateB})＝${days}`;
      }
    }
  }

  // ---- grade5, difficulty4: 年齢算 ----
  if (grade === 5 && difficulty === 4) {
    m = question.match(/現在、父は(\d+)才、子は(\d+)才です。父の年れいが子の年れいのちょうど(\d+)倍になるのは何年後ですか？/);
    if (m) {
      const [, father, child, k] = m.map(Number);
      const D = father - child;
      const childAtX = D / (k - 1);
      const x = childAtX - child;
      assertEq(x, answer, id, 'g5d4a');
      meaning = `これは年齢算です。①父と子の年れいの差は${father}－${child}＝${D}才で、これは何年たっても変わりません。②父の年れいが子のちょうど${k}倍になるとき、差の${D}才は子の年れいの(${k}－1)倍にあたるので、そのときの子の年れいは${D}÷(${k}－1)＝${childAtX}才です。③よって、今から${childAtX}－${child}＝${x}`;
    } else {
      m = question.match(/現在、父と子の年れいの和は(\d+)才です。(\d+)年後に父の年れいが子の年れいのちょうど(\d+)倍になるとき、現在の子の年れいは何才ですか？/);
      if (m) {
        const [, sumNow, x, k] = m.map(Number);
        const sumAtX = sumNow + 2 * x;
        const childAtX = sumAtX / (k + 1);
        const child = childAtX - x;
        assertEq(child, answer, id, 'g5d4b');
        meaning = `これは年齢算です。①${x}年後には父も子も${x}才ずつ年をとるので、2人の年れいの和は${sumNow}＋2×${x}＝${sumAtX}才になります。②そのとき父は子のちょうど${k}倍なので、この和は子の年れいの(${k}＋1)倍にあたります。よって${x}年後の子の年れいは${sumAtX}÷(${k}＋1)＝${childAtX}才です。③現在の子の年れいはそこから${x}年前なので、${childAtX}－${x}＝${child}`;
      }
    }
  }

  // ---- grade6, difficulty3: つるかめ算(3種、比の条件つき) ----
  if (grade === 6 && difficulty === 3) {
    m = question.match(/1個(\d+)円のA、1個(\d+)円のB、1個(\d+)円のCを合わせて(\d+)個買い、代金は合計(\d+)円でした。Aの個数はBの個数のちょうど2倍であるとき、Cの個数を求めなさい。/);
    if (m) {
      const [, p1, p2, p3, N, Y] = m.map(Number);
      const denom = 2 * p1 + p2 - 3 * p3;
      const x = (Y - p3 * N) / denom; // Bの個数
      const c = N - 3 * x;
      assertEq(c, answer, id, 'g6d3');
      meaning = `これはつるかめ算（3種類）です。①Bの個数を□個とすると、Aの個数はその2倍の2×□個で、個数の合計の式から、Cの個数は${N}－3×□個と表せます。②代金の合計の式は${p1}×2×□＋${p2}×□＋${p3}×(${N}－3×□)＝${Y}となります。③この式を整理して解くと□＝${x}（Bの個数）となります。④よってCの個数は${N}－3×${x}＝${c}`;
    }
  }

  // ---- grade6, difficulty4: 複合特殊算（つるかめ＋和差） ----
  if (grade === 6 && difficulty === 4) {
    m = question.match(/赤玉と白玉が合わせて(\d+)個あり、重さの合計は(\d+)gです。赤玉1個は(\d+)g、白玉1個は(\d+)gで、赤玉の個数は白玉の個数より(\d+)個多いとき、白玉は何個ありますか？/);
    if (m) {
      const [, N, Y, p1, p2, k] = m.map(Number);
      const rem = Y - p1 * k;
      const denom = p1 + p2;
      const w = rem / denom;
      assertEq(w, answer, id, 'g6d4');
      meaning = `これはつるかめ算と和差算を組み合わせた問題です。①白玉の個数を□個とすると、赤玉の個数は白玉より${k}個多いので□＋${k}個です。②重さの合計の式は${p1}×(□＋${k})＋${p2}×□＝${Y}となります。③これを展開すると${p1}×□＋${p1 * k}＋${p2}×□＝${Y}、まとめると(${p1}＋${p2})×□＝${Y}－${p1 * k}＝${rem}となります。④よって白玉の個数は${rem}÷${denom}＝${w}`;
    }
  }

  if (!meaning) {
    throw new Error(`パターン未一致 id=${id} question=${question}`);
  }
  if (usedIds.has(id)) {
    throw new Error(`id重複 id=${id}`);
  }
  usedIds.add(id);
  results.push({ id, meaning });
}

if (results.length !== 360) {
  throw new Error('結果件数不一致: ' + results.length);
}

const outPath = path.join(__dirname, 'meanings_tokusan_hi.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n', 'utf8');
console.log('書き出し完了:', results.length, '件 ->', outPath);
