# -*- coding: utf-8 -*-
"""2回目の袋折り（半分折り2回 → 袋折り → 裏返す → 反対側の袋折り）の終端を、**JS の結果を使わずに** Python で求めて照合する（2026-09-15）。

★独立に求める道すじ（JS の engine・squash_v2.js は1行も使わない）
  ① 状態②＝Python の再生器（origami_recipe.py ＝本番 fold2d）で2回の半分折りを作る（check_squash_flip.build_recipe と同じ道）
  ② 1回目の袋折り＝折り図から読んだ姿（build_tsuru_base.EXPECT）で (D,G) を探し、素材の骨の木（check_squash_flip.MaterialFK）で
     動く4本の符号を総当りして上へ開く枝で t=1 まで動かす。層＝重なる区間の組ごとに t=1-ε の高さ（同じ高さなら状態②の層）
  ③ 裏返し＝平面の鏡映（v: x→-x ／ h: y→-y）と層の反転
  ④ 2回目の袋折り＝**区間の単位**で探す：D×G 64通りで「検証ずみの状態②の P1〜P4 の姿（EXPECT）」に合う素材の区間を探し、
     (a) 上へ開く（t=0.01 で動く頂点が z≧0）(b) 出発：動く区間と面積で重なる止まる区間はぜんぶ下
     (c) 止まる光線の上の断面の一周の順（紙は8本の光線ぜんぶで続いている＝区間の境目ぜんぶを弦にする）で弦が交差しない
     を満たすものがちょうど1つか。運動は検証ずみの運動（check_squash_linkage の骨の木）を Gᵀ∘運動∘D で写したもの。
  ⑤ 終端：区間ごとの置かれ方（2×2）・表裏（det）・8本の境目が 平ら／折れ（鏡映）・重なる区間の組の上下（t=1-ε の高さ、同じ高さなら直前の層）
★照合：JS（node test_squash_twice.js --write が書く squash_twice_states.json）の確定形を**突き合わせの相手**として読む。
  区間 s の JS の面＝素材の区間の中心を含む面。境目は JS の結び（同じ面の中なら平ら）。上下は JS の面の layer の差。
★続きの折り：2回目の袋折りのあとの fold は、本番 fold2d に袋折り直後の面を始まりとして折らせて、JS と突き合わせる（check_squash_after.compare）。
★これが言わないこと：厚みのある紙／degree4-45 以外／区間の途中で割れた紙。運動の途中の非貫通そのものは (c) の順と、
  モデルの厳密な証明（動く頂点は (0,1) で z>0：check_squash_motion.py）に依る。
使い方： node test_squash_twice.js --write → python check_squash_twice.py
"""
import sys, math, json
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import check_squash_flip as CF          # 状態②の作り方・(D,G) の探し方・素材の骨の木（1回目）
import check_squash_layers as CL        # 凸多角形の交わり
import build_tsuru_base as B            # EXPECT（折り図から読んだ姿）

ok_all = True
EPS = 1e-6
TIE = 1e-12


def check(name, ok, extra=''):
    global ok_all
    ok_all = ok_all and bool(ok)
    print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''), flush=True)


RAY, MATERIAL = CF.RAY, CF.MATERIAL
T = lambda m: ((m[0][0], m[1][0]), (m[0][1], m[1][1]))


def solve_lin(s, P, Q):
    """素材の区間 s の2頂点（光線 s・s+1 の端）を P・Q へ写す 2×2。"""
    A, Bv = RAY[s], RAY[(s + 1) % 8]
    d = A[0] * Bv[1] - A[1] * Bv[0]
    a = (P[0] * Bv[1] - Q[0] * A[1]) / d; b = (Q[0] * A[0] - P[0] * Bv[0]) / d
    c = (P[1] * Bv[1] - Q[1] * A[1]) / d; e = (Q[1] * A[0] - P[1] * Bv[0]) / d
    return (a, b, c, e)


def lin_apply(m, p):
    return (m[0] * p[0] + m[1] * p[1], m[2] * p[0] + m[3] * p[1])


def overlap(T1, T2):
    I = CL.intersect([list(T1), list(T2)])
    return (CL.poly_area(I), I) if len(I) >= 3 else (0.0, [])


