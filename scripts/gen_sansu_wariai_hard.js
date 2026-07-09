// sansu_wariai.json の小5・小6 難易度3-4を連比・差一定算で置き換える
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }

// 型A：連比 A:B=a1:b1、B:C=b2:c2 から A:B:Cを求め、最後の項を問う
function typeRenpi() {
  const a1 = randInt(2, 9), b1 = randInt(2, 9);
  if (gcd(a1, b1) !== 1 || a1 === b1) return null;
  const b2 = randInt(2, 9), c2 = randInt(2, 9);
  if (gcd(b2, c2) !== 1 || b2 === c2) return null;
  const L = b1 * b2 / gcd(b1, b2);
  const A = a1 * (L / b1), B = L, C = c2 * (L / b2);
  const g = gcd(gcd(A, B), C);
  const p = A / g, q = B / g, r = C / g;
  if (p > 200 || q > 200 || r > 200 || p === q || q === r) return null;
  return {
    question: `A：B＝${a1}：${b1}、B：C＝${b2}：${c2}のとき、A：B：Cを最も簡単な整数の比で表すと${p}：${q}：□です。□に入る数を求めなさい。`,
    answer: String(r),
    meaning: `B を${L}にそろえると A＝${A}、B＝${B}、C＝${C}。最も簡単にすると${p}：${q}：${r}`,
  };
}

// 型B：差一定算（貯金額の変化）
function typeSaIchitei() {
  const a = randInt(2, 9), b = randInt(2, 9);
  if (gcd(a, b) !== 1 || a === b) return null;
  const k = randInt(2, 30);
  const A0 = a * k, B0 = b * k;
  const p = randInt(2, 9), q = randInt(2, 9);
  if (gcd(p, q) !== 1 || p === q) return null;
  if (a * q <= b * p) return null; // 比が縮む方向であることを保証
  const loM = Math.floor(B0 / q) + 1;
  const hiM = Math.ceil(A0 / p) - 1;
  if (loM > hiM) return null;
  const m = randInt(loM, hiM);
  const newA = p * m, newB = q * m;
  let x = A0 - newA, y = newB - B0;
  if (x <= 0 || y <= 0) return null;
  // お小遣いらしい金額感になるよう全体をスケール（比の関係は維持したまま拡大）
  const scale = randInt(20, 150);
  x *= scale; y *= scale;
  const B0scaled = B0 * scale;
  if (x > 50000 || y > 50000 || B0scaled > 200000) return null;
  return {
    question: `AさんとBさんの貯金額の比は${a}：${b}でした。ところが、Aさんが${x}円使い、Bさんが${y}円貯金したので、Aさんと Bさんの貯金額の比は${p}：${q}になりました。はじめにBさんは何円貯金していましたか。`,
    answer: String(B0scaled),
    meaning: `比の1あたり＝${k * scale}円、B＝${b}×${k * scale}＝${B0scaled}円`,
  };
}

// 型C：3量の比の合成（速さ・重さ等ではなく人数配分の応用、連比の別パターン）
function typeRenpiKotae2ban() {
  const a1 = randInt(2, 9), b1 = randInt(2, 9);
  if (gcd(a1, b1) !== 1 || a1 === b1) return null;
  const b2 = randInt(2, 9), c2 = randInt(2, 9);
  if (gcd(b2, c2) !== 1 || b2 === c2) return null;
  const L = b1 * b2 / gcd(b1, b2);
  const A = a1 * (L / b1), B = L, C = c2 * (L / b2);
  const g = gcd(gcd(A, B), C);
  const p = A / g, q = B / g, r = C / g;
  if (p > 200 || q > 200 || r > 200 || p === q || q === r) return null;
  return {
    question: `A：B＝${a1}：${b1}、B：C＝${b2}：${c2}のとき、A：B：Cを最も簡単な整数の比で表すと${p}：□：${r}です。□に入る数を求めなさい。`,
    answer: String(q),
    meaning: `B を${L}にそろえると A＝${A}、B＝${B}、C＝${C}。最も簡単にすると${p}：${q}：${r}`,
  };
}

const GEN_BY_DIFF = {
  3: [typeRenpi, typeRenpiKotae2ban],
  4: [typeSaIchitei],
};

function genN(fns, n) {
  const out = []; const seen = new Set(); let tries = 0;
  while (out.length < n && tries < 60000) {
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

const filePath = path.join(__dirname, '..', 'data', 'sansu_wariai.json');
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
// 小5・小6の難易度3・4を除去し、新しい内容に差し替え
const kept = existing.filter(q => !((q.grade === 5 || q.grade === 6) && (q.difficulty === 3 || q.difficulty === 4)));
let idCounter = Math.max(...existing.map(q => Number(q.id.replace('sw', '')))) + 1;

const newItems = [];
[5, 6].forEach(grade => {
  [3, 4].forEach(diff => {
    const items = genN(GEN_BY_DIFF[diff], 20);
    items.forEach(it => {
      newItems.push({ id: `sw${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  });
});

const all = [...kept, ...newItems];
fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問`);
