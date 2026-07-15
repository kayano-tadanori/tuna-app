// 人体（rika_jintai.json）は図が0枚だったので、既存の問題にキーワードで
// 関連する図（骨と筋肉・関節、肺と呼吸、心臓）を付ける。問題文・答えは変えない。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_jintai.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 11, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// 骨・きん肉・関節（曲げたうで）
function figArm() {
  const body =
    // 上のうでの骨（縦）
    `<line x1="55" y1="28" x2="55" y2="82" stroke="${WT}" stroke-width="6" stroke-linecap="round"/>` +
    // 前うでの骨（ひじで曲げて上へ）
    `<line x1="55" y1="82" x2="140" y2="52" stroke="${WT}" stroke-width="6" stroke-linecap="round"/>` +
    // ひじの関節
    `<circle cx="55" cy="82" r="7" fill="${BL}"/>` +
    // 力こぶ（ちぢんだきん肉）
    `<path d="M58 40 Q95 40 118 58 Q92 62 62 66 Q52 52 58 40 Z" fill="${RD}" opacity="0.55" stroke="${RD}" stroke-width="1.5"/>` +
    txt(150, 40, '骨', WT, 11, 'start') + txt(20, 86, '関節', BL, 11, 'start') + txt(88, 34, 'きん肉', RD, 11) +
    `<line x1="40" y1="82" x2="49" y2="82" stroke="${BL}" stroke-width="1"/>`;
  return S('200 110', body);
}
// 肺と呼吸（気管・肺・横かくまく）
function figLungs() {
  const body =
    `<line x1="100" y1="14" x2="100" y2="46" stroke="${WT}" stroke-width="4"/>` +
    `<line x1="100" y1="46" x2="72" y2="60" stroke="${WT}" stroke-width="3"/><line x1="100" y1="46" x2="128" y2="60" stroke="${WT}" stroke-width="3"/>` +
    `<path d="M72 56 Q52 66 56 96 Q78 104 86 84 L86 62 Q80 56 72 56 Z" fill="${PK}" opacity="0.5" stroke="${PK}" stroke-width="1.5"/>` +
    `<path d="M128 56 Q148 66 144 96 Q122 104 114 84 L114 62 Q120 56 128 56 Z" fill="${PK}" opacity="0.5" stroke="${PK}" stroke-width="1.5"/>` +
    `<path d="M50 104 Q100 118 150 104" fill="none" stroke="${GN}" stroke-width="2.5"/>` +
    txt(100, 12, '気管', WT, 10) + txt(70, 78, '肺', PK, 12) + txt(150, 108, '横かくまく', GN, 9, 'start');
  return S('200 124', body);
}
// 心臓（血液を送るポンプ）
function figHeart() {
  const body =
    `<path d="M100 40 C100 22 70 22 70 42 C70 62 100 84 100 92 C100 84 130 62 130 42 C130 22 100 22 100 40 Z" fill="${RD}" opacity="0.5" stroke="${RD}" stroke-width="2"/>` +
    `<line x1="100" y1="52" x2="100" y2="80" stroke="${WT}" stroke-width="1.2" opacity="0.7"/>` +
    txt(100, 108, '心臓', RD, 12) +
    `<polygon points="52,50 66,46 66,54" fill="${BL}"/><polygon points="148,50 134,46 134,54" fill="${YE}"/>` +
    txt(40, 52, '血', BL, 10, 'end') + txt(160, 52, '血', YE, 10, 'start');
  return S('200 120', body);
}

let counts = { arm: 0, lungs: 0, heart: 0 };
for (const q of data) {
  if (q.svg) continue;
  const t = q.question + q.answer;
  if (/関節|きん肉|筋肉|ほね|骨/.test(t)) { q.svg = figArm(); counts.arm++; }
  else if (/肺|呼吸|気管|横かくまく|酸素|二酸化炭素/.test(t)) { q.svg = figLungs(); counts.lungs++; }
  else if (/心ぞう|心臓|血液|血/.test(t)) { q.svg = figHeart(); counts.heart++; }
}
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('総数:', data.length, '図あり:', data.filter(q => q.svg).length, JSON.stringify(counts));
