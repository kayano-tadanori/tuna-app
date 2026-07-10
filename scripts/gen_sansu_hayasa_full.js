// sansu_hayasa.json（速さ）を小5〜6全難易度で3倍に拡張
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
const round2 = v => Math.round(v * 100) / 100;

// ===== 小5 難易度1 =====
function g5_d1a() { const s = randInt(2, 90), t = randInt(1, 10); return { question: `時速${s}kmで${t}時間進むと何km進みますか？（小数で答えよ）`, answer: String(round2(s * t)), meaning: `${s}×${t}＝${round2(s * t)}` }; }
function g5_d1b() { const s = randInt(2, 30), t = randInt(1, 8); const dist = s * t; return { question: `${dist}kmを${t}時間で歩きました。時速何kmですか？（小数で答えよ）`, answer: String(round2(dist / t)), meaning: `${dist}÷${t}＝${round2(dist / t)}` }; }
function g5_d1c() { const s = randInt(2, 90); return { question: `時速${s}kmは秒速何mですか？`, answer: String(round2(s * 1000 / 3600)), meaning: `${s}×1000÷3600＝${round2(s * 1000 / 3600)}` }; }
function g5_d1d() { const s = randInt(1, 20); const kmh = round2(s * 3600 / 1000); return { question: `秒速${s}mは時速何kmですか？`, answer: String(kmh), meaning: `${s}×3600÷1000＝${kmh}` }; }
function g5_d1() { return pick([g5_d1a, g5_d1b, g5_d1c, g5_d1d])(); }

// ===== 小5 難易度2 =====
function g5_d2a() { const dist = randInt(2, 30), t = randInt(2, 60); return { question: `${dist}kmの道のりを${t}分で走りました。分速何mですか？`, answer: String(round2(dist * 1000 / t)), meaning: `${dist}×1000÷${t}＝${round2(dist * 1000 / t)}` }; }
function g5_d2b() { const s = randInt(50, 300), t = randInt(1, 5); return { question: `分速${s}mで${t}時間進むと何km進みますか？（小数で答えよ）`, answer: String(round2(s * 60 * t / 1000)), meaning: `${s}×60×${t}÷1000＝${round2(s * 60 * t / 1000)}` }; }
function g5_d2c() { const s = randInt(5, 40), t = randInt(5, 90); return { question: `時速${s}kmの自転車で${t}分走ると何km進みますか？（小数で答えよ）`, answer: String(round2(s * t / 60)), meaning: `${s}×${t}÷60＝${round2(s * t / 60)}` }; }
function g5_d2d() { const d1 = randInt(100, 2000), t1 = randInt(2, 20), d2 = randInt(100, 2000), t2 = randInt(2, 20); const avg = round2((d1 + d2) / (t1 + t2)); return { question: `はじめ${d1}mを${t1}分で、続けて${d2}mを${t2}分で歩きました。全体の平均の速さは分速何mですか？`, answer: String(avg), meaning: `(${d1}＋${d2})÷(${t1}＋${t2})＝${avg}` }; }
function g5_d2() { return pick([g5_d2a, g5_d2b, g5_d2c, g5_d2d])(); }

// ===== 小5 難易度3・4：流水算の逆算・出会い算・追いつき算 =====
function typeGyakusan() {
  const staticV = randInt(6, 30), current = randInt(1, staticV - 1);
  const up = staticV - current, down = staticV + current;
  if (Math.random() < 0.5) return { question: `上りの速さが時速${up}km、下りの速さが時速${down}kmの船があります。この船の静水での速さは時速何kmですか。`, answer: String(staticV), meaning: `(${up}＋${down})÷2＝${staticV}` };
  return { question: `上りの速さが時速${up}km、下りの速さが時速${down}kmの船があります。この川の流れの速さは時速何kmですか。`, answer: String(current), meaning: `(${down}－${up})÷2＝${current}` };
}
function typeDeai() {
  const a = randInt(4, 20), b = randInt(4, 20);
  if (a === b) return null;
  const t = randInt(1, 10);
  const distance = (a + b) * t;
  return { question: `静水での速さが時速${a}kmのA船と時速${b}kmのB船が、${distance}kmはなれた川の両岸から同時に向かい合って出発しました。流れの影響がない区間だとすると、何時間後に出会いますか。`, answer: String(t), meaning: `${distance}÷(${a}＋${b})＝${t}` };
}
function typeOitsuki() {
  const a = randInt(60, 300), b = randInt(30, a - 10);
  if (a <= b) return null;
  const t = randInt(2, 20);
  const head = (a - b) * t;
  return { question: `分速${a}mの自転車が、分速${b}mで歩いている人を追いかけます。人が${head}m先を歩いているとき、自転車が追いつくのは何分後ですか。`, answer: String(t), meaning: `${head}÷(${a}－${b})＝${t}` };
}
function g_d3() { return pick([typeGyakusan, typeDeai])(); }
function g_d4() { return pick([typeDeai, typeOitsuki])(); }

