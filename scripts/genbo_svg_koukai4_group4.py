# -*- coding: utf-8 -*-
"""学年4の残り理科のうち、2022年度4年公開学力テスト理科の13本
   （第586〜598回・HG-2823〜2835）を、PDFの実物を見て原簿に入れる。

★根拠：G:\\マイドライブ\\浜問題\\公開学力テスト\\2022年度 4年 公開テスト理科.pdf
  （46ページ）を140dpiで出して目視。ページ→回の対応は原簿の
  「# 🧪 2022年度 4年 公開理科」セクションに既にある表を使った
  （587=p1-3,588=p4-6,589=p7-10,590=p11-13,591=p14-16,592=p17-20,
  593=p21-23,594=p24-27,595=p28-31,596=p32-35,597=p36-39,598=p40-43,
  586=p44-46＝年度の1回目なのに末尾）。

実物で確かめたページ対応：
  HG-2823 … p46。氷の加熱グラフ（0→6分→54分→78分→114分、-20→B→C→A）
  HG-2824 … p3。13たん子（あ〜す）に電池3個・豆電球2個・どう線がバラバラに配置
  HG-2825 … p6。[図1]記ろく用紙上のぼう／[図2]十字(A上・B左)+右向き3本のかげ
  HG-2826 … p10。[図1]糸でつるした棒磁石(N→A)／[図2]縦置き棒磁石(上N下S)+方位じしんP・Q
  HG-2827 … p13。[図1]3枚の鏡の重なり(ア〜キ)／[図2]レンズ→F点+あいう
  HG-2828 … p16。[図1][図2]スイッチの回路（豆電球あ〜え、スイッチ1〜6）
  HG-2829 … p20。[図1]N極下の鉄くぎ3本／[図2]ぬいばり(N極でこする)／
            [図3]台ばかり+じしゃくA+近づける棒磁石／[図4]2本の棒磁石+方位じしん4個
  HG-2830 … p23。天井+ゴムひも+おもり+表
  HG-2831 … p27。Aを中心に放射状（A-B, A-C, A-D は電池、A-F は直結、F-E は電池）
  HG-2832 … p31。レンズ→F点+しゃ線のかげ+表
  HG-2833 … p35。A・B(電池,上で合流)→C(電池)→E(電池,下)、および→F(直結)→D(電池,右)
  HG-2834 … p39。水じょう気・水・氷の3箱+6本の矢印A〜F
  HG-2835 … p43。氷の加熱グラフ（0→8分→72分→136分→152分、-20→0→あ→100）

使い方: python scripts/genbo_svg_koukai4_group4.py [--write]
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


def arrow(x1, y1, x2, y2, mid, color=HI, w=1.8):
    return '<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="%s" marker-end="url(#%s)"/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), color, w, mid)


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
    でっぱりが無いと＋−がどちらか分からない、という本人指摘への対応。"""
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


def scale(cx, cy, needle_deg=-20, tray_label=None):
    """台ばかり：トレイ＋丸いダイヤル(目もり付き)＋はり＋台"""
    R = 20
    out = [poly([(cx - 30, cy + 26), (cx + 30, cy + 26), (cx + 20, cy - 8), (cx - 20, cy - 8)], LINE, 1.6)]
    out.append(circ(cx, cy + 8, R, LINE, 1.6))
    for i in range(9):
        a = math.radians(180 - i * 22.5)
        out.append(ln(cx + (R - 4) * math.cos(a), cy + 8 - (R - 4) * math.sin(a),
                       cx + R * math.cos(a), cy + 8 - R * math.sin(a), GRAY, 1))
    a = math.radians(90 - needle_deg)
    out.append(ln(cx, cy + 8, cx + R * 0.75 * math.cos(a), cy + 8 - R * 0.75 * math.sin(a), HI, 2))
    out.append(dot(cx, cy + 8, 2.2, TX))
    out.append(ln(cx - 22, cy - 22, cx + 22, cy - 22, LINE, 1.8))
    out.append(ln(cx - 22, cy - 22, cx - 20, cy - 8, LINE, 1.2))
    out.append(ln(cx + 22, cy - 22, cx + 20, cy - 8, LINE, 1.2))
    if tray_label:
        out.append(t(cx, cy - 30, tray_label, TX, 10))
    return out


