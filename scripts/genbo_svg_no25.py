# -*- coding: utf-8 -*-
"""第1講座 No.25「曲線図形(3)」の図（HG-3686〜3701・大問1〜16）を、PDFの実物を見て原簿に入れる。

★根拠：小5最レ算数 第3分冊 第1講座.pdf の PDFページ25〜30（本文p26-31）を
  200dpi＋部分400/700dpiで出して目視。原簿に図は無いのでここが唯一の根拠。

実物で確かめたこと（特に「どこが斜線か」）：
  大問1  … おうぎ形OABは上向き（Oが下）。CはOA上・DはOB上。ACに8cm
  大問2  … 半円ADは上・半円ABも上・半円BDは下
  大問3  … 半径12/24/36の中心角120°のおうぎ形3つ。中心はB→A→Cの順
  大問4  … 4本の帯のうち **内から2番目と4番目** が斜線
  大問5  … 3×3の9区画が **市松**（内2cm/1cm/1cm、90°を3等分）
           斜線＝(下段の2〜3)(中段の0〜2)(中段の3〜4)(上段の2〜3)
  大問6  … 半円AC(上)・AB(上)・BD(下)・CD(下)。斜線＝(AC−AB)＋(BD−CD)のS字
  大問7  … (1)(2)とも同じ形。直角は左下、点線は左上角と右下角を結ぶ対角線
  大問8  … (1) 円に内接する正方形ABCD（A上B左C下D右）・斜線は弓形4つ
           (2) 正方形ABCD（A左上D右上B左下C右下）に内接円・8cmは対角線AC
  大問9  … 90°おうぎ形の中心は底辺の中点M。両側に直角二等辺三角形
  大問10 … 正方形→内接円→（円周上に頂点をもつ）正方形→内接円
  大問11 … 大きい正方形の対角線＝大おうぎ形の半径。小正方形の対角線＝小おうぎ形の半径
  大問12 … 葉っぱ形を A→中心→C の2つの弧が㋐（左下）と㋑（右上）に分ける
  大問13 … おうぎ形の頂点と弧の両端の3点が円周上（＝斜辺が直径）
  大問14 … 斜線＝円Aの弓形（PQより上）＋円Bの下半分
  大問15 … 正方形＋内接円＋左下角中心の半径20cmの弧。斜線は右上の三日月の帯
  大問16 … 角Oにはさまれた円が A→①→②→③ と外接しながら大きくなる

寸法の描き方（本人指示 2026-08-10）：
  数字を figure の中に浮かせず、必ず「どの線分か」が分かる寸法線＋爪＋ラベルにする。
  半径は中心からの線分そのものを描いてから寸法をつける。角度は頂点に小さい弧を描く。

使い方: python scripts/genbo_svg_no25.py [--write]
"""
import io, os, re, sys, argparse, math

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from genbo_path import find_genbo

S = 'style="display:block;margin:0 auto;max-width:100%"'
LINE, HI, TX, GRAY = '#4f9eff', '#ffd166', '#c9d4f0', '#9aa3c0'
FILL = 'rgba(255,209,102,0.22)'
FILL2 = 'rgba(79,158,255,0.26)'


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


def pol(cx, cy, r, deg):
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy + r * math.sin(a))


def arc(cx, cy, r, a1, a2, stroke=LINE, w=2, dash=None):
    """中心(cx,cy)半径rの、角度a1→a2（度・画面座標＝y下向き）の弧"""
    x1, y1 = pol(cx, cy, r, a1)
    x2, y2 = pol(cx, cy, r, a2)
    lg = 1 if abs(a2 - a1) > 180 else 0
    sw = 1 if a2 > a1 else 0
    d = ' stroke-dasharray="%s"' % dash if dash else ''
    return ('<path d="M%.1f %.1f A%.1f %.1f 0 %d %d %.1f %.1f" fill="none" stroke="%s"'
            ' stroke-width="%s"%s/>' % (x1, y1, r, r, lg, sw, x2, y2, stroke, w, d))


def sect(cx, cy, r, a1, a2, fill=FILL, stroke=HI, w=1.6):
    """中心から切り出したおうぎ形（パイ形）"""
    x1, y1 = pol(cx, cy, r, a1)
    x2, y2 = pol(cx, cy, r, a2)
    lg = 1 if abs(a2 - a1) > 180 else 0
    sw = 1 if a2 > a1 else 0
    return ('<path d="M%.1f %.1f L%.1f %.1f A%.1f %.1f 0 %d %d %.1f %.1f Z" fill="%s"'
            ' stroke="%s" stroke-width="%s"/>' % (cx, cy, x1, y1, r, r, lg, sw, x2, y2,
                                                  fill, stroke, w))


