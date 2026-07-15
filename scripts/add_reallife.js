// 身近な現象を考える／計算する問題を、いろんな単元にまとめて追加。
// ①光の屈折（プール・ストロー）②てこ・シーソー ③標高と気温 ④影・日時計 ⑤ピザの割合。
// すべて図つき。理科の計算はテンキー数値、概念は選択。答えはコード検算。
const fs = require('fs');
const path = require('path');
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', OR = '#ffa94d', BR = '#c9975b', WT = '#cdd6f4', SEA = '#2a6fd6';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 10, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// ① 屈折：プールに入れたストローが水面で曲がって見える
function figRefraction() {
  const wy = 42;
  let body = `<rect x="20" y="${wy}" width="200" height="52" fill="${SEA}" opacity="0.3"/>` + `<line x1="20" y1="${wy}" x2="220" y2="${wy}" stroke="${WT}" stroke-width="1.5"/>` + txt(210, wy - 4, '水面', WT, 9, 'end');
  // ストロー：空気中はまっすぐ、水中で角度が変わる
  body += `<line x1="90" y1="14" x2="118" y2="${wy}" stroke="${BR}" stroke-width="4"/>` + `<line x1="118" y1="${wy}" x2="150" y2="90" stroke="${BR}" stroke-width="4"/>`;
  // 見かけ（点線）
  body += `<line x1="118" y1="${wy}" x2="135" y2="90" stroke="${YE}" stroke-width="2" stroke-dasharray="4 2"/>`;
  body += txt(70, 20, 'ストロー', BR, 9, 'start') + txt(150, 96, '実際', BR, 8) + txt(133, 96, '見かけ', YE, 8, 'end');
  body += txt(120, 108, '水面で曲がって見える', WT, 9);
  return S('240 116', body);
}
// ② てこ・シーソー
function figSeesaw(wL, dL, wR, dR) {
  const cx = 120, by = 74, beamY = 60, scale = 34;
  const xL = cx - dL * scale, xR = cx + dR * scale;
  let body = `<polygon points="${cx - 12},${by} ${cx + 12},${by} ${cx},${beamY}" fill="${WT}" opacity="0.55"/>`;
  body += `<line x1="24" y1="${beamY}" x2="216" y2="${beamY}" stroke="${WT}" stroke-width="3"/>`;
  body += `<rect x="${xL - 11}" y="${beamY - 22}" width="22" height="20" fill="${BL}" opacity="0.6" stroke="${BL}"/>` + txt(xL, beamY - 8, wL + 'kg', '#fff', 9) + txt(xL, beamY + 14, dL + 'm', BL, 9);
  body += `<rect x="${xR - 11}" y="${beamY - 22}" width="22" height="20" fill="${PK}" opacity="0.6" stroke="${PK}"/>` + txt(xR, beamY - 8, wR + 'kg', '#fff', 9) + txt(xR, beamY + 14, dR + 'm', PK, 9);
  body += `<line x1="${cx}" y1="${beamY}" x2="${cx}" y2="${beamY - 8}" stroke="${YE}" stroke-width="1"/>` + txt(cx, beamY - 12, '支点', YE, 8);
  return S('240 92', body);
}
// ③ 標高と気温
function figMountain(baseT, top) {
  let body = `<polygon points="30,96 120,20 210,96" fill="${WT}" opacity="0.2" stroke="${WT}" stroke-width="1.5"/>`;
  body += `<polygon points="105,32 120,20 135,32 130,40 110,40" fill="${WT}" opacity="0.7"/>`; // 雪
  body += `<circle cx="200" cy="26" r="10" fill="${YE}" opacity="0.85"/>`;
  body += `<line x1="120" y1="96" x2="120" y2="30" stroke="${YE}" stroke-width="1" stroke-dasharray="3 2"/><polygon points="120,26 116,34 124,34" fill="${YE}"/>`;
  body += txt(120, 16, top, RD, 10) + txt(60, 92, `ふもと ${baseT}℃`, GN, 9);
  return S('240 104', body);
}
// ④ 影・日時計
function figShadow() {
  const gy = 82;
  let body = `<line x1="10" y1="${gy}" x2="230" y2="${gy}" stroke="${WT}" stroke-width="1.5"/>`;
  body += `<circle cx="40" cy="26" r="12" fill="${YE}" opacity="0.85"/>` + txt(40, 48, '太陽', YE, 8);
  body += `<line x1="120" y1="${gy}" x2="120" y2="40" stroke="${BR}" stroke-width="4"/>` + txt(120, 34, '棒', BR, 9);
  // 影（太陽と反対側へ）
  body += `<polygon points="120,${gy} 195,${gy} 120,${gy - 3}" fill="#20263f" stroke="${WT}" stroke-width="0.8"/>` + txt(165, gy + 14, '影', WT, 9);
  // 光線
  body += `<line x1="52" y1="34" x2="120" y2="40" stroke="${YE}" stroke-width="1" stroke-dasharray="3 2"/>`;
  return S('240 104', body);
}
// ⑤ ピザの割合
function figPizza(n, eaten) {
  const cx = 60, cy = 54, r = 40;
  let body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${OR}" opacity="0.3" stroke="${OR}" stroke-width="2"/>`;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n;
    body += `<line x1="${cx}" y1="${cy}" x2="${(cx + r * Math.cos(a)).toFixed(1)}" y2="${(cy + r * Math.sin(a)).toFixed(1)}" stroke="${OR}" stroke-width="1.3"/>`;
  }
  // 食べた分を塗る
  for (let i = 0; i < eaten; i++) {
    const a0 = -Math.PI / 2 + i * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n;
    body += `<path d="M${cx} ${cy} L${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)} Z" fill="${RD}" opacity="0.45"/>`;
  }
  body += txt(130, 40, `${n}等分`, WT, 11, 'start') + txt(130, 58, `${eaten}切れ食べた`, RD, 10, 'start');
  return S('210 108', body);
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

