# -*- coding: utf-8 -*-
"""小5最レ（第3分冊 第1講座 No.22 / No.30）の大問16本の内容監査で出た不具合を直す。

  使い方:  python scripts/_fix_s5sairei_w4_3.py [対象JSON]
           （省略時は data/hama_daimon.json）

★冪等（何回流しても同じ結果）にしてある。
  判定は「欄まるごとの一致」でする：
    ・いまの値 == 直したあとの値  → 済み。何もしない
    ・いまの値 == 直す前の値      → 書きかえる
    ・どちらでもない              → 止める（勝手に上書きしない）
  文字列を継ぎ足す／うしろを削る、といった部分置換はしない。

★図SVGは、入れる前に座標から角度・長さ・個数を計算し、問題文の数値と
  合うことを verify_geometry() で確かめる。合わなければ1件も書かずに止める。
"""
import io, json, os, re, sys, math, hashlib

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
from genbo_common import iter_daimon   # ★大問の走査はここだけを使う


# ==========================================================================
# 1. 新しい図SVG
# ==========================================================================
RECT = '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="#4f9eff" stroke-width="1.4"/>'

# --- HG-3766 正面と真上から見た図（正面の段数が1段ずつ足りなかった） ---
F1 = [(222, 3), (200, 25), (222, 25), (200, 47), (222, 47), (244, 47),
      (200, 69), (222, 69), (244, 69)]                      # 正面 : 高さ 3,4,2
T1 = [(222, 105), (222, 127), (244, 127), (200, 149), (222, 149), (244, 149)]
SVG_3766 = ('<svg viewBox="0 0 400 175" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%">'
            '<text x="90" y="40" font-size="12" text-anchor="middle" fill="#c9d4f0">（正面からみた図）</text>'
            + "".join(RECT % (x, y, 22, 22) for x, y in F1) +
            '<text x="90" y="125" font-size="12" text-anchor="middle" fill="#c9d4f0">（真上からみた図）</text>'
            + "".join(RECT % (x, y, 22, 22) for x, y in T1) + '</svg>')

# --- HG-3767 同じ骨・段数が多い（正面も真上も足りなかった） ---
F2 = [(215, 8),
      (195, 28), (215, 28), (235, 28),
      (195, 48), (215, 48), (235, 48), (255, 48),
      (195, 68), (215, 68), (235, 68), (255, 68)]            # 正面 : 高さ 3,4,3,2
T2 = [(195, 110), (215, 110), (235, 110),
      (195, 130), (215, 130), (235, 130), (255, 130),
      (215, 150), (235, 150)]                                # 真上 : 3個/4個/2個
SVG_3767 = ('<svg viewBox="0 0 420 195" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%">'
            '<text x="85" y="45" font-size="12" text-anchor="middle" fill="#c9d4f0">（正面からみた図）</text>'
            + "".join(RECT % (x, y, 20, 20) for x, y in F2) +
            '<text x="85" y="135" font-size="12" text-anchor="middle" fill="#c9d4f0">（真上からみた図）</text>'
            + "".join(RECT % (x, y, 20, 20) for x, y in T2) + '</svg>')

# --- HG-3768 透明な小箱27個と赤い玉（○印の位置が実物と別物だった） ---
# 座標系 : x=左1..右3 / y=手前1..奥3 / z=下1..上3
BALLS = [(1, 3, 3), (2, 3, 3), (3, 2, 2), (2, 2, 1)]         # 実物から読み取った答え（4個）
def _front_xy(x, z):        # 正面の面（左上 45,75・1マス40）
    return (45 + 40 * (x - 0.5), 75 + 40 * (3 - z + 0.5))
def _top_xy(x, y):          # 真上の面（手前の辺 y=75、奥へ1マスごとに (+15,-15)）
    return (45 + 40 * (x - 0.5) + 15 * (y - 0.5), 75 - 15 * (y - 0.5))
def _side_xy(y, z):         # 真横の面（手前上 165,75 / 奥へ (+45,-45) / 下へ +120）
    a, b = (y - 0.5) / 3.0, (3 - z + 0.5) / 3.0
    return (165 + 45 * a, 75 - 45 * a + 120 * b)
def _build_3768():
    o = ['<svg viewBox="0 0 300 210" xmlns="http://www.w3.org/2000/svg" '
         'style="display:block;margin:0 auto;max-width:100%">']
    for cx in (45, 85, 125):                      # 正面の9マス
        for cy in (75, 115, 155):
            o.append(RECT % (cx, cy, 40, 40))
    for x0 in (45, 85, 125, 165):                 # 真上の面 奥ゆき方向の線
        o.append('<line x1="%s" y1="75" x2="%s" y2="30" stroke="#4f9eff" stroke-width="1.2"/>' % (x0, x0 + 45))
    for k in range(4):                            # 真上の面 横方向の線
        o.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="1.2"/>'
                 % (45 + 15 * k, 75 - 15 * k, 165 + 15 * k, 75 - 15 * k))
    for y0 in (75, 115, 155, 195):                # 真横の面 高さ方向の線
        o.append('<line x1="165" y1="%s" x2="210" y2="%s" stroke="#4f9eff" stroke-width="1.2"/>' % (y0, y0 - 45))
    o.append('<line x1="210" y1="30" x2="210" y2="150" stroke="#4f9eff" stroke-width="1.2"/>')
    for a in (15, 30):                            # ★真横の面の奥ゆきの区切り（前は無くて読めなかった）
        o.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="1.2"/>'
                 % (165 + a, 75 - a, 165 + a, 195 - a))
    for (x, z) in sorted({(b[0], b[2]) for b in BALLS}):
        cx, cy = _front_xy(x, z)
        o.append('<circle cx="%s" cy="%s" r="6" fill="#ffd166"/>' % (round(cx, 1), round(cy, 1)))
    for (x, y) in sorted({(b[0], b[1]) for b in BALLS}):
        cx, cy = _top_xy(x, y)
        o.append('<circle cx="%s" cy="%s" r="5" fill="#ffd166"/>' % (round(cx, 1), round(cy, 1)))
    for (y, z) in sorted({(b[1], b[2]) for b in BALLS}):
        cx, cy = _side_xy(y, z)
        o.append('<circle cx="%s" cy="%s" r="5" fill="#ffd166"/>' % (round(cx, 1), round(cy, 1)))
    o.append('<text x="150" y="205" font-size="10" text-anchor="middle" fill="#9aa3c0">'
             '透明な小箱27個（3段）・玉が見える所に○印</text></svg>')
    return "".join(o)
SVG_3768 = _build_3768()


