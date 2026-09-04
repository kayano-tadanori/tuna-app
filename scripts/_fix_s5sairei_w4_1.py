# -*- coding: utf-8 -*-
u"""小5最レ 第3分冊 第1講座（No.26 大問13〜16 ／ No.27 大問1〜10）の内容監査パッチ。

  監査資料: docs/_audit/s5sairei_w4/audit_1.txt
  所見:     docs/_audit/s5sairei_w4/findings_1.md

  直すもの
    ・図SVG …… 図が答えと食いちがう10本を、原本PDF（浜問題/5年算数最レ/
                 5年_小5最レ算数_第3分冊_第1講座.pdf 本文p37-40）どおりに作り直す。
                 入れる前にかならず座標から面積比・辺の長さ・角度を計算して
                 問題文と答えに合うか検算する（合わなければ AssertionError で止まる）。
    ・intro／解説 …… 原簿の記号（オ・●▲・⑨＝3 など図に無いもの）や、
                 内部で食いちがっている文を、小5の道具だけで書き直す。

  冪等性: 欄まるごとの一致で判定する。
    ・文字欄は cur == new なら「済み」、cur == old なら適用、どちらでもなければ止める。
    ・図SVGは長いので old の md5 で同じ判定をする（欄まるごとの一致には変わりない）。

  使い方: python scripts/_fix_s5sairei_w4_1.py [対象JSON]   （省略時 data/hama_daimon.json）
"""
import io, json, os, sys, hashlib, math

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon

# ---------------------------------------------------------------- 図をかく道具
STROKE = "#4f9eff"; TXT = "#c9d4f0"; HI = "#ffd166"; DIM = "#9aa3c0"
SHADE = "rgba(255,209,102,0.22)"


def head(vb):
    return ('<svg viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg"'
            ' style="display:block;margin:0 auto;max-width:100%">')


def n(v):
    s = ("%.2f" % float(v)).rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def pstr(ps):
    return " ".join("%s,%s" % (n(x), n(y)) for x, y in ps)


def polygon(ps, fill="none", stroke=STROKE, w="1.8"):
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (pstr(ps), fill, stroke, w)


def line(a, b, col=STROKE, w="1.6"):
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"/>' % (
        n(a[0]), n(a[1]), n(b[0]), n(b[1]), col, w)


def text(p, s, size=12, anchor="middle", col=TXT):
    return '<text x="%s" y="%s" font-size="%d" text-anchor="%s" fill="%s">%s</text>' % (
        n(p[0]), n(p[1]), size, anchor, col, s)


def dot(p, col=TXT):
    return '<circle cx="%s" cy="%s" r="3" fill="%s"/>' % (n(p[0]), n(p[1]), col)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def xline(p1, p2, p3, p4):
    u"""直線p1p2 と 直線p3p4 の交点。"""
    x1, y1 = p1; x2, y2 = p2; x3, y3 = p3; x4, y4 = p4
    d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(d) < 1e-12:
        raise AssertionError(u"平行な2直線の交点は取れない")
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


