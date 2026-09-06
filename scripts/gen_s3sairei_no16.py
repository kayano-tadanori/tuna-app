# -*- coding: utf-8 -*-
u"""小3最レ【刷新版】No.16「9月2回目 平面図形(4) 面積①」を実物から実装する。

  出典: 「3年 最レ算数 第2分冊.pdf」p59-66（問題）／「解答 3年 最レ算数 第2分冊.pdf」p51-58（解答・解説）
        どちらも 2026-09-05 に本人がGoogle Driveへ追加 → リンク共有で取得（[[tool_drive_pdf_torikomi]]）
  ローカルの実物: C:/Users/User/Desktop/hama_in/s3sairei_b2.pdf ／ s3sairei_b2_ans.pdf
                  ページ画像 hama_in/b2/p059.jpeg〜p066.jpeg（問題）、hama_in/b2a/p051.jpeg〜p058.jpeg（解答）
  原簿: HG-1449〜1456（大問1〜8）

  ★方針（[[feedback_genbo_dori]] [[feedback_zu_wa_genbo_ni_nai]] [[feedback_jitsubutsu_zenbu_soroeru]]）
    ・全8大問22問を まるごと入れる。途中で切らない
    ・設問・数値・答えは実物のまま。答え方の様式だけ変える
    ・図は実物を見て**座標で組み立て**、印字してある角度・長さを**座標から測り直して検算**する
    ・答えは 解答ページ(p51)と こちらで解き直した結果の**両方が一致**したものだけ入れる
    ・大問5（折り紙）は、折り目線の正確な機構が低解像度スキャンからは一意に確定できない
      （要現物照合・[[feedback_handoku_funou_utagau]]）。**答え(68)と、G/Fが対角線ACの鏡映である
      という数値的に検証ずみの構成**を採用した。視覚的な上下配置が実物と多少ちがう可能性がある
"""
import math, json, io, os, sys
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zu_kit import (P, polar, ang_of, angle_at, dist, unit, lerp, mid, rot_about,
                    inter, shift, must, CHECKS, check_report, Svg,
                    COL_LINE, COL_GIVEN, COL_ASK, COL_ARC, COL_ARC2, COL_MARK, COL_SUB)

COURSE = "sairei_new_bunsatsu"
NO = "16"
DAIMON = "data/hama_daimon.json"


def reflect(p, a, b):
    u"""点 p を 直線 a-b に関して鏡映した点"""
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    proj = (ax + t * dx, ay + t * dy)
    return (2 * proj[0] - px, 2 * proj[1] - py)


# ============================================================
#  大問1 基本の4公式
# ============================================================
def fig_1_1():
    u"""正方形、1辺13cm"""
    a = 160
    A = P(70, 30); B = P(70, 30 + a); C = P(70 + a, 30 + a); D = P(70 + a, 30)
    s = Svg(300, 220)
    s.poly([A, B, C, D])
    s.seg_label(A, B, u"13cm", 24, -1)
    must(u"1(1) 正方形の辺", dist(A, B), a, 0.5)
    return s.out()


def fig_1_2():
    u"""長方形、たて14cm・よこ25cm"""
    W, H = 250, 140
    A = P(20, 30); B = P(20, 30 + H); C = P(20 + W, 30 + H); D = P(20 + W, 30)
    s = Svg(300, 210)
    s.poly([A, B, C, D])
    s.seg_label(A, B, u"14cm", 22, -1)
    s.seg_label(B, C, u"25cm", 20, 1)
    return s.out()


def fig_1_3():
    u"""平行四辺形、底辺11cm・高さ9cm"""
    base = 220; height = 90; slant = 55
    B1 = P(30, 150); B2 = P(30 + base, 150)
    T1 = P(B1[0] + slant, 150 - height); T2 = P(T1[0] + base, T1[1])
    foot = P(T1[0], B1[1])
    s = Svg(320, 190)
    s.poly([B1, B2, T2, T1])
    s.line(T1, foot, COL_SUB, 1.5, dash=True)
    s.right_angle(foot, T1, B1, 10, COL_SUB)
    s.seg_label(B1, B2, u"11cm", 20, 1)
    s.seg_label(T1, foot, u"9cm", 16, 1)
    must(u"1(3) 底辺11cm", dist(B1, B2), 220, 0.5)
    must(u"1(3) 高さ9cm", dist(T1, foot), 90, 0.5)
    must(u"1(3) 面積", dist(B1, B2) / 20.0 * (dist(T1, foot) / 10.0), 99, 0.1)
    return s.out()


def fig_1_4():
    u"""三角形、底辺12cm・高さ9cm"""
    base = 220; height = 90
    B1 = P(50, 150); B2 = P(50 + base, 150)
    T = P(B1[0] + 90, 150 - height)
    foot = P(T[0], B1[1])
    s = Svg(300, 190)
    s.poly([B1, B2, T])
    s.line(T, foot, COL_SUB, 1.5, dash=True)
    s.right_angle(foot, T, B1, 10, COL_SUB)
    s.seg_label(B1, B2, u"12cm", 20, 1)
    s.seg_label(T, foot, u"9cm", 16, -1)
    return s.out()


# ============================================================
#  大問2 分ける／全体からひく
# ============================================================
U2 = 15.0  # 1cm=15px


def fig_2_1():
    u"""L字型。A(0,4)-B(6,4)-C(6,0)-D(10,0)-E(10,10)-F(0,10)  ※単位cm、下でpxに変換"""
    pts_cm = [P(0, 4), P(6, 4), P(6, 0), P(10, 0), P(10, 10), P(0, 10)]
    A, B, C, D, E, F = [P(x * U2, y * U2) for (x, y) in pts_cm]
    A, B, C, D, E, F = shift([A, B, C, D, E, F], 40, 20)
    s = Svg(230, 220)
    s.poly([A, B, C, D, E, F])
    s.seg_label(A, B, u"6cm", 18, -1)
    s.seg_label(B, C, u"4cm", 18, 1)
    s.seg_label(D, E, u"10cm", 20, 1)
    s.seg_label(F, E, u"10cm", 20, -1)
    must(u"2(1) AB=6cm", dist(A, B), 6 * U2, 0.5)
    must(u"2(1) BC=4cm", dist(B, C), 4 * U2, 0.5)
    must(u"2(1) DE=10cm", dist(D, E), 10 * U2, 0.5)
    must(u"2(1) FE=10cm", dist(F, E), 10 * U2, 0.5)
    from zu_kit import bbox
    x0, y0, x1, y1 = bbox([A, B, C, D, E, F])
    area = 0.0
    pts = [A, B, C, D, E, F]
    for i in range(len(pts)):
        x1p, y1p = pts[i]; x2p, y2p = pts[(i + 1) % len(pts)]
        area += x1p * y2p - x2p * y1p
    area = abs(area) / 2 / (U2 * U2)
    must(u"2(1) 面積", area, 76, 0.1)
    return s.out()


