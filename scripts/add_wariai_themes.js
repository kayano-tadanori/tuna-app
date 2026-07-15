// 割合に「テーマ違い」を追加して多様化する。濃さ（砂糖水・ジュース）、
// 分配（カード・シール）、損益（お店の品物）など設定を変えたものを図つきで追加。
// 件数より種類を優先。答えはすべてコード計算で検証する。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_wariai.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let maxId = Math.max(...data.map(q => Number(q.id.slice(2))));
const nid = () => 'sw' + String(++maxId).padStart(3, '0');

const BL = '#4f9eff', YE = '#ffd166', PK = '#ff6688', GN = '#38d9a9', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

function figMenseki(conc, gram, label) {
  const x0 = 30, y0 = 78, maxW = 170, maxH = 56;
  const w = Math.max(28, Math.min(maxW, gram / 4)), h = Math.max(14, Math.min(maxH, conc * 3.5));
  const body =
    `<rect x="${x0}" y="${y0 - h}" width="${w}" height="${h}" fill="${BL}" opacity="0.35" stroke="${BL}" stroke-width="2"/>` +
    `<line x1="${x0}" y1="${y0}" x2="${x0 + maxW + 10}" y2="${y0}" stroke="${WT}" stroke-width="1.5"/>` +
    `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="12" stroke="${WT}" stroke-width="1.5"/>` +
    txt(x0 + w / 2, y0 + 14, `${gram}g`, WT, 10) +
    `<text x="14" y="${y0 - h / 2}" fill="${YE}" font-size="10" text-anchor="middle" font-family="sans-serif" font-weight="bold" transform="rotate(-90 14 ${y0 - h / 2})">${conc}%</text>` +
    (label ? txt(x0 + w / 2, y0 - h - 5, label, YE, 10) : '');
  return S('230 96', body);
}
function figRatio2(a, b, total, la, lb) {
  const x0 = 25, w = 190, h = 26, y = 40, wa = Math.round(w * a / (a + b));
  const body =
    `<rect x="${x0}" y="${y}" width="${wa}" height="${h}" fill="${BL}" stroke="${WT}"/>` +
    `<rect x="${x0 + wa}" y="${y}" width="${w - wa}" height="${h}" fill="${PK}" stroke="${WT}"/>` +
    txt(x0 + wa / 2, y + 17, `${la} ${a}`, '#fff', 11) + txt(x0 + wa + (w - wa) / 2, y + 17, `${lb} ${b}`, '#fff', 11) +
    `<line x1="${x0}" y1="${y - 8}" x2="${x0 + w}" y2="${y - 8}" stroke="${YE}" stroke-width="1"/>` + txt(x0 + w / 2, y - 12, total, YE, 11);
  return S('240 84', body);
}
function figWhole(fracLabel, whole) {
  const x0 = 25, w = 190, h = 26, y = 42;
  const body = `<rect x="${x0}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${BL}" stroke-width="2"/>` +
    `<rect x="${x0}" y="${y}" width="${Math.round(w * 0.6)}" height="${h}" fill="${BL}" opacity="0.3"/>` +
    txt(x0 + w * 0.3, y + 17, fracLabel, YE, 11) +
    `<line x1="${x0}" y1="${y - 8}" x2="${x0 + w}" y2="${y - 8}" stroke="${YE}" stroke-width="1"/>` + txt(x0 + w / 2, y - 12, `全体 ${whole}`, YE, 10);
  return S('240 84', body);
}

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/[：:／/]/g, '').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
function add(grade, diff, question, answer, meaning, svg) {
  data.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}
const fmt = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// ① 砂糖水の濃さ（面積図）: 6-4
[[8, 200], [10, 300], [5, 400], [12, 150], [6, 250], [15, 200], [4, 500], [20, 100]].forEach(([c, g]) =>
  add(6, 4, `${c}%の砂糖水が${g}gあります。とけている砂糖は何gですか？`, Math.round(g * c / 100 * 100) / 100,
    `砂糖＝砂糖水×濃さ＝${g}×0.${c < 10 ? '0' + c : c}＝${fmt(g * c / 100)}gです。`, figMenseki(c, g, '砂糖水')));
