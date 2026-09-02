"""その手が「実物の紙で本当に折れるか」を検査する。

★本人の指摘（2026-09-02）が核心
   「はずれなかったら バディの折目じゃおれない」「そこで間違いにきづく」
   ＝ちゃんとした（紙が破れない・すり抜けない）仕組みにすると、
     まちがった折り順は**折れなくなる**。その"折れなさ"こそが間違いの合図。

★何を見るか
   実物の紙で折れるのは、**重なりの上から何枚か**か、**下から何枚か**だけ。
   まん中の1枚だけを、上下の紙を置いたまま折ることはできない。
   （上の紙が押さえになって折り目まで手が届かない）

   だから各手について、折られる場所の真上・真下にある紙を全部ならべ、
   「動く紙」がその積み重ねの**上からの連続**か**下からの連続**になっているかを見る。
   なっていなければ、その手は実物では折れない。
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import math
from fold2d import (point_in_polygon, side_of_line, split_polygon,
                    xf_apply, xf_inv_apply, IDENTITY_XF)


def inside(pt, poly, eps=1e-3):
    """★「ふちの上」は数えない。紙のふちや、となり合う紙の境目にちょうど乗った点を
       「両方の紙が覆っている」と数えると、実際には重なっていない左右の羽が
       重なって見え、折れないと誤判定する（2026-09-02に実際そうなった）。
       ふちから eps 以上内側にある点だけを「覆われている」とする。"""
    if not point_in_polygon(pt, poly):
        return False
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if L < 1e-12:
            continue
        d = abs(dx * (pt[1] - a[1]) - dy * (pt[0] - a[0])) / L
        t = ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (L * L)
        if -0.05 <= t <= 1.05 and d < eps:
            return False
    return True


def shared_edge(p, q, tol=1e-7):
    """2つの多角形が共有している辺（長さのある重なり）を返す。無ければNone。"""
    for i in range(len(p)):
        a1, a2 = p[i], p[(i+1) % len(p)]
        for j in range(len(q)):
            b1, b2 = q[j], q[(j+1) % len(q)]
            # 同じ直線に乗っているか
            if abs(side_of_line(b1, a1, a2)) > tol or abs(side_of_line(b2, a1, a2)) > tol:
                continue
            dx, dy = a2[0]-a1[0], a2[1]-a1[1]
            L2 = dx*dx + dy*dy
            if L2 < 1e-18:
                continue
            ts = sorted([((b1[0]-a1[0])*dx + (b1[1]-a1[1])*dy)/L2,
                         ((b2[0]-a1[0])*dx + (b2[1]-a1[1])*dy)/L2])
            lo, hi = max(0.0, ts[0]), min(1.0, ts[1])
            # ★長さで見る（パラメータの差で見ると、長い辺では点で接しただけを拾う）
            if (hi - lo) * math.sqrt(L2) > 1e-4:
                return ((a1[0]+lo*dx, a1[1]+lo*dy), (a1[0]+hi*dx, a1[1]+hi*dy))
    return None


def _src_poly(p):
    """その紙切れを、原紙（まだ折っていない平らな紙）の座標で返す。"""
    if p.get('src'):
        return p['src']
    xf = p.get('xf', IDENTITY_XF)
    return [xf_inv_apply(xf, q) for q in p['poly']]


def check_tear(before, moved_idx, a, b, tol=1e-6):
    """★折り目でつながった紙を引き裂いていないか。
       本人の指摘（2026-09-02）「1枚だけ動くのは、ヒンジが外れてる証拠」。
       同じ1枚の紙としてつながっている所が、いま折る折り線でない場所で
       動く側と動かない側に分かれたら、それは紙を引き裂いている。

       ★つながりは**原紙（開いた紙）の座標**で見る（2026-09-03に直した）。
         いまの座標だけで見ると、**ただ重なっているだけの別の層**の輪郭が
         一致したものを「つながっている」と数えてしまう。かぶとの4〜9手目は
         それで「引き裂き」と鳴っていたが、実物では折れる手だった
         （ひし形の下辺には、元の紙の下辺と、折られて来た羽の下辺が
           重なって乗っているだけで、そこはつながっていない）。
         fold2d.py の _connected_closure と同じ見方にそろえる。"""
    bad = []
    for i in moved_idx:
        pi = before[i]
        xi = pi.get('xf', IDENTITY_XF)
        # ★動くのは「その紙のうち、折り線の動く側にある部分」だけ。
        #   紙まるごとで比べると、動かない部分がとなりの紙と接しているのを
        #   「引き裂いている」と誤検出する（2026-09-02に踏んだ）。
        _, cut = split_polygon(pi['poly'], a, b)
        if cut is None:
            continue
        src_cut = [xf_inv_apply(xi, q) for q in cut]
        sa, sb = xf_inv_apply(xi, a), xf_inv_apply(xi, b)
        for j, q in enumerate(before):
            if j in moved_idx:
                continue
            e = shared_edge(src_cut, _src_poly(q))
            if e is None:
                continue
            if abs(side_of_line(e[0], sa, sb)) < tol and abs(side_of_line(e[1], sa, sb)) < tol:
                continue          # いま折る折り線の上＝そこで折れる
            # ★その辺が「折り目」なら、そこは開けるので引き裂きではない。
            #   折り目かどうかは、2枚の紙の変換(xf)がちがうかで分かる——
            #   同じxf＝ひとつづきの同じ面が分かれただけ（間に折り目は無い）／
            #   ちがうxf＝その辺で紙が折れている。
            #   折り目を横切って一部の層だけ折るのは、実物ではごく普通にやる
            #   （かぶとのツノ開きがまさにこれ。本人「かぶとはもう完璧だよ」）。
            #   折り目は開いて角度が変わるだけで、紙は破れない。
            #   破れるのは**ひとつづきの同じ面が引き裂かれる**ときだけ。
            xj = q.get('xf', IDENTITY_XF)
            if any(abs(u - v) > 1e-9 for u, v in zip(xi, xj)):
                continue
            # ★原紙で隣どうしでも、いまの座標で同じ場所に無ければ、
            #   間に折りが入って離れている＝つながっていない
            same = all(math.hypot(xf_apply(xi, pt)[0] - xf_apply(xj, pt)[0],
                                  xf_apply(xi, pt)[1] - xf_apply(xj, pt)[1]) < 1e-6
                       for pt in e)
            if not same:
                continue
            bad.append((i, j, [xf_apply(xi, pt) for pt in e]))
    return bad


def check_step(before, moved_idx, samples):
    """before: その手の直前の紙切れ [{poly, layer}]。
       moved_idx: 動く紙切れの番号の集合。
       samples: 折られる領域の代表点。
       戻り値: 実物で折れない点のリスト。"""
    bad = []
    for pt in samples:
        stack = [i for i, p in enumerate(before) if inside(pt, p['poly'])]
        if len(stack) < 2:
            continue
        stack.sort(key=lambda i: before[i]['layer'])
        mv = [k for k, i in enumerate(stack) if i in moved_idx]
        if not mv or len(mv) == len(stack):
            continue                       # 全部動く／全部止まる＝問題なし
        # 動く紙が「上から連続」または「下から連続」になっているか
        top = mv == list(range(len(stack) - len(mv), len(stack)))
        bottom = mv == list(range(len(mv)))
        if not (top or bottom):
            bad.append((pt, [before[i]['layer'] for i in stack], mv))
    return bad


def audit(st, label, grid=44):
    """折り終わった状態のstを受け取り、1手ずつさかのぼって検査する。"""
    ok = True
    hw, hh = st.paper['hw'], st.paper['hh']
    snaps = st.snapshots
    nf = 0
    for si, step in enumerate(st.steps):
        if step['op'] != 'fold':
            continue
        nf += 1
        before = None
        for sn in snaps:                    # この手の「直前」の様子
            if sn['nfold'] == nf - 1:
                before = sn['panels']
        after = None
        for sn in snaps:
            if sn['nfold'] == nf:
                after = sn['panels']
        if before is None or after is None:
            continue
        # 動いた紙＝この手のあとに層が変わったか、位置が変わったもの。
        # 直前の紙切れのうち、折り線の「動く側」にあって実際に鏡映されたものを探す。
        a, b = step['a'], step['b']
        def side(p):
            return (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0])
        moved = set()
        samples = []
        for i, p in enumerate(before):
            cs = [side(q) for q in p['poly']]
            if min(cs) < -1e-9:             # 折り線の動く側に一部でもある
                cx = sum(q[0] for q in p['poly'])/len(p['poly'])
                cy = sum(q[1] for q in p['poly'])/len(p['poly'])
                # この紙切れが実際に動いたか＝あとの様子に同じ場所・同じ層が残っているか
                stayed = any(abs(q['layer']-p['layer']) < 1e-9
                             and point_in_polygon((cx, cy), q['poly'])
                             and _same(q['poly'], p['poly'])
                             for q in after)
                if not stayed:
                    moved.add(i)
        # 折られる領域の代表点を格子で取る
        for gx in range(grid):
            for gy in range(grid):
                x = -hw + 2*hw*(gx+0.5)/grid
                y = -hh + 2*hh*(gy+0.5)/grid
                if side((x, y)) < -1e-9:
                    samples.append((x, y))
        tear = check_tear(before, moved, a, b)
        if tear:
            ok = False
            i, j, e = tear[0]
            print(f'  NG  {label} {nf}手目「{step["name"]}」: '
                  f'折り目でつながった紙を引き裂いている（{len(tear)}か所）')
            print(f'        動く紙と動かない紙が、折り線でない辺 '
                  f'({e[0][0]:.2f},{e[0][1]:.2f})-({e[1][0]:.2f},{e[1][1]:.2f}) でつながっている')
        bad = check_step(before, moved, samples)
        if bad:
            ok = False
            pt, layers, mv = bad[0]
            print(f'  NG  {label} {nf}手目「{step["name"]}」: '
                  f'まん中の紙だけを折ろうとしている（{len(bad)}か所）')
            print(f'        例: ({pt[0]:.2f},{pt[1]:.2f}) 重なり{layers} のうち '
                  f'{mv}番目だけ動く')
        elif not tear:
            print(f'  OK  {label} {nf}手目「{step["name"]}」')
    return ok


def _same(p, q, tol=1e-7):
    if len(p) != len(q):
        return False
    return all(abs(a[0]-b[0]) < tol and abs(a[1]-b[1]) < tol for a, b in zip(p, q))


def selftest():
    """★この検査そのものが素通りしていないか（2026-09-03に追加）。
       「折り目ごしに一部の層だけ折る」を通すように直したので、
       ついでに**本物の引き裂きまで見のがしていないか**を毎回確かめる。
       ゆるめた検査は間違いを教えてくれない（[[feedback_origami_fufuritsu]]③）。"""
    from fold2d import reflect_affine
    A = {'poly': [(0,0),(1,0),(1,1),(0,1)], 'src': [(0,0),(1,0),(1,1),(0,1)],
         'xf': IDENTITY_XF, 'layer': 0}
    # ① ひとつづきの同じ面を、折り線でない所で分断する＝本物の引き裂き→鳴るべき
    B = {'poly': [(1,0),(2,0),(2,1),(1,1)], 'src': [(1,0),(2,0),(2,1),(1,1)],
         'xf': IDENTITY_XF, 'layer': 0}
    torn = bool(check_tear([A, B], {1}, (0,0.5), (2,0.5)))
    # ② 折り目でつながった紙の一部だけを折る＝実物では折れる→鳴らないべき
    C = {'poly': [(1,0),(2,0),(2,1),(1,1)], 'src': [(1,0),(0,0),(0,1),(1,1)],
         'xf': reflect_affine((1,0),(1,1)), 'layer': 1}
    quiet = not check_tear([A, C], {1}, (0,0.5), (2,0.5))
    print(('  OK  ' if torn else '  NG  ') + '引き裂きをちゃんと見つける')
    print(('  OK  ' if quiet else '  NG  ') + '折り目ごしの折りでは鳴らない')
    return torn and quiet


if __name__ == '__main__':
    import works_build as W
    names = sys.argv[1:] or list(W.BUILDERS)
    print('=== 検査そのものの点検 ===')
    all_ok = selftest()
    for nm in names:
        st, meta = W.BUILDERS[nm]()
        print(f'=== {meta["name"]} ===')
        all_ok &= audit(st, meta['name'])
    print()
    print('ALL OK' if all_ok else '★実物では折れない手がある')
    sys.exit(0 if all_ok else 1)
