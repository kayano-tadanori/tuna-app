# -*- coding: utf-8 -*-
u"""No.16 の図を iPhone はば(414px)で 実際に描いて PNG にする（目視確認用）"""
import os, sys, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
import gen_s3sairei_no16 as g

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "scripts", "_no16_shots")
os.makedirs(OUT, exist_ok=True)

NAMES = ["fig_1_1", "fig_1_2", "fig_1_3", "fig_1_4", "fig_2_1", "fig_2_2", "fig_2_3",
         "fig_3_1", "fig_3_2", "fig_3_3", "fig_4_2", "fig_5", "fig_6_1", "fig_6_2",
         "fig_7_1", "fig_7_2", "fig_7_3", "fig_7_4", "fig_8_1", "fig_8_2"]
svgs = dict((n, getattr(g, n)()) for n in NAMES)

html = ('<html><body style="margin:0;background:#141a2e">'
        + "".join('<div style="padding:14px;background:#1b2340;margin:10px;border-radius:10px" '
                  'id="%s">%s</div>' % (k, v) for k, v in svgs.items())
        + "</body></html>")
p = os.path.join(OUT, "_page.html")
io.open(p, "w", encoding="utf-8").write(html)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={"width": 414, "height": 900}, device_scale_factor=2)
    pg.goto("file:///" + p.replace("\\", "/"))
    pg.wait_for_timeout(400)
    for k in svgs:
        el = pg.query_selector("#" + k)
        el.screenshot(path=os.path.join(OUT, k + ".png"))
        bb = el.bounding_box()
        print("%-9s %.0f x %.0f px" % (k, bb["width"], bb["height"]))
    b.close()
print("->", OUT)
