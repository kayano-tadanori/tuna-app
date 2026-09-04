# -*- coding: utf-8 -*-
"""小4灘合 第3回 大問1・2・4・5・7 の図SVG（HG-2321/2322/2324/2325/2327）。

   座標はすべて現物PDF（G:/マイドライブ/浜問題/灘中合格特訓/4年灘合_第1〜6回.pdf の
   p24・p25・p27・p28・p30）の実測から起こした。
   ★HG-2322 の7つの頂点は、塗りつぶしの角の位置（侵食で抽出）と、
     どの頂点どうしに線があるか（線上のインク率）を機械判定して決めた。目で追っていない。
   使い方: python scripts/genbo_svg_g4nadago_03.py  → docs/_svg_g4nadago_03.json
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


def poly(pts):
    return " ".join("%.1f,%.1f" % q for q in pts)


def wedge(cx, cy, p1, p2, r=17, fill=EDGE):
    """cx,cy を頂点として、p1・p2 の向きにひらいた塗りつぶしの角（半径 r）"""
    a1 = math.atan2(p1[1] - cy, p1[0] - cx)
    a2 = math.atan2(p2[1] - cy, p2[0] - cx)
    d = (a2 - a1) % (2 * math.pi)
    if d > math.pi:
        a1, a2 = a2, a1
    x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
    x2, y2 = cx + r * math.cos(a2), cy + r * math.sin(a2)
    return ('<path d="M %.1f %.1f L %.1f %.1f A %.1f %.1f 0 0 1 %.1f %.1f Z" fill="%s"/>'
            % (cx, cy, x1, y1, r, r, x2, y2, fill))


def rt(x, y, dx, dy, s=11):
    """直角の記号（x,y を頂点に dx,dy の向きへ小さな四角）"""
    return ('<path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f" fill="none" '
            'stroke="%s" stroke-width="1.3"/>'
            % (x + dx * s, y, x + dx * s, y + dy * s, x, y + dy * s, THIN))


# ══════════ HG-2321 半径6cmの四分円・水平から20°と70° ══════════
def svg_2321():
    S = 34.0
    R = 6 * S
    a20, a70 = math.radians(20), math.radians(70)
    P20 = (R * math.cos(a20), -R * math.sin(a20))
    P70 = (R * math.cos(a70), -R * math.sin(a70))
    p = [head("-70 -258 320 316", "半径6cmの四分円と 50°・20°")]
    p.append('<path d="M %.1f 0 A %.1f %.1f 0 0 0 0 %.1f L 0 0 Z" fill="none" '
             'stroke="%s" stroke-width="2"/>' % (R, R, R, -R, LINE))
    # ★弧の向き（sweep=1）。0にすると別の円の弧をひろって面積が24%小さくなる（実測で発覚）
    p.append('<path d="M %.1f 0 L %.1f %.1f A %.1f %.1f 0 0 1 %.1f %.1f L %.1f 0 Z" '
             'fill="%s" stroke="%s" stroke-width="2"/>'
             % (P70[0], P70[0], P70[1], R, R, P20[0], P20[1], P20[0], FILL, EDGE))
    for P in (P20, P70):
        p.append('<line x1="0" y1="0" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.6"/>'
                 % (P[0], P[1], LINE))
        p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="0" stroke="%s" stroke-width="1.6"/>'
                 % (P[0], P[1], P[0], LINE))
    p.append(rt(P70[0], 0, -1, -1))
    p.append(rt(P20[0], 0, -1, -1))
    for r_, a, b, lab, lx, ly in ((60, a20, a70, "50°", 80, -66), (36, 0.0, a20, "20°", 62, 30)):
        p.append('<path d="M %.1f %.1f A %.1f %.1f 0 0 0 %.1f %.1f" fill="none" '
                 'stroke="%s" stroke-width="1.3"/>'
                 % (r_ * math.cos(a), -r_ * math.sin(a), r_, r_,
                    r_ * math.cos(b), -r_ * math.sin(b), THIN))
        p.append(txt(lx, ly, lab, size=13))
    p.append('<line x1="-12" y1="0" x2="-12" y2="%.1f" stroke="%s" stroke-width="1.2"/>' % (-R, THIN))
    p.append(txt(-18, -R / 2 + 4, "6cm", "end"))
    p.append(txt(-8, 18, "O", "end"))
    return "".join(p) + "</svg>"


# ══════════ HG-2322 黒い角の和（実測した7つの頂点） ══════════
G4V = {"V1": (595, 287), "V2": (829, 288), "V3": (999, 511), "V4": (1110, 933),
       "V5": (255, 958), "V6": (185, 470), "V7": (935, 1264)}
G4E = [("V1", "V2"), ("V2", "V3"), ("V2", "V7"), ("V3", "V4"),
       ("V3", "V6"), ("V4", "V5"), ("V5", "V1"), ("V6", "V7")]
# 黒い角＝閉じた7角形 V1-V2-V7-V6-V3-V4-V5 の内角（塗りの角度範囲の実測で確定）
G4MARK = [("V1", "V5", "V2"), ("V2", "V1", "V7"), ("V7", "V2", "V6"), ("V6", "V7", "V3"),
          ("V3", "V6", "V4"), ("V4", "V3", "V5"), ("V5", "V4", "V1")]


def svg_2322():
    k, ox, oy = 0.30, -50, -78
    V = {n: (x * k + ox, y * k + oy) for n, (x, y) in G4V.items()}
    p = [head("-26 -30 400 372", "ぬりつぶした7つの角")]   # ★図に三角形は無い／塗りは黒でない
    for a, b in G4E:
        p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2"/>'
                 % (V[a][0], V[a][1], V[b][0], V[b][1], LINE))
    for o, a, b in G4MARK:
        p.append(wedge(V[o][0], V[o][1], V[a], V[b], 17, EDGE))
    return "".join(p) + "</svg>"


# ══════════ HG-2324 1辺12cmの正方形の中の傾いた四角形 ══════════
def svg_2324():
    S = 24.0
    L = 12 * S
    t, l = 4.0, 5.5          # 上の頂点のx／左の頂点の高さ（見た目を原本に寄せた）
    T = (t * S, 0.0)
    R = (L, (12 - (l + 3)) * S)
    B = ((t + 2) * S, L)
    Lf = (0.0, (12 - l) * S)
    p = [head("-64 -34 430 406", "1辺12cmの正方形の中の四角形")]
    p.append('<rect x="0" y="0" width="%.1f" height="%.1f" fill="none" stroke="%s" '
             'stroke-width="2"/>' % (L, L, LINE))
    p.append('<polygon points="%s" fill="%s" stroke="%s" stroke-width="2"/>'
             % (poly([T, R, B, Lf]), FILL, EDGE))
    p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.3" '
             'stroke-dasharray="6 5"/>' % (Lf[0], Lf[1], L, Lf[1], DASH))
    p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.3" '
             'stroke-dasharray="6 5"/>' % (T[0], T[1], T[0], L, DASH))
    p.append(rt(L, Lf[1], -1, -1))
    p.append(rt(T[0], L, 1, -1))
    p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.2"/>'
             % (L + 12, R[1], L + 12, Lf[1], THIN))
    p.append(txt(L + 18, (R[1] + Lf[1]) / 2 + 4, "3cm", "start"))
    p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.2"/>'
             % (T[0], L + 12, B[0], L + 12, THIN))
    p.append(txt((T[0] + B[0]) / 2, L + 32, "2cm"))
    p.append('<line x1="-14" y1="0" x2="-14" y2="%.1f" stroke="%s" stroke-width="1.2"/>' % (L, THIN))
    p.append(txt(-20, L / 2 + 4, "12cm", "end"))
    return "".join(p) + "</svg>"


# ══════════ HG-2325 正六角形の ㋐ と ㋑ ══════════
def svg_2325():
    R = 150.0
    s3 = math.sqrt(3) / 2
    T = (0.0, -R); UR = (R * s3, -R / 2); LR = (R * s3, R / 2)
    B = (0.0, R); LL = (-R * s3, R / 2); UL = (-R * s3, -R / 2)
    M = ((UR[0] + LR[0]) / 2, (UR[1] + LR[1]) / 2)
    P1 = (LL[0] + (B[0] - LL[0]) / 3, LL[1] + (B[1] - LL[1]) / 3)
    P2 = (LL[0] + (B[0] - LL[0]) * 2 / 3, LL[1] + (B[1] - LL[1]) * 2 / 3)
    p = [head("-200 -200 400 410", "正六角形の中の ㋐ と ㋑")]
    p.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="2"/>'
             % (poly([T, UR, LR, B, LL, UL]), LINE))
    for tri in ([B, M, LR], [T, P1, P2]):
        p.append('<polygon points="%s" fill="%s" stroke="%s" stroke-width="1.8"/>'
                 % (poly(tri), FILL, EDGE))
    for a, b in ((T, P1), (T, P2), (B, M)):
        p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.6"/>'
                 % (a[0], a[1], b[0], b[1], LINE))

    def tick(a, b, n):
        out = []
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy)
        nx, ny = -dy / ln, dx / ln
        for i in range(n):
            mx = a[0] + dx * (i + 0.5) / n
            my = a[1] + dy * (i + 0.5) / n
            reps = 1 if n == 2 else 2
            for j in range(reps):
                o = 0.0 if reps == 1 else (j - 0.5) * 8
                px, py = mx + (dx / ln) * o, my + (dy / ln) * o
                out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                           'stroke-width="1.4"/>'
                           % (px - nx * 7, py - ny * 7, px + nx * 7, py + ny * 7, THIN))
        return "".join(out)

    p.append(tick(UR, LR, 2))
    p.append(tick(LL, B, 3))
    p.append(txt((B[0] + M[0] + LR[0]) / 3 + 8, (B[1] + M[1] + LR[1]) / 3 + 5, "㋐", size=15))
    p.append(txt((T[0] + P1[0] + P2[0]) / 3 - 6, (T[1] + P1[1] + P2[1]) / 3 + 40, "㋑", size=15))
    return "".join(p) + "</svg>"


# ══════════ HG-2327 底辺 5・7・2 と 45°が3つ ══════════
def svg_2327():
    U = 26.0
    A = (0.0, 0.0); Bp = (5 * U, 0.0); C = (12 * U, 0.0); D = (14 * U, 0.0)
    P = (5 * U, -9 * U); Q = (12 * U, -12 * U); X = (7 * U, -7 * U)
    S1 = (5 * U, -5 * U); S2 = (12 * U, -2 * U)
    p = [head("-32 -350 430 424", "底辺を 5・7・2 に分けた図（●は45°）")]
    p.append('<polygon points="%s" fill="%s" stroke="%s" stroke-width="2"/>'
             % (poly([Bp, S1, X, S2, C]), FILL, EDGE))
    for a, b in ((A, D), (A, Q), (P, D), (Bp, P), (C, Q)):
        p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2"/>'
                 % (a[0], a[1], b[0], b[1], LINE))
    p.append(rt(Bp[0], 0, 1, -1))
    p.append(rt(C[0], 0, -1, -1))
    for c, aa, bb in ((A, D, Q), (P, Bp, D), (Q, C, A)):
        ax = math.atan2(aa[1] - c[1], aa[0] - c[0])
        bx = math.atan2(bb[1] - c[1], bb[0] - c[0])
        dd = (bx - ax) % (2 * math.pi)
        mid = ax + dd / 2 if dd <= math.pi else bx + (2 * math.pi - dd) / 2
        p.append('<circle cx="%.1f" cy="%.1f" r="5.5" fill="%s"/>'
                 % (c[0] + 30 * math.cos(mid), c[1] + 30 * math.sin(mid), EDGE))
    for a, b, lab in ((A, Bp, "5"), (Bp, C, "7"), (C, D, "2")):
        p.append('<line x1="%.1f" y1="20" x2="%.1f" y2="20" stroke="%s" stroke-width="1.2"/>'
                 % (a[0], b[0], THIN))
        p.append(txt((a[0] + b[0]) / 2, 40, lab, size=13))
    return "".join(p) + "</svg>"


out = {"HG-2321": svg_2321(), "HG-2322": svg_2322(), "HG-2324": svg_2324(),
       "HG-2325": svg_2325(), "HG-2327": svg_2327()}
fn = os.path.join(BASE, "docs", "_svg_g4nadago_03.json")
io.open(fn, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
for k, v in out.items():
    print("%s  %5d文字  <text>%2d個  改行%d" % (k, len(v), v.count("<text"), v.count("\n")))
print("書いた:", fn)