def bulb(cx, cy, r=9):
    """豆電球（円+フィラメントの×）"""
    return [circ(cx, cy, r, LINE, 1.6),
            ln(cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55, LINE, 1.3),
            ln(cx - r * 0.55, cy + r * 0.55, cx + r * 0.55, cy - r * 0.55, LINE, 1.3)]


def bulb_between(x1, y1, x2, y2, r=9):
    L = math.hypot(x2 - x1, y2 - y1) or 1
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    out = [ln(x1, y1, mx - ux * r, my - uy * r, LINE, 1.8),
           ln(mx + ux * r, my + uy * r, x2, y2, LINE, 1.8)]
    out += bulb(mx, my, r)
    return out


def magnet(x, y, w, h, n_left=True, vertical=False):
    half = (h if vertical else w) / 2
    if vertical:
        out = [rect(x, y, w, half, LINE, 1.8, "#2a3560" if not n_left else "none"),
               rect(x, y + half, w, half, LINE, 1.8, "none" if not n_left else "#2a3560")]
        out.append(t(x + w / 2, y + half / 2 + 4, "S" if n_left else "N", TX if n_left else HI, 12))
        out.append(t(x + w / 2, y + half + half / 2 + 4, "N" if n_left else "S", HI if n_left else TX, 12))
    else:
        nx, sx = (x, x + half) if n_left else (x + half, x)
        out = [rect(x, y, half, h, LINE, 1.8, "#2a3560"), rect(x + half, y, half, h, LINE, 1.8, "none")]
        out.append(t(nx + half / 2, y + h / 2 + 5, "N", HI, 13))
        out.append(t(sx + half / 2, y + h / 2 + 5, "S", TX, 13))
    return out


def rubber(cx, y0, label):
    return ['<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="6"/>' % (
        r1(cx - 30), r1(y0), r1(cx + 30), r1(y0), GRAY),
        ln(cx, y0, cx, y0 + 40, LINE, 2), circ(cx, y0 + 54, 13, LINE, 2),
        t(cx - 34, y0 - 6, "天井", GRAY, 10), t(cx, y0 + 78, label, GRAY, 11)]


def table_row(label, vals, ox, oy, cw=42, ch=24, lw=110):
    out = [rect(ox, oy, lw, ch, LINE, 1.3), t(ox + lw / 2, oy + 17, label, HI, 10)]
    for c, v in enumerate(vals):
        out.append(rect(ox + lw + c * cw, oy, cw, ch, LINE, 1.1))
        out.append(t(ox + lw + c * cw + cw / 2, oy + 17, str(v), TX, 11))
    return out


def heat_graph(cx0, xs, ys, ylabels, xh=180, yh=170):
    """氷の加熱グラフ。xsは分・ysは実際の温度(位置決め用)、ylabelsは縦軸に出す文字（数値でも記号でも可）"""
    x0, y0 = cx0, 20
    xmax, ymin, ymax = xs[-1], -20, ys[-1]
    sx = xh / xmax
    sy = yh / (ymax - ymin)
    pts_ = [(x0 + x * sx, y0 + yh - (y - ymin) * sy) for x, y in zip(xs, ys)]
    out = [ln(x0, y0, x0, y0 + yh, LINE, 1.6), ln(x0, y0 + yh, x0 + xh + 10, y0 + yh, LINE, 1.6)]
    out.append(pline(pts_, HI, 2.2))
    for (px, py), yv in zip(pts_, ylabels):
        out.append(dot(px, py, 3, TX))
        out.append(ln(x0, py, px, py, GRAY, 1, "2 2"))
        out.append(t(x0 - 8, py + 4, str(yv), TX, 11, "end"))
    for (px, py), xv in zip(pts_, xs):
        out.append(ln(px, py, px, y0 + yh, GRAY, 1, "2 2"))
        out.append(t(px, y0 + yh + 16, str(xv), TX, 10))
    out.append(t(x0 - 8, y0 - 6, "温度", GRAY, 10, "end"))
    out.append(t(x0 + xh / 2, y0 + yh + 34, "加熱時間(分)", GRAY, 10))
    return out


