// scripts/meanings_*.json (id→新meaningのマッピング群) を data/sansu_*.json にマージし、
// 独立検証（answerとmeaning末尾の整合性・id網羅・JSON妥当性）を行う。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SCRIPTS = path.join(ROOT, 'scripts');

// カテゴリ -> [対象data ファイル, [mappingファイル...]]
const PLAN = {
  sansu_keisan: ['meanings_keisan_lo.json', 'meanings_keisan_hi.json'],
  sansu_bun: ['meanings_bun_lo.json', 'meanings_bun_hi.json'],
  sansu_zu: ['meanings_zu_lo.json', 'meanings_zu_hi.json'],
  sansu_kisoku: ['meanings_kisoku_lo.json', 'meanings_kisoku_hi.json'],
  sansu_tokusan: ['meanings_tokusan_lo.json', 'meanings_tokusan_hi.json'],
  sansu_baai: ['meanings_baai_lo.json', 'meanings_baai_hi.json'],
  sansu_kazu: ['meanings_kazu_lo.json', 'meanings_kazu_hi.json'],
  sansu_wariai: ['meanings_wariai.json'],
  sansu_hayasa: ['meanings_hayasa.json'],
  sansu_rittai: ['meanings_rittai.json'],
};

function normalizeAnswer(s) {
  return String(s).trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '');
}

// meaningの最後の「＝」以降を答えとして抽出（末尾の句読点・単位・カッコ等は無視して先頭一致を見る）
function extractTail(meaning) {
  const idx = meaning.lastIndexOf('＝');
  if (idx === -1) return null;
  return meaning.slice(idx + 1).trim();
}

function answerMatches(answer, tail) {
  if (tail == null) return false;
  const a = normalizeAnswer(answer);
  const t = normalizeAnswer(tail);
  // tailの先頭がanswerと一致するか（後ろに「です。」「円」等の説明文が続く場合を許容）
  return t.startsWith(a);
}

let grandTotal = 0, grandMismatch = 0;
const report = [];

for (const [cat, mapFiles] of Object.entries(PLAN)) {
  const dataFile = path.join(DATA, cat + '.json');
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const byId = new Map(data.map(q => [q.id, q]));

  const mapping = new Map();
  for (const mf of mapFiles) {
    const p = path.join(SCRIPTS, mf);
    if (!fs.existsSync(p)) { console.log('MISSING MAPPING FILE:', mf); process.exit(1); }
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
    arr.forEach(({ id, meaning }) => {
      if (mapping.has(id)) console.log('  ! duplicate id across mapping files:', cat, id);
      mapping.set(id, meaning);
    });
  }

  // 網羅性チェック
  const dataIds = new Set(data.map(q => q.id));
  const missing = [...dataIds].filter(id => !mapping.has(id));
  const extra = [...mapping.keys()].filter(id => !dataIds.has(id));
  if (missing.length) console.log('  ! MISSING in mapping for', cat, ':', missing.length, missing.slice(0, 5));
  if (extra.length) console.log('  ! EXTRA ids in mapping for', cat, ':', extra.length, extra.slice(0, 5));

  // 適用 + 検証
  let mismatches = [];
  let applied = 0;
  for (const q of data) {
    const newMeaning = mapping.get(q.id);
    if (newMeaning == null) continue;
    const tail = extractTail(newMeaning);
    if (!answerMatches(q.answer, tail)) {
      mismatches.push({ id: q.id, answer: q.answer, tail });
      continue; // 不一致のものは適用せず旧meaningのまま残す（後で個別対応）
    }
    q.meaning = newMeaning;
    applied++;
  }

  grandTotal += data.length;
  grandMismatch += mismatches.length;
  report.push({ cat, total: data.length, applied, missing: missing.length, extra: extra.length, mismatches: mismatches.length });
  if (mismatches.length) {
    console.log('  ! ANSWER MISMATCHES in', cat, ':', mismatches.length);
    mismatches.slice(0, 10).forEach(m => console.log('    ', m.id, 'answer=', m.answer, 'tail=', m.tail));
  }

  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2) + '\n');
}

console.log('\n=== SUMMARY ===');
report.forEach(r => console.log(r.cat, 'total=' + r.total, 'applied=' + r.applied, 'missing=' + r.missing, 'extra=' + r.extra, 'mismatches=' + r.mismatches));
console.log('grand total items:', grandTotal, 'grand mismatches (left unpatched):', grandMismatch);
