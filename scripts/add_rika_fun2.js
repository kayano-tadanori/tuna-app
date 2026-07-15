// 理科を楽しくする第2弾。知識科目なので「覚え方（語呂合わせ）」「へぇ！なトリビア」
// 「身近な例」を軸に、図つきの選択問題を各カテゴリに少しずつ足す。キャラは控えめ。
const fs = require('fs');
const path = require('path');
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', OR = '#ffa94d', PU = '#b39ddb', GR = '#9aa5c8', BR = '#c9975b', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// 太陽系の惑星（太陽に近い順）
function figPlanets() {
  const names = ['水', '金', '地', '火', '木', '土', '天', '海'];
  const cols = [GR, YE, BL, RD, OR, '#e6c86e', '#7fd3e0', '#5b7fe0'];
  const sizes = [3, 4, 4, 3.5, 8, 7, 5, 5];
  let body = `<circle cx="14" cy="40" r="12" fill="${YE}"/>` + txt(14, 60, '太陽', YE, 8);
  let x = 36;
  names.forEach((n, i) => { x += sizes[i] + 12; body += `<circle cx="${x}" cy="40" r="${sizes[i]}" fill="${cols[i]}" opacity="0.85"/>` + txt(x, 62, n, cols[i], 9); x += sizes[i]; });
  body += txt(120, 18, '水・金・地・火・木・土・天・海', WT, 9);
  return S('250 72', body);
}
// 月の満ち欠け
function figMoon() {
  const phases = [['新月', 0], ['三日月', 0.15], ['上弦', 0.5], ['満月', 1], ['下弦', 0.5]];
  let body = '';
  phases.forEach(([nm, f], i) => {
    const cx = 30 + i * 48;
    body += `<circle cx="${cx}" cy="34" r="14" fill="#20263f" stroke="${WT}" stroke-width="1"/>`;
    if (f === 1) body += `<circle cx="${cx}" cy="34" r="14" fill="${YE}" opacity="0.85"/>`;
    else if (f === 0.5 && nm === '上弦') body += `<path d="M${cx} 20 A14 14 0 0 1 ${cx} 48 Z" fill="${YE}" opacity="0.85"/>`;
    else if (f === 0.5) body += `<path d="M${cx} 20 A14 14 0 0 0 ${cx} 48 Z" fill="${YE}" opacity="0.85"/>`;
    else if (f > 0) body += `<path d="M${cx} 20 A14 14 0 0 1 ${cx} 48 A20 20 0 0 0 ${cx} 20 Z" fill="${YE}" opacity="0.85"/>`;
    body += txt(cx, 62, nm, YE, 8);
  });
  return S('264 72', body);
}
function figVertebrate(hl) {
  const g = [['魚類', BL], ['両生類', GN], ['は虫類', OR], ['鳥類', PK], ['ほ乳類', RD]];
  let body = txt(100, 18, 'せきつい動物', WT, 10);
  g.forEach(([n, c], i) => { const x = 8 + i * 38; body += `<rect x="${x}" y="34" width="36" height="24" rx="4" fill="${c}" opacity="${n === hl ? 0.8 : 0.3}" stroke="${c}"/>` + txt(x + 18, 50, n, c, 9); });
  return S('200 72', body);
}
function figStates() {
  const y = 42;
  return S('200 84', `<rect x="24" y="${y - 16}" width="32" height="32" fill="${BL}" opacity="0.5" stroke="${BL}"/>` +
    `<path d="M86 ${y + 12} a11 15 0 1 1 22 0 a11 11 0 0 1 -22 0 Z" fill="${BL}" opacity="0.5" stroke="${BL}"/>` +
    [148, 158, 154, 164].map((x, i) => `<circle cx="${x}" cy="${y - 6 + (i % 2) * 11}" r="3.5" fill="${WT}" opacity="0.6"/>`).join('') +
    txt(40, y + 28, '氷', BL, 9) + txt(97, y + 30, '水', BL, 9) + txt(158, y + 26, '水じょう気', WT, 8));
}
function figLitmus() {
  const it = [['酸性', RD], ['中性', PU], ['アルカリ性', BL]];
  let body = txt(100, 16, 'リトマス紙', WT, 10);
  it.forEach(([n, c], i) => { const x = 30 + i * 56; body += `<rect x="${x}" y="26" width="34" height="40" rx="3" fill="${c}" opacity="0.55" stroke="${WT}"/>` + txt(x + 17, 78, n, c, 9); });
  return S('200 88', body);
}
function figStrata() {
  const x0 = 40, w = 120, y0 = 14, h = 16;
  const L = [['れき（大）', BR], ['砂（中）', YE], ['どろ（小）', GN]];
  let body = '';
  L.forEach(([n, c], i) => { body += `<rect x="${x0}" y="${y0 + i * h}" width="${w}" height="${h}" fill="${c}" opacity="0.35" stroke="${WT}" stroke-width="0.6"/>` + txt(x0 + w + 6, y0 + i * h + 12, n, c, 9, 'start'); });
  return S('210 72', body);
}

