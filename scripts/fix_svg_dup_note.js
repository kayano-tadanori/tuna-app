// 図の中で「同じことを言う注記が2行ならんでいる」ものを、短い方だけ消す。
//
//   node scripts/build_svg_check.js        … svg_items.json を作る
//   node scripts/fix_svg_dup_note.js       … 何が消えるか見るだけ
//   node scripts/fix_svg_dup_note.js --write
//
// ★これは②文字の重なり73件のうち、**目で見て「重複注記」と確かめた7枚だけ**を直す。
//   一律の自動処理はしない。以前、重なりの自動修正が理科図鑑のカード説明を
//   カードから引きはがして本番に出した（[[method_svg_check]]）。
//   残りは「2行の注記がとなり合っているだけで読める」＝直す必要が無いものが多い。
//
// ★消すのは必ず**短い方**。長い方が情報を持っている
//   （例：「対角線で折り返す」より「対角線BDで折り返す」の方がどの対角線か分かる）。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'svg_items.json'), 'utf8'));

// 何番目の図の、どの文字を消すか。「残す方」も書いて、消す判断の理由が後から読めるようにする
const DROP = [
  { i: 79, drop: '2つの角を切り取る', keep: '2つの角から正方形を切り取る' },
  { i: 290, drop: '中心角40度・半径9cm', keep: '中心角40度・半径9cm のおうぎ形' },
  { i: 494, drop: '2直線は垂直', keep: '2本の直線は 垂直' },
  { i: 507, drop: '対角線で折り返す', keep: '対角線BDで折り返す' },
  { i: 510, drop: '5:12:13で直角を見つける', keep: '5:12:13 なら いちばん長い辺の向かいが直角' },
  { i: 954, drop: '2本の直線は垂直', keep: '2本の直線は 垂直' },
  // ★980 は同じ文字が2つある。下の行（y=164）を消して上を残す
  { i: 980, drop: '対角線で折り返す', keep: '対角線で折り返す', which: 'last' },
];

const plans = new Map();
for (const spec of DROP) {
  const it = items[spec.i];
  if (!it) { console.log(`  ✗ #${spec.i}：図が見つからない。build_svg_check.js を流し直すこと`); continue; }
  const els = it.svg.match(/<text[^>]*>[^<]*<\/text>/g) || [];
  const hit = els.filter((e) => e.endsWith(`>${spec.drop}</text>`));
  if (!hit.length) { console.log(`  ✗ #${spec.i}：「${spec.drop}」が見つからない（もう直っている？）`); continue; }
  if (hit.length > 1 && spec.which !== 'last') {
    console.log(`  ✗ #${spec.i}：「${spec.drop}」が${hit.length}個ある。which を決めること`); continue;
  }
  const target = spec.which === 'last' ? hit[hit.length - 1] : hit[0];
  const neu = it.svg.replace(target, '');
  if (neu === it.svg) { console.log(`  ✗ #${spec.i}：置換できなかった`); continue; }
  if (!plans.has(it.file)) plans.set(it.file, []);
  plans.get(it.file).push({ old: it.svg, neu, id: it.id, spec, target });
}

let n = 0;
for (const [f, list] of plans) {
  console.log(`\n${f}`);
  for (const p of list) {
    console.log(`  ・${p.id}`);
    console.log(`     消す 「${p.spec.drop}」`);
    console.log(`     残す 「${p.spec.keep}」`);
    n++;
  }
}
console.log(`\n直す図：${n}枚`);

if (!process.argv.includes('--write')) { console.log('\n（--write で書きこむ）'); process.exit(0); }

for (const [f, list] of plans) {
  const p = path.join(ROOT, 'data', f);
  let raw = fs.readFileSync(p, 'utf8');
  let hit = 0;
  for (const x of list) {
    // JSON の中での文字列表現のまま完全一致で置換する（整形を壊さない）
    const a = JSON.stringify(x.old).slice(1, -1);
    const b = JSON.stringify(x.neu).slice(1, -1);
    if (raw.includes(a)) { raw = raw.split(a).join(b); hit++; }
  }
  fs.writeFileSync(p, raw);
  JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log(`  → ${f}（${hit}/${list.length}枚）`);
}
console.log('\n✓ 書きこんだ。必ず描き直して目で見ること');