def fig_2_2():
    u"""凧形：左下角P1・左上あたりP2・上頂点P3(直角)・右下P4。
       P1P4=15(底辺)、P2から底辺までの高さ=8、P2-P3=10、P3-P4=13、角P3=90度"""
    P1 = P(0, 0); P4 = P(15, 0)
    x2 = 15 - math.sqrt(205)  # |P2P4|=sqrt(10^2+13^2)=sqrt269 とするための逆算
    P2 = P(x2, -8)
    # P3: P2から10・P4から13・直角の条件を満たす点（円と円の交点）
    d = dist(P2, P4)
    a_ = (10.0 ** 2 - 13.0 ** 2 + d * d) / (2 * d)
    h_ = math.sqrt(max(10.0 ** 2 - a_ * a_, 0))
    ex, ey = unit(P2, P4); nx, ny = -ey, ex
    P3 = P(P2[0] + ex * a_ + nx * h_, P2[1] + ey * a_ + ny * h_)
    if P3[1] > 0:   # 上側（y<0）を選ぶ
        P3 = P(P2[0] + ex * a_ - nx * h_, P2[1] + ey * a_ - ny * h_)
    pts = [P1, P2, P3, P4]
    U = 15.0
    pts_px = [P(p[0] * U, p[1] * U) for p in pts]
    P1, P2, P3, P4 = shift(pts_px, 40, 210)
    s = Svg(320, 240)
    s.poly([P1, P2, P3, P4], fill_opacity=0.25)
    s.line(P2, P4, COL_LINE, 2)   # 分ける対角線
    foot = P(P2[0], P1[1])
    s.line(P2, foot, COL_SUB, 1.5, dash=True)
    s.right_angle(foot, P2, P1, 9, COL_SUB)
    s.right_angle(P3, P2, P4, 9)
    s.seg_label(P1, P4, u"15cm", 20, 1)
    s.seg_label(P2, foot, u"8cm", 14, -1)
    s.seg_label(P2, P3, u"10cm", 16, -1)
    s.seg_label(P3, P4, u"13cm", 16, 1)
    must(u"2(2) 底辺15", dist(P1, P4), 15 * U, 0.5)
    must(u"2(2) 高さ8", abs(P2[1] - P1[1]), 8 * U, 0.5)
    must(u"2(2) 10cm", dist(P2, P3), 10 * U, 0.5)
    must(u"2(2) 13cm", dist(P3, P4), 13 * U, 0.5)
    must(u"2(2) 角P3=90度", angle_at(P3, P2, P4), 90, 0.5)
    tri1 = abs((P1[0] * (P2[1] - P4[1]) + P2[0] * (P4[1] - P1[1]) + P4[0] * (P1[1] - P2[1]))) / 2 / (U * U)
    tri2 = abs((P2[0] * (P3[1] - P4[1]) + P3[0] * (P4[1] - P2[1]) + P4[0] * (P2[1] - P3[1]))) / 2 / (U * U)
    must(u"2(2) 面積", tri1 + tri2, 125, 0.1)
    return s.out()


def fig_2_3():
    u"""8×12長方形の左上角と、右辺の2cm点・下辺の6cm点を結ぶ三角形"""
    U = 15.0
    TL = P(0, 0); TR = P(12, 0); BR = P(12, 8); BL = P(0, 8)
    R = P(12, 2); M = P(6, 8)
    pts_px = [P(p[0] * U, p[1] * U) for p in (TL, TR, BR, BL, R, M)]
    TL, TR, BR, BL, R, M = shift(pts_px, 45, 25)
    s = Svg(260, 185)
    s.poly([TL, TR, BR, BL])
    s.right_angle(TL, TR, BL, 9, COL_SUB); s.right_angle(TR, BR, TL, 9, COL_SUB)
    s.right_angle(BR, BL, TR, 9, COL_SUB); s.right_angle(BL, TL, BR, 9, COL_SUB)
    s.poly([TL, R, M], COL_ASK, fill_opacity=0.25)
    s.seg_label(TR, R, u"2cm", 16, 1)
    s.seg_label(BL, M, u"6cm", 18, 1)
    must(u"2(3) 8×12の辺(たて)", dist(TL, BL), 8 * U, 0.5)
    must(u"2(3) 8×12の辺(よこ)", dist(TL, TR), 12 * U, 0.5)
    must(u"2(3) 2cm", dist(TR, R), 2 * U, 0.5)
    must(u"2(3) 6cm", dist(BL, M), 6 * U, 0.5)
    area = abs(TL[0] * (R[1] - M[1]) + R[0] * (M[1] - TL[1]) + M[0] * (TL[1] - R[1])) / 2 / (U * U)
    must(u"2(3) 面積", area, 42, 0.1)
    return s.out()


# ============================================================
#  大問3 対角線の技／風車型
# ============================================================
def fig_3_1():
    u"""10cm×11cmの長方形の中点を結ぶ四角形（対角線の技）"""
    U = 16.0
    W, H = 11, 10
    TL = P(0, 0); TR = P(W, 0); BR = P(W, H); BL = P(0, H)
    Lm = P(0, H / 2.0); Rm = P(W, H / 2.0); Tm = P(W / 2.0, 0); Bm = P(W / 2.0, H)
    pts_px = [P(p[0] * U, p[1] * U) for p in (TL, TR, BR, BL, Lm, Rm, Tm, Bm)]
    TL, TR, BR, BL, Lm, Rm, Tm, Bm = shift(pts_px, 62, 24)
    s = Svg(266, 220)
    s.poly([TL, TR, BR, BL])
    for c in (TL, TR, BR, BL):
        pass
    s.right_angle(TL, TR, BL, 9, COL_SUB); s.right_angle(TR, BR, TL, 9, COL_SUB)
    s.right_angle(BR, BL, TR, 9, COL_SUB); s.right_angle(BL, TL, BR, 9, COL_SUB)
    s.poly([Tm, Rm, Bm, Lm], COL_ASK, fill_opacity=0.25)
    s.line(Lm, Rm, COL_SUB, 1.3, dash=True)
    s.line(Tm, Bm, COL_SUB, 1.3, dash=True)
    s.text(polar(Lm, 180, 40), u"10cm", COL_GIVEN, 15)
    s.seg_label(BL, BR, u"11cm", 20, 1)
    must(u"3(1) たて10", dist(TL, BL), H * U, 0.5)
    must(u"3(1) よこ11", dist(BL, BR), W * U, 0.5)
    area = W * H / 2.0
    must(u"3(1) 面積", area, 55, 0.01)
    return s.out()


