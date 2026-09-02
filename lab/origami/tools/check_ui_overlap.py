"""「手順の字が重なって読めない」が直ったかを、実際の画面で当たり判定を測って確かめる。

★見た目の不具合はコンソールエラーでは出ない（[[project_origami_app]]続き19の教訓）。
   要素の四角形どうしが本当に重なっていないかを数で見る。
"""
import sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 8981
SIZES = [('iPhone', 390, 780), ('iPad', 768, 1024), ('PC', 1200, 900)]


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


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
        for label, w, h in SIZES:
            pg = br.new_page(viewport={'width': w, 'height': h})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
            pg.wait_for_timeout(500)
            # かぶと（7手・字がいちばん長い）を開き、1手折った状態にして
            # 「⟲1つ前にもどす」と「✋自由に折ってみる」を両方出す
            pg.evaluate("() => window._origamiDebug.openFold('work', window.ORIGAMI_WORKS.kabuto)")
            pg.wait_for_timeout(500)
            pg.evaluate("""() => {
              const st = window._origamiDebug.inst.state;
              const s = st.work.steps[0];
              st.committedAngle[s.handle.boneId] = s.targetAngle;
              st.liveAngle[s.handle.boneId] = s.targetAngle;
              st.doneSteps.add(0); st.stepIndex = 1;
              document.getElementById('ori-step-back').hidden = false;
              document.getElementById('ori-free-toggle').hidden = false;
              document.getElementById('ori-hint').textContent = st.work.steps[1].hintLabel;
            }""")
            pg.wait_for_timeout(250)
            r = pg.evaluate("""() => {
              const ids = ['ori-fold-back','ori-hint','ori-step-back','ori-free-toggle'];
              const box = {};
              for (const id of ids) {
                const b = document.getElementById(id).getBoundingClientRect();
                box[id] = {x:b.x, y:b.y, w:b.width, h:b.height, vis: b.width>0 && b.height>0};
              }
              return box;
            }""")

            def overlap(a, b):
                A, B = r[a], r[b]
                if not (A['vis'] and B['vis']):
                    return 0
                ox = max(0, min(A['x']+A['w'], B['x']+B['w']) - max(A['x'], B['x']))
                oy = max(0, min(A['y']+A['h'], B['y']+B['h']) - max(A['y'], B['y']))
                return ox * oy

            pairs = [('ori-step-back', 'ori-free-toggle'),
                     ('ori-hint', 'ori-step-back'),
                     ('ori-hint', 'ori-free-toggle'),
                     ('ori-fold-back', 'ori-hint'),
                     ('ori-fold-back', 'ori-step-back'),
                     ('ori-fold-back', 'ori-free-toggle')]
            for a, b in pairs:
                check(f'{label}({w}px): {a} と {b} が重なっていない',
                      overlap(a, b) == 0, f'重なり {overlap(a,b):.0f}px²')
            inside = all(v['x'] >= -0.5 and v['x']+v['w'] <= w + 0.5
                         for v in r.values() if v['vis'])
            check(f'{label}({w}px): 画面からはみ出していない', inside,
                  str({k: round(v['x']+v['w']) for k, v in r.items() if v['vis']}))
            check(f'{label}({w}px): エラー0件', len(errs) == 0, str(errs[:2]))
            pg.screenshot(path=str(HERE / 'preview' / f'ui_{label}.png'))
            pg.close()
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
