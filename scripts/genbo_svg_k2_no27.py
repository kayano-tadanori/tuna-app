# -*- coding: utf-8 -*-
"""第2講座 No.27「速さ(7)」の図（HG-3874〜3889・大問1〜16）を、PDFの実物を見て原簿に入れる。

★根拠：小5最レ算数 第3分冊 第2講座.pdf の PDFページ37〜42（本文p38-43）を
  200dpi＋部分600/900dpiで出して目視。原簿に図は無いのでここが唯一の根拠。

★この回は **16問すべて 本文（問題ページ）に図がある**。
  ＝ No.22 とちがい、解答冊子の図ではなく問題そのものについているグラフ。
  グラフは **軸に書かれた数字がその問題を解く唯一の手がかり**なので、
  目もり・目もりの数字・点線の補助線を落とさずに写すこと。

実物で確かめたこと（グラフの形と、軸に書いてある数字）：
  大問1  … 進行グラフ。たて(km)は **2 だけ**、よこ(分)は 0/60/120 と **10分ごとの目もり**。
           太郎＝(0,0)(40,2)(50,2)(90,4)(100,4)(130,5.5)／父＝(0,0)(24,1.2)(40,0)(90,4)
           点線は たて 2・4・5.5、よこ 40・50・90・100・130。
           ★「40分で2km」はグラフにしか無い。これが無いと(1)が解けない
  大問2  … 5×4のます目。たて 48 だけ、よこ 0〜5(時間)。(0,0)(2,48)(5,0)
  大問3  … 4×4のます目。たて 5/10/15/20、よこ 0〜4(時間)。(0,0)(1,10)(2,10)(3,20)(4,0)
  大問4  … 箱型。たて A0〜B40、よこ 8〜11(時)。(8,0)→(11,40) と (9,40)→(11,0)
  大問5  … 箱型。たて A0〜B80、よこ 8〜12(時)。(8,0)→(12,80) と (9,0)→(10,80)
  大問6  … たて A町〜B町（目もり無し）、左に **1.5km のかっこ**。
           よこ 25分／1時間13分／1時間25分。二郎はA町で平ら（休み）
  大問7  … へだたりグラフ。たて 600(m)、よこ 0/20/60(分)の三角形
  大問8  … **図が2つ**。A町—C—D—B町の線分図（3600m の弧・花子→・←良子）＋
           へだたりグラフ (0,3600)(30,0)(48,2160)(80,3600)。数字は 3600・30・80 だけ
  大問9  … へだたりグラフ。たて 2/4/8(km)、よこ 0〜3(時間)。
           (0,0)(0.5,2)(1,0)(2,4)(2h20m,0)(3,8)
  大問10 … 速さ×時間。たて 25(m/秒)、よこ 180(秒)の長方形
  大問11 … 20(m/秒)で60秒 → 25(m/秒)で100秒まで
  大問12 … (0,0)(40,15)(150,15)。たて 15、よこ 40/150
  大問13 … ダイヤグラム。たて A地点/B地点（目もり無し）、よこ 10時 だけ。
           花子＝(0,A)(30,B)(35,B)(65,A)／太郎＝(0,B)(45,A)(50,A)(95,B)
  大問14 … **図が2つ**。直線AB（P・Qの位置）＋グラフ。
           たて B・216(cm)、よこ 0/18/36/x/63(秒)。太線＝P、細線＝Q
  大問15 … へだたりグラフ。たて 720/240(m)、よこ 9/17/19(分)。
           (0,0)(5,0)(9,720)(17,240)(19,0)。17分のところに●
  大問16 … 台形。たて 30(m/秒)、よこ 0/60/180/240(秒)

★描かなかったもの：解答が引く「しゃ線（面積＝距離）」。問題ページには入っていない。
  入れると「面積を出せばよい」という答えを先に渡すことになるので、輪郭だけにした。

使い方: python scripts/genbo_svg_k2_no27.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'
GUIDE = '#3a4568'          # 点線の補助線・ます目
C1, C2 = '#4f9eff', '#5fd8a4'   # 人／乗り物ごとの色（青・緑）


def r1(v):
    return round(v, 1) if isinstance(v, (int, float)) else v


def svg(vb, body):
    return '<svg viewBox="%s" xmlns="http://www.w3.org/2000/svg" %s>%s</svg>' % (vb, S, body)


def t(x, y, s, fill=TX, size=13, anchor="middle", extra=""):
    return '<text x="%s" y="%s" font-size="%s" text-anchor="%s" fill="%s"%s>%s</text>' % (
        r1(x), r1(y), size, anchor, fill, extra, s)


def ln(x1, y1, x2, y2, stroke=LINE, w=2, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="%s"%s/>' % (
        r1(x1), r1(y1), r1(x2), r1(y2), stroke, w, d)


def poly(pts, stroke=LINE, w=2.4, dash=None):
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return ('<polyline points="%s" fill="none" stroke="%s" stroke-width="%s"'
            ' stroke-linejoin="round" stroke-linecap="round"%s/>'
            % (" ".join("%.1f,%.1f" % (p[0], p[1]) for p in pts), stroke, w, d))


def dot(x, y, c=HI, r=4.5):
    return '<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (r1(x), r1(y), r, c)


def dim(x1, y1, x2, y2, label, off=12, side=1, size=12):
    """★寸法線。数字を宙に浮かせず「どの区間が何か」を線で示す（本人指示 2026-08-11）。
       区間が分かれているときは区間ごとに呼ぶ（まとめない）。"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = nx / off * 4, ny / off * 4
    return "".join([
        ln(ax, ay, bx, by, GRAY, 1.2),
        ln(ax - tx, ay - ty, ax + tx, ay + ty, GRAY, 1.2),
        ln(bx - tx, by - ty, bx + tx, by + ty, GRAY, 1.2),
        t((ax + bx) / 2 + nx * 0.9, (ay + by) / 2 + ny * 0.9 + 4, label, TX, size),
    ])


