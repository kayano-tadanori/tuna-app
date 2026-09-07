# -*- coding: utf-8 -*-
u"""小3最レ【刷新版】宿題テキスト 第1分冊 No.8「5月2回目 立体図形(2)」を実物から実装する。

  出典: 「3年 最レ算数 第1分冊.pdf」p52-59（問題）／「解答 3年 最レ算数 第1分冊.pdf」p50-55（解答・解説）
  ローカルの実物: hama_in/b1/p052.jpeg〜p059.jpeg（問題）、hama_in/b1a/p050.jpeg〜p055.jpeg（解答）
  原簿: HG-7715〜7723（大問1〜9）

  ★方針：全9大問20小問。答えは解答ページと、こちらで全問 独立に解き直した結果の両方が一致したものだけ収録。

  🚨大問6は、5×5×5の立方体の「色をぬった部分」（くりぬく場所を示す面の印字）が実物のスキャンで
    完全に失われていた（真っ白）。公式解答ページが「上のだんから順に、くりぬかれたところ」を5だん分の
    5×5マスの図で示してくれているので、その5だん分の×印の位置を1マスずつそのまま原簿・アプリに写した
    （3+7+11+7+3＝31こをくりぬき、125−31＝94こ残る、を式・図の両方で検算ずみ）。実物の問題ページに
    あったはずの「色をぬった部分」の見た目そのものは復元できていない。

  🚨大問5は、真上から見た図（5×4の長方形、常に高さ1以上）と、正面・横から見た図（それぞれの方向の
    最大の高さ）から、立方体の個数の最大・最小をもとめる定番の問題。正面から見た高さ（5,4,3,4,1）と
    横から見た高さ（1,2,3,5）を実物のマス目から1マスずつ数え直して確認した。

  🚨🚨 塾講師監査で発覚：大問4(1)〜(4)・大問5(1)(2)の図が、公式解答が「解いたあとに」書きこんだ
    高さの数字入りマス目をそのまま設問の図として出してしまい、答えを見せてしまっていた（数値そのものは
    正しかった）。実物の設問には数字の無い、わく線だけの真上図・正面図（大問4）／真上・正面・横の
    3方向の輪郭だけの図（大問5）が載っているだけなので、**設問の図からは数字を全部外し、わくの形と
    階段の輪郭だけを示す**ように直した。数字を使った解き方はmeaning（解説）にそのまま書いてある。
"""
import json, io, os, sys, math
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_s3sairei_no7 import P, poly, line, text, circle, svgwrap, block_col, block_pile, die, hatch_lines

COURSE = "sairei_new_bunsatsu"
NO = "8"
DAIMON = "data/hama_daimon.json"

LINE = "#8ab4ff"
GIVEN = "#ffd166"
MARK = "#ff9ecb"


def rec(rid, hg, title, star, category, unit, intro, steps):
    return {"id": rid, "hg": hg, "src": u"小3最レ【刷新版】No.8 大問%s（実物・5月2回目の範囲）" % rid.split("_")[-1],
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
#  大問1：とうふを切る
# ============================================================
def box3d(w, d, h, s, ox, oy, labels=()):
    u"""直方体の外わく（w=横,d=たて奥行き,h=高さ）。labels=[(辺の中点,文字),...]"""
    out = []
    top = [(0, 0, h), (w, 0, h), (w, d, h), (0, d, h)]
    lft = [(0, 0, 0), (w, 0, 0), (w, 0, h), (0, 0, h)]
    rgt = [(w, 0, 0), (w, d, 0), (w, d, h), (w, 0, h)]
    out.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in top], "none", LINE, 2))
    out.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in lft], "none", LINE, 2))
    out.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in rgt], "none", LINE, 2))
    for p3, lab in labels:
        p = P(p3[0], p3[1], p3[2], s, ox, oy)
        out.append(text(p, lab, GIVEN, 14))
    return "".join(out)


def svg_daimon1(w, d, h, s=26):
    ky, kz = 0.52, 0.40
    margin = 50
    top_margin = 40
    ox, oy = margin, top_margin + (h + kz * d) * s
    body = [box3d(w, d, h, s, ox, oy, labels=[
        ((w / 2.0, 0, h), u"%gcm" % w), ((0, d / 2.0, h), u"%gcm" % d), ((w, 0, h / 2.0), u"%gcm" % h)])]
    cw = margin * 2 + (w + ky * d) * s
    ch = top_margin + (h + kz * d) * s + margin * 0.6
    return svgwrap(int(cw), int(ch), "".join(body))


# ============================================================
#  大問2：箱をつぶす（正方形の一辺＝□cm）
# ============================================================
def svg_daimon2_zu1():
    body = [text((130, 18), u"図1（ふたのない箱）", "#c9d4f0", 14)]
    body.append(box3d(9, 3, 2.2, 20, 30, 150, labels=[((9 / 2.0, 0, 2.2), u"32cm"), ((9, 0, 1.1), u"12cm")]))
    return svgwrap(280, 190, "".join(body))


