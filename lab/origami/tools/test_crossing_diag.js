'use strict';
/* 🧷 「袋折り直後、左上の2枚を対角で右へ折る」実例の再現と、すり抜けの判定方式の検証（2026-09-14）。
   ★結論（この検査が固定すること）
     - この折りは**すり抜けていない**（前回の報告の「固定された紙をすり抜ける」は誤り）。谷折り・山折りとも、
       途中（0<θ<180°）の交わりは軸の線の上だけで、軸の断面の並び（一周の順）は交差せず、前後の平らな状態も成立する。
     - 1本の軸で回す「ふつうの折り」は、engine の既存の判定（① 上に乗っている紙／下に敷かれている紙＝面積の重なり）と
       積み直しで足りる。始まりの平らな状態が成立していれば、途中の並びの交差は起きない。
     - 足りないのは「始まりの状態が成立していること」を、ふつうの折りでない手（袋折り＝複数の軸）のあとに確かめる所。
   ★見ること
     R 再現：原本（crossing_case_diag.json）を engine の操作で作り直して同じ／動く面・固定面
     V 判定：前後の平らな状態・途中（sweep）・一周の順（診断）・軸上の接触の分類・コマの数値（補助）
     N 見抜く：層を入れかえた状態／ポケットの中の紙を引き抜く合成例（両端は成立でも途中で通り抜ける）／
       engine が①で断る実例（①を外した写しで確定すると、結果の並びが交差する）
     E 総当り：ふつうの折りの候補で engine の①と判定器が一致・engine が通した結果はすべて成立・途中だけの交差は0
     P 計算量：面の数・判定回数・時間（PC。携帯は未測定）
   ⛔言わないこと：厚みのある紙（回り込む余裕・折り目のずれ）／複数の軸を同時に動かす運動（袋折りの途中）の非貫通
   使い方： node test_crossing_diag.js [--write]
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
/* engine の写し（noBlock＝① を外した実験用。本体は触らない）。 */
function mk(noBlock) {
 const ctx = vm.createContext({ console, performance }); let e = rd('freefold_engine.js');
 if (noBlock) { const old = ' if(block.length)return{ok:false,blocking:[...new Set(block)],';
  assert.equal(e.split(old).length, 2, '① を外す写しが作れない（engine の①の形が変わった）');
  e = e.replace(old, ' if(false&&block.length)return{ok:false,blocking:[...new Set(block)],') }
 vm.runInContext(e, ctx);
 for (const f of ['freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'fold_crossing.js']) vm.runInContext(rd(f), ctx);
 vm.runInContext('SquashV2.useV1Validator(OrigamiRecipe.validate,' + rd('origami_recipe.schema.json') + ')', ctx);
 return vm.runInContext('({E:FreeFoldEngine,X:FoldCrossing,N:FreeFoldSnap})', ctx);
}
const { E, X, N: SNAP } = mk(false), NB = mk(true);
const C = x => JSON.parse(JSON.stringify(x));
const S = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const J = JSON.parse(rd('squash_tsuru3_v2.json'));
const load = (EE, r) => { const st = EE.create(); st.recipe = C(r); st.cache = EE.replay(st.recipe); st.cacheRevision = st.revision; st.committed = st.cache; return st };
const P2 = 'paper/s1.keep/s2.cut/s3.keep', UL0 = 'paper/s1.keep/s2.cut/s3.cut', P3 = 'paper/s1.cut/s2.cut/s3.cut', P4 = 'paper/s1.cut/s2.cut/s3.keep';
const Q_S = 'paper/s1.cut/s2.keep', Q_E = 'paper/s1.keep/s2.keep';
const short = s => s.replace(/paper\//g, '');
const MOVE = { a: [0, 0], b: [1, 1], side: [.2, .8], layers: 2 };
/* engine の操作で作る（画面と同じ道：proposeOnFace → setSide → setLayers → select → confirm） */
function make(EE, kind) {
 const st = load(EE, J);
 EE.proposeOnFace(st, MOVE.a, MOVE.b, P2, { layers: 1 }); st.pending.kind = kind; EE.setSide(st, MOVE.side); EE.setLayers(st, MOVE.layers, MOVE.side);
 const ids = st.pending.candidates.map(c => c.faceId).sort();
 let A = MOVE.a, B = MOVE.b; if (S(MOVE.side, A, B) > 0) [A, B] = [B, A];
 EE.select(st, st.pending.candidates); EE.confirm(st);
 return { st, ids, A, B };
}
const base = load(E, J);
const V = make(E, 'V'), M = make(E, 'M');
const out = { states: [] };
const keep = (name, cache, note) => out.states.push({ name, note, faces: C(cache.faces), bonds: C(cache.bonds), js: X.flatState(cache).ok });

/* ================= R 再現：原本・動く面・固定面 ================= */
{
 const fixedIds = base.cache.faces.map(f => f.faceId).filter(id => !V.ids.includes(id)).sort();
 const caseJson = { note: 'test_crossing_diag.js --write が書く。袋折り直後、左上の2枚（UL0・P2）を対角 (0,0)-(1,1) で右へ折る。V＝谷折り、M＝山折り。',
  recipeV: C(V.st.recipe), recipeM: C(M.st.recipe), move: C(MOVE), moving: V.ids, fixed: fixedIds,
  layersBefore: Object.fromEntries(base.cache.faces.map(f => [short(f.faceId), f.layer])),
  layersAfterV: Object.fromEntries(V.st.cache.faces.map(f => [short(f.faceId), f.layer])),
  layersAfterM: Object.fromEntries(M.st.cache.faces.map(f => [short(f.faceId), f.layer])) };
 const file = path.join(DIR, 'crossing_case_diag.json');
 if (process.argv.includes('--write')) fs.writeFileSync(file, JSON.stringify(caseJson, null, 1));
 const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
 assert.equal(JSON.stringify(saved.recipeV), JSON.stringify(caseJson.recipeV), 'R 保存した原本（谷）と、engine の操作で作り直したものが違う');
 assert.equal(JSON.stringify(saved.recipeM), JSON.stringify(caseJson.recipeM), 'R 保存した原本（山）と作り直したものが違う');
 assert.deepEqual(saved.moving, [P2, UL0].sort(), 'R 動く面が UL0・P2 でない');
 assert.deepEqual(saved.fixed, [P3, P4, Q_E, Q_S].sort(), 'R 固定面が Q_E・Q_S・P4・P3 でない');
 assert.equal(E.replay(saved.recipeV).hash, V.st.cache.hash, 'R 保存した原本を再生すると違う');
 assert.equal(E.replay(saved.recipeM).hash, M.st.cache.hash);
 assert.deepEqual(saved.layersBefore, { 's1.keep/s2.keep': 0, 's1.keep/s2.cut/s3.cut': 0, 's1.keep/s2.cut/s3.keep': 1, 's1.cut/s2.keep': 1, 's1.cut/s2.cut/s3.cut': 3, 's1.cut/s2.cut/s3.keep': 2 }, 'R 袋折り直後の層が違う');
 assert.equal(saved.layersAfterV['s1.keep/s2.cut/s3.cut'], 5); assert.equal(saved.layersAfterV['s1.keep/s2.cut/s3.keep'], 4);
 assert.equal(saved.layersAfterM['s1.keep/s2.cut/s3.cut'], -1); assert.equal(saved.layersAfterM['s1.keep/s2.cut/s3.keep'], -2);
 keep('before', base.cache, '袋折り直後'); keep('afterV', V.st.cache, '谷折り'); keep('afterM', M.st.cache, '山折り');
}
ok('R 原本（谷・山）を engine の操作で作り直して同じ／動く面 UL0・P2、固定面 Q_E・Q_S・P4・P3');

/* ================= V 判定：この折りはすり抜けていない ================= */
const DIAG = '0.7071068,0.7071068,0';
for (const [kind, R] of [['V', V], ['M', M]]) {
 const before = X.flatState(base.cache), after = X.flatState(R.st.cache);
 assert.equal(before.ok, true, kind + ' 袋折り直後の平らな状態が成立しない: ' + JSON.stringify(before.violations));
 assert.equal(after.ok, true, kind + ' 折ったあとの平らな状態が成立しない: ' + JSON.stringify(after.violations));
 const m = X.simpleFold(base.cache, { a: R.A, b: R.B, side: MOVE.side, kind, moving: R.ids }, { contacts: true });
 assert.equal(m.ok, true, kind + ' 途中で通り抜けると判定した: ' + JSON.stringify(m.violations));
 assert.equal(m.ringCrossings, 0, kind + ' 途中の一周の順が交差する');
 /* 一周の順（診断）：動く2枚がかたまりのまま、谷なら上半分・山なら下半分へ移る */
 const ring = m.ring.map(r => r.ring.map(short).join(' '));
 assert.equal(new Set(ring).size, 1, kind + ' 軸の上で一周の順が場所によって変わる');
 const want = kind === 'V'
  ? 's1.keep/s2.cut/s3.cut:mv0 s1.keep/s2.cut/s3.keep:mv1 s1.cut/s2.cut/s3.cut:st3 s1.cut/s2.cut/s3.keep:st2 s1.cut/s2.keep:st1 s1.keep/s2.keep:st0'
  : 's1.cut/s2.cut/s3.cut:st3 s1.cut/s2.cut/s3.keep:st2 s1.cut/s2.keep:st1 s1.keep/s2.keep:st0 s1.keep/s2.cut/s3.cut:mv0 s1.keep/s2.cut/s3.keep:mv1';
 assert.equal(ring[0], want, kind + ' 一周の順が違う');
 /* 前後の対角の断面：UL0–Q_E の弦が、Q_S–P4 と P3–P2 を包む入れ子 */
 const bRing = before.report.find(r => r.line === DIAG), aRing = after.report.find(r => r.line === DIAG);
 assert.equal(bRing.ring.map(short).join(' '), 's1.keep/s2.cut/s3.cut:R0 s1.keep/s2.cut/s3.keep:R1 s1.cut/s2.cut/s3.cut:L3 s1.cut/s2.cut/s3.keep:L2 s1.cut/s2.keep:L1 s1.keep/s2.keep:L0', kind + ' 折る前の対角の断面が違う');
 assert.equal(aRing.crossings.length, 0);
 /* 軸上の接触の分類：共有する結びは2本だけ、ほかは辺どうしの接触。固定面の中の線に触れる所は無い */
 const byType = {}; for (const c of m.contacts) (byType[c.type] = byType[c.type] || []).push(short(c.moving) + '|' + short(c.fixed));
 assert.deepEqual(Object.keys(byType).sort(), ['結び b1（crease）で軸を共有', '結び b2（crease）で軸を共有', '辺どうしの接触'].sort(), kind + ' 接触の種類が違う: ' + JSON.stringify(byType));
 assert.deepEqual(byType['結び b2（crease）で軸を共有'], ['s1.keep/s2.cut/s3.cut|s1.keep/s2.keep']);
 assert.deepEqual(byType['結び b1（crease）で軸を共有'], ['s1.keep/s2.cut/s3.keep|s1.cut/s2.cut/s3.cut']);
 assert.equal(byType['辺どうしの接触'].length, 6);
 /* 補助（保証ではない）：1°ごとのコマで、軸から離れた交わりは無い */
 assert.equal(X.sweepFrames(base.cache, { a: R.A, b: R.B, side: MOVE.side, kind, moving: R.ids }, 179).hits.length, 0, kind + ' コマの数値で軸から離れた交わりが出た');
 if (kind === 'V') console.log('    接触（軸の上だけ）：' + Object.entries(byType).map(([k, v]) => `${k}＝${v.length}組`).join('／'));
}
ok('V 谷・山とも：前後の平らな状態は成立／途中は軸の上の接触だけ（共有する結び2・辺どうし6）／一周の順は交差しない');

/* ================= N 本当の交差を見抜くか ================= */
{
 /* N1 層を入れかえた状態（谷折りのあとで UL0 と P2 の上下を逆に）＝対角の断面で弦が交差 */
 const sw = C(V.st.cache); sw.faces.find(f => f.faceId === UL0).layer = 4; sw.faces.find(f => f.faceId === P2).layer = 5;
 const r1 = X.flatState(sw);
 assert.equal(r1.ok, false, 'N1 上下を入れかえた状態を見抜かない');
 assert.ok(r1.violations.some(v => v.kind === 'crossing' && v.line === DIAG), 'N1 対角の断面の交差として出ない: ' + JSON.stringify(r1.violations));
 keep('swapped', sw, '谷折りのあと UL0 と P2 の上下を入れかえた（不成立）');
 /* N2 合成：紙 T（層0）と S（層2）が x=0.5 の背でポケットになり、その中に M（層1）が入っている。M の上半分を y=0 で谷折り。
    S は軸 y=0 に触れない＝軸の断面にも、折ったあとの平らな状態にも交差は出ない。途中で M が S を通り抜けることは、面積の重なり（sweep）だけが見る。 */
 const I = [1, 0, 0, 1, 0, 0], sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
 const pocket = { faces: [{ faceId: 'T', poly: sq(-1, -1, .5, 1), xf: I, layer: 0 }, { faceId: 'M', poly: sq(-1, -1, .5, 1), xf: I, layer: 1 }, { faceId: 'S', poly: sq(-1, .2, .5, 1), xf: I, layer: 2 }],
  bonds: [{ bondId: 'b1', faceIds: ['S', 'T'], kind: 'hinge', seg: [[.5, .2], [.5, 1]] }] };
 assert.equal(X.flatState(pocket).ok, true, 'N2 ポケットの始まりが成立しない（合成の作り方の誤り）');
 let A = [-1, 0], B = [.5, 0]; if (S([0, .5], A, B) > 0) [A, B] = [B, A];
 const mp = X.simpleFold(pocket, { a: A, b: B, side: [0, .5], kind: 'V', moving: ['M'] });
 assert.equal(mp.ok, false, 'N2 ポケットの中の紙を引き抜く折りを見抜かない');
 assert.equal(JSON.stringify(mp.sweep), '[["M","S"]]', 'N2 通り抜ける相手が S でない');/* 判定器は別の vm で動く＝配列の比較は文字で */
 assert.equal(mp.ringCrossings, 0, 'N2 軸の断面にも交差が出てしまう（合成の意図と違う）');
 const eng = E.foldableSet(pocket.faces, pocket.bonds, ['M'], A, B, 'V');
 assert.equal(eng.ok, false); assert.match(eng.reason, /上に乗っている紙/, 'N2 engine の①が同じ所で断らない');
 const pocketAfter = { faces: [pocket.faces[0], pocket.faces[2], { faceId: 'M/k', poly: sq(-1, -1, .5, 0), xf: I, layer: 1 }, { faceId: 'M/c', poly: sq(-1, -1, .5, 0), xf: [1, 0, 0, -1, 0, 0], layer: 2 }],
  bonds: [pocket.bonds[0], { bondId: 'b2', faceIds: ['M/k', 'M/c'], kind: 'hinge', seg: [[-1, 0], [.5, 0]] }] };
 assert.equal(X.flatState(pocketAfter).ok, true, 'N2 折ったあとの平らな状態が不成立になった＝「両端だけでは見抜けない」例になっていない');
 keep('pocketBefore', pocket, '合成：ポケットの中の紙'); keep('pocketAfter', pocketAfter, '合成：引き抜いたあと（両端は成立）');
 /* N3 実例：袋折り直後、正方形の上の1枚の角を山折り＝engine は①「下に敷かれている紙」で断る。①を外した写しで確定すると、結果の並びが交差する */
 const at = [.95, .85]; let a3 = [.5, 1], b3 = [1, .5]; if (S(at, a3, b3) > 0) [a3, b3] = [b3, a3];
 const ids = E.topFaces(base, at, 1, a3, b3);
 const r3 = E.foldableSet(base.cache.faces, base.cache.bonds, ids, a3, b3, 'M');
 assert.equal(r3.ok, false); assert.match(r3.reason, /下に敷かれている紙/);
 const m3 = X.simpleFold(base.cache, { a: a3, b: b3, side: at, kind: 'M', moving: ids });
 assert.equal(m3.ok, false, 'N3 判定器が通り抜けを見ない');
 const nb = load(NB.E, J); NB.E.proposeOnFace(nb, [.5, 1], [1, .5], P3, { layers: 1 }); nb.pending.kind = 'M'; NB.E.setSide(nb, at);
 nb.pending.candidates = ids.map(id => ({ faceId: id, layerPath: nb.cache.faces.find(f => f.faceId === id).layerPath })); NB.E.select(nb, nb.pending.candidates); NB.E.confirm(nb);
 const f3 = X.flatState(nb.cache);
 assert.equal(f3.ok, false, 'N3 ①を外して確定した結果の並びを成立と判定した');
 assert.ok(f3.violations.some(v => v.kind === 'crossing'), 'N3 交差として出ない');
 keep('noBlockM', nb.cache, '①を外した写しで、正方形の上の角を山折り（不成立）');
 /* N4 合成：結びの無い所で、面積をもって重なる2枚が同じ層（断面に出ない不成立＝見張りを自然な例で鳴らせないので合成で） */
 const same = { faces: [{ faceId: 'A', poly: sq(-1, -1, 1, 1), xf: I, layer: 0 }, { faceId: 'B', poly: sq(-.5, -.5, .5, .5), xf: I, layer: 0 }], bonds: [] };
 const r4 = X.flatState(same);
 assert.equal(r4.ok, false, 'N4 同じ層で重なる2枚を見抜かない');
 assert.equal(r4.violations[0].kind, 'same-layer-overlap');
}
ok('N 見抜く：上下の入れかえ（対角の交差）／同じ層で重なる2枚／ポケットの中の紙の引き抜き（両端は成立・途中の面積の重なりだけが見る＝engine の①と同じ）／①で断る実例の結果（交差）');

/* ================= E 総当り：ふつうの折りでは既存の判定で足りるか ================= */
{
 const cases = JSON.parse(rd('squash_after_states.json')).cases;
 const bases = [['袋折り直後', J], ...cases.filter(c => /^(A |F2|K2)/.test(c.name)).map(c => [c.name.split(' ')[0], c.recipe])];
 const pts = []; for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) pts.push([i / 4, j / 4]);
 const tally = { cand: 0, pass: 0, block: 0, tear: 0, disagree: 0, ringOnly: 0, afterChecked: 0, afterBad: 0, noBlockChecked: 0, noBlockBad: 0, noBlockValidEnd: 0 };
 for (const [name, rec] of bases) {
  const st0 = load(E, rec);
  assert.equal(X.flatState(st0.cache).ok, true, 'E 始まりの状態が成立しない: ' + name);
  for (let i = 0; i < pts.length; i += 3) for (let k = i + 4; k < pts.length; k += 6) {
   const a = pts[i], b = pts[k]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < .4) continue;
   const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(d[0], d[1]), nrm = [-d[1] / L, d[0] / L];
   for (const sg of [1, -1]) {
    const at = [mid[0] + nrm[0] * .2 * sg, mid[1] + nrm[1] * .2 * sg], la = E.layersAt(st0, at);
    if (!la.layers.length || la.duplicated.length) continue;
    let A = a, B = b; if (S(at, A, B) > 0) [A, B] = [B, A];
    for (const kind of ['V', 'M']) for (let nn = 1; nn <= la.layers.length; nn++) {
     let ids; try { ids = E.topFaces(st0, at, nn, A, B) } catch { continue }
     tally.cand++;
     const r = E.foldableSet(st0.cache.faces, st0.cache.bonds, ids, A, B, kind), m = X.simpleFold(st0.cache, { a: A, b: B, side: at, kind, moving: ids });
     const block = !r.ok && /上に乗っている|下に敷かれている/.test(r.reason);
     if (r.ok) tally.pass++; else if (block) tally.block++; else tally.tear++;
     if ((r.ok || !block) === !m.ok && (r.ok || block)) { /* 通す⇔通り抜けなし／①で断る⇔通り抜けあり */ }
     if ((r.ok && !m.ok) || (block && m.ok)) tally.disagree++;
     if (m.ok && m.ringCrossings) tally.ringOnly++;
     const r2 = NB.E.foldableSet(st0.cache.faces, st0.cache.bonds, ids, A, B, kind);
     if (!(r.ok || (block && r2.ok))) continue;
     const EE = r.ok ? E : NB.E, st = load(EE, rec);
     const top = st.cache.faces.filter(f => ids.includes(f.faceId) && EE.strictlyInside(at, f.poly)).sort((x, y) => y.layer - x.layer)[0];
     try { EE.proposeOnFace(st, a, b, top.faceId, { layers: 1 }); st.pending.kind = kind; EE.setSide(st, at);
      st.pending.candidates = ids.map(id => ({ faceId: id, layerPath: st.cache.faces.find(f => f.faceId === id).layerPath })); EE.select(st, st.pending.candidates); EE.confirm(st) } catch { continue }
     const fa = X.flatState(st.cache);
     if (r.ok) { tally.afterChecked++; if (!fa.ok) tally.afterBad++ } else { tally.noBlockChecked++; if (fa.ok) tally.noBlockValidEnd++; else tally.noBlockBad++ }
    }
   }
  }
 }
 console.log('    総当り：' + JSON.stringify(tally));
 assert.ok(tally.cand > 1000 && tally.pass > 50 && tally.block > 50, 'E 候補が少なすぎる（総当りになっていない）');
 assert.equal(tally.disagree, 0, 'E engine の①と判定器（面積の重なりの通り抜け）が食い違う');
 assert.equal(tally.ringOnly, 0, 'E 通り抜けなしなのに途中の並びが交差する候補がある（既存の判定で足りない）');
 assert.equal(tally.afterBad, 0, 'E engine が通した折りの結果に不成立の並びがある');
 assert.ok(tally.noBlockChecked > 10 && tally.noBlockBad > 0, 'E ①を外した写しの結果を調べられていない');
}
ok('E 総当り：engine の①と判定器が全候補で一致／通した折りの結果はすべて成立／途中だけ交差する候補は無い');

/* ================= Q 袋折り（複数の軸）の着地：画面と同じ2回の半分折り17経路で、折る前・袋折りのあとの平らな状態が成立 =================
   ⚠袋折りの**途中**は見ていない（1本の軸の議論が成り立たない）。ここで言うのは両端の並びだけ。 */
{
 const VW = { toScreen: p => [p[0] * 240, -p[1] * 240] }, SC = p => VW.toScreen(p);
 const tsuru2 = (axis, c1, c2) => { const t = E.create(); if (axis) E.flip(t, axis);
  let g = SNAP.grab(t, SC(c1), VW), cr = SNAP.creaseForCorners(t, g.point, [-c1[0], -c1[1]]);
  E.proposeOnFace(t, cr.line[0], cr.line[1], cr.faceId, { layers: 1 }); E.setSide(t, cr.sidePoint); E.select(t, t.pending.candidates); E.confirm(t);
  g = SNAP.grab(t, SC(c2), VW); const to = SC([-c2[0], -c2[1]]), s2 = SNAP.foldTarget(t, g, [to[0] - 10 * Math.sign(-c2[0]), to[1] - 6 * Math.sign(c2[1])], [0, 0], VW, false);
  const c = SNAP.creaseForCorners(t, g.point, s2.target);
  E.proposeOnFace(t, c.line[0], c.line[1], c.faceId, { layers: 1 }); E.setSide(t, c.sidePoint); E.setLayers(t, 2, c.sidePoint); E.select(t, t.pending.candidates); E.confirm(t); return t };
 const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]], paths = [];
 for (const axis of [null, 'v']) for (const c1 of CORNERS) for (const c2 of [[-c1[1], c1[0]], [c1[1], -c1[0]]]) paths.push([axis, c1, c2]);
 paths.push(['h', [-1, -1], [-1, 1]]);
 for (const [axis, c1, c2] of paths) { const t = tsuru2(axis, c1, c2);
  assert.equal(X.flatState(t.cache).ok, true, `Q つる②（${axis} ${c1} ${c2}）が成立しない`);
  E.proposeSquash(t); E.confirm(t);
  const r = X.flatState(t.cache);
  assert.equal(r.ok, true, `Q 袋折りのあと（${axis} ${c1} ${c2}）の並びが成立しない: ` + JSON.stringify(r.violations).slice(0, 200)) }
 console.log(`    袋折り ${paths.length}経路：折る前・袋折りのあとの平らな状態はすべて成立（途中は未検証）`);
}
ok('Q 袋折りの着地（17経路）の平らな状態が成立');

