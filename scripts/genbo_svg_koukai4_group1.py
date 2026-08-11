# -*- coding: utf-8 -*-
"""学年4の公開学力テスト等62本のうち、算数系10本を、PDFの実物を見て原簿に入れる。

★根拠：G:\\マイドライブ\\浜問題\\公開学力テスト\\2025年度 4年 公開テスト算数.pdf、
  \\模試、特別講座\\2022年度 4年 灘中日本一模試.pdf、
  \\模試、特別講座\\2025年度 4年 実力テスト 算・理.pdf を90〜600dpiで出して目視。
  原簿に図は入っていないのでここが唯一の根拠（feedback_zu_wa_genbo_ni_nai）。

実物で確かめたページ対応：
  HG-0941 … 2025公開第623回 算数1/3枚め 大問2(7)。ABB+ABB=BBCの縦の筆算
  HG-1339 … 2022灘中日本一模試 算数2/3枚め 大問9。正六角形＋内部の点から全頂点へ6本の
            線。(1)は6つの三角形のうち3つに27/16/17cm²（左・左上・右上の3連続）、
            (2)は別の六角形で19cm²・12cm²・「Q＋γ」（求める区画）・数値1つ判読不能
  HG-1340 … 同PDF 算数2/3枚め 大問10。60cm×60cm×80cmの直方体の水そう（見取図）。
            奥にBC、手前上にA、手前下にD。内部に仕切り（点線の縦長方形）と水面（波線）
  HG-1387 … 2025実力テスト 算数2/3枚め 大問3(2)。半径8cm・4cm、中心角90度の扇形の
            ドーナツ状（しゃ線）。中心は左下、直角記号あり
  HG-1390 … 同PDF 算数2/3枚め 大問5。A列・B列・C列の3列表（1,2,3／2,3,4／4,5,6／
            7,8,9／11,12,13／16,17,18／22,23,24／29,30,31）
  HG-1502 … 2025公開第626回 算数2/3枚め 大問4。◎→ア→イ→ウ→エ→☆→オ→カ→イ…の
            すごろく（イ〜カ〜☆が6マスのループ、◎とアはループ外の導入2マス）
  HG-1503 … 同ページ 大問5。[図1]AリングとBリングの断面寸法（A:内径5cm+厚み1cm×2、
            B:内径3cm+厚み1cm×2）／[図2]Aリング2こ連結／[図3]Aリング10こ連結（点線省略）
  HG-1504 … 2025公開第626回 算数1/3枚め 大問2(8)。3行3列の格子点から右下の1点だけ無い
            8点（上段3・中段3・下段2＝左2つ）
  HG-1506 … 2025公開第630回 算数2/3枚め 大問3。正六角形の頂点A(左上)B(右上)C(右)
            D(右下)E(左下)F(左)＝時計回り
  HG-1507 … 同ページ 大問4。正三角形を底辺に平行な線→その右端から左辺に平行な線で
            上の正三角形＋平行四辺形＋右下の小三角形に分割。[図1]無地／[図2]8cm／[図3]6cm

使い方: python scripts/genbo_svg_koukai4_group1.py [--write]
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


def pts(seq):
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), fill, stroke, w, d)


def defs_arrow(mid, color=HI):
    return ('<defs><marker id="%s" markerWidth="8" markerHeight="8" refX="6.5" refY="4"'
            ' orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % (mid, color))


def arrow(x1, y1, x2, y2, mid, color=HI, w=1.8):
    return '<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="%s" marker-end="url(#%s)"/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), color, w, mid)


FIGS = {}

# ══ 第623回 大問2(7)（HG-0941）ABB+ABB=BBC の縦の筆算 ══════════════════
_b41 = []
X0, Y0 = 210, 20
_b41 += [t(X0 + 70, Y0, "ＡＢＢ", TX, 20, "end"),
         t(X0 + 70, Y0 + 30, "＋ＡＢＢ", TX, 20, "end"),
         ln(X0 - 10, Y0 + 40, X0 + 80, Y0 + 40, LINE, 2),
         t(X0 + 70, Y0 + 68, "ＢＢＣ", HI, 20, "end")]
FIGS["HG-0941"] = svg("0 0 420 130", "".join(_b41 + [
    t(210, 118, "Ａ・Ｂ・Ｃは1〜9の異なる整数（同じ3けたを2回たすとBBCになる）", GRAY, 11),
]))

# ══ 灘中日本一模試 大問9（HG-1339）正六角形＋内部の点＋6本の線 ═══════════
def hexagon(cx, cy, r, rot=-90):
    v = []
    for i in range(6):
        a = math.radians(rot + i * 60)
        v.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return v


def hex_fig(cx, cy, r, px, py, labels, blank_labels=None):
    """labels: {edge_index: text}。edge i は 頂点i→頂点(i+1)"""
    v = hexagon(cx, cy, r)
    out = [poly(v, LINE, 2)]
    for vx, vy in v:
        out.append(ln(px, py, vx, vy, LINE, 1.4))
    for i, lab in (labels or {}).items():
        vx1, vy1 = v[i]
        vx2, vy2 = v[(i + 1) % 6]
        lx = (px + vx1 + vx2) / 3
        ly = (py + vy1 + vy2) / 3
        out.append(t(lx, ly, lab, HI if "？" not in lab and "＋" not in lab else GRAY, 13))
    return out


_h1 = hex_fig(140, 130, 90, 160, 140, {
    0: "17cm²",   # 上→右上
    4: "27cm²",   # 左下→左上
    5: "16cm²",   # 左上→上
})
_h1.append(t(140, 250, "(1)", GRAY, 13))
_h2x, _h2y = 420, 130
_h2 = hex_fig(_h2x, _h2y, 90, _h2x - 10, _h2y + 10, {
    0: "Q＋γ",    # 目的の区画（左）
    1: "？cm²",   # 原本が印刷かすれで判読不能
    2: "19cm²",
    3: "12cm²",
})
_h2.append(t(_h2x, 250, "(2)", GRAY, 13))
FIGS["HG-1339"] = svg("0 0 560 270", "".join(_h1 + _h2 + [
    t(280, 20, "正六角形の内部の点から全頂点へ線を引く。(2)の1つの数値は原本の印刷かすれで判読不能",
      GRAY, 11),
]))

# ══ 灘中日本一模試 大問10（HG-1340）60×60×80の直方体水そう＋仕切り ═══════
TX0, TY0, TW, TD, TH = 110, 62, 140, 50, 140
_b40 = []
FBL = (TX0, TY0 + TH); FBR = (TX0 + TW, TY0 + TH)
FTL = (TX0, TY0); FTR = (TX0 + TW, TY0)
BBL = (TX0 - TD, TY0 + TH - TD); BBR = (TX0 + TW - TD, TY0 + TH - TD)
BTL = (TX0 - TD, TY0 - TD); BTR = (TX0 + TW - TD, TY0 - TD)
_b40 += [
    ln(*FBL, *FBR, LINE, 2), ln(*FBR, *FTR, LINE, 2), ln(*FTR, *FTL, LINE, 2), ln(*FTL, *FBL, LINE, 2),
    ln(*FTL, *BTL, LINE, 2), ln(*FTR, *BTR, LINE, 2), ln(*BTL, *BTR, LINE, 2),
    ln(*FBR, *BBR, LINE, 2), ln(*BBR, *BTR, LINE, 2),
    ln(*BBL, *BBR, GRAY, 1.4, "3 2"), ln(*FBL, *BBL, GRAY, 1.4, "3 2"), ln(*BBL, *BTL, GRAY, 1.4, "3 2"),
]
_b40 += [t(FBR[0] + 10, FBR[1] + 4, "A", TX, 13, "start"),
         t(BTL[0] - 6, BTL[1] + 4, "B", TX, 13, "end"),
         t(BTR[0] + 8, BTR[1] + 14, "C", TX, 13, "start"),
         t(BBR[0] + 10, BBR[1] + 4, "D", TX, 13, "start")]
# 仕切り（点線の縦長方形、CD側＝右奥から20cm、高さ64/80）
PFRAC = 20.0 / 130
PX1, PY1 = BBR[0] - (BBR[0] - BBL[0]) * PFRAC, BBR[1] - (BBR[1] - BBL[1]) * PFRAC
PX2, PY2 = PX1, PY1 - TH * (64.0 / 80)
_b40 += [ln(PX1, PY1, PX2, PY2, HI, 2.2, "4 3")]
# 水面（波線、満水の高さ付近）
_wy = FBL[1] - TH * 0.96
_b40 += [ln(FBL[0] + 6, _wy, FBR[0] - 6, _wy, GRAY, 1.4, "2 2")]
_b40 += [t((FBL[0] + FBR[0]) / 2, FBL[1] + 18, "60cm", TX, 12),
         t(BBL[0] - 10, (BBL[1] + FBL[1]) / 2, "60cm", TX, 12, "end"),
         t(FTL[0] - 10, (FTL[1] + FBL[1]) / 2, "80cm", TX, 12, "end")]
FIGS["HG-1340"] = svg("0 0 420 260", "".join(_b40 + [
    t(210, 250, "底面60cm×60cm・高さ80cmの水そう。仕切り（オレンジ点線）はCD側から20cm・高さ64cm",
      GRAY, 11),
]))

# ══ 実力テスト 大問3(2)（HG-1387）半径8cm・4cm、中心角90度のドーナツ ═══════
CX7, CY7, R7, r7 = 40, 200, 160, 80
_b87 = [
    '<path d="M %s %s A %s %s 0 0 0 %s %s L %s %s A %s %s 0 0 1 %s %s Z" fill="rgba(79,158,255,0.28)" stroke="%s" stroke-width="2"/>' % (
        CX7 + R7, CY7, R7, R7, CX7, CY7 - R7, CX7, CY7 - r7, r7, r7, CX7 + r7, CY7, LINE),
    ln(CX7, CY7, CX7 + 16, CY7, GRAY, 1.4), ln(CX7, CY7, CX7, CY7 - 16, GRAY, 1.4),
    rect(CX7, CY7 - 12, 12, 12, GRAY, 1.2),
    t(CX7 + R7 / 2, CY7 + 18, "8cm", TX, 12),
    t(CX7 - 10, CY7 - r7 / 2, "4cm", TX, 12, "end"),
]
FIGS["HG-1387"] = svg("0 0 320 220", "".join(_b87 + [
    t(160, 210, "半径8cm・中心角90度の扇形から、同じ中心の半径4cmの扇形を切り取った図形", GRAY, 11),
]))

# ══ 実力テスト 大問5（HG-1390）A列・B列・C列の3列表 ═════════════════════
TA = [1, 2, 4, 7, 11, 16, 22, 29]
TB = [2, 3, 5, 8, 12, 17, 23, 30]
TC = [3, 4, 6, 9, 13, 18, 24, 31]
CW9, CH9, OX9b, OY9b = 60, 26, 140, 30
_b90 = []
for c, lab in enumerate(["A列", "B列", "C列"]):
    _b90.append(rect(OX9b + c * CW9, OY9b, CW9, CH9, LINE, 1.6))
    _b90.append(t(OX9b + c * CW9 + CW9 / 2, OY9b + 18, lab, HI, 13))
for r, (a, b, c) in enumerate(zip(TA, TB, TC)):
    y = OY9b + (r + 1) * CH9
    for cc, v in enumerate((a, b, c)):
        _b90.append(rect(OX9b + cc * CW9, y, CW9, CH9, LINE, 1.2))
        _b90.append(t(OX9b + cc * CW9 + CW9 / 2, y + 18, str(v), TX, 13))
FIGS["HG-1390"] = svg("0 0 460 300", "".join(_b90 + [
    t(230, OY9b + 9 * CH9 + 20, "A列→B列→C列→A列→…の順に上から数をならべる", GRAY, 11),
]))

# ══ 第626回 大問4（HG-1502）◎→ア→イ→ウ→エ→☆→オ→カ→イ… のすごろく ═══
def node(cx, cy, s, lab, filled=False):
    out = [rect(cx - s / 2, cy - s / 2, s, s, LINE, 1.8)]
    if lab == "◎":
        out += [circ(cx, cy, s * 0.28, LINE, 1.6), circ(cx, cy, s * 0.1, LINE, 1.6)]
    elif lab == "☆":
        st = []
        for i in range(5):
            a = math.radians(-90 + i * 144)
            st.append((cx + s * 0.32 * math.cos(a), cy + s * 0.32 * math.sin(a)))
        out.append(poly(st, HI, 1.6))
    else:
        out.append(t(cx, cy + 5, lab, TX, 15))
    return out


NODES = {
    "◎": (200, 30), "ア": (200, 100), "イ": (200, 170),
    "ウ": (120, 240), "エ": (120, 310), "☆": (200, 350),
    "オ": (280, 310), "カ": (280, 240),
}
_b02 = []
S2 = 46
for lab, (cx, cy) in NODES.items():
    _b02 += node(cx, cy, S2, lab)
_b02.append(defs_arrow("ar1502", HI))
EDGES = [("◎", "ア"), ("ア", "イ"), ("イ", "ウ"), ("ウ", "エ"), ("エ", "☆"), ("☆", "オ"), ("オ", "カ"), ("カ", "イ")]
for a, b in EDGES:
    ax, ay = NODES[a]
    bx, by = NODES[b]
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    x1, y1 = ax + ux * S2 * 0.6, ay + uy * S2 * 0.6
    x2, y2 = bx - ux * S2 * 0.6, by - uy * S2 * 0.6
    _b02.append(arrow(x1, y1, x2, y2, "ar1502"))
FIGS["HG-1502"] = svg("0 0 600 390", '<g transform="translate(100,0)">' + "".join(_b02) + "</g>" + t(
    300, 380, "◎スタート→☆ゴール。イ〜カ〜☆は6マスのループ。☆に止まったらふらない", GRAY, 11))

# ══ 第626回 大問5（HG-1503）Aリング・Bリングの重なりぐあい ═══════════════
K5 = 6.5  # 1cm=6.5px


def ring(cx, cy, din, thick):
    ro = (din / 2 + thick) * K5
    ri = (din / 2) * K5
    return [circ(cx, cy, ro, LINE, 1.8), circ(cx, cy, ri, LINE, 1.2, "none")]


_b03 = []
# [図1] AとBの断面寸法
_b03 += ring(70, 90, 5, 1)
_b03 += [t(70, 30, "Aのリング", GRAY, 11),
         t(70, 90, "5cm", TX, 11), t(45, 60, "1cm", TX, 10, "end"), t(95, 60, "1cm", TX, 10, "start")]
_b03 += ring(190, 100, 3, 1)
_b03 += [t(190, 40, "Bのリング", GRAY, 11),
         t(190, 100, "3cm", TX, 11), t(168, 74, "1cm", TX, 10, "end"), t(212, 74, "1cm", TX, 10, "start")]
_b03.append(t(130, 190, "[図1]", GRAY, 11))
# [図2] Aリング2こ連結
AX2, AY2, STEP2 = 320, 80, 5 * K5
_ro2 = 3.5 * K5
_b03 += ring(AX2, AY2, 5, 1)
_b03 += ring(AX2, AY2 + STEP2, 5, 1)
_b03 += [ln(AX2 + 55, AY2 - _ro2, AX2 + 55, AY2 + STEP2 + _ro2, GRAY, 1.2),
         t(AX2 + 65, AY2 + STEP2 / 2, "(1)cm", TX, 11, "start")]
_b03.append(t(AX2, 190, "[図2]", GRAY, 11))
# [図3] Aリング10こ連結（4こ描いて点線で省略）
AX3, AY3, STEP3 = 470, 55, 5 * K5
for i in range(4):
    _b03 += ring(AX3, AY3 + i * STEP3, 5, 1)
_b03 += [t(AX3, AY3 + 3.6 * STEP3, "︙", GRAY, 16)]
_ro3 = 3.5 * K5
_b03 += [ln(AX3 + 55, AY3 - _ro3, AX3 + 55, AY3 + 3 * STEP3 + _ro3, GRAY, 1.2),
         t(AX3 + 65, AY3 + 1.5 * STEP3, "(2)cm", TX, 11, "start")]
_b03.append(t(AX3, 190, "[図3]", GRAY, 11))
FIGS["HG-1503"] = svg("0 0 620 210", "".join(_b03 + [
    t(310, 202, "1cmの厚みのA・Bのリング。すきまなくつなげてぶら下げたときの上下の長さ", GRAY, 11),
]))

# ══ 第626回 大問2(8)（HG-1504）8点（3×3から右下の1点だけ無い） ═══════════
CS4b, OX4b, OY4b = 42, 60, 30
_b04 = []
for r in range(3):
    for c in range(3):
        if r == 2 and c == 2:
            continue
        _b04.append('<circle cx="%s" cy="%s" r="5" fill="%s"/>' % (
            r1(OX4b + c * CS4b), r1(OY4b + r * CS4b), TX))
FIGS["HG-1504"] = svg("0 0 320 200", "".join(_b04 + [
    t(160, 190, "上下左右同じ間かくの8点（3×3から右下の1点だけ無い）から4点で正方形を作る",
      GRAY, 11),
]))

# ══ 第630回 大問3（HG-1506）正六角形の頂点A〜F（時計回り） ══════════════
_hv = hexagon(180, 110, 90, rot=-120)  # A=左上から時計回り(A→B→C→D→E→F)
_labels6 = ["A", "B", "C", "D", "E", "F"]
_b06 = [poly(_hv, LINE, 2)]
for (vx, vy), lab in zip(_hv, _labels6):
    dx, dy = vx - 180, vy - 110
    L = math.hypot(dx, dy) or 1
    _b06.append(t(vx + dx / L * 18, vy + dy / L * 18, lab, HI, 14))
FIGS["HG-1506"] = svg("0 0 360 240", "".join(_b06 + [
    t(180, 228, "正六角形の頂点A〜F（A→B→C→D→E→Fが時計回り）。コマは最初Aにある", GRAY, 11),
]))

# ══ 第630回 大問4（HG-1507）正三角形→正三角形＋平行四辺形＋三角形 ═══════
def tri_cut(cx, apex_y, base_y, half_w, cut_ratio, label_top, label_mid, dim_label=None, dim_side="bottom"):
    """cut_ratio: 上から見た水平線の高さ割合（0=頂点,1=底辺）"""
    L, R = cx - half_w, cx + half_w
    cy = apex_y + (base_y - apex_y) * cut_ratio
    # 水平線の左右端（三角形の辺上）
    lx = cx - half_w * cut_ratio
    rx = cx + half_w * cut_ratio
    out = [poly([(cx, apex_y), (L, base_y), (R, base_y)], LINE, 2)]
    out.append(ln(lx, cy, rx, cy, LINE, 1.8))
    # 右端から左辺に平行な線を下ろす（左辺の傾き = (L-cx)/(base_y-apex_y)）
    slope_x = (L - cx) / (base_y - apex_y)
    dx = slope_x * (base_y - cy)
    out.append(ln(rx, cy, rx + dx, base_y, LINE, 1.8))
    out.append(t(cx, (apex_y + cy) / 2 + 5, label_top, TX, 14))
    out.append(t((lx + rx + rx + dx) / 4 - (rx - rx - dx) / 8, (cy + base_y) / 2 + 3, label_mid, TX, 14))
    if dim_label:
        if dim_side == "bottom":
            out.append(t((L + rx + dx) / 2, base_y + 20, dim_label, HI, 12))
            out.append(ln(L, base_y + 10, rx + dx, base_y + 10, HI, 1.4))
        else:
            out.append(t(R + 22, (cy + base_y) / 2, dim_label, HI, 12, "start"))
            out.append(ln(R + 6, cy, R + 6, base_y, HI, 1.4))
    return out


_b07 = []
_b07 += tri_cut(90, 20, 170, 80, 0.55, "", "ア")
_b07.append(t(90, 190, "[図1]", GRAY, 11))
_b07 += [x.replace('cx="90"', 'cx="290"') if False else x for x in tri_cut(290, 20, 170, 80, 0.55, "イ", "ウ", "8cm", "bottom")]
_b07.append(t(290, 190, "[図2]", GRAY, 11))
_b07 += tri_cut(490, 20, 170, 80, 0.62, "エ", "オ", "6cm", "right")
_b07.append(t(490, 190, "[図3]", GRAY, 11))
FIGS["HG-1507"] = svg("0 0 620 210", "".join(_b07 + [
    t(310, 202, "正三角形を底辺に平行な線＋その右はしから左辺に平行な線で3つに分ける", GRAY, 11),
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
