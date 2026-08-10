# -*- coding: utf-8 -*-
"""第1講座 No.27「辺比と面積比の発展」HG-3718〜3733 の図を、PDFの実物を見て原簿に入れる。

★根拠：小5最レ算数 第3分冊 第1講座.pdf の PDF p37〜42（本文p38〜43）を200dpiで出して目視。
  原簿に図は無いので、ここが唯一の根拠（feedback_zu_wa_genbo_ni_nai）。

寸法は「どの辺のどこが何cmか」が分かるよう、測っている線分に沿って寸法線を引く（本人指示）。
viewBox は横長にする（アプリのCSSが縦を切るため）。

使い方: python scripts/genbo_svg_no27.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'
SHADE = 'rgba(255,209,102,0.22)'


def svg(vb, body):
    return '<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (vb, S, body)


def t(x, y, s, fill=TX, size=13, anchor="middle"):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s">%s</text>' % (
        x, y, size, anchor, fill, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=1.6, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        x1, y1, x2, y2, stroke, w, d)


def poly(pts, stroke=LINE, w=1.8, fill="none"):
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"/>' % (pts, fill, stroke, w)


def shade(pts):
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="1.8"/>' % (pts, SHADE, HI)


def dot(x, y, c=TX, r=3):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (x, y, r, c)


def dim(x1, y1, x2, y2, label, off=11, side=1, size=11):
    """寸法線：測っている線分に沿って細線＋両端の爪＋中央にラベル。区間ごとに別々に呼ぶ。"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = nx / off * 3.5, ny / off * 3.5
    return "".join([
        ln(round(ax, 1), round(ay, 1), round(bx, 1), round(by, 1), GRAY, 1.1),
        ln(round(ax - tx, 1), round(ay - ty, 1), round(ax + tx, 1), round(ay + ty, 1), GRAY, 1.1),
        ln(round(bx - tx, 1), round(by - ty, 1), round(bx + tx, 1), round(by + ty, 1), GRAY, 1.1),
        t(round((ax + bx) / 2 + nx * 0.8, 1), round((ay + by) / 2 + ny * 0.8 + 4, 1), label, TX, size),
    ])


FIGS = {}

# 大問1（HG-3718）長方形ABCD・E(AB上)・F(DC上)・対角線と斜線の平行四辺形
FIGS["HG-3718"] = svg("0 0 360 230", "".join([
    poly("60,40 300,40 300,180 60,180"),
    t(54, 34, "A", TX, 12, "end"), t(306, 34, "D", TX, 12, "start"),
    t(54, 196, "B", TX, 12, "end"), t(306, 196, "C", TX, 12, "start"),
    ln(60, 40, 300, 180), ln(60, 180, 300, 40),            # 対角線AC・BD
    dot(60, 145), t(52, 149, "E", TX, 12, "end"),
    dot(300, 110), t(310, 114, "F", TX, 12, "start"),
    ln(60, 40, 300, 110), ln(60, 145, 300, 40),
    shade("60,145 168,110 300,110 190,145"),
    dot(168, 110, HI), t(172, 100, "P", TX, 11),
    dot(190, 145, HI), t(194, 160, "Q", TX, 11),
    dim(60, 40, 60, 145, "3cm", 16, 1), dim(60, 145, 60, 180, "1cm", 16, 1),
    dim(300, 40, 300, 110, "2cm", 16, -1), dim(300, 110, 300, 180, "2cm", 16, -1),
]))

# 大問2（HG-3719）長方形・E,F,G,Hが各辺を2:1・中央の小さな四角形が斜線
FIGS["HG-3719"] = svg("0 0 360 215", "".join([
    poly("60,40 300,40 300,170 60,170"),
    t(54, 34, "A", TX, 12, "end"), t(306, 34, "D", TX, 12, "start"),
    t(54, 186, "B", TX, 12, "end"), t(306, 186, "C", TX, 12, "start"),
    dot(220, 40), t(220, 32, "H", TX, 12),
    dot(300, 127), t(310, 131, "G", TX, 12, "start"),
    dot(140, 170), t(140, 186, "F", TX, 12),
    dot(60, 83), t(52, 87, "E", TX, 12, "end"),
    ln(60, 40, 300, 170), ln(60, 170, 300, 40),            # 対角線
    ln(220, 40, 140, 170), ln(60, 83, 300, 127),           # HF と EG
    shade("176,113 196,84 216,101 196,130"),
    t(180, 200, "AE:EB＝BF:FC＝CG:GD＝DH:HA＝2:1", GRAY, 10),
]))

