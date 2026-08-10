# -*- coding: utf-8 -*-
"""第1講座 No.22「角度の問題」HG-3638〜3653 の図を、PDFの実物を見て原簿に入れる。

★根拠：小5最レ算数 第3分冊 第1講座.pdf の PDF p7〜p12（本文p8〜13）を200dpiで出して目視。
  原簿に図は無いので、ここが唯一の根拠（[[feedback_zu_wa_genbo_ni_nai]]）。

色は既存の図に合わせる：線 #4f9eff／強調 #ffd166／文字は必ず fill を書く／
ルートに style="display:block;margin:0 auto;max-width:100%"

使い方: python scripts/genbo_svg_no22.py [--write]
"""
import io, os, re, sys, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE = '#4f9eff'
HI = '#ffd166'
TX = '#c9d4f0'
GRAY = '#9aa3c0'


def svg(vb, body):
    return '<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (vb, S, body)


def t(x, y, s, fill=TX, size=13, anchor="middle"):
    return '<text x="%s" y="%s" font-size="%d" text-anchor="%s" fill="%s">%s</text>' % (
        x, y, size, anchor, fill, s)


def pl(pts, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<polyline points="%s" fill="none" stroke="%s" stroke-width="%d"%s/>' % (pts, stroke, w, d)


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%d"%s/>' % (
        x1, y1, x2, y2, stroke, w, d)


FIGS = {}

# 大問1 平行線とジグザグ（(1)(2)を左右に）
FIGS["HG-3638"] = svg("0 0 460 250", "".join([
    # (1)
    t(30, 30, "(1)", TX, 13, "start"),
    ln(30, 45, 200, 45, GRAY), t(208, 49, "ℓ", GRAY, 13, "start"),
    ln(30, 225, 200, 225, GRAY), t(208, 229, "m", GRAY, 13, "start"),
    pl("150,45 85,110 160,175 100,225", LINE, 2),
    t(120, 70, "60°", TX, 12), t(108, 118, "100°", TX, 12),
    t(148, 160, "x°", HI, 13), t(128, 215, "50°", TX, 12),
    # (2)
    t(255, 30, "(2)", TX, 13, "start"),
    ln(255, 45, 430, 45, GRAY), t(436, 49, "ℓ", GRAY, 13, "start"),
    ln(255, 225, 430, 225, GRAY), t(436, 229, "m", GRAY, 13, "start"),
    pl("330,45 305,110 305,175 355,225", LINE, 2),
    t(300, 66, "30°", TX, 12), t(340, 100, "120°", TX, 12),
    t(330, 160, "x°", HI, 13), t(330, 215, "45°", TX, 12),
]))

# 大問2 平行線と正六角形（Aがℓ上・Dがm上）
FIGS["HG-3639"] = svg("0 0 260 250", "".join([
    ln(15, 45, 245, 45, GRAY), t(250, 49, "ℓ", GRAY, 13, "start"),
    ln(15, 215, 245, 215, GRAY), t(250, 219, "m", GRAY, 13, "start"),
    '<polygon points="120,45 185,80 185,150 130,215 65,180 65,110" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(120, 38, "A", TX, 12), t(196, 80, "F", TX, 12), t(196, 155, "E", TX, 12),
    t(140, 231, "D", TX, 12), t(54, 186, "C", TX, 12), t(54, 110, "F", TX, 12),
    t(56, 110, "B", TX, 12),
    t(96, 62, "40°", TX, 12), t(104, 231, "x°", HI, 13),
]))

# 大問3 ABとCDが平行・階段状（左下A—B、右上C—D）
FIGS["HG-3640"] = svg("0 0 340 220", "".join([
    ln(20, 190, 150, 190, GRAY), t(24, 206, "A", TX, 12), t(150, 206, "B", TX, 12),
    ln(215, 40, 320, 40, GRAY), t(300, 32, "C", TX, 12), t(322, 32, "D", TX, 12),
    pl("150,190 205,140 245,140 215,95 300,40", LINE, 2),
    t(140, 172, "135°", TX, 12), t(210, 160, "100°", TX, 12),
    t(252, 122, "90°", TX, 12), t(292, 60, "x°", HI, 13),
]))

