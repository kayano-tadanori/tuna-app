"""折線から、折り上がりの形と骨組みを直接つくる ── fold2d の fold() を通さない道。

★なぜ要るか（本人 2026-09-05）
   「**公理でだした折れ線でヒンジを入れておいて、実装時はそれを動かす**」

   `fold2d.py` は既にある層を折り返すことしかできず、**ふくろを開いて外形を広げる
   ことができない**（潰し折り）。実際、つるの③を fold2d で作ろうとすると、
   Kawasaki も Maekawa も引き裂き検査も3Dの裂けチェックも全部通るのに、
   **外形が三角形のまま**だった（正解は正方形）。→ [[feedback_tsubushiori_2d_genkai]]

   だから fold2d に潰し折りを「させる」のはやめて、**折線だけもらって、そこから
   直接** 面に割り・折り上がりの位置を出し・骨を組む。潰し折りかどうかに関係なく
   同じ手順で通る。

★仕組み（反射の伝播）
   1. 折線とふちで紙を面に割る（cp_export の平面グラフと面抽出をそのまま使う）
   2. 面どうしの隣り合いを作る（折線を共有していれば隣）
   3. 根の面から幅優先でたどり、**折線をまたぐたびに鏡映を1つ掛ける**
      → それぞれの面の「原紙 → 折り上がり」の変換が出る
   4. たどった木がそのまま骨の親子（boneParent）、またいだ折線がヒンジ

🚨★ 「山谷は形に関係しない」は**誤り**（2026-09-05に実測で外した）
   「山も谷も180°の鏡映だから折り上がりの位置は同じ」と考えて山谷を無視して書いたが、
   **同じ折線でも山谷の付け方で外形が変わる**。実測：
     対角線2本＋まん中2本（＝つるの土台の折線）を入れると、
     このコードは **8枚重ねの三角（waterbomb base）** を出した。
     preliminary base（つるの土台）は **4枚重ねの正方形**。折線は同じ。
   つまり **1つの折線に、平坦に折れる状態が複数ある**。どれになるかは山谷が決める。
   → いまのこのコードは「そのうちの1つ」しか出せない。**つるの土台はまだ出せていない。**
   ⚠ この節を読んだら、まずここが直っているかを確かめること。

★まだやっていないこと
   ・重なり順（どの面が上か）は決めていない。平坦折りの重なり順は一般には難しい問題で、
     ここは別途（折り順から決める／実物で確かめる）。
   ・木で表せない隣り合い（輪）は `check_loop_closure.py` が見る。潰し折りの頂点では
     必ず出るので、その手は `step.soft` にする。
"""
import sys, math
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import cp_export as CE
from fold2d import reflect_affine, xf_compose, xf_apply, IDENTITY_XF

TOL = 1e-7


def faces_of(segments):
    """折線とふちの線分から、平面グラフと面を作る。"""
    g = CE.build_planar_graph(segments)
    return g, CE.extract_faces(g)


def _edge_kind(g):
    """(小さい頂点番号, 大きい頂点番号) → 'B'/'M'/'V'/'F'"""
    out = {}
    for (i, j), a in zip(g['edges'], g['assignment']):
        out[(min(i, j), max(i, j))] = a
    return out


def adjacency(g, faces):
    """面どうしの隣り合い。線を共有していれば隣。

    ⚠**折らない線(F)でも紙は繋がっている。**そこは「反射しないで繋がる」だけ。
      M/V しか繋がないと、折り目だけ付けた線で紙が分断され、**たどれない面**が出る
      （2026-09-05に踏んだ：4本のうち一部だけ折る組み合わせが全部たどれなかった）。
    戻り値: {face_i: [(face_j, (vi, vj), fold?), ...]}  fold? が False なら反射しない
    """
    kind = _edge_kind(g)
    owner = {}
    for fi, loop in enumerate(faces):
        for k in range(len(loop)):
            e = (min(loop[k], loop[(k + 1) % len(loop)]),
                 max(loop[k], loop[(k + 1) % len(loop)]))
            owner.setdefault(e, []).append(fi)
    adj = {fi: [] for fi in range(len(faces))}
    for e, fs in owner.items():
        if len(fs) != 2:
            continue                      # ふちなど、片側しか面が無い
        k = kind.get(e)
        if k == 'B':
            continue                      # 紙のふち＝面は片側だけのはず
        do_fold = (k in ('M', 'V'))
        a, b = fs
        adj[a].append((b, e, do_fold))
        adj[b].append((a, e, do_fold))
    return adj


