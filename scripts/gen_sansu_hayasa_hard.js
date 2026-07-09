// sansu_hayasa.json の小5・小6 難易度3-4を流水算の逆算・出会い算・追いつき算で置き換える
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

// 型A：流水算の逆算（上り・下りの速さから静水速さ or 流れの速さを求める）
function typeGyakusan() {
  const staticV = randInt(6, 30), current = randInt(1, staticV - 1);
  const up = staticV - current, down = staticV + current;
  if (Math.random() < 0.5) {
    return { question: `上りの速さが時速${up}km、下りの速さが時速${down}kmの船があります。この船の静水での速さは時速何kmですか。`, answer: String(staticV), meaning: `(${up}＋${down})÷2＝${staticV}` };
  }
  return { question: `上りの速さが時速${up}km、下りの速さが時速${down}kmの船があります。この川の流れの速さは時速何kmですか。`, answer: String(current), meaning: `(${down}－${up})÷2＝${current}` };
}

// 型B：出会い算（2そうが向かい合って出発、出会うまでの時間）
function typeDeai() {
  const a = randInt(4, 20), b = randInt(4, 20);
  if (a === b) return null;
  const t = randInt(1, 10);
  const distance = (a + b) * t;
  return { question: `静水での速さが時速${a}kmのA船と時速${b}kmのB船が、${distance}kmはなれた川の両岸から同時に向かい合って出発しました。流れの影響がない区間だとすると、何時間後に出会いますか。`, answer: String(t), meaning: `${distance}÷(${a}＋${b})＝${t}` };
}

// 型C：追いつき算
function typeOitsuki() {
  const a = randInt(60, 300), b = randInt(30, a - 10);
  if (a <= b) return null;
  const t = randInt(2, 20);
  const head = (a - b) * t;
  return { question: `分速${a}mの自転車が、分速${b}mで歩いている人を追いかけます。人が${head}m先を歩いているとき、自転車が追いつくのは何分後ですか。`, answer: String(t), meaning: `${head}÷(${a}－${b})＝${t}` };
}

const GEN_BY_DIFF = {
  3: [typeGyakusan, typeDeai],
  4: [typeDeai, typeOitsuki],
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

const filePath = path.join(__dirname, '..', 'data', 'sansu_hayasa.json');
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const kept = existing.filter(q => !((q.grade === 5 || q.grade === 6) && (q.difficulty === 3 || q.difficulty === 4)));
let idCounter = Math.max(...existing.map(q => Number(q.id.replace(/\D/g, '')))) + 1;
const prefix = existing[0].id.replace(/\d+$/, '');

const newItems = [];
[5, 6].forEach(grade => {
  [3, 4].forEach(diff => {
    const items = genN(GEN_BY_DIFF[diff], 20);
    items.forEach(it => {
      newItems.push({ id: `${prefix}${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  });
});

const all = [...kept, ...newItems];
fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問`);
