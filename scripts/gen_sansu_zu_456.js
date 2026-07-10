// sansu_zu.json の小4〜6を拡張（既存12テンプレートを幅広い数値で3倍に）
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
const round2 = (v) => Math.round(v * 100) / 100;

// ===== 小4 =====
function g4_d1() { // 直線上の角（一直線=180°）
  const a = randInt(10, 170);
  const x = 180 - a;
  const rad = a * Math.PI / 180;
  const ex = round2(100 + 70 * Math.cos(rad)), ey = round2(100 - 70 * Math.sin(rad));
  const svg = `<svg viewBox="0 0 200 115" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto"><line x1="20" y1="100" x2="180" y2="100" stroke="#4f9eff" stroke-width="2.5"/><line x1="100" y1="100" x2="${ex}" y2="${ey}" stroke="#4f9eff" stroke-width="2.5"/><text x="120" y="88" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${a}°</text><text x="75" y="88" fill="#ff6688" font-size="14" text-anchor="middle" font-family="sans-serif" font-weight="bold">x</text></svg>`;
  return { question: `1本の直線の上に角ができています。角x は何度？（もう一方の角は${a}°）`, answer: String(x), meaning: `180－${a}＝${x}`, svg };
}
function g4_d2() { // 平行線の錯角
  const a = randInt(15, 165);
  const svg = `<svg viewBox="0 0 200 126" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto"><line x1="20" y1="40" x2="180" y2="40" stroke="#4f9eff" stroke-width="2.5"/><line x1="20" y1="95" x2="180" y2="95" stroke="#4f9eff" stroke-width="2.5"/><line x1="50" y1="115" x2="150" y2="20" stroke="#4f9eff" stroke-width="2.5"/><text x="125" y="35" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${a}°</text><text x="80" y="90" fill="#ff6688" font-size="14" text-anchor="middle" font-family="sans-serif" font-weight="bold">x</text></svg>`;
  return { question: `平行な2本の直線に1本の直線が交わっています。1つの角が${a}°のとき、さっ角（Z の位置にある角）x は何度ですか？`, answer: String(a), meaning: `さっ角は等しいので${a}°`, svg };
}
function g4_d3() { // 三角形の残りの角
  const a = randInt(20, 90), b = randInt(20, 150 - a);
  const x = 180 - a - b;
  if (x < 10 || x > 150) return null;
  const svg = `<svg viewBox="0 0 200 124" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto"><polygon points="30,110 170,110 120,20" fill="none" stroke="#4f9eff" stroke-width="2.5"/><text x="48" y="102" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${a}°</text><text x="148" y="102" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${b}°</text><text x="118" y="42" fill="#ff6688" font-size="14" text-anchor="middle" font-family="sans-serif" font-weight="bold">x</text></svg>`;
  return { question: `三角形の2つの角が${a}°と${b}°のとき、のこりの角x は何度ですか？`, answer: String(x), meaning: `180－${a}－${b}＝${x}`, svg };
}
function g4_d4() { // 星形の先端の角（5つの先端の和は180°）
  const angs = [];
  let sum = 0;
  for (let i = 0; i < 3; i++) { const v = randInt(15, 50); angs.push(v); sum += v; }
  const a4 = randInt(15, 50); angs.push(a4); sum += a4;
  const x = 180 - sum;
  if (x < 10 || x > 60) return null;
  return { question: `星形の5つの先端の角のうち、4つが${angs.join('°・')}°です。のこりの先端の角x は何度ですか？`, answer: String(x), meaning: `180－(${angs.join('+')})＝${x}` };
}

// ===== 小5 =====
function g5_d1() { // 三角形の面積
  const base = randInt(6, 30), height = randInt(4, 24);
  const area = base * height / 2;
  if (!Number.isInteger(area)) return null;
  const svg = `<svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto"><polygon points="30,110 170,110 110,20" fill="rgba(79,158,255,0.18)" stroke="#4f9eff" stroke-width="2.5"/><line x1="110" y1="20" x2="110" y2="110" stroke="#ffd166" stroke-width="2.5" stroke-dasharray="4,3"/><text x="100" y="124" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${base}cm</text><text x="124" y="70" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${height}cm</text></svg>`;
  return { question: `底辺${base}cm・高さ${height}cmの三角形の面積は何cm²ですか？`, answer: String(area), meaning: `${base}×${height}÷2＝${area}`, svg };
}
function g5_d2() { // 円周
  const d = randInt(3, 80);
  const circ = round2(d * 3.14);
  const svg = `<svg viewBox="0 0 200 124" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto"><circle cx="100" cy="62" r="50" fill="none" stroke="#4f9eff" stroke-width="2.5"/><line x1="50" y1="62" x2="150" y2="62" stroke="#ffd166" stroke-width="2.5"/><text x="100" y="54" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${d}cm</text></svg>`;
  return { question: `直径${d}cmの円のまわりの長さ（円周）は何cmですか？（円周率3.14）`, answer: String(circ), meaning: `${d}×3.14＝${circ}`, svg };
}
function g5_d3() { // 平行四辺形の対角線でできる三角形の面積
  const base = randInt(6, 26), height = randInt(4, 20);
  const area = base * height / 2;
  if (!Number.isInteger(area)) return null;
  const svg = `<svg viewBox="0 0 200 128" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto"><polygon points="25,105 60,25 175,25 140,105" fill="rgba(79,158,255,0.18)" stroke="#4f9eff" stroke-width="2.5"/><line x1="60" y1="25" x2="60" y2="105" stroke="#ffd166" stroke-width="2.5" stroke-dasharray="4,3"/><text x="85" y="120" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${base}cm</text><text x="48" y="70" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${height}cm</text></svg>`;
  return { question: `底辺${base}cm・高さ${height}cmの平行四辺形の中に、対角線を1本ひいてできる三角形1つの面積は何cm²ですか？`, answer: String(area), meaning: `${base}×${height}÷2＝${area}（平行四辺形の半分）`, svg };
}
function g5_d4() { // 正方形から内接円をのぞいた面積
  const a = randInt(4, 90);
  const r = a / 2;
  const area = round2(a * a - 3.14 * r * r);
  const svg = `<svg viewBox="0 0 200 126" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto"><rect x="45" y="10" width="110" height="110" fill="rgba(79,158,255,0.18)" stroke="#4f9eff" stroke-width="2.5"/><circle cx="100" cy="65" r="55" fill="#0d1530" stroke="#4f9eff" stroke-width="2.5"/><text x="100" y="8" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${a}cm</text></svg>`;
  return { question: `1辺${a}cmの正方形の中に、ぴったり入る円をかきました。正方形から円をのぞいた部分の面積は何cm²ですか？（円周率3.14）`, answer: String(area), meaning: `${a}×${a}－3.14×${r}×${r}＝${area}`, svg };
}