def mirror_overlap(ox, oy, labels):
    """3枚の長方形の重なり（あ〜き などの7領域）"""
    out = [rect(ox, oy + 20, 90, 80, LINE, 1.6), rect(ox + 50, oy, 90, 60, LINE, 1.6),
           rect(ox + 30, oy + 40, 90, 60, LINE, 1.6)]
    positions = [(15, 60), (80, 25), (120, 20), (80, 48), (108, 60), (45, 82), (80, 95)]
    for lab, (dx, dy) in zip(labels, positions):
        out.append(t(ox + dx, oy + dy, lab, TX, 12))
    return out


def lens_cone(ox, oy, w, h, fx, labels_pos=None):
    """レンズ→F点の収束光線図（かげのしゃ線つき）"""
    out = []
    for frac in (0, 0.5, 1):
        y = oy + h * frac
        out += [ln(ox - 30, y, ox, y, TX, 1.6), ln(ox, y, fx, oy + h / 2, LINE, 1.6)]
    out.append('<ellipse cx="%s" cy="%s" rx="8" ry="%s" fill="none" stroke="%s" stroke-width="2"/>' % (
        r1(ox), r1(oy + h / 2), r1(h / 2), LINE))
    out.append(poly([(ox, oy), (fx, oy + h / 2), (ox, oy + h)], "none", 0, "rgba(154,163,192,0.3)"))
    out.append(dot(fx, oy + h / 2, 3, TX))
    return out


FIGS = {}

# ══ 第586回 大問4（HG-2823）氷の加熱グラフ ═══════════════════════════
_b23 = heat_graph(60, [0, 6, 54, 78, 114], [-20, 0, 0, 40, 100], ["-20", "B", "", "C", "A"])
FIGS["HG-2823"] = svg("0 0 360 240", "".join(_b23 + [
    t(160, 232, "−20℃の氷100gを一定の熱量で加熱したときの温度変化", GRAY, 11),
]))

# ══ 第587回 大問3（HG-2824）13たん子（あ〜す）に電池3・豆電球2・どう線 ═══
_b24 = [rect(20, 15, 300, 235, LINE, 1.4)]
_b24 += battery2(50, 45, 110, 45, plus_end=1)
_b24 += [dot(50, 45), t(50, 33, "あ", HI, 12), dot(110, 45), t(110, 33, "い", HI, 12)]
_b24 += bulb_between(50, 45, 50, 110)
_b24 += [t(34, 78, "豆A", TX, 9, "end")]
_b24 += [dot(50, 45), dot(50, 110), t(50, 124, "う", HI, 12)]
_b24 += [dot(230, 40), t(230, 28, "え", HI, 12), dot(170, 75), t(160, 79, "お", HI, 12, "end"),
          ln(170, 75, 230, 40, LINE, 1.6), t(210, 55, "どう線", GRAY, 9)]
_b24 += [dot(170, 110), t(170, 98, "か", HI, 12)]
_b24 += bulb_between(170, 110, 170, 175)
_b24 += [t(154, 143, "豆B", TX, 9, "end")]
_b24 += [dot(170, 175), t(170, 189, "き", HI, 12)]
_b24 += [dot(230, 145), t(230, 133, "く", HI, 12), dot(290, 145), t(290, 133, "け", HI, 12),
          ln(230, 145, 290, 145, LINE, 1.6)]
_b24 += [dot(60, 175), t(60, 163, "こ", HI, 12), dot(120, 175), t(120, 163, "さ", HI, 12)]
_b24 += battery2(60, 175, 120, 175, plus_end=1)
_b24 += [dot(230, 175), t(230, 163, "し", HI, 12), dot(230, 210), t(230, 224, "す", HI, 12)]
_b24 += battery2(230, 175, 230, 210, plus_end=2, body=18)
FIGS["HG-2824"] = svg("0 0 380 250", "".join(_b24 + [
    t(170, 244, "13個のたん子（あ〜す）に電池3個・豆電球2個・どう線がバラバラに配置", GRAY, 11),
]))

# ══ 第588回 大問3（HG-2825）記ろく用紙＋かげ（右向き3本） ═══════════════
_b25 = []
EX25, EY25 = 100, 100
_b25 += [ln(EX25, EY25 - 50, EX25, EY25 + 50, LINE, 1.4), ln(EX25 - 50, EY25, EX25 + 50, EY25, LINE, 1.4)]
_b25 += [t(EX25, EY25 - 60, "A", TX, 12), t(EX25 - 62, EY25 + 4, "B", TX, 12, "end")]
for ang_deg, lab, dy in ((-30, "あ", -30), (0, "い", 4), (30, "う", 32)):
    a = math.radians(ang_deg)
    _b25.append(ln(EX25, EY25, EX25 + 55 * math.cos(a), EY25 + 55 * math.sin(a), HI, 2.4))
    _b25.append(t(EX25 + 62, EY25 + dy, lab, HI, 11, "start"))
