# -*- coding: utf-8 -*-
"""第2分冊の図SVGで、枠（viewBox）から中身がはみ出しているものを実測して直す。

★はみ出し量は見つもらない。Chromeで getBBox() を実測して viewBox を広げる
  （[[method_svg_check]]／第1分冊でも HG-4726・4762 で同じことをした）。
★直すのは原簿（種本）のほう。そのあと g4b2_add_daimon.py を流し直して JSON に反映する。

使い方: python scripts/fix_g4b2_viewbox.py [--write]
"""
import io
import json
import os
import re
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo                       # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PAD = 2.0

MEASURE = r"""
() => {
  const out = {};
  document.querySelectorAll('svg[data-key]').forEach(svg => {
    const b = svg.getBBox();
    out[svg.dataset.key] = [b.x, b.y, b.width, b.height];
  });
  return out;
}
"""


def main():
    write = "--write" in sys.argv
    gpath = find_genbo()
    g = io.open(gpath, encoding="utf-8").read()

    targets = {}
    for m in re.finditer(r"### 【(HG-(\d+))】", g):
        n = int(m.group(2))
        if not (4945 <= n <= 5769):
            continue
        chunk = g[m.start():]
        nxt = re.search(r"\n### 【HG-", chunk)
        if nxt:
            chunk = chunk[:nxt.start()]
        for line in chunk.splitlines():
            mm = re.match(r"- 図SVG([^:]*): `?(<svg.+?)`?$", line)
            if mm:
                targets["%s%s" % (m.group(1), mm.group(1))] = (line, mm.group(2).strip())

    css = io.open(os.path.join(BASE, "style.css"), encoding="utf-8").read()
    parts = []
    for key, (_, svg) in targets.items():
        parts.append('<div class="sq-figure">%s</div>'
                     % svg.replace("<svg", '<svg data-key="%s"' % key, 1))
    html = ("<!doctype html><meta charset='utf-8'><style>%s</style>"
            "<body class='sansu-quiz-area'>%s</body>" % (css, "".join(parts)))
    tmp = os.path.join(BASE, "scripts", "svg_fix_g4b2.html")
    io.open(tmp, "w", encoding="utf-8").write(html)

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True)
        pg = b.new_page(viewport={"width": 420, "height": 900})
        pg.goto("file:///" + tmp.replace("\\", "/"))
        pg.wait_for_timeout(1200)
        bb = pg.evaluate(MEASURE)
        b.close()

    print("図の数 %d／実測できた %d" % (len(targets), len(bb)))
    missing = [k for k in targets if k not in bb]
    if missing:
        print("実測できなかった:", missing)
    fixed = 0
    for key, (line, svg) in targets.items():
        if key not in bb:
            continue
        bx, by, bw, bh = bb[key]
        m = re.search(r'viewBox="([\d.\- ]+)"', svg)
        if not m:
            continue
        vx, vy, vw, vh = [float(x) for x in m.group(1).split()]
        nx = min(vx, bx - PAD)
        ny = min(vy, by - PAD)
        nr = max(vx + vw, bx + bw + PAD)
        nb = max(vy + vh, by + bh + PAD)
        if abs(nx - vx) < 0.01 and abs(ny - vy) < 0.01 \
                and abs(nr - (vx + vw)) < 0.01 and abs(nb - (vy + vh)) < 0.01:
            continue
        nvb = "%g %g %g %g" % (nx, ny, nr - nx, nb - ny)
        svg2 = svg[:m.start(1)] + nvb + svg[m.end(1):]
        svg2 = re.sub(r'(<svg[^>]*?)\swidth="[\d.]+"\s*height="[\d.]+"',
                      r'\1 width="%g" height="%g"' % (nr - nx, nb - ny), svg2, count=1)
        print("%s  %s → %s" % (key, m.group(1), nvb))
        g = g.replace(line, line.replace(svg, svg2), 1)
        fixed += 1

    print("直した図: %d枚" % fixed)
    if write and fixed:
        io.open(gpath, "w", encoding="utf-8", newline="").write(g)
        print("✅ 原簿を書きかえた")
    elif not write:
        print("（--write を付けると原簿を書きかえます）")


if __name__ == "__main__":
    main()
