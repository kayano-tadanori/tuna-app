// sansu_kazu.json の小5・小6 難易度4に位取り誤差の問題を追加（浜学園最高レベル特訓相当）
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

// 小数点を1けた右にうつした数ともとの数の差から、もとの数を求める
function typeIchidori() {
  const whole = randInt(1, 99), dec = randInt(1, 9);
  const X = whole + dec / 10; // 小数第一位までの数
  const diff = Math.round(X * 9 * 10) / 10;
  if (diff > 9999) return null;
  return { question: `ある数の小数点を1けた右にうつすと、もとの数との差は${diff}になりました。もとの数を求めなさい。`, answer: String(Math.round(X * 10) / 10), meaning: `もとの数をXとすると10X－X＝9X＝${diff}、X＝${Math.round(X * 10) / 10}` };
}

const filePath = path.join(__dirname, '..', 'data', 'sansu_kazu.json');
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
// 小5・小6 難易度4のうち半分（10問ずつ）を位取り誤差問題に差し替え、多様性を確保
let idCounter = Math.max(...existing.map(q => Number(q.id.replace(/\D/g, '')))) + 1;
const prefix = existing[0].id.replace(/\d+$/, '');

function genN(fn, n) {
  const out = []; const seen = new Set(); let tries = 0;
  while (out.length < n && tries < 20000) {
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

let all = existing;
[5, 6].forEach(grade => {
  const cellItems = all.filter(q => q.grade === grade && q.difficulty === 4);
  const toReplace = cellItems.slice(0, 10); // 20問中10問を差し替え
  const replaceIds = new Set(toReplace.map(q => q.id));
  const newItems = genN(typeIchidori, 10).map(it => ({ id: `${prefix}${String(idCounter++).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: 4 }));
  all = all.filter(q => !replaceIds.has(q.id)).concat(newItems);
  console.log(`grade${grade} diff4: 10問差し替え`);
});

fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問`);
