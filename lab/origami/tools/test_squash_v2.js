'use strict';
/* v2（袋折り・つる③）の再生器・スキーマ・**互換cacheへの変換**の検査。
   ⛔ 既存アプリ・作品・v1スキーマ・freefold_engine.js・freefold3d.html・袋折り試作の画面は触らない。
   ⛔ **非貫通は未検証**。厚みは0。
   🚪 engine の共通入口での 候補・確定・undo/redo・保存は test_squash_engine.js。ここは v2 の再生器と互換cacheの検査。
   使い方： node test_squash_v2.js   （実Chrome側は test_squash_v2_browser.js）
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
for (const f of ['freefold_engine.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'freefold_snap.js'])
 vm.runInThisContext(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const E = FreeFoldEngine, M = SquashModel, V = SquashV2, N = FreeFoldSnap;
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'origami_recipe.schema.json'), 'utf8'));
const C = x => JSON.parse(JSON.stringify(x));
const RECIPE = path.join(__dirname, 'squash_tsuru3_v2.json');
const det = x => x[0] * x[3] - x[1] * x[2];
const keySet = poly => JSON.stringify(poly.map(p => p.map(v => Math.round(v * 1e6) / 1e6 + 0))
 .slice().sort((u, v) => u[0] - v[0] || u[1] - v[1]));
const throws = (fn, re, msg) => assert.throws(fn, e => { assert.match(e.message, re, msg + '｜出た理由: ' + e.message); return true }, msg);
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };

/* ================= 0 担当の分けかた＝v1 の検証器を渡さなければ再生しない ================= */
throws(() => V.replay({ version: 2 }), /v1 の検証器が読みこまれていません/, '0 v1 の検証器なしで再生してしまう');
throws(() => V.useV1Validator(null, SCHEMA), /検証器.*関数ではありません/, '0 関数でない検証器を受けてしまう');
throws(() => V.useV1Validator(OrigamiRecipe.validate, { properties: { version: { const: 2 } } }),
 /schema が origami_recipe.schema.json ではありません/, '0 v1 でない schema を受けてしまう');
V.useV1Validator(OrigamiRecipe.validate, SCHEMA);
ok('v1 の検証は既存（origami_recipe.js＋schema）に任せ、渡していなければ再生しない');

/* ================= A 保存した原本を読み直して再生できる ================= */
assert.equal(fs.existsSync(RECIPE), true, 'A squash_tsuru3_v2.json が無い');
const text = fs.readFileSync(RECIPE, 'utf8');
const recipe = JSON.parse(text);
assert.equal(recipe.version, 2, 'A version が2でない');
assert.equal(recipe.steps.map(s => s.op).join(','), 'fold,fold,squash', 'A 手の並びが fold,fold,squash でない');
const out = V.replay(recipe);
ok('保存した v2 原本を再生できる（面 ' + out.faces.length + '／結び ' + out.bonds.length + '／領域 ' + out.regions.length + '）');

const again = V.replay(JSON.parse(JSON.stringify(JSON.parse(text))));
assert.equal(again.hash, out.hash, 'A 読み直すと再生結果が変わる');
assert.deepEqual(again.faces.map(f => f.faceId), out.faces.map(f => f.faceId), 'A 面IDが変わる');
assert.deepEqual(again.faces.map(f => f.layerPath), out.faces.map(f => f.layerPath), 'A layerPath が変わる');
assert.deepEqual(again.faces.map(f => Math.sign(det(f.xf))), out.faces.map(f => Math.sign(det(f.xf))), 'A 表裏が変わる');
assert.deepEqual(again.faces.map(f => f.layer), out.faces.map(f => f.layer), 'A 層が変わる');
assert.deepEqual(again.bonds, out.bonds, 'A 結びが変わる');
assert.deepEqual(again.branch, out.branch, 'A 運動の枝が変わる');
assert.deepEqual(again.regions, out.regions, 'A 重なり領域が変わる');
ok('読み直しても、形・表裏・層・面ID・結び・運動の枝・領域がぜんぶ一致する');

/* 🚨子面の呼び名は既存と同じ keep/cut（v1 schema の layerPath.side は enum ['keep','cut']）。 */
const byId = new Map(out.faces.map(f => [f.faceId, f]));
assert.deepEqual(out.faces.map(f => f.faceId).slice().sort(), [
 'paper/s1.cut/s2.cut/s3.cut', 'paper/s1.cut/s2.cut/s3.keep', 'paper/s1.cut/s2.keep',
 'paper/s1.keep/s2.cut/s3.cut', 'paper/s1.keep/s2.cut/s3.keep', 'paper/s1.keep/s2.keep'],
 'A 子面の名前が keep/cut でない');
for (const f of out.faces) for (const p of f.layerPath)
 assert.equal(['keep', 'cut'].includes(p.side), true, 'A layerPath の side が keep/cut でない: ' + p.side);
/* 対応の根拠＝engine の split と同じ向き（軸を vertex→end に取って S>=0 の側が keep）。 */
for (const sp of out.splits) {
 const pf = out.before.faces.find(f => f.faceId === sp.parent);
 const [k, c] = E.split(pf.poly.map(p => V.invPt(pf.xf, p)), sp.axis.vertex, sp.axis.end);
 assert.equal(keySet(k), keySet(M.MATERIAL[sp.keepSector]), 'A keep の側が engine の split と違う: ' + sp.parent);
 assert.equal(keySet(c), keySet(M.MATERIAL[sp.cutSector]), 'A cut の側が engine の split と違う: ' + sp.parent);
}
assert.deepEqual(out.splits.map(s => s.parent + ':keep=P' + s.keepSector + ',cut=P' + s.cutSector),
 ['paper/s1.keep/s2.cut:keep=P2,cut=P1', 'paper/s1.cut/s2.cut:keep=P4,cut=P3'], 'A 分割の keep/cut の対応が変わった');