// ① 光の屈折（概念・選択）: hikarioto
[['プールの水の中は、外から見ると実際の深さよりどう見えますか？', '浅く見える', ['浅く見える', '深く見える', '同じに見える', '見えない'], '光は水から空気へ出るとき水面で曲がるため、底が実際より浅く（近く）見えます。プールは見た目より深いので注意！'],
['コップの水にストローをななめに入れると、ストローは水面のところでどう見えますか？', '曲がって見える', ['曲がって見える', 'まっすぐ', '消える', '太くなる'], '光が水面で曲がる（屈折する）ので、ストローが折れ曲がって見えます。'],
['水そうの底にしずめたコインは、真上でなくななめから見ると実際の位置より？', '浮き上がって見える', ['浮き上がって見える', 'しずんで見える', '横にずれる', '大きくなる'], '光の屈折で、水中のものは実際より浅い位置＝浮き上がって見えます。']].forEach(([q, a, c, m]) =>
  addTo('rika_hikarioto', 'ho', { question: q, answer: a, choices: c, meaning: m, grade: 5, difficulty: 2, svg: figRefraction() }));

// ② てこ・シーソー（計算・数値）: chikara
[[30, 2, 20], [40, 3, 24], [20, 4, 16], [36, 2, 24], [25, 4, 20], [45, 2, 30]].forEach(([wL, dL, wR]) => {
  const dR = wL * dL / wR;
  if (!Number.isInteger(dR)) return;
  addTo('rika_chikara', 'rc', { question: `シーソーの左に体重${wL}kgの子が支点から${dL}mのところにすわりました。右に体重${wR}kgの子がすわってつり合うには、支点から何mのところにすわればよいですか？`, answer: dR, choices: ch(dR, [wL * dL, dL, wR, dR + 1]), meaning: `てこのつり合い：おもさ×支点からの長さ が左右で等しい。${wL}×${dL}＝${wR}×□ より □＝${wL * dL}÷${wR}＝${dR}m。軽い子ほど遠くにすわる！`, grade: 5, difficulty: 2, svg: figSeesaw(wL, dL, wR, dR) });
});

