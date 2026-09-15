'use strict';
/* 袋折り（つる③）を「ふつうの fold 2手」で原本に書けるか、を JS の再生器で確かめる検査。
   ★結論は「書けない」。この検査はその**現状を固定する**ためのもの（通れば現状のまま、
     通らなくなったら＝どこかが変わった、という合図）。

   ⛔ engine・スキーマ・既存アプリは1文字も変えない。ここは原本(JSON)を外から組むだけ。
   相棒＝ check_squash_linkage.py（連動式）／check_squash_recipe.py（Python の再生器）

   使い方：  node test_squash_recipe.js
   （--write を付けると squash_probe_2te.json を書き直す）
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const assert = require('node:assert/strict');
const HERE = __dirname;
vm.runInThisContext(fs.readFileSync(path.join(HERE, 'freefold_engine.js'), 'utf8'),
                    { filename: 'freefold_engine.js' });
const E = FreeFoldEngine;
const FIXTURE = path.join(HERE, 'squash_probe_2te.json');

/* engine と同じ行優先の規約（engine は apply/inv を公開していないので、ここで同じものを書く） */
const inv = (m, p) => { const d = m[0]*m[3]-m[1]*m[2], x = p[0]-m[4], y = p[1]-m[5];
 return [(m[3]*x-m[1]*y)/d, (-m[2]*x+m[0]*y)/d] };
const R6 = v => Math.round(v * 1e6) / 1e6;
const C = x => JSON.parse(JSON.stringify(x));

let ok_all = true;
function check(name, ok, extra) {
 ok_all = ok_all && !!ok;
 console.log((ok ? 'OK  ' : 'NG  ') + name + (extra ? ' … ' + extra : ''));
}
const layersOf = c => c.faces.slice().sort((a, b) => a.layer - b.layer)
 .map(f => 'L' + f.layer + ' ' + f.faceId).join(' / ');

/* ================= 原本を組む ================= */
const recipe = {
 format: 'origami-recipe', version: 1, coordinates: 'unfolded-normalized-xy',
 work: { id: 'squash_probe_2te', name: '袋折りの下調べ（2手）', emoji: '🧺', difficulty: 1 },
 source: { note: 'つる③ ふくろをひらいてつぶす を、既存の fold 2手で書けるかの下調べ。s4 は JS の再生器に断られる。' },
 paper: { aspectRatio: 1, colorDown: false }, steps: [],
};
const at = id => E.replay(recipe).faces.find(f => f.faceId === id);
const tgt = ids => ids.map(id => { const f = at(id); return { faceId: id, layerPath: C(f.layerPath) } });

/* ① 対角線 NW–SE で半分に折る（SW側を折り返す） */
recipe.steps.push({ id: 's1', diagramStep: '1', op: 'fold', kind: 'V',
 reference: { faceId: 'paper' }, line: [[-1, 1], [1, -1]], movingSidePoint: [-0.5, -0.5],
 targets: [{ faceId: 'paper', layerPath: [] }], instruction: 'はんぶんに おる' });
/* ② 対角線 NE–SW でもう半分（N側を折り返す）＝2枚とも動く → 状態②＝4枚重ね */
recipe.steps.push({ id: 's2', diagramStep: '2', op: 'fold', kind: 'V',
 reference: { faceId: 'paper/s1.keep' }, line: [[-1, -1], [1, 1]], movingSidePoint: [-0.2, 0.5],
 targets: tgt(['paper/s1.keep', 'paper/s1.cut']), instruction: 'もう一度 はんぶんに おる' });

const QN = 'paper/s1.keep/s2.cut';   /* 素材 O,NE,NW ＝ 45°の面 P1+P2（層3＝いちばん上） */
const QW = 'paper/s1.cut/s2.cut';    /* 素材 O,NW,W  ＝ 面 P3+P4（層2） */
const c2 = E.replay(recipe);
check('② のあと＝4枚重ね・面4枚', c2.faces.length === 4, layersOf(c2));
check('② の4枚がぜんぶ三角形 O-NE-SE にいる',
 c2.faces.every(f => JSON.stringify(f.poly.map(p => p.map(R6)).slice().sort())
   === JSON.stringify([[0, 0], [1, -1], [1, 1]])));