# 大問3（HG-3720）E,FはAB,DCの中点／P,QはACの3等分点
FIGS["HG-3720"] = svg("0 0 360 225", "".join([
    poly("60,40 300,40 300,175 60,175"),
    t(54, 34, "A", TX, 12, "end"), t(306, 34, "D", TX, 12, "start"),
    t(54, 191, "B", TX, 12, "end"), t(306, 191, "C", TX, 12, "start"),
    ln(60, 40, 300, 175), ln(60, 175, 300, 40),
    dot(60, 107), t(52, 111, "E", TX, 12, "end"),
    dot(300, 107), t(310, 111, "F", TX, 12, "start"),
    ln(60, 107, 300, 107),
    dot(140, 85, HI), t(134, 78, "P", TX, 11, "end"),
    dot(220, 130, HI), t(224, 143, "Q", TX, 11, "start"),
    shade("140,85 300,107 220,130 60,107"),
    t(180, 210, "E・FはAB・DCの中点／P・QはACの3等分点", GRAY, 10),
]))

# 大問4（HG-3721）BE:EC＝CF:FD＝2:1・斜線は四角形GECF側
FIGS["HG-3721"] = svg("0 0 340 215", "".join([
    poly("60,40 280,40 280,170 60,170"),
    t(54, 34, "A", TX, 12, "end"), t(286, 34, "D", TX, 12, "start"),
    t(54, 186, "B", TX, 12, "end"), t(286, 186, "C", TX, 12, "start"),
    ln(60, 40, 280, 170), ln(60, 170, 280, 40),
    dot(207, 170), t(207, 186, "E", TX, 12),
    dot(280, 83), t(290, 87, "F", TX, 12, "start"),
    ln(60, 40, 207, 170), ln(60, 170, 280, 83),
    shade("155,118 220,58 280,83 280,170 207,170"),
    dot(155, 118, HI), t(147, 122, "G", TX, 11, "end"),
    dot(220, 58, HI), t(222, 50, "H", TX, 11),
    t(170, 202, "BE:EC＝CF:FD＝2:1", GRAY, 10),
]))

# 大問5（HG-3722）6つの角が120度の六角形・3/4/5/6cm
FIGS["HG-3722"] = svg("0 0 330 235", "".join([
    poly("110,45 175,45 265,150 205,195 120,195 75,120"),
    t(104, 38, "A", TX, 12, "end"), t(180, 38, "F", TX, 12, "start"),
    t(275, 154, "E", TX, 12, "start"), t(208, 211, "D", TX, 12, "start"),
    t(114, 211, "C", TX, 12, "end"), t(66, 122, "B", TX, 12, "end"),
    dim(110, 45, 175, 45, "3cm", 14, -1),
    dim(75, 120, 110, 45, "4cm", 14, 1),
    dim(120, 195, 75, 120, "5cm", 14, 1),
    dim(120, 195, 205, 195, "6cm", 14, 1),
    t(165, 228, "6つの角はどれも120度", GRAY, 10),
]))

# 大問6（HG-3723）一辺12cmの正方形・CE:ED＝1:1、AF:FD＝2:1
FIGS["HG-3723"] = svg("0 0 330 215", "".join([
    poly("80,40 250,40 250,175 80,175"),
    t(74, 34, "A", TX, 12, "end"), t(256, 34, "D", TX, 12, "start"),
    t(74, 191, "B", TX, 12, "end"), t(256, 191, "C", TX, 12, "start"),
    dot(193, 40), t(193, 32, "F", TX, 12),
    dot(250, 108), t(260, 112, "E", TX, 12, "start"),
    ln(80, 40, 250, 108), ln(80, 175, 193, 40),
    shade("80,175 148,90 250,108 250,175"),
    dim(80, 40, 250, 40, "12cm", 16, -1),
    t(165, 205, "CE:ED＝1:1、AF:FD＝2:1", GRAY, 10),
]))