def topo(pairs):
    """(下, 上) の組から区間ごとの層（最長の鎖）。循環は断る。"""
    below = {s: set() for s in range(8)}
    for lo, hi in pairs:
        below[hi].add(lo)
    layer, left = {}, list(range(8))
    while left:
        ready = [s for s in left if all(x in layer for x in below[s])]
        assert ready, '上下に循環'
        for s in ready:
            layer[s] = max([layer[x] + 1 for x in below[s]], default=0)
        left = [s for s in left if s not in layer]
    return layer


def bary_z(tri2, tri3, q):
    (x1, y1), (x2, y2), (x3, y3) = tri2
    d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
    w1 = ((y2 - y3) * (q[0] - x3) + (x3 - x2) * (q[1] - y3)) / d
    w2 = ((y3 - y1) * (q[0] - x3) + (x1 - x3) * (q[1] - y3)) / d
    return w1 * tri3[0][2] + w2 * tri3[1][2] + (1 - w1 - w2) * tri3[2][2]


def end_layers(tri_end, tri_near, prev_layer):
    """t=1 で重なる区間の組の上下：t=1-ε の高さ、同じ高さなら直前の層。返すのは [(a,b,aが上?)] と層。"""
    pairs, orders = [], []
    t2 = {s: [(float(p[0]), float(p[1])) for p in tri_end[s]] for s in range(8)}
    for a in range(8):
        for b in range(a + 1, 8):
            ar, I = overlap(t2[a], t2[b])
            if ar <= 1e-9:
                continue
            q = (sum(p[0] for p in I) / len(I), sum(p[1] for p in I) / len(I))
            dz = bary_z(t2[a], tri_near[a], q) - bary_z(t2[b], tri_near[b], q)
            if abs(dz) <= TIE:
                assert prev_layer[a] != prev_layer[b], ('同じ高さで直前の層も同じ', a, b)
                up = prev_layer[a] > prev_layer[b]
            else:
                up = dz > 0
            orders.append((a, b, up))
            pairs.append((b, a) if up else (a, b))
    return orders, topo(pairs)


def state_after_first(axis, c1, c2):
    rec, faces = CF.build_recipe(axis, c1, c2)
    fr = CF.find_frames(faces)
    assert len(fr) == 1
    D, G, owner = fr[0]
    closing, upward, _ = CF.branch_search(D, G, owner, '')
    assert len(upward) == 1
    fk = CF.MaterialFK(D, G, owner, upward[0])
    layer2 = {s: CF.owner_of(faces, MATERIAL[s])['layer'] for s in range(8)}
    _, end, _ = fk.place(1.0)
    _, near, _ = fk.place(1 - EPS)
    orders, layer3 = end_layers(end, near, layer2)
    lin = {s: solve_lin(s, (float(end[s][1][0]), float(end[s][1][1])), (float(end[s][2][0]), float(end[s][2][1]))) for s in range(8)}
    return {'lin': lin, 'layer': layer3}


def flip(state, axis):
    F = (-1, 0, 0, 1) if axis == 'v' else (1, 0, 0, -1)
    lin = {s: (F[0] * m[0] + F[1] * m[2], F[0] * m[1] + F[1] * m[3], F[2] * m[0] + F[3] * m[2], F[2] * m[1] + F[3] * m[3]) for s, m in state['lin'].items()}
    return {'lin': lin, 'layer': {s: -v for s, v in state['layer'].items()}}


def tri_now(lin, s):
    return [(0.0, 0.0), lin_apply(lin, RAY[s]), lin_apply(lin, RAY[(s + 1) % 8])]


def ring_crosses(tris3, k, moving, layer):
    """素材の光線 k（止まる光線）の直線の上の断面の一周の順。紙は8本の境目ぜんぶで続く＝境目 j の両側の区間の辺がこの直線に乗っていれば弦。"""
    st = (k - 1) % 8 if (k - 1) % 8 not in moving else k
    e = tris3[st][2] if st == (k - 1) % 8 else tris3[st][1]
    L = math.hypot(e[0], e[1]); u = (e[0] / L, e[1] / L); nrm = (-u[1], u[0])
    rays = []
    for s in range(8):
        for vi, oi in ((1, 2), (2, 1)):
            p = tris3[s][vi]
            if abs(p[0] * u[1] - p[1] * u[0]) > 1e-9 or abs(p[2]) > 1e-9 or p[0] * u[0] + p[1] * u[1] <= 1e-9:
                continue
            w = tris3[s][oi]
            ang = math.atan2(w[2], w[0] * nrm[0] + w[1] * nrm[1])
            rays.append((s, vi, ang))
    if any(-math.pi + 1e-9 < a < -1e-9 for _, _, a in rays):
        return True, 'lower'
    R = sorted([r for r in rays if abs(r[2]) <= 1e-9], key=lambda r: layer[r[0]])
    Mv = sorted([r for r in rays if 1e-9 < r[2] < math.pi - 1e-9], key=lambda r: r[2])
    Lf = sorted([r for r in rays if abs(abs(r[2]) - math.pi) <= 1e-9], key=lambda r: -layer[r[0]])
    ring = R + Mv + Lf
    pos = {(r[0], r[1]): i for i, r in enumerate(ring)}
    chords = []
    for j in range(8):
        a, b = pos.get(((j - 1) % 8, 2)), pos.get((j, 1))
        if a is not None and b is not None:
            chords.append((min(a, b), max(a, b)))
    cross = any(a < c < b < d for a, b in chords for c, d in chords)
    return cross, ' '.join('%d%s' % (r[0], 'R' if r in R else 'L' if r in Lf else 'M') for r in ring)