# --- HG-3648 長方形のテープの折り返し（(1)(2)とも実物と別の形になっていた） ---
def _build_3648():
    o = ['<svg viewBox="0 0 460 230" xmlns="http://www.w3.org/2000/svg" '
         'style="display:block;margin:0 auto;max-width:100%">']
    o.append('<text x="15" y="26" font-size="13" text-anchor="start" fill="#c9d4f0">(1)</text>')
    o.append('<line x1="45" y1="42" x2="186" y2="42" stroke="#9aa3c0" stroke-width="1.1" stroke-dasharray="5,3"/>')
    o.append('<line x1="186" y1="42" x2="186" y2="152" stroke="#9aa3c0" stroke-width="1.1" stroke-dasharray="5,3"/>')
    o.append('<line x1="72.7" y1="152" x2="186" y2="152" stroke="#9aa3c0" stroke-width="1.1" stroke-dasharray="5,3"/>')
    o.append('<line x1="45" y1="42" x2="45" y2="152" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<line x1="45" y1="152" x2="72.7" y2="152" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<line x1="45" y1="42" x2="186" y2="152" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<line x1="45" y1="42" x2="79.4" y2="178.8" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<line x1="79.4" y1="178.8" x2="186" y2="152" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<text x="171" y="121" font-size="12" text-anchor="middle" fill="#c9d4f0">52°</text>')
    o.append('<text x="91" y="128" font-size="14" text-anchor="middle" fill="#ffd166">x</text>')
    o.append('<text x="112" y="208" font-size="10" text-anchor="middle" fill="#9aa3c0">点線はもとのテープ</text>')
    o.append('<text x="265" y="26" font-size="13" text-anchor="start" fill="#c9d4f0">(2)</text>')
    o.append('<line x1="270" y1="105" x2="310.9" y2="105" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<line x1="310.9" y1="105" x2="415.3" y2="105" stroke="#9aa3c0" stroke-width="1.1" stroke-dasharray="5,3"/>')
    o.append('<line x1="270" y1="105" x2="270" y2="185" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<line x1="270" y1="185" x2="378" y2="185" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<line x1="378" y1="185" x2="415.3" y2="105" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<line x1="415.3" y1="105" x2="348" y2="24.8" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<line x1="348" y1="24.8" x2="286.7" y2="76.2" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<line x1="286.7" y1="76.2" x2="378" y2="185" stroke="#4f9eff" stroke-width="2"/>')
    o.append('<text x="325" y="74" font-size="12" text-anchor="middle" fill="#c9d4f0">130°</text>')
    o.append('<text x="390" y="121" font-size="14" text-anchor="middle" fill="#ffd166">x</text>')
    o.append('<text x="330" y="208" font-size="10" text-anchor="middle" fill="#9aa3c0">点線はもとのテープ</text>')
    o.append('</svg>')
    return "".join(o)
SVG_3648 = _build_3648()


# ---- 図の小道具（点・単位ベクトル・角の二等分方向・印） ----
def _pt(p, u, t):
    return (round(p[0] + u[0] * t, 1), round(p[1] + u[1] * t, 1))

def _unit(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    return (dx / L, dy / L)

def _bis(a, p, q, t):
    u, v = _unit(a, p), _unit(a, q)
    sx, sy = u[0] + v[0], u[1] + v[1]
    L = math.hypot(sx, sy)
    return _pt(a, (sx / L, sy / L), t)

def _ang(a, p, q):
    u, v = _unit(a, p), _unit(a, q)
    c = max(-1.0, min(1.0, u[0] * v[0] + u[1] * v[1]))
    return math.degrees(math.acos(c))

def _mark_o(c):
    return '<circle cx="%s" cy="%s" r="3.2" fill="none" stroke="#c9d4f0" stroke-width="1.3"/>' % c

def _mark_x(c):
    x, y = c
    a, b, e, f = round(x - 3.2, 1), round(y - 3.2, 1), round(x + 3.2, 1), round(y + 3.2, 1)
    return ('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#c9d4f0" stroke-width="1.3"/>'
            '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#c9d4f0" stroke-width="1.3"/>'
            % (a, b, e, f, e, b, a, f))

def _mark_tri(c, filled):
    x, y = c
    pts = "%s,%s %s,%s %s,%s" % (round(x, 1), round(y - 3.8, 1),
                                 round(x + 3.4, 1), round(y + 2.4, 1),
                                 round(x - 3.4, 1), round(y + 2.4, 1))
    if filled:
        return '<polygon points="%s" fill="#c9d4f0"/>' % pts
    return '<polygon points="%s" fill="none" stroke="#c9d4f0" stroke-width="1.2"/>' % pts

def _cross(a, b, c, d):
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = a, b, c, d
    den = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3)
    t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / den
    return (round(x1 + t * (x2 - x1), 2), round(y1 + t * (y2 - y1), 2))


# --- HG-3650 印を文字におきかえる消去算（○×△▲の印が1つも無く、線が辺の上に無かった）---
def _build_3650():
    r = math.radians
    L, R = (30.0, 190.0), (240.0, 190.0)
    base = R[0] - L[0]
    aL, aR = r(64.0), r(28.0)
    dLT = base * math.sin(aR) / math.sin(math.pi - aL - aR)
    T = (round(L[0] + dLT * math.cos(aL), 2), round(L[1] - dLT * math.sin(aL), 2))
    LP = base * math.sin(r(14.0)) / math.sin(r(102.0))
    P = (round(L[0] + LP * math.cos(aL), 2), round(L[1] - LP * math.sin(aL), 2))
    RQ = base * math.sin(r(32.0)) / math.sin(r(120.0))
    ur = _unit(R, T)
    Q = (round(R[0] + ur[0] * RQ, 2), round(R[1] + ur[1] * RQ, 2))
    Z = _cross(L, Q, P, R)
    o = ['<svg viewBox="0 0 470 250" xmlns="http://www.w3.org/2000/svg" '
         'style="display:block;margin:0 auto;max-width:100%">',
         '<text x="15" y="24" font-size="13" text-anchor="start" fill="#c9d4f0">(1)</text>',
         '<polygon points="%s,%s %s,%s %s,%s" fill="none" stroke="#4f9eff" stroke-width="2"/>' % (L + R + T),
         '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (L + Q),
         '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (P + R),
         _mark_o(_bis(L, T, Q, 30)), _mark_o(_bis(L, Q, R, 34)),
         _mark_x(_bis(R, T, P, 34)), _mark_x(_bis(R, P, L, 40)),
         '<text x="79" y="122" font-size="13" text-anchor="middle" fill="#ffd166">x</text>',
         '<text x="96" y="120" font-size="11" text-anchor="middle" fill="#c9d4f0">60°</text>',
         '<text x="%s" y="%s" font-size="13" text-anchor="middle" fill="#ffd166">y</text>' % _bis(Z, L, R, 30),
         '<line x1="59" y1="150" x2="44" y2="156" stroke="#9aa3c0" stroke-width="1"/>',
         '<text x="40" y="160" font-size="11" text-anchor="end" fill="#c9d4f0">102°</text>']
    L2, R2 = (315.0, 105.0), (425.0, 105.0)
    half = 55.0
    T2 = (370.0, round(105.0 - half * math.tan(r(54.0)), 2))
    M2 = (370.0, round(105.0 - half * math.tan(r(27.0)), 2))
    Y2 = (370.0, round(105.0 + half * math.tan(r(63.0)), 2))
    uL, uR = _unit(T2, L2), _unit(T2, R2)
    EL = (round(L2[0] + uL[0] * 30, 1), round(L2[1] + uL[1] * 30, 1))
    ER = (round(R2[0] + uR[0] * 30, 1), round(R2[1] + uR[1] * 30, 1))
    o += ['<text x="265" y="24" font-size="13" text-anchor="start" fill="#c9d4f0">(2)</text>',
          '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (L2 + R2),
          '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (T2 + EL),
          '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (T2 + ER),
          '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (L2 + M2),
          '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (M2 + R2),
          '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (L2 + Y2),
          '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (Y2 + R2),
          _mark_o(_bis(L2, T2, M2, 26)), _mark_o(_bis(L2, M2, R2, 30)),
          _mark_tri(_bis(L2, R2, Y2, 28), False), _mark_tri(_bis(L2, Y2, EL, 30), False),
          _mark_x(_bis(R2, T2, M2, 26)), _mark_x(_bis(R2, M2, L2, 30)),
          _mark_tri(_bis(R2, L2, Y2, 28), True), _mark_tri(_bis(R2, Y2, ER, 30), True),
          '<text x="370" y="56" font-size="13" text-anchor="middle" fill="#ffd166">x</text>',
          '<text x="370" y="96" font-size="11" text-anchor="middle" fill="#c9d4f0">126°</text>',
          '<text x="370" y="188" font-size="13" text-anchor="middle" fill="#ffd166">y</text>',
          '</svg>']
    return "".join(o), dict(L=L, R=R, T=T, P=P, Q=Q, Z=Z, L2=L2, R2=R2, T2=T2, M2=M2, Y2=Y2, EL=EL, ER=ER)
