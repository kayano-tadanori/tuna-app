// ============================================================
// problems/seikyo_square_fold.js — 清教学園中学校 入試問題（灘中対策コーナー）
//
//   正方形ABCDをBEを折り目として折った。点Fは点Aが移った点。
//   CFとCDとでできる角をアとするとき、角EBFが角EBAの反対側にできる。
//   角AEB=63°のとき、角ア(=角FCD)の大きさを求めよ。
//
//   ★[[origami_mondai_genbo]]では答え未確認だったが、原本PDF(折り紙問題05.pdf
//     No.6・清教学園中)の解答ページで 18° を確認。座標計算でも独立に
//     再現：角ABE=180-(90+63)=27、角FBC=90-27×2=36、三角形BCFは
//     BF=BCの二等辺三角形なので角BCF=(180-36)/2=72、ア=90-72=18。
//
//   座標系：正方形の一辺=12。B(0,0,0) C(12,0,0) D(12,0,12) A(0,0,12)
//   E(6.1145,0,12)（AD上、角AEB=63°になる位置） F=(9.7097,0,7.0524)（Aの折り返し先）
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

ORIGAMI_PROBLEMS.seikyo_square_fold = {
  id: 'seikyo_square_fold',
  name: '正方形を折り返してできる角（清教学園）',
  year: null, school: '清教学園中学校',
  examType: 'real',
  nadaGroup: 'fold',
  category: 'fold-angle',
  difficulty: 4, // 角度チェイス3段＋BF=BCの二等辺三角形に気づく
  promptText:
    '正方形ABCDをBEを折り目として折りました。点Fは点Aが移った点です。'
    + '角AEB=63°のとき、CFとCDとでできる角（ア）の大きさを求めなさい。',
  mesh: {
    // 平らな折り返し問題：層を紙の厚みぶん世界の上方向へ積む（裏返った紙が
    // 土台の下に潜って見えなくなるのを防ぐ。2026-08-31 本人指摘）
    flatStack: true,
    verts: [
      // パネル0（ルート・固定側＝四角形B,C,D,E）
      [0, 0, 0], [12, 0, 0], [12, 0, 12], [6.1145, 0, 12],
      // パネル1（動く側＝三角形A,B,E、複製B,E）
      [0, 0, 12], [0, 0, 0], [6.1145, 0, 12],
    ],
    tris: [
      [0, 1, 2], [0, 2, 3], // パネル0（四角形BCDEを対角線B-Dで2分割）
      [4, 5, 6],            // パネル1（三角形A,B,E）
    ],
    uv: [
      [0, 0], [1, 0], [1, 1], [0.5095, 1],
      [0, 1], [0, 0], [0.5095, 1],
    ],
    panel: [0, 0, 0, 0, 1, 1, 1],
    boneParent: [-1, 0],
    hinge: [
      null,
      // origin=B、axis=E→B方向（実測でAが上に持ち上がる向きと確認）
      { origin: [0, 0, 0], axis: OGL.vecNorm([-6.1145, 0, -12]) },
    ],
  },
  // 折り返して隠れた「もとの紙の辺」を破線で残す（折り始めてから表示。
  // ボーン0＝動かない側に付けるので、折っても元の位置にとどまる）
  previewCreases: [
    { boneId: 0, a: [0, 0, 12], b: [0, 0, 0], kind: 'outline', afterFold: 1 }, // もとの辺AB
    { boneId: 0, a: [0, 0, 12], b: [6.1145, 0, 12], kind: 'outline', afterFold: 1 }, // もとの辺AE
    // ★補助線CF（本人指摘2026-09-01「CF間に破線の補助線がいる。角度アがわかりにくい」）。
    //   角ア＝角FCDの2辺のうちCFは紙の辺ではないので、線が無いとどの角か読めない。
    //   端点Fは折って動く側なので bBone:1 でパネル1の頂点A（＝折るとFになる）を指す。
    { boneId: 0, a: [12, 0, 0], b: [0, 0, 12], bBone: 1, kind: 'outline', afterFold: 1 },
  ],
  // 「どの角を答えるのか」を弧で示す
  angleMarks: [
    // 角AEB=63°（与えられている。もとの正方形での角）
    { boneId: 0, vertex: [6.1145, 0, 12], from: [0, 0, 12], to: [0, 0, 0], label: '63°' },
    // ア＝角FCD（FはAの折り返し先なのでパネル1。折ってから出す）
    // ア=18°と小さい角なので、既定の半径だと弧がCの丸に埋もれる。大きめに取る
    { boneId: 0, vertex: [12, 0, 0], from: [12, 0, 12], to: [0, 0, 12],
      toBone: 1, afterFold: 1, radius: 3.4, label: 'ア' },
  ],
  steps: [
    {
      id: 1,
      handle: { boneId: 1, local: [0, 0, 12] }, // 頂点Aをつまむ
      targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
      hintLabel: 'BEを折り目にして、頂点Aを折り返す',
      creaseLine: { boneId: 0, a: [0, 0, 0], b: [6.1145, 0, 12], kind: 'valley' },
    },
  ],
  labelPoints: [
    { boneId: 0, local: [0, 0, 0], label: 'B' },
    { boneId: 0, local: [12, 0, 0], label: 'C' },
    { boneId: 0, local: [12, 0, 12], label: 'D' },
    { boneId: 0, local: [6.1145, 0, 12], label: 'E' },
    // 折る前は頂点A、折り返した後はF（設問で「点Fは点Aが移った点」と定義されている）
    { boneId: 1, local: [0, 0, 12], label: 'A', foldedLabel: 'F' },
  ],
  // ※ 63°は上の angleMarks が弧つきで出すので、ここには置かない
  //   （両方あると同じ「63°」が2つ並んで見える。2026-09-01の精査で発見）
  answer: { value: 18, display: '18', unit: '度', tolerance: 0.5 },
  explanation: [
    '三角形ABEで、角A=90°、角AEB=63°なので、角ABE=180-90-63=27°。',
    '折り返しで角ABE(27°)は角EBF(27°)に写る。正方形の角ABC=90°なので、角FBC=90-27-27=36°。',
    '折り返しでBF=BA=BC（正方形の一辺）なので、三角形BCFはBF=BCの二等辺三角形。',
    '角BCF=(180-角FBC)÷2=(180-36)÷2=72°。',
    '正方形の角BCD=90°なので、ア（角FCD）=90-角BCF=90-72=18°。',
  ],
};
