# -*- coding: utf-8 -*-
"""🪨 岩の厚み・奥ゆきの見くらべ（A/B）。

   ★同じ配置・同じ瞬間で撮ること。数字だけ変えて撮りくらべる。
     （前に「別の瞬間のスクショ2枚を比べる」をやって、まったく意味の無い比較をした）

   ・宇宙ゾーンへ warp
   ・足場を**手で並べる**（4種を、筒の正面と横がわの両方に置く）
     → 正面の見え方と、回りこんだときの見え方を1枚で判定できる
   ・厚み(PLAT_THICK_ROCK)と奥ゆき(PLAT_DEPTH_ROCK)の組を変えて撮る
"""
import sys, os
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html?seed=20260821"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "_rock_ab")
if os.path.isdir(OUT):
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
os.makedirs(OUT, exist_ok=True)

# 足場を手で並べる。★はばは「その高さの本当のはば」を使う（gallery の CJ_PLAT_W は広すぎる）
LAYOUT = """
() => {
  const c = window.__cj.core;
  c.platforms.length = 0; c.coins.length = 0; c.hawk = null;
  const w = c.platformWidth(c.rawM);
  const types = ['normal', 'ice', 'break', 'spring'];
  // 正面（0）と、回りこんだ所（±1.7）に置く。回りこみは「うすい板」が出やすい所。
  const spots = [[-1.70, 0.0], [-0.58, 0.9], [0.58, 0.0], [1.70, 0.9]];
  types.forEach((t, i) => {
    c.platforms.push({
      px: cjWrap(c.camPx + spots[i][0]),
      y: c.camY + CJ_VIEW_H * 0.30 + spots[i][1],
      w, type: t, risky: false, used: false, breakAt: 0, seed: 0.5, vx: 0,
    });
  });
  c.player.y = c.camY + CJ_VIEW_H * 0.72;
  c.player.px = c.camPx;
  c.player.vy = 0;
  c.over = false;
  c.spawnY = 1e9;              // 追加生成を止める
  return { w: +w.toFixed(3) };
}
"""

CASES = [
    (4.8, 0.72, "a_old"),          # 直す前
    (5.6, 1.10, "b_new"),          # いまの値
    (6.2, 1.25, "c_more"),         # もう一段
]
M = 1600   # 小惑星ゾーン
# ★PCの横長ウィンドウでは canvas が `min(100vw, 70vh)` に収まる＝**たて0.70の枠**。
#   スマホ（0.46くらい）より横に広いので、同じ足場でも**枠のわりに小さく**見える。
#   だから判定は**PCの形でも**やること。
VIEWPORTS = [(390, 720, "phone"), (1280, 720, "pc")]

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    for vw, vh, tag in VIEWPORTS:
        pg = b.new_page(viewport={"width": vw, "height": vh}, device_scale_factor=2)
        pg.goto(URL, wait_until="load")
        pg.wait_for_function("window.__cjReady === true", timeout=15000)
        pg.wait_for_timeout(300)
        pg.click("#ov-go")
        pg.wait_for_timeout(300)
        pg.evaluate("m => { window.__cj.core.over = false; window.__cj.setRunning(true); window.__cj.warp(m); }", M)
        pg.wait_for_timeout(400)
        for thick, depth, name in CASES:
            pg.evaluate("a => window.__cj.setThick(0, a[0], a[1])", [thick, depth])
            info = pg.evaluate(LAYOUT)
            pg.wait_for_timeout(150)          # 同じ配置・同じ間で撮る
            pg.screenshot(path=os.path.join(OUT, f"{tag}_{name}.png"))
            print(f"{tag:6s} {name:10s} thick={thick} depth={depth} はば={info['w']}")
        pg.close()
    b.close()
print("out:", OUT)
