# -*- coding: utf-8 -*-
"""第1講座 No.26「特別な分割」の図（HG-3702〜3717・大問1〜16）を、PDFの実物を見て原簿に入れる。

★根拠：小5最レ算数 第3分冊 第1講座.pdf の PDF p31〜p36（本文p32〜p37）を
  200dpi＋部分400dpiで出して目視。原簿に図は無いのでここが唯一の根拠。

実物で確かめたこと（前回の失敗＝説明文から想像で描く、をしない）：
  大問1  … 長方形ABCD、E(AD上)・G(BC上)の縦線、F(AB上)・H(DC上)の横線、対角線BD。
           3本が1点Iで交わる。求めるのは右下の四角形IGCH
  大問2  … 10cm×8cmの長方形。**内部の1点**から4すみへ線（対角線ではなく折れている）。
           上下2つの三角形が斜線
  大問3  … 15cmの正方形。中の1点(だいたい 横0.49・縦0.38)から各辺の3等分点へ8本。
           四角形は㋐左上・㋑左下・㋒右下・㋓右上、三角形は D上・A左・B下・C右。
           (2)は「㋑㋒㋓の和が121cm²のとき㋒」＝原簿の訂正どおり㋒でよい（実物で確認）
  大問4  … 長方形ABCD（A左上・D右上・B左下・C右下）内部の点P、PA/PB/PC/PD、BDは点線
  大問5  … 大問4と同じ形（長さの数字は図には入っていない）
  大問6  … 正方形ABCD（A左上・D右上・B左下・C右下）、正三角形PBC、AP・DP・BD、右辺に20cm
  大問7  … 正三角形ABC(BC=12cm)と、頂角120°の二等辺三角形DEF(EF=12cm)を横に並べる
  大問8  … 台形ABCD（AD∥BC）、DC上にE、正三角形ABE。∠ADE=120°、∠EBC=30°、Eは直角
  大問9  … 30-30-120の二等辺三角形。**左は頂点Bを頂点Aに重ねる折り**（折り目＝ABの中点と
           底辺の1/3点）、**右は縦の折り目**（ACの中点を通る垂線、Cが垂線の足Mに重なる）。
           残る五角形は A・ABの中点・底辺1/3点・底辺3/4点・ACの中点
  大問10 … (図1)上辺の弦＋上の三角形が斜線、内部に点線のY字と点線の三角形
           (図2)上辺の弦＋左下→右上の対角線、その間の三角形が斜線
           (図3)六芒星（2つの大三角形）、**まん中の小さい正六角形**が斜線
  大問11 … 円に内接する正六角形（A上・B左上・C左下・D下・E右下・F右上＝反時計回り）
           (1)長方形ACDFを太線、3本の対角線は点線　(2)六芒星の**とがった6個**が斜線
  大問12 … 正六角形＋上辺の弦＋頂点から下の頂点への縦線＋頂点T→左下頂点の線。
           ㋐は左上の三角形、㋑はその右下の四角形
  大問13 … (1)3×3の格子＋対角線、さらに右下のマスだけ対角線。アは左上のマス、イは右下の半分
           (2)長方形の上辺にA・B・C・D（3等分）。縦線1本＋横線1本＋B→左下すみ＋C→右下すみ。
           ウは左のたんざく、エは下の広い部分
  大問14 … 平行四辺形をBEで折る。(A)は点線、折った先がA、AからBEに垂線AF。角アはBの所
  大問15 … 正六角形を頂点Aのまわりに**30度**回して重ねる。斜線は 右辺の上端UR・回転後の頂点
           2つ・右辺の下端LR でできる四角形（＝正六角形の1/6）
  大問16 … (図1)中心X,Yが相手の辺QR・EFのまん中（＝横に apothem だけずらす）
           (図2)AとPが重なり、辺DEとRSがお互いのまん中で交わる（約27.8度の回転）

使い方: python scripts/genbo_svg_no26.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'
SHADE = 'rgba(255,209,102,0.22)'


def svg(vb, body):
    return '<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (vb, S, body)


def t(x, y, s, fill=TX, size=13, anchor="middle", extra=""):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s"%s>%s</text>' % (
        r1(x), r1(y), size, anchor, fill, extra, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), stroke, w, d)


def r1(v):
    return round(float(v), 1)


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


def shade(seq):
    """斜線部分＝半透明の塗り＋#ffd166 の輪郭"""
    return poly(seq, HI, 2, SHADE)


