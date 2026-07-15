// 平面図形に「楽しく学べる」テーマとキャラを追加する。時計の針の角度、オカーンの折り紙、
// オットンのタイルなど、身近な設定を図つきで。答えはすべてコード計算で検証する。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_zu.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let maxId = Math.max(...data.map(q => Number(q.id.slice(2))));
const nid = () => 'sz' + String(++maxId).padStart(3, '0');

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// 時計（短針・長針、h時m分）
function figClock(h, m) {
  const cx = 62, cy = 60, r = 44;
  let body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0d1530" stroke="${WT}" stroke-width="2"/>`;
  for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180; body += `<circle cx="${(cx + (r - 6) * Math.sin(a)).toFixed(1)}" cy="${(cy - (r - 6) * Math.cos(a)).toFixed(1)}" r="1.6" fill="${WT}"/>`; }
  body += txt(cx, cy - r + 12, '12', WT, 9) + txt(cx + r - 9, cy + 4, '3', WT, 9) + txt(cx, cy + r - 6, '6', WT, 9) + txt(cx - r + 9, cy + 4, '9', WT, 9);
  const ha = (h % 12 * 30 + m * 0.5) * Math.PI / 180, ma = m * 6 * Math.PI / 180;
  body += `<line x1="${cx}" y1="${cy}" x2="${(cx + r * 0.5 * Math.sin(ha)).toFixed(1)}" y2="${(cy - r * 0.5 * Math.cos(ha)).toFixed(1)}" stroke="${RD}" stroke-width="3.5" stroke-linecap="round"/>`;
  body += `<line x1="${cx}" y1="${cy}" x2="${(cx + r * 0.8 * Math.sin(ma)).toFixed(1)}" y2="${(cy - r * 0.8 * Math.cos(ma)).toFixed(1)}" stroke="${YE}" stroke-width="2.5" stroke-linecap="round"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="3" fill="${WT}"/>`;
  return S('124 124', body);
}
// 正方形（折り紙）
function figSquare(side, label) {
  const x0 = 55, y0 = 20, s = 80;
  return S('190 120', `<rect x="${x0}" y="${y0}" width="${s}" height="${s}" fill="${PK}" opacity="0.25" stroke="${PK}" stroke-width="2.5"/>` +
    txt(x0 + s / 2, y0 - 5, label, YE, 12) + txt(x0 + s / 2, y0 + s + 15, label, YE, 12));
}
// 長方形（タイル）
function figRect(l, w, ll, wl) {
  const x0 = 40, y0 = 24, W = 120, H = Math.round(120 * w / l);
  let body = `<rect x="${x0}" y="${y0}" width="${W}" height="${H > 70 ? 70 : H}" fill="${BL}" opacity="0.2" stroke="${BL}" stroke-width="2"/>`;
  const hh = H > 70 ? 70 : H;
  for (let i = 1; i < l; i++) body += `<line x1="${x0 + W * i / l}" y1="${y0}" x2="${x0 + W * i / l}" y2="${y0 + hh}" stroke="${BL}" stroke-width="0.6" opacity="0.6"/>`;
  for (let j = 1; j < w; j++) body += `<line x1="${x0}" y1="${y0 + hh * j / w}" x2="${x0 + W}" y2="${y0 + hh * j / w}" stroke="${BL}" stroke-width="0.6" opacity="0.6"/>`;
  body += txt(x0 + W / 2, y0 + hh + 15, ll, YE, 11) +
    `<text x="18" y="${y0 + hh / 2}" fill="${YE}" font-size="11" text-anchor="middle" font-family="sans-serif" font-weight="bold" transform="rotate(-90 18 ${y0 + hh / 2})">${wl}</text>`;
  return S('180 120', body);
}

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
function add(grade, diff, question, answer, meaning, svg) {
  data.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}

// ① 時計の針の角度（○時ちょうど）: 4-1
[2, 3, 4, 5, 7, 8, 9, 10].forEach(h => {
  const ang = Math.min(30 * h, 360 - 30 * h);
  add(4, 1, `時計が${h}時ちょうどをさしています。長針と短針がつくる小さいほうの角の大きさは何度ですか？`, ang,
    `1時間で短針は30度動く。${h}時は30×${h}＝${30 * h}度、小さいほうは${ang}度です。`, figClock(h, 0));
});
// ② 時計の針の角度（○時半）: 5-2
[1, 2, 3, 4, 7, 8, 10, 11].forEach(h => {
  const hourAng = h * 30 + 15, diff = Math.abs(180 - hourAng), ang = Math.min(diff, 360 - diff);
  add(5, 2, `時計が${h}時30分をさしています。長針と短針がつくる小さいほうの角の大きさは何度ですか？`, ang,
    `長針は6をさして180度、短針は${h}時と${h + 1}時の真ん中で${hourAng}度の位置。差は${ang}度です。`, figClock(h, 30));
});

// ③ キャラ：チッチが時計を見る: 4-1
[3, 4, 8, 9].forEach(h => {
  const ang = Math.min(30 * h, 360 - 30 * h);
  add(4, 1, `チッチが時計を見ると${h}時ちょうどでした。長針と短針がつくる小さいほうの角は何度ですか？`, ang,
    `30×${h}＝${30 * h}度、小さいほうは${ang}度や！`, figClock(h, 0));
});
// ④ キャラ：オカーンの折り紙（正方形の面積・まわり）: 3-2
[[12], [15], [18], [20]].forEach(([s]) =>
  add(3, 2, `オカーンが1辺${s}cmの正方形の折り紙を用意しました。この折り紙の面積は何cm²ですか？`, s * s,
    `正方形の面積＝1辺×1辺＝${s}×${s}＝${s * s}cm²です。`, figSquare(s, `${s}cm`)));
[[8], [11], [14], [16]].forEach(([s]) =>
  add(3, 2, `オカーンが1辺${s}cmの正方形の折り紙を半分に折って直角二等辺三角形にしました。三角形の面積は何cm²ですか？`, s * s / 2,
    `もとの正方形${s}×${s}＝${s * s}cm²の半分なので、${s * s / 2}cm²です。`, figSquare(s, `${s}cm`)));
// ⑤ キャラ：オットンが現場にタイルをしきつめる: 4-1
[[6, 4], [8, 5], [7, 6], [9, 4]].forEach(([l, w]) =>
  add(4, 1, `オットンが現場に、たて${w}枚・よこ${l}枚で正方形のタイルをすき間なくしきつめました。タイルは全部で何枚ですか？`, l * w,
    `たて×よこ＝${w}×${l}＝${l * w}枚。現場はきれいに仕上がったで！`, figRect(l, w, `よこ${l}枚`, `たて${w}枚`)));

// ---------- 各セル×テンプレ最大12（図つき優先） ----------
const cnt = {}; const svgFirst = [...data].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] <= 12) keep.add(q.id); }
const out = data.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');
console.log('総数:', out.length, ' 図あり:', out.filter(q => q.svg).length, ' 追加分:', out.filter(q => /時計|折り紙|タイル/.test(q.question)).length);
