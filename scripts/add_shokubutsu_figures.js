// 植物（rika_shokubutsu.json）は図が0枚。既存問題にキーワードで図を付ける。
// 花のつくり・葉・光合成・種子と発芽・根と茎の5種類。問題文・答えは変えない。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_shokubutsu.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', BR = '#c9975b', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// 花のつくり（断面）
function figFlower() {
  const cx = 100, base = 96;
  const body =
    // がく
    `<path d="M${cx - 20} ${base} Q${cx - 30} ${base + 6} ${cx - 12} ${base + 8}" fill="none" stroke="${GN}" stroke-width="3"/>` +
    `<path d="M${cx + 20} ${base} Q${cx + 30} ${base + 6} ${cx + 12} ${base + 8}" fill="none" stroke="${GN}" stroke-width="3"/>` +
    // 花びら
    `<path d="M${cx} ${base} C${cx - 55} ${base - 10} ${cx - 55} 30 ${cx - 18} 44 Z" fill="${PK}" opacity="0.5" stroke="${PK}" stroke-width="1.5"/>` +
    `<path d="M${cx} ${base} C${cx + 55} ${base - 10} ${cx + 55} 30 ${cx + 18} 44 Z" fill="${PK}" opacity="0.5" stroke="${PK}" stroke-width="1.5"/>` +
    // おしべ（左右）
    `<line x1="${cx - 10} " y1="${base - 6}" x2="${cx - 20}" y2="42" stroke="${YE}" stroke-width="1.5"/><circle cx="${cx - 20}" cy="40" r="4" fill="${YE}"/>` +
    `<line x1="${cx + 10}" y1="${base - 6}" x2="${cx + 20}" y2="42" stroke="${YE}" stroke-width="1.5"/><circle cx="${cx + 20}" cy="40" r="4" fill="${YE}"/>` +
    // めしべ（中央）＋子ぼう
    `<line x1="${cx}" y1="${base - 4}" x2="${cx}" y2="34" stroke="${RD}" stroke-width="2"/><circle cx="${cx}" cy="32" r="4" fill="${RD}"/>` +
    `<ellipse cx="${cx}" cy="${base - 8}" rx="8" ry="11" fill="${RD}" opacity="0.45" stroke="${RD}" stroke-width="1.3"/>` +
    txt(cx, 26, 'めしべ', RD) + txt(cx + 42, 40, 'おしべ', YE, 10, 'start') + txt(cx - 46, 60, '花びら', PK, 10, 'end') +
    txt(cx + 40, base + 8, 'がく', GN, 10, 'start') + txt(cx - 30, base - 8, '子ぼう', RD, 9, 'end');
  return S('200 116', body);
}
// 葉のつくり（葉みゃく・気こう）
function figLeaf() {
  const body =
    `<path d="M40 60 Q100 18 168 60 Q100 102 40 60 Z" fill="${GN}" opacity="0.3" stroke="${GN}" stroke-width="2"/>` +
    `<line x1="40" y1="60" x2="168" y2="60" stroke="${GN}" stroke-width="1.6"/>` +
    [30, 55, 80, 105, 130].map(x => `<line x1="${x + 20}" y1="60" x2="${x + 5}" y2="44" stroke="${GN}" stroke-width="0.9"/><line x1="${x + 20}" y1="60" x2="${x + 5}" y2="76" stroke="${GN}" stroke-width="0.9"/>`).join('') +
    txt(100, 108, '葉みゃく', GN) + txt(150, 40, '葉', GN, 11, 'start');
  return S('200 118', body);
}
// 光合成（光・二酸化炭素→でんぷん・酸素）
function figPhoto() {
  const body =
    `<circle cx="34" cy="30" r="13" fill="${YE}" opacity="0.85"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return `<line x1="${(34 + 16 * Math.cos(r)).toFixed(0)}" y1="${(30 + 16 * Math.sin(r)).toFixed(0)}" x2="${(34 + 22 * Math.cos(r)).toFixed(0)}" y2="${(30 + 22 * Math.sin(r)).toFixed(0)}" stroke="${YE}" stroke-width="1.5"/>`; }).join('') +
    `<path d="M70 70 Q120 40 175 70 Q120 100 70 70 Z" fill="${GN}" opacity="0.35" stroke="${GN}" stroke-width="2"/>` +
    `<line x1="46" y1="42" x2="90" y2="62" stroke="${YE}" stroke-width="1.5" stroke-dasharray="3 2"/>` +
    `<polygon points="60,92 74,88 70,80" fill="${BL}"/>` + txt(48, 98, '二酸化炭素', BL, 9, 'start') +
    `<polygon points="150,50 138,44 136,52" fill="${PK}"/>` + txt(154, 48, '酸素', PK, 9, 'start') +
    txt(122, 74, 'でんぷん', WT, 9);
  return S('200 108', body);
}
// 種子と発芽（子葉）
function figSeed() {
  const gx = 60, gy = 95;
  const body =
    `<rect x="10" y="${gy}" width="180" height="16" fill="${BR}" opacity="0.4"/>` + txt(180, gy + 12, '土', BR, 9, 'end') +
    // 種子から出た芽
    `<line x1="${gx}" y1="${gy}" x2="${gx}" y2="50" stroke="${GN}" stroke-width="2.5"/>` +
    `<path d="M${gx} 60 Q${gx - 22} 52 ${gx - 24} 66 Q${gx - 6} 70 ${gx} 60 Z" fill="${GN}" opacity="0.5" stroke="${GN}" stroke-width="1.3"/>` +
    `<path d="M${gx} 60 Q${gx + 22} 52 ${gx + 24} 66 Q${gx + 6} 70 ${gx} 60 Z" fill="${GN}" opacity="0.5" stroke="${GN}" stroke-width="1.3"/>` +
    // 根
    `<line x1="${gx}" y1="${gy}" x2="${gx - 12}" y2="${gy + 14}" stroke="${WT}" stroke-width="1.5"/><line x1="${gx}" y1="${gy}" x2="${gx + 10}" y2="${gy + 15}" stroke="${WT}" stroke-width="1.5"/>` +
    txt(gx + 30, 62, '子葉', GN, 10, 'start') + txt(gx + 20, gy + 22, '根', WT, 9, 'start');
  return S('200 122', body);
}
// 根・くき・葉と水の通り道（道管・蒸散）
function figRoot() {
  const cx = 90;
  const body =
    `<line x1="${cx}" y1="30" x2="${cx}" y2="90" stroke="${GN}" stroke-width="4"/>` +
    `<path d="M${cx} 45 Q${cx - 30} 34 ${cx - 34} 50 Q${cx - 10} 56 ${cx} 45 Z" fill="${GN}" opacity="0.4" stroke="${GN}"/>` +
    `<path d="M${cx} 55 Q${cx + 30} 44 ${cx + 34} 60 Q${cx + 10} 66 ${cx} 55 Z" fill="${GN}" opacity="0.4" stroke="${GN}"/>` +
    // 根
    [-1, 0, 1].map(d => `<line x1="${cx}" y1="90" x2="${cx + d * 18}" y2="112" stroke="${BR}" stroke-width="2"/>`).join('') +
    // 水の上昇矢印
    `<line x1="${cx}" y1="88" x2="${cx}" y2="40" stroke="${BL}" stroke-width="1.5" stroke-dasharray="3 2"/><polygon points="${cx},36 ${cx - 4},44 ${cx + 4},44" fill="${BL}"/>` +
    // 蒸散
    `<polygon points="${cx - 30},44 ${cx - 40},38 ${cx - 40},48" fill="${PK}"/>` + txt(cx - 44, 44, '蒸散', PK, 9, 'end') +
    txt(cx + 40, 56, '葉', GN, 10, 'start') + txt(cx + 14, 78, 'くき（道管）', BL, 9, 'start') + txt(cx + 24, 108, '根', BR, 10, 'start');
  return S('200 122', body);
}

let counts = {};
const attach = (fn, key) => { counts[key] = (counts[key] || 0) + 1; return fn; };
for (const q of data) {
  if (q.svg) continue;
  const t = q.question + q.answer;
  if (/花粉|受粉|めしべ|おしべ|がく|花びら|子ぼう|柱頭/.test(t)) q.svg = attach(figFlower(), 'flower');
  else if (/光合成|でんぷん/.test(t)) q.svg = attach(figPhoto(), 'photo');
  else if (/発芽|子葉|種子|たね|はい/.test(t)) q.svg = attach(figSeed(), 'seed');
  else if (/道管|師管|蒸散|くき|茎|根/.test(t)) q.svg = attach(figRoot(), 'root');
  else if (/葉みゃく|気こう|葉/.test(t)) q.svg = attach(figLeaf(), 'leaf');
}
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('総数:', data.length, '図あり:', data.filter(q => q.svg).length, JSON.stringify(counts));
