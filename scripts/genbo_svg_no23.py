# -*- coding: utf-8 -*-
"""第1講座 No.23「曲線図形(1)」の図（HG-3656〜3669／14本）を、PDFの実物を見て原簿に入れる。

★根拠：小5最レ算数 第3分冊 第1講座.pdf の PDF p13〜p18（本文p14〜p19）を
  200〜1500dpi で出して目視。原簿に図は入っていない（「図: あり」の一行だけ）ので
  ここが唯一の根拠。見えないものは描かない。

実物で確かめたこと（要点だけ）：
  大問3(1) … 一辺12cmの正三角形。中央の白い部分は「3辺の中点」を頂点とし、
              上は直線・下2辺は B中心/C中心の半径6cm弧が食い込んだ形。斜線は残り全部。
     (2)   … 一辺12cmの正方形。左下中心・半径12cmの4分円弧（左上→右下）と、
              左辺を直径とする半円（右にふくらむ）。その間が斜線。
     (3)   … 直径12cmの円。直径上に 4cm＋8cm。小円(直径4)の上半分と
              円(直径8)の下半分が境目の巴（ともえ）形。上側＋右下が斜線。
  大問4   … 半径6cmの4分円＋左辺の半円＋下辺の半円。外側の三日月だけ斜線。
  大問5   … 長方形ABCD(8×6)とECGF(6×8)。曲線AFはC中心・半径10cmの弧。
              A→D→E→F の上と弧の間が斜線。
  大問6   … 長方形ABCD（BC=14cm・AB=10cm）。OはBC上でBO=8cm・OC=6cm。
              半径10cmの弧はADに接し、ABをBから6cm、DCをCから8cmの高さで横切る。
              斜線は弧の上の左右2か所。
  大問7   … 大問4と同じ形の8cm版。三日月＋中央のレンズの両方が斜線。
  大問8(1) … 一辺10cmの正方形・対角線・左下中心の4分円・下辺の半円。斜線3か所。
     (2)   … 一辺8cmの正方形に直径4cmの円4つ。右上と左下の円だけ白（＝それ以外全部斜線）。
     (3)   … 一辺4cmの正方形。各辺を2cmずつに分け、直径2cmの半円8つを内向きに。
              四隅のレンズ4つ＋中央部が斜線。
     (4)   … 直径10cmの円の中に直径5cmの円4つ（上下左右）。花びら4枚＋外側4か所が斜線。
  大問9   … 一辺12cmの正三角形の各辺を直径とする半円3つを「内向き」に。
              3枚の葉が斜線、中央（3つの重なり）は白。
  大問10  … 半径8cmの円・12等分点。Aが上でB,C,…は左まわり。斜線は
              直径AG／弧A→L→K／弦KH／弧H→G で囲まれた部分。
  大問11(1)… 一辺2cmの正方形＋左上中心・右下中心の4分円のレンズ1枚
       (2) … 一辺4cmの正方形＋内向き半円4つ。四隅→中心のレンズ4枚。
  大問12  … 頂点を共有する中心角30度のおうぎ形2つ（対頂位置）。左が半径6cm・右が半径12cm。
  大問13  … 対角線20cmの正方形の各頂点を中心に半径10cmの円。となり合う円のレンズ
              4枚（正方形で切り取られる）が斜線。
  大問14(1)… AB=3cm・BC=4cm・AC=5cm（Bが直角）。ACを直径とする半円と、AB・BCの
              外側の半円。ヒポクラテスの月形2つが斜線。
       (2) … たて6cm・横8cmの長方形の外側に半円4つ＋4頂点を通る円（直径10cm）。
              半円が円からはみ出た月形4つが斜線。
  大問15  … 直角三角形ABC（Aが直角、AB=40・AC=30・BC=50）。AB・ACを直径とする
              半円がBC上の1点Hで交わる。A-Hのレンズと、BCの下の2か所が斜線。
  大問16  … 一辺3cmの正方形4つ（＝6cm四方）。左下中心・半径6cmの弧。斜線は
              弧と横中央線の交点P → 下辺中央Q → 右下すみ → 弧 で囲む部分。

使い方: python scripts/genbo_svg_no23.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'
FILL = 'rgba(255,209,102,0.22)'


def r2(v):
    return round(float(v), 1)


def t(x, y, s, fill=TX, size=13, anchor="middle"):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s">%s</text>' % (
        r2(x), r2(y), size, anchor, fill, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        r2(x1), r2(y1), r2(x2), r2(y2), stroke, w, d)


def rect(x, y, w, h, stroke=LINE, sw=2):
    return '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="%s" stroke-width="%s"/>' % (
        r2(x), r2(y), r2(w), r2(h), stroke, sw)


def dim(x1, y1, x2, y2, label, off=10, side=1, size=12):
    """2点間の寸法線（両端に短い爪）＋中央にラベル。offは図から離す量"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side   # 法線方向へずらす
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = -nx / off * 4, -ny / off * 4                 # 爪
    return "".join([
        ln(ax, ay, bx, by, GRAY, 1.2),
        ln(ax - tx, ay - ty, ax + tx, ay + ty, GRAY, 1.2),
        ln(bx - tx, by - ty, bx + tx, by + ty, GRAY, 1.2),
        t((ax + bx) / 2 + nx * 0.9, (ay + by) / 2 + ny * 0.9 + 4, label, TX, size),
    ])


