# -*- coding: utf-8 -*-
"""袋折り（つる③）の v2 設計のうち、**残りの幾何**を確かめる検査。

★見るもの
   ① モデルの再構成 … 原本の「面」と「結び」だけから、検証モデルの8区間と R0〜R7 を
      **決定論的に**組み直す。配列の順に依らないこと／別形状を degree4-45 として誤って
      受理しないことを、受理2件・拒否3件で固定する。
   ② 全領域の層順 … 最終形の重なりを**engine が全部**列挙し（人が書いた点だけで済ませない）、
      領域ごとに上下を出す。比較点は「最終形で選んだ点の**素材上の逆像**」を各面で辿るので、
      終端手前で面が動いていても**必ず全面が値を持つ**（法線を通しただけの比較にしない）。
   ③ 領域ごとの上下が、既存の「面ごとに1つの layer 値」へ矛盾なく直せるか（非循環）。

★座標の決めごと（ここを間違えない）
   素材座標は**すべての面で共通の原紙座標** [-1,1]^2。face を名乗るのは、その点を現在位置へ
   写す xf と対象の面を決めるためで、**面ごとのローカル座標ではない**。

★これが言わないこと
   ⛔ 紙どうしの貫通（すり抜け）は**一切見ていない**。閉路が閉じることだけで
      「物理的に折れる」とは言わない。
   ⛔ 既存 fold2d 系は、**通常の fold による単一ヒンジの開きは再生できている**
      （→ check_squash_recipe.py の「単一ヒンジの開き」）。未対応なのは
      **今回の複数軸を同時に動かす操作**のほう。
   ⛔ 辺長・面積の検証は check_squash_linkage.py 側（あちらは剛体モデルなので定義上0）。

★使い方
   python check_squash_layers.py
   （入力の squash_states.json は node test_squash_recipe.js --write が作る）
"""
import sys, math, json, io, itertools
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import check_squash_linkage as L      # 連動式・FK・panels をそのまま使う

STATES = HERE / 'squash_states.json'
TOL = 1e-7


class Reject(Exception):
    pass


# ------------------------------------------------------------------ 素材座標
def inv_xf(m, p):
    """engine の inv と同じ（行優先）。現在座標 → 共通の原紙座標。"""
    d = m[0] * m[3] - m[1] * m[2]
    x, y = p[0] - m[4], p[1] - m[5]
    return ((m[3] * x - m[1] * y) / d, (-m[2] * x + m[0] * y) / d)


def ang(v):
    a = math.atan2(v[1], v[0])
    return a + 2 * math.pi if a < -1e-12 else a


def unit(v):
    n = math.hypot(v[0], v[1])
    return (v[0] / n, v[1] / n)


