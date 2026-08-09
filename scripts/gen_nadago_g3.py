# -*- coding: utf-8 -*-
"""小3 灘合（灘中合格特訓）の大問を data/hama_daimon.json に置く。

★形は既存の大問モードと同じ（[[project_oton_2mode_kousou]]）：
  grades["3"]["nadago"]["fukushu"][回番号] = [大問, …]
  大問 = {id, src, title, category, unit, grade, star, intro, svg, steps:[{question, answer, meaning}]}
  → アプリ側の変更は要らない（js/sansu.js の hamaDaimonWeek がそのまま読む）

★原簿どおりに置く。数値替えの類題は作らない（[[feedback_genbo_dori]]）。
  原簿は 設定／設問／図の仕様／答え／解法 を全部持っているので、
  **設問を解法の順に小問へ割る**だけでよい。ここが灘合の設計そのもの：
  原簿 HG-1909 作問メモ「小問の並びがそのまま解法の手順書になっている」。

★図は原簿の「図:」に**あり**と書いてあるものだけ描く。
  「なし（ベン図を自分で描かせる）」と書いてあるものは**描かない**（描くと問題が変わる）。

  python scripts/gen_nadago_g3.py          … 中身を見るだけ
  python scripts/gen_nadago_g3.py --write  … data/hama_daimon.json に書きこむ
"""
import io, json, math, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DAIMON = os.path.join(ROOT, "data", "hama_daimon.json")

# 既存の大問・かんたん解説と同じ色づかい
BLUE, GREEN, ORANGE, INK, GRAY = "#4f7cff", "#28c88a", "#ff9a44", "#1a2340", "#6c7086"
RED = "#ff6b6b"


def _svg(w, h, body):
    return ('<svg viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" '
            'style="display:block;margin:0 auto;max-width:100%%">\n%s\n</svg>' % (w, h, body))


def _t(x, y, s, fill=INK, size=13, anchor="middle", bold=False):
    return ('<text x="%s" y="%s" font-size="%s" text-anchor="%s" font-family="sans-serif" '
            'fill="%s"%s>%s</text>' % (x, y, size, anchor, fill, ' font-weight="bold"' if bold else '', s))


def _table_svg(rows, widths, fs=12, rh=26, note="", head_col=True, head_row=False):
    """表のSVG。rows＝行ごとのセル文字列のリスト、widths＝列ごとの幅。
    head_col=左はしの列を見出し色に、head_row=1行目を見出し色にする。"""
    W = sum(widths)
    ox, oy = 4.0, 4.0
    body, y = [], oy
    for r, row in enumerate(rows):
        x = ox
        for c, cell in enumerate(row):
            w = widths[c]
            hd = (head_col and c == 0) or (head_row and r == 0)
            body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" '
                        'stroke="#c8cee0" stroke-width="1"/>'
                        % (x, y, w, rh, "#eef1f8" if hd else "#ffffff"))
            if cell:
                body.append(_t("%.1f" % (x + w / 2), "%.1f" % (y + rh / 2 + fs * 0.36),
                               cell, INK, fs, bold=hd))
            x += w
        y += rh
    h = y + (20 if note else 6)
    if note:
        body.append(_t((ox + W) / 2 + ox / 2, y + 15, note, GRAY, 11))
    return _svg(int(W + ox * 2), int(h), "\n".join(body))


def _trigrid_svg(n=6, u=38.0):
    """HG-1928 1辺がn等分された正三角形（小さな正三角形 n×n こ）"""
    import math as _m
    h = u * _m.sqrt(3) / 2
    ox, oy = 6.0, 16.0
    P = lambda r, c: (ox + (n - r) * u / 2 + c * u, oy + r * h)   # r段目の左からc番目の点
    ln = lambda a, b, c, w: ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                             'stroke-width="%s"/>' % (a[0], a[1], b[0], b[1], c, w))
    body = []
    for r in range(1, n):                                # 横の線
        body.append(ln(P(r, 0), P(r, r), "#9fb2e8", 1.2))
    for k in range(1, n):                                # 左下がり／右下がり
        body.append(ln(P(k, 0), P(n, n - k), "#9fb2e8", 1.2))
        body.append(ln(P(k, k), P(n, k), "#9fb2e8", 1.2))
    body.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="2.4"/>'
                % (" ".join("%.1f,%.1f" % p for p in (P(0, 0), P(n, 0), P(n, n))), BLUE))
    W = int(ox * 2 + n * u)
    body.append(_t(W / 2, oy + n * h + 20, "1辺を6等分した正三角形", GRAY, 11))
    return _svg(W, int(oy + n * h + 30), "\n".join(body))


def _kaidan_tri_svg():
    """HG-1968 3辺9・12・15の直角三角形10こを、底辺の1/3ずつ右にずらして重ねた21角形。
    実線が外周、点線がかくれている辺。"""
    B, H, N = 12.0, 9.0, 10
    D = B / 3
    u, W, oy = 5.4, 300, 14.0
    ox = (W - (D * (N - 1) + B) * u) / 2
    X = lambda x: ox + x * u
    Y = lambda y: oy + (H - y) * u
    body = []
    for i in range(N):                                  # かくれている辺は点線で
        x0 = D * i
        body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#b9c4e6" '
                    'stroke-width="1" stroke-dasharray="3 3"/>'
                    % (X(x0), Y(0), X(x0), Y(H)))
        body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#b9c4e6" '
                    'stroke-width="1" stroke-dasharray="3 3"/>'
                    % (X(x0), Y(H), X(x0 + B), Y(0)))
    pts = [(0.0, 0.0), (0.0, H)]
    for i in range(N - 1):
        x = D * (i + 1)
        pts.append((x, H - (x - D * i) / B * H))
        pts.append((x, H))
    pts.append((D * (N - 1) + B, 0.0))
    body.insert(0, '<polygon points="%s" fill="rgba(79,124,255,0.12)" stroke="%s" '
                   'stroke-width="2"/>'
                   % (" ".join("%.1f,%.1f" % (X(p[0]), Y(p[1])) for p in pts), BLUE))
    body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                'stroke-width="1.4"/>' % (X(0), Y(-1.4), X(D), Y(-1.4), RED))
    body.append(_t("%.1f" % X(D / 2), "%.1f" % (Y(-1.4) + 14), "ずらす幅", RED, 10))
    body.append(_t(W / 2, oy + H * u + 40, "3辺が9cm・12cm・15cmの直角三角形を10こ", GRAY, 11))
    body.append(_t(W / 2, oy + H * u + 55, "底辺の3分の1ずつ右へずらした（点線はかくれた辺）",
                   GRAY, 11))
    return _svg(W, int(oy + H * u + 64), "\n".join(body))


def _monosashi_svg():
    """HG-1962 目もりが3つだけになった10cmのものさし6本"""
    RUL = (("ア", (1, 2, 5)), ("イ", (1, 4, 5)), ("ウ", (3, 4, 5)),
           ("エ", (1, 2, 7)), ("オ", (1, 6, 7)), ("カ", (1, 4, 9)))
    u, ox, oy, rh, gap = 24.0, 34.0, 22.0, 22.0, 14.0
    body = []
    for i, (nm, ms) in enumerate(RUL):
        y = oy + i * (rh + gap)
        body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#ffffff" '
                    'stroke="%s" stroke-width="1.6"/>' % (ox, y, 10 * u, rh, INK))
        body.append(_t(ox - 16, y + rh / 2 + 4, nm, INK, 13, bold=True))
        for m in ms:
            x = ox + m * u
            body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                        'stroke-width="1.8"/>' % (x, y, x, y + rh, RED))
    y0, y1 = oy - 8, oy + 6 * (rh + gap) - gap + 8
    body.append(_t(ox, y0 - 2, "0", GRAY, 11))
    body.append(_t(ox + 10 * u, y0 - 2, "10", GRAY, 11))
    body.append(_t(ox + 5 * u, y1 + 14, "どれも長さ10cm。赤い線が のこった目もり", GRAY, 11))
    return _svg(int(ox + 10 * u + 14), int(y1 + 24), "\n".join(body))


def _tape_hex_svg():
    """HG-1963 紙テープを折って作った六角形（長い辺4cm・短い辺2cm、内がわは1辺2cmの正三角形）"""
    import math as _m
    u = 26.0
    ox, oy = 14.0, 20.0
    r3 = _m.sqrt(3)
    P = lambda x, y: (ox + x * u, oy + (3 * r3 - y) * u)          # y は上向き
    HEX = [(2, 0), (6, 0), (7, r3), (5, 3 * r3), (3, 3 * r3), (1, r3)]
    TRI = [(4, 2 * r3), (5, r3), (3, r3)]
    pj = lambda ps: " ".join("%.1f,%.1f" % P(*p) for p in ps)
    body = ['<polygon points="%s" fill="rgba(79,124,255,0.16)" stroke="%s" stroke-width="2.2"/>'
            % (pj(HEX), BLUE),
            '<polygon points="%s" fill="#ffffff" stroke="%s" stroke-width="2"/>'
            % (pj(TRI), RED)]
    mid = lambda a, b: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    for a, b, txt, dx, dy in ((HEX[0], HEX[1], "長い辺 4cm", 0, 17),
                              (HEX[1], HEX[2], "2cm", 22, 8),
                              (HEX[3], HEX[4], "短い辺 2cm", 0, -8)):
        m = P(*mid(a, b))
        body.append(_t("%.1f" % (m[0] + dx), "%.1f" % (m[1] + dy), txt, BLUE, 12, bold=True))
    m = P(*mid(TRI[1], TRI[2]))
    body.append(_t("%.1f" % m[0], "%.1f" % (m[1] + 15), "2cm", RED, 12, bold=True))
    W = int(8 * u + ox * 2)
    body.append(_t(W / 2, oy + 3 * r3 * u + 40, "かげの部分が紙テープ。まん中はあいている", GRAY, 11))
    return _svg(W, int(oy + 3 * r3 * u + 50), "\n".join(body))


def _shikitsume_svg():
    """HG-1966 たて19cm・横25cmの長方形を5つの正方形と1つの長方形でしきつめた図"""
    u, ox, oy = 10.0, 26.0, 20.0
    TIL = ((0, 0, 8, 8), (8, 0, 5, 5), (13, 0, 12, 5),
           (8, 5, 3, 3), (0, 8, 11, 11), (11, 5, 14, 14))
    body = []
    for x, y, w, h in TIL:
        body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" '
                    'fill="rgba(79,124,255,0.08)" stroke="%s" stroke-width="1.8"/>'
                    % (ox + x * u, oy + y * u, w * u, h * u, BLUE))
    body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" '
                'stroke="%s" stroke-width="2.6"/>' % (ox, oy, 25 * u, 19 * u, INK))
    body.append(_t(ox + 25 * u / 2, oy - 6, "25cm", INK, 12, bold=True))
    body.append('<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" '
                'font-family="sans-serif" fill="%s" font-weight="bold" '
                'transform="rotate(-90 %.1f %.1f)">19cm</text>'
                % (ox - 10, oy + 19 * u / 2, INK, ox - 10, oy + 19 * u / 2))
    W = int(ox + 25 * u + 14)
    body.append(_t(W / 2, oy + 19 * u + 20, "5つの正方形と1つの長方形でしきつめてある", GRAY, 11))
    return _svg(W, int(oy + 19 * u + 30), "\n".join(body))


def _pair3_svg():
    """HG-1967 合同な直角三角形2つを3通りにはりあわせた図（ア＝長方形／イ・ウ＝平行四辺形）"""
    u = 4.4
    body = []

    def draw(pts, glue, ox, oy, name):
        f = lambda p: (ox + p[0] * u, oy - p[1] * u)
        body.append('<polygon points="%s" fill="rgba(79,124,255,0.10)" stroke="%s" '
                    'stroke-width="2"/>' % (" ".join("%.1f,%.1f" % f(p) for p in pts), BLUE))
        a, b = f(glue[0]), f(glue[1])
        body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                    'stroke-width="1.8" stroke-dasharray="6 4"/>' % (a[0], a[1], b[0], b[1], RED))
        xs = [f(p)[0] for p in pts]
        ys = [f(p)[1] for p in pts]
        body.append(_t((min(xs) + max(xs)) / 2, max(ys) + 18, name, INK, 13, bold=True))

    draw([(0, 0), (15, 0), (15, 8), (0, 8)], ((0, 0), (15, 8)), 36, 92, "（ア）46cm")
    draw([(0, 8), (15, 0), (15, -8), (0, 0)], ((0, 0), (15, 0)), 200, 110, "（イ）50cm")
    draw([(15, 0), (0, 0), (-15, 8), (0, 8)], ((0, 0), (0, 8)), 150, 200, "（ウ）64cm")
    body.append(_t(150, 20, "同じ三角形2まいを、点線のところではりあわせた", GRAY, 11))
    return _svg(300, 232, "\n".join(body))


def _korogaru_svg():
    """HG-1969 たて12・横16の長方形が直線上を4回ころがる。頂点Aのえがく弧は3つ"""
    u, ox, base = 3.4, 26.0, 122.0
    X = lambda x: ox + x * u
    Y = lambda y: base - y * u
    body = ['<line x1="8" y1="%.1f" x2="292" y2="%.1f" stroke="%s" stroke-width="2"/>'
            % (base, base, INK)]
    RECTS = ((0, 16, 12), (16, 12, 16), (28, 16, 12), (44, 12, 16), (56, 16, 12))
    for x, w, h in RECTS:
        body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" '
                    'fill="rgba(79,124,255,0.08)" stroke="%s" stroke-width="1.6"/>'
                    % (X(x), Y(h), w * u, h * u, BLUE))
    A = ((0, 12), (28, 16), (44, 0), (44, 0), (56, 12))          # 各位置でのAの場所
    PIV = ((16, 0), (28, 0), (44, 0), (56, 0))
    for i, (p, q) in enumerate(zip(A, A[1:])):
        r = ((p[0] - PIV[i][0]) ** 2 + (p[1] - PIV[i][1]) ** 2) ** 0.5
        if r == 0:
            continue
        body.append('<path d="M %.1f %.1f A %.1f %.1f 0 0 1 %.1f %.1f" fill="none" '
                    'stroke="%s" stroke-width="1.8" stroke-dasharray="5 4"/>'
                    % (X(p[0]), Y(p[1]), r * u, r * u, X(q[0]), Y(q[1]), RED))
        dx, dy = (22, -14) if i == 3 else (0, -6)      # 4回目は弧の頂点が終点なので横へ出す
        body.append(_t("%.1f" % (X(PIV[i][0]) + dx), "%.1f" % (Y(r) + dy),
                       "%dcm" % int(r), RED, 11, bold=True))
    for i, p in enumerate(A):
        if i == 3:
            continue
        body.append('<circle cx="%.1f" cy="%.1f" r="3.4" fill="%s"/>' % (X(p[0]), Y(p[1]), RED))
    body.append(_t(X(A[0][0]) - 10, Y(A[0][1]) - 6, "A", RED, 13, bold=True))
    body.append(_t(150, 16, "たて12cm・横16cm・対角線20cmの長方形が4回ころがる", GRAY, 11))
    body.append(_t(150, base + 18, "赤い点線がAの通ったあと", GRAY, 11))
    body.append(_t(150, base + 33, "3回目はAが回転の中心なので動かない", GRAY, 11))
    return _svg(300, int(base + 42), "\n".join(body))


def _slide_svg():
    """HG-1970 1辺2cmの正方形が、半径6cmの半円の弧にそって向きを変えずに動く"""
    import math as _m
    u, cx, cy = 15.0, 150.0, 172.0
    R, S = 6.0, 2.0
    body = ['<path d="M %.1f %.1f A %.1f %.1f 0 0 1 %.1f %.1f Z" '
            'fill="rgba(79,124,255,0.08)" stroke="%s" stroke-width="2"/>'
            % (cx - R * u, cy, R * u, R * u, cx + R * u, cy, BLUE)]
    body.append(_t(cx, cy - 30, "半径6cm", BLUE, 12, bold=True))

    def sq(lx, by, nm, col):                       # 左下すみ(lx,by)＝算数の向き（yは上）
        body.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" '
                    'fill="rgba(255,107,107,0.12)" stroke="%s" stroke-width="1.8"/>'
                    % (cx + lx * u, cy - (by + S) * u, S * u, S * u, col))
        ox_, oy_ = cx + (lx + S / 2) * u, cy - (by + S / 2) * u
        body.append('<circle cx="%.1f" cy="%.1f" r="2.6" fill="%s"/>' % (ox_, oy_, col))
        if nm:
            body.append(_t("%.1f" % ox_, "%.1f" % (cy - (by + S) * u - 8), nm, col, 12, bold=True))
        return (lx + S / 2, by + S / 2)

    sq(-R - S, 0, "（あ）", RED)                    # 左はし：右下すみが弧に接する
    sq(-S, R, "", GRAY)                            # てっぺんの手前
    sq(0, R, "", GRAY)                             # てっぺんの向こう（1辺ぶん右へずれる）
    sq(R, 0, "（い）", RED)                         # 右はし
    d = ['M %.1f %.1f' % (cx + (-R - S / 2) * u, cy - (S / 2) * u)]
    d.append('A %.1f %.1f 0 0 1 %.1f %.1f'
             % (R * u, R * u, cx - (S / 2) * u, cy - (R + S / 2) * u))
    d.append('L %.1f %.1f' % (cx + (S / 2) * u, cy - (R + S / 2) * u))
    d.append('A %.1f %.1f 0 0 1 %.1f %.1f'
             % (R * u, R * u, cx + (R + S / 2) * u, cy - (S / 2) * u))
    body.append('<path d="%s" fill="none" stroke="%s" stroke-width="1.8" '
                'stroke-dasharray="5 4"/>' % (" ".join(d), GREEN))
    body.append(_t(cx, 20, "1辺2cmの正方形を、向きを変えずに弧にそって動かす", GRAY, 11))
    body.append(_t(cx, cy + 18, "緑の点線が、まん中の点Oの通ったあと", GREEN, 11))
    return _svg(300, int(cy + 28), "\n".join(body))


def _feb_cal_svg():
    """HG-1997 2月のカレンダー（1日が木曜・28日まで）"""
    rows = [["日", "月", "火", "水", "木", "金", "土"]]
    day = 1
    for r in range(5):
        row = []
        for c in range(7):
            if r == 0 and c < 4:
                row.append("")
            elif day <= 28:
                row.append(str(day))
                day += 1
            else:
                row.append("")
        rows.append(row)
    return _table_svg(rows, [38] * 7, fs=12, rh=24, head_col=False, head_row=True,
                      note="2月　1日が木曜、28日まで")


# ★角度の図は**弧を描かないとどの角か分からない**（本人指摘 2026-08-09）。
#   頂点pと、そこから出る2本（p→q・p→r）を渡すと、その2本の**間**に弧を描き、
#   弧のまん中の外がわにラベルを置く。ラベルの位置を人が決めると必ずずれる。
def _angle(p, q, r, label, color=RED, rad=20.0, lab=34.0, size=12):
    import math as _m
    a1 = _m.atan2(-(q[1] - p[1]), q[0] - p[0])
    a2 = _m.atan2(-(r[1] - p[1]), r[0] - p[0])
    d = (a2 - a1 + _m.pi) % (2 * _m.pi) - _m.pi        # −180°〜180°にそろえる
    P = lambda a, R: (p[0] + R * _m.cos(a), p[1] - R * _m.sin(a))
    s, e = P(a1, rad), P(a1 + d, rad)
    sweep = 0 if d > 0 else 1                          # 画面はy下向きなので反時計回り＝0
    mid = P(a1 + d / 2, lab)
    out = ['<path d="M %.1f %.1f A %.1f %.1f 0 0 %d %.1f %.1f" fill="none" stroke="%s" '
           'stroke-width="1.8"/>' % (s[0], s[1], rad, rad, sweep, e[0], e[1], color)]
    if label:
        out.append(_t("%.1f" % mid[0], "%.1f" % (mid[1] + 4), label, color, size, bold=True))
    return "\n".join(out)


# ── HG-1901 星形六角形の魔方陣 ─────────────────────────────
# 原簿の図の仕様どおり：〇は12個＝外側のとがった点6個＋内側の六角形の頂点6個。
#   外側 上=6・下=10、左上/右上/左下/右下は空（㋐㋑㋒㋓）
#   内側 2(左上) 8(右上) 3(右) 1(右下) 5(左下) 7(左)
# 六芒星は「外の頂点2つ＋内の頂点2つ」が一直線に並ぶ。外半径 R、内半径 R/√3 で必ずそろう
def _star_svg():
    cx, cy, R = 124.0, 122.0, 96.0
    r = R / math.sqrt(3.0)

    def P(deg, rad):
        a = math.radians(deg)
        return (cx + rad * math.cos(a), cy - rad * math.sin(a))

    outer = {"上": 90, "右上": 30, "右下": -30, "下": -90, "左下": -150, "左上": 150}
    inner = {"左上": 120, "右上": 60, "右": 0, "右下": -60, "左下": -120, "左": 180}
    # 2つの正三角形（上向き・下向き）で六芒星を描く
    tri1 = [P(outer[k], R) for k in ("上", "右下", "左下")]
    tri2 = [P(outer[k], R) for k in ("下", "左上", "右上")]
    body = []
    for tri in (tri1, tri2):
        body.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="1.6"/>'
                    % (" ".join("%.1f,%.1f" % p for p in tri), GRAY))
    marks = [("上", "6", INK), ("下", "10", INK),
             ("左上", "㋐", RED), ("右上", "㋑", RED), ("左下", "㋒", RED), ("右下", "㋓", RED)]
    for k, s, c in marks:
        x, y = P(outer[k], R)
        body.append('<circle cx="%.1f" cy="%.1f" r="13" fill="#fff" stroke="%s" stroke-width="1.8"/>'
                    % (x, y, c))
        body.append(_t("%.1f" % x, "%.1f" % (y + 5), s, c, 14, bold=True))
    for k, s in (("左上", "2"), ("右上", "8"), ("右", "3"), ("右下", "1"), ("左下", "5"), ("左", "7")):
        x, y = P(inner[k], r)
        body.append('<circle cx="%.1f" cy="%.1f" r="13" fill="#f8f9ff" stroke="%s" stroke-width="1.8"/>'
                    % (x, y, BLUE))
        body.append(_t("%.1f" % x, "%.1f" % (y + 5), s, INK, 14, bold=True))
    # ★下の〇（cy=218・半径13）の真下に置く。前は y=238 で丸に食いこんでいた（実測 2026-08-09）
    body.append(_t(124, 248, "一直線にならんだ4つの数の和が、6本とも同じ", GRAY, 11))
    return _svg(248, 258, "\n".join(body))


# ── HG-1903 木のならび ────────────────────────────────
def _trees_svg():
    body = ['<line x1="14" y1="96" x2="286" y2="96" stroke="%s" stroke-width="2"/>' % GRAY]
    xs = [40, 68, 96, 124, 176, 204, 232, 260]
    for i, x in enumerate(xs):
        body.append('<line x1="%d" y1="96" x2="%d" y2="74" stroke="%s" stroke-width="2"/>' % (x, x, GREEN))
        body.append('<circle cx="%d" cy="66" r="9" fill="#eafaf3" stroke="%s" stroke-width="1.6"/>'
                    % (x, GREEN))
    body.append(_t(150, 74, "……", GRAY, 16))
    body.append(_t(26, 112, "A", INK, 13, bold=True))
    body.append(_t(276, 112, "B", INK, 13, bold=True))
    body.append(_t(76, 34, "Aから 2本おきに 赤ひも →", RED, 11, anchor="start"))
    body.append(_t(224, 132, "← Bから 3本おきに 青ひも", BLUE, 11, anchor="end"))
    return _svg(300, 146, "\n".join(body))


# ── HG-1905 積の魔方陣（3×3。100は上の段のまん中） ─────────────
def _magic_svg():
    cells = [["ア", "100", "イ"], ["ウ", "エ", "オ"], ["カ", "キ", "ク"]]
    body = []
    for r in range(3):
        for c in range(3):
            x, y = 30 + c * 62, 20 + r * 56
            s = cells[r][c]
            fill = "#fff7f0" if s == "100" else ("#f8f9ff" if s != "ウ" else "#eafaf3")
            body.append('<rect x="%d" y="%d" width="62" height="56" fill="%s" stroke="%s" stroke-width="1.6"/>'
                        % (x, y, fill, GRAY))
            body.append(_t(x + 31, y + 35, s, INK if s != "ウ" else GREEN, 17, bold=True))
    body.append(_t(123, 214, "たて・横・ななめの 3この 積が どれも 1000", GRAY, 11))
    return _svg(246, 228, "\n".join(body))


# ── HG-1906 78の筆算（4回で回文になる例） ────────────────────
def _kaibun_svg():
    rows = [("78", "87", "165"), ("165", "561", "726"),
            ("726", "627", "1353"), ("1353", "3531", "4884")]
    body = []
    # ★4行目だけ太字で長いので、回数のラベルとぶつかる。式の中心を右へ寄せて逃がす（実測 2026-08-09）
    for i, (a, b, s) in enumerate(rows):
        y = 26 + i * 46
        body.append(_t(150, y, "%s ＋ %s ＝ %s" % (a, b, s), INK if i < 3 else GREEN, 15,
                       bold=(i == 3)))
        body.append(_t(8, y, "%d回目" % (i + 1), GRAY, 10, anchor="start"))
    body.append(_t(134, 214, "4884 は 前から読んでも 後ろから読んでも 同じ", GREEN, 11))
    return _svg(268, 228, "\n".join(body))


# ── HG-1913 5人の線分図（となりとの差が段になっている） ──────────
def _senbun_svg():
    # オルパスを①として ①+22, ①+15, ①+9, ①+4, ① の順に短くなる。
    # 実際の長さ（52,45,39,34,30）に比例させて描く＝図の上で解いても合う
    rows = [("アトム", 52), ("イチゴ", 45), ("ウサギ", 39), ("エンマ", 34), ("オルパス", 30)]
    gaps = [7, 6, 5, 4]
    x0, unit = 74.0, 3.4
    body = []
    for i, (name, n) in enumerate(rows):
        y = 26 + i * 34
        w = n * unit
        body.append('<rect x="%.1f" y="%d" width="%.1f" height="20" rx="3" fill="#eaf0ff" '
                    'stroke="%s" stroke-width="1.6"/>' % (x0, y, w, BLUE))
        body.append(_t(68, y + 15, name, INK, 11, anchor="end"))
        if i < len(gaps):
            nx = x0 + rows[i + 1][1] * unit
            body.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="%s" '
                        'stroke-width="1.2" stroke-dasharray="3 2"/>' % (nx, y, nx, y + 54, ORANGE))
            body.append(_t("%.1f" % ((nx + x0 + w) / 2), y + 33, "%dこ" % gaps[i], ORANGE, 10))
    body.append('<path d="M %.1f 22 q 10 0 10 10 v 46 q 0 10 10 10 q -10 0 -10 10 v 46 q 0 10 -10 10" '
                'fill="none" stroke="%s" stroke-width="1.6"/>' % (x0 + 52 * unit + 8, GRAY))
    body.append(_t(x0 + 52 * unit + 40, 104, "200こ", INK, 13, bold=True))
    return _svg(320, 214, "\n".join(body))