def svg_daimon2_zu2():
    u"""図2：箱をつぶした形（32cmの帯に□cmの折り返しが上下につく八角形）。公式解答の図にそって、
       中央の長方形(12cm)の左右に□cmずつの折れこみがある形で示す"""
    s = 16.0
    ox, oy = 70, 90
    x0, x1, x2, x3 = 0, 1.6, 4.4, 6.0
    y0, y1 = 0, 4.0
    body = [text((ox + x3 * s / 2.0, 18), u"図2（□は高さ）", "#c9d4f0", 13)]
    outline = [(x0, y0), (x1, y0), (x1, -1.2), (x2, -1.2), (x2, y0), (x3, y0),
               (x3, y1), (x2, y1), (x2, y1 + 1.2), (x1, y1 + 1.2), (x1, y1), (x0, y1)]
    pts = [(ox + p[0] * s, oy + p[1] * s) for p in outline]
    body.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="2.2" stroke-linejoin="round"/>'
                % (" ".join("%.1f,%.1f" % p for p in pts), LINE))
    body.append(line((ox + x1 * s, oy), (ox + x1 * s, oy + y1 * s), LINE, 1.2, dash=True))
    body.append(line((ox + x2 * s, oy), (ox + x2 * s, oy + y1 * s), LINE, 1.2, dash=True))
    my = oy + y1 * s / 2.0
    body.append(text((ox + (x0 + x1) / 2 * s, my), u"□", GIVEN, 13))
    body.append(text((ox + (x1 + x2) / 2 * s, my), u"12", "#c9d4f0", 13))
    body.append(text((ox + (x2 + x3) / 2 * s, my), u"□", GIVEN, 13))
    body.append(text((ox + (x1 + x2) / 2 * s, oy - 0.6 * s), u"□", GIVEN, 12))
    body.append(text((ox + (x1 + x2) / 2 * s, oy + (y1 + 0.6) * s), u"□", GIVEN, 12))
    body.append(text((ox + x3 * s / 2.0, oy + (y1 + 1.2) * s + 26),
                      u"32＝□×2＋12＋□×2", "#c9d4f0", 12))
    body.append(text((ox + x3 * s / 2.0, oy + (y1 + 1.2) * s + 44),
                      u"→ □×4＝20 → □＝5", "#c9d4f0", 12))
    cw = ox + x3 * s + 60
    ch = oy + (y1 + 1.2) * s + 63
    return svgwrap(int(cw), int(ch), "".join(body))


# ============================================================
#  大問3：ダイヤ形のだんピラミッド（19こ・9こ・62こ）
# ============================================================
def diamond_layer(cy_row_widths):
    u"""row_widths=各行の(中心x,セル数)。ダイヤ型の1だん分の座標一覧(x,y)を返す"""
    cells = []
    for y, (cx, n) in enumerate(cy_row_widths):
        for i in range(n):
            cells.append((cx - n // 2 + i, y))
    return cells


def svg_daimon3_zu1():
    s = 26
    ox, oy = 130, 260
    # 1段目(z=0,底面)：ダイヤ13マス／2段目(z=1)：5マス／3段目(z=2)：1マス
    base = [(-2, 2), (-1, 1), (0, 1), (1, 1), (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0), (-1, -1), (0, -1), (1, -1), (0, -2)]
    mid = [(-1, 0), (0, 1), (0, 0), (0, -1), (1, 0)]
    top = [(0, 0)]
    cols = {}
    for (x, y) in base:
        cols[(x, y)] = 1
    for (x, y) in mid:
        cols[(x, y)] = 2
    for (x, y) in top:
        cols[(x, y)] = 3
    body = [text((ox, 18), u"図1（だん型のピラミッド）", "#c9d4f0", 14)]
    body.append(block_pile([(x, y, h) for (x, y), h in cols.items()], s, ox, oy))
    return svgwrap(360, 300, "".join(body))


def svg_daimon3_zu2():
    u"""正面から見た図：高さ[1,2,3,2,1]の5列"""
    s = 24
    ox, oy = 30, 130
    heights = [1, 2, 3, 2, 1]
    body = [text((100, 18), u"正面から見た図", "#c9d4f0", 14)]
    for i, h in enumerate(heights):
        x = ox + i * s
        y0 = oy - h * s
        body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="2"/>'
                    % (x, y0, s, h * s, LINE))
    return svgwrap(200, 150, "".join(body))


# ============================================================
#  大問4：正面図・真上図から個数（設問には数字を書きこまない）
# ============================================================


def blank_footprint(cells, ttl):
    u"""cells = {(col,row): n} の疎な格子を、数字を書かずにマスのわくだけで示す（設問用の真上図）"""
    s = 40
    cols = [c for c, r in cells]
    rows = [r for c, r in cells]
    w = max(cols) + 1
    h = max(rows) + 1
    ox, oy = 20, 40
    body = [text((ox + w * s / 2.0, 18), ttl, "#c9d4f0", 14)]
    for (c, r) in cells:
        x, y = ox + c * s, oy + r * s
        body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="2"/>'
                    % (x, y, s, s, LINE))
    return svgwrap(ox * 2 + w * s, oy + h * s + 15, "".join(body))


def front_profile_of(cells):
    u"""真上図の高さから、正面から見た図の階段の高さ（列ごとの最大）を逆算する"""
    m = {}
    for (c, r), h in cells.items():
        m[c] = max(m.get(c, 0), h)
    n = max(m) + 1
    return [m.get(i, 0) for i in range(n)]


def svg_daimon4(cells, idx):
    top = blank_footprint(cells, u"真上から見た図（%d）" % idx)
    front = svg_daimon5_profile(front_profile_of(cells), u"正面から見た図（%d）" % idx)
    return top + front


D4_GRIDS = {
    1: {(0, 0): 3, (1, 0): 1, (1, 1): 1, (2, 1): 1, (2, 2): 1},
    2: {(0, 0): 1, (0, 1): 1, (1, 1): 3, (2, 1): 3, (0, 2): 1},
    3: {(0, 0): 3, (1, 0): 2, (2, 0): 1, (2, 1): 1, (2, 2): 1},
    4: {(1, 0): 1, (1, 1): 1, (0, 2): 1, (1, 2): 1, (2, 2): 2},
}


