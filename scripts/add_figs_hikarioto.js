// 光と音カテゴリ（rika_hikarioto）の図が有効な問題に模式図を追加する。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_hikarioto.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const S = '#eef2ff', G = '#ffd166', R = '#ff6b6b';
const wrap = (inner, vb) => `<svg viewBox='${vb}' style='display:block;margin:6px auto;max-width:220px'>${inner}</svg>`;

// とつレンズと焦点
const lensSvg = wrap(
  `<line x1='15' y1='70' x2='205' y2='70' stroke='${S}' stroke-width='1' stroke-dasharray='3,3'/>` +
  `<ellipse cx='110' cy='70' rx='12' ry='40' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<line x1='20' y1='45' x2='110' y2='45' stroke='${G}' stroke-width='1.5'/><line x1='110' y1='45' x2='185' y2='70' stroke='${G}' stroke-width='1.5'/>` +
  `<line x1='20' y1='95' x2='110' y2='95' stroke='${G}' stroke-width='1.5'/><line x1='110' y1='95' x2='185' y2='70' stroke='${G}' stroke-width='1.5'/>` +
  `<circle cx='185' cy='70' r='3' fill='${R}'/><text x='168' y='60' font-size='11' fill='${R}'>焦点</text>` +
  `<text x='95' y='125' font-size='11' fill='${S}' text-anchor='middle'>とつレンズ</text>`, '0 0 220 135'
);
// ピンホールカメラ
const pinholeSvg = wrap(
  `<polygon points='30,45 30,95 40,90 40,50' fill='${G}' opacity='0.6'/><text x='22' y='40' font-size='9' fill='${G}'>物体</text>` +
  `<line x1='110' y1='25' x2='110' y2='115' stroke='${S}' stroke-width='2'/><circle cx='110' cy='70' r='2' fill='${S}'/>` +
  `<line x1='35' y1='48' x2='185' y2='92' stroke='${R}' stroke-width='0.8'/><line x1='35' y1='92' x2='185' y2='48' stroke='${R}' stroke-width='0.8'/>` +
  `<line x1='185' y1='30' x2='185' y2='110' stroke='${S}' stroke-width='2'/>` +
  `<text x='108' y='128' font-size='9' fill='${S}' text-anchor='middle'>あな</text><text x='185' y='125' font-size='9' fill='${S}' text-anchor='middle'>スクリーン</text>`, '0 0 210 135'
);
// 鏡の反射（入射角＝反射角）
const mirrorSvg = wrap(
  `<line x1='20' y1='115' x2='200' y2='115' stroke='${S}' stroke-width='3'/>` +
  Array.from({ length: 9 }, (_, i) => `<line x1='${28 + i * 20}' y1='115' x2='${20 + i * 20}' y2='125' stroke='${S}' stroke-width='1'/>`).join('') +
  `<line x1='110' y1='115' x2='110' y2='25' stroke='${S}' stroke-width='1' stroke-dasharray='4,3'/>` +
  `<line x1='45' y1='35' x2='110' y2='115' stroke='${G}' stroke-width='1.8'/><line x1='110' y1='115' x2='175' y2='35' stroke='${R}' stroke-width='1.8'/>` +
  `<text x='55' y='30' font-size='10' fill='${G}'>入射光</text><text x='150' y='30' font-size='10' fill='${R}'>反射光</text>` +
  `<text x='113' y='40' font-size='9' fill='${S}'>法線</text>`, '0 0 220 135'
);
// 音の反射（がけとやまびこ）
const echoSvg = wrap(
  `<rect x='170' y='28' width='32' height='100' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<line x1='170' y1='40' x2='202' y2='52' stroke='${S}'/><line x1='170' y1='72' x2='202' y2='84' stroke='${S}'/><line x1='170' y1='104' x2='202' y2='116' stroke='${S}'/>` +
  `<circle cx='35' cy='90' r='8' fill='none' stroke='${G}' stroke-width='2'/><line x1='35' y1='98' x2='35' y2='122' stroke='${G}' stroke-width='2'/>` +
  `<path d='M50,80 Q62,90 50,100' fill='none' stroke='${R}'/><path d='M62,74 Q80,90 62,106' fill='none' stroke='${R}'/>` +
  `<line x1='30' y1='135' x2='170' y2='135' stroke='${S}' stroke-width='1' stroke-dasharray='4,3'/>` +
  `<text x='95' y='132' font-size='9' fill='${S}' text-anchor='middle'>きょり</text><text x='185' y='146' font-size='10' fill='${S}' text-anchor='middle'>がけ</text>`, '0 0 220 152'
);
// モノコード（弦の実験）
const monochordSvg = wrap(
  `<rect x='30' y='60' width='160' height='45' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<line x1='40' y1='50' x2='180' y2='50' stroke='${G}' stroke-width='1.8'/>` +
  `<polygon points='70,60 66,50 74,50' fill='${S}'/><polygon points='150,60 146,50 154,50' fill='${S}'/>` +
  `<text x='110' y='42' font-size='10' fill='${G}' text-anchor='middle'>弦（げん）</text>` +
  `<text x='110' y='125' font-size='10' fill='${S}' text-anchor='middle'>ことじの間をはじく</text>`, '0 0 220 135'
);

function classify(t) {
  if (/ピンホール|針穴/.test(t)) return pinholeSvg;
  if (/レンズ|虫めがね|焦点|凸レンズ/.test(t)) return lensSvg;
  if (/(鏡|反射|入射)/.test(t) && /光|角|像/.test(t)) return mirrorSvg;
  if (/やまびこ|こだま|音速|かみなり|音.*(速さ|秒速|反射)/.test(t)) return echoSvg;
  if (/モノコード|弦/.test(t)) return monochordSvg;
  return null;
}

const cnt = {};
data.forEach(q => {
  const s = classify(q.question);
  if (!s) return;
  q.svg = s;
  const k = s === lensSvg ? 'レンズ' : s === pinholeSvg ? 'ピンホール' : s === mirrorSvg ? '鏡' : s === echoSvg ? '音の反射' : 'モノコード';
  cnt[k] = (cnt[k] || 0) + 1;
});
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('光と音 図追加:', JSON.stringify(cnt), '合計', Object.values(cnt).reduce((a, b) => a + b, 0), '/', data.length);
