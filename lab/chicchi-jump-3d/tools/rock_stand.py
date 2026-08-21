# -*- coding: utf-8 -*-
"""🐤 チッチが岩に乗ったところを撮る。
   ★岩の奥ゆき(PLAT_DEPTH_ROCK)を増やすと、岩の前面がチッチ側へ出てくる。
     足もとに岩がかぶらないか、**絵で**確かめるためのもの。
"""
import sys, os
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html?seed=20260821"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "_rock_stand")
if os.path.isdir(OUT):
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
os.makedirs(OUT, exist_ok=True)

# 正面に1枚だけ足場を置いて、その上にチッチを立たせる
STAND = """
(t) => {
  const c = window.__cj.core;
  c.platforms.length = 0; c.coins.length = 0; c.hawk = null;
  const w = c.platformWidth(c.rawM);
  c.platforms.push({ px: c.camPx, y: c.camY + CJ_VIEW_H * 0.34,
                     w, type: t, risky: false, used: false, breakAt: 0, seed: 0.5, vx: 0 });
  c.player.px = c.camPx;
  c.player.y = c.camY + CJ_VIEW_H * 0.34 + CJ_PLAT_H;   // 足場の上のめん
  c.player.vy = 0;
  c.over = false;
  c.spawnY = 1e9;
  return { w: +w.toFixed(3) };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    pg = b.new_page(viewport={"width": 390, "height": 720}, device_scale_factor=2)
    pg.goto(URL, wait_until="load")
    pg.wait_for_function("window.__cjReady === true", timeout=15000)
    pg.wait_for_timeout(300)
    pg.click("#ov-go")
    pg.wait_for_timeout(300)
    pg.evaluate("() => { window.__cj.core.over = false; window.__cj.setRunning(true); window.__cj.warp(1600); }")
    pg.wait_for_timeout(400)
    print("いまの値", pg.evaluate("() => window.__cj.thickInfo()"))
    for t in ["normal", "ice", "break", "spring"]:
        pg.evaluate(STAND, t)
        # 着地して跳ねるまでの数フレームを連続で撮る（かぶりは一瞬でも見つける）
        for k in range(4):
            pg.wait_for_timeout(70)
            pg.screenshot(path=os.path.join(OUT, f"{t}_{k}.png"))
    b.close()
print("out:", OUT)
