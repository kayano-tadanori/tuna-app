# -*- coding: utf-8 -*-
"""オカンのモデルを実際に描いて撮る。見つもりでなく絵で判定するための道具。
   使い方: python tools/shot.py [出力ディレクトリ] [old|new]
     第2引数 new … Tripoから取りこんだオカン（preview.html に ?okan=new を付ける）
   （先に  python -m http.server 8899  を tuna app で走らせておく）
"""
import sys, os
from playwright.sync_api import sync_playwright

KIND = sys.argv[2] if len(sys.argv) > 2 else "old"
URL = "http://127.0.0.1:8899/lab/okatazuke/preview.html?okan=" + KIND
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "_shot")
os.makedirs(OUT, exist_ok=True)

VIEWS = [
    ("01_front",   0.00, 0.06, 1, 40),
    ("02_front34", 0.60, 0.10, 1, 40),
    ("03_side",    1.57, 0.06, 1, 40),
    ("04_back",    3.14, 0.06, 1, 40),
    ("05_high",    0.60, 0.62, 1, 40),   # ゲーム中の見おろしに近い角度
    ("06_walk",    0.60, 0.20, 2, 22),
    ("07_push",    0.60, 0.20, 3, 30),
    ("08_cheer",   0.30, 0.16, 4, 26),
    ("09_sad",     0.30, 0.16, 5, 30),
    ("10_face",    0.00, 0.30, 1, 40),
]

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    pg = b.new_page(viewport={"width": 520, "height": 700}, device_scale_factor=2)
    errs = []
    pg.on("console", lambda m: errs.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
    pg.goto(URL, wait_until="load")
    pg.wait_for_function("window.__ready === true", timeout=20000)
    pg.evaluate("() => window.__ok.setAuto(false)")
    print("verts:", pg.evaluate("() => window.__ok.stats()"))
    for name, yaw, pitch, mode, steps in VIEWS:
        dist = 0.95 if name == "10_face" else 2.1
        pg.evaluate("a => window.__ok.setView(a[0], a[1], a[2])", [yaw, pitch, dist])
        pg.evaluate("m => window.__ok.setMode(m)", mode)
        pg.evaluate("n => window.__ok.step(n, 1/60)", steps)
        pg.wait_for_timeout(50)
        pg.locator("#cv").screenshot(path=os.path.join(OUT, name + ".png"))
        print("shot:", name)
    b.close()
    if errs:
        print("=== コンソールエラー ===")
        for e in errs[:20]:
            print(e)
    else:
        print("コンソールエラー なし")
