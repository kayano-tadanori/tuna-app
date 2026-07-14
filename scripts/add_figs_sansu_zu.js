// sansu_zu.json の図なし問題のうち、図が理解を助ける視覚パターン問題
// （棒でつなげる・積み木・紙を折る・三角形分割）に汎用の模式図を追加する。
// 二等辺三角形の底角など、文章で完結する計算問題には図を付けない（誤図防止）。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_zu.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const S = '#eef2ff', G = '#ffd166', R = '#ff6b6b';
const wrap = (inner, vb) => `<svg viewBox='${vb}' style='display:block;margin:6px auto;max-width:220px'>${inner}</svg>`;

// 棒でつなげた三角形（△▽△…）
const barTriSvg = wrap(
  `<polyline points='25,95 45,50 65,95 85,50 105,95 125,50 145,95' fill='none' stroke='${G}' stroke-width='2'/>` +
  `<line x1='25' y1='95' x2='145' y2='95' stroke='${G}' stroke-width='2'/>` +
  `<text x='85' y='115' font-size='11' fill='${S}' text-anchor='middle'>ぼうでつなげる（△▽△…）</text>`,
  '0 0 190 125'
);
// 紙を半分に折る
const paperFoldSvg = wrap(
  `<rect x='40' y='30' width='60' height='80' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<line x1='100' y1='30' x2='100' y2='110' stroke='${R}' stroke-width='1.5' stroke-dasharray='4,3'/>` +
  `<rect x='100' y='30' width='60' height='80' fill='${G}' opacity='0.12' stroke='${S}' stroke-width='1' stroke-dasharray='3,3'/>` +
  `<path d='M150,20 A45,45 0 0 1 150,120' fill='none' stroke='${R}' stroke-width='1.5'/>` +
  `<polygon points='150,120 143,110 156,112' fill='${R}'/>` +
  `<text x='100' y='134' font-size='11' fill='${S}' text-anchor='middle'>半分に折る</text>`,
  '0 0 200 145'
);
// 積み木（階段の形）
const blockStairSvg = wrap(
  (() => { let s = ''; for (let c = 0; c < 4; c++) for (let r = 0; r <= c; r++) s += `<rect x='${30 + c * 28}' y='${110 - r * 28}' width='26' height='26' fill='none' stroke='${G}' stroke-width='1.5'/>`; return s; })() +
  `<text x='95' y='130' font-size='11' fill='${S}' text-anchor='middle'>かいだんの形</text>`,
  '0 0 200 142'
);
// 積み木（ピラミッドの形・横から見た図）
const blockPyramidSvg = wrap(
  (() => { let s = ''; const rows = [3, 2, 1]; rows.forEach((n, r) => { const y = 30 + r * 28; const x0 = 100 - n * 14; for (let i = 0; i < n; i++) s += `<rect x='${x0 + i * 28}' y='${y}' width='26' height='26' fill='none' stroke='${G}' stroke-width='1.5'/>`; }); return s; })() +
  `<text x='100' y='125' font-size='11' fill='${S}' text-anchor='middle'>ピラミッドの形</text>`,
  '0 0 200 138'
);
// 積み木（一般的な積み上げ）
const blockOtherSvg = wrap(
  (() => { let s = ''; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) s += `<rect x='${40 + c * 30}' y='${80 - r * 30}' width='28' height='28' fill='none' stroke='${G}' stroke-width='1.5'/>`; s += `<rect x='70' y='20' width='28' height='28' fill='none' stroke='${G}' stroke-width='1.5'/>`; return s; })() +
  `<text x='95' y='128' font-size='11' fill='${S}' text-anchor='middle'>つみき</text>`,
  '0 0 200 140'
);
// しきつめ
const tilingSvg = wrap(
  (() => { let s = ''; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) s += `<rect x='${35 + c * 30}' y='${25 + r * 30}' width='28' height='28' fill='none' stroke='${G}' stroke-width='1.2'/>`; return s; })() +
  `<text x='95' y='130' font-size='11' fill='${S}' text-anchor='middle'>しきつめる</text>`,
  '0 0 200 142'
);
// 大きい正三角形の中の小三角形（1辺3分割）
const triSubdivSvg = wrap(
  `<polygon points='100,25 40,120 160,120' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<line x1='80' y1='56.7' x2='120' y2='56.7' stroke='${G}' stroke-width='1'/>` +
  `<line x1='60' y1='88.3' x2='140' y2='88.3' stroke='${G}' stroke-width='1'/>` +
  `<line x1='80' y1='56.7' x2='60' y2='88.3' stroke='${G}' stroke-width='1'/><line x1='80' y1='56.7' x2='100' y2='88.3' stroke='${G}' stroke-width='1'/>` +
  `<line x1='120' y1='56.7' x2='100' y2='88.3' stroke='${G}' stroke-width='1'/><line x1='120' y1='56.7' x2='140' y2='88.3' stroke='${G}' stroke-width='1'/>` +
  `<text x='100' y='138' font-size='11' fill='${S}' text-anchor='middle'>小さい三角形にわける</text>`,
  '0 0 200 148'
);

function classify(t) {
  if (/ぼうで.*三角形/.test(t)) return barTriSvg;
  if (/ぼうで.*(正方形|四角形)/.test(t)) return tilingSvg;
  if (/(つみき|積み木).*(かいだん|階段)/.test(t)) return blockStairSvg;
  if (/(つみき|積み木).*ピラミッド/.test(t)) return blockPyramidSvg;
  if (/つみき|積み木/.test(t)) return blockOtherSvg;
  if (/しきつめ|しきつ/.test(t)) return tilingSvg;
  if (/1辺に小さい三角形|大きい正三角形の中/.test(t)) return triSubdivSvg;
  if (/かみを半分に.*お|紙を.*折/.test(t)) return paperFoldSvg;
  return null;
}

let n = 0;
data.forEach(q => { if (!q.svg) { const s = classify(q.question); if (s) { q.svg = s; n++; } } });
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('sansu_zu: +' + n + '図 → 合計' + data.filter(q => q.svg).length + '/' + data.length);
