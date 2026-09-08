# -*- coding: utf-8 -*-
u"""小3最レ【刷新版】No.15「9月1回目 平面図形(3) 角②」を実物から実装する。

  出典: 「3年 最レ算数 第2分冊.pdf」p52-58（問題）／「解答 3年 最レ算数 第2分冊.pdf」p42-50（解答・解説）
        どちらも 2026-09-05 に本人がGoogle Driveへ追加 → リンク共有で取得（[[tool_drive_pdf_torikomi]]）
  ローカルの実物: C:/Users/User/Desktop/hama_in/s3sairei_b2.pdf ／ s3sairei_b2_ans.pdf
                  ページ画像 hama_in/b2/p052.jpeg〜p058.jpeg（問題）、hama_in/b2a/p042.jpeg〜p050.jpeg（解答）
  原簿: HG-1442〜1448（大問1〜7）※HG-1438〜1440は空き、HG-1441は小5理科で使用ずみのため1442から

  ★方針（[[feedback_genbo_dori]] [[feedback_zu_wa_genbo_ni_nai]] [[feedback_jitsubutsu_zenbu_soroeru]]）
    ・全7大問17小問を まるごと入れる。途中で切らない
    ・設問・数値・答えは実物のまま。答え方の様式だけ変える
      （「角x, yはそれぞれ何度」→ x を聞く設問と y を聞く設問に分ける＝19問になる）
    ・図は実物を見て**座標で組み立て**、印字してある角度・長さを**座標から測り直して検算**する
    ・答えは 解答ページ(p42)と こちらで解き直した結果の**両方が一致**したものだけ入れる
"""
import math, json, io, os, sys
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zu_kit import (P, polar, ang_of, angle_at, dist, unit, lerp, mid, rot_about,
                    inter, shift, must, CHECKS, check_report, Svg,
                    COL_LINE, COL_GIVEN, COL_ASK, COL_ARC, COL_ARC2, COL_MARK, COL_SUB)

COURSE = "sairei_new_bunsatsu"
NO = "15"
DAIMON = "data/hama_daimon.json"

S3 = math.sqrt(3)