def fig_3_2():
    u"""14cm×16cm長方形。左右の頂点は上から7cm(=中点)、対角線が辺と平行"""
    U = 12.0
    W, H = 16, 14
    TL = P(0, 0); TR = P(W, 0); BR = P(W, H); BL = P(0, H)
    Lp = P(0, 7); Rp = P(W, 7)          # 左右とも中点（=7cm）
    Tp = P(3, 0); Bp = P(3, H)          # 上下は同じx（縦の対角線）
    pts_px = [P(p[0] * U, p[1] * U) for p in (TL, TR, BR, BL, Lp, Rp, Tp, Bp)]
    TL, TR, BR, BL, Lp, Rp, Tp, Bp = shift(pts_px, 44, 24)
    s = Svg(270, 200)
    s.poly([TL, TR, BR, BL])
    s.right_angle(TL, TR, BL, 9, COL_SUB); s.right_angle(TR, BR, TL, 9, COL_SUB)
    s.right_angle(BR, BL, TR, 9, COL_SUB); s.right_angle(BL, TL, BR, 9, COL_SUB)
    s.poly([Tp, Rp, Bp, Lp], COL_ASK, fill_opacity=0.25)
    s.seg_label(TL, BL, u"14cm", 34, -1)
    s.seg_label(TL, Lp, u"7cm", 16, 1)
    s.seg_label(TR, Rp, u"7cm", 16, 1)
    s.seg_label(BL, BR, u"16cm", 20, 1)
    must(u"3(2) たて14", dist(TL, BL), H * U, 0.5)
    must(u"3(2) よこ16", dist(BL, BR), W * U, 0.5)
    must(u"3(2) 左7cm", dist(TL, Lp), 7 * U, 0.5)
    must(u"3(2) 右7cm", dist(TR, Rp), 7 * U, 0.5)
    area = W * H / 2.0
    must(u"3(2) 面積", area, 112, 0.01)
    return s.out()


def fig_3_3():
    u"""10cm×10cm正方形の風車型。R=右上から2cm・B=左下から3cm。T,Lは(1,0),(0,5)（検算ずみの構成）"""
    U = 16.0
    S = 10.0
    TL = P(0, 0); TR = P(S, 0); BR = P(S, S); BL = P(0, S)
    T = P(1, 0); R = P(S, 2); B = P(3, S); L = P(0, 5)
    pts_px = [P(p[0] * U, p[1] * U) for p in (TL, TR, BR, BL, T, R, B, L)]
    TL, TR, BR, BL, T, R, B, L = shift(pts_px, 30, 24)
    s = Svg(230, 210)
    s.poly([TL, TR, BR, BL])
    s.right_angle(TL, TR, BL, 9, COL_SUB); s.right_angle(TR, BR, TL, 9, COL_SUB)
    s.right_angle(BR, BL, TR, 9, COL_SUB); s.right_angle(BL, TL, BR, 9, COL_SUB)
    s.poly([T, R, B, L], COL_ASK, fill_opacity=0.25)
    s.seg_label(TR, R, u"2cm", 16, 1)
    s.seg_label(BL, B, u"3cm", 18, 1)
    must(u"3(3) 正方形10×10(たて)", dist(TL, BL), S * U, 0.5)
    must(u"3(3) 正方形10×10(よこ)", dist(TL, TR), S * U, 0.5)
    must(u"3(3) 2cm", dist(TR, R), 2 * U, 0.5)
    must(u"3(3) 3cm", dist(BL, B), 3 * U, 0.5)
    pts = [T, R, B, L]
    area = 0.0
    for i in range(4):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % 4]
        area += x1 * y2 - x2 * y1
    area = abs(area) / 2 / (U * U)
    must(u"3(3) 面積", area, 53, 0.1)
    return s.out()


# ============================================================
#  大問4 紙を重ねる
# ============================================================
def fig_4_2():
    u"""ア(15×12)とイ(10×18)、左上そろえで重ねる。図2そのもの"""
    U = 10.0
    Ha, Hi = 12.0, 18.0
    A_TL = P(0, 0); A_TR = P(15, 0); A_BR = P(15, Ha); A_BL = P(0, Ha)
    I_TL = P(0, 0); I_TR = P(10, 0); I_BR = P(10, Hi); I_BL = P(0, Hi)
    pts_px = [P(p[0] * U, p[1] * U) for p in
              (A_TL, A_TR, A_BR, A_BL, I_TL, I_TR, I_BR, I_BL)]
    A_TL, A_TR, A_BR, A_BL, I_TL, I_TR, I_BR, I_BL = shift(pts_px, 40, 38)
    s = Svg(260, 240)
    s.poly([A_TL, A_TR, A_BR, A_BL])
    s.poly([I_TL, I_TR, I_BR, I_BL])
    # ア専用（イと重ならない）帯：右5cm×たて12cm
    s.b.append('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s" fill-opacity="0.35" stroke="none"/>'
               % (I_TR[0], A_TL[1], A_TR[0], A_TL[1], A_BR[0], A_BR[1], I_TR[0], I_TR[1], COL_ASK))
    # イ専用（アと重ならない）帯：下6cm×よこ10cm
    s.b.append('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s" fill-opacity="0.35" stroke="none"/>'
               % (I_BL[0], A_BR[1], I_BR[0], A_BR[1], I_BR[0], I_BR[1], I_BL[0], I_BL[1], COL_MARK))
    s.text(mid(A_TL, A_TR), u"15cm", COL_GIVEN, 15)
    s.text((mid(I_TR, I_BR)[0] + 18, mid(I_TR, I_BR)[1]), u"10cm", COL_GIVEN, 15)
    s.text(mid(I_BL, I_BR), u"6cm", COL_MARK, 13)
    must(u"4 アの横", dist(A_TL, A_TR), 15 * U, 0.5)
    must(u"4 イの横", dist(I_TL, I_TR), 10 * U, 0.5)
    must(u"4 アのたて(2)の答え確認", Ha, 12, 0.01)
    must(u"4 イのたて(3)の答え確認", Hi, 18, 0.01)
    ar_not_overlap = (15 - 10) * Ha
    ir_not_overlap = 10 * (Hi - Ha)
    must(u"4(1) アの重ならない部分=イの重ならない部分", ar_not_overlap, ir_not_overlap, 0.01)
    must(u"4(1) 答え60", ir_not_overlap, 60, 0.01)
    must(u"4 面積が等しい(ア=イ=180)", 15 * Ha, 10 * Hi, 0.01)
    return s.out()


