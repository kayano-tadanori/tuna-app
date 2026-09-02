# -*- coding: utf-8 -*-
"""図の中の「その色、ほんとうに見えているか」を画素で測る。

やり方（見つもりではなく実測）:
  1. 図をアプリと同じ暗い背景の上に描いて写真を撮る（A）
  2. 調べたい色（既定 #1a2340）だけをショッキングピンクに置きかえて、もう1枚撮る（B）
  3. A と B のちがう画素＝その色で描かれている所（マスク）
  4. マスクのまわり数ピクセル（リング）と、マスクの中の色を A でくらべる
     → 差が小さい＝まわりに溶けていて見えない

★「暗い色だから悪い」ではない。明るいカードの上の濃い文字は正しい使い方なので、
  色の名前で決めつけず、実際に見えているかどうかだけを見る。

使い方:
  python scripts/check_svg_contrast.py                    … #1a2340 を使う図をぜんぶ測る
  python scripts/check_svg_contrast.py --color "#333"     … 別の色を測る
  python scripts/check_svg_contrast.py --limit 40         … 先頭40枚だけ
"""
import argparse
import io
import json
import os
import re
import sys

import numpy as np
from PIL import Image

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = os.path.join(BASE, "scripts", "_svgcontrast")
# 実機の図の下地（.question-box のグラデーションを平らにしたもの）
FIGBG = "#101f3f"


def collect(color):
    d = json.load(io.open(os.path.join(BASE, "data", "hama_daimon.json"), encoding="utf-8"))
    figs = {}
    def walk(o):
        if isinstance(o, dict):
            if isinstance(o.get("steps"), list):
                items = [("大問", o.get("svg") or "")] + [
                    ("q%d" % i, s.get("svg") or "") for i, s in enumerate(o.get("steps", []), 1)]
                for w, svg in items:
                    if svg and color in svg:
                        figs["%s__%s" % (o.get("id"), w)] = svg
                return
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(d)
    return figs


def swap_color(svg, color, only_text):
    """color をピンクに置きかえる。only_text なら <text …> の中だけ。"""
    if not only_text:
        return svg.replace('"%s"' % color, '"#ff00ff"').replace("'%s'" % color, "'#ff00ff'")
    def one(m):
        t = m.group(0)
        return t.replace('"%s"' % color, '"#ff00ff"').replace("'%s'" % color, "'#ff00ff'")
    return re.sub(r"<text[^>]*>", one, svg)


def shoot(figs, color, swap, tag, only_text=False):
    parts = []
    for k in sorted(figs):
        s = figs[k]
        if swap:
            s = swap_color(s, color, only_text)
        parts.append('<div class="fig" id="%s">%s</div>' % (k, s))
    html = ("<!doctype html><meta charset='utf-8'><style>"
            "body{background:%s;margin:0;padding:0}"
            ".fig{background:%s;padding:12px;margin:0 0 6px}"
            "svg{width:100%%;display:block}</style><body>%s</body>"
            % (FIGBG, FIGBG, "".join(parts)))
    tmp = os.path.join(OUT, "_page_%s.html" % tag)
    io.open(tmp, "w", encoding="utf-8").write(html)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True)
        pg = b.new_page(viewport={"width": 520, "height": 900}, device_scale_factor=1)
        pg.goto("file:///" + tmp.replace("\\", "/"))
        pg.wait_for_timeout(800)
        for k in sorted(figs):
            pg.locator("#" + k.replace("__", "\\_\\_") if False else '[id="%s"]' % k).screenshot(
                path=os.path.join(OUT, "%s_%s.png" % (tag, k)))
        b.close()


def ring_of(mask):
    """マスクのまわり3pxの帯（マスク自身は含まない）。"""
    m = mask
    d = m.copy()
    for _ in range(3):
        d[1:, :] |= d[:-1, :]; d[:-1, :] |= d[1:, :]
        d[:, 1:] |= d[:, :-1]; d[:, :-1] |= d[:, 1:]
    return d & ~m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--color", default="#1a2340")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--thresh", type=float, default=40.0,
                    help="まわりとの色の差がこれ未満なら「見えていない」")
    ap.add_argument("--only-text", action="store_true",
                    help="<text> に使われている場合だけを測る（線のふちは対象外）")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    figs = collect(args.color)
    if args.only_text:
        figs = {k: v for k, v in figs.items()
                if any(args.color in t for t in re.findall(r"<text[^>]*>", v))}
    if args.limit:
        figs = {k: figs[k] for k in sorted(figs)[:args.limit]}
    print("%s を使っている図: %d枚" % (args.color, len(figs)))
    if not figs:
        return
    shoot(figs, args.color, False, "A", args.only_text)
    shoot(figs, args.color, True, "B", args.only_text)

    bad, ok, skip = [], 0, 0
    for k in sorted(figs):
        pa = os.path.join(OUT, "A_%s.png" % k)
        pb = os.path.join(OUT, "B_%s.png" % k)
        if not (os.path.exists(pa) and os.path.exists(pb)):
            skip += 1; continue
        A = np.asarray(Image.open(pa).convert("RGB")).astype(np.int16)
        B = np.asarray(Image.open(pb).convert("RGB")).astype(np.int16)
        if A.shape != B.shape:
            skip += 1; continue
        mask = (np.abs(A - B).sum(axis=2) > 24)
        if mask.sum() < 8:
            skip += 1; continue          # 描かれていない（定義の中だけ 等）
        ring = ring_of(mask)
        if ring.sum() < 8:
            skip += 1; continue
        cm = A[mask].mean(axis=0)
        cr = A[ring].mean(axis=0)
        dist = float(np.sqrt(((cm - cr) ** 2).sum()))
        if dist < args.thresh:
            bad.append((k, round(dist, 1), int(mask.sum())))
        else:
            ok += 1
    print()
    print("見えている: %d枚 ／ 測れなかった: %d枚" % (ok, skip))
    print("★まわりに溶けていて見えない: %d枚" % len(bad))
    for k, dis, n in sorted(bad, key=lambda x: x[1]):
        print("   %-34s 色の差 %5.1f （%d画素）" % (k, dis, n))
    print()
    print("PNG →", OUT, "（A_＝そのまま／B_＝その色をピンクにしたもの）")


main()
