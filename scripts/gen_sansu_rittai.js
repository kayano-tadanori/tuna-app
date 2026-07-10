// sansu_rittai.json（立体図形）生成スクリプト。小5〜6×難易度1〜4、各20問=160問。全問SVG付き
const fs = require('fs');
const path = require('path');
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const STROKE = '#4f9eff', LABEL = '#ffd166';
const SVG_HEAD = (vw, vh) => `<svg viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto">`;
const label = (x, y, text) => `<text x="${x}" y="${y}" fill="${LABEL}" font-size="12" text-anchor="middle" font-family="sans-serif" font-weight="bold">${text}</text>`;

// 直方体（等角投影の簡易図）
function svgBox(l, w, h, ll, lw, lh) {
  const fw = clamp(l * 6, 45, 110), fh = clamp(h * 6, 35, 90);
  const dx = clamp(w * 4, 20, 50), dy = -clamp(w * 3, 15, 30);
  const x0 = 45, y0 = 100 - fh;
  const x1 = x0 + fw, y1 = 100;
  const tx0 = x0 + dx, ty0 = y0 + dy, tx1 = x1 + dx, ty1 = y1 + dy;
  return SVG_HEAD(220, 130) +
    `<polygon points="${x0},${y0} ${x1},${y0} ${x1},${y1} ${x0},${y1}" fill="none" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<polygon points="${x0},${y0} ${tx0},${ty0} ${tx1},${ty0} ${x1},${y0}" fill="none" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<polygon points="${x1},${y0} ${tx1},${ty0} ${tx1},${ty1} ${x1},${y1}" fill="none" stroke="${STROKE}" stroke-width="2.5"/>` +
    label((x0 + x1) / 2, y1 + 15, ll) + label(x1 + dx / 2 + 12, y0 + dy / 2 - 4, lw) + label(x1 + dx + 14, (ty0 + ty1) / 2, lh) +
    `</svg>`;
}

// 円柱（横から見た図）
function svgCylinder(r, h, lr, lh) {
  const rx = clamp(r * 5, 22, 55), fh = clamp(h * 5, 35, 90);
  const cx = 90, y0 = 100 - fh, y1 = 100;
  return SVG_HEAD(190, 130) +
    `<ellipse cx="${cx}" cy="${y0}" rx="${rx}" ry="14" fill="none" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<line x1="${cx - rx}" y1="${y0}" x2="${cx - rx}" y2="${y1}" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<line x1="${cx + rx}" y1="${y0}" x2="${cx + rx}" y2="${y1}" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<path d="M${cx - rx} ${y1} A${rx} 14 0 0 0 ${cx + rx} ${y1}" fill="none" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<path d="M${cx - rx} ${y1} A${rx} 14 0 0 1 ${cx + rx} ${y1}" fill="none" stroke="${STROKE}" stroke-width="1.2" stroke-dasharray="3,2"/>` +
    label(cx, y0 - 20, lr) + label(cx + rx + 22, (y0 + y1) / 2, lh) +
    `</svg>`;
}

// 円すい
function svgCone(r, h, lr, lh) {
  const rx = clamp(r * 5, 22, 55), fh = clamp(h * 5, 35, 90);
  const cx = 90, y1 = 100, apex = y1 - fh;
  return SVG_HEAD(190, 130) +
    `<ellipse cx="${cx}" cy="${y1}" rx="${rx}" ry="14" fill="none" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<line x1="${cx - rx}" y1="${y1}" x2="${cx}" y2="${apex}" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<line x1="${cx + rx}" y1="${y1}" x2="${cx}" y2="${apex}" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<line x1="${cx}" y1="${apex}" x2="${cx}" y2="${y1}" stroke="${STROKE}" stroke-width="1" stroke-dasharray="3,2"/>` +
    label(cx, apex - 10, lh) + label(cx, y1 + 26, lr) +
    `</svg>`;
}

