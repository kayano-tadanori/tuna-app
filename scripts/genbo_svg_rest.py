# -*- coding: utf-8 -*-
"""第1講座 No.28/29・第2講座 No.21/25/26/28 に散らばって残っていた13枚の図を、
PDFの実物を見て原簿に入れる。

★根拠：
  小5最レ算数 第3分冊 第1講座.pdf … PDFページ47・53
  小5最レ算数 第3分冊 第2講座.pdf … PDFページ6・27・28・30・32・36・43・45・47・48
  を 200dpi＋部分400〜600dpi で出して目視。原簿に図は入っていないのでここが唯一の根拠
  （feedback_zu_wa_genbo_ni_nai）。説明文から想像で描かない。

実物で確かめたこと（★は指示のページ番号とズレていた所）：
  HG-3746 No.28大問13 … ★PDF p47（p46ではない）。左に「A」の蛇口・右に「B」の蛇口が
            向かい合い、下に上ぶたのない直方体の水そう。水そうははかりの皿にのり、
            はかりは台形の本体に丸い文字ばん（針つき）
  HG-3762 No.29大問13 … ★PDF p53（p52ではない）。同じ大きさの上ぶたのない容器が3つ横に
            ならび、上に A B C。Aだけ口いっぱいまで線が引かれ、中に「1kg」「(食塩水)」
  HG-3797 No.21大問16 … 池はハート型に近い1本の閉じた線。**A は右上・B は右下**。
            Aの右に**下向きに曲がる矢印**（右まわり）、Bの右に**まっすぐ上向きの矢印**。
            まん中に「池」。＝2人は右側の弧を向かい合って進む
  HG-3853 No.25大問8  … A—C—B の線分図。3点は黒丸、記号は線の上。数字は図に無い
            （本文の 60km・20km を寸法線にした）。Cは中央よりやや左
  HG-3856 No.25大問11 … A—B—C の線分図。3点は黒丸、記号は線の上。数字は図に無い
  HG-3861 No.25大問16 … A—B—C の線分図。両端と中は**短いたて棒**、記号は線の下。
            線の上に A側「かける」・B側「道子」「すすむ」（道子が上）
  HG-3865 No.26大問4  … 挿絵。山が2つ、そのふもとに「お茶滝」、川ぞいに「こんにゃく岩」、
            川は「えのき川」、手前に船「いろは丸」、右に「しいたけ町」（人がいる桟橋）。
            → 上流（左）から下流（右）へ流れる川の略図に直した
  HG-3873 No.26大問12 … 横1本の道の上に 家（切妻の絵）—バス停（丸い標識のポール）—
            （ずっとあいて）バス停—学校（時計つきの校舎）。記号は道の下
  HG-3890 No.28大問1  … 進行グラフ。よこ＝時刻 1:00〜3:30、**たて線は10分ごと**（16本）、
            ラベルは 1:00/1:30/2:00/2:30/3:00/3:30 と（時刻）。
            たて＝（家からの道のり）、**よこ線は1kmごと**、ラベルは 0km/3km/6km。
            グリッドは6kmの1段上（7km相当）まである。
            A君の線は **(1:00, 0km) →(まっすぐ)→ (2:30, 6km)** の1本だけ
  HG-3891 No.28大問2  … 往復グラフ。わくの下辺＝P駅、上辺＝Q駅。たて点線は**8分ごと**（8本）。
            よこのラベルは **11時・16・32・48**（16分ごと＝点線1本おき）。
            電車の線は P発11:00 →Q着11:16 →Q発11:24 →P着11:40 →P発11:48 →Q着12:04。
            わくの右端は11:00から9こま＝12:12
  HG-3895 No.28大問6  … ★PDF p45（本文p46。原簿の「本文p45」はズレ）。円の**上に黒丸のP**、
            Pの字は丸の**下**。上に「B」＋**左向き**の矢印、その上に「A」＋**右向き**の矢印
  HG-3899 No.28大問10 … ★PDF p47（本文p48。原簿の「本文p46」はズレ）。同じ形だが
            **A・Bとも右向きの矢印**
  HG-3901 No.28大問12 … ★PDF p48（本文p49。原簿の「本文p47」はズレ）。波の上に
            **左のA船（右向き・前に→）と 右のB船（左向き・前に←）**が向かい合う絵

寸法の描き方（本人指示 2026-08-10/11）：
  数字を図の中に浮かせない。必ず「どの線分か」が分かる寸法線＋爪＋ラベルにする。
  線が区間に分かれているときは、区間ごとに寸法線を引く（まとめない）。
  グラフは軸に単位・目もり・ページどおりの数字を必ず入れる。

使い方: python scripts/genbo_svg_rest.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'
SHADE = 'rgba(255,209,102,0.22)'


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


def pts(seq):
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), fill, stroke, w, d)


def pline(seq, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polyline points="%s" fill="none" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), stroke, w, d)


def rect(x, y, w, h, stroke=LINE, sw=2, fill="none"):
    return '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(x), r1(y), r1(w), r1(h), fill, stroke, sw)


def circ(cx, cy, r, stroke=LINE, w=2, fill="none"):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(cx), r1(cy), r1(r), fill, stroke, w)


def dot(cx, cy, r=4, fill=TX):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r1(cx), r1(cy), r1(r), fill)


def path(d, stroke=LINE, w=2, fill="none", extra=""):
    return '<path d="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (d, fill, stroke, w, extra)


def defs_arrow(mid, color=HI):
    return ('<defs><marker id="%s" markerWidth="8" markerHeight="8" refX="6.5" refY="4"'
            ' orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % (mid, color))


def dim(x1, y1, x2, y2, label, off=12, side=1, size=12, col=TX):
    """★寸法線。「どの辺のどこが何か」が分かるように、測っている線分に沿って細線を引き、
       両端に爪を付け、中央にラベルを置く（本人指示）。
       off＝図から離す量、side＝どちら側に出すか（+1/-1）。
       1本の線が区間に分かれているときは、区間ごとにこれを呼ぶ（まとめない）。"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side       # 法線方向
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = -nx / off * 4, -ny / off * 4                    # 爪
    return "".join([
        ln(ax, ay, bx, by, GRAY, 1.2),
        ln(ax - tx, ay - ty, ax + tx, ay + ty, GRAY, 1.2),
        ln(bx - tx, by - ty, bx + tx, by + ty, GRAY, 1.2),
        t((ax + bx) / 2 + nx / off * 11, (ay + by) / 2 + ny / off * 11 + 4, label, col, size),
    ])


