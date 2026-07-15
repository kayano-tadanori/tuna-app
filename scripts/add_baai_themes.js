// 場合の数に「楽しく学べる」テーマを追加する。服のコーディネートやメニュー選び（積の法則）、
// リレーの走順（順列）、じゃんけんの手の出方（3のくり返し）など、身近で楽しい設定を
// 樹形図などの図つきで増やす。件数より種類。答えはすべてコード計算で検証する。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_baai.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let maxId = Math.max(...data.map(q => Number(q.id.slice(2))));
const nid = () => 'sc' + String(++maxId).padStart(3, '0');

const BL = '#4f9eff', YE = '#ffd166', RD = '#ff6b6b', GN = '#38d9a9', PK = '#ff6688', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// 樹形図（1段目 a 本、各枝から 2段目 b 本）
function figTree(a, b, l1, l2) {
  const rootX = 18, x1 = 95, x2 = 180, topY = 16, H = 108, rootY = topY + H / 2;
  let body = '';
  const y1 = i => topY + H * (i + 0.5) / a;
  const childSpacing = H / (a * (b + 0.6));
  for (let i = 0; i < a; i++) {
    body += `<line x1="${rootX + 6}" y1="${rootY}" x2="${x1}" y2="${y1(i)}" stroke="${BL}" stroke-width="1.4"/>`;
    body += `<circle cx="${x1}" cy="${y1(i)}" r="4" fill="${BL}"/>`;
    for (let j = 0; j < b; j++) {
      const yy = y1(i) + (j - (b - 1) / 2) * childSpacing;
      body += `<line x1="${x1}" y1="${y1(i)}" x2="${x2}" y2="${yy}" stroke="${GN}" stroke-width="1"/>`;
      body += `<circle cx="${x2}" cy="${yy}" r="3" fill="${GN}"/>`;
    }
  }
  body += `<circle cx="${rootX}" cy="${rootY}" r="4" fill="${YE}"/>`;
  body += txt(x1, 12, l1, BL, 10) + txt(x2 + 6, 12, l2, GN, 10, 'middle');
  return S('220 132', body);
}
// じゃんけんの手（グー・チョキ・パー）
function figHands() {
  const y = 34;
  const gu = x => `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${RD}" stroke-width="2.5"/>` + txt(x, y + 22, 'グー', RD, 10);
  const choki = x => `<line x1="${x - 8}" y1="${y - 12}" x2="${x + 4}" y2="${y + 10}" stroke="${YE}" stroke-width="2.5"/><line x1="${x + 8}" y1="${y - 12}" x2="${x - 4}" y2="${y + 10}" stroke="${YE}" stroke-width="2.5"/>` + txt(x, y + 22, 'チョキ', YE, 10);
  const pa = x => `<rect x="${x - 12}" y="${y - 13}" width="24" height="26" rx="4" fill="none" stroke="${GN}" stroke-width="2.5"/>` + txt(x, y + 22, 'パー', GN, 10);
  return S('220 64', gu(45) + choki(110) + pa(175));
}
// 走順（順列）：N個の枠に順位
function figOrder(n, pick) {
  const x0 = 26, gap = 42, y = 30;
  let body = '';
  for (let i = 0; i < pick; i++) {
    body += `<rect x="${x0 + i * gap}" y="16" width="32" height="28" rx="4" fill="${BL}" opacity="0.25" stroke="${WT}"/>` + txt(x0 + i * gap + 16, 35, `${i + 1}人目`, WT, 9);
  }
  body += txt(x0, 60, `${n}人から選んで${pick}人ならべる`, YE, 10, 'start');
  return S(`${x0 * 2 + pick * gap} 70`, body);
}

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
function add(grade, diff, question, answer, meaning, svg) {
  data.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}
const fact = n => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
const perm = (n, r) => { let x = 1; for (let i = 0; i < r; i++) x *= (n - i); return x; };

// ① 服のコーディネート（積の法則・樹形図）: 3-1
[['シャツ', 3, 'ズボン', 4], ['ぼうし', 2, 'くつ', 5], ['Tシャツ', 4, 'パンツ', 3], ['上着', 3, 'スカート', 3], ['セーター', 2, 'ズボン', 6], ['シャツ', 5, 'ネクタイ', 2]].forEach(([n1, a, n2, b]) =>
  add(3, 1, `${n1}が${a}種類、${n2}が${b}種類あります。組み合わせは全部で何通りありますか？`, a * b,
    `${n1}の選び方${a}通りそれぞれに${n2}が${b}通り。${a}×${b}＝${a * b}通りです。`, figTree(a, b, n1, n2)));
// ② レストランのメニュー（積の法則・3つ）: 4-1
[['主食', 3, '飲み物', 4, 'デザート', 2], ['パン', 2, 'スープ', 3, 'サラダ', 3], ['丼', 4, '汁物', 2, '小鉢', 3], ['ピザ', 3, 'ドリンク', 3, 'アイス', 2]].forEach(([n1, a, n2, b, n3, c]) =>
  add(4, 1, `${n1}が${a}種類、${n2}が${b}種類、${n3}が${c}種類あります。1つずつ選ぶセットは何通りできますか？`, a * b * c,
    `それぞれの選び方をかける。${a}×${b}×${c}＝${a * b * c}通りです。`, figTree(a, b, n1, n2)));

// ③ リレーの走順（順列 N!）: 4-2 / 5-2
[[3], [4], [5], [4], [3], [5]].forEach(([n], i) =>
  add(4, 2, `${n}人でリレーをします。走る順番は全部で何通りありますか？`, fact(n),
    `1番目は${n}通り、2番目は${n - 1}通り…と減っていく。${Array.from({ length: n }, (_, k) => n - k).join('×')}＝${fact(n)}通りです。`, figOrder(n, n)));
// ④ 委員を選んで並べる（順列 nPr）: 5-3
[[5, 2], [6, 3], [7, 2], [8, 2], [6, 2], [5, 3]].forEach(([n, r]) =>
  add(5, 3, `${n}人の中から${r}人を選んで、リレーの第1走者から第${r}走者まで順番を決めます。決め方は何通りですか？`, perm(n, r),
    `${Array.from({ length: r }, (_, k) => n - k).join('×')}＝${perm(n, r)}通りです。`, figOrder(n, r)));

// ⑤ じゃんけんの手の出方（3のくり返し）: 4-3 / 5-4
[[2], [3], [4], [2], [3], [5]].forEach(([n]) =>
  add(4, 3, `${n}人でじゃんけんを1回します。全員の手（グー・チョキ・パー）の出方は全部で何通りありますか？`, Math.pow(3, n),
    `1人につき3通りで、${n}人ぶんかける。${Array(n).fill(3).join('×')}＝${Math.pow(3, n)}通りです。`, figHands()));

// ---------- 各セル×テンプレ最大10問（図つき優先） ----------
const cnt = {}; const svgFirst = [...data].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] <= 10) keep.add(q.id); }
const out = data.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');
console.log('総数:', out.length, ' 図あり:', out.filter(q => q.svg).length);