# ── グラフの土台 ────────────────────────────────────────────
def mk(x0, ybot, x1, ytop, tmax, vmax):
    """(t,v) → 画面座標 に変える関数を2つ返す"""
    fx = lambda tt: x0 + (x1 - x0) * tt / float(tmax)
    fy = lambda vv: ybot - (ybot - ytop) * vv / float(vmax)
    return fx, fy


def axes(x0, ybot, xend, ytop, xunit, yunit):
    return "".join([
        ln(x0, ybot, xend, ybot, GRAY, 1.8),
        ln(x0, ybot, x0, ytop, GRAY, 1.8),
        t(xend + 7, ybot + 17, xunit, GRAY, 12, "start"),
        t(x0, ytop - 9, yunit, GRAY, 12),
    ])


def xtick(x, ybot, lab=None, h=6, size=12, fill=TX):
    s = ln(x, ybot, x, ybot - h, GRAY, 1.4)
    if lab is not None:
        s += t(x, ybot + 20, lab, fill, size)
    return s


def ytick(y, x0, lab=None, w=6, size=12, fill=TX):
    s = ln(x0, y, x0 + w, y, GRAY, 1.4)
    if lab is not None:
        s += t(x0 - 9, y + 5, lab, fill, size, "end")
    return s


def gh(y, xa, xb):          # よこの点線（補助線）
    return ln(xa, y, xb, y, GUIDE, 1.4, "5 4")


def gv(x, ya, yb):          # たての点線（補助線）
    return ln(x, ya, x, yb, GUIDE, 1.4, "5 4")


def legend(x, y, items, gap=20):
    out = []
    for i, (col, lab) in enumerate(items):
        yy = y + i * gap
        out.append(ln(x, yy, x + 30, yy, col, 3))
        out.append(t(x + 37, yy + 5, lab, col, 12, "start"))
    return "".join(out)


FIGS = {}

# ══ 大問1（HG-3874）太郎君とお父さん・進行グラフ ═══════════════════
# ★実物のたて軸に書いてある数字は「2」だけ。よこ軸は 0・60・120 と10分ごとの目もり。
#   40分で2km がここにしか無いので、目もりを必ず出す。
_fx, _fy = mk(80, 252, 486, 58, 140, 6.4)
_taro = [(0, 0), (40, 2), (50, 2), (90, 4), (100, 4), (130, 5.5)]
_chichi = [(0, 0), (24, 1.2), (40, 0), (90, 4)]
FIGS["HG-3874"] = svg("0 0 520 300", "".join(
    [axes(80, 252, 486, 58, "(分)", "(km)")] +
    [gh(_fy(v), 80, _fx(tt)) for v, tt in ((2, 40), (4, 90), (5.5, 130))] +
    [gv(_fx(tt), 252, _fy(v)) for tt, v in ((40, 2), (50, 2), (90, 4), (100, 4), (130, 5.5))] +
    [xtick(_fx(i * 10), 252) for i in range(1, 14)] +
    [xtick(_fx(0), 252, "0"), xtick(_fx(60), 252, "60", 9), xtick(_fx(120), 252, "120", 9)] +
    [ytick(_fy(2), 80, "2")] +
    [poly([(_fx(a), _fy(b)) for a, b in _chichi], C2, 2.6),
     poly([(_fx(a), _fy(b)) for a, b in _taro], C1, 2.6),
     dot(_fx(90), _fy(4)),
     legend(106, 98, [(C1, "太郎君"), (C2, "お父さん")]),
     t(283, 292, "午前8時に家を出発。お父さんは途中でひき返し、家からまた追いかけた", GRAY, 11)]
))

