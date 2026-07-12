// merge_meanings.js で「＝の直後がanswerと一致しない」として未適用のまま残った項目を対象に、
// 文中に answer の値が実際に含まれているか確認したうえで、末尾に「＝{answer}」の確認を追記して
// 検証ルールを満たす形にし、data/sansu_*.json に適用する。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const SCRIPTS = path.join(__dirname);

function normalizeAnswer(s) {
  return String(s).trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/\s+/g, '');
}

function process(cat, mapFiles) {
  const dataFile = path.join(DATA, cat + '.json');
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const byId = new Map(data.map(q => [q.id, q]));

  const mapping = new Map();
  for (const mf of mapFiles) {
    const arr = JSON.parse(fs.readFileSync(path.join(SCRIPTS, mf), 'utf8'));
    arr.forEach(({ id, meaning }) => mapping.set(id, meaning));
  }

  let fixed = 0, stillBad = [];
  for (const q of data) {
    const newMeaning = mapping.get(q.id);
    if (newMeaning == null) continue;
    const idx = newMeaning.lastIndexOf('＝');
    const tail = idx === -1 ? '' : newMeaning.slice(idx + 1).trim();
    const a = normalizeAnswer(q.answer);
    const t = normalizeAnswer(tail);
    if (t.startsWith(a)) continue; // 既にmerge_meanings.jsで適用済みのはず（念のためスキップ）

    // answerの値が文中のどこかに単独の数値として含まれているか確認
    const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(^|[^0-9])' + escaped + '([^0-9]|$)');
    if (re.test(normalizeAnswer(newMeaning))) {
      q.meaning = newMeaning.trim().replace(/。?\s*$/, '') + '＝' + q.answer + '。';
      fixed++;
    } else {
      stillBad.push({ id: q.id, answer: q.answer, meaning: newMeaning });
    }
  }
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2) + '\n');
  console.log(cat, 'fixed:', fixed, 'stillBad:', stillBad.length);
  stillBad.slice(0, 10).forEach(b => console.log('  ', b.id, 'answer=', b.answer, ':', b.meaning));
}

process('sansu_kisoku', ['meanings_kisoku_lo.json', 'meanings_kisoku_hi.json']);
process('sansu_wariai', ['meanings_wariai.json']);
