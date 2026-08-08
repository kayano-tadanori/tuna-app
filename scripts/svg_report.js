// 計測結果（<pre id=out> の JSON）を読んで報告する（使い捨て）
const fs = require('fs');
const path = require('path');
const dom = fs.readFileSync(path.join(__dirname, 'svg_dom.txt'), 'utf8');
const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (!m) { console.log('計測結果が取れなかった'); process.exit(1); }
const r = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>'));

console.log(`測ったSVG：${r.n}枚\n`);
const show = (title, rows, fmt) => {
  console.log(`【${title}】${rows.length}件`);
  const byFile = new Map();
  for (const x of rows) byFile.set(x.file, (byFile.get(x.file) || 0) + 1);
  for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`   ${f} … ${n}件`);
  }
  for (const x of rows.slice(0, 12)) console.log('     ' + fmt(x));
  console.log('');
};
show('① 枠からのはみ出し', r.over, (x) => `${x.file} ${x.id} ${x.worst}px`);
show('② 文字の重なり', r.overlap, (x) => `${x.file} ${x.id} ${Math.round(x.ratio * 100)}%  「${x.t1}」×「${x.t2}」`);
show('③ 箱からのはみ出し', r.boxover, (x) => `${x.file} ${x.id} ${x.out}px  「${x.t}」`);
fs.writeFileSync(path.join(__dirname, 'svg_findings.json'), JSON.stringify(r, null, 1));
console.log('詳細を svg_findings.json に書き出した');