# ══ 大問2（HG-3875）船の往復（5×4のます目）═══════════════════════
_fx, _fy = mk(92, 248, 452, 62, 5, 48)
FIGS["HG-3875"] = svg("0 0 500 300", "".join(
    [ln(_fx(i), 248, _fx(i), 62, GUIDE, 1.3) for i in range(1, 6)] +
    [ln(92, _fy(v), _fx(5), _fy(v), GUIDE, 1.3) for v in (12, 24, 36, 48)] +
    [axes(92, 248, 452, 62, "(時間)", "(km)")] +
    [xtick(_fx(i), 248, str(i)) for i in range(6)] +
    [ytick(_fy(48), 92, "48")] +
    [poly([(_fx(0), _fy(0)), (_fx(2), _fy(48)), (_fx(5), _fy(0))], C1, 2.8),
     t(272, 292, "AB間は48km。上りと下りを1回ずつ", GRAY, 11)]
))

# ══ 大問3（HG-3876）A町⇄C町・とちゅうで休む（4×4のます目）═══════════
_fx, _fy = mk(96, 248, 456, 62, 4, 20)
FIGS["HG-3876"] = svg("0 0 500 300", "".join(
    [ln(_fx(i), 248, _fx(i), 62, GUIDE, 1.3) for i in range(1, 5)] +
    [ln(96, _fy(v), _fx(4), _fy(v), GUIDE, 1.3) for v in (5, 10, 15, 20)] +
    [axes(96, 248, 456, 62, "(時間)", "(km)")] +
    [xtick(_fx(i), 248, str(i)) for i in range(5)] +
    [ytick(_fy(v), 96, str(v)) for v in (5, 10, 15, 20)] +
    [poly([(_fx(0), _fy(0)), (_fx(1), _fy(10)), (_fx(2), _fy(10)),
           (_fx(3), _fy(20)), (_fx(4), _fy(0))], C1, 2.8),
     t(276, 292, "たいらなところは船がとまっている（休み）", GRAY, 11)]
))

# ══ 大問4（HG-3877）定期船のダイヤグラム（8時発と9時発が出会う）══════
_fx, _fy = mk(120, 246, 440, 70, 3, 40)      # t は 8時からの時間
FIGS["HG-3877"] = svg("0 0 520 300", "".join(
    [ln(_fx(i), 246, _fx(i), 70, GUIDE, 1.3) for i in (1, 2)] +
    [ln(120, 70, _fx(3), 70, GUIDE, 1.3), ln(_fx(3), 246, _fx(3), 70, GUIDE, 1.3)] +
    [axes(120, 246, 440, 70, "(時)", "(km)")] +
    [xtick(_fx(i), 246, str(8 + i)) for i in range(4)] +
    [ytick(_fy(40), 120, "B 40"), ytick(_fy(0), 120, "A  0")] +
    [poly([(_fx(0), _fy(0)), (_fx(3), _fy(40))], C1, 2.8),
     poly([(_fx(1), _fy(40)), (_fx(3), _fy(0))], C2, 2.8),
     dot(_fx(1.8), _fy(24)),
     legend(148, 94, [(C1, "8時発"), (C2, "9時発")]),
     t(280, 292, "A地は川の下流でB地までは40km。8時発はA地発、9時発はB地発", GRAY, 11)]
))

