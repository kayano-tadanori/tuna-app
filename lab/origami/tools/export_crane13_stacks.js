'use strict';
/* つる⑬：保存原本から「実際に重なる場所の上下」を engine の stackAt で読む（2026-09-17・本人指示・本体は無変更）
   本人指示：接触条件を、実物の観察ではなく**保存原本と面の向き**から復元する。
   - engine の stackAt(state,p) は「点 p を厳密に含む面」を層の大きい順（上から）に並べる＝保存原本の再生で決まる、その場所の上下。
   - ここは読むだけ。判定（表側/裏側・開く向き）は Python（check_crane13_sides.py）で行う。

   使い方：
     node export_crane13_stacks.js tests            → crane13_stack_tests.json（小さな記録で、2枚重ね・4枚重ね・裏返し・回転・山折り）
     node export_crane13_stacks.js crane <query>    → crane13_stack_crane.json（query の点ごとに、⑫後の原本の stackAt）
*/
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const DIR = process.env.ORIGAMI_SRC_DIR || __dirname, rd = f => fs.readFileSync(path.join(DIR, f), 'utf8');
for (const f of ['freefold_engine.js', 'freefold_snap.js', 'origami_recipe.js', 'squash_model.js', 'squash_v2.js', 'petal_v2.js', 'fold_crossing.js']) vm.runInThisContext(rd(f));
SquashV2.useV1Validator(OrigamiRecipe.validate, JSON.parse(rd('origami_recipe.schema.json')));
const E = FreeFoldEngine;
const C = o => JSON.parse(JSON.stringify(o));

const base = JSON.parse(rd('crane12_state.json')).recipe;
const header = Object.fromEntries(Object.entries(base).filter(([k]) => k !== 'steps'));
const s1 = base.steps[0], s2 = base.steps[1];
const flip = (n, axis) => ({ id: `s${n}`, diagramStep: String(n), op: 'flip', axis, instruction: axis === 'v' ? '紙を左右に裏返す' : '紙を上下に裏返す' });

function stateOf(steps) {
  const recipe = { ...C(header), steps: C(steps) };
  const st = E.create(); st.recipe = recipe; st.cache = E.replay(recipe); st.committed = st.cache;
  return st;
}
function dump(st) {
  const cc = st.cache;
  return {
    faces: cc.faces.map(f => ({ faceId: f.faceId, poly: f.poly, xf: f.xf, layer: f.layer, back: E.detXf(f.xf) < 0 })),
    bonds: cc.bonds.map(b => ({ bondId: b.bondId, faceIds: b.faceIds, kind: b.kind, stepId: b.stepId, seg: b.seg })),
  };
}

const mode = process.argv[2];
if (mode === 'tests') {
  const sM = { ...C(s1), kind: 'M', instruction: '選んだ面を山折りする' };
  const cases = {
    'A 2枚（谷）': [s1],
    'A 2枚（谷）→左右に裏返す': [s1, flip(2, 'v')],
    'A 2枚（谷）→左右→上下に裏返す＝180°回転': [s1, flip(2, 'v'), flip(3, 'h')],
    'AM 2枚（山）': [sM],
    'AM 2枚（山）→上下に裏返す': [sM, flip(2, 'h')],
    'B 4枚（谷→谷）': [s1, s2],
    'B 4枚→左右に裏返す': [s1, s2, flip(3, 'v')],
    'B 4枚→左右→上下＝180°回転': [s1, s2, flip(3, 'v'), flip(4, 'h')],
  };
  const out = {};
  for (const [name, steps] of Object.entries(cases)) {
    const st = stateOf(steps);
    /* 格子の点ごとに stackAt：上から順の面ID と層（同じ層の組は「決まらない」印） */
    const samples = [];
    const G = 40;
    for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) {
      const p = [-1 + 2 * i / G, -1 + 2 * j / G];
      const s = E.stackAt(st, p);
      if (s.length >= 2) samples.push({ p, stack: s.map(x => ({ faceId: x.faceId, layer: x.layer, back: x.back })) });
    }
    out[name] = { ...dump(st), samples };
  }
  fs.writeFileSync(path.join(DIR, 'crane13_stack_tests.json'), JSON.stringify(out, null, 1));
  console.log('crane13_stack_tests.json：', Object.keys(out).map(k => `${k} 面${out[k].faces.length}・点${out[k].samples.length}`).join('／'));
} else if (mode === 'crane') {
  const q = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const st = stateOf(base.steps);
  const hash = require('node:crypto').createHash('sha1').update(st.cache.hash).digest('hex');
  const res = q.queries.map(r => ({ ...r, stack: E.stackAt(st, r.p).map(x => ({ faceId: x.faceId, layer: x.layer, back: x.back })) }));
  fs.writeFileSync(path.join(DIR, 'crane13_stack_crane.json'), JSON.stringify({ fingerprint: hash, faces: dump(st).faces, results: res }, null, 1));
  console.log('crane13_stack_crane.json：点', res.length, '指紋', hash.slice(0, 12));
} else {
  throw new Error('使い方：tests か crane <query.json>');
}
