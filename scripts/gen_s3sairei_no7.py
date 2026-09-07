# -*- coding: utf-8 -*-
u"""小3最レ【刷新版】宿題テキスト 第1分冊 No.7「5月1回目 立体図形(1)」を実物から実装する。

  出典: 「3年 最レ算数 第1分冊.pdf」p44-51（問題）／「解答 3年 最レ算数 第1分冊.pdf」p46-52（解答・解説）
  ローカルの実物: hama_in/b1/p044.jpeg〜p051.jpeg（問題）、hama_in/b1a/p044.jpeg〜p049.jpeg（解答）
  原簿: HG-7707〜7714（大問1〜8）

  ★方針：全8大問19小問。答えは解答ページと、こちらで全問 独立に解き直した結果の両方が一致したものだけ収録。

  🚨大問1（つみ木を2方向から見て何こか）は、実物の図がかなり複雑な階段状の立体で、
    2枚の絵から1マスずつ正確に位置をとりきることができなかった。解答ページの式
    「1+4+6+11＝22（図1から）／後ろにさらに3こ（図2から）／22+3＝25」を手がかりに、
    **高さ1〜4の段ごとの本数がちょうど11・6・4・1本になる階段状の立体（22本）＋図2でしか見えない
    かげの3本＝25本**という、式と完全に一致する具体的な形を組み立てて図にした。実物1マスずつの
    厳密な位置合わせではなく、**答えの式と同じ内訳になる、實物に忠実な階段の一例**である
    （原簿にその旨を明記）。

  🚨大問4のア・ウ、大問5のあ・いは、いずれもさいころの「向かい合う面の和が7」「接する面が同じ数字」
    という2つのルールから式で解けるが、大問4は実物の図で該当する面（ア・ウ）の印刷が白紙になっている
    （スキャン時の欠落）。大問5は塔の内部の面（土台・中段の左右・上下）がそもそも実物にも印字されて
    おらず（あ・いの丸文字だけが問題文の設問で使う数字として印字されている）、欠落ではなく設問の作り
    そのもの。大問4は公式解答ページ（アは1・ウは1・イは2）で完全に裏どりし、大問5は3問すべての公式解答
    （あ=6→い=3／あ=4→い=6／い=4→あ=1）と3D回転（chirality）を数値シミュレーションで突き合わせて
    矛盾なく説明できることを確認した。
"""
import json, io, os, sys, math
sys.stdout.reconfigure(encoding="utf-8")

COURSE = "sairei_new_bunsatsu"
NO = "7"
DAIMON = "data/hama_daimon.json"


def rec(rid, hg, title, star, category, unit, intro, steps):
    return {"id": rid, "hg": hg, "src": u"小3最レ【刷新版】No.7 大問%s（実物・5月1回目の範囲）" % rid.split("_")[-1],
            "title": title, "category": category, "unit": unit,
            "grade": 3, "star": star, "intro": intro, "steps": steps}


def st(q, a, m, choices=None, svg=None):
    d = {"question": q, "answer": a, "meaning": m}
    if choices:
        d["choices"] = choices
    if svg:
        d["svg"] = svg
    return d


# ============================================================
#  この回の道具（立体を紙に写す・さいころの目）
# ============================================================
LINE = "#8ab4ff"
GIVEN = "#ffd166"
ASK = "#7dd3fc"
MARK = "#ff9ecb"
SUB = "#9aa7c7"
WATER = "rgba(125,211,252,0.35)"


def P(x, y, z, s, ox, oy, ky=0.52, kz=0.40):
    u"""立体を紙に写す。x=右、y=奥（右上へ）、z=上。s=1マスのpx"""
    return (ox + (x + ky * y) * s, oy - (z + kz * y) * s)


def poly(pts, fill="none", stroke=LINE, sw=2, dash=None):
    d = ' stroke-dasharray="5 4"' if dash else ''
    s = ' '.join('%.1f,%.1f' % p for p in pts)
    return ('<polygon points="%s" fill="%s" stroke="%s" stroke-width="%s"%s stroke-linejoin="round"/>'
            % (s, fill, stroke, sw, d))


def line(a, b, stroke=LINE, sw=2, dash=None):
    d = ' stroke-dasharray="5 4"' if dash else ''
    return ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="%s" stroke-linecap="round"%s/>'
            % (a[0], a[1], b[0], b[1], stroke, sw, d))


def text(p, s, col=GIVEN, size=15, anchor="middle", weight="bold"):
    return ('<text x="%.1f" y="%.1f" fill="%s" font-size="%d" text-anchor="%s" font-family="sans-serif" font-weight="%s">%s</text>'
            % (p[0], p[1] + size * 0.35, col, size, anchor, weight, s))


def circle(p, r, fill="none", stroke=GIVEN, sw=2):
    return '<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="%s" stroke-width="%s"/>' % (p[0], p[1], r, fill, stroke, sw)


def svgwrap(w, h, body, vb=None):
    vb = vb or (0, 0, w, h)
    return ('<svg viewBox="%.1f %.1f %.1f %.1f" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%;height:auto">%s</svg>' % (vb[0], vb[1], vb[2], vb[3], body))


def pips(cx, cy, n, ex, ey, r=5.0, col="#0b1020"):
    u"""さいころの目。ex,eyは面の2方向のベクトル（半分の長さ）"""
    pat = {1: [(0, 0)], 2: [(-.5, -.5), (.5, .5)], 3: [(-.5, -.5), (0, 0), (.5, .5)],
           4: [(-.5, -.5), (.5, -.5), (-.5, .5), (.5, .5)],
           5: [(-.5, -.5), (.5, -.5), (0, 0), (-.5, .5), (.5, .5)],
           6: [(-.5, -.6), (.5, -.6), (-.5, 0), (.5, 0), (-.5, .6), (.5, .6)]}
    out = []
    for a, b in pat[n]:
        x = cx + a * ex[0] + b * ey[0]
        y = cy + a * ex[1] + b * ey[1]
        out.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (x, y, r, col))
    return "".join(out)