# ══ 大問5（HG-3878）自動車の追いつき ══════════════════════════════
_fx, _fy = mk(120, 246, 452, 70, 4, 80)      # t は 8時からの時間
FIGS["HG-3878"] = svg("0 0 520 300", "".join(
    [ln(_fx(i), 246, _fx(i), 70, GUIDE, 1.3) for i in (1, 2, 3)] +
    [ln(120, 70, _fx(4), 70, GUIDE, 1.3), ln(_fx(4), 246, _fx(4), 70, GUIDE, 1.3)] +
    [axes(120, 246, 452, 70, "(時)", "(km)")] +
    [xtick(_fx(i), 246, str(8 + i)) for i in range(5)] +
    [ytick(_fy(80), 120, "B 80"), ytick(_fy(0), 120, "A  0")] +
    [poly([(_fx(0), _fy(0)), (_fx(4), _fy(80))], C1, 2.8),
     poly([(_fx(1), _fy(0)), (_fx(2), _fy(80))], C2, 2.8),
     dot(_fx(4 / 3.0), _fy(80 / 3.0)),
     legend(150, 92, [(C1, "8時発"), (C2, "9時発")]),
     t(286, 292, "A地からB地までは80km。2台とも A→B の向き", GRAY, 11)]
))

# ══ 大問6（HG-3879）一郎君と二郎君（二郎はA町で休む）════════════════
# たて軸に目もりは無く、左に「1.5km」のかっこがあるだけ。よこ軸は3つの時刻だけ。
_X0, _XE = 168, 476
_fx, _fy = mk(_X0, 244, _XE, 68, 85, 1.0)
_h15 = 1.5 / 6.6                                  # 1.5km は AB間の 何倍か
_tmeet = 85 * 25 / (85 + 25.0)                    # 2人が出会う時刻（約19.3分）
FIGS["HG-3879"] = svg("0 0 580 320", "".join([
    axes(_X0, 244, _XE, 68, "", ""),
    ln(_X0, 68, _XE, 68, GUIDE, 1.3),             # B町の高さの線（箱の上辺）
    ln(_XE, 244, _XE, 68, GUIDE, 1.3),
    gh(_fy(_h15), _X0, _fx(_tmeet)),
    gv(_fx(73), 244, _fy(1.0)),
    ytick(_fy(1.0), _X0, "B町"), ytick(_fy(0), _X0, "A町"),
    # 1.5km は「A町から出会った高さまで」を測っている。軸の左に寸法線で出す
    dim(_X0, _fy(0), _X0, _fy(_h15), "1.5km", 34, -1),
    xtick(_fx(25), 244, "25分"),
    xtick(_fx(73), 244, "1時間"), t(_fx(73), 280, "13分", TX, 12),
    xtick(_fx(85), 244, "1時間"), t(_fx(85), 280, "25分", TX, 12),
    poly([(_fx(0), _fy(0)), (_fx(85), _fy(1.0))], C1, 2.8),
    poly([(_fx(0), _fy(1.0)), (_fx(25), _fy(0)), (_fx(48), _fy(0)), (_fx(73), _fy(1.0))], C2, 2.8),
    dot(_fx(_tmeet), _fy(_h15)),
    t(_fx(44), _fy(0.30), "一郎君（歩き）", C1, 12),
    t(_fx(36), _fy(0.09), "二郎君（自転車）", C2, 12),
    t(290, 312, "二郎君はA町で何分か休んでから、行きと同じ速さでB町へもどる", GRAY, 11),
]))

# ══ 大問7（HG-3880）兄と弟のへだたりグラフ ══════════════════════════
_fx, _fy = mk(88, 248, 466, 70, 68, 680)
FIGS["HG-3880"] = svg("0 0 520 300", "".join([
    gh(_fy(600), 88, _fx(20)), gv(_fx(20), 248, _fy(600)),
    axes(88, 248, 466, 70, "(分)", "(m)"),
    xtick(_fx(0), 248, "0"), xtick(_fx(20), 248, "20"), xtick(_fx(60), 248, "60"),
    ytick(_fy(600), 88, "600"),
    poly([(_fx(0), _fy(0)), (_fx(20), _fy(600)), (_fx(60), _fy(0))], HI, 2.8),
    t(275, 292, "たてじく＝そのときの 兄と弟のあいだの きょり", GRAY, 11),
]))

