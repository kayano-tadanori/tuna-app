# -*- coding: utf-8 -*-
"""小5 2nd演習の2本（HG-0511/HG-0606）。アプリに「2nd演習」コースが無いので
   大問は作れない＝原簿の図SVG欄だけ埋める（sync_genbo_svg.pyでは反映されない）。

★根拠：
  G:\\マイドライブ\\浜問題\\5年算数\\算数2nd 演習No.1〜No.6.pdf（HG-0511、No.6の6枚目）
  G:\\マイドライブ\\浜問題\\5年算数\\算数2nd 演習No.11〜No.14.pdf（HG-0606、No.13の3枚目）
  を110〜400dpiで出して目視。

実物で確かめたページ対応：
  HG-0511 … No.6大問5。7で割ったあまりで7組A〜Gに分ける数表。
             見出しA B C D E F G、1〜35を横書き7個ずつ5行、最下段に⋮
  HG-0606 … No.13大問8。縦長の長方形2つが斜めにずれて重なる図。大きい方が
             左上（グレーの網かけ）、小さい方が右下（斜線）、重なり部分は
             両方の柄が交わるクロスハッチで示される。寸法の数値は入っていない

使い方: python scripts/genbo_svg_m5_2nd_group1.py [--write]
"""
import io, os, re, sys, argparse

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


def rect(x, y, w, h, stroke=LINE, sw=2, fill="none", opacity=None):
    o = ' fill-opacity="%s"' % opacity if opacity is not None else ''
    return '<rect x="%s" y="%s" width="%s" height="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        r1(x), r1(y), r1(w), r1(h), fill, stroke, sw, o)


FIGS = {}

# ══ No.6 大問5（HG-0511）7で割ったあまりの7組A〜G ═══════════════════════
COLS = list("ABCDEFG")
GX, GY, CW, CH = 40, 34, 44, 30
_g5 = []
for c, lab in enumerate(COLS):
    _g5.append(t(GX + c * CW + CW / 2, GY - 10, lab, HI, 13))
n = 1
for r in range(5):
    for c in range(7):
        x = GX + c * CW
        y = GY + r * CH
        _g5.append(rect(x, y, CW, CH, LINE, 1.4))
        _g5.append(t(x + CW / 2, y + 20, str(n), TX, 13))
        n += 1
_g5.append(t(GX + 3.5 * CW, GY + 5 * CH + 22, "⋮（すべての整数について同じ規則で続く）", GRAY, 11))
FIGS["HG-0511"] = svg("0 0 360 220", "".join(_g5))

# ══ No.13 大問8（HG-0606）大小2つの長方形が斜めにずれて重なる ═══════════════
BX, BY, BW, BH = 30, 15, 110, 130
DX, DY, SW_, SH = 85, 95, 105, 115
_r6 = [
    rect(BX, BY, BW, BH, LINE, 2, LINE, 0.28),
    rect(DX, DY, SW_, SH, HI, 2, HI, 0.28),
    t(BX + 30, BY + 55, "大", TX, 15),
    t(DX + 62, DY + 80, "小", TX, 15),
    t((DX + BX + BW) / 2, (DY + BY + BH) / 2 + 4, "重なり", HI, 12),
]
FIGS["HG-0606"] = svg("0 0 380 260", "".join(_r6 + [
    t(190, 245, "縦長の長方形2つが角どうしで重なる（寸法の数値は入っていない）", GRAY, 11),
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
