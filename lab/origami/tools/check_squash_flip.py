# -*- coding: utf-8 -*-
"""袋折り（つる③）を「どの角から2回半分に折った紙」でも使えるか＝**運動の枝の独立検証**。

★何を言う検査か
   新しい紙（表のまま／裏返す v・h）→ 2回対角に半分折り（1回目の角4通り × 2回目の角2通り）でできる状態②が、
   検証ずみのつる②と、どう対応するかを**JS を使わずに**確かめる。
   ① 状態の対応：素材の対称 D と、いまの平面の対称 G（どちらも正方形の8通り）で読みかえると、
      **高さ z はそのまま（袋は上）**で、検証ずみの姿（EXPECT ②のあと）と層（LAYER_BY_STEP ②）に
      **ちょうど1通りだけ**重なる：G·(いまの位置) ＝ 検証ずみの位置(D·素材の点)。
      ★G が鏡映でも物理的に正しい：3D の置かれ方 R = diag(Gᵀ,1)·M·diag(D, det G·det D) は回転（det 1）。
   ② 運動の枝：素材の座標のまま骨の木を組み直し（squash_model / check_squash_linkage の骨の木は使わない）、
      動く4本の符号 16通りを総当りする。閉じるのは2通り（全部＋／全部−）。
      そのうち「袋が上へ開く（下の層へ潜らない）」のは1通りだけで、その符号は **det(G)·det(D) × 表の枝**。
   ③ その枝の運動は、1801コマとも **Gᵀ ∘ 検証ずみの運動 ∘ D**（高さはそのまま）と一致。
      t=0 は Python の再生器（origami_recipe.py）が出した面の xf と一致、t=1 は EXPECT ③のあと と一致。
   ④ 最終形の表裏は det(G)·det(D) × 表の場合、層の上下は LAYER_BY_STEP ③ と矛盾しない。
   ⑤ JS の再生結果（`squash_flip_states.json`＝`node test_squash_flip.js --write` が書く）があれば、
      面ごとの xf・表裏・領域の上下を ③④ と突き合わせる。

★これが言わないこと
   ⛔ 紙どうしの貫通は見ていない（「下の層へ潜る」は枝を選ぶための最低限の見張りで、非貫通の保証ではない）。
   ⛔ 厚みは 0。
   ⛔ 一般の袋折りは見ていない。つる③（頂点がまん中）を、2回の対角半分折りで作ったときだけ。

使い方： python check_squash_flip.py
関連メモリ： [[project_freefold_ui]] の 🧺
"""
import sys, math, json, copy, itertools
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import origami_recipe as R            # Python の再生器（JS の engine とは別実装）
import build_tsuru_base as B          # EXPECT の出どころ（折り図から読んだ姿）
import check_squash_linkage as L      # 連動式（atan2形）と、検証ずみの運動の FK

PI = math.pi
TOL = 1e-9
FRAMES = 1801
# build_tsuru_base.py の LAYER_BY_STEP（関数の中にあるので値を写す。0が下）
LAYER_START = [0, 3, 3, 2, 2, 1, 1, 0]   # ②のあと
LAYER_END = [0, 0, 3, 3, 2, 1, 1, 0]     # ③のあと

RAY = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
RADIUS = [math.hypot(*p) for p in RAY]
MATERIAL = [((0, 0), RAY[i], RAY[(i + 1) % 8]) for i in range(8)]
# 正方形の対称8通り（2×2 の直交行列）
DIHEDRAL = []
for k in range(4):
    c, s = round(math.cos(k * PI / 2)), round(math.sin(k * PI / 2))
    DIHEDRAL.append(((c, -s), (s, c)))
    DIHEDRAL.append(((c, s), (s, -c)))

ok_all = True


def check(name, ok, extra=''):
    global ok_all
    ok_all = ok_all and bool(ok)
    print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))


def mat2(m, p):
    return (m[0][0] * p[0] + m[0][1] * p[1], m[1][0] * p[0] + m[1][1] * p[1])


def det2(m):
    return m[0][0] * m[1][1] - m[0][1] * m[1][0]


def xf_apply(xf, p):
    return (xf[0] * p[0] + xf[1] * p[1] + xf[4], xf[2] * p[0] + xf[3] * p[1] + xf[5])


def xf_inv(xf, p):
    d = xf[0] * xf[3] - xf[1] * xf[2]
    x, y = p[0] - xf[4], p[1] - xf[5]
    return ((xf[3] * x - xf[1] * y) / d, (-xf[2] * x + xf[0] * y) / d)


