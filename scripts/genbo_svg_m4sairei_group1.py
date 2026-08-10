# -*- coding: utf-8 -*-
"""小4最レで「図: あり」なのに図SVGが無かった22本を、PDFの実物を見て原簿に入れる。

★根拠：4年最レ算数 実力〜No.24.pdf／No.25〜No.42.pdf（G:\\マイドライブ\\浜問題\\4年最レ算数\\）を
  200dpiで出して目視。原簿に図は入っていないのでここが唯一の根拠（feedback_zu_wa_genbo_ni_nai）。
  HG-0421・HG-1974の反省を踏まえ、実物にしかない情報（答えの先渡し等）は描かない。

★このPDFはページが90度回転してスキャンされている（読むときは回転して確認した）。
  ページ対応は「No.k本文 = 2k+1ページ目」（実力〜No.24.pdf）
  「No.k本文 = 2(k-25)+1ページ目」（No.25〜No.42.pdf）で規則的だった。

実物で確かめた大問対応：
  HG-1006 No.1大問7／HG-1011,1012,1013 No.3大問3,4,6／HG-1028,1029 No.8大問4,5／
  HG-1031,1032 No.9大問3,5／HG-1058 No.17大問5／HG-1066 No.19大問5／HG-1074 No.23大問4／
  HG-1076 No.21大問4／HG-1077 No.22大問4／HG-1101 No.25大問3／HG-1103 No.26大問6／
  HG-1105 No.27大問2／HG-1107 No.28大問3／HG-1113,1114 No.30大問6,7／HG-1124 No.34大問5／
  HG-1125 No.35大問1／HG-1137 No.41大問6

使い方: python scripts/genbo_svg_m4sairei_group1.py [--write]
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


def defs_arrow(mid, color=HI):
    return ('<defs><marker id="%s" markerWidth="8" markerHeight="8" refX="6.5" refY="4"'
            ' orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % (mid, color))


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


def dial(cx, cy, r, n, needle_val, label, color=TX):
    out = [circ(cx, cy, r, LINE, 2)]
    for i in range(n):
        ang = math.radians(-90 + i * 360.0 / n)
        lx = cx + (r + 15) * math.cos(ang)
        ly = cy + (r + 15) * math.sin(ang) + 4
        out.append(t(lx, ly, str(i), color, 12))
    a = math.radians(-90 + needle_val * 360.0 / n)
    out.append(ln(cx, cy, cx + r * 0.72 * math.cos(a), cy + r * 0.72 * math.sin(a), HI, 2.2))
    out.append(dot(cx, cy, 2.6, TX))
    out.append(t(cx, cy - r - 24, label, TX, 14))
    return out


def grid_table(gx, gy, cs, rows):
    out = []
    nr, nc = len(rows), len(rows[0])
    for r in range(nr):
        for c in range(nc):
            out.append(rect(gx + c * cs, gy + r * cs, cs, cs, LINE, 1.4))
            v = rows[r][c]
            if v is not None:
                out.append(t(gx + c * cs + cs / 2, gy + r * cs + cs / 2 + 4, str(v), TX, 13))
    return out


FIGS = {}

# ══ No.1 大問7（HG-1006）長方形の格子＋対角線BD（縦3等分×横4等分の例） ═════
GX1, GY1, GW1, GH1 = 60, 30, 240, 120
_g1 = [ln(GX1 + i * GW1 / 4, GY1, GX1 + i * GW1 / 4, GY1 + GH1, LINE, 1.2) for i in range(5)]
_g1 += [ln(GX1, GY1 + j * GH1 / 3, GX1 + GW1, GY1 + j * GH1 / 3, LINE, 1.2) for j in range(4)]
_g1 += [rect(GX1, GY1, GW1, GH1, LINE, 2), ln(GX1, GY1, GX1 + GW1, GY1 + GH1, HI, 2.4),
        t(GX1 - 10, GY1 + 4, "B", TX, 13, "end"), t(GX1 + GW1 + 10, GY1 + GH1 + 4, "D", TX, 13, "start")]
FIGS["HG-1006"] = svg("0 0 400 190", "".join(_g1 + [
    t(200, 178, "長方形ABCDの対角線BDを、縦横の等分線で分ける（図は縦3等分×横4等分の例）", GRAY, 11),
]))

# ══ No.3 大問3（HG-1011）6マスの帯＝2進法（5つの例だけが手がかり） ═══════
def strip6(x0, y0, pattern, label):
    out = []
    for i, v in enumerate(pattern):
        out.append(rect(x0 + i * 26, y0, 26, 26, LINE, 1.4,
                         'rgba(79,158,255,0.35)' if v else "none"))
    out.append(t(x0 + 6 * 26 + 14, y0 + 18, "＝%s" % label, TX, 13, "start"))
    return out


_ex = [(0, 0, 0, 0, 0, 1, "1"), (0, 0, 0, 0, 1, 0, "2"), (0, 0, 0, 0, 1, 1, "3"),
       (0, 0, 0, 1, 0, 0, "4"), (0, 0, 1, 0, 1, 0, "10")]
_b11 = []
for i, ex in enumerate(_ex):
    _b11 += strip6(40, 20 + i * 34, ex[:6], ex[6])
FIGS["HG-1011"] = svg("0 0 330 220", "".join(_b11 + [
    t(150, 212, "6マスの帯。ぬりつぶし＝1・白＝0（位の名前は書かれていない）", GRAY, 11),
]))

# ══ No.3 大問4（HG-1012）4連ダイヤル計器 A・B・C・D（0〜3の4めもり） ═══════
_d12 = []
for i, lab in enumerate(["A", "B", "C", "D"]):
    _d12 += dial(70 + i * 100, 90, 36, 4, 0, lab)
FIGS["HG-1012"] = svg("0 0 440 190", "".join(_d12 + [
    t(220, 172, "Dが1回転するとCが1目もり。Dが4進むごとにCが1（4進法）", GRAY, 11),
]))

# ══ No.3 大問6（HG-1013）線分の三等分を入れ子に（A・B・C） ═══════════════
_b13 = []
_b13 += [ln(40, 40, 340, 40, LINE, 2.4)]
for i, lab in enumerate(["A", "B", "C"]):
    _b13 += [ln(40 + i * 100, 30, 40 + i * 100, 50, GRAY, 1.4), t(40 + i * 100 + 50, 26, lab, TX, 13)]
_b13 += [ln(340, 30, 340, 50, GRAY, 1.4), t(190, 60, "第1図", GRAY, 11)]
_b13 += [ln(40, 100, 340, 100, LINE, 2.4)]
_labs2 = ["AA", "AB", "AC", "BA", "BB", "BC", "CA", "CB", "CC"]
for i, lab in enumerate(_labs2):
    x = 40 + i * (300 / 9)
    _b13 += [ln(x, 90, x, 110, GRAY, 1.1), t(x + 300 / 18, 122, lab, TX, 9)]
_b13 += [t(190, 138, "第2図（さらに三等分）", GRAY, 11)]
FIGS["HG-1013"] = svg("0 0 380 170", "".join(_b13 + [
    t(190, 160, "線分を三等分してA・B・C、各部分をさらに三等分…をくり返す", GRAY, 11),
]))

# ══ No.8 大問4（HG-1028）かぎ形（L字）の表 ═══════════════════════════
FIGS["HG-1028"] = svg("0 0 340 230", "".join(
    grid_table(50, 20, 46, [[1, 2, 5, 10], [4, 3, 6, 11], [9, 8, 7, 12], [16, 15, 14, 13]]) + [
        t(130, 220, "上から3行目・左から2列目の数8を(3,2)と表す", GRAY, 11),
    ]
))

# ══ No.8 大問5（HG-1029）蛇行（行の偶奇で列が反転）の表 ═══════════════
FIGS["HG-1029"] = svg("0 0 340 230", "".join(
    grid_table(50, 20, 46, [[1, 2, 3, 4], [8, 7, 6, 5], [9, 10, 11, 12], [16, 15, 14, 13]]) + [
        t(130, 220, "上から3行目・左から4列目の数14を(3,4)と表す", GRAY, 11),
    ]
))

# ══ No.9 大問3（HG-1031）A・B・C・Dの4列表（4で割った余りで分類） ═══════
FIGS["HG-1031"] = svg("0 0 360 240", "".join(
    grid_table(50, 30, 46, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]])
    + [t(50 + c * 46 + 23, 22, lab, TX, 12) for c, lab in enumerate(["A", "B", "C", "D"])]
    + [t(130, 230, "1から4個ずつA・B・C・Dに分けた表（このさき…と続く）", GRAY, 11)]
))

# ══ No.9 大問5（HG-1032）5gで1回転するはかり（円形の文字盤） ═══════════
FIGS["HG-1032"] = svg("0 0 280 190", "".join(dial(130, 90, 56, 5, 0, "") + [
    t(130, 172, "5gごとに針が1回転する文字盤（0〜4の5めもり）", GRAY, 11),
]))

# ══ No.17 大問5（HG-1058）A地点に赤・青・黄の旗、120m先のB地点 ═════════
_b58 = []
for i, (dy, col, lab) in enumerate([(-30, "#ff6b6b", "赤"), (-14, LINE, "青"), (2, HI, "黄")]):
    _b58.append(poly([(60, 60 + dy), (100, 60 + dy + 8), (60, 60 + dy + 16)], col, 1.6, col))
FIGS["HG-1058"] = svg("0 0 360 140", "".join(_b58 + [
    ln(60, 100, 60, 40, GRAY, 2),
    ln(60, 100, 320, 100, LINE, 2.5), dot(60, 100, 3.5), dot(320, 100, 3.5),
    t(60, 120, "A", TX, 13), t(320, 120, "B", TX, 13),
    dim(60, 100, 320, 100, "120m", 16, 1),
    t(180, 20, "2mごとに赤旗・3mごとに青旗・4mごとに黄旗を立てる", GRAY, 11),
]))

# ══ No.19 大問5（HG-1066）正六角形A→B→C→D→E→F→A（一方向のみ） ══════
_hexcx, _hexcy, _hexr = 150, 100, 70
_hexpts = []
for i in range(6):
    a = math.radians(-90 + i * 60)
    _hexpts.append((_hexcx + _hexr * math.cos(a), _hexcy + _hexr * math.sin(a)))
_hb = [poly(_hexpts, LINE, 2)]
for i, lab in enumerate(["A", "B", "C", "D", "E", "F"]):
    x, y = _hexpts[i]
    dx, dy = (x - _hexcx) * 0.22, (y - _hexcy) * 0.22
    _hb.append(t(x + dx, y + dy + 4, lab, TX, 14))
FIGS["HG-1066"] = svg("0 0 320 220", "".join(_hb + [
    t(150, 210, "A→B→C→D→E→F→Aの一方向に、出た目の数だけまわる", GRAY, 11),
]))

# ══ No.23 大問4（HG-1074）1辺6cmの正方形/正六角形に接する円 ═══════════
_b74 = [rect(40, 40, 100, 100, LINE, 2), circ(90, 90, 50, LINE, 2),
        dim(40, 40, 140, 40, "6cm", 16, -1), t(90, 158, "(1) 正方形（1辺=直径）", GRAY, 11)]
_hex74 = []
for i in range(6):
    a = math.radians(-90 + i * 60)
    _hex74.append((230 + 50 * math.cos(a), 90 + 50 * math.sin(a)))
_b74 += [circ(230, 90, 50, LINE, 2), poly(_hex74, LINE, 2),
         dim(_hex74[0][0], _hex74[0][1], _hex74[1][0], _hex74[1][1], "6cm", 12, 1),
         t(230, 158, "(2) 正六角形（1辺=半径）", GRAY, 11)]
FIGS["HG-1074"] = svg("0 0 320 175", "".join(_b74))

# ══ No.21 大問4（HG-1076）横長長方形をZ字状の境界で4分割 ════════════
FIGS["HG-1076"] = svg("0 0 380 150", "".join([
    rect(40, 30, 300, 80, LINE, 2),
    pline([(105, 30), (105, 55), (130, 55), (130, 110)], LINE, 2),
    ln(190, 30, 190, 110, LINE, 2),
    pline([(280, 30), (280, 85), (305, 85), (305, 110)], LINE, 2),
    t(70, 74, "A", TX, 14), t(150, 74, "B", TX, 14), t(230, 74, "C", TX, 14), t(320, 74, "D", TX, 14),
    t(190, 134, "赤・青・黄・黒の4色のうちで隣り合う部分がちがう色になるようぬり分ける", GRAY, 11),
]))

# ══ No.22 大問4（HG-1077）印のついた角度の和（(1)(3)(4)のみ・(2)は保留） ══
_p77 = []
# (1) 平行な2直線と交わる線
_p77 += [ln(30, 90, 130, 40, LINE, 1.8), ln(30, 60, 130, 90, LINE, 1.8),
         ln(60, 100, 100, 30, LINE, 1.8), t(75, 42, "(1)", GRAY, 11)]
# (3) 星形五角形（の尖り5つ）
_cx3, _cy3, _r3 = 230, 90, 46
_star = []
for i in range(5):
    a = math.radians(-90 + i * 144)
    _star.append((_cx3 + _r3 * math.cos(a), _cy3 + _r3 * math.sin(a)))
_p77 += [poly(_star, LINE, 1.8), t(230, 42, "(3) 星形五角形", GRAY, 11)]
# (4) 自己交差する七角形（簡略に星型で代用）
_cx4, _cy4, _r4 = 330, 90, 46
_star7 = []
for i in range(7):
    a = math.radians(-90 + i * (360 * 3 / 7))
    _star7.append((_cx4 + _r4 * math.cos(a), _cy4 + _r4 * math.sin(a)))
_p77 += [poly(_star7, LINE, 1.6), t(330, 42, "(4) 自己交差する七角形", GRAY, 10)]
FIGS["HG-1077"] = svg("0 0 400 150", "".join(_p77 + [
    t(200, 140, "印のついた角（先端の角）の和を求める", GRAY, 11),
]))

# ══ No.25 大問3（HG-1101）30°をはさむ2辺の三角形 ═══════════════════
def tri30(x0, y0, s1, s2, lab1, lab2):
    a = math.radians(-30)
    p2 = (x0 + s1, y0)
    p3 = (x0 + s2 * math.cos(a), y0 + s2 * math.sin(a))
    r = 20  # 角の弧の半径
    arc = path("M%.1f,%.1f A%d %d 0 0 0 %.1f,%.1f" % (x0 + r, y0, r, r, x0 + r * math.cos(a), y0 + r * math.sin(a)),
                GRAY, 1.4)
    return [poly([(x0, y0), p2, p3], LINE, 2), arc,
            t(x0 + r + 14, y0 - 8, "30°", TX, 12),
            t((x0 + p2[0]) / 2, y0 + 16, lab1, TX, 11),
            t((x0 + p3[0]) / 2 - 10, (y0 + p3[1]) / 2, lab2, TX, 11)]


FIGS["HG-1101"] = svg("0 0 320 190", "".join(
    tri30(40, 120, 100, 70, "12cm", "10cm") + tri30(190, 120, 90, 80, "24cm", "28cm") + [
        t(160, 178, "30°をはさむ2辺だけが与えられた三角形（高さは書かれていない）", GRAY, 11),
    ]
))

# ══ No.26 大問6（HG-1103）直角三角形＋内接円（60・36・48cm） ══════════
_A103, _B103, _C103 = (60, 160), (60, 40), (280, 160)
FIGS["HG-1103"] = svg("0 0 340 220", "".join([
    poly([_A103, _B103, _C103], LINE, 2),
    '<circle cx="140" cy="128" r="32" fill="none" stroke="%s" stroke-width="1.8"/>' % HI,
    dot(140, 128, 3, TX), t(150, 122, "O", TX, 12),
    ln(140, 128, *_A103, GRAY, 1.2), ln(140, 128, *_B103, GRAY, 1.2), ln(140, 128, *_C103, GRAY, 1.2),
    t(45, 165, "B", TX, 13), t(45, 36, "A", TX, 13), t(290, 165, "C", TX, 13),
    dim(_A103[0], _A103[1], _B103[0], _B103[1], "36cm", 14, -1),
    dim(_A103[0], _A103[1], _C103[0], _C103[1], "48cm", 26, 1),
    dim(_B103[0], _B103[1], _C103[0], _C103[1], "60cm", 14, -1),
    t(170, 208, "直角三角形ABC（直角B）に内接する円。Oは中心", GRAY, 11),
]))

# ══ No.27 大問2（HG-1105）直径36cm半円＋直角三角形ABC（重なりあり） ═════
FIGS["HG-1105"] = svg("0 0 340 180", "".join([
    '<path d="M40,130 A130 130 0 0 1 300,130" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    ln(40, 130, 300, 130, LINE, 2),
    poly([(40, 130), (300, 130), (300, 30)], HI, 1.8),
    t(30, 140, "A", TX, 13), t(310, 140, "B", TX, 13), t(310, 26, "C", TX, 13),
    t(170, 165, "直径36cmの半円＋直角三角形ABC（直角B）を重ねた図形", GRAY, 11),
]))

# ══ No.28 大問3（HG-1107）40人の算数・国語の点数分布表 ══════════════
_pts = ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "0"]
_sansu = ["2", "4", "6", "8", "8", "6", "4", "2", "0", "0", "0"]
_kokugo = ["1", "3", "5", "㋐", "㋑", "4", "4", "2", "2", "0", "0"]
CW28, X028 = 26, 40
_b107 = [t(20, 12, "算数の点数", TX, 12, "start")]
for c, (p, n) in enumerate(zip(_pts, _sansu)):
    _b107 += [rect(X028 + c * CW28, 20, CW28, 22, LINE, 1.2), t(X028 + c * CW28 + CW28 / 2, 35, p, TX, 10),
              rect(X028 + c * CW28, 42, CW28, 22, LINE, 1.2), t(X028 + c * CW28 + CW28 / 2, 57, n, TX, 10)]
_b107 += [t(20, 94, "国語の点数", TX, 12, "start")]
for c, (p, n) in enumerate(zip(_pts, _kokugo)):
    _b107 += [rect(X028 + c * CW28, 102, CW28, 22, LINE, 1.2), t(X028 + c * CW28 + CW28 / 2, 117, p, TX, 10),
              rect(X028 + c * CW28, 124, CW28, 22, LINE, 1.2),
              t(X028 + c * CW28 + CW28 / 2, 139, n, HI if n in ("㋐", "㋑") else TX, 10)]
FIGS["HG-1107"] = svg("0 0 380 175", "".join(_b107 + [
    t(190, 165, "40人の算数・国語の点数分布表（国語の7点欄が㋐・6点欄が㋑）", GRAY, 11),
]))

# ══ No.30 大問6（HG-1113）3cm正方形を2cmずつ重ねて並べる（1,3,7,12個） ═
_b113 = []
for i, n in enumerate([1, 2, 3, 4]):
    x0 = 20 + i * 90
    for k in range(n):
        _b113.append(rect(x0 + k * 12, 20 + k * 12, 36, 36, LINE, 1.6))
    _b113.append(t(x0 + 18, 84, "%d枚" % n, GRAY, 10))
FIGS["HG-1113"] = svg("0 0 380 140", "".join(_b113 + [
    t(190, 128, "1辺3cmの正方形を、重なりが2cmずつになるよう右下へずらして重ねる", GRAY, 11),
]))

# ══ No.30 大問7（HG-1114）1cm正方形を左右対称に階段状（4段=16個） ═════
_b114 = []
CS114 = 14
for row in range(4):
    n = 2 * row + 1
    y = 20 + (3 - row) * CS114
    x0 = 150 - n * CS114 / 2
    for k in range(n):
        _b114.append(rect(x0 + k * CS114, y, CS114, CS114, LINE, 1.3))
FIGS["HG-1114"] = svg("0 0 300 130", "".join(_b114 + [
    t(150, 116, "1辺1cmの正方形を左右対称に積む（4段で16個・まわり22cm）", GRAY, 11),
]))

# ══ No.34 大問5（HG-1124）3×3のます目に積む個数（2つの配置） ═══════════
FIGS["HG-1124"] = svg("0 0 340 190", "".join(
    grid_table(40, 20, 40, [[4, 3, 2], [3, 4, 3], [2, 3, 4]])
    + grid_table(220, 20, 40, [[2, 4, 2], [4, 3, 4], [2, 4, 2]])
    + [t(100, 160, "(1)", GRAY, 12), t(280, 160, "(2)", GRAY, 12),
       t(170, 180, "3×3のますに積む個数。外から見える面だけシールをはる", GRAY, 11)]
))

# ══ No.35 大問1（HG-1125）階段（Z字）型の展開図・14個の頂点記号 ═══════
_cells = [(1, 0, "ア"), (2, 0, "セ"), (0, 1, "ウ"), (1, 1, "イ"), (2, 1, "ス"), (3, 1, "シ"),
          (0, 2, "エ"), (1, 2, "オ"), (2, 2, "カ"), (3, 2, "サ"), (4, 2, "コ"),
          (2, 3, "キ"), (3, 3, "ク"), (4, 3, "ケ")]
_labels_pos = {"ア": (1.5, 0), "セ": (2.5, 0), "ウ": (0, 1), "イ": (1, 1), "ス": (2, 1), "シ": (3, 1),
               "エ": (0, 2), "オ": (1, 2), "カ": (2, 2), "サ": (3, 2), "コ": (4, 2),
               "キ": (2, 3), "ク": (3, 3), "ケ": (4, 3)}
_faceA = [(1, 0), (2, 0), (2, 1), (1, 1)]  # 面Ⓐ
_faceB = [(1, 1), (2, 1), (2, 2), (1, 2)]  # 面Ⓑ
_faceC = [(2, 1), (3, 1), (3, 2), (2, 2)]  # 面Ⓒ
_faceD = [(3, 1), (4, 1), (4, 2), (3, 2)]  # 面Ⓓ
_faceE = [(2, 2), (3, 2), (3, 3), (2, 3)]  # 面Ⓔ
_faceF = [(3, 2), (4, 2), (4, 3), (3, 3)]  # 面Ⓕ
CS125 = 42
OX125, OY125 = 50, 30
_net = []
for cells, lab in [(_faceA, "Ⓐ"), (_faceB, "Ⓑ"), (_faceC, "Ⓒ"), (_faceD, "Ⓓ"), (_faceE, "Ⓔ"), (_faceF, "Ⓕ")]:
    xs = [c[0] for c in cells]
    ys = [c[1] for c in cells]
    x0, y0 = min(xs) * CS125 + OX125, min(ys) * CS125 + OY125
    _net.append(rect(x0, y0, CS125, CS125, LINE, 1.8))
    _net.append(t(x0 + CS125 / 2, y0 + CS125 / 2 + 4, lab, TX, 14))
_ctr_cx, _ctr_cy = 2, 1.5  # 展開図全体の中心（頂点ラベルをここから外向きにずらす）
for lab, (cx, cy) in _labels_pos.items():
    px, py = cx * CS125 + OX125, cy * CS125 + OY125
    dx, dy = cx - _ctr_cx, cy - _ctr_cy
    dl = math.hypot(dx, dy) or 1
    px += dx / dl * 11
    py += dy / dl * 11 + 3
    _net.append(t(px, py, lab, HI, 11))
FIGS["HG-1125"] = svg("0 0 330 200", "".join(_net + [
    t(165, 190, "階段状の展開図。頂点にア〜セの14記号（一部が重なる）", GRAY, 11),
]))

# ══ No.41 大問6（HG-1137）長方形ABCD(12×30)・P点AD往復/Q点BC往復 ═══════
AX137, AY137, W137, H137 = 60, 30, 220, 90
FIGS["HG-1137"] = svg("0 0 340 195", "".join([
    rect(AX137, AY137, W137, H137, LINE, 2),
    t(AX137 - 10, AY137 + 4, "A", TX, 13, "end"), t(AX137 + W137 + 10, AY137 + 4, "D", TX, 13, "start"),
    t(AX137 - 10, AY137 + H137 + 4, "B", TX, 13, "end"),
    t(AX137 + W137 + 10, AY137 + H137 + 4, "C", TX, 13, "start"),
    dim(AX137, AY137, AX137, AY137 + H137, "12cm", 14, -1),
    dim(AX137, AY137 + H137, AX137 + W137, AY137 + H137, "30cm", 24, 1),
    t(170, 175, "点PはAからDへ毎秒1cmでAD間を1往復。点QはBからCへ毎秒2cmでBC間を1往復", GRAY, 11),
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
