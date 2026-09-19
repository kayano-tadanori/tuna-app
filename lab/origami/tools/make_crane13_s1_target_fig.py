# -*- coding: utf-8 -*-
"""つる⑬ S1：⑬の目標の上下と、既に通った交互の組の着き先の比較図（2026-09-17）

入力：crane13_s1_target.json（`PYTHONHASHSEED=0 python check_crane13_s1_target.py` の出力）
出力：figs/crane13_s1_target.png
"""
import json
import math
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MPoly, Rectangle

HERE = os.path.dirname(os.path.abspath(__file__))
plt.rcParams["font.family"] = ["BIZ UDPGothic", "MS Gothic", "sans-serif"]
C_TIP, C_BASE, C_OK, C_NG = "#e07b39", "#4a7fb5", "#d8efd8", "#f4b6b6"

J = json.load(open(os.path.join(HERE, "crane13_s1_target.json"), encoding="utf-8"))
name = J["names"]
ids = sorted(name, key=lambda p: (not p.endswith("#base"), -J["faces"][p]["poly"][0][0]))
tips = set(J["tipset"])
tgt = {tuple(k.split("|")): v for k, v in J["target"].items()}


def rel(a, b):
    if (a, b) in tgt:
        return tgt[(a, b)][0]
    return -tgt[(b, a)][0]


# 目標の並び（下→上）：自分より下にある面の数で並べる
order = sorted(name, key=lambda p: sum(1 for q in name if q != p and rel(q, p) > 0))
fig = plt.figure(figsize=(17, 9.5))
fig.suptitle("つる⑬ S1（層-18・-19・-2 の6面）：⑬の目標の上下 と 既に通った交互の組の着き先\n"
             "目標＝脚1の16枚の柱の「先が元の層のあいだに入る」並べ方（運動を使わずに数え上げ）を S1 に制限", fontsize=13)

# (1) 目標の置かれ方
ax = fig.add_axes([0.02, 0.36, 0.30, 0.50])
for p in name:
    poly = J["faces"][p]["poly"]
    ax.add_patch(MPoly(poly, closed=True, fc=C_TIP if p in tips else C_BASE, alpha=0.12, ec=C_TIP if p in tips else C_BASE, lw=1.2))
    cx = sum(q[0] for q in poly) / len(poly)
    cy = sum(q[1] for q in poly) / len(poly)
tx = "\n".join(f"{name[p]}：{J['faces'][p]['move']}・表裏 {'表' if J['faces'][p]['side0'] > 0 else '裏'}上→{'表' if J['faces'][p]['side1'] > 0 else '裏'}上"
               for p in sorted(name, key=lambda p: (p in tips, J['faces'][p]['name'])))
ax.text(1.02, 0.55, tx, transform=ax.transAxes, fontsize=9, va="top", ha="right")
(A, B) = J["cutseg"]
ax.plot([A[0], B[0]], [A[1], B[1]], color="#c0392b", lw=2.5, label="⑬の線")
ax.autoscale_view()
ax.set_aspect("equal")
ax.axis("off")
ax.legend(loc="lower left", fontsize=9)
ax.set_title("① 目標終端の置かれ方（上から見た図）\n元＝動かない／先＝⑬の線で鏡（表裏が入れかわる）", fontsize=11)

# (2) 目標の並び
ax = fig.add_axes([0.33, 0.36, 0.14, 0.50])
for k, p in enumerate(order):
    ax.add_patch(Rectangle((0, k), 1, 0.8, fc=C_TIP if p in tips else C_BASE, alpha=0.35))
    ax.text(0.5, k + 0.4, name[p], ha="center", va="center", fontsize=11)
ax.text(0.5, -0.5, "下", ha="center")
ax.text(0.5, len(order) + 0.1, "上", ha="center")
ax.set_xlim(-0.1, 1.1)
ax.set_ylim(-0.8, len(order) + 0.5)
ax.axis("off")
ax.set_title("② 目標の上下\n（6面が重なる所・15組とも1つに決まる）", fontsize=11)

# (3)(4) 交互の組：面の組ごとの一致／反する
labels = {"[1, -1]": "組 (1,−1)：中心線の角で元が戻る／外形の側の角で先が戻る",
          "[-1, 1]": "組 (−1,1)：中心線の角で先が戻る／外形の側の角で元が戻る"}
