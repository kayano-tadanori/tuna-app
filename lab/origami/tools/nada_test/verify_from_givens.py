# -*- coding: utf-8 -*-
"""折ON 新規7問の座標を「与件だけ」から組み立て、原本の印刷解答と一致するか検算する。
   答えの数値は最後の突き合わせにしか使わない（[[feedback_verify_mechanism_not_just_answer]]）。"""
from fractions import Fraction as F
import math

ok = True
def chk(name, got, want, eps=1e-9):
    global ok
    good = abs(float(got) - float(want)) < eps
    ok &= good
    print(f"{'OK ' if good else 'NG '} {name}: {got} (期待 {want})")

def seg_inter(p, q, r, s):
    """線分pq と rs の交点（直線として）"""
    (x1,y1),(x2,y2),(x3,y3),(x4,y4) = p,q,r,s
    d = (x2-x1)*(y4-y3) - (y2-y1)*(x4-x3)
    t = ((x3-x1)*(y4-y3) - (y3-y1)*(x4-x3)) / d
    return (x1 + t*(x2-x1), y1 + t*(y2-y1))

def polyarea(pts):
    s = 0
    for i in range(len(pts)):
        x1,y1 = pts[i]; x2,y2 = pts[(i+1) % len(pts)]
        s += x1*y2 - x2*y1
    return abs(s)/2

print("=== No.4 ===  与件：AB=3, BC=12, 斜線(台形APP'B)=67.5、②は①を平行移動し P' が斜辺PC上")
# 未知数 h=AP と d=BD。 条件1: 移動ベクトル(3,-d)が斜辺方向(AC,-AP)=(15,-h)と平行 → 3h = 15d
# 条件2: 台形 = (h + (h-d))*3/2 = 67.5
# → h = 5d, (2*5d - d)*3/2 = 67.5 → 9d*3/2=67.5 → d=5, h=25
d = F(675,10)*2/3  # (2h-d)*3/2=67.5 → 2h-d=45
# 解く：h=5d, 10d-d=45
d = F(45,9); h = 5*d
chk("BD", d, 5); chk("AP", h, 25)
A=(F(0),F(0)); P=(F(0),h); C=(F(15),F(0)); B=(F(3),F(0)); D=(F(3),-d)
Pp=(B[0], h-d); Cp=(C[0]+3, -d)
chk("斜線(台形APP'B)", polyarea([A,P,Pp,B]), F(675,10))
chk("P'が斜辺PC上", (Pp[1]-P[1])*(C[0]-P[0]) - (C[1]-P[1])*(Pp[0]-P[0]), 0)
chk("い(台形BCC'D)", polyarea([B,C,Cp,D]), F(675,10))  # あ=い の検算
chk("移動距離", math.hypot(3,float(d)), math.sqrt(9+25), 1e-12)

print("\n=== No.5 ===  与件：BD=3, DB'=4, 台形ABDA'=42、A'は斜辺AC上（②は①を平行移動）")
# 未知 AB=a, BC=b。 A'=A+(3,-4) → A'D = a-4。台形=(a + a-4)*3/2 = 42 → a=16
a = (F(42)*2/3 + 4)/2
chk("AB", a, 16)
# A' が AC 上： A(0,a) A'(3,a-4) → 傾き -4/3 → b = a*3/4
b = a*F(3,4)
chk("BC=B'C'", b, 12)
Bv=(F(0),F(0)); Cv=(b,F(0)); Av=(F(0),a); Ap=(F(3),a-4); Dv=(F(3),F(0)); Bp=(F(3),F(-4)); Cp=(b+3,F(-4))
chk("台形ABDA'", polyarea([Av,Bv,Dv,Ap]), 42)
chk("等積：台形DB'C'C", polyarea([Dv,Bp,Cp,Cv]), 42)
chk("移動距離AA'", math.hypot(3,4), 5, 1e-12)

