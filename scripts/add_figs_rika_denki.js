// rika_denki.json の回路問題（直列・並列・電磁石）に回路図の模式図を追加する。
// 電気を通すもの等の知識問題には図を付けない。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_denki.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const S = '#eef2ff', G = '#ffd166', R = '#ff6b6b';
const wrap = (inner, vb) => `<svg viewBox='${vb}' style='display:block;margin:6px auto;max-width:210px'>${inner}</svg>`;
const bulb = (x, y) => `<circle cx='${x}' cy='${y}' r='9' fill='none' stroke='${G}' stroke-width='1.5'/><line x1='${x - 6}' y1='${y - 6}' x2='${x + 6}' y2='${y + 6}' stroke='${G}' stroke-width='1'/><line x1='${x - 6}' y1='${y + 6}' x2='${x + 6}' y2='${y - 6}' stroke='${G}' stroke-width='1'/>`;
const batteryH = (x, y) => `<line x1='${x - 3}' y1='${y - 9}' x2='${x - 3}' y2='${y + 9}' stroke='${S}' stroke-width='1.5'/><line x1='${x + 3}' y1='${y - 5}' x2='${x + 3}' y2='${y + 5}' stroke='${S}' stroke-width='4'/>`;

// 豆電球の直列つなぎ
const seriesBulbSvg = wrap(
  `<rect x='40' y='32' width='120' height='78' fill='none' stroke='${S}' stroke-width='1.5'/>` +
  bulb(80, 32) + bulb(120, 32) + batteryH(100, 110) +
  `<text x='100' y='128' font-size='11' fill='${S}' text-anchor='middle'>直列つなぎ</text>`,
  '0 0 200 138'
);
// 豆電球の並列つなぎ
const parallelBulbSvg = wrap(
  `<rect x='40' y='32' width='120' height='78' fill='none' stroke='${S}' stroke-width='1.5'/>` +
  `<line x1='80' y1='32' x2='80' y2='110' stroke='${S}' stroke-width='1.5'/><line x1='120' y1='32' x2='120' y2='110' stroke='${S}' stroke-width='1.5'/>` +
  bulb(80, 71) + bulb(120, 71) + batteryH(60, 110) +
  `<text x='100' y='128' font-size='11' fill='${S}' text-anchor='middle'>並列つなぎ</text>`,
  '0 0 200 138'
);
// かん電池の直列つなぎ
const seriesBattSvg = wrap(
  `<rect x='40' y='32' width='120' height='78' fill='none' stroke='${S}' stroke-width='1.5'/>` +
  bulb(100, 32) + batteryH(82, 110) + batteryH(118, 110) +
  `<text x='100' y='128' font-size='11' fill='${S}' text-anchor='middle'>かん電池2個を直列</text>`,
  '0 0 200 138'
);
// かん電池の並列つなぎ
const parallelBattSvg = wrap(
  `<rect x='55' y='32' width='105' height='78' fill='none' stroke='${S}' stroke-width='1.5'/>` +
  bulb(107, 32) +
  `<line x1='55' y1='58' x2='30' y2='58' stroke='${S}' stroke-width='1.5'/><line x1='55' y1='84' x2='30' y2='84' stroke='${S}' stroke-width='1.5'/><line x1='30' y1='58' x2='30' y2='84' stroke='${S}' stroke-width='1.5'/>` +
  `<g transform='translate(-8,0)'>` + batteryH(63, 58) + batteryH(63, 84) + `</g>` +
  `<text x='105' y='128' font-size='11' fill='${S}' text-anchor='middle'>かん電池2個を並列</text>`,
  '0 0 200 138'
);
// 電磁石（コイル＋かん電池＋鉄しん）
const electromagnetSvg = wrap(
  `<line x1='35' y1='60' x2='165' y2='60' stroke='${S}' stroke-width='6'/>` +
  `<path d='M50,60 q7,-20 15,0 M65,60 q7,-20 15,0 M80,60 q7,-20 15,0 M95,60 q7,-20 15,0 M110,60 q7,-20 15,0 M125,60 q7,-20 15,0' fill='none' stroke='${G}' stroke-width='2'/>` +
  `<line x1='35' y1='60' x2='35' y2='100' stroke='${G}' stroke-width='1.5'/><line x1='165' y1='60' x2='165' y2='100' stroke='${G}' stroke-width='1.5'/>` +
  `<line x1='35' y1='100' x2='85' y2='100' stroke='${G}' stroke-width='1.5'/><line x1='115' y1='100' x2='165' y2='100' stroke='${G}' stroke-width='1.5'/>` +
  batteryH(100, 100) +
  `<text x='100' y='122' font-size='10' fill='${S}' text-anchor='middle'>コイル（鉄しん）とかん電池</text>`,
  '0 0 200 132'
);

function classify(t) {
  if (/電磁石|コイル|鉄しん|方位磁針/.test(t)) return electromagnetSvg;
  const bulbQ = /豆電球|明るさ/.test(t);
  const battQ = /かん電池|乾電池|電池/.test(t);
  if (/直列/.test(t) && bulbQ && !battQ) return seriesBulbSvg;
  if (/並列/.test(t) && bulbQ && !battQ) return parallelBulbSvg;
  if (/直列/.test(t) && battQ) return seriesBattSvg;
  if (/並列/.test(t) && battQ) return parallelBattSvg;
  if (/直列/.test(t)) return seriesBulbSvg;
  if (/並列/.test(t)) return parallelBulbSvg;
  return null;
}

const cnt = {};
data.forEach(q => {
  if (q.svg) return;
  const s = classify(q.question);
  if (!s) return;
  q.svg = s;
  const k = s === electromagnetSvg ? '電磁石' : s === seriesBulbSvg ? '豆電球直列' : s === parallelBulbSvg ? '豆電球並列' : s === seriesBattSvg ? '電池直列' : '電池並列';
  cnt[k] = (cnt[k] || 0) + 1;
});
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('rika_denki 図追加:', JSON.stringify(cnt), '合計', Object.values(cnt).reduce((a, b) => a + b, 0), '/', data.length);