// 水そう断面（正面から見た長方形＋水位線）
function svgTank(w, depthDisp, waterH, lw, ld) {
  const fw = clamp(w * 4, 60, 140), fh = clamp(depthDisp * 5, 50, 90);
  const x0 = 110 - fw / 2, y0 = 100 - fh, x1 = x0 + fw, y1 = 100;
  const waterY = y1 - clamp(waterH * (fh / depthDisp), 0, fh);
  return SVG_HEAD(220, 130) +
    `<rect x="${x0}" y="${y0}" width="${fw}" height="${fh}" fill="none" stroke="${STROKE}" stroke-width="2.5"/>` +
    (waterH > 0 ? `<rect x="${x0 + 2}" y="${waterY}" width="${fw - 4}" height="${y1 - waterY - 2}" fill="rgba(79,158,255,0.25)" stroke="none"/>` : '') +
    label((x0 + x1) / 2, y1 + 15, lw) + label(x1 + 20, (y0 + y1) / 2, ld) +
    `</svg>`;
}

// 立方体の切断（対角線を含む面で切る）
function svgCubeCut(a) {
  const s = clamp(a * 6, 50, 100);
  const x0 = 50, y0 = 100 - s, x1 = x0 + s, y1 = 100;
  const dx = clamp(s * 0.4, 20, 40), dy = -dx * 0.6;
  const tx0 = x0 + dx, ty0 = y0 + dy, tx1 = x1 + dx, ty1 = y1 + dy;
  return SVG_HEAD(200, 130) +
    `<polygon points="${x0},${y0} ${x1},${y0} ${x1},${y1} ${x0},${y1}" fill="none" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<polygon points="${x0},${y0} ${tx0},${ty0} ${tx1},${ty0} ${x1},${y0}" fill="none" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<polygon points="${x1},${y0} ${tx1},${ty0} ${tx1},${ty1} ${x1},${y1}" fill="none" stroke="${STROKE}" stroke-width="2.5"/>` +
    `<line x1="${x0}" y1="${y1}" x2="${tx1}" y2="${ty0}" stroke="${LABEL}" stroke-width="2" stroke-dasharray="4,3"/>` +
    label((x0 + x1) / 2, y1 + 15, `${a}cm`) +
    `</svg>`;
}

// ===== 小5 =====
function g5_d1() { // 立方体・直方体の体積（SVG付き）
  if (Math.random() < 0.4) {
    const a = randInt(3, 15);
    return { question: `1辺${a}cmの立方体の体積は何cm³ですか？`, answer: String(a ** 3), meaning: `${a}×${a}×${a}＝${a ** 3}`, svg: svgBox(a, a, a, `${a}cm`, `${a}cm`, `${a}cm`) };
  }
  const l = randInt(3, 15), w = randInt(3, 15), h = randInt(3, 15);
  return { question: `たて${l}cm・よこ${w}cm・高さ${h}cmの直方体の体積は何cm³ですか？`, answer: String(l * w * h), meaning: `${l}×${w}×${h}＝${l * w * h}`, svg: svgBox(l, w, h, `${l}cm`, `${w}cm`, `${h}cm`) };
}
function g5_d2a() { // 直方体の表面積（SVG付き）
  const l = randInt(3, 12), w = randInt(3, 12), h = randInt(3, 12);
  const area = 2 * (l * w + w * h + h * l);
  return { question: `たて${l}cm・よこ${w}cm・高さ${h}cmの直方体の表面積は何cm²ですか？`, answer: String(area), meaning: `2×(${l}×${w}＋${w}×${h}＋${h}×${l})＝${area}`, svg: svgBox(l, w, h, `${l}cm`, `${w}cm`, `${h}cm`) };
}
function g5_d2b() { // 立方体の表面積（SVG付き）
  const a = randInt(3, 20);
  const area = 6 * a * a;
  return { question: `1辺${a}cmの立方体の表面積は何cm²ですか？`, answer: String(area), meaning: `6×${a}×${a}＝${area}`, svg: svgBox(a, a, a, `${a}cm`, `${a}cm`, `${a}cm`) };
}
function g5_d2() { return Math.random() < 0.5 ? g5_d2a() : g5_d2b(); }

