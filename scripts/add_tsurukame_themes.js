// つるかめ算を「テーマ違い」で多様化する。同じ解き方でも設定が変わると新鮮なので、
// イカタコ算・クモと昆虫・ニワトリとウサギ・硬貨・入場料など、文脈の異なる
// つるかめ算を面積図つきで追加する。件数より種類（多様性）を優先。答えはコード計算。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_tokusan.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let maxId = Math.max(...data.map(q => Number(q.id.slice(2))));
const nid = () => 'st' + String(++maxId).padStart(3, '0');
const BL = '#4f9eff', YE = '#ffd166', PK = '#ff6688', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// つるかめ面積図（自動スケール）：横＝個数、縦＝1つあたりの値
function figTsuru(total, sVal, bVal, sName, bName, unit) {
  const x0 = 40, yb = 82, W = 158, scale = 58 / bVal;
  const Hs = sVal * scale, Hd = (bVal - sVal) * scale;
  const body =
    `<rect x="${x0}" y="${yb - Hs}" width="${W}" height="${Hs}" fill="${BL}" opacity="0.32" stroke="${BL}" stroke-width="1.5"/>` +
    `<rect x="${x0}" y="${yb - Hs - Hd}" width="${W}" height="${Hd}" fill="${PK}" opacity="0.35" stroke="${PK}" stroke-width="1.5" stroke-dasharray="4 2"/>` +
    `<line x1="${x0}" y1="${yb}" x2="${x0 + W + 8}" y2="${yb}" stroke="${WT}" stroke-width="1.5"/>` +
    `<line x1="${x0}" y1="${yb}" x2="${x0}" y2="14" stroke="${WT}" stroke-width="1.5"/>` +
    txt(x0 + W / 2, yb + 14, `全部で${total}`, WT, 10) +
    `<text x="14" y="${yb - Hs / 2}" fill="${BL}" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="bold" transform="rotate(-90 14 ${yb - Hs / 2})">${sName}${sVal}${unit}</text>` +
    `<text x="26" y="${yb - Hs - Hd / 2 + 3}" fill="${PK}" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="bold" transform="rotate(-90 26 ${yb - Hs - Hd / 2 + 3})">${bName}${bVal}${unit}</text>`;
  return S('220 100', body);
}

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
function add(grade, diff, question, answer, meaning, svg) {
  data.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}

// 足の数タイプのつるかめ：(合計匹数 total, 多い方の匹数 nBig) から足の合計を作る
function legTheme(grade, diff, sName, sLeg, bName, bLeg, unit, cases, ask) {
  cases.forEach(([total, nBig]) => {
    const nSmall = total - nBig;
    if (nSmall < 0) return;
    const legs = sLeg * nSmall + bLeg * nBig;
    const ansIsBig = ask === 'big';
    const ans = ansIsBig ? nBig : nSmall;
    const askName = ansIsBig ? bName : sName;
    add(grade, diff,
      `${sName}と${bName}が合わせて${total}匹います。${unit}の合計は${legs}${unit === '足' ? '本' : '個'}です。${askName}は何匹いますか？`,
      ans,
      `全部${sName}（${sLeg}${unit === '足' ? '本' : '個'}）なら${sLeg * total}本。実際は${legs}本で${legs - sLeg * total}本多く、${bName}1匹で${bLeg - sLeg}本ふえるので${bName}は${(legs - sLeg * total) / (bLeg - sLeg)}匹。${askName}は${ans}匹です。`,
      figTsuru(total, sLeg, bLeg, sName, bName, '本'));
  });
}