ok('子面は keep/cut（対応は engine の split の向きそのもの・素材で突き合わせずみ）');

assert.deepEqual(out.regions.map(r => r.order), [
 ['paper/s1.keep/s2.keep', 'paper/s1.cut/s2.keep', 'paper/s1.cut/s2.cut/s3.keep', 'paper/s1.cut/s2.cut/s3.cut'],
 ['paper/s1.keep/s2.keep', 'paper/s1.cut/s2.keep'],
 ['paper/s1.keep/s2.cut/s3.cut', 'paper/s1.keep/s2.cut/s3.keep']],
 'A 全重なり領域の上下が、検証ずみ（check_squash_layers.py）と違う');
assert.equal(out.regions.every(r => Math.abs(r.area - 0.5) < 1e-9), true, 'A 領域の面積が0.5でない');
ok('領域の上下が check_squash_layers.py の答えと同じ（Q_E<Q_S<P4<P3／Q_E<Q_S／P1<P2）');

/* ================= A2 結び＝由来（bondId・stepId・素材の共有区間）を落とさない ================= */
const beforeBonds = new Map(out.before.bonds.map(b => [b.bondId + '|' + JSON.stringify(b.seg), b]));
assert.equal(out.bonds.length, 6, 'A2 結びが6本でない');
assert.equal(out.bonds.filter(b => b.origin === 'inherited').length, 4, 'A2 継承した結びが4本でない');
assert.equal(out.bonds.filter(b => b.origin === 'split').length, 2, 'A2 割ってできた結びが2本でない');
for (const b of out.bonds.filter(v => v.origin === 'inherited')) {
 const src = beforeBonds.get(b.bondId + '|' + JSON.stringify(b.seg));
 assert.equal(!!src, true, 'A2 継承した結びの由来（bondId＋素材の区間）が元の cache に無い: ' + b.bondId);
 assert.equal(b.stepId, src.stepId, 'A2 継承した結びの由来の手が変わった: ' + b.bondId);
 assert.deepEqual(b.seg, src.seg, 'A2 継承した結びの素材の共有区間が変わった: ' + b.bondId);
}
for (const b of out.bonds.filter(v => v.origin === 'split')) {
 assert.equal(b.stepId, 's3', 'A2 割ってできた結びの由来が s3 でない');
 assert.equal(/^b\d+$/.test(b.bondId), true, 'A2 新しい bondId の綴りが違う: ' + b.bondId);
 assert.equal(out.before.bonds.some(x => x.bondId === b.bondId), false, 'A2 新しい bondId が既存とぶつかった: ' + b.bondId);
}
/* 🚨kind は**終端の折り角**で決まる。開いた（ρ=0）＝crease／折れたまま（|ρ|=π）＝hinge。 */
const rEnd = M.rhoOf(1);
const rayOf = seg => { const far = Math.hypot(seg[0][0], seg[0][1]) > Math.hypot(seg[1][0], seg[1][1]) ? seg[0] : seg[1];
 return M.RAY.findIndex(d => Math.abs(d[0] * far[1] - d[1] * far[0]) < 1e-6 && d[0] * far[0] + d[1] * far[1] > 0) };
for (const b of out.bonds) {
 const i = rayOf(b.seg);
 assert.equal(i >= 0, true, 'A2 結びが8本の折り線の上にない');
 const want = Math.abs(rEnd[i]) <= 1e-9 ? 'crease' : 'hinge';
 assert.equal(b.kind, want, `A2 折り線 ${i} の kind が終端の折り角と合わない（${b.kind} ≠ ${want}）`);
 assert.equal(!!b.openedBy, b.origin === 'inherited' && want === 'crease', 'A2 開いた印が合わない: ' + b.bondId);
}
assert.equal(out.bonds.filter(b => b.kind === 'crease').length, 2, 'A2 開いた結びが2本でない');
assert.equal(out.bonds.filter(b => b.kind === 'hinge').length, 4, 'A2 折れたままの結びが4本でない');
ok('結びは由来（bondId・stepId・素材の共有区間）を持ち越し、kind は終端の折り角で決まる（開いた2本＝crease）');

/* 動かない子面は、親の置かれ方をそのまま継ぐ（表裏も xf も変わらない）。 */
const before = new Map(out.before.faces.map(f => [f.faceId, f]));
const parentOf = id => id.replace(/\/s3\.(keep|cut)$/, '');
for (const f of out.faces) {
 assert.equal(before.has(parentOf(f.faceId)), true, 'A 親の面が見つからない: ' + parentOf(f.faceId));
 if (!f.moving) assert.equal(f.xf.every((v, i) => Math.abs(v - before.get(parentOf(f.faceId)).xf[i]) < 1e-9), true,
  'A 動かない面 ' + f.faceId + ' の置かれ方が親と違う');
}
assert.deepEqual(out.faces.filter(f => f.moving).map(f => f.faceId).sort(),
 ['paper/s1.cut/s2.cut/s3.cut', 'paper/s1.keep/s2.cut/s3.cut', 'paper/s1.keep/s2.cut/s3.keep'],
 'A 動く面が P1,P2,P3 でない');
assert.deepEqual(out.faces.map(f => f.faceId + ':' + (det(f.xf) > 0 ? 'おもて' : 'うら')).slice().sort(), [
 'paper/s1.cut/s2.cut/s3.cut:うら', 'paper/s1.cut/s2.cut/s3.keep:おもて', 'paper/s1.cut/s2.keep:うら',
 'paper/s1.keep/s2.cut/s3.cut:おもて', 'paper/s1.keep/s2.cut/s3.keep:うら', 'paper/s1.keep/s2.keep:おもて'],
 'A 最終形の表裏が変わった');
