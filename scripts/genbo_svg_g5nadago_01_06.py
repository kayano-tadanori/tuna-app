# -*- coding: utf-8 -*-
"""小5灘合 第1回 大問2（HG-2213）と 第6回 大問9（HG-2275）の図SVG。

   ★HG-2213：現物PDF（5年灘合_第1〜6回.pdf の p2）で A・B の位置を確認した。
     A＝左はしの立方体の「手前・上」、B＝右はしの立方体の「おく・下」。
     かくれた頂点（点線の交わる所）が「おく・下」であることから向きを決めた。
   ★HG-2275：現物PDF（同 p63）の展開図を測ったところ、
     六角形6面＋正三角形4面。六角形の直線の辺140px・ななめの辺198px＝比1.41（√2）で、
     「1辺2cmの正方形の対角の2すみを切った形」と確定。
     面の並びは 2cm方眼の上で C を中心に A(上)・B(左)・D(右)・E(下)、E の下に F。
     正三角形は C と F の ななめの辺に外向きに2つずつ。
   使い方: python scripts/genbo_svg_g5nadago_01_06.py  → docs/_svg_g5nadago_01_06.json
"""
import io, json, math, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINE, THIN, EDGE, FILL = "#4f9eff", "#7fb8ff", "#ffd166", "rgba(79,158,255,0.10)"
TTL, LBL, DASH = "#9aa3c0", "#c9d4f0", "#5b6b96"


def P(x, y, z, s, dx, dy, ky=0.52, kz=0.40):
    return (dx + (x + ky * y) * s, dy - (z + kz * y) * s)


def line(a, b, col=LINE, w=2.0, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ""
    return ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"%s/>'
            % (a[0], a[1], b[0], b[1], col, w, d))


def poly(pts, fill="none", stroke=LINE, w=2.0):
    return ('<polygon points="%s" fill="%s" stroke="%s" stroke-width="%.1f"/>'
            % (" ".join("%.1f,%.1f" % q for q in pts), fill, stroke, w))


def txt(x, y, s, anchor="middle", size=13, color=LBL):
    return ('<text x="%.1f" y="%.1f" font-size="%d" text-anchor="%s" fill="%s" '
            'font-weight="bold">%s</text>' % (x, y, size, anchor, color, s))


# ══════ HG-2213 立方体を3つくっつけた立体（A→B の最短） ══════
def svg_2213():
    NX, s = 3, 86.0
    dx, dy = 30.0, 26.0 + 1.40 * s + 34
    W, H = (NX + 0.52) * s + 74, 1.40 * s + 92
    pt = lambda x, y, z: P(x, y, z, s, dx, dy)
    p = ['<svg viewBox="-16 -24 %.0f %.0f" xmlns="http://www.w3.org/2000/svg" '
         'style="display:block;margin:0 auto;max-width:100%%">' % (W, H)]
    p.append('<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" fill="%s">%s</text>'
             % (-16 + W / 2, -24 + 16, TTL, "立方体を3つくっつけた立体（点線はかくれた辺）"))
    HID = [((x, 1, 0), (x + 1, 1, 0)) for x in range(NX)] + \
          [((0, 0, 0), (0, 1, 0)), ((0, 1, 0), (0, 1, 1))]
    hidset = set(HID)
    # すべての格子の辺（内部の仕切りもふくむ）
    for x in range(NX + 1):
        for y in range(2):
            for z in range(2):
                for d in ((1, 0, 0), (0, 1, 0), (0, 0, 1)):
                    b = (x + d[0], y + d[1], z + d[2])
                    if b[0] > NX or b[1] > 1 or b[2] > 1:
                        continue
                    a = (x, y, z)
                    hid = (a, b) in hidset
                    p.append(line(pt(*a), pt(*b), DASH if hid else LINE,
                                  1.5 if hid else 2.2, "7 5" if hid else None))
    A, B = pt(0, 0, 1), pt(NX, 1, 0)
    for q, nm, ax, ay, an in ((A, "A", -12, -8, "end"), (B, "B", 13, 6, "start")):
        p.append('<circle cx="%.1f" cy="%.1f" r="4.5" fill="%s"/>' % (q[0], q[1], EDGE))
        p.append(txt(q[0] + ax, q[1] + ay, nm, an, 16, EDGE))
    return "".join(p) + "</svg>"


# ══════ HG-2275 六角形6・正三角形4 の展開図 ══════
def hexagon(X, Y, cut):
    """2cm×2cmの正方形(左上がX,Y)から対角の2すみを切った六角形。cut='TLBR' or 'TRBL'"""
    if cut == "TLBR":
        return [(X, Y + 1), (X + 1, Y), (X + 2, Y), (X + 2, Y + 1), (X + 1, Y + 2), (X, Y + 2)]
    return [(X, Y), (X + 1, Y), (X + 2, Y + 1), (X + 2, Y + 2), (X + 1, Y + 2), (X, Y + 1)]


def svg_2275():
    u = 40.0
    HEX = [(2, 0, "TLBR"), (0, 2, "TLBR"), (2, 2, "TRBL"),
           (4, 2, "TLBR"), (2, 4, "TLBR"), (2, 6, "TRBL")]
    # 正三角形＝六角形C・F のななめの辺に外向きに付く。(辺の2点, 外向きの単位ベクトル)
    TRI = [((3, 2), (4, 3), (1, -1)), ((2, 3), (3, 4), (-1, 1)),
           ((3, 6), (4, 7), (1, -1)), ((2, 7), (3, 8), (-1, 1))]
    pts = []
    for X, Y, c in HEX:
        pts += hexagon(X, Y, c)
    tri3 = []
    h = math.sqrt(6) / 2.0                       # 1辺√2の正三角形の高さ
    for a, b, n in TRI:
        mx, my = (a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0
        nn = math.hypot(*n)
        c = (mx + h * n[0] / nn, my + h * n[1] / nn)
        tri3.append((a, b, c))
        pts += [a, b, c]
    x0 = min(q[0] for q in pts) - 0.35
    y0 = min(q[1] for q in pts) - 0.35
    x1 = max(q[0] for q in pts) + 0.35
    y1 = max(q[1] for q in pts) + 0.35
    W, H = (x1 - x0) * u, (y1 - y0) * u + 26
    Q = lambda q: ((q[0] - x0) * u, (q[1] - y0) * u + 26)
    p = ['<svg viewBox="0 0 %.0f %.0f" xmlns="http://www.w3.org/2000/svg" '
         'style="display:block;margin:0 auto;max-width:100%%">' % (W, H)]
    p.append('<text x="%.1f" y="16" font-size="12" text-anchor="middle" fill="%s">%s</text>'
             % (W / 2, TTL, "この展開図を組み立てる"))
    for X, Y, c in HEX:
        p.append(poly([Q(q) for q in hexagon(X, Y, c)], FILL, LINE, 2.0))
    for a, b, c in tri3:
        p.append(poly([Q(a), Q(b), Q(c)], FILL, LINE, 2.0))
    return "".join(p) + "</svg>"


out = {"HG-2213": svg_2213(), "HG-2275": svg_2275()}
fn = os.path.join(BASE, "docs", "_svg_g5nadago_01_06.json")
io.open(fn, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
for k, v in out.items():
    print("%s  %d文字  <text>%d個  改行%d" % (k, len(v), v.count("<text"), v.count("\n")))
print("書いた:", fn)
