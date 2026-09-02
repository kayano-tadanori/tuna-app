// ============================================================
// problems/juku29_2_circle_fold.js — 塾技29(2)「曲線の長さ」円形の紙を3回折る
//   （灘中対策コーナー。図1の角アを答える問題として実装）
//
//   半径1cmの円形の紙。点AがOと重なるように折って開き、点B・点Cも同じように折って開いた。
//   折り目「あ」と「う」が66°で交わっている。図1の角アの大きさは？　答え：114°
//
//   ★原本(折り紙問題01.pdf p02の問題図・p04の解答)を800dpiで読み直して構成を確定した（2026-09-02）：
//     ・「点AがOと重なるように折る」＝折り目はOAのまん中を通ってOAに垂直な直線（あ）。
//       同じように い⊥OB、う⊥OC。図の直角の印がそれを示している。
//     ・66°は「あ」と「う」が交わってできる角。
//     ・角ア＝∠AOC。O・OAのまん中M・交点X・OCのまん中N でできる四角形の内角の和から
//       ア＝360-90-90-66＝114°（印刷解答の「180-66」と同じ値）。
//     ・∠AOB＝90°（図の直角の印）なので ∠BOC＝360-(90+114)＝156°。
//
//   ⚠原本の設問には「図2の斜線部分の周の長さの和（5.652cm）」という続きがあるが、
//     そちらはインクのあとと弧でできる図形なので、折る3Dの画面では何を答えるのかを
//     示せない（作問ルール§8）。ここでは図1の角アだけを出している。
//
//   ⚠3本の折り目は、実際には1本ずつ折って開くもの。3枚のフラップは互いに重なる領域を
//     持つので、3つとも同時に折ることはできない。原本の図1も「折って開いたあと」の
//     破線なので、**「あ」だけを実際に折れるようにし、い・う は最初から破線で見せる**。
//
//   座標系：円の中心Oが原点（半径10cm）。A(0°)・B(90°)・C(246°)＝∠AOC=114°。
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