// ===== 小6 =====
function g6_d1() { // おうぎ形の面積
  const r = randInt(3, 20);
  const angle = pick([30, 45, 60, 90, 120, 135, 150]);
  const area = round2(3.14 * r * r * angle / 360);
  const halfAngleRad = (angle / 2) * Math.PI / 180;
  const svg = `<svg viewBox="0 0 200 128" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto"><path d="M 100 115 L ${round2(100 - 85 * Math.sin(halfAngleRad))} ${round2(115 - 85 * (1 - Math.cos(halfAngleRad)))} A 85 85 0 0 1 ${round2(100 + 85 * Math.sin(halfAngleRad))} ${round2(115 - 85 * (1 - Math.cos(halfAngleRad)))} Z" fill="rgba(79,158,255,0.18)" stroke="#4f9eff" stroke-width="2.5"/><text x="100" y="101" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${angle}°</text><text x="50" y="70" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${r}cm</text></svg>`;
  return { question: `半径${r}cm・中心角${angle}°のおうぎ形の面積は何cm²ですか？（円周率3.14）`, answer: String(area), meaning: `3.14×${r}×${r}×${angle}/360＝${area}`, svg };
}
function g6_d2() { // 四分円から直角二等辺三角形を切り取ったのこり
  const r = randInt(4, 70);
  const area = round2(3.14 * r * r / 4 - r * r / 2);
  return { question: `半径${r}cmの四分円から直角二等辺三角形を切り取ったのこりの面積は何cm²ですか？（円周率3.14）`, answer: String(area), meaning: `3.14×${r}×${r}÷4－${r}×${r}÷2＝${area}` };
}
function g6_d3() { // 正方形の中の葉っぱ形（四分円2つの重なり）
  const a = randInt(4, 70);
  const quarter = 3.14 * a * a / 4;
  const area = round2(2 * quarter - a * a);
  const svg = `<svg viewBox="0 0 200 126" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto"><rect x="50" y="15" width="100" height="100" fill="none" stroke="#4f9eff" stroke-width="2.5"/><path d="M 50 115 A 100 100 0 0 1 150 15 A 100 100 0 0 1 50 115 Z" fill="rgba(79,158,255,0.18)" stroke="#4f9eff" stroke-width="2.5"/><text x="100" y="10" fill="#ffd166" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${a}cm</text></svg>`;
  return { question: `1辺${a}cmの正方形の中の葉っぱ形（四分円2つの重なり）の面積は何cm²ですか？（円周率3.14）`, answer: String(area), meaning: `四分円2つ(${round2(quarter)}×2)－正方形${a * a}＝${area}`, svg };
}
function g6_d4() { // ヒポクラテスの三日月
  const a = randInt(3, 16), b = randInt(3, 16);
  const c2 = a * a + b * b; // 斜辺の2乗
  // 三日月の面積の合計＝直角三角形の面積（有名な定理）
  const area = round2(a * b / 2);
  return { question: `直角をはさむ2辺が${a}cm・${b}cmの直角三角形で、ヒポクラテスの三日月（2つの三日月形）の面積の合計は何cm²ですか？`, answer: String(area), meaning: `ヒポクラテスの定理より、三日月の面積の合計＝直角三角形の面積＝${a}×${b}÷2＝${area}` };
}

const GENERATORS = { 4: [g4_d1, g4_d2, g4_d3, g4_d4], 5: [g5_d1, g5_d2, g5_d3, g5_d4], 6: [g6_d1, g6_d2, g6_d3, g6_d4] };

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

const filePath = path.join(__dirname, '..', 'data', 'sansu_zu.json');
const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const kept = existing.filter(q => q.grade < 4);
let idCounter = Math.max(...existing.map(q => Number(q.id.replace(/\D/g, '')))) + 1;
const prefix = existing[0].id.replace(/\d+$/, '');

const newItems = [];
[4, 5, 6].forEach(grade => {
  for (let diff = 1; diff <= 4; diff++) {
    const items = genN(GENERATORS[grade][diff - 1], 60);
    items.forEach(it => {
      const entry = { id: `${prefix}${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff };
      if (it.svg) entry.svg = it.svg;
      newItems.push(entry);
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  }
});

const all = [...kept, ...newItems];
fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問`);