# ============================================================
#  大問1 正方形と正三角形を重ねる
# ============================================================
def fig_1_1():
    u"""正方形ABCD（A左上・B左下・C右下・D右上）に 正三角形EBC が内がわに立つ"""
    a = 148
    A = P(62, 34); B = P(62, 34 + a); C = P(62 + a, 34 + a); D = P(62 + a, 34)
    E = P(A[0] + a / 2, B[1] - a * S3 / 2)
    s = Svg(300, 232)
    s.poly([A, B, C, D])
    for p, q in [(A, E), (E, D), (E, B), (E, C)]:
        s.line(p, q)
    s.vtext(A, C, "A"); s.vtext(B, D, "B"); s.vtext(C, A, "C"); s.vtext(D, B, "D")
    s.text(polar(E, 202.5, 20), "E", COL_LINE, 14)
    s.text(s.arc(D, E, C, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must(u"1(1) EB=BC", dist(E, B), a, 0.5)
    must(u"1(1) EC=BC", dist(E, C), a, 0.5)
    must(u"1(1) 答えのx＝角EDC", angle_at(D, E, C), 75)
    return s.out()


def fig_1_2():
    u"""正方形ABCD（A左上・B左下・C右下・D右上）の 左がわに 正三角形EBA"""
    a = 140
    A = P(152, 36); B = P(152, 36 + a); C = P(152 + a, 36 + a); D = P(152 + a, 36)
    E = P(A[0] - a * S3 / 2, A[1] + a / 2)
    X = inter(B, D, E, C)
    s = Svg(340, 218)
    s.poly([A, B, C, D])
    for p, q in [(E, A), (E, B), (E, C), (B, D)]:
        s.line(p, q)
    s.vtext(A, C, "A"); s.vtext(B, D, "B"); s.vtext(C, A, "C"); s.vtext(D, B, "D")
    s.text(polar(E, 180, 15), "E", COL_LINE, 14)
    s.text(s.arc(X, D, C, 24, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must(u"1(2) EA=AB", dist(E, A), a, 0.5)
    must(u"1(2) EB=AB", dist(E, B), a, 0.5)
    must(u"1(2) 答えのx", angle_at(X, D, C), 60)
    return s.out()


# ============================================================
#  大問2 円の半径はみんな同じ長さ
# ============================================================
def fig_2_1():
    u"""中心O・半径rのおうぎ形。A(159°)・B(119°)・C(21°)が円周上"""
    O = P(160, 206); r = 140
    A = polar(O, 159, r); B = polar(O, 119, r); C = polar(O, 21, r)
    s = Svg(330, 258)
    s.carc(O, A, C, sweep=1, large=0)
    for p in (A, B, C):
        s.line(O, p)
    s.poly([A, B, C])
    s.vtext(A, O, "A"); s.vtext(B, O, "B"); s.vtext(C, O, "C"); s.vtext(O, B, "O")
    s.text(s.arc(B, A, O, 26), u"70°")
    s.text(s.arc(C, A, O, 26), u"21°")
    s.text(s.arc(O, B, C, 30, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must(u"2(1) OA=OB", dist(O, A), dist(O, B), 0.5)
    must(u"2(1) OA=OC", dist(O, A), dist(O, C), 0.5)
    must(u"2(1) 70度", angle_at(B, A, O), 70)
    must(u"2(1) 21度", angle_at(C, A, O), 21)
    must(u"2(1) 答えのx＝角BOC", angle_at(O, B, C), 98)
    return s.out()


def fig_2_2():
    u"""円周を12等分。A＝真上(90°)、B＝210°、C＝300°の点で三角形ABC"""
    O = P(166, 148); r = 108
    pts = [polar(O, 90 + 30 * k, r) for k in range(12)]
    A, B, C = pts[0], pts[4], pts[7]
    s = Svg(334, 300)
    s.carc(O, pts[0], pts[6], sweep=1, large=0, col=COL_SUB)
    s.carc(O, pts[6], pts[0], sweep=1, large=0, col=COL_SUB)
    for p in pts:
        s.dot(p, True, 4.0)
    s.dot(O, True, 4.0)
    s.poly([A, B, C])
    s.vtext(A, O, "A"); s.vtext(B, O, "B"); s.vtext(C, O, "C")
    s.text(polar(O, 270, 17), "O", COL_LINE, 14)
    s.text(s.arc(A, B, C, 30, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must(u"2(2) 12等分のとなりどうしの中心角", angle_at(O, pts[0], pts[1]), 30)
    must(u"2(2) 角BOC＝3つ分", angle_at(O, B, C), 90)
    must(u"2(2) 答えのx＝角BAC", angle_at(A, B, C), 45)
    return s.out()


# ============================================================
#  大問3 おうぎ形と正三角形
# ============================================================
def fig_3_1():
    u"""正方形（左上A・右上B・右下C・左下D）に、A中心とD中心の四分円。
       交点Pで「PとDを結ぶ線」と「BからPを通って下辺までのばした線」がはさむ角がx"""
    a = 162
    A = P(72, 32); B = P(72 + a, 32); C = P(72 + a, 32 + a); D = P(72, 32 + a)
    Pt = P(A[0] + a * S3 / 2, A[1] + a / 2)
    Q = inter(B, Pt, D, C)
    s = Svg(302, 236)
    s.poly([A, B, C, D])
    s.carc(A, B, D, sweep=1, large=0)      # 中心A・半径a の四分円 B→D
    s.carc(D, A, C, sweep=1, large=0)      # 中心D・半径a の四分円 A→C
    s.line(D, Pt); s.line(B, Q)
    s.dot(Pt, True, 4.0)
    # ★実物にラベルは無いが、解説を目で追えるように A〜D と P を足した
    s.vtext(A, C, "A"); s.vtext(B, D, "B"); s.vtext(C, A, "C"); s.vtext(D, B, "D")
    s.text(polar(Pt, 180, 24), "P", COL_LINE, 14)
    s.text(s.arc(Pt, D, Q, 24, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must(u"3(1) PA=辺", dist(A, Pt), a, 0.5)
    must(u"3(1) PD=辺", dist(D, Pt), a, 0.5)
    must(u"3(1) 答えのx", angle_at(Pt, D, Q), 45)
    return s.out()


def fig_3_2():
    u"""A中心の半円 と B中心のおうぎ形（中心角136度）。C・D・Eは一直線"""
    R = 108
    A = P(122, 196); B = P(A[0] + R, A[1])
    L = P(A[0] - R, A[1])
    D = P(A[0] + R / 2, A[1] - R * S3 / 2)
    C = polar(B, 180 - 136, R)
    # E は 直線 C-D を のばして 半円と ぶつかる点
    ux, uy = unit(C, D)
    # |A + t*u - A| = R をとく（Dから さらに進む）
    bx, by = D[0] - A[0], D[1] - A[1]
    t = -2 * (bx * ux + by * uy)
    E = P(D[0] + ux * t, D[1] + uy * t)
    s = Svg(340, 240)
    s.carc(A, L, B, sweep=1, large=0)      # 半円
    s.carc(B, A, C, sweep=1, large=0)      # おうぎ形（中心角136度）
    s.line(L, B); s.line(A, E); s.line(E, C); s.line(B, C)
    s.dot(A, True, 4.0); s.dot(B, True, 4.0)
    s.vtext(A, D, "A"); s.vtext(B, D, "B")
    s.text(polar(C, 20, 16), "C", COL_LINE, 14)
    s.text(polar(D, 100, 15), "D", COL_LINE, 14)
    s.text(polar(E, 135, 15), "E", COL_LINE, 14)
    s.text(s.arc(B, A, C, 30), u"136°")
    s.text(s.arc(C, B, D, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    s.text(s.arc(E, A, D, 26, COL_ARC2), "y", COL_ASK, 17, italic=True)
    must(u"3(2) AD＝半円の半径", dist(A, D), R, 0.5)
    must(u"3(2) AE＝半円の半径", dist(A, E), R, 0.5)
    must(u"3(2) BD＝おうぎ形の半径", dist(B, D), R, 0.5)
    must(u"3(2) BC＝おうぎ形の半径", dist(B, C), R, 0.5)
    must(u"3(2) AB＝AD（正三角形になる）", dist(A, B), R, 0.5)
    must(u"3(2) おうぎ形の中心角136度", angle_at(B, A, C), 136)
    must(u"3(2) C・D・Eは一直線", angle_at(D, C, E), 180, 0.5)
    must(u"3(2) 答えのx＝角BCD", angle_at(C, B, D), 52)
    must(u"3(2) 答えのy＝角AED", angle_at(E, A, D), 68)
    return s.out()


# ============================================================
#  大問4 かくれた二等辺三角形を見つける
# ============================================================
def fig_4_1():
    u"""四角形ABCDのDC上に BCと等しくなるように DE をとり、AE・BE・BD をむすぶ"""
    a = 132                                   # AB＝BE＝EA（正三角形ABE）
    B = P(0, 0); A = P(0, -a); E = polar(B, 30, a)
    D = polar(E, ang_of(E, A) - 50, a)        # 角AED＝50度、ED＝a
    # C は 直線 D-E を E のむこうへ のばした先で、BC＝a（＝BE）になる点
    ux, uy = unit(D, E)
    t = -2 * ((E[0] - B[0]) * ux + (E[1] - B[1]) * uy)
    C = P(E[0] + ux * t, E[1] + uy * t)
    pts = [A, B, C, D, E]
    mnx = min(p[0] for p in pts); mny = min(p[1] for p in pts)
    A, B, C, D, E = shift(pts, 56 - mnx, 34 - mny)
    s = Svg(268, 292)
    for p, q in [(A, D), (A, B), (B, C), (D, C), (A, E), (B, E), (B, D)]:
        s.line(p, q)
    s.vtext(A, C, "A"); s.vtext(B, D, "B"); s.vtext(C, A, "C"); s.vtext(D, B, "D")
    s.text(polar(E, -20, 16), "E", COL_LINE, 14)
    s.text(s.arc(A, B, E, 30), u"60°")
    s.text(s.arc(E, D, A, 24), u"50°")
    s.text(s.arc(E, B, C, 24), u"70°")
    s.text(s.arc(B, E, C, 34), u"40°")
    s.arc(A, D, E, 52, COL_ARC2)
    s.text(polar(A, 20, 62), "x", COL_ASK, 17, italic=True)
    must(u"4(1) 三角形ABEは正三角形 AB=BE", dist(A, B), dist(B, E), 0.5)
    must(u"4(1) 三角形ABEは正三角形 AB=EA", dist(A, B), dist(E, A), 0.5)
    must(u"4(1) DE=BC（問題の条件）", dist(D, E), dist(B, C), 0.5)
    must(u"4(1) D・E・Cは一直線", angle_at(E, D, C), 180, 0.5)
    must(u"4(1) 60度", angle_at(A, B, E), 60)
    must(u"4(1) 50度", angle_at(E, D, A), 50)
    must(u"4(1) 70度", angle_at(E, B, C), 70)
    must(u"4(1) 40度", angle_at(B, E, C), 40)
    must(u"4(1) 答えのx＝角DAE", angle_at(A, D, E), 65)
    return s.out()


def fig_4_2():
    u"""ひし形ABCD（角BAD＝112度）。DC上のEは AE＝AD になる点"""
    a = 142
    A = P(0, 0); D = P(a, 0)
    B = polar(A, -112, a); C = P(B[0] + a, B[1])
    ux, uy = unit(D, C)
    t = -2 * ((D[0] - A[0]) * ux + (D[1] - A[1]) * uy)
    E = P(D[0] + ux * t, D[1] + uy * t)
    A, B, C, D, E = shift([A, B, C, D, E], 78, 36)
    s = Svg(268, 216)
    s.poly([A, D, C, B])
    s.line(A, E); s.line(B, E)
    s.vtext(A, C, "A"); s.vtext(D, B, "D"); s.vtext(B, D, "B"); s.vtext(C, A, "C")
    s.text(polar(E, -20, 16), "E", COL_LINE, 14)
    s.text(s.arc(A, D, E, 30), u"44°")
    s.arc(C, B, D, 28)
    s.text(polar(C, 124, 60), u"112°")
    s.text(s.arc(E, A, D, 24, COL_ARC2), "x", COL_ASK, 17, italic=True)
    s.text(s.arc(B, A, E, 34, COL_ARC2), "y", COL_ASK, 17, italic=True)
    for p, q in [(A, B), (B, C), (C, D), (D, A)]:
        must(u"4(2) ひし形の辺", dist(p, q), a, 0.5)
    must(u"4(2) EはDC上", angle_at(E, D, C), 180, 0.5)
    must(u"4(2) 44度", angle_at(A, D, E), 44)
    must(u"4(2) 112度", angle_at(C, B, D), 112)
    must(u"4(2) 答えのx＝角AED", angle_at(E, A, D), 68)
    must(u"4(2) 答えのy＝角ABE", angle_at(B, A, E), 56)
    return s.out()


# ============================================================
#  大問5 合同な三角形をさがす（ア〜クの8つ）
# ============================================================
#  ★縮尺は 図形ごとに ちがう。原本 p115 を実測して決めた（→ docs/_audit/n15_and_derived_log.md）
#    原本は手描きで、8つとも だいたい同じ大きさに描いてある＝**1cmあたりのpx数が
#    図形ごとに ばらばら**（300dpiで 47〜78 px/cm）。
#    さらに ここでは **合同のペアどうしを わざと ずらして** ある。
#    そろえてしまうと 合同ペアが「回しただけの まったく同じ形」になり、
#    **目で重ねるだけで解けてしまう**（＝図が答えを見せている の変種）。
#    ⚠答え（合同の組み合わせ）は 原本のまま。変えたのは 見た目の大きさだけ。
#
#      記号  原本の実測(px/cm@300dpi)  ここの縮尺(px/cm)  辺の最大(px)  ペアの差
#      ア     77.5                      20.0               60           ア:キ = 1 : 1.30
#      キ     78.5                      26.0               78
#      イ     56.5                      15.0              106           イ:ク = 1 : 1.30
#      ク     58.2                      19.5              138
#      ウ     76.8                      25.0              100           ウ:カ = 1 : 0.76
#      カ     71.6                      19.0               76
#      エ     50.3                      17.0              118           エ:オ = 1 : 0.76
#      オ     47.1                      13.0               90
#    ★大小の向きは 原本と同じ（原本でも キ>ア・ク>イ・ウ>カ・エ>オ）。開きだけ広げた
U = 18.0   # ★もとの基準。文字の大きさは これに合わせてあるので さわらない
SC = {u"ア": 20.0, u"イ": 15.0, u"ウ": 25.0, u"エ": 17.0,
      u"オ": 13.0, u"カ": 19.0, u"キ": 26.0, u"ク": 19.5}


def _off(u, v):
    u"""弧の半径・ラベルの はなれ具合を 図形の大きさに ほどよく つれさせる。
       まるごと比例させると 小さい図で 文字が線に かぶるので、65%だけ つれさせる"""
    return v * (0.35 + 0.65 * u / U)


def _tri_a():
    u"""ア: 2辺3cm・間の角60度（＝1辺3cmの正三角形）。60度は左下"""
    u = SC[u"ア"]
    V = P(0, 0); T = polar(V, 75, 3 * u); R = polar(V, 15, 3 * u)
    must(u"5 ア 3辺とも3cm(1)", dist(V, T), 3 * u, 0.5)
    must(u"5 ア 3辺とも3cm(2)", dist(V, R), 3 * u, 0.5)
    must(u"5 ア 3辺とも3cm(3)", dist(T, R), 3 * u, 0.5)
    must(u"5 ア 60度", angle_at(V, T, R), 60)
    return dict(pts=[T, V, R], lab=u"ア", arcs=[(V, T, R, _off(u, 24))],
                angtxt=[(polar(V, 45, _off(u, 68)), u"60°")],
                seg=[(V, T, u"3cm", _off(u, 20), -1), (V, R, u"3cm", _off(u, 20), 1)], ra=[])


def _tri_i():
    u"""イ: 直角をはさむ2辺が5cmの直角二等辺三角形。直角は左下"""
    u = SC[u"イ"]
    V = P(0, 0); T = polar(V, 90, 5 * u); R = polar(V, 0, 5 * u)
    must(u"5 イ 直角", angle_at(V, T, R), 90)
    must(u"5 イ 5cm(1)", dist(V, T), 5 * u, 0.5)
    must(u"5 イ 5cm(2)", dist(V, R), 5 * u, 0.5)
    return dict(pts=[T, V, R], lab=u"イ", arcs=[(V, T, R, _off(u, 30))],
                angtxt=[(polar(V, 45, _off(u, 45)), u"90°")],
                seg=[(V, T, u"5cm", _off(u, 20), -1), (V, R, u"5cm", _off(u, 20), 1)], ra=[(V, T, R)])


def _tri_u():
    u"""ウ: 3辺が 3cm・4cm・4cm。左上の頂点Lから 右へ3cm、下へ4cm"""
    u = SC[u"ウ"]
    L = P(0, 0); B = polar(L, -81, 4 * u)
    # R: |LR|=3cm, |BR|=4cm の右がわの交点
    d = dist(L, B); c = 3 * u; e = 4 * u
    xx = (c * c + d * d - e * e) / (2 * d)
    yy = math.sqrt(max(c * c - xx * xx, 0))
    ex, ey = unit(L, B); nx, ny = -ey, ex
    R = P(L[0] + ex * xx - nx * yy, L[1] + ey * xx - ny * yy)
    must(u"5 ウ 3cm", dist(L, R), 3 * u, 0.5)
    must(u"5 ウ 4cm(1)", dist(L, B), 4 * u, 0.5)
    must(u"5 ウ 4cm(2)", dist(R, B), 4 * u, 0.5)
    return dict(pts=[L, R, B], lab=u"ウ",
                seg=[(L, R, u"3cm", _off(u, 19), -1), (L, B, u"4cm", _off(u, 19), 1),
                     (R, B, u"4cm", _off(u, 19), -1)],
                arcs=[], angtxt=[], ra=[])


def _tri_e():
    u"""エ: 30度・90度の直角三角形で、その2つの角の間の辺が6cm。上が30度・右下が90度"""
    u = SC[u"エ"]
    T = P(0, 0); R = polar(T, -90, 6 * u)
    B = polar(R, 180, 6 * u * math.tan(math.radians(30)))
    must(u"5 エ 6cm", dist(T, R), 6 * u, 0.5)
    must(u"5 エ 30度", angle_at(T, R, B), 30)
    must(u"5 エ 90度", angle_at(R, T, B), 90)
    return dict(pts=[T, R, B], lab=u"エ", arcs=[(T, R, B, _off(u, 22))],
                angtxt=[(polar(T, 165, _off(u, 45)), u"30°"), (polar(R, 135, _off(u, 37)), u"90°")],
                seg=[(T, R, u"6cm", _off(u, 32), -1)], ra=[(R, T, B)])


def _tri_o():
    u"""オ: エと同じ 30-60-90。60度が上・90度が左・6cmは90度と30度の間の辺"""
    u = SC[u"オ"]
    Q = P(0, 0); R = polar(Q, -35, 6 * u)
    Pp = polar(Q, -35 + 90, 6 * u * math.tan(math.radians(30)))
    must(u"5 オ 6cm", dist(Q, R), 6 * u, 0.5)
    must(u"5 オ 90度", angle_at(Q, Pp, R), 90)
    must(u"5 オ 60度", angle_at(Pp, Q, R), 60)
    must(u"5 オ 30度", angle_at(R, Q, Pp), 30)
    return dict(pts=[Pp, Q, R], lab=u"オ", arcs=[(Pp, Q, R, _off(u, 22))],
                angtxt=[(polar(Pp, 150, _off(u, 40)), u"60°"), (polar(Q, 8, _off(u, 24)), u"90°")],
                seg=[(Q, R, u"6cm", _off(u, 20), 1)], ra=[(Q, Pp, R)])


def _tri_ka():
    u"""カ: 3辺が 4cm・4cm・3cm。上が頂点で 底辺が3cm"""
    u = SC[u"カ"]
    B1 = P(0, 0); B2 = P(3 * u, 0)
    T = P(1.5 * u, -math.sqrt((4 * u) ** 2 - (1.5 * u) ** 2))
    must(u"5 カ 4cm(1)", dist(T, B1), 4 * u, 0.5)
    must(u"5 カ 4cm(2)", dist(T, B2), 4 * u, 0.5)
    must(u"5 カ 3cm", dist(B1, B2), 3 * u, 0.5)
    return dict(pts=[T, B1, B2], lab=u"カ",
                seg=[(T, B1, u"4cm", _off(u, 19), 1), (T, B2, u"4cm", _off(u, 19), -1),
                     (B1, B2, u"3cm", _off(u, 19), 1)],
                arcs=[], angtxt=[], ra=[])


def _tri_ki():
    u"""キ: 3辺とも3cm。左上・右・左下に頂点をおく（アとは向きがちがう）"""
    u = SC[u"キ"]
    L1 = P(0, 0); R = polar(L1, -25, 3 * u); L2 = polar(L1, -85, 3 * u)
    must(u"5 キ 3cm(1)", dist(L1, R), 3 * u, 0.5)
    must(u"5 キ 3cm(2)", dist(L1, L2), 3 * u, 0.5)
    must(u"5 キ 3cm(3)", dist(R, L2), 3 * u, 0.5)
    return dict(pts=[L1, R, L2], lab=u"キ",
                seg=[(L1, R, u"3cm", _off(u, 19), -1), (L1, L2, u"3cm", _off(u, 19), 1),
                     (R, L2, u"3cm", _off(u, 19), -1)],
                arcs=[], angtxt=[], ra=[])


def _tri_ku():
    u"""ク: 90度が上・45度が左下・5cmは90度と45度の間の辺（右上がわ）"""
    u = SC[u"ク"]
    T = P(0, 0); L = polar(T, -134, 5 * u); R = polar(T, -44, 5 * u)
    must(u"5 ク 90度", angle_at(T, L, R), 90)
    must(u"5 ク 45度", angle_at(L, T, R), 45)
    must(u"5 ク 5cm", dist(T, R), 5 * u, 0.5)
    return dict(pts=[T, L, R], lab=u"ク", arcs=[(L, T, R, _off(u, 30))],
                angtxt=[(polar(L, 23.5, _off(u, 44)), u"45°"), (polar(T, 271, _off(u, 26)), u"90°")],
                seg=[(T, R, u"5cm", _off(u, 20), -1)], ra=[(T, L, R)])


def fig_5():
    u"""ア〜クの8つの三角形を 2列×4行にならべる（スマホのたて画面で読めるように）"""
    cells = [_tri_a(), _tri_i(), _tri_u(), _tri_e(), _tri_o(), _tri_ka(), _tri_ki(), _tri_ku()]
    CW, CH = 204, 187
    s = Svg(2 * CW, 4 * CH + 8)
    for i, t in enumerate(cells):
        cx = (i % 2) * CW + CW / 2.0
        cy = (i // 2) * CH + CH / 2.0 + 4
        xs = [p[0] for p in t["pts"]]; ys = [p[1] for p in t["pts"]]
        dx = cx - (min(xs) + max(xs)) / 2.0
        dy = cy - (min(ys) + max(ys)) / 2.0
        m = lambda p: (p[0] + dx, p[1] + dy)
        s.poly([m(p) for p in t["pts"]])
        for (v, p, q) in t["ra"]:
            s.right_angle(m(v), m(p), m(q), 11)
        for (v, p, q, r) in t["arcs"]:
            s.arc(m(v), m(p), m(q), r)
        for (pos, txt) in t["angtxt"]:
            s.text(m(pos), txt, COL_GIVEN, 13)
        for (p, q, txt, off, side) in t["seg"]:
            s.seg_label(m(p), m(q), txt, off, side, COL_GIVEN, 13)
        # ★記号は 三角形の中に置くと 角度ラベルと重なる（実測）。セルの左上に出す
        s.text((cx - CW / 2.0 + 17, cy - CH / 2.0 + 15), t["lab"], COL_ASK, 18)
    return s.out()


# ============================================================
#  大問6 合同だから角がうつせる
# ============================================================
def fig_6_1():
    u"""三角形ABC（角A72度・角B68度・角C40度）を Aのまわりに23度まわして 三角形ADE"""
    L = 152
    B = P(0, 0); C = P(L, 0)
    A = inter(B, polar(B, 68, 200), C, polar(C, 180 - 40, 200))
    D = rot_about(A, B, 23); E = rot_about(A, C, 23)
    F = inter(A, C, D, E)
    A, B, C, D, E, F = shift([A, B, C, D, E, F], 58, 118)
    s = Svg(288, 158)
    for p, q in [(A, B), (B, C), (C, A), (A, D), (D, E), (E, A)]:
        s.line(p, q)
    s.vtext(A, B, "A"); s.vtext(B, A, "B"); s.vtext(C, A, "C")
    s.text(polar(D, -80, 15), "D", COL_LINE, 14)
    s.text(polar(E, 10, 15), "E", COL_LINE, 14)
    s.arc(A, B, D, 26)
    s.lead(polar(A, 259.5, 34), P(44, 62), u"23°")
    s.text(s.arc(C, A, B, 26), u"40°")
    s.text(polar(F, -8.5, 26), "F", COL_LINE, 14)
    s.text(s.arc(F, A, E, 22, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must(u"6(1) 合同 AB=AD", dist(A, B), dist(A, D), 0.5)
    must(u"6(1) 合同 AC=AE", dist(A, C), dist(A, E), 0.5)
    must(u"6(1) 合同 BC=DE", dist(B, C), dist(D, E), 0.5)
    must(u"6(1) 23度", angle_at(A, B, D), 23)
    must(u"6(1) 角CAEも23度", angle_at(A, C, E), 23)
    must(u"6(1) 40度", angle_at(C, A, B), 40)
    must(u"6(1) 角Eも40度", angle_at(E, A, D), 40)
    must(u"6(1) 答えのx", angle_at(F, A, E), 117)
    return s.out()


def fig_6_2():
    u"""正方形ABCD の中に、Cを共有する正方形EFCG。角FBC＝40度"""
    a = 150
    A = P(0, 0); B = P(0, a); C = P(a, a); D = P(a, 0)
    F = polar(B, 40, a * 0.56)
    vx, vy = C[0] - F[0], C[1] - F[1]
    G = P(C[0] + vy, C[1] - vx)          # F→C を 画面で反時計に90度まわす
    E = P(F[0] + vy, F[1] - vx)
    A, B, C, D, E, F, G = shift([A, B, C, D, E, F, G], 26, 26)
    s = Svg(272, 214)
    s.poly([A, B, C, D])
    s.poly([E, F, C, G])
    s.vtext(A, C, "A"); s.vtext(B, D, "B"); s.vtext(C, A, "C"); s.vtext(D, B, "D")
    s.text(polar(E, 190, 20), "E", COL_LINE, 14)
    s.text(polar(F, 170, 15), "F", COL_LINE, 14)
    s.text(polar(G, 10, 15), "G", COL_LINE, 14)
    s.text(s.arc(B, P(B[0] + 60, B[1]), F, 30), u"40°")
    s.text(s.arc(D, G, C, 24, COL_ARC2), "x", COL_ASK, 17, italic=True)
    for p, q in [(A, B), (B, C), (C, D), (D, A)]:
        must(u"6(2) 正方形ABCDの辺", dist(p, q), a, 0.5)
    for p, q in [(E, F), (F, C), (C, G), (G, E)]:
        must(u"6(2) 正方形EFCGの辺", dist(p, q), dist(E, F), 0.5)
    must(u"6(2) 正方形EFCGの角", angle_at(F, E, C), 90)
    must(u"6(2) 40度", angle_at(B, P(B[0] + 60, B[1]), F), 40)
    must(u"6(2) 答えのx＝角GDC", angle_at(D, G, C), 40)
    return s.out()


def fig_6_3():
    u"""正三角形ABC。BC上のP・CA上のQで BP＝CQ。APとBQの交わる角がx"""
    a = 164; k = 0.63
    B = P(0, 0); C = P(a, 0); A = P(a / 2, -a * S3 / 2)
    Pp = lerp(B, C, k); Q = lerp(C, A, k)
    X = inter(A, Pp, B, Q)
    A, B, C, Pp, Q, X = shift([A, B, C, Pp, Q, X], 34, 172)
    s = Svg(250, 212)
    s.poly([A, B, C])
    s.line(A, Pp); s.line(B, Q)
    s.vtext(A, B, "A"); s.vtext(B, A, "B"); s.vtext(C, A, "C")
    s.text(polar(Pp, -90, 15), "P", COL_LINE, 14)
    s.text(polar(Q, 20, 15), "Q", COL_LINE, 14)
    s.text(s.arc(X, A, B, 22, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must(u"6(3) 正三角形(1)", dist(A, B), a, 0.5)
    must(u"6(3) 正三角形(2)", dist(B, C), a, 0.5)
    must(u"6(3) 正三角形(3)", dist(C, A), a, 0.5)
    must(u"6(3) BP=CQ", dist(B, Pp), dist(C, Q), 0.5)
    must(u"6(3) 答えのx", angle_at(X, A, B), 120)
    return s.out()


# ============================================================
#  大問7 三角形をいどうさせる
# ============================================================
def fig_7_1():
    u"""正方形ABCD（A左上・D右上・B左下・C右下）。Aから下辺へP、Aから右辺へQ"""
    a = 200                                   # 20度の細い角があるので 大きめに作る
    A = P(0, 0); D = P(a, 0); B = P(0, a); C = P(a, a)
    Pp = inter(A, polar(A, -70, 400), B, C)
    Q = inter(A, polar(A, -25, 400), D, C)
    A, B, C, D, Pp, Q = shift([A, B, C, D, Pp, Q], 72, 34)
    s = Svg(326, 286)
    s.poly([A, D, C, B])
    s.line(A, Pp); s.line(A, Q); s.line(Pp, Q)
    s.vtext(A, C, "A"); s.vtext(D, B, "D"); s.vtext(B, D, "B"); s.vtext(C, A, "C")
    s.arc(A, B, Pp, 46)
    s.lead(polar(A, 280, 52), P(44, 108), u"20°")
    s.text(s.arc(A, Pp, Q, 32), u"45°")
    s.text(polar(Pp, 270, 16), "P", COL_LINE, 14)
    s.text(polar(Q, 0, 16), "Q", COL_LINE, 14)
    s.text(s.arc(Q, A, D, 26), u"65°")
    s.text(s.arc(Pp, A, Q, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must(u"7(1) Pは下辺BC上", angle_at(Pp, B, C), 180, 0.5)
    must(u"7(1) Qは右辺DC上", angle_at(Q, D, C), 180, 0.5)
    must(u"7(1) 20度", angle_at(A, B, Pp), 20)
    must(u"7(1) 45度", angle_at(A, Pp, Q), 45)
    must(u"7(1) 65度", angle_at(Q, A, D), 65)
    must(u"7(1) 答えのx＝角APQ", angle_at(Pp, A, Q), 70)
    return s.out()


def fig_7_2():
    u"""正方形ABCD。Bから上辺へP、Bから右辺へQ。角DPQがx"""
    a = 200                                   # 15度の細い角があるので 大きめに作る
    A = P(0, 0); D = P(a, 0); B = P(0, a); C = P(a, a)
    Pp = inter(B, polar(B, 75, 400), A, D)
    Q = inter(B, polar(B, 30, 400), D, C)
    A, B, C, D, Pp, Q = shift([A, B, C, D, Pp, Q], 72, 40)
    s = Svg(326, 292)
    s.poly([A, D, C, B])
    s.line(B, Pp); s.line(B, Q); s.line(Pp, Q)
    s.vtext(A, C, "A"); s.vtext(D, B, "D"); s.vtext(B, D, "B"); s.vtext(C, A, "C")
    s.arc(B, A, Pp, 48)
    s.lead(polar(B, 82.5, 56), P(44, 178), u"15°")
    s.text(s.arc(B, Q, C, 40), u"30°")
    s.text(polar(Pp, 90, 16), "P", COL_LINE, 14)
    s.text(polar(Q, 0, 16), "Q", COL_LINE, 14)
    s.text(s.arc(Pp, D, Q, 26, COL_ARC2), "x", COL_ASK, 17, italic=True)
    must(u"7(2) Pは上辺AD上", angle_at(Pp, A, D), 180, 0.5)
    must(u"7(2) Qは右辺DC上", angle_at(Q, D, C), 180, 0.5)
    must(u"7(2) 15度", angle_at(B, A, Pp), 15)
    must(u"7(2) 30度", angle_at(B, Q, C), 30)
    must(u"7(2) 答えのx＝角DPQ", angle_at(Pp, D, Q), 30)
    return s.out()


# ============================================================
#  大問データ（設問・答え・解説）
#    ★答えは 解答ページ p42 の一覧と、こちらで解き直した結果の 両方が一致したものだけ
# ============================================================
SRC = u"小3最レ【刷新版】No.15 大問%d（実物・9月1回目の範囲）"


def build():
    d1 = {
        "id": "hd3s_n15_1", "hg": "HG-1442", "src": SRC % 1,
        "title": u"正方形と正三角形を重ねる", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 2,
        "intro": u"正方形の4つの辺は みんな同じ長さ。正三角形の3つの辺も みんな同じ長さです。"
                 u"この2つを 重ねると、**同じ長さの辺が となりあう二等辺三角形**が かくれて できます。"
                 u"**まず「どの辺とどの辺が 同じ長さか」を さがす**のが 手はじめです。",
        "steps": [
            {"question": u"四角形ABCDは正方形、三角形EBCは正三角形です。角xの 大きさは 何度ですか。",
             "answer": "75", "svg": fig_1_1(),
             "meaning": u"①正三角形EBCの辺ECは、正方形の辺BCと 同じ長さ。正方形の辺CDも 同じ長さ。"
                        u"だから **三角形ECDは二等辺三角形**です。"
                        u"②角ECD＝90−60＝**30度**（正方形の角から 正三角形の角を ひく）。"
                        u"③二等辺三角形の 下の2つの角は 等しいので、x＝(180−30)÷2＝**75度**。"
                        u"④**辺の長さが同じ→二等辺三角形→角が2つとも同じ**、という道すじが この回の土台です。"},
            {"question": u"正方形ABCDと 正三角形EBAを 組み合わせた図形です。角xの 大きさは 何度ですか。",
             "answer": "60", "svg": fig_1_2(),
             "meaning": u"①正三角形の辺EBは、正方形の辺BCと 同じ長さ。だから **三角形EBCは二等辺三角形**。"
                        u"②角EBC＝60＋90＝**150度**（正三角形の角と 正方形の角を たす）。"
                        u"のこりの2つの角は (180−150)÷2＝**15度**ずつ。"
                        u"③BDは正方形の対角線なので、角DBC＝90÷2＝**45度**。"
                        u"④xは BDとECが 交わってできた角です。**外角定理**"
                        u"（外角＝となりあわない2つの内角の和）より、x＝45＋15＝**60度**。"},
        ],
    }
    d2 = {
        "id": "hd3s_n15_2", "hg": "HG-1443", "src": SRC % 2,
        "title": u"円の半径は みんな同じ長さ", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 2,
        "intro": u"円やおうぎ形では、**中心から円周までの長さ（半径）は どこも同じ**です。"
                 u"だから **中心と円周上の点を むすぶと、かならず二等辺三角形ができます**。"
                 u"角度が分からなくて こまったら、**まず中心と むすんでみる**。",
        "steps": [
            {"question": u"点Oを中心として えがいた おうぎ形で、点A、B、Cは 円周上に あります。"
                         u"角xの 大きさは 何度ですか。",
             "answer": "98", "svg": fig_2_1(),
             "meaning": u"①OAもOBも 半径だから 同じ長さ。**三角形AOBは二等辺三角形**です。"
                        u"角OBA＝70度なので 角OAB＝70度、角AOB＝180−70×2＝**40度**。"
                        u"②OAもOCも 半径。**三角形AOCも二等辺三角形**。"
                        u"角OCA＝21度なので 角OAC＝21度、角AOC＝180−21×2＝**138度**。"
                        u"③xは 角AOCから 角AOBを ひいたもの。x＝138−40＝**98度**。"
                        u"④**半径どうしは同じ長さ**——これだけで 二等辺三角形が2こ 手に入りました。"},
            {"question": u"円周を 12等分する点を とり、三角形ABCを 作りました。角xの 大きさは 何度ですか。",
             "answer": "45", "svg": fig_2_2(),
             "meaning": u"①円周を12等分しているので、となりどうしの点と 中心を むすぶ角は 360÷12＝**30度**。"
                        u"②AとBは **4つ分** はなれているので、角AOB＝30×4＝120度。"
                        u"OAとOBは半径で同じ長さ→二等辺三角形→角OAB＝(180−120)÷2＝**30度**。"
                        u"③AとCは **5つ分** はなれているので、角AOC＝30×5＝150度。"
                        u"同じように 角OAC＝(180−150)÷2＝**15度**。"
                        u"④xは この2つを 合わせた角。x＝30＋15＝**45度**。"
                        u"⑤**点が何つ分はなれているかを 数える**だけで、中心の角が すぐ出せます。"},
        ],
    }
    d3 = {
        "id": "hd3s_n15_3", "hg": "HG-1444", "src": SRC % 3,
        "title": u"おうぎ形の中に かくれた正三角形", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 3,
        "intro": u"おうぎ形の 半径どうしが 同じ長さになる所を さがすと、**正三角形**が すがたを あらわします。"
                 u"正三角形が 見つかれば **60度が手に入る**——それが この大問の しかけです。",
        "steps": [
            {"question": u"正方形と おうぎ形を 組み合わせた図形です。角xの 大きさは 何度ですか。"
                         u"（Pは 2つの弧が 交わった点です）",
             "answer": "45", "svg": fig_3_1(),
             "meaning": u"①Aを中心にした弧と、Dを中心にした弧が、正方形の中の点Pで 交わっています。"
                        u"②APは Aを中心にした弧の半径、DPは Dを中心にした弧の半径。"
                        u"どちらも **正方形の1辺と同じ長さ**です。ADも 正方形の1辺。"
                        u"だから **AP＝DP＝AD＝三角形APDは正三角形**。"
                        u"③正三角形なので 角PAD＝60度。すると 角PAB＝90−60＝**30度**。"
                        u"④APも ABも 正方形の1辺と同じ長さ → **三角形APBは二等辺三角形**。"
                        u"頂上の角が30度なので 角APB＝(180−30)÷2＝**75度**。"
                        u"⑤BからPを通って 下の辺までの線は まっすぐ（一直線＝180度）。"
                        u"Pのところに 角APB（75度）・角APD（60度）・x が ならぶので、"
                        u"x＝180−(75＋60)＝**45度**。"},
            {"question": u"点Aを中心とする 半円と、点Bを中心とする おうぎ形が あります。"
                         u"点C、D、Eは 一直線に ならんでいます。角xの 大きさは 何度ですか。",
             "answer": "52", "svg": fig_3_2(),
             "meaning": u"①点Dと 中心A・中心Bを むすびます。"
                        u"ADは半円の半径、BDは おうぎ形の半径、ABも おうぎ形の半径"
                        u"（おうぎ形は Aから えがき始めているから）。"
                        u"**3つとも同じ長さ＝三角形ABDは正三角形**です。"
                        u"②だから 角ABD＝**60度**。"
                        u"③おうぎ形の中心角は136度なので、角DBC＝136−60＝**76度**。"
                        u"④BDもBCも おうぎ形の半径だから **三角形DBCは二等辺三角形**。"
                        u"x＝(180−76)÷2＝**52度**。"},
            {"question": u"同じ図で、角yの 大きさは 何度ですか。",
             "answer": "68", "svg": fig_3_2(),
             "meaning": u"①C・D・Eは 一直線なので、Dのところの 3つの角を たすと 180度。"
                        u"②角ADB＝60度（正三角形）。角BDC＝52度"
                        u"（三角形DBCは二等辺だから、xと同じ大きさ）。"
                        u"③だから 角ADE＝180−60−52＝**68度**。"
                        u"④AEもADも 半円の半径だから **三角形AEDは二等辺三角形**。"
                        u"y＝角AED＝角ADE＝**68度**。"
                        u"⑤**一直線の180度**を つかって、じゃまな角を ひいていくのが 手です。"},
        ],
    }
    d4 = {
        "id": "hd3s_n15_4", "hg": "HG-1445", "src": SRC % 4,
        "title": u"かくれた二等辺三角形を 見つける", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 2,
        "intro": u"「同じ長さの辺」を たどっていくと、**次から次へと 二等辺三角形が 見つかります**。"
                 u"1つ見つけるたびに 新しい角が分かり、それが **次の三角形の材料**に なります。",
        "steps": [
            {"question": u"四角形ABCDの DC上に、BCと 等しくなるように DEを とり、AE、BE、BDを むすぶと "
                         u"下の図のように なりました。角xの 大きさは 何度ですか。",
             "answer": "65", "svg": fig_4_1(),
             "meaning": u"①三角形BCEを 見ます。角EBC＝40度、角BEC＝70度なので、"
                        u"角BCE＝180−(40＋70)＝**70度**。"
                        u"②角BEC＝角BCE＝70度 なので **三角形BCEは二等辺三角形**。BE＝BC。"
                        u"③D・E・Cは 一直線なので、Eのところの角を たすと180度。"
                        u"角AEB＝180−(70＋50)＝**60度**。"
                        u"④三角形ABEで 角BAE＝60度、角AEB＝60度 → のこりも60度。"
                        u"**三角形ABEは正三角形**。AE＝BE。"
                        u"⑤問題文より DE＝BC。②より BC＝BE、④より BE＝AE。"
                        u"つないでいくと **DE＝AE＝三角形AEDも二等辺三角形**。"
                        u"⑥角AED＝50度なので、x＝(180−50)÷2＝**65度**。"},
            {"question": u"四角形ABCDは ひし形です。角xの 大きさは 何度ですか。",
             "answer": "68", "svg": fig_4_2(),
             "meaning": u"①ひし形の となりあう角の 大きさの和は **180度**です。"
                        u"角BCD＝112度なので、角ADC＝180−112＝**68度**。"
                        u"②三角形AEDの 内角の和は180度。角DAE＝44度、角ADE＝68度なので、"
                        u"x＝180−(44＋68)＝**68度**。"},
            {"question": u"同じひし形で、角yの 大きさは 何度ですか。",
             "answer": "56", "svg": fig_4_2(),
             "meaning": u"①(2)より 角ADE＝68度、角AED（x）＝68度。2つが等しいので "
                        u"**三角形AEDは二等辺三角形**で AE＝AD。"
                        u"②ひし形の辺は みんな同じ長さなので AD＝AB。"
                        u"つないで **AE＝AB＝三角形ABEも二等辺三角形**。"
                        u"③ひし形の 向かい合う角は等しいので 角BAD＝角BCD＝112度。"
                        u"角DAE＝44度なので 角BAE＝112−44＝**68度**。"
                        u"④三角形ABEは AB＝AE の二等辺三角形で 頂上の角が68度。"
                        u"y＝(180−68)÷2＝**56度**。"},
        ],
    }
    return [d1, d2, d3, d4]


CH5 = [u"ア", u"イ", u"ウ", u"エ", u"オ", u"カ", u"キ", u"ク"]


def _ch(exclude):
    return [c for c in CH5 if c != exclude]


def build_rest():
    zu5 = fig_5()
    d5 = {
        "id": "hd3s_n15_5", "hg": "HG-1446", "src": SRC % 5,
        "title": u"合同な三角形を さがす", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 1,
        "intro": u"**合同**とは、形も 大きさも 同じことです。三角形は 次の3つの どれかが 分かれば "
                 u"合同だと 言えます。**①3つの辺の長さが等しい ②2つの辺と その間の角が等しい "
                 u"③1つの辺と その両はしの角が等しい**。"
                 u"**向きがちがっても、ひっくり返っていても、合同は 合同**です。"
                 u"（8つの三角形の図は、**タップすると 大きくなります**）",
        "steps": [
            {"question": u"アと 合同な三角形を 答えなさい。", "answer": u"キ",
             "choices": _ch(u"ア"), "svg": zu5,
             "meaning": u"①アは **2つの辺が3cmで その間の角が60度**。"
                        u"「2つの辺と その間の角」が 分かっているので 形は1つに決まります。"
                        u"②じつは 3cm・3cm・60度の三角形は **1辺3cmの正三角形**です"
                        u"（のこりの角も 60度ずつに なるため）。"
                        u"③3つの辺が3cmなのは **キ**。向きは ちがいますが 合同です。"},
            {"question": u"イと 合同な三角形を 答えなさい。", "answer": u"ク",
             "choices": _ch(u"イ"), "svg": zu5,
             "meaning": u"①イは **直角を はさむ2つの辺が5cm** の 直角二等辺三角形。"
                        u"②クは 90度と45度が 分かっているので、のこりの角は 180−90−45＝**45度**。"
                        u"つまり クも 直角二等辺三角形です。"
                        u"③クの 90度と45度の 間の辺が5cm＝直角を はさむ辺が5cm。"
                        u"イと 同じなので **ク**。"},
            {"question": u"ウと 合同な三角形を 答えなさい。", "answer": u"カ",
             "choices": _ch(u"ウ"), "svg": zu5,
             "meaning": u"①ウは 3つの辺が **3cm・4cm・4cm**。"
                        u"「3つの辺の長さ」が 分かっているので 形は1つに決まります。"
                        u"②同じく 3cm・4cm・4cm なのは **カ**。"
                        u"ウは よこ向き、カは たて向きですが、辺の長さが同じなら 合同です。"},
            {"question": u"エと 合同な三角形を 答えなさい。", "answer": u"オ",
             "choices": _ch(u"エ"), "svg": zu5,
             "meaning": u"①エは 30度と90度が 分かっているので のこりは 60度。"
                        u"**30度・60度・90度**の直角三角形で、**90度と30度の間の辺が6cm**。"
                        u"②オは 60度と90度が 分かっているので のこりは 30度。こちらも 30度・60度・90度。"
                        u"③オの6cmの辺も **90度の頂点と 30度の頂点の間**。"
                        u"同じ場所の辺が 同じ長さなので **オ**。"
                        u"④**角が同じだけでは合同と言えない**（大きさが ちがうかもしれない）。"
                        u"**辺が1つでも 同じ場所で 同じ長さ**だと分かって はじめて 合同です。"},
        ],
    }
    d6 = {
        "id": "hd3s_n15_6", "hg": "HG-1447", "src": SRC % 6,
        "title": u"合同だから 角が うつせる", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 3,
        "intro": u"2つの図形が 合同なら、**対応する角は 同じ大きさ**です。"
                 u"だから はなれた所にある角でも、「合同だから 同じ」と言って **うつしてくる**ことが できます。",
        "steps": [
            {"question": u"三角形ABCと 三角形ADEは 合同です。角xの 大きさは 何度ですか。"
                         u"（Fは ACと DEが 交わった点です）",
             "answer": "117", "svg": fig_6_1(),
             "meaning": u"①三角形ABCと 三角形ADEは 合同なので、角BAC＝角DAE。"
                        u"②この2つの角は 角DACの分だけ 重なっています。"
                        u"重なりを ひくと 角BAD＝角CAE。だから **角CAE＝23度**。"
                        u"③合同なので 角ACB＝角AED＝**40度**。"
                        u"④三角形AFEを 見ると、角FAE＝23度、角AEF＝40度。"
                        u"内角の和は180度なので、x＝180−(23＋40)＝**117度**。"
                        u"⑤**重なった角を ひいて そろえる**——これが 回した図形の 決まり手です。"},
            {"question": u"四角形ABCDと 四角形EFCGは 正方形です。角xの 大きさは 何度ですか。",
             "answer": "40", "svg": fig_6_2(),
             "meaning": u"①BC＝DC（正方形ABCDの辺）、FC＝GC（正方形EFCGの辺）。"
                        u"②角FCB＝90−角FCD、角GCD＝90−角FCD。同じものを ひいているので "
                        u"**角FCB＝角GCD**。"
                        u"③**2つの辺と その間の角**が 等しいので、三角形FBCと 三角形GDCは **合同**。"
                        u"④合同なら 対応する角も 同じ。x＝角FBC＝**40度**。"
                        u"⑤角の大きさを 1つも計算せずに、**合同だけで 40度を うつしてきた**のが この問題です。"},
            {"question": u"正三角形ABCで BP＝CQ です。角xの 大きさは 何度ですか。"
                         u"（xは APと BQが 交わってできた角です）",
             "answer": "120", "svg": fig_6_3(),
             "meaning": u"①正三角形なので AB＝BC。問題文より BP＝CQ。"
                        u"角ABP＝角BCQ＝**60度**（どちらも 正三角形の角）。"
                        u"②**2つの辺と その間の角**が 等しいので、三角形ABPと 三角形BCQは **合同**。"
                        u"③合同なので 角BAP＝角CBQ。この角を ● とします。"
                        u"角APB を △ とすると、三角形ABPの内角の和より **●＋△＝180−60＝120度**。"
                        u"④APと BQの 交わった点を X とします。"
                        u"角XBP＝角CBQ＝●（PはBC上にあるので BPと BCは 同じ向き）、角XPB＝角APB＝△。"
                        u"⑤**外角定理**より x＝●＋△＝**120度**。"
                        u"⑥●と△の **1つ分は 最後まで 分かりません**。それでも **和だけ**で 答えが出ます。"},
        ],
    }
    d7 = {
        "id": "hd3s_n15_7", "hg": "HG-1448", "src": SRC % 7,
        "title": u"三角形を いどうさせる", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 3,
        "intro": u"この回の しあげです。**正方形の辺は みんな同じ長さ**。"
                 u"これを つかって **三角形を そっくり回して 別の辺に 重ねる**と、"
                 u"はなれていた角が つながって 答えが 出ます。",
        "steps": [
            {"question": u"四角形ABCDが 正方形の とき、角xの 大きさは 何度ですか。"
                         u"（Pは 辺BC上、Qは 辺DC上の 点です）",
             "answer": "70", "svg": fig_7_1(),
             "meaning": u"①正方形の角は90度なので、角QAD＝90−20−45＝**25度**。"
                        u"三角形AQDで 角ADQ＝90度だから 角AQD＝180−90−25＝**65度**。"
                        u"②三角形ABPを、Aの まわりに 回して **辺ABを 辺ADに 重ねます**"
                        u"（正方形だから AB＝AD）。動かした先を 三角形ADP' と します。"
                        u"③角ADP'＝角ABP＝90度なので、**P'・D・Qは 一直線**に ならびます。"
                        u"だから 角AQP'＝角AQD＝**65度**。"
                        u"④角P'AQ＝20＋25＝45度＝角PAQ。AP＝AP'、AQは 共通なので、"
                        u"**三角形APQと 三角形AP'Qは 合同**。"
                        u"⑤合同だから 角AQP＝角AQP'＝**65度**。"
                        u"⑥三角形APQの 内角の和より、x＝180−(45＋65)＝**70度**。"},
            {"question": u"四角形ABCDが 正方形の とき、角xの 大きさは 何度ですか。"
                         u"（Pは 辺AD上、Qは 辺DC上の 点です）",
             "answer": "30", "svg": fig_7_2(),
             "meaning": u"①正方形の角は90度なので、角PBQ＝90−15−30＝**45度**。"
                        u"②三角形ABPで 角BAP＝90度、角ABP＝15度なので 角APB＝**75度**。"
                        u"③三角形BCQを、Bの まわりに 回して **辺BCを 辺BAに 重ねます**"
                        u"（正方形だから BC＝BA）。動かした先を 三角形BAQ' と します。"
                        u"④角BAQ'＝角BCQ＝90度なので、Q'は **直線ADの上（Aの外がわ）**に 来ます。"
                        u"つまり Q'・A・P・Dが 一直線。"
                        u"⑤角PBQ'＝15＋30＝45度＝角PBQ。BQ＝BQ'、BPは共通なので、"
                        u"**三角形BPQと 三角形BPQ'は 合同**。"
                        u"⑥合同だから 角BPQ＝角BPQ'＝角BPA＝**75度**。"
                        u"⑦Q'・P・Dは 一直線（180度）。Pのところに 角BPA（75度）・角BPQ（75度）・x が "
                        u"ならぶので、x＝180−75−75＝**30度**。"},
        ],
    }
    return [d5, d6, d7]


# ============================================================
def main():
    recs = build() + build_rest()
    # --- 答えの形の見はり（[[feedback_answerable_format]]）---
    for r in recs:
        for st in r["steps"]:
            a = st["answer"]
            if "choices" in st:
                assert a in st["choices"], u"choicesに答えが無い: %s (%s)" % (a, r["id"])
            else:
                assert a.lstrip("-").isdigit(), u"テンキーで打てない答え: %s (%s)" % (a, r["id"])
            assert st.get("meaning"), u"解説がない: %s" % r["id"]
            assert st.get("svg"), u"図がない: %s" % r["id"]
    n_steps = sum(len(r["steps"]) for r in recs)
    print(u"大問 %d 本 / 設問 %d 問 / 図 %d 枚" %
          (len(recs), n_steps, sum(1 for r in recs for s in r["steps"] if s.get("svg"))))
    print(check_report())

    # --- 書きこみ。★並行セッションが同じファイルを触るので 読んで→足して→すぐ書く ---
    d = json.load(io.open(DAIMON, encoding="utf-8"))
    g3 = d["grades"]["3"]
    g3.setdefault(COURSE, {}).setdefault("fukushu", {})[NO] = recs
    io.open(DAIMON, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=1) + chr(10))
    print(u"書きこみ: %s ← 小3最レ（刷新版）の宿題 No.%s" % (DAIMON, NO))




# ============================================================
#  原簿（種本）へ書く文章を組み立てる。★アプリと同じ生成元から出す＝ずれない
#    追記は「末尾に足すだけ」。9.6MBの原簿を読んで書き戻すと
#    並行セッションの書きこみを消しかねない（[[feedback_heikou_session_jouyaki]]）
# ============================================================
GENBO_HEAD = u"""
## ★★★ 小3最レ 刷新版 No.15「9月1回目 平面図形(3) 角②」（HG-1442〜1448）★2026-09-06 収録

**次男が いま習っている回**（今日が9/6で、9月1回目＝この回）。**No.14「平面図形(2) 角①」の次の回**。全7大問17小問。
> 📄 出典 `3年 最レ算数 第2分冊.pdf` p52-58（問題）／`解答 3年 最レ算数 第2分冊.pdf` p42-50（解答・解説）
> 入手経路：本人がGoogle Driveの「3年算数最レ」フォルダへ第1・第2分冊＋解答の4本を追加（2026-09-05 23:53）→ リンク共有で `curl` 取得（→[[tool_drive_pdf_torikomi]]）
> ローカルの実物：`C:/Users/User/Desktop/hama_in/s3sairei_b2.pdf` ／ `s3sairei_b2_ans.pdf`
> ページ画像：`hama_in/b2/p052.jpeg`〜`p058.jpeg`（問題）／`hama_in/b2a/p042.jpeg`〜`p050.jpeg`（解答・解説）。スキャン198dpi・very clear

**★この回の骨は「同じ長さの辺をさがす」ただ1つ。**
> **正方形の4辺・正三角形の3辺・円の半径・ひし形の4辺——ぜんぶ『同じ長さ』の親せき。**
> **同じ長さの辺が2本そろえば二等辺三角形ができ、そこから角が2つ同時に手に入る。**
> **衣装**：①正方形＋正三角形（大問1）②円・おうぎ形の半径（大問2）③弧の交点にできる正三角形（大問3）
> ④等しい辺を数珠つなぎにたどる（大問4）⑤合同の3条件（大問5）⑥合同だから角をうつす（大問6）⑦三角形を回して重ねる（大問7）

**★この回でいちばん大事な発見は3つ**
1. **角が足りないときは「中心と結ぶ」**（大問2）。半径はどこも同じなので、結んだ瞬間に二等辺三角形が2こ増える
2. **2つの弧の交点は、両方の中心から半径ぶん**（大問3）。だからそこに **正三角形が立ち、60度が湧く**
3. **合同は「角をうつす道具」**（大問6・7）。角の大きさを1つも計算せずに、はなれた所へ角を運べる

**⚠この回の答え（解答p42で確定・こちらでも全問 解き直して一致・実機でも19問すべて〇を確認）**
| 大問 | 答え |
|---|---|
| 1 | (1)75度 (2)60度 |
| 2 | (1)98度 (2)45度 |
| 3 | (1)45度 (2)x52度・y68度 |
| 4 | (1)65度 (2)x68度・y56度 |
| 5 | (1)キ (2)ク (3)カ (4)オ |
| 6 | (1)117度 (2)40度 (3)120度 |
| 7 | (1)70度 (2)30度 |

**🚨 実物の図にはラベルが無い大問がある（大問3(1)・大問5・大問7）。アプリでは足した。**
大問3(1)は正方形の頂点も交点も無名のままで、解説を「左上の点」「左下の点」と呼ぶしかない。
**アプリは A〜D と P（2つの弧の交点）を足した**。大問7も P（辺BC上）・Q（辺DC上）を足している。
設問の中身は1文字も変えていない。**読むための名前を足しただけ**（→[[feedback_genbo_dori]]）。

**🚨 大問5の図は たて長で、アプリの `.sq-figure svg { max-height:260px }` に つぶされて 幅140pxになった。**
「3cm」「60°」が読めない。**8つの三角形を340×260に収める形は物理的に無い**（横4列でも1つ85px）。
→ **クイズ画面の図をタップで拡大できるようにアプリ側を直した**（`js/sansu.js` の `openDiagramViewer` の対象に `.sq-figure svg` を足す・2026-09-06）。
実機で拡大画面を出して 8つとも読めることを確認ずみ。

"""


def genbo():
    recs = build() + build_rest()
    meta = {
        "HG-1442": (u"大問1（正方形と正三角形を重ねる）★★",
                    u"**正方形の辺＝正三角形の辺**。同じ長さの辺が となりあうと **二等辺三角形が かくれて できる**",
                    u"**角より先に「辺」を見る**。長さが等しいと分かった瞬間、角が2つ同時に手に入る",
                    u"あり（2問とも）",
                    u"★★この回の入口。(1)は二等辺三角形1つで終わるが、(2)は **二等辺→対角線45度→外角定理** と3段に伸びる。"
                    u"**同じ「正方形＋正三角形」の骨を 2つの衣装で着せる**最レらしい並び。"
                    u"(2)のEは正方形の外にあり、角EBC＝60＋90＝150度と **角を足して150度を作る**のがヤマ"),
        "HG-1443": (u"大問2（円の半径は みんな同じ長さ）★★",
                    u"**半径はどこも同じ長さ**。中心と円周上の点を結ぶと **かならず二等辺三角形**ができる",
                    u"**角が足りなくて こまったら、まず中心と結ぶ**。(2)は12等分の「何つ分」を数えるだけで中心角が出る",
                    u"あり（2問とも。(2)は円周12等分の点を全部打ち、中心にも点とOを置いた）",
                    u"★★小3におうぎ形・円が出る回（浜のカリキュラムでは小5だが、最レは1学年先→[[feedback_hamagakuen_curriculum]]）。"
                    u"(1)は **中心角→二等辺→底角** を2回くり返して 引き算1回で終わる。"
                    u"(2)の「12等分＝1つ分30度」は、のちの円周角（中心角の半分）につながる種。"
                    u"解答の解説は ○▲の記号でまとめているが、**アプリは『AとBは4つ分・AとCは5つ分』と数えさせる形に開いた**（小3が図から直接読めるため）"),
        "HG-1444": (u"大問3（おうぎ形の中に かくれた正三角形）★★★",
                    u"**2つの弧の交点は、どちらの中心からも半径ぶん**＝3辺が等しい＝**正三角形**",
                    u"**弧の交点に正三角形が立つと、そこから60度が湧く**。(2)は半円とおうぎ形の半径が同じ長さになる所をさがして正三角形を作る",
                    u"あり（(1)は正方形＋四分円2つ。(2)は半円＋中心角136度のおうぎ形。実物にラベルが無いのでA〜D・Pを足した）",
                    u"★★★この回のいちばん深い所。(1)は **正三角形（60度）＋二等辺三角形（75度）＋一直線（180度）** の3つを"
                    u"Pの1点に集めて 180−(75+60)=45 と出す。"
                    u"(2)は **中心角136度から正三角形の60度をひいて76度**→二等辺で52度→一直線で68度、と x→y の順でしか出ない連鎖。"
                    u"実物の「角x, yはそれぞれ何度」を **xを聞く設問とyを聞く設問に割った**（→アプリは19問になる）"),
        "HG-1445": (u"大問4（かくれた二等辺三角形を 見つける）★★",
                    u"**等しい辺を たどって、二等辺三角形を 数珠つなぎに 見つける**",
                    u"(1)は **BE＝BC → AE＝BE → DE＝AE** と3回つないで やっと x に届く。**1つ見つけるたびに 次の材料が増える**",
                    u"あり（(1)は四角形ABCD＋AE・BE・BDの3本。(2)はひし形＋AE・BEの2本）",
                    u"★★(1)は **二等辺→正三角形→二等辺** と 種類の違う三角形を3つ渡り歩く。"
                    u"「DE＝BC」という **問題文だけに書いてあって図には無い条件** が最後のつなぎ目になるのがうまい。"
                    u"(2)のひし形は「4辺が等しい＝二等辺三角形の宝庫」。x を出さないと y が出ないので2問に割った"),
        "HG-1446": (u"大問5（合同な三角形を さがす）★",
                    u"**合同の3条件**：①3つの辺 ②2つの辺とその間の角 ③1つの辺とその両はしの角",
                    u"**向きがちがっても・ひっくり返っていても 合同**。エとオは「30-60-90 で、6cmが 90度と30度の間」まで見ないと決まらない",
                    u"あり（ア〜クの8つを2列×4行。**たて長なので クイズ画面ではつぶれる→タップ拡大で対応**）",
                    u"★1。この回で唯一の記号選択。**実物は記述式**なので、アプリでは **自分をのぞく7択**にした。"
                    u"8つの三角形は 実物の向き・印字（cmと度）を そのまま写している。"
                    u"⚠**角が同じだけでは合同と言えない**（大きさがちがうかもしれない）ことを (4) で必ず踏ませる設計。"
                    u"⚠1cm＝18pxより小さく描くと、3cmの三角形に「60°」の文字が入らない（実測）"),
        "HG-1447": (u"大問6（合同だから 角が うつせる）★★★",
                    u"**合同 → 対応する角は等しい → はなれた角を うつしてくる**",
                    u"(1)は **重なった角をひいて そろえる**（角BAC＝角DAE から 角BAD＝角CAE）。"
                    u"(2)(3)は「2辺と間の角」で合同を作り、**角度を1つも計算せずに** 答えを運ぶ",
                    u"あり（3問とも。(1)は三角形ABCをAのまわりに23度回して三角形ADE。実物にFが無いので交点Fを足した）",
                    u"★★★(2)は正方形2つがCでつながる形。**角FCB＝90−角FCD、角GCD＝90−角FCD**——"
                    u"同じものをひいているから等しい、という **引き算で角をそろえる**手。"
                    u"(3)は正三角形＋BP＝CQ で120度。**●と△の1つ分は最後まで分からないのに、和だけで答えが出る**"
                    u"＝[[HG-1436]][[HG-1437]]（No.14 大問6・7）の骨と まっすぐつながっている"),
        "HG-1448": (u"大問7（三角形を いどうさせる）★★★",
                    u"**正方形の辺が等しいことを使って、三角形を回して 別の辺に重ねる**",
                    u"**回した先の直角が「一直線」を作り、それで角がつながる**。(1)は P'・D・Q、(2)は Q'・A・P・D が一直線になる",
                    u"あり（2問とも。20度・15度の細い角があるので 正方形を200pxで作り、ラベルは引き出し線で外へ出した）",
                    u"★★★この回のしあげ。**実物の解説は「三角形をいどうさせる」の一言**しかないので、"
                    u"アプリでは **①辺を重ねるように回す ②回した先の直角で3点が一直線になる ③合同だから角が等しい** と3段に開いた。"
                    u"⚠**回す向きをまちがえると Q' が正方形の内がわに来て 一直線にならない**。"
                    u"(2)は BC→BA へ回すと Q' が **Aの外がわ**（正方形の外）に出る——ここを座標で確かめてから解説を書いた"),
    }

    out = [GENBO_HEAD]
    for r in recs:
        hg = r["hg"]
        title, hone, core, zu, memo = meta[hg]
        out.append(u"### 【%s】小3最レ（刷新版）No.15 %s" % (hg, title) + chr(10))
        out.append(u"- 骨: %s" % hone + chr(10))
        out.append(u"- コア発見: %s" % core + chr(10))
        out.append(u"- 設定: %s" % r["intro"].replace("**", "").replace(chr(10), "") + chr(10))
        qs = " ".join("(%d) %s" % (i + 1, st["question"]) for i, st in enumerate(r["steps"]))
        out.append(u"- 設問: %s" % qs + chr(10))
        ans = " ".join("(%d) %s" % (i + 1, st["answer"] + (u"度" if st["answer"].isdigit() else ""))
                       for i, st in enumerate(r["steps"]))
        out.append(u"- 図: %s ／ 答え: %s" % (zu, ans) + chr(10))
        for i, st in enumerate(r["steps"]):
            if st.get("choices"):
                out.append(u"- 選択肢(%d): %s" % (i + 1, u"・".join(st["choices"])) + chr(10))
        for i, st in enumerate(r["steps"]):
            out.append(u"- 解法(%d): %s" % (i + 1, st["meaning"].replace("**", "")) + chr(10))
        out.append(u"- 作問メモ: %s" % memo + chr(10))
        out.append(u"- アプリ実装: `data/hama_daimon.json` grades.3.sairei_new_bunsatsu.fukushu[" + chr(34) + "15" + chr(34) +
                   u"] の `%s`" % r["id"] +
                   u"（生成元 `scripts/gen_s3sairei_no15.py`＋`scripts/zu_kit.py`。**JSONを手で書かない**）" + chr(10))
        seen = set()
        for i, st in enumerate(r["steps"]):
            sv = st.get("svg")
            if sv and sv not in seen:
                seen.add(sv)
                out.append(u"- 図SVG(%d):" % (i + 1) + chr(10) + "```html" + chr(10) + sv + chr(10) + "```" + chr(10))
        out.append(chr(10))
    return "".join(out)


def write_genbo():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from genbo_path import find_genbo
    p = find_genbo()
    body = genbo()
    with io.open(p, "a", encoding="utf-8") as fh:      # ★追記だけ。読んで書き戻さない
        fh.write(body)
    print(u"原簿に追記: %s（%d文字・大問7本）" % (p, len(body)))


if __name__ == "__main__":
    if "--genbo" in sys.argv:
        write_genbo()
    else:
        main()
