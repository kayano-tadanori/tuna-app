const fs = require('fs');

const files = ['data/shakai_nippon.json', 'scripts/nippon_kokudo.json'];
const ids = ['sha_kokudo_05', 'sha_kokudo_06', 'sha_kokudo_07', 'sha_kokudo_08', 'sha_kokudo_09'];
const newSvgMap = {
  sha_kokudo_05: fs.readFileSync('scripts/_card05_svg.html', 'utf8'),
  sha_kokudo_06: fs.readFileSync('scripts/_card06_svg.html', 'utf8'),
  sha_kokudo_07: fs.readFileSync('scripts/_card07_svg.html', 'utf8'),
  sha_kokudo_08: fs.readFileSync('scripts/_card08_svg.html', 'utf8'),
  sha_kokudo_09: fs.readFileSync('scripts/_card09_svg.html', 'utf8'),
};

for (const file of files) {
  let raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw); // validate current file first
  for (const id of ids) {
    const card = data.find(c => c.id === id);
    if (!card) throw new Error(`${id} not found in ${file}`);
    const m = card.body.match(/<svg viewBox="0 0 260 372"[\s\S]*?<\/svg>/);
    if (!m) throw new Error(`old map svg not found for ${id} in ${file}`);
    const oldSvg = m[0];
    const oldEscaped = JSON.stringify(oldSvg).slice(1, -1);
    const occurrences = raw.split(oldEscaped).length - 1;
    if (occurrences !== 1) throw new Error(`expected exactly 1 occurrence of old svg for ${id} in ${file}, found ${occurrences}`);
    const newSvg = newSvgMap[id];
    const newEscaped = JSON.stringify(newSvg).slice(1, -1);
    const before = raw.length;
    raw = raw.replace(oldEscaped, newEscaped); // string form: replaces only the first (and only) match
    console.log(file, id, 'replaced, length change', raw.length - before);
  }
  fs.writeFileSync(file, raw, 'utf8');
  console.log('wrote', file);
}
