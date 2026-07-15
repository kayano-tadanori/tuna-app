// 計算・規則性・平面図形の「数字だけ違う同一問題」の連続を解消する。
// 図はすでにある（規則性41%・図形71%）か、計算のように図が不要なカテゴリなので、
// 作り直しはせず各セル×テンプレの上限だけを設ける。図つき問題を優先して残す。
// 計算はドリルとして量が要るため上限を高め(20)、他は12にする。文章題は最多11で
// ほぼ健全なため対象外。
const fs = require('fs');
const path = require('path');

function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }

function dedup(name, cap) {
  const FILE = path.join(__dirname, '..', 'data', 'sansu_' + name + '.json');
  const a = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  // 図つきを優先して残す
  const order = [...a].map((q, i) => ({ q, i })).sort((x, y) => ((y.q.svg ? 1 : 0) - (x.q.svg ? 1 : 0)) || (x.i - y.i));
  const cnt = {}; const keep = new Set();
  for (const { q } of order) {
    const k = q.grade + '-' + q.difficulty + '|' + norm(q.question);
    cnt[k] = (cnt[k] || 0) + 1;
    if (cnt[k] <= cap) keep.add(q);
  }
  const out = a.filter(q => keep.has(q)); // 元の順序を保つ
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');
  // レポート
  const cell = {};
  out.forEach(q => { const kk = q.grade + '-' + q.difficulty; (cell[kk] = cell[kk] || []).push(q); });
  let worst = 0;
  Object.values(cell).forEach(qs => { const m = {}; qs.forEach(q => { const n = norm(q.question); m[n] = (m[n] || 0) + 1; }); worst = Math.max(worst, ...Object.values(m)); });
  console.log(`${name.padEnd(8)} ${a.length} → ${out.length}  (図${out.filter(q => q.svg).length}) 最多重複${worst}`);
  return out.length;
}

const counts = {};
counts.keisan = dedup('keisan', 20);
counts.kisoku = dedup('kisoku', 12);
counts.zu = dedup('zu', 12);
console.log('\n新件数:', JSON.stringify(counts));