# ============================================================
#  大問5：塗った立方体（真上5×4・正面[5,4,3,4,1]・横[1,2,3,5]）
# ============================================================
def svg_daimon5_top():
    s = 34
    ox, oy = 20, 40
    body = [text((ox + 90, 18), u"真上から見た図", "#c9d4f0", 14)]
    for c in range(5):
        for r in range(4):
            x, y = ox + c * s, oy + r * s
            body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="2"/>'
                        % (x, y, s, s, LINE))
    return svgwrap(ox * 2 + 5 * s, oy + 4 * s + 15, "".join(body))


def svg_daimon5_profile(heights, ttl):
    s = 26
    ox, oy = 20, 20 + max(heights) * s
    body = [text((ox + len(heights) * s / 2.0, 18), ttl, "#c9d4f0", 14)]
    for i, h in enumerate(heights):
        x = ox + i * s
        y0 = oy - h * s
        body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="2"/>'
                    % (x, y0, s, h * s, LINE))
    return svgwrap(ox * 2 + len(heights) * s, oy + 15, "".join(body))




# ============================================================
#  大問6：5×5×5をくりぬく（層ごとの×印）
# ============================================================
D6_LAYERS = [
    [(4, 2)],
    [(3, 2), (4, 4)],
    None,  # あとで組み立て
]
D6_X = {
    1: [(2, 4), (3, 3), (4, 2)],
    2: [(1, 2), (2, 2), (2, 4), (3, 2), (3, 3), (4, 2), (5, 2)],
    3: [(1, 3), (2, 3), (2, 4), (3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (4, 2), (4, 3), (5, 3)],
    4: [(1, 4), (2, 4), (3, 3), (3, 4), (4, 2), (4, 4), (5, 4)],
    5: [(2, 4), (3, 3), (4, 2)],
}


def svg_daimon6_layer(dan):
    s = 32
    ox, oy = 20, 34
    xs = set(D6_X[dan])
    body = [text((ox + 2.5 * s, 18), u"%dだん目" % dan, "#c9d4f0", 13)]
    for r in range(1, 6):
        for c in range(1, 6):
            x, y = ox + (c - 1) * s, oy + (r - 1) * s
            body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="1.6"/>'
                        % (x, y, s, s, LINE))
            if (r, c) in xs:
                body.append(text((x + s / 2.0, y + s / 2.0), u"×", MARK, 18))
    return svgwrap(ox * 2 + 5 * s, oy + 5 * s + 10, "".join(body))


def svg_daimon6_cube():
    s = 26
    ox, oy = 40, 250
    body = [text((ox + 60, 18), u"1辺5cmの立方体（1辺1cmの立方体125こ分）", "#c9d4f0", 13)]
    W = 5
    top = [(0, 0, W), (W, 0, W), (W, W, W), (0, W, W)]
    lft = [(0, 0, 0), (W, 0, 0), (W, 0, W), (0, 0, W)]
    rgt = [(W, 0, 0), (W, W, 0), (W, W, W), (W, 0, W)]
    body.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in top], "#20305a", LINE, 2))
    body.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in lft], "#20305a", LINE, 2))
    body.append(poly([P(*v, s=s, ox=ox, oy=oy) for v in rgt], "#20305a", LINE, 2))
    for k in range(1, W):
        body.append(line(P(k, 0, W, s, ox, oy), P(k, W, W, s, ox, oy), LINE, 1))
        body.append(line(P(0, k, W, s, ox, oy), P(W, k, W, s, ox, oy), LINE, 1))
        body.append(line(P(0, 0, k, s, ox, oy), P(W, 0, k, s, ox, oy), LINE, 1))
        body.append(line(P(k, 0, 0, s, ox, oy), P(k, 0, W, s, ox, oy), LINE, 1))
        body.append(line(P(W, 0, k, s, ox, oy), P(W, W, k, s, ox, oy), LINE, 1))
        body.append(line(P(W, k, 0, s, ox, oy), P(W, k, W, s, ox, oy), LINE, 1))
    return svgwrap(260, 300, "".join(body))


# ============================================================
#  大問7：画用紙の角を切って箱を作る
# ============================================================
def svg_daimon7_zu1():
    s = 5.2
    ox, oy = 55, 50
    W, D, cut = 45.0, 30.0, 11.0
    body = [text((ox + W * s / 2.0, 18), u"図1", "#c9d4f0", 14)]
    body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="2.2"/>'
                % (ox, oy, W * s, D * s, LINE))
    for (cx, cy) in [(0, 0), (W - cut, 0), (0, D - cut), (W - cut, D - cut)]:
        body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="rgba(255,158,203,0.25)" '
                    'stroke="%s" stroke-width="1.6"/>' % (ox + cx * s, oy + cy * s, cut * s, cut * s, MARK))
    body.append(text((ox + W * s / 2.0, oy - 12), u"45cm", GIVEN, 13))
    body.append(text((ox - 28, oy + D * s / 2.0), u"30cm", GIVEN, 13))
    body.append(text((ox + cut * s / 2.0, oy + cut * s + 12), u"11cm", GIVEN, 11))
    return svgwrap(int(ox + W * s + 20), int(oy + D * s + 20), "".join(body))