def band(cx, cy, ra, rb, a1, a2, fill=FILL, stroke=HI, w=1.6):
    """同心の帯（半径ra〜rb、角度a1→a2）"""
    p1 = pol(cx, cy, ra, a1)
    p2 = pol(cx, cy, rb, a1)
    p3 = pol(cx, cy, rb, a2)
    p4 = pol(cx, cy, ra, a2)
    lg = 1 if abs(a2 - a1) > 180 else 0
    sw = 1 if a2 > a1 else 0
    return ('<path d="M%.1f %.1f L%.1f %.1f A%.1f %.1f 0 %d %d %.1f %.1f L%.1f %.1f'
            ' A%.1f %.1f 0 %d %d %.1f %.1f Z" fill="%s" stroke="%s" stroke-width="%s"/>'
            % (p1[0], p1[1], p2[0], p2[1], rb, rb, lg, sw, p3[0], p3[1],
               p4[0], p4[1], ra, ra, lg, 1 - sw, p1[0], p1[1], fill, stroke, w))


def dim(x1, y1, x2, y2, label, off=10, side=1, size=12):
    """2点間の寸法線（両端に短い爪）＋中央にラベル。offは図から離す量"""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L * off * side, dx / L * off * side   # 法線方向へずらす
    ax, ay, bx, by = x1 + nx, y1 + ny, x2 + nx, y2 + ny
    tx, ty = -nx / off * 4, -ny / off * 4                 # 爪
    return "".join([
        ln(ax, ay, bx, by, GRAY, 1.2),
        ln(ax - tx, ay - ty, ax + tx, ay + ty, GRAY, 1.2),
        ln(bx - tx, by - ty, bx + tx, by + ty, GRAY, 1.2),
        t((ax + bx) / 2 + nx * 0.9, (ay + by) / 2 + ny * 0.9 + 4, label, TX, size),
    ])


def arcdim(cx, cy, r, a1, a2, label, off=16, size=12):
    """弧の長さの寸法。弧に沿った細い線＋両端に半径方向の爪＋中央にラベル。
    off>0 で外側、off<0 で内側に置く。"""
    R = r + off
    s = 1 if off > 0 else -1
    p1 = pol(cx, cy, R, a1)
    p2 = pol(cx, cy, R, a2)
    q1a, q1b = pol(cx, cy, R - 4, a1), pol(cx, cy, R + 4, a1)
    q2a, q2b = pol(cx, cy, R - 4, a2), pol(cx, cy, R + 4, a2)
    lab = pol(cx, cy, R + s * 13, (a1 + a2) / 2.0)
    lg = 1 if abs(a2 - a1) > 180 else 0
    sw = 1 if a2 > a1 else 0
    return "".join([
        '<path d="M%.1f %.1f A%.1f %.1f 0 %d %d %.1f %.1f" fill="none" stroke="%s"'
        ' stroke-width="1.2"/>' % (p1[0], p1[1], R, R, lg, sw, p2[0], p2[1], GRAY),
        ln(q1a[0], q1a[1], q1b[0], q1b[1], GRAY, 1.2),
        ln(q2a[0], q2a[1], q2b[0], q2b[1], GRAY, 1.2),
        t(lab[0], lab[1] + 4, label, TX, size),
    ])


def dot(x, y, c=TX, r=3.2):
    return '<circle cx="%.1f" cy="%.1f" r="%s" fill="%s"/>' % (x, y, r, c)


def circ(cx, cy, r, stroke=LINE, w=2, fill="none"):
    return '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="%s" stroke-width="%s"/>' % (
        cx, cy, r, fill, stroke, w)


FIGS = {}

# ── 大問1（HG-3686）おうぎ形OABと内側のおうぎ形OCD ────────────────
_O = (215.0, 190.0)
_RA, _RC = 145.0, 96.7
_a1, _a2 = 215.0, 325.0
_A = pol(_O[0], _O[1], _RA, _a1)
_B = pol(_O[0], _O[1], _RA, _a2)
_C = pol(_O[0], _O[1], _RC, _a1)
_D = pol(_O[0], _O[1], _RC, _a2)
FIGS["HG-3686"] = svg("0 0 430 232", "".join([
    ln(_O[0], _O[1], _A[0], _A[1]), ln(_O[0], _O[1], _B[0], _B[1]),
    arc(_O[0], _O[1], _RA, _a1, _a2),
    arc(_O[0], _O[1], _RC, _a1, _a2),
    ln(_A[0], _A[1], _C[0], _C[1], HI, 3.4),                # 8cm の AC
    arcdim(_O[0], _O[1], _RA, _a1, _a2, "弧AB 60cm", 16),
    arcdim(_O[0], _O[1], _RC, _a1, _a2, "弧CD 40cm", -16),
    dim(_A[0], _A[1], _C[0], _C[1], "8cm", 15, 1),
    dot(_A[0], _A[1]), dot(_B[0], _B[1]), dot(_C[0], _C[1]), dot(_D[0], _D[1]),
    dot(_O[0], _O[1]),
    t(_A[0] - 9, _A[1] - 7, "A", TX, 14, "end"),
    t(_B[0] + 9, _B[1] - 7, "B", TX, 14, "start"),
    t(_C[0] + 11, _C[1] + 16, "C", TX, 14, "start"),
    t(_D[0] + 9, _D[1] + 16, "D", TX, 14, "start"),
    t(_O[0], _O[1] + 22, "O", TX, 14),
]))

