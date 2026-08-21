// ============================================================
// 本体の BACKUP_KEYS と firestore.rules の許可リストが合っているか見る
//   使い方： node scripts/check_backup_rules.js
//
// 【なぜ要るか】
//   firestore.rules の hasOnly([...]) は「1つでも知らないキーがあると丸ごと拒否」する。
//   本体に保存キーを足してルールに足し忘れると、そのキーを持つ端末だけ
//   バックアップが permission-denied で全部失敗する。しかも saveLocalBackup は
//   try/catch で握りつぶすので、アプリの画面には何も出ない＝気づけない。
//
//   2026-08-20 に実際に起きた：遊び券（gameTickets）を BACKUP_KEYS に足したのに
//   ルールに足し忘れ、遊び券を持っている子の記録が丸ごとクラウドに上がらなくなっていた。
//   達成率も一緒に止まるので、管理ツールの「最終更新」も古いままになった。
//
//   ★保存キーを足したら、このスクリプトを流してから push すること。
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

// ① 本体の BACKUP_KEYS
const mKeys = app.match(/const BACKUP_KEYS = \[([\s\S]*?)\];/);
if (!mKeys) { console.error('!! app.js の BACKUP_KEYS が見つかりません'); process.exit(1); }
const backupKeys = [...mKeys[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

// ② ルールの backup/data の hasOnly リスト
const mRule = rules.match(/match \/users\/\{nick\}\/backup\/data \{[\s\S]*?hasOnly\(\[([\s\S]*?)\]\)/);
if (!mRule) { console.error('!! firestore.rules の backup/data の許可リストが見つかりません'); process.exit(1); }
const ruleKeys = [...mRule[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

// lastUpdated はサーバー時刻用でルール側にだけあるのが正しい
const ruleOnly = ruleKeys.filter(k => k !== 'lastUpdated' && !backupKeys.includes(k));
const appOnly = backupKeys.filter(k => !ruleKeys.includes(k));

console.log('本体 BACKUP_KEYS :', backupKeys.length, '件');
console.log('ルールの許可リスト :', ruleKeys.length, '件（lastUpdated 込み）');

let ng = false;
if (appOnly.length) {
  ng = true;
  console.log('\n❌ ルールに足りないキー（このキーを持つ端末はバックアップが全部失敗する）:');
  appOnly.forEach(k => console.log('   -', k));
}
if (ruleOnly.length) {
  console.log('\n⚠ ルールにだけあるキー（消し忘れ？　害はないが、ずれている合図）:');
  ruleOnly.forEach(k => console.log('   -', k));
}
// ---------- ③ 「保存しているのに、バックアップに入れ忘れているキー」 ----------
//   🚨 これが 2026-08-21 に見つかった抜け。`tetris2Best` は iframe（lab/tetris2）の中で
//      書かれていて、本体の BACKUP_KEYS に入っていなかった。ルールとは食いちがわないので
//      ②では見つからない。**端末を変えた瞬間に自己ベストが消える**だけで、何も言わない。
//   → コードのどこかで localStorage に書いている「〜Best」を集めて、
//     バックアップ対象に入っているか見る。
{
  const found = new Map();                 // キー → 書いているファイル
  const walk = (d, depth) => {
    if (depth > 3) return;
    for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (f.name === 'node_modules' || f.name.startsWith('.')) continue;
      const rel = path.join(d, f.name);
      if (f.isDirectory()) walk(rel, depth + 1);
      else if (f.name.endsWith('.js')) {
        // コメントは外す（説明文に書いた例を本物とまちがえないように）
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^[ \t]*\/\/.*$/gm, '');
        const re = /localStorage\.setItem\(\s*'([A-Za-z0-9_]*Best[A-Za-z0-9_]*)'/g;
        let m;
        while ((m = re.exec(src))) if (!found.has(m[1])) found.set(m[1], rel);
      }
    }
  };
  walk('.', 0);
  // ★`localStorage.setItem('mineBest_' + diff, …)` のように**続きが変わる**書きかたがある。
  //   そのままだと「mineBest_ が無い」と誤って言う（実際に言った）。
  //   前半だけ決まっているものは、その前半で始まるキーがあれば良しとする。
  const missing = [...found].filter(([k]) =>
    !backupKeys.includes(k) && !backupKeys.some(b => b.startsWith(k) && b !== k));
  console.log('\nlocalStorage に書いている「〜Best」:', found.size, '件');
  if (missing.length) {
    ng = true;
    console.log('❌ バックアップ対象に入っていない（端末を変えると消える）:');
    for (const [k, f] of missing) console.log('   -', k, '  ', f);
    console.log('   → app.js の BACKUP_KEYS と firestore.rules の hasOnly に**両方**足すこと。');
  } else {
    console.log('✅ ぜんぶ BACKUP_KEYS に入っています');
  }
}

if (!ng) console.log('\n✅ 本体の保存キーはすべてルールで許可されています');
process.exit(ng ? 1 : 0);
