// 🧹 管理ツールの OKZ_TIER_ENDS を作り直す。
//    おかたづけの面（lab/okatazuke/js/levels.js）を足したり むずかしさ（t）を
//    直したりしたら これを流して、出てきた1行を
//    Desktop\オトン学園管理ツール\index.html に貼りかえる。
//
//    ★管理ツールは本体とは別のファイル（git の外）なので、二重管理になっている。
//      [[oton_admin_tool_duplication]]。手で数えないこと。
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'lab', 'okatazuke', 'js', 'levels.js'), 'utf8');
const LEVELS = new Function(src + '; return OK_LEVELS;')();

const NAMES = ['やさしい', 'ふつう', 'むずかしい', 'ゲキむず'];
const tiers = LEVELS.map(L => L.t);

// むずかしさが 0→3 の順に並んでいることを確かめる。混ざっていたら境目では表せない。
for (let i = 1; i < tiers.length; i++) {
  if (tiers[i] < tiers[i - 1]) {
    console.error(`❌ ${i}面目で むずかしさが 戻っています（${tiers[i - 1]} → ${tiers[i]}）。`);
    console.error('   境目の番号では表せないので、管理ツール側を「1面ずつの並び」に変えること。');
    process.exit(1);
  }
}

const ends = [];
for (let t = 0; t < NAMES.length; t++) {
  const last = tiers.lastIndexOf(t);
  ends.push(last < 0 ? (ends[ends.length - 1] || 0) : last + 1);
}

console.log(`面の数: ${LEVELS.length}`);
NAMES.forEach((n, i) => {
  const from = i ? ends[i - 1] : 0;
  console.log(`  ${n}: ${ends[i] - from}面（${from}〜${ends[i] - 1}）`);
});
console.log('');
console.log('▼ 管理ツール index.html の この行を貼りかえる');
console.log(`const OKZ_TIER_ENDS  = [${ends.join(', ')}];   // ` +
  NAMES.map((n, i) => `${i ? ends[i - 1] : 0}..${ends[i] - 1}`).join(' / '));