print("\n=== No.9 ===  与件：長方形、折り目の両端で60°、折ると角が3つとも60°")
# 60°の折れ線が3本つながって右上の角に届く条件 → 横 = 3*(縦/tan60) = √3*縦
hh = 10.0; w = math.sqrt(3)*hh
Bp2=(0.0,0.0); Cp2=(w,0.0); Dp2=(w,hh); Ap2=(0.0,hh)
T1=(w/3, hh); T2=(2*w/3, 0.0)
ang = lambda p,q: math.degrees(math.atan2(q[1]-p[1], q[0]-p[0]))
chk("角B(BT1と底辺)", ang(Bp2,T1), 60, 1e-9)
chk("角T1(T1T2)", -ang(T1,T2), 60, 1e-9)
chk("角T2(T2D)", ang(T2,Dp2), 60, 1e-9)
# 折り：左側四角形 A,T1,T2,B を直線T1T2で鏡映
def reflect(p, a, b):
    ux, uy = b[0]-a[0], b[1]-a[1]
    L = math.hypot(ux,uy); ux, uy = ux/L, uy/L
    vx, vy = p[0]-a[0], p[1]-a[1]
    dot = vx*ux + vy*uy
    return (a[0] + 2*dot*ux - vx, a[1] + 2*dot*uy - vy)
Bref = reflect(Bp2, T1, T2); Aref = reflect(Ap2, T1, T2)
chk("B の折り返し先＝D", math.dist(Bref, Dp2), 0, 1e-9)
print(f"    A の折り返し先 = ({Aref[0]:.4f}, {Aref[1]:.4f})  ※紙の上へはみ出す羽")
# 重なり＝三角形T1,D,T2 / 全体＝長方形
chk("重なり ÷ 長方形", polyarea([T1,Dp2,T2])/polyarea([Ap2,Dp2,Cp2,Bp2]), 1/3, 1e-12)

print("\n=== No.13(1) === 与件：5,5,6の合同な二等辺三角形。②は①を90°回して、底辺(6)を縦に、上端は①の頂点の2cm上")
hgt = math.sqrt(5**2-3**2)
chk("二等辺三角形の高さ", hgt, 4, 1e-12)
Pv=(0.0,4.0); B1=(-3.0,0.0); C1=(3.0,0.0)          # ①（底辺6が水平・頂点P）
T2a=(0.0,0.0); T2b=(0.0,6.0); T2c=(4.0,3.0)        # ②（底辺6が垂直・頂点は右）
chk("②の等辺1", math.dist(T2a,T2c), 5, 1e-12)
chk("②の等辺2", math.dist(T2b,T2c), 5, 1e-12)
chk("②の底辺が①の頂点Pの2cm上まで届く", T2b[1]-Pv[1], 2, 1e-12)
X = seg_inter(Pv, C1, T2a, T2c)
chk("x=P〜交点", math.dist(Pv,X), 3.2, 1e-12)
# ②は①の回転で作れるか（合同＝裏返さずに置ける）を確認
def rot(p, c, th):
    s,co = math.sin(th), math.cos(th)
    dx,dy = p[0]-c[0], p[1]-c[1]
    return (c[0]+co*dx - s*dy, c[1]+s*dx + co*dy)
cen=(1.5,1.5); th=-math.pi/2
chk("回転で②に一致(B1→)", math.dist(rot(B1,cen,th), T2b), 0, 1e-9)
chk("回転で②に一致(C1→)", math.dist(rot(C1,cen,th), T2a), 0, 1e-9)
chk("回転で②に一致(P→)",  math.dist(rot(Pv,cen,th), T2c), 0, 1e-9)

print("\n=== No.13(2) === 与件：合同な5,5,6を、②の頂点Pを①の底辺上に、②の等辺PRを底辺に重ね、①の頂点A1が②の辺PA2上にくるように置く")
L=(0.0,0.0); Q=(6.0,0.0); A1=(3.0,4.0)
# ②：頂点P(p,0)、R=P+(5,0)、A2 は |PA2|=5, |A2R|=6
aa = (25-36+25)/10.0   # = 1.4
bb = math.sqrt(25-aa*aa)
chk("A2 の相対位置", (aa,bb), (1.4,4.8), 1e-12) if False else print(f"    A2 = P + ({aa}, {bb:.4f})")
# 条件：A1 が P→A2 上 →  (3-p)/aa = 4/bb
p = 3 - aa*4/bb
chk("x=LP", p, 11/6, 1e-12)
P2=(p,0.0); R2=(p+5,0.0); A2=(p+aa,bb)
chk("②の底辺A2R", math.dist(A2,R2), 6, 1e-12)
chk("②の等辺PA2", math.dist(P2,A2), 5, 1e-12)
chk("A1がPA2上", (A1[1]-P2[1])*(A2[0]-P2[0]) - (A2[1]-P2[1])*(A1[0]-P2[0]), 0, 1e-9)
chk("PQ:PR = 5:6", math.dist(P2,Q)/math.dist(P2,R2), 5/6, 1e-12)
# ②は①の回転で置けるか
th2 = math.pi - math.acos(0.6)
cx = (0.0,0.0)
# 回転中心を解く： (I-R)c = L' - R*L  （L→R2 対応）
co,si = math.cos(th2), math.sin(th2)
import numpy as np
Mm = np.array([[1-co, si],[-si, 1-co]])
rhs = np.array([R2[0] - (co*L[0]-si*L[1]), R2[1] - (si*L[0]+co*L[1])])
c = np.linalg.solve(Mm, rhs)
print(f"    回転中心 = ({c[0]:.5f}, {c[1]:.5f})  角 = {math.degrees(th2):.4f}°")
chk("回転でL→R", math.dist(rot(L,tuple(c),th2), R2), 0, 1e-9)
chk("回転でQ→A2", math.dist(rot(Q,tuple(c),th2), A2), 0, 1e-9)
chk("回転でA1→P", math.dist(rot(A1,tuple(c),th2), P2), 0, 1e-9)

