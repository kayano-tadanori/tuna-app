# -*- coding: utf-8 -*-
"""深宇宙の背景（biome）を実測で撮る。
   見つもりで「たぶん出ている」と言わない。1つずつ正面に持ってきて撮る。

   python lab/chicchi-jump-3d/tools/sky.py
"""
import sys, os, json
from playwright.sync_api import sync_playwright

SEED = 20260820   # 種を決めておくと、直す前と後で同じ景色を見くらべられる
URL = f"http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html?seed={SEED}"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "_sky")
os.makedirs(OUT, exist_ok=True)
# ★毎回まっさらにする。前の回のファイルが残っていると、
#   撮れていない絵を「撮れた」と勘違いして、ありもしない変化を見てしまう（実際にやった）。
for f in os.listdir(OUT):
    if f.endswith(".png"):
        os.remove(os.path.join(OUT, f))

# biome ごとに「どこを見れば分かるか」
LOOK = {
    "heliopause": "bA", "interstellar": "band", "oort": "bA",
    "milkyway": "band", "emissionneb": "gal", "coldneb": "gal",
    "darkneb": "gal", "starforming": "bA", "binary": "bA",
    "pulsar": "bA", "globular": "gal", "spiralgalaxy": "gal",
    "blackhole": "lens", "orion": "gal", "mwcenter": "lens",
    "mwedge": "gal", "andromeda": "gal",
}

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
    pg.click("#ov-go")
    pg.wait_for_timeout(300)

    # 決まった道のり ＋ 巡回で最初に出てくる場所を1つずつ
    plan = pg.evaluate("""() => {
      const tl = window.__cj.core.biomeTL;
      const seen = new Set(), out = [];
      for (const s of tl) {
        if (s.key === 'quiet' || seen.has(s.key)) continue;
        seen.add(s.key);
        out.push({ key: s.key, at: Math.round((s.from + s.to) / 2) });
      }
      return out;
    }""")

    rows = []
    for i, item in enumerate(plan):
        key, at = item["key"], item["at"]
        # ★遊ばせない。落ちて「もう一回」の画面が出ると背景が見えなくなる。
        #   つぶ（塵）は止めていても流れるので、そのまま待てばよい。
        look = LOOK.get(key, "gal")
        info = pg.evaluate("""a => {
          const c = window.__cj.core;
          // ★到着演出（月・火星）を必ず消すこと。消さずに通りすぎると、
          //   月の地面とウサギを載せたまま深宇宙を撮ってしまう（実際そうなった）。
          c.ending = null; c.over = false; window.__cj.setRunning(true);
          const r = window.__cj.warpP(a.at);
          c.ending = null;
          window.__cj.setRunning(false);
          r.dir = window.__cj.lookAtSky(a.look).dir;
          return r;
        }""", {"at": at, "look": look})
        pg.wait_for_timeout(700)
        # ★画面のどこに映るかは「1フレーム描いたあと」に測る。
        #   カメラの行列は次の rAF で作られるので、向けた直後に測ると前の絵の数字が出る。
        sc = pg.evaluate("d => window.__cj.skyScreen(d)", info["dir"])
        name = f"{i:02d}_{key}.png"
        pg.screenshot(path=os.path.join(OUT, name))
        inside = abs(sc["x"]) <= 1 and abs(sc["y"]) <= 1
        rows.append((key, at, info.get("name", ""), look, inside))
        print(f"{name}  p={at:>7}  {info.get('name','')}  look={look}  "
              f"画面内={'OK' if inside else 'NG'} (x={sc['x']:+.2f} y={sc['y']:+.2f})")

    # 重さの実測（いちばん重そうな星雲で）
    perf = pg.evaluate("""async () => {
      window.__cj.setRunning(true);
      const t0 = performance.now(); let n = 0;
      await new Promise(r => {
        const f = () => { n++; if (performance.now() - t0 > 1500) r(); else requestAnimationFrame(f); };
        requestAnimationFrame(f);
      });
      return Math.round((performance.now() - t0) / n * 10) / 10;
    }""")
    errbox = pg.evaluate("document.getElementById('err').textContent")
    b.close()

print(f"\n1フレーム {perf} ms（swiftshader＝CPU描画なので実機よりずっと重い）")
print("--- console ---")
for l in logs[:40]:
    print(l)
if errbox.strip():
    print("--- error box ---")
    print(errbox)
print("errors:", len(logs))
