# -*- coding: utf-8 -*-
"""テクスチャの大きさを 絵で決める（HANDOVER §10 次にやること③）。

1024 / 512 / 384 / 256 を実際に貼って、ゲーム中の実寸と 顔の寄りで見くらべる。
★ファイルは差しかえず、ブラウザの読みこみだけ横取りして 貼りかえる。
  （okan.js を触らずに 何度でも試せる）
"""
import io
import os
import sys

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '_tex')
os.makedirs(OUT, exist_ok=True)
SRC = os.path.join(ROOT, 'okan_tex.jpg')
SIZES = [1024, 512, 384, 256]
QUALITY = 88

# --- 大きさちがいを作る ---
base = Image.open(SRC).convert('RGB')
variants = {}
for s in SIZES:
    buf = io.BytesIO()
    im = base if s == base.width else base.resize((s, s), Image.LANCZOS)
    im.save(buf, 'JPEG', quality=QUALITY, subsampling=0)
    variants[s] = buf.getvalue()
    print(f'{s:5d}px … {len(buf.getvalue())/1024:6.1f} KB')

BASE = "http://127.0.0.1:8899/lab/okatazuke/index.html?okan=new"
shots = []

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    for s in SIZES:
        ctx = b.new_context(viewport={"width": 414, "height": 830}, device_scale_factor=2)
        data = variants[s]
        ctx.route("**/okan_tex.jpg", lambda r, d=data: r.fulfill(
            status=200, content_type="image/jpeg", body=d))
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
        pg.goto(BASE, wait_until="domcontentloaded")
        pg.wait_for_function("window.__okReady === true", timeout=60000)
        pg.evaluate("i => okStartLevel(i)", 0)
        pg.wait_for_timeout(700)
        for tag, zoom in (('whole', 1.0), ('zoom', 0.55), ('face', 0.30)):
            if zoom != 1.0:
                pg.evaluate("z => { OKG.cam.wholeOn = false; OKG.cam.zoom = z; }", zoom)
            pg.wait_for_timeout(1000)
            sp = pg.evaluate("""() => {
                const R = OKG.R, r = OKG.rig, s = r.scale || 1;
                const q = [r.pos[0], 0.75 * s, r.pos[2]];
                const vp = M4.mul(R.proj, R.view);
                const x = vp[0]*q[0] + vp[4]*q[1] + vp[8]*q[2] + vp[12];
                const y = vp[1]*q[0] + vp[5]*q[1] + vp[9]*q[2] + vp[13];
                const w = vp[3]*q[0] + vp[7]*q[1] + vp[11]*q[2] + vp[15];
                const hh = [0, 1.30*s].map(v => {
                  const yy = vp[1]*q[0] + vp[5]*v + vp[9]*q[2] + vp[13];
                  const ww = vp[3]*q[0] + vp[7]*v + vp[11]*q[2] + vp[15];
                  return (yy/ww) * 0.5 * R.canvas.clientHeight;
                });
                return { x: (x/w*0.5+0.5) * R.canvas.clientWidth,
                         y: (0.5 - y/w*0.5) * R.canvas.clientHeight,
                         h: Math.abs(hh[1]-hh[0]) };
            }""")
            path = os.path.join(OUT, f'{tag}_{s}.png')
            pg.screenshot(timeout=90000, animations="disabled", path=path)
            shots.append((tag, s, path, sp))
        print(f'  {s}px 撮った', 'エラー:', errs[:2] if errs else 'なし')
        ctx.close()
    b.close()

# --- 並べる ---
for tag in ('whole', 'zoom', 'face'):
    tiles = []
    for t, s, path, sp in shots:
        if t != tag:
            continue
        im = Image.open(path)
        h = max(70.0, sp['h'] * 1.15)
        box = (int((sp['x'] - h * 0.42) * 2), int((sp['y'] - h * 0.45) * 2),
               int((sp['x'] + h * 0.42) * 2), int((sp['y'] + h * 0.45) * 2))
        box = (max(0, box[0]), max(0, box[1]), min(im.width, box[2]), min(im.height, box[3]))
        c = im.crop(box)
        c = c.resize((int(c.width * 260 / max(1, c.height)), 260), Image.NEAREST)
        tiles.append((f'{s}px ({len(variants[s])//1024}KB)', c))
    if not tiles:
        continue
    W = max(t[1].width for t in tiles) + 8
    sheet = Image.new('RGB', (W * len(tiles), 286), (30, 20, 28))
    d = ImageDraw.Draw(sheet)
    for i, (lab, c) in enumerate(tiles):
        sheet.paste(c, (i * W + 4, 24))
        d.text((i * W + 6, 6), lab, fill=(255, 220, 235))
    sheet.save(os.path.join(OUT, f'_sheet_{tag}.png'))
    print('見くらべ:', os.path.join(OUT, f'_sheet_{tag}.png'))
