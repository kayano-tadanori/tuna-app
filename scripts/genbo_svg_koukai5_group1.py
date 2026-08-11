# -*- coding: utf-8 -*-
"""学年5の公開学力テスト・灘中チャレンジ34本のうち、2023年度5年公開算数の3本を、
   PDFの実物を見て原簿に入れる。

★根拠：G:\\マイドライブ\\浜問題\\公開学力テスト\\2023年度 5年公開算数.pdf を
  100〜220dpiで出して目視（feedback_zu_wa_genbo_ni_nai）。
  ページ対応：599回=p1-2, 606回=p15-16, 609回=p21-22（1回=2ページの規則的な並び。
  ヘッダー帯コンタクトシートで確認ずみ）。

実物で確かめた図の内容：
  HG-0907 … 599回 大問5。長方形ABCDのAD上にE・F、BEとCFで折り曲げてA,DがGでくっつく。
            上辺にE-Fの短い線分、その左右外側に(A)(D)のラベル（頂点ではなく元位置の表記）。
            B・CからGへ線、E・FからもGへ線。三角形EGFに「ア」、三角形BGCに「イ」。
            BE上・CF上に内向きの折る矢印。
  HG-1465 … 606回 大問3。四角形ABCD、A左上・B左下(直角)・C下・D右上、対角線AC。
            辺の長さは図中になし（問題文で与える）。
  HG-1472 … 609回 大問6。1辺9cmの正三角形PQRからPAF・BQC・EDRを切り取った六角形
            ABCDEF。CD上にCG=2の点G、BEとFGの交点H。P=(400,60)を頂点とし、
            PQ・PR・QR上の分点をt=距離/9の線形補間で計算。

使い方: python scripts/genbo_svg_koukai5_group1.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'


def r1(v):
    return round(float(v), 1)


def svg(vb, body):
    return '<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (vb, S, body)


def t(x, y, s, fill=TX, size=13, anchor="middle", extra=""):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s"%s>%s</text>' % (
        r1(x), r1(y), size, anchor, fill, extra, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None, extra=""):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s%s/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), stroke, w, d, extra)


def circ(cx, cy, r, stroke=LINE, w=2, fill="none"):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(cx), r1(cy), r1(r), fill, stroke, w)


def pts(seq):
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), fill, stroke, w, d)


def right_angle_mark(cx, cy, dir1, dir2, size=12, stroke=GRAY):
    """dir1, dir2: 単位ベクトル方向。角の頂点(cx,cy)に小さいL字を描く"""
    p1 = (cx + dir1[0] * size, cy + dir1[1] * size)
    p2 = (cx + dir1[0] * size + dir2[0] * size, cy + dir1[1] * size + dir2[1] * size)
    p3 = (cx + dir2[0] * size, cy + dir2[1] * size)
    return ('<polyline points="%s" fill="none" stroke="%s" stroke-width="1.4"/>'
            % (pts([p1, p2, p3]), stroke))


def unit(dx, dy):
    l = math.hypot(dx, dy)
    return (dx / l, dy / l)


def curved_arrow(x1, y1, x2, y2, bulge=18, color=HI, w=1.6):
    """x1,y1→x2,y2 の中間に向かって膨らむ弧状の矢印（内向きの折り目を示す）"""
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    dx, dy = x2 - x1, y2 - y1
    nx, ny = unit(-dy, dx)
    cx, cy = mx + nx * bulge, my + ny * bulge
    ax, ay = x2, y2
    ux, uy = unit(x2 - cx, y2 - cy)
    hx, hy = ax - ux * 6, ay - uy * 6
    lx, ly = ux * math.cos(2.6) - uy * math.sin(2.6), ux * math.sin(2.6) + uy * math.cos(2.6)
    rx, ry = ux * math.cos(-2.6) - uy * math.sin(-2.6), ux * math.sin(-2.6) + uy * math.cos(-2.6)
    return ('<path d="M%s,%s Q%s,%s %s,%s" fill="none" stroke="%s" stroke-width="%s"/>'
            '<path d="M%s,%s L%s,%s M%s,%s L%s,%s" stroke="%s" stroke-width="%s"/>') % (
        r1(x1), r1(y1), r1(cx), r1(cy), r1(x2), r1(y2), color, w,
        r1(ax), r1(ay), r1(hx + lx * 6), r1(hy + ly * 6),
        r1(ax), r1(ay), r1(hx + rx * 6), r1(hy + ry * 6), color, w)


FIGS = {}

# ══ 599回 大問5（HG-0907） 長方形の折り返し ═══════════════════════════
E = (260, 90)
F = (340, 90)
G = (300, 235)
B = (130, 350)
C = (470, 350)
_b1 = [
    poly([E, B, C, F], LINE, 2),           # 外形（台形）
    ln(*E, *G, LINE, 2),
    ln(*F, *G, LINE, 2),
    ln(*B, *G, LINE, 2),
    ln(*C, *G, LINE, 2),
    t(E[0] - 55, E[1] + 4, "(A)", GRAY, 14),
    t(F[0] + 55, F[1] + 4, "(D)", GRAY, 14),
    t(E[0] - 8, E[1] - 8, "E", TX, 14, "end"),
    t(F[0] + 8, F[1] - 8, "F", TX, 14, "start"),
    t(G[0], G[1] + 4, "G", TX, 14, "middle"),
    t(B[0] - 10, B[1] + 4, "B", TX, 14, "end"),
    t(C[0] + 10, C[1] + 4, "C", TX, 14, "start"),
    poly([E, G, F], "none", 0, "#3a4a7a"),
    t((E[0] + F[0] + G[0]) / 3, (E[1] + F[1] + G[1]) / 3 + 4, "ア", HI, 14),
    poly([B, G, C], "none", 0, "#3a4a7a"),
    t((B[0] + C[0] + G[0]) / 3, (B[1] + C[1] + G[1]) / 3 + 6, "イ", HI, 14),
    curved_arrow(B[0] + 30, B[1] - 55, B[0] + 55, B[1] - 90, bulge=-14),
    curved_arrow(C[0] - 30, C[1] - 55, C[0] - 55, C[1] - 90, bulge=14),
]
FIGS["HG-0907"] = svg("0 0 600 400", "".join(_b1 + [
    t(300, 392, "長方形ABCDをBE・CFで折り返すと、AとDが点Gでくっつく", GRAY, 11),
]))

# ══ 606回 大問3（HG-1465） 四角形ABCD・対角線AC ══════════════════════
A2 = (90, 60)
B2 = (110, 330)
C2 = (300, 350)
D2 = (390, 95)
_b2 = [
    poly([A2, B2, C2, D2], LINE, 2),
    ln(*A2, *C2, LINE, 1.8),
    t(A2[0] - 10, A2[1] - 4, "A", TX, 15, "end"),
    t(B2[0] - 12, B2[1] + 4, "B", TX, 15, "end"),
    t(C2[0] + 4, C2[1] + 18, "C", TX, 15, "middle"),
    t(D2[0] + 12, D2[1] - 4, "D", TX, 15, "start"),
    right_angle_mark(B2[0], B2[1], unit(A2[0] - B2[0], A2[1] - B2[1]),
                      unit(C2[0] - B2[0], C2[1] - B2[1])),
    right_angle_mark(D2[0], D2[1], unit(C2[0] - D2[0], C2[1] - D2[1]),
                      unit(A2[0] - D2[0], A2[1] - D2[1])),
]
FIGS["HG-1465"] = svg("0 0 480 400", "".join(_b2 + [
    t(240, 392, "角Bと角Dが直角。対角線ACで2つの直角三角形に分けられる", GRAY, 11),
]))

# ══ 609回 大問6（HG-1472） 正三角形PQRから3すみを切った六角形 ═══════════
P = (400, 55)
Q = (120, 560)
R = (680, 560)


def lerp(p0, p1, t_):
    return (p0[0] + (p1[0] - p0[0]) * t_, p0[1] + (p1[1] - p0[1]) * t_)


A3 = lerp(P, Q, 1 / 9)
B3 = lerp(P, Q, 6 / 9)
F3 = lerp(P, R, 1 / 9)
E3 = lerp(P, R, 7 / 9)
C3 = lerp(Q, R, 3 / 9)
G3 = lerp(Q, R, 5 / 9)
D3 = lerp(Q, R, 7 / 9)


def intersect(p1, p2, p3, p4):
    x1, y1 = p1; x2, y2 = p2; x3, y3 = p3; x4, y4 = p4
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den
    return (px, py)


H3 = intersect(B3, E3, F3, G3)

_b3 = [
    poly([A3, B3, C3, D3, E3, F3], LINE, 2),   # 六角形
    ln(*B3, *E3, LINE, 1.8),
    ln(*F3, *G3, LINE, 1.8),
    t(P[0], P[1] - 12, "P", TX, 15, "middle"),
    t(Q[0] - 16, Q[1] + 10, "Q", TX, 15, "end"),
    t(R[0] + 16, R[1] + 10, "R", TX, 15, "start"),
    t(A3[0] - 14, A3[1] - 2, "A", TX, 14, "end"),
    t(F3[0] + 14, F3[1] - 2, "F", TX, 14, "start"),
    t(B3[0] - 16, B3[1] + 2, "B", TX, 14, "end"),
    t(E3[0] + 16, E3[1] + 2, "E", TX, 14, "start"),
    t(C3[0] - 4, C3[1] + 22, "C", TX, 14, "middle"),
    t(G3[0], G3[1] + 22, "G", TX, 14, "middle"),
    t(D3[0] + 4, D3[1] + 22, "D", TX, 14, "middle"),
    t(H3[0] + 12, H3[1] - 6, "H", HI, 14, "start"),
]
FIGS["HG-1472"] = svg("0 0 800 610", "".join(_b3 + [
    t(400, 600, "1辺9cmの正三角形PQRの3すみ（PAF・BQC・EDR）を切り取った六角形ABCDEF", GRAY, 11),
]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    bad = []
    for hg, fig in FIGS.items():
        vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', fig)
        w, h = float(vb.group(1)), float(vb.group(2))
        if h / w > 0.9:
            bad.append("%s: viewBoxが縦長すぎ (%.2f)" % (hg, h / w))
        for tag in re.findall(r"<text[^>]*>", fig):
            if "fill=" not in tag:
                bad.append("%s: fillの無い<text>" % hg)
                break
        for c in ("#333", "#888", "#666", "#000", "#111", "#222", "#1a2340"):
            if ('fill="%s"' % c) in fig or ('stroke="%s"' % c) in fig:
                bad.append("%s: 暗すぎる色 %s" % (hg, c))
    if bad:
        for b in bad:
            print("⚠", b)
    else:
        print("✅ 自己点検OK（横長・文字色・max-width）")

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
