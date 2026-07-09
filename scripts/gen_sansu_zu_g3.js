// sansu_zu.json の小3 難易度3・4に三角形分類・棒組み合わせ問題を追加（No.18相当）
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

// 型A：二等辺三角形の頂角・底角
function typeIsosceles() {
  const baseAngle = randInt(10, 80);
  const apex = 180 - 2 * baseAngle;
  if (apex <= 0) return null;
  if (Math.random() < 0.5) {
    return { question: `二等辺三角形で、底角がそれぞれ${baseAngle}°のとき、頂角は何度ですか？`, answer: String(apex), meaning: `180－${baseAngle}×2＝${apex}` };
  }
  return { question: `二等辺三角形で、頂角が${apex}°のとき、底角は何度ですか？`, answer: String(baseAngle), meaning: `(180－${apex})÷2＝${baseAngle}` };
}

// 型B：棒の組み合わせで三角形を作る（三角形の成立条件）
function typeRodTriangle() {
  const n = 4;
  const lengths = new Set();
  while (lengths.size < n) lengths.add(randInt(2, 15));
  const arr = [...lengths].sort((a, b) => a - b);
  let count = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const [x, y, z] = [arr[i], arr[j], arr[k]];
    if (x + y > z) count++;
  }
  if (count === 0 || count === 4) return null; // 面白みのある問題だけ採用
  return { question: `長さ${arr.join('cm・')}cmの棒が1本ずつあります。この中から3本を選んで三角形を作るとき、三角形ができる選び方は何通りありますか？`, answer: String(count), meaning: `2辺の和が残りの1辺より長くなる組み合わせが${count}通り` };
}

// 型C：複合図形の角度（正三角形＋二等辺三角形）
function typeCompositeAngle() {
  const baseAngle = randInt(20, 70);
  const x = 60 + baseAngle;
  if (x >= 180) return null;
  return { question: `正三角形の1つの頂点に、底角${baseAngle}°の二等辺三角形がくっついています。図の角x（正三角形の角と二等辺三角形の底角を足した外側の角）は何度ですか？`, answer: String(x), meaning: `60＋${baseAngle}＝${x}` };
}

// 型D：正三角形の数え上げ（1辺に小さい三角形がn個ならぶ大きい正三角形の中の三角形の総数）
function typeTriangleCount() {
  const n = randInt(2, 6);
  // 上向き三角形の数 = 1+2+...+n = n(n+1)/2、下向き三角形の数 = 1+2+...+(n-2)（nが2以上のとき、n-2>=0）
  const up = n * (n + 1) / 2;
  let down = 0;
  for (let k = 1; k <= n - 2; k++) down += k;
  const total = up + down;
  return { question: `1辺に小さい正三角形が${n}つならぶ大きい正三角形があります（1辺1cmの正三角形をすきまなくならべた形）。この図の中に、正三角形は全部で何こありますか？（向きが逆の三角形もふくめる）`, answer: String(total), meaning: `上向き${up}こ＋下向き${down}こ＝${total}こ` };
}

const GEN_BY_DIFF = {
  3: [typeIsosceles, typeCompositeAngle],
  4: [typeRodTriangle, typeTriangleCount],
};

function genN(fns, n) {
  const out = []; const seen = new Set(); let tries = 0;
  while (out.length < n && tries < 40000) {
    tries++;
    const fn = fns[randInt(0, fns.length - 1)];
    const r = fn();
    if (!r) continue;
    if (seen.has(r.question)) continue;
    seen.add(r.question);
    out.push(r);
  }
  if (out.length < n) throw new Error(`生成不足: ${n}問中${out.length}問`);
  return out;
}

const filePath = path.join(__dirname, '..', 'data', 'sansu_zu.json');
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const kept = existing.filter(q => !(q.grade === 3 && (q.difficulty === 3 || q.difficulty === 4)));
let idCounter = Math.max(...existing.map(q => Number(q.id.replace(/\D/g, '')))) + 1;
const prefix = existing[0].id.replace(/\d+$/, '');

const newItems = [];
[3, 4].forEach(diff => {
  const items = genN(GEN_BY_DIFF[diff], 20);
  items.forEach(it => {
    newItems.push({ id: `${prefix}${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade: 3, difficulty: diff });
    idCounter++;
  });
  console.log(`grade3 diff${diff}: OK`);
});

const all = [...kept, ...newItems];
fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問`);
