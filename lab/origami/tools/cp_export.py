"""展開図(crease pattern)を、外の折り紙ソフトが読める形に書き出す。

★なぜ要るか
   fold2d.pyが出す折り筋は「線分の寄せ集め」でしかない。これを
   ①交点で全部切り分けて ②頂点を統合して ③面を抽出する
   ところまでやると、FOLD形式(折り紙の標準交換フォーマット)になる。
   FOLDにすると origamisimulator.org にそのまま放り込んで3Dで折り上がりを
   見られる。Oriedita・Rabbit Ear など他の折り紙ソフトとも行き来できる。

★FOLD形式について
   仕様: https://github.com/edemaine/fold （MITライセンスの公開仕様）
   edges_assignment の記号: B=紙のふち / M=山折り / V=谷折り /
   F=平ら(折らない) / U=未定
   edges_foldAngle: 度。谷が+180、山が-180、ふち・平らは0。
   faces_vertices は反時計回りで並べる決まり。
   コードを写したわけではなく、公開仕様を読んで自分で書いた。

★ついでに入れた検査
   Kawasaki の定理(内部の頂点まわりで、ひとつおきの角の和が180度)と
   Maekawa の定理(山の数 - 谷の数 = ±2)。折っている最中に
   「この頂点は閉じていない」を出すために使う。
   ただし[[method_origami_cp_derivation]]§9の通り、この2つを満たすことは
   「実際に紙で折れる」ことの保証にはならない——必要条件のふるいでしかない。
"""
import math
import json

TOL = 1e-7


# ---------------------------------------------------------------- 平面グラフ化

def _key(p, tol=TOL):
    return (round(p[0] / tol), round(p[1] / tol))


def _seg_intersect(a1, a2, b1, b2):
    """線分a1-a2と線分b1-b2の交点(端点で触れる場合も含む)。平行ならNone。"""
    x1, y1 = a1; x2, y2 = a2; x3, y3 = b1; x4, y4 = b2
    d1x, d1y = x2 - x1, y2 - y1
    d2x, d2y = x4 - x3, y4 - y3
    den = d1x * d2y - d1y * d2x
    if abs(den) < 1e-12:
        return None
    t = ((x3 - x1) * d2y - (y3 - y1) * d2x) / den
    u = ((x3 - x1) * d1y - (y3 - y1) * d1x) / den
    if -1e-9 <= t <= 1 + 1e-9 and -1e-9 <= u <= 1 + 1e-9:
        return (x1 + t * d1x, y1 + t * d1y)
    return None


def _point_on_segment(p, a, b, tol=1e-7):
    """点pが線分a-bの上に(端点含む)乗っているか。"""
    abx, aby = b[0] - a[0], b[1] - a[1]
    apx, apy = p[0] - a[0], p[1] - a[1]
    L2 = abx * abx + aby * aby
    if L2 < 1e-18:
        return math.hypot(apx, apy) < tol
    cross = abx * apy - aby * apx
    if abs(cross) / math.sqrt(L2) > tol:
        return False
    t = (apx * abx + apy * aby) / L2
    return -1e-9 <= t <= 1 + 1e-9


_ASSIGN_RANK = {'B': 3, 'M': 2, 'V': 2, 'U': 1, 'F': 0}


