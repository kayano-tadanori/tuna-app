// ============================================================
// problems/juku27_3_sector_fold.js — 塾技27(3)「曲線と角度」おうぎ形の折り返し
//   （灘中対策コーナー。同じ図で角ア・角イの2問を作るので、1ファイルに2つ入れている）
//
//   中心角108°のおうぎ形OABを、ADを折り目にして、点Oが点Cにくるように折り曲げた。
//   角ア＝30°、角イ＝18°
//
//   ★このアプリで初めての「弧のある紙」。fold.jsは直線のパネルしか扱えないので、
//     弧を2°きざみの多角形で近似してメッシュを作っている（下の buildSector）。
//
//   ★構成は原本(折り紙問題01.pdf)のp01の問題図とp03の解答図を600〜700dpiで読み直して確定した
//     （2026-09-02）。**旧原簿の「Dは弧の上・弧AD=48°」は誤り**——それだと折り返したCが
//     弧の外(|OC|=1.83×半径)へ出てしまう。問題図を画素で測ると
//     |OC|≒|OA|＝半径（Cは弧の上）、|OD|＝0.73×半径で半径OBの上、と一致した。
//
//   独立検算（答えを使わず与件だけから／scratchpad/ori/verify_27_3.py）：
//     ・折り返しなので AC=AO=半径。図よりCは弧の上なので OC も半径。
//       → 三角形AOCは3辺とも半径＝正三角形 → ∠AOC=60.000° ✓
//     ・∠COB＝108-60＝48.000° ✓（印刷解答の48°と一致）
//     ・折り目のDは「OとCが重なる」＝OCの垂直二等分線と半径OBの交点。|OD|=(r/2)/cos48°=0.7472r
//     ・折り目ADでOを折り返すとCにぴったり重なる（誤差0.000000）✓
//     ・ア＝∠CAD＝30.000° ✓／イ＝∠DCB＝18.000° ✓（どちらも印刷解答と一致）
//
//   座標系：図の中心を原点に。半径10cm、Oは右下、Aは左、Bは右上（原本の図と同じ向き）。
//     O(3.45492,-5) A(-6.54508,-5) B(6.54508,4.51057) C(-1.54508,3.66025) D(5.76401,2.10666)
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