def shade(d):
    return '<path d="%s" fill="%s" stroke="%s" stroke-width="2" fill-rule="evenodd"/>' % (
        d, FILL, HI)


def near(a_from, a_to):
    """a_to を a_from から ±180度以内に丸める"""
    while a_to - a_from > 180:
        a_to -= 360
    while a_from - a_to > 180:
        a_to += 360
    return a_to


class Cv(object):
    """算数座標（y上向き）→ 画面座標。origin(ox,oy)を原点に置き s倍して y を反転。
    ★算数座標で角度が増える＝画面では反時計回り＝SVGの sweep-flag 0
      （0°は右、90°は画面の上。右→上は画面では反時計回り）"""

    def __init__(self, ox, oy, s):
        self.ox, self.oy, self.s = ox, oy, s

    def P(self, x, y):
        return (self.ox + self.s * x, self.oy - self.s * y)

    def pt(self, cx, cy, r, a):
        a = math.radians(a)
        return (cx + r * math.cos(a), cy + r * math.sin(a))

    def M(self, x, y):
        p = self.P(x, y)
        return "M%s %s" % (r2(p[0]), r2(p[1]))

    def L(self, x, y):
        p = self.P(x, y)
        return "L%s %s" % (r2(p[0]), r2(p[1]))

    def A(self, cx, cy, r, a1, a2):
        x2, y2 = self.pt(cx, cy, r, a2)
        p = self.P(x2, y2)
        R = self.s * r
        sf = 0 if a2 > a1 else 1
        laf = 1 if abs(a2 - a1) > 180 else 0
        return "A%s %s 0 %d %d %s %s" % (r2(R), r2(R), laf, sf, r2(p[0]), r2(p[1]))

    def circle(self, cx, cy, r, stroke=LINE, w=2, dash=None):
        p = self.P(cx, cy)
        d = ' stroke-dasharray="%s"' % dash if dash else ''
        return '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" stroke-width="%s"%s/>' % (
            r2(p[0]), r2(p[1]), r2(self.s * r), stroke, w, d)

    def line(self, x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
        a, b = self.P(x1, y1), self.P(x2, y2)
        return ln(a[0], a[1], b[0], b[1], stroke, w, dash)

    def arc(self, cx, cy, r, a1, a2, stroke=LINE, w=2):
        p1 = self.P(*self.pt(cx, cy, r, a1))
        return '<path d="M%s %s %s" fill="none" stroke="%s" stroke-width="%s"/>' % (
            r2(p1[0]), r2(p1[1]), self.A(cx, cy, r, a1, a2), stroke, w)

    def dot(self, x, y, r=3, fill=TX):
        p = self.P(x, y)
        return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r2(p[0]), r2(p[1]), r, fill)

    def txt(self, x, y, s, fill=TX, size=13, anchor="middle", dx=0, dy=0):
        p = self.P(x, y)
        return t(p[0] + dx, p[1] + dy, s, fill, size, anchor)

    def dim(self, x1, y1, x2, y2, label, off=14, side=1, size=12):
        a, b = self.P(x1, y1), self.P(x2, y2)
        return dim(a[0], a[1], b[0], b[1], label, off, side, size)


FIGS = {}
R3 = math.sqrt(3)