// ③ 標高と気温（計算・数値）: tenki（100mで0.6℃下がる）
[[20, 500], [18, 1000], [25, 1500], [15, 2000], [22, 1000], [30, 500]].forEach(([baseT, h]) => {
  const drop = 0.6 * h / 100, top = baseT - drop;
  if (!Number.isInteger(top)) return;
  addTo('rika_tenki', 'tk', { question: `ふもとの気温が${baseT}℃のとき、そこから${h}m高い山の上の気温は何℃ですか？（100m高くなるごとに気温は0.6℃下がるものとします）`, answer: top, choices: ch(top, [baseT, top - 1, drop, baseT - h / 100]), meaning: `${h}mでは0.6×${h / 100}＝${drop}℃下がる。${baseT}－${drop}＝${top}℃。山の上がすずしいのはこのためです。`, grade: 5, difficulty: 3, svg: figMountain(baseT, `? ℃`) });
});

// ④ 影・日時計（概念・選択）: sora
[['晴れた日、地面に立てた棒の影は、太陽に対してどちら側にできますか？', '太陽と反対側', ['太陽と反対側', '太陽と同じ側', '真上', 'できない'], '光がさえぎられてできるのが影なので、影は太陽と反対の方向にのびます。'],
['1日のうちで、棒の影がいちばん短くなるのはいつですか？', '正午（太陽が最も高いとき）', ['正午（太陽が最も高いとき）', '朝', '夕方', '夜'], '太陽が高いほど影は短い。太陽が一番高くなる正午ごろに影は最短になります。'],
['朝や夕方の影が長くなるのはなぜですか？', '太陽の位置が低いから', ['太陽の位置が低いから', '太陽が近いから', '棒がのびるから', '気温が低いから'], '太陽が地平線に近く低いほど、光は横からさして影は長くのびます。'],
['日本で、棒の影が真北をさすのはいつですか？', '正午ごろ（太陽が真南）', ['正午ごろ（太陽が真南）', '朝（太陽が東）', '夕方（太陽が西）', '真夜中'], '正午に太陽はほぼ真南に来るので、影は反対の真北をさします。これを利用したのが日時計です。']].forEach(([q, a, c, m]) =>
  addTo('rika_sora', 'rk', { question: q, answer: a, choices: c, meaning: m, grade: 4, difficulty: 3, svg: figShadow() }));

// ⑤ ピザ・ケーキの割合（計算・数値）: wariai
[[8, 3], [12, 4], [6, 2], [10, 5], [8, 6], [12, 9]].forEach(([n, eaten]) => {
  const pct = Math.round(eaten / n * 100 * 100) / 100;
  addTo('sansu_wariai', 'sw', { question: `${n}等分に切ったピザのうち${eaten}切れを食べました。食べたのは全体の何%ですか？`, answer: pct, choices: ch(pct, [eaten / n, 100 - pct, n - eaten, eaten * n]), meaning: `食べた割合＝${eaten}÷${n}＝${Math.round(eaten / n * 100) / 100}。百分率にして${pct}%です。`, grade: 5, difficulty: 2, svg: figPizza(n, eaten) });
});
[[8], [12], [6], [10], [5], [9]].forEach(([n]) => {
  const ang = 360 / n;
  if (!Number.isInteger(ang)) return;
  addTo('sansu_wariai', 'sw', { question: `丸いピザを${n}等分に切ります。1切れの中心角（とがった角）は何度ですか？`, answer: ang, choices: ch(ang, [n, 360, ang * 2, 180 / n]), meaning: `1周360度を${n}等分。360÷${n}＝${ang}度です。`, grade: 5, difficulty: 2, svg: figPizza(n, 1) });
});

console.log('身近な現象の問題（屈折・てこ・標高・影・ピザ）を追加しました。');
