// もの（rika_mono.json）は図が0枚。既存問題にキーワードで図を付ける。
// 磁石・水の3すがた（状態変化）・ぼうちょう（あたたまり方）・てんびんの4種類。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_mono.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;
const arrowR = (x1, x2, y, c = WT) => `<line x1="${x1}" y1="${y}" x2="${x2 - 5}" y2="${y}" stroke="${c}" stroke-width="1.5"/><polygon points="${x2},${y} ${x2 - 6},${y - 3} ${x2 - 6},${y + 3}" fill="${c}"/>`;

// 棒磁石（N極・S極）
function figMagnet() {
  const y = 44, h = 26, x0 = 40, w = 120;
  return S('200 92', `<rect x="${x0}" y="${y}" width="${w / 2}" height="${h}" fill="${RD}" opacity="0.7"/>` +
    `<rect x="${x0 + w / 2}" y="${y}" width="${w / 2}" height="${h}" fill="${BL}" opacity="0.7"/>` +
    `<rect x="${x0}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${WT}" stroke-width="1.5"/>` +
    txt(x0 + w / 4, y + 18, 'N', '#fff', 15) + txt(x0 + 3 * w / 4, y + 18, 'S', '#fff', 15) +
    txt(x0 + w / 4, y - 6, 'N極', RD, 10) + txt(x0 + 3 * w / 4, y - 6, 'S極', BL, 10) +
    txt(100, y + h + 16, '鉄を引きつける', WT, 9));
}
// 水の3すがた（固体→液体→気体）
function figStates() {
  const y = 46, s = 34;
  const ice = `<rect x="24" y="${y - s / 2}" width="${s}" height="${s}" fill="${BL}" opacity="0.5" stroke="${BL}" stroke-width="1.5"/>`;
  const water = `<path d="M84 ${y + 14} a12 16 0 1 1 24 0 a12 12 0 0 1 -24 0 Z" fill="${BL}" opacity="0.5" stroke="${BL}" stroke-width="1.5"/>`;
  const steam = [150, 160, 156, 166].map((x, i) => `<circle cx="${x}" cy="${y - 8 + (i % 2) * 12}" r="4" fill="${WT}" opacity="0.6"/>`).join('');
  return S('200 92', ice + water + steam + arrowR(64, 80, y) + arrowR(116, 140, y) +
    txt(41, y + 30, '氷（固体）', BL, 9) + txt(96, y + 34, '水（液体）', BL, 9) + txt(158, y + 30, '水じょう気（気体）', WT, 8));
}
// ぼうちょう（あたためると体積がふえる）
function figExpand() {
  const bx = 66, by = 96, bw = 34;
  return S('200 108', `<rect x="${bx}" y="40" width="${bw}" height="${by - 40}" fill="none" stroke="${WT}" stroke-width="2"/>` +
    `<rect x="${bx}" y="66" width="${bw}" height="${by - 66}" fill="${BL}" opacity="0.4"/>` +
    `<line x1="${bx - 4}" y1="66" x2="${bx + bw + 4}" y2="66" stroke="${BL}" stroke-width="1" stroke-dasharray="3 2"/>` +
    `<line x1="${bx + bw + 14}" y1="66" x2="${bx + bw + 14}" y2="46" stroke="${RD}" stroke-width="1.5"/><polygon points="${bx + bw + 14},42 ${bx + bw + 10},50 ${bx + bw + 18},50" fill="${RD}"/>` +
    `<path d="M40 100 q6 -8 12 0" fill="none" stroke="${RD}" stroke-width="2"/><path d="M52 100 q6 -8 12 0" fill="none" stroke="${RD}" stroke-width="2"/>` +
    txt(46, 116, 'あたためる', RD, 9, 'start') + txt(bx + bw + 22, 58, '体積ふえる', RD, 9, 'start'));
}
// てんびん
function figBalance() {
  const cx = 100, top = 34;
  return S('200 100', `<polygon points="${cx - 12},86 ${cx + 12},86 ${cx},60" fill="${WT}" opacity="0.5"/>` +
    `<line x1="${cx}" y1="60" x2="${cx}" y2="${top}" stroke="${WT}" stroke-width="2"/>` +
    `<line x1="${cx - 55}" y1="${top}" x2="${cx + 55}" y2="${top}" stroke="${WT}" stroke-width="2.5"/>` +
    `<line x1="${cx - 55}" y1="${top}" x2="${cx - 55}" y2="56" stroke="${WT}" stroke-width="1"/><path d="M${cx - 70} 56 a15 8 0 0 0 30 0 Z" fill="${YE}" opacity="0.4" stroke="${YE}"/>` +
    `<line x1="${cx + 55}" y1="${top}" x2="${cx + 55}" y2="56" stroke="${WT}" stroke-width="1"/><path d="M${cx + 40} 56 a15 8 0 0 0 30 0 Z" fill="${YE}" opacity="0.4" stroke="${YE}"/>` +
    txt(cx, 98, 'てんびん', WT, 10));
}

let counts = {};
const attach = (fn, key) => { counts[key] = (counts[key] || 0) + 1; return fn; };
for (const q of data) {
  if (q.svg) continue;
  const t = q.question + q.answer;
  if (/磁石|じしゃく|N極|S極|方位/.test(t)) q.svg = attach(figMagnet(), 'magnet');
  else if (/固体|液体|気体|水じょう気|氷|ふっとう|じょう発|すがた|状態/.test(t)) q.svg = attach(figStates(), 'states');
  else if (/ぼうちょう|あたた|体積|温度/.test(t)) q.svg = attach(figExpand(), 'expand');
  else if (/てんびん|メスシリンダー|重さ/.test(t)) q.svg = attach(figBalance(), 'balance');
}
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('総数:', data.length, '図あり:', data.filter(q => q.svg).length, JSON.stringify(counts));
