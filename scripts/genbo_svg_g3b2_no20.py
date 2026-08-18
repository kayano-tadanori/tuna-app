# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.20「平面図形(3) 円と球」の図7本（HG-4212〜4221）。

★根拠＝PDFの実物のみ。問題 PDF p23〜p26（本文p51〜54）／解答 PDF p20〜p23。
★この回の円周率は「3」（小3なので3.14ではない）。

実物を見て確かめたこと：
  HG-4212 … 円の中に中心の点・半径(イ)・直径(ウ)。(ア)は中心の点を指す
  HG-4215 … 大きい円の中に同じ大きさの小さい円が2つ横にならぶ。小さい円に半径4cmの線
  HG-4216 … ①直径5cm（点線）②半径2cm（点線・矢じるし）③直径6cmの半円（平らな辺が下）
             ④半径2cmの四分円（直角は左下）
  HG-4218 … ふたのない箱をななめから見た絵。ボールが横4こ・たて2こ。手前の辺に36cm、右に「たて」
  HG-4219 … 同じ絵でボールが横4こ・たて5こ。半径7cm
  HG-4220 … ①トラック形（直線50m・はば30m）②1辺10cmの正方形＋左下を中心とする四分円、
             斜線は弧と右上のすみの間 ③半径30cm・60°のおうぎ形
             ④直径10cmの半円（上）＋直径6cmの半円（左・上ぶくらみ）＋直径4cmの半円（右・下ぶくらみ）
  HG-4221 … ①1辺20cmの正方形の4すみを中心とする半径10cmの弧4本でできた星形
             ②1辺20cmの正方形の左下と右上を中心とする半径20cmの弧2本でできた葉っぱ形
             ③半径3cmと半径4cmの60°のおうぎ形が頂点で向かい合う
             ④45°・内半径8cm・外半径16cmのおうぎ形の帯

使い方: python scripts/genbo_svg_g3b2_no20.py [--write]
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
    LINE, HI, TX, GRAY, FILL, svg, t, ln, rect, circ, dot, poly, polyline, path, pol,
    ray, arc, ang, right_mark, leader, dim, selfcheck, write_genbo)

F = {}
D = math.radians


def P(x, y, r, deg):
    return (x + r * math.cos(D(deg)), y - r * math.sin(D(deg)))


def arcp(cx, cy, r, a0, a1, sweep_ccw=True):
    """円弧のパス断片（Aコマンド）。数学の角度・y反転ずみ。"""
    x1, y1 = P(cx, cy, r, a1)
    span = (a1 - a0) % 360 if sweep_ccw else (a0 - a1) % 360
    large = 1 if span > 180 else 0
    return "A %.1f %.1f 0 %d %d %.1f %.1f" % (r, r, large, 0 if sweep_ccw else 1, x1, y1)


def mv(cx, cy, r, a):
    x, y = P(cx, cy, r, a)
    return "M %.1f %.1f" % (x, y)


def sector(cx, cy, r, a0, a1, fill="none", stroke=LINE, w=2):
    """a0から反時計まわりにa1までのおうぎ形。"""
    x0, y0 = P(cx, cy, r, a0)
    return path("M %.1f %.1f L %.1f %.1f %s Z" % (cx, cy, x0, y0, arcp(cx, cy, r, a0, a1)),
                stroke, w, fill)


# ══ HG-4212 やさしい1：円の各部の名まえ ═══════════════════════════════════
_cx, _cy, _r = 170, 130, 100
_a = [circ(_cx, _cy, _r, LINE, 2), dot(_cx, _cy, 4, HI)]
_P1 = P(_cx, _cy, _r, 55)                      # 直径の上の端
_P2 = P(_cx, _cy, _r, 235)                     # 直径の下の端
_P3 = P(_cx, _cy, _r, -60)                     # 半径の端
_a += [ln(_P1[0], _P1[1], _P2[0], _P2[1], LINE, 2), ln(_cx, _cy, _P3[0], _P3[1], LINE, 2)]
_a += [t(300, 96, "(ア)", HI, 15, "start"), ln(296, 100, _cx + 6, _cy - 4, GRAY, 1.1),
       t(300, 196, "(イ)", HI, 15, "start"), ln(296, 192, (_cx + _P3[0]) / 2 + 4,
                                                (_cy + _P3[1]) / 2 + 2, GRAY, 1.1),
       t(46, 96, "(ウ)", HI, 15, "end"), ln(50, 100, (_cx + _P1[0]) / 2 - 6,
                                            (_cy + _P1[1]) / 2 + 4, GRAY, 1.1)]
