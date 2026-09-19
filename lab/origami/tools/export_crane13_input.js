'use strict';
/* 🦵 つる⑬（脚の中割り折り）の独立モデルの入力を固定する（2026-09-16・本人指示・本体は無変更）。
   ⚠ 工程番号の対応：折り図（おりがみくらぶ _zu/tsuru.png）の
        ⑫ まんなかにむけて折る（実装ずみ）→ ⑬ 脚を なかわりおり ←★ここ→ ⑭ 頭を なかわりおり・羽を広げる
      既存の `probe_crane14_structure.js` は**ファイル名が14だが中身は⑬の事前確認**（構造を見るだけ）。
      この書き出しと、これから作る独立モデルは ⑬（crane13）で名前をそろえる。

   材料＝`crane12_state.json`（`node test_crane12.js --write` が画面と同じ engine の道で作る⑫のあとの原本）。
   出力＝`crane13_input.json`＝独立モデル（Python）の入力。**JS の判定は1つも持ち込まない**＝素の幾何だけ：
     - faces：faceId・**いまの位置**の多角形 poly・**素材座標**の多角形 mat（= xf⁻¹·poly）・置かれ方 xf（素材→いまの位置）・層 layer
       🚨 engine の `face.poly` は**いまの位置**の座標（素材座標ではない）。素材は xf⁻¹ を掛けて出す。
     - bonds：結び。**素材座標の線分 seg（結ばれた2面で共通＝素材では隣り合っている）**と、いまの位置 cur
     - creases／hinges／petals（花弁の面＝先端の見分けに使う）
     - landmarks：外形の角・花弁の先端・脚の先端（probe と同じ求め方）
   使い方： node export_crane13_input.js
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname, rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'petal_v2.js', 'fold_crossing.js']) vm.runInThisContext(rd(f));
SquashV2.useV1Validator(OrigamiRecipe.validate, JSON.parse(rd('origami_recipe.schema.json')));
const E = FreeFoldEngine, N = FreeFoldSnap;

const recipe = JSON.parse(rd('crane12_state.json')).recipe;
const st = E.create(); st.recipe = recipe; st.cache = E.replay(recipe); st.committed = st.cache;
const C = st.cache;

const apply = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const inv = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const faceOf = id => C.faces.find(f => f.faceId === id);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/* landmarks
   🚨 probe_crane14_structure.js の見分け（花弁の面の頂点と一致する角＝花弁の先端）は使わない：
      あれは**素材座標の poly を、いまの位置の角と比べていた**（xf を掛け忘れ）＝たまたま当たっていた。
      正しく xf を掛けると、⑫のあとの紙では**脚の先端にも花弁の面が届いている**（脚＝花弁折りが作った長い先端そのもの）＝
      「花弁の面に触れるか」では脚と羽を分けられない。
   ここでは外形の形だけで決める：いちばん遠い2つの角それぞれについて、
      「外形が細いまま続く長さ」＝ほかの外形の角の、その軸方向の射影のいちばん近い所。
      脚の側は⑫で細くしてあるので長い（実データ 1.351）、羽の側は短い（0.649）。
   検算：脚の側は先端から少し切ると 8面ずつ2まとまり、羽の側は 4面ずつ2まとまり（下の necks に記録）。 */
const corners = N.outlineCorners(st);
let far = null; for (const a of corners) for (const b of corners) if (!far || dist(a, b) > dist(far[0], far[1])) far = [a, b];
const neckOf = tip => {
  const other = far.find(p => p !== tip), L = dist(tip, other);
  const u = [(other[0] - tip[0]) / L, (other[1] - tip[1]) / L];
  const along = corners.filter(p => p !== tip && p !== other).map(p => (p[0] - tip[0]) * u[0] + (p[1] - tip[1]) * u[1]);
  return Math.min(...along);
};
const necks = far.map(p => ({ corner: p, neck: neckOf(p) }));
const legTip = necks[0].neck > necks[1].neck ? necks[0].corner : necks[1].corner;
const petalTip = far.find(p => p !== legTip);
if (Math.abs(necks[0].neck - necks[1].neck) < 1e-6) throw new Error('細い所の長さで先端を分けられない');

const out = {
  meta: {
    written: new Date().toISOString().slice(0, 10),
    source: 'crane12_state.json',
    /* cache.hash は長い文字列（形そのもの）なので、入力の取り違えを見るための指紋だけ置く */
    stateFingerprint: require('node:crypto').createHash('sha1').update(C.hash).digest('hex'),
    steps: recipe.steps.map(s => ({ id: s.id, op: s.op })),
    note: '折り図の工程⑬（脚の中割り折り）の直前＝⑫のあとの紙。probe_crane14_structure.js（名前は14）と同じ材料・同じ状態。',
  },
  faces: C.faces.map(f => ({ faceId: f.faceId, poly: f.poly, mat: f.poly.map(p => inv(f.xf, p)), xf: f.xf, layer: f.layer })),
  bonds: C.bonds.map(b => {
    const f0 = faceOf(b.faceIds[0]);
    return { bondId: b.bondId, faceIds: b.faceIds, kind: b.kind, stepId: b.stepId, seg: b.seg, cur: b.seg.map(p => apply(f0.xf, p)) };
  }),
  creases: (C.creases || []).map(c => ({ creaseId: c.creaseId, stepId: c.stepId, faceId: c.faceId, seg: c.seg, kind: c.kind })),
  hinges: (C.hinges || []).map(h => ({ hingeId: h.hingeId, stepId: h.stepId, faceIds: h.faceIds, sourceLine: h.sourceLine, kind: h.kind })),
  petals: (C.petals || []).map(p => ({ faceOf: p.faceOf })),
  landmarks: {
    corners, legTip, petalTip, necks: necks.map(v => ({ corner: v.corner, neck: v.neck })),
    /* 🚨「細いまま続く長さ」で選ぶのは**この入力で脚の側の候補を選ぶため**だけ。脚の一般の定義ではない
       （一般には、素材のどの角から来た面かで決まる＝`check_crane13_model.py` [C] が原紙の角で確かめる）。 */
    note: 'legTip は「この入力での候補」。脚の一般の定義ではない（原紙の角で確かめる）',
  },
};
fs.writeFileSync(path.join(DIR, 'crane13_input.json'), JSON.stringify(out, null, 1));
console.log('crane13_input.json を書いた：面', out.faces.length, '結び', out.bonds.length, '折り目', out.creases.length, '背', out.hinges.length);
console.log('指紋', out.meta.stateFingerprint, '／脚の先端', JSON.stringify(legTip), '／花弁の先端', JSON.stringify(petalTip));