# ============================================================
#  大問5 折り紙（対角線ACに関する鏡映で構成。要現物照合の注記つき）
# ============================================================
def fig_5():
    u"""★要現物照合：折り目線の正確な機構(GとFの向き)は低解像度スキャンからは一意に
       確定できなかった（→[[feedback_handoku_funou_utagau]]）。ここでは「対角線ACに
       関して鏡映する」という、数値がすべて一致する構成を採用した
       （AG=8,CG=15,AF=AD,CF=17,面積=68）。実物は G・F とも紙の上側に描かれているが、
       この構成では F が下側に来る。**上下の向きは実物と異なる可能性がある**が、
       長さ・角度・面積の関係はすべて検算ずみで正しい"""
    U = 8.0
    A = P(0, 0); B = P(0, 8); C = P(15, 8); D = P(32, 8); E = P(32, 0)
    G = reflect(B, A, C); F = reflect(D, A, C)
    pts_px = [P(p[0] * U, p[1] * U) for p in (A, B, C, D, E, G, F)]
    A, B, C, D, E, G, F = shift(pts_px, 90, 60)
    from zu_kit import bbox
    x0, y0, x1, y1 = bbox([A, B, C, D, E, G, F])
    pad = 30
    A, B, C, D, E, G, F = shift([A, B, C, D, E, G, F], pad - x0, pad - y0)
    s = Svg(int(x1 - x0 + 2 * pad), int(y1 - y0 + 2 * pad))
    s.line(A, E, COL_SUB, 1.5, dash=True); s.line(E, D, COL_SUB, 1.5, dash=True)
    s.poly([A, C, F], COL_ASK, fill_opacity=0.25)
    s.line(A, B); s.line(B, C); s.line(A, G); s.line(G, F); s.line(F, C); s.line(A, C)
    s.vtext(A, C, "A"); s.vtext(B, C, "B"); s.vtext(C, A, "C")
    s.text(polar(D, -75, 16), "D", COL_LINE, 14)
    s.text(polar(E, 45, 16), "E", COL_LINE, 14)
    s.text(polar(G, 135, 16), "G", COL_LINE, 14)
    s.text(polar(F, -60, 16), "F", COL_LINE, 14)
    s.seg_label(A, B, u"8cm", 16, -1)
    s.seg_label(B, C, u"15cm", 20, 1)
    s.seg_label(A, G, u"8cm", 14, -1)
    must(u"5 AB=8", dist(A, B), 8 * U, 0.5)
    must(u"5 BC=15", dist(B, C), 15 * U, 0.5)
    must(u"5 AE(よこ全体)=32", dist(A, E), 32 * U, 0.5)
    must(u"5 AG=8(鏡映で保存)", dist(A, G), 8 * U, 0.5)
    must(u"5 CG=15(鏡映で保存)", dist(C, G), 15 * U, 0.5)
    must(u"5 CF=CD=17(鏡映で保存)", dist(C, F), dist(C, D), 0.5)
    must(u"5 CD=17", dist(C, D), 17 * U, 0.5)
    area = abs(A[0] * (C[1] - F[1]) + C[0] * (F[1] - A[1]) + F[0] * (A[1] - C[1])) / 2 / (U * U)
    must(u"5 面積(三角形ACF)", area, 68, 0.1)
    return s.out()


# ============================================================
#  大問6 つけたし
# ============================================================
def fig_6_1():
    u"""長方形。A-B(2cm)-C(3cm)、AC=5。C-D=7(下辺)。E-D=5(右辺)。FはAE上でAF=4.2"""
    U = 20.0
    A = P(0, 0); Bp = P(0, 2); C = P(0, 5); D = P(7, 5); E = P(7, 0)
    AF = 4.2
    F = P(AF, 0)
    pts_px = [P(p[0] * U, p[1] * U) for p in (A, Bp, C, D, E, F)]
    A, Bp, C, D, E, F = shift(pts_px, 30, 24)
    s = Svg(230, 175)
    s.poly([A, E, D, C])
    s.poly([A, C, F], COL_ASK, fill_opacity=0.25)
    s.poly([Bp, D, C], COL_MARK, fill_opacity=0.25)
    s.right_angle(A, F, Bp, 9, COL_SUB); s.right_angle(E, D, A, 9, COL_SUB)
    s.vtext(A, D, "A"); s.text(polar(Bp, 180, 15), "B", COL_LINE, 13)
    s.vtext(C, D, "C"); s.vtext(D, A, "D"); s.vtext(E, A, "E")
    s.text(polar(F, 90, 14), "F", COL_ASK, 13)
    s.seg_label(A, Bp, "2cm", 14, -1); s.seg_label(Bp, C, "3cm", 14, -1)
    s.seg_label(E, D, "5cm", 14, 1); s.seg_label(C, D, "7cm", 16, 1)
    must(u"6(1) AB=2", dist(A, Bp), 2 * U, 0.5)
    must(u"6(1) BC=3", dist(Bp, C), 3 * U, 0.5)
    must(u"6(1) AC=5", dist(A, C), 5 * U, 0.5)
    must(u"6(1) CD=7", dist(C, D), 7 * U, 0.5)
    must(u"6(1) ED=5", dist(E, D), 5 * U, 0.5)
    acf = abs(A[0] * (C[1] - F[1]) + C[0] * (F[1] - A[1]) + F[0] * (A[1] - C[1])) / 2 / (U * U)
    bdc = abs(Bp[0] * (D[1] - C[1]) + D[0] * (C[1] - Bp[1]) + C[0] * (Bp[1] - D[1])) / 2 / (U * U)
    must(u"6(1) 三角形ACFとBCDが同じ面積", acf, bdc, 0.05)
    must(u"6(1) AF=4.2の検算", AF, 21.0 / 5, 0.001)
    return s.out()


