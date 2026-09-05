"""紙の「輪になったつながり」が、折る途中で裂けていないかを実エンジンで測る。

★なぜ要るか（2026-09-05に見つけた穴）
   check_fold_motion.py の「②ヒンジがつながっているか」は、**骨と親**しか見ていない。
   ところが紙の面のつながりは、いつも木（親は1つ）になるとは限らない。
   **折り線が1点に何本も集まる頂点**（潰し折りの核＝degree-4）では、面のつながりが
   **輪**になる：

       面0 ── 面1 ── 面2 ── 面3 ── 面0
                                    ↑この最後の1本が「木では書けないつながり」

   fold.js の boneParent は木なので、この辺を保証する場所が無い。
   保証が無い＝**折る途中で黙って裂ける**。しかも親子ではないので
   check_fold_motion.py は何も言わない（＝この壊れ方は素通りする）。

   実測：手で組んだ degree-4 を実エンジンで折らせると、面の一辺=1に対して
   **最大 1.5388 裂けた**。しかも 0°と180°（折る前と折り終わり）だけは 0 なので、
   **見た目の確認や、折り終わりだけ見る検査では絶対に見つからない。**

★この検査が見るもの
   ① 紙の上で辺を共有しているのに、骨の木では親子でない面の組を見つける
   ② その辺の上の点を、両方の面の行列で世界へ写して、距離を測る（＝すきま）
   ③ 手順を順に折り進めながら、各手を0→targetまで刻んで最大のすきまを出す

★わざと壊して鳴るか（自己テスト）
   最後に、**わざと degree-4 の頂点を作った紙**を同じ手順で測る。
   ここで鳴らなければ、この検査は何も見ていないのと同じ。

★落ちたときの読み方
   ・**折線を疑う前にエンジンと手順を疑う**（[[feedback_origami_fufuritsu]]①②）
   ・1点に集まる折り線を「同時に」動かす手は、板（剛体）では表せない。
     その手だけ紙を柔らかくして折る（cloth.js の継ぎ目制約）＝本人の案。
     → [[feedback_tsubushiori_2d_genkai]]
"""
import sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 8987
from kit import target_works
WORKS = target_works()      # ★作品の名簿は works_build.BUILDERS ただ1か所

# 紙の大きさに対する比で見る。これ以上のすきまは「裂けている」とみなす。
#
# ★この値の根拠（2026-09-05に実測して決めた。感覚で置いていない）
#   ・既存17作品のうち9本は 1e-16（＝計算機の限界＝本当にぴったり0）
#   ・残る8本は 1e-6〜3.4e-6。これは裂けているのではなく、
#     **to_work_js.py が作品JSを小数6桁で書き出している**（`0.707107` など）
#     その丸めが、そのまま位置の誤差として出ているだけ。
#   ・わざと壊した紙（degree-4）は 1.09。
#   → 正常の最大 3.4e-6 と、壊れた 1.09 のへだたりは **31万倍**。
#     そこで 1e-4（紙の 0.01%）に置く。正常側から30倍・壊れた側から1万倍の余裕がある。
# ⚠ ここをゆるめると、この検査は何も見ていないのと同じになる
#   （[[feedback_origami_fufuritsu]]③「ゆるめた瞬間、間違いに気づけなくなる」）。
#   落ちたときに最初にすることは、しきい値を上げることでは絶対にない。
TOL_REL = 1e-4


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


