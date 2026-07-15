// 数の性質に「楽しく学べる」文脈を追加する。花火や2台のバスが同時に…（最小公倍数）、
// カエルが数直線をジャンプ（倍数）、おかしを余りなく配る（約数）、素数ゼミ（13年・17年）
// など、身近で楽しい設定を図つきで増やす。答えはすべてコード計算で検証する。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_kazu.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let maxId = Math.max(...data.map(q => Number(q.id.slice(2))));
const nid = () => 'sn' + String(++maxId).padStart(3, '0');

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => a / gcd(a, b) * b;
function divisors(n) { const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; }

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', GN = '#38d9a9', PK = '#ff6688', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// すだれ算
function figLadder(n1, n2) {
  let a = n1, b = n2; const rows = [];
  for (let p = 2; p <= Math.min(a, b);) { if (a % p === 0 && b % p === 0) { rows.push([p, a, b]); a /= p; b /= p; } else p++; }
  const y0 = 20, dy = 20, xF = 40, xA = 95, xB = 140;
  let body = '';
  rows.forEach(([p, aa, bb], i) => { const y = y0 + i * dy; body += txt(xF, y, p, GN, 12, 'end') + `<path d="M${xF + 6} ${y - 12} q10 0 10 8 l0 6" fill="none" stroke="${WT}" stroke-width="1.3"/>` + txt(xA, y, aa, WT, 12) + txt(xB, y, bb, WT, 12); });
  const yl = y0 + rows.length * dy;
  body += `<line x1="${xF + 8}" y1="${yl - 13}" x2="${xB + 18}" y2="${yl - 13}" stroke="${YE}" stroke-width="1.2"/>` + txt(xA, yl, a, YE, 13) + txt(xB, yl, b, YE, 13);
  return S(`190 ${yl + 12}`, body);
}
// カエルのジャンプ（数直線・step の倍数に着地）
function figFrog(step, max) {
  const x0 = 20, x1 = 224, y = 48, n = Math.min(Math.floor(max / step), 7);
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${WT}" stroke-width="2"/><polygon points="${x1},${y} ${x1 - 7},${y - 4} ${x1 - 7},${y + 4}" fill="${WT}"/>` + txt(x0, y + 15, '0', WT, 10);
  for (let i = 1; i <= n; i++) {
    const px = x0 + (i / (n + 0.5)) * (x1 - x0 - 12), pxPrev = x0 + ((i - 1) / (n + 0.5)) * (x1 - x0 - 12);
    body += `<path d="M${pxPrev} ${y} Q ${(px + pxPrev) / 2} ${y - 20} ${px} ${y}" fill="none" stroke="${GN}" stroke-width="1.5" stroke-dasharray="3 2"/>`;
    body += `<circle cx="${px}" cy="${y}" r="4" fill="${GN}"/>` + txt(px, y + 15, i * step, YE, 10);
  }
  body += txt(x0 + 8, y - 24, '🐸', WT, 13, 'start');
  return S('240 68', body);
}

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
function add(grade, diff, question, answer, meaning, svg) {
  data.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}

// ① 花火が同時に光る（最小公倍数）: 4-2
[[4, 6], [6, 8], [3, 5], [8, 12], [5, 10], [6, 9]].forEach(([a, b]) =>
  add(4, 2, `赤い花火は${a}秒ごと、青い花火は${b}秒ごとに光ります。今、同時に光りました。次に同時に光るのは何秒後ですか？`, lcm(a, b),
    `同時に光る間かくは${a}と${b}の最小公倍数。すだれ算で求めると${lcm(a, b)}秒後です。`, figLadder(a, b)));
// ② 2台のバスが同時に発車（最小公倍数）: 5-2
[[12, 18], [10, 15], [8, 20], [9, 12], [15, 20], [6, 14]].forEach(([a, b]) =>
  add(5, 2, `駅前から、A行きのバスは${a}分ごと、B行きのバスは${b}分ごとに発車します。8時に両方同時に発車しました。次に同時に発車するのは何分後ですか？`, lcm(a, b),
    `発車が重なる間かくは${a}と${b}の最小公倍数＝${lcm(a, b)}分後です。`, figLadder(a, b)));
// ③ 素数ゼミ（13年ゼミと17年ゼミ）: 6-2
[[13, 17], [2, 3], [4, 6], [6, 10], [12, 8], [14, 21]].forEach(([a, b]) =>
  add(6, 2, `${a}年ごとに大発生するセミと、${b}年ごとに大発生するセミがいます。今年いっしょに大発生しました。次にいっしょに大発生するのは何年後ですか？`, lcm(a, b),
    `いっしょに出る間かくは${a}と${b}の最小公倍数＝${lcm(a, b)}年後です。（13と17のように素数どうしだと重なりにくい！）`, figLadder(a, b)));

// ④ カエルのジャンプ（倍数・数直線）: 4-1
[[3, 30], [4, 40], [5, 45], [6, 48], [7, 56], [8, 64]].forEach(([step, goal]) =>
  add(4, 1, `カエルが数直線の0から右へ${step}ずつジャンプします。ちょうど${goal}にとまるのは、何回目のジャンプですか？`, goal / step,
    `${step}の倍数に着地する。${goal}÷${step}＝${goal / step}回目です。`, figFrog(step, goal)));
// ⑤ カエルが着地しない数（倍数の判定）: 4-1
[[4, 30], [3, 25], [5, 27], [6, 40], [7, 50], [8, 60]].forEach(([step, target]) =>
  add(4, 1, `カエルが0から右へ${step}ずつジャンプします。${target}にちょうどとまれますか？（とまれるなら「はい」、とまれないなら「いいえ」）`, target % step === 0 ? 'はい' : 'いいえ',
    `${target}÷${step}は${target % step === 0 ? 'わり切れる' : 'わり切れない（あまり' + (target % step) + '）'}ので「${target % step === 0 ? 'はい' : 'いいえ'}」です。`, figFrog(step, target)));

// ⑥ おかしを余りなく配る（約数）: 4-1
[[24], [36], [18], [30], [48], [20]].forEach(([n]) =>
  add(4, 1, `${n}個のクッキーを、余りが出ないように何人かで同じ数ずつ分けます。分けられる人数は全部で何通りありますか？（1人や${n}人も数えます）`, divisors(n).length,
    `余りなく分けられる人数は${n}の約数。約数は全部で${divisors(n).length}個なので${divisors(n).length}通りです。`, S('230 40', txt(115, 26, `${n}の約数：${divisors(n).join('、')}`, YE, 11))));

// ---------- 各セル×テンプレ最大10問（図つき優先） ----------
const cnt = {}; const svgFirst = [...data].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] <= 10) keep.add(q.id); }
const out = data.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');
console.log('総数:', out.length, ' 図あり:', out.filter(q => q.svg).length);
