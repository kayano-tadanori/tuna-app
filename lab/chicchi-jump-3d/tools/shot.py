# -*- coding: utf-8 -*-
"""チッチ3Dモデルの実測スクリーンショット。
   見つもりでなく実際に描かれた絵を見て判定するためのもの。
   使い方: python tools/shot.py [出力ディレクトリ]
"""
import sys, os, json
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/lab/chicchi-jump-3d/preview.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "_shots")
os.makedirs(OUT, exist_ok=True)

# (ファイル名, yaw, pitch, ポーズ, 進めるフレーム数, 追加設定)
VIEWS = [
    ("01_front",      0.00,  0.06, None,     40, {}),
    ("02_front34",    0.62,  0.10, None,     40, {}),
    ("03_side",       1.57,  0.06, None,     40, {}),
    ("04_back",       3.14,  0.06, None,     40, {}),
    ("05_low",        0.45, -0.35, None,     40, {}),
    ("06_high",       0.45,  0.55, None,     40, {}),
    ("07_silhouette", 0.62,  0.10, None,     40, {"silhouette": True}),
    ("08_land",       0.40,  0.08, "land",    3, {}),
    ("09_launch",     0.40,  0.08, "launch",  4, {}),
    ("10_spring",     0.40,  0.08, "spring",  3, {}),
    ("11_flip",       0.40,  0.08, "flip",   14, {}),
    ("12_hurt",       0.40,  0.08, "hurt",    5, {}),
]

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    pg = b.new_page(viewport={"width": 560, "height": 760}, device_scale_factor=2)
    errors = []
    pg.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

    pg.goto(URL, wait_until="load")
    pg.wait_for_function("window.__cjReady === true", timeout=15000)
    pg.wait_for_timeout(400)

    stats = pg.evaluate("window.__cj.stats")
    print("mesh:", json.dumps(stats))

    for name, yaw, pitch, pose, steps, extra in VIEWS:
        pg.evaluate("() => window.__cj.reset()")
        pg.evaluate("o => window.__cj.set(o)", {"silhouette": False, "spin": False, **extra})
        pg.evaluate("a => window.__cj.setView(a[0], a[1])", [yaw, pitch])
        if pose:
            # まず落ちついた状態を作ってからポーズを入れる
            pg.evaluate("() => window.__cj.step(30, 1/60, {vy:0})")
            pg.evaluate("n => window.__cj.pose(n)", pose)
        else:
            pg.evaluate("() => window.__cj.step(30, 1/60, {vy:-2})")
        pg.evaluate("n => window.__cj.step(n, 1/60, {vy:-2})", steps)
        pg.wait_for_timeout(60)
        path = os.path.join(OUT, name + ".png")
        pg.locator("#c").screenshot(path=path)
        print("shot:", path)

    err_text = pg.evaluate("document.getElementById('err').textContent")
    b.close()

print("--- console ---")
for e in errors[:40]:
    print(e)
if err_text.strip():
    print("--- page error box ---")
    print(err_text)
print("errors:", len(errors))