// ===== 小6 難易度1 =====
function g6_d1a() {
  const r1 = randInt(2, 9), r2 = randInt(2, 9);
  if (gcd(r1, r2) !== 1 || r1 === r2) return null;
  const unit = randInt(2, 15);
  const total = (r1 + r2) * unit;
  return { question: `AとBが同時に反対方向へ歩き出しました。速さの比は${r1}：${r2}で、2人合わせて${total}km歩いたとき、Bは何km歩きましたか？`, answer: String(unit * r2), meaning: `${total}÷(${r1}＋${r2})×${r2}＝${unit * r2}` };
}
function g6_d1b() { const s = randInt(40, 300), t = randInt(2, 60); return { question: `分速${s}mで${t}分歩くと何m進みますか？`, answer: String(s * t), meaning: `${s}×${t}＝${s * t}` }; }
function g6_d1c() { const s = randInt(2, 90), t = randInt(1, 120); return { question: `時速${s}kmで${t}分歩くと何km進みますか？（小数で答えよ）`, answer: String(round2(s * t / 60)), meaning: `${s}×${t}÷60＝${round2(s * t / 60)}` }; }
function g6_d1d() { const s = randInt(2, 90); return { question: `時速${s}kmは秒速何mですか？`, answer: String(round2(s * 1000 / 3600)), meaning: `${s}×1000÷3600＝${round2(s * 1000 / 3600)}` }; }
function g6_d1() { return pick([g6_d1a, g6_d1b, g6_d1c, g6_d1d])(); }

// ===== 小6 難易度2 =====
function g6_d2a() {
  const r1 = randInt(2, 9), r2 = randInt(2, 9);
  if (gcd(r1, r2) !== 1 || r1 === r2) return null;
  const tB = randInt(2, 30) * r1; // r1で割り切れるように
  const tA = tB * r2 / r1;
  if (!Number.isInteger(tA)) return null;
  return { question: `同じ道のりを進むのに、AとBの速さの比は${r1}：${r2}です。Bが${tB}分かかるとき、Aは何分かかりますか？`, answer: String(tA), meaning: `速さの比の逆が時間の比。${tB}×${r2}/${r1}＝${tA}` };
}
function g6_d2b() { const staticV = randInt(6, 30), current = randInt(1, staticV - 1); return { question: `静水での速さが時速${staticV}kmの船が、流れの速さ時速${current}kmの川を上ります。上りの速さは時速何kmですか？`, answer: String(staticV - current), meaning: `${staticV}－${current}＝${staticV - current}` }; }
function g6_d2c() { const staticV = randInt(6, 30), current = randInt(1, staticV - 1); return { question: `静水時速${staticV}kmの船が、流れ時速${current}kmの川を下ります。下りの速さは時速何kmですか？`, answer: String(staticV + current), meaning: `${staticV}＋${current}＝${staticV + current}` }; }
function g6_d2d() { const staticV = randInt(6, 30), current = randInt(1, staticV - 1); const up = staticV - current, down = staticV + current; return { question: `同じ船で、川を下る速さは時速${down}km、上る速さは時速${up}kmです。川の流れの速さは時速何kmですか？`, answer: String(current), meaning: `(${down}－${up})÷2＝${current}` }; }
function g6_d2() { return pick([g6_d2a, g6_d2b, g6_d2c, g6_d2d])(); }

const GENERATORS = {
  5: [g5_d1, g5_d2, g_d3, g_d4],
  6: [g6_d1, g6_d2, g_d3, g_d4],
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
[5, 6].forEach(grade => {
  for (let diff = 1; diff <= 4; diff++) {
    const fn = GENERATORS[grade][diff - 1];
    const items = genN(fn, 60);
    items.forEach(it => {
      all.push({ id: `sh${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  }
});

const filePath = path.join(__dirname, '..', 'data', 'sansu_hayasa.json');
fs.writeFileSync(filePath, JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問`);
