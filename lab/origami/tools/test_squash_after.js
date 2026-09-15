'use strict';
/* 🧺 袋折りのあとも、ふつうに折り続けられるか（engine の共通入口・v2 の再生）。
   ★何を見るか
     A 成立する後続の折り（正方形の上の1枚の角を谷折り）＝候補は正式状態を動かさない／確定で1手・revision +1／
       面の素材座標・xf・faceId・layerPath・結び・折り目・層の整合（下の invariants）
     B 断る折り（結びが裂ける枚数・山折りで下に紙・中の紙だけ）＝正式状態も候補も保ち、選び直して確定できる
     C 保存→再読込→undo/redo で同じ状態
     D 原本として持ちこまれた後続の手（退役した面・裂ける手・袋折り2回）を再生で断る
     E 独立検証の材料を書く（--write で squash_after_states.json）→ check_squash_after.py が Python の fold2d で折り直して突き合わせる
   ⛔ 厚み0。途中の紙どうしの貫通（非貫通）は見ていない＝結びが裂けないことと別の未解決課題。
   使い方： node test_squash_after.js [--write]
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname;
const src = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js']) vm.runInThisContext(src(f));
const E = FreeFoldEngine, V = SquashV2;
const SCHEMA = JSON.parse(src('origami_recipe.schema.json'));
V.useV1Validator(OrigamiRecipe.validate, SCHEMA);
const C = x => JSON.parse(JSON.stringify(x));
const throws = (fn, re, msg) => assert.throws(fn, e => { assert.match(e.message, re, msg + '｜出た理由: ' + e.message); return true }, msg);
let n = 0; const ok = s => { n++; console.log('  ok ' + s) };
const J = JSON.parse(src('squash_tsuru3_v2.json'));
const load = r => { const st = E.create(); st.recipe = C(r); st.cache = E.replay(st.recipe);
 st.cacheRevision = st.revision; st.committed = st.recipe.steps.length ? st.cache : null; return st };
const snap = st => JSON.stringify({ recipe: st.recipe, revision: st.revision, hash: st.cache.hash,
 redo: st.redoStack, pending: st.pending, committed: st.committed ? st.committed.hash : null });

/* ---------- 小道具（engine を使わない：整合の見張りは別の手で測る） ---------- */
const ap = (m, p) => [m[0] * p[0] + m[1] * p[1] + m[4], m[2] * p[0] + m[3] * p[1] + m[5]];
const iv = (m, p) => { const d = m[0] * m[3] - m[1] * m[2], x = p[0] - m[4], y = p[1] - m[5]; return [(m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d] };
const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const areaOf = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1] } return s / 2 };
const ccw = P => areaOf(P) >= 0 ? P : P.slice().reverse();
function clip(P, Q) {/* 凸多角形どうしの交わり（Sutherland–Hodgman） */
 let out = ccw(P); const q = ccw(Q);
 for (let i = 0; i < q.length && out.length; i++) { const a = q[i], b = q[(i + 1) % q.length], inp = out; out = [];
  for (let j = 0; j < inp.length; j++) { const p = inp[j], r = inp[(j + 1) % inp.length], sp = cr(a, b, p), sr = cr(a, b, r);
   if (sp >= -1e-12) out.push(p);
   if ((sp > 1e-12 && sr < -1e-12) || (sp < -1e-12 && sr > 1e-12)) { const t = sp / (sp - sr); out.push([p[0] + (r[0] - p[0]) * t, p[1] + (r[1] - p[1]) * t]) } } }
 return out.length >= 3 ? out : [];
}
const overlap = (P, Q) => { const I = clip(P, Q); return I.length ? Math.abs(areaOf(I)) : 0 };
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/* 線分 s が多角形 P の辺の上に乗っている長さ（同一直線で重なる部分） */
function onBoundary(s, P) {
 let len = 0; const L = d2(s[0], s[1]); if (L < 1e-12) return 0;
 const u = [(s[1][0] - s[0][0]) / L, (s[1][1] - s[0][1]) / L];
 for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length];
  const da = Math.abs((a[0] - s[0][0]) * u[1] - (a[1] - s[0][1]) * u[0]), db = Math.abs((b[0] - s[0][0]) * u[1] - (b[1] - s[0][1]) * u[0]);
  if (da > 1e-7 || db > 1e-7) continue;
  const ta = (a[0] - s[0][0]) * u[0] + (a[1] - s[0][1]) * u[1], tb = (b[0] - s[0][0]) * u[0] + (b[1] - s[0][1]) * u[1];
  len += Math.max(0, Math.min(L, Math.max(ta, tb)) - Math.max(0, Math.min(ta, tb))) }
 return len;
}
/* 2つの多角形が共有する辺の長さの合計 */
function sharedLen(P, Q) { let s = 0; for (let i = 0; i < P.length; i++) s += onBoundary([P[i], P[(i + 1) % P.length]], Q); return s }

