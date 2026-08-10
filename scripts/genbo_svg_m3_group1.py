# -*- coding: utf-8 -*-
"""小3マスターで「図: あり」なのに図SVGが無かった5本を、PDFの実物を見て原簿に入れる。

★根拠：3年算数 各Noのpdf（G:\\マイドライブ\\浜問題\\3年算数\\）を200〜600dpiで出して目視。
  原簿に図は入っていないのでここが唯一の根拠（feedback_zu_wa_genbo_ni_nai）。

実物で確かめたこと：
  HG-0015 No.6 大問4  … 点数(点)と人数(人)の対応表。0/10/40/50/60/90/100点の7列、
            人数の欄は ⑦・4・5・①・8・4・6（⑦①は答えを聞く空欄記号で、実際の数値ではない）
  HG-0021 No.7 大問5  … 3円ベン図。A=上・B=左下・C=右下。ア(Aのみ)・イ(A∩B)・ウ(中心=A∩B∩C)・
            エ(A∩C)・オ(Bのみ)・カ(B∩C)・キ(Cのみ)・ク(外側、右上に配置)
  HG-0081 No.25大問5  … ▽△▽△…と正三角形を上下交互に辺を共有してならべた帯（棒でできている）
  HG-0091 No.28大問4  … 5列×4行の対応表。1行目1-5,2行目6-10,3行目11-15,4行目は16のみ書きこみずみ
  HG-0133 No.41大問5  … 円形メーター3つ。★注意：**3つとも目盛の数がちがう**
            （A=0〜5の6目盛／B=0〜2の3目盛／C=0〜7の8目盛）。原簿の解説文は「各針は0〜5」
            「6進カウンタ」と書いているが、実物は違う（B=3進・C=8進の混合基数）。
            図はPDFの実物どおりに描く。答え欄の数値は今回の作業範囲外なので触れない
            （別途 [[feedback_zu_wa_genbo_ni_nai]] に記録して本人に報告する）

使い方: python scripts/genbo_svg_m3_group1.py [--write]
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


def poly(seq, stroke=LINE, w=2, fill="none"):
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (pts(seq), fill, stroke, w)


def defs_arrow(mid, color=HI):
    return ('<defs><marker id="%s" markerWidth="8" markerHeight="8" refX="6.5" refY="4"'
            ' orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % (mid, color))


FIGS = {}

# ══ No.6 大問4（HG-0015）点数(点)・人数(人)の対応表 ═══════════════════════
_cols = [("0", "⑦"), ("10", "4"), ("40", "5"), ("50", "①"),
         ("60", "8"), ("90", "4"), ("100", "6")]
CW, CH, X0, Y0 = 44, 34, 78, 40
_t1 = [rect(X0 - 78, Y0, 78, CH * 2, LINE, 2),
       t(X0 - 39, Y0 + 22, "点数(点)", TX, 12), t(X0 - 39, Y0 + 22 + CH, "人数(人)", TX, 12),
       ln(X0 - 78, Y0 + CH, X0 + CW * 7, Y0 + CH, LINE, 2)]
for i, (top, bot) in enumerate(_cols):
    x = X0 + i * CW
    _t1 += [rect(x, Y0, CW, CH, LINE, 1.6),
            rect(x, Y0 + CH, CW, CH, LINE, 1.6),
            t(x + CW / 2, Y0 + 22, top, TX, 13),
            t(x + CW / 2, Y0 + CH + 22, bot, HI, 13)]
FIGS["HG-0015"] = svg("0 0 400 150", "".join(_t1 + [
    t(200, 138, "36人・A10点/B40点/C50点・合計2030点（⑦①は空欄）", GRAY, 11),
]))

# ══ No.7 大問5（HG-0021）3円ベン図（A・B・Cの倍数） ═══════════════════════
_VA, _VB, _VC, _VR = (172, 96), (132, 158), (212, 158), 66
_v2 = [
    circ(_VA[0], _VA[1], _VR, LINE, 2), circ(_VB[0], _VB[1], _VR, LINE, 2),
    circ(_VC[0], _VC[1], _VR, LINE, 2),
    t(_VA[0], _VA[1] - _VR - 8, "A", TX, 15), t(_VB[0] - _VR - 4, _VB[1] + 6, "B", TX, 15, "end"),
    t(_VC[0] + _VR + 4, _VC[1] + 6, "C", TX, 15, "start"),
    t(172, 72, "ア", TX, 13), t(142, 120, "イ", TX, 13), t(172, 145, "ウ", HI, 13),
    t(202, 120, "エ", TX, 13), t(115, 178, "オ", TX, 13), t(172, 195, "カ", TX, 13),
    t(229, 178, "キ", TX, 13), t(300, 55, "ク", TX, 13),
]
FIGS["HG-0021"] = svg("0 0 340 210", "".join(_v2 + [
    t(170, 15, "1〜60の整数を A=3の倍数・B=4の倍数・C=5の倍数 で分ける", GRAY, 11),
]))

# ══ No.25 大問5（HG-0081）▽△▽△…と正三角形を棒でつなげた帯 ═══════════════
_H, _Y = 52, 130
_tri = []
_xs = [40, 92, 144, 196]
for i, x0 in enumerate(_xs):
    down = (i % 2 == 0)
    if down:
        p = [(x0, _Y - _H), (x0 + _H, _Y - _H), (x0 + _H / 2, _Y)]
    else:
        p = [(x0, _Y), (x0 + _H, _Y), (x0 + _H / 2, _Y - _H)]
    _tri.append(poly(p, LINE, 2.4))
FIGS["HG-0081"] = svg("0 0 320 160", "".join(_tri + [
    t(272, _Y - _H / 2, "…", TX, 22),
    t(160, 148, "同じ長さの棒で正三角形を上下交互に辺を共有してつなげる", GRAY, 11),
]))

# ══ No.28 大問4（HG-0091）5列×行の対応表（8は2行3列） ═══════════════════
GW, GH, GX, GY = 46, 34, 70, 40
_g4 = [rect(GX - 40, GY, 40, GH, LINE, 2), t(GX - 20, GY + 22, "列", TX, 12),
       rect(GX - 40, GY + GH, 40, GH * 4, LINE, 2)]
for c in range(5):
    _g4 += [rect(GX + c * GW, GY, GW, GH, LINE, 1.6), t(GX + c * GW + GW / 2, GY + 22, str(c + 1), TX, 13)]
_vals = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15], [16, None, None, None, None]]
for r in range(4):
    _g4 += [t(GX - 20, GY + GH + r * GH + 22, str(r + 1), TX, 13)]
    for c in range(5):
        x, y = GX + c * GW, GY + GH + r * GH
        _g4 += [rect(x, y, GW, GH, LINE, 1.6)]
        v = _vals[r][c]
        if v is not None:
            _g4 += [t(x + GW / 2, y + 22, str(v), TX, 13)]
FIGS["HG-0091"] = svg("0 0 380 230", "".join(_g4 + [
    t(190, 224, "1行5個ずつ、8は2行3列と表す（1〜400を並べる）", GRAY, 11),
]))

# ══ No.41 大問5（HG-0133）円形メーター3つ（A:6目盛/B:3目盛/C:8目盛） ═══════
def dial(cx, cy, r, n, needle_val, label, color=TX):
    out = [circ(cx, cy, r, LINE, 2)]
    for i in range(n):
        ang = math.radians(-90 + i * 360.0 / n)
        lx = cx + (r + 16) * math.cos(ang)
        ly = cy + (r + 16) * math.sin(ang) + 4
        out.append(t(lx, ly, str(i), color, 12))
    a = math.radians(-90 + needle_val * 360.0 / n)
    out.append(ln(cx, cy, cx + r * 0.72 * math.cos(a), cy + r * 0.72 * math.sin(a), HI, 2.2))
    out.append(dot(cx, cy, 2.6, TX))
    out.append(t(cx, cy - r - 26, label, TX, 15))
    return out


_d1 = dial(78, 118, 46, 6, 1, "A")
_d2 = dial(210, 118, 34, 3, 2, "B")
_d3 = dial(330, 118, 50, 8, 3, "C")
FIGS["HG-0133"] = svg("0 0 430 230", "".join(_d1 + _d2 + _d3 + [
    t(215, 210, "Cが1回転→Bが1目盛／Bが1回転→Aが1目盛。図は(1,2,3)の状態", GRAY, 11),
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
        for c in ("#333", "#888", "#666", "#000", "#111", "#222"):
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
