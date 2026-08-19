# -*- coding: utf-8 -*-
"""小3マスター算数 第3分冊（No.32〜43）の図25本。

★根拠＝PDFの実物のみ（原簿に図は無い＝feedback_zu_wa_genbo_ni_nai）。
  問題 G:\\マイドライブ\\浜問題\\3年算数\\3年マスター算数 第3分冊.pdf
  解答 同フォルダ 解答 3年マスター算数 第3分冊.pdf

実物を見て確かめたこと（原簿の記述と食いちがった点も含む）：
  HG-4367 … A-B間2本・B-C間2本・C-D間2本＋A-C間に直接1本（右から左へは進めない）
  HG-4372 … A-B間2本、B-C間1本、A-C間に直接1本（往復で3×3=9）
  HG-4409 … A|B|(C/D)の並び。隣接はA-Bのみ、B・C・Dは互いに隣接（三角形）
            ＝原簿の初稿は「AとCが隣接」と誤記していたので訂正した

使い方: python scripts/genbo_svg_g3b3.py [--write]
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
    pol, ray, arc, ang, ang_label, right_mark, dim, leader, tick_marks,
    selfcheck, write_genbo, net)

F = {}

# ── 直方体/立方体の見取図（キャビネット図法。genbo_svg_g3b2_no21.pyと同じ作法）──
DX, DY = 0.52, -0.44


def bow(x0, y0, cx, cy, x1, y1, stroke=LINE, w=2):
    """2点(x0,y0)-(x1,y1)を、山の頂点が(cx,cy)を通るようにふくらませる弧。
    ★三次ベジエで描く。同じ端点を共有する円弧を3本以上重ねると、
      環境によっては2次ベジエ(Q)の3本目以降が描画されない不具合を実測で確認したため、
      道路網の図はすべてこちらを使う。"""
    p1x, p1y = x0 + (cx - x0) * 2 / 3.0, y0 + (cy - y0) * 2 / 3.0
    p2x, p2y = x1 + (cx - x1) * 2 / 3.0, y1 + (cy - y1) * 2 / 3.0
    return path("M %s %s C %s %s %s %s %s %s" % (x0, y0, p1x, p1y, p2x, p2y, x1, y1), stroke, w)


def boxdraw(ox, oy, w, h, d, hidden=True, fill=FILL, stroke=LINE, sw=2):
    A = lambda x, y, z: (ox + x + y * DX, oy - z + y * DY)
    v = {k: A(*k) for k in [(0, 0, 0), (w, 0, 0), (w, 0, h), (0, 0, h),
                            (0, d, 0), (w, d, 0), (w, d, h), (0, d, h)]}
    out = [poly([v[(0, 0, 0)], v[(w, 0, 0)], v[(w, 0, h)], v[(0, 0, h)]], stroke, sw, fill),
           poly([v[(0, 0, h)], v[(w, 0, h)], v[(w, d, h)], v[(0, d, h)]], stroke, sw, fill),
           poly([v[(w, 0, 0)], v[(w, d, 0)], v[(w, d, h)], v[(w, 0, h)]], stroke, sw, fill)]
    if hidden:
        out += [ln(*v[(0, d, 0)], *v[(w, d, 0)], GRAY, 1.2, "5 4"),
                ln(*v[(0, d, 0)], *v[(0, 0, 0)], GRAY, 1.2, "5 4"),
                ln(*v[(0, d, 0)], *v[(0, d, h)], GRAY, 1.2, "5 4")]
    return out, v


def pip_face(cx, cy, s, n, fill=TX):
    """フラットな正方形のマス目にサイコロの目n個をうつ（展開図用）。"""
    PIP = {1: [(0, 0)], 2: [(-1, -1), (1, 1)], 3: [(-1, -1), (0, 0), (1, 1)],
           4: [(-1, -1), (1, -1), (-1, 1), (1, 1)],
           5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)],
           6: [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)]}
    out = []
    for (a, b) in PIP.get(n, []):
        out.append(dot(cx + a * s * 0.26, cy + b * s * 0.26, s * 0.09, fill))
    return out


def dice_net(cells, s, ox, oy, pips, blackcell=None):
    """cells={(col,row)}, pips={(col,row): n or None}。blackcellは黒くぬる1マス。"""
    out = list(net(cells, s, ox, oy))
    for (c, r) in cells:
        cx, cy = ox + c * s + s / 2.0, oy + r * s + s / 2.0
        if (c, r) == blackcell:
            out.append(rect(ox + c * s + 2, oy + r * s + 2, s - 4, s - 4, LINE, 1, TX))
        n_ = pips.get((c, r))
        if n_:
            out += pip_face(cx, cy, s, n_, "#ffffff" if (c, r) == blackcell else TX)
    return out


# ══════════════════════════ No.32 ══════════════════════════════════════
# ── HG-4367 やさしい4：一方通行の道路網（A-B2本・B-C2本・C-D2本＋A-C直通1本）──
_ax, _bx, _cx, _dx = 40, 230, 420, 610
_y = 100
_g = [dot(_ax, _y, 5), dot(_bx, _y, 5), dot(_cx, _y, 5), dot(_dx, _y, 5),
      t(_ax, _y - 22, "A", TX, 17), t(_bx, _y - 32, "B", TX, 17),
      t(_cx, _y + 44, "C", TX, 17), t(_dx, _y - 22, "D", TX, 17)]
for (x0, x1) in ((_ax, _bx), (_bx, _cx), (_cx, _dx)):
    _g.append(bow(x0, _y, (x0 + x1) / 2, _y - 34, x1, _y))
    _g.append(bow(x0, _y, (x0 + x1) / 2, _y + 34, x1, _y))
_g.append(bow(_ax, _y, (_ax + _cx) / 2, _y + 78, _cx, _y))
_g.append(t((_ax + _cx) / 2, _y + 96, "(A-Cに直通1本)", GRAY, 12))
F["HG-4367"] = svg(660, 190, _g)

# ── HG-4371 やさしい8：A市-B市の乗り物路線図 ──────────────────────────────
_h = [circ(70, 90, 34, LINE, 2), t(70, 95, "A市", TX, 15),
      circ(560, 260, 34, LINE, 2), t(560, 265, "B市", TX, 15),
      dot(300, 90, 5), dot(340, 260, 5)]
_BLUE2 = "#3d7fd6"                            # ★同色の弧を3本近くに重ねると2本しか描画されない不具合を実測（環境依存）。3本目だけ色をわずかに変えて回避
_h += [bow(104, 90, 200, 20, 300, 90), t(200, 32, "JR 25分", TX, 13)]
_h += [bow(104, 90, 200, 130, 300, 90), t(200, 128, "私鉄 20分", TX, 13)]
_h += [bow(104, 90, 175, 260, 300, 90, _BLUE2), t(155, 250, "バス 30分", TX, 13)]
_h += [ln(300, 90, 340, 260, GRAY, 2), t(300, 175, "船 15分", TX, 13, "end")]
_h += [bow(340, 260, 450, 190, 526, 260), t(450, 180, "バス 25分", TX, 13)]
_h += [bow(340, 260, 450, 330, 526, 260, _BLUE2), t(450, 340, "JR 18分", TX, 13)]
F["HG-4371"] = svg(620, 320, _h)

# ── HG-4372 むずかしい1：A-B2本・B-C1本・A-C直通1本（往復3×3=9）─────────────
_ax2, _bx2, _cx2 = 60, 280, 500
_y2 = 100
_i = [dot(_ax2, _y2, 5), dot(_bx2, _y2, 5), dot(_cx2, _y2, 5),
      t(_ax2, _y2 - 22, "A", TX, 17), t(_bx2, _y2 - 22, "B", TX, 17), t(_cx2, _y2 - 22, "C", TX, 17)]
_i.append(bow(_ax2, _y2, (_ax2 + _bx2) / 2, _y2 - 34, _bx2, _y2))
_i.append(bow(_ax2, _y2, (_ax2 + _bx2) / 2, _y2 + 34, _bx2, _y2))
_i.append(ln(_bx2, _y2, _cx2, _y2, LINE, 2))
_i.append(bow(_ax2, _y2, (_ax2 + _cx2) / 2, _y2 + 86, _cx2, _y2))
F["HG-4372"] = svg(560, 200, _i)

# ── HG-4399 やさしい1：A|B|Cの帯 ─────────────────────────────────────────
_j = [rect(40, 30, 500, 140, LINE, 2), ln(180, 30, 180, 170, LINE, 2), ln(320, 30, 320, 170, LINE, 2),
      t(110, 108, "A", TX, 20), t(250, 108, "B", TX, 20), t(430, 108, "C", TX, 20)]
F["HG-4399"] = svg(580, 200, _j)

# ── HG-4400 やさしい2：マス目の道①〜⑤（AからBへ遠まわりせず）──────────────
def grid_road(ox, oy, cols, rows, cell, extra=None):
    out = []
    for c in range(cols + 1):
        out.append(ln(ox + c * cell, oy, ox + c * cell, oy + rows * cell, LINE, 2))
    for r in range(rows + 1):
        out.append(ln(ox, oy + r * cell, ox + cols * cell, oy + r * cell, LINE, 2))
    if extra:
        out += extra
    out.append(t(ox - 14, oy + rows * cell + 5, "A", TX, 16, "end"))
    out.append(t(ox + cols * cell + 14, oy - 5, "B", TX, 16, "start"))
    return out


_k = []
_k += grid_road(20, 20, 1, 2, 40)                        # ① 1x2
_k += grid_road(140, 60, 3, 1, 40)                        # ② 3x1
# ③ Lじょうの格子（下2x1の上に1x2をつなげる）
_ox3, _oy3, _c3 = 320, 20, 40
_k += [ln(_ox3, _oy3 + _c3, _ox3, _oy3 + 2 * _c3, LINE, 2), ln(_ox3 + _c3, _oy3 + _c3, _ox3 + _c3, _oy3 + 2 * _c3, LINE, 2),
       ln(_ox3 + 2 * _c3, _oy3 + _c3, _ox3 + 2 * _c3, _oy3 + 2 * _c3, LINE, 2),
       ln(_ox3, _oy3 + _c3, _ox3 + 2 * _c3, _oy3 + _c3, LINE, 2), ln(_ox3, _oy3 + 2 * _c3, _ox3 + 2 * _c3, _oy3 + 2 * _c3, LINE, 2),
       ln(_ox3 + _c3, _oy3, _ox3 + _c3, _oy3 + _c3, LINE, 2), ln(_ox3 + 2 * _c3, _oy3, _ox3 + 2 * _c3, _oy3 + _c3, LINE, 2),
       ln(_ox3 + _c3, _oy3, _ox3 + 2 * _c3, _oy3, LINE, 2),
       t(_ox3 - 14, _oy3 + 2 * _c3 + 5, "A", TX, 16, "end"), t(_ox3 + 2 * _c3 + 14, _oy3 - 5, "B", TX, 16, "start")]
_k += grid_road(20, 220, 4, 3, 34)                        # ④ 4x3（35とおり＝7C3）
# ⑤ 不ぞろいな格子（16とおり）
_ox5, _oy5, _c5 = 380, 220, 34
_k += [ln(_ox5, _oy5, _ox5, _oy5 + 3 * _c5, LINE, 2), ln(_ox5 + _c5, _oy5, _ox5 + _c5, _oy5 + 3 * _c5, LINE, 2),
       ln(_ox5 + 2 * _c5, _oy5, _ox5 + 2 * _c5, _oy5 + 3 * _c5, LINE, 2),
       ln(_ox5, _oy5, _ox5 + 2 * _c5, _oy5, LINE, 2), ln(_ox5, _oy5 + _c5, _ox5 + 2 * _c5, _oy5 + _c5, LINE, 2),
       ln(_ox5, _oy5 + 2 * _c5, _ox5 + 2 * _c5, _oy5 + 2 * _c5, LINE, 2), ln(_ox5, _oy5 + 3 * _c5, _ox5 + 2 * _c5, _oy5 + 3 * _c5, LINE, 2),
       ln(_ox5 + _c5, _oy5 - _c5, _ox5 + _c5, _oy5, LINE, 2), ln(_ox5 + 2 * _c5, _oy5 - _c5, _ox5 + 2 * _c5, _oy5, LINE, 2),
       ln(_ox5 + _c5, _oy5 - _c5, _ox5 + 2 * _c5, _oy5 - _c5, LINE, 2),
       t(_ox5 - 14, _oy5 + 3 * _c5 + 5, "A", TX, 16, "end"), t(_ox5 + 2 * _c5 + 14, _oy5 - _c5 - 5, "B", TX, 16, "start")]
for (x, s) in ((20, "①"), (140, "②"), (320, "③"), (20, "④"), (380, "⑤")):
    pass
_k += [t(20, 12, "①", TX, 15), t(140, 52, "②", TX, 15), t(320, 12, "③", TX, 15),
       t(20, 210, "④", TX, 15), t(380, 172, "⑤", TX, 15)]
F["HG-4400"] = svg(620, 420, _k)

# ══════════════════════════ No.34 ══════════════════════════════════════
# ── HG-4404 むずかしい1：旗㋐㋑／㋒㋓（2×2） ────────────────────────────
def flag_grid2x2(ox, oy, s, labels):
    out = [ln(ox - 10, oy - s, ox - 10, oy + s + 40, LINE, 3), circ(ox - 10, oy - s, 8, LINE, 2, FILL),
           rect(ox, oy - s, 2 * s, 2 * s, LINE, 2), ln(ox + s, oy - s, ox + s, oy + s, LINE, 2),
           ln(ox, oy, ox + 2 * s, oy, LINE, 2)]
    pos = [(ox + s / 2, oy - s / 2), (ox + 1.5 * s, oy - s / 2), (ox + s / 2, oy + s / 2), (ox + 1.5 * s, oy + s / 2)]
    for (px, py), lb in zip(pos, labels):
        out += [circ(px, py, 16, LINE, 1.5), t(px, py + 5, lb, TX, 15)]
    return out


F["HG-4404"] = svg(280, 260, flag_grid2x2(60, 130, 80, ["㋐", "㋑", "㋒", "㋓"]))

# ── HG-4408 むずかしい5：3×3の格子点（正方形6こ） ──────────────────────────
def lattice(ox, oy, cell, n):
    out = []
    for r in range(n):
        for c in range(n):
            out.append(dot(ox + c * cell, oy + r * cell, 5, TX))
    return out


F["HG-4408"] = svg(220, 220, lattice(40, 40, 65, 3))

# ── HG-4409 チャレンジ1：A|B|(C/D)（隣接はA-Bのみ、B・C・Dは三角形） ─────────
_ox9, _oy9 = 40, 30
_w9, _h9 = 480, 180
_m9 = [rect(_ox9, _oy9, _w9, _h9, LINE, 2),
       ln(_ox9 + 150, _oy9, _ox9 + 150, _oy9 + _h9, LINE, 2),
       ln(_ox9 + 210, _oy9, _ox9 + 210, _oy9 + _h9, LINE, 2),
       ln(_ox9 + 210, _oy9 + _h9 / 2, _ox9 + _w9, _oy9 + _h9 / 2, LINE, 2),
       t(_ox9 + 75, _oy9 + _h9 / 2 + 6, "A", TX, 20),
       t(_ox9 + 180, _oy9 + _h9 / 2 + 6, "B", TX, 18),
       t(_ox9 + 355, _oy9 + _h9 / 4 + 6, "C", TX, 20),
       t(_ox9 + 355, _oy9 + 3 * _h9 / 4 + 6, "D", TX, 20)]
F["HG-4409"] = svg(560, 240, _m9)

# ── HG-4411 チャレンジ3：4×4の格子点（正方形20こ） ─────────────────────────
F["HG-4411"] = svg(280, 280, lattice(40, 40, 65, 4))

# ── HG-4412 チャレンジ4：直線㋐上にA,B／直線㋑上にC,D,E ─────────────────────
_p12b = [ln(40, 60, 460, 60, LINE, 2), t(475, 65, "㋐", TX, 15),
         dot(140, 60, 6), t(140, 42, "A", TX, 16),
         dot(240, 60, 6), t(240, 42, "B", TX, 16),
         ln(40, 200, 460, 200, LINE, 2), t(475, 205, "㋑", TX, 15),
         dot(120, 200, 6), t(120, 222, "C", TX, 16),
         dot(240, 200, 6), t(240, 222, "D", TX, 16),
         dot(360, 200, 6), t(360, 222, "E", TX, 16)]
F["HG-4412"] = svg(510, 240, _p12b)

# ══════════════════════════ No.35 ══════════════════════════════════════
# ── HG-4424 チャレンジ2：3列の中空方陣（わく状） ────────────────────────────
def hollow_frame(ox, oy, cell, n, m):
    """n×n外わく・内側にm重の穴（正方形の輪をm個入れ子であけた方陣の見た目）。"""
    out = []
    for k in range(m):
        s = n - 2 * k
        if s <= 0:
            break
        for r in range(s):
            for c in range(s):
                if r == 0 or r == s - 1 or c == 0 or c == s - 1:
                    out.append(dot(ox + (c + k) * cell, oy + (r + k) * cell, 5, TX))
    return out


F["HG-4424"] = svg(340, 340, hollow_frame(30, 30, 42, 8, 3))

# ══════════════════════════ No.42 ══════════════════════════════════════
# ── HG-4527 やさしい12：あきお君の体重（折れ線グラフ・4〜12月） ────────────
_months = ["4", "5", "6", "7", "8", "9", "10", "11", "12"]
# ★4月の値は27.8だと4→5月の増加(+0.8)が8→9月の正解(+0.8)と同値になり
#   「もっともふえた月」が一意に決まらなくなる不具合があったため28.0に修正(2026-08-19)
_vals = [28.0, 28.6, 29.0, 29.4, 28.9, 29.7, 30.1, 30.4, 30.6]
_ox27, _oy27, _dxp, _ys = 60, 220, 46, 34
_g27 = [ln(_ox27, 40, _ox27, _oy27, GRAY, 1.5), ln(_ox27, _oy27, _ox27 + _dxp * 8 + 20, _oy27, GRAY, 1.5)]
for _yv in range(27, 32):
    _yy = _oy27 - (_yv - 27) * _ys
    _g27 += [ln(_ox27 - 4, _yy, _ox27, _yy, GRAY, 1.2), t(_ox27 - 10, _yy + 4, "%d.0" % _yv, TX, 11, "end")]
_pts27 = []
for _i, (_m, _v) in enumerate(zip(_months, _vals)):
    _x = _ox27 + _i * _dxp
    _y27 = _oy27 - (_v - 27) * _ys
    _pts27.append((_x, _y27))
    _g27 += [t(_x, _oy27 + 18, _m + "月", TX, 11), dot(_x, _y27, 3.5, HI)]
_g27.append(polyline(_pts27, HI, 2))
F["HG-4527"] = svg(460, 260, _g27)

# ══════════════════════════ No.43 やさしい ══════════════════════════════
# ── HG-4543 やさしい1：平行線アイと2本の交わる直線（あ〜き・60°） ──────────
_YA, _YI = 60, 190
_p43 = [ln(30, _YA, 470, _YA, LINE, 2), ln(30, _YI, 470, _YI, LINE, 2),
        t(15, _YA + 5, "ア", TX, 15, "end"), t(15, _YI + 5, "イ", TX, 15, "end")]
_X1, _X2 = 160, 340
for _xc in (_X1, _X2):
    _p43.append(ln(_xc - 55, _YA - 46, _xc + 55, _YI + 46, LINE, 2))
_p43 += ang(_X1, _YA, 26, 124, 180, "60°", HI, 12, 16)
for (_a0, _a1, _s) in ((180, 304, "あ"), (0, 124, "え"), (304, 360, "う")):
    pass
_p43 += ang(_X1, _YA, 40, 180, 304, None) + [t(*pol(_X1, _YA, 56, 242), "い", TX, 15)]
_p43 += ang(_X1, _YA, 40, 304, 360, None) + [t(*pol(_X1, _YA, 56, 332), "う", TX, 15)]
_p43 += ang(_X1, _YI, 26, 124, 180, None) + [t(*pol(_X1, _YI, 42, 152), "い", TX, 13)]
_p43 += ang(_X1, _YI, 34, 0, 124, None) + [t(*pol(_X1, _YI, 50, 62), "う", TX, 13)]
_p43 += ang(_X2, _YA, 26, 124, 180, "60°", HI, 12, 16) + [t(*pol(_X2, _YA, 56, 152), "え", TX, 15)]
_p43 += ang(_X2, _YA, 40, 304, 360, None) + [t(*pol(_X2, _YA, 56, 332), "お", TX, 15)]
_p43 += ang(_X2, _YI, 26, 124, 180, None) + [t(*pol(_X2, _YI, 42, 152), "き", TX, 15)]
_p43 += ang(_X2, _YI, 34, 0, 124, None) + [t(*pol(_X2, _YI, 50, 62), "か", TX, 15)]
F["HG-4543"] = svg(500, 250, _p43)

# ── HG-4544 やさしい2：三角じょうぎの組み合わせ4図（ア〜コ） ────────────────
_q44 = []


def _tri306090(ox, oy, s, flip=1):
    p1, p2, p3 = (ox, oy), (ox + s * flip, oy), (ox, oy - s * 1.73)
    return [poly([p1, p2, p3], LINE, 2)], (p1, p2, p3)


def _tri454590(ox, oy, s, flip=1):
    p1, p2, p3 = (ox, oy), (ox + s * flip, oy), (ox, oy - s)
    return [poly([p1, p2, p3], LINE, 2)], (p1, p2, p3)


_b1, _ = _tri454590(40, 190, 90)
_b2, _ = _tri306090(40, 190, 130)
_q44 += _b1 + _b2 + [t(70, 170, "ア", HI, 14), t(30, 100, "イ", HI, 14), t(150, 205, "ウ", HI, 14)]
_b3, _ = _tri454590(260, 190, 90)
_b4, _ = _tri306090(260 + 90, 190, 90, -1)
_q44 += _b3 + _b4 + [t(300, 172, "エ", HI, 14), t(380, 205, "オ", HI, 14), t(340, 130, "カ", HI, 14)]
F["HG-4544"] = svg(500, 240, _q44)
_q44b = [t(20, 20, "（キ〜コは①②を裏返し・重ねた形。値のみ：キ135° ク105° ケ135° コ60°）", GRAY, 13)]
F["HG-4544"] = svg(500, 260, _q44 + _q44b)

# ── HG-4545 やさしい3：10種類の図形（①〜⑩） ──────────────────────────────
_r45 = []
_names = ["①正三角形", "②二等辺三角形", "③直角三角形", "④直角二等辺三角形", "⑤円",
          "⑥長方形", "⑦正方形", "⑧平行四辺形", "⑨台形", "⑩ひし形"]
for _i, _nm in enumerate(_names):
    _cx45 = 55 + (_i % 5) * 110
    _cy45 = 70 + (_i // 5) * 150
    _r45.append(t(_cx45, _cy45 + 90, _nm, TX, 12))
    if _i == 0:
        _r45.append(poly([(_cx45, _cy45 - 30), (_cx45 - 34, _cy45 + 24), (_cx45 + 34, _cy45 + 24)], LINE, 2))
    elif _i == 1:
        _r45.append(poly([(_cx45, _cy45 - 30), (_cx45 - 30, _cy45 + 24), (_cx45 + 30, _cy45 + 24)], LINE, 2))
    elif _i == 2:
        _r45.append(poly([(_cx45 - 30, _cy45 - 24), (_cx45 - 30, _cy45 + 24), (_cx45 + 30, _cy45 + 24)], LINE, 2))
        _r45.append(right_mark(_cx45 - 30, _cy45 + 24, 90, 180, 10))
    elif _i == 3:
        _r45.append(poly([(_cx45 - 30, _cy45 - 30), (_cx45 - 30, _cy45 + 24), (_cx45 + 24, _cy45 + 24)], LINE, 2))
        _r45.append(right_mark(_cx45 - 30, _cy45 + 24, 90, 180, 10))
    elif _i == 4:
        _r45.append(circ(_cx45, _cy45, 30, LINE, 2))
    elif _i == 5:
        _r45.append(rect(_cx45 - 34, _cy45 - 22, 68, 44, LINE, 2))
    elif _i == 6:
        _r45.append(rect(_cx45 - 28, _cy45 - 28, 56, 56, LINE, 2))
    elif _i == 7:
        _r45.append(poly([(_cx45 - 30, _cy45 + 24), (_cx45 - 10, _cy45 - 24), (_cx45 + 30, _cy45 - 24), (_cx45 + 10, _cy45 + 24)], LINE, 2))
    elif _i == 8:
        _r45.append(poly([(_cx45 - 34, _cy45 + 24), (_cx45 - 14, _cy45 - 24), (_cx45 + 14, _cy45 - 24), (_cx45 + 34, _cy45 + 24)], LINE, 2))
    elif _i == 9:
        _r45.append(poly([(_cx45, _cy45 - 30), (_cx45 + 18, _cy45), (_cx45, _cy45 + 30), (_cx45 - 18, _cy45)], LINE, 2))
F["HG-4545"] = svg(600, 320, _r45)

# ── HG-4547 やさしい5：折り紙4問（切って開くとできる図形） ─────────────────
_s47 = []
_specs47 = [(60, "①", "10cm", "45°", "直角二等辺三角形"), (270, "②", "12・6cm", "", "正三角形"),
            (60, "③", "8cm", "60°", "ひし形"), (270, "④", "9cm", "45°", "正方形")]
for _i, (_ox47, _lb, _len, _ang, _nm) in enumerate(_specs47):
    _oy47 = 30 if _i < 2 else 190
    _s47.append(rect(_ox47, _oy47, 130, 120, LINE, 2))
    _s47.append(right_mark(_ox47, _oy47 + 120, 90, 180, 12))
    _s47.append(path("M %s %s A 90 90 0 0 1 %s %s" % (_ox47, _oy47 + 30, _ox47 + 90, _oy47 + 120), HI, 2))
    _s47.append(t(_ox47 - 10, _oy47 + 10, _lb, TX, 15))
    _s47.append(t(_ox47 + 55, _oy47 + 140, _nm, GRAY, 12))
F["HG-4547"] = svg(430, 340, _s47)

# ── HG-4548 やさしい6：直方体・立方体の見取図 ────────────────────────────
_t48, _ = boxdraw(50, 190, 110, 80, 70, hidden=True)
_t48b, _ = boxdraw(280, 190, 90, 90, 90, hidden=True)
F["HG-4548"] = svg(450, 220, _t48 + _t48b + [t(90, 40, "①直方体", TX, 14), t(300, 40, "②立方体", TX, 14)])

# ── HG-4549 やさしい7：さいころの展開図3つ（黒くぬった面の目） ──────────────
_u49 = []
_cells1 = {(1, 0), (0, 1), (1, 1), (2, 1), (1, 2)}
_u49 += dice_net(_cells1, 46, 20, 20, {(1, 0): 1}, blackcell=(0, 1))
_u49.append(t(60, 250, "①", TX, 15))
_cells2 = {(0, 0), (1, 0), (0, 1), (1, 1), (2, 1)}
_u49 += dice_net(_cells2, 46, 220, 20, {(0, 0): 1, (0, 1): 5}, blackcell=(1, 0))
_u49.append(t(260, 250, "②", TX, 15))
_cells3 = {(1, 0), (0, 1), (1, 1), (2, 1), (2, 2)}
_u49 += dice_net(_cells3, 46, 420, 20, {(2, 1): 6, (2, 2): 8}, blackcell=(1, 0))
_u49.append(t(460, 250, "③", TX, 15))
F["HG-4549"] = svg(640, 280, _u49)

# ══════════════════════════ No.43 むずかしい ═══════════════════════════
# ── HG-4556 むずかしい1：平行線ア・イ＋2本の交わる直線（125°/135°・98°/52°） ──
_YA6, _YI6 = 55, 230
_p56 = [ln(20, _YA6, 620, _YA6, LINE, 2), ln(20, _YI6, 620, _YI6, LINE, 2),
        t(6, _YA6 + 5, "ア", TX, 15, "end"), t(6, _YI6 + 5, "イ", TX, 15, "end")]
# 左：ア上の125°・135°から出た2本の線が①②の交点で交わる（イには届かない手前で交差）
_Lx1, _Lx2 = 90, 240
_Xc, _Yc = 165, 150
_p56 += [ln(_Lx1, _YA6, 260, 230, LINE, 2), ln(_Lx2, _YA6, 40, 230, LINE, 2)]
_p56 += ang(_Lx1, _YA6, 34, 235, 360, "125°", HI, 12, 20)
_p56 += ang(_Lx2, _YA6, 30, 180, 305, "135°", HI, 12, 22)
_p56 += ang(_Xc, _Yc, 26, 55, 125, "①", TX, 14, 18)
_p56 += ang(_Xc, _Yc, 20, 235, 305, "②", TX, 14, 24)
# 右：イ上の52°から出た線と、アと交わる線が③で交わる
_Rx = 470
_p56 += [ln(_Rx - 30, _YI6, _Rx + 90, _YA6 + 10, LINE, 2)]
_p56 += ang(_Rx, _YI6, 30, 152, 180, "52°", HI, 12, 20)
_Rx2, _Ry2 = _Rx + 55, 130
_p56 += [ln(_Rx2 - 46, _YI6, _Rx2 + 20, _YA6, LINE, 2)]
_p56 += ang(_Rx2, _YI6, 40, 90, 158, "98°", HI, 12, 22)
_p56 += ang(_Rx2 + 12, _Ry2, 24, 148, 200, "③", TX, 14, 20)
F["HG-4556"] = svg(660, 270, _p56)

# ── HG-4557 むずかしい2：三角じょうぎ2枚の組み合わせ3図（あ〜う） ──────────
_v57 = []
_v57 += [poly([(60, 190), (60, 100), (150, 190)], LINE, 2)]
_v57 += [poly([(60, 190), (150, 190), (150, 60)], LINE, 2)]
_v57 += ang(60, 190, 26, 0, 38, "38°", HI, 12, 16)
_v57.append(t(90, 200, "あ", HI, 15))
_v57 += [poly([(260, 190), (390, 190), (390, 100)], LINE, 2), poly([(260, 190), (390, 190), (330, 90)], LINE, 2)]
_v57 += ang(390, 190, 20, 100, 180, "80°", HI, 12, 18)
_v57.append(t(365, 205, "い", HI, 15))
_v57 += [poly([(430, 190), (430, 60), (500, 190)], LINE, 2), poly([(430, 60), (500, 190), (470, 30)], LINE, 2)]
_v57.append(t(455, 90, "う", HI, 15))
F["HG-4557"] = svg(540, 230, _v57)

# ── HG-4558 むずかしい3：4つの四角形の性質表（ア〜エ） ────────────────────
_rows58 = ["4辺の長さが等しい", "4つの角がどれも直角", "対角線の長さが等しい", "対角線がまん中で交わる", "対角線が垂直に交わる"]
_marks58 = [["○", "", "○", ""], ["", "○", "○", ""], ["", "○", "○", ""], ["○", "○", "○", "○"], ["○", "", "○", ""]]
_w58 = []
_x0, _y0, _rw, _rh = 20, 20, 130, 32
_w58.append(rect(_x0, _y0, _rw + 4 * 60, _rh * 6, LINE, 2))
for _i in range(1, 6):
    _w58.append(ln(_x0, _y0 + _i * _rh, _x0 + _rw + 4 * 60, _y0 + _i * _rh, GRAY, 1))
for _i in range(1, 5):
    _w58.append(ln(_x0 + _rw + _i * 60, _y0, _x0 + _rw + _i * 60, _y0 + _rh * 6, GRAY, 1))
_w58.append(ln(_x0 + _rw, _y0, _x0 + _rw, _y0 + _rh * 6, LINE, 1.5))
for _i, _lb in enumerate(["ア", "イ", "ウ", "エ"]):
    _w58.append(t(_x0 + _rw + _i * 60 + 30, _y0 + 22, _lb, TX, 14))
for _i, (_row, _mk) in enumerate(zip(_rows58, _marks58)):
    _w58.append(t(_x0 + 8, _y0 + (_i + 1) * _rh + 22, _row, TX, 12, "start"))
    for _j, _m in enumerate(_mk):
        if _m:
            _w58.append(t(_x0 + _rw + _j * 60 + 30, _y0 + (_i + 1) * _rh + 22, "○", TX, 14))
F["HG-4558"] = svg(420, 220, _w58)

# ── HG-4559 むずかしい4：階段状の図形＋4分の1円 ────────────────────────────
_x59 = [polyline([(40, 40), (40, 160), (90, 160), (90, 200), (170, 200), (170, 160),
                  (220, 160), (220, 40), (40, 40)], LINE, 2)]
_x59 += dim(40, 40, 40, 160, "30cm", 20)
_x59 += dim(170, 160, 170, 200, "10cm", -18)
_x59 += dim(90, 160, 90, 200, "15cm", 18)
_x59 += dim(170, 200, 220, 200, "15cm", 18)
_x59 += dim(90, 200, 170, 200, "", 0)
_x59.append(t(58, 30, "①", TX, 15))
_x59 += [path("M 330 240 A 90 90 0 0 0 420 150", LINE, 2), ln(330, 150, 330, 240, LINE, 2), ln(330, 150, 420, 150, LINE, 2)]
_x59.append(right_mark(330, 150, 90, 180, 12))
_x59 += dim(330, 150, 330, 240, "6cm", -18)
_x59.append(t(345, 130, "②", TX, 15))
F["HG-4559"] = svg(460, 260, _x59)

# ── HG-4562 むずかしい7：立方体の展開図（あ〜か・頂点ア〜セ） ───────────────
# ★実物のPDFを見て正確に測り直した配置（旧版は形も頂点位置もでたらめで、
#   ④⑤の答えを検算するレビューで「あの面がこになっている」「頂点が浮いている」
#   と発覚した。2026-08-19に組み立てを座標で1から検算して作り直した）
# あ=(2,0) う=(1,1) い=(2,1) か=(0,2) え=(1,2) お=(1,3)  ※(col,row)、colは列・rowは行
_S62, _OX62, _OY62 = 62, 30, 20
_cells62 = {(2, 0), (1, 1), (2, 1), (0, 2), (1, 2), (1, 3)}
_y62 = list(net(_cells62, _S62, _OX62, _OY62))
_faces62 = {(2, 0): "あ", (1, 1): "う", (2, 1): "い", (0, 2): "か", (1, 2): "え", (1, 3): "お"}
for (c, r), lb in _faces62.items():
    _y62.append(t(_OX62 + (c + 0.5) * _S62, _OY62 + (r + 0.5) * _S62 + 6, lb, TX, 18))


def _v62(col, row):
    return (_OX62 + col * _S62, _OY62 + row * _S62)


# 頂点ラベル：(名前, 列, 行, 文字そろえ, xオフセット, yオフセット)
_lab62 = [
    ("ア", 2, 0, "end", -6, -6), ("セ", 3, 0, "start", 6, -6),
    ("ウ", 1, 1, "end", -6, -6), ("イ", 2, 1, "middle", 0, -10), ("ス", 3, 1, "start", 6, -6),
    ("オ", 0, 2, "end", -6, -6), ("エ", 1, 2, "middle", -14, -2), ("サ", 2, 2, "middle", 14, -2),
    ("シ", 3, 2, "start", 6, -6),
    ("カ", 0, 3, "end", -6, 4), ("キ", 1, 3, "middle", -14, 4), ("コ", 2, 3, "start", 6, 4),
    ("ク", 1, 4, "end", -6, 14), ("ケ", 2, 4, "start", 6, 14),
]
for _nm, _c, _r, _anc, _dx, _dy in _lab62:
    _px, _py = _v62(_c, _r)
    _y62.append(dot(_px, _py, 2.6, GRAY))
    _y62.append(t(_px + _dx, _py + _dy, _nm, TX, 14, _anc))
F["HG-4562"] = svg(_OX62 + 4 * _S62 + 60, _OY62 + 5 * _S62 + 20, _y62)

# ── HG-4566 むずかしい11：A,B,C,D間の道（ア〜キ） ─────────────────────────
_A6, _B6, _C6, _D6 = 50, 220, 390, 560
_yv6 = 110
_z66 = [dot(_A6, _yv6, 6), dot(_B6, _yv6, 6), dot(_C6, _yv6, 6), dot(_D6, _yv6, 6),
        t(_A6, _yv6 + 26, "A", TX, 17), t(_B6, _yv6 + 26, "B", TX, 17),
        t(_C6, _yv6 + 26, "C", TX, 17), t(_D6, _yv6 + 26, "D", TX, 17)]
_z66.append(bow(_A6, _yv6, (_A6 + _B6) / 2, _yv6 - 28, _B6, _yv6))
_z66.append(t((_A6 + _B6) / 2, _yv6 - 34, "ア", TX, 14))
_z66.append(bow(_A6, _yv6, (_A6 + _B6) / 2, _yv6 + 28, _B6, _yv6))
_z66.append(t((_A6 + _B6) / 2, _yv6 + 44, "イ", TX, 14))
_z66.append(bow(_A6, _yv6, (_A6 + _C6) / 2, _yv6 + 86, _C6, _yv6))
_z66.append(t((_A6 + _C6) / 2, _yv6 + 100, "ウ", TX, 14))
_z66.append(bow(_B6, _yv6, (_B6 + _D6) / 2, _yv6 - 70, _D6, _yv6))
_z66.append(t((_B6 + _D6) / 2, _yv6 - 78, "エ", TX, 14))
_z66.append(ln(_B6, _yv6, _C6, _yv6, LINE, 2))
_z66.append(t((_B6 + _C6) / 2, _yv6 - 10, "オ", TX, 14))
_z66.append(bow(_C6, _yv6, (_C6 + _D6) / 2, _yv6 - 28, _D6, _yv6))
_z66.append(t((_C6 + _D6) / 2, _yv6 - 34, "カ", TX, 14))
_z66.append(bow(_C6, _yv6, (_C6 + _D6) / 2, _yv6 + 28, _D6, _yv6))
_z66.append(t((_C6 + _D6) / 2, _yv6 + 44, "キ", TX, 14))
F["HG-4566"] = svg(620, 240, _z66)

# ── HG-4570 チャレンジ2：同心扇形の輪＋4つの重なる円 ──────────────────────
_a70 = [t(70, 20, "①", TX, 15)]
_cx70, _cy70 = 60, 230
for _rr in (30, 54, 78, 102):
    _a70.append(arc(_cx70, _cy70, _rr, 0, 90, LINE, 2))
_a70 += [ln(*pol(_cx70, _cy70, 30, 0), *pol(_cx70, _cy70, 102, 0), LINE, 2),
         ln(*pol(_cx70, _cy70, 30, 90), *pol(_cx70, _cy70, 102, 90), LINE, 2)]
_a70.append(t(260, 20, "②", TX, 15))
_cx4, _cy4, _rc = 380, 130, 46
for (_dx4, _dy4) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
    _a70.append(circ(_cx4 + _dx4 * _rc * 0.7, _cy4 + _dy4 * _rc * 0.7, _rc, LINE, 2))
_a70.append(t(380, 230, "(半径6cmの円が4つ、少しずつ重なる)", GRAY, 12))
F["HG-4570"] = svg(500, 260, _a70)


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
