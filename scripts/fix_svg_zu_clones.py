# -*- coding: utf-8 -*-
"""図形単元（sansu_zu）で、1枚の図を何問も使い回して内容と食いちがっている図を描き直す。

  きっかけ：sz074 の「図がおかしい」通報。調べると同じSVGを使い回している群が53あり、
  そのうち44問は問題文と図が合っていなかった（角を取ったはずのタイルが欠けていない、
  三角形2こなのに3こ描いてある、正方形の線対称なのに三角形の図…など）。
  ※つみき系9問は先に scripts/fix_svg_tsumiki.py で直した。

  使い方：
    python scripts/fix_svg_zu_clones.py            … 検算だけ
    ZU_PREVIEW=out.html python scripts/fix_svg_zu_clones.py   … 目視用HTMLも書く
    python scripts/fix_svg_zu_clones.py --write    … data/sansu_zu.json を書きかえる
"""
import json, io, os, sys, math

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, 'data', 'sansu_zu.json')

# ── 配色（既存の図とそろえる）──
ST    = '#4f9eff'   # 線
FL    = '#1b3168'   # 面
LB    = '#ffd166'   # ラベル
TOP   = '#4f7cff'   # 立体の上の面
RIGHT = '#2a4a9a'   # 立体の右の面
LEFT  = '#1b3168'   # 立体の左の面
LN    = '#cfe0ff'   # 立体の線


