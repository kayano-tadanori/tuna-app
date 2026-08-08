// 箱から文字がはみ出して切れている図を、1枚ずつ直す。
//
//   node scripts/build_svg_check.js
//   node scripts/fix_svg_boxover.js          … 何が変わるか見るだけ
//   node scripts/fix_svg_boxover.js --write
//
// ★③は18件あるが、直すのは**本当に切れている3枚だけ**。
//   残り15件は 1.6〜3.8px で、箱のふちに触れているだけで読める。
//   [[method_svg_check]]「7pxより小さくしない」「レイアウトを壊してまで収めない」に従い、
//   字を小さくしてまで収める価値がないものは残す。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'svg_items.json'), 'utf8'));

const FIXES = [
  {
    id: 'hd_3s_f23_6',
    // ★これは座標の打ちまちがい。下の行の5マスは箱が x=30/60/90/120/150（幅28）で、
    //   文字は中央＝44/74/104/134/164 のはず。ところが1つ目だけ 56 になっていて、
    //   箱（30〜58）の右のふちで「75」が切れていた
    why: '下の行の1マス目だけ文字の位置がずれて「75」が切れていた。他の4マスと同じ中央へ',
    reps: [["<text x='56.0' y='193.0' fill='#ffd166' font-size='9' text-anchor='middle'>75</text>",
            "<text x='44.0' y='193.0' fill='#ffd166' font-size='9' text-anchor='middle'>75</text>"]],
  },
  {
    id: 'rchain31',
    why: '「体積 50cm³」が金属のかたまりの右へはみ出していた。面の中央にそろえて少し小さく',
    reps: [
      ['<text x="120" y="76" fill="#eef2ff" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="bold">体積 50cm³</text>',
       '<text x="108" y="76" fill="#eef2ff" font-size="8" text-anchor="middle" font-family="sans-serif" font-weight="bold">体積 50cm³</text>'],
      // 中身が空のまま残っていた文字。何も描かないので消す
      ['<text x="108" y="74" fill="#eef2ff" font-size="8.5" text-anchor="middle" font-family="sans-serif" font-weight="bold"></text>', ''],
    ],
  },
  {
    id: 'kt190',
    // 右へ寄せすぎると箱（x=40〜170）から出る。左へ寄せるとあわ（cx=104〜110, 半径最大8）に
    // かぶる。あわの右はし118 と 箱の右はし170 のあいだに収める
    why: '「上ほど 大きい」が水そうの箱から半分出ていた。あわと箱のあいだへ収める',
    reps: [
      ['<text x="160" y="30" fill="#cdd6f4" font-size="8" text-anchor="middle" font-family="sans-serif">上ほど 大きい</text>',
       '<text x="143" y="30" fill="#cdd6f4" font-size="7.5" text-anchor="middle" font-family="sans-serif">上ほど 大きい</text>'],
    ],
  },
];

const plans = new Map();
let ng = 0;
for (const f of FIXES) {
  const it = items.find((x) => x.id === f.id);
  if (!it) { console.log(`  ✗ ${f.id}：図が見つからない`); ng++; continue; }
  let svg = it.svg;
  for (const [a, b] of f.reps) {
    if (!svg.includes(a)) { console.log(`  ✗ ${f.id}：見つからない → ${a.slice(0, 70)}`); ng++; svg = null; break; }
    svg = svg.replace(a, b);
  }
  if (!svg) continue;
  if (!plans.has(it.file)) plans.set(it.file, []);
  plans.get(it.file).push({ old: it.svg, neu: svg, id: f.id, why: f.why });
}

let n = 0;
for (const [file, list] of plans) {
  console.log(`\n${file}`);
  for (const p of list) { console.log(`  ・${p.id}\n     ${p.why}`); n++; }
}
console.log(`\n直す図：${n}枚${ng ? `／取りこぼし ${ng}件` : ''}`);
if (ng) { console.log('✗ 取りこぼしがあるので書きこまない'); process.exit(1); }
if (!process.argv.includes('--write')) { console.log('\n（--write で書きこむ）'); process.exit(0); }

for (const [file, list] of plans) {
  const p = path.join(ROOT, 'data', file);
  let raw = fs.readFileSync(p, 'utf8');
  let hit = 0;
  for (const x of list) {
    const a = JSON.stringify(x.old).slice(1, -1);
    const b = JSON.stringify(x.neu).slice(1, -1);
    if (raw.includes(a)) { raw = raw.split(a).join(b); hit++; }
  }
  fs.writeFileSync(p, raw);
  JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log(`  → ${file}（${hit}/${list.length}枚）`);
}
console.log('\n✓ 書きこんだ。必ず描き直して目で見ること');