/* ★整合の見張り（engine の関数を使わずに測る） */
function invariants(cache, tag) {
 const F = cache.faces, mat = new Map(F.map(f => [f.faceId, f.poly.map(p => iv(f.xf, p))]));
 let sumCur = 0, sumMat = 0;
 for (const f of F) {
  /* faceId ＝ paper ＋ layerPath */
  assert.equal(f.faceId, 'paper' + f.layerPath.map(p => `/${p.stepId}.${p.side}`).join(''), `${tag} faceId と layerPath が食い違う: ${f.faceId}`);
  /* xf は剛体（伸び縮みしない） */
  const [a, b, c, d] = f.xf;
  assert.ok(Math.abs(a * a + c * c - 1) < 1e-9 && Math.abs(b * b + d * d - 1) < 1e-9 && Math.abs(a * b + c * d) < 1e-9, `${tag} xf が剛体でない: ${f.faceId}`);
  for (const p of mat.get(f.faceId)) assert.ok(Math.abs(p[0]) <= 1 + 1e-9 && Math.abs(p[1]) <= 1 + 1e-9, `${tag} 素材座標が原紙の外: ${f.faceId}`);
  sumCur += Math.abs(areaOf(f.poly)); sumMat += Math.abs(areaOf(mat.get(f.faceId)));
  assert.ok(Number.isInteger(f.layer), `${tag} layer が整数でない: ${f.faceId}`);
 }
 assert.ok(Math.abs(sumCur - 4) < 1e-9 && Math.abs(sumMat - 4) < 1e-9, `${tag} 紙の面積が 4 でない（${sumCur} / ${sumMat}）`);
 const ids = F.map(f => f.faceId);
 assert.equal(new Set(ids).size, ids.length, `${tag} faceId が重複`);
 for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
  const A = F[i], B = F[j];
  /* 素材は重ならない（紙は1枚） */
  assert.ok(overlap(mat.get(A.faceId), mat.get(B.faceId)) < 1e-9, `${tag} 素材が重なっている: ${A.faceId} / ${B.faceId}`);
  /* 面積をもって重なる2枚は、層が違う */
  if (overlap(A.poly, B.poly) > 1e-9) assert.notEqual(A.layer, B.layer, `${tag} 重なる2枚が同じ層: ${A.faceId} / ${B.faceId}`);
  /* 素材で辺を共有する2枚は、その辺ぜんぶが結びで覆われている（結びを失っていない） */
  const sh = sharedLen(mat.get(A.faceId), mat.get(B.faceId));
  const bl = cache.bonds.filter(bd => bd.faceIds.includes(A.faceId) && bd.faceIds.includes(B.faceId)).reduce((s, bd) => s + d2(bd.seg[0], bd.seg[1]), 0);
  assert.ok(Math.abs(sh - bl) < 1e-7, `${tag} 共有する辺と結びの長さが違う: ${A.faceId} / ${B.faceId}（辺 ${sh} / 結び ${bl}）`);
 }
 const byId = new Map(F.map(f => [f.faceId, f]));
 for (const bd of cache.bonds) {
  const x = byId.get(bd.faceIds[0]), y = byId.get(bd.faceIds[1]);
  assert.ok(x && y, `${tag} 結び ${bd.bondId} の面がない`);
  /* 結びは両側の素材の辺の上、両側の xf で同じ所へ（裂けていない） */
  for (const f of [x, y]) assert.ok(Math.abs(onBoundary(bd.seg, mat.get(f.faceId)) - d2(bd.seg[0], bd.seg[1])) < 1e-7, `${tag} 結び ${bd.bondId} が面 ${f.faceId} の辺の上にない`);
  for (const q of bd.seg) assert.ok(d2(ap(x.xf, q), ap(y.xf, q)) < 1e-7, `${tag} 結び ${bd.bondId} が裂けている`);
  /* 折り目（crease）は平ら＝両側の xf が同じ／背（hinge）は折れている＝鏡映の関係 */
  const same = x.xf.every((v, k) => Math.abs(v - y.xf[k]) < 1e-9);
  if (bd.kind === 'crease') assert.ok(same, `${tag} 折り目 ${bd.bondId} の両側の xf が違う`);
  else assert.equal(bd.kind, 'hinge', `${tag} 結びの kind が crease/hinge でない`);
 }
 /* 折り目（crease 記録）は、持ち主の面のいまの座標で、その面の中にある */
 for (const c of cache.creases) { const f = byId.get(c.faceId);
  assert.ok(f, `${tag} 折り目 ${c.creaseId} の持ち主の面がない`);
  const P = mat.get(f.faceId), s = c.seg.map(p => iv(f.xf, p));
  assert.ok(Math.abs(onBoundary(s, P) - d2(s[0], s[1])) < 1e-7, `${tag} 折り目 ${c.creaseId} が持ち主の面のふちにない`);
 }
 /* 開いて平らな結び（crease）の上には、折り目の記録がある */
 for (const bd of cache.bonds.filter(v => v.kind === 'crease')) {
  const f = byId.get(bd.faceIds[0]), cur = bd.seg.map(q => ap(f.xf, q));
  const L = d2(cur[0], cur[1]);
  const got = cache.creases.reduce((s, c) => {
   const on = [c.seg[0], c.seg[1]].every(p => Math.abs(cr(cur[0], cur[1], p)) / L < 1e-7);
   if (!on) return s; const t = p => ((p[0] - cur[0][0]) * (cur[1][0] - cur[0][0]) + (p[1] - cur[0][1]) * (cur[1][1] - cur[0][1])) / L;
   const lo = Math.max(0, Math.min(t(c.seg[0]), t(c.seg[1]))), hi = Math.min(L, Math.max(t(c.seg[0]), t(c.seg[1])));
   return s + Math.max(0, hi - lo) }, 0);
  assert.ok(got >= L - 1e-7, `${tag} 開いた結び ${bd.bondId} の上に折り目の記録がない（${got} / ${L}）`);
 }
 return true;
}

const P3 = 'paper/s1.cut/s2.cut/s3.cut', P2 = 'paper/s1.keep/s2.cut/s3.keep', P4 = 'paper/s1.cut/s2.cut/s3.keep';
const Q_S = 'paper/s1.cut/s2.keep', Q_E = 'paper/s1.keep/s2.keep', UL0 = 'paper/s1.keep/s2.cut/s3.cut';
/* 画面と同じ道：propose → setSide → setLayers（上からn枚）→ select → confirm */
function fold(st, a, b, at, layers, kind = 'V') {
 E.propose(st, a, b, { layers: 1 }); st.pending.kind = kind; E.setSide(st, at); E.setLayers(st, layers, at);
 E.select(st, st.pending.candidates); return E.confirm(st);
}
const cases = [];
const record = (name, st, seedHash) => cases.push({ name, recipe: C(st.recipe), squashStep: st.recipe.steps.findIndex(s => s.op === 'squash'),
 seed: C(load({ ...C(st.recipe), steps: st.recipe.steps.slice(0, st.recipe.steps.findIndex(s => s.op === 'squash') + 1) }).cache.faces),
 faces: C(st.cache.faces), seedHash });

