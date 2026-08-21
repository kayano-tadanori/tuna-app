# -*- coding: utf-8 -*-
"""地上から宇宙まで、高さを追って撮る。
   ★「はじめたところ」を必ず1枚目に撮る。ここが壊れていると何も確かめられない。

   python lab/chicchi-jump-3d/tools/climb.py
"""
import sys, os
from playwright.sync_api import sync_playwright

SEED = 20260820
URL = f"http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html?seed={SEED}"
OUT = os.path.join(os.path.dirname(__file__), "_climb")
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith(".png"):
        os.remove(os.path.join(OUT, f))

# 進行度と、そこで何を見たいか
STOPS = [
    (0,     "start_ビルの中"),
    (150,   "ビルの上"),
    (400,   "雲の上"),
    (700,   "富士山より高く"),
    (1000,  "カーマンライン"),
    (1600,  "宇宙・地球が下に"),
    (2400,  "地球がはなれる"),
    (3000,  "月"),
    (5000,  "火星"),
    (7500,  "木星"),
    (8500,  "土星"),
    (11500, "冥王星"),
    (13000, "ヘリオポーズ"),
]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 390, "height": 720}, device_scale_factor=2)
    logs = []
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.on("console", lambda m: logs.append(m.type + ": " + m.text) if m.type == "error" else None)
    pg.goto(URL, wait_until="load")
    pg.wait_for_function("window.__cjReady === true", timeout=15000)
    pg.click("#ov-go")

    for i, (at, name) in enumerate(STOPS):
        if at > 0:
            pg.evaluate("""a => { const c=window.__cj.core;
              c.over=false; window.__cj.setRunning(true); window.__cj.warpP(a);
              window.__cj.setRunning(false); }""", at)
        pg.wait_for_timeout(500)
        pg.screenshot(path=os.path.join(OUT, f"{i:02d}_{at}.png"))
        st = pg.evaluate("() => ({ p: Math.round(window.__cj.core.progress), scr: window.__cj.chicchiScreen() })")
        inside = abs(st["scr"]["x"]) <= 1 and abs(st["scr"]["y"]) <= 1
        print(f"{i:02d}_{at}.png  {name}  チッチ画面内={'OK' if inside else 'NG'} "
              f"(x={st['scr']['x']:+.2f} y={st['scr']['y']:+.2f})")

    b.close()
print("errors:", len(logs))
for l in logs[:10]:
    print(l)
