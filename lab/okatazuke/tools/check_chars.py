# -*- coding: utf-8 -*-
"""キャラ5人が 盤の上でも ちゃんと動くか、本物のゲームで確かめる。

  見るところ
    ・おす姿勢 … 腕が前に出て、肩まわりの布が裂けていないか
    ・よろこぶ … 腕を大きく上げても こわれないか（armSwingMax=2.4）
    ・ペット   … 頭にとまったまま ついてくるか

  ★スクショの直前に かならず 1回 描く。
    描かずに撮ると まっ黒なシルエットになることがある（headless の癖）。
"""
import os
import sys

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '_chars')
URL = 'http://127.0.0.1:8899/lab/okatazuke/index.html'
CHARS = ['okan2', 'otton', 'taitsu', 'g3', 'g3b', 'g5', 'g5b']


def main():
    pet = sys.argv[1] if len(sys.argv) > 1 else 'chicchi'
    shots = []
    bad = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader',
                                    '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 380, 'height': 640}, device_scale_factor=1)
        pg.on('pageerror', lambda e: bad.append(str(e)[:200]))
        pg.on('console', lambda m: bad.append(m.text[:200]) if m.type == 'error' else None)
        pg.add_init_script('navigator.serviceWorker && (navigator.serviceWorker.register = () '
                           '=> new Promise(() => {}));')
        for c in CHARS:
            pg.goto(URL + '?char=%s&pet=%s' % (c, pet), wait_until='domcontentloaded')
            pg.wait_for_function('window.__okReady === true', timeout=90000)
            pg.evaluate('okStartLevel(2)')
            pg.wait_for_timeout(700)
            # ★数手 おす（本物の入力の道を通す）
            for d in ['R', 'R', 'D', 'D']:
                pg.evaluate('d => okTryMove(d)', d)
                pg.wait_for_timeout(230)
            pg.wait_for_timeout(400)
            pg.evaluate('() => { OKG.R.resize(); okDraw(); }')
            f = os.path.join(OUT, 'p_%s_push.png' % c)
            pg.locator('#cv').screenshot(timeout=90000, animations='disabled', path=f)
            shots.append(f)
            # ★よろこぶ姿勢（クリア画面と同じ状態にする）
            pg.evaluate("() => { OKG.screen = 'clear'; }")
            pg.wait_for_timeout(900)
            pg.evaluate('() => { OKG.R.resize(); okDraw(); }')
            f = os.path.join(OUT, 'p_%s_cheer.png' % c)
            pg.locator('#cv').screenshot(timeout=90000, animations='disabled', path=f)
            shots.append(f)
            print('%-7s ok' % c)
        b.close()
    print('コンソール:', bad[:5] if bad else 'エラーなし')
    ims = [Image.open(f) for f in shots]
    w, h = ims[0].size
    sheet = Image.new('RGB', (w * len(CHARS), h * 2), (255, 255, 255))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i // 2) * w, (i % 2) * h))
    out = os.path.join(OUT, '_play_sheet_%s.png' % pet)
    sheet.save(out)
    print('→', out)


if __name__ == '__main__':
    main()
