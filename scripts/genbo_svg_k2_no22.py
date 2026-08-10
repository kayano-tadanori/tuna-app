# -*- coding: utf-8 -*-
"""第2講座 No.22「速さ(4)」の図を、PDFの実物を見て原簿に入れる。

★根拠：小5最レ算数 第3分冊 第2講座.pdf の PDFページ7〜12（本文p8-13）を
  200dpi＋部分500/900dpiで出して目視。原簿に図は無いのでここが唯一の根拠。

★★実物を見て分かったいちばん大事なこと（2026-08-10）★★
  この回は **16問のうち14問は本文に図が無い**。原簿の「解答のダイヤ図」などの記述は
  **解答冊子の解説に図がある**という意味であって、問題ページに図がある意味ではない。
  解答の図を問題のとなりに出したら、解き方を先に渡してしまう。だから描かない。
  本文に図があるのは 大問3（HG-3800）と 大問15（HG-3812）の2問だけ。

実物で確かめたこと：
  大問3（HG-3800）… 横1本の線に ● が4つ。左から 西・C・D・東。**数字は一切書いていない**
  大問15（HG-3812）… A（左下）—B（頂上）—C（右下）の への字（坂道）。
                      BC のほうが AB より長く描いてある。**数字は書いていない**

使い方: python scripts/genbo_svg_k2_no22.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'


def r1(v):
    return round(v, 1) if isinstance(v, float) else v


def svg(vb, body):
    return '<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (vb, S, body)


def t(x, y, s, fill=TX, size=13, anchor="middle", extra=""):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s"%s>%s</text>' % (
        r1(x), r1(y), size, anchor, fill, extra, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), stroke, w, d)


def dot(x, y, c=LINE, r=5):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r1(x), r1(y), r, c)


def dim(x1, y1, x2, y2, label, off=12, side=1, size=12):
    """★寸法線。「どの辺のどこが何mか」が分かるように、測っている線分に沿って
       細線を引き、両端に爪を付け、中央にラベルを置く（本人指示 2026-08-11）。
       1本の辺が分かれているときは、区間ごとにこれを呼ぶ（まとめない）。"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = nx / off * 4, ny / off * 4
    return "".join([
        ln(ax, ay, bx, by, GRAY, 1.2),
        ln(ax - tx, ay - ty, ax + tx, ay + ty, GRAY, 1.2),
        ln(bx - tx, by - ty, bx + tx, by + ty, GRAY, 1.2),
        t((ax + bx) / 2 + nx * 0.85, (ay + by) / 2 + ny * 0.85 + 4, label, TX, size),
    ])


FIGS = {}

# ── 大問3（HG-3800）西—C—D—東 の線分図 ─────────────────────────
# 実物：横1本の線に●が4つ、上に 西・C・D・東 の文字。数字も矢印も無い。
#      間かくは 西—C ≒ C—D ＜ D—東（右がすこし長い）。そのまま写す。
_X = {"西": 60, "C": 190, "D": 315, "東": 480}
FIGS["HG-3800"] = svg("0 0 540 160", "".join(
    [ln(_X["西"], 95, _X["東"], 95, LINE, 2.4)] +
    [dot(x, 95) for x in _X.values()] +
    [t(x, 74, k, TX, 15) for k, x in _X.items()] +
    [t(270, 136, "A君もB君も 西地 から 東地 へ向かう", GRAY, 12)]
))

# ── 大問15（HG-3812）A—B—C の坂道（への字）─────────────────────
# 実物：Aが左下、Bが頂上、Cが右下でAよりわずかに低い。BCのほうがABより長い。
#      数字は書いていない（分速100m・45分などは本文の文章にしかない）。
_A, _B, _C = (70, 175), (215, 70), (480, 190)
FIGS["HG-3812"] = svg("0 0 540 250", "".join([
    ln(_A[0], _A[1], _B[0], _B[1], LINE, 3.2),
    ln(_B[0], _B[1], _C[0], _C[1], LINE, 3.2),
    dot(_A[0], _A[1]), dot(_B[0], _B[1]), dot(_C[0], _C[1]),
    t(_A[0] - 12, _A[1] - 6, "A", TX, 16, "end"),
    t(_B[0] - 4, _B[1] - 14, "B", TX, 16),
    t(_C[0] + 12, _C[1] + 4, "C", TX, 16, "start"),
    # どの区間が「AB」「BC」なのかを、線に沿った寸法線で示す（数値は本文に無いので名前だけ）。
    # 頂点Bのところで2本の爪がぶつからないよう、両はしを少し内側に寄せる。
    dim(_A[0] + 0.10 * (_B[0] - _A[0]), _A[1] + 0.10 * (_B[1] - _A[1]),
        _A[0] + 0.90 * (_B[0] - _A[0]), _A[1] + 0.90 * (_B[1] - _A[1]), "AB間", 18, 1),
    dim(_B[0] + 0.10 * (_C[0] - _B[0]), _B[1] + 0.10 * (_C[1] - _B[1]),
        _B[0] + 0.90 * (_C[0] - _B[0]), _B[1] + 0.90 * (_C[1] - _B[1]), "BC間", 18, 1),
    t(270, 232, "太郎君はAから、次郎君はCから同時に出発してAC間を一往復する", GRAY, 12),
]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
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
    print("※ 残る14問（HG-3798/3799/3801〜3811/3813）は **本文に図が無い**ので描かない。")
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("✅ 原簿に書き込み完了")


if __name__ == "__main__":
    main()
