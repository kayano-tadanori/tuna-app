# -*- coding: utf-8 -*-
"""scripts/make_okatazuke_banner.py — 「オカンの おかたづけ」のカード用バナーを作る

  ★チッチジャンプ3D は キーアートから切り出したが、こちらは絵が無い。
    そのかわり **ゲームと同じ描画（lab/okatazuke/banner.html）で撮る**。
    カードの絵と 中身の見た目が ズレないのが利点。

  カードは **左半分にテキストが乗る**（style.css のグラデで左を暗く潰す）ので、
  オカン・にもつ・おきば は 右がわに寄せてある。

  使いかた:
    （先に  python -m http.server 8899  を tuna app で走らせておく）
    python scripts/make_okatazuke_banner.py
"""
import io
import os
import sys

from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'images', 'okatazuke-banner.png')
URL = 'http://127.0.0.1:8899/lab/okatazuke/banner.html'
W, H = 1200, 280           # 他のバナーとそろえる


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=[
            '--use-gl=angle', '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
        ])
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' else None)
        pg.goto(URL, wait_until='domcontentloaded')
        pg.wait_for_function('window.__bannerReady === true', timeout=60000)
        pg.wait_for_timeout(400)
        pg.evaluate('() => window.__ok.draw(1.2)')
        pg.wait_for_timeout(200)
        raw = pg.locator('#cv').screenshot(timeout=90000, animations='disabled')
        b.close()
    if errs:
        print('★コンソール:', errs[:4])

    im = Image.open(io.BytesIO(raw)).convert('RGB')
    print('撮った:', im.size)
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)

    # 左を すこし落として、文字が乗る側を おちつかせる（CSSのグラデと二重がけになりすぎない程度）
    grad = Image.new('L', (W, H), 0)
    gp = grad.load()
    for x in range(W):
        v = int(max(0, 70 - x * 70 / (W * 0.42)))
        for y in range(H):
            gp[x, y] = v
    dark = Image.new('RGB', (W, H), (26, 14, 22))
    im = Image.composite(dark, im, grad.point(lambda v: v))
    im = Image.blend(im, im.filter(ImageFilter.SMOOTH), 0.15)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    im.save(OUT, optimize=True)
    print('かきだし:', os.path.normpath(OUT), im.size,
          '%.0fKB' % (os.path.getsize(OUT) / 1024))


if __name__ == '__main__':
    main()
