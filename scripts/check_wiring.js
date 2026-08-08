// scripts/check_wiring.js — 「データを入れたら画面に出るか」を機械で確かめる
//
// なぜ要るか（2026-08-08）：
//   この日、データを正しく入れたのに画面に出ない不具合を4件出した。全部
//   「app.js の中の前提がデータ側から見えない」型で、目視では気づけなかった。
//     ① app.js に state.grade !== 3 の決め打ちがあり、小4国語が出なかった
//     ② buildChoices が「選択肢は4個以上」を前提にしていて、二択・三択が壊れていた
//     ③ かんたん解説が course === 'sairei' 決め打ちだった（過去）
//     ④ startHamaSession が kind を見ていなかった（過去）
//   ⇒ 自動テストが0本だったので、壊しても誰も気づけない状態だった。
//
// 使い方： node scripts/check_wiring.js
//   問題があれば終了コード1。データやUIを触ったら必ず走らせる。

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = (p) => JSON.parse(R(p));
const exists = (p) => fs.existsSync(path.join(ROOT, p));

let ng = 0, warn = 0;
const fail = (m) => { console.log('  ✗ ' + m); ng++; };
const warnf = (m) => { console.log('  ! ' + m); warn++; };
const sec = (t) => console.log('\n【' + t + '】');

// ────────────────────────────────────────────────────────────
sec('① 読みこむファイルの載せ忘れ');
// app.js を分けたので、index.html と sw.js の両方に並べないと
// 「ローカルでは動くが本番のオフラインで落ちる」が起きる
const html = R('index.html');
const sw = R('sw.js');
const scriptSrcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map(m => m[1]).filter(s => !s.startsWith('http'));
const swAssets = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);

for (const s of scriptSrcs) {
  if (!exists(s)) fail(`index.html が読む ${s} が無い`);
  if (!swAssets.includes(s)) fail(`${s} が sw.js の ASSETS に無い（オフラインで落ちる）`);
}
for (const a of swAssets) {
  if (!exists(a)) fail(`sw.js の ASSETS にある ${a} が無い`);
}
// js/ に置いたのに index.html に足し忘れていないか
for (const f of (fs.existsSync(path.join(ROOT, 'js')) ? fs.readdirSync(path.join(ROOT, 'js')) : [])) {
  if (f.endsWith('.js') && !scriptSrcs.includes('js/' + f)) {
    fail(`js/${f} を作ったのに index.html が読んでいない`);
  }
}
if (!ng) console.log(`  ✓ スクリプト${scriptSrcs.length}本・ASSETS${swAssets.length}件とも実在し、両方に載っている`);

// ────────────────────────────────────────────────────────────
sec('② じゅくナビ：コースが教科ごとに分かれているか');
const map = J('data/hama_map.json');
// app.js hamaCourses(grade, subject) と同じ判定
const coursesOf = (g, subj) => {
  const gg = map.grades[String(g)];
  if (!gg || !gg.courses) return {};
  const out = {};
  for (const [k, v] of Object.entries(gg.courses)) if ((v.subject || 'sansu') === subj) out[k] = v;
  return out;
};
for (const g of Object.keys(map.grades)) {
  for (const [k, v] of Object.entries(map.grades[g].courses)) {
    const subj = v.subject || 'sansu';
    if (!Object.keys(coursesOf(g, subj)).includes(k)) fail(`小${g} ${k} がどの教科でも引けない`);
    if (!Array.isArray(v.lessons) || !v.lessons.length) fail(`小${g} ${k} に回が無い`);
  }
  // ⛔灘合は公開学力テストに出ない別物。ほかの教科のじゅくナビに混ざってはいけない
  for (const subj of ['sansu', 'rika', 'kokugo']) {
    if (Object.keys(coursesOf(g, subj)).includes('nadago')) {
      fail(`小${g} の${subj}じゅくナビに灘合が混ざっている`);
    }
  }
}
if (!ng) console.log('  ✓ 教科ごとに分かれている（灘合の混入なし）');

// ────────────────────────────────────────────────────────────
sec('③ じゅくナビ国語：対応表と問題データがつながっているか');
const kok = J('data/hama_kokugo.json');
for (const g of Object.keys(map.grades)) {
  const c = coursesOf(g, 'kokugo').kokugo;
  if (!c) continue;
  const node = (kok.grades[g] || {}).kokugo;
  if (!node) { fail(`小${g} に国語コースがあるのに hama_kokugo.json にデータが無い`); continue; }
  const empty = c.lessons.filter(l => !(node.lessons[String(l.no)] || {}).kanji?.length);
  if (empty.length) fail(`小${g} 国語：問題が0問の回 ${empty.map(l => 'No.' + l.no).join(',')}`);
  // 回に units を書いたなら、その単元の問題が実在すること
  const bun = J('data/kokugo_bun.json');
  for (const [no, rec] of Object.entries(node.lessons)) {
    for (const u of (rec.units || [])) {
      if (!bun.some(q => q.unit === u && q.grade === Number(g))) {
        fail(`小${g} No.${no} の単元「${u}」の問題が kokugo_bun.json に無い`);
      }
    }
  }
}
console.log('  ✓ 対応表の回と問題データが一致');