// ① イカタコ算（タコ8本・イカ10本）: 5-2
legTheme(5, 2, 'タコ', 8, 'イカ', 10, '足', [[9, 4], [12, 5], [8, 3], [15, 6], [10, 7], [11, 5]], 'big');
// ② クモと昆虫（昆虫6本・クモ8本）: 6-3
legTheme(6, 3, '昆虫', 6, 'クモ', 8, '足', [[10, 4], [14, 5], [9, 6], [12, 3], [16, 7], [11, 4]], 'big');
// ③ ニワトリとウサギ（2本・4本）: 4-2
legTheme(4, 2, 'ニワトリ', 2, 'ウサギ', 4, '足', [[20, 8], [15, 6], [24, 9], [18, 5], [30, 12], [12, 7]], 'big');
// ④ カブトムシとクモ（6本・8本、別文脈）: 5-4
legTheme(5, 4, 'カブトムシ', 6, 'クモ', 8, '足', [[13, 5], [10, 4], [16, 6], [11, 3], [14, 8], [9, 5]], 'small');

// ⑤ 硬貨のつるかめ（50円玉・100円玉）: 6-3
[[15, 6], [20, 8], [12, 5], [18, 10], [25, 7], [16, 9]].forEach(([total, nBig]) => {
  const nSmall = total - nBig, money = 50 * nSmall + 100 * nBig;
  add(6, 3, `50円玉と100円玉が合わせて${total}枚あり、合計金額は${money}円です。100円玉は何枚ありますか？`, nBig,
    `全部50円玉なら${50 * total}円。実際は${money}円で${money - 50 * total}円多く、100円玉1枚で50円ふえるので100円玉は${(money - 50 * total) / 50}枚です。`,
    figTsuru(total, 50, 100, '50円', '100円', '円'));
});

// ⑥ 入場料のつるかめ（子ども200円・大人500円）: 6-4
[[10, 4], [12, 5], [8, 3], [15, 6], [9, 7], [11, 4]].forEach(([total, nBig]) => {
  const nSmall = total - nBig, money = 200 * nSmall + 500 * nBig;
  add(6, 4, `子ども(1人200円)と大人(1人500円)が合わせて${total}人で、入場料の合計は${money}円でした。大人は何人ですか？`, nBig,
    `全員子どもなら${200 * total}円。実際は${money}円で${money - 200 * total}円多く、大人1人で300円ふえるので大人は${(money - 200 * total) / 300}人です。`,
    figTsuru(total, 200, 500, '子', '大人', '円'));
});

// ⑦ ○×クイズのつるかめ（正解+points・不正解 -points ではなく、当たり/はずれの得点）: 5-2
[[10, 6, 5, 2], [12, 7, 4, 1], [8, 5, 6, 3], [15, 9, 3, 1], [10, 8, 5, 2], [12, 6, 4, 2]].forEach(([total, nBig, pBig, pSmall]) => {
  const nSmall = total - nBig, score = pBig * nBig + pSmall * nSmall;
  add(5, 2, `全部で${total}問のクイズがあります。当たると${pBig}点、はずれると${pSmall}点もらえます。合計が${score}点のとき、当たった問題は何問ですか？`, nBig,
    `全部はずれなら${pSmall * total}点。実際は${score}点で${score - pSmall * total}点多く、1問当たるごとに${pBig - pSmall}点ふえるので当たりは${(score - pSmall * total) / (pBig - pSmall)}問です。`,
    figTsuru(total, pSmall, pBig, 'はずれ', '当たり', '点'));
});

// ---------- 各セル×テンプレを最大8問に圧縮（図つき優先） ----------
const cnt = {}; const svgFirst = [...data].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] <= 8) keep.add(q.id); }
const out = data.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');

// レポート
const cell = {};
out.forEach(q => { const k = q.grade + '-' + q.difficulty; (cell[k] = cell[k] || []).push(q); });
console.log('総数:', out.length, ' 図あり:', out.filter(q => q.svg).length);
Object.keys(cell).sort().forEach(k => {
  const m = cell[k].reduce((a, q) => { const n = norm(q.question); a[n] = (a[n] || 0) + 1; return a; }, {});
  console.log(`  ${k}: ${cell[k].length}問 / ${Object.keys(m).length}テンプレ / 最多${Math.max(...Object.values(m))}`);
});