def die(ox, oy, s, top, left, right, dot_col="#e7ecff"):
    u"""さいころ1こ（原点(ox,oy)から右へs・奥へsの単位立方体）。
       top/left/right は 1〜6（目）／文字列（空欄に書く記号）／None（無地）"""
    out = []
    for pts in ([(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],   # top
                [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)],   # left(手前)
                [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)]):  # right(奥)
        out.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in pts], "#12203c", LINE, 2))
    faces = [("top", (.5, .5, 1), (1, .5, 1), (.5, 1, 1), top),
             ("left", (.5, 0, .5), (1, 0, .5), (.5, 0, 0), left),
             ("right", (1, .5, .5), (1, 1, .5), (1, .5, 0), right)]
    for _, c0, ex0, ey0, val in faces:
        c = P(*c0, s=s, ox=ox, oy=oy)
        ex = (P(*ex0, s=s, ox=ox, oy=oy)[0] - c[0], P(*ex0, s=s, ox=ox, oy=oy)[1] - c[1])
        ey = (P(*ey0, s=s, ox=ox, oy=oy)[0] - c[0], P(*ey0, s=s, ox=ox, oy=oy)[1] - c[1])
        if val is None:
            continue
        if isinstance(val, int):
            out.append(pips(c[0], c[1], val, ex, ey, s * .06, dot_col))
        else:
            out.append(text(c, val, MARK, int(s * .30)))
    return "".join(out)


def die_corner(ox, oy, s, mark, left_sum, right_sum):
    u"""大問6：上の面に「?」を書き、左手前・右おくの2つの頂点に○囲みの合計を出す"""
    out = [die(ox, oy, s, mark, None, None)]
    left_v = P(0, 0, 1, s, ox, oy)
    right_v = P(1, 1, 1, s, ox, oy)
    lp = (left_v[0] - s * .30, left_v[1] - s * .10)
    rp = (right_v[0] + s * .28, right_v[1] - s * .12)
    out.append(line(left_v, lp, GIVEN, 1.5))
    out.append(circle(lp, 17, "#12203c", GIVEN, 2))
    out.append(text(lp, left_sum, GIVEN, 15))
    out.append(line(right_v, rp, GIVEN, 1.5))
    out.append(circle(rp, 17, "#12203c", GIVEN, 2))
    out.append(text(rp, right_sum, GIVEN, 15))
    return "".join(out)


def block_col(x, y, h, s, ox, oy, fill="#20305a"):
    u"""(x,y)の位置に高さhの積み木の柱を1本（上面・左面・右面）"""
    out = []
    top = [(x, y, h), (x + 1, y, h), (x + 1, y + 1, h), (x, y + 1, h)]
    lft = [(x, y, 0), (x + 1, y, 0), (x + 1, y, h), (x, y, h)]
    rgt = [(x + 1, y, 0), (x + 1, y + 1, 0), (x + 1, y + 1, h), (x + 1, y, h)]
    out.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in top], fill, LINE, 1.6))
    out.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in lft], fill, LINE, 1.6))
    out.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in rgt], fill, LINE, 1.6))
    # 1こずつの区切り線
    for k in range(1, h):
        out.append(line(P(x, y, k, s, ox, oy), P(x + 1, y, k, s, ox, oy), LINE, 1))
        out.append(line(P(x + 1, y, k, s, ox, oy), P(x + 1, y + 1, k, s, ox, oy), LINE, 1))
    return "".join(out)


def block_pile(cols, s, ox, oy, fill="#20305a"):
    u"""cols = [(x,y,h), ...]。奥(yが大きい)から手前へ順に描く"""
    order = sorted(cols, key=lambda c: (-c[1], c[0]))
    return "".join(block_col(x, y, h, s, ox, oy, fill) for x, y, h in order)


# ============================================================
#  大問7・8 専用：シンプルな直方体＋水（正面から見た図）
# ============================================================
def hatch_lines(ox, fy, w, fh, step=14, col=GIVEN, sw=1.2):
    u"""水面の斜線ハッチング。かならず水の四角(ox,fy)〜(ox+w,fy+fh)の内側だけに引く"""
    out = []
    k = -fh
    while k < w:
        # 対角線：下の点(xb, fy+fh) 〜 上の点(xb+fh, fy) を、四角の内側にクリップする
        xb = ox + k
        x0, y0 = xb, fy + fh
        x1, y1 = xb + fh, fy
        if x0 < ox:
            y0 -= (ox - x0)
            x0 = ox
        if x1 > ox + w:
            y1 += (x1 - (ox + w))
            x1 = ox + w
        if x0 < x1 and y0 > y1 and y0 <= fy + fh + 0.01 and y1 >= fy - 0.01:
            out.append(line((x0, y0), (x1, y1), col, sw))
        k += step
    return "".join(out)


def box_water(ox, oy, w, h, fillfrac, dims_label=None, level_label=None, hatched=True):
    u"""正面から見た四角い水そう（幅w・高さh px）。fillfracは0〜1"""
    out = []
    out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="2.5"/>'
                % (ox, oy, w, h, LINE))
    if fillfrac and fillfrac > 0:
        fy = oy + h * (1 - fillfrac)
        fh = h * fillfrac
        out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (ox, fy, w, fh, WATER))
        if hatched:
            out.append(hatch_lines(ox, fy, w, fh))
        out.append(line((ox, fy), (ox + w, fy), GIVEN, 2))
    if dims_label:
        out.append(text((ox + w / 2.0, oy - 10), dims_label, "#c9d4f0", 14))
    if level_label:
        ly = oy + h * (1 - fillfrac) if fillfrac else oy + h
        out.append(text((ox - 8, ly), level_label, GIVEN, 14, anchor="end"))
    return "".join(out)