def fig_6_2():
    u"""台形A(0,0)-TR(10,3)-BR(10,8)-BL(0,8)。対角線A-M(M=(7,8))とBL-TRの交点でウ・エができる"""
    U = 18.0
    A = P(0, 0); TR = P(10, 3); BR = P(10, 8); BL = P(0, 8); M = P(7, 8)
    Xp = inter(A, M, BL, TR)
    pts_px = [P(p[0] * U, p[1] * U) for p in (A, TR, BR, BL, M, Xp)]
    A, TR, BR, BL, M, Xp = shift(pts_px, 30, 20)
    s = Svg(230, 235)
    s.poly([A, TR, BR, BL])
    s.right_angle(BL, A, BR, 9, COL_SUB); s.right_angle(BR, TR, BL, 9, COL_SUB)
    s.poly([A, TR, Xp], COL_ASK, fill_opacity=0.25)
    s.poly([BL, Xp, M], COL_MARK, fill_opacity=0.25)
    s.line(A, M); s.line(BL, TR)
    s.vtext(A, BR, "A"); s.text(polar(TR, 0, 14), "", COL_LINE, 13)
    s.seg_label(A, BL, u"8cm", 16, -1)
    s.seg_label(TR, BR, u"5cm", 14, 1)
    s.seg_label(BL, M, u"7cm", 16, 1)
    s.seg_label(M, BR, u"3cm", 14, 1)
    s.text((mid(BL, BR)[0], mid(BL, BR)[1] + 42), u"10cm", COL_GIVEN, 15, anchor="middle")
    gW = ((A[0] + TR[0] + Xp[0]) / 3.0, (A[1] + TR[1] + Xp[1]) / 3.0)
    gE = ((BL[0] + Xp[0] + M[0]) / 3.0 - 26, (BL[1] + Xp[1] + M[1]) / 3.0 - 6)
    s.text(gW, u"ウ", COL_ASK, 16)
    s.text(gE, u"エ", COL_MARK, 16)
    must(u"6(2) 左辺8", dist(A, BL), 8 * U, 0.5)
    must(u"6(2) 右辺5", dist(TR, BR), 5 * U, 0.5)
    must(u"6(2) 下辺10", dist(BL, BR), 10 * U, 0.5)
    must(u"6(2) 7cm", dist(BL, M), 7 * U, 0.5)
    must(u"6(2) 3cm", dist(M, BR), 3 * U, 0.5)
    u_area = abs(A[0] * (TR[1] - Xp[1]) + TR[0] * (Xp[1] - A[1]) + Xp[0] * (A[1] - TR[1])) / 2 / (U * U)
    e_area = abs(BL[0] * (Xp[1] - M[1]) + Xp[0] * (M[1] - BL[1]) + M[0] * (BL[1] - Xp[1])) / 2 / (U * U)
    must(u"6(2) ウとエの差", u_area - e_area, 12, 0.1)
    return s.out()


# ============================================================
#  大問7 正六角形の分割
# ============================================================
def hexagon(cx, cy, r):
    return [polar(P(cx, cy), 90 + 60 * k, r) for k in range(6)]


def area_of(pts):
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def fig_7_1():
    u"""正六角形。上頂点(H0)→左上頂点(H1)→左下頂点(H2) の3頂点を結ぶ三角形＝全体の1/6（実物どおり）"""
    r = 90
    H = hexagon(150, 140, r)
    s = Svg(300, 260)
    s.poly(H)
    s.poly([H[0], H[1], H[2]], COL_ASK, fill_opacity=0.25)
    must(u"7(1) 正六角形の1辺", dist(H[0], H[1]), r, 0.5)
    must(u"7(1) 面積", area_of([H[0], H[1], H[2]]) / area_of(H), 1.0 / 6, 0.001)
    return s.out()


def fig_7_2():
    u"""正六角形。上頂点(H0)→左下頂点(H2)→下頂点(H3) の三角形＝全体の1/3（実物どおり）"""
    r = 90
    H = hexagon(150, 140, r)
    s = Svg(300, 260)
    s.poly(H)
    s.poly([H[0], H[2], H[3]], COL_ASK, fill_opacity=0.25)
    must(u"7(2) 面積", area_of([H[0], H[2], H[3]]) / area_of(H), 1.0 / 3, 0.001)
    return s.out()


def fig_7_3():
    u"""正六角形。H1(左上頂点)・H0(上頂点)・H0-H5辺のH0から1/3点 を結ぶ三角形＝全体の1/18。
       実物は H1-H0・H0-H5 の両辺に3等分の目印(=六角形の1辺を3等分できることを示す)がある"""
    r = 90
    H = hexagon(150, 140, r)
    third = lerp(H[1], H[0], 1.0 / 3)   # 目印用（H1から1/3の位置）
    p2 = lerp(H[0], H[5], 1.0 / 3)      # 斜線三角形の頂点（H0から1/3の位置）
    s = Svg(300, 260)
    s.poly(H)
    s.tick(H[1], third, 1); s.tick(third, H[0], 1)
    s.tick(H[0], p2, 1); s.tick(p2, H[5], 1)
    s.poly([H[1], H[0], p2], COL_ASK, fill_opacity=0.25)
    must(u"7(3) 面積", area_of([H[1], H[0], p2]) / area_of(H), 1.0 / 18, 0.001)
    return s.out()


def fig_7_4():
    u"""内側にできる正六角形（各辺の三等分点を結ぶ星型の中）＝全体の1/3"""
    r = 90
    H = hexagon(150, 140, r)
    inner = []
    for i in range(6):
        inner.append(lerp(H[i], H[(i + 2) % 6], 1.0 / 3))
    s = Svg(300, 260)
    s.poly(H)
    for i in range(6):
        s.line(H[i], H[(i + 2) % 6], COL_SUB, 1.3)
    s.poly(inner, COL_ASK, fill_opacity=0.25)
    must(u"7(4) 面積", area_of(inner) / area_of(H), 1.0 / 3, 0.001)
    return s.out()


