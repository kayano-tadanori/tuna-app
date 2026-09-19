# -*- coding: utf-8 -*-
"""つる⑬ 第15段の図：成功した単独模型（S0）と、最初に通らなくなった S1（曲がり角2つ）の違い（2026-09-17）

入力：crane13_input.json・crane13_cutline.json・stages.log（`check_crane13_stages.py` の出力）
出力：figs/crane13_stage_S1.png
使い方： python make_crane13_stage_figs.py
"""
import importlib.util
import json
import math
import os
import re
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MPoly, FancyArrowPatch
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
plt.rcParams["font.family"] = ["BIZ UDPGothic", "MS Gothic", "sans-serif"]
_argv = sys.argv
sys.argv = [sys.argv[0]]
_s = importlib.util.spec_from_file_location("stages", os.path.join(HERE, "check_crane13_stages.py"))
S = importlib.util.module_from_spec(_s)
_s.loader.exec_module(S)
sys.argv = _argv
M = S.M

C_TIP, C_BASE, C_CUT, C_CREASE = "#e07b39", "#4a7fb5", "#c0392b", "#555555"


def draw_single(ax, theta, title, stack, verdict):
    th = math.radians(theta)
    H, LT, LB = 0.168, 0.9, 0.7
    X = H / math.tan(th)
    tipA = [(0, 0), (LT, 0), (LT, H), (X, H)]
    tipB = [(0, 0), (X, -H), (LT, -H), (LT, 0)]
    baseA = [(0, 0), (X, H), (-LB, H), (-LB, 0)]
    baseB = [(0, 0), (-LB, 0), (-LB, -H), (X, -H)]
    for poly, col in ((tipA, C_TIP), (tipB, C_TIP), (baseA, C_BASE), (baseB, C_BASE)):
        ax.add_patch(MPoly(poly, closed=True, fc=col, alpha=0.25, ec="none"))
    ax.plot([-LB, LT], [0, 0], color=C_CREASE, lw=2)
    ax.plot([0, X], [0, H], color=C_CUT, lw=3)
    ax.plot([0, X], [0, -H], color=C_CUT, lw=3)
    ax.annotate("", xy=(0.35, 0), xytext=(0, 0), arrowprops=dict(arrowstyle="->", color="k", lw=1.5))
    ax.text(0.37, 0.02, "先の側", fontsize=9)
    ax.text(X + (0.02 if X >= 0 else -0.02), H + 0.02, f"{theta:.2f}°", fontsize=10, color=C_CUT, ha="center")
    ax.text(0.55, 0.09, "先", color=C_TIP, fontsize=12, weight="bold")
    ax.text(-0.5, 0.09, "元", color=C_BASE, fontsize=12, weight="bold")
    ax.set_xlim(-0.75, 0.95)
    ax.set_ylim(-0.45, 0.35)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(title, fontsize=11)
    draw_stack(ax, stack, x0=-0.72, y0=-0.42, w=0.28, h=0.045)
    ax.text(-0.38, -0.33, verdict, fontsize=10, weight="bold")


def draw_stack(ax, stack, x0, y0, w, h):
    """下→上の並び"""
    for i, name in enumerate(stack):
        col = C_TIP if name.startswith("先") else C_BASE
        ax.add_patch(MPoly([(x0, y0 + i * h), (x0 + w, y0 + i * h), (x0 + w, y0 + (i + 0.85) * h), (x0, y0 + (i + 0.85) * h)],
                           closed=True, fc=col, alpha=0.8, ec="k", lw=0.5))
        ax.text(x0 + w / 2, y0 + (i + 0.42) * h, name, ha="center", va="center", fontsize=7, color="w")