F["HG-4212"] = svg(360, 250, _a)

# ══ HG-4215 やさしい4：大きい円の中に小さい円2つ ═══════════════════════════
_R, _rr = 130, 65
_CX, _CY = 160, 150
_b = [circ(_CX, _CY, _R, LINE, 2),
      circ(_CX - _rr, _CY, _rr, LINE, 2), circ(_CX + _rr, _CY, _rr, LINE, 2),
      dot(_CX - _rr, _CY, 3.4, HI), dot(_CX + _rr, _CY, 3.4, HI)]
_b += [ln(_CX - _rr, _CY, _CX - _rr, _CY - _rr, HI, 1.8),
       ln(_CX + _rr, _CY, _CX + _rr, _CY - _rr, HI, 1.8),
       t(_CX - _rr - 22, _CY - _rr / 2 + 5, "4cm", TX, 13, "end"),
       t(_CX + _rr + 22, _CY - _rr / 2 + 5, "4cm", TX, 13, "start")]
F["HG-4215"] = svg(400, 300, _b)

# ══ HG-4216 やさしい5：円・半円・四分円のまわり ═══════════════════════════
_c = []
# ① 直径5cm
_c += [circ(90, 90, 58, LINE, 2), ln(32, 90, 148, 90, HI, 1.6, "5 4"), dot(90, 90, 3.4, HI),
       t(90, 84, "5cm", TX, 13), t(24, 34, "①", TX, 15)]
# ② 半径2cm
_c += [circ(280, 90, 58, LINE, 2), ln(280, 90, 338, 90, HI, 1.6, "5 4"), dot(280, 90, 3.4, HI),
       t(310, 112, "2cm", TX, 13), t(214, 34, "②", TX, 15)]
# ③ 直径6cmの半円（平らな辺が下）
_c += [path("M 30 254 %s Z" % arcp(90, 254, 60, 180, 0, False), LINE, 2),
       dot(90, 254, 3.4, HI), t(90, 276, "6cm", TX, 13), t(24, 186, "③", TX, 15)]
# ④ 半径2cmの四分円（直角は左下）
_c += [sector(240, 254, 74, 0, 90), right_mark(240, 254, 0, 90, 12),
       t(226, 216, "2cm", TX, 13, "end"), t(214, 186, "④", TX, 15)]
F["HG-4216"] = svg(400, 290, _c)


def openbox(ox, oy, cols, rows, ball, label_w):
    """ふたのない箱をななめ上から見た絵＋中のボール。(ox,oy)＝手前の底の左はし。"""
    W = cols * ball
    Dx, Dy = rows * ball * 0.42, -rows * ball * 0.40      # おく行き（手前を下、おくを上）
    wall = 24
    out = [poly([(ox, oy), (ox + W, oy), (ox + W + Dx, oy + Dy), (ox + Dx, oy + Dy)], LINE, 2, FILL)]
    for r in range(rows - 1, -1, -1):                     # おくの列から先に描く
        fy = oy + Dy * (r + 0.5) / rows
        fx = ox + Dx * (r + 0.5) / rows
        for c in range(cols):
            out.append(circ(fx + (c + 0.5) * ball, fy, ball * 0.42, HI, 1.6, FILL))
    out += [poly([(ox, oy), (ox + W, oy), (ox + W, oy + wall), (ox, oy + wall)], LINE, 2, FILL),
            ln(ox + W, oy, ox + W + Dx, oy + Dy, LINE, 2),
            ln(ox + W, oy + wall, ox + W + Dx, oy + Dy + wall, LINE, 2),
            ln(ox + W + Dx, oy + Dy, ox + W + Dx, oy + Dy + wall, LINE, 2)]
    out += dim(ox, oy + wall + 6, ox + W, oy + wall + 6, label_w, 16, side=1)
    out.append(t(ox + W + Dx + 14, oy + Dy / 2 + wall, "たて", TX, 13, "start"))
    return out