def svg_daimon7_zu2():
    s = 8
    ox, oy = 40, 160
    body = [text((ox + 60, 16), u"図2", "#c9d4f0", 14)]
    body.append(box3d(23, 8, 11, s, ox, oy, labels=[((23 / 2.0, 0, 11), u"ア"), ((23 - 2, 0, 5.5), u"イ")]))
    body.append(text((ox + 23 * s + 22, oy - 5.5 * s), u"11cm", GIVEN, 13))
    return svgwrap(int(ox * 2 + 23 * s), int(oy + 20), "".join(body))


# ============================================================
#  大問8：直方体の展開図
# ============================================================
def svg_daimon8_zu1():
    u"""図1：4×2×1の直方体の展開図（十字型）"""
    s = 24.0
    ox, oy = 40, 60
    body = [text((ox + 3 * s, 16), u"図1", "#c9d4f0", 14)]
    # 主帯：4段(高さ4cm)×横に1,2,1,2の帯。上下フラップは2番目の帯(幅2)につく
    xw = [1, 2, 1, 2]
    xs = [0]
    for w in xw:
        xs.append(xs[-1] + w)
    H = 4.0
    # 外周（solid）を直接ポリゴンで
    outline = [(0, 0), (1, 0), (1, -1), (3, -1), (3, 0), (6, 0),
               (6, H), (3, H), (3, H + 1), (1, H + 1), (1, H), (0, H)]
    pts = [(ox + p[0] * s, oy + p[1] * s) for p in outline]
    body.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="2.4" stroke-linejoin="round"/>'
                % (" ".join("%.1f,%.1f" % p for p in pts), LINE))
    for xb in (1, 3, 4):
        body.append(line((ox + xb * s, oy), (ox + xb * s, oy + H * s), LINE, 1.4, dash=True))
    return svgwrap(int(ox * 2 + 6 * s), int(oy * 2 + (H + 1) * s), "".join(body))


def svg_daimon8_zu2():
    s = 30
    ox, oy = 40, 130
    body = [text((ox + 60, 16), u"図2", "#c9d4f0", 14)]
    body.append(box3d(4, 2, 1, s, ox, oy, labels=[((2, 0, 1), u"4cm"), ((0, 1, 1), u"2cm"), ((4, 0, 0.5), u"1cm")]))
    return svgwrap(int(ox * 2 + 4 * s), int(oy + 30), "".join(body))


# ============================================================
#  大問9：立方体の展開図
# ============================================================
def svg_daimon9_zu1():
    s = 34.0
    ox, oy = 60, 60
    body = [text((ox + 1.5 * s, 16), u"図1", "#c9d4f0", 14)]
    cells = {u"ア": (1, -1), u"イ": (0, 0), u"ウ": (1, 0), u"エ": (2, 0), u"オ": (3, 0)}
    for lab, (cx, cy) in cells.items():
        x, y = ox + cx * s, oy + cy * s
        body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="2"/>'
                    % (x, y, s, s, LINE))
        body.append(text((x + s / 2.0, y + s / 2.0), lab, "#c9d4f0", 16))
    tx, ty = ox + 1 * s, oy + 1 * s
    body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="2"/>'
                % (tx, ty, s, s, LINE))
    cx0, cy0 = tx + s / 2.0, ty + s * 0.72
    tri = [(cx0, ty + s * 0.18), (cx0 - s * 0.32, cy0), (cx0 + s * 0.32, cy0)]
    body.append(poly(tri, "none", MARK, 2))
    return svgwrap(int(ox * 2 + 4 * s), int(oy + 3 * s), "".join(body))


def svg_daimon9_zu2():
    s = 22
    ox, oy = 40, 150
    body = [text((ox + 55, 16), u"図2（立方体）", "#c9d4f0", 14)]
    body.append(box3d(5, 5, 5, s, ox, oy, labels=[((5, 0, 2.5), u"5cm"), ((2.5, 0, 5.6), u"5cm"), ((0, 2.5, 5.6), u"5cm")]))
    cx0, cy0 = ox + 2 * s, oy - 3.4 * s
    tri = [(cx0, cy0 - 8), (cx0 - 9, cy0 + 8), (cx0 + 9, cy0 + 8)]
    body.append(poly(tri, "none", MARK, 2))
    return svgwrap(int(ox + (5 + 0.52 * 5) * s + 40), int(oy + 20), "".join(body))


def svg_daimon9_unfold():
    u"""へこみをずらして長方形にする概念図（15cm×20cm）"""
    s = 8.0
    ox, oy = 40, 60
    outline = [(0, 5), (5, 5), (5, 0), (10, 0), (10, 5), (15, 5), (20, 5), (20, 10),
               (15, 10), (15, 15), (10, 15), (10, 10), (5, 10), (0, 10)]
    pts = [(ox + p[0] * s, oy + p[1] * s) for p in outline]
    body = [text((ox + 100, 16), u"へこみをずらすと 15cm×20cm", "#c9d4f0", 13)]
    body.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="2" stroke-linejoin="round"/>'
                % (" ".join("%.1f,%.1f" % p for p in pts), LINE))
    body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="%s" stroke-width="1.4" stroke-dasharray="5 4"/>'
                % (ox, oy, 20 * s, 15 * s, GIVEN))
    body.append(text((ox + 10 * s, oy - 10), u"20cm", GIVEN, 13))
    body.append(text((ox - 24, oy + 7.5 * s), u"15cm", GIVEN, 13))
    return svgwrap(int(ox * 2 + 20 * s), int(oy + 15 * s + 20), "".join(body))


