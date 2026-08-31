// ============================================================
// problems/no8_diagonal_fold.js — 折ったり重ねたり No.8（塾技ワークブック・灘中対策コーナー）
//
//   長方形ABCDを対角線ACで折り返す。頂点Dが移った点をEとし、
//   折り返した辺（もとの辺AD）が辺BCと交わる点をFとする。
//   BF=5cm、FC=13cm、EC=12cmが与えられている。
//   問い：(1)AD(=BC)の長さ (2)長方形ABCDの面積
//
//   ★原本PDF(折り紙問題03.pdf No.8)を読み直し、BF=5・FC=13・EC=12を確認。
//     座標計算で「AB=EC=12（Cを軸に折るのでCE=CD=AB）」「BC=BF+FC=18」
//     「線分AEがF(5,0)を通る」を全て独立に検算し、面積216を確認した。
//
//   座標系：中心を原点。A(-9,0,6) B(-9,0,-6) C(9,0,-6) D(9,0,6)
//   F(-4,0,-6)（BC上、BF=5）　E=(90/13-9, -60/13-6)（Dの折り返し先）
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

ORIGAMI_PROBLEMS.no8_diagonal_fold = {
  id: 'no8_diagonal_fold',
  name: '折ったり重ねたり No.8：対角線で折り返す②',
  year: null, school: '塾技ワークブック',
  examType: 'practice',
  nadaGroup: 'fold',
  category: 'fold-symmetry',
  difficulty: 4, // 二等辺三角形の発見＋5:12:13の直角三角形（4段）
  promptText:
    '長方形ABCDを、対角線ACを折り目として折り返しました。頂点Dが移った点をEとします。'
    + '折り返した辺（もとの辺AD）は辺BC上の点Fを通ります。BF=5cm、FC=13cm、EC=12cmのとき、'
    + '長方形ABCDの面積を求めなさい。',
  mesh: {
    // 平らな折り返し問題：層を紙の厚みぶん世界の上方向へ積む（裏返った紙が
    // 土台の下に潜って見えなくなるのを防ぐ。2026-08-31 本人指摘）
    flatStack: true,
    verts: [
      // パネル0（ルート・固定側＝三角形A,B,C）
      [-9, 0, 6], [-9, 0, -6], [9, 0, -6],
      // パネル1（動く側＝三角形A,C,D、複製A,C）
      [-9, 0, 6], [9, 0, -6], [9, 0, 6],
    ],
    tris: [
      [0, 1, 2], // パネル0（三角形A,B,C）
      [3, 4, 5], // パネル1（三角形A,C,D）
    ],
    uv: [
      [0, 1], [0, 0], [1, 0],
      [0, 1], [1, 0], [1, 1],
    ],
    panel: [0, 0, 0, 1, 1, 1],
    boneParent: [-1, 0],
    hinge: [
      null,
      // origin=A、axis=C→Aの逆向き（実測でDが上に持ち上がる向きと確認）
      { origin: [-9, 0, 6], axis: OGL.vecNorm([-18, 0, 12]) },
    ],
  },
  // 折り返して隠れた「もとの紙の辺」を破線で残す（折り始めてから表示。
  // ボーン0＝動かない側に付けるので、折っても元の位置にとどまる）
  previewCreases: [
    { boneId: 0, a: [-9, 0, 6], b: [9, 0, 6], kind: 'outline', afterFold: 1 }, // もとの辺AD
    { boneId: 0, a: [9, 0, -6], b: [9, 0, 6], kind: 'outline', afterFold: 1 }, // もとの辺CD
    // ★辺FC（本人指摘2026-09-01「紙が重なった後、辺FCは破線を引かないとわかりにくい」）。
    //   折り返した三角形ACEが下辺BCのF〜Cの区間に覆いかぶさって隠れるため、破線で残す。
    { boneId: 0, a: [-4, 0, -6], b: [9, 0, -6], kind: 'outline', afterFold: 1 },
  ],
  steps: [
    {
      id: 1,
      handle: { boneId: 1, local: [9, 0, 6] }, // 頂点Dをつまむ
      targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
      hintLabel: '対角線ACを折り目にして、頂点Dが下に重なるように折り返す',
      creaseLine: { boneId: 0, a: [-9, 0, 6], b: [9, 0, -6], kind: 'valley' },
    },
  ],
  labelPoints: [
    { boneId: 0, local: [-9, 0, 6], label: 'A' },
    { boneId: 0, local: [-9, 0, -6], label: 'B' },
    { boneId: 0, local: [9, 0, -6], label: 'C' },
    // 折る前は頂点D、折り返した後はE（設問で「Dが移った点をE」と定義されている）
    { boneId: 1, local: [9, 0, 6], label: 'D', foldedLabel: 'E' },
    { boneId: 0, local: [-4, 0, -6], label: 'F' },
  ],
  // 寸法ラベルは辺の"外側"に置く。辺の上に置くと点のラベル（F）と重なって
  // 文字が読めなくなる（本人指摘2026-09-01「Fの記号にBF=5cmがかぶさってFが見えない」）
  dimensionLabels: [
    // 辺BCの外側(z<-6)は折り返した紙が来るので、BF/FCは内側に置く
    { boneId: 0, local: [-6.5, 0, -7.6], label: 'BF=5cm' },
    { boneId: 0, local: [2.5, 0, -4.4], label: 'FC=13cm' },
    // EC=12cmも設問で与えられている数値。折り返してはじめて辺CEになる（折る前は辺CD）
    // ので、折ってから出す。位置は辺CDの中点＝折るとCEの中点に来る
    { boneId: 1, local: [9, 0, 0], label: 'EC=12cm', afterFold: 1 },
  ],
  answer: { value: 216, display: '216', unit: 'cm²', tolerance: 0.5 },
  explanation: [
    'BF=5cm、FC=13cmが与えられているので、AD(=BC)=BF+FC=5+13=18cm。',
    '対角線ACで折るとき、Cは動かないので、辺CD（もとの辺）は辺CEに写る。よってCE=CD。',
    'CE=12cmが与えられているので、CD=12cm。CD=AB（長方形の対辺）なので、AB=12cm。',
    '長方形ABCDの面積＝AB×AD＝12×18＝216cm²。',
  ],
};
