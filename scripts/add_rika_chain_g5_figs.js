// 理科の連鎖問題（灘中レベル）を補強する。
// (1) 小5でロックされていたカテゴリ（天体・力・水よう液）に小5向けチェーンを追加
// (2) 主要チェーンにSVGの図を追加してイメージしやすくする
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_chain.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const S = '#eef2ff', G = '#ffd166', R = '#ff6b6b', B = '#4dd0e1';
const wrap = (inner, vb = '0 0 220 150') => `<svg viewBox='${vb}' style='display:block;margin:6px auto;max-width:240px'>${inner}</svg>`;

// ── 図（SVG） ──
const leverSvg = wrap(
  `<line x1='25' y1='66' x2='195' y2='66' stroke='${S}' stroke-width='3'/>` +
  `<polygon points='110,68 100,96 120,96' fill='${S}'/>` +
  `<text x='110' y='112' font-size='10' fill='${S}' text-anchor='middle'>支点</text>` +
  `<line x1='60' y1='66' x2='60' y2='90' stroke='${G}' stroke-width='1.5'/><rect x='51' y='90' width='18' height='16' fill='${G}'/>` +
  `<text x='60' y='122' font-size='10' fill='${G}' text-anchor='middle'>左20cm</text>` +
  `<line x1='160' y1='66' x2='160' y2='90' stroke='${G}' stroke-width='1.5'/><rect x='151' y='90' width='18' height='16' fill='${G}'/>` +
  `<text x='160' y='122' font-size='10' fill='${G}' text-anchor='middle'>右</text>`
);
const beakerSvg = wrap(
  `<path d='M65,35 L65,118 Q65,128 75,128 L145,128 Q155,128 155,118 L155,35' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<path d='M67,70 L67,118 Q67,126 75,126 L145,126 Q153,126 153,118 L153,70 Z' fill='${B}' opacity='0.25'/>` +
  `<line x1='67' y1='70' x2='153' y2='70' stroke='${B}' stroke-width='2'/>` +
  `<circle cx='85' cy='95' r='2.5' fill='${S}'/><circle cx='110' cy='110' r='2.5' fill='${S}'/><circle cx='130' cy='90' r='2.5' fill='${S}'/><circle cx='100' cy='85' r='2.5' fill='${S}'/>` +
  `<text x='110' y='148' font-size='11' fill='${S}' text-anchor='middle'>40℃の水にとかす</text>`, '0 0 220 155'
);
const starSvg = wrap(
  `<line x1='15' y1='120' x2='205' y2='120' stroke='${S}' stroke-width='1.5'/>` +
  `<path d='M35,120 A75,75 0 0 1 185,120' fill='none' stroke='${G}' stroke-width='1.5' stroke-dasharray='4,3'/>` +
  `<circle cx='60' cy='95' r='3' fill='${G}'/><circle cx='110' cy='47' r='3' fill='${G}'/><circle cx='160' cy='95' r='3' fill='${G}'/>` +
  `<text x='30' y='138' font-size='11' fill='${S}'>東</text><text x='183' y='138' font-size='11' fill='${S}'>西</text>` +
  `<text x='103' y='40' font-size='10' fill='${G}'>南</text>`
);
const lensSvg = wrap(
  `<line x1='15' y1='70' x2='205' y2='70' stroke='${S}' stroke-width='1' stroke-dasharray='3,3'/>` +
  `<ellipse cx='110' cy='70' rx='12' ry='40' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<line x1='20' y1='45' x2='110' y2='45' stroke='${G}' stroke-width='1.5'/><line x1='110' y1='45' x2='185' y2='70' stroke='${G}' stroke-width='1.5'/>` +
  `<line x1='20' y1='95' x2='110' y2='95' stroke='${G}' stroke-width='1.5'/><line x1='110' y1='95' x2='185' y2='70' stroke='${G}' stroke-width='1.5'/>` +
  `<circle cx='185' cy='70' r='3' fill='${R}'/><text x='170' y='60' font-size='11' fill='${R}'>焦点</text>` +
  `<text x='95' y='125' font-size='11' fill='${S}' text-anchor='middle'>とつレンズ</text>`
);
const soraLayerSvg = wrap(
  `<rect x='45' y='28' width='120' height='20' fill='none' stroke='${S}' stroke-width='1.5'/><text x='172' y='42' font-size='11' fill='${G}'>D</text>` +
  `<rect x='45' y='48' width='120' height='20' fill='none' stroke='${S}' stroke-width='1.5'/><text x='172' y='62' font-size='11' fill='${G}'>C</text>` +
  `<rect x='45' y='68' width='120' height='20' fill='none' stroke='${S}' stroke-width='1.5'/><text x='172' y='82' font-size='11' fill='${G}'>B</text>` +
  `<rect x='45' y='88' width='120' height='20' fill='none' stroke='${S}' stroke-width='1.5'/><text x='172' y='102' font-size='11' fill='${G}'>A</text>` +
  `<text x='105' y='125' font-size='10' fill='${S}' text-anchor='middle'>下ほど古い</text>`
);
const floatSvg = wrap(
  `<rect x='40' y='45' width='140' height='85' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<rect x='42' y='78' width='136' height='50' fill='${B}' opacity='0.25'/>` +
  `<line x1='42' y1='78' x2='178' y2='78' stroke='${B}' stroke-width='2'/>` +
  `<rect x='92' y='60' width='40' height='42' fill='none' stroke='${G}' stroke-width='2'/>` +
  `<text x='112' y='55' font-size='11' fill='${G}' text-anchor='middle'>木片</text>` +
  `<text x='150' y='73' font-size='9' fill='${B}'>水面</text>`
);