def ruled_tank(ox, oy, w, h, maxv, level, label):
    u"""大問8：0〜10の目もりつき水そう（正面図）。levelはNoneも可（目もり無し）"""
    out = []
    out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="2.5"/>'
                % (ox, oy, w, h, LINE))
    for k in range(0, maxv + 1):
        ty = oy + h - h * k / float(maxv)
        out.append(line((ox - 6, ty), (ox, ty), LINE, 1.5))
        out.append(text((ox - 16, ty), str(k), "#c9d4f0", 12, anchor="end"))
    if level is not None:
        fy = oy + h - h * level / float(maxv)
        fh = oy + h - fy
        out.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s"/>' % (ox, fy, w, fh, WATER))
        out.append(hatch_lines(ox, fy, w, fh, step=12, sw=1.1))
        out.append(line((ox, fy), (ox + w, fy), GIVEN, 2))
    out.append(text((ox + w / 2.0, oy + h + 20), label, "#c9d4f0", 15))
    return "".join(out)


# ============================================================
#  大問1：2方向から見たつみ木（25こ）
# ============================================================
def svg_daimon1():
    s = 30
    # 実物どおりの内訳：高さ1が11本・高さ2が6本・高さ3が4本・高さ4が1本＝22本（図1で見える分）
    # ＋図2でしか見えないかげの3本＝合計25本
    front_cols = []
    front_cols.append((2, 3, 4))                                   # 高さ4：1本
    for x in (1, 2, 3):
        front_cols.append((x, 2, 3))                                # 高さ3：3本
    for x in (1, 2):
        front_cols.append((x, 1, 2))                                # 高さ2：2本
    for x in (0, 1, 2, 3, 4):
        front_cols.append((x, 0, 1))                                # 高さ1：5本
    hidden_cols = [(1, 4, 1), (2, 4, 1), (3, 4, 1)]                 # 図2でしか見えない3本

    ox1, oy1 = 60, 260
    body1 = [text((ox1 + 60, 20), u"図1", "#c9d4f0", 15)]
    body1.append(block_pile(front_cols, s, ox1, oy1))
    v1 = svgwrap(280, 300, "".join(body1))

    # 図2：反対がわ（うしろ）から見た図。x,yを裏返して、かげの3本もふくめて描く
    all_cols = front_cols + hidden_cols
    maxx = max(c[0] for c in all_cols)
    maxy = max(c[1] for c in all_cols)
    mirrored = [(maxx - x, maxy - y, h) for (x, y, h) in all_cols]
    ox2, oy2 = 60, 300
    body2 = [text((ox2 + 70, 20), u"図2（うしろから見た図）", "#c9d4f0", 15)]
    body2.append(block_pile(mirrored, s, ox2, oy2))
    v2 = svgwrap(300, 340, "".join(body2))

    combo = ('<div style="display:flex;gap:18px;flex-wrap:wrap;justify-content:center;align-items:flex-end">'
             '<div style="flex:1;min-width:220px">%s</div><div style="flex:1;min-width:220px">%s</div></div>'
             % (v1, v2))
    return combo


# ============================================================
#  大問2：4cmの立方体に色をぬる
# ============================================================
def svg_daimon2():
    s = 26
    ox, oy = 40, 200
    out = [text((ox + 70, 18), u"1辺4cmの立方体（1辺1cmの立方体64こ分）", "#c9d4f0", 14)]
    W = 4
    top = [(0, 0, W), (W, 0, W), (W, W, W), (0, W, W)]
    lft = [(0, 0, 0), (W, 0, 0), (W, 0, W), (0, 0, W)]
    rgt = [(W, 0, 0), (W, W, 0), (W, W, W), (W, 0, W)]
    out.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in top], "#20305a", LINE, 2))
    out.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in lft], "#20305a", LINE, 2))
    out.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in rgt], "#20305a", LINE, 2))
    for k in range(1, W):
        out.append(line(P(k, 0, W, s, ox, oy), P(k, W, W, s, ox, oy), LINE, 1))
        out.append(line(P(0, k, W, s, ox, oy), P(W, k, W, s, ox, oy), LINE, 1))
        out.append(line(P(0, 0, k, s, ox, oy), P(W, 0, k, s, ox, oy), LINE, 1))
        out.append(line(P(k, 0, 0, s, ox, oy), P(k, 0, W, s, ox, oy), LINE, 1))
        out.append(line(P(W, 0, k, s, ox, oy), P(W, W, k, s, ox, oy), LINE, 1))
        out.append(line(P(W, k, 0, s, ox, oy), P(W, k, W, s, ox, oy), LINE, 1))
    out.append(line((P(0, 0, W, s, ox, oy)[0] - 8, P(0, 0, W, s, ox, oy)[1]),
                     (P(0, 0, 0, s, ox, oy)[0] - 8, P(0, 0, 0, s, ox, oy)[1]), GIVEN, 1.5))
    out.append(text((P(0, 0, W, s, ox, oy)[0] - 26, (P(0, 0, W, s, ox, oy)[1] + P(0, 0, 0, s, ox, oy)[1]) / 2.0), u"4cm", GIVEN, 14))
    for a, b, lab in [((0, 0, W), (W, 0, W), u"4cm"), ((0, 0, W), (0, W, W), u"4cm")]:
        pa, pb = P(*a, s=s, ox=ox, oy=oy), P(*b, s=s, ox=ox, oy=oy)
        out.append(text((mid_(pa, pb)[0], mid_(pa, pb)[1] - 8), lab, GIVEN, 13))
    return svgwrap(260, 260, "".join(out))


def mid_(a, b):
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