# ══ 大問3（HG-3656）まわりの長さと面積 3題 ═══════════════════════════
_b = [t(290, 22, "斜線部分のまわりの長さと面積を求める（3題）", GRAY, 12)]
# (1) 一辺12cmの正三角形＋B中心・C中心の半径6cm弧
c = Cv(45, 225, 9.5)
tri = c.M(6, 6 * R3) + c.L(12, 0) + c.L(0, 0) + "Z"
hole = c.M(3, 3 * R3) + c.L(9, 3 * R3) + c.A(12, 0, 6, 120, 180) + c.A(0, 0, 6, 0, 60) + "Z"
_b += [
    shade(tri + " " + hole),
    c.arc(12, 0, 6, 120, 180), c.arc(0, 0, 6, 0, 60),
    c.dim(6, 6 * R3, 3, 3 * R3, "6cm", 13, 1),
    c.dim(0, 0, 6, 0, "6cm", 15, 1), c.dim(6, 0, 12, 0, "6cm", 15, 1),
    t(45, 112, "(1)", GRAY, 13, "start"),
]
# (2) 一辺12cmの正方形＋左下中心の4分円＋左辺の半円
c = Cv(215, 225, 9.5)
_b += [
    shade(c.M(0, 12) + c.A(0, 0, 12, 90, 0) + c.L(0, 0) + c.A(0, 6, 6, -90, 90) + "Z"),
    rect(215, 111, 114, 114),
    c.arc(0, 0, 12, 90, 0), c.arc(0, 6, 6, -90, 90),
    c.dim(0, 0, 0, 12, "12cm", 15, -1), c.dim(0, 0, 12, 0, "12cm", 15, 1),
    t(215, 100, "(2)", GRAY, 13, "start"),
]
# (3) 直径12cmの円＋直径上の 4cm と 8cm
c = Cv(405, 165, 9.5)
_b += [
    shade(c.M(0, 0) + c.A(2, 0, 2, 180, 0) + c.A(8, 0, 4, 180, 360) + c.A(6, 0, 6, 0, 180) + "Z"),
    c.circle(6, 0, 6),
    c.line(0, 0, 12, 0, GRAY, 1.6, "5 4"),
    c.arc(2, 0, 2, 180, 0), c.arc(8, 0, 4, 180, 360),
    c.dim(0, 0, 4, 0, "4cm", 16, 1), c.dim(4, 0, 12, 0, "8cm", 16, 1),
    t(405, 100, "(3)", GRAY, 13, "start"),
]
FIGS["HG-3656"] = '<svg viewBox="0 0 580 290" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問4（HG-3657）半径6cmの4分円＋半径3cmの半円2つ ═════════════════
c = Cv(120, 200, 22)
_b = [
    t(190, 22, "4分円と半円を組み合わせた図・斜線部分の面積", GRAY, 12),
    shade(c.M(0, 6) + c.A(0, 0, 6, 90, 0) + c.A(3, 0, 3, 0, 90) + c.A(0, 3, 3, 0, 90) + "Z"),
    c.line(0, 0, 0, 6), c.line(0, 0, 6, 0),
    c.arc(0, 0, 6, 90, 0), c.arc(0, 3, 3, 90, -90), c.arc(3, 0, 3, 180, 0),
    '<path d="%s" fill="none" stroke="%s" stroke-width="1.5"/>'
    % (c.M(0, 0.8) + c.L(0.8, 0.8) + c.L(0.8, 0), GRAY),
    c.dim(0, 0, 0, 6, "6cm", 15, -1),
    c.dot(3, 3, 3.2, HI),
]
FIGS["HG-3657"] = '<svg viewBox="0 0 380 250" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問7（HG-3660）8cm版・三日月＋レンズ ══════════════════════════
c = Cv(120, 200, 16.5)
_b = [
    t(190, 22, "4分円と半円を組み合わせた図・斜線部分の面積", GRAY, 12),
    shade(c.M(0, 8) + c.A(0, 0, 8, 90, 0) + c.A(4, 0, 4, 0, 90) + c.A(0, 4, 4, 0, 90) + "Z"),
    shade(c.M(0, 0) + c.A(4, 0, 4, 180, 90) + c.A(0, 4, 4, 0, -90) + "Z"),
    c.line(0, 0, 0, 8), c.line(0, 0, 8, 0),
    c.arc(0, 0, 8, 90, 0), c.arc(0, 4, 4, 90, -90), c.arc(4, 0, 4, 180, 0),
    c.dim(0, 0, 0, 8, "8cm", 15, -1), c.dim(0, 0, 8, 0, "8cm", 15, 1),
    c.dot(4, 4, 3.2, HI),
]
FIGS["HG-3660"] = '<svg viewBox="0 0 380 258" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問5（HG-3658）合同な長方形2つ＋C中心の弧AF ═════════════════════
c = Cv(75, 215, 17)
_b = [
    t(210, 22, "曲線AFはCを中心とする円の一部（長方形の対角線は10cm）", GRAY, 12),
    shade(c.M(0, 6) + c.A(8, 0, 10, 143.13, 53.13) + c.L(8, 8) + c.L(8, 6) + c.L(0, 6) + "Z"),
    rect(75, 215 - 6 * 17, 8 * 17, 6 * 17),
    rect(75 + 8 * 17, 215 - 8 * 17, 6 * 17, 8 * 17),
    c.arc(8, 0, 10, 143.13, 53.13),
    c.txt(0, 6, "A", TX, 13, "end", -7, -5), c.txt(0, 0, "B", TX, 13, "end", -7, 16),
    c.txt(8, 0, "C", TX, 13, "middle", -5, 18), c.txt(8, 6, "D", TX, 13, "start", 6, 17),
    c.txt(8, 8, "E", TX, 13, "end", -5, -6), c.txt(14, 8, "F", TX, 13, "start", 7, -3),
    c.txt(14, 0, "G", TX, 13, "start", 7, 17),
    c.dim(0, 0, 0, 6, "6cm", 15, -1), c.dim(0, 0, 8, 0, "8cm", 30, 1),
]
FIGS["HG-3658"] = '<svg viewBox="0 0 420 290" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問6（HG-3659）長方形＋O中心・半径10cmの弧 ═══════════════════════
c = Cv(120, 245, 15.5)
aL = math.degrees(math.atan2(6, -8))     # 弧が AB と交わる点 (0,6)
aR = math.degrees(math.atan2(8, 6))      # 弧が DC と交わる点 (14,8)
_b = [
    t(240, 22, "点Oを中心とした半径10cmの円の一部が長方形に重なっている", GRAY, 12),
    shade(c.M(0, 6) + c.L(0, 10) + c.L(8, 10) + c.A(8, 0, 10, 90, aL) + "Z"),
    shade(c.M(8, 10) + c.L(14, 10) + c.L(14, 8) + c.A(8, 0, 10, aR, 90) + "Z"),
    rect(120, 245 - 10 * 15.5, 14 * 15.5, 10 * 15.5),
    c.arc(8, 0, 10, aL, aR),
    c.dot(8, 0, 3.5, TX),
    c.txt(0, 10, "A", TX, 13, "end", -7, -5), c.txt(14, 10, "D", TX, 13, "start", 7, -5),
    c.txt(0, 0, "B", TX, 13, "end", -7, 16), c.txt(14, 0, "C", TX, 13, "start", 7, 16),
    c.txt(8, 0, "O", TX, 13, "middle", 0, 19),
    c.dim(0, 0, 0, 6, "6cm", 14, -1), c.dim(14, 0, 14, 8, "8cm", 14, 1),
    c.dim(0, 0, 8, 0, "8cm", 30, 1), c.dim(8, 0, 14, 0, "6cm", 30, 1),
]
FIGS["HG-3659"] = '<svg viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問8（HG-3661）はめこみ4連発 ═══════════════════════════════════
_b = [t(440, 22, "斜線部分の面積の和を求める（4題）", GRAY, 12)]
# (1) 一辺10cm・対角線・左下中心の4分円・下辺の半円
c = Cv(50, 210, 11)
d = math.sqrt(50)
_b += [
    shade(c.M(0, 10) + c.L(10, 10) + c.L(d, d) + c.A(0, 0, 10, 45, 90) + "Z"),
    shade(c.M(d, d) + c.L(5, 5) + c.A(5, 0, 5, 90, 0) + c.A(0, 0, 10, 0, 45) + "Z"),
    shade(c.M(0, 0) + c.A(5, 0, 5, 180, 90) + c.L(0, 0) + "Z"),
    rect(50, 100, 110, 110),
    c.line(0, 0, 10, 10), c.arc(0, 0, 10, 90, 0), c.arc(5, 0, 5, 180, 0),
    c.dim(10, 0, 10, 10, "10cm", 14, 1), c.dim(0, 0, 10, 0, "10cm", 14, 1),
    t(50, 88, "(1)", GRAY, 13, "start"),
]
# (2) 一辺8cm＋直径4cmの円4つ（右上と左下だけ白）
c = Cv(265, 210, 13.75)


