# -*- coding: utf-8 -*-
"""HG-2411 / HG-2213 / HG-2275 の答えを、それぞれ2通りの別々のやり方で検算する。
   （数値が合っただけで終わらせない＝[[feedback_verify_mechanism_not_just_answer]]）"""
from fractions import Fraction
from itertools import permutations, product

print("══ HG-2411 一番上の段から5個とりはずした立体の表面積 ══")
HAT = [(2, 0), (2, 1), (1, 2), (3, 2), (0, 3)]      # (左から0起点, 手前から0起点)
# ① 単位立方体の露出面を1枚ずつ数える（全探索）
solid = {(i, j, k): True for i in range(4) for j in range(4) for k in range(4)}
for (i, j) in HAT:
    solid[(i, j, 3)] = False
n1 = 0
for (i, j, k), alive in solid.items():
    if not alive:
        continue
    for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
        q = (i + d[0], j + d[1], k + d[2])
        if q not in solid or not solid[q]:
            n1 += 1
# ② もとの96cm²からの増減で数える（人間の解き方）
n2 = 96
for (i, j) in HAT:
    outer = (i == 0) + (i == 3) + (j == 0) + (j == 3)       # 外を向いていた横の面
    nb = 0
    for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        q = (i + d[0], j + d[1])
        if 0 <= q[0] < 4 and 0 <= q[1] < 4 and q not in HAT:
            nb += 1                                        # 隣に立方体が残っている横の面
    n2 += nb - outer
print("  ①全探索 =", n1, "cm² /  ②増減 =", n2, "cm²  ->", "一致" if n1 == n2 else "★不一致")
print("  体積 =", sum(1 for v in solid.values() if v), "cm³")

print("\n══ HG-2213 A(0,0,1) → B(3,1,0) の最短経路 ══")
# ① 経路を1本ずつ数え上げる（順列の全探索）
steps = ['x'] * 3 + ['y'] * 1 + ['z'] * 1
m1 = len(set(permutations(steps)))
# ② 格子上を動的計画法で数える
from functools import lru_cache
@lru_cache(None)
def f(x, y, z):
    if (x, y, z) == (3, 1, 0):
        return 1
    t = 0
    if x < 3: t += f(x + 1, y, z)
    if y < 1: t += f(x, y + 1, z)
    if z > 0: t += f(x, y, z - 1)
    return t
m2 = f(0, 0, 1)
print("  ①並べかえ =", m1, "通り /  ②経路のDP =", m2, "通り  ->",
      "一致" if m1 == m2 else "★不一致")

print("\n══ HG-2275 立方体(1辺2cm)の交互4頂点を辺の中点まで切った立体の体積 ══")
# ① 立方体から三角すい4つを引く
v1 = Fraction(8) - 4 * Fraction(1, 6)
# ② 面から体積を出す（発散定理）＝ひき算とは独立なやり方
#    V = (1/3)Σ(面の重心・外向き法線)×面積。六角形6面と正三角形4面に分けて出す
CUT = [(0, 0, 0), (2, 2, 0), (2, 0, 2), (0, 2, 2)]     # 切り落とす4頂点（1つおき）
hexv = Fraction(0)
for axis in range(3):
    for val in (0, 2):
        others = [i for i in range(3) if i != axis]
        sq = []
        for a, b in ((0, 0), (2, 0), (2, 2), (0, 2)):
            p = [0, 0, 0]; p[axis] = val; p[others[0]] = a; p[others[1]] = b
            sq.append(tuple(p))
        cut_here = [q for q in sq if q in CUT]
        assert len(cut_here) == 2, "この面で切れる隅が2つでない"
        assert sum(1 for i in range(3) if cut_here[0][i] != cut_here[1][i]) == 2, "対角でない"
        area = Fraction(3)                               # 4 - (1*1/2)*2
        # 面が axis 方向を向いているので、重心のうち効くのは axis 成分（＝val）だけ
        if val == 2:
            hexv += Fraction(1, 3) * 2 * area
triv = Fraction(0)
for c in CUT:
    verts = []
    for i in range(3):
        p = list(c); p[i] += 1 if p[i] == 0 else -1; verts.append(tuple(p))
    for a, b in ((0, 1), (0, 2), (1, 2)):
        assert sum((verts[a][k] - verts[b][k]) ** 2 for k in range(3)) == 2, "切り口の1辺が√2でない"
    n = [(1 if c[i] == 2 else -1) for i in range(3)]     # 外向き（切り落とした頂点の向き）
    g = [Fraction(sum(v[i] for v in verts), 3) for i in range(3)]
    # 寄与 = (1/3)*(g・n̂)*area = (1/3)*(g・n/√3)*(√3/2) = (g・n)/6
    triv += sum(g[i] * n[i] for i in range(3)) / 6
v2 = hexv + triv
print("  ①ひき算 =", v1, "=", float(v1), "cm³")
print("  ②発散定理 =", v2, "= 六角形6面ぶん", hexv, "+ 正三角形4面ぶん", triv,
      " ->", "一致" if v2 == v1 else "★不一致")
# ③ 面の形と個数のチェック（六角形6・正三角形4／六角形の面積3cm²）
print("  六角形1面の面積 = 4 - 2*(1*1/2) =", 4 - 2 * 0.5, "cm²  正三角形の1辺 = √2 cm")
