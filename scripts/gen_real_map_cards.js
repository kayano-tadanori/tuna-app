// 実地図(japan_map.svg)を使って、ニッポンのあゆみの地図カードを本物の形に更新するスクリプト
const fs = require('fs');

const svgSrc = fs.readFileSync('data/japan_map.svg', 'utf8');
const regions = JSON.parse(fs.readFileSync('data/japan_pref_regions.json', 'utf8'));

const pathMatches = [...svgSrc.matchAll(/<path data-pref="([^"]+)" d="([^"]+)"\/>/g)];
const prefs = pathMatches.map(([, pref, d]) => ({ pref, d }));
console.log('parsed paths:', prefs.length);

// 相対パスコマンド(m/l/h/v/c/z)を解析し、サブパスごとの範囲を求めて
// 一番面積の大きいサブパス(=本土・本島)の中心をラベル位置として採用する
// （離島が本土から離れた場所に配置されているデータのため、離島に引っ張られないようにする）
function analyzePath(d) {
  let x = 0, y = 0;
  const subpaths = []; // { minX, minY, maxX, maxY, localMinX, localMinY, localMaxX, localMaxY }
  let cur = null;
  let localX = 0, localY = 0;
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g);
  let i = 0;
  let cmd = null;
  const markCur = (px, py, lx, ly) => {
    if (!cur) return;
    if (px < cur.minX) cur.minX = px; if (px > cur.maxX) cur.maxX = px;
    if (py < cur.minY) cur.minY = py; if (py > cur.maxY) cur.maxY = py;
    if (lx < cur.localMinX) cur.localMinX = lx; if (lx > cur.localMaxX) cur.localMaxX = lx;
    if (ly < cur.localMinY) cur.localMinY = ly; if (ly > cur.localMaxY) cur.localMaxY = ly;
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) { cmd = tokens[i]; i++; }
    if (cmd === 'm') {
      x += parseFloat(tokens[i]); y += parseFloat(tokens[i + 1]); i += 2;
      localX = 0; localY = 0;
      cur = { minX: x, minY: y, maxX: x, maxY: y, localMinX: 0, localMinY: 0, localMaxX: 0, localMaxY: 0 };
      subpaths.push(cur);
      cmd = 'l';
    } else if (cmd === 'l') {
      x += parseFloat(tokens[i]); y += parseFloat(tokens[i + 1]); i += 2;
      localX += parseFloat(tokens[i - 2]); localY += parseFloat(tokens[i - 1]);
      markCur(x, y, localX, localY);
    } else if (cmd === 'h') {
      const dx = parseFloat(tokens[i]); x += dx; localX += dx; i += 1; markCur(x, y, localX, localY);
    } else if (cmd === 'v') {
      const dy = parseFloat(tokens[i]); y += dy; localY += dy; i += 1; markCur(x, y, localX, localY);
    } else if (cmd === 'c') {
      const dx1 = parseFloat(tokens[i]), dy1 = parseFloat(tokens[i + 1]);
      const dx2 = parseFloat(tokens[i + 2]), dy2 = parseFloat(tokens[i + 3]);
      const dx3 = parseFloat(tokens[i + 4]), dy3 = parseFloat(tokens[i + 5]);
      markCur(x + dx1, y + dy1, localX + dx1, localY + dy1);
      markCur(x + dx2, y + dy2, localX + dx2, localY + dy2);
      x += dx3; y += dy3; localX += dx3; localY += dy3;
      markCur(x, y, localX, localY);
      i += 6;
    } else if (cmd === 'z') {
      // サブパスを閉じる。相対座標なので現在点はサブパス開始点に戻る
    } else {
      i++;
    }
  }
  // 最大サブパス(ローカル座標での面積が一番大きいもの)を選ぶ
  let best = subpaths[0];
  let bestArea = 0;
  for (const s of subpaths) {
    const area = (s.localMaxX - s.localMinX) * (s.localMaxY - s.localMinY);
    if (area > bestArea) { bestArea = area; best = s; }
  }
  return {
    cx: (best.minX + best.maxX) / 2,
    cy: (best.minY + best.maxY) / 2,
    subpathCount: subpaths.length
  };
}

const geo = {};
for (const { pref, d } of prefs) geo[pref] = analyzePath(d);

fs.writeFileSync('scripts/_pref_bbox.json', JSON.stringify(geo, null, 2));
console.log('bbox computed for', Object.keys(geo).length, 'prefs');
['滋賀県', '佐賀県', '北海道', '島根県', '沖縄県', '東京都'].forEach(p => console.log(p, geo[p]));
