// ============================================================
// problems/meisei_sector_fold.js — 明星中学校（大阪）おうぎ形をBCで折る
//   （灘中対策コーナー。同じ図で角ア・角イの2問を作るので1ファイルに2つ入れている）
//
//   おうぎ形（中心A・中心角73°）を、BCを折り目として折ると、点Aが点Dに重なった。
//   角ア＝30°、角イ＝26°
//
//   ★原簿では長らく「印刷解答が無く答え未確定」だったが、**解答は同じ資料の解き方ページ
//     (05.pdf p05)にあった**（2026-09-02に600dpiで読んで発見）。そこには
//       「三角形ABCと三角形DBCは合同なので AB=DB。ABとADは円の半径なので AB=AD。
//        よって三角形ABDは正三角形なので ⑦=60°÷2=30°。角CAD=73°-60°=13°。
//        合同なので角ADC=13°」
//     と書かれている（イの最後の1行はページの端で切れていたが、三角形ACDの内角の和から
//     角ACD=180-13-13=154°、イ＝180-154＝**26°** と確定できる）。
//
//   独立検算（答えを使わず与件だけから／scratchpad/ori/verify_meisei.py）：
//     ・折り目BCでAを折り返すとDに重なる（|BA|=|BD|かつ|CA|=|CD|）→ Cの位置が決まる
//     ・AB・ADはどちらも半径 → 三角形ABDは正三角形 → ∠BAD=60.000°
//     ・ア＝∠DBC＝30.000° ✓（印刷解答と一致）
//     ・∠CAD＝13.000°／∠ADC＝13.000° ✓（印刷解答と一致）→ イ＝26.000°
//
//   座標系：図の中心を原点に。半径10cm、Aは左下の中心、Bは右下、Dは弧の上。
// ============================================================
'use strict';

window.ORIGAMI_PROBLEMS = window.ORIGAMI_PROBLEMS || {};