FIGS["HG-2825"] = svg("0 0 300 200", "".join(_b25 + [
    t(120, 190, "真上から見たかげ。A・Bは方位が伏せてある（あ・い・うは右向きに3本）", GRAY, 11),
]))

# ══ 第589回 大問4（HG-2826）つるした棒磁石／縦置き棒磁石+方位じしんP・Q ═══
_b26 = []
_b26 += [ln(70, 20, 55, 55, GRAY, 1.4), t(75, 20, "糸", GRAY, 10)]
_b26 += magnet(20, 55, 100, 20, n_left=True)
_b26 += [t(10, 65, "A", TX, 11, "end"), t(128, 65, "B", TX, 11, "start"), t(70, 95, "[図1]N極がAを向く", GRAY, 10)]
_b26 += magnet(230, 20, 26, 80, n_left=False, vertical=True)
_b26 += [circ(180, 45, 15, LINE, 1.6), t(180, 30, "P", TX, 11)]
_b26 += [circ(230, 130, 15, LINE, 1.6), t(230, 150, "Q", TX, 11)]
_b26 += [t(230, 10, "[図2]縦置き", GRAY, 10)]
FIGS["HG-2826"] = svg("0 0 340 180", "".join(_b26 + [
    t(170, 172, "糸でつるした棒磁石と、つくえに縦置きした棒磁石+方位じしんP・Q", GRAY, 11),
]))

# ══ 第590回 大問4（HG-2827）3枚の鏡の重なり（ア〜キ）＋レンズ→F点 ═══════
_b27 = mirror_overlap(20, 10, ["ア", "イ", "ウ", "エ", "オ", "カ", "キ"])
_b27.append(t(90, 130, "[図1]", GRAY, 11))
_b27 += lens_cone(230, 20, 90, 90, 340)
for i, lab in enumerate(["あ", "い", "う"]):
    x = 260 + i * 25
    _b27 += [ln(x, 15, x, 105, GRAY, 1.2, "3 2"), t(x, 12, lab, HI, 11)]
_b27 += [t(280, 130, "[図2]", GRAY, 11)]
FIGS["HG-2827"] = svg("0 0 400 145", "".join(_b27))

# ══ 第591回 大問4（HG-2828）スイッチの回路[図1][図2] ═══════════════════
_b28 = []
X0, Y0 = 30, 20
X1, Y1 = 30, 190
_b28 += [ln(X0, Y0, X1, Y1, LINE, 2), dot(X0, Y0), dot(X1, Y1),
          t(X0 - 8, Y0 + 4, "X", HI, 12, "end"), t(X1 - 8, Y1 + 4, "Y", HI, 12, "end")]
# 外回りの道：X-スイッチ1-右上-下へ-豆電球い-電池-Y
OX = 210
_b28 += [ln(X0, Y0, OX - 18, Y0, LINE, 1.8), ln(OX - 18, Y0, OX, Y0 - 10, LINE, 1.8), dot(OX - 18, Y0)]
_b28 += [t((X0 + OX) / 2, Y0 - 8, "スイッチ1", GRAY, 9)]
_b28 += [dot(OX, Y0)]
_b28 += [ln(OX, Y0, OX, 95, LINE, 1.8)]
_b28 += bulb(OX, 110)
_b28 += [t(OX + 16, 114, "豆電球い", TX, 9, "start")]
_b28 += [ln(OX, 125, OX, 150, LINE, 1.8)]
_b28 += battery2(OX, 150, X1, Y1, plus_end=1)
_b28 += [t(90, 205, "[図1]", GRAY, 11)]
# ななめの道：X-スイッチ2-豆電球あ-電池-Y
MX, MY = 110, 90
_b28 += [ln(X0, Y0, MX - 8, MY - 8, LINE, 1.8), t((X0 + MX) / 2 - 4, (Y0 + MY) / 2 - 10, "スイッチ2", GRAY, 9, "end")]
_b28 += bulb(MX, MY)
_b28 += [t(MX + 14, MY - 4, "豆電球あ", TX, 9, "start")]
_b28 += battery2(MX + 8, MY + 8, X1, Y1, plus_end=1)

