'use strict';
/* 🦵 ⑬の入力（`crane13_input.json`）の座標系の回帰検査（2026-09-16・本人指示）。
   ★なぜ要るか：engine の `face.poly` は**いまの位置**の座標、`bond.seg` は**素材座標**。
     前の probe はこれを取り違えて（poly を素材として読んで）先端の見分けを誤った。
     取り違えは「置かれ方が恒等（新しい紙）」では**見えない**ので、**裏返し・回転のある紙**で確かめる。
   ★見ること
     A 紙ごとに：xf·mat = poly（素材→いまの位置）／辺の長さが変わらない／素材は原紙 [-1,1]² の中
     B 結び：素材座標の seg は**結ばれた2面で共通**（xf0·seg = xf1·seg = cur）
     C 取り違えの検出力：poly を素材として読む（xf·poly）と、**裏返し・回転のある紙では必ずずれる**。
       恒等の紙では見えない＝この検査は「回転・裏返しのある紙でしか捕まえられない」と明記して固定する。
     D 書き出した `crane13_input.json` そのもの（あれば）で A・B・C をやり直す＋指紋
   使い方： node test_crane13_input.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname, rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'petal_v2.js', 'fold_crossing.js']) vm.runInThisContext(rd(f));
SquashV2.useV1Validator(OrigamiRecipe.validate, JSON.parse(rd('origami_recipe.schema.json')));
const E = FreeFoldEngine, N = FreeFoldSnap;
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const invPt = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const det = m => m[0] * m[3] - m[1] * m[2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const VW = { toScreen: p => [p[0] * 240, -p[1] * 240] }, SC = p => VW.toScreen(p);

/* 紙を作る：①新しい紙（置かれ方は恒等）②角を角へ1手（回転・裏返しが出る）③さらに紙ぜんぶを裏返す */
function papers() {
  const list = [];
  let st = E.create();
  list.push({ name: '新しい紙（恒等）', cache: st.cache });
  const g = N.grab(st, SC([-1, -1]), VW), cr = N.creaseForCorners(st, g.point, [1, 1]);
  E.proposeOnFace(st, cr.line[0], cr.line[1], cr.faceId, { layers: 1 }); E.setSide(st, cr.sidePoint);
  E.select(st, st.pending.candidates); E.confirm(st);
  list.push({ name: '角を角へ1手（回転と裏返しあり）', cache: st.cache });
  E.flip(st, 'v');
  list.push({ name: 'さらに紙ぜんぶを裏返す', cache: st.cache });
  return list;
}

/* 1つの紙を、書き出しと同じ読み方（poly＝いまの位置／mat＝xf⁻¹·poly／seg＝素材）で検算する */
function checkFrames(cache, label, { expectDetect }) {
  let worstXf = 0, worstLen = 0, worstShared = 0, dets = new Set(), rot = false;
  for (const f of cache.faces) {
    const mat = f.poly.map(p => invPt(f.xf, p));
    dets.add(det(f.xf) > 0 ? 1 : -1);
    if (Math.abs(f.xf[0] - 1) > 1e-9 || Math.abs(f.xf[3] - 1) > 1e-9 || Math.abs(f.xf[1]) > 1e-9 || Math.abs(f.xf[2]) > 1e-9) rot = true;
    for (let i = 0; i < mat.length; i++) {
      worstXf = Math.max(worstXf, dist(apply(f.xf, mat[i]), f.poly[i]));
      const j = (i + 1) % mat.length;
      worstLen = Math.max(worstLen, Math.abs(dist(mat[i], mat[j]) - dist(f.poly[i], f.poly[j])));
      assert.ok(Math.abs(mat[i][0]) <= 1 + 1e-9 && Math.abs(mat[i][1]) <= 1 + 1e-9, `${label}：素材が原紙の外`);
    }
  }
  assert.ok(worstXf < 1e-12, `${label}：xf·mat が poly に一致しない（${worstXf}）`);
  assert.ok(worstLen < 1e-12, `${label}：素材といまの位置で辺の長さが違う（${worstLen}）`);
  /* B 結びの素材座標は2面で共通 */
  for (const b of cache.bonds) {
    const f0 = cache.faces.find(f => f.faceId === b.faceIds[0]), f1 = cache.faces.find(f => f.faceId === b.faceIds[1]);
    const c0 = b.seg.map(p => apply(f0.xf, p)), c1 = b.seg.map(p => apply(f1.xf, p));
    const e = Math.min(Math.max(dist(c0[0], c1[0]), dist(c0[1], c1[1])), Math.max(dist(c0[0], c1[1]), dist(c0[1], c1[0])));
    worstShared = Math.max(worstShared, e);
  }
  assert.ok(worstShared < 1e-9, `${label}：結びの素材座標が2面で共通でない（${worstShared}）`);
  /* C 取り違えの検出力：poly を素材として読むと（xf·poly）どれだけずれるか */
  let mix = 0;
  for (const f of cache.faces) for (const p of f.poly) mix = Math.max(mix, dist(apply(f.xf, p), p));
  const detected = mix > 1e-6;
  assert.equal(detected, expectDetect,
    `${label}：取り違え（poly を素材として読む）の検出が期待と違う（ずれ ${mix.toExponential(2)}／回転・裏返し=${rot}・${[...dets]}）`);
  return { worstXf, worstLen, worstShared, mix, rot, dets: [...dets] };
}