// ② ジュース（原液の割合）: 6-4
[[20, 250], [25, 200], [10, 400], [40, 150], [15, 300], [30, 200], [50, 120], [8, 500]].forEach(([c, g]) =>
  add(6, 4, `原液の割合が${c}%のジュースが${g}mLあります。ふくまれる原液は何mLですか？`, Math.round(g * c / 100 * 100) / 100,
    `原液＝全体×割合＝${g}×0.${c < 10 ? '0' + c : c}＝${fmt(g * c / 100)}mLです。`, figMenseki(c, g, 'ジュース')));

// ③ 分配（カード・シールなど別の物）: 6-2 / 5-3
[['カード', 3, 5, 6], ['シール', 4, 3, 7], ['ビー玉', 5, 7, 4], ['折り紙', 7, 5, 3], ['どんぐり', 2, 7, 5], ['あめ玉', 5, 4, 6]].forEach(([obj, a, b, unit]) =>
  add(6, 2, `${(a + b) * unit}枚の${obj}を、姉と妹で${a}：${b}に分けます。姉は何枚もらえますか？`, a * unit,
    `全体${a + b}のうち姉は${a}。1あたり${(a + b) * unit}÷${a + b}＝${unit}枚。姉＝${a}×${unit}＝${a * unit}枚です。`, figRatio2(a, b, `${(a + b) * unit}枚`, '姉', '妹')));

// ④ 損益（お店の品物いろいろ）: 6-5
[['本', 2, 1, 160], ['おもちゃ', 3, 1, 240], ['くつ', 2, 2, 100], ['ぼうし', 4, 1, 300], ['カバン', 3, 2, 180], ['ノート', 2, 3, 80]].forEach(([obj, up, down, profit]) => {
  const rate = (1 + up / 10) * (1 - down / 10) - 1, X = profit / rate;
  if (!Number.isInteger(X) || rate <= 0) return;
  add(6, 5, `ある店で${obj}に原価の${up}割増しの定価をつけ、定価の${down}割引きで売ったところ、${profit}円の利益が出ました。原価は何円ですか？`, X,
    `売価は原価の(1＋0.${up})×(1－0.${down})＝${fmt(1 + rate)}倍。利益は原価の${fmt(rate)}倍なので、${profit}÷${fmt(rate)}＝${X}円です。`, figWhole(`利益 ${profit}円`, '原価?'));
});

// ⑤ 割合の三用法（テストの点・出席率など別文脈）: 5-2
[[40, 30], [50, 24], [60, 45], [25, 20], [80, 60], [45, 36]].forEach(([total, taken]) =>
  add(5, 2, `クラスの人数は${total}人で、そのうち${taken}人がめがねをかけています。めがねをかけている人は全体の何%ですか？`, Math.round(taken / total * 100 * 100) / 100,
    `割合＝くらべる量÷もとにする量＝${taken}÷${total}＝${fmt(taken / total)}。百分率にして${fmt(taken / total * 100)}%です。`, figWhole(`${taken}人`, `${total}人`)));

// ---------- 各セル×テンプレ最大10問（図つき優先） ----------
const cnt = {}; const svgFirst = [...data].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] <= 10) keep.add(q.id); }
const out = data.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');

const cell = {};
out.forEach(q => { const k = q.grade + '-' + q.difficulty; (cell[k] = cell[k] || []).push(q); });
console.log('総数:', out.length, ' 図あり:', out.filter(q => q.svg).length);
Object.keys(cell).sort().forEach(k => {
  const m = cell[k].reduce((a, q) => { const n = norm(q.question); a[n] = (a[n] || 0) + 1; return a; }, {});
  console.log(`  ${k}: ${cell[k].length}問 / ${Object.keys(m).length}テンプレ / 最多${Math.max(...Object.values(m))}`);
});
