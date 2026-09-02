"""折り終わったとき、紙の高さが「計算した重なりの順」とぴったり合うか実測する。

★なぜ要るか
   紙の厚みは「層を数値で浮かせる」のではなく、**ヒンジの軸を紙の厚みぶん
   持ち上げる**ことで出している（[[project_origami_app]]続き28）。
   だから高さは骨の親子をたどって積み上がる。どこか1つ符号や基準を間違えると、
   その先の骨が全部ずれる（＝折った紙が下へ潜る・表と裏が入れかわる）。

★測ること
   各骨の折り終わりの平均の高さ ÷ 紙の厚み が、
   2Dで計算した重なりの順（mesh.layerOrder）と一致するか。
   （いちばん低い骨を0にそろえて比べる）
"""
import sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 9047
from kit import target_works
WORKS = target_works()      # ★作品の名簿は works_build.BUILDERS ただ1か所

JS = r"""
(args) => {
  const id = args.id, upto = args.n;
  const w = window.ORIGAMI_WORKS[id];
  window._origamiDebug.openFold('work', w);
  const inst = window._origamiDebug.inst;
  inst.setThickness(9);
  const st = inst.state, M = w.mesh;
  w.steps.slice(0, upto).forEach((s, i) => {
    st.liveAngle[s.handle.boneId] = s.targetAngle;
    st.committedAngle[s.handle.boneId] = s.targetAngle;
    FOLD.syncLinkedAngle(st, s.handle.boneId, s.targetAngle, s);
    (s.handle.linkedBoneIds || []).forEach(lb => {
      const b = (typeof lb === 'object') ? lb.boneId : lb;
      st.committedAngle[b] = st.liveAngle[b];
    });
    st.doneSteps.add(i);
  });
  st.stepIndex = upto;
  const mats = FOLD.currentBoneMatrices(st);
  const ap = (m, v) => m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13];
  const sum = {}, cnt = {};
  for (let i = 0; i < M.verts.length; i++) {
    const b = M.panel[i];
    sum[b] = (sum[b] || 0) + ap(mats[b], M.verts[i]);
    cnt[b] = (cnt[b] || 0) + 1;
  }
  const n = M.boneParent.length, ys = [], box = [];
  for (let b = 0; b < n; b++) ys.push(cnt[b] ? sum[b] / cnt[b] : null);
  // 骨ごとの広がり（重なっているかを見るため）
  const bb = {};
  for (let i = 0; i < M.verts.length; i++) {
    const b = M.panel[i], m = mats[b], v = M.verts[i];
    const x = m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12];
    const z = m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14];
    const o = bb[b] || (bb[b] = {x0:1e9,x1:-1e9,z0:1e9,z1:-1e9});
    o.x0=Math.min(o.x0,x); o.x1=Math.max(o.x1,x);
    o.z0=Math.min(o.z0,z); o.z1=Math.max(o.z1,z);
  }
  for (let b = 0; b < n; b++) box.push(bb[b] || null);
  return { ys, layerOrder: M.layerOrder, want: M.layerByStep[upto],
           hingeY: M.hingeY, thick: inst.debugThickness(),
           foldStep: M.boneFoldStep, parent: M.boneParent, box };
}
"""


