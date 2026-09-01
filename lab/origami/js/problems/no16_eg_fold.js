// ============================================================
// problems/no16_eg_fold.js — 折ったり重ねたり No.16（塾技ワークブック・灘中対策コーナー）
//
//   BC=36cm、CD=24cmの長方形ABCDを、EGを折り目として折る。
//   BE=5cm、BF=12cm、AF=6cm のとき、(1)CHの長さ (2)AGの長さ (3)台形GHCDの面積。
//   原本の答え：(1) 17.5cm (2) 28.5cm (3) 300cm²
//
//   ★[[origami_mondai_genbo]]A節No.16。2026-09-01、原本（`折り紙問題03.pdf` の
//     問題ページp06・解答ページp14）を500dpiで読み直して**構造を確定した**。
//     旧原簿は「点Fは三角不等式に反する」として実装を見送っていたが、それは
//     「Aは長方形の左上の角」という前提のとりちがえだった。**原本の図では
//     B・F・H・A(=折り返し後のA)・C が下辺の上に並んでいる**——つまり
//     「AF=6cm」は折り返してできた点A'と点Fの距離であって、矛盾は無い。
//
//   ★構造：E＝辺AB上（BE=5cm）、G＝辺AD上。EGを折り目に三角形AEGを折り返すと、
//     Aは長方形の外（下辺のさらに下）へ出る。
//     F＝折り返した辺EA'と辺BCの交点、H＝折り返した辺GA'と辺BCの交点。
//
//   ★座標の独立検算（答えを使わず、BF=12cmだけからAGを二分法で解いた）：
//       AG=28.500000 ／ A'F=6.00000（与件と一致）／ CH=17.50000（答えと一致）
//       A'E=AE=19 ／ 角EA'G=90.0000°（折り返しで長方形の角Aが保存）
//       EF=13.00000（＝5:12:13の直角三角形）／ A'H=2.5 ／ FH=6.5
//       台形GHCD=(7.5+17.5)×24÷2=300.0000（答えと一致）
//     すべて原本の印刷解答と小数第4位まで一致した。
//
//   座標系：長方形の中心を原点に（[[origami_sakumon_rule]]§1）。x＝BC方向、z＝画面の下向き。
//     A(-18,0,-12) B(-18,0,12) C(18,0,12) D(18,0,-12)
//     E(-18,0,7) G(10.5,0,-12) F(-6,0,12) H(0.5,0,12) A'(-0.46154,0,14.30769)
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