// 星マーク
function star(cx, cy, r, c) {
  let p = '';
  for (let i = 0; i < 5; i++) {
    const a1 = -Math.PI / 2 + i * 2 * Math.PI / 5, a2 = a1 + Math.PI / 5;
    p += `${(cx + r * Math.cos(a1)).toFixed(1)},${(cy + r * Math.sin(a1)).toFixed(1)} ${(cx + r * 0.4 * Math.cos(a2)).toFixed(1)},${(cy + r * 0.4 * Math.sin(a2)).toFixed(1)} `;
  }
  return `<polygon points="${p.trim()}" fill="${c}"/>`;
}
// 夏の大三角
function figTriStars() {
  return S('220 96', star(50, 30, 8, YE) + star(30, 78, 8, YE) + star(180, 60, 8, YE) +
    `<polygon points="50,30 30,78 180,60" fill="none" stroke="${WT}" stroke-width="1" stroke-dasharray="3 2"/>` +
    txt(50, 18, 'デネブ', WT, 8) + txt(30, 92, 'ベガ', WT, 8) + txt(185, 76, 'アルタイル', WT, 8, 'start'));
}
// 北極星
function figNorthStar() {
  let body = `<text x="10" y="18" fill="${GR}" font-size="9" font-family="sans-serif">北</text>`;
  body += star(110, 40, 12, YE) + txt(110, 66, '北極星（ほぼ真北で動かない）', YE, 9);
  for (const [x, y] of [[40, 70], [70, 20], [160, 25], [185, 65], [30, 30]]) body += star(x, y, 3, GR);
  return S('220 78', body);
}

function add(file, prefix, item) {
  const FILE = path.join(__dirname, '..', 'data', 'rika_' + file + '.json');
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const maxId = Math.max(...data.map(q => Number(String(q.id).replace(/\D/g, '')) || 0));
  item.id = prefix + String(maxId + 1).padStart(3, '0');
  data.push(item);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
  return item;
}

// ===== 天体（sora）＝ rk =====
add('sora', 'rk', { question: '太陽系の惑星を太陽に近い順にならべる語呂は「水・金・地・火・木・土・天・海」。地球のすぐ外側（火星側）でとなりの惑星は？', answer: '火星', choices: ['火星', '金星', '木星', '土星'], meaning: '「水金地火木土天海（すいきんちかもくどってんかい）」と唱えると順番を覚えられます。地球の外側のとなりは火星です。', grade: 5, difficulty: 2, svg: figPlanets() });
add('sora', 'rk', { question: '月の形は「新月→三日月→上弦の半月→満月→下弦の半月」と変わります。満月の次にだんだん欠けていくとき、右と左どちらが光って見える？', answer: '左側', choices: ['左側', '右側', '真ん中', '全部'], meaning: '満ちていくとき（三日月〜上弦）は右側、欠けていくとき（満月のあと・下弦）は左側が光ります。', grade: 5, difficulty: 3, svg: figMoon() });
add('sora', 'rk', { question: '夏の夜空で目立つ「夏の大三角」をつくる3つの1等星は、デネブ・ベガと、あと1つは？', answer: 'アルタイル', choices: ['アルタイル', 'シリウス', 'カペラ', 'アンタレス'], meaning: 'ベガ（おりひめ星）・アルタイル（ひこ星）・デネブで夏の大三角。七夕の星たちです。', grade: 5, difficulty: 3, svg: figTriStars() });