for (const r of out.regions) for (let i = 1; i < r.order.length; i++)
 assert.equal(byId.get(r.order[i - 1]).diagramLayer < byId.get(r.order[i]).diagramLayer, true,
  'A 折り図の層が領域の上下と矛盾: ' + r.order.join(' < '));
ok('動かない子面は親の置かれ方と表裏を継ぐ／折り図の層とも矛盾しない');

/* ================= B 描画用の座標と、再生結果を照合する ================= */
let worst = 0;
for (let k = 0; k <= 40; k++) {
 const t = k / 40, a = V.positions(out, t), b = M.renderVertices(t).positions;
 assert.equal(a.length, b.length, 'B 座標の長さが違う');
 for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
}
assert.equal(worst, 0, 'B 再生結果の座標が、描画へ渡す配列と一致しない: ' + worst);
for (const [t, pick] of [[0, f => before.get(parentOf(f.faceId))], [1, f => f]]) {
 const pl = M.panels(t);
 for (const f of out.faces) for (const s of f.sectors) {
  const got = M.MATERIAL[s].map(p => V.apply(pick(f).xf, p));
  assert.equal(keySet(got), keySet(pl[s].map(v => [v[0], v[1]])),
   `B t=${t} の区間 P${s}（面 ${f.faceId}）が、描画の形と一致しない`);
 }
}
assert.equal(V.frames(out, 1).map(fr => fr.faceId).join(','), out.sectorFace.join(','), 'B 割りつけが frames と食い違う');
throws(() => V.frames(out, 1.5), /t は 0〜1/, 'B 範囲外の t を断らない');
ok('41コマとも 再生結果の座標＝描画へ渡す配列（差 0）／両端の形も一致');

/* ================= C 入力も状態も書きかえない ================= */
const snapshot = JSON.stringify(recipe);
V.replay(recipe);
assert.equal(JSON.stringify(recipe), snapshot, 'C 再生で入力の原本が書きかわった');
const live = E.replay({ ...recipe, version: 1, steps: recipe.steps.slice(0, 2) });
const liveText = JSON.stringify(live);
V.replay(recipe);
assert.equal(JSON.stringify(live), liveText, 'C 再生で v1 側の状態が書きかわった');
ok('入力の原本も v1 の状態も書きかえない');

/* ================= D スキーマ＝v1 は既存の検証器・v2 は自分 ================= */
const mut = fn => { const r = C(recipe); fn(r); return r };
throws(() => V.replay(mut(r => { r.version = 1 })), /version 1 はこの再生器の担当ではありません/, 'D v1 を断らない');
throws(() => V.replay(mut(r => { r.version = 3 })), /version が 2 ではありません/, 'D 未知 version を断らない');
throws(() => V.replay(mut(r => { r.version = '2' })), /version が 2 ではありません/, 'D 文字列の version を断らない');
throws(() => V.replay(mut(r => { delete r.version })), /version が 2 ではありません/, 'D version 欠落を断らない');
throws(() => V.replay(mut(r => { r.steps = r.steps.slice(0, 2) })), /squash の手がありません/, 'D squash の無い v2 を断らない');
/* ★2026-09-15 squash の手数では断らない（2回目の袋折りは test_squash_twice.js）。同じ手を id ごと足すのは id 重複で断り、
   id を変えても**裏返していない紙**では袋の上に紙が乗っていて開けない（幾何の門）ので断る。 */
throws(() => V.replay(mut(r => { r.steps.push(C(r.steps[2])) })), /手の id が重複しています/, 'D id の重複した squash を断らない');
throws(() => V.replay(mut(r => { r.steps.push({ ...C(r.steps[2]), id: 's4', diagramStep: '4' }) })), /袋の上に止まった紙が乗っています/, 'D 裏返していない紙の2回目の squash を断らない');
/* ⚠「squash は最後の手」の決まりは外した（2026-09-14・袋折りのあとの手は test_squash_after.js）。先頭の squash は前の手が無いので断る。 */
throws(() => V.replay(mut(r => { r.steps = [r.steps[2], r.steps[0], r.steps[1]] })), /前の手（v1）がありません/, 'D squash が先頭（前の手が無い）形を断らない');
throws(() => V.replay(mut(r => { r.steps = [r.steps[2]] })), /前の手（v1）がありません/, 'D v1 の手が無い形を断らない');
/* 🚨v1 の部分は既存の検証器が断る＝ここの理由は origami_recipe.js のことば。 */
for (const badOp of ['squashFold', 'open-pocket', 'FOLD', '']) {
 throws(() => V.replay(mut(r => { r.steps[0].op = badOp })), /前後の手（v1）が原本の形になっていません.*未対応の操作/,
  'D 未知 op「' + badOp + '」を v1 の検証器が断らない');
}
throws(() => V.replay(mut(r => { delete r.steps[0].op })), /未対応の操作/, 'D op 欠落を断らない');
throws(() => V.replay(mut(r => { delete r.steps[0].line })), /前後の手（v1）.*fields do not match operation/, 'D fold の必須項目の欠落を断らない');
throws(() => V.replay(mut(r => { delete r.steps[0].instruction })), /前後の手（v1）.*instruction: required/, 'D instruction の欠落を断らない');
throws(() => V.replay(mut(r => { r.steps[0].soft = true })), /前後の手（v1）.*soft: unknown field/, 'D 手の余分な項目を断らない');
throws(() => V.replay(mut(r => { r.note = 'x' })), /前後の手（v1）.*unknown field/, 'D top の未知項目を断らない');
throws(() => V.replay(mut(r => { r.work.extra = 1 })), /前後の手（v1）.*unknown field/, 'D 入れ子の未知項目を断らない');
throws(() => V.replay(mut(r => { delete r.format })), /前後の手（v1）.*format: required/, 'D format 欠落を断らない');
throws(() => V.replay(mut(r => { r.format = 'origami' })), /前後の手（v1）.*format: expected origami-recipe/, 'D format 違いを断らない');
throws(() => V.replay(mut(r => { r.coordinates = 'xy' })), /前後の手（v1）.*coordinates/, 'D coordinates 違いを断らない');
throws(() => V.replay(mut(r => { r.steps[0].line[0] = [-2, 1] })), /前後の手（v1）.*out of range/, 'D 紙の外の折線を断らない');
throws(() => V.replay(mut(r => { r.steps[0].movingSidePoint = [0, 5] })), /前後の手（v1）.*out of range/, 'D 紙の外の点を断らない');
throws(() => V.replay(mut(r => { r.steps[1].targets[0].layerPath[0].side = 'left' })), /前後の手（v1）.*side: invalid value/, 'D side が keep/cut でない layerPath を断らない');
throws(() => V.replay(mut(r => { r.steps[1].id = 's1' })), /重複|duplicate/, 'D id の重複を断らない');
ok('v1 の部分（op・必須項目・未知項目・座標の範囲・layerPath・id）は既存の検証器が断る');