# ============================================================
#  大問8 面積図（差×和の技）
# ============================================================
def fig_8_1():
    u"""35×35-34×34 を 面積図で。L字帯：1×35(横)+34×1(縦)=69"""
    U = 5.0
    S = 35.0
    TL = P(0, 0); TR = P(S, 0); BR = P(S, S); BL = P(0, S)
    IL = P(0, 1); IBR = P(S - 1, S)
    pts_px = [P(p[0] * U, p[1] * U) for p in (TL, TR, BR, BL, IL, IBR)]
    TL, TR, BR, BL, IL, IBR = shift(pts_px, 46, 40)
    s = Svg(260, 250)
    s.poly([TL, TR, BR, BL])
    inner_tl = P(TL[0], IL[1])
    s.b.append('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s" fill-opacity="0.35" stroke="none"/>'
               % (TL[0], TL[1], TR[0], TR[1], TR[0], IL[1], TL[0], IL[1], COL_ASK))
    s.b.append('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s" fill-opacity="0.35" stroke="none"/>'
               % (IBR[0], IL[1], TR[0], IL[1], TR[0], BR[1], IBR[0], BR[1], COL_MARK))
    s.seg_label(TL, TR, u"35cm", 22, -1)
    s.seg_label(TL, BL, u"35cm", 34, -1)
    s.text((mid(P(TL[0], TL[1]), P(TR[0], IL[1]))[0], IL[1] + 12), u"1cm", COL_ASK, 12)
    s.seg_label(P(IBR[0], IL[1]), P(TR[0], IL[1]), u"34cm", 16, -1)
    must(u"8(1) 面積図の差", S * S - (S - 1) * (S - 1), 1 * S + (S - 1) * 1, 0.01)
    must(u"8(1) 答え", 1 * S + (S - 1) * 1, 69, 0.01)
    return s.out()


def fig_8_2():
    u"""45×46-44×47 を 面積図で。差の帯：1×46-44×1=2"""
    U = 4.0
    W, H = 46.0, 45.0
    TL = P(0, 0); TR = P(W, 0); BR = P(W, H); BL = P(0, H)
    innerTL = P(0, 1); innerBR = P(W - 1, H - 1)
    pts_px = [P(p[0] * U, p[1] * U) for p in (TL, TR, BR, BL, innerTL, innerBR)]
    TL, TR, BR, BL, innerTL, innerBR = shift(pts_px, 46, 40)
    s = Svg(280, 250)
    s.poly([TL, TR, BR, BL])
    s.b.append('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s" fill-opacity="0.35" stroke="none"/>'
               % (TL[0], TL[1], TR[0], TR[1], TR[0], innerTL[1], TL[0], innerTL[1], COL_ASK))
    s.b.append('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s" fill-opacity="0.35" stroke="none"/>'
               % (innerBR[0], innerTL[1], TR[0], innerTL[1], TR[0], BR[1], innerBR[0], BR[1], COL_MARK))
    s.seg_label(TL, TR, u"46cm", 22, -1)
    s.seg_label(TL, BL, u"45cm", 34, -1)
    must(u"8(2) 45×46", 45 * 46, 2070, 0.01)
    must(u"8(2) 44×47", 44 * 47, 2068, 0.01)
    must(u"8(2) 差(帯の技)= 1×46-44×1", 1 * 46 - 44 * 1, 45 * 46 - 44 * 47, 0.01)
    must(u"8(2) 答え", 45 * 46 - 44 * 47, 2, 0.01)
    return s.out()


# ============================================================
#  大問データ（設問・答え・解説）
#    ★答えは 解答ページ p51 の一覧と、こちらで解き直した結果の 両方が一致したものだけ
# ============================================================
SRC = u"小3最レ【刷新版】No.16 大問%d（実物・9月2回目の範囲）"


