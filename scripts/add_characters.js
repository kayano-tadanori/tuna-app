// アプリのキャラクター「オットン（頼れる父）」「オカーン（おにぎりが得意な母）」
// 「チッチ（黄色いボタンインコ）」を算数の問題に登場させる。関西弁のふんいきで、
// 各キャラの個性に合ったお話にする。複数カテゴリに図つきで追加。答えはコード計算。
const fs = require('fs');
const path = require('path');
const D = f => path.join(__dirname, '..', 'data', 'sansu_' + f + '.json');
const load = f => JSON.parse(fs.readFileSync(D(f), 'utf8'));

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', GN = '#38d9a9', PK = '#ff6688', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;
const arrowR = (x1, x2, y, c = RD) => `<line x1="${x1}" y1="${y}" x2="${x2 - 6}" y2="${y}" stroke="${c}" stroke-width="2.5"/><polygon points="${x2},${y} ${x2 - 8},${y - 4} ${x2 - 8},${y + 4}" fill="${c}"/>`;
const arrowL = (x1, x2, y, c = PK) => `<line x1="${x1 + 6}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c}" stroke-width="2.5"/><polygon points="${x2},${y} ${x2 + 8},${y - 4} ${x2 + 8},${y + 4}" fill="${c}"/>`;
const dot = (x, y, c) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/>`;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => a / gcd(a, b) * b;
const divisors = n => { const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; };
const fmt = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/[：:／/]/g, '').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }

// 図ヘルパー
function figRoad(distLabel, emo) {
  const b = `<line x1="30" y1="55" x2="210" y2="55" stroke="${BL}" stroke-width="3"/>` + dot(30, 55, YE) + dot(210, 55, YE) +
    arrowR(40, 200, 42, RD) + txt(120, 34, distLabel, YE, 12) + (emo ? txt(30, 76, emo, WT, 15) : '');
  return S('240 90', b);
}
function figChase(gapLabel, backL, frontL) {
  const b = `<line x1="20" y1="58" x2="220" y2="58" stroke="${BL}" stroke-width="3"/>` + dot(45, 58, RD) + dot(150, 58, PK) +
    arrowR(52, 92, 44, RD) + arrowR(157, 190, 44, PK) + txt(45, 80, backL, RD, 10) + txt(150, 80, frontL, PK, 10) +
    txt(97, 34, gapLabel, YE, 12) + `<line x1="45" y1="24" x2="150" y2="24" stroke="${YE}" stroke-width="1" stroke-dasharray="3 2"/>`;
  return S('240 92', b);
}
function figSumDiff(sum, diff, bigL, smallL) {
  const x0 = 25, y1 = 30, y2 = 56, small = 120, ex = 44;
  return S('230 86', `<rect x="${x0}" y="${y1}" width="${small + ex}" height="18" fill="${PK}" opacity="0.55" stroke="${WT}"/>` + txt(x0 - 6, y1 + 14, bigL, PK, 10, 'end') +
    `<rect x="${x0}" y="${y2}" width="${small}" height="18" fill="${BL}" opacity="0.55" stroke="${WT}"/>` + txt(x0 - 6, y2 + 14, smallL, BL, 10, 'end') +
    `<rect x="${x0 + small}" y="${y2}" width="${ex}" height="18" fill="none" stroke="${YE}" stroke-dasharray="3 2"/>` + txt(x0 + small + ex / 2, y2 + 13, `差${diff}`, YE, 9) +
    txt(x0 + (small + ex) / 2, y1 - 6, `和は${sum}`, YE, 10));
}
function figTsuru(total, sVal, bVal, sName, bName, unit) {
  const x0 = 40, yb = 82, W = 158, scale = 58 / bVal, Hs = sVal * scale, Hd = (bVal - sVal) * scale;
  return S('220 100', `<rect x="${x0}" y="${yb - Hs}" width="${W}" height="${Hs}" fill="${BL}" opacity="0.32" stroke="${BL}" stroke-width="1.5"/>` +
    `<rect x="${x0}" y="${yb - Hs - Hd}" width="${W}" height="${Hd}" fill="${PK}" opacity="0.35" stroke="${PK}" stroke-width="1.5" stroke-dasharray="4 2"/>` +
    `<line x1="${x0}" y1="${yb}" x2="${x0 + W + 8}" y2="${yb}" stroke="${WT}" stroke-width="1.5"/><line x1="${x0}" y1="${yb}" x2="${x0}" y2="14" stroke="${WT}" stroke-width="1.5"/>` +
    txt(x0 + W / 2, yb + 14, `全部で${total}`, WT, 10) +
    `<text x="14" y="${yb - Hs / 2}" fill="${BL}" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="bold" transform="rotate(-90 14 ${yb - Hs / 2})">${sName}${sVal}${unit}</text>` +
    `<text x="26" y="${yb - Hs - Hd / 2 + 3}" fill="${PK}" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="bold" transform="rotate(-90 26 ${yb - Hs - Hd / 2 + 3})">${bName}${bVal}${unit}</text>`);
}
function figTree(a, b, l1, l2) {
  const rootX = 18, x1 = 95, x2 = 180, topY = 16, H = 108, rootY = topY + H / 2;
  const y1 = i => topY + H * (i + 0.5) / a, childSpacing = H / (a * (b + 0.6));
  let body = '';
  for (let i = 0; i < a; i++) {
    body += `<line x1="${rootX + 6}" y1="${rootY}" x2="${x1}" y2="${y1(i)}" stroke="${BL}" stroke-width="1.4"/><circle cx="${x1}" cy="${y1(i)}" r="4" fill="${BL}"/>`;
    for (let j = 0; j < b; j++) { const yy = y1(i) + (j - (b - 1) / 2) * childSpacing; body += `<line x1="${x1}" y1="${y1(i)}" x2="${x2}" y2="${yy}" stroke="${GN}" stroke-width="1"/><circle cx="${x2}" cy="${yy}" r="3" fill="${GN}"/>`; }
  }
  body += `<circle cx="${rootX}" cy="${rootY}" r="4" fill="${YE}"/>` + txt(x1, 12, l1, BL, 10) + txt(x2 + 6, 12, l2, GN, 10);
  return S('220 132', body);
}
function figBird(step, max) {
  const x0 = 20, x1 = 224, y = 48, n = Math.min(Math.floor(max / step), 7);
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${WT}" stroke-width="2"/><polygon points="${x1},${y} ${x1 - 7},${y - 4} ${x1 - 7},${y + 4}" fill="${WT}"/>` + txt(x0, y + 15, '0', WT, 10);
  for (let i = 1; i <= n; i++) {
    const px = x0 + (i / (n + 0.5)) * (x1 - x0 - 12), pxPrev = x0 + ((i - 1) / (n + 0.5)) * (x1 - x0 - 12);
    body += `<path d="M${pxPrev} ${y} Q ${(px + pxPrev) / 2} ${y - 20} ${px} ${y}" fill="none" stroke="${YE}" stroke-width="1.5" stroke-dasharray="3 2"/><circle cx="${px}" cy="${y}" r="4" fill="${YE}"/>` + txt(px, y + 15, i * step, YE, 10);
  }
  body += txt(x0 + 8, y - 24, '🐤', WT, 13, 'start');
  return S('240 68', body);
}