def wave(x0, x1, y, amp=5, period=42, stroke=LINE, w=2):
    """波（川・海）。上下にふくらむ半円をつないだ1本の線"""
    d = ["M%s %s" % (r1(x0), r1(y))]
    x, up = x0, True
    while x < x1 - 0.5:
        nx = min(x + period, x1)
        cy = y - amp if up else y + amp
        d.append("Q%s %s %s %s" % (r1((x + nx) / 2), r1(cy), r1(nx), r1(y)))
        x, up = nx, not up
    return path(" ".join(d), stroke, w)


FIGS = {}

# ══ 第1講座 No.28 大問13（HG-3746）はかりの上の水そう・A管とB管 ══════════════
# 実物：左に「A」右に「B」の蛇口が向かい合い、下に上ぶたのない水そう。
#       水そうははかりの皿にのり、はかりは台形の本体＋丸い文字ばん（針つき）
_ta = []
for x0, x1, nz, lab, la, anc in ((86, 150, 144, "A", 78, "end"), (314, 250, 256, "B", 322, "start")):
    _ta += [
        ln(x0, 42, x1, 42, LINE, 3),                       # よこの管
        rect(nz - 5, 42, 10, 16, LINE, 2),                 # 下向きの口
        rect((x0 + x1) / 2 - 8, 31, 16, 11, LINE, 2),      # ハンドル（弁）
        t(la, 47, lab, TX, 15, anc),
        ln(nz, 60, nz, 78, GRAY, 1.6, "4 5"),              # 落ちる水すじ
    ]