# 大問4 三角形の外角（(1)(2)）
FIGS["HG-3641"] = svg("0 0 460 200", "".join([
    t(20, 26, "(1)", TX, 13, "start"),
    '<polygon points="40,160 175,160 110,50" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    ln(175, 160, 230, 160, LINE),
    t(66, 152, "50°", TX, 12), t(112, 76, "60°", TX, 12), t(196, 152, "x", HI, 14),
    t(265, 26, "(2)", TX, 13, "start"),
    '<polygon points="285,175 430,175 400,45" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    ln(255, 175, 285, 175, LINE),
    t(305, 167, "50°", TX, 12), t(378, 167, "70°", TX, 12), t(396, 78, "x", HI, 14),
]))

# 大問5 ブーメラン型／三角形の中を通る線
FIGS["HG-3642"] = svg("0 0 460 220", "".join([
    t(20, 26, "(1)", TX, 13, "start"),
    '<polygon points="115,45 200,185 105,120 30,185" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(115, 38, "60°", TX, 12), t(52, 172, "40°", TX, 12), t(184, 172, "20°", TX, 12),
    t(108, 142, "x", HI, 14),
    t(265, 26, "(2)", TX, 13, "start"),
    '<polygon points="285,185 445,185 400,45" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    ln(285, 185, 425, 118, LINE),
    t(305, 177, "70°", TX, 12), t(425, 177, "20°", TX, 12), t(398, 82, "30°", TX, 12),
    t(392, 120, "x", HI, 14),
]))

# 大問6 正三角形ABCの中に正五角形DEFGH
#   実物（本文p9）：E は辺AB上、F は辺BC上、G は F の右で BC上、H は辺AC上。
#   15°は F の右下（FG と FC のなす角）、x は H のところ。よけいな補助線は無い。
FIGS["HG-3643"] = svg("0 0 280 250", "".join([
    '<polygon points="150,25 45,205 255,205" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(150, 18, "A", TX, 12), t(36, 221, "B", TX, 12), t(262, 221, "C", TX, 12),
    # 正五角形 D(上)-H(右上)-G(右下,BC上)-F(下,BC上)-E(左,AB上)
    '<polygon points="140,70 195,110 185,175 118,175 96,108" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(134, 62, "D", TX, 12), t(205, 108, "H", TX, 12), t(192, 192, "G", TX, 12),
    t(112, 192, "F", TX, 12), t(86, 106, "E", TX, 12),
    t(150, 196, "15°", TX, 11), t(210, 132, "x", HI, 14),
]))

# 大問7 DA=DB=BC, AB=AC（Aが頂点の細い三角形・DはAC上）
FIGS["HG-3644"] = svg("0 0 260 250", "".join([
    '<polygon points="170,30 45,205 205,205" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(170, 22, "A", TX, 12), t(36, 221, "B", TX, 12), t(212, 221, "C", TX, 12),
    ln(45, 205, 192, 120, LINE), t(200, 118, "D", TX, 12),
    t(168, 48, "x", HI, 13),
    t(130, 240, "DA＝DB＝BC、AB＝AC", GRAY, 11),
]))

# 大問8 AB=BC=DC=DE, AD=AE
FIGS["HG-3645"] = svg("0 0 260 250", "".join([
    '<polygon points="175,25 55,205 215,205" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(175, 18, "A", TX, 12), t(46, 221, "D", TX, 12), t(222, 221, "E", TX, 12),
    ln(120, 110, 200, 165, LINE), ln(55, 205, 200, 165, LINE),
    t(110, 106, "B", TX, 12), t(210, 162, "C", TX, 12),
    t(173, 44, "x", HI, 13),
    t(130, 240, "AB＝BC＝DC＝DE、AD＝AE", GRAY, 11),
]))

