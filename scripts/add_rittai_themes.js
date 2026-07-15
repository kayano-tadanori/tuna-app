// 立体に「楽しく学べる」テーマとキャラクターを追加する。サイコロの展開図（向かい合う面）、
// 積み木の数、オットンが積み木を積む・チッチが箱にのる等。すべて図つき・答えはコード計算。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_rittai.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let maxId = Math.max(...data.map(q => Number(q.id.slice(2))));
const nid = () => 'sr' + String(++maxId).padStart(3, '0');

const BL = '#4f9eff', YE = '#ffd166', PK = '#ff6688', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// サイコロの展開図（十字型・向かい合う面の和は7）。highlight の面をピンクに
function figDiceNet(highlight) {
  // 位置：A(top)=1, B(left)=2,C(front)=3,D(right)=5, E(bottom)=6, F(back)=4
  const s = 30, c0 = 20, c1 = 52, c2 = 84, r0 = 8, r1 = 40, r2 = 72, r3 = 104;
  const cells = [[c1, r0, 1], [c0, r1, 2], [c1, r1, 3], [c2, r1, 5], [c1, r2, 6], [c1, r3, 4]];
  let body = '';
  cells.forEach(([x, y, n]) => {
    const hit = n === highlight;
    body += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${hit ? PK : BL}" opacity="${hit ? 0.85 : 0.25}" stroke="${WT}" stroke-width="1.2"/>` + txt(x + s / 2, y + s / 2 + 5, n, hit ? '#fff' : WT, 14);
  });
  return S('134 142', body);
}
// 直方体（辺のラベル）
function figCuboid(l1, l2, l3) {
  return S('220 130', `<polygon points="45,65 111,65 111,100 45,100" fill="none" stroke="${BL}" stroke-width="2.5"/>` +
    `<polygon points="45,65 85,35 151,35 111,65" fill="none" stroke="${BL}" stroke-width="2.5"/>` +
    `<polygon points="111,65 151,35 151,70 111,100" fill="none" stroke="${BL}" stroke-width="2.5"/>` +
    txt(78, 115, l1) + txt(143, 46, l2) + txt(168, 53, l3));
}
// 積み木（直方体＋格子で数を表す）
function figBlocks(l, w, h) {
  const u = Math.min(16, Math.floor(70 / Math.max(l, w, h))), x0 = 50, y0 = 100;
  const W = l * u, H = h * u, dx = w * u * 0.6, dy = -w * u * 0.4;
  let body = `<polygon points="${x0},${y0} ${x0 + W},${y0} ${x0 + W},${y0 - H} ${x0},${y0 - H}" fill="${BL}" opacity="0.2" stroke="${BL}" stroke-width="2"/>` +
    `<polygon points="${x0},${y0 - H} ${x0 + dx},${y0 - H + dy} ${x0 + W + dx},${y0 - H + dy} ${x0 + W},${y0 - H}" fill="${BL}" opacity="0.3" stroke="${BL}" stroke-width="2"/>` +
    `<polygon points="${x0 + W},${y0} ${x0 + W + dx},${y0 + dy} ${x0 + W + dx},${y0 - H + dy} ${x0 + W},${y0 - H}" fill="${BL}" opacity="0.25" stroke="${BL}" stroke-width="2"/>`;
  for (let i = 1; i < l; i++) body += `<line x1="${x0 + i * u}" y1="${y0}" x2="${x0 + i * u}" y2="${y0 - H}" stroke="${BL}" stroke-width="0.6" opacity="0.6"/>`;
  for (let j = 1; j < h; j++) body += `<line x1="${x0}" y1="${y0 - j * u}" x2="${x0 + W}" y2="${y0 - j * u}" stroke="${BL}" stroke-width="0.6" opacity="0.6"/>`;
  body += txt(x0 + W / 2, y0 + 15, `たて${w}・よこ${l}・高さ${h}`, YE, 10);
  return S('200 128', body);
}

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
function add(grade, diff, question, answer, meaning, svg) {
  data.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}

// ① サイコロの展開図：向かい合う面（和は7）: 5-2
[1, 2, 3, 4, 5, 6, 2, 3].forEach((n, i) =>
  add(5, 2, `図はサイコロの展開図です。サイコロは向かい合う面の目の和が7になっています。色のついた「${n}」の面と組み立てたとき向かい合う面の目はいくつですか？`, 7 - n,
    `向かい合う面の和は7なので、${n}の向かいは7－${n}＝${7 - n}です。`, figDiceNet(n)));
// ② 積み木の数（直方体に積む）: 5-1
[[3, 4, 2], [4, 3, 3], [5, 2, 4], [3, 3, 3], [4, 4, 2], [6, 2, 3], [2, 5, 4], [4, 5, 2]].forEach(([l, w, h]) =>
  add(5, 1, `1辺1cmの立方体の積み木を、たて${w}個・よこ${l}個・高さ${h}個のすき間なくつまった直方体の形に積みました。積み木は全部で何個ですか？`, l * w * h,
    `たて×よこ×高さ＝${w}×${l}×${h}＝${l * w * h}個です。`, figBlocks(l, w, h)));
// ③ 積み木：外から見える立方体の色ぬり…は難しいので、体積との関係: 5-1
[[3, 4, 5], [2, 6, 4], [5, 3, 4], [4, 4, 4], [2, 3, 7], [6, 3, 2], [5, 5, 2], [3, 6, 3]].forEach(([l, w, h]) =>
  add(5, 1, `1辺1cmの立方体の積み木をすき間なく積んで、たて${w}cm・よこ${l}cm・高さ${h}cmの直方体を作りました。使った積み木は何個ですか？（＝この直方体の体積は何cm³ですか？）`, l * w * h,
    `1辺1cmの立方体の数＝体積。${w}×${l}×${h}＝${l * w * h}個（cm³）です。`, figBlocks(l, w, h)));

// ④ キャラ：オットンが積み木を積む: 5-1
[[3, 4, 3], [4, 5, 2], [5, 4, 3], [6, 3, 4]].forEach(([l, w, h]) =>
  add(5, 1, `オットンが1辺1cmの立方体の積み木を、たて${w}個・よこ${l}個・高さ${h}個の直方体に積み上げました。積み木は全部で何個ですか？`, l * w * h,
    `${w}×${l}×${h}＝${l * w * h}個。オットン、上手に積んだな！`, figBlocks(l, w, h)));
// ⑤ キャラ：チッチのサイコロ遊び（展開図）: 5-2
[3, 4, 5, 2].forEach(n =>
  add(5, 2, `チッチがサイコロで遊んでいます。展開図の「${n}」の面と、組み立てたとき向かい合う面の目はいくつですか？（向かい合う面の和は7）`, 7 - n,
    `7－${n}＝${7 - n}。チッチ、正解や！`, figDiceNet(n)));

// ---------- 各セル×テンプレ最大12（図つき優先） ----------
const cnt = {}; const svgFirst = [...data].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] <= 12) keep.add(q.id); }
const out = data.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');
console.log('総数:', out.length, ' 図あり:', out.filter(q => q.svg).length, ' 追加分:', out.filter(q => /展開図|積み木/.test(q.question)).length);