throws(() => V.replay(mut(r => { delete r.steps[2].axes })), /（squash）に axes がありません/, 'D squash の必須項目の欠落を断らない');
throws(() => V.replay(mut(r => { delete r.steps[2].base })), /（squash）に base がありません/, 'D 基準面の欠落を断らない');
throws(() => V.replay(mut(r => { delete r.steps[2].instruction })), /（squash）に instruction がありません/, 'D squash の instruction 欠落を断らない');
throws(() => V.replay(mut(r => { r.steps[2].id = '3' })), /id の綴り/, 'D 原本の決まりに合わない id を断らない');
throws(() => V.replay(mut(r => { r.steps[2].soft = true })), /（squash）に知らない項目/, 'D squash の余分な項目を断らない');
throws(() => V.replay(mut(r => { r.steps[2].base.at = [0, 0] })), /base に知らない項目/, 'D base の余分な項目を断らない');
throws(() => V.replay(mut(r => { r.steps[2].branch.drive.speed = 2 })), /branch.drive に知らない項目/, 'D drive の余分な項目を断らない');
throws(() => V.replay(mut(r => { r.steps[2].axes[0].at = 1 })), /軸に知らない項目/, 'D 軸の余分な項目を断らない');
throws(() => V.replay(mut(r => { r.steps[2].vertex = [2, 0] })), /vertex が原紙の外/, 'D 紙の外の頂点を断らない');
throws(() => V.replay(mut(r => { r.steps[2].axes[0].end = [2, 0] })), /軸が原紙の外/, 'D 紙の外の軸を断らない');
throws(() => V.replay(mut(r => { r.steps[2].model = 'degree4-90' })), /model が/, 'D 別モデルを断らない');
throws(() => V.replay(mut(r => { r.steps[2].stack.push(C(r.steps[2].stack[0])) })), /同じ面の組の領域が2度/, 'D 重複した領域を断らない');
throws(() => V.replay(mut(r => { r.steps[2].stack.push(C(r.steps[2].stack[0]).reverse()) })), /同じ面の組の領域が2度/, 'D 順だけ違う重複領域を断らない');
ok('v2 の担当（squash の必須項目・未知項目・id・座標の範囲・stack の重複）を断る');

/* ================= E 直前の紙が、検証ずみモデルの適用条件に一致するか ================= */
const stepFold = (id, n2, line, ms, ref, targets) => ({ id, diagramStep: String(n2), op: 'fold', kind: 'V',
 reference: { faceId: ref }, line, movingSidePoint: ms, targets, instruction: '（検査用）' });
const T1 = [{ faceId: 'paper', layerPath: [] }];
const T2 = [{ faceId: 'paper/s1.keep', layerPath: [{ stepId: 's1', side: 'keep' }] },
            { faceId: 'paper/s1.cut', layerPath: [{ stepId: 's1', side: 'cut' }] }];
const withV1 = steps => ({ ...C(recipe), steps: [...steps, C(recipe.steps[2])] });
const diag = stepFold('s1', 1, [[-1, 1], [1, -1]], [-0.5, -0.5], 'paper', T1);
const medi = stepFold('s1', 1, [[0, -1], [0, 1]], [0.5, 0], 'paper', T1);
throws(() => V.replay(withV1([medi, stepFold('s2', 2, [[-1, 0], [1, 0]], [-0.5, 0.5], 'paper/s1.keep', T2)])),
 /素材の対角ではありません/, 'E 中線2回（構造は同じ）を受理してしまう');
throws(() => V.replay(withV1([diag])), /4枚のはずです/, 'E 1手だけの紙を受理してしまう');
throws(() => V.replay(withV1([diag, stepFold('s2', 2, [[0, -1], [0, 1]], [-0.3, 0.5], 'paper/s1.keep', T2)])),
 /45°|一致しません|対角ではありません/, 'E 対角＋中線を受理してしまう');
throws(() => V.replay(withV1([medi, stepFold('s2', 2, [[-1, .5], [1, .5]], [-0.5, 0.8], 'paper/s1.keep', T2)])),
 /1つの角として持ちません|4枚のはず/, 'E 頂点を通らない2手目を受理してしまう');
/* 折る順番の違う紙（対角線を入れかえた）＝同じつる②が平面上で回った・鏡に映った置かれ方（対応 G・check_squash_flip.py）。
   ⚠2026-09-14 から紙そのものは受理する。表の順番用に書いた袋折りの手（軸の役割）を当てると、役割の照合で断る。
   その紙に合わせて組んだ手（candidateStep）なら通る。 */
