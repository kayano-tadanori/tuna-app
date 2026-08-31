// ============================================================
// problems/no14_double_fold.js — 折ったり重ねたり No.14（塾技ワークブック・灘中対策コーナー・★二段折り）
//
//   AB=8cm、AD=6cmの長方形の紙ABCD。辺BC上に点Eをとり、AEを折り目として
//   三角形ABEを折り曲げ、さらに辺CD上に点Fをとり、EFを折り目として三角形FCEを
//   折り曲げたところ、点Bと点Cがぴったり重なった。BE、CFの長さを求めよ。
//
//   ★[[origami_mondai_genbo]]の「二段折りの発見算」。2回の折りで2点を一致させる型。
//     原本PDF(折り紙問題03.pdf No.14)で BE=3cm・CF=1と1/8cm を確認。
//     座標計算で「AP=8(=AB)・EP=3(=EB=EC)からPを求めると、FP=9/8が
//     独立に一致する」ことまで検算し、原本の数値と完全に一致した。
//
//   座標系：中心を原点。B(-3,0,-4) C(3,0,-4) A(-3,0,4) D(3,0,4)
//   E(0,0,-4)（BC中点） F(3,0,-2.875)（CD上、CF=9/8）
//   P=(2.2603,0,-2.0273)（BとCが重なる点）
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