/* ③-1（s3）：いまの O–E（＝素材の光線R2＝公理3の二等分線）で、SE側の上2枚を返す */
const qn = at(QN);
const s3line = [inv(qn.xf, [0, 0]).map(R6), inv(qn.xf, [1, 0]).map(R6)];
const s3ms = inv(qn.xf, [0.5, -0.3]).map(R6);
recipe.steps.push({ id: 's3', diagramStep: '3', op: 'fold', kind: 'V',
 reference: { faceId: QN }, line: s3line, movingSidePoint: s3ms, targets: tgt([QN, QW]),
 instruction: 'ふくろを ひらいて つぶす（1）' });
check('s3 の折線は素材の O→N（＝光線R2）', JSON.stringify(s3line) === JSON.stringify([[0, 0], [0, 1]]),
 JSON.stringify(s3line));
let c3 = null;
try { c3 = E.replay(recipe) } catch (e) { /* 下で NG になる */ }
check('s3 は通る（面6枚）', !!c3 && c3.faces.length === 6, c3 ? layersOf(c3) : 'replay が断った');
check('s3 のあと 層は Q_E(0)/Q_S(1)/P4(2)/P1(3)/P2(4)/P3(5)', !!c3 && layersOf(c3) ===
 'L0 paper/s1.keep/s2.keep / L1 paper/s1.cut/s2.keep / L2 paper/s1.cut/s2.cut/s3.keep'
 + ' / L3 paper/s1.keep/s2.cut/s3.keep / L4 paper/s1.keep/s2.cut/s3.cut'
 + ' / L5 paper/s1.cut/s2.cut/s3.cut');
check('s3 のあと 結びは6本ぜんぶ hinge', !!c3 && c3.bonds.length === 6
 && c3.bonds.every(b => b.kind === 'hinge'));
/* 🚨 s3 で下にいた P3 が上に乗る（restack の正しい挙動）。ここが s4 を塞ぐ。 */
check('s3 で P3 が P1・P2 の上に乗る（＝次の手を塞ぐ原因）', !!c3 &&
 c3.faces.find(f => f.faceId === 'paper/s1.cut/s2.cut/s3.cut').layer >
 c3.faces.find(f => f.faceId === 'paper/s1.keep/s2.cut/s3.cut').layer);
/* s3 は kind=M では通らない（下に敷かれている紙がある） */
{ const t = C(recipe); t.steps[2] = { ...t.steps[2], kind: 'M' };
  let msg = null; try { E.replay(t) } catch (e) { msg = e.message }
  check('s3 は kind=M では断られる', /下に敷かれている紙があります/.test(msg || ''), msg || '通ってしまった'); }

/* ③-2（s4）：いまの O–NE（＝素材の光線R1）で、開いた2枚 P1・P2 を軸へ倒す */
const P1 = 'paper/s1.keep/s2.cut/s3.keep', P2 = 'paper/s1.keep/s2.cut/s3.cut';
const p1 = at(P1);
const s4line = [inv(p1.xf, [0, 0]).map(R6), inv(p1.xf, [1, 1]).map(R6)];
const s4ms = inv(p1.xf, [0.8, 0.2]).map(R6);
recipe.steps.push({ id: 's4', diagramStep: '4', op: 'fold', kind: 'V',
 reference: { faceId: P1 }, line: s4line, movingSidePoint: s4ms, targets: tgt([P1, P2]),
 instruction: 'ふくろを ひらいて つぶす（2）' });
check('s4 の折線は素材の O→NE（＝光線R1）', JSON.stringify(s4line) === JSON.stringify([[0, 0], [1, 1]]),
 JSON.stringify(s4line));

/* ★ここが結論。V でも M でも断られる＝この2手では原本に書けない。 */
for (const [kind, re] of [['V', /上に乗っている紙があります/], ['M', /下に敷かれている紙があります/]]) {
 const t = C(recipe); t.steps[3] = { ...t.steps[3], kind };
 let msg = null; try { E.replay(t) } catch (e) { msg = e.message }
 check('s4 kind=' + kind + ' は JS の再生器に断られる', re.test(msg || ''), msg || '★通ってしまった');
}
/* 並べかたは1通りしかない：P2 の正味の写像は +90°回転＝(y=0)→(y=x) の順に限られる。
   逆順にすると P2 の行き先が (O,S,SW) になり、折り図の (O,N,NE) と一致しない。 */
{
 const rot90 = p => [-p[1], p[0]], ry0 = p => [p[0], -p[1]], ryx = p => [p[1], p[0]];
 const src = [[0, 0], [1, 0], [1, -1]];                       /* ②での P2 ＝ O,E,SE */
 const want = JSON.stringify(src.map(rot90).map(v => v.map(R6)).sort());
 check('P2 の正味の写像は +90°回転（＝y=0 のあとに y=x の順しかない）',
  JSON.stringify(src.map(ry0).map(ryx).map(v => v.map(R6)).sort()) === want
  && JSON.stringify(src.map(ryx).map(ry0).map(v => v.map(R6)).sort()) !== want);
}

