#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊 No.22「立体図形(2)」の展開図SVGを、原本どおりに作り直す。

原本: G:\\マイドライブ\\浜問題\\3年算数\\3年マスター算数_第2分冊.pdf
      本文 p77（PDF 34ページ目）= 大問1・大問2 ／ p78（35ページ目）= 大問3
解答: 3年_解答_3年マスター算数2分冊.pdf の29ページ目

作り直した理由: それまでアプリに入っていた図は原本と別物で、
  「答えとされている展開図が実際には折りたためない」状態だった（監査 g3mb-w4a-r1）。

原本の升目は 300dpi で実測し、手描きのゆれを設計どおりの整数比にそろえてある。
組み立つ／組み立たないは scripts/check_tenkaizu.py で全図を検算ずみ
（大問1は②④だけ、大問2は①③⑥だけが組み立つ＝解答と一致）。
"""
import json
import os

SOLID = '#4f9eff'   # 外まわり（切る線）
DASH = '#9aa3c0'    # 内側（折る線）
LABEL = '#c9d4f0'


def rects_to_lines(rects):
    """長方形の集まりを線分に分解。2回出てくる辺＝内側の折り線（破線）。"""
    count = {}
    for (x0, y0, x1, y1) in rects:
        for seg in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)),
                    ((x0, y1), (x1, y1)), ((x0, y0), (x0, y1))):
            key = tuple(round(v, 4) for p in seg for v in p)
            count[key] = count.get(key, 0) + 1
    out = []
    for (ax, ay, bx, by), n in count.items():
        out.append((ax, ay, bx, by, n >= 2))
    return sorted(out)


def svg_lines(rects, ox, oy, u):
    """rects（単位座標）を u倍して (ox,oy) に置いた <line> 群を返す。"""
    s = []
    for (ax, ay, bx, by, inner) in rects_to_lines(rects):
        x1, y1 = ox + ax * u, oy + ay * u
        x2, y2 = ox + bx * u, oy + by * u
        if inner:
            s.append(f'<line x1="{x1:g}" y1="{y1:g}" x2="{x2:g}" y2="{y2:g}" '
                     f'stroke="{DASH}" stroke-width="1.4" stroke-dasharray="5 4"/>')
        else:
            s.append(f'<line x1="{x1:g}" y1="{y1:g}" x2="{x2:g}" y2="{y2:g}" '
                     f'stroke="{SOLID}" stroke-width="2"/>')
    return s


def label(x, y, t, size=15):
    return (f'<text x="{x:g}" y="{y:g}" font-size="{size}" text-anchor="middle" '
            f'fill="{LABEL}">{t}</text>')


# ---------------------------------------------------------------- 大問1
# 直方体 1 x 3 x H（Hは帯の高さ。実測 170.5/97 ≒ 1.76）
H1 = 2.0      # ①だけ帯が高い（実測 179.5/93 ≒ 1.93）
H = 1.76

D1 = {
    # ①（組み立たない）狭-広-広-狭 の4マス＋両はしの下に脚
    "①": [(0, 0, 1, H1), (1, 0, 4, H1), (4, 0, 7, H1), (7, 0, 8, H1),
          (0, H1, 1, H1 + 3), (7, H1, 8, H1 + 3)],
    # ②（組み立つ）狭-広-狭-広＋2番目の下と4番目の上にふた
    "②": [(0, 0, 1, H), (1, 0, 4, H), (4, 0, 5, H), (5, 0, 8, H),
          (1, H, 4, H + 1), (5, -1, 8, 0)],
    # ③（組み立たない）左上の小さい面＋縦3段＋右に2マス
    "③": [(0, 0, 1, 1), (1, 0, 4, 1), (1, 1, 4, 2.83),
          (4, 1, 5, 2.83), (5, 1, 8, 2.83), (1, 2.83, 4, 3.83)],
    # ④（組み立つ）狭-広-狭-広＋2番目の上にふた・3番目の下に長い脚
    "④": [(0, 0, 1, H), (1, 0, 4, H), (4, 0, 5, H), (5, 0, 8, H),
          (1, -1, 4, 0), (4, H, 5, H + 3)],
}


def build_d1():
    u = 21
    cells = []
    # 2列×2行。各図の単位座標の原点ずれを吸収するため y の最小値を持ち上げる
    place = {"①": (0, 0), "②": (1, 0), "③": (0, 1), "④": (1, 1)}
    colw, rowh = 220, 155
    body = []
    for name, rects in D1.items():
        cx, cy = place[name]
        ymin = min(r[1] for r in rects)
        ox = 28 + cx * colw
        oy = 26 + cy * rowh - ymin * u
        body += svg_lines(rects, ox, oy, u)
        body.append(label(ox - 14, oy + ymin * u + 12, name))
        cells.append((ox, oy))
    w, h = 28 + colw + 8 * u + 12, 26 + rowh + 5.76 * u + 10
    return ('<svg viewBox="0 0 %g %g" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%">%s</svg>'
            % (w, h, "".join(body)))


# ---------------------------------------------------------------- 大問2
# 立方体の展開図。すべて正方形のマス目 (列, 行)
D2 = {
    "①": [(0, 0), (1, 0), (1, 1), (1, 2), (1, 3), (2, 3)],
    "②": [(0, 0), (1, 0), (0, 1), (1, 1), (1, 2), (1, 3)],
    "③": [(0, 0), (0, 1), (1, 1), (1, 2), (2, 2), (2, 3)],
    "④": [(0, 0), (1, 0), (2, 0), (0, 1), (0, 2), (0, 3)],
    "⑤": [(0, 0), (0, 1), (0, 2), (1, 2), (2, 2), (2, 3)],
    "⑥": [(1, 0), (1, 1), (1, 2), (0, 2), (0, 3), (0, 4)],
}


def build_d2():
    u = 26
    place = {"①": (0, 0), "②": (1, 0), "③": (2, 0),
             "④": (0, 1), "⑤": (1, 1), "⑥": (2, 1)}
    colw, rowh = 150, 165
    body = []
    for name, cs in D2.items():
        rects = [(c, r, c + 1, r + 1) for (c, r) in cs]
        cx, cy = place[name]
        ox = 30 + cx * colw
        oy = 24 + cy * rowh
        body += svg_lines(rects, ox, oy, u)
        body.append(label(ox - 14, oy + 14, name))
    w, h = 30 + 2 * colw + 3 * u + 16, 24 + rowh + 5 * u + 12
    return ('<svg viewBox="0 0 %g %g" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%">%s</svg>'
            % (w, h, "".join(body)))


# ---------------------------------------------------------------- 大問3
# 〔図ア〕たて5cm・よこ6cm・高さ3cm の直方体の展開図。頂点ア〜セ。
#   横一列 4マス（幅 5,3,5,3・高さ6）＋3マス目の上下に ふた（幅5・高さ3）
#   ①アイ=6 ②シサ=5 ③アケ=5+3+5+3=16 ④シオ=3+6+3=12 と合う。
def build_d3():
    s = 12          # 1cm = 12px
    A, B, Hh = 5 * s, 3 * s, 6 * s     # 5cm, 3cm, 6cm
    x0 = 24
    x1, x2, x3, x4 = x0 + A, x0 + A + B, x0 + A + B + A, x0 + A + B + A + B
    yt = 20 + B     # 帯の上
    yb = yt + Hh    # 帯の下
    rects = [(x0, yt, x1, yb), (x1, yt, x2, yb), (x2, yt, x3, yb), (x3, yt, x4, yb),
             (x2, yt - B, x3, yt), (x2, yb, x3, yb + B)]
    body = svg_lines([(a, b, c, d) for (a, b, c, d) in rects], 0, 0, 1)
    pts = [("ア", x0, yt, -10, -8), ("セ", x1, yt, -10, -8), ("ス", x2, yt, 10, -8),
           ("コ", x3, yt, -10, -8), ("ケ", x4, yt, 10, -8),
           ("イ", x0, yb, -10, 18), ("ウ", x1, yb, -10, 18), ("エ", x2, yb, 10, 18),
           ("キ", x3, yb, -10, 18), ("ク", x4, yb, 10, 18),
           ("シ", x2, yt - B, -10, -6), ("サ", x3, yt - B, 10, -6),
           ("オ", x2, yb + B, -10, 16), ("カ", x3, yb + B, 10, 16)]
    for (t, px, py, dx, dy) in pts:
        body.append(label(px + dx, py + dy, t, 14))
    w, h = x4 + 26, yb + B + 26
    return ('<svg viewBox="0 0 %g %g" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%">%s</svg>'
            % (w, h, "".join(body)))


# ---------------------------------------------------------------- 大問5
# 立方体の展開図。面㋐㋑㋒がたて1列、面㋓㋔㋕が㋑の右へ横1列。頂点はア〜セの14個。
#   ⚠ 前の図は「ウ」が抜けていて「サ」が2回使われていた（答えの辺ウイが図に無かった）。
CELLS5 = {"㋐": (0, 0), "㋑": (0, 1), "㋒": (0, 2),
          "㋓": (1, 1), "㋔": (2, 1), "㋕": (3, 1)}
# 頂点名: (列, 行) の格子点 -> (名前, ラベルのずらし方向)
VERTS5 = [("ア", 0, 0, -1, -1), ("セ", 1, 0, 1, -1),
          ("イ", 0, 1, -1, 0), ("ス", 1, 1, 1, -1), ("シ", 2, 1, 0, -1),
          ("サ", 3, 1, 0, -1), ("コ", 4, 1, 1, -1),
          ("ウ", 0, 2, -1, 0), ("カ", 1, 2, 1, 1), ("キ", 2, 2, 0, 1),
          ("ク", 3, 2, 0, 1), ("ケ", 4, 2, 1, 1),
          ("エ", 0, 3, -1, 1), ("オ", 1, 3, 1, 1)]


def build_d5():
    u, ox, oy = 46, 46, 40
    rects = [(c * u + ox, r * u + oy, (c + 1) * u + ox, (r + 1) * u + oy)
             for (c, r) in CELLS5.values()]
    body = svg_lines(rects, 0, 0, 1)
    for name, (c, r) in CELLS5.items():   # 面の名前は真ん中に
        body.append(label(ox + (c + .5) * u, oy + (r + .5) * u + 6, name, 17))
    for (t, c, r, dx, dy) in VERTS5:      # 頂点の名前は外へ逃がす
        body.append(label(ox + c * u + dx * 15, oy + r * u + (dy * 15 if dy else 5) + 5,
                          t, 14))
    return ('<svg viewBox="0 0 %g %g" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%">%s</svg>'
            % (ox + 4 * u + 30, oy + 3 * u + 34, "".join(body)))


# ---------------------------------------------------------------- 大問6
# さいころ（向かい合う面の和が7）。①②とも「4の目＝う」。
#   ①: 横4マス[2,1,あ,い] ＋ いの上に3 ＋ 2の下にう
#   ②: 階段 [3,1]（上段）/[あ,い]（中段）/[5,う]（下段）
PIPS = {  # さいころの目の位置（マスの中を 0〜1 で見たときの座標）
    1: [(.5, .5)],
    2: [(.28, .68), (.72, .32)],
    3: [(.26, .72), (.5, .5), (.74, .28)],
    5: [(.28, .28), (.72, .28), (.5, .5), (.28, .72), (.72, .72)],
}
D6 = {
    "①": {"cells": {"2": (0, 1), "1": (1, 1), "あ": (2, 1), "い": (3, 1),
                    "3": (3, 0), "う": (0, 2)}},
    "②": {"cells": {"3": (2, 0), "1": (3, 0), "あ": (1, 1), "い": (2, 1),
                    "5": (0, 2), "う": (1, 2)}},
}


def build_d6():
    u = 34
    body = []
    xoff = {"①": 34, "②": 34 + 4 * u + 56}
    oy = 34
    for name, spec in D6.items():
        ox = xoff[name]
        cells = spec["cells"]
        rects = [(c * u + ox, r * u + oy, (c + 1) * u + ox, (r + 1) * u + oy)
                 for (c, r) in cells.values()]
        body += svg_lines(rects, 0, 0, 1)
        body.append(label(ox - 16, oy + 14, name))
        for face, (c, r) in cells.items():
            cx, cy = ox + c * u, oy + r * u
            if face in ("あ", "い", "う"):
                body.append(label(cx + u / 2, cy + u / 2 + 6, face, 16))
            else:
                for (px, py) in PIPS[int(face)]:
                    rr = 5.5 if face == "1" else 3.6
                    body.append(f'<circle cx="{cx + px * u:g}" cy="{cy + py * u:g}" '
                                f'r="{rr}" fill="{LABEL}"/>')
    w = xoff["②"] + 4 * u + 20
    return ('<svg viewBox="0 0 %g %g" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%">%s</svg>'
            % (w, oy + 3 * u + 20, "".join(body)))


BUILDERS = {"hd3mb_22_1": build_d1, "hd3mb_22_2": build_d2, "hd3mb_22_3": build_d3,
            "hd3mb_22_5": build_d5, "hd3mb_22_6": build_d6}

if __name__ == "__main__":
    out = {k: f() for k, f in BUILDERS.items()}
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "_svg_g3mb_no22.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    for k, v in out.items():
        print(k, len(v), "chars")
    print("->", path)
