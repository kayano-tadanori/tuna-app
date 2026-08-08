// scripts/audit_questions.js — 全カテゴリの問題を横断で検査する
//
// なぜ要るか：
//   [[feedback_kaisetsu_reader]]「私の誤りを間で止められる人がいない＝答えの独立検算は
//   品質管理ではなく唯一の防波堤」。2026-08-08 に「正しく答えても必ず不正解」の設問が
//   7件みつかり、しかも既存の検査（check_answers.py / check_wiring.js）は
//   一部のファイルしか見ていなかった。ここでは data/*.json を全部見る。
//
// 見るもの
//   ① 答えが選択肢に入っていない        …正しく選んでも不正解になる
//   ② 選択肢が重複している              …実質3択・正解が2つに見える
//   ③ 選択肢に正解が2つある             …答え以外でも文が成り立つ（表記ゆれ含む）
//   ④ 解説の結びが答えと合っていない    …「よって、答えは○○です」と answer のズレ
//   ⑤ 答えや問題文が空                  …画面が壊れる
//   ⑥ 同じ問題が2回入っている           …同一カテゴリ内の重複
//   ⑦ 選択肢に説明文や壊れた文字列      …英字混入・異様に長い選択肢
//
//   node scripts/audit_questions.js          … 一覧を出す
//   node scripts/audit_questions.js --json   … 直す用に機械可読で出す

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

// 問題の配列を取り出す。ファイルによって形がちがう
function* questionsOf(obj, file, trail = []) {
  if (Array.isArray(obj)) {
    for (const q of obj) {
      if (q && typeof q === 'object' && (q.question || q.answer !== undefined)) {
        if (Array.isArray(q.steps)) {
          for (const [i, s] of q.steps.entries()) {
            yield { q: s, file, id: `${q.id}#${i + 1}`, kind: 'step' };
          }
        } else {
          yield { q, file, id: q.id || trail.join('/'), kind: 'q' };
        }
      } else if (q && typeof q === 'object') {
        yield* questionsOf(q, file, trail);
      }
    }
  } else if (obj && typeof obj === 'object') {
    if (Array.isArray(obj.steps)) {
      for (const [i, s] of obj.steps.entries()) {
        yield { q: s, file, id: `${obj.id}#${i + 1}`, kind: 'step' };
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'steps') continue;
      yield* questionsOf(v, file, trail.concat(k));
    }
  }
}

// 表記ゆれを吸収して比べる（カタカナ→ひらがな、全角→半角、記号を落とす）
const norm = (s) => String(s ?? '')
  .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/<[^>]*>/g, '')
  .replace(/[\s・、。，．「」『』（）()]/g, '')
  .toLowerCase();

const findings = [];
const add = (kind, file, id, msg, detail) => findings.push({ kind, file, id, msg, detail });

let total = 0, withChoices = 0;
const seenByFile = new Map();

// ★問題の形をしていないデータは見ない。
//   sanken_cases（三権タウン事件簿）は stages[].options[] という別の形で、
//   answer を持たないので「答えが空」が36件出てしまう（誤検知）
const SKIP_FILE = new Set(['sanken_cases.json', 'shakai_nippon.json', 'japan_pref_regions.json']);