def _circ_sub(cv, cx, cy, r):
    p = cv.P(cx, cy)
    R = cv.s * r
    return ("M%s %s a%s %s 0 1 0 %s 0 a%s %s 0 1 0 %s 0"
            % (r2(p[0] - R), r2(p[1]), r2(R), r2(R), r2(2 * R), r2(R), r2(R), r2(-2 * R)))


_b += [
    # 左上の円と右下の円（まるごと斜線）
    shade(_circ_sub(c, 2, 6, 2)), shade(_circ_sub(c, 6, 2, 2)),
    # 正方形の四すみ（辺の真ん中のすきまは斜線ではない）
    shade(c.M(0, 8) + c.L(2, 8) + c.A(2, 6, 2, 90, 180) + c.L(0, 8) + "Z"),
    shade(c.M(8, 8) + c.L(6, 8) + c.A(6, 6, 2, 90, 0) + c.L(8, 8) + "Z"),
    shade(c.M(8, 0) + c.L(6, 0) + c.A(6, 2, 2, -90, 0) + c.L(8, 0) + "Z"),
    shade(c.M(0, 0) + c.L(2, 0) + c.A(2, 2, 2, -90, -180) + c.L(0, 0) + "Z"),
    # 4つの円のまん中
    shade(c.M(4, 6) + c.A(6, 6, 2, 180, 270) + c.A(6, 2, 2, 90, 180)
          + c.A(2, 2, 2, 0, 90) + c.A(2, 6, 2, -90, 0) + "Z"),
    rect(265, 100, 110, 110),
    c.circle(2, 6, 2), c.circle(6, 6, 2), c.circle(2, 2, 2), c.circle(6, 2, 2),
    c.dim(0, 0, 0, 8, "8cm", 14, -1), c.dim(0, 0, 8, 0, "8cm", 14, 1),
    t(265, 88, "(2)", GRAY, 13, "start"),
]
# (3) 一辺4cm・各辺を2cmずつに分け内向きの直径2cm半円8つ
c = Cv(480, 210, 27.5)
_b += [
    shade(c.M(1, 3) + c.A(1, 4, 1, 270, 360) + c.A(3, 4, 1, 180, 270) + c.A(4, 3, 1, 180, 270)
          + c.A(4, 1, 1, 90, 180) + c.A(3, 0, 1, 90, 180) + c.A(1, 0, 1, 0, 90)
          + c.A(0, 1, 1, 0, 90) + c.A(0, 3, 1, 270, 360) + "Z"),
    shade(c.M(0, 4) + c.A(1, 4, 1, 180, 270) + c.A(0, 3, 1, 0, 90) + "Z"),
    shade(c.M(4, 4) + c.A(3, 4, 1, 0, -90) + c.A(4, 3, 1, 180, 90) + "Z"),
    shade(c.M(4, 0) + c.A(3, 0, 1, 0, 90) + c.A(4, 1, 1, 180, 270) + "Z"),
    shade(c.M(0, 0) + c.A(1, 0, 1, 180, 90) + c.A(0, 1, 1, 0, -90) + "Z"),
    rect(480, 100, 110, 110),
    c.arc(1, 4, 1, 180, 360), c.arc(3, 4, 1, 180, 360),
    c.arc(1, 0, 1, 180, 0), c.arc(3, 0, 1, 180, 0),
    c.arc(0, 3, 1, -90, 90), c.arc(0, 1, 1, -90, 90),
    c.arc(4, 3, 1, 90, 270), c.arc(4, 1, 1, 90, 270),
    c.dim(0, 2, 0, 4, "2cm", 14, -1), c.dim(0, 0, 0, 2, "2cm", 14, -1),
    c.dim(0, 0, 2, 0, "2cm", 14, 1), c.dim(2, 0, 4, 0, "2cm", 14, 1),
    t(480, 88, "(3)", GRAY, 13, "start"),
]
# (4) 直径10cmの円＋直径5cmの円4つ
c = Cv(755, 155, 11)
for k in range(4):
    a = 90.0 * k
    ca = c.pt(0, 0, 2.5, a)             # となり合う小円の中心（角度a）
    cb = c.pt(0, 0, 2.5, a + 90)        # 同（角度a+90）
    Ta = c.pt(0, 0, 5, a)               # 小円と大円の接点
    Tb = c.pt(0, 0, 5, a + 90)
    X = (ca[0] + cb[0], ca[1] + cb[1])  # 2つの小円のもう1つの交点
    # 花びら（レンズ）
    _b.append(shade(c.M(0, 0) + c.A(ca[0], ca[1], 2.5, a + 180, a + 90)
                    + c.A(cb[0], cb[1], 2.5, a, a - 90) + "Z"))
    # 大円と小円のあいだのすきま
    _b.append(shade(c.M(Ta[0], Ta[1]) + c.A(0, 0, 5, a, a + 90)
                    + c.A(cb[0], cb[1], 2.5, a + 90, a)
                    + c.A(ca[0], ca[1], 2.5, a + 90, a) + "Z"))