# ============================================================
#  大問組み立て
# ============================================================
def build():
    recs = []

    # ---------------- 大問1：とうふを切る ----------------
    recs.append(rec(
        "hd3s_n08_1", "HG-7715", u"とうふを一辺2cmの立方体に切り分ける", 2, "rittai", u"立体図形",
        u"下のような、直方体や立方体の形をしたとうふがあります。このとうふを、一辺2cmの立方体の形に"
        u"切り分けていきます。あまりが出ないように、切る回数が1番少なくなるように切ると、何回切ることに"
        u"なりますか。",
        [st(u"たて4cm・横4cm・高さ2cmのとき、何回切りますか。", "2",
            u"たて…4÷2＝2等分→1回切る。横…4÷2＝2等分→1回切る。高さ…2÷2＝1等分→切らなくてよい。"
            u"1+1＝**2（回）**。",
            svg=svg_daimon1(4, 4, 2)),
         st(u"たて4cm・横6cm・高さ4cmのとき、何回切りますか。", "4",
            u"たて…4÷2＝2等分→1回。横…6÷2＝3等分→2回。高さ…4÷2＝2等分→1回。1+2+1＝**4（回）**。",
            svg=svg_daimon1(6, 4, 4)),
         st(u"一辺12cmの立方体のとき、何回切りますか。", "15",
            u"12÷2＝6等分→5回切る。たて・横・高さの3方向とも同じなので 5+5+5＝**15（回）**。",
            svg=svg_daimon1(12, 12, 12, s=13))]))

    # ---------------- 大問2：箱をつぶす ----------------
    recs.append(rec(
        "hd3s_n08_2", "HG-7716", u"ふたのない箱をつぶす（正方形の一辺＝5cm）", 4, "rittai", u"立体図形",
        u"図1のような、ふたのない直方体の紙の箱があります。底は、たて12cm、横32cmの長方形です。この箱の"
        u"側面のうち、小さい方を内がわに、大きい方を外がわにおってつぶすと、図2のようになりました。図2で、"
        u"紙が重なっていない部分を見ると正方形でした。",
        [st(u"このとき、もとの箱の高さは何cmですか。", "5",
            u"もとの箱の高さを□cmとする。図2の正方形の一辺の長さに注目すると、12+□×2＝32−□×2という式が"
            u"成り立つ。整理すると □×4＝32−12＝20、□＝20÷4＝**5（cm）**。",
            svg=svg_daimon2_zu1() + svg_daimon2_zu2())]))

    # ---------------- 大問3：だん型のピラミッド ----------------
    d3zu1 = svg_daimon3_zu1()
    recs.append(rec(
        "hd3s_n08_3", "HG-7717", u"だん型に積んだ立方体（19こ・9こ・62こ）", 4, "rittai", u"立体図形",
        u"一辺1cmの立方体を、図1のようにすきまなくつみ重ねました。前・後・左・右の4つの向きから見た形は、"
        u"すべて同じです。また、上から見た形はダイヤ型（1+3+5+3+1の13マス）です。",
        [st(u"立方体は全部で何こつみ重ねましたか。", "19",
            u"上のだんから順に数える。いちばん上が1こ、真ん中のだんが5こ、いちばん下（土台）が13こ。"
            u"1+5+13＝**19（こ）**。",
            svg=d3zu1),
         st(u"前から見ると、一辺1cmの正方形は、何こ見えますか。", "9",
            u"前から見ると、高さが左から1,2,3,2,1の階段の形になる。1+2+3+2+1＝**9（こ）**。",
            svg=svg_daimon3_zu2()),
         st(u"つみ重ねたままで、下の面も入れて、表面にある一辺1cmの正方形を数えると、全部で何こありますか。", "62",
            u"前後左右の4方向から見える面積はどれも9こなので 9×4＝36（こ）。上から見える面は、"
            u"土台のうち中だんに隠れない分8こ＋中だんのうち上だんに隠れない分4こ＋いちばん上の1こ＝13こ、"
            u"下から見える面（底面）はそのまま土台の13こなので、上下合わせて13×2＝26（こ）。"
            u"36+26＝**62（こ）**。")]))

    # ---------------- 大問4：2方向図から個数 ----------------
    recs.append(rec(
        "hd3s_n08_4", "HG-7718", u"2方向から見た図から積み木の数（7/9/8/6こ）", 4, "rittai", u"立体図形",
        u"同じ大きさの立方体のつみ木をつみ重ねてできた立体が、正面から見た図・真上から見た図で表されて"
        u"います。それぞれ使われているつみ木の数をもとめなさい。（真上から見た図のマスに、その位置に"
        u"つみ重ねた高さの数字を書きこんで考えるとよい）",
        [st(u"(1)の図のとき、つみ木は何こですか。", "7",
            u"真上から見た図に高さを書きこむと、3,1,1,1,1のマスに分かれる。3+1+1+1+1＝**7（こ）**。",
            svg=svg_daimon4(D4_GRIDS[1], 1)),
         st(u"(2)の図のとき、つみ木は何こですか。", "9",
            u"真上から見た図に高さを書きこむと、1,1,3,3,1のマスに分かれる。1+1+3+3+1＝**9（こ）**。",
            svg=svg_daimon4(D4_GRIDS[2], 2)),
         st(u"(3)の図のとき、つみ木は何こですか。", "8",
            u"真上から見た図に高さを書きこむと、3,2,1,1,1のマスに分かれる。3+2+1+1+1＝**8（こ）**。",
            svg=svg_daimon4(D4_GRIDS[3], 3)),
         st(u"(4)の図のとき、つみ木は何こですか。", "6",
            u"真上から見た図に高さを書きこむと、1,1,1,1,2のマスに分かれる。1+1+1+1+2＝**6（こ）**。",
            svg=svg_daimon4(D4_GRIDS[4], 4))]))

    # ---------------- 大問5：塗った立方体の最大最小 ----------------
    top5 = svg_daimon5_top()
    front5 = svg_daimon5_profile([5, 4, 3, 4, 1], u"正面から見た図")
    side5 = svg_daimon5_profile([1, 2, 3, 5], u"横から見た図")
    given5 = top5 + front5 + side5
    recs.append(rec(
        "hd3s_n08_5", "HG-7719", u"塗った立方体を積んだ数の最大・最小（44こ・33こ）", 4, "rittai", u"立体図形",
        u"各面を黒くぬった一辺1cmの立方体をすきまなくつみ上げて作った立体があります。この立体を真上、"
        u"正面、横から見た図は、真上から見ると5×4のマス目全部（20マス）で、正面から見ると左から"
        u"5,4,3,4,1だんの階段、横から見ると1,2,3,5だんの階段になっています。",
        [st(u"立方体はもっとも多くて何こつみ上げていますか。", "44",
            u"真上から見た図の各マスについて、正面から見た高さと横から見た高さのうち小さい方を書きこめば"
            u"よい。1だん目の列は1,1,1,1,1（5こ）、2だん目は2,2,2,2,1（9こ）、3だん目は3,3,3,3,1（13こ）、"
            u"5だん目は5,4,3,4,1（17こ）。5+9+13+17＝**44（こ）**。",
            svg=given5),
         st(u"立方体はもっとも少なくて何こつみ上げていますか。", "33",
            u"まず、正面・横のそれぞれの最大の高さを、必ずどこかのマスで実現させる（例えば5だんは列1の"
            u"5、4だんは列2と列4の4、3だんは行3・列3の3）。それ以外のマスはすべて1こにする。"
            u"こうして書きこんだマスの合計は**33（こ）**。",
            svg=given5)]))

    # ---------------- 大問6：立方体をくりぬく ----------------
    d6_layers_svg = "".join(svg_daimon6_layer(d) for d in range(1, 6))
    recs.append(rec(
        "hd3s_n08_6", "HG-7720", u"5×5×5の立方体をくりぬく（94こ）", 4, "rittai", u"立体図形",
        u"下の図は、一辺1cmの立方体をすきまなくならべて作った一辺5cmの立方体です。この立方体の色をつけた"
        u"部分を反対側の面までまっすぐくりぬきます。"
        u"（※実物では色をつけた部分の印刷が失われているため、公式解答が示す「上のだんから順に、"
        u"くりぬかれたところ」の5だん分の図をそのまま示す）",
        [st(u"くりぬいたあと、一辺1cmの立方体は何このこっていますか。", "94",
            u"上のだんから順に、くりぬかれるマスを数えると 3+7+11+7+3＝31（こ）。もとの立方体は"
            u"5×5×5＝125（こ）なので、のこりは 125−31＝**94（こ）**。",
            svg=svg_daimon6_cube() + d6_layers_svg)]))

    # ---------------- 大問7：画用紙の角を切って箱を作る ----------------
    zu1_7 = svg_daimon7_zu1()
    recs.append(rec(
        "hd3s_n08_7", "HG-7721", u"画用紙の角を切って箱を作る（23cm・8cm）", 3, "rittai", u"立体図形",
        u"図1のような長方形の画用紙（たて30cm・横45cm）の4つの角から、一辺11cmの正方形を切り取って、"
        u"図2のようなふたのない箱を作りました。図2のイよりもアの方が長いとき、次の問題に答えなさい。",
        [st(u"アの長さは何cmですか。", "23",
            u"アは、横の長さから両はしで切り取った正方形の一辺2つ分を引いたもの。45−11×2＝**23（cm）**。",
            svg=zu1_7 + svg_daimon7_zu2()),
         st(u"イの長さは何cmですか。", "8",
            u"イは、たての長さから両はしで切り取った正方形の一辺2つ分を引いたもの。30−11×2＝**8（cm）**。",
            svg=zu1_7 + svg_daimon7_zu2())]))

    # ---------------- 大問8：直方体の展開図 ----------------
    zu1_8 = svg_daimon8_zu1()
    recs.append(rec(
        "hd3s_n08_8", "HG-7722", u"直方体の展開図（辺の合計28cm・太線24cm）", 3, "rittai", u"立体図形",
        u"下の図1は直方体の展開図です。図1を組み立てると、たて2cm・横4cm・高さ1cmの図2の直方体ができます。",
        [st(u"できた図2の直方体の辺の長さをすべてあわせると何cmですか。", "28",
            u"直方体には、同じ長さの辺が4本ずつ3種類ある。2×4+4×4+1×4＝**28（cm）**。",
            svg=zu1_8 + svg_daimon8_zu2()),
         st(u"図1の外側のふち（太線）部分の長さは何cmですか。", "24",
            u"へこんでいる部分（上下のふた用の折れ込み）をずらして考えると、1辺6cmの正方形になる。"
            u"正方形の1辺は4本あるので、まわりの長さは 6×4＝**24（cm）**。",
            svg=zu1_8)]))

    # ---------------- 大問9：立方体の展開図 ----------------
    zu1_9 = svg_daimon9_zu1()
    recs.append(rec(
        "hd3s_n08_9", "HG-7723", u"立方体の展開図（エ・70cm）", 3, "rittai", u"立体図形",
        u"下の図1の展開図を組み立てると、一辺5cmの図2の立方体になります。",
        [st(u"×の絵があるのは、ア,イ,ウ,エ,オのうちどれですか。記号で答えなさい。", u"エ",
            u"△の面を折って底にすると、△の右がわの辺にくっつく面は、展開図で△の右どなりにある**エ**。",
            choices=[u"ア", u"イ", u"ウ", u"エ", u"オ"],
            svg=zu1_9 + svg_daimon9_zu2()),
         st(u"図1の太線部分（外側のふち）の長さは何cmですか。", "70",
            u"へこんでいる部分をずらして長方形にして考えると、たて15cm・横20cmの長方形になる。"
            u"まわりの長さは (15+20)×2＝**70（cm）**。",
            svg=svg_daimon9_unfold())]))

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

    # --- 検算：大問5の最大・最小 ---
    col_max = [5, 4, 3, 4, 1]
    row_max = [1, 2, 3, 5]
    mx = sum(min(c, r) for r in row_max for c in col_max)
    assert mx == 44, u"大問5 最大の検算NG: %d" % mx
    print(u"大問5 最大値検算: OK(%d)" % mx)
    # --- 検算：大問6のくりぬき数 ---
    total_x = sum(len(v) for v in D6_X.values())
    assert total_x == 31, u"大問6 くりぬき数の検算NG: %d" % total_x
    assert 125 - total_x == 94
    print(u"大問6 くりぬき数検算: OK(%d)" % total_x)
    # --- 検算：大問4の内訳合計 ---
    for i, ans in zip(range(1, 5), [7, 9, 8, 6]):
        s_ = sum(D4_GRIDS[i].values())
        assert s_ == ans, u"大問4(%d) 検算NG: %d != %d" % (i, s_, ans)
    print(u"大問4 内訳検算: OK")

    d = json.load(io.open(DAIMON, encoding="utf-8"))
    g3 = d["grades"]["3"]
    g3.setdefault(COURSE, {}).setdefault("fukushu", {})[NO] = recs
    io.open(DAIMON, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=1) + chr(10))
    print(u"書きこみ: %s ← 小3最レ（刷新版）の宿題 No.%s" % (DAIMON, NO))


