# -*- coding: utf-8 -*-
"""学年5の公開学力テスト・灘中チャレンジ34本のうち、2024年度理科8本を、
   PDFの実物を見て原簿に入れる。

★根拠：G:\\マイドライブ\\浜問題\\公開学力テスト\\2024年度 4年 公開テスト理科.pdf
  （ファイル名は「4年」だが中身は全ページ小5）を180〜200dpiで出して目視。
  ページ対応は原簿の`# 🧪 2024年度 小5 公開理科`セクションに既出：
  611回=p1-3／612回=p4-7／614回=p12-15／616回=p16-19／615回=p20-21／
  617回=p22-25／618回=p26-29／622回=p40-43（616回は615回より前のページにある）

実物で確かめた図の内容：
  HG-2848 … 611回大問4。[図1]横から見た薄い板5枚（ア=波状／イ=少し短い直線／
            ウ=下向きの弧／エ=上向きの弧／オ=太い紡錘形）。[図2]中央に穴のある
            アルミ円盤(白)と鉄円盤(黒)、それぞれ直径の点線矢印。
  HG-2849 … 612回大問4。表＋丸底フラスコ6本（[図6]水上のゼリーの動き・
            [図7]ガラス管内の水位、それぞれ水の量が少/中/多の3本）。
  HG-2851 … 614回大問4。加熱グラフ：0分-20℃→1分でB(0℃)→9分まで横ばい→
            11分で20℃→17分で80℃→19分でA(100℃)→その後水平。
  HG-2852 … 616回大問2(3)。[図3]端子a(左上)-弧状導線-端子b(左下)のバス線上の
            3点から右へ、電池を介してc・d・e(=o)へ分岐。[図4]豆電球f-g。
            （実物で電池の＋向きも確認：バス側/d側/b側/e側、原簿の作問メモどおり）
  HG-2853 … 617回大問4。[図1]虫めがねの断面(楕円)+距離A+紙+直径B。
            [図2]暗箱の中を光が進む砂時計形（レンズ→1点に集まる→また広がる）。表。
  HG-2854 … 615回大問4(2)。[図2]9端子：A-[電池]-B、B-[豆電球]-C、B-[電池]-E(下)、
            D-[豆電球]-G(斜め)、H-[豆電球]-I、F-[電池]-I(下)。選択肢ア〜キは
            7種の回路（豆電球1/2個×電池1/2個の直列/並列の組み合わせ）。
  HG-2855 … 618回大問4。ろ過の絵4枚（スタンド・ろうと・ビーカー、注ぎ方の違い）。
            結晶の絵3枚（立方体・八面体・六角板状）。表。
  HG-2859 … 622回大問4。気体の集め方3枚（水上置換法=水槽+集気びん、
            上方置換法=フラスコ逆さ、下方置換法=フラスコ正立）。表。

使い方: python scripts/genbo_svg_rika5_koukai2024_group1.py [--write]
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


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), stroke, w, d)


def rect(x, y, w, h, stroke=LINE, sw=2, fill="none"):
    return '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(x), r1(y), r1(w), r1(h), fill, stroke, sw)


def circ(cx, cy, r, stroke=LINE, w=2, fill="none"):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(cx), r1(cy), r1(r), fill, stroke, w)


def pts(seq):
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), fill, stroke, w, d)


def polyline(seq, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polyline points="%s" fill="none" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), stroke, w, d)


def path(d, stroke=LINE, w=2, fill="none"):
    return '<path d="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (d, fill, stroke, w)


def unit(dx, dy):
    l = math.hypot(dx, dy)
    return (dx / l, dy / l)


def battery2(x1, y1, x2, y2, plus_end=1, gap=18, stroke=TX):
    """乾電池の回路記号（feedback_denchi_kigou_sahou準拠）。
    plus_end=1ならx1側が＋極（長い薄線＋外向きの小さいでっぱり）、x2側が－極（短い太線）"""
    ux, uy = unit(x2 - x1, y2 - y1)
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    px, py = -uy, ux
    half = gap / 2
    e1 = (mx - ux * half, my - uy * half)
    e2 = (mx + ux * half, my + uy * half)
    out = [ln(x1, y1, e1[0], e1[1], stroke, 1.8), ln(e2[0], e2[1], x2, y2, stroke, 1.8)]
    plus_pt, minus_pt = (e1, e2) if plus_end == 1 else (e2, e1)
    plus_out_dir = -1 if plus_pt is e1 else 1
    Lp, Lm, tab = 15, 8, 5
    out.append(ln(plus_pt[0] - px * Lp / 2, plus_pt[1] - py * Lp / 2,
                   plus_pt[0] + px * Lp / 2, plus_pt[1] + py * Lp / 2, stroke, 1.8))
    tx_, ty_ = plus_pt[0] + ux * plus_out_dir * tab, plus_pt[1] + uy * plus_out_dir * tab
    out.append(ln(tx_ - px * 2.5, ty_ - py * 2.5, tx_ + px * 2.5, ty_ + py * 2.5, stroke, 1.8))
    out.append(ln(plus_pt[0], plus_pt[1], tx_, ty_, stroke, 1.8))
    out.append(ln(minus_pt[0] - px * Lm / 2, minus_pt[1] - py * Lm / 2,
                   minus_pt[0] + px * Lm / 2, minus_pt[1] + py * Lm / 2, stroke, 3.6))
    return "".join(out)


def bulb(cx, cy, r=10, stroke=TX):
    a = r * 0.7
    return (circ(cx, cy, r, stroke, 1.8) +
            ln(cx - a, cy - a, cx + a, cy + a, stroke, 1.6) +
            ln(cx - a, cy + a, cx + a, cy - a, stroke, 1.6))


def bulb_between(x1, y1, x2, y2, r=10, stroke=TX):
    ux, uy = unit(x2 - x1, y2 - y1)
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    return (ln(x1, y1, mx - ux * r, my - uy * r, stroke, 1.8) +
            ln(mx + ux * r, my + uy * r, x2, y2, stroke, 1.8) +
            bulb(mx, my, r, stroke))


FIGS = {}

# ══ HG-2848：バイメタル板5枚（横から見た形）＋穴あき円盤2つ ══════════
def bar_shape(cx, y0, kind):
    w = 70
    if kind == "wave":
        d = "M%s,%s Q%s,%s %s,%s Q%s,%s %s,%s" % (
            cx - w / 2, y0, cx - w / 4, y0 - 8, cx, y0, cx + w / 4, y0 + 8, cx + w / 2, y0)
        return path(d, TX, 2.2)
    if kind == "short":
        return ln(cx - w / 2 + 6, y0, cx + w / 2 - 6, y0, TX, 2.2)
    if kind == "down":
        d = "M%s,%s Q%s,%s %s,%s" % (cx - w / 2, y0 - 6, cx, y0 + 14, cx + w / 2, y0 - 6)
        return path(d, TX, 2.2)
    if kind == "up":
        d = "M%s,%s Q%s,%s %s,%s" % (cx - w / 2, y0 + 6, cx, y0 - 14, cx + w / 2, y0 + 6)
        return path(d, TX, 2.2)
    if kind == "spindle":
        return poly([(cx - w / 2, y0), (cx, y0 - 7), (cx + w / 2, y0), (cx, y0 + 7)], "none", 0, TX)


_b2848a = []
kinds = ["wave", "short", "down", "up", "spindle"]
labels = ["ア", "イ", "ウ", "エ", "オ"]
for i, (k, lb) in enumerate(zip(kinds, labels)):
    cx = 60 + i * 110
    _b2848a.append(bar_shape(cx, 40, k))
    _b2848a.append(t(cx, 15, lb, TX, 14))
FIGS["HG-2848-1"] = svg("0 0 620 70", "".join(_b2848a))

r_out, r_in = 60, 30
_b2848b = [
    circ(80, 80, r_out, TX, 1.8), circ(80, 80, r_in, TX, 1.4, "#1a2340"),
    ln(80, 80, 80 + r_in, 80, HI, 1, "3,2"), t(80 + r_in + 30, 76, "穴の直径", GRAY, 11, "start"),
    t(80, 8, "アルミニウムの円盤", GRAY, 11),
    '<circle cx="%s" cy="80" r="%s" fill="%s" stroke="%s" stroke-width="1.8"/>' % (300, r_out, TX, TX),
    circ(300, 80, r_in, "#1a2340", 1.4, "#1a2340"),
    ln(300, 80, 300 + r_in, 80, HI, 1, "3,2"), t(300 + r_in + 30, 76, "穴の直径", GRAY, 11, "start"),
    t(300, 8, "鉄の円盤", GRAY, 11),
]
FIGS["HG-2848-2"] = svg("0 0 460 165", "".join(_b2848b))

FIGS["HG-2848"] = svg("0 0 640 260", "".join([
    '<g transform="translate(10,0)">%s</g>' % FIGS["HG-2848-1"].split(">", 1)[1][:-6],
    '<g transform="translate(80,80)">%s</g>' % FIGS["HG-2848-2"].split(">", 1)[1][:-6],
]))
for k in ("HG-2848-1", "HG-2848-2"):
    del FIGS[k]

# ══ HG-2849：表＋丸底フラスコ6本（水と空気の量ちがい） ══════════════
def flask(x, y, air_frac, mode):
    """air_frac: 空気の高さ割合（0=水だけ、1=フラスコ全部空気）。mode: 'jelly' or 'tube'"""
    R = 34
    out = [
        '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="1.8"/>' % (r1(x), r1(y), R, TX),
        ln(x - 8, y - R - 4, x - 8, y - R - 30, TX, 1.8),
        ln(x + 8, y - R - 4, x + 8, y - R - 30, TX, 1.8),
        rect(x - 12, y - R - 8, 24, 8, TX, 1.6),
    ]
    water_top_y = y + R - (2 * R) * air_frac
    clip_id = "clip%s" % int(x * 10 + y)
    out.append('<clipPath id="%s"><circle cx="%s" cy="%s" r="%s"/></clipPath>' % (clip_id, r1(x), r1(y), R))
    out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="1.2" '
                'clip-path="url(#%s)"/>' % (r1(x - R), r1(water_top_y), r1(2 * R), r1(R * 2), "#6a7aa8", clip_id))
    for i in range(-3, 4):
        xx = x + i * 10
        out.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="1" clip-path="url(#%s)"/>' %
                    (r1(xx - 12), r1(water_top_y + 12), r1(xx), r1(water_top_y), "#6a7aa8", clip_id))
    if mode == "jelly":
        jelly_y = y - R - 4 - 22 * air_frac - 4
        out.append(rect(x - 9, jelly_y, 18, 6, TX, 0, TX))
        out.append(ln(x + 12, jelly_y + 3, x + 26, jelly_y + 3, HI, 1))
        out.append(t(x + 30, jelly_y + 7, "ゼリー", GRAY, 10, "start"))
    else:
        out.append(ln(x - 8, water_top_y - 6, x - 8, y - R - 28, TX, 1.4))
    out.append(t(x - R - 6, water_top_y - 6, "空気", GRAY, 10, "end"))
    out.append(t(x - R - 6, y + R - 6, "水", GRAY, 10, "end"))
    return "".join(out)


def flask_row(mode, fracs):
    out = []
    for i, fr in enumerate(fracs):
        out.append('<g transform="translate(%s,0)">%s</g>' % (i * 130, flask(70, 90, fr, mode)))
        out.append(t(70 + i * 130, 10, "アイウ"[i], GRAY, 13))
    return "".join(out)


tbl2849 = [
    rect(0, 0, 400, 60, GRAY, 1.4),
]
temps = ["0", "20", "40", "60"]
vols = ["27", "29", "31", "33"]
for i in range(4):
    xx = i * 100
    tbl2849.append(ln(xx, 0, xx, 60, "#2a3560", 1))
    tbl2849.append(t(xx + 50, 22, temps[i], TX, 13))
    tbl2849.append(t(xx + 50, 48, vols[i], TX, 13))
tbl2849.append(ln(400, 0, 400, 60, "#2a3560", 1))
tbl2849.append(ln(0, 30, 400, 30, "#2a3560", 1))
tbl2849 += [t(-16, 22, "温度(℃)", GRAY, 11, "end"), t(-16, 48, "体積(L)", GRAY, 11, "end")]
FIGS["HG-2849-table"] = svg("-90 -10 510 80", "".join(tbl2849))

FIGS["HG-2849-6"] = svg("0 0 400 130", flask_row("jelly", [0.55, 0.4, 0.25]) + t(200, 125, "[図6]", GRAY, 12))
FIGS["HG-2849-7"] = svg("0 0 400 130", flask_row("tube", [0.55, 0.4, 0.25]) + t(200, 125, "[図7]", GRAY, 12))

FIGS["HG-2849"] = svg("0 0 900 380", "".join([
    '<g transform="translate(220,10)">%s</g>' % FIGS["HG-2849-table"].split(">", 1)[1][:-6],
    '<g transform="translate(220,110)">%s</g>' % FIGS["HG-2849-6"].split(">", 1)[1][:-6],
    '<g transform="translate(220,250)">%s</g>' % FIGS["HG-2849-7"].split(">", 1)[1][:-6],
]))
for k in ("HG-2849-table", "HG-2849-6", "HG-2849-7"):
    del FIGS[k]

# ══ HG-2851：加熱グラフ（氷→水→沸騰） ═══════════════════════════════
gx0, gy0, gw, gh = 70, 20, 340, 240
_b2851 = [ln(gx0, gy0, gx0, gy0 + gh, GRAY, 1.4), ln(gx0, gy0 + gh, gx0 + gw, gy0 + gh, GRAY, 1.4)]


def yv(temp):
    return gy0 + gh - gh * (temp + 20) / 120


def xv(minute):
    return gx0 + gw * minute / 20


pts_line = [(0, -20), (1, 0), (9, 0), (11, 20), (17, 80), (19, 100), (22, 100)]
poly_pts = [(xv(m), yv(v)) for m, v in pts_line]
_b2851.append(polyline(poly_pts, TX, 2))
for m, lbl in ((1, "1"), (11, "11"), (17, "17")):
    _b2851.append(ln(xv(m), yv(0) if m != 11 and m != 17 else gy0 + gh, xv(m), gy0 + gh, "#2a3560", 1, "3,2"))
    _b2851.append(t(xv(m), gy0 + gh + 18, lbl, GRAY, 11))
_b2851.append(t(gx0, gy0 + gh + 18, "0", GRAY, 11))
for temp, lbl in ((0, "B"), (20, "20"), (80, "80"), (100, "A")):
    _b2851.append(ln(gx0, yv(temp), gx0 + gw * 0.85 if temp in (20, 80) else gx0, yv(temp), "#2a3560", 1, "3,2"))
    _b2851.append(t(gx0 - 10, yv(temp) + 4, lbl, GRAY, 11, "end"))
_b2851.append(t(gx0 - 10, yv(-20) + 4, "−20", GRAY, 11, "end"))
_b2851 += [t(gx0 - 46, gy0 + gh / 2, "温度(℃)", GRAY, 12, "middle", ' transform="rotate(-90 %s %s)"' % (r1(gx0 - 46), r1(gy0 + gh / 2))),
           t(gx0 + gw / 2, gy0 + gh + 40, "時間(分)", GRAY, 12)]
FIGS["HG-2851"] = svg("0 0 460 320", "".join(_b2851) + t(gx0 + gw / 2, 305, "[図]", GRAY, 12))

# ══ HG-2852：電池5個・端子a〜e（バス線から3分岐） ═══════════════════
ax, ay, bx, by = 20, 20, 20, 140
_b2852 = [
    path("M%s,%s Q%s,%s %s,%s" % (ax, ay, ax - 30, (ay + by) / 2, bx, by), TX, 2),
    circ(ax, ay, 3, TX, 1.4, TX), t(ax - 12, ay + 4, "a", TX, 13, "end"),
    circ(bx, by, 3, TX, 1.4, TX), t(bx - 12, by + 4, "b", TX, 13, "end"),
]
branch_y = [ay + 20, (ay + by) / 2, by - 20]
c_labels = ["c", "d", "e"]
for i, (by_, lbl) in enumerate(zip(branch_y, c_labels)):
    _b2852.append(ln(ax, by_, ax + 20, by_, TX, 2))
    if i < 2:
        _b2852.append(battery2(ax + 20, by_, ax + 90, by_, plus_end=1))
        _b2852.append(ln(ax + 90, by_, ax + 130, by_, TX, 2))
        _b2852.append(circ(ax + 130, by_, 3, TX, 1.4, TX))
        _b2852.append(t(ax + 140, by_ + 4, lbl, TX, 13, "start"))
    else:
        _b2852.append(battery2(ax + 20, by_, ax + 60, by_, plus_end=2))
        _b2852.append(battery2(ax + 60, by_, ax + 100, by_, plus_end=2))
        _b2852.append(ln(ax + 100, by_, ax + 130, by_, TX, 2))
        _b2852.append(circ(ax + 130, by_, 3, TX, 1.4, TX))
        _b2852.append(t(ax + 140, by_ + 4, lbl, TX, 13, "start"))
_b2852_svg = svg("-30 0 220 160", "".join(_b2852) + t(80, 152, "[図3]", GRAY, 12))
FIGS["HG-2852-3"] = _b2852_svg

_b2852_4 = [ln(0, 20, 60, 20, TX, 2), bulb_between(60, 20, 100, 20), t(0, 8, "f", TX, 13), t(100, 8, "g", TX, 13)]
FIGS["HG-2852-4"] = svg("-10 0 130 40", "".join(_b2852_4) + t(50, 36, "[図4]", GRAY, 11))

FIGS["HG-2852"] = svg("0 0 400 220", "".join([
    '<g transform="translate(20,10)">%s</g>' % FIGS["HG-2852-3"].split(">", 1)[1][:-6],
    '<g transform="translate(260,60)">%s</g>' % FIGS["HG-2852-4"].split(">", 1)[1][:-6],
]))
for k in ("HG-2852-3", "HG-2852-4"):
    del FIGS[k]

# ══ HG-2853：虫めがねの断面＋暗箱の砂時計形＋表 ══════════════════════
_b2853a = [
    '<ellipse cx="70" cy="60" rx="14" ry="34" fill="none" stroke="%s" stroke-width="1.8"/>' % TX,
    ln(0, 60, 56, 60, TX, 1.6), ln(0, 40, 0, 80, TX, 1.2),
    t(28, 30, "日光", GRAY, 11), t(0, 34, "→", TX, 12),
    ln(84, 60, 300, 60, TX, 1, "3,2"),
    t(190, 25, "虫めがねのレンズの中心", GRAY, 11),
    poly([(220, 130), (260, 100), (300, 130), (260, 145)], LINE, 1.6),
    ln(220, 130, 300, 130, HI, 1, "3,2"), t(260, 148, "直径B", HI, 11),
    ln(84, 60, 260, 100, GRAY, 1, "3,2"), t(150, 90, "距離A", GRAY, 11),
]
FIGS["HG-2853-1"] = svg("-10 0 340 170", "".join(_b2853a) + t(170, 165, "[図1]", GRAY, 12))

_b2853b = [
    rect(20, 30, 260, 80, TX, 1.8),
    poly([(20, 40), (130, 65), (20, 100)], "none", 0, "#6a7aa8"),
    poly([(130, 65), (280, 35), (280, 95)], "none", 0, "#6a7aa8"),
    circ(130, 65, 2.2, TX, 1, TX),
    ln(0, 65, 20, 65, TX, 1.6), t(-8, 55, "日光", GRAY, 10, "end"),
    t(130, 20, "光が1点に集まったところ", GRAY, 10),
    t(285, 30, "明るい部分", GRAY, 10, "start"), t(285, 100, "暗い部分", GRAY, 10, "start"),
]
FIGS["HG-2853-2"] = svg("-10 0 400 120", "".join(_b2853b) + t(150, 116, "[図2]", GRAY, 12))

tbl53 = [rect(0, 0, 500, 50, GRAY, 1.4)]
Avals = ["12", "16", "20", "24", "28", "32", "36", "△", "44", "48"]
Bvals = ["9", "7", "5", "3", "1", "1", "3", "5", "7", "9"]
for i in range(10):
    xx = i * 50
    tbl53.append(ln(xx, 0, xx, 50, "#2a3560", 0.8))
    tbl53.append(t(xx + 25, 20, Avals[i], TX, 11))
    tbl53.append(t(xx + 25, 42, Bvals[i], TX, 11))
tbl53.append(ln(500, 0, 500, 50, "#2a3560", 0.8))
tbl53.append(ln(0, 25, 500, 25, "#2a3560", 0.8))
tbl53 += [t(-14, 20, "距離A", GRAY, 10, "end"), t(-14, 42, "直径B", GRAY, 10, "end")]
FIGS["HG-2853-table"] = svg("-70 -10 590 70", "".join(tbl53))

FIGS["HG-2853"] = svg("0 0 900 400", "".join([
    '<g transform="translate(10,10)">%s</g>' % FIGS["HG-2853-1"].split(">", 1)[1][:-6],
    '<g transform="translate(400,20)">%s</g>' % FIGS["HG-2853-2"].split(">", 1)[1][:-6],
    '<g transform="translate(140,270)">%s</g>' % FIGS["HG-2853-table"].split(">", 1)[1][:-6],
]))
for k in ("HG-2853-1", "HG-2853-2", "HG-2853-table"):
    del FIGS[k]

# ══ HG-2854：9端子（A〜I）豆電球3個・電池3個 ═══════════════════════
P = {
    "A": (0, 40), "B": (140, 40), "C": (280, 40),
    "D": (0, 140), "E": (140, 100), "F": (280, 0),
    "G": (0, 190), "H": (140, 160), "I": (280, 160),
}
_b2854 = [
    ln(*P["A"], *P["B"], TX, 2), battery2(P["A"][0] + 20, P["A"][1], P["B"][0] - 20, P["B"][1], plus_end=2),
    ln(*P["B"], *P["C"], TX, 2), bulb_between(P["B"][0] + 30, P["B"][1], P["C"][0] - 30, P["C"][1]),
    ln(P["B"][0], P["B"][1], P["E"][0], P["E"][1], TX, 2),
    battery2(P["B"][0], P["B"][1] + 20, P["E"][0], P["E"][1] - 20, plus_end=1),
    path("M%s,%s L%s,%s" % (*P["D"], *P["G"]), TX, 2),
]
midDG = ((P["D"][0] + P["G"][0]) / 2, (P["D"][1] + P["G"][1]) / 2)
_b2854.append(bulb(*midDG))
_b2854.append(ln(*P["H"], *P["I"], TX, 2))
_b2854.append(bulb_between(P["H"][0] + 30, P["H"][1], P["I"][0] - 30, P["I"][1]))
_b2854.append(ln(P["F"][0], P["F"][1], P["I"][0], P["I"][1], TX, 2))
_b2854.append(battery2(P["F"][0], P["F"][1] + 20, P["I"][0], P["I"][1] - 20, plus_end=1))
for k, (x, y) in P.items():
    _b2854.append(circ(x, y, 3, TX, 1.4, TX))
    dx_ = -16 if k in ("A", "D", "G") else 16
    anc = "end" if dx_ < 0 else "start"
    _b2854.append(t(x + dx_, y + 4, k, TX, 13, anc))
FIGS["HG-2854-2"] = svg("-45 -20 380 240", "".join(_b2854))

sel_labels = [
    ("ア", 2, 1, "series"), ("イ", 1, 2, "series"), ("ウ", 2, 2, "series"),
    ("エ", 2, 2, "parallel_batt"), ("オ", 2, 1, "parallel_bulb"),
    ("カ", 1, 2, "parallel_batt"), ("キ", 2, 2, "series_parallel_batt"),
]


def mini_circuit(n_bulb, n_batt, mode):
    x0, y0, w, h = 0, 0, 90, 50
    out = [ln(x0, y0, x0 + w, y0, TX, 1.6), ln(x0, y0 + h, x0 + w, y0 + h, TX, 1.6),
           ln(x0, y0, x0, y0 + h, TX, 1.6), ln(x0 + w, y0, x0 + w, y0 + h, TX, 1.6)]
    if n_bulb == 1:
        out.append(bulb(x0 + w / 2, y0, 8))
    elif mode in ("series", "series_parallel_batt"):
        out.append(bulb(x0 + w * 0.32, y0, 8)); out.append(bulb(x0 + w * 0.68, y0, 8))
    else:
        out.append(bulb(x0 + w / 2, y0, 8))
        out.append(ln(x0 + 5, y0, x0 + 5, y0 + h, TX, 1.6)); out.append(ln(x0 + w - 5, y0, x0 + w - 5, y0 + h, TX, 1.6))
    if n_batt == 1:
        out.append(battery2(x0 + w * 0.3, y0 + h, x0 + w * 0.7, y0 + h, plus_end=1))
    elif mode in ("series", "parallel_bulb"):
        out.append(battery2(x0 + w * 0.18, y0 + h, x0 + w * 0.48, y0 + h, plus_end=1))
        out.append(battery2(x0 + w * 0.52, y0 + h, x0 + w * 0.82, y0 + h, plus_end=1))
    else:
        out.append(battery2(x0 + w * 0.3, y0 + h, x0 + w * 0.7, y0 + h, plus_end=1))
        out.append(ln(x0 + 15, y0 + h - 5, x0 + 15, y0 + h + 12, TX, 1.6))
        out.append(ln(x0 + w - 15, y0 + h - 5, x0 + w - 15, y0 + h + 12, TX, 1.6))
        out.append(ln(x0 + 15, y0 + h + 12, x0 + w - 15, y0 + h + 12, TX, 1.6))
    return "".join(out)


sel_svgs = []
for i, (lbl, nb, nc, mode) in enumerate(sel_labels):
    body = mini_circuit(nb, nc, mode)
    sel_svgs.append('<g transform="translate(%s,0)">%s%s</g>' % (
        i * 110, body, t(45, -8, lbl, HI, 13)))
FIGS["HG-2854-sel"] = svg("-10 -25 780 90", "".join(sel_svgs))

FIGS["HG-2854"] = svg("0 0 830 380", "".join([
    '<g transform="translate(55,10)">%s</g>' % FIGS["HG-2854-2"].split(">", 1)[1][:-6],
    '<g transform="translate(30,300)">%s</g>' % FIGS["HG-2854-sel"].split(">", 1)[1][:-6],
]))
for k in ("HG-2854-2", "HG-2854-sel"):
    del FIGS[k]

# ══ HG-2855：ろ過4枚＋結晶3枚＋表 ═══════════════════════════════════
def filtration(x, y, funnel_touch_wall, stir_present):
    out = [
        ln(x, y - 60, x, y + 40, GRAY, 1.6),
        ln(x - 30, y + 40, x + 60, y + 40, GRAY, 1.6),
        ln(x - 6, y - 60, x + 30, y - 60, GRAY, 1.6),
        poly([(x + 10, y - 30), (x + 40, y - 30), (x + 25, y - 5)], LINE, 1.6),
        ln(x + 25, y - 5, x + 25 if funnel_touch_wall else x + 30, y + 15, LINE, 1.4),
        circ(x + 30, y + 10, 18, LINE, 1.6),
        ln(x - 4, y - 55, x + 34, y - 70, TX, 1.4),
    ]
    return "".join(out)


filt_svgs = []
for i, touch in enumerate((True, True, False, False)):
    filt_svgs.append('<g transform="translate(%s,0)">%s%s</g>' % (
        i * 100, filtration(30, 40, touch, True), t(30, -10, "アイウエ"[i], TX, 13)))
FIGS["HG-2855-filt"] = svg("-10 -20 400 130", "".join(filt_svgs))

_b2855c = [
    poly([(0, 0), (30, -14), (60, 0), (60, 30), (30, 44), (0, 30)], LINE, 1.6),
    ln(0, 0, 30, 14, LINE, 1.2), ln(60, 0, 30, 14, LINE, 1.2), ln(30, 14, 30, 44, LINE, 1.2),
]
_b2855d = [poly([(30, 0), (55, 20), (30, 55), (5, 20)], LINE, 1.6), ln(30, 0, 30, 55, LINE, 1), ln(5, 20, 55, 20, LINE, 1)]
_b2855e = ['<ellipse cx="30" cy="18" rx="30" ry="8" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE,
           ln(0, 18, 0, 26, LINE, 1.6), ln(60, 18, 60, 26, LINE, 1.6),
           '<path d="M0,26 Q30,36 60,26" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE]
cry_svgs = []
for i, body in enumerate((_b2855c, _b2855d, _b2855e)):
    cry_svgs.append('<g transform="translate(%s,10)">%s%s</g>' % (i * 110, "".join(body), t(30, -6, "アイウ"[i], TX, 13)))
FIGS["HG-2855-cry"] = svg("-10 -20 340 90", "".join(cry_svgs))

tbl55 = [rect(0, 0, 250, 50, GRAY, 1.4)]
temps55 = ["0", "20", "40", "60", "80"]
res55 = ["47", "45", "41", "35", "26"]
for i in range(5):
    xx = i * 50
    tbl55.append(ln(xx, 0, xx, 50, "#2a3560", 0.8))
    tbl55.append(t(xx + 25, 20, temps55[i], TX, 11))
    tbl55.append(t(xx + 25, 42, res55[i], TX, 11))
tbl55.append(ln(250, 0, 250, 50, "#2a3560", 0.8))
tbl55.append(ln(0, 25, 250, 25, "#2a3560", 0.8))
tbl55 += [t(-14, 20, "水温", GRAY, 10, "end"), t(-14, 42, "とけ残り", GRAY, 10, "end")]
FIGS["HG-2855-table"] = svg("-60 -10 320 70", "".join(tbl55))

FIGS["HG-2855"] = svg("0 0 700 260", "".join([
    '<g transform="translate(220,0)">%s</g>' % FIGS["HG-2855-table"].split(">", 1)[1][:-6],
    '<g transform="translate(80,90)">%s</g>' % FIGS["HG-2855-filt"].split(">", 1)[1][:-6],
    '<g transform="translate(160,210)">%s</g>' % FIGS["HG-2855-cry"].split(">", 1)[1][:-6],
]))
for k in ("HG-2855-filt", "HG-2855-cry", "HG-2855-table"):
    del FIGS[k]

# ══ HG-2859：気体の集め方3枚＋表 ═════════════════════════════════════
_b2859a = [
    '<ellipse cx="40" cy="65" rx="40" ry="14" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE,
    ln(0, 65, 0, 40, LINE, 1.6), ln(80, 65, 80, 40, LINE, 1.6),
    '<path d="M0,40 Q40,52 80,40" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE,
    rect(30, 5, 20, 40, LINE, 1.4),
    poly([(20, -10), (55, -10), (44, 15), (30, 15)], LINE, 1.4),
]
_b2859b = [rect(28, 0, 24, 55, LINE, 1.6), ln(28, 55, 20, 65, LINE, 1.4), ln(52, 55, 60, 65, LINE, 1.4),
           ln(20, 65, 60, 65, LINE, 1.4), ln(34, -6, 34, 0, LINE, 1.2)]
_b2859c = [rect(28, 20, 24, 45, LINE, 1.6), ln(28, 20, 20, 6, LINE, 1.4), ln(52, 20, 60, 6, LINE, 1.4),
           ln(20, 6, 60, 6, LINE, 1.4), ln(60, 40, 74, 40, LINE, 1.4)]
gas_svgs = []
for i, (body, lbl) in enumerate(((_b2859a, "水上置換法"), (_b2859b, "上方置換法"), (_b2859c, "下方置換法"))):
    gas_svgs.append('<g transform="translate(%s,10)">%s%s</g>' % (i * 130, "".join(body), t(40, -12, lbl, GRAY, 11)))
FIGS["HG-2859-gas"] = svg("-20 -25 420 110", "".join(gas_svgs))

tbl59 = [rect(0, 0, 400, 50, GRAY, 1.4)]
yv59 = ["0", "40", "80", "120", "160", "200", "240", "280"]
xv59 = ["0", "200", "400", "A", "800", "900", "900", "B"]
for i in range(8):
    xx = i * 50
    tbl59.append(ln(xx, 0, xx, 50, "#2a3560", 0.8))
    tbl59.append(t(xx + 25, 20, yv59[i], TX, 10))
    tbl59.append(t(xx + 25, 42, xv59[i], TX, 10))
tbl59.append(ln(400, 0, 400, 50, "#2a3560", 0.8))
tbl59.append(ln(0, 25, 400, 25, "#2a3560", 0.8))
tbl59 += [t(-14, 20, "塩酸Y", GRAY, 10, "end"), t(-14, 42, "気体X", GRAY, 10, "end")]
FIGS["HG-2859-table"] = svg("-70 -10 480 70", "".join(tbl59))

FIGS["HG-2859"] = svg("0 0 700 220", "".join([
    '<g transform="translate(140,0)">%s</g>' % FIGS["HG-2859-gas"].split(">", 1)[1][:-6],
    '<g transform="translate(80,140)">%s</g>' % FIGS["HG-2859-table"].split(">", 1)[1][:-6],
]))
for k in ("HG-2859-gas", "HG-2859-table"):
    del FIGS[k]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
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