def tri_key(pts):
    return sorted((round(a, 5) + 0.0, round(b, 5) + 0.0) for (a, b) in pts)


def inside(poly, p, eps=1e-9):
    s = 0
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        if abs(c) < eps:
            continue
        if s == 0:
            s = 1 if c > 0 else -1
        elif (c > 0) != (s > 0):
            return False
    return True


def ray_index(v):
    for k, r in enumerate(RAY):
        if abs(v[0] - r[0]) < 1e-9 and abs(v[1] - r[1]) < 1e-9:
            return k
    raise ValueError(v)


def sector_of_triangle(tri):
    """素材の三角形 (O, a, b) が、どの区間 P_i か。"""
    ks = sorted(ray_index(p) for p in tri[1:])
    return 7 if ks == [0, 7] else ks[0]


# ---------------------------------------------------------------- 原本を作って Python で再生
def build_recipe(flip_axis, c1=(-1, -1), c2=(-1, 1)):
    """画面と同じ2回の半分折りを、**いまの座標**で指定して原本にする（素材座標へは再生器の xf で直す）。
       1回目：角 c1 を向かいの角 −c1 へ（折線は c1 に垂直な対角線）／
       2回目：三角形の鋭角 c2 をもう一方の鋭角へ（折線は O と直角の角 −c1 を通る線、上から2枚）。"""
    base = json.loads((HERE / 'squash_tsuru3_v2.json').read_text(encoding='utf-8'))
    rec = {k: copy.deepcopy(v) for k, v in base.items() if k != 'steps'}
    rec['version'] = 1
    rec['steps'] = []
    if flip_axis:
        rec['steps'].append({'id': 's1', 'diagramStep': '1', 'op': 'flip', 'axis': flip_axis, 'instruction': 'うらがえす'})
    folds = [(((-c1[1], c1[0]), (c1[1], -c1[0])), (0.7 * c1[0], 0.7 * c1[1])),
             (((0, 0), (-c1[0], -c1[1])), (0.5 * c2[0] - 0.3 * c1[0], 0.5 * c2[1] - 0.3 * c1[1]))]
    for line_now, msp_now in folds:
        if rec['steps']:
            panels = R.replay(rec)[0].panels
        else:   # 手0本は schema の minItems で読めない＝折る前の1枚（再生器の初期状態と同じ）
            panels = [{'recipeFace': {'faceId': 'paper', 'layerPath': []}, 'xf': [1, 0, 0, 1, 0, 0], 'layer': 0,
                       'poly': [(-1, -1), (1, -1), (1, 1), (-1, 1)]}]
        top = sorted((p for p in panels if inside(p['poly'], msp_now)), key=lambda p: -p['layer'])[0]
        n = len(rec['steps']) + 1
        rec['steps'].append({
            'id': f's{n}', 'diagramStep': str(n), 'op': 'fold', 'kind': 'V',
            'reference': {'faceId': top['recipeFace']['faceId']},
            'line': [rnd(xf_inv(top['xf'], p)) for p in line_now],
            'movingSidePoint': rnd(xf_inv(top['xf'], msp_now)),
            'targets': [copy.deepcopy(p['recipeFace']) for p in panels],
            'instruction': 'はんぶんに おる'})
    st, _ = R.replay(rec)
    faces = [{'id': p['recipeFace']['faceId'], 'xf': list(p['xf']), 'layer': p['layer'],
              'mpoly': [xf_inv(p['xf'], q) for q in p['poly']]} for p in st.panels]
    return rec, faces


def rnd(p):
    """xf の逆で出る 1e-16 の粉を落とす（原本は -1〜1 の範囲。記録する点は格子点か短い小数だけ）。"""
    return [round(v, 12) + 0.0 for v in p]


def owner_of(faces, mtri):
    c = ((mtri[0][0] + mtri[1][0] + mtri[2][0]) / 3, (mtri[0][1] + mtri[1][1] + mtri[2][1]) / 3)
    hit = [f for f in faces if inside(f['mpoly'], c)]
    assert len(hit) == 1, (mtri, [f['id'] for f in hit])
    return hit[0]


