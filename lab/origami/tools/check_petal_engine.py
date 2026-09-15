# -*- coding: utf-8 -*-
"""本体（petal_v2.js＋engine）へ移した花弁折りを、Python の検証モデル（check_petal_fold.py）で**独立に**照合する（2026-09-15）。

★材料：node test_petal_v2.js --write が書く petal_engine_states.json（JS の結果は**突き合わせる相手**として読むだけ）。
★Python がすること（JS のコードは使わない）
   1. 直前の紙の面の素材の形から、検証モデルの10面を原紙の対称 D（8通り）で探す。置かれ方 xf ＝ G∘モデルの置き方∘D⁻¹ を満たす
      向きを保つ G がちょうど1つ。→ 面の対応（T2R…）が JS の faceOf と同じか。
   2. 途中の座標：検証モデルの運動（check_petal_fold の rot_np と同じ式・モデルの座標）で素材の点を動かし、G でいまの紙面へ写す。
      JS のプレビュー（t=0, .25, .5, .75, 1 の面ごとの点）と比べる。巻き順（表）も比べる。
   3. 終端：θ=π の点から面ごとの置かれ方 xf を解いて JS の確定後の xf・形と比べる。表裏＝det の符号。
   4. 結び：終端で両側の置かれ方が同じ＝平ら／違う＝折れ。JS の確定後の結びの種類と比べる。
   5. 層：重なる2面ごとに、θ=π(1-ε) の高さ（ε=1e-4, 1e-6 で同じ）で上下を決め、JS の確定後の layer の上下・stack と比べる。
   6. 手の中身：pivots・axes・base.faceId が、Python が見つけた花弁と同じか。
★使い方： python check_petal_engine.py
"""
import sys, json, math, itertools
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon, Point

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import check_petal_fold as CF

OK = True


def check(name, ok, extra=''):
    global OK
    OK = OK and bool(ok)
    print(('  ok ' if ok else '  NG ') + name + (('  ' + extra) if extra else ''))


NAMES = ['T2R', 'T2L', 'T1R', 'T1L', 'S2R', 'S2L', 'T3R', 'T3L', 'G2R', 'G2L']
MATN = {k: np.array(CF.num(CF.MAT[k])) for k in CF.MAT}
SYM = [np.array(m, float).reshape(2, 2) for m in ([1, 0, 0, 1], [0, -1, 1, 0], [-1, 0, 0, -1], [0, 1, -1, 0], [-1, 0, 0, 1], [1, 0, 0, -1], [0, 1, 1, 0], [0, -1, -1, 0])]


def xf_mat(xf):
    return np.array([[xf[0], xf[1], xf[4]], [xf[2], xf[3], xf[5]], [0, 0, 1]], float)


def app(M, p):
    v = M @ np.array([p[0], p[1], 1.0])
    return v[:2]


def key(pts):
    return tuple(sorted((round(float(p[0]), 6) + 0.0, round(float(p[1]), 6) + 0.0) for p in pts))


def canon_xf(name):
    a, b, c, d = CF.QUAD[CF.FACES[name][1]]
    return np.array([[a, b, 0], [c, d, 0], [0, 0, 1]], float)