SVG_3650, G3650 = _build_3650()


# --- HG-3651 (2) 四角形の中の二等辺三角形（4つめの頂点が無く、答えの角が図に出せなかった）---
def _build_3651_tail():
    r = math.radians
    # 数学の座標（yは上向き）: B(0,0) C(1,0)。BA=70度・BD=10度・CA=125度・CE=95度
    B, C = (0.0, 0.0), (1.0, 0.0)
    def ray(p, deg, t):
        return (p[0] + t * math.cos(r(deg)), p[1] + t * math.sin(r(deg)))
    def inter(p, d1, q, d2):
        c1, s1 = math.cos(r(d1)), math.sin(r(d1))
        c2, s2 = math.cos(r(d2)), math.sin(r(d2))
        den = c1 * s2 - s1 * c2
        t = ((q[0] - p[0]) * s2 - (q[1] - p[1]) * c2) / den
        return (p[0] + t * c1, p[1] + t * s1)
    A = inter(B, 70.0, C, 125.0)
    D = ray(B, 10.0, 1.0)          # BD = BC = 1（二等辺三角形）
    E = ray(C, 95.0, 1.0)          # 右のはし CE 上に D がのる
    def sv(p):
        return (round(290 + 130 * p[0], 1), round(210 - 130 * p[1], 1))
    sA, sB, sC, sD, sE = sv(A), sv(B), sv(C), sv(D), sv(E)
    o = ['<text x="275" y="24" font-size="13" text-anchor="start" fill="#c9d4f0">(2)</text>',
         '<polygon points="%s,%s %s,%s %s,%s %s,%s" fill="none" stroke="#4f9eff" stroke-width="2"/>'
         % (sA + sE + sC + sB),
         '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (sA + sC),
         '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (sA + sD),
         '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (sB + sD),
         '<circle cx="%s" cy="%s" r="2.6" fill="#c9d4f0"/>' % sD,
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">A</text>' % (sA[0] - 8, sA[1] - 6),
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">E</text>' % (sE[0] + 7, sE[1] - 7),
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">B</text>' % (sB[0] - 7, sB[1] + 12),
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">C</text>' % (sC[0] + 7, sC[1] + 12),
         '<text x="%s" y="%s" font-size="12" text-anchor="start" fill="#c9d4f0">D</text>' % (sD[0] + 9, sD[1] + 1),
         '<text x="%s" y="%s" font-size="11" text-anchor="middle" fill="#c9d4f0">60°</text>' % _bis(sB, sA, sD, 32),
         '<line x1="336" y1="206" x2="330" y2="220" stroke="#9aa3c0" stroke-width="1"/>',
         '<text x="329" y="233" font-size="11" text-anchor="middle" fill="#c9d4f0">10°</text>',
         '<line x1="396" y1="204" x2="392" y2="220" stroke="#9aa3c0" stroke-width="1"/>',
         '<text x="390" y="233" font-size="11" text-anchor="middle" fill="#c9d4f0">55°</text>',
         '<line x1="415" y1="197" x2="434" y2="201" stroke="#9aa3c0" stroke-width="1"/>',
         '<text x="437" y="205" font-size="11" text-anchor="start" fill="#c9d4f0">30°</text>',
         '<text x="%s" y="%s" font-size="14" text-anchor="middle" fill="#ffd166">x</text>' % _bis(sD, sA, sE, 40),
         '</svg>']
    return "".join(o), dict(A=sA, B=sB, C=sC, D=sD, E=sE)
TAIL_3651, G3651 = _build_3651_tail()
MARK_3651 = '<text x="275" y="24" font-size="13" text-anchor="start" fill="#c9d4f0">(2)</text>'