def main():
    log = open(os.path.join(HERE, "stages.log"), encoding="utf-8").read()
    D, faces_all, cut, leg, geo, chain, verts = S.build()
    legTip = geo[0]
    i = next(v["i"] for v in verts if v["center"] and verts[v["i"] + 1]["center"] is False)
    sub = chain[i:i + 3]
    sv = [v for v in verts if v["faces"][0] in sub and v["faces"][1] in sub]
    CL = json.load(open(os.path.join(HERE, "crane13_cutline.json"), encoding="utf-8"))
    rec = [x for x in CL["legs"] if x["leg"] == 1][0]
    cutmat = {r["faceId"]: r["mat"] for r in rec["lines"]}

    fig = plt.figure(figsize=(17, 11))
    fig.suptitle("つる⑬：成功した単独模型（S0）と、最初に通らなくなった S1（曲がり角2つ）の違い　※S1 は胴・ほかの層の結びを省いた模型", fontsize=13)

    ax = fig.add_subplot(2, 3, 1)
    draw_single(ax, 75.9638, "S0 単独模型：⑬の線が**先の側**へ傾く（75.96°）\n元を戻して先を返す → 成功".replace("**", ""),
                ["元B", "先B", "先A", "元A"], "中割り（先が元のあいだ）")
    ax = fig.add_subplot(2, 3, 2)
    draw_single(ax, 92.7862, "S0 単独模型：⑬の線が**元の側**へ傾く（92.79°）\n元を戻して先を返す → 剛体で通る".replace("**", ""),
                ["先B", "元B", "元A", "先A"], "かぶせ折り型（先が外）")

    # (c) S1 の素材の図
    ax = fig.add_subplot(2, 3, 3)
    cols = ["#f2d7b6", "#d6e4f0", "#e3f0d6"]
    allp = []
    for k, f in enumerate(sub):
        poly = faces_all[f]["mat"]
        allp += poly
        ax.add_patch(MPoly(poly, closed=True, fc=cols[k], ec="#999", lw=0.8))
        c = np.mean(poly, axis=0)
        ax.text(c[0], c[1], f"層{faces_all[f]['layer']}", fontsize=9, ha="center")
    for f in sub:
        s_ = cutmat[f]
        ax.plot([s_[0][0], s_[1][0]], [s_[0][1], s_[1][1]], color=C_CUT, lw=3)
    label_pos = []
    for v in sv:
        b = v["bond"]
        seg = b["seg"]
        ax.plot([seg[0][0], seg[1][0]], [seg[0][1], seg[1][1]], color=C_CREASE, lw=2)
        # 曲がり角（2つの面の⑬の線分が共有する端）
        a_, c_ = v["faces"]
        pa = [tuple(np.round(p, 9)) for p in cutmat[a_]]
        pc = [tuple(np.round(p, 9)) for p in cutmat[c_]]
        V = np.array(next(p for p in pa if any(np.allclose(p, q, atol=1e-7) for q in pc)))
        ax.plot(*V, "ko", ms=6)
        # 折線の先の側：いまの位置で脚の先端に近い端
        cur = b["cur"]
        tip_end = np.array(seg[0] if M.dist(cur[0], legTip) < M.dist(cur[1], legTip) else seg[1])
        d = tip_end - V
        d = d / np.linalg.norm(d)
        ax.add_patch(FancyArrowPatch(V, V + 0.12 * d, arrowstyle="->", mutation_scale=12, color="k", lw=1.5))
        ax.text(*(V + 0.14 * d), "先", fontsize=9)
        label_pos.append((V, f"{'中心線' if v['center'] else '外形の側'}の角：先の側と {v['lean']:.2f}°\n→ ⑬の線は{'先' if v['lean'] < 90 else '元'}の側へ傾く"))
    allp = np.array(allp)
    xr = allp[:, 0].max() + 0.06
    for j, (V, t) in enumerate(sorted(label_pos, key=lambda q: -q[0][1])):
        ax.annotate(t, xy=V, xytext=(xr, allp[:, 1].max() - 0.05 - j * 0.35), fontsize=9, va="top",
                    bbox=dict(boxstyle="round", fc="w", ec="#aaa"), arrowprops=dict(arrowstyle="-", color="#777", lw=0.8))
    ax.set_xlim(allp[:, 0].min() - 0.08, allp[:, 0].max() + 0.95)
    ax.set_ylim(allp[:, 1].min() - 0.08, allp[:, 1].max() + 0.08)
    ax.set_aspect("equal")
    ax.set_title("S1 実際の脚の連続する3層（素材座標・広げた紙）\n赤＝⑬の線／灰＝既存の折線／●＝曲がり角", fontsize=11)
    ax.tick_params(labelsize=7)

    # (d) 組み合わせごとの残り
    ax = fig.add_subplot(2, 3, 4)
    lin = dict(re.findall(r"\((-?1, -?1)\) 残り ([0-9.e+-]+)・⑬", log))
    nonlin = dict(re.findall(r"    \((-?1, -?1)\)：閉じの残り ([0-9.e+-]+)", log))
    keys = ["1, 1", "1, -1", "-1, 1", "-1, -1"]
    names = ["両方で\n元が戻る\n（中割りに要る）", "中心線で元・\n外形の側で先\nが戻る", "中心線で先・\n外形の側で元\nが戻る", "両方で\n先が戻る"]
    xs = np.arange(4)
    ax.bar(xs - 0.2, [float(lin[k]) for k in keys], 0.4, label="1次（平らな姿の速さの連立方程式）", color="#8e44ad")
    ax.bar(xs + 0.2, [float(nonlin[k]) for k in keys], 0.4, label="z=2°（出発点6通りの最小二乗）", color="#16a085")
    ax.set_yscale("log")
    ax.set_xticks(xs)
    ax.set_xticklabels(names, fontsize=8)
    ax.axhline(1e-9, color="k", ls=":", lw=1)
    ax.text(3.45, 1.5e-9, "閉じる基準 1e-9", fontsize=8, ha="right")
    ax.set_ylabel("閉じの残り（小さいほど閉じる）")
    ax.legend(fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.25))
    ax.set_title("S1 段2の入口：曲がり角ごとに「どちらが戻るか」\n→ 閉じるのは交互の組だけ（⑬の線を共有するため）", fontsize=11)

    # (e) 層順
    ax = fig.add_subplot(2, 3, 5)
    stacks = re.findall(r"組 \((-?1, -?1)\)：.*?：(.*)", log)
    ax.set_xlim(0, 3)
    ax.set_ylim(-0.05, 0.42)
    ax.axis("off")
    draw_stack(ax, ["元", "先", "先", "先", "元", "元"], x0=0.1, y0=0.02, w=0.7, h=0.055)
    ax.text(0.45, 0.37, "中割りの条件（並べ方の一例）\n先3枚がすべて、元のいちばん下と\nいちばん上のあいだ", ha="center", fontsize=8)
    for j, (k, st) in enumerate(stacks[:2]):
        items = [x.strip() for x in st.split("／")]
        draw_stack(ax, items, x0=1.1 + j * 0.95, y0=0.02, w=0.8, h=0.055)
        lab = "中心線で元・外形の側で先\nが戻る" if k == "1, -1" else "中心線で先・外形の側で元\nが戻る"
        ax.text(1.5 + j * 0.95, 0.37, lab, ha="center", fontsize=8)
    ax.set_title("S1 段3の終わり（閉じる組）：剛体・すり抜けなしで終端に着くが\n層順は「一部だけ中に入る」＝中割りではない", fontsize=11)

    # (f) まとめ
    ax = fig.add_subplot(2, 3, 6)
    ax.axis("off")
    txt = (
        "【区別】\n"
        "・S1 段1「そろえて開く」10°ですり抜け → 道の選び方\n"
        "　（外側の角から1つずつ開けば、すり抜けなしで平らに届く）\n"
        "・S1 段2「両方の角で元を戻す」が閉じない → 幾何\n"
        "　1次の連立方程式で残り 0.13（出発点に依らない）\n"
        "　非線形でも z=2°・10°・45° で残り 4.7e-3〜1.1e-1\n\n"
        "【違い】\n"
        "・S0（成功）：曲がり角1つ。⑬の線の傾きに合わせて\n"
        "　「どちらが戻るか」を自由に選べる\n"
        "・S1：中心線の角は先の側へ、外形の側の角は元の側へ傾く。\n"
        "　⑬の線を共有するので、2つの角は同じ型にしか進めない。\n"
        "　元をどちらでも戻すと、片方が中割り型・片方がかぶせ型\n"
        "　になる組になり、これは閉じない。\n\n"
        "【言えないこと】\n"
        "・厚み0・剛体の模型。しなり・追加の折り目は入れていない\n"
        "・S1 は胴・ほかの層の結びを省いた模型（S2・S3 は未実施）\n"
    )
    ax.text(0.0, 1.0, txt, va="top", fontsize=10)
    os.makedirs(os.path.join(HERE, "figs"), exist_ok=True)
    out = os.path.join(HERE, "figs", "crane13_stage_S1.png")
    fig.tight_layout(rect=[0, 0, 1, 0.95])
    fig.savefig(out, dpi=110)
    print("書いた：", out)


if __name__ == "__main__":
    main()