(function () {
  const R = 10;                       // 半径
  const A_DEG = 180, B_DEG = 72;      // 弧のはし（中心角108°ぶん）
  const C_DEG = 120;                  // Oの折り返し先（∠AOC=60°）
  const STEP = 2;                     // 弧を何度きざみの多角形で近似するか
  const OD = (R / 2) / Math.cos(48 * Math.PI / 180);   // 折り目の点Dまでの距離

  const rad = d => d * Math.PI / 180;
  const P = (deg, len) => [Math.cos(rad(deg)) * (len === undefined ? R : len), 0,
                           Math.sin(rad(deg)) * (len === undefined ? R : len)];

  const O = [0, 0, 0];
  const A = P(A_DEG);
  const B = P(B_DEG);
  const C = P(C_DEG);
  const D = P(B_DEG, OD);

  // 弧の点（Aから始まってBで終わる。多角形近似）
  const arc = [];
  for (let d = A_DEG; d > B_DEG + 1e-9; d -= STEP) arc.push(P(d));
  arc.push(B);

  // 図の中心を原点へ（作問ルール§1）
  const all = [O, A, B, C, D].concat(arc);
  const xs = all.map(p => p[0]), zs = all.map(p => p[2]);
  const cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
  const cz = (Math.min.apply(null, zs) + Math.max.apply(null, zs)) / 2;
  const sh = p => [p[0] - cx, 0, p[2] - cz];
  const oC = sh(O), aC = sh(A), bC = sh(B), cC = sh(C), dC = sh(D);
  const arcC = arc.map(sh);

  // ---- メッシュ（パネル0＝折り目より外側の残り／パネル1＝折り返す三角形AOD）----
  // パネル0の輪郭：A →（弧）→ B → D → A。扇形から三角形AODを切り取った形で、凸なのでAから扇形分割できる。
  const poly0 = arcC.concat([dC]);
  const verts = [];
  const tris = [];
  const panel = [];
  const uv = [];
  const half = R * 1.05;
  const pushV = (p, pid) => {
    verts.push(p); panel.push(pid);
    uv.push([(p[0] + half) / (2 * half), (p[2] + half) / (2 * half)]);
    return verts.length - 1;
  };
  const i0 = poly0.map(p => pushV(p, 0));
  // 巻き順（(x,z)平面で反時計回り）をそろえる
  let area2 = 0;
  for (let i = 0; i < poly0.length; i++) {
    const p = poly0[i], q = poly0[(i + 1) % poly0.length];
    area2 += p[0] * q[2] - q[0] * p[2];
  }
  for (let i = 1; i < i0.length - 1; i++) {
    tris.push(area2 > 0 ? [i0[0], i0[i], i0[i + 1]] : [i0[0], i0[i + 1], i0[i]]);
  }
  // パネル1＝三角形 A・O・D（折り返す側。A・Dは折り目の上なので複製して持つ）
  const a1 = pushV(aC, 1), o1 = pushV(oC, 1), d1 = pushV(dC, 1);
  const s2 = (oC[0] - aC[0]) * (dC[2] - aC[2]) - (dC[0] - aC[0]) * (oC[2] - aC[2]);
  tris.push(s2 > 0 ? [a1, o1, d1] : [a1, d1, o1]);

  const MESH = {
    flatStack: true,
    verts, tris, uv, panel,
    boneParent: [-1, 0],
    hinge: [
      null,
      // origin=A、axis=A→D。外積のY成分 uz*vx-ux*vz = +5.0 > 0 ＝谷折り
      // （つまむ点Oがまず上へ持ち上がる向き。作問ルール§12）
      { origin: aC, axis: OGL.vecNorm([dC[0] - aC[0], 0, dC[2] - aC[2]]) },
    ],
  };
  // 折って隠れる「もとの半径OA・OD」を破線で残す（作問ルール§4）
  const PREVIEW = [
    { boneId: 0, a: aC, b: oC, kind: 'outline', afterFold: 1 },
    { boneId: 0, a: oC, b: dC, kind: 'outline', afterFold: 1 },
  ];
  const STEPS = [
    {
      id: 1,
      handle: { boneId: 1, local: oC },     // 中心Oをつまむ
      targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
      hintLabel: '折り目ADで、中心Oのある側を折り返す（Oがちょうど弧の上の点Cに重なる）',
      creaseLine: { boneId: 0, a: aC, b: dC, kind: 'valley' },
    },
  ];
  const LABELS = [
    { boneId: 0, local: aC, label: 'A' },
    { boneId: 0, local: bC, label: 'B' },
    { boneId: 0, local: dC, label: 'D' },
    // 中心Oは折るとCに移る（作問ルール§3。1つの丸に「O(C)」と詰めない）
    { boneId: 1, local: oC, label: 'O', foldedLabel: 'C' },
  ];
  // 与えられている中心角108°（折るともとの位置は破線で残るので、そこに出しつづける）
  const ANGLE_108 = {
    boneId: 0, vertex: oC, from: aC, to: bC, label: '108°', radius: 2.6,
  };

  // 🚨2問で同じ図を使うが、**データを共有してはいけない**。
  //   core.jsのflipProblemZは問題ごとに中身を書きかえる（zを反転する）ので、
  //   同じ配列を2つの問題が指していると2回反転されて元に戻ってしまう。必ず複製を渡す。
  const clone = x => JSON.parse(JSON.stringify(x));

  function base(id, name, extraAngles, answer, explanation, ask, extraCreases) {
    return {
      id, name,
      year: null, school: '塾技ワークブック',
      examType: 'practice',
      nadaGroup: 'fold',
      category: 'fold-angle',
      difficulty: 3,   // 原本の章の印刷どおり【難易度★★★】
      promptText:
        '右の図は、中心角108°のおうぎ形OABを、ADを折り目にして、点Oが点Cにくるように折り曲げたものです。'
        + '角アと角イの大きさを求めなさい。'
        + '（' + ask + '。中心Oをつまんで折ってみましょう）',
      mesh: clone(MESH),
      previewCreases: clone(PREVIEW.concat(extraCreases || [])),
      steps: clone(STEPS),
      labelPoints: clone(LABELS),
      angleMarks: clone([ANGLE_108].concat(extraAngles)),
      answer, explanation,
    };
  }

  ORIGAMI_PROBLEMS.juku27_3_sector_fold_a = base(
    'juku27_3_sector_fold_a',
    '塾技27(3)：おうぎ形の折り返し（角ア）',
    [{
      // ア＝∠CAD。Cは折ってできる点なのでボーン1を指し、折り終わってから出す
      boneId: 0, vertex: aC, from: oC, fromBone: 1, to: dC,
      label: 'ア', radius: 3.4, atTarget: 1,
    }],
    { value: 30, display: '30', unit: '度', tolerance: 0.5 },
    [
      '紙を折り返しても長さは変わらないので、AC＝AO＝おうぎ形の半径。',
      '図を見ると、折り返した点Cはおうぎ形の弧の上にのっている。ということはOC も半径。',
      'つまり三角形AOCは、AO・OC・CAの3辺がぜんぶ半径で長さが同じ＝正三角形。だから角AOC＝60°。',
      '折り目ADで折ると、辺AOが辺ACの上にぴったり重なる。ということは、折り目ADは角OACをちょうど半分に分ける線（二等分線）。',
      'ア＝60°÷2＝30°。',
    ],
    'ここでは角アを答えてください'
  );

  ORIGAMI_PROBLEMS.juku27_3_sector_fold_i = base(
    'juku27_3_sector_fold_i',
    '塾技27(3)：おうぎ形の折り返し（角イ）',
    [{
      // イ＝∠DCB。頂点Cは折ってできる点（ボーン1）、2辺の先は動かない側
      boneId: 1, vertex: oC, from: dC, fromBone: 0, to: bC, toBone: 0,
      label: 'イ', radius: 2.6, atTarget: 1,
    }],
    { value: 18, display: '18', unit: '度', tolerance: 0.5 },
    [
      '三角形AOCは3辺とも半径なので正三角形（角アの問題で使った考え方）。だから角AOC＝60°。',
      'おうぎ形の中心角は108°なので、残りの角COB＝108°-60°＝48°。',
      '三角形OCBは、OCもOBも半径だから二等辺三角形。頂角が48°なので、底角の角OCB＝(180°-48°)÷2＝66°。',
      '次に点Dを見る。折り返しでOとCが重なるので、DO＝DC。三角形ODCも二等辺三角形。',
      'DはOBの上にあるので、角DOC＝角BOC＝48°。二等辺だから角DCO も48°。',
      'イ＝角DCB＝角OCB－角OCD＝66°-48°＝18°。',
    ],
    'ここでは角イを答えてください',
    // ★角イ＝∠DCBの2辺のうち、CBは紙のふちでも折り目でもない（弧はふちだが、
    //   角をつくるのはまっすぐな弦のほう）。線が無いと角が読めないので破線で引く
    //   （作問ルール§10-2。2026-09-02の自己監査で追加）。
    //   端点Cは折ってできる点なのでaBoneでボーン1を指す
    [{ boneId: 0, a: oC, aBone: 1, b: bC, kind: 'outline', atTarget: 1 }]
  );
})();