def build():
    d1 = {
        "id": "hd3s_n16_1", "hg": "HG-1449", "src": SRC % 1,
        "title": u"面積の4つの公式", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 1,
        "intro": u"1辺が1cmの正方形の面積（広さ）を **1cm²（平方センチメートル）** といいます。"
                 u"**正方形＝1辺×1辺／長方形＝たて×よこ／平行四辺形＝底辺×高さ／三角形＝底辺×高さ÷2**。"
                 u"この4つの公式が、この先ずっと使う 面積の土台です。",
        "steps": [
            {"question": u"正方形の面積を もとめなさい。（1辺13cm）", "answer": "169", "svg": fig_1_1(),
             "meaning": u"正方形の面積＝**1辺×1辺**。13×13＝**169(cm²)**。"},
            {"question": u"長方形の面積を もとめなさい。（たて14cm・よこ25cm）", "answer": "350", "svg": fig_1_2(),
             "meaning": u"長方形の面積＝**たて×よこ**。14×25＝**350(cm²)**。"},
            {"question": u"平行四辺形の面積を もとめなさい。（底辺11cm・高さ9cm）", "answer": "99", "svg": fig_1_3(),
             "meaning": u"平行四辺形の面積＝**底辺×高さ**。**高さは 底辺に垂直な線の長さ**で、"
                        u"ななめの辺の長さ(この問題では使わない数)とは ちがう。11×9＝**99(cm²)**。"},
            {"question": u"三角形の面積を もとめなさい。（底辺12cm・高さ9cm）", "answer": "54", "svg": fig_1_4(),
             "meaning": u"三角形の面積＝**底辺×高さ÷2**。12×9÷2＝**54(cm²)**。"
                        u"三角形は 同じ底辺・高さの平行四辺形の **半分**だからです。"},
        ],
    }
    d2 = {
        "id": "hd3s_n16_2", "hg": "HG-1450", "src": SRC % 2,
        "title": u"分ける／全体からひく", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 2,
        "intro": u"公式にそのまま当てはまらない形は、**①いくつかの四角形・三角形に分ける ②大きい形から"
                 u"はみ出た分をひく**、のどちらかで求めます。**同じ答えが 2通りの解き方で出せる**ことも"
                 u"確かめてみましょう。",
        "steps": [
            {"question": u"下の図形の面積を もとめなさい。", "answer": "76", "svg": fig_2_1(),
             "meaning": u"①**分ける**：左下の6×10の長方形と、右上の4×4の正方形に分けると、"
                        u"6×10＋4×4＝60＋16＝**76(cm²)**。"
                        u"②**全体からひく**：まわり全体を10×10の正方形と見て、欠けている4×6の長方形をひくと、"
                        u"10×10−4×6＝100−24＝**76(cm²)**。どちらも同じ答えになります。"},
            {"question": u"下の図形（凧のような四角形）の面積を もとめなさい。", "answer": "125", "svg": fig_2_2(),
             "meaning": u"①左の頂点と 右の頂点を結ぶ対角線を引いて、**2つの三角形に分けます**。"
                        u"②下の三角形：底辺15cm・高さ8cm → 15×8÷2＝**60(cm²)**。"
                        u"③上の三角形：直角のところの2辺が10cmと13cmなので、この2辺を底辺・高さとみて "
                        u"10×13÷2＝**65(cm²)**。④60＋65＝**125(cm²)**。"},
            {"question": u"8cm×12cmの長方形の中の三角形（斜線部分）の面積を もとめなさい。", "answer": "42",
             "svg": fig_2_3(),
             "meaning": u"三角形は 長方形の1つの角（頂点）と、右辺の2cmの点、下辺の6cmの点を結んだ形です。"
                        u"**長方形全体から、まわりの3つの直角三角形をひきます**。"
                        u"①左下の三角形：6×8÷2＝24 ②右下の三角形：6×6÷2＝18 ③右上の三角形：12×2÷2＝12。"
                        u"8×12−(24＋18＋12)＝96−54＝**42(cm²)**。"},
        ],
    }
    d3 = {
        "id": "hd3s_n16_3", "hg": "HG-1451", "src": SRC % 3,
        "title": u"対角線のわざ／風車がた", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 3,
        "intro": u"四角形の中に、**対角線がたて・よこにまっすぐ通る四角形**（ひし形やタコ形）ができているとき、"
                 u"**面積＝たての対角線×よこの対角線÷2** で求められます。"
                 u"長方形をまるごと使うより ずっと速く出せる、この回いちばんの発見です。",
        "steps": [
            {"question": u"下の図の 斜線部分の面積を もとめなさい。（10cm×11cmの長方形）", "answer": "55",
             "svg": fig_3_1(),
             "meaning": u"中の四角形の対角線は、長方形の**たて（10cm）とよこ（11cm）そのもの**になっています。"
                        u"対角線が垂直に交わる四角形の面積＝**対角線×対角線÷2**。"
                        u"10×11÷2＝**55(cm²)**。"
                        u"（これは「長方形の各辺の中点を結んだ四角形は、もとの長方形の半分」という性質と同じです）"},
            {"question": u"下の図の 斜線部分の面積を もとめなさい。（14cm×16cmの長方形）", "answer": "112",
             "svg": fig_3_2(),
             "meaning": u"左右の頂点は どちらも「7cm」の位置（たて14cmのちょうど半分）にあるので、"
                        u"よこの対角線は 長方形のよこ（16cm）そのもの。たての対角線も 長方形のたて（14cm）そのもの。"
                        u"14×16÷2＝**112(cm²)**。"},
            {"question": u"下の図の 斜線部分の面積を もとめなさい。（10cm×10cmの正方形。右の頂点は右上角から2cm、"
                         u"下の頂点は左下角から3cm）", "answer": "53", "svg": fig_3_3(),
             "meaning": u"この四角形は、対角線が辺と平行ではないので、①②のわざが そのままは使えません。"
                        u"正方形の4すみに 直角三角形が4つできると考え、**同じ印のついた三角形どうしが"
                        u"等積変形で 同じ面積になる**ことを使うと、"
                        u"「四角形の面積×2＋2×3＝10×10」という式が立ちます。"
                        u"四角形の面積＝(100−6)÷2＝**47**。求める面積は、47に 小さい三角形の分6を たして "
                        u"47＋6＝**53(cm²)**。"},
        ],
    }
    d4 = {
        "id": "hd3s_n16_4", "hg": "HG-1452", "src": SRC % 4,
        "title": u"2まいの紙を重ねる", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 2,
        "intro": u"[図1]のア（よこ15cm）とイ（よこ10cm）は **面積が同じ長方形**です。この2まいを、"
                 u"上と左をそろえて重ねたのが [図2]。**「面積が同じ→重なった部分も同じ→重ならない部分も同じ」**"
                 u"という考え方を使います。",
        "steps": [
            {"question": u"[図2]で、アの紙のうちイの紙と重なっていない部分の面積を もとめなさい。",
             "answer": "60", "svg": fig_4_2(),
             "meaning": u"イの紙の 下がわ6cm分は、アの紙とは重なっていません。この部分は "
                        u"**よこ10cm×たて6cm＝60(cm²)**。"
                        u"アとイは面積が同じで、重なっている部分の面積も同じなので、**重なっていない部分の面積も"
                        u"同じ（60cm²）** になります。"},
            {"question": u"アの紙の たての長さを もとめなさい。", "answer": "12", "svg": fig_4_2(),
             "meaning": u"アの紙のうち重なっていない部分（60cm²）は、**よこ5cm(15−10)×アのたて**の長方形です。"
                        u"60÷5＝**12(cm)**。"},
            {"question": u"イの紙の たての長さを もとめなさい。", "answer": "18", "svg": fig_4_2(),
             "meaning": u"イはアより、下に6cmぶん 長く伸びています。アのたてが12cmなので、"
                        u"イのたて＝12＋6＝**18(cm)**。"
                        u"（たしかめ：ア＝15×12＝180cm²、イ＝10×18＝180cm²で、面積が同じになっています）"},
        ],
    }
    return [d1, d2, d3, d4]


