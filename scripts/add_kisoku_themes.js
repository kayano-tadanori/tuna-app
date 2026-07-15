// 規則性に「楽しい周期算」をテーマ違いで追加する。色ビーズのくり返し、カレンダーの
// 曜日、図形のくり返しなど、目で見て楽しい周期の問題を図つきで増やす。件数より種類。
// 答えはすべてコード計算で検証する。
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'sansu_kisoku.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let maxId = Math.max(...data.map(q => Number(q.id.slice(2))));
const nid = () => 'sr' + String(++maxId).padStart(3, '0');

const COL = { 赤: '#ff6b6b', 青: '#4f9eff', 黄: '#ffd166', 緑: '#38d9a9', 桃: '#ff6688', 白: '#e8ecff' };
const YE = '#ffd166', WT = '#cdd6f4';
const S = (vb, body) => `<svg viewBox="0 0 ${vb}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">${body}</svg>`;
const txt = (x, y, s, c = YE, sz = 12, anc = 'middle') => `<text x="${x}" y="${y}" fill="${c}" font-size="${sz}" text-anchor="${anc}" font-family="sans-serif" font-weight="bold">${s}</text>`;

// 色ビーズのくり返し（最初の12個＋「…」）
function figBeads(pattern) {
  const show = 11, r = 9, gap = 20, x0 = 20, y = 34;
  let body = '';
  for (let i = 0; i < show; i++) {
    const c = pattern[i % pattern.length];
    body += `<circle cx="${x0 + i * gap}" cy="${y}" r="${r}" fill="${COL[c]}" stroke="${WT}" stroke-width="1"/>`;
  }
  body += txt(x0 + show * gap + 4, y + 4, '…', WT, 16, 'start');
  body += txt(120, y + 26, `${pattern.join('・')} のくり返し`, YE, 10);
  return S('250 66', body);
}
// 図形のくり返し
function figShapes(pattern) {
  const show = 10, gap = 22, x0 = 24, y = 30, sz = 8;
  const draw = { '○': (x) => `<circle cx="${x}" cy="${y}" r="${sz}" fill="none" stroke="#4f9eff" stroke-width="2"/>`, '△': (x) => `<polygon points="${x},${y - sz} ${x - sz},${y + sz} ${x + sz},${y + sz}" fill="none" stroke="#38d9a9" stroke-width="2"/>`, '□': (x) => `<rect x="${x - sz}" y="${y - sz}" width="${sz * 2}" height="${sz * 2}" fill="none" stroke="#ffd166" stroke-width="2"/>` };
  let body = '';
  for (let i = 0; i < show; i++) body += draw[pattern[i % pattern.length]](x0 + i * gap);
  body += txt(x0 + show * gap + 2, y + 5, '…', WT, 16, 'start');
  return S('280 56', body);
}
// カレンダー（曜日の並び）
function figWeek(startDay) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const x0 = 18, gap = 32, y = 30;
  let body = '';
  days.forEach((d, i) => {
    const hit = i === startDay;
    body += `<rect x="${x0 + i * gap}" y="14" width="28" height="24" rx="4" fill="${hit ? '#ff6688' : '#4f9eff'}" opacity="${hit ? 0.85 : 0.25}" stroke="${WT}" stroke-width="0.8"/>` + txt(x0 + i * gap + 14, 31, d, hit ? '#fff' : WT, 12);
  });
  return S('240 50', body);
}

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
function add(grade, diff, question, answer, meaning, svg) {
  data.push({ id: nid(), question, answer: String(answer), meaning, grade, difficulty: diff, svg });
}

