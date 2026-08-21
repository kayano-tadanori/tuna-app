// scripts/check_game_rules.js
//   「saveGameScore で保存しているゲームIDが、firestore.rules で許可されているか」
//
// なぜ要るか：**同じ事故を3回起こしている。**
//   2026-08-20 tetris2 と jadepanic_* を gameIdOk に足し忘れ、
//              saveGameScore が **無言で失敗**（try/catch で握りつぶされる）。
//              クラウドに一度もスコアが残っていなかった。
//   2026-08-21 チッチジャンプ3D の jump3d も同じく入っていなかった（本番前に発見）。
//   ⇒ rules の hasOnly / gameIdOk は、通らないと**エラーも出ずに黙って捨てる**。
//     目視では絶対に気づけない。だから機械で数える。
//
// 使い方： node scripts/check_game_rules.js
//   ゲームを増やしたら必ず走らせる。問題があれば終了コード1。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// ---------- ① コードが保存しているゲームIDを集める ----------
const files = [];
const walk = (d, depth) => {
  if (depth > 2) return;
  for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    if (f.name === 'node_modules' || f.name.startsWith('.')) continue;
    const rel = path.join(d, f.name);
    if (f.isDirectory()) walk(rel, depth + 1);
    else if (f.name.endsWith('.js')) files.push(rel);
  }
};
walk('.', 0);

// 拾いかたは3通り。どれも実際にコードで使われている書きかた。
//   saveGameScore('jump3d', …)         … そのまま
//   saveGameScore('jump3d_w' + n, …)   … 前半だけ決まっている
//   saveGameScore(`mine_${diff}`, …)   … テンプレート文字列
// ★この検査スクリプト自身は見ない（例として書いた文字列を拾ってしまう）。
const ids = new Map();           // id または「はじまり*」→ どのファイル
const opaque = [];               // 第1引数が文字列でない呼び出し（人が見るしかない）
for (const f of files) {
  if (f.replace(/\\/g, '/').endsWith('scripts/check_game_rules.js')) continue;
  // ★コメントを外してから探すこと。説明文に書いた例を「本物の保存」と
  //   まちがえて数える（実際に jadepanic の説明コメントで誤検出した）。
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  // 第1引数が文字列でないもの（関数で作っている）は、機械では追えない
  const all = (src.match(/saveGameScore\(/g) || []).length;
  const lit = (src.match(/saveGameScore\(\s*['"`]/g) || []).length;
  if (all > lit) opaque.push(`${f}（${all - lit}か所）`);
  const re = /saveGameScore\(\s*(['"`])([^'"`]*)\1(\s*\+)?/g;
  let m;
  while ((m = re.exec(src))) {
    let id = m[2];
    const cut = id.indexOf('${');            // ここから先は可変
    const dynamic = cut >= 0 || !!m[3];
    if (cut >= 0) id = id.slice(0, cut);
    if (!id) continue;
    const key = dynamic ? id + '*' : id;
    if (!ids.has(key)) ids.set(key, f);
  }
}

// ---------- ② rules の gameIdOk を読む ----------
const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
const fn = rules.slice(rules.indexOf('function gameIdOk('));
const body = fn.slice(0, fn.indexOf('\n    }'));

const listed = new Set();
const inList = body.match(/game in \[([^\]]+)\]/);
if (inList) for (const q of inList[1].match(/'[^']+'/g) || []) listed.add(q.slice(1, -1));
const patterns = (body.match(/game\.matches\('([^']+)'\)/g) || [])
  .map(x => new RegExp(x.replace(/^game\.matches\('/, '').replace(/'\)$/, '')));
const drill = /drillGameOk\(game\)/.test(body);

let bad = 0;
console.log('--- saveGameScore で保存しているゲームID ---');
for (const [key, f] of [...ids].sort()) {
  const id = key.replace(/\*$/, '');
  const dynamic = key.endsWith('*');
  let ok;
  if (id.startsWith('drill')) ok = drill;
  else if (dynamic) {
    // 可変のものは「そのはじまりを受けるものが rules にあるか」を見る。
    //   ・列挙に そのはじまりの ID がある（mine_ → mine_easy など）
    //   ・正規表現の中に そのはじまりが書いてある（jadepanic_ など）
    ok = [...listed].some(x => x.startsWith(id)) ||
         patterns.some(re => re.source.includes(id)) ||
         patterns.some(re => re.test(id + '1') || re.test(id + 'x'));
  } else {
    ok = listed.has(id) || patterns.some(re => re.test(id));
  }
  console.log(`  ${ok ? 'OK ' : 'NG '} ${key.padEnd(22)} ${f}`);
  if (!ok) {
    bad++;
    console.log(`       → firestore.rules の gameIdOk に足すこと。`);
    console.log(`         足さないと saveGameScore が**無言で失敗**して、記録が残らない。`);
  }
}

if (opaque.length) {
  console.log('\n--- 機械では追えなかった呼び出し（第1引数が文字列でない）---');
  for (const o of opaque) console.log('  ・' + o);
  console.log('  ★ここは人が見ること。ゲームIDを関数で作っていると、');
  console.log('    この検査をすりぬけて 無言で保存に失敗する。');
}

console.log(bad === 0 ? '\n✅ すべて許可されている' : `\n❌ ${bad} 件が rules に無い`);
process.exit(bad === 0 ? 0 : 1);