L2 = [
    {
        "id": "hd3n_02_1", "src": "HG-1901", "star": 2,
        "title": "星形の魔方陣（1〜12）", "category": "kazu", "unit": "数の性質",
        "intro": "下の図は、1から12までの整数をそれぞれ一回だけ使って、六角形の星形にならべ、"
                 "一直線にならんだ4つの数の和がすべて等しくなるようにしたものです。"
                 "㋐㋑㋒㋓には、まだ数が入っていません。",
        "svg": _star_svg(),
        "steps": [
            {"question": "一直線にならんだ4つの数の和はいくつですか。", "answer": "26",
             "meaning": "まだ使っていない数は 4・9・11・12 で、合計36です。"
                        "㋒は（和−15）、㋓は（和−17）、㋐は（和−22）、㋑は（和−14）と書けるので、"
                        "4つ足すと（和×4−68）＝36。よって和は26です。"},
            {"question": "㋐（左上）にあてはまる数はいくつですか。", "answer": "4",
             "meaning": "㋐は 7・5・10 とならぶ直線にあるので、26−7−5−10＝4です。"},
            {"question": "㋑（右上）にあてはまる数はいくつですか。", "answer": "12",
             "meaning": "㋑は 3・1・10 とならぶ直線にあるので、26−3−1−10＝12です。"},
            {"question": "㋒（左下）にあてはまる数はいくつですか。", "answer": "11",
             "meaning": "㋒は 6・2・7 とならぶ直線にあるので、26−6−2−7＝11です。"},
            {"question": "㋓（右下）にあてはまる数はいくつですか。", "answer": "9",
             "meaning": "㋓は 6・8・3 とならぶ直線にあるので、26−6−8−3＝9です。"
                        "残りの直線も 4+2+8+12＝26、11+5+1+9＝26 で合っています。"},
        ],
    },
    {
        "id": "hd3n_02_2", "src": "HG-1902", "star": 2,
        "title": "さいころ3こ・うらの積", "category": "kazu", "unit": "数の性質",
        "intro": "さいころは向かい合った面の数の和が7になるようにつくってあります。"
                 "3このさいころを投げたら、出た目の数の積（かけ算のこたえ）が36になりました。"
                 "このとき、うらの面の目の数の積は3しゅるいあります。",
        "svg": "",
        "steps": [
            {"question": "3しゅるいのうち、いちばん小さいものはいくつですか。", "answer": "6",
             "meaning": "目が 1・6・6 のとき。うらは 6・1・1 なので 6×1×1＝6です。"},
            {"question": "3しゅるいのうち、2番目に大きいものはいくつですか。", "answer": "20",
             "meaning": "目が 2・3・6 のとき。うらは 5・4・1 なので 5×4×1＝20です。"},
            {"question": "3しゅるいのうち、いちばん大きいものはいくつですか。", "answer": "48",
             "meaning": "目が 3・3・4 のとき。うらは 4・4・3 なので 4×4×3＝48です。"
                        "36＝6×6×1、6×3×2、4×3×3 の3通りしかないので、答えは3しゅるいです。"
                        "うらの積は「7×7×7−36」のようには計算できません。"
                        "向かい合う面は和が7であって、積には分けられないからです。"},
        ],
    },
    {
        "id": "hd3n_02_3", "src": "HG-1903", "star": 2,
        "title": "まん中の木に赤と青の両方がつく", "category": "tokusan", "unit": "植木算",
        "intro": "下の図のように、AからBまで何本かの木が1列にならんでいます。"
                 "これらの木に、Aからは2本おきに赤ひもをつけ、Bからは3本おきに青ひもをつけたところ、"
                 "ちょうどまん中の木には赤と青のひもがつきました。ただし、木の数は40本以下です。",
        "svg": _trees_svg(),
        "steps": [
            {"question": "「2本おき」につけるとき、赤ひもは何本ごとにつきますか。", "answer": "3",
             "meaning": "2本とばすので、1本目・4本目・7本目…＝3本ごとです。"
                        "「2本おき」を「2本ごと」と読むのが、この問題の第一の関門です。"},
            {"question": "「3本おき」につけるとき、青ひもは何本ごとにつきますか。", "answer": "4",
             "meaning": "3本とばすので4本ごとです。Bから数えて 1本目・5本目・9本目…になります。"},
            {"question": "木は全部で何本ありますか。", "answer": "25",
             "meaning": "木の数を□とすると、まん中は（□＋1）÷2 本目。"
                        "Aの条件から（□−1）÷2 が3の倍数、Bの条件から（□−1）÷2 が4の倍数。"
                        "よって（□−1）÷2 は12の倍数で、□＝25、49、73…。40本以下なので25本です。"
                        "たしかめると まん中は13本目。Aから 1・4・7・10・13 ✓、Bから 25・21・17・13 ✓。"},
        ],
    },
    {
        "id": "hd3n_02_4", "src": "HG-1904", "star": 2,
        "title": "ア〜キ・1から9までの相異なる整数", "category": "baai", "unit": "推理・論理",
        "intro": "ア, イ, ウ, エ, オ, カ, キ は、1から9までの整数のうちのいずれかです。同じ数はありません。"
                 "それらの数には次の関係があります。\n"
                 "〔1〕オ＋キ＝イ　〔2〕ウ＋カ＝ア　〔3〕エ×エ＝ア　〔4〕オ×カ＝イ",
        "svg": "",
        "steps": [
            {"question": "エにあてはまる数はいくつですか。", "answer": "3",
             "meaning": "〔3〕エ×エ＝ア で、1から9でかけて1けたになるのは 1×1・2×2＝4・3×3＝9 だけ。"
                        "エ＝1 だとアも1になって同じ数になるので、エは2か3。"
                        "エ＝2（ア＝4）だと先に進めなくなるので、エ＝3 です。"},
            {"question": "アにあてはまる数はいくつですか。", "answer": "9",
             "meaning": "エ＝3 なので、〔3〕より ア＝3×3＝9 です。"},
            {"question": "カにあてはまる数はいくつですか。", "answer": "4",
             "meaning": "〔4〕オ×カ＝イ と〔1〕オ＋キ＝イ を合わせると オ×カ＝オ＋キ。"
                        "〔2〕ウ＋カ＝9 も使うと、カ＝4・オ＝2 のときだけ全部が別の数になります。"},
            {"question": "オにあてはまる数はいくつですか。", "answer": "2",
             "meaning": "カ＝4 のとき オ×4＝オ＋キ。オ＝2 なら イ＝8、キ＝6 で成り立ちます。"},
            {"question": "ウにあてはまる数はいくつですか。", "answer": "5",
             "meaning": "〔2〕ウ＋カ＝ア より ウ＝9−4＝5 です。"
                        "答えは ア9・イ8・ウ5・エ3・オ2・カ4・キ6 で、7つとも別の数になっています。"},
        ],
    },
    {
        "id": "hd3n_02_5", "src": "HG-1905", "star": 3,
        "title": "積の魔方陣（3つの積がどれも1000）", "category": "kazu", "unit": "数の性質",
        "intro": "右の正方形のアからクまでのところに、100以外のべつべつの8この整数を入れて、"
                 "たて、横、ななめの3この整数をかけると、いずれも1000になるようにします。"
                 "ただし、アはイより小さい数とします。",
        "svg": _magic_svg(),
        "steps": [
            {"question": "エ（まん中）にあてはまる数はいくつですか。", "answer": "10",
             "meaning": "エはたて・横・ななめの3本が通るまん中です。"
                        "その3本の積をかけ合わせると エ×エ×エ＝1000 になるので、エ＝10 です。"
                        "100は上の段のまん中であって、まん中のマスではありません。ここが図の読みどころです。"},
            {"question": "アにあてはまる数はいくつですか。", "answer": "2",
             "meaning": "上の段は ア×100×イ＝1000 なので ア×イ＝10。"
                        "（1, 10）か（2, 5）ですが、1と10はキとエで使うので ア＝2、イ＝5。"
                        "「アはイより小さい」という条件で、2と5の入れかえも決まります。"},
            {"question": "キにあてはまる数はいくつですか。", "answer": "1",
             "meaning": "まん中のたての列は 100×10×キ＝1000 なので キ＝1 です。"},
            {"question": "カにあてはまる数はいくつですか。", "answer": "20",
             "meaning": "ななめの イ×エ×カ＝5×10×カ＝1000 なので カ＝20 です。"},
            {"question": "ウにあてはまる数はいくつですか。", "answer": "25",
             "meaning": "左のたての列は ア×ウ×カ＝2×ウ×20＝1000 なので ウ＝25 です。"
                        "全部そろえると ア2・イ5・ウ25・エ10・オ4・カ20・キ1・ク50 で、8本とも積が1000になります。"},
        ],
    },
    {
        "id": "hd3n_02_6", "src": "HG-1906", "star": 2,
        "title": "さかさまにしてたす（回文数）", "category": "kisoku", "unit": "規則性・数列",
        "intro": "39に、十の位と一の位を入れかえた数93をたすと 39＋93＝132 です。"
                 "この和132に数字をさかさまにならべた231をたすと363となって、"
                 "前から読んでも後ろから読んでも同じならび方の数になります。"
                 "78という数は、右のように4回のたし算でこのような数になります。",
        "svg": _kaibun_svg(),
        "steps": [
            {"question": "547に745をたすといくつですか。", "answer": "1292",
             "meaning": "547＋745＝1292。まだ前から読んでも後ろから読んでも同じにはなりません。"},
            {"question": "547は何回のたし算でこのような数になりますか。", "answer": "3",
             "meaning": "547+745＝1292 → 1292+2921＝4213 → 4213+3124＝7337。3回です。"
                        "けたが増えたら、増えたまま さかさまにするのがきまりです。"},
            {"question": "846は何回のたし算でこのような数になりますか。", "answer": "5",
             "meaning": "846+648＝1494 → 1494+4941＝6435 → 6435+5346＝11781 → "
                        "11781+18711＝30492 → 30492+29403＝59895。5回です。"},
        ],
    },
    {
        "id": "hd3n_02_7", "src": "HG-1907", "star": 1,
        "title": "めがねと虫歯・いずれかだけ", "category": "baai", "unit": "なかま調べ（集合・ベン図）",
        "intro": "ある小学校の3年生123人について、めがねをかけている人と虫歯のある人を調べました。"
                 "めがねをかけている人が56人、虫歯のある人が64人いました。"
                 "また、めがねをかけているか、虫歯があるかいずれかだけの人が90人いました。",
        "svg": "",
        "steps": [
            {"question": "めがねをかけていて、虫歯もある人は何人ですか。", "answer": "15",
             "meaning": "両方の人を□とすると、めがねだけは 56−□、虫歯だけは 64−□。"
                        "「いずれかだけ」はこの2つの合計なので 120−□×2＝90 となり、□＝15人です。"},
            {"question": "めがねをかけているか、虫歯があるかの少なくとも一方にあてはまる人は何人ですか。",
             "answer": "105",
             "meaning": "56＋64では両方の人を2回数えているので、1回分を引いて 56+64−15＝105人です。"
                        "「いずれかだけ」の90人と、この105人はちがう数です。ここが読みどころです。"},
            {"question": "めがねもかけず、虫歯もない人は何人ですか。", "answer": "18",
             "meaning": "123−105＝18人です。"
                        "内わけは めがねだけ41人・虫歯だけ49人・両方15人・どちらもなし18人で、合計123人になります。"},
        ],
    },
    {
        "id": "hd3n_02_8", "src": "HG-1908", "star": 3,
        "title": "4つの数の2つずつの和", "category": "kazu", "unit": "数の性質",
        "intro": "4つの整数ア, イ, ウ, エのうち、1つは偶数で、他の3つは奇数です。"
                 "これらの中から2つずつの和をつくったら、22, 31, 43, 54, 66, 75 となりました。",
        "svg": "",
        "steps": [
            {"question": "3つの奇数の和はいくつですか。", "answer": "71",
             "meaning": "奇数どうしの和は偶数、奇数と偶数の和は奇数です。"
                        "だから偶数の和 22・54・66 の3つが「奇数どうしの和」。"
                        "この3つを足すと、3つの奇数がそれぞれ2回ずつ数えられるので "
                        "142÷2＝71 が3つの奇数の和です。"},
            {"question": "4つの整数の和はいくつですか。", "answer": "97",
             "meaning": "6つの和を全部足すと 291。どの数も3回ずつ出てくるので 291÷3＝97 です。"
                        "4で割ってしまうまちがいに気をつけます。"},
            {"question": "偶数はいくつですか。", "answer": "26",
             "meaning": "97−71＝26 です。"},
            {"question": "もっとも大きい数と、もっとも小さい数との差はいくつですか。", "answer": "44",
             "meaning": "奇数と偶数の和 31・43・75 から26を引くと、3つの奇数は 5・17・49。"
                        "4つの数は 5・17・26・49 で、49−5＝44 です。"
                        "たしかめ 5+17=22、5+26=31、5+49=54、17+26=43、17+49=66、26+49=75 ✓"},
        ],
    },
    {
        "id": "hd3n_02_9", "src": "HG-1909", "star": 3,
        "title": "71×□ − 25×□ の階段", "category": "kazu", "unit": "数の性質",
        "intro": "次のそれぞれの□に、あてはまる整数を書きなさい。"
                 "ただし、□には1以上71以下の整数を入れなさい。\n"
                 "(1) 71×25 − 25×□ ＝ 0　(2) 71×□ − 25×17 ＝ 1\n"
                 "(3) 71×□ − 25×□ ＝ 3　(4) 71×□ − 25×□ ＝ 4　(5) 71×□ − 25×□ ＝ 5",
        "svg": "",
        "steps": [
            {"question": "(1) の□にあてはまる数はいくつですか。", "answer": "71",
             "meaning": "71×25＝25×71 なので□は71です。これが「差を0にする手」になります。"},
            {"question": "(2) の□にあてはまる数はいくつですか。", "answer": "6",
             "meaning": "71×6＝426、25×17＝425 で差は1。これが「差を1にする手」です。"},
            {"question": "(3) の左の□（71にかける数）はいくつですか。", "answer": "18",
             "meaning": "(2)の手を3倍します。6×3＝18、17×3＝51。"
                        "71×18＝1278、25×51＝1275 で差は3です。右の□は51。"},
            {"question": "(4) の左の□（71にかける数）はいくつですか。", "answer": "24",
             "meaning": "(2)の手を4倍します。6×4＝24、17×4＝68。"
                        "71×24＝1704、25×68＝1700 で差は4です。右の□は68。"},
            {"question": "(5) の左の□（71にかける数）はいくつですか。", "answer": "5",
             "meaning": "5倍すると 6×5＝30、17×5＝85 ですが、85は71をこえてしまいます。"
                        "そこで(1)の「差を0にする手」を1回引きます。30−25＝5、85−71＝14。"
                        "71×5＝355、25×14＝350 で差は5。右の□は14です。"
                        "この問題は(1)で道具Aを、(2)で道具Bをもらい、"
                        "(3)(4)はBだけ、(5)でAとBを両方使う、という並びになっています。"},
        ],
    },
]

L3 = [
    {
        "id": "hd3n_03_1", "src": "HG-1911", "star": 2,
        "title": "やりとり算・差は2倍ずつ動く", "category": "tokusan", "unit": "倍数算・やりとり",
        "intro": "いちろうくんは、じろうくんより100まい多くのカードを持っています。"
                 "カードをやりとりすると、2人のまい数のちがいはどうなるでしょうか。",
        "svg": "",
        "steps": [
            {"question": "いちろうくんがじろうくんに45まいあげたとき、2人のまい数のちがいは何まいですか。",
             "answer": "10",
             "meaning": "あげた人は45へり、もらった人は45ふえるので、ちがいは45×2＝90だけちぢみます。"
                        "100−90＝10まい。まだいちろうくんのほうが多いです。"},
            {"question": "いちろうくんがじろうくんに63まいあげたとき、2人のまい数のちがいは何まいですか。",
             "answer": "26",
             "meaning": "63×2＝126 だけちぢみます。100−126＝−26 なので、ちがいは26まい。"
                        "ここで多い人が入れかわります。"},
            {"question": "そのとき、まい数が多いのはどちらですか。",
             "answer": "じろうくん", "choices": ["じろうくん", "いちろうくん"],
             "meaning": "126まいぶんちぢめすぎて追いこしたので、じろうくんのほうが26まい多くなります。"
                        "やりとり算では「どちらが多いか」が途中で入れかわります。"},
            {"question": "じろうくんがいちろうくんに22まいあげたとき、2人のまい数のちがいは何まいですか。",
             "answer": "144",
             "meaning": "こんどは差が広がる向きです。100＋22×2＝144まい。いちろうくんのほうが多いままです。"},
            {"question": "いちろうくんが何まいあげると、2人のまい数が同じになりますか。", "answer": "50",
             "meaning": "差100をちょうど0にするので 100÷2＝50まいです。"},
            {"question": "いちろうくんが何まいあげると、じろうくんのほうが14まい多くなりますか。",
             "answer": "57",
             "meaning": "差を100から −14 まで動かすので、動かす量は114。114÷2＝57まいです。"},
        ],
    },
    {
        "id": "hd3n_03_2", "src": "HG-1912", "star": 1,
        "title": "本のページ数・読み終わる日数の差", "category": "tokusan", "unit": "過不足算・差集め算",
        "intro": "ある本を、毎日8ページずつ読んでいくときと、毎日9ページずつ読んでいくときとでは、"
                 "読み終わるのに3日のちがいがあります。"
                 "ただし、どちらのばあいも、最後の日まで同じページ数ずつ読みました。",
        "svg": "",
        "steps": [
            {"question": "72ページ読むごとに、日数のちがいは何日つきますか。", "answer": "1",
             "meaning": "72ページなら 72÷8＝9日、72÷9＝8日で、ちがいは1日です。"
                        "72は8と9の最小公倍数です。"},
            {"question": "この本は何ページありますか。", "answer": "216",
             "meaning": "72ページごとに1日の差がつくので、3日の差なら 72×3＝216ページです。"
                        "たしかめると 216÷8＝27日、216÷9＝24日で、ちがいは3日 ✓"},
        ],
    },
    {
        "id": "hd3n_03_3", "src": "HG-1913", "star": 2,
        "title": "5人で分けたおはじき（線分図）", "category": "bun", "unit": "和差算・分配算",
        "intro": "200このおはじきを5人で分け合ったようすを、下のような線分図にまとめました。"
                 "となりの人とのちがいが図に書きこんであります。",
        "svg": _senbun_svg(),
        "steps": [
            {"question": "オルパスとアトムのこ数のちがいは何こですか。", "answer": "22",
             "meaning": "となりどうしの差を足していきます。4＋5＋6＋7＝22こです。"
                        "「となりとの差」なので、足し上げないとアトムまで届きません。"},
            {"question": "5人ぶんを、オルパスと同じこ数にそろえると、あまりは何こですか。", "answer": "50",
             "meaning": "エンマは＋4、ウサギは＋9、イチゴは＋15、アトムは＋22 多いので、"
                        "4＋9＋15＋22＝50こです。"},
            {"question": "オルパスがもらったおはじきは何こですか。", "answer": "30",
             "meaning": "200から50を引くと150。これがオルパス5人ぶんなので 150÷5＝30こです。"
                        "たしかめ 30＋34＋39＋45＋52＝200 ✓"},
        ],
    },
    {
        "id": "hd3n_03_4", "src": "HG-1914", "star": 1,
        "title": "正解＋5点・まちがい−3点", "category": "tokusan", "unit": "つるかめ算",
        "intro": "正解すると1題につき5点もらえ、まちがうと3点ひかれるという約そくで、"
                 "算数の問題を100題解いたところ、324点でした。",
        "svg": "",
        "steps": [
            {"question": "1題まちがえると、全部正解のときより何点少なくなりますか。", "answer": "8",
             "meaning": "もらえるはずの5点がなくなり、さらに3点ひかれるので 5＋3＝8点です。"
                        "ここを「3点」と考えるのがいちばん多いまちがいです。"},
            {"question": "まちがえた問題は何題ですか。", "answer": "22",
             "meaning": "全問正解なら 5×100＝500点。実際は324点で176点少ないので 176÷8＝22題です。"},
            {"question": "正解した問題は何題ですか。", "answer": "78",
             "meaning": "100−22＝78題。たしかめ 5×78−3×22＝390−66＝324点 ✓"},
        ],
    },
    {
        "id": "hd3n_03_5", "src": "HG-1915", "star": 2,
        "title": "父母の年れいの和が子ども3人の3倍", "category": "tokusan", "unit": "年齢算",
        "intro": "父は38才、母は34才で、3人の子どもは6才、3才、1才です。",
        "svg": "",
        "steps": [
            {"question": "いま、父と母の年れいの和は何才ですか。", "answer": "72",
             "meaning": "38＋34＝72才です。"},
            {"question": "いま、3人の子どもの年れいの和は何才ですか。", "answer": "10",
             "meaning": "6＋3＋1＝10才です。"},
            {"question": "1年たつと、子ども3人の和の3倍は何ふえますか。", "answer": "9",
             "meaning": "子ども3人の和は1年で3ふえるので、その3倍は 3×3＝9 ふえます。"
                        "父と母は2人なので1年で2しかふえません。だんだん追いつかれます。"},
            {"question": "父と母の年れいの和が、3人の子どもの年れいの和の3倍になるのは今から何年後ですか。",
             "answer": "6",
             "meaning": "□年後に 72＋2×□ ＝ 3×(10＋3×□)。右は 30＋9×□ なので 42＝7×□ で □＝6。"
                        "たしかめ 6年後は 44＋40＝84、子どもは 12＋9＋7＝28、84＝3×28 ✓"},
        ],
    },
    {
        "id": "hd3n_03_6", "src": "HG-1916", "star": 2,
        "title": "同じ額を出して分けた絵葉書の精算", "category": "tokusan", "unit": "平均算",
        "intro": "たろうくんとじろうくんが、どちらも450円ずつ出して絵葉書を20まい買いました。"
                 "じろうくんはたろうくんより何まいか多くとったので、たろうくんに90円はらいました。",
        "svg": "",
        "steps": [
            {"question": "絵葉書1まいのねだんは何円ですか。", "answer": "45",
             "meaning": "2人で 450×2＝900円出して20まい買ったので 900÷20＝45円です。"},
            {"question": "じろうくんがとったぶんの代金は何円ですか。", "answer": "540",
             "meaning": "じろうくんは450円しか出していないのに90円はらいました。"
                        "この90円は足りなかった分なので 450＋90＝540円です。"
                        "90円を「差の半分」と読むとまちがえます。"},
            {"question": "じろうくんは何まいとりましたか。", "answer": "12",
             "meaning": "540÷45＝12まいです。たろうくんは8まいで 8×45＝360円。"
                        "450円出しているので90円もどってきます ✓"},
        ],
    },
    {
        "id": "hd3n_03_7", "src": "HG-1917", "star": 2,
        "title": "50円と90円のえん筆・代金の差", "category": "tokusan", "unit": "つるかめ算",
        "intro": "1本50円のえん筆と1本90円のえん筆を合計30本買いました。"
                 "90円のえん筆の代金のほうが、50円のえん筆の代金より1020円多くなりました。",
        "svg": "",
        "steps": [
            {"question": "30本ぜんぶ90円のえん筆だとすると、代金の差は何円ですか。", "answer": "2700",
             "meaning": "90×30＝2700円で、50円のえん筆は0円。だから差も2700円です。"},
            {"question": "50円のえん筆を1本ふやすと、代金の差は何円ちぢみますか。", "answer": "140",
             "meaning": "90円側が90円へり、50円側が50円ふえるので 90＋50＝140円ちぢみます。"},
            {"question": "50円のえん筆は何本買いましたか。", "answer": "12",
             "meaning": "(2700−1020)÷140＝1680÷140＝12本です。"
                        "たしかめ 50×12＝600円、90×18＝1620円、差は1020円 ✓"},
        ],
    },
    {
        "id": "hd3n_03_8", "src": "HG-1918", "star": 2,
        "title": "チョコとキャラメル・あまりと不足", "category": "tokusan", "unit": "過不足算・差集め算",
        "intro": "合わせて155こあるチョコレートとキャラメルを、クラス全員にくばります。"
                 "チョコレートを2こずつくばると2人分あまり、"
                 "キャラメルを3こずつくばると3人分たりなくなります。",
        "svg": "",
        "steps": [
            {"question": "「2人分あまる」とき、チョコレートは何こあまりますか。", "answer": "4",
             "meaning": "2こずつくばるので、2人分は 2×2＝4こです。"
                        "「2こあまる」ではありません。ここが第一の関門です。"},
            {"question": "「3人分たりない」とき、キャラメルは何こたりませんか。", "answer": "9",
             "meaning": "3こずつくばるので、3人分は 3×3＝9こです。"},
            {"question": "クラスは何人ですか。", "answer": "32",
             "meaning": "人数を□人とすると チョコ＝2×□＋4、キャラメル＝3×□−9。"
                        "合わせて 5×□−5＝155 なので □＝32人です。"},
            {"question": "チョコレートは何こありますか。", "answer": "68",
             "meaning": "2×32＋4＝68こ。キャラメルは 3×32−9＝87こで、合わせて155こ ✓"},
        ],
    },
    {
        "id": "hd3n_03_9", "src": "HG-1919", "star": 3,
        "title": "A・B・Cのこ数を入れかえる", "category": "tokusan", "unit": "消去算",
        "intro": "3つの品物A, B, Cがあり、1このねだんはAが20円、Bが30円、Cが50円です。"
                 "A, B, Cをそれぞれ何こかずつ買って、全部で1980円はらいました。"
                 "もし、AとBのこ数をとりかえて買うと2020円になり、"
                 "AとCのこ数をとりかえて買うと2160円になります。",
        "svg": "",
        "steps": [
            {"question": "AとBのこ数をとりかえると、代金は何円ふえますか。", "answer": "40",
             "meaning": "2020−1980＝40円です。Cのこ数は動かないので、Cはまるごと消えます。"},
            {"question": "Aのこ数はBのこ数より何こ多いですか。", "answer": "4",
             "meaning": "とりかえると代金は (30−20)×(Aのこ数−Bのこ数)＝10×ちがい だけ動きます。"
                        "40÷10＝4こです。"},
            {"question": "Aのこ数はCのこ数より何こ多いですか。", "answer": "6",
             "meaning": "AとCをとりかえると 2160−1980＝180円ふえます。"
                        "(50−20)×ちがい＝30×ちがい なので 180÷30＝6こです。"},
            {"question": "Aは何こ買いましたか。", "answer": "24",
             "meaning": "B＝A−4、C＝A−6 なので 20×A＋30×(A−4)＋50×(A−6)＝1980。"
                        "100×A＝2400 で A＝24こ。B＝20こ、C＝18こ。"
                        "たしかめ 480＋600＋900＝1980 ✓"},
        ],
    },
    {
        "id": "hd3n_03_10", "src": "HG-1920", "star": 2,
        "title": "入園料を値下げしたら合計がふえた", "category": "tokusan", "unit": "消去算",
        "intro": "ある動物園で、100円の入園料を80円に値下げしたところ、"
                 "前の日よりも入園者が200人多くなり、入園料の合計が4000円ふえました。",
        "svg": "",
        "steps": [
            {"question": "ふえた200人がはらった入園料は、合わせて何円ですか。", "answer": "16000",
             "meaning": "80×200＝16000円です。これは合計をふやす向きにはたらきます。"},
            {"question": "前の日からいた人は、1人あたり何円安くなりましたか。", "answer": "20",
             "meaning": "100−80＝20円です。これは合計をへらす向きにはたらきます。"},
            {"question": "前の日の入園者は何人でしたか。", "answer": "600",
             "meaning": "16000円ふえて、値引きぶんだけへって、差し引き4000円ふえました。"
                        "値引きぶんは 16000−4000＝12000円。1人20円なので 12000÷20＝600人です。"
                        "たしかめ 前日 100×600＝60000円、当日 80×800＝64000円で+4000円 ✓"},
        ],
    },
]

# ── HG-1930 24時間表示のデジタル時計 ──────────────────────
def _clock_svg():
    def panel(x, y, s, c=INK, w=124):
        return ('<rect x="%d" y="%d" width="%d" height="34" rx="5" fill="#1a2340" '
                'stroke="%s" stroke-width="1.4"/>' % (x, y, w, GRAY)) + "\n" + \
               _t(x + w // 2, y + 24, s, c, 19, bold=True)

    body = [_t(126, 18, "24時間表示のデジタル時計", GRAY, 11),
            panel(64, 26, "08:57:02", "#ffd166"),
            _t(126, 88, "（1）6この数の合計が3", GRAY, 11),
            panel(64, 96, "10:00:02", GREEN),
            _t(126, 158, "（2）1が4こ以上つづく", GRAY, 11),
            panel(64, 166, "01:11:19", ORANGE)]
    return _svg(252, 212, "\n".join(body))


L4 = [
    {
        "id": "hd3n_04_1", "src": "HG-1921", "star": 2,
        "title": "こう貨でしはらえる金がくの種類", "category": "baai", "unit": "場合の数",
        "intro": "100円玉が2まい、50円玉が1まい、10円玉が4まいあります。"
                 "これらを使ってしはらうことのできる金がくは何通りありますか。",
        "svg": "",
        "steps": [
            {"question": "10円玉だけでしはらえる金がくは、いちばん多くて何円ですか。", "answer": "40",
             "meaning": "10×4＝40円です。50円にとどきません。"},
            {"question": "100円玉・50円玉・10円玉の使う枚数の組み合わせは、全部で何通りですか。",
             "answer": "30",
             "meaning": "100円は0〜2まいで3通り、50円は0〜1まいで2通り、10円は0〜4まいで5通り。"
                        "3×2×5＝30通りです。"},
            {"question": "しはらうことのできる金がくは何通りですか。", "answer": "29",
             "meaning": "10円の最大40円は50円にとどかず、50円の最大50円は100円にとどきません。"
                        "だからくり上がりが起きず、組み合わせと金がくが1対1になります。"
                        "30通りから「0円」を除いて29通りです。"},
        ],
    },
    {
        "id": "hd3n_04_2", "src": "HG-1922", "star": 1,
        "title": "2しゅるいのこう貨でしはらえる金がく", "category": "baai", "unit": "場合の数",
        "intro": "100円玉が3まい、10円玉が7まいあります。"
                 "これらを使ってしはらうことのできる金がくは何通りありますか。",
        "svg": "",
        "steps": [
            {"question": "10円玉だけでしはらえる金がくは、いちばん多くて何円ですか。", "answer": "70",
             "meaning": "10×7＝70円で、100円にとどきません。だから重なりは起きません。"},
            {"question": "しはらうことのできる金がくは何通りですか。", "answer": "31",
             "meaning": "100円は0〜3まいで4通り、10円は0〜7まいで8通り。"
                        "4×8＝32通りから「0円」を除いて31通りです。"},
        ],
    },
    {
        "id": "hd3n_04_3", "src": "HG-1923", "star": 2,
        "title": "250円のしはらい方", "category": "baai", "unit": "場合の数",
        "intro": "100円玉、50円玉、10円玉がたくさんあります。"
                 "これらを使って250円しはらうとき、こう貨の組み合わせ方は何通りありますか。"
                 "ただし、使わないこう貨があってもよいものとします。",
        "svg": "",
        "steps": [
            {"question": "100円玉を使わないとき、しはらい方は何通りですか。", "answer": "6",
             "meaning": "50円玉を0〜5まい使うと、残りは10円玉で決まります。"
                        "(50円0まい・10円25まい)から(50円5まい・10円0まい)までの6通りです。"},
            {"question": "100円玉を1まい使うとき、しはらい方は何通りですか。", "answer": "4",
             "meaning": "残り150円を50円玉0〜3まいで作るので4通りです。"},
            {"question": "しはらい方は全部で何通りですか。", "answer": "12",
             "meaning": "100円玉2まいのときは残り50円で2通り。6＋4＋2＝12通りです。"
                        "大問1・2は「金がくの種類」でしたが、この問題は「金がくを決めて組み合わせの数」。"
                        "同じこう貨の話でも、数えているものが逆です。"},
        ],
    },
    {
        "id": "hd3n_04_4", "src": "HG-1924", "star": 2,
        "title": "3しゅるいのくだものから4こ買う", "category": "baai", "unit": "場合の数",
        "intro": "りんご、みかん、かきの3しゅるいのくだものの中から4このくだものを買うとき、"
                 "買い方は何通りありますか。ただし、買わないくだものがあってもよいものとします。",
        "svg": "",
        "steps": [
            {"question": "りんごを0こ買うとき、みかんとかきの買い方は何通りですか。", "answer": "5",
             "meaning": "みかんを0〜4こ買うと、かきの数は決まります。5通りです。"},
            {"question": "りんごを1こ買うとき、みかんとかきの買い方は何通りですか。", "answer": "4",
             "meaning": "残り3こを2しゅるいに分けるので4通りです。"},
            {"question": "買い方は全部で何通りですか。", "answer": "15",
             "meaning": "りんご0こ→5通り、1こ→4通り、2こ→3通り、3こ→2通り、4こ→1通り。"
                        "5＋4＋3＋2＋1＝15通りです。250円のしはらい方と同じ考え方で解けます。"},
        ],
    },
    {
        "id": "hd3n_04_5", "src": "HG-1925", "star": 2,
        "title": "カード2まいのかけ算の答え", "category": "baai", "unit": "場合の数",
        "intro": "1, 2, 3, 4の数字が書かれたカードが2まいずつ、合計8まいあります。"
                 "このうち2まいを取り出してかけ算をした答えは何通りありますか。",
        "svg": "",
        "steps": [
            {"question": "2まいの取り出し方は何通りですか。", "answer": "10",
             "meaning": "1-1, 1-2, 1-3, 1-4, 2-2, 2-3, 2-4, 3-3, 3-4, 4-4 の10通りです。"
                        "同じ数が2まいずつあるので、1-1 のようなぞろ目も作れます。"},
            {"question": "答えが同じになる組は何組ありますか。", "answer": "1",
             "meaning": "1×4＝4 と 2×2＝4 の1組だけです。ほかに同じ答えになる組はありません。"},
            {"question": "かけ算の答えは何通りですか。", "answer": "9",
             "meaning": "10通りから重なりの1つを引いて9通り。"
                        "答えは 1, 2, 3, 4, 6, 8, 9, 12, 16 です。"},
        ],
    },
    {
        "id": "hd3n_04_6", "src": "HG-1926", "star": 3,
        "title": "九九の表で3回出てくる答え", "category": "kazu", "unit": "数の性質",
        "intro": "九九の表（1×1から9×9まで）の答えの中で、3回登場するものは全部で何しゅるいありますか。",
        "svg": "",
        "steps": [
            {"question": "4は九九の表に何回出てきますか。", "answer": "3",
             "meaning": "1×4、2×2、4×1 の3回です。"
                        "順番を入れかえた組は2回ぶん、同じ数どうし（2×2）は1回ぶんになります。"
                        "だから3回になるのは「平方数で、ほかの組が1組あるもの」です。"},
            {"question": "25は九九の表に何回出てきますか。", "answer": "1",
             "meaning": "5×5 の1回だけです。25＝1×25 は九九の表にありません。"
                        "平方数でも、ほかの組がなければ1回です。"},
            {"question": "3回登場する答えは全部で何しゅるいありますか。", "answer": "4",
             "meaning": "平方数から調べます。4＝2×2 と 1×4／9＝3×3 と 1×9／"
                        "16＝4×4 と 2×8／36＝6×6 と 4×9 の4しゅるいです。"
                        "1・25・49・64・81 は平方数ですがほかの組がないので1回だけです。"},
        ],
    },
    {
        "id": "hd3n_04_7", "src": "HG-1927", "star": 1,
        "title": "5チームの総当たり戦", "category": "baai", "unit": "場合の数",
        "intro": "5チームで野球の試合をします。それぞれのチームが、どのチームとも1回ずつ試合をします。",
        "svg": "",
        "steps": [
            {"question": "1つのチームは何試合しますか。", "answer": "4",
             "meaning": "自分以外の4チームと1回ずつなので4試合です。"},
            {"question": "全部で何試合になりますか。", "answer": "10",
             "meaning": "4試合×5チーム＝20ですが、1試合を2チームが数えているので 20÷2＝10試合です。"
                        "4＋3＋2＋1＝10 と数えても同じです。"},
        ],
    },
    {
        "id": "hd3n_04_8", "src": "HG-1928", "star": 3,
        "title": "三角格子の中の三角形を全部数える", "category": "zu", "unit": "図形の数え上げ",
        "intro": "右の図は、1辺を6等分した正三角形です。"
                 "この中にある三角形を、**大きさ**と**向き**で分けて数えます。",
        "svg": _trigrid_svg(),
        "steps": [
            {"question": "上向き（▲）でいちばん小さい三角形は何こありますか。", "answer": "21",
             "meaning": "上から1段目に1こ、2段目に2こ、…6段目に6こ。"
                        "1＋2＋3＋4＋5＋6＝21こです。"},
            {"question": "上向きの三角形は、大きさ全部で何こありますか。", "answer": "56",
             "meaning": "1辺1が21こ、1辺2が15こ、1辺3が10こ、1辺4が6こ、1辺5が3こ、1辺6が1こ。"
                        "21＋15＋10＋6＋3＋1＝56こです。"},
            {"question": "下向き（▽）でいちばん小さい三角形は何こありますか。", "answer": "15",
             "meaning": "2段目に1こ、3段目に2こ、…6段目に5こ。1＋2＋3＋4＋5＝15こです。"},
            {"question": "下向きの三角形は、大きさ全部で何こありますか。", "answer": "22",
             "meaning": "1辺1が15こ、1辺2が6こ、1辺3が1こで 15＋6＋1＝22こです。"
                        "**1辺4以上の下向きは入りません**。ここが数え落としやすいところです。"},
            {"question": "三角形は全部で何こありますか。", "answer": "78",
             "meaning": "56＋22＝78こです。"
                        "図のマスを1つずつ当てて機械で数え直しても78こでした。"},
        ],
    },
    {
        "id": "hd3n_04_9", "src": "HG-1929", "star": 3,
        "title": "0,1,1,2,3,3 のカードで3けたの整数", "category": "baai", "unit": "場合の数",
        "intro": "0, 1, 1, 2, 3, 3 の6まいのカードから3まいを取り出してならべ、3けたの整数をつくります。"
                 "同じ数字のカードは見分けがつかないものとします。",
        "svg": "",
        "steps": [
            {"question": "3つとも数字がちがい、0を使わないとき（1と2と3）、整数は何こできますか。",
             "answer": "6",
             "meaning": "3つの数のならべ方は 3×2×1＝6通りです。"},
            {"question": "3つとも数字がちがい、0を使うとき（0と◯と△）、整数は全部で何こできますか。",
             "answer": "12",
             "meaning": "{0,1,2}{0,1,3}{0,2,3}の3組。それぞれ 6通りのうち先頭が0の2通りを除いて4こ。"
                        "4×3＝12こです。"},
            {"question": "同じ数字を2つ使うとき（1が2つ、または3が2つ）、整数は全部で何こできますか。",
             "answer": "16",
             "meaning": "「1,1,x」で x が0のときは 3通りのうち先頭0の1通りを除いて2こ、"
                        "x が2・3のときは3こずつ。2＋3＋3＝8こ。"
                        "「3,3,x」も同じで8こ。合わせて16こです。"},
            {"question": "3けたの整数は全部で何こできますか。", "answer": "34",
             "meaning": "6＋12＋16＝34こです。"
                        "「先頭に0が来ない」と「同じ数字がある」の2つの制約が同時にかかるのがこの問題です。"},
        ],
    },
    {
        "id": "hd3n_04_10", "src": "HG-1930", "star": 3,
        "title": "24時間デジタル時計", "category": "baai", "unit": "場合の数",
        "intro": "右の図のような24時間表示のデジタル時計があって、"
                 "00時00分00秒から23時59分59秒まで1秒きざみで時刻を表示します。",
        "svg": _clock_svg(),
        "steps": [
            {"question": "使われている6この数の合計が3である時刻は、1日に何秒ありますか。",
             "answer": "55",
             "meaning": "時の十の位は0〜2、分と秒の十の位は0〜5という上限に気をつけて、"
                        "3を6つのけたに配る配り方を数えます。10:00:02 などで、全部で55通りです。"},
            {"question": "6この数のどこかに1が4こ以上つづく時刻は、1日に何秒ありますか。",
             "answer": "101",
             "meaning": "1111が始まる場所で3つに分けます。"
                        "11時11分（秒は60通り）／時の一の位＋分11＋秒の十の位（3×10＝30通り）／"
                        "11分11秒（時は24通り）。重なりを引いて 60＋30＋24−10−1−3＋1＝101通りです。"
                        "「4こ以上」なので5こ・6こつづく 11:11:11 もふくみます。"},
            {"question": "その時刻は1日に何分何秒ありますか。分のところを答えなさい。", "answer": "1",
             "meaning": "101秒は1分41秒です。ここだけ答えの単位が「分・秒」に変わります。"},
            {"question": "同じく、秒のところを答えなさい。", "answer": "41",
             "meaning": "101−60＝41秒。答えは1分41秒です。"},
        ],
    },
]

# ── HG-1931 10×10の枠タイル（まん中4×4が空） ────────────────
def _waku_svg():
    c, x0, y0 = 20, 24, 20
    body = []
    for r in range(10):
        for col in range(10):
            hole = 3 <= r <= 6 and 3 <= col <= 6
            if hole:
                continue
            body.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#eaf0ff" '
                        'stroke="%s" stroke-width="1"/>' % (x0 + col * c, y0 + r * c, c, c, BLUE))
    body.append(_t(124, 236, "まわりのあつさは 上下左右とも 3ます", GRAY, 11))
    return _svg(248, 248, "\n".join(body))


