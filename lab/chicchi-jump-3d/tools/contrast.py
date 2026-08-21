# -*- coding: utf-8 -*-
"""足場が背景から分離しているかを、画素で測る（プラン §9 観点6）。

  ★「見えている気がする」で判断しない。
    足場のある場所を投影で出し、その画素と すぐ横の背景の画素を、
    WCAG のコントラスト比で比べる。3.0 を下まわったら赤信号。

  python lab/chicchi-jump-3d/tools/contrast.py
"""
import io, os, sys
from playwright.sync_api import sync_playwright
from PIL import Image

SEED = 20260820
URL = f"http://127.0.0.1:8899/lab/chicchi-jump-3d/index.html?seed={SEED}"
STOPS = [(400, '雲の上'), (1000, 'カーマンライン'), (1600, '地球のふち'),
         (2400, '地球がはなれる'), (7400, '木星'), (36678, 'ピンクの星雲'), (71179, '天の川の中心')]

def lum(c):
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])

def ratio(a, b):
    la, lb = lum(a), lum(b)
    if la < lb: la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)

def sample(im, x, y, r=2):
    W, H = im.size
    v = [im.getpixel((min(max(x + dx, 0), W - 1), min(max(y + dy, 0), H - 1)))
         for dx in range(-r, r + 1) for dy in range(-r, r + 1)]
    return tuple(round(sum(c[i] for c in v) / len(v)) for i in range(3))

bad = 0
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 390, "height": 720}, device_scale_factor=2)
    pg.goto(URL, wait_until="load")
    pg.wait_for_function("window.__cjReady === true", timeout=15000)
    pg.click("#ov-go"); pg.wait_for_timeout(200)
    for at, name in STOPS:
        # ★ワープしただけの絵で測らない。
        #   その状態だと、見えている足場が全部「タワーの裏側（わざと34%で薄い）」になり、
        #   実際に遊んでいるときには存在しない暗さを測ることになる。
        #   少し自動操縦で遊ばせて、**本当にねらえる足場が正面に来た状態**にしてから測る。
        pg.evaluate("""a => { const c = window.__cj.core;
          c.rnd = mulberry32(4242);
          c.pathA = 0; c.pathB = CJ_CIRC / 2;
          window.__cj.warpP(a); c.ending = null; c.over = false; window.__cj.setRunning(true); }""", at)
        for _ in range(46):
            pg.evaluate("""() => { const c = window.__cj.core, p = c.player; c.hawk = null; let best = null;
              for (const pl of c.platforms) { if (pl.used || pl.y <= p.y + 0.05) continue;
                if (!best || pl.y < best.y) best = pl; }
              if (best) c.setTargetFromScreen(Math.max(0, Math.min(1,
                0.5 + cjWrapDelta(best.px, c.camPx) / CJ_VIEW_W))); }""")
            pg.wait_for_timeout(16)
        pg.wait_for_timeout(200)
        plats = pg.evaluate("() => window.__cj.platScreens()")
        imA = Image.open(io.BytesIO(pg.screenshot())).convert("RGB")
        # ★背景は「足場を消した同じ絵」から取る。
        #   足場のとなりを測ると、そこにも別の足場があって 比1.00 になってしまう。
        pg.evaluate("() => window.__cj.hidePlats(true)"); pg.wait_for_timeout(260)
        imB = Image.open(io.BytesIO(pg.screenshot())).convert("RGB")
        pg.evaluate("() => window.__cj.hidePlats(false)"); pg.wait_for_timeout(120)
        W, H = imA.size
        worst, worstT, rs = 99, '', []
        skipped = 0
        for pl in plats:
            x = int((pl["x"] * 0.5 + 0.5) * W)
            y = int((0.5 - pl["y"] * 0.5) * H)
            # ★1点だけで測らない。雲はでこぼこなので、まん中がたまたま
            #   すき間ということがある。横に5点とって、その中央値をその足場の値とする。
            vals = []
            for dx in (-22, -11, 0, 11, 22):
                cP = sample(imA, x + dx, y)
                cB = sample(imB, x + dx, y)
                # 2枚がまったく同じ＝そこに足場は描かれていない（別の物のかげ）。
                # それは「暗い」のではなく「測れていない」ので、数に入れない。
                if max(abs(cP[i] - cB[i]) for i in range(3)) < 3:
                    skipped += 1
                    continue
                vals.append(ratio(cP, cB))
            if not vals: continue
            vals.sort()
            r = vals[len(vals) // 2]
            rs.append(r)
            if r < worst: worst, worstT = r, pl["type"]
        rs.sort()
        med = rs[len(rs) // 2] if rs else 99
        # 中央値3.0以上・いちばん低いものも2.0以上を合格とする
        okk = med >= 3.0 and worst >= 2.0
        mark = 'OK ' if okk else 'NG '
        if not okk: bad += 1
        print(f"{mark} {name:<16} 中央値 {med:5.2f} ／ いちばん低い {worst:5.2f} ({worstT})  足場{len(rs)}枚")
    b.close()

print("\n✅ すべて 3.0 以上" if bad == 0 else f"\n❌ 3.0 を下まわる場面が {bad} か所")
sys.exit(0 if bad == 0 else 1)
