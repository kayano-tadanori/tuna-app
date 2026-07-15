// 身近な現象 第5弾：①ブランコ・振り子の周期 ②音の高さ（弦・太鼓・笛）③方位磁針とN極が北
// ④遠くの音がよく聞こえる ⑤ホースの先を細くすると勢いが増す。図つき・答えはコード検算。
const fs = require('fs');
const path = require('path');
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', OR = '#ffa94d', BR = '#c9975b', GR = '#9aa5c8', WT = '#cdd6f4', SEA = '#2a6fd6';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// ① 振り子・ブランコ
function figPendulum() {
  const px = 120, py = 20, L = 62;
  let body = `<line x1="60" y1="${py}" x2="180" y2="${py}" stroke="${WT}" stroke-width="2"/>`;
  // 左右のふれ（点線）＋中央の実線
  body += `<line x1="${px}" y1="${py}" x2="${px - 44}" y2="${py + L - 16}" stroke="${GR}" stroke-width="1" stroke-dasharray="3 2"/><circle cx="${px - 44}" cy="${py + L - 16}" r="8" fill="${GR}" opacity="0.4"/>`;
  body += `<line x1="${px}" y1="${py}" x2="${px + 44}" y2="${py + L - 16}" stroke="${GR}" stroke-width="1" stroke-dasharray="3 2"/><circle cx="${px + 44}" cy="${py + L - 16}" r="8" fill="${GR}" opacity="0.4"/>`;
  body += `<line x1="${px}" y1="${py}" x2="${px}" y2="${py + L}" stroke="${BR}" stroke-width="2"/><circle cx="${px}" cy="${py + L}" r="10" fill="${RD}" opacity="0.7"/>`;
  body += `<path d="M${px - 44} ${py + L - 16} A50 50 0 0 1 ${px + 44} ${py + L - 16}" fill="none" stroke="${YE}" stroke-width="1" stroke-dasharray="2 2"/>`;
  body += txt(px + 24, py + 34, 'ひもの長さ', BR, 9, 'start');
  return S('240 100', body);
}
// ② 音の高さ（弦のふるえ）
function figStringSound() {
  let body = `<circle cx="24" cy="40" r="6" fill="${WT}"/><circle cx="216" cy="40" r="6" fill="${WT}"/>`;
  body += `<path d="M24 40 Q70 20 116 40 Q162 60 208 40" fill="none" stroke="${YE}" stroke-width="2"/>`;
  body += `<path d="M24 40 Q70 58 116 40 Q162 22 208 40" fill="none" stroke="${YE}" stroke-width="1" opacity="0.5"/>`;
  body += txt(120, 76, '弦（短い・細い・強く張る → 高い音）', WT, 9);
  return S('240 88', body);
}
// ③ 方位磁針
function figCompass() {
  const cx = 70, cy = 52, r = 36;
  let body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${WT}" stroke-width="2"/>`;
  body += txt(cx, cy - r + 10, '北', WT, 10) + txt(cx, cy + r - 3, '南', WT, 10);
  body += `<polygon points="${cx},${cy - 26} ${cx - 6},${cy} ${cx + 6},${cy}" fill="${RD}"/>` + txt(cx, cy - 14, 'N', '#fff', 9);
  body += `<polygon points="${cx},${cy + 26} ${cx - 6},${cy} ${cx + 6},${cy}" fill="${BL}"/>` + txt(cx, cy + 18, 'S', '#fff', 9);
  body += txt(130, 44, 'N極は北をさす', WT, 9, 'start') + txt(130, 62, '（地球は大きな磁石）', GR, 8, 'start');
  return S('220 104', body);
}
// ④ 遠くの音（音が上へ曲がらず届く）
function figFarSound() {
  let body = `<circle cx="40" cy="60" r="6" fill="${YE}"/><line x1="40" y1="55" x2="40" y2="44" stroke="${YE}" stroke-width="2"/>` + txt(40, 78, '音げん', WT, 8);
  [0, 1, 2, 3].forEach(i => body += `<path d="M${58 + i * 30} 50 A16 16 0 0 1 ${58 + i * 30} 70" fill="none" stroke="${RD}" stroke-width="1.5" opacity="${0.85 - i * 0.15}"/>`);
  body += `<circle cx="200" cy="60" r="6" fill="${WT}"/>` + txt(200, 78, '耳', WT, 8);
  body += `<line x1="10" y1="78" x2="230" y2="78" stroke="${WT}" stroke-width="1"/>`;
  body += txt(120, 24, '夜・雨の日は遠くまで聞こえやすい', WT, 9);
  return S('240 92', body);
}
// ⑤ ホースの先を細くする
function figHose() {
  let body = `<path d="M20 50 h120 l40 -6 v22 l-40 -6 h-120 Z" fill="${SEA}" opacity="0.3" stroke="${BL}" stroke-width="1.5"/>` + txt(70, 45, 'ホース', BL, 9);
  body += `<polygon points="180,44 178,56 180,68" fill="${YE}"/>` + txt(150, 40, '細い先', YE, 8);
  // 勢いよく飛ぶ水
  [0, 1, 2, 3, 4].forEach(i => body += `<circle cx="${190 + i * 9}" cy="${50 - i * 3}" r="${2.4 - i * 0.2}" fill="${BL}"/>`);
  body += txt(120, 88, '先を細くすると水の勢い（速さ）が増す', WT, 9);
  return S('240 100', body);
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

// ① 振り子・ブランコ（力・rc）
addTo('rika_chikara', 'rc', { question: 'ブランコ（振り子）が1往復する時間は、おもに何によって変わりますか？', answer: 'ひも（くさり）の長さ', choices: ['ひも（くさり）の長さ', 'おもりの重さ', 'ふれはば', '人の身長'], meaning: '振り子が1往復する時間（周期）は「ひもの長さ」だけで決まります。おもりの重さやふれはばを変えても、周期は変わりません（振り子の等時性）。', grade: 5, difficulty: 3, svg: figPendulum() });
addTo('rika_chikara', 'rc', { question: '同じ振り子で、おもりだけを2倍の重さにすると、1往復する時間はどうなりますか？', answer: '変わらない', choices: ['変わらない', '2倍になる', '半分になる', '止まる'], meaning: '周期はひもの長さだけで決まるので、おもりの重さを変えても1往復の時間は変わりません。', grade: 5, difficulty: 3, svg: figPendulum() });
[[1, 4, 2], [1, 9, 3], [2, 4, 4], [1, 16, 4], [3, 4, 6], [2, 9, 6]].forEach(([p, k, np]) => {
  addTo('rika_chikara', 'rc', { question: `1往復に${p}秒かかる振り子があります。ひもの長さを${k}倍にすると、1往復は何秒になりますか？（周期は長さを${Math.sqrt(k)}倍にすると${Math.sqrt(k)}倍になる関係を使う）`, answer: np, choices: ch(np, [p * k, p, np + 1, p + k]), meaning: `振り子の周期は「長さを□²倍にすると□倍」。長さ${k}倍＝${Math.sqrt(k)}²倍なので周期は${Math.sqrt(k)}倍。${p}×${Math.sqrt(k)}＝${np}秒です。`, grade: 6, difficulty: 4, svg: figPendulum() });
});

// ② 音の高さ（光と音・ho）
addTo('rika_hikarioto', 'ho', { question: 'ギターの弦を強く張ったり、短くおさえたりすると、音の高さはどうなりますか？', answer: '高くなる', choices: ['高くなる', '低くなる', '変わらない', '消える'], meaning: '弦は「短い・細い・強く張る」ほど速くふるえて高い音になります。逆に長い・太い・ゆるいと低い音です。', grade: 5, difficulty: 2, svg: figStringSound() });
addTo('rika_hikarioto', 'ho', { question: '太鼓の皮を強く張ると、たたいたときの音の高さはどうなりますか？', answer: '高くなる', choices: ['高くなる', '低くなる', '変わらない', '音が出ない'], meaning: '皮を強く張るほど速くふるえて高い音に。ゆるいと低い音になります。大きい太鼓ほど低い音が出ます。', grade: 5, difficulty: 2, svg: figStringSound() });
addTo('rika_hikarioto', 'ho', { question: '音の「大きさ」と「高さ」。強くはじいたときに変わるのはどちらですか？', answer: '大きさ（ふるえのはば）', choices: ['大きさ（ふるえのはば）', '高さ', '両方とも高さ', '速さ'], meaning: '強くはじく＝ふるえのはばが大きい＝大きい音。高さ（高い・低い）はふるえの速さ（回数）で決まり、弦の長さや張り方で変わります。', grade: 5, difficulty: 3, svg: figStringSound() });

// ③ 方位磁針（もの・rm）
addTo('rika_mono', 'rm', { question: '方位磁針（ほういじしん）の色のついた針（N極）は、いつもどの方角をさしますか？', answer: '北', choices: ['北', '南', '東', '西'], meaning: '磁石のN極は北をさします。これは地球全体が大きな磁石になっているためです。', grade: 3, difficulty: 2, svg: figCompass() });
addTo('rika_mono', 'rm', { question: '方位磁針のN極が北をさすということは、地球の北極の近くには磁石の何極があると考えられますか？', answer: 'S極', choices: ['S極', 'N極', 'どちらもない', '両方'], meaning: '磁石はちがう極どうしが引き合います。N極が北に引かれるので、地球の北極近くには「S極」があると考えられます。', grade: 5, difficulty: 3, svg: figCompass() });

// ④ 遠くの音（光と音・ho）
addTo('rika_hikarioto', 'ho', { question: '昼より夜、また晴れより雨や雪の日に、遠くの音がよく聞こえるように感じるのはなぜですか？', answer: '音が上へにげにくく、遠くまで伝わりやすいから', choices: ['音が上へにげにくく、遠くまで伝わりやすいから', '音が速くなるから', '耳がよくなるから', '音が大きくなるから'], meaning: '夜や雨の日は、上空より地面近くの空気が冷えていることが多く、音が上へにげずに地面ぞいに遠くまで伝わりやすくなります。まわりが静かなことも理由です。', grade: 6, difficulty: 3, svg: figFarSound() });

// ⑤ ホースの勢い（もの・rm）
addTo('rika_mono', 'rm', { question: '水を出しているホースの先を指でつまんで細くすると、出てくる水の勢い（速さ）はどうなりますか？', answer: '強く（速く）なる', choices: ['強く（速く）なる', '弱くなる', '変わらない', '止まる'], meaning: '同じ量の水がせまい所を通るとき、水は速く流れます。だから先を細くすると勢いよく遠くまで飛びます（洗車やそうじで使うワザ）。', grade: 5, difficulty: 3, svg: figHose() });

console.log('身近な現象 第5弾（振り子・音の高さ・方位磁針・遠くの音・ホース）を追加しました。');