const swapped = [stepFold('s1', 1, [[-1, -1], [1, 1]], [0.5, -0.2], 'paper', T1),
 stepFold('s2', 2, [[-1, 1], [1, -1]], [-0.5, -0.5], 'paper/s1.keep', T2)];
throws(() => V.replay(withV1(swapped)), /役割が合いません/, 'E 折る順番の違う紙に、表の順番用の手（軸の役割）を当てても断らない');
{ const r = { ...C(recipe), version: 1, steps: C(swapped) }, cache = FreeFoldEngine.replay(r);
  const step = V.candidateStep(cache, 's3', '3'), out = V.replay({ ...C(recipe), steps: [...C(swapped), step] });
  assert.equal(out.faces.length, 6, 'E 折る順番の違う紙に合わせて組んだ手が通らない');
  assert.notDeepEqual(step.axes.map(a => a.role), recipe.steps[2].axes.map(a => a.role), 'E 折る順番の違う紙で、軸の役割が表の順番と同じになった') }
ok('モデルと合わない紙（中線2回・1手・混在・頂点ちがい）を理由つきで断る／折る順ちがいの紙は、合う手なら通り、表の順番用の手は役割で断る');

/* ================= F 軸・基準面・枝・stack の改変 ================= */
throws(() => V.replay(mut(r => { const a = r.steps[2].axes; a[1].role = 'drive'; a[2].role = 'link' })), /役割が合いません/, 'F 駆動と従属の取りちがえを断らない');
throws(() => V.replay(mut(r => { const a = r.steps[2].axes; a[0].role = 'folded'; a[5].role = 'flat' })), /役割が合いません/, 'F 平らな軸と折れている軸の取りちがえを断らない');
throws(() => V.replay(mut(r => { r.steps[2].axes[2].end = [0, 0.5] })), /素材のふち/, 'F 軸が紙のふちまで届いていない形を断らない');
throws(() => V.replay(mut(r => { r.steps[2].axes[2].end = [0.3, 1] })), /折り線の上にありません/, 'F 折り線に乗っていない軸を断らない');
throws(() => V.replay(mut(r => { r.steps[2].axes = r.steps[2].axes.slice(0, 7) })), /8本ちょうど/, 'F 軸が7本の形を断らない');
throws(() => V.replay(mut(r => { r.steps[2].axes[2].role = 'link' })), /drive（駆動）が1本ではありません/, 'F 駆動が0本の形を断らない');
throws(() => V.replay(mut(r => { r.steps[2].axes[1] = C(r.steps[2].axes[2]) })), /同じ向きの軸が2本/, 'F 同じ向きの軸が2本ある形を断らない');
throws(() => V.replay(mut(r => { r.steps[2].axes[0].vertex = [0.5, 0] })), /頂点から出ていません/, 'F 頂点から出ていない軸を断らない');
throws(() => V.replay(mut(r => { r.steps[2].axes[0].role = 'squash' })), /軸の役割が/, 'F 知らない役割を断らない');
throws(() => V.replay(mut(r => { r.steps[2].base.faceId = 'paper/s1.cut/s2.keep' })), /基準面が違います/, 'F 別の面を基準にするのを断らない');
throws(() => V.replay(mut(r => { r.steps[2].branch.sign = -1 })), /branch.sign は 1 だけ/, 'F 未検証の枝を断らない');
throws(() => V.replay(mut(r => { r.steps[2].branch.linkage = 'arcsin' })), /branch.linkage が/, 'F arcsin 形を断らない');
throws(() => V.replay(mut(r => { r.steps[2].branch.drive = { fromDeg: 0, toDeg: 90 } })), /0°→180° だけ/, 'F 途中までの駆動を断らない');
throws(() => V.replay(mut(r => { delete r.steps[2].branch })), /に branch がありません/, 'F 枝の欠落を断らない');
throws(() => V.replay(mut(r => { r.steps[2].branch.soft = true })), /branch に知らない項目/, 'F 枝の余分な項目を断らない');
throws(() => V.replay(mut(r => { const s2 = r.steps[2].stack[0]; [s2[0], s2[1]] = [s2[1], s2[0]] })), /stack の上下が再生結果と違います/, 'F stack の上下をひっくり返しても通ってしまう');
throws(() => V.replay(mut(r => { r.steps[2].stack = r.steps[2].stack.slice(1) })), /stack に、重なっている領域が書かれていません/, 'F stack の領域を1つ消しても通ってしまう');
throws(() => V.replay(mut(r => { r.steps[2].stack.push(['paper/s1.keep/s2.keep', 'paper/s1.keep/s2.cut/s3.cut']) })), /重なっていない面の組/, 'F 重ならない面の組を書いても通ってしまう');
throws(() => V.replay(mut(r => { r.steps[2].stack[0] = [r.steps[2].stack[0][0]] })), /下から並べた配列/, 'F 1面だけの領域を断らない');
throws(() => V.replay(mut(r => { r.steps[2].stack[0][1] = r.steps[2].stack[0][0] })), /同じ面が2度/, 'F 同じ面が2度出る領域を断らない');
ok('軸・基準面・運動の枝・stack の改変をすべて断る');

/* ================= G 合成入力の単体検査 ================= */
const d = a => [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)];
const synth = (bounds, bonds, kind = 'hinge') => ({
 faces: bounds.map((_, i) => ({ faceId: 'F' + i, layerPath: [], layer: i, xf: [1, 0, 0, 1, 0, 0],
  poly: [[0, 0], d(bounds[i]), d(bounds[(i + 1) % 4])] })),
 bonds: bonds.map((a, j) => ({ bondId: 'b' + (j + 1), stepId: 's1', faceIds: ['F' + (j % 4), 'F' + ((j + 1) % 4)], kind, seg: [[0, 0], d(a)] })) });
