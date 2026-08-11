# -*- coding: utf-8 -*-
"""学年5の公開学力テスト・灘中チャレンジ34本のうち、2023年度5年公開理科12本を、
   PDFの実物を見て原簿に入れる。

★根拠：G:\\マイドライブ\\浜問題\\公開学力テスト\\2023年度 5年公開理科.pdf を
  90〜200dpiで出して目視（feedback_zu_wa_genbo_ni_nai）。スキャン画像でテキストレイヤーなし。
  ページ対応（ヘッダー帯コンタクトシートで確認、回番号は連番ではない）：
    601回=p4-7(4枚)／602回=p12-15(4枚)／606回=p24-26(3枚)／608回=p29-32(4枚)／
    609回=p33-35(3枚)／610回=p37-39(3枚)

実物で確かめた図の内容（HG-1602/1617/1618/1633/1634/1637/1638/1639/1640/1641/1642/1645）：
  HG-1602 … 601回大問4。[図1]棒Xを銅P・アルミQ・鉄Rの3色帯で塗り分けA/B/C点。
            [図2][図3]は上下2段の帯＋「同じ長さ」の両矢印線。
  HG-1617 … 602回大問3。注射器4本の断面図。目盛り1〜7（下から）、ピストン先端に黒帯＋矢印、
            先端にねん土（黒）。[図3]は水（細かい点描）、[図4]は空気(上)+水(下、水面2)。
  HG-1618 … 602回大問4。[図1]棒の断面図＋黒四角3つ(A/B/C)＋寸法5,3,12,3,12,3,5cm。
            [図2]正方形の枠、D(左上)E(右上)F(中央)G(右下)、左下に加熱点※。
  HG-1633 … 606回大問2(3)。真上から見た図。中心に棒(白丸)、右斜め上へ黒い太い影が伸び、
            影の先端周りに矢印あ(上)い(右)う(下)え(左)。上方向にBラベル。
  HG-1634 … 606回大問3(2)。モノコードの見取り図（台形の箱＋弦＋ことじ2つ＋おもり）。
            表がメインで図は補助。
  HG-1637 … 609回大問3(1)-(4)。[図1]天井-ばね-おもりの基本形。[図2]横軸おもり重さ・
            縦軸ばねの長さのグラフに直線2本（ばねA:(0,15)-(60,25)、ばねB:(0,10)-(60,30)）。
            [図3]台の上に横向きのばねB、両端がかっ車を通り左右に60gのおもり。
  HG-1638 … 609回大問3(5)(6)。[図4]天井-ばねA-ばねB-30gおもり直列、①cm。
            [図5]天井-ばねA-30gおもり-ばねB-30gおもり直列、②cm。
            [図6]天井からばねA・ばねBが並んで下がり、下端に30cmの水平ぼう(15cm+15cm)、
            中央からおもりP。
  HG-1639/1640 … 609回大問4共通図。気体発生装置＝三角フラスコ(固体の薬品)＋活栓付き
            ろうと(液体の薬品)＋ガラス管、器具Sは活栓付きろうと上部のゴムせん部分を指す。
  HG-1641 … 608回大問2。太陽を中心に同心円2本（内側=金星軌道、外側=地球軌道）。
            下方向に太陽-金星-地球が一直線。金星の左右にC(左)D(右)矢印、
            地球の左右にA(左)B(右)矢印。
  HG-1642 … 608回大問3。[図1]-[図6]はてこ実験器（棒に1-9の穴、支点、おもり○の縦連ね、
            ばねはかり）。[図7][図8]は地面に置いた棒ABの一端をばねはかりで持ち上げる図。
            [図9]は棒ABの中央から吊るしBはしにおもり「う」。
  HG-1645 … 610回大問3。[図1]直列豆電球+直列かん電池の基本回路+点P。[図2]グラフ(3直線)。
            [図3]電池2個直列、豆電球2個直列の枝が2本並列(計4個)、点Qは主線上。
            [図4]電池2個直列、豆電球1個単独+2個直列の枝が2本並列(計5個)、点Rは主線上。
            [図5]電池2個直列、(2個並列×2段)のブロックが2つ直列(計8個)、点Sは主線上。
            電池・豆電球の描き方は[[feedback_denchi_kigou_sahou]]の battery2/bulb 方式を使用。

使い方: python scripts/genbo_svg_rika5_koukai2023_group1.py [--write]
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


def dbl_arrow(x1, y1, x2, y2, stroke=HI, w=1.6):
    ang = math.atan2(y2 - y1, x2 - x1)
    hl, ha = 8, 0.4
    out = [ln(x1, y1, x2, y2, stroke, w)]
    for (bx, by, a0) in ((x1, y1, ang), (x2, y2, ang + math.pi)):
        out.append(ln(bx, by, bx + hl * math.cos(a0 - ha), by + hl * math.sin(a0 - ha), stroke, w))
        out.append(ln(bx, by, bx + hl * math.cos(a0 + ha), by + hl * math.sin(a0 + ha), stroke, w))
    return "".join(out)


def unit(dx, dy):
    l = math.hypot(dx, dy)
    return (dx / l, dy / l)


# ── 電池・豆電球（feedback_denchi_kigou_sahou の作法） ──────────────
def battery2(x1, y1, x2, y2, plus_end=1, gap=18, stroke=TX):
    """乾電池の回路記号。x1,y1 -> x2,y2 の配線の途中に置く。
    plus_end=1ならx1側が＋極（長い薄線＋外向きの小さいでっぱり）、x2側が－極（短い太線）。plus_end=2ならその逆。"""
    ux, uy = unit(x2 - x1, y2 - y1)
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    px, py = -uy, ux
    half = gap / 2
    e1 = (mx - ux * half, my - uy * half)   # x1側の電極点
    e2 = (mx + ux * half, my + uy * half)   # x2側の電極点
    out = [ln(x1, y1, e1[0], e1[1], stroke, 1.8),
           ln(e2[0], e2[1], x2, y2, stroke, 1.8)]
    plus_pt, minus_pt = (e1, e2) if plus_end == 1 else (e2, e1)
    plus_out_dir = -1 if plus_pt is e1 else 1  # 電極の外側（配線から離れる方向）
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

# ══ HG-1602：3色帯（銅P・アルミQ・鉄R）＋A/B/C点、寸法帯2つ ═══════════
def hatch_rect(x, y, w, h, pattern, stroke=TX):
    out = [rect(x, y, w, h, stroke, 1.6)]
    if pattern == "P":  # 網かけ
        for i in range(1, 6):
            xx = x + w * i / 6
            out.append(ln(xx, y, xx, y + h, "#6a7aa8", 1))
    elif pattern == "R":  # 黒
        out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s"/>' %
                    (r1(x), r1(y), r1(w), r1(h), "#c9d4f0"))
    return "".join(out)


bx, by, bw, bh = 40, 60, 780, 34
segw = bw / 3
_b1602 = [
    hatch_rect(bx, by, segw, bh, "P"),
    rect(bx + segw, by, segw, bh, TX, 1.6),
    hatch_rect(bx + segw * 2, by, segw, bh, "R"),
    t(bx + segw * 0.5, by - 14, "A点", TX, 13),
    t(bx + segw * 1.5, by - 14, "B点", TX, 13),
    t(bx + segw * 2.5, by - 14, "C点", TX, 13),
    t(bx + segw * 0.5, by + bh + 22, "ぼうP（銅のぼう）", GRAY, 12),
    t(bx + segw * 1.5, by + bh + 22, "ぼうQ（アルミニウムのぼう）", GRAY, 12),
    t(bx + segw * 2.5, by + bh + 22, "ぼうR（鉄のぼう）", GRAY, 12),
    t(bx - 24, by + bh / 2 + 4, "左はし", TX, 12, "end"),
    t(bx + bw + 24, by + bh / 2 + 4, "右はし", TX, 12, "start"),
    ln(bx - 6, by + bh + 5, bx - 6, by + bh + 30, HI, 1.6),
    t(bx - 6, by + bh + 46, "加熱するところ", HI, 11),
    t(bx + bw / 2, by - 40, "ぼうX", TX, 14),
]
FIGS["HG-1602-1"] = svg("0 0 900 200", "".join(_b1602))

y2a, y2b = 40, 90
_b1602_2 = [
    dbl_arrow(bx, y2a - 14, bx + 400, y2a - 14),
    t(bx + 200, y2a - 24, "同じ長さ", GRAY, 12),
    hatch_rect(bx, y2a, 220, 26, "P"),
    t(bx + 300, y2a + 17, "100℃", TX, 12, "start"),
    ln(bx + 400 + 4, y2a, bx + 460, y2a, TX, 1.6), ln(bx + 400 + 4, y2a + 26, bx + 460, y2a + 26, TX, 1.6),
    t(bx + 110, y2a + 44, "ぼうP", GRAY, 12), t(bx + 310, y2a + 44, "ぼうQ", GRAY, 12),
    rect(bx, y2b, 400, 26, TX, 1.6),
    t(bx + 420, y2b + 17, "100℃", TX, 12, "start"),
    t(bx + 200, y2b + 44, "ぼうS", GRAY, 12),
]
FIGS["HG-1602-2"] = svg("0 0 620 150", "".join(_b1602_2))

y3a, y3b = 40, 90
_b1602_3 = [
    dbl_arrow(bx, y3a - 14, bx + 600, y3a - 14),
    t(bx + 300, y3a - 24, "同じ長さ", GRAY, 12),
    hatch_rect(bx, y3a, 220, 26, "P"),
    rect(bx + 220, y3a, 220, 26, TX, 1.6),
    hatch_rect(bx + 440, y3a, 160, 26, "R"),
    t(bx + 610, y3a + 17, "0℃", TX, 12, "start"),
    t(bx + 110, y3a + 44, "ぼうP", GRAY, 12), t(bx + 330, y3a + 44, "ぼうQ", GRAY, 12),
    t(bx + 520, y3a + 44, "ぼうR", GRAY, 12),
    rect(bx, y3b, 600, 26, TX, 1.6),
    t(bx + 620, y3b + 17, "0℃", TX, 12, "start"),
    t(bx + 300, y3b + 44, "ぼうT", GRAY, 12),
]
FIGS["HG-1602-3"] = svg("0 0 760 150", "".join(_b1602_3))

FIGS["HG-1602"] = svg("0 0 1520 560", "".join([
    '<g transform="translate(20,20)">%s</g>' % FIGS["HG-1602-1"].split(">", 1)[1][:-6],
    '<g transform="translate(20,260) scale(1.4)">%s</g>' % FIGS["HG-1602-2"].split(">", 1)[1][:-6],
    '<g transform="translate(900,260) scale(1.4)">%s</g>' % FIGS["HG-1602-3"].split(">", 1)[1][:-6],
]))
for k in ("HG-1602-1", "HG-1602-2", "HG-1602-3"):
    del FIGS[k]

# ══ HG-1617：注射器4本（目盛り1〜7・ピストン・ねん土・空気/水） ═══════
def syringe(x, y, w, scale_h, piston_mark, content, water_mark=None, weight_label=None):
    top, bot = y, y + scale_h
    out = [rect(x, top - 26, w, 26, TX, 1.8)]           # ピストンの持ち手部
    out.append(rect(x, top, w, scale_h, TX, 1.8))        # 目盛り筒
    for i in range(1, 8):
        yy = bot - (i - 1) / 6 * scale_h
        out.append(ln(x, yy, x + 8, yy, TX, 1.2))
        out.append(t(x - 10, yy + 4, str(i), GRAY, 10, "end"))
    piston_y = bot - (piston_mark - 1) / 6 * scale_h
    if content == "water":
        out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity="0.35"/>' %
                    (r1(x + 2), r1(piston_y), r1(w - 4), r1(bot - piston_y), "#c9d4f0"))
        for i in range(6):
            for j in range(2):
                out.append(circ(x + 8 + j * (w - 16), piston_y + 10 + i * (bot - piston_y - 10) / 6, 1, TX, 0.8, TX))
        out.append(t(x - 14, (piston_y + bot) / 2, "水", TX, 12, "end"))
    elif content == "air_water" and water_mark is not None:
        water_y = bot - (water_mark - 1) / 6 * scale_h
        out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s" opacity="0.3"/>' %
                    (r1(x + 2), r1(water_y), r1(w - 4), r1(bot - water_y), "#c9d4f0"))
        out.append(t(x - 14, (piston_y + water_y) / 2, "空気", TX, 11, "end"))
        out.append(t(x - 14, (water_y + bot) / 2, "水", TX, 12, "end"))
        out.append(ln(x + w + 4, water_y, x + w + 20, water_y, HI, 1.2))
        out.append(t(x + w + 24, water_y + 4, "水面", HI, 11, "start"))
    else:
        out.append(t(x - 14, (piston_y + bot) / 2, "空気", TX, 11, "end"))
    out.append('<rect x="%s" y="%s" width="%s" height="6" fill="%s"/>' %
                (r1(x - 1), r1(piston_y - 3), r1(w + 2), TX))
    out.append(ln(x + w + 6, piston_y, x + w + 22, piston_y, HI, 1.6))
    out.append(t(x + w + 26, piston_y + 4, str(piston_mark), HI, 12, "start"))
    out.append('<rect x="%s" y="%s" width="%s" height="10" fill="%s"/>' % (r1(x - 1), r1(bot), r1(w + 2), TX))
    if weight_label:
        out.append(rect(x + w / 2 - 22, top - 60, 44, 26, TX, 1.6))
        out.append(t(x + w / 2, top - 42, weight_label, TX, 11))
    return "".join(out)


_b1617 = [
    '<g transform="translate(40,90)">%s</g>' % syringe(0, 0, 40, 150, 4, "air"),
    t(20, -70, "[図1]", GRAY, 12),
    '<g transform="translate(220,90)">%s</g>' % syringe(0, 0, 40, 150, 3, "air", weight_label="100g"),
    t(20, -70, "[図2]", GRAY, 12),
    '<g transform="translate(420,90)">%s</g>' % syringe(0, 0, 40, 150, 4, "water"),
    t(20, -70, "[図3]", GRAY, 12),
    '<g transform="translate(620,90)">%s</g>' % syringe(0, 0, 40, 150, 4, "air_water", water_mark=2),
    t(20, -70, "[図4]", GRAY, 12),
]
FIGS["HG-1617"] = svg("0 -20 780 280", "".join(_b1617))

# ══ HG-1618：棒(A/B/C示温シール)＋正方形板(D/E/F/G/※) ══════════════
segs = [5, 3, 12, 3, 12, 3, 5]
xs = [0]
for sgw in segs:
    xs.append(xs[-1] + sgw)
totalw = xs[-1] * 14
_b1618a = [rect(0, 0, totalw, 26, TX, 1.8)]
labels_pos = {}
xx = 0
names = [None, "A", None, "B", None, "C", None]
for i, sgw in enumerate(segs):
    w_ = sgw * 14
    if names[i]:
        _b1618a.append('<rect x="%s" y="0" width="%s" height="26" fill="%s"/>' % (r1(xx), r1(w_), TX))
        _b1618a.append(t(xx + w_ / 2, 42, names[i], TX, 13))
        labels_pos[names[i]] = xx + w_ / 2
    _b1618a.append(t(xx + w_ / 2, -8, "%scm" % sgw, GRAY, 11))
    _b1618a.append(ln(xx, -14, xx, -4, GRAY, 1))
    _b1618a.append(ln(xx + w_, -14, xx + w_, -4, GRAY, 1))
    xx += w_
_b1618a.append(ln(totalw, -14, totalw, -4, GRAY, 1))
_b1618a += [t(-14, 17, "（左）", GRAY, 11, "end"), t(totalw + 14, 17, "（右）", GRAY, 11, "start")]
FIGS["HG-1618-1"] = svg("-70 -30 %s 90" % (totalw + 140), "".join(_b1618a) + t(totalw / 2, 70, "[図1]", GRAY, 12))

sq = 200
_b1618b = [
    rect(0, 0, sq, sq, TX, 2),
    '<rect x="%s" y="%s" width="14" height="14" fill="%s"/>' % (10, 10, TX), t(30, 21, "D", TX, 14, "start"),
    '<rect x="%s" y="%s" width="14" height="14" fill="%s"/>' % (sq - 24, 10, TX), t(sq - 30, 21, "E", TX, 14, "end"),
    '<rect x="%s" y="%s" width="14" height="14" fill="%s"/>' % (sq / 2 - 7, sq / 2 - 7, TX),
    t(sq / 2 + 20, sq / 2 + 5, "F", TX, 14, "start"),
    '<rect x="%s" y="%s" width="14" height="14" fill="%s"/>' % (sq - 24, sq - 24, TX),
    t(sq - 30, sq - 10, "G", TX, 14, "end"),
    t(20, sq - 12, "※", HI, 18),
]
FIGS["HG-1618-2"] = svg("-10 -10 %s %s" % (sq + 20, sq + 40), "".join(_b1618b) + t(sq / 2, sq + 25, "[図2]", GRAY, 12))

FIGS["HG-1618"] = svg("0 0 900 320", "".join([
    '<g transform="translate(90,60)">%s</g>' % FIGS["HG-1618-1"].split(">", 1)[1][:-6],
    '<g transform="translate(620,40)">%s</g>' % FIGS["HG-1618-2"].split(">", 1)[1][:-6],
]))
for k in ("HG-1618-1", "HG-1618-2"):
    del FIGS[k]

# ══ HG-1633：真上から見た棒の影（十字・矢印あいうえ・B方位） ══════════
cx1633, cy1633 = 120, 120


def arrow_head(x, y, ang, color=HI, size=7):
    a1, a2 = math.radians(ang + 150), math.radians(ang - 150)
    return poly([(x, y), (x + size * math.cos(a1), y + size * math.sin(a1)),
                 (x + size * math.cos(a2), y + size * math.sin(a2))], "none", 0, color)


_b1633 = [
    ln(cx1633, cy1633 - 90, cx1633, cy1633 + 90, GRAY, 1.4, ),
    arrow_head(cx1633, cy1633 - 90, -90, HI),
    arrow_head(cx1633, cy1633 + 90, 90, GRAY),
    ln(cx1633 - 90, cy1633, cx1633 + 90, cy1633, GRAY, 1.4),
    arrow_head(cx1633 + 90, cy1633, 0, HI),
    arrow_head(cx1633 - 90, cy1633, 180, HI),
    t(cx1633, cy1633 - 100, "B", TX, 15),
    ln(cx1633, cy1633, cx1633 + 55, cy1633 - 55, TX, 7),
    circ(cx1633, cy1633, 7, TX, 1.6, "none"),
    t(cx1633 + 8, cy1633 + 28, "あ", HI, 13),
    t(cx1633 + 70, cy1633 - 5, "い", HI, 13),
    t(cx1633 + 8, cy1633 - 32, "う", HI, 13),
    t(cx1633 - 34, cy1633 - 5, "え", HI, 13),
    t(cx1633 - 40, cy1633 + 110, "棒", GRAY, 12),
    ln(cx1633, cy1633 + 25, cx1633 - 15, cy1633 + 55, GRAY, 1.2),
]
FIGS["HG-1633"] = svg("0 0 260 260", "".join(_b1633))

# ══ HG-1634：モノコード見取り図（台形の箱＋弦＋ことじ＋おもり） ═══════
_b1634 = [
    poly([(20, 90), (60, 40), (260, 40), (300, 90)], LINE, 1.8),
    poly([(20, 90), (300, 90), (300, 110), (20, 110)], LINE, 1.8),
    ln(70, 55, 250, 55, TX, 1.6),
    poly([(85, 40), (95, 60), (75, 60)], TX, 1.4),
    poly([(215, 40), (225, 60), (205, 60)], TX, 1.4),
    t(80, 68, "ことじ", GRAY, 11),
    t(220, 68, "ことじ", GRAY, 11),
    ln(250, 55, 290, 130, TX, 1.6),
    circ(290, 140, 10, TX, 1.6),
    t(310, 144, "おもり", GRAY, 11, "start"),
    dbl_arrow(85, 20, 215, 20),
    t(150, 10, "弦の長さ", GRAY, 12),
    t(160, 50, "弦", TX, 12),
]
FIGS["HG-1634"] = svg("0 0 360 180", "".join(_b1634))


# ══ HG-1637：天井-ばね-おもり基本図／グラフ／台+滑車 ═══════════════
def spring(x, y1, y2, coils=6, w=16, stroke=TX):
    seq = [(x, y1)]
    n = coils * 2
    for i in range(1, n):
        yy = y1 + (y2 - y1) * i / n
        xx = x + (w / 2 if i % 2 else -w / 2)
        seq.append((xx, yy))
    seq.append((x, y2))
    return polyline(seq, stroke, 1.6)


_b1637a = [
    '<rect x="%s" y="%s" width="60" height="8" fill="none" stroke="%s" stroke-width="1.6"/>' % (30, 10, TX),
    ln(30, 14, 90, 14, TX, 1, "3,2"),
    spring(60, 18, 90, coils=5, w=14),
    ln(60, 90, 60, 105, TX, 1.6),
    circ(60, 115, 10, TX, 1.6),
    t(60, -2, "天井", GRAY, 11),
    t(78, 60, "ばね", GRAY, 11, "start"),
    t(60, 145, "おもり", GRAY, 11),
]
FIGS["HG-1637-1"] = svg("0 -15 120 170", "".join(_b1637a) + t(60, 160, "[図1]", GRAY, 12))

gx0, gy0, gw, gh = 60, 20, 320, 220
_b1637b = [
    ln(gx0, gy0, gx0, gy0 + gh, GRAY, 1.4), ln(gx0, gy0 + gh, gx0 + gw, gy0 + gh, GRAY, 1.4),
]
for i in range(1, 7):
    xx = gx0 + gw * i / 6
    _b1637b.append(ln(xx, gy0, xx, gy0 + gh, "#2a3560", 1))
    _b1637b.append(t(xx, gy0 + gh + 18, str(i * 10), GRAY, 10))
for i in range(0, 31, 5):
    yy = gy0 + gh - gh * i / 30
    _b1637b.append(ln(gx0, yy, gx0 + gw, yy, "#2a3560", 1))
    _b1637b.append(t(gx0 - 10, yy + 4, str(i), GRAY, 10, "end"))
A0 = (gx0, gy0 + gh - gh * 15 / 30)
A1 = (gx0 + gw, gy0 + gh - gh * 25 / 30)
B0 = (gx0, gy0 + gh - gh * 10 / 30)
B1 = (gx0 + gw, gy0 + gh - gh * 30 / 30)
_b1637b += [
    ln(*A0, *A1, HI, 2), ln(*B0, *B1, HI, 2),
    t(A1[0] - 30, A1[1] - 8, "ばねA", TX, 12),
    t(B1[0] - 30, B1[1] - 8, "ばねB", TX, 12),
    t(gx0 + gw / 2, gy0 + gh + 40, "ばねにつるすおもりの重さ(g)", GRAY, 11),
    t(gx0 - 40, gy0 + gh / 2, "ばねの長さ(cm)", GRAY, 11, "middle", ' transform="rotate(-90 %s %s)"' % (r1(gx0 - 40), r1(gy0 + gh / 2))),
]
FIGS["HG-1637-2"] = svg("0 0 420 320", "".join(_b1637b) + t(gx0 + gw / 2, 305, "[図2]", GRAY, 12))

tx0, ty0 = 60, 40
_b1637c = [
    rect(tx0 - 60, ty0, 120, 16, TX, 1.8),
    spring(tx0, ty0 + 8, ty0 + 40, coils=4, w=12),
    t(tx0, ty0 - 8, "台", GRAY, 11),
    t(tx0, ty0 + 55, "ばねB", GRAY, 11),
    circ(tx0 - 60, ty0 + 8, 6, TX, 1.6),
    circ(tx0 + 60, ty0 + 8, 6, TX, 1.6),
    ln(tx0 - 60, ty0 + 14, tx0 - 60, ty0 + 90, TX, 1.4),
    ln(tx0 + 60, ty0 + 14, tx0 + 60, ty0 + 90, TX, 1.4),
    rect(tx0 - 70, ty0 + 90, 20, 20, TX, 1.6),
    rect(tx0 + 50, ty0 + 90, 20, 20, TX, 1.6),
    t(tx0 - 60, ty0 + 125, "60gのおもり", GRAY, 10),
    t(tx0 + 60, ty0 + 125, "60gのおもり", GRAY, 10),
    t(tx0, ty0 + 40, "かっ車", GRAY, 10, "start"),
]
FIGS["HG-1637-3"] = svg("-40 0 220 160", "".join(_b1637c) + t(tx0, 150, "[図3]", GRAY, 12))

FIGS["HG-1637"] = svg("0 0 900 340", "".join([
    '<g transform="translate(20,10)">%s</g>' % FIGS["HG-1637-1"].split(">", 1)[1][:-6],
    '<g transform="translate(180,0)">%s</g>' % FIGS["HG-1637-2"].split(">", 1)[1][:-6],
    '<g transform="translate(680,10)">%s</g>' % FIGS["HG-1637-3"].split(">", 1)[1][:-6],
]))
for k in ("HG-1637-1", "HG-1637-2", "HG-1637-3"):
    del FIGS[k]

# ══ HG-1638：ばね直列（図4・図5・図6） ═══════════════════════════════
def ceiling(x, w=60):
    return rect(x - w / 2, 0, w, 8, TX, 1.6) + ln(x - w / 2, 8, x + w / 2, 8, TX, 1, "3,2")


_b1638a = [
    ceiling(50), t(50, -6, "天井", GRAY, 10),
    spring(50, 8, 50, coils=4, w=12), t(72, 30, "ばねA", GRAY, 10, "start"),
    spring(50, 50, 92, coils=4, w=12), t(72, 72, "ばねB", GRAY, 10, "start"),
    circ(50, 102, 10, TX, 1.6),
    ln(80, 8, 80, 102, HI, 1, "3,2"), t(84, 55, "①cm", HI, 11, "start"),
]
FIGS["HG-1638-4"] = svg("0 -15 130 130", "".join(_b1638a) + t(50, 118, "[図4]", GRAY, 12))

_b1638b = [
    ceiling(50), t(50, -6, "天井", GRAY, 10),
    spring(50, 8, 40, coils=3, w=12), t(72, 24, "ばねA", GRAY, 10, "start"),
    circ(50, 50, 8, TX, 1.6), t(30, 54, "30g", GRAY, 10, "end"),
    spring(50, 58, 90, coils=3, w=12), t(72, 74, "ばねB", GRAY, 10, "start"),
    circ(50, 100, 8, TX, 1.6), t(30, 104, "30g", GRAY, 10, "end"),
    ln(80, 8, 80, 100, HI, 1, "3,2"), t(84, 55, "②cm", HI, 11, "start"),
]
FIGS["HG-1638-5"] = svg("0 -15 130 130", "".join(_b1638b) + t(50, 118, "[図5]", GRAY, 12))

_b1638c = [
    ceiling(40, 20), ceiling(120, 20),
    spring(40, 8, 60, coils=4, w=10), t(40, -6, "ばねA", GRAY, 10),
    spring(120, 8, 60, coils=4, w=10), t(120, -6, "ばねB", GRAY, 10),
    rect(40, 60, 80, 8, TX, 1.8), t(80, 55, "ぼう", GRAY, 10),
    ln(40, 68, 80, 90, GRAY, 1), t(56, 82, "15cm", GRAY, 10),
    ln(120, 68, 80, 90, GRAY, 1), t(104, 82, "15cm", GRAY, 10),
    ln(80, 68, 80, 90, TX, 1.4),
    rect(70, 90, 20, 20, TX, 1.6), t(80, 128, "おもりP", GRAY, 10),
]
FIGS["HG-1638-6"] = svg("0 -15 160 145", "".join(_b1638c) + t(80, 140, "[図6]", GRAY, 12))

FIGS["HG-1638"] = svg("0 0 480 165", "".join([
    '<g transform="translate(10,24)">%s</g>' % FIGS["HG-1638-4"].split(">", 1)[1][:-6],
    '<g transform="translate(170,24)">%s</g>' % FIGS["HG-1638-5"].split(">", 1)[1][:-6],
    '<g transform="translate(320,24)">%s</g>' % FIGS["HG-1638-6"].split(">", 1)[1][:-6],
]))
for k in ("HG-1638-4", "HG-1638-5", "HG-1638-6"):
    del FIGS[k]

# ══ HG-1639／HG-1640：気体発生装置共通図 ════════════════════════════
_b_gas = [
    poly([(60, 90), (140, 90), (170, 200), (30, 200)], LINE, 2),   # 三角フラスコ
    ln(60, 90, 60, 70, LINE, 2), ln(140, 90, 140, 70, LINE, 2),
    rect(55, 60, 90, 10, TX, 1.6),
    poly([(70, 60), (90, 30), (110, 30), (130, 60)], LINE, 1.8),   # 活栓付きろうと
    ln(96, 30, 96, 10, LINE, 1.6),
    ln(100, 65, 100, 55, TX, 2),
    ln(140, 95, 190, 95, LINE, 1.8), ln(190, 95, 190, 60, LINE, 1.8),
    t(100, 5, "液体の薬品", GRAY, 11),
    t(100, 190, "固体の薬品", GRAY, 11),
    t(20, 65, "S", HI, 15, "end"),
    ln(26, 65, 68, 63, HI, 1.2),
    ln(26, 65, 96, 45, HI, 1.2),
]
FIGS["HG-1639"] = svg("-10 -10 240 220", "".join(_b_gas) + t(100, 212, "[図]", GRAY, 12))
FIGS["HG-1640"] = FIGS["HG-1639"]

# ══ HG-1641：太陽のまわりの金星・地球（同心円・矢印ABCD） ═══════════
cxp, cyp = 130, 130
_b1641 = [
    circ(cxp, cyp, 110, GRAY, 1.4), circ(cxp, cyp, 55, GRAY, 1.4),
    circ(cxp, cyp, 10, TX, 1.6), t(cxp, cyp - 20, "太陽", TX, 12),
    circ(cxp - 14, cyp + 55, 6, TX, 1.6), t(cxp - 14, cyp + 40, "金星", TX, 11),
    circ(cxp - 26, cyp + 110, 6, TX, 1.6), t(cxp - 26, cyp + 128, "地球", TX, 11),
    ln(cxp - 30, cyp + 55, cxp - 55, cyp + 68, HI, 1.6), t(cxp - 62, cyp + 74, "C", HI, 12, "end"),
    ln(cxp + 2, cyp + 55, cxp + 27, cyp + 68, HI, 1.6), t(cxp + 34, cyp + 74, "D", HI, 12, "start"),
    ln(cxp - 42, cyp + 110, cxp - 70, cyp + 122, HI, 1.6), t(cxp - 78, cyp + 128, "A", HI, 12, "end"),
    ln(cxp - 10, cyp + 110, cxp + 18, cyp + 122, HI, 1.6), t(cxp + 26, cyp + 128, "B", HI, 12, "start"),
]
FIGS["HG-1641"] = svg("0 0 260 260", "".join(_b1641))


# ══ HG-1642：てこ実験器（図1〜6）＋棒AB持ち上げ（図7〜9） ═══════════
def lever_bar(x0, y0, length, support_hole, label=True):
    n = 9
    holes = [x0 + length * i / (n - 1) for i in range(n)]
    out = [ln(x0, y0, x0 + length, y0, TX, 2)]
    for i, hx in enumerate(holes):
        out.append(circ(hx, y0, 2.4, TX, 1, TX))
        if label:
            out.append(t(hx, y0 - 12, str(i + 1), GRAY, 10))
    sx = holes[support_hole - 1]
    out.append(poly([(sx, y0 + 4), (sx - 16, y0 + 40), (sx + 16, y0 + 40)], TX, 1.8))
    out.append(t(sx, y0 + 55, str(support_hole), TX, 11))
    return "".join(out), holes


def weights(x, y, n, dot_r=7, down=True):
    out = []
    step = dot_r * 2 - 1
    for i in range(n):
        cy = y + i * step if down else y - i * step
        out.append(circ(x, cy, dot_r, TX, 1.4))
    return "".join(out)


def spring_scale_v(x, y1, y2, label):
    return (rect(x - 9, y1, 18, (y2 - y1) * 0.75, TX, 1.6) +
            ln(x, y1 + (y2 - y1) * 0.75, x, y2, TX, 1.6) +
            t(x + 14, y1 + 12, label, TX, 11, "start"))


bar1, h1 = lever_bar(20, 40, 280, 5)
_b1642_1 = [bar1, t(160, 20, "支点", GRAY, 10, "start"), ln(140, 30, 118, 40, GRAY, 1)]
FIGS["HG-1642-1"] = svg("0 0 340 100", "".join(_b1642_1) + t(160, 90, "[図1]", GRAY, 12))

bar2, h2 = lever_bar(20, 40, 280, 5)
_b1642_2 = [bar2, weights(h2[1], 50, 2), t(h2[1], 90, "おもり", GRAY, 10),
            rect(h2[6] - 16, 50, 32, 26, "#6a7aa8", 1.4), t(h2[6], 66, "あ", HI, 12)]
FIGS["HG-1642-2"] = svg("0 0 340 110", "".join(_b1642_2) + t(160, 100, "[図2]", GRAY, 12))

bar3, h3 = lever_bar(20, 40, 280, 5)
_b1642_3 = [bar3, weights(h3[0], 50, 1), rect(h3[2] - 16, 50, 32, 26, "#6a7aa8", 1.4), t(h3[2], 66, "い", HI, 12),
            weights(h3[7], 50, 2)]
FIGS["HG-1642-3"] = svg("0 0 340 110", "".join(_b1642_3) + t(160, 100, "[図3]", GRAY, 12))

bar4, h4 = lever_bar(20, 60, 280, 3)
_b1642_4 = [bar4, spring_scale_v(h4[7], 5, 60, "40g")]
FIGS["HG-1642-4"] = svg("0 0 340 130", "".join(_b1642_4) + t(160, 120, "[図4]", GRAY, 12))

bar5, h5 = lever_bar(20, 60, 280, 4)
_b1642_5 = [bar5, weights(h5[1], 70, 3), spring_scale_v(h5[5], 5, 60, "")]
FIGS["HG-1642-5"] = svg("0 0 340 130", "".join(_b1642_5) + t(160, 120, "[図5]", GRAY, 12))

bar6, h6 = lever_bar(20, 60, 280, 4)
_b1642_6 = [bar6, weights(h6[0], 70, 3)]
FIGS["HG-1642-6"] = svg("0 0 340 130", "".join(_b1642_6) + t(160, 120, "[図6]", GRAY, 12))

FIGS["HG-1642-top"] = svg("0 0 1060 140", "".join([
    '<g transform="translate(0,10)">%s</g>' % FIGS["HG-1642-1"].split(">", 1)[1][:-6],
    '<g transform="translate(360,10)">%s</g>' % FIGS["HG-1642-2"].split(">", 1)[1][:-6],
    '<g transform="translate(720,10)">%s</g>' % FIGS["HG-1642-3"].split(">", 1)[1][:-6],
]))
FIGS["HG-1642-mid"] = svg("0 0 1060 150", "".join([
    '<g transform="translate(0,0)">%s</g>' % FIGS["HG-1642-4"].split(">", 1)[1][:-6],
    '<g transform="translate(360,0)">%s</g>' % FIGS["HG-1642-5"].split(">", 1)[1][:-6],
    '<g transform="translate(720,0)">%s</g>' % FIGS["HG-1642-6"].split(">", 1)[1][:-6],
]))
for k in ("HG-1642-1", "HG-1642-2", "HG-1642-3", "HG-1642-4", "HG-1642-5", "HG-1642-6"):
    del FIGS[k]

# 図7・図8：地面に置いた棒ABをはしから持ち上げる／図9：中央から吊るす
def ground_lever(x0, y0, length, lift_end, label_w, weight_label):
    ax, ay = (x0, y0) if lift_end == "A" else (x0, y0 + 10)
    bx, by = (x0 + length, y0 + 10) if lift_end == "A" else (x0 + length, y0)
    out = [
        '<rect x="%s" y="%s" width="%s" height="10" fill="none" stroke="%s" stroke-width="1.6"/>' %
        (r1(x0), r1(min(ay, by)) if False else r1(y0), r1(length), TX),
        ln(x0 - 10, y0 + 10, x0 + length + 10, y0 + 10, TX, 3),
    ]
    return out


_b1642_7 = [
    ln(0, 60, 160, 60, TX, 3),
    poly([(0, 30), (110, 55), (110, 60), (0, 60)], TX, 1.8),
    t(-8, 40, "A", TX, 12, "end"), t(118, 62, "B", TX, 12, "start"),
    ln(0, 30, 0, -20, TX, 1.6), spring_scale_v(0, -50, -20, "30g"),
]
FIGS["HG-1642-7"] = svg("-20 -60 200 140", "".join(_b1642_7) + t(80, 70, "[図7]", GRAY, 12))

_b1642_8 = [
    ln(0, 60, 160, 60, TX, 3),
    poly([(160, 45), (50, 58), (50, 60), (160, 60)], TX, 1.8),
    t(-8, 62, "A", TX, 12, "end"), t(168, 46, "B", TX, 12, "start"),
    ln(160, 45, 160, -20, TX, 1.6), spring_scale_v(160, -50, -20, "10g"),
]
FIGS["HG-1642-8"] = svg("-20 -60 200 100", "".join(_b1642_8) + t(80, 70, "[図8]", GRAY, 12))

_b1642_9 = [
    poly([(0, 30), (160, 20), (160, 30), (0, 40)], TX, 1.8),
    t(-10, 38, "A", TX, 12, "end"), t(168, 24, "B", TX, 12, "start"),
    ln(80, 25, 80, -20, TX, 1.6), t(80, -26, "↑", TX, 12),
    ln(160, 25, 160, 60, TX, 1.6), rect(148, 60, 24, 22, "#6a7aa8", 1.4), t(160, 75, "う", HI, 12),
]
FIGS["HG-1642-9"] = svg("-20 -30 200 130", "".join(_b1642_9) + t(80, 92, "[図9]", GRAY, 12))

FIGS["HG-1642-bot"] = svg("0 0 700 200", "".join([
    '<g transform="translate(20,60)">%s</g>' % FIGS["HG-1642-7"].split(">", 1)[1][:-6],
    '<g transform="translate(260,60)">%s</g>' % FIGS["HG-1642-8"].split(">", 1)[1][:-6],
    '<g transform="translate(480,30)">%s</g>' % FIGS["HG-1642-9"].split(">", 1)[1][:-6],
]))
for k in ("HG-1642-7", "HG-1642-8", "HG-1642-9"):
    del FIGS[k]

FIGS["HG-1642"] = svg("0 0 1060 490", "".join([
    '<g transform="translate(0,0)">%s</g>' % FIGS["HG-1642-top"].split(">", 1)[1][:-6],
    '<g transform="translate(0,150)">%s</g>' % FIGS["HG-1642-mid"].split(">", 1)[1][:-6],
    '<g transform="translate(180,310)">%s</g>' % FIGS["HG-1642-bot"].split(">", 1)[1][:-6],
]))
for k in ("HG-1642-top", "HG-1642-mid", "HG-1642-bot"):
    del FIGS[k]

# ══ HG-1645：直列豆電球＋直列かん電池の回路（基本図・グラフ・図3〜5） ═══
def circuit_frame(x0, y0, w, h):
    return [ln(x0, y0, x0 + w, y0, TX, 2), ln(x0 + w, y0, x0 + w, y0 + h, TX, 2),
            ln(x0, y0, x0, y0 + h, TX, 2)]


_b1645_1 = [
    ln(30, 20, 270, 20, TX, 2),
    bulb_between(90, 20, 130, 20), bulb_between(170, 20, 210, 20),
    t(150, 5, "…", TX, 14),
    ln(30, 20, 30, 90, TX, 2), ln(270, 20, 270, 90, TX, 2),
    ln(30, 90, 100, 90, TX, 2), ln(200, 90, 270, 90, TX, 2),
    battery2(100, 90, 140, 90, plus_end=1), battery2(160, 90, 200, 90, plus_end=1),
    t(150, 108, "…", TX, 14),
    circ(270, 55, 2.4, HI, 1.4, HI), t(280, 58, "P", HI, 13, "start"),
    t(150, -8, "直列つなぎの豆電球", GRAY, 11),
    t(150, 112, "直列つなぎのかん電池", GRAY, 11),
]
FIGS["HG-1645-1"] = svg("0 -20 300 150", "".join(_b1645_1) + t(150, 128, "[図1]", GRAY, 12))

gx0, gy0, gw, gh = 60, 20, 300, 220
_b1645_2 = [ln(gx0, gy0, gx0, gy0 + gh, GRAY, 1.4), ln(gx0, gy0 + gh, gx0 + gw, gy0 + gh, GRAY, 1.4)]
for i in range(5):
    xx = gx0 + gw * i / 4
    _b1645_2.append(ln(xx, gy0, xx, gy0 + gh, "#2a3560", 1))
    _b1645_2.append(t(xx, gy0 + gh + 16, str(i), GRAY, 10))
for i, val in enumerate(range(0, 1121, 160)):
    yy = gy0 + gh - gh * val / 1120
    _b1645_2.append(ln(gx0, yy, gx0 + gw, yy, "#2a3560", 1))
    _b1645_2.append(t(gx0 - 8, yy + 4, str(val), GRAY, 9, "end"))
lines = {"豆電球1個": 480, "豆電球2個": 240, "豆電球3個": 160}
for lbl, slope in lines.items():
    x1v, y1v = gx0, gy0 + gh
    x4v = gx0 + gw
    y4v = gy0 + gh - gh * (slope * 4) / 1120
    _b1645_2.append(ln(x1v, y1v, x4v, max(y4v, gy0)))
    _b1645_2.append(t(x4v - 20, max(y4v, gy0) - 8, lbl, TX, 10))
_b1645_2.append(t(gx0 + gw / 2, gy0 + gh + 36, "かん電池の個数(個)", GRAY, 11))
FIGS["HG-1645-2"] = svg("0 0 400 300", "".join(_b1645_2) + t(gx0 + gw / 2, 290, "[図2]", GRAY, 12))


def bulb_block(x_left, x_right, y0, h, n_top, n_bot):
    """x_left〜x_rightの矩形。上辺にn_top個・下辺にn_bot個の豆電球を直列で並べる（見た目は並列2枝）"""
    out = [ln(x_left, y0, x_left, y0 + h, TX, 2), ln(x_right, y0, x_right, y0 + h, TX, 2)]
    for y_, n_ in ((y0, n_top), (y0 + h, n_bot)):
        seg = (x_right - x_left) / (2 * n_ + 1)
        xx = x_left
        out.append(ln(x_left, y_, x_left + seg, y_, TX, 2))
        for i in range(n_):
            out.append(bulb_between(xx + seg, y_, xx + seg * 2.4, y_))
            xx += seg * 2
        out.append(ln(xx + seg * 0.4, y_, x_right, y_, TX, 2))
    return "".join(out)


def circuit_qrs(bulbs_top, bulbs_bot, bulbs_pre, point_label):
    x0, y0, h = 20, 20, 90
    x_batt1, x_batt2 = x0 + 10, x0 + 50
    x_batt_end = x0 + 70
    out = [
        ln(x0, y0 + h, x_batt1, y0 + h, TX, 2),
        battery2(x_batt1, y0 + h, x_batt2, y0 + h, plus_end=1),
    ]
    if bulbs_pre:
        xb1, xb2 = x_batt_end + 20, x_batt_end + 55
        out.append(ln(x_batt2, y0 + h, xb1, y0 + h, TX, 2))
        out.append(bulb_between(xb1, y0 + h, xb2, y0 + h))
        x2 = xb2 + 20
        out.append(ln(xb2, y0 + h, x2, y0 + h, TX, 2))
    else:
        x2 = x_batt_end
        out.append(ln(x_batt2, y0 + h, x2, y0 + h, TX, 2))
    x3 = x2 + 140
    out.append(ln(x0, y0, x2, y0, TX, 2))
    out.append(ln(x0, y0, x0, y0 + h, TX, 2))
    out.append(bulb_block(x2, x3, y0, h, bulbs_top, bulbs_bot))
    out.append(circ(x3, y0 + h / 2, 2.6, HI, 1.4, HI))
    out.append(t(x3 + 10, y0 + h / 2 + 4, point_label, HI, 13, "start"))
    return "".join(out)


FIGS["HG-1645-3"] = svg("0 0 280 130", circuit_qrs(2, 2, False, "Q"))
FIGS["HG-1645-4"] = svg("0 0 320 130", circuit_qrs(2, 2, True, "R"))


def circuit_s():
    x0, y0, h = 20, 20, 90
    x_batt1, x_batt2 = x0 + 10, x0 + 50
    x_batt_end = x0 + 70
    out = [
        ln(x0, y0 + h, x_batt1, y0 + h, TX, 2),
        battery2(x_batt1, y0 + h, x_batt2, y0 + h, plus_end=1),
        ln(x_batt2, y0 + h, x_batt_end, y0 + h, TX, 2),
        ln(x0, y0, x_batt_end, y0, TX, 2),
        ln(x0, y0, x0, y0 + h, TX, 2),
    ]
    blk_w = 110
    x2, x3 = x_batt_end, x_batt_end + blk_w
    x4, x5 = x3, x3 + blk_w
    out.append(bulb_block(x2, x3, y0, h, 2, 2))
    out.append(bulb_block(x4, x5, y0, h, 2, 2))
    out.append(circ(x5, y0 + h / 2, 2.6, HI, 1.4, HI))
    out.append(t(x5 + 10, y0 + h / 2 + 4, "S", HI, 13, "start"))
    return "".join(out)


FIGS["HG-1645-5"] = svg("0 0 360 130", circuit_s())

FIGS["HG-1645"] = svg("0 0 1300 460", "".join([
    '<g transform="translate(20,10)">%s</g>' % FIGS["HG-1645-1"].split(">", 1)[1][:-6],
    '<g transform="translate(360,0)">%s</g>' % FIGS["HG-1645-2"].split(">", 1)[1][:-6],
    '<g transform="translate(20,320)">%s</g>' % FIGS["HG-1645-3"].split(">", 1)[1][:-6],
    '<g transform="translate(340,320)">%s</g>' % FIGS["HG-1645-4"].split(">", 1)[1][:-6],
    '<g transform="translate(660,320)">%s</g>' % FIGS["HG-1645-5"].split(">", 1)[1][:-6],
]))
for k in ("HG-1645-1", "HG-1645-2", "HG-1645-3", "HG-1645-4", "HG-1645-5"):
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