# ── 大問2（HG-3687）直径ADを3等分・半円AB(上)と半円BD(下) ──────────
_ax, _bx, _cx, _dx = 60.0, 140.0, 220.0, 300.0
_yy = 150.0
FIGS["HG-3687"] = svg("0 0 470 290", "".join([
    ln(_ax, _yy, _dx, _yy),
    '<path d="M%d %d A120 120 0 0 1 %d %d" fill="none" stroke="%s" stroke-width="2"/>'
    % (_ax, _yy, _dx, _yy, LINE),                              # 半円AD（上）
    '<path d="M%d %d A40 40 0 0 1 %d %d" fill="none" stroke="%s" stroke-width="2"/>'
    % (_ax, _yy, _bx, _yy, LINE),                              # 半円AB（上）
    '<path d="M%d %d A80 80 0 0 0 %d %d" fill="none" stroke="%s" stroke-width="2"/>'
    % (_bx, _yy, _dx, _yy, LINE),                              # 半円BD（下）
    dot(_bx, _yy), dot(_cx, _yy),
    ln(_ax, _yy, _ax, 250, GRAY, 1, "4 4"), ln(_bx, _yy, _bx, 250, GRAY, 1, "4 4"),
    ln(_cx, _yy, _cx, 250, GRAY, 1, "4 4"), ln(_dx, _yy, _dx, 250, GRAY, 1, "4 4"),
    dim(_ax, 246, _bx, 246, "①", 10, 1),
    dim(_bx, 246, _cx, 246, "①", 10, 1),
    dim(_cx, 246, _dx, 246, "①", 10, 1),
    t(_ax - 10, _yy + 5, "A", TX, 14, "end"),
    t(_bx - 6, _yy + 22, "B", TX, 14, "end"),
    t(_cx, _yy - 12, "C", TX, 14),
    t(_dx + 10, _yy + 5, "D", TX, 14, "start"),
    t(390, 125, "B・Cは直径ADを", GRAY, 11),
    t(390, 145, "3等分する点", GRAY, 11),
    t(390, 172, "小さい半円の直径は", GRAY, 11),
    t(390, 192, "AB・BD", GRAY, 11),
]))

# ── 大問3（HG-3688）正三角形のまわりのおうぎ形3つ ────────────────
_s3 = 42.0
_ox, _oy = 110.0, 145.0
_B3 = (_ox, _oy)
_C3 = (_ox + _s3, _oy)
_A3 = (_ox + _s3 / 2, _oy - _s3 * 0.866)
_P1 = (_ox - _s3 / 2, _oy + _s3 * 0.866)
_P2 = (_ox - _s3 / 2, _oy - _s3 * 0.866 * 3)
_P3 = (_ox + _s3 * 4, _oy)
FIGS["HG-3688"] = svg("0 0 470 220", "".join([
    arc(_B3[0], _B3[1], _s3, 0, 120),
    arc(_A3[0], _A3[1], 2 * _s3, 120, 240),
    arc(_C3[0], _C3[1], 3 * _s3, 240, 360),
    ln(_P1[0], _P1[1], _A3[0], _A3[1]),
    ln(_P2[0], _P2[1], _C3[0], _C3[1]),
    ln(_B3[0], _B3[1], _P3[0], _P3[1]),
    dot(_A3[0], _A3[1]), dot(_B3[0], _B3[1]), dot(_C3[0], _C3[1]),
    ln(_B3[0], _B3[1], _B3[0], 196, GRAY, 1, "4 4"),
    ln(_C3[0], _C3[1], _C3[0], 196, GRAY, 1, "4 4"),
    dim(_B3[0], 188, _C3[0], 188, "12cm", 10, 1),
    t(_A3[0] + 10, _A3[1] - 4, "A", TX, 14, "start"),
    t(_B3[0] - 9, _B3[1] + 15, "B", TX, 14, "end"),
    t(_C3[0] + 10, _C3[1] + 15, "C", TX, 14, "start"),
    t(378, 82, "中心角はどれも120°", GRAY, 11),
    t(378, 104, "半径は12→24→36cm", GRAY, 11),
]))