ORIGAMI_PROBLEMS.no16_eg_fold = {
  id: 'no16_eg_fold',
  name: '折ったり重ねたり No.16：EGを折り目にして折る',
  year: null, school: '塾技ワークブック',
  examType: 'practice',
  nadaGroup: 'fold',
  category: 'fold-area',
  difficulty: 4, // 5:12:13の発見＋相似2回（対頂角・垂線）＋台形の面積で4段
  promptText:
    '右の図は、BC=36cm、CD=24cmの長方形ABCDを、EGを折り目として折ったときの図です。'
    + 'BE=5cm、BF=12cm、AF=6cmのとき、台形GHCDの面積は何cm²ですか。'
    + '（原本は(1)CHの長さ (2)AGの長さ (3)台形GHCDの面積 の3問。'
    + 'ここでは(3)を答えましょう。(1)(2)は「解説を見る」で確かめられます）',
  mesh: {
    // 平らな折り返し問題：層を紙の厚みぶん世界の上方向へ積む（[[origami_sakumon_rule]]§2）
    flatStack: true,
    verts: [
      // パネル0（ルート・動かない側＝五角形 E,B,C,D,G）
      [-18, 0, 7], [-18, 0, 12], [18, 0, 12], [18, 0, -12], [10.5, 0, -12],
      // パネル1（折る側＝三角形 A,E,G）
      [-18, 0, -12], [-18, 0, 7], [10.5, 0, -12],
    ],
    tris: [
      [0, 1, 2], [0, 2, 3], [0, 3, 4], // 五角形をEから扇形に3分割
      [5, 6, 7],
    ],
    uv: [
      [0, 0.79167], [0, 1], [1, 1], [1, 0], [0.79167, 0],
      [0, 0], [0, 0.79167], [0.79167, 0],
    ],
    panel: [0, 0, 0, 0, 0, 1, 1, 1],
    boneParent: [-1, 0],
    hinge: [
      null,
      // origin=E、axis=E→G方向（外積のY成分が正＝紙が+Yへ持ち上がる谷折り）
      { origin: [-18, 0, 7], axis: OGL.vecNorm([28.5, 0, -19]) },
    ],
  },
  // 折り返して隠れた「もとの紙の辺」を破線で残す（[[origami_sakumon_rule]]§4）
  previewCreases: [
    { boneId: 0, a: [-18, 0, -12], b: [-18, 0, 7], kind: 'outline', afterFold: 1 }, // もとの辺AE
    { boneId: 0, a: [-18, 0, -12], b: [10.5, 0, -12], kind: 'outline', afterFold: 1 }, // もとの辺AG
  ],
  // 求める台形GHCDを斜線で示す（[[origami_sakumon_rule]]§8）。
  // Hは折ってはじめて決まる点なので、折ってから出す。
  areaMarks: [
    { afterFold: 1, points: [
      { boneId: 0, local: [10.5, 0, -12] }, { boneId: 0, local: [18, 0, -12] },
      { boneId: 0, local: [18, 0, 12] }, { boneId: 0, local: [0.5, 0, 12] }] },
  ],
  steps: [
    {
      id: 1,
      handle: { boneId: 1, local: [-18, 0, -12] }, // 頂点Aをつまむ
      targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
      hintLabel: 'EGを折り目にして、頂点Aを折り返す',
      creaseLine: { boneId: 0, a: [-18, 0, 7], b: [10.5, 0, -12], kind: 'valley' },
    },
  ],
  labelPoints: [
    // 折る前は頂点A、折り返した後はA'（原本の図でも下辺の上に並ぶのは折り返し後のA）
    { boneId: 1, local: [-18, 0, -12], label: 'A', foldedLabel: 'A\'' },
    { boneId: 0, local: [-18, 0, 12], label: 'B' },
    { boneId: 0, local: [18, 0, 12], label: 'C' },
    { boneId: 0, local: [18, 0, -12], label: 'D' },
    { boneId: 0, local: [-18, 0, 7], label: 'E' },
    { boneId: 0, local: [10.5, 0, -12], label: 'G' },
    { boneId: 0, local: [-6, 0, 12], label: 'F' },
    { boneId: 0, local: [0.5, 0, 12], label: 'H' },
  ],
  dimensionLabels: [
    // 紙のふちの外に置くと画面から切れる／折り返した紙やA'の丸と重なるので、
    // 実測しながら内側・右寄りへ寄せてある（2026-09-01）
    { boneId: 0, local: [9, 0, 13.9], label: 'BC=36cm' },
    { boneId: 0, local: [14.5, 0, 0], label: 'CD=24cm' },
    { boneId: 0, local: [-11.5, 0, 9.5], label: 'BE=5cm' },
    { boneId: 0, local: [-12, 0, 16], label: 'BF=12cm' },
    // A'F は折ってはじめて現れる長さなので、折ってから出す
    { boneId: 0, local: [-6.5, 0, 15.4], label: 'AF=6cm', afterFold: 1 },
  ],
  answer: { value: 300, display: '300', unit: 'cm²', tolerance: 0.5 },
  explanation: [
    '折り返しで三角形AEGはそのまま三角形A\'EGに重なる。だからA\'E＝AE、A\'G＝AG、そして角EA\'G＝もとの角A＝90°。',
    'AE＝AB－BE＝24－5＝19cm。折り返してもA\'E＝19cm。A\'F＝6cmだから、EF＝19－6＝13cm。',
    '三角形EBFは、角B＝90°、EB＝5cm、EF＝13cm。5：12：13の直角三角形なので BF＝12cm（与えられた数と合う）。',
    '三角形A\'FHも角A\'＝90°で、角A\'FHと角BFEは対頂角だから等しい。つまり三角形EBFと同じ5：12：13の形。A\'F＝6cmがBF＝12cmにあたるので比は1/2。A\'H＝5×1/2＝2.5cm、FH＝13×1/2＝6.5cm。',
    '【(1)】BH＝BF＋FH＝12＋6.5＝18.5cm。CH＝BC－BH＝36－18.5＝17.5(cm)。',
    '【(2)】Gから辺BCに垂線を下ろした足をPとすると、三角形HPGも同じ5：12：13の形（HGは直線A\'Gの一部）。PG＝CD＝24cmが「12」にあたるので、HP＝24×5/12＝10cm。AG＝BP＝BH＋HP＝18.5＋10＝28.5(cm)。',
    '【(3)】GD＝BC－AG＝36－28.5＝7.5cm。台形GHCD＝(GD＋HC)×CD÷2＝(7.5＋17.5)×24÷2＝300(cm²)。',
  ],
};
