// 特殊算をさらに「テーマ違い」で多様化する。解き方は同じでもお話が変わると新鮮なので、
// 植木算（旗・リボン・池のまわり）、過不足算（長いす・ボート・部屋割り）、
// 和差算（身長・テープ・箱の重さ）、相当算（水そう・本・道のり）を図つきで追加。
// 件数より種類を優先。答えはすべてコード計算で検証する。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_tokusan.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let maxId = Math.max(...data.map(q => Number(q.id.slice(2))));
const nid = () => 'st' + String(++maxId).padStart(3, '0');

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

function figTree(len, gap, unitLabel, bothEnds) {
  const x0 = 20, x1 = 220, y = 40, n = Math.min(Math.floor(len / gap), 8);
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${BL}" stroke-width="2"/>`;
  for (let i = 0; i <= n; i++) { if (!bothEnds && (i === 0 || i === n)) continue; const x = x0 + (x1 - x0) * i / n; body += `<circle cx="${x}" cy="${y}" r="3.5" fill="${GN}"/><rect x="${x - 1}" y="${y}" width="2" height="8" fill="${GN}"/>`; }
  body += txt((x0 + x1) / 2, y - 10, `全長${len}・${gap}${unitLabel}おき`, YE, 10);
  return S('240 62', body);
}
function figSurplus(a, aState, b, bState) {
  const x0 = 25, w = 180;
  const body =
    txt(x0, 22, `${a}ずつ`, BL, 10, 'start') + `<rect x="${x0 + 55}" y="14" width="${w - 55}" height="14" fill="${BL}" opacity="0.4" stroke="${WT}"/>` + txt(x0 + w + 6, 25, aState, YE, 9, 'start') +
    txt(x0, 52, `${b}ずつ`, PK, 10, 'start') + `<rect x="${x0 + 55}" y="44" width="${w - 55}" height="14" fill="${PK}" opacity="0.4" stroke="${WT}"/>` + txt(x0 + w + 6, 55, bState, YE, 9, 'start') +
    txt(x0 + 55, 74, '1つあたりの差 × 数 ＝ 全体の差', WT, 9, 'start');
  return S('320 84', body);
}
function figSumDiff(sum, diff, bigL, smallL) {
  const x0 = 25, y1 = 30, y2 = 56, small = 120, ex = 44;
  const body =
    `<rect x="${x0}" y="${y1}" width="${small + ex}" height="18" fill="${PK}" opacity="0.55" stroke="${WT}"/>` + txt(x0 - 6, y1 + 14, bigL, PK, 10, 'end') +
    `<rect x="${x0}" y="${y2}" width="${small}" height="18" fill="${BL}" opacity="0.55" stroke="${WT}"/>` + txt(x0 - 6, y2 + 14, smallL, BL, 10, 'end') +
    `<rect x="${x0 + small}" y="${y2}" width="${ex}" height="18" fill="none" stroke="${YE}" stroke-dasharray="3 2"/>` + txt(x0 + small + ex / 2, y2 + 13, `差${diff}`, YE, 9) +
    txt(x0 + (small + ex) / 2, y1 - 6, `和は${sum}`, YE, 10);
  return S('230 86', body);
}
function figWhole(usedLabel, whole) {
  const x0 = 25, w = 190, h = 26, y = 42;
  const body =
    `<rect x="${x0}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${BL}" stroke-width="2"/>` +
    `<rect x="${x0}" y="${y}" width="${Math.round(w * 0.6)}" height="${h}" fill="${BL}" opacity="0.3"/>` +
    txt(x0 + w * 0.3, y + 17, usedLabel, YE, 11) +
    `<line x1="${x0}" y1="${y - 8}" x2="${x0 + w}" y2="${y - 8}" stroke="${YE}" stroke-width="1"/>` + txt(x0 + w / 2, y - 12, `全体 ${whole}`, YE, 10);
  return S('240 84', body);
}

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
function add(grade, diff, question, answer, meaning, svg) {
  data.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}

