# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.22「立体図形(2) 展開図」の図10本（HG-4238〜4250）。
作図が答えの3本（HG-4244・4248・4249）は原簿に記録だけ残しアプリには実装しない。

★根拠＝PDFの実物のみ。問題 PDF p34〜p42（本文p77〜84）／解答 PDF p29〜p32。

実物を見て確かめたこと（展開図はグリッドの単位マスの集合として描く。
セルどうしが接する辺＝折り目は薄い点線、外周は実線）：
  HG-4238 … 4つの展開図。①テーブル型（上3マス＋左右に足）＝6マスあるが並び方が直方体にならない
             ②③④は本文どおり。答え②④が直方体になる
  HG-4239 … 6つの展開図（①〜⑥）。①③⑥が立方体になる
  HG-4240 … 直方体（5cm×6cm×3cm）の展開図。頂点ア〜セ
  HG-4241 … あ・い・う が縦1列、いの右に え・お・か が横1列（Tの字型展開図）
  HG-4242 … 立方体の展開図。㋐㋑㋒が縦1列、㋓㋔㋕が横1列。頂点ア〜セ
  HG-4243 … 2つのさいころの展開図（十字型）にあ・い・う
  HG-4247 … 20cm四方の正方形の4すみから6cm四方を切り落とす
  HG-4250 … 4種類の紙（あ6×10・い10×8・う6×6・え8×6）と4行4列の表

