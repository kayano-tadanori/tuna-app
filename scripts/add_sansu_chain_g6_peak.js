// 算数の連鎖問題（灘中レベル）に、本物の灘中ピーク級の小6問題を追加する。
// 灘中の主力単元（立体図形・場合の数・数の性質）に絞り、多段階の思考を要する構成。
// 数値・設定はオリジナル。数値答えはテンキー入力で出題される。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_chain.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const S = '#eef2ff', G = '#ffd166', R = '#ff6b6b';
const svgWrap = inner => `<svg viewBox='0 0 220 160' style='display:block;margin:6px auto;max-width:240px'>${inner}</svg>`;

// 立方体（1つの角を切り取る図）
const cubeSvg = svgWrap(
  `<polygon points='45,60 125,60 125,140 45,140' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<polygon points='45,60 80,30 160,30 125,60' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<polygon points='125,60 160,30 160,110 125,140' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<polygon points='95,60 125,60 125,90' fill='none' stroke='${R}' stroke-width='2' stroke-dasharray='4,3'/>` +
  `<text x='150' y='150' font-size='11' fill='${R}' text-anchor='middle'>角を切り取る</text>`
);
// 3×3ます目の経路図（A・B・P）
const gridSvg = svgWrap((() => {
  let g = '';
  const xs = [30, 80, 130, 180], ys = [140, 95, 50, 5];
  xs.forEach(x => { g += `<line x1='${x}' y1='${ys[0]}' x2='${x}' y2='${ys[3]}' stroke='${S}' stroke-width='1'/>`; });
  ys.forEach(y => { g += `<line x1='${xs[0]}' y1='${y}' x2='${xs[3]}' y2='${y}' stroke='${S}' stroke-width='1'/>`; });
  g += `<circle cx='30' cy='140' r='5' fill='${G}'/><text x='18' y='145' font-size='13' fill='${G}'>A</text>`;
  g += `<circle cx='180' cy='5' r='5' fill='${G}'/><text x='186' y='12' font-size='13' fill='${G}'>B</text>`;
  g += `<circle cx='130' cy='95' r='5' fill='${R}'/><text x='134' y='90' font-size='13' fill='${R}'>P</text>`;
  return g;
})());

