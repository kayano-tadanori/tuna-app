// 場合の数（sansu_baai.json）は各セル9〜15テンプレと既に多様なので、
// 大きな作り直しはせず (1) 各セル×テンプレを最大10問に軽く圧縮し、
// (2) サイコロの目の表・正多角形の対角線・碁盤の目の格子図など、図の無い
// 定番問題にSVGを付与する。文言・答えは既存のまま（図の追加のみ）。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_baai.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const BL = '#4f7cff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c, sz = 11) => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="middle" font-family="sans-serif" font-weight="bold">${s}</text>`;

// サイコロ2個の目の表（合計 target を強調）
function figDice(target) {
  const x0 = 34, y0 = 20, c = 15; let body = '';
  for (let i = 1; i <= 6; i++) { body += txt(x0 + i * c - c / 2, y0 - 4, i, YE, 9); body += txt(x0 - 12, y0 + i * c - c / 2 + 3, i, YE, 9); }
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
    const hit = a + b === target;
    body += `<rect x="${x0 + (b - 1) * c}" y="${y0 + (a - 1) * c}" width="${c}" height="${c}" fill="${hit ? PK : BL}" opacity="${hit ? 0.9 : 0.18}" stroke="${WT}" stroke-width="0.6"/>`;
  }
  body += txt(x0 + 3 * c, y0 + 6 * c + 14, `合計が${target}のマス`, PK, 10);
  return S('150 130', body);
}
// 正n角形＋対角線
function figPolygon(n) {
  const cx = 75, cy = 62, r = 46; const pts = [];
  for (let i = 0; i < n; i++) { const ang = -Math.PI / 2 + 2 * Math.PI * i / n; pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]); }
  let body = `<polygon points="${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="${BL}" opacity="0.15" stroke="${BL}" stroke-width="1.6"/>`;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    body += `<line x1="${pts[i][0].toFixed(1)}" y1="${pts[i][1].toFixed(1)}" x2="${pts[j][0].toFixed(1)}" y2="${pts[j][1].toFixed(1)}" stroke="${YE}" stroke-width="0.7" opacity="0.75"/>`;
  }
  pts.forEach(p => body += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="${RD}"/>`);
  return S('150 124', body);
}
// 碁盤の目（右へ r 区間・上へ u 区間）
function figGrid(r, u) {
  const x0 = 22, y0 = 22, step = Math.min(20, Math.floor(100 / Math.max(r, u))), w = r * step, h = u * step;
  let body = '';
  for (let i = 0; i <= u; i++) body += `<line x1="${x0}" y1="${y0 + i * step}" x2="${x0 + w}" y2="${y0 + i * step}" stroke="${BL}" stroke-width="1.3" opacity="0.55"/>`;
  for (let j = 0; j <= r; j++) body += `<line x1="${x0 + j * step}" y1="${y0}" x2="${x0 + j * step}" y2="${y0 + h}" stroke="${BL}" stroke-width="1.3" opacity="0.55"/>`;
  body += `<circle cx="${x0}" cy="${y0 + h}" r="3.5" fill="${RD}"/>` + txt(x0, y0 + h + 14, 'スタート', WT, 9);
  body += `<circle cx="${x0 + w}" cy="${y0}" r="3.5" fill="${YE}"/>` + txt(x0 + w, y0 - 6, 'ゴール', WT, 9);
  return S(`${x0 * 2 + w} ${y0 * 2 + h}`, body);
}

// ---------- Pass1: 各セル×テンプレ最大10問 ----------
function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
const counter = {}; const kept = [];
for (const q of data) {
  const key = q.grade + '-' + q.difficulty + '|' + norm(q.question);
  counter[key] = (counter[key] || 0) + 1;
  if (counter[key] <= 10) kept.push(q);
}

// ---------- Pass2: 図の付与 ----------
let added = 0;
for (const q of kept) {
  if (q.svg) continue;
  let m;
  if ((m = q.question.match(/目の合計が(\d+)/))) { q.svg = figDice(Number(m[1])); added++; }
  else if ((m = q.question.match(/正(\d+)角形の対角線/))) { const n = Number(m[1]); if (n <= 16) { q.svg = figPolygon(n); added++; } }
  else if ((m = q.question.match(/右へ(\d+)区間・上へ(\d+)区間/))) { q.svg = figGrid(Number(m[1]), Number(m[2])); added++; }
  else if ((m = q.question.match(/たてに(\d+)マス、横に(\d+)マス/))) { q.svg = figGrid(Number(m[2]), Number(m[1])); added++; }
}

fs.writeFileSync(FILE, JSON.stringify(kept, null, 2), 'utf8');

const cell = {};
kept.forEach(q => { const k = q.grade + '-' + q.difficulty; (cell[k] = cell[k] || []).push(q); });
console.log('総数:', kept.length, ' 図あり:', kept.filter(q => q.svg).length, ' 今回追加:', added);
Object.keys(cell).sort().forEach(k => {
  const m = cell[k].reduce((a, q) => { const n = norm(q.question); a[n] = (a[n] || 0) + 1; return a; }, {});
  console.log(`  ${k}: ${cell[k].length}問 / ${Object.keys(m).length}テンプレ / 最多${Math.max(...Object.values(m))} / 図${cell[k].filter(q => q.svg).length}`);
});