(function () {
  const R = 10;
  const STEP = 2;                 // 円を2°きざみの多角形で近似する
  const A_DEG = 0, B_DEG = 90, C_DEG = 246;   // ∠AOC=114°、∠AOB=90°
  const rad = d => d * Math.PI / 180;
  const P = (deg, len) => [Math.cos(rad(deg)) * (len === undefined ? R : len), 0,
                           Math.sin(rad(deg)) * (len === undefined ? R : len)];

  const O = [0, 0, 0];
  const A = P(A_DEG), B = P(B_DEG), C = P(C_DEG);
  // 折り目「あ」＝OAの垂直二等分線。円との交点は±60°（cos60°=1/2）
  const T = P(60), Bm = P(-60);
  // 折り目「い」「う」＝OB・OCの垂直二等分線。円と交わる2点を出す
  const bisector = (deg) => {
    const h = 60;                                  // 中心から見て±60°のところで円と交わる
    return [P(deg - h), P(deg + h)];
  };
  const I2 = bisector(B_DEG), U2 = bisector(C_DEG);
  // 折り目「あ」(x=R/2の縦線)と「う」の交点＝66°の角の頂点。
  // 「う」は O から見て OC の向きに距離 R/2 の直線（P・û = R/2）なので、x=R/2 を代入して出す
  const uHat = [Math.cos(rad(C_DEG)), Math.sin(rad(C_DEG))];
  const X66 = [R / 2, 0, (R / 2 - (R / 2) * uHat[0]) / uHat[1]];

  // ---- メッシュ（パネル0＝折り目より左の残り／パネル1＝折り返す弓形）----
  const verts = [], tris = [], panel = [], uv = [];
  const half = R * 1.05;
  const pushV = (p, pid) => {
    verts.push(p); panel.push(pid);
    uv.push([(p[0] + half) / (2 * half), (p[2] + half) / (2 * half)]);
    return verts.length - 1;
  };
  const fan = (poly, pid) => {
    const idx = poly.map(p => pushV(p, pid));
    let a2 = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      a2 += p[0] * q[2] - q[0] * p[2];
    }
    for (let i = 1; i < idx.length - 1; i++) {
      tris.push(a2 > 0 ? [idx[0], idx[i], idx[i + 1]] : [idx[0], idx[i + 1], idx[i]]);
    }
  };
  // パネル0：60°から300°までの弧（Bも Cも この上）＋弦
  const poly0 = [];
  for (let d = 60; d <= 300 + 1e-9; d += STEP) poly0.push(P(d));
  fan(poly0, 0);
  // パネル1：-60°から60°までの弧（Aがまん中）＋弦
  const poly1 = [];
  for (let d = -60; d <= 60 + 1e-9; d += STEP) poly1.push(P(d));
  fan(poly1, 1);

  ORIGAMI_PROBLEMS.juku29_2_circle_fold = {
    id: 'juku29_2_circle_fold',
    name: '塾技29(2)：円を3回折る（角ア）',
    year: null, school: '塾技ワークブック',
    examType: 'practice',
    nadaGroup: 'fold',
    category: 'fold-angle',
    difficulty: 4,   // 原本の章の印刷どおり【難易度★★★★】
    promptText:
      '半径1cmの円形の紙があります。点Aが中心Oと重なるようにこの紙を折って開きました。'
      + '同じように、点BがOと重なるように折って開き、点CがOと重なるように折って開きました。'
      + 'このとき、折り目「あ」と「う」は図のように66°で交わりました。角アの大きさは何度ですか。'
      + '（点Aをつまんで、Oに重なるまで折ってみましょう。「い」と「う」の折り目は最初から入っています）',
    mesh: {
      flatStack: true,
      verts, tris, uv, panel,
      boneParent: [-1, 0],
      hinge: [
        null,
        // origin=弦の下の端、axis=弦の向き（下→上）。外積のY成分 uz*vx-ux*vz = +5 > 0 ＝谷折り
        { origin: Bm, axis: OGL.vecNorm([T[0] - Bm[0], 0, T[2] - Bm[2]]) },
      ],
    },
    previewCreases: [
      // 折り目「い」「う」＝もう折って開いたあとの折り目（原本の図1も破線）
      { boneId: 0, a: I2[0], b: I2[1], kind: 'outline' },
      { boneId: 0, a: U2[0], b: U2[1], kind: 'outline' },
      // 角アの2辺（半径OA・OC）は紙のふちではないので、破線で引く（作問ルール§10-2）
      { boneId: 0, a: O, b: C, kind: 'outline' },
      { boneId: 0, a: O, b: A, kind: 'outline' },
    ],
    steps: [
      {
        id: 1,
        handle: { boneId: 1, local: A },
        targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
        hintLabel: '折り目「あ」で右のふちを折り返す（点Aがちょうど中心Oに重なる）',
        creaseLine: { boneId: 0, a: Bm, b: T, kind: 'valley' },
      },
    ],
    labelPoints: [
      // Oの記号は、折るとAが重なってくるので少しだけずらして置く（重なって読めなくなるのを防ぐ）
      { boneId: 0, local: [-2.4, 0, -1.6], label: 'O' },   // 実測で26pxの丸が離れる距離
      { boneId: 1, local: A, label: 'A' },
      { boneId: 0, local: B, label: 'B' },
      { boneId: 0, local: C, label: 'C' },
    ],
    angleMarks: [
      // 与えられている66°＝折り目「あ」と「う」が交わる角。
      // 2本とも最初から（折る前から）図に入っている折り目なので、はじめから出す
      {
        boneId: 0, vertex: X66, from: [R / 2, 0, 0], to: U2[0],
        label: '66°', radius: 2.6,
      },
      // 求める角ア＝∠AOC。頂点はO、2辺は半径OAとOC（どちらも破線で引いてある）
      { boneId: 0, vertex: O, from: A, to: C, label: 'ア', radius: 2.2 },  // 66°の印と離すため小さめ
    ],
    answer: { value: 114, display: '114', unit: '度', tolerance: 0.5 },
    explanation: [
      '「点AがOと重なるように折る」というのは、OとAのちょうどまん中を通って、OAに垂直な直線で折るということ。だから折り目「あ」はOAに垂直。同じように「い」はOBに、「う」はOCに垂直。',
      'ここで、O・OAのまん中の点・「あ」と「う」が交わる点・OCのまん中の点、この4つで四角形を作る。',
      'この四角形の角は、OAのまん中のところが90°（あ⊥OA）、OCのまん中のところも90°（う⊥OC）、交わる点のところが66°。',
      '四角形の内角の和は360°なので、Oのところの角＝360°-90°-90°-66°＝114°。',
      'ア＝114°。（「2本の折り目のなす角」と「2本の半径のなす角」は、たすと180°になる、と覚えてもよい）',
    ],
  };
})();