// ① 色ビーズ：N番目は何色（3〜4色のくり返し）: 3-2
[[['赤', '青', '黄'], 20], [['赤', '青', '黄', '緑'], 30], [['青', '黄', '桃'], 25], [['赤', '緑', '青', '黄'], 40], [['黄', '赤', '青'], 17], [['赤', '桃', '緑', '青'], 26]].forEach(([pat, n]) => {
  const color = pat[(n - 1) % pat.length];
  add(3, 2, `${pat.join('、')}、${pat.join('、')}、…のように${pat.length}色をくり返してビーズをならべます。左から${n}番目のビーズは何色ですか？`, color,
    `${pat.length}色でひとまとまり。${n}÷${pat.length}＝${Math.floor((n - 1) / pat.length)}あまり${(n - 1) % pat.length + 1}なので、${(n - 1) % pat.length + 1}番目の「${color}」です。`, figBeads(pat));
});
// ② 色ビーズ：N個ならべると「赤」は何個: 4-2
[[['赤', '青', '黄'], 60], [['赤', '青', '黄', '緑'], 80], [['赤', '桃'], 50], [['赤', '青', '緑', '黄', '桃'], 100], [['黄', '赤', '青'], 45], [['赤', '緑'], 66]].forEach(([pat, n]) => {
  const per = pat.length, full = Math.floor(n / per), rem = n % per;
  const idx = pat.indexOf('赤');
  const count = full + (rem >= idx + 1 ? 1 : 0);
  add(4, 2, `${pat.join('、')}をくり返してビーズを${n}個ならべます。「赤」のビーズは何個ありますか？`, count,
    `${per}個ごとに赤は1個。${n}÷${per}＝${full}あまり${rem}。あまりの中の赤も数えて赤は${count}個です。`, figBeads(pat));
});
// ③ 図形のくり返し：N番目の形: 3-3
[[['○', '△', '□'], 22], [['○', '○', '△'], 20], [['△', '□', '○', '□'], 30], [['□', '○', '△'], 17], [['○', '△', '△', '□'], 26], [['△', '○'], 25]].forEach(([pat, n]) => {
  const shape = pat[(n - 1) % pat.length];
  add(3, 3, `${pat.join('、')}、${pat.join('、')}、…と${pat.length}個の形をくり返しならべます。左から${n}番目の形は${'○△□'.split('').join('・')}のうちどれですか？`, shape,
    `${pat.length}個でひとまとまり。${n}番目は${(n - 1) % pat.length + 1}番目の「${shape}」です。`, figShapes(pat));
});
// ④ カレンダー：○曜日から□日後は何曜日: 4-1
const days = ['日', '月', '火', '水', '木', '金', '土'];
[[2, 10], [5, 20], [1, 15], [3, 30], [6, 25], [4, 100]].forEach(([start, after]) => {
  const ans = days[(start + after) % 7];
  add(4, 1, `ある日は${days[start]}曜日です。そこから${after}日後は何曜日ですか？`, ans + '曜日',
    `曜日は7日で1周。${after}÷7＝${Math.floor(after / 7)}あまり${after % 7}なので、${days[start]}曜日から${after % 7}つ進んで「${ans}曜日」です。`, figWeek(start));
});
// ⑤ カレンダー：同じ曜日は何日ごと・N週後: 4-1
[[1, 5], [3, 4], [6, 6], [2, 8], [4, 3], [5, 7]].forEach(([start, weeks]) => {
  const after = weeks * 7 - 2, ans = days[(start + after) % 7];
  add(4, 1, `ある日は${days[start]}曜日です。${after}日後は何曜日ですか？`, ans + '曜日',
    `${after}÷7＝${Math.floor(after / 7)}あまり${after % 7}。${days[start]}曜日から${after % 7}つ進んで「${ans}曜日」です。`, figWeek(start));
});

// ---------- 各セル×テンプレ最大10問（図つき優先） ----------
const cnt = {}; const svgFirst = [...data].sort((x, y) => (y.svg ? 1 : 0) - (x.svg ? 1 : 0)); const keep = new Set();
for (const q of svgFirst) { const k = q.grade + '-' + q.difficulty + '|' + norm(q.question); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] <= 10) keep.add(q.id); }
const out = data.filter(q => keep.has(q.id));
fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');
console.log('総数:', out.length, ' 図あり:', out.filter(q => q.svg).length, ' 追加テンプレ数(周期系):', new Set(out.filter(q => /ビーズ|曜日|形をくり返し/.test(q.question)).map(q => norm(q.question))).size);