# 大問7（HG-3724）三角形ABCを面積が等しい5つの三角形に分ける
FIGS["HG-3724"] = svg("0 0 350 190", "".join([
    poly("60,40 60,150 320,150"),
    t(54, 34, "A", TX, 12, "end"), t(54, 166, "B", TX, 12, "end"),
    t(328, 166, "C", TX, 12, "start"),
    dot(120, 65), t(120, 56, "D", TX, 12),
    dot(180, 90), t(182, 82, "E", TX, 12, "start"),
    ln(60, 150, 120, 65), ln(60, 150, 180, 90),
    ln(120, 65, 120, 150), ln(180, 90, 180, 150),
    t(190, 182, "面積が等しい5つの三角形に分けた図", GRAY, 10),
]))

# 大問8（HG-3725）56cm²を5つに分ける・各部分に面積
FIGS["HG-3725"] = svg("0 0 360 200", "".join([
    poly("70,45 70,155 330,155"),
    t(64, 39, "A", TX, 12, "end"), t(64, 171, "B", TX, 12, "end"),
    t(338, 171, "C", TX, 12, "start"),
    dot(150, 72), t(150, 63, "D", TX, 12),
    dot(250, 118), t(252, 110, "E", TX, 12, "start"),
    ln(70, 155, 150, 72), ln(150, 72, 150, 155),
    ln(150, 155, 250, 118), ln(250, 118, 250, 155),
    t(104, 78, "14cm²", TX, 11), t(122, 128, "15cm²", TX, 11),
    t(178, 112, "12cm²", TX, 11), t(212, 143, "9cm²", TX, 11),
    t(290, 148, "6cm²", TX, 11),
    t(190, 192, "三角形ABCの面積は56cm²", GRAY, 10),
]))

# 大問9（HG-3726）折れ線で10等分・AB＝16cm
FIGS["HG-3726"] = svg("0 0 360 200", "".join([
    poly("55,155 320,155 300,45"),
    t(49, 171, "A", TX, 12, "end"), t(328, 171, "B", TX, 12, "start"),
    t(304, 38, "C", TX, 12, "start"),
    # AB上の点 L J H F D（左から）とAC上の点 K I G E
    dot(100, 155), t(100, 171, "L", TX, 11),
    dot(150, 155), t(150, 171, "J", TX, 11),
    dot(210, 155), t(210, 171, "H", TX, 11),
    dot(255, 155), t(255, 171, "F", TX, 11),
    dot(288, 155), t(288, 171, "D", TX, 11),
    dot(120, 108, HI), t(114, 102, "K", TX, 11, "end"),
    dot(190, 79, HI), t(186, 72, "I", TX, 11, "end"),
    dot(248, 55, HI), t(244, 48, "G", TX, 11, "end"),
    dot(278, 47, HI), t(274, 40, "E", TX, 11, "end"),
    ln(100, 155, 120, 108), ln(120, 108, 150, 155),
    ln(150, 155, 190, 79), ln(190, 79, 210, 155),
    ln(210, 155, 248, 55), ln(248, 55, 255, 155),
    ln(255, 155, 278, 47), ln(278, 47, 288, 155),
    dim(55, 155, 320, 155, "16cm", 26, 1),
]))

