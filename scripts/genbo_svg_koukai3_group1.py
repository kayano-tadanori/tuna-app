# -*- coding: utf-8 -*-
"""学年4以降に進む前に残っていた小3公開学力テストの3本（HG-0923/0928/1484）を、
   PDFの実物を見て原簿に入れる。

★根拠：2024年度 3年 公開テスト 算_国.pdf（G:\\マイドライブ\\浜問題\\公開学力テスト\\）を
  130〜800dpiで出して目視。原簿に図は入っていないのでここが唯一の根拠
  （feedback_zu_wa_genbo_ni_nai）。

実物で確かめたページ対応：
  HG-0923 … 第611回 算数2/3枚め（大問3）。20列×6行の方眼に3つの色つき図形
            （直角三角形(3,3)(5,3)(5,1)／五角形(8,1)(10,1)(11,3)(7,4)(7,3)／
            四角形(18,0)(20,3)(16,6)(13,4)）。左上に基準の(ア)マス（無地の1マス）
  HG-0928 … 第612回 算数2/3枚め（大問5）。1辺10cmの正方形を重ねる3パターン
            （[図1]単体10cm角／[図2]よこ7cm×たて4cmの重なり／[図3]☆cm×☆cmの重なり／
            [図4]3枚の階段重ね）。
            ★[図4]の右下の寸法（「6cm」の下にある小さな数字）は原本の印刷かすれで
            判読不能（800dpiでも確認できず）。原簿の答えも「92−2×(判読不能値)」の
            まま。この図はラベルの位置だけ実物どおりに再現し、値は「？cm」とした
  HG-1484 … 第617回 算数2/3枚め（大問3）。1〜80が8列にならんだ表（実物は1〜40までが
            見えて…で続く）。まん中10の例＝上2・左9・右11・下18を太線の十字で囲む

使い方: python scripts/genbo_svg_koukai3_group1.py [--write]
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


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    pts = " ".join("%s,%s" % (r1(a), r1(b)) for a, b in seq)
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (pts, fill, stroke, w, d)


FIGS = {}

# ══ 第611回 大問3（HG-0923）20列×6行の方眼に3つの色つき図形 ══════════════
CS9, OX9, OY9 = 22, 46, 40
_g9 = []
for i in range(21):
    x = OX9 + i * CS9
    _g9.append(ln(x, OY9, x, OY9 + 6 * CS9, GRAY, 1))
for j in range(7):
    y = OY9 + j * CS9
    _g9.append(ln(OX9, y, OX9 + 20 * CS9, y, GRAY, 1))
_g9.append(rect(OX9, OY9, CS9, CS9, LINE, 1.4, "rgba(154,163,192,0.4)"))  # 基準の(ア)マス


def gpt9(gx, gy):
    return (OX9 + gx * CS9, OY9 + gy * CS9)


_shapes9 = [
    ([(3, 3), (5, 3), (5, 1)], "(1)", 4),
    ([(8, 1), (10, 1), (11, 3), (7, 4), (7, 3)], "(2)", 9),
    ([(18, 0), (20, 3), (16, 6), (13, 4)], "(3)", 16.5),
]
for gpts, lab, labx in _shapes9:
    _g9.append(poly([gpt9(gx, gy) for gx, gy in gpts], LINE, 1.8, "rgba(79,158,255,0.38)"))
    _g9.append(t(*gpt9(labx, 0), "", TX))  # placeholder (no-op, keeps helper symmetry)
    lx, _ = gpt9(labx, 0)
    _g9.append(t(lx, OY9 - 10, lab, HI, 13))
FIGS["HG-0923"] = svg("0 0 %d %d" % (OX9 + 20 * CS9 + 20, OY9 + 6 * CS9 + 34), "".join(_g9 + [
    t((OX9 + 20 * CS9) / 2 + OX9 / 2, OY9 + 6 * CS9 + 24,
      "20列×6行の方眼。左上の無地の1マスが(ア)。色のついた(1)〜(3)は(ア)の何こ分か", GRAY, 11),
]))

# ══ 第612回 大問5（HG-0928）1辺10cmの正方形を重ねる3パターン ═════════════
K = 7  # 1cm=7px
SQ = 10 * K


def two_sq(x0, y0, ow, oh, lab1, lab2):
    """square1(細)を左下、square2(太)を右上に、右上コーナーで ow×oh 重ねる"""
    sx1, sy1 = x0, y0
    sx2, sy2 = x0 + SQ - ow, y0 - (SQ - oh)
    out = [rect(sx1, sy1, SQ, SQ, LINE, 1.6), rect(sx2, sy2, SQ, SQ, LINE, 2.4)]
    cx, cy = x0 + SQ - ow, y0
    out += [ln(cx, cy, cx + ow, cy, HI, 1.6), t(cx + ow / 2, cy - 6, lab1, HI, 12)]
    out += [ln(cx, cy, cx, cy + oh, HI, 1.6), t(cx - 8, cy + oh / 2 + 4, lab2, HI, 12, "end")]
    return out


_b28 = []
CAP_Y = 195  # [図n]キャプションは全グループ共通のこの高さにそろえる
# [図1] 単体10cm角
X1, Y1 = 40, 60
_b28 += [rect(X1, Y1, SQ, SQ, LINE, 1.8),
         t(X1 + SQ / 2, Y1 - 10, "10cm", TX, 12),
         t(X1 - 10, Y1 + SQ / 2 + 4, "10cm", TX, 12, "end"),
         t(X1 + SQ / 2, CAP_Y, "[図1]", GRAY, 11)]
# [図2] よこ7cm×たて4cmの重なり
X2, Y2 = 230, 60 + (SQ - 4 * K)
_b28 += two_sq(X2, Y2, 7 * K, 4 * K, "7cm", "4cm")
_b28.append(t(X2 + SQ / 2, CAP_Y, "[図2]", GRAY, 11))
# [図3] ☆cm×☆cmの重なり（未知）
X3, Y3 = 440, 60 + (SQ - 5 * K)
_b28 += two_sq(X3, Y3, 5 * K, 5 * K, "☆cm", "☆cm")
_b28.append(t(X3 + SQ / 2, CAP_Y, "[図3]", GRAY, 11))
# [図4] 3枚の階段重ね（右下の1寸法は原本が判読不能）
X4, Y4 = 660, 40
OV4 = 12  # 横の重なり幅（実物からは正確に読めないため見た目だけ合わせた概算。B・Cを離して重ならないようにする）
xB, yB = X4 + SQ - OV4, Y4 + SQ - 6 * K
xC, yC = X4 - (SQ - OV4), Y4 + SQ - 6 * K
_b28 += [rect(X4, Y4, SQ, SQ, LINE, 2.2), rect(xB, yB, SQ, SQ, LINE, 1.6), rect(xC, yC, SQ, SQ, LINE, 1.6)]
_b28 += [ln(xB, yB, xB, yB + 6 * K, HI, 1.6), t(xB + 8, yB + 3 * K + 4, "6cm", HI, 12, "start")]
_b28 += [ln(xC + SQ, yC, xC + SQ, yC + 6 * K, HI, 1.6), t(xC + SQ - 8, yC - 6, "6cm", HI, 12, "end")]
_b28 += [ln(xB + SQ, yB - 14, xB + SQ + 20, yB - 14, GRAY, 1.2),
         t(xB + SQ + 24, yB - 10, "2cm", GRAY, 11, "start")]
_b28 += [t((xB + xC + SQ) / 2, yB + SQ + 14, "？cm", GRAY, 12)]
_b28.append(t(X4 + SQ / 2, CAP_Y, "[図4]", GRAY, 11))
FIGS["HG-0928"] = svg("0 0 900 220", "".join(_b28 + [
    t(450, 212, "1辺10cmの正方形を重ねる。[図4]右下の1つの寸法は原本の印刷かすれで判読不能",
      GRAY, 11),
]))

# ══ 第617回 大問3（HG-1484）1〜80が8列にならんだ表・十字5マス ═══════════
CS4, OX4, OY4, COLS, ROWS = 30, 90, 25, 8, 5
_t4 = []
for c in range(COLS + 1):
    x = OX4 + c * CS4
    _t4.append(ln(x, OY4, x, OY4 + ROWS * CS4, GRAY, 1))
for r in range(ROWS + 1):
    y = OY4 + r * CS4
    _t4.append(ln(OX4, y, OX4 + COLS * CS4, y, GRAY, 1))
for r in range(ROWS):
    for c in range(COLS):
        v = r * COLS + c + 1
        _t4.append(t(OX4 + c * CS4 + CS4 / 2, OY4 + r * CS4 + CS4 / 2 + 4, str(v), TX, 12))
# 太線の十字（まん中10の例＝上2・左9・右11・下18）
CR, CC = 1, 1  # 10の位置（0始まり：行1・列1）
_cross = [
    (CC, CR - 1), (CC + 1, CR - 1), (CC + 1, CR), (CC + 2, CR), (CC + 2, CR + 1),
    (CC + 1, CR + 1), (CC + 1, CR + 2), (CC, CR + 2), (CC, CR + 1), (CC - 1, CR + 1),
    (CC - 1, CR), (CC, CR),
]
_t4.append(poly([(OX4 + gx * CS4, OY4 + gy * CS4) for gx, gy in _cross], HI, 2.6))
_t4.append(t(OX4 + COLS * CS4 / 2, OY4 + ROWS * CS4 + 20, "…（80まで続く）", GRAY, 12))
FIGS["HG-1484"] = svg("0 0 420 215", "".join(_t4 + [
    t(210, 205, "1〜80が8列にならんだ表。まん中10なら上2・左9・右11・下18（太線）", GRAY, 11),
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
