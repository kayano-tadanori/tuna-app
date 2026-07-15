// 割合（sansu_wariai.json）を「間引き＋多様化＋図」で再構成。
// 既存は「貯金額の比…」が60問×2セル、連比が2テンプレなど同一問題が大量に連続、図は0枚。
// 全テンプレを1セルあたり最大10問に制限し、分配算に線分図、食塩水に面積図、相当算・
// 損益算・年令算に線分図を付与した新テンプレを追加する。答えはすべてコード計算。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_wariai.json');
const old = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let idN = 0;
const nid = () => 'sw' + String(++idN).padStart(3, '0');
const fmt = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// ---------- SVG ----------
const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12) => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="middle" font-family="sans-serif" font-weight="bold">${s}</text>`;

// 比の線分図（2分割）
function figRatio2(a, b, total, la = 'A', lb = 'B') {
  const x0 = 25, w = 190, h = 26, y = 40;
  const wa = Math.round(w * a / (a + b));
  const body =
    `<rect x="${x0}" y="${y}" width="${wa}" height="${h}" fill="${BL}" stroke="${WT}" stroke-width="1"/>` +
    `<rect x="${x0 + wa}" y="${y}" width="${w - wa}" height="${h}" fill="${PK}" stroke="${WT}" stroke-width="1"/>` +
    txt(x0 + wa / 2, y + 17, `${la} ${a}`, '#fff', 11) + txt(x0 + wa + (w - wa) / 2, y + 17, `${lb} ${b}`, '#fff', 11) +
    `<line x1="${x0}" y1="${y - 8}" x2="${x0 + w}" y2="${y - 8}" stroke="${YE}" stroke-width="1"/>` +
    txt(x0 + w / 2, y - 12, total, YE, 11);
  return S('240 84', body);
}
// 比の線分図（3分割）
function figRatio3(a, b, c, total) {
  const x0 = 20, w = 200, h = 26, y = 40, s = a + b + c;
  const wa = Math.round(w * a / s), wb = Math.round(w * b / s), wc = w - wa - wb;
  const body =
    `<rect x="${x0}" y="${y}" width="${wa}" height="${h}" fill="${BL}" stroke="${WT}"/>` +
    `<rect x="${x0 + wa}" y="${y}" width="${wb}" height="${h}" fill="${GN}" stroke="${WT}"/>` +
    `<rect x="${x0 + wa + wb}" y="${y}" width="${wc}" height="${h}" fill="${PK}" stroke="${WT}"/>` +
    txt(x0 + wa / 2, y + 17, `A${a}`, '#fff', 10) + txt(x0 + wa + wb / 2, y + 17, `B${b}`, '#0d1530', 10) + txt(x0 + wa + wb + wc / 2, y + 17, `C${c}`, '#fff', 10) +
    txt(x0 + w / 2, y - 10, total, YE, 11);
  return S('240 82', body);
}
// 食塩水の面積図（横＝食塩水の重さ、縦＝濃度）
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
// 相当算・割合の帯（全体を1として一部を示す）
function figWhole(fracLabel, whole = '?') {
  const x0 = 25, w = 190, h = 26, y = 42;
  const body =
    `<rect x="${x0}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${BL}" stroke-width="2"/>` +
    `<rect x="${x0}" y="${y}" width="${Math.round(w * 0.6)}" height="${h}" fill="${BL}" opacity="0.3"/>` +
    txt(x0 + w * 0.3, y + 17, fracLabel, YE, 11) +
    `<line x1="${x0}" y1="${y - 8}" x2="${x0 + w}" y2="${y - 8}" stroke="${YE}" stroke-width="1"/>` +
    txt(x0 + w / 2, y - 12, `全体 ${whole}`, YE, 10);
  return S('240 84', body);
}

const out = [];
function add(grade, diff, question, answer, meaning, svg) {
  out.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, ...(svg ? { svg } : {}) });
}
function norm(s) { return String(s || '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/[：:／/]/g, '').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }

// ---------- Pass1: 既存を各セル・各テンプレ最大10問に間引き ----------
const CAP = 10;
const counter = {};
for (const q of old) {
  const key = q.grade + '-' + q.difficulty + '|' + norm(q.question);
  counter[key] = (counter[key] || 0) + 1;
  if (counter[key] <= CAP) out.push({ ...q, id: nid() });
}

// ---------- Pass2: 図つきの新テンプレを追加 ----------
// 分配算（線分図）: 5-3 / 6-2
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
[[3, 5, 5], [4, 3, 7], [5, 7, 6], [7, 5, 8], [2, 7, 9], [5, 4, 6], [8, 5, 4], [6, 7, 5]].forEach(([a, b, unit]) =>
  add(5, 3, `${(a + b) * unit}個のあめをAとBで${a}：${b}の比に分けます。Aは何個もらえますか？`, a * unit,
    `全体を${a + b}とすると1あたり${(a + b) * unit}÷${a + b}＝${unit}個。Aは${a}×${unit}＝${a * unit}個です。`, figRatio2(a, b, `${(a + b) * unit}個`)));
[[2, 3, 4, 6], [1, 2, 3, 5], [3, 4, 5, 4], [2, 5, 3, 3], [4, 3, 2, 7], [1, 3, 5, 4], [3, 2, 4, 5], [5, 3, 2, 6]].forEach(([a, b, c, unit]) =>
  add(6, 2, `${(a + b + c) * unit}円をA・B・Cで${a}：${b}：${c}に分けます。Bの取り分は何円ですか？`, b * unit,
    `全体${a + b + c}のうちBは${b}。1あたり${(a + b + c) * unit}÷${a + b + c}＝${unit}円。B＝${b}×${unit}＝${b * unit}円です。`, figRatio3(a, b, c, `${(a + b + c) * unit}円`)));

// 割合の三用法（帯）: 5-1 / 5-2
[[400, 25], [800, 15], [600, 40], [500, 60], [1200, 35], [900, 20], [750, 12], [1500, 8]].forEach(([base, p]) =>
  add(5, 1, `${base}円の${p}%は何円ですか？`, Math.round(base * p / 100 * 100) / 100,
    `くらべる量＝もとにする量×割合。${base}×0.${p < 10 ? '0' + p : p}＝${fmt(base * p / 100)}円です。`, figWhole(`${p}%`, `${base}円`)));
[[120, 30], [200, 50], [150, 60], [80, 25], [240, 75], [180, 40], [90, 20], [160, 45]].forEach(([comp, p]) =>
  add(5, 2, `ある数の${p}%が${comp}です。ある数はいくつですか？`, Math.round(comp / (p / 100) * 100) / 100,
    `もとにする量＝くらべる量÷割合。${comp}÷0.${p < 10 ? '0' + p : p}＝${fmt(comp / (p / 100))}です。`, figWhole(`${p}%＝${comp}`)));

// 食塩水（面積図）: 6-4 / 6-5
[[8, 200], [10, 300], [5, 400], [12, 150], [6, 250], [15, 200], [4, 500], [20, 100]].forEach(([c, g]) =>
  add(6, 4, `${c}%の食塩水が${g}gあります。とけている食塩は何gですか？`, Math.round(g * c / 100 * 100) / 100,
    `食塩＝食塩水×濃度。${g}×0.${c < 10 ? '0' + c : c}＝${fmt(g * c / 100)}gです。`, figMenseki(c, g, '食塩水')));
[[10, 200, 5, 300], [8, 300, 12, 100], [6, 400, 15, 200], [4, 200, 10, 200], [9, 300, 3, 100], [12, 250, 6, 250], [15, 100, 5, 300], [20, 150, 4, 350]].forEach(([c1, g1, c2, g2]) => {
  const salt = g1 * c1 / 100 + g2 * c2 / 100, tot = g1 + g2, ans = Math.round(salt / tot * 100 * 100) / 100;
  add(6, 5, `${c1}%の食塩水${g1}gと${c2}%の食塩水${g2}gを混ぜると、何%の食塩水になりますか？`, ans,
    `食塩の合計＝${fmt(g1 * c1 / 100)}＋${fmt(g2 * c2 / 100)}＝${fmt(salt)}g、全体${tot}g。${fmt(salt)}÷${tot}×100＝${fmt(ans)}%です。`, figMenseki(c1, g1, '混ぜる'));
});

// 相当算（線分図）: 5-4
[[3, 2, 5, 3600], [2, 3, 4, 4000], [4, 1, 3, 3000], [3, 1, 2, 5000], [5, 2, 3, 2400], [2, 5, 2, 6000], [3, 4, 3, 3200], [4, 3, 2, 4800]].forEach(([d1, n1, d2, rem]) => {
  // 全体の1/d1使い、残りの n1/d2 使い、rem 残る → 全体X: X*(1-1/d1)*(1-n1/d2)=rem
  const r1 = 1 - 1 / d1, r2 = 1 - n1 / d2, X = rem / (r1 * r2);
  if (!Number.isInteger(X)) return;
  add(5, 4, `持っていたお金の${d1 === 2 ? '半分' : '1/' + d1}を使い、次に残りの${n1}/${d2}を使ったところ、${rem}円残りました。はじめに何円持っていましたか？`, X,
    `残りは全体の(1－1/${d1})×(1－${n1}/${d2})＝${fmt(r1)}×${fmt(r2)}＝${fmt(r1 * r2)}。これが${rem}円なので、${rem}÷${fmt(r1 * r2)}＝${X}円です。`, figWhole(`使った分`, '?円'));
});

// 損益算（線分図）: 6-5
[[2, 1, 160], [3, 1, 240], [2, 2, 100], [4, 1, 300], [3, 2, 180], [2, 3, 80], [5, 2, 420], [4, 3, 200]].forEach(([up, down, profit]) => {
  // 原価X、定価=X*(1+up/10)、売価=定価*(1-down/10)、利益=売価-X
  const rate = (1 + up / 10) * (1 - down / 10) - 1, X = profit / rate;
  if (!Number.isInteger(X) || rate <= 0) return;
  add(6, 5, `原価の${up}割増しの定価をつけた品物を、定価の${down}割引きで売ったところ、${profit}円の利益がありました。原価は何円ですか？`, X,
    `売価は原価の(1＋0.${up})×(1－0.${down})＝${fmt(1 + up / 10)}×${fmt(1 - down / 10)}＝${fmt(1 + rate)}倍。利益は原価の${fmt(rate)}倍なので、${profit}÷${fmt(rate)}＝${X}円です。`, figWhole(`利益 ${profit}円`, '原価?'));
});

// 年令算（線分図）: 5-4
[[42, 12, 2], [45, 15, 2], [36, 8, 3], [50, 10, 3], [40, 16, 2], [48, 12, 3], [38, 14, 2], [44, 8, 4]].forEach(([f, c, mult]) => {
  // 父f、子c、何年後にf+t = mult*(c+t) → t=(f-mult*c)/(mult-1)
  const t = (f - mult * c) / (mult - 1);
  if (!Number.isInteger(t) || t < 0) return;
  add(5, 4, `いまお父さんは${f}才、子どもは${c}才です。お父さんの年令が子どもの年令のちょうど${mult}倍になるのは何年後ですか？`, t,
    `${mult}倍になる年をtとすると ${f}＋t＝${mult}×(${c}＋t)。これを解くとt＝(${f}－${mult}×${c})÷(${mult}－1)＝${t}年後です。`, figRatio2(mult, 1, `年令`, '父', '子'));
});

// 連比（3分割の線分図）: 6-3 / 5-3
[[2, 3, 4, 5], [4, 5, 2, 3], [3, 2, 5, 6], [5, 4, 3, 7], [2, 5, 3, 4], [6, 5, 2, 3], [3, 4, 4, 5], [4, 3, 6, 5], [5, 6, 2, 3], [2, 3, 5, 4]].forEach(([ab_a, ab_b, bc_b, bc_c]) => {
  // A:B=ab_a:ab_b, B:C=bc_b:bc_c → 合わせる（Bをそろえる）
  const l = ab_b * bc_b / gcd(ab_b, bc_b);
  const A = ab_a * (l / ab_b), B = l, C = bc_c * (l / bc_b);
  const g = gcd(gcd(A, B), C), a2 = A / g, b2 = B / g, c2 = C / g;
  add(6, 3, `A：B＝${ab_a}：${ab_b}、B：C＝${bc_b}：${bc_c}のとき、A：B：Cを最も簡単な整数の比で表すと${a2}：${b2}：□です。□に入る数を求めなさい。`, c2,
    `Bをそろえる。A：B：C＝${a2}：${b2}：${c2}なので□は${c2}です。`, figRatio3(a2, b2, c2, 'A：B：C'));
});

// 連比→実数配分（3分割の線分図）: 6-3
[[2, 3, 4, 5, 4], [3, 2, 5, 6, 3], [4, 5, 2, 3, 5], [2, 5, 3, 4, 6], [5, 4, 3, 7, 2], [3, 4, 4, 5, 4], [4, 3, 6, 5, 3], [5, 6, 2, 3, 5]].forEach(([ab_a, ab_b, bc_b, bc_c, unit]) => {
  const l = ab_b * bc_b / gcd(ab_b, bc_b);
  let A = ab_a * (l / ab_b), B = l, C = bc_c * (l / bc_b);
  const g = gcd(gcd(A, B), C); A /= g; B /= g; C /= g;
  const total = (A + B + C) * unit;
  add(6, 3, `A：B＝${ab_a}：${ab_b}、B：C＝${bc_b}：${bc_c}です。3つの合計が${total}のとき、Cはいくつですか？`, C * unit,
    `連比にすると A：B：C＝${A}：${B}：${C}。合計${A + B + C}が${total}なので1あたり${unit}。C＝${C}×${unit}＝${C * unit}です。`, figRatio3(A, B, C, `合計${total}`));
});

// 比例配分（線分図）: 6-1
[[2, 3, 30], [3, 5, 40], [4, 5, 27], [5, 7, 36], [3, 4, 42], [2, 7, 45], [5, 6, 33], [4, 7, 44]].forEach(([a, b, total]) =>
  add(6, 1, `${total}本のえん筆を、姉と妹で${a}：${b}に分けます。姉は何本もらえますか？`, Math.round(total * a / (a + b) * 100) / 100,
    `姉は全体の${a}/${a + b}。${total}×${a}÷${a + b}＝${fmt(total * a / (a + b))}本です。`, figRatio2(a, b, `${total}本`, '姉', '妹')));

// 食塩水：水を加える／蒸発（面積図）: 6-4
[[10, 200, 50], [8, 300, 100], [12, 150, 150], [6, 400, 200], [15, 200, 100], [9, 300, 150], [20, 100, 300], [5, 250, 250]].forEach(([c, g, addw]) => {
  const salt = g * c / 100, ans = Math.round(salt / (g + addw) * 100 * 100) / 100;
  add(6, 4, `${c}%の食塩水${g}gに水を${addw}g加えると、濃度は何%になりますか？`, ans,
    `食塩は${fmt(salt)}gのまま、全体は${g + addw}g。${fmt(salt)}÷${g + addw}×100＝${fmt(ans)}%です。`, figMenseki(c, g, '水を加える'));
});

let clean = out.filter(q => q && q.question);

// ---------- 最終キャップ：各セル×テンプレを最大10問（図つきを優先） ----------
const FINAL_CAP = 10;
const cnt = {};
const svgFirst = [...clean].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0));
const keepSet = new Set();
for (const q of svgFirst) {
  const k = q.grade + '-' + q.difficulty + '|' + norm(q.question);
  cnt[k] = (cnt[k] || 0) + 1;
  if (cnt[k] <= FINAL_CAP) keepSet.add(q.id);
}
clean = clean.filter(q => keepSet.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(clean, null, 2), 'utf8');

// レポート
const cell = {};
clean.forEach(q => { const k = q.grade + '-' + q.difficulty; (cell[k] = cell[k] || []).push(q); });
console.log('総数:', clean.length, ' 図あり:', clean.filter(q => q.svg).length);
Object.keys(cell).sort().forEach(k => {
  const t = new Set(cell[k].map(q => norm(q.question)));
  const mx = Math.max(...Object.values(cell[k].reduce((m, q) => { const n = norm(q.question); m[n] = (m[n] || 0) + 1; return m; }, {})));
  console.log(`  ${k}: ${cell[k].length}問 / ${t.size}テンプレ / 最多${mx} / 図${cell[k].filter(q => q.svg).length}`);
});
