# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.29「日暦算(2) 曜日」の図1本（HG-4334）。

★根拠＝PDFの実物のみ。問題 PDF p67（本文p143）。
  ある年の9月のカレンダー。1日が水曜日はじまり、30日まで。

使い方: python scripts/genbo_svg_g3b2_no29.py [--write]
"""
import argparse
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
from genbo_svg_g3b2_lib import LINE, HI, TX, GRAY, svg, t, ln, rect, selfcheck, write_genbo

F = {}

_a = []
_CW, _RH, _GX, _GY = 60, 40, 20, 20
_DOW = ["日", "月", "火", "水", "木", "金", "土"]
for _c, _d in enumerate(_DOW):
    _a += [rect(_GX + _c * _CW, _GY, _CW, _RH, LINE, 1.8),
           t(_GX + _c * _CW + _CW / 2, _GY + 26, _d, HI, 15)]
# 1日は水曜(列3)から始まる
_day = 1
for _r in range(5):
    _y = _GY + _RH * (_r + 1)
    for _c in range(7):
        _a.append(rect(_GX + _c * _CW, _y, _CW, _RH, LINE, 1.8))
        if _r == 0 and _c < 3:
            continue
        if _day <= 30:
            _a.append(t(_GX + _c * _CW + _CW / 2, _y + 26, str(_day), TX, 15))
            _day += 1
F["HG-4334"] = svg(460, 260, _a)


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