// ============ 植木算のテーマ違い ============
// 旗（両端に立てる）: 木の数＝間＋1  : 6-1
[[60, 5], [80, 8], [90, 6], [48, 4], [100, 10], [72, 6]].forEach(([len, gap]) =>
  add(6, 1, `まっすぐな道の両はしをふくめて${gap}mおきに旗を立てます。道の長さが${len}mのとき、旗は何本必要ですか？`, len / gap + 1,
    `間の数＝${len}÷${gap}＝${len / gap}。両はしに立てるので旗は間＋1＝${len / gap + 1}本です。`, figTree(len, gap, 'm', true)));
// リボンを切る（切る回数）: 切る回数＝本数－1  : 5-1
[[60, 5], [72, 6], [80, 8], [90, 9], [48, 4], [100, 10]].forEach(([len, g]) =>
  add(5, 1, `長さ${len}cmのリボンを${g}cmずつに切り分けます。切る回数は何回ですか？`, len / g - 1,
    `${len}÷${g}＝${len / g}本に分かれる。切るのは本数より1回少ないので${len / g - 1}回です。`, figTree(len, g, 'cm', false)));
// 池のまわり（円形）: 木の数＝間の数  : 6-1
[[60, 5], [72, 6], [80, 8], [90, 6], [48, 4], [100, 10]].forEach(([len, g]) =>
  add(6, 1, `まわりの長さが${len}mの池のまわりに、${g}mおきに木を植えます。木は何本必要ですか？`, len / g,
    `円形（池のまわり）では木の数＝間の数。${len}÷${g}＝${len / g}本です。`, figTree(len, g, 'm', false)));

// ============ 過不足算のテーマ違い（配る以外の物語） ============
// 単位数U・1つあたりa/b・aのとき av人あぶれる → 生徒P=a*U+av、bのとき bv人分の空き
function surplusTheme(grade, diff, story, cases) {
  cases.forEach(([U, a, b, av]) => {
    const P = a * U + av, bv = (b - a) * U - av;
    if (bv < 0) return;
    add(grade, diff, story.q(a, b, av, bv), story.ask === 'units' ? U : P,
      `1つあたり${b - a}人の差が全体で${av + bv}人の差になる。数＝(${av}＋${bv})÷${b - a}＝${U}。子どもは${a}×${U}＋${av}＝${P}人です。`,
      figSurplus(`${a}人`, `${av}人あぶれる`, `${b}人`, `${bv}人分あく`));
  });
}
// 長いす（生徒は何人）: 6-4
surplusTheme(6, 4, { ask: 'people', q: (a, b, av, bv) => `長いすがいくつかあります。1脚に${a}人ずつすわると${av}人がすわれず、1脚に${b}人ずつすわると${bv}人分の席があまります。子どもは何人いますか？` },
  [[5, 4, 6, 7], [6, 3, 5, 8], [4, 5, 7, 6], [8, 4, 5, 3], [5, 3, 4, 6], [7, 4, 6, 10]]);
// 部屋割り（部屋は何室）: 6-4
surplusTheme(6, 4, { ask: 'units', q: (a, b, av, bv) => `子どもを部屋に分けます。1部屋に${a}人ずつ入れると${av}人が入れず、1部屋に${b}人ずつ入れると${bv}人分あきます。部屋は何室ありますか？` },
  [[6, 3, 4, 5], [5, 4, 6, 8], [8, 3, 5, 4], [4, 5, 7, 3], [7, 4, 6, 6], [6, 5, 8, 9]]);
// ボート（ボートは何そう）: 5-4
surplusTheme(5, 4, { ask: 'units', q: (a, b, av, bv) => `子どもがボートに乗ります。1そうに${a}人ずつ乗ると${av}人が乗れず、1そうに${b}人ずつ乗ると${bv}人分あきます。ボートは何そうありますか？` },
  [[5, 4, 6, 6], [6, 3, 5, 9], [4, 4, 6, 8], [8, 3, 4, 5], [5, 5, 7, 4], [7, 4, 6, 8]]);

// ============ 和差算のテーマ違い ============
function sumDiffTheme(grade, diff, story, cases) {
  cases.forEach(([sum, dff]) => {
    const big = (sum + dff) / 2;
    if (!Number.isInteger(big)) return;
    add(grade, diff, story.q(sum, dff), big, story.m(sum, dff, big), figSumDiff(sum, dff, story.bigL, story.smallL));
  });
}
sumDiffTheme(5, 1, { bigL: '兄', smallL: '弟', q: (s, d) => `兄と弟の身長を合わせると${s}cmで、兄は弟より${d}cm高いそうです。兄の身長は何cmですか？`, m: (s, d, b) => `兄＝(和＋差)÷2＝(${s}＋${d})÷2＝${b}cmです。` },
  [[280, 12], [300, 20], [260, 8], [320, 30], [250, 14], [290, 16]]);
