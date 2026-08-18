# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.16「角(1)」の図10本（HG-4170〜4179）。

★根拠＝PDFの実物のみ（原簿に図は無い＝feedback_zu_wa_genbo_ni_nai）。
  問題 G:\\マイドライブ\\浜問題\\3年算数\\3年マスター算数 第2分冊.pdf  PDF p5〜p8（本文p15〜18）
  解答 同フォルダ 解答 3年マスター算数2分冊.pdf  PDF p7〜p9
  ※本文ページ＝PDFページ+10（No.16の場合）。回ごとにずれるので必ず解答の「P.○」で照合する。

実物を見て確かめたこと（原簿の記述と食いちがった点も含む）：
  HG-4170 … 2直線の交差。左の角そのものが40°で、それが あ。え(上)・う(右)・い(下)
  HG-4172③… 3直線の交差。130°＝たての上向きから左下の線まで／60°＝たての下向きから右下の線まで
             ／う＝右上の線と右下の線の間（130−60＝70）
  HG-4174 … い は「ウとイの交点の**左上**」（原簿の設定は「左下」と書いていたが実物は左上。
             左下なら117°になり模範解答の63°と合わない）→ 設定も直した
  HG-4177②… 112°は「左上の線から右上の線まで」、42°は「左上の線からたての線まで」。
             あ＝たての線と右上の線の間＝112−42＝70
  HG-4179 … 横線の上に3本の線。左から ●(横線左〜1本目)・●(1〜2本目)・×(2〜3本目)・×(3本目〜横線右)。
             あ は内がわ2つ（●と×）にまたがる弧

