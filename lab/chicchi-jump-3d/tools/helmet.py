# -*- coding: utf-8 -*-
"""🪖 ヘルメットの見え方を近くで撮る。
   ガラスに見えているか（かぶりものに見えていないか）を目で判定するため。

   python lab/chicchi-jump-3d/tools/helmet.py
"""
import sys, os, io
from playwright.sync_api import sync_playwright
from PIL import Image

SEED = 20260820
URL = f"http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html?seed={SEED}"
OUT = os.path.join(os.path.dirname(__file__), "_sky")
os.makedirs(OUT, exist_ok=True)

AUTO = """() => { const c=window.__cj.core,p=c.player; let best=null;
  for (const pl of c.platforms){ if(pl.used||pl.y<=p.y+0.05) continue; if(!best||pl.y<best.y) best=pl; }
  if(best) c.setTargetFromScreen(Math.max(0,Math.min(1,0.5+cjWrapDelta(best.px,c.camPx)/CJ_VIEW_W)));
  return c.over; }"""

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader",
                                "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 390, "height": 720}, device_scale_factor=3)
    logs = []
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.on("console", lambda m: logs.append(m.type + ": " + m.text) if m.type == "error" else None)
    pg.goto(URL, wait_until="load")
    pg.wait_for_function("window.__cjReady === true", timeout=15000)
    pg.click("#ov-go"); pg.wait_for_timeout(200)

    # 空の明るさがちがう2か所で見る（黒い宇宙／明るい星雲）
    for tag, at in [("space", 3000), ("neb", 36678)]:
        pg.evaluate("a => { const c=window.__cj.core; c.over=false; window.__cj.setRunning(true); window.__cj.warpP(a); }", at)
        for _ in range(40):
            if pg.evaluate(AUTO):
                pg.evaluate("a => { const c=window.__cj.core; c.over=false; window.__cj.setRunning(true); window.__cj.warpP(a); }", at)
            pg.wait_for_timeout(16)
        # ★「もう一回」の画面が出ていたら消してから撮る（落ちると 700ms 後に出る）
        pg.evaluate("() => { window.__cj.setRunning(true); window.__cj.setRunning(false); }")
        pg.wait_for_timeout(200)
        st = pg.evaluate("() => window.__cj.chicchiScreen()")
        png = pg.screenshot()
        im = Image.open(io.BytesIO(png)).convert("RGB")
        W, H = im.size
        # ★どこに映っているかは目で当てずに、投影して数で出す
        cx = int((st["x"] * 0.5 + 0.5) * W)
        cy = int((0.5 - st["y"] * 0.5) * H)
        r = int(W * 0.26)
        im.crop((max(0, cx - r), max(0, cy - r), min(W, cx + r), min(H, cy + r))) \
          .resize((520, 520), Image.LANCZOS).save(os.path.join(OUT, f"zz_helmet_{tag}.png"))
        print(f"zz_helmet_{tag}.png  progress={at}")

    b.close()
print("errors:", len(logs))
for l in logs[:10]:
    print(l)
