# -*- coding: utf-8 -*-
"""小5理科13本（HG-0751/0752/0753/0755/0756/0757/0771/0773/0774/0775/0777/0779/0780）。

★根拠：
  G:\\マイドライブ\\浜問題\\5年理科\\5年理科 No.11_No.12.pdf（HG-0751/0752/0771/0773）
  G:\\マイドライブ\\浜問題\\5年理科\\5年理科 No.13_No.14.pdf（HG-0753/0774/0775）
  G:\\マイドライブ\\浜問題\\5年理科\\5年理科 No.15_No.16.pdf（HG-0777/0779/0780/0755/0756）
  G:\\マイドライブ\\浜問題\\5年理科\\5年理科 No.17_No.18.pdf（HG-0757）
  を130〜400dpiで出して目視。

実物で確かめたページ対応（要点のみ）：
  HG-0751 … No.11大問3。地平線から45°の位置に上弦の月（右半分が光る半月）
  HG-0752 … No.11大問7。太陽－地球①②③（公転で上昇する弧）－各地球のまわりを回る
             月の軌道（A/B/C）。各地球からこう星Sへ平行な矢印（常に同じ向き）
  HG-0753 … No.13大問3。北極星を中心とする円周12等分、アが真上(12時)から時計回り
  HG-0755 … No.16大問6(3)。人の頭上をミサイルが水平飛行、頭上から30°の方向から音
  HG-0756 … No.16大問7。電車→1750m→がけ・トンネル（反射音の実験）
  HG-0757 … No.17大問6[図3]。正三角形。右辺＝棒A（ろうをぬった辺）、上端a・下端b、
             左の頂点をガスバーナーで加熱
  HG-0771 … No.12大問4。黒地に白い星のスケッチ、A(最大)〜Fの6つに符号
  HG-0773 … No.12大問5。1点から光が四角錐状に広がる透視図（手前に小さい正方形、
             奥に大きい正方形、下に「きょり」の矢印）
  HG-0774 … No.14大問3。北極星を中心とする円周12等分、アが真右(3時)から時計回り
  HG-0775 … No.14大問5。北極星を中心とする円周24等分、アが真上(12時)から時計回り
             （実物は手描きでかすれが強いため、原簿の作問メモが既に検証ずみの
             並び順「ア=0時計回り、キ=3時、ス=6時、テ=9時＝★Mの位置」に従う）
  HG-0777 … No.15大問5。天井から見た12列×8行の方眼、平面鏡は第6列の第2〜7行、
             A(3,1)/B(2,3)/C(5,4)/D(3,6)
  HG-0779 … No.15大問7。日光→虫めがね→紙の上に明るい円（距離Aと直径Bを表示）
  HG-0780 … No.15大問1。針穴写真機（外筒・内筒・針穴・すりガラスの箱の見取図）

使い方: python scripts/genbo_svg_rika5_group1.py [--write]
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


def rect(x, y, w, h, stroke=LINE, sw=2, fill="none", dash=None, opacity=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    o = ' fill-opacity="%s"' % opacity if opacity is not None else ''
    return '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="%s"%s%s/>' % (
        r1(x), r1(y), r1(w), r1(h), fill, stroke, sw, d, o)


def circ(cx, cy, r, stroke=LINE, w=2, fill="none", opacity=None):
    o = ' fill-opacity="%s"' % opacity if opacity is not None else ''
    return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        r1(cx), r1(cy), r1(r), fill, stroke, w, o)


def dot(cx, cy, r=3.5, fill=TX):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r1(cx), r1(cy), r1(r), fill)


def pts(seq):
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none", dash=None, opacity=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    o = ' fill-opacity="%s"' % opacity if opacity is not None else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s%s/>' % (
        pts(seq), fill, stroke, w, d, o)


def defs_arrow(mid, color=HI):
    return ('<defs><marker id="%s" markerWidth="8" markerHeight="8" refX="6.5" refY="4"'
            ' orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % (mid, color))


def arrow_path(x1, y1, x2, y2, mid, color=HI, w=1.8, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="%s"%s marker-end="url(#%s)"/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), color, w, d, mid)


def hatch_ground(x1, x2, y, n=14, h=8):
    out = [ln(x1, y, x2, y, LINE, 1.8)]
    for i in range(n):
        gx = x1 + (x2 - x1) * i / (n - 1)
        out.append(ln(gx, y, gx - h, y + h, GRAY, 1))
    return out


def wheel(cx, cy, r, labels, start_deg, center_label, mark_index=None, mark_label=None):
    """円周を等分してラベルを配置。角度は時計回りに増える（SVG座標系）"""
    n = len(labels)
    out = ['<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="1.6" stroke-dasharray="2,3"/>' % (
        r1(cx), r1(cy), r1(r), LINE)]
    for i, lab in enumerate(labels):
        ang = math.radians(start_deg + i * 360.0 / n)
        ex, ey = cx + r * math.cos(ang), cy + r * math.sin(ang)
        out.append(ln(cx, cy, ex, ey, LINE, 1, "1,2.5"))
        lx, ly = cx + (r + 16) * math.cos(ang), cy + (r + 16) * math.sin(ang) + 4
        out.append(t(lx, ly, lab, TX, 12))
        if mark_index == i:
            sx, sy = cx + (r + 46) * math.cos(ang), cy + (r + 46) * math.sin(ang)
            out.append(t(sx, sy, "☆" + mark_label, HI, 12))
    out.append(dot(cx, cy, 3, TX))
    out.append(t(cx, cy + 16, center_label, TX, 12))
    return out


FIGS = {}

# ══ No.11 大問3（HG-0751）地平線から45°に上弦の月 ═══════════════════════
GY0 = 170
_m1 = hatch_ground(30, 260, GY0)
_m1.append(t(275, GY0 + 4, "地平線", TX, 12, "start"))
VX, VY = 60, GY0
MX, MY = VX + 130, GY0 - 130
_m1.append(ln(VX, VY, MX, MY, GRAY, 1.6, "2,3"))
_m1.append(circ(MX, MY, 13, LINE, 1.6))
_m1.append('<path d="M%s,%s A13,13 0 0 1 %s,%s Z" fill="%s"/>' % (
    r1(MX), r1(MY - 13), r1(MX), r1(MY + 13), LINE))
_m1.append(arrow_path(VX + 45, VY - 8, VX + 32, VY - 30, "ar751", GRAY))
_m1.append(t(VX + 55, VY - 14, "45°", TX, 12, "start"))
FIGS["HG-0751"] = svg("0 0 320 210", "".join(_m1))

# ══ No.11 大問7（HG-0752）太陽－地球①②③－月の軌道－こう星S ═══════════════
_orb = [circ(55, 200, 30, LINE, 1.8), t(55, 205, "太陽", TX, 13)]
EARTHS = [(220, 220, "①", "A", 30), (250, 145, "②", "B", -20), (275, 68, "③", "C", -60)]
for ex, ey, num, moonlab, mang_deg in EARTHS:
    _orb.append(circ(ex, ey, 13, LINE, 1.8, HI, 0.5))
    _orb.append(t(ex - 20, ey + 4, num, TX, 12))
    _orb.append(circ(ex, ey, 26, GRAY, 1.2, "none"))
    ma = math.radians(mang_deg)
    mx, my = ex + 26 * math.cos(ma), ey + 26 * math.sin(ma)
    _orb.append(dot(mx, my, 3, TX))
    _orb.append(t(mx + 10, my - 6, moonlab, TX, 12, "start"))
    _orb.append(defs_arrow("ar752_%d" % ex, GRAY))
    _orb.append(arrow_path(ex + 30, ey, ex + 90, ey, "ar752_%d" % ex, GRAY, 1.4, "2,3"))
    _orb.append(t(ex + 95, ey + 4, "☆こう星S", GRAY, 11, "start"))
_orb.append(ln(55, 200, 220, 220, GRAY, 1, "1,2.5"))
_orb.append(ln(55, 200, 275, 68, GRAY, 1, "1,2.5"))
_orb.append(t(150, 40, "地球の公転方向", TX, 11))
_orb.append(defs_arrow("ar752dir", TX))
_orb.append(arrow_path(200, 50, 175, 62, "ar752dir", TX, 1.4))
FIGS["HG-0752"] = svg("0 0 460 250", "".join(_orb))

# ══ No.13 大問3（HG-0753）円周12等分、アが真上から時計回り ═══════════════
W12 = ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ", "サ", "シ"]
_w753 = wheel(210, 148, 82, W12, -90, "北極星", mark_index=0, mark_label="星A")
FIGS["HG-0753"] = svg("0 0 420 290", "".join(_w753 + [
    t(210, 275, "円周を12等分（アが真上=12時、時計回り）", GRAY, 11),
]))

# ══ No.16 大問6(3)（HG-0755）頭上をミサイル通過。頭上から30°の方向から音 ═══
GYm = 230
_ms = hatch_ground(20, 300, GYm)
PX = 130
_ms.append(ln(PX, GYm - 30, PX, GYm, LINE, 2))
_ms.append(circ(PX, GYm - 36, 7, LINE, 1.8))
_ms.append(t(PX, GYm + 18, "人", TX, 12))
FLY_Y = 40
_ms.append(ln(80, FLY_Y, 260, FLY_Y, GRAY, 1.2, "2,3"))


def missile(mx, my, ang_deg=0):
    a = math.radians(ang_deg)
    return poly([(mx + 22, my), (mx + 4, my - 6), (mx - 10, my - 6),
                 (mx - 10, my + 6), (mx + 4, my + 6)], LINE, 1.6, LINE, opacity=0.35)


_ms.append(missile(PX, FLY_Y))
_ms.append(ln(PX, FLY_Y, PX, GYm - 40, GRAY, 1.4, "2,3"))
SNDX = 220
_ms.append(missile(SNDX, FLY_Y))
_ms.append(ln(SNDX, FLY_Y, PX, GYm - 40, HI, 1.6, "2,3"))
_ms.append(t((SNDX + PX) / 2 + 30, (FLY_Y + GYm) / 2 - 20, "ミサイルからの音", HI, 11, "start"))
_ms.append(defs_arrow("ar755", GRAY))
_ms.append(arrow_path(PX + 6, FLY_Y + 35, PX + 22, FLY_Y + 22, "ar755", GRAY, 1.2))
_ms.append(t(PX + 20, FLY_Y + 45, "30°", TX, 12, "start"))
FIGS["HG-0755"] = svg("0 0 420 260", "".join(_ms))

# ══ No.16 大問7（HG-0756）電車→1750m→がけ・トンネル ═══════════════════
GYt = 150
_tr = [ln(20, GYt, 380, GYt, LINE, 2)]
TX0 = 70
_tr += [rect(TX0 - 22, GYt - 20, 44, 18, LINE, 1.6), circ(TX0 - 14, GYt, 4, LINE, 1.4),
        circ(TX0 + 8, GYt, 4, LINE, 1.4), t(TX0, GYt - 30, "警笛を鳴らした場所", TX, 11)]
CLX = 340
_tr.append(poly([(CLX, GYt), (CLX + 5, GYt - 60), (CLX + 22, GYt - 85), (CLX + 40, GYt - 60),
                  (CLX + 45, GYt), ], LINE, 1.8, LINE, opacity=0.15))
_tr.append('<path d="M%s,%s Q%s,%s %s,%s" fill="none" stroke="%s" stroke-width="1.6"/>' % (
    r1(CLX + 12), r1(GYt), r1(CLX + 22), r1(GYt - 26), r1(CLX + 32), r1(GYt), LINE))
_tr.append(t(CLX + 22, GYt - 95, "トンネル", TX, 12))
_tr.append(ln(TX0, GYt + 20, CLX, GYt + 20, GRAY, 1.2))
_tr.append(ln(TX0, GYt + 12, TX0, GYt + 28, GRAY, 1.2))
_tr.append(ln(CLX, GYt + 12, CLX, GYt + 28, GRAY, 1.2))
_tr.append(t((TX0 + CLX) / 2, GYt + 38, "1750m", TX, 12))
FIGS["HG-0756"] = svg("0 0 420 200", "".join(_tr))

# ══ No.17 大問6[図3]（HG-0757）正三角形。右辺=棒A（ろう）、上端a・下端b ═════
Pa = (220, 30)
Pb = (220, 230)
Papex = (40, 130)
_tri = [ln(*Papex, *Pa, LINE, 2), ln(*Papex, *Pb, LINE, 2)]
_tri.append(ln(*Pa, *Pb, LINE, 3))
for k in range(1, 8):
    yy = Pa[1] + (Pb[1] - Pa[1]) * k / 8
    _tri.append(ln(Pa[0] - 5, yy, Pa[0] + 5, yy, GRAY, 1))
_tri += [t(Pa[0] + 14, Pa[1] - 4, "a", TX, 13), t(Pb[0] + 14, Pb[1] + 10, "b", TX, 13)]
_tri += [t((Papex[0] + Pa[0]) / 2 - 6, (Papex[1] + Pa[1]) / 2 - 12, "棒B", TX, 13),
          t((Papex[0] + Pb[0]) / 2 - 6, (Papex[1] + Pb[1]) / 2 + 18, "棒C", TX, 13),
          t(Pa[0] + 26, (Pa[1] + Pb[1]) / 2, "棒A", HI, 13)]
_tri += [ln(Papex[0], Papex[1] - 22, Papex[0], Papex[1] - 6, GRAY, 3),
          t(Papex[0], Papex[1] - 30, "ガスバーナー", GRAY, 10)]
FIGS["HG-0757"] = svg("0 0 400 260", "".join(_tri))

# ══ No.12 大問4（HG-0771）黒地に白い星、A(最大)〜F ═══════════════════════
_st = [rect(10, 10, 300, 190, LINE, 1.4, "#060912")]
STARS = [("A", 250, 45, 8), ("C", 110, 45, 6), ("F", 65, 110, 6), ("B", 235, 140, 4),
          ("D", 135, 155, 4), ("E", 165, 168, 3)]
for lab, x, y, r in STARS:
    _st.append(circ(x, y, r, "none", 0, "#f2f6ff"))
    _st.append(t(x, y - r - 6, lab, HI, 13))
for x, y, r in [(40, 60, 2), (90, 85, 1.5), (150, 70, 1.5), (270, 90, 2.5), (280, 150, 2),
                 (55, 175, 1.5), (200, 130, 1.5), (190, 40, 1.5), (30, 130, 1.5)]:
    _st.append(circ(x, y, r, "none", 0, "#c9d4f0"))
FIGS["HG-0771"] = svg("0 0 320 210", "".join(_st))

# ══ No.12 大問5（HG-0773）1点から光が四角錐状に広がる透視図 ═══════════════
A773 = (20, 150)
farTL, farTR, farBR, farBL = (260, 70), (360, 100), (345, 235), (230, 220)
k773 = 0.42


def lerp(p, q, k):
    return (p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k)


nTL, nTR, nBR, nBL = (lerp(A773, farTL, k773), lerp(A773, farTR, k773),
                        lerp(A773, farBR, k773), lerp(A773, farBL, k773))
_cn = [ln(*A773, *farTL, LINE, 1.4), ln(*A773, *farBL, LINE, 1.4), ln(*A773, *farTR, GRAY, 1)]
_cn.append(poly([farTL, farTR, farBR, farBL], LINE, 1.8))
_cn.append(poly([nTL, nTR, nBR, nBL], HI, 1.8, HI, opacity=0.35))
_cn.append(dot(*A773, 2.6, TX))
_cn.append(defs_arrow("ar773a", GRAY))
_cn.append(defs_arrow("ar773b", GRAY))
_cn.append(arrow_path(A773[0], A773[1] + 45, nBL[0], nBL[1] + 20, "ar773a", GRAY, 1.2))
_cn.append(arrow_path(nBL[0], nBL[1] + 20, A773[0], A773[1] + 45, "ar773b", GRAY, 1.2))
_cn.append(t((A773[0] + nBL[0]) / 2, A773[1] + 60, "きょり", GRAY, 12))
FIGS["HG-0773"] = svg("0 0 380 260", "".join(_cn))

# ══ No.14 大問3（HG-0774）円周12等分、アが真右から時計回り ══════════════
_w774 = wheel(210, 148, 82, W12, 0, "北極星", mark_index=0, mark_label="星A")
FIGS["HG-0774"] = svg("0 0 420 290", "".join(_w774 + [
    t(210, 275, "円周を12等分（アが真右=3時、時計回り）", GRAY, 11),
]))

# ══ No.14 大問5（HG-0775）円周24等分、アが真上から時計回り（テ=9時=星M）═══
W24 = ["ア", "イ", "ウ", "エ", "オ", "カ", "キ", "ク", "ケ", "コ", "サ", "シ",
       "ス", "セ", "ソ", "タ", "チ", "ツ", "テ", "ト", "ナ", "ニ", "ヌ", "ネ"]
_w775 = wheel(210, 148, 82, W24, -90, "北極星", mark_index=18, mark_label="星M")
FIGS["HG-0775"] = svg("0 0 420 290", "".join(_w775 + [
    t(210, 275, "円周を24等分（アが真上=12時、時計回り。テ=9時の位置）", GRAY, 11),
]))

# ══ No.15 大問5（HG-0777）12列×8行の方眼、鏡は第6列の第2〜7行 ═══════════
GX7, GY7, CS7, NC, NR = 40, 20, 24, 12, 8
_mg = []
for c in range(NC + 1):
    _mg.append(ln(GX7 + c * CS7, GY7, GX7 + c * CS7, GY7 + NR * CS7, GRAY, 1, "1,2.5"))
for r in range(NR + 1):
    _mg.append(ln(GX7, GY7 + r * CS7, GX7 + NC * CS7, GY7 + r * CS7, GRAY, 1, "1,2.5"))
_mg.append(rect(GX7 + 6 * CS7, GY7 + 2 * CS7, CS7, 5 * CS7, HI, 2, HI, opacity=0.4))
_mg.append(t(GX7 + 6 * CS7 + CS7 / 2, GY7 + 4.5 * CS7, "平面鏡", HI, 11))
for lab, col, row in [("A", 3, 1), ("B", 2, 3), ("C", 5, 4), ("D", 3, 6)]:
    px, py = GX7 + col * CS7, GY7 + row * CS7
    _mg.append(dot(px, py, 4.5, TX))
    _mg.append(t(px, py - 10, lab, TX, 13))
_mg.append(defs_arrow("ar777u", TX))
_mg.append(arrow_path(15, GY7 + 14, 15, GY7 + 2, "ar777u", TX, 1.4))
_mg.append(t(15, GY7 - 4, "左", TX, 11))
_mg.append(defs_arrow("ar777d", TX))
_mg.append(arrow_path(15, GY7 + NR * CS7 - 14, 15, GY7 + NR * CS7 - 2, "ar777d", TX, 1.4))
_mg.append(t(15, GY7 + NR * CS7 + 16, "右", TX, 11))
FIGS["HG-0777"] = svg("0 0 380 260", "".join(_mg))

# ══ No.15 大問7（HG-0779）日光→虫めがね→紙に明るい円（距離A・直径B）═══════
_mg2 = []
LX0, LY0 = 150, 60
for dx in (-24, 0, 24):
    _mg2.append(defs_arrow("ar779_%d" % (dx + 100), TX))
    _mg2.append(arrow_path(LX0 + dx, LY0 - 45, LX0 + dx, LY0 - 18, "ar779_%d" % (dx + 100), TX, 1.4))
_mg2.append(t(LX0, LY0 - 55, "日光", TX, 11))
_mg2.append('<ellipse cx="%s" cy="%s" rx="34" ry="12" fill="%s" fill-opacity="0.3" stroke="%s" stroke-width="1.8" transform="rotate(-18 %s %s)"/>' % (
    LX0, LY0, HI, LINE, LX0, LY0))
_mg2.append(ln(LX0 + 30, LY0 + 6, LX0 + 70, LY0 + 16, LINE, 2))
_mg2.append(t(LX0 + 75, LY0 + 22, "虫めがね", TX, 11, "start"))
PY0 = 190
_mg2.append(poly([(60, PY0), (240, PY0), (270, PY0 + 24), (90, PY0 + 24)], LINE, 1.6))
_mg2.append(circ(LX0, PY0 + 10, 16, LINE, 1.6, "#0b0f1a", opacity=0.6))
_mg2.append(ln(LX0, LY0 + 12, LX0, PY0 - 4, GRAY, 1.2, "2,3"))
_mg2.append(t(LX0 + 12, (LY0 + PY0) / 2, "A", TX, 13, "start"))
_mg2.append(defs_arrow("ar779b1", GRAY))
_mg2.append(defs_arrow("ar779b2", GRAY))
_mg2.append(arrow_path(LX0 - 16, PY0 + 45, LX0 - 2, PY0 + 45, "ar779b1", GRAY, 1.2))
_mg2.append(arrow_path(LX0 + 16, PY0 + 45, LX0 + 2, PY0 + 45, "ar779b2", GRAY, 1.2))
_mg2.append(t(LX0, PY0 + 60, "B", TX, 13))
FIGS["HG-0779"] = svg("0 0 400 270", "".join(_mg2))

# ══ No.15 大問1（HG-0780）針穴写真機（外筒・内筒・針穴・すりガラス）═══════
FBL, FBR = (30, 170), (330, 170)
FTL, FTR = (30, 100), (330, 100)
DX, DY = 45, -25
BBL, BBR = (FBL[0] + DX, FBL[1] + DY), (FBR[0] + DX, FBR[1] + DY)
BTL, BTR = (FTL[0] + DX, FTL[1] + DY), (FTR[0] + DX, FTR[1] + DY)
_bx = [ln(*FBL, *FBR, LINE, 1.8), ln(*FTL, *FTR, LINE, 1.8), ln(*FBL, *FTL, LINE, 1.8),
        ln(*FBR, *FTR, LINE, 1.8)]
_bx += [ln(*FTR, *BTR, LINE, 1.8), ln(*FBR, *BBR, LINE, 1.8), ln(*BTR, *BBR, LINE, 1.8)]
_bx += [ln(*FTL, *BTL, GRAY, 1.2, "3,3"), ln(*FBL, *BBL, GRAY, 1.2, "3,3"),
         ln(*BTL, *BBL, GRAY, 1.2, "3,3"), ln(*BTL, *BTR, GRAY, 1.2, "3,3")]
PX0 = 140
Panel = [(PX0, FBL[1]), (PX0, FTL[1]), (PX0 + DX, FTL[1] + DY), (PX0 + DX, FBL[1] + DY)]
_bx.append(poly(Panel, LINE, 1.8, LINE, opacity=0.3))
_bx.append(t((FBL[0] + PX0) / 2 + DX / 2, FTL[1] - 12, "外筒", TX, 13))
_bx.append(t((PX0 + FBR[0]) / 2 + DX / 2, FTL[1] - 12, "内筒", TX, 13))
HOLE = (60, 140)
_bx.append(circ(*HOLE, 3, LINE, 1.4))
_bx.append(ln(HOLE[0] - 10, HOLE[1] + 14, HOLE[0], HOLE[1] + 3, GRAY, 1.2))
_bx.append(t(HOLE[0] - 14, HOLE[1] + 22, "針穴", TX, 12, "end"))
_bx.append(ln(PX0 + 10, FBL[1] + 18, PX0, FBL[1] + 2, GRAY, 1.2))
_bx.append(t(PX0 + 14, FBL[1] + 28, "すりガラス", TX, 12, "start"))
FIGS["HG-0780"] = svg("0 0 400 220", "".join(_bx))


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
