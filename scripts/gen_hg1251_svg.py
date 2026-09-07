# -*- coding: utf-8 -*-
"""HG-1251（小5最レ No.14 大問1／六角形の記号＝七進法）の図を実物どおりに作る。

実物（`G:\\マイドライブ\\浜問題\\5年算数最レ\\5年最レ_復習計算テ_実力〜_No.19.pdf` p43）で
確かめたこと（2026-09-07）:
  ・六角形は **横に長い向き**（左右がとがっていて、上下が平らな辺）。同心3層。
  ・内がわの層は 6つの三角形、中の層・外の層は 台形6つずつ＝**ぜんぶで18マス**。
  ・例は 1, 2, 3, 7, 63 の5つ。ぬられているマスは
      1 → 内1 ／ 2 → 内2 ／ 3 → 内3 ／ 7 → 中1 ／ 63 → 外1＋中2
    ＝ 七進法の各位の数字そのもの（49×外 ＋ 7×中 ＋ 1×内）。
  ・ぬる順は **右下 → 右上 → 上 → 左上 → 左下 → 下**（＝右下から反時計回り）。
    5つの例のどれもこの順で説明がつく（実物の塗り位置と一致することを画像で確認した）。
  ・(1) は 中の層6マス全部（＝42）、(2) は 外6マス＋内6マス・中は白（＝300）。

★アプリは暗い下地なので、ぬったマスは明るい色でぬる（実物は黒ぬり）。
"""
import io
import json
import math
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAIMON = os.path.join(BASE, "data", "hama_daimon.json")

LINE = "#4f9eff"       # 線
FILL = "#dfe7ff"       # ぬったマス
TEXT = "#e8ecf5"       # 文字

R_IN, R_MID, R_OUT = 15.0, 30.0, 45.0
# 右下から反時計回り。V_k は角度 60k 度（SVGはyが下向きなので V1 が右下になる）
ORDER = [0, 5, 4, 3, 2, 1]


def _v(cx, cy, r, k):
    a = math.radians(60 * k)
    return (cx + r * math.cos(a), cy + r * math.sin(a))


def _poly(pts, fill, width=1.4):
    s = " ".join("%.1f,%.1f" % p for p in pts)
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (s, fill, LINE, width)


def hexfig(cx, cy, outer, mid, inner):
    """ぬるマス数を層ごとに受け取って、六角形1つぶんのSVG断片を返す。"""
    on = {"out": set(ORDER[:outer]), "mid": set(ORDER[:mid]), "in": set(ORDER[:inner])}
    out = []
    for k in range(6):
        k2 = (k + 1) % 6
        # 外の層（台形）
        out.append(_poly([_v(cx, cy, R_MID, k), _v(cx, cy, R_MID, k2),
                          _v(cx, cy, R_OUT, k2), _v(cx, cy, R_OUT, k)],
                         FILL if k in on["out"] else "none"))
        # 中の層（台形）
        out.append(_poly([_v(cx, cy, R_IN, k), _v(cx, cy, R_IN, k2),
                          _v(cx, cy, R_MID, k2), _v(cx, cy, R_MID, k)],
                         FILL if k in on["mid"] else "none"))
        # 内の層（三角形）＝いちばん小さいので線は細く
        out.append(_poly([(cx, cy), _v(cx, cy, R_IN, k), _v(cx, cy, R_IN, k2)],
                         FILL if k in on["in"] else "none", 1.1))
    return "".join(out)


def value(outer, mid, inner):
    return 49 * outer + 7 * mid + inner


def label(cx, y, s, size=14):
    return ('<text x="%.1f" y="%.1f" font-size="%d" text-anchor="middle" '
            'font-family="sans-serif" fill="%s">%s</text>' % (cx, y, size, TEXT, s))


def svg(w, h, body):
    return ('<svg viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%">%s</svg>' % (w, h, body))


def examples_svg():
    """5つの例（1・2・3・7・63）を横3つ＋2つで並べる。"""
    rows = [[(0, 0, 1), (0, 0, 2), (0, 0, 3)], [(0, 1, 0), (1, 2, 0)]]
    body = []
    for ri, row in enumerate(rows):
        cy = 58.0 + ri * 120.0
        xs = [52.0, 156.0, 260.0] if len(row) == 3 else [104.0, 208.0]
        for cx, cell in zip(xs, row):
            body.append(hexfig(cx, cy, *cell))
            body.append(label(cx, cy + 62, "＝ %d" % value(*cell), 15))
    body.append(label(156, 256, "同心3層 × 各層6マス ＝ 18マス", 12))
    return svg(312, 266, "".join(body))


def one_svg(outer, mid, inner, caption):
    body = hexfig(80.0, 62.0, outer, mid, inner) + label(80, 126, caption, 13)
    return svg(160, 140, body)


def main():
    figs = {
        "examples": examples_svg(),
        "q1": one_svg(0, 6, 0, "中の層だけ 6マス"),
        "q2": one_svg(6, 0, 6, "外6マスと内6マス"),
    }
    # 検算：例と設問の値が原簿と合っているか
    checks = [((0, 0, 1), 1), ((0, 0, 2), 2), ((0, 0, 3), 3), ((0, 1, 0), 7),
              ((1, 2, 0), 63), ((0, 6, 0), 42), ((6, 0, 6), 300), ((6, 6, 6), 342)]
    for cell, want in checks:
        got = value(*cell)
        assert got == want, "外%d中%d内%d は %d のはずが %d" % (cell + (want, got))
        print("  検算 外%d 中%d 内%d ＝ %d ✓" % (cell + (got,)))

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    rec = None
    for x in d["grades"]["5"]["sairei"]["fukushu"]["14"]:
        if x.get("id") == "hd5s_14_1":
            rec = x
    assert rec is not None, "hd5s_14_1 が見つからない"
    rec["svg"] = figs["examples"]
    # (1)(2) にあたる小問へ図をつける
    for st in rec["steps"]:
        if st["answer"] == "42":
            st["svg"] = figs["q1"]
        elif st["answer"] == "300":
            st["svg"] = figs["q2"]
    io.open(DAIMON, "w", encoding="utf-8").write(
        json.dumps(d, ensure_ascii=False, indent=1) + chr(10))
    print("  hd5s_14_1 に図を入れた（大問の図＋小問2つの図）")

    out = os.path.join(BASE, "scripts", "_hg1251_figs.json")
    io.open(out, "w", encoding="utf-8").write(json.dumps(figs, ensure_ascii=False, indent=1))
    print("  図SVG（原簿へ貼るぶん）:", out)


if __name__ == "__main__":
    main()