_b += [
    c.circle(0, 0, 5),
    c.circle(0, 2.5, 2.5), c.circle(2.5, 0, 2.5), c.circle(0, -2.5, 2.5), c.circle(-2.5, 0, 2.5),
    ln(700, 212, 700, 226, GRAY, 1.2, "3 3"), ln(810, 212, 810, 226, GRAY, 1.2, "3 3"),
    dim(700, 224, 810, 224, "10cm", 12, 1),
    t(700, 88, "(4)", GRAY, 13, "start"),
]
FIGS["HG-3661"] = '<svg viewBox="0 0 880 280" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問9（HG-3662）正三角形＋内向きの半円3つ ═══════════════════════
c = Cv(180, 230, 17)
h3 = 6 * R3            # 正三角形の高さ 10.392
_b = [
    shade(c.M(6, h3) + c.A(9, h3 / 2, 6, 120, 180) + c.A(6, 0, 6, 120, 60)
          + c.A(3, h3 / 2, 6, 0, 60) + "Z"),
    shade(c.M(0, 0) + c.A(6, 0, 6, 180, 120) + c.A(9, h3 / 2, 6, 180, 240)
          + c.A(3, h3 / 2, 6, 300, 240) + "Z"),
    shade(c.M(12, 0) + c.A(6, 0, 6, 0, 60) + c.A(3, h3 / 2, 6, 0, -60)
          + c.A(9, h3 / 2, 6, 240, 300) + "Z"),
    '<path d="%s" fill="none" stroke="%s" stroke-width="1.6"/>'
    % (c.M(6, h3) + c.L(12, 0) + c.L(0, 0) + "Z", LINE),
    c.dim(0, 0, 12, 0, "12cm", 20, 1),
    t(75, 118, "一辺12cmの", GRAY, 12), t(75, 136, "正三角形に", GRAY, 12),
    t(75, 154, "直径12cmの", GRAY, 12), t(75, 172, "半円3つを", GRAY, 12),
    t(75, 190, "内向きに", GRAY, 12),
]
FIGS["HG-3662"] = '<svg viewBox="0 0 480 285" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問10（HG-3663）円周12等分・A〜L ═══════════════════════════════
c = Cv(215, 140, 12)
NAMES = "ABCDEFGHIJKL"
ANG = {}
for i, nm in enumerate(NAMES):
    ANG[nm] = ((90 + 30 * i) + 180) % 360 - 180      # A が上、B・C… は左まわり