def fold_from_cp(segments, root=0):
    """折線から折り上がりを作る。

    戻り値: {'graph', 'faces', 'xf': [面ごとの変換], 'parent': [親の面番号/-1],
             'hinge_edge': [(vi,vj) or None], 'poly_flat': [...], 'poly_folded': [...],
             'loops': [(fi,fj,e), ...]}   loops＝木で表せなかった隣り合い
    """
    g, faces = faces_of(segments)
    verts = g['vertices']
    adj = adjacency(g, faces)
    n = len(faces)
    xf = [None] * n
    parent = [-1] * n
    hinge_edge = [None] * n
    xf[root] = IDENTITY_XF
    order = [root]
    seen = {root}
    loops = []
    qi = 0
    while qi < len(order):
        fi = order[qi]; qi += 1
        for (fj, e, do_fold) in adj[fi]:
            if fj in seen:
                if parent[fi] != fj and parent[fj] != fi:
                    loops.append((fi, fj, e))
                continue
            if not do_fold:
                xf[fj] = xf[fi]          # 折らない線＝そのまま繋がる（反射しない）
            else:
                # ★折線を「いまの姿勢」へ写してから、その直線で鏡映する
                pa = xf_apply(xf[fi], verts[e[0]])
                pb = xf_apply(xf[fi], verts[e[1]])
                xf[fj] = xf_compose(reflect_affine(pa, pb), xf[fi])
            parent[fj] = fi
            hinge_edge[fj] = e
            seen.add(fj)
            order.append(fj)
    poly_flat = [[verts[v] for v in loop] for loop in faces]
    poly_folded = [[xf_apply(xf[i], verts[v]) for v in faces[i]]
                   if xf[i] is not None else None for i in range(n)]
    # 重複した輪（両方向で拾う）を1本にまとめる
    uniq = []
    seenl = set()
    for (a, b, e) in loops:
        k = (min(a, b), max(a, b), e)
        if k in seenl:
            continue
        seenl.add(k); uniq.append((a, b, e))
    return {'graph': g, 'faces': faces, 'xf': xf, 'parent': parent,
            'hinge_edge': hinge_edge, 'poly_flat': poly_flat,
            'poly_folded': poly_folded, 'loops': uniq, 'order': order}


def outline(res):
    """折り上がりの外形（全部の面の頂点の集合と、その囲む大きさ）。"""
    pts = set()
    for poly in res['poly_folded']:
        if poly is None:
            continue
        for q in poly:
            pts.add((round(q[0], 4), round(q[1], 4)))
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return pts, (max(xs) - min(xs), max(ys) - min(ys))


def report(segments, title='', root=0):
    res = fold_from_cp(segments, root=root)
    pts, (w, h) = outline(res)
    n_un = sum(1 for x in res['xf'] if x is None)
    print(f'\n########## {title}')
    print(f'  面 {len(res["faces"])}枚  たどれた {len(res["order"])}枚'
          + (f'  ★たどれなかった {n_un}枚' if n_un else ''))
    print(f'  骨の親: {res["parent"]}')
    print(f'  木で表せない隣り合い（輪）: {len(res["loops"])}組')
    print(f'  折り上がりの外形: 横 {w:.4f} × 縦 {h:.4f}'
          + ('   ★正方形' if abs(w - h) < 1e-6 else ''))
    print(f'  外形の頂点: {sorted(pts)}')
    return res