# ── HG-1932 三角形の枠にならべた〇（1辺19こ・外3列） ───────────
def _tri_circle_svg():
    n, d, r = 19, 14.0, 4.6
    body = []
    for row in range(n):                       # 0..18（上から）
        k = row + 1                            # その段の個数
        for i in range(k):
            # 内側（1辺10この三角形）が空。上から7段目〜16段目の内側3こより内が空
            if 6 <= row <= 15 and 3 <= i <= k - 4:
                continue
            # ★下の段は19こならぶので、はば 18×14＝252 が要る。248だと両はしが切れた（実測 2026-08-09）
            x = 142 + (i - (k - 1) / 2.0) * d
            y = 22 + row * (d * 0.92)
            body.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#eaf0ff" stroke="%s" '
                        'stroke-width="1.1"/>' % (x, y, r, BLUE))
    # ★いちばん下の段は y≈258 まであるので、注記は 274 に置く（268 だと〇に触れた）
    body.append(_t(142, 274, "1辺に19こ・外がわの3列だけ", GRAY, 11))
    return _svg(284, 286, "\n".join(body))


# ── HG-1934 くさりの輪（4こ） ──────────────────────────
def _chain_svg():
    body = []
    for i in range(4):
        y = 24 + i * 44
        body.append('<ellipse cx="96" cy="%d" rx="22" ry="30" fill="none" stroke="%s" '
                    'stroke-width="6"/>' % (y + 30, GRAY))
    body.append('<line x1="150" y1="24" x2="150" y2="30" stroke="%s" stroke-width="1.2"/>' % ORANGE)
    body.append('<line x1="150" y1="24" x2="162" y2="24" stroke="%s" stroke-width="1.2"/>' % ORANGE)
    body.append(_t(178, 30, "1cm（太さ）", ORANGE, 10, anchor="start"))
    body.append('<line x1="140" y1="24" x2="140" y2="84" stroke="%s" stroke-width="1.2" '
                'stroke-dasharray="3 2"/>' % BLUE)
    body.append(_t(178, 60, "8cm（輪1こ）", BLUE, 10, anchor="start"))
    body.append('<line x1="52" y1="24" x2="52" y2="216" stroke="%s" stroke-width="1.4"/>' % RED)
    body.append(_t(40, 124, "ア", RED, 13, anchor="end", bold=True))
    return _svg(268, 232, "\n".join(body))


# ── HG-1935 人文字「NADA」（●は端点で、そこにも1人立つ） ──────────
def _nada_svg():
    body = []

    def seg(x1, y1, x2, y2):
        body.append('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="3" '
                    'stroke-linecap="round"/>' % (x1, y1, x2, y2, BLUE))

    def dot(x, y):
        body.append('<circle cx="%s" cy="%s" r="4.5" fill="%s"/>' % (x, y, RED))
    # N（左たて15m・ななめ20m・右たて15m）
    seg(20, 30, 20, 100); seg(20, 30, 58, 100); seg(58, 30, 58, 100); dot(58, 30)
    body.append(_t(39, 20, "N", INK, 11, bold=True))
    # A（頂点●から左右へ8.5m、横棒8m、脚8.5m）
    for ox in (78, 190):
        seg(ox + 22, 30, ox + 4, 100); seg(ox + 22, 30, ox + 40, 100)
        seg(ox + 11, 74, ox + 33, 74); dot(ox + 22, 30)
        body.append(_t(ox + 22, 20, "A", INK, 11, bold=True))
    # D（たて15m＋右へふくらむ曲線24m。閉じている）
    seg(146, 30, 146, 100); dot(146, 30)
    body.append('<path d="M 146 30 Q 190 65 146 100" fill="none" stroke="%s" stroke-width="3"/>' % BLUE)
    body.append(_t(160, 20, "D", INK, 11, bold=True))
    # ★寸法は文字ごとに書くと4つのラベルが横でぶつかる（実測 2026-08-09）。
    #   問題文にも全部書いてあるので、ここは1行にまとめる
    body.append(_t(124, 124, "N＝50m（ひとつづき）／D＝39m（閉じている）", GRAY, 10))
    body.append(_t(124, 140, "A＝8.5m×4＋横8m（枝分かれ）", GRAY, 10))
    body.append(_t(124, 160, "● のところにも1人立つ。50cmおきに1人", GRAY, 11))
    return _svg(248, 172, "\n".join(body))


# ── HG-1939 円周にならんだ1〜100 ────────────────────────
def _circle100_svg():
    # ★本当の角度（100等分＝3.6°）に置くと 98〜3 の6つが重なって読めない（実測 2026-08-09）。
    #   原簿の図が見せているのは「100のつぎが1にもどる」ところだけなので、
    #   その部分だけを上のほうに広げて置く
    import math as _m
    cx, cy, R = 112.0, 118.0, 74.0
    body = ['<circle cx="%.0f" cy="%.0f" r="%.0f" fill="none" stroke="%s" stroke-width="1.6"/>'
            % (cx, cy, R, GRAY)]
    labs = ["98", "99", "100", "1", "2", "3"]
    for i, s in enumerate(labs):
        deg = 90 + (2.5 - i) * 17          # 上のあたりに 17°おきに広げる
        a = _m.radians(deg)
        x, y = cx + (R + 16) * _m.cos(a), cy - (R + 16) * _m.sin(a)
        c = RED if s in ("1", "3") else INK
        body.append(_t("%.1f" % x, "%.1f" % (y + 4), s, c, 12, bold=(c == RED)))
        px, py = cx + R * _m.cos(a), cy - R * _m.sin(a)
        body.append('<circle cx="%.1f" cy="%.1f" r="2.6" fill="%s"/>' % (px, py, c))
    body.append(_t(112, 122, "1から6とびに〇をつける", GRAY, 11))
    body.append(_t(112, 142, "100のつぎは1にもどる", GRAY, 11))
    body.append(_t(112, 214, "…と円のまわりに100までならんでいる", GRAY, 10))
    return _svg(224, 228, "\n".join(body))


L5 = [
    {
        "id": "hd3n_05_1", "src": "HG-1931", "star": 1,
        "title": "正方形の枠のタイル", "category": "zu", "unit": "平面図形（面積）",
        "intro": "下の図のように、たて10ます・よこ10ますの正方形から、"
                 "まん中の4ます×4ますをくりぬいた形にタイルをならべます。",
        "svg": _waku_svg(),
        "steps": [
            {"question": "くりぬく前の正方形には、タイルは何まいならびますか。", "answer": "100",
             "meaning": "10×10＝100まいです。"},
            {"question": "くりぬいたまん中には、タイルは何まいぶんありますか。", "answer": "16",
             "meaning": "4×4＝16まいぶんです。"},
            {"question": "タイルは何まいありますか。", "answer": "84",
             "meaning": "100−16＝84まいです。"
                        "上の帯30まい＋下の帯30まい＋左右の帯 3×4×2＝24まい と数えても84まいになります。"},
        ],
    },
    {
        "id": "hd3n_05_2", "src": "HG-1932", "star": 2,
        "title": "三角形の枠にならべた〇", "category": "zu", "unit": "平面図形（面積）",
        "intro": "下の図のように、1辺に19こずつ〇をならべた正三角形の形から、"
                 "外がわの3列だけを残して、内がわを空にしました。",
        "svg": _tri_circle_svg(),
        "steps": [
            {"question": "空にする前、〇は全部で何こならびますか。", "answer": "190",
             "meaning": "1＋2＋3＋…＋19＝190こです。"},
            {"question": "空になっている内がわの三角形には、〇が何こぶんありますか。", "answer": "55",
             "meaning": "内がわは1辺10この正三角形なので 1＋2＋…＋10＝55こぶんです。"},
            {"question": "〇は全部で何こありますか。", "answer": "135",
             "meaning": "190−55＝135こです。"
                        "3本の周を足しても同じで、(3×19−3)＋(3×16−3)＋(3×13−3)＝54＋45＋36＝135こ。"
                        "大問1の正方形の枠と、骨はまったく同じです。"},
        ],
    },
    {
        "id": "hd3n_05_3", "src": "HG-1933", "star": 3,
        "title": "外から1周ずつ交ごにとる", "category": "kisoku", "unit": "規則性・数列",
        "intro": "おはじき70こを、たて7こ、よこ10この長方形になるようにならべ、"
                 "AさんとBさんの2人が外がわから1まわりずつ、A, B, A, B と、なくなるまでとっていきました。",
        "svg": "",
        "steps": [
            {"question": "1周目（Aさん）は何こですか。", "answer": "30",
             "meaning": "外周は 2×(7＋10)−4＝30こです。角を2回数えないよう4を引きます。"},
            {"question": "2周目（Bさん）は何こですか。", "answer": "22",
             "meaning": "1周とるとたてもよこも2ずつ減って5×8になるので 2×(5＋8)−4＝22こです。"},
            {"question": "4周目（Bさん）は何こですか。", "answer": "4",
             "meaning": "3周目は3×6で 2×(3＋6)−4＝14こ。4周目はたてが1こだけなので"
                        "「周」ではなく1列になり、1×4＝4こです。"
                        "ここで公式をそのまま使うと 2×(1＋4)−4＝6 となり、合計が70になりません。"},
            {"question": "2人のとったおはじきのこ数のちがいは何こですか。", "answer": "18",
             "meaning": "Aは30＋14＝44こ、Bは22＋4＝26こ。ちがいは18こです。"
                        "合計は 44＋26＝70こで、はじめの数と合っています。"},
        ],
    },
    {
        "id": "hd3n_05_4", "src": "HG-1934", "star": 2,
        "title": "くさりの輪をつなぐ", "category": "tokusan", "unit": "植木算",
        "intro": "右の図のように、同じ大きさの輪が4こつながっています。"
                 "輪の大きさは8cmで、太さは1cmです。",
        "svg": _chain_svg(),
        "steps": [
            {"question": "輪を1こつなぎたすと、全体の長さは何cmふえますか。", "answer": "6",
             "meaning": "つなぐと上下の太さ1cmずつが重なるので 8−1−1＝6cmしかふえません。"},
            {"question": "輪が4このとき、全体の長さ（ア）は何cmですか。", "answer": "26",
             "meaning": "1こ目が8cmで、2こ目からは6cmずつ。8＋6×3＝26cmです。"},
            {"question": "全体の長さを1m以上にするには、輪は全部で何こ必要ですか。", "answer": "17",
             "meaning": "全長は 6×こ数＋2 なので、6×17＋2＝104cmで1m以上。"
                        "16こだと 6×16＋2＝98cmで足りません。1m＝100cmです。"},
            {"question": "そのためには、あと何こつなぎたせばよいですか。", "answer": "13",
             "meaning": "いま4こなので 17−4＝13こつなぎたします。"},
        ],
    },
    {
        "id": "hd3n_05_5", "src": "HG-1935", "star": 3,
        "title": "人文字「NADA」", "category": "tokusan", "unit": "植木算",
        "intro": "文字の線にそって50cmおきに1人ずつ立って、下の図のような人文字「NADA」を作ります。"
                 "ただし、図の●印のところには1人立つものとします。\n"
                 "Nは左のたて棒15m・ななめ20m・右のたて棒15m。"
                 "Aは頂点から左下へ8.5m・右下へ8.5m、その2点を結ぶ横棒8m、さらに左下へ8.5m・右下へ8.5m。"
                 "Dはたて棒15mと、上はしから右にふくらんで下はしにもどる曲線24mで、閉じています。",
        "svg": _nada_svg(),
        "steps": [
            {"question": "Nには何人立ちますか。", "answer": "101",
             "meaning": "15＋20＋15＝50m のひとつながりの折れ線です。"
                        "端が2つあるので 50÷0.5＋1＝101人です。"},
            {"question": "Dには何人立ちますか。", "answer": "78",
             "meaning": "15＋24＝39m で、輪のように閉じています。"
                        "閉じた形には端がないので＋1をせず、39÷0.5＝78人です。"},
            {"question": "Aには何人立ちますか。", "answer": "84",
             "meaning": "頂点1人。左の辺は8.5＋8.5＝17mで34人、右の辺も34人。"
                        "横棒8mは16間かくですが、両はしは辺の人と重なるので内がわの15人。"
                        "1＋34＋34＋15＝84人です。"},
            {"question": "「NADA」全部で何人必要ですか。", "answer": "347",
             "meaning": "101＋84＋78＋84＝347人です。"
                        "この1問に、植木算の3つの型（両はしがある／枝分かれがある／輪になっている）が"
                        "全部入っています。"},
        ],
    },
    {
        "id": "hd3n_05_6", "src": "HG-1936", "star": 2,
        "title": "あきびん3本でジュース1本", "category": "kisoku", "unit": "周期算",
        "intro": "あきびんを3本もっていくと、ジュースが1本もらえる店があります。",
        "svg": "",
        "steps": [
            {"question": "1回交かんすると、あきびんは実さい何本へりますか。", "answer": "2",
             "meaning": "3本わたして1本もらい、それを飲むとまたあきびんが1本できます。"
                        "だから3−1＝2本しかへりません。"},
            {"question": "ジュースを40本買うと、最高で何本飲めますか。", "answer": "59",
             "meaning": "40本飲む→あき40→13本（あまり1）→13本飲む→あき14→4本（あまり2）→"
                        "4本飲む→あき6→2本→あき2で終わり。40＋13＋4＋2＝59本です。"
                        "あきびんは実さい2本ずつへるので 40＋(40−1)÷2＝59 と一気に出せます。"},
            {"question": "ジュースを100本飲むには、最低で何本買えばよいですか。", "answer": "67",
             "meaning": "67本買うと 67＋(67−1)÷2＝67＋33＝100本ちょうど。"
                        "66本だと 66＋32＝98本で足りません。"},
        ],
    },
    {
        "id": "hd3n_05_7", "src": "HG-1937", "star": 3,
        "title": "電車のダイヤ・3本ごとの周期", "category": "kisoku", "unit": "周期算",
        "intro": "各駅にとまる普通電車と、駅をとばして走る急行電車が、"
                 "普通, 急行, 普通, 普通, 急行, …… という順で発車する駅があります。"
                 "発車時こくの間かくは、普通から普通は12分、普通から急行は9分、急行から普通は7分です。"
                 "午前8時ちょうどに急行電車が発車しました。",
        "svg": "",
        "steps": [
            {"question": "急行から次の急行までは何分ですか。", "answer": "28",
             "meaning": "急行→普通が7分、普通→普通が12分、普通→急行が9分。"
                        "7＋12＋9＝28分で1サイクルです。"},
            {"question": "午前10時台に発車する最後の急行は、10時何分ですか。", "answer": "48",
             "meaning": "8:00から28分ごとなので 8:28、8:56、9:24、9:52、10:20、10:48。"
                        "次は11:16なので、10時台の最後の急行は10時48分です。"},
            {"question": "午前10時台の最後の電車は、10時何分ですか。", "answer": "55",
             "meaning": "10:48の急行の次は7分後の10:55（普通）。"
                        "そのまた次は12分後の11:07で11時台に入ります。"
                        "だから10時台の最後は10時55分発の普通電車です。"},
        ],
    },
    {
        "id": "hd3n_05_8", "src": "HG-1938", "star": 2,
        "title": "4円切手と6円切手で250円", "category": "baai", "unit": "場合の数",
        "intro": "4円切手と6円切手をとりまぜて、合計で250円ちょうど買います。"
                 "どちらの切手も1まい以上買うものとします。",
        "svg": "",
        "steps": [
            {"question": "4円切手をできるだけたくさん買うとき、そのまい数は何まいですか。", "answer": "61",
             "meaning": "6円切手を最小の1まいにすると、残り244円が4円切手。244÷4＝61まいです。"},
            {"question": "6円切手をできるだけたくさん買うとき、そのまい数は何まいですか。", "answer": "41",
             "meaning": "4円切手を最小の1まいにすると、残り246円が6円切手。246÷6＝41まいです。"},
            {"question": "買い方は全部で何とおりありますか。", "answer": "21",
             "meaning": "4×a＋6×b＝250 の両辺を2でわると 2×a＋3×b＝125。"
                        "125は奇数なので bは必ず奇数です。"
                        "bは1から41までの奇数なので (41−1)÷2＋1＝21とおりです。"},
        ],
    },
    {
        "id": "hd3n_05_9", "src": "HG-1939", "star": 3,
        "title": "円周の1〜100に6とびで〇", "category": "kisoku", "unit": "周期算",
        "intro": "1から100までの数が、円のまわりに順に書かれています。"
                 "いま、1からはじめて 1, 7, 13, 19, …… と6とびに〇をつけていきます。"
                 "くりかえしまわるときは、前に〇印をつけた数もかんじょうに入れて数えていきます。",
        "svg": _circle100_svg(),
        "steps": [
            {"question": "1周目の最後に〇をつける数はいくつですか。", "answer": "97",
             "meaning": "1、7、13、…と6ずつふえて 97。次は103で100をこえます。"},
            {"question": "2周目のいちばんはじめに〇をつける数はいくつですか。", "answer": "3",
             "meaning": "97の6つ先は103。100をこえたぶんが 103−100＝3 なので、3にもどります。"},
            {"question": "3周目のいちばんはじめに〇をつける数はいくつですか。", "answer": "5",
             "meaning": "同じように2ずつずれていくので5です。1→3→5 と進みます。"},
            {"question": "〇印がつく数は全部で何こありますか。", "answer": "50",
             "meaning": "始まりが 1→3→5→…と2ずつずれ、100と6でわり切れる数が2なので、"
                        "〇がつくのは奇数だけです。1から99までの奇数で50こあります。"},
        ],
    },
]

# ── 第6回（角度）の作図 ────────────────────────────────
# ★角度の図は**実角度で作図する**。そうすると図そのものが検算になる（[[method_svg_check]]）。
#   下の2つは、角度から座標を解いて置いてあるので、分度器で測っても問題文どおりになる。
def _fold_rect_svg():
    """HG-1943 長方形を折る。折り目は下辺と70°、折り返された下辺は下辺と40°"""
    import math as _m
    P = (150.0, 130.0)                      # 折り目が下辺と交わる点
    th = _m.radians(70)
    top = 50.0
    qx = P[0] + (P[1] - top) / _m.tan(th)   # 折り目が上辺と交わる点
    Q = (qx, top)
    fold_len = 70.0
    fa = _m.radians(140)                    # 折り返された下辺の向き（左上へ）
    F = (P[0] + fold_len * _m.cos(fa), P[1] - fold_len * _m.sin(fa))
    body = [
        # もとの長方形（点線＝折る前の位置）
        '<rect x="20" y="%.0f" width="200" height="%.0f" fill="none" stroke="%s" '
        'stroke-width="1.2" stroke-dasharray="4 3"/>' % (top, P[1] - top, GRAY),
        # 折ったあとに残っている部分
        '<path d="M 20 %.0f L %.1f %.0f L %.1f %.1f L 20 %.1f Z" fill="#eaf0ff" stroke="%s" '
        'stroke-width="2"/>' % (top, qx, top, P[0], P[1], P[1], BLUE),
        # 折り目
        '<line x1="%.1f" y1="%.0f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2.4"/>'
        % (qx, top, P[0], P[1], RED),
        # 折り返された下の辺
        '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2.4"/>'
        % (P[0], P[1], F[0], F[1], ORANGE),
        # 40°＝もとの下の辺（左向き）と 折り返された下の辺 の間
        _angle(P, (20.0, P[1]), F, "40°", ORANGE, 26, 42),
        # ㋐＝もとの上の辺（左向き）と 折り目 の間
        _angle(Q, (20.0, top), P, "㋐", RED, 24, 40, 13),
        _t(124, 176, "点線は 折る前の 位置", GRAY, 11),
    ]
    return _svg(248, 190, "\n".join(body))


def _fold_tri_svg():
    """HG-1944 三角形ABCを ア-イ で折り、頂点AをBC上にのせる。B=40°, C=60°, ウ=20°"""
    B, C = (30.0, 150.0), (230.0, 150.0)
    A = (164.7, 36.9)
    Ad = (123.6, 150.0)          # 折ったあとのA（BC上）
    a_ = (111.5, 81.5)           # ア（AB上）
    i_ = (211.5, 118.0)          # イ（AC上）
    L = lambda p, q, c, w=2: ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                              'stroke-width="%s"/>' % (p[0], p[1], q[0], q[1], c, w))
    body = [
        '<path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f Z" fill="none" stroke="%s" '
        'stroke-width="1.2" stroke-dasharray="4 3"/>' % (B[0], B[1], A[0], A[1], C[0], C[1], GRAY),
        # 折ったあとの形（B—ア—A'—イ—C）
        '<path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f Z" '
        'fill="#eaf0ff" stroke="%s" stroke-width="2"/>'
        % (B[0], B[1], a_[0], a_[1], Ad[0], Ad[1], i_[0], i_[1], C[0], C[1], BLUE),
        L(a_, i_, RED, 2.4),          # 折り目 ア—イ
        L(a_, Ad, ORANGE, 2.2), L(i_, Ad, ORANGE, 2.2),
        _t(B[0] - 10, B[1] + 14, "B", INK, 12, bold=True),
        _t(C[0] + 10, C[1] + 14, "C", INK, 12, bold=True),
        _t(A[0] + 6, A[1] - 6, "A（もとの位置）", GRAY, 10, anchor="start"),
        _t(a_[0] - 14, a_[1], "ア", RED, 12, bold=True),
        _t(i_[0] + 14, i_[1], "イ", RED, 12, bold=True),
        _t(Ad[0], Ad[1] + 16, "A", ORANGE, 12, bold=True),
        _angle(B, C, a_, "40°", GRAY, 26, 42, 11),
        _angle(C, i_, B, "60°", GRAY, 26, 42, 11),
        _angle(Ad, B, a_, "x", BLUE, 20, 34, 13),        # A'で BA' と A'ア の間
        _angle(Ad, i_, C, "20°", ORANGE, 26, 44, 11),    # A'で A'イ と A'C の間
        _angle(i_, a_, Ad, "y", BLUE, 18, 32, 13),       # イで イア と イA' の間
        _t(130, 186, "点線は 折る前の 三角形ABC", GRAY, 11),
    ]
    return _svg(266, 200, "\n".join(body))


def _star7_svg():
    """HG-1945 三角形と四角形が重なった形。7つの角に記号"""
    tri = [(124.0, 24.0), (30.0, 158.0), (222.0, 120.0)]        # ア・ウ・カ
    quad = [(46.0, 62.0), (206.0, 46.0), (188.0, 176.0), (66.0, 150.0)]  # イ・キ・オ・エ
    body = [
        '<polygon points="%s" fill="rgba(79,124,255,0.12)" stroke="%s" stroke-width="2"/>'
        % (" ".join("%.0f,%.0f" % p for p in tri), BLUE),
        '<polygon points="%s" fill="rgba(255,154,68,0.12)" stroke="%s" stroke-width="2"/>'
        % (" ".join("%.0f,%.0f" % p for p in quad), ORANGE),
    ]
    # ★弧はその図形の**内角**に描く。どの角がどちらの図形のものかが、これで一目でわかる
    for i, s in enumerate(("ア", "ウ", "カ")):
        body.append(_angle(tri[i], tri[(i + 1) % 3], tri[(i + 2) % 3], s, BLUE, 22, 38, 13))
    for i, s in enumerate(("イ", "キ", "オ", "エ")):
        body.append(_angle(quad[i], quad[(i - 1) % 4], quad[(i + 1) % 4], s, ORANGE, 22, 38, 13))
    body.append(_t(126, 204, "青＝三角形の角／オレンジ＝四角形の角", GRAY, 11))
    return _svg(252, 216, "\n".join(body))


L6 = [
    {
        "id": "hd3n_06_1", "src": "HG-1943", "star": 2,
        "title": "長方形の紙を折る", "category": "zu", "unit": "平面図形（角度）",
        "intro": "右の図のように長方形の紙を折りました。点線は折る前の位置です。"
                 "折り返された下の辺は、もとの下の辺と40°をなしています。"
                 "角㋐（もとの上の辺と折り目がつくる角）は何度ですか。",
        "svg": _fold_rect_svg(),
        "steps": [
            {"question": "折り目と下の辺がつくる角を□度とすると、折り返された下の辺は何度回りますか。",
             "answer": "2",
             "meaning": "折り返しは折り目をはさんだ線対称なので、辺は折り目をこえて同じ角だけ回ります。"
                        "だからもとの向きから見ると□の2倍だけ回ります。□×2 の「2」が答えです。"},
            {"question": "折り目と下の辺がつくる角は何度ですか。", "answer": "70",
             "meaning": "もとの下の辺と折り返された下の辺のなす角が40°なので、"
                        "180−□×2＝40。□＝70°です。"},
            {"question": "角㋐は何度ですか。", "answer": "70",
             "meaning": "長方形の上の辺と下の辺は平行なので、錯角で㋐＝70°です。"
                        "「折り目の角」を聞かれたら（180−与えられた角）÷2、"
                        "「折り返された辺の角」を聞かれたら 180−折り目の角×2 になります。"},
        ],
    },
    {
        "id": "hd3n_06_2", "src": "HG-1944", "star": 3,
        "title": "三角形の紙を折って頂点を辺の上にのせる", "category": "zu", "unit": "平面図形（角度）",
        "intro": "三角形の紙ABCを、右の図のようにア−イのところで折ったら、"
                 "頂点AがちょうどBC上にきて、ウの角が20°になりました。"
                 "Bの角は40°、Cの角は60°です。角xと角yの大きさをもとめなさい。",
        "svg": _fold_tri_svg(),
        "steps": [
            {"question": "もとの三角形の頂点Aの角は何度ですか。", "answer": "80",
             "meaning": "180−40−60＝80°です。この80°は図に書かれていませんが、"
                        "この問題の中心になります。"},
            {"question": "折ったあと、BC上にきた点Aのところの角（アAとイAの間）は何度ですか。",
             "answer": "80",
             "meaning": "折り返しても角の大きさは変わらないので、そのまま80°が写ります。"},
            {"question": "角xは何度ですか。", "answer": "80",
             "meaning": "BCは直線なので、その上にならぶ x と 80° と 20° をたすと180°。"
                        "x＝180−80−20＝80°です。"},
            {"question": "角yは何度ですか。", "answer": "40",
             "meaning": "イは辺AC上にあるので、イのまわりの角をたすと180°。"
                        "折り返しでイのところの2つの角は等しいので、それぞれをyとすると "
                        "y＋y＋（Cのほうへ向かう角100°）＝180。y×2＝80 で y＝40°です。"},
        ],
    },
    {
        "id": "hd3n_06_3", "src": "HG-1945", "star": 3,
        "title": "重なった三角形と四角形・7つの角の和", "category": "zu", "unit": "平面図形（角度）",
        "intro": "右の図で、三角形と四角形が重なって星のような形になっています。"
                 "角ア, 角イ, 角ウ, 角エ, 角オ, 角カ, 角キ の大きさの和は何度ですか。",
        "svg": _star7_svg(),
        "steps": [
            {"question": "ア・ウ・カの3つの角の和は何度ですか。", "answer": "180",
             "meaning": "この3つは三角形の3つの頂点の角なので、和は180°です。"
                        "重なっていても、三角形の内角であることは変わりません。"},
            {"question": "イ・キ・オ・エの4つの角の和は何度ですか。", "answer": "360",
             "meaning": "この4つは四角形の4つの頂点の角なので、和は360°です。"},
            {"question": "7つの角の和は何度ですか。", "answer": "540",
             "meaning": "180＋360＝540°です。"
                        "記号が7つあるので七角形の内角の和（900°）と答えたくなりますが、"
                        "7つの角は三角形の3つと四角形の4つに分かれています。"
                        "重なりは答えにまったく関係ありません。"},
        ],
    },
]

def _daikei_svg():
    """HG-1946 台形ABCD（AD∥BC・AD=CD・AC=BC・∠ACD=28°）"""
    B, C = (30.0, 144.0), (230.0, 144.0)
    A, D = (53.4, 50.1), (166.7, 50.1)
    L = lambda p, q, c, w=2: ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                              'stroke-width="%s"/>' % (p[0], p[1], q[0], q[1], c, w))
    body = ['<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="#eaf0ff" '
            'stroke="%s" stroke-width="2"/>' % (A[0], A[1], D[0], D[1], C[0], C[1], B[0], B[1], BLUE),
            L(A, C, RED, 2.2)]
    for p, s, dx, dy in ((A, "A", -14, -4), (D, "D", 12, -4), (B, "B", -14, 14), (C, "C", 14, 14)):
        body.append(_t(p[0] + dx, p[1] + dy, s, INK, 12, bold=True))
    # ★等しい辺のしるし（／や＝）は入れない。文字として置くと辺の上に乗らず、
    #   図と関係のない線が浮いているように見えた（本人指摘 2026-08-09）。
    #   等しいことは問題文と下の一行で言えばよい
    body.append(_angle(C, A, D, "28°", RED, 26, 44))          # Cで CA と CD の間
    body.append(_angle(B, C, A, "x", BLUE, 24, 40, 13))       # Bで BC と BA の間
    body.append(_t(130, 178, "AD と BC は平行。AD＝CD、AC＝BC", GRAY, 11))
    return _svg(266, 192, "\n".join(body))


def _seisankaku2_svg():
    """HG-1948 正三角形ABCとADE。CはED上。∠ACE=80° → x=∠BAD=40°, y=∠DBC=20°"""
    # ★左はしのEのラベルが枠から3.2px出ていたので、図ぜんぶを右へ10ずらした（実測 2026-08-09）。
    #   相対位置は変えていないので角度も長さもそのまま
    E, D, C = (30.0, 40.0), (130.0, 40.0), (95.3, 40.0)
    A, B = (80.0, 126.6), (162.7, 96.6)
    L = lambda p, q, c, w=2: ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                              'stroke-width="%s"/>' % (p[0], p[1], q[0], q[1], c, w))
    body = ['<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="rgba(79,124,255,0.12)" '
            'stroke="%s" stroke-width="2"/>' % (A[0], A[1], B[0], B[1], C[0], C[1], BLUE),
            '<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="rgba(255,154,68,0.12)" '
            'stroke="%s" stroke-width="2"/>' % (A[0], A[1], D[0], D[1], E[0], E[1], ORANGE),
            L(A, C, GRAY, 1.4), L(B, D, GRAY, 1.4)]
    for p, s, dx, dy in ((A, "A", -14, 8), (B, "B", 14, 8), (C, "C", 0, -10),
                         (D, "D", 14, -4), (E, "E", -14, -4)):
        body.append(_t(p[0] + dx, p[1] + dy, s, INK, 12, bold=True))
    body.append(_angle(C, A, E, "80°", RED, 22, 38, 11))      # Cで CA と CE の間
    body.append(_angle(A, B, D, "x", BLUE, 26, 42, 13))       # Aで AB と AD の間
    body.append(_angle(B, D, C, "y", BLUE, 20, 34, 13))       # Bで BD と BC の間
    body.append(_t(106, 168, "どちらも正三角形。点Cは辺ED上にある", GRAY, 11))
    return _svg(216, 182, "\n".join(body))


def _en_seigokaku_svg():
    """HG-1949 同じ円に内接する正方形と正五角形（上の頂点を共有）"""
    import math as _m
    O, R = (132.0, 132.0), 96.0
    P = lambda deg: (O[0] + R * _m.cos(_m.radians(deg)), O[1] - R * _m.sin(_m.radians(deg)))
    pen = [P(90), P(18), P(-54), P(-126), P(162)]
    sq = [P(90), P(0), P(-90), P(180)]

    def cross(p1, p2, p3, p4):
        d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
        t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
        return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))

    a = cross(sq[3], sq[0], pen[4], pen[3])      # （あ）正方形の辺と正五角形の辺
    i = cross(O, pen[3], sq[3], sq[2])           # （い）中心からの点線と正方形の辺
    body = ['<circle cx="%.0f" cy="%.0f" r="%.0f" fill="none" stroke="%s" stroke-width="1.4"/>'
            % (O[0], O[1], R, GRAY),
            '<polygon points="%s" fill="none" stroke="%s" stroke-width="2"/>'
            % (" ".join("%.1f,%.1f" % p for p in sq), BLUE),
            '<polygon points="%s" fill="none" stroke="%s" stroke-width="2"/>'
            % (" ".join("%.1f,%.1f" % p for p in pen), ORANGE),
            '<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.4" '
            'stroke-dasharray="4 3"/>' % (O[0], O[1], pen[3][0], pen[3][1], GREEN),
            '<circle cx="%.0f" cy="%.0f" r="3" fill="%s"/>' % (O[0], O[1], INK),
            _t(O[0] + 12, O[1] + 5, "O", INK, 11, bold=True),
            # （あ）＝正方形の辺（上の頂点のほう）と 正五角形の辺（左下の頂点のほう）の間＝右に開いた側
            # ★ラベルを遠くに置くと（あ）と（い）が中央で近づいてしまう。弧のすぐ外に置く
            _angle(a, sq[0], pen[3], "あ", RED, 18, 28),
            # （い）＝中心Oへ向かう点線と 正方形の辺（左の頂点のほう）の間＝**上に開いた側**
            _angle(i, O, sq[3], "い", RED, 18, 28),
            _t(132, 254, "青＝正方形／オレンジ＝正五角形（上の頂点は同じ）", GRAY, 11)]
    return _svg(264, 268, "\n".join(body))


