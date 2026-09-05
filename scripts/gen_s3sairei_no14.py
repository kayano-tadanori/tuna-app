# -*- coding: utf-8 -*-
u"""小3最レ【刷新版】No.14「8月2回目 平面図形(2) 角①」を原簿から実装する。

  出典: 3年 最レNo.14 問題と解答.pdf（全18ページ・問題p1-7／解答p8／解説p9-18）
  原簿: HG-1431〜1437（大問1〜7）

  ★方針（[[feedback_genbo_dori]] [[feedback_zu_wa_genbo_ni_nai]]）
    ・設問・数値・答えは実物のまま。答え方の様式だけ変える
      （「角x,yはそれぞれ何度」→ x を聞く設問と y を聞く設問に分ける）
    ・図は実物を見て**座標で組み立て**、印字してある角度を**座標から測り直して検算**する。
      想像で描かない。描いた図の上で必ず1問解き直す（[[method_svg_check]]）

  ★答えはPDFの解答ページ(p8)と、こちらで解いた結果の**両方が一致**したものだけ入れる。
"""
import math, json, io, os, sys
sys.stdout.reconfigure(encoding="utf-8")

# ---------------- 幾何のどうぐ ----------------
def P(x, y): return (float(x), float(y))
def polar(o, deg, r):
    a = math.radians(deg)
    return (o[0] + r * math.cos(a), o[1] - r * math.sin(a))   # 画面は y が下向き
def ang_of(a, b):
    """a から b を見る向き（度・数学の向き＝反時計まわり）"""
    return math.degrees(math.atan2(-(b[1] - a[1]), b[0] - a[0])) % 360
def angle_at(v, p, q):
    """頂点 v で p と q がはさむ角（0〜180度）"""
    d = abs(ang_of(v, p) - ang_of(v, q)) % 360
    return d if d <= 180 else 360 - d
def inter(p1, p2, p3, p4):
    """直線 p1p2 と p3p4 の交点"""
    x1,y1 = p1; x2,y2 = p2; x3,y3 = p3; x4,y4 = p4
    d = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4)
    if abs(d) < 1e-9: raise ValueError("平行で交わらない")
    px = ((x1*y2-y1*x2)*(x3-x4) - (x1-x2)*(x3*y4-y3*x4)) / d
    py = ((x1*y2-y1*x2)*(y3-y4) - (y1-y2)*(x3*y4-y3*x4)) / d
    return (px, py)

# ---------------- 検算 ----------------
CHECKS = []
def must(label, got, want, tol=0.35):
    ok = abs(got - want) <= tol
    CHECKS.append((label, got, want, ok))
    if not ok:
        raise AssertionError("検算NG %s: 図から測ると %.2f 度、実物の印字は %s 度" % (label, got, want))

# ---------------- SVG のどうぐ ----------------
COL_LINE = "#8ab4ff"     # 図の線
COL_GIVEN = "#ffd166"    # 問題に印字してある角度
COL_ASK  = "#7dd3fc"     # 聞かれている角（x, y, ア…）
COL_ARC  = "#ffd166"
COL_ARC2 = "#7dd3fc"
COL_MARK = "#ff9ecb"     # ○● のしるし

class Svg:
    def __init__(self, w, h):
        self.w, self.h, self.b = w, h, []
    def line(self, a, b, col=COL_LINE, wid=2, dash=None):
        d = ' stroke-dasharray="5 4"' if dash else ''
        self.b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%s" stroke-linecap="round"%s/>'
                      % (a[0], a[1], b[0], b[1], col, wid, d))
    def poly(self, pts, col=COL_LINE, wid=2):
        s = ' '.join('%.1f,%.1f' % p for p in pts)
        self.b.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>' % (s, col, wid))
    def arrow(self, a, b, col=COL_LINE, wid=2, sp=0.5):
        """平行線の矢じり付き直線。sp で矢じりの位置（0〜1）を変える。
           ★0.5（まん中）だと、聞いている角の内がわに矢じりが入って角が読みにくい
             （塾講師監査の指摘 2026-09-05）。実物どおり線の右はしへ寄せる。"""
        self.line(a, b, col, wid)
        th = math.atan2(b[1]-a[1], b[0]-a[0]); L = 9
        mx, my = a[0]+(b[0]-a[0])*sp, a[1]+(b[1]-a[1])*sp
        for s in (0.42, -0.42):
            self.b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%s" stroke-linecap="round"/>'
                          % (mx, my, mx - L*math.cos(th+s), my - L*math.sin(th+s), col, wid))
    def arc(self, v, p, q, r=22, col=COL_ARC, wid=2):
        """頂点 v で p と q がはさむ角に弧をひく"""
        a1, a2 = ang_of(v, p), ang_of(v, q)
        d = (a2 - a1) % 360
        if d > 180: a1, a2, d = a2, a1, 360 - d
        s = polar(v, a1, r); e = polar(v, a1 + d, r)
        self.b.append('<path d="M %.1f %.1f A %d %d 0 0 0 %.1f %.1f" fill="none" stroke="%s" stroke-width="%s"/>'
                      % (s[0], s[1], r, r, e[0], e[1], col, wid))
        # ★ラベルの置き場所。**細い角ほど 頂点から遠くへ出す**。
        #   角がせまいと 2本の線のすきまも せまいので、近くに置くと 文字が線に乗る
        #   （19度のラベルが線に串ざしになっていた・2026-09-05の実測）。
        #   すきま = 2×距離×sin(半角) なので、文字の高さぶん空くところまで下げる。
        half = math.radians(d / 2)
        lab = max(r + 15, 12.0 / max(math.sin(half), 0.06))
        return polar(v, a1 + d / 2, lab)
    def text(self, p, s, col=COL_GIVEN, size=15, anchor="middle", italic=False):
        it = ' font-style="italic"' if italic else ''
        self.b.append('<text x="%.1f" y="%.1f" fill="%s" font-size="%d" text-anchor="%s" font-family="sans-serif" font-weight="bold"%s>%s</text>'
                      % (p[0], p[1] + size * 0.35, col, size, anchor, it, s))
    def lead(self, anchor, lp, txt, col=COL_GIVEN, size=15):
        """角のそばから 引き出し線を のばして、図の外に ラベルを置く。
           ★せまい角や、線が こんでいる所は、そばに置くと 文字が線に乗る
             （塾講師監査の指摘 2026-09-05）。実物も 引き出し線で 外に出している。"""
        self.b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.5" stroke-linecap="round"/>'
                      % (anchor[0], anchor[1], lp[0], lp[1], col))
        self.text((lp[0] + (14 if lp[0] > anchor[0] else -14), lp[1] - 6), txt, col, size)

    def dot(self, p, filled=True, r=4.5, col=COL_MARK):
        f = col if filled else "none"
        self.b.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="%s" stroke-width="2"/>' % (p[0], p[1], r, f, col))
    def out(self):
        return ('<svg viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" '
                'style="display:block;margin:0 auto;max-width:100%%;height:auto">%s</svg>'
                % (self.w, self.h, ''.join(self.b)))

# ============================================================
#  図（すべて座標で組み立てて、印字してある角度を測り直して検算する）
# ============================================================
FIGS = {}