使い方: python scripts/genbo_svg_g3b2_no16.py [--write]
"""
import argparse
import math
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo
from genbo_svg_g3b2_lib import (
    LINE, HI, TX, GRAY, svg, t, ln, circ, dot, poly, polyline, pol, ray, arc,
    ang, ang_label, right_mark, selfcheck, write_genbo)

F = {}

# ══ HG-4170 やさしい1：2直線の交差（あ=40°・え・う・い） ═════════════════
_cx, _cy = 175, 95
_b = [ln(*pol(_cx, _cy, 150, 200), *pol(_cx, _cy, 150, 20), LINE, 2),
      ln(*pol(_cx, _cy, 150, 160), *pol(_cx, _cy, 150, 340), LINE, 2)]
_b += ang(_cx, _cy, 40, 160, 200, None)          # 左＝40°の弧
_b += [t(*pol(_cx, _cy, 62, 180), "40°", HI, 14)]
for _a0, _a1, _s in ((160, 200, "あ"), (20, 160, "え"), (340, 20, "う"), (200, 340, "い")):
    _p = pol(_cx, _cy, 26 if _s in "あう" else 30, _a0 + ((_a1 - _a0) % 360) / 2.0)
    _b.append(t(_p[0], _p[1] + 5, _s, TX, 15))
F["HG-4170"] = svg(350, 190, _b)

# ══ HG-4171 やさしい2：一直線・直角からの引き算6問 ═══════════════════════
# 6つの小図（2行3列）。各セル 155×115、原点は各セルの左上。
_cells = []


def _cell(ox, oy, draw):
    _cells.extend(draw(ox, oy))


def _line_h(ox, oy, y, x0=12, x1=145):
    return ln(ox + x0, oy + y, ox + x1, oy + y, LINE, 2)


def _f_a(ox, oy):                      # あ：横線に20°の線、あは左がわ
    vx, vy = ox + 90, oy + 88
    return [_line_h(ox, oy, 88), ray(vx, vy, 20, 58, LINE, 2)] + \
        ang(vx, vy, 30, 20, 180, None) + \
        [t(*pol(vx, vy, 46, 100), "あ", TX, 15)] + \
        ang(vx, vy, 16, 0, 20, "20°", HI, 11, 22)


def _f_i(ox, oy):                      # い：横線に25°の線、155°が左・いが右
    vx, vy = ox + 82, oy + 88
    return [_line_h(ox, oy, 88), ray(vx, vy, 25, 58, LINE, 2)] + \
        ang(vx, vy, 30, 25, 180, "155°", HI, 11, 16) + \
        [t(*pol(vx, vy, 54, 13), "い", TX, 15)]


def _f_u(ox, oy):                      # う：横線に2本、65°と60°、うはその間
    vx, vy = ox + 78, oy + 88
    return [_line_h(ox, oy, 88), ray(vx, vy, 115, 66, LINE, 2), ray(vx, vy, 60, 66, LINE, 2)] + \
        ang(vx, vy, 26, 115, 180, "65°", HI, 11, 16) + \
        ang(vx, vy, 26, 0, 60, "60°", HI, 11, 16) + \
        [t(*pol(vx, vy, 44, 87), "う", TX, 15)]


def _f_e(ox, oy):                      # え：直角のしるし、えは右がわ
    vx, vy = ox + 62, oy + 88
    return [_line_h(ox, oy, 88), ray(vx, vy, 90, 62, LINE, 2),
            right_mark(vx, vy, 90, 180, 12)] + \
        [t(*pol(vx, vy, 40, 45), "え", TX, 15)] + ang(vx, vy, 30, 0, 90, None)


def _f_o(ox, oy):                      # お：横線に70°で交わる線、おは右下がわの大きい角
    vx, vy = ox + 74, oy + 40
    return [_line_h(ox, oy, 40), ray(vx, vy, 250, 62, LINE, 2), ray(vx, vy, 70, 20, LINE, 2)] + \
        ang(vx, vy, 24, 180, 250, "70°", HI, 11, 17) + \
        ang(vx, vy, 34, 250, 360, None) + \
        [t(*pol(vx, vy, 50, 305), "お", TX, 15)]


def _f_ka(ox, oy):                     # か：直角のしるしと30°、かは右下の角
    vx, vy = ox + 62, oy + 88
    return [_line_h(ox, oy, 88), ray(vx, vy, 90, 62, LINE, 2), ray(vx, vy, 60, 62, LINE, 2),
            right_mark(vx, vy, 90, 180, 12)] + \
        ang(vx, vy, 34, 60, 90, "30°", HI, 11, 16) + \
        ang(vx, vy, 24, 0, 60, None) + \
        [t(*pol(vx, vy, 40, 30), "か", TX, 15)]


for _i, _fn in enumerate((_f_a, _f_i, _f_u, _f_e, _f_o, _f_ka)):
    _cell(20 + (_i % 3) * 158, 10 + (_i // 3) * 122, _fn)
F["HG-4171"] = svg(500, 260, _cells)

# ══ HG-4172 やさしい3：1まわり360°の角7問 ═══════════════════════════════
_c3 = []


def _g_a(ox, oy):                      # ①2直線の交差、上160°・下あ
    vx, vy = ox + 76, oy + 62
    return [ln(*pol(vx, vy, 68, 180), *pol(vx, vy, 68, 0), LINE, 2),
            ln(*pol(vx, vy, 68, 20), *pol(vx, vy, 68, 200), LINE, 2)] + \
        ang(vx, vy, 30, 20, 180, "160°", HI, 11, 15) + \
        [t(*pol(vx, vy, 34, 280), "あ", TX, 15)]


def _g_i(ox, oy):                      # ②V字130°の外まわりい
    vx, vy = ox + 76, oy + 68
    return [ray(vx, vy, 205, 68, LINE, 2), ray(vx, vy, 335, 68, LINE, 2)] + \
        ang(vx, vy, 26, 205, 335, "130°", HI, 11, 16) + \
        ang(vx, vy, 40, 335, 205, None) + \
        [t(*pol(vx, vy, 56, 90), "い", TX, 15)]


def _g_u(ox, oy):                      # ③3直線の交差、130°・60°・う
    vx, vy = ox + 76, oy + 66
    return [ln(*pol(vx, vy, 62, 90), *pol(vx, vy, 62, 270), LINE, 2),
            ln(*pol(vx, vy, 68, 40), *pol(vx, vy, 68, 220), LINE, 2),
            ln(*pol(vx, vy, 68, 330), *pol(vx, vy, 68, 150), LINE, 2)] + \
        ang(vx, vy, 28, 90, 220, "130°", HI, 11, 17) + \
        ang(vx, vy, 24, 270, 330, "60°", HI, 11, 16) + \
        ang(vx, vy, 34, 330, 40, None) + \
        [t(*pol(vx, vy, 50, 5), "う", TX, 15)]


def _g_e(ox, oy):                      # ④2直線の交差、え・お・50°・か
    vx, vy = ox + 76, oy + 60
    out = [ln(*pol(vx, vy, 70, 180), *pol(vx, vy, 70, 0), LINE, 2),
           ln(*pol(vx, vy, 70, 130), *pol(vx, vy, 70, 310), LINE, 2)]
    out += ang(vx, vy, 24, 310, 360, "50°", HI, 11, 15)
    for _a0, _a1, _s in ((130, 180, "え"), (0, 130, "お"), (180, 310, "か")):
        out.append(t(*pol(vx, vy, 34, _a0 + ((_a1 - _a0) % 360) / 2.0), _s, TX, 15))
    return out


def _g_ki(ox, oy):                     # ⑤直角の外まわりき
    vx, vy = ox + 66, oy + 74
    return [ray(vx, vy, 90, 62, LINE, 2), ray(vx, vy, 0, 62, LINE, 2),
            right_mark(vx, vy, 0, 90, 12)] + \
        ang(vx, vy, 34, 90, 0, None) + \
        [t(*pol(vx, vy, 52, 225), "き", TX, 15)]


for _i, _fn in enumerate((_g_a, _g_i, _g_u, _g_e, _g_ki)):
    _c3.extend(_fn(16 + (_i % 3) * 162, 8 + (_i // 3) * 130))
F["HG-4172"] = svg(510, 270, _c3)

# ══ HG-4173 やさしい4：平行線と1本の直線（①〜⑦） ═════════════════════════
_YA, _YI = 55, 175
_XA = 265                                   # 直線アとの交点
_XI = _XA - (_YI - _YA) / math.tan(math.radians(50))
_p4 = [ln(30, _YA, 430, _YA, LINE, 2), ln(30, _YI, 430, _YI, LINE, 2),
       t(20, _YA + 5, "ア", TX, 15, "end"), t(20, _YI + 5, "イ", TX, 15, "end"),
       ln(_XI - 40, _YI + 48, _XA + 34, _YA - 40, LINE, 2)]
for _cx2, _lab in ((_XA, ("①", "50°", "②", "③")), (_XI, ("④", "⑦", "⑤", "⑥"))):
    _cy2 = _YA if _cx2 == _XA else _YI
    for _a0, _a1, _s in ((50, 180, _lab[0]), (0, 50, _lab[1]),
                         (180, 230, _lab[2]), (230, 360, _lab[3])):
        _mid = _a0 + ((_a1 - _a0) % 360) / 2.0
        _r = 30 if ((_a1 - _a0) % 360) > 60 else 40
        _p4.append(t(*[pol(_cx2, _cy2, _r, _mid)[0], pol(_cx2, _cy2, _r, _mid)[1] + 5],
                     _s, HI if _s == "50°" else TX, 13 if _s == "50°" else 15))
    _p4 += ang(_cx2, _cy2, 20, 0, 50, None)
F["HG-4173"] = svg(450, 230, _p4)

# ══ HG-4174 やさしい5：2組の平行線（あ〜え） ═══════════════════════════════
_YA, _YI = 80, 200
_UP, _DN = 117, 297                          # ウ・エの向き（上向き／下向き）
_dx = (_YI - _YA) * math.cos(math.radians(-63)) / math.sin(math.radians(63))
_p5 = [ln(35, _YA, 415, _YA, LINE, 2), ln(35, _YI, 415, _YI, LINE, 2),
       t(25, _YA + 5, "ア", TX, 15, "end"), t(25, _YI + 5, "イ", TX, 15, "end")]
_WA, _EA = 120, 250                          # ウ・エがアと交わるx
for _x0, _nm in ((_WA, "ウ"), (_EA, "エ")):
    _p5.append(ln(_x0 - 22, _YA - 43, _x0 + _dx + 22, _YI + 43, LINE, 2))
    _p5.append(t(_x0 - 30, _YA - 50, _nm, TX, 15))
_p5 += ang(_EA, _YA, 26, _UP, 180, "63°", HI, 13, 17)
_p5 += ang(_WA, _YA, 26, 180, _DN, None) + [t(*pol(_WA, _YA, 46, 238), "あ", TX, 15)]
_p5 += ang(_WA + _dx, _YI, 26, _UP, 180, None) + [t(*pol(_WA + _dx, _YI, 46, 148), "い", TX, 15)]
_p5 += ang(_EA + _dx, _YI, 26, 0, _UP, None) + [t(*pol(_EA + _dx, _YI, 46, 58), "う", TX, 15)]
_p5 += ang(_EA, _YA, 26, _DN, 360, None) + [t(*pol(_EA, _YA, 46, 328), "え", TX, 15)]
F["HG-4174"] = svg(440, 270, _p5)

# ══ HG-4175 むずかしい1：平行線・55°をうつす ═══════════════════════════════
_YA, _YI = 55, 165
_TD, _TU = 305, 125                          # 斜線の向き（下向き／上向き）
_dx = (_YI - _YA) * math.cos(math.radians(-55)) / math.sin(math.radians(55))
_XA = 165
_p6 = [ln(35, _YA, 375, _YA, LINE, 2), ln(35, _YI, 375, _YI, LINE, 2),
       t(25, _YA + 5, "ア", TX, 15, "end"), t(25, _YI + 5, "イ", TX, 15, "end"),
       ln(_XA - 24, _YA - 34, _XA + _dx + 24, _YI + 34, LINE, 2)]
_p6 += ang(_XA, _YA, 26, _TD, 360, "55°", HI, 13, 17)
_p6 += ang(_XA + _dx, _YI, 26, _TU, 180, None) + [t(*pol(_XA + _dx, _YI, 46, 152), "あ", TX, 15)]
_p6 += ang(_XA + _dx, _YI, 32, 180, _TD, None) + [t(*pol(_XA + _dx, _YI, 52, 242), "い", TX, 15)]
F["HG-4175"] = svg(400, 220, _p6)

# ══ HG-4176 むずかしい2：2組の平行線・115°をうつす ═══════════════════════
_YA, _YI = 55, 175
_UP, _DN = 65, 245
_dx = (_YI - _YA) * math.cos(math.radians(65)) / math.sin(math.radians(65))
_p7 = [ln(35, _YA, 415, _YA, LINE, 2), ln(35, _YI, 415, _YI, LINE, 2),
       t(25, _YA + 5, "ア", TX, 15, "end"), t(25, _YI + 5, "イ", TX, 15, "end")]
_WI, _EI = 110, 250                          # ウ・エがイと交わるx
for _x0, _nm in ((_WI, "ウ"), (_EI, "エ")):
    _p7.append(ln(_x0 - 20, _YI + 43, _x0 + _dx + 24, _YA - 51, LINE, 2))
    _p7.append(t(_x0 - 26, _YI + 62, _nm, TX, 15))
_p7 += ang(_WI, _YI, 26, _DN, 360, "115°", HI, 13, 19)
_p7 += ang(_WI + _dx, _YA, 26, 180, _DN, None) + [t(*pol(_WI + _dx, _YA, 46, 212), "あ", TX, 15)]
_p7 += ang(_WI, _YI, 34, 0, _UP, None) + [t(*pol(_WI, _YI, 54, 32), "い", TX, 15)]
_p7 += ang(_EI + _dx, _YA, 26, _UP, 180, None) + [t(*pol(_EI + _dx, _YA, 46, 122), "う", TX, 15)]
_p7 += ang(_EI, _YI, 26, 0, _UP, None) + [t(*pol(_EI, _YI, 46, 32), "え", TX, 15)]
F["HG-4176"] = svg(440, 250, _p7)

# ══ HG-4177 むずかしい3：重なった角の差と1まわりの残り（①〜④） ═════════════
_c8 = []


def _h1(ox, oy):                       # ①130°と60°、あ＝差・い＝1まわりの残り
    vx, vy = ox + 92, oy + 96
    return [ray(vx, vy, 180, 84, LINE, 2), ray(vx, vy, 120, 82, LINE, 2), ray(vx, vy, 50, 82, LINE, 2)] + \
        ang(vx, vy, 62, 50, 180, "130°", HI, 12, 15) + \
        ang(vx, vy, 34, 120, 180, "60°", HI, 12, 16) + \
        [t(*pol(vx, vy, 46, 85), "あ", TX, 15)] + \
        ang(vx, vy, 42, 180, 50, None) + [t(*pol(vx, vy, 58, 295), "い", TX, 15)]


def _h2(ox, oy):                       # ②112°と42°、あ＝差・い＝1まわりの残り
    vx, vy = ox + 92, oy + 96
    return [ray(vx, vy, 132, 84, LINE, 2), ray(vx, vy, 90, 84, LINE, 2), ray(vx, vy, 20, 84, LINE, 2)] + \
        ang(vx, vy, 64, 20, 132, "112°", HI, 12, 15) + \
        ang(vx, vy, 34, 90, 132, "42°", HI, 12, 17) + \
        [t(*pol(vx, vy, 46, 55), "あ", TX, 15)] + \
        ang(vx, vy, 42, 132, 20, None) + [t(*pol(vx, vy, 58, 256), "い", TX, 15)]


def _h3(ox, oy):                       # ③120°と50°、あ＝180−120・い＝360−(60+50)
    vx, vy = ox + 92, oy + 82
    return [ln(*pol(vx, vy, 84, 180), *pol(vx, vy, 84, 0), LINE, 2),
            ray(vx, vy, 120, 82, LINE, 2), ray(vx, vy, 230, 78, LINE, 2)] + \
        ang(vx, vy, 40, 0, 120, "120°", HI, 12, 16) + \
        ang(vx, vy, 26, 180, 230, "50°", HI, 12, 16) + \
        [t(*pol(vx, vy, 42, 150), "あ", TX, 15)] + \
        ang(vx, vy, 58, 230, 120, None) + [t(*pol(vx, vy, 74, 315), "い", TX, 15)]


def _h4(ox, oy):                       # ④110°と120°、あ＝120−70・い＝360−110
    vx, vy = ox + 92, oy + 96
    return [ln(*pol(vx, vy, 84, 180), *pol(vx, vy, 84, 0), LINE, 2),
            ray(vx, vy, 120, 84, LINE, 2), ray(vx, vy, 70, 84, LINE, 2)] + \
        ang(vx, vy, 48, 0, 120, "120°", HI, 12, 18) + \
        ang(vx, vy, 26, 70, 180, "110°", HI, 12, 20) + \
        ang(vx, vy, 66, 70, 120, None) + [t(*pol(vx, vy, 80, 95), "あ", TX, 15)] + \
        ang(vx, vy, 36, 180, 70, None) + [t(*pol(vx, vy, 52, 300), "い", TX, 15)]


for _i, _fn in enumerate((_h1, _h2, _h3, _h4)):
    _c8.extend(_fn(14 + (_i % 2) * 250, 8 + (_i // 2) * 200))
F["HG-4177"] = svg(510, 410, _c8)

# ══ HG-4178 チャレンジ1：ジグザグの折れ線（あ〜う）と三角形（え・お） ═════════
_YA, _YI = 42, 188
_p9 = [ln(20, _YA, 450, _YA, LINE, 2), ln(20, _YI, 450, _YI, LINE, 2),
       t(458, _YA + 5, "ア", TX, 15, "start"), t(458, _YI + 5, "イ", TX, 15, "start")]


def _seg(x, y, deg, dy):
    """(x,y)から向きdegで、たてにdyだけ進んだ先の座標。"""
    a = math.radians(deg)
    return (x + dy * math.cos(a) / abs(math.sin(a)), y + dy)


# 左：52°→あ→42°
_P1 = (100, _YA)
_V1 = _seg(_P1[0], _P1[1], 232, 64)
_Q1 = _seg(_V1[0], _V1[1], -42, _YI - _V1[1])
_E1 = _seg(_Q1[0], _Q1[1], -42, 22)
_p9 += [polyline([_P1, _V1, _Q1, _E1], LINE, 2)]
_p9 += ang(_P1[0], _P1[1], 26, 180, 232, "52°", HI, 12, 16)
_p9 += ang(_Q1[0], _Q1[1], 26, 138, 180, "42°", HI, 12, 16)
_p9 += ang(_V1[0], _V1[1], 24, -42, 52, None) + [t(*pol(_V1[0], _V1[1], 42, 5), "あ", TX, 15)]
# 中：い→113°→39°
_P2 = (252, _YA)
_V2 = _seg(_P2[0], _P2[1], -74, 96)
_Q2 = _seg(_V2[0], _V2[1], 219, _YI - _V2[1])
_E2 = _seg(_Q2[0], _Q2[1], 219, 20)
_p9 += [polyline([_seg(_P2[0], _P2[1], 106, -28), _P2, _V2, _Q2, _E2], LINE, 2)]
_p9 += ang(_P2[0], _P2[1], 26, 106, 180, None) + [t(*pol(_P2[0], _P2[1], 44, 143), "い", TX, 15)]
_p9 += ang(_V2[0], _V2[1], 26, 106, 219, "113°", HI, 12, 18)
_p9 += ang(_Q2[0], _Q2[1], 24, 0, 39, "39°", HI, 12, 15)
# 右：43°→67°→う→124°
_P3 = (356, _YA)
_V3 = _seg(_P3[0], _P3[1], 223, 54)
_V4 = _seg(_V3[0], _V3[1], -24, 30)
_Q3 = _seg(_V4[0], _V4[1], 236, _YI - _V4[1])
_E3 = _seg(_Q3[0], _Q3[1], 236, 24)
_p9 += [polyline([_seg(_P3[0], _P3[1], 43, -26), _P3, _V3, _V4, _Q3, _E3], LINE, 2)]
_p9 += ang(_P3[0], _P3[1], 24, 0, 43, "43°", HI, 12, 15)
_p9 += ang(_V3[0], _V3[1], 24, -24, 43, "67°", HI, 12, 16)
_p9 += ang(_V4[0], _V4[1], 24, 156, 236, None) + [t(*pol(_V4[0], _V4[1], 42, 196), "う", TX, 15)]
_p9 += ang(_Q3[0], _Q3[1], 26, 236, 360, "124°", HI, 12, 18)
# 下の図：え・お
_YA2, _YI2 = 268, 366
_Qv = (120, _YA2)
_S1 = _seg(_Qv[0], _Qv[1], 287, _YI2 - _YA2)
_S1e = _seg(_S1[0], _S1[1], 287, 30)
_S2 = _seg(_Qv[0], _Qv[1], 330, _YI2 - _YA2)
_S2e = _seg(_S2[0], _S2[1], 330, 22)
_p9 += [ln(30, _YA2, 400, _YA2, LINE, 2), ln(30, _YI2, 400, _YI2, LINE, 2),
        t(20, _YA2 + 5, "ア", TX, 15, "end"), t(20, _YI2 + 5, "イ", TX, 15, "end"),
        polyline([_Qv, _S1, _S1e], LINE, 2), polyline([_Qv, _S2, _S2e], LINE, 2)]
_p9 += ang(_Qv[0], _Qv[1], 46, 330, 360, "30°", HI, 12, 15)
_p9 += ang(_Qv[0], _Qv[1], 30, 287, 330, None) + [t(*pol(_Qv[0], _Qv[1], 48, 308), "え", TX, 15)]
_p9 += ang(_S1[0], _S1[1], 26, 180, 287, "107°", HI, 12, 18)
_p9 += ang(_S2[0], _S2[1], 30, 0, 150, None) + [t(*pol(_S2[0], _S2[1], 48, 75), "お", TX, 15)]
F["HG-4178"] = svg(480, 430, _p9)

# ══ HG-4179 チャレンジ2：●●××で180°、あ＝●＋× ═══════════════════════
_vx, _vy = 190, 175
_R = (130, 80, 40)                            # 3本の線の向き
_pa = [ln(40, _vy, 340, _vy, LINE, 2)] + [ray(_vx, _vy, _d, 120, LINE, 2) for _d in _R]
for _a0, _a1, _mk in ((180, _R[0], "●"), (_R[0], _R[1], "●"), (_R[1], _R[2], "✕"), (_R[2], 0, "✕")):
    _mid = _a1 + ((_a0 - _a1) % 360) / 2.0
    _pa.append(t(*[pol(_vx, _vy, 40, _mid)[0], pol(_vx, _vy, 40, _mid)[1] + 5], _mk, HI, 14))
_pa += ang(_vx, _vy, 84, _R[2], _R[0], None)
_pa.append(t(*[pol(_vx, _vy, 104, 100)[0], pol(_vx, _vy, 104, 100)[1] + 5], "あ", TX, 16))
F["HG-4179"] = svg(380, 210, _pa)


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
