# -*- coding: utf-8 -*-
"""あそび中の 🏠（タイトルへ）が ちゃんと働くか、本物の指タップで たしかめる。

  ・あそび中に 🏠 → タイトルに もどる
  ・とちゅうの手は のこっている（「とちゅうから」が 出る）
  ・そこから キャラを かえて、また あそべる
  ・消したファイル（okan_model.js など）を まだ読みにいっていない
"""
import os

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'http://127.0.0.1:8899/lab/okatazuke/index.html'
GONE = ('okan_model.js', 'okan_faces.js', 'okan_tex.jpg', 'okan_face.js', 'okan_tex_src.jpg')


def main():
    ng, bad, asked = [], [], []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader',
                                    '--enable-unsafe-swiftshader'])
        ctx = b.new_context(viewport={'width': 390, 'height': 760},
                            has_touch=True, is_mobile=True)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: bad.append(str(e)[:200]))
        pg.on('console', lambda m: bad.append(m.text[:200]) if m.type == 'error' else None)
        pg.on('request', lambda r: asked.append(r.url.split('/')[-1]))
        pg.add_init_script('navigator.serviceWorker && (navigator.serviceWorker.register = () '
                           '=> new Promise(() => {}));')

        def tap(sel):
            el = pg.locator(sel)
            el.wait_for(state='visible', timeout=15000)
            el.scroll_into_view_if_needed()
            bb = el.bounding_box()
            pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
            pg.wait_for_timeout(500)

        pg.goto(URL, wait_until='domcontentloaded')
        pg.wait_for_function('window.__okReady === true', timeout=90000)
        pg.wait_for_timeout(500)

        # あそぶ → 何手か 動かす → 🏠
        tap('#btn-start')
        tap('#level-list .lv-btn >> nth=3')
        pg.wait_for_timeout(800)
        for d in ['R', 'D', 'R']:
            pg.evaluate('d => okTryMove(d)', d)
            pg.wait_for_timeout(240)
        moved = pg.evaluate('() => OKG.game.history.length')
        if moved < 1:
            ng.append('手が すすんでいない')
        tap('#btn-home')
        if pg.evaluate('() => OKG.screen') != 'title':
            ng.append('🏠 で タイトルに もどらない')
        cont = pg.locator('#btn-continue')
        if cont.evaluate('e => e.style.display') == 'none':
            ng.append('「とちゅうから」が 出ない')
        else:
            txt = cont.text_content()
            if 'とちゅう' not in txt:
                ng.append('つづきの文字が へん: %s' % txt)
            print('つづきボタン:', txt)

        # タイトルから キャラを かえて また あそぶ
        tap('#btn-chars')
        tap('#char-list .cc >> nth=1')
        pg.wait_for_function("() => OKG.charId === 'otton'", timeout=30000)
        tap('#btn-char-ok')
        tap('#btn-continue')
        pg.wait_for_timeout(900)
        if pg.evaluate('() => OKG.screen') != 'play':
            ng.append('「とちゅうから」で あそびに もどれない')
        if pg.evaluate('() => OKG.game.history.length') != moved:
            ng.append('とちゅうの手が のこっていない')
        # 消したファイルを 読みにいっていないか
        for g in GONE:
            if g in asked:
                ng.append('消したはずの %s を まだ読みにいっている' % g)
        ctx.close()
        b.close()
    if bad:
        ng.append('コンソール: %s' % bad[:4])
    print('=== けっか ===')
    print('ぜんぶ OK' if not ng else '\n'.join('NG: ' + x for x in ng))


if __name__ == '__main__':
    main()