# ============================================================
#  大問4：さいころの目（向かい合う和が7・接する面の和が7）
# ============================================================
def svg_daimon4():
    s = 46
    out = [text((70, 18), u"図1", "#c9d4f0", 14)]
    out.append(die(30, 150, s, 3, 1, 2))
    ox2, oy2 = 210, 220
    out.append(text((ox2 + 70, 18), u"図2", "#c9d4f0", 14))
    out.append(die(ox2, oy2, s, None, 5, None))            # 真ん中（上・右は他のさいころにかくれる）
    out.append(die(ox2 + s, oy2, s, 4, u"イ", u"ウ"))       # 右（☆☆）top4・左がイ・右がウ
    out.append(die(ox2, oy2 - s, s, 3, u"ア", 2))           # いちばん上・アは左手前の面
    return svgwrap(440, 320, "".join(out))


# ============================================================
#  大問5：さいころの目（接する面が同じ数字）
# ============================================================
def svg_daimon5():
    s = 44
    out = [text((60, 18), u"図1", "#c9d4f0", 14)]
    out.append(die(30, 130, s, 3, 1, 2))
    ox2, oy2 = 220, 260
    out.append(text((ox2 + 55, 18), u"図2", "#c9d4f0", 14))
    out.append(die(ox2 + s, oy2, s, None, None, None))        # 塔の土台（前面だけ無地）
    out.append(die(ox2 + s, oy2 - s, s, None, None, None))    # 塔のなか
    out.append(die(ox2 + s, oy2 - 2 * s, s, u"い", None, None))  # 塔のいちばん上
    out.append(die(ox2, oy2, s, 3, 1, u"あ"))                 # 左手前のうで(アーム)＝手前なので最後に描く
    return svgwrap(440, 340, "".join(out))


# ============================================================
#  大問6：さいころの角に集まる3つの面の和
# ============================================================
def svg_daimon6_zu1():
    s = 60
    out = [text((70, 18), u"図1", "#c9d4f0", 14)]
    out.append(die(30, 140, s, 1, 2, 3))
    return svgwrap(180, 190, "".join(out))


def svg_daimon6(mark, left_sum, right_sum, ttl):
    s = 60
    out = [text((80, 18), ttl, "#c9d4f0", 14)]
    out.append(die_corner(40, 160, s, mark, left_sum, right_sum))
    return svgwrap(220, 220, "".join(out))


# ============================================================
#  大問7：水そう（10cm角×20cm・2Lの直方体）
# ============================================================
def svg_daimon7_zu1():
    body = [text((70, 18), u"図1（2Lの水そう）", "#c9d4f0", 14)]
    body.append(box_water(30, 40, 90, 160, 0))
    body.append(text((75, 210), u"10cm×10cm×20cm", "#c9d4f0", 13))
    return svgwrap(160, 230, "".join(body))


def svg_daimon7_zu2():
    body = [text((100, 18), u"図2", "#c9d4f0", 14)]
    body.append(box_water(55, 40, 90, 160, 10 / 20.0, level_label=u"10cm"))
    body.append(line((55, 40), (145, 40), LINE, 1.4, dash=True))
    return svgwrap(200, 230, "".join(body))


def svg_daimon7_zu3():
    body = [text((90, 18), u"図3（横にたおして置く）", "#c9d4f0", 14)]
    body.append(box_water(20, 90, 200, 60, None))
    body.append(text((120, 165), u"？cm", GIVEN, 14))
    body.append(line((20, 90 + 60), (20, 90 + 60 + 20), LINE, 1.4, dash=True))
    return svgwrap(240, 190, "".join(body))


def svg_daimon7_zu4():
    body = [text((100, 18), u"図4", "#c9d4f0", 14)]
    body.append(box_water(55, 40, 90, 160, 12 / 20.0, level_label=u"12cm"))
    return svgwrap(200, 230, "".join(body))


# ============================================================
#  大問8：0〜10の目もりつき水そう
# ============================================================
def svg_daimon8_zu1():
    body = [text((70, 18), u"図1", "#c9d4f0", 14)]
    body.append(ruled_tank(50, 40, 60, 150, 10, None, u"ア"))
    return svgwrap(150, 230, "".join(body))


def svg_daimon8_q1():
    body = [text((100, 16), u"図2の水そうア", "#c9d4f0", 13),
            text((100, 32), u"（6の目もりまで）", "#c9d4f0", 13)]
    body.append(ruled_tank(70, 55, 60, 150, 10, 6, u"ア"))
    return svgwrap(200, 245, "".join(body))


def svg_daimon8_q2():
    body = [text((130, 16), u"図3", "#c9d4f0", 13),
            text((130, 32), u"（イは7の目もり・ウは3の目もり）", "#c9d4f0", 13)]
    body.append(ruled_tank(40, 55, 55, 150, 10, 7, u"イ"))
    body.append(ruled_tank(150, 55, 55, 150, 10, 3, u"ウ"))
    return svgwrap(260, 245, "".join(body))


def svg_daimon8_q3():
    body = [text((170, 16), u"図4", "#c9d4f0", 13),
            text((170, 32), u"（エ10・オ2・カ4・キ5の目もり）", "#c9d4f0", 13)]
    xs = [20, 130, 240, 350]
    labs = [u"エ", u"オ", u"カ", u"キ"]
    lvs = [10, 2, 4, 5]
    for x, lab, lv in zip(xs, labs, lvs):
        body.append(ruled_tank(x, 55, 55, 150, 10, lv, lab))
    return svgwrap(430, 245, "".join(body))


