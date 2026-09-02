"""紙が「折れない方向」へ動かないことを実測する。

★本人指示（2026-09-02）「紙が折れない方向に折れようとする挙動だけなくして」
   実物の紙は、折り目のついていない向きへは曲がらない。逆向きに少しでも動くと、
   下の紙を突き抜けて見える＝一枚の紙としてありえない動き。
   `fold.js`の`updateDrag`は以前、開始側に0.35ラジアン（約20度）の遊びを持っていた。

★測りかた
   本物のドラッグと同じ道すじ（beginDrag→updateDrag にレイを渡す）で、
   わざと逆向き・行き過ぎの位置へ引っぱり、角度が 0〜targetAngle の中に
   収まっているかを見る。
"""
import sys, threading, http.server, socketserver, functools, math
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 9019
from kit import target_works
WORKS = target_works()      # ★作品の名簿は works_build.BUILDERS ただ1か所

JS = r"""
(id) => {
  const work = window.ORIGAMI_WORKS[id];
  const st = FOLD.createState(work);
  const s = work.steps[0];
  const b = s.handle.boneId, h = work.mesh.hinge[b];
  const org = h.origin, ax = h.axis;
  const rest = FOLD.handleWorldPos(st, s);
  const rot = (p, ang) => {
    const v = [p[0]-org[0], p[1]-org[1], p[2]-org[2]];
    const c = Math.cos(ang), sn = Math.sin(ang);
    const d = v[0]*ax[0] + v[1]*ax[1] + v[2]*ax[2];
    const cr = [ax[1]*v[2]-ax[2]*v[1], ax[2]*v[0]-ax[0]*v[2], ax[0]*v[1]-ax[1]*v[0]];
    return [org[0]+v[0]*c+cr[0]*sn+ax[0]*d*(1-c),
            org[1]+v[1]*c+cr[1]*sn+ax[1]*d*(1-c),
            org[2]+v[2]*c+cr[2]*sn+ax[2]*d*(1-c)];
  };
  const ray = (p) => ({origin:[p[0]+ax[0]*5, p[1]+ax[1]*5, p[2]+ax[2]*5],
                       dir:[-ax[0],-ax[1],-ax[2]]});
  FOLD.beginDrag(st, ray(rot(rest, 0.01)), 0);
  const got = [];
  for (const ang of [-2.5, -1.2, -0.3, 0.4, 1.6, 3.5, 5.0]) {
    FOLD.updateDrag(st, ray(rot(rest, ang)));
    got.push(st.liveAngle[b]);
  }
  const t = s.targetAngle;
  return {got, lo: Math.min(0,t), hi: Math.max(0,t)};
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
        pg = br.new_page(viewport={'width': 480, 'height': 560})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(600)
        for w in WORKS:
            r = pg.evaluate(JS, w)
            eps = 1e-9
            out = [a for a in r['got'] if a < r['lo'] - eps or a > r['hi'] + eps]
            check(f'{w}: 逆向きへは1度も動かない・折りきりより先へも行かない',
                  not out,
                  f"はみ出し{[round(a,4) for a in out]}")
            back = [a for a in r['got'] if a < -eps]
            check(f'{w}: 逆向きに引っぱっても角度は0のまま', not back,
                  f"{[round(a,4) for a in r['got']]}")
        check('エラー0件', len(errs) == 0, str(errs[:2]))
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
