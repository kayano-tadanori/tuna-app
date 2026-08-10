# -*- coding: utf-8 -*-
"""小3灘合で「図: あり」なのに図SVGが無かった10本を、PDFの実物を見て原簿に入れる。

★根拠：3年灘合 第2〜12回.pdf（G:\\マイドライブ\\浜問題\\灘中合格特訓\\）を100〜200dpiで
  出して目視。原簿に図は入っていないのでここが唯一の根拠（feedback_zu_wa_genbo_ni_nai）。
  HG-0421の反省を踏まえ、実物に無い情報（答えの先渡しなど）は描かない。

実物で確かめたページ対応（このPDFは「-N-」が回ごとにリセットされる大問番号）：
  HG-1903 … 第2回p3（大問3）。A—木…木—B の1列。Aから右向き矢印・Bから左向き矢印
  HG-1906 … 第2回p6（大問6）。78の例：78+87=165→+561=726→+627=1353→+3531=4884
  HG-1930 … 第4回p10（大問10）。24時間デジタル時計の枠「08:57:02」＋例2つ
  HG-1939 … 第5回p9（大問9）。★実物は円を描かず「… 98 99 100 1 2 3 …」という
            短い数字の並びだけ（HG-0421と同じ誤りをしない）
  HG-1964 … 第8回p4（大問4）。2つの三角形が交わって4方向にとがった星形。
            重なった部分（点線）と外側の八角形（実線）
  HG-1973 … 第9回p3（大問3）。5つの正多面体の見取図（正四面体・正六面体・正八面体・
            正十二面体・正二十面体）＋空の対応表
  HG-1974 … 第9回p4（大問4）。立方体（点線）のかどを各辺の中点まで切り取った立体
            （立方八面体）
  HG-1976 … 第9回p6（大問6）。サッカーボールの絵（正五角形12・正六角形20）
  HG-1979 … 第9回p9（大問9）。マッチ棒の直方体の骨組み（たて5・横10・高さ5cmの例＝
            1×2×1マス・20本）
  HG-1997 … 第11回p7（大問7）。ある年の2月のカレンダー（1日が木曜・28日まで）

使い方: python scripts/genbo_svg_m3nadago_group1.py [--write]
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


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), fill, stroke, w, d)


def pline(seq, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polyline points="%s" fill="none" stroke="%s" stroke-width="%s"%s/>' % (pts(seq), stroke, w, d)


def defs_arrow(mid, color=HI):
    return ('<defs><marker id="%s" markerWidth="8" markerHeight="8" refX="6.5" refY="4"'
            ' orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % (mid, color))


FIGS = {}

# ══ 第2回 大問3（HG-1903）A—木…木—B の1列・2本おき/3本おき ══════════════
_tr = []
_txs = [40, 66, 92, 118] + [280, 306, 332, 358]
for x in _txs:
    _tr += [poly([(x, 60), (x + 16, 60), (x + 8, 40)], LINE, 1.6),
            ln(x + 8, 60, x + 8, 70, LINE, 2)]
FIGS["HG-1903"] = svg("0 0 400 130", "".join(_tr + [
    t(30, 40, "A", TX, 14, "end"), t(370, 40, "B", TX, 14, "start"),
    t(200, 60, "……", GRAY, 16),
    defs_arrow("ar1903", HI),
    '<path d="M40,30 Q66,18 92,30" fill="none" stroke="%s" stroke-width="1.8" marker-end="url(#ar1903)"/>' % HI,
    '<path d="M358,30 Q332,18 306,30" fill="none" stroke="%s" stroke-width="1.8" marker-end="url(#ar1903)"/>' % HI,
    t(200, 108, "Aから2本おきに赤ひも・Bから3本おきに青ひも。まん中の木に両方つく", GRAY, 11),
]))

# ══ 第2回 大問6（HG-1906）78の例：4回の足し算で回文数になる ══════════════
_rows = [("78", "+87", "165"), ("165", "+561", "726"), ("726", "+627", "1353"), ("1353", "+3531", "4884")]
_b6 = []
x0 = 60
for a, b, c in _rows:
    _b6 += [t(x0 + 60, 24, a, TX, 15, "end"), t(x0 + 60, 44, b, TX, 15, "end"),
            ln(x0, 52, x0 + 60, 52, GRAY, 1.4), t(x0 + 60, 70, c, HI, 15, "end")]
    if x0 + 90 < 460:
        _b6.append(t(x0 + 80, 44, "→", GRAY, 15))
    x0 += 100
FIGS["HG-1906"] = svg("0 0 460 110", "".join(_b6 + [
    t(230, 96, "78に、十の位と一の位を入れかえた数をたす、をくり返す", GRAY, 11),
]))

# ══ 第4回 大問10（HG-1930）24時間デジタル時計 ══════════════════════════
def clock(cx, cy, hh, mm, ss, scale=1.0):
    out = []
    w, h = 34 * scale, 40 * scale
    labels = [hh, mm, ss]
    x = cx - (w * 3 + 20 * scale) / 2
    for i, lab in enumerate(labels):
        out.append(rect(x, cy - h / 2, w, h, LINE, 1.8))
        out.append(t(x + w / 2, cy + 6 * scale, lab, TX, 15 * scale))
        x += w + 6 * scale
        if i < 2:
            out.append(t(x, cy + 6 * scale, ":", TX, 15 * scale))
            x += 8 * scale
    return out


FIGS["HG-1930"] = svg("0 0 400 220", "".join(
    clock(200, 50, "08", "57", "02", 1.15)
    + [t(200, 92, "24時間表示のデジタル時計（例：08:57:02）", GRAY, 11)]
    + clock(120, 150, "10", "00", "02")
    + [t(120, 186, "合計3の例", GRAY, 10)]
    + clock(280, 150, "01", "11", "19")
    + [t(280, 186, "1が4個以上連続の例", GRAY, 10)]
    + [t(200, 210, "00:00:00〜23:59:59まで1秒きざみで表示する", GRAY, 11)]
))

# ══ 第5回 大問9（HG-1939）円周に1〜100・6とび ═══════════════════════
# ★実物は円を描かず「…98 99 100 1 2 3…」という短い数字の並びだけ（HG-0421の反省を反映）
FIGS["HG-1939"] = svg("0 0 380 120", "".join([
    t(190, 50, "… 98  99  100  1  2  3 …", TX, 18),
    t(190, 95, "1から100までの数が円のまわりに順に書かれている", GRAY, 11),
    t(190, 112, "1からはじめて1,7,13,19,…と○をつけていく", GRAY, 11),
]))

# ══ 第8回 大問4（HG-1964）三角形2つが交わる星形（重なりは点線） ══════════
_star = [
    (200, 20), (330, 240), (150, 175), (60, 240), (250, 130),
]
_tri1 = [(200, 20), (330, 240), (60, 240)]
_tri2 = [(60, 40), (330, 130), (150, 260)]
_overlap = [(160, 100), (230, 95), (255, 150), (195, 190), (140, 165)]
FIGS["HG-1964"] = svg("0 0 400 280", "".join([
    poly(_tri1, LINE, 2.2), poly(_tri2, LINE, 2.2),
    poly(_overlap, GRAY, 1.6, "none", "4 3"),
    t(200, 262, "3辺15cm・25cm・35cmの三角形2こを重ねる。重なり(点線)は34cm", GRAY, 11),
]))

# ══ 第9回 大問3（HG-1973）5つの正多面体の見取図（簡略アイコン）＋対応表 ══
def tetra(cx, cy, s):
    a, b, c = (cx, cy - s), (cx - s, cy + s * 0.7), (cx + s, cy + s * 0.7)
    top = (cx, cy - s * 0.15)
    return [ln(*a, *b, LINE, 1.8), ln(*a, *c, LINE, 1.8), ln(*b, *c, LINE, 1.8),
            ln(*top, *b, GRAY, 1.2, "3 2"), ln(*top, *c, GRAY, 1.2, "3 2"), ln(*a, *top, LINE, 1.2)]


def cube_ico(cx, cy, s):
    x0, y0 = cx - s, cy - s
    return [rect(x0, y0, s * 2, s * 1.4, LINE, 1.8),
            ln(x0, y0, x0 + s * 0.6, y0 - s * 0.5, LINE, 1.4),
            ln(x0 + s * 2, y0, x0 + s * 2.6, y0 - s * 0.5, LINE, 1.4),
            ln(x0, y0 + s * 1.4, x0 + s * 0.6, y0 + s * 0.9, LINE, 1.4),
            ln(x0 + s * 2, y0 + s * 1.4, x0 + s * 2.6, y0 + s * 0.9, LINE, 1.4),
            ln(x0 + s * 0.6, y0 - s * 0.5, x0 + s * 2.6, y0 - s * 0.5, LINE, 1.8),
            ln(x0 + s * 0.6, y0 - s * 0.5, x0 + s * 0.6, y0 + s * 0.9, LINE, 1.8),
            ln(x0 + s * 2.6, y0 - s * 0.5, x0 + s * 2.6, y0 + s * 0.9, LINE, 1.8)]


def octa(cx, cy, s):
    top, bot, l, r = (cx, cy - s), (cx, cy + s), (cx - s, cy), (cx + s, cy)
    return [ln(*top, *l, LINE, 1.8), ln(*top, *r, LINE, 1.8), ln(*bot, *l, LINE, 1.8),
            ln(*bot, *r, LINE, 1.8), ln(*l, *r, GRAY, 1.2, "3 2")]


def poly_ico(cx, cy, s, n):
    pts_ = []
    for i in range(n):
        a = math.radians(-90 + i * 360.0 / n)
        pts_.append((cx + s * math.cos(a), cy + s * math.sin(a)))
    out = [poly(pts_, LINE, 1.6)]
    for i in range(n):
        out.append(ln(*pts_[i], *pts_[(i + 2) % n], GRAY, 0.9, "2 2"))
    return out


_p3 = []
_names = ["正四面体", "正六面体", "正八面体", "正十二面体", "正二十面体"]
_cxs = [55, 165, 275, 385, 495]
_p3 += tetra(_cxs[0], 60, 32)
_p3 += cube_ico(_cxs[1], 60, 26)
_p3 += octa(_cxs[2], 60, 34)
_p3 += poly_ico(_cxs[3], 60, 34, 5)
_p3 += poly_ico(_cxs[4], 60, 34, 6)
for cx, nm in zip(_cxs, _names):
    _p3.append(t(cx, 112, nm, TX, 11))
# 対応表（面・辺・頂点・1頂点に集まる面）は空らんのまま
TW, TH, TX0, TY0 = 90, 26, 10, 140
_hdr = ["名前", "面", "辺", "頂点", "1頂点の面"]
for c, h in enumerate(_hdr):
    _p3.append(rect(TX0 + c * TW, TY0, TW, TH, LINE, 1.4))
    _p3.append(t(TX0 + c * TW + TW / 2, TY0 + 18, h, TX, 12))
for r, nm in enumerate(_names):
    y = TY0 + TH * (r + 1)
    _p3.append(rect(TX0, y, TW, TH, LINE, 1.4))
    _p3.append(t(TX0 + TW / 2, y + 18, nm, TX, 11))
    for c in range(1, 5):
        _p3.append(rect(TX0 + c * TW, y, TW, TH, LINE, 1.4))
FIGS["HG-1973"] = svg("0 0 560 320", "".join(_p3))

# ══ 第9回 大問4（HG-1974）立方体のかどを切り取った立体（立方八面体） ══════
# ★8つの頂点それぞれで、そこに集まる3本の辺の中点を結んだ小さな三角形（＝切り口）を
#   独立に描く。全部をつなげようとすると線が交差して読めなくなるため、コーナーごとに
#   完結させる簡略化（2026-08-11・遠近感のある図は正確な多面体作図が難しいため）
_cube_d = [(90, 55), (230, 55), (265, 90), (125, 90)]   # 上面(奥から手前)
_cube_f = [(90, 195), (230, 195), (265, 160), (125, 160)]  # 下面
_dashed = []
for i in range(4):
    _dashed.append(ln(*_cube_d[i], *_cube_d[(i + 1) % 4], GRAY, 1.4, "4 3"))
    _dashed.append(ln(*_cube_f[i], *_cube_f[(i + 1) % 4], GRAY, 1.4, "4 3"))
    _dashed.append(ln(*_cube_d[i], *_cube_f[i], GRAY, 1.4, "4 3"))
mid = lambda a, b: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
_solid = []
for i in range(4):
    a = _cube_d[i]
    m1 = mid(a, _cube_d[(i + 1) % 4])
    m2 = mid(a, _cube_d[(i - 1) % 4])
    m3 = mid(a, _cube_f[i])
    _solid.append(poly([m1, m2, m3], LINE, 1.8))
for i in range(4):
    a = _cube_f[i]
    m1 = mid(a, _cube_f[(i + 1) % 4])
    m2 = mid(a, _cube_f[(i - 1) % 4])
    m3 = mid(a, _cube_d[i])
    _solid.append(poly([m1, m2, m3], LINE, 1.8))
FIGS["HG-1974"] = svg("0 0 360 240", "".join(_dashed + _solid + [
    t(180, 226, "立方体（点線）のかどを、各辺の中点まで切り取った立体", GRAY, 11),
]))

# ══ 第9回 大問6（HG-1976）サッカーボール（正五角形12・正六角形20） ═══════
SCX, SCY, SCR = 150, 95, 74
_soc = [circ(SCX, SCY, SCR, LINE, 2)]
_pent_pts = []
for i in range(5):
    a = math.radians(-90 + i * 72)
    _pent_pts.append((SCX + 32 * math.cos(a), SCY + 32 * math.sin(a)))
_soc.append(poly(_pent_pts, LINE, 1.6, 'rgba(20,26,45,0.9)'))
for i in range(6):
    a = math.radians(-90 + i * 60)
    cx6, cy6 = SCX + 58 * math.cos(a), SCY + 58 * math.sin(a)
    hexp = []
    for k in range(6):
        b = math.radians(-90 + i * 60 + k * 60)
        hexp.append((cx6 + 19 * math.cos(b), cy6 + 19 * math.sin(b)))
    _soc.append(poly(hexp, LINE, 1.3))
FIGS["HG-1976"] = svg("0 0 300 210", "".join(_soc + [
    t(150, 194, "正五角形12こと正六角形20こをぬい合わせたサッカーボール", GRAY, 11),
]))

# ══ 第9回 大問9（HG-1979）マッチ棒の直方体（たて5・横10・高さ5cm＝1×2×1マス） ═
def box_wire(x0, y0, w, h, d, nx, ny):
    out = []
    for i in range(nx + 1):
        x = x0 + i * w / nx
        out.append(ln(x, y0, x + d, y0 - d, LINE, 1.8))
        out.append(ln(x, y0 + h, x + d, y0 + h - d, LINE, 1.8))
        out.append(ln(x, y0, x, y0 + h, LINE, 1.8))
        out.append(ln(x + d, y0 - d, x + d, y0 + h - d, LINE, 1.8))
    out.append(ln(x0, y0, x0 + w, y0, LINE, 1.8))
    out.append(ln(x0, y0 + h, x0 + w, y0 + h, LINE, 1.8))
    out.append(ln(x0 + d, y0 - d, x0 + w + d, y0 - d, LINE, 1.8))
    out.append(ln(x0 + d, y0 + h - d, x0 + w + d, y0 + h - d, LINE, 1.8))
    return out


FIGS["HG-1979"] = svg("0 0 320 190", "".join(
    box_wire(50, 130, 180, 70, 40, 2, 1) + [
        t(160, 178, "5cmのマッチ棒でたて5・横10・高さ5cmの直方体＝20本", GRAY, 11),
    ]
))

# ══ 第11回 大問7（HG-1997）ある年の2月のカレンダー（1日が木曜） ══════════
_cal = []
CX0, CY0, CCW, CCH = 40, 30, 46, 32
_days = ["日", "月", "火", "水", "木", "金", "土"]
for c, d in enumerate(_days):
    _cal.append(rect(CX0 + c * CCW, CY0, CCW, CCH, LINE, 1.6))
    _cal.append(t(CX0 + c * CCW + CCW / 2, CY0 + 21, d, TX, 13))
_grid = [None, None, None, None, 1, 2, 3,
         4, 5, 6, 7, 8, 9, 10,
         11, 12, 13, 14, 15, 16, 17,
         18, 19, 20, 21, 22, 23, 24,
         25, 26, 27, 28, None, None, None]
for i, v in enumerate(_grid):
    r, c = divmod(i, 7)
    x, y = CX0 + c * CCW, CY0 + (r + 1) * CCH
    _cal.append(rect(x, y, CCW, CCH, LINE, 1.2))
    if v:
        _cal.append(t(x + CCW / 2, y + 21, str(v), TX, 13))
FIGS["HG-1997"] = svg("0 0 400 240", "".join(_cal + [
    t(200, 20, "2月", TX, 13),
    t(200, 226, "ある年の2月のカレンダー（1日は木曜日）", GRAY, 11),
]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    bad = []
    for hg, fig in FIGS.items():
        vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', fig)
        w, h = float(vb.group(1)), float(vb.group(2))
        if h / w > 0.7:
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