# --- HG-3653 平行な補助線と二等辺三角形（D が辺ABの上に、E が辺BCの上に無かった）---
def _build_3653():
    r = math.radians
    A = (0.0, 0.0)
    C = (10 * math.cos(r(20.0)), 10 * math.sin(r(20.0)))      # AC = 10cm
    F = (6 * math.cos(r(66.0)), 6 * math.sin(r(66.0)))        # AF = 6cm・角FAC = 46度
    ub = (math.cos(r(133.0)), math.sin(r(133.0)))             # 角DAF = 67度
    B = (16 * ub[0], 16 * ub[1])
    def inter(p, u, q, v):
        den = u[0] * v[1] - u[1] * v[0]
        t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den
        return (p[0] + t * u[0], p[1] + t * u[1])
    D = inter(A, ub, F, (C[0] - F[0], C[1] - F[1]))           # 直線FC と 辺AB の交点
    uf = (F[0] / 6.0, F[1] / 6.0)
    E = inter(A, uf, B, (C[0] - B[0], C[1] - B[1]))           # 直線AF と 辺BC の交点
    def sv(p):
        return (round(40 + 12 * (p[0] + 10.912), 1), round(45 + 12 * p[1], 1))
    sA, sB, sC, sD, sE, sF = sv(A), sv(B), sv(C), sv(D), sv(E), sv(F)
    o = ['<svg viewBox="0 0 330 240" xmlns="http://www.w3.org/2000/svg" '
         'style="display:block;margin:0 auto;max-width:100%">',
         '<polygon points="%s,%s %s,%s %s,%s" fill="none" stroke="#4f9eff" stroke-width="2"/>' % (sB + sC + sA),
         '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (sD + sC),
         '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="#4f9eff" stroke-width="2"/>' % (sA + sE),
         '<circle cx="%s" cy="%s" r="3.5" fill="#ffd166"/>' % sF,
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">A</text>' % (sA[0], sA[1] - 8),
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">B</text>' % (sB[0] - 8, sB[1] + 14),
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">C</text>' % (sC[0] + 9, sC[1] - 4),
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">D</text>' % (sD[0] - 9, sD[1] - 4),
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">E</text>' % (sE[0] + 8, sE[1] + 13),
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">F</text>' % (sF[0] - 9, sF[1] - 6),
         '<text x="%s" y="%s" font-size="14" text-anchor="middle" fill="#ffd166">㋐</text>' % _bis(sA, sD, sF, 42),
         '<text x="%s" y="%s" font-size="12" text-anchor="middle" fill="#c9d4f0">46°</text>' % _bis(sA, sF, sC, 46),
         '<text x="165" y="222" font-size="10" text-anchor="middle" fill="#9aa3c0">'
         'AC＝10cm、AF＝6cm、DF:FC＝3:2</text>',
         '</svg>']
    return "".join(o), dict(A=sA, B=sB, C=sC, D=sD, E=sE, F=sF)
SVG_3653, G3653 = _build_3653()


# --- HG-3772 (2) 底面の円に直径の線が無く、半径か直径か分からなかった ---
MARK_3772 = '<circle cx="330" cy="172" r="26" fill="none" stroke="#4f9eff" stroke-width="1.6"/>'
TAIL_3772 = (MARK_3772 +
             '<line x1="304" y1="172" x2="356" y2="172" stroke="#9aa3c0" stroke-width="1.1"/>'
             '<line x1="304" y1="168.5" x2="304" y2="175.5" stroke="#9aa3c0" stroke-width="1.1"/>'
             '<line x1="356" y1="168.5" x2="356" y2="175.5" stroke="#9aa3c0" stroke-width="1.1"/>'
             '<text x="330" y="190" font-size="11" text-anchor="middle" fill="#ffd166">x cm</text></svg>')

# --- HG-3773 (2) 「15cm」が母線まるごとの寸法になっていて「母線20cm」と食いちがっていた ---
MARK_3773 = '<text x="245" y="25" font-size="12" text-anchor="middle" fill="#c9d4f0">(2)</text>'
TAIL_3773 = (MARK_3773 +
    '<line x1="245" y1="40" x2="205" y2="150" stroke="#4f9eff" stroke-width="1.8"/>'
    '<line x1="245" y1="40" x2="285" y2="150" stroke="#4f9eff" stroke-width="1.8"/>'
    '<path d="M205 150 A40 12 0 0 0 285 150" fill="none" stroke="#4f9eff" stroke-width="1.6"/>'
    '<path d="M205 150 A40 12 0 0 1 285 150" fill="none" stroke="#4f9eff" stroke-width="1.2" stroke-dasharray="5,4"/>'
    '<text x="245" y="34" font-size="12" text-anchor="middle" fill="#c9d4f0">O</text>'
    '<circle cx="205" cy="150" r="3" fill="#c9d4f0"/>'
    '<text x="198" y="166" font-size="11" text-anchor="end" fill="#c9d4f0">A</text>'
    '<circle cx="215" cy="122.5" r="3" fill="#c9d4f0"/>'
    '<text x="222" y="119" font-size="11" text-anchor="start" fill="#c9d4f0">B</text>'
    '<path d="M205 150 Q242 152 267 100" fill="none" stroke="#ffd166" stroke-width="2"/>'
    '<path d="M267 100 Q232 90 215 122.5" fill="none" stroke="#ffd166" stroke-width="1.5" stroke-dasharray="5,4"/>'
    '<line x1="234.7" y1="36.2" x2="204.7" y2="118.7" stroke="#9aa3c0" stroke-width="1.1"/>'
    '<line x1="233.5" y1="39.5" x2="235.9" y2="32.9" stroke="#9aa3c0" stroke-width="1.1"/>'
    '<line x1="203.5" y1="122" x2="205.9" y2="115.4" stroke="#9aa3c0" stroke-width="1.1"/>'
    '<text x="211" y="74" font-size="11" text-anchor="middle" fill="#c9d4f0">15cm</text>'
    '<line x1="204.7" y1="118.7" x2="194.7" y2="146.2" stroke="#9aa3c0" stroke-width="1.1"/>'
    '<line x1="193.5" y1="149.5" x2="195.9" y2="142.9" stroke="#9aa3c0" stroke-width="1.1"/>'
    '<text x="191" y="130" font-size="11" text-anchor="middle" fill="#c9d4f0">5cm</text>'
    '<line x1="245.0" y1="172.0" x2="285.0" y2="172.0" stroke="#9aa3c0" stroke-width="1.1"/>'
    '<line x1="245.0" y1="168.5" x2="245.0" y2="175.5" stroke="#9aa3c0" stroke-width="1.1"/>'
    '<line x1="285.0" y1="168.5" x2="285.0" y2="175.5" stroke="#9aa3c0" stroke-width="1.1"/>'
    '<text x="265.0" y="182.4" font-size="11" text-anchor="middle" fill="#c9d4f0">5cm</text></svg>')


# ==========================================================================
# 2. 図を入れる前の検算（座標から数値を出して、問題文と合うか確かめる）
# ==========================================================================
def _near(a, b, tol=0.6):
    return abs(a - b) <= tol

