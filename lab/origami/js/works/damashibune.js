// ============================================================
// works/damashibune.js — だまし舟（最小検証作品）
//
//   ★このモデルの制約：パネルは動的に再分割できない。
//     後のステップで折る線をあらかじめ見越して、メッシュを最初から
//     全パネルに分割しておく必要がある（gl.jsのuBonesは1頂点=1ボーン固定）。
//
//   座標系：紙をXZ平面（Y=0）に置く。Yが法線＝めくれ上がる方向。
//   四隅：A(-1,0,-1) B(1,0,-1) C(1,0,1) D(-1,0,1)（時計回り）
//
//   ステップ1：対角線A-Cで谷折り（三角形にする）
//   ステップ2：三角形の直角の頂点Bを、斜辺ACの中点に向けて谷折り
//     （新しい折り線は「AB辺の中点」P1(0,0,-1)〜「BC辺の中点」P2(1,0,0)。
//      中点連結定理により、この線で折るとBは斜辺の中点(0,0,0)にちょうど重なる）
// ============================================================
'use strict';

window.ORIGAMI_WORKS = window.ORIGAMI_WORKS || {};

ORIGAMI_WORKS.damashibune = {
  id: 'damashibune', name: 'だまし舟', emoji: '⛵', difficulty: 1,
  mesh: {
    verts: [
      // パネル0(ルート・四角形 A,P1,P2,C＝Bの角を除いた部分)
      [-1, 0, -1], [0, 0, -1], [1, 0, 0], [1, 0, 1],
      // パネル1(A,C,D＝ステップ1で回転、複製A,C)
      [-1, 0, -1], [1, 0, 1], [-1, 0, 1],
      // パネル2(P1,P2,B＝ステップ2で回転、複製P1,P2)
      [0, 0, -1], [1, 0, 0], [1, 0, -1],
    ],
    tris: [
      [0, 1, 2], [0, 2, 3], // パネル0（四角形を対角線で2三角形に）
      [4, 5, 6],            // パネル1
      [7, 8, 9],            // パネル2
    ],
    uv: [
      [0, 0], [0.5, 0], [1, 0.5], [1, 1],
      [0, 0], [1, 1], [0, 1],
      [0.5, 0], [1, 0.5], [1, 0],
    ],
    panel: [0, 0, 0, 0, 1, 1, 1, 2, 2, 2],
    boneParent: [-1, 0, 0],
    hinge: [
      null,
      { origin: [-1, 0, -1], axis: OGL.vecNorm([-2, 0, -2]) },  // A→Cの逆向き（谷折りでY+）
      { origin: [0, 0, -1], axis: OGL.vecNorm([1, 0, 1]) },      // P1→P2向き（谷折りでY+）
    ],
  },
  steps: [
    {
      id: 1,
      handle: { boneId: 1, local: [-1, 0, 1] }, // D点
      targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '対角線で谷折り',
      creaseLine: { boneId: 0, a: [-1, 0, -1], b: [1, 0, 1], kind: 'valley' },
    },
    {
      id: 2,
      handle: { boneId: 2, local: [1, 0, -1] }, // B点
      targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: 'とがった角を、まん中に合わせて谷折り',
      creaseLine: { boneId: 0, a: [0, 0, -1], b: [1, 0, 0], kind: 'valley' },
    },
  ],
  labelPoints: [
    { boneId: 2, local: [1, 0, -1], label: 'B' },
    { boneId: 1, local: [-1, 0, 1], label: 'D' },
  ],
  poseAdjust: {},
  inflate: null,
  cutSlots: [],
};
