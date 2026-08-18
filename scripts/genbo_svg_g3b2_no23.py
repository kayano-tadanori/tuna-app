# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.23「時こくと時間」の図1本（HG-4260）。

★根拠＝PDFの実物のみ。問題は文章のみで、図は解答（PDF p35-36）にある60分・60秒のテープ図。
  60を等分したテープ図で①40分(2/3)②15秒(1/4)③50秒(5/6)を示す帯を1本にまとめて描く。

使い方: python scripts/genbo_svg_g3b2_no23.py [--write]
"""
import argparse
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
from genbo_svg_g3b2_lib import LINE, HI, TX, GRAY, svg, t, ln, rect, dim, selfcheck, write_genbo

F = {}


def tape(oy, total, marks, label, w=480, x0=20):
    out = [rect(x0, oy, w, 30, LINE, 2)]
    for frac, cap in marks:
        mx = x0 + w * frac
        out.append(ln(mx, oy - 6, mx, oy + 36, HI, 1.8))
        out.append(t(mx, oy + 50, cap, HI, 12))
    out.append(t(x0 - 10, oy + 20, label, TX, 13, "end"))
    out += dim(x0, oy + 44, x0 + w, oy + 44, "60", 20, side=1)
    return out


_a = []
_a += tape(20, 60, [(2 / 3.0, "40分\n(2/3時間)")], "①")
_a[-1] = t(20 + 480 * 2 / 3.0, 84, "40分(2/3時間)", HI, 12)
_a += tape(140, 60, [(1 / 4.0, "15秒(1/4分)")], "②")
_a[-1] = t(20 + 480 * 1 / 4.0, 204, "15秒(1/4分)", HI, 12)
_a += tape(260, 60, [(5 / 6.0, "50秒(5/6分)")], "③")
_a[-1] = t(20 + 480 * 5 / 6.0, 324, "50秒(5/6分)", HI, 12)
F["HG-4260"] = svg(540, 340, _a)


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