def verify_geometry():
    msg = []
    # ---- HG-3766 正面(高さ3,4,2)と真上(6マス) → 12個以上19個以下
    fh = {}
    for x, y in F1:
        fh[x] = fh.get(x, 0) + 1
    assert fh == {200: 3, 222: 4, 244: 2}, fh
    cols = {}
    for x, y in T1:
        cols.setdefault(x, []).append(y)
    mx = sum(fh[x] * len(v) for x, v in cols.items())
    mn = sum(fh[x] + (len(v) - 1) for x, v in cols.items())
    assert (mn, mx) == (12, 19), (mn, mx)
    msg.append("HG-3766 正面の高さ=3,4,2 / 真上6マス → %d個以上%d個以下" % (mn, mx))
    # ---- HG-3767 正面(高さ3,4,3,2)と真上(9マス) → 最多29個・解答の最少の並べ方で16個
    fh2 = {}
    for x, y in F2:
        fh2[x] = fh2.get(x, 0) + 1
    assert fh2 == {195: 3, 215: 4, 235: 3, 255: 2}, fh2
    top2 = set(T2)
    assert len(top2) == 9
    mx2 = sum(fh2[x] for x, y in T2)
    assert mx2 == 29, mx2
    least = {(195, 110): 1, (215, 110): 1, (235, 110): 1,
             (195, 130): 3, (215, 130): 0, (235, 130): 1, (255, 130): 2,
             (215, 150): 4, (235, 150): 3}
    assert set(least) == top2
    colmax = {}
    for (x, y), v in least.items():
        colmax[x] = max(colmax.get(x, 0), v)
    assert colmax == fh2, (colmax, fh2)
    assert sum(least.values()) == 16
    msg.append("HG-3767 正面の高さ=3,4,3,2 / 真上9マス → 最多%d個・解答の最少の並べ方で16個" % mx2)
    # ---- HG-3768 3方向の○印から玉が1通りに決まり、4個になる
    top = {(b[0], b[1]) for b in BALLS}
    front = {(b[0], b[2]) for b in BALLS}
    side = {(b[1], b[2]) for b in BALLS}
    cand = [(x, y, z) for x in (1, 2, 3) for y in (1, 2, 3) for z in (1, 2, 3)
            if (x, y) in top and (x, z) in front and (y, z) in side]
    assert sorted(cand) == sorted(BALLS), cand
    assert len(cand) == 4
    assert (len(top), len(front), len(side)) == (4, 4, 3)
    msg.append("HG-3768 ○印 真上4・正面4・真横3 → 玉は1通りに決まり4個")
    # ---- HG-3648 折り返し (1)52度→x=104 / (2)130度→x=65
    TL, BR, TR = (45.0, 42.0), (186.0, 152.0), (186.0, 42.0)
    P1 = (72.7, 152.0)
    a52 = _ang(BR, TL, TR)
    a104 = _ang(P1, TL, (186.0, 152.0))
    assert _near(a52, 52), a52
    assert _near(a104, 104), a104
    Q2, S2, Se2, P2 = (415.3, 105.0), (378.0, 185.0), (286.7, 76.2), (310.9, 105.0)
    a130 = _ang(P2, Se2, Q2)
    a65 = _ang(Q2, P2, S2)
    assert _near(a130, 130), a130
    assert _near(a65, 65), a65
    msg.append("HG-3648 (1)52度→x=%.1f度 / (2)130度→x=%.1f度" % (a104, a65))
    # ---- HG-3650 (1)x=88・y=134・102度・60度 / (2)x=72・y=54・126度
    g = G3650
    assert _near(_ang(g["T"], g["L"], g["R"]), 88), _ang(g["T"], g["L"], g["R"])
    assert _near(_ang(g["Z"], g["L"], g["R"]), 134)
    assert _near(_ang(g["P"], g["L"], g["R"]), 102)
    assert _near(_ang(g["Q"], g["L"], g["T"]), 60)
    assert _near(_ang(g["L"], g["T"], g["R"]), 64)     # ○が2つ分
    assert _near(_ang(g["R"], g["T"], g["L"]), 28)     # ×が2つ分
    assert _near(_ang(g["T2"], g["L2"], g["R2"]), 72)
    assert _near(_ang(g["M2"], g["L2"], g["R2"]), 126)
    assert _near(_ang(g["Y2"], g["L2"], g["R2"]), 54)
    assert _near(_ang(g["L2"], g["R2"], g["M2"]) * 2, 54)          # ○+○
    assert _near(_ang(g["L2"], g["R2"], g["Y2"]) + _ang(g["L2"], g["Y2"], g["EL"]), 126)  # △+△
    msg.append("HG-3650 (1)x=88度・y=134度 / (2)x=72度・y=54度")
    # ---- HG-3651 (2) 60/10/55/30 と x=35
    h = G3651
    assert _near(_ang(h["B"], h["A"], h["D"]), 60)
    assert _near(_ang(h["B"], h["D"], h["C"]), 10)
    assert _near(_ang(h["C"], h["B"], h["A"]), 55)
    assert _near(_ang(h["C"], h["A"], h["E"]), 30)
    assert _near(_ang(h["D"], h["A"], h["B"]), 60)     # ☆（正三角形）
    x35 = _ang(h["D"], h["A"], h["E"])
    assert _near(x35, 35), x35
    d1 = math.hypot(h["D"][0] - h["E"][0], h["D"][1] - h["E"][1])
    d2 = math.hypot(h["D"][0] - h["C"][0], h["D"][1] - h["C"][1])
    d3 = math.hypot(h["E"][0] - h["C"][0], h["E"][1] - h["C"][1])
    assert _near(d1 + d2, d3, 1.0)                     # D は辺EC の上
    msg.append("HG-3651 (2) 60/10/55/30度 → x=%.1f度" % x35)
    # ---- HG-3653 AC=10・AF=6・DF:FC=3:2・46度 → ㋐=67度
    k = G3653
    AC = math.hypot(k["C"][0] - k["A"][0], k["C"][1] - k["A"][1])
    AF = math.hypot(k["F"][0] - k["A"][0], k["F"][1] - k["A"][1])
    DF = math.hypot(k["F"][0] - k["D"][0], k["F"][1] - k["D"][1])
    FC = math.hypot(k["C"][0] - k["F"][0], k["C"][1] - k["F"][1])
    assert _near(AF / AC, 0.6, 0.01), AF / AC
    assert _near(DF / FC, 1.5, 0.02), DF / FC
    assert _near(_ang(k["A"], k["F"], k["C"]), 46)
    ao = _ang(k["A"], k["D"], k["F"])
    assert _near(ao, 67), ao
    dAB = math.hypot(k["A"][0] - k["B"][0], k["A"][1] - k["B"][1])
    assert _near(math.hypot(k["A"][0] - k["D"][0], k["A"][1] - k["D"][1])
                 + math.hypot(k["D"][0] - k["B"][0], k["D"][1] - k["B"][1]), dAB, 0.5)
    dBC = math.hypot(k["B"][0] - k["C"][0], k["B"][1] - k["C"][1])
    assert _near(math.hypot(k["B"][0] - k["E"][0], k["B"][1] - k["E"][1])
                 + math.hypot(k["E"][0] - k["C"][0], k["E"][1] - k["C"][1]), dBC, 0.5)
    msg.append("HG-3653 AC:AF=10:6・DF:FC=%.2f・46度 → ㋐=%.1f度" % (DF / FC, ao))
    # ---- HG-3773 (2) 母線OA上に OB:BA = 3:1 の点B
    O, Bp, Ap = (245.0, 40.0), (215.0, 122.5), (205.0, 150.0)
    ob = math.hypot(O[0] - Bp[0], O[1] - Bp[1])
    ba = math.hypot(Bp[0] - Ap[0], Bp[1] - Ap[1])
    assert _near(ob / ba, 3.0, 0.05), ob / ba
    msg.append("HG-3773 (2) OB:BA=%.2f:1（母線20cm＝15cm+5cm）" % (ob / ba))
    return msg


