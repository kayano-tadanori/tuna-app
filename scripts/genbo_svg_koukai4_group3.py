# -*- coding: utf-8 -*-
"""学年4の残り理科のうち、2021年度4年公開学力テスト理科の11本
   （第575〜585回・HG-2812〜2822）を、PDFの実物を見て原簿に入れる。

★根拠：G:\\マイドライブ\\浜問題\\公開学力テスト\\2021年度 4年 公開テスト理科.pdf
  （36ページ）を130〜150dpiで出して目視。ページ→回の対応は原簿の
  「# 🧪 2021年度 4年 公開理科」セクションに既にある表を使った
  （575回=p1-3,576=p4-6,577=p7-9,578=p10-12,579=p13-15,580=p16-19,
  581=p20-22,582=p23-26,583=p27-30,584=p31-33,585=p34-36）。

実物で確かめたページ対応：
  HG-2812 … p3。台ばかり[図1]ねん土単体／[図2]A(丸めた形)・B(分けた形)の2台
  HG-2813 … p6。[図1]欠けた磁石+物体あ／[図2]鉄くぎ3本(N極の下、A・B)／
            [図3]ぬいばり(N極でこする、矢印)／[図4]棒磁石+方位じしん1〜4
  HG-2814 … p9。そうちP。板の四すみA(左上)B(右上)C(左下)D(右下)、中央に
            かん電池(+上/−下)。＋−A、−−Dへどう線
  HG-2815 … p12。[図1]太陽の1日の動き(地平線+弧+A/B/C)／[図2]真上から見た
            十字(D上・E左)+3本の太いかげ(あ・い・う、すべて左向き)
  HG-2816 … p15。ゴムひもP・Qの[図1][図2]+[表1][表2]（あ・いが空欄）
  HG-2817 … p19。とつレンズ→F点の光線図、A〜Cの3位置に破線
  HG-2818 … p22。[図1]ぬいばり(S極でこする、A-B)／[図2]棒P(あ/い)・Q(う/え)・
            R(お/か)の3本
  HG-2819 … p26。バス線。A(左はし直結)+B(電池,上)／C・D(2電池,下に分岐)／
            E(直結,上)／F(電池,下)／G(右はし,バス上に電池)
  HG-2820 … p30。[図1]3枚の長方形が重なりあ〜きの7領域／[図2]レンズ→しょう点
            +両わきのしゃ線「かげ」／[図3]ドーナツ状の明るい円+かげ+表
  HG-2821 … p33。[図1]手描きの汚い配線（きれいに整理して描く）：A-電池-B／
            A-電池(縦)-C／D孤立／E-電池(斜め)-F／E-電池(宙ぶらりん)
  HG-2822 … p36。[図1]水平な棒A-C-B／[図2]ななめの棒A(下)-C-B(上)／
            [図3]折れ曲がった棒A-C-B／[図4]板（背骨B・腕A/C/×）

使い方: python scripts/genbo_svg_koukai4_group3.py [--write]
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


def dot(cx, cy, r=4, fill=TX):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r1(cx), r1(cy), r1(r), fill)


def pts(seq):
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), fill, stroke, w, d)


def pline(seq, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polyline points="%s" fill="none" stroke="%s" stroke-width="%s"%s/>' % (pts(seq), stroke, w, d)


def defs_arrow(mid, color=HI):
    return ('<defs><marker id="%s" markerWidth="8" markerHeight="8" refX="6.5" refY="4"'
            ' orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % (mid, color))


def battery(cx, cy, w=26, h=16, vertical=False, label=None):
    if vertical:
        out = [rect(cx - h / 2, cy - w / 2, h, w, LINE, 1.8)]
    else:
        out = [rect(cx - w / 2, cy - h / 2, w, h, LINE, 1.8)]
    if label:
        out.append(t(cx, cy + (w / 2 + 14 if vertical else h / 2 + 16), label, GRAY, 10))
    return out


def battery2(x1, y1, x2, y2, plus_end=2, body=22, thick=14, bump=6):
    """(x1,y1)-(x2,y2) の間に、＋側にでっぱりのある電池を置く（plus_end=1なら1側が＋）。
    本人指摘：でっぱりが無いと＋−がどちらか分からない／配線が電池を貫通してはいけない。"""
    L = math.hypot(x2 - x1, y2 - y1) or 1
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    ang = math.degrees(math.atan2(y2 - y1, x2 - x1))
    out = [ln(x1, y1, mx - ux * body / 2, my - uy * body / 2, LINE, 1.8),
           ln(mx + ux * body / 2, my + uy * body / 2, x2, y2, LINE, 1.8)]
    bump_x = -body / 2 - bump if plus_end == 1 else body / 2
    out.append('<g transform="translate(%s,%s) rotate(%s)">%s%s</g>' % (
        r1(mx), r1(my), r1(ang),
        rect(-body / 2, -thick / 2, body, thick, LINE, 1.8),
        rect(bump_x, -thick * 0.3, bump, thick * 0.6, LINE, 1.8, LINE)))
    return out


def magnet(x, y, w, h, n_left=True):
    half = w / 2
    nx, sx = (x, x + half) if n_left else (x + half, x)
    out = [rect(x, y, half, h, LINE, 1.8, "#2a3560"), rect(x + half, y, half, h, LINE, 1.8, "none")]
    out.append(t(nx + half / 2, y + h / 2 + 5, "N", HI, 13))
    out.append(t(sx + half / 2, y + h / 2 + 5, "S", TX, 13))
    return out


def scale(cx, cy, needle_deg, label, obj_label=None):
    """台ばかり：台+丸いダイヤル+はり"""
    R = 22
    out = [poly([(cx - 26, cy + 24), (cx + 26, cy + 24), (cx + 18, cy - 6), (cx - 18, cy - 6)], LINE, 1.6)]
    out.append(circ(cx, cy - 6, R, LINE, 1.6))
    a = math.radians(90 - needle_deg)
    out.append(ln(cx, cy - 6, cx + R * 0.7 * math.cos(a), cy - 6 - R * 0.7 * math.sin(a), HI, 2))
    out.append(dot(cx, cy - 6, 2, TX))
    out.append(ln(cx - 14, cy - 30, cx + 14, cy - 30, LINE, 1.6))
    if obj_label:
        out.append(t(cx, cy - 36, obj_label, TX, 11))
    out.append(t(cx, cy + 40, label, GRAY, 11))
    return out


FIGS = {}

# ══ 第575回 大問3（HG-2812）台ばかり：ねん土／A(丸)・B(分ける) ═════════════
_b12 = scale(70, 70, -15, "[図1]ねん土(200g)", "ねん土")
_b12 += scale(230, 70, -15, "[図2]A：丸い形", "A")
_b12 += scale(340, 70, -15, "[図2]B：細かく分ける", "B")
FIGS["HG-2812"] = svg("0 0 420 150", "".join(_b12 + [
    t(210, 142, "ねん土を丸めても・分けても、台ばかりの目もりは変わらない", GRAY, 11),
]))

# ══ 第576回 大問3（HG-2813）欠けた磁石／鉄くぎ3本／ぬいばり／方位じしん4個 ═══
_b13 = []
_b13 += magnet(20, 20, 90, 22, n_left=True)
_b13 += [ln(65, 42, 65, 55, GRAY, 1.2, "3 2"), poly([(65, 55), (105, 55), (110, 68), (60, 68)], LINE, 1.6),
         t(60, 78, "あ", HI, 11, "end"), t(112, 78, "い", HI, 11, "start"), t(65, 8, "[図1]", GRAY, 10)]
_b13 += magnet(160, 20, 70, 18, n_left=True)
_b13 += [t(160, 8, "[図2]", GRAY, 10), t(160, 46, "N", TX, 11)]
for i in range(3):
    y0 = 42 + i * 16
    _b13 += [poly([(160, y0), (166, y0 + 14), (154, y0 + 14)], LINE, 1.4)]
_b13 += [t(178, 58, "A", TX, 11, "start"), t(178, 90, "B", TX, 11, "start")]
_b13 += magnet(265, 20, 70, 18, n_left=True)
_b13 += [t(265, 8, "[図3]N極でこする", GRAY, 10)]
_b13 += [ln(240, 60, 340, 60, TX, 1.8), t(236, 64, "P", TX, 11, "end"), t(344, 64, "Q", TX, 11, "start")]
_b13.append(defs_arrow("ar13", HI))
_b13.append('<path d="M330,50 L250,50" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar13)"/>' % HI)
_b13 += magnet(35, 150, 90, 22, n_left=False)
_b13 += [circ(80, 130, 13, LINE, 1.4), t(80, 112, "1", TX, 10)]
_b13 += [circ(15, 175, 13, LINE, 1.4), t(1, 179, "2", TX, 10, "end")]
_b13 += [circ(145, 175, 13, LINE, 1.4), t(159, 179, "3", TX, 10, "start")]
_b13 += [circ(80, 220, 13, LINE, 1.4), t(80, 242, "4", TX, 10)]
_b13 += [t(80, 100, "[図4]", GRAY, 10)]
FIGS["HG-2813"] = svg("0 0 400 250", "".join(_b13 + [
    t(200, 244, "欠けた磁石／鉄くぎ3本／N極でこするぬいばり／方位じしん1〜4", GRAY, 11),
]))

# ══ 第577回 大問4(2)（HG-2814）そうちP：4すみA・B・C・D＋中央にかん電池 ═══
_b14 = [rect(30, 20, 220, 180, LINE, 1.6)]
_b14 += battery2(60, 50, 210, 170, plus_end=1)  # かん電池の＋極とA、−極とD
for lab, (x, y) in {"A": (60, 50), "B": (210, 50), "C": (60, 170), "D": (210, 170)}.items():
    _b14 += [dot(x, y), t(x, y - 10 if y < 100 else y + 20, lab, HI, 14)]
FIGS["HG-2814"] = svg("0 0 340 220", "".join(_b14 + [
    t(170, 212, "そうちP：かん電池の＋極とA、−極とDをどう線でつなぐ", GRAY, 11),
]))

# ══ 第578回 大問4（HG-2815）太陽の1日の動き＋真上から見たかげ ═══════════
_b15 = []
_pts15 = []
for i in range(9):
    frac = i / 8
    ang = math.pi * frac
    x = 60 + 160 * frac
    y = 100 - 70 * math.sin(ang)
    _pts15.append((x, y))
_b15 += [pline(_pts15, GRAY, 1.4, "3 2")]
for x, y in _pts15:
    _b15.append(circ(x, y, 4, LINE, 1.4))
_b15 += [ln(40, 100, 260, 100, LINE, 2), t(60, 118, "A", TX, 12), t(140, 118, "B", TX, 12), t(220, 118, "C", TX, 12),
          t(150, 30, "太陽が動く道すじ", GRAY, 10)]
_b15.append(t(150, 190, "[図1]太陽の1日の動き", GRAY, 11))
EX15, EY15 = 350, 100
_b15 += [ln(EX15, EY15 - 50, EX15, EY15 + 50, LINE, 1.4), ln(EX15 - 50, EY15, EX15 + 50, EY15, LINE, 1.4)]
_b15 += [t(EX15, EY15 - 60, "D", TX, 12), t(EX15 - 65, EY15 + 4, "E", TX, 12, "end"),
          t(EX15 + 10, EY15 + 4, "ぼう", TX, 10, "start")]
for ang_deg in (150, 180, 210):
    a = math.radians(ang_deg)
    _b15.append(ln(EX15, EY15, EX15 + 55 * math.cos(a), EY15 + 55 * math.sin(a) * -1, HI, 2.4))
_b15 += [t(EX15 - 50, EY15 - 30, "あ", HI, 11), t(EX15 - 58, EY15 + 4, "", HI, 11), t(EX15 - 50, EY15 + 32, "う", HI, 11)]
_b15.append(t(350, 190, "[図2]真上から見たかげ（い＝ほぼ水平）", GRAY, 11))
FIGS["HG-2815"] = svg("0 0 460 200", "".join(_b15))

# ══ 第579回 大問4（HG-2816）ゴムひもP・Q＋表 ═══════════════════════════
def rubber(cx, y0, label):
    return ['<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="6"/>' % (
        r1(cx - 30), r1(y0), r1(cx + 30), r1(y0), GRAY),
        ln(cx, y0, cx, y0 + 40, LINE, 2), circ(cx, y0 + 54, 13, LINE, 2),
        t(cx - 34, y0 - 6, "天井", GRAY, 10), t(cx, y0 + 78, label, GRAY, 11)]


_b16 = rubber(50, 20, "[図1]ゴムひもP")
def table_row(labels, vals, ox, oy, cw=42, ch=24, lw=110):
    out = []
    out.append(rect(ox, oy, lw, ch, LINE, 1.3))
    out.append(t(ox + lw / 2, oy + 17, labels, HI, 10))
    for c, v in enumerate(vals):
        out.append(rect(ox + lw + c * cw, oy, cw, ch, LINE, 1.1))
        out.append(t(ox + lw + c * cw + cw / 2, oy + 17, str(v), TX, 11))
    return out


_b16 += table_row("おもり(g)", [20, 40, 60, 80, 100, "あ", 200], 130, 15)
_b16 += table_row("Pの長さ(cm)", [42, 44, "い", 48, 50, 54, 60], 130, 39)
_b16 += rubber(50, 130, "[図2]ゴムひもQ")
_b16 += table_row("おもり(g)", [20, 40, 80, 180], 130, 130, 60, 24, 110)
_b16 += table_row("Qの長さ(cm)", [41, 42, 44, 49], 130, 154, 60, 24, 110)
FIGS["HG-2816"] = svg("0 0 620 205", "".join(_b16 + [
    t(310, 198, "PとはばがPの2倍のQ。それぞれにおもりをつるして長さを調べた", GRAY, 11),
]))

# ══ 第580回 大問4（HG-2817）とつレンズ→F点。A〜Cの3位置 ═══════════════
LX7, LY7, LH7, FX7, FY7 = 60, 30, 130, 280, 100
_b17 = []
for frac in (0, 0.25, 0.5, 0.75, 1):
    y = LY7 + LH7 * frac
    _b17 += [ln(10, y, LX7, y, TX, 1.6), ln(LX7, y, FX7, FY7, LINE, 1.6)]
_b17.append('<ellipse cx="%s" cy="%s" rx="10" ry="%s" fill="none" stroke="%s" stroke-width="2"/>' % (
    r1(LX7), r1(LY7 + LH7 / 2), r1(LH7 / 2), LINE))
for i, lab in enumerate(["A", "B", "C"]):
    x = 150 + i * 55
    _b17 += [ln(x, 20, x, 160, GRAY, 1.2, "3 2"), t(x, 15, lab, HI, 13)]
_b17 += [dot(FX7, FY7, 3.5, TX), t(FX7, FY7 + 18, "F", TX, 12)]
FIGS["HG-2817"] = svg("0 0 340 200", "".join(_b17 + [
    t(170, 190, "とつレンズを通った日光がFに集まる。A〜Cの位置にスクリーンを置く", GRAY, 11),
]))

# ══ 第581回 大問4(2)（HG-2818）ぬいばり(S極)／棒P・Q・R ══════════════════
_b18 = magnet(60, 20, 80, 20, n_left=False)
_b18 += [ln(30, 60, 180, 60, TX, 1.8), t(26, 64, "A", TX, 11, "end"), t(184, 64, "B", TX, 11, "start")]
_b18.append(defs_arrow("ar18", HI))
_b18.append('<path d="M170,48 L40,48" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar18)"/>' % HI)
_b18.append(t(105, 8, "[図1]S極でこする", GRAY, 10))
for i, (nm, l1, l2) in enumerate([("P", "あ", "い"), ("Q", "う", "え"), ("R", "お", "か")]):
    y = 110 + i * 34
    _b18 += [rect(230, y, 110, 24, LINE, 1.6), t(218, y + 16, "ぼう" + nm, TX, 11, "end"),
              t(240, y + 16, l1, HI, 11), t(330, y + 16, l2, HI, 11)]
FIGS["HG-2818"] = svg("0 0 400 230", "".join(_b18 + [
    t(200, 222, "ぬいばり(S極でこする)と、ぼうP・Q・Rの両はし(あ〜か)", GRAY, 11),
]))

# ══ 第582回 大問4（HG-2819）バス線。A直結+B電池／C・D電池／E直結／F電池／G(電池,右はし) ═
BX19 = 200
A_Y, J1_Y, J2_Y, E_Y, J3_Y, G_Y = 20, 60, 110, 150, 190, 250
BXR, CXL, DXR, FXR = BX19 + 80, BX19 - 80, BX19 + 80, BX19 + 80
_b19 = [ln(BX19, A_Y, BX19, E_Y, LINE, 2.2), ln(BX19, E_Y, BX19, J3_Y, LINE, 2.2)]
_b19 += [dot(BX19, A_Y), t(BX19 - 14, A_Y + 4, "A", HI, 13, "end")]
_b19 += [dot(BX19, J1_Y)]
_b19 += battery2(BX19, J1_Y, BXR, J1_Y, plus_end=2)  # ＋がB側
_b19 += [dot(BXR, J1_Y), t(BXR + 14, J1_Y + 4, "B", HI, 13, "start")]
_b19 += [dot(BX19, J2_Y)]
_b19 += battery2(BX19, J2_Y, CXL, J2_Y, plus_end=2)  # ＋がC側
_b19 += [dot(CXL, J2_Y), t(CXL - 14, J2_Y + 4, "C", HI, 13, "end")]
_b19 += battery2(BX19, J2_Y, DXR, J2_Y, plus_end=1)  # ＋がバス側（逆向き）
_b19 += [dot(DXR, J2_Y), t(DXR + 14, J2_Y + 4, "D", HI, 13, "start")]
_b19 += [dot(BX19, E_Y), t(BX19 - 14, E_Y + 4, "E", HI, 13, "end")]
_b19 += [dot(BX19, J3_Y)]
_b19 += battery2(BX19, J3_Y, FXR, J3_Y, plus_end=2)  # ＋がF側
_b19 += [dot(FXR, J3_Y), t(FXR + 14, J3_Y + 4, "F", HI, 13, "start")]
_b19 += battery2(BX19, J3_Y, BX19, G_Y, plus_end=2)  # ＋がG側
_b19 += [dot(BX19, G_Y), t(BX19 + 14, G_Y + 4, "G", HI, 13, "start")]
FIGS["HG-2819"] = svg("0 0 420 290", "".join(_b19) + t(
    210, 282, "中央のバス線。A・Eは直結、B・C・D・F・Gは電池つき", GRAY, 11))

# ══ 第583回 大問4（HG-2820）3枚の重なり／レンズ→しょう点／ドーナツ+表 ══════
_b20 = []
_b20 += [rect(20, 30, 90, 80, LINE, 1.6), rect(70, 20, 90, 60, LINE, 1.6), rect(50, 60, 90, 60, LINE, 1.6)]
for lab, (x, y) in {"あ": (35, 70), "い": (100, 45), "う": (140, 40), "え": (100, 68), "お": (128, 70),
                     "か": (65, 92), "き": (100, 105)}.items():
    _b20.append(t(x, y, lab, TX, 12))
_b20.append(t(90, 130, "[図1]", GRAY, 11))
LX20, LY20, LH20, FX20, FY20 = 240, 20, 90, 380, 65
for frac in (0, 0.5, 1):
    y = LY20 + LH20 * frac
    _b20 += [ln(210, y, LX20, y, TX, 1.6), ln(LX20, y, FX20, FY20, LINE, 1.6)]
_b20.append('<ellipse cx="%s" cy="%s" rx="8" ry="%s" fill="none" stroke="%s" stroke-width="2"/>' % (
    r1(LX20), r1(LY20 + LH20 / 2), r1(LH20 / 2), LINE))
_b20 += [poly([(LX20, LY20), (FX20, FY20), (LX20, LY20 + LH20)], "none", 0, "rgba(154,163,192,0.35)")]
_b20 += [dot(FX20, FY20, 3.5, TX), t(FX20, FY20 + 16, "しょう点", TX, 10)]
_b20.append(t(300, 130, "[図2]", GRAY, 11))
AX20, AY20, AR20 = 450, 65, 34
_b20 += [circ(AX20, AY20, AR20, LINE, 1.6, "rgba(154,163,192,0.4)"), circ(AX20, AY20, AR20 * 0.4, LINE, 1.6, "#0f1420")]
_b20.append(t(450, 130, "[図3]", GRAY, 11))
CW20, CH20, OX20, OY20 = 44, 24, 20, 165
V20 = ["3", "4", "8", "11", "B"], ["A", "6", "4", "2.5", "2"]
for r, (lab, vals) in enumerate(zip(["きょり(cm)", "直径(cm)"], V20)):
    y = OY20 + r * CH20
    _b20.append(rect(OX20, y, 90, CH20, LINE, 1.3))
    _b20.append(t(OX20 + 45, y + 16, lab, HI, 10))
    for c, v in enumerate(vals):
        _b20.append(rect(OX20 + 90 + c * CW20, y, CW20, CH20, LINE, 1.1))
        _b20.append(t(OX20 + 90 + c * CW20 + CW20 / 2, y + 16, str(v), TX, 11))
FIGS["HG-2820"] = svg("0 0 500 220", "".join(_b20))

# ══ 第584回 大問4（HG-2821）A-電池-B／A-電池-C／D孤立／E-電池-F／E-電池(宙ぶらりん) ══
P21 = {"A": (70, 40), "B": (220, 40), "C": (70, 130), "D": (40, 200), "E": (150, 220), "F": (260, 190)}
_b21 = [rect(20, 15, 270, 235, LINE, 1.4)]
_b21 += battery2(*P21["A"], *P21["B"], plus_end=2)  # 電池1：＋がB側
_b21 += battery2(*P21["A"], *P21["C"], plus_end=2)  # 電池2：＋がC側
_b21 += [dot(*P21["D"]), t(P21["D"][0] - 12, P21["D"][1], "D", HI, 13, "end"), t(P21["D"][0] + 10, P21["D"][1] + 4, "(孤立)", GRAY, 9, "start")]
_b21 += battery2(*P21["E"], *P21["F"], plus_end=2)  # 電池4：＋がF側
DANX, DANY = P21["E"][0] - 40, P21["E"][1] - 55
_b21 += battery2(P21["E"][0], P21["E"][1], DANX, DANY, plus_end=1)  # 電池3：反対側は宙ぶらりん（極は不明）
_b21 += [t(DANX, DANY - 20, "(反対側は宙ぶらりん)", GRAY, 9)]
for k in ("A", "B", "C", "E", "F"):
    x, y = P21[k]
    _b21 += [dot(x, y, 4.5, TX), t(x, y - 12, k, HI, 13)]
FIGS["HG-2821"] = svg("0 0 400 265", "".join(_b21 + [
    t(200, 258, "A-電池-B／A-電池-C／Dは孤立／E-電池-F／Eのもう1個は宙ぶらりん", GRAY, 11),
]))

# ══ 第585回 大問4（HG-2822）棒A-C-B（水平／ななめ／折れ曲げ）＋板 ═══════════
_b22 = []
_b22 += [ln(20, 40, 140, 40, LINE, 2.2), dot(20, 40, 3, TX), dot(140, 40, 3, TX), dot(80, 40, 3, HI),
          t(20, 30, "A", TX, 11), t(80, 30, "C", TX, 11), t(140, 30, "B", TX, 11),
          ln(80, 40, 80, 55, GRAY, 1.4), t(80, 68, "[図1]水平", GRAY, 10)]
X0_2, Y0_2, X1_2, Y1_2 = 180, 75, 300, 25
_b22 += [ln(X0_2, Y0_2, X1_2, Y1_2, LINE, 2.2), dot(X0_2, Y0_2, 3, TX), dot(X1_2, Y1_2, 3, TX),
          dot((X0_2 + X1_2) / 2, (Y0_2 + Y1_2) / 2, 3, HI),
          t(X0_2 - 8, Y0_2 + 6, "A", TX, 11, "end"), t((X0_2 + X1_2) / 2, (Y0_2 + Y1_2) / 2 - 10, "C", TX, 11),
          t(X1_2 + 8, Y1_2 - 2, "B", TX, 11, "start"), t(240, 90, "[図2]ななめ", GRAY, 10)]
_b22 += [pline([(340, 40), (340, 70), (420, 70), (420, 100)], LINE, 2.2),
          dot(340, 40, 3, TX), dot(340, 70, 3, HI), dot(420, 100, 3, TX),
          t(330, 40, "A", TX, 11, "end"), t(350, 74, "C", TX, 11, "start"), t(430, 100, "B", TX, 11, "start"),
          t(380, 120, "[図3]折れ曲げ", GRAY, 10)]
EX0_2, EY0_2 = 30, 150
EW22, EH22 = 90, 80
ARM22 = 18
MID22 = 55
GAP22 = (EH22 - 3 * ARM22) / 2
_e22 = [
    (EX0_2, EY0_2), (EX0_2 + EW22, EY0_2), (EX0_2 + EW22, EY0_2 + ARM22), (EX0_2 + 25, EY0_2 + ARM22),
    (EX0_2 + 25, EY0_2 + ARM22 + GAP22), (EX0_2 + MID22, EY0_2 + ARM22 + GAP22),
    (EX0_2 + MID22, EY0_2 + ARM22 + GAP22 + ARM22), (EX0_2 + 25, EY0_2 + ARM22 + GAP22 + ARM22),
    (EX0_2 + 25, EY0_2 + ARM22 + GAP22 + ARM22 + GAP22), (EX0_2 + EW22, EY0_2 + ARM22 + GAP22 + ARM22 + GAP22),
    (EX0_2 + EW22, EY0_2 + EH22), (EX0_2, EY0_2 + EH22),
]
_b22 += [poly(_e22, LINE, 1.8)]
_b22 += [t(EX0_2 + EW22 - 12, EY0_2 + ARM22 / 2 + 4, "A", TX, 11),
          t(EX0_2 + MID22 - 12, EY0_2 + ARM22 + GAP22 + ARM22 / 2 + 4, "C", TX, 11),
          t(EX0_2 - 10, EY0_2 + EH22 / 2, "B", TX, 11, "end"),
          t(EX0_2 + EW22 - 12, EY0_2 + EH22 - 6, "×", HI, 12),
          t(EX0_2 + EW22 / 2, EY0_2 + EH22 + 18, "[図4]", GRAY, 10)]
FIGS["HG-2822"] = svg("0 0 460 270", "".join(_b22 + [
    t(230, 262, "金ぞくの棒3パターン（水平・ななめ・折れ曲げ）と、板の×を加熱", GRAY, 11),
]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    bad = []
    for hg, fig in FIGS.items():
        vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', fig)
        w, h = float(vb.group(1)), float(vb.group(2))
        if h / w > 0.7:
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

    p = find_genbo()
    s = io.open(p, encoding="utf-8").read()
    n = 0
    for hg, fig in FIGS.items():
        pat = re.compile(r"(### 【%s】.*?\n(?:.*?\n)*?- 図: [^\n]*\n)(- 図SVG: [^\n]*\n)?" % hg)
        m = pat.search(s)
        if not m:
            print("見つからない:", hg)
            continue
        s = s[:m.end(1)] + "- 図SVG: `%s`\n" % fig + s[m.end():]
        n += 1
    print("原簿に図SVGを入れた:", n, "/", len(FIGS))
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("✅ 原簿に書き込み完了")


if __name__ == "__main__":
    main()
