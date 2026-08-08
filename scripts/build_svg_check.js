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
const ROOT = 'C:\\Users\\茅野　忠徳\\Desktop\\Claude\\tuna app';
const DATA = path.join(ROOT, 'data');
const OUT = path.join(__dirname, 'svg_check.html');

// ★日本地図は body に凡例のHTMLごと入っていて誤検知になる（記録どおり除外）
const SKIP_FILE = new Set(['shakai_nippon.json', 'japan_map.svg']);

const items = [];
const seen = new Set();
function walk(o, file, id) {
  if (Array.isArray(o)) return o.forEach((v) => walk(v, file, id));
  if (!o || typeof o !== 'object') return;
  const myId = o.id || id;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'svg' && typeof v === 'string' && v.trim().startsWith('<svg')) {
      const key = v;
      if (!seen.has(key)) { seen.add(key); items.push({ file, id: myId, svg: v }); }
    } else walk(v, file, myId);
  }
}

for (const f of fs.readdirSync(DATA).filter((x) => x.endsWith('.json')).sort()) {
  if (SKIP_FILE.has(f)) continue;
  let d; try { d = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { continue; }
  walk(d, f, '');
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
        if (worst > 0.5) out.over.push(Object.assign({ worst: +worst.toFixed(1) }, meta));
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
    const boxes = [...svg.querySelectorAll('rect')];
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
console.log(`SVG ${items.length}枚を書き出した → ${OUT}`);