for j, (key, run) in enumerate(J["runs"].items()):
    ax = fig.add_axes([0.49 + j * 0.255, 0.36, 0.24, 0.50])
    idx = {p: k for k, p in enumerate(order)}
    n = len(order)
    for r in run["rows"]:
        a, b = r["a"], r["b"]
        for (x, y) in ((idx[a], idx[b]), (idx[b], idx[a])):
            ax.add_patch(Rectangle((x, n - 1 - y), 1, 1, fc=C_OK if r["ok"] else C_NG, ec="white"))
        g = r["got"] if idx[b] > idx[a] else -r["got"]
        hi, lo = (b, a) if r["got"] > 0 else (a, b)
        txt = f"{name[hi]}\nが上"
        x, y = max(idx[a], idx[b]), min(idx[a], idx[b])
        ax.text(x + 0.5, n - 1 - y + 0.5, ("✕\n" if not r["ok"] else "") + txt, ha="center", va="center", fontsize=7)
    for k, p in enumerate(order):
        ax.add_patch(Rectangle((k, n - 1 - k), 1, 1, fc="#eeeeee", ec="white"))
        ax.text(k + 0.5, n - 1 - k + 0.5, name[p], ha="center", va="center", fontsize=8, weight="bold",
                color=C_TIP if p in tips else C_BASE)
    ax.set_xlim(0, n)
    ax.set_ylim(-0.6, n)
    ax.set_aspect("equal")
    ax.axis("off")
    nv = sum(not r["ok"] for r in run["rows"])
    if j == 0:
        ax.text(n, -0.35, "表の見方：対角線＝面（左上→右下が目標の下→上）。右上の三角に着いた上下、赤＝目標に反する", ha="center", fontsize=9)
    ax.set_title(f"{'③④'[j]} {labels.get(key, key)}\n着いた上下（z=179.5°）：目標に反する組 {nv}／15（赤）", fontsize=10)

# 下段：結びの巻き
ax = fig.add_axes([0.02, 0.02, 0.96, 0.30])
ax.axis("off")
rows = []
keys = list(J["runs"].keys())
w0 = J["runs"][keys[0]]["wind"]
for w in w0:
    nm = f"{name[w['a']]}–{name[w['b']]}"
    kind = "⑬の線" if w["cut"] else "層の折り"
    need = "／".join(f"{math.degrees(c):+.0f}°" for c in w["need"])
    cells = [nm, kind, need]
    for k in keys:
        ww = next(x for x in J["runs"][k]["wind"] if x["a"] == w["a"] and x["b"] == w["b"])
        cells.append(f"{math.degrees(ww['got']):+.0f}°" + ("" if ww["ok"] else "  ✕"))
    rows.append(cells)
rows.append(["（比較）先3枚をまとめて⑬の線で折る", "層の折り 0°", "⑬の線 +180°", "15組・7本とも目標と一致", "すり抜けなし"])
tb = ax.table(cellText=rows, colLabels=["結び", "種類", "目標から決まる終端の相対角", "組 (1,−1) が着いた", "組 (−1,1) が着いた"],
              loc="upper center", cellLoc="center")
tb.auto_set_font_size(False)
tb.set_fontsize(9)
tb.scale(1, 1.25)
for (r, c), cell in tb.get_celld().items():
    if r >= 1 and c >= 3 and "✕" in cell.get_text().get_text():
        cell.set_facecolor(C_NG)
ax.set_title("⑤ 結びの終端の相対角（出発からの巻き）：層の折り 0°＝出発と同じ側／±360°＝反対側。⑬の線 ±180° で先の来る側が違う\n"
             "目標は S1 の層の折り4本とも 0°（2π 巻かない）。駆動の組はどれも各角で片方の半分を 360° 回すので、(1,1) を含めて目標の巻きに着かない",
             fontsize=10)
os.makedirs(os.path.join(HERE, "figs"), exist_ok=True)
out = os.path.join(HERE, "figs", "crane13_s1_target.png")
fig.savefig(out, dpi=110)
print("wrote", out)
