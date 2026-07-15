// 数の性質（sansu_kazu.json）を「間引き＋多様化＋図」で再構成。
// 既存は多くのセルが2テンプレ×30問で同一問題の数字違いが最大86問連続、図は0枚。
// 全テンプレ最大10問に圧縮し、最大公約数・最小公倍数に「すだれ算」、倍数の個数に
// 数直線、公倍数・公約数にベン図を付与した新テンプレを追加する。答えはコード計算。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_kazu.json');
const old = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let idN = 0;
const nid = () => 'sn' + String(++idN).padStart(3, '0');

// ---------- 数論ユーティリティ ----------
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => a / gcd(a, b) * b;
function divisors(n) { const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; }
function primeFactors(n) { const f = []; for (let p = 2; p * p <= n; p++) while (n % p === 0) { f.push(p); n /= p; } if (n > 1) f.push(n); return f; }

// ---------- SVG ----------
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// すだれ算（連除法）：n1, n2 の共通素因数で割っていく
function figLadder(n1, n2) {
  let a = n1, b = n2; const rows = [];
  for (let p = 2; p <= Math.min(a, b);) {
    if (a % p === 0 && b % p === 0) { rows.push([p, a, b]); a /= p; b /= p; }
    else p++;
  }
  const y0 = 20, dy = 20, xF = 40, xA = 95, xB = 140;
  let body = '';
  rows.forEach(([p, aa, bb], i) => {
    const y = y0 + i * dy;
    body += txt(xF, y, p, GN, 12, 'end');
    body += `<path d="M${xF + 6} ${y - 12} q10 0 10 8 l0 6" fill="none" stroke="${WT}" stroke-width="1.3"/>`;
    body += txt(xA, y, aa, WT, 12) + txt(xB, y, bb, WT, 12);
  });
  const yl = y0 + rows.length * dy;
  body += `<line x1="${xF + 8}" y1="${yl - 13}" x2="${xB + 18}" y2="${yl - 13}" stroke="${YE}" stroke-width="1.2"/>`;
  body += txt(xA, yl, a, YE, 13) + txt(xB, yl, b, YE, 13);
  const h = yl + 12;
  return S(`190 ${h}`, body);
}
// 数直線：0..max、step の倍数を強調
function figNumLine(max, step) {
  const x0 = 20, x1 = 220, y = 46, n = Math.floor(max / step);
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${WT}" stroke-width="2"/>` +
    `<polygon points="${x1},${y} ${x1 - 7},${y - 4} ${x1 - 7},${y + 4}" fill="${WT}"/>`;
  const show = Math.min(n, 8);
  for (let i = 1; i <= show; i++) {
    const px = x0 + (i / (show + 0.5)) * (x1 - x0 - 12);
    body += `<circle cx="${px}" cy="${y}" r="4" fill="${RD}"/>` + txt(px, y - 9, i * step, YE, 10);
  }
  body += txt(x0, y + 16, '0', WT, 10);
  return S('236 62', body);
}
// ベン図（2円）
function figVenn(la, lb, both) {
  const body = `<circle cx="90" cy="50" r="40" fill="${BL}" opacity="0.3" stroke="${BL}" stroke-width="2"/>` +
    `<circle cx="150" cy="50" r="40" fill="${PK}" opacity="0.3" stroke="${PK}" stroke-width="2"/>` +
    txt(70, 30, la, BL, 11) + txt(170, 30, lb, PK, 11) +
    txt(65, 55, '□', WT, 11) + txt(175, 55, '□', WT, 11) + txt(120, 55, both || '□', YE, 12);
  return S('240 100', body);
}

