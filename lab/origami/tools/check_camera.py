"""上下の回転が「伝承折り紙は自由・灘中対策の問題は制限つき」になっているか実測する。

★本人指示（2026-09-02）
   「横向きには回転するけど、上下に回転の制限かけない方がいい」
   「これは折紙問題には適用しないでね。あっちが裏まで回転しちゃうと こんがらがるから」
"""
import sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 9023

JS = r"""
(args) => {
  const store = args.kind === 'work' ? window.ORIGAMI_WORKS : window.ORIGAMI_PROBLEMS;
  window._origamiDebug.openFold(args.kind, store[args.id]);
  return true;
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
        pg.wait_for_timeout(700)

        probs = pg.evaluate("() => Object.keys(window.ORIGAMI_PROBLEMS || {})")
        cases = [('work', 'kabuto', True), ('work', 'ie', True)]
        if probs:
            cases.append(('problem', probs[0], False))

        def drag(dy):
            box = pg.locator('#ori-canvas').bounding_box()
            cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            pg.mouse.move(cx, cy)
            pg.mouse.down()
            pg.mouse.move(cx, cy + dy, steps=14)
            pg.mouse.up()
            pg.wait_for_timeout(300)

        def pitch():
            return pg.evaluate("() => window._origamiDebug.inst.debugCamera()")

        LO, HI = 0.12, 1.45
        for kind, wid, free in cases:
            pg.evaluate(JS, {'kind': kind, 'id': wid})
            pg.wait_for_timeout(600)
            label = '伝承折り紙' if kind == 'work' else '灘中対策の問題'
            check(f'{label}({wid}): 自由回転の設定が {free}',
                  pitch()['free'] is free, str(pitch()))
            drag(-500); up = pitch()['pitch']
            drag(500); drag(500); dn = pitch()['pitch']
            if free:
                # ★自由回転は -π〜π に巻き戻るので「値が大きくなる」では判定できない。
                #   制限の範囲(LO〜HI)の外に出られるか、で見る。
                check(f'{label}({wid}): 上に振り切ると制限の外まで回る',
                      not (LO - 1e-6 <= up <= HI + 1e-6), f'pitch={up:.3f}')
                check(f'{label}({wid}): 下に振り切っても制限の外まで回る',
                      not (LO - 1e-6 <= dn <= HI + 1e-6), f'pitch={dn:.3f}')
            else:
                check(f'{label}({wid}): 上は {LO} で止まる', abs(up - LO) < 1e-6,
                      f'pitch={up:.3f}')
                check(f'{label}({wid}): 下は {HI} で止まる（裏返らない）',
                      abs(dn - HI) < 1e-6, f'pitch={dn:.3f}')
        # ★裏返って見ているときも、横に振る向きが「画面の上で」反転しないか。
        #   ⚠内部の数値(yaw)の符号で見てはいけない——裏では符号が反転するのが
        #     正しい（画面で同じ向きに見せるための打ち消し。renderer.jsのyawDir）。
        #     2026-09-03まで符号で判定していて、正しい実装を「NG」と鳴らしていた。
        #   だから**画面のどこに見えているか**を実測する（debugProject）。
        pg.evaluate(JS, {'kind': 'work', 'id': 'kabuto'})
        pg.wait_for_timeout(500)

        def front_x():
            """紙の手前がわに見えている点の、画面での横位置。"""
            return pg.evaluate("""() => {
              const d = window._origamiDebug.inst;
              const A = d.debugProject([0.6, 0, 0]), B = d.debugProject([-0.6, 0, 0]);
              if (!A || !B) return null;
              return (A.w < B.w) ? A.x : B.x;   // カメラに近い方＝手前に見えている点
            }""")

        def drag_measure(dx):
            """指を離さずに測る（離すと慣性でぐるぐる回って、手前の点が
               入れかわってしまう）。"""
            box = pg.locator('#ori-canvas').bounding_box()
            cx, cy = box['x'] + box['width']/2, box['y'] + box['height']/2
            pg.mouse.move(cx, cy); pg.mouse.down()
            pg.wait_for_timeout(150)
            a = front_x()
            pg.mouse.move(cx + dx, cy, steps=6)
            pg.wait_for_timeout(150)
            b = front_x()
            pg.mouse.up(); pg.wait_for_timeout(400)
            return None if (a is None or b is None) else b - a

        up_right = drag_measure(60)
        # ★裏を向くまで回す。回数を決め打ちにすると、一周して表に
        #   戻った所で止まり「とばす」になる（2026-09-03に実際そうなった）。
        #   確認をとばすのは、通ったことにならないので NG にする。
        def is_upside():
            return pg.evaluate("() => Math.cos(window._origamiDebug.inst.debugCamera().pitch) < 0")
        upside = False
        for _ in range(10):
            if is_upside():
                upside = True
                break
            drag(-260)
        if not upside:
            check('裏から見る状態まで回せる', False, '10回回しても裏を向かない')
        else:
            down_right = drag_measure(60)
            ok = (up_right is not None and down_right is not None
                  and abs(up_right) > 1 and abs(down_right) > 1
                  and (up_right > 0) == (down_right > 0))
            check('裏から見ても、右へ引いたら画面の上で同じ向きに回る', ok,
                  f'手前の点の動き 表={up_right:+.1f}px 裏={down_right:+.1f}px')
        check('エラー0件', len(errs) == 0, str(errs[:2]))
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