def _nitohen_svg():
    """HG-1950 AB＝DE・AC＝CD の二等辺の連鎖。B・C・Dは一直線、EはAC上"""
    B, C, D = (24.0, 150.0), (134.0, 150.0), (244.0, 150.0)
    A, E = (111.1, 42.4), (120.6, 87.1)
    L = lambda p, q, c, w=2: ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                              'stroke-width="%s"/>' % (p[0], p[1], q[0], q[1], c, w))
    body = [L(B, D, INK, 2), L(A, B, BLUE, 2), L(A, C, BLUE, 2), L(E, D, ORANGE, 2)]
    # ★Eのラベルを左に置くと 51°の弧のラベルとぶつかる。右下へ逃がす
    for p, s, dx, dy in ((A, "A", 0, -10), (B, "B", -14, 14), (C, "C", 0, 16),
                         (D, "D", 14, 14), (E, "E", 14, 6)):
        body.append(_t(p[0] + dx, p[1] + dy, s, INK, 12, bold=True))
    body.append(_angle(A, B, E, "51°", RED, 24, 36, 11))      # Aで AB と AE の間
    body.append(_angle(D, E, C, "27°", ORANGE, 30, 48, 11))   # Dで DE と DC の間
    body.append(_angle(B, A, C, "あ", BLUE, 26, 42, 13))       # Bで BA と BC の間
    body.append(_t(134, 186, "AB＝DE・AC＝CD。B・C・Dは一直線、EはAC上", GRAY, 10))
    return _svg(272, 198, "\n".join(body))


L6 += [
    {
        "id": "hd3n_06_4", "src": "HG-1946", "star": 3,
        "title": "台形と2組の等しい辺", "category": "zu", "unit": "平面図形（角度）",
        "intro": "右の図で、四角形ABCDは台形で、ADとCDの長さが等しく、"
                 "また、ACとBCの長さも等しくなっています。ADとBCは平行です。"
                 "∠ACD（対角線ACと辺CDの間の角）は28°です。xの角の大きさをもとめなさい。",
        "svg": _daikei_svg(),
        "steps": [
            {"question": "∠DAC（辺ADと対角線ACの間の角）は何度ですか。", "answer": "28",
             "meaning": "AD＝CD なので三角形ACDは二等辺三角形。"
                        "等しい辺の向かい合う角は等しいので ∠DAC＝∠DCA＝28°です。"},
            {"question": "∠ACB（対角線ACと辺BCの間の角）は何度ですか。", "answer": "28",
             "meaning": "AD∥BC なので、∠DAC と ∠ACB は錯角。28°がそのまま移ります。"
                        "28°という数字が図の中を渡り歩くのがこの問題です。"},
            {"question": "xは何度ですか。", "answer": "76",
             "meaning": "AC＝BC なので三角形ABCも二等辺三角形。∠BAC＝∠ABC＝x です。"
                        "三角形の内角の和から x＋x＋28＝180 で x＝76°。"
                        "たしかめ 四角形の内角の和は 104＋124＋56＋76＝360° ✓"},
        ],
    },
    {
        "id": "hd3n_06_5", "src": "HG-1948", "star": 3,
        "title": "正三角形2つ・回転して重なる", "category": "zu", "unit": "平面図形（角度）",
        "intro": "右の図で、三角形ABCと三角形ADEはどちらも正三角形で、点Cは辺ED上にあります。"
                 "∠ACE（Cで、CAとCEの間の角）は80°です。xとyの大きさをもとめなさい。",
        "svg": _seisankaku2_svg(),
        "steps": [
            {"question": "∠EAC（Aで、AEとACの間の角）は何度ですか。", "answer": "40",
             "meaning": "三角形ADEは正三角形なので ∠AEC＝60°。"
                        "三角形ACEの内角の和から 180−60−80＝40°です。"},
            {"question": "∠CAD（Aで、ACとADの間の角）は何度ですか。", "answer": "20",
             "meaning": "∠EAD＝60°（正三角形）なので、60−40＝20°です。"},
            {"question": "xは何度ですか。", "answer": "40",
             "meaning": "x＝∠BAD。∠BAC＝60°（正三角形）なので 60−20＝40°です。"},
            {"question": "yは何度ですか。", "answer": "20",
             "meaning": "AB＝AC、AD＝AE、∠BAD＝∠CAE＝40° なので、"
                        "三角形ABDと三角形ACEはぴったり重なります（回転させると重なる形）。"
                        "だから ∠ABD＝∠ACE＝80°。∠ABC＝60°なので y＝80−60＝20°です。"},
        ],
    },
    {
        "id": "hd3n_06_6", "src": "HG-1949", "star": 3,
        "title": "同じ円にかいた正方形と正五角形", "category": "zu", "unit": "平面図形（角度）",
        "intro": "右の図は、同じ円に正方形と正五角形をかいたものです。点Oは円の中心で、"
                 "正方形と正五角形は円のいちばん上の頂点を共有しています。"
                 "点線は、中心Oから正五角形の左下の頂点へ引いた線です。"
                 "角（あ）と角（い）の大きさをもとめなさい。",
        "svg": _en_seigokaku_svg(),
        "steps": [
            {"question": "円のまわりを正五角形は何度ずつに分けますか。", "answer": "72",
             "meaning": "360÷5＝72°ずつです。正方形は 360÷4＝90°ずつに分けます。"},
            {"question": "上の共有した頂点から見て、正五角形の頂点と正方形の頂点のずれは何度ですか。",
             "answer": "18",
             "meaning": "90−72＝18°です。この18°が、この問題の答えを全部つくります。"},
            {"question": "角（あ）は何度ですか。", "answer": "117",
             "meaning": "（あ）は2本の弦が交わってできる角なので、"
                        "向かい合う2つの弧の大きさの和の半分になります。"
                        "(18＋216)÷2＝117°です。"},
            {"question": "角（い）は何度ですか。", "answer": "81",
             "meaning": "中心Oから正五角形の頂点へ引いた線は、その頂点の内角108°を半分に分けます。"
                        "中心のがわの角は54°。正方形の対角線の向きは45°。"
                        "三角形の内角の和から 180−54−45＝81°です。"},
        ],
    },
    {
        "id": "hd3n_06_7", "src": "HG-1950", "star": 3,
        "title": "二等辺の連鎖（使わない数字がある）", "category": "zu", "unit": "平面図形（角度）",
        "intro": "右の図で、点Cは直線BD上にあり、点Eは辺AC上にあります。"
                 "辺ABの長さは辺DEの長さに等しく、辺ACの長さは辺CDの長さに等しくなっています。"
                 "∠BAE＝51°、∠EDC＝27°です。角（あ）＝∠ABC の大きさをもとめなさい。",
        "svg": _nitohen_svg(),
        "steps": [
            {"question": "（あ）が51°だとすると、∠ACBは何度になりますか。", "answer": "78",
             "meaning": "点EはAC上にあるので ∠BAC＝∠BAE＝51°。"
                        "三角形ABCの内角の和から 180−51−51＝78°です。"},
            {"question": "そのとき、三角形ABCはどんな三角形ですか。",
             "answer": "二等辺三角形", "choices": ["二等辺三角形", "正三角形", "直角三角形"],
             "meaning": "∠BAC＝∠ABC＝51°なので、その向かい合う辺 BC と AC が等しくなります。"
                        "AC＝CD もあるので、CはBDのまん中の点になります。"},
            {"question": "角（あ）は何度ですか。", "answer": "51",
             "meaning": "AC＝CD で CがBDのまん中にあるとき、AB＝DE がちょうど成り立ちます。"
                        "だから（あ）＝51°。∠BAE と同じ大きさです。"
                        "この問題では27°を一度も使いません。使わない数字がまざっているのがこの問題のしかけです。"},
        ],
    },
]

def _zigzag_svg():
    """HG-1947 AB∥EF・CB∥ED。㋐−㋑＝16°、㋒＝150° から ㋓＝14°

    ★この問題は**個々の角が1つも決まらない**（差だけで決まる）。
      だから図をかくには、条件を満たす値を自分で選ぶ必要がある。ここでは
        AF＝水平から40°下／CD＝10°下（この差30°で ㋒＝150°）
        CB＝ED＝水平から14°上（＝㋓）
      と置いた。すると ㋐＝40°、㋑＝24°、㋐−㋑＝16° が自動で成り立つ。
    """
    A, B = (42.0, 30.0), (252.4, 30.0)
    C, D = (52.0, 80.0), (224.4, 110.4)
    E, F = (25.6, 160.0), (196.9, 160.0)
    L = lambda p, q, c, w=2: ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                              'stroke-width="%s"/>' % (p[0], p[1], q[0], q[1], c, w))
    body = [L(A, B, BLUE), L(E, F, BLUE), L(C, B, GREEN), L(E, D, GREEN),
            L(A, F, ORANGE), L(C, D, ORANGE)]
    for p, s, dx, dy in ((A, "A", -12, 0), (B, "B", 12, 0), (C, "C", -12, 4),
                         (D, "D", 12, 4), (E, "E", -12, 6), (F, "F", 12, 6)):
        body.append(_t(p[0] + dx, p[1] + dy, s, INK, 12, bold=True))
    body.append(_angle(A, B, F, "㋐", RED, 26, 42, 12))       # Aで AB と AF の間
    body.append(_angle(C, B, D, "㋑", RED, 24, 40, 12))       # Cで CB と CD の間
    # ㋒＝AFとCDの交点の鈍角側
    X = (114.8, 91.1)
    body.append(_angle(X, A, D, "150°", ORANGE, 22, 40, 11))
    body.append(_angle(E, D, F, "㋓", BLUE, 26, 44, 12))      # Eで ED と EF の間
    body.append(_t(140, 184, "AB と EF は平行。CB と ED も平行", GRAY, 11))
    return _svg(280, 196, "\n".join(body))


L6.append({
    "id": "hd3n_06_8", "src": "HG-1947", "star": 3,
    "title": "2組の平行線とジグザグ（差だけで決まる）", "category": "zu", "unit": "平面図形（角度）",
    "intro": "右の図で、ABとEFは平行、CBとEDも平行です。"
             "角㋐の大きさは角㋑の大きさより16°大きく、角㋒の大きさは150°です。"
             "角㋓の大きさは何度ですか。",
    "svg": _zigzag_svg(),
    "steps": [
        {"question": "AFとCDが交わってできる角のうち、150°でないほうは何度ですか。", "answer": "30",
         "meaning": "一直線は180°なので 180−150＝30°です。"
                    "これはAFとCDの向きのちがいそのものです。"},
        {"question": "角㋓は何度ですか。", "answer": "14",
         "meaning": "ABとEFが平行、CBとEDが平行なので、"
                    "AFとCDの向きのちがい（30°）が「㋐と㋑のちがい」と「㋓」に分かれます。"
                    "㋓＝30−16＝14°です。"
                    "この問題は㋐も㋑も㋓以外は1つも決まりません。"
                    "それでも**ちがいだけ**で答えが出ます。"},
    ],
})

def _kihon1_svg():
    """HG-1941 ①直角二等辺（x=45°）と ③合同な2つの三角形（x=50°）"""
    P = lambda x, y: (x, y)
    body = []
    # ① 直角二等辺三角形。左の辺と下の辺が等しく、左下が直角
    # ★左の寸法は anchor=end なので、図を左はしに置くと枠から出る（実測 2026-08-09）
    a, b, c = P(52, 116), P(52, 46), P(122, 116)     # 左下（直角）・上・右下
    body.append('<polygon points="%d,%d %d,%d %d,%d" fill="#eaf0ff" stroke="%s" '
                'stroke-width="2"/>' % (a[0], a[1], b[0], b[1], c[0], c[1], BLUE))
    body.append('<path d="M 52 104 L 64 104 L 64 116" fill="none" stroke="%s" stroke-width="1.4"/>' % GRAY)
    body.append(_t(44, 86, "5cm", GRAY, 10, anchor="end"))
    body.append(_t(87, 132, "5cm", GRAY, 10))
    body.append(_angle(b, a, c, "x", RED, 22, 38, 13))
    body.append(_t(87, 26, "①", INK, 12, bold=True))
    # ③ 四角形 ABCD。AB＝CD、BC＝DA。対角線BD。∠A＝60°、∠BDC＝70° → x＝∠DBC＝50°
    o = 180.0
    A, B, C, D = P(o + 30, 120), P(o + 65, 59.4), P(o + 150.8, 59.4), P(o + 115.8, 120)
    body.append('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="#eaf0ff" '
                'stroke="%s" stroke-width="2"/>'
                % (A[0], A[1], B[0], B[1], C[0], C[1], D[0], D[1], BLUE))
    body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2"/>'
                % (B[0], B[1], D[0], D[1], RED))
    for p, s, dx, dy in ((A, "A", -12, 6), (B, "B", -10, -6), (C, "C", 12, -6), (D, "D", 10, 16)):
        body.append(_t(p[0] + dx, p[1] + dy, s, INK, 11, bold=True))
    body.append(_angle(A, B, D, "60°", ORANGE, 24, 40, 10))
    # ★70°（Dのところ）と x（Bのところ）は対角線BDをはさんで向かい合うので、
    #   ラベルを遠くに置くとたがいに近づく。半径を小さくして離す（実測 2026-08-09）
    body.append(_angle(D, B, C, "70°", ORANGE, 20, 32, 10))
    body.append(_angle(B, D, C, "x", RED, 20, 30, 13))
    body.append(_t(o + 90, 26, "③", INK, 12, bold=True))
    body.append(_t(o + 90, 150, "AB＝CD、BC＝DA", GRAY, 10))
    return _svg(376, 164, "\n".join(body))


def _kihon2_svg():
    """HG-1942 ①30°（斜辺が2倍）②75°（長方形の中の2直線）③32°（円）"""
    import math as _m
    body = []
    # ① 左の辺4cm・斜辺8cm・左下が直角。x は右下
    a, b, c = (52.0, 116.0), (52.0, 76.0), (121.3, 116.0)
    body.append('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="#eaf0ff" stroke="%s" '
                'stroke-width="2"/>' % (a[0], a[1], b[0], b[1], c[0], c[1], BLUE))
    body.append('<path d="M 52 104 L 64 104 L 64 116" fill="none" stroke="%s" stroke-width="1.4"/>' % GRAY)
    body.append(_t(44, 98, "4cm", GRAY, 10, anchor="end"))
    body.append(_t(94, 88, "8cm", GRAY, 10))
    body.append(_angle(c, b, a, "x", RED, 22, 38, 13))
    body.append(_t(86, 26, "①", INK, 12, bold=True))
    # ② 長方形の中に2本の直線。交点の左下が105°、x は ゆるい線と右の辺
    o = 158.0
    body.append('<rect x="%.0f" y="36" width="120" height="80" fill="none" stroke="%s" '
                'stroke-width="2"/>' % (o, BLUE))
    s1, e1 = (o + 30, 36.0), (o + 76.2, 116.0)          # 急な線（水平から60°下）
    s2, e2 = (o, 96.0), (o + 120, 63.8)                 # ゆるい線（水平から15°上）
    X = (o + 55.98, 81.0)
    for s, e in ((s1, e1), (s2, e2)):
        body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.8"/>'
                    % (s[0], s[1], e[0], e[1], ORANGE))
    body.append(_angle(s1, (o + 120, 36.0), e1, "60°", GRAY, 20, 34, 10))
    body.append(_angle(X, s2, e1, "105°", GRAY, 20, 36, 10))
    # ★xは右の辺の**下向き**とのなす角（上向きだと105°になってしまう。実測で気づいた）
    body.append(_angle(e2, X, (o + 120, 116.0), "x", RED, 18, 32, 13))
    body.append(_t(o + 60, 26, "②", INK, 12, bold=True))
    # ③ 円。直径ACと弦AB・BC。∠BAC＝58° → x＝∠BCA＝32°
    o2, R = 330.0, 46.0
    O = (o2 + 56, 82.0)
    A = (O[0] - R, O[1])
    C = (O[0] + R, O[1])
    th = _m.radians(116)
    B = (O[0] + R * _m.cos(th), O[1] - R * _m.sin(th))
    body.append('<circle cx="%.1f" cy="%.1f" r="%.0f" fill="none" stroke="%s" stroke-width="1.6"/>'
                % (O[0], O[1], R, GRAY))
    for p, q in ((A, C), (A, B), (B, C)):
        body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2"/>'
                    % (p[0], p[1], q[0], q[1], BLUE))
    body.append('<circle cx="%.1f" cy="%.1f" r="2.6" fill="%s"/>' % (O[0], O[1], INK))
    body.append(_t(O[0] + 2, O[1] + 14, "O", INK, 10, bold=True))
    body.append(_t(A[0] - 10, A[1] + 4, "A", INK, 11, bold=True))
    body.append(_t(C[0] + 10, C[1] + 4, "C", INK, 11, bold=True))
    body.append(_t(B[0] - 4, B[1] - 8, "B", INK, 11, bold=True))
    body.append(_angle(A, C, B, "58°", ORANGE, 24, 40, 10))
    body.append(_angle(C, B, A, "x", RED, 24, 40, 13))
    body.append(_t(o2 + 56, 26, "③", INK, 12, bold=True))
    body.append(_t(o2 + 56, 150, "ACは直径", GRAY, 10))
    return _svg(448, 164, "\n".join(body))


L6 += [
    {
        "id": "hd3n_06_9", "src": "HG-1941", "star": 1,
        "title": "角度の基本（二等辺と合同）", "category": "zu", "unit": "平面図形（角度）",
        "intro": "長さが等しいことから角の大きさを決めます。\n"
                 "①は左の辺と下の辺の長さが等しく、左下が直角の三角形です。\n"
                 "③は四角形ABCDで、ABとCDの長さが等しく、BCとDAの長さも等しくなっています。"
                 "対角線BDが引いてあり、Aの角は60°、Dのところの角（BDとDCの間）は70°です。",
        "svg": _kihon1_svg(),
        "steps": [
            {"question": "①のxは何度ですか。", "answer": "45",
             "meaning": "左の辺と下の辺が等しいので二等辺三角形。"
                        "左下が直角なので、のこりの2つの角は等しく (180−90)÷2＝45°です。"
                        "分度器を使わなくても、長さが等しいことだけで決まります。"},
            {"question": "③で、Cの角（BCとCDの間）は何度ですか。", "answer": "60",
             "meaning": "AB＝CD、BC＝DA、BDは共通なので、"
                        "三角形ABDと三角形CDBはぴったり重なります（3つの辺が等しい）。"
                        "だからCの角はAの角と同じ60°です。"},
            {"question": "③のx（BDとBCの間の角）は何度ですか。", "answer": "50",
             "meaning": "三角形BCDの内角の和から 180−60−70＝50°です。"
                        "「60°を反対がわにも書ける」と気づけるかどうかがこの問題です。"},
        ],
    },
    {
        "id": "hd3n_06_10", "src": "HG-1942", "star": 2,
        "title": "角度の基本（30°の三角形・平行線・円）", "category": "zu", "unit": "平面図形（角度）",
        "intro": "①は左の辺が4cm、斜辺が8cmで、左下が直角の三角形です。\n"
                 "②は長方形の中に2本の直線をひいたもので、"
                 "急なほうの線が上の辺となす角は60°、2直線の交点の左下の角は105°です。\n"
                 "③は円で、ACは直径です。Aのところの角（ACとABの間）は58°です。",
        "svg": _kihon2_svg(),
        "steps": [
            {"question": "①のxは何度ですか。", "answer": "30",
             "meaning": "斜辺8cmが左の辺4cmのちょうど2倍です。"
                        "正三角形を半分にした形なので、xは30°になります。"},
            {"question": "②で、ゆるいほうの線は水平から何度かたむいていますか。", "answer": "15",
             "meaning": "急な線は水平から60°下を向いています。"
                        "交点の左下の角が105°なので、ゆるい線は水平から15°上を向いています。"},
            {"question": "②のx（ゆるい線と右の辺がつくる角）は何度ですか。", "answer": "75",
             "meaning": "右の辺は垂直なので 90−15＝75°です。"},
            {"question": "③のx（ACとCBの間の角）は何度ですか。", "answer": "32",
             "meaning": "OA・OB・OCはどれも半径で長さが等しいので、"
                        "三角形OABも三角形OBCも二等辺三角形です。"
                        "∠OBA＝58°なので∠AOB＝180−58×2＝64°。"
                        "一直線なので∠BOC＝180−64＝116°。"
                        "三角形OBCから x＝(180−116)÷2＝32°です。"
                        "58＋32＝90° になっていて、じつは∠ABCは直角です。"},
        ],
    },
]

L7 = [
    {
        "id": "hd3n_07_1", "src": "HG-1951", "star": 1,
        "title": "おとなと子どもの入場料", "category": "tokusan", "unit": "平均算",
        "intro": "おとな2人と子ども3人で動物園に行き、入場料をあわせて1260円はらいました。"
                 "1人分の入場料は、子どもはおとなの半額でした。",
        "svg": "",
        "steps": [
            {"question": "おとな2人は、子ども何人分の入場料になりますか。", "answer": "4",
             "meaning": "子どもはおとなの半額なので、おとな1人＝子ども2人分。おとな2人＝子ども4人分です。"},
            {"question": "子ども1人の入場料は何円ですか。", "answer": "180",
             "meaning": "全部で子ども 4＋3＝7人分。1260÷7＝180円です。"},
            {"question": "おとな1人の入場料は何円ですか。", "answer": "360",
             "meaning": "180×2＝360円。たしかめ 360×2＋180×3＝720＋540＝1260円 ✓"},
        ],
    },
    {
        "id": "hd3n_07_2", "src": "HG-1952", "star": 2,
        "title": "同じ額をもらって2倍になる", "category": "tokusan", "unit": "倍数算・やりとり",
        "intro": "兄は430円、弟は140円持っていましたが、2人とも同じ金額ずつもらったので、"
                 "兄の所持金は弟の所持金の2倍になりました。",
        "svg": "",
        "steps": [
            {"question": "2人の所持金のちがいは何円ですか。もらったあとで答えなさい。", "answer": "290",
             "meaning": "2人が同じ額をもらっても、ちがいは変わりません。430−140＝290円のままです。"},
            {"question": "もらったあと、弟は何円持っていますか。", "answer": "290",
             "meaning": "兄が弟の2倍なので、ちがいは弟1人分と同じ。だから弟＝290円です。"},
            {"question": "2人がもらったのは何円ずつですか。", "answer": "150",
             "meaning": "290−140＝150円。たしかめ 430＋150＝580、140＋150＝290 で 580＝2×290 ✓"},
        ],
    },
    {
        "id": "hd3n_07_3", "src": "HG-1953", "star": 2,
        "title": "原こうを書く時間", "category": "tokusan", "unit": "平均算",
        "intro": "ある原こうを3まい書くのに50分かかる人がいます。",
        "svg": "",
        "steps": [
            {"question": "30まい書くのに何分かかりますか。", "answer": "500",
             "meaning": "30まいは3まいの10倍なので 50×10＝500分です。わり算をしないで「何倍」で考えます。"},
            {"question": "それは何時間何分ですか。時間のところを答えなさい。", "answer": "8",
             "meaning": "500÷60＝8あまり20 なので8時間20分です。"},
            {"question": "10まい書くのに何分何秒かかりますか。分のところを答えなさい。", "answer": "166",
             "meaning": "10まいは30まいの3分の1なので 500÷3＝166あまり2。166分と、2÷3分＝40秒です。"},
            {"question": "そのはしたは何秒ですか。", "answer": "40",
             "meaning": "2分の3分の1は 120÷3＝40秒。合わせて 2時間46分40秒です。"},
        ],
    },
    {
        "id": "hd3n_07_4", "src": "HG-1954", "star": 1,
        "title": "速さと単位のなおし方", "category": "hayasa", "unit": "速さ（旅人算）",
        "intro": "1時間で4.2km歩く人がいます。",
        "svg": "",
        "steps": [
            {"question": "1分間では何m歩きますか。", "answer": "70",
             "meaning": "4.2km＝4200m。1時間は60分なので 4200÷60＝70mです。"},
            {"question": "12分30秒では何m歩きますか。", "answer": "875",
             "meaning": "12分30秒は12.5分。70×12.5＝875mです。"
                        "70×12＝840に、30秒ぶんの35をたしても875mになります。"},
        ],
    },
    {
        "id": "hd3n_07_5", "src": "HG-1955", "star": 3,
        "title": "同じ金額でキャラメルとチョコを同数ずつ", "category": "tokusan", "unit": "仕事算",
        "intro": "まさおくんの持っているお金でキャラメルを買うと、ちょうど30こ買えます。"
                 "また、チョコレートを買うと、ちょうど20こ買えます。",
        "svg": "",
        "steps": [
            {"question": "持っているお金を60とすると、キャラメル1こはいくらになりますか。", "answer": "2",
             "meaning": "30と20の最小公倍数60をお金とみます。60÷30＝2です。"},
            {"question": "同じように、チョコレート1こはいくらになりますか。", "answer": "3",
             "meaning": "60÷20＝3です。"},
            {"question": "キャラメルとチョコレートを何こずつ買えますか。", "answer": "12",
             "meaning": "1こずつの組は 2＋3＝5。60÷5＝12こずつです。"
                        "全体を最小公倍数とみるのは、仕事算とまったく同じ考え方です。"},
        ],
    },
    {
        "id": "hd3n_07_6", "src": "HG-1956", "star": 3,
        "title": "3しゅるいのおもりのつり合い", "category": "tokusan", "unit": "消去算",
        "intro": "〇, △, □の3しゅるいのおもりがあります。"
                 "〇6こと△1こは□15ことつり合い、〇4こと□1こは△3ことつり合います。",
        "svg": "",
        "steps": [
            {"question": "〇1こは□何ことつり合いますか。", "answer": "2",
             "meaning": "2つ目の式を3倍すると 〇12こ＋□3こ＝△9こ。"
                        "1つ目の式を9倍…ではなく、△1こ＝(〇4こ＋□1こ)÷3 を1つ目に入れます。"
                        "3倍して 〇18こ＋〇4こ＋□1こ＝□45こ → 〇22こ＝□44こ → 〇1こ＝□2こです。"},
            {"question": "△1こは□何ことつり合いますか。", "answer": "3",
             "meaning": "〇4こ＝□8こなので、〇4こ＋□1こ＝□9こ＝△3こ。だから△1こ＝□3こです。"},
            {"question": "〇3こは□何ことつり合いますか。", "answer": "6",
             "meaning": "〇1こ＝□2こなので 〇3こ＝□6こです。"
                        "たしかめ 〇6こ＋△1こ＝□12こ＋□3こ＝□15こ ✓"},
        ],
    },
    {
        "id": "hd3n_07_7", "src": "HG-1957", "star": 2,
        "title": "5倍が6年後に3倍になる", "category": "tokusan", "unit": "年齢算",
        "intro": "今、としお君のお母さんの年れいは、としお君の年れいの5倍です。"
                 "6年後には、お母さんの年れいは、としお君の年れいの3倍になります。",
        "svg": "",
        "steps": [
            {"question": "今、お母さんとしとお君の年れいのちがいは、としお君の年れいの何倍ですか。",
             "answer": "4",
             "meaning": "5倍−1倍＝4倍です。"},
            {"question": "今、としお君は何才ですか。", "answer": "6",
             "meaning": "年れいのちがいは何年たっても変わりません。"
                        "6年後のとしお君を①とすると、ちがいは②。今のとしお君は ①−6 で、"
                        "そのときのちがいは（①−6）×4。②＝（①−6）×4 より ①＝12。"
                        "だから今のとしお君は 12−6＝6才です。"
                        "たしかめ 今6才と30才、6年後12才と36才で3倍 ✓"},
        ],
    },
    {
        "id": "hd3n_07_8", "src": "HG-1958", "star": 3,
        "title": "4回くりかえす「半分より3こ少なく」", "category": "tokusan", "unit": "倍数算・やりとり",
        "intro": "サルの兄弟がピーナッツを次のように分けました。"
                 "まずタローが全体の半分より3こ少なく、次にジローが残りの半分より3こ少なく、"
                 "そしてサブローがその残りの半分より3こ少なく、"
                 "最後にシローがそのまた残りの半分より3こ少なくとると、ピーナッツは15こ残りました。",
        "svg": "",
        "steps": [
            {"question": "シローがとる前、ピーナッツは何こありましたか。", "answer": "24",
             "meaning": "「半分より3こ少なく」とったので、残りは「半分より3こ多い」。"
                        "15−3＝12が半分にあたるので 12×2＝24こです。"},
            {"question": "サブローがとる前、ピーナッツは何こありましたか。", "answer": "42",
             "meaning": "同じように (24−3)×2＝42こです。"},
            {"question": "はじめにあったピーナッツは何こですか。", "answer": "150",
             "meaning": "(42−3)×2＝78、(78−3)×2＝150こです。"
                        "たしかめ 150→タロー72（残り78）→ジロー36（残り42）→"
                        "サブロー18（残り24）→シロー9（残り15）✓ 合計も150 ✓"},
            {"question": "ジローがとったピーナッツは何こですか。", "answer": "36",
             "meaning": "ジローがとる前は78こなので 78÷2−3＝36こです。"},
        ],
    },
    {
        "id": "hd3n_07_9", "src": "HG-1959", "star": 3,
        "title": "キャンプのお好み焼き", "category": "tokusan", "unit": "過不足算・差集め算",
        "intro": "あるキャンプに、3年生と4年生が同じ人数だけ参加しました。"
                 "夕食のお好み焼きを、3年生は3人につき5まいの割合で、"
                 "4年生は4人につき9まいの割合で用意しました。"
                 "しかし、全体で1人につき2まいの割合で食べたので、3まい追加しました。",
        "svg": "",
        "steps": [
            {"question": "3年生も4年生も12人ずつだとすると、用意したお好み焼きは何まいですか。",
             "answer": "47",
             "meaning": "3年生は 5×(12÷3)＝20まい、4年生は 9×(12÷4)＝27まい。合わせて47まいです。"
                        "12は3でも4でもわれるので、まずここで試します。"},
            {"question": "そのとき、食べたのは何まいですか。", "answer": "48",
             "meaning": "2人合わせて24人が1人2まいずつなので 2×24＝48まいです。"},
            {"question": "3年生は何人参加しましたか。", "answer": "36",
             "meaning": "12人ずつだと1まい足りません。3まい足りないので3倍の36人ずつです。"
                        "たしかめ 3年生は 5×12＝60まい、4年生は 9×9＝81まいで用意141まい。"
                        "食べたのは 2×72＝144まいで、ちょうど3まい追加 ✓"},
        ],
    },
    {
        "id": "hd3n_07_10", "src": "HG-1960", "star": 3,
        "title": "リスのどんぐり・全員が同じ数", "category": "kazu", "unit": "数の性質",
        "intro": "仲のいいリスのきょうだいが、次のようにどんぐりを分けました。"
                 "1ぴき目は1こと残りの10分の1、2ひき目は2こと残りの10分の1、"
                 "3びき目は3こと残りの10分の1、…というように分けたところ、"
                 "すべてのリスが同じこ数のどんぐりをもらいました。",
        "svg": "",
        "steps": [
            {"question": "最後のリスがもらうとき、どんぐりは何こ残っていましたか。"
                         "そのリスが何ばん目かを□として、□を使わずに答えると「□こ」です。"
                         "では、最後のリスが9ばん目のとき、残っていたのは何こですか。", "answer": "9",
             "meaning": "最後なので、そのあとは0こ。「□こと残りの10分の1」をとって0になるには、"
                        "残りの10分の1が0、つまりそのとき残っていたのはちょうど□こです。"
                        "9ばん目なら9こです。"},
            {"question": "リスは何ひきですか。", "answer": "9",
             "meaning": "全員が同じこ数（＝最後のリスと同じ□こ）もらうので、"
                        "全体は □×□ こ。10分の1がいつも整数になるのは□＝9のときで、全体は81こです。"},
            {"question": "1ぴきがもらったどんぐりは何こですか。", "answer": "9",
             "meaning": "81÷9＝9こずつです。"
                        "たしかめ 1ぴき目は 1こ＋(80の10分の1)8こ＝9こ、残り72。"
                        "2ひき目は 2こ＋(70の10分の1)7こ＝9こ、残り63。…と続いて9ひき目で0になります。"},
        ],
    },
]

def _match_svg():
    """HG-1979 マッチ棒の骨組み（たて5・横10・高さ5cm＝1×2×1）"""
    # 手前の面と奥の面を、ずらして描く（等角ふう）
    # ★左の「たて5cm」は anchor=end なので、図を左に置くと枠から出る（実測 18.9px）
    ox, oy, u, dx, dy = 64.0, 116.0, 52.0, 26.0, -22.0
    P = lambda i, j, k: (ox + i * u + k * dx, oy - j * u + k * dy)
    # ★たて5cm＝マッチ1本ぶん。i（横）は0〜2、j（たて）は0〜1、k（高さ）は0〜1。
    #   はじめ j を2本ぶん描いていて、棒が上へ飛び出していた（実測 2026-08-09）
    NX, NY, NZ = 2, 1, 1
    body = []
    seg = lambda a, b, c: ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                           'stroke-width="3" stroke-linecap="round"/>'
                           % (a[0], a[1], b[0], b[1], c))
    for k in (1, 0):                       # 奥→手前の順に描く
        for i in range(NX + 1):            # たて向き（NY本ずつ）
            for j in range(NY):
                body.append(seg(P(i, j, k), P(i, j + 1, k), ORANGE))
        for j in range(NY + 1):            # 横向き（NX本ずつ）
            for i in range(NX):
                body.append(seg(P(i, j, k), P(i + 1, j, k), ORANGE))
    for i in range(NX + 1):                # 高さ（おく行き）向き
        for j in range(NY + 1):
            body.append(seg(P(i, j, 0), P(i, j, 1), GRAY))
    body.append(_t(116, 140, "横10cm（マッチ2本）", GRAY, 10))
    body.append(_t(50, 92, "たて5cm", GRAY, 10, anchor="end"))
    body.append(_t(220, 44, "高さ5cm", GRAY, 10, anchor="start"))
    body.append(_t(146, 160, "マッチ棒1本は5cm。この形で20本", GRAY, 11))
    return _svg(292, 174, "\n".join(body))