# ══ 大問8（HG-3881）花子と良子（線分図＋へだたりグラフ）════════════════
# 実物は図が2つ並んでいる。左＝A町—C—D—B町の線分図、右＝へだたりグラフ。
_lx0, _lx1, _ly = 60, 300, 120
_cx = _lx0 + (_lx1 - _lx0) * 0.31
_dx = _lx0 + (_lx1 - _lx0) * 0.65
_fx, _fy = mk(392, 210, 646, 58, 90, 4000)
FIGS["HG-3881"] = svg("0 0 690 260", "".join([
    # ── 左：線分図 ──
    '<path d="M%d %d Q%d %d %d %d" fill="none" stroke="%s" stroke-width="1.4"/>'
    % (_lx0, _ly - 14, (_lx0 + _lx1) // 2, _ly - 52, _lx1, _ly - 14, GRAY),
    t((_lx0 + _lx1) / 2, _ly - 40, "3600m", TX, 13),
    ln(_lx0, _ly, _lx1, _ly, LINE, 2.4),
    ln(_lx0, _ly - 9, _lx0, _ly + 9, LINE, 2.2),
    ln(_lx1, _ly - 9, _lx1, _ly + 9, LINE, 2.2),
    ln(_cx, _ly - 7, _cx, _ly + 7, LINE, 2),
    ln(_dx, _ly - 7, _dx, _ly + 7, LINE, 2),
    t(_lx0 - 8, _ly - 12, "A町", TX, 13, "end"),
    t(_lx1 + 8, _ly - 12, "B町", TX, 13, "start"),
    t(_cx, _ly - 12, "C", TX, 13), t(_dx, _ly - 12, "D", TX, 13),
    t(_lx0 - 8, _ly + 24, "花子", C1, 12, "end"),
    ln(_lx0 + 2, _ly + 19, _lx0 + 40, _ly + 19, C1, 1.8),
    '<polygon points="%d,%d %d,%d %d,%d" fill="%s"/>' % (
        _lx0 + 46, _ly + 19, _lx0 + 36, _ly + 14, _lx0 + 36, _ly + 24, C1),
    t(_lx1 + 8, _ly + 24, "良子", C2, 12, "start"),
    ln(_lx1 - 2, _ly + 19, _lx1 - 40, _ly + 19, C2, 1.8),
    '<polygon points="%d,%d %d,%d %d,%d" fill="%s"/>' % (
        _lx1 - 46, _ly + 19, _lx1 - 36, _ly + 14, _lx1 - 36, _ly + 24, C2),
    t((_lx0 + _lx1) / 2, _ly + 48, "2人のへだたり", GRAY, 12),
    # ── 右：へだたりグラフ ──
    gh(_fy(3600), 392, _fx(80)), gv(_fx(80), 210, _fy(3600)),
    axes(392, 210, 646, 58, "(分)", "(m)"),
    xtick(_fx(0), 210, "0"), xtick(_fx(30), 210, "30"), xtick(_fx(80), 210, "80"),
    ytick(_fy(3600), 392, "3600"),
    poly([(_fx(0), _fy(3600)), (_fx(30), _fy(0)), (_fx(48), _fy(2160)), (_fx(80), _fy(3600))],
         HI, 2.8),
    t(519, 252, "たてじく＝2人のへだたり", GRAY, 11),
]))

# ══ 大問9（HG-3882）太郎と次郎のへだたりグラフ ═════════════════════
_fx, _fy = mk(90, 248, 466, 66, 3.3, 9)
FIGS["HG-3882"] = svg("0 0 520 300", "".join(
    [gh(_fy(v), 90, _fx(tt)) for v, tt in ((2, 0.5), (4, 2), (8, 3))] +
    [gv(_fx(tt), 248, _fy(v)) for tt, v in ((0.5, 2), (2, 4), (3, 8))] +
    [axes(90, 248, 466, 66, "(時間)", "(km)")] +
    [xtick(_fx(i), 248, str(i)) for i in range(4)] +
    [ytick(_fy(v), 90, str(v)) for v in (2, 4, 8)] +
    [poly([(_fx(0), _fy(0)), (_fx(0.5), _fy(2)), (_fx(1), _fy(0)), (_fx(2), _fy(4)),
           (_fx(7 / 3.0), _fy(0)), (_fx(3), _fy(8))], HI, 2.8),
     t(278, 292, "たてじく＝太郎君と次郎君のあいだの きょり", GRAY, 11)]
))

# ══ 大問10（HG-3883）速さ×時間のグラフ（長方形）══════════════════
_fx, _fy = mk(98, 244, 460, 74, 210, 30)
FIGS["HG-3883"] = svg("0 0 520 290", "".join([
    gv(_fx(180), 244, _fy(25)),
    axes(98, 244, 460, 74, "(秒)", "(m/秒)"),
    xtick(_fx(0), 244, "0"), xtick(_fx(180), 244, "180"),
    ytick(_fy(25), 98, "25"),
    poly([(_fx(0), _fy(25)), (_fx(180), _fy(25))], C1, 2.8),
    t(279, 282, "A駅を出てB駅に着くまで、ずっと同じ速さ", GRAY, 11),
]))

# ══ 大問11（HG-3884）とちゅうで速さが変わる ════════════════════════
_fx, _fy = mk(98, 244, 460, 74, 120, 30)
FIGS["HG-3884"] = svg("0 0 520 290", "".join([
    gh(_fy(25), 98, _fx(60)),
    gv(_fx(60), 244, _fy(25)), gv(_fx(100), 244, _fy(25)),
    axes(98, 244, 460, 74, "(秒)", "(m/秒)"),
    xtick(_fx(0), 244, "0"), xtick(_fx(60), 244, "60"), xtick(_fx(100), 244, "100"),
    ytick(_fy(25), 98, "25"), ytick(_fy(20), 98, "20"),
    poly([(_fx(0), _fy(20)), (_fx(60), _fy(20))], C1, 2.8),
    poly([(_fx(60), _fy(25)), (_fx(100), _fy(25))], C1, 2.8),
    t(279, 282, "60秒で速さが 20m/秒 から 25m/秒 に変わる", GRAY, 11),
]))

# ══ 大問12（HG-3885）加速をふくむ（台形）════════════════════════════
_fx, _fy = mk(98, 244, 470, 74, 175, 18)
FIGS["HG-3885"] = svg("0 0 520 290", "".join([
    gh(_fy(15), 98, _fx(40)), gv(_fx(40), 244, _fy(15)), gv(_fx(150), 244, _fy(15)),
    axes(98, 244, 470, 74, "(秒)", "(m/秒)"),
    xtick(_fx(0), 244, "0"), xtick(_fx(40), 244, "40"), xtick(_fx(150), 244, "150"),
    ytick(_fy(15), 98, "15"),
    poly([(_fx(0), _fy(0)), (_fx(40), _fy(15)), (_fx(150), _fy(15))], C1, 2.8),
    t(284, 282, "はじめの40秒は だんだん速くなる（ななめの線）", GRAY, 11),
]))

# ══ 大問13（HG-3886）花子と太郎のダイヤグラム ═══════════════════════
# たて軸は A地点／B地点 だけ、よこ軸は 10時 だけ。目もりの数字は無い。
_fx, _fy = mk(122, 246, 452, 68, 95, 1.0)
FIGS["HG-3886"] = svg("0 0 540 300", "".join([
    gh(_fy(1.0), 122, 452),
    axes(122, 246, 452, 68, "", ""),
    ytick(_fy(1.0), 122, "B地点"), ytick(_fy(0), 122, "A地点"),
    t(_fx(0), 266, "10時", TX, 12),
    poly([(_fx(0), _fy(0)), (_fx(30), _fy(1.0)), (_fx(35), _fy(1.0)), (_fx(65), _fy(0))], C1, 2.8),
    poly([(_fx(0), _fy(1.0)), (_fx(45), _fy(0)), (_fx(50), _fy(0)), (_fx(95), _fy(1.0))], C2, 2.8),
    t(_fx(65) + 8, _fy(0) - 10, "花子さん", C1, 12, "start"),
    t(_fx(95) + 8, _fy(1.0) + 4, "太郎君", C2, 12, "start"),
    t(270, 292, "たいらなところは折り返し点での5分間の休けい", GRAY, 11),
]))

# ══ 大問14（HG-3887）直線AB上の2点P・Q（線分図＋グラフ）════════════
_sx0, _sx1, _sy = 262, 556, 44
_fx, _fy = mk(94, 288, 516, 96, 100, 400)
_P = [(0, 0), (18, 216), (36, 0), (63, 324), (90, 0)]
_Q = [(0, 360), (18, 216), (54, 360), (63, 324), (81, 360)]
FIGS["HG-3887"] = svg("0 0 600 340", "".join([
    # ── 上：直線AB ──
    ln(_sx0, _sy, _sx1, _sy, LINE, 2.4),
    t(_sx0 - 8, _sy + 16, "A", TX, 13, "end"), t(_sx1 + 8, _sy + 16, "B", TX, 13, "start"),
    dot(_sx0 + 0.35 * (_sx1 - _sx0), _sy, TX, 4),
    dot(_sx0 + 0.72 * (_sx1 - _sx0), _sy, TX, 4),
    t(_sx0 + 0.35 * (_sx1 - _sx0), _sy - 10, "P", TX, 13),
    t(_sx0 + 0.72 * (_sx1 - _sx0), _sy - 10, "Q", TX, 13),
    # ── 下：グラフ ──
    gh(_fy(360), 94, 516), gh(_fy(216), 94, _fx(54)),
    gv(_fx(18), 288, _fy(216)), gv(_fx(54), 288, _fy(360)), gv(_fx(63), 288, _fy(324)),
    axes(94, 288, 516, 96, "(秒)", "(cm)"),
    ytick(_fy(360), 94, "B"), ytick(_fy(216), 94, "216"), ytick(_fy(0), 94, "A"),
    xtick(_fx(0), 288, "0"), xtick(_fx(18), 288, "18"), xtick(_fx(36), 288, "36"),
    xtick(_fx(54), 288, "x"), xtick(_fx(63), 288, "63"),
    poly([(_fx(a), _fy(b)) for a, b in _Q], C2, 1.8),
    poly([(_fx(81), _fy(360)), (_fx(98), _fy(326))], C2, 1.8, "5 4"),
    poly([(_fx(a), _fy(b)) for a, b in _P], C1, 3.2),
    poly([(_fx(90), _fy(0)), (_fx(98), _fy(96))], C1, 3.2, "5 4"),
    dot(_fx(18), _fy(216)), dot(_fx(63), _fy(324)),
    t(_fx(42), _fy(272), "点Q（細い線）", C2, 12),
    t(_fx(74), _fy(50), "点P（太い線）", C1, 12),
    t(300, 334, "出会ったとき・A/Bに着いたときは向きが反対になる", GRAY, 11),
]))

# ══ 大問15（HG-3888）姉妹の忘れ物・へだたりグラフ ═══════════════════
_fx, _fy = mk(98, 248, 462, 68, 22, 820)
FIGS["HG-3888"] = svg("0 0 520 300", "".join([
    gh(_fy(720), 98, _fx(9)), gh(_fy(240), 98, _fx(17)),
    gv(_fx(9), 248, _fy(720)), gv(_fx(17), 248, _fy(240)),
    axes(98, 248, 462, 68, "(分)", "(m)"),
    xtick(_fx(0), 248, "0"), xtick(_fx(9), 248, "9"),
    xtick(_fx(17), 248, "17"), xtick(_fx(19), 248, "19"),
    ytick(_fy(720), 98, "720"), ytick(_fy(240), 98, "240"),
    poly([(_fx(0), _fy(0)), (_fx(5), _fy(0)), (_fx(9), _fy(720)),
          (_fx(17), _fy(240)), (_fx(19), _fy(0))], HI, 2.8),
    dot(_fx(17), _fy(240), TX, 4.5),
    t(280, 292, "たてじく＝姉と妹のへだたり（はじめはいっしょなので0）", GRAY, 11),
]))

# ══ 大問16（HG-3889）電車の加速・減速（台形）════════════════════════
_fx, _fy = mk(98, 244, 476, 74, 270, 36)
FIGS["HG-3889"] = svg("0 0 530 290", "".join([
    gh(_fy(30), 98, _fx(60)), gv(_fx(60), 244, _fy(30)), gv(_fx(180), 244, _fy(30)),
    axes(98, 244, 476, 74, "(秒)", "(m/秒)"),
    xtick(_fx(0), 244, "0"), xtick(_fx(60), 244, "60"),
    xtick(_fx(180), 244, "180"), xtick(_fx(240), 244, "240"),
    ytick(_fy(30), 98, "30"),
    poly([(_fx(0), _fy(0)), (_fx(60), _fy(30)), (_fx(180), _fy(30)), (_fx(240), _fy(0))],
         C1, 2.8),
    t(287, 282, "0〜60秒で加速、180秒から減速して240秒にB駅に着く", GRAY, 11),
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
    if not args.write:
        print("（--write を付けると実際に書き込みます）")
        return
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("✅ 原簿に書き込み完了")


if __name__ == "__main__":
    main()
