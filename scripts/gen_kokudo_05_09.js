const fs = require('fs');

const svgSrc = fs.readFileSync('data/japan_map.svg', 'utf8');
const geo = JSON.parse(fs.readFileSync('scripts/_pref_bbox.json', 'utf8'));

const pathMatches = [...svgSrc.matchAll(/<path data-pref="([^"]+)" d="([^"]+)"\/>/g)];
const prefs = pathMatches.map(([, pref, d]) => ({ pref, d }));
if (prefs.length !== 47) throw new Error('pref count mismatch: ' + prefs.length);

const VB = '0 0 1536.8191 1750.5018';
const TR = 'translate(-542.3661,-311.44048)';

// キャンバスに収まる g 内ローカル座標の有効範囲（安全マージン付き）
const DOM_X = [542.3661, 542.3661 + 1536.8191];
const DOM_Y = [311.44048, 311.44048 + 1750.5018];
const MARGIN = 30;
function clampX(x) { return Math.min(DOM_X[1] - MARGIN, Math.max(DOM_X[0] + MARGIN, x)); }
function clampY(y) { return Math.min(DOM_Y[1] - MARGIN, Math.max(DOM_Y[0] + MARGIN, y)); }

function bg(fillFn, stroke) {
  return prefs.map(({ pref, d }) => {
    const fill = fillFn ? (fillFn(pref) || '#fff3d6') : '#fff3d6';
    return `<path d="${d}" fill="${fill}" stroke="${stroke || '#c9a86a'}" stroke-width="0.8"/>`;
  }).join('');
}

function wrap(inner, bgColor) {
  return `<svg viewBox="${VB}" style="display:block;margin:0 auto;max-width:260px;background:${bgColor || '#dff3ff'};border-radius:8px"><g transform="${TR}">${inner}</g></svg>`;
}

function labelAt(x, y, text, opts) {
  opts = opts || {};
  const size = opts.size || 22;
  const color = opts.color || '#1a2340';
  const anchor = opts.anchor || 'middle';
  return `<text x="${clampX(x)}" y="${clampY(y)}" font-family="sans-serif" font-size="${size}" font-weight="bold" text-anchor="${anchor}" fill="${color}" stroke="#fff" stroke-width="4" paint-order="stroke">${text}</text>`;
}

function triMark(x, y, size, color) {
  size = size || 16;
  const h = size, w = size * 1.15;
  const cx = clampX(x), cy = clampY(y);
  return `<polygon points="${cx},${cy - h} ${cx - w / 2},${cy + h / 2} ${cx + w / 2},${cy + h / 2}" fill="${color || '#8b6142'}" stroke="#5a3d20" stroke-width="1.5"/>`;
}

function dot(x, y, r, fill) {
  return `<circle cx="${clampX(x)}" cy="${clampY(y)}" r="${r || 9}" fill="${fill || '#2eaf6f'}" stroke="#fff" stroke-width="2.5"/>`;
}

function line(x1, y1, x2, y2, color, width) {
  const cx1 = clampX(x1), cy1 = clampY(y1), cx2 = clampX(x2), cy2 = clampY(y2);
  const mx = (cx1 + cx2) / 2 + (cy1 - cy2) * 0.15;
  const my = (cy1 + cy2) / 2 + (cx2 - cx1) * 0.15;
  return `<path d="M${cx1},${cy1} Q${mx},${my} ${cx2},${cy2}" stroke="${color}" stroke-width="${width || 7}" fill="none" stroke-linecap="round"/>`;
}

function g(pref) {
  const v = geo[pref];
  if (!v) throw new Error('missing pref geo: ' + pref);
  return v;
}

function writeOut(name, svg) {
  fs.writeFileSync(`scripts/_${name}_svg.html`, svg);
  console.log(name, 'length', svg.length);
  return svg;
}

const OUT = {};

