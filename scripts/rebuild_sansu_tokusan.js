// 特殊算（sansu_tokusan.json）を「間引き＋多様化＋図」で再構成。
// 小5〜6の多くのセルが1〜2テンプレ×最大60問と同一問題の数字違いで、図も0枚。
// 全テンプレ最大10問に圧縮し、つるかめ算に面積図、和差算・過不足算・植木算・
// 仕事算・年令算に線分図を付与した新テンプレを追加する。答えはすべてコード計算。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_tokusan.json');
const old = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let idN = 0;
const nid = () => 'st' + String(++idN).padStart(3, '0');

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', GN = '#38d9a9', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// つるかめ算の面積図（横＝匹数、縦＝1匹の足）
function figTsuru(total, small, big, nameS, nameB) {
  const x0 = 34, yb = 84, W = 168, Hs = small * 9, Hd = (big - small) * 9;
  const body =
    `<rect x="${x0}" y="${yb - Hs}" width="${W}" height="${Hs}" fill="${BL}" opacity="0.3" stroke="${BL}" stroke-width="1.5"/>` +
    `<rect x="${x0}" y="${yb - Hs - Hd}" width="${W}" height="${Hd}" fill="${PK}" opacity="0.35" stroke="${PK}" stroke-width="1.5" stroke-dasharray="4 2"/>` +
    `<line x1="${x0}" y1="${yb}" x2="${x0 + W + 8}" y2="${yb}" stroke="${WT}" stroke-width="1.5"/>` +
    `<line x1="${x0}" y1="${yb}" x2="${x0}" y2="12" stroke="${WT}" stroke-width="1.5"/>` +
    txt(x0 + W / 2, yb + 14, `全部で${total}${/羽|匹/.test(nameS) ? '' : ''}`, WT, 10) +
    `<text x="16" y="${yb - Hs / 2}" fill="${BL}" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="bold" transform="rotate(-90 16 ${yb - Hs / 2})">${nameS}${small}本</text>` +
    txt(x0 + W / 2, yb - Hs - Hd / 2 + 3, `差の分`, '#0d1530', 9);
  return S('222 100', body);
}
// 和差算の線分図
function figSumDiff(sum, diff) {
  const x0 = 25, y1 = 30, y2 = 56, small = 120, ex = 44;
  const body =
    `<rect x="${x0}" y="${y1}" width="${small + ex}" height="18" fill="${PK}" opacity="0.55" stroke="${WT}"/>` + txt(x0 - 6, y1 + 14, '大', PK, 11, 'end') +
    `<rect x="${x0}" y="${y2}" width="${small}" height="18" fill="${BL}" opacity="0.55" stroke="${WT}"/>` + txt(x0 - 6, y2 + 14, '小', BL, 11, 'end') +
    `<rect x="${x0 + small}" y="${y2}" width="${ex}" height="18" fill="none" stroke="${YE}" stroke-dasharray="3 2"/>` +
    txt(x0 + small + ex / 2, y2 + 13, `差${diff}`, YE, 9) +
    txt(x0 + (small + ex) / 2, y1 - 6, `和は${sum}`, YE, 10);
  return S('220 86', body);
}
// 過不足算の線分図（2つの配り方）
function figSurplus(a, aState, b, bState) {
  const x0 = 25, w = 180;
  const body =
    txt(x0, 22, `${a}個ずつ`, BL, 10, 'start') + `<rect x="${x0 + 60}" y="14" width="${w - 60}" height="14" fill="${BL}" opacity="0.4" stroke="${WT}"/>` + txt(x0 + w + 6, 25, aState, YE, 9, 'start') +
    txt(x0, 52, `${b}個ずつ`, PK, 10, 'start') + `<rect x="${x0 + 60}" y="44" width="${w - 60}" height="14" fill="${PK}" opacity="0.4" stroke="${WT}"/>` + txt(x0 + w + 6, 55, bState, YE, 9, 'start') +
    txt(x0 + 60, 74, '1人あたりの差 × 人数 ＝ 全体の差', WT, 9, 'start');
  return S('300 84', body);
}
// 植木算の線分図
function figTree(len, gap) {
  const x0 = 20, x1 = 220, y = 40, n = Math.min(Math.floor(len / gap), 8);
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${BL}" stroke-width="2"/>`;
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; body += `<circle cx="${x}" cy="${y}" r="3.5" fill="${GN}"/><rect x="${x - 1}" y="${y}" width="2" height="8" fill="${GN}"/>`; }
  body += txt((x0 + x1) / 2, y - 10, `全長${len}m・${gap}mおき`, YE, 10);
  return S('240 62', body);
}
// 仕事算の線分図（全体を1）
function figWork(d1, d2) {
  const x0 = 25, w = 190, y = 40;
  const body = `<rect x="${x0}" y="${y}" width="${w}" height="20" fill="none" stroke="${YE}" stroke-width="2"/>` +
    txt(x0 + w / 2, y + 15, '全体の仕事＝1', YE, 11) +
    txt(x0 + w / 2, y - 8, `A:${d1}日  B:${d2}日`, WT, 10) +
    txt(x0 + w / 2, y + 36, '1日分＝1/日数', WT, 9);
  return S('240 88', body);
}

