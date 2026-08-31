// ============================================================
// problems/shiba_triangle_fold.js — 芝中学校 入試問題（灘中対策コーナー）
//
//   三角形ABCを、辺BC上の点DとAを結ぶ線(AD)で折り返したところ、
//   辺ABと辺DE(=もとの辺DCの折り返し先)が平行になった。角B=62°のとき、
//   角ADC(ア)の大きさを求めよ。
//
//   ★[[origami_mondai_genbo]]では答え未確認だったが、原本PDF(折り紙問題05.pdf
//     No.6・芝中)を読み直し、座標計算で独立に検算：
//     角ADB=y、角BAD=y（DE∥ABの錯角）、62+y+y=180よりy=59、
//     角ADC=180-59=121。実際に座標(A,B,D,C,E)を置いてDE∥ABを数値確認し、
//     E(=Cの折り返し先)がBD間の下側に来る（図と一致）ことも確認した。
//
//   座標系：DをX-Z平面の原点にとる。D(0,0,0) C(8,0,0) B(-9.7094,0,0)
//   A(-5.1504,0,8.5717)　E=(-3.7558,0,-7.0636)（Cの折り返し先）
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

ORIGAMI_PROBLEMS.shiba_triangle_fold = {
  id: 'shiba_triangle_fold',
  name: '三角形を折り返してできる角（芝中）',
  year: null, school: '芝中学校',
  examType: 'real',
  nadaGroup: 'fold',
  category: 'fold-angle',
  difficulty: 3, // 錯角＋折り返しの角の保存から二等辺三角形を発見（2段）
  promptText:
    '三角形ABCを、辺BC上の点DとAを結ぶ線で折り返したところ、辺ABと辺DEが平行になりました'
    + '（Eはもとの頂点Cが折り返された点です）。角B=62°のとき、角ADCの大きさを求めなさい。',
  mesh: {
    // 平らな折り返し問題：層を紙の厚みぶん世界の上方向へ積む（裏返った紙が
    // 土台の下に潜って見えなくなるのを防ぐ。2026-08-31 本人指摘）
    flatStack: true,
    verts: [
      // パネル0（ルート・固定側＝三角形A,B,D）
      [-5.1504, 0, 8.5717], [-9.7094, 0, 0], [0, 0, 0],
      // パネル1（動く側＝三角形A,D,C、複製A,D）
      [-5.1504, 0, 8.5717], [0, 0, 0], [8, 0, 0],
    ],
    tris: [
      [0, 1, 2], // パネル0（三角形A,B,D）
      [3, 4, 5], // パネル1（三角形A,D,C）
    ],
    uv: [
      [0.26, 1], [0, 0.45], [0.55, 0.45],
      [0.26, 1], [0.55, 0.45], [1, 0.45],
    ],
    panel: [0, 0, 0, 1, 1, 1],
    boneParent: [-1, 0],
    hinge: [
      null,
      // origin=D、axis=D→A方向（実測でCが上に持ち上がる向きと確認）
      { origin: [0, 0, 0], axis: OGL.vecNorm([-5.1504, 0, 8.5717]) },
    ],
  },
  // 折り返して隠れた「もとの紙の辺」を破線で残す（折り始めてから表示。
  // ボーン0＝動かない側に付けるので、折っても元の位置にとどまる）
  previewCreases: [
    { boneId: 0, a: [0, 0, 0], b: [8, 0, 0], kind: 'outline', afterFold: 1 }, // もとの辺DC
    { boneId: 0, a: [8, 0, 0], b: [-5.1504, 0, 8.5717], kind: 'outline', afterFold: 1 }, // もとの辺CA
  ],
  // 「どの角を答えるのか」を弧で示す
  angleMarks: [
    // 角B=62°（与えられている）
    { boneId: 0, vertex: [-9.7094, 0, 0], from: [0, 0, 0], to: [-5.1504, 0, 8.5717], label: '62°' },
    // ⑦＝角ADC（もとの三角形での、DからAとCへの角）
    { boneId: 0, vertex: [0, 0, 0], from: [-5.1504, 0, 8.5717], to: [8, 0, 0], label: '⑦' },
  ],
  steps: [
    {
      id: 1,
      handle: { boneId: 1, local: [8, 0, 0] }, // 頂点Cをつまむ
      targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
      hintLabel: 'ADを折り目にして、頂点Cを折り返す（辺DEがABと平行になるまで）',
      creaseLine: { boneId: 0, a: [-5.1504, 0, 8.5717], b: [0, 0, 0], kind: 'valley' },
    },
  ],
  labelPoints: [
    { boneId: 0, local: [-5.1504, 0, 8.5717], label: 'A' },
    { boneId: 0, local: [-9.7094, 0, 0], label: 'B' },
    { boneId: 0, local: [0, 0, 0], label: 'D' },
    // 折る前は頂点C、折り返した後はE（同じ紙の同じ角なので、名前だけが変わる）
    { boneId: 1, local: [8, 0, 0], label: 'C', foldedLabel: 'E' },
    // ★問われているのは「もとの三角形での角ADC」。折るとCの丸はEになって動いてしまい、
    //   Cがどこにあったのか分からなくなるので、動かない側にもCを置いて残す
    //   （折る前は上のCとぴったり重なるので、見た目は増えない）。2026-09-01の精査で追加。
    { boneId: 0, local: [8, 0, 0], label: 'C' },
  ],
  // ※62°は上の angleMarks が弧つきで出すので、ここには置かない（同じ数字が2つ並ぶ）
  answer: { value: 121, display: '121', unit: '度', tolerance: 0.5 },
  explanation: [
    '折り返しでCはEに移り、角ADC(=180°-角ADB)は角ADE(=角ADB、折り返しで長さも角も保たれる)に写る。',
    'AB∥DEなので、ADを横切る線として見ると、角BAD(Aでの角)と角ADE(Dでの角)は錯角の関係で等しい。',
    '角ADE＝角ADB（折り返しで保たれる角）でもあるので、角BAD＝角ADB。この角を①とおく。',
    '三角形ABDの内角の和より、62°＋①＋①＝180°。①＝59°。',
    '角ADC＝180°－角ADB＝180°－59°＝121°。',
  ],
};