L9 = [
    {
        "id": "hd3n_09_2", "src": "HG-1972", "star": 3,
        "title": "角柱と角すいの頂点・辺・面", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "三角柱、五角柱、四角すい、六角すいについて、"
                 "頂点の数・辺の数・面の数を調べます。",
        "svg": "",
        "steps": [
            {"question": "三角柱の頂点はいくつですか。", "answer": "6",
             "meaning": "上と下の三角形にそれぞれ3つずつで 3×2＝6です。"},
            {"question": "三角柱の辺はいくつですか。", "answer": "9",
             "meaning": "上の三角形に3本、下に3本、たての柱が3本で 3×3＝9本です。"},
            {"question": "五角柱の辺はいくつですか。", "answer": "15",
             "meaning": "5×3＝15本です。角柱は「底面の角の数×3」が辺の数になります。"},
            {"question": "四角すいの辺はいくつですか。", "answer": "8",
             "meaning": "底面の4本と、頂点へ集まる4本で 4×2＝8本です。"},
            {"question": "六角すいの面はいくつですか。", "answer": "7",
             "meaning": "側面が6つと底面1つで7です。"
                        "角すいは「底面の角の数＋1」が面の数、頂点の数も同じです。"},
            {"question": "六角すいで、頂点の数＋面の数−辺の数はいくつですか。", "answer": "2",
             "meaning": "頂点7＋面7−辺12＝2。じつはどの角柱・角すいでも2になります。"},
        ],
    },
    {
        "id": "hd3n_09_3", "src": "HG-1973", "star": 3,
        "title": "5つの正多面体", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "合同な正多角形で囲まれ、どの頂点にも同じ数の面が集まっている多面体を正多面体といいます。"
                 "正多面体は5つしかありません（正四面体・正六面体・正八面体・正十二面体・正二十面体）。",
        "svg": "",
        "steps": [
            {"question": "正四面体の辺はいくつですか。", "answer": "6",
             "meaning": "正三角形4つ。1つの面に辺が3本で、2つの面がとなり合って1本を共有するので "
                        "3×4÷2＝6本です。"},
            {"question": "正八面体の頂点はいくつですか。", "answer": "6",
             "meaning": "正三角形8つ、1つの頂点に4つの面が集まるので 3×8÷4＝6こです。"},
            {"question": "正十二面体の辺はいくつですか。", "answer": "30",
             "meaning": "正五角形12こ。5×12÷2＝30本です。"},
            {"question": "正十二面体の頂点はいくつですか。", "answer": "20",
             "meaning": "1つの頂点に3つの面が集まるので 5×12÷3＝20こです。"},
            {"question": "正二十面体の頂点はいくつですか。", "answer": "12",
             "meaning": "正三角形20こ、1つの頂点に5つの面が集まるので 3×20÷5＝12こです。"},
            {"question": "正二十面体で、頂点の数＋面の数−辺の数はいくつですか。", "answer": "2",
             "meaning": "12＋20−30＝2。正多面体でもやはり2になります。"},
        ],
    },
    {
        "id": "hd3n_09_6", "src": "HG-1976", "star": 3,
        "title": "サッカーボールの辺と頂点", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "正五角形12こと正六角形20こをぬい合わせたサッカーボールがあります。",
        "svg": "",
        "steps": [
            {"question": "面は全部でいくつですか。", "answer": "32",
             "meaning": "12＋20＝32です。"},
            {"question": "すべての面の辺の数を合計するといくつですか。", "answer": "180",
             "meaning": "5×12＋6×20＝60＋120＝180本ぶんです。"},
            {"question": "サッカーボールの辺は何本ですか。", "answer": "90",
             "meaning": "1本の辺は2つの面が共有しているので、2回数えています。180÷2＝90本です。"},
            {"question": "サッカーボールの頂点は何こですか。", "answer": "60",
             "meaning": "1つの頂点には3つの面が集まっているので 180÷3＝60こです。"
                        "たしかめ 60＋32−90＝2 ✓"},
        ],
    },
    {
        "id": "hd3n_09_9", "src": "HG-1979", "star": 3,
        "title": "マッチ棒で作る直方体の骨組み", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "長さが5cmのマッチ棒をくっつけて、たて5cm・横10cm・高さ5cmの直方体の骨組みを作ると、"
                 "マッチ棒は20本使います。同じようにして、"
                 "たて45cm・横35cm・高さ25cmの直方体を作ります。"
                 "マッチ棒の太さは考えなくてよいものとします。",
        "svg": _match_svg(),
        "steps": [
            {"question": "横35cmは、マッチ棒何本ぶんですか。", "answer": "7",
             "meaning": "35÷5＝7本ぶんです。たては 45÷5＝9本ぶん、高さは 25÷5＝5本ぶんです。"},
            {"question": "横向きのマッチ棒は何本使いますか。", "answer": "420",
             "meaning": "横向きの列は、たて方向に 9＋1＝10列、高さ方向に 5＋1＝6段あります。"
                        "1列に7本なので 7×10×6＝420本です。"},
            {"question": "たて向きのマッチ棒は何本使いますか。", "answer": "432",
             "meaning": "9×(7＋1)×(5＋1)＝9×8×6＝432本です。"},
            {"question": "マッチ棒は全部で何本使いますか。", "answer": "1252",
             "meaning": "高さ向きは 5×(7＋1)×(9＋1)＝400本。"
                        "420＋432＋400＝1252本です。"
                        "たしかめに、はじめの1×2×1で同じ計算をすると 8＋6＋6＝20本 ✓"},
        ],
    },
]

L11 = [
    {
        "id": "hd3n_11_1", "src": "HG-1991", "star": 3,
        "title": "同じ日付が同じ曜日になる年", "category": "kisoku", "unit": "周期算",
        "intro": "西暦2006年12月24日は日曜日です。",
        "svg": "",
        "steps": [
            {"question": "ふつうの年（365日）が1年たつと、同じ日付の曜日は何こずれますか。", "answer": "1",
             "meaning": "365÷7＝52あまり1なので、1つうしろにずれます。"},
            {"question": "うるう年（366日）をはさむと、何こずれますか。", "answer": "2",
             "meaning": "366÷7＝52あまり2なので、2つずれます。"
                        "12月24日を見るときは、その年の2月29日をはさむかどうかで決まります。"},
            {"question": "次に12月24日が日曜日になるのは西暦何年ですか。", "answer": "2017",
             "meaning": "ずれを足していくと、7の倍数にもどるのが2017年です。"
                        "2006→2007は1、…とうるう年（2008・2012・2016）だけ2ずつ足すと、"
                        "2017年でちょうど14（7の倍数）になります。"},
            {"question": "そのまた次は西暦何年ですか。", "answer": "2023",
             "meaning": "2017年から同じように足していくと2023年です。"
                        "うるう年のならびのぐあいで、11年後→6年後と間かくが変わります。"},
        ],
    },
    {
        "id": "hd3n_11_2", "src": "HG-1992", "star": 3,
        "title": "カレンダーが同じになる月", "category": "kisoku", "unit": "周期算",
        "intro": "1年（1月〜12月）の中で、ひと月のカレンダーの日付と曜日がまったく同じになる"
                 "月の組み合わせを考えます。"
                 "同じになるには、その月の1日の曜日が同じで、しかも日数も同じである必要があります。",
        "svg": "",
        "steps": [
            {"question": "1月と同じ1日の曜日になる月は、平年では何月ですか。", "answer": "10",
             "meaning": "1月から各月の日数を7でわったあまりを足していくと、10月でちょうど"
                        "7の倍数にもどります。1月も10月も31日まであるので、"
                        "カレンダーがまったく同じになります。"},
            {"question": "うるう年では何月ですか。", "answer": "7",
             "meaning": "2月が29日になるぶんだけずれ方が変わり、7月が1月と同じになります。"
                        "7月も31日まであるので、まったく同じカレンダーです。"},
        ],
    },
    {
        "id": "hd3n_11_3", "src": "HG-1993", "star": 2,
        "title": "1年を4等分する", "category": "kisoku", "unit": "周期算",
        "intro": "365日を4等分して、第1期を1月1日午前0時からとします。",
        "svg": "",
        "steps": [
            {"question": "1つの期間は何日と何時間ですか。日のところを答えなさい。", "answer": "91",
             "meaning": "365÷4＝91あまり1。あまりの1日は24時間なので 24÷4＝6時間。"
                        "1期は91日6時間です。"},
            {"question": "第2期が始まるのは何月何日ですか。月のところを答えなさい。", "answer": "4",
             "meaning": "1月1日から91日たつと4月2日です（1月31＋2月28＋3月31＝90日で3月31日、"
                        "その次の日が4月1日、もう1日で4月2日）。"},
            {"question": "その日ですか。日のところを答えなさい。", "answer": "2",
             "meaning": "4月2日の午前6時が第2期の始まりです。"},
            {"question": "第4期が始まるのは何月ですか。", "answer": "10",
             "meaning": "1期の3つぶん＝273日18時間たったところ。10月1日午後6時です。"},
        ],
    },
    {
        "id": "hd3n_11_4", "src": "HG-1994", "star": 2,
        "title": "2つの期間の日数", "category": "kisoku", "unit": "周期算",
        "intro": "日数をかぞえます。どちらも、はじめの日も終わりの日も数に入れます。",
        "svg": "",
        "steps": [
            {"question": "11月19日から2月20日までは何日間ですか。ふつうの年とします。", "answer": "94",
             "meaning": "11月19日〜30日で12日、12月が31日、1月が31日、2月1日〜20日で20日。"
                        "12＋31＋31＋20＝94日間です。"},
            {"question": "2007年11月24日から2008年11月24日までは何日間ですか。", "answer": "367",
             "meaning": "2008年は うるう年で、この間に2月29日が入ります。"
                        "1年ぶん366日たって同じ日付になり、両はしを数に入れるので367日間です。"},
        ],
    },
    {
        "id": "hd3n_11_5", "src": "HG-1995", "star": 3,
        "title": "「第5◯曜」は1年に何日あるか", "category": "kisoku", "unit": "周期算",
        "intro": "あるスーパーマーケットでは、毎月「第5◯曜」にあたる日に大安売りをします。"
                 "たとえば2007年1月は1日が月曜で、29日（月）・30日（火）・31日（水）の3日間が"
                 "「第5◯曜」になります。",
        "svg": "",
        "steps": [
            {"question": "1か月に「第5◯曜」は、その月の日数から何を引いた数だけありますか。",
             "answer": "28",
             "meaning": "はじめの28日はどの曜日もちょうど4回ずつなので、"
                        "29日目からが「第5◯曜」です。だから（その月の日数−28）日あります。"},
            {"question": "2007年（平年）は1年に何日ありますか。", "answer": "29",
             "meaning": "1年ぶん足すと 365−28×12＝365−336＝29日間です。"
                        "月ごとに数えなくても、1年の日数から336を引くだけで出ます。"},
            {"question": "2008年（うるう年）は何日ありますか。", "answer": "30",
             "meaning": "366−336＝30日間です。"},
        ],
    },
    {
        "id": "hd3n_11_6", "src": "HG-1996", "star": 3,
        "title": "「第5水曜」がある月", "category": "kisoku", "unit": "周期算",
        "intro": "2009年1月1日は木曜日で、この月には29日（木）・30日（金）・31日（土）の3日間、"
                 "「第5◯曜」といえる日があります。"
                 "2009年に「第5」の曜日が水曜日をふくむ月を考えます。",
        "svg": "",
        "steps": [
            {"question": "その月に水曜日が5回あるためには、その月は何日以上必要ですか。", "answer": "29",
             "meaning": "28日ではどの曜日もちょうど4回。29日目に水曜が来ればよいので、"
                        "29日以上あって、しかも29日目・30日目・31日目のどれかが水曜であることが必要です。"},
            {"question": "2009年でいちばんはやく「第5水曜」がある月は何月ですか。", "answer": "4",
             "meaning": "2009年は1月1日が木曜。各月の1日の曜日をたどると、4月1日は水曜になります。"
                        "4月は30日まであるので29日（水）が第5水曜です。"},
            {"question": "「第5水曜」がある月は全部で何か月ありますか。", "answer": "4",
             "meaning": "4月・7月・9月・12月の4か月です。"},
        ],
    },
    {
        "id": "hd3n_11_7", "src": "HG-1997", "star": 3,
        "title": "曜日を「7でわったあまり」で計算する", "category": "kisoku", "unit": "周期算",
        "intro": "右の表は、ある年の2月のカレンダーです（1日が木曜、28日まで）。\n"
                 "この表では、たとえば**金曜の日付は7でわると2あまり**、"
                 "**土曜の日付は7でわると3あまり**です。"
                 "この2つをたして7でわると5あまり、**7でわって5あまる日付の曜日は月曜**なので、"
                 "**（金）＋（土）＝（月）**と書くことにします。",
        "svg": _feb_cal_svg(),
        "steps": [
            {"question": "水曜の日付を7でわったあまりはいくつですか。", "answer": "0",
             "meaning": "水曜は7日・14日・21日・28日。どれも7でわり切れるのであまりは0です。"
                        "同じように 木＝1、金＝2、土＝3、日＝4、月＝5、火＝6 になります。"},
            {"question": "（火）＋（木）は何曜ですか。",
             "answer": "水", "choices": ["水", "木", "金", "土", "日", "月", "火"],
             "meaning": "6＋1＝7。7でわったあまりは0なので**水**です。"},
            {"question": "（日）−（金）は何曜ですか。",
             "answer": "金", "choices": ["金", "水", "木", "土", "日", "月", "火"],
             "meaning": "4−2＝2。あまり2は**金**です。"},
            {"question": "（月）×（土）は何曜ですか。",
             "answer": "木", "choices": ["木", "水", "金", "土", "日", "月", "火"],
             "meaning": "5×3＝15。15÷7＝2あまり1なので**木**です。"},
            {"question": "（月）×｛（火）−（水）｝−（木）×（金）は何曜ですか。",
             "answer": "水", "choices": ["水", "木", "金", "土", "日", "月", "火"],
             "meaning": "かっこの中から先に計算します。6−0＝6、5×6＝30。"
                        "1×2＝2をひいて30−2＝28。28÷7＝4あまり0なので**水**です。"
                        "あまりに直すのを わすれないのがコツです。"},
        ],
    },
    {
        "id": "hd3n_11_8", "src": "HG-1998", "star": 2,
        "title": "年をまたぐ曜日", "category": "kisoku", "unit": "周期算",
        "intro": "ある年の3月7日は土曜日です。翌年の2月5日は何曜日ですか。"
                 "この間にうるう年の2月29日は入らないものとします。",
        "svg": "",
        "steps": [
            {"question": "3月7日から翌年の2月5日までは何日たちますか。", "answer": "335",
             "meaning": "3月の残り24日＋4月30＋5月31＋6月30＋7月31＋8月31＋9月30"
                        "＋10月31＋11月30＋12月31＋1月31＋2月5日ぶん5＝335日です。"},
            {"question": "335を7でわったあまりはいくつですか。", "answer": "6",
             "meaning": "7×47＝329なので 335−329＝6。あまりは6です。"},
            {"question": "翌年の2月5日は何曜日ですか。",
             "answer": "金曜日", "choices": ["金曜日", "木曜日", "土曜日", "日曜日"],
             "meaning": "土曜日から6つ進みます。"
                        "日1・月2・火3・水4・木5・金6 で金曜日です。"},
        ],
    },
    {
        "id": "hd3n_11_9", "src": "HG-1999", "star": 3,
        "title": "週3回の放送・100回目はいつ", "category": "kisoku", "unit": "周期算",
        "intro": "2007年1月10日（水）から始まったテレビドラマがあります。"
                 "このドラマは毎週月・水・金に放映され、100回で打ち切られます。",
        "svg": "",
        "steps": [
            {"question": "3回放送するごとに何日進みますか。", "answer": "7",
             "meaning": "水→金→月→次の水で、ちょうど1週間＝7日です。"},
            {"question": "100回目は、1回目から何日後ですか。", "answer": "231",
             "meaning": "100＝3×33＋1 なので、1回目から33サイクル進んだところが100回目。"
                        "7×33＝231日後です。"},
            {"question": "100回目は何月何日ですか。月のところを答えなさい。", "answer": "8",
             "meaning": "1月10日の231日後は8月29日です。"},
            {"question": "その日ですか。日のところを答えなさい。", "answer": "29",
             "meaning": "8月29日。33サイクルちょうどなので曜日は1回目と同じ水曜日です。"},
        ],
    },
    {
        "id": "hd3n_11_10", "src": "HG-2000", "star": 3,
        "title": "週1回の放送・第1回にさかのぼる", "category": "kisoku", "unit": "周期算",
        "intro": "毎週火曜日に放映されるテレビアニメがあります。"
                 "ある年の3月27日の火曜日に、第100回記念放送をむかえました。"
                 "ただし、前の年（1年前）はうるう年でした。",
        "svg": "",
        "steps": [
            {"question": "第1回は第100回の何週前ですか。", "answer": "99",
             "meaning": "100回目は1回目から99回あとなので99週前です。"},
            {"question": "それは何日前ですか。", "answer": "693",
             "meaning": "7×99＝693日前です。"},
            {"question": "第1回は何年前ですか。", "answer": "2",
             "meaning": "693日は1年（365日）より多く、2年ぶん（うるう年をふくむので731日）より"
                        "少ないので、2年前の年になります。"},
            {"question": "第1回は何月何日ですか。月のところを答えなさい。", "answer": "5",
             "meaning": "693日さかのぼると2年前の5月4日です。"
                        "1年前がうるう年なので、その2月29日ぶんを数に入れるのがポイントです。"},
        ],
    },
]

def _entaku_svg():
    """HG-2005 円卓6人。Aは下。ほかは空。"""
    import math as _m
    O, R = (110.0, 108.0), 62.0
    body = ['<circle cx="%.0f" cy="%.0f" r="%.0f" fill="#f8f9ff" stroke="%s" stroke-width="2"/>'
            % (O[0], O[1], R - 22, GRAY)]
    names = ["A", "", "", "", "", ""]          # 下から左まわり
    for i, s in enumerate(names):
        deg = 270 + i * 60                     # 下＝270°から左まわり
        a = _m.radians(deg)
        x, y = O[0] + R * _m.cos(a), O[1] - R * _m.sin(a)
        body.append('<circle cx="%.1f" cy="%.1f" r="15" fill="#fff" stroke="%s" '
                    'stroke-width="2"/>' % (x, y, BLUE if s else GRAY))
        if s:
            body.append(_t("%.1f" % x, "%.1f" % (y + 5), s, INK, 14, bold=True))
    body.append(_t(110, 200, "Aは下。のこりの5人の席を考える", GRAY, 11))
    return _svg(220, 214, "\n".join(body))


L12 = [
    {
        "id": "hd3n_12_1", "src": "HG-2001", "star": 1,
        "title": "かけっこ・3人の証言がすべてウソ", "category": "baai", "unit": "推理・論理",
        "intro": "A、B、C、Dの4人がかけっこをしました。\n"
                 "U太朗「Cは1位か2位だよ。」／S太朗「1位はAかDだよ。」／O太朗「Aは2位か3位だよ。」\n"
                 "ところが、この3人が言ったことはすべてまちがいでした。",
        "svg": "",
        "steps": [
            {"question": "Cの順位として考えられるのは何位と何位ですか。小さいほうを答えなさい。",
             "answer": "3",
             "meaning": "「1位か2位」がまちがいなので、Cは3位か4位です。"
                        "「まちがい」を「反対のことを言った」と読まないようにします。"},
            {"question": "Aは何位ですか。", "answer": "4",
             "meaning": "「Aは2位か3位」がまちがいなので、Aは1位か4位。"
                        "「1位はAかD」もまちがいなので、1位はAでもDでもありません。"
                        "だからAは4位です。"},
            {"question": "Bは何位ですか。", "answer": "1",
             "meaning": "1位はAでもDでもなく、Cは3位か4位。Aが4位なのでCは3位。"
                        "だから1位はBです。"},
            {"question": "Dは何位ですか。", "answer": "2",
             "meaning": "のこりは2位だけなのでDが2位。"
                        "A＝4位、B＝1位、C＝3位、D＝2位です。"},
        ],
    },
    {
        "id": "hd3n_12_2", "src": "HG-2002", "star": 2,
        "title": "背番号・3つの積から4つの数", "category": "baai", "unit": "推理・論理",
        "intro": "ある野球チームのA、B、C、D4人の選手の背番号について、次のことがわかっています。\n"
                 "〔ア〕AとBの背番号の積は30　〔イ〕BとCの積は70　〔ウ〕CとDの積は84\n"
                 "〔エ〕4人の背番号はそれぞれちがう",
        "svg": "",
        "steps": [
            {"question": "Bの背番号は30と70の何になりますか。"
                         "考えられるものは何通りありますか。", "answer": "4",
             "meaning": "Bは30も70もわり切るので、30と70の公約数です。"
                        "1・2・5・10の4通りしかありません。"},
            {"question": "Bの背番号はいくつですか。", "answer": "10",
             "meaning": "B＝1ならC＝70でDが整数になりません。B＝2ならC＝35でやはりだめ。"
                        "B＝5ならA＝6・C＝14・D＝6でAとDが同じになってしまいます。"
                        "だからB＝10です。〔エ〕がないとB＝5も残ってしまいます。"},
            {"question": "Aの背番号はいくつですか。", "answer": "3",
             "meaning": "30÷10＝3です。"},
            {"question": "Dの背番号はいくつですか。", "answer": "12",
             "meaning": "C＝70÷10＝7、D＝84÷7＝12。"
                        "A＝3、B＝10、C＝7、D＝12 で4つともちがいます ✓"},
        ],
    },
    {
        "id": "hd3n_12_3", "src": "HG-2003", "star": 3,
        "title": "同じ番号のカードが必ず8枚", "category": "baai", "unit": "推理・論理",
        "intro": "箱の中に、番号1のカードが1枚、番号2が2枚、番号3が3枚、…、番号9が9枚、"
                 "また番号10から番号30までがそれぞれ10枚、合計255枚のカードがあります。"
                 "この箱から何枚以上取り出せば、その中に同じ番号のカードが必ず8枚ふくまれるといえますか。",
        "svg": "",
        "steps": [
            {"question": "番号1から7までからは、いちばん多くて何枚取れますか。"
                         "どの番号も8枚そろわないようにします。", "answer": "28",
             "meaning": "番号1は1枚、2は2枚、…7は7枚しかないので、全部取っても8枚にはなりません。"
                        "1＋2＋…＋7＝28枚です。"},
            {"question": "番号8から30までからは、いちばん多くて何枚取れますか。", "answer": "161",
             "meaning": "8以上はどれも8枚以上あるので、7枚ずつでとめます。"
                        "番号は8から30まで23こあるので 7×23＝161枚です。"},
            {"question": "8枚そろわないように取れるのは、いちばん多くて何枚ですか。", "answer": "189",
             "meaning": "28＋161＝189枚です。"},
            {"question": "何枚以上取り出せば、同じ番号が必ず8枚ふくまれますか。", "answer": "190",
             "meaning": "189枚まではそろわないことがあるので、190枚取れば必ずそろいます。"
                        "合計255枚という数は、この問題では使いません。"},
        ],
    },
    {
        "id": "hd3n_12_4", "src": "HG-2004", "star": 1,
        "title": "背くらべ・8つの結果から順位", "category": "baai", "unit": "推理・論理",
        "intro": "7人が2人ずつ背をくらべました。右の表は、その8回ぶんの結果です。"
                 "上のだんが背の高いほう、下のだんが低いほうです。",
        "svg": _table_svg(
            [["高い"] + ["土井", "金本", "水谷", "火野", "水谷", "日川", "木田", "水谷"],
             ["低い"] + ["水谷", "月山", "日川", "金本", "木田", "金本", "金本", "火野"]],
            [38] + [32] * 8, fs=11),
        "steps": [
            {"question": "「低い」のだんに一度も出てこないのはだれですか。"
                         "その人がいちばん背が高い人です。",
             "answer": "土井", "choices": ["土井", "水谷", "金本", "日川"],
             "meaning": "一度も低いほうにならなかった人は、だれにも負けていません。"
                        "表の下のだんに出てくるのは 水谷・月山・日川・金本・木田・火野 で、"
                        "土井だけが出てきません。"},
            {"question": "2番目に背が高いのはだれですか。",
             "answer": "水谷", "choices": ["水谷", "火野", "日川", "木田"],
             "meaning": "水谷は下のだんに1回だけ出てきます（土井より低い）。"
                        "その1回の相手が土井なので、水谷は土井にしか負けていません。"},
            {"question": "いちばん背が低いのはだれですか。",
             "answer": "月山", "choices": ["月山", "金本", "火野", "木田"],
             "meaning": "「高い」のだんに一度も出てこない人は、だれにも勝っていません。"
                        "上のだんに出てこないのは月山だけです。"},
            {"question": "火野・日川・木田の3人の順番は決まりますか。",
             "answer": "決まらない",
             "choices": ["決まらない", "火野がいちばん高い", "日川がいちばん高い", "木田がいちばん高い"],
             "meaning": "この3人は**たがいにくらべられていません**。"
                        "7人の並べ方5040通りをすべてしらべると、"
                        "表に合う並び方は6通りのこりますが、"
                        "1位・2位・最下位はどの並び方でも同じです。"
                        "だから問題も、その3つしか聞いていません。"},
        ],
    },
    {
        "id": "hd3n_12_5", "src": "HG-2005", "star": 2,
        "title": "円卓6人のすわり方", "category": "baai", "unit": "推理・論理",
        "intro": "A、B、C、D、E、Fの6人が、丸いテーブルのまわりにすわりました。"
                 "そのときの自分の席について、次のようにいいました。\n"
                 "A「Dのとなりにならなかった。」／B「Cの正面にはいなかった。」／C「Eのとなりにいた。」\n"
                 "D「Cとは、はなれてすわった。」／E「Aは右どなりにいた。」／F「Aの正面にはいなかった。」\n"
                 "Aは下の席にすわっています。",
        "svg": _entaku_svg(),
        "steps": [
            {"question": "Aの左どなりにすわっているのはだれですか。",
             "answer": "E", "choices": ["E", "B", "C", "D", "F"],
             "meaning": "Eが「Aは右どなりにいた」と言っているので、Aから見るとEは左どなりです。"},
            {"question": "Aの右どなりにすわっているのはだれですか。",
             "answer": "F", "choices": ["F", "B", "C", "D"],
             "meaning": "Aのとなりはあと1つ。DはAのとなりではなく、CはEのとなりなので、"
                        "のこるのはBかF。Bだとするとあとの条件が合わなくなるのでFです。"},
            {"question": "Aの正面にすわっているのはだれですか。",
             "answer": "B", "choices": ["B", "C", "D", "F"],
             "meaning": "Fは「Aの正面ではない」と言っています。"
                        "席を全部しらべると、Aから左まわりに A→F→D→B→C→E の1通りだけが"
                        "すべての条件に合います。Aの正面はBです。"},
        ],
    },
    {
        "id": "hd3n_12_6", "src": "HG-2006", "star": 2,
        "title": "くじ・3つの「〜のうち何人」を重ねる", "category": "baai", "unit": "推理・論理",
        "intro": "A、B、C、D、E、Fの6人がくじを引いて、3人があたりました。"
                 "あたった3人は、えん筆・ノート・消しゴムのうちどれか1つをもらいました。\n"
                 "・A、B、Cのうち1人だけがあたり、えん筆をもらいました。\n"
                 "・A、D、Eのうち2人があたり、ノートと消しゴムをもらいました。\n"
                 "・B、E、Fのうち2人があたり、そのうち1人はノートをもらいました。",
        "svg": "",
        "steps": [
            {"question": "Aはあたりましたか。",
             "answer": "はずれ", "choices": ["はずれ", "あたり"],
             "meaning": "1つ目は「A・B・Cから1人」、2つ目は「A・D・Eから2人」で合わせて3人。"
                        "あたりはちょうど3人なので、この1人と2人は**別の人**でなければいけません。"
                        "Aが両方に入っていると二重に数えてしまうので、Aははずれです。"},
            {"question": "Fはあたりましたか。",
             "answer": "はずれ", "choices": ["はずれ", "あたり"],
             "meaning": "Aがはずれなので、2つ目からDとEの2人があたりです。"
                        "のこる1人は1つ目のB・Cのどちらか。"
                        "Fは1つ目にも2つ目にも入っていないので、あたりにはなれません。"},
            {"question": "えん筆をもらったのはだれですか。",
             "answer": "B", "choices": ["B", "C", "D", "E"],
             "meaning": "3つ目の「B・E・Fのうち2人」で、Eはあたり・Fははずれなので、"
                        "もう1人はBです。Bは1つ目のグループの1人なので、えん筆をもらいました。"},
            {"question": "ノートをもらったのはだれですか。",
             "answer": "E", "choices": ["E", "D", "B", "C"],
             "meaning": "3つ目より、B・E・Fのうち1人がノート。Bはえん筆なのでEがノートです。"},
            {"question": "消しゴムをもらったのはだれですか。",
             "answer": "D", "choices": ["D", "E", "B", "C"],
             "meaning": "あたりはB・D・Eで、Bがえん筆、Eがノート。のこるDが消しゴムです。"
                        "6人から3人を選んで品物を配る120通りをすべてしらべても、これ1通りだけです。"},
        ],
    },
    {
        "id": "hd3n_12_7", "src": "HG-2007", "star": 3,
        "title": "○×テスト・3人の得点から正解を出す", "category": "baai", "unit": "推理・論理",
        "intro": "松太郎、竹次郎、梅三郎の3人が○×式のテストを受けました。"
                 "問題は5問で、1問正解につき1点です。"
                 "右の表は、3人の答え方と得点です。5点満点になる答え（正解）を考えます。",
        "svg": _table_svg(
            [["", "1", "2", "3", "4", "5", "得点"],
             ["松太郎", "○", "×", "○", "×", "×", "4点"],
             ["竹次郎", "×", "×", "○", "○", "○", "3点"],
             ["梅三郎", "○", "×", "×", "○", "×", "4点"]],
            [56, 30, 30, 30, 30, 30, 44], head_row=True),
        "steps": [
            {"question": "3人の得点をぜんぶ たすと何点ですか。", "answer": "11",
             "meaning": "4＋3＋4＝11点です。"
                        "これは「問題ごとに当たった人数」をぜんぶ たした数でもあります。"},
            {"question": "1番の正解が○だとすると、3人のうち何人が当たりますか。", "answer": "2",
             "meaning": "1番は 松太郎○・竹次郎×・梅三郎○ なので、正解が○なら2人当たります。"
                        "×なら1人しか当たりません。"},
            {"question": "2番は3人とも×と答えています。正解が×なら何人当たりますか。", "answer": "3",
             "meaning": "3人ともそろって当たるので3人です。○なら0人です。"},
            {"question": "どの問題も「当たる人が多いほう」を正解にすると、"
                         "当たりの合計は何人になりますか。", "answer": "11",
             "meaning": "1番は○で2人、2番は×で3人、3番（○○×）は○で2人、"
                        "4番（×○○）は○で2人、5番（×○×）は×で2人。"
                        "2＋3＋2＋2＋2＝11人です。"},
            {"question": "正解を1番から5番までならべて書くと、どうなりますか。",
             "answer": "○×○○×",
             "choices": ["○×○○×", "○×○×○", "×○○○×", "○×××○"],
             "meaning": "3人の得点の合計11と、いちばん多くできる合計11がぴったり同じです。"
                        "つまり**どの問題も多いほうでなければならず**、"
                        "1つでも少ないほうを選ぶと合計が11に届きません。"
                        "だから正解は ○×○○× に決まります。"
                        "32通りをすべてしらべても、これ1通りだけです。"},
        ],
    },
    {
        "id": "hd3n_12_8", "src": "HG-2008", "star": 3,
        "title": "同じ個数ずつ／同じ金額ずつ", "category": "kazu", "unit": "公約数・公倍数",
        "intro": "太郎と花子が3種類の品物A、B、Cを買いに行きました。"
                 "1このねだんはA＝10円、B＝15円、C＝30円です。\n"
                 "太郎はA、B、Cを**同じこ数ずつ**買い、花子はA、B、Cを**同じ金額ずつ**買って、"
                 "それぞれ千円さつ1枚ではらったところ、2人が受け取ったおつりは同じでした。",
        "svg": "",
        "steps": [
            {"question": "太郎の代金は、何円の倍数になりますか。", "answer": "55",
             "meaning": "1こずつで 10＋15＋30＝55円。同じこ数ずつなので代金は55の倍数です。"},
            {"question": "花子が1種類にかける金額は、何円の倍数になりますか。", "answer": "30",
             "meaning": "10円・15円・30円のどれでも ぴったり買える金額なので、"
                        "10と15と30の公倍数＝**30の倍数**です。"},
            {"question": "花子の代金は、何円の倍数になりますか。", "answer": "90",
             "meaning": "3種類ぶんなので 30×3＝90の倍数です。"
                        "「同じこ数」は**和の倍数**、「同じ金額」は**最小公倍数の倍数**になり、"
                        "同じような言い方でも中身がちがいます。"},
            {"question": "2人の代金は同じです。千円さつでたりる中で、代金は何円ですか。",
             "answer": "990",
             "meaning": "55と90の最小公倍数は990。つぎは1980で千円をこえます。"
                        "太郎は18こずつ（55×18＝990）、花子は1種類330円ずつ（330×3＝990）です。"},
            {"question": "おつりは何円ですか。", "answer": "10",
             "meaning": "1000−990＝10円です。"
                        "千円さつ1枚という決まりがないと990円・1980円…といくつも出てしまいます。"},
        ],
    },
    {
        "id": "hd3n_12_9", "src": "HG-2009", "star": 2,
        "title": "5人のうち1人だけがウソ", "category": "baai", "unit": "推理・論理",
        "intro": "A、B、C、D、Eの5人のうちの1人が犯人で、それぞれの言いぶんは次の通りです。\n"
                 "A「B、C、Eの3人のうちだれかが犯人だ。」／B「AとEは犯人ではない。」\n"
                 "C「A、D、Eの3人のうちだれかが犯人だ。」／D「Cは犯人ではない。」\n"
                 "E「A、C、Dの3人のうちだれかが犯人だ。」\n"
                 "5人のうち、うそをついているのはちょうど1人です。",
        "svg": "",
        "steps": [
            {"question": "犯人はだれですか。",
             "answer": "D", "choices": ["D", "A", "B", "C", "E"],
             "meaning": "犯人を1人ずつあてはめて、うそになる人が何人になるか数えます。"
                        "Dが犯人のときだけ、うそになるのがちょうど1人になります。"},
            {"question": "うそをついたのはだれですか。",
             "answer": "A", "choices": ["A", "B", "C", "D", "E"],
             "meaning": "Dが犯人なら、Aの「B、C、Eのだれか」だけがまちがいです。"
                        "B・C・D・Eの言いぶんはすべて正しくなります。"},
        ],
    },
    {
        "id": "hd3n_12_10", "src": "HG-2010", "star": 3,
        "title": "教科書の取りちがえ・6人の電話", "category": "baai", "unit": "推理・論理",
        "intro": "青木・井上・内山・江川・大田・川口の6人が、"
                 "**6人とも他人の教科書を持って帰って**しまいました。"
                 "そこで、自分がまちがえて持って帰った教科書の持ち主に電話してあやまることにしました。\n"
                 "・江川が電話したとき、その相手はだれかと**話し中**でした。"
                 "あとで、その通話の相手は井上だったとわかりました。\n"
                 "・青木が電話すると、相手は「今、僕は川口君に電話で話を終わったところだ。」と言いました。\n"
                 "・内山が電話すると、相手は「僕も今、君に電話しようと思っていたところだった。」と言いました。",
        "svg": "",
        "steps": [
            {"question": "青木が電話した相手はだれですか。",
             "answer": "井上", "choices": ["井上", "内山", "江川", "大田", "川口"],
             "meaning": "青木の相手は、そのすぐ前に川口へ電話し終えています。"
                        "電話は「持ち帰った人 → その持ち主」の向きなので、"
                        "青木の相手は**川口の教科書を持ち帰った人**です。"
                        "6人の取りちがえ方265通りをすべてしらべると井上に決まります。"},
            {"question": "江川が電話した相手はだれですか。",
             "answer": "青木", "choices": ["青木", "井上", "内山", "大田", "川口"],
             "meaning": "江川の相手は**井上と話し中**でした。"
                        "つまり「江川の相手が電話した先が井上」です。"
                        "井上に電話しているのは青木なので、江川の相手は青木です。"
                        "**「江川が電話した相手が井上」と読むと、265通りのどれも条件に合いません**。"
                        "解が消えることで、読み方のほうが決まります。"},
            {"question": "内山と教科書を交かんしたのはだれですか。",
             "answer": "大田", "choices": ["大田", "青木", "井上", "江川", "川口"],
             "meaning": "「僕も今、君に電話しようと思っていた」＝相手も内山にかけるところだった、"
                        "つまり**2人でおたがいの教科書を持ち帰っていた**ということです。"
                        "青木・井上・江川・川口は輪のほうに入っているので、のこる大田です。"},
            {"question": "青木が持って帰ったのは、だれの教科書ですか。",
             "answer": "井上", "choices": ["井上", "内山", "江川", "大田", "川口"],
             "meaning": "全体は 青木→井上→川口→江川→青木 の4人の輪と、内山↔大田の交かんです。"
                        "青木は井上に電話したので、青木が持ち帰ったのは井上の教科書です。"
                        "たしかめ：江川がかけた青木は井上と通話中 ✓、"
                        "青木がかけた井上は川口に電話し終えたところ ✓、"
                        "内山がかけた大田も内山にかけようとしていた ✓。"},
        ],
    },
]