def recognize(faces, bonds):
    """直前の面から花弁を探す（JS とは別の実装）。返すのは [(D, G, faceOf, groupOf)]
    🧩 モデルの1面＝素材でその三角形をちょうど敷きつめ（shapely の包含と面積）、同じ xf で、中の結びが crease だけでつながる面の集まり（2026-09-15）。
    faceOf は代表（faceId の順で最初）、groupOf は集まりの faceId ぜんぶ。"""
    mats = []
    for f in faces:
        Mi = np.linalg.inv(xf_mat(f['xf']))
        mats.append((f, Polygon([app(Mi, p) for p in f['poly']])))
    out = []
    for D in SYM:
        D3 = np.eye(3); D3[:2, :2] = D
        groupOf = {}
        for k in NAMES:
            tri = Polygon([D @ MATN[v] for v in CF.FACES[k][0]])
            mem = [(f, mp) for f, mp in mats if tri.contains(mp.representative_point())]
            if not mem or any(not tri.buffer(1e-7).contains(mp) for _, mp in mem):
                break
            if abs(sum(mp.area for _, mp in mem) - tri.area) > 1e-9:
                break
            if any(not np.allclose(f['xf'], mem[0][0]['xf'], atol=1e-9) for f, _ in mem):
                break
            ids = {f['faceId'] for f, _ in mem}
            inner = [bd for bd in bonds if bd['faceIds'][0] in ids and bd['faceIds'][1] in ids]
            if any(bd['kind'] != 'crease' for bd in inner):
                break
            seen, todo = {sorted(ids)[0]}, [sorted(ids)[0]]
            while todo:
                x = todo.pop()
                for bd in inner:
                    if x in bd['faceIds']:
                        y = bd['faceIds'][1 - bd['faceIds'].index(x)]
                        if y not in seen:
                            seen.add(y); todo.append(y)
            if seen != ids:
                break
            groupOf[k] = sorted((f for f, _ in mem), key=lambda f: f['faceId'])
        if len(groupOf) != len(NAMES):
            continue
        G = xf_mat(groupOf['T3R'][0]['xf']) @ D3 @ np.linalg.inv(canon_xf('T3R'))
        L = G[:2, :2]
        if not (np.allclose(L.T @ L, np.eye(2), atol=1e-9) and np.linalg.det(L) > 0):
            continue
        if not all(np.allclose(xf_mat(f['xf']), G @ canon_xf(k) @ np.linalg.inv(D3), atol=1e-7) for k in NAMES for f in groupOf[k]):
            continue
        # 層（重なる局所の面の組がモデルと同じ上下）
        good = True
        for a, b in itertools.combinations(NAMES, 2):
            for fa in groupOf[a]:
                for fb in groupOf[b]:
                    if Polygon(fa['poly']).intersection(Polygon(fb['poly'])).area > 1e-9:
                        want = np.sign(CF.FACES[a][2] - CF.FACES[b][2]); got = np.sign(fa['layer'] - fb['layer'])
                        if want == 0 or want != got:
                            good = False
        if good:
            out.append((D, G, {k: groupOf[k][0]['faceId'] for k in NAMES}, {k: [f['faceId'] for f in groupOf[k]] for k in NAMES}))
    return out


def canon_pose(name, cm, th):
    """検証モデルの運動：モデルの素材の点 cm（面 name の上）の θ でのモデル座標（check_petal_fold.pose_numeric と同じ式）"""
    sig = (1, 1, -1, -1, 1)
    phi = math.pi if th >= math.pi else 2 * math.atan(math.cos(CF.ALPHA) * math.tan(th / 2))
    a, b, c, d = CF.QUAD[CF.FACES[name][1]]
    base = np.array([a * cm[0] + b * cm[1], c * cm[0] + d * cm[1], 0.0])
    PN, rot = CF.PN, CF.rot_np
    role = CF.FACES[name][3]
    if role == 'fixed':
        return base
    if role == 'petal':
        return PN['P'] + rot(CF.kP, th, base - PN['P'])
    if name == 'T1R':
        return PN['P'] + rot(CF.kP, th, rot(CF.kQ, sig[1] * phi, base - PN['P']))
    if name == 'S2R':
        return PN['P'] + rot(CF.kQ, sig[2] * phi, base - PN['P'])
    if name == 'T1L':
        return PN['P'] + rot(CF.kP, th, PN["P'"] - PN['P'] + rot(CF.kQL, sig[3] * phi, base - PN["P'"]))
    if name == 'S2L':
        return PN["P'"] + rot(CF.kQL, sig[4] * phi, base - PN["P'"])
    raise ValueError(name)


