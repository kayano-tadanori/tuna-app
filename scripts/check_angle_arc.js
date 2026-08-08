// 角度を答えさせる図なのに、**弧が描かれていない**ものを洗い出す。
//
//   node scripts/build_svg_check.js   … svg_items.json を作る
//   node scripts/check_angle_arc.js
//
// ★弧が無いと「どの角のことか」が分からない（本人指摘 2026-08-09）。
//   角度のラベル（○○°／x／ア など）だけ置いても、頂点のどちら側かが決まらない。
//
// 見分け方
//   ・角度らしい文字（「°」「度」）を持つ図を対象にする
//   ・その図に円弧（path の A コマンド／circle でない曲線）があるか見る
//
// ★これは「弧が無い」ことしか言えない。**弧が無い＝読めない、ではない**。
//   2026-08-09 に9枚を目で見た結果：
//     ・sz521/sz522 の型（直線上の1点から1本ひいて x と 148°）… 左右に分かれていて読める
//     ・かんたん解説の「30°」「90°」が箱に入っている図 … 角の印ではなく説明の札。対象外
//     ・**本当にあぶないのは「1つの頂点から何本も線が出ている図」**
//       （hd_5m_k06_639_2e＝左の頂点から4本出ていて、78°と54°がどの2本の間か決まらない）
//   → 数だけ見て一括で弧を足さないこと。図を機械で触ると壊す（[[method_svg_check]]）
const fs = require('fs');
const path = require('path');

const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'svg_items.json'), 'utf8'));

// ★属性は " でも ' でも書かれている。" しか見ていなくて、弧を持つ図86枚を
//   「弧が無い」と誤って数えた（2026-08-09）。両方を見る
const hasArc = (svg) => /<path[^>]*\bd=(["'])[^"']*[Aa][\s0-9]/.test(svg);
const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

// ★「その角がここにある」と指している短いラベルだけを見る。
//   ・「温度」「気温」「℃」は角度ではない（`度$` で拾ってしまっていた）
//   ・「内角はすべて120度」「差は1分に5.5度」のような**説明文**は、指し示していないので対象外
//   ・「40°」「30度」のような**値だけ**のラベルが、弧なしで置かれているものが本当の問題
const isAngleLabel = (s) => {
  const t = s.trim();
  if (/温度|気温|℃|水温|体温/.test(t)) return false;
  return /^[（(]?[a-zａ-ｚア-ンァ-ヶ㋐-㋾]?[)）]?\s*[0-9]+(\.[0-9]+)?\s*(°|度)$/.test(t);
};

const rows = [];
for (const it of items) {
  const deg = texts(it.svg).filter(isAngleLabel);
  if (!deg.length) continue;
  if (hasArc(it.svg)) continue;
  rows.push({ file: it.file, id: it.id, labels: deg.slice(0, 5) });
}

const byFile = new Map();
for (const r of rows) byFile.set(r.file, (byFile.get(r.file) || 0) + 1);

console.log(`角度の文字がある図のうち、弧が無いもの：${rows.length}枚\n`);
for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`   ${f} … ${n}枚`);
console.log('');
const show = process.argv.includes('--full') ? rows : rows.slice(0, 20);
for (const r of show) console.log(`   ${r.file} ${r.id}  ${r.labels.join(' / ')}`);
if (show.length < rows.length) console.log(`   …ほか ${rows.length - show.length}枚（--full で全部）`);
