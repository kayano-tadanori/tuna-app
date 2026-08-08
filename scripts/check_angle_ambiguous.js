// 角度のラベルがあるのに弧が無く、**その頂点から3本以上の線が出ている**図を洗い出す。
//
//   node scripts/build_svg_check.js
//   node scripts/check_angle_ambiguous.js [--full]
//
// ★check_angle_arc.js は「弧が無い」ことしか言えない。
//   実際に見ると、**線が2本しか出ていない頂点なら弧が無くても読める**
//   （直線上の1点から1本ひいて、左に x・右に 148° を書く型など）。
//   **本当に決まらないのは、1つの頂点から3本以上出ているとき**。
//   どの2本の間の角なのかが、ラベルの位置だけでは決まらない。
//
// やり方
//   ・<line> と <path d="M..L..L.."> から線分を集める
//   ・端点を3px以内でまとめて「頂点」にし、そこから出ている線分の数を数える
//   ・角度ラベルの近く（半径40px以内）に、3本以上出ている頂点があれば「あぶない」
const fs = require('fs');
const path = require('path');

const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'svg_items.json'), 'utf8'));
const hasArc = (svg) => /<path[^>]*\bd=(["'])[^"']*[Aa][\s0-9]/.test(svg);
const num = (s) => Number(s);

const isAngleLabel = (s) => {
  const t = String(s).trim();
  if (/温度|気温|℃|水温|体温/.test(t)) return false;
  return /^[（(]?[a-zａ-ｚア-ンァ-ヶ㋐-㋾]?[)）]?\s*[0-9]+(\.[0-9]+)?\s*(°|度)$/.test(t);
};

function segments(svg) {
  const segs = [];
  for (const m of svg.matchAll(/<line[^>]*>/g)) {
    const g = (a) => {
      const r = m[0].match(new RegExp(a + '=(["\'])([^"\']*)\\1'));
      return r ? num(r[2]) : null;
    };
    const [x1, y1, x2, y2] = [g('x1'), g('y1'), g('x2'), g('y2')];
    if ([x1, y1, x2, y2].every((v) => v !== null && !isNaN(v))) segs.push([[x1, y1], [x2, y2]]);
  }
  // path の M/L の連なり（曲線 C/Q/A が混ざる path は角の線ではないので飛ばす）
  for (const m of svg.matchAll(/<path[^>]*\bd=(["'])([^"']*)\1/g)) {
    const d = m[2];
    if (/[CcQqAaSsTt]/.test(d)) continue;
    const pts = [...d.matchAll(/[ML]\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g)].map((p) => [num(p[1]), num(p[2])]);
    for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1]]);
    if (/[Zz]/.test(d) && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
  }
  // polygon / polyline
  for (const m of svg.matchAll(/<(polygon|polyline)[^>]*\bpoints=(["'])([^"']*)\2/g)) {
    const pts = m[3].trim().split(/\s+/).map((p) => p.split(',').map(num)).filter((p) => p.length === 2);
    for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1]]);
    if (m[1] === 'polygon' && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
  }
  return segs;
}

function vertices(segs) {
  const v = [];
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 3;
  for (const s of segs) {
    for (const p of s) {
      let hit = v.find((q) => near(q.p, p));
      if (!hit) { hit = { p, n: 0 }; v.push(hit); }
      hit.n++;
    }
  }
  return v;
}

function labels(svg) {
  const out = [];
  for (const m of svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)) {
    if (!isAngleLabel(m[2])) continue;
    const g = (a) => {
      const r = m[1].match(new RegExp(a + '=(["\'])([^"\']*)\\1'));
      return r ? num(r[2]) : null;
    };
    const [x, y] = [g('x'), g('y')];
    if (x !== null && y !== null && !isNaN(x) && !isNaN(y)) out.push({ t: m[2].trim(), p: [x, y] });
  }
  return out;
}

const rows = [];
for (const it of items) {
  if (hasArc(it.svg)) continue;
  const labs = labels(it.svg);
  if (!labs.length) continue;
  const vs = vertices(segments(it.svg));
  const bad = [];
  for (const l of labs) {
    const d = vs.map((v) => ({ v, d: Math.hypot(v.p[0] - l.p[0], v.p[1] - l.p[1]) }))
      .sort((a, b) => a.d - b.d);
    if (!d.length) { bad.push(`${l.t}(線が無い)`); continue; }
    const near = d.filter((x) => x.d <= 40);
    const deg = Math.max(0, ...near.map((x) => x.v.n));
    // ① その頂点から3本以上出ている → どの2本の間か決まらない
    if (deg >= 3) { bad.push(`${l.t}(頂点から${deg}本)`); continue; }
    // ② いちばん近い頂点まで40px以上ある → そもそもどの角のラベルか決まらない
    if (!near.length) bad.push(`${l.t}(頂点まで${Math.round(d[0].d)}px)`);
  }
  if (bad.length) rows.push({ file: it.file, id: it.id, bad });
}

const byFile = new Map();
for (const r of rows) byFile.set(r.file, (byFile.get(r.file) || 0) + 1);
console.log(`弧が無く、頂点から3本以上出ている図：${rows.length}枚\n`);
for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`   ${f} … ${n}枚`);
console.log('');
const show = process.argv.includes('--full') ? rows : rows.slice(0, 25);
for (const r of show) console.log(`   ${r.file} ${r.id}  ${r.bad.join(' / ')}`);
if (show.length < rows.length) console.log(`   …ほか ${rows.length - show.length}枚（--full で全部）`);