L10 = [
    {
        "id": "hd3n_10_1", "src": "HG-1981", "star": 1,
        "title": "差のきまりを見つける", "category": "kisoku", "unit": "規則性・数列",
        "intro": "あるきまりにしたがって数がならんでいます。"
                 "となりとの**差**を書きこんでいくと、きまりが見えてきます。",
        "svg": "",
        "steps": [
            {"question": "1, 4, 7, □, 13, 16, 19, …　□に入る数はいくつですか。", "answer": "10",
             "meaning": "差がいつも3の列です。7＋3＝10です。"},
            {"question": "同じ列で、上から8番目の数はいくつですか。", "answer": "22",
             "meaning": "1から3ずつ7回ふえるので 1＋3×7＝22です。"},
            {"question": "1, 4, 6, 7, □, 12, 13, 16, 18, 19, …　□に入る数はいくつですか。",
             "answer": "10",
             "meaning": "差が 3, 2, 1, 3, 2, 1, … とくりかえします。"
                        "1→4は＋3、4→6は＋2、6→7は＋1、つぎはまた＋3で 7＋3＝10です。"
                        "**差が同じ数だと思いこむと まちがえます**。"},
            {"question": "1, 2, 4, 7, 11, □, 22, 29, 37, …　□に入る数はいくつですか。",
             "answer": "16",
             "meaning": "差が 1, 2, 3, 4, 5, … と1ずつふえます。11＋5＝16です。"},
            {"question": "同じ列で、□のつぎの数（上から7番目）はいくつですか。", "answer": "22",
             "meaning": "16＋6＝22です。つづきも 22＋7＝29、29＋8＝37 と合います。"},
        ],
    },
    {
        "id": "hd3n_10_2", "src": "HG-1982", "star": 2,
        "title": "かけ算のきまりを見つける", "category": "kisoku", "unit": "規則性・数列",
        "intro": "こんどは たし算ではなく **かけ算**でならんでいる数の列です。"
                 "となりの数で わってみると、きまりが見えてきます。",
        "svg": "",
        "steps": [
            {"question": "1, 3, □, 27, 81, 243, …　□に入る数はいくつですか。", "answer": "9",
             "meaning": "3倍ずつの列です。3×3＝9です。"},
            {"question": "同じ列で、243のつぎの数はいくつですか。", "answer": "729",
             "meaning": "243×3＝729です。"},
            {"question": "240, □, 60, 30, 15, …　□に入る数はいくつですか。", "answer": "120",
             "meaning": "半分ずつになる列です。240÷2＝120です。"},
            {"question": "128, 192, 288, □, 648, 972, …　□に入る数はいくつですか。",
             "answer": "432",
             "meaning": "128→192は 128×3÷2、192→288も 192×3÷2。"
                        "**3をかけて2でわる**列なので 288×3÷2＝432です。"
                        "差を見ると ＋64, ＋96, … とそろわないので、かけ算のきまりです。"},
            {"question": "1, 1, 2, 6, 24, □, 720, …　□に入る数はいくつですか。", "answer": "120",
             "meaning": "かける数が ×1, ×2, ×3, ×4, ×5, … と1ずつふえます。"
                        "24×5＝120で、そのつぎは 120×6＝720 と合います。"},
        ],
    },
    {
        "id": "hd3n_10_3", "src": "HG-1983", "star": 3,
        "title": "7ずつくりかえす数のならび", "category": "kisoku", "unit": "周期算",
        "intro": "1, 2, 1, 3, 2, 3, 2, 1, 2, 1, 3, 2, 3, 2, 1, 2, 1, 3, 2, 3, 2, …… と"
                 "「1213232」を くりかえしてならんでいます。",
        "svg": "",
        "steps": [
            {"question": "左から70番目の数字はいくつですか。", "answer": "2",
             "meaning": "70÷7＝10わり切れるので、くりかえしの7番目＝2です。"},
            {"question": "71番目の数字はいくつですか。", "answer": "1",
             "meaning": "71÷7＝10あまり1なので、くりかえしの1番目＝1です。"},
            {"question": "20回目に「323」が現れるとき、まん中の「2」は左から何番目ですか。",
             "answer": "138",
             "meaning": "「1213232」の中で「323」が出るのは4〜6番目の1か所だけ。"
                        "まん中の2は5番目です。20回目は 5＋7×19＝138番目です。"},
            {"question": "左から順にたしていくと、何番目までの和が2009になりますか。", "answer": "1005",
             "meaning": "1くりかえしの和は 1＋2＋1＋3＋2＋3＋2＝14。"
                        "2009÷14＝143あまり7なので、143くりかえし（1001番目）で2002。"
                        "そこから 1＋2＋1＋3＝7 で2009。1001＋4＝1005番目です。"},
        ],
    },
    {
        "id": "hd3n_10_4", "src": "HG-1984", "star": 2,
        "title": "4ずつふえる数のならび", "category": "kisoku", "unit": "規則性・数列",
        "intro": "3, 7, 11, 15, 19, 23, …… とならぶ数の列について考えます。",
        "svg": "",
        "steps": [
            {"question": "34番目の数はいくつですか。", "answer": "135",
             "meaning": "4ずつふえるので 3＋4×33＝135です。"},
            {"question": "125番目の数はいくつですか。", "answer": "499",
             "meaning": "3＋4×124＝499です。"},
            {"question": "1番目から125番目までの和はいくつですか。", "answer": "31375",
             "meaning": "はしとはしを足すと 3＋499＝502。それが125組の半分ぶんなので "
                        "502×125÷2＝31375です。"},
            {"question": "975は何番目ですか。", "answer": "244",
             "meaning": "(975−3)÷4＝243 で、はじめから243こ進んだところ。244番目です。"},
        ],
    },
    {
        "id": "hd3n_10_5", "src": "HG-1985", "star": 3,
        "title": "2, 6, 12, 20, 30, … の数の列", "category": "kisoku", "unit": "規則性・数列",
        "intro": "2, 6, 12, 20, 30, 42, 56, 72, 90, …… とならぶ数の列について考えます。"
                 "この数の列は、n番目が n×(n＋1) になっています。",
        "svg": "",
        "steps": [
            {"question": "100番目の数はいくつですか。", "answer": "10100",
             "meaning": "100×101＝10100です。"},
            {"question": "100番目までに、一の位が0である数は何こありますか。", "answer": "40",
             "meaning": "n×(n＋1)の一の位が0になるのは、nの一の位が 0・4・5・9 のときです。"
                        "1〜100に、そういうnは各10こずつで40こあります。"},
            {"question": "39番目までの和はいくつですか。", "answer": "21320",
             "meaning": "5番目までの和が 5×6×7÷3＝70 になったのと同じで、"
                        "39番目までなら 39×40×41÷3＝21320です。"},
        ],
    },
    {
        "id": "hd3n_10_6", "src": "HG-1986", "star": 3,
        "title": "4こずつの組でならぶ数", "category": "kisoku", "unit": "群数列",
        "intro": "1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6, 4, 5, 6, 7, …… とならぶ数の列について考えます。"
                 "4こずつの組になっていて、組が1つ進むごとに数が1ずつ大きくなります。",
        "svg": "",
        "steps": [
            {"question": "30番目の数は、何組目の何番目ですか。組の番号を答えなさい。", "answer": "8",
             "meaning": "30÷4＝7あまり2なので、8組目の2番目です。"},
            {"question": "30番目の数はいくつですか。", "answer": "9",
             "meaning": "8組目は 8, 9, 10, 11 なので、その2番目は9です。"},
            {"question": "1番目から30番目までの和はいくつですか。", "answer": "171",
             "meaning": "1組目から7組目までの和は、各組が (k)＋(k+1)＋(k+2)＋(k+3)＝4k＋6。"
                        "k＝1〜7で 4×28＋6×7＝112＋42＝154。"
                        "そこに8組目の 8＋9＝17 を足して171です。"},
            {"question": "21が3回目に現れるのは最初から何番目ですか。", "answer": "78",
             "meaning": "k組目には k, k+1, k+2, k+3 が入るので、21は 18・19・20・21 組目に出ます。"
                        "3回目は20組目の2番目＝4×19＋2＝78番目です。"},
        ],
    },
    {
        "id": "hd3n_10_7", "src": "HG-1987", "star": 3,
        "title": "前の2つをたす数のならび", "category": "kisoku", "unit": "規則性・数列",
        "intro": "1, 1, 2, 3, 5, 8, 13, 21, 34, …… とならぶ数の列について考えます。"
                 "3番目からは、前の2つの数をたした数になっています。",
        "svg": "",
        "steps": [
            {"question": "16番目の数はいくつですか。", "answer": "987",
             "meaning": "1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987 で16番目は987です。"},
            {"question": "1番目から14番目までの和はいくつですか。", "answer": "986",
             "meaning": "じつは「はじめのn個の和＝(n＋2)番目の数−1」になります。"
                        "16番目が987なので 987−1＝986です。"},
            {"question": "50番目までに、3でわり切れる数は何こありますか。", "answer": "12",
             "meaning": "3でわったあまりを書くと 1,1,2,0,2,2,1,0 の8こでくりかえします。"
                        "0が出るのは4番目と8番目、つまり4こおき。"
                        "50÷4＝12あまり2なので12こです。"},
        ],
    },
    {
        "id": "hd3n_10_8", "src": "HG-1988", "star": 3,
        "title": "山の形にくりかえす数のならび", "category": "kisoku", "unit": "群数列",
        "intro": "1／1, 2, 1／1, 2, 3, 2, 1／1, 2, 3, 4, 3, 2, 1／…… とならぶ数の列です。"
                 "k組目は 1から k まで上がって、また1まで下がります。",
        "svg": "",
        "steps": [
            {"question": "k組目には数が何こならびますか。k＝4のときの数を答えなさい。", "answer": "7",
             "meaning": "1,2,3,4,3,2,1 で7こ。k組目は 2×k−1 こです。"},
            {"question": "1組目からk組目までの合計は k×k こになります。"
                         "29組目まででは何こですか。", "answer": "841",
             "meaning": "1＋3＋5＋…＋(2×29−1)＝29×29＝841こです。"
                        "「…27, 28, 29, 28, …, 1」で終わるので29組目までです。"},
            {"question": "200番目の数はいくつですか。", "answer": "4",
             "meaning": "14×14＝196なので、200番目は15組目の4番目。"
                        "15組目は 1,2,3,4,… と上がっていくので4です。"},
            {"question": "350番目の数はいくつですか。", "answer": "12",
             "meaning": "18×18＝324なので、350番目は19組目の26番目。"
                        "19組目は19番目までが上り（1〜19）、そのあとが下り。"
                        "26−19＝7つ目の下りなので 19−7＝12です。"},
        ],
    },
]

LESSONS = {"2": L2, "3": L3, "4": L4, "5": L5, "6": L6, "7": L7,
           "9": L9, "10": L10, "11": L11, "12": L12}


# ══════════ 小4 灘合 ══════════════════════════════════
# （L8_9_10_ADD は下で定義してから LESSONS に足す）
def _venn_svg():
    """HG-2304 3つの円の7つの部分。ふちどりの3つ（2つだけ重なる所）に斜線"""
    import math as _m
    R, r = 46.0, 30.0
    O = (110.0, 100.0)
    cs = [(O[0] + r * _m.cos(_m.radians(90 + i * 120)),
           O[1] - r * _m.sin(_m.radians(90 + i * 120))) for i in range(3)]
    body = ['<defs><pattern id="hat" width="7" height="7" patternUnits="userSpaceOnUse" '
            'patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="%s" '
            'stroke-width="2"/></pattern></defs>' % GRAY]
    for c in cs:
        body.append('<circle cx="%.1f" cy="%.1f" r="%.0f" fill="rgba(79,124,255,0.08)" '
                    'stroke="%s" stroke-width="2"/>' % (c[0], c[1], R, BLUE))
    # 「2つだけ重なる」3か所の目印（斜線のかわりに小さな印を置く）
    for i in range(3):
        a, b = cs[i], cs[(i + 1) % 3]
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        px = O[0] + (mx - O[0]) * 1.75
        py = O[1] + (my - O[1]) * 1.75
        body.append('<circle cx="%.1f" cy="%.1f" r="9" fill="url(#hat)" stroke="%s" '
                    'stroke-width="1"/>' % (px, py, GRAY))
    # ★1行だと枠から左右にはみ出す（実測 2026-08-09）。2行に分ける
    body.append(_t(110, 190, "しゃ線の3か所は同じ色", GRAY, 10))
    body.append(_t(110, 206, "のこり4か所に3色を全部使う", GRAY, 10))
    return _svg(220, 218, "\n".join(body))


G4 = [
    {
        "id": "hd4n_01_1", "src": "HG-2301", "star": 3,
        "title": "3人が4種類から2種類ずつ", "category": "baai", "unit": "場合の数",
        "intro": "レストランでA、B、Cの3人が、4種類の料理の中から1人2種類ずつ注文します。"
                 "AとBの2人について共通に選んだ料理は1種類だけであり、"
                 "AとC、BとCについても共通に選んだ料理が1種類だけです。",
        "svg": "",
        "steps": [
            {"question": "4種類から2種類を選ぶ選び方は何通りですか。", "answer": "6",
             "meaning": "4×3÷2＝6通りです。"},
            {"question": "Aの選び方が決まったとき、Bの選び方は何通りありますか。", "answer": "4",
             "meaning": "Aと共通が1種類だけになるのは、Aの2種類のうち1つを使い、"
                        "のこりの2種類から1つを使うとき。2×2＝4通りです。"},
            {"question": "このような注文の仕方は全部で何通りですか。", "answer": "48",
             "meaning": "AとBを決めると、Cは A・B の両方とちょうど1種類ずつ共通になるように"
                        "選ぶことになり、その選び方は2通りです。6×4×2＝48通りです。"},
        ],
    },
    {
        "id": "hd4n_01_2", "src": "HG-2302", "star": 3,
        "title": "50円玉と100円玉のさいふ", "category": "baai", "unit": "場合の数",
        "intro": "50円玉と100円玉ばかり、あわせて20個入ったさいふを持って本を買いに行きました。"
                 "本を1冊買った後、さいふの中を見ると12枚の硬貨が入っており、"
                 "その金額は本を買った金額と同じでした。おつりはもらっていません。",
        "svg": "",
        "steps": [
            {"question": "本を買うのに使った硬貨は何枚ですか。", "answer": "8",
             "meaning": "20−12＝8枚です。"},
            {"question": "はじめにさいふに入っていた金額は、本の値だんの何倍ですか。", "answer": "2",
             "meaning": "使った8枚も、のこった12枚も、どちらも本の値だんと同じ金額です。"
                        "だからはじめの金額は本の値だんの2倍です。"},
            {"question": "考えられる本の値だんは何通りありますか。", "answer": "5",
             "meaning": "使った100円玉を□枚とすると、50円玉は 8−□ 枚。"
                        "本の値だんは 400＋50×□ 円になります。"
                        "枚数のつじつまが合うのは □が4〜8のときで、"
                        "600円・650円・700円・750円・800円の5通りです。"},
        ],
    },
    {
        "id": "hd4n_01_3", "src": "HG-2303", "star": 3,
        "title": "西暦が昭和の年数でわり切れる年", "category": "kazu", "unit": "倍数・約数",
        "intro": "平成元年（昭和64年）は西暦1989年です。"
                 "昭和の時代に、西暦の年数が昭和の年数でわり切れる年は何回あったでしょうか。",
        "svg": "",
        "steps": [
            {"question": "昭和□年は西暦何年ですか。□を使わずに、昭和1年の西暦を答えなさい。",
             "answer": "1926",
             "meaning": "昭和64年が1989年なので、昭和1年は 1989−63＝1926年です。"
                        "つまり 昭和□年＝西暦(1925＋□)年 です。"},
            {"question": "西暦が昭和の年数でわり切れるとき、1925は□でわり切れますか。"
                         "わり切れるなら1、わり切れないなら0と答えなさい。", "answer": "1",
             "meaning": "(1925＋□)÷□ の あまりは 1925÷□ の あまりと同じです。"
                        "だから□は1925の約数です。"},
            {"question": "そのような年は全部で何回ありましたか。", "answer": "7",
             "meaning": "1925＝5×5×7×11 の約数のうち、64以下のものは "
                        "1・5・7・11・25・35・55 の7つです。"},
        ],
    },
    {
        "id": "hd4n_01_4", "src": "HG-2304", "star": 2,
        "title": "3つの円の7つの部分をぬり分ける", "category": "baai", "unit": "場合の数",
        "intro": "右の図のように3つの円がかかれています。円の内部の7つの部分を"
                 "青・赤・黄・緑の4色でぬり分けます。"
                 "図のしゃ線で示した3つの部分は同じ色をぬり、"
                 "のこりの4つの部分には、のこりの3色を全部使います。",
        "svg": _venn_svg(),
        "steps": [
            {"question": "しゃ線の3つの部分にぬる色の選び方は何通りですか。", "answer": "4",
             "meaning": "4色から1色を選ぶので4通りです。"},
            {"question": "のこり4つの部分に3色を全部使うぬり方は何通りですか。", "answer": "36",
             "meaning": "3色の使い方は 3×3×3×3＝81通りありますが、"
                        "そのうち2色しか使わないもの・1色しか使わないものを引きます。"
                        "81−3×(2×2×2×2)＋3＝81−48＋3＝36通りです。"},
            {"question": "ぬり方は全部で何通りですか。", "answer": "144",
             "meaning": "4×36＝144通りです。"},
        ],
    },
    {
        "id": "hd4n_01_5", "src": "HG-2305", "star": 2,
        "title": "電話番号を押す時間", "category": "baai", "unit": "場合の数",
        "intro": "プッシュボタン式の電話機で、番号1を押すときは0.1秒間、番号2は0.2秒間、…、"
                 "番号9は0.9秒間、番号0を押すときは1秒間押すことにします。"
                 "また、番号と番号の間は0.1秒間の間かくをあけます。"
                 "4けたの電話番号をかけるのに1.1秒かかりました。",
        "svg": "",
        "steps": [
            {"question": "番号と番号の間の間かくは、合わせて何秒ですか。", "answer": "0.3",
             "meaning": "4けたなので間は3か所。0.1×3＝0.3秒です。"},
            {"question": "ボタンを押していた時間は合わせて何秒ですか。", "answer": "0.8",
             "meaning": "1.1−0.3＝0.8秒です。0.1秒を1つ分と数えると8つ分です。"},
            {"question": "この4けたの電話番号は何通り考えられますか。", "answer": "35",
             "meaning": "0を押すと1秒＝10こ分かかり、8こ分をこえるので0は使えません。"
                        "1〜9の4つの数で合計8こ分になる組は、"
                        "8を4つに分ける分け方で35通りです。"},
        ],
    },
    {
        "id": "hd4n_01_6", "src": "HG-2306", "star": 3,
        "title": "4つの立方体でつくる立体", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "1辺1cmの立方体を4つすべて使って、面と面がぴったり重なるようにならべて"
                 "1つの立体を作ります。回転して動かしたときにまったく同じ形になるものは"
                 "1種類と数えます。",
        "svg": "",
        "steps": [
            {"question": "たいらな（1枚の板のような）形は何種類できますか。", "answer": "5",
             "meaning": "正方形4つのならべ方（テトロミノ）と同じで、"
                        "I・O・L・T・S の5種類です。"
                        "ただし立体では、うら返しても回転で重なるので L と J は同じ、S と Z も同じです。"},
            {"question": "立体は全部で何種類できますか。", "answer": "8",
             "meaning": "たいらな5種類に、立体でしか作れない3種類を足して8種類です。"},
        ],
    },
    {
        "id": "hd4n_01_7", "src": "HG-2307", "star": 3,
        "title": "9人を3人ずつ3組に分ける", "category": "baai", "unit": "場合の数",
        "intro": "9人の生徒がいます。A・B・Cの3人はたがいに仲が悪く、D・E・Fの3人も、"
                 "G・H・Iの3人もたがいに仲が悪いことがわかっています。"
                 "この9人を3人ずつの3組に分けます（組の区別はありません）。"
                 "仲の悪い者どうしが同じ組にならないようにします。",
        "svg": "",
        "steps": [
            {"question": "何の条件もつけないとき、9人を3人ずつ3組に分ける分け方は何通りですか。",
             "answer": "280",
             "meaning": "9人から3人を選び、のこり6人から3人を選ぶと 84×20＝1680。"
                        "組の区別がないので 3×2×1＝6 でわって280通りです。"},
            {"question": "仲の悪い者どうしが同じ組にならない分け方は何通りですか。", "answer": "252",
             "meaning": "同じグループの3人がそろってしまう分け方などを取りのぞくと252通りです。"
                        "どの組も「A・B・Cから1人、D・E・Fから1人、G・H・Iから1人」に"
                        "なるとはかぎらないところが、この問題のむずかしさです。"},
        ],
    },
    {
        "id": "hd4n_01_8", "src": "HG-2308", "star": 3,
        "title": "2×4のマス目に1〜8をならべる", "category": "baai", "unit": "場合の数",
        "intro": "たて2・横4のマス目に1から8までの数字を1つずつ入れます。"
                 "横のならびはどちらも右に行くほど大きくなり、"
                 "たてのならびはすべて下のほうが上より大きくなるようにします。",
        "svg": "",
        "steps": [
            {"question": "左上のマスに入る数はいくつですか。", "answer": "1",
             "meaning": "右へも下へも大きくなるので、いちばん小さい1は左上にしか入りません。"},
            {"question": "右下のマスに入る数はいくつですか。", "answer": "8",
             "meaning": "同じ理由で、いちばん大きい8は右下です。"},
            {"question": "ならべ方は全部で何通りですか。", "answer": "14",
             "meaning": "上の段に入る4つの数の選び方を考えると、"
                        "どの位置でも「上の段に入った個数」が「下の段に入った個数」以上に"
                        "なっている必要があります。数え上げると14通りです。"},
        ],
    },
    {
        "id": "hd4n_01_9", "src": "HG-2309", "star": 3,
        "title": "番号の和の偶奇で勝敗が決まるトーナメント", "category": "baai", "unit": "推理・論理",
        "intro": "8人が①から⑧のカードを1枚ずつ引き、その番号でトーナメントをします。\n"
                 "**①2人の番号の和が奇数のときは、番号の小さい人の勝ち。**\n"
                 "**②2人の番号の和が偶数のときは、番号の大きい人の勝ち。**\n"
                 "3戦全勝が1位、決勝で負けた人が2位。"
                 "準決勝で負けた2人で3位決定戦をして、勝った人が3位、負けた人が4位です。",
        "svg": "",
        "steps": [
            {"question": "①と②が対戦すると、勝つのはどちらですか。",
             "answer": "①", "choices": ["①", "②"],
             "meaning": "1＋2＝3で奇数なので、小さいほうの①が勝ちます。"},
            {"question": "⑧が勝てるのは、相手の番号がどんなときですか。",
             "answer": "偶数のとき", "choices": ["偶数のとき", "奇数のとき", "いつでも", "勝てない"],
             "meaning": "和が偶数になるのは、2人とも偶数か2人とも奇数のとき。"
                        "そのとき大きいほうが勝つので、⑧は相手が偶数なら勝てます。"
                        "相手が奇数だと和が奇数になり、小さい相手の勝ちです。"},
            {"question": "左はしが①、右はしが⑧に決まっているとき、"
                         "のこりの6か所に②〜⑦を入れる方法は何通りありますか。"
                         "（1回戦の2人は小さいほうを左に書きます）", "answer": "180",
             "meaning": "①の相手は6通り。のこり5人から次の組の2人を選ぶのが 5×4÷2＝10通り、"
                        "その次が 3×2÷2＝3通り、最後は1通り。6×10×3＝180通りです。"},
            {"question": "①②③④⑤⑥⑦⑧の順にならんだとき、1位はだれですか。",
             "answer": "⑦", "choices": ["⑦", "⑧", "③", "⑤", "①"],
             "meaning": "1回戦はどれも和が奇数なので小さいほうが勝ち、①③⑤⑦。"
                        "準決勝は ①と③（和4・偶数）で③、⑤と⑦（和12・偶数）で⑦。"
                        "決勝は③と⑦（和10・偶数）で**⑦**です。"},
            {"question": "同じならびのとき、3位はだれですか。",
             "answer": "⑤", "choices": ["⑤", "①", "③", "⑧"],
             "meaning": "準決勝で負けたのは①と⑤。和6は偶数なので大きい**⑤**が3位です。"
                        "2位は③でした。"},
            {"question": "1位が⑧、2位が④、4位が⑤になるならびは、左から順に"
                         "1, □, 4, 7, 2, 3, 6, 8 です。□に入る数はいくつですか。",
             "answer": "5",
             "meaning": "1回戦 1と5→5、4と7→4、2と3→2、6と8→8。"
                        "準決勝 5と4→4、2と8→8。決勝 4と8→**⑧**（2位は④）。"
                        "3位決定戦 5と2→2なので3位②・4位⑤ ✓。"
                        "180通りをすべてしらべると、条件に合うのはこの1通りだけです。"
                        "**⑧は3回とも相手が偶数（6・2・4）**でなければ勝てないからです。"},
        ],
    },
    {
        "id": "hd4n_01_10", "src": "HG-2310", "star": 3,
        "title": "整数を和に分けて積を最大にする", "category": "kazu", "unit": "数の性質",
        "intro": "整数を2こ以上の整数の和に分けて、その積をできるだけ大きくします。"
                 "たとえば10なら 1＋9→9、2＋8→16、2＋3＋5→30、"
                 "2＋2＋2＋2＋2→32 のようになります。",
        "svg": "",
        "steps": [
            {"question": "10を分けたとき、積がいちばん大きくなるのはいくつですか。", "answer": "36",
             "meaning": "10＝3＋3＋4 で 3×3×4＝36。10＝3＋3＋2＋2 でも 3×3×2×2＝36です。"
                        "全部の分け方を機械でしらべても36が最大でした。"},
            {"question": "分け方に4があるとき、それを2＋2に書きかえると積はどうなりますか。",
             "answer": "変わらない", "choices": ["変わらない", "大きくなる", "小さくなる"],
             "meaning": "2×2＝4なので積は同じです。だから4は使っても使わなくても同じです。"},
            {"question": "2が3こあるとき、それを3＋3に書きかえると積はどうなりますか。",
             "answer": "大きくなる", "choices": ["大きくなる", "変わらない", "小さくなる"],
             "meaning": "2＋2＋2＝6＝3＋3で、2×2×2＝8 より 3×3＝9 のほうが大きい。"
                        "だから**2は多くても2こまで**にします。"},
            {"question": "1は使わないほうがよいのはなぜですか。",
             "answer": "かけても積がふえないから",
             "choices": ["かけても積がふえないから", "1は整数でないから",
                         "1は和にできないから", "1をかけると積が減るから"],
             "meaning": "1をかけても積は変わらないので、"
                        "その1をほかの数に足したほうが積は大きくなります。"
                        "5以上の数も、2と（その数−2）に分けると積がふえるので使いません。"},
            {"question": "20を分けたとき、積のいちばん大きい値はいくつですか。", "answer": "1458",
             "meaning": "**3をできるだけ多く**使います。20＝3×6＋2 なので 3を6こと2を1こ。"
                        "3×3×3×3×3×3×2＝729×2＝**1458**です。"
                        "3を5こと5なら1215、2を10こなら1024、3を4こと2を4こなら1296で、"
                        "どれも1458より小さくなります。"},
        ],
    },
]