function g5_d3a() { // 水そうの水位を求める（SVG付き）
  const w = randInt(10, 40), d = randInt(10, 40), waterH = randInt(3, 15);
  const vol = w * d * waterH;
  return { question: `たて${d}cm・よこ${w}cmの水そうに${vol}cm³の水を入れると、深さは何cmになりますか？`, answer: String(waterH), meaning: `${vol}÷(${d}×${w})＝${waterH}`, svg: svgTank(w, depthDispFor(waterH), waterH, `よこ${w}cm`, `たて${d}cm`) };
}
function g5_d3b() { // 水そうの底面のたてを求める（逆算）
  const w = randInt(10, 40), d = randInt(10, 40), waterH = randInt(3, 15);
  const vol = w * d * waterH;
  return { question: `よこ${w}cmの水そうに深さ${waterH}cmまで水を入れると、${vol}cm³になりました。この水そうのたての長さは何cmですか？`, answer: String(d), meaning: `${vol}÷${w}÷${waterH}＝${d}`, svg: svgTank(w, depthDispFor(waterH), waterH, `よこ${w}cm`, 'たて？cm') };
}
function g5_d3() { return Math.random() < 0.5 ? g5_d3a() : g5_d3b(); }
function depthDispFor(waterH) { return waterH + randInt(3, 8); }
function g5_d4() { // 水そうに棒を沈めたときの水位変化（SVG付き）
  const tw = randInt(8, 20), td = randInt(8, 20), depth = randInt(6, 15);
  const bw = randInt(2, Math.max(2, Math.floor(tw / 2) - 1)), bd = randInt(2, Math.max(2, Math.floor(td / 2) - 1));
  const tankArea = tw * td, poleArea = bw * bd;
  const vol = tankArea * depth;
  const newAreaBase = tankArea - poleArea;
  const newH = vol / newAreaBase;
  const rounded = Math.round(newH * 100) / 100;
  return {
    question: `たて${td}cm・よこ${tw}cmの水そうに深さ${depth}cmまで水が入っています。底面がたて${bd}cm・よこ${bw}cmの四角い棒をまっすぐ底まで立てると、水面の高さは何cmになりますか？（棒は水面より高いものとし、割り切れないときは小数第3位を四捨五入）`,
    answer: String(rounded), meaning: `水の体積${vol}cm³÷(底面積${tankArea}－棒の断面積${poleArea})＝${rounded}`,
    svg: svgTank(tw, depth + 6, depth, `よこ${tw}cm`, `たて${td}cm`),
  };
}

