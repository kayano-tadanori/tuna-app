# -*- coding: utf-8 -*-
"""🖥 チカチカ（画面の明滅）を**数で**さがす。

   考えかた：ふつうの動きは「1コマずつ少しずつ」変わる。
   チカチカは **1コマおきに同じ絵にもどる**（A→B→A→B）。
   だから
        d1 = となりのコマとのちがい
        d2 = **1コマとばした**コマとのちがい
   をくらべて、**d1 が d2 よりずっと大きい**ところが明滅している。

   ★これは絵だけを見ている。GPU の違いには依らないので、
     swiftshader でも「作りが原因の明滅」なら見つかる。
     （GPU でしか出ない種類のものは、これでも出ない）

   使いかた:  python lab/chicchi-jump-3d/tools/flicker.py [幅x高さ]
"""
import sys, os, io, statistics
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
import numpy as np

URL = "http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html?seed=20260821"
OUT = os.path.join(os.path.dirname(__file__), "_flicker")
if os.path.isdir(OUT):
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
os.makedirs(OUT, exist_ok=True)

size = sys.argv[1] if len(sys.argv) > 1 else "1280x720"
VW, VH = (int(x) for x in size.split("x"))

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
  return { over: c.over, w: window.__cj.R.W, h: window.__cj.R.H, q: window.__cj.R.quality };
}
"""

# 場所ごとに見る（見せ物がちがうので、明滅の出どころもちがう）
SPOTS = [
    (60,     "a_park"),        # 公園・街のあいだ
    (600,    "b_sky"),         # 空
    (1600,   "c_asteroid"),    # 宇宙に入ったところ
    (7000,   "d_deep"),
    (35000,  "e_biome"),       # 深宇宙の巡回
]
N = 26          # 何コマ撮るか

def arr(png):
    im = Image.open(io.BytesIO(png)).convert("RGB")
    return np.asarray(im, dtype=np.int16)

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    pg = b.new_page(viewport={"width": VW, "height": VH}, device_scale_factor=1)
    logs = []
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.goto(URL, wait_until="load")
    pg.wait_for_function("window.__cjReady === true", timeout=20000)
    pg.wait_for_timeout(400)
    pg.click("#ov-go")
    pg.wait_for_timeout(400)

    print(f"--- {VW}x{VH} ---")
    print("場所            d1(となり)  d2(1コマとばし)  d1/d2   canvas")
    for m, name in SPOTS:
        pg.evaluate("m => { window.__cj.core.over = false; window.__cj.setRunning(true); window.__cj.warp(m); }", m)
        for k in range(20):
            pg.evaluate(AUTOPILOT)
            pg.wait_for_timeout(16)
        frames, sizes = [], set()
        for k in range(N):
            st = pg.evaluate(AUTOPILOT)
            sizes.add((st["w"], st["h"], st["q"]))
            frames.append(arr(pg.screenshot()))
        d1 = [float(np.abs(frames[i + 1] - frames[i]).mean()) for i in range(len(frames) - 1)]
        d2 = [float(np.abs(frames[i + 2] - frames[i]).mean()) for i in range(len(frames) - 2)]
        m1, m2 = statistics.mean(d1), statistics.mean(d2)
        ratio = m1 / m2 if m2 > 1e-6 else 0
        flag = "  ★明滅うたがい" if ratio > 1.35 else ""
        print(f"{name:14s} {m1:8.3f}  {m2:12.3f}  {ratio:6.2f}   {sorted(sizes)}{flag}")
        # いちばん差の大きかった2コマを残す（目でも見られるように）
        i = max(range(len(d1)), key=lambda j: d1[j])
        Image.fromarray(frames[i].astype("uint8")).save(os.path.join(OUT, f"{name}_A.png"))
        Image.fromarray(frames[i + 1].astype("uint8")).save(os.path.join(OUT, f"{name}_B.png"))
        diff = np.abs(frames[i + 1] - frames[i]).sum(axis=2)
        diff = (np.clip(diff, 0, 255)).astype("uint8")
        Image.fromarray(diff).save(os.path.join(OUT, f"{name}_diff.png"))
    b.close()

for l in logs[:20]:
    print(l)
print("out:", OUT)
