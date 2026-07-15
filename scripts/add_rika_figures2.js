// 大地・天気・気体・水溶液に図を付ける（図0枚の4カテゴリ）。既存問題にキーワードで
// 地層・火山・雲・天気図・気温計・気体の集め方・リトマス・ろ過・ビーカーの図を付与。
const fs = require('fs');
const path = require('path');
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', BR = '#c9975b', PU = '#b39ddb', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;
const arrowR = (x1, x2, y, c = WT) => `<line x1="${x1}" y1="${y}" x2="${x2 - 5}" y2="${y}" stroke="${c}" stroke-width="1.5"/><polygon points="${x2},${y} ${x2 - 6},${y - 3} ${x2 - 6},${y + 3}" fill="${c}"/>`;

// 地層（れき・砂・どろ）
function figStrata() {
  const x0 = 30, w = 140, y0 = 24, h = 18;
  const layers = [['れき', BR, 'circle'], ['砂', YE, 'dot'], ['どろ', GN, 'solid'], ['砂', YE, 'dot']];
  let body = '';
  layers.forEach(([name, c, pat], i) => {
    const y = y0 + i * h;
    body += `<rect x="${x0}" y="${y}" width="${w}" height="${h}" fill="${c}" opacity="0.3" stroke="${WT}" stroke-width="0.6"/>`;
    if (pat === 'circle') for (let k = 0; k < 6; k++) body += `<circle cx="${x0 + 14 + k * 22}" cy="${y + 9}" r="3" fill="${c}" opacity="0.8"/>`;
    if (pat === 'dot') for (let k = 0; k < 12; k++) body += `<circle cx="${x0 + 8 + k * 11}" cy="${y + 9}" r="1.2" fill="${c}"/>`;
    body += txt(x0 + w + 6, y + 13, name, c, 9, 'start');
  });
  return S('200 108', body);
}
// 火山
function figVolcano() {
  return S('200 108', `<polygon points="40,96 90,36 100,44 110,36 160,96" fill="${WT}" opacity="0.25" stroke="${WT}" stroke-width="1.5"/>` +
    `<polygon points="90,36 100,44 110,36 105,28 95,28" fill="${RD}" opacity="0.7"/>` +
    `<ellipse cx="100" cy="102" rx="30" ry="8" fill="${RD}" opacity="0.4"/>` +
    `<line x1="100" y1="96" x2="100" y2="70" stroke="${RD}" stroke-width="4" opacity="0.6"/>` +
    txt(100, 22, '火口', RD, 9) + txt(150, 78, 'よう岩', RD, 9, 'start') + txt(60, 78, '火山', WT, 10, 'end'));
}
// 雲と雨
function figCloud() {
  return S('200 100', `<path d="M60 50 a18 18 0 0 1 34 -8 a16 16 0 0 1 30 4 a15 15 0 0 1 -4 30 H66 a16 16 0 0 1 -6 -26 Z" fill="${WT}" opacity="0.5" stroke="${WT}" stroke-width="1.2"/>` +
    [70, 90, 110, 130].map(x => `<line x1="${x}" y1="80" x2="${x - 6}" y2="94" stroke="${BL}" stroke-width="1.8"/>`).join('') +
    txt(100, 30, '雲', WT, 11) + txt(100, 98, '雨', BL, 9));
}
// 天気図（高気圧・低気圧）
function figWeatherMap() {
  return S('200 100', `<circle cx="58" cy="52" r="10" fill="none" stroke="${RD}" stroke-width="1.2"/><circle cx="58" cy="52" r="20" fill="none" stroke="${RD}" stroke-width="1.2"/><circle cx="58" cy="52" r="30" fill="none" stroke="${RD}" stroke-width="1.2"/>` +
    txt(58, 57, '高', RD, 14) +
    `<circle cx="142" cy="52" r="10" fill="none" stroke="${BL}" stroke-width="1.2"/><circle cx="142" cy="52" r="20" fill="none" stroke="${BL}" stroke-width="1.2"/><circle cx="142" cy="52" r="30" fill="none" stroke="${BL}" stroke-width="1.2"/>` +
    txt(142, 57, '低', BL, 14) +
    txt(58, 96, '高気圧', RD, 9) + txt(142, 96, '低気圧', BL, 9));
}
// 気温計（百葉箱の中の温度計）
function figThermo() {
  return S('200 108', `<rect x="92" y="18" width="16" height="66" rx="8" fill="none" stroke="${WT}" stroke-width="1.5"/>` +
    `<circle cx="100" cy="88" r="12" fill="${RD}" opacity="0.7" stroke="${RD}"/>` +
    `<rect x="96" y="50" width="8" height="38" fill="${RD}" opacity="0.7"/>` +
    [30, 45, 60, 75].map(y => `<line x1="108" y1="${y}" x2="114" y2="${y}" stroke="${WT}" stroke-width="1"/>`).join('') +
    txt(140, 55, '温度計', WT, 10, 'start') + txt(100, 104, '気温をはかる', WT, 9));
}
// 気体の集め方（水上ち換）
function figGasCollect() {
  return S('200 110', `<rect x="30" y="70" width="140" height="30" fill="${BL}" opacity="0.25" stroke="${BL}" stroke-width="1.2"/>` + txt(40, 90, '水', BL, 9) +
    `<rect x="96" y="26" width="26" height="54" rx="3" fill="${WT}" opacity="0.12" stroke="${WT}" stroke-width="1.5"/>` +
    `<rect x="96" y="52" width="26" height="28" fill="none"/>` +
    [0, 1, 2].map(i => `<circle cx="${104 + i * 6}" cy="${60 + i * 5}" r="2.5" fill="${WT}" opacity="0.7"/>`).join('') +
    `<path d="M70 100 q0 -14 26 -20" fill="none" stroke="${WT}" stroke-width="2"/>` +
    txt(140, 40, '気体', WT, 9, 'start') + txt(100, 108, '水上ち換', WT, 9));
}
// リトマス紙（酸性・中性・アルカリ性）
function figLitmus() {
  const items = [['酸性', RD], ['中性', PU], ['アルカリ性', BL]];
  let body = '';
  items.forEach(([name, c], i) => {
    const x = 30 + i * 56;
    body += `<rect x="${x}" y="30" width="34" height="46" rx="3" fill="${c}" opacity="0.55" stroke="${WT}" stroke-width="0.8"/>` + txt(x + 17, 90, name, c, 9);
  });
  return S('200 100', txt(100, 20, 'リトマス紙の色', WT, 10) + body);
}
// ろ過
function figFilter() {
  return S('200 116', `<polygon points="70,30 130,30 100,70" fill="none" stroke="${WT}" stroke-width="1.8"/>` +
    `<line x1="100" y1="70" x2="100" y2="86" stroke="${WT}" stroke-width="1.5"/>` +
    `<path d="M78 88 h44 v18 a22 10 0 0 1 -44 0 Z" fill="${BL}" opacity="0.25" stroke="${WT}" stroke-width="1.5"/>` +
    [96, 100, 104].map(x => `<circle cx="${x}" cy="${80 + (x % 8)}" r="1.5" fill="${BL}"/>`).join('') +
    txt(140, 46, 'ろ紙', WT, 9, 'start') + txt(100, 112, 'ろ過', WT, 10));
}
// ビーカー（水よう液・中和）
function figBeaker(label) {
  return S('190 108', `<path d="M70 24 v58 a6 6 0 0 0 6 6 h38 a6 6 0 0 0 6 -6 v-58" fill="none" stroke="${WT}" stroke-width="1.8"/>` +
    `<path d="M70 52 v30 a6 6 0 0 0 6 6 h38 a6 6 0 0 0 6 -6 v-30 Z" fill="${BL}" opacity="0.35"/>` +
    txt(95, 72, label || '水よう液', WT, 9));
}