# 大問9 OA=OB・同じ印の辺がすべて等しい（細長い二等辺三角形＋ジグザグ）
FIGS["HG-3646"] = svg("0 0 240 260", "".join([
    '<polygon points="150,25 60,225 175,225" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(150, 18, "O", TX, 12), t(50, 241, "A", TX, 12), t(182, 241, "B", TX, 12),
    pl("150,25 108,140 163,175 60,225 175,225", LINE, 1.6),
    t(148, 46, "x", HI, 13),
    t(120, 254, "OA＝OB／同じ印の辺はすべて等しい", GRAY, 10),
]))

# 大問10 正方形＋正三角形（(1)Eは内側／(2)Fは外側）
FIGS["HG-3647"] = svg("0 0 470 250", "".join([
    t(20, 24, "(1)", TX, 13, "start"),
    '<rect x="45" y="40" width="140" height="140" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(45, 32, "A", TX, 12), t(185, 32, "D", TX, 12), t(45, 198, "B", TX, 12), t(185, 198, "C", TX, 12),
    '<polygon points="45,180 185,180 115,72" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(115, 66, "E", TX, 12),
    ln(45, 40, 185, 90, LINE, 1.5, "5,3"),
    t(78, 62, "x", HI, 13), t(168, 78, "y", HI, 13),
    t(115, 222, "ABCDは正方形・BCEは正三角形", GRAY, 10),
    t(265, 24, "(2)", TX, 13, "start"),
    '<rect x="290" y="40" width="120" height="120" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(290, 32, "A", TX, 12), t(410, 32, "D", TX, 12), t(290, 178, "B", TX, 12), t(410, 178, "C", TX, 12),
    '<polygon points="410,40 410,160 455,100" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(462, 100, "F", TX, 12),
    ln(290, 160, 455, 100, LINE),
    t(316, 152, "x", HI, 13), t(420, 120, "y", HI, 13),
    t(370, 222, "ABCDは正方形・DCFは正三角形", GRAY, 10),
]))

# 大問11 長方形のテープの折り返し
FIGS["HG-3648"] = svg("0 0 460 230", "".join([
    t(15, 26, "(1)", TX, 13, "start"),
    ln(45, 45, 210, 45, GRAY, 1.5, "5,3"), ln(45, 155, 210, 155, GRAY, 1.5, "5,3"),
    ln(45, 45, 45, 155, LINE), ln(45, 155, 210, 155, LINE),
    pl("45,45 210,155 130,205 45,155", LINE, 2),
    t(178, 140, "52°", TX, 12), t(112, 148, "x", HI, 14),
    t(265, 26, "(2)", TX, 13, "start"),
    '<rect x="285" y="115" width="110" height="80" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    '<polygon points="330,110 400,35 455,105 385,180" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    ln(330, 110, 440, 110, GRAY, 1.5, "5,3"),
    t(352, 100, "130°", TX, 12), t(400, 130, "x", HI, 14),
]))

# 大問12 三角形ABCをAを中心に回転（50°・20°、xはAのところ）
FIGS["HG-3649"] = svg("0 0 260 260", "".join([
    '<polygon points="45,225 130,225 105,35" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(38, 241, "A", TX, 12), t(136, 241, "B", TX, 12),
    '<polygon points="45,225 200,90 150,215" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(208, 88, "C", TX, 12),
    ln(105, 35, 200, 90, LINE, 1.5, "5,3"),
    t(140, 62, "50°", TX, 12), t(205, 112, "20°", TX, 12), t(72, 214, "x", HI, 14),
]))

# 大問13 印を文字にして消去算（(1)102°と60°／(2)126°）
FIGS["HG-3650"] = svg("0 0 470 250", "".join([
    t(15, 24, "(1)", TX, 13, "start"),
    '<polygon points="40,190 215,190 115,45" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    ln(40, 190, 175, 100, LINE), ln(60, 128, 215, 190, LINE),
    t(112, 62, "x", HI, 13), t(140, 90, "60°", TX, 12),
    t(38, 122, "102°", TX, 11, "end"), t(120, 148, "y", HI, 13),
    t(265, 24, "(2)", TX, 13, "start"),
    '<polygon points="300,150 445,150 375,40" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    '<polygon points="300,150 445,150 375,105" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    '<polygon points="300,150 445,150 375,225" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(373, 58, "x", HI, 13), t(382, 120, "126°", TX, 11), t(375, 208, "y", HI, 13),
]))