G4_2 = [
    {
        "id": "hd4n_02_1", "src": "HG-2311", "star": 2,
        "title": "となり合った2数の和", "category": "kazu", "unit": "数の性質",
        "intro": "ちがう4つの整数を小さい方から順にならべ、となり合った2数の和をもとめると、"
                 "それぞれ28、32、59でした。",
        "svg": "",
        "steps": [
            {"question": "1番目と3番目の数のちがいはいくつですか。", "answer": "4",
             "meaning": "（2番目＋3番目）−（1番目＋2番目）＝32−28＝4です。"},
            {"question": "1番目の数はいくつですか。", "answer": "13",
             "meaning": "3番目＝1番目＋4。2番目＝28−1番目。"
                        "3番目＋4番目＝59 なので 4番目＝59−(1番目＋4)＝55−1番目。"
                        "4つが小さい順にちがう整数になるのは 13, 15, 17, 42 のときです。"},
            {"question": "いちばん大きい数はいくつですか。", "answer": "42",
             "meaning": "4数は 13, 15, 17, 42。たしかめ 13＋15＝28、15＋17＝32、17＋42＝59 ✓"},
        ],
    },
    {
        "id": "hd4n_02_2", "src": "HG-2312", "star": 3,
        "title": "30本の旗を2本ずつ集める", "category": "tokusan", "unit": "植木算",
        "intro": "まっすぐな道路にそって、5m間かくで30本の旗が立っています。"
                 "20番目の旗のところにいるA君が、すべての旗を20番目の旗のところに集めます。"
                 "旗は一度に2本まで持てるものとします。",
        "svg": "",
        "steps": [
            {"question": "20番目より左には旗が何本ありますか。", "answer": "19",
             "meaning": "1番目から19番目までの19本です。右には21番目から30番目までの10本あります。"},
            {"question": "左がわの19本を集めるのに、何m歩きますか。", "answer": "1000",
             "meaning": "2本ずつ持てるので、遠いほうから2本ずつ取りに行きます。"
                        "いちばん遠い95mの地点まで行って帰ると190m、次は85mの地点で170m…"
                        "と10回。(95＋85＋…＋5)×2＝500×2＝1000mです。"},
            {"question": "右がわの10本を集めるのに、何m歩きますか。", "answer": "300",
             "meaning": "同じように 50m・40m・30m・20m・10m の5回。"
                        "(50＋40＋30＋20＋10)×2＝150×2＝300mです。"},
            {"question": "A君は最も短くて何m歩きますか。", "answer": "1300",
             "meaning": "1000＋300＝1300mです。"},
        ],
    },
    {
        "id": "hd4n_02_3", "src": "HG-2313", "star": 3,
        "title": "各位の2乗の和をくりかえす", "category": "kazu", "unit": "数の性質",
        "intro": "1996 の各位の数 1, 9, 9, 6 から 1×1＋9×9＋9×9＋6×6＝199 を作り、"
                 "さらに 199 から 1×1＋9×9＋9×9＝163 というふうに新しい数を順に作っていきます。"
                 "この操作を何回かつづけると、ある数から先はくりかえし同じ数の列が現れます。",
        "svg": "",
        "steps": [
            {"question": "1996 から作った次の数はいくつですか。", "answer": "199",
             "meaning": "1＋81＋81＋36＝199です。"},
            {"question": "くりかえされる数の列の中で、いちばん大きい数はいくつですか。",
             "answer": "145",
             "meaning": "つづけると 4→16→37→58→89→145→42→20→4 の8この輪に入ります。"
                        "その中でいちばん大きいのは145です。"},
        ],
    },
    {
        "id": "hd4n_02_4", "src": "HG-2314", "star": 2,
        "title": "方陣の過不足", "category": "tokusan", "unit": "方陣算",
        "intro": "何人かの生徒を、たてが横より2列多い長方形にならばせたら、43人があまりました。"
                 "そこで、たてを1列、横を2列ふやして長方形にならばせようとしたら、8人分あきました。",
        "svg": "",
        "steps": [
            {"question": "はじめの横の列は何列ですか。", "answer": "15",
             "meaning": "横を□列とすると、たては□＋2列。人数は □×(□＋2)＋43。"
                        "ふやしたあとは (□＋2)×(□＋3)−8。この2つが等しくなるのは□＝15のときです。"},
            {"question": "生徒は何人ですか。", "answer": "298",
             "meaning": "15×17＋43＝255＋43＝298人。"
                        "たしかめ 17×18−8＝306−8＝298人 ✓"},
        ],
    },
    {
        "id": "hd4n_02_5", "src": "HG-2315", "star": 3,
        "title": "3つのあまりから本のページ数", "category": "kazu", "unit": "倍数・約数",
        "intro": "ある本を読むのに、1日5ページずつ読むと4ページ残り、"
                 "7ページずつ読むと5ページ残り、9ページずつ読むと6ページ残ります。"
                 "この本は200ページ以下です。",
        "svg": "",
        "steps": [
            {"question": "5でわると4あまり、7でわると5あまり、9でわると6あまる数を考えます。"
                         "この本は何ページですか。", "answer": "159",
             "meaning": "5でわって4あまる数は 4, 9, 14, …。"
                        "7でわって5あまる数と重なるのは 19, 54, 89, 124, 159, 194…（35おき）。"
                        "そのうち9でわって6あまるのは159だけです（200ページ以下）。"},
            {"question": "9ページずつ読むと何日目で読み終わりますか。最後の日も数に入れます。",
             "answer": "18",
             "meaning": "159÷9＝17あまり6なので、17日読んで6ページ残り、18日目で読み終わります。"},
        ],
    },
    {
        "id": "hd4n_02_6", "src": "HG-2316", "star": 3,
        "title": "遊園地の入場券", "category": "tokusan", "unit": "消去算",
        "intro": "大人175人分、子ども175人分の遊園地の入場券の代金として60万円用意したところ、"
                 "大人1人の入場券の代金よりも1855円多い金額だけあまりました。"
                 "子ども1人の入場券の代金は、大人1人の入場券の代金の半額です。",
        "svg": "",
        "steps": [
            {"question": "大人175人分と子ども175人分は、大人何人分の代金にあたりますか。",
             "answer": "262.5",
             "meaning": "子どもは大人の半額なので、子ども175人分＝大人87.5人分。"
                        "175＋87.5＝262.5人分です。"},
            {"question": "大人1人の入場券は何円ですか。", "answer": "2270",
             "meaning": "使ったのは 600000−(大人1人＋1855) 円。"
                        "大人1人を□円とすると 262.5×□＝600000−□−1855。"
                        "263.5×□＝598145 なので □＝2270円です。"},
            {"question": "子ども1人の入場券は何円ですか。", "answer": "1135",
             "meaning": "2270÷2＝1135円。"
                        "たしかめ 2270×175＋1135×175＝397250＋198625＝595875円。"
                        "600000−595875＝4125円あまり、これは 2270＋1855＝4125円 ✓"},
        ],
    },
    {
        "id": "hd4n_02_7", "src": "HG-2317", "star": 3,
        "title": "1, 2, 4, 6, 9, 12, 16, … の数の列", "category": "kisoku", "unit": "規則性・数列",
        "intro": "1, 2, 4, 6, 9, 12, 16, 20, 25, … とならぶ数の列があります。"
                 "ふえ方が 1, 2, 2, 3, 3, 4, 4, 5, 5, … となっています。",
        "svg": "",
        "steps": [
            {"question": "20番目の数はいくつですか。", "answer": "110",
             "meaning": "奇数番目は平方数（1番目1、3番目4、5番目9…）、"
                        "偶数番目はとなり合う数のかけ算（2番目1×2、4番目2×3、6番目3×4…）です。"
                        "20番目は10×11＝110です。"},
            {"question": "21番目の数はいくつですか。", "answer": "121",
             "meaning": "21番目は奇数番目なので 11×11＝121です。"},
            {"question": "20番目と21番目の和はいくつですか。", "answer": "231",
             "meaning": "110＋121＝231です。"},
        ],
    },
    {
        "id": "hd4n_02_8", "src": "HG-2318", "star": 3,
        "title": "3種類のポンプ", "category": "tokusan", "unit": "仕事算",
        "intro": "A、B、C3種類のポンプが2台ずつあります。"
                 "ある水そうの水を全部くみ出すのに、A2台とB1台では56分、"
                 "B2台とC1台では40分、C2台とA1台では35分かかります。",
        "svg": "",
        "steps": [
            {"question": "水そう全体を1とすると、A2台とB1台が1分にくみ出す量は"
                         "何分の1ですか。分母を答えなさい。", "answer": "56",
             "meaning": "56分で全部くみ出すので、1分では56分の1です。"},
            {"question": "3つの式を全部たすと、A・B・Cが合わせて何台ぶんになりますか。",
             "answer": "9",
             "meaning": "(A2＋B1)＋(B2＋C1)＋(C2＋A1)＝A3＋B3＋C3で、9台ぶんです。"},
            {"question": "6台のポンプを全部使うと何分かかりますか。", "answer": "21",
             "meaning": "3つの式の1分あたりをたすと 1/56＋1/40＋1/35＝(5＋7＋8)/280＝20/280＝1/14。"
                        "これがA3台＋B3台＋C3台ぶんなので、"
                        "A2台＋B2台＋C2台なら その3分の2で 1/21。だから21分です。"},
        ],
    },
    {
        "id": "hd4n_02_9", "src": "HG-2319", "star": 3,
        "title": "行列と発売窓口", "category": "tokusan", "unit": "ニュートン算",
        "intro": "ある野球場で前売り券を発売し始めたとき、すでに600人がならんでいて、"
                 "毎分20人ずつ行列に加わっていきます。"
                 "発売窓口が1つのときは15分で行列がなくなります。",
        "svg": "",
        "steps": [
            {"question": "15分の間に、新しく行列に加わったのは何人ですか。", "answer": "300",
             "meaning": "20×15＝300人です。"},
            {"question": "窓口1つが15分で何人にさばきましたか。", "answer": "900",
             "meaning": "はじめの600人と、あとから来た300人を合わせて900人です。"},
            {"question": "窓口1つは1分に何人さばけますか。", "answer": "60",
             "meaning": "900÷15＝60人です。"},
            {"question": "窓口が2つのときは何分で行列がなくなりますか。", "answer": "6",
             "meaning": "2つで1分に120人さばけますが、20人ふえるので実さいは"
                        "1分に100人ずつへります。600÷100＝6分です。"},
        ],
    },
    {
        "id": "hd4n_02_10", "src": "HG-2320", "star": 2,
        "title": "みかんの箱づめ", "category": "tokusan", "unit": "過不足算・差集め算",
        "intro": "いくつかのみかんがあって、1はこに32個ずつ入れていくと18個あまりました。"
                 "そこへ102個加えて34個づめにしたら、はじめより1はこふえて、"
                 "最後のはこのみかんは2個の不足となりました。",
        "svg": "",
        "steps": [
            {"question": "はじめの箱の数を□はことすると、みかんの数は 32×□＋18 個です。"
                         "102個加えたあとのみかんの数は、34×(□＋1)−2 個です。"
                         "はじめの箱は何はこですか。", "answer": "44",
             "meaning": "32×□＋18＋102＝34×(□＋1)−2 より "
                        "32×□＋120＝34×□＋32。2×□＝88 で □＝44はこです。"},
            {"question": "はじめ、みかんは何個ありましたか。", "answer": "1426",
             "meaning": "32×44＋18＝1408＋18＝1426個。"
                        "たしかめ 1426＋102＝1528個。34×45－2＝1530－2＝1528個 ✓"},
        ],
    },
]


def _octagon2tri_svg():
    """HG-1964 細長い三角形2つが交わって八角形をつくる。

    ★交点がちょうど4つになるように置く。そうすると
      「どちらの三角形にも属さない頂点2つ×2 ＋ 交点4つ ＝ 八角形」になる。
      重なった部分（四角形）は点線、外がわ（八角形）は実線で描き分ける。
    """
    # ★八角形になる条件＝**交点4つ＋たがいに頂点を1つずつ内がわに差しこむ**（4＋2＋2＝8）。
    #   「左右対称の細い三角形2つ」だと辺が平行になり交点が2つしかできず六角形になる。
    #   下の座標は、その条件を満たすものを機械でさがして決めた（2026-08-09）
    t1 = [(37.0, 43.0), (208.0, 48.0), (188.0, 138.0)]
    t2 = [(188.0, 136.0), (38.0, 72.0), (243.0, 42.0)]

    def seg_x(p1, p2, p3, p4):
        d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
        if abs(d) < 1e-9:
            return None
        t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
        u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
        if 0 < t < 1 and 0 < u < 1:
            return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))
        return None

    pts = []
    for i in range(3):
        for j in range(3):
            r = seg_x(t1[i], t1[(i + 1) % 3], t2[j], t2[(j + 1) % 3])
            if r:
                pts.append(r)
    body = ['<polygon points="%s" fill="none" stroke="%s" stroke-width="2"/>'
            % (" ".join("%.1f,%.1f" % p for p in t1), BLUE),
            '<polygon points="%s" fill="none" stroke="%s" stroke-width="2"/>'
            % (" ".join("%.1f,%.1f" % p for p in t2), ORANGE)]
    if len(pts) == 4:
        cx = sum(p[0] for p in pts) / 4
        cy = sum(p[1] for p in pts) / 4
        import math as _m
        pts.sort(key=lambda p: _m.atan2(p[1] - cy, p[0] - cx))
        body.append('<polygon points="%s" fill="rgba(255,107,107,0.14)" stroke="%s" '
                    'stroke-width="2" stroke-dasharray="5 3"/>'
                    % (" ".join("%.1f,%.1f" % p for p in pts), RED))
        body.append(_t("%.1f" % cx, "%.1f" % (cy + 4), "34cm", RED, 11, bold=True))
    body.append(_t(136, 22, "どちらも3辺が 15cm・25cm・35cm の三角形", GRAY, 10))
    body.append(_t(136, 158, "外がわの実線が八角形", GRAY, 10))
    body.append(_t(136, 172, "点線が重なった部分（まわり34cm）", GRAY, 10))
    return _svg(272, 184, "\n".join(body))


def _cubocta_svg():
    """HG-1974 立方体（点線）のかどを、各辺のまん中まで切り落とした立体"""
    import math as _m
    s, cx, cy = 30.0, 118.0, 108.0
    P = lambda x, y, z: (cx + (x - y) * s * 0.866, cy + (x + y) * s * 0.5 - z * s)
    cube = [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
            (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
    edges = [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4),
             (0, 4), (1, 5), (2, 6), (3, 7)]
    body = []
    for a, b in edges:                       # もとの立方体は点線
        p, q = P(*cube[a]), P(*cube[b])
        body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                    'stroke-width="1.1" stroke-dasharray="4 3"/>' % (p[0], p[1], q[0], q[1], GRAY))
    # 各辺のまん中＝新しい頂点（12こ）
    mids = []
    for a, b in edges:
        mids.append(tuple((cube[a][i] + cube[b][i]) / 2 for i in range(3)))
    for m in mids:
        p = P(*m)
        body.append('<circle cx="%.1f" cy="%.1f" r="3.4" fill="%s"/>' % (p[0], p[1], RED))
    # 立方八面体の辺＝中点どうしの距離が √2 のもの
    for i in range(len(mids)):
        for j in range(i + 1, len(mids)):
            d = _m.dist(mids[i], mids[j])
            if abs(d - _m.sqrt(2)) < 1e-6:
                p, q = P(*mids[i]), P(*mids[j])
                body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                            'stroke-width="1.8"/>' % (p[0], p[1], q[0], q[1], BLUE))
    body.append(_t(118, 204, "点線＝もとの立方体。●＝各辺のまん中", GRAY, 11))
    return _svg(236, 216, "\n".join(body))


def _spiral_svg():
    """HG-1990 うずまきに1から整数をうめた方眼。㋐と㋑の場所に印"""
    grid = {}
    grid[(0, 0)] = 1
    n = 1
    for k in range(1, 5):
        x, y = 0, -k
        n += 1
        grid[(x, y)] = n
        for dx, dy, cnt in ((-1, 0, k), (0, 1, 2 * k), (1, 0, 2 * k),
                            (0, -1, 2 * k), (-1, 0, k - 1)):
            for _ in range(cnt):
                x, y = x + dx, y + dy
                n += 1
                grid[(x, y)] = n
    cell = 30.0
    ox, oy = 118.0, 96.0
    body = []
    for gx in range(-2, 3):
        for gy in range(-4, 3):
            v = grid.get((gx, gy))
            X, Y = ox + gx * cell, oy - gy * cell
            show = v is not None and v <= 27
            mark = "㋐" if (gx, gy) == (1, -4) else ""
            if not show and not mark:
                continue
            body.append('<rect x="%.1f" y="%.1f" width="%.0f" height="%.0f" fill="%s" '
                        'stroke="%s" stroke-width="1.2"/>'
                        % (X - cell / 2, Y - cell / 2, cell, cell,
                           "#fff7f0" if mark else "#f8f9ff", GRAY))
            body.append(_t("%.1f" % X, "%.1f" % (Y + 5), mark or str(v),
                           RED if mark else INK, 13, bold=bool(mark)))
    # ㋑＝1から右へ5番目（この図の外なので、右に矢印で示す）
    body.append(_t(ox + 2.6 * cell, oy + 5, "→", GRAY, 16, anchor="start"))
    body.append(_t(ox + 3.4 * cell, oy + 5, "㋑", RED, 13, anchor="start", bold=True))
    body.append(_t(118, 264, "㋑は1から右へ5番目のマス", GRAY, 11))
    return _svg(252, 276, "\n".join(body))




def _pascal_svg():
    """HG-1989 パスカルの三角形（8段目まで）"""
    rows = [[1]]
    for _ in range(7):
        p = rows[-1]
        rows.append([1] + [p[i] + p[i + 1] for i in range(len(p) - 1)] + [1])
    body = []
    for r, row in enumerate(rows):
        y = 26 + r * 26
        for c, v in enumerate(row):
            x = 150 + (c - (len(row) - 1) / 2) * 34
            body.append(_t("%.1f" % x, y, str(v), INK, 12))
    body.append(_t(150, 236, "となり合う2つをたすと下の数になる", GRAY, 11))
    return _svg(300, 248, "\n".join(body))


def _kaiten_svg():
    """HG-2201 方眼の㋐㋑と回転の軸ℓ（1マス＝1cm）。
    ㋑は下半分（y10〜14）が軸からはなれていて、回すと中がうつろになる。"""
    NX, NY = 7, 15
    u, W = 16.0, 240
    ox, oy = (W - NX * u) / 2, 22.0
    P = lambda x, y: (ox + x * u, oy + y * u)
    ln = lambda a, b, c, w: ('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                             'stroke-width="%s"/>' % (a[0], a[1], b[0], b[1], c, w))
    body = []
    for i in range(NX + 1):                        # うすい方眼
        body.append(ln(P(i, 0), P(i, NY), "#dde3f5", 1))
    for j in range(NY + 1):
        body.append(ln(P(0, j), P(NX, j), "#dde3f5", 1))
    body.append(ln(P(0, 0), P(0, NY), INK, 3.2))   # 回転の軸ℓ（太線）
    body.append(_t("%.1f" % P(0, 0)[0], "%.1f" % (P(0, 0)[1] - 7), "ℓ", INK, 14, bold=True))
    A = [(0, 1), (4, 1), (4, 4), (0, 4)]
    B = [(0, 6), (2, 6), (2, 8), (4, 8), (4, 10), (6, 10),
         (6, 14), (4, 14), (4, 12), (2, 12), (2, 10), (0, 10)]
    for pts, col, nm, at in ((A, BLUE, "㋐", (1.3, 2.9)), (B, ORANGE, "㋑", (1.2, 7.4))):
        body.append('<polygon points="%s" fill="%s" fill-opacity="0.13" stroke="%s" '
                    'stroke-width="2" stroke-linejoin="round"/>'
                    % (" ".join("%.1f,%.1f" % P(*p) for p in pts), col, col))
        q = P(*at)
        body.append(_t("%.1f" % q[0], "%.1f" % q[1], nm, col, 15, bold=True))
    for i in range(NX):                            # 軸からの目もり（半径が読めるように）
        q = P(i, NY)
        body.append(_t("%.1f" % q[0], "%.1f" % (q[1] + 13), str(i), GRAY, 10))
    body.append(_t(W / 2, oy + NY * u + 32, "1マス＝1cm　太線ℓが回転の軸", GRAY, 11))
    return _svg(W, int(oy + NY * u + 44), "\n".join(body))


L8_9_10_ADD = [
    {
        "id": "hd3n_10_9", "src": "HG-1989", "star": 3,
        "title": "パスカルの三角形", "category": "kisoku", "unit": "規則性・数列",
        "intro": "右の図のように、あるきまりにしたがって数がならんでいます。"
                 "となり合う2つの数をたすと、その下の数になります。",
        "svg": _pascal_svg(),
        "steps": [
            {"question": "各段の左から3番目の数は 1, 3, 6, 10, … とならびます。"
                         "上から10段目の左から3番目の数はいくつですか。", "answer": "36",
             "meaning": "1, 3, 6, 10, 15, 21, 28, 36 と、1から順にたした数（三角数）です。"
                        "10段目は 9×8÷2＝36 です。"},
            {"question": "各段の数の合計は 1, 2, 4, 8, … とならびます。"
                         "上から12段目にならぶ数の合計はいくつですか。", "answer": "2048",
             "meaning": "1段進むごとに2倍になります。12段目は2を11回かけた数で2048です。"},
            {"question": "上から23段目にならぶ数の合計はいくつですか。", "answer": "4194304",
             "meaning": "2を22回かけた数で4194304です。"},
        ],
    },
    {
        "id": "hd3n_08_2", "src": "HG-1962", "star": 3,
        "title": "目もりが3つだけのものさし", "category": "baai", "unit": "推理・論理",
        "intro": "右のア〜カの6本のものさしは、どれも長さが10cmで、"
                 "もともと1cmごとに目もりがうってあったものが、**3つだけ**になってしまいました。"
                 "両はし（0と10のところ）も、はかるときに使えます。",
        "svg": _monosashi_svg(),
        "steps": [
            {"question": "アのものさしで使える点は、0・1・2・5・10の5つです。"
                         "2つの点の組み合わせは何通りありますか。", "answer": "10",
             "meaning": "5つから2つを選ぶので 5×4÷2＝10通りです。"},
            {"question": "アではかれる長さは何種類ありますか。", "answer": "8",
             "meaning": "0からの差が 1,2,5,10、1からが 1,4,9、2からが 3,8、5からが 5。"
                        "ならべると 1,1,2,3,4,5,5,8,9,10 で、"
                        "**1と5が2回ずつ**出るので 10−2＝**8種類**です。"},
            {"question": "はかれる長さがいちばん多いのはどのものさしですか。",
             "answer": "エ", "choices": ["エ", "ア", "イ", "ウ", "オ", "カ"],
             "meaning": "エ（0,1,2,7,10）は 1,2,3,5,6,7,8,9,10 の**9種類**で最多です。"
                        "4だけがはかれません。"},
            {"question": "はかれる長さがいちばん少ないのはどのものさしですか。",
             "answer": "イ", "choices": ["イ", "ア", "ウ", "エ", "オ", "カ"],
             "meaning": "イ（0,1,4,5,10）は 1,3,4,5,6,9,10 の**7種類**です。"
                        "1と4のあいだ・4と5のあいだが同じ1、0-4と1-5が同じ4…と"
                        "**同じ長さが3組かさなる**ので種類が減ります。"
                        "ア・ウ・オ・カはどれも8種類でした。"},
        ],
    },
    {
        "id": "hd3n_08_3", "src": "HG-1963", "star": 3,
        "title": "紙テープを折り曲げて六角形にする", "category": "zu", "unit": "平面図形（面積）",
        "intro": "長方形の紙テープを折り曲げて両はしを合わせたところ、"
                 "内がわが1辺2cmの正三角形になり、"
                 "外がわの六角形は長いほうの1辺が4cm、短いほうの1辺が2cmになりました。",
        "svg": _tape_hex_svg(),
        "steps": [
            {"question": "この六角形は、1辺8cmの正三角形の角を3つ切り落とした形です。"
                         "切り落とす1つの角は、1辺何cmの正三角形ですか。", "answer": "2",
             "meaning": "8−2−2＝4 で長いほうの辺が4cmになります。"
                        "切り口が短いほうの辺2cmです。"},
            {"question": "1辺1cmの正三角形を1こ分と数えます。"
                         "1辺8cmの正三角形は何こ分ですか。", "answer": "64",
             "meaning": "1辺が8倍なので 8×8＝64こ分です。"},
            {"question": "六角形は何こ分ですか。", "answer": "52",
             "meaning": "64から1辺2cm（＝4こ分）の角を3つひいて 64−4×3＝52こ分です。"},
            {"question": "テープにおおわれている部分（六角形からまん中の穴をのぞいた部分）は"
                         "何こ分ですか。", "answer": "48",
             "meaning": "穴は1辺2cmの正三角形で4こ分。52−4＝48こ分です。"},
            {"question": "紙テープの長さは何cmですか。", "answer": "15",
             "meaning": "テープの幅は1辺2cmの正三角形の高さで、"
                        "長さ1cmあたり2こ分の面積になります。\n"
                        "**折り目で2重になるところが3か所**あり、"
                        "そこは1辺2cm（4こ分）ずつ重なるので 4×3＝12こ分よけいに要ります。"
                        "テープ全体は 48＋12＝60こ分。60÷2＝**15cm**です。\n"
                        "2重になる分をわすれると12cmと出てしまいます。"
                        "内がわが3cmの同じ形なら 15×3/2＝22.5cm になり、つじつまが合います。"},
        ],
    },
    {
        "id": "hd3n_08_4", "src": "HG-1964", "star": 3,
        "title": "三角形2つを重ねて八角形をつくる", "category": "zu", "unit": "平面図形（面積）",
        "intro": "3辺が15cm、25cm、35cmの三角形2こを、右の図のように重ね合わせたところ、"
                 "重なった部分（点線部分）のまわりの長さは34cmになりました。",
        "svg": _octagon2tri_svg(),
        "steps": [
            {"question": "三角形1このまわりの長さは何cmですか。", "answer": "75",
             "meaning": "15＋25＋35＝75cmです。"},
            {"question": "三角形2この まわりの長さの合計は何cmですか。", "answer": "150",
             "meaning": "75×2＝150cmです。"},
            {"question": "八角形（実線部分）のまわりの長さは何cmですか。", "answer": "116",
             "meaning": "2つの三角形のまわりを足すと、重なった部分のまわりを2回数えたことになります。"
                        "そのうち1回ぶん（34cm）は八角形の外がわではないので引きます。"
                        "150−34＝116cmです。"},
        ],
    },
    {
        "id": "hd3n_08_6", "src": "HG-1966", "star": 3,
        "title": "長方形を5つの正方形と1つの長方形でしきつめる", "category": "zu",
        "unit": "平面図形（面積）",
        "intro": "右の図は、たて19cm、横25cmの長方形の中に、"
                 "**5つの正方形と1つの長方形**をすきまなくしきつめたものです。",
        "svg": _shikitsume_svg(),
        "steps": [
            {"question": "長方形全体の面積は何cm²ですか。", "answer": "475",
             "meaning": "19×25＝475cm²です。"},
            {"question": "右がわのいちばん大きな正方形の1辺は何cmですか。", "answer": "14",
             "meaning": "たては 5＋14＝19、横は 11＋14＝25。"
                        "どちらもぴったり合うのは1辺14cmのときだけです。"},
            {"question": "左下の正方形の1辺は何cmですか。", "answer": "11",
             "meaning": "横が 11＋14＝25 なので11cmです。たては 8＋11＝19 とも合います。"},
            {"question": "いちばん小さい正方形の1辺は何cmですか。", "answer": "3",
             "meaning": "左上が8cm、そのとなりが5cm、すきまをうめるのが 8−5＝3cmの正方形です。"},
            {"question": "長方形（正方形でないもの）は、たて何cm・横何cmですか。"
                         "たて×横の答えを書きなさい。", "answer": "60",
             "meaning": "たて5cm・横12cmで 5×12＝60cm²です。"
                        "5つの正方形 64＋25＋9＋121＋196＝415 に60をたすと475になり、"
                        "**すきまも重なりもない**ことが確かめられます。"},
        ],
    },
    {
        "id": "hd3n_08_7", "src": "HG-1967", "star": 3,
        "title": "合同な三角形2つを3通りにならべる", "category": "zu", "unit": "平面図形（面積）",
        "intro": "形も大きさも同じ2つの三角形を、右の（ア）（イ）（ウ）のようにならべたところ、"
                 "まわりの長さはそれぞれ46cm、50cm、64cmになりました。",
        "svg": _pair3_svg(),
        "steps": [
            {"question": "3つのまわりの長さをぜんぶ たすと何cmですか。", "answer": "160",
             "meaning": "46＋50＋64＝160cmです。"},
            {"question": "三角形1つの3辺の長さの合計は何cmですか。", "answer": "40",
             "meaning": "はりあわせた辺は、まわりから2本ぶん消えます。"
                        "1つのならべ方のまわり＝（3辺の和）×2−（はった辺）×2。"
                        "3通りを たすと（3辺の和）×6−（3辺の和）×2＝（3辺の和）×4。"
                        "160÷4＝40cmです。"},
            {"question": "まわりが46cmのならべ方で、はりあわせた辺は何cmですか。", "answer": "17",
             "meaning": "40×2−46＝34、34÷2＝17cmです。"
                        "**まわりが短いほど、はった辺は長い**ことになります。"},
            {"question": "3辺のうち、いちばん短い辺は何cmですか。", "answer": "8",
             "meaning": "50cmからは（80−50）÷2＝15cm、64cmからは（80−64）÷2＝8cm。"
                        "3辺は8cm・15cm・17cmで、たすと40 ✓。"
                        "8×8＋15×15＝289＝17×17 なので直角三角形になり、"
                        "（ア）はきちんと長方形になります。"},
        ],
    },
    {
        "id": "hd3n_08_8", "src": "HG-1968", "star": 3,
        "title": "直角三角形10こをずらして重ねる", "category": "zu", "unit": "平面図形（面積）",
        "intro": "3辺が9cm、12cm、15cmの直角三角形を10こ、"
                 "底辺を一直線にそろえて、**底辺の3分の1（4cm）ずつ右へずらして**重ねました。"
                 "できた図形を21角形と考えます。",
        "svg": _kaidan_tri_svg(),
        "steps": [
            {"question": "いちばん下の辺（底辺）の全長は何cmですか。", "answer": "48",
             "meaning": "1こ目の底辺12cmに、2こ目から10こ目までの9回ぶんのずれ4cmを足します。"
                        "12＋4×9＝48cmです。"},
            {"question": "2こ目より右の三角形は、斜辺のうち何cmずつが外に見えていますか。",
             "answer": "5",
             "meaning": "ずらす幅は底辺の3分の1なので、斜辺も3分の1だけ顔を出します。"
                        "15÷3＝5cmです。これが9本あります。"},
            {"question": "2こ目より右の三角形は、たての辺のうち何cmずつが外に見えていますか。",
             "answer": "3",
             "meaning": "同じように高さの3分の1で 9÷3＝3cmです。これも9本あります。"},
            {"question": "21角形のまわりの長さは何cmですか。", "answer": "144",
             "meaning": "底辺48＋左はしのたての辺9＋斜辺5×9＝45＋たての辺3×9＝27"
                        "＋いちばん右の斜辺15。"
                        "48＋9＋45＋27＋15＝**144cm**です。"
                        "外周を21個の頂点でたどって機械で測っても144cmでした。"
                        "底辺と高さを取りちがえて9と12を入れかえても144cmになります。"},
        ],
    },
    {
        "id": "hd3n_08_9", "src": "HG-1969", "star": 3,
        "title": "長方形が直線上をころがる", "category": "zu", "unit": "図形の移動",
        "intro": "たて12cm、横16cm、対角線20cmの長方形が、右の図のように直線の上を"
                 "すべらずに4回ころがります。長方形の1つの頂点をAとします。"
                 "円周率は3.14とします。",
        "svg": _korogaru_svg(),
        "steps": [
            {"question": "1回ころがるとき、長方形は何度回りますか。", "answer": "90",
             "meaning": "長方形のかどは直角なので、1回で90°ずつ回ります。"},
            {"question": "Aがえがく弧は何本ですか。", "answer": "3",
             "meaning": "4回ころがりますが、**3回目はAそのものが回転の中心**になるので"
                        "Aは動きません。だから弧は3本です。"},
            {"question": "3本の弧の半径をぜんぶ たすと何cmですか。", "answer": "48",
             "meaning": "1回目はAから回転の中心までが対角線で20cm、"
                        "2回目は横の辺で16cm、4回目はたての辺で12cm。20＋16＋12＝48cmです。"},
            {"question": "Aが動いてできる曲線の長さは何cmですか。", "answer": "75.36",
             "meaning": "どれも中心角90°＝円の4分の1なので、"
                         "48×2×3.14÷4＝48×1.57＝**75.36cm**です。"
                        "**半径を先にたしてから3.14を1回だけかける**のが計算のコツです。"},
        ],
    },
    {
        "id": "hd3n_08_10", "src": "HG-1970", "star": 3,
        "title": "正方形が半円の弧にそって動く", "category": "zu", "unit": "図形の移動",
        "intro": "1辺2cmの正方形があります。半径6cmの半円の弧にそって、"
                 "右の図の（あ）の位置から（い）の位置まで、**向きを変えずに**動かします。"
                 "正方形のまん中（対角線が交わる点）をOとします。円周率は3.14とします。",
        "svg": _slide_svg(),
        "steps": [
            {"question": "正方形の右下のかどが弧にふれているあいだ、"
                         "Oは半径何cmの弧をえがきますか。", "answer": "6",
             "meaning": "向きを変えないので、Oはいつも ふれている点から同じ向き・同じ長さだけ"
                        "はなれた場所にあります。だから**弧をそのままずらした形**になり、"
                        "半径は弧と同じ6cmです。"},
            {"question": "その弧の中心角は何度ですか。", "answer": "90",
             "meaning": "左はしから頂上までで4分の1周です。"},
            {"question": "その弧の長さは何cmですか。", "answer": "9.42",
             "meaning": "6×2×3.14÷4＝9.42cmです。"},
            {"question": "頂上では、正方形の下の辺が弧にふれます。"
                         "このときOは何cm まっすぐ動きますか。", "answer": "2",
             "meaning": "ふれるところが右下のかどから左下のかどに移るあいだ、"
                        "正方形は**1辺ぶん＝2cm**だけ横にすべります。"},
            {"question": "Oは全部で何cm動きますか。", "answer": "20.84",
             "meaning": "9.42＋2＋9.42＝**20.84cm**です。"
                        "弧2つを合わせると 6×2×3.14÷2＝18.84cm＝円のちょうど半分になります。"
                        "**「向きを変えずに」を「ころがす」と読みちがえる**と、"
                        "半径が変わって答えがまったく別のものになります。"},
        ],
    },
    {
        "id": "hd3n_09_4", "src": "HG-1974", "star": 3,
        "title": "立方体のかどを切り取った立体", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "立方体のかどを、各辺のまん中まで同じように切り取って、右の図の立体を作りました。"
                 "切り口は三角形になります。",
        "svg": _cubocta_svg(),
        "steps": [
            {"question": "この立体の頂点は、もとの立方体の何と同じ数ですか。",
             "answer": "辺", "choices": ["辺", "頂点", "面"],
             "meaning": "切り口が各辺のまん中を通るので、新しい頂点はもとの辺の上に1つずつできます。"},
            {"question": "この立体の頂点は何こありますか。", "answer": "12",
             "meaning": "立方体の辺は12本なので12こです。"},
            {"question": "この立体の辺は何本ありますか。", "answer": "24",
             "meaning": "もとの頂点8こそれぞれに切り口の三角形（辺3本）ができるので 8×3＝24本。"
                        "もとの面6つそれぞれに正方形（辺4本）ができるので 6×4＝24本。"
                        "2通りの数え方が同じ答えになります。"},
            {"question": "この立体の面はいくつありますか。", "answer": "14",
             "meaning": "もとの面から残った正方形6つと、切り口の三角形8つで14です。"
                        "たしかめ 頂点12＋面14−辺24＝2 ✓"},
        ],
    },
    {
        "id": "hd3n_10_10", "src": "HG-1990", "star": 3,
        "title": "方眼にうずまき状に整数をうめる", "category": "kisoku", "unit": "規則性・数列",
        "intro": "方眼に、1から順に整数を右の図のようにうずまき状にうめていきます。",
        "svg": _spiral_svg(),
        "steps": [
            {"question": "1のすぐ右の列を下へ見ていくと 9, 25, 49, … とならびます。"
                         "これは何の数の2乗ですか。3つ目の49は何の2乗ですか。", "answer": "7",
             "meaning": "9＝3×3、25＝5×5、49＝7×7 と、奇数の2乗がならびます。"
                        "うずまきが一周し終わる場所です。"},
            {"question": "㋐に入る数はいくつですか。", "answer": "81",
             "meaning": "㋐は1のすぐ右の列を下に4つ目なので 9×9＝81です。"},
            {"question": "1から右へ 8, 22, 44, 74, … とならびます。"
                         "この差は 14, 22, 30, … と何ずつふえますか。", "answer": "8",
             "meaning": "22−8＝14、44−22＝22、74−44＝30 と、差が8ずつふえます。"},
            {"question": "㋑（1から右へ5番目）に入る数はいくつですか。", "answer": "112",
             "meaning": "74に次の差38をたして112です。"},
            {"question": "1から右へ10番目の場所に入る数はいくつですか。", "answer": "422",
             "meaning": "112から 46, 54, 62, 70, 78 と足していくと "
                        "158, 212, 274, 344, 422。10番目は422です。"},
        ],
    },
]

# 図が要るぶんを、それぞれの回に足す
LESSONS.setdefault("8", [])
for _q in L8_9_10_ADD:
    _no = _q["id"].split("_")[1]              # hd3n_08_4 → "08"
    LESSONS.setdefault(str(int(_no)), []).append(_q)


def _naname_cyl_svg():
    """HG-2207 図1：円柱の両はしを平面でななめに切った部品（真横から見た図）"""
    import math as _m
    cy, R = 74.0, 30.0
    xtl, xbl = 64.0, 40.0                 # 左の切り口
    xtr, xbr = 196.0, 240.0               # 右の切り口（左とは切る向きがちがう）
    body = ['<path d="M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f Z" '
            'fill="rgba(79,124,255,0.10)" stroke="%s" stroke-width="2"/>'
            % (xtl, cy - R, xtr, cy - R, xbr, cy + R, xbl, cy + R, BLUE)]
    for xt, xb in ((xtl, xbl), (xtr, xbr)):        # 切り口のだ円
        a = _m.degrees(_m.atan2(2 * R, xb - xt))
        body.append('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="9" fill="none" '
                    'stroke="%s" stroke-width="1.6" stroke-dasharray="4 3" '
                    'transform="rotate(%.1f %.1f %.1f)"/>'
                    % ((xt + xb) / 2, cy, _m.hypot((xb - xt) / 2, R), BLUE,
                       a, (xt + xb) / 2, cy))
    body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                'stroke-width="1.4" stroke-dasharray="6 4"/>'
                % ((xtl + xbl) / 2, cy, (xtr + xbr) / 2, cy, RED))
    body.append(_t(132, cy - 6, "中心の線", RED, 11, bold=True))
    body.append('<line x1="256" y1="%.1f" x2="256" y2="%.1f" stroke="%s" '
                'stroke-width="1.4"/>' % (cy - R, cy, GRAY))
    body.append(_t(272, cy - R / 2 + 4, "3cm", GRAY, 11))
    body.append(_t(146, 22, "図1　円柱の両はしを平面でななめに切った部品", GRAY, 11))
    body.append(_t(146, 128, "上と下で長さがちがう。中心の線はそのまん中", GRAY, 11))
    return _svg(292, 140, "\n".join(body))


