# -*- coding: utf-8 -*-
"""小4灘合 第5回 大問1・2・3・6・7・8・9 の図SVG
   （HG-2343 / 2344 / 2345 / 2348 / 2349 / 2350 / 2351）。

   ●や○の位置は、現物PDF（4年灘合_第1〜6回.pdf の p43〜p51）を拡大して座標で読み取った。
   ★HG-2343 は「立方体の各面が 辺の中点を結んだひし形になっている」ことを実測で確かめ、
     切り口が辺の中点まで届く＝立方八面体 と確定した（原簿の「確定できない」は誤り）。
   使い方: python scripts/genbo_svg_g4nadago_05.py  → docs/_svg_g4nadago_05.json
"""
import io, json, math, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINE, THIN, FILL, EDGE = "#4f9eff", "#7fb8ff", "rgba(255,209,102,0.22)", "#ffd166"
LBL, TTL, DASH = "#c9d4f0", "#9aa3c0", "#5b6b96"


def head(vb, title):
    p = [float(v) for v in vb.split()]
    return ('<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%">'
            '<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" fill="%s">%s</text>'
            % (vb, p[0] + p[2] / 2, p[1] + 16, TTL, title))


def txt(x, y, s, anchor="middle", size=12, color=LBL):
    return '<text x="%.1f" y="%.1f" font-size="%d" text-anchor="%s" fill="%s">%s</text>' % (
        x, y, size, anchor, color, s)


def P(x, y, z, s=1.0, dx=0.0, dy=0.0, ky=0.52, kz=0.40):
    """立体を紙に写す（奥ゆき y は 右上へ）。x=右, y=奥, z=上"""
    # ★画面のyは下向き。高さzは上へ、奥ゆきyは右上へ。符号をまちがえると図がつぶれる
    return (dx + (x + ky * y) * s, dy - (z + kz * y) * s)


def line(a, b, col=LINE, w=2.0, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ""
    return ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"%s/>'
            % (a[0], a[1], b[0], b[1], col, w, d))


def poly(pts, fill="none", stroke=LINE, w=2.0):
    return ('<polygon points="%s" fill="%s" stroke="%s" stroke-width="%.1f"/>'
            % (" ".join("%.1f,%.1f" % q for q in pts), fill, stroke, w))


# ══════ HG-2343 立方体の角を辺の中点まで切り取った立体（立方八面体） ══════
def svg_2343():
    # ★奥ゆきを(0.68,0.42)にする。既定の(0.52,0.40)だと頂点どうしが1辺の20%まで
    #   近づいて線が重なり、414pxの実機で読みにくかった（監査の指摘・実測で39%に改善）
    s, KY, KZ = 76.0, 0.68, 0.42
    dx, dy = 26.0, 26.0 + (2 + KZ * 2) * s + 34
    p = [head("-14 -26 %.0f %.0f" % ((2 + KY * 2) * s + 56, (2 + KZ * 2) * s + 90),
              "立方体の角を切り取った立体")]
    C = [(x, y, z) for x in (0, 2) for y in (0, 2) for z in (0, 2)]
    pt = lambda v: P(v[0], v[1], v[2], s, dx, dy, KY, KZ)
    for a in C:                                   # もとの立方体（点線）
        for b in C:
            if sum(1 for i in range(3) if a[i] != b[i]) == 1 and a < b:
                p.append(line(pt(a), pt(b), DASH, 1.4, "7 5"))
    V = [v for v in [(a, b, c) for a in (0, 1, 2) for b in (0, 1, 2) for c in (0, 1, 2)]
         if sorted(v).count(1) == 1 and 1 in v and all(t in (0, 1, 2) for t in v)
         and sum(1 for t in v if t == 1) == 1]
    for i, a in enumerate(V):                     # できた立体（実線）
        for b in V[i + 1:]:
            d2 = sum((a[k] - b[k]) ** 2 for k in range(3))
            if d2 == 2:
                p.append(line(pt(a), pt(b), LINE, 2.0))
    # ★頂点に印を打たない。打つと「頂点は何個か」が数えるだけで分かってしまう（監査の指摘）
    return "".join(p) + "</svg>"


