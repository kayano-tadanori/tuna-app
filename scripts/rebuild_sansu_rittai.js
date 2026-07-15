// 立体（sansu_rittai.json）は全問に図があるが16テンプレ×平均30問と種類が少なく、
// 特に5-4は1テンプレ×60問だった。各テンプレを最大12問に圧縮し、三角柱・複合直方体・
// 円柱のバリエーションを図つきで追加して種類を増やす。答えはすべてコード計算。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_rittai.json');
const old = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let maxId = Math.max(...old.map(q => Number(q.id.slice(2))));
const nid = () => 'sr' + String(++maxId).padStart(3, '0');
const BL = '#4f9eff', YE = '#ffd166', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const lbl = (x, y, s) => `<text x="${x}" y="${y}" fill="${YE}" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${s}</text>`;

// 三角柱（底面が直角三角形、奥行き d）
function figTriPrism(base, height, depth, baseL, heightL, depthL) {
  // 前面の直角三角形 P1(55,105) P2(115,105) P3(55,55)、奥へ(+35,-20)平行移動
  const sol = `stroke="${BL}" stroke-width="2.5"`, dsh = `stroke="${BL}" stroke-width="1.3" stroke-dasharray="3 2"`;
  const body =
    `<polygon points="55,105 115,105 55,55" fill="none" ${sol}/>` + // 前面
    `<line x1="115" y1="105" x2="150" y2="85" ${sol}/>` +   // P2-Q2
    `<line x1="55" y1="55" x2="90" y2="35" ${sol}/>` +      // P3-Q3
    `<line x1="150" y1="85" x2="90" y2="35" ${sol}/>` +     // Q2-Q3（背面上辺）
    `<line x1="55" y1="105" x2="90" y2="85" ${dsh}/>` +     // P1-Q1（隠れ）
    `<line x1="90" y1="85" x2="150" y2="85" ${dsh}/>` +     // Q1-Q2（隠れ）
    `<line x1="90" y1="85" x2="90" y2="35" ${dsh}/>` +      // Q1-Q3（隠れ）
    lbl(85, 119, baseL) + lbl(40, 82, heightL) + lbl(140, 96, depthL);
  return S('190 130', body);
}
// 直方体（3辺ラベル）
function figCuboid(l1, l2, l3) {
  const body =
    `<polygon points="45,65 111,65 111,100 45,100" fill="none" stroke="${BL}" stroke-width="2.5"/>` +
    `<polygon points="45,65 85,35 151,35 111,65" fill="none" stroke="${BL}" stroke-width="2.5"/>` +
    `<polygon points="111,65 151,35 151,70 111,100" fill="none" stroke="${BL}" stroke-width="2.5"/>` +
    lbl(78, 115, l1) + lbl(143, 46, l2) + lbl(168, 53, l3);
  return S('220 130', body);
}
// 円柱
function figCylinder(rL, hL) {
  const body =
    `<ellipse cx="90" cy="45" rx="50" ry="14" fill="none" stroke="${BL}" stroke-width="2.5"/>` +
    `<line x1="40" y1="45" x2="40" y2="100" stroke="${BL}" stroke-width="2.5"/>` +
    `<line x1="140" y1="45" x2="140" y2="100" stroke="${BL}" stroke-width="2.5"/>` +
    `<path d="M40 100 A50 14 0 0 0 140 100" fill="none" stroke="${BL}" stroke-width="2.5"/>` +
    `<path d="M40 100 A50 14 0 0 1 140 100" fill="none" stroke="${BL}" stroke-width="1.2" stroke-dasharray="3 2"/>` +
    `<line x1="90" y1="45" x2="140" y2="45" stroke="${YE}" stroke-width="1.2"/>` + lbl(115, 40, rL) +
    lbl(155, 75, hL);
  return S('190 120', body);
}

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
const out = [];
function add(grade, diff, question, answer, meaning, svg) {
  out.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}

// Pass1: 各テンプレ最大15問
const counter = {};
for (const q of old) {
  const key = q.grade + '-' + q.difficulty + '|' + norm(q.question);
  counter[key] = (counter[key] || 0) + 1;
  if (counter[key] <= 15) out.push({ ...q });
}

