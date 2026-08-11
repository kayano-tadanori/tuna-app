# -*- coding: utf-8 -*-
"""学年4の残り理科のうち、2023年度4年公開学力テスト理科の12本
   （第599〜610回・HG-2836〜2847）を、PDFの実物を見て原簿に入れる。

★根拠：G:\\マイドライブ\\浜問題\\公開学力テスト\\2023年度 4年公開テスト理科.pdf
  （43ページ）を140dpiで出して目視。ページ→回の対応は原簿の
  「# 🧪 2023年度 4年 公開理科」セクションに既にある表を使った。
  電池・豆電球・台ばかりの描き方は必ず[[feedback_denchi_kigou_sahou]]の作法
  （battery2でっぱり・bulbの○×・配線が電池を貫通しない・scaleのダイヤル）に従う。

実物で確かめたページ対応：
  HG-2836 … p3。[図1]太陽の弧(A/B/あ/い/う)／[図2]十字(C上/D左)+上向き3本のかげ(え/お/か)
  HG-2837 … p6。[図1]N極から鉄くぎ2本(A/B)／[図2]方位じしん+鉄くぎ(ア/イ)／
            [図3]ばねばかり+P+近づけるQ／[図4]2本の磁石P・Q+あ
  HG-2838 … p10。レンズ→しょう点+両わきの直進光、A/B/Cの3破線
  HG-2839 … p14。B-電池-A(上)、A-豆電球あ-D(下)、D-豆電球い-E(斜め)、C・Fは孤立
  HG-2840 … p17。[図1]縦置き磁石(N上S下)+ぬいばり(S極でこする)／[図2]2本の磁石が
            近づく(A・B)／[図3]縦磁石(S上N下)+近づける+じしゃくC+台ばかり
  HG-2841 … p25。レンズ→しょう点+表(5,8,12,14cm / 13.5,12,10,9cm)
  HG-2842 … p29。9たん子。A-電池-D／D-電池-E／C-電池-E(斜め)／E-電池-H／H-電池-I／
            B・F・Gは孤立
  HG-2843 … p21。5たん子バス線。A(電池)・B(直結)・C(電池)・D(電池,逆)・E(電池)
  HG-2844 … p32。[図1]ゴムひもA・B単体／[図2]A+B直列+20g(25cm+36cm)／
            [図3]A+B直列(合計70cm)
  HG-2845 … p35。9たん子。A・B電池が合流→バス→C・D直結→E(導線でDと接続)、
            H・Iは電池つきの枝、F・Gはバスの両はし
  HG-2846 … p39。[図1]金ぞく板①正方形②U字③蛇行型／[図2]ビーカー+×
  HG-2847 … p43。氷の加熱グラフ(0,2,18,24,38分 / -20,B,C,P,A)

使い方: python scripts/genbo_svg_koukai4_group5.py [--write]
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


def battery2(x1, y1, x2, y2, plus_end=2, body=22, thick=14, bump=6):
    """(x1,y1)-(x2,y2) の間に、＋側にでっぱりのある電池を置く（plus_end=1なら1側が＋）"""
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


def bulb(cx, cy, r=9):
    return [circ(cx, cy, r, LINE, 1.6),
            ln(cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55, LINE, 1.3),
            ln(cx - r * 0.55, cy + r * 0.55, cx + r * 0.55, cy - r * 0.55, LINE, 1.3)]


def bulb_between(x1, y1, x2, y2, r=9):
    L = math.hypot(x2 - x1, y2 - y1) or 1
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    out = [ln(x1, y1, mx - ux * r, my - uy * r, LINE, 1.8),
           ln(mx + ux * r, my + uy * r, x2, y2, LINE, 1.8)]
    out += bulb(mx, my)
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


def rubber(cx, y0, h, label):
    return ['<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="6"/>' % (
        r1(cx - 26), r1(y0), r1(cx + 26), r1(y0), GRAY),
        ln(cx, y0, cx, y0 + h, LINE, 2.2), circ(cx, y0 + h + 12, 11, LINE, 2),
        t(cx, y0 + h + 34, label, GRAY, 10)]


def table_row(label, vals, ox, oy, cw=42, ch=24, lw=110):
    out = [rect(ox, oy, lw, ch, LINE, 1.3), t(ox + lw / 2, oy + 17, label, HI, 10)]
    for c, v in enumerate(vals):
        out.append(rect(ox + lw + c * cw, oy, cw, ch, LINE, 1.1))
        out.append(t(ox + lw + c * cw + cw / 2, oy + 17, str(v), TX, 11))
    return out


def heat_graph(cx0, xs, ys, ylabels, xh=180, yh=170):
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


def lens_cone(ox, oy, w, h, fx):
    out = []
    for frac in (0, 0.25, 0.5, 0.75, 1):
        y = oy + h * frac
        out += [ln(ox - 30, y, ox, y, TX, 1.6), ln(ox, y, fx, oy + h / 2, LINE, 1.6)]
    out.append('<ellipse cx="%s" cy="%s" rx="8" ry="%s" fill="none" stroke="%s" stroke-width="2"/>' % (
        r1(ox), r1(oy + h / 2), r1(h / 2), LINE))
    out.append(poly([(ox, oy), (fx, oy + h / 2), (ox, oy + h)], "none", 0, "rgba(154,163,192,0.3)"))
    out.append(dot(fx, oy + h / 2, 3, TX))
    return out


FIGS = {}

# ══ 第599回 大問3（HG-2836）太陽の弧＋十字のかげ（上向き3本） ═══════════════
_pts36 = []
for i in range(9):
    frac = i / 8
    ang = math.pi * frac
    x = 40 + 160 * frac
    y = 100 - 70 * math.sin(ang)
    _pts36.append((x, y))
_b36 = [pline(_pts36, GRAY, 1.4, "3 2")]
for x, y in _pts36:
    _b36.append(circ(x, y, 4, LINE, 1.4))
_b36 += [ln(20, 100, 220, 100, LINE, 2), t(40, 118, "A", TX, 12), t(120, 118, "B", TX, 12), t(200, 118, "太陽", GRAY, 10)]
_b36.append(t(120, 190, "[図1]太陽の動き", GRAY, 11))
EX36, EY36 = 320, 135
_b36 += [ln(EX36, EY36 - 45, EX36, EY36 + 45, LINE, 1.4), ln(EX36 - 60, EY36, EX36 + 60, EY36, LINE, 1.4)]
_b36 += [t(EX36 + 14, EY36 - 45, "C", TX, 12, "start"), t(EX36 - 74, EY36 + 4, "D", TX, 12, "end")]
for ang_deg in (135, 90, 45):
    a = math.radians(ang_deg)
    _b36.append(ln(EX36, EY36, EX36 + 55 * math.cos(a), EY36 - 55 * math.sin(a), HI, 2.4))
_b36 += [t(EX36 - 55, EY36 - 32, "え", HI, 11), t(EX36, EY36 - 62, "お", HI, 11), t(EX36 + 55, EY36 - 32, "か", HI, 11)]
_b36.append(t(320, 190, "[図2]かげ（上向き）", GRAY, 11))
FIGS["HG-2836"] = svg("0 0 420 200", "".join(_b36))

# ══ 第600回 大問3（HG-2837）鉄くぎ2本／方位じしん／ばねばかり／2本の磁石 ═════
_b37 = []
_b37 += magnet(20, 15, 70, 18, n_left=False)
for i, lab in enumerate(["A", "B"]):
    y0 = 33 + i * 20
    _b37.append(poly([(55, y0), (61, y0 + 16), (49, y0 + 16)], LINE, 1.4))
    _b37.append(t(66, y0 + 12, lab, TX, 10, "start"))
_b37 += [t(55, 5, "[図1]", GRAY, 10)]
_b37 += [circ(180, 45, 22, LINE, 1.6), t(180, 40, "N", HI, 10), t(180, 60, "S", TX, 10)]
_b37 += [ln(180, 22, 202, 8, TX, 1.8), t(206, 6, "A(鉄くぎ)", TX, 9, "start")]
_b37.append(defs_arrow("ar37a", HI))
_b37.append('<path d="M195,45 L215,45" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar37a)"/>' % HI)
_b37 += [t(160, 5, "[図2]", GRAY, 10)]
_b37 += [rect(268, 15, 20, 28, LINE, 1.6), ln(278, 43, 278, 58, LINE, 1.6)]
_b37 += magnet(263, 58, 24, 40, n_left=True, vertical=True)  # ぼうじしゃくP（上S下N）
_b37 += [t(300, 40, "ばねばかり", GRAY, 9), t(278, 5, "[図3]", GRAY, 10)]
_b37.append(defs_arrow("ar37b", HI))
_b37.append('<path d="M275,138 L275,102" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar37b)"/>' % HI)
_b37 += magnet(263, 140, 24, 40, n_left=True, vertical=True)  # ぼうじしゃくQ（上S下N）を下から近づける
_b37 += [t(240, 160, "Q", TX, 10, "end")]
_b37 += magnet(20, 150, 90, 18, n_left=True)
_b37 += magnet(20, 195, 90, 18, n_left=False)
_b37 += [circ(65, 175, 12, LINE, 1.4), t(65, 172, "あ", TX, 10)]
_b37 += [t(65, 138, "[図4]P・Q", GRAY, 9)]
FIGS["HG-2837"] = svg("0 0 400 245", "".join(_b37 + [
    t(200, 238, "鉄くぎ2本／方位じしん／ばねばかり／2本の棒磁石P・Q", GRAY, 11),
]))

# ══ 第601回 大問4（HG-2838）レンズ→しょう点＋両わきの直進光 ══════════════
LX8, LY8, LH8, FX8 = 90, 30, 120, 300
_b38 = lens_cone(LX8, LY8, 90, LH8, FX8)
_b38 += [ln(30, LY8, 30, LY8 + LH8, TX, 1.6), ln(30, LY8, 30, LY8 - 15, TX, 1.6, extra=""),
          ln(FX8 + 30, LY8, FX8 + 30, LY8 + LH8, TX, 1.6)]
for i in range(5):
    y = LY8 + LH8 * i / 4
    _b38 += [ln(10, y, 30, y, TX, 1.4), ln(FX8 + 30, y, FX8 + 50, y, TX, 1.4)]
_b38 += [t(15, LY8 - 18, "虫めがねを", GRAY, 8, "start"), t(15, LY8 - 8, "通らなかった光", GRAY, 8, "start")]
for i, lab in enumerate(["A", "B", "C"]):
    x = 150 + i * 40
    _b38 += [ln(x, LY8 - 10, x, LY8 + LH8 + 10, GRAY, 1.2, "3 2"), t(x, LY8 - 16, lab, HI, 12)]
FIGS["HG-2838"] = svg("0 0 420 200", "".join(_b38 + [
    t(210, 190, "とつレンズを通った日光がしょう点に集まる。A〜Cの位置にスクリーンを置く", GRAY, 11),
]))

# ══ 第602回 大問4（HG-2839）B-電池-A、A-豆電球あ-D、D-豆電球い-E、C・Fは孤立 ══
PA, PB, PC, PD, PE, PF = (150, 30), (30, 60), (30, 190), (150, 190), (280, 220), (280, 60)
_b39 = battery2(*PB, *PA, plus_end=2)  # かん電池
_b39 += bulb_between(*PA, *PD)
_b39 += bulb_between(*PD, *PE)
for k, (x, y) in {"A": PA, "B": PB, "C": PC, "D": PD, "E": PE, "F": PF}.items():
    _b39 += [dot(x, y, 4.5, HI if k in ("C", "F") else TX),
              t(x, y - 12 if k not in ("D", "E") else y + 18, k, HI, 13)]
FIGS["HG-2839"] = svg("0 0 400 250", "".join(_b39 + [
    t(200, 244, "B-電池-A、A-豆電球あ-D、D-豆電球い-E。C・Fはどこにもつながっていない", GRAY, 11),
]))

# ══ 第603回 大問4（HG-2840）縦置き磁石+ぬいばり／2磁石接近／台ばかり ═══════
_b40 = magnet(20, 20, 26, 40, n_left=False, vertical=True)
_b40 += [ln(0, 68, 100, 68, TX, 1.8), t(-4, 72, "P", TX, 11, "end"), t(104, 72, "Q", TX, 11, "start")]
_b40.append(defs_arrow("ar40a", HI))
_b40.append('<path d="M90,58 L10,58" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar40a)"/>' % HI)
_b40 += [t(33, 8, "[図1]", GRAY, 10)]
_b40 += magnet(150, 30, 70, 18, n_left=True)
_b40 += magnet(260, 30, 70, 18, n_left=False)
_b40.append(defs_arrow("ar40b", HI))
_b40.append('<path d="M225,55 L245,55" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar40b)"/>' % HI)
_b40 += [t(225, 20, "近づける", GRAY, 9), t(220, 8, "[図2]A・B", GRAY, 10)]
_b40 += magnet(20, 130, 26, 40, n_left=True, vertical=True)
_b40.append(defs_arrow("ar40c", HI))
_b40.append('<path d="M33,175 L33,195" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar40c)"/>' % HI)
_b40 += ['<ellipse cx="33" cy="212" rx="24" ry="9" fill="#2a3560" stroke="%s" stroke-width="1.6"/>' % LINE,
          t(33, 216, "N", HI, 11), t(33, 198, "じしゃくC", TX, 9)]
_b40 += scale(33, 262, -20)
_b40 += [t(33, 118, "[図3]", GRAY, 10)]
FIGS["HG-2840"] = svg("0 0 460 310", "".join(_b40 + [
    t(230, 302, "縦置きの磁石とぬいばり／2本の磁石が近づく／台ばかりの上のじしゃくC", GRAY, 11),
]))

# ══ 第605回 大問4（HG-2841）レンズ→しょう点＋表 ══════════════════════
_b41 = lens_cone(60, 20, 90, 100, 280)
_b41 += table_row("きょり(cm)", [5, 8, 12, 14], 20, 150, 50)
_b41 += table_row("直径(cm)", [13.5, 12, 10, 9], 20, 174, 50, 24, 100)
FIGS["HG-2841"] = svg("0 0 400 210", "".join(_b41 + [
    t(200, 202, "レンズを通った日光がしょう点に集まる。スクリーンまでのきょりと明るい円の直径", GRAY, 11),
]))

# ══ 第604回 大問4(2)（HG-2843）5たん子バス線。A電池／B直結／C電池／D電池(逆)／E電池 ═
BX43 = 200
_b43 = [ln(60, 60, 340, 60, LINE, 2.2)]
_b43 += battery2(60, 20, 60, 60, plus_end=1)
_b43 += [dot(60, 20), t(60, 10, "A", HI, 13)]
_b43 += [dot(150, 60), t(150, 78, "B", HI, 13)]
_b43 += battery2(220, 20, 220, 60, plus_end=1)
_b43 += [dot(220, 20), t(220, 10, "C", HI, 13)]
_b43 += battery2(280, 20, 280, 60, plus_end=2)
_b43 += [dot(280, 20), t(280, 10, "D", HI, 13)]
_b43 += battery2(340, 20, 340, 60, plus_end=1)
_b43 += [dot(340, 20), t(340, 10, "E", HI, 13)]
FIGS["HG-2843"] = svg("0 0 400 100", "".join(_b43 + [
    t(200, 92, "バス線。A・C・D・Eは電池つき、Bは直結", GRAY, 11),
]))

# ══ 第606回 大問4（HG-2842）9たん子。A-電池-D／D-電池-E／C-電池-E(斜め)／E-電池-H／H-電池-I ══
P42 = {"A": (60, 20), "B": (170, 20), "C": (280, 20), "D": (60, 100), "E": (170, 100),
       "F": (280, 100), "G": (60, 190), "H": (170, 190), "I": (280, 190)}
_b42 = battery2(*P42["A"], *P42["D"], plus_end=1)
_b42 += battery2(*P42["D"], *P42["E"], plus_end=1)
_b42 += battery2(*P42["C"], *P42["E"], plus_end=1)
_b42 += battery2(*P42["E"], *P42["H"], plus_end=1)
_b42 += battery2(*P42["H"], *P42["I"], plus_end=1)
for k, (x, y) in P42.items():
    _b42 += [dot(x, y, 4.5, HI if k in ("B", "F", "G") else TX), t(x, y - 12, k, HI, 13)]
FIGS["HG-2842"] = svg("0 0 340 210", "".join(_b42 + [
    t(170, 202, "9つのたん子A〜I。B・F・Gはどこにもつながっていない", GRAY, 11),
]))

# ══ 第607回 大問4（HG-2844）ゴムひもA・B（単体／直列2種） ══════════════════
_b44 = rubber(50, 20, 50, "[図1]ゴムひもA")
_b44 += rubber(150, 20, 60, "ゴムひもB")
X2, Y2 = 300, 20
_b44 += ['<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="6"/>' % (X2 - 26, Y2, X2 + 26, Y2, GRAY),
          ln(X2, Y2, X2, Y2 + 25, LINE, 2.2), t(X2 - 30, Y2 + 14, "A", TX, 10, "end"), t(X2 + 30, Y2 + 14, "25cm", TX, 10, "start"),
          dot(X2, Y2 + 25, 2.5, GRAY),
          ln(X2, Y2 + 25, X2, Y2 + 61, LINE, 2.2), t(X2 - 30, Y2 + 43, "B", TX, 10, "end"), t(X2 + 30, Y2 + 43, "36cm", TX, 10, "start"),
          circ(X2, Y2 + 75, 11, LINE, 2), t(X2, Y2 + 100, "20g", TX, 10), t(X2, Y2 + 122, "[図2]", GRAY, 10)]
X3 = 420
_b44 += ['<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="6"/>' % (X3 - 26, Y2, X3 + 26, Y2, GRAY),
          ln(X3, Y2, X3, Y2 + 35, LINE, 2.2), t(X3 - 30, Y2 + 18, "A", TX, 10, "end"),
          dot(X3, Y2 + 35, 2.5, GRAY),
          ln(X3, Y2 + 35, X3, Y2 + 78, LINE, 2.2), t(X3 - 30, Y2 + 57, "B", TX, 10, "end"),
          t(X3 + 30, Y2 + 40, "70cm", TX, 10, "start"),
          circ(X3, Y2 + 92, 11, LINE, 2), t(X3, Y2 + 122, "[図3]", GRAY, 10)]
FIGS["HG-2844"] = svg("0 0 480 155", "".join(_b44 + [
    t(240, 148, "ゴムひもA・Bを直列につないでおもりをつるす", GRAY, 11),
]))

# ══ 第608回 大問4(2)（HG-2845）9たん子。A・B電池合流→バス→C・D→E(導線)、H・I電池 ══
BX45 = 200
_b45 = [ln(BX45, 60, BX45 + 140, 60, LINE, 2.2)]
_b45 += battery2(BX45, 30, BX45, 60, plus_end=1)
_b45 += [dot(BX45, 30), t(BX45, 20, "A", HI, 13)]
_b45 += battery2(BX45 + 60, 30, BX45 + 60, 60, plus_end=1)
_b45 += [dot(BX45 + 60, 30), t(BX45 + 60, 20, "B", HI, 13)]
_b45 += [dot(BX45, 60), t(BX45, 78, "F", HI, 13)]
_b45 += [dot(BX45 + 140, 60), t(BX45 + 140, 78, "G", HI, 13)]
_b45 += [dot(BX45 + 40, 60)]
_b45 += battery2(BX45 + 40, 60, BX45 + 40, 130, plus_end=1)
_b45 += [dot(BX45 + 40, 130), t(BX45 + 40, 148, "H", HI, 13)]
_b45 += battery2(BX45 + 100, 60, BX45 + 100, 130, plus_end=1)
_b45 += [dot(BX45 + 100, 60), dot(BX45 + 100, 130), t(BX45 + 100, 148, "I", HI, 13)]
_b45 += [ln(BX45 + 100, 60, BX45 + 100, 35, LINE, 1.6), dot(BX45 + 100, 35), t(BX45 + 100, 25, "E", HI, 13)]
FIGS["HG-2845"] = svg("0 0 420 170", "".join(_b45 + [
    t(210, 162, "A・Bは電池2個が合流してバスへ。F・G・Eは直結。H・Iは電池つきの枝", GRAY, 11),
]))

# ══ 第609回 大問4（HG-2846）金ぞく板①正方形②U字③蛇行型／[図2]ビーカー ═══
_b46 = [rect(20, 20, 90, 90, LINE, 1.8),
         t(28, 34, "A", TX, 12), t(102, 34, "×", HI, 13), t(28, 104, "B", TX, 12), t(102, 104, "C", TX, 12),
         t(65, 130, "①", GRAY, 12)]
_uverts = [(150, 20), (240, 20), (240, 110), (210, 110), (210, 50), (180, 50), (180, 110), (150, 110)]
_b46 += [poly(_uverts, LINE, 1.8),
          t(158, 34, "A", TX, 12), t(232, 34, "B", TX, 12), t(158, 104, "C", TX, 12), t(232, 104, "×", HI, 13),
          t(195, 130, "②", GRAY, 12)]
_zverts = [(280, 20), (380, 20), (380, 45), (350, 45), (350, 60), (380, 60), (380, 85), (350, 85), (350, 110), (280, 110)]
_b46 += [pline(_zverts, LINE, 1.8, None),
          ln(350, 60, 320, 60, LINE, 1.8), ln(320, 60, 320, 85, LINE, 1.8), ln(320, 85, 280, 85, LINE, 1.8)]
_b46 += [t(288, 34, "A", TX, 12), t(372, 34, "B", TX, 12), t(288, 78, "C", TX, 12), t(288, 104, "×", HI, 13),
          t(330, 130, "③", GRAY, 12)]
_b46 += [t(200, 12, "示温インクをぬった金ぞく板（×を熱する）", GRAY, 11)]
_b46 += [rect(300, 165, 100, 60, LINE, 1.8), t(285, 195, "水", TX, 12, "end"), dot(365, 175, 3.5, HI), t(378, 175, "×", HI, 12, "start"),
          t(350, 240, "[図2]", GRAY, 11)]
FIGS["HG-2846"] = svg("0 0 460 260", "".join(_b46 + [
    t(230, 252, "金ぞく板①正方形②U字③蛇行型（×を加熱）と、水を入れたビーカー（×を加熱）", GRAY, 11),
]))

# ══ 第610回 大問4（HG-2847）氷の加熱グラフ ═══════════════════════════
_b47 = heat_graph(60, [0, 2, 18, 24, 38], [-20, 0, 0, 30, 100], ["-20", "B", "C", "P", "A"])
FIGS["HG-2847"] = svg("0 0 360 240", "".join(_b47 + [
    t(180, 232, "−20℃の氷100gを一定の熱量で加熱したときの温度変化", GRAY, 11),
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
