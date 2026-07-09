// sansu_tokusan.json（特殊算）生成スクリプト。小4〜6×難易度1〜4、各20問=240問
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function gcdI(a, b) { return b === 0 ? a : gcdI(b, a % b); }

// ===== 小4 =====
function g4_d1() { // 植木算（両端に植える）
  const d = randInt(2, 10), count = randInt(5, 20), N = d * count;
  return { question: `長さ${N}mの道に、はしからはしまで${d}mおきに木を植えます。木は何本必要ですか？（両端にも植えます）`, answer: String(count + 1), meaning: `${N}÷${d}＋1＝${count + 1}` };
}
function g4_d2() { // 和差算
  const small = randInt(5, 50), diff = randInt(2, 30), big = small + diff;
  const sum = big + small;
  return { question: `2つの数があります。和は${sum}、差は${diff}です。大きい方の数を求めなさい。`, answer: String(big), meaning: `(${sum}＋${diff})÷2＝${big}` };
}
function g4_d3() { // 過不足算（不足パターン）
  const n = randInt(6, 25), a = randInt(2, 5), c = a + randInt(1, 4), b = randInt(1, a + 2);
  const total = a * n + b, d = c * n - total;
  if (d < 1) return null;
  return { question: `子どもたちにあめを配ります。1人に${a}個ずつ配ると${b}個あまり、1人に${c}個ずつ配ると${d}個たりません。子どもの人数を求めなさい。`, answer: String(n), meaning: `(${b}＋${d})÷(${c}－${a})＝${n}` };
}
function g4_d4() { // つるかめ算（頭と足）
  const t = randInt(3, 15), k = randInt(3, 15), N = t + k, L = 2 * t + 4 * k;
  return { question: `つるとかめが合わせて${N}匹います。足の数の合計は${L}本です。つるは何羽いますか？`, answer: String(t), meaning: `(4×${N}－${L})÷2＝${t}` };
}

// ===== 小5 =====
function g5_d1() { // つるかめ算（単価）
  const a = randInt(3, 20), b = randInt(3, 20), N = a + b;
  let p1 = randInt(10, 100), p2 = randInt(10, 100);
  if (p1 === p2) return null;
  const Y = p1 * a + p2 * b;
  return { question: `1個${p1}円のりんごと1個${p2}円のみかんを合わせて${N}個買ったところ、代金の合計は${Y}円でした。りんごは何個買いましたか？`, answer: String(a), meaning: `(${p2}×${N}－${Y})÷(${p2}－${p1})＝${a}` };
}
function g5_d2() { // 消去算
  const x = randInt(10, 30) * 10, y = randInt(10, 30) * 10;
  if (x === y) return null;
  const c1 = randInt(1, 5), d1 = randInt(1, 5), c2 = randInt(1, 5), d2 = randInt(1, 5);
  if (c1 * d2 === c2 * d1) return null; // 行列式0は不可
  const S1 = c1 * x + d1 * y, S2 = c2 * x + d2 * y;
  return { question: `りんご${c1}個とみかん${d1}個で代金は${S1}円、りんご${c2}個とみかん${d2}個で代金は${S2}円でした。りんご1個の値段を求めなさい。`, answer: String(x), meaning: `連立方程式を解くとりんご1個＝${x}円` };
}
function g5_d3() { // 仕事算（基礎）。m,n互いに素・kを使うと a=k・m・(m+n), b=k・n・(m+n) のとき合計日数=k・m・n で必ず整数になる
  const m = randInt(1, 5), n = randInt(1, 5);
  if (m === n || gcdI(m, n) !== 1) return null;
  const k = randInt(1, 4);
  const a = k * m * (m + n), b = k * n * (m + n), days = k * m * n;
  if (a > 200 || b > 200 || a === b) return null;
  return { question: `ある仕事をAさん1人ですると${a}日、Bさん1人ですると${b}日かかります。2人ですると何日かかりますか？`, answer: String(days), meaning: `${a}×${b}÷(${a}＋${b})＝${days}` };
}
function g5_d4() { // 年齢算
  const child = randInt(5, 15), x = randInt(1, 20), k = randInt(2, 5);
  const childAtX = child + x, fatherAtX = k * childAtX, father = fatherAtX - x;
  if (father > 75 || father <= child) return null;
  return { question: `現在、父は${father}才、子は${child}才です。父の年れいが子の年れいのちょうど${k}倍になるのは何年後ですか？`, answer: String(x), meaning: `${x}年後：父${father + x}才＝子${childAtX}才×${k}` };
}

