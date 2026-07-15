// 速さに「テーマ違い」を追加して多様化する。乗り物（新幹線・飛行機）や
// 動物の競走（カメとウサギ・チーターとシマウマ）など、身近で楽しい設定に
// 置きかえた旅人算・速さの三公式を線分図つきで追加する。答えはコード計算。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_hayasa.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let maxId = Math.max(...data.map(q => Number(q.id.slice(2))));
const nid = () => 'sh' + String(++maxId).padStart(3, '0');

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', PK = '#ff6688', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;
const arrowR = (x1, x2, y, c = RD) => `<line x1="${x1}" y1="${y}" x2="${x2 - 6}" y2="${y}" stroke="${c}" stroke-width="2.5"/><polygon points="${x2},${y} ${x2 - 8},${y - 4} ${x2 - 8},${y + 4}" fill="${c}"/>`;
const arrowL = (x1, x2, y, c = PK) => `<line x1="${x1 + 6}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c}" stroke-width="2.5"/><polygon points="${x2},${y} ${x2 + 8},${y - 4} ${x2 + 8},${y + 4}" fill="${c}"/>`;
const dot = (x, y, c) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/>`;

function figRoad(distLabel) {
  const b = `<line x1="30" y1="55" x2="210" y2="55" stroke="${BL}" stroke-width="3"/>` + dot(30, 55, YE) + dot(210, 55, YE) +
    arrowR(40, 200, 42, RD) + txt(120, 34, distLabel, YE, 12);
  return S('240 90', b);
}
function figMeet(distLabel, aLabel, bLabel) {
  const b = `<line x1="30" y1="55" x2="210" y2="55" stroke="${BL}" stroke-width="3"/>` + dot(30, 55, YE) + dot(210, 55, YE) +
    arrowR(38, 105, 42, RD) + arrowL(202, 135, 42, PK) + txt(30, 78, aLabel, RD, 11) + txt(210, 78, bLabel, PK, 11) + txt(120, 34, distLabel, YE, 12);
  return S('240 90', b);
}
function figChase(gapLabel, backL, frontL) {
  const b = `<line x1="20" y1="58" x2="220" y2="58" stroke="${BL}" stroke-width="3"/>` + dot(45, 58, RD) + dot(150, 58, PK) +
    arrowR(52, 92, 44, RD) + arrowR(157, 190, 44, PK) + txt(45, 80, backL, RD, 10) + txt(150, 80, frontL, PK, 10) +
    txt(97, 34, gapLabel, YE, 12) + `<line x1="45" y1="24" x2="150" y2="24" stroke="${YE}" stroke-width="1" stroke-dasharray="3 2"/>`;
  return S('240 92', b);
}

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
function add(grade, diff, question, answer, meaning, svg) {
  data.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}
const fmt = n => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// ① 新幹線の速さ（道のり÷時間）: 5-1
[[600, 3], [720, 3], [810, 3], [900, 3], [560, 2], [840, 4]].forEach(([d, t]) =>
  add(5, 1, `新幹線が${d}kmを${t}時間で走りました。速さは時速何kmですか？`, d / t,
    `速さ＝道のり÷時間＝${d}÷${t}＝${d / t}。時速${d / t}kmです。`, figRoad(`${d}km`)));
// ② 飛行機（速さ×時間＝道のり）: 6-1
[[800, 3], [900, 4], [750, 6], [850, 2], [600, 5], [720, 3]].forEach(([s, t]) =>
  add(6, 1, `飛行機が時速${s}kmで${t}時間飛ぶと、何km進みますか？`, s * t,
    `道のり＝速さ×時間＝${s}×${t}＝${s * t}kmです。`, figRoad(`時速${s}km × ${t}時間`)));

// ③ カメとウサギの競走（追いつき）: 5-3
[[80, 20, 600], [70, 15, 550], [90, 30, 480], [100, 25, 750], [60, 12, 480], [85, 35, 500]].forEach(([usa, kame, gap]) =>
  add(5, 3, `ウサギは分速${usa}m、カメは分速${kame}mで進みます。カメが${gap}m先にいるとき、ウサギが追いつくのは何分後ですか？`, gap / (usa - kame),
    `追いつく時間＝差÷速さの差＝${gap}÷(${usa}－${kame})＝${gap}÷${usa - kame}＝${fmt(gap / (usa - kame))}分後です。`, figChase(`${gap}m`, 'ウサギ', 'カメ')));

// ④ チーターとシマウマの競走（出会い）: 5-4
[[20, 15, 70], [25, 10, 105], [18, 12, 90], [30, 20, 100], [22, 14, 72], [28, 12, 80]].forEach(([cheetah, zebra, dist]) =>
  add(5, 4, `${dist}kmはなれた2地点から、チーターは時速${cheetah}km、シマウマは時速${zebra}kmで向かい合って同時に走ります。出会うのは何分後ですか？`, Math.round(dist / (cheetah + zebra) * 60 * 100) / 100,
    `出会う時間＝${dist}÷(${cheetah}＋${zebra})時間＝${dist}÷${cheetah + zebra}時間＝${fmt(dist / (cheetah + zebra) * 60)}分後です。`, figMeet(`${dist}km`, 'チーター', 'シマウマ')));

// ⑤ 犬が自転車を追いかける（追いつき）: 6-4
[[420, 300, 360], [500, 350, 450], [480, 320, 480], [360, 240, 300], [540, 360, 540], [450, 300, 600]].forEach(([dog, bike, gap]) =>
  add(6, 4, `犬が分速${dog}mで、${gap}m先を分速${bike}mで進む自転車を追いかけます。追いつくのは何分後ですか？`, gap / (dog - bike),
    `追いつく時間＝${gap}÷(${dog}－${bike})＝${gap}÷${dog - bike}＝${fmt(gap / (dog - bike))}分後です。`, figChase(`${gap}m`, '犬', '自転車')));

// ⑥ ボートと川（流れに乗る/逆らう、動物のいかだ）: 6-2
[[12, 3], [15, 5], [18, 6], [20, 4], [14, 7], [16, 4]].forEach(([still, cur]) =>
  add(6, 2, `カヌーが静水では時速${still}kmで進みます。流れ時速${cur}kmの川を下るとき、下りの速さは時速何kmですか？`, still + cur,
    `下りの速さ＝静水＋流れ＝${still}＋${cur}＝${still + cur}kmです。`, figRoad(`下り ${still + cur}km/時`)));

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
