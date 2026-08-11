# -*- coding: utf-8 -*-
"""学年4の理科の最後、2025年度4年公開学力テスト理科の6本
   （HG-1651〜1655・HG-2866）を、PDFの実物を見て原簿に入れる。これで学年4は完了。

★根拠：G:\\マイドライブ\\浜問題\\公開学力テスト\\2025年度 4年 公開テスト理科.pdf
  （45ページ）を150〜400dpiで出して目視。
  電池・豆電球・台ばかりの描き方は必ず[[feedback_denchi_kigou_sahou]]の作法に従う。

実物で確かめたページ対応：
  HG-1651 … 第623回p3。はしご状の回路。左端＝かん電池+スイッチ1（直列）。
            col2＝スイッチ2+電池、col3＝豆電球、col4＝電池→中間の点J→
            (右へ)J2→スイッチ4+電池(行き止まり)／(下へ)スイッチ3→下段
            ⚠電池の＋−向きは原本からは確定できない
  HG-1652 … 第625回p9。同じ大きさの円形かがみ3枚の重なり（ベン図、ア〜キの7領域）
  HG-1653 … 第626回p13。天井+ゴムひも+おもり+表(10,20,26,30,40,48,52,60g /
            30,35,38,40,45,49,51,55cm)
  HG-1654 … 第627回p17。[図1]ぼう+4方位の十字の斜視図(A左上/B左/D右/C右下)／
            [図2]真上から見た十字(A上/B左/C下/D右)+右向き3本の太いかげ
            (あ右上/い右/う右下)
  HG-1655 … 第628回p21。7たん子バス線。A(電池)→バス→B・C(電池,同じ点で合流)→
            バス→E(電池,下の枝)→バス→D(電池)・F(電池,下の枝)→G(直結,右はし)
  HG-2866 … 第624回p6。[図1]ぬいばり(S極でこする、P→Q)／[図2]棒磁石(左N黒/右S白)
            +A(上)B(左)C(下)D(右)／[図3]ばねばかり+じしゃくあ(200g,上S下N)+
            下から近づけるじしゃくい(上S下N)

使い方: python scripts/genbo_svg_koukai4_group6.py [--write]
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


def dot(cx, cy, r=4, fill=TX):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r1(cx), r1(cy), r1(r), fill)


def pts(seq):
    return " ".join("%s,%s" % (r1(x), r1(y)) for x, y in seq)


def poly(seq, stroke=LINE, w=2, fill="none", dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s/>' % (
        pts(seq), fill, stroke, w, d)


def defs_arrow(mid, color=HI):
    return ('<defs><marker id="%s" markerWidth="8" markerHeight="8" refX="6.5" refY="4"'
            ' orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="%s"/></marker></defs>' % (mid, color))


def battery2(x1, y1, x2, y2, plus_end=2, body=22, thick=14, bump=6):
    """(x1,y1)-(x2,y2) の間に、＋側にでっぱりのある電池を置く（plus_end=1なら1側が＋）"""
    L = math.hypot(x2 - x1, y2 - y1) or 1
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    ang = math.degrees(math.atan2(y2 - y1, x2 - x1))
    out = [ln(x1, y1, mx - ux * body / 2, my - uy * body / 2, LINE, 1.8),
           ln(mx + ux * body / 2, my + uy * body / 2, x2, y2, LINE, 1.8)]
    bump_x = -body / 2 - bump if plus_end == 1 else body / 2
    out.append('<g transform="translate(%s,%s) rotate(%s)">%s%s</g>' % (
        r1(mx), r1(my), r1(ang),
        rect(-body / 2, -thick / 2, body, thick, LINE, 1.8),
        rect(bump_x, -thick * 0.3, bump, thick * 0.6, LINE, 1.8, LINE)))
    return out


def switch(x1, y1, x2, y2, open_gap=0.35):
    """スイッチ（開いた状態：てこ状の線）"""
    L = math.hypot(x2 - x1, y2 - y1) or 1
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    gx, gy = x1 + ux * L * open_gap, y1 + uy * L * open_gap
    lx, ly = x1 + ux * L * (open_gap + 0.28), y1 + uy * L * (open_gap + 0.28) - 12
    return [ln(x1, y1, gx, gy, LINE, 1.8), dot(gx, gy, 2.5, TX),
            ln(gx, gy, lx, ly, LINE, 1.8), ln(x2, y2, x2 - ux * L * (1 - open_gap - 0.28), y2 - uy * L * (1 - open_gap - 0.28), LINE, 1.8)]


def bulb(cx, cy, r=9):
    return [circ(cx, cy, r, LINE, 1.6),
            ln(cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55, LINE, 1.3),
            ln(cx - r * 0.55, cy + r * 0.55, cx + r * 0.55, cy - r * 0.55, LINE, 1.3)]


def magnet(x, y, w, h, n_left=True, vertical=False):
    half = (h if vertical else w) / 2
    if vertical:
        out = [rect(x, y, w, half, LINE, 1.8, "#2a3560" if not n_left else "none"),
               rect(x, y + half, w, half, LINE, 1.8, "none" if not n_left else "#2a3560")]
        out.append(t(x + w / 2, y + half / 2 + 4, "S" if n_left else "N", TX if n_left else HI, 12))
        out.append(t(x + w / 2, y + half + half / 2 + 4, "N" if n_left else "S", HI if n_left else TX, 12))
    else:
        nx, sx = (x, x + half) if n_left else (x + half, x)
        out = [rect(x, y, half, h, LINE, 1.8, "#2a3560"), rect(x + half, y, half, h, LINE, 1.8, "none")]
        out.append(t(nx + half / 2, y + h / 2 + 5, "N", HI, 13))
        out.append(t(sx + half / 2, y + h / 2 + 5, "S", TX, 13))
    return out


def rubber(cx, y0, h, label):
    return ['<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="6"/>' % (
        r1(cx - 30), r1(y0), r1(cx + 30), r1(y0), GRAY),
        ln(cx, y0, cx, y0 + h, LINE, 2.2), circ(cx, y0 + h + 13, 12, LINE, 2),
        t(cx, y0 + h + 36, label, GRAY, 10)]


def table_row(label, vals, ox, oy, cw=42, ch=24, lw=110):
    out = [rect(ox, oy, lw, ch, LINE, 1.3), t(ox + lw / 2, oy + 17, label, HI, 10)]
    for c, v in enumerate(vals):
        out.append(rect(ox + lw + c * cw, oy, cw, ch, LINE, 1.1))
        out.append(t(ox + lw + c * cw + cw / 2, oy + 17, str(v), TX, 11))
    return out


FIGS = {}

# ══ 第623回 大問3(2)（HG-1651）はしご状の回路。スイッチ1〜4・電池4個・豆電球1個 ═
TX0, TY0, BY0 = 60, 30, 190
X1, X2, X3, X4, X5 = 60, 160, 260, 380, 470
_b51 = [ln(X1, TY0, X4, TY0, LINE, 2)]  # 上段
_b51 += battery2(X1, TY0, X1, TY0 + 40, plus_end=1)
_b51 += switch(X1, TY0 + 40, X1, BY0)
_b51 += [dot(X1, TY0), t(X1, TY0 - 10, "A", TX, 12)]
_b51 += switch(X2, TY0, X2, TY0 + 35)
_b51 += battery2(X2, TY0 + 35, X2, TY0 + 75, plus_end=1)
_b51 += [ln(X2, TY0 + 75, X2, BY0, LINE, 1.8), t(X2, TY0 - 10, "スイッチ2", GRAY, 9)]
_b51 += bulb((X3), (TY0 + BY0) / 2)
_b51 += [ln(X3, TY0, X3, (TY0 + BY0) / 2 - 9, LINE, 1.8), ln(X3, (TY0 + BY0) / 2 + 9, X3, BY0, LINE, 1.8),
          t(X3, TY0 - 10, "豆電球", GRAY, 9)]
JY = (TY0 + BY0) / 2 - 20
_b51 += battery2(X4, TY0, X4, TY0 + 40, plus_end=1)
_b51 += [ln(X4, TY0 + 40, X4, JY, LINE, 1.8), dot(X4, JY), t(X4, TY0 - 10, "D", TX, 12)]
_b51 += switch(X4, JY, X4, BY0)
_b51 += [ln(X4, JY, X5, JY, LINE, 1.8), dot(X5, JY), t(X4 + 25, JY - 8, "スイッチ3", GRAY, 9, "start")]
_b51 += switch(X5, JY, X5, JY + 40)
_b51 += battery2(X5, JY + 40, X5, JY + 80, plus_end=1)
_b51 += [t(X5, JY + 100, "スイッチ4\n（行き止まり）", GRAY, 9)]
_b51 += [ln(X1, BY0, X4, BY0, LINE, 2)]
FIGS["HG-1651"] = svg("0 0 540 260", "".join(_b51 + [
    t(270, 252, "はしご状の回路。スイッチ4の枝は他とつながっていない（行き止まり）", GRAY, 11),
]))

# ══ 第625回 大問4(1)（HG-1652）3枚の円形かがみの重なり（ベン図） ═══════════
R52 = 65
C1 = (180, 100)
C2 = (140, 165)
C3 = (220, 165)
_b52 = [circ(*C1, R52, LINE, 1.6), circ(*C2, R52, LINE, 1.6), circ(*C3, R52, LINE, 1.6)]
for lab, (x, y) in {
    "ア": (180, 60), "イ": (145, 118), "ウ": (215, 118), "エ": (180, 148),
    "オ": (105, 175), "カ": (180, 195), "キ": (255, 175),
}.items():
    _b52.append(t(x, y, lab, TX, 13))
FIGS["HG-1652"] = svg("0 0 360 240", "".join(_b52 + [
    t(180, 232, "同じ大きさの円形かがみ3枚の反射光が重なった、日かげのかべの7領域", GRAY, 11),
]))

# ══ 第626回 大問4（HG-1653）天井+ゴムひも+おもり+表 ═══════════════════
_b53 = rubber(50, 20, 50, "[図]ゴムひも")
_b53 += table_row("おもり(g)", [10, 20, 26, 30, 40, 48, 52, 60], 130, 25, 40)
_b53 += table_row("ゴムひもの長さ(cm)", [30, 35, 38, 40, 45, 49, 51, 55], 130, 49, 40, 24, 150)
FIGS["HG-1653"] = svg("0 0 620 130", "".join(_b53 + [
    t(310, 122, "天井につるしたゴムひもにいろいろな重さのおもりをつるした", GRAY, 11),
]))

# ══ 第627回 大問4（HG-1654）ぼう+十字の斜視図／真上から見たかげ（右向き3本） ═
_b54 = []
PX, PY = 100, 130
_b54 += [ln(PX - 60, PY, PX + 60, PY, LINE, 1.6), ln(PX - 40, PY - 30, PX + 30, PY + 40, LINE, 1.6)]
_b54 += [rect(PX - 6, PY - 60, 12, 60, LINE, 1.8), t(PX, PY - 66, "ぼう", TX, 11)]
_b54 += [t(PX - 45, PY - 35, "A", TX, 12, "end"), t(PX - 68, PY + 4, "B", TX, 12, "end"),
          t(PX + 68, PY + 4, "D", TX, 12, "start"), t(PX + 35, PY + 48, "C", TX, 12, "start")]
_b54 += [t(PX, PY + 68, "[図1]（横から見た図）", GRAY, 10)]
EX54, EY54 = 330, 130
_b54 += [ln(EX54, EY54 - 60, EX54, EY54 + 60, LINE, 1.4), ln(EX54 - 60, EY54, EX54 + 60, EY54, LINE, 1.4)]
_b54 += [t(EX54, EY54 - 68, "A", TX, 12), t(EX54 - 74, EY54 + 4, "B", TX, 12, "end"),
          t(EX54, EY54 + 70, "C", TX, 12), t(EX54 + 92, EY54 + 4, "D", TX, 12, "start")]
for ang_deg, lab in ((-45, "あ"), (0, "い"), (45, "う")):
    a = math.radians(ang_deg)
    _b54.append(ln(EX54, EY54, EX54 + 55 * math.cos(a), EY54 + 55 * math.sin(a), HI, 2.4))
_b54 += [t(EX54 + 58, EY54 - 40, "あ", HI, 11), t(EX54 + 66, EY54 - 10, "い", HI, 11, "start"),
          t(EX54 + 58, EY54 + 46, "う", HI, 11)]
_b54.append(t(330, 220, "[図2]（真上から見たかげ）", GRAY, 10))
FIGS["HG-1654"] = svg("0 0 460 235", "".join(_b54))

# ══ 第628回 大問4（HG-1655）7たん子バス線。A/B・C(合流)/D は電池、E・Fは下の枝 ═
BX55 = 250
JA, JBC, JE, JD = 100, 200, 300, 400
_b55 = [ln(JA, 80, JD + 60, 80, LINE, 2.2)]
_b55 += battery2(JA, 30, JA, 80, plus_end=1)
_b55 += [dot(JA, 30), t(JA, 20, "A", HI, 13)]
_b55 += battery2(JBC - 30, 30, JBC, 80, plus_end=1)
_b55 += [dot(JBC - 30, 30), t(JBC - 30, 20, "B", HI, 13)]
_b55 += battery2(JBC + 30, 30, JBC, 80, plus_end=1)
_b55 += [dot(JBC + 30, 30), t(JBC + 30, 20, "C", HI, 13)]
_b55 += [dot(JBC, 80)]
_b55 += battery2(JE, 80, JE, 140, plus_end=1)
_b55 += [dot(JE, 140), t(JE, 158, "E", HI, 13)]
_b55 += battery2(JD, 30, JD, 80, plus_end=1)
_b55 += [dot(JD, 30), t(JD, 20, "D", HI, 13)]
_b55 += battery2(JD + 40, 80, JD + 40, 140, plus_end=1)
_b55 += [dot(JD + 40, 80), dot(JD + 40, 140), t(JD + 40, 158, "F", HI, 13)]
_b55 += [dot(JD + 60, 80), t(JD + 60 + 14, 84, "G", HI, 13, "start")]
FIGS["HG-1655"] = svg("0 0 560 180", "".join(_b55 + [
    t(280, 172, "バス線。A・B・C・D・E・Fは電池つき（B・Cは同じ点で合流）。Gは直結", GRAY, 11),
]))

# ══ 第624回 大問3（HG-2866）ぬいばり／棒磁石+方位磁針A〜D／ばねばかり+2磁石 ═══
_b66 = magnet(20, 60, 70, 18, n_left=False)
_b66 += [ln(0, 100, 100, 100, TX, 1.8), t(-4, 104, "P", TX, 11, "end"), t(104, 104, "Q", TX, 11, "start")]
_b66.append(defs_arrow("ar66a", HI))
_b66.append('<path d="M90,90 L10,90" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar66a)"/>' % HI)
_b66 += [t(50, 15, "[図1]", GRAY, 10)]
EX2, EY2 = 220, 100
_b66 += magnet(EX2 - 35, EY2 - 9, 70, 18, n_left=True)
_b66 += [ln(EX2, EY2 - 60, EX2, EY2 + 60, LINE, 1.4), ln(EX2 - 70, EY2, EX2 + 70, EY2, LINE, 1.4)]
_b66 += [t(EX2, EY2 - 70, "A", TX, 11), t(EX2 - 84, EY2 + 4, "B", TX, 11, "end"),
          t(EX2, EY2 + 82, "C", TX, 11), t(EX2 + 84, EY2 + 4, "D", TX, 11, "start")]
_b66 += [t(EX2, 15, "[図2]", GRAY, 10)]
X3, Y3 = 350, 40
_b66 += magnet(X3, Y3, 26, 40, n_left=True, vertical=True)
_b66 += [t(X3 + 13, 15, "あ(200g)", GRAY, 9)]
_b66.append(defs_arrow("ar66b", HI))
_b66.append('<path d="M%s,%s L%s,%s" fill="none" stroke="%s" stroke-width="1.6" marker-end="url(#ar66b)"/>' % (
    X3 + 13, Y3 + 115, X3 + 13, Y3 + 85, HI))
_b66 += magnet(X3, Y3 + 115, 26, 40, n_left=True, vertical=True)
_b66 += [t(X3 + 40, Y3 + 135, "い", TX, 11, "start")]
FIGS["HG-2866"] = svg("0 0 420 210", "".join(_b66 + [
    t(210, 202, "ぬいばり（S極でこする）／棒磁石+方位磁針A〜D／磁石あ・いが近づく", GRAY, 11),
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