FIGS["HG-3746"] = svg("0 0 400 254", "".join(_ta + [
    pline([(130, 80), (130, 158), (270, 158), (270, 80)], LINE, 2.5),   # 水そう（上ぶた無し）
    t(200, 128, "水そう", TX, 13),
    rect(112, 164, 176, 10, GRAY, 2),                                    # はかりの皿
    ln(150, 174, 150, 184, GRAY, 2), ln(250, 174, 250, 184, GRAY, 2),
    poly([(94, 228), (306, 228), (274, 184), (126, 184)], GRAY, 2),      # はかり本体
    circ(200, 208, 17, TX, 1.8),
    ln(200, 208, 210, 198, TX, 1.8),                                     # 針
    t(316, 214, "はかり", GRAY, 12, "start"),
    t(200, 248, "A管＝水／B管＝20%の食塩水（水そう自体の重さは1kg）", GRAY, 11),
]))

# ══ 第1講座 No.29 大問13（HG-3762）3つの容器A・B・C ═══════════════════════
_yo = []
for i, (lab, cx) in enumerate((("A", 85), ("B", 200), ("C", 315))):
    x = cx - 45
    _yo += [t(cx, 52, lab, TX, 15)]
    if lab == "A":
        _yo += ['<rect x="%s" y="72" width="90" height="86" fill="%s"/>' % (r1(x), SHADE)]
    _yo += [pline([(x, 68), (x, 158), (x + 90, 158), (x + 90, 68)], LINE, 2.5)]
    if lab == "A":
        _yo += [ln(x, 72, x + 90, 72, HI, 2),
                t(cx, 106, "1kg", TX, 14), t(cx, 128, "(食塩水)", TX, 13)]
FIGS["HG-3762"] = svg("0 0 400 200", "".join(_yo + [
    t(200, 182, "BとCは からっぽ。A→B→C と 0.9kg・0.8kg ずつ移していく", GRAY, 11),
]))

# ══ 第2講座 No.21 大問16（HG-3797）池を一周・甲と乙 ═══════════════════════
# 実物：ハート型に近い池。A＝右上、B＝右下。Aの矢印は右まわり（下向きに曲がる）、
#       Bの矢印はまっすぐ上向き＝2人は右側の弧を向かい合って進む
_pond = ("M222,34 C198,20 166,26 150,46 C136,63 132,80 127,93"
         " C114,78 92,70 74,80 C48,94 42,122 60,142"
         " C84,166 152,174 200,165 C220,161 236,159 242,153"
         " C252,112 250,62 222,34 Z")
FIGS["HG-3797"] = svg("0 0 330 200", "".join([
    defs_arrow("ar3797", HI),
    path(_pond, LINE, 2.5),
    t(160, 118, "池", TX, 15),
    dot(222, 34, 4.5, HI), dot(242, 153, 4.5, HI),
    t(212, 24, "A", TX, 14, "end"), t(256, 165, "B", TX, 14, "start"),
    # A：右まわり（Aから右下へ）
    path("M234,28 Q262,32 268,52", HI, 2, "none", ' marker-end="url(#ar3797)"'),
    # B：左まわり（Bから上へ）
    ln(262, 148, 262, 116, HI, 2, None, ' marker-end="url(#ar3797)"'),
    t(165, 192, "甲はA地、乙はB地から、矢印の向きに同時に出発して一周する", GRAY, 11),
]))

# ══ 第2講座 No.25 大問8（HG-3853）A—C—B の線分図 ══════════════════════════
# 実物は点と記号だけ。長さは本文の 60km・20km なので、区間ごとに寸法線を引く
_A, _C, _B, _y = 55, 165, 385, 76
FIGS["HG-3853"] = svg("0 0 440 180", "".join([
    ln(_A, _y, _B, _y, LINE, 3),
    dot(_A, _y, 5), dot(_C, _y, 5), dot(_B, _y, 5),
    t(_A, 60, "A", TX, 14), t(_C, 60, "C", TX, 14), t(_B, 60, "B", TX, 14),
    dim(_A, _y, _C, _y, "20km", 22, 1),          # AC間
    dim(_C, _y, _B, _y, "40km", 22, 1),          # CB間（60−20）
    dim(_A, _y, _B, _y, "60km", 62, 1),          # AB間ぜんたい
    t(220, 172, "AC間はある速さ、CB間はその2倍の速さ。AB間で1時間", GRAY, 11),
]))

