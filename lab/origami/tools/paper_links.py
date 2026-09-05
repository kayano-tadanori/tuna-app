"""紙の「つながり」を1本ずつ調べる ── 公理で折線を出す前の下調べ。

★なぜ要るか（本人 2026-09-05）
   「公理でだした折れ線でヒンジを入れておいて実装時はそれを動かす。
     **公理で出すにもどの座標同士を繋ぐのかのチェックと調査が必要**だと思う」

   折り紙の公理（角の二等分線＝公理3 など）は「どの線とどの線」「どの点とどの点」を
   与えて初めて答えを返す。潰し折りなら「**ふくろの背**をどこへ重ねるか」だが、
   折った紙は同じ場所に何枚も重なっているので、**どれが背でどれがただの重なりか**が
   目で見ても分からない。ここを機械で確定させる。

★分け方（原紙の座標へ逆写像して決める。見た目の位置では決めない）
   ・**背**   … 2枚以上が**原紙で同じ線分**に戻る＝紙として地続き。
                ここが潰し折りの軸になる。ヒンジを入れるのもここ。
   ・**ふち** … 原紙の外周に**沿っている**＝ここは開く（ふくろの口）。
   ・**片側だけ** … 相手が別の場所にいる＝そこでは切れて見えるだけ。

   ⚠ ふちの判定は「線分が外周に沿っているか」で見る。端点が外周に触れているかで
     判定すると、**折り目まで「ふち」になる**（2026-09-05に実際にやった）。
   ⚠ 同じ場所にある辺をひとまとめに数えてはいけない。**背は特定のペアどうし**で、
     4枚重なっていても繋がっているのは2枚ずつだったりする（同上）。

★重なり順について：やってはいけない決めつけ（2026-09-05に実際に外した）
   🚨**「背でつながった2枚は、その場所で隣り合っているはず」は間違い。**
     厚い束をまとめて半分に折ると、**いちばん外側の紙の背は束の一番上と一番下をつなぐ**
     ＝隣り合うどころか最大に離れる。この誤ったことわりで検査を書いたら、
     出荷ずみで検証ずみの14作品が98件も「違反」になった。
     → **出荷ずみの作品が大量に落ちたら、まず自分のことわりを疑う**
       （[[feedback_kansa_script_copy]]「リストを出す検査には答え合わせの安全弁を」）。
   重なり順に一発で効く不変則を探すより、**1手ずつ折りながら確定させる**方が確か
   （本人 2026-09-05「折紙はいろんな種類があるからね、なるべく幅を持たせておいて、
     実際に折っていって座標を確定させていく」）→ `--steps`。

★使い方
   python paper_links.py            … 潰し折りの出発点（正方形を2回折った4枚重ね）
   python paper_links.py koppu      … その作品の折り終わりを詳しく
   python paper_links.py kabuto --steps … 1手ごとに（紙が何枚・背が何本になっていくか）
   ライブラリとしては links(st) / steps_links(st) / spines(st) が構造を返す
   （公理の入力を作る側から呼ぶ）。
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from fold2d import FoldState, xf_inv_apply, IDENTITY_XF

TOL = 1e-6
_r4 = lambda v: (round(v[0], 4), round(v[1], 4))


def _edges(poly):
    return [(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))]


def _key(a, b):
    a, b = _r4(a), _r4(b)
    return (a, b) if a <= b else (b, a)


def _along_border(a, b, hw, hh, tol=TOL):
    """線分が原紙の外周に**沿っている**か。端点が触れているだけは数えない。"""
    return ((abs(a[0] - hw) < tol and abs(b[0] - hw) < tol) or
            (abs(a[0] + hw) < tol and abs(b[0] + hw) < tol) or
            (abs(a[1] - hh) < tol and abs(b[1] - hh) < tol) or
            (abs(a[1] + hh) < tol and abs(b[1] + hh) < tol))


def links_from(panels, paper):
    """紙切れの一覧（'poly' と 'xf'、あれば 'src'）から辺を分類する。
       ★1手ごとの控え（st.snapshots）にもそのまま使えるように、状態ではなく
         紙切れの一覧を受け取る形にしてある
         （本人 2026-09-05「実際に折っていって座標を確定させていく」）。"""
    hw, hh = paper['hw'], paper['hh']
    rows = []
    for pi, p in enumerate(panels):
        xf = p.get('xf', IDENTITY_XF)
        src = p.get('src')
        poly = p['poly']
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            if src is not None:
                oa, ob = src[i], src[(i + 1) % len(src)]
            else:
                oa, ob = xf_inv_apply(xf, a), xf_inv_apply(xf, b)
            rows.append({'panel': pi, 'layer': p['layer'],
                         'now': _key(a, b), 'org': _key(oa, ob),
                         'border': _along_border(oa, ob, hw, hh)})
    by_now = {}
    for r in rows:
        by_now.setdefault(r['now'], []).append(r)

    out = []
    for now in sorted(by_now):
        by_org = {}
        for r in by_now[now]:
            by_org.setdefault(r['org'], []).append(r)
        groups = []
        for org in sorted(by_org):
            g = by_org[org]
            panels = sorted(r['panel'] for r in g)
            kind = ('border' if g[0]['border']
                    else 'spine' if len(panels) >= 2
                    else 'single')
            groups.append({'org': org, 'panels': panels, 'kind': kind})
        out.append({'now': now, 'groups': groups})
    return out


def links(st):
    """いまの紙の辺を分類して返す。

    戻り値: [{'now': ((x,y),(x,y)),            # いまの座標での辺の場所
              'groups': [{'org': ((x,y),(x,y)),  # 原紙での線分
                          'panels': [i, ...],    # そこに居る紙切れ
                          'kind': 'spine'|'border'|'single'}]}]
    """
    return links_from(st.panels, st.paper)


def steps_links(st):
    """★1手ごとの調べ。折り進めながら座標を確定させていくための入口。
       [(何手目か, links の結果, 紙切れの枚数), ...] を返す。"""
    out = []
    for i, sn in enumerate(st.snapshots):
        out.append((sn['nfold'], links_from(sn['panels'], st.paper), len(sn['panels'])))
    return out


def at_point(st, xy, tol=1e-6):
    """★指定した座標に、紙のどの部分が集まっているかを出す（本人 2026-09-05
       「紙の重なりから、指定した座標に紙のどの部分が集まってるかは計算ででるよね」）。

    折った紙は同じ場所に何枚も重なるが、**その1枚ずつが原紙のどこから来たか**は
    xf で逆写像すれば出る。「この角をここへ」と言うときに、**どの紙のことか**を
    座標で指定できるようになる＝私が「上から何枚」を勝手に選ぶ必要が無くなる。

    戻り値: [{'panel': i, 'layer': n, 'org': (x,y), 'on_edge': bool}, ...]
            層の順（上から）に並ぶ。
    """
    out = []
    for pi, p in enumerate(st.panels):
        poly = p['poly']
        if not _point_in(xy, poly, tol):
            continue
        xf = p.get('xf', IDENTITY_XF)
        org = xf_inv_apply(xf, xy)
        # その点が紙切れの角／辺の上にあるか（角なら「めくれる先端」のことが多い）
        on_edge = any(_near_seg(xy, poly[i], poly[(i + 1) % len(poly)], tol)
                      for i in range(len(poly)))
        out.append({'panel': pi, 'layer': p['layer'],
                    'org': (round(org[0], 6), round(org[1], 6)),
                    'on_edge': on_edge})
    out.sort(key=lambda r: -r['layer'])
    return out


def _point_in(pt, poly, tol=1e-6):
    """点が多角形の内側か辺の上にあるか。"""
    n = len(poly)
    for i in range(n):
        if _near_seg(pt, poly[i], poly[(i + 1) % n], tol):
            return True
    inside = False
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > pt[1]) != (y2 > pt[1]):
            xx = x1 + (pt[1] - y1) * (x2 - x1) / (y2 - y1)
            if xx > pt[0]:
                inside = not inside
    return inside


def _near_seg(p, a, b, tol=1e-6):
    vx, vy = b[0] - a[0], b[1] - a[1]
    wx, wy = p[0] - a[0], p[1] - a[1]
    L2 = vx * vx + vy * vy
    if L2 < 1e-18:
        return (wx * wx + wy * wy) ** 0.5 < tol
    t = max(0.0, min(1.0, (wx * vx + wy * vy) / L2))
    dx, dy = wx - vx * t, wy - vy * t
    return (dx * dx + dy * dy) ** 0.5 < tol


def at_point_report(st, xy, title=''):
    rows = at_point(st, xy)
    print(f'\n  ◆ 座標({xy[0]:+.3f},{xy[1]:+.3f}) に集まっている紙: {len(rows)}枚'
          + (f'  ── {title}' if title else ''))
    if not rows:
        print('      （そこには紙が無い）')
        return rows
    print(f'      {"層":>4}  {"紙":>3}   原紙のどこか        角/辺の上か')
    for r in rows:
        print(f'      {r["layer"]:>4}  {r["panel"]:>3}   '
              f'({r["org"][0]:+.4f},{r["org"][1]:+.4f})   '
              f'{"ふち・角の上" if r["on_edge"] else "紙の内側"}')
    return rows


def spines(st):
    """★公理に食わせる候補＝『背』だけを取り出す。
       (いまの座標での線分, 原紙での線分, その背をつくっている紙切れ) の一覧。"""
    out = []
    for e in links(st):
        for g in e['groups']:
            if g['kind'] == 'spine':
                out.append({'now': e['now'], 'org': g['org'], 'panels': g['panels']})
    return out


_LABEL = {'spine': '★背（地続き＝ここでつながっている）',
          'border': 'ふち（ここは開く）',
          'single': '片側だけ（相手は別の場所にいる）'}


def report(st, title=''):
    if title:
        print(f'\n########## {title}')
    ls = links(st)
    ns = sum(1 for e in ls for g in e['groups'] if g['kind'] == 'spine')
    print(f'  紙切れ {len(st.panels)}枚 ／ 辺の場所 {len(ls)}か所 ／ 背 {ns}本')
    for e in ls:
        (a, b) = e['now']
        n = sum(len(g['panels']) for g in e['groups'])
        print(f'\n  ◆ ({a[0]:+.2f},{a[1]:+.2f})−({b[0]:+.2f},{b[1]:+.2f})   {n}枚')
        for g in e['groups']:
            (oa, ob) = g['org']
            print(f'      原紙({oa[0]:+.2f},{oa[1]:+.2f})−({ob[0]:+.2f},{ob[1]:+.2f})'
                  f'  面{g["panels"]}  {_LABEL[g["kind"]]}')


def _demo():
    st = FoldState(1.0)
    report(st, 'まだ折っていない正方形')
    st.fold((0, -1), (0, 1), 'V', name='たて半分')
    report(st, 'たて半分（2枚重ね）')
    st.fold((-1, 0), (1, 0), 'V', name='よこ半分')
    report(st, 'よこ半分（4枚重ね）＝潰し折りの出発点')
    print('\n  ★公理に食わせる候補（背）:')
    for s in spines(st):
        (a, b) = s['now']
        print(f'     ({a[0]:+.2f},{a[1]:+.2f})−({b[0]:+.2f},{b[1]:+.2f})  面{s["panels"]}')


def steps_report(st, title=''):
    """1手ごとに「背が何本／どこまで深いか」を並べる。折り進めながら確定させる用。"""
    print(f'\n########## {title} ── 1手ごと')
    print(f'  {"手":>3}{"紙":>5}{"辺の場所":>9}{"背":>5}{"いちばん深い所":>14}'
          f'  同じ場所に背が2本以上')
    print('  ' + '-' * 70)
    for nfold, ls, npan in steps_links(st):
        sp = sum(1 for e in ls for g in e['groups'] if g['kind'] == 'spine')
        deep = max((sum(len(g['panels']) for g in e['groups']) for e in ls), default=0)
        multi = sum(1 for e in ls
                    if sum(1 for g in e['groups'] if g['kind'] == 'spine') >= 2)
        print(f'  {nfold:>3}{npan:>5}{len(ls):>9}{sp:>5}{deep:>12}枚  {multi}か所')


def main():
    args = sys.argv[1:]
    per_step = '--steps' in args
    names = [a for a in args if not a.startswith('-')]
    if not names:
        _demo()
        return 0
    import works_build as W
    for nm in names:
        if nm not in W.BUILDERS:
            print(f'そんな作品はない: {nm}\nある作品: {", ".join(W.BUILDERS)}')
            return 2
        st, meta = W.BUILDERS[nm]()
        if per_step:
            steps_report(st, f'{nm}（{meta["name"]}）')
        else:
            report(st, f'{nm}（{meta["name"]}）折り終わり')
    return 0


if __name__ == '__main__':
    sys.exit(main())