def n(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


def wrap(body, x0, y0, w, h, maxw=280):
    return ("<svg viewBox='%s %s %s %s' xmlns='http://www.w3.org/2000/svg' "
            "style='display:block;margin:6px auto;max-width:%dpx'>%s</svg>"
            % (n(x0), n(y0), n(w), n(h), maxw, ''.join(body)))


def text(x, y, t, anchor='middle', size=11, fill=LB):
    return ("<text x='%s' y='%s' font-size='%d' font-weight='bold' fill='%s' text-anchor='%s'>%s</text>"
            % (n(x), n(y), size, fill, anchor, t))


def rect(x, y, w, h, fill=FL, sw=1.8):
    return ("<rect x='%s' y='%s' width='%s' height='%s' fill='%s' stroke='%s' stroke-width='%s'/>"
            % (n(x), n(y), n(w), n(h), fill, ST, n(sw)))


# ══════════ 平面のタイル・マス目 ══════════
def tiles(cols, rows, cut_corner=False):
    """たてrows・よこcols のタイル。cut_corner なら右上の1まいを取る。"""
    S = 26.0
    b = []
    for r in range(rows):
        for c in range(cols):
            if cut_corner and r == 0 and c == cols - 1:
                continue
            b.append(rect(c * S, r * S, S, S))
    return wrap(b, -4, -4, cols * S + 8, rows * S + 8, maxw=min(300, 40 + cols * 30))


def tiles_scattered(cnt):
    """まだ組んでいない、ばらばらに置いたタイル cnt まい（長方形の形をにおわせない）。"""
    S = 22.0
    # 手で決めた散らばり（規則的にならべると答えの形を見せてしまう）
    spots = [(0, 6, -7), (30, 0, 5), (62, 10, -3), (92, 2, 8), (124, 12, -6), (152, 4, 4),
             (6, 44, 6), (38, 52, -5), (70, 42, 3), (100, 54, -8), (130, 44, 7), (158, 52, -4)]
    b = []
    for i in range(cnt):
        x, y, rot = spots[i % len(spots)]
        b.append("<g transform='rotate(%s %s %s)'>%s</g>"
                 % (n(rot), n(x + S / 2), n(y + S / 2), rect(x, y, S, S)))
    b.append(text(92, 96, '%dまいのタイル' % cnt))
    return wrap(b, -12, -12, 216, 122, maxw=300)


# ══════════ 三角形 ══════════
def tri_separate(cnt):
    """ばらばらの三角形を cnt こ。"""
    a, gap = 34.0, 14.0
    h = a * 0.866
    b = []
    for i in range(cnt):
        x = i * (a + gap)
        b.append("<polygon points='%s,%s %s,%s %s,%s' fill='%s' stroke='%s' stroke-width='1.8' "
                 "stroke-linejoin='round'/>"
                 % (n(x), n(h), n(x + a), n(h), n(x + a / 2), n(0), FL, ST))
    w = cnt * a + (cnt - 1) * gap
    lab = 'さんかくけい%dこ' % cnt
    b.append(text(w / 2, h + 16, lab))
    need = max(w, len(lab) * 11.0)
    return wrap(b, w / 2 - need / 2 - 6, -6, need + 12, h + 28, maxw=min(300, 60 + cnt * 46))


def tri_chain(cnt):
    """△▽△… を cnt こ、よこ一れつにくっつけた形（ぼうの本数を数えられるように辺で描く）。"""
    a = 30.0
    h = a * 0.866
    segs = []
    for i in range(cnt):
        x = i * a / 2.0
        if i % 2 == 0:   # 上向き
            p1, p2, p3 = (x, h), (x + a, h), (x + a / 2, 0)
        else:            # 下向き
            p1, p2, p3 = (x, 0), (x + a, 0), (x + a / 2, h)
        for s in ((p1, p2), (p2, p3), (p3, p1)):
            k = tuple(sorted((tuple(round(v, 2) for v in s[0]), tuple(round(v, 2) for v in s[1]))))
            if k not in segs:
                segs.append(k)
    b = []
    for (x1, y1), (x2, y2) in segs:
        b.append("<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='2' "
                 "stroke-linecap='round'/>" % (n(x1), n(y1), n(x2), n(y2), ST))
    w = (cnt + 1) * a / 2.0
    lab = 'さんかくけい%dこ' % cnt
    b.append(text(w / 2, h + 17, lab))
    need = max(w, len(lab) * 11.0)          # ラベルのはばも viewBox に入れる
    return wrap(b, w / 2 - need / 2 - 6, -6, need + 12, h + 29, maxw=min(320, 70 + cnt * 34))


# ══════════ かいだん ══════════
def stairs(cols):
    """1れつ目1こ、2れつ目2こ…と cols れつ つんだ かいだん。"""
    S = 20.0
    b = []
    for c in range(cols):
        for r in range(c + 1):
            b.append(rect(c * S, (cols - 1 - r) * S, S, S))
    b.append(text(cols * S / 2, cols * S + 16, 'かいだんの形'))
    return wrap(b, -5, -5, cols * S + 10, cols * S + 28, maxw=min(300, 40 + cols * 34))


# ══════════ 紙を折る ══════════
def fold(times, holes):
    """もとの紙 → times かい おったところ（穴 holes こ）。"""
    W, H = 92.0, 62.0
    fw = W / (2 ** ((times + 1) // 2))
    fh = H / (2 ** (times // 2))
    ax0, ax1 = W + 14, W + 44         # 矢印
    fx, fy = ax1 + 12, H - fh          # 折った紙（下をそろえる）
    b = [rect(0, 0, W, H, fill='none')]
    b.append("<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='2'/>"
             % (n(ax0), n(H / 2), n(ax1 - 4), n(H / 2), LB))
    b.append("<polygon points='%s,%s %s,%s %s,%s' fill='%s'/>"
             % (n(ax1 + 3), n(H / 2), n(ax1 - 6), n(H / 2 - 5), n(ax1 - 6), n(H / 2 + 5), LB))
    b.append(rect(fx, fy, fw, fh, fill=FL))
    if holes:
        r = 3.2
        if fw >= fh:                                   # よこに ならべる
            for i in range(holes):
                cx = fx + fw * (i + 1) / (holes + 1.0)
                b.append("<circle cx='%s' cy='%s' r='%s' fill='#080e20' stroke='%s' stroke-width='1.4'/>"
                         % (n(cx), n(fy + fh / 2), n(r), ST))
        else:                                          # たてに ならべる
            for i in range(holes):
                cy = fy + fh * (i + 1) / (holes + 1.0)
                b.append("<circle cx='%s' cy='%s' r='%s' fill='#080e20' stroke='%s' stroke-width='1.4'/>"
                         % (n(fx + fw / 2), n(cy), n(r), ST))
    b.append(text(W / 2, H + 16, 'もとのかみ'))
    lab = '%dかいおる' % times
    b.append(text((ax0 + ax1) / 2, H / 2 - 9, lab))
    b.append(text(fx + fw / 2, H + 16, ('あなを%dこ' % holes) if holes else 'おったところ'))
    right = fx + fw
    return wrap(b, -8, -8, right + 30, H + 32, maxw=320)


# ══════════ 立体（アイソメ） ══════════
def iso_box(ox, oy, w, d, h, S, out):
    """上の面のいちばん奥の角が (ox,oy) の、よこw・おくd・たかさh の箱を描く。"""
    ax, ay = 0.866 * S, 0.5 * S
    bx, by = -0.866 * S, 0.5 * S

    def p(i, j, k):
        return (ox + i * ax + j * bx, oy + i * ay + j * by + k * S)

    A, B, F, G = p(0, 0, 0), p(w, 0, 0), p(0, d, 0), p(w, d, 0)
    C, E, D_ = p(w, 0, h), p(0, d, h), p(w, d, h)
    def poly(pts, fill, op):
        return ("<polygon points='%s' fill='%s' opacity='%s'/>"
                % (' '.join('%s,%s' % (n(x), n(y)) for x, y in pts), fill, op))
    out.append(poly([A, B, G, F], TOP, '0.5'))
    out.append(poly([B, C, D_, G], RIGHT, '0.85'))
    out.append(poly([F, G, D_, E], LEFT, '0.9'))
    ln = []
    for i in range(1, w):
        ln += [(p(i, 0, 0), p(i, d, 0)), (p(i, d, 0), p(i, d, h))]
    for j in range(1, d):
        ln += [(p(0, j, 0), p(w, j, 0)), (p(w, j, 0), p(w, j, h))]
    for k in range(1, h):
        ln += [(p(w, 0, k), p(w, d, k)), (p(0, d, k), p(w, d, k))]
    for (x1, y1), (x2, y2) in ln:
        out.append("<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='1' opacity='0.75'/>"
                   % (n(x1), n(y1), n(x2), n(y2), LN))
    out.append("<polygon points='%s' fill='none' stroke='%s' stroke-width='1.6' stroke-linejoin='round'/>"
               % (' '.join('%s,%s' % (n(x), n(y)) for x, y in [A, B, C, D_, E, F]), LN))
    return [A, B, C, D_, E, F, G]


def pyramid(dan):
    """上から1こ・4こ・9こ…と dan だん つんだ ピラミッド。"""
    S = 17.0
    body, pts = [], []
    for k in range(dan):                    # k=0 が いちばん下の だん
        s = dan - k
        got = iso_box(0, -k * S / 2.0, s, s, 1, S, body)
        pts += got
    xs = [x for x, y in pts]
    ys = [y for x, y in pts]
    body.append(text((min(xs) + max(xs)) / 2, max(ys) + 17, '%dだん' % dan))
    pad = 6
    return wrap(body, min(xs) - pad, min(ys) - pad,
                max(xs) - min(xs) + pad * 2, max(ys) - min(ys) + pad * 2 + 20,
                maxw=min(300, 90 + dan * 30))


# ══════════ 円 ══════════
def two_circles(r1, r2):
    """外がわでぴったりくっついた2つの円と、中心をむすぶ線。"""
    s = 150.0 / (2.0 * (r1 + r2))
    R1, R2 = r1 * s, r2 * s
    cy = max(R1, R2)
    c1 = (R1, cy)
    c2 = (2 * R1 + R2, cy)
    b = []
    for (cx, cyy), R in ((c1, R1), (c2, R2)):
        b.append("<circle cx='%s' cy='%s' r='%s' fill='%s' fill-opacity='0.35' stroke='%s' stroke-width='2'/>"
                 % (n(cx), n(cyy), n(R), FL, ST))
    b.append("<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='2'/>"
             % (n(c1[0]), n(cy), n(c2[0]), n(cy), LB))
    for cx, cyy in (c1, c2):
        b.append("<circle cx='%s' cy='%s' r='2.6' fill='%s'/>" % (n(cx), n(cyy), LB))
    b.append(text((c1[0] + c2[0]) / 2, cy - 9, '？', size=13))
    b.append(text(c1[0], cy + max(R1, R2) + 16, '半径%dcm' % r1))
    b.append(text(c2[0], cy + max(R1, R2) + 16, '半径%dcm' % r2))
    w = 2 * R1 + 2 * R2
    return wrap(b, -14, -8, w + 28, 2 * cy + 36, maxw=300)


def ball_in_box(r):
    """箱にぴったり入ったボール（半径 r cm）。"""
    s = 120.0 / (2.0 * r)
    R = r * s
    b = [rect(0, 0, 2 * R, 2 * R, fill='none')]
    b.append("<circle cx='%s' cy='%s' r='%s' fill='%s' fill-opacity='0.4' stroke='%s' stroke-width='2'/>"
             % (n(R), n(R), n(R), FL, ST))
    b.append("<line x1='%s' y1='%s' x2='%s' y2='%s' stroke='%s' stroke-width='2'/>"
             % (n(R), n(R), n(2 * R), n(R), LB))
    b.append("<circle cx='%s' cy='%s' r='2.6' fill='%s'/>" % (n(R), n(R), LB))
    b.append(text(R * 1.5, R - 6, '%dcm' % r))
    b.append(text(2 * R + 10, R + 4, '高さ？', anchor='start'))
    b.append(text(R, 2 * R + 16, 'ボールと箱'))
    return wrap(b, -8, -8, 2 * R + 62, 2 * R + 32, maxw=260)


# ══════════ 線対称の形（軸は描かない）══════════
def shape_only(kind):
    b = []
    if kind == 'square':
        b.append(rect(0, 0, 96, 96))
        w, h, lab = 96, 96, '正方形'
    elif kind == 'rect':
        b.append(rect(0, 0, 132, 84))
        w, h, lab = 132, 84, '長方形'
    else:
        a = 104.0
        hh = a * 0.866
        b.append("<polygon points='%s,%s %s,%s %s,%s' fill='%s' stroke='%s' stroke-width='1.8' "
                 "stroke-linejoin='round'/>" % (n(0), n(hh), n(a), n(hh), n(a / 2), n(0), FL, ST))
        w, h, lab = a, hh, '正三角形'
    b.append(text(w / 2, h + 17, lab))
    return wrap(b, -6, -6, w + 12, h + 30, maxw=240)


# ══════════ 直しどころ ══════════
FIX = {}
# A タイルの かどを1まい取る（図が欠けていなかった）
FIX['sz033'] = tiles(4, 2, cut_corner=True)
FIX['sz034'] = tiles(3, 3, cut_corner=True)
FIX['sz035'] = tiles(5, 2, cut_corner=True)
FIX['sz036'] = tiles(4, 3, cut_corner=True)
# B ばらばらの三角形（図は1こしか描いていなかった）
FIX['sz016'] = tri_separate(2)
FIX['sz017'] = tri_separate(3)
FIX['sz018'] = tri_separate(4)
# C 紙を折る（折る回数・穴の数が図に出ていなかった）
FIX['sz020'] = fold(2, 0)
FIX['sz051'] = fold(1, 1)
FIX['sz052'] = fold(2, 1)
FIX['sz053'] = fold(3, 1)
FIX['sz054'] = fold(2, 2)
FIX['sz072'] = fold(3, 1)
FIX['sz073'] = fold(2, 3)
FIX['sz130'] = fold(4, 1)
FIX['sz147'] = fold(3, 2)
FIX['sz462'] = fold(3, 0)
# D △▽△…（図はいつも3こだった）
FIX['sz025'] = tri_chain(2)
FIX['sz027'] = tri_chain(4)
FIX['sz028'] = tri_chain(5)
FIX['sz091'] = tri_chain(4)
FIX['sz092'] = tri_chain(5)
FIX['sz093'] = tri_chain(6)
# E ピラミッド（図は平面の三角形つみで、段数もちがった）
FIX['sz045'] = pyramid(2)
FIX['sz046'] = pyramid(3)
FIX['sz112'] = pyramid(3)
FIX['sz113'] = pyramid(4)
FIX['sz114'] = pyramid(5)
FIX['sz139'] = pyramid(4)
FIX['sz140'] = pyramid(5)
FIX['sz467'] = pyramid(6)
# F かいだん（図は5れつ固定だった）
FIX['sz065'] = stairs(4)
# G 12まいのタイル（3×4の図が答えそのものだった）
FIX['sz152'] = tiles_scattered(12)
# H 外がわでくっつく2つの円（半径の比が図と合っていなかった）
FIX['sz177'] = two_circles(4, 4)
FIX['sz178'] = two_circles(5, 5)
FIX['sz179'] = two_circles(3, 6)
FIX['sz180'] = two_circles(6, 4)
# I 箱にぴったり入ったボール（箱が描かれていなかった）
FIX['sz171'] = ball_in_box(6)
# J 線対称（正方形・長方形なのに三角形の図。軸の点線も答えを見せていた）
FIX['sz1641'] = shape_only('square')
FIX['sz1642'] = shape_only('rect')
FIX['sz1643'] = shape_only('tri')
FIX['sz1649'] = shape_only('square')
FIX['sz1650'] = shape_only('rect')
FIX['sz1651'] = shape_only('tri')


def main():
    d = json.load(io.open(DATA, encoding='utf-8'))
    m = {q['id']: q for q in d}
    miss = [i for i in FIX if i not in m]
    if miss:
        print('!! IDが見つからない:', miss)
        sys.exit(1)

    out = os.environ.get('ZU_PREVIEW')
    if out:
        h = [u"<html><meta charset='utf-8'><body style='background:#080e20;color:#eef2ff;"
             u"font-family:sans-serif;padding:14px'>"]
        for qid in sorted(FIX):
            h.append(u"<div style='margin:0 0 16px;padding:10px;background:rgba(20,32,72,.65);"
                     u"border:1px solid rgba(120,150,220,.2);border-radius:12px;max-width:560px'>")
            h.append(u"<div style='font-size:12px;margin-bottom:4px'>%s ／ %s ／答え %s</div>"
                     % (qid, m[qid]['question'][:72], m[qid]['answer']))
            h.append(FIX[qid])
            h.append(u"</div>")
        h.append(u"</body></html>")
        io.open(out, 'w', encoding='utf-8').write(u''.join(h))
        print('プレビュー:', out)

    print('直す図:', len(FIX), '問')
    if '--write' in sys.argv:
        for q in d:
            if q['id'] in FIX:
                q['svg'] = FIX[q['id']]
        # もとのファイルは CRLF・末尾に改行なし
        with io.open(DATA, 'w', encoding='utf-8', newline='\r\n') as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
        print('書きこんだ:', DATA)


if __name__ == '__main__':
    main()