def build_planar_graph(segments, tol=TOL):
    """segments: [(a, b, kind), ...]  kind は 'B'/'M'/'V'/'F'/'U'。
       すべての交点で切り分け、頂点を統合した平面グラフを返す。
       戻り値: {'vertices': [(x,y),...], 'edges': [(i,j),...],
                'assignment': ['B'/'M'/...], 'conflicts': [edge index,...]}"""
    segs = [(tuple(a), tuple(b), k) for a, b, k in segments
            if math.hypot(b[0] - a[0], b[1] - a[1]) > tol]

    # 1) すべての交点候補を集める（線分どうしの交差＋端点）
    breakpoints = [[] for _ in segs]
    for i in range(len(segs)):
        breakpoints[i].append(segs[i][0])
        breakpoints[i].append(segs[i][1])
    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            ip = _seg_intersect(segs[i][0], segs[i][1], segs[j][0], segs[j][1])
            if ip is not None:
                breakpoints[i].append(ip)
                breakpoints[j].append(ip)
            else:
                # 平行・重なりの場合、相手の端点が自分の上に乗ることがある
                for p in (segs[j][0], segs[j][1]):
                    if _point_on_segment(p, segs[i][0], segs[i][1]):
                        breakpoints[i].append(p)
                for p in (segs[i][0], segs[i][1]):
                    if _point_on_segment(p, segs[j][0], segs[j][1]):
                        breakpoints[j].append(p)

    # 2) 頂点表
    #    ★丸めた格子キーの「ぴったり一致」だけで引くと、同じ点が2つに割れる。
    #      いぬの耳の折り筋の端が、対角線の折り筋と別頂点になって面が4枚しか
    #      取れなかった（2026-09-02に踏んだ）。まわりの格子も見て寄せる。
    verts = []
    vindex = {}

    def vid(p):
        kx, ky = _key(p, tol)
        for ddx in (-1, 0, 1):
            for ddy in (-1, 0, 1):
                k = (kx + ddx, ky + ddy)
                if k in vindex:
                    q = verts[vindex[k]]
                    if math.hypot(q[0] - p[0], q[1] - p[1]) <= tol * 2:
                        return vindex[k]
        vindex[(kx, ky)] = len(verts)
        verts.append((float(p[0]), float(p[1])))
        return vindex[(kx, ky)]

    # 3) 各線分を交点で切って辺にする
    #    ★パラメータtを丸めて座標に戻すと元の点とずれる。並べ替えにだけtを使い、
    #      辺の端点には「元の座標そのもの」を使う。
    edge_map = {}   # (i,j) -> assignment
    conflicts = set()
    for (a, b, kind), bps in zip(segs, breakpoints):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L2 = dx * dx + dy * dy
        pts = sorted(bps, key=lambda p: ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)
        chain = [pts[0]]
        for p in pts[1:]:
            if math.hypot(p[0] - chain[-1][0], p[1] - chain[-1][1]) > tol * 2:
                chain.append(p)
        for m in range(len(chain) - 1):
            p0, p1 = chain[m], chain[m + 1]
            i, j = vid(p0), vid(p1)
            if i == j:
                continue
            e = (min(i, j), max(i, j))
            if e in edge_map:
                old = edge_map[e]
                if old != kind:
                    # ふち(B)が最優先。山と谷がぶつかったらU(未定)にして印をつける
                    if _ASSIGN_RANK[kind] > _ASSIGN_RANK[old]:
                        edge_map[e] = kind
                    elif {old, kind} == {'M', 'V'}:
                        edge_map[e] = 'U'
                        conflicts.add(e)
            else:
                edge_map[e] = kind

    edges = sorted(edge_map.keys())
    assignment = [edge_map[e] for e in edges]
    return {'vertices': verts, 'edges': edges, 'assignment': assignment,
            'conflicts': [edges.index(e) for e in sorted(conflicts)]}


# ---------------------------------------------------------------- 面の抽出

def extract_faces(graph):
    """平面グラフから面(faces_vertices)を取り出す。半辺をたどる標準的な方法。
       外側の面(符号付き面積が負になる周)は捨てる。"""
    verts = graph['vertices']
    edges = graph['edges']
    adj = {}
    for i, j in edges:
        adj.setdefault(i, []).append(j)
        adj.setdefault(j, []).append(i)
    # 各頂点のまわりの隣接を角度順(反時計回り)に並べる
    order = {}
    for v, nbrs in adj.items():
        nbrs.sort(key=lambda u: math.atan2(verts[u][1] - verts[v][1],
                                           verts[u][0] - verts[v][0]))
        order[v] = {u: k for k, u in enumerate(nbrs)}
        adj[v] = nbrs

    def next_halfedge(u, v):
        """有向辺 u→v の「左側の面」をたどるときの次の有向辺 v→w。
           vのまわりで、来た方向(v→u)から時計回りにひとつ手前の隣接を選ぶ。"""
        nbrs = adj[v]
        k = order[v][u]
        return (v, nbrs[(k - 1) % len(nbrs)])

    visited = set()
    faces = []
    for i, j in edges:
        for he in ((i, j), (j, i)):
            if he in visited:
                continue
            loop = []
            cur = he
            while cur not in visited:
                visited.add(cur)
                loop.append(cur[0])
                cur = next_halfedge(*cur)
                if len(loop) > 4 * len(edges) + 8:
                    raise RuntimeError('face tracing did not terminate')
            if len(loop) < 3:
                continue
            area = 0.0
            for m in range(len(loop)):
                x1, y1 = verts[loop[m]]
                x2, y2 = verts[loop[(m + 1) % len(loop)]]
                area += x1 * y2 - x2 * y1
            if area > 1e-12:          # 反時計回り＝内側の面だけ採る
                faces.append(loop)
    return faces


# ---------------------------------------------------------------- 折れるかの検査