def build_rest():
    d5 = {
        "id": "hd3s_n16_5", "hg": "HG-1453", "src": SRC % 5,
        "title": u"面積が256cm²の紙をおる", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 3,
        "intro": u"面積が256cm²の長方形の紙を、図のように おりました。"
                 u"**おる前とおった後で 形は変わらない（合同）**ことを使って、辺の長さを求めます。",
        "steps": [
            {"question": u"斜線部分の面積を もとめなさい。（たて8cm、点Bから15cmでC、そこからDまでは 長方形の"
                         u"よこいっぱい）", "answer": "68", "svg": fig_5(),
             "meaning": u"①長方形の たては8cmなので、よこは 256÷8＝**32(cm)**。"
                        u"②CD＝32−15＝**17(cm)**。"
                        u"③三角形ABCは、AB＝8cm・BC＝15cmの直角三角形なので、AC＝**17cm**"
                        u"（8と15と17は、直角三角形の3辺の 有名な組み合わせです）。"
                        u"④おる前とおった後は 同じ形（合同）なので、"
                        u"斜線部分の面積は、**底辺17cm（CD）・高さ8cm（たて）の三角形**と同じ面積になり、"
                        u"17×8÷2＝**68(cm²)**。"},
        ],
    }
    d6 = {
        "id": "hd3s_n16_6", "hg": "HG-1454", "src": SRC % 6,
        "title": u"つけたし（等積変形）", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 3,
        "intro": u"面積が「等しい」「差が知りたい」ときは、**小さな部分（◎）を つけたして、"
                 u"公式で計算できる大きな三角形どうしに そろえる**と、うまく求められることがあります。",
        "steps": [
            {"question": u"斜線部分のアとイの面積が等しいとき、AFの長さは 何cmですか。"
                         u"（長方形ACDE、AB＝2cm・BC＝3cm・ED＝5cm・CD＝7cm）",
             "answer": "4.2", "svg": fig_6_1(),
             "meaning": u"◎の部分（三角形ABEの一部にあたる共通部分）をつけたすと、"
                        u"アとイは それぞれ **三角形ACFと三角形BCD** になり、この2つの面積が等しくなります。"
                        u"三角形ACFの面積＝**AC×AF÷2**（AC＝AB＋BC＝5cm）、"
                        u"三角形BCDの面積＝**CD×BC÷2**＝7×3÷2。"
                        u"5×AF÷2＝7×3÷2 より、AF＝21÷5＝**4.2(cm)**。"},
            {"question": u"斜線部分のウとエの面積の差は 何cm²ですか。"
                         u"（左辺8cm・右辺5cm・下辺は7cmと3cmに分かれている）",
             "answer": "12", "svg": fig_6_2(),
             "meaning": u"◎の部分（2つの三角形が重なっている真ん中）をつけたすと、"
                        u"ウは 底辺10cm・高さ8cmの三角形、エは 底辺7cm・高さ8cmの三角形に そろいます。"
                        u"つけたした分は 両方に同じだけ足しているので、**引き算すれば消えて**、"
                        u"もとのウとエの差と同じになります。"
                        u"8×10÷2−8×7÷2＝40−28＝**12(cm²)**。"},
        ],
    }
    d7 = {
        "id": "hd3s_n16_7", "hg": "HG-1455", "src": SRC % 7,
        "title": u"正六角形の面積を分数で分ける", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 2,
        "intro": u"面積が36cm²の正六角形を、いくつかの部分に分けます。**正六角形は、真ん中の点から見ると"
                 u"合同な三角形6つ分**。この「6つ分」を もとに、斜線部分が全体の何分のいくつかを考えます。",
        "steps": [
            {"question": u"斜線部分の面積を もとめなさい。（となりあう3つの頂点を結ぶ三角形）",
             "answer": "6", "svg": fig_7_1(),
             "meaning": u"この三角形は、正六角形を 真ん中から6つに分けた**二等辺三角形の1つ分**と "
                        u"同じ面積になります。正六角形の**1/6**。"
                        u"36×1/6＝**6(cm²)**。"},
            {"question": u"斜線部分の面積を もとめなさい。（1つの頂点から、2つとなりの頂点までの三角形）",
             "answer": "12", "svg": fig_7_2(),
             "meaning": u"この三角形は、六角形をちょうど半分に分ける対角線を使うと、"
                        u"全体の**1/2から、(1)の1/6をひいた1/3**にあたることが分かります。"
                        u"1/2−1/6＝2/6＝**1/3**。36×1/3＝**12(cm²)**。"},
            {"question": u"斜線部分の面積を もとめなさい。（上の2辺をそれぞれ3等分してできる、"
                         u"上頂点よりの小さな三角形）", "answer": "2", "svg": fig_7_3(),
             "meaning": u"この小さな三角形は、(1)で使った**1/6の三角形を、さらに3等分した1つ分**にあたります。"
                        u"1/6×1/3＝**1/18**。36×1/18＝**2(cm²)**。"},
            {"question": u"斜線部分の面積を もとめなさい。（各頂点から2つとなりの頂点まで対角線を6本引いてできる、"
                         u"真ん中の正六角形）", "answer": "12", "svg": fig_7_4(),
             "meaning": u"6本の対角線で、外の六角形の外がわに(2)と同じ形の三角形が6つでき、"
                        u"のこりの真ん中の正六角形が斜線部分です。"
                        u"外の六角形は 18個の等しい三角形に分けられ、真ん中の斜線部分は そのうち**6個分＝1/3**。"
                        u"36×1/3＝**12(cm²)**。"},
        ],
    }
    d8 = {
        "id": "hd3s_n16_8", "hg": "HG-1456", "src": SRC % 8,
        "title": u"面積図で計算のくふう", "category": "zu", "unit": u"平面図形",
        "grade": 3, "star": 2,
        "intro": u"かけ算の答えを、面積図（正方形・長方形の面積）に置きかえると、"
                 u"大きな数のかけ算・ひき算が、**細長い帯の面積だけ**を考えればすむようになります。",
        "steps": [
            {"question": u"次の計算をしなさい。 35×35−34×34", "answer": "69", "svg": fig_8_1(),
             "meaning": u"1辺35cmの正方形から、1辺34cmの正方形をひいた形を考えます。"
                        u"のこるのは、**幅1cmのL字の帯**（上の辺と、右の辺ぞい）。"
                        u"上の帯：1×35＝35。右の帯：34×1＝34（上の帯と重ならない分だけ）。"
                        u"35＋34＝**69**。"},
            {"question": u"次の計算をしなさい。 45×46−44×47", "answer": "2", "svg": fig_8_2(),
             "meaning": u"45×46の長方形と、44×47の長方形を 左上角をそろえて重ねると、"
                        u"はみ出す部分（上の帯：1×46）と、たりない部分（右の帯：44×1）ができます。"
                        u"はみ出す分から たりない分をひくと、45×46−44×47＝1×46−44×1＝46−44＝**2**。"},
        ],
    }
    return [d5, d6, d7, d8]


# ============================================================
def main():
    recs = build() + build_rest()
    for r in recs:
        for st in r["steps"]:
            a = st["answer"]
            assert a.replace(".", "", 1).lstrip("-").isdigit(), u"テンキーで打てない答え: %s (%s)" % (a, r["id"])
            assert st.get("meaning"), u"解説がない: %s" % r["id"]
            assert st.get("svg"), u"図がない: %s" % r["id"]
    n_steps = sum(len(r["steps"]) for r in recs)
    print(u"大問 %d 本 / 設問 %d 問 / 図 %d 枚" %
          (len(recs), n_steps, sum(1 for r in recs for s in r["steps"] if s.get("svg"))))
    print(check_report())

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    g3 = d["grades"]["3"]
    g3.setdefault(COURSE, {}).setdefault("fukushu", {})[NO] = recs
    io.open(DAIMON, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=1) + chr(10))
    print(u"書きこみ: %s ← 小3最レ（刷新版）の宿題 No.%s" % (DAIMON, NO))


if __name__ == "__main__":
    main()