// ============================================================
// sha_kokudo_05: 日本の山地・山脈と日本アルプス
// ============================================================
{
  const base = bg(() => '#fff3d6');

  const iwate = g('岩手県'), akita = g('秋田県'), niigata = g('新潟県'), gunma = g('群馬県'),
    nagano = g('長野県'), mie = g('三重県'), nara = g('奈良県'), wakayama = g('和歌山県'),
    tottori = g('鳥取県'), hiroshima = g('広島県'), tokushima = g('徳島県'), kochi = g('高知県'),
    kumamoto = g('熊本県'), miyazaki = g('宮崎県');

  const ranges = [
    { x: (iwate.cx + akita.cx) / 2, y: (iwate.cy + akita.cy) / 2 - 30, name: '奥羽山脈' },
    { x: (niigata.cx + gunma.cx) / 2, y: (niigata.cy + gunma.cy) / 2, name: '越後山脈' },
    { x: nagano.cx, y: nagano.cy - 10, name: '日本アルプス' },
    { x: (mie.cx + nara.cx + wakayama.cx) / 3, y: (mie.cy + nara.cy + wakayama.cy) / 3, name: '紀伊山地' },
    { x: (tottori.cx + hiroshima.cx) / 2, y: (tottori.cy + hiroshima.cy) / 2 - 10, name: '中国山地' },
    { x: (tokushima.cx + kochi.cx) / 2, y: (tokushima.cy + kochi.cy) / 2, name: '四国山地' },
    { x: (kumamoto.cx + miyazaki.cx) / 2, y: (kumamoto.cy + miyazaki.cy) / 2, name: '九州山地' }
  ];
  const marks = ranges.map(r => triMark(r.x, r.y, 20, '#8b6142') + labelAt(r.x, r.y + 46, r.name, { size: 22 })).join('');

  OUT.k05 = writeOut('card05', wrap(base + marks));
}

// ============================================================
// sha_kokudo_06: 日本の平野・盆地とそこでの農業
// ============================================================
{
  const base = bg(() => '#fff3d6');
  const hok = g('北海道'), ibaraki = g('茨城県'), niigata = g('新潟県'), aichi = g('愛知県'),
    gifu = g('岐阜県'), fukuoka = g('福岡県'), saga = g('佐賀県'), yamanashi = g('山梨県'), yamagata = g('山形県');

  const heiya = [
    { x: hok.cx - 95, y: hok.cy + 55, name: '石狩平野' },
    { x: hok.cx + 95, y: hok.cy + 95, name: '十勝平野' },
    { x: ibaraki.cx - 40, y: ibaraki.cy - 20, name: '関東平野' },
    { x: niigata.cx, y: niigata.cy, name: '越後平野' },
    { x: (aichi.cx + gifu.cx) / 2, y: (aichi.cy + gifu.cy) / 2, name: '濃尾平野' },
    { x: (fukuoka.cx + saga.cx) / 2, y: (fukuoka.cy + saga.cy) / 2 + 15, name: '筑紫平野' }
  ];
  const bonchi = [
    { x: yamanashi.cx, y: yamanashi.cy, name: '甲府盆地' },
    { x: yamagata.cx, y: yamagata.cy, name: '山形盆地' }
  ];

  const marks = heiya.map(p => dot(p.x, p.y, 9, '#2eaf6f') + labelAt(p.x, p.y - 20, p.name, { size: 20 })).join('') +
    bonchi.map(p => dot(p.x, p.y, 9, '#e0a800') + labelAt(p.x, p.y - 20, p.name, { size: 20 })).join('');

  OUT.k06 = writeOut('card06', wrap(base + marks));
}