# ── 大問4（HG-3689）半径4cm中心角30°を1cmずつ・2番目と4番目が斜線 ──
_O4 = (50.0, 170.0)
FIGS["HG-3689"] = svg("0 0 420 216", "".join([
    band(_O4[0], _O4[1], 75, 150, -30, 0),                # 斜線（内から2番目）
    band(_O4[0], _O4[1], 225, 300, -30, 0),               # 斜線（内から4番目）
    ln(_O4[0], _O4[1], pol(_O4[0], _O4[1], 300, -30)[0], pol(_O4[0], _O4[1], 300, -30)[1]),
    ln(_O4[0], _O4[1], 350, 170),
    arc(_O4[0], _O4[1], 75, -30, 0), arc(_O4[0], _O4[1], 150, -30, 0),
    arc(_O4[0], _O4[1], 225, -30, 0), arc(_O4[0], _O4[1], 300, -30, 0),
    dim(50, 170, 125, 170, "1cm", 14, 1), dim(125, 170, 200, 170, "1cm", 14, 1),
    dim(200, 170, 275, 170, "1cm", 14, 1), dim(275, 170, 350, 170, "1cm", 14, 1),
    t(316, 18, "A", TX, 14, "start"), t(358, 168, "B", TX, 14, "start"),
    t(40, 178, "O", TX, 14, "end"),
    t(150, 50, "半径4cm・中心角30°", GRAY, 11),
]))

# ── 大問5（HG-3690）半径4cm中心角90°・90°は3等分・市松に斜線 ────────
_O5 = (55.0, 255.0)
_R5 = 210.0
FIGS["HG-3690"] = svg("0 0 480 300", "".join([
    band(_O5[0], _O5[1], 105.0, 157.5, -30, 0),           # 下段の2〜3cm
    sect(_O5[0], _O5[1], 105.0, -60, -30),                # 中段の0〜2cm
    band(_O5[0], _O5[1], 157.5, _R5, -60, -30),           # 中段の3〜4cm
    band(_O5[0], _O5[1], 105.0, 157.5, -90, -60),         # 上段の2〜3cm
    ln(_O5[0], _O5[1], 265, 255),
    ln(_O5[0], _O5[1], pol(_O5[0], _O5[1], _R5, -30)[0], pol(_O5[0], _O5[1], _R5, -30)[1]),
    ln(_O5[0], _O5[1], pol(_O5[0], _O5[1], _R5, -60)[0], pol(_O5[0], _O5[1], _R5, -60)[1]),
    ln(_O5[0], _O5[1], 55, 45),
    arc(_O5[0], _O5[1], 105.0, -90, 0), arc(_O5[0], _O5[1], 157.5, -90, 0),
    arc(_O5[0], _O5[1], _R5, -90, 0),
    dim(55, 255, 160, 255, "2cm", 14, 1),
    dim(160, 255, 212.5, 255, "1cm", 14, 1),
    dim(212.5, 255, 265, 255, "1cm", 14, 1),
    t(45, 262, "O", TX, 14, "end"), t(275, 262, "A", TX, 14, "start"),
    t(45, 42, "B", TX, 14, "end"),
    t(385, 110, "半径4cm・中心角90°", GRAY, 11),
    t(385, 132, "中心角90°は3等分", GRAY, 11),
    t(385, 154, "斜線と白の面積の比", GRAY, 11),
]))

