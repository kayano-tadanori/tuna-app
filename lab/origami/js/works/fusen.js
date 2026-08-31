// ============================================================
// works/fusen.js — ふうせん（水風船・膨らませ機能の最小実装対象）
//
//   本来の「水風船（四角基本形＋ふくらませ）」は、十字の谷折り筋＋対角線の
//   山折り筋を同時に使う複雑な折りたたみで、今回のヒンジ逐次モデルでは
//   1回では表現しづらい。一方、だまし舟の2ステップ（対角線で三角形に→
//   頂点を斜辺の中点に折る）は、実は四角基本形の途中経過と同じ構造。
//   これに「膨らませ」パラメータを足すことで、伝承の水風船遊びの
//   体験（ふうっと息を吹き込むと立体になる）を再現する。
// ============================================================
'use strict';

window.ORIGAMI_WORKS = window.ORIGAMI_WORKS || {};

ORIGAMI_WORKS.fusen = {
  id: 'fusen', name: 'ふうせん', emoji: '🎈', difficulty: 2,
  mesh: {
    verts: [
      [-1, 0, -1], [0, 0, -1], [1, 0, 0], [1, 0, 1],
      [-1, 0, -1], [1, 0, 1], [-1, 0, 1],
      [0, 0, -1], [1, 0, 0], [1, 0, -1],
    ],
    tris: [
      [0, 1, 2], [0, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
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
      { origin: [-1, 0, -1], axis: OGL.vecNorm([-2, 0, -2]) },
      { origin: [0, 0, -1], axis: OGL.vecNorm([1, 0, 1]) },
    ],
    // パネルごとの膨らむ向き（0=固定底、+1/-1=互い違いに持ち上がって空気が入ったように見せる）
    inflateSign: [-1, 1, 1],
  },
  steps: [
    {
      id: 1,
      handle: { boneId: 1, local: [-1, 0, 1] },
      targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '対角線で谷折り',
      creaseLine: { boneId: 0, a: [-1, 0, -1], b: [1, 0, 1], kind: 'valley' },
    },
    {
      id: 2,
      handle: { boneId: 2, local: [1, 0, -1] },
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
  inflate: { min: 0, max: 1, default: 0 },
  cutSlots: [],
};
