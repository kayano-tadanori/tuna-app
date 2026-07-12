// scripts/meanings_rika_*.json (id→新meaningのマッピング群) を data/rika_*.json にマージし、
// 独立検証（answerが本文に含まれるか・id網羅・JSON妥当性）を行う。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SCRIPTS = path.join(__dirname);

const PLAN = {
  rika_shokubutsu: ['meanings_rika_shokubutsu_lo.json', 'meanings_rika_shokubutsu_hi.json'],
  rika_doubutsu: ['meanings_rika_doubutsu_lo.json', 'meanings_rika_doubutsu_hi.json'],
  rika_sora: ['meanings_rika_sora_lo.json', 'meanings_rika_sora_hi.json'],
  rika_daichi: ['meanings_rika_daichi.json'],
  rika_mono: ['meanings_rika_mono_lo.json', 'meanings_rika_mono_hi.json'],
  rika_suiyoueki: ['meanings_rika_suiyoueki.json'],
  rika_denki: ['meanings_rika_denki.json'],
  rika_chikara: ['meanings_rika_chikara.json'],
};

function normalize(s) {
  return String(s).trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '')
    .replace(/[（(].*?[）)]/g, ''); // 括弧内の補足（例：ミリリットル）は許容差として除去して比較
}

let grandTotal = 0, grandMismatch = 0;
const report = [];

for (const [cat, mapFiles] of Object.entries(PLAN)) {
  const dataFile = path.join(DATA, cat + '.json');
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

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
    const m = normalize(newMeaning);
    if (a && !m.includes(a)) {
      mismatches.push({ id: q.id, answer: q.answer, meaningTail: newMeaning.slice(-80) });
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

  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2) + '\n');
}

console.log('\n=== SUMMARY ===');
report.forEach(r => console.log(r.cat, 'total=' + r.total, 'applied=' + r.applied, 'missing=' + r.missing, 'extra=' + r.extra, 'mismatches=' + r.mismatches));
console.log('grand total items:', grandTotal, 'grand mismatches (left unpatched):', grandMismatch);