GENBO_HEAD = u"""
## ★★★ 小3最レ 刷新版 宿題テキスト 第1分冊 No.8「5月2回目 立体図形(2)」（HG-7715〜7723）★2026-09-07 収録

全9大問20小問。
> 📄 出典 `3年 最レ算数 第1分冊.pdf` p52-59（問題）／`解答 3年 最レ算数 第1分冊.pdf` p50-55（解答・解説）
> ローカルの実物：`hama_in/b1/p052.jpeg`〜`p059.jpeg`（問題）／`hama_in/b1a/p050.jpeg`〜`p055.jpeg`（解答）

**★この回の骨は「見えない部分・折りたたんだ形を、手を動かして数え直す」立体の回、No.7の続き。**
> 大問1（切る回数）→大問2（箱をつぶす）→大問3（だん型ピラミッド）→大問4（2方向図の定番）→
> 大問5（塗った立方体の最大最小）→大問6（くりぬき）→大問7〜9（展開図3連発）。

**🚨大問6は、5×5×5の立方体の「色をつけた部分」（くりぬく場所の印字）が実物のスキャンで完全に失われて
いた（真っ白）。**公式解答ページが「上のだんから順に、くりぬかれたところ」を5だん分の5×5マスの図で
示してくれているので、その5だん分の×印の位置（1だん目3こ・2だん目7こ・3だん目11こ・4だん目7こ・
5だん目3こ＝計31こ）を1マスずつそのまま写した。**実物の問題ページにあったはずの「色をつけた部分」の
見た目そのものは復元できていない**（アプリの図は公式解答の5だん分の図を使っている）。

**⚠大問5は、真上・正面・横の3方向図から個数の最大・最小をもとめる定番の問題。**正面から見た高さ
（5,4,3,4,1）と横から見た高さ（1,2,3,5）を実物のマス目から1マスずつ数え直して確認した。

**⚠この回の答え（解答p50〜55の解説で確定・こちらでも全問 独立に解き直して一致）**
| 大問 | 答え |
|---|---|
| 1 | (1)2回 (2)4回 (3)15回 |
| 2 | 5cm |
| 3 | (1)19こ (2)9こ (3)62こ |
| 4 | (1)7こ (2)9こ (3)8こ (4)6こ |
| 5 | (1)44こ (2)33こ |
| 6 | 94こ |
| 7 | (1)23cm (2)8cm |
| 8 | (1)28cm (2)24cm |
| 9 | (1)エ (2)70cm |
"""


