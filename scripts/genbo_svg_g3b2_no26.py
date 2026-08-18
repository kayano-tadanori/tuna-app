# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.26「数列(2)」の図6本（HG-4297〜4304のうち図あり6本）。

★根拠＝PDFの実物のみ。問題 PDF p54〜p56（本文p115〜118）／解答 PDF p51〜p54。
  いずれも記号・碁石を1列にならべた帯で、後ろは「……」で続くことを示す。

使い方: python scripts/genbo_svg_g3b2_no26.py [--write]
"""
import argparse
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
from genbo_svg_g3b2_lib import LINE, HI, TX, GRAY, svg, t, ln, rect, circ, poly, selfcheck, write_genbo

F = {}


def shape(kind, cx, cy, s):
    if kind == "sq":
        return rect(cx - s / 2, cy - s / 2, s, s, LINE, 1.8, "none")
    if kind == "tri":
        return poly([(cx, cy - s * 0.6), (cx - s * 0.55, cy + s * 0.45),
                     (cx + s * 0.55, cy + s * 0.45)], LINE, 1.8, "none")
    if kind == "circ_w":
        return circ(cx, cy, s * 0.42, LINE, 1.8, "none")
    if kind == "circ_b":
        return circ(cx, cy, s * 0.42, LINE, 1.8, "#c9d4f0")
    if kind == "x":
        return ('<g stroke="%s" stroke-width="2"><line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>'
                '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/></g>') % (
            LINE, cx - s * 0.4, cy - s * 0.4, cx + s * 0.4, cy + s * 0.4,
            cx - s * 0.4, cy + s * 0.4, cx + s * 0.4, cy - s * 0.4)
    if kind == "circle_mark":
        return circ(cx, cy, s * 0.42, HI, 2, "none")


def strip(kinds, n_show, oy, s=40, gap=52, ox=30, dots=True):
    out = []
    x = ox
    for i in range(n_show):
        k = kinds[i % len(kinds)]
        out.append(shape(k, x, oy, s))
        x += gap
    if dots:
        out.append(t(x + 10, oy + 6, "……", TX, 20, "start"))
    return out


FILL_NONE = "none"

# ══ HG-4297 やさしい2：■▲●のくり返し ═══════════════════════════════
_a = strip(["sq", "tri", "circ_w"], 9, 40)
F["HG-4297"] = svg(540, 90, _a)

# ══ HG-4298 やさしい3：○○○●●のくり返し ═══════════════════════════
_b = strip(["circ_w", "circ_w", "circ_w", "circ_b", "circ_b"], 10, 40)
F["HG-4298"] = svg(560, 90, _b)

# ══ HG-4299 やさしい4：○×のくり返し（45こ） ═══════════════════════════
_c = strip(["circle_mark", "x"], 10, 40)
F["HG-4299"] = svg(560, 90, _c)

# ══ HG-4300 やさしい5：○●●●のくり返し ═══════════════════════════════
_d = strip(["circ_w", "circ_b", "circ_b", "circ_b"], 10, 40)
F["HG-4300"] = svg(560, 90, _d)

# ══ HG-4303 むずかしい2：□○△△□○のくり返し ═══════════════════════
_e = strip(["sq", "circ_w", "tri", "tri", "sq", "circ_w"], 9, 40)
F["HG-4303"] = svg(540, 90, _e)

# ══ HG-4304 むずかしい3：●○○●●のくり返し（99こ） ═══════════════════
_f = strip(["circ_b", "circ_w", "circ_w", "circ_b", "circ_b"], 10, 40)
F["HG-4304"] = svg(560, 90, _f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    bad = selfcheck(F)
    for b in bad:
        print("⚠", b)
    if not bad:
        print("✅ 自己点検OK（%d枚）" % len(F))
    write_genbo(F, a.write, find_genbo())


if __name__ == "__main__":
    main()
