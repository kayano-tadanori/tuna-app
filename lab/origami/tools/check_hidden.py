"""「隠したものが、本当に消えているか」を実際の画面で確かめる。

★なぜ要るか（2026-09-03、本人「折り紙問題の方も うっすら でてるんだよねw」）
   hidden を付けても、その要素に display(flex等)が指定してあると出たままになる。
   コンソールにエラーは出ない＝気づけない。実際、ふきかけバー(💨)が
   **全部の作品と、灘中対策の問題にまで**出ていた。

★見るもの
   ① どの要素も hidden を付けたら消えること（CSSの取りこぼし探し）
   ② ふきかけバーは「ふくらませられる作品」でだけ出ること
      （バーがあること自体が「完成したら形を変えられる」合図になる——本人の考え）
   ③ 灘中対策の問題では出ないこと
"""
import sys, threading, http.server, socketserver, functools
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PORT = 9061


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


# 全要素にいったん hidden を付けて、消えるかどうかを見る（付けた後は元に戻す）
JS_HIDDEN = r"""
() => {
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const had = el.hasAttribute('hidden');
    // ★ el.hidden = true は SVG 要素には効かない（SVGElement は HTMLElement では
    //   ないので hidden プロパティを持たず、ただのJSプロパティ代入になる）。
    //   属性で付ければ CSS の [hidden] は SVG にも効く。
    el.setAttribute('hidden', '');
    const d = getComputedStyle(el).display;
    if (!had) el.removeAttribute('hidden');
    if (d !== 'none') {
      bad.push((el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : el.tagName));
    }
  }
  return bad;
}
"""


def main():
    from playwright.sync_api import sync_playwright
    from kit import target_works
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
        pg.wait_for_timeout(700)

        bad = pg.evaluate(JS_HIDDEN)
        check('hidden を付けたら消える（消えない要素なし）', not bad,
              f'{len(bad)}個 消えない: {bad[:6]}')

        for w in target_works():
            pg.evaluate("(id) => window._origamiDebug.openFold('work', "
                        "window.ORIGAMI_WORKS[id])", w)
            pg.wait_for_timeout(250)
            vis = pg.locator('#ori-inflate-row').is_visible()
            want = bool(pg.evaluate("(id) => !!window.ORIGAMI_WORKS[id].inflate", w))
            check(f'{w}: ふきかけバーの出方が印どおり'
                  f'（{"出る" if want else "出ない"}）', vis == want,
                  f'実際は{"出ている" if vis else "出ていない"}')

        probs = pg.evaluate("() => Object.keys(window.ORIGAMI_PROBLEMS || {})")
        for pid in probs[:3]:
            pg.evaluate("(id) => window._origamiDebug.openFold('problem', "
                        "window.ORIGAMI_PROBLEMS[id])", pid)
            pg.wait_for_timeout(250)
            check(f'灘中対策({pid}): ふきかけバーが出ない',
                  not pg.locator('#ori-inflate-row').is_visible())

        check('エラー0件', len(errs) == 0, str(errs[:2]))
        br.close()
    httpd.shutdown()
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