# ══ 第2講座 No.25 大問11（HG-3856）A—B—C の線分図 ═════════════════════════
_A, _B, _C, _y = 55, 190, 385, 76
FIGS["HG-3856"] = svg("0 0 440 176", "".join([
    ln(_A, _y, _C, _y, LINE, 3),
    dot(_A, _y, 5), dot(_B, _y, 5), dot(_C, _y, 5),
    t(_A, 60, "A", TX, 14), t(_B, 60, "B", TX, 14), t(_C, 60, "C", TX, 14),
    dim(_A, _y, _B, _y, "AB間", 22, 1),
    dim(_B, _y, _C, _y, "BC間", 22, 1),
    t(_A + 6, 40, "トラック", GRAY, 11, "start"),
    t(_B, 40, "自転車・バイク", GRAY, 11),
    t(220, 150, "3つとも同時に出発してC地点へ向かう（長さは図に書かれていない）", GRAY, 11),
]))

# ══ 第2講座 No.25 大問16（HG-3861）A—B—C・かける／すすむ／道子 ══════════════
# 実物：両端と中は短いたて棒。記号A・B・Cは線の下。線の上に かける（A側）・道子/すすむ（B側）
_A, _B, _C, _y = 75, 195, 385, 96
FIGS["HG-3861"] = svg("0 0 440 190", "".join([
    ln(_A, _y, _C, _y, LINE, 3),
    ln(_A, _y - 9, _A, _y + 9, LINE, 2.5),
    ln(_B, _y - 9, _B, _y + 9, LINE, 2.5),
    ln(_C, _y - 9, _C, _y + 9, LINE, 2.5),
    t(_A, 118, "A", TX, 14), t(_B, 118, "B", TX, 14), t(_C, 118, "C", TX, 14),
    t(_A, 76, "かける", TX, 12),
    t(_B, 56, "道子", TX, 12), t(_B, 76, "すすむ", TX, 12),
    dim(_A, 126, _B, 126, "AB間", 14, 1),
    dim(_B, 126, _C, 126, "BC間", 14, 1),
    t(220, 182, "3人とも同時に出発してC地点へ向かう", GRAY, 11),
]))

