const fs = require('fs');

const svgSrc = fs.readFileSync('data/japan_map.svg', 'utf8');
const regions = JSON.parse(fs.readFileSync('data/japan_pref_regions.json', 'utf8'));
const geo = JSON.parse(fs.readFileSync('scripts/_pref_bbox.json', 'utf8'));

const pathMatches = [...svgSrc.matchAll(/<path data-pref="([^"]+)" d="([^"]+)"\/>/g)];
const prefs = pathMatches.map(([, pref, d]) => ({ pref, d }));

const VB = '0 0 1536.8191 1750.5018';
const TR = 'translate(-542.3661,-311.44048)';

// ── カード1: 地方区分マップ ──
const REGION_COLOR = {
  '北海道地方': '#4fc3ff',
  '東北地方': '#7ed957',
  '関東地方': '#ffd166',
  '中部地方': '#ff8c42',
  '近畿地方': '#ff6b9d',
  '中国地方': '#b892ff',
  '四国地方': '#4fd1c5',
  '九州地方': '#ff6b6b'
};
const regionPaths = prefs.map(({ pref, d }) => {
  const region = regions[pref];
  const color = REGION_COLOR[region] || '#888';
  return `<path d="${d}" fill="${color}" stroke="#1a2340" stroke-width="0.8"/>`;
}).join('');
const legend = Object.entries(REGION_COLOR).map(([name, color]) =>
  `<span style="display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color}"></span>${name}</span>`
).join('');
const card1Svg = `<svg viewBox="${VB}" style="display:block;margin:0 auto;max-width:260px;background:#dff3ff;border-radius:8px"><g transform="${TR}">${regionPaths}</g></svg>`;
const card1Legend = `<p style="font-size:0.78rem;line-height:1.9;margin-top:8px">${legend}</p>`;

// ── カード3: 位置を間違えやすい都道府県 ──
const pairs = [
  { a: '滋賀県', b: '佐賀県', color: '#ff6b6b', num: '①' },
  { a: '群馬県', b: '栃木県', color: '#4f9eff', num: '②' },
  { a: '山形県', b: '山梨県', color: '#b892ff', num: '③' },
  { a: '宮城県', b: '宮崎県', color: '#4fd1c5', num: '④' },
  { a: '鳥取県', b: '島根県', color: '#e0a800', num: '⑤' }
];
const highlightSet = {};
pairs.forEach(p => { highlightSet[p.a] = p.color; highlightSet[p.b] = p.color; });

const basePaths = prefs.map(({ pref, d }) => {
  const color = highlightSet[pref] || '#cfe0f5';
  return `<path d="${d}" fill="${color}" stroke="#1a2340" stroke-width="0.8"/>`;
}).join('');
const labels = [];
pairs.forEach(p => {
  [p.a, p.b].forEach(pref => {
    const g = geo[pref];
    labels.push(`<text x="${g.cx}" y="${g.cy - 20}" font-family="sans-serif" font-size="26" font-weight="bold" text-anchor="middle" fill="#1a2340" stroke="#fff" stroke-width="4" paint-order="stroke">${p.num}</text>`);
    labels.push(`<text x="${g.cx}" y="${g.cy - 20}" font-family="sans-serif" font-size="26" font-weight="bold" text-anchor="middle" fill="#1a2340">${p.num}</text>`);
  });
});
const card3Svg = `<svg viewBox="${VB}" style="display:block;margin:0 auto;max-width:260px;background:#dff3ff;border-radius:8px"><g transform="${TR}">${basePaths}${labels.join('')}</g></svg>`;

fs.writeFileSync('scripts/_card1_svg.html', card1Svg + card1Legend);
fs.writeFileSync('scripts/_card3_svg.html', card3Svg);
console.log('card1 svg length:', card1Svg.length);
console.log('card3 svg length:', card3Svg.length);
