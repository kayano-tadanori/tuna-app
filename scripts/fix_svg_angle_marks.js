// 角度のラベルが「どの角か決まらない」図を直す。
//
//   node scripts/build_svg_check.js
//   node scripts/fix_svg_angle_marks.js          … 何が変わるか見るだけ
//   node scripts/fix_svg_angle_marks.js --write
//
// ★check_angle_ambiguous.js で出た8枚を目で見て、**本当に決まらない3枚だけ**を直す。
//   残り5枚（かんたん解説の「30°」「90°」が箱に入っている図）は
//   角の印ではなく説明の札なので触らない。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'svg_items.json'), 'utf8'));

// 頂点pで、q方向とr方向の間に弧を描く
function arc(p, q, r, rad, color) {
  const a1 = Math.atan2(-(q[1] - p[1]), q[0] - p[0]);
  const a2 = Math.atan2(-(r[1] - p[1]), r[0] - p[0]);
  let d = (a2 - a1 + Math.PI) % (2 * Math.PI) - Math.PI;
  const P = (a) => [p[0] + rad * Math.cos(a), p[1] - rad * Math.sin(a)];
  const s = P(a1), e = P(a1 + d);
  const sweep = d > 0 ? 0 : 1;
  return `<path d="M ${s[0].toFixed(1)} ${s[1].toFixed(1)} A ${rad} ${rad} 0 0 ${sweep} `
    + `${e[0].toFixed(1)} ${e[1].toFixed(1)}" fill="none" stroke="${color}" stroke-width="1.6"/>`;
}

const FIXES = [];

// ── sc_chain_110 平行線と1本の直線 ────────────────────────
// ★もとの図は ア・イ・ウ が交点からはなれた所に浮いていて、どの角か決まらなかった。
//   さらに **ア＝70° と書いてある角が、図では135°に描かれていた**（実角度でない）。
//   小3が角度を学ぶ図で「70°と書いた角が135°」は害があるので、**70°で描き直す**。
//   ア と ウ が外さっ角（等しい）という関係は、描き直しても変わらない。
{
  const deg = 70, R = Math.PI / 180;
  const up = [Math.cos(deg * R), -Math.sin(deg * R)];     // 直線の上向き
  const U = [150, 62], yL = 122;                          // 上の交点と下の平行線のy
  const t = (yL - U[1]) / Math.sin(deg * R);
  const L = [U[0] - t * up[0], yL];                       // 下の交点
  const P = (p, k) => [p[0] + k * up[0], p[1] + k * up[1]];
  const top = P(U, 38), bot = P(L, -38);
  const right = (p) => [260, p[1]], left = (p) => [20, p[1]];
  // ★ラベルは弧のまん中の外がわ。(a1+a2)/2 だと、角の差が180°をこえたとき
  //   **反対がわの中点**になってしまう。arc() と同じように差を −180〜180 にそろえる
  const A = (p, q) => Math.atan2(-(q[1] - p[1]), q[0] - p[0]);
  const lab = (p, q, r_, r, s, c) => {
    const a1 = A(p, q), a2 = A(p, r_);
    const d = (a2 - a1 + Math.PI) % (2 * Math.PI) - Math.PI;
    const m = a1 + d / 2;
    return `<text x="${(p[0] + r * Math.cos(m)).toFixed(1)}" `
      + `y="${(p[1] - r * Math.sin(m) + 4).toFixed(1)}" fill="${c}" font-size="10.5" `
      + `text-anchor="middle" font-family="sans-serif" font-weight="bold">${s}</text>`;
  };
  const neu = '<svg viewBox="0 0 280 170" xmlns="http://www.w3.org/2000/svg" '
    + 'style="display:block;margin:0 auto">'
    + `<line x1="20" y1="${U[1]}" x2="260" y2="${U[1]}" stroke="#cdd6f4" stroke-width="1.4"/>`
    + `<line x1="20" y1="${yL}" x2="260" y2="${yL}" stroke="#cdd6f4" stroke-width="1.4"/>`
    + `<line x1="${top[0].toFixed(1)}" y1="${top[1].toFixed(1)}" x2="${bot[0].toFixed(1)}" `
    + `y2="${bot[1].toFixed(1)}" stroke="#ffd166" stroke-width="1.6"/>`
    + arc(U, top, right(U), 20, '#ff6b6b') + lab(U, top, right(U), 36, 'ア70°', '#ff6b6b')
    + arc(L, left(L), U, 20, '#4f9eff') + lab(L, left(L), U, 34, 'イ', '#4f9eff')
    + arc(L, bot, left(L), 20, '#06d6a0') + lab(L, bot, left(L), 34, 'ウ', '#06d6a0')
    + '<text x="140" y="18" fill="#cdd6f4" font-size="10.5" text-anchor="middle" '
    + 'font-family="sans-serif" font-weight="bold">2本の直線は平行</text></svg>';
  FIXES.push({
    id: 'sc_chain_110',
    why: 'ア・イ・ウが浮いていて、しかも70°と書いた角を135°で描いていた。70°で描き直して弧をつけた',
    whole: neu,
  });
}