# ══ 第2講座 No.26 大問4（HG-3865）えのき川といろは丸 ═══════════════════════
# 実物の挿絵（山2つ・お茶滝・こんにゃく岩・えのき川・いろは丸・しいたけ町）を、
# 左＝上流／右＝下流 の川の略図に直したもの
_TAKI, _IWA, _MACHI = 72, 218, 408
FIGS["HG-3865"] = svg("0 0 470 210", "".join([
    defs_arrow("ar3865", HI),
    # 山とお茶滝（岸より上に立たせる）
    poly([(18, 66), (58, 16), (98, 66)], LINE, 2),
    poly([(84, 66), (114, 34), (144, 66)], LINE, 2),
    ln(64, 40, 64, 66, GRAY, 1.6), ln(70, 38, 70, 66, GRAY, 1.6), ln(76, 41, 76, 66, GRAY, 1.6),
    # こんにゃく岩
    poly([(198, 66), (206, 48), (222, 42), (236, 52), (238, 66)], LINE, 2),
    # しいたけ町（家2つ）
    poly([(380, 48), (394, 36), (408, 48)], LINE, 2), rect(384, 48, 20, 18, LINE, 2),
    poly([(406, 42), (422, 28), (438, 42)], LINE, 2), rect(410, 42, 24, 24, LINE, 2),
    # 川（上の岸と下の岸）
    wave(14, 456, 72, 4, 44, LINE, 2),
    wave(14, 456, 116, 4, 44, LINE, 2),
    t(18, 30, "上流", GRAY, 11, "start"), t(454, 24, "下流", GRAY, 11, "end"),
    t(18, 110, "えのき川", GRAY, 11, "start"),
    # 流れの向き
    ln(140, 88, 184, 88, HI, 2.2, None, ' marker-end="url(#ar3865)"'),
    t(162, 104, "流れ 毎時5km", HI, 10),
    # いろは丸
    poly([(286, 90), (330, 90), (322, 102), (293, 102)], LINE, 2),
    rect(298, 79, 18, 11, LINE, 1.6), ln(316, 72, 316, 79, LINE, 1.6),
    t(308, 62, "いろは丸", TX, 11),
    # 地点の目もりと名まえ
    ln(_TAKI, 116, _TAKI, 130, GRAY, 1.4), ln(_IWA, 116, _IWA, 130, GRAY, 1.4),
    ln(_MACHI, 116, _MACHI, 130, GRAY, 1.4),
    t(_TAKI, 144, "お茶滝", TX, 12), t(_IWA, 144, "こんにゃく岩", TX, 12),
    t(_MACHI, 144, "しいたけ町", TX, 12),
    dim(_IWA, 154, _MACHI, 154, "24km", 14, 1),
    dim(_TAKI, 154, _IWA, 154, "？km", 14, 1, 12, HI),
    t(235, 204, "いろは丸＝毎時25km、ほへと丸＝毎時35km（流れのない所で）", GRAY, 11),
]))

# ══ 第2講座 No.26 大問12（HG-3873）家—バス停—バス停—学校 ═══════════════════
_IE, _B1, _B2, _GK, _RD = 88, 158, 332, 400, 122
_bs = []
for x in (_B1, _B2):
    _bs += [ln(x, _RD, x, 88, LINE, 2.5), circ(x, 79, 9, LINE, 2.5)]
FIGS["HG-3873"] = svg("0 0 470 208", "".join([
    ln(24, _RD, 448, _RD, LINE, 3),                                   # 道
    # 家（切妻）
    pline([(56, _RD), (88, 78), (120, _RD)], LINE, 2.5),
    ln(72, 100, 72, _RD, LINE, 2), ln(104, 100, 104, _RD, LINE, 2),
] + _bs + [
    # 学校（時計つきの校舎）
    rect(366, 96, 76, 26, LINE, 2.5),
    rect(388, 70, 30, 26, LINE, 2.5),
    circ(403, 83, 8, TX, 1.6), ln(403, 83, 403, 78, TX, 1.4), ln(403, 83, 407, 85, TX, 1.4),
    t(_IE, 142, "家", TX, 13), t(_B1, 142, "バス停", TX, 13),
    t(_B2, 142, "バス停", TX, 13), t(_GK, 142, "学校", TX, 13),
    dim(_IE, 152, _B1, 152, "150m", 12, 1),
    t(240, 198, "一郎君は分速60mで家→学校。バスは分速600m", GRAY, 11),
]))

# ══ 第2講座 No.28 大問1（HG-3890）A君の進行グラフ ═════════════════════════
# 実物の軸：よこ＝1:00〜3:30（たて線は10分ごと・16本）／たて＝0km〜（6kmの1段上まで）
#           よこのラベル 1:00 1:30 2:00 2:30 3:00 3:30 と（時刻）
#           たてのラベル 0km 3km 6km（よこ線は1kmごと）
GX0, GX1, GY0km, GKM = 92, 432, 216, 25.0        # 0kmの高さ・1kmあたり25px
GMIN = (GX1 - GX0) / 150.0                        # 1分あたりのpx
gx = lambda m: GX0 + m * GMIN                     # m＝1:00からの分
gy = lambda km: GY0km - km * GKM
_g = [ln(gx(i * 10), gy(7), gx(i * 10), GY0km, GRAY, 1) for i in range(16)]
_g += [ln(GX0, gy(k), GX1, gy(k), GRAY, 1) for k in range(7)]
_g += [ln(GX0, gy(7), GX0, GY0km, GRAY, 1.8), ln(GX0, GY0km, GX1, GY0km, GRAY, 1.8)]
for i, lab in enumerate(("1:00", "1:30", "2:00", "2:30", "3:00", "3:30")):
    _g += [ln(gx(i * 30), GY0km, gx(i * 30), GY0km + 5, GRAY, 1.6),
           t(gx(i * 30), GY0km + 20, lab, TX, 11)]
