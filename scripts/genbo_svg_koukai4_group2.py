# -*- coding: utf-8 -*-
"""学年4の残り52本（すべて理科）のうち、2020年度4年公開学力テスト理科の10本
   （第564〜573回）を、PDFの実物を見て原簿に入れる。

★根拠：G:\\マイドライブ\\浜問題\\公開学力テスト\\2020年度 4年 公開テスト理科.pdf
  （37ページ）を90〜130dpiで出して目視。原簿に図は入っていないのでここが唯一の
  根拠（feedback_zu_wa_genbo_ni_nai）。

実物で確かめたページ対応（ページはこのPDF内の通し番号）：
  HG-2801 … 第564回p6（4枚のうち3枚め）大問3(3)。ばねばかり→糸→棒磁石(下端S)→
            すきま→じしゃくA(上面S)→台ばかり、の縦一列
  HG-2802 … 第565回p9 大問4。同じ体積の立方体アイコンA・B・C＋重さの表(270/790/50g)
  HG-2803 … 第566回p12 大問4(2)。6たん子A〜F。A(右上)-電池-B(左)／C(左下)-どう線-F
            (右)／F-どう線-E(下)／D(下)-電池-E
  HG-2804 … 第567回p16 大問4。とつレンズ→F点に収束する光線図。あ・い・うの3本の
            水平線（レンズに近い順）
  HG-2805 … 第568回p19 大問4。天井+ゴムひも+おもりの図＋重さと長さの表
            (80,120,160,200,300g / 54,58,62,66,76cm)
  HG-2806 … 第569回p22 大問4。[図1]欠けた棒磁石+物体A(あ・い)／[図2]棒磁石+鉄くぎ3本
            (P→Q)／[図3]棒磁石(S)+ぬいばり(矢印→R)／[図4]棒磁石(N-S)+方位じしん①②
  HG-2807 … 第570回p25 大問4(2)。7たん子A〜G。A-電池-B(黒丸)／C-電池-D／C-電池
            (縦)-E／F-電池-G(灰丸)／B-どう線-G(右端の縦線)
  HG-2808 … 第571回p28 大問4。とつレンズ→しょう点の光線図＋ドーナツ状の明るい円/かげ
            ＋距離と直径の表(2,6,8,10,14,20,22cm / 16,14,13,12,10,7,6cm)
  HG-2809 … 第572回p31 大問4。中央の縦バス線。A・Bは2個の電池が並列で左上から合流、
            Cはバスに直結、D・E・Fは電池つきの枝でバスの3か所に接続
  HG-2810 … 第573回p34 大問4(1)。金ぞく板①正方形(A右上B/×左下C)②U字(×左上A/B左下C)
            ③E字(C右上/B中/A左下×)。(2)は傾けた試験管P(底を熱)・Q(水面付近を熱)

使い方: python scripts/genbo_svg_koukai4_group2.py [--write]
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


def battery(cx, cy, w=26, h=16, vertical=False, label=None):
    """乾電池の記号（横長の四角）"""
    if vertical:
        out = [rect(cx - h / 2, cy - w / 2, h, w, LINE, 1.8)]
    else:
        out = [rect(cx - w / 2, cy - h / 2, w, h, LINE, 1.8)]
    if label:
        out.append(t(cx, cy + (w / 2 + 14 if vertical else h / 2 + 16), label, GRAY, 10))
    return out


def magnet(x, y, w, h, n_left=True, label_gap=0):
    """棒磁石（N=濃色・S=白抜き）"""
    half = w / 2
    nx, sx = (x, x + half) if n_left else (x + half, x)
    out = [rect(x, y, half, h, LINE, 1.8, "#2a3560"), rect(x + half, y, half, h, LINE, 1.8, "none")]
    out.append(t(nx + half / 2, y + h / 2 + 5, "N", HI, 13))
    out.append(t(sx + half / 2, y + h / 2 + 5, "S", TX, 13))
    return out


FIGS = {}

# ══ 第564回 大問3(3)（HG-2801）ばねばかり→棒磁石(S)→じしゃくA(S)→台ばかり ═════
_b01 = []
CX1 = 90
_b01 += [rect(CX1 - 14, 10, 28, 34, LINE, 1.8), ln(CX1, 44, CX1, 62, LINE, 1.6)]
_b01 += magnet(CX1 - 26, 62, 52, 22, n_left=True)
_b01 += [ln(CX1, 84, CX1, 104, GRAY, 1.4, "2 2")]
_b01 += magnet(CX1 - 26, 104, 52, 22, n_left=False)
_b01 += [rect(CX1 - 30, 126, 60, 34, LINE, 1.8), circ(CX1, 143, 13, LINE, 1.4)]
_b01 += [t(CX1 + 40, 25, "ばねばかり(100g)", TX, 11, "start"),
         t(CX1 + 40, 73, "ぼうじしゃく(100g)", TX, 11, "start"),
         t(CX1 + 40, 115, "じしゃくA(300g)", TX, 11, "start"),
         t(CX1 + 40, 143, "台ばかり", TX, 11, "start")]
FIGS["HG-2801"] = svg("0 0 320 180", "".join(_b01 + [
    t(160, 172, "S極どうしが向かい合う。ばねばかり・台ばかりの目もりの変化を考える", GRAY, 11),
]))

# ══ 第565回 大問4（HG-2802）同体積の立方体A・B・C＋重さの表 ═══════════════
def cube_ico(cx, cy, s):
    x0, y0 = cx - s, cy - s * 0.4
    d = s * 0.5
    return [
        poly([(x0, y0), (x0 + s * 2, y0), (x0 + s * 2, y0 + s * 1.3), (x0, y0 + s * 1.3)], LINE, 1.8),
        poly([(x0, y0), (x0 + d, y0 - d), (x0 + s * 2 + d, y0 - d), (x0 + s * 2, y0)], LINE, 1.6),
        poly([(x0 + s * 2, y0), (x0 + s * 2 + d, y0 - d), (x0 + s * 2 + d, y0 + s * 1.3 - d), (x0 + s * 2, y0 + s * 1.3)], LINE, 1.6),
    ]


_b02 = []
_names2 = ["物体A", "物体B", "物体C"]
_cxs2 = [70, 180, 290]
for cx, nm in zip(_cxs2, _names2):
    _b02 += cube_ico(cx, 70, 34)
    _b02.append(t(cx, 130, nm, TX, 12))
TW2, TH2, TX2, TY2 = 90, 26, 200, 150
for r, (lab, val) in enumerate(zip(_names2, ["270g", "790g", "50g"])):
    y = TY2 + r * TH2
    _b02 += [rect(TX2, y, TW2, TH2, LINE, 1.4), t(TX2 + TW2 / 2, y + 18, lab, HI, 12),
             rect(TX2 + TW2, y, TW2, TH2, LINE, 1.4), t(TX2 + TW2 * 1.5, y + 18, val, TX, 12)]
FIGS["HG-2802"] = svg("0 0 420 250", "".join(_b02 + [
    t(210, 240, "同じ体積の物体A〜C（木・鉄・アルミニウムのいずれか）と重さの表", GRAY, 11),
]))

# ══ 第566回 大問4(2)（HG-2803）6たん子A〜F。A-電池-B／C-どう線-F-どう線-E／D-電池-E ══
P3 = {"A": (230, 40), "B": (110, 70), "C": (60, 190), "F": (250, 110), "E": (250, 210), "D": (250, 260)}
_b03 = [rect(30, 20, 280, 260, LINE, 1.6, "none")]
_b03 += battery((P3["A"][0] + P3["B"][0]) / 2, (P3["A"][1] + P3["B"][1]) / 2 - 4, 30, 16)
_b03 += [ln(P3["A"][0], P3["A"][1], P3["A"][0] - 15, P3["A"][1] + 8, LINE, 1.8),
         ln(P3["B"][0] + 15, P3["B"][1] - 8, P3["B"][0], P3["B"][1], LINE, 1.8)]
_b03 += [ln(*P3["C"], *P3["F"], LINE, 1.8), ln(*P3["F"], *P3["E"], LINE, 1.8)]
_b03 += battery((P3["D"][0] + P3["E"][0]) / 2, (P3["D"][1] + P3["E"][1]) / 2, 16, 30, vertical=True)
_b03 += [ln(P3["D"][0], P3["D"][1], P3["D"][0], P3["D"][1] - 15, LINE, 1.8),
         ln(P3["E"][0], P3["E"][1], P3["E"][0], P3["E"][1] + 15, LINE, 1.8)]
_lab_off3 = {"A": (14, -6, "start"), "B": (-14, -6, "end"), "C": (-14, -6, "end"),
             "F": (14, -6, "start"), "E": (14, 4, "start"), "D": (14, 4, "start")}
for k, (x, y) in P3.items():
    dx, dy, anchor = _lab_off3[k]
    _b03 += [dot(x, y), t(x + dx, y + dy, k, HI, 14, anchor)]
FIGS["HG-2803"] = svg("0 0 460 300", '<g transform="translate(60,0)">' + "".join(_b03) + "</g>" + t(
    230, 292, "6つのたん子A〜F。A-電池-B／C-どう線-F-どう線-E／D-電池-E", GRAY, 11))

# ══ 第567回 大問4（HG-2804）とつレンズ→F点の光線＋あ・い・う ═══════════════
LX4, LY4, LH4, FX4, FY4 = 70, 40, 130, 260, 170
_b04 = [ln(LX4, LY4 + LH4 / 2, FX4, FY4, LINE, 1.4)]
for frac in (0, 0.25, 0.5, 0.75, 1):
    y = LY4 + LH4 * frac
    _b04 += [ln(10, y, LX4, y, TX, 1.6), ln(LX4, y, FX4, FY4, LINE, 1.6)]
_b04.append('<ellipse cx="%s" cy="%s" rx="10" ry="%s" fill="none" stroke="%s" stroke-width="2"/>' % (
    r1(LX4), r1(LY4 + LH4 / 2), r1(LH4 / 2), LINE))
for i, lab in enumerate(["あ", "い", "う"]):
    y = FY4 - 60 + i * 30
    _b04 += [ln(FX4 - 60, y, FX4 + 30, y, GRAY, 1.2, "3 2"), t(FX4 + 42, y + 4, lab, HI, 13)]
_b04 += [dot(FX4, FY4, 3.5, TX), t(FX4, FY4 + 20, "F点", TX, 12)]
_b04 += [t(LX4 - 30, LY4 - 10, "日光", GRAY, 12)]
FIGS["HG-2804"] = svg("0 0 340 220", "".join(_b04 + [
    t(170, 210, "とつレンズを通った日光がF点に集まる。あ・い・うはレンズに近い順の3位置", GRAY, 11),
]))

# ══ 第568回 大問4（HG-2805）天井+ゴムひも+おもり＋表 ═══════════════════════
_b05 = [
    '<line x1="20" y1="20" x2="140" y2="20" stroke="%s" stroke-width="6"/>' % GRAY,
    ln(80, 20, 80, 80, LINE, 2), circ(80, 96, 16, LINE, 2),
    t(20, 14, "天井", GRAY, 11), t(96, 50, "ゴムひも", TX, 11, "start"), t(96, 96, "おもり", TX, 11, "start"),
]
CW5, CH5, OX5, OY5 = 58, 26, 150, 20
VALS5 = ["80", "120", "160", "200", "300"], ["54", "58", "62", "66", "76"]
for r, (lab, vals) in enumerate(zip(["おもり(g)", "長さ(cm)"], VALS5)):
    y = OY5 + r * CH5
    _b05.append(rect(OX5, y, 90, CH5, LINE, 1.4))
    _b05.append(t(OX5 + 45, y + 18, lab, HI, 11))
    for c, v in enumerate(vals):
        _b05.append(rect(OX5 + 90 + c * CW5, y, CW5, CH5, LINE, 1.2))
        _b05.append(t(OX5 + 90 + c * CW5 + CW5 / 2, y + 18, v, TX, 12))
FIGS["HG-2805"] = svg("0 0 540 130", "".join(_b05 + [
    t(270, 120, "天井につるしたゴムひもにおもりをつるし、長さを調べた", GRAY, 11),
]))

# ══ 第569回 大問4（HG-2806）欠けた磁石／鉄くぎ／ぬいばり／方位じしん ═══════════
_b06 = []
# [図1] 欠けた磁石＋物体A
_b06 += magnet(20, 20, 70, 22, n_left=True)
_b06 += [ln(60, 42, 60, 55, GRAY, 1.2, "3 2"), poly([(60, 55), (95, 55), (100, 68), (55, 68)], LINE, 1.6),
         t(55, 78, "あ", HI, 11, "end"), t(102, 78, "い", HI, 11, "start"),
         t(55, 8, "[図1]物体A", GRAY, 10)]
# [図2] 鉄くぎ3本
_b06 += magnet(150, 20, 70, 18, n_left=False)
_b06 += [t(150, 8, "[図2]P側", GRAY, 10), t(150, 46, "P", TX, 11)]
for i in range(3):
    y0 = 42 + i * 16
    _b06 += [poly([(150, y0), (156, y0 + 14), (144, y0 + 14)], LINE, 1.4)]
_b06 += [t(150, 100, "Q", TX, 11)]
# [図3] ぬいばり
_b06 += magnet(255, 20, 70, 18, n_left=False)
_b06 += [t(255, 8, "[図3]S極でこする", GRAY, 10)]
_b06 += [ln(230, 60, 330, 60, TX, 1.8), t(226, 64, "P", TX, 11, "end"), t(334, 64, "R", TX, 11, "start")]
_b06.append(defs_arrow("ar06", HI))
_b06.append('<path d="M320,50 L240,50" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar06)"/>' % HI)
# [図4] 磁石＋方位じしん①②
_b06 += magnet(20, 150, 90, 22, n_left=True)
_b06 += [circ(10, 185, 14, LINE, 1.6), t(10, 205, "①", TX, 11)]
_b06 += [circ(65, 200, 14, LINE, 1.6), t(65, 220, "②", TX, 11)]
_b06 += [t(65, 138, "[図4]", GRAY, 10)]
FIGS["HG-2806"] = svg("0 0 400 240", "".join(_b06 + [
    t(200, 232, "欠けた磁石／鉄くぎ3本／ぬいばり／方位じしん①②のようす", GRAY, 11),
]))

# ══ 第570回 大問4(2)（HG-2807）7たん子A〜G ═════════════════════════════
# 実物の配置そのまま：A-B(横)は上段、C-D(横)は中段、CからまっすぐEへ(縦)、
# F-G(横)は下段、Gの真上にB（右はしをどう線でまっすぐ縦につなぐ）
P7 = {"A": (75, 50), "B": (250, 50), "C": (75, 150), "D": (195, 150),
      "E": (75, 270), "F": (170, 270), "G": (250, 270)}
_b07 = [rect(30, 20, 260, 275, LINE, 1.4)]


def link(a, b, vertical=False, bw=30, bh=16):
    ax, ay = P7[a]
    bx, by = P7[b]
    mx, my = (ax + bx) / 2, (ay + by) / 2
    out = list(battery(mx, my, bw, bh, vertical=True)) if vertical else list(battery(mx, my, bw, bh))
    if vertical:
        out += [ln(ax, ay, ax, my - bw / 2, LINE, 1.8), ln(bx, by, bx, my + bw / 2, LINE, 1.8)]
    else:
        out += [ln(ax, ay, mx - bw / 2, ay, LINE, 1.8), ln(mx + bw / 2, by, bx, by, LINE, 1.8)]
    return out


_b07 += link("A", "B")
_b07 += link("C", "D")
_b07 += link("C", "E", vertical=True)
_b07 += link("F", "G")
_b07 += [ln(P7["B"][0], P7["B"][1], P7["B"][0], P7["G"][1], GRAY, 1.8),
         ln(P7["B"][0], P7["G"][1], P7["G"][0], P7["G"][1], GRAY, 1.8)]
_b07 += [t((P7["B"][0] + P7["G"][0]) / 2 + 10, (P7["B"][1] + P7["G"][1]) / 2, "どう線", GRAY, 11, "start")]
for k, (x, y) in P7.items():
    _b07 += [dot(x, y, 4.5, HI if k in ("B", "G") else TX), t(x, y - 12, k, HI, 13)]
FIGS["HG-2807"] = svg("0 0 460 300", '<g transform="translate(60,0)">' + "".join(_b07) + "</g>" + t(
    230, 292, "7つのたん子A〜G。かん電池4個の向き（＋の位置）は原簿の作問メモのとおり", GRAY, 11))

# ══ 第571回 大問4（HG-2808）とつレンズ→しょう点＋ドーナツ状のかげ＋表 ═════════
LX8, LY8, LH8, FX8, FY8 = 60, 30, 120, 260, 90
_b08 = []
for frac in (0, 0.25, 0.5, 0.75, 1):
    y = LY8 + LH8 * frac
    _b08 += [ln(10, y, LX8, y, TX, 1.6), ln(LX8, y, FX8, FY8, LINE, 1.6)]
_b08.append('<ellipse cx="%s" cy="%s" rx="10" ry="%s" fill="none" stroke="%s" stroke-width="2"/>' % (
    r1(LX8), r1(LY8 + LH8 / 2), r1(LH8 / 2), LINE))
_b08 += [dot(FX8, FY8, 3.5, TX), t(FX8, FY8 - 12, "しょう点", TX, 11)]
_b08 += [ln(150, 20, 150, 160, GRAY, 1.2, "3 2"), t(150, 175, "A", TX, 12)]
AX8, AY8, AR8 = 300, 90, 40
_b08 += [circ(AX8, AY8, AR8, LINE, 1.6, "rgba(154,163,192,0.4)"), circ(AX8, AY8, AR8 * 0.42, LINE, 1.6, "#0f1420")]
_b08.append(t(AX8, AY8 - AR8 - 8, "Aの位置の紙", GRAY, 10))
CW8, CH8, OX8, OY8 = 40, 26, 20, 200
VALS8 = ["2", "6", "8", "10", "14", "20", "22"], ["16", "14", "13", "12", "10", "7", "6"]
for r, (lab, vals) in enumerate(zip(["きょり(cm)", "直径(cm)"], VALS8)):
    y = OY8 + r * CH8
    _b08.append(rect(OX8, y, 80, CH8, LINE, 1.4))
    _b08.append(t(OX8 + 40, y + 18, lab, HI, 10))
    for c, v in enumerate(vals):
        _b08.append(rect(OX8 + 80 + c * CW8, y, CW8, CH8, LINE, 1.2))
        _b08.append(t(OX8 + 80 + c * CW8 + CW8 / 2, y + 18, v, TX, 11))
FIGS["HG-2808"] = svg("0 0 400 280", "".join(_b08 + [
    t(200, 274, "とつレンズを通った日光がしょう点に集まる。Aの位置の紙にできる明るい円とかげ", GRAY, 11),
]))

# ══ 第572回 大問4（HG-2809）中央バス線＋A・B（並列）／C（直結）／D・E・F（枝） ═══
BUSX, BUS_TOP, BUS_BOT = 150, 30, 250
_b09 = [ln(BUSX, BUS_TOP, BUSX, BUS_BOT, LINE, 2.2)]
JY9 = 60
_b09 += [ln(BUSX, JY9, 40, JY9 - 20, LINE, 1.6), ln(BUSX, JY9, 40, JY9 + 20, LINE, 1.6)]
_b09 += battery(75, JY9 - 20, 26, 14)
_b09 += battery(75, JY9 + 20, 26, 14)
_b09 += [dot(40, JY9 - 20), t(28, JY9 - 20, "A", HI, 12, "end"), dot(40, JY9 + 20), t(28, JY9 + 20, "B", HI, 12, "end")]
CY9 = 130
_b09 += [dot(BUSX, CY9), ln(BUSX, CY9, 60, CY9, LINE, 1.6), dot(60, CY9), t(46, CY9, "C", HI, 12, "end")]
for lab, y in (("D", 70), ("E", 140), ("F", 210)):
    _b09 += [dot(BUSX, y)]
    _b09 += battery(BUSX + 55, y, 30, 16)
    _b09 += [ln(BUSX + 15, y, BUSX + 40, y, LINE, 1.6), ln(BUSX + 70, y, BUSX + 95, y, LINE, 1.6),
              dot(BUSX + 95, y), t(BUSX + 108, y + 4, lab, HI, 13, "start")]
FIGS["HG-2809"] = svg("0 0 420 280", '<g transform="translate(40,0)">' + "".join(_b09) + "</g>" + t(
    210, 270, "中央のバス線。A・Bは電池2個が並列で合流。CはBusに直結。D・E・Fは電池つきの枝", GRAY, 11))

# ══ 第573回 大問4(1)（HG-2810）金ぞく板①正方形②U字③E字＋(2)試験管P・Q ═══════
_b10 = []
_b10 += [rect(20, 20, 90, 90, LINE, 1.8),
         t(28, 34, "A", TX, 12), t(102, 34, "B", TX, 12), t(28, 104, "×", HI, 13), t(102, 104, "C", TX, 12),
         t(65, 130, "①", GRAY, 12)]
_uverts = [(150, 20), (240, 20), (240, 110), (210, 110), (210, 50), (180, 50), (180, 110), (150, 110)]
_b10 += [poly(_uverts, LINE, 1.8),
         t(158, 34, "×", HI, 13), t(232, 34, "A", TX, 12), t(158, 104, "B", TX, 12), t(232, 104, "C", TX, 12),
         t(195, 130, "②", GRAY, 12)]
EX0, EY0 = 280, 20  # Eの外わく左上
EW, EH = 100, 90  # 全体の幅・高さ
ARM_H = 20          # 腕（横棒）1本の太さ
SPINE_W = 30         # 背骨（縦棒）の太さ
MID_LEN = 65         # 中の腕（B）は短い。上下の腕（C・×）は右はしまで届く
GAP = (EH - 3 * ARM_H) / 2
_everts = [
    (EX0, EY0), (EX0 + EW, EY0), (EX0 + EW, EY0 + ARM_H), (EX0 + SPINE_W, EY0 + ARM_H),
    (EX0 + SPINE_W, EY0 + ARM_H + GAP), (EX0 + MID_LEN, EY0 + ARM_H + GAP),
    (EX0 + MID_LEN, EY0 + ARM_H + GAP + ARM_H), (EX0 + SPINE_W, EY0 + ARM_H + GAP + ARM_H),
    (EX0 + SPINE_W, EY0 + ARM_H + GAP + ARM_H + GAP), (EX0 + EW, EY0 + ARM_H + GAP + ARM_H + GAP),
    (EX0 + EW, EY0 + EH), (EX0, EY0 + EH),
]
_b10 += [poly(_everts, LINE, 1.8)]
_b10 += [t(EX0 + EW - 14, EY0 + ARM_H / 2 + 4, "C", TX, 12),
         t(EX0 + MID_LEN - 14, EY0 + ARM_H + GAP + ARM_H / 2 + 4, "B", TX, 12),
         t(EX0 + 14, EY0 + EH - 6, "A", TX, 12),
         t(EX0 + EW - 14, EY0 + EH - 6, "×", HI, 13),
         t(EX0 + EW / 2, EY0 + EH + 20, "③", GRAY, 12)]
_b10 += [t(200, 12, "示温シールをはった金ぞく板（×を熱する）", GRAY, 11)]
# (2) 試験管P・Q
for i, (lab, hot) in enumerate([("P（底を熱する）", "底"), ("Q（水面付近を熱する）", "水面付近")]):
    x0 = 40 + i * 220
    _b10 += [ln(x0, 190, x0 + 90, 240, LINE, 1.8), ln(x0 + 6, 184, x0 + 96, 234, LINE, 1.8),
              t(x0 + 45, 175, lab, GRAY, 11)]
    for k, frac in enumerate((0.25, 0.5, 0.75)):
        px = x0 + 90 * frac + 3
        py = 190 + 50 * frac + 3
        _b10.append(t(px, py, "アイウ"[k], TX, 10))
FIGS["HG-2810"] = svg("0 0 420 260", "".join(_b10 + [
    t(210, 252, "示温シール①②③の板（上）と、底／水面付近を熱する試験管P・Q（下）", GRAY, 11),
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
