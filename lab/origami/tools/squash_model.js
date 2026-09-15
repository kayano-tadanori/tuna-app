'use strict';
/* つる③「ふくろを ひらいて つぶす」だけを動かす試作の**幾何モデル**。
   ⛔ 既存の自由折り画面・エンジン・作品・JSON形式は1文字も触らない。ここは実験用の別データ。

   ★ここが「描画へ渡す座標」そのもの。squash_preview.html はこの配列をそのまま WebGL へ送り、
     検証もこの配列に対してかける＝**モデルだけ正しくて画面が違う**を起こさない。

   ★使っている値はぜんぶ検証ずみ（check_squash_linkage.py / check_squash_layers.py）：
     原紙 [-1,1]^2 ／ まん中Oから8本（各45°）／ 面 P0..P7
     連動式  tan(γ1/2)·tan(γ2/2) = √2      γ = π − ρ
       固定 ρ5=ρ7=+π・ρ0=ρ6=0 ／ 駆動 ρ2 ／ 従属 ρ4=ρ2・ρ1=ρ3 ／ 符号は4本とも同符号
     骨の木 [-1,0,1,2,3,6,7,0]（枝A: P0→P1→P2→P3→P4 ／ 枝B: P0→P7→P6→P5）
       輪を閉じる最後の1本＝R5（P4 と P5 のあいだ）

   ⛔ 紙どうしの貫通（すり抜け）は**未検証**。下の probePenetration は「見つけたら隠さず出す」
      ためだけの簡易な見張りで、無いことを保証するものではない。
*/
(function (root) {
  const PI = Math.PI, A = Math.PI / 4;

  /* 原紙の8方向。R0=E から 45°ずつ。奇数（対角）は原点から √2。 */
  const RAY = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const RADIUS = RAY.map(p => Math.hypot(p[0], p[1]));
  /* 面 P_i ＝ 素材の三角形 (O, R_i, R_{i+1})。反時計まわり＝おもて。 */
  const MATERIAL = RAY.map((p, i) => [[0, 0], p, RAY[(i + 1) % 8]]);

  /* 検証ずみの重なり（build_tsuru_base.py の LAYER_BY_STEP）。0 が下。 */
  const LAYER_START = [0, 3, 3, 2, 2, 1, 1, 0];   /* 状態②＝2回半分に折った4枚重ね */
  const LAYER_END   = [0, 0, 3, 3, 2, 1, 1, 0];   /* 状態③＝ふくろを開いてつぶしたあと */
  /* 検証ずみの端点の形（EXPECT）。並べ替えた頂点の集合で比べる。 */
  const SHAPE_START = [[[0,0],[1,0],[1,1]], [[0,0],[1,0],[1,1]], [[0,0],[1,-1],[1,0]], [[0,0],[1,-1],[1,0]],
                       [[0,0],[1,0],[1,1]], [[0,0],[1,0],[1,1]], [[0,0],[1,-1],[1,0]], [[0,0],[1,-1],[1,0]]];
  const SHAPE_END   = [[[0,0],[1,0],[1,1]], [[0,0],[0,1],[1,1]], [[0,0],[0,1],[1,1]], [[0,0],[1,0],[1,1]],
                       [[0,0],[1,0],[1,1]], [[0,0],[1,0],[1,1]], [[0,0],[1,-1],[1,0]], [[0,0],[1,-1],[1,0]]];
  /* 8区間 → 原本に残る面（Q_E と Q_S は割れない＝2区間で1枚）。検証表示に出すだけ。 */
  const SECTOR_FACE = ['Q_E', 'P1', 'P2', 'P3', 'P4', 'Q_S', 'Q_S', 'Q_E'];
  const MOVING = { P1: 1, P2: 1, P3: 1 };

  /* ---------------- 連動式（安定形。arcsin 形は端点で崩れるので使わない） ---------------- */
  function gamma1(g2) { return 2 * Math.atan2(Math.SQRT2 * Math.cos(g2 / 2), Math.sin(g2 / 2)); }
  function rhoOf(t) {
    const g2 = PI * (1 - t), r = [0, 0, 0, 0, 0, 0, 0, 0];
    r[5] = PI; r[7] = PI;                       /* 固定（②で折れている2本） */
    r[2] = r[4] = PI - g2;                      /* 駆動と、それに等しい従属 */
    r[1] = r[3] = PI - gamma1(g2);              /* 従属 */
    return r;
  }

  /* ---------------- 骨の木で置く（枝A・枝B） ---------------- */
  const mul = (a, b) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[i * 3 + k] * b[k * 3 + j]; o[i * 3 + j] = s; } return o; };
  const rx = t => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const rz = t => { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const colX = m => [m[0], m[3], m[6]];         /* その枠の x 軸＝その光線の向き */

  function rays(rho) {
    const F = {}; F[1] = rz(A);                 /* P0 の面を z=0 に置く／u1 が x 軸 */
    for (const i of [1, 2, 3, 4]) F[i + 1] = mul(mul(F[i], rx(rho[i])), rz(A));
    F[0] = mul(mul(F[1], rz(-A)), rx(-rho[0]));
    F.b7 = mul(mul(F[0], rz(-A)), rx(-rho[7]));
    F.b6 = mul(mul(F.b7, rz(-A)), rx(-rho[6]));
    F.b5 = mul(mul(F.b6, rz(-A)), rx(-rho[5]));
    return { 0: colX(F[0]), 1: colX(F[1]), 2: colX(F[2]), 3: colX(F[3]), 4: colX(F[4]), 5: colX(F[5]),
             b5: colX(F.b5), b6: colX(F.b6), b7: colX(F.b7) };
  }
  /* 面ごとに「自分の枝の光線」を使う＝輪の R5 だけ枝Aと枝Bで別の点になりうる（それがすきま）。 */
  const RAY_OF = [['0', '1'], ['1', '2'], ['2', '3'], ['3', '4'], ['4', '5'],
                  ['b5', 'b6'], ['b6', 'b7'], ['b7', '0']];

  function layerAt(t) { return t < 0.5 ? LAYER_START : LAYER_END; }

  /* ★素材の幾何そのもの（紙の厚みは 0）。**合格基準はここだけで見る**。
     ＝共有境界は「離れない（0）」。ここに表示の都合を混ぜない。 */
  function panels(t) {
    const u = rays(rhoOf(t)), out = [];
    for (let i = 0; i < 8; i++) {
      const [ka, kb] = RAY_OF[i], ra = u[ka], rb = u[kb];
      const a = RADIUS[i], b = RADIUS[(i + 1) % 8];
      out.push([[0, 0, 0], [a * ra[0], a * ra[1], a * ra[2]], [b * rb[0], b * rb[1], b * rb[2]]]);
    }
    return out;
  }

  /* ⚠ここから下は**描画上の調整**（実験）。素材の幾何ではない。
     平らな両端では面がぴったり同じ高さに重なる＝厚み0の紙の真実なので、depth バッファでは
     並ばない。見たいときだけ、層順どおりに基準面の法線へ持ち上げて見る。
     🚨この持ち上げは「紙がつながっている」ことの合格基準には**使わない**。
     重み w=(2t-1)^2 は両端で1・まん中で0＝t=0.5 で層の表が入れかわっても飛ばない。 */
  function displayLift(t, lift) {
    const w = (2 * t - 1) * (2 * t - 1), lay = layerAt(t);
    return lay.map(v => (lift || 0) * w * v);
  }
  function displayPanels(t, lift) {
    const pl = panels(t), dz = displayLift(t, lift);
    return pl.map((p, i) => p.map(v => [v[0], v[1], v[2] + dz[i]]));
  }
  /* 画面へ渡す配列。既定は**素材の幾何そのまま**（lift=0）。 */
  function renderVertices(t, lift) {
    const pl = (lift ? displayPanels(t, lift) : panels(t)), pos = new Float32Array(8 * 9);
    for (let i = 0; i < 8; i++) for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++)
      pos[i * 9 + k * 3 + c] = pl[i][k][c];
    return { panels: pl, positions: pos, lift: lift || 0 };
  }

  /* ---------------- 検証（**描画へ渡した座標**に対してかける） ---------------- */
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const dist = (a, b) => len(sub3(a, b));
  /* 共有境界＝光線 R_k の両側。面 a の「うしろの辺」と 面 b の「まえの辺」。 */
  const SHARED = [[7, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]];
  const LOOP_RAY = 5;

  /* 🚨合格基準は**素材の幾何（厚み0）**だけ。表示の持ち上げはここに入らない。 */
  function verify(t) {
    const pl = panels(t);
    const out = [];
    const add = (name, ok, detail) => out.push({ name, ok: !!ok, detail: detail === undefined ? '' : detail });

    /* ① 共有境界は**離れない**（0）。輪を閉じる1本もふくめて8本とも。 */
    let worstShare = 0;
    for (let k = 0; k < 8; k++) {
      const [a, b] = SHARED[k];
      worstShare = Math.max(worstShare, dist(pl[a][2], pl[b][1]));
    }
    add('共有境界8本が離れていない（紙がつながっている）', worstShare < 1e-9, worstShare.toExponential(2));
    add('　うち輪を閉じる1本（R5・骨の木で閉じない所）も離れていない',
        dist(pl[4][2], pl[5][1]) < 1e-9, dist(pl[4][2], pl[5][1]).toExponential(2));

    /* ② 辺長と面積（平行移動では変わらない＝厚みを入れても厳密に一致するはず） */
    let worstLen = 0, worstArea = 0;
    for (let i = 0; i < 8; i++) {
      const m = MATERIAL[i], p = pl[i];
      const pairs = [[0, 1], [0, 2], [1, 2]];
      for (const [x, y] of pairs) {
        const l3 = dist(p[x], p[y]);
        const l2 = Math.hypot(m[x][0] - m[y][0], m[x][1] - m[y][1]);
        worstLen = Math.max(worstLen, Math.abs(l3 / l2 - 1));
      }
      const a3 = len(cross(sub3(p[1], p[0]), sub3(p[2], p[0]))) / 2;
      const a2 = Math.abs((m[1][0] - m[0][0]) * (m[2][1] - m[0][1]) - (m[1][1] - m[0][1]) * (m[2][0] - m[0][0])) / 2;
      worstArea = Math.max(worstArea, Math.abs(a3 / a2 - 1));
    }
    add('8枚の辺長が素材と一致（伸びていない）', worstLen < 1e-9, worstLen.toExponential(2));
    add('8枚の面積が素材と一致', worstArea < 1e-9, worstArea.toExponential(2));

    /* ③ 端点の形（真上から見た x,y を、検証ずみの EXPECT と突き合わせる） */
    if (t < 1e-12 || t > 1 - 1e-12) {
      const want = t < .5 ? SHAPE_START : SHAPE_END;
      let ok = true, bad = '';
      for (let i = 0; i < 8; i++) {
        const got = pl[i].map(v => [Math.round(v[0] * 1e5) / 1e5 + 0, Math.round(v[1] * 1e5) / 1e5 + 0])
          .sort((u, v) => u[0] - v[0] || u[1] - v[1]);
        const w = want[i].map(v => [v[0], v[1]]).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
        if (JSON.stringify(got) !== JSON.stringify(w)) { ok = false; bad += ' P' + i; }
      }
      add((t < .5 ? '折る前' : 'つぶした後') + 'の形が、検証ずみの EXPECT と8枚とも一致', ok, bad);
    }

    /* ④ 層順。**平らな両端でだけ**、検証ずみの表と突き合わせる。
          ⚠途中は紙が本当に立体なので「層」という概念がそもそも当てはまらない＝ここでは主張しない
            （奥行きは depth バッファが受け持つ）。ちょうど端点は全面が同じ高さなので手前(ε)で見る。 */
    const eps = 1e-6, near = Math.min(t, 1 - t) <= 0.02;
    const probeT = t < eps ? eps : (t > 1 - eps ? 1 - eps : t);
    const raw = panels(probeT);
    const z = raw.map(p => (p[0][2] + p[1][2] + p[2][2]) / 3);
    const wantLayer = probeT < .5 ? LAYER_START : LAYER_END;
    let orderOK = true, why = '';
    for (let i = 0; i < 8 && near; i++) for (let j = 0; j < 8; j++) {
      if (i === j || SECTOR_FACE[i] === SECTOR_FACE[j]) continue;
      if (!overlap2d(raw[i], raw[j])) continue;          /* 重ならない面には順位を求めない */
      const dz = z[i] - z[j], dl = wantLayer[i] - wantLayer[j];
      if (Math.abs(dz) <= 1e-12) continue;               /* 同着＝固定面どうし。既存順を継ぐ */
      if ((dz > 0) !== (dl > 0)) { orderOK = false; why = `P${i}/P${j}`; }
    }
    add(near ? '平らな端の上下が、検証ずみの層順と一致'
             : '途中なので層順は主張しない（奥行きは depth バッファが決める）', orderOK, why);

    /* ⑤ 貫通の見張り（⛔保証ではない。見つけたら隠さず出す） */
    const pen = probePenetration(pl);
    add('紙の交差は見つかっていない（⛔非貫通は未検証。これは見張りだけ）',
        pen.length === 0, pen.length ? pen.join(' ') : '');

    return { checks: out, ok: out.every(c => c.ok), penetration: pen };
  }

  /* ⚠**描画上の調整だけ**を見る。合格基準ではない（紙がつながっているかは verify が見る）。 */
  function inspectDisplay(t, lift) {
    const base = panels(t), shown = displayPanels(t, lift), dz = displayLift(t, lift);
    const lay = layerAt(t), out = [];
    const add = (name, ok, detail) => out.push({ name, ok: !!ok, detail: detail === undefined ? '' : detail });
    add('持ち上げは検証ずみの層順どおり（層が上ほど高い）',
        lay.every((v, i) => lay.every((w, j) => (v - w) * (dz[i] - dz[j]) >= -1e-15)),
        '層 ' + JSON.stringify(lay) + ' → 持ち上げ ' + dz.map(v => +v.toFixed(4)).join(','));
    add('持ち上げているのは基準面の法線（z）だけ＝xy は素材のまま',
        shown.every((p, i) => p.every((v, k) =>
          Math.abs(v[0] - base[i][k][0]) < 1e-15 && Math.abs(v[1] - base[i][k][1]) < 1e-15)));
    let gap = 0;
    for (let k = 0; k < 8; k++) { const [a, b] = SHARED[k];
      gap = Math.max(gap, dist(shown[a][2], shown[b][1])); }
    out.push({ name: '⚠この持ち上げのぶん、見た目の共有境界は最大 ' + gap.toExponential(2)
               + ' ひらく（表示だけ。合格基準には使わない）', ok: null, detail: '' });
    return out;
  }

  /* 真上から見て重なっているか（層順を求める相手を決めるためだけ） */
  function overlap2d(p, q) {
    const tri = t => [[t[0][0], t[0][1]], [t[1][0], t[1][1]], [t[2][0], t[2][1]]];
    const a = tri(p), b = tri(q);
    const inside = (pt, T) => {
      let s = 0;
      for (let i = 0; i < 3; i++) {
        const u = T[i], v = T[(i + 1) % 3];
        const c = (v[0] - u[0]) * (pt[1] - u[1]) - (v[1] - u[1]) * (pt[0] - u[0]);
        if (Math.abs(c) < 1e-12) continue;
        if (s === 0) s = Math.sign(c); else if (Math.sign(c) !== s) return false;
      }
      return true;
    };
    const c = T => [(T[0][0] + T[1][0] + T[2][0]) / 3, (T[0][1] + T[1][1] + T[2][1]) / 3];
    return inside(c(a), b) || inside(c(b), a);
  }

  /* ⛔簡易な見張り。三角形の辺が、別の三角形の内部を**貫いて**いないか（同一平面は見ない）。
     これで0でも「貫通しない」とは言えない。 */
  function probePenetration(pl) {
    const hits = [];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      if (i === j) continue;
      const T = pl[j], n = cross(sub3(T[1], T[0]), sub3(T[2], T[0]));
      const nl = len(n); if (nl < 1e-12) continue;
      const nn = n.map(v => v / nl);
      for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) {
        if (i === (j + 7) % 8 || j === (i + 7) % 8) continue;     /* 隣りは辺を共有する */
        const p = pl[i][x], q = pl[i][y];
        const dp = dot(sub3(p, T[0]), nn), dq = dot(sub3(q, T[0]), nn);
        if (dp * dq >= -1e-12) continue;                           /* 面をまたいでいない */
        const s = dp / (dp - dq);
        const h = [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s, p[2] + (q[2] - p[2]) * s];
        if (inTri(h, T, nn) > 1e-6) hits.push(`P${i}×P${j}`);
      }
    }
    return [...new Set(hits)];
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function inTri(h, T, nn) {
    let m = Infinity;
    for (let i = 0; i < 3; i++) {
      const u = T[i], v = T[(i + 1) % 3];
      const e = sub3(v, u), w = sub3(h, u);
      m = Math.min(m, dot(cross(e, w), nn) / Math.max(1e-12, len(e)));
    }
    return m;                                   /* 内部なら正・ふちで0 */
  }

  root.SquashModel = { RAY, RADIUS, MATERIAL, LAYER_START, LAYER_END, SHAPE_START, SHAPE_END,
                       SECTOR_FACE, MOVING, rhoOf, gamma1, rays, panels, renderVertices, verify,
                       probePenetration, layerAt, displayLift, displayPanels, inspectDisplay,
                       SHARED, LOOP_RAY };
})(typeof globalThis !== 'undefined' ? globalThis : this);