/* ================= P 計算量（PC の測定。携帯は未測定） ================= */
{
 const time = fn => { let t = performance.now(), k = 0, r; while (performance.now() - t < 40 || k < 3) { r = fn(); k++ } return { r, ms: (performance.now() - t) / k } };
 const fsB = time(() => X.flatState(base.cache)), fsV = time(() => X.flatState(V.st.cache));
 const sf = time(() => X.simpleFold(base.cache, { a: V.A, b: V.B, side: MOVE.side, kind: 'V', moving: V.ids }));
 const eng = time(() => E.foldableSet(base.cache.faces, base.cache.bonds, V.ids, V.A, V.B, 'V'));
 const row = (name, t, r) => `${name} 面${r.faces} 直線${r.lines ?? '-'} 断面${r.samples ?? r.ring.length} 内外${r.cost.inside} 交わり${r.cost.clip} 弦${r.cost.chordPairs} ${t.toFixed(3)}ms`;
 console.log('    ' + row('平らな状態（前）', fsB.ms, fsB.r));
 console.log('    ' + row('平らな状態（後）', fsV.ms, fsV.r));
 console.log('    ' + row('途中（sweep＋診断）', sf.ms, sf.r) + `／engine の foldableSet ${eng.ms.toFixed(3)}ms`);
 /* 面を増やす（紙ぜんぶを縦横に半分に折る）：伸び方を見る */
 const st = E.create(), grow = [];
 for (let i = 0; i < 7; i++) {
  const ps = st.cache.faces.flatMap(f => f.poly), x0 = Math.min(...ps.map(p => p[0])), x1 = Math.max(...ps.map(p => p[0])), y0 = Math.min(...ps.map(p => p[1])), y1 = Math.max(...ps.map(p => p[1])), vert = i % 2 === 0;
  const a = vert ? [(x0 + x1) / 2 + .013, y0 - .5] : [x0 - .5, (y0 + y1) / 2 + .011], b = vert ? [(x0 + x1) / 2 + .013, y1 + .5] : [x1 + .5, (y0 + y1) / 2 + .011];
  const at = vert ? [x1 - (x1 - x0) * .1, (y0 + y1) / 2 + .037] : [(x0 + x1) / 2 + .041, y1 - (y1 - y0) * .1];
  let A = a, B = b; if (S(at, A, B) > 0) [A, B] = [B, A];
  const ids = E.topFaces(st, at, E.layersAt(st, at).layers.length, A, B), before = st.cache;
  const s1 = time(() => X.simpleFold(before, { a: A, b: B, side: at, kind: 'V', moving: ids })), e1 = time(() => E.foldableSet(before.faces, before.bonds, ids, A, B, 'V'));
  const top = before.faces.filter(f => ids.includes(f.faceId) && E.strictlyInside(at, f.poly)).sort((p, q) => q.layer - p.layer)[0];
  E.proposeOnFace(st, a, b, top.faceId, { layers: 1 }); E.setSide(st, at); st.pending.candidates = ids.map(id => ({ faceId: id, layerPath: before.faces.find(f => f.faceId === id).layerPath })); E.select(st, st.pending.candidates); E.confirm(st);
  const f1 = time(() => X.flatState(st.cache));
  assert.equal(f1.r.ok, true, 'P 半分折りを重ねた状態が成立しない');
  grow.push(`面${before.faces.length}→${st.cache.faces.length}：平ら ${f1.ms.toFixed(2)}ms（内外${f1.r.cost.inside}・弦${f1.r.cost.chordPairs}）／途中 ${s1.ms.toFixed(2)}ms／engine① ${e1.ms.toFixed(3)}ms`);
 }
 console.log('    面を増やす：\n      ' + grow.join('\n      '));
}
ok('P 計算量を測った（PC。携帯の実機は未測定）');

if (process.argv.includes('--write')) {
 fs.writeFileSync(path.join(DIR, 'crossing_states.json'), JSON.stringify({ note: 'test_crossing_diag.js --write が書く。check_crossing_diag.py が別実装で平らな状態の並びを判定して突き合わせる。', states: out.states }, null, 1));
 console.log('  wrote crossing_case_diag.json / crossing_states.json');
}
console.log(`ALL OK（${n}項目）`);
console.log('  ⛔ 厚みのある紙（層の数だけ回り込む余裕・折り目のずれ）と、複数の軸を同時に動かす運動（袋折りの途中）の非貫通は見ていない');