# 大問10（HG-3727）AD, BE, CFが1点で交わる図が3つ
def cev(x0, tag, labs):
    """三角形＋3本のチェバ線。labs = (AF, FB, BD, DC, AE, EC) の表示ラベル"""
    A = (x0 + 75, 40); B = (x0 + 20, 150); C = (x0 + 130, 150)
    F = (x0 + 47, 95); D = (x0 + 75, 150); E = (x0 + 103, 95)
    P = (x0 + 75, 112)
    return "".join([
        t(x0 + 75, 26, tag, TX, 12),
        poly("%d,%d %d,%d %d,%d" % (A[0], A[1], B[0], B[1], C[0], C[1])),
        ln(A[0], A[1], D[0], D[1]), ln(B[0], B[1], E[0], E[1]), ln(C[0], C[1], F[0], F[1]),
        dot(*F), dot(*D), dot(*E), dot(*P, HI),
        t(F[0] - 9, F[1], "F", TX, 11, "end"), t(D[0], D[1] + 16, "D", TX, 11),
        t(E[0] + 9, E[1], "E", TX, 11, "start"),
        t(A[0], A[1] - 8, "A", TX, 11), t(B[0] - 8, B[1] + 14, "B", TX, 11, "end"),
        t(C[0] + 8, C[1] + 14, "C", TX, 11, "start"),
        t(x0 + 55, 62, labs[0], HI, 11), t(x0 + 28, 126, labs[1], HI, 11),
        t(x0 + 47, 166, labs[2], HI, 11), t(x0 + 103, 166, labs[3], HI, 11),
        t(x0 + 96, 62, labs[4], HI, 11), t(x0 + 122, 126, labs[5], HI, 11),
    ])


FIGS["HG-3727"] = svg("0 0 470 185", "".join([
    cev(10, "(1)", ("3", "2", "1", "1", "x", "y")),
    cev(165, "(2)", ("2", "5", "x", "y", "4", "3")),
    cev(320, "(3)", ("x", "y", "6", "5", "7", "2")),
]))

# 大問11（HG-3728）BD:DC＝3:5、CE:EA＝3:2、三角形APE＝4cm²
FIGS["HG-3728"] = svg("0 0 320 195", "".join([
    poly("160,35 55,160 285,160"),
    t(160, 27, "A", TX, 12), t(48, 176, "B", TX, 12, "end"), t(293, 176, "C", TX, 12, "start"),
    dot(141, 160), t(141, 176, "D", TX, 12),
    dot(210, 108), t(219, 105, "E", TX, 12, "start"),
    dot(112, 95), t(103, 92, "F", TX, 12, "end"),
    ln(160, 35, 141, 160), ln(55, 160, 210, 108), ln(285, 160, 112, 95),
    dot(152, 100, HI), t(158, 96, "P", TX, 11, "start"),
    t(160, 190, "BD:DC＝3:5、CE:EA＝3:2、三角形APEは4cm²", GRAY, 10),
]))

# 大問12（HG-3729）Dは5:2、Eは4:3・AE, BF, CDが1点Pで交わる
FIGS["HG-3729"] = svg("0 0 320 195", "".join([
    poly("175,35 60,160 290,160"),
    t(175, 27, "A", TX, 12), t(53, 176, "B", TX, 12, "end"), t(298, 176, "C", TX, 12, "start"),
    dot(93, 128), t(84, 125, "D", TX, 12, "end"),
    dot(191, 160), t(191, 176, "E", TX, 12),
    dot(235, 105), t(244, 102, "F", TX, 12, "start"),
    ln(175, 35, 191, 160), ln(60, 160, 235, 105), ln(290, 160, 93, 128),
    dot(184, 118, HI), t(190, 114, "P", TX, 11, "start"),
    t(175, 190, "Dは辺ABを5:2に、Eは辺BCを4:3に分ける", GRAY, 10),
]))

# 大問13（HG-3730）48cm²の長方形・P(BC上)・Q(CD上)
FIGS["HG-3730"] = svg("0 0 340 190", "".join([
    poly("70,45 290,45 290,150 70,150"),
    t(64, 39, "A", TX, 12, "end"), t(296, 39, "D", TX, 12, "start"),
    t(64, 166, "B", TX, 12, "end"), t(296, 166, "C", TX, 12, "start"),
    dot(150, 150), t(150, 166, "P", TX, 12),
    dot(290, 95), t(300, 99, "Q", TX, 12, "start"),
    ln(70, 45, 150, 150), ln(70, 45, 290, 95), ln(150, 150, 290, 95),
    t(180, 182, "長方形は48cm²／三角形ABPは8cm²／三角形AQDは12cm²", GRAY, 10),
]))

