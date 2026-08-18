# -*- coding: utf-8 -*-
"""小3マスター算数 第2分冊の図を描くための共通部品。

★図は原簿に無い。根拠は PDF の実物だけ（feedback_zu_wa_genbo_ni_nai）。
  ここにあるのは「描き方」だけで、形の情報はいっさい持たない。

作法（[[feedback_zu_wa_genbo_ni_nai]] 3・3.5 と [[feedback_include_diagrams]]）：
  - 線は #4f9eff、強調は #ffd166、うすい補助線・寸法線は #9aa3c0、文字は必ず fill を書く
  - ルートに style="display:block;margin:0 auto;max-width:100%"
  - 寸法は「その線分に沿った寸法線＋両端の爪＋中央のラベル」で示す（数字を浮かせない）
  - 角度は「頂点に小さい弧」を描いてから度数を添える
"""
import math
import re

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY, FILL = "#4f9eff", "#ffd166", "#c9d4f0", "#9aa3c0", "#24406e"


def r1(v):
    return round(float(v), 1)


def svg(w, h, body):
    return '<svg viewBox="0 0 %s %s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
        r1(w), r1(h), S, "".join(body) if isinstance(body, (list, tuple)) else body)


def t(x, y, s, fill=TX, size=13, anchor="middle", extra=""):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s"%s>%s</text>' % (
        r1(x), r1(y), size, anchor, fill, extra, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ""
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), stroke, w, d)


def rect(x, y, w, h, stroke=LINE, sw=2, fill="none"):
    return '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(x), r1(y), r1(w), r1(h), fill, stroke, sw)


def circ(cx, cy, r, stroke=LINE, w=2, fill="none"):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(cx), r1(cy), r1(r), fill, stroke, w)


def dot(cx, cy, r=3.2, fill=TX):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r1(cx), r1(cy), r1(r), fill)


def pts(seq):
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none"):
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        pts(seq), fill, stroke, w)


def polyline(seq, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ""
    return '<polyline points="%s" fill="none" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), stroke, w, d)


def path(d, stroke=LINE, w=2, fill="none", dash=None):
    da = ' stroke-dasharray="%s"' % dash if dash else ""
    return '<path d="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (d, fill, stroke, w, da)


# ── 角度まわり ───────────────────────────────────────────────
# 画面のy軸は下向きなので、「数学の角度（反時計まわり・右が0°）」から座標を作る関数を通す。

def pol(cx, cy, r, deg):
    """数学の角度degの向きに、中心(cx,cy)から距離rの点。y反転ずみ。"""
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy - r * math.sin(a))


def ray(cx, cy, deg, r, stroke=LINE, w=2, dash=None):
    x, y = pol(cx, cy, r, deg)
    return ln(cx, cy, x, y, stroke, w, dash)


def arc(cx, cy, r, a0, a1, stroke=HI, w=1.8):
    """a0→a1（数学の角度・反時計まわり）に弧を描く。"""
    span = (a1 - a0) % 360
    x0, y0 = pol(cx, cy, r, a0)
    x1, y1 = pol(cx, cy, r, a1)
    large = 1 if span > 180 else 0
    # y反転しているので、反時計まわり＝SVGでは sweep-flag 0
    return path("M %s %s A %s %s 0 %d 0 %s %s" % (r1(x0), r1(y0), r1(r), r1(r), large, r1(x1), r1(y1)),
                stroke, w)


def ang_label(cx, cy, r, a0, a1, s, fill=HI, size=13, pad=0):
    """a0→a1 の弧の中央に文字を置く。"""
    span = (a1 - a0) % 360
    x, y = pol(cx, cy, r + pad, a0 + span / 2.0)
    return t(x, y + 4.5, s, fill, size)


def ang(cx, cy, r, a0, a1, s=None, fill=HI, size=13, pad=13):
    out = [arc(cx, cy, r, a0, a1, fill)]
    if s is not None:
        out.append(ang_label(cx, cy, r, a0, a1, s, fill, size, pad))
    return out


def right_mark(cx, cy, a0, a1, size=11, stroke=GRAY):
    """直角のしるし（小さい四角）。a0とa1は直交する2方向。"""
    p1 = pol(cx, cy, size, a0)
    p3 = pol(cx, cy, size, a1)
    p2 = (p1[0] + p3[0] - cx, p1[1] + p3[1] - cy)
    return polyline([p1, p2, p3], stroke, 1.6)


# ── 寸法線（測っている線分に沿って引く・両端に爪・中央にラベル）───────────
def dim(x1, y1, x2, y2, label, off=14, stroke=GRAY, fill=TX, size=12, side=1):
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / L * off * side, dx / L * off * side
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tick = 4.0
    tx_, ty_ = -dy / L * tick, dx / L * tick
    out = [ln(ax, ay, bx, by, stroke, 1.2),
           ln(ax - tx_, ay - ty_, ax + tx_, ay + ty_, stroke, 1.2),
           ln(bx - tx_, by - ty_, bx + tx_, by + ty_, stroke, 1.2)]
    mx, my = (ax + bx) / 2 + nx * 0.75, (ay + by) / 2 + ny * 0.75
    out.append(t(mx, my + 4, label, fill, size))
    return out