throws(() => V.reconstruct(synth([0, 100, 180, 280], [0, 100, 180, 280]), [0, 0]), /45°ではありません/, 'G1 45°おきでない形を断らない');
throws(() => V.reconstruct(synth([0, 90, 180, 270], [0, 90, 180, 45]), [0, 0]), /1本おきに並んでいません/, 'G2 結びが1本おきでない形を断らない');
throws(() => V.reconstruct(synth([0, 90, 180, 270], [0, 90, 180, 270], 'crease'), [0, 0]), /hinge ではありません/, 'G3 hinge でない結びを断らない');
assert.equal(V.reconstruct(synth([0, 90, 180, 270], [0, 90, 180, 270]), [0, 0]).order.length, 8, 'G4 正しい形を再構成できない');
const P = Math.PI, badRho = [0, P, 0, P, 0, P, 0, P].slice(); badRho[2] = 120 * P / 180;
assert.equal(V.closureGap(badRho) > 1e-9, true, 'G5 狂った折り角の組で閉じ条件が鳴らない');
assert.equal(V.closureGap([0, P, 0, P, 0, P, 0, P]) < 1e-9, true, 'G5 正しい組で閉じ条件が鳴ってしまう');
const inherit = new Map([['Q_E', 0], ['Q_S', 1], ['P4', 2], ['P1', 3], ['P2', 3]]);
assert.deepEqual(V.orderFaces([{ faceId: 'Q_S', z: 1e-16 }, { faceId: 'Q_E', z: 0 }, { faceId: 'P4', z: 1e-16 }],
 new Set(['P1', 'P2']), inherit), ['Q_E', 'Q_S', 'P4'], 'G6 固定面どうしの同着が直前状態の層を継がない');
throws(() => V.orderFaces([{ faceId: 'Q_E', z: 0 }, { faceId: 'P1', z: 1e-15 }, { faceId: 'P2', z: 2e-15 }],
 new Set(['P1', 'P2']), inherit), /動く面が同着/, 'G7 動く面どうしの同着を断らない');
const cache0 = E.replay({ ...recipe, version: 1, steps: recipe.steps.slice(0, 2) });
const canon = r => JSON.stringify({ rays: r.raysDeg, owner: r.owner, bond: [...r.bondAt.keys()].sort((a, b) => a - b) });
const base0 = canon(V.reconstruct(cache0, [0, 0]));
let seed = 20260913; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let k = 0; k < 200; k++) {
 const sh = { faces: cache0.faces.slice(), bonds: cache0.bonds.slice() };
 for (const arr of [sh.faces, sh.bonds]) for (let i = arr.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] }
 assert.equal(canon(V.reconstruct(sh, [0, 0])), base0, 'G8 面と結びの並べかえで再構成が変わる');
}
ok('合成入力で門を直接鳴らす（45°・1本おき・hinge・閉じ条件・同着）／200通り並べかえても同じ再構成');

/* ================= H 互換 cache への変換と、既存の読み取りAPI ================= */
const st = V.toCache(out);
assert.deepEqual(Object.keys(st).sort(), ['cache', 'readOnly', 'recipe', 'revision'], 'H 返す形が engine の state と違う');
assert.deepEqual(Object.keys(st.cache).sort(), ['bonds', 'creases', 'faces', 'hash', 'hinges'], 'H cache の項目が違う');
assert.equal(V.toCache(out).cache.hash, st.cache.hash, 'H 変換が決定論でない');
const outText = JSON.stringify(out); V.toCache(out);
assert.equal(JSON.stringify(out), outText, 'H 変換で再生結果が書きかわった');
for (const f of st.cache.faces) {
 const src = byId.get(f.faceId);
 assert.equal(!!src, true, 'H 変換で知らない面が出た: ' + f.faceId);
 assert.equal(keySet(f.poly), keySet(src.poly), 'H 変換で形が変わった: ' + f.faceId);
 assert.equal(Math.sign(det(f.xf)), Math.sign(det(src.xf)), 'H 変換で表裏が変わった: ' + f.faceId);
 assert.equal(f.layer, src.layer, 'H 変換で層が変わった: ' + f.faceId);
 assert.deepEqual(f.layerPath, src.layerPath, 'H 変換で layerPath が変わった: ' + f.faceId);
 assert.deepEqual(Object.keys(f).sort(), ['faceId', 'layer', 'layerPath', 'poly', 'xf'], 'H 面に余分な項目がある');
}
assert.equal(st.cache.faces.length, out.faces.length, 'H 面の数が変わった');
/* 素材境界＝結びの線は、両側の面の xf で**同じ所へ**写る（紙が切り離されていない）。 */
let gapWorst = 0;
for (const b of st.cache.bonds) {
 const fs2 = b.faceIds.map(id => st.cache.faces.find(f => f.faceId === id));
 assert.equal(fs2.every(Boolean), true, 'H 結びの面が cache にない: ' + b.faceIds);
 const [p, q] = fs2.map(f => b.seg.map(v => V.apply(f.xf, v)));
 for (let i = 0; i < 2; i++) gapWorst = Math.max(gapWorst, Math.hypot(p[i][0] - q[i][0], p[i][1] - q[i][1]));
 assert.deepEqual(Object.keys(b).sort().filter(k => k !== 'openedBy'),
  ['bondId', 'faceIds', 'kind', 'seg', 'stepId'], 'H 結びの項目が engine と違う: ' + b.bondId);
}
assert.equal(gapWorst < 1e-9, true, 'H 素材の共有区間が両側でずれた: ' + gapWorst);
ok('変換の前後で 形・表裏・層・layerPath・素材境界が一致（境界のずれ ' + gapWorst.toExponential(1) + '）');

