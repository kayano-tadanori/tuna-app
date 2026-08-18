# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.28「数列(3)」の図3本（HG-4325・4332・4333）。

★根拠＝PDFの実物のみ。問題 PDF p62（本文p131）／PDF p66-67（本文p135）。

実物を見て確かめたこと：
  HG-4325 … 正方形の4すみにア(左上)・イ(左下)・ウ(右下)・エ(右上)。各すみに配られる
             番号が2段（例アに1と5、9…）で書かれている
  HG-4332 … 「列\\行」の見出しマスをもつ6列の表。1行目1-6・2行目7-12・3行目13-18が記入ずみ
  HG-4333 … 三角にならんだ数。1だん目=2、2だん目=4,5、3だん目=6,7,8、4だん目=8,9,10,11

使い方: python scripts/genbo_svg_g3b2_no28.py [--write]
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

# ══ HG-4325 やさしい4：4つのグループへ番号順に配る ═══════════════════════
_a = []
_X0, _Y0, _S = 90, 90, 200
_a += [rect(_X0, _Y0, _S, _S, LINE, 2)]
_corners = [("ア", _X0, _Y0, "1", "5", -1, -1), ("エ", _X0 + _S, _Y0, "4", "8", 1, -1),
            ("イ", _X0, _Y0 + _S, "2", "6", -1, 1), ("ウ", _X0 + _S, _Y0 + _S, "3", "7", 1, 1)]
for _nm, _x, _y, _n1, _n2, _dx, _dy in _corners:
    _a.append(circ(_x + _dx * 26, _y + _dy * 26, 15, GRAY, 1.4, "#16203a"))
    _a.append(t(_x + _dx * 26, _y + _dy * 26 + 5, _nm, TX, 14))
    _a.append(t(_x + _dx * 26, _y + _dy * 50, "%s,%s…" % (_n1, _n2), HI, 12))
F["HG-4325"] = svg(380, 380, _a)

# ══ HG-4332 チャレンジ1：6列の表に整数をならべる ═══════════════════════
_b = []
_GX, _GY, _CW, _RH = 60, 20, 46, 34
_b += [rect(_GX, _GY, _CW, _RH, LINE, 1.8), ln(_GX, _GY, _GX + _CW, _GY + _RH, LINE, 1.2),
       t(_GX + 34, _GY + 14, "列", TX, 11), t(_GX + 12, _GY + 28, "行", TX, 11)]
for _c in range(6):
    _b += [rect(_GX + _CW * (_c + 1), _GY, _CW, _RH, LINE, 1.8),
           t(_GX + _CW * (_c + 1.5), _GY + 22, str(_c + 1), TX, 13)]
for _r in range(3):
    _y = _GY + _RH * (_r + 1)
    _b += [rect(_GX, _y, _CW, _RH, LINE, 1.8), t(_GX + _CW / 2, _y + 22, str(_r + 1), TX, 13)]
    for _c in range(6):
        _v = _r * 6 + _c + 1
        _b += [rect(_GX + _CW * (_c + 1), _y, _CW, _RH, LINE, 1.8),
               t(_GX + _CW * (_c + 1.5), _y + 22, str(_v), TX, 13)]
F["HG-4332"] = svg(400, 160, _b)

# ══ HG-4333 チャレンジ2：三角にならべた数（1〜5だん目） ═══════════════════
_c2 = []
_rows_data = [[2], [4, 5], [6, 7, 8], [8, 9, 10, 11], [10, 11, 12, 13, 14]]
_S3 = 42
for _r, _vals in enumerate(_rows_data):
    _y = 30 + _r * 36
    _x0 = 260 - (len(_vals) - 1) * _S3 / 2
    for _i, _v in enumerate(_vals):
        _x = _x0 + _i * _S3
        _c2.append(circ(_x, _y, 15, LINE, 1.6))
        _c2.append(t(_x, _y + 5, str(_v), TX, 13))
    _c2.append(t(30, _y + 5, "%dだん目" % (_r + 1), GRAY, 11))
F["HG-4333"] = svg(520, 220, _c2)


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
