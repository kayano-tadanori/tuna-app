// ============================================================
// problems/no5_slide_triangle.js — 折ったり重ねたり No.5（塾技ワークブック・灘中対策コーナー）
//
//   三角形ABCと三角形A'B'C'は合同。台形ABDA'の面積は42cm²。B'C'の長さを求めよ。
//   答え：B'C'=12cm　◆重ねる系（平行移動）
//
//   ★原本PDF(折り紙問題03.pdf p02の問題図・p08の解答図)を600dpiで読み直して構成を確定
//     （2026-09-01）。②は①を**右へ3cm・下へ4cm**（図のBD=3cm・DB'=4cm、斜めに5cm）
//     ずらしたもの。だから図のAA'もCC'も5cm。
//     解答図の「等積」の書きこみが、この問題の骨（合同→重なりを引いた残りも等しい）。
//
//   独立検算（答えを使わず与件だけから／scratchpad/ori/verify_new7.py）：
//     ・台形ABDA' = (AB + (AB-4))×3÷2 = 42 → AB = 16cm
//     ・A'が斜辺AC上にある（図）→ 3進んで4下がる傾き → BC = 16×3÷4 = 12cm
//     ・②は①と合同なので B'C' = BC = 12cm ✓（印刷解答と一致）
//     ・「等積」ルート（台形DB'C'C = 42）でも DC=9 → B'C'=12 と一致 ✓
//
//   座標系：2つの三角形を合わせた全体の中心を原点に（もとの座標から x-7.5, z-6）。
//     ①（固定）B(-7.5,-6) 直角  C(4.5,-6)  A(-7.5,10)
//     ②（動く）は①と同じ位置から (3,-4) 方向へ 5cm ずらすと図の配置になる
//     D(-4.5,-6)＝②の左の辺が①の底辺BCと交わる点
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

ORIGAMI_PROBLEMS.no5_slide_triangle = {
  id: 'no5_slide_triangle',
  name: '折ったり重ねたり No.5：合同な直角三角形をスライドさせて重ねる',
  year: null, school: '塾技ワークブック',
  examType: 'practice',
  nadaGroup: 'overlap',
  category: 'overlap-length',
  // 等積の発見→台形の式→B'C'=BCの気づき（3段）
  difficulty: 3,
  promptText:
    '右図で、三角形ABCと三角形A\'B\'C\'は合同である。また、台形ABDA\'の面積は42cm²である。'
    + 'このとき、B\'C\'の長さを求めなさい。'
    + '（2つめの三角形をつまんで、図のようにななめ下へずらしてみましょう）',
  mesh: {
    flatStack: true,
    verts: [
      // パネル0（①・固定）B(直角)・C・A
      [-7.5, 0, -6], [4.5, 0, -6], [-7.5, 0, 10],
      // パネル1（②・動く。ずらす前は①とぴったり重なっている）
      [-7.5, 0, -6], [4.5, 0, -6], [-7.5, 0, 10],
    ],
    tris: [
      [0, 1, 2],
      [3, 4, 5],
    ],
    uv: [
      [0, 0], [1, 0], [0, 1],
      [0, 0], [1, 0], [0, 1],
    ],
    panel: [0, 0, 0, 1, 1, 1],
    panelAlpha: [1, 0.45],
    boneParent: [-1, 0],
    hinge: [
      null,
      // ★平行移動ヒンジ：右へ3・下へ4の向き（斜辺と同じ向き）へ5cmずらす
      { origin: [-7.5, 0, -6], slide: OGL.vecNorm([3, 0, -4]) },
    ],
  },
  previewCreases: [
    { boneId: 1, a: [-7.5, 0, -6], b: [4.5, 0, -6], kind: 'outline' },
    { boneId: 1, a: [4.5, 0, -6], b: [-7.5, 0, 10], kind: 'outline' },
    { boneId: 1, a: [-7.5, 0, 10], b: [-7.5, 0, -6], kind: 'outline' },
  ],
  // 与えられている台形ABDA'（42cm²）を斜線で示す。ずらしている途中は形が変わるので
  // 重ね終わってからだけ出す
  areaMarks: [
    {
      atTarget: 1,
      points: [
        { boneId: 0, local: [-7.5, 0, 10] },  // A
        { boneId: 0, local: [-7.5, 0, -6] },  // B
        { boneId: 0, local: [-4.5, 0, -6] },  // D
        { boneId: 1, local: [-7.5, 0, 10] },  // A'（Aの移った先）
      ],
    },
  ],
  steps: [
    {
      id: 1,
      handle: { boneId: 1, local: [-7.5, 0, -6] }, // ②の直角の頂点（→B'へ動く）をつまむ
      targetAngle: 5, snapDist: 0.7, returnAngle: 0,
      hintLabel: '2つめの三角形を、斜辺にそってななめ右下へ5cmずらす（頂点A\'が①の斜辺の上にのる）',
    },
  ],
  labelPoints: [
    { boneId: 0, local: [-7.5, 0, 10], label: 'A' },
    { boneId: 0, local: [-7.5, 0, -6], label: 'B' },
    { boneId: 0, local: [4.5, 0, -6], label: 'C' },
    { boneId: 0, local: [-4.5, 0, -6], label: 'D' },
    // ②の頂点。ずらす前は①とぴったり重なるので、重ね終わってからだけ出す
    { boneId: 1, local: [-7.5, 0, 10], label: "A'", atTarget: 1 },
    { boneId: 1, local: [-7.5, 0, -6], label: "B'", atTarget: 1 },
    { boneId: 1, local: [4.5, 0, -6], label: "C'", atTarget: 1 },
  ],
  dimensionLabels: [
    // BDは辺の下、DB'は辺の右に置く（近づけすぎると自動の押しのけで上下が入れかわり、
    // 4cmがBDの寸法に見えてしまう。実測で確かめて離した）
    { boneId: 0, local: [-6.0, 0, -7.4], label: '3cm', atTarget: 1 },      // BD（横）
    { boneId: 0, local: [-3.3, 0, -8.0], label: '4cm', atTarget: 1 },      // DB'（たて）
    { boneId: 0, local: [-5.2, 0, 3.2], label: '42cm²', atTarget: 1 },     // 台形ABDA'（与えられた面積）
    { boneId: 0, local: [1.6, 0, -11.4], label: "B'C'=?", atTarget: 1 },   // 求める長さ
  ],
  answer: { value: 12, display: '12', unit: 'cm', tolerance: 0.02 },
  explanation: [
    '2つの三角形は合同なので面積が等しい。どちらからも「2つが重なっている部分」を取り去れば、残りどうしも面積が等しい。',
    "①から重なりを取った残りが台形ABDA'（42cm²）、②から取った残りが台形DB'C'C。だからこの2つの台形は面積が等しく、台形DB'C'Cも42cm²。",
    "台形DB'C'Cの平行な2辺はDCとB'C'、高さはDB'＝4cm。",
    "②は①を右へ3cm・下へ4cmずらしたものだから、B'C'＝BC。そしてBC＝BD+DC＝3+DC。つまりB'C'はDCより3cm長い。",
    "そこでDCを□とすると (□ + □+3)×4÷2＝42。左を計算して (2×□+3)×2＝42、2×□+3＝21、□＝9(cm)。",
    "B'C'＝9+3＝12(cm)。",
  ],
};