def check_flat_foldability(graph, border_polygon=None, tol=1e-6):
    """内部の頂点それぞれについて Kawasaki と Maekawa を確かめる。
       戻り値: [{'vertex':i, 'xy':(x,y), 'kawasaki':bool, 'maekawa':bool,
                 'detail':str}, ...] （破れている頂点だけ）"""
    verts = graph['vertices']
    edges = graph['edges']
    assign = graph['assignment']
    adj = {}
    for (i, j), a in zip(edges, assign):
        adj.setdefault(i, []).append((j, a))
        adj.setdefault(j, []).append((i, a))

    bad = []
    for v, nbrs in adj.items():
        # ふち(B)の辺を持つ頂点＝紙のふちの上なので、定理の対象外
        if any(a == 'B' for _, a in nbrs):
            continue
        # ★折り目をつけただけの線(F)は、そこで紙が折れていない＝定理の対象外。
        nbrs = [(u, a) for u, a in nbrs if a != 'F']
        if not nbrs:
            continue
        if len(nbrs) < 4:
            # ★2本だけなら、そこは「折り線が通りすぎているだけ」のことがある
            #   （折り目をつけただけの線と交わった点など）。一直線に並んでいれば
            #   そこは頂点ではないので、定理の対象外。
            if len(nbrs) == 2:
                a0 = math.atan2(verts[nbrs[0][0]][1] - verts[v][1],
                                verts[nbrs[0][0]][0] - verts[v][0])
                a1 = math.atan2(verts[nbrs[1][0]][1] - verts[v][1],
                                verts[nbrs[1][0]][0] - verts[v][0])
                d = abs((a0 - a1) % (2 * math.pi))
                if abs(d - math.pi) < 1e-6:
                    continue
            bad.append({'vertex': v, 'xy': verts[v], 'kawasaki': False, 'maekawa': False,
                        'detail': f'折り筋が{len(nbrs)}本しかない(内部の頂点は4本以上要る)'})
            continue
        nbrs = sorted(nbrs, key=lambda t: math.atan2(verts[t[0]][1] - verts[v][1],
                                                     verts[t[0]][0] - verts[v][0]))
        angs = [math.atan2(verts[u][1] - verts[v][1], verts[u][0] - verts[v][0])
                for u, _ in nbrs]
        n = len(angs)
        gaps = [(angs[(k + 1) % n] - angs[k]) % (2 * math.pi) for k in range(n)]
        kawa = maek = True
        detail = []
        if n % 2 != 0:
            kawa = False
            detail.append(f'折り筋が奇数本({n})')
        else:
            even = sum(gaps[0::2])
            odd = sum(gaps[1::2])
            if abs(even - math.pi) > tol or abs(odd - math.pi) > tol:
                kawa = False
                detail.append(f'ひとつおきの角の和が {math.degrees(even):.3f}° / '
                              f'{math.degrees(odd):.3f}° (180°でない)')
        m = sum(1 for _, a in nbrs if a == 'M')
        vv = sum(1 for _, a in nbrs if a == 'V')
        if abs(m - vv) != 2:
            maek = False
            detail.append(f'山{m}本 - 谷{vv}本 = {m - vv} (±2でない)')
        if not (kawa and maek):
            bad.append({'vertex': v, 'xy': verts[v], 'kawasaki': kawa, 'maekawa': maek,
                        'detail': ' / '.join(detail)})
    return bad


# ---------------------------------------------------------------- FOLD 書き出し

def to_fold(segments, title='', author='', with_faces=True):
    """segments: [(a, b, 'B'/'M'/'V'/'F'), ...] → FOLD形式のdict"""
    g = build_planar_graph(segments)
    fold = {
        'file_spec': 1.1,
        'file_creator': 'oton-gakuen fold2d (https://github.com/) ',
        'file_classes': ['singleModel'],
        'frame_title': title,
        'frame_classes': ['creasePattern'],
        'frame_attributes': ['2D'],
        'vertices_coords': [[round(x, 10), round(y, 10)] for x, y in g['vertices']],
        'edges_vertices': [list(e) for e in g['edges']],
        'edges_assignment': list(g['assignment']),
        'edges_foldAngle': [180.0 if a == 'V' else (-180.0 if a == 'M' else 0.0)
                            for a in g['assignment']],
    }
    if author:
        fold['file_author'] = author
    if with_faces:
        fold['faces_vertices'] = extract_faces(g)
    return fold


def state_to_segments(state):
    """FoldState から、ふち(B)＋折り筋(M/V) の線分リストを作る。"""
    segs = []
    border = state.paper_border()
    for i in range(len(border)):
        segs.append((border[i], border[(i + 1) % len(border)], 'B'))
    for c in state.crease_pattern():
        # ★「折り目をつけて開いただけ」の線は、紙がそこで畳まれていないので
        #   Maekawa/Kawasaki の勘定に入れない（入れると、実際には折れる折り方が
        #   「折れない」と出る。2026-09-03、きつねの耳で発覚）。
        #   展開図には残したいので、FOLD形式の 'F'（折られていない）にする。
        segs.append((c['a'], c['b'], 'F' if c.get('creaseOnly') else c['kind']))
    return segs