# ══ HG-4218 むずかしい2：箱にきちんと入ったボール（横4こ・たて2こ） ═════════
_d2 = openbox(46, 150, 4, 2, 56, "36cm")
_d2.append(t(180, 26, "ボールが 横に4こ・たてに2こ きちんと入っている", GRAY, 12))
F["HG-4218"] = svg(400, 220, _d2)

# ══ HG-4219 むずかしい3：半径7cmのボールが4×5 ═══════════════════════════
_e = openbox(46, 230, 4, 5, 52, "横")
_e.append(t(200, 26, "半径7cmのボールが 横に4こ・たてに5こ", GRAY, 12))
F["HG-4219"] = svg(420, 300, _e)

# ══ HG-4220 むずかしい4：曲線と直線がまざった図形のまわり ═════════════════
_f = []
# ① トラック形（直線50m・はば30m）
_S = 2.6
_x0, _y0 = 90, 90
_L, _Hh = 50 * _S, 30 * _S
_f += [path("M %.1f %.1f L %.1f %.1f %s L %.1f %.1f %s Z" % (
    _x0, _y0 - _Hh / 2, _x0 + _L, _y0 - _Hh / 2,
    arcp(_x0 + _L, _y0, _Hh / 2, 90, 270, False), _x0, _y0 + _Hh / 2,
    arcp(_x0, _y0, _Hh / 2, 270, 90, False)), LINE, 2)]
_f += [ln(_x0, _y0 - _Hh / 2, _x0, _y0 + _Hh / 2, HI, 1.4, "5 4"),
       ln(_x0 + _L, _y0 - _Hh / 2, _x0 + _L, _y0 + _Hh / 2, HI, 1.4, "5 4"),
       dot(_x0, _y0, 3.2, HI), dot(_x0 + _L, _y0, 3.2, HI),
       t(_x0 + _L / 2, _y0 - _Hh / 2 - 10, "50m", TX, 13),
       t(_x0 + _L + 26, _y0 + 5, "30m", TX, 13, "start"), t(30, 40, "①", TX, 15)]
# ② 正方形10cm＋四分円、斜線は弧と右上のすみの間
_sx, _sy, _ss = 400, 34, 112
_f += [path("M %.1f %.1f L %.1f %.1f L %.1f %.1f %s Z" % (
    _sx, _sy, _sx + _ss, _sy, _sx + _ss, _sy + _ss,
    arcp(_sx, _sy + _ss, _ss, 0, 90)), LINE, 2, FILL)]
_f += [rect(_sx, _sy, _ss, _ss, LINE, 1.6)]
_f += dim(_sx, _sy + _ss, _sx, _sy, "10cm", 18, side=-1)
_f += dim(_sx, _sy + _ss, _sx + _ss, _sy + _ss, "10cm", 16, side=1)
_f.append(t(_sx - 44, 40, "②", TX, 15))
# ③ 半径30cm・60°のおうぎ形
_f += [sector(96, 300, 118, 0, 60)]
_f += ang(96, 300, 34, 0, 60, "60°", HI, 12, 18)
_f += [t(96 + 60 * 0.5 - 34, 300 - 106 * 0.6, "30cm", TX, 13, "end"), t(30, 210, "③", TX, 15)]
_f += [ln(96, 300, *P(96, 300, 118, 60), stroke=LINE, w=2)]
# ④ 直径10cmの半円＋直径6cm(上ぶくらみ)＋直径4cm(下ぶくらみ)
_bx, _by, _u = 392, 316, 15.0
_f += [path("M %.1f %.1f %s %s %s Z" % (
    _bx, _by, arcp(_bx + 5 * _u, _by, 5 * _u, 180, 0),
    arcp(_bx + 8 * _u, _by, 2 * _u, 0, 180),
    arcp(_bx + 3 * _u, _by, 3 * _u, 360, 180, False)), LINE, 2, FILL)]