// Pass2: 新テンプレ
// 三角柱の体積（底面＝直角三角形）: 5-1 / 6-1
[[6, 8, 10], [4, 6, 9], [8, 5, 7], [10, 4, 6], [6, 6, 12], [12, 5, 8], [8, 8, 5], [7, 4, 10], [5, 6, 8], [9, 8, 4]].forEach(([base, h, d]) => {
  const v = base * h / 2 * d;
  add(5, 1, `底面が底辺${base}cm・高さ${h}cmの直角三角形で、高さ（奥行き）が${d}cmの三角柱の体積は何cm³ですか？`, v,
    `三角柱の体積＝底面積×高さ。底面積＝${base}×${h}÷2＝${base * h / 2}cm²。体積＝${base * h / 2}×${d}＝${v}cm³です。`, figTriPrism(base, h, d, `${base}cm`, `${h}cm`, `${d}cm`));
});
[[6, 8, 15], [10, 12, 9], [8, 9, 14], [12, 10, 7], [14, 6, 11], [9, 8, 20], [16, 5, 13], [7, 12, 18], [11, 8, 6], [13, 10, 8]].forEach(([base, h, d]) => {
  const v = base * h / 2 * d;
  add(6, 1, `底面が底辺${base}cm・高さ${h}cmの直角三角形の三角柱があります。奥行き（柱の高さ）が${d}cmのとき、体積は何cm³ですか？`, v,
    `底面積＝${base}×${h}÷2＝${base * h / 2}cm²、体積＝${base * h / 2}×${d}＝${v}cm³です。`, figTriPrism(base, h, d, `${base}cm`, `${h}cm`, `${d}cm`));
});

// 直方体：辺と体積から残りの辺を求める: 5-1
[[8, 6, 240], [10, 5, 350], [12, 4, 288], [9, 7, 315], [6, 6, 216], [15, 4, 300], [8, 8, 320], [10, 9, 270], [7, 5, 210], [12, 6, 504]].forEach(([l1, l2, v]) => {
  const l3 = v / (l1 * l2);
  if (!Number.isInteger(l3)) return;
  add(5, 1, `たて${l1}cm・よこ${l2}cmの直方体があります。体積が${v}cm³のとき、高さは何cmですか？`, l3,
    `高さ＝体積÷(たて×よこ)＝${v}÷(${l1}×${l2})＝${v}÷${l1 * l2}＝${l3}cmです。`, figCuboid(`${l1}cm`, `${l2}cm`, '?cm'));
});

// 円柱の表面積のバリエーション: 6-2
[[3, 10], [4, 8], [5, 6], [6, 5], [2, 12], [8, 4], [10, 3], [4, 15], [5, 12], [7, 6]].forEach(([r, h]) => {
  const area = Math.round((2 * r * r * 3.14 + 2 * r * 3.14 * h) * 100) / 100;
  add(6, 2, `底面の半径${r}cm・高さ${h}cmの円柱の表面積は何cm²ですか？（円周率3.14）`, area,
    `表面積＝底面2つ＋側面。底面＝${r}×${r}×3.14×2＝${Math.round(2 * r * r * 3.14 * 100) / 100}、側面＝直径×3.14×高さ＝${2 * r}×3.14×${h}＝${Math.round(2 * r * 3.14 * h * 100) / 100}。合計${area}cm²です。`, figCylinder(`${r}cm`, `${h}cm`));
});

// 円柱の体積のバリエーション: 6-1
[[3, 10], [4, 5], [6, 8], [5, 4], [8, 3], [2, 15], [10, 6], [7, 4], [9, 5], [4, 12]].forEach(([r, h]) => {
  const v = Math.round(r * r * 3.14 * h * 100) / 100;
  add(6, 1, `底面の半径${r}cm・高さ${h}cmの円柱の体積は何cm³ですか？（円周率3.14）`, v,
    `体積＝底面積×高さ＝${r}×${r}×3.14×${h}＝${v}cm³です。`, figCylinder(`${r}cm`, `${h}cm`));
});

let clean = out.filter(q => q && q.question);
// 最終キャップ15（図つき優先。立体は全問図つきなので順序維持）
const cnt2 = {}; const keep = new Set();
for (const q of clean) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt2[k] = (cnt2[k] || 0) + 1; if (cnt2[k] <= 15) keep.add(q.id); }
clean = clean.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(clean, null, 2), 'utf8');

const cell = {};
clean.forEach(q => { const k = q.grade + '-' + q.difficulty; (cell[k] = cell[k] || []).push(q); });
console.log('総数:', clean.length, ' 図あり:', clean.filter(q => q.svg).length);
Object.keys(cell).sort().forEach(k => {
  const m = cell[k].reduce((a, q) => { const n = norm(q.question); a[n] = (a[n] || 0) + 1; return a; }, {});
  console.log(`  ${k}: ${cell[k].length}問 / ${Object.keys(m).length}テンプレ / 最多${Math.max(...Object.values(m))}`);
});