def second_squash(state):
    """いまの紙（区間ごとの置かれ方と層）から、2回目の袋を探して終端を求める。"""
    lin, layer = state['lin'], state['layer']
    want = B.EXPECT['②のあと']
    cands, pose_n = [], 0
    for D in CF.DIHEDRAL:
        Dt = T(D)
        sec = [CF.sector_of_triangle([CF.mat2(Dt, p) for p in MATERIAL[i]]) for i in range(8)]
        for G in CF.DIHEDRAL:
            ok = True
            for i in (1, 2, 3, 4):
                mtri = [CF.mat2(Dt, p) for p in MATERIAL[i]]
                got = [CF.mat2(G, lin_apply(lin[sec[i]], p)) for p in mtri]
                # 頂点の集合で比べれば頂点の対応まで決まる（区間の三角形は2辺が 1 と √2 で長さが違う）。
                if CF.tri_key(got) != [(a, b) for (a, b) in want['P%d' % i]]:
                    ok = False; break
            if not ok:
                continue
            pose_n += 1
            moving = [sec[1], sec[2], sec[3]]
            model_of_sec = {sec[i]: i for i in range(8)}
            Gt = T(G)

            # ⚠候補ごとに値を閉じ込める（ループ変数を後から読むと、使う時には最後の D・G に入れ替わっている＝最初そう書いて踏んだ）
            def pos3(t, D=D, Gt=Gt, moving=tuple(moving), model_of_sec=dict(model_of_sec), lin=lin):
                mp = CF.model_points(t)
                out = {}
                for s in range(8):
                    if s not in moving:
                        tri = tri_now(lin[s], s)
                        out[s] = [np.array([p[0], p[1], 0.0]) for p in tri]
                        continue
                    i = model_of_sec[s]
                    vs = [np.zeros(3)]
                    for mat in (RAY[s], RAY[(s + 1) % 8]):
                        kk = CF.ray_index(CF.mat2(D, mat))
                        mv = mp[i][1] if kk == i else mp[i][2]
                        xy = CF.mat2(Gt, (float(mv[0]), float(mv[1])))
                        vs.append(np.array([xy[0], xy[1], float(mv[2])]))
                    out[s] = vs
                return out
            p0 = pos3(0.0)
            if any(max(abs(p0[s][j][c] - (tri_now(lin[s], s)[j][c] if c < 2 else 0.0)) for j in range(3) for c in range(3)) > 1e-9 for s in moving):
                continue
            p01 = pos3(0.01)
            zs = [float(p01[s][j][2]) for s in moving for j in (1, 2)]
            if min(zs) < -1e-12 or max(zs) < 1e-6:
                cands.append((D, G, moving, 'down')); continue
            bad_start = False
            for m in moving:
                for u in range(8):
                    if u in moving:
                        continue
                    ar, _ = overlap(tri_now(lin[m], m), tri_now(lin[u], u))
                    if ar > 1e-9 and not layer[u] < layer[m]:
                        bad_start = True
            if bad_start:
                cands.append((D, G, moving, 'start')); continue
            anchors = [k for k in range(8) if ((k - 1) % 8 in moving) != (k in moving)]
            p5 = pos3(0.5)
            crossed = [k for k in anchors if ring_crosses(p5, k, moving, layer)[0]]
            if crossed:
                cands.append((D, G, moving, 'ring')); continue
            cands.append((D, G, moving, 'ok', pos3, anchors))
    return cands, pose_n