for km in (0, 3, 6):
    _g += [ln(GX0 - 5, gy(km), GX0, gy(km), GRAY, 1.6),
           t(GX0 - 9, gy(km) + 4, "%dkm" % km, TX, 11, "end")]
FIGS["HG-3890"] = svg("0 0 470 262", "".join(_g + [
    t(30, 32, "（家からの道のり）", GRAY, 11, "start"),
    t(452, 254, "（時刻）", GRAY, 11, "end"),
    ln(gx(0), gy(0), gx(90), gy(6), LINE, 2.8),      # A君：1:00に0km → 2:30に6km
    t(gx(90) + 6, gy(6) - 6, "A君", LINE, 12, "start"),
    t(196, 254, "兄は1時10分に出発・時速12km（グラフはA君のぶんだけ）", GRAY, 11),
]))

# ══ 第2講座 No.28 大問2（HG-3891）P駅とQ駅を往復する電車のグラフ ═════════════
# 実物の軸：たて＝下辺P駅・上辺Q駅／よこ＝11時から8分ごとの点線（8本）、
#           ラベルは 11時・16・32・48（点線1本おき）。わくの右端は 11:00＋72分
HX0, HX1, HYP, HYQ = 92, 432, 212, 62
HMIN = (HX1 - HX0) / 72.0
hx = lambda m: HX0 + m * HMIN
_h = [ln(hx(i * 8), HYQ, hx(i * 8), HYP, GRAY, 1.4, "5 5") for i in range(1, 9)]
_h += [ln(HX0, HYQ, HX1, HYQ, GRAY, 1.8), ln(HX0, HYP, HX1, HYP, GRAY, 1.8),
       ln(HX0, HYQ, HX0, HYP, GRAY, 1.8), ln(HX1, HYQ, HX1, HYP, GRAY, 1.8)]
for m, lab in ((0, "11時"), (16, "16"), (32, "32"), (48, "48")):
    _h += [ln(hx(m), HYP, hx(m), HYP + 5, GRAY, 1.6), t(hx(m), HYP + 20, lab, TX, 12)]
FIGS["HG-3891"] = svg("0 0 470 262", "".join(_h + [
    t(HX0 - 9, HYQ + 5, "Q駅", TX, 13, "end"), t(HX0 - 9, HYP + 5, "P駅", TX, 13, "end"),
    pline([(hx(0), HYP), (hx(16), HYQ), (hx(24), HYQ), (hx(40), HYP),
           (hx(48), HYP), (hx(64), HYQ)], LINE, 2.8),
    t(hx(64) + 6, HYQ - 6, "電車", LINE, 12, "start"),
    t(452, 254, "（時刻）", GRAY, 11, "end"),
    t(190, 254, "A君は11時にP駅を出て11時48分にQ駅に着く", GRAY, 11),
]))

