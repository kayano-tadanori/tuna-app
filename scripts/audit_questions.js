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
            // ★大問1本が1つの出題プール。同じ配列にいる別の大問とは混ざらない
            yield { q: s, file, id: `${q.id}#${i + 1}`, at: String(q.id ?? trail.join('/')), kind: 'step' };
          }
        } else {
          yield { q, file, id: q.id || trail.join('/'), at: trail.join('/'), kind: 'q' };
        }
      } else if (q && typeof q === 'object') {
        yield* questionsOf(q, file, trail);
      }
    }
  } else if (obj && typeof obj === 'object') {
    if (Array.isArray(obj.steps)) {
      for (const [i, s] of obj.steps.entries()) {
        yield { q: s, file, id: `${obj.id}#${i + 1}`, at: String(obj.id ?? trail.join('/')), kind: 'step' };
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

// 図は長いので、全文から鍵を作る。
// ★「長さ＋先頭60字」で済ませたら、同じ大きさの魔方陣（sc3358/sc3359）が同じ図に見えた。
//   数字だけがちがう図は先頭が同じなので、**必ず全文を通す**
const hash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length}:${h.toString(36)}`;
};

const findings = [];
const add = (kind, file, id, msg, detail) => findings.push({ kind, file, id, msg, detail });

let total = 0, withChoices = 0, crossPool = 0;
const seenByFile = new Map();
const seenBody = new Map();   // プールを無視した鍵。別プールへの再出題を数えるだけに使う

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

  for (const { q, id, at } of questionsOf(data, f)) {
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

    // ⑥ 同じ問題が2回ある
    // ★「同じ出題プールの中で2回出る」ことだけが不具合。
    //   ちがう学年・ちがう回に同じ問題があるのは**正常**で、実害が無い：
    //     ・浜学園は復習主義なので、同じ漢字・同じ設問が別の回にも出る（原簿どおり）
    //     ・小3最レが小5単元を先取りするので、同じ問題が2つの学年の玉手箱に入る
    //   1回のセッションで同じ問題に2回当たるのは、プールが同じときだけ。
    //   前はプールを見ずに数えていたので、77件のうち大半が正常なものだった（2026-08-08）。
    // ★選択肢と図も鍵に入れる。問題文と答えが同じでも、
    //   選択肢がちがえば別問題（「音読みしかできない漢字はどれ？」は毎回選択肢がちがう）。
    //   図がちがっても別問題（[[oton_quality_audit]] で9グループを誤って消しかけた）
    if (qt.trim()) {
      const pool = `${at || ''}|g${q.grade ?? ''}d${q.difficulty ?? ''}`;
      const body = norm(qt) + '|' + norm(ans)
        + '|' + norm((q.choices || []).join('␟'))
        + '|' + (q.svg ? hash(String(q.svg)) : '');
      const key = body + '|' + pool;
      if (seen.has(key)) add('同じ問題が2回ある', f, id, `先に ${seen.get(key)}`, qt.slice(0, 46));
      else {
        seen.set(key, id);
        if (seenBody.has(body)) crossPool++;   // 別プールの再出題。数だけ控える
        else seenBody.set(body, id);
      }
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(findings, null, 1));
} else {
  const byKind = new Map();
  for (const x of findings) byKind.set(x.kind, (byKind.get(x.kind) || 0) + 1);
  console.log(`点検した問題 ${total}問（うち選択肢つき ${withChoices}問）`);
  console.log(`見つかった件数 ${findings.length}件`);
  console.log(`（別の学年・別の回への再出題 ${crossPool}件＝復習主義・先取りなので正常。不具合には数えない）\n`);
  for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
    console.log(`【${k}】${n}件`);
    const rows = findings.filter((x) => x.kind === k);
    const byFile = new Map();
    for (const r of rows) byFile.set(r.file, (byFile.get(r.file) || 0) + 1);
    for (const [f, n2] of [...byFile].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${f} … ${n2}件`);
    }
    // 既定は「例4件」。直すときは全部いるので --full で出す。
    // ★件数だけ見て自分で検出を書き直すと、判定式が2つになって偽陽性が出る（実際に踏んだ）
    const show = process.argv.includes('--full') ? rows : rows.slice(0, 4);
    for (const r of show) {
      console.log(`     ${process.argv.includes('--full') ? '・' : '例'} ${r.id}: ${r.msg}${r.detail ? '  → ' + r.detail.slice(0, 62) : ''}`);
    }
    if (show.length < rows.length) console.log(`     …ほか ${rows.length - show.length}件（--full で全部出る）`);
    console.log('');
  }
}
process.exit(0);