// 追加をためる
const adds = {}; // file -> [items]
const nextId = {};
function pushAdd(file, prefix, grade, diff, question, answer, meaning, svg) {
  if (!adds[file]) { adds[file] = []; nextId[file] = Math.max(...load(file).map(q => Number(q.id.slice(2)))); }
  const id = prefix + String(++nextId[file]).padStart(3, '0');
  adds[file].push({ id, question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}

// ============ オットン（頼れる父・現場・車） ============
// 速さ：オットンが現場へ車で
[[240, 4], [360, 6], [300, 5], [420, 7]].forEach(([d, t]) =>
  pushAdd('hayasa', 'sh', 5, 1, `オットンが現場まで${d}kmの道のりを車で${t}時間かけて行きました。車の速さは時速何kmですか？`, d / t,
    `速さ＝道のり÷時間＝${d}÷${t}＝${d / t}。オットンの車は時速${d / t}kmや！`, figRoad(`${d}km`, '🧑‍🔧')));
// 和差算：オットンとオカーンの年れい
[[70, 4], [76, 6], [80, 2], [66, 8]].forEach(([sum, diff]) =>
  pushAdd('tokusan', 'st', 5, 1, `オットンとオカーンの年れいを合わせると${sum}才で、オットンはオカーンより${diff}才年上です。オットンは何才ですか？`, (sum + diff) / 2,
    `オットン＝(和＋差)÷2＝(${sum}＋${diff})÷2＝${(sum + diff) / 2}才です。`, figSumDiff(sum, diff, '父', '母')));
// 植木算：オットンが現場にコーンを並べる
[[60, 5], [72, 6], [90, 6], [48, 4]].forEach(([len, gap]) =>
  pushAdd('tokusan', 'st', 6, 1, `オットンがまっすぐな道の両はしもふくめて${gap}mおきに、工事用のコーンを置きます。道が${len}mのとき、コーンは何本いりますか？`, len / gap + 1,
    `間の数＝${len}÷${gap}＝${len / gap}。両はしにも置くので${len / gap + 1}本。現場はまかせとけ！`, figRoad(`${len}m ・ ${gap}mおき`, '🚧')));

// ============ オカーン（おにぎりが得意な母・料理） ============
// つるかめ：オカーンのおにぎりとたこ焼き（値段）
[[15, 6], [12, 5], [20, 8], [10, 4]].forEach(([total, nBig]) => {
  const nSmall = total - nBig, money = 80 * nSmall + 120 * nBig;
  pushAdd('tokusan', 'st', 5, 2, `オカーンが1個80円のおにぎりと1個120円のたこ焼きを合わせて${total}個作りました。材料費の合計は${money}円です。たこ焼きは何個ですか？`, nBig,
    `全部おにぎりなら${80 * total}円。実際は${money}円で${money - 80 * total}円多く、たこ焼き1個で40円ふえるので、たこ焼きは${(money - 80 * total) / 40}個や！`, figTsuru(total, 80, 120, 'おにぎり', 'たこ焼き', '円'));
});
// 数の性質：おにぎりを余りなく配る（約数）
[[24], [36], [18], [30]].forEach(([n]) =>
  pushAdd('kazu', 'sn', 4, 1, `オカーンが${n}個のおにぎりを、余りが出ないように何人かで同じ数ずつ分けます。分けられる人数は全部で何通りありますか？`, divisors(n).length,
    `余りなく分けられる人数は${n}の約数。${n}の約数は${divisors(n).join('、')}の${divisors(n).length}個やから${divisors(n).length}通り。`, S('240 40', txt(120, 26, `${n}の約数：${divisors(n).join('、')}`, YE, 11))));
// 割合：オカーンの料理（さとうの割合＝面積図的にfigTsuruは不向き→帯）: wariai
[[8, 200], [10, 300], [6, 250], [12, 150]].forEach(([c, g]) =>
  pushAdd('wariai', 'sw', 6, 4, `オカーンが作った${g}gの砂糖水は、こさが${c}%です。とけている砂糖は何gですか？`, Math.round(g * c / 100 * 100) / 100,
    `砂糖＝砂糖水×こさ＝${g}×0.${c < 10 ? '0' + c : c}＝${fmt(g * c / 100)}g。オカーンの味つけはバッチリや！`,
    S('230 70', `<rect x="30" y="24" width="170" height="26" fill="none" stroke="${BL}" stroke-width="2"/><rect x="30" y="24" width="${Math.round(170 * c / 100)}" height="26" fill="${BL}" opacity="0.4"/>` + txt(115, 18, `全体 ${g}g`, YE, 10) + txt(30 + 85, 42, `さとう ${c}%`, YE, 10))));

// ============ チッチ（黄色いボタンインコ・ナッツ・飛ぶ） ============
// 速さ：チッチが飛ぶ
[[60, 5], [80, 4], [90, 6], [70, 5]].forEach(([s, t]) =>
  pushAdd('hayasa', 'sh', 5, 1, `チッチが分速${s}mで${t}分間飛ぶと、何m進みますか？`, s * t,
    `道のり＝速さ×時間＝${s}×${t}＝${s * t}m。チッチ、ようとんだ！`, figRoad(`分速${s}m × ${t}分`, '🐤')));
// 旅人算：チッチがオットンを追いかける（追いつき）
[[120, 80, 240], [150, 90, 360], [100, 60, 200], [140, 100, 320]].forEach(([bird, otton, gap]) =>
  pushAdd('hayasa', 'sh', 5, 3, `オットンが分速${otton}mで歩いています。${gap}m後ろからチッチが分速${bird}mで飛んで追いかけます。追いつくのは何分後ですか？`, gap / (bird - otton),
    `追いつく時間＝差÷速さの差＝${gap}÷(${bird}－${otton})＝${gap / (bird - otton)}分後。チッチ、まちや〜！`, figChase(`${gap}m`, 'チッチ', 'オットン')));
// 場合の数：チッチのごはん（ナッツ×くだもの・樹形図）
[[3, 4], [2, 5], [4, 3], [3, 3]].forEach(([a, b]) =>
  pushAdd('baai', 'sc', 3, 1, `チッチのごはんは、ナッツが${a}種類、くだものが${b}種類あります。ナッツとくだものを1つずつ選ぶと、組み合わせは何通りですか？`, a * b,
    `ナッツ${a}通りそれぞれにくだもの${b}通りで、${a}×${b}＝${a * b}通り。チッチはどれにしよかな？`, figTree(a, b, 'ナッツ', 'くだもの')));
// 規則性：チッチが枝を飛び移る（倍数・数直線）
[[3, 27], [4, 32], [5, 40], [6, 42]].forEach(([step, goal]) =>
  pushAdd('kisoku', 'sr', 4, 1, `チッチが0の枝から右へ${step}ずつ飛び移ります。ちょうど${goal}の枝にとまるのは、何回目で飛んだときですか？`, goal / step,
    `${step}の倍数にとまる。${goal}÷${step}＝${goal / step}回目や！`, figBird(step, goal)));

// ============ 書き込み（各セル×テンプレ最大10、図つき優先） ============
let report = [];
for (const file of Object.keys(adds)) {
  const data = load(file).concat(adds[file]);
  const cnt = {}; const svgFirst = [...data].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
  for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] <= 10) keep.add(q.id); }
  const out = data.filter(q => keep.has(q.id));
  fs.writeFileSync(D(file), JSON.stringify(out, null, 2), 'utf8');
  report.push(`${file}: ${out.length}問 (＋${adds[file].length}キャラ問題) 図${out.filter(q => q.svg).length}`);
}
report.forEach(r => console.log(r));
