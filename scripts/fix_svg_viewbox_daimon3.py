# -*- coding: utf-8 -*-
"""枠からはみ出している図の viewBox を広げる（中の座標は1つも触らない）。

[[method_svg_check]] の①の直し方をそのまま実装したもの。
既存の道具（fix_svg_viewbox.js）は node 前提だが実家PCに node が無いので Playwright で実測する。
寸法線を入れると数字が枠の外に出やすいので、図を足したら必ずこれを走らせる。

対象は原簿の「- 図SVG:」欄（＝図の源）。ここを直してから sync_genbo_svg.py でアプリへ配る。

使い方: python scripts/fix_svg_viewbox_daimon3.py [--write]
"""
import io, os, re, sys, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PAD = 4          # 余白（method_svg_check は2px。寸法線の爪ぶん少し多め）

MEASURE = r"""
() => {
  const out = {};
  document.querySelectorAll('svg[data-key]').forEach(svg => {
    const vb = svg.viewBox.baseVal;
    let bb; try { bb = svg.getBBox(); } catch (e) { return; }
    out[svg.dataset.key] = {
      vb: [vb.x, vb.y, vb.width, vb.height],
      bb: [bb.x, bb.y, bb.width, bb.height],
    };
  });
  return out;
}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    from playwright.sync_api import sync_playwright

    p = find_genbo()
    src = io.open(p, encoding="utf-8").read()
    # ⚠ レコードをまたがないこと。間に別の「### 【HG-」が来たら打ち切る
    figs = {}
    for m in re.finditer(
            r"### 【(HG-\d+)】(?:(?!### 【HG-)[\s\S])*?- 図SVG: `(<svg[\s\S]*?</svg>)`", src):
        figs[m.group(1)] = m.group(2)
    print("原簿の図SVG:", len(figs))
    if not figs:
        return

    parts = []
    for k, s in figs.items():
        parts.append(s.replace("<svg", '<svg data-key="%s"' % k, 1))
    html = ("<!doctype html><meta charset='utf-8'>"
            "<body style='margin:0;font-family:sans-serif'>%s</body>" % "".join(parts))
    tmp = os.path.join(BASE, "scripts", "_vb_check.html")
    io.open(tmp, "w", encoding="utf-8").write(html)

    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=CHROME, headless=True)
        pg = b.new_page(viewport={"width": 900, "height": 900})
        pg.goto("file:///" + tmp.replace("\\", "/"))
        pg.wait_for_timeout(1000)
        res = pg.evaluate(MEASURE)
        b.close()

    fixed = 0
    for k, r in res.items():
        vx, vy, vw, vh = r["vb"]
        bx, by, bw, bh = r["bb"]
        nx = min(vx, bx - PAD)
        ny = min(vy, by - PAD)
        nr = max(vx + vw, bx + bw + PAD)
        nb = max(vy + vh, by + bh + PAD)
        if (round(nx, 1), round(ny, 1), round(nr - nx, 1), round(nb - ny, 1)) == \
           (round(vx, 1), round(vy, 1), round(vw, 1), round(vh, 1)):
            continue
        newvb = "%g %g %g %g" % (round(nx, 1), round(ny, 1), round(nr - nx, 1), round(nb - ny, 1))
        old = figs[k]
        new = re.sub(r'viewBox="[^"]*"', 'viewBox="%s"' % newvb, old, count=1)
        src = src.replace("- 図SVG: `%s`" % old, "- 図SVG: `%s`" % new)
        figs[k] = new
        fixed += 1
        print("  %s  %s → %s" % (k, "%g %g %g %g" % (vx, vy, vw, vh), newvb))

    print("枠を広げた図:", fixed)
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(p, "w", encoding="utf-8", newline="").write(src)
    print("✅ 原簿に書き込み完了（sync_genbo_svg.py でアプリへ配ること）")


if __name__ == "__main__":
    main()
