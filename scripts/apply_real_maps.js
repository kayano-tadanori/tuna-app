const fs = require('fs');

const card02Svg = fs.readFileSync('scripts/_card02_svg.html', 'utf8');
const card04Svg = fs.readFileSync('scripts/_card04_svg.html', 'utf8');
const card12Svg = fs.readFileSync('scripts/_card12_svg.html', 'utf8');

// 差し替え対象: 楕円9個の簡易日本地図 (<svg viewBox="0 0 260 372" ...>...</svg>)
const FAKE_MAP_RE = /<svg viewBox="0 0 260 372"[\s\S]*?<\/svg>/;

function applyToFile(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const data = JSON.parse(raw);

  const targets = { sha_kokudo_02: card02Svg, sha_kokudo_04: card04Svg, sha_kokudo_12: card12Svg };

  for (const card of data) {
    if (!(card.id in targets)) continue;
    const before = card.body;
    if (!FAKE_MAP_RE.test(before)) {
      throw new Error(`${path}: ${card.id} に置換対象の地図svgが見つかりません`);
    }
    const after = before.replace(FAKE_MAP_RE, targets[card.id]);
    if (after === before) {
      throw new Error(`${path}: ${card.id} の置換が発生しませんでした`);
    }
    card.body = after;
  }

  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`updated: ${path}`);
}

applyToFile('data/shakai_nippon.json');
applyToFile('scripts/nippon_kokudo.json');