// ── ho224 / ho263 かがみの間の角。ものを表す緑の丸が「°」に かぶっていた ──
FIXES.push({
  id: 'ho224',
  why: 'ものを表す緑の丸が「30°」の「°」にかぶっていた。丸を角の中の上のほうへ動かした',
  reps: [['<circle cx="125" cy="66" r="5" fill="#38d9a9"/>',
          '<circle cx="128" cy="54" r="5" fill="#38d9a9"/>']],
});
FIXES.push({
  id: 'ho263',
  why: 'ものを表す緑の丸が「36°」の「°」を完全にかくしていた。丸を角の中の上のほうへ動かした',
  reps: [['<circle cx="125" cy="64" r="5" fill="#38d9a9"/>',
          '<circle cx="128" cy="56" r="5" fill="#38d9a9"/>']],
});

const plans = new Map();
let ng = 0;
for (const f of FIXES) {
  const it = items.find((x) => x.id === f.id);
  if (!it) { console.log(`  ✗ ${f.id}：図が見つからない`); ng++; continue; }
  let svg = it.svg;
  if (f.whole) {                       // 図をまるごと描き直す場合
    if (!plans.has(it.file)) plans.set(it.file, []);
    plans.get(it.file).push({ old: it.svg, neu: f.whole, id: f.id, why: f.why });
    continue;
  }
  for (const [a, b] of f.reps) {
    // ★もう直っている（＝直したあとの形が入っている）なら、取りこぼしではない
    if (!svg.includes(a) && svg.includes(b)) { console.log(`  ・${f.id}：すでに直っている`); continue; }
    if (!svg.includes(a)) { console.log(`  ✗ ${f.id}：見つからない → ${a.slice(0, 70)}`); ng++; svg = null; break; }
    svg = svg.replace(a, b);
  }
  if (!svg) continue;
  if (!plans.has(it.file)) plans.set(it.file, []);
  plans.get(it.file).push({ old: it.svg, neu: svg, id: f.id, why: f.why });
}

let n = 0;
for (const [file, list] of plans) {
  console.log(`\n${file}`);
  for (const p of list) { console.log(`  ・${p.id}\n     ${p.why}`); n++; }
}
console.log(`\n直す図：${n}枚${ng ? `／取りこぼし ${ng}件` : ''}`);
if (ng) { console.log('✗ 取りこぼしがあるので書きこまない'); process.exit(1); }
if (!process.argv.includes('--write')) { console.log('\n（--write で書きこむ）'); process.exit(0); }

for (const [file, list] of plans) {
  const p = path.join(ROOT, 'data', file);
  let raw = fs.readFileSync(p, 'utf8');
  let hit = 0;
  for (const x of list) {
    const a = JSON.stringify(x.old).slice(1, -1);
    const b = JSON.stringify(x.neu).slice(1, -1);
    if (raw.includes(a)) { raw = raw.split(a).join(b); hit++; }
  }
  fs.writeFileSync(p, raw);
  JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log(`  → ${file}（${hit}/${list.length}枚）`);
}
console.log('\n✓ 書きこんだ。必ず描き直して目で見ること');