def dim(x1, y1, x2, y2, label, off=10, side=1, size=12):
    """2点間の寸法線（両端に短い爪）＋中央にラベル。offは図から離す量"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side       # 法線方向へずらす
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = -nx / off * 4, -ny / off * 4                    # 爪
    return "".join([
        ln(ax, ay, bx, by, GRAY, 1.2),
        ln(ax - tx, ay - ty, ax + tx, ay + ty, GRAY, 1.2),
        ln(bx - tx, by - ty, bx + tx, by + ty, GRAY, 1.2),
        t((ax + bx) / 2 + nx / off * 11, (ay + by) / 2 + ny / off * 11 + 4, label, TX, size),
    ])


def arc(cx, cy, r, a1, a2, stroke=TX, w=1.4):
    """角の印。a1→a2 は度（SVG座標＝時計回りが＋）"""
    x1, y1 = cx + r * math.cos(math.radians(a1)), cy + r * math.sin(math.radians(a1))
    x2, y2 = cx + r * math.cos(math.radians(a2)), cy + r * math.sin(math.radians(a2))
    sweep = 1 if a2 > a1 else 0
    return ('<path d="M%s %s A%s %s 0 0 %d %s %s" fill="none" stroke="%s" stroke-width="%s"/>'
            % (r1(x1), r1(y1), r1(r), r1(r), sweep, r1(x2), r1(y2), stroke, w))


def anglabel(cx, cy, r, a1, a2, s, fill=TX, size=12):
    am = math.radians((a1 + a2) / 2.0)
    return t(cx + r * math.cos(am), cy + r * math.sin(am) + 4, s, fill, size)


def rightangle(v, p, q, u=11, stroke=TX):
    """頂点vで、v→p と v→q のあいだの直角の印"""
    d1 = (p[0] - v[0], p[1] - v[1])
    d2 = (q[0] - v[0], q[1] - v[1])
    l1 = math.hypot(*d1) or 1
    l2 = math.hypot(*d2) or 1
    a = (v[0] + d1[0] / l1 * u, v[1] + d1[1] / l1 * u)
    b = (v[0] + d2[0] / l2 * u, v[1] + d2[1] / l2 * u)
    c = (a[0] + d2[0] / l2 * u, a[1] + d2[1] / l2 * u)
    return pline([a, c, b], stroke, 1.4)


def dot(x, y, r=3, fill=TX):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r1(x), r1(y), r, fill)


def hexv(cx, cy, r):
    """とがった上下の正六角形。T, UR, LR, B, LL, UL の順（SVG座標）"""
    a = 0.8660254 * r
    return [(cx, cy - r), (cx + a, cy - r / 2), (cx + a, cy + r / 2),
            (cx, cy + r), (cx - a, cy + r / 2), (cx - a, cy - r / 2)]


def rot(p, c, deg):
    ca, sa = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    dx, dy = p[0] - c[0], p[1] - c[1]
    return (c[0] + ca * dx - sa * dy, c[1] + sa * dx + ca * dy)


FIGS = {}

# ── 大問1（HG-3702）長方形を3本の線で区切る・四角形IGCH ─────────────
_x0, _x1, _y0, _y1 = 90, 350, 45, 175
_ex = 195                                     # E,G の x
_iy = _y1 - (_ex - _x0) * (_y1 - _y0) / float(_x1 - _x0)   # 対角線BD上に I が来る高さ
FIGS["HG-3702"] = svg("0 20 420 200", "".join([
    shade([(_ex, _iy), (_ex, _y1), (_x1, _y1), (_x1, _iy)]),      # 四角形IGCH
    '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="2"/>'
    % (_x0, _y0, _x1 - _x0, _y1 - _y0, LINE),
    ln(_ex, _y0, _ex, _y1),                    # EG（たての辺に平行）
    ln(_x0, _iy, _x1, _iy),                    # FH（横の辺に平行）
    ln(_x0, _y1, _x1, _y0),                    # 対角線BD
    dot(_ex, _iy, 3.5, TX),
    t(_x0 - 8, _y0 - 6, "A", TX, 13, "end"), t(_ex, _y0 - 8, "E"), t(_x1 + 8, _y0 - 6, "D", TX, 13, "start"),
    t(_x0 - 8, _iy + 4, "F", TX, 13, "end"), t(_ex + 9, _iy + 15, "I", TX, 13, "start"),
    t(_x1 + 8, _iy + 4, "H", TX, 13, "start"),
    t(_x0 - 8, _y1 + 14, "B", TX, 13, "end"), t(_ex, _y1 + 18, "G"), t(_x1 + 8, _y1 + 14, "C", TX, 13, "start"),
    t(210, 210, "3本の線で区切った長方形（ななめの線は対角線）", GRAY, 11),
]))

# ── 大問2（HG-3703）10cm×8cmの長方形・内部の1点と4すみ ────────────
_x0, _x1, _y0, _y1 = 120, 370, 48, 193
_px, _py = 277, 134                            # 内部の1点（実物も中心より右下寄り）
FIGS["HG-3703"] = svg("0 18 430 212", "".join([
    shade([(_x0, _y0), (_x1, _y0), (_px, _py)]),               # 上の斜線
    shade([(_x0, _y1), (_x1, _y1), (_px, _py)]),               # 下の斜線
    '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="2"/>'
    % (_x0, _y0, _x1 - _x0, _y1 - _y0, LINE),
    ln(_px, _py, _x0, _y0), ln(_px, _py, _x1, _y0),
    ln(_px, _py, _x0, _y1), ln(_px, _py, _x1, _y1),
    dot(_px, _py, 3.5, TX),
    dim(_x0, _y0, _x1, _y0, "10cm", 16, -1),
    dim(_x0, _y1, _x0, _y0, "8cm", 16, -1),
    t(245, 220, "内部の1点と4つの頂点を結ぶ", GRAY, 11),
]))

# ── 大問3（HG-3704）15cmの正方形・中の1点と各辺の3等分点 ─────────────
_s0, _s1 = 130, 330                            # 正方形（1辺200＝15cm）
_sy0, _sy1 = 68, 268
_p = (228, 144)                                # 中の1点（実物の位置：横0.49・縦0.38）
_ty1, _ty2 = _s0 + 200 / 3.0, _s0 + 400 / 3.0
_yy1, _yy2 = _sy0 + 200 / 3.0, _sy0 + 400 / 3.0
FIGS["HG-3704"] = svg("0 0 465 300", "".join([
    # 4つの四角形（㋐㋑㋒㋓）と4つの三角形（A B C D）を分ける8本
    shade([(_s0, _sy0), (_ty1, _sy0), _p, (_s0, _yy1)]),                    # ㋐ 左上
    shade([(_s0, _yy2), _p, (_ty1, _sy1), (_s0, _sy1)]),                    # ㋑ 左下
    shade([_p, (_s1, _yy2), (_s1, _sy1), (_ty2, _sy1)]),                    # ㋒ 右下
    shade([(_ty2, _sy0), (_s1, _sy0), (_s1, _yy1), _p]),                    # ㋓ 右上
    '<rect x="%s" y="%s" width="200" height="200" fill="none" stroke="%s" stroke-width="2"/>'
    % (_s0, _sy0, LINE),
    ln(_p[0], _p[1], _ty1, _sy0), ln(_p[0], _p[1], _ty2, _sy0),             # 上辺の3等分点へ
    ln(_p[0], _p[1], _s1, _yy1), ln(_p[0], _p[1], _s1, _yy2),               # 右辺
    ln(_p[0], _p[1], _ty2, _sy1), ln(_p[0], _p[1], _ty1, _sy1),             # 下辺
    ln(_p[0], _p[1], _s0, _yy2), ln(_p[0], _p[1], _s0, _yy1),               # 左辺
    dot(_p[0], _p[1], 3.5, TX),
    t(228, 92, "D"), t(170, 113, "㋐"), t(289, 113, "㋓"),
    t(162, 162, "A"), t(298, 165, "C"),
    t(173, 224, "㋑"), t(224, 243, "B"), t(286, 222, "㋒"),
    # 15cm（上辺・右辺）＋「3等分」が見えるように各3等分にも寸法線
    dim(_s0, _sy0, _ty1, _sy0, "5cm", 14, -1, 10),
    dim(_ty1, _sy0, _ty2, _sy0, "5cm", 14, -1, 10),
    dim(_ty2, _sy0, _s1, _sy0, "5cm", 14, -1, 10),
    dim(_s0, _sy0, _s1, _sy0, "15cm", 38, -1),
    dim(_s1, _yy1, _s1, _sy0, "5cm", 14, 1, 10),
    dim(_s1, _yy2, _s1, _yy1, "5cm", 14, 1, 10),
    dim(_s1, _sy1, _s1, _yy2, "5cm", 14, 1, 10),
    dim(_s1, _sy1, _s1, _sy0, "15cm", 58, 1),
    t(228, 291, "各辺を3等分した点と、中の1点を結ぶ", GRAY, 11),
]))

# ── 大問4（HG-3705）長方形ABCD・内部の点P・対角線BDは点線 ─────────────
_x0, _x1, _y0, _y1 = 105, 365, 55, 175
FIGS["HG-3705"] = svg("0 30 430 190", "".join([
    '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="2"/>'
    % (_x0, _y0, _x1 - _x0, _y1 - _y0, LINE),
    ln(_x0, _y1, _x1, _y0, LINE, 2, "7 5"),                     # 対角線BD（点線）
    ln(220, 85, _x0, _y0), ln(220, 85, _x1, _y0),
    ln(220, 85, _x0, _y1), ln(220, 85, _x1, _y1),
    dot(220, 85, 3.5, TX),
    t(_x0 - 8, _y0 - 6, "A", TX, 13, "end"), t(_x1 + 8, _y0 - 6, "D", TX, 13, "start"),
    t(_x0 - 8, _y1 + 15, "B", TX, 13, "end"), t(_x1 + 8, _y1 + 15, "C", TX, 13, "start"),
    t(220, 78, "P"),
    t(235, 208, "点Pから4つの頂点へ／BDは点線", GRAY, 11),
]))

# ── 大問5（HG-3706）長方形ABCD・内部の点P（大問4と同じ形） ────────────
_x0, _x1, _y0, _y1 = 105, 365, 55, 165
FIGS["HG-3706"] = svg("0 30 430 180", "".join([
    '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="2"/>'
    % (_x0, _y0, _x1 - _x0, _y1 - _y0, LINE),
    ln(_x0, _y1, _x1, _y0, LINE, 2, "7 5"),                     # 対角線BD（点線）
    ln(225, 84, _x0, _y0), ln(225, 84, _x1, _y0),
    ln(225, 84, _x0, _y1), ln(225, 84, _x1, _y1),
    dot(225, 84, 3.5, TX),
    t(_x0 - 8, _y0 - 6, "A", TX, 13, "end"), t(_x1 + 8, _y0 - 6, "D", TX, 13, "start"),
    t(_x0 - 8, _y1 + 15, "B", TX, 13, "end"), t(_x1 + 8, _y1 + 15, "C", TX, 13, "start"),
    t(225, 77, "P"),
    t(235, 200, "点Pから4つの頂点へ／BDは点線", GRAY, 11),
]))

# ── 大問6（HG-3707）正方形ABCD・正三角形PBC ────────────────────
_q0, _q1 = 130, 290                            # 正方形（1辺160＝20cm）
_qy0, _qy1 = 45, 205
_P6 = (210, _qy1 - 160 * 0.8660254)            # 正三角形PBCの頂点
FIGS["HG-3707"] = svg("0 20 430 225", "".join([
    '<rect x="%s" y="%s" width="160" height="160" fill="none" stroke="%s" stroke-width="2"/>'
    % (_q0, _qy0, LINE),
    ln(_P6[0], _P6[1], _q0, _qy1), ln(_P6[0], _P6[1], _q1, _qy1),      # 正三角形PBC
    ln(_P6[0], _P6[1], _q0, _qy0), ln(_P6[0], _P6[1], _q1, _qy0),      # AP・DP
    ln(_q0, _qy1, _q1, _qy0),                                          # 対角線BD
    dot(_P6[0], _P6[1], 3.5, TX),
    t(_q0 - 8, _qy0 - 6, "A", TX, 13, "end"), t(_q1 + 8, _qy0 - 6, "D", TX, 13, "start"),
    t(_q0 - 8, _qy1 + 15, "B", TX, 13, "end"), t(_q1 + 8, _qy1 + 15, "C", TX, 13, "start"),
    t(_P6[0], _P6[1] - 8, "P"),
    dim(_q1, _qy0, _q1, _qy1, "20cm", 22, -1),
    t(215, 236, "四角形ABCDは正方形・三角形PBCは正三角形", GRAY, 11),
]))

# ── 大問7（HG-3708）正三角形ABCと頂角120°の二等辺三角形DEF ────────────
_B7, _C7 = (55, 170), (175, 170)
_A7 = (115, 170 - 120 * 0.8660254)
_E7, _F7 = (255, 170), (375, 170)
_D7 = (315, 170 - 60 * 0.5773503)
FIGS["HG-3708"] = svg("0 40 440 200", "".join([
    poly([_A7, _B7, _C7], LINE, 2),
    poly([_D7, _E7, _F7], LINE, 2),
    t(_A7[0], _A7[1] - 9, "A"), t(_B7[0] - 9, _B7[1] + 5, "B", TX, 13, "end"),
    t(_C7[0] + 9, _C7[1] + 5, "C", TX, 13, "start"),
    t(_D7[0], _D7[1] - 9, "D"), t(_E7[0] - 9, _E7[1] + 5, "E", TX, 13, "end"),
    t(_F7[0] + 9, _F7[1] + 5, "F", TX, 13, "start"),
    dim(_B7[0], _B7[1], _C7[0], _C7[1], "12cm", 16, 1),
    dim(_E7[0], _E7[1], _F7[0], _F7[1], "12cm", 16, 1),
    arc(_D7[0], _D7[1], 16, 30, 150),
    t(_D7[0] + 37, _D7[1], "120°", TX, 12, "start"),
    t(115, 218, "正三角形ABC", GRAY, 11), t(315, 218, "二等辺三角形DEF", GRAY, 11),
]))

# ── 大問8（HG-3709）正三角形ABEと台形ABCD ─────────────────────
_A8, _B8 = (110, 55), (110, 205)
_E8 = (110 + 150 * 0.8660254, 130)
_D8 = (_E8[0] - 75 * 0.5773503, 55)
_C8 = (_E8[0] + (_E8[0] - _D8[0]), 205)
FIGS["HG-3709"] = svg("0 30 430 220", "".join([
    poly([_A8, _D8, _C8, _B8], LINE, 2),                       # 台形ABCD
    ln(_A8[0], _A8[1], _E8[0], _E8[1]), ln(_B8[0], _B8[1], _E8[0], _E8[1]),
    dot(_E8[0], _E8[1], 3.5, TX),
    t(_A8[0] - 9, _A8[1] - 4, "A", TX, 13, "end"), t(_D8[0], _D8[1] - 9, "D"),
    t(_E8[0] + 10, _E8[1] - 2, "E", TX, 13, "start"),
    t(_B8[0] - 9, _B8[1] + 14, "B", TX, 13, "end"), t(_C8[0] + 9, _C8[1] + 14, "C", TX, 13, "start"),
    arc(_D8[0], _D8[1], 20, 180, 60, TX, 1.4),
    anglabel(_D8[0], _D8[1], 36, 180, 60, "120°"),
    arc(_B8[0], _B8[1], 30, 0, -30, TX, 1.4),
    anglabel(_B8[0], _B8[1], 46, 0, -30, "30°"),
    rightangle(_E8, _B8, _C8, 12),
    t(215, 240, "正三角形ABEと台形ABCD（EはDC上）", GRAY, 11),
]))

# ── 大問9（HG-3710）30°30°120°の二等辺三角形を折りたたむ ─────────────
_by = 170.0
_B9, _C9 = (60.0, _by), (360.0, _by)
_A9 = (210.0, _by - 300 * 0.2886751)           # 頂角120°の二等辺三角形
_mAB = ((_B9[0] + _A9[0]) / 2, (_B9[1] + _A9[1]) / 2)
_mAC = ((_C9[0] + _A9[0]) / 2, (_C9[1] + _A9[1]) / 2)
_P1 = (160.0, _by)                             # 底辺の1/3（左の折り目のはし）
_P2 = (285.0, _by)                             # 底辺の3/4（右の折り目＝縦線）
_M9 = (210.0, _by)                             # 垂線の足
FIGS["HG-3710"] = svg("0 70 420 138", "".join([
    # もとの二等辺三角形（折ってしまった部分＝点線）
    ln(_B9[0], _B9[1], _mAB[0], _mAB[1], GRAY, 1.8, "6 5"),
    ln(_C9[0], _C9[1], _mAC[0], _mAC[1], GRAY, 1.8, "6 5"),
    ln(_B9[0], _B9[1], _P1[0], _P1[1], GRAY, 1.8, "6 5"),
    ln(_P2[0], _P2[1], _C9[0], _C9[1], GRAY, 1.8, "6 5"),
    # 折り目の延長（点線）
    ln(_mAB[0] - 12, _mAB[1] - 20.8, _mAB[0], _mAB[1], GRAY, 1.4, "5 5"),
    ln(_P1[0], _P1[1], _P1[0] + 12, _P1[1] + 20.8, GRAY, 1.4, "5 5"),
    ln(_P2[0], _mAC[1] - 20, _P2[0], _mAC[1], GRAY, 1.4, "5 5"),
    ln(_P2[0], _P2[1], _P2[0], _P2[1] + 20, GRAY, 1.4, "5 5"),
    # 折ったあとの五角形（実線）
    poly([_A9, _mAB, _P1, _P2, _mAC], LINE, 2.2),
    # 折り返された部分のふち
    ln(_P1[0], _P1[1], _A9[0], _A9[1]),                       # 左：BがAに重なった
    ln(_M9[0], _M9[1], _mAC[0], _mAC[1]),                     # 右：Cが垂線の足に重なった
    ln(_A9[0], _A9[1], _M9[0], _M9[1]),                       # 高さ
    '<rect x="%s" y="%s" width="10" height="10" fill="none" stroke="%s" stroke-width="1.4"/>'
    % (r1(_M9[0] - 10), r1(_M9[1] - 10), TX),
    # 折る向きの矢印
    '<defs><marker id="a9" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">'
    '<path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % HI,
    '<path d="M320 145 A26 26 0 0 0 292 137" fill="none" stroke="%s" stroke-width="1.8"'
    ' marker-end="url(#a9)"/>' % HI,
    t(210, 196, "点線がもとの二等辺三角形（30°・30°・120°）／実線が折ってできた五角形", GRAY, 11),
]))

# ── 大問10（HG-3711）正六角形をもとにした3つの図 ────────────────────
_r10 = 48
_body10 = []
for _i, _cx in enumerate((78, 218, 358)):
    _cy = 100
    T, UR, LR, Bv, LL, UL = hexv(_cx, _cy, _r10)
    if _i == 0:                                            # (図1) 上の三角形が斜線
        _body10.append(shade([UL, T, UR]))
        _body10.append(poly([T, UR, LR, Bv, LL, UL], LINE, 2))
        _body10.append(ln(UL[0], UL[1], UR[0], UR[1]))
        for _p in (UL, UR, Bv):
            _body10.append(ln(_cx, _cy, _p[0], _p[1], GRAY, 1.6, "6 5"))
        _body10.append(ln(UL[0], UL[1], Bv[0], Bv[1], GRAY, 1.6, "6 5"))
        _body10.append(ln(UR[0], UR[1], Bv[0], Bv[1], GRAY, 1.6, "6 5"))
    elif _i == 1:                                          # (図2) 上の弦と左下→右上の対角線
        _body10.append(shade([UL, UR, LL]))
        _body10.append(poly([T, UR, LR, Bv, LL, UL], LINE, 2))
        _body10.append(ln(UL[0], UL[1], UR[0], UR[1]))
        _body10.append(ln(LL[0], LL[1], UR[0], UR[1]))
    else:                                                  # (図3) 六芒星のまん中
        _a, _h = 0.2886751 * _r10, 0.5 * _r10
        _inner = [(_cx - _a, _cy - _h), (_cx + _a, _cy - _h), (_cx + 0.5773503 * _r10, _cy),
                  (_cx + _a, _cy + _h), (_cx - _a, _cy + _h), (_cx - 0.5773503 * _r10, _cy)]
        _body10.append(shade(_inner))
        _body10.append(poly([T, UR, LR, Bv, LL, UL], LINE, 2))
        _body10.append(poly([T, LL, LR], LINE, 2))
        _body10.append(poly([Bv, UL, UR], LINE, 2))
    _body10.append(t(_cx, 178, "(図%d)" % (_i + 1), TX, 12))
FIGS["HG-3711"] = svg("0 38 440 155", "".join(_body10))

# ── 大問11（HG-3712）円に内接する正六角形ABCDEF ────────────────────
_r11 = 66
_body11 = []
for _i, _cx in enumerate((115, 330)):
    _cy = 118
    A, F, E, D, C, B = hexv(_cx, _cy, _r11)      # A上・F右上・E右下・D下・C左下・B左上
    _body11.append('<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="1.6"/>'
                   % (_cx, _cy, _r11, GRAY))
    if _i == 0:
        _body11.append(poly([A, F, E, D, C, B], LINE, 1.8))
        for _p, _q in ((A, D), (B, E), (C, F)):
            _body11.append(ln(_p[0], _p[1], _q[0], _q[1], GRAY, 1.4, "5 5"))
        _body11.append(poly([A, C, D, F], HI, 3))            # 長方形ACDF
        _body11.append(t(_cx, 222, "(1) 長方形ACDF", TX, 12))
    else:
        _a, _h = 0.2886751 * _r11, 0.5 * _r11
        _lr, _rr = (_cx - 0.5773503 * _r11, _cy), (_cx + 0.5773503 * _r11, _cy)
        _tl, _tr = (_cx - _a, _cy - _h), (_cx + _a, _cy - _h)
        _bl, _br = (_cx - _a, _cy + _h), (_cx + _a, _cy + _h)
        for _tri in ([A, _tl, _tr], [_tr, F, _rr], [_rr, E, _br],
                     [_br, D, _bl], [_bl, C, _lr], [_lr, B, _tl]):
            _body11.append(shade(_tri))
        _body11.append(poly([A, F, E, D, C, B], LINE, 1.8))
        _body11.append(poly([A, C, E], LINE, 1.8))
        _body11.append(poly([B, D, F], LINE, 1.8))
        _body11.append(t(_cx, 222, "(2) 斜線をつけた部分", TX, 12))
    _body11.append(dot(_cx, _cy, 2.5, TX))
    _body11.append(t(_cx + 12, _cy + 4, "O", TX, 12, "start"))
    for _p, _s, _dx, _dy, _an in ((A, "A", 0, -10, "middle"), (B, "B", -10, -2, "end"),
                                  (C, "C", -10, 12, "end"), (D, "D", 0, 20, "middle"),
                                  (E, "E", 10, 12, "start"), (F, "F", 10, -2, "start")):
        _body11.append(t(_p[0] + _dx, _p[1] + _dy, _s, TX, 12, _an))
FIGS["HG-3712"] = svg("0 22 450 210", "".join(_body11))

# ── 大問12（HG-3713）正六角形の中の㋐（三角形）と㋑（四角形） ─────────────
_c12, _r12 = (200, 125), 90
T, UR, LR, Bv, LL, UL = hexv(_c12[0], _c12[1], _r12)
_M12 = ((UL[0] + UR[0]) / 2, UL[1])                       # 上の弦のまん中
_P12 = (T[0] + (LL[0] - T[0]) / 3.0, UL[1])               # T→LL が弦と交わる点
FIGS["HG-3713"] = svg("0 20 400 225", "".join([
    shade([UL, _P12, LL]),                                 # ㋐（三角形）
    shade([_P12, _M12, Bv, LL]),                           # ㋑（四角形）
    poly([T, UR, LR, Bv, LL, UL], LINE, 2),
    ln(UL[0], UL[1], UR[0], UR[1]),                        # 上の弦
    ln(T[0], T[1], LL[0], LL[1]),                          # 頂点T→左下の頂点
    ln(T[0], T[1], Bv[0], Bv[1]),                          # まん中の縦線
    t(140, 100, "㋐"), t(177, 141, "㋑"),
    t(200, 235, "正六角形の面積は36cm²", GRAY, 11),
]))

# ── 大問13（HG-3714）長方形を何本かの線で区切る・斜線部分の比 ────────────
_g0, _g1, _gy0, _gy1 = 30, 190, 58, 168
_gw, _gh = (_g1 - _g0) / 3.0, (_gy1 - _gy0) / 3.0
_h0, _h1, _hy0, _hy1 = 250, 430, 58, 168
_u = (_h1 - _h0) / 3.0                                     # AB=BC=CD
_hm = (_hy0 + _hy1) / 2.0
_vx = _h0 + _u / 2.0                                       # たての線（Bから左下すみへ引いた線のまん中）
FIGS["HG-3714"] = svg("0 18 470 216", "".join([
    # ── (1) 3×3の格子＋対角線 ──
    shade([(_g0, _gy0), (_g0 + _gw, _gy0), (_g0 + _gw, _gy0 + _gh), (_g0, _gy0 + _gh)]),   # ア
    shade([(_g0 + 2 * _gw, _gy1), (_g1, _gy1), (_g1, _gy1 - _gh)]),                        # イ
    '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="2"/>'
    % (_g0, _gy0, _g1 - _g0, _gy1 - _gy0, LINE),
    ln(_g0 + _gw, _gy0, _g0 + _gw, _gy1), ln(_g0 + 2 * _gw, _gy0, _g0 + 2 * _gw, _gy1),
    ln(_g0, _gy0 + _gh, _g1, _gy0 + _gh), ln(_g0, _gy0 + 2 * _gh, _g1, _gy0 + 2 * _gh),
    ln(_g0, _gy1, _g1, _gy0),                                                   # 対角線
    ln(_g0 + 2 * _gw, _gy1, _g1, _gy1 - _gh),                                   # 右下のマスの対角線
    t(_g0 + _gw / 2, _gy0 + _gh / 2 + 5, "ア"),
    '<path d="M%s %s Q%s %s %s %s" fill="none" stroke="%s" stroke-width="1.2"/>'
    % (r1(_g0 + 2.5 * _gw), r1(_gy1), r1(_g0 + 2.5 * _gw), r1(_gy1 + 14),
       r1(_g0 + 2.9 * _gw), r1(_gy1 + 24), GRAY),
    t(_g0 + 2.9 * _gw + 9, _gy1 + 31, "イ"),
    t(110, 32, "(1) ア:イ", TX, 12),
    # ── (2) 上辺にA・B・C・D（3等分） ──
    shade([(_h0, _hy0), (_vx, _hy0), (_vx, _hm), (_h0, _hy1)]),                 # ウ
    shade([(_vx, _hm), (_h0 + 2.5 * _u, _hm), (_h1, _hy1), (_vx, _hy1)]),       # エ
    '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="2"/>'
    % (_h0, _hy0, _h1 - _h0, _hy1 - _hy0, LINE),
    ln(_vx, _hy0, _vx, _hy1),                                                   # たての線
    ln(_vx, _hm, _h0 + 2.5 * _u, _hm),                                          # よこの線
    ln(_h0 + _u, _hy0, _h0, _hy1),                                              # B→左下すみ
    ln(_h0 + 2 * _u, _hy0, _h1, _hy1),                                          # C→右下すみ
    t(_h0, _hy0 - 8, "A"), t(_h0 + _u, _hy0 - 8, "B"),
    t(_h0 + 2 * _u, _hy0 - 8, "C"), t(_h1, _hy0 - 8, "D"),
    t(_h0 + 14, _hy0 + 40, "ウ"), t(_h0 + 3.6 * _u / 2 + 20, _hm + 30, "エ"),
    t(340, 32, "(2) ウ:エ", TX, 12),
    t(235, 222, "(2)ではAB・BC・CDの長さはすべて等しい", GRAY, 11),
]))

# ── 大問14（HG-3715）平行四辺形の紙をBEで折る ─────────────────────
def _para(ox, fig2):
    B = (30.0 + ox, 175.0)
    C = (150.0 + ox, 175.0)
    D = (200.0 + ox, 80.0)
    A0 = (80.0 + ox, 80.0)                       # もとのA＝(A)
    E = (118.0 + ox, 80.0)
    A2 = (120.8 + ox, 117.8)                     # 折り返したA
    F = (100.3 + ox, 99.0)
    out = [
        ln(A0[0], A0[1], E[0], E[1], GRAY, 1.6, "6 5"),
        ln(A0[0], A0[1], B[0], B[1], GRAY, 1.6, "6 5"),
        pline([B, C, D, E], LINE, 2),
        ln(E[0], E[1], A2[0], A2[1]), ln(A2[0], A2[1], B[0], B[1]),
        ln(B[0], B[1], E[0], E[1]),               # 折り目BE
        ln(A2[0], A2[1], F[0], F[1]),             # 垂線AF
        '<rect x="%s" y="%s" width="8" height="8" fill="none" stroke="%s" stroke-width="1.3"'
        ' transform="rotate(-47 %s %s)"/>' % (r1(F[0]), r1(F[1] - 8), TX, r1(F[0]), r1(F[1] - 8)),
        arc(B[0], B[1], 36, -62.2, -47.2), arc(B[0], B[1], 36, -47.2, -32.2),
        t(B[0] + 46, B[1] - 28, "ア", HI, 13),
        t(A0[0] - 6, A0[1] - 9, "(A)", TX, 12, "middle"),
        t(E[0] + 4, E[1] - 9, "E", TX, 13, "start"),
        t(D[0] + 7, D[1] - 6, "D", TX, 13, "start"),
        t(F[0] - 9, F[1] - 2, "F", TX, 12, "end"),
        t(A2[0] + 7, A2[1] + 12, "A", TX, 13, "start"),
        t(B[0] - 8, B[1] + 15, "B", TX, 13, "end"),
        t(C[0] + 2, C[1] + 17, "C", TX, 13, "middle"),
        dim(D[0], D[1], C[0], C[1], "10cm", 15, -1),
        t(115.0 + ox, 205, "図%d" % (2 if fig2 else 1), TX, 12),
    ]
    if fig2:
        out[3:3] = [ln(A2[0], A2[1], D[0], D[1]), ln(A2[0], A2[1], C[0], C[1]),
                    ln(B[0], B[1], D[0], D[1])]
    return "".join(out)


FIGS["HG-3715"] = svg("0 55 470 165", _para(0, False) + _para(232, True))

# ── 大問15（HG-3716）正六角形を点Aのまわりに30°回す ────────────────
_r15 = 72
_A15 = (147.0, 195.0)                              # 回転の中心＝正六角形の下の頂点
_c15 = (147.0, 195.0 - _r15)
_T, _UR, _LR, _Bv, _LL, _UL = hexv(_c15[0], _c15[1], _r15)   # _Bv が A と一致
_h2 = [rot(p, _A15, 30) for p in (_T, _UR, _LR, _Bv, _LL, _UL)]
_T2, _UR2, _LR2, _B2, _LL2, _UL2 = _h2
FIGS["HG-3716"] = svg("0 35 340 200", "".join([
    shade([_UR, _T2, _UR2, _LR]),                  # 斜線部分（正六角形の1/6）
    poly([_T, _UR, _LR, _Bv, _LL, _UL], LINE, 2),
    poly(_h2, LINE, 2),
    ln(_A15[0], _A15[1], _T[0], _T[1], GRAY, 1.6, "6 5"),
    ln(_A15[0], _A15[1], _UR[0], _UR[1], GRAY, 1.6, "6 5"),
    ln(_UL[0], _UL[1], _LL2[0], _LL2[1], GRAY, 1.6, "6 5"),
    ln(_LR[0], _LR[1], _UR2[0], _UR2[1], GRAY, 1.6, "6 5"),
    t(_A15[0], _A15[1] + 18, "A"),
    t(170, 229, "面積72cm²の正六角形を、点Aを中心に回した", GRAY, 11),
]))

# ── 大問16（HG-3717）合同な正六角形2つを重ねる ────────────────────
_r16 = 72
_ap = 0.8660254 * _r16
_c1 = (100.0, 115.0)
_c2 = (100.0 + _ap, 115.0)
_A, _F, _E, _D, _C, _B = hexv(_c1[0], _c1[1], _r16)
_P, _U, _T, _S, _R, _Q = hexv(_c2[0], _c2[1], _r16)
_lab1 = [(_A, "A", 0, -10, "middle"), (_B, "B", -10, -2, "end"), (_C, "C", -10, 12, "end"),
         (_D, "D", -6, 20, "middle"), (_E, "E", 12, 12, "start"), (_F, "F", 12, -2, "start"),
         (_P, "P", 0, -10, "middle"), (_Q, "Q", -10, -2, "end"), (_R, "R", -10, 14, "end"),
         (_S, "S", 8, 20, "middle"), (_T, "T", 12, 12, "start"), (_U, "U", 12, -2, "start")]
# 図2：AとPが重なり、辺DEと辺RSがお互いのまん中で交わる（約-27.8°の回転）
_c3 = (400.0, 115.0)
_A3, _F3, _E3, _D3, _C3, _B3 = hexv(_c3[0], _c3[1], _r16)
_deg = -27.79
_h3 = [rot(p, _A3, _deg) for p in (_A3, _B3, _C3, _D3, _E3, _F3)]
_P3, _Q3, _R3, _S3, _T3, _U3 = _h3
_Y3 = rot(_c3, _A3, _deg)
_lab2 = [(_A3, "A(P)", 0, -11, "middle"), (_B3, "B", -10, -2, "end"), (_C3, "C", -10, 12, "end"),
         (_D3, "D", -4, 22, "middle"), (_E3, "E", 12, 6, "start"), (_F3, "F", -9, -4, "end"),
         (_Q3, "Q", -10, 2, "end"), (_R3, "R", -9, 6, "end"), (_S3, "S", 9, 16, "start"),
         (_T3, "T", 11, 6, "start"), (_U3, "U", 8, -6, "start")]
FIGS["HG-3717"] = svg("0 20 570 225", "".join(
    [poly([_A, _F, _E, _D, _C, _B], LINE, 2), poly([_P, _U, _T, _S, _R, _Q], LINE, 2),
     dot(_c1[0], _c1[1], 3, TX), t(_c1[0] - 9, _c1[1] + 4, "X", TX, 12, "end"),
     dot(_c2[0], _c2[1], 3, TX), t(_c2[0] + 9, _c2[1] + 4, "Y", TX, 12, "start")]
    + [t(p[0] + dx, p[1] + dy, s, TX, 12, an) for p, s, dx, dy, an in _lab1]
    + [t(132, 218, "図1", TX, 12)]
    + [poly([_A3, _F3, _E3, _D3, _C3, _B3], LINE, 2), poly(_h3, LINE, 2),
       dot(_c3[0], _c3[1], 3, TX), t(_c3[0] - 9, _c3[1] + 10, "X", TX, 12, "end"),
       dot(_Y3[0], _Y3[1], 3, TX), t(_Y3[0], _Y3[1] - 8, "Y", TX, 12, "middle")]
    + [t(p[0] + dx, p[1] + dy, s, TX, 12, an) for p, s, dx, dy, an in _lab2]
    + [t(420, 232, "図2", TX, 12)]))


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