# ---- 大問2(1) 平行線とジグザグ（35°/30°→x） ----
def fig_2_1():
    s = Svg(300, 210)
    A = P(100, 34); B = P(100, 176)
    # A から下へ35度、B から上へ30度。交わった所が V
    V = inter(A, polar(A, -35, 100), B, polar(B, 30, 100))
    s.arrow(P(20, 34), P(285, 34), sp=0.90); s.arrow(P(20, 176), P(285, 176), sp=0.90)
    s.line(A, V); s.line(B, V)
    s.text(s.arc(A, P(285, 34), V, 26), "35°")
    s.text(s.arc(B, P(285, 176), V, 26), "30°")
    s.text(s.arc(V, A, B, 24, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must("2(1) 上の35度", angle_at(A, P(285, 34), V), 35)
    must("2(1) 下の30度", angle_at(B, P(285, 176), V), 30)
    must("2(1) 答えのx", angle_at(V, A, B), 65)
    return s.out()

# ---- 大問2(2) 平行な2本のたて線（45°/82°→x） ----
def fig_2_2():
    s = Svg(300, 248)
    L, R = 75, 225
    Pp = P(L, 38)
    Q = inter(Pp, polar(Pp, -45, 100), P(R, 0), P(R, 260))
    # Q で「右のたて線の下向き（270度）」から 82度 だけ左へ回した向きに S をとる
    S = inter(Q, polar(Q, 270 - 82, 300), P(L, 0), P(L, 260))
    s.arrow(P(L, 18), P(L, 228), sp=0.90); s.arrow(P(R, 18), P(R, 228), sp=0.90)
    s.line(Pp, Q); s.line(Q, S)
    s.text(s.arc(Pp, P(L, 240), Q, 26), "45°")
    s.text(s.arc(Q, P(R, 240), S, 26), "82°")
    s.text(s.arc(Q, Pp, S, 30, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must("2(2) 45度", angle_at(Pp, P(L, 240), Q), 45)
    must("2(2) 82度", angle_at(Q, P(R, 240), S), 82)
    must("2(2) 答えのx", angle_at(Q, Pp, S), 53)
    return s.out()

# ---- 正五角形のどうぐ（(3)(4)共通）----
def pentagon(cx, cy, r, rot):
    """A,B,C,D,E の順（画面では反時計まわり）"""
    return [polar(P(cx, cy), rot + 72 * k, r) for k in range(5)]

def find_rot(idx_v, idx_o, want, lo=0, hi=360):
    """頂点 idx_v で「左向きの水平」と (idx_v→idx_o) がはさむ角が want になる回転角"""
    best, bd = None, 9e9
    n = 20000
    for i in range(n):
        rot = lo + (hi - lo) * i / n
        pts = pentagon(200, 130, 78, rot)
        v, o = pts[idx_v], pts[idx_o]
        d = abs(angle_at(v, (v[0] - 100, v[1]), o) - want)
        if d < bd: bd, best = d, rot
    return best, bd

def pent_svg(rot, mark_v, mark_o, mark_txt, ask_v, ask_o, labels):
    """正五角形＋上下の平行線。mark_v で印字の角、ask_v で x をきく"""
    pts = pentagon(200, 132, 78, rot)
    names = "ABCDE"
    s = Svg(400, 260)
    top, bot = pts[ask_v], pts[mark_v]
    s.arrow(P(top[0] - 150, top[1]), P(top[0] + 130, top[1]), sp=0.88)
    s.arrow(P(bot[0] - 150, bot[1]), P(bot[0] + 130, bot[1]), sp=0.88)
    s.poly(pts)
    s.text(s.arc(bot, P(bot[0] - 120, bot[1]), pts[mark_o], 27), mark_txt)
    s.text(s.arc(top, P(top[0] - 120, top[1]), pts[ask_o], 25, COL_ARC2), "x", COL_ASK, 17, italic=True)
    for i, p in enumerate(pts):
        c = P(200, 132)
        d = math.hypot(p[0] - c[0], p[1] - c[1]) or 1
        q = [p[0] + (p[0] - c[0]) / d * 21, p[1] + (p[1] - c[1]) / d * 21]
        for ly in (top[1], bot[1]):        # 平行線に かぶらないよう 上下へ逃がす
            if abs(q[1] - ly) < 13: q[1] = ly + (13 if q[1] > ly else -13)
        s.text(tuple(q), names[i], "#e8edff", 14)
    return s, pts

def fig_2_3():
    rot, _ = find_rot(2, 1, 48, 60, 130)
    s, pts = pent_svg(rot, 2, 1, "48°", 0, 1, True)
    A, B, C = pts[0], pts[1], pts[2]
    must("2(3) C の48度", angle_at(C, (C[0] - 120, C[1]), B), 48)
    must("2(3) 正五角形の内角", angle_at(B, A, C), 108)
    must("2(3) 答えのx", angle_at(A, (A[0] - 120, A[1]), B), 60)
    return s.out()

def fig_2_4():
    rot, _ = find_rot(0, 1, 11, 30, 100)
    pts = pentagon(200, 132, 78, rot)
    names = "ABCDE"
    A, B, C, D = pts[0], pts[1], pts[2], pts[3]
    s = Svg(400, 268)
    s.arrow(P(A[0] - 170, A[1]), P(A[0] + 120, A[1]), sp=0.90)
    s.arrow(P(D[0] - 160, D[1]), P(D[0] + 130, D[1]), sp=0.90)
    s.poly(pts)
    s.arc(A, P(A[0] - 130, A[1]), B, 30)
    # ★11度は角がうすいので、ラベルを線の上へ出して引き出し線でつなぐ（監査の指摘）
    lp = P(A[0] - 62, A[1] - 30)
    s.b.append('<path d="M %.1f %.1f Q %.1f %.1f %.1f %.1f" fill="none" stroke="%s" stroke-width="1.5"/>'
               % (lp[0] + 12, lp[1] + 6, lp[0] + 26, lp[1] + 12, A[0] - 27, A[1] - 4, COL_GIVEN))
    s.text(lp, "11°")
    s.text(s.arc(D, P(D[0] - 130, D[1]), C, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    for i, p in enumerate(pts):
        c = P(200, 132); d = math.hypot(p[0]-c[0], p[1]-c[1]) or 1
        q = [p[0]+(p[0]-c[0])/d*21, p[1]+(p[1]-c[1])/d*21]
        for ly in (A[1], D[1]):
            if abs(q[1]-ly) < 13: q[1] = ly + (13 if q[1] > ly else -13)
        s.text(tuple(q), names[i], "#e8edff", 14)
    must("2(4) A の11度", angle_at(A, (A[0]-130, A[1]), B), 11)
    must("2(4) 答えのx", angle_at(D, (D[0]-130, D[1]), C), 25)
    return s.out()

# ---- 大問3(1) 外角定理（34°/19°→x） ----
def fig_3_1():
    # ★角のとおりに正しく描くと、20度の扇は 本当に20度しか開かない。
    #   15pxの文字が入らず 46度のラベルと 団子になった（監査①）。**図ごと1.5倍にする。**
    #   運用：20度以下の角がある図は、はじめから大きめに作る。
    A = P(48, 300); Bp = P(190, 300); right = P(427, 300)
    T = inter(A, polar(A, 54, 300), Bp, polar(Bp, 100, 300))
    R = inter(A, polar(A, 34, 400), Bp, polar(Bp, 53, 400))
    s = Svg(450, 342)
    s.line(A, right); s.line(A, T); s.line(A, R); s.line(T, Bp); s.line(R, Bp)
    s.text(s.arc(A, right, R, 69), "34°")
    s.text(s.arc(A, R, T, 96), "20°")
    s.text(s.arc(T, A, Bp, 39), "46°")
    s.text(s.arc(R, A, Bp, 39), "19°")
    s.text(s.arc(Bp, right, R, 39, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must("3(1) 34度", angle_at(A, right, R), 34)
    must("3(1) 20度", angle_at(A, R, T), 20)
    must("3(1) 46度", angle_at(T, A, Bp), 46)
    must("3(1) 19度", angle_at(R, A, Bp), 19)
    must("3(1) 答えのx", angle_at(Bp, right, R), 53)
    return s.out()

# ---- 大問3(2) 交わる2つの三角形（45°/38°/50°→x,y） ----
def fig_3_2():
    L = P(48, 196); Rb = P(268, 196)
    X = inter(L, polar(L, 45, 400), Rb, polar(Rb, 142, 400))
    dU = ang_of(Rb, X); U = polar(X, dU, 78)           # Rb→X の延長
    dW = ang_of(L, X)
    # U で ∠XUW = 50 になる向きの直線と、L→X の延長 との交点が W
    W = inter(U, polar(U, ang_of(U, X) + 50, 400), X, polar(X, dW, 400))
    s = Svg(320, 225)
    s.line(L, W); s.line(Rb, U); s.line(L, Rb); s.line(U, W)
    s.text(s.arc(L, Rb, X, 30), "45°")
    s.text(s.arc(Rb, L, X, 30), "38°")
    s.text(s.arc(U, X, W, 30), "50°")
    s.text(s.arc(X, Rb, W, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    s.text(s.arc(W, U, X, 26, COL_ARC2), "y", COL_ASK, 17, italic=True)
    must("3(2) 45度", angle_at(L, Rb, X), 45)
    must("3(2) 38度", angle_at(Rb, L, X), 38)
    must("3(2) 50度", angle_at(U, X, W), 50)
    must("3(2) 答えのx", angle_at(X, Rb, W), 83)
    must("3(2) 答えのy", angle_at(W, U, X), 33)
    return s.out()

# ---- 大問3(3) 二段の外角（62°/35°/25°→x,y） ----
def fig_3_3():
    A = P(34, 196); T = polar(A, 60, 205)
    M = (A[0] + 0.60 * (T[0] - A[0]), A[1] + 0.60 * (T[1] - A[1]))
    dTB = ang_of(T, A) + 62
    lo, hi = 60.0, 400.0
    for _ in range(80):                     # ∠TBM が 25度 になる所まで B を動かす
        mid = (lo + hi) / 2
        B = polar(T, dTB, mid)
        if angle_at(B, T, M) > 25: lo = mid
        else: hi = mid
    B = polar(T, dTB, (lo + hi) / 2)
    N = inter(M, B, A, polar(A, 25, 400))
    s = Svg(330, 235)
    s.line(A, T); s.line(T, B); s.line(M, B); s.line(A, N)
    s.text(s.arc(T, A, B, 30), "62°")
    s.text(s.arc(A, T, N, 34), "35°")
    s.arc(B, T, M, 30)
    s.lead((B[0] - 20, B[1] - 22), P(B[0] + 34, B[1] - 44), "25°")
    s.text(s.arc(M, A, N, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    s.text(s.arc(N, A, B, 26, COL_ARC2), "y", COL_ASK, 17, italic=True)
    must("3(3) 62度", angle_at(T, A, B), 62)
    must("3(3) 35度", angle_at(A, T, N), 35)
    must("3(3) 25度", angle_at(B, T, M), 25)
    must("3(3) 答えのx", angle_at(M, A, N), 87)
    must("3(3) 答えのy", angle_at(N, A, B), 122)
    return s.out()

# ---- 大問3(4) ブーメラン型（43°/82°/17°→x） ----
def fig_3_4():
    L = P(44, 196); Rb = P(300, 196)
    T = polar(L, 82, 175)
    V = inter(T, polar(T, ang_of(T, L) + 43, 400), Rb, polar(Rb, 163, 400))
    s = Svg(330, 225)
    s.line(L, T); s.line(L, Rb); s.line(T, V); s.line(V, Rb)
    s.text(s.arc(T, L, V, 28), "43°")
    s.text(s.arc(L, Rb, T, 30), "82°")
    s.arc(Rb, L, V, 30)
    s.lead((Rb[0] - 30, Rb[1] - 9), P(Rb[0] - 6, Rb[1] - 42), "17°")
    s.text(s.arc(V, T, Rb, 24, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must("3(4) 43度", angle_at(T, L, V), 43)
    must("3(4) 82度", angle_at(L, Rb, T), 82)
    must("3(4) 17度", angle_at(Rb, L, V), 17)
    must("3(4) 答えのx", angle_at(V, T, Rb), 142)
    return s.out()

def fig_1_2():
    """五角形の 1つの頂点から 対角線を2本ひくと 三角形が3つ できる"""
    pts = pentagon(150, 118, 82, 90)
    A = pts[0]
    s = Svg(300, 232)
    s.poly(pts)
    for i in (2, 3):
        s.line(A, pts[i], "#ffd166", 2)
    names = "ABCDE"
    for i, q in enumerate(pts):
        c = P(150, 118); d = math.hypot(q[0]-c[0], q[1]-c[1]) or 1
        s.text((q[0]+(q[0]-c[0])/d*20, q[1]+(q[1]-c[1])/d*20), names[i], "#e8edff", 13)
    for tri in [(0,1,2),(0,2,3),(0,3,4)]:
        cx = sum(pts[k][0] for k in tri)/3; cy = sum(pts[k][1] for k in tri)/3
        s.text(P(cx, cy), "180°", COL_ASK, 13)
    s.text(P(150, 222), "180°が 3つ ぶん", COL_GIVEN, 14)
    return s.out()

# ============================================================
#  大問（設問・答え・解説）
#   ★解説は「なぜそうなるか」まで書く（[[project_oton_gakuen]]の★真の目的）。
#   ★答えはPDF解答ページ(p8)と、こちらで解いた結果が 一致したものだけ。
# ============================================================
def build():
    d1 = {
        "id": "hd3s_n14_1", "src": "小3最レ【刷新版】No.14 大問1（実物・8月2回目の範囲）",
        "title": "内角の和と 正多角形の1つの角", "category": "zu", "unit": "平面図形",
        "grade": 3, "star": 1,
        "intro": "多角形（たかくけい）の**内角（ないかく）の和**を もとめます。"
                 "**三角形の内角の和が180度**、ここが すべての もとに なります。",
        "steps": [
            {"question": "三角形の内角の和は 何度ですか。", "answer": "180",
             "meaning": "①三角形の3つの かどを ちぎって 1つの点に あつめると、ぴったり まっすぐな線に ならびます。"
                        "②まっすぐな線（一直線）は180度。③だから 三角形の内角の和は **180度** です。"
                        "④この回の問題は、ぜんぶ ここから 出てきます。"},
            {"question": "五角形の内角の和は 何度ですか。", "answer": "540", "svg": fig_1_2(),
             "meaning": "①五角形の 1つの頂点（ちょうてん）から 対角線（たいかくせん）を ひくと、三角形が **3つ** に 分かれます。"
                        "②三角形1つで180度だから、180×3＝**540度**。"
                        "③□角形なら 三角形は（□−2）こ できるので、内角の和は **180×(□−2)** です。"},
            {"question": "正十角形の 1つの内角の 大きさは 何度ですか。", "answer": "144",
             "meaning": "①十角形の内角の和は 180×(10−2)＝1440度。"
                        "②正十角形は 10この角が ぜんぶ同じ大きさなので、1440÷10＝**144度**。"
                        "③**外角（がいかく）＝ 辺を まっすぐ のばしたときに できる、内角の となりの角**です。この **外角の和は どんな多角形でも 360度**。だから "
                        "1つの外角は 360÷10＝36度。となりあう内角と外角の和は180度だから 180−36＝144度。同じ答えです。"},
            {"question": "正□角形の 1つの内角の 大きさは 120度です。□に あてはまる数を もとめなさい。", "answer": "6",
             "meaning": "①1つの内角が120度なら、となりの外角は 180−120＝**60度**。"
                        "②外角の和は いつでも360度。同じ大きさの外角が □こ ならぶので、360÷60＝**6**。"
                        "③正六角形です。"
                        "④たしかめ：正六角形の内角の和は 180×(6−2)＝720度。720÷6＝**120度** で、ぴったり 合います。"},
        ],
    }
    d2 = {
        "id": "hd3s_n14_2", "src": "小3最レ【刷新版】No.14 大問2（実物・8月2回目の範囲）",
        "title": "平行線と 角（錯角をうつす）", "category": "zu", "unit": "平面図形",
        "grade": 3, "star": 2,
        "intro": "矢じりの ついた線は **平行（へいこう）** です。"
                 "**平行な2本の線に 1本の線が まじわると、ななめ向かいの角（錯角・さっかく）は 等しく なります。**"
                 "この「うつす」ことが できるかどうかが 勝負です。",
        "steps": [
            {"question": "角xの 大きさは 何度ですか。", "answer": "65", "svg": fig_2_1(),
             "meaning": "①xの頂点（ちょうてん）を通る、上下と **平行な線を もう1本** ひいてみます。"
                        "②すると 35度は 錯角で その線の 上がわに、30度は 錯角で 下がわに うつってきます。"
                        "③xは その2つを あわせた角になるので、x＝35＋30＝**65度**。"
                        "④「角の頂点に 平行線を1本 足す」——これが この単元でいちばん よく使う手です。"},
            {"question": "角xの 大きさは 何度ですか。", "answer": "53", "svg": fig_2_2(),
             "meaning": "①たての2本が 平行なので、45度は 錯角で 右のたて線のところへ うつります。"
                        "②右のたて線の上で、うつってきた45度・x・82度 の3つが **一直線** に ならびます。"
                        "③一直線は180度だから、x＝180−(45＋82)＝**53度**。"},
            {"question": "五角形ABCDEは 正五角形です。角xの 大きさは 何度ですか。", "answer": "60", "svg": fig_2_3(),
             "meaning": "①正五角形の 1つの内角は 180×(5−2)÷5＝**108度**。"
                        "②ここで **頂点（ちょうてん）Bを通って、上下の線と 平行な線を もう1本 ひきます**。"
                        "③上の線と この線は 平行だから、**xは 錯角で Bへ うつって**きます。"
                        "下の線と この線も 平行だから、**48度も 錯角で Bへ うつって**きます。"
                        "④Bに あつまった 角ABC（108度）が、うつってきた x と 48度 に 分かれているので、"
                        "x＝108−48＝**60度**。"},
            {"question": "五角形ABCDEは 正五角形です。角xの 大きさは 何度ですか。", "answer": "25", "svg": fig_2_4(),
             "meaning": "①正五角形の1つの内角は **108度**。"
                        "②頂点（ちょうてん）Aのところで 上の線は まっすぐ（180度）なので、"
                        "11度＋108度＋（辺AEと 上の線の間の角）＝180度。"
                        "つまり 辺AEと 上の線の間は 180−(11＋108)＝**61度**。"
                        "③つぎに **頂点Eを通って、上下の線と 平行な線を ひきます**。"
                        "上の線と この線は 平行なので、61度は 錯角で Eへ うつり、辺EAとの間に できます。"
                        "Eの内角は108度だから、のこりの **辺EDと この線の間は 108−61＝47度**。"
                        "④この線と 下の線も 平行なので、47度は 錯角で 頂点Dへ うつります。"
                        "⑤Dのところでも 下の線は まっすぐ（180度）なので、x＝180−(108＋47)＝**25度**。"
                        "⑥**角を1つずつ となりへ うつしていく**——遠くの角も これで つながります。"},
        ],
    }
    d3 = {
        "id": "hd3s_n14_3", "src": "小3最レ【刷新版】No.14 大問3（実物・8月2回目の範囲）",
        "title": "外角定理と ブーメラン型", "category": "zu", "unit": "平面図形",
        "grade": 3, "star": 2,
        "intro": "三角形の 1つの辺を そのまま のばすと、のばした線と となりの辺の あいだに 角が できます。"
                 "これを **外角（がいかく）** と いいます。"
                 "**三角形の外角は、その角と となりあっていない 2つの内角を たした 大きさ**に なります。"
                 "（となりの内角と外角を たすと 一直線で180度。三角形の内角の和も180度。"
                 "だから 外角は のこりの2つ分に なるのです。）",
        "steps": [
            {"question": "角xの 大きさは 何度ですか。", "answer": "53", "svg": fig_3_1(),
             "meaning": "①左下のかど34度と、右はしのかど19度を もつ三角形を 見ます。"
                        "②xは その三角形の **外角** です。"
                        "③だから x＝34＋19＝**53度**。"
                        "④46度と20度は 使わなくても 答えが 出ます。**どの三角形を 見るか**を えらべるかが この問題です。"},
            {"question": "角xの 大きさは 何度ですか。", "answer": "83", "svg": fig_3_2(),
             "meaning": "①下の辺と、2本の線が まじわった点で、三角形が1つ できています"
                        "（左下45度・右下38度・まじわった点）。"
                        "②45度の点から 来た線は、まじわった点で 止まらずに **そのまま 右上へ のびて います**。"
                        "③xは、その のびた先に できる角。つまり この三角形の **外角** です。"
                        "④外角は となりあっていない2つの内角の和だから、x＝45＋38＝**83度**。"},
            {"question": "角yの 大きさは 何度ですか。", "answer": "33", "svg": fig_3_2(),
             "meaning": "①こんどは 上がわの三角形（50度と y）を 見ます。"
                        "②さっき出した x（83度）が、その三角形の **外角** に なっています。"
                        "③外角定理より 83＝50＋y。④だから y＝83−50＝**33度**。"},
            {"question": "角xの 大きさは 何度ですか。", "answer": "87", "svg": fig_3_3(),
             "meaning": "①いちばん上の62度の点・xの点・右はしの25度の点、この3つで 三角形が できています。"
                        "②xの点は、62度の点から 左下へ おりていく 辺の **とちゅう** に あります。"
                        "だから xは、その辺を のばした先に できる角＝この三角形の **外角** です。"
                        "③外角は となりあっていない2つの内角の和なので、x＝62＋25＝**87度**。"},
            {"question": "角yの 大きさは 何度ですか。", "answer": "122", "svg": fig_3_3(),
             "meaning": "①左はしの35度と、いま出した x（87度）を もつ三角形を 見ます。"
                        "②yの点は、xの点から 右下へ のびる線の **上** に あるので、"
                        "xの点の角は さっきの **87度 そのまま** つかえます。"
                        "③yは その三角形の **外角** なので、y＝87＋35＝**122度**。"
                        "③**外角定理を 2回 つづけて 使う**問題です。1回目の答えが 2回目の材料に なります。"},
            {"question": "角xの 大きさは 何度ですか。", "answer": "142", "svg": fig_3_4(),
             "meaning": "①この へこんだ形は **ブーメラン型** と よばれます。"
                        "②図の x は、へこんだ点に できる 2つの角のうち、**弧（こ）の ついている ほう** です。"
                        "③ブーメラン型では、x は まわりの3つの角を **ぜんぶ たした** 大きさに なります。"
                        "x＝43＋82＋17＝**142度**。"
                        "④なぜ そうなるかは、**線を1本ひけば 自分で たしかめられます**。"
                        "43度の点から へこんだ点を とおる線を、そのまま まっすぐ のばして 下の線に ぶつけます。"
                        "ぶつかった点を ★ と します。"
                        "⑤上の三角形（43度・82度・★）で 外角定理を 1回つかうと、★の右がわの角＝43＋82＝**125度**。"
                        "⑥右の三角形（★・へこんだ点・17度の点）で もう1回つかうと、x＝125＋17＝**142度**。"
                        "⑦だから おぼえなくても、線を1本ひけば 出せます。"},
        ],
    }
    return [d1, d2, d3]

# ★2026-09-06：No.14は「最レの宿題」なので、復習テストではなく**宿題の引き出し**に入れる
#   （本人の指摘「これ 最レの宿題だよ」→ grades.3.sairei_new_bunsatsu.fukushu["14"]）
COURSE = "sairei_new_bunsatsu"
NO = "14"
DAIMON = "data/hama_daimon.json"

def main():
    recs = build() + build_rest()
    # --- 答えの形の見はり（[[feedback_answerable_format]]）---
    for r in recs:
        for st in r["steps"]:
            a = st["answer"]
            assert a.lstrip("-").isdigit(), "テンキーで打てない答え: %s (%s)" % (a, r["id"])
            assert st.get("meaning"), "解説がない: %s" % r["id"]
    n_steps = sum(len(r["steps"]) for r in recs)
    print("大問 %d 本 / 設問 %d 問 / 図 %d 枚" %
          (len(recs), n_steps, sum(1 for r in recs for s in r["steps"] if s.get("svg"))))
    print("角の検算 %d 件（NG %d）" % (len(CHECKS), sum(1 for c in CHECKS if not c[3])))

    # --- 書きこみ。★並行セッションが同じファイルを触るので、読んで→足して→すぐ書く ---
    d = json.load(io.open(DAIMON, encoding="utf-8"))
    g3 = d["grades"]["3"]
    g3.setdefault(COURSE, {}).setdefault("fukushu", {})[NO] = recs
    g3["sairei"].pop("units", None)          # 今年ぶんは sairei_new 側へ移してある
    io.open(DAIMON, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=1) + chr(10))
    print("書きこみ: %s ← 小3最レ（今年）の宿題 No.%s" % (DAIMON, NO))


# ============================================================
#  原簿（種本）へ書く文章を組み立てる。★アプリと同じ生成元から出す＝ずれない
# ============================================================
GENBO_HEAD = u"""
## ★★★ 小3最レ 刷新版 No.14「8月2回目 平面図形(2) 角①」（HG-1431〜1433）★2026-09-05 収録

**次男の次回復テ範囲**。**No.13「平面図形(1) いろいろな図形」の次の回**。全7大問・25小問。
> 📄 出典 `3年 最レNo.14 問題と解答.pdf`（全18ページ。問題 p1-7／解答 p8／解説 p9-18。スキャン202dpi・very clear）
> 入手経路：本人がGoogle Driveで共有 → リンク共有に切りかえてもらって取得（2026-09-05）。
> ローカルの実物：`C:/Users/User/Desktop/hama_in/no14.pdf`／ページ画像 `hama_in/pages/p01.jpeg`〜`p18.jpeg`

**★この回は「180度」1本の骨で7大問を回している。**
> **骨＝三角形の内角の和180度。一直線も180度。この2つが同じ数であることが すべての仕掛け。**
> **衣装**：①多角形の内角の和（大問1）②平行線の錯角でうつす（大問2）③外角定理（大問3）
> ④しるしの角の和＝形をつくりかえる（大問4・5）⑤同じしるしの角＝2つ分・3つ分で持つ（大問6・7）

**★この回でいちばん大事な発見は3つ**
1. **角は「となりへうつせる」**（平行線の錯角）。遠くの角も 1つずつ うつせば つながる
2. **外角＝となりあわない2つの内角の和**。だから「どの三角形を見るか」を えらべると 一気に短くなる
3. **和だけ分かればよい角がある**（大問4・5）。1つ1つの角は決まらないのに 和は決まる

**⚠この回の答え（p8で確定・こちらでも全問 解き直して一致）**
| 大問 | 答え |
|---|---|
| 1 | (1)180度 (2)540度 (3)144度 (4)六(6) |
| 2 | (1)65度 (2)53度 (3)60度 (4)25度 |
| 3 | (1)53度 (2)x83度・y33度 (3)x87度・y122度 (4)142度 |
| 4 | (1)180度 (2)360度 (3)180度 (4)540度 |
| 5 | (1)540度 (2)900度 (3)20度 |
| 6 | (1)70度 (2)80度 (3)129度 (4)100度 |
| 7 | (1)44度 (2)60度 |

**🚨 実物の図は 角度どおりに描かれていない（大問3(1)で確認）。**
問題ページの図では 19度の頂点が 46度の頂点より **低く** 描いてあるが、
与えられた角どおりに作図すると **19度の頂点のほうが高くなる**（底辺までを1として 46度側1.11／19度側1.37）。
→ **アプリ側は角度のとおりに正しく描いた**（目分量で測って答える誤学習を防ぐため）。塾講師監査2体とも妥当と判定。
> ⚠**ただし「角度どおりに描く」なら、20度以下の狭い角がある図は はじめから1.5倍で作ること。**
> 狭い角は扇形も狭いので、等倍だと 15pxの数字が入らず ラベルどうしが団子になる（実際に なった）。

**🚨 問題ページ(p03)の「19°」は 印刷が消えかけていて 数字が読めない。**
24倍まで拡大しても「°」しか残っていない。**解説ページ(p11)に「19°」と「外角定理 34+19=53(度)」が明記**されており、
本人（茅野さん）にも「3枚目の角度は消えていますが19度です」と確認ずみ（2026-09-05）。
**19度が無いと(1)は解けない**（46・20・34だけでは右の頂点が決まらないことを検証ずみ）。

"""

def genbo():
    recs = build()
    out = [GENBO_HEAD]
    meta = [
        ("HG-1431", "大問1（多角形の内角の和・正多角形の1つの内角）★",
         "**内角の和＝180×(□−2)**／**外角の和は いつでも360度**",
         "**「外角の和は360度」を使うと、正十角形も 正□角形も わり算1回で出る**（内角の和からより速い）",
         "図なし（アプリは(2)に「五角形→対角線2本→三角形3つ」の図を足した）",
         "★この回の土台。ここが崩れると 大問2以降が ぜんぶ止まる。(4)は**内角→外角に持ちかえる**練習で、"
         "小3の道具（わり算）だけで解ける形にしてある。文字式（180×(□−2)＝120×□ の移項）は 小3の範囲外なので使わない"),
        ("HG-1432", "大問2（平行線と角・錯角でうつす）★★",
         "**平行な2本の線に1本の線がまじわると 錯角は等しい**＝**角は となりへ うつせる**",
         "**角の頂点を通る「平行な線をもう1本ひく」**と、はなれた角が1か所に集まる。(4)は これを**2回**つなぐ",
         "あり（4問とも。(3)(4)は正五角形＋上下の平行線）",
         "★★(1)(2)で「うつす」を体にいれ、(3)で正五角形の108度と組ませ、(4)で**A→E→D と 2回うつす**。"
         "**同じ骨を4つの衣装で着せる**最レらしい並び。(4)は 補助の平行線を どこに引くかを 自分で決められるかが勝負"),
        ("HG-1433", "大問3（外角定理・ブーメラン型）★★",
         "**三角形の外角＝となりあわない2つの内角の和**",
         "**どの三角形を見るかを えらべると 一気に短くなる**。(1)は 46度と20度を**使わなくても解ける**",
         "あり（4問とも）",
         "★★(1)は**いらない数字が2つ入っている**（46度・20度）。"
         "(2)(3)は**外角定理を2回つづけて使う**（1回目の答えが2回目の材料）。"
         "(4)のブーメラン型は 暗記させない——**43度の点からへこんだ点を通る線を下の線まで のばす**と 三角形が2つでき、"
         "外角定理2回で 自分で出せる"),
    ]
    for r, (hg, title, hone, core, zu, memo) in zip(recs, meta):
        out.append(u"### 【%s】小3最レ（刷新版）No.14 %s\n" % (hg, title))
        out.append(u"- 骨: %s\n" % hone)
        out.append(u"- コア発見: %s\n" % core)
        out.append(u"- 設定: %s\n" % r["intro"].replace("**", "").replace("\n", ""))
        qs = " ".join("(%d) %s" % (i + 1, st["question"]) for i, st in enumerate(r["steps"]))
        out.append(u"- 設問: %s\n" % qs)
        ans = " ".join("(%d) %s度" % (i + 1, st["answer"]) for i, st in enumerate(r["steps"]))
        out.append(u"- 図: %s ／ 答え: %s\n" % (zu, ans.replace("(4) 6度", "(4) 六角形（□＝6）")))
        for i, st in enumerate(r["steps"]):
            out.append(u"- 解法(%d): %s\n" % (i + 1, st["meaning"].replace("**", "")))
        out.append(u"- 作問メモ: %s\n" % memo)
        out.append(u"- アプリ実装: `data/hama_daimon.json` grades.3.sairei.units[\"平面図形(2) 角①\"] の `%s`"
                   u"（生成元 `scripts/gen_s3sairei_no14.py`。**JSONを手で書かない**）\n" % r["id"])
        for i, st in enumerate(r["steps"]):
            if st.get("svg"):
                out.append(u"- 図SVG(%d):\n```html\n%s\n```\n" % (i + 1, st["svg"]))
        out.append(u"\n")
    out.append(u"> **未収録：大問4〜7（11小問）**。図がこみいっているので次の波で入れる。"
               u"答えは上の表で確定ずみ、ページ画像も手元にある（p04〜p07／解説 p12〜p18）。\n\n")
    return "".join(out)

# ============================================================
#  大問6・7（同じしるしのついた角）
#   ★しるしが同じ角＝同じ大きさ。図は「しるしの関係」が本体なので、
#     具体の角度は関係を満たす値を選んで**正確に**作図する。
# ============================================================
def marks(s, v, p, q, n, r0=26, step=9, col=COL_MARK, filled=True):
    """頂点 v の p〜q の間を n 等分し、区切りごとに ○ か ● を置く"""
    a1, a2 = ang_of(v, p), ang_of(v, q)
    d = (a2 - a1) % 360
    if d > 180: a1, a2, d = a2, a1, 360 - d
    for k in range(n):
        mid = a1 + d * (k + 0.5) / n
        s.dot(polar(v, mid, r0 + step * 0), filled, 4.2, col)
        s.b.append('<path d="M %.1f %.1f A %d %d 0 0 0 %.1f %.1f" fill="none" stroke="%s" stroke-width="1.6"/>'
                   % (*polar(v, a1 + d * k / n, r0 + 12), r0 + 12, r0 + 12,
                      *polar(v, a1 + d * (k + 1) / n, r0 + 12), col))

# ---- 大問7(1) ○+22=● を2倍する ----
def fig_7_1():
    O, KURO = 30.0, 52.0                      # ○=30 → ●=○+22=52
    L = P(44, 212); M = P(180, 212); right = P(336, 212)
    # Mでの外角が●（底辺の右向きから●だけ回した先がR、さらに●回した先がT）
    R = inter(L, polar(L, O, 500), M, polar(M, KURO, 500))
    T = inter(L, polar(L, 2 * O, 500), M, polar(M, 2 * KURO, 500))
    s = Svg(350, 245)
    s.line(L, right); s.line(L, R); s.line(L, T); s.line(M, R); s.line(M, T)
    s.text(s.arc(R, L, M, 26), "22°")
    s.text(s.arc(T, L, M, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    marks(s, L, right, T, 2, 24, filled=False)
    marks(s, M, right, T, 2, 24, filled=True)
    must("7(1) 22度", angle_at(R, L, M), 22)
    must("7(1) 左の○が2つとも同じ", angle_at(L, right, R), angle_at(L, R, T))
    must("7(1) 右の●が2つとも同じ", angle_at(M, right, R), angle_at(M, R, T))
    must("7(1) 答えのx", angle_at(T, L, M), 44)
    return s.out()

# ---- 大問7(2) 3重の三角形（○3つ・●3つ）----
def fig_7_2():
    O, KURO = 22.0, 18.0                       # 3(○+●)=120 → ア=60
    L = P(48, 246); R = P(322, 246)
    ap = [inter(L, polar(L, O * k, 600), R, polar(R, 180 - KURO * k, 600)) for k in (1, 2, 3)]
    s = Svg(370, 282)
    s.line(L, R)
    for a in ap: s.line(L, a); s.line(a, R)
    for a, nm in zip(reversed(ap), ["ア", "イ", "ウ"]):
        s.text(s.arc(a, L, R, 24, COL_ARC2), nm, COL_ASK, 16)
    marks(s, L, R, ap[2], 3, 30, 0, COL_MARK, False)
    marks(s, R, L, ap[2], 3, 30, 0, COL_MARK, True)
    must("7(2) ウ", angle_at(ap[0], L, R), 140)
    must("7(2) イ", angle_at(ap[1], L, R), 100)
    must("7(2) 答えのア", angle_at(ap[2], L, R), 60)
    must("7(2) イとウの和が240", angle_at(ap[0], L, R) + angle_at(ap[1], L, R), 240)
    return s.out()

def side_of(a, b, p):
    """直線 ab に対して p がどちら側か（符号）"""
    return (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0])

def bisect_dir(v, p, q):
    """頂点 v で ∠pvq を2等分する向き（度）"""
    a1, a2 = ang_of(v, p), ang_of(v, q)
    d = (a2 - a1) % 360
    if d > 180: a1, d = a2, 360 - d
    return a1 + d / 2

# ---- 大問6(1) 四角形の360度から x を出す（55°）----
def fig_6_1():
    # ∠L=55・∠R=70（x）→ ∠T=55。四角形TBCLの残り2つが 2○+2● = 250 になる
    # ★底辺を広くとると 頂点が上へ出すぎる（実測 y=-38）。180 に縮めた
    L = P(58, 230); R = P(238, 230)
    T = inter(L, polar(L, 55, 600), R, polar(R, 110, 600))
    b = 0.46
    B = (T[0] + b*(R[0]-T[0]), T[1] + b*(R[1]-T[1]))
    lo, hi = 0.05, 0.95                      # C を動かして A が 辺TL に乗る所を探す
    def Aof(c):
        C = (L[0] + c*(R[0]-L[0]), L[1] + c*(R[1]-L[1]))
        return C, inter(B, polar(B, bisect_dir(B, T, C), 600),
                        C, polar(C, bisect_dir(C, B, L), 600))
    for _ in range(70):
        mid = (lo+hi)/2
        C, A = Aof(mid)
        if side_of(T, L, A) > 0: lo = mid
        else: hi = mid
    C, A = Aof((lo+hi)/2)
    s = Svg(320, 272)
    s.poly([T, L, R]); s.line(B, C); s.line(A, B); s.line(A, C)
    s.text(s.arc(A, B, C, 26), "55°")
    s.text(s.arc(R, T, L, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    marks(s, B, T, C, 2, 22, 0, COL_MARK, False)
    marks(s, C, B, L, 2, 22, 0, COL_MARK, True)
    must("6(1) 55度", angle_at(A, B, C), 55)
    must("6(1) ○が2つとも同じ", angle_at(B, T, A), angle_at(B, A, C))
    must("6(1) ●が2つとも同じ", angle_at(C, B, A), angle_at(C, A, L))
    must("6(1) 答えのx", angle_at(R, T, L), 70)
    return s.out()

# ---- 大問6(2) 上の三角形と下の三角形（50°）----
def fig_6_2():
    KURO = 65.0                               # ●＝○＝65（●+○=180-50）
    Pp = P(104, 148); Q = P(216, 148)
    S = inter(Pp, polar(Pp, -KURO, 400), Q, polar(Q, 180 + KURO, 400))
    V = inter(Pp, polar(Pp, 180 - 2*KURO, 400), Q, polar(Q, 2*KURO, 400))
    dL = polar(Pp, ang_of(V, Pp), 92)         # 左の辺を下へのばす
    dR = polar(Q, ang_of(V, Q), 92)
    s = Svg(330, 300)
    s.line(V, dL); s.line(V, dR); s.line(Pp, Q); s.line(Pp, S); s.line(Q, S)
    s.text(s.arc(S, Pp, Q, 26), "50°")
    s.text(s.arc(V, Pp, Q, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    marks(s, Pp, Q, dL, 2, 22, 0, COL_MARK, True)
    marks(s, Q, Pp, dR, 2, 22, 0, COL_MARK, False)
    must("6(2) 50度", angle_at(S, Pp, Q), 50)
    must("6(2) ●が2つとも同じ", angle_at(Pp, Q, S), angle_at(Pp, S, dL))
    must("6(2) ○が2つとも同じ", angle_at(Q, Pp, S), angle_at(Q, S, dR))
    must("6(2) 答えのx", angle_at(V, Pp, Q), 80)
    return s.out()

def three_split(TT, L, R, n):
    """頂点 TT の角を n 等分する線が 底辺 LR と交わる点（Lに近い順）"""
    a1, a2 = ang_of(TT, L), ang_of(TT, R)
    d = (a2 - a1) % 360
    if d > 180: a1, d = a2, 360 - d
    out = [inter(TT, polar(TT, a1 + d*k/n, 900), L, R) for k in range(1, n)]
    out.sort(key=lambda p: p[0])
    return out

# ---- 大問6(3) ○=33・●=18 → x=129 ----
def fig_6_3():
    L = P(38, 226); R = P(336, 226)
    T = inter(L, polar(L, 36, 900), R, polar(R, 135, 900))      # ∠L=36(=2●) ∠R=45 ∠T=99(=3○)
    D1, D2 = three_split(T, L, R, 3)
    E = inter(L, polar(L, 18, 900), T, D1)                       # Lの2等分線と 左のセビアン
    s = Svg(380, 268)
    s.poly([T, L, R]); s.line(T, D1); s.line(T, D2); s.line(L, polar(L, 18, 300))
    s.text(s.arc(D1, L, T, 30), "111°")
    s.text(s.arc(R, T, L, 28), "45°")
    s.text(s.arc(E, L, T, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    marks(s, T, L, R, 3, 30, 0, COL_MARK, False)
    marks(s, L, R, T, 2, 34, 0, COL_MARK, True)
    must("6(3) 45度", angle_at(R, T, L), 45)
    must("6(3) 111度", angle_at(D1, L, T), 111)
    must("6(3) ○は3つとも同じ", angle_at(T, L, D1), angle_at(T, D1, D2))
    must("6(3) ●は2つとも同じ", angle_at(L, R, E), angle_at(L, E, T))
    must("6(3) 答えのx", angle_at(E, L, T), 129)
    return s.out()

# ---- 大問6(4) ○+●=50 → x=100 ----
def fig_6_4():
    L = P(38, 232); R = P(340, 232)
    T = inter(L, polar(L, 40, 900), R, polar(R, 130, 900))      # ∠L=40(=2●) ∠R=50 ∠T=90(=3○)
    D1, D2 = three_split(T, L, R, 3)
    E = inter(L, polar(L, 20, 900), T, D1)
    Eout = polar(L, 20, 320)                  # Lの線を E の先までのばした所
    s = Svg(384, 276)
    s.poly([T, L, R]); s.line(T, D1); s.line(T, D2); s.line(L, Eout)
    s.text(s.arc(E, Eout, T, 28), "50°")      # ★50度は E の「外角」のほう
    s.text(s.arc(D2, R, T, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    marks(s, T, L, R, 3, 30, 0, COL_MARK, False)
    marks(s, L, R, T, 2, 34, 0, COL_MARK, True)
    must("6(4) 50度", angle_at(E, polar(L, 20, 320), T), 50)
    must("6(4) ○は3つとも同じ", angle_at(T, L, D1), angle_at(T, D1, D2))
    must("6(4) ●は2つとも同じ", angle_at(L, R, E), angle_at(L, E, T))
    must("6(4) 答えのx", angle_at(D2, R, T), 100)
    return s.out()

# ============================================================
#  大問4・5（しるしのついた角の和）
#   ★ここは「どの点にしるしが付いているか」が問題の本体。
#     図は座標で組み立て、**しるしの角を実際に足して**答えと合うか検算する。
#   ⚠ 実物は手がきで、重なった多角形の形が正確ではない。アプリ側は
#     **しるしの数と、たがいの重なり方（どの多角形の角か）をそろえて、きれいに引き直した**。
#     和は図の形によらないので、答えも解き方も変わらない。
# ============================================================
def star_path(cx, cy, r, n, skip=2, rot=90, jitter=None, ang=None):
    """n個の点を skip 個とばしに結んだ **一筆書きの星**（五芒星など）。
       ★とがりの角の和は 180×(n − 2×まわった回数)。skip=2 なら 2回まわるので
         n=5 → 180度、n=7 → 540度 になる。**形をゆがめても和は変わらない**（実際に足して検算する）"""
    base = [polar(P(cx, cy), (ang[k] if ang else rot + 360.0 * k / n),
                  r * (jitter[k] if jitter else 1)) for k in range(n)]
    return [base[(k * skip) % n] for k in range(n)]

def sum_marks(s, pts, idx, r=22, col=COL_ARC):
    """輪郭 pts のうち idx の点にしるしの弧をつけ、その角の合計を返す"""
    tot = 0.0
    n = len(pts)
    for i in idx:
        a, b, c = pts[(i - 1) % n], pts[i], pts[(i + 1) % n]
        s.arc(b, a, c, r, col)
        tot += angle_at(b, a, c)
    return tot

# ---- 大問4(1) 五芒星（とがり5つ）→ 180 ----
def fig_4_1():
    pts = star_path(170, 152, 126, 5, 2, 90, [1.0, 0.94, 1.06, 1.02, 0.96])
    s = Svg(340, 306)
    s.poly(pts)
    tot = sum_marks(s, pts, range(5), 20)
    must("4(1) しるしの角の和", tot, 180)
    return s.out()

# ---- 大問4(2) 三角形2つが重なる（とがり6つ）→ 360 ----
def fig_4_2():
    A = [polar(P(168, 152), 90 + 120 * k, 118) for k in range(3)]
    B = [polar(P(168, 152), 30 + 120 * k, 112) for k in range(3)]
    s = Svg(336, 300)
    s.poly(A); s.poly(B)
    tot = 0.0
    for T in (A, B):
        for i in range(3):
            s.arc(T[i], T[(i - 1) % 3], T[(i + 1) % 3], 26)
            tot += angle_at(T[i], T[(i - 1) % 3], T[(i + 1) % 3])
    must("4(2) しるしの角の和", tot, 360)
    return s.out()

# ---- 大問4(3) 大きな3つと 内がわの細い2つ（とがり5つ）→ 180 ----
def fig_4_3():
    # 3つは大きなとがり、2つは内がわの細いとがり（実物と同じ見え方）
    pts = star_path(172, 152, 128, 5, 2, 90, None, [90, 150, 210, 330, 30])
    s = Svg(346, 306)
    s.poly(pts)
    tot = sum_marks(s, pts, range(5), 18)
    must("4(3) しるしの角の和", tot, 180)
    return s.out()

# ---- 大問4(4) 四角形2つが重なる（とがり7つ）→ 540 ----
def fig_4_4():
    pts = star_path(174, 160, 132, 7, 2, 90, [1.0, 0.95, 1.05, 0.98, 1.03, 0.96, 1.01])
    s = Svg(352, 322)
    s.poly(pts)
    tot = sum_marks(s, pts, range(7), 24)
    must("4(4) しるしの角の和", tot, 540)
    return s.out()

# ---- 大問5(1) 三角形と四角形（3+4=7つ）→ 180+360=540 ----
def fig_5_1():
    c = P(176, 158)
    tri = [polar(c, 90 + 120 * k, 128) for k in range(3)]
    quad = [polar(c, 40 + 90 * k, 118) for k in range(4)]
    s = Svg(354, 316)
    s.poly(tri); s.poly(quad)
    tot = 0.0
    for T in (tri, quad):
        n = len(T)
        for i in range(n):
            s.arc(T[i], T[(i - 1) % n], T[(i + 1) % n], 26)
            tot += angle_at(T[i], T[(i - 1) % n], T[(i + 1) % n])
    must("5(1) しるしの角の和", tot, 540)
    return s.out()

# ---- 大問5(2) 六角形と三角形（6+3=9つ）→ 720+180=900 ----
def fig_5_2():
    c = P(180, 168)
    hexa = [polar(c, 90 + 60 * k, 132) for k in range(6)]
    tri = [polar(c, 30 + 120 * k, 152) for k in range(3)]
    s = Svg(362, 336)
    s.poly(hexa); s.poly(tri)
    tot = 0.0
    for T in (hexa, tri):
        n = len(T)
        for i in range(n):
            s.arc(T[i], T[(i - 1) % n], T[(i + 1) % n], 24)
            tot += angle_at(T[i], T[(i - 1) % n], T[(i + 1) % n])
    must("5(2) しるしの角の和", tot, 900)
    return s.out()

# ---- 大問5(3) 70/45/40/23/12/88/62 と x（8つの角の和＝360）→ x=20 ----
def poly_from_angles(angles, start_dir=0.0, scale=120.0):
    """内角を順に指定して、閉じる多角形を作る。
       ★とがりの角を1つずつ指定できるので、実物の数字（70・88・…）を
         そのまま持つ図が作れる。辺の長さは「閉じる」ように連立で決める。"""
    n = len(angles)
    dirs, d = [], start_dir
    for a in angles:
        dirs.append(d)
        d += 180.0 - a                      # 外角のぶんだけ向きを変える
    ux = [math.cos(math.radians(t)) for t in dirs]
    uy = [-math.sin(math.radians(t)) for t in dirs]
    # Σ L_i u_i = 0（＝閉じる）を、2本の辺の長さを未知数にした連立で **正確に** 解く。
    # 残りの辺は長めの既定値にしておき、補正しても正のままになるようにする。
    base = 3.0
    for a in range(n):
        for b in range(a + 1, n):
            L = [base] * n
            ex = sum(L[i] * ux[i] for i in range(n))
            ey = sum(L[i] * uy[i] for i in range(n))
            det = ux[a] * uy[b] - uy[a] * ux[b]
            if abs(det) < 1e-6: continue
            da = (-ex * uy[b] + ey * ux[b]) / det
            db = (-ux[a] * ey + uy[a] * ex) / det
            L[a] += da; L[b] += db
            if min(L) > 0.25:
                ex2 = sum(L[i] * ux[i] for i in range(n))
                ey2 = sum(L[i] * uy[i] for i in range(n))
                if abs(ex2) < 1e-7 and abs(ey2) < 1e-7:
                    break
        else:
            continue
        break
    else:
        raise AssertionError("閉じる辺の長さが見つからない")
    pts, x, y = [], 0.0, 0.0
    for i in range(n):
        pts.append((x, y)); x += L[i] * ux[i] * scale; y += L[i] * uy[i] * scale
    return pts

def fig_5_3():
    # 実物の7つの数字＋x。和は 360（＝四角形の内角の和）になる並び
    vals = [70, 40, 45, 23, 62, 20, 12, 88]
    pts = poly_from_angles([float(v) for v in vals], 8.0, 96.0)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    ox, oy = 34 - min(xs), 40 - min(ys)
    pts = [(p[0] + ox, p[1] + oy) for p in pts]
    W = int(max(p[0] for p in pts) + 40); H = int(max(p[1] for p in pts) + 40)
    s = Svg(W, H)
    s.poly(pts)
    n = len(pts); tot = 0.0
    for i, v in enumerate(vals):
        # ★向きを変えるのは「辺の終わり」なので、角 vals[i] が付くのは pts[i+1]
        j = (i + 1) % n
        a, b, c = pts[(j - 1) % n], pts[j], pts[(j + 1) % n]
        got = angle_at(b, a, c)
        must("5(3) %d番目の角" % (i + 1), got, float(v))
        tot += got
        lp = s.arc(b, a, c, 22, COL_ARC2 if v == 20 else COL_ARC)
        if v == 20: s.text(lp, "x", COL_ASK, 17, italic=True)
        else: s.text(lp, "%d°" % v)
    must("5(3) しるしの角の和", tot, 360)
    return s.out()

def build_rest():
    """大問4〜7（11問）"""
    d4 = {
        "id": "hd3s_n14_4", "src": "小3最レ【刷新版】No.14 大問4（実物・8月2回目の範囲）",
        "title": "しるしの角の和（形をつくりかえる）", "category": "zu", "unit": "平面図形",
        "grade": 3, "star": 3,
        "intro": "しるしの ついた角を **1つずつ もとめようとしても 出ません**。"
                 "でも **和（ぜんぶ たしたもの）だけなら 出ます**。"
                 "**外角定理を つかって 角を となりへ 寄せあつめると、"
                 "三角形や 四角形の 内角の和に つくりかえられる** からです。",
        "steps": [
            {"question": "しるしが ついている角の 大きさの 和は 何度ですか。", "answer": "180", "svg": fig_4_1(),
             "meaning": "①星の とがりは 5つ。1つずつは 分かりません。"
                        "②2つの とがり（アとエ）を 見ると、その2つを たしたものが、"
                        "交わった点の 角に なっています（外角定理）。"
                        "③そうやって 寄せると、のこりの3つ（イ・ウ・オ）と あわせて **1つの三角形**に なります。"
                        "④三角形の内角の和は180度。だから 和は **180度**。"},
            {"question": "しるしが ついている角の 大きさの 和は 何度ですか。", "answer": "360", "svg": fig_4_2(),
             "meaning": "①とがりは 6つ。**三角形が2つ 重なった形**です。"
                        "②片方の三角形の3つで180度、もう片方の3つで180度。"
                        "③だから 和は 180＋180＝**360度**。"
                        "④四角形の内角の和と 同じ数に なります。"},
            {"question": "しるしが ついている角の 大きさの 和は 何度ですか。", "answer": "180", "svg": fig_4_3(),
             "meaning": "①大きな とがりが3つ、内がわに 細い とがりが2つ。ぜんぶで **5つ**。"
                        "②(1)の星と **同じ 5つのとがり**です。形が ちがっても、"
                        "**とがりの数が同じなら 和も同じ**。"
                        "③だから 和は **180度**。"
                        "④「形がちがうから ちがう答え」と 思わないこと。ここが この問題の ねらいです。"},
            {"question": "しるしが ついている角の 大きさの 和は 何度ですか。", "answer": "540", "svg": fig_4_4(),
             "meaning": "①とがりは **7つ**（四角形が2つ 重なった形）。"
                        "②とがり1つずつに 三角形が1つ ついているので、三角形の内角の和が 7つ分＝180×7＝1260度。"
                        "③ただし そのなかで、まん中の 七角形の **外角の和を 2つ分** 余分に 数えています。"
                        "外角の和は いつでも360度なので、360×2＝720度 を ひきます。"
                        "④1260−720＝**540度**。"},
        ],
    }
    d5 = {
        "id": "hd3s_n14_5", "src": "小3最レ【刷新版】No.14 大問5（実物・8月2回目の範囲）",
        "title": "しるしの角の和（もっと大きな形）", "category": "zu", "unit": "平面図形",
        "grade": 3, "star": 3,
        "intro": "大問4と 同じ考え方を、もっと大きな形で つかいます。"
                 "**重なっている形を 見わけて、それぞれの内角の和を たす**のが はやいです。"
                 "（□角形の内角の和は 180×(□−2)）",
        "steps": [
            {"question": "しるしが ついている角の 大きさの 和は 何度ですか。", "answer": "540", "svg": fig_5_1(),
             "meaning": "①**三角形と四角形が 重なっている**形です。"
                        "②しるしは 三角形の3つと 四角形の4つ。"
                        "③三角形は180度、四角形は 180×(4−2)＝360度。"
                        "④だから 和は 180＋360＝**540度**。"},
            {"question": "しるしが ついている角の 大きさの 和は 何度ですか。", "answer": "900", "svg": fig_5_2(),
             "meaning": "①**六角形と三角形が 重なっている**形です。"
                        "②六角形の内角の和は 180×(6−2)＝720度。"
                        "③三角形は180度。"
                        "④だから 和は 720＋180＝**900度**。"},
            {"question": "角xの 大きさは 何度ですか。", "answer": "20", "svg": fig_5_3(),
             "meaning": "①しるしの ついた角は ぜんぶで 8つ（xも入れて）。"
                        "②この形の とがりの和は **360度**（四角形の内角の和と同じ）に なります。"
                        "③分かっている7つを たすと 70＋40＋45＋23＋62＋12＋88＝340度。"
                        "④だから x＝360−340＝**20度**。"
                        "⑤**1つずつ出そうとしない**。和が決まっていることに 気づけば、ひき算1回です。"},
        ],
    }
    d6 = {
        "id": "hd3s_n14_6", "src": "小3最レ【刷新版】No.14 大問6（実物・8月2回目の範囲）",
        "title": "同じしるしの角（2つ分・3つ分で持つ）", "category": "zu", "unit": "平面図形",
        "grade": 3, "star": 3,
        "intro": "**同じしるしの ついた角は 同じ大きさ**です。"
                 "○や●が いくつ分 あるかを 数えて、**○1つの大きさが 分からなくても、"
                 "○2つ分・○3つ分の まま 計算を すすめる**のが コツです。",
        "steps": [
            {"question": "角xの 大きさは 何度ですか。", "answer": "70", "svg": fig_6_1(),
             "meaning": "①55度の 三角形を 見ると、○＋●＝180−55＝**125度**。"
                        "②図の中の 四角形には、○が2つ分と ●が2つ分 入っています。"
                        "○○●●＝125×2＝**250度**。"
                        "③四角形の内角の和は360度だから、のこりの2つ（大きな三角形の 上と 左下の角）は "
                        "360−250＝**110度**。"
                        "④大きな三角形の内角の和は180度なので、x＝180−110＝**70度**。"},
            {"question": "角xの 大きさは 何度ですか。", "answer": "80", "svg": fig_6_2(),
             "meaning": "①50度の 三角形を 見ると、○＋●＝180−50＝**130度**。"
                        "②○2つ分と ●2つ分で 130×2＝**260度**。"
                        "③まわりの角は ぜんぶで360度だから、のこりの2つは 360−260＝**100度**。"
                        "④三角形の内角の和は180度なので、x＝180−100＝**80度**。"},
            {"question": "角xの 大きさは 何度ですか。", "answer": "129", "svg": fig_6_3(),
             "meaning": "①111度は 外角なので、外角定理で ○2つ分＋45度＝111度。"
                        "だから ○＝(111−45)÷2＝**33度**。"
                        "②大きな三角形の内角の和から、●2つ分＝180−(○3つ分)−45"
                        "＝180−99−45＝36度。だから ●＝36÷2＝**18度**。"
                        "③xは、●と111度を もつ三角形の 外角です。"
                        "④外角定理より x＝18＋111＝**129度**。"},
            {"question": "角xの 大きさは 何度ですか。", "answer": "100", "svg": fig_6_4(),
             "meaning": "①50度は、●1つと ○1つを もつ三角形の 外角です。"
                        "だから ○＋●＝**50度**。"
                        "②xは、●2つ分と ○2つ分を もつ三角形の 外角です。"
                        "③外角定理より x＝○○＋●●＝(○＋●)×2＝50×2＝**100度**。"
                        "④**○や●の1つ分は 最後まで 分かりません**。それでも答えは 出ます。"},
        ],
    }
    d7 = {
        "id": "hd3s_n14_7", "src": "小3最レ【刷新版】No.14 大問7（実物・8月2回目の範囲）",
        "title": "同じしるしの角（まとめ）", "category": "zu", "unit": "平面図形",
        "grade": 3, "star": 3,
        "intro": "この回の しあげです。**○や●の 1つ分は 分からないまま**、"
                 "「何つ分か」だけで 答えまで たどりつきます。",
        "steps": [
            {"question": "角xの 大きさは 何度ですか。", "answer": "44", "svg": fig_7_1(),
             "meaning": "①まず 小さい三角形で 外角定理：○＋22度＝**●**。"
                        "②つぎに 大きい三角形で 外角定理：○2つ分＋x＝**●2つ分**。"
                        "③①の式を **まるごと2倍** すると ○2つ分＋44度＝●2つ分。"
                        "④②と くらべると、x＝22×2＝**44度**。"
                        "⑤**式をまるごと2倍する**——これが この問題の 手です。"},
            {"question": "角アの 大きさは 何度ですか。", "answer": "60", "svg": fig_7_2(),
             "meaning": "①いちばん内がわの三角形で ○＋●＋ウ＝180度。"
                        "②まん中の三角形で ○2つ分＋●2つ分＋イ＝180度。"
                        "③この2つを たすと ○3つ分＋●3つ分＋ウ＋イ＝360度。"
                        "④ウ＋イ＝240度 と 言われているので、○3つ分＋●3つ分＝360−240＝**120度**。"
                        "⑤いちばん外がわの三角形は ○3つ分＋●3つ分＋ア＝180度。"
                        "だから ア＝180−120＝**60度**。"},
        ],
    }
    return [d4, d5, d6, d7]

if __name__ == "__main__":
    main()