// ===== 小6 =====
function g6_d1a() { // 円柱の体積（SVG付き）
  const r = randInt(2, 12), h = randInt(3, 15);
  const vol = Math.round(3.14 * r * r * h * 100) / 100;
  return { question: `底面の半径${r}cm・高さ${h}cmの円柱の体積は何cm³ですか？（円周率3.14）`, answer: String(vol), meaning: `3.14×${r}×${r}×${h}＝${vol}`, svg: svgCylinder(r, h, `半径${r}cm`, `高さ${h}cm`) };
}
function g6_d1b() { // 円柱の高さを求める（体積から逆算）
  const r = randInt(2, 10), h = randInt(3, 15);
  const vol = Math.round(3.14 * r * r * h * 100) / 100;
  return { question: `底面の半径${r}cmの円柱があります。体積が${vol}cm³のとき、高さは何cmですか？（円周率3.14）`, answer: String(h), meaning: `${vol}÷3.14÷${r}÷${r}＝${h}`, svg: svgCylinder(r, h, `半径${r}cm`, '高さ？cm') };
}
function g6_d1() { return Math.random() < 0.5 ? g6_d1a() : g6_d1b(); }
function g6_d2() { // 円柱の表面積 or 円すいの体積（SVG付き）
  if (Math.random() < 0.5) {
    const r = randInt(2, 10), h = randInt(3, 15);
    const area = Math.round(3.14 * (2 * r * r + 2 * r * h) * 100) / 100;
    return { question: `底面の半径${r}cm・高さ${h}cmの円柱の表面積は何cm²ですか？（円周率3.14）`, answer: String(area), meaning: `3.14×(2×${r}×${r}＋2×${r}×${h})＝${area}`, svg: svgCylinder(r, h, `半径${r}cm`, `高さ${h}cm`) };
  }
  const r = randInt(2, 10), h = randInt(3, 15);
  const vol = Math.round(3.14 * r * r * h / 3 * 100) / 100;
  return { question: `底面の半径${r}cm・高さ${h}cmの円すいの体積は何cm³ですか？（円周率3.14、すいの体積＝柱÷3）`, answer: String(vol), meaning: `3.14×${r}×${r}×${h}÷3＝${vol}`, svg: svgCone(r, h, `半径${r}cm`, `高さ${h}cm`) };
}
function g6_d3() { // 回転体の体積（SVG：回転前の長方形/三角形＋軸）
  if (Math.random() < 0.5) {
    const w = randInt(3, 12), h = randInt(3, 15);
    const vol = Math.round(3.14 * w * w * h * 100) / 100;
    return { question: `たて${h}cm・よこ${w}cmの長方形を、たての辺を軸として1回転させてできる立体の体積は何cm³ですか？（円周率3.14）`, answer: String(vol), meaning: `半径${w}cm・高さ${h}cmの円柱になる。3.14×${w}×${w}×${h}＝${vol}`, svg: svgCylinder(w, h, `よこ${w}cm`, `たて${h}cm`) };
  }
  const base = randInt(3, 12), h = randInt(3, 15);
  const vol = Math.round(3.14 * base * base * h / 3 * 100) / 100;
  return { question: `底辺${base}cm・高さ${h}cmの直角三角形を、高さの辺を軸として1回転させてできる立体の体積は何cm³ですか？（円周率3.14）`, answer: String(vol), meaning: `半径${base}cm・高さ${h}cmの円すいになる。3.14×${base}×${base}×${h}÷3＝${vol}`, svg: svgCone(base, h, `底辺${base}cm`, `高さ${h}cm`) };
}
function g6_d4() { // 灘中レベル：立体の切断（体積 or 切断面の面積）
  const r = Math.random();
  if (r < 0.34) { // 立方体の対角面切断（体積）
    const a = randInt(4, 40);
    const vol = a * a * a / 2;
    return { question: `1辺${a}cmの立方体を、向かい合う面の対角線をふくむ平面で半分に切りました。できた三角柱1つの体積は何cm³ですか？`, answer: String(vol), meaning: `${a}×${a}×${a}÷2＝${vol}`, svg: svgCubeCut(a) };
  }
  if (r < 0.67) { // 立方体の対角面切断（切断面の面積＝長方形）
    const a = randInt(4, 40);
    const diag = Math.round(a * 1.41421356 * 100) / 100;
    const area = Math.round(a * diag * 100) / 100;
    return { question: `1辺${a}cmの立方体を、向かい合う面の対角線をふくむ平面で切ります。切り口の長方形の面積は何cm²ですか？（対角線は${a}×1.41で計算し、小数第3位を四捨五入すること）`, answer: String(area), meaning: `対角線${diag}cm×たて${a}cm＝${area}cm²`, svg: svgCubeCut(a) };
  }
  // 立方体の角を切り落とす（切り口の正三角形の面積）
  const a = randInt(6, 60);
  const half = a / 2;
  const legDiag = Math.round(half * 1.41421356 * 100) / 100;
  const area = Math.round(legDiag * legDiag * 0.433 * 100) / 100;
  return { question: `1辺${a}cmの立方体の1つの頂点に集まる3つの辺の中点を通る平面で角を切り落とします。切り口の正三角形の1辺は${legDiag}cmです。この正三角形の面積は何cm²ですか？（三角形の面積は「1辺×1辺×0.433」で概算し、小数第3位を四捨五入すること）`, answer: String(area), meaning: `${legDiag}×${legDiag}×0.433＝${area}`, svg: svgCubeCut(a) };
}

const GENERATORS = { 5: [g5_d1, g5_d2, g5_d3, g5_d4], 6: [g6_d1, g6_d2, g6_d3, g6_d4] };

function genN(fn, n) {
  const out = []; const seen = new Set(); let tries = 0;
  while (out.length < n && tries < 40000) {
    tries++;
    const r = fn();
    if (!r) continue;
    if (seen.has(r.question)) continue;
    seen.add(r.question);
    out.push(r);
  }
  if (out.length < n) throw new Error(`生成不足: ${n}問中${out.length}問`);
  return out;
}

const all = [];
let idCounter = 1;
[5, 6].forEach(grade => {
  for (let diff = 1; diff <= 4; diff++) {
    const fn = GENERATORS[grade][diff - 1];
    const items = genN(fn, 60);
    items.forEach(it => {
      all.push({ id: `sd${String(idCounter).padStart(3, '0')}`, question: it.question, answer: it.answer, meaning: it.meaning, grade, difficulty: diff, svg: it.svg });
      idCounter++;
    });
    console.log(`grade${grade} diff${diff}: OK`);
  }
});
fs.writeFileSync(path.join(__dirname, '..', 'data', 'sansu_rittai.json'), JSON.stringify(all, null, 2) + '\n', 'utf8');
console.log(`合計${all.length}問`);