// ===== 動物（doubutsu）＝ rd =====
add('doubutsu', 'rd', { question: 'せきつい動物は5つのなかまに分けられます。一生えらで呼吸するのはどれ？', answer: '魚類', choices: ['魚類', '両生類', 'は虫類', 'ほ乳類'], meaning: '魚類は一生えら呼吸。両生類は子（オタマジャクシ）がえら、親が肺と皮ふ、というちがいがあります。', grade: 4, difficulty: 3, svg: figVertebrate('魚類') });
add('doubutsu', 'rd', { question: 'こん虫の体は3つの部分に分かれ、あしは6本。あしがはえているのはどこ？', answer: 'むね', choices: ['むね', '頭', 'はら', '全部'], meaning: 'こん虫のあし6本は、すべて「むね」からはえています。頭・むね・はらの3つが体の基本です。', grade: 3, difficulty: 3, svg: null });

// ===== 大地（daichi）＝ rg =====
add('daichi', 'rg', { question: '地層をつくるつぶは、大きい順に「れき・砂・どろ」。川の水で運ばれ、河口から遠い深い海の底にたまりやすいのはどれ？', answer: 'どろ', choices: ['どろ', 'れき', '砂', '同じ'], meaning: '軽くて小さいつぶ（どろ）ほど遠くまで運ばれ、深く静かな海の底にたまります。重いれきは河口近くに積もります。', grade: 5, difficulty: 3, svg: figStrata() });

// ===== 気体（kitai）＝ kt =====
add('kitai', 'kt', { question: 'ものを燃やすはたらきがあり、ろうそくの火を近づけるとほのおが大きくなる気体は？', answer: '酸素', choices: ['酸素', '二酸化炭素', 'ちっ素', '水素'], meaning: '酸素はものを燃やすのを助けます（自分は燃えません）。二酸化炭素は逆に火を消します。', grade: 5, difficulty: 2, svg: null });
add('kitai', 'kt', { question: '石灰水に通すと白くにごる気体は？（ものが燃えたあとに増える気体）', answer: '二酸化炭素', choices: ['二酸化炭素', '酸素', '水素', 'ちっ素'], meaning: '二酸化炭素は石灰水を白くにごらせます。これが二酸化炭素を見分ける方法です。', grade: 5, difficulty: 2, svg: null });

// ===== もの（mono）＝ rm。へぇ！トリビア =====
add('mono', 'rm', { question: '【へぇ！】水はふつう、液体から固体（氷）になると体積はどうなる？', answer: '大きくなる', choices: ['大きくなる', '小さくなる', '変わらない', '半分になる'], meaning: '多くのものは固体になると体積が小さくなりますが、水は氷になると体積が約1.1倍に大きくなります。だから氷は水にうかぶのです！', grade: 5, difficulty: 3, svg: figStates() });

// ===== 水溶液（suiyoueki）＝ rs。覚え方 =====
add('suiyoueki', 'rs', { question: 'リトマス紙の覚え方「青が赤くなったら酸っぱい（酸性）」。では、赤色リトマス紙を青くする水よう液は何性？', answer: 'アルカリ性', choices: ['アルカリ性', '酸性', '中性', 'わからない'], meaning: '酸性＝青→赤、アルカリ性＝赤→青。石けん水やアンモニア水はアルカリ性です。', grade: 5, difficulty: 2, svg: figLitmus() });

// ===== 天気（tenki）＝ tk。観天望気（ことわざ理科） =====
add('tenki', 'tk', { question: '【天気のことわざ】「夕焼けの次の日は？」——西の空が夕焼けだと、次の日の天気は？', answer: '晴れ', choices: ['晴れ', '雨', '雪', '台風'], meaning: '天気は西から東へ移ります。西の空が晴れて夕焼けが見える＝西に雲がない＝次の日は晴れやすい、というわけです。', grade: 4, difficulty: 2, svg: null });

// ===== キャラは控えめに1問だけ（チッチ・天体） =====
add('sora', 'rk', { question: 'チッチが夜空を見上げると、北の空にいつも同じ場所で光る星が。船や旅人が方角を知るのに使ったこの星は？', answer: '北極星', choices: ['北極星', '金星', '流れ星', '太陽'], meaning: '北極星はほぼ真北にあり、一年中ほとんど動きません。北斗七星やカシオペヤ座から見つけられます。', grade: 5, difficulty: 2, svg: figNorthStar() });

console.log('楽しい理科（覚え方・トリビア・ことわざ・キャラ）を追加しました。');
