// 光と音（rika_hikarioto.json）に「音の速さで距離を計る」楽しい計算問題を追加。
// 海辺で船の汽笛・雷・花火・やまびこなど身近な題材。音速は340m/s。図つき。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'rika_hikarioto.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let maxId = Math.max(...data.map(q => Number(String(q.id).replace(/\D/g, '')) || 0));
const nid = () => 'ho' + String(++maxId).padStart(3, '0');

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', WT = '#cdd6f4', SEA = '#2a6fd6';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// 海辺で船の汽笛：きみ(左)＝船(右)、音の波、距離
function figShip(distLabel, timeLabel) {
  const sy = 62;
  let body = `<rect x="0" y="${sy}" width="240" height="34" fill="${SEA}" opacity="0.3"/>`; // 海
  // きみ（左の岸）
  body += `<circle cx="24" cy="${sy - 10}" r="5" fill="${YE}"/><line x1="24" y1="${sy - 5}" x2="24" y2="${sy + 4}" stroke="${YE}" stroke-width="2"/>` + txt(24, sy + 18, 'きみ', WT, 9);
  // 船（右）
  body += `<path d="M186 ${sy - 4} h34 l-6 12 h-22 Z" fill="${WT}" opacity="0.85"/><rect x="198" y="${sy - 16}" width="12" height="12" fill="${RD}" opacity="0.8"/>` + txt(203, sy + 22, '船', WT, 9);
  // 汽笛の白いけむり
  body += `<circle cx="212" cy="${sy - 20}" r="3" fill="${WT}" opacity="0.7"/><circle cx="217" cy="${sy - 24}" r="2.5" fill="${WT}" opacity="0.6"/>`;
  // 音の波（船→きみ）
  [0, 1, 2].forEach(i => body += `<path d="M${170 - i * 34} ${sy - 18} A22 22 0 0 0 ${170 - i * 34} ${sy + 2}" fill="none" stroke="${RD}" stroke-width="1.6" opacity="${0.8 - i * 0.2}"/>`);
  // 距離
  body += `<line x1="24" y1="26" x2="203" y2="26" stroke="${YE}" stroke-width="1"/><line x1="24" y1="22" x2="24" y2="30" stroke="${YE}"/><line x1="203" y1="22" x2="203" y2="30" stroke="${YE}"/>` +
    txt(113, 20, distLabel, YE, 11) + (timeLabel ? txt(113, 44, timeLabel, RD, 9) : '');
  return S('240 100', body);
}
// やまびこ（がけに反射）
function figEcho(distLabel) {
  const gy = 60;
  let body = `<polygon points="200,20 240,20 240,${gy + 20} 200,${gy + 20}" fill="${WT}" opacity="0.25" stroke="${WT}"/>` + txt(220, 18, 'がけ', WT, 9);
  body += `<circle cx="30" cy="${gy}" r="5" fill="${YE}"/>` + txt(30, gy + 16, 'きみ', WT, 9);
  body += `<line x1="38" y1="${gy - 4}" x2="196" y2="${gy - 4}" stroke="${RD}" stroke-width="1.6"/><polygon points="196,${gy - 4} 188,${gy - 8} 188,0" fill="${RD}" opacity="0"/><polygon points="196,${gy - 4} 189,${gy - 8} 189,${gy}" fill="${RD}"/>` + txt(115, gy - 8, '声', RD, 9);
  body += `<line x1="196" y1="${gy + 6}" x2="38" y2="${gy + 6}" stroke="${YE}" stroke-width="1.6" stroke-dasharray="3 2"/><polygon points="38,${gy + 6} 45,${gy + 2} 45,${gy + 10}" fill="${YE}"/>` + txt(115, gy + 18, 'やまびこ（もどる音）', YE, 8);
  body += txt(120, 20, distLabel, YE, 10);
  return S('250 92', body);
}