# ── 大問6（HG-3691）直径ADを3等分・半円4つ・S字の斜線 ────────────
_y6 = 155.0
_A6, _B6, _C6, _D6 = 110.0, 190.0, 270.0, 350.0
FIGS["HG-3691"] = svg("0 0 520 325", "".join([
    # 斜線（上）＝半円AC−半円AB
    '<path d="M%.0f %.0f A80 80 0 0 1 %.0f %.0f L%.0f %.0f A40 40 0 0 0 %.0f %.0f Z"'
    ' fill="%s" stroke="%s" stroke-width="1.6"/>'
    % (_A6, _y6, _C6, _y6, _B6, _y6, _A6, _y6, FILL, HI),
    # 斜線（下）＝半円BD−半円CD
    '<path d="M%.0f %.0f L%.0f %.0f A40 40 0 0 0 %.0f %.0f A80 80 0 0 1 %.0f %.0f Z"'
    ' fill="%s" stroke="%s" stroke-width="1.6"/>'
    % (_B6, _y6, _C6, _y6, _D6, _y6, _B6, _y6, FILL, HI),
    circ(230, _y6, 120),
    ln(_A6, _y6, _D6, _y6),
    '<path d="M%.0f %.0f A80 80 0 0 1 %.0f %.0f" fill="none" stroke="%s"'
    ' stroke-width="2"/>' % (_A6, _y6, _C6, _y6, LINE),
    '<path d="M%.0f %.0f A40 40 0 0 1 %.0f %.0f" fill="none" stroke="%s"'
    ' stroke-width="2"/>' % (_A6, _y6, _B6, _y6, LINE),
    '<path d="M%.0f %.0f A80 80 0 0 0 %.0f %.0f" fill="none" stroke="%s"'
    ' stroke-width="2"/>' % (_B6, _y6, _D6, _y6, LINE),
    '<path d="M%.0f %.0f A40 40 0 0 0 %.0f %.0f" fill="none" stroke="%s"'
    ' stroke-width="2"/>' % (_C6, _y6, _D6, _y6, LINE),
    dot(_B6, _y6), dot(_C6, _y6),
    ln(_A6, _y6, _A6, 296, GRAY, 1, "4 4"), ln(_B6, _y6, _B6, 296, GRAY, 1, "4 4"),
    ln(_C6, _y6, _C6, 296, GRAY, 1, "4 4"), ln(_D6, _y6, _D6, 296, GRAY, 1, "4 4"),
    dim(_A6, 292, _B6, 292, "①", 9, 1), dim(_B6, 292, _C6, 292, "①", 9, 1),
    dim(_C6, 292, _D6, 292, "①", 9, 1),
    t(_A6 - 10, _y6 + 5, "A", TX, 14, "end"), t(_B6 - 5, _y6 + 22, "B", TX, 14, "end"),
    t(_C6 + 5, _y6 - 10, "C", TX, 14, "start"), t(_D6 + 10, _y6 + 5, "D", TX, 14, "start"),
    t(445, 120, "B・Cは直径ADを", GRAY, 11),
    t(445, 140, "3等分する点", GRAY, 11),
    t(445, 168, "半円の直径は", GRAY, 11),
    t(445, 188, "AB・AC・BD・CD", GRAY, 11),
]))


# ── 大問7（HG-3692）対角線が分かる四分円（(1)10cm・(2)16cm）────────
def _quarter(ox, oy, size, label, tag):
    return "".join([
        ln(ox, oy, ox, oy - size), ln(ox, oy, ox + size, oy),
        arc(ox, oy, size, -90, 0),
        '<polyline points="%d,%d %d,%d %d,%d" fill="none" stroke="%s" stroke-width="1.6"/>'
        % (ox, oy - 13, ox + 13, oy - 13, ox + 13, oy, GRAY),
        ln(ox, oy - size, ox + size, oy, HI, 2, "7 5"),
        dim(ox, oy - size, ox + size, oy, label, 16, 1),
        t(ox - 22, oy - size - 26, tag, TX, 13, "start"),
    ])


FIGS["HG-3692"] = svg("0 0 470 212", "".join([
    _quarter(60, 180, 120, "10cm", "(1)"),
    _quarter(300, 180, 120, "16cm", "(2)"),
]))

# ── 大問8（HG-3693）正方形と円を重ねる ────────────────────────
FIGS["HG-3693"] = svg("0 0 500 272", "".join([
    # (1) 円−内接正方形（弓形4つが斜線）
    '<path d="M205 140 A90 90 0 1 1 25 140 A90 90 0 1 1 205 140 M115 50 L205 140 L115 230'
    ' L25 140 Z" fill-rule="evenodd" fill="%s" stroke="%s" stroke-width="1.4"/>' % (FILL, HI),
    circ(115, 140, 90),
    '<polygon points="115,50 205,140 115,230 25,140" fill="none" stroke="%s"'
    ' stroke-width="2"/>' % LINE,
    dim(115, 50, 25, 140, "12cm", 14, -1),
    t(115, 40, "A", TX, 14), t(15, 146, "B", TX, 14, "end"),
    t(115, 250, "C", TX, 14), t(215, 146, "D", TX, 14, "start"),
    t(22, 28, "(1)", TX, 13, "start"),
    # (2) 正方形−内接円（4すみが斜線）
    '<path d="M300 55 L470 55 L470 225 L300 225 Z M470 140 A85 85 0 1 1 300 140'
    ' A85 85 0 1 1 470 140" fill-rule="evenodd" fill="%s" stroke="%s"'
    ' stroke-width="1.4"/>' % (FILL, HI),
    '<rect x="300" y="55" width="170" height="170" fill="none" stroke="%s"'
    ' stroke-width="2"/>' % LINE,
    circ(385, 140, 85),
    ln(300, 55, 470, 225, LINE, 1.6, "5 4"),
    dot(385, 140),
    dim(300, 55, 470, 225, "8cm", 15, 1),
    t(292, 48, "A", TX, 14, "end"), t(478, 48, "D", TX, 14, "start"),
    t(292, 240, "B", TX, 14, "end"), t(478, 240, "C", TX, 14, "start"),
    t(288, 28, "(2)", TX, 13, "start"),
]))

