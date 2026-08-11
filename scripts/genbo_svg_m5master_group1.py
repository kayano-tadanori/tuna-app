# -*- coding: utf-8 -*-
"""学年5の最初のバッチ。小5マスター/小5復習12本（実質10図。HG-0661とHG-1520は同じ
   バス運賃表の問題、HG-0722とHG-1576は同じ円グラフの問題を別コース名で重複掲載）。

★根拠：
  G:\\マイドライブ\\浜問題\\5年算数\\5年算数 実力_No.1_No.2.pdf（HG-0661/HG-1520）
  G:\\マイドライブ\\浜問題\\5年算数\\5年算数 No.6_No.7_No.8.pdf（HG-0681/0682/0683）
  G:\\マイドライブ\\浜問題\\5年算数\\5年算数No.18_No.19.pdf（HG-0733/0734）
  G:\\マイドライブ\\浜問題\\5年算数\\5年算数 No.3_No.4_No.5.pdf（HG-1530）
  G:\\マイドライブ\\浜問題\\5年算数\\5年算数 No.9_No.10_No.11.pdf（HG-1550/1552）
  G:\\マイドライブ\\浜問題\\5年算数\\5年算数 No.15_No.16_No.17.pdf（HG-0722/HG-1576）
  を130〜500dpiで出して目視。

実物で確かめたページ対応：
  HG-0661/HG-1520 … 実力V(1枚目)大問4。A町→B町→C町→D町→E町の矢印図＋
                     左下がりの階段状三角表（70/140,100/180,120,50/240,180,100,80）
  HG-0681 … No.6 V(2枚目)大問6。円形の文字ばん、0が真上、時計回りに0〜11
  HG-0682 … No.6 V(2枚目)大問7。1〜8を7列でヘビ状に並べた数表（5行分を提示）
  HG-0683 … No.6 V(2枚目)大問8。1〜35の数表＋わく2種（⑦=たて2よこ3・和33の例、
             ④=3×3まん中なし・和216の例）
  HG-0733 … No.18 V(2枚目)大問7。3つの歯車A・B・Cが横一列に外接（歯数比3:4:7）
  HG-0734 … No.18 V(2枚目)大問9。タクシー料金表（0〜1500m未満700円、以降300mごと+80円）
  HG-1530 … No.3 V(2枚目)大問7。1本の直線に等分の印を重ねる模式図（実物は退色で
             判読不能のため、原簿の文章どおりに模式図を作図：3等分の内部2印＋
             4等分の内部3印→重なりなしで5印・6区間）
  HG-1550 … No.9 V(1枚目)大問5。3つのひし形判定ボックスのフローチャート（3→A/4→B/7→C/いいえ→D）
  HG-1552 … No.9 V(1枚目)大問4(2)。正方形の四すみ近くに長方形タイル、1cmのすきま、
             外周は点線の正方形（実物は左上2×2・右上1×2・左下2×1・右下1×1の配置例）
  HG-0722/HG-1576 … No.15 V(2枚目)大問7。円グラフ【先月の支出】衣料費50°(12時から時計回り)
             →貯金70°→食費130°→その他110°

  電池・豆電球などは登場しないので[[feedback_denchi_kigou_sahou]]の対象外。

使い方: python scripts/genbo_svg_m5master_group1.py [--write]
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


def rect(x, y, w, h, stroke=LINE, sw=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        r1(x), r1(y), r1(w), r1(h), fill, stroke, sw, d)


def circ(cx, cy, r, stroke=LINE, w=2, fill="none"):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(cx), r1(cy), r1(r), fill, stroke, w)


def dot(cx, cy, r=3.5, fill=TX):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r1(cx), r1(cy), r1(r), fill)


def pts(seq):
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), fill, stroke, w, d)


def defs_arrow(mid, color=HI):
    return ('<defs><marker id="%s" markerWidth="8" markerHeight="8" refX="6.5" refY="4"'
            ' orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % (mid, color))


def arrow_path(x1, y1, x2, y2, mid, color=HI, w=1.8):
    return '<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="%s" marker-end="url(#%s)"/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), color, w, mid)


FIGS = {}

# ══ 実力V 大問4（HG-0661／同一図をHG-1520にも使う）バス運賃の階段表 ══════════
BX, BY = 40, 20
TOWNS = ["A", "B", "C", "D", "E"]
FARES = [[], [70], [140, 100], [180, 120, 50], [240, 180, 100, 80]]
_bus = []
# 上段：矢印でつながる5つの町の箱
AW, AH, AG = 46, 46, 30
for i, nm in enumerate(TOWNS):
    x = BX + i * (AW + AG)
    _bus.append(rect(x, BY, AW, AH, LINE, 1.8))
    _bus.append(t(x + AW / 2, BY + 20, nm, TX, 14))
    _bus.append(t(x + AW / 2, BY + 38, "町", TX, 12))
    if i < 4:
        _bus.append(defs_arrow("ar_bus%d" % i))
        _bus.append(arrow_path(x + AW + 2, BY + AH / 2, x + AW + AG - 2, BY + AH / 2, "ar_bus%d" % i))
# 下段：階段状の三角表
TY0 = BY + AH + 40
CW, CH = 58, 30
for row in range(5):
    x0 = BX
    y0 = TY0 + row * CH
    for col in range(row):
        _bus.append(rect(x0 + col * CW, y0, CW, CH, LINE, 1.6))
        _bus.append(t(x0 + col * CW + CW / 2, y0 + 20, str(FARES[row][col]), TX, 13))
    lx = x0 + row * CW
    _bus.append(rect(lx, y0, CW, CH, LINE, 1.6))
    _bus.append(t(lx + CW / 2, y0 + 20, "%s町" % TOWNS[row], HI, 13))
_bus.append(t(BX + CW, TY0 + 5 * CH + 22, "（単位：円）", GRAY, 12, "start"))
FIGS["HG-0661"] = svg("0 0 520 260", "".join(_bus))
FIGS["HG-1520"] = FIGS["HG-0661"]

# ══ No.6 大問6（HG-0681）12gで1回転のはかり・円形の文字ばん0〜11 ═══════════
DCX, DCY, DR = 180, 150, 88
_dial = [circ(DCX, DCY, DR, LINE, 2)]
for i in range(12):
    ang = math.radians(-90 + i * 30)
    lx = DCX + (DR + 16) * math.cos(ang)
    ly = DCY + (DR + 16) * math.sin(ang) + 4
    _dial.append(t(lx, ly, str(i), TX, 13))
_dial.append(defs_arrow("ar_dial0", HI))
_dial.append(arrow_path(DCX, DCY - DR - 30, DCX, DCY - DR - 50, "ar_dial0"))
_dial.append(dot(DCX, DCY, 2.6))
FIGS["HG-0681"] = svg("0 0 440 290", "".join(_dial + [
    t(220, 278, "12gで1回転するはかり（文字ばんは0〜11。0の位置から時計回り）", GRAY, 11),
]))

# ══ No.6 大問7（HG-0682）1〜8を7列でヘビ状に並べた数表 ══════════════════
SNAKE = [
    [1, 2, 3, 4, 5, 6, 7],
    [6, 5, 4, 3, 2, 1, 8],
    [7, 8, 1, 2, 3, 4, 5],
    [4, 3, 2, 1, 8, 7, 6],
    [5, 6, 7, 8, 1, 2, 3],
]
GX7, GY7, CW7, CH7, LW7 = 90, 34, 42, 30, 46
_g7 = []
for c in range(7):
    _g7.append(t(GX7 + LW7 + c * CW7 + CW7 / 2, GY7 - 10, "%d列" % (c + 1), GRAY, 11))
for r in range(5):
    y = GY7 + r * CH7
    _g7.append(rect(GX7, y, LW7, CH7, LINE, 1.4))
    _g7.append(t(GX7 + LW7 / 2, y + 20, "%d行" % (r + 1), GRAY, 11))
    for c in range(7):
        _g7.append(rect(GX7 + LW7 + c * CW7, y, CW7, CH7, LINE, 1.4))
        _g7.append(t(GX7 + LW7 + c * CW7 + CW7 / 2, y + 20, str(SNAKE[r][c]), TX, 13))
_g7.append(t(GX7 + LW7 + 3.5 * CW7, GY7 + 5 * CH7 + 22, "⋮（100行目まで続く）", GRAY, 11))
FIGS["HG-0682"] = svg("0 0 460 230", "".join(_g7))

# ══ No.6 大問8（HG-0683）1〜35の数表＋わく2種（㋐たて2よこ3／㋑3×3まん中なし）══
NUMS = list(range(1, 36))
GX8, GY8, CS8 = 60, 30, 44
_g8 = []
for r in range(5):
    for c in range(7):
        v = NUMS[r * 7 + c]
        _g8.append(rect(GX8 + c * CS8, GY8 + r * CS8, CS8, CS8, LINE, 1.3))
        _g8.append(t(GX8 + c * CS8 + CS8 / 2, GY8 + r * CS8 + CS8 / 2 + 5, str(v), TX, 12))
# ㋐：たて2(行1-2)×よこ3(列1-3)、和=1+2+3+8+9+10=33
ax0, ay0 = GX8, GY8
_g8.append(rect(ax0, ay0, 3 * CS8, 2 * CS8, HI, 2.6))
_g8.append(t(ax0 + 3 * CS8 / 2, ay0 - 10, "㋐（和33の例）", HI, 12))
# ㋑：3×3(行3-5,列5-7)まん中(27)なし、和=19+20+21+26+28+33+34+35=216
bx0, by0 = GX8 + 4 * CS8, GY8 + 2 * CS8
_g8.append(rect(bx0, by0, 3 * CS8, 3 * CS8, HI, 2.6))
_g8.append(rect(bx0 + CS8, by0 + CS8, CS8, CS8, "#0d1220", 0, "#0d1220"))
_g8.append(rect(bx0 + CS8, by0 + CS8, CS8, CS8, HI, 1.6, "none", "4,3"))
_g8.append(t(bx0 + 3 * CS8 / 2, GY8 - 10, "㋑（和216の例・まん中なし）", HI, 12))
FIGS["HG-0683"] = svg("0 0 460 240", "".join(_g8))

# ══ No.18 大問7（HG-0733）歯車A・B・C横一列外接（歯数比3:4:7） ═══════════
rA, rB, rC = 21, 28, 49
gy = 70
gxA = 30 + rA
gxB = gxA + rA + rB
gxC = gxB + rB + rC
_gear = [circ(gxA, gy, rA, LINE, 1.8), t(gxA, gy + 5, "A", TX, 15),
         circ(gxB, gy, rB, LINE, 1.8), t(gxB, gy + 5, "B", TX, 15),
         circ(gxC, gy, rC, LINE, 1.8), t(gxC, gy + 5, "C", TX, 15)]
FIGS["HG-0733"] = svg("0 0 300 160", "".join(_gear + [
    t(150, 150, "歯車A・Bがかみあい、B・Cもかみあう（歯数の比A:B:C＝3:4:7）", GRAY, 11),
]))

# ══ No.18 大問9（HG-0734）タクシーの階段料金表 ══════════════════════════
RATE_ROWS = [("0〜1500未満", "700"), ("1500〜1800", "780"), ("1800〜2100", "860"), ("2100〜2400", "940")]
_rt = []
rx, ry, rw, rh = 40, 30, 200, 32
_rt.append(rect(rx, ry, rw, rh, LINE, 1.6))
_rt.append(t(rx + rw * 0.32, ry + 20, "走行距離(m)", TX, 12))
_rt.append(t(rx + rw * 0.78, ry + 20, "料金(円)", TX, 12))
for i, (dist, fee) in enumerate(RATE_ROWS):
    y = ry + rh * (i + 1)
    _rt.append(rect(rx, y, rw, rh, LINE, 1.6))
    _rt.append(t(rx + rw * 0.32, y + 20, dist, TX, 12))
    _rt.append(t(rx + rw * 0.78, y + 20, fee, TX, 12))
_rt.append(t(rx + rw / 2, ry + rh * 5 + 20, "……（以降も300mごとに80円ずつ増える）", GRAY, 11))
FIGS["HG-0734"] = svg("0 0 360 230", "".join(_rt))

# ══ No.3 大問7（HG-1530）1本の直線に等分の印を重ねる（模式図） ═══════════
LX0, LX1, LY1, LY2 = 40, 280, 50, 130
_lin = [t(LX0 - 15, LY1 - 22, "(図1) 3等分の印", GRAY, 12, "start")]
_lin.append(ln(LX0, LY1, LX1, LY1, LINE, 2))
for f in (1 / 3, 2 / 3):
    x = LX0 + (LX1 - LX0) * f
    _lin.append(ln(x, LY1 - 9, x, LY1 + 9, HI, 2.2))
_lin.append(t(LX0 - 15, LY2 - 22, "(図2) 3等分＋4等分の印を重ねる", GRAY, 12, "start"))
_lin.append(ln(LX0, LY2, LX1, LY2, LINE, 2))
for f in (1 / 3, 2 / 3):
    x = LX0 + (LX1 - LX0) * f
    _lin.append(ln(x, LY2 - 9, x, LY2 + 9, HI, 2.2))
for f in (1 / 4, 2 / 4, 3 / 4):
    x = LX0 + (LX1 - LX0) * f
    _lin.append(dot(x, LY2, 4.5, "#8fe3a3"))
_lin.append(t((LX0 + LX1) / 2, LY2 + 32, "縦線＝3等分の印　●＝4等分の印（同じ場所なら1個と数える）", GRAY, 11))
FIGS["HG-1530"] = svg("0 0 340 170", "".join(_lin))

# ══ No.9 大問5（HG-1550）3つの判定ボックスのフローチャート ═══════════════
DXs = [90, 260, 430]
DY = 90
DW, DH = 90, 50
COND = ["3で\nわりきれる", "4で\nわりきれる", "7で\nわりきれる"]
LET = ["A", "B", "C"]
_fc = [t(28, DY - 14, "はじめ", TX, 12, "middle")]
_fc.append(defs_arrow("ar_fc0", LINE))
_fc.append(arrow_path(28, DY, DXs[0] - DW / 2 - 2, DY, "ar_fc0", LINE))
for i, dx in enumerate(DXs):
    _fc.append(poly([(dx, DY - DH / 2), (dx + DW / 2, DY), (dx, DY + DH / 2), (dx - DW / 2, DY)], LINE, 1.8))
    for j, line in enumerate(COND[i].split("\n")):
        _fc.append(t(dx, DY - 4 + j * 14, line, TX, 11))
    _fc.append(defs_arrow("ar_fcU%d" % i, HI))
    _fc.append(arrow_path(dx, DY - DH / 2, dx, 26, "ar_fcU%d" % i, HI))
    _fc.append(t(dx + 8, DY - DH / 2 - 20, "はい", HI, 10, "start"))
    _fc.append(rect(dx - 16, 4, 32, 26, LINE, 1.6))
    _fc.append(t(dx, 22, LET[i], HI, 13))
    if i < 2:
        _fc.append(defs_arrow("ar_fcR%d" % i, LINE))
        _fc.append(arrow_path(dx + DW / 2, DY, DXs[i + 1] - DW / 2 - 2, DY, "ar_fcR%d" % i, LINE))
        _fc.append(t((dx + DXs[i + 1]) / 2, DY - 8, "いいえ", GRAY, 10))
_fc.append(defs_arrow("ar_fcD", LINE))
_fc.append(arrow_path(DXs[2], DY + DH / 2, DXs[2], DY + 78, "ar_fcD", LINE))
_fc.append(t(DXs[2] + 8, DY + DH / 2 + 16, "いいえ", GRAY, 10, "start"))
_fc.append(rect(DXs[2] - 16, DY + 78, 32, 26, LINE, 1.6))
_fc.append(t(DXs[2], DY + 96, "D", HI, 13))
FIGS["HG-1550"] = svg("0 0 520 210", "".join(_fc))

# ══ No.9 大問4(2)（HG-1552）正方形の四すみにタイル、1cmすきま、外周は点線 ═════
SQX, SQY, SQS = 30, 20, 190
_tl = [rect(SQX, SQY, SQS, SQS, GRAY, 1.6, "none", "5,4")]
TW, TH = 42, 42
gap = 10


def tile_block(x0, y0, cols, rows):
    out = []
    for c in range(cols):
        for r in range(rows):
            out.append(rect(x0 + c * TW, y0 + r * TH, TW, TH, LINE, 1.6))
    return out


_tl += tile_block(SQX, SQY, 2, 2)
_tl += tile_block(SQX + SQS - TW, SQY, 1, 2)
_tl += tile_block(SQX, SQY + SQS - TH, 2, 1)
_tl += tile_block(SQX + SQS - TW, SQY + SQS - TH, 1, 1)
FIGS["HG-1552"] = svg("0 0 480 240", "".join(_tl + [
    t(320, 90, "正方形の四すみ近くに", GRAY, 12, "start"),
    t(320, 110, "同じ向きのタイルを置き", GRAY, 12, "start"),
    t(320, 130, "1cmのすきまをあける", GRAY, 12, "start"),
    t(320, 150, "（外周の点線が正方形）", GRAY, 12, "start"),
]))

# ══ No.15 大問7（HG-0722／同一図をHG-1576にも使う）円グラフ【先月の支出】═════
PCX, PCY, PR = 150, 130, 92
SLICES = [("衣料費", 50), ("貯金", 70), ("食費", 130), ("その他", 110)]
_pie = []
ang = -90.0
for name, deg in SLICES:
    a0 = math.radians(ang)
    a1 = math.radians(ang + deg)
    x0, y0 = PCX + PR * math.cos(a0), PCY + PR * math.sin(a0)
    x1, y1 = PCX + PR * math.cos(a1), PCY + PR * math.sin(a1)
    large = 1 if deg > 180 else 0
    _pie.append('<path d="M%s,%s L%s,%s A%s,%s 0 %d 1 %s,%s Z" fill="none" stroke="%s" stroke-width="1.8"/>' % (
        r1(PCX), r1(PCY), r1(x0), r1(y0), r1(PR), r1(PR), large, r1(x1), r1(y1), LINE))
    mid = math.radians(ang + deg / 2)
    lx, ly = PCX + (PR + 26) * math.cos(mid), PCY + (PR + 26) * math.sin(mid)
    _pie.append(t(lx, ly, name, TX, 13))
    dlx, dly = PCX + (PR * 0.42) * math.cos(mid), PCY + (PR * 0.42) * math.sin(mid)
    _pie.append(t(dlx, dly + 4, "%d°" % deg, HI, 12))
    ang += deg
_pie.append(circ(PCX, PCY, 16, LINE, 1.4))
FIGS["HG-0722"] = svg("0 0 440 300", "".join(_pie + [
    t(220, 268, "【先月の支出】総支出288000円", GRAY, 11),
    t(220, 288, "12時位置から時計回りに衣料費→貯金→食費→その他", GRAY, 11),
]))
FIGS["HG-1576"] = FIGS["HG-0722"]


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