// ===== 小6 =====
function g6_d1() { // 過不足算（余り・余りパターン、大きい数）
  const n = randInt(15, 50), a = randInt(3, 10), c = a + randInt(1, 5), b2 = randInt(1, a * 2), b1 = b2 + (c - a) * n;
  if (b1 > 500) return null;
  return { question: `おかしを子どもたちに配ります。1人に${a}個ずつ配ると${b1}個あまり、1人に${c}個ずつ配ると${b2}個あまります。子どもの人数を求めなさい。`, answer: String(n), meaning: `(${b1}－${b2})÷(${c}－${a})＝${n}` };
}
function g6_d2() { // 仕事算（応用、A管とAB合計から逆算）。同じm,n,k構成でa,b,合計xを必ず整数にする
  const m = randInt(1, 6), n = randInt(1, 6);
  if (m === n || gcdI(m, n) !== 1) return null;
  const k = randInt(1, 4);
  const a = k * m * (m + n), b = k * n * (m + n), x = k * m * n;
  if (a > 300 || b > 300 || a === b || x === a) return null;
  return { question: `水そうをいっぱいにするのに、A管だけだと${a}分、A管とB管を同時に使うと${x}分かかります。B管だけだと何分かかりますか？`, answer: String(b), meaning: `1/${x}－1/${a}＝1/${b}` };
}
function g6_d3() { // つるかめ算（3種、比の条件つき）
  const b = randInt(3, 15), c = randInt(3, 15);
  const a = 2 * b;
  const p1 = randInt(50, 200), p2 = randInt(50, 200), p3 = randInt(50, 200);
  if (new Set([p1, p2, p3]).size < 3) return null;
  const N = a + b + c, Y = p1 * a + p2 * b + p3 * c;
  return { question: `1個${p1}円のA、1個${p2}円のB、1個${p3}円のCを合わせて${N}個買い、代金は合計${Y}円でした。Aの個数はBの個数のちょうど2倍であるとき、Cの個数を求めなさい。`, answer: String(c), meaning: `A＝2×B、A＋B＋C＝${N}、代金合計＝${Y}円からC＝${c}個` };
}
function g6_d4() { // 複合特殊算（差の条件＋重さ）
  const w = randInt(5, 30), k = randInt(1, 15);
  const p1 = randInt(10, 50), p2 = randInt(10, 50);
  if (p1 === p2) return null;
  const red = w + k, N = red + w, Y = p1 * red + p2 * w;
  return { question: `赤玉と白玉が合わせて${N}個あり、重さの合計は${Y}gです。赤玉1個は${p1}g、白玉1個は${p2}gで、赤玉の個数は白玉の個数より${k}個多いとき、白玉は何個ありますか？`, answer: String(w), meaning: `赤＝白＋${k}、${p1}×(白＋${k})＋${p2}×白＝${Y} → 白＝${w}` };
}

const GENERATORS = {
  4: [g4_d1, g4_d2, g4_d3, g4_d4],
  5: [g5_d1, g5_d2, g5_d3, g5_d4],
  6: [g6_d1, g6_d2, g6_d3, g6_d4],
};

function genN(fn, n) {
  const out = []; const seen = new Set(); let tries = 0;
  while (out.length < n && tries < 60000) {
    tries++;
    const r = fn();
    if (!r) continue;
    if (seen.has(r.question)) continue;
    seen.add(r.question);
    out.push(r);
  }
  if (out.length < n) throw new Error(`生成不足: ${n}問中${out.length}問`);
  return out;
}

const all = [];
let idCounter = 1;
for (let grade = 4; grade <= 6; grade++) {
  for (let diff = 1; diff <= 4; diff++) {
    const fn = GENERATORS[grade][diff - 1];
    const items = genN(fn, 20);
    items.forEach(it => {
      all.push({ id: `st${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  }
}
fs.writeFileSync(path.join(__dirname, '..', 'data', 'sansu_tokusan.json'), JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問を書き出しました`);
