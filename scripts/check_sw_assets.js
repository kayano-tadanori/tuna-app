// ============================================================
// sw.js の ASSETS に並べたファイルが全部そこにあるか見る
//   使い方： node scripts/check_sw_assets.js
//
// 【なぜ要るか】
//   install で cache.addAll(ASSETS) を使っている。addAll は
//   **1つでも404だと丸ごと失敗する**＝Service Worker が入らず、
//   オフラインで開けない・キャッシュが古いまま残る。
//   ファイルを増やしたり、作りかけを外したりしたときに壊れやすい。
//   ★ASSETS を触ったら、これを流してから push すること。
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const m = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
if (!m) { console.error('!! sw.js の ASSETS が見つかりません'); process.exit(1); }
const assets = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);

const missing = [];
for (const a of assets) {
  if (a === './') continue;                    // ルート（index.html が返る）
  const f = path.join(ROOT, a.replace(/^\.\//, ''));
  if (!fs.existsSync(f)) missing.push(a);
}

console.log('ASSETS:', assets.length, '件');
if (missing.length) {
  console.log('\n❌ そこに無いファイル（このままだと Service Worker が入らない）:');
  missing.forEach(a => console.log('   -', a));
  process.exit(1);
}
console.log('✅ ASSETS のファイルはすべてそろっています');