# ------------------------------------------- ① モデルの再構成（決定論・誤受理しない）
def reconstruct(state, vertex=(0.0, 0.0)):
    """原本の面と結びから、degree4-45 の8区間と R0..R7 を組み直す。
       受理できないときは Reject（理由つき）。**入力配列の順に依らない**。"""
    faces = state['faces']
    if len(faces) != 4:
        raise Reject('面が4枚でない（%d枚）' % len(faces))
    corners = {}                                     # faceId → (2本の光線の向き, 内角)
    for f in faces:
        mp = [inv_xf(f['xf'], p) for p in f['poly']]
        k = [i for i, p in enumerate(mp) if math.dist(p, vertex) < TOL]
        if len(k) != 1:
            raise Reject('面 %s が頂点 %s を1つの角として持たない' % (f['faceId'], vertex))
        i = k[0]
        a = unit((mp[i - 1][0] - vertex[0], mp[i - 1][1] - vertex[1]))
        b = unit((mp[(i + 1) % len(mp)][0] - vertex[0], mp[(i + 1) % len(mp)][1] - vertex[1]))
        inner = math.degrees(math.acos(max(-1.0, min(1.0, a[0] * b[0] + a[1] * b[1]))))
        corners[f['faceId']] = (a, b, inner)
        # 🚨ここで「90°か」を別に見ない。門は下の「8本が45°おき」1本だけにする。
        #    2つ書くと、片方を壊しても、もう片方が先に断って**検査が鳴らない**（実測で踏んだ）。
    # 面の境界になっている光線（＝4本）。向きでまとめる＝配列の順に依らない。
    edge_rays = {}
    for fid, (a, b, _) in corners.items():
        for d in (a, b):
            key = round(ang(d), 9)
            edge_rays.setdefault(key, []).append(fid)
    if len(edge_rays) != 4 or any(len(v) != 2 for v in edge_rays.values()):
        raise Reject('頂点まわりの境界の光線が「4本・各2面」になっていない（%d本）' % len(edge_rays))
    # 各面の内角を二等分して、残り4本を作る
    rays = dict(edge_rays)
    for fid, (a, b, _) in corners.items():
        m = unit((a[0] + b[0], a[1] + b[1]))
        rays.setdefault(round(ang(m), 9), []).append(fid)
    if len(rays) != 8:
        raise Reject('光線が8本にならない（%d本）' % len(rays))
    order = sorted(rays)                              # 角度の小さい順＝入力順に依らない標準形
    for i in range(8):
        d = math.degrees((order[(i + 1) % 8] - order[i]) % (2 * math.pi))
        if abs(d - 45.0) > 1e-6:
            raise Reject('隣りあう光線の角が45°でない（R%d→R%d が %.4f°）' % (i, (i + 1) % 8, d))
    # 結びを光線へ割りつける
    bond_at = {}
    for bd in state['bonds']:
        (p, q) = bd['seg']
        ends = [p, q]
        at = [e for e in ends if math.dist(e, vertex) < TOL]
        if len(at) != 1:
            raise Reject('結び %s が頂点を端に持たない' % ' | '.join(bd['faceIds']))
        far = ends[1] if math.dist(ends[0], vertex) < TOL else ends[0]
        key = round(ang((far[0] - vertex[0], far[1] - vertex[1])), 9)
        hit = [i for i, o in enumerate(order) if abs(((o - key + math.pi) % (2 * math.pi)) - math.pi) < 1e-6]
        if not hit:
            raise Reject('結び %s が光線の上に無い' % ' | '.join(bd['faceIds']))
        if bd['kind'] != 'hinge':
            raise Reject('結び %s が hinge でない（%s）' % (' | '.join(bd['faceIds']), bd['kind']))
        bond_at[hit[0]] = tuple(sorted(bd['faceIds']))
    if len(bond_at) != 4:
        raise Reject('頂点まわりの結びが4本でない（%d本）' % len(bond_at))
    par = {i % 2 for i in bond_at}
    if len(par) != 1:
        raise Reject('結びが1本おきに並んでいない（R%s）' % sorted(bond_at))
    # 区間 P_i ＝ R_i と R_{i+1} のあいだ。持ち主は、その2本を角に持つ面。
    owner = []
    for i in range(8):
        mid = (order[i] + math.radians(22.5))
        got = [fid for fid, (a, b, _) in corners.items()
               if abs(((ang(unit((a[0] + b[0], a[1] + b[1]))) - mid + math.pi) % (2 * math.pi)) - math.pi) < math.radians(23)]
        if len(got) != 1:
            raise Reject('区間 P%d の持ち主の面が決まらない' % i)
        owner.append(got[0])
    rho0 = [math.pi if i in bond_at else 0.0 for i in range(8)]
    if L.closure_error(rho0) > 1e-9:
        raise Reject('この折り角の組では頂点が閉じない（残差 %.2e）' % L.closure_error(rho0))
    return {'rays': [round(math.degrees(a), 6) for a in order],
            'owner': owner, 'bondAt': {i: bond_at[i] for i in sorted(bond_at)},
            'rho0Deg': [round(math.degrees(r), 6) for r in rho0]}


def canon(rec):
    return json.dumps({'rays': rec['rays'], 'owner': rec['owner'],
                       'bondAt': {str(k): list(v) for k, v in rec['bondAt'].items()},
                       'rho0Deg': rec['rho0Deg']}, ensure_ascii=False, sort_keys=True)


