# -*- coding: utf-8 -*-
"""小4灘合 第11回 大問4（HG-2411）の図SVG。

   ★斜線の位置は現物PDF（4年灘合_第7〜12回.pdf の p44）を拡大し、
     マスの中心のインク密度で機械判定した。斜線＝密度0.45〜0.52／白マス＝0.11〜0.16 と
     はっきり分かれ、上面5マス・正面1マス・右面1マスが自己整合的に決まった
     （上面(左3,手前1)の立方体は正面に接する＝正面の左から3番目が斜線 ✓
      上面(左4,手前3)の立方体は右面に接する＝右面の手前から3番目が斜線 ✓）。
   → 原簿の「市松8個（112cm²）」は誤り。**斜線は5個で表面積106cm²**。
   使い方: python scripts/genbo_svg_g4nadago_11.py  → docs/_svg_g4nadago_11.json
"""
import io, json, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINE, THIN, EDGE = "#4f9eff", "#7fb8ff", "#ffd166"
TTL = "#9aa3c0"

# 上面の斜線マス (左から0起点, 手前から0起点) ＝ 実測
HATCH_TOP = [(2, 0), (2, 1), (1, 2), (3, 2), (0, 3)]
N = 4


def P(x, y, z, s, dx, dy, ky=0.52, kz=0.40):
    """x=右, y=奥(右上へ), z=上。画面のyは下向き"""
    return (dx + (x + ky * y) * s, dy - (z + kz * y) * s)


def line(a, b, col=LINE, w=2.0, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ""
    return ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%.1f"%s/>'
            % (a[0], a[1], b[0], b[1], col, w, d))


def poly(pts, fill="none", stroke="none", w=0.0):
    return ('<polygon points="%s" fill="%s" stroke="%s" stroke-width="%.1f"/>'
            % (" ".join("%.1f,%.1f" % q for q in pts), fill, stroke, w))


def svg_2411():
    s = 46.0
    dx, dy = 24.0, 26.0 + 1.40 * N * s + 26
    W, H = 1.52 * N * s + 56, 1.40 * N * s + 78
    pt = lambda x, y, z: P(x, y, z, s, dx, dy)
    p = ['<svg viewBox="-14 -24 %.0f %.0f" xmlns="http://www.w3.org/2000/svg" '
         'style="display:block;margin:0 auto;max-width:100%%">' % (W, H)]
    p.append('<defs><pattern id="hg2411" width="7" height="7" patternUnits="userSpaceOnUse" '
             'patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" '
             'stroke="%s" stroke-width="2.2"/></pattern></defs>' % EDGE)
    p.append('<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" fill="%s">%s</text>'
             % (-14 + W / 2, -24 + 16, TTL, "一辺1cmの小さい立方体64個で作った大きな立方体"))
    HAT = "url(#hg2411)"
    # ── しゃ線のマス（面を先に塗ってから、わくの線を上に重ねる）
    for (i, j) in HATCH_TOP:                                   # 上面
        p.append(poly([pt(i, j, N), pt(i + 1, j, N), pt(i + 1, j + 1, N), pt(i, j + 1, N)], HAT))
    for i in (2,):                                             # 正面（一番上の段）
        p.append(poly([pt(i, 0, N - 1), pt(i + 1, 0, N - 1), pt(i + 1, 0, N), pt(i, 0, N)], HAT))
    for j in (2,):                                             # 右面（一番上の段）
        p.append(poly([pt(N, j, N - 1), pt(N, j + 1, N - 1), pt(N, j + 1, N), pt(N, j, N)], HAT))
    # ── マス目
    for i in range(N + 1):
        p.append(line(pt(i, 0, 0), pt(i, 0, N), THIN, 1.1))          # 正面 たて
        p.append(line(pt(0, 0, i), pt(N, 0, i), THIN, 1.1))          # 正面 よこ
        p.append(line(pt(i, 0, N), pt(i, N, N), THIN, 1.1))          # 上 おく
        p.append(line(pt(0, i, N), pt(N, i, N), THIN, 1.1))          # 上 よこ
        p.append(line(pt(N, i, 0), pt(N, i, N), THIN, 1.1))          # 右 たて
        p.append(line(pt(N, 0, i), pt(N, N, i), THIN, 1.1))          # 右 おく
    # ── 立体のりんかく
    for a, b in (((0, 0, 0), (N, 0, 0)), ((0, 0, 0), (0, 0, N)), ((N, 0, 0), (N, N, 0)),
                 ((0, 0, N), (N, 0, N)), ((0, 0, N), (0, N, N)), ((N, 0, N), (N, N, N)),
                 ((N, N, 0), (N, N, N)), ((0, N, N), (N, N, N)), ((N, 0, 0), (N, 0, N))):
        p.append(line(pt(*a), pt(*b), LINE, 2.2))
    return "".join(p) + "</svg>"


out = {"HG-2411": svg_2411()}
fn = os.path.join(BASE, "docs", "_svg_g4nadago_11.json")
io.open(fn, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
for k, v in out.items():
    print("%s  %d文字  <text>%d個  改行%d" % (k, len(v), v.count("<text"), v.count("\n")))
print("書いた:", fn)