TLX, RX, FX_ = 300, 380, 460  # 左(TL/P/左下)・中(TR/R/Q)・右(右上/豆電球え)の3列
YT2, YM2, YB2 = 20, 100, 190
_b28 += bulb(TLX, YT2 - 14)
_b28 += [t(TLX - 16, YT2 - 12, "豆電球う", TX, 9, "end")]
_b28 += [ln(TLX, YT2 - 5, TLX, YT2, LINE, 2), ln(TLX, YT2, RX, YT2, LINE, 2), ln(RX, YT2 - 2, RX, YT2, LINE, 2)]
_b28 += [ln(TLX, YT2, TLX, YM2, LINE, 2), t(TLX - 10, (YT2 + YM2) / 2, "スイッチ3", GRAY, 9, "end")]
_b28 += [ln(RX, YT2, RX, YM2, LINE, 2)]
_b28 += [ln(RX, YM2, FX_, YM2, LINE, 2)]
_b28 += [ln(TLX, YM2, RX, YM2, LINE, 2), t((TLX + RX) / 2, YM2 - 8, "スイッチ4", GRAY, 9)]
_b28 += [ln(TLX, YM2, TLX, YB2, LINE, 2), t(TLX - 10, (YM2 + YB2) / 2, "どう線", GRAY, 9, "end")]
_b28 += [ln(RX, YM2, RX, YB2, LINE, 2), t(RX + 10, (YM2 + YB2) / 2, "スイッチ5", GRAY, 9, "start")]
_b28 += [ln(FX_, YM2, FX_, YB2 - 60, LINE, 2), t(FX_ + 10, YM2 + 15, "スイッチ6", GRAY, 9, "start")]
_b28 += bulb(FX_, YB2 - 45)
_b28 += [t(FX_ + 16, YB2 - 41, "豆電球え", TX, 9, "start")]
_b28 += [ln(FX_, YB2 - 36, FX_, YB2, LINE, 2)]
_b28 += battery2(TLX, YB2, RX, YB2, plus_end=1)
_b28 += [ln(RX, YB2, FX_, YB2, LINE, 2), t((TLX + RX) / 2, YB2 + 20, "かん電池", GRAY, 9)]
_b28 += [t(RX, 235, "[図2]", GRAY, 11)]
FIGS["HG-2828"] = svg("0 0 460 250", "".join(_b28))

# ══ 第592回 大問4（HG-2829）鉄くぎ3本／ぬいばり／台ばかり／2本の磁石+方位じしん4個 ═
_b29 = []
_b29 += magnet(20, 15, 70, 18, n_left=False)
for i in range(3):
    y0 = 33 + i * 16
    _b29.append(poly([(72, y0), (78, y0 + 14), (66, y0 + 14)], LINE, 1.4))
_b29 += [t(55, 5, "[図1]", GRAY, 10)]
_b29 += magnet(130, 15, 70, 18, n_left=False)
_b29 += [ln(110, 55, 200, 55, TX, 1.8), t(165, 15, "N極でこする", GRAY, 9)]
_b29.append(defs_arrow("ar29a", HI))
_b29.append('<path d="M190,45 L120,45" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar29a)"/>' % HI)
_b29 += [t(165, 5, "[図2]", GRAY, 10)]
_b29 += magnet(250, 12, 26, 34, n_left=False, vertical=True)
_b29.append(defs_arrow("ar29b", HI))
_b29.append('<path d="M263,46 L263,66" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar29b)"/>' % HI)
_b29 += ['<ellipse cx="263" cy="82" rx="22" ry="8" fill="#2a3560" stroke="%s" stroke-width="1.6"/>' % LINE,
          t(263, 86, "N", HI, 11), t(263, 70, "じしゃくA", TX, 9)]
_b29 += scale(263, 130, -20)
_b29 += [t(263, 5, "[図3]", GRAY, 10)]
_b29 += [t(120, 158, "[図4]2本の棒磁石+方位じしん4個", GRAY, 9)]
_b29 += magnet(20, 180, 90, 18, n_left=True)
_b29 += magnet(20, 225, 90, 18, n_left=True)
_b29 += [circ(8, 175, 12, LINE, 1.4), t(8, 160, "①", TX, 10)]
_b29 += [circ(128, 189, 12, LINE, 1.4), t(142, 189, "②", TX, 10, "start")]
_b29 += [circ(8, 234, 12, LINE, 1.4), t(8, 251, "③", TX, 10)]
_b29 += [circ(128, 234, 12, LINE, 1.4), t(142, 234, "④", TX, 10, "start")]
FIGS["HG-2829"] = svg("0 0 380 265", "".join(_b29))