def main():
    data = json.loads((HERE / 'petal_engine_states.json').read_text(encoding='utf-8'))
    cases = data['cases']
    print(f'[照合] {len(cases)}例（test_petal_v2.js --write）')
    worst = dict(frames=0.0, xf=0.0, poly=0.0)
    bad = {k: [] for k in ['recognize', 'faceOf', 'step', 'frames', 'winding', 'xf', 'det', 'bonds', 'layers', 'stack', 'moving']}
    grouped = []; swept = []
    worst['motion'] = 0.0; worst['minz'] = 0.0
    for k in ('start', 'axis', 'pierce'):
        bad[k] = []
    for case in cases:
        lab = case['label']
        bf = case['before']['faces']
        found = recognize(bf, case['before']['bonds'])
        if len(found) != 1:
            bad['recognize'].append((lab, len(found))); continue
        D, G, faceOf, groupOf = found[0]
        if faceOf != case['faceOf']:
            bad['faceOf'].append(lab)
        name_of = {fid: k for k, ids in groupOf.items() for fid in ids}
        moving = sorted(fid for k, ids in groupOf.items() if CF.FACES[k][3] != 'fixed' for fid in ids)
        if any(len(v) > 1 for v in groupOf.values()):
            grouped.append(lab)
        if moving != sorted(case['moving']):
            bad['moving'].append(lab)
        Dt = D.T
        byid = {f['faceId']: f for f in bf}

        def pose(fid, m, th):
            if fid not in name_of or CF.FACES[name_of[fid]][3] == 'fixed':
                p = app(xf_mat(byid[fid]['xf']), m); return np.array([p[0], p[1], 0.0])
            q = canon_pose(name_of[fid], Dt @ np.array(m), th)
            xy = G[:2, :2] @ q[:2] + G[:2, 2]
            return np.array([xy[0], xy[1], q[2]])
        # 運動の途中の結び：動く面に触れる結びぜんぶ（余分な折り目も）の両端と中点が、θ=kπ/16 で両側の運動で同じ所
        for bd in case['before']['bonds']:
            x, y = bd['faceIds']
            if x not in moving and y not in moving:
                continue
            s0, s1 = np.array(bd['seg'][0]), np.array(bd['seg'][1])
            for i in range(1, 16):
                th = math.pi * i / 16
                for m in (s0, (s0 + s1) / 2, s1):
                    worst['motion'] = max(worst['motion'], float(np.linalg.norm(pose(x, m, th) - pose(y, m, th))))
        # ── 周囲の紙（2026-09-16・本人指示：モデル内の証明だけで周囲の紙まで保証しない）。JS の判定は使わず、直前の紙の全部の面で数える ──
        stationary = [f for f in bf if f['faceId'] not in moving]
        mov_faces = [f for f in bf if f['faceId'] in moving]
        # (a) 出発の上下：動く面と面積で重なる止まった紙は、ぜんぶその動く面より下（重なる面どうしなので layer の比較に意味がある）
        for mf in mov_faces:
            pm = Polygon(mf['poly'])
            for sf in stationary:
                if pm.intersection(Polygon(sf['poly'])).area > 1e-9 and not sf['layer'] < mf['layer']:
                    bad['start'].append((lab, sf['faceId'], mf['faceId']))
        # (b) 軸上の接触：4本の軸のすぐ両脇（64点×両側）で、その点を含むモデルの面より上に、止まった紙がない
        def cur_pt(name, owner):
            m = D @ MATN[name]
            for fid in groupOf[owner]:
                Mi = np.linalg.inv(xf_mat(byid[fid]['xf']))
                if Polygon([app(Mi, q) for q in byid[fid]['poly']]).buffer(1e-9).contains(Point(m[0], m[1])):
                    return pose(fid, m, 0.0)[:2]
            raise RuntimeError(f'{lab}: {name} を持つ {owner} の面がない')
        ax_pts = {'P': cur_pt('P', 'T3R'), "P'": cur_pt("P'", 'T3L'), 'M': cur_pt('M', 'T3R'), 'Q': cur_pt('Q3', 'T2R')}
        polys = {f['faceId']: Polygon(f['poly']) for f in bf}
        for a, b, mk, fk in [('P', 'M', 'T2R', 'T3R'), ("P'", 'M', 'T2L', 'T3L'), ('P', 'Q', 'S2R', 'G2R'), ("P'", 'Q', 'S2L', 'G2L')]:
            A, B = ax_pts[a], ax_pts[b]; d = B - A; nrm = np.array([-d[1], d[0]]) / np.linalg.norm(d)
            for i in range(64):
                for sg in (1, -1):
                    q = A + d * (i + .5) / 64 + nrm * sg * 1e-6; P_ = Point(q[0], q[1])
                    refs = [fid for fid in groupOf[mk] + groupOf[fk] if polys[fid].contains(P_)]
                    if not refs:
                        bad['axis'].append((lab, a + b, 'モデルの面がない')); continue
                    ref = byid[refs[0]]
                    for sf in stationary:
                        if sf['layer'] > ref['layer'] and polys[sf['faceId']].contains(P_):
                            bad['axis'].append((lab, a + b, sf['faceId']))
        # (c) 途中の非貫通：θ=kπ/32 で、動く面の三角形の辺が、ほかの面（動く面も止まった紙も）の三角形を突き抜けない（厚み0・接するのは可）
        def tris_at(th):
            out = []
            for f in bf:
                Mi = np.linalg.inv(xf_mat(f['xf'])); mp = [app(Mi, q) for q in f['poly']]
                P3 = [pose(f['faceId'], m, th) for m in mp]
                for j in range(1, len(P3) - 1):
                    out.append((f['faceId'], np.array([P3[0], P3[j], P3[j + 1]])))
            return out
        def pierce(seg, tri, e=1e-9):
            a, b, c = tri; n = np.cross(b - a, c - a); nn = np.linalg.norm(n)
            if nn < 1e-12: return False
            n = n / nn; d0, d1 = n @ (seg[0] - a), n @ (seg[1] - a)
            if not ((d0 > e and d1 < -e) or (d0 < -e and d1 > e)): return False
            x = seg[0] + (seg[1] - seg[0]) * (d0 / (d0 - d1))
            v0, v1, v2 = b - a, c - a, x - a
            d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
            den = d00 * d11 - d01 * d01; v = (d11 * d20 - d01 * d21) / den; w = (d00 * d21 - d01 * d20) / den
            return v > 1e-7 and w > 1e-7 and v + w < 1 - 1e-7
        for k in range(1, 32):
            T = tris_at(math.pi * k / 32)
            for fa, ta in T:
                if fa not in moving: continue
                worst['minz'] = min(worst['minz'], float(ta[:, 2].min()))
                lo, hi = ta.min(0), ta.max(0)
                for fb, tb in T:
                    if fb == fa: continue
                    if np.any(tb.max(0) < lo - 1e-9) or np.any(tb.min(0) > hi + 1e-9): continue
                    if any(pierce((ta[i], ta[(i + 1) % 3]), tb) for i in range(3)) or any(pierce((tb[i], tb[(i + 1) % 3]), ta) for i in range(3)):
                        bad['pierce'].append((lab, k, fa, fb))
        swept.append(lab)
        # 手の中身
        st = case['step']
        P, Pl = D @ MATN['P'], D @ MATN["P'"]
        R9w = lambda pt: [round(float(v), 9) + 0.0 for v in pt]
        want_axes = sorted([json.dumps(['drive', R9w(Pl), R9w(P)])] + [
            json.dumps([r, R9w(D @ MATN[a]), R9w(D @ MATN[b])]) for a, b, r in
            [('P', 'Q3', 'petal-kite'), ('P', 'B', 'side-hinge'), ('P', 'Q2R', 'fixed-kite'), ('P', 'O', 'fixed-fold'),
             ("P'", 'Q3', 'petal-kite'), ("P'", 'A', 'side-hinge'), ("P'", 'Q2L', 'fixed-kite'), ("P'", 'O', 'fixed-fold')]])
        R9 = lambda pt: [round(float(v), 9) + 0.0 for v in pt]
        got_axes = sorted(json.dumps(['drive', R9(a['from']), R9(a['to'])] if a['role'] == 'drive'
                                     else [a['role'], R9(a['vertex']), R9(a['end'])]) for a in st['axes'])
        if not (st['base']['faceId'] in groupOf['T2R'] and np.allclose(st['pivots'][0], P, atol=1e-9) and np.allclose(st['pivots'][1], Pl, atol=1e-9)
                and want_axes == got_axes):
            bad['step'].append(lab)
        # 途中の座標と巻き順
        for fr in case['frames']:
            th = math.pi * fr['t']
            for f in fr['faces']:
                pts = f['pts']
                for q in pts:
                    e = pose(f['faceId'], q['m'], th)
                    worst['frames'] = max(worst['frames'], float(np.linalg.norm(e - np.array(q['p']))))
                # 巻き順：素材で左回りの順か
                mm = [q['m'] for q in pts]
                s = sum(mm[i][0] * mm[(i + 1) % len(mm)][1] - mm[(i + 1) % len(mm)][0] * mm[i][1] for i in range(len(mm)))
                if s <= 0:
                    bad['winding'].append((lab, f['faceId']))
        if worst['frames'] > 1e-9 and not bad['frames']:
            bad['frames'].append(lab)
        # 終端の置かれ方・形・表裏
        after = {f['faceId']: f for f in case['after']['faces']}
        exf = {}
        for f in bf:
            Mi = np.linalg.inv(xf_mat(f['xf']))
            mpts = [app(Mi, p) for p in f['poly']]
            src = np.array([[m[0], m[1], 1.0] for m in mpts[:3]])
            dst = np.array([pose(f['faceId'], m, math.pi)[:2] for m in mpts[:3]])
            A = np.linalg.solve(src, dst).T      # 2×3
            M = np.vstack([A, [0, 0, 1]])
            exf[f['faceId']] = M
            got = xf_mat(after[f['faceId']]['xf'])
            worst['xf'] = max(worst['xf'], float(np.abs(got - M).max()))
            ep = [app(M, m) for m in mpts]
            if key(ep) != key(after[f['faceId']]['poly']):
                worst['poly'] = max(worst['poly'], 1.0)
            if np.sign(np.linalg.det(M[:2, :2])) != np.sign(np.linalg.det(got[:2, :2])):
                bad['det'].append((lab, f['faceId']))
        # 結び
        for bd in case['after']['bonds']:
            x, y = bd['faceIds']
            same = np.allclose(exf[x], exf[y], atol=1e-9)
            if ('crease' if same else 'hinge') != bd['kind']:
                bad['bonds'].append((lab, bd['bondId'], bd['kind']))
        # 層：重なる2面ごとの上下（θ=π(1-ε) の高さ・止まる面どうしは直前の層）
        blayer = {f['faceId']: f['layer'] for f in bf}
        rel = {}
        ids = sorted(after)
        for a, b in itertools.combinations(ids, 2):
            inter = Polygon(after[a]['poly']).intersection(Polygon(after[b]['poly']))
            if inter.area <= 1e-9:
                continue
            rp = inter.representative_point(); q = (rp.x, rp.y)
            orders = []
            for eps in (1e-4, 1e-6):
                th = math.pi * (1 - eps)
                za = pose(a, app(np.linalg.inv(exf[a]), q), th)[2]
                zb = pose(b, app(np.linalg.inv(exf[b]), q), th)[2]
                if abs(za - zb) <= 1e-12:
                    orders.append(a if blayer[a] > blayer[b] else b)
                else:
                    orders.append(a if za > zb else b)
            if orders[0] != orders[1]:
                bad['layers'].append((lab, a, b, 'ε で変わる')); continue
            top = orders[0]; rel[(a, b)] = top
            jtop = a if after[a]['layer'] > after[b]['layer'] else b
            if top != jtop:
                bad['layers'].append((lab, a, b))
        # stack（下から）と2面の上下
        for reg in st['stack']:
            for i in range(len(reg)):
                for j in range(i + 1, len(reg)):
                    lo, hi = reg[i], reg[j]
                    k2 = tuple(sorted((lo, hi)))
                    if k2 in rel and rel[k2] != hi:
                        bad['stack'].append((lab, lo, hi))
    check('Python が見つけた花弁がちょうど1つ（全例）', not bad['recognize'], str(bad['recognize'][:3]))
    check('面の対応（T2R…G2L → faceId）が JS の faceOf と同じ', not bad['faceOf'], str(bad['faceOf'][:3]))
    check('動く面の集合が JS と同じ', not bad['moving'], str(bad['moving'][:3]))
    check('手の中身（base.faceId・pivots・axes）が Python の花弁と同じ', not bad['step'], str(bad['step'][:3]))
    check('運動の途中（θ=kπ/16）で動く面に触れる結びがぜんぶ両側で一致（余分な折り目を含む）', worst['motion'] < 1e-9, f"最大ずれ {worst['motion']:.1e}")
    check('出発の上下：動く面と重なる止まった紙はぜんぶ下（全例・全部の面）', not bad['start'], str(bad['start'][:3]))
    check('軸上の接触：4本の軸の両脇（64点×2）で、モデルの面より上に止まった紙がない（全例）', not bad['axis'], str(bad['axis'][:3]))
    check('途中の非貫通：θ=kπ/32 で動く面の三角形の辺がほかの面を突き抜けない（全例・止まった紙を含む）', not bad['pierce'] and worst['minz'] > -1e-9, f"{len(swept)}例・動く面の最小 z {worst['minz']:.1e}・{bad['pierce'][:2]}")
    check('2回目（裏返したあと）の花弁を照合した例がある', sum('2回目' in c['label'] for c in cases) > 0, f"{sum('2回目' in c['label'] for c in cases)}例")
    check('余分な折り目で分かれた面をまとまりで照合した例がある', len(grouped) > 0, f"{len(grouped)}例")
    check('プレビューの途中と両端の座標（t=0,.25,.5,.75,1・面ごとの素材の点）', worst['frames'] < 1e-9, f"最大ずれ {worst['frames']:.1e}")
    check('描画の巻き順が素材の表（素材で左回り）', not bad['winding'], str(bad['winding'][:3]))
    check('確定後の置かれ方 xf（θ=π の点から解いた値）', worst['xf'] < 1e-9, f"最大ずれ {worst['xf']:.1e}")
    check('確定後の面の形', worst['poly'] == 0)
    check('確定後の表裏（det の符号）', not bad['det'], str(bad['det'][:3]))
    check('確定後の結びの種類（平ら／折れ）', not bad['bonds'], str(bad['bonds'][:3]))
    check('確定後の重なる2面の上下（θ=π(1-ε)・ε で不変）が JS の layer と同じ', not bad['layers'], str(bad['layers'][:3]))
    check('stack（下から）が2面の上下と矛盾しない', not bad['stack'], str(bad['stack'][:3]))
    # 未対応の読み手：Python の原本の読み手（origami_recipe.py＝v1）は花弁折りの手をはっきり断る
    import origami_recipe as OR
    try:
        OR.validate({'format': 'origami-recipe', 'version': 2, 'coordinates': 'unfolded-normalized-xy', 'steps': [cases[0]['step']]})
        msg = None
    except OR.RecipeError as e:
        msg = str(e)
    check('Python の読み手（origami_recipe.py）は op:petal を名前を出して断る', bool(msg) and 'petal' in msg, str(msg))
    print('\n' + ('ALL OK' if OK else 'NG あり'))
    return 0 if OK else 1


if __name__ == '__main__':
    import traceback
    try:
        rc = main()
    except SystemExit:
        raise
    except BaseException:
        traceback.print_exc(); print('ABORT 検証コードが例外で止まった（検査の合否ではない）'); sys.exit(2)
    sys.exit(rc)