def main():
    data = json.loads((HERE / 'squash_twice_states.json').read_text(encoding='utf-8'))
    check('JS の経路がある', len(data['cases']) > 0, str(len(data['cases'])))
    cache_first = {}
    agree = {'sector': 0, 'boundary': 0, 'pairs': 0}
    for case in data['cases']:
        lab = case['label']
        key = (case['axis'], tuple(case['c1']), tuple(case['c2']))
        if key not in cache_first:
            cache_first[key] = state_after_first(case['axis'], tuple(case['c1']), tuple(case['c2']))
        s3 = flip(cache_first[key], case['flip2'])
        cands, pose_n = second_squash(s3)
        good = [c for c in cands if c[3] == 'ok']
        check(lab + '：Python で2回目の袋がちょうど1つ（姿が合う読みかえ %d・物理で残るのは %d）' % (pose_n, len(good)),
              len(good) == 1, ' '.join(c[3] for c in cands))
        if len(good) != 1:
            continue
        D, G, moving, _, pos3, anchors = good[0]
        end, near = pos3(1.0), pos3(1 - EPS)
        flat = max(abs(float(p[2])) for s in range(8) for p in end[s])
        # 境目の点が離れない（t=0.25/0.5/0.75/1）
        gap = max(float(np.abs(pos3(t)[(j - 1) % 8][2] - pos3(t)[j][1]).max()) for t in (0.25, 0.5, 0.75, 1.0) for j in range(8))
        check(lab + '：Python の終端は平らで、8本の境目の両側の点が離れない', flat < 1e-9 and gap < 1e-9, '|z| %.1e／ずれ %.1e' % (flat, gap))
        lin_end = {s: solve_lin(s, (float(end[s][1][0]), float(end[s][1][1])), (float(end[s][2][0]), float(end[s][2][1]))) for s in range(8)}
        orders, _ = end_layers(end, near, s3['layer'])
        # ---- JS との照合 ----
        jf = case['after']['faces']

        def owner(s):
            c = ((RAY[s][0] + RAY[(s + 1) % 8][0]) / 3, (RAY[s][1] + RAY[(s + 1) % 8][1]) / 3)
            hit = [f for f in jf if CL.point_in([CF.xf_inv(f['xf'], q) for q in f['poly']], c)]
            return hit[0] if len(hit) == 1 else None
        if any(owner(s) is None for s in range(8)):
            check(lab + '：JS の面が区間ごとに1枚に決まる', False, str([s for s in range(8) if owner(s) is None]))
            continue
        bad_sec = [s for s in range(8) if max(abs(owner(s)['xf'][i] - lin_end[s][i]) for i in range(4)) > 1e-9 or max(abs(owner(s)['xf'][4]), abs(owner(s)['xf'][5])) > 1e-9]
        check(lab + '：区間ごとの行き先（置かれ方）が JS の確定形と一致', not bad_sec, str(bad_sec))
        det = lambda m: m[0] * m[3] - m[1] * m[2]
        bad_side = [s for s in range(8) if (det(lin_end[s]) > 0) != (det(owner(s)['xf']) > 0)]
        check(lab + '：区間ごとの表裏が JS と一致', not bad_side, str(bad_side))
        bad_bd = []
        for j in range(8):
            a, b = lin_end[(j - 1) % 8], lin_end[j]
            same = max(abs(a[i] - b[i]) for i in range(4)) < 1e-9
            u = (RAY[j][0] / math.hypot(*RAY[j]), RAY[j][1] / math.hypot(*RAY[j]))
            Rr = (2 * u[0] * u[0] - 1, 2 * u[0] * u[1], 2 * u[0] * u[1], 2 * u[1] * u[1] - 1)
            refl = (b[0] * Rr[0] + b[1] * Rr[2], b[0] * Rr[1] + b[1] * Rr[3], b[2] * Rr[0] + b[3] * Rr[2], b[2] * Rr[1] + b[3] * Rr[3])
            folded = max(abs(a[i] - refl[i]) for i in range(4)) < 1e-9
            py = 'flat' if same else 'fold' if folded else 'torn'
            fa, fb = owner((j - 1) % 8), owner(j)
            if fa is fb:
                js = 'flat'
            else:
                bonds = [bd for bd in case['after']['bonds'] if set(bd['faceIds']) == {fa['faceId'], fb['faceId']}]
                js = ('flat' if bonds[0]['kind'] == 'crease' else 'fold') if bonds else 'none'
            if py != js or py == 'torn':
                bad_bd.append((j, py, js))
        check(lab + '：8本の境目（共有境界）の 平ら／折れ が JS の結び・面と一致（裂けは無い）', not bad_bd, str(bad_bd))
        bad_pr = []
        for a, b, up in orders:
            fa, fb = owner(a), owner(b)
            if fa is fb or (fa['layer'] > fb['layer']) != up:
                bad_pr.append((a, b, up, fa['layer'], fb['layer']))
        check(lab + '：重なる区間の組 %d の上下が JS の層と一致' % len(orders), not bad_pr and len(orders) > 0, str(bad_pr))
        # 裏返した紙（2回目の直前）も、Python の③＋鏡映と JS が一致するか（1回目の独立照合は check_squash_flip.py も見る）
        pf = case['flipped']['faces']
        ownf = lambda s: [f for f in pf if CL.point_in([CF.xf_inv(f['xf'], q) for q in f['poly']], ((RAY[s][0] + RAY[(s + 1) % 8][0]) / 3, (RAY[s][1] + RAY[(s + 1) % 8][1]) / 3))][0]
        bad_f = [s for s in range(8) if max(abs(ownf(s)['xf'][i] - s3['lin'][s][i]) for i in range(4)) > 1e-9]
        check(lab + '：裏返した紙（2回目の直前）の区間の置かれ方も JS と一致', not bad_f, str(bad_f))
        agree['sector'] += 8; agree['boundary'] += 8; agree['pairs'] += len(orders)
    print('    照合した数：区間 %(sector)d・境目 %(boundary)d・重なる組 %(pairs)d' % agree)
    # ---- 合成：物理の2つの条件を、それぞれ片方だけが効く紙で鳴らす（自然な34経路では、もう1つの候補は両方の条件で断られる） ----
    c0 = data['cases'][0]
    s3 = flip(state_after_first(c0['axis'], tuple(c0['c1']), tuple(c0['c2'])), c0['flip2'])
    good = [c for c in second_squash(s3)[0] if c[3] == 'ok'][0]
    moving = good[2]
    got_ring = got_start = None
    for a in range(8):
        for b in range(a + 1, 8):
            if a in moving or b in moving or s3['layer'][a] == s3['layer'][b]:
                continue
            t3 = {'lin': s3['lin'], 'layer': dict(s3['layer'])}
            t3['layer'][a], t3['layer'][b] = t3['layer'][b], t3['layer'][a]
            same = [c for c in second_squash(t3)[0] if c[2] == moving and c[0] == good[0] and c[1] == good[1]]
            if same and same[0][3] == 'ring' and got_ring is None:
                got_ring = (a, b)
    top = max(s3['layer'].values()) + 1
    for u in range(8):
        if u in moving:
            continue
        if not any(overlap(tri_now(s3['lin'][m], m), tri_now(s3['lin'][u], u))[0] > 1e-9 for m in moving):
            continue
        t3 = {'lin': s3['lin'], 'layer': dict(s3['layer'])}
        t3['layer'][u] = top
        same = [c for c in second_squash(t3)[0] if c[2] == moving and c[0] == good[0] and c[1] == good[1]]
        if same and same[0][3] == 'start':
            got_start = u
            break
    check('合成：止まる区間2枚の上下だけを入れかえると、同じ袋が「一周の順の交差」で断られる（出発の上下は通る）', got_ring is not None, str(got_ring))
    check('合成：動く区間と重なる止まる区間を一番上にすると、同じ袋が「出発の上下」で断られる', got_start is not None, str(got_start))
    # ---- 2回目の袋折りのあとの ふつうの折り：本番 fold2d（Python の再生器）に、袋折り直後の面を始まりにして続きの手を折らせて突き合わせる ----
    #      （袋折りそのものは上で独立に照合ずみ。ここで見るのは続きの折りの 割れ方・置かれ方・重なる2枚の上下）
    import check_squash_after as CA
    for fc in data.get('follow', []):
        CA.compare(fc)
    check('2回目の袋折りのあとの ふつうの折り %d経路を Python の再生器が同じ面・置かれ方・上下で折る' % len(data.get('follow', [])),
          CA.ok_all and len(data.get('follow', [])) >= 2)
    print('⛔ 厚み0。途中の非貫通は (c) の一周の順と check_squash_motion.py の厳密な証明（動く頂点 z>0）に依る。')
    print('ALL OK' if ok_all else 'NG あり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