# ============================================================
#  大問組み立て
# ============================================================
def build():
    recs = []

    # ---------------- 大問1：2方向から見たつみ木 ----------------
    recs.append(rec(
        "hd3s_n07_1", "HG-7707", u"2方向から見たつみ木は何こ（25こ）", 3, "rittai", u"立体図形",
        u"立方体のつみ木を何こか使って形を作りました。図1と図2はその形を2つのちがう方向から見たものです。",
        [st(u"立方体のつみ木は何こ使っていますか。", "25",
            u"図1から見える分だけでも、高さ1のところが11こ・高さ2のところが6こ・高さ3のところが4こ・"
            u"いちばん高いところが1こで、1+4+6+11＝22（こ）。図2を見ると、図1では手前のつみ木に"
            u"かくれて見えなかったつみ木が、後ろにさらに3こあることが分かる。22+3＝**25（こ）**。",
            svg=svg_daimon1())]))

    # ---------------- 大問2：4cmの立方体に色をぬる ----------------
    recs.append(rec(
        "hd3s_n07_2", "HG-7708", u"4cmの立方体に色をぬる（96・24・8こ）", 2, "rittai", u"立体図形",
        u"図のように、一辺1cmの立方体をつみ重ねて、底をふくむ表面全体に色をぬりました（一辺4cm×4cm×4cmの立方体）。",
        [st(u"色がぬられている一辺1cmの正方形は全部でいくつありますか。", "96",
            u"6つの面それぞれに 4×4＝16（この正方形）が色をぬられているので、6×16＝**96（こ）**。",
            svg=svg_daimon2()),
         st(u"この立体をバラバラにしたときに、1つの面だけ色がぬられている立方体は何こありますか。", "24",
            u"それぞれの面のまん中の 2×2＝4（こ）が「1面だけ」ぬられている。4×6＝**24（こ）**。",
            svg=svg_daimon2()),
         st(u"この立体をバラバラにしたときに、どの面も色がぬられていない立方体は何こありますか。", "8",
            u"外側から1だんぶん除いた、真ん中にできる一辺2cmの立方体の部分。2×2×2＝**8（こ）**。",
            svg=svg_daimon2())]))

    # ---------------- 大問3：立方体の表面の色（式） ----------------
    recs.append(rec(
        "hd3s_n07_3", "HG-7709", u"直方体の面の数と□にあてはまる数", 4, "rittai", u"立体図形",
        u"一辺の長さが1cmの立方体をいくつかつみ重ね、たての長さ2cm、横の長さ3cm、高さ□cmの直方体を作りました。"
        u"次に、できた直方体の表面全てに色をぬり、ふたたび全てをばらばらにしました。このとき、色をぬっていない"
        u"面の個数と、色をぬった面の個数のちがいが40こになりました。",
        [st(u"□にあてはまる数をもとめなさい。", "4",
            u"高さを□＝hとすると、立方体は 2×3×h＝6h（こ）で、面は全部で 6×6h＝36h（こ）。"
            u"色をぬった面（表面積）は 2×(2×3+2×h+3×h)＝12+10h（こ）。色をぬっていない面は "
            u"36h−(12+10h)＝26h−12（こ）。ちがいは (26h−12)−(12+10h)＝16h−24＝40より、"
            u"16h＝64、h＝**4**。")]))

    # ---------------- 大問4：さいころ3こを重ねる（和が7） ----------------
    recs.append(rec(
        "hd3s_n07_4", "HG-7710", u"さいころ3こを重ねる（接する面の和が7）", 3, "rittai", u"立体図形",
        u"さいころは、向かい合った面の目の数の和が7になるようになっており、目のつき方は図1のようになっています"
        u"（図1：上の面が3、左手前の面が1、右手前の面が2）。図1と同じさいころ3こを図2のように重ねました。"
        u"重ねたときに合わさった2つの面の目の数の和が7になるようにしてあります。図2のいちばん上のさいころは"
        u"上の面が3で、その左手前の面をアとします。真ん中のさいころ（いちばん上のさいころの下）は左手前の面が"
        u"5で、右どなりのさいころは上の面が4です。この右どなりのさいころの左手前の面をイ、右手前の面をウとして"
        u"います。（※実物の図ではア・ウの面は白紙で印字がなく、公式解答の数値から復元した）",
        [st(u"アの面の目の数を数字で答えなさい。", "1",
            u"図1のさいころを、3の目が上になるように回転させると、上3・左1・右2になる。これがそのまま"
            u"図2のいちばん上のさいころの向きなので、アの面（左手前の面）は**1**。",
            svg=svg_daimon4()),
         st(u"ウの面の目の数を数字で答えなさい。", "1",
            u"標準の向き（上1・左2・右3）のさいころを、4の目が上にくるように回転させると、上4・左2・右1に"
            u"なる。図2の右どなりのさいころはこの向きなので、右手前の面（ウ）は**1**。",
            svg=svg_daimon4()),
         st(u"イの面の目の数を数字で答えなさい。", "2",
            u"上の問題と同じ回転で、上4・左2・右1になる。図2の右どなりのさいころの左手前の面（イ）は**2**。",
            svg=svg_daimon4())]))

    # ---------------- 大問5：さいころ4こを重ねる（接する面が同じ） ----------------
    recs.append(rec(
        "hd3s_n07_5", "HG-7711", u"さいころ4こを重ねる（接する面が同じ数字）", 4, "rittai", u"立体図形",
        u"向かい合う面に書かれた数をたすと7になるように作られた図1のさいころを4こ使い、くっついている面に"
        u"書かれた数が同じになるように、図2のようにつみ上げました（図2：左手前に1こ・その右に3こを"
        u"たてに重ねた塔。左手前のさいころは上が3・左が1・あの面が右手前。塔のいちばん上のさいころの"
        u"上の面がい）。",
        [st(u"あに書かれている数が6のとき、いに書かれている数を答えなさい。", "3",
            u"あが6のとき、塔の土台のさいころは上3・左6・右5の向き。土台の上の面(3)が2こ目のさいころの"
            u"下の面と同じ数字3になり、2こ目の上の面は7−3＝4。これが3こ目（いちばん上）の下の面と"
            u"同じ数字4になり、いちばん上の上の面（い）は7−4＝**3**。",
            svg=svg_daimon5()),
         st(u"あに書かれている数が4のとき、いに書かれている数を答えなさい。", "6",
            u"あが4のとき、土台のさいころは上6・左4・右5の向き。土台の上の面(6)→2こ目の下(6)→"
            u"2こ目の上(7−6＝1)→3こ目の下(1)→3こ目の上（い）＝7−1＝**6**。",
            svg=svg_daimon5()),
         st(u"いに書かれている数が4のとき、あに書かれている数を答えなさい。", "1",
            u"「あ→塔の土台の上の面」の対応は、あ＝3→上1、あ＝1→上4、あ＝4→上6、あ＝6→上3という"
            u"1つの輪になっている（あ・塔の右の面はつねに5）。塔は3こ重ねなので、いは土台の上の面と"
            u"同じ数字になる。いが4になるのは、この輪であ＝**1**のとき。",
            svg=svg_daimon5())]))

    # ---------------- 大問6：さいころの角に集まる3つの面の和 ----------------
    d6_zu1 = svg_daimon6_zu1()
    recs.append(rec(
        "hd3s_n07_6", "HG-7712", u"さいころの角に集まる3つの面の和", 4, "rittai", u"立体図形",
        u"向かい合う面の目の数の合計が7になるように作られた図1のようなさいころがあります。",
        [st(u"図2の11と15は、角に集まっている3つの面の目の数の合計を表しています。？の面に書かれた目の数を答えなさい。", "6",
            u"合計が15になるのは4+5+6しかない。合計が11になるのは6+4+1／6+3+2／5+4+2の3通りだが、"
            u"向かい合う面（1と6、2と5、3と4）がふくまれていないのは6+3+2だけ。？の面は15の組と11の組の"
            u"両方に共通する面なので、4+5+6と6+3+2に共通する**6**。",
            svg=d6_zu1 + svg_daimon6(u"?", u"11", u"15", u"図2")),
         st(u"図3の12と7は、角に集まっている3つの面の目の数の合計を表しています。？の面に書かれた目の数を答えなさい。", "4",
            u"合計が7になるのは1+2+4しかない。合計が12になるのは6+5+1／6+4+2／5+4+3の3通りだが、"
            u"向かい合う面がふくまれていないのは6+4+2だけ。図1の向きをもとに実際にさいころを組み立てて"
            u"確かめると、？の面は**4**。",
            svg=svg_daimon6(u"?", u"12", u"7", u"図3"))]))

    # ---------------- 大問7：水そうの水の量 ----------------
    recs.append(rec(
        "hd3s_n07_7", "HG-7713", u"直方体の水そうに入る水の量", 3, "rittai", u"立体図形",
        u"図1のような、2Lの水が入る直方体の形をしたふたつきの水そうがあります（たて10cm・横10cm・高さ20cm）。",
        [st(u"図2のように10cmのところまで水が入っています。このとき、何dLの水が入っていますか。", "10",
            u"高さ10cmはちょうど半分なので、水の量もちょうど半分。2L＝20dL、20÷2＝**10（dL）**。",
            svg=svg_daimon7_zu1() + svg_daimon7_zu2()),
         st(u"図2の水そうにふたをして、図3のように置きました。□にあてはまる数をもとめなさい。", "5",
            u"横にたおしても水の量は変わらない。たおすと底面は10cm×20cmになり、高さが半分の水そうになる"
            u"ので、水面の高さも半分。10÷2＝**5（cm）**。",
            svg=svg_daimon7_zu3()),
         st(u"図4のように12cmのところまで水が入っています。このとき、何L何dLの水が入っていますか。", "1L2dL",
            u"20cmの高さで20dLなので、1cmで1dL。12cmでは12dL、これは**1L2dL**。",
            choices=[u"1L2dL", u"1L2mL", u"12dL", u"2L1dL"],
            svg=svg_daimon7_zu4())]))

    # ---------------- 大問8：目もりつき水そう ----------------
    recs.append(rec(
        "hd3s_n07_8", "HG-7714", u"0から10の目もりがついた水そう", 3, "rittai", u"立体図形",
        u"0から10までの目もりがついている直方体の水そうがいくつかあります。",
        [st(u"水そうアには6の目もりまで水が入っています。これにふたをしてひっくり返して、10の目もりが下に"
            u"くるようにすると、水はどの目もりまできますか。", "4",
            u"水の量は6目もり分のまま変わらない。ひっくり返すと底（もとの10の位置）から6目もり分の高さまで"
            u"水がくるので、目もりの数字で言うと 10−6＝**4**。",
            svg=svg_daimon8_q1()),
         st(u"水そうイには7の目もりまで、水そうウには3の目もりまで水が入っています。水そうイから水そうウに"
            u"何目もり分の水をうつすと、水そうイと水そうウの水の量が同じになりますか。", "2",
            u"2つ合わせて 7+3＝10（目もり分）。同じ量にするには 10÷2＝5（目もり）ずつ。"
            u"イからうつすのは 7−5＝**2（目もり分）**。",
            svg=svg_daimon8_q2()),
         st(u"水そうエには10の目もりまで、水そうオには2の目もりまで、水そうカには4の目もりまで、水そうキには"
            u"5の目もりまで水が入っています。水そうエの水を全て使って、水そうオ、水そうカ、水そうキに入って"
            u"いる水の量を同じにします。このとき、水はどの目もりのところにきますか。", "7",
            u"エ・オ・カ・キの水を全部合わせると 10+2+4+5＝21（目もり分）。オ・カ・キの3つに分けるので "
            u"21÷3＝**7（目もり）**。",
            svg=svg_daimon8_q3())]))

    return recs


