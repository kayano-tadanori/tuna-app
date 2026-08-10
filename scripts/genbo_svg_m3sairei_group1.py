# -*- coding: utf-8 -*-
"""小3最レで「図: あり」なのに図SVGが無かった分の1バッチ（18本）を、PDFの実物を見て原簿に入れる。

★根拠：3年最レ算数 実力_No.1〜No.23.pdf（G:\\マイドライブ\\浜問題\\3年算数最レ\\）を
  110〜200dpiで出して目視。原簿に図は入っていないのでここが唯一の根拠
  （feedback_zu_wa_genbo_ni_nai）。

★ページの並びが月日どおりではない（5月2回目=No.7が5月1回目=No.6より前のページに
  ある）ことが分かった。ページ番号からの推測をやめ、1本ずつ内容を照合して確定した。

実物で確かめたページ対応：
  HG-0301 … p1（実力2月1回目）大問4。1cm方眼、横5マス×たて3マス
  HG-0311 … p15（No.6）大問2。4×4方眼の5進法（下から積み上げてぬる）
  HG-0314 … p15（No.6）大問5。3連ダイヤル（C・B・A、どれも0〜3の4めもり）
  HG-0322 … p7（No.3）大問7。☆▲■の3行対応表
  HG-0344 … p40（No.20）大問4。通話時間と料金の階段グラフ（●含む／○含まない）
  HG-0349 … p46（No.23）大問4。山-谷-川-海の三角運賃表（山-海だけ空欄）
  HG-0351 … p46（No.23）大問6。5×5の硬貨表（たて・よこの合計つき）
  HG-0376 … p24（No.12）大問2。0,4,5,6のカード（6は9にひっくり返せる）
  HG-0377 … p24（No.12）大問3。0,1,2,3,5のカード（すべて表。裏は表+3）
  HG-0411 … p42（No.21）大問2。見取り図5つ（ア=2個の見本／イ〜オ）
  HG-0412 … p42（No.21）大問3。展開図の一部2つ（あと1まいで完成）
  HG-0414 … p42（No.21）大問7。さいころをn×nにならべた見取り図（図1〜3で例示）
  HG-0416 … p44（No.22）大問3。直方体・すい・立方体・円柱の4つ（③④は逆算）
  HG-0421 … p32（No.16）大問7。円周上に1〜60・18とびごとに○
  HG-0422 … p32（No.16）大問6。輪をつないだくさり（8mm太さ・4cm1個分）
  HG-0423 … p32（No.16）大問2。白3cm赤5cm黒7cmテープをのりしろ1cmで
  HG-0424 … p34（No.17）大問5。等脚台形タイルのリング（Xの角）
  HG-0425 … p34（No.17）大問6。正方形ABCDの二重折り返し（角X）

★HG-1409（No.7 大問7・水そうを倒す問題）は、このPDFのNo.7（p13-14）には
  大問6までしか無く、該当する図が見つからなかった。**保留**（描いていない）。
  本人に確認が必要（[[feedback_zu_wa_genbo_ni_nai]] に記録）。

使い方: python scripts/genbo_svg_m3sairei_group1.py [--write]
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
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none"):
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (pts(seq), fill, stroke, w)


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
        lx = cx + (r + 16) * math.cos(ang)
        ly = cy + (r + 16) * math.sin(ang) + 4
        out.append(t(lx, ly, str(i), color, 12))
    a = math.radians(-90 + needle_val * 360.0 / n)
    out.append(ln(cx, cy, cx + r * 0.72 * math.cos(a), cy + r * 0.72 * math.sin(a), HI, 2.2))
    out.append(dot(cx, cy, 2.6, TX))
    out.append(t(cx, cy - r - 26, label, TX, 15))
    return out


FIGS = {}

# ══ 実力(2月1回目) 大問4（HG-0301）1cm方眼 横5×たて3 ══════════════════════
_g1 = []
for r in range(3):
    for c in range(5):
        _g1.append(rect(60 + c * 30, 30 + r * 30, 30, 30, LINE, 1.4))
FIGS["HG-0301"] = svg("0 0 320 150", "".join(_g1 + [
    t(160, 140, "1辺1cmの正方形を横5・たて3にすきまなくならべた図", GRAY, 11),
]))

# ══ No.6 大問2（HG-0311）4×4方眼の5進法（例：9＝2列目1マス+右端4マス）══════
GX, GY, CS = 90, 30, 32
_g2 = [rect(GX + c * CS, GY + r * CS, CS, CS, LINE, 1.4) for r in range(4) for c in range(4)]
# 9の例：右端列(c=3)を4マスぬり、2列目(c=2)を下から1マスぬる
_g2 += [rect(GX + 3 * CS, GY + r * CS, CS, CS, HI, 1.4, "rgba(255,209,102,0.35)") for r in range(4)]
_g2 += [rect(GX + 2 * CS, GY + 3 * CS, CS, CS, HI, 1.4, "rgba(255,209,102,0.35)")]
for c, lab in enumerate(["125", "25", "5", "1"]):
    _g2.append(t(GX + c * CS + CS / 2, GY - 10, lab, GRAY, 11))
FIGS["HG-0311"] = svg("0 0 380 240", "".join(_g2 + [
    t(160, 190, "各列は下から順にぬる。ぬったマス数がその列の数字(0〜4)", GRAY, 11),
    t(160, 208, "例：9＝右端(1の位)4マス＋左から2列目(5の位)1マス", GRAY, 11),
    t(160, 226, "位は右から 1・5・25・125（4こでくり上がる＝5進法）", GRAY, 11),
]))

# ══ No.6 大問5（HG-0314）3連ダイヤル C・B・A（0〜3の4めもり）══════════════
_d1 = dial(85, 118, 38, 4, 3, "A")
_d2 = dial(240, 118, 38, 4, 2, "B")
_d3 = dial(395, 118, 38, 4, 1, "C")
FIGS["HG-0314"] = svg("0 0 480 210", "".join(_d1 + _d2 + _d3 + [
    t(240, 190, "10円玉1まいでAが1めもり。Aが1まわり→B、Bが1まわり→C。図は(3,2,1)の状態", GRAY, 11),
]))

# ══ No.3 大問7（HG-0322）☆▲■の3行対応表 ═══════════════════════════════
CW3, CH3, X03, Y03 = 46, 30, 96, 40
_labs = ["☆", "▲", "■"]
_vals = [["1", "2", "3", "…", "15", "…", "⑦"], ["90", "87", "84", "…", "48", "…", "6"],
         ["13", "17", "21", "…", "69", "…", "①"]]
_g3 = [rect(X03 - 60, Y03 + r * CH3, 60, CH3, LINE, 1.6) for r in range(3)]
_g3 += [t(X03 - 30, Y03 + r * CH3 + 20, _labs[r], TX, 14) for r in range(3)]
for c in range(7):
    for r in range(3):
        _g3.append(rect(X03 + c * CW3, Y03 + r * CH3, CW3, CH3, LINE, 1.4))
        _g3.append(t(X03 + c * CW3 + CW3 / 2, Y03 + r * CH3 + 20, _vals[r][c], TX, 12))
FIGS["HG-0322"] = svg("0 0 430 160", "".join(_g3 + [
    t(215, 150, "☆が1増えるごとに▲は3減り、■は4増える", GRAY, 11),
]))

# ══ No.20 大問4（HG-0344）通話料金の階段グラフ ══════════════════════════
GX4, GY4, GKX, GKY = 60, 190, 55, 32
_g4 = [ln(GX4, GY4 - k * GKY, GX4 + 6 * GKX, GY4 - k * GKY, GRAY, 0.8) for k in range(5)]
_g4 += [ln(GX4 + i * GKX, GY4, GX4 + i * GKX, 20, GRAY, 0.8) for i in range(7)]
_g4 += [ln(GX4, GY4, GX4 + 6 * GKX, GY4, GRAY, 1.8), ln(GX4, GY4, GX4, 20, GRAY, 1.8)]
for k, lab in enumerate(["10", "20", "30", "40"]):
    _g4.append(t(GX4 - 10, GY4 - (k + 1) * GKY + 4, lab, TX, 11, "end"))
for i in range(7):
    _g4.append(t(GX4 + i * GKX, GY4 + 18, str(i), TX, 11))
_steps = [(0, 1.5, 10), (1.5, 3.0, 20), (3.0, 4.5, 30), (4.5, 6.0, 40)]
for x0, x1, yen in _steps:
    y = GY4 - (yen / 10) * GKY
    _g4.append(ln(GX4 + x0 * GKX, y, GX4 + x1 * GKX, y, LINE, 2.4))
    _g4.append(dot(GX4 + x0 * GKX, y, 3.4, TX))
    _g4.append('<circle cx="%s" cy="%s" r="3.4" fill="none" stroke="%s" stroke-width="1.6"/>' % (
        r1(GX4 + x1 * GKX), r1(y), TX))
FIGS["HG-0344"] = svg("0 0 400 270", "".join(_g4 + [
    t(GX4 - 40, 100, "円", GRAY, 11), t(GX4 + 3 * GKX, 232, "分", GRAY, 11),
    t(220, 254, "●はふくむ／○はふくまない。1分30秒ごとに10円ずつ上がる", GRAY, 11),
]))

# ══ No.23 大問4（HG-0349）山-谷-川-海の三角運賃表（山-海は空欄） ═══════════
FIGS["HG-0349"] = svg("0 0 380 190", "".join([
    dot(190, 40, 4.5), dot(80, 100, 4.5), dot(190, 130, 4.5), dot(300, 100, 4.5),
    t(190, 24, "山", TX, 14), t(60, 100, "谷", TX, 14, "end"), t(190, 150, "川", TX, 14),
    t(320, 100, "海", TX, 14, "start"),
    ln(190, 40, 80, 100, LINE, 1.8), ln(190, 40, 190, 130, LINE, 1.8),
    ln(190, 40, 300, 100, LINE, 1.8, "5 4"),
    ln(80, 100, 190, 130, LINE, 1.8), ln(80, 100, 300, 100, LINE, 1.8),
    ln(190, 130, 300, 100, LINE, 1.8),
    t(120, 62, "120円", TX, 12), t(200, 90, "180円", TX, 12), t(240, 55, "?", HI, 14),
    t(115, 122, "150円", TX, 12), t(190, 108, "190円", TX, 12), t(255, 108, "130円", TX, 12),
    t(190, 178, "大人1人のかた道運賃。山-海だけ空欄", GRAY, 11),
]))

# ══ No.23 大問6（HG-0351）5×5の硬貨表（たて・よこ合計つき） ══════════════
CS6, GX6, GY6 = 40, 90, 30
_g6 = [rect(GX6 + c * CS6, GY6 + r * CS6, CS6, CS6, LINE, 1.4) for r in range(5) for c in range(5)]
for r, s in enumerate(["80", "90", "85", "115", "210"]):
    _g6.append(t(GX6 + 5 * CS6 + 22, GY6 + r * CS6 + CS6 / 2 + 4, s, TX, 12))
for c, s in enumerate(["75", "130", "250", "80", "45"]):
    _g6.append(t(GX6 + c * CS6 + CS6 / 2, GY6 + 5 * CS6 + 20, s, TX, 12))
FIGS["HG-0351"] = svg("0 0 380 260", "".join(_g6 + [
    t(GX6 + 5 * CS6 + 22, GY6 - 12, "合計", GRAY, 10),
    t(GX6 + 2 * CS6, GY6 + 5 * CS6 + 40, "合計", GRAY, 10),
    t(190, 242, "5円・10円・50円が合わせて25まい。5円=○/10円=△/50円=×を書きこむ", GRAY, 11),
]))

# ══ No.12 大問2（HG-0376）0,4,5,6のカード（6は9にできる） ═════════════════
_cd = []
for i, lab in enumerate(["0", "4", "5", "6"]):
    x = 60 + i * 70
    _cd += [rect(x, 30, 54, 66, LINE, 2), t(x + 27, 70, lab, TX, 22)]
FIGS["HG-0376"] = svg("0 0 340 130", "".join(_cd + [
    t(170, 118, "4まいから3まいで3けたの数を作る（6は9にひっくり返せる）", GRAY, 11),
]))

# ══ No.12 大問3（HG-0377）0,1,2,3,5のカード（すべて表・裏は表+3） ═══════════
_cd2 = []
for i, lab in enumerate(["0", "1", "2", "3", "5"]):
    x = 40 + i * 62
    _cd2 += [rect(x, 30, 50, 62, LINE, 2), t(x + 25, 68, lab, TX, 20)]
FIGS["HG-0377"] = svg("0 0 360 130", "".join(_cd2 + [
    t(180, 118, "5まいすべて表向き（裏の数は表より3大きい・見えない）", GRAY, 11),
]))

# ══ No.21 大問2（HG-0411）見取り図5つ（ア=見本2個／イ〜オ） ══════════════
def block(x0, y0, cols, rows, cs=16):
    return [rect(x0 + c * cs, y0 + r * cs, cs, cs, LINE, 1.3)
            for r in range(rows) for c in range(cols)]


def lshape(x0, y0, cs=16):
    cells = [(0, 0), (1, 0), (2, 0), (0, 1), (0, 2)]
    return [rect(x0 + c * cs, y0 + r * cs, cs, cs, LINE, 1.3) for c, r in cells]


_b = []
_b += block(30, 60, 2, 1) + [t(50, 100, "ア(見本)", TX, 11)]
_b += block(110, 60, 3, 1) + [t(140, 100, "イ", TX, 11)]
_b += block(190, 44, 3, 2) + [t(220, 100, "ウ", TX, 11)]
_b += lshape(270, 44) + [t(290, 100, "エ", TX, 11)]
_b += block(350, 28, 3, 3) + [t(378, 100, "オ", TX, 11)]
FIGS["HG-0411"] = svg("0 0 440 120", "".join(_b))

# ══ No.21 大問3（HG-0412）展開図の一部2つ（あと1まいで完成） ═════════════
def net(cells, x0, y0, cs=26, labels=None):
    out = []
    labels = labels or {}
    for (c, r) in cells:
        out.append(rect(x0 + c * cs, y0 + r * cs, cs, cs, LINE, 1.6))
    for (c, r), lab in labels.items():
        out.append(t(x0 + c * cs + cs / 2, y0 + r * cs + cs / 2 + 4, lab, HI, 11))
    return out


_n1 = [(0, 0), (1, 0), (2, 0), (3, 0), (1, 1)]
_n1_lab = {(0, 0): "ク", (1, 0): "ケ", (2, 0): "コ", (3, 0): "サ"}
_n2 = [(1, 0), (2, 0), (3, 0), (0, 1), (1, 1)]
_n2_lab = {(1, 0): "カ", (2, 0): "ク", (0, 1): "ケ", (1, 1): "コ"}
FIGS["HG-0412"] = svg("0 0 400 190", "".join(
    net(_n1, 30, 30, 26, _n1_lab) + [t(120, 150, "①", TX, 13)]
    + net(_n2, 220, 30, 26, _n2_lab) + [t(310, 150, "②", TX, 13)]
    + [t(200, 178, "正方形5まいの展開図。あと1まい足して立方体を完成させる位置は複数ある", GRAY, 11)]
))

# ══ No.21 大問7（HG-0414）さいころをn×nにならべた見取り図（例n=3） ═══════
def dice_face(x, y, cs, pips):
    out = [rect(x, y, cs, cs, LINE, 1.4)]
    P = {1: [(0.5, 0.5)], 2: [(0.25, 0.25), (0.75, 0.75)],
         3: [(0.25, 0.25), (0.5, 0.5), (0.75, 0.75)],
         4: [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)],
         5: [(0.25, 0.25), (0.75, 0.25), (0.5, 0.5), (0.25, 0.75), (0.75, 0.75)],
         6: [(0.25, 0.2), (0.75, 0.2), (0.25, 0.5), (0.75, 0.5), (0.25, 0.8), (0.75, 0.8)]}[pips]
    for px, py in P:
        out.append(dot(x + px * cs, y + py * cs, cs * 0.07, TX))
    return out


_dd = []
CS7 = 30
for r in range(3):
    for c in range(3):
        _dd += dice_face(60 + c * CS7, 30 + r * CS7, CS7, (r * 3 + c) % 6 + 1)
FIGS["HG-0414"] = svg("0 0 340 180", "".join(_dd + [
    t(170, 156, "対面の和7のさいころを同じ向きにそろえてn×n・高さ1段にならべる", GRAY, 11),
    t(170, 172, "図1=1個・図2=2×2・図3=3×3（この図は3×3の例）", GRAY, 11),
]))

# ══ No.22 大問3（HG-0416）直方体・すい・立方体・円柱の4つ ══════════════
_s1 = [rect(40, 40, 60, 40, LINE, 2), dim(40, 40, 100, 40, "5cm", 14, -1),
       dim(40, 40, 40, 80, "3cm", 16, -1), t(30, 100, "(奥行4cm)", GRAY, 10)]
_s2 = [poly([(220, 90), (250, 30), (280, 90)], LINE, 2), poly([(220, 90), (280, 90), (265, 100)], LINE, 2),
       dim(220, 90, 280, 90, "底辺10cm", 14, 1), t(268, 55, "斜高12cm", TX, 10)]
_s3 = [rect(360, 40, 50, 50, LINE, 2), dim(360, 40, 360, 90, "9cm", 14, -1),
       dim(360, 90, 410, 90, "5cm", 14, 1), t(430, 70, "高さ□", HI, 11)]
_c1 = ['<ellipse cx="90" cy="180" rx="14" ry="22" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
       ln(90, 158, 200, 158, LINE, 2), ln(90, 202, 200, 202, LINE, 2),
       '<ellipse cx="200" cy="180" rx="14" ry="22" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
       ln(90, 180, 104, 180, GRAY, 1.4), t(78, 175, "半径5cm", TX, 10, "end"),
       t(145, 220, "長さ□cm", HI, 11)]
FIGS["HG-0416"] = svg("0 0 460 240", "".join(_s1 + _s2 + _s3 + _c1 + [
    t(230, 232, "①直方体4×5×3 ②正四角すい(底辺10・斜高12) ③④は表面積から逆算", GRAY, 11),
]))

# ══ No.16 大問7（HG-0421）円周に1〜60・18とびごとに○ ═══════════════════
_ring = []
for i in range(1, 61):
    ang = math.radians(-90 + (i - 1) * 6)
    x = 200 + 115 * math.cos(ang)
    y = 128 + 115 * math.sin(ang)
    marked = (i - 1) % 6 == 0  # gcd(18,60)=6ごとに印がつく（1,7,13,...,55）
    if marked:
        _ring.append('<circle cx="%s" cy="%s" r="9" fill="none" stroke="%s" stroke-width="1.4"/>' % (
            round(x, 1), round(y, 1), HI))
    _ring.append(t(round(x, 1), round(y, 1) + 3.5, str(i), HI if marked else TX, 9.5))
FIGS["HG-0421"] = svg("0 0 400 280", "".join([
    '<circle cx="200" cy="128" r="95" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
] + _ring + [
    defs_arrow("ar421", HI),
    path("M155,20 A95 95 0 0 1 200,13", HI, 2, "none", ' marker-end="url(#ar421)"'),
    t(200, 260, "1から右回りに18とびごとに○（○＝1,7,13,…,55の6とび10個）", GRAY, 11),
]))

# ══ No.16 大問6（HG-0422）輪をつないだくさり（8mm太さ・4cm1個分） ═══════
_ch = []
for i in range(6):
    x = 60 + i * 32
    _ch.append('<ellipse cx="%s" cy="90" rx="20" ry="26" fill="none" stroke="%s" stroke-width="3"/>' % (r1(x), LINE))
FIGS["HG-0422"] = svg("0 0 320 170", "".join(_ch + [
    t(260, 90, "…", TX, 20),
    dim(60, 64, 92, 64, "4cm", 12, -1),
    dim(60, 116, 60, 138, "8mm", 12, 1),
    t(160, 152, "同じ輪をたくさんつないだくさり。輪1この長さ4cm・線の太さ8mm", GRAY, 11),
]))

# ══ No.16 大問2（HG-0423）白3cm赤5cm黒7cmテープをのりしろ1cmで ═══════════
_tp = []
_seq = [("白", 30), ("赤", 50), ("黒", 70), ("白", 30), ("赤", 50), ("黒", 70), ("白", 30)]
x = 30
for i, (lab, w) in enumerate(_seq):
    _tp.append(rect(x, 60, w, 30, LINE, 1.6))
    _tp.append(t(x + w / 2, 80, lab, TX, 12))
    if i < len(_seq) - 1:
        _tp.append(poly([(x + w - 6, 55), (x + w + 6, 55), (x + w, 62)], HI))
    x += w - 6
FIGS["HG-0423"] = svg("0 0 %d 130" % (x + 20), "".join(_tp + [
    t((x + 20) / 2, 118, "白3cm・赤5cm・黒7cmを のりしろ1cmずつ とって白赤黒の順につなぐ", GRAY, 11),
]))

# ══ No.17 大問5（HG-0424）等脚台形タイルのリング（Xの角） ══════════════════
_tile = [poly([(60, 60), (140, 60), (120, 100), (80, 100)], LINE, 2),
         t(70, 55, "X", TX, 12), t(130, 55, "X", TX, 12),
         t(100, 120, "⑦のタイル（上底が長い等脚台形）", GRAY, 11)]
_ring2 = ['<circle cx="270" cy="90" r="55" fill="none" stroke="%s" stroke-width="1.6" stroke-dasharray="3 4"/>' % GRAY]
for i in range(10):
    a0 = math.radians(i * 36 - 90 + 3)
    a1 = math.radians(i * 36 - 90 + 33)
    x0, y0 = 270 + 55 * math.cos(a0), 90 + 55 * math.sin(a0)
    x1, y1 = 270 + 55 * math.cos(a1), 90 + 55 * math.sin(a1)
    _ring2.append(path("M%.1f %.1f A55 55 0 0 1 %.1f %.1f" % (x0, y0, x1, y1), LINE, 3))
FIGS["HG-0424"] = svg("0 0 380 150", "".join(_tile + _ring2 + [
    t(270, 140, "⑦のように、すきまなくリング状につなぐ", GRAY, 11),
]))

# ══ No.17 大問6（HG-0425）正方形ABCDの二重折り返し（角X） ═══════════════
_sq = [rect(60, 40, 160, 160, LINE, 2),
       t(50, 38, "A", TX, 13, "end"), t(228, 38, "D", TX, 13, "start"),
       t(50, 208, "B", TX, 13, "end"), t(228, 208, "C", TX, 13, "start"),
       ln(60, 120, 220, 120, GRAY, 1.4), ln(140, 40, 140, 200, GRAY, 1.4),
       t(60, 116, "E", TX, 12, "end"), t(224, 116, "G", TX, 12, "start"),
       t(140, 34, "H", TX, 12), t(140, 214, "F", TX, 12),
       dot(60, 90, 3.5, HI), t(48, 88, "B'", HI, 12, "end"),
       ln(220, 200, 60, 90, HI, 1.8, "3 3"),
       t(78, 96, "X", HI, 13),
]
FIGS["HG-0425"] = svg("0 0 380 250", "".join(_sq + [
    t(140, 222, "角BをEGに、角DをHFに", GRAY, 11),
    t(140, 238, "重なるよう折り返す。E,F,G,Hは各辺の中点", GRAY, 11),
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