/* 紙片＝crease だけで閉じる。開いた2本でつながり、折れた4本ではつながらない。 */
const sheetKeys = [...new Set(st.cache.faces.map(f => E.sheetOf(st, f.faceId).map(x => x.faceId).sort().join('+')))].sort();
assert.deepEqual(sheetKeys, [
 'paper/s1.cut/s2.cut/s3.keep',
 'paper/s1.cut/s2.keep',
 'paper/s1.cut/s2.cut/s3.cut+paper/s1.keep/s2.cut/s3.keep',
 'paper/s1.keep/s2.cut/s3.cut+paper/s1.keep/s2.keep'].sort(),
 'H 紙片の分かれかたが違う: ' + sheetKeys.join(' / '));
ok('紙片＝開いた結び(crease)だけで閉じる → {Q_E+P1} {P2+P3} {P4} {Q_S} の4つ');

/* 背＝折れた結びだけ。全部つながっている（consistent）。 */
const hints = E.hingeIntervals(st);
assert.equal(hints.length, 4, 'H 背が4本でない: ' + hints.length);
assert.equal(hints.every(h => h.consistent && h.gap === 0), true, 'H 背の線が両側で一致しない');
assert.deepEqual(hints.map(h => h.intervalId).sort(), ['hinge:s1#1', 'hinge:s2#1', 'hinge:s3#1', 'hinge:s3#2'], 'H 背のIDが違う');
assert.equal(hints.filter(h => h.stepId === 's3').length, 2, 'H この手でできた背が2本でない');
assert.equal(hints.every(h => h.hingeId), true, 'H 背の由来（hingeId）が引けない');
assert.equal(hints.filter(h => h.visible).length >= 1, true, 'H 見えている背が1本も無い');
const cints = E.creaseIntervals(st);
assert.equal(cints.length, 2, 'H 折り目の区間が2本でない: ' + cints.length);
assert.equal(cints.every(c => st.cache.faces.some(f => f.faceId === c.faceId)), true, 'H 折り目の持ち主の面が cache にない');
/* 🚨開いた折り目の持ち主は keep の側（子面の keep/cut と同じ1つの規則）。
   名前ではなく engine の split で独立に見る＝持ち主の面を素材へ戻し、軸（頂点→紙のふち）で割ると
   **まるごと keep 側**に入り、cut 側には面積が残らないこと。 */
const opened = st.cache.creases.filter(c => st.cache.bonds.some(b => b.kind === 'crease' && b.stepId === c.stepId));
assert.equal(opened.length, 2, 'H 開いた折り目の記録が2本でない');
for (const c of opened) {
 const f = st.cache.faces.find(v => v.faceId === c.faceId);
 const src = f.poly.map(p => V.invPt(f.xf, p)), segSrc = c.seg.map(p => V.invPt(f.xf, p));
 const far = Math.hypot(...segSrc[0]) > Math.hypot(...segSrc[1]) ? segSrc[0] : segSrc[1];
 const [k, cut] = E.split(src, [0, 0], far);
 assert.equal(!!k && Math.abs(E.area(k) - E.area(src)) < 1e-9, true, 'H 開いた折り目の持ち主が keep 側でない: ' + c.faceId);
 assert.equal(!cut || E.area(cut) < 1e-9, true, 'H 開いた折り目の持ち主の面が cut 側にはみ出す: ' + c.faceId);
}
const guides = N.guidesOf(st, E.sheetOf(st, 'paper/s1.keep/s2.keep'));
assert.equal(guides.some(v => v.kind === 'crease'), true, 'H 開いた折り目が吸い付き先に出ない');
assert.equal(guides.some(v => v.kind === 'edge'), true, 'H 紙のふちが吸い付き先に出ない');
ok('背は折れた4本だけ（全部つながっている）／開いた2本は折り目として吸い付き先に出る');

/* 外周辺・重なり・上から何枚。 */
const rims = E.rimEdges(st);
assert.equal(rims.length, 6, 'H 外周辺が6本でない: ' + rims.length);
assert.equal(rims.every(e => e.rimId && e.label && e.sheetId), true, 'H 外周辺のIDが引けない');
assert.equal(new Set(rims.map(e => e.faceId)).size, 6, 'H 外周辺を持たない面がある');
/* topFaces は「折線の動く側にある、上から n 枚＋その紙片の仲間」を返す（折る対象を選ぶ道）。
   折線は紙ぜんぶが動く側に入るよう x=-0.9 に置く＝ここで見たいのは「上から1枚」と「紙片の仲間」だけ。
   🚨開いた結び(crease)でつながった面は、上から1枚を選ぶと**いっしょに**選ばれる＝後続の折りに直に効く。 */
