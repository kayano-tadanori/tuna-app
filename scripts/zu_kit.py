# -*- coding: utf-8 -*-
u"""図をSVGで組み立てるための どうぐ箱（浜学園の実物を再現するとき共通で使う）

  ★ここに置く理由（[[feedback_kansa_script_copy]]）
    同じ幾何・SVGのコードを 回ごとの生成スクリプトに写すと、
    片方だけ直したときに 静かに ずれる。**図の道具は この1か所だけ**にする。

  ★使い方の決まり
    ・図は「実物を見て 座標で組み立てる」。想像で描かない（[[feedback_zu_wa_genbo_ni_nai]]）
    ・印字してある角度・辺の長さは、**組み上げた座標から測り直して検算**する（must）
    ・20度以下の狭い角がある図は はじめから 1.5倍の大きさで作る
      （狭い角は扇形も狭く、等倍だと 15pxの数字が線に乗る・2026-09-05の実測）
"""
import math

# ---------------- 幾何のどうぐ ----------------
def P(x, y): return (float(x), float(y))

def polar(o, deg, r):
    u"""o から 数学の向き deg（反時計まわり）に r だけ進んだ点。画面は y が下向き"""
    a = math.radians(deg)
    return (o[0] + r * math.cos(a), o[1] - r * math.sin(a))

def ang_of(a, b):
    u"""a から b を見る向き（度・数学の向き＝反時計まわり・0〜360）"""
    return math.degrees(math.atan2(-(b[1] - a[1]), b[0] - a[0])) % 360

def angle_at(v, p, q):
    u"""頂点 v で p と q がはさむ角（0〜180度）"""
    d = abs(ang_of(v, p) - ang_of(v, q)) % 360
    return d if d <= 180 else 360 - d

def dist(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])

def unit(a, b):
    L = dist(a, b)
    return ((b[0] - a[0]) / L, (b[1] - a[1]) / L)

def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

def mid(a, b):
    return lerp(a, b, 0.5)

def rot_about(o, p, deg):
    u"""点 p を o のまわりに deg（数学の向き＝反時計まわり）だけ回した点"""
    return polar(o, ang_of(o, p) + deg, dist(o, p))

def inter(p1, p2, p3, p4):
    u"""直線 p1p2 と p3p4 の交点"""
    x1, y1 = p1; x2, y2 = p2; x3, y3 = p3; x4, y4 = p4
    d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(d) < 1e-9:
        raise ValueError(u"平行で交わらない")
    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / d
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / d
    return (px, py)

def shift(pts, dx, dy):
    u"""点の辞書 or 並びを まとめて ずらす"""
    if isinstance(pts, dict):
        return dict((k, (v[0] + dx, v[1] + dy)) for k, v in pts.items())
    return [(p[0] + dx, p[1] + dy) for p in pts]

def bbox(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)

# ---------------- 検算 ----------------
CHECKS = []

def must(label, got, want, tol=0.35):
    u"""図から測った値が 実物の印字と合うか。合わなければ その場で止める"""
    ok = abs(got - want) <= tol
    CHECKS.append((label, got, want, ok))
    if not ok:
        raise AssertionError(u"検算NG %s: 図から測ると %.3f、実物の印字は %s" % (label, got, want))
    return got

def check_report():
    ng = [c for c in CHECKS if not c[3]]
    return u"検算 %d 件（NG %d）" % (len(CHECKS), len(ng))

# ---------------- 色 ----------------
COL_LINE = "#8ab4ff"     # 図の線
COL_GIVEN = "#ffd166"    # 問題に印字してある角度・長さ
COL_ASK = "#7dd3fc"      # 聞かれている角（x, y）
COL_ARC = "#ffd166"
COL_ARC2 = "#7dd3fc"
COL_MARK = "#ff9ecb"     # ○● のしるし・点
COL_SUB = "#9aa7c7"      # 補助線