function add(grade, diff, question, answer, choices, meaning, svg) {
  data.push({ id: nid(), question, answer: String(answer), choices, meaning, grade, difficulty: diff, svg });
}
const shuffleChoices = (ans, arr) => { const s = [...new Set([String(ans), ...arr.map(String)])]; return s.slice(0, 4); };

// ① 船の汽笛（見えてから聞こえるまで）: 5-2
[[3], [4], [5], [6], [8]].forEach(([t]) => {
  const d = 340 * t;
  add(5, 2, `海辺に立っていると、船の汽笛から出た白いけむりが見えてから${t}秒後に「ボー」という音が聞こえました。音の速さを秒速340mとすると、船までの距離は何mですか？`, d,
    shuffleChoices(d, [340, d + 340, d / 2, 340 * (t + 1)]),
    `光（けむり）はすぐ届くので、音が届いた${t}秒ぶんが距離になる。340×${t}＝${d}m。海辺で船までの距離が計れるんだね！`, figShip(`? m`, `${t}秒後に音`));
});
// ② 雷（いなずま→音）: 5-3
[[2], [4], [5], [7]].forEach(([t]) => {
  const d = 340 * t;
  add(5, 3, `いなずまが光ってから${t}秒後に「ゴロゴロ」とかみなりの音が聞こえました。音の速さを秒速340mとすると、かみなりが落ちた場所までの距離は何mですか？`, d,
    shuffleChoices(d, [340, d + 680, d / 2, 3400]),
    `光は一瞬で届くので、音がおくれた${t}秒ぶんが距離。340×${t}＝${d}m。ピカッと光ってから音までの秒数で、かみなりの遠さがわかります。`, figShip(`? m`, `${t}秒後に音`));
});
// ③ 花火: 5-2
[[3], [4], [6]].forEach(([t]) => {
  const d = 340 * t;
  add(5, 2, `花火が開くのが見えてから${t}秒後に「ドン」という音が聞こえました。音の速さを秒速340mとすると、花火の打ち上げ場所までの距離は何mですか？`, d,
    shuffleChoices(d, [340, d + 340, d / 2, 340 * t + 100]),
    `光はすぐ、音は${t}秒おくれて届く。340×${t}＝${d}mです。`, figShip(`? m`, `${t}秒後に音`));
});
// ④ やまびこ（がけに反射・往復）: 6-2
[[4], [6], [8], [10]].forEach(([t]) => {
  const d = 340 * t / 2;
  add(6, 2, `がけに向かって「ヤッホー」とさけぶと、${t}秒後にやまびこ（はね返った音）が聞こえました。音の速さを秒速340mとすると、がけまでの距離は何mですか？`, d,
    shuffleChoices(d, [340 * t, 340, d + 340, 340]),
    `音はがけまで行って返ってくる（往復）ので、片道は半分。340×${t}÷2＝${d}mです。`, figEcho(`がけまで ? m`));
});
// ⑤ 逆算（距離→時間）: 6-2
[[1360], [1700], [2040], [1020]].forEach(([d]) => {
  const t = d / 340;
  add(6, 2, `海辺から${d}mはなれた船が汽笛を鳴らしました。音の速さを秒速340mとすると、音が海辺に届くまでに何秒かかりますか？`, t,
    shuffleChoices(t, [t + 1, d / 100, t * 2, 340]),
    `時間＝距離÷速さ＝${d}÷340＝${t}秒です。`, figShip(`${d}m`, '?秒後に音'));
});

fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
const added = data.filter(q => /汽笛|いなずま|花火が開く|やまびこ|海辺から/.test(q.question)).length;
console.log('総数:', data.length, '図あり:', data.filter(q => q.svg).length, '音の距離問題:', added);
console.log('壊れSVG:', data.filter(q => q.svg && !q.svg.includes('</svg>')).length,
  '/ 答えがchoicesに:', data.filter(q => q.choices && !q.choices.includes(q.answer)).length + '件不整合');