# ══ 第593回 大問4（HG-2830）天井+ゴムひも+おもり+表 ═══════════════════
_b30 = rubber(50, 20, "[図]天井につるしたゴムひも")
_b30 += table_row("おもり(g)", [30, 60, 70, 90, 160], 150, 25, 48)
_b30 += table_row("ゴムひもの長さ(cm)", [36, 42, 44, 48, 62], 150, 49, 48, 24, 140)
FIGS["HG-2830"] = svg("0 0 620 130", "".join(_b30 + [
    t(310, 122, "天井からつり下げたゴムひもにいろいろな重さのおもりをつるした", GRAY, 11),
]))

# ══ 第594回 大問4（HG-2831）Aを中心に放射状（B,C,D=電池／F=直結,F-E=電池） ═══
AX31, AY31 = 150, 30
BX, BY = 250, 30
CX_, CY_ = 260, 90
DX_, DY_ = 220, 150
FX, FY = 50, 90
EX, EY = 50, 170
_b31 = battery2(AX31, AY31, BX, BY, plus_end=1)  # 電池1：＋がA側
_b31 += battery2(AX31, AY31, CX_, CY_, plus_end=1)  # 電池2：＋がA側
_b31 += battery2(AX31, AY31, DX_, DY_, plus_end=2)  # 電池3：＋がD側
_b31 += [ln(AX31, AY31, FX, FY, LINE, 1.8)]  # AとFは直結（どう線）
_b31 += battery2(FX, FY, EX, EY, plus_end=1)  # 電池4：＋がF側
for x, y, lab, dx, dy, anchor in (
    (AX31, AY31, "A", 0, -12, "middle"), (BX, BY, "B", 14, 0, "start"), (CX_, CY_, "C", 12, 4, "start"),
    (DX_, DY_, "D", 12, 4, "start"), (FX, FY, "F", -12, 0, "end"), (EX, EY, "E", -12, 0, "end"),
):
    _b31 += [dot(x, y, 5 if lab == "A" else 4, HI if lab == "A" else TX), t(x + dx, y + dy, lab, HI, 14, anchor)]
FIGS["HG-2831"] = svg("0 0 320 200", "".join(_b31 + [
    t(160, 192, "Aから4方向へ放射状の配線。B・C・Dは電池、Fは直結、F-Eは電池", GRAY, 11),
]))

# ══ 第595回 大問4（HG-2832）レンズ→F点+しゃ線のかげ+表 ═══════════════
_b32 = lens_cone(60, 20, 90, 100, 300)
_b32 += [t(180, 8, "レンズからスクリーンまでのきょり", GRAY, 9)]
_b32 += table_row("きょり(cm)", [2, 6, 8, 14, 16, "A", 22], 20, 150, 44)
_b32 += table_row("直径(cm)", [11, 9, 8, "B", 4, 3, 1], 20, 174, 44, 24, 110)
FIGS["HG-2832"] = svg("0 0 480 220", "".join(_b32 + [
    t(240, 212, "レンズを通った日光がF点に集まる。かげ(しゃ線)と明るい円のようす", GRAY, 11),
]))