_b = [
    shade(c.M(*c.pt(0, 0, 8, ANG["A"])) + c.A(0, 0, 8, ANG["A"], ANG["K"])
          + c.L(*c.pt(0, 0, 8, ANG["H"])) + c.A(0, 0, 8, ANG["H"], ANG["G"])
          + c.L(*c.pt(0, 0, 8, ANG["A"])) + "Z"),
    c.circle(0, 0, 8),
    c.line(*(c.pt(0, 0, 8, ANG["A"]) + c.pt(0, 0, 8, ANG["G"]))),
    c.line(*(c.pt(0, 0, 8, ANG["K"]) + c.pt(0, 0, 8, ANG["H"]))),
    c.dot(0, 0, 3, TX), t(199, 145, "O", TX, 13, "end"),
    t(390, 122, "半径8cmの円", GRAY, 12), t(390, 140, "円周を12等分", GRAY, 12),
    t(390, 158, "する点A〜L", GRAY, 12),
]
for nm in NAMES:
    p = c.pt(0, 0, 8, ANG[nm])
    lp = c.pt(0, 0, 9.9, ANG[nm])
    _b.append(c.dot(p[0], p[1], 3.2, TX))
    _b.append(c.txt(lp[0], lp[1], nm, TX, 13, "middle", 0, 5))
