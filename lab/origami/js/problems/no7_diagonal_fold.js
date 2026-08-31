// ============================================================
// problems/no7_diagonal_fold.js — 折ったり重ねたり No.7（塾技ワークブック・灘中対策コーナー）
//
//   長方形ABCD（AD=96cm、AB=48cm）を対角線BDで折り返す。
//   折り返した辺DA（→DA'）が辺BCと交わる点をE、Aの折り返し先をA'とする。
//   問い：(1)BEの長さ (2)EDの長さ (3)三角形BA'Eの面積
//
//   ★[[origami_mondai_genbo]]原簿には答え(864cm²)のみ記録されていたが、
//     原本PDF(折り紙問題03.pdf No.7)を読み直し、AB=48・AD=96・EC=36の
//     実測値を確認。座標計算で BE=ED=60・面積864 を独立に検算し、
//     EC=36(=96-60)が図の数値と厳密に一致することも確認した。
//
//   座標系はworksと同じくXZ平面(Y=法線)。中心を原点にとる。
//   A(-48,0,24) D(48,0,24) B(-48,0,-24) C(48,0,-24)
//   E(12,0,-24)（BC上、BE=60） A'=(-9.6,0,-52.8)（Aの折り返し先）
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

ORIGAMI_PROBLEMS.no7_diagonal_fold = {
  id: 'no7_diagonal_fold',
  name: '折ったり重ねたり No.7：対角線で折り返す',
  year: null, school: '塾技ワークブック',
  examType: 'practice',
  nadaGroup: 'fold',
  category: 'fold-symmetry',
  difficulty: 3, // 錯角→二等辺三角形の発見→合同な三角形の面積（3段）
  promptText:
    '長方形ABCD（AD=96cm、AB=48cm）を、対角線BDを折り目として折り返しました。'
    + '折り返した辺（もとの辺DA）は辺BC上の点Eを通ります。Aが移った点をA\'とします。'
    + 'BE、ED の長さを考えたうえで、三角形BA\'Eの面積を求めなさい。',
  mesh: {
    // 平らな折り返し問題：層を紙の厚みぶん世界の上方向へ積む（裏返った紙が
    // 土台の下に潜って見えなくなるのを防ぐ。2026-08-31 本人指摘）
    flatStack: true,
    verts: [
      // パネル0（ルート・固定側＝三角形B,D,C）
      [-48, 0, -24], [48, 0, 24], [48, 0, -24],
      // パネル1（動く側＝三角形A,B,D、複製B,D）
      [-48, 0, 24], [-48, 0, -24], [48, 0, 24],
    ],
    tris: [
      [0, 1, 2], // パネル0（三角形B,D,C）
      [3, 4, 5], // パネル1（三角形A,B,D）
    ],
    uv: [
      [0, 0], [1, 1], [1, 0],
      [0, 1], [0, 0], [1, 1],
    ],
    panel: [0, 0, 0, 1, 1, 1],
    boneParent: [-1, 0],
    hinge: [
      null,
      // origin=B、axis=D→Bの逆向き（実測でAが上に持ち上がる向きと確認）
      { origin: [-48, 0, -24], axis: OGL.vecNorm([-96, 0, -48]) },
    ],
  },
  // 折り返して隠れた「もとの紙の辺」を破線で残す（折り始めてから表示）。
  // ボーン0（動かない側）に付けるので、折っても元の位置にとどまる。
  previewCreases: [
    { boneId: 0, a: [-48, 0, 24], b: [-48, 0, -24], kind: 'outline', afterFold: 1 }, // もとの辺AB
    { boneId: 0, a: [-48, 0, 24], b: [48, 0, 24], kind: 'outline', afterFold: 1 },   // もとの辺AD
  ],
  // 求める面積＝三角形BA'E（A'は折り返し後のAなのでパネル1の点）
  areaMarks: [
    { afterFold: 1, points: [
      { boneId: 0, local: [-48, 0, -24] },   // B
      { boneId: 1, local: [-48, 0, 24] },    // A'（折り返し後のA）
      { boneId: 0, local: [12, 0, -24] },    // E
    ] },
  ],
  steps: [
    {
      id: 1,
      handle: { boneId: 1, local: [-48, 0, 24] }, // 頂点Aをつまむ
      targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
      hintLabel: '対角線BDを折り目にして、頂点Aが下に重なるように折り返す',
      creaseLine: { boneId: 0, a: [-48, 0, -24], b: [48, 0, 24], kind: 'valley' },
    },
  ],
  labelPoints: [
    // 折る前は頂点A、折り返した後はA'（設問で「Aが移った点をA'」と定義されている）
    { boneId: 1, local: [-48, 0, 24], label: 'A', foldedLabel: 'A\'' },
    { boneId: 0, local: [-48, 0, -24], label: 'B' },
    { boneId: 1, local: [48, 0, 24], label: 'D' },
    { boneId: 0, local: [48, 0, -24], label: 'C' },
    { boneId: 0, local: [12, 0, -24], label: 'E' },
  ],
  dimensionLabels: [
    { boneId: 1, local: [-48, 0, 0], label: 'AB=48cm' },
    { boneId: 1, local: [0, 0, 24], label: 'AD=96cm' },
    { boneId: 0, local: [-18, 0, -24], label: 'BE=60cm' },
  ],
  answer: { value: 864, display: '864', unit: 'cm²', tolerance: 0.5 },
  explanation: [
    '対角線BDで折ると、AD∥BC（長方形の性質）とBDが共通なので、錯角より角ADB=角DBC。',
    '折り返しは角ADBをそのまま角A\'DB（=角EDB）に写すので、角EDB=角DBEとなり、三角形BEDは二等辺三角形（BE=ED）。',
    'AD=96、EC=96-60=36なので、BE=96-36=60cm、ED=BE=60cm。',
    '三角形BA\'Eは折り返しで三角形DCEと合同（対応する辺がそれぞれ等しい）になる。',
    'DC=AB=48cm、EC=36cmなので、面積＝36×48÷2＝864cm²。',
  ],
};
