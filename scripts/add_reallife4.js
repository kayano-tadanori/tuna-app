// 身近な現象 第4弾：①鏡で全身を映す ②昼に見える月／満月の南中 ③氷入りコップの水位
// ④上皿てんびんと分銅 ⑤影で木の高さを測る。図つき・数値は文字列・答えはコード検算。
const fs = require('fs');
const path = require('path');
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', OR = '#ffa94d', BR = '#c9975b', GR = '#9aa5c8', WT = '#cdd6f4', SEA = '#2a6fd6';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// ① 鏡（全身を映すには身長の半分）
function figMirror() {
  const py = 96;
  let body = `<circle cx="70" cy="26" r="7" fill="${YE}"/><line x1="70" y1="33" x2="70" y2="${py - 14}" stroke="${YE}" stroke-width="3"/><line x1="70" y1="44" x2="58" y2="60" stroke="${YE}" stroke-width="2"/><line x1="70" y1="44" x2="82" y2="60" stroke="${YE}" stroke-width="2"/><line x1="70" y1="${py - 14}" x2="60" y2="${py}" stroke="${YE}" stroke-width="2"/><line x1="70" y1="${py - 14}" x2="80" y2="${py}" stroke="${YE}" stroke-width="2"/>`;
  body += txt(50, 60, '身長', YE, 9, 'end');
  // 鏡（上半分だけ＝身長の半分）
  body += `<rect x="150" y="26" width="10" height="${(py - 26) / 2}" fill="${BL}" opacity="0.5" stroke="${BL}" stroke-width="1.5"/>` + txt(178, 40, '鏡', BL, 10);
  body += `<line x1="160" y1="${26 + (py - 26) / 2}" x2="200" y2="${26 + (py - 26) / 2}" stroke="${WT}" stroke-width="0.6" stroke-dasharray="2 2"/>` + txt(186, 62, '身長の半分', WT, 8, 'start');
  // 全身の映り
  body += `<line x1="70" y1="26" x2="155" y2="40" stroke="${WT}" stroke-width="0.6" opacity="0.5"/><line x1="70" y1="${py}" x2="155" y2="60" stroke="${WT}" stroke-width="0.6" opacity="0.5"/>`;
  return S('220 108', body);
}
// ② 昼の月（空に太陽と月）
function figDayMoon() {
  let body = `<rect x="0" y="0" width="240" height="72" fill="${SEA}" opacity="0.18"/>`;
  body += `<circle cx="60" cy="30" r="14" fill="${YE}"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return `<line x1="${(60 + 18 * Math.cos(r)).toFixed(0)}" y1="${(30 + 18 * Math.sin(r)).toFixed(0)}" x2="${(60 + 24 * Math.cos(r)).toFixed(0)}" y2="${(30 + 24 * Math.sin(r)).toFixed(0)}" stroke="${YE}" stroke-width="1.5"/>`; }).join('') + txt(60, 58, '太陽', YE, 9);
  body += `<circle cx="175" cy="34" r="13" fill="${WT}" opacity="0.55"/><circle cx="170" cy="30" r="11" fill="${SEA}" opacity="0.18"/>` + txt(175, 58, '月（昼でも見える）', WT, 9);
  return S('240 78', body);
}
// ③ 氷入りコップ（とけても水位は変わらない）
function figIceCup() {
  const gx = 80, gw = 80, top = 24, by = 100, wl = 40;
  let body = `<path d="M${gx} ${top} v${by - top} h${gw} v${-(by - top)}" fill="none" stroke="${WT}" stroke-width="2"/>`;
  body += `<rect x="${gx}" y="${wl}" width="${gw}" height="${by - wl}" fill="${SEA}" opacity="0.35"/>`;
  body += `<line x1="${gx - 6}" y1="${wl}" x2="${gx + gw + 6}" y2="${wl}" stroke="${YE}" stroke-width="1.5"/>` + txt(gx + gw + 10, wl + 4, '水位', YE, 9, 'start');
  // 氷（浮いている）
  body += `<rect x="${gx + 14}" y="${wl - 12}" width="22" height="22" fill="${BL}" opacity="0.5" stroke="${WT}"/><rect x="${gx + 42}" y="${wl - 8}" width="18" height="18" fill="${BL}" opacity="0.5" stroke="${WT}"/>` + txt(gx + gw / 2, top - 4, '氷が浮いている', WT, 9);
  return S('240 112', body);
}
// ④ 上皿てんびん
function figBalance() {
  const cx = 120, top = 34;
  let body = `<polygon points="${cx - 14},92 ${cx + 14},92 ${cx},62 " fill="${WT}" opacity="0.5"/>` +
    `<line x1="${cx}" y1="62" x2="${cx}" y2="${top}" stroke="${WT}" stroke-width="2"/>` +
    `<line x1="${cx - 60}" y1="${top}" x2="${cx + 60}" y2="${top}" stroke="${WT}" stroke-width="2.5"/>`;
  body += `<line x1="${cx - 60}" y1="${top}" x2="${cx - 60}" y2="52" stroke="${WT}"/><path d="M${cx - 78} 52 a18 9 0 0 0 36 0 Z" fill="${YE}" opacity="0.4" stroke="${YE}"/>` + txt(cx - 60, 74, '品物', YE, 9);
  body += `<line x1="${cx + 60}" y1="${top}" x2="${cx + 60}" y2="52" stroke="${WT}"/><path d="M${cx + 42} 52 a18 9 0 0 0 36 0 Z" fill="${BL}" opacity="0.4" stroke="${BL}"/>` + txt(cx + 60, 74, '分銅', BL, 9);
  return S('240 100', body);
}
// ⑤ 影で木の高さ
function figTreeShadow(hStick, sStick, sTree) {
  const gy = 96;
  let body = `<line x1="10" y1="${gy}" x2="230" y2="${gy}" stroke="${WT}" stroke-width="1.5"/>`;
  body += `<circle cx="210" cy="20" r="9" fill="${YE}"/>`;
  // 棒
  body += `<line x1="50" y1="${gy}" x2="50" y2="${gy - 22}" stroke="${BR}" stroke-width="3"/>` + txt(40, gy - 10, '棒', BR, 9, 'end') + `<polygon points="50,${gy} 80,${gy} 50,${gy - 1}" fill="#20263f" stroke="${WT}" stroke-width="0.6"/>` + txt(65, gy + 12, `${sStick}m`, GR, 8);
  // 木
  body += `<line x1="140" y1="${gy}" x2="140" y2="${gy - 46}" stroke="${GN}" stroke-width="4"/><circle cx="140" cy="${gy - 50}" r="10" fill="${GN}" opacity="0.5"/>` + txt(140, gy - 62, '木 ?m', GN, 9) + `<polygon points="140,${gy} 200,${gy} 140,${gy - 1}" fill="#20263f" stroke="${WT}" stroke-width="0.6"/>` + txt(170, gy + 12, `${sTree}m`, GR, 8);
  return S('240 112', body);
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

// ① 鏡（光と音・ho）
addTo('rika_hikarioto', 'ho', { question: '鏡に自分をうつすと、上げた右手は鏡の中では左右どうなって見えますか？', answer: '左右が反対（左手を上げているように見える）', choices: ['左右が反対（左手を上げているように見える）', 'そのまま右手', '上下が反対', '見えない'], meaning: '鏡は左右が反対にうつります（上下はそのまま）。救急車の前に「救急」を左右反対に書くのは、前の車のミラーで正しく読めるようにするためです。', grade: 5, difficulty: 2, svg: figMirror() });
[[160], [150], [140], [170], [120], [180]].forEach(([H]) => {
  const mir = H / 2;
  addTo('rika_hikarioto', 'ho', { question: `身長${H}cmの人が、かべにかけた鏡で頭からつま先まで全身をうつすには、鏡のたての長さは少なくとも何cm必要ですか？`, answer: mir, choices: ch(mir, [H, H / 4, mir + 10, H - 10]), meaning: `全身をうつすのに必要な鏡の長さは、身長の半分でよい（光の反射のきまり）。${H}÷2＝${mir}cm。鏡に近づいても遠ざかっても必要な長さは同じです。`, grade: 6, difficulty: 3, svg: figMirror() });
});

// ② 昼の月・満月の南中（天体・rk）
[['昼の空に、うすく白い月が見えることがあります。これはなぜですか？', '月は太陽の光を反射していて、昼でも空にあれば見えるから', ['月は太陽の光を反射していて、昼でも空にあれば見えるから', '月が自分で光っているから', '星だから', '雲だから'], '月は自分で光らず太陽の光を反射しています。昼間でも月が空の上にあれば、うすく見えることがあります。'],
['満月が真南に一番高く見える（南中する）のは、だいたい何時ごろですか？', '真夜中（0時ごろ）', ['真夜中（0時ごろ）', '正午', '夕方', '明け方'], '満月は太陽と反対側にあるので、太陽が真下（真夜中）のときに真南で一番高く見えます。夕方に東からのぼり、朝に西へしずみます。'],
['夕方、西の空に見える細い月（三日月）。この月の光っている side はどちら側ですか？', '太陽のある西（右）側', ['太陽のある西（右）側', '東（左）側', '真下', '真上'], '月の光る側はいつも太陽のある方向。夕方の三日月は西の低い太陽の側（右下）が光ります。']].forEach(([q, a, c, m]) =>
  addTo('rika_sora', 'rk', { question: q.replace(' side ', ''), answer: a, choices: c, meaning: m, grade: 5, difficulty: 3, svg: figDayMoon() }));

// ③ 氷入りコップの水位（もの・rm。トリビア）
addTo('rika_mono', 'rm', { question: '【へぇ！】氷を浮かべたコップの水。氷がすっかりとけると、水面（水位）はどうなりますか？', answer: '変わらない', choices: ['変わらない', '上がってあふれる', '下がる', '半分になる'], meaning: '浮いている氷は、自分がおしのけた水の重さぶんだけ水面から出ています。とけて水になるとちょうどその体積ぶんになるので、水位は変わりません（北極の氷がとけても海面はほぼ上がらないのと同じ）。', grade: 6, difficulty: 3, svg: figIceCup() });
addTo('rika_mono', 'rm', { question: '水にうかべた船の上に石をのせています。この石を船から水の中へ落とすと、水面（水位）はどうなりますか？', answer: '下がる', choices: ['下がる', '上がる', '変わらない', 'あふれる'], meaning: '船にのせているときは石の「重さ」ぶんの水をおしのけますが、しずめると石の「体積」ぶんしかおしのけません。石は重い割に体積が小さいので、水位は下がります。', grade: 6, difficulty: 4, svg: figIceCup() });

// ④ 上皿てんびん（力・rc）
addTo('rika_chikara', 'rc', { question: '上皿てんびんで品物の重さを量るとき、分銅はふつうどの順で皿にのせますか？', answer: '重い分銅から順にためす', choices: ['重い分銅から順にためす', '軽い分銅から順に', 'どれでもよい', '全部いっぺんに'], meaning: '重い分銅からのせ、重すぎたら次に軽いものに変える…とためすと、少ない回数で早く量れます。分銅は手ではなくピンセットで持ちます。', grade: 4, difficulty: 3, svg: figBalance() });
addTo('rika_chikara', 'rc', { question: '上皿てんびんがつり合って止まったとき、品物の重さは何と等しいですか？', answer: 'のせた分銅の重さの合計', choices: ['のせた分銅の重さの合計', '皿の重さ', '分銅の数', 'てんびんの長さ'], meaning: 'てんびんは左右のうでの長さが同じ。つり合ったとき、品物の重さ＝反対の皿にのせた分銅の重さの合計、とわかります。', grade: 4, difficulty: 2, svg: figBalance() });

// ⑤ 影で木の高さを測る（相似・比）: sansu_zu
[[1, 2, 10], [2, 3, 9], [1, 3, 12], [3, 2, 8], [1, 4, 20], [2, 5, 15]].forEach(([hS, sS, sT]) => {
  const hT = hS * sT / sS;
  if (!Number.isInteger(hT)) return;
  addTo('sansu_zu', 'sz', { question: `よく晴れた日の同じ時こく、長さ${hS}mの棒の影が${sS}mでした。同じとき、木の影は${sT}mでした。木の高さは何mですか？`, answer: hT, choices: ch(hT, [sT, hS * sT, sT - sS, hT + 2]), meaning: `同じ時こくは「高さ：影の長さ」の比が同じ。棒は${hS}：${sS}。木は□：${sT}なので、□＝${hS}×${sT}÷${sS}＝${hT}m。影を使えば高い木の高さが計れる！`, grade: 6, difficulty: 3, svg: figTreeShadow(hS, sS, sT) });
});

console.log('身近な現象 第4弾（鏡・昼の月・氷入りコップ・上皿てんびん・影で木の高さ）を追加しました。');
