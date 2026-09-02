"""オトン学園の本体から「折ON → おりがみで遊ぶ → 作品を折る」まで通しで実測する。

🚨ローカルで本体を開くと、本番のFirestoreに書きこまれることがある
   （[[feedback_local_test_writes_cloud]]：ダミーの達成率が本番ランキングに載った）。
   だから最初に firestore/googleapis への通信を全部落としてから開く。
"""
import sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
APP = HERE.parent.parent.parent          # tuna app/
PORT = 8983
BLOCK = ['**firestore.googleapis.com**', '**googleapis.com**', '**gstatic.com**',
         '**firebaseio.com**', '**google-analytics.com**']


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(APP))
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
        ctx = br.new_context(viewport={'width': 390, 'height': 780},
                             service_workers='block')
        for pat in BLOCK:
            ctx.route(pat, lambda route: route.abort())
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html')
        pg.wait_for_timeout(1200)

        check('折ONのバナーがある', pg.locator('#btn-origami').count() == 1)
        # ログイン画面で止まるので、バナーのクリックと同じことを直接呼ぶ
        pg.evaluate("() => { initOrigami(); showScreen('origami'); }")
        pg.wait_for_timeout(1800)
        fr = pg.frame_locator('#ori-frame')

        soon = fr.locator('#ori-home-fold[disabled]').count()
        check('「おりがみで遊ぶ」が押せる（準備中でない）', soon == 0, f'disabled={soon}')
        pg.screenshot(path=str(HERE / 'preview' / 'honntai_home.png'))

        fr.locator('#ori-home-fold').click()
        pg.wait_for_timeout(700)
        items = fr.locator('.ori-picker-item')
        n = items.count()
        # ★数を決め打ちにしない（作品を足すたびに落ちる）。名簿は BUILDERS ただ1か所。
        import works_build as _W
        check('作品が名簿の数だけならぶ', n == len(_W.BUILDERS), f'{n} / {len(_W.BUILDERS)}')
        texts = [items.nth(i).inner_text().replace('\n', ' / ') for i in range(n)]
        for t in texts:
            print('     ', t)
        # ★点いた星と暗い星はどちらも同じ「★」の字なので、文字列では区別できない。
        #   点いた数＝星ぜんたい − 暗い星、で数える（2026-09-02にここで一度だまされた）。
        lit = fr.locator('.ori-picker-item').evaluate_all(
            """els => els.map(e => {
                 const s = e.querySelector('.ori-picker-stars');
                 const off = s.querySelector('.ori-star-off');
                 return s.textContent.length - (off ? off.textContent.length : 0);
               })""")
        print('      点いている星:', lit)
        check('星は全部5個ぶん出ている', all('★' in t for t in texts))
        check('難易度が作品ごとに違う（全部同じでない）', len(set(lit)) >= 2, str(lit))
        check('手数がふえると星もふえる（逆転していない）',
              all(a <= b for a, b in zip(lit, lit[1:])), str(lit))
        check('どれにも手数が出ている', all('手' in t for t in texts))
        check('古い作品が消えている',
              not any(k in ' '.join(texts) for k in ['つる', 'だまし', 'ふうせん', 'test']),
              ' '.join(texts))
        pg.screenshot(path=str(HERE / 'preview' / 'honntai_picker.png'))

        # いちばんやさしい「おうち」を開いて、実際に1手折ってみる
        items.nth(0).click()
        pg.wait_for_timeout(900)
        r = pg.evaluate("""() => {
          const w = document.getElementById('ori-frame').contentWindow;
          const st = w._origamiDebug.inst.state;
          return {work: st.work.id, steps: st.work.steps.length,
                  hint: w.document.getElementById('ori-hint').textContent};
        }""")
        check('作品の画面が開く', bool(r['work']) and r['steps'] > 0, str(r))
        check('手順の字が出ている', len(r['hint']) > 4, r['hint'])
        pg.screenshot(path=str(HERE / 'preview' / 'honntai_fold.png'))

        check('通しでエラー0件', len(errs) == 0, str(errs[:3]))
        ctx.close(); br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
