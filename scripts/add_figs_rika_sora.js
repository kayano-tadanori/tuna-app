// rika_sora.json のうち、図が理解を助け汎用化できるカテゴリ
// （太陽の動き・北の空の星・月の満ち欠け・日食月食・星座早見）に模式図を追加する。
// 教科（太陽/月など）を取り違えないよう、各カテゴリは主語キーワードを必須にする。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_sora.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const S = '#eef2ff', G = '#ffd166', R = '#ff6b6b', B = '#4dd0e1';
const wrap = (inner, vb) => `<svg viewBox='${vb}' style='display:block;margin:6px auto;max-width:220px'>${inner}</svg>`;

// 太陽の動き（東→南→西の日周運動）
const sunPathSvg = wrap(
  `<line x1='15' y1='120' x2='205' y2='120' stroke='${S}' stroke-width='1.5'/>` +
  `<path d='M30,120 A80,80 0 0 1 190,120' fill='none' stroke='${G}' stroke-width='1.5' stroke-dasharray='4,3'/>` +
  `<circle cx='110' cy='42' r='9' fill='${G}'/>` +
  `<text x='28' y='137' font-size='11' fill='${S}'>東</text><text x='104' y='137' font-size='11' fill='${S}'>南</text><text x='183' y='137' font-size='11' fill='${S}'>西</text>` +
  `<text x='128' y='42' font-size='10' fill='${G}'>太陽</text>`,
  '0 0 220 145'
);
// 北の空の星（北極星中心・反時計回り）
const northSkySvg = wrap(
  `<circle cx='110' cy='75' r='60' fill='none' stroke='${S}' stroke-width='0.8' stroke-dasharray='3,3'/>` +
  `<circle cx='110' cy='75' r='4' fill='${G}'/><text x='118' y='72' font-size='9' fill='${G}'>北極星</text>` +
  `<polyline points='55,50 68,45 82,48 95,55 100,68 92,72 80,66' fill='none' stroke='${S}' stroke-width='1'/>` +
  `<text x='55' y='42' font-size='8' fill='${S}'>北斗七星</text>` +
  `<polyline points='150,105 158,95 166,102 174,93 182,103' fill='none' stroke='${S}' stroke-width='1'/>` +
  `<text x='150' y='122' font-size='8' fill='${S}'>カシオペヤ</text>` +
  `<path d='M110,20 A55,55 0 0 0 60,45' fill='none' stroke='${R}' stroke-width='1'/><polygon points='60,45 64,36 70,44' fill='${R}'/>`,
  '0 0 220 150'
);
// 月の満ち欠け（新月→満月）
const moonPhaseSvg = wrap(
  `<circle cx='35' cy='55' r='13' fill='#333' stroke='${S}' stroke-width='1'/><text x='35' y='82' font-size='8' fill='${S}' text-anchor='middle'>新月</text>` +
  `<path d='M75,42 A13,13 0 1 1 75,68 A7,13 0 1 0 75,42' fill='${G}' stroke='${S}' stroke-width='0.5'/><text x='75' y='82' font-size='8' fill='${S}' text-anchor='middle'>上弦</text>` +
  `<circle cx='115' cy='55' r='13' fill='${G}' stroke='${S}' stroke-width='1'/><text x='115' y='82' font-size='8' fill='${S}' text-anchor='middle'>満月</text>` +
  `<path d='M155,42 A13,13 0 1 0 155,68 A7,13 0 1 1 155,42' fill='${G}' stroke='${S}' stroke-width='0.5'/><text x='155' y='82' font-size='8' fill='${S}' text-anchor='middle'>下弦</text>` +
  `<text x='40' y='58' font-size='11' fill='${S}'></text>`,
  '0 0 200 95'
);
// 日食・月食（太陽-月-地球のならび）
const eclipseSvg = wrap(
  `<circle cx='35' cy='70' r='20' fill='${G}'/><text x='35' y='105' font-size='9' fill='${S}' text-anchor='middle'>太陽</text>` +
  `<circle cx='115' cy='70' r='7' fill='#888' stroke='${S}' stroke-width='0.5'/><text x='115' y='105' font-size='9' fill='${S}' text-anchor='middle'>月</text>` +
  `<circle cx='175' cy='70' r='14' fill='${B}' opacity='0.6'/><text x='175' y='105' font-size='9' fill='${S}' text-anchor='middle'>地球</text>` +
  `<line x1='55' y1='70' x2='108' y2='70' stroke='${S}' stroke-width='0.5' stroke-dasharray='3,3'/><line x1='122' y1='70' x2='161' y2='70' stroke='${S}' stroke-width='0.5' stroke-dasharray='3,3'/>`,
  '0 0 210 115'
);
// 星座早見（円ばん）
const starFinderSvg = wrap(
  `<circle cx='105' cy='75' r='62' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<circle cx='105' cy='75' r='62' fill='none' stroke='${G}' stroke-width='0.5' stroke-dasharray='2,4'/>` +
  `<ellipse cx='105' cy='75' rx='42' ry='52' fill='none' stroke='${S}' stroke-width='1'/>` +
  `<circle cx='105' cy='75' r='2.5' fill='${G}'/>` +
  `<text x='105' y='24' font-size='8' fill='${S}' text-anchor='middle'>月日</text>` +
  `<text x='105' y='150' font-size='9' fill='${S}' text-anchor='middle'>星座早見ばん</text>`,
  '0 0 210 158'
);

function classify(t) {
  if (/星座早見|星ざ早見/.test(t)) return starFinderSvg;
  if (/日食|月食/.test(t)) return eclipseSvg;
  if (/北極星|北斗七星|カシオペヤ|北の空/.test(t)) return northSkySvg;
  if (/月/.test(t) && /満ち欠け|新月|三日月|上弦|下弦|満月|月の形/.test(t)) return moonPhaseSvg;
  if (/太陽/.test(t) && /動き|南中|高度|かげ|影|方位|日の出|日の入|しずむ|のぼる|一日/.test(t)) return sunPathSvg;
  return null;
}

const cnt = {};
data.forEach(q => {
  if (q.svg) return;
  const s = classify(q.question);
  if (s) { q.svg = s; const key = s === sunPathSvg ? '太陽' : s === northSkySvg ? '北の空' : s === moonPhaseSvg ? '月' : s === eclipseSvg ? '日月食' : '星座早見'; cnt[key] = (cnt[key] || 0) + 1; }
});
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('rika_sora 図追加:', JSON.stringify(cnt), '合計', Object.values(cnt).reduce((a, b) => a + b, 0), '/', data.length);