sumDiffTheme(5, 1, { bigL: '長', smallL: '短', q: (s, d) => `長いテープと短いテープの長さを合わせると${s}cmで、長さの差は${d}cmです。長いテープは何cmですか？`, m: (s, d, b) => `長い方＝(${s}＋${d})÷2＝${b}cmです。` },
  [[100, 20], [84, 12], [120, 30], [66, 14], [90, 16], [110, 24]]);
sumDiffTheme(5, 1, { bigL: '重', smallL: '軽', q: (s, d) => `2つの箱の重さを合わせると${s}gで、重さの差は${d}gです。重い方の箱は何gですか？`, m: (s, d, b) => `重い方＝(${s}＋${d})÷2＝${b}gです。` },
  [[500, 40], [640, 60], [420, 30], [800, 100], [560, 24], [720, 80]]);

// ============ 相当算のテーマ違い ============
// 全体の 1/d1 使い、残りの n/d2 使うと rem 残る
function soutouTheme(grade, diff, story, cases) {
  cases.forEach(([d1, n1, d2, rem]) => {
    const r1 = 1 - 1 / d1, r2 = 1 - n1 / d2, X = rem / (r1 * r2);
    if (!Number.isInteger(X)) return;
    add(grade, diff, story.q(d1, n1, d2, rem), X, story.m(d1, n1, d2, rem, X, r1, r2), figWhole(story.used, story.whole));
  });
}
soutouTheme(5, 4, { used: '飲んだ分', whole: '?L', q: (d1, n1, d2, rem) => `水そうの水の${d1 === 2 ? '半分' : '1/' + d1}を使い、次に残りの${n1}/${d2}を使ったところ、${rem}Lになりました。はじめ水は何Lありましたか？`, m: (d1, n1, d2, rem, X, r1, r2) => `残りは全体の${r1 % 1 === 0 ? r1 : `(1－1/${d1})`}×(1－${n1}/${d2})＝${Math.round(r1 * r2 * 100) / 100}。${rem}÷${Math.round(r1 * r2 * 100) / 100}＝${X}Lです。` },
  [[2, 2, 5, 30], [3, 1, 2, 40], [4, 1, 3, 30], [2, 3, 5, 20], [5, 2, 3, 24], [3, 2, 5, 18]]);
soutouTheme(6, 5, { used: '読んだ分', whole: '?ページ', q: (d1, n1, d2, rem) => `ある本の${d1 === 2 ? '半分' : '1/' + d1}を読み、次に残りの${n1}/${d2}を読んだところ、残りが${rem}ページになりました。この本は全部で何ページですか？`, m: (d1, n1, d2, rem, X, r1, r2) => `残りは(1－1/${d1})×(1－${n1}/${d2})＝${Math.round(r1 * r2 * 100) / 100}。${rem}÷${Math.round(r1 * r2 * 100) / 100}＝${X}ページです。` },
  [[3, 1, 2, 40], [4, 1, 3, 60], [2, 2, 5, 45], [5, 1, 2, 32], [3, 2, 5, 36], [2, 3, 4, 30]]);

// ---------- 各セル×テンプレ最大8問（図つき優先） ----------
const cnt = {}; const svgFirst = [...data].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] <= 8) keep.add(q.id); }
const out = data.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');

const cell = {};
out.forEach(q => { const k = q.grade + '-' + q.difficulty; (cell[k] = cell[k] || []).push(q); });
console.log('総数:', out.length, ' 図あり:', out.filter(q => q.svg).length);
Object.keys(cell).sort().forEach(k => {
  const m = cell[k].reduce((a, q) => { const n = norm(q.question); a[n] = (a[n] || 0) + 1; return a; }, {});
  console.log(`  ${k}: ${cell[k].length}問 / ${Object.keys(m).length}テンプレ / 最多${Math.max(...Object.values(m))}`);
});