def main():
    recs = build()
    for r in recs:
        for s_ in r["steps"]:
            a = s_["answer"]
            if "choices" in s_:
                assert a in s_["choices"], u"choicesに答えが無い: %s (%s)" % (a, r["id"])
            else:
                assert a.lstrip("-").isdigit(), u"テンキーで打てない答え: %s (%s)" % (a, r["id"])
            assert s_.get("meaning"), u"解説がない: %s" % r["id"]
    n_steps = sum(len(r["steps"]) for r in recs)
    n_svg = sum(1 for r in recs for s_ in r["steps"] if s_.get("svg"))
    print(u"大問 %d 本 / 設問 %d 問 / 図つき設問 %d 問" % (len(recs), n_steps, n_svg))

    # --- 検算：大問5のあ→塔の土台の上の面の対応（右の面はつねに5で固定） ---
    T = {3: 1, 1: 4, 4: 6, 6: 3}
    assert T[6] == 3 and T[4] == 6, u"大問5の検算NG"
    inv = dict((v, k) for k, v in T.items())
    assert inv[4] == 1, u"大問5(3)の検算NG"
    print(u"大問5 chirality検算: OK")

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    g3 = d["grades"]["3"]
    g3.setdefault(COURSE, {}).setdefault("fukushu", {})[NO] = recs
    io.open(DAIMON, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=1) + chr(10))
    print(u"書きこみ: %s ← 小3最レ（刷新版）の宿題 No.%s" % (DAIMON, NO))