# ══ 第596回 大問4（HG-2833）A・B(電池,合流)→C(電池)→E(電池)／→F(直結)→D(電池) ══
AX33, BX33, Y0_33 = 150, 260, 20
J1X, J1Y = (AX33 + BX33) / 2, 80
J2Y = 110
CX33 = J1X - 90
EX33, EY33 = J1X, 190
FX33 = J1X + 70
DX33 = FX33 + 70
_b33 = battery2(AX33, Y0_33, J1X, J1Y, plus_end=1)  # 電池1：＋がA側
_b33 += battery2(BX33, Y0_33, J1X, J1Y, plus_end=1)  # 電池2：＋がB側
_b33 += [ln(J1X, J1Y, J1X, J2Y, LINE, 2)]
_b33 += battery2(CX33, J2Y, J1X, J2Y, plus_end=2)  # 電池3：＋がバス側（逆向き）
_b33 += [ln(J1X, J2Y, J1X, J2Y + 30, LINE, 2)]
_b33 += battery2(J1X, J2Y + 30, EX33, EY33, plus_end=2)  # 電池4：＋がE側
_b33 += [ln(J1X, J2Y, FX33, J2Y, LINE, 2), dot(FX33, J2Y), t(FX33, J2Y + 16, "F", HI, 13)]
_b33 += battery2(FX33, J2Y, DX33, J2Y, plus_end=2)  # 電池5：＋がD側
for x, y, lab, dx, dy, anchor in (
    (AX33, Y0_33, "A", 0, -10, "middle"), (BX33, Y0_33, "B", 0, -10, "middle"),
    (CX33, J2Y, "C", -12, 4, "end"), (EX33, EY33, "E", -12, 4, "end"), (DX33, J2Y, "D", 12, 4, "start"),
):
    _b33 += [dot(x, y), t(x + dx, y + dy, lab, HI, 13, anchor)]
FIGS["HG-2833"] = svg("0 0 420 260", "".join(_b33 + [
    t(210, 252, "A・Bの電池が合流→Cの電池→Eの電池（下）。同じ点からFへ直結→Dの電池", GRAY, 11),
]))

# ══ 第597回 大問4（HG-2834）水じょう気・水・氷の3箱+6本の矢印A〜F ═════════
_b34 = []
BW, BH, GY = 90, 40, 60
BX1, BX2, BX3 = 20, 170, 320
for x, lab in ((BX1, "水じょう気"), (BX2, "水"), (BX3, "氷")):
    _b34 += [rect(x, GY, BW, BH, LINE, 1.8), t(x + BW / 2, GY + BH / 2 + 5, lab, TX, 13)]
_b34.append(defs_arrow("ar34", HI))
_b34.append('<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="1.8" marker-end="url(#ar34)"/>' % (
    BX3 + BW / 2, GY - 20, BX1 + BW / 2, GY - 20, HI))
_b34.append(t((BX1 + BX3) / 2 + BW / 2, GY - 26, "A（凝華）", GRAY, 10))
_b34.append('<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="1.8" marker-end="url(#ar34)"/>' % (
    BX1 + BW, GY + 12, BX2, GY + 12, HI))
_b34.append(t((BX1 + BX2 + BW) / 2, GY + 6, "B（じょう発）", GRAY, 10))
_b34.append('<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="1.8" marker-end="url(#ar34)"/>' % (
    BX2, GY + 28, BX1 + BW, GY + 28, HI))
_b34.append(t((BX1 + BX2 + BW) / 2, GY + 40, "D（凝結）", GRAY, 10))
_b34.append('<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="1.8" marker-end="url(#ar34)"/>' % (
    BX3, GY + 12, BX2 + BW, GY + 12, HI))
_b34.append(t((BX2 + BX3 + BW) / 2, GY + 6, "C（ゆうかい）", GRAY, 10))
_b34.append('<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="1.8" marker-end="url(#ar34)"/>' % (
    BX2 + BW, GY + 28, BX3, GY + 28, HI))
_b34.append(t((BX2 + BX3 + BW) / 2, GY + 40, "E（ぎょう固）", GRAY, 10))
_b34.append('<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="1.8" marker-end="url(#ar34)"/>' % (
    BX1 + BW / 2, GY + BH + 20, BX3 + BW / 2, GY + BH + 20, HI))
_b34.append(t((BX1 + BX3) / 2 + BW / 2, GY + BH + 34, "F（しょうか）", GRAY, 10))
FIGS["HG-2834"] = svg("0 0 430 170", "".join(_b34 + [
    t(215, 162, "水の状態変化。矢印A〜Fはあたためたとき／冷やしたときの変化", GRAY, 11),
]))

# ══ 第598回 大問4（HG-2835）氷の加熱グラフ ═══════════════════════════
_b35 = heat_graph(60, [0, 8, 72, 136, 152], [-20, 0, 0, 80, 100], ["-20", "0", "", "あ", "100"])
FIGS["HG-2835"] = svg("0 0 360 240", "".join(_b35 + [
    t(160, 232, "−20℃の氷100gを一定の熱量で加熱したときの温度変化", GRAY, 11),
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
