# -*- coding: utf-8 -*-
"""小5灘合 第4回 大問2・3・7 の図SVGを作る（HG-2247 / HG-2248 / HG-2252）。
   ★図は原簿の「- 図SVG:」欄が源。ここで作った文字列を原簿に入れ、
     アプリへは scripts/sync_genbo_svg.py で写す（feedback_zu_wa_genbo_ni_nai）。
   ★座標はすべて現物PDF（G:\マイドライブ\浜問題\灘中合格特訓\5年灘合_第1〜6回…pdf）
     の実測から起こした。市松のマス（HG-2252）はインク密度の実測で決めた。
   使い方: python scripts/genbo_svg_g5nadago_04.py   → docs/_svg_g5nadago_04.json
"""
import io, json, math, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINE, THIN, FILL, EDGE = "#4f9eff", "#7fb8ff", "rgba(255,209,102,0.22)", "#ffd166"
LBL, TTL = "#c9d4f0", "#9aa3c0"


def head(vb, title):
    return ('<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%">'
            '<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" fill="%s">%s</text>'
            % (vb, vb.split()[0].__class__ and (float(vb.split()[0]) + float(vb.split()[2]) / 2),
               float(vb.split()[1]) + 16, TTL, title))


def txt(x, y, s, anchor="middle", size=12, color=LBL):
    return '<text x="%.1f" y="%.1f" font-size="%d" text-anchor="%s" fill="%s">%s</text>' % (
        x, y, size, anchor, color, s)


# ══════════ HG-2247 4つの半円と1つの円（風車） ══════════
# O原点。A(-8,0) C(8,0) D(0,8) B(0,-8)[cm]。半径4cmの半円4つが風車状。
# 円の半径 R=|OP|=4√2（Pは半円の弧の中点＝「PA弧とPO弧が等しい」の言いかえ）。
def svg_2247():
    s = 16.0                      # 1cm = 16px
    r, R = 4 * s, 4 * math.sqrt(2) * s
    d = 8 * s
    p = [head("-158 -186 316 360", "4つの半円と1つの円（風車）")]
    # 中心の円
    p.append('<circle cx="0" cy="0" r="%.2f" fill="none" stroke="%s" stroke-width="2"/>' % (R, LINE))
    # 斜線の羽根4枚（円の内側 かつ 半円の外側）
    for a in range(4):
        # 羽根1（左上）を -90°ずつ回して4枚
        p.append('<g transform="rotate(%d)">' % (90 * a))
        p.append('<path d="M 0 0 A %.1f %.1f 0 0 0 %.1f %.1f A %.2f %.2f 0 0 1 0 %.2f Z" '
                 'fill="%s" stroke="%s" stroke-width="2"/>'
                 % (r, r, -r, -r, R, R, -R, FILL, EDGE))
        p.append('</g>')
    # 半円4つ（OA上むき→90°ずつ回す）
    for a in range(4):
        p.append('<g transform="rotate(%d)">' % (90 * a))
        p.append('<path d="M %.1f 0 A %.1f %.1f 0 0 1 0 0" fill="none" stroke="%s" stroke-width="1.8"/>'
                 % (-d, r, r, LINE))
        p.append('</g>')
    # A–O–C と D–O–B の線
    p.append('<path d="M %.1f 0 L %.1f 0 M 0 %.1f L 0 %.1f" fill="none" stroke="%s" stroke-width="1.4"/>'
             % (-d, d, -d, d, THIN))
    for x, y, t, an in ((-d - 6, 16, "A", "end"), (d + 6, 16, "C", "start"),
                        (-9, -d - 6, "D", "end"), (-9, d + 20, "B", "end"),
                        (10, 18, "O", "start"), (-r - 8, -r - 8, "P", "end")):
        p.append(txt(x, y, t, an))
    p.append('<circle cx="%.1f" cy="%.1f" r="3" fill="%s"/>' % (-r, -r, EDGE))
    return "".join(p) + "</svg>"


