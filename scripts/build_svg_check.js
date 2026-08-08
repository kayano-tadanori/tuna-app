// 全SVGを1枚のHTMLに並べて、ブラウザで実測する
//
//   node scripts/build_svg_check.js
//   msedge --headless=new --disable-gpu --user-data-dir=<一時> --virtual-time-budget=30000 \
//          --window-size=1200,900 --dump-dom <svg_check.html> > svg_dom.txt
//   node scripts/svg_report.js
//
// ⚠ 図を機械で動かしたら必ずレンダリングして目で見ること。
//   [[method_svg_check]]：以前、重なりの自動修正が理科図鑑のカード説明を
//   カードから引きはがし、どの草の説明か分からない状態で本番に出た。
//   「注記＝どこに置いてもよい文字」という前提が、箱に属する文字では成り立たない。

// 手順は [[method_svg_check]] のとおり：
//   ① 枠からのはみ出し = root の getBBox() と viewBox を比べる
//   ② 文字の重なり     = text を総当たり。getBoundingClientRect（画面座標）を使う
//      ★getBBox はローカル座標なので、親<g>のtransformが乗らず誤検出する
//   ③ 箱からのはみ出し = rect の中にいる text がその rect からはみ出していないか
// style.css をインラインで読ませる（フォントが違うと幅が変わる）
const fs = require('fs');
const path = require('path');
// ★PCによってユーザー名がちがうので決め打ちしない（[[jikka_pc_setup]]）
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(__dirname, 'svg_check.html');

// ★日本地図は body に凡例のHTMLごと入っていて誤検知になる（記録どおり除外）
const SKIP_FILE = new Set(['shakai_nippon.json', 'japan_map.svg']);

const items = [];
const seen = new Set();
// ★id を持たないデータ（hama_kaisetsu は回番号のキーで並んでいる）は、JSON上の位置を名前にする。
//   前は id が空のまま出ていて、17件が「どの図か分からないので直せない」状態だった（2026-08-08）
function walk(o, file, id, at) {
  if (Array.isArray(o)) return o.forEach((v, i) => walk(v, file, id, `${at}[${i}]`));
  if (!o || typeof o !== 'object') return;
  const myId = o.id || id;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'svg' && typeof v === 'string' && v.trim().startsWith('<svg')) {
      const key = v;
      if (!seen.has(key)) { seen.add(key); items.push({ file, id: myId || at, svg: v }); }
    } else walk(v, file, myId, at ? `${at}.${k}` : k);
  }
}