def state_to_fold(state, title='', author=''):
    return to_fold(state_to_segments(state), title=title, author=author)


def save_fold(state, path, title='', author=''):
    data = state_to_fold(state, title, author)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    return data


# ---------------------------------------------------------------- セルフテスト

if __name__ == '__main__':
    def check(name, ok, extra=''):
        print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))

    # (1) 正方形＋対角線1本 → 三角形2枚、頂点4、辺5
    sq = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    segs = [(sq[i], sq[(i + 1) % 4], 'B') for i in range(4)]
    segs.append(((-1, -1), (1, 1), 'V'))
    g = build_planar_graph(segs)
    check('正方形+対角線: 頂点4', len(g['vertices']) == 4, str(len(g['vertices'])))
    check('正方形+対角線: 辺5', len(g['edges']) == 5, str(len(g['edges'])))
    faces = extract_faces(g)
    check('正方形+対角線: 面2', len(faces) == 2, str(len(faces)))
    areas = []
    for f in faces:
        a = 0.0
        for m in range(len(f)):
            x1, y1 = g['vertices'][f[m]]
            x2, y2 = g['vertices'][f[(m + 1) % len(f)]]
            a += x1 * y2 - x2 * y1
        areas.append(a / 2)
    check('面積の合計が原紙と一致(4.0)', abs(sum(areas) - 4.0) < 1e-9, f'{sum(areas):.6f}')
    check('面は全部反時計回り(面積が正)', all(a > 0 for a in areas))

    # (2) 交差する2本の折り筋 → 交点が新しい頂点として生まれる
    segs2 = [(sq[i], sq[(i + 1) % 4], 'B') for i in range(4)]
    segs2 += [((-1, 0), (1, 0), 'V'), ((0, -1), (0, 1), 'M')]
    g2 = build_planar_graph(segs2)
    check('交差する2本: 頂点9(角4+辺の中点4+中心1)', len(g2['vertices']) == 9,
          str(len(g2['vertices'])))
    check('交差する2本: 面4', len(extract_faces(g2)) == 4, str(len(extract_faces(g2))))

    # (3) 座布団折りのCPで Kawasaki/Maekawa の検査が働くか
    #     中心に4本(対角線の一部)が集まる形。角の和はどちらも180度になる。
    segs3 = [(sq[i], sq[(i + 1) % 4], 'B') for i in range(4)]
    segs3 += [((-1, 0), (0, 1), 'V'), ((0, 1), (1, 0), 'V'),
              ((1, 0), (0, -1), 'V'), ((0, -1), (-1, 0), 'V')]
    g3 = build_planar_graph(segs3)
    bad3 = check_flat_foldability(g3)
    check('座布団折り: 内部に頂点が無い＝違反0', len(bad3) == 0, str(bad3))

    # (4) Maekawa違反をわざと作る: 中心に4本全部谷折り
    segs4 = [(sq[i], sq[(i + 1) % 4], 'B') for i in range(4)]
    segs4 += [((0, 0), (-1, -1), 'V'), ((0, 0), (1, -1), 'V'),
              ((0, 0), (1, 1), 'V'), ((0, 0), (-1, 1), 'V')]
    g4 = build_planar_graph(segs4)
    bad4 = check_flat_foldability(g4)
    check('中心に谷4本: Maekawa違反を検出', len(bad4) == 1 and not bad4[0]['maekawa'],
          bad4[0]['detail'] if bad4 else 'なし')
    check('中心に谷4本: Kawasakiは満たす', bad4 and bad4[0]['kawasaki'])

    # (5) FOLD書き出しの形が仕様どおりか
    fold = to_fold(segs2, title='テスト')
    need = ['file_spec', 'frame_classes', 'vertices_coords', 'edges_vertices',
            'edges_assignment', 'edges_foldAngle', 'faces_vertices']
    check('FOLD: 必須フィールドがそろう', all(k in fold for k in need))
    check('FOLD: 辺の数と割り当ての数が一致',
          len(fold['edges_vertices']) == len(fold['edges_assignment']) ==
          len(fold['edges_foldAngle']))
    check('FOLD: 谷は+180、山は-180',
          all((fa == 180.0) == (a == 'V') and (fa == -180.0) == (a == 'M')
              for a, fa in zip(fold['edges_assignment'], fold['edges_foldAngle'])))
    print('cp_export self-check done.')
