# -*- coding: utf-8 -*-
"""ui_new7.py が実物のエンジンから取った「折り終わりの頂点座標」を使って、
   問題ごとの幾何がほんとうに成り立っているかを確かめる。
   （数値が合っただけで満足しない＝別の道すじで確かめる／[[feedback_verify_mechanism_not_just_answer]]）
   ⚠エンジンはzを反転して描くので、問題ファイルの座標とはzの符号が逆になる。"""
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('_out/shots', exist_ok=True)

import json, math

R = {r['id']: r for r in json.load(open('_out/report.json', encoding='utf-8'))}
ok = True


def chk(name, got, want, eps=1e-3):
    global ok
    good = abs(float(got) - float(want)) < eps
    ok &= good
    print("%s %-46s %.6f (期待 %.6f)" % ('OK ' if good else 'NG ', name, got, want))


def xz(p):
    """エンジンのワールド座標(x,y,z) → 問題ファイルの向き(x, z上向き)"""
    return (p[0], -p[2])


def area(pts):
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i+1) % len(pts)]
        s += x1*y2 - x2*y1
    return abs(s)/2


def inter(p, q, r, s):
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = p, q, r, s
    d = (x2-x1)*(y4-y3) - (y2-y1)*(x4-x3)
    t = ((x3-x1)*(y4-y3) - (y3-y1)*(x4-x3)) / d
    return (x1+t*(x2-x1), y1+t*(y2-y1))


def ang(v, a, b):
    a1 = math.atan2(a[1]-v[1], a[0]-v[0])
    a2 = math.atan2(b[1]-v[1], b[0]-v[0])
    d = math.degrees(a1-a2) % 360
    return d if d <= 180 else 360-d


def V(pid):
    return [xz(p) for p in R[pid]['verts']]

print('=== No.4（ずらして重ねる／斜線67.5・BD=5）===')
v = V('no4_slide_triangle')
A, C, P = v[0], v[1], v[2]
D, Cp, Pp = v[3], v[4], v[5]           # 動いた三角形
B = (-6, -10)
chk('②の直角の頂点D', math.dist(D, (-6, -15)), 0)
chk('②の上の頂点P\'', math.dist(Pp, (-6, 10)), 0)
chk('斜線(台形APP\'B)の面積', area([A, P, Pp, B]), 67.5)
chk('BD（答え）', math.dist(B, D), 5)
chk('い(台形BCC\'D)の面積', area([B, C, Cp, D]), 67.5)

print('=== No.5（台形42・B\'C\'=12）===')
v = V('no5_slide_triangle')
B, C, A = v[0], v[1], v[2]
Bp, Cp, Ap = v[3], v[4], v[5]
D = (-4.5, -6)
chk('台形ABDA\'の面積', area([A, B, D, Ap]), 42)
chk("B'C'（答え）", math.dist(Bp, Cp), 12)
chk('BD', math.dist(B, D), 3)
chk("DB'", math.dist(D, Bp), 4)

print('=== No.9（折ってB→D・重なり1/3）===')
v = V('no9_rect_60_fold')
T2, Cc, Dd, T1 = v[0], v[1], v[2], v[3]        # 固定パネル
Bf, T2b, T1b, Af = v[4], v[5], v[6], v[7]      # 動くパネル（折り終わり）
chk('頂点Bの折り返し先＝頂点D', math.dist(Bf, Dd), 0)
rect = area([(-8.66025, 5), (8.66025, 5), (8.66025, -5), (-8.66025, -5)])
chk('重なり(三角形T1・D・T2)÷長方形', area([T1, Dd, T2])/rect, 1/3.0)

print('=== No.13(1)（x=CG=3.2）===')
v = V('no13_1_isosceles_overlap')
A, B, C = v[0], v[1], v[2]
# 回した②の頂点は「①のA・B・Cが移った先」の順に入っている（A→上端E2, B→下端D2, C→右のF2）
E2, D2, F2 = v[3], v[4], v[5]
chk('②の底辺の下の端＝①の底辺の中点', math.dist(D2, (-0.5, -3)), 0)
chk('②の底辺の上の端（Cの2cm上）', math.dist(E2, (-0.5, 3)), 0)
G = inter(C, B, D2, F2)
chk('x=CG', math.dist(C, G), 3.2)
chk('①の辺CBと②の辺DFは直角', ang(G, C, D2), 90)