# --------------------------------------------------- ② 全領域の列挙（凸多角形の交わり）
def poly_area(poly):
    s = 0.0
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def clip_half(poly, a, b):
    """線分 a→b の左側（S>=0）で切る。"""
    def side(p):
        return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    out = []
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]
        sp, sq = side(p), side(q)
        if sp >= -1e-12:
            out.append(p)
        if (sp > 1e-12 and sq < -1e-12) or (sp < -1e-12 and sq > 1e-12):
            t = sp / (sp - sq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def ccw(poly):
    s = 0.0
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        s += x1 * y2 - x2 * y1
    return poly if s > 0 else poly[::-1]


def intersect(polys):
    cur = ccw(list(polys[0]))
    for q in polys[1:]:
        q = ccw(list(q))
        for i in range(len(q)):
            cur = clip_half(cur, q[i], q[(i + 1) % len(q)])
            if len(cur) < 3:
                return []
    return cur


def all_regions(face_polys, min_area=1e-9):
    """凸多角形の重なりを**全部**列挙する（包除で厳密に面積を出す）。
       返すのは {覆っている面の組: 面積}。人が書いた点には頼らない。"""
    ids = list(face_polys)
    inter_area = {}
    for r in range(1, len(ids) + 1):
        for sub in itertools.combinations(ids, r):
            inter_area[sub] = poly_area(intersect([face_polys[i] for i in sub]))
    cells = {}
    for sub in inter_area:
        s = 0.0
        for sup in inter_area:
            if set(sub) <= set(sup):
                s += (-1) ** (len(sup) - len(sub)) * inter_area[sup]
        if s > min_area:
            cells[sub] = s
    return cells, inter_area


def sample_points(face_polys, sub, others, n=9):
    """cell(sub) の中の点をいくつか。sub の交わりの中で、others の外にある点。"""
    inter = intersect([face_polys[i] for i in sub])
    if len(inter) < 3:
        return []
    xs = [p[0] for p in inter]; ys = [p[1] for p in inter]
    out = []
    g = 21
    for i in range(1, g):
        for j in range(1, g):
            p = (min(xs) + (max(xs) - min(xs)) * i / g, min(ys) + (max(ys) - min(ys)) * j / g)
            if poly_area(clip_inside(inter, p)) if False else not point_in(inter, p):
                continue
            if any(point_in(face_polys[o], p) for o in others):
                continue
            out.append(p)
            if len(out) >= n:
                return out
    return out


def clip_inside(poly, p):      # 使わない（point_in を使う）
    return poly


def point_in(poly, p, eps=1e-9):
    poly = ccw(list(poly))
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        if (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) < eps:
            return False
    return True


# ------------------------------------------------- ② 高さの比較（素材上の逆像で辿る）
#  最終形（t=1）は平ら。区間 P_i の素材三角形 (O, A_i, B_i) が、最終形の2D三角形へ写る。
#  比較したい点 q を選んだら、面ごとに「q に来ている**素材上の点**」を求め、
#  その点が t=1-ε でどこにいるかを見る＝どの面も必ず値を持つ（法線を通すだけにしない）。
MAT_TRI = {i: ((0.0, 0.0), L.MATERIAL[i][0], L.MATERIAL[i][1]) for i in range(8)}
#  検証モデルの区間 → v2 で原本に残る面（Q_E と Q_S は割れない＝2区間で1枚）
SECTOR_FACE = {7: 'Q_E', 0: 'Q_E', 5: 'Q_S', 6: 'Q_S',
               4: 'P4', 3: 'P3', 1: 'P1', 2: 'P2'}
MOVING = {'P1', 'P2', 'P3'}
#  🚨同着のしきい値。固定面の高さは「厳密に0」ではなく浮動小数の粉（実測 ~1e-16）が乗る。
#     動く面は ε=1e-6 でも |z| >= 7e-8 あるので、そのあいだに置く。
#     ここを 0 にすると、**粉の大小で固定面の上下が入れかわる**（実測で P4 が最下段に落ちた）。
TIE = 1e-12
#  同着になった面は「状態②の層」を継ぐ。Q_E=0 < Q_S=1 < Q_W=2 < Q_N=3。
INHERIT = {'Q_E': 0, 'Q_S': 1, 'P4': 2, 'P3': 2, 'P1': 3, 'P2': 3}


def order_faces(zs):
    """高さで並べる。TIE の中は同着。
       🚨同着の継承は**固定面どうしだけ**（状態②の層順を継ぐ）。
         動く面が同着に混ざったら**判別不能＝拒否**（第2返り値に理由を返す）。"""
    zs = sorted(zs, key=lambda t: t[0])
    groups = []
    for z, f in zs:
        if groups and abs(z - groups[-1][0][0]) <= TIE:
            groups[-1].append((z, f))
        else:
            groups.append([(z, f)])
    out, bad = [], []
    for g in groups:
        if len(g) > 1 and any(f in MOVING for _, f in g):
            bad.append('同着に動く面: ' + ','.join(sorted(f for _, f in g)))
        out += [f for _, f in sorted(g, key=lambda t: INHERIT[t[1]])]
    return tuple(out), bad


def bary(tri, p):
    (x1, y1), (x2, y2), (x3, y3) = tri
    d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
    a = ((y2 - y3) * (p[0] - x3) + (x3 - x2) * (p[1] - y3)) / d
    b = ((y3 - y1) * (p[0] - x3) + (x1 - x3) * (p[1] - y3)) / d
    return a, b, 1 - a - b


def panel2d(pl, i):
    return [(float(v[0]), float(v[1])) for v in pl[i]]


def height_at(q, sector, eps):
    """最終形で q に来ている素材点を、t=1-ε の姿勢で見たときの高さ（基準面 Q_E の法線＝z）。"""
    end = L.panels(L.rho_of(1.0))
    now = L.panels(L.rho_of(1.0 - eps))
    w = bary(panel2d(end, sector), q)
    return float(sum(w[k] * now[sector][k][2] for k in range(3)))


def sector_of(face, q, end):
    for s, f in SECTOR_FACE.items():
        if f == face and point_in(panel2d(end, s), q, eps=-1e-9):
            return s
    return None


def main():
    ok_all = True

    def check(name, ok, extra=''):
        nonlocal ok_all
        ok_all = ok_all and bool(ok)
        print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))

    if not STATES.exists():
        print('NG  squash_states.json が無い（node test_squash_recipe.js --write）')
        return 1
    states = json.load(io.open(STATES, encoding='utf-8'))

    print('■ ① モデルの再構成（原本の面と結びだけから、8区間と R0〜R7 を組み直す）')
    rec = None
    # 🚨受理は**検証ずみの形だけ**。構造が同じでも、経路（枝）と層順を検証していない形は
    #   「再構成できた」で受理しない（中線2回はここ）。allow-list は構造からの推論ではない。
    VERIFIED = {'diagonals'}
    for name, want in [('diagonals', True), ('medians', True),
                       ('oneFold', False), ('mixed', False), ('offVertex', False)]:
        try:
            got = reconstruct(states[name]); reason = ''
        except Reject as e:
            got, reason = None, str(e)
        label = ('受理' if name in VERIFIED else '構造は組める／**未受理**') if got else '拒否'
        check('%-10s → %s' % (name, label), bool(got) == want,
              reason if not got else ('光線 ' + str(got['rays'])
                                      + ('' if name in VERIFIED else '（経路と層順が未検証）')))
        if name == 'diagonals':
            rec = got
    # ---- 合成入力の単体検査（実作品では届かない門を、直接鳴らす） ----
    #      🚨検査が捕まえられない守りは「守れていない」と同じ。自然な例で届かない門は
    #        ここで合成入力を作って直接ためす（届かない形は関数単体で固定する・既存の決めごと）。
    def synth(bounds_deg, bonds_deg, kind='hinge'):
        """頂点Oのまわりに、指定の向きで4面を並べた合成の状態（xf は恒等＝poly がそのまま素材）。"""
        d = lambda a: [math.cos(math.radians(a)), math.sin(math.radians(a))]
        faces = [{'faceId': 'F%d' % i, 'layerPath': [], 'layer': i,
                  'xf': [1, 0, 0, 1, 0, 0],
                  'poly': [[0.0, 0.0], d(bounds_deg[i]), d(bounds_deg[(i + 1) % 4])]}
                 for i in range(4)]
        bonds = [{'faceIds': ['F%d' % (j % 4), 'F%d' % ((j + 1) % 4)], 'kind': kind,
                  'seg': [[0.0, 0.0], d(a)]} for j, a in enumerate(bonds_deg)]
        return {'faces': faces, 'bonds': bonds}

    def rejects(state, pattern, label):
        try:
            reconstruct(state)
            check(label, False, '★受理してしまった')
        except Reject as e:
            check(label, pattern in str(e), str(e))

    rejects(synth([0, 100, 180, 280], [0, 100, 180, 280]), '45°でない',
            'U1 合成：光線が45°おきでない形を拒否する')
    rejects(synth([0, 90, 180, 270], [0, 90, 180, 45]), '1本おきに並んでいない',
            'U2 合成：結びが1本おきに並んでいない形を拒否する')
    rejects(synth([0, 90, 180, 270], [0, 90, 180, 270], kind='crease'), 'hinge でない',
            'U3 合成：結びが hinge でない形を拒否する')
    check('U4 合成：45°おき・結びが1本おき・hinge なら受理する',
          bool(reconstruct(synth([0, 90, 180, 270], [0, 90, 180, 270]))))
    # 閉じ条件の門そのもの（45°おきなら自然には破れないので、角を直接くずして鳴らす）
    bad = [math.pi if i % 2 else 0.0 for i in range(8)]
    bad[2] = math.radians(120)
    check('U5 閉じ条件の門は、狂った折り角の組でちゃんと鳴る',
          L.closure_error(bad) > 1e-9, '残差 %.2e' % L.closure_error(bad))

    # 入力配列の順に依らない
    import random
    rnd = random.Random(20260913)
    base = canon(reconstruct(states['diagonals']))
    same = True
    for _ in range(200):
        s = {'faces': states['diagonals']['faces'][:], 'bonds': states['diagonals']['bonds'][:]}
        rnd.shuffle(s['faces']); rnd.shuffle(s['bonds'])
        if canon(reconstruct(s)) != base:
            same = False
    check('面と結びの配列を200通り並べかえても、同じ再構成になる', same)
    check('結びは1本おき（diagonals は奇数側 / medians は偶数側）',
          sorted(rec['bondAt']) == [1, 3, 5, 7]
          and sorted(reconstruct(states['medians'])['bondAt']) == [0, 2, 4, 6],
          'diagonals=%s medians=%s' % (sorted(rec['bondAt']), sorted(reconstruct(states['medians'])['bondAt'])))
    check('区間の持ち主が8つとも決まっている（Q_E,Q_S,Q_W,Q_N が2区間ずつ）',
          sorted({o: rec['owner'].count(o) for o in set(rec['owner'])}.values()) == [2, 2, 2, 2])
    check('中線2回は構造が同じでも**受理しない**（経路と層順が未検証だから）',
          'medians' not in VERIFIED and bool(reconstruct(states['medians'])))
    # 🚨角度順の R 番号は**この検査の中だけの通し番号**。保存の識別子にはしない。
    check('R番号は保存の識別子にしない（軸は素材の vertex/end と役割で特定する）',
          'R0' not in json.dumps(json.load(io.open(HERE / 'squash_probe_2te.json', encoding='utf-8'))))

    print()
    print('■ ② 全領域の層順（比較点は engine が全重なり領域から作る。人が書く at は使わない）')
    end = L.panels(L.rho_of(1.0))
    # 最終形での各「面」の多角形＝その面が持つ区間の合併（どれも凸な90°の楔）
    face_polys = {}
    for f in sorted(set(SECTOR_FACE.values())):
        secs = [s for s, v in SECTOR_FACE.items() if v == f]
        hull = ccw(convex_hull([p for s in secs for p in panel2d(end, s)]))
        if abs(poly_area(hull) - sum(poly_area(panel2d(end, s)) for s in secs)) > 1e-9:
            check('面 %s の最終形が凸にならない（合併の扱いを見直すこと）' % f, False)
        face_polys[f] = hull
    # 2区間の面（Q_E・Q_S）は、内側の折り角が0＝**1枚の剛体**。どちらの区間から解いても同じ高さ。
    for f in ('Q_E', 'Q_S'):
        secs = [s for s, v in SECTOR_FACE.items() if v == f]
        pts = [panel2d(end, s)[1] for s in secs]
        q = ((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2)
        zs = [height_at(q, s, 1e-4) for s in secs]
        check('面 %s は2区間でも1枚の剛体（どちらの区間から見ても同じ高さ）' % f,
              abs(zs[0] - zs[1]) < 1e-12, str(zs))

    cells, _ = all_regions(face_polys)
    total = sum(a * len(s) for s, a in cells.items())
    check('列挙した領域だけで紙の面積を使い切っている（Σ 面積×枚数 = 4）', abs(total - 4.0) < 1e-9,
          '%.12f' % total)
    check('重なりのある領域は3つ（engine が列挙。人が書いた at は使っていない）',
          len([s for s in cells if len(s) >= 2]) == 3,
          str(sorted((tuple(sorted(s)), round(a, 6)) for s, a in cells.items())))

    def z_of(face, q, eps):
        s = sector_of(face, q, end)
        return None if s is None else height_at(q, s, eps)

    # ---- ②-a 高さの差は q について**アフィン**。凸な領域では頂点の符号が全体を決める ----
    #      🚨点のサンプルでは「領域のどこでも同順」は言えない。ここは式の形で押さえる。
    #      z_F(q) ＝「最終形で q に来ている素材点」を t=1-ε で見た高さ。最終形の配置も
    #      t=1-ε の配置もアフィンなので、その合成 z_F も q についてアフィン。よって
    #      Δ = z_A − z_B もアフィン → 凸集合では頂点での符号が全体の符号を決める。
    affine_ok, sign_ok, inner_ok, line_ok = True, True, True, True
    ident_zero, zero_line = set(), {}
    for sub in sorted((s for s in cells if len(s) >= 2), key=lambda s: sorted(s)):
        verts = intersect([face_polys[i] for i in sub])          # 凸（cell を含む）
        mean = (sum(v[0] for v in verts) / len(verts), sum(v[1] for v in verts) / len(verts))
        for a, b in itertools.combinations(sorted(sub), 2):
            for eps in (1e-2, 1e-3, 1e-4, 1e-5, 1e-6):
                d = [z_of(a, v, eps) - z_of(b, v, eps) for v in verts]
                dm = z_of(a, mean, eps) - z_of(b, mean, eps)
                scale = max([1e-12] + [abs(x) for x in d])
                if abs(dm - sum(d) / len(d)) > 1e-9 * scale:
                    affine_ok = False
                sg = {(0 if abs(x) <= TIE else (1 if x > 0 else -1)) for x in d}
                # ⚠ Δ は回転の頂点（8本が集まる点）でちょうど0になる＝そこは全面が高さ0。
                #   これは符号の反転ではない。アフィン関数なので「頂点で+と−に割れない」なら
                #   凸領域の全体で符号は変わらない、と言える。
                if 1 in sg and -1 in sg:
                    sign_ok = False
                    check('領域 %s の %s−%s は領域の中で符号が変わる' % (sorted(sub), a, b), False, str(d))
                zs_v = [v for v, x in zip(verts, d) if abs(x) <= TIE]
                key = (tuple(sorted(sub)), a, b)
                if len(zs_v) == len(verts):
                    ident_zero.add(key)          # 恒等的に0（＝両方とも固定面のはず）
                elif zs_v:
                    # Δ はアフィンで、回転の頂点では必ず0。0になる頂点が回転の頂点を通る
                    # 1本の直線に乗っているか＝2面が触れている折線の上か、を見る。
                    for v in zs_v:
                        if math.hypot(v[0], v[1]) < 1e-12:
                            continue
                        for w in zs_v:
                            cr = v[0] * w[1] - v[1] * w[0]
                            if abs(cr) > 1e-9:
                                line_ok = False
                    zero_line.setdefault(key, set()).update(
                        tuple(round(c, 9) for c in v) for v in zs_v)
                if (a in MOVING or b in MOVING) and abs(dm) <= TIE:
                    inner_ok = False        # 内部で判別できない＝この向きは決められない
    check('高さの差 Δ=z_A−z_B は q についてアフィン（頂点の平均での値＝頂点の値の平均）', affine_ok)
    check('Δ の符号は領域の頂点で + と − に割れない＝アフィンなので領域の全体で順序が入れかわらない',
          sign_ok)
    # Δ が消えるのは（a）両方とも固定面＝恒等的に0、（b）2面が触れている折線の上、の2つだけ。
    idz_pairs = sorted({(k[1], k[2]) for k in ident_zero})
    check('Δ が恒等的に 0 なのは固定面どうしの組だけ（＝同着＝継承へまわす）',
          all(a not in MOVING and b not in MOVING for a, b in idz_pairs), str(idz_pairs))
    check('それ以外で Δ が 0 になるのは、回転の頂点を通る1本の直線の上だけ（＝2面が触れている折線）',
          line_ok, str({('%s-%s' % (k[1], k[2])): sorted(v) for k, v in zero_line.items()}))
    check('動く面がからむ組は、領域の内部（重心）で |Δ| > TIE ＝ 上下がはっきり決まる', inner_ok)

    # ---- ②-b 同着の扱い。継承は**固定面どうしだけ**。動く面が判別不能なら拒否 ----
    orders, noise, min_sep, stable_eps = {}, 0.0, 1e9, True
    for sub, area in sorted(cells.items(), key=lambda kv: (-len(kv[0]), sorted(kv[0]))):
        if len(sub) < 2:
            continue
        verts = intersect([face_polys[i] for i in sub])
        probe = (sum(v[0] for v in verts) / len(verts), sum(v[1] for v in verts) / len(verts))
        per_eps = {}
        for eps in (1e-2, 1e-3, 1e-4, 1e-5, 1e-6):
            zs = [(z_of(f, probe, eps), f) for f in sorted(sub)]
            noise = max([noise] + [abs(z) for z, f in zs if f not in MOVING])
            min_sep = min([min_sep] + [abs(z) for z, f in zs if f in MOVING])
            o, bad = order_faces(zs)
            if bad:
                check('領域 %s：動く面が同着で判別できない → 拒否 %s' % (sorted(sub), bad), False)
            per_eps[eps] = o
        if len({per_eps[e] for e in per_eps}) != 1:
            stable_eps = False
        orders[sub] = per_eps[1e-6]
        print('    領域 %-24s 面積 %.4f  下から: %s'
              % (','.join(sorted(sub)), area, ' < '.join(orders[sub])))
    check('ε を 1e-2 → 1e-6 と縮めても順序が変わらない', stable_eps)

    # 動く面が同着になったら拒否する、を合成入力で直接ためす（実作品では届かないため）
    fake = [(0.0, 'Q_E'), (1e-15, 'P1'), (2e-15, 'P2')]
    _, bad_fake = order_faces(fake)
    check('動く面どうしが同着なら拒否する（合成で確認）', bool(bad_fake), str(bad_fake))
    _, bad_fix = order_faces([(0.0, 'Q_E'), (1e-16, 'Q_S'), (1e-16, 'P4')])
    check('固定面どうしの同着は拒否せず、状態②の層順を継ぐ', not bad_fix)

    # ---- ②-c 数値の余裕を3段に分けて記録 ----
    print('    ┌ 丸め誤差（固定面の高さの粉）                %.2e' % noise)
    print('    │ TIE（同着のしきい値・この正規化モデル専用）  %.0e' % TIE)
    print('    └ 動く面の高さの最小（ε=1e-6 まで）           %.2e' % min_sep)
    check('3段が「丸め誤差 < TIE < 動く面」の順にあいている', noise < TIE < min_sep,
          '%.2e < %.0e < %.2e' % (noise, TIE, min_sep))

    # ---- ②-d 独立検査：t=1-ε の**実際の投影の重なり**で、同じ法線の上の点を比べる ----
    #      ⚠ ②の方法は「最終形で同じ点に来る素材点」を比べる＝終端直前には**横位置の違う点**を
    #        見ている。別の測りかたでも同じ上下になることを、ここで独立に確かめる。
    def proj_poly(now, face):
        secs = [s for s, v in SECTOR_FACE.items() if v == face]
        return ccw(convex_hull([(float(v[0]), float(v[1])) for s in secs for v in now[s]]))

    def z_on_normal(now, face, p):
        for s in [s for s, v in SECTOR_FACE.items() if v == face]:
            tri = [(float(v[0]), float(v[1])) for v in now[s]]
            if point_in(tri, p, eps=-1e-9):
                w = bary(tri, p)
                return float(sum(w[k] * now[s][k][2] for k in range(3)))
        return None

    agree, tested, skipped = True, 0, []
    for eps in (1e-3, 1e-4, 1e-5):
        now = L.panels(L.rho_of(1.0 - eps))
        for sub in sorted((s for s in cells if len(s) >= 2), key=lambda s: sorted(s)):
            for a, b in itertools.combinations(sorted(sub), 2):
                ov = intersect([proj_poly(now, a), proj_poly(now, b)])
                if len(ov) < 3 or poly_area(ov) < 1e-6:
                    skipped.append('%s-%s@%g' % (a, b, eps)); continue
                c = (sum(v[0] for v in ov) / len(ov), sum(v[1] for v in ov) / len(ov))
                za, zb = z_on_normal(now, a, c), z_on_normal(now, b, c)
                if za is None or zb is None:
                    skipped.append('%s-%s@%g(点が外)' % (a, b, eps)); continue
                tested += 1
                want_below = orders[sub].index(a) < orders[sub].index(b)
                if abs(za - zb) <= TIE:
                    if a in MOVING or b in MOVING:
                        agree = False                      # 動く面が同着なら判別不能＝拒否
                elif ((za - zb) < 0) != want_below:
                    agree = False
    check('独立検査：t=1-ε の実際の投影の重なりで、同じ法線上の点を比べても同じ上下（%d組）' % tested,
          agree and tested >= 6, ('比べられなかった組: ' + ','.join(skipped[:4])) if skipped else '')

    print()
    print('■ ③ 領域ごとの上下 →「面ごとに1つの layer 値」へ直せるか')
    edges = set()
    for sub, o in orders.items():
        for i in range(len(o) - 1):
            edges.add((o[i], o[i + 1]))
    # 🚨重ならない面どうしには順位を要求しない（stack は検算用の上下関係だけを持つ）
    overlapping = {tuple(sorted(pr)) for sub in orders
                   for pr in itertools.combinations(sorted(sub), 2)}
    check('重ならない面どうしに順位を要求していない',
          all(tuple(sorted(e)) in overlapping for e in edges),
          str([e for e in edges if tuple(sorted(e)) not in overlapping]))
    nodes = sorted(face_polys)
    incoming = {n: {a for a, b in edges if b == n} for n in nodes}
    seq, left = [], set(nodes)
    while left:
        ready = sorted(n for n in left if not (incoming[n] & left))
        if not ready:
            break
        seq += ready; left -= set(ready)
    check('領域ごとの上下に循環が無い（トポロジカルに並べられる）', not left,
          '並べられなかった: ' + str(sorted(left)) if left else '下から: ' + ' < '.join(seq))
    src = io.open(HERE / 'build_tsuru_base.py', encoding='utf-8').read()
    check('build_tsuru_base.py に ③ の層 [0, 0, 3, 3, 2, 1, 1, 0] がある',
          '[0, 0, 3, 3, 2, 1, 1, 0]' in src)
    want = {'Q_E': 0, 'P1': 0, 'P2': 3, 'P3': 3, 'P4': 2, 'Q_S': 1}   # 8区間→6面
    bad = [(a, b) for a, b in edges if want[a] >= want[b]]
    check('折り図の層は、列挙した全領域の上下と矛盾しない', not bad, str(bad))

    print()
    print('― この検査が言っていないこと ―')
    print('  ⛔ 紙どうしの貫通は見ていない。閉路が閉じることだけで「物理的に折れる」とは言わない')
    print('  ⛔ 一般の袋折りへは広げない。ここで受理したのは degree4-45 の形だけ')
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


def convex_hull(pts):
    pts = sorted(set((round(p[0], 12), round(p[1], 12)) for p in pts))
    if len(pts) < 3:
        return pts

    def half(ps):
        out = []
        for p in ps:
            while len(out) >= 2:
                (x1, y1), (x2, y2) = out[-2], out[-1]
                if (x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1) <= 1e-12:
                    out.pop()
                else:
                    break
            out.append(p)
        return out
    return half(pts)[:-1] + half(pts[::-1])[:-1]


if __name__ == '__main__':
    sys.exit(main())