# ── 大問9（HG-3694）90°おうぎ形＋直角二等辺三角形2つ ──────────────
_M9 = (210.0, 195.0)
_r9 = 106.07
_P9 = pol(_M9[0], _M9[1], _r9, 225)
_Q9 = pol(_M9[0], _M9[1], _r9, 315)
FIGS["HG-3694"] = svg("0 0 420 252", "".join([
    arc(_M9[0], _M9[1], _r9, 225, 315),
    ln(60, 195, _P9[0], _P9[1]), ln(_P9[0], _P9[1], _M9[0], _M9[1]),
    ln(_M9[0], _M9[1], _Q9[0], _Q9[1]), ln(_Q9[0], _Q9[1], 360, 195),
    ln(60, 195, 360, 195),
    '<polyline points="127.9,127.1 135,134.2 142.1,127.1" fill="none" stroke="%s"'
    ' stroke-width="1.6"/>' % GRAY,
    '<polyline points="292.1,127.1 285,134.2 277.9,127.1" fill="none" stroke="%s"'
    ' stroke-width="1.6"/>' % GRAY,
    '<polyline points="201.5,186.5 210,178 218.5,186.5" fill="none" stroke="%s"'
    ' stroke-width="1.6"/>' % GRAY,
    arc(_M9[0], _M9[1], 36, 180, 225, GRAY, 1.2),
    arc(_M9[0], _M9[1], 36, 315, 360, GRAY, 1.2),
    t(160, 179, "45°", TX, 12), t(260, 179, "45°", TX, 12),
    dim(60, 195, 360, 195, "20cm", 20, 1),
    dot(_P9[0], _P9[1]), dot(_Q9[0], _Q9[1]), dot(_M9[0], _M9[1]),
    t(210, 40, "中心角90°のおうぎ形（中心は底辺の中点）", GRAY, 11),
]))

# ── 大問10（HG-3695）正方形→円→正方形→円 ──────────────────────
FIGS["HG-3695"] = svg("0 0 480 250", "".join([
    '<rect x="60" y="30" width="200" height="200" fill="none" stroke="%s"'
    ' stroke-width="2"/>' % LINE,
    circ(160, 130, 100),
    '<polygon points="160,30 260,130 160,230 60,130" fill="none" stroke="%s"'
    ' stroke-width="2"/>' % LINE,
    circ(160, 130, 70.7),
    t(365, 108, "正方形→円→正方形→円", GRAY, 11),
    t(365, 128, "と入れ子になっている", GRAY, 11),
    t(365, 156, "大円の面積は小円の何倍か", GRAY, 11),
]))

# ── 大問11（HG-3696）正方形2つとおうぎ形2つ ──────────────────────
_O11 = (60.0, 225.0)
_k11 = 13.0                        # 1cm = 13px
_big = 10 * _k11                   # 大きい正方形の一辺 130
_Rbig = _big * math.sqrt(2)        # 大おうぎ形の半径 183.8
_sml = _big / math.sqrt(2)         # 小さい正方形の一辺 91.9
FIGS["HG-3696"] = svg("0 0 430 278", "".join([
    '<path d="M%.1f %.1f L%.1f %.1f A%.1f %.1f 0 0 1 %.1f %.1f Z" fill="%s" stroke="%s"'
    ' stroke-width="1.6"/>' % (_O11[0] + _big, _O11[1], _O11[0] + _big, _O11[1] - _big,
                               _Rbig, _Rbig, _O11[0] + _Rbig, _O11[1], FILL, HI),
    ln(_O11[0], _O11[1], _O11[0] + _Rbig, _O11[1]),
    ln(_O11[0], _O11[1], _O11[0], _O11[1] - _Rbig),
    arc(_O11[0], _O11[1], _Rbig, -90, 0),
    arc(_O11[0], _O11[1], _big, -90, 0),
    ln(_O11[0], _O11[1] - _big, _O11[0] + _big, _O11[1] - _big),
    ln(_O11[0] + _big, _O11[1] - _big, _O11[0] + _big, _O11[1]),
    ln(_O11[0], _O11[1] - _sml, _O11[0] + _sml, _O11[1] - _sml),
    ln(_O11[0] + _sml, _O11[1] - _sml, _O11[0] + _sml, _O11[1]),
    dim(_O11[0], _O11[1], _O11[0] + _big, _O11[1], "10cm", 16, 1),
    t(_O11[0] + _sml / 2, _O11[1] - _sml / 2 + 5, "㋐", TX, 15),
    t(_O11[0] + _big + 26, _O11[1] - 46, "㋑", HI, 15),
    t(358, 106, "正方形2つと", GRAY, 11),
    t(358, 126, "おうぎ形2つを重ねた図", GRAY, 11),
    t(358, 152, "㋑が斜線部分", GRAY, 11),
]))

