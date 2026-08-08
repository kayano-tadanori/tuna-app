// 枠（viewBox）からはみ出している図を、**枠を広げるだけ**で直す。
//
//   node scripts/build_svg_check.js
//   msedge --headless=new ... --dump-dom scripts/svg_check.html  → scripts/svg_dom.txt
//   node scripts/svg_report.js            … scripts/svg_findings.json ができる
//   node scripts/fix_svg_viewbox.js       … 何が変わるか見るだけ
//   node scripts/fix_svg_viewbox.js --write
//
// ★これが安全なのは「中の座標を1つも触らない」から。図の形も比率も設計も変わらず、
//   今まで切れて見えていた分が見えるようになるだけ（[[method_svg_check]] の①）。
//   ②文字の重なり・③箱からのはみ出し は**自動でやらない**。
//   以前、重なりの自動修正が理科図鑑のカード説明をカードから引きはがして本番に出た。
//
// ⚠ 同じ図の文字列を複数の問題が共有している。文字列で置換するので**共有先も一緒に直る**。
//   これは正しい挙動（元の記録どおり）。数が合わなくても、必ず測り直して確かめること。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'svg_items.json'), 'utf8'));
const found = JSON.parse(fs.readFileSync(path.join(__dirname, 'svg_findings.json'), 'utf8'));
const MARGIN = 2;   // 記録どおり、実測のふちから 2px の余白を足す

const plans = new Map();   // file → [{old, neu, id, note}]
for (const x of found.over) {
  const it = items[Number(x.i)];
  if (!it || it.file !== x.file) { console.log(`  ✗ ${x.file} ${x.id}：番号と中身が合わない。測り直すこと`); continue; }
  let [vx, vy, vw, vh] = x.vb;
  const d = x.d, note = [];
  // d.l/d.t は「枠より外へ何px出ているか」。正のときだけ、その辺を広げる
  if (d.l > 0) { const g = d.l + MARGIN; vx -= g; vw += g; note.push(`左+${g.toFixed(1)}`); }
  if (d.t > 0) { const g = d.t + MARGIN; vy -= g; vh += g; note.push(`上+${g.toFixed(1)}`); }
  if (d.r > 0) { const g = d.r + MARGIN; vw += g; note.push(`右+${g.toFixed(1)}`); }
  if (d.b > 0) { const g = d.b + MARGIN; vh += g; note.push(`下+${g.toFixed(1)}`); }
  if (!note.length) continue;
  const r = (n) => +n.toFixed(2);
  const neuVB = `${r(vx)} ${r(vy)} ${r(vw)} ${r(vh)}`;
  const m = it.svg.match(/viewBox="([^"]+)"/);
  if (!m) { console.log(`  ✗ ${x.file} ${x.id}：viewBox が見つからない`); continue; }
  const neu = it.svg.replace(m[0], `viewBox="${neuVB}"`);
  if (neu === it.svg) continue;
  if (!plans.has(it.file)) plans.set(it.file, []);
  plans.get(it.file).push({ old: it.svg, neu, id: x.id, note: `${m[1]} → ${neuVB}（${note.join('・')}）` });
}

let n = 0;
for (const [f, list] of plans) {
  console.log(`\n${f}`);
  for (const p of list) { console.log(`  ・${p.id}\n     ${p.note}`); n++; }
}
console.log(`\n直す図：${n}枚`);

if (!process.argv.includes('--write')) { console.log('\n（--write で書きこむ）'); process.exit(0); }

for (const [f, list] of plans) {
  const p = path.join(ROOT, 'data', f);
  let raw = fs.readFileSync(p, 'utf8');
  let hit = 0;
  for (const x of list) {
    // ★JSON.parse→stringify で書き戻すと整形が全部変わって差分が読めなくなる。
    //   JSON の中での**文字列表現のまま**完全一致で置換する（記録どおり）
    const a = JSON.stringify(x.old).slice(1, -1);
    const b = JSON.stringify(x.neu).slice(1, -1);
    if (raw.includes(a)) { raw = raw.split(a).join(b); hit++; }
  }
  fs.writeFileSync(p, raw);
  JSON.parse(fs.readFileSync(p, 'utf8'));   // 壊していないか読み直して確かめる
  console.log(`  → ${f}（${hit}/${list.length}枚を置換／残りは共有先で既に直っている）`);
}
console.log('\n✓ 書きこんだ。必ず測り直して 0 になったか見ること');
