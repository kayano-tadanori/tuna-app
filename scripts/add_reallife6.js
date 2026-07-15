// 身近な現象 第6弾：①ペットボトルロケット（作用反作用）②結露（くもる眼鏡）③坂道のボール
// ④太陽電池 ⑤てこの種類（はさみ・ピンセット）⑥地震P波S波で震源までの距離（計算）。
const fs = require('fs');
const path = require('path');
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', OR = '#ffa94d', BR = '#c9975b', GR = '#9aa5c8', WT = '#cdd6f4', SEA = '#2a6fd6';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// ① ペットボトルロケット
function figRocket() {
  const rx = 120;
  let body = `<path d="M${rx} 14 q10 6 10 22 v30 h-20 v-30 q0 -16 10 -22 Z" fill="${BL}" opacity="0.5" stroke="${BL}" stroke-width="1.5"/>`;
  body += `<polygon points="${rx - 10},66 ${rx - 20},80 ${rx - 10},76" fill="${BL}"/><polygon points="${rx + 10},66 ${rx + 20},80 ${rx + 10},76" fill="${BL}"/>`;
  body += `<line x1="${rx}" y1="14" x2="${rx}" y2="4" stroke="${YE}" stroke-width="2"/><polygon points="${rx},2 ${rx - 4},10 ${rx + 4},10" fill="${YE}"/>` + txt(rx + 26, 30, 'ロケットは上へ', YE, 9, 'start');
  // 水が下へ噴射
  [0, 1, 2, 3].forEach(i => body += `<circle cx="${rx + (i % 2 ? 5 : -5)}" cy="${82 + i * 8}" r="${3 - i * 0.4}" fill="${SEA}"/>`);
  body += `<line x1="${rx}" y1="80" x2="${rx}" y2="108" stroke="${SEA}" stroke-width="2" stroke-dasharray="2 2"/>` + txt(rx - 26, 100, '水を下へ', SEA, 9, 'end');
  return S('240 116', body);
}
// ② 結露（冷たいコップに水てき）
function figCondensation() {
  const gx = 90, gw = 60, top = 24, by = 100;
  let body = `<path d="M${gx} ${top} v${by - top} h${gw} v${-(by - top)}" fill="none" stroke="${WT}" stroke-width="2"/>` + `<rect x="${gx}" y="${top + 8}" width="${gw}" height="${by - top - 8}" fill="${SEA}" opacity="0.35"/>` + txt(gx + gw / 2, top - 4, '冷たい飲み物', WT, 9);
  for (const [x, y] of [[gx - 6, 44], [gx - 4, 62], [gx - 7, 80], [gx + gw + 4, 50], [gx + gw + 6, 70], [gx + gw + 3, 86]]) body += `<circle cx="${x}" cy="${y}" r="3" fill="${BL}" opacity="0.8"/>`;
  body += txt(gx + gw + 12, 60, '水てき（結露）', BL, 9, 'start');
  return S('240 112', body);
}
// ③ 坂道のボール
function figSlope() {
  let body = `<line x1="20" y1="96" x2="220" y2="96" stroke="${WT}" stroke-width="1.5"/>`;
  body += `<polygon points="30,96 170,96 30,36" fill="${WT}" opacity="0.15" stroke="${WT}" stroke-width="1.5"/>`;
  body += `<circle cx="70" cy="60" r="10" fill="${RD}" opacity="0.7"/>` + `<polygon points="82,66 100,78 84,74" fill="${RD}"/>` + txt(120, 62, '急な坂ほど速い', WT, 9, 'start');
  return S('240 108', body);
}
// ④ 太陽電池
function figSolar() {
  let body = `<circle cx="42" cy="30" r="12" fill="${YE}"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180; return `<line x1="${(42 + 16 * Math.cos(r)).toFixed(0)}" y1="${(30 + 16 * Math.sin(r)).toFixed(0)}" x2="${(42 + 22 * Math.cos(r)).toFixed(0)}" y2="${(30 + 22 * Math.sin(r)).toFixed(0)}" stroke="${YE}" stroke-width="1.5"/>`; }).join('') + txt(42, 60, '太陽の光', YE, 8);
  body += `<rect x="90" y="40" width="60" height="34" fill="${BL}" opacity="0.4" stroke="${BL}" stroke-width="1.5"/>`;
  for (let i = 1; i < 4; i++) body += `<line x1="${90 + i * 15}" y1="40" x2="${90 + i * 15}" y2="74" stroke="${BL}" stroke-width="0.6"/>`;
  body += txt(120, 88, '太陽電池', BL, 9);
  body += `<line x1="60" y1="34" x2="90" y2="52" stroke="${YE}" stroke-width="1" stroke-dasharray="3 2"/>`;
  body += `<polygon points="152,57 180,57 175,50 190,60 175,70 180,63 152,63" fill="${GN}"/>` + txt(200, 62, '電気', GN, 9, 'start');
  return S('240 96', body);
}
// ⑤ てこ（支点・力点・作用点）
function figLever() {
  const y = 56, fx = 150;
  let body = `<line x1="30" y1="${y}" x2="200" y2="${y}" stroke="${WT}" stroke-width="3"/>`;
  body += `<polygon points="${fx - 10},${y + 24} ${fx + 10},${y + 24} ${fx},${y}" fill="${YE}" opacity="0.6"/>` + txt(fx, y + 38, '支点', YE, 9);
  body += `<line x1="45" y1="${y}" x2="45" y2="${y - 16}" stroke="${RD}" stroke-width="2"/><polygon points="45,${y - 18} 41,${y - 10} 49,${y - 10}" fill="${RD}"/>` + txt(45, y - 22, '力点', RD, 9);
  body += `<rect x="182" y="${y + 2}" width="16" height="14" fill="${BL}" opacity="0.6" stroke="${BL}"/>` + txt(190, y + 30, '作用点', BL, 9);
  return S('240 100', body);
}
// ⑥ 地震のP波S波（地震計の記録）
function figSeismo() {
  const y = 46, x0 = 20, pStart = 70, sStart = 140;
  let body = `<line x1="${x0}" y1="${y}" x2="${x0}" y2="${y}" />`;
  // 基線＋波形
  let d = `M${x0} ${y} L${pStart} ${y}`;
  for (let x = pStart; x < sStart; x += 6) d += ` L${x + 3} ${y - 5} L${x + 6} ${y + 5}`;
  for (let x = sStart; x < 226; x += 6) d += ` L${x + 3} ${y - 15} L${x + 6} ${y + 15}`;
  body += `<path d="${d}" fill="none" stroke="${BL}" stroke-width="1.5"/>`;
  body += `<line x1="${pStart}" y1="18" x2="${pStart}" y2="${y + 18}" stroke="${GN}" stroke-width="1" stroke-dasharray="2 2"/>` + txt(pStart, 14, 'P波', GN, 8);
  body += `<line x1="${sStart}" y1="18" x2="${sStart}" y2="${y + 22}" stroke="${RD}" stroke-width="1" stroke-dasharray="2 2"/>` + txt(sStart, 14, 'S波', RD, 8);
  body += `<line x1="${pStart}" y1="${y + 26}" x2="${sStart}" y2="${y + 26}" stroke="${YE}" stroke-width="1"/>` + txt((pStart + sStart) / 2, y + 38, '初期微動継続時間', YE, 8);
  return S('240 94', body);
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

// ① ペットボトルロケット（力・rc）
addTo('rika_chikara', 'rc', { question: 'ペットボトルロケットが空へ飛ぶのは、中の水や空気を勢いよくどちらへ出すからですか？', answer: '下（後ろ）へ出すから', choices: ['下（後ろ）へ出すから', '上へ出すから', '横へ出すから', '水を吸うから'], meaning: '水を下へ勢いよく出すと、その反対に上へおし返す力（反作用）がはたらいてロケットが飛びます。ロケットや風船が飛ぶのも同じしくみです。', grade: 5, difficulty: 3, svg: figRocket() });

// ② 結露（天気・tk）
addTo('rika_tenki', 'tk', { question: '冷たい飲み物を入れたコップの外側に水てきがつくのはなぜですか？', answer: '空気中の水じょう気が冷やされて水になるから', choices: ['空気中の水じょう気が冷やされて水になるから', 'コップから水がしみ出るから', '氷がとけるから', '水がわくから'], meaning: '空気中の目に見えない水じょう気が、冷たいコップに冷やされて水てきに変わります。これを「結露」といいます。冬に窓がくもるのも同じです。', grade: 5, difficulty: 3, svg: figCondensation() });
addTo('rika_tenki', 'tk', { question: '寒い部屋に入ったとき、あたたかい所からかけていた眼鏡がくもるのはなぜですか？', answer: '空気中の水じょう気がレンズで冷やされて水てきになるから', choices: ['空気中の水じょう気がレンズで冷やされて水てきになるから', '目のあせ', '光のせい', 'レンズがとける'], meaning: '冷たいレンズの表面で、まわりの水じょう気が冷えて細かい水てき（結露）になり、白くくもります。', grade: 5, difficulty: 2, svg: figCondensation() });

// ③ 坂道のボール（力・rc）
addTo('rika_chikara', 'rc', { question: 'ボールを坂道の上から転がします。坂のかたむきが急なほど、ボールの速さのふえ方はどうなりますか？', answer: '急なほど速くふえる', choices: ['急なほど速くふえる', 'ゆるいほど速くふえる', 'かたむきと関係ない', '止まる'], meaning: '坂が急なほど、下向きにはたらく力が大きくなり、ボールはより速くなっていきます。ジェットコースターが急な坂で加速するのと同じです。', grade: 5, difficulty: 2, svg: figSlope() });

// ④ 太陽電池（電気・rd）
addTo('rika_denki', 'rd', { question: '太陽電池（ソーラーパネル）は、太陽の光を何に変える装置ですか？', answer: '電気', choices: ['電気', '熱だけ', '水', '風'], meaning: '太陽電池は光のエネルギーを直接「電気」に変えます。電たくや屋根のソーラーパネル、人工衛星などに使われています。', grade: 5, difficulty: 2, svg: figSolar() });

// ⑤ てこの種類（力・rc）
addTo('rika_chikara', 'rc', { question: 'てこには「支点・力点・作用点」の3つがあります。はさみやペンチのように、まん中に支点があるてこで、真ん中にあるのはどれですか？', answer: '支点', choices: ['支点', '力点', '作用点', '重心'], meaning: 'はさみは真ん中がねじ（支点）、持つ所が力点、切る所が作用点。支点が真ん中にあるてこです。', grade: 6, difficulty: 3, svg: figLever() });
addTo('rika_chikara', 'rc', { question: 'ピンセットや和ばさみのように、小さな力で細かく動かすのに向いた道具では、力点・支点・作用点はどの順にならんでいますか？', answer: '支点・作用点・力点（力点が外側）', choices: ['支点・作用点・力点（力点が外側）', '力点・支点・作用点', '支点・力点・作用点', '全部同じ場所'], meaning: 'ピンセットは、はしに支点、真ん中に作用点、持つ所（外）が力点。力は大きくいるけれど、細かく正確に動かせます。', grade: 6, difficulty: 4, svg: figLever() });

// ⑥ 地震P波S波で震源までの距離（大地・rg）P波8km/s・S波4km/s → 初期微動継続時間 = d/8
[[10], [15], [5], [20], [8], [12]].forEach(([T]) => {
  const d = 8 * T; // d/4 - d/8 = d/8 = T → d = 8T
  addTo('rika_daichi', 'rg', { question: `ある地震で、P波は秒速8km、S波は秒速4kmで伝わりました。ある地点で初期微動（P波が来てからS波が来るまでのゆれ）が${T}秒続きました。この地点から震源までの距離は何kmですか？`, answer: d, choices: ch(d, [T, T * 4, d + 40, T * 12]), meaning: `初期微動継続時間＝S波の到達時間－P波の到達時間＝距離÷4－距離÷8＝距離÷8。${T}＝距離÷8 より距離＝${T}×8＝${d}km。初期微動が長いほど震源は遠い！`, grade: 6, difficulty: 4, svg: figSeismo() });
});

console.log('身近な現象 第6弾（ロケット・結露・坂道・太陽電池・てこ・地震P波S波）を追加しました。');