print('=== No.13(2)（x=AD=1と5/6）===')
v = V('no13_2_isosceles_overlap')
A, B, C = v[0], v[1], v[2]
# ②の頂点は「A→E、B→F、C→D」と移る（頂点Dが①の底辺の上に来る）
E2, F2, D2 = v[3], v[4], v[5]
chk('②の頂点Dが①の底辺上（zが等しい）', D2[1], A[1])
chk('x=AD', math.dist(A, D2), 11/6.0)
chk("②の底辺FE", math.dist(F2, E2), 6)
chk("②の等辺DE", math.dist(D2, E2), 5)
chk('①の頂点Cが②の辺DFの上',
    abs((C[1]-D2[1])*(F2[0]-D2[0]) - (F2[1]-D2[1])*(C[0]-D2[0])), 0, 1e-3)

print('=== 関西創価中（143°→ア=82°）===')
v = V('sokka_set_square')
V1, V2, V3 = v[0], v[1], v[2]
W1, W2, W3 = v[3], v[4], v[5]
X143 = inter(W2, W3, V2, V3)
XA = inter(W1, W2, V1, V3)
chk('たての辺と短い辺の交点の角', ang(X143, V2, W3), 143, 2e-3)
chk('ア（長い辺と45定規の斜辺）', ang(XA, W1, V1), 82, 2e-3)
chk('30°の頂点', ang(W1, W2, W3), 30, 2e-3)
chk('45°の頂点', ang(V1, V2, V3), 45, 2e-3)
chk('30定規の直角', ang(W2, W1, W3), 90, 2e-3)

print('=== 帯を1回折る（ア=110°）===')
v = V('strip_fold_110')
BL, P, Q, TL = v[0], v[1], v[2], v[3]
P2, BRf, TRf, Q2 = v[4], v[5], v[6], v[7]
chk('折り返した右下の角が上の辺にのる', BRf[1], TL[1])
chk('折り返した下の辺ともとの下の辺のなす角', ang(P, BL, BRf), 40)
chk('ア（折り目と上の辺）', ang(Q, P, (Q[0]+5, Q[1])), 110)
chk('折り目の傾き', math.degrees(math.atan2(Q[1]-P[1], Q[0]-P[0])), 70)


print('=== 塾技27(3) おうぎ形の折り返し（ア=30°／イ=18°）===')
for pid, who in [('juku27_3_sector_fold_a', 'ア'), ('juku27_3_sector_fold_i', 'イ')]:
    v = V(pid)
    Af, Of, Df = v[-3], v[-2], v[-1]       # 折り返す三角形A・O・D（最後に積んだ3点）
    Cexp = (-1.54508, 3.66025)             # Oの行き先（弧の上）
    Bpt = (6.54508, 4.51057)
    chk('%s: 中心Oの折り返し先＝C（弧の上）' % who, math.dist(Of, Cexp), 0, 2e-4)
    chk('%s: |AC|＝|AO|＝半径' % who, math.dist(Af, Of), 10, 2e-4)
    chk('%s: ア＝∠CAD' % who, ang(Af, Of, Df), 30, 2e-3)
    chk('%s: イ＝∠DCB' % who, ang(Of, Df, Bpt), 18, 2e-3)

print('=== 塾技29(2) 円を3回折る（ア=114°）===')
v = V('juku29_2_circle_fold')
Amoved = v[-31]                            # 折り返す弓形のまん中＝点A
chk('点Aの折り返し先＝中心O', math.hypot(*Amoved), 0, 2e-4)
Apos = (10.0, 0.0)
Cpos = (10 * math.cos(math.radians(246)), 10 * math.sin(math.radians(246)))
chk('ア＝∠AOC', ang((0.0, 0.0), Apos, Cpos), 114, 2e-3)

print('')
print('総合:', '全部一致' if ok else '★不一致あり')
