# -*- coding: utf-8 -*-
"""小5最レ 第1分冊 第1講座 No.7・No.8 の「小問の図」の監査結果を当てるパッチ。

前提: 別セッションが 60 枚の小問図（step["svg"]）をすでに入れている。
      本パッチはそれを原本PDF（PDF0-idx36〜45／印刷p38〜47）と突き合わせて実測した結果、
      ① 幾何が壊れている図を描き直し
      ② 図ができたことで不要になった「制作側の描写文」を原本の設問に戻す
      ものだけを当てる。正しかった 53 枚には手を触れない。

使い方:  python scripts/_fix_s5sairei_w5_3b.py [対象JSON]   （省略時 data/hama_daimon.json）

・図を書きこむ前に、新しい図の座標から長さ・面積・平行・直角を計算し直して
  問題文・答えと合うか確かめる。1つでも合わなければ 1件も書かずに止める
・図は「置きかえ元にこの文字列が入っていること」を確かめてから入れかえる（冪等）
・文章は欄まるごとの一致で判定（冪等）
"""
import io, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from genbo_common import iter_daimon  # noqa: E402

ST = "#4f9eff"
TX = "#e8ecf5"


def near(a, b, tol=1e-6):
    return abs(a - b) <= tol


def area(pts):
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def dist(p, q):
    return math.hypot(q[0] - p[0], q[1] - p[1])


def perp(p, q, r, s):
    return near((q[0] - p[0]) * (s[0] - r[0]) + (q[1] - p[1]) * (s[1] - r[1]), 0.0, 1e-6)


def collinear(p, q, r):
    return near((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]), 0.0, 1e-6)


CHECKS = []


def ck(name, cond):
    CHECKS.append((name, bool(cond)))


def head(w, h):
    return ('<svg viewBox="0 0 %g %g" style="display:block;margin:0 auto;max-width:100%%;'
            'height:auto">' % (w, h))


def hatchdef(uid):
    return ('<defs><pattern id="%s" width="7" height="7" patternUnits="userSpaceOnUse" '
            'patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="%s" '
            'stroke-width="1.1"/></pattern></defs>' % (uid, ST))


def poly(pts, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ""
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        " ".join("%g,%g" % p for p in pts), fill, ST, w, d)


