// scripts/meanings_kokugo_*.json (id→新meaningのマッピング群) を国語の各dataファイルにマージし、
// 独立検証（answerが本文に含まれるか・id網羅・JSON妥当性）を行う。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SCRIPTS = path.join(__dirname);

// カテゴリキー -> [dataファイル名, mappingファイル名]
const PLAN = {
  kotowaza:       ['kotowaza.json', 'meanings_kokugo_kotowaza.json'],
  kanyoku:        ['kanyoku.json', 'meanings_kokugo_kanyoku.json'],
  yojijukugo:     ['yojijukugo.json', 'meanings_kokugo_yojijukugo.json'],
  gairaigo:       ['gairaigo.json', 'meanings_kokugo_gairaigo.json'],
  kanji_kaki:     ['kanji_kaki.json', 'meanings_kokugo_kanji_kaki.json'],
  kanji_yomi:     ['kanji_yomi.json', 'meanings_kokugo_kanji_yomi.json'],
  kokugo_keigo:   ['kokugo_keigo.json', 'meanings_kokugo_keigo.json'],
  kokugo_goi:     ['kokugo_goi.json', 'meanings_kokugo_goi.json'],
  kokugo_bushu:   ['kokugo_bushu.json', 'meanings_kokugo_bushu.json'],
  kokugo_bungaku: ['kokugo_bungaku.json', 'meanings_kokugo_bungaku.json'],
};

function normalize(s) {
  return String(s).trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '')
    .replace(/[（(].*?[）)]/g, '');
}
// ruby/rtタグを除去してからテキストとして比較する（rt内の読みが答えと偶然一致してもtailチェックに影響しないように）
function stripRuby(s) {
  return String(s).replace(/<rt>.*?<\/rt>/g, '');
}

let grandTotal = 0, grandMismatch = 0;
const report = [];

for (const [cat, [dataFile, mapFile]] of Object.entries(PLAN)) {
  const dataPath = path.join(DATA, dataFile);
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  const mapPath = path.join(SCRIPTS, mapFile);
  if (!fs.existsSync(mapPath)) { console.log('MISSING MAPPING FILE:', mapFile); process.exit(1); }
  const mapping = new Map();
  JSON.parse(fs.readFileSync(mapPath, 'utf8')).forEach(({ id, meaning }) => {
    if (mapping.has(id)) console.log('  ! duplicate id in mapping:', cat, id);
    mapping.set(id, meaning);
  });

  const dataIds = new Set(data.map(q => q.id));
  const missing = [...dataIds].filter(id => !mapping.has(id));
  const extra = [...mapping.keys()].filter(id => !dataIds.has(id));
  if (missing.length) console.log('  ! MISSING in mapping for', cat, ':', missing.length, missing.slice(0, 5));
  if (extra.length) console.log('  ! EXTRA ids in mapping for', cat, ':', extra.length, extra.slice(0, 5));

  let mismatches = [];
  let applied = 0;
  for (const q of data) {
    const newMeaning = mapping.get(q.id);
    if (newMeaning == null) continue;
    const a = normalize(q.answer);
    const m = normalize(stripRuby(newMeaning));
    if (a && !m.includes(a)) {
      mismatches.push({ id: q.id, answer: q.answer, meaningTail: newMeaning.slice(-100) });
      continue;
    }
    q.meaning = newMeaning;
    applied++;
  }

  grandTotal += data.length;
  grandMismatch += mismatches.length;
  report.push({ cat, total: data.length, applied, missing: missing.length, extra: extra.length, mismatches: mismatches.length });
  if (mismatches.length) {
    console.log('  ! ANSWER-NOT-CONTAINED in', cat, ':', mismatches.length);
    mismatches.slice(0, 10).forEach(mm => console.log('    ', mm.id, 'answer=', mm.answer, '| tail=', mm.meaningTail));
  }

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
}

console.log('\n=== SUMMARY ===');
report.forEach(r => console.log(r.cat, 'total=' + r.total, 'applied=' + r.applied, 'missing=' + r.missing, 'extra=' + r.extra, 'mismatches=' + r.mismatches));
console.log('grand total items:', grandTotal, 'grand mismatches (left unpatched):', grandMismatch);