const out = [];
function add(grade, diff, question, answer, meaning, svg) {
  out.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, ...(svg ? { svg } : {}) });
}
function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => a / gcd(a, b) * b;

// ---------- Pass1: 既存を各テンプレ最大10問に圧縮 ----------
const counter = {};
for (const q of old) {
  const key = q.grade + '-' + q.difficulty + '|' + norm(q.question);
  counter[key] = (counter[key] || 0) + 1;
  if (counter[key] <= 10) out.push({ ...q, id: nid() });
}

// ---------- Pass2: 図つき新テンプレ ----------
// つるかめ算（面積図）: 5-2 / 6-3
[[23, 2, 4, 64], [30, 2, 4, 84], [20, 2, 4, 56], [25, 2, 4, 70], [18, 2, 4, 52], [28, 2, 4, 80], [15, 2, 4, 44], [22, 2, 4, 60]].forEach(([total, s, b, legs]) => {
  const kame = (legs - s * total) / (b - s), tsuru = total - kame;
  if (!Number.isInteger(kame) || kame < 0 || tsuru < 0) return;
  add(5, 2, `つるとかめが合わせて${total}匹います。足の数の合計は${legs}本です。かめは何匹いますか？`, kame,
    `全部つる（2本）なら足は${s * total}本。実際は${legs}本で${legs - s * total}本多い。かめ1匹で2本増えるので、かめ＝${legs - s * total}÷2＝${kame}匹です。`, figTsuru(total, s, b, 'つる', 'かめ'));
});
[[24, 2, 3, 57], [20, 2, 3, 52], [30, 2, 3, 68], [18, 2, 3, 44], [26, 2, 3, 60], [22, 2, 3, 50], [28, 2, 3, 64], [16, 2, 3, 40]].forEach(([total, s, b, wheels]) => {
  const three = wheels - s * total, two = total - three;
  if (three < 0 || two < 0 || !Number.isInteger(three)) return;
  add(6, 3, `2輪車と3輪車が合わせて${total}台あります。車輪の数の合計は${wheels}個です。3輪車は何台ありますか？`, three,
    `全部2輪なら${s * total}個。実際は${wheels}個で${three}個多く、3輪車1台で1個増えるので3輪車は${three}台です。`, figTsuru(total, s, b, '2輪', '3輪'));
});

// 和差算（線分図）: 5-1
[[20, 2], [101, 23], [50, 8], [88, 12], [34, 6], [72, 14], [46, 10], [60, 16]].forEach(([sum, diff]) => {
  const big = (sum + diff) / 2, small = (sum - diff) / 2;
  if (!Number.isInteger(big)) return;
  add(5, 1, `2つの数があります。和は${sum}、差は${diff}です。大きい方の数を求めなさい。`, big,
    `大きい方＝(和＋差)÷2＝(${sum}＋${diff})÷2＝${big}です。`, figSumDiff(sum, diff));
});

// 過不足算（線分図）: 5-4 / 6-4
[[3, 'あまり', 53, 6, 'あまり', 2], [2, 'あまり', 3, 3, 'たりない', 7], [4, 'あまり', 8, 6, 'たりない', 4], [5, 'あまり', 12, 8, 'たりない', 9], [3, 'あまり', 20, 5, 'たりない', 4], [4, 'あまり', 15, 7, 'たりない', 6], [2, 'あまり', 10, 5, 'たりない', 8], [6, 'あまり', 5, 9, 'たりない', 7]].forEach(([a, as, av, b, bs, bv]) => {
  // 1人a個であまりav、1人b個で（bs=たりない→不足bv / あまり→av2）
  const sa = as === 'あまり' ? -av : av, sb = bs === 'あまり' ? -bv : bv;
  const people = (sb - sa) / (b - a); // total = a*people + (av if amari)...
  if (!Number.isInteger(people) || people <= 0) return;
  const total = a * people + (as === 'あまり' ? av : -av);
  add(5, 4, `子どもたちにあめを配ります。1人に${a}個ずつ配ると${av}個${as}、1人に${b}個ずつ配ると${bv}個${bs}です。子どもの人数は何人ですか？`, people,
    `1人あたり${b - a}個の差が全体で${Math.abs(sb - sa)}個の差になる。人数＝${Math.abs(sb - sa)}÷${b - a}＝${people}人です。`, figSurplus(a, `${av}個${as}`, b, `${bv}個${bs}`));
});