# ---------------------------------------------------------------- ① 状態の対応 D を探す
def find_frames(faces, only_G=None):
    """G·(いまの紙) ＝ 検証ずみの状態② ∘ D（高さはそのまま）になる (D, G) をぜんぶ返す（EXPECT と LAYER_BY_STEP で照合）。"""
    want = B.EXPECT['②のあと']
    out = []
    for D in DIHEDRAL:
        Dt = ((D[0][0], D[1][0]), (D[0][1], D[1][1]))
        for G in ([only_G] if only_G else DIHEDRAL):
            owner, ok = [], True
            for i in range(8):
                mtri = [mat2(Dt, p) for p in MATERIAL[i]]           # 検証ずみの区間 i に来る、素材の三角形
                f = owner_of(faces, mtri)
                owner.append(f)
                got = tri_key([mat2(G, xf_apply(f['xf'], p)) for p in mtri])
                exp = [(a, b) for (a, b) in want['P%d' % i]]
                if got != exp:
                    ok = False
            if not ok:
                continue
            lay = all((owner[i]['layer'] - owner[j]['layer']) * (LAYER_START[i] - LAYER_START[j]) > 0
                      or (owner[i]['layer'] == owner[j]['layer'] and LAYER_START[i] == LAYER_START[j])
                      for i in range(8) for j in range(8) if owner[i] is not owner[j])
            if lay:
                out.append((D, G, owner))
    return out


# ---------------------------------------------------------------- ② 素材の座標で骨の木を組み直す
def rot(u, th):
    """素材の平面の単位ベクトル u（z=0）まわりの回転。"""
    ux, uy = u
    c, s = math.cos(th), math.sin(th)
    K = np.array([[0, 0, uy], [0, 0, -ux], [-uy, ux, 0]], float)
    return np.eye(3) + s * K + (1 - c) * (K @ K)


def embed(xf):
    d = xf[0] * xf[3] - xf[1] * xf[2]
    return np.array([[xf[0], xf[1], 0], [xf[2], xf[3], 0], [0, 0, d]], float)


class MaterialFK:
    """素材の区間 j（光線 j と j+1 のあいだ）ごとの 3D 回転 R_j。根は検証ずみの P0 に来る区間。
       R_{j+1} = R_j·Rot(u_{j+1}, θ_{j+1})（反時計まわりに4つ）／R_{j-1} = R_j·Rot(u_j, −θ_j)（時計まわりに3つ）。
       輪を閉じる1本は、両側の枝から来た R のずれで測る。"""

    def __init__(self, D, G, owner, signs):
        self.D, self.G, self.owner, self.signs = D, G, owner, signs
        self.Gt = ((G[0][0], G[1][0]), (G[0][1], G[1][1]))
        self.detD = det2(D)
        Dt = ((D[0][0], D[1][0]), (D[0][1], D[1][1]))
        self.sec_of_model = [sector_of_triangle([mat2(Dt, p) for p in MATERIAL[i]]) for i in range(8)]
        self.model_of_sec = [self.sec_of_model.index(j) for j in range(8)]
        self.model_of_ray = [ray_index(mat2(D, RAY[k])) for k in range(8)]
        self.root = self.sec_of_model[0]
        root_face = owner[0]
        assert abs(root_face['xf'][4]) < TOL and abs(root_face['xf'][5]) < TOL
        self.R0 = embed(root_face['xf'])

    def theta(self, t):
        rho = L.rho_of(t)
        return [self.signs[k] * rho[self.model_of_ray[k]] for k in range(8)]

    def place(self, t):
        th = self.theta(t)
        u = [np.array(RAY[k], float) / RADIUS[k] for k in range(8)]
        Rm = {self.root: self.R0}
        j = self.root
        for _ in range(4):
            n = (j + 1) % 8
            Rm[n] = Rm[j] @ rot(u[n], th[n])
            j = n
        last_ccw = j
        j = self.root
        for _ in range(3):
            n = (j + 7) % 8
            Rm[n] = Rm[j] @ rot(u[j], -th[j])
            j = n
        # 輪の1本：時計まわりの枝の最後 j と、反時計まわりの最後 last_ccw は隣りあう（last_ccw+1 == j）
        loop = Rm[last_ccw] @ rot(u[j], th[j])
        gap = float(np.abs(loop - Rm[j]).max())
        pts = {}
        for s in range(8):
            pts[s] = [np.zeros(3), Rm[s] @ np.array([*RAY[s], 0.0]), Rm[s] @ np.array([*RAY[(s + 1) % 8], 0.0])]
        return Rm, pts, gap


def model_points(t):
    """検証ずみの運動（check_squash_linkage の骨の木）。区間 i ごとに [O, R_i 側, R_{i+1} 側]。"""
    pl = L.panels(L.rho_of(t))
    return {i: [np.array(v, float) for v in pl[i]] for i in range(8)}