使い方: python scripts/genbo_svg_g3b2_no22.py [--write]
"""
import argparse
import io
import math
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
from genbo_svg_g3b2_lib import (
    LINE, HI, TX, GRAY, FILL, svg, t, ln, rect, circ, dot, poly, polyline, path,
    right_mark, leader, dim, net, selfcheck, write_genbo)

F = {}

# ══ HG-4238 やさしい1：直方体になる展開図をえらぶ（①〜④・答え②④） ═════════
_a = []
_S = 30
NETS1 = {
    "①": {(0, 0), (1, 0), (2, 0), (0, 1), (0, 2), (2, 1)},          # 6マスだが並びが無効
    "②": {(1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (2, 2)},
    "③": {(0, 0), (1, 0), (1, 1), (2, 1), (1, 2), (2, 2)},
    "④": {(1, 0), (0, 1), (1, 1), (2, 1), (1, 2), (2, 2)},
}
for _i, (_nm, _cells) in enumerate(NETS1.items()):
    _ox = 20 + (_i % 2) * 210
    _oy = 30 + (_i // 2) * 150
    _a += net(_cells, _S, _ox, _oy)
    _a.append(t(_ox - 8, _oy - 10, _nm, TX, 15))
F["HG-4238"] = svg(460, 330, _a)

# ══ HG-4239 やさしい2：立方体になる展開図をえらぶ（①〜⑥・答え①③⑥） ═════════
_b = []
_S2 = 26
NETS2 = {
    "①": {(1, 0), (0, 1), (1, 1), (2, 1), (1, 2), (1, 3)},
    "②": {(1, 0), (1, 1), (0, 2), (1, 2), (2, 2), (1, 3)},
    "③": {(0, 0), (1, 0), (1, 1), (2, 1), (2, 2), (3, 2)},
    "④": {(1, 0), (0, 1), (1, 1), (1, 2), (2, 2), (1, 3)},
    "⑤": {(0, 0), (0, 1), (0, 2), (1, 2), (0, 3), (1, 3)},
    "⑥": {(1, 0), (1, 1), (0, 2), (1, 2), (0, 3), (1, 3)},
}
for _i, (_nm, _cells) in enumerate(NETS2.items()):
    _ox = 20 + (_i % 3) * 150
    _oy = 30 + (_i // 3) * 160
    _b += net(_cells, _S2, _ox, _oy)
    _b.append(t(_ox - 6, _oy - 10, _nm, TX, 15))
F["HG-4239"] = svg(480, 340, _b)

# ══ HG-4240 やさしい3：直方体の展開図の辺の長さ（頂点ア〜セ） ═══════════════
# たて5cm・よこ6cm・高さ3cm の直方体。上から 面(6x5)/面(6x3)/面(6x5)、
# 中段の左右に側面(3x3)が2枚ついた十字型の展開図。
_c = []
_LW, _SW, _HH = 96, 54, 78           # よこ6cm・たて3cm・高さ5cm（1cm=16px）
_X0, _Y0 = 90, 20
_c += [rect(_X0, _Y0, _LW, _HH, LINE, 2),
       rect(_X0, _Y0 + _HH, _LW, _SW, LINE, 2),
       rect(_X0, _Y0 + _HH + _SW, _LW, _HH, LINE, 2),
       rect(_X0 - _SW, _Y0 + _HH, _SW, _SW, LINE, 2),
       rect(_X0 + _LW, _Y0 + _HH, _SW, _SW, LINE, 2)]
_LBL = [("ア", _X0, _Y0, -14, -6), ("イ", _X0 + _LW, _Y0, 14, -6),
        ("シ", _X0, _Y0 + _HH, -14, 5), ("サ", _X0 + _LW, _Y0 + _HH, 14, 5),
        ("ケ", _X0 - _SW, _Y0 + _HH, -8, -8), ("ク", _X0 + _LW + _SW, _Y0 + _HH, 8, -8),
        ("ス", _X0, _Y0 + _HH + _SW, -14, 16), ("セ", _X0 + _LW, _Y0 + _HH + _SW, 14, 16),
        ("コ", _X0 - _SW, _Y0 + _HH + _SW, -8, 14), ("サ゛", _X0 + _LW + _SW, _Y0 + _HH + _SW, 8, 14),
        ("エ", _X0, _Y0 + 2 * _HH + _SW, -14, 5), ("オ", _X0 + _LW, _Y0 + 2 * _HH + _SW, 14, 5)]
for _nm, _x, _y, _dx, _dy in _LBL:
    _c.append(t(_x + _dx, _y + _dy, _nm.replace("サ゛", "サ"), TX, 13))
_c += dim(_X0, _Y0 - 10, _X0 + _LW, _Y0 - 10, "6cm", 0, side=1)
_c += dim(_X0 - _SW - 10, _Y0, _X0 - _SW - 10, _Y0 + _HH, "5cm", 0, side=1)
_c += dim(_X0 - _SW - 10, _Y0 + _HH, _X0 - _SW - 10, _Y0 + _HH + _SW, "3cm", 0, side=1)
F["HG-4240"] = svg(340, 300, _c)

# ══ HG-4241 やさしい4：展開図の面の平行・垂直（あ〜か） ═══════════════════
_d = []
_S4 = 42
_d += net({(1, 0), (1, 1), (1, 2), (0, 1), (2, 1), (3, 1)}, _S4, 30, 20)
_lab4 = [("あ", 1, 0), ("い", 1, 1), ("う", 1, 2), ("え", 0, 1), ("お", 2, 1), ("か", 3, 1)]
for _nm, _c4, _r4 in _lab4:
    _d.append(t(30 + (_c4 + 0.5) * _S4, 20 + (_r4 + 0.5) * _S4 + 5, _nm, TX, 15))
F["HG-4241"] = svg(280, 190, _d)

# ══ HG-4242 やさしい5：立方体の展開図・重なる辺と点（㋐〜㋕・頂点ア〜セ） ══════
_e = []
_S5 = 40
_cells5 = {(1, 0), (1, 1), (1, 2), (0, 1), (2, 1), (2, 2)}
_e += net(_cells5, _S5, 30, 20)
_lab5 = [("㋐", 1, 0), ("㋑", 1, 1), ("㋒", 1, 2), ("㋓", 0, 1), ("㋔", 2, 1), ("㋕", 2, 2)]
for _nm, _c5, _r5 in _lab5:
    _e.append(t(30 + (_c5 + 0.5) * _S5, 20 + (_r5 + 0.5) * _S5 + 5, _nm, HI, 15))
_VN = [("ア", 1, 0), ("イ", 2, 0), ("エ", 0, 1), ("オ", 1, 1), ("カ", 2, 1), ("キ", 3, 1),
       ("ク", 0, 2), ("ケ", 1, 2), ("コ", 2, 2), ("サ", 1, 3), ("シ", 2, 3), ("セ", 3, 2)]
for _nm, _c5, _r5 in _VN:
    _e.append(t(30 + _c5 * _S5 - 6, 20 + _r5 * _S5 - 4, _nm, TX, 11))
F["HG-4242"] = svg(320, 210, _e)

# ══ HG-4243 やさしい6：さいころの展開図で4の目の位置（①②） ═══════════════
_f = []


def die_face(cx, cy, s, n, color=TX):
    PIP = {1: [(0, 0)], 2: [(-1, -1), (1, 1)], 3: [(-1, -1), (0, 0), (1, 1)],
           4: [(-1, -1), (1, -1), (-1, 1), (1, 1)],
           5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)],
           6: [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)]}
    out = []
    if n:
        for (a, b) in PIP[n]:
            out.append(dot(cx + a * s * 0.22, cy + b * s * 0.22, s * 0.07, color))
    return out


_S6 = 34
_net6a = {(1, 0), (1, 1), (0, 1), (2, 1), (3, 1), (1, 2)}
_ox6, _oy6 = 30, 20
_f += net(_net6a, _S6, _ox6, _oy6)
_pips_a = {(1, 0): 5, (0, 1): 3, (1, 1): None, (2, 1): 4, (3, 1): None, (1, 2): 6}
_labs_a = {(1, 1): "あ", (3, 1): "い"}
for (_c6, _r6), _n6 in _pips_a.items():
    _cx6, _cy6 = _ox6 + (_c6 + 0.5) * _S6, _oy6 + (_r6 + 0.5) * _S6
    if _n6:
        _f += die_face(_cx6, _cy6, _S6, _n6)
    if (_c6, _r6) in _labs_a:
        _f.append(t(_cx6, _cy6 + 4, _labs_a[(_c6, _r6)], HI, 14))
_f.append(t(_ox6, _oy6 - 10, "①", TX, 15))
_ox6b = 260
_net6b = {(1, 0), (1, 1), (0, 1), (2, 1), (1, 2), (1, 3)}
_f += net(_net6b, _S6, _ox6b, _oy6)
_pips_b = {(1, 0): 2, (0, 1): 5, (1, 1): None, (2, 1): None, (1, 2): 3, (1, 3): 6}
_labs_b = {(1, 1): "あ", (2, 1): "い"}
for (_c6, _r6), _n6 in _pips_b.items():
    _cx6, _cy6 = _ox6b + (_c6 + 0.5) * _S6, _oy6 + (_r6 + 0.5) * _S6
    if _n6:
        _f += die_face(_cx6, _cy6, _S6, _n6)
    if (_c6, _r6) in _labs_b:
        _f.append(t(_cx6, _cy6 + 4, _labs_b[(_c6, _r6)], HI, 14))
_f.append(t(_ox6b, _oy6 - 10, "②", TX, 15))
_f.append(t(240, 210, "う…裏がわの面", GRAY, 12))
F["HG-4243"] = svg(480, 230, _f)

# ══ HG-4247 むずかしい3：4すみを切り落として箱を作る（20cm・6cm） ═══════════
_g = []
_Sq = 160
_ox7, _oy7 = 40, 30
_cut = 6.0 / 20.0 * _Sq
_g += [rect(_ox7, _oy7, _Sq, _Sq, LINE, 2)]
for (_ccx, _ccy) in [(0, 0), (1, 0), (0, 1), (1, 1)]:
    _x = _ox7 + _ccx * (_Sq - _cut)
    _y = _oy7 + _ccy * (_Sq - _cut)
    _g.append(rect(_x, _y, _cut, _cut, HI, 1.6, "#3a3060"))
_g += dim(_ox7, _oy7, _ox7 + _Sq, _oy7, "20cm", 16, side=-1)
_g += dim(_ox7, _oy7, _ox7, _oy7 + _cut, "6cm", 16, side=-1)
F["HG-4247"] = svg(280, 230, _g)

# ══ HG-4250 チャレンジ2：4種類の紙と4行4列の表 ═══════════════════════════
_h = []
_papers = [("あ", 60, 100), ("い", 100, 80), ("う", 60, 60), ("え", 80, 60)]
_px = 30
for _nm, _w8, _h8 in _papers:
    _sc = 0.55
    _h += [rect(_px, 30, _w8 * _sc, _h8 * _sc, LINE, 1.8), t(_px + _w8 * _sc / 2,
           30 + _h8 * _sc + 18, "%s(%d×%d)" % (_nm, _w8, _h8), TX, 11)]
    _px += _w8 * _sc + 24
_GX, _GY, _CW, _RH = 40, 130, 60, 30
_cols = ["あ", "い", "う", "え"]
_rows = ["立方体", "直方体1", "直方体2", "直方体3"]
_vals = {(0, 0): "0", (0, 1): "0", (1, 2): "2", (2, 2): "0", (2, 3): "4"}
for _j, _cn in enumerate(_cols):
    _h += [rect(_GX + 90 + _j * _CW, _GY, _CW, _RH, LINE, 1.6),
           t(_GX + 90 + _j * _CW + _CW / 2, _GY + 20, _cn, TX, 13)]
_h.append(rect(_GX, _GY, 90, _RH, LINE, 1.6))
for _i9, _rn in enumerate(_rows):
    _y = _GY + _RH + _i9 * _RH
    _h += [rect(_GX, _y, 90, _RH, LINE, 1.6), t(_GX + 45, _y + 20, _rn, TX, 12)]
    for _j in range(4):
        _h.append(rect(_GX + 90 + _j * _CW, _y, _CW, _RH, LINE, 1.6))
        _v = _vals.get((_j, _i9))
        if _v:
            _h.append(t(_GX + 90 + _j * _CW + _CW / 2, _y + 20, _v, HI, 13))
F["HG-4250"] = svg(400, 300, _h)


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