_f += [ln(_bx, _by, _bx + 10 * _u, _by, HI, 1.4, "5 4"),
       dot(_bx + 3 * _u, _by, 3.2, HI), dot(_bx + 8 * _u, _by, 3.2, HI),
       t(_bx + 3 * _u, _by - 8, "6cm", TX, 13), t(_bx + 8 * _u, _by - 8, "4cm", TX, 13),
       t(_bx - 44, 246, "④", TX, 15)]
F["HG-4220"] = svg(620, 400, _f)

# ══ HG-4221 チャレンジ1：曲線を組みかえてまわりの長さを出す ═══════════════
_g = []
# ① 1辺20cmの正方形＋4すみを中心とする半径10cmの弧＝星形
_qx, _qy, _q = 60, 40, 130
_h2 = _q / 2
_g += [rect(_qx, _qy, _q, _q, LINE, 1.6)]
_g += [path("M %.1f %.1f %s %s %s %s Z" % (
    _qx + _h2, _qy,
    arcp(_qx, _qy, _h2, 0, -90, False),
    arcp(_qx, _qy + _q, _h2, 90, 0, False),
    arcp(_qx + _q, _qy + _q, _h2, 180, 90, False),
    arcp(_qx + _q, _qy, _h2, 270, 180, False)), LINE, 2, FILL)]
_g += dim(_qx, _qy + _q, _qx + _q, _qy + _q, "20cm", 16, side=1)
_g.append(t(_qx - 34, _qy + 6, "①", TX, 15))
# ② 1辺20cmの正方形の左下・右上を中心とする半径20cmの弧＝葉っぱ形
_qx2 = 330
_g += [rect(_qx2, _qy, _q, _q, LINE, 1.6)]
_g += [path("M %.1f %.1f %s %s Z" % (
    _qx2, _qy, arcp(_qx2, _qy + _q, _q, 90, 0, False),
    arcp(_qx2 + _q, _qy, _q, 270, 180, False)), LINE, 2, FILL)]
_g += dim(_qx2, _qy + _q, _qx2 + _q, _qy + _q, "20cm", 16, side=1)
_g.append(t(_qx2 - 34, _qy + 6, "②", TX, 15))
# ③ 半径3cmと4cmの60°おうぎ形が頂点で向かい合う
_vx, _vy = 200, 300
_g += [sector(_vx, _vy, 66, 150, 210, FILL), sector(_vx, _vy, 88, -30, 30, FILL)]
_g += ang(_vx, _vy, 26, 150, 210, "60°", HI, 12, 18)
_g += ang(_vx, _vy, 26, -30, 30, "60°", HI, 12, 18)
_g += [t(_vx - 74, _vy - 42, "3cm", TX, 13, "end"), t(_vx + 78, _vy + 54, "4cm", TX, 13, "start"),
       t(60, 250, "③", TX, 15)]
# ④ 45°・内半径8cm・外半径16cmのおうぎ形の帯
_ex, _ey = 400, 380
_g += [path("M %.1f %.1f %s L %.1f %.1f %s Z" % (
    P(_ex, _ey, 74, 0)[0], P(_ex, _ey, 74, 0)[1],
    arcp(_ex, _ey, 74, 0, 45),
    P(_ex, _ey, 148, 45)[0], P(_ex, _ey, 148, 45)[1],
    arcp(_ex, _ey, 148, 45, 0, False)), LINE, 2, FILL)]
_g += [ln(_ex, _ey, *P(_ex, _ey, 74, 0), stroke=LINE, w=1.6),
       ln(_ex, _ey, *P(_ex, _ey, 74, 45), stroke=LINE, w=1.6)]
_g += ang(_ex, _ey, 34, 0, 45, "45°", HI, 12, 18)
_g += [t(_ex + 37, _ey + 22, "8cm", TX, 13), t(_ex + 111, _ey + 22, "8cm", TX, 13),
       t(330, 250, "④", TX, 15)]
F["HG-4221"] = svg(620, 420, _g)


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