class Svg:
    def __init__(self, w, h):
        self.w, self.h, self.b = w, h, []

    def line(self, a, b, col=COL_LINE, wid=2, dash=None):
        d = ' stroke-dasharray="5 4"' if dash else ''
        self.b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%s" stroke-linecap="round"%s/>'
                      % (a[0], a[1], b[0], b[1], col, wid, d))

    def path(self, pts, col=COL_LINE, wid=2, close=False):
        for i in range(len(pts) - 1):
            self.line(pts[i], pts[i + 1], col, wid)
        if close:
            self.line(pts[-1], pts[0], col, wid)

    def poly(self, pts, col=COL_LINE, wid=2):
        s = ' '.join('%.1f,%.1f' % p for p in pts)
        self.b.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linejoin="round"/>' % (s, col, wid))

    def carc(self, c, a, b, sweep=1, large=0, col=COL_LINE, wid=2):
        u"""中心 c・始点 a・終点 b の 円弧（半径は |c-a|）。
           sweep=1 は 画面で 時計まわり（＝角度が ふえる向き）"""
        r = dist(c, a)
        self.b.append('<path d="M %.1f %.1f A %.1f %.1f 0 %d %d %.1f %.1f" fill="none" stroke="%s" stroke-width="%s"/>'
                      % (a[0], a[1], r, r, large, sweep, b[0], b[1], col, wid))

    def arc(self, v, p, q, r=22, col=COL_ARC, wid=2, labr=None):
        u"""頂点 v で p と q がはさむ角に 弧をひく。ラベルを置くべき点を返す。
           labr を渡すと ラベルの遠さだけ 別に決められる（弧は小さく・文字は外へ）"""
        a1, a2 = ang_of(v, p), ang_of(v, q)
        d = (a2 - a1) % 360
        if d > 180:
            a1, a2, d = a2, a1, 360 - d
        s = polar(v, a1, r); e = polar(v, a1 + d, r)
        self.b.append('<path d="M %.1f %.1f A %d %d 0 0 0 %.1f %.1f" fill="none" stroke="%s" stroke-width="%s"/>'
                      % (s[0], s[1], r, r, e[0], e[1], col, wid))
        # ★細い角ほど 頂点から遠くへラベルを出す。すきま = 2×距離×sin(半角)
        half = math.radians(d / 2)
        lab = labr if labr else max(r + 15, 12.0 / max(math.sin(half), 0.06))
        return polar(v, a1 + d / 2, lab)

    def right_angle(self, v, p, q, s=12, col=COL_LINE, wid=2):
        u"""頂点 v の 直角のしるし（小さい四角）"""
        u1 = unit(v, p); u2 = unit(v, q)
        a = (v[0] + u1[0] * s, v[1] + u1[1] * s)
        c = (v[0] + u2[0] * s, v[1] + u2[1] * s)
        m = (a[0] + u2[0] * s, a[1] + u2[1] * s)
        self.line(a, m, col, wid); self.line(m, c, col, wid)

    def text(self, p, s, col=COL_GIVEN, size=15, anchor="middle", italic=False):
        it = ' font-style="italic"' if italic else ''
        self.b.append('<text x="%.1f" y="%.1f" fill="%s" font-size="%d" text-anchor="%s" font-family="sans-serif" font-weight="bold"%s>%s</text>'
                      % (p[0], p[1] + size * 0.35, col, size, anchor, it, s))

    def vtext(self, v, away, s, off=17, col=COL_LINE, size=14):
        u"""頂点 v のラベルを、away（図の内がわ）と 反対の向きへ off だけ ずらして置く"""
        d = ang_of(away, v)
        self.text(polar(v, d, off), s, col, size)

    def seg_label(self, a, b, s, off=16, side=1, col=COL_GIVEN, size=14):
        u"""辺 a-b の よこに 長さのラベルを置く。side=+1/-1 で どちら側かを えらぶ"""
        m = mid(a, b)
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        n = (-dy / L * side, dx / L * side)
        self.text((m[0] + n[0] * off, m[1] + n[1] * off), s, col, size)

    def lead(self, anchor, lp, txt, col=COL_GIVEN, size=15):
        u"""角のそばから 引き出し線を のばして、図の外に ラベルを置く"""
        self.b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.5" stroke-linecap="round"/>'
                      % (anchor[0], anchor[1], lp[0], lp[1], col))
        self.text((lp[0] + (14 if lp[0] > anchor[0] else -14), lp[1] - 6), txt, col, size)

    def dot(self, p, filled=True, r=4.0, col=COL_MARK):
        f = col if filled else "#0b1020"
        self.b.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="%s" stroke-width="2"/>' % (p[0], p[1], r, f, col))

    def tick(self, a, b, n=1, col=COL_MARK, wid=2, L=7, gap=5):
        u"""辺 a-b のまん中に「等しい辺」のしるし（|・||・|||）を入れる"""
        m = mid(a, b)
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy)
        ux, uy = dx / d, dy / d
        nx, ny = -uy, ux
        for k in range(n):
            o = (k - (n - 1) / 2.0) * gap
            c = (m[0] + ux * o, m[1] + uy * o)
            self.b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%s" stroke-linecap="round"/>'
                          % (c[0] - nx * L, c[1] - ny * L, c[0] + nx * L, c[1] + ny * L, col, wid))

    def out(self):
        return ('<svg viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" '
                'style="display:block;margin:0 auto;max-width:100%%;height:auto">%s</svg>'
                % (self.w, self.h, ''.join(self.b)))