# ==========================================================================
# 3. 直す中身（欄まるごとの一致で判定する）
# ==========================================================================
P = {}

P["hd5s_22k1_11"] = {
 "svg": ("set", "85df49ea83322e6c71c59204fcd3132b0977c9e2", SVG_3648),
 "steps": {
  0: {"meaning": (
      "①折り返すと52°と同じ大きさの角がもう1つできる。②長方形の対辺は平行なので、錯角を使うと38°の角が2つできる。③38×2+x＝180なのでx＝104度。",
      "①テープのはしの辺は下の辺と直角なので、折り目と下の辺がつくる角は90−52＝38度。②折り返すと、折り目をはさんで同じ38度の角がもう1つできる。③下の辺の上で38+x+38＝180になるので、x＝180−76＝104度。")},
  1: {"meaning": (
      "①折り目を境に130°の角と同じ角ができる。②錯角を使うと、xと同じ大きさの角が2つできる。③x+x＝130なのでx＝65度。",
      "①折り目をはさんで、同じ大きさの角が2つできる（折り返すと重なるから）。②テープの上下の辺は平行なので、錯角を使うとその角はxと同じ大きさになる。③折り返した辺がもとの辺とつくる130°は、この角2つ分だから x+x＝130。④x＝65度。")},
 }}

P["hd5s_22k1_13"] = {
 "svg": ("set", "5a9f49eb5d3cd6e8d6d7ada578fc2d90997ca8e5", SVG_3650),
 "steps": {
  1: {"question": (
      "図(2)の四角形で、同じ印の角度はそれぞれ等しい大きさを表します。○が1つと×が1つ分の角と126°の角を合わせると一直線（180°）になります。また、○が2つと△が2つ分の角の和は180°、×が2つと▲が2つ分の角の和も180°です。xとyの大きさを求めなさい。",
      "図(2)で、同じ印の角度はそれぞれ等しい大きさを表します。○が1つと×が1つ分の角と126°の角は、まん中の三角形の3つの角なので、合わせると180°になります。また、まっすぐな直線の上にならぶので、○が2つと△が2つ分の角の和は180°、×が2つと▲が2つ分の角の和も180°です。xとyの大きさを求めなさい。"),
      "meaning": (
      "①○＋×＋126＝180より○×の和は54。②三角形の内角の和からx＝180−54×2＝72度。③○○△△＝180より○△＝90、××▲▲＝180より×▲＝90。④四角形の内角の和360から126・90・90を引くとy＝360−(90+126+90)＝54度。",
      "①まん中の三角形で○＋×＋126＝180だから、○と×の和は54度。②いちばん大きい三角形の2つの底角は○が2つ分と×が2つ分なので、x＝180−54×2＝72度。③直線の上で○＋○＋△＋△＝180だから○＋△＝90度。同じように×＋▲＝90度。④よって△＋▲＝(90−○)＋(90−×)＝180−54＝126度。⑤いちばん下の三角形でy＝180−126＝54度。")},
 }}

P["hd5s_22k1_14"] = {
 "svg": ("tail", MARK_3651, TAIL_3651),
 "steps": {
  1: {"question": (
      "図の四角形ABCDで、60°、55°、10°、30°の角が示されています。角xの大きさを求めなさい。",
      "図(2)の四角形AECBで、辺ECの上に点Dがあります。角ABD＝60°、角DBC＝10°、角BCA＝55°、角ACE＝30°のとき、角xの大きさを求めなさい。"),
      "meaning": (
      "①角度を書き込むと、三角形BCDと三角形BCAはどちらも二等辺三角形になる。②三角形ABDは1つの角が60°の二等辺三角形なので正三角形とわかり、☆＝60度。③x＝180−(60+85)＝35度。",
      "①三角形ABCで角ABC＝60+10＝70度、角BCA＝55度だから、角BAC＝180−70−55＝55度。角BAC＝角BCAなのでBA＝BC（二等辺三角形）。②三角形BCDで角DBC＝10度、角BCD＝55+30＝85度だから、角BDC＝85度。角BCD＝角BDCなのでBC＝BD（二等辺三角形）。③よってBA＝BDで、角ABD＝60度だから三角形ABDは正三角形。④正三角形だから☆＝角ADB＝60度。⑤E、D、Cは一直線だから、x＝180−(60+85)＝35度。")},
 }}

P["hd5s_22k1_15"] = {
 "svg": ("subs", [
   ('<line x1="130" y1="60" x2="200" y2="190" stroke="#4f9eff" stroke-width="2"/>',
    '<line x1="130" y1="60" x2="200" y2="190" stroke="#4f9eff" stroke-width="2"/>'
    '<line x1="175" y1="80" x2="200" y2="190" stroke="#4f9eff" stroke-width="2"/>'),
   ('<text x="196" y="170" font-size="13" text-anchor="middle" fill="#ffd166">x</text>',
    '<line x1="192" y1="168" x2="206" y2="161" stroke="#9aa3c0" stroke-width="1"/>'
    '<text x="212" y="160" font-size="13" text-anchor="start" fill="#ffd166">x</text>'),
 ]),
 "steps": {
  0: {"meaning": (
      "①正三角形が2つあると、回転で重なる合同な三角形が見つかる。②75＝60+xの関係が成り立つ。③x＝15度。",
      "①正三角形なのでAB＝AC、AD＝AE。②角BAD＝角BAC−角CAD、角CAE＝角DAE−角CADで、角BAC＝角DAE＝60度だから角BAD＝角CAE。③2辺とその間の角が等しいので、三角形ABDと三角形ACEは合同。④よって角ABD＝角ACE＝75度。⑤角ABC＝60度（正三角形）だから、x＝角DBC＝75−60＝15度。")},
  1: {"meaning": (
      "①正方形が2つあると、回転で重なる合同な三角形が見つかる。②対応する角の関係からx＝45度とわかる。",
      "①正方形なのでAB＝AD、AE＝AG。角BAEと角DAGはどちらも「90度から角DAEをひいた角」なので等しく、三角形ABEと三角形ADGは合同になる。②正方形の対角線は角を2等分するので45度の角ができる。③xはその45度と対応する角なので、x＝45度。")},
 }}

