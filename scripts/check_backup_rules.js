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
if (!ng) console.log('\n✅ 本体の保存キーはすべてルールで許可されています');
process.exit(ng ? 1 : 0);