/* ================= fixture（Python 側と同じ原本を読ませる） ================= */
const text = JSON.stringify(recipe, null, 1) + '\n';
if (process.argv.includes('--write')) { fs.writeFileSync(FIXTURE, text); console.log('書き出した: ' + FIXTURE) }
else {
 const have = fs.existsSync(FIXTURE) ? fs.readFileSync(FIXTURE, 'utf8') : null;
 check('squash_probe_2te.json が、この検査が組んだ原本と同じ', have === text,
  have === null ? 'ファイルが無い（node test_squash_recipe.js --write）' : '中身がずれている');
}

/* ================= モデル再構成の検査に渡す「折り上がりの状態」を書き出す =================
   check_squash_layers.py が読む。faces（現在の形・xf・層）と bonds（素材座標の結び）だけ。
   ★素材座標は**すべての面で共通の原紙座標**。face を名乗るのは、その点を現在位置へ写す xf と
     対象の面を決めるため（面ごとのローカル座標ではない）。 */
const STATES = path.join(HERE, 'squash_states.json');
const baseOf = steps => ({ ...C(recipe), steps });
const stepFold = (id, n, line, ms, ref, targets) => ({ id, diagramStep: String(n), op: 'fold', kind: 'V',
 reference: { faceId: ref }, line, movingSidePoint: ms, targets, instruction: '（検査用）' });
const T1 = [{ faceId: 'paper', layerPath: [] }];
const T2 = [{ faceId: 'paper/s1.keep', layerPath: [{ stepId: 's1', side: 'keep' }] },
            { faceId: 'paper/s1.cut', layerPath: [{ stepId: 's1', side: 'cut' }] }];
const diag = stepFold('s1', 1, [[-1, 1], [1, -1]], [-0.5, -0.5], 'paper', T1);
const medi = stepFold('s1', 1, [[0, -1], [0, 1]], [0.5, 0], 'paper', T1);
const cases = {
 /* ★受理されるはずの形 */
 diagonals: [diag, stepFold('s2', 2, [[-1, -1], [1, 1]], [-0.2, 0.5], 'paper/s1.keep', T2)],
 medians:   [medi, stepFold('s2', 2, [[-1, 0], [1, 0]], [-0.5, 0.5], 'paper/s1.keep', T2)],
 /* ★拒否されるはずの形 */
 oneFold:   [diag],
 mixed:     [diag, stepFold('s2', 2, [[0, -1], [0, 1]], [-0.3, 0.5], 'paper/s1.keep', T2)],
 offVertex: [medi, stepFold('s2', 2, [[-1, .5], [1, .5]], [-0.5, 0.8], 'paper/s1.keep', T2)],
};
const dump = {};
for (const [name, steps] of Object.entries(cases)) {
 const c = E.replay(baseOf(steps));
 dump[name] = { faces: c.faces.map(f => ({ faceId: f.faceId, layerPath: f.layerPath, poly: f.poly, xf: f.xf, layer: f.layer })),
                bonds: c.bonds.map(b => ({ faceIds: b.faceIds, kind: b.kind, seg: b.seg })) };
}
check('モデル再構成に渡す5つの状態が作れる', Object.keys(dump).length === 5, Object.keys(dump).join(' '));
const stext = JSON.stringify(dump, null, 1) + '\n';
if (process.argv.includes('--write')) { fs.writeFileSync(STATES, stext); console.log('書き出した: ' + STATES) }
else check('squash_states.json が、この検査が作った状態と同じ',
 fs.existsSync(STATES) && fs.readFileSync(STATES, 'utf8') === stext,
 fs.existsSync(STATES) ? '中身がずれている' : 'ファイルが無い（--write）');

console.log('');
console.log('― この検査が言っていないこと ―');
console.log('  ⛔ 3手以上の分解や、別の分解が通るかは**未検証**。「2手では書けない」までしか言わない');
console.log('  ⛔ 紙どうしの貫通は見ていない');
console.log('');
console.log(ok_all ? 'ALL OK' : '★NGあり');
process.exit(ok_all ? 0 : 1);