def area(ps):
    s = 0.0
    for i in range(len(ps)):
        x1, y1 = ps[i]; x2, y2 = ps[(i + 1) % len(ps)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def rd(ps):
    u"""実際にSVGへ書き出す丸めた座標。検算はこの値で行う。"""
    return [(float(n(x)), float(n(y))) for x, y in ps]


def vdim(x, y1, y2, label, tx):
    return "".join([
        line((x, y1), (x, y2), DIM, "1.1"),
        line((x + 3.5, y1), (x - 3.5, y1), DIM, "1.1"),
        line((x + 3.5, y2), (x - 3.5, y2), DIM, "1.1"),
        text((tx, (y1 + y2) / 2.0 + 4), label, 11),
    ])


def hdim(y, x1, x2, label, ty):
    return "".join([
        line((x1, y), (x2, y), DIM, "1.1"),
        line((x1, y - 3.5), (x1, y + 3.5), DIM, "1.1"),
        line((x2, y - 3.5), (x2, y + 3.5), DIM, "1.1"),
        text(((x1 + x2) / 2.0, ty), label, 11),
    ])


CHECKS = []


def ck(name, got, want, tol=0.004):
    u"""図から出した値が、問題文・答えと合うか。合わなければ止める。"""
    CHECKS.append((name, got, want))
    lim = tol * abs(want) if want != 0 else tol
    if abs(got - want) > lim:
        raise AssertionError(u"図の検算が合わない: %s = %r （そうあるべき %r）" % (name, got, want))


# ---------------------------------------------------------------- 図
def svg_27k1_1():
    u"""HG-3718 長方形の中の細長い斜線部。AF・ED・EC・BF の4本と 斜線EPFQ。"""
    A = (60, 40); D = (300, 40); C = (300, 180); B = (60, 180)
    E = (60, 145); F = (300, 110)          # AE=3cm(105px) EB=1cm(35px) / DF=FC=2cm(70px)
    ck(u"HG-3718 AE:EB", (E[1] - A[1]) / (B[1] - E[1]), 3.0)
    ck(u"HG-3718 DF:FC", (F[1] - D[1]) / (C[1] - F[1]), 1.0)
    P = xline(A, F, E, D)                  # ちょうちょう AE:DF=3:2
    Q = xline(E, C, B, F)                  # ちょうちょう EB:CF=1:2
    sh = rd([E, P, F, Q])
    ck(u"HG-3718 斜線/長方形", area(sh) / area(rd([A, D, C, B])), 7.0 / 30.0)
    ck(u"HG-3718 三角形EPF/三角形AEF", area(rd([E, P, F])) / area(rd([A, E, F])), 2.0 / 5.0)
    ck(u"HG-3718 三角形EQF/三角形EBF", area(rd([E, Q, F])) / area(rd([E, B, F])), 2.0 / 3.0)
    s = [head("0 0 360 230"), polygon([A, D, C, B]),
         text((54, 34), "A", 12, "end"), text((306, 34), "D", 12, "start"),
         text((54, 196), "B", 12, "end"), text((306, 196), "C", 12, "start"),
         line(A, F), line(E, D), line(E, C), line(B, F),
         dot(E), text((52, 149), "E", 12, "end"), dot(F), text((310, 114), "F", 12, "start"),
         polygon(sh, SHADE, HI),
         dot(P, HI), text((P[0] + 6, P[1] - 8), "P", 11, "start"),
         dot(Q, HI), text((Q[0] - 6, Q[1] + 15), "Q", 11, "end"),
         vdim(44, 40, 145, "3cm", 31.2), vdim(44, 145, 180, "1cm", 31.2),
         vdim(316, 40, 110, "2cm", 328.8), vdim(316, 110, 180, "2cm", 328.8),
         "</svg>"]
    return "".join(s)


def svg_27k1_2():
    u"""HG-3719 AF・BG・CH・DE の4本と、まん中の小さな平行四辺形。"""
    A = (60, 40); D = (300, 40); C = (300, 170); B = (60, 170)
    E = lerp(A, B, 2.0 / 3.0); F = lerp(B, C, 2.0 / 3.0)
    G = lerp(C, D, 2.0 / 3.0); H = lerp(D, A, 2.0 / 3.0)
    P = xline(A, F, D, E); Q = xline(A, F, B, G)
    Q2 = xline(C, H, B, G); P2 = xline(C, H, D, E)
    sh = rd([P, Q, Q2, P2])
    rect = area(rd([A, D, C, B]))
    ck(u"HG-3719 斜線/長方形", area(sh) / rect, 1.0 / 13.0)
    ck(u"HG-3719 四角形AFCH/長方形", area(rd([A, F, C, H])) / rect, 1.0 / 3.0)
    ck(u"HG-3719 AP:AF", (P[0] - A[0]) / (F[0] - A[0]), 6.0 / 13.0)
    ck(u"HG-3719 AQ:AF", (Q[0] - A[0]) / (F[0] - A[0]), 9.0 / 13.0)
    s = [head("0 0 360 215"), polygon([A, D, C, B]),
         text((54, 34), "A", 12, "end"), text((306, 34), "D", 12, "start"),
         text((54, 186), "B", 12, "end"), text((306, 186), "C", 12, "start"),
         line(A, F), line(B, G), line(C, H), line(D, E),
         dot(E), text((52, E[1] + 4), "E", 12, "end"),
         dot(F), text((F[0], 186), "F", 12, "middle"),
         dot(G), text((310, G[1] + 4), "G", 12, "start"),
         dot(H), text((H[0], 32), "H", 12, "middle"),
         polygon(sh, SHADE, HI),
         dot(P, HI), text((P[0] - 6, P[1] - 4), "P", 11, "end"),
         dot(Q, HI), text((Q[0] - 6, Q[1] + 13), "Q", 11, "end"),
         text((180, 200), u"AE:EB＝BF:FC＝CG:GD＝DH:HA＝2:1", 10, "middle", DIM),
         "</svg>"]
    return "".join(s)


def svg_27k1_3():
    u"""HG-3720 AC・AF・ED・BF の4本と 斜線（P・AFとEDの交点・F・Q）。"""
    A = (60, 40); D = (300, 40); C = (300, 175); B = (60, 175)
    E = lerp(A, B, 0.5); F = lerp(D, C, 0.5)
    P = xline(A, C, E, D); Q = xline(A, C, B, F); R = xline(A, F, E, D)
    ck(u"HG-3720 PはACの1/3", (P[0] - A[0]) / (C[0] - A[0]), 1.0 / 3.0)
    ck(u"HG-3720 QはACの2/3", (Q[0] - A[0]) / (C[0] - A[0]), 2.0 / 3.0)
    ck(u"HG-3720 RはAFのまん中", (R[0] - A[0]) / (F[0] - A[0]), 0.5)
    sh = rd([P, R, F, Q])
    ck(u"HG-3720 斜線/長方形", area(sh) / area(rd([A, D, C, B])), 1.0 / 8.0)
    s = [head("0 0 360 225"), polygon([A, D, C, B]),
         text((54, 34), "A", 12, "end"), text((306, 34), "D", 12, "start"),
         text((54, 191), "B", 12, "end"), text((306, 191), "C", 12, "start"),
         line(A, C), line(A, F), line(E, D), line(B, F),
         dot(E), text((52, E[1] + 4), "E", 12, "end"),
         dot(F), text((310, F[1] + 4), "F", 12, "start"),
         polygon(sh, SHADE, HI), dot(R, HI),
         dot(P, HI), text((P[0] - 6, P[1] - 7), "P", 11, "end"),
         dot(Q, HI), text((Q[0] + 4, Q[1] + 13), "Q", 11, "start"),
         text((180, 210), u"E・FはAB・DCの中点／P・QはACの3等分点", 10, "middle", DIM),
         "</svg>"]
    return "".join(s)


def svg_27k1_4():
    u"""HG-3721 対角線BD と AE・AF。斜線は五角形GHFCE。"""
    A = (60, 40); D = (280, 40); C = (280, 170); B = (60, 170)
    E = lerp(B, C, 2.0 / 3.0); F = lerp(C, D, 2.0 / 3.0)
    G = xline(A, E, B, D); H = xline(A, F, B, D)
    sh = rd([G, H, F, C, E])
    ck(u"HG-3721 斜線/長方形", area(sh) / area(rd([A, D, C, B])), 13.0 / 40.0)
    ck(u"HG-3721 三角形BGE/三角形DBC", area(rd([B, G, E])) / area(rd([D, B, C])), 4.0 / 15.0)
    ck(u"HG-3721 三角形DHF/三角形DBC", area(rd([D, H, F])) / area(rd([D, B, C])), 1.0 / 12.0)
    s = [head("0 0 340 215"), polygon([A, D, C, B]),
         text((54, 34), "A", 12, "end"), text((286, 34), "D", 12, "start"),
         text((54, 186), "B", 12, "end"), text((286, 186), "C", 12, "start"),
         line(B, D), line(A, E), line(A, F),
         dot(E), text((E[0], 186), "E", 12, "middle"),
         dot(F), text((290, F[1] + 4), "F", 12, "start"),
         polygon(sh, SHADE, HI),
         dot(G, HI), text((G[0] - 8, G[1] + 4), "G", 11, "end"),
         dot(H, HI), text((H[0] + 3, H[1] - 6), "H", 11, "start"),
         text((170, 202), u"BE:EC＝CF:FD＝2:1", 10, "middle", DIM),
         "</svg>"]
    return "".join(s)


def svg_27k1_5():
    u"""HG-3722 6つの角が120度の六角形。辺は FA=3 AB=4 BC=5 CD=6 DE=1 EF=8。"""
    s3 = math.sqrt(3.0); sc = 20.0
    A = (115.0, 45.0)
    B = (A[0] - 2 * sc, A[1] + 2 * s3 * sc)
    C = (B[0] + 2.5 * sc, B[1] + 2.5 * s3 * sc)
    D = (C[0] + 6 * sc, C[1])
    E = (D[0] + 0.5 * sc, D[1] - 0.5 * s3 * sc)
    F = (E[0] - 4 * sc, E[1] - 4 * s3 * sc)
    ck(u"HG-3722 六角形が閉じるx", F[0] - 3 * sc, A[0], 1e-6)
    ck(u"HG-3722 六角形が閉じるy", F[1], A[1], 1e-6)
    P = rd([A, B, C, D, E, F])
    dist = lambda p, q: math.hypot(q[0] - p[0], q[1] - p[1])
    for nm, p, q, want in [("FA", F, A, 3), ("AB", A, B, 4), ("BC", B, C, 5),
                           ("CD", C, D, 6), ("DE", D, E, 1), ("EF", E, F, 8)]:
        ck(u"HG-3722 辺%s(cm)" % nm, dist(rd([p, q])[0], rd([p, q])[1]) / sc, float(want), 0.01)
    for i in range(6):
        u1 = (P[i - 1][0] - P[i][0], P[i - 1][1] - P[i][1])
        u2 = (P[(i + 1) % 6][0] - P[i][0], P[(i + 1) % 6][1] - P[i][1])
        cs = (u1[0] * u2[0] + u1[1] * u2[1]) / (math.hypot(*u1) * math.hypot(*u2))
        ck(u"HG-3722 内角%d(度)" % i, math.degrees(math.acos(max(-1.0, min(1.0, cs)))), 120.0, 0.002)
    cx = sum(p[0] for p in P) / 6.0; cy = sum(p[1] for p in P) / 6.0
    body = [head("0 20 330 230"), polygon([A, F, E, D, C, B])]
    for p, nm, dx, dy, a in [(A, "A", -7, -8, "end"), (F, "F", 7, -8, "start"),
                             (E, "E", 9, 1, "start"), (D, "D", 6, 16, "start"),
                             (C, "C", -6, 16, "end"), (B, "B", -9, 2, "end")]:
        body.append(text((p[0] + dx, p[1] + dy), nm, 12, a))
    for p, q, lab in [(F, A, "3cm"), (A, B, "4cm"), (B, C, "5cm"), (C, D, "6cm")]:
        m = ((p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0)
        dx = m[0] - cx; dy = m[1] - cy; L = math.hypot(dx, dy)
        a = "middle" if abs(dx) / L < 0.45 else ("end" if dx < 0 else "start")
        body.append(text((m[0] + dx / L * 20, m[1] + dy / L * 20 + 4), lab, 11, a))
    body.append(text((165, 240), u"6つの角はどれも120度", 10, "middle", DIM))
    body.append("</svg>")
    return "".join(body)


def svg_27k1_6():
    u"""HG-3723 一辺12cmの正方形。AEとBFの交点G、斜線は四角形BGEC。"""
    sz = 135.0
    A = (90, 40); D = (90 + sz, 40); C = (90 + sz, 40 + sz); B = (90, 40 + sz)
    F = lerp(A, D, 2.0 / 3.0)      # AF:FD=2:1
    E = lerp(D, C, 0.5)            # CE:ED=1:1
    G = xline(A, E, B, F)
    ck(u"HG-3723 正方形のたてよこの差", (D[0] - A[0]) - (B[1] - A[1]), 0.0, 1e-9)
    ck(u"HG-3723 Gのたて位置(cm)", (G[1] - A[1]) / sz * 12.0, 3.0)
    ck(u"HG-3723 Gのよこ位置(cm)", (G[0] - A[0]) / sz * 12.0, 6.0)
    ck(u"HG-3723 斜線(cm2)", area(rd([B, G, E, C])) / (sz * sz) * 144.0, 72.0)
    s = [head("0 -0.5 330 215.5"), polygon([A, D, C, B]),
         text((84, 34), "A", 12, "end"), text((D[0] + 6, 34), "D", 12, "start"),
         text((84, 191), "B", 12, "end"), text((C[0] + 6, 191), "C", 12, "start"),
         dot(F), text((F[0], 32), "F", 12, "middle"),
         dot(E), text((E[0] + 10, E[1] + 4), "E", 12, "start"),
         line(A, E), line(B, F),
         polygon(rd([B, G, E, C]), SHADE, HI),
         dot(G, HI), text((G[0] - 8, G[1] - 4), "G", 11, "end"),
         hdim(24, A[0], D[0], "12cm", 15.2),
         text(((A[0] + D[0]) / 2.0, 205), u"CE:ED＝1:1、AF:FD＝2:1", 10, "middle", DIM),
         "</svg>"]
    return "".join(s)


def svg_27k1_7():
    u"""HG-3724 面積が等しい5つの三角形（折れ線 B-D-P-E-Q）。"""
    A = (60, 40); B = (60, 150); C = (320, 150)
    D = lerp(A, C, 0.2); E = lerp(A, C, 7.0 / 15.0)
    P = lerp(B, C, 0.25); Q = lerp(B, C, 0.625)
    S = area(rd([A, B, C]))
    for nm, t in [("ABD", [A, B, D]), ("BDP", [B, D, P]), ("DPE", [D, P, E]),
                  ("PEQ", [P, E, Q]), ("EQC", [E, Q, C])]:
        ck(u"HG-3724 三角形%s/全体" % nm, area(rd(t)) / S, 0.2, 0.006)
    ck(u"HG-3724 AD:DE:EC の AD", (D[0] - A[0]) / (C[0] - A[0]), 3.0 / 15.0)
    ck(u"HG-3724 AD:DE:EC の AE", (E[0] - A[0]) / (C[0] - A[0]), 7.0 / 15.0)
    s = [head("0 0 350 190.3"), polygon([A, B, C]),
         text((54, 34), "A", 12, "end"), text((54, 166), "B", 12, "end"),
         text((328, 166), "C", 12, "start"),
         dot(D), text((D[0], D[1] - 9), "D", 12, "middle"),
         dot(E), text((E[0] + 4, E[1] - 7), "E", 12, "start"),
         dot(P), text((P[0], 166), "P", 12, "middle"),
         dot(Q), text((Q[0], 166), "Q", 12, "middle"),
         line(B, D), line(D, P), line(P, E), line(E, Q),
         text((190, 182), u"面積が等しい5つの三角形に分けた図", 10, "middle", DIM),
         "</svg>"]
    return "".join(s)


def svg_27k1_8():
    u"""HG-3725 56cm²を5つに分ける（折れ線 B-D-P-E-Q）。"""
    A = (70, 45); B = (70, 155); C = (330, 155)
    D = lerp(A, C, 0.25); E = lerp(A, C, 7.0 / 12.0)
    P = lerp(B, C, 5.0 / 14.0); Q = lerp(B, C, 26.0 / 35.0)
    S = area(rd([A, B, C]))
    want = [("ABD", [A, B, D], 14), ("BDP", [B, D, P], 15), ("DPE", [D, P, E], 12),
            ("PEQ", [P, E, Q], 9), ("EQC", [E, Q, C], 6)]
    for nm, t, w in want:
        ck(u"HG-3725 三角形%s(cm2)" % nm, area(rd(t)) / S * 56.0, float(w), 0.006)
    ck(u"HG-3725 AD:EC", ((D[0] - A[0]) / (C[0] - A[0])) / ((C[0] - E[0]) / (C[0] - A[0])), 3.0 / 5.0)
    cen = lambda t: (sum(p[0] for p in t) / 3.0, sum(p[1] for p in t) / 3.0 + 4)
    s = [head("0 0 360 200.4"), polygon([A, B, C]),
         text((64, 39), "A", 12, "end"), text((64, 171), "B", 12, "end"),
         text((338, 171), "C", 12, "start"),
         dot(D), text((D[0], D[1] - 9), "D", 12, "middle"),
         dot(E), text((E[0] + 4, E[1] - 7), "E", 12, "start"),
         dot(P), text((P[0], 171), "P", 12, "middle"),
         dot(Q), text((Q[0], 171), "Q", 12, "middle"),
         line(B, D), line(D, P), line(P, E), line(E, Q)]
    for nm, t, w in want:
        s.append(text(cen(t), u"%dcm²" % w, 11))
    s.append(text((190, 192), u"三角形ABCの面積は56cm²", 10, "middle", DIM))
    s.append("</svg>")
    return "".join(s)


def svg_27k1_9():
    u"""HG-3726 三角形ABCを折れ線C-D-E-…-Lで10等分。ABは16cm。"""
    A = (55, 155); B = (320, 155); C = (300, 45)
    px = (B[0] - A[0]) / 16.0
    D, F, H, J, L = [(A[0] + v * px, A[1]) for v in (14.4, 12.6, 10.5, 7.875, 3.9375)]
    E, G, I, K = [lerp(A, C, v) for v in (8.0 / 9, 16.0 / 21, 64.0 / 105, 128.0 / 315)]
    S = area(rd([A, B, C]))
    tri = [("BCD", [B, C, D]), ("CDE", [C, D, E]), ("DEF", [D, E, F]), ("EFG", [E, F, G]),
           ("FGH", [F, G, H]), ("GHI", [G, H, I]), ("HIJ", [H, I, J]), ("IJK", [I, J, K]),
           ("JKL", [J, K, L]), ("KLA", [K, L, A])]
    for nm, t in tri:
        ck(u"HG-3726 三角形%s/全体" % nm, area(rd(t)) / S, 0.1, 0.008)
    ck(u"HG-3726 FH(cm)", (rd([F])[0][0] - rd([H])[0][0]) / px, 2.1)
    ck(u"HG-3726 AB(cm)", (B[0] - A[0]) / px, 16.0)
    s = [head("0 0 360 214.6"), polygon([A, B, C]),
         text((49, 171), "A", 12, "end"), text((328, 171), "B", 12, "start"),
         text((304, 38), "C", 12, "start")]
    for p, nm in [(L, "L"), (J, "J"), (H, "H"), (F, "F"), (D, "D")]:
        s += [dot(p), text((p[0], 171), nm, 11, "middle")]
    for p, nm in [(K, "K"), (I, "I"), (G, "G"), (E, "E")]:
        s += [dot(p, HI), text((p[0] - 5, p[1] - 6), nm, 11, "end")]
    for a, b in [(C, D), (D, E), (E, F), (F, G), (G, H), (H, I), (I, J), (J, K), (K, L)]:
        s.append(line(a, b))
    s.append(hdim(181, A[0], B[0], "16cm", 205.8))
    s.append("</svg>")
    return "".join(s)


def svg_27k1_10():
    u"""HG-3727 AD・BE・CFが1点で交わる3つの図。辺比どおりの位置に点をとる。"""
    conf = [((85, 40), (30, 150), (140, 150), "(1)", (3, 2), (1, 1), (3, 2),
             ["3", "2", "1", "1", "x", "y"]),
            ((240, 40), (185, 150), (295, 150), "(2)", (2, 5), (10, 3), (4, 3),
             ["2", "5", "x", "y", "4", "3"]),
            ((395, 40), (340, 150), (450, 150), "(3)", (35, 12), (6, 5), (7, 2),
             ["x", "y", "6", "5", "7", "2"])]
    s = [head("0 0 470 185")]
    for A, B, C, ttl, afb, bdc, aec, labs in conf:
        F = lerp(A, B, float(afb[0]) / (afb[0] + afb[1]))
        D = lerp(B, C, float(bdc[0]) / (bdc[0] + bdc[1]))
        E = lerp(A, C, float(aec[0]) / (aec[0] + aec[1]))
        P = xline(A, D, B, E); P2 = xline(A, D, C, F)
        ck(u"HG-3727 %s 3本が1点で交わるx" % ttl, P[0], P2[0], 1e-6)
        ck(u"HG-3727 %s 3本が1点で交わるy" % ttl, P[1], P2[1], 1e-6)
        ck(u"HG-3727 %s AF:FB" % ttl,
           math.hypot(F[0] - A[0], F[1] - A[1]) / math.hypot(B[0] - F[0], B[1] - F[1]),
           float(afb[0]) / afb[1])
        ck(u"HG-3727 %s BD:DC" % ttl, (D[0] - B[0]) / (C[0] - D[0]), float(bdc[0]) / bdc[1])
        ck(u"HG-3727 %s AE:EC" % ttl,
           math.hypot(E[0] - A[0], E[1] - A[1]) / math.hypot(C[0] - E[0], C[1] - E[1]),
           float(aec[0]) / aec[1])
        cx = (A[0] + B[0] + C[0]) / 3.0; cy = (A[1] + B[1] + C[1]) / 3.0
        s += [text((B[0] - 8, 26), ttl, 12, "start"), polygon([A, B, C]),
              line(A, D), line(B, E), line(C, F),
              dot(F), dot(D), dot(E), dot(P, HI),
              text((F[0] - 9, F[1]), "F", 11, "end"), text((D[0], 166), "D", 11, "middle"),
              text((E[0] + 9, E[1]), "E", 11, "start"), text((A[0], 32), "A", 11, "middle"),
              text((B[0] - 8, 164), "B", 11, "end"), text((C[0] + 8, 164), "C", 11, "start")]
        for k, ((p, q), lab) in enumerate(zip([(A, F), (F, B), (B, D), (D, C), (A, E), (E, C)], labs)):
            m = ((p[0] + q[0]) / 2.0, (p[1] + q[1]) / 2.0)
            if k in (2, 3):          # 底辺BC上の2つは、B・D・Cのラベルとぶつからない高さにそろえる
                s.append(text((m[0], 179), lab, 11, "middle", HI))
                continue
            dx = m[0] - cx; dy = m[1] - cy; L = math.hypot(dx, dy) or 1.0
            a = "middle" if abs(dx) / L < 0.4 else ("end" if dx < 0 else "start")
            s.append(text((m[0] + dx / L * 18, m[1] + dy / L * 18 + 4), lab, 11, a, HI))
    s.append("</svg>")
    return "".join(s)


SVG_OLD_MD5 = {
    "hd5s_27k1_1":  "78286c936dee33bcc768994e5435078f",
    "hd5s_27k1_2":  "f871ad514e11894754ccad1a784bd1fb",
    "hd5s_27k1_3":  "9c190f5306a4c5542acf017ff55f3697",
    "hd5s_27k1_4":  "df2bc9d297f891f68d1ef8c345666665",
    "hd5s_27k1_5":  "30ab6a314808646b886a9507ea44549e",
    "hd5s_27k1_6":  "fe5ff2864627810d49883c65dc745299",
    "hd5s_27k1_7":  "86bcfe095732d8c1e66f492aa1d9e546",
    "hd5s_27k1_8":  "3e1d06c1398dc9013f350981bec84572",
    "hd5s_27k1_9":  "1f04f6f863394ebc72e20f2404521838",
    "hd5s_27k1_10": "c80fb085f32686e1cdd92cf5604b6ed5",
}
SVG_NEW = {
    "hd5s_27k1_1": svg_27k1_1, "hd5s_27k1_2": svg_27k1_2, "hd5s_27k1_3": svg_27k1_3,
    "hd5s_27k1_4": svg_27k1_4, "hd5s_27k1_5": svg_27k1_5, "hd5s_27k1_6": svg_27k1_6,
    "hd5s_27k1_7": svg_27k1_7, "hd5s_27k1_8": svg_27k1_8, "hd5s_27k1_9": svg_27k1_9,
    "hd5s_27k1_10": svg_27k1_10,
}

# ---------------------------------------------------------------- 文字の直し
# (欄のみちすじ, もとの文, 新しい文)
TEXT_FIX = {
    "hd5s_26k1_13": [
        (("steps", 0, "meaning"),
         u"①大問1と同じしくみで、ア○△×□●＝オ○△×□●よりア＝オ。②イはオの半分の面積なので、アの半分にあたる。③ア:イ＝2:1。",
         u"①長方形はたて・横それぞれ3等分されているので、同じ大きさのます目9個に分かれる。アはそのます目1個ぶん。②イは、右下のます目を対角線で切った半分なので、ます目半分ぶん。③だからアはイの2倍で、ア:イ＝2:1。"),
        (("steps", 1, "meaning"),
         u"①ウの部分は●▲の組み合わせ1つ分にあたる。②エの部分は(●●●▲▲▲)の組み合わせが3つ分にあたる。③ウ:エ＝1:3。",
         u"①比を求めるだけなので、たて2cm・AB＝BC＝CD＝2cm（横6cm）の長方形で考えてよい。②Bから左下のかどへ引いた線は、横2cm進むあいだにたて2cm下がるので、たてのまん中（下へ1cm）ではAから右へ1cmのところを通る。図のたての線と横の線はここで交わっている。Cから右下のかどへ引いた線も同じで、まん中の高さでは右のはしから1cmのところ。③ウは、平行な2辺が2cmと1cmで、そのはばが1cmの台形。(2+1)÷2×1＝1.5cm²。④エは、上底4cm・下底5cm・高さ1cmの台形。(4+5)÷2×1＝4.5cm²。⑤1.5:4.5＝1:3。"),
    ],
    "hd5s_26k1_14": [
        (("intro",),
         u"図1のように、平行四辺形ABCDの紙をBEを折り目として折ったところ、角アの大きさが15度になりました。BC＝10cmです。",
         u"図1のように、平行四辺形ABCDの紙をBEを折り目として折ったところ、角アの大きさが15度になりました。図の10cmは辺CDの長さです（平行四辺形なのでAB＝CD＝10cm）。"),
        (("steps", 0, "meaning"),
         u"①折り返しで15度が2つできて30度になるので、もとの三角形は30度の三角形。②30度の三角形の高さは斜辺の半分になるので、高さ＝10×1/2＝5cm。面積は10×5÷2＝25cm²。③三角形AFBはその半分にあたるので25×1/2＝12.5cm²。",
         u"①折り返したので、折り目BEの両側に15度が2つできる。だから、B・折る前のA・折ったあとのA でできる三角形は、Bのところの角が15+15＝30度。②折ってももとの長さは変わらないので、この三角形はBからの2辺がどちらもAB＝10cmの二等辺三角形。30度の角をはさむ1辺を底辺にすると、高さはもう1辺の半分だから 10×1/2＝5cm。面積は 10×5÷2＝25cm²。③BEはその30度の角をちょうど半分に分けるので、三角形もぴったり半分に分かれる。三角形AFBはその半分で 25÷2＝12.5cm²。"),
        (("steps", 1, "meaning"),
         u"三角形ABCと三角形ABDの面積の差は、(1)でもとにした30度の三角形の面積と同じになるので25cm²。",
         u"①三角形ABCと三角形ABDは、辺ABを共通の底辺としている。だから面積の差は、CとDが直線ABからどれだけちがう高さにあるかで決まる。②平行四辺形なので、CからDへの動き方は、Bから『折る前のA』への動き方とまったく同じ。Bは直線AB上にあって高さ0だから、CとDの高さの差は『折る前のA』の高さと同じ。③つまり面積の差は、折ったあとのA・B・折る前のA でできる三角形の面積と同じ。これは(1)で出した25cm²。"),
    ],
    "hd5s_26k1_15": [
        (("steps", 0, "meaning"),
         u"正六角形の分割パターンから、斜線部分は正六角形の1/3から1/6を引いた部分にあたる。72×(1/3−1/6)＝12。→ 12cm²。",
         u"①図の点線でわかるように、斜線部分は「Aと回したあとの正六角形の2つの頂点でできる大きい三角形」から「Aともとの正六角形の2つの頂点でできる小さい三角形」をのぞいた形になっている。②正六角形では、となり合う3つの頂点でできる三角形は全体の1/6、1つとばした頂点までふくむ大きいほうの三角形は全体の1/3。③72×(1/3−1/6)＝72×1/6＝12。→ 答え 12cm²。"),
    ],
    "hd5s_26k1_16": [
        (("steps", 0, "meaning"),
         u"①六角形の面積は(⑤+⑦)×2＝24にあたる分割で考える。⑤＝60×5/24＝12.5cm²。②重なる部分は12.5×2＝25cm²。",
         u"①正六角形を、まん中の点から24個の同じ大きさの三角形に分けて考える（6つの正三角形を、それぞれ4つに分ける）。②XもYも相手の辺のまん中にあるので、重なっている部分のかどはすべてこの24等分の点の上にきて、重なりはちょうど10個分になる。③60×10/24＝25cm²。"),
        (("steps", 1, "meaning"),
         u"①太線の三角形は全体の1/3のさらに半分＝1/6にあたる。②重なる部分は1/6+1/6＝1/3にあたるので、60×1/3＝20cm²。③これが2か所分あるので20×2＝40cm²。",
         u"①重なっている部分は、AとPが重なった点と、辺DEと辺RSが交わる点（おたがいのまん中）を結ぶ線で、同じ大きさの2つに分けられる。②その1つ分は、正六角形の1/6にあたる三角形2つ分なので 1/6+1/6＝1/3。60×1/3＝20cm²。③重なり全体は 20×2＝40cm²。"),
    ],
    "hd5s_27k1_1": [
        (("intro",),
         u"下の図の四角形ABCDは長方形です。辺AB上に点E、辺DC上に点Fがあり、AE＝3cm、EB＝1cm、DF＝2cm、FC＝2cmです。図に示された斜線部分について考えます。",
         u"下の図の四角形ABCDは長方形です。辺AB上に点E、辺DC上に点Fがあり、AE＝3cm、EB＝1cm、DF＝2cm、FC＝2cmです。AとF、EとDを結んだ線が交わる点がP、EとC、BとFを結んだ線が交わる点がQで、四角形EPFQが斜線部分です。"),
        (("steps", 0, "meaning"),
         u"①斜線部を㋐と㋑に分ける。ちょうちょう（砂時計形の相似）に注目して辺比を書き込むと、㋐は三角形AEFの2/5にあたり、三角形AEFは長方形の3/8にあたる→㋐は長方形の3/8×2/5＝3/20。②同様に㋑は三角形EBFの2/3にあたり、三角形EBFは長方形の1/8にあたる→㋑は長方形の1/8×2/3＝1/12。③3/20+1/12＝7/30。→ 答え 7/30倍。",
         u"①EとFを結ぶ線で、斜線部分を上の三角形EPFと下の三角形EQFに分けて考える。②上のちょうちょう（砂時計形）：AEとDFは平行で、AE＝3cm、DF＝2cm。だから AP:PF＝3:2 で、PF＝AFの2/5。三角形EPFと三角形EAFはEを頂点、底辺をAF上にとるので、三角形EPF＝三角形AEFの2/5。三角形AEFは 3×(長方形の横)÷2 で、長方形（4×横）の3/8。だから上は長方形の 3/8×2/5＝3/20。③下のちょうちょう：EBとCFは平行で、EB＝1cm、FC＝2cm。だから BQ:QF＝1:2 で、QF＝BFの2/3。三角形EQF＝三角形EBFの2/3。三角形EBFは 1×横÷2 で長方形の1/8。だから下は 1/8×2/3＝1/12。④3/20+1/12＝9/60+5/60＝14/60＝7/30。→ 答え 7/30倍。"),
    ],
    "hd5s_27k1_2": [
        (("intro",),
         u"下の図の長方形ABCDの辺AB, BC, CD, DA上にそれぞれ点E, F, G, Hがあり、AE:EB＝BF:FC＝CG:GD＝DH:HA＝2:1です。E, F, G, Hを結んでできる太線の平行四辺形と、その中にできる斜線部分の小さな平行四辺形を考えます。",
         u"下の図の長方形ABCDの辺AB, BC, CD, DA上にそれぞれ点E, F, G, Hがあり、AE:EB＝BF:FC＝CG:GD＝DH:HA＝2:1です。AとF、BとG、CとH、DとEを結ぶと、まん中に小さな平行四辺形（斜線部分）ができます。"),
        (("steps", 0, "meaning"),
         u"①太線EFGHで囲まれた平行四辺形は長方形全体の1/3にあたる。②太線の平行四辺形の中のピラミッド（三角形の中の平行線）に注目するとア:イ:ウ＝2:1:2、ウ:エ＝3:2となるので、比あわせしてア:イ:ウ:エ＝6:3:6:4とそろえる。③斜線部分は太線の平行四辺形の3/13にあたるので、長方形全体では1/3×3/13＝1/13。→ 答え 1:13。",
         u"①比を求めるだけなので、横6cm・たて3cmの長方形で考えてよい。このとき AE＝2cm、EB＝1cm、BF＝4cm、FC＝2cm、CG＝2cm、GD＝1cm、DH＝4cm、HA＝2cm。②AH＝2cm、FC＝2cmで、AHとFCは平行で長さも等しいから四角形AFCHは平行四辺形。面積は 2×3＝6cm²で、長方形18cm²の1/3。③DEもBGも「横に6cm進むとたてに2cm動く」向きなので平行。この2本が平行四辺形AFCHを3つに切っていて、まん中が斜線部分。斜線部分も平行四辺形で、AFCHと高さが共通だから、面積の比は辺AF上の長さの比で決まる。④DEをEの先へのばして、辺BCをのばした線と交わる点をZとする。DEは横6cmでたて2cm動くので、EからBCまでのたて1cmぶんは横3cm。BZ＝3cm、FZ＝4+3＝7cm。ADとFZは平行だからちょうちょうができて、AP:PF＝AD:FZ＝6:7。⑤同じようにBGをGの先へのばして辺ADをのばした線と交わる点をWとすると DW＝3cm、AW＝6+3＝9cm。AQ:QF＝AW:FB＝9:4。⑥どちらもAF全体が13にあたるので、AP:PQ:QF＝6:3:4。斜線部分は平行四辺形AFCHの3/13。⑦長方形では 1/3×3/13＝1/13。→ 答え 1:13。"),
    ],
    "hd5s_27k1_3": [
        (("steps", 0, "meaning"),
         u"①ちょうちょう（砂時計形の相似）に注目してから、ピラミッド（三角形の中の平行線）に注目する。②太線でできる部分は平行四辺形で、長方形全体の1/2にあたる。③斜線部分はその平行四辺形の1.5/6＝1/4にあたる。④全体では1/2×1/4＝1/8。→ 答え 1/8倍。",
         u"①FはDCのまん中なので FC＝たての半分。三角形ACFは、底辺FC・高さ＝長方形の横だから、長方形の1/4。②QはACを3等分する点のうちCに近いほうなので AQ:AC＝2:3。三角形AQFと三角形ACFはFを頂点、底辺をAC上にとるので、三角形AQF＝1/4×2/3＝長方形の1/6。③AEとFDはどちらも長方形のたての半分で長さが等しいので、AFとEDのちょうちょうは左右対称になり、交わる点はAFのちょうどまん中。④斜線部分は、三角形AQFから、A・P・（AFとEDの交わる点）でできる三角形を切り取った形。角Aが共通で AP:AQ＝1:2、（交わる点まで):AF＝1:2 なので、切り取る三角形は三角形AQFの (1×1)/(2×2)＝1/4。⑤斜線部分＝長方形の 1/6−1/6×1/4＝1/6×3/4＝1/8。→ 答え 1/8倍。"),
    ],
    "hd5s_27k1_4": [
        (("intro",),
         u"右の図の長方形ABCDで、辺BC上の点E、辺CD上の点Fがあり、BE:EC＝CF:FD＝2:1です。",
         u"右の図の長方形ABCDで、辺BC上に点E、辺CD上に点Fがあり、BE:EC＝CF:FD＝2:1です。AとE、AとFを結んだ線が対角線BDと交わる点を、それぞれG、Hとします。"),
        (("steps", 0, "meaning"),
         u"①三角形DBCを基準に考える。㋐は三角形DBCの2/3×2/5＝4/15、㋑は三角形DBCの1/3×1/4＝1/12。②斜線部分は三角形DBCの1−4/15−1/12＝13/20。③三角形DBCは長方形の1/2にあたるので、斜線部分は長方形の1/2×13/20＝13/40。→ 答え 13:40。",
         u"①対角線BDをひくと、三角形DBCは長方形の1/2。斜線部分は、三角形DBCから三角形BGEと三角形DHFをのぞいた残り。②三角形BGE：AとDは上の辺の上、EとBは下の辺の上にあり、上の辺と下の辺は平行だから、AEとDBでちょうちょうができる。BG:GD＝BE:AD＝2:3（BE＝BCの2/3だから）。角Bが共通なので 三角形BGE＝三角形DBCの (2/5)×(2/3)＝4/15。③三角形DHF：AとBは左の辺の上、FとDは右の辺の上にあり、左の辺と右の辺は平行だから、AFとBDでちょうちょうができる。DH:HB＝DF:AB＝1:3（DF＝CDの1/3だから）。角Dが共通なので 三角形DHF＝三角形DBCの (1/4)×(1/3)＝1/12。④斜線部分は三角形DBCの 1−4/15−1/12＝60/60−16/60−5/60＝39/60＝13/20。⑤長方形では 1/2×13/20＝13/40。→ 答え 13:40。"),
    ],
    "hd5s_27k1_5": [
        (("steps", 0, "meaning"),
         u"①外側に正三角形を復元すると、一辺は3+4+5＝12cm。5+6+■＝12より■＝1cm。②1+▲+3＝12より▲（EF）＝8cm。→ 答え 8cm。",
         u"①どの角も120度なので、辺AB, CD, EFをそれぞれのばすと大きな正三角形ができる。かどの3か所は、一辺がAF・BC・DEの小さな正三角形を切り取った形になっている。②大きな正三角形の一辺は、左側で見ると AF+AB+BC＝3+4+5＝12cm。③下側で見ると BC+CD+DE＝12 なので 5+6+DE＝12、DE＝1cm。④右側で見ると DE+EF+AF＝12 なので 1+EF+3＝12、EF＝8cm。→ 答え 8cm。"),
        (("steps", 1, "meaning"),
         u"①一辺1cmの正三角形の面積を(1×1)とすると、大きな正三角形は一辺12cmなので(12×12)。②切り取った3つの角の正三角形はそれぞれ一辺3cm・5cm・1cmなので(3×3)、(5×5)、(1×1)。③六角形は(12×12)−((3×3)+(5×5)+(1×1))＝144−9−25−1＝109。→ 答え 109倍。",
         u"①正三角形どうしでは、一辺が2倍・3倍…になると面積は 2×2倍・3×3倍…になる。一辺1cmの正三角形の面積を(1×1)と書くことにする。②大きな正三角形は一辺12cmなので (12×12)＝144。③切り取った3つのかどの正三角形は、一辺が AF＝3cm、BC＝5cm、DE＝1cm なので (3×3)＝9、(5×5)＝25、(1×1)＝1。④六角形は 144−(9+25+1)＝109。→ 答え 109倍。"),
    ],
    "hd5s_27k1_6": [
        (("intro",),
         u"右の図の四角形ABCDは一辺の長さが12cmの正方形です。辺CD上の点E、辺AD上の点Fがあり、CE:ED＝1:1、AF:FD＝2:1です。",
         u"右の図の四角形ABCDは一辺の長さが12cmの正方形です。辺CD上に点E、辺AD上に点Fがあり、CE:ED＝1:1、AF:FD＝2:1です。AEとBFの交わる点をGとします。"),
        (("steps", 0, "meaning"),
         u"①三角形AGFと三角形HGBが相似で、相似比が8:24＝1:3になることから交点の位置が12×3/(1+3)で求まる。②斜線部分の面積は24×9÷2−12×6÷2＝108−36＝72cm²。→ 答え 72cm²。",
         u"①AF＝12×2/3＝8cm、ED＝EC＝6cm。②AEをのばして、辺BCをのばした線と交わる点をHとする。三角形ADEと三角形HCEは、DE＝EC・向かい合う角・平行線の角が等しいので合同。だから CH＝AD＝12cm、BH＝12+12＝24cm。③AFとBHは平行だからちょうちょうができて、AG:GH＝AF:HB＝8:24＝1:3。GはADからBCまでの1/4のところなので、BCからの高さは 12×3/4＝9cm。④A・G・E・Hは同じ直線の上にあるので、三角形GBHを線ECで切ると、斜線部分の四角形BGECと三角形ECHに分かれる。三角形GBH＝24×9÷2＝108cm²、三角形ECH＝12×6÷2＝36cm²（EはDCのまん中なのでBCまで6cm）。⑤斜線部分＝108−36＝72cm²。→ 答え 72cm²。"),
    ],
    "hd5s_27k1_7": [
        (("intro",),
         u"右の図は、三角形ABCを面積が等しい5つの三角形に分けた図です。辺AC上に点D, Eがあります。",
         u"右の図は、三角形ABCを、B→D→P→E→Q という折れ線で、面積が等しい5つの三角形に分けた図です。点D, Eは辺AC上に、点P, Qは辺BC上にあります。"),
        (("steps", 0, "meaning"),
         u"①高さが同じ三角形どうしは面積比＝底辺比になるので、面積が等しい部分の底辺も等しい関係で表せる。②4＝③＝△とそろえて比あわせすると、AD:DE:EC＝3:4:8。→ 答え 3:4:8。",
         u"①三角形ABDは全体の1/5。三角形ABDと三角形ABCはBから直線ACまでの高さが同じなので、面積比＝底辺比。AD:AC＝1:5。ACを⑮とするとAD＝③。②三角形DBCは残りの4/5。三角形DBPと三角形DBCはDを頂点、底辺をBC上にとるので BP:BC＝(1/5):(4/5)＝1:4。残りの三角形DPCは 4/5−1/5＝3/5。③三角形DPEも1/5なので、三角形EPCは 3/5−1/5＝2/5。④三角形APCは PC:BC＝3:4 だから全体の3/4。三角形EPCと三角形APCは底辺PCが共通で、高さの比＝EC:AC。だから EC:AC＝(2/5):(3/4)＝8:15。ACを⑮とするとEC＝⑧。⑤DE＝⑮−③−⑧＝④。よって AD:DE:EC＝3:4:8。"),
    ],
    "hd5s_27k1_8": [
        (("intro",),
         u"面積が56cm²の三角形ABCを、辺BC上・辺AC上の点D, Eを使って図のように5つの部分に分けました。5つの部分の面積はそれぞれ14cm²、15cm²、12cm²、9cm²、6cm²です。",
         u"面積が56cm²の三角形ABCを、B→D→P→E→Q という折れ線で、図のように5つの三角形に分けました。点D, Eは辺AC上に、点P, Qは辺BC上にあります。5つの部分の面積はそれぞれ14cm²、15cm²、12cm²、9cm²、6cm²です。"),
        (("steps", 0, "meaning"),
         u"①面積比＝底辺比になる部分を使って比を出し、⑨＝3とそろえて比あわせすると、AD:EC＝③:⑤＝3:5。→ 答え 3:5。",
         u"①三角形ABDと三角形ABCは、Bから直線ACまでの高さが同じなので 面積比＝底辺比。AD:AC＝14:56＝1:4。ACを⑫とするとAD＝③。②三角形DBC＝56−14＝42cm²。三角形DBPと三角形DBCはDを頂点、底辺をBC上にとるので BP:BC＝15:42＝5:14。残りの三角形DPC＝42−15＝27cm²。③D・E・Cは同じ直線の上にあるので、三角形DPCは線PEで三角形DPE（12cm²）と三角形EPC に分かれる。三角形EPC＝27−12＝15cm²（9+6でも同じ）。④三角形APCは PC:BC＝9:14 なので 56×9/14＝36cm²。三角形EPCと三角形APCは底辺PCが共通で、高さの比＝EC:AC。だから EC:AC＝15:36＝5:12。ACを⑫とするとEC＝⑤。⑤AD:EC＝③:⑤＝3:5。"),
    ],
    "hd5s_27k1_9": [
        (("intro",),
         u"下の図は、三角形ABCの面積を折れ線C, D, E, …, Lで10等分したものです。辺AB上にL, J, H, F, Dがあり、辺ABの長さは16cmです。",
         u"下の図は、三角形ABCの面積を折れ線C, D, E, …, Lで10等分したものです。D, F, H, J, Lは辺AB上に、E, G, I, Kは辺AC上にあり、辺ABの長さは16cmです。"),
        (("steps", 0, "meaning"),
         u"①面積が10等分されているので、底辺ABも同じ関係で10等分の比を追える。⑩＝16cmから⑨＝14.4cm、⑦＝12.6cmのように順に長さを出していく。②FHにあたる部分は2.1cm。→ 答え 2.1cm。",
         u"①三角形BCDは全体の1/10。三角形BCDと三角形ABCはCを頂点、底辺をAB上にとるので BD:AB＝1:10。だから AD＝16×9/10＝14.4cm。②三角形ACDは全体の9/10。ここから三角形CDE（1/10）をのぞくと三角形ADE＝8/10。三角形ADEと三角形ACDはDを頂点、底辺をAC上にとるので AE:AC＝8:9。③三角形ADEから三角形DEF（1/10）をのぞくと三角形AEF＝7/10。三角形AEFと三角形ADEはEを頂点、底辺をAB上にとるので AF:AD＝7:8。AF＝14.4×7/8＝12.6cm。④同じように三角形AFG＝6/10 で AG:AE＝6:7、三角形AGH＝5/10 で AH:AF＝5:6。AH＝12.6×5/6＝10.5cm。⑤FH＝AF−AH＝12.6−10.5＝2.1cm。→ 答え 2.1cm。"),
    ],
    "hd5s_27k1_10": [
        (("steps", 0, "meaning"),
         u"①底辺比AF:FB＝3:2、BD:DC＝1:1をそれぞれ面積比に読みかえる。②比あわせして共通の数でそろえると、AE:EC＝x:y＝3:2。→ 答え 3:2。",
         u"①3本が交わる点をPとして、PとA・B・Cを結ぶと、三角形ABCは3つの三角形に分かれる。三角形PBCをア、三角形PCAをイ、三角形PABをウとする。②BD:DC は 三角形ABD:三角形ACD でもあり、三角形PBD:三角形PCD でもある。引き算すると BD:DC＝ウ:イ。同じように AF:FB＝イ:ア、AE:EC＝ウ:ア。これがこの型の基本。③AF:FB＝3:2 なので イ:ア＝3:2。BD:DC＝1:1 なので ウ:イ＝1:1。比あわせして ア:イ:ウ＝2:3:3。④AE:EC＝ウ:ア＝3:2。→ 答え 3:2。"),
        (("steps", 1, "meaning"),
         u"①底辺比AF:FB＝2:5、AE:EC＝4:3をそれぞれ面積比に読みかえる。②比あわせして共通の数でそろえると、BD:DC＝x:y＝10:3。→ 答え 10:3。",
         u"①(1)と同じで、交わる点Pと頂点を結んでできる 三角形PBC＝ア、三角形PCA＝イ、三角形PAB＝ウ とすると、AF:FB＝イ:ア、AE:EC＝ウ:ア、BD:DC＝ウ:イ。②AF:FB＝2:5 より イ:ア＝2:5。AE:EC＝4:3 より ウ:ア＝4:3。③アを15にそろえて比あわせすると ア:イ:ウ＝15:6:20。④BD:DC＝ウ:イ＝20:6＝10:3。→ 答え 10:3。"),
        (("steps", 2, "meaning"),
         u"①底辺比AE:EC＝7:2、BD:DC＝6:5を面積比に読みかえてから比あわせする。②AD, BE, CFが1点で交わる条件から、AF:FBが35:12と求まる。→ 答え 35:12。",
         u"①同じように 三角形PBC＝ア、三角形PCA＝イ、三角形PAB＝ウ とすると、AE:EC＝ウ:ア、BD:DC＝ウ:イ、AF:FB＝イ:ア。②AE:EC＝7:2 より ウ:ア＝7:2。BD:DC＝6:5 より ウ:イ＝6:5。③ウを42にそろえて比あわせすると ア:イ:ウ＝12:35:42。④AF:FB＝イ:ア＝35:12。→ 答え 35:12。"),
    ],
}

ORDER = ["hd5s_26k1_13", "hd5s_26k1_14", "hd5s_26k1_15", "hd5s_26k1_16"] + \
        ["hd5s_27k1_%d" % i for i in range(1, 11)]


def get_field(x, path):
    if path[0] == "intro":
        return x.get("intro")
    return x["steps"][path[1]].get(path[2])


def set_field(x, path, v):
    if path[0] == "intro":
        x["intro"] = v
    else:
        x["steps"][path[1]][path[2]] = v


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    d = json.load(io.open(target, encoding="utf-8"))
    index = {}
    for r in iter_daimon(d):
        x = r["x"]
        if x.get("id"):
            index[x["id"]] = x

    changed = []
    total = 0
    already = 0
    for did in ORDER:
        x = index.get(did)
        if x is None:
            raise AssertionError(u"大問が見つからない: " + did)
        cnt = 0
        for fpath, old, new in TEXT_FIX.get(did, []):
            cur = get_field(x, fpath)
            if cur == new:
                already += 1
                continue
            if cur != old:
                raise AssertionError(
                    u"%s %s: 欄の中身が想定と合わない（すでに別の直しが入っている可能性）\n  いま: %r" % (did, fpath, cur))
            # ★アンカーの一意性: この大問の中で もとの文が ちょうど1回だけ出ることを確かめる
            blob = json.dumps(x, ensure_ascii=False)
            if blob.count(json.dumps(old, ensure_ascii=False)[1:-1]) != 1:
                raise AssertionError(u"%s %s: もとの文がこの大問の中で1回だけではない" % (did, fpath))
            set_field(x, fpath, new)
            cnt += 1
        if did in SVG_NEW:
            cur = x.get("svg", "")
            new = SVG_NEW[did]()
            if cur == new:
                already += 1
            else:
                m = hashlib.md5(cur.encode("utf-8")).hexdigest()
                if m != SVG_OLD_MD5[did]:
                    raise AssertionError(
                        u"%s svg: 図の中身が想定と合わない（md5 %s）" % (did, m))
                x["svg"] = new
                cnt += 1
        if cnt:
            changed.append((did, cnt))
            total += cnt

    out = json.dumps(d, ensure_ascii=False, indent=1)
    f = io.open(target, "wb")
    f.write(out.encode("utf-8"))
    f.close()

    print("target: %s" % target)
    print(u"図の検算 %d 件すべて合格" % len(CHECKS))
    for did, cnt in changed:
        print(u"  変更 %-14s %d か所" % (did, cnt))
    print(u"変更した大問 %d 本 / 箇所 %d か所（すでに直っていた欄 %d）" % (len(changed), total, already))


if __name__ == "__main__":
    main()