# 大問14（HG-3731）円のまわりに1cm×3・2cm×3の二等辺三角形
_h = []
for i in range(6):
    a1 = math.radians(-60 + i * 60)
    a2 = math.radians(-60 + (i + 1) * 60)
    x1, y1 = 165 + 78 * math.cos(a1), 105 + 78 * math.sin(a1)
    x2, y2 = 165 + 78 * math.cos(a2), 105 + 78 * math.sin(a2)
    _h.append(ln(165, 105, round(x1, 1), round(y1, 1), LINE, 1.4))
    _h.append(ln(round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1), LINE, 1.8))
FIGS["HG-3731"] = svg("0 0 330 215", "".join([
    '<circle cx="165" cy="105" r="78" fill="none" stroke="%s" stroke-width="1.6"/>' % GRAY,
] + _h + [
    dot(165, 105), t(165, 122, "O", TX, 12),
    t(243, 34, "A", TX, 12, "start"), t(204, 15, "B", TX, 12), t(126, 15, "C", TX, 12),
    t(80, 34, "D", TX, 12, "end"), t(80, 190, "E", TX, 12, "end"), t(243, 190, "F", TX, 12, "start"),
    t(206, 22, "1cm", TX, 10), t(124, 22, "1cm", TX, 10), t(82, 92, "1cm", TX, 10),
    t(112, 178, "2cm", TX, 10), t(218, 178, "2cm", TX, 10), t(248, 92, "2cm", TX, 10),
    t(165, 208, "AB＝BC＝CD＝1cm／DE＝EF＝FA＝2cm", GRAY, 10),
]))

# 大問15（HG-3732）台形ABCD・ADとBC平行、CDとGE平行、AE＝ED
FIGS["HG-3732"] = svg("0 0 330 200", "".join([
    poly("95,40 250,40 285,155 60,155"),
    t(89, 34, "A", TX, 12, "end"), t(256, 34, "D", TX, 12, "start"),
    t(53, 171, "B", TX, 12, "end"), t(293, 171, "C", TX, 12, "start"),
    dot(172, 40), t(172, 32, "E", TX, 12),
    dot(200, 155), t(200, 171, "G", TX, 12),
    ln(60, 155, 250, 40), ln(172, 40, 200, 155),
    dot(159, 79, HI), t(150, 76, "F", TX, 11, "end"),
    shade("172,40 250,40 285,155 200,155 159,79"),
    t(133, 34, "‖", GRAY, 11), t(211, 34, "‖", GRAY, 11),
    t(165, 192, "AE＝ED／四角形ABFEは48cm²、三角形BGFは50cm²", GRAY, 10),
]))

# 大問16（HG-3733）三角形の外に点Eが出ている形が2つ
FIGS["HG-3733"] = svg("0 0 470 200", "".join([
    t(110, 22, "(1)", TX, 12),
    poly("150,35 55,150 235,150"),
    t(150, 28, "A", TX, 11), t(48, 166, "B", TX, 11, "end"), t(243, 166, "E", TX, 11, "start"),
    dot(112, 82), t(103, 79, "D", TX, 11, "end"),
    dot(130, 150), t(130, 166, "C", TX, 11),
    ln(112, 82, 235, 150), ln(150, 35, 130, 150),
    dot(139, 92, HI), t(146, 89, "F", TX, 11, "start"),
    t(145, 190, "AD:DB＝3:4、EC:CB＝2:1", GRAY, 10),
    t(330, 22, "(2)", TX, 12),
    poly("380,35 285,150 460,150"),
    t(380, 28, "A", TX, 11), t(278, 166, "C", TX, 11, "end"), t(468, 166, "E", TX, 11, "start"),
    dot(333, 92), t(324, 89, "B", TX, 11, "end"),
    dot(375, 150), t(375, 166, "D", TX, 11),
    ln(333, 92, 460, 150), ln(380, 35, 375, 150),
    dot(377, 108, HI), t(384, 105, "F", TX, 11, "start"),
    t(375, 190, "AB:BC＝4:3、AF:FD＝5:2", GRAY, 10),
]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
    p = find_genbo()
    s = io.open(p, encoding="utf-8").read()
    n = 0
    for hg, fig in FIGS.items():
        pat = re.compile(r"(### 【%s】(?:(?!### 【HG-)[\s\S])*?- 図: [^\n]*\n)(- 図SVG: [^\n]*\n)?" % hg)
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