FIGS["HG-3663"] = '<svg viewBox="0 0 460 280" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問11（HG-3664）正方形とおうぎ形の葉っぱ ══════════════════════
_b = [t(230, 22, "正方形とおうぎ形を組み合わせた図・斜線部分の面積", GRAY, 12)]
c = Cv(80, 200, 50)
_b += [
    shade(c.M(2, 2) + c.A(0, 2, 2, 0, -90) + c.A(2, 0, 2, 180, 90) + "Z"),
    rect(80, 100, 100, 100),
    c.arc(0, 2, 2, 0, -90), c.arc(2, 0, 2, 180, 90),
    c.dim(2, 0, 2, 2, "2cm", 15, 1),
    t(80, 88, "(1)", GRAY, 13, "start"),
]
c = Cv(270, 200, 25)
_b += [
    shade(c.M(0, 4) + c.A(2, 4, 2, 180, 270) + c.A(0, 2, 2, 0, 90) + "Z"),
    shade(c.M(4, 4) + c.A(2, 4, 2, 0, -90) + c.A(4, 2, 2, 180, 90) + "Z"),
    shade(c.M(4, 0) + c.A(2, 0, 2, 0, 90) + c.A(4, 2, 2, 180, 270) + "Z"),
    shade(c.M(0, 0) + c.A(2, 0, 2, 180, 90) + c.A(0, 2, 2, 0, -90) + "Z"),
    rect(270, 100, 100, 100),
    c.arc(2, 4, 2, 180, 360), c.arc(2, 0, 2, 180, 0),
    c.arc(0, 2, 2, -90, 90), c.arc(4, 2, 2, 90, 270),
    c.dim(4, 0, 4, 4, "4cm", 15, 1),
    t(270, 88, "(2)", GRAY, 13, "start"),
]
FIGS["HG-3664"] = '<svg viewBox="0 0 460 260" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問12（HG-3665）中心角30度のおうぎ形2つ（対頂） ═════════════════
c = Cv(180, 130, 11)
aU, aD = 19.0, -11.0
_b = [
    t(210, 22, "中心角30度の2つのおうぎ形（半径6cmと半径12cm）", GRAY, 12),
    shade(c.M(0, 0) + c.L(*c.pt(0, 0, 12, aU)) + c.A(0, 0, 12, aU, aD) + "Z"),
    shade(c.M(0, 0) + c.L(*c.pt(0, 0, 6, aU + 180)) + c.A(0, 0, 6, aU + 180, aD + 180) + "Z"),
    c.line(0, 0, *c.pt(0, 0, 12, aU)), c.line(0, 0, *c.pt(0, 0, 12, aD)),
    c.line(0, 0, *c.pt(0, 0, 6, aU + 180)), c.line(0, 0, *c.pt(0, 0, 6, aD + 180)),
    c.arc(0, 0, 12, aU, aD), c.arc(0, 0, 6, aU + 180, aD + 180),
    c.arc(0, 0, 2.6, aD, aU, HI, 1.4),
    c.dot(0, 0, 3.2, TX),
    c.dim(0, 0, *(c.pt(0, 0, 12, aU) + ("12cm", 14, -1))),
    c.dim(0, 0, *(c.pt(0, 0, 6, aD + 180) + ("6cm", 14, 1))),
    t(238, 133, "30°", HI, 12, "start"),
]
FIGS["HG-3665"] = '<svg viewBox="0 0 420 240" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問13（HG-3666）対角線20cmの正方形＋各頂点中心の半径10cmの円 ═════
c = Cv(220, 135, 13)
hh = 10 / math.sqrt(2)             # 半辺 ＝ 7.071
ee = 10 - hh                       # 円が辺と交わる位置（辺の中点から測って 2.929）
_b = [
    t(230, 22, "対角線20cmの正方形の各頂点を中心に半径10cmの円をえがいた", GRAY, 12),
    rect(220 - hh * 13, 135 - hh * 13, 2 * hh * 13, 2 * hh * 13),
]
for k in range(4):
    a = 90.0 * k
    ux, uy = math.cos(math.radians(a)), math.sin(math.radians(a))
    px, py = -uy, ux
    ca = (hh * ux + hh * px, hh * uy + hh * py)
    cb = (hh * ux - hh * px, hh * uy - hh * py)
    q2 = (hh * ux - ee * px, hh * uy - ee * py)      # ca中心の円が辺と交わる点
    q1 = (hh * ux + ee * px, hh * uy + ee * py)      # cb中心の円が辺と交わる点
    a0 = math.degrees(math.atan2(-ca[1], -ca[0]))
    a1 = near(a0, math.degrees(math.atan2(q2[1] - ca[1], q2[0] - ca[0])))
    b1 = math.degrees(math.atan2(q1[1] - cb[1], q1[0] - cb[0]))
    b0 = near(b1, math.degrees(math.atan2(-cb[1], -cb[0])))
    _b.append(shade(c.M(0, 0) + c.A(ca[0], ca[1], 10, a0, a1)
                    + c.L(q1[0], q1[1]) + c.A(cb[0], cb[1], 10, b1, b0) + "Z"))
