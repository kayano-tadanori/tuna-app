// ============================================================
// works/_test_half.js — 最小テスト：正方形を半分に折るだけ(2パネル・1ヒンジ)
//   2026-08-30 続き13：「手順と関係ないヒンジは絶対に動いてはいけない」
//   「先に厚みを持たせる」の両方を、いちばん単純な例で検証するための土台。
// ============================================================
'use strict';

window.ORIGAMI_WORKS = window.ORIGAMI_WORKS || {};

const N2 = [0, 0, 1], E2 = [1, 0, 0], S2 = [0, 0, -1], W2 = [-1, 0, 0], O2 = [0, 0, 0];
function uv2(p) { return [(p[0] + 1) / 2, (p[2] + 1) / 2]; }

// bone0(root)=東半分(O,N,E,S台形→三角2枚) / bone1=西半分(O,N,W,S→折れる側)
const PANEL_DEFS2 = [
  { bone: 0, tris: [[O2, N2, E2], [O2, E2, S2]] },
  { bone: 1, tris: [[O2, W2, N2], [O2, S2, W2]] },
];
const verts2 = [], tris2 = [], panel2arr = [], uvArr2 = [];
for (const def of PANEL_DEFS2) {
  for (const tri of def.tris) {
    const base = verts2.length;
    for (const p of tri) { verts2.push(p); panel2arr.push(def.bone); uvArr2.push(uv2(p)); }
    tris2.push([base, base + 1, base + 2]);
  }
}
const TV2 = OGL.vecNorm;
const boneParent2 = [-1, 0];
const hinge2 = [null, { origin: O2, axis: TV2([0, 0, 1]) }];

ORIGAMI_WORKS._test_half = {
  id: '_test_half', name: 'テスト:半分折り', emoji: '🧪', difficulty: 1,
  usePhysics: true,
  mesh: {
    verts: verts2, tris: tris2, uv: uvArr2, panel: panel2arr,
    boneParent: boneParent2, hinge: hinge2,
    inflateSign: [0, 0],
  },
  steps: [
    { id: 1, handle: { boneId: 1, local: W2 }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '半分に谷折り', creaseLine: { boneId: 0, a: O2, b: N2, kind: 'valley' } },
  ],
  labelPoints: [],
  poseAdjust: {},
  inflate: { min: 0, max: 1, default: 0 },
  cutSlots: [],
};