# 測る本体。work をそのまま渡せるので、作品にも「わざと壊した紙」にも同じものを使う。
MEASURE = r"""
(work0) => {
  // ★紙の厚みは無視して測る（本人指示 2026-09-05「その時の座標計算は紙の厚みは
  //   無視したほうがいいよ」）。renderer.js の applyHingeY() は
  //   `mesh.hinge[i].origin[1] = hingeY[i] * 厚み` と**メッシュを書き換える**ので、
  //   厚みが入ったまま測ると、木でつながっていない辺が厚みぶんズレて
  //   **裂けていないのに裂けたことになる**（偽の検出）。
  //   ⚠ これまでは「アプリが最初の1作品しか applyHingeY を通らない」という
  //     偶然のおかげで厚み無しになっていただけ＝運任せだった。ここで明示的に落とす。
  //   ⚠ 元のメッシュは書き換えない（アプリが使っているものを壊さないため）。
  const work = Object.assign({}, work0, {
    mesh: Object.assign({}, work0.mesh, {
      hinge: (work0.mesh.hinge || []).map(h => h && Object.assign({}, h,
        h.origin ? { origin: [h.origin[0], 0, h.origin[2]] } : {})),
    }),
  });
  const M = work.mesh;
  if (!M || !M.boneParent || !work.steps || !work.steps.length) return null;

  const rnd = v => v.map(x => Math.round(x * 1e4) / 1e4).join(',');
  const key = (p, q) => { const a = rnd(p), b = rnd(q); return a < b ? a+'|'+b : b+'|'+a; };
  const apply = (m, v) => [
    m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
    m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
    m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14]];
  const d3 = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);

  // ---- ① 面ごとの「外まわりの辺」を、フラット（原紙）の座標で集める ----
  //   面の中を2つの三角形に割った対角線は2回出てくるので落ちる（＝外まわりだけ残る）
  const cnt = {}, pts = {};
  (M.tris || []).forEach(t => {
    const b = M.panel[t[0]];
    if (M.panel[t[1]] !== b || M.panel[t[2]] !== b) return;   // 面をまたぐ三角は見ない
    cnt[b] = cnt[b] || new Map();
    for (let i = 0; i < 3; i++) {
      const p = M.verts[t[i]], q = M.verts[t[(i+1) % 3]];
      const k = key(p, q);
      cnt[b].set(k, (cnt[b].get(k) || 0) + 1);
      pts[k] = [p, q];
    }
  });
  const outer = {};
  for (const b in cnt) { outer[b] = new Set();
    cnt[b].forEach((c, k) => { if (c === 1) outer[b].add(k); }); }

  // ---- 辺を共有しているのに、骨の木では親子でない面の組 ----
  const bones = Object.keys(outer).map(Number).sort((a, b) => a - b);
  const isTree = (a, b) => M.boneParent[a] === b || M.boneParent[b] === a;
  const pairs = [];
  for (let i = 0; i < bones.length; i++) for (let j = i + 1; j < bones.length; j++) {
    const a = bones[i], b = bones[j], sh = [];
    outer[a].forEach(k => { if (outer[b].has(k)) sh.push(k); });
    if (sh.length && !isTree(a, b)) pairs.push([a, b, sh]);
  }
  // 紙の大きさ（すきまの大小をこれと比べる）
  let span = 0; M.verts.forEach(v => { span = Math.max(span, Math.hypot(v[0], v[2])); });
  if (!pairs.length) return { pairs: 0, maxGap: 0, span, worst: null };

  // ---- ③ 手順を順に折り進めながら測る ----
  const st = FOLD.createState(work);
  let maxGap = 0, worst = null;
  work.steps.forEach((s, si) => {
    const b0 = s.handle.boneId;
    for (let k = 0; k <= 8; k++) {
      const t = (k / 8) * s.targetAngle;
      st.liveAngle[b0] = t;
      FOLD.syncLinkedAngle(st, b0, t, s);
      const mats = FOLD.currentBoneMatrices(st);
      for (const [a, b, sh] of pairs) for (const kk of sh) {
        const [p, q] = pts[kk];
        const g = Math.max(d3(apply(mats[a], p), apply(mats[b], p)),
                           d3(apply(mats[a], q), apply(mats[b], q)));
        if (g > maxGap) { maxGap = g; worst = { step: si + 1,
          deg: Math.round(t * 180 / Math.PI), a, b }; }
      }
    }
    // この手を折り終わったことにして次へ（committedも進める＝本物の進み方）
    st.liveAngle[b0] = s.targetAngle;
    FOLD.syncLinkedAngle(st, b0, s.targetAngle, s);
    st.committedAngle[b0] = s.targetAngle;
    st.doneSteps.add(si);
  });
  return { pairs: pairs.length, maxGap, span, worst };
}
"""