def genbo():
    recs = build()
    meta = {
        "HG-7715": (u"大問1（とうふを一辺2cmの立方体に切る・2/4/15回）★★",
                    u"直方体を一辺2cmの立方体に切るには、たて・横・高さそれぞれを2cmごとに切ればよい",
                    u"1辺を何等分するかではなく「何回切るか」＝(等分数−1)を、3方向ぶん足し合わせる",
                    u"あり（3つの直方体・立方体を実物の寸法どおりに描いたもの）",
                    u"★★No.7の立体図形の続き。切る回数という、体積とは別の数え方を確認する入口"),
        "HG-7716": (u"大問2（箱をつぶすと正方形・高さ5cm）★★★★",
                    u"箱の側面を内・外に折ってつぶすと、重ならない部分が正方形になる、という条件を式にする",
                    u"箱の高さを□とおき、正方形の一辺の長さを2通りの式（12+□×2と32−□×2）で表して"
                    u"つなげる",
                    u"あり（図1の元の箱と、図2のつぶした形の概念図。□＝高さとして一般化して描いた）",
                    u"★★★★この回でいちばん式の組み立てが難しい大問。図から2通りの式を作る力が要る"),
        "HG-7717": (u"大問3（だん型に積んだ立方体・19/9/62こ）★★★★",
                    u"上から見てダイヤ型（1+3+5+3+1）になる、3だんの階段ピラミッド",
                    u"個数は「だんごとに数える」、前から見える面積は「列ごとの最大の高さを足す」、"
                    u"表面積は「前後左右の面積×4＋上下」で求める",
                    u"あり（3Dの階段ピラミッドと、正面から見た階段の図）",
                    u"★★★★大問1・2よりも積み木の個数を数える力にもどり、表面積まで発展させる"),
        "HG-7718": (u"大問4（2方向図から積み木の数・7/9/8/6こ）★★★★",
                    u"正面図と真上図の両方をつき合わせると、真上図の各マスの高さがただ1通りに決まる場合が"
                    u"ある",
                    u"真上図に高さの数字を書きこんでから合計する、という機械的な手順で解ける",
                    u"あり（真上から見たわく線の形と、正面から見た階段の輪郭。数字は書きこまず、"
                    u"公式解答の数字はmeaningのみに書く＝答えを見せない）",
                    u"★★★★2方向図の定番の型を、4パターン連続で練習する回のヤマ場"),
        "HG-7719": (u"大問5（塗った立方体の最大・最小・44/33こ）★★★★",
                    u"真上・正面・横の3方向から見た図だけでは、個数はただ1通りに決まらない（最大と最小の"
                    u"はばがある）",
                    u"最大は各マスに「正面・横の高さの小さい方」を、最小は「必ずどこかで実現させる高さ」"
                    u"以外を全部1こにする",
                    u"あり（真上・正面・横の3方向の輪郭のみ。数字はmeaningのみに書く＝答えを見せない）",
                    u"★★★★大問4の1方向図が2方向に増え、答えに幅が出る、この回でいちばん考える大問"),
        "HG-7720": (u"大問6（5×5×5をくりぬく・94こ）★★★★",
                    u"色をつけた部分を反対の面までまっすぐくりぬくと、複数の方向のくりぬきが重なる場所は"
                    u"1回しか引かない",
                    u"上のだんから順に、くりぬかれるマスを数えて足し合わせる（3+7+11+7+3＝31こ）",
                    u"あり（1辺5cmの立方体と、5だん分のくりぬき位置の図。実物では色をつけた部分の印刷が"
                    u"失われていたため、公式解答の5だん分の図をそのまま用いた）",
                    u"★★★★大問3の「だんごとに数える」技を、くりぬきという逆の操作で使う"),
        "HG-7721": (u"大問7（画用紙の角を切って箱を作る・23cm/8cm）★★★",
                    u"長方形の紙の4すみから同じ大きさの正方形を切り取ってふたのない箱を作る、定番の設定",
                    u"できる箱のアの長さ・イの長さは、もとの紙の長さから切り取った正方形の一辺2つ分を"
                    u"引くだけ",
                    u"あり（切り取り線つきの画用紙と、できる箱）",
                    u"★★★展開図3連発の1つ目。箱の高さが11cmになることにも気づかせる作り"),
        "HG-7722": (u"大問8（直方体の展開図・辺の合計28cm/太線24cm）★★★",
                    u"直方体の辺は同じ長さが4本ずつ3種類、展開図の外側のふちは「へこみをずらして長方形に"
                    u"する」と計算しやすい",
                    u"へこんでいる部分（ふたの折れ込み）をずらして長方形（今回は正方形）にすると、"
                    u"まわりの長さがそのまま計算できる",
                    u"あり（十字型の展開図と、組み立てた4×2×1の直方体）",
                    u"★★★展開図3連発の2つ目。「ずらして長方形にする」という、この回のもう1つの技を導入"),
        "HG-7723": (u"大問9（立方体の展開図・エ/70cm）★★★",
                    u"立方体の展開図で、折ったときにどの面とどの面がくっつくかを追いかける",
                    u"大問8と同じ「へこみをずらして長方形にする」技を、立方体（一辺5cm）でもう一度使う",
                    u"あり（△じるしつきの十字型展開図と、組み立てた立方体）",
                    u"★★★展開図3連発のしめくくり。大問8の技をもう一度、面の対応づけとセットで確認する")
    }
    out = [GENBO_HEAD]
    for r in recs:
        hg = r["hg"]
        title, hone, core, zu, memo = meta[hg]
        out.append(u"### 【%s】小3最レ（刷新版）No.8 %s" % (hg, title) + chr(10))
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
        out.append(u"- アプリ実装: `data/hama_daimon.json` grades.3.sairei_new_bunsatsu.fukushu[" + chr(34) + "8" + chr(34) +
                   u"] の `%s`" % r["id"] +
                   u"（生成元 `scripts/gen_s3sairei_no8.py`。**JSONを手で書かない**）" + chr(10))
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
    print(u"原簿に追記: %s（%d文字・大問9本）" % (p, len(body)))


if __name__ == "__main__":
    if "--genbo" in sys.argv:
        write_genbo()
    else:
        main()