def compare_to_model(fk, t):
    """素材の FK の位置 ＝ Gᵀ ∘ 検証ずみの運動 ∘ D か（区間ごと・頂点ごと。高さはそのまま）。"""
    _, pts, _ = fk.place(t)
    mp = model_points(t)
    worst = 0.0
    for s in range(8):
        i = fk.model_of_sec[s]
        for vi, mat in ((1, RAY[s]), (2, RAY[(s + 1) % 8])):
            k = ray_index(mat2(fk.D, mat))
            mv = mp[i][1] if k == i else mp[i][2]
            xy = mat2(fk.Gt, (float(mv[0]), float(mv[1])))
            worst = max(worst, float(np.abs(pts[s][vi] - np.array([xy[0], xy[1], float(mv[2])])).max()))
    return worst


MOVING_RAYS = [k for k in range(8) if abs(L.rho_of(0)[k] - L.rho_of(1)[k]) > 1e-9]   # 1,2,3,4（モデル番号）


def branch_search(D, G, owner, label):
    """動く4本の符号（素材の座標で見た向き）を総当り。閉じる組と、上へ開く組を返す。"""
    mat_moving = [k for k in range(8) if ray_index(mat2(D, RAY[k])) in MOVING_RAYS]
    closing, upward = [], []
    for combo in itertools.product([1, -1], repeat=4):
        signs = [1] * 8
        for k, s in zip(mat_moving, combo):
            signs[k] = s
        fk = MaterialFK(D, G, owner, signs)
        worst = max(fk.place(k / 180.0)[2] for k in range(181))
        if worst > TOL:
            continue
        closing.append(signs)
        # 上へ開くか：t=0.01 で、動く区間の頂点が z<0（下の層の側）へ行かない＝基準面の紙を突き抜けない
        _, pts, _ = fk.place(0.01)
        zs = [float(p[2]) for s in range(8) for p in pts[s][1:]]
        if min(zs) > -1e-12 and max(zs) > 1e-6:
            upward.append(signs)
    return closing, upward, mat_moving


def layers_at_end(fk):
    """t=1 で重なる区間どうしの上下（t=1-ε の高さ）。返すのは [(区間a, 区間b, a が上か)]"""
    _, end, _ = fk.place(1.0)
    _, near, _ = fk.place(1 - 1e-6)
    tri2 = {s: [(float(p[0]), float(p[1])) for p in end[s]] for s in range(8)}
    out = []
    for a in range(8):
        for b in range(a + 1, 8):
            A, Bt = tri2[a], tri2[b]
            ca = (sum(p[0] for p in A) / 3, sum(p[1] for p in A) / 3)
            if not (inside(Bt, ca) and inside(A, ca)):
                continue

            def z_at(s, q):
                T = tri2[s]
                (x1, y1), (x2, y2), (x3, y3) = T
                d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
                w1 = ((y2 - y3) * (q[0] - x3) + (x3 - x2) * (q[1] - y3)) / d
                w2 = ((y3 - y1) * (q[0] - x3) + (x1 - x3) * (q[1] - y3)) / d
                w3 = 1 - w1 - w2
                return w1 * near[s][0][2] + w2 * near[s][1][2] + w3 * near[s][2][2]
            dz = z_at(a, ca) - z_at(b, ca)
            out.append((a, b, dz))
    return out


CORNERS = [(-1, -1), (1, -1), (1, 1), (-1, 1)]


def case_list():
    """表／裏返し v は 1回目の角4通り × 2回目の角2通り。裏返し h は検査の経路1本。"""
    out = []
    for axis in (None, 'v'):
        for c1 in CORNERS:
            for c2 in ((-c1[1], c1[0]), (c1[1], -c1[0])):      # 1回目の折線の両端＝三角形の鋭角
                name = ('表' if axis is None else '裏返し' + axis) + ' 1回目%s 2回目%s' % (list(c1), list(c2))
                out.append((name, axis, c1, c2))
    out.append(('裏返しh 1回目[-1, -1] 2回目[-1, 1]', 'h', (-1, -1), (-1, 1)))
    return sorted(out, key=lambda c: c[0] != FRONT_LABEL)       # 比べる相手（検証ずみの経路）を先に


FRONT_LABEL = '表 1回目[-1, -1] 2回目[-1, 1]'   # 検証ずみの経路（D=G=恒等）


