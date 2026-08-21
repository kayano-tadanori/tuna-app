# -*- coding: utf-8 -*-
"""ゲーム本体の実測スクリーンショット。
   見つもりではなく、実際に動かして撮った絵で判定する。
   簡単な自動操縦（次の足場をねらう）で遊ばせて、各高度の見た目を撮る。
"""
import sys, os, json
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "_play")
os.makedirs(OUT, exist_ok=True)

# 自動操縦：上がっているときは上の足場、落ちているときは下の足場をねらう
AUTOPILOT = """
() => {
  const c = window.__cj.core, p = c.player;
  let best = null;
  if (p.vy >= 0) {
    for (const pl of c.platforms) {
      if (pl.used || pl.y <= p.y + 0.05) continue;
      if (!best || pl.y < best.y) best = pl;
    }
  }
  if (!best) {
    for (const pl of c.platforms) {
      if (pl.used || pl.y > p.y - 0.05) continue;
      if (!best || pl.y > best.y) best = pl;
    }
  }
  if (best) {
    const d = cjWrapDelta(best.px, c.camPx);
    const frac = 0.5 + d / CJ_VIEW_W;
    c.setTargetFromScreen(Math.max(0, Math.min(1, frac)));
  }
  return { m: c.meters, s: c.score, over: c.over, n: c.platforms.length };
}
"""

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    pg = b.new_page(viewport={"width": 390, "height": 720}, device_scale_factor=2)
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))

    pg.goto(URL, wait_until="load")
    pg.wait_for_function("window.__cjReady === true", timeout=15000)
    pg.wait_for_timeout(400)
    pg.screenshot(path=os.path.join(OUT, "00_start.png"))
    pg.click("#ov-go")          # 「はじめる」を押して開始
    pg.wait_for_timeout(300)

    st = {}
    for shot in range(1, 7):
        for k in range(70):
            st = pg.evaluate(AUTOPILOT)
            pg.wait_for_timeout(16)
            if st["over"]:
                break
        pg.screenshot(path=os.path.join(OUT, f"{shot:02d}_play.png"))
        print(f"{shot:02d}", json.dumps(st))
        if st["over"]:
            break

    # 高い所の見た目（宇宙ゾーン・火星ゾーン）
    for m, name in [(1600, "z_space"), (4200, "z_mars")]:
        pg.evaluate("m => { window.__cj.core.over = false; window.__cj.setRunning(true); window.__cj.warp(m); }", m)
        for k in range(25):
            pg.evaluate(AUTOPILOT)
            pg.wait_for_timeout(16)
        pg.screenshot(path=os.path.join(OUT, f"{name}.png"))

    errbox = pg.evaluate("document.getElementById('err').textContent")
    b.close()

print("--- console ---")
for l in logs[:40]:
    print(l)
if errbox.strip():
    print("--- error box ---")
    print(errbox)
print("errors:", len(logs))