# ── 大問12（HG-3697）正方形の中で四分円の弧をつなぐ ───────────────
FIGS["HG-3697"] = svg("0 0 500 335", "".join([
    # ㋐＝Dを中心の弧と A→中心→C の弧にはさまれた左下
    '<path d="M70 40 A220 220 0 0 0 290 260 A110 110 0 0 0 180 150'
    ' A110 110 0 0 0 70 40 Z" fill="%s" stroke="%s" stroke-width="1.6"/>' % (FILL, HI),
    # ㋑＝A→中心→C の弧とBを中心の弧にはさまれた右上
    '<path d="M70 40 A110 110 0 0 1 180 150 A110 110 0 0 1 290 260'
    ' A220 220 0 0 0 70 40 Z" fill="%s" stroke="%s" stroke-width="1.6"/>' % (FILL2, LINE),
    '<rect x="70" y="40" width="220" height="220" fill="none" stroke="%s"'
    ' stroke-width="2"/>' % LINE,
    ln(62, 150, 78, 150, GRAY, 1.6), ln(180, 252, 180, 268, GRAY, 1.6),
    dot(180, 150),
    dim(70, 260, 290, 260, "20cm", 32, 1),
    t(118, 202, "㋐", HI, 15), t(234, 108, "㋑", LINE, 15),
    t(62, 34, "A", TX, 14, "end"), t(298, 34, "D", TX, 14, "start"),
    t(62, 274, "B", TX, 14, "end"), t(298, 274, "C", TX, 14, "start"),
    t(56, 155, "E", TX, 14, "end"), t(180, 284, "F", TX, 14),
    t(420, 118, "正方形ABCD 一辺20cm", GRAY, 11),
    t(420, 144, "B・Dから半径20cmの弧", GRAY, 11),
    t(420, 170, "E・Fから半径10cmの弧", GRAY, 11),
    t(420, 194, "EはABの中点・FはBCの中点", GRAY, 10),
]))

# ── 大問13（HG-3698）円におうぎ形が3点で接する ───────────────────
_O13 = (290.0, 235.0)
_R13 = 190.0
FIGS["HG-3698"] = svg("0 0 480 286", "".join([
    sect(_O13[0], _O13[1], _R13, 180, 270),
    circ(195, 140, _R13 / math.sqrt(2)),
    ln(_O13[0], _O13[1], 100, 235), ln(_O13[0], _O13[1], 290, 45),
    '<polyline points="278,235 278,223 290,223" fill="none" stroke="%s"'
    ' stroke-width="1.6"/>' % GRAY,
    dot(100, 235), dot(290, 45), dot(290, 235),
    t(410, 114, "円の面積は471cm²", GRAY, 11),
    t(410, 140, "おうぎ形の3つの頂点が", GRAY, 11),
    t(410, 160, "すべて円周上にある", GRAY, 11),
    t(410, 186, "中心角は90°", GRAY, 11),
]))

# ── 大問14（HG-3699）半径8cmの円Aと円B・PQは円Bの直径 ─────────────
_A14 = (200.0, 208.0)
_RA14 = 105.0
_P14 = pol(_A14[0], _A14[1], _RA14, 225)
_Q14 = pol(_A14[0], _A14[1], _RA14, 315)
_B14 = ((_P14[0] + _Q14[0]) / 2, _P14[1])
_RB14 = (_Q14[0] - _P14[0]) / 2
FIGS["HG-3699"] = svg("0 0 500 332", "".join([
    '<path d="M%.1f %.1f A%.1f %.1f 0 0 1 %.1f %.1f A%.1f %.1f 0 0 1 %.1f %.1f Z"'
    ' fill="%s" stroke="%s" stroke-width="1.6"/>'
    % (_P14[0], _P14[1], _RA14, _RA14, _Q14[0], _Q14[1], _RB14, _RB14,
       _P14[0], _P14[1], FILL, HI),
    circ(_A14[0], _A14[1], _RA14),
    circ(_B14[0], _B14[1], _RB14),
    ln(_A14[0], _A14[1], _P14[0], _P14[1], LINE, 1.6, "5 4"),
    ln(_A14[0], _A14[1], _Q14[0], _Q14[1], LINE, 1.6, "5 4"),
    ln(_P14[0], _P14[1], _Q14[0], _Q14[1], LINE, 1.6, "5 4"),
    dim(_A14[0], _A14[1], _P14[0], _P14[1], "8cm", 20, -1),
    dot(_A14[0], _A14[1]), dot(_B14[0], _B14[1]),
    t(_P14[0] - 10, _P14[1] - 7, "P", TX, 14, "end"),
    t(_Q14[0] + 10, _Q14[1] - 7, "Q", TX, 14, "start"),
    t(_B14[0] + 12, _B14[1] + 19, "B", TX, 14, "start"),
    t(_A14[0], _A14[1] + 24, "A", TX, 14),
    t(420, 120, "円Aの半径は8cm", GRAY, 11),
    t(420, 146, "PQは円Bの直径", GRAY, 11),
    t(420, 172, "斜線部分の面積を求める", GRAY, 11),
]))

