# -*- coding: utf-8 -*-
"""🪨 宇宙の足場（岩）の厚みを見るための実測。
   ★見つもりで「厚くした」と言わない。撮って、画素で数える。

   ・宇宙の各ゾーンへ warp して、ふつうに遊んでいる絵を撮る
   ・`gallery()` で4種を横にならべた絵も撮る（形の比べ用）
   ・あわせて `__cj.platBoxes()` で、足場の**画面上の幅と高さ(px)**を数える
     見た目の厚み ＝ 高さ ÷ 幅。ここが小さいほど「板」に見える。
"""
import sys, os, json
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "_rock")
# ★前の回の絵を見てしまわないよう、毎回まっさらにする（sky.py と同じ）
if os.path.isdir(OUT):
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
os.makedirs(OUT, exist_ok=True)

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
    c.setTargetFromScreen(Math.max(0, Math.min(1, 0.5 + d / CJ_VIEW_W)));
  }
  return { m: c.meters, over: c.over };
}
"""

# 雲のゾーンも1つ入れて、雲と岩を同じ物差しで比べられるようにする
ZONES = [(600, "0_cloud"), (1600, "1_asteroid"), (4200, "2_mars"),
         (7000, "3_deep"), (12500, "4_icefield")]

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    pg = b.new_page(viewport={"width": 390, "height": 720}, device_scale_factor=2)
    logs = []
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.goto(URL, wait_until="load")
    pg.wait_for_function("window.__cjReady === true", timeout=15000)
    pg.wait_for_timeout(300)
    pg.click("#ov-go")
    pg.wait_for_timeout(300)

    for m, name in ZONES:
        pg.evaluate("m => { window.__cj.core.over = false; window.__cj.setRunning(true); window.__cj.warp(m); }", m)
        for k in range(30):
            pg.evaluate(AUTOPILOT)
            pg.wait_for_timeout(16)
        pg.screenshot(path=os.path.join(OUT, f"{name}_play.png"))
        try:
            # ★1フレームだと、まん中を向いている足場が0〜2枚しか無い。
            #   遊ばせながら何度も数えて、ならす。
            avg, thick = {}, 0
            for k in range(60):
                # 落ちたらその場で生きかえらせる（数を取りたいだけなので）
                if pg.evaluate("() => window.__cj.core.over"):
                    pg.evaluate("m => { window.__cj.core.over = false; window.__cj.setRunning(true); window.__cj.warp(m); }", m)
                    pg.wait_for_timeout(60)
                r = pg.evaluate("() => window.__cj.platBoxes()")
                thick = r["thick"]
                for o in r["plats"]:
                    avg.setdefault(o["type"], []).append(o)
                pg.evaluate(AUTOPILOT)
                pg.wait_for_timeout(16)
            r = {"thick": thick, "plats": [x for v in avg.values() for x in v]}
            s = " ".join(
                "{}[w{:.0f} h{:.0f} h/w{:.2f}]".format(
                    k,
                    sum(x["wPx"] for x in v) / len(v),
                    sum(x["hPx"] for x in v) / len(v),
                    sum(x["ratio"] for x in v) / len(v))
                for k, v in sorted(avg.items()))
            print("{:12s} thick={:.2f}  {}   n={}".format(name, r["thick"], s, len(r["plats"])))
        except Exception as e:
            print(f"{name} 計測できず: {e}")

        # 4種ならべ（形の比べ用）。撮ったら次のゾーンで敷きなおされる。
        pg.evaluate("() => window.__cj.gallery()")
        pg.wait_for_timeout(120)
        pg.screenshot(path=os.path.join(OUT, f"{name}_gallery.png"))

    b.close()

for l in logs[:20]:
    print(l)
print("out:", OUT)
