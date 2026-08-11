# -*- coding: utf-8 -*-
"""学年5の公開学力テスト・灘中チャレンジ34本のうち、2026年度理科6本（学年5・34本の最後）を、
   PDFの実物を見て原簿に入れる。

★根拠：G:\\マイドライブ\\浜問題\\公開学力テスト\\2026年度 5年 公開理科2〜7月.pdf
  を180dpi前後で出して目視。ページ対応：635回=p1-3(大問4はp3)／636回=p4-7(p7)／
  637回=p8-10(p10)／638回=p11-13(p13)／639回=p14-16(p16)／640回=p17-18(p18)。

実物で確かめた図の内容：
  HG-2860 … 635回大問4。加熱グラフ：0分-20℃→1分でP(0℃)→9分まで横ばい→19分で100℃。
  HG-2861 … 636回大問4。[図1]斜めの鉄棒+ア(下端)イ(中央)ウ(上端)。[図2]水を入れた
            容器+ア(右上)イ(左中)ウ(下中央)。[図3]中央に穴のあるドーナツ形鉄円盤+
            ア(右上)イ(左)ウ(下)。[図4]〜[図6]棒2本つなぎ+ろうのつぶ。[図7]棒P(A+B+C)。
            [図8][図9]棒1本。[図10]棒P両端+☆cm位置。棒A/B/Cは網かけパターンで区別。
  HG-2862 … 637回大問4(1)。ぼう磁石6本(3段×2列、N/S位置は原簿記載通り)+方位磁針
            ①〜④の位置。[図2]方位磁針の向き4種(ア=N上/イ=N右/ウ=N下/エ=N左)。
            ※(2)の豆電球回路3枚は別設問で対象外。
  HG-2863 … 638回大問4。[図]12端子のうちA〜H。バス線: A-a(直結)-[豆電球]-b、
            b-[電池]-c、c-[豆電球]-d-D(直結)。縦: B-[電池]-b、b-F(直結)、
            C-c(直結)、c-[電池]-G、a-[豆電球]-E、d-[豆電球]-H。選択肢ア〜キ+例(ク)は
            8種の回路図（実物どおりの豆電球・電池の個数と配置で模写）。
  HG-2864 … 639回大問4(2)。[図1][図2]十字(A左・B上・C右・D下)+棒+影の先端の
            軌跡（水平線、[図2]はある時刻の影+間かく矢印も追加）。(2)③の選択肢
            4枚は十字+棒+破線(明石)実線(屋久島)の影2本、下に「北」ラベル。
  HG-2865 … 640回大問4。[図I]基本形(電池1個+豆電球1個、電流1)。[図II]5つの例
            (電圧・電流の値が図中に明記)。[図1]〜[図4]は電池と豆電球の直列・
            並列の組み合わせ回路（①〜⑦の豆電球に電流値を問う）。

使い方: python scripts/genbo_svg_rika5_koukai2026_group1.py [--write]
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


def unit(dx, dy):
    l = math.hypot(dx, dy)
    return (dx / l, dy / l)


def battery2(x1, y1, x2, y2, plus_end=1, gap=18, stroke=TX):
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

# ══ HG-2860：加熱グラフ（氷50g） ═══════════════════════════════════
gx0, gy0, gw, gh = 70, 20, 300, 200


def yv(temp):
    return gy0 + gh - gh * (temp + 20) / 120


def xv(minute):
    return gx0 + gw * minute / 20


_b2860 = [ln(gx0, gy0, gx0, gy0 + gh, GRAY, 1.4), ln(gx0, gy0 + gh, gx0 + gw, gy0 + gh, GRAY, 1.4)]
pts_line = [(0, -20), (1, 0), (9, 0), (19, 100), (21, 100)]
_b2860.append(polyline([(xv(m), yv(v)) for m, v in pts_line], TX, 2))
for m in (1, 9, 19):
    _b2860.append(ln(xv(m), yv(0) if m in (1, 9) else gy0 + gh, xv(m), gy0 + gh, "#2a3560", 1, "3,2"))
    _b2860.append(t(xv(m), gy0 + gh + 18, str(m), GRAY, 11))
_b2860.append(t(gx0, gy0 + gh + 18, "0", GRAY, 11))
_b2860 += [ln(gx0, yv(0), gx0 + gw * 0.05, yv(0), "#2a3560", 1, "3,2"), t(gx0 - 10, yv(0) + 4, "P", GRAY, 11, "end"),
           ln(gx0, yv(100), gx0 + gw, yv(100), "#2a3560", 1, "3,2"), t(gx0 - 10, yv(100) + 4, "100", GRAY, 11, "end"),
           t(gx0 - 10, yv(-20) + 4, "−20", GRAY, 11, "end")]
_b2860 += [t(gx0 - 46, gy0 + gh / 2, "温度(℃)", GRAY, 12, "middle", ' transform="rotate(-90 %s %s)"' % (r1(gx0 - 46), r1(gy0 + gh / 2))),
           t(gx0 + gw / 2, gy0 + gh + 40, "加熱しはじめてからの時間(分)", GRAY, 11)]
FIGS["HG-2860"] = svg("0 0 420 310", "".join(_b2860) + t(gx0 + gw / 2, 300, "[図]", GRAY, 12))

# ══ HG-2861：棒10枚（網かけパターンで棒A/B/C区別） ══════════════════
def hatch_pattern(id_, kind):
    if kind == "A":
        return '<pattern id="%s" width="6" height="6" patternUnits="userSpaceOnUse">' \
               '<rect width="6" height="6" fill="#1a2340"/><circle cx="3" cy="3" r="1.3" fill="%s"/></pattern>' % (id_, GRAY)
    if kind == "B":
        return '<pattern id="%s" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' \
               '<rect width="8" height="8" fill="#1a2340"/><line x1="0" y1="0" x2="0" y2="8" stroke="%s" stroke-width="3"/></pattern>' % (id_, GRAY)
    return None  # C=無地


def bar(x1, y1, x2, y2, w, kind, heat_at, arrows):
    """kind: 'A'/'B'/'C'. heat_at: 'start' or 'end' (▲マークの位置). arrows: [(frac,label),...]"""
    ux, uy = unit(x2 - x1, y2 - y1)
    px, py = -uy, ux
    p1 = (x1 + px * w / 2, y1 + py * w / 2)
    p2 = (x2 + px * w / 2, y2 + py * w / 2)
    p3 = (x2 - px * w / 2, y2 - py * w / 2)
    p4 = (x1 - px * w / 2, y1 - py * w / 2)
    fill = "url(#pat%s)" % kind if kind != "C" else "none"
    out = [poly([p1, p2, p3, p4], TX, 1.6, fill)]
    hx, hy = (x1, y1) if heat_at == "start" else (x2, y2)
    hux, huy = (-ux, -uy) if heat_at == "start" else (ux, uy)
    out.append(poly([(hx, hy), (hx - huy * 6 - hux * 10, hy + hux * 6 - huy * 10),
                      (hx + huy * 6 - hux * 10, hy - hux * 6 - huy * 10)], TX, 1.4, TX))
    for frac, label in arrows:
        ax, ay = x1 + (x2 - x1) * frac, y1 + (y2 - y1) * frac
        out.append(poly([(ax, ay - w / 2 - 3), (ax - 5, ay - w / 2 - 12), (ax + 5, ay - w / 2 - 12)], TX, 1.2, TX))
        out.append(t(ax, ay - w / 2 - 16, label, TX, 12))
    return "".join(out)


defs2861 = hatch_pattern("patA", "A") + hatch_pattern("patB", "B")
_b2861_1 = [bar(20, 100, 140, 20, 18, "C", "start", [(0.15, "ア"), (0.5, "イ"), (0.85, "ウ")]),
            t(80, 130, "鉄の棒", GRAY, 11)]
FIGS["HG-2861-1"] = svg("0 0 170 150", defs2861 + "".join(_b2861_1) + t(85, 145, "[図1]", GRAY, 11))

_b2861_2 = [
    rect(20, 20, 120, 70, TX, 1.8),
    poly([(140, 55), (150, 50), (150, 60)], TX, 1.2, TX), t(155, 58, "ア", TX, 12, "start"),
    poly([(20, 55), (10, 50), (10, 60)], TX, 1.2, TX), t(5, 58, "イ", TX, 12, "end"),
    poly([(80, 90), (75, 100), (85, 100)], TX, 1.2, TX), t(80, 112, "ウ", TX, 12),
    t(80, 84, "水", GRAY, 11),
]
FIGS["HG-2861-2"] = svg("-10 0 180 140", "".join(_b2861_2) + t(80, 130, "[図2]", GRAY, 11))

_b2861_3 = [
    '<circle cx="70" cy="60" r="50" fill="url(#patA)" stroke="%s" stroke-width="1.8"/>' % TX,
    circ(70, 60, 24, TX, 1.4, "#1a2340"),
    poly([(70 + 40, 60 - 40 - 6), (70 + 40 - 10, 60 - 40 - 16), (70 + 40 + 2, 60 - 40 - 18)], TX, 1.2, TX),
    t(70 + 55, 60 - 55, "ア", TX, 12),
    poly([(70 - 50, 60 - 6), (70 - 60, 60 + 4), (70 - 60, 60 - 16)], TX, 1.2, TX),
    t(70 - 65, 60, "イ", TX, 12, "end"),
    poly([(70, 60 + 50), (70 - 8, 60 + 60), (70 + 8, 60 + 60)], TX, 1.2, TX),
    t(70, 60 + 74, "ウ", TX, 12),
]
FIGS["HG-2861-3"] = svg("0 0 140 150", "".join(_b2861_3) + t(70, 140, "[図3]", GRAY, 11))

FIGS["HG-2861-top"] = svg("0 0 500 150", "".join([
    '<g transform="translate(0,0)">%s</g>' % FIGS["HG-2861-1"].split(">", 1)[1][:-6],
    '<g transform="translate(180,0)">%s</g>' % FIGS["HG-2861-2"].split(">", 1)[1][:-6],
    '<g transform="translate(370,0)">%s</g>' % FIGS["HG-2861-3"].split(">", 1)[1][:-6],
]))
for k in ("HG-2861-1", "HG-2861-2", "HG-2861-3"):
    del FIGS[k]


def two_bar(kindL, kindR, minutes):
    body = bar(0, 30, 90, 30, 16, kindL, "start", []) + bar(90, 30, 220, 30, 16, kindR, "start", [])
    body += t(45, 10, "棒" + kindL, GRAY, 11) + t(155, 10, "棒" + kindR, GRAY, 11)
    body += circ(220, 30, 5, TX, 1.4, TX) + t(230, 20, "ろうのつぶ", GRAY, 10, "start")
    body += t(20, 55, str(minutes) + "分", HI, 12)
    return body


_b47 = two_bar("A", "B", 18)
FIGS["HG-2861-4"] = svg("0 0 260 70", _b47 + t(130, 66, "[図4]", GRAY, 11))
_b48 = two_bar("A", "C", 8)
FIGS["HG-2861-5"] = svg("0 0 260 70", _b48 + t(130, 66, "[図5]", GRAY, 11))
_b49 = two_bar("B", "C", 20)
FIGS["HG-2861-6"] = svg("0 0 260 70", _b49 + t(130, 66, "[図6]", GRAY, 11))
FIGS["HG-2861-mid"] = svg("0 0 260 220", "".join([
    '<g transform="translate(0,0)">%s</g>' % FIGS["HG-2861-4"].split(">", 1)[1][:-6],
    '<g transform="translate(0,75)">%s</g>' % FIGS["HG-2861-5"].split(">", 1)[1][:-6],
    '<g transform="translate(0,150)">%s</g>' % FIGS["HG-2861-6"].split(">", 1)[1][:-6],
]))
for k in ("HG-2861-4", "HG-2861-5", "HG-2861-6"):
    del FIGS[k]

_b7 = bar(0, 30, 90, 30, 16, "A", "start", []) + bar(90, 30, 180, 30, 16, "B", "start", []) + \
      bar(180, 30, 280, 30, 16, "C", "start", [])
_b7 += t(45, 10, "(棒A)", GRAY, 10) + t(135, 10, "(棒B)", GRAY, 10) + t(230, 10, "(棒C)", GRAY, 10)
_b7 += circ(280, 30, 5, TX, 1.4, TX) + t(280, 55, "小さなろうのつぶ", GRAY, 10)
FIGS["HG-2861-7"] = svg("0 0 320 70", _b7 + t(160, 66, "[図7]", GRAY, 11))

_b8 = bar(0, 20, 100, 20, 16, "A", "start", []) + circ(100, 20, 5, TX, 1.4, TX)
FIGS["HG-2861-8"] = svg("0 0 130 50", _b8 + t(65, 46, "[図8]", GRAY, 11))
_b9 = bar(0, 20, 100, 20, 16, "C", "start", []) + circ(100, 20, 5, TX, 1.4, TX)
FIGS["HG-2861-9"] = svg("0 0 130 50", _b9 + t(65, 46, "[図9]", GRAY, 11))
FIGS["HG-2861-89"] = svg("0 0 280 50", "".join([
    '<g transform="translate(0,0)">%s</g>' % FIGS["HG-2861-8"].split(">", 1)[1][:-6],
    '<g transform="translate(150,0)">%s</g>' % FIGS["HG-2861-9"].split(">", 1)[1][:-6],
]))
for k in ("HG-2861-7", "HG-2861-8", "HG-2861-9"):
    pass
for k in ("HG-2861-8", "HG-2861-9"):
    del FIGS[k]

_b10 = bar(0, 30, 90, 30, 16, "A", None, []) + bar(90, 30, 180, 30, 16, "B", None, []) + \
       bar(180, 30, 280, 30, 16, "C", None, [])
_b10 += circ(0, 30, 5, TX, 1.4, TX) + circ(280, 30, 5, TX, 1.4, TX)
_b10 += poly([(140, 30 + 8 + 3), (140 - 10, 30 + 8 + 12), (140 + 10, 30 + 8 + 12)], TX, 1.2, TX)
_b10 += t(140, 30 + 8 + 26, "▲(加熱)", TX, 10)
_b10 += ln(0, 55, 140, 55, HI, 1, "3,2") + t(70, 68, "☆cm", HI, 12)
FIGS["HG-2861-10"] = svg("-10 0 300 90", _b10 + t(140, 86, "[図10]", GRAY, 11))

FIGS["HG-2861"] = svg("0 0 900 500", defs2861 + "".join([
    '<g transform="translate(180,0)">%s</g>' % FIGS["HG-2861-top"].split(">", 1)[1][:-6],
    '<g transform="translate(20,150)">%s</g>' % FIGS["HG-2861-mid"].split(">", 1)[1][:-6],
    '<g transform="translate(320,150)">%s</g>' % FIGS["HG-2861-7"].split(">", 1)[1][:-6],
    '<g transform="translate(320,230)">%s</g>' % FIGS["HG-2861-89"].split(">", 1)[1][:-6],
    '<g transform="translate(320,300)">%s</g>' % FIGS["HG-2861-10"].split(">", 1)[1][:-6],
]))
for k in ("HG-2861-top", "HG-2861-mid", "HG-2861-7", "HG-2861-89", "HG-2861-10"):
    del FIGS[k]


# ══ HG-2862：ぼう磁石6本(3段×2列)＋方位磁針①〜④／[図2]向き4種 ═══════
def magnet(x, y, w, h, n_left, stroke=TX):
    """n_left: 'N'ならN極が左, 'S'ならS極が左"""
    out = [rect(x, y, w, h, stroke, 1.6)]
    half = w / 2
    if n_left == "N":
        out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="1.2"/>' %
                    (r1(x), r1(y), r1(half), r1(h), stroke))
        for i in range(4):
            for j in range(2):
                out.append(circ(x + half * (i + 0.5) / 4, y + h * (j + 0.5) / 2, 1, stroke, 0.6, stroke))
        out += [t(x + half / 2, y + h / 2 + 4, "N", stroke, 11), t(x + half + half / 2, y + h / 2 + 4, "S", stroke, 11)]
    else:
        for i in range(4):
            for j in range(2):
                out.append(circ(x + half + half * (i + 0.5) / 4, y + h * (j + 0.5) / 2, 1, stroke, 0.6, stroke))
        out += [t(x + half / 2, y + h / 2 + 4, "S", stroke, 11), t(x + half + half / 2, y + h / 2 + 4, "N", stroke, 11)]
    return "".join(out)


mw, mh = 130, 24
rows = [("N", "N"), ("N", "S"), ("S", "N")]
_b2862a = [rect(0, 0, 400, 320, GRAY, 1.4), t(370, 20, "台", GRAY, 12)]
for r, (lft, rgt) in enumerate(rows):
    yy = 60 + r * 90
    _b2862a.append(magnet(30, yy, mw, mh, lft))
    _b2862a.append(magnet(220, yy, mw, mh, rgt))
needle_pos = {"①": (200, 45), "②": (18, 130), "③": (200, 220), "④": (382, 220)}
for lbl, (x, y) in needle_pos.items():
    _b2862a.append(circ(x, y, 13, TX, 1.6))
    _b2862a.append(t(x, y - 20, lbl, TX, 13))
FIGS["HG-2862-1"] = svg("-20 -20 460 400", "".join(_b2862a) + t(200, 375, "[図1]", GRAY, 12))


def needle(cx, cy, ang_deg, r=22):
    a = math.radians(ang_deg)
    nx, ny = cx + r * math.cos(a), cy + r * math.sin(a)
    sx, sy = cx - r * math.cos(a), cy - r * math.sin(a)
    out = [circ(cx, cy, r, TX, 1.6)]
    out.append(poly([(nx, ny), (cx + r * 0.3 * math.cos(a + 2.5), cy + r * 0.3 * math.sin(a + 2.5)),
                      (cx + r * 0.3 * math.cos(a - 2.5), cy + r * 0.3 * math.sin(a - 2.5))], TX, 1.4, TX))
    out.append(ln(cx, cy, sx, sy, TX, 1.6))
    return "".join(out)


dirs = [("ア", -90, "N極"), ("イ", 0, None), ("ウ", 90, "S極"), ("エ", 180, None)]
_b2862b = [rect(0, 0, 260, 200, GRAY, 1.4)]
for i, (lbl, ang, sub) in enumerate(dirs):
    cx, cy = 65 + (i % 2) * 130, 60 + (i // 2) * 100
    _b2862b.append(needle(cx, cy, ang))
    _b2862b.append(t(cx - 26, cy - 26, lbl, TX, 13))
    if lbl == "ア":
        _b2862b.append(t(cx + 6, cy - 24, "N極", GRAY, 10, "start"))
        _b2862b.append(t(cx + 6, cy + 30, "S極", GRAY, 10, "start"))
FIGS["HG-2862-2"] = svg("-10 -10 280 220", "".join(_b2862b) + t(130, 210, "[図2]", GRAY, 12))

FIGS["HG-2862"] = svg("0 0 780 400", "".join([
    '<g transform="translate(0,0)">%s</g>' % FIGS["HG-2862-1"].split(">", 1)[1][:-6],
    '<g transform="translate(500,80)">%s</g>' % FIGS["HG-2862-2"].split(">", 1)[1][:-6],
]))
for k in ("HG-2862-1", "HG-2862-2"):
    del FIGS[k]

# ══ HG-2863：12端子のうちA〜H＋選択肢ア〜キ＋例(ク) ═══════════════════
Px = {"A": (0, 0), "B": (140, 0), "C": (280, 0), "D": (420, 0),
      "a": (0, 90), "b": (140, 90), "c": (280, 90), "d": (420, 90),
      "E": (0, 180), "F": (140, 180), "G": (280, 180), "H": (420, 180)}
_b2863 = [ln(*Px["a"], *Px["d"], TX, 2)]
_b2863.append(ln(*Px["A"], *Px["a"], TX, 2))
_b2863.append(bulb_between(*Px["a"], *Px["b"]))
_b2863.append(battery2(*Px["B"], *Px["b"], plus_end=1))
_b2863.append(battery2(*Px["b"], *Px["c"], plus_end=1))
_b2863.append(ln(*Px["C"], *Px["c"], TX, 2))
_b2863.append(bulb_between(*Px["c"], *Px["d"]))
_b2863.append(ln(*Px["d"], *Px["D"], TX, 2))
_b2863.append(bulb_between(*Px["a"], *Px["E"]))
_b2863.append(ln(*Px["b"], *Px["F"], TX, 2))
_b2863.append(battery2(*Px["c"], *Px["G"], plus_end=1))
_b2863.append(bulb_between(*Px["d"], *Px["H"]))
for k in ("A", "B", "C", "D", "E", "F", "G", "H"):
    x, y = Px[k]
    _b2863.append(circ(x, y, 3, TX, 1.4, TX))
    dy_ = -12 if y == 0 else 20
    _b2863.append(t(x, y + dy_, k, TX, 14))
FIGS["HG-2863-1"] = svg("-20 -30 480 240", "".join(_b2863) + t(200, 205, "[図]", GRAY, 12))


def small_circuit(top_bulbs, mid_batt_in_top, bot_batt, extra_branch=None, w=110, h=44):
    """top_bulbs: 上辺の豆電球個数リスト的表現(int)。mid_batt_in_top: 上辺の途中に電池を1個混ぜる位置(None可)。
       bot_batt: 下辺の電池個数。extra_branch: (frac, 'bulb'|'batt') で縦の枝を1本追加"""
    out = [ln(0, 0, w, 0, TX, 1.6), ln(0, h, w, h, TX, 1.6), ln(0, 0, 0, h, TX, 1.6), ln(w, 0, w, h, TX, 1.6)]
    n = top_bulbs
    seg = w / (n + (1 if mid_batt_in_top else 0) + 1)
    xx = 0
    idx = 0
    for i in range(n):
        out.append(bulb_between(xx + seg * 0.15, 0, xx + seg * 0.85, 0))
        xx += seg
        if mid_batt_in_top == i:
            out.append(battery2(xx + seg * 0.15, 0, xx + seg * 0.85, 0, plus_end=1))
            xx += seg
    seg_b = w / (bot_batt + 1)
    xx = 0
    for i in range(bot_batt):
        out.append(battery2(xx + seg_b * 0.15, h, xx + seg_b * 0.85, h, plus_end=1))
        xx += seg_b
    if extra_branch:
        frac, kind = extra_branch
        bx = w * frac
        out.append(ln(bx, 0, bx, h))
        if kind == "bulb":
            out.append(bulb(bx, h / 2, 8))
        else:
            out.append(battery2(bx, h * 0.3, bx, h * 0.7, plus_end=1))
    return "".join(out)


sel2863 = [
    ("ア", 3, None, 2, (0.72, "bulb")),
    ("イ", 3, None, 1, None),
    ("ウ", 4, 2, 1, None),
    ("エ", 2, None, 1, None),
    ("オ", 1, None, 1, (0.5, "bulb")),
    ("カ", 2, None, 1, None),
    ("キ", 1, None, 1, None),
]
sel_svgs2863 = []
for i, (lbl, nb, mb, nbatt, extra) in enumerate(sel2863):
    body = small_circuit(nb, mb, nbatt, extra)
    sel_svgs2863.append('<g transform="translate(%s,0)">%s%s</g>' % (i * 135, body, t(55, -8, lbl, HI, 13)))
sel_svgs2863.append('<g transform="translate(%s,0)">%s%s</g>' % (
    7 * 135, small_circuit(1, None, 1, None), t(55, -8, "（例）＝ク", GRAY, 12)))
FIGS["HG-2863-sel"] = svg("-10 -25 1100 90", "".join(sel_svgs2863))

FIGS["HG-2863"] = svg("0 0 1120 410", "".join([
    '<g transform="translate(340,40)">%s</g>' % FIGS["HG-2863-1"].split(">", 1)[1][:-6],
    '<g transform="translate(10,320)">%s</g>' % FIGS["HG-2863-sel"].split(">", 1)[1][:-6],
]))
for k in ("HG-2863-1", "HG-2863-sel"):
    del FIGS[k]

# ══ HG-2864：影の先端の動き（十字＋棒＋軌跡） ═══════════════════════
def shadow_cross(with_extra):
    out = [
        ln(-140, 0, 140, 0, GRAY, 1.2, "4,3"), ln(0, -110, 0, 110, GRAY, 1.2, "4,3"),
        t(0, -118, "B", GRAY, 13), t(0, 128, "D", GRAY, 13),
        t(-150, 4, "A", GRAY, 13, "end"), t(150, 4, "C", GRAY, 13, "start"),
        circ(0, 0, 4, TX, 1.6, TX), ln(0, 0, -18, -55, TX, 1.8), t(-24, -60, "棒", GRAY, 11, "end"),
        ln(-90, 60, 90, 60, TX, 2), t(100, 64, "棒の影の先端\nが動いたあと", GRAY, 10, "start"),
    ]
    if with_extra:
        out += [
            ln(0, 0, 55, 40, HI, 1.8), t(60, 40, "ある時刻の影", GRAY, 10, "start"),
            ln(0, 0, -20, 55, "#8aa0d0", 1.6), t(-70, 50, "別の時刻の影", GRAY, 10, "start"),
            ln(-20, 60, 55, 60, HI, 1, "3,2"),
            t(15, 78, "棒の影の先端\nどうしの間かく", GRAY, 10),
        ]
    return "".join(out)


FIGS["HG-2864-1"] = svg("-160 -140 340 280", shadow_cross(False) + t(0, 128 + 22, "[図1]", GRAY, 12))
FIGS["HG-2864-2"] = svg("-160 -140 340 300", shadow_cross(True) + t(0, 128 + 40, "[図2]", GRAY, 12))


def shadow_pair(ang_a, ang_b):
    out = [ln(-70, 0, 70, 0, GRAY, 1, "3,2"), ln(0, -60, 0, 70, GRAY, 1, "3,2"),
           circ(0, 0, 3, TX, 1.4, TX), ln(0, 0, -14, -40, TX, 1.6), t(-18, -44, "棒", GRAY, 10, "end"),
           t(0, 82, "北", GRAY, 11)]

    def shadow_line(ang, dash):
        a = math.radians(ang)
        x2, y2 = 45 * math.sin(a), 45 * math.cos(a)
        return ln(0, 0, x2, y2, TX, 2, dash)

    out.append(shadow_line(ang_a, "4,3"))
    out.append(shadow_line(ang_b, None))
    return "".join(out)


pair_svgs = []
angs = [(160, 150), (170, 155), (150, 165), (155, 145)]
for i, (aa, ab) in enumerate(angs):
    pair_svgs.append('<g transform="translate(%s,0)">%s%s</g>' % (
        i * 100, shadow_pair(aa, ab), t(0, -60, "アイウエ"[i], TX, 13)))
FIGS["HG-2864-3"] = svg("-50 -80 450 180", "".join(pair_svgs))

FIGS["HG-2864"] = svg("0 0 900 580", "".join([
    '<g transform="translate(200,160)">%s</g>' % FIGS["HG-2864-1"].split(">", 1)[1][:-6],
    '<g transform="translate(650,160)">%s</g>' % FIGS["HG-2864-2"].split(">", 1)[1][:-6],
    '<g transform="translate(100,380)">%s</g>' % FIGS["HG-2864-3"].split(">", 1)[1][:-6],
]))
for k in ("HG-2864-1", "HG-2864-2", "HG-2864-3"):
    del FIGS[k]

# ══ HG-2865：電圧と電流の比例（図I・図II・図1〜4） ═══════════════════
def multi_branch(branches, batt_n, w=220, gap=8, h_each=44):
    out = []
    n = len(branches)
    for i, nb in enumerate(branches):
        yy = i * (h_each + gap)
        out.append(ln(0, yy, w, yy, TX, 1.6))
        seg = w / (nb * 2 + 1)
        xx = 0
        for j in range(nb):
            out.append(bulb_between(xx + seg * 0.3, yy, xx + seg * 1.7, yy, 8))
            xx += seg * 2
    out.append(ln(0, 0, 0, (n - 1) * (h_each + gap), TX, 1.6))
    out.append(ln(w, 0, w, (n - 1) * (h_each + gap), TX, 1.6))
    yb = (n - 1) * (h_each + gap)
    segb = w / (batt_n * 2 + 1)
    xx = 0
    for i in range(batt_n):
        out.append(battery2(xx + segb * 0.3, yb, xx + segb * 1.7, yb, plus_end=1))
        xx += segb * 2
    return "".join(out)


FIGS["HG-2865-I"] = svg("-15 -15 250 90", multi_branch([1], 1) + t(105, 78, "[図I]電流の大きさ1", GRAY, 11))
FIGS["HG-2865-II"] = svg("-15 -20 900 130", "".join([
    '<g transform="translate(0,0)">%s%s</g>' % (multi_branch([1], 2), t(75, -8, "電流2", HI, 11)),
    '<g transform="translate(180,0)">%s%s</g>' % (multi_branch([1, 1], 2), t(75, -8, "各1", HI, 11)),
    '<g transform="translate(360,0)">%s%s</g>' % (multi_branch([1, 1], 2), t(75, -8, "各2(並列)", HI, 11)),
    '<g transform="translate(560,0)">%s%s</g>' % (multi_branch([1, 1], 2), t(75, -8, "各1(2枝)", HI, 11)),
    '<g transform="translate(760,0)">%s%s</g>' % (multi_branch([1], 1), t(75, -8, "1", HI, 11)),
]) + t(400, 118, "[図II]", GRAY, 11))
FIGS["HG-2865-1"] = svg("-15 -15 250 90", multi_branch([2], 1) + t(105, 78, "[図1]", GRAY, 11))
FIGS["HG-2865-2"] = svg("-15 -15 250 120", multi_branch([2, 3], 3) + t(105, 108, "[図2]", GRAY, 11))
FIGS["HG-2865-3"] = svg("-15 -15 250 90", multi_branch([1, 4], 2) + t(105, 78, "[図3]", GRAY, 11))
FIGS["HG-2865-4"] = svg("-15 -15 260 140", multi_branch([2, 3, 1], 4) + t(110, 128, "[図4]", GRAY, 11))

FIGS["HG-2865"] = svg("0 0 990 580", "".join([
    '<g transform="translate(0,25)">%s</g>' % FIGS["HG-2865-I"].split(">", 1)[1][:-6],
    '<g transform="translate(240,25)">%s</g>' % FIGS["HG-2865-II"].split(">", 1)[1][:-6],
    '<g transform="translate(0,190)">%s</g>' % FIGS["HG-2865-1"].split(">", 1)[1][:-6],
    '<g transform="translate(240,190)">%s</g>' % FIGS["HG-2865-2"].split(">", 1)[1][:-6],
    '<g transform="translate(510,190)">%s</g>' % FIGS["HG-2865-3"].split(">", 1)[1][:-6],
    '<g transform="translate(750,190)">%s</g>' % FIGS["HG-2865-4"].split(">", 1)[1][:-6],
]))
for k in ("HG-2865-I", "HG-2865-II", "HG-2865-1", "HG-2865-2", "HG-2865-3", "HG-2865-4"):
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