_b += [c.dim(-hh, hh, -hh, hh - 10, "10cm", 15, 1)]
FIGS["HG-3666"] = '<svg viewBox="0 0 460 270" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問14（HG-3667）半円の重なり ═══════════════════════════════════
_b = [t(300, 22, "(1) 斜線部分の面積　(2) 長方形の外側の半円4つと外接円", GRAY, 12)]
# (1) AB=3・BC=4・AC=5（Bが直角）
c = Cv(70, 210, 30)
_b += [
    shade(c.M(0, 0) + c.A(0.9, 1.2, 1.5, 233.13, 53.13) + c.A(2.5, 0, 2.5, 106.26, 180) + "Z"),
    shade(c.M(1.8, 2.4) + c.A(3.4, 1.2, 2, 143.13, -36.87) + c.A(2.5, 0, 2.5, 0, 106.26) + "Z"),
    c.arc(2.5, 0, 2.5, 180, 0),
    c.arc(0.9, 1.2, 1.5, 233.13, 53.13), c.arc(3.4, 1.2, 2, 143.13, -36.87),
    '<path d="%s" fill="none" stroke="%s" stroke-width="1.6"/>'
    % (c.M(0, 0) + c.L(1.8, 2.4) + c.L(5, 0) + "Z", LINE),
    c.txt(0, 0, "A", TX, 13, "end", -7, 6), c.txt(5, 0, "C", TX, 13, "start", 7, 6),
    c.txt(1.8, 2.4, "B", TX, 13, "middle", 0, -9),
    c.dim(0, 0, 5, 0, "5cm", 15, 1),
    c.dim(0, 0, 1.8, 2.4, "3cm", 13, 1),
    c.dim(1.8, 2.4, 5, 0, "4cm", 13, 1),
    t(45, 105, "(1)", GRAY, 13, "start"),
]
# (2) たて6cm・横8cmの長方形＋外側の半円4つ＋外接円（直径10cm）
c = Cv(450, 140, 13)
_b += [
    shade(c.M(-4, 3) + c.A(0, 3, 4, 180, 0) + c.A(0, 0, 5, 36.87, 143.13) + "Z"),
    shade(c.M(4, -3) + c.A(0, -3, 4, 0, -180) + c.A(0, 0, 5, 216.87, 323.13) + "Z"),
    shade(c.M(-4, 3) + c.A(-4, 0, 3, 90, 270) + c.A(0, 0, 5, 216.87, 143.13) + "Z"),
    shade(c.M(4, -3) + c.A(4, 0, 3, -90, 90) + c.A(0, 0, 5, 36.87, -36.87) + "Z"),
    c.circle(0, 0, 5),
    c.arc(0, 3, 4, 180, 0), c.arc(0, -3, 4, 0, -180),
    c.arc(-4, 0, 3, 90, 270), c.arc(4, 0, 3, -90, 90),
    rect(450 - 4 * 13, 140 - 3 * 13, 8 * 13, 6 * 13),
    c.dim(-4, 3, 4, 3, "8cm", 10, 1),
    c.dim(-4, -3, -4, 3, "6cm", 12, 1),
    t(330, 60, "(2)", GRAY, 13, "start"),
]
FIGS["HG-3667"] = '<svg viewBox="0 0 600 270" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問15（HG-3668）直角三角形の2辺を直径とする半円 ═══════════════
c = Cv(80, 190, 4.0)
_b = [
    t(210, 22, "AB・ACを直径とする半円が辺BC上の1点で交わっている", GRAY, 12),
    shade(c.M(32, 24) + c.A(41, 12, 15, 126.87, 233.13) + c.A(16, 12, 20, -36.87, 36.87) + "Z"),
    shade(c.M(0, 0) + c.L(32, 0) + c.A(16, 12, 20, -36.87, -143.13) + "Z"),
    shade(c.M(32, 0) + c.L(50, 0) + c.A(41, 12, 15, 306.87, 233.13) + "Z"),
    c.arc(16, 12, 20, 36.87, -143.13), c.arc(41, 12, 15, 126.87, 306.87),
    '<path d="%s" fill="none" stroke="%s" stroke-width="1.8"/>'
    % (c.M(32, 24) + c.L(0, 0) + c.L(50, 0) + "Z", LINE),
    c.dot(32, 0, 3.5, HI),
    c.txt(32, 24, "A", TX, 13, "middle", 0, -9),
    c.txt(0, 0, "B", TX, 13, "end", -8, 0), c.txt(50, 0, "C", TX, 13, "start", 8, 0),
    c.dim(0, 0, 32, 24, "40cm", 15, -1), c.dim(32, 24, 50, 0, "30cm", 15, -1),
    c.dim(0, 0, 50, 0, "50cm", 40, 1),
]
FIGS["HG-3668"] = '<svg viewBox="0 0 420 280" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))

# ══ 大問16（HG-3669）3cm正方形4つ＋半径6cmのおうぎ形 ═══════════════
c = Cv(130, 205, 25)
_b = [
    t(230, 22, "一辺3cmの正方形4つの中に半径6cmのおうぎ形", GRAY, 12),
    shade(c.M(3 * R3, 3) + c.L(3, 0) + c.L(6, 0) + c.A(0, 0, 6, 0, 30) + "Z"),
    rect(130, 55, 150, 150),
    c.line(3, 0, 3, 6), c.line(0, 3, 6, 3),
    c.arc(0, 0, 6, 90, 0),
    c.dim(6, 3, 6, 6, "3cm", 15, 1), c.dim(6, 0, 6, 3, "3cm", 15, 1),
    c.dim(0, 0, 3, 0, "3cm", 15, 1), c.dim(3, 0, 6, 0, "3cm", 15, 1),
    t(378, 118, "おうぎ形の", GRAY, 12), t(378, 136, "中心は", GRAY, 12),
    t(378, 154, "左下のすみ", GRAY, 12),
]
FIGS["HG-3669"] = '<svg viewBox="0 0 440 270" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (
    S, "".join(_b))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
    p = find_genbo()
    s = io.open(p, encoding="utf-8").read()
    n = 0
    for hg, fig in FIGS.items():
        pat = re.compile(r"(### 【%s】.*?\n(?:.*?\n)*?- 図: [^\n]*\n)(- 図SVG: [^\n]*\n)?" % hg)
        m = pat.search(s)
        if not m:
            print("見つからない:", hg)
            continue
        s = s[:m.end(1)] + "- 図SVG: `%s`\n" % fig + s[m.end():]
        n += 1
    print("原簿に図SVGを入れた:", n, "/", len(FIGS))
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("✅ 原簿に書き込み完了")


if __name__ == "__main__":
    main()