def main():
    print('■ 対象：新しい紙（表／裏返す）→ 2回対角に半分折り（角の選び方ぜんぶ）→ つる③の袋折り')
    print()
    front_branch = None
    results = {}
    front_normals = None
    for label, axis, c1, c2 in case_list():
        rec, faces = build_recipe(axis, c1, c2)
        print('― ' + label + '（Python の再生器で', len(faces), '枚）')
        frames = find_frames(faces)
        check(label + '：状態②が検証ずみの姿と層に重なる (D, G)（高さはそのまま）は1通りだけ',
              len(frames) == 1, '見つかった数 %d' % len(frames))
        if len(frames) != 1:
            continue
        D, G, owner = frames[0]
        detD, detG = det2(D), det2(G)
        print('    D =', D, ' G =', G, ' 基準面（検証ずみの P0 に来る面）=', owner[0]['id'], '層', owner[0]['layer'])
        check(label + '：基準面はいちばん下の面（袋は上）', owner[0]['layer'] == min(f['layer'] for f in faces))
        if label == FRONT_LABEL:
            check(label + '：D も G も恒等（従来の照合と同じ）', D == ((1, 0), (0, 1)) and G == ((1, 0), (0, 1)))
        if G != ((1, 0), (0, 1)):
            # 負例：G を恒等のまま（前回までの照合）読むと、姿か層が合わない
            check(label + '：負例 G を恒等に固定すると照合で断られる（候補0件だった原因）',
                  not find_frames(faces, only_G=((1, 0), (0, 1))))

        closing, upward, mat_moving = branch_search(D, G, owner, label)
        check(label + '：動く4本の符号16通りのうち閉じるのは2通り（全部同じ向き）',
              len(closing) == 2 and all(len({s[k] for k in mat_moving}) == 1 for s in closing),
              '閉じる組 %d' % len(closing))
        check(label + '：そのうち袋が上へ開く（下の層へ潜らない）のは1通りだけ',
              len(upward) == 1, '上へ開く組 %d' % len(upward))
        if len(upward) != 1:
            continue
        sign = upward[0][mat_moving[0]]
        if label == FRONT_LABEL:
            front_branch = sign
            print('    表の枝：素材の座標で見た動く4本の符号 =', sign)
        else:
            check(label + '：枝の符号 = det(G)·det(D) × 表の枝',
                  front_branch is not None and sign == detG * detD * front_branch,
                  'この経路 %+d／表 %+d' % (sign, front_branch or 0))
            wrong = [s for s in closing if s is not upward[0]]
            fkw = MaterialFK(D, G, owner, wrong[0])
            _, pw, _ = fkw.place(0.01)
            zmin = min(float(p[2]) for s in range(8) for p in pw[s][1:])
            check(label + '：負例 もう一方の符号で動かすと、袋が下の層の側へ潜る', zmin < -1e-6, 'z最小 %.3e' % zmin)

        fk = MaterialFK(D, G, owner, upward[0])
        Rm, _, _ = fk.place(0.0)
        worst0 = 0.0
        for s in range(8):
            f = owner[fk.model_of_sec[s]]
            worst0 = max(worst0, float(np.abs(Rm[s] - embed(f['xf'])).max()))
        check(label + '：t=0 の素材の FK が、Python の再生器の面の置かれ方（xf と表裏）と一致', worst0 < TOL, '%.2e' % worst0)
        wg = wm = 0.0
        for k in range(FRAMES):
            t = k / (FRAMES - 1)
            wg = max(wg, fk.place(t)[2])
            wm = max(wm, compare_to_model(fk, t))
        check(label + '：%dコマ 輪のずれ（閉路）' % FRAMES, wg < TOL, '%.2e' % wg)
        check(label + '：%dコマ 位置 ＝ Gᵀ∘検証ずみの運動∘D（高さそのまま）' % FRAMES, wm < TOL, '%.2e' % wm)
        Rm1, p1, _ = fk.place(1.0)
        flat = max(abs(float(p[2])) for s in range(8) for p in p1[s])
        shape = all(tri_key([mat2(G, (float(p[0]), float(p[1]))) for p in p1[s]]) ==
                    [(a, b) for (a, b) in B.EXPECT['③のあと']['P%d' % fk.model_of_sec[s]]] for s in range(8))
        check(label + '：t=1 は平らで、G で戻した形が EXPECT ③のあと（検証ずみの区間番号で）と一致',
              flat < TOL and shape, '|z|最大 %.1e' % flat)
        normals = [int(round(float(Rm1[s][2][2]))) for s in range(8)]
        results[label] = {'D': D, 'G': G, 'fk': fk, 'normals': normals, 'owner': owner, 'rec': rec}
        if label == FRONT_LABEL:
            front_normals = normals
        elif front_normals is not None:
            ok = all(normals[s] == detG * detD * front_normals[fk.model_of_sec[s]] for s in range(8))
            check(label + '：最終形の表裏 = det(G)·det(D) × 表の場合（検証ずみの区間番号で）', ok,
                  'この経路 %s／表 %s' % (normals, front_normals))
        bad = []
        for a, b, dz in layers_at_end(fk):
            la, lb = LAYER_END[fk.model_of_sec[a]], LAYER_END[fk.model_of_sec[b]]
            if abs(dz) <= 1e-12:
                continue
            if la != lb and (dz > 0) != (la > lb):
                bad.append((a, b))
        check(label + '：t=1-ε の高さの上下が、検証ずみの層（LAYER_BY_STEP ③）と矛盾しない', not bad, str(bad))

    # ⑤ JS の再生結果との突き合わせ
    js = HERE / 'squash_flip_states.json'
    print()
    if not js.exists():
        check('JS の再生結果 squash_flip_states.json がある（node test_squash_flip.js --write で作る）', False)
    else:
        data = json.loads(js.read_text(encoding='utf-8'))
        check('JS：JS の結果に Python の経路がぜんぶある（%d通り）' % len(results),
              set(results) <= {c['label'] for c in data['cases']},
              '足りない %s' % sorted(set(results) - {c['label'] for c in data['cases']}))
        for case in data['cases']:
            label = case['label']
            if label not in results:
                check('JS：' + label + ' の Python 側の結果がない', False)
                continue
            r = results[label]
            fk = r['fk']
            _, p1, _ = fk.place(1.0)
            Rm1, _, _ = fk.place(1.0)
            wpos = 0.0
            wside = True
            for f in case['faces']:
                for s in range(8):
                    c = MATERIAL[s]
                    cen = ((c[1][0] + c[2][0]) / 3, (c[1][1] + c[2][1]) / 3)
                    mpoly = [xf_inv(f['xf'], q) for q in f['poly']]
                    if not inside(mpoly, cen):
                        continue
                    for vi, mat in ((1, RAY[s]), (2, RAY[(s + 1) % 8])):
                        q = xf_apply(f['xf'], mat)
                        wpos = max(wpos, abs(q[0] - float(p1[s][vi][0])), abs(q[1] - float(p1[s][vi][1])))
                    d = f['xf'][0] * f['xf'][3] - f['xf'][1] * f['xf'][2]
                    wside = wside and (round(d) == int(round(float(Rm1[s][2][2]))))
            check('JS：' + label + ' 最終形の面の置かれ方が、素材の FK の t=1 と一致', wpos < 1e-9, '%.2e' % wpos)
            check('JS：' + label + ' 最終形の表裏（xf の行列式）が、素材の FK の法線と一致', wside)
            # 領域の上下：JS の領域ごとの order（下から）を、FK の t=1-ε の高さと突き合わせる
            _, near, _ = fk.place(1 - 1e-6)
            _, end, _ = fk.place(1.0)
            bad = []
            fmap = {f['faceId']: f for f in case['faces']}
            for reg in case['regions']:
                probe = reg['probe']
                zs = []
                for fid in reg['order']:
                    f = fmap[fid]
                    mp = xf_inv(f['xf'], probe)
                    # 比較点が区間の境（光線の上）に来ることがある＝ふちを含めて最初の区間（どちらの区間でも同じ点・同じ高さ）
                    s = next(s for s in range(8) if inside(list(MATERIAL[s]), mp, 1e-9))
                    # 素材の点 mp の、t=1-ε での高さ（区間 s の回転で写す）
                    Rn = fk.place(1 - 1e-6)[0][s]
                    zs.append(float((Rn @ np.array([mp[0], mp[1], 0.0]))[2]))
                for i in range(1, len(zs)):
                    if not zs[i] > zs[i - 1] - 1e-12:
                        bad.append((reg['order'][i - 1], reg['order'][i]))
            check('JS：' + label + ' 領域ごとの上下（%d領域）が、素材の FK の t=1-ε の高さと矛盾しない' % len(case['regions']),
                  not bad, str(bad))

    print()
    print('― この検査が言っていないこと ―')
    print('  ⛔ 紙どうしの貫通は見ていない（「下の層へ潜る」は枝を選ぶための見張りだけ）')
    print('  ⛔ 厚みは 0。一般の袋折り・袋折りのあとの折りは見ていない')
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
