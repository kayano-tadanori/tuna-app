// 身近な現象の問題 第2弾：①浮力（お風呂・氷山）②電車の窓ですれちがい ③稲妻までの距離早見
// ④氷と塩でアイス作り ⑤自転車の歯車。図つき・数値は文字列保存・答えはコード検算。
const fs = require('fs');
const path = require('path');
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', OR = '#ffa94d', GR = '#9aa5c8', WT = '#cdd6f4', SEA = '#2a6fd6';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;
const arrowR = (x1, x2, y, c) => `<line x1="${x1}" y1="${y}" x2="${x2 - 5}" y2="${y}" stroke="${c}" stroke-width="2.5"/><polygon points="${x2},${y} ${x2 - 7},${y - 4} ${x2 - 7},${y + 4}" fill="${c}"/>`;
const arrowL = (x1, x2, y, c) => `<line x1="${x1 + 5}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c}" stroke-width="2.5"/><polygon points="${x2},${y} ${x2 + 7},${y - 4} ${x2 + 7},${y + 4}" fill="${c}"/>`;

// ① 浮力（ビーカー・沈めた物・上向きの力）
function figBuoyancy() {
  const bx = 70, bw = 100, by = 96, wy = 34;
  let body = `<path d="M${bx} 20 v${by - 20} h${bw} v${-(by - 20)}" fill="none" stroke="${WT}" stroke-width="2"/>` +
    `<rect x="${bx}" y="${wy}" width="${bw}" height="${by - wy}" fill="${SEA}" opacity="0.3"/>` + txt(bx + bw + 6, wy + 4, '水面', WT, 9, 'start') +
    `<rect x="${bx + 32}" y="${wy + 16}" width="36" height="30" fill="${GR}" opacity="0.6" stroke="${WT}"/>` + txt(bx + 50, wy + 34, '物', '#fff', 9);
  body += `<line x1="${bx + 50}" y1="${wy + 14}" x2="${bx + 50}" y2="${wy - 2}" stroke="${RD}" stroke-width="2.5"/><polygon points="${bx + 50},${wy - 6} ${bx + 46},${wy + 2} ${bx + 54},${wy + 2}" fill="${RD}"/>` + txt(bx + 50, wy - 10, '浮力', RD, 10);
  return S('240 104', body);
}
// ② 電車の窓ですれちがい
function figTrains(lenLabel) {
  const y1 = 40, y2 = 66;
  let body = `<rect x="30" y="${y1 - 12}" width="90" height="20" rx="3" fill="${BL}" opacity="0.5" stroke="${BL}"/>` + txt(75, y1 + 2, '自分の電車', '#fff', 9) + arrowR(124, 158, y1 - 2, BL);
  body += `<rect x="120" y="${y2 - 12}" width="90" height="20" rx="3" fill="${PK}" opacity="0.5" stroke="${PK}"/>` + txt(165, y2 + 2, '対向電車', '#fff', 9) + arrowL(116, 82, y2 - 2, PK);
  body += `<rect x="112" y="${y1 - 14}" width="6" height="24" fill="${YE}"/>` + txt(115, 20, '窓', YE, 8);
  body += txt(120, 92, lenLabel, WT, 9);
  return S('240 100', body);
}
// ③ 稲妻までの距離
function figLightning(distLabel) {
  let body = `<ellipse cx="60" cy="26" rx="40" ry="16" fill="${GR}" opacity="0.5"/>` + txt(60, 30, '雲', WT, 9);
  body += `<polygon points="58,38 50,58 60,58 52,80 74,54 62,54 70,38" fill="${YE}"/>`;
  body += `<line x1="10" y1="92" x2="230" y2="92" stroke="${WT}" stroke-width="1.5"/>`;
  body += `<circle cx="200" cy="84" r="5" fill="${YE}"/><line x1="200" y1="84" x2="200" y2="76" stroke="${YE}" stroke-width="2"/>` + txt(200, 74, 'きみ', WT, 8);
  body += `<line x1="70" y1="88" x2="196" y2="88" stroke="${OR}" stroke-width="1" stroke-dasharray="3 2"/>` + txt(133, 84, distLabel, OR, 9);
  return S('240 100', body);
}
// ④ 氷と塩
function figIceSalt() {
  let body = `<path d="M50 40 h140 l-16 54 h-108 Z" fill="${SEA}" opacity="0.2" stroke="${WT}" stroke-width="1.5"/>`;
  for (const [x, y] of [[70, 55], [95, 62], [120, 54], [145, 63], [110, 74], [80, 78], [150, 78]]) body += `<rect x="${x}" y="${y}" width="12" height="12" fill="${BL}" opacity="0.5" stroke="${WT}" stroke-width="0.6"/>`;
  for (const [x, y] of [[85, 52], [130, 50], [105, 60], [140, 58], [95, 72], [125, 70]]) body += `<circle cx="${x}" cy="${y}" r="1.6" fill="${WT}"/>`;
  body += txt(120, 34, '氷＋塩', WT, 10) + txt(120, 108, '0℃より下がる（−20℃くらいまで）', PK, 9);
  return S('240 116', body);
}
// ⑤ 自転車の歯車
function figGears(aTeeth, bTeeth) {
  function gear(cx, cy, r, n, c) {
    let g = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" opacity="0.25" stroke="${c}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="4" fill="${c}"/>`;
    for (let i = 0; i < Math.min(n, 20); i++) { const a = i * 2 * Math.PI / Math.min(n, 20); g += `<line x1="${(cx + r * Math.cos(a)).toFixed(1)}" y1="${(cy + r * Math.sin(a)).toFixed(1)}" x2="${(cx + (r + 5) * Math.cos(a)).toFixed(1)}" y2="${(cy + (r + 5) * Math.sin(a)).toFixed(1)}" stroke="${c}" stroke-width="2"/>`; }
    return g;
  }
  let body = gear(58, 56, 34, aTeeth, BL) + gear(168, 56, 18, bTeeth, PK);
  body += `<line x1="58" y1="20" x2="168" y2="36" stroke="${WT}" stroke-width="1" opacity="0.5"/><line x1="58" y1="92" x2="168" y2="76" stroke="${WT}" stroke-width="1" opacity="0.5"/>`;
  body += txt(58, 104, `ペダル ${aTeeth}枚`, BL, 9) + txt(168, 104, `後輪 ${bTeeth}枚`, PK, 9);
  return S('230 116', body);
}

function addTo(file, prefix, item) {
  const FILE = path.join(__dirname, '..', 'data', file + '.json');
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const maxId = Math.max(...data.map(q => Number(String(q.id).replace(/\D/g, '')) || 0));
  item.id = prefix + String(maxId + 1).padStart(3, '0');
  item.answer = String(item.answer);
  data.push(item);
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}
const ch = (ans, arr) => [...new Set([String(ans), ...arr.map(String)])].slice(0, 4);

// ① 浮力（力・rc）
addTo('rika_chikara', 'rc', { question: 'お風呂で体が軽く感じたり、プールで体がうきやすいのは、水の中で上向きにはたらく何という力のせいですか？', answer: '浮力', choices: ['浮力', '重力', 'まさつ力', '電気の力'], meaning: '水の中の物には上向きの「浮力」がはたらきます。だから体が軽く感じ、うきやすくなります。', grade: 5, difficulty: 2, svg: figBuoyancy() });
[[500, 200], [300, 100], [800, 300], [600, 200], [450, 250], [700, 400]].forEach(([w, v]) => {
  const inWater = w - v; // 水1cm³=1gなので浮力=体積(g)
  addTo('rika_chikara', 'rc', { question: `空気中で${w}gの物を、体積${v}cm³まで水にすっかりしずめると、水中でのばねばかりは何gを示しますか？（水1cm³の重さを1gとする）`, answer: inWater, choices: ch(inWater, [w, v, w + v, inWater + 50]), meaning: `おしのけた水の重さ（＝体積${v}cm³→${v}g）が浮力。水中の重さ＝${w}－${v}＝${inWater}g。`, grade: 6, difficulty: 3, svg: figBuoyancy() });
});
addTo('rika_chikara', 'rc', { question: '氷が水にうかぶとき、水面より下にかくれている部分は全体のおよそどれくらいですか？', answer: '約9割', choices: ['約9割', '約半分', '約1割', '全部'], meaning: '氷は水より少しだけ軽いので、約9割が水面下にしずみ、水の上に出るのは約1割だけ。氷山の一角、という言葉のとおりです。', grade: 5, difficulty: 3, svg: figBuoyancy() });

// ② 電車の窓ですれちがい（速さ・sh）
[[120, 15, 25], [200, 10, 15], [150, 8, 17], [180, 12, 18], [160, 14, 26], [140, 15, 20]].forEach(([L, v1, v2]) => {
  const t = L / (v1 + v2);
  if (!Number.isInteger(t)) return;
  addTo('sansu_hayasa', 'sh', { question: `秒速${v1}mで走る電車の窓から、反対向きに秒速${v2}mで来る長さ${L}mの対向電車を見ると、目の前を通り過ぎるのに何秒かかりますか？`, answer: t, choices: ch(t, [L / v2, t + 1, v1 + v2, L / v1]), meaning: `窓（点）を対向電車の長さ${L}mが、近づく速さの和（${v1}＋${v2}＝${v1 + v2}m/秒）で通過。${L}÷${v1 + v2}＝${t}秒です。`, grade: 6, difficulty: 3, svg: figTrains(`対向電車 ${L}m`) });
});

// ③ 稲妻までの距離 早見（光と音・ho）音は約3秒で1km
[[3, 1], [6, 2], [9, 3], [12, 4], [15, 5]].forEach(([t, km]) => {
  addTo('rika_hikarioto', 'ho', { question: `【早見】音は約3秒で1km進みます。いなずまが光ってから${t}秒後にかみなりの音が聞こえたら、かみなりはおよそ何km先ですか？`, answer: km, choices: ch(km, [t, t / 6, km + 1, t * 3]), meaning: `3秒で約1kmなので、${t}÷3＝約${km}km先。光ってから音までの秒数を3でわると、だいたいの距離（km）がわかります！`, grade: 4, difficulty: 3, svg: figLightning(`約 ${km}km`) });
});

// ④ 氷と塩でアイス作り（もの・rm）
addTo('rika_mono', 'rm', { question: 'アイスクリーム作りで、氷だけでなく「氷＋塩」を使うのはなぜですか？', answer: '氷だけより温度が下がるから', choices: ['氷だけより温度が下がるから', 'あまくなるから', '氷がとけないから', '色がつくから'], meaning: '氷に塩を混ぜると、氷がとけるときに周りの熱をうばい、温度が0℃よりずっと低く（−20℃くらいまで）下がります。だから材料がよく冷えて固まります。', grade: 5, difficulty: 3, svg: figIceSalt() });
addTo('rika_mono', 'rm', { question: '雪がつもった道路に塩（ゆきをとかす薬）をまくのはなぜですか？', answer: '氷がとけやすく（こおりにくく）なるから', choices: ['氷がとけやすく（こおりにくく）なるから', 'すべりやすくするため', 'あたたかくするため', '道を白くするため'], meaning: '塩を混ぜると水がこおる温度（0℃）が下がるので、氷がとけやすく、また道がこおりにくくなります。アイス作りと同じしくみです。', grade: 5, difficulty: 3, svg: figIceSalt() });

// ⑤ 自転車の歯車（割合・比・sw）
[[24, 12], [36, 12], [30, 10], [32, 16], [48, 12], [45, 15]].forEach(([a, b]) => {
  const rot = a / b;
  if (!Number.isInteger(rot)) return;
  addTo('sansu_wariai', 'sw', { question: `自転車で、ペダル側の歯車の歯数が${a}、後輪側の歯車の歯数が${b}です。ペダルを1回転させると、後輪は何回転しますか？`, answer: rot, choices: ch(rot, [a, b, a + b, rot + 1]), meaning: `かみ合う歯車は歯の数が回転数の逆比。ペダル${a}÷後輪${b}＝${rot}。ペダル1回転で後輪は${rot}回転します（歯数が少ない後輪ほど速く回る）。`, grade: 5, difficulty: 3, svg: figGears(a, b) });
});

console.log('身近な現象 第2弾（浮力・電車の窓・稲妻・氷と塩・歯車）を追加しました。');
