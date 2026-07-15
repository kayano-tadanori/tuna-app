// キャラクター（オットン・オカーン・チッチ）問題は「たまに出る」から楽しい。
// 出しすぎると飽きるので、各セル（学年×難易度）につきキャラ問題は最大2問までに絞る。
// できるだけ違うテンプレ（違うキャラ・お話）を残す。キャラ以外は一切変更しない。
const fs = require('fs');
const path = require('path');
const names = ['keisan', 'bun', 'zu', 'kisoku', 'tokusan', 'baai', 'kazu', 'wariai', 'hayasa', 'rittai'];
const isChar = q => /オットン|オカーン|チッチ/.test(q.question);
function norm(s) { return String(s || '').replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/[0-9０-９]+(\.[0-9]+)?/g, '#').replace(/\s+/g, '').replace(/[、。，．]/g, ''); }
const MAX_PER_CELL = 2;

let totalBefore = 0, totalAfter = 0;
names.forEach(n => {
  const FILE = path.join(__dirname, '..', 'data', 'sansu_' + n + '.json');
  const a = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  // セルごとにキャラ問題を集計
  const cellChar = {};
  a.forEach(q => { if (isChar(q)) { const k = q.grade + '-' + q.difficulty; (cellChar[k] = cellChar[k] || []).push(q); } });
  const keepIds = new Set();
  Object.values(cellChar).forEach(qs => {
    // テンプレごとにまとめ、違うテンプレを優先して round-robin で最大 MAX 件残す
    const byTpl = {};
    qs.forEach(q => { const t = norm(q.question); (byTpl[t] = byTpl[t] || []).push(q); });
    const lists = Object.values(byTpl);
    let picked = 0, idx = 0;
    while (picked < MAX_PER_CELL && lists.some(l => l.length)) {
      const l = lists[idx % lists.length];
      if (l.length) { keepIds.add(l.shift().id); picked++; }
      idx++;
    }
  });
  const before = a.filter(isChar).length;
  const out = a.filter(q => !isChar(q) || keepIds.has(q.id));
  const after = out.filter(isChar).length;
  totalBefore += before; totalAfter += after;
  if (before !== after) {
    fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');
    console.log(`${n}: キャラ ${before} → ${after}（総数 ${a.length} → ${out.length}）`);
  }
});
console.log(`\nキャラ問題 合計 ${totalBefore} → ${totalAfter}`);
