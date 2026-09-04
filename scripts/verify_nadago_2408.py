# -*- coding: utf-8 -*-
"""「ふたのない容器の展開図」（HG-2408＝小4灘合第11回大問1／HG-2269＝小5灘合第6回本体大問3）の検算。

   現物の展開図から5面を測り（scripts/measure_tenkaizu.py）、折りたたみを計算して閉じる形を出した。
   ・Eを底面に置き、頂点を Q1(0,20) Q2(20,20) Q3(20,0) Q4(15,0) とする
   ・壁A・C・Dは底面に垂直、**壁Bだけ内側へ約116.6°倒れる**（＝ななめに切られた面）
   ・立体の頂点は7つ。上面は T1(0,20,10) T2(15,20,10) T3(15,0,10)
   → **ふた＝3辺15・20・25の直角三角形＝150cm² ／ 容積＝2000cm³**
   🚨現物の図は「Bの幅」だけ不正確（見た目10cmだが、閉じるには√125＝11.18cmが要る）。
     ＝**図を測って解く問題ではなく、書いてある4つの数値（15・10・20・5）から解く問題**。
   使い方: python scripts/verify_nadago_2408.py
"""
import numpy as np
from fractions import Fraction as F
from itertools import combinations

# 折りたたんだ立体の頂点（cm）
Q1 = np.array([0.,20., 0.]); Q2 = np.array([20.,20., 0.])
Q3 = np.array([20., 0., 0.]); Q4 = np.array([15., 0., 0.])
T1 = np.array([0.,20.,10.]); T2 = np.array([15.,20.,10.]); T3 = np.array([15., 0.,10.])
V = {"Q1":Q1,"Q2":Q2,"Q3":Q3,"Q4":Q4,"T1":T1,"T2":T2,"T3":T3}
FACES = {
 "E（底）":      ["Q1","Q2","Q3","Q4"],
 "A（台形の壁）": ["Q1","Q2","T2","T1"],
 "B（傾いた壁）": ["Q2","Q3","T3","T2"],
 "D（三角の壁）": ["Q3","Q4","T3"],
 "C（長方形の壁）":["Q4","Q1","T1","T3"],
 "ふた":         ["T1","T2","T3"],
}
def area(pts):
    P=[V[p] for p in pts]; s=np.zeros(3)
    for i in range(1,len(P)-1): s = s + np.cross(P[i]-P[0], P[i+1]-P[0])
    return np.linalg.norm(s)/2, s/ (np.linalg.norm(s) or 1)
print("=== 面が展開図どおりか（辺の長さと面積）===")
for nm, ps in FACES.items():
    A,_ = area(ps)
    ls = [np.linalg.norm(V[ps[i]]-V[ps[(i+1)%len(ps)]]) for i in range(len(ps))]
    # 平面かどうか
    P=[V[p] for p in ps]
    flat = True
    if len(ps)==4:
        flat = abs(np.dot(np.cross(P[1]-P[0],P[2]-P[0]), P[3]-P[0])) < 1e-9
    print("  %-14s 辺 %s  面積 %7.2f cm²  %s"
          % (nm, " ".join("%6.3f"%x for x in ls), A, "平ら✓" if flat else "★ねじれている"))

print("\n=== 展開図の実測と突き合わせ ===")
want = {"E（底）":(20,20,5,25), "A（台形の壁）":(20,11.180,15,10),
        "C（長方形の壁）":(25,10,25,10), "D（三角の壁）":(5,10,11.180)}
for nm,w in want.items():
    ps=FACES[nm]; ls=[np.linalg.norm(V[ps[i]]-V[ps[(i+1)%len(ps)]]) for i in range(len(ps))]
    ok = all(abs(a-b)<0.01 for a,b in zip(ls,w))
    print("  %-14s 立体 %s ／ 展開図 %s  %s" % (nm, [round(x,2) for x in ls], list(w), "✓" if ok else "★"))
ps=FACES["B（傾いた壁）"]; ls=[np.linalg.norm(V[ps[i]]-V[ps[(i+1)%len(ps)]]) for i in range(len(ps))]
print("  B（傾いた壁）  立体 %s  ← 図の見た目は10cmだが、閉じるには √125＝%.3f が要る" % ([round(x,2) for x in ls], np.sqrt(125)))

print("\n=== ふたの面積 ===")
A,_ = area(FACES["ふた"])
l = [np.linalg.norm(V[a]-V[b]) for a,b in (("T1","T2"),("T2","T3"),("T3","T1"))]
print("  三角形の3辺 = %.2f, %.2f, %.2f  → 15-20-25 の直角三角形" % tuple(l))
print("  ①底辺×高さ÷2 = 15×20÷2 = %.1f cm²" % (15*20/2))
print("  ②外積で出した面積 = %.4f cm²" % A)

print("\n=== 容積（3通り）===")
# ① プリズマトイドの公式 V = h/6 (A1 + 4Am + A2)
Am_pts = [np.array([0.,20.,5.]), np.array([17.5,20.,5.]), np.array([17.5,0.,5.]), np.array([15.,0.,5.])]
s=np.zeros(3)
for i in range(1,3): s=s+np.cross(Am_pts[i]-Am_pts[0], Am_pts[i+1]-Am_pts[0])
Am=np.linalg.norm(s)/2
v1 = 10/6*(250 + 4*Am + 150)
print("  ①プリズマトイド: h/6(A1+4Am+A2) = 10/6(250 + 4×%.1f + 150) = %.2f cm³" % (Am, v1))
# ② 四面体に分けて足す（重心からの錐に分解）
c = sum(V.values())/len(V)
v2 = 0.0
for nm, ps in FACES.items():
    P=[V[p] for p in ps]
    for i in range(1,len(P)-1):
        v2 += abs(np.dot(np.cross(P[i]-P[0], P[i+1]-P[0]), c-P[0]))/6
print("  ②面を三角形に割って、重心との四面体を足す = %.2f cm³" % v2)
# ③ 積分（z ごとの断面積を細かく足す）
N=200000; rng=np.random.default_rng(0)
lo=np.array([0.,0.,0.]); hi=np.array([20.,20.,10.])
pts = rng.random((N,3))*(hi-lo)+lo
inside=np.ones(N,bool)
cen = sum(V.values())/7
for nm,ps in FACES.items():
    P=[V[p] for p in ps]
    n = np.cross(P[1]-P[0], P[2]-P[0]); n = n/np.linalg.norm(n)
    if np.dot(n, cen-P[0])>0: n=-n            # 外向きにそろえる
    inside &= ((pts-P[0])@n) <= 0
v3 = inside.mean()*np.prod(hi-lo)
print("  ③モンテカルロ20万点 = %.1f cm³" % v3)
print("\n  → ふたの面積 **150cm²** ／ 容積 **2000cm³**" if abs(v1-2000)<1 else "  ★2000にならない")
