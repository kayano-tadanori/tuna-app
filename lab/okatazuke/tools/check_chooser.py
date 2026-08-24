# -*- coding: utf-8 -*-
"""「だれで あそぶ？」の画面を 本物の指タップで ひと通り触る。

  たしかめること
    ・タイトル → えらぶ画面 が 開く
    ・キャラを押すと その場で 入れかわる（localStorage にも のこる）
    ・ペットを押すと 頭の上が 入れかわる
    ・「これで あそぶ」で もどる／読みこみ直しても 覚えている
"""
import os

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_chars')
URL = 'http://127.0.0.1:8899/lab/okatazuke/index.html'


def tap(pg, sel):
    el = pg.locator(sel)
    el.wait_for(state='visible', timeout=15000)
    el.scroll_into_view_if_needed()
    box = el.bounding_box()
    pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    pg.wait_for_timeout(500)


def main():
    ng = []
    bad = []
    shots = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader',
                                    '--enable-unsafe-swiftshader'])
        ctx = b.new_context(viewport={'width': 390, 'height': 700},
                            has_touch=True, is_mobile=True, device_scale_factor=1)
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: bad.append(str(e)[:200]))
        pg.on('console', lambda m: bad.append(m.text[:200]) if m.type == 'error' else None)
        pg.add_init_script('navigator.serviceWorker && (navigator.serviceWorker.register = () '
                           '=> new Promise(() => {}));')
        pg.goto(URL, wait_until='domcontentloaded')
        pg.wait_for_function('window.__okReady === true', timeout=90000)
        pg.wait_for_timeout(600)

        tap(pg, '#btn-chars')
        if not pg.locator('#scr-chars').evaluate('e => e.classList.contains("show")'):
            ng.append('えらぶ画面が 開かない')
        n = pg.locator('#char-list .cc').count()
        m = pg.locator('#pet-list .cc').count()
        if n != 7:
            ng.append('キャラの数が %d（7のはず）' % n)
        if m != 4:
            ng.append('ペットの数が %d（4のはず）' % m)

        # 5人 ぜんぶ 押してみる
        for i in range(n):
            cid = pg.locator('#char-list .cc').nth(i).get_attribute('data-id')
            print('  キャラ', i, cid, flush=True)
            tap(pg, '#char-list .cc >> nth=%d' % i)
            pg.wait_for_function('id => OKG.charId === id', arg=cid, timeout=30000)
            on = pg.locator('#char-list .cc.on').get_attribute('data-id')
            if on != cid:
                ng.append('%s を押したのに 光っているのは %s' % (cid, on))
            if pg.evaluate('() => !OKG.okan'):
                ng.append('%s で モデルが 消えた' % cid)
            f = os.path.join(OUT, 'ui_%s.png' % cid)
            pg.screenshot(path=f, timeout=90000, animations='disabled')
            shots.append(f)

        # ペットを ぜんぶ
        for i in range(m):
            pid = pg.locator('#pet-list .cc').nth(i).get_attribute('data-id')
            print('  ペット', i, pid, flush=True)
            tap(pg, '#pet-list .cc >> nth=%d' % i)
            pg.wait_for_function('id => OKG.petId === id', arg=pid, timeout=30000)
            pg.wait_for_timeout(400)
            has = pg.evaluate('() => !!OKG.pet')
            if (pid == 'none') == has:
                ng.append('ペット %s の 出しわけが おかしい（pet=%s）' % (pid, has))
            f = os.path.join(OUT, 'ui_pet_%s.png' % pid)
            pg.screenshot(path=f, timeout=90000, animations='disabled')
            shots.append(f)

        # チッチに もどして 「これで あそぶ」
        tap(pg, '#pet-list .cc >> nth=1')
        tap(pg, '#btn-char-ok')
        if not pg.locator('#scr-title').evaluate('e => e.classList.contains("show")'):
            ng.append('「これで あそぶ」で タイトルに もどらない')

        saved = pg.evaluate('() => [localStorage.okatazukeChar, localStorage.okatazukePet]')
        # 読みこみ直して 覚えているか
        pg.goto(URL, wait_until='domcontentloaded')
        pg.wait_for_function('window.__okReady === true', timeout=90000)
        again = pg.evaluate('() => [OKG.charId, OKG.petId]')
        if list(saved) != list(again):
            ng.append('覚えていない: 保存 %s / 読みこみ後 %s' % (saved, again))
        print('のこした えらび:', saved)

        # あそべるか（えらんだキャラのまま 面に入る）
        tap(pg, '#btn-start')
        tap(pg, '#level-list .lv-btn >> nth=0')
        pg.wait_for_timeout(700)
        if pg.evaluate('() => OKG.screen') != 'play':
            ng.append('えらんだあと 面に入れない')
        ctx.close()
        b.close()

    if bad:
        ng.append('コンソール: %s' % bad[:4])
    ims = [Image.open(f) for f in shots]
    if ims:
        w, h = ims[0].size
        sheet = Image.new('RGB', (w * len(ims), h), (255, 255, 255))
        for i, im in enumerate(ims):
            sheet.paste(im, (i * w, 0))
        sheet.save(os.path.join(OUT, '_ui_sheet.png'))
        print('→ _chars/_ui_sheet.png')
    print('=== けっか ===')
    print('ぜんぶ OK' if not ng else '\n'.join('NG: ' + x for x in ng))


if __name__ == '__main__':
    main()
