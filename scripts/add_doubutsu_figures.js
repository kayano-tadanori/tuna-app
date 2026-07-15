// 動物（rika_doubutsu.json）は図が0枚。既存問題にキーワードで図を付ける。
// こん虫のからだ・完全変態・メダカ・セキツイ動物の分類の4種類。問題文・答えは変えない。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_doubutsu.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', OR = '#ffa94d', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;
const arrowR = (x1, x2, y, c = WT) => `<line x1="${x1}" y1="${y}" x2="${x2 - 5}" y2="${y}" stroke="${c}" stroke-width="1.5"/><polygon points="${x2},${y} ${x2 - 6},${y - 3} ${x2 - 6},${y + 3}" fill="${c}"/>`;

// こん虫のからだ（頭・むね・はら、あし6本）
function figInsect() {
  const y = 52;
  let body =
    `<circle cx="40" cy="${y}" r="12" fill="${OR}" opacity="0.6" stroke="${OR}" stroke-width="1.5"/>` + // 頭
    `<line x1="34" y1="42" x2="26" y2="30" stroke="${OR}" stroke-width="1.3"/><line x1="46" y1="42" x2="54" y2="30" stroke="${OR}" stroke-width="1.3"/>` + // しょっ角
    `<ellipse cx="72" cy="${y}" rx="18" ry="12" fill="${GN}" opacity="0.5" stroke="${GN}" stroke-width="1.5"/>` + // むね
    `<ellipse cx="118" cy="${y}" rx="26" ry="13" fill="${BL}" opacity="0.4" stroke="${BL}" stroke-width="1.5"/>` + // はら
    [[-14, -1], [0, -1], [14, -1], [-14, 1], [0, 1], [14, 1]].map(([dx, s]) => `<line x1="${72 + dx}" y1="${y}" x2="${72 + dx + s * 6}" y2="${y + s * 20}" stroke="${GN}" stroke-width="1.6"/>`).join('') + // あし6本
    txt(40, 30, '頭', OR) + txt(72, 24, 'むね', GN) + txt(118, 26, 'はら', BL) + txt(72, 94, 'あし6本', GN, 10);
  return S('200 104', body);
}
// 完全変態（卵→よう虫→さなぎ→成虫）
function figMetamorph() {
  const y = 40;
  const egg = `<circle cx="22" cy="${y}" r="4" fill="${WT}"/><circle cx="30" cy="${y + 4}" r="4" fill="${WT}"/><circle cx="26" cy="${y - 4}" r="4" fill="${WT}"/>`;
  const larva = `<path d="M62 ${y} q6 -8 12 0 q6 -8 12 0 q6 -8 12 0" fill="none" stroke="${GN}" stroke-width="4" stroke-linecap="round"/>`;
  const pupa = `<ellipse cx="128" cy="${y}" rx="8" ry="15" fill="${BR()}" opacity="0.6" stroke="${OR}" stroke-width="1.5"/>`;
  const adult = `<ellipse cx="172" cy="${y}" rx="3" ry="12" fill="${BL}"/><path d="M172 ${y - 6} q-16 -12 -20 4 q10 8 20 0 Z" fill="${PK}" opacity="0.6"/><path d="M172 ${y - 6} q16 -12 20 4 q-10 8 -20 0 Z" fill="${PK}" opacity="0.6"/>`;
  return S('200 78', egg + larva + pupa + adult + arrowR(38, 56, y) + arrowR(100, 116, y) + arrowR(140, 158, y) +
    txt(26, 60, '卵', WT, 9) + txt(80, 60, 'よう虫', GN, 9) + txt(128, 62, 'さなぎ', OR, 9) + txt(172, 62, '成虫', PK, 9));
}
function BR() { return '#c9975b'; }
// メダカ
function figMedaka() {
  const body =
    `<ellipse cx="95" cy="55" rx="42" ry="16" fill="${OR}" opacity="0.5" stroke="${OR}" stroke-width="1.6"/>` +
    `<polygon points="137,55 162,42 162,68" fill="${OR}" opacity="0.6" stroke="${OR}" stroke-width="1.3"/>` + // 尾びれ
    `<circle cx="60" cy="52" r="3.5" fill="#0d1530"/>` + // 目
    `<path d="M95 39 l8 -12 l8 12 Z" fill="${OR}" opacity="0.6"/>` + // せびれ
    `<path d="M95 71 q8 12 16 0" fill="none" stroke="${OR}" stroke-width="2"/>` + // しりびれ
    txt(95, 90, 'メダカ', OR, 11) + txt(150, 36, '尾びれ', OR, 8, 'start');
  return S('200 100', body);
}
// セキツイ動物の5分類
function figVertebrate() {
  const groups = [['魚類', BL], ['両生類', GN], ['は虫類', OR], ['鳥類', PK], ['ほ乳類', RD]];
  const x0 = 8, w = 36, gap = 2, y = 40;
  let body = txt(100, 20, 'せきつい動物のなかま', WT, 10);
  groups.forEach(([g, c], i) => {
    const x = x0 + i * (w + gap);
    body += `<rect x="${x}" y="${y}" width="${w}" height="26" rx="4" fill="${c}" opacity="0.35" stroke="${c}" stroke-width="1.3"/>` + txt(x + w / 2, y + 16, g, c, 9);
  });
  return S('200 82', body);
}

let counts = {};
const attach = (fn, key) => { counts[key] = (counts[key] || 0) + 1; return fn; };
for (const q of data) {
  if (q.svg) continue;
  const t = q.question + q.answer;
  if (/へんたい|変態|よう虫|さなぎ|成虫/.test(t)) q.svg = attach(figMetamorph(), 'metamorph');
  else if (/メダカ|たまご|卵/.test(t)) q.svg = attach(figMedaka(), 'medaka');
  else if (/こん虫|昆虫|しょっ角/.test(t)) q.svg = attach(figInsect(), 'insect');
  else if (/せきつい|背骨|せぼね|魚類|両生|は虫|鳥類|ほ乳|えら|変温|恒温/.test(t)) q.svg = attach(figVertebrate(), 'vertebrate');
}
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('総数:', data.length, '図あり:', data.filter(q => q.svg).length, JSON.stringify(counts));