# ★わざと壊した紙：正方形を4つに割り、中心で4本の折り線が集まる（degree-4）。
#   紙のつながりは 面0-1-2-3-0 の輪。骨は 0→1→2→3 の鎖しか書けないので、
#   4本目が保証されない＝折る途中で裂けるはず。ここが鳴らなければ検査が死んでいる。
BROKEN = r"""
() => {
  const P = [[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],
             [[0,0,0],[0,0,1],[-1,0,1],[-1,0,0]],
             [[0,0,0],[-1,0,0],[-1,0,-1],[0,0,-1]],
             [[0,0,0],[0,0,-1],[1,0,-1],[1,0,0]]];
  const verts = [], tris = [], panel = [], uv = [];
  P.forEach((q, b) => { const o = verts.length;
    q.forEach(v => { verts.push(v); panel.push(b); uv.push([0, 0]); });
    tris.push([o, o+1, o+2]); tris.push([o, o+2, o+3]); });
  return { id: '_broken_deg4', name: 'わざと壊した紙（degree-4）', mesh: {
    verts, tris, uv, panel,
    boneParent: [-1, 0, 1, 2],
    hinge: [null, { origin: [0,0,0], axis: [0,0,1] },
                  { origin: [0,0,0], axis: [-1,0,0] },
                  { origin: [0,0,0], axis: [0,0,-1] }],
    flatStack: true, layerOrder: [0,1,2,3], stackCount: [1,1,1,1],
    hingeY: [0,0,0,0], boneFoldStep: [0,1,1,1],
  }, steps: [{ id: 1, targetAngle: Math.PI, snapDeg: 0.35, returnAngle: 0,
    handle: { boneId: 1, local: [-1,0,1],
              linkedBoneIds: [2, { boneId: 3, target: Math.PI }] } }] };
}
"""


def main():
    from playwright.sync_api import sync_playwright
    httpd = serve()
    ok_all = True

    def check(name, ok, extra=''):
        nonlocal ok_all
        ok_all = ok_all and bool(ok)
        print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))

    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = br.new_page(viewport={'width': 600, 'height': 600})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(600)

        for w in WORKS:
            r = pg.evaluate("(id) => window.ORIGAMI_WORKS[id] ? "
                            "(" + MEASURE + ")(window.ORIGAMI_WORKS[id]) : 'missing'", w)
            if r == 'missing':
                check(f'{w}: 作品が読めた', False, 'ORIGAMI_WORKS に無い')
                continue
            if r is None:
                check(f'{w}: メッシュと手順がある', False)
                continue
            gap, span = r['maxGap'], r['span'] or 1
            rel = gap / span
            wo = r['worst']
            where = (f" {wo['step']}手目 {wo['deg']}° 面{wo['a']}-面{wo['b']}"
                     if wo else '')
            # ★すきまは必ず指数で出す。`:.4f` だと 3e-6 が「0.0000」と出て、
            #   「0なのにNG」という読めない表示になる（2026-09-05に実際にやった）。
            check(f"{w}: 輪になったつながりが折る途中も裂けない"
                  f"（見た組 {r['pairs']}）",
                  rel <= TOL_REL,
                  f'すきま {rel:.2e}（紙の大きさ比）{where}' if rel > TOL_REL else '')

        # ---- わざと壊して鳴るか（この検査が生きているかの自己テスト）----
        broken = pg.evaluate(BROKEN)
        rb = pg.evaluate("(w) => (" + MEASURE + ")(w)", broken)
        rel_b = (rb['maxGap'] / (rb['span'] or 1)) if rb else 0
        check('わざと壊した紙（degree-4）でちゃんと鳴る',
              rel_b > TOL_REL * 100,
              f'すきま {rel_b:.2e}（しきい値 {TOL_REL:.0e}）' if rb else 'measure できなかった')

        check('エラー0件', len(errs) == 0, str(errs[:3]))
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