def main():
    from playwright.sync_api import sync_playwright
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    ok_all = True

    def check(name, ok, extra=''):
        nonlocal ok_all
        ok_all = ok_all and bool(ok)
        print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))

    with sync_playwright() as pw:
        br = pw.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
        pg = br.new_page(viewport={'width': 420, 'height': 480})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(600)
        for w in WORKS:
            nsteps = pg.evaluate("(id)=>window.ORIGAMI_WORKS[id].steps.length", w)
            bad_steps = []
            for n in range(1, nsteps + 1):
                r = pg.evaluate(JS, {'id': w, 'n': n})
                ys = [y for y in r['ys'] if y is not None]
                # ★くらべる相手は「折り終わりの重なり」。
                #   その手までに折り終わった骨どうしは、そのあと一緒に動くだけで
                #   上下の関係が変わらないので、最終の順番と同じでなければならない。
                #   （その手の時点の「下に何枚あるか」は、大きい紙と小さい紙で
                #     数え方の土俵が違うので、順番くらべには使えない）
                lo = r['layerOrder']
                if not ys or max(lo) == min(lo):
                    continue
                # ★目盛りは推定せず、実際の紙の厚みを使う
                t = r['thick']
                if t <= 1e-12:
                    bad_steps.append((n, 'ぺたんこ'))
                    continue
                # ★その手までに位置が決まった骨だけ見る。まだ折られていない骨は
                #   大きな1枚の紙の一部なので、高さは親と同じ＝場所ごとの
                #   重なりの数とは当然ちがう（テストが厳しすぎると誤検出になる）。
                fs, par = r['foldStep'], r['parent']
                def settled(b):
                    while b >= 0:
                        if fs[b] > n:
                            return False
                        b = par[b]
                    return True
                use = [b for b in range(len(lo))
                       if r['ys'][b] is not None and settled(b)]
                if not use:
                    continue
                # ★途中の姿勢は「絶対の高さ」では測れない。
                #   剛体の骨は、あとから下に紙が滑りこんでも持ち上がれないので、
                #   その紙のぶんだけ絶対値がずれるのは仕方がない（実物の紙は上がる）。
                #   意味があるのは**重なり合う紙どうしの上下の順**なので、そこを見る。
                bx = r['box']
                bad = []
                for ii in range(len(use)):
                    for jj in range(ii+1, len(use)):
                        a, b2 = use[ii], use[jj]
                        A, B = bx[a], bx[b2]
                        if not A or not B:
                            continue
                        ox = min(A['x1'],B['x1']) - max(A['x0'],B['x0'])
                        oz = min(A['z1'],B['z1']) - max(A['z0'],B['z0'])
                        if ox <= 1e-6 or oz <= 1e-6:
                            continue                      # 重なっていない
                        small = min((A['x1']-A['x0'])*(A['z1']-A['z0']),
                                    (B['x1']-B['x0'])*(B['z1']-B['z0']))
                        if small <= 0 or (ox*oz)/small < 0.25:
                            continue                      # かすっているだけ
                        if lo[a] == lo[b2]:
                            continue
                        want_up = 1 if lo[a] > lo[b2] else -1
                        got_up = 1 if r['ys'][a] > r['ys'][b2] + 1e-9 else (
                                 -1 if r['ys'][a] < r['ys'][b2] - 1e-9 else 0)
                        if got_up != want_up:
                            bad.append((a, b2, got_up, want_up))
                if bad:
                    bad_steps.append((n, bad[:4]))
            check(f'{w}: どの手の途中でも、重なり合う紙の上下の順が正しい',
                  not bad_steps, f'ずれた手(手,[(骨a,骨b,実測,正解)])={bad_steps[:3]}')
            r = pg.evaluate(JS, {'id': w, 'n': nsteps})
            ys = [y for y in r['ys'] if y is not None]
            lo = r['layerOrder']
            if not ys:
                check(f'{w}: 高さが測れた', False)
                continue
            t = r['thick']
            if t <= 0:
                check(f'{w}: 厚みが出ている', False)
                continue
            base = min(ys)
            got, want, bad = [], [], []
            for b in range(len(lo)):
                if r['ys'][b] is None:
                    continue
                g = round((r['ys'][b] - base) / t)
                wv = lo[b] - min(lo)
                got.append(g); want.append(wv)
                if g != wv:
                    bad.append((b, g, wv))
            check(f'{w}: 折り終わりの高さが、計算した重なりと一致',
                  not bad,
                  f'ずれた骨(骨,実測,計算)={bad[:6]}')
        check('エラー0件', len(errs) == 0, str(errs[:2]))
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