(function () {
  const R = 10;
  const SEC = 73;          // おうぎ形の中心角（原本の73°）
  const D_DEG = 60;        // Aの折り返し先（正三角形ABDができる）
  const STEP = 1;          // 弧の多角形近似のきざみ
  const rad = d => d * Math.PI / 180;
  const P = (deg, len) => [Math.cos(rad(deg)) * (len === undefined ? R : len), 0,
                           Math.sin(rad(deg)) * (len === undefined ? R : len)];

  const A = [0, 0, 0];
  const B = P(0);
  const E = P(SEC);        // 弧のもう一方のはし（原本では記号なし）
  const D = P(D_DEG);
  // Cは半径AE上の点で、折り目BCがAをDへ移す ⇔ |CA|=|CD|
  //   C = t*(cosSEC, sinSEC) とおくと |CD|² = t² - 2t(D・û) + R²、|CA|² = t²
  //   → t = R² / (2 * (D・û))
  const uHat = [Math.cos(rad(SEC)), Math.sin(rad(SEC))];
  const tC = (R * R) / (2 * (D[0] * uHat[0] + D[2] * uHat[1]));
  const C = P(SEC, tC);

  const arc = [];
  for (let d = 0; d < SEC - 1e-9; d += STEP) arc.push(P(d));
  arc.push(E);

  // 図の中心を原点へ（作問ルール§1）
  const all = [A, B, C, D, E].concat(arc);
  const xs = all.map(p => p[0]), zs = all.map(p => p[2]);
  const cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
  const cz = (Math.min.apply(null, zs) + Math.max.apply(null, zs)) / 2;
  const sh = p => [p[0] - cx, 0, p[2] - cz];
  const aC = sh(A), bC = sh(B), cC = sh(C), dC = sh(D), eC = sh(E);
  const arcC = arc.map(sh);

  // ---- メッシュ（パネル0＝折り目より外側／パネル1＝折り返す三角形ABC）----
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
  // パネル0：B →（弧）→ E → C（半径にそって下る）→ B
  fan(arcC.concat([cC]), 0);
  // パネル1：三角形 A・B・C（B・Cは折り目の上なので複製して持つ）
  fan([aC, bC, cC], 1);

  const MESH = {
    flatStack: true,
    verts, tris, uv, panel,
    boneParent: [-1, 0],
    hinge: [
      null,
      // origin=B、axis=C→Bの向き。外積のY成分 uz*vx-ux*vz = +5.0 > 0 ＝谷折り（作問ルール§12）
      { origin: bC, axis: OGL.vecNorm([bC[0] - cC[0], 0, bC[2] - cC[2]]) },
    ],
  };
  // 折って隠れる「もとの半径AB・AC」を破線で残す（作問ルール§4）
  const PREVIEW = [
    { boneId: 0, a: aC, b: bC, kind: 'outline', afterFold: 1 },
    { boneId: 0, a: aC, b: cC, kind: 'outline', afterFold: 1 },
  ];
  const STEPS = [
    {
      id: 1,
      handle: { boneId: 1, local: aC },       // 中心Aをつまむ
      targetAngle: Math.PI, snapDeg: 0.3, returnAngle: 0,
      hintLabel: '折り目BCで折り返す（中心Aがちょうど弧の上の点Dに重なる）',
      creaseLine: { boneId: 0, a: bC, b: cC, kind: 'valley' },
    },
  ];
  const LABELS = [
    { boneId: 0, local: aC, label: 'A' },
    { boneId: 0, local: bC, label: 'B' },
    { boneId: 0, local: cC, label: 'C' },
    // Dは「Aが移った先」。折り終わってからだけ出す（折る前はAと同じ位置になるため）
    { boneId: 1, local: aC, label: 'D', atTarget: 1 },
  ];
  const ANGLE_73 = { boneId: 0, vertex: aC, from: bC, to: eC, label: '73°', radius: 3.0 };

  // 原本の図は角ア・角イの両方に印がついている。答えるのは片方でも図は原本どおり両方出す
  // （2026-09-02の自己監査＝check_symbols_in_figure.py の指摘で直した）
  const ANGLE_A = {
    boneId: 0, vertex: bC, from: aC, fromBone: 1, to: cC,
    label: 'ア', radius: 3.2, atTarget: 1,
  };
  const ANGLE_I = {
    boneId: 0, vertex: cC, from: eC, to: aC, toBone: 1,
    label: 'イ', radius: 2.4, atTarget: 1,
  };

  const clone = x => JSON.parse(JSON.stringify(x));   // 2問でデータを共有しない（zの反転が二重にかかる）

  function base(id, name, extraAngles, difficulty, answer, explanation, ask) {
    return {
      id, name,
      year: null, school: '明星中学校（大阪）',
      examType: 'real',
      nadaGroup: 'fold',
      category: 'fold-angle',
      difficulty,
      promptText:
        '右の図のおうぎ形で、BCを折り目として折ると、点Aが点Dに重なりました。'
        + '角ア、角イの大きさをそれぞれ求めなさい。'
        + '（' + ask + '。中心Aをつまんで折ってみましょう）',
      mesh: clone(MESH),
      previewCreases: clone(PREVIEW),
      steps: clone(STEPS),
      labelPoints: clone(LABELS),
      angleMarks: clone([ANGLE_73].concat(extraAngles)),
      answer, explanation,
    };
  }

  ORIGAMI_PROBLEMS.meisei_sector_fold_a = base(
    'meisei_sector_fold_a',
    '明星中：おうぎ形をBCで折る（角ア）',
    [ANGLE_A, ANGLE_I],
    3,
    { value: 30, display: '30', unit: '度', tolerance: 0.5 },
    [
      '折り返した三角形DBCは、もとの三角形ABCとぴったり重なる形（合同）。だからBD＝BA。',
      'BAはおうぎ形の半径。そしてDは弧の上の点だからADも半径。つまり AB＝AD＝BD で、三角形ABDは正三角形。',
      'だから角BAD＝60°。',
      '折り目BCは「AがDに重なる」折り方なので、角ABDをちょうど半分に分けている。',
      '三角形ABDは正三角形なので角ABD＝60°。ア＝60°÷2＝30°。',
    ],
    'ここでは角アを答えてください'
  );

  ORIGAMI_PROBLEMS.meisei_sector_fold_i = base(
    'meisei_sector_fold_i',
    '明星中：おうぎ形をBCで折る（角イ）',
    [ANGLE_A, ANGLE_I],
    4,
    { value: 26, display: '26', unit: '度', tolerance: 0.5 },
    [
      '角アの問題と同じように、三角形ABDは正三角形なので角BAD＝60°。',
      'おうぎ形の中心角は73°なので、角CAD＝73°-60°＝13°。',
      '折り返しても長さは変わらないので、CD＝CA。だから三角形ACDは二等辺三角形で、角ADC＝角CAD＝13°。',
      '三角形ACDの内角の和は180°なので、角ACD＝180°-13°-13°＝154°。',
      'イは、角ACDのとなりでまっすぐな角（180°）をつくる角。イ＝180°-154°＝26°。',
    ],
    'ここでは角イを答えてください'
  );
})();