console.log('A/B/C 紙ごとの座標系');
const ps = papers();
const exp = [false, true, true];   /* 恒等の紙では取り違えを捕まえられない（そこも固定する） */
ps.forEach((p, i) => {
  const r = checkFrames(p.cache, p.name, { expectDetect: exp[i] });
  ok(`${p.name}：xf·mat=poly ${r.worstXf.toExponential(1)}／辺の長さ ${r.worstLen.toExponential(1)}`
    + `／結びの共有 ${r.worstShared.toExponential(1)}／取り違えのずれ ${r.mix.toExponential(1)}`
    + `（検出${r.detected === undefined ? (r.mix > 1e-6 ? 'できる' : 'できない') : ''}・裏返し${r.dets.includes(-1) ? 'あり' : 'なし'}）`);
});
assert.ok(ps.slice(1).every((p, i) => true), '');
ok('恒等の紙だけでは取り違えを捕まえられない＝裏返し・回転のある紙が要る、を固定した');

console.log('D 書き出した crane13_input.json');
const P = path.join(DIR, 'crane13_input.json');
if (!fs.existsSync(P)) {
  console.log('  ⚠ crane13_input.json が無い（先に node export_crane13_input.js）→ D は飛ばす');
} else {
  const D = JSON.parse(fs.readFileSync(P, 'utf8'));
  let wx = 0, ws = 0, wc = 0;
  const F = id => D.faces.find(f => f.faceId === id);
  for (const f of D.faces) for (let i = 0; i < f.mat.length; i++) wx = Math.max(wx, dist(apply(f.xf, f.mat[i]), f.poly[i]));
  for (const b of D.bonds) {
    const c0 = b.seg.map(p => apply(F(b.faceIds[0]).xf, p)), c1 = b.seg.map(p => apply(F(b.faceIds[1]).xf, p));
    ws = Math.max(ws, Math.min(Math.max(dist(c0[0], c1[0]), dist(c0[1], c1[1])), Math.max(dist(c0[0], c1[1]), dist(c0[1], c1[0]))));
    wc = Math.max(wc, Math.max(dist(c0[0], b.cur[0]), dist(c0[1], b.cur[1])));
  }
  assert.ok(wx < 1e-12 && ws < 1e-9 && wc < 1e-12, `crane13_input.json の座標系が壊れている（${wx} ${ws} ${wc}）`);
  ok(`crane13_input.json：xf·mat=poly ${wx.toExponential(1)}／結びの共有 ${ws.toExponential(1)}／cur ${wc.toExponential(1)}`);
  /* 材料の取り違え（別の紙の入力）を見るための指紋 */
  const rec = JSON.parse(rd('crane12_state.json')).recipe;
  const fp = require('node:crypto').createHash('sha1').update(E.replay(rec).hash).digest('hex');
  assert.equal(D.meta.stateFingerprint, fp, '指紋が crane12_state.json と違う（入力が古い）');
  ok('指紋が材料（crane12_state.json）と一致 ' + fp.slice(0, 12));
  /* 脚の候補選び：この入力だけの選び方であることを、値として固定する（一般の定義にしない） */
  assert.equal(D.landmarks.necks.length, 2, '遠い2つの角が無い');
  const necks = D.landmarks.necks.map(v => +v.neck.toFixed(3)).sort((a, b) => a - b);
  assert.deepEqual(necks, [0.649, 1.351], '細いまま続く長さが変わった');
  ok('脚の側の候補選び（この入力だけ）：細いまま続く長さ 1.351 対 0.649');
}
console.log(`\nALL OK (${n})`);