// ============================================================
// sha_kokudo_07: 日本の川と湖
// ============================================================
{
  const base = bg(() => '#fff3d6');
  const hok = g('北海道'), ishikariX = hok.cx - 95, ishikariY = hok.cy + 55;
  const niigata = g('新潟県'), nagano = g('長野県'), gunma = g('群馬県'), ibaraki = g('茨城県'),
    chiba = g('千葉県'), yamagata = g('山形県'), shiga = g('滋賀県'), aichi = g('愛知県'), gifu = g('岐阜県');

  const rivers =
    line(ishikariX, ishikariY - 55, ishikariX + 15, ishikariY + 25, '#2f7fd6', 7) +
    line(yamagata.cx + 10, yamagata.cy - 45, yamagata.cx + 15, yamagata.cy + 35, '#2f7fd6', 7) +
    line(nagano.cx + 5, nagano.cy - 15, niigata.cx, niigata.cy + 15, '#2f7fd6', 7) +
    line(gunma.cx, gunma.cy + 5, chiba.cx - 25, chiba.cy - 35, '#2f7fd6', 7);

  const riverLabels =
    labelAt(ishikariX + 65, ishikariY - 25, '石狩川', { size: 20, color: '#1d6fbf' }) +
    labelAt(yamagata.cx - 55, yamagata.cy, '最上川', { size: 20, color: '#1d6fbf' }) +
    labelAt(nagano.cx - 65, (nagano.cy + niigata.cy) / 2, '信濃川', { size: 20, color: '#1d6fbf' }) +
    labelAt(ibaraki.cx + 15, ibaraki.cy - 55, '利根川', { size: 20, color: '#1d6fbf' }) +
    labelAt((aichi.cx + gifu.cx) / 2, (aichi.cy + gifu.cy) / 2 + 55, '木曽三川', { size: 17, color: '#1d6fbf' });

  const lake = dot(shiga.cx, shiga.cy, 13, '#7fc7ff') + labelAt(shiga.cx + 70, shiga.cy + 10, '琵琶湖', { size: 22, color: '#1d3557' });

  OUT.k07 = writeOut('card07', wrap(base + rivers + riverLabels + lake));
}

// ============================================================
// sha_kokudo_08: 日本を取り巻く海と海流
// ============================================================
{
  const base = bg(() => '#fff3d6');

  const seaLabels =
    labelAt(1860, 1180, '太平洋', { size: 26, color: '#1d6fbf' }) +
    labelAt(760, 1020, '日本海', { size: 26, color: '#1d6fbf' }) +
    labelAt(1600, 380, 'オホーツク海', { size: 19, color: '#1d6fbf' }) +
    labelAt(690, 1690, '東シナ海', { size: 19, color: '#1d6fbf' });

  function arrow(pts, color, label, lx, ly, labelColor) {
    const c = pts.map(p => [clampX(p[0]), clampY(p[1])]);
    let path = `M${c[0][0]},${c[0][1]}`;
    for (let i = 1; i < c.length; i++) path += ` L${c[i][0]},${c[i][1]}`;
    const last = c[c.length - 1], prev = c[c.length - 2];
    const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
    const ah = 22;
    const a1x = last[0] - ah * Math.cos(ang - 0.4), a1y = last[1] - ah * Math.sin(ang - 0.4);
    const a2x = last[0] - ah * Math.cos(ang + 0.4), a2y = last[1] - ah * Math.sin(ang + 0.4);
    const arrowHead = `<polygon points="${last[0]},${last[1]} ${a1x},${a1y} ${a2x},${a2y}" fill="${color}"/>`;
    const lbl = label ? labelAt(lx, ly, label, { size: 19, color: labelColor || color }) : '';
    return `<path d="${path}" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round"/>${arrowHead}${lbl}`;
  }

  const kagoshima = g('鹿児島県'), kochi = g('高知県'), wakayama = g('和歌山県'), shizuoka = g('静岡県'),
    chiba = g('千葉県'), miyagi = g('宮城県'), iwate = g('岩手県'), hokkaido = g('北海道'),
    saga = g('佐賀県'), shimane = g('島根県'), fukui = g('福井県'), niigata = g('新潟県'), akita = g('秋田県');

  const kuroshio = arrow([
    [kagoshima.cx + 40, kagoshima.cy + 60],
    [kochi.cx + 60, kochi.cy + 20],
    [wakayama.cx + 90, wakayama.cy],
    [shizuoka.cx + 100, shizuoka.cy - 40],
    [chiba.cx + 120, chiba.cy - 60],
    [iwate.cx + 130, iwate.cy - 20]
  ], '#e6483a', '黒潮（暖流）', iwate.cx + 220, iwate.cy - 50, '#c0392b');

  const tsushima = arrow([
    [saga.cx - 40, saga.cy + 10],
    [shimane.cx - 40, shimane.cy - 20],
    [fukui.cx - 60, fukui.cy - 30],
    [niigata.cx - 70, niigata.cy - 10],
    [akita.cx - 60, akita.cy + 20]
  ], '#ff8c42', '対馬海流（暖流）', shimane.cx - 230, shimane.cy - 50, '#c0601a');

  const oyashio = arrow([
    [hokkaido.cx + 60, hokkaido.cy + 140],
    [iwate.cx + 80, iwate.cy - 60],
    [miyagi.cx + 90, miyagi.cy - 10]
  ], '#4f9eff', '親潮（寒流）', hokkaido.cx + 160, hokkaido.cy + 230, '#1d6fbf');

  const liman = arrow([
    [hokkaido.cx - 130, hokkaido.cy + 40],
    [akita.cx - 90, akita.cy - 40],
    [niigata.cx - 110, niigata.cy - 60]
  ], '#3ac1e0', 'リマン海流（寒流）', hokkaido.cx - 360, hokkaido.cy + 60, '#1d8fae');

  const shiomeX = (iwate.cx + 80 + miyagi.cx + 90) / 2, shiomeY = (iwate.cy - 60 + miyagi.cy - 10) / 2;
  const shiome = dot(shiomeX, shiomeY, 11, '#8ecbff') + labelAt(shiomeX + 15, shiomeY - 24, '潮目', { size: 18, color: '#1d3557' });

  OUT.k08 = writeOut('card08', wrap(base + seaLabels + kuroshio + tsushima + oyashio + liman + shiome));
}

