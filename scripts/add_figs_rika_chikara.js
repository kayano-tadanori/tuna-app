// rika_chikara.json の計算問題（ばね・浮力・滑車・てこ）に、仕組みを示す模式図を追加する。
// 数値を図に描き込むのではなく「setup（実験のしくみ）」を示す模式図なので、
// どの数値の問題でも図として正しい。知識問題（支点とは？など）は図なしのまま。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_chikara.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const S = '#eef2ff', G = '#ffd166', R = '#ff6b6b', B = '#4dd0e1';
const wrap = (inner, vb) => `<svg viewBox='${vb}' style='display:block;margin:6px auto;max-width:210px'>${inner}</svg>`;

// ばね＋おもり
const springSvg = wrap(
  `<line x1='25' y1='18' x2='125' y2='18' stroke='${S}' stroke-width='4'/>` +
  `<polyline points='75,18 75,30 60,37 90,47 60,57 90,67 60,77 90,87 75,93 75,101' fill='none' stroke='${G}' stroke-width='2'/>` +
  `<rect x='60' y='101' width='30' height='26' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<text x='75' y='142' font-size='11' fill='${S}' text-anchor='middle'>おもり</text>` +
  `<line x1='112' y1='30' x2='112' y2='92' stroke='${R}' stroke-width='1'/>` +
  `<text x='118' y='64' font-size='10' fill='${R}'>のび</text>`,
  '0 0 150 152'
);
// ばねはかりで水中の重さをはかる（浮力）
const buoySvg = wrap(
  `<rect x='70' y='8' width='26' height='34' fill='none' stroke='${S}' stroke-width='1.5'/>` +
  `<text x='83' y='29' font-size='7' fill='${S}' text-anchor='middle'>ばね</text><text x='83' y='37' font-size='7' fill='${S}' text-anchor='middle'>はかり</text>` +
  `<line x1='83' y1='42' x2='83' y2='120' stroke='${S}' stroke-width='1'/>` +
  `<rect x='45' y='92' width='95' height='72' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<rect x='47' y='110' width='91' height='52' fill='${B}' opacity='0.22'/>` +
  `<line x1='47' y1='110' x2='138' y2='110' stroke='${B}' stroke-width='2'/>` +
  `<rect x='70' y='120' width='26' height='28' fill='none' stroke='${G}' stroke-width='2'/>` +
  `<text x='83' y='138' font-size='8' fill='${G}' text-anchor='middle'>物体</text>` +
  `<text x='128' y='106' font-size='8' fill='${B}'>水</text>`,
  '0 0 170 172'
);
// 動滑車
const pulleyMovSvg = wrap(
  `<line x1='25' y1='15' x2='135' y2='15' stroke='${S}' stroke-width='4'/>` +
  `<line x1='52' y1='15' x2='52' y2='86' stroke='${G}' stroke-width='1.5'/>` +
  `<circle cx='80' cy='92' r='16' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<path d='M64,92 A16,16 0 0 1 96,92' fill='none' stroke='${G}' stroke-width='1.5'/>` +
  `<line x1='108' y1='86' x2='108' y2='24' stroke='${G}' stroke-width='1.5'/>` +
  `<polygon points='108,16 103,26 113,26' fill='${R}'/>` +
  `<text x='116' y='30' font-size='9' fill='${R}'>引く力</text>` +
  `<line x1='80' y1='108' x2='80' y2='126' stroke='${S}' stroke-width='1.5'/>` +
  `<rect x='67' y='126' width='26' height='22' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<text x='80' y='162' font-size='10' fill='${S}' text-anchor='middle'>動かっ車</text>`,
  '0 0 160 168'
);
// 定滑車
const pulleyFixSvg = wrap(
  `<line x1='25' y1='15' x2='135' y2='15' stroke='${S}' stroke-width='4'/>` +
  `<circle cx='80' cy='38' r='16' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<line x1='80' y1='22' x2='80' y2='15' stroke='${S}' stroke-width='1'/>` +
  `<line x1='64' y1='38' x2='64' y2='96' stroke='${G}' stroke-width='1.5'/>` +
  `<rect x='51' y='96' width='26' height='22' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<text x='64' y='134' font-size='9' fill='${S}' text-anchor='middle'>おもり</text>` +
  `<line x1='96' y1='38' x2='96' y2='104' stroke='${G}' stroke-width='1.5'/>` +
  `<polygon points='96,112 91,102 101,102' fill='${R}'/>` +
  `<text x='104' y='96' font-size='9' fill='${R}'>引く力</text>` +
  `<text x='80' y='150' font-size='10' fill='${S}' text-anchor='middle'>定かっ車</text>`,
  '0 0 160 158'
);
// 実験用てこ
const leverSvg = wrap(
  `<line x1='100' y1='60' x2='100' y2='122' stroke='${S}' stroke-width='3'/>` +
  `<polygon points='100,60 92,80 108,80' fill='${S}'/>` +
  `<line x1='25' y1='56' x2='175' y2='56' stroke='${S}' stroke-width='3'/>` +
  Array.from({ length: 11 }, (_, i) => `<line x1='${40 + i * 12}' y1='52' x2='${40 + i * 12}' y2='60' stroke='${S}' stroke-width='0.8'/>`).join('') +
  `<line x1='58' y1='56' x2='58' y2='82' stroke='${G}' stroke-width='1.2'/><rect x='49' y='82' width='18' height='16' fill='none' stroke='${G}' stroke-width='1.5'/>` +
  `<line x1='142' y1='56' x2='142' y2='82' stroke='${G}' stroke-width='1.2'/><rect x='133' y='82' width='18' height='16' fill='none' stroke='${G}' stroke-width='1.5'/>` +
  `<text x='100' y='118' font-size='10' fill='${S}' text-anchor='middle'>支点</text>`,
  '0 0 200 135'
);

const hasNum = t => /[0-9]+ *(g|cm|kg)/.test(t);
function classify(t) {
  if (/ばね/.test(t) && /のび|のびる|ちぢ|自然長|全体の長さ/.test(t)) return 'spring';
  if (/浮力/.test(t) || /空気中で.{0,10}水中/.test(t) || /水にしずめ|水にうかべ|水面より|水中に沈め|うきしず/.test(t)) return 'buoy';
  if (/動かっ車|動滑車|定かっ車|定滑車|かっ車|滑車/.test(t) && /何g|何cm|何倍|持ち上げ|引く力|引く長さ|ひもを引く/.test(t)) return 'pulley';
  if (/てこ|支点/.test(t) && /目盛り|支点から|つり合/.test(t) && hasNum(t)) return 'lever';
  return null;
}

const cnt = { spring: 0, buoy: 0, pulley: 0, lever: 0 };
data.forEach(q => {
  const c = classify(q.question);
  if (!c) return;
  if (c === 'spring') q.svg = springSvg;
  else if (c === 'buoy') q.svg = buoySvg;
  else if (c === 'pulley') q.svg = /定かっ車|定滑車/.test(q.question) ? pulleyFixSvg : pulleyMovSvg;
  else if (c === 'lever') q.svg = leverSvg;
  cnt[c]++;
});

fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('図を追加:', JSON.stringify(cnt), '合計', Object.values(cnt).reduce((a, b) => a + b, 0), '問 /', data.length);
// 妥当性：svgありは必ずいずれかの型、なしは図不要問題
const withSvg = data.filter(q => q.svg).length;
console.log('svgあり:', withSvg, '/ svgなし:', data.length - withSvg);