def _ring_svg():
    """HG-2207 図2：部品を4つつないで作ったリングを真上から見た図。
    33と21は**外がわ**、18と26は**内がわ**を指す（引出線が触れる輪郭でわかる）"""
    import math as _m
    C = [(72.0, 66.0), (212.0, 48.0), (226.0, 162.0), (86.0, 180.0)]   # 中心の線の4すみ
    d = 13.0

    def off(poly, s):                              # 多角形を s だけ内／外にずらす
        out = []
        n = len(poly)
        for i in range(n):
            p0, p1, p2 = poly[(i - 1) % n], poly[i], poly[(i + 1) % n]
            e = []
            for a, b in ((p0, p1), (p1, p2)):
                dx, dy = b[0] - a[0], b[1] - a[1]
                L = _m.hypot(dx, dy)
                nx, ny = dy / L, -dx / L           # 左手側の法線
                e.append((a[0] + nx * s, a[1] + ny * s, dx, dy))
            (ax, ay, dx1, dy1), (bx, by, dx2, dy2) = e
            den = dx1 * dy2 - dy1 * dx2
            t = ((bx - ax) * dy2 - (by - ay) * dx2) / den
            out.append((ax + dx1 * t, ay + dy1 * t))
        return out

    area = lambda ps: abs(sum(ps[i][0] * ps[(i + 1) % len(ps)][1]
                              - ps[(i + 1) % len(ps)][0] * ps[i][1]
                              for i in range(len(ps)))) / 2
    P, Q = off(C, -d), off(C, d)
    OUT, IN = (P, Q) if area(P) > area(Q) else (Q, P)   # 広いほうが外がわ
    pj = lambda ps: " ".join("%.1f,%.1f" % p for p in ps)
    body = ['<polygon points="%s" fill="rgba(79,124,255,0.10)" stroke="%s" stroke-width="2"/>'
            % (pj(OUT), BLUE),
            '<polygon points="%s" fill="#ffffff" stroke="%s" stroke-width="2"/>'
            % (pj(IN), BLUE)]
    for a, b in zip(C, C[1:] + C[:1]):             # つなぎ目（切り口）
        body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#9fb2e8" '
                    'stroke-width="1.2" stroke-dasharray="4 3"/>' % (a[0], a[1], b[0], b[1]))
    mid = lambda ps, i: ((ps[i][0] + ps[(i + 1) % 4][0]) / 2, (ps[i][1] + ps[(i + 1) % 4][1]) / 2)
    for i, (side, txt, dx, dy, col) in enumerate((          # 内がわは穴の中、外がわは外に出す
            (IN, "18cm", 0, 26, RED), (OUT, "21cm", 38, 4, BLUE),
            (IN, "26cm", 0, -16, RED), (OUT, "33cm", -38, 4, BLUE))):
        mx, my = mid(side, i)
        body.append('<circle cx="%.1f" cy="%.1f" r="2.6" fill="%s"/>' % (mx, my, col))
        body.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" '
                    'stroke-width="1.2"/>'
                    % (mx, my, mx + dx * 0.55, my + dy * 0.6, col))
        body.append(_t("%.1f" % (mx + dx), "%.1f" % (my + dy), txt, col, 12, bold=True))
    body.append(_t(150, 18, "図2　4つの部品をはりあわせたリングを真上から", GRAY, 11))
    body.append(_t(150, 216, "青の33cm・21cmは外がわの長さ", BLUE, 11))
    body.append(_t(150, 231, "赤の18cm・26cmは内がわの長さ", RED, 11))
    return _svg(300, 242, "\n".join(body))


G5 = [
    {
        "id": "hd5n_06_1", "src": "HG-2201", "star": 2,
        "title": "方眼の図形を軸で1回転させる", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "右の方眼紙（1マス＝1cm）に2つの図形㋐、㋑をかきました。"
                 "㋐、㋑を太線ℓを軸として1回転させてできる立体を、それぞれA、Bとします。"
                 "㋑の下半分は軸からはなれているので、Bはドーナツのように中がうつろになります。"
                 "円周率は3.14とします。",
        "svg": _kaiten_svg(),
        "steps": [
            {"question": "Aの体積は □×3.14 cm³ と表せます。□に入る数はいくつですか。",
             "answer": "48",
             "meaning": "㋐は横4・たて3で軸ℓにぴったりくっついているので、"
                        "Aは半径4cm・高さ3cmの円柱です。"
                        "4×4×3＝48 なので 48×3.14 cm³ です。"},
            {"question": "Bの体積は □×3.14 cm³ です。□に入る数はいくつですか。",
             "answer": "144",
             "meaning": "高さ2ずつ、4段に輪切りにして数えます。"
                        "下から 半径2の円柱＝2×2×2＝8、半径4の円柱＝4×4×2＝32、"
                        "外6・内2のドーナツ＝(6×6−2×2)×2＝64、"
                        "外6・内4のドーナツ＝(6×6−4×4)×2＝40。"
                        "8＋32＋64＋40＝144 です。"},
            {"question": "AとBの体積の比を、いちばん簡単な整数の比で 1：□ と表すと□はいくつですか。",
             "answer": "3",
             "meaning": "48：144＝1：3 です。3.14 は両方にかかっているので、比では消えます。"},
            {"question": "AとBの表面積の比も 1：□ になります。□はいくつですか。",
             "answer": "3",
             "meaning": "3.14 をのぞいて数えます。"
                        "Aは 側面 2×4×3＝24、上と下のまるい面 4×4×2＝32 で、合わせて56。"
                        "Bは 上を向いた輪 4＋12＋20＝36、下を向いた輪も36、"
                        "外がわの筒 8＋16＋24＋24＝72、内がわのかべ 8＋16＝24 で、合わせて168。"
                        "56：168＝1：3 です。"
                        "㋑の下半分は軸からはなれていて中がうつろなので、"
                        "内がわのかべ24を数え落とすと152になり、きれいな比になりません。"},
        ],
    },
    {
        "id": "hd5n_06_r1", "src": "HG-2208", "star": 1,
        "title": "9種類の気体・性質の総ざらい", "category": "kitai", "unit": "気体の性質",
        "intro": "つぎのア〜ケの気体について答えます。\n"
                 "**ア.酸素　イ.水素　ウ.二酸化炭素　エ.アンモニア　オ.塩化水素　"
                 "カ.塩素　キ.二酸化硫黄　ク.硫化水素　ケ.窒素**",
        "svg": "",
        "steps": [
            {"question": "色のついている気体はどれですか。",
             "answer": "カ 塩素", "choices": ["カ 塩素", "ア 酸素", "ウ 二酸化炭素", "ケ 窒素"],
             "meaning": "塩素は**黄緑色**です。ほかの8つはどれも無色です。"},
            {"question": "水に非常によくとける気体2つのうち、水よう液がアルカリ性になるのはどれですか。",
             "answer": "エ アンモニア",
             "choices": ["エ アンモニア", "オ 塩化水素", "ウ 二酸化炭素", "キ 二酸化硫黄"],
             "meaning": "水にとてもよくとけるのは**エ アンモニアとオ 塩化水素**。"
                        "アンモニア水はアルカリ性、塩化水素の水よう液（＝塩酸）は酸性です。"},
            {"question": "上方置換で集めるのがよい気体はどれですか。",
             "answer": "エ アンモニア",
             "choices": ["エ アンモニア", "オ 塩化水素", "ア 酸素", "ウ 二酸化炭素"],
             "meaning": "**水にとけやすく、空気より軽い**気体は上方置換で集めます。"
                        "アンモニアだけがこの2つに当てはまります。"
                        "塩化水素は水にとけやすいけれど空気より重いので下方置換です。"},
            {"question": "漂白（色をぬく）作用のある気体2つは、カ 塩素と、あと1つはどれですか。",
             "answer": "キ 二酸化硫黄",
             "choices": ["キ 二酸化硫黄", "ク 硫化水素", "エ アンモニア", "イ 水素"],
             "meaning": "**塩素と二酸化硫黄**には漂白作用があります。"
                        "塩素はプールや水道水の殺菌にも使われます。"},
            {"question": "工場や火力発電所から出て、酸性雨のおもな原因になる気体はどれですか。",
             "answer": "キ 二酸化硫黄",
             "choices": ["キ 二酸化硫黄", "ウ 二酸化炭素", "ケ 窒素", "ア 酸素"],
             "meaning": "二酸化硫黄が雨にとけると酸性雨になります。"
                        "二酸化炭素は温暖化の原因で、酸性雨とは分けて覚えます。"},
            {"question": "燃やすと水だけができる気体はどれですか。",
             "answer": "イ 水素", "choices": ["イ 水素", "ウ 二酸化炭素", "ア 酸素", "ケ 窒素"],
             "meaning": "水素が酸素と結びつくと水だけができます。"
                        "同じ体積でくらべると、水素は9種類の中で**いちばん軽い**気体です。"},
            {"question": "固体にしたものがドライアイスで、石灰水を白くにごらせる気体はどれですか。",
             "answer": "ウ 二酸化炭素",
             "choices": ["ウ 二酸化炭素", "ア 酸素", "ケ 窒素", "カ 塩素"],
             "meaning": "二酸化炭素です。炭酸水素ナトリウム（重そう）を熱しても出てきます。"},
            {"question": "2つを混ぜると白いけむりが出る組み合わせは、"
                         "エ アンモニアと何ですか。",
             "answer": "オ 塩化水素",
             "choices": ["オ 塩化水素", "カ 塩素", "キ 二酸化硫黄", "イ 水素"],
             "meaning": "アンモニアと塩化水素が出会うと、"
                        "白い固体（塩化アンモニウム）ができて白いけむりに見えます。"},
        ],
    },
    {
        "id": "hd5n_06_r3", "src": "HG-2210", "star": 3,
        "title": "漂白剤から出る2つの気体", "category": "kitai", "unit": "気体の性質",
        "intro": "家庭用の漂白剤を使って、2つの実験をしました。\n"
                 "**〔実験1〕** フラスコに塩化コバルトを入れ、漂白剤を少しずつ注ぐと"
                 "**無色の気体1**が出ました。においはなく、赤色・青色のリトマス紙はどちらも変わりません。"
                 "火をつけたろうそくを入れると**大きく明るい炎を出して燃え続け**、"
                 "そのあと石灰水を入れてふると**白くにごりました**。\n"
                 "**〔実験2〕** フラスコに漂白剤を入れ、うすい塩酸を少しずつ注ぐと"
                 "**黄緑色の気体2**が出ました。プールでかいだにおいがします。"
                 "ろうそくを入れると**暗い炎になり、すすを出しながら**燃え続け、"
                 "石灰水を入れてふっても**白くにごりませんでした**。",
        "svg": "",
        "steps": [
            {"question": "はじめに出てくる集気びん1ぱいぶんの気体を捨てるのはなぜですか。",
             "answer": "中の空気がおし出されたものだから",
             "choices": ["中の空気がおし出されたものだから", "きけんな気体だから",
                         "温度が高すぎるから", "水にとけてしまうから"],
             "meaning": "はじめに出るのは、装置の中にもともと入っていた空気です。"
                        "これを捨てないと、集めたい気体とまざってしまいます。"},
            {"question": "気体2は何ですか。",
             "answer": "塩素", "choices": ["塩素", "酸素", "二酸化炭素", "水素"],
             "meaning": "**黄緑色**で**プールのにおい**、"
                        "リトマス紙の色をぬいてしまう（漂白作用）ので塩素です。"},
            {"question": "気体1は何ですか。",
             "answer": "酸素", "choices": ["酸素", "塩素", "水素", "二酸化炭素"],
             "meaning": "無色・無臭でリトマス紙が変わらず、"
                        "**ろうそくが大きく明るく燃える**のは酸素です。"
                        "空気より重く、毒はなく、水にとけにくい気体です。"
                        "石灰水が白くにごったのは、ろうが燃えて二酸化炭素ができたからです。"},
            {"question": "実験2で炎が暗くすすが出たのは、"
                         "気体2がろうのどの元素と結びついたからですか。",
             "answer": "水素", "choices": ["水素", "炭素", "酸素", "ちっ素"],
             "meaning": "塩素は**水素とだけ**結びつきます。"
                        "炭素はあまって すす になるので、炎が暗くなります。"
                        "石灰水が白くにごらなかったのは、二酸化炭素ができていないからです。"
                        "**燃える＝酸素と結びつく、とはかぎらない**ことを教える問題です。"},
            {"question": "ろう28gを完全に燃やすと、二酸化炭素88gと水36gができます。"
                         "このとき使われた酸素は何gですか。", "answer": "96",
             "meaning": "できたものの重さの合計から、もとのろうの重さをひきます。"
                        "88＋36−28＝96gです。"},
            {"question": "では、ろう70gを完全に燃やすには酸素が何g必要ですか。", "answer": "240",
             "meaning": "70÷28＝2.5倍なので 96×2.5＝240gです。"},
            {"question": "二酸化炭素44gには炭素が12g、水18gには水素が2gふくまれます。"
                         "ろうにふくまれる炭素と水素の重さの比を、"
                         "「炭素：水素」がいちばん簡単な整数になるように表すと 6：□ です。"
                         "□はいくつですか。", "answer": "1",
             "meaning": "炭素は 88×12÷44＝24g、水素は 36×2÷18＝4g。"
                        "24：4＝**6：1**です。"
                        "24＋4＝28 でろうの重さとぴったり合うので、計算が正しいと確かめられます。"},
        ],
    },
    {
        "id": "hd5n_06_r2", "src": "HG-2209", "star": 3,
        "title": "5つの水よう液と5つの固体・記号の連鎖", "category": "suiyoueki",
        "unit": "水よう液と気体",
        "intro": "つぎの中から選びます。**同じ番号を何回選んでもかまいません。**\n"
                 "水よう液　①オキシドール　②うすい塩酸　③アンモニア水　"
                 "④石灰水　⑤水酸化ナトリウム水よう液\n"
                 "固体　⑥炭酸カルシウム（石灰石の主成分）　⑦二酸化マンガン　"
                 "⑧食塩　⑨アルミニウム　⑩銅\n"
                 "「水よう液[a]または[b]を固体[c]に加えると、**どちらの場合も**気体《W》が生じた。"
                 "固体[d]を少量の水よう液[e]に加えると、はげしく反応して気体《X》が生じた。"
                 "《W》と《X》を混ぜて点火すると、はげしい音を出して《Y》ができる。"
                 "つぎに、水よう液[f]を固体[g]に加えると気体《Z》が生じ、"
                 "**この気体を水よう液[h]に通すと、ふたたび固体[g]が沈でんした**。"
                 "また、水よう液[i]と水よう液[j]を混ぜてから水をすべて蒸発させると固体[k]が得られた。」",
        "svg": "",
        "steps": [
            {"question": "気体《W》は何ですか。",
             "answer": "水素", "choices": ["水素", "酸素", "二酸化炭素", "アンモニア"],
             "meaning": "《W》と《X》を混ぜて点火するとはげしい音がするのは**水素と酸素**の組です。"
                        "《W》は「2つの水よう液のどちらでも出る」気体で、これが水素です。"},
            {"question": "固体[c]は何ですか。",
             "answer": "⑨アルミニウム",
             "choices": ["⑨アルミニウム", "⑩銅", "⑧食塩", "⑦二酸化マンガン"],
             "meaning": "**アルミニウムは、うすい塩酸にも水酸化ナトリウム水よう液にも溶けて水素**を出します。"
                        "「どちらの場合も」と書けるのはアルミニウムだけです"
                        "（[a][b]は②と⑤）。銅はどちらにも溶けません。"},
            {"question": "気体《X》を出す組み合わせで、水よう液[e]は何ですか。",
             "answer": "①オキシドール",
             "choices": ["①オキシドール", "②うすい塩酸", "④石灰水", "⑤水酸化ナトリウム水よう液"],
             "meaning": "《X》は酸素。**二酸化マンガン（[d]＝⑦）にオキシドールを加えると酸素**が出ます。"
                        "二酸化マンガンは変化せず、はたらきを助けるだけです。"},
            {"question": "気体《Y》は何ですか。",
             "answer": "水", "choices": ["水", "水素", "酸素", "二酸化炭素"],
             "meaning": "水素と酸素が結びついて**水**ができます。"},
            {"question": "固体[g]は何ですか。",
             "answer": "⑥炭酸カルシウム",
             "choices": ["⑥炭酸カルシウム", "⑧食塩", "⑨アルミニウム", "⑦二酸化マンガン"],
             "meaning": "**うすい塩酸（[f]＝②）を炭酸カルシウムに加えると二酸化炭素**（《Z》）が出ます。"
                        "その二酸化炭素を**石灰水（[h]＝④）に通すと、また炭酸カルシウムが沈でん**します。"
                        "[g]が「気体を出した固体」であり「沈でんした固体」でもあるのが決め手です。"},
            {"question": "固体[k]は何ですか。",
             "answer": "⑧食塩", "choices": ["⑧食塩", "⑥炭酸カルシウム", "⑩銅", "⑨アルミニウム"],
             "meaning": "うすい塩酸（②）と水酸化ナトリウム水よう液（⑤）を混ぜると中和して食塩水になり、"
                        "水を蒸発させると**食塩**が残ります。「食塩水」ではなく固体で答えます。"},
            {"question": "①〜⑩のうち、一度も使わないものは⑩銅ともう1つあります。どれですか。",
             "answer": "③アンモニア水",
             "choices": ["③アンモニア水", "④石灰水", "①オキシドール", "⑧食塩"],
             "meaning": "使うのは ①②④⑤（水よう液）と ⑥⑦⑧⑨（固体）。"
                        "**③アンモニア水と⑩銅は出番がありません**。"
                        "使わない選ぶ物をまぜておくのは灘合のいつもの手です。"},
        ],
    },
    {
        "id": "hd5n_06_7", "src": "HG-2207", "star": 3,
        "title": "円柱を斜めに切った部品でリングを作る", "category": "rittai",
        "unit": "立体図形（体積・表面積）",
        "intro": "図1は、半径3cmの円柱の両はしを平面でななめに切った立体です。"
                 "この形の部品を4つ、机の上にならべて切り口をはりあわせ、"
                 "図2のようなリング（わ）を作りました。図2は真上から見た図です。\n"
                 "**33cmと21cmは外がわ、18cmと26cmは内がわの長さ**です。"
                 "円周率は22/7とします。",
        "svg": _naname_cyl_svg() + _ring_svg(),
        "steps": [
            {"question": "1つの部品について、"
                         "（外がわの長さ）＋（内がわの長さ）は 中心の線の長さの何倍ですか。",
             "answer": "2",
             "meaning": "切り口は平面なので、長さは外から内へまっすぐに変わります。"
                        "だから中心の線は外と内のちょうどまん中で、"
                        "外＋内＝中心の線×2 になります。"},
            {"question": "外・内・外・内 と交ごに与えられた 33＋18＋21＋26 は何cmですか。",
             "answer": "98",
             "meaning": "33＋18＋21＋26＝98cmです。"},
            {"question": "この98cmは、4つの部品の**中心の線の長さの合計**と等しくなります。"
                         "リング全体の側面積は何cm²ですか。", "answer": "1848",
             "meaning": "つなぎ目でできる出っぱりを□とすると、"
                        "外がわ＝中心＋（両どなりの□）、内がわ＝中心−（両どなりの□）。"
                        "**外・内・外・内と交ごに足すと□が全部消えて**、"
                        "残るのは中心の線の合計だけです。\n"
                        "側面積＝（底面の円のまわり）×（中心の線の合計）"
                        "＝2×3×22/7×98＝132/7×98＝132×14＝1848cm²です。"},
            {"question": "この立体の表面積は何cm²ですか。", "answer": "1848",
             "meaning": "**わになって閉じているので、切り口（だ円）はすべて内側にかくれます**。"
                        "だから表面は側面だけで1848cm²です。"
                        "切り口を数えてしまうと まちがいになります。"
                        "円周率が22/7 なのは、98が7でわり切れて答えがきれいになるためです。"},
        ],
    },
    {
        "id": "hd5n_06_3", "src": "HG-2203", "star": 3,
        "title": "円柱の水に円すいのおもり", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "底面の半径が6cmの円柱形の容器Aと、底面の半径が6cmの円すいのおもりBがあります。"
                 "Aに水面の高さが10cmになるまで水を入れ、"
                 "さらに、Bの底面がAの底面と一致するようにおもりBをAの中に入れると、"
                 "水面はおもりBの頂点に一致しました。円周率は3.14とします。",
        "svg": "",
        "steps": [
            {"question": "おもりBの高さは何cmですか。", "answer": "15",
             "meaning": "水の量は変わりません。おもりの高さを□cmとすると、"
                        "水面も□cmになるので、円柱□cmぶんから円すい□cmぶんを引いた分が水。"
                        "円すいは同じ底面・同じ高さの円柱の3分の1なので、"
                        "円柱□cmの3分の2が水にあたります。"
                        "はじめの水は円柱10cmぶんなので □×2/3＝10 で □＝15cmです。"},
            {"question": "水面の高さを9cmにするには、はじめ容器Aに何cmの高さまで"
                         "水を入れるとよいですか。", "answer": "4.32",
             "meaning": "高さ9cmまでにしずんでいるおもりの部分は、"
                        "円すい全部から上の小さい円すい（高さ6cm）を取りのぞいた形です。"
                        "小さい円すいの底面の半径は 6×6÷15＝2.4cm。"
                        "しずんだ体積は 円すい全部−小さい円すい＝(36×15−2.4×2.4×6)÷3×円周率"
                        "＝168.48×円周率。"
                        "水は 円柱9cmぶん−しずんだ体積＝(36×9−168.48)×円周率＝155.52×円周率。"
                        "これを底面積36×円周率でわって 4.32cmです。"},
        ],
    },
    {
        "id": "hd5n_06_4", "src": "HG-2204", "star": 3,
        "title": "正方形から作る四角すい", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "1辺が18cmの正方形から、底辺が18cmで高さが4.5cmの二等辺三角形4つを"
                 "切り取ってできた形（風車のような形）を組み立てると、四角すいができます。"
                 "角すいの体積は（底面積）×（高さ）×3分の1でもとめられます。",
        "svg": "",
        "steps": [
            {"question": "組み立てたとき、底面になる正方形の面積は何cm²ですか。", "answer": "40.5",
             "meaning": "切り取った4つの三角形の頂点が、底面の正方形の4つの頂点になります。"
                        "その正方形は対角線が9cmずつなので、面積は 9×9÷2＝40.5cm²です。"},
            {"question": "この四角すいの高さは何cmですか。", "answer": "9",
             "meaning": "もとの正方形の頂点から底面の頂点までの長さは 10.06…cmで、"
                        "底面の中心から頂点までは4.5cm。"
                        "直角三角形で 高さ×高さ＝101.25−20.25＝81 なので高さは9cmです。"},
            {"question": "この四角すいの体積は何cm³ですか。", "answer": "121.5",
             "meaning": "40.5×9÷3＝121.5cm³です。"},
        ],
    },
    {
        "id": "hd5n_06_5", "src": "HG-2205", "star": 2,
        "title": "立方体の中の正八面体", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "1辺が15cmの立方体の、各面の中心を結んでできる正八面体を考えます。",
        "svg": "",
        "steps": [
            {"question": "正八面体を上下2つに分けると、どんな形が2つできますか。",
             "answer": "四角すい", "choices": ["四角すい", "三角すい", "円すい", "立方体"],
             "meaning": "まん中で水平に切ると、上下に同じ四角すいが2つできます。"},
            {"question": "その四角すい1つの底面積は何cm²ですか。", "answer": "112.5",
             "meaning": "底面は立方体の側面4つの中心を結んだ正方形で、"
                        "対角線が15cmずつ。15×15÷2＝112.5cm²です。"},
            {"question": "正八面体の体積は何cm³ですか。", "answer": "562.5",
             "meaning": "四角すい1つの高さは 15÷2＝7.5cm。"
                        "112.5×7.5÷3＝281.25cm³。2つで562.5cm³です。"
                        "じつは立方体の体積 15×15×15＝3375 の6分の1になっています。"},
        ],
    },
    {
        "id": "hd5n_06_6", "src": "HG-2206", "star": 3,
        "title": "直方体の中の三角すい", "category": "rittai", "unit": "立体図形（体積・表面積）",
        "intro": "直方体ABCD-EFGHがあって、底面は対角線の長さが12cmの正方形、"
                 "高さAEは8cmです。正方形EFGHの対角線EG上に2点P、Qを、"
                 "EP＝2cm、QG＝2cm となるようにとります。",
        "svg": "",
        "steps": [
            {"question": "PQの長さは何cmですか。", "answer": "8",
             "meaning": "EGは12cmで、両はしから2cmずつ内がわなので 12−2−2＝8cmです。"},
            {"question": "底面の正方形の面積は何cm²ですか。", "answer": "72",
             "meaning": "対角線が12cmずつなので 12×12÷2＝72cm²です。"},
            {"question": "4点P、B、D、Qを結んでできる三角すいの体積は何cm³ですか。",
             "answer": "128",
             "meaning": "BDとPQはねじれの位置にあり、BDは12cm、PQは8cm、"
                        "上下のへだたりは8cmです。"
                        "このような立体の体積は BD×PQ×高さ÷6 でもとめられて "
                        "12×8×8÷6＝128cm³です。"},
        ],
    },
]


def check(out, bad, allids):
    for q in out:
        allids.append(q["id"])
        if not q.get("steps"):
            bad.append("%s：設問が無い" % q["id"])
        if not q.get("src", "").startswith("HG-"):
            bad.append("%s：出典(src)が無い" % q["id"])
        for i, s in enumerate(q["steps"], 1):
            if not str(s.get("answer", "")).strip():
                bad.append("%s (%d)：答えが空" % (q["id"], i))
            if not str(s.get("meaning", "")).strip():
                bad.append("%s (%d)：解説が無い" % (q["id"], i))
            a = str(s["answer"])
            if not (a.replace(".", "", 1).isdigit() or s.get("choices")):
                bad.append("%s (%d)：数字でないのに選択肢が無い" % (q["id"], i))
            if s.get("choices") and a not in s["choices"]:
                bad.append("%s (%d)：答えが選択肢に入っていない" % (q["id"], i))


def _order(q):
    """大問を「もとのプリントの並び」にそろえる。hd3n_09_10 が hd3n_09_2 より後に来るよう
    番号は数として見る。理科の r2 のような接頭辞つきは、その学年の最後にまわす。"""
    tail = q["id"].rsplit("_", 1)[-1]
    m = re.match(r"^(\D*)(\d+)$", tail)
    return (m.group(1), int(m.group(2))) if m else (tail, 0)


def main():
    d = json.load(io.open(DAIMON, encoding="utf-8"))
    node = d["grades"].setdefault("3", {}).setdefault("nadago", {})
    node.setdefault("fukushu", {})
    node4 = d["grades"].setdefault("4", {}).setdefault("nadago", {})
    node4.setdefault("fukushu", {})
    node5 = d["grades"].setdefault("5", {}).setdefault("nadago", {})
    node5.setdefault("fukushu", {})

    bad, allids, total = [], [], 0
    G4LESSONS = {"1": [dict(q, grade=4) for q in G4],
                 "2": [dict(q, grade=4) for q in G4_2]}
    for lesson in sorted(G4LESSONS, key=int):
        g4 = G4LESSONS[lesson]
        check(g4, bad, allids)
        total += sum(len(q["steps"]) for q in g4)
        print("小4灘合 第%s回：大問%d本／設問%d問"
              % (lesson, len(g4), sum(len(q["steps"]) for q in g4)))
        for q in g4:
            print("  ★%d %-11s %-28s 設問%d問 図%s  (%s)"
                  % (q["star"], q["id"], q["title"], len(q["steps"]),
                     "あり" if q["svg"] else "なし", q["src"]))
        print("")

    g5 = sorted([dict(q, grade=5) for q in G5], key=_order)
    check(g5, bad, allids)
    total += sum(len(q["steps"]) for q in g5)
    print("小5灘合 第6回：大問%d本／設問%d問" % (len(g5), sum(len(q["steps"]) for q in g5)))
    for q in g5:
        print("  ★%d %-11s %-28s 設問%d問 図%s  (%s)"
              % (q["star"], q["id"], q["title"], len(q["steps"]),
                 "あり" if q["svg"] else "なし", q["src"]))
    print("")

    for lesson in sorted(LESSONS, key=int):
        out = sorted([dict(q, grade=3) for q in LESSONS[lesson]], key=_order)
        total += sum(len(q["steps"]) for q in out)
        print("小3灘合 第%s回：大問%d本／設問%d問"
              % (lesson, len(out), sum(len(q["steps"]) for q in out)))
        for q in out:
            allids.append(q["id"])
            print("  ★%d %-11s %-28s 設問%d問 図%s  (%s)"
                  % (q["star"], q["id"], q["title"], len(q["steps"]),
                     "あり" if q["svg"] else "なし", q["src"]))
            if not q.get("steps"):
                bad.append("%s：設問が無い" % q["id"])
            if not q.get("src", "").startswith("HG-"):
                bad.append("%s：出典(src)が無い" % q["id"])
            for i, s in enumerate(q["steps"], 1):
                if not str(s.get("answer", "")).strip():
                    bad.append("%s (%d)：答えが空" % (q["id"], i))
                if not str(s.get("meaning", "")).strip():
                    bad.append("%s (%d)：解説が無い" % (q["id"], i))
                a = str(s["answer"])
                # ★数字でないなら選択肢が要る。テンキーでは答えられない（_note のきまり）
                if not (a.replace(".", "", 1).isdigit() or s.get("choices")):
                    bad.append("%s (%d)：数字でないのに選択肢が無い" % (q["id"], i))
                if s.get("choices") and a not in s["choices"]:
                    bad.append("%s (%d)：答えが選択肢に入っていない" % (q["id"], i))
        LESSONS[lesson] = out
        print("")

    if len(set(allids)) != len(allids):
        bad.append("id が重複している")

    print("合計：大問%d本／設問%d問" % (len(allids), total))
    print("\n【検査】")
    print("  ✓ 0件" if not bad else "\n".join("  ✗ " + b for b in bad))
    if bad:
        sys.exit(1)

    if "--write" in sys.argv:
        for lesson, out in LESSONS.items():
            node["fukushu"][lesson] = out
        for lesson, out in G4LESSONS.items():
            node4["fukushu"][lesson] = out
        node5["fukushu"]["6"] = g5
        with io.open(DAIMON, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
        json.load(io.open(DAIMON, encoding="utf-8"))
        print("\n✓ 書きこんだ → grades/3/nadago/fukushu/%s ＋ grades/4/nadago/fukushu/%s"
              % ("・".join(sorted(LESSONS, key=int)),
                 "・".join(sorted(G4LESSONS, key=int))))
    else:
        print("\n（--write で書きこむ）")


if __name__ == "__main__":
    main()
