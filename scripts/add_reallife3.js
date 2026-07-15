// 身近な現象 第3弾：①虹のしくみ ②シーソーで体重当て ③太陽の南中高度と季節 ④電池と豆電球。
// 図つき・数値は文字列保存・答えはコード検算。
const fs = require('fs');
const path = require('path');
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', OR = '#ffa94d', PU = '#b39ddb', GR = '#9aa5c8', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// ① 虹（外側が赤）
function figRainbow() {
  const cx = 120, cy = 110, cols = ['#ff5b5b', '#ffa94d', '#ffd166', '#38d9a9', '#4f9eff', '#5b6ee0', '#b39ddb'];
  let body = `<circle cx="200" cy="18" r="11" fill="${YE}"/>` + txt(200, 36, '太陽', YE, 8);
  cols.forEach((c, i) => { const r = 92 - i * 9; body += `<path d="M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${c}" stroke-width="6"/>`; });
  // 雨つぶ
  for (const [x, y] of [[60, 96], [90, 104], [150, 100], [40, 80]]) body += `<line x1="${x}" y1="${y}" x2="${x - 2}" y2="${y + 6}" stroke="${BL}" stroke-width="1.4"/>`;
  body += txt(cx, 40, '外側が赤', RD, 9);
  return S('240 118', body);
}
// ② シーソー（体重当て）
function figSeesaw(wL, dL, wR, dR, unknownRight) {
  const cx = 118, beamY = 58, scale = 30;
  const xL = cx - dL * scale, xR = cx + dR * scale;
  let body = `<polygon points="${cx - 12},72 ${cx + 12},72 ${cx},${beamY}" fill="${WT}" opacity="0.55"/>` +
    `<line x1="20" y1="${beamY}" x2="216" y2="${beamY}" stroke="${WT}" stroke-width="3"/>`;
  body += `<rect x="${xL - 12}" y="${beamY - 24}" width="24" height="22" fill="${BL}" opacity="0.6" stroke="${BL}"/>` + txt(xL, beamY - 9, wL + 'kg', '#fff', 9) + txt(xL, beamY + 14, dL + 'm', BL, 9);
  body += `<rect x="${xR - 12}" y="${beamY - 24}" width="24" height="22" fill="${PK}" opacity="0.6" stroke="${PK}"/>` + txt(xR, beamY - 9, unknownRight ? '?kg' : wR + 'kg', '#fff', 9) + txt(xR, beamY + 14, dR + 'm', PK, 9);
  body += txt(cx, beamY - 12, '支点', YE, 8);
  return S('240 84', body);
}
// ③ 南中高度（夏は高く冬は低い）
function figSunHeight() {
  const ox = 40, oy = 92;
  let body = `<line x1="${ox}" y1="${oy}" x2="220" y2="${oy}" stroke="${WT}" stroke-width="1.5"/>` + txt(30, oy + 4, '南', WT, 9);
  // 夏（高い）
  body += `<line x1="${ox}" y1="${oy}" x2="150" y2="26" stroke="${YE}" stroke-width="1" stroke-dasharray="3 2"/><circle cx="150" cy="26" r="8" fill="${YE}"/>` + txt(165, 26, '夏（高い）', YE, 9, 'start');
  // 冬（低い）
  body += `<line x1="${ox}" y1="${oy}" x2="180" y2="66" stroke="${OR}" stroke-width="1" stroke-dasharray="3 2"/><circle cx="180" cy="66" r="7" fill="${OR}"/>` + txt(196, 70, '冬（低い）', OR, 9, 'start');
  body += `<path d="M${ox + 22} ${oy} A22 22 0 0 0 ${ox + 15} ${oy - 16}" fill="none" stroke="${WT}" stroke-width="1"/>` + txt(ox + 30, oy - 8, '南中高度', WT, 8, 'start');
  return S('240 104', body);
}
// ④ 電池と豆電球
function figCircuit(kind) {
  // 電池記号（縦置き、y中心）：長い線＝＋、短い線＝−
  const battH = (x, y) => `<line x1="${x - 4}" y1="${y - 9}" x2="${x - 4}" y2="${y + 9}" stroke="${WT}" stroke-width="3"/><line x1="${x + 4}" y1="${y - 5}" x2="${x + 4}" y2="${y + 5}" stroke="${WT}" stroke-width="1.5"/>`;
  const bulb = (x, y) => `<circle cx="${x}" cy="${y}" r="11" fill="${YE}" opacity="0.5" stroke="${YE}" stroke-width="1.5"/><line x1="${x - 7}" y1="${y - 7}" x2="${x + 7}" y2="${y + 7}" stroke="${YE}" stroke-width="1.2"/><line x1="${x + 7}" y1="${y - 7}" x2="${x - 7}" y2="${y + 7}" stroke="${YE}" stroke-width="1.2"/>`;
  const loop = `<rect x="34" y="28" width="150" height="66" rx="6" fill="none" stroke="${GN}" stroke-width="2"/>`;
  let body = loop, label = '';
  if (kind === 'series') { body += battH(80, 94) + battH(110, 94) + bulb(184, 61); label = '電池2個 直列'; }
  else if (kind === 'parallel') { body += battH(80, 46) + battH(80, 76) + `<line x1="80" y1="37" x2="80" y2="28" stroke="${WT}" stroke-width="1.5"/>` + bulb(184, 61); label = '電池2個 並列'; }
  else if (kind === 'bulbs') { body += battH(90, 94) + bulb(150, 28) + bulb(184, 61); label = '豆電球2個'; }
  else { body += battH(90, 94) + bulb(184, 61); label = '電池1個'; }
  body += txt(105, 78, label, GN, 9);
  return S('210 110', body);
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

// ① 虹（光と音・ho）
[['雨あがりに虹が見えるのは、空気中の何が太陽の光を分けるからですか？', '水てき（雨つぶ）', ['水てき（雨つぶ）', 'ほこり', '雲', '風'], '空気中に残った小さな水てき（雨つぶ）が、太陽の光を色ごとに分ける（分光する）ことで虹ができます。'],
['虹の色で、いちばん外側（上）に見えるのは何色ですか？', '赤', ['赤', '紫', '緑', '青'], '虹は外側から赤・橙・黄・緑・青・藍・紫の順。いちばん外が赤、いちばん内が紫です。'],
['虹を見るとき、太陽はどの方向にありますか？', '自分の後ろ（背中側）', ['自分の後ろ（背中側）', '正面', '真上', '足もと'], '太陽を背にして、正面の雨つぶを見ると虹が見えます。だから朝は西の空、夕方は東の空に出やすいのです。']].forEach(([q, a, c, m]) =>
  addTo('rika_hikarioto', 'ho', { question: q, answer: a, choices: c, meaning: m, grade: 5, difficulty: 3, svg: figRainbow() }));

// ② シーソー体重当て（力・rc）: W2 = W1*d1/d2
[[60, 1, 3], [40, 2, 4], [50, 3, 5], [45, 2, 3], [48, 5, 4], [30, 4, 2]].forEach(([wL, dL, dR]) => {
  const wR = wL * dL / dR;
  if (!Number.isInteger(wR)) return;
  addTo('rika_chikara', 'rc', { question: `シーソーで、体重${wL}kgのお父さんが支点から${dL}mのところ、きみが支点から${dR}mのところにすわると、ちょうどつり合いました。きみの体重は何kgですか？`, answer: wR, choices: ch(wR, [wL, wL * dL, dR, wR + 5]), meaning: `つり合い：おもさ×支点からの長さが左右で等しい。${wL}×${dL}＝□×${dR} より □＝${wL * dL}÷${dR}＝${wR}kg。シーソーで体重が当てられる！`, grade: 5, difficulty: 3, svg: figSeesaw(wL, dL, wR, dR, true) });
});

// ③ 南中高度と季節（天体・rk）
[['太陽が真南に来て一番高くなることを南中といいます。1年で南中高度がいちばん高い季節はいつですか？', '夏', ['夏', '冬', '春', '秋'], '夏（夏至のころ）は太陽の通り道が高く、南中高度が最大。だから昼が長く、暑くなります。冬はその逆です。'],
['冬の太陽の南中高度は、夏と比べてどうなっていますか？', '低い', ['低い', '高い', '同じ', 'ない'], '冬は南中高度が低く、太陽の光がななめから当たるので、昼が短く寒くなります。'],
['同じ日でも、北へ行くほど太陽の南中高度はどうなりますか？', '低くなる', ['低くなる', '高くなる', '変わらない', '0になる'], '北へ（緯度が高いほど）行くほど太陽は低くなります。だから北の地方は寒くなりやすいのです。']].forEach(([q, a, c, m]) =>
  addTo('rika_sora', 'rk', { question: q, answer: a, choices: c, meaning: m, grade: 5, difficulty: 3, svg: figSunHeight() }));
// 南中高度の計算（春分・秋分＝90－緯度）
[[35], [30], [40], [36], [26], [45]].forEach(([lat]) => {
  const h = 90 - lat;
  addTo('rika_sora', 'rk', { question: `春分・秋分の日、北緯${lat}度の地点での太陽の南中高度は何度ですか？（南中高度＝90－緯度で求められます）`, answer: h, choices: ch(h, [lat, 90, h - 10, 90 + lat]), meaning: `春分・秋分は「90－緯度」。90－${lat}＝${h}度です。`, grade: 6, difficulty: 3, svg: figSunHeight() });
});

// ④ 電池と豆電球（電気・rd）
[['かん電池2個を直列につないで豆電球1個を光らせると、電池1個のときと比べて明るさはどうなりますか？', '明るくなる', ['明るくなる', '暗くなる', '変わらない', '消える'], '直列つなぎは電圧が2倍になるので、豆電球は明るくなります（ただし電池は早く消耗します）。', 'series'],
['かん電池2個を並列につないで豆電球1個を光らせると、電池1個のときと比べて明るさはどうなりますか？', 'ほとんど変わらない', ['ほとんど変わらない', '2倍明るい', '暗くなる', '消える'], '並列つなぎは電圧が1個ぶんのままなので明るさは変わりませんが、電池が長もちします。', 'parallel'],
['豆電球2個を直列につなぐと、豆電球1個のときと比べて明るさはどうなりますか？', '暗くなる', ['暗くなる', '明るくなる', '変わらない', '消える'], '豆電球を直列にすると1個あたりにかかる電圧が減るので、それぞれ暗くなります。', 'bulbs'],
['豆電球2個を並列につなぐと、それぞれの明るさは豆電球1個のときと比べてどうなりますか？', '変わらない', ['変わらない', '暗くなる', '明るくなる', '消える'], '並列だとどちらの豆電球にも電池ぜんぶの電圧がかかるので、明るさは1個のときと変わりません。', 'bulbs']].forEach(([q, a, c, m, kind]) =>
  addTo('rika_denki', 'rd', { question: q, answer: a, choices: c, meaning: m, grade: 5, difficulty: 3, svg: figCircuit(kind) }));

console.log('身近な現象 第3弾（虹・シーソー体重当て・南中高度・電池と豆電球）を追加しました。');
