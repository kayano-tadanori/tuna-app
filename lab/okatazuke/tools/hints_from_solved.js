// ============================================================
// hints_from_solved.js — 配られた解答集（SG-1000版 倉庫番の解答集）から 🔍ヒント用の答えを取りこむ
//   出どころ：うえぽんSW局「倉庫番(SG-1000対応版) 攻略メモ」の SG-1000solved.zip（2008/02/29版）
//     https://wepon.at-ninja.jp/sokoban.html
//   ★文字コードは Shift_JIS。UTF-8 にしてから渡す：
//     iconv -f SJIS -t UTF-8 SG-1000solved.txt > solved_utf8.txt
//     node lab/okatazuke/tools/hints_from_solved.js solved_utf8.txt
//     node lab/okatazuke/tools/make_hints.js --write
//   ★面の名前に印（* + @）が付く。[ROUND 087+] のように。印を外して ROUND名で引く
//   ★1面ずつ core.js で再生して クリアになるものだけ _hints.json に入れる（自作の探索の答えより優先）
// ============================================================
const fs = require('fs'), path = require('path');
const solvedPath = process.argv[2];
const T = path.join(__dirname, '..');
const OKZ = require(path.join(T, 'js/core.js'));
const src = fs.readFileSync(path.join(T, 'js/levels.js'), 'utf8');
const OK_LEVELS = (new Function(src.replace("'use strict';", '') + '; return OK_LEVELS;'))();
const imported = JSON.parse(fs.readFileSync(path.join(T, 'tools/_imported.json'), 'utf8'));
function okHash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }
// 解答集を読む：[ROUND 001] のあとに LURD の行
const sols = {};
let cur = null;
for (const line of fs.readFileSync(solvedPath, 'utf8').replace(/\r/g, '').split('\n')) {
  const m = line.match(/^\[(ROUND [^\]*+@]+?)[*+@]*\]/);
  if (m) { cur = m[1]; sols[cur] = ''; continue; }
  if (cur && /^[lurdLURD]+$/.test(line.trim())) sols[cur] += line.trim();
  else if (cur && line.trim() === '') cur = cur;   // 空行は区切り（次の [ で切りかわる）
}
const rowsKey = rows => (Array.isArray(rows) ? rows : JSON.parse(rows.replace(/'/g, '"'))).join('\n');
const nameOf = new Map();
for (const e of imported) {
  let rows = e.rows; if (typeof rows === 'string') { try { rows = JSON.parse(rows.replace(/'/g, '"')); } catch (_) {} }
  nameOf.set(rows.join('\n'), e.src);
}
const cachePath = path.join(T, 'tools/_hints.json');
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
let ok = 0, ng = [], noSol = [], replaced = 0;
OK_LEVELS.forEach((L, i) => {
  const text = L.rows.join('\n');
  const name = nameOf.get(text);
  if (!name) return;                       // 自作の面
  const s = sols[name];
  if (!s) { noSol.push(`${i + 1}(${name})`); return; }
  const g = new OKZ.Game(text);
  const moves = s.toUpperCase();
  let bad = false;
  for (const c of moves) if (!g.move(c)) { bad = true; break; }
  if (bad || !g.isClear()) { ng.push(`${i + 1}(${name})`); return; }
  if (cache[i]) replaced++;
  cache[i] = { h: okHash(text), s: moves, pushes: g.pushes, par: L.par, from: 'wepon ' + name };
  ok++;
});
fs.writeFileSync(cachePath, JSON.stringify(cache));
console.log('解答集の面数', Object.keys(sols).length, '／ 当てはまってクリア', ok, '（自作の答えを置きかえ', replaced, '）');
console.log('再生でクリアにならない', ng.join(' ') || 'なし');
console.log('解答集に無い', noSol.join(' ') || 'なし');
console.log('答えのある面', Object.keys(cache).length, '/', OK_LEVELS.length);