# ══════════ HG-2248 1辺の比1:2:4の正三角形3つ ══════════
# B(1辺2)を▽に置く：T1(0,0) T2(2,0) M(1,-√3)
# A(1辺1)は頂点T1、右の辺がBの左の辺の上：L(-1/2,-√3/2) P1(1/2,-√3/2)
# C(1辺4)は頂点T2、左の辺がT2→Mを通って伸びる：BL(0,-2√3) BR(4,-2√3)
def svg_2248():
    u = 60.0
    S = math.sqrt(3)
    P = lambda x, y: (x * u, -y * u)          # 数学座標→SVG座標
    T1, T2, M = P(0, 0), P(2, 0), P(1, -S)
    L, P1 = P(-0.5, -S / 2), P(0.5, -S / 2)
    BL, BR = P(0, -2 * S), P(4, -2 * S)
    poly = lambda pts: " ".join("%.1f,%.1f" % q for q in pts)
    p = [head("-70 -40 340 300", "1辺の比が1:2:4の正三角形3つ")]
    p.append('<polygon points="%s" fill="%s" stroke="%s" stroke-width="2"/>'
             % (poly([L, P1, M, BL]), FILL, EDGE))           # 斜線の四角形
    for pts, w in ((( T1, P1, L), 1.8), ((T1, T2, M), 1.8), ((T2, BL, BR), 2)):
        p.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="%.1f"/>' % (poly(pts), LINE, w))
    p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2"/>'
             % (L[0], L[1], BL[0], BL[1], EDGE))             # Aの頂点とCの頂点を結ぶ線
    p.append(txt((L[0] + P1[0] + T1[0]) / 3, (L[1] + P1[1] + T1[1]) / 3 + 4, "A", size=13))
    p.append(txt((T1[0] + T2[0] + M[0]) / 3, (T1[1] + T2[1] + M[1]) / 3 + 4, "B", size=13))
    p.append(txt((T2[0] + BL[0] + BR[0]) / 3 + 20, (T2[1] + BL[1] + BR[1]) / 3 + 4, "C", size=13))
    return "".join(p) + "</svg>"


# ══════════ HG-2252 三角形を3方向に1:2:3:4で分けた市松模様 ══════════
# 斜線のマスは、現物の画像のインク密度を1マスずつ実測して決めた（完全な市松）。
PAT = [[0, 1, 0, 1], [1, 0, 1, 0], [0, 1, 0, 1], [1, 0, 1, 0]]


def svg_2252():
    A, B, C = (152.0, 0.0), (0.0, 268.0), (330.0, 268.0)
    tr = [0, .4, .7, .9, 1.0]                 # Aからの高さの割合（AD:DE:EF:FB=4:3:2:1）
    tc = [0, .1, .3, .6, 1.0]                 # BC上の割合（BG:GH:HI:IC=1:2:3:4）
    def Q(t, u):
        lx, ly = A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t
        rx, ry = A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t
        return (lx + (rx - lx) * u, ly + (ry - ly) * u)
    poly = lambda pts: " ".join("%.1f,%.1f" % q for q in pts)
    p = [head("-34 -34 400 344", "3方向を1:2:3:4に分けた市松もよう")]
    for i in range(4):
        for j in range(4):
            if not PAT[i][j]:
                continue
            pts = [Q(tr[i], tc[j]), Q(tr[i], tc[j + 1]), Q(tr[i + 1], tc[j + 1]), Q(tr[i + 1], tc[j])]
            if tr[i] == 0:
                pts = [A, Q(tr[i + 1], tc[j + 1]), Q(tr[i + 1], tc[j])]   # 最上段は三角形
            p.append('<polygon points="%s" fill="%s" stroke="none"/>' % (poly(pts), FILL))
    p.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="2"/>' % (poly([A, B, C]), LINE))
    for t in tr[1:4]:                          # D–L, E–K, F–J
        a, b = Q(t, 0), Q(t, 1)
        p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.5"/>'
                 % (a[0], a[1], b[0], b[1], THIN))
    for u_ in tc[1:4]:                         # A–G, A–H, A–I
        b = Q(1, u_)
        p.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.5"/>'
                 % (A[0], A[1], b[0], b[1], THIN))
    for nm, q, an, dx, dy in (("A", A, "middle", 0, -8), ("B", B, "end", -6, 14), ("C", C, "start", 6, 14),
                              ("D", Q(.4, 0), "end", -6, 0), ("E", Q(.7, 0), "end", -6, 0),
                              ("F", Q(.9, 0), "end", -6, 0), ("L", Q(.4, 1), "start", 6, 0),
                              ("K", Q(.7, 1), "start", 6, 0), ("J", Q(.9, 1), "start", 6, 0),
                              ("G", Q(1, .1), "middle", 0, 16), ("H", Q(1, .3), "middle", 0, 16),
                              ("I", Q(1, .6), "middle", 0, 16)):
        p.append(txt(q[0] + dx, q[1] + dy, nm, an, 11))
    return "".join(p) + "</svg>"


out = {"HG-2247": svg_2247(), "HG-2248": svg_2248(), "HG-2252": svg_2252()}
fn = os.path.join(BASE, "docs", "_svg_g5nadago_04.json")
io.open(fn, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
for k, v in out.items():
    print("%s  %d文字  <text>%d個" % (k, len(v), v.count("<text")))
print("書いた:", fn)