// ============================================================
// sha_kokudo_09: 日本の気候区分と雨温図の読み方
// ============================================================
{
  const CLIMATE = {
    '北海道': '北海道',
    '青森県': '日本海側', '秋田県': '日本海側', '山形県': '日本海側', '新潟県': '日本海側',
    '富山県': '日本海側', '石川県': '日本海側', '福井県': '日本海側', '京都府': '日本海側',
    '鳥取県': '日本海側', '島根県': '日本海側',
    '岩手県': '太平洋側', '宮城県': '太平洋側', '福島県': '太平洋側', '茨城県': '太平洋側',
    '栃木県': '太平洋側', '群馬県': '太平洋側', '埼玉県': '太平洋側', '千葉県': '太平洋側',
    '東京都': '太平洋側', '神奈川県': '太平洋側', '静岡県': '太平洋側', '愛知県': '太平洋側',
    '三重県': '太平洋側', '滋賀県': '太平洋側', '奈良県': '太平洋側', '和歌山県': '太平洋側',
    '徳島県': '太平洋側', '高知県': '太平洋側', '福岡県': '太平洋側', '佐賀県': '太平洋側',
    '長崎県': '太平洋側', '熊本県': '太平洋側', '大分県': '太平洋側', '宮崎県': '太平洋側',
    '山梨県': '中央高地', '長野県': '中央高地', '岐阜県': '中央高地',
    '大阪府': '瀬戸内', '兵庫県': '瀬戸内', '岡山県': '瀬戸内', '広島県': '瀬戸内',
    '山口県': '瀬戸内', '香川県': '瀬戸内', '愛媛県': '瀬戸内',
    '鹿児島県': '南西諸島', '沖縄県': '南西諸島'
  };
  const COLOR = {
    '北海道': '#8ecdf5',
    '日本海側': '#7fa8e0',
    '太平洋側': '#f2a35c',
    '中央高地': '#c9a3e0',
    '瀬戸内': '#f0d868',
    '南西諸島': '#f57fa8'
  };
  // 47都道府県すべてが分類されているか検証
  const missing = prefs.map(p => p.pref).filter(p => !CLIMATE[p]);
  if (missing.length) throw new Error('climate mapping missing for: ' + missing.join(','));

  const base = bg((pref) => COLOR[CLIMATE[pref]]);

  const reps = [
    ['北海道', '北海道の気候'],
    ['新潟県', '日本海側'],
    ['東京都', '太平洋側'],
    ['長野県', '中央高地'],
    ['岡山県', '瀬戸内'],
    ['沖縄県', '南西諸島']
  ];
  const labels = reps.map(([pref, name]) => {
    const p = g(pref);
    return labelAt(p.cx, p.cy - 34, name, { size: 19 });
  }).join('');

  const legendSwatches = Object.entries(COLOR).map(([name, color]) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin:2px 8px 2px 0;"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};border:1px solid #8886"></span>${name}の気候</span>`
  ).join('');
  const legend = `<p style="font-size:0.78rem;line-height:1.9;margin-top:8px">${legendSwatches}</p>`;

  OUT.k09 = writeOut('card09', wrap(base + labels)) ;
  fs.writeFileSync('scripts/_card09_legend.html', legend);
}

console.log('done');