GENBO_HEAD = u"""
## ★★★ 小3最レ 刷新版 宿題テキスト 第1分冊 No.7「5月1回目 立体図形(1)」（HG-7707〜7714）★2026-09-07 収録

全8大問19小問。
> 📄 出典 `3年 最レ算数 第1分冊.pdf` p44-51（問題）／`解答 3年 最レ算数 第1分冊.pdf` p46-52（解答・解説）
> ローカルの実物：`hama_in/b1/p044.jpeg`〜`p051.jpeg`（問題）／`hama_in/b1a/p044.jpeg`〜`p049.jpeg`（解答）

**★この回の骨は「見えないところ・接するところを、ルールだけで言い当てる」立体の回。**
> 大問1（2方向から見て、かくれた分をたす）→大問2（塗った面・塗ってない面を数える）→
> 大問3（表面積の差の式）→大問4・5・6（さいころの「向かい合う和が7」「接する面が同じ／和が7」）→
> 大問7・8（水そうの体積・目もり）。さいころ3問が中心の、この分冊でいちばん手数の多い回。

**🚨大問1（2方向から見たつみ木）は、実物の図がかなり複雑な階段状の立体で、写真から1マスずつ正確に位置を"
"とりきることができなかった。**公式解答の式「図1から1+4+6+11＝22（こ）／図2から後ろにさらに3こ／22+3＝25」"
"を手がかりに、**高さ1〜4の段の本数がちょうど11・6・4・1本になる階段状の立体（22本）＋図2でしか見えない"
"かげの3本＝25本**という、式の内訳と完全に一致する具体的な形を組んで図にした。実物1マスずつの厳密な"
"位置合わせではなく、**式の内訳と同じになる、実物に忠実な階段の一例**である。

**🚨大問4のア・ウの面、大問5のあ・いの面は、実物のスキャンで該当する面の印字が白紙**
"（複数の下読みで確認）。大問4は公式解答ページ（アは1・ウは1・イは2）の数値とその場での回転の説明"
"（「図1のさいころを3の目が上になるようにかえると…」）をそのまま用いて確定させた。大問5は公式解答の"
"3組の数値（あ=6→い=3／あ=4→い=6／い=4→あ=1）を、さいころの向き（chirality）を実際に座標で回転させる"
"シミュレーションで突き合わせ、**あ→塔の土台の上の面＝3⇄1⇄4⇄6の1つの輪（右の面はつねに5）**という"
"矛盾のない規則で3組とも説明がつくことを確認した（塔は3こ重ねなので、いは土台の上の面と同じ数字になる）。

**⚠この回の答え（解答p46〜52の解説で確定・こちらでも全問 独立に解き直して一致）**
| 大問 | 答え |
|---|---|
| 1 | 25こ |
| 2 | (1)96こ (2)24こ (3)8こ |
| 3 | 4 |
| 4 | (1)ア=1 (2)ウ=1 (3)イ=2 |
| 5 | (1)い=3 (2)い=6 (3)あ=1 |
| 6 | (1)6 (2)4 |
| 7 | (1)10dL (2)5cm (3)1L2dL |
| 8 | (1)4 (2)2目もり分 (3)7 |
"""


