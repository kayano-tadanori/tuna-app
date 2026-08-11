# -*- coding: utf-8 -*-
"""学年5の公開学力テスト・灘中チャレンジ34本のうち、2026年灘中チャレンジ算数5本
   （大問5〜9）を、PDFの実物を見て原簿に入れる。

★根拠：G:\\マイドライブ\\浜問題\\模試、特別講座\\2026年度 5年 第1回灘中チャレンジテスト.pdf
  を200〜500dpiで出して目視（横向きスキャン、90度回転して読む。feedback_zu_wa_genbo_ni_nai）。
  ページ対応：大問1〜8がp1（3枚のうち1枚目）、大問9〜11がp2（2枚目）。

実物で確かめた図の内容：
  HG-1305 … 大問5。三角形ABC（B左下・C右下・Aが上）、AB上に点D（Aに近い側）、
            DからC・Eへ線（EはABCの外の右方、DEはACを横切る）、CE線。
            角㋐=∠ADE(黒塗り細角)・㋑=∠EDC・㋒=∠BCE(二重弧)・㋓=∠ABC。
            座標は原簿の検算座標（CA=CD=1）をB→A方向が画像の見た目になるよう回転して使用。
  HG-1306 … 大問6。正方形ABCD（A左上B左下C右下D右上）に、辺ADの内側に正三角形AED、
            辺DCの外側に正三角形DCF。
  HG-1307 … 大問7。長方形ABCD（A左上D右上B左下C右下、AB=9縦・BC=6横）、
            辺ABに一番近い領域＝台形（A, (3,3), (3,6), B の4点。中線x=3で切れる）。
            半円の弧はPが動ける範囲の外周ヒントとして原本にあるが、答えの台形のみ描けば足りる。
  HG-1308 … 大問8。直方体の斜投影図3つ、辺に垂直なひもがけ。a=5(前面横)b=3(高さ)c=10(奥行)。
            [図1]2本＝縦まわり1本(前面縦線+上面奥行き線)＋横まわり1本(上面横線+右面縦線)。
            [図2]3本＝縦まわり1本＋横まわり2本（奥行きを3等分する位置）。
            [図3]3本＝縦まわり1本＋横まわり1本＋水平まわり1本(前面横線+右面奥行き線)。
            向き・本数は原簿の作問メモに600dpi相当で確認済みの記述があり、それに従って座標計算。
  HG-1309 … 大問9。正方形ABCD（一辺6）と正方形AEFG（一辺8）がAを共有、追加でB-E・B-G・G-D
            の3本の線。㋐は線分BEと線分GDの交点にできる角（＝90度、BE⊥GDの図示）。
            A中心の90度回転でB→D、E→Gとなるよう角度パラメータを設定。

使い方: python scripts/genbo_svg_koukai5_group2.py [--write]
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


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), stroke, w, d)


def polyline(seq, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polyline points="%s" fill="none" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), stroke, w, d)


def pts(seq):
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), fill, stroke, w, d)


def circ(cx, cy, r, stroke=LINE, w=2, fill="none"):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        r1(cx), r1(cy), r1(r), fill, stroke, w)


def unit(dx, dy):
    l = math.hypot(dx, dy)
    return (dx / l, dy / l)


def lerp(p0, p1, t_):
    return (p0[0] + (p1[0] - p0[0]) * t_, p0[1] + (p1[1] - p0[1]) * t_)


def rot(p, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c - p[1] * s, p[0] * s + p[1] * c)


def intersect(p1, p2, p3, p4):
    x1, y1 = p1; x2, y2 = p2; x3, y3 = p3; x4, y4 = p4
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den
    return (px, py)


FIGS = {}

# ══ 大問5（HG-1305） 2辺相等＋補角 ═══════════════════════════════════
# 検算座標（CA=CD=1）を、B→A方向が画像の見た目（右上）になるよう120度回転
_raw5 = {
    "A": (0, 0), "B": (1.7361, 0), "D": (0.48384, 0),
    "C": (0.24192, -0.97030), "E": (-0.8843, -1.0689),
}
SCALE5 = 220
P5 = {k: tuple(c * SCALE5 for c in rot(v, 120)) for k, v in _raw5.items()}
A5, B5, C5, D5, E5 = P5["A"], P5["B"], P5["C"], P5["D"], P5["E"]


def angle_mark(vx, vy, dir1, dir2, r=16, double=False, stroke=HI):
    a1 = math.degrees(math.atan2(dir1[1], dir1[0]))
    a2 = math.degrees(math.atan2(dir2[1], dir2[0]))
    da = (a2 - a1 + 360) % 360
    if da > 180:
        a1, a2 = a2, a1
        da = 360 - da
    steps = 14
    seq = []
    for i in range(steps + 1):
        aa = math.radians(a1 + da * i / steps)
        seq.append((vx + r * math.cos(aa), vy + r * math.sin(aa)))
    out = [polyline(seq, stroke, 1.6)]
    if double:
        seq2 = []
        for i in range(steps + 1):
            aa = math.radians(a1 + da * i / steps)
            seq2.append((vx + (r + 5) * math.cos(aa), vy + (r + 5) * math.sin(aa)))
        out.append(polyline(seq2, stroke, 1.6))
    return "".join(out)


_b5 = [
    poly([B5, C5], LINE, 2),
    ln(*B5, *A5, LINE, 2),
    ln(*A5, *C5, LINE, 2),
    ln(*D5, *C5, LINE, 1.8),
    ln(*D5, *E5, LINE, 1.8),
    ln(*C5, *E5, LINE, 1.8),
    t(A5[0], A5[1] - 12, "A", TX, 15, "middle"),
    t(B5[0] - 14, B5[1] + 4, "B", TX, 15, "end"),
    t(C5[0] + 4, C5[1] + 18, "C", TX, 15, "middle"),
    t(D5[0] - 16, D5[1] - 2, "D", TX, 15, "end"),
    t(E5[0] + 14, E5[1] - 4, "E", TX, 15, "start"),
    angle_mark(D5[0], D5[1], (A5[0] - D5[0], A5[1] - D5[1]), (E5[0] - D5[0], E5[1] - D5[1]), 14),
    t(D5[0] + 10, D5[1] - 26, "㋐", HI, 13),
    angle_mark(D5[0], D5[1], (E5[0] - D5[0], E5[1] - D5[1]), (C5[0] - D5[0], C5[1] - D5[1]), 34),
    t(D5[0] + 26, D5[1] + 30, "㋑", HI, 13),
    angle_mark(C5[0], C5[1], (B5[0] - C5[0], B5[1] - C5[1]), (E5[0] - C5[0], E5[1] - C5[1]), 22, True),
    t(C5[0] + 30, C5[1] - 6, "㋒", HI, 13),
    angle_mark(B5[0], B5[1], (A5[0] - B5[0], A5[1] - B5[1]), (C5[0] - B5[0], C5[1] - B5[1]), 20),
    t(B5[0] + 24, B5[1] - 6, "㋓", HI, 13),
]
minx = min(p[0] for p in P5.values()) - 40
miny = min(p[1] for p in P5.values()) - 40
maxx = max(p[0] for p in P5.values()) + 40
maxy = max(p[1] for p in P5.values()) + 30
FIGS["HG-1305"] = svg("%s %s %s %s" % (r1(minx), r1(miny), r1(maxx - minx), r1(maxy - miny)),
                       "".join(_b5))

# ══ 大問6（HG-1306） 正方形＋正三角形2つ ═════════════════════════════
A6, B6, C6, D6 = (0, 0), (0, 200), (200, 200), (200, 0)
E6 = (100, 100 * math.sqrt(3))                 # 辺ADの内側（下向き）
F6 = (200 + 100 * math.sqrt(3), 100)          # 辺DCの外側（右向き）
_b6 = [
    poly([A6, B6, C6, D6], LINE, 2),
    ln(*A6, *E6, LINE, 1.8), ln(*E6, *D6, LINE, 1.8),
    ln(*D6, *F6, LINE, 1.8), ln(*F6, *C6, LINE, 1.8),
    ln(*E6, *C6, HI, 1.6, "5,4"), ln(*E6, *F6, HI, 1.6, "5,4"),
    t(A6[0] - 12, A6[1] - 4, "A", TX, 15, "end"),
    t(B6[0] - 12, B6[1] + 4, "B", TX, 15, "end"),
    t(C6[0] + 4, C6[1] + 18, "C", TX, 15, "middle"),
    t(D6[0] + 12, D6[1] - 4, "D", TX, 15, "start"),
    t(E6[0], E6[1] + 20, "E", TX, 15, "middle"),
    t(F6[0] + 14, F6[1] + 4, "F", TX, 15, "start"),
]
FIGS["HG-1306"] = svg("-20 -20 %s %s" % (r1(F6[0] + 40), r1(E6[1] + 40)), "".join(_b6))

# ══ 大問7（HG-1307） 辺ABに一番近い領域＝台形 ════════════════════════
A7, D7, B7, C7 = (0, 0), (180, 0), (0, 270), (180, 270)
trap = [A7, (90, 90), (90, 180), B7]
_b7 = [
    poly([A7, D7, C7, B7], LINE, 2),
    poly(trap, HI, 2, "#3a4a2f"),
    ln(90, 90, 90, 180, HI, 1.4, "4,3"),
    t(A7[0] - 14, A7[1] + 4, "A", TX, 15, "end"),
    t(D7[0] + 14, D7[1] + 4, "D", TX, 15, "start"),
    t(B7[0] - 14, B7[1] + 4, "B", TX, 15, "end"),
    t(C7[0] + 14, C7[1] + 4, "C", TX, 15, "start"),
    t(-30, 135, "9cm", GRAY, 13, "middle"),
    t(90, 290, "6cm", GRAY, 13, "middle"),
    t(45, 240, "P", HI, 13),
]
FIGS["HG-1307"] = svg("-60 -20 300 340", "".join(_b7 + [
    t(150, 325, "辺ABに一番近い部分＝台形（斜線）", GRAY, 11),
]))

# ══ 大問8（HG-1308） 直方体のひもがけ 3図 ══════════════════════════
def box_svg(ropes, w=100, h=60):
    dx, dy = 160, -90
    FLt, FRt, FRb, FLb = (0, 0), (w, 0), (w, h), (0, h)
    BLt, BRt, BRb = (dx, dy), (w + dx, dy), (w + dx, h + dy)
    out = [
        poly([FLt, FRt, FRb, FLb], LINE, 2),                # 前面
        poly([FLt, FRt, BRt, BLt], LINE, 1.6),               # 上面
        poly([FRt, FRb, BRb, BRt], LINE, 1.6),               # 右面
    ]
    for rope in ropes:
        out.append(polyline(rope, HI, 2.2))
    return "".join(out), (w, h, dx, dy)


w, h, dx, dy = 100, 60, 160, -90
mF_top, mF_bot = (w / 2, 0), (w / 2, h)                       # 前面縦線の上下端
mF_topD = (w / 2 + dx, 0 + dy)                                 # 上面奥行き線の奥端
midL_top, midR_top = (dx / 2, dy / 2), (w + dx / 2, dy / 2)    # 上面横線(中央)
midR_bot = (w + dx / 2, h + dy / 2)                            # 右面縦線(中央)下端
mF_left, mF_right = (0, h / 2), (w, h / 2)                     # 前面横線
rightDeep = (w + dx, h / 2 + dy)                               # 水平まわりの右面奥行き線の奥端

rope_v = [mF_bot, mF_top, mF_topD]                             # 縦まわり
rope_h_mid = [midL_top, midR_top, midR_bot]                    # 横まわり(中央)
body1, _ = box_svg([rope_v, rope_h_mid])
FIGS["HG-1308-1"] = svg("-20 -110 320 200", body1 + t(140, 80, "[図1]", GRAY, 12))

# 図2：横まわり2本（奥行きを3等分）
p1L, p1R = (dx / 3, dy / 3), (w + dx / 3, dy / 3)
p1Rb = (w + dx / 3, h + dy / 3)
p2L, p2R = (dx * 2 / 3, dy * 2 / 3), (w + dx * 2 / 3, dy * 2 / 3)
p2Rb = (w + dx * 2 / 3, h + dy * 2 / 3)
rope_h1 = [p1L, p1R, p1Rb]
rope_h2 = [p2L, p2R, p2Rb]
body2, _ = box_svg([rope_v, rope_h1, rope_h2])
FIGS["HG-1308-2"] = svg("-20 -110 320 200", body2 + t(140, 80, "[図2]", GRAY, 12))

# 図3：縦まわり1・水平まわり1（前面横線+右面奥行き線）・横まわり1（中央）
rope_water = [mF_left, mF_right, rightDeep]
body3, _ = box_svg([rope_v, rope_h_mid, rope_water])
FIGS["HG-1308-3"] = svg("-20 -110 320 200", body3 + t(140, 80, "[図3]", GRAY, 12))

FIGS["HG-1308"] = svg("0 0 1000 210", "".join([
    '<g transform="translate(20,100)">%s</g>' % FIGS["HG-1308-1"].split(">", 1)[1][:-6],
    '<g transform="translate(350,100)">%s</g>' % FIGS["HG-1308-2"].split(">", 1)[1][:-6],
    '<g transform="translate(680,100)">%s</g>' % FIGS["HG-1308-3"].split(">", 1)[1][:-6],
]))
del FIGS["HG-1308-1"], FIGS["HG-1308-2"], FIGS["HG-1308-3"]

# ══ 大問9（HG-1309） 正方形2つ・BE⊥GD ═══════════════════════════════
A9 = (0, 0)
AB_DEG, AE_DEG = 95, -55        # 画像の見た目に合わせた角度パラメータ
B9 = (60 * math.cos(math.radians(AB_DEG)), 60 * math.sin(math.radians(AB_DEG)))
D9 = (60 * math.cos(math.radians(AB_DEG - 90)), 60 * math.sin(math.radians(AB_DEG - 90)))
C9 = (B9[0] + D9[0] - A9[0], B9[1] + D9[1] - A9[1])
E9 = (80 * math.cos(math.radians(AE_DEG)), 80 * math.sin(math.radians(AE_DEG)))
G9 = (80 * math.cos(math.radians(AE_DEG - 90)), 80 * math.sin(math.radians(AE_DEG - 90)))
F9 = (E9[0] + G9[0] - A9[0], E9[1] + G9[1] - A9[1])
H9 = intersect(B9, E9, G9, D9)
_b9 = [
    poly([A9, B9, C9, D9], LINE, 2),
    poly([A9, E9, F9, G9], LINE, 2),
    ln(*B9, *E9, HI, 1.6),
    ln(*G9, *D9, HI, 1.6),
    ln(*G9, *B9, "#6a7aa8", 1.4, "4,3"),
    t(A9[0] - 12, A9[1] + 14, "A", TX, 15, "end"),
    t(B9[0] - 10, B9[1] + 14, "B", TX, 15, "end"),
    t(C9[0] + 6, C9[1] + 14, "C", TX, 15, "start"),
    t(D9[0] + 12, D9[1] + 2, "D", TX, 15, "start"),
    t(E9[0] + 14, E9[1], "E", TX, 15, "start"),
    t(F9[0], F9[1] - 12, "F", TX, 15, "middle"),
    t(G9[0] - 14, G9[1] - 4, "G", TX, 15, "end"),
    t(H9[0] - 4, H9[1] - 10, "㋐", HI, 12),
]
xs = [p[0] for p in (A9, B9, C9, D9, E9, F9, G9)]
ys = [p[1] for p in (A9, B9, C9, D9, E9, F9, G9)]
FIGS["HG-1309"] = svg("%s %s %s %s" % (r1(min(xs) - 30), r1(min(ys) - 30),
                                        r1(max(xs) - min(xs) + 60), r1(max(ys) - min(ys) + 60)),
                       "".join(_b9))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    bad = []
    for hg, fig in FIGS.items():
        vb = re.search(r'viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"', fig)
        w2, h2 = float(vb.group(3)), float(vb.group(4))
        if h2 / w2 > 0.9:
            bad.append("%s: viewBoxが縦長すぎ (%.2f)" % (hg, h2 / w2))
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