// ────────────────────────────────────────────────────────────
sec('④ 選択肢と解説（4択で答えられるか・理由が書いてあるか）');
const bun = J('data/kokugo_bun.json');
for (const q of bun) {
  const id = q.id;
  if (q.choices) {
    // ★buildChoices は選択肢が2個未満だと捨てて、他問の答えを誤答に混ぜてしまう
    if (q.choices.length < 2) fail(`${id} 選択肢が${q.choices.length}個しかない`);
    if (!q.choices.includes(q.answer)) fail(`${id} 答えが選択肢に無い（${q.answer}）`);
    if (new Set(q.choices).size !== q.choices.length) fail(`${id} 選択肢が重複`);
  }
  if (String(id).startsWith('hb4_')) {
    const body = String(q.meaning || '').split('\n')[0];
    if (!body) fail(`${id} 解説が無い`);
    else if (!body.endsWith(`よって、答えは${q.answer}です。`)) {
      fail(`${id} 解説の結びが答えと合わない`);
    }
  }
}
console.log(`  ✓ kokugo_bun ${bun.length}問を点検`);

// ────────────────────────────────────────────────────────────
sec('⑤ 大問モード：正しく答えたら正解になるか');
// ★2026-08-08、選択肢はあるのに答えの表記が食いちがっていて
//   「正しく選んでも必ず不正解」になる設問が5件あった（'300gより重くなる' vs
//   選択肢の '300gより大きくなる'）。目視では見つからない型なので機械で見る。
const daimon = J('data/hama_daimon.json');
// ★「テンキーで打てるか」の判定は scripts/check_answers.py の numpad() と同じにする。
//   自分で書き直すと基準が2つになって食いちがう（帯分数「2と1/4」を打てないと誤判定した）
const numpadOK = (a) =>
  /^\d+(\.\d+)?$/.test(a) || /^\d+\/\d+$/.test(a) || /^\d+と\d+\/\d+$/.test(a) || a.includes('余り');
let steps = 0;
const walkDaimon = (n) => {
  if (Array.isArray(n)) return n.forEach(walkDaimon);
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n.steps)) {
    for (const s of n.steps) {
      steps++;
      const a = String(s.answer ?? '');
      if (!a) { fail(`${n.id} 答えが空の設問がある`); continue; }
      if (s.choices && s.choices.length) {
        if (!s.choices.includes(s.answer)) {
          fail(`${n.id} 答え「${a}」が選択肢に無い → ${JSON.stringify(s.choices)}`);
        }
        if (new Set(s.choices).size !== s.choices.length) fail(`${n.id} 選択肢が重複`);
      } else if (!numpadOK(a)) {
        // 選択肢が無い＝テンキー入力。数字で打てない答えは選べない
        fail(`${n.id} テンキーで打てない答えなのに選択肢が無い →「${a}」`);
      }
    }
  }
  Object.values(n).forEach(walkDaimon);
};
walkDaimon(daimon.grades);
console.log(`  ✓ 大問の設問 ${steps}問を点検`);

// ────────────────────────────────────────────────────────────
sec('⑥ 学年・コースの決め打ち（データを足しても画面に出ない原因）');
const jsFiles = ['app.js', ...(fs.existsSync(path.join(ROOT, 'js'))
  ? fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f) : [])];
for (const f of jsFiles) {
  const src = R(f);
  src.split('\n').forEach((line, i) => {
    if (line.trim().startsWith('//')) return;
    // 例：state.grade !== 3 ／ grade === 4
    const m = line.match(/\b(?:state\.)?grade\s*[=!]==?\s*([1-6])\b/);
    if (m) warnf(`${f}:${i + 1} 学年の決め打ち → ${line.trim().slice(0, 76)}`);
    // ★教科ごとの表は subjectFiles()/subjectLabels()/subjectHome() で引く。
    //   前は同じ三項演算子が6か所にコピーされていて、教科を足すたびに全部直す必要があった
    if (/\?\s*(?:RIKA|SHAKAI)_(?:FILES|CAT_LABELS)\s*:/.test(line)) {
      fail(`${f}:${i + 1} 教科ごとの表を直に振り分けている。subjectFiles()/subjectLabels() を使う`);
    }
  });
}
if (!warn) console.log('  ✓ 学年の決め打ちなし');

// ────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(56));
console.log(ng === 0 ? `✓ 問題なし（警告 ${warn} 件）` : `✗ ${ng} 件の不具合（警告 ${warn} 件）`);
process.exit(ng ? 1 : 0);