def leader(lx, ly, tx, ty, s, fill=TX, size=14, stroke=GRAY):
    """図の外にラベルを置き、細い引き出し線で指す（角が細くて中に書けないとき）。"""
    return [ln(lx, ly, tx, ty, stroke, 1.1), t(lx, ly + 5, s, fill, size)]


def clock(cx, cy, r, hour, minute, face=LINE, hand=HI, txt=TX, show_hands=True):
    """文字ばんつきの時計。hour/minuteは時こく（短針は分ぶんも進む）。"""
    out = [circ(cx, cy, r, face, 2)]
    for i in range(60):
        a = 90 - i * 6
        r0 = r - (7 if i % 5 == 0 else 4)
        out.append(ln(*pol(cx, cy, r0, a), *pol(cx, cy, r, a), face, 1.6 if i % 5 == 0 else 0.8))
    for i in range(1, 13):
        a = 90 - i * 30
        x, y = pol(cx, cy, r - 20, a)
        out.append(t(x, y + 5, str(i), txt, 13))
    if show_hands:
        ma = 90 - minute * 6.0
        ha = 90 - (hour % 12 + minute / 60.0) * 30.0
        out.append(ln(cx, cy, *pol(cx, cy, r - 16, ma), hand, 2.6))
        out.append(ln(cx, cy, *pol(cx, cy, r - 40, ha), hand, 4.4))
        out.append(dot(cx, cy, 3.4, hand))
    return out


def tick_marks(x1, y1, x2, y2, n=1, size=5, stroke=HI):
    """辺の長さが等しいことを示す ／ ／／ のしるし。"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1.0
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    out = []
    for i in range(n):
        o = (i - (n - 1) / 2.0) * 5
        cx_, cy_ = mx + ux * o, my + uy * o
        out.append(ln(cx_ - nx * size - ux * size * 0.45, cy_ - ny * size - uy * size * 0.45,
                      cx_ + nx * size + ux * size * 0.45, cy_ + ny * size + uy * size * 0.45,
                      stroke, 1.6))
    return out


# ── 自己点検 ────────────────────────────────────────────────
DARK = ("#333", "#888", "#666", "#000", "#111", "#222", "#1a2340")


def selfcheck(figs, max_ratio=1.15):
    bad = []
    for hg, fig in sorted(figs.items()):
        vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', fig)
        if not vb:
            bad.append("%s: viewBoxが無い" % hg)
            continue
        w, h = float(vb.group(1)), float(vb.group(2))
        if h / w > max_ratio:
            bad.append("%s: viewBoxが縦長すぎ (%.2f)" % (hg, h / w))
        if "max-width" not in fig.split(">", 1)[0]:
            bad.append("%s: ルートに max-width が無い" % hg)
        for tag in re.findall(r"<text[^>]*>", fig):
            if "fill=" not in tag:
                bad.append("%s: fillの無い<text>" % hg)
                break
        for c in DARK:
            if ('fill="%s"' % c) in fig or ('stroke="%s"' % c) in fig:
                bad.append("%s: 暗すぎる色 %s" % (hg, c))
                break
    return bad


def write_genbo(figs, do_write, genbo_path):
    """原簿の各レコードの「- 図: …」行の直後に「- 図SVG: …」を入れる（あれば置きかえ）。"""
    import io
    s = io.open(genbo_path, encoding="utf-8").read()
    n = 0
    miss = []
    for hg, fig in sorted(figs.items()):
        pat = re.compile(r"(### 【%s】.*?\n(?:.*?\n)*?- 図: [^\n]*\n)(- 図SVG: [^\n]*\n)?" % hg)
        m = pat.search(s)
        if not m:
            miss.append(hg)
            continue
        s = s[:m.end(1)] + "- 図SVG: `%s`\n" % fig + s[m.end():]
        n += 1
    for hg in miss:
        print("  見つからない:", hg)
    print("原簿に図SVGを入れた: %d / %d" % (n, len(figs)))
    if do_write:
        io.open(genbo_path, "w", encoding="utf-8", newline="").write(s)
        print("✅ 原簿に書き込み完了")
    else:
        print("（--write を付けると実際に書き込みます）")
    return n


def net(cells, s, ox, oy, stroke=LINE, foldstroke=GRAY, sw=2, fsw=1.4):
    """展開図（グリッドの単位マスの集合）を描く。cells＝{(col,row), ...}。
    セル同士が接する辺は「折り目」として薄い点線、外周は実線にする。
    (col,row) は左上が(0,0)、rowは下向きが正。
    """
    cellset = set(cells)
    out = []
    seen = set()
    for (c, r) in cells:
        x0, y0 = ox + c * s, oy + r * s
        edges = [((x0, y0), (x0 + s, y0), (c, r - 1)),
                 ((x0 + s, y0), (x0 + s, y0 + s), (c + 1, r)),
                 ((x0, y0 + s), (x0 + s, y0 + s), (c, r + 1)),
                 ((x0, y0), (x0, y0 + s), (c - 1, r))]
        for (p1, p2, nb) in edges:
            key = tuple(sorted([p1, p2]))
            if key in seen:
                continue
            seen.add(key)
            if nb in cellset:
                out.append(ln(*p1, *p2, foldstroke, fsw, "5 4"))
            else:
                out.append(ln(*p1, *p2, stroke, sw))
    return out