ORIGAMI_PROBLEMS.no14_double_fold = {
  id: 'no14_double_fold',
  name: '折ったり重ねたり No.14：二段折りでBとCを重ねる',
  year: null, school: '塾技ワークブック',
  examType: 'practice',
  nadaGroup: 'fold',
  category: 'fold-symmetry',
  difficulty: 5, // 二段折りで2点を一致させる発見算＋相似2段
  promptText:
    'AB=8cm、AD=6cmの長方形の紙ABCDがあります。辺BC上に点Eをとり、AEを折り目として'
    + '三角形ABEを折り曲げ、さらに辺CD上に点Fをとり、EFを折り目として三角形FCEを'
    + '折り曲げたところ、点Bと点Cがぴったり重なりました。CFの長さを求めなさい。'
    + '（ヒント：まずBEの長さを考えましょう）',
  mesh: {
    // 平らな折り返し問題：層を紙の厚みぶん世界の上方向へ積む（裏返った紙が
    // 土台の下に潜って見えなくなるのを防ぐ。2026-08-31 本人指摘）
    flatStack: true,
    verts: [
      // パネル0（ルート・固定側＝四角形A,E,F,D）
      [-3, 0, 4], [0, 0, -4], [3, 0, -2.875], [3, 0, 4],
      // パネル1（動く側＝三角形A,B,E、複製A,E）
      [-3, 0, 4], [-3, 0, -4], [0, 0, -4],
      // パネル2（動く側＝三角形E,C,F、複製E,F）
      [0, 0, -4], [3, 0, -4], [3, 0, -2.875],
    ],
    tris: [
      [0, 1, 2], [0, 2, 3], // パネル0（四角形AEFDを対角線A-Fで2分割）
      [4, 5, 6],            // パネル1（三角形A,B,E）
      [7, 8, 9],            // パネル2（三角形E,C,F）
    ],
    uv: [
      [0, 1], [0.5, 0], [1, 0.140625], [1, 1],
      [0, 1], [0, 0], [0.5, 0],
      [0.5, 0], [1, 0], [1, 0.140625],
    ],
    panel: [0, 0, 0, 0, 1, 1, 1, 2, 2, 2],
    boneParent: [-1, 0, 0],
    hinge: [
      null,
      // origin=A、axis=A→E方向（実測でBが上に持ち上がる向きと確認）
      { origin: [-3, 0, 4], axis: OGL.vecNorm([3, 0, -8]) },
      // origin=E、axis=E→F方向（実測でCが上に持ち上がる向きと確認）
      { origin: [0, 0, -4], axis: OGL.vecNorm([3, 0, 1.125]) },
    ],
  },
  // 折り返して隠れた「もとの紙の辺」を破線で残す（折り始めてから表示。
  // ボーン0＝動かない側に付けるので、折っても元の位置にとどまる）
  previewCreases: [
    { boneId: 0, a: [-3, 0, 4], b: [-3, 0, -4], kind: 'outline', afterFold: 1 }, // もとの辺AB
    { boneId: 0, a: [-3, 0, -4], b: [0, 0, -4], kind: 'outline', afterFold: 1 }, // もとの辺BE
    { boneId: 0, a: [0, 0, -4], b: [3, 0, -4], kind: 'outline', afterFold: 2 }, // もとの辺EC
    { boneId: 0, a: [3, 0, -4], b: [3, 0, -2.875], kind: 'outline', afterFold: 2 }, // もとの辺CF
  ],
  steps: [
    {
      id: 1,
      handle: { boneId: 1, local: [-3, 0, -4] }, // 頂点Bをつまむ
      targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
      hintLabel: 'AEを折り目にして、三角形ABEを折り曲げる',
      creaseLine: { boneId: 0, a: [-3, 0, 4], b: [0, 0, -4], kind: 'valley' },
    },
    {
      id: 2,
      handle: { boneId: 2, local: [3, 0, -4] }, // 頂点Cをつまむ
      targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
      hintLabel: 'EFを折り目にして、三角形FCEを折り曲げる（点Bにぴったり重ねる）',
      creaseLine: { boneId: 0, a: [0, 0, -4], b: [3, 0, -2.875], kind: 'valley' },
    },
  ],
  labelPoints: [
    { boneId: 0, local: [-3, 0, 4], label: 'A' },
    { boneId: 0, local: [3, 0, 4], label: 'D' },
    { boneId: 0, local: [0, 0, -4], label: 'E' },
    { boneId: 0, local: [3, 0, -2.875], label: 'F' },
    { boneId: 1, local: [-3, 0, -4], label: 'B' },
    // 折るとCはBとぴったり重なる（設問そのもの）。重なった1点は名前をBに統一して、
    // 下のもとの位置のCと見分けられるようにする
    { boneId: 2, local: [3, 0, -4], label: 'C', foldedLabel: 'B' },
    // ★求めるのは「もとの紙でのCFの長さ」。折るとCの丸はBと重なる位置へ動いてしまい、
    //   どこからどこまでがCFなのか分からなくなるので、動かない側にもCを残す
    //   （折る前は上のCと重なるので見た目は増えない）。2026-09-01の精査で追加。
    { boneId: 0, local: [3, 0, -4], label: 'C' },
  ],
  dimensionLabels: [
    { boneId: 1, local: [-3, 0, 0], label: 'AB=8cm' },
    { boneId: 0, local: [0, 0, 4], label: 'AD=6cm' },
    // 求める長さがどの線分なのかを示す（もとの辺CFはpreviewCreasesで破線が出ている）
    { boneId: 0, local: [4.2, 0, -3.44], label: 'CF=?' },
  ],
  answer: { value: 1.125, display: '1と1/8', unit: 'cm', tolerance: 0.02 },
  explanation: [
    '1回目の折りでBはEを中心に回転してEP（Pは重なる点）に写り、2回目の折りでCも同じくEを中心に回転してEPに写る。',
    'つまりEBとECは同じ長さEPに写るので、EB=EC。BC=AD=6cmだから、EB=EC=3cm。',
    '折り返しで長さは変わらないので、AP=AB=8cm、EP=EB=3cm。もとの角Bが90°だったので、角APEも90°のまま残る。',
    '三角形APEと三角形FPEは、Pのまわりの直角となりあう三角形として相似になる（角の対応から）。',
    '相似比はEP:AP＝3:8なので、CF＝EC×(EP÷AP)＝3×(3/8)＝9/8＝1と1/8cm。',
  ],
};
