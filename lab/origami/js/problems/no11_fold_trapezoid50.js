// ============================================================
// problems/no11_fold_trapezoid50.js — 折ったり重ねたり No.11（塾技ワークブック・灘中対策コーナー）
//
//   一辺50cmの正方形ABCDの折り紙を、辺AB上の点Gと辺DC上の点Pを結ぶ直線を折り目にして、
//   下の部分を上へ折り曲げて重ねる。頂点Bは辺AD上の点B'に移り、AG=24cm、AB'=10cm。
//   斜線部分（＝折り返した紙のうち、もとの正方形の内側にある部分）の面積は？
//
//   ★No.10と同じ骨の「第2の衣装」。3:4:5ではなく5:12:13の直角三角形で組まれている。
//     原本PDF(折り紙問題03.pdf p04の問題図・p12の解答図)を600dpiで読み直して確定（2026-09-01）。
//     答えを使わず与件だけから独立検算：
//       ・折り返しなので GB'=GB=50-24=26、AG=24 → AB'=√(676-576)=10 ✓（図の10cmと一致）
//       ・折り目GPは線分BB'の垂直二等分線 → 右辺との交点 P(50,34) → PC=16 ✓（印刷解答 x=16）
//       ・斜線＝台形GBCP 1050 − はみ出した三角形RC'P 160/3 ＝ 996と2/3 ✓（印刷解答と一致）
//
//   座標系：正方形の中心を原点に。A(-25,25) D(25,25) C(25,-25) B(-25,-25)
//   G(-25,1)  P(25,-9)  折り返すとB→(-15,25)＝B'、C→(31.15,5.77)＝C'
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

ORIGAMI_PROBLEMS.no11_fold_trapezoid50 = {
  id: 'no11_fold_trapezoid50',
  name: '折ったり重ねたり No.11：折り曲げて重ねる（一辺50cm）',
  year: null, school: '塾技ワークブック',
  examType: 'practice',
  nadaGroup: 'fold',
  category: 'fold-symmetry',
  difficulty: 4, // 5:12:13の相似3連鎖＋はみ出した三角形を引く（4段）
  promptText:
    '一辺の長さが50cmの正方形ABCDの折り紙を、辺AB上の点Gと辺DC上の点Pを結ぶ直線を折り目にして、'
    + '下の部分を上へ折り曲げて重ねました。頂点Bは辺AD上の点B\'に、頂点Cは点C\'に移り、'
    + 'AG=24cm、AB\'=10cmです。斜線部分の面積を求めなさい。',
  mesh: {
    flatStack: true,
    verts: [
      // パネル0（固定側＝上の台形 G,P,D,A）
      [-25, 0, 1], [25, 0, -9], [25, 0, 25], [-25, 0, 25],
      // パネル1（動く側＝下の台形 B,C,P,G）
      [-25, 0, -25], [25, 0, -25], [25, 0, -9], [-25, 0, 1],
    ],
    tris: [
      [0, 1, 2], [0, 2, 3],
      [4, 5, 6], [4, 6, 7],
    ],
    // u=(x+25)/50, v=(z+25)/50
    uv: [
      [0, 0.52], [1, 0.32], [1, 1], [0, 1],
      [0, 0], [1, 0], [1, 0.32], [0, 0.52],
    ],
    panel: [0, 0, 0, 0, 1, 1, 1, 1],
    boneParent: [-1, 0],
    hinge: [
      null,
      // origin=G、axis=G→P。外積のY成分 uz*vx-ux*vz = 130/√26 > 0 ＝谷折り
      { origin: [-25, 0, 1], axis: OGL.vecNorm([50, 0, -10]) },
    ],
  },
  previewCreases: [
    { boneId: 0, a: [-25, 0, 1], b: [-25, 0, -25], kind: 'outline', afterFold: 1 },  // もとの辺GB
    { boneId: 0, a: [-25, 0, -25], b: [25, 0, -25], kind: 'outline', afterFold: 1 }, // もとの辺BC
    { boneId: 0, a: [25, 0, -25], b: [25, 0, -9], kind: 'outline', afterFold: 1 },   // もとの辺CP
  ],
  // 斜線部分＝折り返した紙のうち、もとの正方形からはみ出さない部分（原本の図で確認。
  // No.10と違い、右下のはみ出た三角形には斜線が引かれていない）。
  // ボーン1のローカル座標＝折る前の位置で書いてあるので、折るとそのまま紙についてくる。
  areaMarks: [
    {
      points: [
        { boneId: 1, local: [-25, 0, 1] },              // G
        { boneId: 1, local: [-25, 0, -25] },            // B → B'
        { boneId: 1, local: [55 / 3, 0, -25] },         // R（B'C'が辺DCと交わる点）の折り返し前
        { boneId: 1, local: [25, 0, -9] },              // P
      ],
    },
  ],
  steps: [
    {
      id: 1,
      handle: { boneId: 1, local: [-25, 0, -25] }, // 頂点Bをつまむ
      targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
      hintLabel: '折り目GPで、下の部分を上へ折り返す（頂点Bが辺ADの上にのる）',
      creaseLine: { boneId: 0, a: [-25, 0, 1], b: [25, 0, -9], kind: 'valley' },
    },
  ],
  labelPoints: [
    { boneId: 0, local: [-25, 0, 25], label: 'A' },
    { boneId: 0, local: [25, 0, 25], label: 'D' },
    { boneId: 0, local: [-25, 0, 1], label: 'G' },
    { boneId: 0, local: [25, 0, -9], label: 'P' },
    { boneId: 1, local: [-25, 0, -25], label: 'B', foldedLabel: "B'" },
    { boneId: 1, local: [25, 0, -25], label: 'C', foldedLabel: "C'" },
  ],
  dimensionLabels: [
    { boneId: 0, local: [0, 0, 32], label: '正方形：一辺50cm' },
    // AG=24cmは折る前からの与件（左辺の外側）
    { boneId: 0, local: [-28, 0, 13], label: '24cm' },
    // AB'=10cmは折ってはじめて現れる長さ（上辺の内側に置く）
    { boneId: 0, local: [-16, 0, 17], label: '10cm', afterFold: 1 },
  ],
  answer: { value: 2990 / 3, display: '996と2/3', unit: 'cm²', tolerance: 0.02 },
  explanation: [
    '折り返しても紙の長さは変わらないので、GB\'=GB=50-24=26cm。',
    'AG=24cm、AB\'=10cm、GB\'=26cmだから、三角形AB\'Gは辺の比が5:12:13の直角三角形（10:24:26＝5:12:13）。',
    '折り返した辺B\'C\'（もとの辺BC）は50cmで、角B\'は直角のまま。B\'C\'が辺DCと交わる点をRとすると、三角形B\'DRは三角形AB\'Gと同じ形。B\'D=50-10=40cmなので、B\'R=40×13÷12=130/3cm。',
    'するとRC\'=50-130/3=20/3cm。三角形RC\'Pもまた同じ形なので、PC\'=20/3×12÷5=16cm。折り返す前の長さもPC=16cm。',
    '折り返した紙は台形GBCPで、面積は(26+16)×50÷2＝1050cm²。',
    'ただし斜線部分は、そのうち正方形の外へはみ出した三角形RC\'Pをのぞいた部分。この三角形は角C\'が直角で、RC\'=20/3cm、PC\'=16cmだから面積は20/3×16÷2＝160/3cm²。',
    '1050-160/3＝996と2/3cm²。',
  ],
};