# 大問14 (1)正方形ABCD＋E,G（左外）／(2)60°10°55°30°
FIGS["HG-3651"] = svg("0 0 470 250", "".join([
    t(15, 24, "(1)", TX, 13, "start"),
    '<rect x="105" y="55" width="130" height="130" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(105, 47, "A", TX, 12), t(235, 47, "D", TX, 12), t(112, 202, "B", TX, 12), t(235, 202, "C", TX, 12),
    ln(105, 55, 45, 165, LINE), ln(45, 165, 235, 55, LINE), ln(45, 165, 105, 185, LINE),
    t(36, 165, "E", TX, 12), t(45, 202, "G", TX, 12), ln(45, 185, 105, 185, LINE),
    t(80, 84, "30°", TX, 11), t(196, 72, "30°", TX, 11), t(130, 172, "x", HI, 13),
    t(170, 226, "ABCDは正方形", GRAY, 10),
    t(275, 24, "(2)", TX, 13, "start"),
    '<polygon points="315,205 440,190 355,45" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    ln(355, 45, 440, 190, LINE), ln(315, 205, 425, 145, LINE), ln(355, 45, 425, 145, LINE),
    t(338, 192, "60°", TX, 11), t(360, 218, "10°", TX, 11),
    t(412, 178, "55°", TX, 11), t(432, 150, "30°", TX, 11), t(398, 120, "x", HI, 13),
]))

# 大問15 (1)正三角形ABC・ADE（75°とx）／(2)正方形ABCD・AEFG
FIGS["HG-3652"] = svg("0 0 470 250", "".join([
    t(15, 24, "(1)", TX, 13, "start"),
    '<polygon points="60,190 200,190 130,60" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(52, 206, "A", TX, 12), t(207, 206, "B", TX, 12), t(130, 52, "C", TX, 12),
    '<polygon points="60,190 45,45 175,80" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(38, 40, "E", TX, 12), t(183, 78, "D", TX, 12),
    ln(60, 190, 175, 80, LINE), ln(130, 60, 200, 190, LINE),
    t(112, 78, "75°", TX, 11), t(196, 170, "x", HI, 13),
    t(275, 24, "(2)", TX, 13, "start"),
    '<rect x="330" y="55" width="120" height="120" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(330, 47, "A", TX, 12), t(450, 47, "D", TX, 12), t(336, 192, "B", TX, 12), t(450, 192, "C", TX, 12),
    '<polygon points="330,55 285,95 320,175 368,132" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(277, 92, "E", TX, 12), t(312, 192, "F", TX, 12), t(378, 132, "G", TX, 12),
    ln(330, 55, 330, 175, LINE), ln(285, 95, 330, 175, LINE),
    t(310, 148, "x", HI, 13),
]))

# 大問16 AC=10cm, AF=6cm, DF:FC=3:2、角㋐
FIGS["HG-3653"] = svg("0 0 330 250", "".join([
    '<polygon points="45,215 300,175 195,45" fill="none" stroke="%s" stroke-width="2"/>' % LINE,
    t(38, 231, "B", TX, 12), t(310, 178, "C", TX, 12), t(195, 38, "A", TX, 12),
    ln(120, 150, 300, 175, LINE), t(112, 146, "D", TX, 12),
    ln(195, 45, 232, 200, LINE), t(238, 214, "E", TX, 12),
    '<circle cx="218" cy="160" r="3.5" fill="%s"/>' % HI, t(210, 154, "F", TX, 12),
    t(182, 84, "㋐", HI, 14), t(232, 86, "46°", TX, 12),
    t(165, 245, "AC＝10cm、AF＝6cm、DF:FC＝3:2", GRAY, 10),
]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    p = find_genbo()
    s = io.open(p, encoding="utf-8").read()
    n = 0
    for hg, fig in FIGS.items():
        # 「- 図: …」の行の直後に「- 図SVG: …」を入れる（すでにあれば置きかえ）
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
