const fs = require('fs');

const svgSrc = fs.readFileSync('data/japan_map.svg', 'utf8');
const geo = JSON.parse(fs.readFileSync('scripts/_pref_bbox.json', 'utf8'));

const pathMatches = [...svgSrc.matchAll(/<path data-pref="([^"]+)" d="([^"]+)"\/>/g)];
const prefs = pathMatches.map(([, pref, d]) => ({ pref, d }));

const VB = '0 0 1536.8191 1750.5018';
const TR = 'translate(-542.3661,-311.44048)';
const BASE_COLOR = '#cfe0f5';
const STROKE = '#1a2340';

// 座標系の有効範囲（viewBox 0..1536.8191 / 0..1750.5018 に translate(-542.3661,-311.44048) を
// 適用したときにキャンバス内に収まる、g内のローカル座標の範囲）に安全マージンを付けてクランプする
const DOM_X = [542.3661, 542.3661 + 1536.8191];
const DOM_Y = [311.44048, 311.44048 + 1750.5018];
const MARGIN = 40;
function clampX(x) { return Math.min(DOM_X[1] - MARGIN, Math.max(DOM_X[0] + MARGIN, x)); }
function clampY(y) { return Math.min(DOM_Y[1] - MARGIN, Math.max(DOM_Y[0] + MARGIN, y)); }

function labelText(x, y, text, size, fill) {
  return `<text x="${clampX(x)}" y="${clampY(y)}" font-family="sans-serif" font-size="${size}" font-weight="bold" text-anchor="middle" fill="${fill || '#1a2340'}" stroke="#fff" stroke-width="4" paint-order="stroke">${text}</text>`;
}

// ── カード sha_kokudo_02: 県名と異なる都道府県庁所在地 (18都道府県) ──
const capitalMap = {
  '北海道': '札幌市', '岩手県': '盛岡市', '宮城県': '仙台市', '茨城県': '水戸市',
  '栃木県': '宇都宮市', '群馬県': '前橋市', '埼玉県': 'さいたま市', '神奈川県': '横浜市',
  '山梨県': '甲府市', '石川県': '金沢市', '愛知県': '名古屋市', '三重県': '津市',
  '滋賀県': '大津市', '兵庫県': '神戸市', '島根県': '松江市', '香川県': '高松市',
  '愛媛県': '松山市', '沖縄県': '那覇市'
};
{
  const paths = prefs.map(({ pref, d }) => {
    const highlighted = capitalMap[pref];
    const color = highlighted ? '#ff9d4d' : BASE_COLOR;
    return `<path d="${d}" fill="${color}" stroke="${STROKE}" stroke-width="0.8"/>`;
  }).join('');
  const labels = Object.entries(capitalMap).map(([pref, capital]) => {
    const g = geo[pref];
    return labelText(g.cx, g.cy - 16, capital, 16);
  }).join('');
  const card02Svg = `<svg viewBox="${VB}" style="display:block;margin:0 auto;max-width:260px;background:#dff3ff;border-radius:8px"><g transform="${TR}">${paths}${labels}</g></svg>`;
  fs.writeFileSync('scripts/_card02_svg.html', card02Svg);
  console.log('card02 svg length:', card02Svg.length);
}

