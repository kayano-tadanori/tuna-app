// ============================================================
// works/yakko.js — やっこさん（座布団折り×2の検証作品）
//
//   正方形頂点：A(-1,-1) B(1,-1) C(1,1) D(-1,1)、辺の中点：
//     M_AB(0,-1) M_BC(1,0) M_CD(0,1) M_DA(-1,0)
//
//   ステップ1〜4：座布団折り1回目。4つの角を中心へ谷折り
//     （角Aのフラップ＝三角形A,M_AB,M_DA　を M_AB-M_DA 線で折る…以下同様）
//     折った後に残る「内側正方形」の頂点はちょうど M_AB,M_BC,M_CD,M_DA になる。
//   ステップ5〜8：座布団折り2回目。内側正方形をさらに4分割し
//     （中心の小正方形 (±0.5,±0.5) と4つの縁の三角形）、縁の三角形を中心へ谷折り。
//     ★1回目のフラップ(パネル1-4)は「2回目で動く縁の三角形(パネル5-8)」を
//       親ボーンとして持つ（フラット時は角度0の縁三角形の上にフラップが乗っている、
//       という位置関係をボーン階層でそのまま表現する）。
// ============================================================
'use strict';

window.ORIGAMI_WORKS = window.ORIGAMI_WORKS || {};

const V = OGL.vecNorm;

// ★座布団折り×2で「風車型」の中間形まで実装。実際のやっこさん(人型)にするには
//   この先に観音開き・袖折り・裾折りが要るが未実装（将来の追加ステップ候補）。
ORIGAMI_WORKS.yakko = {
  id: 'yakko', name: 'やっこさん（座布団折り）', emoji: '🎐', difficulty: 1,
  mesh: {
    verts: [
      // パネル0(ルート・中心の小正方形 0.5,-0.5 / 0.5,0.5 / -0.5,0.5 / -0.5,-0.5)
      [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [-0.5, 0, -0.5],
      // パネル5(親0・縁の三角形 M_AB側)
      [0, 0, -1], [0.5, 0, -0.5], [-0.5, 0, -0.5],
      // パネル6(親0・縁の三角形 M_BC側)
      [1, 0, 0], [0.5, 0, 0.5], [0.5, 0, -0.5],
      // パネル7(親0・縁の三角形 M_CD側)
      [0, 0, 1], [-0.5, 0, 0.5], [0.5, 0, 0.5],
      // パネル8(親0・縁の三角形 M_DA側)
      [-1, 0, 0], [-0.5, 0, -0.5], [-0.5, 0, 0.5],
      // パネル1(親5・フラップA)
      [-1, 0, -1], [0, 0, -1], [-1, 0, 0],
      // パネル2(親6・フラップB)
      [1, 0, -1], [1, 0, 0], [0, 0, -1],
      // パネル3(親7・フラップC)
      [1, 0, 1], [0, 0, 1], [1, 0, 0],
      // パネル4(親8・フラップD)
      [-1, 0, 1], [-1, 0, 0], [0, 0, 1],
    ],
    tris: [
      [0, 1, 2], [0, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
      [10, 11, 12],
      [13, 14, 15],
      [16, 17, 18],
      [19, 20, 21],
      [22, 23, 24],
      [25, 26, 27],
    ],
    uv: [
      [0.75, 0.25], [0.75, 0.75], [0.25, 0.75], [0.25, 0.25],
      [0.5, 0], [0.75, 0.25], [0.25, 0.25],
      [1, 0.5], [0.75, 0.75], [0.75, 0.25],
      [0.5, 1], [0.25, 0.75], [0.75, 0.75],
      [0, 0.5], [0.25, 0.25], [0.25, 0.75],
      [0, 0], [0.5, 0], [0, 0.5],
      [1, 0], [1, 0.5], [0.5, 0],
      [1, 1], [0.5, 1], [1, 0.5],
      [0, 1], [0, 0.5], [0.5, 1],
    ],
    panel: [0, 0, 0, 0, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4],
    boneParent: [-1, 5, 6, 7, 8, 0, 0, 0, 0],
    hinge: [
      null,
      { origin: [0, 0, -1], axis: V([1, 0, -1]) },   // フラップA：M_AB、軸=M_AB→M_DA方向
      { origin: [1, 0, 0], axis: V([1, 0, 1]) },      // フラップB：M_BC
      { origin: [0, 0, 1], axis: V([-1, 0, 1]) },     // フラップC：M_CD
      { origin: [-1, 0, 0], axis: V([-1, 0, -1]) },   // フラップD：M_DA
      { origin: [0.5, 0, -0.5], axis: [1, 0, 0] },    // 縁三角形5
      { origin: [0.5, 0, 0.5], axis: [0, 0, 1] },     // 縁三角形6
      { origin: [-0.5, 0, 0.5], axis: [-1, 0, 0] },   // 縁三角形7
      { origin: [-0.5, 0, -0.5], axis: [0, 0, -1] },  // 縁三角形8
    ],
  },
  steps: [
    { id: 1, handle: { boneId: 1, local: [-1, 0, -1] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '角Aを、まん中に合わせて谷折り（1）',
      creaseLine: { boneId: 5, a: [0, 0, -1], b: [-1, 0, 0], kind: 'valley' } },
    { id: 2, handle: { boneId: 2, local: [1, 0, -1] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '角Bを、まん中に合わせて谷折り（2）',
      creaseLine: { boneId: 6, a: [1, 0, 0], b: [0, 0, -1], kind: 'valley' } },
    { id: 3, handle: { boneId: 3, local: [1, 0, 1] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '角Cを、まん中に合わせて谷折り（3）',
      creaseLine: { boneId: 7, a: [0, 0, 1], b: [1, 0, 0], kind: 'valley' } },
    { id: 4, handle: { boneId: 4, local: [-1, 0, 1] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: '角Dを、まん中に合わせて谷折り（4・座布団折り1回目 かんせい）',
      creaseLine: { boneId: 8, a: [-1, 0, 0], b: [0, 0, 1], kind: 'valley' } },
    { id: 5, handle: { boneId: 5, local: [0, 0, -1] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: 'もう一回、まん中に合わせて谷折り（5）',
      creaseLine: { boneId: 0, a: [0.5, 0, -0.5], b: [-0.5, 0, -0.5], kind: 'valley' } },
    { id: 6, handle: { boneId: 6, local: [1, 0, 0] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: 'もう一回、まん中に合わせて谷折り（6）',
      creaseLine: { boneId: 0, a: [0.5, 0, 0.5], b: [0.5, 0, -0.5], kind: 'valley' } },
    { id: 7, handle: { boneId: 7, local: [0, 0, 1] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: 'もう一回、まん中に合わせて谷折り（7）',
      creaseLine: { boneId: 0, a: [-0.5, 0, 0.5], b: [0.5, 0, 0.5], kind: 'valley' } },
    { id: 8, handle: { boneId: 8, local: [-1, 0, 0] }, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
      hintLabel: 'もう一回、まん中に合わせて谷折り（8・かざぐるま型のできあがり）',
      creaseLine: { boneId: 0, a: [-0.5, 0, -0.5], b: [0.5, 0, -0.5], kind: 'valley' } },
  ],
  labelPoints: [
    { boneId: 1, local: [-1, 0, -1], label: 'A' },
    { boneId: 2, local: [1, 0, -1], label: 'B' },
    { boneId: 3, local: [1, 0, 1], label: 'C' },
    { boneId: 4, local: [-1, 0, 1], label: 'D' },
  ],
  poseAdjust: {},
  inflate: null,
  cutSlots: [],
};
