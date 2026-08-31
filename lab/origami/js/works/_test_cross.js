// ============================================================
// works/_test_cross.js — 最小テスト：正方形を十字に2回谷折り(4分の1に)
//   2026-08-30 続き13：鶴は複雑すぎて問題切り分けが困難になったため、
//   「裂けない仕組み」「手順と無関係な部分の固定」が正しく機能するかを
//   確認する最小ケース。4枚の象限パネルが中心Oのまわりで環状に隣接し、
//   木構造にすると1本(NW-SE、または対角)が「余剰」の同期辺になる、
//   鶴の花びら折りのO点まわりと同じ最小の型。
//   ★他の作品(tsuru.js等)とグローバル変数名がぶつからないようIIFEで囲む。
// ============================================================
'use strict';

(function () {
  window.ORIGAMI_WORKS = window.ORIGAMI_WORKS || {};

  const N = [0, 0, 1], E = [1, 0, 0], S = [0, 0, -1], W = [-1, 0, 0], O = [0, 0, 0];
  function uv(p) { return [(p[0] + 1) / 2, (p[2] + 1) / 2]; }

  // 4枚の象限パネル：NE(root) / NW / SE / SW
  // 隣接関係(環状)：NE-NW(辺 O-N), NW-SW(辺 O-W), SW-SE(辺 O-S), SE-NE(辺 O-E)
  // 木：root=NE(bone0) -> NW(bone1, 軸O-N) / NE -> SE(bone2, 軸O-E)
  //     SW(bone3)の親はSE(軸O-S)。NW-SW間の共有辺(O-W)は「余剰」→同期が必要。
  const PANEL_DEFS = [
    { bone: 0, tris: [[O, N, E]] },  // NE (root)
    { bone: 1, tris: [[O, W, N]] },  // NW (親bone0、軸O-N)
    { bone: 2, tris: [[O, E, S]] },  // SE (親bone0、軸O-E)
    { bone: 3, tris: [[O, S, W]] },  // SW (親bone2、軸O-S。O-W辺でbone1と同期が必要)
  ];

  const verts = [], tris = [], panel = [], uvArr = [], panel2 = [], blend = [];
  const BLEND_AMOUNT = 0.35;
  function findNeighborPanel(myBone, p) {
    for (const def of PANEL_DEFS) {
      if (def.bone === myBone) continue;
      for (const tri of def.tris) {
        for (const q of tri) {
          if (Math.abs(q[0]-p[0])<1e-9 && Math.abs(q[1]-p[1])<1e-9 && Math.abs(q[2]-p[2])<1e-9) {
            return def.bone;
          }
        }
      }
    }
    return null;
  }
  for (const def of PANEL_DEFS) {
    for (const tri of def.tris) {
      const base = verts.length;
      for (const p of tri) {
        verts.push(p); panel.push(def.bone); uvArr.push(uv(p));
        const nb = findNeighborPanel(def.bone, p);
        if (nb !== null && p !== O) { panel2.push(nb); blend.push(BLEND_AMOUNT); }
        else { panel2.push(def.bone); blend.push(0); }
      }
      tris.push([base, base + 1, base + 2]);
    }
  }

  const TV = OGL.vecNorm;
  const boneParent = [-1, 0, 0, 2];
  const hinge = [
    null,
    { origin: O, axis: TV([0, 0, 1]) },  // bone1(NW): O-N軸
    { origin: O, axis: TV([1, 0, 0]) },  // bone2(SE): O-E軸
    { origin: O, axis: TV([0, 0, -1]) }, // bone3(SW): O-S軸(親bone2)
  ];

  ORIGAMI_WORKS._test_cross = {
    id: '_test_cross', name: 'テスト:十字折り', emoji: '🧪', difficulty: 1,
    usePhysics: true,
    mesh: {
      verts, tris, uv: uvArr, panel, panel2, blend, boneParent, hinge,
      inflateSign: [0, 0, 0, 0],
    },
    steps: [
      { id: 1, handle: { boneId: 1, local: W }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
        hintLabel: '左上を谷折り', creaseLine: { boneId: 0, a: O, b: N, kind: 'valley' } },
      { id: 2, handle: { boneId: 2, local: S, linkedBoneIds: [3] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
        hintLabel: '右下を谷折り(左下も同時に)', creaseLine: { boneId: 0, a: O, b: E, kind: 'valley' } },
    ],
    labelPoints: [],
    poseAdjust: {},
    inflate: { min: 0, max: 1, default: 0 },
    cutSlots: [],
  };
})();