P["hd5s_22k1_16"] = {
 "svg": ("set", "fdbed044fa85d592fc0ac5c5f5352373159468e2", SVG_3653),
 "steps": {
  0: {"meaning": (
      "①ADと平行な補助線FGを引くと、DF:FC＝3:2よりAG:GCも3:2になり、AGの長さは6cm（AFと同じ）とわかる。②AF＝AGより、斜線の三角形は二等辺三角形。③(180−46)÷2＝67度。",
      "①点Fを通ってADに平行な線をひき、ACとの交わる点をGとする。②平行線で分けられるので、DF:FC＝3:2よりAG:GC＝3:2。AC＝10cmだからAG＝10×3/5＝6cm。③AF＝6cmなのでAF＝AGとなり、三角形AFGは二等辺三角形。④頂角は46°だから底角は(180−46)÷2＝67度で、角AFG＝67度。⑤ADとFGは平行だから、錯角より㋐＝角AFG＝67度。")},
 }}


P["hd5s_30k1_1"] = {"svg": ("set", "50cfe8b3b1446fbab375ced43ce31de1a9f594db", SVG_3766)}
P["hd5s_30k1_2"] = {"svg": ("set", "26ed97a90444aa999e923f01ab750f2831ad4c8c", SVG_3767)}
P["hd5s_30k1_3"] = {"svg": ("set", "818e15cf80f8626036900856e5b4fc2c171e366c", SVG_3768)}

P["hd5s_30k1_4"] = {
 "svg": ("tail", MARK_3772, TAIL_3772),
 "steps": {
  1: {"question": (
      "中心角60度、母線12cmの円すいがあります。この円すいの底面の半径は何cmですか。",
      "中心角60度、母線12cmの円すいがあります。この円すいの底面の円の直径（図の(2)のx）は何cmですか。"),
      "meaning": (
      "①側面のおうぎ形の弧の長さ＝底面の円周になる。②12×2×3.14×60/360＝x×3.14×360/360の式を作り、24×60＝x×360と整理する。③x＝4。→ 4cm。",
      "①側面のおうぎ形の弧の長さ＝底面の円周になる。②弧の長さは12×2×3.14×60/360＝4×3.14(cm)。③底面の円周は（直径）×3.14なので、（直径）×3.14＝4×3.14より直径＝4cm。（半径にすると2cmなので、直径を聞かれていることに注意）")},
 }}

P["hd5s_30k1_5"] = {
 "svg": ("tail", MARK_3773, TAIL_3773),
 "steps": {
  0: {"question": (
      "母線24cm、底面の半径4cmの円すいで、点Aから側面に1周ひもを巻きつけるとき、ひもの長さが最も短いときは何cmですか。",
      "母線24cm、底面の半径4cmの円すいで、底面のまわりの点Aから側面を1周させ、もとの点Aまでひもを巻きつけます。ひもの長さが最も短いときは何cmですか。")},
  1: {"question": (
      "母線20cm(OB＝15cm、BからAまで5cm)、底面の半径5cmの円すいで、点Aから側面に1周ひもを巻きつけるとき、ひもの長さが最も短いときは何cmですか。",
      "母線OAが20cm、底面の半径が5cmの円すいがあります。母線OAの上に、Aから5cmはなれた点B（OB＝15cm）があります。点Aから側面を1周させて点Bまでひもを巻きつけるとき、ひもの長さが最も短いときは何cmですか。"),
      "meaning": (
      "①展開図にして考える。②側面のおうぎ形の中心角は20×2×3.14×□/360＝5×2×3.14より□＝90度。③しゃ線部分は3:4:5の直角三角形になり、④(20cm)にあたる部分が20cmなので、⑤にあたるひもの長さは25cm。",
      "①展開図にして考える。②側面のおうぎ形の中心角は20×2×3.14×□/360＝5×2×3.14より□＝90度。③展開図では、OA＝20cm・OB＝15cm・その間の角が90度の直角三角形ができ、ひもはABにあたる。④15:20＝3:4なので3:4:5の直角三角形。③にあたるのが15cm、④にあたるのが20cmだから、⑤にあたるひもABは25cm。")},
 }}

P["hd5s_30k1_6"] = {
 "svg": ("subs", [
   ('<line x1="55.0" y1="170.0" x2="95.0" y2="170.0" stroke="#9aa3c0" stroke-width="1.1"/>',
    '<line x1="75" y1="150" x2="95" y2="150" stroke="#4f9eff" stroke-width="1.3"/>'
    '<line x1="75.0" y1="170.0" x2="95.0" y2="170.0" stroke="#9aa3c0" stroke-width="1.1"/>'),
   ('<line x1="55.0" y1="166.5" x2="55.0" y2="173.5" stroke="#9aa3c0" stroke-width="1.1"/>',
    '<line x1="75.0" y1="166.5" x2="75.0" y2="173.5" stroke="#9aa3c0" stroke-width="1.1"/>'),
   ('<text x="75.0" y="180.4" font-size="11" text-anchor="middle" fill="#c9d4f0">4cm</text>',
    '<text x="85.0" y="180.4" font-size="11" text-anchor="middle" fill="#c9d4f0">4cm</text>'),
 ])}

_C7 = ["正六面体の面6、正八面体の頂点6、正十二面体の頂点20、正四面体の辺6、正二十面体の辺30",
       "正六面体の面8、正八面体の頂点6、正十二面体の頂点20、正四面体の辺6、正二十面体の辺30",
       "正六面体の面6、正八面体の頂点8、正十二面体の頂点20、正四面体の辺6、正二十面体の辺30",
       "正六面体の面6、正八面体の頂点6、正十二面体の頂点12、正四面体の辺6、正二十面体の辺30"]
_C7old = ["正六面体の面6、正八面体の頂点6、正十二面体の頂点20、正二十面体の辺30、正四面体の辺6、正六面体の辺12",
          "正六面体の面8、正八面体の頂点6、正十二面体の頂点20、正二十面体の辺30、正四面体の辺6、正六面体の辺12",
          "正六面体の面6、正八面体の頂点8、正十二面体の頂点20、正二十面体の辺30、正四面体の辺6、正六面体の辺12",
          "正六面体の面6、正八面体の頂点6、正十二面体の頂点12、正二十面体の辺30、正四面体の辺6、正六面体の辺12"]

