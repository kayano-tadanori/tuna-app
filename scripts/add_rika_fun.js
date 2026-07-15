// 理科の「楽しい工夫」：キャラ（オットン・オカーン・チッチ）をたまに登場させ、
// 覚え方（語呂）を入れた問題を少しだけ足す。出しすぎないよう各カテゴリ1〜2問。
// 理科は選択式なので choices も付ける。図は既存の理科図と同じ系統。
const fs = require('fs');
const path = require('path');
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', OR = '#ffa94d', PU = '#b39ddb', BR = '#c9975b', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;
const arrowR = (x1, x2, y, c = WT) => `<line x1="${x1}" y1="${y}" x2="${x2 - 5}" y2="${y}" stroke="${c}" stroke-width="1.5"/><polygon points="${x2},${y} ${x2 - 6},${y - 3} ${x2 - 6},${y + 3}" fill="${c}"/>`;
function figVertebrate() {
  const groups = [['魚類', BL], ['両生類', GN], ['は虫類', OR], ['鳥類', PK], ['ほ乳類', RD]];
  let body = txt(100, 20, 'せきつい動物のなかま', WT, 10);
  groups.forEach(([g, c], i) => { const x = 8 + i * 38; body += `<rect x="${x}" y="40" width="36" height="26" rx="4" fill="${c}" opacity="${g === '鳥類' ? 0.75 : 0.3}" stroke="${c}" stroke-width="1.3"/>` + txt(x + 18, 56, g, c, 9); });
  return S('200 82', body);
}
function figStates() {
  const y = 46, s = 34;
  return S('200 92', `<rect x="24" y="${y - s / 2}" width="${s}" height="${s}" fill="${BL}" opacity="0.5" stroke="${BL}" stroke-width="1.5"/>` +
    `<path d="M84 ${y + 14} a12 16 0 1 1 24 0 a12 12 0 0 1 -24 0 Z" fill="${BL}" opacity="0.5" stroke="${BL}" stroke-width="1.5"/>` +
    [150, 160, 156, 166].map((x, i) => `<circle cx="${x}" cy="${y - 8 + (i % 2) * 12}" r="4" fill="${WT}" opacity="0.6"/>`).join('') +
    arrowR(64, 80, y) + arrowR(116, 140, y) + txt(41, y + 30, '氷（固体）', BL, 9) + txt(96, y + 34, '水（液体）', BL, 9) + txt(158, y + 30, '水じょう気', WT, 8));
}
function figCloud() {
  return S('200 100', `<path d="M60 50 a18 18 0 0 1 34 -8 a16 16 0 0 1 30 4 a15 15 0 0 1 -4 30 H66 a16 16 0 0 1 -6 -26 Z" fill="${WT}" opacity="0.5" stroke="${WT}" stroke-width="1.2"/>` +
    [70, 90, 110, 130].map(x => `<line x1="${x}" y1="80" x2="${x - 6}" y2="94" stroke="${BL}" stroke-width="1.8"/>`).join('') + txt(100, 30, '入道雲', WT, 11) + txt(100, 98, '夕立', BL, 9));
}
function figLitmus() {
  const items = [['酸性', RD], ['中性', PU], ['アルカリ性', BL]];
  let body = txt(100, 20, 'リトマス紙の色', WT, 10);
  items.forEach(([name, c], i) => { const x = 30 + i * 56; body += `<rect x="${x}" y="30" width="34" height="46" rx="3" fill="${c}" opacity="0.55" stroke="${WT}" stroke-width="0.8"/>` + txt(x + 17, 90, name, c, 9); });
  return S('200 100', body);
}
function figHeart() {
  return S('200 116', `<path d="M100 40 C100 22 70 22 70 42 C70 62 100 84 100 92 C100 84 130 62 130 42 C130 22 100 22 100 40 Z" fill="${RD}" opacity="0.5" stroke="${RD}" stroke-width="2"/>` + txt(100, 108, '心臓', RD, 12));
}

function add(file, prefix, item) {
  const FILE = path.join(__dirname, '..', 'data', 'rika_' + file + '.json');
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const maxId = Math.max(...data.map(q => Number(String(q.id).replace(/\D/g, '')) || 0));
  item.id = prefix + String(maxId + 1).padStart(3, '0');
  data.push(item);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

// チッチ（鳥）: doubutsu
add('doubutsu', 'rd', { question: 'チッチ（黄色いボタンインコ）は鳥のなかまです。鳥は、せきつい動物の何類ですか？', answer: '鳥類', choices: ['鳥類', 'ほ乳類', '魚類', 'は虫類'], meaning: 'チッチのような鳥は羽毛があり卵を産む「鳥類」です。覚え方：さかな→両生→は虫→鳥→ほ乳、と水辺から陸へ進化した順にならびます。', grade: 4, difficulty: 2, svg: figVertebrate() });
// オカーン（料理）: mono（状態変化）
add('mono', 'rm', { question: 'オカーンがなべで水をわかすと、ゆげ（湯気）が立ちました。水が水じょう気（気体）に変わることを何といいますか？', answer: 'じょう発', choices: ['じょう発', 'ぎょうこ', 'ゆうかい', 'ぎょうしゅく'], meaning: '液体の水が気体（水じょう気）に変わることを「じょう発（蒸発）」といいます。オカーンの料理は理科の実験でもあるんやで！', grade: 4, difficulty: 3, svg: figStates() });
// オットン（空を見る）: tenki
add('tenki', 'tk', { question: 'オットンが夏の午後に空を見上げると、もくもくと高くのびる大きな雲が。夕立やかみなりをもたらすこの雲は何ですか？', answer: '積乱雲（入道雲）', choices: ['積乱雲（入道雲）', 'けん雲（すじ雲）', 'そう雲', 'こう積雲'], meaning: '夏の午後に発達し、夕立やかみなりを起こすのは「積乱雲（入道雲）」です。オットン、かみなりが来る前に現場をかたづけなあかん！', grade: 5, difficulty: 2, svg: figCloud() });
// オカーン（レモンと石けん）: suiyoueki（覚え方）
add('suiyoueki', 'rs', { question: 'オカーンの台所で、レモン水は酸性、石けん水はアルカリ性です。青色リトマス紙を赤色に変えるのはどちらの性質ですか？', answer: '酸性', choices: ['酸性', 'アルカリ性', '中性', 'どちらも変えない'], meaning: '酸性は青色リトマス紙を赤に変えます。覚え方：「青が赤くなったら酸っぱい（酸性）」。レモンは酸っぱいから酸性やね。', grade: 5, difficulty: 2, svg: figLitmus() });
// チッチ（心ぞうはやい）: jintai
add('jintai', 'jt', { question: 'チッチのような小さな鳥は、体が小さいほど心ぞうがドキドキと速く打ちます。心ぞうが血液を全身に送るはたらきを何といいますか？', answer: 'はく動', choices: ['はく動', 'こ吸', '消化', '反しゃ'], meaning: '心ぞうがちぢんだりゆるんだりして血液を送り出すことを「はく動」といいます。小さな動物ほどはく動は速いです。', grade: 6, difficulty: 2, svg: figHeart() });

console.log('理科の楽しい工夫（キャラ＋覚え方）を5問追加しました。');