print("\n=== 関西創価中 === 与件：30-60-90 と 45-45-90 の三角定規。交点の角143°。求める角ア")
# 45定規：直角を右下、脚は水平・垂直
V2=(14.706,-10.294); V1=(V2[0]-10, V2[1]); V3=(V2[0], V2[1]+10)
# 30定規：直角の頂点W2から、60°頂点へ向かう辺が水平と53°(=143-90)、30°頂点へは143°
hyp=14.0; Llong=hyp*math.sin(math.radians(60)); Lshort=hyp*math.sin(math.radians(30))
W2=(13.3,-8.2)
W1=(W2[0]+Llong*math.cos(math.radians(143)), W2[1]+Llong*math.sin(math.radians(143)))
W3=(W2[0]+Lshort*math.cos(math.radians(53)), W2[1]+Lshort*math.sin(math.radians(53)))
chk("30定規の直角", (W1[0]-W2[0])*(W3[0]-W2[0]) + (W1[1]-W2[1])*(W3[1]-W2[1]), 0, 1e-9)
X143 = seg_inter(W2,W3,V2,V3)
def angle_between(v, a, b):
    a1 = math.atan2(a[1]-v[1], a[0]-v[0]); a2 = math.atan2(b[1]-v[1], b[0]-v[0])
    dd = math.degrees(a1-a2) % 360
    return dd if dd<=180 else 360-dd
chk("143°(下向きの辺と60°頂点方向)", angle_between(X143, V2, W3), 143, 1e-6)
XA = seg_inter(W1,W2,V1,V3)
chk("ア", angle_between(XA, W1, V1), 82, 1e-6)
print(f"    交点は各辺の内部か: 143°点={X143}, ア点={XA}")

print("\n=== 05.pdf「5」 === 与件：帯を1回折る。折り返した辺ともとの下辺のなす角40°。求める角ア")
# 折り目は下辺の点Pから上辺の点Sへ。折り返しで下辺(0°)が140°方向へ移る → 折り目は70°
theta = (180-40)/2
chk("折り目の傾き", theta, 70, 1e-12)
hh2 = 6.0
Pp=(0.0,0.0)
Sx = hh2/math.tan(math.radians(theta))
S=(Sx, hh2)
# 上辺を右へ進む向きと折り目(S→P)のなす角＝ア
chk("ア", angle_between(S, Pp, (Sx+10, hh2)), 110, 1e-9)
# 帯の右端の下の角BRが上辺にちょうどのる長さ（原本の図の見た目に合わせる）
Lright = hh2/math.sin(math.radians(40))
BR=(Lright, 0.0)
BRref = reflect(BR, Pp, S)
chk("折り返した下の角が上辺にのる", BRref[1], hh2, 1e-9)
print(f"    P〜右端 = {Lright:.4f}cm, 折り返し先 = ({BRref[0]:.4f},{BRref[1]:.4f})")
TR=(Lright, hh2); TRref = reflect(TR, Pp, S)
print(f"    右上の角の折り返し先 = ({TRref[0]:.4f},{TRref[1]:.4f}) ※紙の上へはみ出す")

print("\n=== 総合 ===", "全部一致" if ok else "★不一致あり")