function attachAll() {
  const jobs = [
    ['daichi', q => {
      const t = q.question + q.answer;
      if (/火山|マグマ|よう岩|火成岩/.test(t)) return figVolcano();
      if (/地層|たい積|化石|断層|れき岩|砂岩|でい岩|しん食|運ぱん/.test(t)) return figStrata();
      return null;
    }],
    ['tenki', q => {
      const t = q.question + q.answer;
      if (/天気図|高気圧|低気圧|前線|台風/.test(t)) return figWeatherMap();
      if (/気温|百葉箱|温度/.test(t)) return figThermo();
      if (/雲|雨|積乱雲|くもり|晴れ/.test(t)) return figCloud();
      return null;
    }],
    ['kitai', q => {
      const t = q.question + q.answer;
      if (/集め方|水上|上方|下方ち換|ち換/.test(t)) return figGasCollect();
      if (/酸素|二酸化炭素|水素|ちっ素|アンモニア|気体|石灰水/.test(t)) return figGasCollect();
      return null;
    }],
    ['suiyoueki', q => {
      const t = q.question + q.answer;
      if (/リトマス|酸性|アルカリ性|中性|BTB/.test(t)) return figLitmus();
      if (/ろ過/.test(t)) return figFilter();
      if (/中和|塩酸|水酸化ナトリウム|水よう液|石灰水|濃度/.test(t)) return figBeaker();
      return null;
    }],
  ];
  jobs.forEach(([name, fn]) => {
    const FILE = path.join(__dirname, '..', 'data', 'rika_' + name + '.json');
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    let added = 0;
    for (const q of data) { if (q.svg) continue; const svg = fn(q); if (svg) { q.svg = svg; added++; } }
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
    const broken = data.filter(q => q.svg && !q.svg.includes('</svg>')).length;
    console.log(`${name}: 図 ${data.filter(q => q.svg).length}/${data.length}（+${added}）壊れSVG${broken}`);
  });
}
attachAll();