# ── 大問15（HG-3700）正方形＋内接円＋左下角中心の半径20cmの弧 ────────
FIGS["HG-3700"] = svg("0 0 490 322", "".join([
    '<path d="M70 40 L290 40 L290 260 A220 220 0 0 0 280.3 195.3'
    ' A110 110 0 0 0 134.8 49.8 A220 220 0 0 0 70 40 Z" fill="%s" stroke="%s"'
    ' stroke-width="1.6"/>' % (FILL, HI),
    '<rect x="70" y="40" width="220" height="220" fill="none" stroke="%s"'
    ' stroke-width="2"/>' % LINE,
    circ(180, 150, 110),
    arc(70, 260, 220, -90, 0),
    dim(70, 260, 290, 260, "20cm", 20, 1),
    dot(70, 260),
    t(410, 114, "一辺20cmの正方形", GRAY, 11),
    t(410, 138, "直径20cmの円", GRAY, 11),
    t(410, 164, "左下の角を中心とする", GRAY, 11),
    t(410, 184, "半径20cmのおうぎ形", GRAY, 11),
]))

# ── 大問16（HG-3701）角にはさまれた円を次々に拡大 ────────────────
_O16 = (25.0, 145.0)
_k16 = 13.0
_ang = math.degrees(math.asin(1.0 / 3.0))          # 19.47°
_ux = math.cos(math.radians(_ang))
_uy = math.sin(math.radians(_ang))
_b16 = []
for _d, _r, _lab in [(3, 1, ""), (6, 2, "①"), (12, 4, "②"), (24, 8, "③")]:
    _cx, _cy, _rr = _O16[0] + _d * _k16, _O16[1], _r * _k16
    _b16.append(circ(_cx, _cy, _rr))
    _b16.append(dot(_cx, _cy, TX, 2.4))
    if _lab:
        _b16.append(t(_cx, _cy + 5, _lab, TX, 14))
        _tx, _ty = _cx - _rr * _uy, _cy - _rr * _ux     # 上の辺との接点
        _b16.append(ln(_cx, _cy, _tx, _ty, LINE, 1.6))
        _p1 = (_tx + 7 * _ux, _ty - 7 * _uy)
        _p2 = (_p1[0] + 7 * _uy, _p1[1] + 7 * _ux)
        _p3 = (_tx + 7 * _uy, _ty + 7 * _ux)
        _b16.append('<polyline points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="none"'
                    ' stroke="%s" stroke-width="1.4"/>'
                    % (_p1[0], _p1[1], _p2[0], _p2[1], _p3[0], _p3[1], GRAY))
FIGS["HG-3701"] = svg("0 0 500 292", "".join([
    ln(_O16[0], _O16[1], _O16[0] + 375 * _ux, _O16[1] - 375 * _uy),
    ln(_O16[0], _O16[1], _O16[0] + 375 * _ux, _O16[1] + 375 * _uy),
    ln(_O16[0], _O16[1], 465, _O16[1], GRAY, 1.4, "6 5"),
] + _b16 + [
    ln(_O16[0], _O16[1], _O16[0], 199, GRAY, 1, "4 4"),
    ln(_O16[0] + 3 * _k16, _O16[1], _O16[0] + 3 * _k16, 199, GRAY, 1, "4 4"),
    dim(_O16[0], 186, _O16[0] + 3 * _k16, 186, "3cm", 9, 1),
    t(16, 150, "O", TX, 14, "end"),
    ln(53, 166, 58, 156, GRAY, 1.2),
    t(50, 174, "A", TX, 14, "end"),
    t(255, 282, "円Aの半径は1cm。となり合う2つの円は外側で接している", GRAY, 11),
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
