// 算数の連鎖問題（灘中レベル）に、小3・小4の履修範囲で解ける思考力問題を追加する。
// 実際の灘中・開成・桜蔭などの入試傾向（数の性質・場合の数・覆面算・規則性・思考力）を
// 参考に、数値や設定はオリジナルに作成。数値答えはテンキー、語句答えは4択で出題される。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_chain.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const NEW = [
  // ───────── 小3 ─────────
  {
    id: 'sc_chain_11', category: 'keisan', grade: 3, title: 'たし算の覆面算',
    intro: '同じ文字には同じ数字が入ります。次のたし算が成り立つとき、あとの問いに答えなさい。\nあ7 ＋ 7あ ＝ 99 （「あ」は1けたの数字、あ7・7あは2けたの数）',
    steps: [
      { question: '「あ」にあてはまる数字はいくつですか。', answer: '2', choices: ['2','3','1','4'],
        meaning: 'あ7は「10×あ＋7」、7あは「70＋あ」を表します。①合わせると11×あ＋77＝99。②11×あ＝22なので、あ＝2です。よって、答えは2です。' },
      { question: 'このとき2つの数は27と72です。72と27の差はいくつですか。', answer: '45', choices: ['45','54','99','35'],
        meaning: '①72－27＝45です。よって、答えは45です。' },
      { question: '(2)で求めた45は、9の何倍ですか。', answer: '5', choices: ['5','6','4','9'],
        meaning: '①45÷9＝5なので、45は9の5倍です。よって、答えは5です。' },
    ],
  },
  {
    id: 'sc_chain_12', category: 'bun', grade: 3, title: 'カードの和差算',
    intro: '兄と弟が持っているカードを合わせると50枚で、兄は弟より12枚多く持っています。',
    steps: [
      { question: '兄は何枚持っていますか。', answer: '31', choices: ['31','25','38','19'],
        meaning: '①合計に差をたして2でわると多いほうが求まります。②(50＋12)÷2＝31枚です。よって、答えは31です。' },
      { question: '弟は何枚持っていますか。', answer: '19', choices: ['19','25','31','12'],
        meaning: '①50－31＝19枚です。よって、答えは19です。' },
      { question: '兄が弟に何枚あげると、2人の枚数が同じになりますか。', answer: '6', choices: ['6','12','3','19'],
        meaning: '①ちがいは12枚なので、その半分をあげれば同じになります。②12÷2＝6枚です。よって、答えは6です。' },
    ],
  },
  {
    id: 'sc_chain_13', category: 'zu', grade: 3, title: '長方形のまわりの長さ',
    intro: 'たて6cm、よこ8cmの長方形があります。',
    steps: [
      { question: 'この長方形のまわりの長さは何cmですか。', answer: '28', choices: ['28','48','14','24'],
        meaning: '①まわりの長さは(たて＋よこ)×2です。②(6＋8)×2＝28cmです。よって、答えは28です。' },
      { question: 'この長方形を2つ、よこにぴったりくっつけて大きい長方形を作りました。まわりの長さは何cmですか。', answer: '44', choices: ['44','56','40','32'],
        meaning: '①よこが8×2＝16cm、たては6cmのままです。②(6＋16)×2＝44cmです。よって、答えは44です。' },
      { question: '同じ長方形2つを、こんどはたてにくっつけると、まわりの長さは何cmですか。', answer: '40', choices: ['40','44','56','28'],
        meaning: '①たてが6×2＝12cm、よこは8cmのままです。②(12＋8)×2＝40cmです。よって、答えは40です。' },
    ],
  },
  {
    id: 'sc_chain_14', category: 'kisoku', grade: 3, title: 'ならんだ数のきまり',
    intro: 'あるきまりで数がならんでいます。\n2, 5, 8, 11, 14, ……',
    steps: [
      { question: '6番目の数はいくつですか。', answer: '17', choices: ['17','16','18','20'],
        meaning: '①3ずつ増えるきまりです。②5番目の14の次なので14＋3＝17です。よって、答えは17です。' },
      { question: '10番目の数はいくつですか。', answer: '29', choices: ['29','30','32','27'],
        meaning: '①1番目が2で、3ずつ9回増えます。②2＋3×9＝2＋27＝29です。よって、答えは29です。' },
      { question: 'この数がはじめて30より大きくなるのは、何番目ですか。', answer: '11', choices: ['11','10','12','9'],
        meaning: '①10番目は29でまだ30以下です。②11番目は29＋3＝32で、はじめて30より大きくなります。よって、答えは11です。' },
    ],
  },
  {
    id: 'sc_chain_15', category: 'baai', grade: 3, title: '玉のならべ方',
    intro: '赤・青・黄の3個の玉があります。色はすべてちがいます。',
    steps: [
      { question: '3個を1列にならべるならべ方は全部で何通りですか。', answer: '6', choices: ['6','3','9','12'],
        meaning: '①1番目に3通り、2番目に2通り、3番目に1通り。②3×2×1＝6通りです。よって、答えは6です。' },
      { question: '3個から2個を選んで1列にならべるならべ方は何通りですか。', answer: '6', choices: ['6','3','9','2'],
        meaning: '①1番目に3通り、2番目に2通り。②3×2＝6通りです。よって、答えは6です。' },
      { question: '3個から2個を選ぶ選び方（順番は考えない）は何通りですか。', answer: '3', choices: ['3','6','2','9'],
        meaning: '①(2)の6通りは、同じ2個の組を順番ちがいで2回ずつ数えています。②6÷2＝3通り（赤青・赤黄・青黄）です。よって、答えは3です。' },
    ],
  },
  {
    id: 'sc_chain_16', category: 'kazu', grade: 3, title: '倍数の数え方',
    intro: '1から20までの整数について考えます。',
    steps: [
      { question: '1から20までに、偶数は何個ありますか。', answer: '10', choices: ['10','9','11','20'],
        meaning: '①偶数は2の倍数です。②20÷2＝10個あります。よって、答えは10です。' },
      { question: '1から20までに、3の倍数は何個ありますか。', answer: '6', choices: ['6','7','5','3'],
        meaning: '①3,6,9,12,15,18の6個です（20÷3＝6あまり2）。よって、答えは6です。' },
      { question: '1から20までで、偶数でも3の倍数でもある数（6の倍数）は何個ありますか。', answer: '3', choices: ['3','2','4','6'],
        meaning: '①6の倍数は6,12,18の3個です。よって、答えは3です。' },
    ],
  },
  {
    id: 'sc_chain_17', category: 'bun', grade: 3, title: '公園までの時間',
    intro: 'たかしくんは午前9時40分に家を出て、45分歩いて公園に着きました。',
    steps: [
      { question: '公園に着いたのは午前10時何分ですか。', answer: '25', choices: ['25','15','35','20'],
        meaning: '①9時40分の20分後が10時ちょうど、②残り25分進むので10時25分です。よって、答えは25です。' },
      { question: '公園で30分遊んでから帰ります。帰り始めるのは午前10時何分ですか。', answer: '55', choices: ['55','50','45','25'],
        meaning: '①10時25分＋30分＝10時55分です。よって、答えは55です。' },
      { question: '帰りも45分歩くと、家に着くのは午前11時何分ですか。', answer: '40', choices: ['40','35','45','50'],
        meaning: '①10時55分の5分後が11時ちょうど、②残り40分進むので11時40分です。よって、答えは40です。' },
    ],
  },
  {
    id: 'sc_chain_18', category: 'kisoku', grade: 3, title: 'カレンダーのきまり',
    intro: 'ある年の5月1日は木曜日でした。曜日は「日・月・火・水・木・金・土」の7日でくり返します。',
    steps: [
      { question: '5月1日から数えて、次に木曜日になるのは5月何日ですか。', answer: '8', choices: ['8','7','15','9'],
        meaning: '①曜日は7日ごとにくり返します。②5月1日＋7日＝5月8日です。よって、答えは8です。' },
      { question: '5月の木曜日は全部で何回ありますか（5月は31日まであります）。', answer: '5', choices: ['5','4','6','7'],
        meaning: '①木曜日は1,8,15,22,29日の5回です。よって、答えは5です。' },
      { question: '5月25日は何曜日ですか。', answer: '日曜日', choices: ['日曜日','土曜日','月曜日','水曜日'],
        meaning: '①5月25日は1日から24日後です。②24÷7＝3あまり3なので、木曜から3つ進んで「金・土・日」で日曜日です。よって、答えは日曜日です。' },
    ],
  },
  // ───────── 小4 ─────────
  {
    id: 'sc_chain_19', category: 'keisan', grade: 4, title: 'かけ算の覆面算',
    intro: '同じ文字には同じ数字が入ります。次のかけ算が成り立ちます。\nあああ × 3 ＝ 1332 （「あ」は1けたの数字、あああは3けたの数）',
    steps: [
      { question: '「あ」にあてはまる数字はいくつですか。', answer: '4', choices: ['4','3','6','2'],
        meaning: 'あああは「111×あ」を表します。①111×あ×3＝333×あ＝1332。②あ＝1332÷333＝4です。よって、答えは4です。' },
      { question: 'このとき あああ は444です。444を12でわるといくつですか。', answer: '37', choices: ['37','36','32','48'],
        meaning: '①444÷12＝37です。よって、答えは37です。' },
      { question: '(2)で求めた37に整数をかけて作れる、3けたで最も大きい37の倍数は999です。999は37の何倍ですか。', answer: '27', choices: ['27','26','28','33'],
        meaning: '①999÷37＝27なので、999は37の27倍です。よって、答えは27です。' },
    ],
  },
  {
    id: 'sc_chain_20', category: 'tokusan', grade: 4, title: 'つるかめ算',
    intro: 'つる（あし2本）とかめ（あし4本）が合わせて15匹います。あしの数は合わせて46本です。',
    steps: [
      { question: 'かめは何匹いますか。', answer: '8', choices: ['8','7','9','6'],
        meaning: '①全部つるなら2×15＝30本。②実際は46本で16本多く、かめ1匹で2本増えるので16÷2＝8匹です。よって、答えは8です。' },
      { question: 'つるは何匹いますか。', answer: '7', choices: ['7','8','6','9'],
        meaning: '①合計15匹からかめ8匹を引いて、15－8＝7匹です。よって、答えは7です。' },
      { question: 'かめのあしの合計は、つるのあしの合計より何本多いですか。', answer: '18', choices: ['18','16','14','20'],
        meaning: '①かめのあしは4×8＝32本、つるのあしは2×7＝14本。②32－14＝18本多いです。よって、答えは18です。' },
    ],
  },
  {
    id: 'sc_chain_21', category: 'zu', grade: 4, title: '切り取った図形の面積',
    intro: 'たて8cm、よこ12cmの長方形から、たて3cm、よこ4cmの長方形を切り取った図形があります。',
    steps: [
      { question: 'もとの大きい長方形の面積は何cm²ですか。', answer: '96', choices: ['96','40','84','108'],
        meaning: '①長方形の面積はたて×よこです。②8×12＝96cm²です。よって、答えは96です。' },
      { question: '切り取った小さい長方形の面積は何cm²ですか。', answer: '12', choices: ['12','7','14','24'],
        meaning: '①3×4＝12cm²です。よって、答えは12です。' },
      { question: '切り取ったあとに残った図形の面積は何cm²ですか。', answer: '84', choices: ['84','96','12','108'],
        meaning: '①もとの面積から切り取った分を引きます。②96－12＝84cm²です。よって、答えは84です。' },
    ],
  },
  {
    id: 'sc_chain_22', category: 'zu', grade: 4, title: '三角形の角の大きさ',
    intro: '三角形の3つの角の大きさの和は180度です。ある三角形は、いちばん大きい角が90度で、残りの2つの角は一方が他方より20度大きくなっています。',
    steps: [
      { question: '90度以外の2つの角の大きさの和は何度ですか。', answer: '90', choices: ['90','70','110','60'],
        meaning: '①3つの角の和は180度です。②180－90＝90度です。よって、答えは90です。' },
      { question: '2つの角のうち、小さいほうの角は何度ですか。', answer: '35', choices: ['35','45','30','40'],
        meaning: '①和が90度、差が20度の和差算です。②(90－20)÷2＝35度です。よって、答えは35です。' },
      { question: '大きいほうの角は何度ですか。', answer: '55', choices: ['55','45','65','50'],
        meaning: '①小さい角35度に差の20度をたします。②35＋20＝55度です。よって、答えは55です。' },
    ],
  },
  {
    id: 'sc_chain_23', category: 'kisoku', grade: 4, title: '正方形にならべた石',
    intro: '石をならべて、正方形の形（まわりだけで、中はうめない）を作ります。まず1辺に6個ずつならべます。',
    steps: [
      { question: '正方形のまわりにならぶ石は全部で何個ですか。', answer: '20', choices: ['20','24','16','22'],
        meaning: '①1辺6個で4辺だと6×4＝24個ですが、角の4個を2回数えています。②24－4＝20個です。よって、答えは20です。' },
      { question: '1辺を10個ずつにすると、まわりの石は何個になりますか。', answer: '36', choices: ['36','40','32','30'],
        meaning: '①10×4－4＝36個です。よって、答えは36です。' },
      { question: 'まわりの石がちょうど40個になるのは、1辺を何個ずつにしたときですか。', answer: '11', choices: ['11','10','12','9'],
        meaning: '①1辺を□個とすると4×□－4＝40。②4×□＝44、□＝11個です。よって、答えは11です。' },
    ],
  },
  {
    id: 'sc_chain_24', category: 'bun', grade: 4, title: '色紙の過不足算',
    intro: 'クラスで色紙を配ります。1人に5枚ずつ配ると12枚あまり、1人に7枚ずつ配ると8枚たりません。',
    steps: [
      { question: 'クラスの人数は何人ですか。', answer: '10', choices: ['10','9','11','12'],
        meaning: '①1人あたり7－5＝2枚増やすと、あまり12枚が不足8枚に変わり、合計12＋8＝20枚必要になります。②20÷2＝10人です。よって、答えは10です。' },
      { question: '色紙は全部で何枚ありますか。', answer: '62', choices: ['62','60','58','70'],
        meaning: '①5枚ずつ配ると12枚あまるので、5×10＋12＝62枚です。よって、答えは62です。' },
      { question: '1人に6枚ずつ配ると、何枚あまりますか。', answer: '2', choices: ['2','0','4','6'],
        meaning: '①6×10＝60枚配るので、②62－60＝2枚あまります。よって、答えは2です。' },
    ],
  },
  {
    id: 'sc_chain_25', category: 'kazu', grade: 4, title: '約数と公倍数',
    intro: '12と18という2つの整数について考えます。',
    steps: [
      { question: '12の約数は何個ありますか。', answer: '6', choices: ['6','5','4','12'],
        meaning: '①12の約数は1,2,3,4,6,12の6個です。よって、答えは6です。' },
      { question: '12と18の公約数のうち、いちばん大きい数（最大公約数）はいくつですか。', answer: '6', choices: ['6','3','2','12'],
        meaning: '①共通の約数は1,2,3,6で、いちばん大きいのは6です。よって、答えは6です。' },
      { question: '12と18の公倍数のうち、いちばん小さい数（最小公倍数）はいくつですか。', answer: '36', choices: ['36','24','18','72'],
        meaning: '①12の倍数と18の倍数に共通する最小の数は36です。よって、答えは36です。' },
    ],
  },
  {
    id: 'sc_chain_26', category: 'baai', grade: 4, title: '硬貨の組み合わせ',
    intro: '10円玉、50円玉、100円玉がたくさんあります。同じ硬貨は何枚使ってもよいものとします。',
    steps: [
      { question: 'ちょうど120円を作る硬貨の組み合わせは何通りありますか。', answer: '4', choices: ['4','3','5','6'],
        meaning: '①100円1枚＋10円2枚、②50円2枚＋10円2枚、③50円1枚＋10円7枚、④10円12枚の4通りです。よって、答えは4です。' },
      { question: '(1)のうち、使う硬貨の枚数がいちばん少ないのは何枚ですか。', answer: '3', choices: ['3','4','2','5'],
        meaning: '①100円1枚＋10円2枚の3枚がいちばん少ないです。よって、答えは3です。' },
      { question: '500円を、100円玉と50円玉だけで作る組み合わせは何通りありますか。', answer: '6', choices: ['6','5','7','4'],
        meaning: '①100円玉を5,4,3,2,1,0枚使う6通り（足りない分を50円玉でおぎなう）があります。よって、答えは6です。' },
    ],
  },
];

