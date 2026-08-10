# -*- coding: utf-8 -*-
"""小4マスターで「図: あり」なのに図SVGが無かった5本を、PDFの実物を見て原簿に入れる。

★根拠：4年算数 各No.のpdf（G:\\マイドライブ\\浜問題\\4年算数\\）を200dpiで出して目視。
  原簿に図は入っていないのでここが唯一の根拠（feedback_zu_wa_genbo_ni_nai）。

実物で確かめたページ対応：
  HG-0811 … No.6大問6。44)□□□／38)□□□の筆算2本。商5.5・6.3、引く数220・228、
            あまりの十の位に□□0、最後にア0・イ6の答え欄
  HG-0822 … No.12大問6。18.6cmのテープ3本を、11mmずつ重ねて（のりしろのように）つなぐ
  HG-0831 … No.18大問8。1辺12cmの正方形4まいを3cmずつ階段状にずらして重ねる
  HG-0833 … No.19大問8。長方形ABCD（36cm×54cm）を対角線BDで折り返す。
            折れたAは(A)の位置に、A'D延長とBCの交点がE、EC=15cm
  HG-0860 … No.32大問4。★実物で確認：容器㋐は20cm×14cm×15cm（壁厚2cm）、
            容器㋑は34cm×18cm×22cm。（原簿は㋐の寸法が「未確定」だったが解決した）

使い方: python scripts/genbo_svg_m4master_group1.py [--write]
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


def dim(x1, y1, x2, y2, label, off=12, side=1, size=12, col=TX):
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = -nx / off * 4, -ny / off * 4
    return "".join([
        ln(ax, ay, bx, by, GRAY, 1.2),
        ln(ax - tx, ay - ty, ax + tx, ay + ty, GRAY, 1.2),
        ln(bx - tx, by - ty, bx + tx, by + ty, GRAY, 1.2),
        t((ax + bx) / 2 + nx / off * 11, (ay + by) / 2 + ny / off * 11 + 4, label, col, size),
    ])


FIGS = {}

# ══ No.6 大問6（HG-0811）44)□□□ と 38)□□□ の筆算 ═══════════════════
def division(x0, y0, divisor, sub, rem_lab, quotient):
    out = [t(x0 - 8, y0 + 24, divisor, TX, 15, "end"), ln(x0, y0 + 8, x0, y0 + 34, LINE, 1.8),
           ln(x0, y0 + 8, x0 + 90, y0 + 8, LINE, 1.8), t(x0 + 45, y0 - 4, quotient, TX, 15)]
    for i in range(3):
        out.append(rect(x0 + 4 + i * 28, y0 + 12, 24, 24, LINE, 1.4))
    out.append(t(x0 + 45, y0 + 50, sub, TX, 14))
    out.append(ln(x0 + 4, y0 + 58, x0 + 90, y0 + 58, GRAY, 1.2))
    out += [rect(x0 + 32 + i * 28, y0 + 62, 24, 24, LINE, 1.4) for i in range(2)]
    out.append(t(x0 + 85, y0 + 80, "0", TX, 14))
    out.append(rect(x0 + 20, y0 + 128, 24, 24, LINE, 1.4))
    out.append(t(x0 + 46, y0 + 146, rem_lab, HI, 15))
    return out


_d1 = division(80, 40, "44", "220", "0", "5.5")
_d2 = division(260, 40, "38", "228", "6", "6.3")
FIGS["HG-0811"] = svg("0 0 360 210", "".join(_d1 + _d2 + [
    t(180, 196, "同じ3けたの整数を44・38でわる。ア・イは0でない整数", GRAY, 11),
]))

# ══ No.12 大問6（HG-0822）18.6cmのテープ3本を11mmずつ重ねてつなぐ ═══════
_tp = [rect(40, 60, 300, 44, LINE, 2)]
for i in range(1, 3):
    x = 40 + i * 100
    _tp.append(ln(x, 55, x, 109, GRAY, 1.4, "4 3"))
    _tp.append(t(x, 122, "11mm", TX, 11))
for i in range(3):
    x0 = 40 + i * 100
    _tp.append('<path d="M%.1f,50 Q%.1f,30 %.1f,50" fill="none" stroke="%s" stroke-width="1.6"/>' % (
        x0, x0 + 50, x0 + 100, LINE))
    _tp.append(t(x0 + 50, 26, "18.6cm", TX, 12))
FIGS["HG-0822"] = svg("0 0 380 150", "".join(_tp + [
    t(190, 140, "18.6cmのテープを、11mmのつなぎ目を作ってつないでいく", GRAY, 11),
]))

# ══ No.18 大問8（HG-0831）12cm正方形4まいを3cmずつ階段状にずらす ══════════
_sq4 = []
S8, D8 = 100, 25
for i in range(4):
    x, y = 30 + i * D8, 30 + i * D8
    _sq4.append(rect(x, y, S8, S8, LINE, 1.6))
_sq4.append(t(30 + 1.5 * D8 + S8 + 10, 30 + 1.5 * D8, "3cmずつ", HI, 11, "start"))
# 外周の太線（4枚を合成したL字階段の輪郭）
outline = [(30, 30), (130, 30), (130, 55), (155, 55), (155, 80), (180, 80), (180, 105),
           (205, 105), (205, 205), (105, 205), (105, 180), (80, 180), (80, 155), (55, 155),
           (55, 130), (30, 130)]
_sq4.append(poly(outline, HI, 2.6))
FIGS["HG-0831"] = svg("0 0 400 235", "".join(_sq4 + [
    t(200, 224, "1辺12cmの正方形紙4まいを、右へ3cm・下へ3cmずつずらして重ねる（太線＝外周）", GRAY, 11),
]))

# ══ No.19 大問8（HG-0833）長方形ABCDを対角線BDで折る ═══════════════════
AX, AY, DX, DY, BX, BY, CX, CY = 70, 50, 300, 50, 70, 190, 300, 190
FIGS["HG-0833"] = svg("0 0 380 260", "".join([
    rect(AX, AY, DX - AX, BY - AY, LINE, 2),
    t(AX - 8, AY + 4, "(A)", TX, 13, "end"), t(DX + 8, DY + 4, "D", TX, 13, "start"),
    t(BX - 8, BY + 14, "B", TX, 13, "end"), t(CX + 8, CY + 14, "C", TX, 13, "start"),
    ln(BX, BY, DX, DY, HI, 2),
    ln(DX, DY, BX + (CX - BX) * 0.72, BY - 45, HI, 1.8, "3 3"),
    t(BX + (CX - BX) * 0.72 - 6, BY - 50, "A'", TX, 12, "end"),
    '<circle cx="%s" cy="%s" r="3.2" fill="%s"/>' % (r1(BX + (CX - BX) * 0.4), r1(BY), TX),
    t(BX + (CX - BX) * 0.4, BY + 16, "E", TX, 12),
    dim(AX, AY, DX, DY, "54cm", 14, -1),
    dim(AX, AY, BX, BY, "36cm", 14, -1),
    dim(BX + (CX - BX) * 0.4, BY, CX, CY, "15cm", 22, 1),
    t(200, 244, "長方形ABCD（たて36cm・よこ54cm）を対角線BDで折る。A'D延長とBCの交点がE", GRAY, 11),
]))

# ══ No.32 大問4（HG-0860）容器㋐20×14×15・容器㋑34×18×22（壁厚2cm） ═════
def tank(x0, y0, w, d, h, label, wcm, dcm, hcm):
    ox, oy = x0, y0
    front = [(ox, oy + h), (ox + w, oy + h), (ox + w, oy), (ox, oy)]
    out = [ln(ox, oy + h, ox + w, oy + h, LINE, 2), ln(ox, oy, ox, oy + h, LINE, 2),
           ln(ox + w, oy, ox + w, oy + h, LINE, 2),
           ln(ox, oy, ox + d * 0.4, oy - d * 0.4, LINE, 1.6),
           ln(ox + w, oy, ox + w + d * 0.4, oy - d * 0.4, LINE, 1.6),
           ln(ox + d * 0.4, oy - d * 0.4, ox + w + d * 0.4, oy - d * 0.4, LINE, 1.6),
           ln(ox + d * 0.4, oy - d * 0.4, ox + d * 0.4, oy + h - d * 0.4, GRAY, 1.2, "3 3"),
           t(ox + w / 2, oy + h + 24, label, TX, 14),
           dim(ox, oy + h, ox + w, oy + h, wcm, 14, 1),
           dim(ox, oy, ox, oy + h, hcm, 16, -1),
           t(ox + w + d * 0.4 + 10, oy - d * 0.2 + h / 2, dcm, TX, 11, "start")]
    return out


FIGS["HG-0860"] = svg("0 0 540 260", "".join(
    tank(60, 40, 100, 70, 90, "㋐", "20cm", "14cm", "15cm")
    + tank(320, 30, 150, 80, 110, "㋑", "34cm", "18cm", "22cm")
    + [t(270, 244, "厚さ2cmの木のふたなし容器。㋐20×14×15cm・㋑34×18×22cm（外のり）", GRAY, 11)]
))


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