def cube_grid(n, s, dx, dy, marks_front, marks_top, marks_right, r=8.0, hollow=False):
    """n×n×n の立方体を描く。marks_* は 0起点の (列,行) など。○の中心も返す"""
    out = []
    pt = lambda x, y, z: P(x, y, z, s, dx, dy)
    # 面のわく
    for i in range(n + 1):
        out.append(line(pt(i, 0, 0), pt(i, 0, n), THIN, 1.2))            # 正面 たて
        out.append(line(pt(0, 0, i), pt(n, 0, i), THIN, 1.2))            # 正面 よこ
        out.append(line(pt(i, 0, n), pt(i, n, n), THIN, 1.2))            # 上 おく
        out.append(line(pt(0, i, n), pt(n, i, n), THIN, 1.2))            # 上 よこ
        out.append(line(pt(n, i, 0), pt(n, i, n), THIN, 1.2))            # 右 たて
        out.append(line(pt(n, 0, i), pt(n, n, i), THIN, 1.2))            # 右 おく
    for a, b in (((0, 0, 0), (n, 0, 0)), ((0, 0, 0), (0, 0, n)), ((n, 0, 0), (n, n, 0)),
                 ((0, 0, n), (n, 0, n)), ((0, 0, n), (0, n, n)), ((n, 0, n), (n, n, n)),
                 ((n, n, 0), (n, n, n)), ((0, n, n), (n, n, n)), ((n, 0, 0), (n, 0, n))):
        out.append(line(pt(*a), pt(*b), LINE, 2.0))
    # ★原本が白ぬきの○なら hollow=True（HG-2344）、ぬりつぶしの●なら False（HG-2351）
    dot = (lambda q: '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="none" stroke="%s" stroke-width="2.2"/>'
           % (q[0], q[1], r, EDGE)) if hollow else (
           lambda q: '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (q[0], q[1], r, EDGE))
    for c, row in marks_front:                    # 正面: 列c(左0起点)・段row(上0起点)
        out.append(dot(pt(c + .5, 0, n - row - .5)))
    for c, dep in marks_top:                      # 上: 列c・おくゆきdep(手前0起点)
        out.append(dot(pt(c + .5, dep + .5, n)))
    for dep, row in marks_right:                  # 右: おくゆきdep・段row
        out.append(dot(pt(n, dep + .5, n - row - .5)))
    return "".join(out)


# ══════ HG-2344 透明な小箱27個・3方向から見た玉 ══════
def svg_2344():
    n, sc = 3, 76.0
    W, H = 1.52 * n * sc + 60, 1.40 * n * sc + 84
    p = [head("-16 -26 %.0f %.0f" % (W, H), "透明な小箱27個と 玉の見える場所")]
    p.append(cube_grid(n, sc, 22.0, 26.0 + 1.40 * n * sc + 30,
                       [(0, 0), (1, 0), (2, 1), (1, 2)],          # 正面
                       [(0, 2), (1, 2), (1, 1), (2, 1)],          # 真上
                       [(2, 0), (1, 1), (1, 2)], 9.0, hollow=True))   # 真横（○は白ぬき）
    return "".join(p) + "</svg>"


# ══════ HG-2351 64個の立方体と12本の針 ══════
def svg_2351():
    n, sc = 4, 58.0
    W, H = 1.52 * n * sc + 60, 1.40 * n * sc + 84
    p = [head("-16 -26 %.0f %.0f" % (W, H), "64個の立方体と 針をさす場所")]
    p.append(cube_grid(n, sc, 22.0, 26.0 + 1.40 * n * sc + 30,
                       [(3, 0), (2, 1), (1, 2), (0, 3)],          # 正面：対角線
                       [(1, 1), (2, 1), (1, 2), (2, 2)],          # 真上：まん中の2×2
                       [(0, 0), (1, 1), (2, 2), (3, 3)], 7.0))    # 真横：対角線
    return "".join(p) + "</svg>"


# ══════ HG-2345 正面図と真上図 ══════
def svg_2345():
    u = 44.0
    F = [[0, 1, 0, 0], [1, 1, 1, 0], [1, 1, 1, 1], [1, 1, 1, 1]]     # 正面（上から）
    T = [[1, 1, 1, 0], [1, 1, 1, 1], [0, 1, 1, 0]]                    # 真上（奥から）
    p = [head("-120 -28 400 480", "正面からみた図と 真上からみた図")]
    ox = 40.0
    for r, row in enumerate(F):
        for c, v in enumerate(row):
            if v:
                p.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" '
                         'stroke="%s" stroke-width="1.6"/>'
                         % (ox + c * u, 34 + r * u, u, u, FILL, LINE))
    p.append(txt(ox - 12, 34 + 2 * u + 5, "（正面からみた図）", "end", 12))
    oy = 34 + 4 * u + 70
    for r, row in enumerate(T):
        for c, v in enumerate(row):
            if v:
                p.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" '
                         'stroke="%s" stroke-width="1.6"/>'
                         % (ox + c * u, oy + r * u, u, u, FILL, LINE))
    p.append(txt(ox - 12, oy + 1.5 * u + 5, "（真上からみた図）", "end", 12))
    for c in (0, 4):                       # 左右のはしをつなぐ点線
        p.append(line((ox + c * u, 34 + 4 * u), (ox + c * u, oy), DASH, 1.3, "6 5"))
    return "".join(p) + "</svg>"