const LA = [-0.9, -1], LB = [-0.9, 1];
for (const [p, want, top] of [
 [[0.7, -0.4], ['paper/s1.keep/s2.keep', 'paper/s1.cut/s2.keep'], ['paper/s1.cut/s2.keep']],
 [[0.7, 0.35], ['paper/s1.keep/s2.keep', 'paper/s1.cut/s2.keep', 'paper/s1.cut/s2.cut/s3.keep', 'paper/s1.cut/s2.cut/s3.cut'],
  ['paper/s1.cut/s2.cut/s3.cut', 'paper/s1.keep/s2.cut/s3.keep']],
 [[0.3, 0.7], ['paper/s1.keep/s2.cut/s3.cut', 'paper/s1.keep/s2.cut/s3.keep'],
  ['paper/s1.cut/s2.cut/s3.cut', 'paper/s1.keep/s2.cut/s3.keep']]]) {
 assert.deepEqual(E.stackAt(st, p).map(r => r.faceId).reverse(), want, 'H ' + JSON.stringify(p) + ' の重なりが違う');
 assert.deepEqual(E.layersAt(st, p).duplicated, [], 'H 同じ層の紙が重なっている: ' + JSON.stringify(p));
 assert.deepEqual(E.topFaces(st, p, 1, LA, LB).slice().sort(), top.slice().sort(),
  'H ' + JSON.stringify(p) + ' の「上から1枚＋紙片の仲間」が違う');
}
for (const r of out.regions) {
 const verts = V.intersect(r.faces.map(id => byId.get(id).poly));
 const probe = [verts.reduce((s, v) => s + v[0], 0) / verts.length, verts.reduce((s, v) => s + v[1], 0) / verts.length];
 assert.deepEqual(E.stackAt(st, probe).map(x => x.faceId).reverse(), r.order,
  'H 領域 ' + r.faces.join(',') + ' の上下が stackAt と食い違う');
}
ok('外周辺6本・重なり3領域・上から何枚が、既存APIで正しく引ける');

/* 🚨開いた結びを hinge のままにすると何が壊れるか（後続操作への影響を、その場で見せる）。 */
const wrong = C(st); for (const b of wrong.cache.bonds) b.kind = 'hinge';
assert.equal(E.sheetOf(wrong, 'paper/s1.keep/s2.keep').length, 1,
 'H 開いた結びを hinge にしてもひと続きの紙片のまま（この差が出ないなら kind の意味が無い）');
assert.equal(E.hingeIntervals(wrong).length, 6, 'H 開いた結びを hinge にしても背が増えない');
assert.equal(E.sheetOf(st, 'paper/s1.keep/s2.keep').length, 2, 'H 正しい cache でひと続きになっていない');
ok('開いた結びを hinge のままにすると、ひと続きの紙が別々の紙片に割れ、ありもしない背が2本増える');

/* ================= R 削除前の版（2026-09-13・会話記録から再現）にあって、書き直しで抜けていた検査を戻す =================
   ⚠規則が変わったもの（子面 left/right→keep/cut、結びが全部 hinge→開いた2本は crease、v1 部分の文言が既存の検証器のことばになった）は、
     上の A2・D・H で新しい規則として見ている。ここに戻すのは**規則が同じまま抜けていたもの**だけ。 */
assert.equal(out.branch.linkage, 'tan-half-product-sqrt2', 'R 連動式が違う（arcsin 形は使わない）');
assert.equal(out.branch.sign, 1, 'R 枝の符号が違う');
assert.deepEqual(out.branch.driveDeg, [0, 180], 'R 駆動の振れ幅が違う');
assert.equal(out.closure < 1e-9, true, 'R 頂点が閉じていない: ' + out.closure);
assert.deepEqual(out.faces.map(f => f.sectors.length).slice().sort(), [1, 1, 1, 1, 2, 2], 'R 割れかたが変わった');
/* 継承した結びは engine の seg を向きごと持ち越す（A2）＝頂点はどちらかの端。 */
assert.equal(out.bonds.every(b => b.seg.filter(p => Math.hypot(p[0], p[1]) < 1e-9).length === 1), true, 'R 結びが頂点から出ていない');
assert.deepEqual(out.bonds.filter(b => b.origin === 'split').map(b => b.seg.find(p => Math.hypot(p[0], p[1]) > 1e-9)).slice()
 .sort((p, q) => p[0] - q[0] || p[1] - q[1]), [[-1, 0], [0, 1]], 'R 割った軸が drive/link の2本でない');
assert.equal(new Set(out.sectorFace).size, 6, 'R 8区間が6面に割りつけられていない');
throws(() => V.frames(out, '1'), /t は 0〜1/, 'R 数でない t を断らない');
{ const o2 = V.replay(recipe); o2.faces[0].layer = 999;
  assert.equal(V.replay(recipe).faces.find(f => f.faceId === o2.faces[0].faceId).layer !== 999, true, 'R 返した結果を書きかえると次の再生に混ざる') }
throws(() => V.replay('x'), /オブジェクトではありません/, 'R 原本でないものを断らない');
throws(() => V.replay(mut(r => { r.steps = [] })), /squash の手がありません/, 'R 空の steps を袋折りの結果として返してしまう');
throws(() => V.replay(mut(r => { delete r.steps[2].stack })), /（squash）に stack がありません/, 'R stack の欠落を断らない');
throws(() => V.replay(mut(r => { r.steps[2].vertex = [0.1, 0] })), /頂点は原紙のまん中|1つの角として持ちません|軸が頂点から出ていません/, 'R 別の頂点を断らない');
throws(() => V.replay(mut(r => { r.steps[0].line = [[0, 0]] })), /前後の手（v1）.*line: invalid array length/, 'R 1点の line を断らない');
throws(() => V.replay(mut(r => { r.steps[0].kind = 'X' })), /前後の手（v1）.*kind: invalid value/, 'R 知らない山谷を断らない');
ok('削除前の版にあった検査（枝の値・閉路・割れかた・割った軸・割りつけ・t の型・結果の独立・原本の形・stack 欠落・別の頂点・line・山谷）');

console.log('');
console.log('― この検査が言っていないこと ―');
console.log('  ⛔ 紙どうしの貫通は見ていない。閉路が閉じることだけで「物理的に折れる」とは言わない');
console.log('  ⛔ 厚みは0。層は「どちらが上か」だけ');
console.log('  ⛔ 確定・undo/redo・保存は test_squash_engine.js の担当。袋折りのあとの追加の折りは未対応');
console.log('  ⛔ 受理したのは degree4-45 の、つる③の形1件だけ');
console.log('');
console.log('ALL OK（' + n + '項目）');