// 植木算（線分図）: 6-1
[[60, 5], [72, 4], [80, 8], [90, 6], [100, 10], [48, 4], [120, 12], [66, 6]].forEach(([len, gap]) =>
  add(6, 1, `まっすぐな道の端から端まで${gap}mおきに木を植えます。道の長さが${len}mのとき、木は何本必要ですか？（両端にも植えます）`, len / gap + 1,
    `間の数＝${len}÷${gap}＝${len / gap}。両端に植えるので木は間の数＋1＝${len / gap + 1}本です。`, figTree(len, gap)));

// 仕事算（線分図）: 6-2
[[35, 14], [12, 4], [20, 30], [24, 8], [15, 10], [18, 9], [30, 20], [40, 24]].forEach(([d1, d2]) => {
  const L = lcm(d1, d2), ans = L / (L / d1 + L / d2);
  add(6, 2, `ある仕事をAさん1人ですると${d1}日、Bさん1人ですると${d2}日かかります。2人ですると何日かかりますか？`, Number.isInteger(ans) ? ans : Math.round(ans * 100) / 100,
    `全体を${L}とするとAは1日${L / d1}、Bは1日${L / d2}。2人で1日${L / d1 + L / d2}進むので、${L}÷${L / d1 + L / d2}＝${Number.isInteger(ans) ? ans : Math.round(ans * 100) / 100}日です。`, figWork(d1, d2));
});

// 年令算（線分図）: 5-3
[[29, 6, 2], [40, 10, 2], [36, 8, 3], [45, 9, 4], [30, 12, 2], [50, 14, 3], [42, 6, 4], [33, 11, 2]].forEach(([f, c, mult]) => {
  const t = (f - mult * c) / (mult - 1);
  if (!Number.isInteger(t) || t < 0) return;
  add(5, 3, `現在、父は${f}才、子は${c}才です。父の年れいが子の年れいのちょうど${mult}倍になるのは何年後ですか？`, t,
    `t年後に ${f}＋t＝${mult}×(${c}＋t)。解くとt＝${t}年後です。`, figSumDiff(f + c, f - c));
});

// 過不足算（あまり＋たりない・線分図）: 6-4
[[4, 8, 6, 4], [3, 10, 5, 6], [5, 6, 7, 8], [4, 12, 6, 6], [2, 15, 4, 5], [6, 5, 8, 9], [3, 8, 5, 4], [5, 10, 7, 6]].forEach(([a, av, b, bv]) => {
  // 1人a個であまり av、1人b個でたりない bv（a<b）
  const people = (av + bv) / (b - a);
  if (!Number.isInteger(people) || people <= 0) return;
  const total = a * people + av;
  add(6, 4, `子どもたちにみかんを配ります。1人に${a}個ずつ配ると${av}個あまり、1人に${b}個ずつ配ると${bv}個たりません。みかんは全部で何個ありますか？`, total,
    `配る差${b - a}個ずつが全体で${av + bv}個の差になる。人数＝(${av}＋${bv})÷${b - a}＝${people}人。みかんは${a}×${people}＋${av}＝${total}個です。`, figSurplus(a, `${av}個あまり`, b, `${bv}個たりない`));
});

let clean = out.filter(q => q && q.question);
const cnt2 = {}; const svgFirst = [...clean].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt2[k] = (cnt2[k] || 0) + 1; if (cnt2[k] <= 10) keep.add(q.id); }
clean = clean.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(clean, null, 2), 'utf8');

const cell = {};
clean.forEach(q => { const k = q.grade + '-' + q.difficulty; (cell[k] = cell[k] || []).push(q); });
console.log('総数:', clean.length, ' 図あり:', clean.filter(q => q.svg).length);
Object.keys(cell).sort().forEach(k => {
  const m = cell[k].reduce((a, q) => { const n = norm(q.question); a[n] = (a[n] || 0) + 1; return a; }, {});
  console.log(`  ${k}: ${cell[k].length}問 / ${Object.keys(m).length}テンプレ / 最多${Math.max(...Object.values(m))} / 図${cell[k].filter(q => q.svg).length}`);
});