# ══════ HG-2348 正八面体と その展開図 ══════
def svg_2348():
    p = [head("-16 -26 440 300", "正八面体と 展開図")]
    A, F = (95.0, 45.0), (95.0, 250.0)
    B, D = (18.0, 165.0), (172.0, 148.0)
    E, C = (78.0, 120.0), (112.0, 196.0)
    for a, b in ((A, B), (A, D), (B, F), (D, F), (A, C), (C, D), (B, C), (C, F)):
        p.append(line(a, b, LINE, 1.8))
    for a, b in ((A, E), (E, F), (B, E), (E, D)):
        p.append(line(a, b, DASH, 1.4, "5 4"))
    for q, nm, an, dx, dy in ((A, "A", "middle", 0, -8), (F, "F", "middle", 0, 16),
                              (B, "B", "end", -6, 4), (D, "D", "start", 7, 4),
                              (E, "E", "end", -5, -4), (C, "C", "start", 7, 10)):
        p.append(txt(q[0] + dx, q[1] + dy, nm, an, 12))
    # 展開図（帯）
    s = 46.0
    ox, oy = 210.0, 120.0
    h = s * math.sqrt(3) / 2
    top = [(ox + i * s / 2, oy) for i in range(7)]          # y=oy の並び
    bot = [(ox + s / 4 + i * s / 2, oy + h) for i in range(7)]
    tri = []
    tri.append(((ox, oy), (ox + s, oy), (ox + s / 2, oy - h)))                 # A の三角形
    for i in range(6):
        a = (ox + i * s / 2, oy); b = (ox + i * s / 2 + s, oy)
        c = (ox + i * s / 2 + s / 2, oy + h)
        tri.append((a, b, c) if i % 2 == 0 else None)
    band = []
    for i in range(6):
        if i % 2 == 0:
            band.append(((ox + i * s / 2, oy), (ox + (i + 2) * s / 2, oy), (ox + (i + 1) * s / 2, oy + h)))
        else:
            band.append(((ox + i * s / 2, oy + h), (ox + (i + 2) * s / 2, oy + h), (ox + (i + 1) * s / 2, oy)))
    for t in band:
        p.append(poly(t, "none", LINE, 1.6))
    p.append(poly(((ox, oy), (ox + s, oy), (ox + s / 2, oy - h)), "none", LINE, 1.6))
    p.append(poly(((ox + 5 * s / 2, oy + h), (ox + 7 * s / 2, oy + h), (ox + 3 * s, oy + 2 * h)), "none", LINE, 1.6))
    p.append(txt(ox + s / 2, oy - h - 8, "A", "middle", 12))
    p.append(txt(ox - 7, oy + 4, "E", "end", 12))
    p.append(txt(ox + s + 7, oy - 3, "B", "start", 12))
    p.append(txt(ox + 3 * s / 2, oy + h + 18, "(  )", "middle", 12, EDGE))
    p.append(txt(ox + 7 * s / 2 + 8, oy + h + 5, "(  )", "start", 12, EDGE))
    return "".join(p) + "</svg>"


# ══════ HG-2349 サイコロ3個（図1・図2） ══════
def pips(cx, cy, n, ex, ey, r=5.0):
    """中心(cx,cy)の面に n の目を打つ。ex,ey は面の2方向のベクトル（半分の長さ）"""
    pat = {1: [(0, 0)], 2: [(-.5, -.5), (.5, .5)], 3: [(-.5, -.5), (0, 0), (.5, .5)],
           4: [(-.5, -.5), (.5, -.5), (-.5, .5), (.5, .5)],
           5: [(-.5, -.5), (.5, -.5), (0, 0), (-.5, .5), (.5, .5)],
           6: [(-.5, -.6), (.5, -.6), (-.5, 0), (.5, 0), (-.5, .6), (.5, .6)]}
    out = []
    for a, b in pat[n]:
        x = cx + a * ex[0] + b * ey[0]
        y = cy + a * ex[1] + b * ey[1]
        out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (x, y, r, EDGE))
    return "".join(out)