const out = [];
function add(grade, diff, question, answer, meaning, svg) {
  out.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, ...(svg ? { svg } : {}) });
}
function norm(s) { return String(s || '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }

// ---------- Pass1: 既存を各テンプレ最大8問に圧縮 ----------
const counter = {};
for (const q of old) {
  const key = q.grade + '-' + q.difficulty + '|' + norm(q.question);
  counter[key] = (counter[key] || 0) + 1;
  if (counter[key] <= 8) out.push({ ...q, id: nid() });
}

// ---------- Pass2: 図つき新テンプレ ----------
// 最大公約数（すだれ算）: 4-2
[[24, 36], [18, 48], [30, 45], [36, 60], [42, 56], [40, 72], [54, 81], [48, 84]].forEach(([a, b]) =>
  add(4, 2, `${a}と${b}の最大公約数を求めなさい。`, gcd(a, b),
    `共通の素因数で割っていく（すだれ算）。割った数の積が最大公約数で、${a}と${b}の最大公約数は${gcd(a, b)}です。`, figLadder(a, b)));
// 最小公倍数（すだれ算）: 4-2 / 5-2
[[6, 8], [12, 18], [15, 20], [24, 36], [14, 21], [10, 25], [18, 30], [16, 24]].forEach(([a, b]) =>
  add(4, 2, `${a}と${b}の最小公倍数を求めなさい。`, lcm(a, b),
    `すだれ算で共通素因数を割り、外側と下の数をすべてかける。${a}と${b}の最小公倍数は${lcm(a, b)}です。`, figLadder(a, b)));

// 倍数の個数（数直線）: 4-1 / 4-3
[[100, 6], [80, 7], [90, 8], [120, 9], [60, 4], [150, 12], [70, 5], [110, 11]].forEach(([max, step]) =>
  add(4, 1, `1から${max}までの整数のうち、${step}の倍数は何個ありますか？`, Math.floor(max / step),
    `${max}÷${step}＝${Math.floor(max / step)}あまり…なので、${step}の倍数は${Math.floor(max / step)}個です。`, figNumLine(max, step)));

// 公倍数の個数（ベン図の考え方）: 5-3 / 4-4
[[100, 3, 4], [100, 4, 6], [200, 6, 8], [150, 5, 6], [100, 2, 3], [120, 4, 5], [200, 5, 8], [90, 3, 5]].forEach(([max, a, b]) => {
  const na = Math.floor(max / a), nb = Math.floor(max / b), nab = Math.floor(max / lcm(a, b));
  add(4, 4, `1から${max}までの整数のうち、${a}でも${b}でもわり切れる数は何個ありますか？`, nab,
    `${a}でも${b}でもわり切れる＝${a}と${b}の公倍数（${lcm(a, b)}の倍数）。${max}÷${lcm(a, b)}＝${nab}個です。`, figVenn(`${a}の倍数`, `${b}の倍数`, `${nab}個`));
});

// 約数の個数（素因数分解）: 4-3 / 5-1
[[24], [36], [48], [60], [72], [96], [100], [120]].forEach(([n]) => {
  const pf = primeFactors(n); const cnt = {}; pf.forEach(p => cnt[p] = (cnt[p] || 0) + 1);
  const num = Object.values(cnt).reduce((a, e) => a * (e + 1), 1);
  const expr = Object.entries(cnt).map(([p, e]) => `${p}<sup>${e}</sup>`).join('×');
  add(4, 3, `${n}の約数は全部で何個ありますか？`, num,
    `${n}を素因数分解すると ${Object.entries(cnt).map(([p, e]) => e > 1 ? `${p}の${e}乗` : p).join('×')}。約数の個数は各指数に1を足してかける：${Object.values(cnt).map(e => e + 1).join('×')}＝${num}個です。`,
    S('220 60', txt(110, 32, `${n} ＝ ${Object.entries(cnt).map(([p, e]) => e > 1 ? `${p}<tspan baseline-shift="super" font-size="8">${e}</tspan>` : p).join(' × ')}`, YE, 14)));
});

// あまりの問題（すだれ的でなく数直線）: 5-3
[[8, 12, 3], [4, 9, 3], [6, 8, 5], [5, 6, 2], [3, 7, 1], [4, 10, 3], [6, 9, 4], [8, 10, 6]].forEach(([a, b, r]) => {
  const L = lcm(a, b); let x = r; while (x < 10) x += L;
  add(5, 3, `${a}でわっても${b}でわっても${r}あまる整数のうち、最も小さい2けたの数を求めなさい。`, x,
    `${a}と${b}の公倍数（${L}の倍数）に${r}をたした数。2けたで最小のものは${x}です。`, figNumLine(L + r, L));
});

// 連続整数の等分図
function figSeq(n) {
  const x0 = 18, w = 204, bw = Math.min(26, (w) / n - 3), gap = (w - bw * n) / (n - 1), y = 34, h = 22;
  let body = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (bw + gap);
    const mid = i === Math.floor(n / 2);
    body += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${mid ? PK : BL}" opacity="${mid ? 0.9 : 0.35}" stroke="${WT}" stroke-width="1"/>`;
  }
  body += txt(x0 + w / 2, y - 6, `連続する${n}個`, YE, 11) + txt(x0 + w / 2, y + h + 13, '真ん中×個数＝和', WT, 10);
  return S('240 74', body);
}

// 約数の総和（素因数分解の図）: 5-1 / 6-1
[[24], [36], [48], [60], [72], [40], [54], [96]].forEach(([n]) => {
  const s = divisors(n).reduce((a, e) => a + e, 0);
  const cnt = {}; primeFactors(n).forEach(p => cnt[p] = (cnt[p] || 0) + 1);
  add(5, 1, `${n}の約数の総和（すべての約数の和）を求めなさい。`, s,
    `${n}の約数をすべてたすと${s}になります。`,
    S('230 58', txt(115, 34, `${n} ＝ ${Object.entries(cnt).map(([p, e]) => e > 1 ? `${p}<tspan baseline-shift="super" font-size="8">${e}</tspan>` : p).join(' × ')}`, YE, 14)));
});
[[100], [128], [147], [162], [196], [225], [242], [175]].forEach(([n]) => {
  const num = divisors(n).length;
  const cnt = {}; primeFactors(n).forEach(p => cnt[p] = (cnt[p] || 0) + 1);
  add(6, 1, `${n}の約数は全部で何個ありますか？`, num,
    `素因数分解して各指数に1をたしてかけると${num}個です。`,
    S('230 58', txt(115, 34, `${n} ＝ ${Object.entries(cnt).map(([p, e]) => e > 1 ? `${p}<tspan baseline-shift="super" font-size="8">${e}</tspan>` : p).join(' × ')}`, YE, 14)));
});

// 3つの数の最小公倍数（すだれ算は2数向けなので素因数分解表示）: 5-2
[[4, 6, 8], [3, 5, 6], [6, 8, 12], [4, 9, 6], [5, 6, 10], [8, 12, 16], [6, 10, 15], [9, 12, 18]].forEach(([a, b, c]) => {
  const L = lcm(lcm(a, b), c);
  add(5, 2, `${a}と${b}と${c}の最小公倍数を求めなさい。`, L,
    `2つずつ最小公倍数をとる。${a}と${b}で${lcm(a, b)}、それと${c}で${L}です。`, figLadder(lcm(a, b), c));
});
// 公約数の個数（すだれ算）: 5-2
[[24, 36], [48, 72], [30, 45], [60, 84], [40, 60], [54, 90], [56, 84], [36, 60]].forEach(([a, b]) =>
  add(5, 2, `${a}と${b}の公約数は全部で何個ありますか？`, divisors(gcd(a, b)).length,
    `公約数は最大公約数（${gcd(a, b)}）の約数。その個数は${divisors(gcd(a, b)).length}個です。`, figLadder(a, b)));

// 連続する整数の和（等分図）: 6-2
[[5, 6], [7, 6], [3, 4], [5, 10], [7, 8], [9, 6], [3, 8], [5, 12]].forEach(([n, mid]) => {
  const sum = n * mid, largest = mid + (n - 1) / 2;
  add(6, 2, `連続する${n}つの整数の和が${sum}のとき、最も大きい数を求めなさい。`, largest,
    `連続する${n}個の和＝真ん中×${n}。真ん中は${sum}÷${n}＝${mid}。最大は真ん中＋${(n - 1) / 2}＝${largest}です。`, figSeq(n));
});

// 3つの数で割ったあまり（数直線）: 6-3
[[2, 3, 4, 5], [3, 4, 5, 1], [2, 3, 5, 1], [3, 5, 6, 2], [4, 5, 6, 3], [2, 4, 5, 1], [3, 4, 6, 1], [2, 5, 6, 1]].forEach(([a, b, c, r]) => {
  const L = lcm(lcm(a, b), c); let x = r; while (x < 10) x += L;
  add(6, 3, `${a}でも${b}でも${c}でわると${r}あまる整数のうち、最も小さい2けたの数を求めなさい。`, x,
    `${a}・${b}・${c}の公倍数（${L}の倍数）に${r}をたした数。2けた最小は${x}です。`, figNumLine(L + r, L));
});

// あまりが異なる問題（数直線）: 6-4
[[5, 3, 7, 5], [4, 1, 6, 3], [5, 2, 8, 5], [3, 2, 7, 6], [4, 3, 9, 8], [5, 4, 6, 5], [7, 6, 8, 7], [3, 1, 5, 3]].forEach(([a, ra, b, rb]) => {
  // a で ra あまり、b で rb あまる最小（探索）
  let x = -1;
  for (let k = ra; k < a * b + a; k += a) if (k % b === rb) { x = k; break; }
  if (x < 0) return;
  add(6, 4, `${a}でわると${ra}あまり、${b}でわると${rb}あまる整数のうち、最も小さいものを求めなさい。`, x,
    `条件に合う最小の整数を順に調べると${x}です。`, figNumLine(x + a * 2, a));
});

let clean = out.filter(q => q && q.question);
// 最終キャップ：各セル×テンプレ最大10（図つき優先）
const cnt2 = {}; const svgFirst = [...clean].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt2[k] = (cnt2[k] || 0) + 1; if (cnt2[k] <= 10) keep.add(q.id); }
clean = clean.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(clean, null, 2), 'utf8');

const cell = {};
clean.forEach(q => { const k = q.grade + '-' + q.difficulty; (cell[k] = cell[k] || []).push(q); });
console.log('総数:', clean.length, ' 図あり:', clean.filter(q => q.svg).length);
Object.keys(cell).sort().forEach(k => {
  const m = cell[k].reduce((a, q) => { const n = norm(q.question); a[n] = (a[n] || 0) + 1; return a; }, {});
  console.log(`  ${k}: ${cell[k].length}問 / ${Object.keys(m).length}テンプレ / 最多${Math.max(...Object.values(m))} / 図${cell[k].filter(q => q.svg).length}`);
});
