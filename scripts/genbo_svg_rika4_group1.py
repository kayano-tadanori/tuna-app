# -*- coding: utf-8 -*-
"""小4理科で「図: あり」なのに図SVGが無かった12本を、PDFの実物を見て原簿に入れる。

★根拠：4年理科 実力_No.1〜No.24.pdf／No.25〜No.42.pdf
  （G:\\マイドライブ\\浜問題\\4年理科\\）を150〜350dpiで出して目視。
  原簿に図は入っていないのでここが唯一の根拠（feedback_zu_wa_genbo_ni_nai）。

実物で確かめた大問対応：
  HG-0787 実力No.23 p66大問5（電池2個+スイッチABCの回路）
  HG-1841 No.25 p1大問1(3)(4)（検流計のダイヤル）
  HG-1826 No.32 p27大問5（傾けた鉄棒A,B／傾けた試験管C,D）
  HG-1827 No.32 p28大問6（等間かくの印のついた銅棒A〜H）
  HG-1823 No.33 p30大問2（氷を熱し続けたグラフ）
  HG-1830 No.35 p38大問3（丸底フラスコのふん水実験）
  HG-1831 No.35 p38大問4（試験管の水の膨張）
  HG-1832 No.35 p39大問5（十字＋T字の注射器装置）
  HG-1833 No.35 p39大問6（丸底フラスコ＋色水の管）
  HG-0796 実力No.39 p52大問5（棒におもりA,B,Cをつるす）
  HG-1836 No.42 p61大問5（4つのビーカーA〜Dと固体X）
  HG-1837 No.42 p61大問6（メスシリンダーととけ残った固体P）

使い方: python scripts/genbo_svg_rika4_group1.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'


def r1(v):
    return round(float(v), 1)


def svg(vb, body):
    return '<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (vb, S, body)


def t(x, y, s, fill=TX, size=13, anchor="middle", extra=""):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s"%s>%s</text>' % (
        r1(x), r1(y), size, anchor, fill, extra, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None, extra=""):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s%s/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), stroke, w, d, extra)


def rect(x, y, w, h, stroke=LINE, sw=2, fill="none"):
    return '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(x), r1(y), r1(w), r1(h), fill, stroke, sw)


def circ(cx, cy, r, stroke=LINE, w=2, fill="none"):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(cx), r1(cy), r1(r), fill, stroke, w)


def dot(cx, cy, r=3.2, fill=TX):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r1(cx), r1(cy), r1(r), fill)


def pts(seq):
    return " ".join("%s,%s" % (r1(a), r1(b)) for a, b in seq)


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (pts(seq), fill, stroke, w, d)


def pline(seq, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polyline points="%s" fill="none" stroke="%s" stroke-width="%s"%s/>' % (pts(seq), stroke, w, d)


def path(d, stroke=LINE, w=2, fill="none", extra=""):
    return '<path d="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (d, fill, stroke, w, extra)


def dim(x1, y1, x2, y2, label, off=12, side=1, size=12, col=TX):
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = -nx / off * 4, -ny / off * 4
    return "".join([
        ln(ax, ay, bx, by, GRAY, 1.2),
        ln(ax - tx, ay - ty, ax + tx, ay + ty, GRAY, 1.2),
        ln(bx - tx, by - ty, bx + tx, by + ty, GRAY, 1.2),
        t((ax + bx) / 2 + nx / off * 11, (ay + by) / 2 + ny / off * 11 + 4, label, col, size),
    ])


def dial(cx, cy, r, needle_val, label, color=TX):
    # 検流計の左右対称ダイヤル「5 4 3 2 1 0 1 2 3 4 5」
    out = [path("M%.1f,%.1f A%d %d 0 0 1 %.1f,%.1f" % (cx - r, cy, r, r, cx + r, cy), LINE, 2)]
    for i in range(11):
        val = abs(i - 5)
        ang = math.radians(180 - i * 18)
        lx = cx + (r + 14) * math.cos(ang)
        ly = cy - (r + 14) * math.sin(ang) + 4
        out.append(t(lx, ly, str(val), color, 11))
    a = math.radians(180 - (5 - needle_val) * 18) if needle_val <= 5 else math.radians(180 - (5 + (10 - needle_val)) * 18)
    out.append(ln(cx, cy, cx + r * 0.75 * math.cos(a), cy - r * 0.75 * math.sin(a), HI, 2.2))
    out.append(dot(cx, cy, 2.6, TX))
    out.append(t(cx, cy + 22, label, TX, 12))
    return out


FIGS = {}

# ══ 実力No.23 大問5（HG-0787）電池2個＋スイッチA〜Cの回路 ═══════════════
# 左枝: 上レール-A(スイッチ)-X(節点)-電池1-下レール／右枝: 上レール-電池2-Y(節点)-C(スイッチ)-下レール
# 橋渡し: X-B(スイッチ)-Y（斜め）／さらに右に独立した豆電球の枝
_top, _bot = 30, 170
_xL, _xM, _xR = 70, 190, 300
_yA, _yX = 70, 100   # 左枝：Aスイッチの位置／X節点の位置
_yB2, _yY = 70, 100  # 右枝：電池2の位置／Y節点の位置
_b787 = [
    ln(_xL, _top, _xR, _top, LINE, 2.2),          # 上レール
    ln(_xL, _bot, _xR, _bot, LINE, 2.2),           # 下レール
    ln(_xL, _top, _xL, _yA - 10, LINE, 2),
    ln(_xL, _yA + 10, _xL, _yX, LINE, 2),          # Aスイッチ〜X
    path("M%.1f,%.1f L%.1f,%.1f" % (_xL - 9, _yA - 10, _xL + 9, _yA + 10), GRAY, 1.8),  # Aスイッチ(開)記号
    t(_xL - 20, _yA + 4, "A", TX, 13),
    ln(_xL, _yX, _xL, _yX + 26, LINE, 2), dot(_xL, _yX, 3),
    ln(_xL - 12, _yX + 26, _xL + 12, _yX + 26, LINE, 2.4),   # 電池1（短線）
    ln(_xL - 20, _yX + 34, _xL + 20, _yX + 34, LINE, 1.4),   # 電池1（長線）
    ln(_xL, _yX + 34, _xL, _bot, LINE, 2),
    ln(_xM, _top, _xM, _yB2 - 12, LINE, 2),
    ln(_xM - 12, _yB2 - 4, _xM + 12, _yB2 - 4, LINE, 1.4),   # 電池2（長線）
    ln(_xM - 8, _yB2 + 4, _xM + 8, _yB2 + 4, LINE, 2.4),     # 電池2（短線）
    ln(_xM, _yB2 + 4, _xM, _yY, LINE, 2), dot(_xM, _yY, 3),
    ln(_xM, _yY, _xM, _yY + 20, LINE, 2),
    path("M%.1f,%.1f L%.1f,%.1f" % (_xM - 9, _yY + 20, _xM + 9, _yY + 40), GRAY, 1.8),  # Cスイッチ(開)
    t(_xM + 22, _yY + 34, "C", TX, 13),
    ln(_xM, _yY + 40, _xM, _bot, LINE, 2),
    path("M%.1f,%.1f L%.1f,%.1f" % (_xL, _yX, (_xL + _xM) / 2, _yX - 22), GRAY, 1.8),
    path("M%.1f,%.1f L%.1f,%.1f" % ((_xL + _xM) / 2, _yX - 22, _xM, _yY), GRAY, 1.8),  # Bスイッチ(開・斜め)
    t((_xL + _xM) / 2, _yX - 30, "B", TX, 13),
    ln(_xR, _top, _xR, _bot - 40, LINE, 2),
    circ(_xR, _bot - 20, 14, LINE, 2), t(_xR, _bot - 16, "×", HI, 14),
    ln(_xR, _bot - 6, _xR, _bot, LINE, 2),
    t(_xR + 26, _bot - 20, "豆電球", GRAY, 11, "start"),
]
FIGS["HG-0787"] = svg("0 0 400 210", "".join(_b787 + [
    t(200, 200, "豆電球1個・かん電池2個・スイッチA〜C（A・B・Cは開いたまま）", GRAY, 11),
]))

# ══ No.25 大問1(3)(4)（HG-1841）検流計のダイヤル ═══════════════════════
_b1841 = dial(90, 90, 60, 3, "(3) 0.5A端子", GRAY)
FIGS["HG-1841"] = svg("0 0 200 130", "".join(_b1841 + [
]))

# ══ No.32 大問5（HG-1826）[図1]傾けた鉄棒A,B／[図2]傾けた試験管C,D ═══════
def rod_match(x0, y0, ang_deg, length, match_at, lab):
    a = math.radians(ang_deg)
    x1, y1 = x0 + length * math.cos(a), y0 - length * math.sin(a)
    out = [ln(x0, y0, x1, y1, LINE, 3)]
    mx, my = x0 + length * match_at * math.cos(a), y0 - length * match_at * math.sin(a)
    out.append(dot(mx, my, 4, HI))
    out.append(rect(x0 - 14, y0 - 6, 24, 20, GRAY, 1.6))  # クランプ
    out.append(t((x0 + x1) / 2 - 14, (y0 + y1) / 2, lab, TX, 13))
    return out


_b1826a = rod_match(50, 130, 55, 110, 0.92, "A") + rod_match(220, 60, -35, 110, 0.15, "B")
_b1826a += [
    t(20, 20, "[図1] Aは上側のはし・Bは下側のはしにマッチのじく（●）", GRAY, 11, "start"),
    t(20, 165, "それぞれの中央をアルコールランプで同時に加熱", GRAY, 11, "start"),
]
FIGS["HG-1826a"] = svg("0 0 340 175", "".join(_b1826a))


def tube_c(x0, y0, ang_deg, lamp_at, lab):
    a = math.radians(ang_deg)
    length = 150
    x1, y1 = x0 + length * math.cos(a), y0 - length * math.sin(a)
    out = [rect(x0 - 16, y0 + 4, 32, 20, GRAY, 1.6), t(x0, y0 + 16, "" , TX, 1)]
    out.append(pline([(x0, y0), (x1, y1)], LINE, 3))
    out.append(t((x0 + x1) / 2 + (18 if ang_deg > 0 else -18), (y0 + y1) / 2 - 4, "冷たい水／示温テープ", GRAY, 10))
    lx, ly = x0 + length * lamp_at * math.cos(a), y0 - length * lamp_at * math.sin(a)
    out.append(poly([(lx - 10, ly + 14), (lx + 10, ly + 14), (lx + 4, ly), (lx - 4, ly)], GRAY, 1.6))
    out.append(t(lx, ly + 30, lab, TX, 13))
    return out


_b1826b = tube_c(40, 150, 25, 0.06, "C（底を加熱）") + tube_c(230, 150, 25, 0.30, "D（水面近くを加熱）")
FIGS["HG-1826b"] = svg("0 0 380 190", "".join(_b1826b + [
    t(190, 20, "[図2] 冷たい水と示温テープを入れた試験管C・Dを同時に加熱", GRAY, 11),
]))

# ══ No.32 大問6（HG-1827）等間かくの印のついた銅棒A〜H（アルコールランプ加熱） ══
_marks827 = {"A": 0, "B": 4, "C": 7, "D": 10, "E": 13, "F": 16, "G": 20, "H": 24}
_scale827 = 12
_x0827 = 40
_b1827 = [ln(_x0827, 90, _x0827 + 24 * _scale827, 90, LINE, 3)]
_b1827 += [ln(_x0827 + i * _scale827, 86, _x0827 + i * _scale827, 94, GRAY, 1) for i in range(25)]
for lab, pos in _marks827.items():
    x = _x0827 + pos * _scale827
    _b1827 += [ln(x, 84, x, 96, GRAY, 1.4), dot(x, 84, 2.6, HI), t(x, 74, lab, TX, 12)]
_b1827 += [
    poly([(_x0827 + 2 * _scale827 - 8, 96), (_x0827 + 2 * _scale827 + 8, 96), (_x0827 + 2 * _scale827, 108)], GRAY, 1.6),
    poly([(_x0827 + 22 * _scale827 - 8, 96), (_x0827 + 22 * _scale827 + 8, 96), (_x0827 + 22 * _scale827, 108)], GRAY, 1.6),
    t(_x0827 + 2 * _scale827, 122, "支点", GRAY, 10), t(_x0827 + 22 * _scale827, 122, "支点", GRAY, 10),
]
_flame_x = _x0827 + 14 * _scale827
_b1827 += [
    poly([(_flame_x - 9, 60), (_flame_x + 9, 60), (_flame_x + 3, 46), (_flame_x - 3, 46)], GRAY, 1.6),
    ln(_flame_x, 60, _flame_x, 84, GRAY, 1.4),
    t(_flame_x, 36, "アルコールランプ", GRAY, 11),
]
FIGS["HG-1827"] = svg("0 0 340 135", "".join(_b1827))

# ══ No.33 大問2（HG-1823）氷を熱し続けたときの温度グラフ ══════════════════
GX823, GY823, GW823, GH823 = 60, 30, 260, 130
_y0 = GY823 + GH823  # 0℃ライン
_yBottom = GY823 + GH823 + 22  # -20℃相当
_tx = lambda m: GX823 + m / 152 * GW823
_b1823 = [
    ln(GX823, GY823, GX823, GY823 + GH823 + 30, GRAY, 1.4),   # 縦軸
    ln(GX823, GY823 + GH823 + 30, GX823 + GW823 + 20, GY823 + GH823 + 30, GRAY, 1.4),  # 横軸
    t(GX823 - 10, GY823 + GH823 + 4, "0", TX, 11, "end"),
    t(GX823 - 14, _yBottom + 4, "-20", TX, 11, "end"),
    ln(GX823 - 4, _y0, GX823 + 4, _y0, GRAY, 1.2),
]
_pline823 = [(_tx(0), _yBottom), (_tx(8), _y0), (_tx(72), _y0), (_tx(152), GY823 + 6)]
_b1823 += [pline(_pline823, HI, 2.4)]
_b1823 += [ln(_tx(152), GY823 + 6, GX823 + GW823 + 20, GY823 + 6, HI, 2.4, "4,3")]
for m in (8, 72, 152):
    _b1823 += [ln(_tx(m), GY823 + GH823 + 26, _tx(m), GY823 + GH823 + 34, GRAY, 1.2),
                t(_tx(m), GY823 + GH823 + 48, str(m), TX, 11)]
_b1823 += [dot(_tx(8), _y0, 3.5, TX), t(_tx(8) - 14, _y0 - 10, "B", TX, 13)]
_b1823 += [dot(_tx(152), GY823 + 6, 3.5, TX), t(_tx(152) + 4, GY823 - 6, "A", TX, 13)]
_b1823 += [t(GX823 - 40, GY823 - 6, "温度(℃)", GRAY, 11, "start"), t(GX823 + GW823, GY823 + GH823 + 70, "加熱しはじめてからの時間(分)", GRAY, 11, "end")]
FIGS["HG-1823"] = svg("0 0 360 250", "".join(_b1823 + [
    t(180, 240, "−20℃の氷400gを一定の割合で加熱（A・Bは目もりの数値を答える設問）", GRAY, 10),
]))

# ══ No.35 大問3（HG-1830）丸底フラスコのふん水実験 ══════════════════════
_fx, _fy, _fr = 130, 100, 46
_b1830 = [
    circ(_fx, _fy, _fr, LINE, 2),
    ln(_fx - _fr, _fy, _fx + _fr, _fy, LINE, 1.2, "3,3"),
    t(_fx, _fy + 20, "水", GRAY, 12), t(_fx, _fy - 20, "空気", GRAY, 12),
    ln(_fx - 8, _fy - _fr, _fx - 8, _fy - _fr - 26, LINE, 2.4),  # ゴムせん+ガラス管(上)
    rect(_fx - 12, _fy - _fr - 10, 8, 12, GRAY, 1.4),  # ゴムせん
    pline([(_fx - 8, _fy - _fr - 26), (_fx - 8, _fy - 10), (_fx + 6, _fy - 10), (_fx + 6, _fy + _fr - 14)], HI, 2),
    t(_fx - 8, _fy - _fr - 34, "ガラス管", GRAY, 11),
    rect(_fx - 70, _fy + _fr - 6, 140, 46, GRAY, 1.6),
    t(_fx, _fy + _fr + 24, "80℃の湯", GRAY, 12),
]
FIGS["HG-1830"] = svg("0 0 260 220", "".join(_b1830))

# ══ No.35 大問4(4)（HG-1831）試験管に50℃の湯・ガラス管の水面 ═══════════
_tx0, _ty0 = 130, 170
_b1831 = [
    path("M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f A20 20 0 0 0 %.1f,%.1f L%.1f,%.1f Z" % (
        _tx0 - 24, 50, _tx0 - 24, _ty0 - 20, _tx0 - 24, _ty0 - 20, _tx0 + 24, _ty0 - 20, _tx0 + 24, 50
    ), LINE, 2),
    ln(_tx0 - 24, 60, _tx0 + 24, 60, GRAY, 1.2, "3,3"),
    t(_tx0, 110, "50℃の湯", GRAY, 12),
    rect(_tx0 - 30, 40, 60, 14, GRAY, 1.6), t(_tx0, 32, "ゴムせん", GRAY, 10),
    ln(_tx0, 40, _tx0, 8, HI, 2.4),
    ln(_tx0 - 6, 80, _tx0 + 6, 80, TX, 1.6),
    t(_tx0 + 40, 12, "ガラス管", GRAY, 11, "start"),
]
FIGS["HG-1831"] = svg("0 0 260 200", "".join(_b1831))

# ══ No.35 大問5（HG-1832）十字[図1]／T字[図2]の注射器装置 ═══════════════
def syringe(cx, cy, ang_deg, length, val, lab):
    a = math.radians(ang_deg)
    dx, dy = math.cos(a), math.sin(a)
    x1, y1 = cx + length * dx, cy + length * dy
    out = [ln(cx, cy, x1, y1, LINE, 3)]
    for i in range(1, 7):
        px, py = cx + length * (i / 6) * dx, cy + length * (i / 6) * dy
        out.append(ln(px - 4 * dy, py + 4 * dx, px + 4 * dy, py - 4 * dx, GRAY, 1))
    out.append(rect(x1 - 6 * dy - 4 * dx, y1 + 6 * dx - 4 * dy, 8, 8, LINE, 1.6))
    pv = cx + length * (val / 6) * dx, cy + length * (val / 6) * dy
    out.append(dot(pv[0], pv[1], 4, HI))
    out.append(t(cx + (length + 26) * dx, cy + (length + 26) * dy + 4, lab, TX, 13))
    return out


_cx1, _cy1, _L1 = 110, 118, 60
_b1832a = syringe(_cx1, _cy1, 0, _L1, 2, "A")      # 右
_b1832a += syringe(_cx1, _cy1, 180, _L1, 2, "D")   # 左
_b1832a += syringe(_cx1, _cy1, -90, _L1, 2, "B")   # 上
_b1832a += syringe(_cx1, _cy1, 90, _L1, 5, "C")    # 下
_b1832a += [dot(_cx1, _cy1, 3, TX)]
_b1832a += [t(_cx1 - _L1 - 30, _cy1 + 20, "おしこむ→", HI, 11, "start")]
_b1832a += [t(_cx1, _cy1 + _L1 + 46, "[図1]十字（はじめ A=2,B=2,C=2,D=5）", GRAY, 11)]
FIGS["HG-1832a"] = svg("0 0 260 260", "".join(_b1832a))

_cx2, _cy2, _L2 = 110, 118, 60
_b1832b = syringe(_cx2, _cy2, 0, _L2, 5, "G")     # 右
_b1832b += syringe(_cx2, _cy2, -90, _L2, 5, "E")  # 上
_b1832b += syringe(_cx2, _cy2, 90, _L2, 1, "F")   # 下
_b1832b += [dot(_cx2, _cy2, 3, TX)]
_b1832b += [t(_cx2 + _L2 + 10, _cy2 - 20, "←引く", HI, 11, "start")]
_b1832b += [t(_cx2, _cy2 + _L2 + 46, "[図2]T字（はじめ E=5,F=5,G=1）", GRAY, 11)]
FIGS["HG-1832b"] = svg("0 0 260 260", "".join(_b1832b))

# ══ No.35 大問6（HG-1833）丸底フラスコ＋色水入りガラス管 ═══════════════════
_fx3, _fy3, _fr3 = 100, 130, 44
_b1833 = [
    circ(_fx3, _fy3, _fr3, LINE, 2),
    rect(_fx3 - 12, _fy3 - _fr3 - 10, 8, 12, GRAY, 1.4),
    pline([(_fx3 - 8, _fy3 - _fr3 - 10), (_fx3 - 8, 40), (_fx3 + 100, 40)], LINE, 2.2),
    ln(_fx3 + 30, 40, _fx3 + 50, 40, HI, 4),
    t(_fx3 + 40, 30, "色水", GRAY, 11),
    t(_fx3 - 20, 22, "A", TX, 12), t(_fx3 + 96, 22, "B", TX, 12),
]
FIGS["HG-1833"] = svg("0 0 260 180", "".join(_b1833))

# ══ 実力No.39 大問5（HG-0796）棒におもりA,B,Cをつるす（支点は壁） ══════════════
_barY = 90
_xF = 190  # 支点(壁固定)
_xA = _xF + 90   # A: 支点から右40cm
_xB = _xF - 55   # B: 支点から左25cm
_xC = _xF - 130  # C: 支点から左60cm
_b796 = [
    ln(_xC - 10, _barY, _xA + 10, _barY, LINE, 3),
    poly([(_xF - 10, _barY), (_xF + 10, _barY), (_xF, _barY + 16)], LINE, 2),
    rect(_xF + 6, _barY + 16, 22, 34, GRAY, 1.6),
    t(_xF + 17, _barY + 60, "天井", GRAY, 10),
    dim(_xF, _barY, _xA, _barY, "40cm", 16, -1),
    dim(_xB, _barY, _xF, _barY, "25cm", 16, 1),
    dim(_xC, _barY, _xF, _barY, "60cm", 34, 1),
    ln(_xA, _barY, _xA, _barY + 20), t(_xA, _barY + 38, "おもりA", TX, 12), t(_xA, _barY + 54, "75g", TX, 12),
    ln(_xB, _barY, _xB, _barY + 20), t(_xB, _barY + 64, "おもりB", TX, 12), t(_xB, _barY + 80, "40g", TX, 12),
    ln(_xC, _barY, _xC, _barY + 20), t(_xC, _barY + 64, "おもりC", TX, 12), t(_xC, _barY + 80, "?g", HI, 12),
]
FIGS["HG-0796"] = svg("0 0 360 185", "".join(_b796))

# ══ No.42 大問5(2)（HG-1836）4つのビーカーA〜Dと固体X ══════════════════════
def beaker(x0, y, water, solid, lab):
    out = [
        pline([(x0, y), (x0, y + 60), (x0 + 50, y + 60), (x0 + 50, y)], LINE, 2),
        t(x0 + 25, y + 40, "水%dg" % water, GRAY, 11),
        t(x0 + 25, y - 34, "固体X%dg" % solid, HI, 11),
        path("M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Z" % (x0 + 25, y - 6, x0 + 19, y - 16, x0 + 31, y - 16), HI, 1.6),
        t(x0 + 25, y + 78, lab, TX, 13),
    ]
    return out


_b1836 = []
for i, (w, s, lab) in enumerate([(100, 36, "A"), (200, 48, "B"), (300, 60, "C"), (400, 72, "D")]):
    _b1836 += beaker(20 + i * 80, 48, w, s, lab)
FIGS["HG-1836"] = svg("0 0 360 150", "".join(_b1836))

# ══ No.42 大問6（HG-1837）メスシリンダーととけ残った固体P ══════════════════
_cx6, _cyTop, _w6, _h6 = 130, 30, 46, 140
_b1837 = [
    pline([(_cx6 - _w6 / 2, _cyTop), (_cx6 - _w6 / 2, _cyTop + _h6), (_cx6 + _w6 / 2, _cyTop + _h6), (_cx6 + _w6 / 2, _cyTop)], LINE, 2),
    ln(_cx6 - _w6 / 2, _cyTop + 40, _cx6 + _w6 / 2, _cyTop + 40, HI, 2.2),
    t(_cx6 + _w6 / 2 + 12, _cyTop + 40, "液面", GRAY, 11, "start"),
    circ(_cx6 - 8, _cyTop + _h6 - 14, 6, LINE, 1.4), circ(_cx6 + 6, _cyTop + _h6 - 10, 5, LINE, 1.4),
    circ(_cx6 + 12, _cyTop + _h6 - 20, 4, LINE, 1.4),
    t(_cx6 + _w6 / 2 + 12, _cyTop + _h6 - 14, "とけ残った固体P", GRAY, 11, "start"),
]
FIGS["HG-1837"] = svg("0 0 260 190", "".join(_b1837))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    bad = []
    for hg, fig in FIGS.items():
        vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', fig)
        w, h = float(vb.group(1)), float(vb.group(2))
        if h / w > 0.85:
            bad.append("%s: viewBoxが縦長すぎ (%.2f)" % (hg, h / w))
        for tag in re.findall(r"<text[^>]*>", fig):
            if "fill=" not in tag:
                bad.append("%s: fillの無い<text>" % hg)
                break
        for c in ("#333", "#888", "#666", "#000", "#111", "#222", "#1a2340"):
            if ('fill="%s"' % c) in fig or ('stroke="%s"' % c) in fig:
                bad.append("%s: 暗すぎる色 %s" % (hg, c))
    if bad:
        for b in bad:
            print("⚠", b)
    else:
        print("✅ 自己点検OK（横長・文字色・max-width）")

    # HG-1826/1832 は1レコードに2枚の図（[図1][図2]）があるので、原簿には並べて1本にまとめる
    MERGE = {
        "HG-1826": ("HG-1826a", "HG-1826b"),
        "HG-1832": ("HG-1832a", "HG-1832b"),
    }
    WRITE_FIGS = dict(FIGS)
    for hg, (a, b) in MERGE.items():
        fa, fb = WRITE_FIGS.pop(a), WRITE_FIGS.pop(b)
        WRITE_FIGS[hg] = ('<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;'
                          'max-width:100%%">%s%s</div>') % (fa, fb)

    p = find_genbo()
    s = io.open(p, encoding="utf-8").read()
    n = 0
    for hg, fig in WRITE_FIGS.items():
        pat = re.compile(r"(### 【%s】.*?\n(?:.*?\n)*?- 図: [^\n]*\n)(- 図SVG: [^\n]*\n)?" % hg)
        m = pat.search(s)
        if not m:
            print("見つからない:", hg)
            continue
        s = s[:m.end(1)] + "- 図SVG: `%s`\n" % fig + s[m.end():]
        n += 1
    print("原簿に図SVGを入れた:", n, "/", len(WRITE_FIGS))
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("✅ 原簿に書き込み完了")


if __name__ == "__main__":
    main()