const NEW = [
  {
    id: 'sc_chain_27', category: 'rittai', grade: 6, title: '立方体の角を切り取る', svg: cubeSvg,
    intro: '1辺が6cmの立方体があります。1つの頂点に集まる3本の辺について、頂点から3cmの点をそれぞれとり、その3点を通る平面で、頂点をふくむ三角すいを切り取ります。（三角すいの体積＝底面積×高さ÷3）',
    steps: [
      { question: '切り取った三角すい1個の体積は何cm³ですか。', answer: '4.5', choices: ['4.5','9','13.5','4'],
        meaning: '①底面は直角をはさむ2辺が3cmの直角二等辺三角形で、面積は3×3÷2＝4.5cm²。②高さは3cmなので、体積は4.5×3÷3＝4.5cm³です。よって、答えは4.5です。' },
      { question: '8つの頂点すべてで同じように三角すいを切り取ると、切り取った体積の合計は何cm³ですか。', answer: '36', choices: ['36','27','45','54'],
        meaning: '①1個4.5cm³を8個切り取るので、②4.5×8＝36cm³です。よって、答えは36です。' },
      { question: '切り取ったあとに残る立体の体積は何cm³ですか。', answer: '180', choices: ['180','198','172','144'],
        meaning: '①もとの立方体の体積は6×6×6＝216cm³。②残りは216－36＝180cm³です。よって、答えは180です。' },
    ],
  },
  {
    id: 'sc_chain_28', category: 'rittai', grade: 6, title: '水そうとおもり',
    intro: '底面が20cm×25cmの長方形で高さ40cmの直方体の水そうに、深さ15cmまで水が入っています。',
    steps: [
      { question: '水そうに入っている水の体積は何cm³ですか。', answer: '7500', choices: ['7500','5000','9000','15000'],
        meaning: '①水の体積は底面積×深さです。②20×25×15＝7500cm³です。よって、答えは7500です。' },
      { question: '1辺10cmの立方体の鉄のおもりを完全にしずめると、水の深さは何cmになりますか（水はあふれません）。', answer: '17', choices: ['17','16','18','20'],
        meaning: '①おもりの体積1000cm³の分だけ水面が上がります。②上がる深さは1000÷(20×25)＝2cm。③15＋2＝17cmです。よって、答えは17です。' },
      { question: 'おもりを取り出したあと、毎分500cm³の割合で水を注ぎます。水の深さが最初より5cm高い20cmになるまで何分かかりますか。', answer: '5', choices: ['5','10','15','4'],
        meaning: '①深さを5cm増やすのに必要な水は、20×25×5＝2500cm³。②2500÷500＝5分です。よって、答えは5です。' },
    ],
  },
  {
    id: 'sc_chain_29', category: 'kazu', grade: 6, title: '72の約数のひみつ',
    intro: '72について考えます。72を素数の積で表すと、72＝2×2×2×3×3 です。',
    steps: [
      { question: '72の約数は全部で何個ありますか。', answer: '12', choices: ['12','10','8','9'],
        meaning: '①2が3個、3が2個なので、約数の個数は(3＋1)×(2＋1)＝12個です。よって、答えは12です。' },
      { question: '72の約数を全部たすといくつですか。', answer: '195', choices: ['195','168','144','210'],
        meaning: '①約数の和は(1＋2＋4＋8)×(1＋3＋9)で求められます。②15×13＝195です。よって、答えは195です。' },
      { question: '1から72までの整数のうち、72と1以外に公約数を持たない数（72と互いに素な数）は何個ありますか。', answer: '24', choices: ['24','36','48','12'],
        meaning: '①72と公約数を持つのは2の倍数か3の倍数です。②1〜72で2の倍数は36個、3の倍数は24個、6の倍数は12個なので、2か3の倍数は36＋24－12＝48個。③72－48＝24個です。よって、答えは24です。' },
    ],
  },
  {
    id: 'sc_chain_30', category: 'baai', grade: 6, title: 'カードで作る3けたの数',
    intro: '1, 2, 3, 4, 5 の数字が書かれた5枚のカードから3枚を選んでならべ、3けたの整数を作ります。同じカードは1回しか使えません。',
    steps: [
      { question: '3けたの整数は全部で何個作れますか。', answer: '60', choices: ['60','120','125','20'],
        meaning: '①百の位に5通り、十の位に4通り、一の位に3通り。②5×4×3＝60個です。よって、答えは60です。' },
      { question: 'そのうち、偶数は何個ありますか。', answer: '24', choices: ['24','30','36','12'],
        meaning: '①偶数は一の位が2か4の2通り。②残りの2けたは4×3＝12通り。③2×12＝24個です。よって、答えは24です。' },
      { question: '60個の3けたの整数のうち、3の倍数は何個ありますか。', answer: '24', choices: ['24','20','30','18'],
        meaning: '①3の倍数は各位の数字の和が3の倍数です。選んだ3枚の和が3の倍数になる組は{1,2,3}{1,3,5}{2,3,4}{3,4,5}の4組。②各組から6個ずつ整数ができるので、4×6＝24個です。よって、答えは24です。' },
    ],
  },
  {
    id: 'sc_chain_31', category: 'baai', grade: 6, title: 'ます目の道順', svg: gridSvg,
    intro: '図のような、たて3ます・よこ3ますのます目があります。左下のAから右上のBまで、遠回りせずに、右または上だけに進みます。図の点Pは、Aから右に2・上に1だけ進んだ交差点です。',
    steps: [
      { question: 'AからBまでの行き方は全部で何通りありますか。', answer: '20', choices: ['20','15','25','10'],
        meaning: '①右に3回、上に3回進みます。②その並べ方は書き込み法で数えると20通りです。よって、答えは20です。' },
      { question: '点Pを必ず通る行き方は何通りありますか。', answer: '9', choices: ['9','6','12','8'],
        meaning: '①AからPまで（右2・上1）は3通り。②PからBまで（右1・上2）は3通り。③3×3＝9通りです。よって、答えは9です。' },
      { question: '点Pを通らない行き方は何通りありますか。', answer: '11', choices: ['11','9','14','5'],
        meaning: '①全体20通りから、Pを通る9通りを引きます。②20－9＝11通りです。よって、答えは11です。' },
    ],
  },
];

data.push(...NEW);
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');

// 検証
let problems = [];
const ids = data.map(c => c.id);
if (new Set(ids).size !== ids.length) problems.push('DUPLICATE IDS');
const validCats = ['keisan','bun','zu','kisoku','tokusan','baai','kazu','wariai','hayasa','rittai'];
data.forEach(c => {
  if (!validCats.includes(c.category)) problems.push(c.id + ': bad category');
  if (![3,4,5,6].includes(c.grade)) problems.push(c.id + ': bad grade');
  if (!c.steps || c.steps.length < 2 || c.steps.length > 3) problems.push(c.id + ': steps count');
  (c.steps || []).forEach((s, i) => {
    if (!s.choices || s.choices.length !== 4) problems.push(c.id + ' step' + i + ': choices!=4');
    if (!s.choices.includes(s.answer)) problems.push(c.id + ' step' + i + ': answer not in choices (' + s.answer + ')');
    if (new Set(s.choices).size !== 4) problems.push(c.id + ' step' + i + ': dup choices');
    if (!s.meaning.includes('よって、答えは')) problems.push(c.id + ' step' + i + ': meaning closer');
  });
});
const byGrade = {};
data.forEach(c => { byGrade[c.grade] = (byGrade[c.grade] || 0) + 1; });
console.log('total chains:', data.length, 'by grade:', JSON.stringify(byGrade));
console.log('problems:', problems.length);
problems.forEach(p => console.log(' -', p));
