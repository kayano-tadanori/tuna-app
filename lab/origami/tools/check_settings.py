"""せってい（紙の色・厚み）が本当に効いているかを、画面のピクセルで実測する。

★「設定を変えた」と「画面が変わった」は別（[[project_origami_app]]続き19の教訓）。
   だからスクリーンショットの色を数えて、前後で本当に変わったかを見る。
"""
import sys, threading, http.server, socketserver, functools, io
from pathlib import Path
from collections import Counter

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 8985


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def top_colors(png_bytes, n=6):
    from PIL import Image
    im = Image.open(io.BytesIO(png_bytes)).convert('RGB')
    im = im.resize((160, 160))
    c = Counter(im.getdata())
    # 背景（暗い紺）は除く
    return [(rgb, k) for rgb, k in c.most_common(40) if sum(rgb) > 160][:n]


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
        pg = br.new_page(viewport={'width': 420, 'height': 820})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/origami/index.html')
        pg.wait_for_timeout(600)

        check('せっていボタンがある', pg.locator('#ori-home-settings').count() == 1)
        pg.click('#ori-home-settings')
        pg.wait_for_timeout(300)
        sw = pg.locator('#ori-sw-front .ori-swatch').count()
        check('おもての色見本が12色ならぶ', sw == 12, str(sw))
        check('うらの色見本も12色', pg.locator('#ori-sw-back .ori-swatch').count() == 12)
        pg.screenshot(path=str(HERE / 'preview' / 'settings_screen.png'))

        # ★色の効き目は「おうち」で見る。かぶとは折り図どおりに折ると
        #   完成形が裏面ばかりになり、おもての色が画面に出ない（不具合ではない）。
        def fold_all(thick=None, front=None, back=None):
            pg.evaluate("""(args) => {
              const w = window.ORIGAMI_WORKS.ie;
              window._origamiDebug.openFold('work', w);
              const inst = window._origamiDebug.inst;
              if (args.front) inst.setColor(args.front, args.back);
              if (args.thick !== null) inst.setThickness(args.thick);
              const st = inst.state;
              w.steps.forEach((s, i) => {
                st.committedAngle[s.handle.boneId] = s.targetAngle;
                st.liveAngle[s.handle.boneId] = s.targetAngle;
                (s.handle.linkedBoneIds||[]).forEach(lb => {
                  const b = (typeof lb==='object') ? lb.boneId : lb;
                  st.committedAngle[b] = s.targetAngle; st.liveAngle[b] = s.targetAngle;
                });
                st.doneSteps.add(i);
              });
              st.stepIndex = w.steps.length;
            }""", {'thick': thick, 'front': front, 'back': back})
            pg.wait_for_timeout(700)

        fold_all(thick=0)
        flat = pg.screenshot(path=str(HERE / 'preview' / 'thick_0.png'))
        fold_all(thick=14)
        thick = pg.screenshot(path=str(HERE / 'preview' / 'thick_14.png'))
        check('厚みを変えると画面が変わる', flat != thick,
              'まったく同じ画像なら効いていない')

        fold_all(thick=8, front=[0.29, 0.56, 0.91], back=[1, 0.86, 0.3])
        blue = pg.screenshot(path=str(HERE / 'preview' / 'color_blue.png'))
        cols = top_colors(blue)
        print('     出ている色:', cols)
        # 青系（B が R より大きい）が出ているか
        has_blue = any(b > r + 25 for (r, g, b), _ in cols)
        has_yellow = any(r > 120 and g > 100 and b < g - 25 for (r, g, b), _ in cols)
        check('おもての色を青にすると青が出る', has_blue, str(cols[:3]))
        check('うらの色を黄にすると黄が出る', has_yellow, str(cols[:3]))

        # 設定が端末に残るか
        pg.evaluate("""() => {
          const el = document.getElementById('ori-thick');
          el.value = 7; el.dispatchEvent(new Event('input'));   // ★あつさは0〜10
          document.querySelector('#ori-sw-front .ori-swatch:nth-child(6)').click();
        }""")
        pg.wait_for_timeout(200)
        rng = pg.evaluate("""() => { const e = document.getElementById('ori-thick');
          return {min: e.min, max: e.max}; }""")
        # ★本人 2026-09-03「紙の厚さはデフォルトを1にして　最大10ぐらいまでに」
        check('あつさのめもりは0〜10', rng == {'min': '0', 'max': '10'}, str(rng))
        saved = pg.evaluate("() => localStorage.getItem('ori-settings-v1')")
        check('えらんだ設定が端末に残る', saved and '"thick"' in saved, str(saved))
        pg.reload()
        pg.wait_for_timeout(700)
        again = pg.evaluate("""() => {
          document.getElementById('ori-home-settings').click();
          return document.getElementById('ori-thick').value;
        }""")
        check('開き直しても設定が残っている', str(again) == '7', str(again))

        check('通してエラー0件', len(errs) == 0, str(errs[:3]))
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
