# -*- coding: utf-8 -*-
"""第1講座 No.30「立体図形の性質」の図を、PDFの実物を見て原簿に入れる。

★根拠：小5最レ算数 第3分冊 第1講座.pdf の PDF p55〜60（本文p56〜61）を200dpiで出して目視。

⚠ 大問4・5・6（HG-3769/3770/3771）は**答えが作図そのもの**なのでアプリに入れない
  （本人判断 2026-08-11・check_genbo.py の CANNOT に登録ずみ）。ここでも図は作らない。

使い方: python scripts/genbo_svg_no30.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'


def svg(vb, body):
    return '<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (vb, S, body)


def t(x, y, s, fill=TX, size=12, anchor="middle"):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s">%s</text>' % (
        x, y, size, anchor, fill, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=1.6, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        x1, y1, x2, y2, stroke, w, d)


def rect(x, y, w, h, stroke=LINE, sw=1.4, fill="none"):
    return '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        x, y, w, h, fill, stroke, sw)


def dot(x, y, c=TX, r=3):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (x, y, r, c)


def dim(x1, y1, x2, y2, label, off=11, side=1, size=11):
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = nx / off * 3.5, ny / off * 3.5
    return "".join([
        ln(round(ax, 1), round(ay, 1), round(bx, 1), round(by, 1), GRAY, 1.1),
        ln(round(ax - tx, 1), round(ay - ty, 1), round(ax + tx, 1), round(ay + ty, 1), GRAY, 1.1),
        ln(round(bx - tx, 1), round(by - ty, 1), round(bx + tx, 1), round(by + ty, 1), GRAY, 1.1),
        t(round((ax + bx) / 2 + nx * 0.8, 1), round((ay + by) / 2 + ny * 0.8 + 4, 1), label, TX, size),
    ])


def grid(cells, ox, oy, s=22):
    """(col,row)のマスを並べた図。rowは0が上"""
    return "".join(rect(ox + c * s, oy + r * s, s, s) for c, r in cells)


FIGS = {}

# 大問1（HG-3766）正面図・真上図
FIGS["HG-3766"] = svg("0 0 400 175", "".join([
    t(90, 40, "（正面からみた図）", TX, 12),
    grid([(1, 0), (0, 1), (1, 1), (0, 2), (1, 2), (2, 2)], 200, 25),
    t(90, 125, "（真上からみた図）", TX, 12),
    grid([(1, 0), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)], 200, 105),
]))

# 大問2（HG-3767）段数が多い版
FIGS["HG-3767"] = svg("0 0 420 195", "".join([
    t(85, 45, "（正面からみた図）", TX, 12),
    grid([(1, 0), (0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2), (3, 2)], 195, 20, 20),
    t(85, 135, "（真上からみた図）", TX, 12),
    grid([(0, 0), (1, 0), (2, 0), (1, 1), (2, 1), (3, 1), (1, 2)], 195, 110, 20),
]))

# 大問3（HG-3768）透明な27個の小箱・○印
FIGS["HG-3768"] = svg("0 0 300 210", "".join([
    # 手前の面（3×3）
    grid([(c, r) for c in range(3) for r in range(3)], 45, 75, 40),
    # 上面（奥行きを斜めに）
    "".join(ln(45 + c * 40, 75, 45 + c * 40 + 45, 30, LINE, 1.2) for c in range(4)),
    "".join(ln(45 + 45 * (i / 3), 75 - 45 * (i / 3), 165 + 45 * (i / 3), 75 - 45 * (i / 3), LINE, 1.2)
            for i in range(4)),
    # 右面
    "".join(ln(165, 75 + r * 40, 210, 30 + r * 40, LINE, 1.2) for r in range(4)),
    ln(210, 30, 210, 150, LINE, 1.2),
    # ○印（真上・正面・真横から見えた位置）
    dot(75, 55, HI, 6), dot(120, 45, HI, 6), dot(160, 40, HI, 6),
    dot(65, 95, HI, 6), dot(105, 95, HI, 6), dot(145, 135, HI, 6),
    dot(185, 60, HI, 6), dot(190, 105, HI, 6),
    t(150, 200, "透明な小箱27個（3段）・玉が見える所に○印", GRAY, 10),
]))

# 大問7（HG-3772）円すいの展開図が2つ
FIGS["HG-3772"] = svg("0 0 440 210", "".join([
    t(30, 25, "(1)", TX, 12),
    # 半径15cm・中心角x°のおうぎ形（頂点を上にして下に開く）＋底面の円（半径5cm）
    '<path d="M120 48 L55 86 A75 75 0 0 0 185 86 Z" fill="none" stroke="%s" stroke-width="1.8"/>' % LINE,
    dim(120, 48, 55, 86, "15cm", 13, 1),
    t(120, 74, "x°", HI, 13),
    '<circle cx="120" cy="160" r="30" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE,
    ln(120, 160, 150, 160, LINE, 1.4),
    dim(120, 160, 150, 160, "5cm", 10, -1),
    t(275, 25, "(2)", TX, 12),
    '<path d="M330 45 L265 130 A105 105 0 0 0 395 130 Z" fill="none" stroke="%s" stroke-width="1.8"/>' % LINE,
    t(330, 62, "60°", TX, 11),
    dim(330, 45, 395, 130, "12cm", 13, -1),
    '<circle cx="330" cy="172" r="26" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE,
    t(330, 176, "x cm", HI, 11),
]))

# 大問8（HG-3773）円すいにひもを1周巻く（2つ）
def cone(ox, tag, gen_label, base_label, extra="", end=None, back_to=None):
    """円すい＋側面を1周するひも。
       ★ひもはA（底面の左はし）から出て**1周してAにもどる**。
         手前の半周は実線、裏側の半周は破線。最高点はAの真うしろ＝右のりんかく線の上。
         （2026-08-11に本人指摘で修正。前は右上で途切れていて1周に見えなかった）"""
    O = (ox + 55, 40)
    A = (ox + 15, 150)
    R = (ox + 77, 100)          # 右のりんかく線上＝ひもの最高点
    if end is None:
        end = R
    if back_to is None:
        back_to = A
    return "".join([
        t(ox + 55, 25, tag, TX, 12),
        ln(O[0], O[1], A[0], A[1], LINE, 1.8), ln(O[0], O[1], ox + 95, 150, LINE, 1.8),
        # 底面（手前は実線・奥は破線）
        '<path d="M%d 150 A40 12 0 0 0 %d 150" fill="none" stroke="%s" stroke-width="1.6"/>' % (
            ox + 15, ox + 95, LINE),
        '<path d="M%d 150 A40 12 0 0 1 %d 150" fill="none" stroke="%s" stroke-width="1.2"'
        ' stroke-dasharray="5,4"/>' % (ox + 15, ox + 95, LINE),
        t(ox + 55, 34, "O", TX, 12),
        dot(A[0], A[1]), t(ox + 8, 166, "A", TX, 11, "end"),
        # 手前の半周（実線）：Aから右へ上がって最高点へ
        '<path d="M%d %d Q%d 152 %d %d" fill="none" stroke="%s" stroke-width="2"/>' % (
            A[0], A[1], ox + 52, end[0], end[1], HI),
        # 裏側の半周（破線）：最高点から back_to（(1)はA・(2)はB）へもどる
        '<path d="M%d %d Q%d 88 %d %d" fill="none" stroke="%s" stroke-width="1.5"'
        ' stroke-dasharray="5,4"/>' % (end[0], end[1], ox + 40, back_to[0], back_to[1], HI),
        dim(O[0], O[1], ox + 95, 150, gen_label, 12, -1),
        dim(ox + 55, 164, ox + 95, 164, base_label, 8, 1),
        extra,
    ])


FIGS["HG-3773"] = svg("0 0 340 190", "".join([
    cone(20, "(1)", "24cm", "4cm"),
    # (2)はAから1周してB（OA上・Aから5cm）でおわる
    cone(190, "(2)", "15cm", "5cm",
         dot(190 + 28, 113, TX) + t(190 + 20, 110, "B", TX, 11, "end")
         + dim(190 + 28, 113, 190 + 15, 150, "5cm", 11, 1),
         back_to=(190 + 28, 113)),
]))

# 大問9（HG-3774）円すいをたおしてころがす
FIGS["HG-3774"] = svg("0 0 430 190", "".join([
    t(40, 25, "図1", TX, 12),
    ln(75, 40, 55, 150, LINE, 1.8), ln(75, 40, 95, 150, LINE, 1.8),
    '<ellipse cx="75" cy="150" rx="20" ry="7" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE,
    dim(75, 40, 95, 150, "16cm", 12, -1),
    dim(55, 162, 95, 162, "4cm", 8, 1),
    t(240, 25, "図2", TX, 12),
    '<ellipse cx="320" cy="105" rx="105" ry="58" fill="none" stroke="%s" stroke-width="1.6"/>' % GRAY,
    '<ellipse cx="245" cy="105" rx="12" ry="22" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE,
    ln(245, 86, 355, 105, LINE, 1.6), ln(245, 124, 355, 105, LINE, 1.6),
    t(320, 178, "地面にたおしてころがす", GRAY, 10),
]))

# 大問10（HG-3775）正多面体5つと表
FIGS["HG-3775"] = svg("0 0 460 175", "".join([
    # 5つの立体を並べる（模式）
    "".join([
        t(50 + i * 90, 145, nm, TX, 11) for i, nm in enumerate(
            ["正四面体", "正六面体", "正八面体", "正十二面体", "正二十面体"])
    ]),
    # 正四面体
    '<polygon points="50,45 20,120 80,120" fill="none" stroke="%s" stroke-width="1.5"/>' % LINE,
    ln(50, 45, 45, 105, LINE, 1.1, "3,3"), ln(20, 120, 45, 105, LINE, 1.1, "3,3"),
    ln(80, 120, 45, 105, LINE, 1.1, "3,3"),
    # 正六面体
    rect(112, 60, 50, 50), ln(112, 60, 132, 45), ln(162, 60, 182, 45),
    ln(162, 110, 182, 95), ln(132, 45, 182, 45), ln(182, 45, 182, 95),
    ln(132, 45, 132, 95, LINE, 1.1, "3,3"), ln(132, 95, 182, 95, LINE, 1.1, "3,3"),
    ln(112, 110, 132, 95, LINE, 1.1, "3,3"),
    # 正八面体
    '<polygon points="230,40 200,85 230,125 260,85" fill="none" stroke="%s" stroke-width="1.5"/>' % LINE,
    ln(200, 85, 260, 85, LINE, 1.1, "3,3"), ln(230, 40, 230, 125, LINE, 1.1, "3,3"),
    # 正十二面体（模式）
    '<polygon points="320,40 350,60 340,100 300,100 290,60" fill="none" stroke="%s" stroke-width="1.5"/>' % LINE,
    '<circle cx="320" cy="80" r="38" fill="none" stroke="%s" stroke-width="1.2"/>' % LINE,
    # 正二十面体（模式）
    '<circle cx="410" cy="80" r="40" fill="none" stroke="%s" stroke-width="1.2"/>' % LINE,
    '<polygon points="410,42 443,98 377,98" fill="none" stroke="%s" stroke-width="1.4"/>' % LINE,
    '<polygon points="410,118 377,62 443,62" fill="none" stroke="%s" stroke-width="1.1"/>' % LINE,
    t(230, 165, "面の数・頂点の数・辺の数の表をうめる", GRAY, 10),
]))

# 大問11（HG-3776）立方体のかどを切り取る
# もとの立方体を点線で残し、**各辺の中点を結んでできる立体**（かどを切り落とした形）を実線で描く。
# 8つのかどが三角形に切り落とされているのが見えるようにする。
_c = {  # 立方体の頂点（斜投影）
    "FBL": (80, 160), "FBR": (190, 160), "FTL": (80, 50), "FTR": (190, 50),
    "BBL": (125, 115), "BBR": (235, 115), "BTL": (125, 5), "BTR": (235, 5),
}
_m = {  # 各辺の中点
    "fb": (135, 160), "fr": (190, 105), "ft": (135, 50), "fl": (80, 105),
    "bb": (180, 115), "br": (235, 60), "bt": (180, 5), "bl": (125, 60),
    "cBL": (102, 137), "cBR": (212, 137), "cTL": (102, 27), "cTR": (212, 27),
}
FIGS["HG-3776"] = svg("0 0 320 200", "".join([
    # もとの立方体（点線）
    "".join(ln(*_c[a], *_c[b], GRAY, 1.1, "4,3") for a, b in [
        ("FBL", "FBR"), ("FBR", "FTR"), ("FTR", "FTL"), ("FTL", "FBL"),
        ("BBL", "BBR"), ("BBR", "BTR"), ("BTR", "BTL"), ("BTL", "BBL"),
        ("FBL", "BBL"), ("FBR", "BBR"), ("FTL", "BTL"), ("FTR", "BTR")]),
    # かどを切り落とした立体（外形）
    '<polygon points="135,160 212,137 235,60 180,5 102,27 80,105" fill="none"'
    ' stroke="%s" stroke-width="2"/>' % LINE,
    # 見えている面のふち（手前の正方形・三角形）
    "".join(ln(*_m[a], *_m[b], LINE, 1.6) for a, b in [
        ("fb", "fr"), ("fr", "ft"), ("ft", "fl"), ("fl", "fb"),      # 手前の正方形
        ("ft", "cTL"), ("ft", "cTR"), ("fr", "cTR"), ("fr", "cBR"),
        ("fb", "cBR"), ("fb", "cBL"), ("fl", "cBL"), ("fl", "cTL"),  # 手前まわりの三角形
        ("cTR", "bt"), ("cTR", "br"), ("bt", "br")]),                # 右奥のかど
    t(150, 190, "立方体のかどを同じように切り取った立体（点線はもとの立方体）", GRAY, 9),
]))

# 大問12（HG-3777）サッカーボール
_soc = []
for i in range(5):
    a = math.radians(-90 + i * 72)
    x, y = 150 + 46 * math.cos(a), 95 + 46 * math.sin(a)
    _soc.append('<polygon points="%s" fill="#1a2340" stroke="%s" stroke-width="1.4"/>' % (
        " ".join("%.1f,%.1f" % (x + 15 * math.cos(math.radians(-90 + i * 72 + j * 72)),
                                y + 15 * math.sin(math.radians(-90 + i * 72 + j * 72)))
                 for j in range(5)), LINE))
FIGS["HG-3777"] = svg("0 0 300 185", "".join([
    '<circle cx="150" cy="95" r="72" fill="none" stroke="%s" stroke-width="1.8"/>' % LINE,
    '<polygon points="%s" fill="#1a2340" stroke="%s" stroke-width="1.4"/>' % (
        " ".join("%.1f,%.1f" % (150 + 22 * math.cos(math.radians(-90 + j * 72)),
                                95 + 22 * math.sin(math.radians(-90 + j * 72))) for j in range(5)), LINE),
] + _soc + [
    t(150, 178, "黒い五角形と白い正六角形（白は20個）", GRAY, 10),
]))

# 大問13（HG-3778）4×4×4の立方体と●印
_c = []
for c in range(4):
    for r in range(4):
        _c.append(rect(60 + c * 30, 60 + r * 30, 30, 30))
FIGS["HG-3778"] = svg("0 0 330 210", "".join(_c + [
    # 上面と右面（斜め）
    "".join(ln(60 + c * 30, 60, 60 + c * 30 + 40, 30, LINE, 1.1) for c in range(5)),
    "".join(ln(60 + 40 * (i / 4), 60 - 30 * (i / 4), 180 + 40 * (i / 4), 60 - 30 * (i / 4), LINE, 1.1)
            for i in range(5)),
    "".join(ln(180, 60 + r * 30, 220, 30 + r * 30, LINE, 1.1) for r in range(5)),
    ln(220, 30, 220, 150, LINE, 1.1),
    # ●印（真上・正面・横から4本ずつ）
    dot(75, 165, TX, 4), dot(105, 135, TX, 4), dot(135, 105, TX, 4), dot(165, 75, TX, 4),
    dot(120, 45, TX, 4), dot(160, 40, TX, 4), dot(190, 20, TX, 4),
    dot(200, 60, TX, 4), dot(205, 95, TX, 4), dot(210, 125, TX, 4),
    t(165, 198, "真上・正面・横から4本ずつ●の位置に針をさす", GRAY, 10),
]))

# 大問14（HG-3779）さいころの展開図（図1）と3×3に並べた直方体（図2）
def pip(x, y, n):
    """さいころの目（模式）"""
    P = {1: [(0, 0)], 2: [(-6, -6), (6, 6)], 3: [(-7, -7), (0, 0), (7, 7)],
         4: [(-6, -6), (6, -6), (-6, 6), (6, 6)],
         5: [(-6, -6), (6, -6), (0, 0), (-6, 6), (6, 6)],
         6: [(-6, -7), (6, -7), (-6, 0), (6, 0), (-6, 7), (6, 7)]}
    return "".join(dot(x + dx, y + dy, TX, 2.4) for dx, dy in P[n])


FIGS["HG-3779"] = svg("0 0 430 190", "".join([
    t(35, 25, "図1", TX, 12),
    rect(75, 40, 36, 36), pip(93, 58, 5),
    rect(39, 76, 36, 36), pip(57, 94, 1),
    rect(75, 76, 36, 36), pip(93, 94, 6),
    rect(111, 76, 36, 36), pip(129, 94, 3),
    rect(75, 112, 36, 36), pip(93, 130, 2),
    t(250, 25, "図2", TX, 12),
    "".join(rect(230 + c * 40, 70 + r * 26, 40, 26) for c in range(3) for r in range(3)),
    "".join(ln(230 + c * 40, 70, 230 + c * 40 + 30, 46, LINE, 1.2) for c in range(4)),
    ln(260, 46, 380, 46, LINE, 1.2), ln(380, 46, 380, 122, LINE, 1.2),
    ln(350, 148, 380, 122, LINE, 1.2),
    t(300, 178, "9個のさいころをたて・横3個ずつ並べた直方体", GRAY, 10),
]))

# 大問15（HG-3780）側面を2周させるひも
# ★ひもはAから側面を**2周**してB（OA上・Oから10cm）でおわる。
#   手前の半周は実線、裏側の半周は破線。左右のりんかく線上で実線と破線が入れかわる。
#   （2026-08-11に本人指摘で修正。前はうねった1本の線で、2周に見えなかった）
_A = (120, 155)
_P1 = (231, 137)      # 右のりんかく（0.5周）
_P2 = (137, 120)      # 左のりんかく（1周）
_P3 = (214, 102)      # 右のりんかく（1.5周）
_B = (155, 85)        # 2周でB


def _front(p, q):     # 手前（実線）…下にふくらむ
    return '<path d="M%d %d Q%d %d %d %d" fill="none" stroke="%s" stroke-width="2"/>' % (
        p[0], p[1], (p[0] + q[0]) // 2, max(p[1], q[1]) + 12, q[0], q[1], HI)


def _back(p, q):      # 裏側（破線）…上にふくらむ
    return ('<path d="M%d %d Q%d %d %d %d" fill="none" stroke="%s" stroke-width="1.5"'
            ' stroke-dasharray="5,4"/>') % (
        p[0], p[1], (p[0] + q[0]) // 2, min(p[1], q[1]) - 12, q[0], q[1], HI)


FIGS["HG-3780"] = svg("0 0 300 200", "".join([
    ln(180, 35, 120, 155, LINE, 1.8), ln(180, 35, 240, 155, LINE, 1.8),
    '<path d="M120 155 A60 16 0 0 0 240 155" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE,
    '<path d="M120 155 A60 16 0 0 1 240 155" fill="none" stroke="%s" stroke-width="1.2"'
    ' stroke-dasharray="5,4"/>' % LINE,
    t(180, 28, "O", TX, 12),
    dot(*_A), t(112, 170, "A", TX, 11, "end"),
    dot(*_B), t(147, 82, "B", TX, 11, "end"),
    _front(_A, _P1), _back(_P1, _P2), _front(_P2, _P3), _back(_P3, _B),
    dim(180, 35, 155, 85, "10cm", 12, 1),
    dim(180, 35, 240, 155, "24cm", 13, -1),
    dim(180, 171, 240, 171, "3cm", 8, 1),
]))

# 大問16（HG-3781）直方体を分割して小面・辺・点を数える
# ★AB・CD・EF・GH には印2つ＝**3分割**、AD・BC・FG・EH には印3つ＝**4分割**、
#   AE・BF・CG・DH は2等分＝**2分割**。
#   上面3×4＝12、前後3×2＝6、左右4×2＝8 → 小面 (12+6+8)×2＝52 で答えと合う。
#   （2026-08-11に上面を3×3で描いていた誤りを訂正）
_DX, _DY = 50, -35        # 奥行き方向のベクトル（4分割）
FIGS["HG-3781"] = svg("0 0 360 195", "".join([
    # 上面（幅3分割 × 奥行4分割）
    '<polygon points="70,75 250,75 300,40 120,40" fill="none" stroke="%s" stroke-width="1.6"/>' % LINE,
    "".join(ln(70 + 60 * i, 75, 70 + 60 * i + _DX, 75 + _DY, LINE, 1.1) for i in (1, 2)),
    "".join(ln(round(70 + _DX * i / 4), round(75 + _DY * i / 4),
               round(250 + _DX * i / 4), round(75 + _DY * i / 4), LINE, 1.1) for i in (1, 2, 3)),
    # 前面（幅3分割 × 高さ2分割）
    rect(70, 75, 180, 55),
    ln(130, 75, 130, 130), ln(190, 75, 190, 130), ln(70, 102, 250, 102, LINE, 1.1),
    # 右面（奥行4分割 × 高さ2分割）
    ln(250, 130, 300, 95, LINE, 1.4), ln(300, 40, 300, 95, LINE, 1.4),
    ln(250, 102, 300, 67, LINE, 1.1),
    "".join(ln(round(250 + _DX * i / 4), round(75 + _DY * i / 4),
               round(250 + _DX * i / 4), round(130 + _DY * i / 4), LINE, 1.1) for i in (1, 2, 3)),
    t(64, 70, "A", TX, 11, "end"), t(306, 36, "C", TX, 11, "start"),
    t(122, 34, "H", TX, 11), t(180, 34, "D", TX, 11),
    t(64, 138, "E", TX, 11, "end"), t(306, 100, "G", TX, 11, "start"),
    t(196, 143, "B", TX, 11), t(150, 143, "F", TX, 11),
    t(180, 182, "印をつないでできる小さい長方形を「小面」とよぶ", GRAY, 10),
]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
    p = find_genbo()
    s = io.open(p, encoding="utf-8").read()
    n = 0
    for hg, fig in FIGS.items():
        pat = re.compile(r"(### 【%s】(?:(?!### 【HG-)[\s\S])*?- 図: [^\n]*\n)(- 図SVG: [^\n]*\n)?" % hg)
        m = pat.search(s)
        if not m:
            print("見つからない:", hg)
            continue
        s = s[:m.end(1)] + "- 図SVG: `%s`\n" % fig + s[m.end():]
        n += 1
    print("原簿に図SVGを入れた:", n, "/", len(FIGS))
    print("※ 大問4・5・6（HG-3769/3770/3771）は答えが作図なのでアプリに入れない＝図も作らない")
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("✅ 原簿に書き込み完了")


if __name__ == "__main__":
    main()