for (const f of fs.readdirSync(DATA).filter((f) => f.endsWith('.json')).sort()) {
  if (SKIP_FILE.has(f)) continue;
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { continue; }
  const seen = new Map();
  seenByFile.set(f, seen);

  for (const { q, id } of questionsOf(data, f)) {
    total++;
    const ans = q.answer;
    const qt = String(q.question ?? '');

    // ⑤ 空
    if (ans === undefined || ans === null || String(ans).trim() === '') {
      add('空', f, id, '答えが空'); continue;
    }
    if (!qt.trim() && q.rei !== true) add('空', f, id, '問題文が空');

    if (Array.isArray(q.choices) && q.choices.length) {
      withChoices++;
      const ch = q.choices.map(String);
      // ① 答えが選択肢に無い
      if (!ch.includes(String(ans))) {
        add('答えが選択肢に無い', f, id, `答え「${ans}」`, ch.join(' / '));
      }
      // ② 選択肢の重複（そのまま同じ）
      const dup = ch.filter((c, i) => ch.indexOf(c) !== i);
      if (dup.length) add('選択肢の重複', f, id, [...new Set(dup)].join(' / '), ch.join(' / '));
      // ③ 表記ゆれで同じになる選択肢＝正解が2つに見える
      const nch = ch.map(norm);
      const ndup = nch.filter((c, i) => nch.indexOf(c) !== i);
      if (ndup.length && !dup.length) {
        add('見分けのつかない選択肢', f, id, ch.join(' / '));
      }
      // ⑦ 壊れた選択肢（英単語のまぎれこみ・異様に長い）
      // ★大文字の略語（LED・BTB・PKO）やかっこ書きの原語（Primary（最初））は正当。
      //   こわれているのは「小文字の英単語が日本語のとなりに素で入っている」もの
      //   （changes改善／north向きにする／one人で生きる）。ここを分けないと
      //   85件の正当な表記に本物7件が埋もれる（2026-08-08に実測）
      for (const c of ch) {
        if (/[ぁ-んァ-ヶ一-鿿]/.test(c)) {
          for (const m of c.matchAll(/(?<![A-Za-z])([a-z]{2,})(?![A-Za-z])/g)) {
            const before = c.slice(0, m.index), after = c.slice(m.index + m[1].length);
            if (before.endsWith('（') || before.endsWith('(')) continue;
            if (after.startsWith('）') || after.startsWith(')')) continue;
            if (['cm', 'mm', 'km', 'kg', 'mg', 'ml', 'ha', 'pH'].includes(m[1])) continue;
            add('選択肢に英単語がまぎれている', f, id, `${m[1]} → ${c}`);
          }
        }
        if (c.length > 60) add('選択肢が長すぎる', f, id, c.slice(0, 50) + '…');
      }
    }

    // ④ 解説の結び
    const mean = String(q.meaning ?? '');
    if (mean) {
      const m = mean.match(/よって、?答えは(.+?)です。/);
      if (m) {
        // ★かっこ書きの言いかえは省いてよい。
        //   答え「夕立（にわか雨）がふった」／解説「夕立がふった」は同じことを言っている。
        //   ここを見ないと、まっとうな短縮まで指摘されて本物が埋もれる
        const noParen = (s) => norm(String(s).replace(/[（(][^）)]*[）)]/g, ''));
        const A = [norm(ans), noParen(ans)];
        const S = [norm(m[1]), noParen(m[1])];
        const ok = A.some((a) => S.some((s) => s && a && (a === s || a.includes(s) || s.includes(a))));
        if (!ok) add('解説の結びが答えと合わない', f, id, `答え「${ans}」／解説「${m[1]}」`);
      }
    }

    // ⑥ 同じ問題文＋同じ答えが2回
    if (qt.trim()) {
      const key = norm(qt) + '|' + norm(ans);
      if (seen.has(key)) add('同じ問題が2回ある', f, id, `先に ${seen.get(key)}`, qt.slice(0, 46));
      else seen.set(key, id);
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(findings, null, 1));
} else {
  const byKind = new Map();
  for (const x of findings) byKind.set(x.kind, (byKind.get(x.kind) || 0) + 1);
  console.log(`点検した問題 ${total}問（うち選択肢つき ${withChoices}問）`);
  console.log(`見つかった件数 ${findings.length}件\n`);
  for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
    console.log(`【${k}】${n}件`);
    const rows = findings.filter((x) => x.kind === k);
    const byFile = new Map();
    for (const r of rows) byFile.set(r.file, (byFile.get(r.file) || 0) + 1);
    for (const [f, n2] of [...byFile].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${f} … ${n2}件`);
    }
    for (const r of rows.slice(0, 4)) {
      console.log(`     例 ${r.id}: ${r.msg}${r.detail ? '  → ' + r.detail.slice(0, 62) : ''}`);
    }
    console.log('');
  }
}
process.exit(0);