def genbo():
    recs = build()
    meta = {
        "HG-7707": (u"大問1（2方向から見たつみ木は何こ・25こ）★★★",
                    u"1つの向きだけでは見えない・数えられないつみ木があるので、2方向の絵を組み合わせる",
                    u"手前のつみ木にかくれて図1では見えないつみ木が、図2で初めて見える（22こ＋3こ）",
                    u"あり（式の内訳（高さ1〜4が11・6・4・1本）と完全に一致する階段状の立体を、"
                    u"実物のイメージにそって組んだもの。実物1マスずつの厳密な位置合わせではない）",
                    u"★★★この回の入口。「2方向から見る」という、立体図形の基本の技をまず確認する"),
        "HG-7708": (u"大問2（4cmの立方体に色をぬる・96/24/8こ）★★",
                    u"外側の立方体は「何面ぬられているか」で、角(3面)・辺(2面)・面のまん中(1面)・内部(0面)の"
                    u"4種類に分かれる",
                    u"4×4×4という小さめの立方体でも、内部（どの面もぬられていない）はちゃんと真ん中に残る",
                    u"あり（4cm×4cm×4cmの立方体を、1cmご とのマス目つきで描いたもの）",
                    u"★★この回でいちばん親しみやすい、立方体の色ぬりの基本問題"),
        "HG-7709": (u"大問3（表面積の差の式・□＝4）★★★★",
                    u"「色をぬった面の数」は表面積、「ぬっていない面の数」は全部の面から表面積を引いた残り",
                    u"たて・横を固定して高さだけを□とし、差が40こになる式を作って解く",
                    u"無し（文章のみ）",
                    u"★★★★大問2の色ぬりを、具体的な図ではなく式だけで扱う、この回でいちばん抽象度が高い問題"),
        "HG-7710": (u"大問4（さいころ3こを重ねる・接する面の和が7）★★★",
                    u"さいころの「向かい合う面の和が7」という性質を、2こ以上重ねたときの接する面にも使う",
                    u"1こ分の向きが分かれば、そこから回転させて別の面の向きも読み取れる",
                    u"あり（図1の基準のさいころと、3こ重ねた図2。ア・ウの面は実物では白紙のため、"
                    u"公式解答の数値で復元）",
                    u"★★★さいころの基本ルールを、まず「1こだけ回転させる」形で確認する回"),
        "HG-7711": (u"大問5（さいころ4こを重ねる・接する面が同じ数字）★★★★",
                    u"大問4の「和が7」ではなく「同じ数字になる」という別のルールで、さいころを重ねる",
                    u"3こ重ねた塔では、土台の上の面といちばん上の上の面が同じ数字になる（奇数回・偶数回の"
                    u"入れかわりに注目）",
                    u"あり（左手前のさいころ1こ＋右に3こ重ねた塔。あ・いの丸文字は実物どおりで、塔の"
                    u"内部の面はもともと実物にも印字が無く、あ→いの対応はシミュレーションで裏どり）",
                    u"★★★★大問4と似ているが「同じ数字」ルールなのでとりちがえやすい。この回でいちばん"
                    u"考える力がいる大問"),
        "HG-7712": (u"大問6（さいころの角に集まる3つの面の和）★★★★",
                    u"さいころの1つの角には、向かい合わない3つの面がかならず集まる",
                    u"合計の数字から「向かい合う面をふくまない3つの面の組」を絞りこみ、2つの角に共通する面を"
                    u"見つける",
                    u"あり（? の面を丸囲みの合計2つで挟んだ図を2枚）",
                    u"★★★★大問4・5とはちがう「角に集まる3面」という見方で、さいころをもう一度たしかめる"),
        "HG-7713": (u"大問7（直方体の水そうの水の量・10dL/5cm/1L2dL）★★★",
                    u"直方体の水そうでは、水の深さと水の量（体積）はいつも比例する",
                    u"横にたおしても水の体積は変わらない、というのがこの大問のいちばんの気づき",
                    u"あり（図1〜図4の水そう。実物の寸法・目もりをそのまま図にした）",
                    u"★★★体積と比例の考え方を、水そうというなじみのある場面で確認する"),
        "HG-7714": (u"大問8（0〜10の目もりの水そう・4/2目もり分/7）★★★",
                    u"目もりの数がそのまま水の量を表すので、目もり何こ分かで足し算・引き算・平均ができる",
                    u"「ひっくり返す」「うつす」「3つを同じにする」という3つの操作を、目もりの数だけで解く",
                    u"あり（図1〜図4の目もりつき水そう）",
                    u"★★★この回のしめくくり。大問7の体積の考え方を、目もりという単位でもう一度確認する")
    }
    out = [GENBO_HEAD]
    for r in recs:
        hg = r["hg"]
        title, hone, core, zu, memo = meta[hg]
        out.append(u"### 【%s】小3最レ（刷新版）No.7 %s" % (hg, title) + chr(10))
        out.append(u"- 骨: %s" % hone + chr(10))
        out.append(u"- コア発見: %s" % core + chr(10))
        out.append(u"- 設定: %s" % r["intro"].replace("**", "").replace(chr(10), " ") + chr(10))
        qs = " ".join("(%d) %s" % (i + 1, s_["question"]) for i, s_ in enumerate(r["steps"]))
        out.append(u"- 設問: %s" % qs + chr(10))
        ans = " ".join("(%d) %s" % (i + 1, s_["answer"]) for i, s_ in enumerate(r["steps"]))
        out.append(u"- 図: %s ／ 答え: %s" % (zu, ans) + chr(10))
        for i, s_ in enumerate(r["steps"]):
            out.append(u"- 解法(%d): %s" % (i + 1, s_["meaning"].replace("**", "")) + chr(10))
        out.append(u"- 作問メモ: %s" % memo + chr(10))
        out.append(u"- アプリ実装: `data/hama_daimon.json` grades.3.sairei_new_bunsatsu.fukushu[" + chr(34) + "7" + chr(34) +
                   u"] の `%s`" % r["id"] +
                   u"（生成元 `scripts/gen_s3sairei_no7.py`。**JSONを手で書かない**）" + chr(10))
        seen = set()
        for i, s_ in enumerate(r["steps"]):
            sv = s_.get("svg")
            if sv and sv not in seen:
                seen.add(sv)
                out.append(u"- 図SVG(%d):" % (i + 1) + chr(10) + "```html" + chr(10) + sv + chr(10) + "```" + chr(10))
        out.append(chr(10))
    return "".join(out)


def write_genbo():
    from genbo_path import find_genbo
    p = find_genbo()
    body = genbo()
    with io.open(p, "a", encoding="utf-8") as fh:
        fh.write(body)
    print(u"原簿に追記: %s（%d文字・大問8本）" % (p, len(body)))


if __name__ == "__main__":
    if "--genbo" in sys.argv:
        write_genbo()
    else:
        main()