def die(ox, oy, s, top, front, right, label=None):
    """紙に置いたサイコロ（上・手前・右が見える）"""
    pt = lambda x, y, z: P(x, y, z, s, ox, oy)
    out = []
    for f, pts in (("top", [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)]),
                   ("front", [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)]),
                   ("right", [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)])):
        out.append(poly([pt(*v) for v in pts], "none", LINE, 1.8))
    c = pt(.5, .5, 1); ex = (pt(1, .5, 1)[0] - c[0], pt(1, .5, 1)[1] - c[1])
    ey = (pt(.5, 1, 1)[0] - c[0], pt(.5, 1, 1)[1] - c[1])
    if top: out.append(pips(c[0], c[1], top, ex, ey, s * .055))
    c = pt(.5, 0, .5); ex = (pt(1, 0, .5)[0] - c[0], pt(1, 0, .5)[1] - c[1])
    ey = (pt(.5, 0, 0)[0] - c[0], pt(.5, 0, 0)[1] - c[1])
    if front: out.append(pips(c[0], c[1], front, ex, ey, s * .055))
    elif label: out.append(txt(c[0], c[1] + 6, label, "middle", 17, EDGE))
    c = pt(1, .5, .5); ex = (pt(1, 1, .5)[0] - c[0], pt(1, 1, .5)[1] - c[1])
    ey = (pt(1, .5, 0)[0] - c[0], pt(1, .5, 0)[1] - c[1])
    if right: out.append(pips(c[0], c[1], right, ex, ey, s * .055))
    return "".join(out)


def svg_2349():
    p = [head("-16 -26 420 290", "図1（サイコロ）と 図2（3個ならべた形）")]
    p.append(txt(72, 46, "図1", "middle", 13))
    p.append(die(24, 210, 92, 4, 1, 5))
    p.append(txt(272, 46, "図2", "middle", 13))
    s, ox, oy = 62.0, 200.0, 250.0
    # 手前(0,0,0) 奥(0,1,0) 上(0,1,1)  ※奥のほうが右上に見える
    p.append(die(ox + 0.52 * s, oy - 0.40 * s, s, None, None, 1))          # 奥
    p.append(die(ox + 0.52 * s, oy - 0.40 * s - s, s, None, 1, 4))         # 上
    p.append(die(ox, oy, s, None, None, 2, label="Ⓐ"))                    # 手前（Ⓐ）
    return "".join(p) + "</svg>"


# ══════ HG-2350 道の上でサイコロを転がす ══════
def path_svg(cells, start_die, goal, ox, oy, u):
    out = []
    for (cx, cy) in cells:
        out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" '
                   'stroke="%s" stroke-width="1.6"/>' % (ox + cx * u, oy + cy * u, u, u, LINE))
    gx, gy = goal
    out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" '
               'stroke="%s" stroke-width="2"/>' % (ox + gx * u, oy + gy * u, u, u, FILL, EDGE))
    return "".join(out)


def svg_2350():
    u = 40.0
    p = [head("-16 -26 430 330", "道の上でサイコロをころがす（●は出発のサイコロ）")]
    # A の道： 出発(0,0) → 右右 → 下下 → 右右
    cellsA = [(1, 0), (2, 0), (2, 1), (2, 2), (3, 2), (4, 2)]
    p.append(path_svg(cellsA, None, (4, 2), 20.0, 60.0, u))
    p.append(die(20.0, 60.0 + u, u * 1.0, 2, 3, 1))
    p.append(txt(20 + 4.5 * u, 60 + 2.6 * u, "A", "middle", 15, EDGE))
    # B の道： 出発(0,0) → 右右右 → 下下 → 左
    ox2 = 235.0
    cellsB = [(1, 0), (2, 0), (3, 0), (3, 1), (3, 2), (2, 2)]
    p.append(path_svg(cellsB, None, (2, 2), ox2, 60.0, u))
    p.append(die(ox2, 60.0 + u, u * 1.0, 1, 2, 3))
    p.append(txt(ox2 + 2.5 * u, 60 + 2.6 * u, "B", "middle", 15, EDGE))
    return "".join(p) + "</svg>"


out = {"HG-2343": svg_2343(), "HG-2344": svg_2344(), "HG-2345": svg_2345(),
       "HG-2348": svg_2348(), "HG-2349": svg_2349(), "HG-2350": svg_2350(),
       "HG-2351": svg_2351()}
fn = os.path.join(BASE, "docs", "_svg_g4nadago_05.json")
io.open(fn, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
for k, v in out.items():
    print("%s  %5d文字  <text>%2d個  改行%d" % (k, len(v), v.count("<text"), v.count("\n")))
print("書いた:", fn)