# ══ 第2講座 No.28 大問6（HG-3895）一周600m・A右まわり／B左まわり ═════════════
CX, CY, CR = 200, 152, 86
FIGS["HG-3895"] = svg("0 0 430 272", "".join([
    defs_arrow("ar3895", HI),
    circ(CX, CY, CR, LINE, 2.5),
    dot(CX, CY - CR, 5, HI),
    t(CX, CY - CR + 22, "P", TX, 14),
    t(CX - 6, CY - CR - 12, "B", TX, 14, "end"),
    path("M%d,%d Q%d,%d %d,%d" % (CX - 22, CY - CR - 17, CX - 46, CY - CR - 22,
                                  CX - 72, CY - CR - 16),
         HI, 2, "none", ' marker-end="url(#ar3895)"'),
    t(CX - 6, CY - CR - 44, "A", TX, 14, "end"),
    path("M%d,%d Q%d,%d %d,%d" % (CX + 6, CY - CR - 50, CX + 40, CY - CR - 48,
                                  CX + 66, CY - CR - 32),
         HI, 2, "none", ' marker-end="url(#ar3895)"'),
    t(215, 258, "一周600m　A君＝分速120mで右まわり／B君＝分速40mで左まわり", GRAY, 11),
]))

# ══ 第2講座 No.28 大問10（HG-3899）一周300m・A、Bとも右まわり ════════════════
FIGS["HG-3899"] = svg("0 0 430 286", "".join([
    defs_arrow("ar3899", HI),
    circ(CX, CY, CR, LINE, 2.5),
    dot(CX, CY - CR, 5, HI),
    t(CX, CY - CR + 22, "P", TX, 14),
    t(CX - 6, CY - CR - 12, "B", TX, 14, "end"),
    path("M%d,%d Q%d,%d %d,%d" % (CX + 6, CY - CR - 17, CX + 34, CY - CR - 20,
                                  CX + 60, CY - CR - 10),
         HI, 2, "none", ' marker-end="url(#ar3899)"'),
    t(CX - 6, CY - CR - 44, "A", TX, 14, "end"),
    path("M%d,%d Q%d,%d %d,%d" % (CX + 6, CY - CR - 50, CX + 40, CY - CR - 48,
                                  CX + 66, CY - CR - 32),
         HI, 2, "none", ' marker-end="url(#ar3899)"'),
    t(215, 258, "一周300m　A君＝分速30mで右まわりに歩き続ける", GRAY, 11),
    t(215, 274, "B君＝分速20m。P地点に着いたときやA君と出会ったときは反対向きになる",
      GRAY, 11),
]))

# ══ 第2講座 No.28 大問12（HG-3901）向かい合う2せきの船A・B ═════════════════
def _ship(x0, x1, right):
    """x0〜x1 が船の上べり。right＝True なら へさきが右"""
    ov0, ov1 = (16, 20) if right else (20, 16)
    hull = poly([(x0, 128), (x1, 128), (x1 - ov1, 147), (x0 + ov0, 147)], LINE, 2.5)
    cx = (x0 + x1) / 2
    cab = rect(cx - 26, 112, 52, 16, LINE, 2)
    fx = cx + 20 if right else cx - 20
    fun = rect(fx - 5, 92, 11, 20, LINE, 2)
    sm = ("M%s,94 C%s,86 %s,92 %s,88" % (r1(fx), r1(fx - 15), r1(fx - 26), r1(fx - 38))
          if right else
          "M%s,94 C%s,86 %s,92 %s,88" % (r1(fx), r1(fx + 15), r1(fx + 26), r1(fx + 38)))
    return hull + cab + fun + path(sm, GRAY, 1.6)

FIGS["HG-3901"] = svg("0 0 450 200", "".join([
    defs_arrow("ar3901", HI),
    _ship(70, 178, True), _ship(272, 380, False),
    wave(16, 434, 147, 5, 44, LINE, 2),
    t(124, 80, "A", TX, 16), t(326, 80, "B", TX, 16),
    ln(188, 134, 216, 134, HI, 2.4, None, ' marker-end="url(#ar3901)"'),
    ln(262, 134, 234, 134, HI, 2.4, None, ' marker-end="url(#ar3901)"'),
    t(225, 174, "Aは時速36km、Bは時速27kmで向かい合って進む", GRAY, 11),
    t(225, 190, "音は1秒間に340m進む。Aが鳴らして17秒後にBの汽てきがAに聞こえた", GRAY, 11),
]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    # 自己点検：横長のviewBoxか／すべての<text>にfillがあるか
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
        for c in ("#333", "#888", "#666", "#000", "#111", "#222"):
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