P["hd5s_30k1_7"] = {
 "svg": ("subs", [
   ('<text x="230" y="165" font-size="10" text-anchor="middle" fill="#9aa3c0">面の数・頂点の数・辺の数の表をうめる</text>',
    '<text x="230" y="165" font-size="10" text-anchor="middle" fill="#9aa3c0">5つの正多面体（面・頂点・辺の数を数えてみよう）</text>'),
 ]),
 "intro": (
   "正多面体には、面の数と頂点の数と辺の数の間に決まった関係があります。頂点の数+面の数−辺の数＝2という関係（多面体の頂点・面・辺の定理）を使って、表のあいているところを埋めます。",
   "正多面体には、面の数と頂点の数と辺の数の間に決まった関係があります。まず図の正四面体で3つの数を数えて、その関係を見つけましょう。見つけた関係を使って、表のあいているところを求めます。"),
 "steps": {
  0: {"question": (
      "正六面体の面の数、正八面体の頂点の数、正十二面体の頂点の数、正二十面体の辺の数、正四面体の辺の数、正六面体の辺の数を、それぞれ求めなさい。",
      "表には次の数が入っています。正四面体…面4・頂点4／正六面体…頂点8・辺12／正八面体…面8・辺12／正十二面体…面12・辺30／正二十面体…面20・頂点12。あいているところ（正六面体の面の数、正八面体の頂点の数、正十二面体の頂点の数、正四面体の辺の数、正二十面体の辺の数）を、それぞれ求めなさい。"),
      "answer": (_C7old[0], _C7[0]),
      "choices": (_C7old, _C7),
      "meaning": (
      "①頂点の数+面の数−辺の数＝2という関係を使う。②正六面体は頂点8・辺12なので、面＝2−8+12＝6。③正八面体は面8・辺12なので、頂点＝2−8+12＝6。④正十二面体は面12・辺30なので、頂点＝2−12+30＝20。⑤正二十面体は頂点12・面20なので、辺＝12+20−2＝30。⑥正四面体は頂点4・面4なので、辺＝4+4−2＝6。⑦正六面体は頂点8・面6なので、辺＝8+6−2＝12。",
      "①図の正四面体を数えると面4・頂点4・辺6で、4+4−6＝2。どの正多面体でも「頂点の数+面の数−辺の数＝2」になる（ゴムでできた立体を平らにおしひろげると頂点+面−辺＝1になり、かくれて見えなくなった1面をたすと2になる）。②正六面体は頂点8・辺12が表にあるので、面＝2−8+12＝6。③正八面体は面8・辺12なので、頂点＝2−8+12＝6。④正十二面体は面12・辺30なので、頂点＝2−12+30＝20。⑤正四面体は面4・頂点4なので、辺＝4+4−2＝6。⑥正二十面体は面20・頂点12なので、辺＝20+12−2＝30。")},
 }}

P["hd5s_30k1_8"] = {
 "steps": {
  0: {"meaning": (
      "①もとの立方体(頂点8・面6・辺12)とくらべる表を作る。②面は、もとの6面にかどを切った跡の8面をたして6+8＝14面。③辺は、もとの辺12本のかたちが変わり、かどを切った跡に新しい辺が8×3本できるので12−12+8×3＝24本。④頂点は、もとの8個の頂点が消えて−8、そのかわりにもとの辺1本ごとに1個ずつ頂点ができるので+12、差し引き+4。8+4＝12個。",
      "①もとの立方体(頂点8・面6・辺12)とくらべる表を作る。②面は、もとの6面にかどを切った跡の8面をたして6+8＝14面。③切り口がもとの辺のまん中を通るので、もとの辺12本はすべてなくなり(−12)、かどを切った跡に三角形の辺が8×3＝24本できる。12−12+24＝24本。④頂点は、もとの8個の頂点が消えて−8、そのかわりにもとの辺1本ごとに1個ずつ頂点ができるので+12、差し引き+4。8+4＝12個。")},
 }}

P["hd5s_30k1_9"] = {
 "intro": (
   "サッカーボールは黒い五角形と白い六角形を組み合わせて作られています。白い正六角形は20個あります。",
   "サッカーボールは黒い五角形と白い六角形を組み合わせて作られています。白い正六角形は20個で、白い六角形1つのまわりには黒い五角形が3つならんでいます。")}


# ==========================================================================
# 4. 当てる
# ==========================================================================
class Stop(Exception):
    pass

def _sha1(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()

def apply_svg(cur, spec, where):
    """図SVGを直す。戻り値 (新しい値, 直したか)。"""
    kind = spec[0]
    if kind == "set":
        old_sha, new = spec[1], spec[2]
        if cur == new:
            return cur, False
        if _sha1(cur) != old_sha:
            raise Stop("%s: 図SVGが想定と別物（sha1=%s）" % (where, _sha1(cur)))
        return new, True
    if kind == "tail":
        marker, tail = spec[1], spec[2]
        n = cur.count(marker)
        if n != 1:
            raise Stop("%s: 目印が%d個（1個でないと切れない）" % (where, n))
        new = cur[:cur.index(marker)] + tail
        if cur == new:
            return cur, False
        return new, True
    if kind == "subs":
        out, hit = cur, False
        for old, new in spec[1]:
            if new in out:
                continue                       # もう当たっている
            n = out.count(old)
            if n != 1:
                raise Stop("%s: 置きかえ元が%d個（1個でないと当てない）" % (where, n))
            out = out.replace(old, new)
            hit = True
        return out, hit
    raise Stop("%s: 知らない直し方 %r" % (where, kind))

def apply_field(obj, key, pair, where):
    old, new = pair
    cur = obj.get(key)
    if cur == new:
        return False
    if cur != old:
        raise Stop("%s の %s が想定と別物" % (where, key))
    obj[key] = new
    return True

def main(argv):
    path = argv[1] if len(argv) > 1 else os.path.join(BASE, "data", "hama_daimon.json")
    for line in verify_geometry():
        print("  [検算] " + line)
    d = json.load(io.open(path, encoding="utf-8"))
    found, changed = {}, {}
    for it in iter_daimon(d):
        x = it["x"]
        i = x.get("id")
        if i in P:
            if i in found:
                raise Stop("id が重複している: %s" % i)
            found[i] = x
    missing = sorted(set(P) - set(found))
    if missing:
        raise Stop("大問が見つからない: %s" % ", ".join(missing))
    for i in sorted(P):
        x, spec = found[i], P[i]
        n = 0
        if "svg" in spec:
            new, hit = apply_svg(x.get("svg", ""), spec["svg"], i)
            if hit:
                x["svg"] = new
                n += 1
        if "intro" in spec:
            if apply_field(x, "intro", spec["intro"], i):
                n += 1
        for si, fields in spec.get("steps", {}).items():
            st = x["steps"][si]
            for k, pair in fields.items():
                if apply_field(st, k, pair, "%s 小問%d" % (i, si + 1)):
                    n += 1
        if n:
            changed[i] = n
    # 答えが選択肢のどれかと一字一句一致しているか（直したあとの見張り）
    for i, x in found.items():
        for si, st in enumerate(x.get("steps", [])):
            ch = st.get("choices")
            if ch and st.get("answer") not in ch:
                raise Stop("%s 小問%d: answer が choices にない" % (i, si + 1))
    if changed:
        io.open(path, "wb").write(json.dumps(d, ensure_ascii=False, indent=1).encode("utf-8"))
    for i in sorted(changed):
        print("  直した: %s（%d か所）" % (i, changed[i]))
    print("  大問 %d 本 / 直した箇所 %d か所" % (len(changed), sum(changed.values())))
    if not changed:
        print("  （すべて適用ずみ。書きこみなし）")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except Stop as e:
        print("止めました: %s" % e)
        sys.exit(1)