for (const f of fs.readdirSync(DATA).filter((x) => x.endsWith('.json')).sort()) {
  if (SKIP_FILE.has(f)) continue;
  let d; try { d = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { continue; }
  walk(d, f, '', '');
}

const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const cells = items.map((it, i) =>
  `<div class="cell" data-i="${i}" data-file="${it.file}" data-id="${it.id || ''}">${it.svg}</div>`
).join('\n');

const measure = `
<script>
function measure() {
  const out = { over: [], overlap: [], boxover: [], n: 0 };
  document.querySelectorAll('.cell').forEach((cell) => {
    const svg = cell.querySelector('svg');
    if (!svg) return;
    out.n++;
    const meta = { file: cell.dataset.file, id: cell.dataset.id, i: cell.dataset.i };
    // ① 枠からのはみ出し
    try {
      const vb = svg.viewBox.baseVal, bb = svg.getBBox();
      if (vb && vb.width) {
        const d = {
          l: vb.x - bb.x, t: vb.y - bb.y,
          r: (bb.x + bb.width) - (vb.x + vb.width),
          b: (bb.y + bb.height) - (vb.y + vb.height),
        };
        const worst = Math.max(d.l, d.t, d.r, d.b);
        // ★どの辺がどれだけ出ているかも残す。これが無いと「広げるだけ」の自動修正が書けない
        if (worst > 0.5) out.over.push(Object.assign({
          worst: +worst.toFixed(1),
          d: { l: +d.l.toFixed(2), t: +d.t.toFixed(2), r: +d.r.toFixed(2), b: +d.b.toFixed(2) },
          vb: [vb.x, vb.y, vb.width, vb.height],
        }, meta));
      }
    } catch (e) {}
    // ② 文字の重なり（画面座標で総当たり）
    const texts = [...svg.querySelectorAll('text')];
    const rects = texts.map((t) => t.getBoundingClientRect());
    for (let a = 0; a < texts.length; a++) {
      for (let b = a + 1; b < texts.length; b++) {
        const A = rects[a], B = rects[b];
        if (!A.width || !B.width) continue;
        const ix = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        const iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (ix > 1.5 && iy > 1.5) {
          const area = ix * iy, small = Math.min(A.width * A.height, B.width * B.height);
          // 縁取り文字（stroke版とfill版の2枚重ね）は100%重なるのが正常
          const strokePair = (texts[a].getAttribute('stroke') || '') !== (texts[b].getAttribute('stroke') || '');
          if (area / small > 0.12 && !strokePair) {
            out.overlap.push(Object.assign({
              ratio: +(area / small).toFixed(2),
              t1: texts[a].textContent.slice(0, 18), t2: texts[b].textContent.slice(0, 18),
            }, meta));
          }
        }
      }
    }
    // ③ 箱からのはみ出し
    // ★見えない枠は箱ではない。塗りも線も無い rect は、置き場所を決めるためだけの
    //   背景（例 <rect width="220" height="150" fill="none"/>）で、そこから文字が出ても
    //   見た目には何も起きない。数えると直方体の寸法ラベル10枚が丸ごと偽陽性になった（2026-08-08）
    const vbA = (svg.viewBox.baseVal && svg.viewBox.baseVal.width * svg.viewBox.baseVal.height) || 0;
    const boxes = [...svg.querySelectorAll('rect')].filter((r) => {
      const fill = (r.getAttribute('fill') || '').trim();
      const stroke = (r.getAttribute('stroke') || '').trim();
      const invisible = (!fill || fill === 'none' || fill === 'transparent')
        && (!stroke || stroke === 'none');
      if (invisible) return false;
      // 図ぜんぶを覆うような枠も「箱」ではなく下じき
      const w = r.width.baseVal.value, h = r.height.baseVal.value;
      if (vbA && w * h > vbA * 0.7) return false;
      return true;
    });
    for (const t of texts) {
      const T = t.getBoundingClientRect();
      for (const r of boxes) {
        const R = r.getBoundingClientRect();
        if (!R.width || !T.width) continue;
        const cx = T.left + T.width / 2, cy = T.top + T.height / 2;
        const inside = cx > R.left && cx < R.right && cy > R.top && cy < R.bottom;
        if (!inside) continue;
        const outw = Math.max(0, R.left - T.left) + Math.max(0, T.right - R.right);
        if (outw > 1.5) {
          out.boxover.push(Object.assign({ out: +outw.toFixed(1), t: t.textContent.slice(0, 20) }, meta));
        }
        break;
      }
    }
  });
  return out;
}
window.addEventListener('load', () => {
  document.getElementById('out').textContent = JSON.stringify(measure());
});
</script>`;

fs.writeFileSync(OUT,
  `<!doctype html><meta charset="utf-8"><style>${css}
.cell{width:340px;display:inline-block;vertical-align:top;margin:2px;background:#fff}
.cell svg{max-width:100%}</style>
<body><pre id="out"></pre>${cells}${measure}</body>`);
// ★直す側（fix_svg_viewbox.js）が「何番目＝どのSVG」を引けるように、同じ並びで書き出す。
//   直す側で walk を書き直すと基準が2つになって、番号がズレる（[[method_measure_first]]）
fs.writeFileSync(path.join(__dirname, 'svg_items.json'), JSON.stringify(items));
console.log(`SVG ${items.length}枚を書き出した → ${OUT}`);
