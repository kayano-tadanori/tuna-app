const fs = require('fs');

const card1Svg = fs.readFileSync('scripts/_card1_svg.html', 'utf8');
const card3Svg = fs.readFileSync('scripts/_card3_svg.html', 'utf8');

function replaceFirstSvg(body, replacement) {
  return body.replace(/<svg[\s\S]*?<\/svg>/, replacement);
}

for (const file of ['data/shakai_nippon.json', 'scripts/nippon_kokudo.json']) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = 0;
  for (const item of data) {
    if (item.id === 'sha_kokudo_01') { item.body = replaceFirstSvg(item.body, card1Svg); changed++; }
    if (item.id === 'sha_kokudo_03') { item.body = replaceFirstSvg(item.body, card3Svg); changed++; }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(file, 'updated', changed, 'cards');
}
