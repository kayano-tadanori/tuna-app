// 文字が重なって読めない図を、1枚ずつ直す。
//
//   node scripts/build_svg_check.js      … svg_items.json を作る
//   node scripts/fix_svg_overlap.js      … 何が変わるか見るだけ
//   node scripts/fix_svg_overlap.js --write
//
// ★②文字の重なり66件を48枚ぜんぶレンダリングして目で見て分けた結果、
//   「本当に読めない／中身がまちがっている」と判断した7枚だけをここで直す。
//   残りは「2行の注記がとなり合っているだけで読める」ので触らない。
//
// ★一律の自動処理はしない（[[method_svg_check]]）。
//   実際、hd_5m_f09_5 の「はい」3つは**過去の自動修正が図の外へ追い出した跡**だった。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'svg_items.json'), 'utf8'));

const T = (attrs, body) => `<text ${attrs}>${body}</text>`;

const FIXES = [
  {
    id: 'hd_5m_f09_5',
    why: '「はい」3つが図の外（y=-16〜-2）に積み上がっていた。各やじるしの横へ戻す',
    reps: [
      // 3本のやじるし（→）は x=142, y=42/72/102。その真上、箱と箱のすきま（x=136〜156）に置く
      [T('x="115" y="-16.4" fill="#06d6a0" font-size="7" text-anchor="middle"', 'はい'),
       T('x="146" y="33" fill="#06d6a0" font-size="7" text-anchor="middle"', 'はい')],
      [T('x="115" y="-9.5" fill="#06d6a0" font-size="7" text-anchor="middle"', 'はい'),
       T('x="146" y="63" fill="#06d6a0" font-size="7" text-anchor="middle"', 'はい')],
      [T('x="115" y="-2.6" fill="#06d6a0" font-size="7" text-anchor="middle"', 'はい'),
       T('x="146" y="93" fill="#06d6a0" font-size="7" text-anchor="middle"', 'はい')],
      // 外に出ていた分の余白（上 -23.6）が要らなくなる
      ['viewBox="0 -23.6 230 193.6"', 'viewBox="0 0 230 170"'],
    ],
  },
  {
    id: 'hd4s_22_3',
    // ★これは重なりだけでなく**中身のまちがい**。原簿は
    //   「正方形ABCD の 辺DC に、外がわ に 正三角形DCE を くっつけました」。
    //   共有する辺 DC は x=140 の縦の辺（D=(140,50) / C=(140,150)）。
    //   よって正方形は A=(40,50) B=(40,150) C=(140,150) D=(140,50)。
    //   ところが図は A を左下、B を右下（＝Cと同じ点）に置いていて、
    //   **左上の頂点に名前が無く、右下の1点にBとCが二重**になっていた。
    //   （答え150＝角BCE＝90+60 も、この並びでないと合わない）
    why: '左上の頂点に名前が無く、右下の1点にBとCが重なっていた。原簿どおりに置き直す',
    reps: [
      [T('x="36" y="164" font-size="11" font-family="sans-serif" fill="#1a2340"', 'A'),
       T('x="30" y="46" font-size="11" font-family="sans-serif" fill="#1a2340"', 'A')],
      [T('x="140" y="164" font-size="11" font-family="sans-serif" fill="#1a2340"', 'B'),
       T('x="30" y="164" font-size="11" font-family="sans-serif" fill="#1a2340"', 'B')],
    ],
  },
  {
    id: 'grades.5.sairei.lessons.12.items[2].rei',
    why: '「150度」が時計の文字ばん「3」にかぶっていた。同じ向きのまま外・上へずらす',
    reps: [
      [T('x="144.4" y="92.1" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#22c55e"', '150度'),
       T('x="138" y="76" font-size="11" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="#22c55e"', '150度')],
    ],
  },
  {
    id: 'rc552',
    why: '「氷」が「水面（変わらない）」にかぶっていた。氷のかたまりの下半分へ下ろす',
    reps: [
      [T('x="120" y="44" fill="#1b1b2b" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="bold"', '氷'),
       T('x="120" y="49" fill="#1b1b2b" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="bold"', '氷')],
    ],
  },
];

// 場合の数(2) の3枚は作りが同じ。「うら」がやじるし（↓）に重なって つぶれていた。
// → 「おもて」「うら」を**左はしの行の名前**にそろえる。枠を左に40広げるだけで、
//    中の箱や数字は1つも動かさない
for (const [id, vbOld, vbNew] of [
  ['grades.3.sairei.units.場合の数(2).items[1].rei', 'viewBox="0 0 188 118"', 'viewBox="-40 0 228 118"'],
  ['grades.3.sairei.units.場合の数(2).items[1].ruidai[0]', 'viewBox="0 0 188 118"', 'viewBox="-40 0 228 118"'],
  ['grades.3.sairei.units.場合の数(2).items[1].ruidai[2]', 'viewBox="0 0 304 118"', 'viewBox="-40 0 344 118"'],
]) {
  FIXES.push({
    id,
    why: '「うら」がやじるしに重なっていた。おもて／うらを左はしの行の名前にそろえる',
    reps: [
      [T('x="14" y="16" font-size="11" font-family="sans-serif" fill="#6c7086"', 'おもて'),
       T('x="-38" y="44" font-size="11" font-family="sans-serif" fill="#6c7086"', 'おもて')],
      [T('x="14" y="80" font-size="11" font-family="sans-serif" fill="#6c7086"', 'うら'),
       T('x="-38" y="100" font-size="11" font-family="sans-serif" fill="#6c7086"', 'うら')],
      [vbOld, vbNew],
    ],
  });
}

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
