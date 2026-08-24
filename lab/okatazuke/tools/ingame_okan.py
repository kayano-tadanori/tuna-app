# -*- coding: utf-8 -*-
"""ゲーム中の実寸で 手組みオカンと 取りこんだオカンを見比べる。

★見つもりで決めない。「画面で何ピクセルになるか」を測ってから 絵で判断する。
   使い方: python tools/ingame_okan.py [出力先]
"""
import os
import sys

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '_ingame')
os.makedirs(OUT, exist_ok=True)
BASE = "http://127.0.0.1:8899/lab/okatazuke/index.html"

# (名前, 面の番号, ズーム倍率)  ※ズーム1.0＝盤ぜんぶが見える既定
CASES = [
    ('a_small_whole', 0, 1.00),    # 小さい面・既定
    ('b_small_zoom', 0, 0.55),     # 小さい面・寄り
    ('c_mid_whole', 60, 1.00),     # 中くらいの面・既定（いちばん多い見え方）
    ('d_big_whole', 120, 1.00),    # 大きい面・既定（いちばん小さく映る）
]

crops = []
tris = {}

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    for kind in ('old', 'new'):
        pg = b.new_page(viewport={"width": 414, "height": 830}, device_scale_factor=2)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
        pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        pg.goto(BASE + "?okan=" + kind, wait_until="load")
        pg.wait_for_function("window.__okReady === true", timeout=25000)
        tri = pg.evaluate("() => OKG.okan.count / 3")
        tris[kind] = tri
        print(f'--- {kind}（三角 {tri:,.0f}）')
        for name, lv, zoom in CASES:
            pg.evaluate("i => okStartLevel(i)", lv)
            pg.wait_for_timeout(700)
            if zoom != 1.0:
                pg.evaluate("z => { OKG.cam.wholeOn = false; OKG.cam.zoom = z; }", zoom)
            pg.wait_for_timeout(1100)
            # オカンが画面で何ピクセルになるか（頭のてっぺんと足もとを投影して測る）
            px = pg.evaluate("""() => {
                const R = OKG.R, r = OKG.rig;
                const s = r.scale || 1;
                const pts = [[r.pos[0], 0, r.pos[2]], [r.pos[0], 1.30 * s, r.pos[2]]];
                const vp = M4.mul(R.proj, R.view);
                const ys = pts.map(q => {
                  const y = vp[1]*q[0] + vp[5]*q[1] + vp[9]*q[2] + vp[13];
                  const w = vp[3]*q[0] + vp[7]*q[1] + vp[11]*q[2] + vp[15];
                  return (y / w) * 0.5 * R.canvas.clientHeight;
                });
                return Math.abs(ys[1] - ys[0]);
            }""")
            shot = os.path.join(OUT, f'{name}_{kind}.png')
            pg.screenshot(timeout=90000, animations="disabled", path=shot)
            # ★オカンの居場所を投影して そこだけ切り出す（手で座標を決めない）
            sp = pg.evaluate("""() => {
                const R = OKG.R, r = OKG.rig, s = r.scale || 1;
                const q = [r.pos[0], 0.65 * s, r.pos[2]];
                const vp = M4.mul(R.proj, R.view);
                const x = vp[0]*q[0] + vp[4]*q[1] + vp[8]*q[2] + vp[12];
                const y = vp[1]*q[0] + vp[5]*q[1] + vp[9]*q[2] + vp[13];
                const w = vp[3]*q[0] + vp[7]*q[1] + vp[11]*q[2] + vp[15];
                return { x: (x/w*0.5+0.5) * R.canvas.clientWidth,
                         y: (0.5 - y/w*0.5) * R.canvas.clientHeight };
            }""")
            crops.append((f'{name}_{kind}', shot, sp, px))
            print(f'   {name:16s} オカンの高さ {px:5.1f}px（CSS）')
        print('   エラー:', errs[:3] if errs else 'なし')
        pg.close()
    b.close()

# 切り出して 実寸と4倍で 並べる
try:
    from PIL import Image, ImageDraw
    DS = 2                      # device_scale_factor
    tiles = []
    for name, shot, sp, px in crops:
        im = Image.open(shot)
        h = max(60.0, px * 1.8)
        box = (int((sp['x'] - h * 0.55) * DS), int((sp['y'] - h * 0.75) * DS),
               int((sp['x'] + h * 0.55) * DS), int((sp['y'] + h * 0.75) * DS))
        box = (max(0, box[0]), max(0, box[1]), min(im.width, box[2]), min(im.height, box[3]))
        c = im.crop(box)
        c = c.resize((int(c.width * 200 / max(1, c.height)), 200), Image.NEAREST)
        tiles.append((name, c))
    W = max(t[1].width for t in tiles) + 8
    sheet = Image.new('RGB', (W * len(tiles), 224), (30, 20, 28))
    d = ImageDraw.Draw(sheet)
    for i, (lab, c) in enumerate(tiles):
        sheet.paste(c, (i * W + 4, 22))
        d.text((i * W + 4, 6), lab, fill=(255, 220, 235))
    sheet.save(os.path.join(OUT, '_sheet.png'))
    print('見くらべ:', os.path.join(OUT, '_sheet.png'))
except Exception as e:
    print('並べるのに失敗:', e)
print('三角の数:', tris)
print('書いた:', OUT)
