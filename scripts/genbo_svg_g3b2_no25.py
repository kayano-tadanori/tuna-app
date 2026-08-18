# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.25「数列(1)」の図2本（HG-4293・4295）。

★根拠＝PDFの実物のみ。問題 PDF p52（本文p109-110）／解答 PDF p47・p49。

実物を見て確かめたこと：
  HG-4293 … 三角にびんを積んだ図。1だん目1本、2だん目2本…7だん目7本の三角形（実物は7だんまで）
  HG-4295 … 同じ長さの棒をならべて正方形を横一列に4こ作った図（1こ目4本、以降3本ずつ足す）

使い方: python scripts/genbo_svg_g3b2_no25.py [--write]
"""
import argparse
import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
from genbo_svg_g3b2_lib import LINE, HI, TX, GRAY, svg, t, ln, rect, circ, selfcheck, write_genbo

F = {}

# ══ HG-4293 むずかしい5：三角に積んだびん（1〜7だん） ═══════════════════════
_a = []
_R = 9
for _row in range(7):
    _n = _row + 1
    _y = 30 + _row * 18
    _x0 = 240 - (_n - 1) * (_R + 1)
    for _k in range(_n):
        _a.append(circ(_x0 + _k * (_R + 1) * 2, _y, _R, LINE, 1.6))
    _a.append(t(460, _y + 5, "%dだん目 %d本" % (_n, _n), TX, 12, "start"))
F["HG-4293"] = svg(620, 170, _a)

# ══ HG-4295 チャレンジ2：ぼうでならべる正方形（横一列に4こ） ═══════════════
_b = []
_S = 60
_x0 = 40
for _i in range(4):
    _x = _x0 + _i * _S
    _b += [ln(_x, 40, _x + _S, 40, LINE, 2.6), ln(_x, 100, _x + _S, 100, LINE, 2.6),
           ln(_x, 40, _x, 100, LINE, 2.6)]
_b.append(ln(_x0 + 4 * _S, 40, _x0 + 4 * _S, 100, LINE, 2.6))
_b.append(t(_x0 + 4 * _S + 40, 74, "……", TX, 20, "start"))
F["HG-4295"] = svg(520, 140, _b)


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