// ── 図形問題に図（SVG）を追加（最初の設問に表示される） ──
const S = '#eef2ff', G = '#ffd166';
const svgWrap = inner => `<svg viewBox='0 0 220 150' style='display:block;margin:6px auto;max-width:240px'>${inner}</svg>`;
const setSvg = (id, svg) => { const c = NEW.find(x => x.id === id); if (c) c.svg = svg; };

// 小3 長方形 6×8
setSvg('sc_chain_13', svgWrap(
  `<rect x='55' y='35' width='110' height='75' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<text x='110' y='28' font-size='13' fill='${G}' text-anchor='middle'>よこ 8cm</text>` +
  `<text x='48' y='77' font-size='13' fill='${G}' text-anchor='end'>たて6cm</text>`
));
// 小4 L字型（12×8から4×3を切り取り）
setSvg('sc_chain_21', svgWrap(
  `<polygon points='30,25 126,25 126,61 174,61 174,121 30,121' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<text x='95' y='137' font-size='12' fill='${G}' text-anchor='middle'>よこ12cm</text>` +
  `<text x='24' y='75' font-size='12' fill='${G}' text-anchor='end'>たて8cm</text>` +
  `<text x='150' y='53' font-size='11' fill='${G}' text-anchor='middle'>4cm</text>` +
  `<text x='134' y='47' font-size='11' fill='${G}' text-anchor='start'>3cm</text>`
));
// 小4 直角三角形（1つの角が90度）
setSvg('sc_chain_22', svgWrap(
  `<polygon points='45,115 185,115 45,30' fill='none' stroke='${S}' stroke-width='2'/>` +
  `<rect x='45' y='100' width='15' height='15' fill='none' stroke='${S}' stroke-width='1.5'/>` +
  `<text x='72' y='112' font-size='11' fill='${G}'>90°</text>` +
  `<text x='150' y='108' font-size='12' fill='${G}'>?</text>` +
  `<text x='52' y='48' font-size='12' fill='${G}'>?</text>`
));
// 小4 正方形にならべた石（1辺6個・まわりだけ）
setSvg('sc_chain_23', svgWrap((() => {
  let dots = '';
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    if (i === 0 || i === 5 || j === 0 || j === 5) {
      dots += `<circle cx='${45 + i * 26}' cy='${20 + j * 26}' r='5' fill='${G}'/>`;
    }
  }
  return dots + `<text x='110' y='148' font-size='11' fill='${S}' text-anchor='middle'>1辺に6個ずつ</text>`;
})()));

data.push(...NEW);
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');

// 検証
let problems = [];
const ids = data.map(c => c.id);
if (new Set(ids).size !== ids.length) problems.push('DUPLICATE IDS');
const validCats = ['keisan','bun','zu','kisoku','tokusan','baai','kazu','wariai','hayasa','rittai'];
data.forEach(c => {
  if (!validCats.includes(c.category)) problems.push(c.id + ': bad category ' + c.category);
  if (![3,4,5,6].includes(c.grade)) problems.push(c.id + ': bad grade ' + c.grade);
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