// ── 既存チェーンに図を付与 ──
const setSvg = (id, svg) => { const c = data.find(x => x.id === id); if (c) c.svg = svg; };
setSvg('rchain03', lensSvg);      // 光の性質
setSvg('rchain06', leverSvg);     // てこと動滑車
setSvg('rchain07', floatSvg);     // 浮力
setSvg('rchain09', soraLayerSvg); // 地層と化石

// ── 小5向けの新規チェーン（天体・力・水よう液） ──
const NEW = [
  {
    id: 'rchain13', category: 'sora', grade: 5, title: '星の動き', svg: starSvg,
    intro: '空の星は、時間がたつと東からのぼり、南の空を通って西へしずみます。1時間に約15度ずつ動いて見えます（日周運動）。',
    steps: [
      { question: '星は3時間で約何度動きますか。', answer: '45', choices: ['45','30','60','15'],
        meaning: '①星は1時間に約15度動きます。②15×3＝45度です。よって、答えは45です。' },
      { question: '東の地平線からのぼった星が真南にくるまで約6時間かかりました。この間に星は約何度動きましたか。', answer: '90', choices: ['90','75','120','60'],
        meaning: '①1時間に15度なので、②15×6＝90度動きます。よって、答えは90です。' },
      { question: '同じ星を1か月後の同じ時刻に見ると、約30度西へずれて見えます（年周運動）。3か月後の同じ時刻には約何度ずれて見えますか。', answer: '90', choices: ['90','60','120','30'],
        meaning: '①1か月で約30度ずれます。②30×3＝90度です。よって、答えは90です。' },
    ],
  },
  {
    id: 'rchain14', category: 'chikara', grade: 5, title: 'てこのつり合い', svg: leverSvg,
    intro: 'てこは、支点の左右で「支点からのきょり×おもりの重さ」が等しいとき、水平につり合います。支点から左に20cmの位置に30gのおもりをつるしました。',
    steps: [
      { question: '左のうでの「きょり×重さ」はいくつですか。', answer: '600', choices: ['600','50','300','900'],
        meaning: '①20cm×30g＝600です。よって、答えは600です。' },
      { question: '支点から右に15cmの位置に何gのおもりをつるすと、てこはつり合いますか。', answer: '40', choices: ['40','30','45','60'],
        meaning: '①右も「きょり×重さ」が600になればつり合います。②600÷15＝40gです。よって、答えは40です。' },
      { question: 'その右のおもりを、支点から右に25cmの位置に動かすと、何gにすればつり合いますか。', answer: '24', choices: ['24','40','30','20'],
        meaning: '①つり合うには25×重さ＝600。②600÷25＝24gです。よって、答えは24です。' },
    ],
  },
  {
    id: 'rchain15', category: 'suiyoueki', grade: 5, title: 'ものの溶け方', svg: beakerSvg,
    intro: '40℃の水100gには、ある物質が最大60gまで溶けます。いま、40℃の水200gを用意しました。',
    steps: [
      { question: 'この水200gには、この物質が最大何gまで溶けますか。', answer: '120', choices: ['120','60','180','100'],
        meaning: '①水100gに60g溶けるので、水が2倍の200gなら溶ける量も2倍です。②60×2＝120gです。よって、答えは120です。' },
      { question: 'この水200gに物質を150g入れてよくかき混ぜると、溶けきれずに残る物質は何gですか。', answer: '30', choices: ['30','90','60','20'],
        meaning: '①最大120gしか溶けないので、②150－120＝30gが溶け残ります。よって、答えは30です。' },
      { question: '溶け残った30gもすべて溶かすには、40℃の水をあと何g加えればよいですか。', answer: '50', choices: ['50','30','100','60'],
        meaning: '①水100gあたり60g溶けるので、30g溶かすのに必要な水は100×30÷60＝50gです。よって、答えは50です。' },
    ],
  },
];

data.push(...NEW);
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');

// 検証
let problems = [];
const ids = data.map(c => c.id);
if (new Set(ids).size !== ids.length) problems.push('DUPLICATE IDS');
const validCats = ['shokubutsu','doubutsu','sora','daichi','mono','suiyoueki','denki','chikara'];
data.forEach(c => {
  if (!validCats.includes(c.category)) problems.push(c.id + ': bad category');
  if (![5,6].includes(c.grade)) problems.push(c.id + ': bad grade');
  (c.steps || []).forEach((s, i) => {
    if (!s.choices || s.choices.length !== 4) problems.push(c.id + ' s' + i + ': choices!=4');
    if (!s.choices.includes(s.answer)) problems.push(c.id + ' s' + i + ': answer not in choices');
    if (new Set(s.choices).size !== 4) problems.push(c.id + ' s' + i + ': dup choices');
  });
});
// 小5カバー確認
function inGrade(c, g) { return (c.grade || g) <= g; }
const cov = {};
validCats.forEach(cat => { cov[cat] = data.some(c => c.category === cat && inGrade(c, 5)); });
console.log('total chains:', data.length);
console.log('小5カバー:', JSON.stringify(cov));
console.log('図つき:', data.filter(c => c.svg).length, 'チェーン');
console.log('problems:', problems.length);
problems.forEach(p => console.log(' -', p));