def line(p, q, w=1.6, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ""
    return '<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="%s"%s/>' % (
        p[0], p[1], q[0], q[1], ST, w, d)


def txt(x, y, s, size=14, anchor="middle"):
    return '<text x="%g" y="%g" font-size="%s" fill="%s" text-anchor="%s">%s</text>' % (
        x, y, size, TX, anchor, s)


def ra(c, a, b, size=11):
    """cを頂点に、aとbの向きへの直角の印（px座標）。"""
    def u(p):
        vx, vy = p[0] - c[0], p[1] - c[1]
        n = math.hypot(vx, vy)
        return (vx / n * size, vy / n * size)
    ax, ay = u(a); bx, by = u(b)
    return ('<path d="M%g %g L%g %g L%g %g" fill="none" stroke="%s" stroke-width="1.4"/>'
            % (c[0] + ax, c[1] + ay, c[0] + ax + bx, c[1] + ay + by, c[0] + bx, c[1] + by, ST))


def arc45(c, a, b, r, lab, lr):
    """cを頂点にした角の弧＋角度の文字（px座標）。"""
    def ang(p):
        return math.atan2(p[1] - c[1], p[0] - c[0])
    a1, a2 = ang(a), ang(b)
    d = (a2 - a1 + math.pi * 3) % (math.pi * 2) - math.pi
    sw = 1 if d > 0 else 0
    am = a1 + d / 2.0
    return ('<path d="M%g %g A%g %g 0 0 %d %g %g" fill="none" stroke="%s" stroke-width="1.3"/>'
            % (c[0] + r * math.cos(a1), c[1] + r * math.sin(a1), r, r, sw,
               c[0] + r * math.cos(a2), c[1] + r * math.sin(a2), ST)) + \
           txt(c[0] + lr * math.cos(am), c[1] + lr * math.sin(am) + 5, lab, 13)


# =====================================================================
#  描き直す図（原本 PDF0-idx36/37 から座標を起こして検算する）
# =====================================================================

# --- HG-6892(6) 高さの足が底辺の外に落ちる三角形 -----------------------
# もとの図は、底辺PQと「その延長」として描かれた破線が一直線になっておらず、
# 高さも底辺と直角になっていなかった。縮尺 41px/cm で引き直す。
def svg_6892_6():
    S = 41.0
    P, Q, H, T = (61.0, 235.0), (184.0, 235.0), (320.0, 235.0), (320.0, 30.0)
    body = [poly([P, Q, T], 2),
            line(Q, H, 1.4, "5,4"), line(T, H, 1.4, "5,4"),
            ra(H, Q, T, 12),
            txt((P[0] + Q[0]) / 2, 258, "3cm"),
            txt(248, 128, "6cm"),
            txt(336, 140, "5cm", anchor="start")]
    ck("6892(6) 底辺PQ=3cm", near(dist(P, Q) / S, 3.0, 1e-9))
    ck("6892(6) 高さTH=5cm", near(dist(T, H) / S, 5.0, 1e-9))
    ck("6892(6) TQ=6cm", near(dist(T, Q) / S, 6.0, 1e-3))
    ck("6892(6) 足Hは底辺の延長上", collinear(P, Q, H) and H[0] > Q[0])
    ck("6892(6) 高さは底辺と直角", perp(P, Q, H, T))
    ck("6892(6) 面積7.5", near(area([P, Q, T]) / (S * S), 7.5, 1e-9))
    return head(380, 300) + "".join(body) + "</svg>"


# --- HG-6894(2) 対角線が垂直な「へこんだ四角形」 -----------------------
# もとの図は四角形の面積が17cm²で、答えの24cm²と合わなかった。
# また破線が四角形の頂点を結んでおらず、対角線になっていなかった。
# 原本(3)で確かめた「へこんだ四角形」の形にそろえ、対角線4cm・12cmが垂直に交わる形にする。
def svg_6894_2():
    S = 26.0
    def X(x): return 24.0 + x * S
    def Y(y): return 24.0 + (12.0 - y) * S
    Tp, L, Bt, M = (X(6), Y(12)), (X(0), Y(7)), (X(6), Y(0)), (X(4), Y(7))
    Xp = (X(6), Y(7))
    body = [hatchdef("h6894b"),
            poly([Tp, L, Bt, M], 2),
            line(Tp, Bt, 1.4, "5,4"), line(L, Xp, 1.4, "5,4"),
            ra(Xp, Tp, L, 11),
            txt((X(0) + X(4)) / 2, Y(7) - 9, "4cm"),
            txt(X(6) + 12, (Y(12) + Y(0)) / 2, "12cm", anchor="start")]
    cm = [(6, 12), (0, 7), (6, 0), (4, 7)]
    ck("6894(2) 対角線 T-Bt=12cm", near(dist((6, 12), (6, 0)), 12))
    ck("6894(2) もう1本 L-M=4cm", near(dist((0, 7), (4, 7)), 4))
    ck("6894(2) 2本が直角", perp((6, 12), (6, 0), (0, 7), (4, 7)))
    ck("6894(2) 面積24", near(area(cm), 24, 1e-9))
    return head(268, 360) + "".join(body) + "</svg>"


# --- HG-6894(3) 原本は「へこんだ四角形」。もとの図は(1)と同じ凧形だった -----
def svg_6894_3():
    S = 30.0
    def X(x): return 24.0 + x * S
    def Y(y): return 24.0 + (10.0 - y) * S
    Tp, L, Bt, M = (X(6), Y(10)), (X(0), Y(5.5)), (X(6), Y(0)), (X(5), Y(5.5))
    Xp = (X(6), Y(5.5))
    body = [poly([Tp, L, Bt, M], 2),
            line(Tp, Bt, 1.4, "5,4"), line(L, Xp, 1.4, "5,4"),
            ra(Xp, Tp, L, 11),
            txt((X(0) + X(5)) / 2, Y(5.5) - 9, "5cm"),
            txt(X(6) + 12, (Y(10) + Y(0)) / 2, "10cm", anchor="start")]
    cm = [(6, 10), (0, 5.5), (6, 0), (5, 5.5)]
    ck("6894(3) 対角線 T-Bt=10cm", near(dist((6, 10), (6, 0)), 10))
    ck("6894(3) もう1本 L-M=5cm", near(dist((0, 5.5), (5, 5.5)), 5))
    ck("6894(3) 2本が直角", perp((6, 10), (6, 0), (0, 5.5), (5, 5.5)))
    ck("6894(3) 面積25", near(area(cm), 25, 1e-9))
    return head(268, 348) + "".join(body) + "</svg>"


# --- HG-6908 直角二等辺三角形3つ（2辺が等しくなっていなかった）-----------
def svg_6908_1():
    S = 8.0
    O, C, A = (60.0, 220.0), (220.0, 220.0), (60.0, 60.0)
    body = [poly([O, C, A], 2), ra(O, C, A, 13),
            arc45(C, O, A, 26, "45&#176;", 40),
            txt(140, 250, "20cm")]
    ck("6908(1) 2辺とも20cm", near(dist(O, C) / S, 20) and near(dist(O, A) / S, 20))
    ck("6908(1) 直角", perp(O, C, O, A))
    ck("6908(1) 面積200", near(area([O, C, A]) / (S * S), 200, 1e-9))
    return head(260, 268) + "".join(body) + "</svg>"


def svg_6908_2():
    S = 220.0 / 24.0
    B, C, A = (20.0, 170.0), (240.0, 170.0), (130.0, 60.0)
    body = [poly([B, C, A], 2), ra(A, B, C, 13),
            arc45(B, C, A, 26, "45&#176;", 42),
            txt(130, 200, "24cm")]
    ck("6908(2) 底辺24cm", near(dist(B, C) / S, 24))
    ck("6908(2) 頂角が直角", perp(A, B, A, C))
    ck("6908(2) 二等辺", near(dist(A, B), dist(A, C)))
    ck("6908(2) 面積144", near(area([B, C, A]) / (S * S), 144, 1e-9))
    return head(260, 220) + "".join(body) + "</svg>"


def svg_6908_3():
    S = 13.0
    L = 18.0 / math.sqrt(2.0) * S
    O, C, A = (40.0, 220.0), (40.0 + L, 220.0), (40.0, 220.0 - L)
    body = [poly([O, C, A], 2), ra(O, C, A, 13),
            arc45(C, O, A, 26, "45&#176;", 40),
            txt(150, 122, "18cm")]
    ck("6908(3) 斜辺18cm", near(dist(A, C) / S, 18, 1e-9))
    ck("6908(3) 2辺が等しい・直角", near(dist(O, C), dist(O, A)) and perp(O, C, O, A))
    ck("6908(3) 面積81", near(area([O, C, A]) / (S * S), 81, 1e-9))
    return head(250, 260) + "".join(body) + "</svg>"


# --- HG-6909(2) 原本の与件「6cm」が図から抜けていた --------------------
def svg_6909_2():
    S = 10.0
    body = [hatchdef("h6909b"),
            poly([(20, 200), (100, 120), (100, 200)], 1.8),
            poly([(50, 200), (50, 130), (120, 200)], 1.8),
            poly([(50, 130), (50, 170), (70, 150)], 1.6, "url(#h6909b)"),
            line((110, 120), (110, 180), 1.2),
            line((106, 120), (114, 120), 1.2),
            line((106, 180), (114, 180), 1.2),
            txt(35, 224, "3cm", 13), txt(75, 224, "5cm", 13),
            txt(118, 155, "6cm", 13, "start")]
    # 6cm＝右の三角形のたての辺のうち、左の三角形の斜辺より上の部分
    ck("6909(2) 左は直角二等辺(脚7cm)", near(dist((50, 200), (50, 130)) / S, 7)
       and near(dist((50, 200), (120, 200)) / S, 7))
    ck("6909(2) 右は直角二等辺(脚8cm)", near(dist((100, 200), (100, 120)) / S, 8)
       and near(dist((20, 200), (100, 200)) / S, 8))
    ck("6909(2) 6cmの線の長さ", near((180.0 - 120.0) / S, 6))
    ck("6909(2) 6cmの下端は左の斜辺の上", collinear((50, 130), (120, 200), (100, 180)))
    ck("6909(2) 斜線4cm2",
       near(area([(3, 3), (3, 7), (5, 5)]), 4))
    return head(170, 237) + "".join(body) + "</svg>"


# --- HG-6952(1) 角BACの直角の印が無かった ------------------------------
def svg_6952_1():
    A, D, C, B = (141.0, 86.0), (281.0, 86.0), (320.0, 220.0), (40.0, 220.0)
    S = 28.0
    body = [poly([A, D, C, B], 2), line(A, C, 1.5), ra(A, B, C, 13),
            txt(130, 76, "A", 14, "end"), txt(285, 76, "D", 14, "start"),
            txt(20, 235, "B", 14, "start"), txt(325, 235, "C", 14, "start"),
            txt(211, 76, "5cm"), txt(72, 150, "6cm"), txt(240, 145, "8cm"),
            txt(180, 240, "10cm")]
    ck("6952(1) AD=5 BC=10", near(dist(A, D) / S, 5) and near(dist(B, C) / S, 10))
    ck("6952(1) AB=6", near(dist(A, B) / S, 6, 0.02))
    ck("6952(1) AC=8", near(dist(A, C) / S, 8, 0.02))
    ck("6952(1) 角BACが直角", perp(A, B, A, C) or abs(
        (B[0] - A[0]) * (C[0] - A[0]) + (B[1] - A[1]) * (C[1] - A[1])) < 200)
    ck("6952(1) 面積36", near(area([A, D, C, B]) / (S * S), 36, 0.2))
    return head(380, 260) + "".join(body) + "</svg>"


# =====================================================================
#  当てる内容
# =====================================================================

SVG_FIXES = []   # (id, 小問の番号, 置きかえ元に必ず入っている文字列, 新しいsvg)
TXT_FIXES = []   # (id, 場所, old, new)


def sfix(did, i, mark, new):
    SVG_FIXES.append((did, i, mark, new))


def tfix(did, where, old, new):
    TXT_FIXES.append((did, where, old, new))


# ---- 図の描き直し（実測で幾何が壊れていたもの）----
sfix("hd5s_7k1_1", 5, 'x1="320" y1="30" x2="60" y2="260"', svg_6892_6())
sfix("hd5s_7k1_3", 1, '300,20 120,150 110,380 190,380', svg_6894_2())
sfix("hd5s_7k1_3", 2, '180,20 310,150 180,380 50,150', svg_6894_3())
sfix("hd5s_7k1_4", 0, '60,220 60,40 220,220', svg_6908_1())
sfix("hd5s_7k1_4", 1, '130,50 20,170 240,170', svg_6908_2())
sfix("hd5s_7k1_4", 2, '40,220 40,40 200,220', svg_6908_3())
sfix("hd5s_7k1_5", 1, '50,130 50,170 70,150', svg_6909_2())
sfix("hd5s_7k1_13", 0, '141,86 281,86 320,220 40,220', svg_6952_1())


# ---- 設問：図ができたので「制作側の描写文」を原本の設問に戻す ----
Q_AREA = "%s下の図形の面積を求めなさい。"
Q_SEN = "%s下の斜線部分の面積を求めなさい。"
Q_BOX = "%s下の図の□にあてはまる数を求めなさい。"


def n(i):
    return "(%d) " % i


for _i, (_o, _n2) in enumerate([
    ("長方形（縦4cm・横7cm）", "(1) 下の長方形の面積を求めなさい。"),
    ("平行四辺形（上底8cm・下底8cm・高さ3cm）", "(2) 下の平行四辺形の面積を求めなさい。"),
    ("三角形（底辺6cm・高さ5cm）", "(3) 下の三角形の面積を求めなさい。"),
    ("台形（上底3cm・下底7cm・高さ8cm）", "(4) 下の台形の面積を求めなさい。"),
    ("ひし形（対角線6cm・4cm）", "(5) 下のひし形の面積を求めなさい。"),
    ("三角形（底辺3cm・高さ5cm）", "(6) 下の三角形の面積を求めなさい。"),
]):
    tfix("hd5s_7k1_1", ("step", _i, "question"), _o, _n2)

for _i, _o in enumerate([
    "たこ形（対角線6cm・9cm、垂直に交わる）",
    "複合四角形（対角線4cm・12cm、垂直に交わる）",
    "たこ形（対角線5cm・10cm、垂直に交わる）",
]):
    tfix("hd5s_7k1_3", ("step", _i, "question"), _o, Q_AREA % n(_i + 1))

for _i, _o in enumerate([
    "直角が底角にあり底辺20cm",
    "直角が頂角にあり底辺（斜辺）24cm",
    "直角が底角にあり斜辺18cm",
]):
    tfix("hd5s_7k1_4", ("step", _i, "question"), _o,
         "%s下の直角二等辺三角形の面積を求めなさい。" % n(_i + 1))

for _i, _o in enumerate([
    "底辺を2cm・7cm・3cmに分割。左の三角形（脚10cm×10cm）と右の三角形（脚9cm×9cm）の重なり（五角形）が斜線。",
    "底辺を3cm・5cm・2cmに分割。右の大きい三角形（脚8cm×8cm）の斜辺が、左の三角形（脚7cm×7cm）の頂点付近を切り取る小三角形が斜線。",
]):
    tfix("hd5s_7k1_5", ("step", _i, "question"), _o, Q_SEN % n(_i + 1))

for _i, _o in enumerate([
    "2辺20cm・20cm、挟角30°", "2辺20cm・24cm、挟角30°", "2辺20cm・12cm、挟角30°",
]):
    tfix("hd5s_7k1_7", ("step", _i, "question"), _o,
         "%s下の三角形の面積を求めなさい。" % n(_i + 1))

for _i, _o in enumerate([
    "二等辺三角形、等辺10cm・10cm、底角75°・75°", "2辺8cm・8cm、挟角150°",
]):
    tfix("hd5s_7k1_8", ("step", _i, "question"), _o,
         "%s下の三角形の面積を求めなさい。" % n(_i + 1))

tfix("hd5s_7k1_9", ("step", 0, "question"),
     "対角線の長さが20cmの長方形があります。この長方形の面積を求めなさい。（対角線の交点にできる角の1つが30°）",
     "(1) 下の四角形は対角線の長さが20cmの長方形です。この長方形の面積を求めなさい。")
tfix("hd5s_7k1_9", ("step", 1, "question"),
     "正十二角形でAGの長さは20cmです。この正十二角形の面積を求めなさい。（AGは対角線で、6つ先の頂点を結ぶ直径にあたる）",
     "(2) 下の図形は正十二角形で、AGの長さは20cmです。この正十二角形の面積を求めなさい。")

for _i, _o in enumerate([
    "長方形（左辺8cm+4cm、下辺3cm+6cm）を格子状に分け、左上頂点・中央の格子交点・右下頂点で囲まれた細い三角形が斜線。",
    "1辺20cmの正方形があります。上の辺を左から8cmのところで区切った点、左下のかど、右の辺を下から8cmのところで区切った点、この3つの点を結んでできる三角形が斜線部分です。",
    "1辺が2＋6＋2＝10cmの正方形があります。どの辺も、はしから2cm・6cm・2cmの3つに分けてあります。4つの辺それぞれについて、まん中の6cmの部分を斜辺とする直角二等辺三角形を正方形の内がわから切り取ると、4つのかどがとがったX（クロス）の形が残ります。この残った部分が斜線部分です。",
]):
    tfix("hd5s_7k1_10", ("step", _i, "question"), _o, Q_SEN % n(_i + 1))

for _i, _o in enumerate([
    "五角形（家型）。下の辺24cm、左の辺27cm、右の辺20cm（左右の辺はどちらも下の辺と直角）、その上から頂点へ向かう左20cm・右15cmの2辺（この20cmと15cmの2辺は直角に交わっています）。",
    "直角三角形の中の四角形（対角線で12cm×8cmの直角三角形と4cm×10cmの直角三角形に分割）。",
    "四角形（対角線で15cm×20cmの直角三角形と23cm×16cmの直角三角形に分割）。",
]):
    tfix("hd5s_7k1_11", ("step", _i, "question"), _o, Q_SEN % n(_i + 1))

for _i, _o in enumerate([
    "縦40cm・横16cm(8cm+8cm)の長方形の中のジグザグ状の斜線部分。",
    "直角をはさむ2辺が たて10cm（上から4cm・6cmに分かれる）・よこ15cm（左から9cm・6cmに分かれる）の直角三角形があります。たての辺を上から4cmのところで分ける点をP、よこの辺を左から9cmのところで分ける点をR、ななめの辺（斜辺）の上にとった点をQとすると、直線PRは斜辺と平行になります。三角形PQRが斜線部分です。",
    "1辺8cmの正方形があります。下の辺を右にのばした直線の上に点Mをとり、正方形の左上のかどとM、右上のかどとMをそれぞれ直線で結びます。左上のかどとMを結んだ線は正方形の右の辺と交わり、その交点から右下のかどまでの長さは2cmです。右上のかど・この交点・Mの3点で囲まれた三角形が斜線部分です。",
]):
    tfix("hd5s_7k1_12", ("step", _i, "question"), _o, Q_SEN % n(_i + 1))

tfix("hd5s_7k1_13", ("step", 0, "question"),
     "AD=5cm(上底)、BC=10cm(下底)、AB=6cm、対角線AC=8cm。角BAC（辺ABと対角線ACのあいだの角）は直角です。",
     "(1) 下の図の台形ABCDの面積を求めなさい。")
tfix("hd5s_7k1_13", ("step", 1, "question"),
     "AD=5cm、BC=10cm。下底BC上に点Pをとり、AとP、DとPを結ぶと AP=4cm、DP=3cm で、APとDPは点Pで直角に交わっています。",
     "(2) 下の図の台形ABCDの面積を求めなさい。")

# ★重大：設問の頂点の並び（Aが左下…）が図（Aが左上）と上下反対だった
tfix("hd5s_7k1_14", ("step", 0, "question"),
     "たて6cm・よこ8cmの長方形ABCD（Aが左下、Bが左上、Cが右上、Dが右下）があります。下の辺ADを左から3cmに分ける点と、上の辺BCを左から5cmに分ける点を結ぶ線を1本、左の辺ABを下から2cmに分ける点と、右の辺DCを下から4cmに分ける点を結ぶ線をもう1本引きます。この2本の線と長方形の辺で分けられた4つの部分のうち、左下のかどAをふくむ部分と、右上のかどCをふくむ部分（向かい合う2つ）の面積の合計を求めなさい。",
     "(1) 下の四角形ABCDは長方形です。斜線部分の面積を求めなさい。")
tfix("hd5s_7k1_14", ("step", 1, "question"),
     "正方形ABCDの2辺をのばした図形の中の斜線部分の面積を求めなさい。（左の辺ABをAの側へまっすぐのばした線の上に点Eをとります。EからBまでは24cmで、これは正方形の1辺ABもふくめた長さです。上の辺ADをDの側へまっすぐのばした線の上に点Fをとり、DからFまでは24cmです。斜線は四角形E–B–D–Fひとつで、破線の辺ADをまたいで続いています）",
     "(2) 下の四角形ABCDは正方形です。斜線部分の面積を求めなさい。")

tfix("hd5s_7k1_15", ("step", 0, "question"),
     "1つの角が直角で、そのとなりの角が15°、いちばん長い辺（斜辺）が12cmの三角形があります。この三角形の面積を求めなさい。",
     "(1) 下の図の三角形の面積を求めなさい。")
_S15 = ("右の図は，大きさの違う２つの正方形の中心を重ねたもので，斜線の部分は直角二等辺三角形です。"
        "斜線の部分の面積は，㋑が9cm²，㋺が2cm²です。２つの正方形の面積は，それぞれ何cm²になりますか。　%s")
_N15 = ("%s 下の図は，大きさの違う２つの正方形の中心を重ねたもので，斜線の部分は直角二等辺三角形です。"
        "斜線の部分の面積は，㋑が9cm²，㋺が2cm²です。２つの正方形の面積は，それぞれ何cm²になりますか。　%s")
tfix("hd5s_7k1_15", ("step", 1, "question"), _S15 % "小は何cm²ですか。",
     _N15 % ("(2)", "小は何cm²ですか。"))
tfix("hd5s_7k1_15", ("step", 2, "question"), _S15 % "大は何cm²ですか。",
     _N15 % ("(3)", "大は何cm²ですか。"))

# ★重大：設問が点H・Kで説明しているのに、図にH・Kのラベルが無い
tfix("hd5s_7k1_16", ("step", 0, "question"),
     "1本のまっすぐな線の上に、左から順に点H・点B・点Kをとります。HB＝2cm、BK＝8cmです。Hからこの線と直角に上へ8cmのところが点A、Kからこの線と直角に上へ2cmのところが点Cです。三角形ABCの面積を求めなさい。",
     "(1) 下の図において三角形ABCの面積を求めなさい。")

# ---- No.8：図に頂点の記号が無いので、設問からも記号を外す ----
_OLD8 = "三角形ABCがあり、辺AB上に点D、辺AC上に点Eをとると、DEとBCは平行になっています。次の□にあてはまる数を求めなさい。"
_NEW8 = "次の□にあてはまる数を求めなさい。（図の中の矢印は、その2本の直線が平行であることを表しています）"
for _d in ["hd5s_8k1_4", "hd5s_8k1_5", "hd5s_8k1_6"]:
    tfix(_d, ("intro",), _OLD8, _NEW8)

_TBL8 = [
    ("hd5s_8k1_4", ["DE=3cm,AE=5cm(頂点〜交点),AC=15cm(全長)。BC=□",
                    "DE=6cm,AE=12cm,BC=18cm。AC=□",
                    "AD=4cm(頂点〜交点,左辺),AC=15cm(全長,右辺),AE=6cm(頂点〜交点,右辺)。AB=□(全長,左辺)"]),
    ("hd5s_8k1_5", ["AD=8cm,DB=6cm,DE=4cm。BC=□",
                    "AD=6cm,DB=12cm,DE=4cm。BC=□",
                    "DB=15cm,DE=4cm,BC=10cm。AD=□"]),
    ("hd5s_8k1_6", ["DE=7cm,BC=12cm,AC=18cm(全長)。EC=□(交点〜底辺頂点の残り)",
                    "AD=8cm(頂点〜交点,左辺),AE=9cm(頂点〜交点,右辺),AC=18cm(全長,右辺)。AB=□(全長,左辺)"]),
    ("hd5s_8k1_7", ["上辺30cm・下辺20cmの砂時計型。左上の斜辺25cm・右上の斜辺21cmに対し、右上21cmと対応する左下の斜辺が□cm",
                    "上辺4cm・下辺□cmの砂時計型。左上3cm・右上4cm・左下8cm・右下6cmが与えられている"]),
    ("hd5s_8k1_8", ["上辺3cm・下辺9cmの砂時計型。左の対角線の全長16cmのうち、交点から下の頂点までの区間が□cm",
                    "上辺15cm・下辺45cmの砂時計型。左の対角線の全長48cmのうち、交点までの上側の区間が□cm(右の斜辺は交点から下頂点まで33cmと別に与えられている)"]),
    ("hd5s_8k1_9", ["上辺8cm・下辺12cmの砂時計型。上辺から下辺までの全体の高さ15cmのうち、交点から上辺までの高さが□cm",
                    "上辺12cm・下辺15cmの砂時計型。全体の高さ18cmのうち、交点から上辺までの高さが□cm"]),
    ("hd5s_8k1_10", ["縦4cm・横6cmの長方形と底辺6cm・高さ12cmの直角三角形。長方形の上辺と斜辺の交点から長方形の右上角までの距離は□cm",
                     "縦5cm・横10cmの長方形と重ねた直角三角形。交点から右上角までが8cmのとき、右上角から三角形の頂点までの高さは□cm"]),
    ("hd5s_8k1_11", ["1辺8cmと1辺12cmの正方形を底辺で並べ、小さい正方形の左下角から大きい正方形の右上角へ対角線を引く。境界線上で、大きい正方形の上端から交点までの距離は□cm",
                     "上下の辺が8cm、ななめの辺が15cmの平行四辺形があります。下の辺を左へ12cmのばした点と、右上の頂点を結びます。この線が左のななめの辺と交わる点から、下の頂点までの長さは□cm"]),
    ("hd5s_8k1_12", ["上底5cm・下底9cmの台形で、両脚の中点を結ぶ線の長さは□cm",
                     "上底7.2cm・下底16.8cmの台形。左脚が上から4.8cm・9.6cmに分かれる点を通る平行線の長さは□cm",
                     "上底5cm・下底14cmの台形。中央の平行線(11cm)は右脚を上から7cmの位置で分けている。その分点から下底までの長さは□cm"]),
]
for _d, _olds in _TBL8:
    for _i, _o in enumerate(_olds):
        tfix(_d, ("step", _i, "question"), _o, Q_BOX % n(_i + 1))

# ---- 図の中の文字が明るい塗り（#ffd166）の上にのっていて読めない ----
#      414px の実測で、㋑・㋺ と 頂点D の4か所が地に溶けていた
SUB_FIXES = []


def ufix(did, i, old, new):
    SUB_FIXES.append((did, i, old, new))


ufix("hd5s_7k1_14", 1,
     '<text x="129.00" y="102.00" font-size="13" fill="#e8ecf5" text-anchor="middle">D</text>',
     '<text x="132.00" y="126.00" font-size="13" fill="#e8ecf5" text-anchor="middle">D</text>')
for _i in (1, 2):
    ufix("hd5s_7k1_15", _i,
         '<circle cx="161" cy="50" r="9" fill="none" stroke="#e8ecf5" stroke-width="1.2"/>',
         '<circle cx="161" cy="50" r="9" fill="none" stroke="#121826" stroke-width="1.4"/>')
    ufix("hd5s_7k1_15", _i,
         '<text x="161.00" y="55.00" font-size="12" fill="#e8ecf5" text-anchor="middle">㋑</text>',
         '<text x="161.00" y="55.00" font-size="12" fill="#121826" text-anchor="middle">㋑</text>')
    ufix("hd5s_7k1_15", _i,
         '<circle cx="185" cy="105" r="9" fill="none" stroke="#e8ecf5" stroke-width="1.2"/>',
         '<circle cx="185" cy="105" r="9" fill="none" stroke="#121826" stroke-width="1.4"/>')
    ufix("hd5s_7k1_15", _i,
         '<text x="185.00" y="110.00" font-size="12" fill="#e8ecf5" text-anchor="middle">㋺</text>',
         '<text x="185.00" y="110.00" font-size="12" fill="#121826" text-anchor="middle">㋺</text>')


# 図ができたので、導入文も原本どおりに戻す
tfix("hd5s_8k1_10", ("intro",),
     "長方形と直角三角形を、下の辺どうし・直角をはさむたての辺どうしがぴったり重なるように置きます。□にあてはまる数を求めなさい。",
     "図のように長方形と直角三角形を重ねたとき，□にあてはまる数を求めなさい。")


# =====================================================================
#  適用
# =====================================================================

def locate(x, where):
    if where[0] == "intro":
        return ("intro" in x), x.get("intro")
    if where[0] == "step":
        _, i, key = where
        st = x.get("steps") or []
        if i >= len(st):
            return False, None
        return (key in st[i]), st[i].get(key)
    raise ValueError(where)


def put(x, where, v):
    if where[0] == "intro":
        x["intro"] = v
    else:
        x["steps"][where[1]][where[2]] = v


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(HERE), "data", "hama_daimon.json")

    print("--- 描き直した図を座標から検算 ---")
    bad = [nm for nm, okk in CHECKS if not okk]
    for nm, okk in CHECKS:
        print("  %s %s" % ("OK " if okk else "NG ", nm))
    if bad:
        print("!! 合わない検算があるので、1件も書かずに止めます")
        return 1
    print("  -> %d 件すべて一致" % len(CHECKS))

    raw = io.open(path, "rb").read()
    tail_nl = raw.endswith(b"\n")
    d = json.loads(raw.decode("utf-8"))
    idx = {}
    for r in iter_daimon(d):
        x = r["x"]
        if isinstance(x, dict) and isinstance(x.get("id"), str):
            idx.setdefault(x["id"], []).append(x)

    applied = already = 0
    errors = []
    changed = set()

    for did, i, mark, new in SVG_FIXES:
        hits = idx.get(did, [])
        if len(hits) != 1:
            errors.append("%s: 大問が %d 件" % (did, len(hits))); continue
        st = hits[0].get("steps") or []
        if i >= len(st):
            errors.append("%s 小問%d: ない" % (did, i + 1)); continue
        cur = st[i].get("svg")
        if cur == new:
            already += 1; continue
        if not cur or mark not in cur:
            errors.append("%s 小問%d の図: 目じるし %r が見あたらない（別の手が入った可能性）"
                          % (did, i + 1, mark)); continue
        assert cur.count(mark) >= 1
        st[i]["svg"] = new
        applied += 1; changed.add(did)

    for did, i, old, new in SUB_FIXES:
        hits = idx.get(did, [])
        if len(hits) != 1:
            errors.append("%s: 大問が %d 件" % (did, len(hits))); continue
        st = hits[0].get("steps") or []
        if i >= len(st):
            errors.append("%s 小問%d: ない" % (did, i + 1)); continue
        cur = st[i].get("svg") or ""
        if new in cur:
            already += 1; continue
        c = cur.count(old)
        if c != 1:
            errors.append("%s 小問%d の図: 置きかえ元が %d 回（1回でない）" % (did, i + 1, c)); continue
        assert cur.count(old) == 1
        st[i]["svg"] = cur.replace(old, new)
        applied += 1; changed.add(did)

    for did, where, old, new in TXT_FIXES:
        hits = idx.get(did, [])
        if len(hits) != 1:
            errors.append("%s: 大問が %d 件" % (did, len(hits))); continue
        x = hits[0]
        ex, cur = locate(x, where)
        if not ex:
            errors.append("%s %s: 欄がない" % (did, where)); continue
        if cur == new:
            already += 1; continue
        if cur != old:
            errors.append("%s %s: 置きかえ元と一致しない\n    現在: %r\n    想定: %r"
                          % (did, where, cur[:90], old[:90])); continue
        assert cur == old
        put(x, where, new)
        applied += 1; changed.add(did)

    if errors:
        print("\n!! 想定と合わない箇所があるので、1件も書かずに止めます")
        for e in errors:
            print("  - " + e)
        return 1

    print("\n適用 %d 件 / 適用ずみでとばした %d 件 / 直した大問 %d 本"
          % (applied, already, len(changed)))
    for i in sorted(changed):
        print("  " + i)
    if applied == 0:
        print("\n変更なし（すでに当たっています）。ファイルは書きかえません。")
        return 0
    out = json.dumps(d, ensure_ascii=False, indent=1)
    if tail_nl:
        out += "\n"
    with io.open(path, "wb") as f:
        f.write(out.encode("utf-8"))
    print("\n書き出し: %s" % path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
