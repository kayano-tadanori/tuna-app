# -*- coding: utf-8 -*-
"""実際にブラウザで遊んでみて、絵とコンソールを確かめる道具。
   ソルバーの手順どおりに動かして、本当にクリアまで行くかも見る。
   使い方: python tools/play.py [出力先]  （先に python -m http.server 8899）
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sokoban
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = "http://127.0.0.1:8899/lab/okatazuke/index.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "_play")
os.makedirs(OUT, exist_ok=True)

KEY = {'U': 'ArrowUp', 'D': 'ArrowDown', 'L': 'ArrowLeft', 'R': 'ArrowRight'}

with sync_playwright() as p:
    b = p.chromium.launch(args=[
        "--use-gl=angle", "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
    ])
    pg = b.new_page(viewport={"width": 414, "height": 830}, device_scale_factor=2)
    errs = []
    pg.on("console", lambda m: errs.append(f"[{m.type}] {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
    pg.goto(URL, wait_until="load")
    pg.wait_for_function("window.__okReady === true", timeout=20000)
    pg.wait_for_timeout(500)
    pg.screenshot(timeout=90000, animations="disabled", path=os.path.join(OUT, "01_title.png"))

    pg.click("#btn-start")
    pg.wait_for_timeout(400)
    pg.screenshot(timeout=90000, animations="disabled", path=os.path.join(OUT, "02_select.png"))

    # 面をいくつか開いて 絵を撮る
    for idx in [0, 12, 36, 60, 100]:
        pg.evaluate("i => okStartLevel(i)", idx)
        pg.wait_for_timeout(700)
        pg.screenshot(timeout=90000, animations="disabled", path=os.path.join(OUT, f"03_lv{idx+1}.png"))

    # ソルバーの手順で 実際にクリアまで動かす（1面目と 5面目）
    levels = json.loads(pg.evaluate("() => JSON.stringify(OK_LEVELS)"))
    for idx in [0, 20]:
        L = levels[idx]
        lv = sokoban.Level(L["rows"])
        r = sokoban.solve(lv)
        assert r.get("solved"), "ソルバーが解けない面がある"
        pg.evaluate("i => okStartLevel(i)", idx)
        pg.wait_for_timeout(300)
        # ★描画が遅い環境（SwiftShader）では アニメが実時間で長くなる。
        #   ここで見たいのは「手順どおり動かしたらクリアになるか」なので、
        #   1手ずつ 手が空くのを待ってから 次を押す。
        for i, ch in enumerate(r["path"]):
            pg.keyboard.press(KEY[ch])
            for _ in range(60):
                if pg.evaluate("() => !OKG.anim && OKG.queue.length === 0"):
                    break
                pg.wait_for_timeout(50)
        pg.wait_for_timeout(900)
        st = pg.evaluate("() => ({screen: OKG.screen, moves: OKG.game.moves, pushes: OKG.game.pushes})")
        print(f"面{idx+1} 手順どおり動かした結果 → {st}  （期待 screen=clear pushes={r['pushes']}）")
        pg.screenshot(timeout=90000, animations="disabled", path=os.path.join(OUT, f"04_clear{idx+1}.png"))
        if st["screen"] != "clear":
            print("  ★クリアにならなかった")

    # 早おしで 入力が こぼれないか（子どもは連打する）
    pg.evaluate("i => okStartLevel(i)", 0)
    pg.wait_for_timeout(400)
    for _ in range(5):
        pg.keyboard.press("ArrowLeft")
    pg.wait_for_timeout(60)
    st = pg.evaluate("() => ({moves: OKG.game.moves, q: OKG.queue.length, anim: !!OKG.anim})")
    got = st["moves"] + st["q"]
    print(f"連打5回 → うけとった手 {got}（動いた{st['moves']} 待ち{st['q']}）")
    if got < 5:
        print("  ★入力が こぼれている")

    b.close()
    print("\n=== コンソール ===")
    if errs:
        for e in errs[:25]:
            print(e)
    else:
        print("エラーなし")