// ── カード sha_kokudo_04: 日本の位置・時差・排他的経済水域（2つ目のsvg = 東西南北端） ──
{
  const paths = prefs.map(({ pref, d }) => {
    return `<path d="${d}" fill="${BASE_COLOR}" stroke="${STROKE}" stroke-width="0.8"/>`;
  }).join('');
  // 東西南北の端点（実際のおおよその位置、日本地図ローカル座標系で近似）
  // 北端：択捉島（北海道の北東沖）／南端：沖ノ鳥島（東京都・南方はるか海上）
  // 東端：南鳥島（東京都・東方はるか海上）／西端：与那国島（沖縄県の南西端）
  const hokkaido = geo['北海道'];
  const tokyo = geo['東京都'];
  const okinawa = geo['沖縄県'];
  // 択捉島・沖ノ鳥島・南鳥島・与那国島そのものの正確な座標データは無いため、
  // 実際の方角関係（北海道の北方／東京の南方・東方はるか沖／沖縄の西方）を保った
  // 目安の位置に、所属都道府県の実座標を基準としてラベルを配置する
  const points = [
    { x: hokkaido.cx + 70, y: hokkaido.cy - 160, label: '北端：択捉島', dy: -14 },
    { x: tokyo.cx + 40, y: tokyo.cy + 430, label: '南端：沖ノ鳥島', dy: 26 },
    { x: tokyo.cx + 330, y: tokyo.cy + 150, label: '東端：南鳥島', dy: -14 },
    { x: okinawa.cx - 10, y: okinawa.cy - 140, label: '西端：与那国島', dy: -14 }
  ];
  const markers = points.map(p => {
    const cx = clampX(p.x), cy = clampY(p.y);
    return `<circle cx="${cx}" cy="${cy}" r="9" fill="#ff6b6b" stroke="#fff" stroke-width="2.5"/>` +
      labelText(cx, cy + p.dy, p.label, 22);
  }).join('');
  const card04Svg = `<svg viewBox="${VB}" style="display:block;margin:0 auto;max-width:260px;background:#dff3ff;border-radius:8px"><g transform="${TR}">${paths}${markers}</g></svg>`;
  fs.writeFileSync('scripts/_card04_svg.html', card04Svg);
  console.log('card04 svg length:', card04Svg.length);
}

// ── カード sha_kokudo_12: 日本の世界自然遺産 ──
const heritageSites = [
  { pref: '北海道', name: '知床', color: '#2eaf6f' },
  { pref: '青森県', name: '白神山地', color: '#2eaf6f' },
  { pref: '秋田県', name: '白神山地', color: '#2eaf6f' },
  { pref: '東京都', name: '小笠原諸島', color: '#2eaf6f' },
  { pref: '鹿児島県', name: '屋久島・奄美大島', color: '#2eaf6f' },
  { pref: '沖縄県', name: '沖縄島北部・西表島', color: '#2eaf6f' }
];
{
  const highlightSet = {};
  heritageSites.forEach(s => { highlightSet[s.pref] = s.color; });
  const paths = prefs.map(({ pref, d }) => {
    const color = highlightSet[pref] || BASE_COLOR;
    return `<path d="${d}" fill="${color}" stroke="${STROKE}" stroke-width="0.8"/>`;
  }).join('');
  // ラベル位置（本土プレフの重心付近、東京都は小笠原諸島が南方海上にあるため位置調整）
  const tokyo = geo['東京都'];
  const labelDefs = [
    { pref: '北海道', text: '知床', dx: 70, dy: -170 },
    { pref: '青森県', text: '白神山地', dx: -70, dy: -10 },
    { pref: '鹿児島県', text: '屋久島', dx: -30, dy: 90 },
    { pref: '沖縄県', text: '奄美・沖縄', dx: 40, dy: -40 },
  ];
  const labels = labelDefs.map(l => {
    const g = geo[l.pref];
    return labelText(g.cx + l.dx, g.cy + l.dy, l.text, 22);
  }).join('') +
    // 小笠原諸島は東京都本土から離れた南方の海上にあるため、実際に近い位置に矢印付きラベルを追加
    `<circle cx="${clampX(tokyo.cx + 380)}" cy="${clampY(tokyo.cy + 480)}" r="8" fill="#2eaf6f" stroke="#fff" stroke-width="2"/>` +
    labelText(tokyo.cx + 380, tokyo.cy + 450, '小笠原諸島', 22) +
    labelText(tokyo.cx + 380, tokyo.cy + 510, '（東京都）', 18);
  const card12Svg = `<svg viewBox="${VB}" style="display:block;margin:0 auto;max-width:260px;background:#dff3ff;border-radius:8px"><g transform="${TR}">${paths}${labels}</g></svg>`;
  fs.writeFileSync('scripts/_card12_svg.html', card12Svg);
  console.log('card12 svg length:', card12Svg.length);
}