/* ================= A 成立する後続の折り：正方形の上の1枚の角を谷折り ================= */
const base = load(J);
invariants(base.cache, 'A0 袋折り直後');
const S0 = base.cache.hash, SQ = C(base.cache.squash);
const A = load(J);
{
 const before = snap(A);
 E.propose(A, [.5, 1], [1, .5], { layers: 1 });
 E.setSide(A, [.95, .85]);
 E.setLayers(A, 1, [.95, .85]);
 const g = E.preview(A, 90);
 assert.equal(g.movingIds.slice().sort().join(), [P2, P3].sort().join(), 'A 上の1枚が「P3 と折り目でつながった P2」にならない');
 for (const a of [0, 90, 180]) E.preview(A, a);/* 0/90/180 で結びが裂けない（geometry の見張り） */
 E.select(A, A.pending.candidates);
 assert.equal(JSON.stringify({ ...JSON.parse(snap(A)), pending: null }), JSON.stringify({ ...JSON.parse(before), pending: null }), 'A 候補を作っただけで正式状態が変わった');
 E.confirm(A);
 assert.equal(A.recipe.version, 2, 'A 確定で version が 2 でなくなった');
 assert.deepEqual(A.recipe.steps.map(s => s.op), ['fold', 'fold', 'squash', 'fold'], 'A 手の並びが違う');
 assert.equal(A.revision, 1, 'A revision が +1 でない'); assert.equal(A.pending, null); assert.deepEqual(A.redoStack, []);
 const s4 = A.recipe.steps[3];
 assert.equal(s4.kind, 'V'); assert.equal(s4.reference.faceId, P3, 'A 基準面が P3 でない');
 assert.deepEqual(s4.targets.map(t => t.faceId).sort(), [P2, P3].sort());
 for (const q of s4.line.concat([s4.movingSidePoint])) assert.ok(Math.abs(q[0]) <= 1 && Math.abs(q[1]) <= 1, 'A 折線が原紙の外');
}
{
 const c = A.cache;
 invariants(c, 'A 後続の折り');
 assert.deepEqual(c.squash, SQ, 'A 袋折りの手の記録（領域・動く面）が後続の手で書きかわった');
 assert.equal(c.faces.length, 8, 'A 面が 8 枚にならない');
 const kids = [P2, P3].flatMap(id => ['keep', 'cut'].map(s => `${id}/s4.${s}`));
 for (const id of kids) assert.ok(c.faces.some(f => f.faceId === id), 'A 割れた子の面がない: ' + id);
 for (const id of [P2, P3]) assert.equal(c.faces.some(f => f.faceId === id), false, 'A 割れた親の面が残っている: ' + id);
 /* 動いた子＝親の xf に折線の鏡映を合成したもの。動かなかった子は親の xf のまま。 */
 const parent = new Map(base.cache.faces.map(f => [f.faceId, f]));
 const [a, b] = [[.5, 1], [1, .5]], ux = (b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]), uy = (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]);
 const refl = p => { const t = (p[0] - a[0]) * ux + (p[1] - a[1]) * uy; return [2 * (a[0] + t * ux) - p[0], 2 * (a[1] + t * uy) - p[1]] };
 for (const id of [P2, P3]) {
  const pa = parent.get(id), keep = c.faces.find(f => f.faceId === id + '/s4.keep'), cut = c.faces.find(f => f.faceId === id + '/s4.cut');
  assert.ok(keep.xf.every((v, k) => Math.abs(v - pa.xf[k]) < 1e-12), 'A 動かない子の xf が親と違う: ' + id);
  for (const q of [[0, 0], [1, 0], [0, 1]]) assert.ok(d2(ap(cut.xf, q), refl(ap(pa.xf, q))) < 1e-9, 'A 動いた子の xf が「折線の鏡映∘親」でない: ' + id);
  assert.equal(Math.sign(cut.xf[0] * cut.xf[3] - cut.xf[1] * cut.xf[2]), -Math.sign(pa.xf[0] * pa.xf[3] - pa.xf[1] * pa.xf[2]), 'A 動いた子の表裏が入れかわらない');
 }
 /* 触らなかった面は、袋折り直後と同じ（JSON の文字で比べる＝保存と同じ物差し。-0 と 0 は区別しない） */
 for (const f of base.cache.faces.filter(f => ![P2, P3].includes(f.faceId)))
  assert.equal(JSON.stringify(c.faces.find(g => g.faceId === f.faceId)), JSON.stringify(f), 'A 触っていない面が変わった: ' + f.faceId);
 /* 谷折り＝動いた紙は、重なる紙ぜんぶより上 */
 const moved = c.faces.filter(f => f.faceId.endsWith('/s4.cut'));
 for (const m of moved) for (const f of c.faces) if (!moved.includes(f) && overlap(m.poly, f.poly) > 1e-9)
  assert.ok(m.layer > f.layer, `A 谷折りで動いた ${m.faceId} が ${f.faceId} より上にない`);
 /* 結び：袋折りの6本のうち、折線をまたいだ b1（P3|P2 の折り目）だけが2本に分かれ、新しい背は b6・b7（続き番号） */
 const names = c.bonds.map(b => b.bondId).sort();
 assert.deepEqual(names, ['b1', 'b1', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'], 'A 結びの名前が違う: ' + names);
 const nb = c.bonds.filter(b => b.stepId === 's4');
 assert.deepEqual(nb.map(b => [b.bondId, b.kind]).sort(), [['b6', 'hinge'], ['b7', 'hinge']], 'A 新しい結びが b6・b7 の背でない');
 const opened = c.bonds.filter(b => b.openedBy === 's3');
 assert.deepEqual(opened.map(b => b.kind), ['crease', 'crease', 'crease'], 'A 袋折りで開いた折り目の由来が残らない');
 assert.equal(c.creases.length, 3, 'A 折り目の記録が 3 本でない（分かれた b1 ぶん +1）');
 assert.deepEqual(c.hinges.filter(h => h.stepId === 's4').map(h => h.hingeId), ['h-s4-6', 'h-s4-7'], 'A 背の記録が足されない');
 /* 紙片：折り目でつながった紙がちぎれていない */
 assert.deepEqual([...E.sheetIds(c.bonds, P3 + '/s4.cut')].sort(), [P2 + '/s4.cut', P3 + '/s4.cut'].sort(), 'A 動いた角の紙片が違う');
 /* 同じ原本を2回再生して同じ／外部の入口（SquashV2.replay）も同じ袋折りを返す */
 assert.equal(E.replay(A.recipe).hash, c.hash, 'A 再生が安定しない');
 assert.equal(V.replay(C(A.recipe)).hash, V.replay(C(J)).hash, 'A 外部入口の袋折りの結果が後続の手で変わる');
 record('A 正方形の上の1枚の角を谷折り', A, S0);
}
ok('A 袋折りのあとの谷折り1手：候補は正式状態を動かさず、確定で1手／面・xf・faceId・layerPath・結び・折り目・層が整合');

/* ================= B 断る折り：正式状態も候補も保ち、選び直して確定できる ================= */
{
 const st = load(J);
 E.propose(st, [.5, 1], [1, .5], { layers: 1 }); E.setSide(st, [.95, .85]); E.setLayers(st, 1, [.95, .85]);
 const keep = snap(st);
 /* 上から2枚＝P3 と P4 は背(b5)でつながっていないのに P4 だけ動く＝袋の背が裂ける */
 throws(() => E.setLayers(st, 2, [.95, .85]), /裂けます/, 'B 上から2枚（結びが裂ける）を断らない');
 assert.equal(snap(st), keep, 'B 断ったのに正式状態か候補が変わった');
 /* 山折り＝下に紙がある */
 st.pending.kind = 'M';
 throws(() => { E.select(st, st.pending.candidates); E.confirm(st) }, /下に敷かれている紙/, 'B 山折り（下に紙）を断らない');
 assert.equal(st.revision, 0); assert.equal(st.recipe.steps.length, 3, 'B 断ったのに手が増えた');
 assert.ok(st.pending && st.pending.selected.length, 'B 確定で断ったら候補が消えた（選び直せない）');
 /* 中の紙だけ（P4 だけ）＝上に紙がある */
 const q = st.pending, f = st.cache.faces.find(v => v.faceId === q.reference.faceId);
 let Aa = q.displayLine[0], Bb = q.displayLine[1]; if (E.side(ap(f.xf, q.sidePoint), Aa, Bb) > 0) [Aa, Bb] = [Bb, Aa];
 const mid = E.foldability(st, [P4], Aa, Bb, 'V', [.95, .85]);
 assert.equal(mid.ok, false, 'B 中の紙だけを折れてしまう'); assert.match(mid.reason, /上に乗っている紙/);
 /* 選び直し：谷折りへ戻して確定できる */
 st.pending.kind = 'V'; E.select(st, st.pending.candidates); E.confirm(st);
 assert.equal(st.cache.hash, A.cache.hash, 'B 選び直した確定が A と同じにならない');
 /* 取消：候補が消えて正式状態は変わらない */
 const t = load(J), t0 = snap(t);
 E.propose(t, [.6, 0], [1, .4], { layers: 1 }); E.setSide(t, [.93, .05]);
 throws(() => E.setLayers(t, 1, [.93, .05]), /裂けます/, 'B 角(1,0)の上の1枚（背 b5 が裂ける）を断らない');
 throws(() => E.setLayers(t, 3, [.93, .05]), /裂けます/, 'B 角(1,0)の上から3枚を断らない');
 E.cancel(t);
 assert.equal(snap(t), t0, 'B 取消で正式状態が戻らない');
}
ok('B 裂ける枚数・山折りで下に紙・中の紙だけ を断り、正式状態と候補を保つ。谷折りへ選び直して確定・取消できる');

/* ================= C 保存→再読込→undo/redo ================= */
{
 const saved = JSON.stringify(E.verifiedRecipe(A));
 const text = JSON.parse(saved);
 assert.equal(V.validate(C(text)), true, 'C 保存した原本が v2 の検査を通らない');
 const B2 = load(text);
 assert.equal(B2.cache.hash, A.cache.hash, 'C 再読込で同じ状態にならない');
 assert.deepEqual(B2.cache.faces, A.cache.faces, 'C 再読込で面が違う');
 const h1 = A.cache.hash;
 E.undo(B2);
 assert.equal(B2.cache.hash, S0, 'C undo で袋折り直後に戻らない'); assert.equal(B2.recipe.version, 2);
 assert.equal(B2.redoStack.length, 1);
 E.redo(B2);
 assert.equal(B2.cache.hash, h1, 'C redo で同じ状態にならない');
 E.undo(B2); E.undo(B2);
 assert.equal(B2.cache.faces.length, 4, 'C undo 2回で袋折りの前（4枚）に戻らない');
 E.redo(B2); assert.equal(B2.cache.hash, S0, 'C redo 1回目で袋折り直後にならない');
 E.redo(B2); assert.equal(B2.cache.hash, h1, 'C redo 2回目で後続の折りのあとにならない');
 assert.equal(JSON.stringify(B2.recipe), saved, 'C undo/redo で原本の文字が変わった');
 /* redo も確定と同じ関門を通る＝積んだ手が裂ける形（相手の P2 を外した）なら、状態を変える前に断る */
 E.undo(B2); const k = snap(B2);
 B2.redoStack[0] = { ...B2.redoStack[0], targets: [{ faceId: P3 }] };
 throws(() => E.redo(B2), /折り目でつながった紙|裂け|切り離/, 'C 裂ける手の redo を断らない');
 assert.equal(JSON.stringify({ ...JSON.parse(snap(B2)), redo: null }), JSON.stringify({ ...JSON.parse(k), redo: null }), 'C 断った redo で状態が変わった');
}
ok('C 保存→再読込で同じ／undo で袋折り直後・もう1回で袋折りの前／redo で元どおり（原本の文字も同じ）');

/* ================= D 原本として持ちこまれた後続の手を、再生で断る ================= */
{
 const s4 = C(A.recipe.steps[3]);
 /* 袋折りで割れて退役した面（P3 の親）を基準にした手 */
 const retired = { ...C(A.recipe), steps: [...C(J.steps), { ...s4, reference: { faceId: 'paper/s1.cut/s2.cut' },
  targets: [{ faceId: 'paper/s1.cut/s2.cut', layerPath: [{ stepId: 's1', side: 'cut' }, { stepId: 's2', side: 'cut' }] }] }] };
 throws(() => E.replay(retired), /袋折りのあとの手（v1）で止まりました.*対象面が見つかりません/, 'D 退役した面の手を断らない');
 /* 背 b5 が裂ける手（角(1,0)の上の1枚だけ） */
 const st = load(J); E.propose(st, [.6, 0], [1, .4], { layers: 1 }); E.setSide(st, [.93, .05]);
 E.setLayers(st, 2, [.93, .05]);
 const tear = { ...C(J), steps: [...C(J.steps), { id: 's4', diagramStep: '4', op: 'fold', kind: 'V', reference: { faceId: P3 },
  line: C(st.pending.line), movingSidePoint: C(st.pending.sidePoint), targets: [{ faceId: P3 }], instruction: '選んだ面を谷折りする' }] };
 throws(() => E.replay(tear), /袋折りのあとの手（v1）で止まりました.*裂け/, 'D 裂ける手を断らない');
 /* 同じ手に P4 を足せば通る（断った理由が「手の形」ではなく「裂け」だった証拠） */
 tear.steps[3].targets.push({ faceId: P4 });
 assert.equal(E.replay(tear).faces.length, 8, 'D P4 を足した手が通らない');
 /* ★2026-09-15 袋折りの手数では断らない。角を折ったあとの紙（A）は区間の途中で割れていて、局所照合の前提（面が区間の合併）に合わない＝理由つきで断る。 */
 throws(() => E.replay({ ...C(A.recipe), steps: [...C(A.recipe.steps), { ...C(J.steps[2]), id: 's5', diagramStep: '5' }] }), /区間の合併になっていません/, 'D 角を折ったあとの紙の袋折りを断らない');
 throws(() => E.proposeSquash(A), /区間の合併になっていません/, 'D 角を折ったあとの紙の袋折りの候補を断らない');
 /* 袋折りのあとの手に知らない op／v1 の形でない手 */
 throws(() => E.replay({ ...C(A.recipe), steps: [...C(J.steps), { ...s4, op: 'pleat' }] }), /未対応の操作|知らない操作/, 'D 後続の知らない op を断らない');
 throws(() => E.replay({ ...C(A.recipe), steps: [...C(J.steps), { ...s4, extra: 1 }] }), /前後の手（v1）が原本の形になっていません/, 'D 後続の手の余分な項目を断らない');
 throws(() => E.replay({ ...C(A.recipe), steps: [...C(J.steps), { ...s4, id: 's2' }] }), /duplicate step ID|重複/, 'D 後続の手の id 重複を断らない');
 /* 読むのに失敗しても入口は壊れない */
 assert.equal(E.replay(C(A.recipe)).hash, A.cache.hash);
}
ok('D 原本の後続の手：退役した面・裂ける手・袋折り2回・知らない op・余分な項目・id 重複を断る');

/* ================= A2〜A4 ほかの成立例（独立検証の材料） ================= */
{
 const a2 = load(J); fold(a2, [.6, 0], [1, .4], [.93, .05], 2); invariants(a2.cache, 'A2'); record('A2 角(1,0)を上から2枚で谷折り', a2, S0);
 const a3 = load(J); fold(a3, [.5, 1], [1, .5], [.95, .85], 4, 'M'); invariants(a3.cache, 'A3'); record('A3 角(1,1)を全部で山折り', a3, S0);
 const a4 = load(J); fold(a4, [.6, -1], [1, -.6], [.95, -.9], 2); invariants(a4.cache, 'A4'); record('A4 三角の角(1,-1)を上から2枚で谷折り', a4, S0);
 const a5 = load(J); fold(a5, [.5, 1], [1, .5], [.95, .85], 3); invariants(a5.cache, 'A5'); record('A5 角(1,1)を上から3枚で谷折り', a5, S0);
 /* 2手続けて：A のあとにもう1手 */
 const a6 = load(A.recipe); fold(a6, [.6, -1], [1, -.6], [.95, -.9], 2); invariants(a6.cache, 'A6'); record('A6 A のあとに三角の角をもう1手', a6, S0);
}
ok('A2〜A6 ほかの後続の折り（枚数・山谷・2手続けて）も整合');

/* ================= F 裏返し：袋折りのあとに紙ぜんぶを返す／返してから折る ================= */
{
 const f1 = load(J), before = C(f1.cache);
 E.flip(f1, 'v');
 assert.deepEqual(f1.recipe.steps.map(s => s.op), ['fold', 'fold', 'squash', 'flip'], 'F 裏返しの手が入らない');
 assert.equal(f1.recipe.version, 2); assert.equal(f1.revision, 1);
 invariants(f1.cache, 'F1 裏返し');
 /* 面は割れない・名前も結びも同じ／形は x→-x・層は符号が反転・表裏が入れかわる */
 assert.deepEqual(f1.cache.faces.map(f => f.faceId), before.faces.map(f => f.faceId), 'F1 面の名前が変わった');
 assert.equal(JSON.stringify(f1.cache.bonds), JSON.stringify(before.bonds), 'F1 結び（素材座標）が変わった');
 for (const f of f1.cache.faces) { const b = before.faces.find(g => g.faceId === f.faceId);
  assert.ok(f.layer === -b.layer, 'F1 層の符号が反転しない: ' + f.faceId);
  f.poly.forEach((p, i) => assert.ok(Math.abs(p[0] + b.poly[i][0]) < 1e-12 && Math.abs(p[1] - b.poly[i][1]) < 1e-12, 'F1 形が左右に返らない: ' + f.faceId));
  assert.equal(Math.sign(f.xf[0] * f.xf[3] - f.xf[1] * f.xf[2]), -Math.sign(b.xf[0] * b.xf[3] - b.xf[1] * b.xf[2]), 'F1 表裏が入れかわらない') }
 f1.cache.creases.forEach((c, i) => c.seg.forEach((p, k) => assert.ok(Math.abs(p[0] + before.creases[i].seg[k][0]) < 1e-12, 'F1 折り目が紙といっしょに返らない')));
 assert.deepEqual(f1.cache.squash, SQ, 'F1 袋折りの手の記録が変わった');
 record('F1 袋折り→裏返し', f1, S0);
 /* 返したあと＝いちばん上は袋折りで下にあった Q_E。角 (-1,1) の上の1枚は Q_E と折り目でつながった UL0 */
 const f2 = load(f1.recipe);
 E.proposeOnFace(f2, [-.5, 1], [-1, .5], Q_E, { layers: 1 }); E.setSide(f2, [-.95, .85]);
 const keep = snap(f2);
 E.setLayers(f2, 1, [-.95, .85]);
 assert.deepEqual(f2.pending.candidates.map(c => c.faceId).sort(), [Q_E, UL0].sort(), 'F2 返したあとの上の1枚が Q_E と UL0 にならない');
 const k1 = snap(f2);
 throws(() => E.setLayers(f2, 2, [-.95, .85]), /裂けます/, 'F2 返したあとの上から2枚（背 b3 が裂ける）を断らない');
 assert.equal(snap(f2), k1, 'F2 断ったのに状態か候補が変わった'); void keep;
 E.select(f2, f2.pending.candidates); E.confirm(f2);
 assert.deepEqual(f2.recipe.steps.map(s => s.op), ['fold', 'fold', 'squash', 'flip', 'fold']);
 invariants(f2.cache, 'F2 裏返し→折り');
 const moved = f2.cache.faces.filter(f => f.faceId.endsWith('/s5.cut'));
 assert.equal(moved.length, 2, 'F2 動いた角が2面でない');
 for (const m of moved) for (const f of f2.cache.faces) if (!moved.includes(f) && overlap(m.poly, f.poly) > 1e-9)
  assert.ok(m.layer > f.layer, `F2 谷折りで動いた ${m.faceId} が ${f.faceId} より上にない`);
 record('F2 袋折り→裏返し→角を谷折り', f2, S0);
 /* undo/redo・保存→再読込 */
 const h2 = f2.cache.hash, saved = JSON.stringify(E.verifiedRecipe(f2));
 E.undo(f2); assert.equal(f2.cache.hash, f1.cache.hash, 'F undo で裏返しの直後に戻らない');
 E.undo(f2); assert.equal(f2.cache.hash, S0, 'F undo 2回で袋折り直後に戻らない');
 E.redo(f2); assert.equal(f2.cache.hash, f1.cache.hash, 'F 裏返しの redo が袋折りのあとで通らない');
 E.redo(f2); assert.equal(f2.cache.hash, h2, 'F redo 2回で元に戻らない');
 assert.equal(load(JSON.parse(saved)).cache.hash, h2, 'F 保存→再読込で同じにならない');
 /* 横に返す（h）も同じ枠 */
 const f3 = load(J); E.flip(f3, 'h'); invariants(f3.cache, 'F3 上下に裏返し'); record('F3 袋折り→上下に裏返し', f3, S0);
}
ok('F 袋折りのあとの裏返し（左右・上下）と、返してからの谷折り：面・結び・折り目・層が整合／裂ける枚数は断る／undo・redo・保存');

/* ================= K 折り目：袋折りのあとに折り目だけ付ける／付けてそのまま折る ================= */
{
 const crease = (st, a, b, face, at, n, kind = 'V') => { E.proposeOnFace(st, a, b, face, { layers: 1 }); st.pending.kind = kind;
  E.setSide(st, at); E.setLayers(st, n, at); E.select(st, st.pending.candidates); return E.confirm(st, { op: 'crease' }) };
 /* K1 正方形の上の1枚（P3 と折り目でつながった P2）に折り目 */
 const k1 = load(J);
 crease(k1, [.5, 1], [1, .5], P3, [.95, .85], 1);
 assert.deepEqual(k1.recipe.steps.map(s => s.op), ['fold', 'fold', 'squash', 'crease'], 'K1 折り目の手が入らない');
 invariants(k1.cache, 'K1 折り目');
 for (const f of k1.cache.faces) { const par = base.cache.faces.find(g => f.faceId === g.faceId || f.faceId.startsWith(g.faceId + '/s4.'));
  assert.ok(par && f.xf.every((v, i) => Math.abs(v - par.xf[i]) < 1e-12) && f.layer === par.layer, 'K1 折り目で紙が動いた／層が変わった: ' + f.faceId) }
 const nb = k1.cache.bonds.filter(b => b.stepId === 's4');
 assert.deepEqual(nb.map(b => b.kind), ['crease', 'crease'], 'K1 新しい結びが折り目2本でない');
 assert.equal(k1.cache.creases.filter(c => c.stepId === 's4').length, 2, 'K1 折り目の記録が2本足されない');
 assert.equal(k1.cache.hinges.length, base.cache.hinges.length, 'K1 折り目で背の記録が増えた');
 /* 紙片：折り目でつながった P2・P3 の4面が1つの紙片 */
 assert.equal(E.sheetIds(k1.cache.bonds, P3 + '/s4.cut').size, 4, 'K1 折り目の紙片が4面にならない');
 record('K1 袋折り→上の1枚に折り目', k1, S0);
 /* K2 正方形の4枚ぜんぶに横の折り目 */
 const k2 = load(J);
 crease(k2, [0, .5], [1, .5], P3, [.9, .7], 4);
 invariants(k2.cache, 'K2 4枚に折り目');
 assert.equal(k2.cache.faces.length, 12, 'K2 正方形の6面が割れて12面にならない');
 record('K2 袋折り→正方形の4枚に横の折り目', k2, S0);
 /* 断る：中の紙だけに折り目（上から続けて選んでいない） */
 { const t = load(J); E.proposeOnFace(t, [.5, 1], [1, .5], P3, { layers: 1 }); E.setSide(t, [.95, .85]);
  const q = t.pending, f = t.cache.faces.find(v => v.faceId === q.reference.faceId);
  let Aa = q.displayLine[0], Bb = q.displayLine[1]; if (E.side(ap(f.xf, q.sidePoint), Aa, Bb) > 0) [Aa, Bb] = [Bb, Aa];
  assert.equal(E.foldability(t, [P4], Aa, Bb, 'V', [.95, .85]).ok, false, 'K 中の紙だけに折り目を付けられてしまう') }
 /* K3 折り目を付けて、そのまま折る（🧵 stage → stageSide → confirmStaged＝2手を原子的に） */
 const k3 = load(J);
 E.proposeOnFace(k3, [.5, 1], [1, .5], P3, { layers: 1 }); E.setSide(k3, [.95, .85]); E.setLayers(k3, 1, [.95, .85]);
 const k3b = snap(k3);
 const d = E.stage(k3, 'V');
 assert.equal(JSON.stringify({ ...JSON.parse(snap(k3)), pending: null }), JSON.stringify({ ...JSON.parse(k3b), pending: null }), 'K3 派生を作っただけで正式状態が変わった');
 E.stageSide(d, [.95, .85]);
 E.confirmStaged(k3, d);
 assert.deepEqual(k3.recipe.steps.map(s => s.op), ['fold', 'fold', 'squash', 'crease', 'fold'], 'K3 折り目→折りの2手にならない');
 assert.equal(k3.revision, 1, 'K3 revision が1回だけ増えていない');
 invariants(k3.cache, 'K3 折り目→折り');
 /* 形・表裏・層は A（折り目なしで同じ角を折った）と同じ＝折り目を先に付けても紙の置かれ方は変わらない */
 const key = c => c.faces.map(f => JSON.stringify([f.poly.map(p => p.map(v => Math.round(v * 1e9))).sort(), Math.sign(f.xf[0] * f.xf[3] - f.xf[1] * f.xf[2]), f.layer])).sort().join('|');
 assert.equal(key(k3.cache), key(A.cache), 'K3 折り目を付けてから折った形が、A と違う');
 record('K3 袋折り→折り目を付けてそのまま折る', k3, S0);
 E.undo(k3); assert.equal(k3.recipe.steps.length, 4, 'K3 undo 1回で折りだけ外れない'); E.redo(k3); invariants(k3.cache, 'K3 redo');
}
ok('K 袋折りのあとの折り目（上の1枚・4枚ぜんぶ）と「折り目を付けてそのまま折る」：紙は動かず結び・折り目・層が整合／中の紙だけは断る');

/* ================= O 複数面を、同じ1本の背の軸で一緒に開く（2026-09-14） =================
   ★決まり（engine の proposeOpen）
     - 動く紙の集合＝背の片側の面から「動く側の内部へ入る結び」（foldableSet④と同じ物差し）をたどって集める。軸の上だけの結びはたどらない。
     - 指した所のいちばん上の紙がその集合に入る／背の相手が入らない（入る＝軸の外で一周してつながる＝複数の軸が要る形は対象外）／
       集合がぜんぶ軸の同じ側に丸ごとある／あとは既存の①（修正済みの重なり）②④・recordable・replay・0/90/180。
   ★袋折りの紙で分かったこと（実測）
     - 袋折り直後：見えている背（s1#1・s3#1・s3#2）は、6面が結びの輪なので**どれも複数の軸が要る**＝断る。
       成立するのは対角の背 s2#1（Q_S|P4）で、右下の2面（P4・P3）を谷、または Q の2面（Q_S・Q_E）を山で開く形。ただしこの背は上から見えない。
     - 袋折りのあと角を谷折りした紙（A）では s2#1 の一部が見える＝画面から選べる。右下の3面を谷で一緒に開ける。
   ★独立の確かめ（engine の関数を使わない）：動く集合を「軸の直線の上の結びを外した連結成分」で作り直して一致／動く⇔止まるの結びが全部軸の上／
     sweep（fold_crossing）で通り抜けなし／確定後の flatState が成立。Python（本番 fold2d）の突き合わせは --write の経路 O1〜O3。 */
vm.runInThisContext(src('fold_crossing.js'));
{
 const X = FoldCrossing;
 const onAxisLine = (seg, a, b) => { const L = d2(a, b); return seg.every(p => Math.abs(cr(a, b, p)) / L <= 1e-9) };
 const curSeg = (cache, bd) => { const f = cache.faces.find(g => g.faceId === bd.faceIds[0]); return bd.seg.map(q => ap(f.xf, q)) };
 /* 独立に作る動く集合：軸の直線の上に乗る結びを外したときの、start の連結成分 */
 const compOf = (cache, start, a, b) => { const set = new Set([start]), q = [start];
  while (q.length) { const x = q.pop(); for (const bd of cache.bonds) { if (!bd.faceIds.includes(x) || onAxisLine(curSeg(cache, bd), a, b)) continue;
   const y = bd.faceIds.find(i => i !== x); if (!set.has(y)) { set.add(y); q.push(y) } } }
  return set };
 const centroid = P => P.reduce((s2, p) => [s2[0] + p[0] / P.length, s2[1] + p[1] / P.length], [0, 0]);
 /* 1つの提案を、独立の物差しで見直してから確定し、保存→再読込→undo/redo まで通す */
 const openAndCheck = (rec, hingeId, at, want, tag) => {
  const st = load(rec), before = snap(st), steps = st.recipe.steps.length;
  const q = E.proposeOpen(st, E.hingeIntent(st, hingeId), at);
  assert.equal(JSON.stringify({ ...JSON.parse(snap(st)), pending: null }), JSON.stringify({ ...JSON.parse(before), pending: null }), tag + ' 提案だけで正式状態が動いた');
  const ids = q.candidates.map(c => c.faceId), [a, b] = q.displayLine;
  assert.deepEqual(ids.slice().sort(), want.faces.slice().sort(), tag + ' 動く集合が違う');
  assert.equal(q.kind, want.kind, tag + ' 山谷が違う');
  assert.ok(ids.length >= 2, tag + ' 複数面になっていない');
  assert.deepEqual([...compOf(st.cache, q.reference.faceId, a, b)].sort(), ids.slice().sort(), tag + ' 独立に作った連結成分と動く集合が違う');
  const idSet = new Set(ids);
  const cross = st.cache.bonds.filter(bd => idSet.has(bd.faceIds[0]) !== idSet.has(bd.faceIds[1]));
  assert.ok(cross.length >= 1 && cross.every(bd => onAxisLine(curSeg(st.cache, bd), a, b)), tag + ' 動く紙と止まる紙の結びが軸の上にない');
  const inner = st.cache.bonds.filter(bd => idSet.has(bd.faceIds[0]) && idSet.has(bd.faceIds[1]));
  assert.ok(inner.length >= ids.length - 1, tag + ' 動く紙どうしのつながりが無い');
  assert.ok(E.stackAt(st, at)[0] && idSet.has(E.stackAt(st, at)[0].faceId), tag + ' 指した所のいちばん上の紙が集合に無い');
  for (const deg of [0, 90, 180]) assert.equal(E.preview(st, deg).movingIds.length, ids.length, tag + ` ${deg}°で動く面の数が違う`);
  const sw = X.simpleFold(st.cache, { a, b, side: at, kind: q.kind, moving: ids });
  assert.equal(sw.ok, true, tag + ' sweep が通り抜けを見つけた');
  E.select(st, st.pending.candidates); E.confirm(st);
  assert.equal(st.recipe.steps.length, steps + 1, tag + ' 1手で確定しない'); assert.equal(st.revision, 1);
  const s = st.recipe.steps[steps];
  assert.equal(s.op, 'fold', tag + ' ふつうの fold で記録されていない'); assert.equal(s.kind, want.kind);
  assert.deepEqual(s.targets.map(t => t.faceId).sort(), ids.slice().sort(), tag + ' targets が動く集合でない');
  for (const pq of s.line.concat([s.movingSidePoint])) assert.ok(Math.abs(pq[0]) <= 1 && Math.abs(pq[1]) <= 1, tag + ' 折線が原紙の外');
  invariants(st.cache, tag + ' 確定後');
  assert.equal(st.cache.faces.length, load(rec).cache.faces.length, tag + ' 開く手が面を割った（開くでなく新しく折っている）');
  assert.equal(X.flatState(st.cache).ok, true, tag + ' 確定後の平らな状態が成立しない');
  /* 動いた紙どうしの結びは残る（両側の xf で同じ所に写ることは replay と invariants が見る） */
  for (const bd of inner) assert.ok(st.cache.bonds.some(v => v.faceIds.slice().sort().join() === bd.faceIds.slice().sort().join()), tag + ' 動いた紙どうしの結びが消えた');
  /* 保存→再読込→undo/redo */
  const saved = C(E.verifiedRecipe(st)), re = load(saved);
  assert.equal(re.cache.hash, st.cache.hash, tag + ' 保存した原本を読み直すと別の紙');
  const h = st.cache.hash; E.undo(st); assert.equal(st.recipe.steps.length, steps, tag + ' undo');
  assert.equal(st.cache.hash, load(rec).cache.hash, tag + ' undo で元の紙に戻らない');
  E.redo(st); assert.equal(st.cache.hash, h, tag + ' redo でハッシュが戻らない');
  return st };

 /* O1 袋折り直後：対角の背 s2#1 で右下2面（P4・P3）を谷で開く（右下の紙を指す） */
 const o1 = openAndCheck(J, 'hinge:s2#1', [.8, .3], { faces: [P4, P3], kind: 'V' }, 'O1');
 record('O1 袋折り直後、対角の背で右下2面を谷で開く', o1, S0);
 /* O2 袋折り直後：同じ背で Q の2面（Q_S・Q_E）を山で開く（Q だけの所を指す） */
 const o2 = openAndCheck(J, 'hinge:s2#1', [.8, -.5], { faces: [Q_S, Q_E], kind: 'M' }, 'O2');
 record('O2 袋折り直後、対角の背で Q の2面を山で開く', o2, S0);
 /* O3 袋折りのあと角を谷折りした紙（A）：見えている背 s2#1 で右下3面を谷で開く */
 assert.equal(E.hingeIntervals(load(J)).find(v => v.intervalId === 'hinge:s2#1').visible, false, 'O1 袋折り直後の背 s2#1 が見えている（前提が変わった）');
 assert.equal(E.hingeIntervals(load(A.recipe)).find(v => v.intervalId === 'hinge:s2#1').visible, true, 'O3 A の背 s2#1 が見えていない（画面から選べない）');
 const o3 = openAndCheck(A.recipe, 'hinge:s2#1', [.8, .3], { faces: [P4, P3 + '/s4.keep', P3 + '/s4.cut'], kind: 'V' }, 'O3');
 record('O3 角を谷折りしたあと、見えている対角の背で右下3面を谷で開く', o3, S0);
 ok('O1〜O3 複数面を同じ背の軸で開く：集合は独立の連結成分と一致・止まる紙との結びは全部軸の上・sweep なし・確定は fold 1手・flatState 成立・保存→再読込→undo/redo');

 /* O4 断る形：理由と、正式状態・候補（折りの候補を持ったまま）を保つ */
 const reasons = new Set();
 for (const rec of [J, A.recipe]) {
  const st = load(rec), qe = st.cache.faces.find(f => f.faceId.startsWith(Q_E)).faceId;
  E.proposeOnFace(st, [.6, -1], [1, -.6], qe, { layers: 1 });
  const keep = snap(st);
  for (const hid of ['hinge:s1#1', 'hinge:s3#1', 'hinge:s3#2']) for (const at of [[.8, .3], [.2, .6], [.8, -.5]]) {
   let msg = null; try { E.proposeOpen(st, E.hingeIntent(st, hid), at) } catch (e) { msg = e.message }
   assert.ok(msg, 'O4 輪の背を開けた: ' + hid); reasons.add(msg.replace(/（pa.*$|: paper.*$/, ''));
   assert.equal(snap(st), keep, 'O4 断ったのに正式状態か候補が変わった: ' + msg) }
 }
 console.log('    輪の背を断った理由：' + [...reasons].join(' ／ '));
 assert.ok([...reasons].some(r => /この背の軸1本では開けません（複数の軸を同時に動かす形です）/.test(r)), 'O4 複数の軸が要る形の理由が出ない');
 { const st = load(J), keep = snap(st);
  throws(() => E.proposeOpen(st, E.hingeIntent(st, 'hinge:s2#1'), [.2, .6]), /指した所のいちばん上の紙は、選んだ背で開く紙ではありません/, 'O4 集合に入らない紙を指して開けた');
  assert.equal(snap(st), keep, 'O4 断ったのに状態が変わった') }
 ok('O4 輪の背（複数の軸が要る）・集合に入らない紙を指す：理由を出して正式状態と候補を保つ');

 /* O5 総当り：袋折り直後・裏返し2通り・袋折りのあとの全経路 × 全部の背 × 全部の面の重心を指す */
 const bases = [['J', J]]; for (const axis of ['v', 'h']) { const t = load(J); E.flip(t, axis); bases.push(['J裏' + axis, C(t.recipe)]) }
 for (const c of cases.filter(c => !/^O\d/.test(c.name))) bases.push([c.name.split(' ')[0], c.recipe]);
 const T = { cand: 0, open: 0, multi: 0, bad: 0, keepBad: 0, compBad: 0, axisBad: 0, sweepBad: 0, splitBad: 0 };
 for (const [, rec] of bases) { const st0 = load(rec);
  for (const hv of E.hingeIntervals(st0)) for (const f of st0.cache.faces) { const at = centroid(f.poly); T.cand++;
   const keep = snap(st0); let q;
   try { q = E.proposeOpen(st0, E.hingeIntent(st0, hv.intervalId), at) } catch (e) { if (snap(st0) !== keep) T.keepBad++; continue }
   T.open++; const ids = q.candidates.map(c => c.faceId), [a, b] = q.displayLine; if (ids.length > 1) T.multi++;
   if ([...compOf(st0.cache, q.reference.faceId, a, b)].sort().join() !== ids.slice().sort().join()) T.compBad++;
   const idSet = new Set(ids);
   if (!st0.cache.bonds.filter(bd => idSet.has(bd.faceIds[0]) !== idSet.has(bd.faceIds[1])).every(bd => onAxisLine(curSeg(st0.cache, bd), a, b))) T.axisBad++;
   if (!X.simpleFold(st0.cache, { a, b, side: at, kind: q.kind, moving: ids }).ok) T.sweepBad++;
   E.cancel(st0);
   const t = load(rec); E.proposeOpen(t, E.hingeIntent(t, hv.intervalId), at); E.select(t, t.pending.candidates); E.confirm(t);
   if (!X.flatState(t.cache).ok) T.bad++;
   if (t.cache.faces.length !== st0.cache.faces.length) T.splitBad++ } }
 console.log('    総当り：' + JSON.stringify(T));
 assert.ok(T.cand > 500 && T.multi > 50, 'O5 候補が少なすぎる');
 assert.equal(T.keepBad + T.compBad + T.axisBad + T.sweepBad + T.bad + T.splitBad, 0, 'O5 食い違いがある（splitBad＝開く手が面を割った＝開くでなく新しく折っている）');
 ok(`O5 総当り ${T.cand}候補：成立 ${T.open}（複数面 ${T.multi}）すべて独立の連結成分と一致・結びは軸の上・sweep なし・確定後 flatState 成立／断っても状態不変`);
}

if (process.argv.includes('--write')) {
 const out = path.join(DIR, 'squash_after_states.json');
 fs.writeFileSync(out, JSON.stringify({ note: 'node test_squash_after.js --write が書く。check_squash_after.py が読む。', cases }, null, 1));
 console.log('  wrote ' + out);
}
console.log(`ALL OK（${n}項目）`);
console.log('  ⛔ 厚み0。途中の紙どうしの貫通（非貫通）は未検証＝結びが裂けないこととは別の課題');
