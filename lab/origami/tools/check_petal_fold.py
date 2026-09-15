# -*- coding: utf-8 -*-
"""つる⑧⑨「花弁折り」の運動を、本体（JS）から独立した剛体モデルで解いて検証する（2026-09-15・幾何の検証だけ）。

★対象：⑦のあと（正方基本形＋凧形の折り目2本＋上の三角の折り目）の、手前の1枚のフラップの花弁折り。
★独立性：面の素材の形・初めの置き方・結び・層は、ここで**手で書いた**（正方基本形の4つの四分円の等長写像）。
   JS（test_crane_progress.js --write が書く crane_step7_state.json）は**突き合わせの相手**として読むだけ＝期待値に使わない。
★座標
   素材：原紙 [-1,1]^2。中心 O=(0,0)。s = √(2-√2)（最小多項式 s^4-4s^2+2=0）とおくと √2 = 2-s^2・tan22.5° = 1-s^2・cos67.5° = s/2。
   置き場（正方基本形・紙面 z=0・手前が +z）：O(0,0)・開いた角 Q(-1,1)・横の角 A(-1,0)・B(0,1)・P=(0,s^2)・P'=(-s^2,0)・M=(-s^2/2,s^2/2)。
★厳密と数値を分ける
   [厳密] sympy で s を最小多項式で割った余りが 0／符号は「ノルム（終結式）の正の根」を数えて調べる
   [数値] numpy / mpmath の点検（連続追跡・枝・端点・非貫通の補助・終端の上下）
★使い方： python check_petal_fold.py        （厳密の部分に数十秒）
          python check_petal_fold.py --svg  （素材の図 petal_fold_cp.svg も書く）
関連メモリ： [[project_freefold_ui]] の 🕊
"""
import sys, json, math, itertools, html
from pathlib import Path
import numpy as np
import sympy as sp
import mpmath as mp

HERE = Path(__file__).resolve().parent
OK = True


def check(name, ok, extra=''):
    global OK
    OK = OK and bool(ok)
    print(('  ok ' if ok else '  NG ') + name + (('  ' + extra) if extra else ''))


# ================================================================ 1. 素材の図（面・折線・結び・角）
s = sp.Symbol('s')
MIN = s**4 - 4 * s**2 + 2
S0 = sp.sqrt(2 - sp.sqrt(2))                       # s の実の値（正の根）
R2 = 2 - s**2                                      # √2
INV_S = (4 * s - s**3) / 2                         # 1/s（s^4-4s^2+2=0 から）


def red(e):
    """s について最小多項式で割った余り（係数は u の多項式）"""
    e = sp.expand(e)
    return sp.Poly(e, s).rem(sp.Poly(MIN, s)).as_expr() if e.has(s) else e


# 素材の点（厳密）
MAT = {
    'O': (0, 0), 'P': (s**2, 0), "P'": (0, -s**2), 'M': (s**2 / 2, -s**2 / 2),
    'Q3': (1, -1), 'Q2R': (1, 1), 'Q2L': (-1, -1), 'B': (1, 0), 'A': (0, -1),
    'N': (0, 1), 'W': (-1, 0), 'Q0': (-1, 1),
}
# 四分円ごとの初めの置き方（素材 → 正方基本形の紙面）。行列 [a,b,c,d] で (a x + b y, c x + d y)。
QUAD = {'Q3': (0, 1, 1, 0), 'QR': (0, -1, 1, 0), 'QL': (0, 1, -1, 0), 'Q1R': (-1, 0, 0, 1), 'Q1L': (1, 0, 0, -1), 'Q0': (1, 0, 0, 1)}
# 面：名前 → (素材の頂点, 四分円の置き方, 層, 役割)
FACES = {
    'T2R': (['Q3', 'M', 'P'], 'Q3', 3, 'petal'),      # 花弁（右半分）
    'T2L': (["P'", 'M', 'Q3'], 'Q3', 3, 'petal'),     # 花弁（左半分）＝ T2R と Q3-M の平らな折り目でつながる1枚の剛体
    'T1R': (['Q3', 'P', 'B'], 'Q3', 3, 'side3'),      # 一番上の層の脇の三角
    'T1L': (['A', "P'", 'Q3'], 'Q3', 3, 'side3'),
    'S2R': (['Q2R', 'P', 'B'], 'QR', 2, 'side2'),     # 2枚目の脇の三角
    'S2L': (['A', "P'", 'Q2L'], 'QL', 2, 'side2'),
    'T3R': (['M', 'O', 'P'], 'Q3', 3, 'fixed'),       # 上の三角（止まる）
    'T3L': (["P'", 'O', 'M'], 'Q3', 3, 'fixed'),
    'G2R': (['Q2R', 'O', 'P'], 'QR', 2, 'fixed'),
    'G2L': (["P'", 'O', 'Q2L'], 'QL', 2, 'fixed'),
    'L1R': (['O', 'Q2R', 'N'], 'Q1R', 1, 'fixed'),
    'L1L': (['O', 'W', 'Q2L'], 'Q1L', 1, 'fixed'),
    'L0N': (['O', 'Q0', 'N'], 'Q0', 0, 'fixed'),
    'L0W': (['O', 'W', 'Q0'], 'Q0', 0, 'fixed'),
}
MOVING = [k for k, v in FACES.items() if v[3] != 'fixed']


def num(p):
    return tuple(float(sp.N(sp.sympify(c).subs(s, S0))) for c in p)


def place2(name, p):
    a, b, c, d = QUAD[FACES[name][1]]
    return (a * p[0] + b * p[1], c * p[0] + d * p[1])


def area2(pts):
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2


def material_checks():
    print('\n[1] 素材の面・折線・結び・角')
    # 面の敷きつめ：面積の和＝4、どの2枚も面積で重ならない（凸の交わり）
    polys = {k: [num(MAT[v]) for v in FACES[k][0]] for k in FACES}
    tot = sum(abs(area2(p)) for p in polys.values())
    check('[厳密でなく浮動小数] 面14枚の面積の和が原紙の 4', abs(tot - 4) < 1e-12, f'{tot:.15f}')
    ov = max(clip_area(polys[a], polys[b]) for a, b in itertools.combinations(FACES, 2))
    check('どの2枚も面積で重ならない（凸の交わりの面積）', ov < 1e-12, f'最大 {ov:.1e}')
    # 結び＝素材で辺を共有する面の組（辺の上で両面の置き方が同じ＝crease／鏡映＝hinge）
    bonds = []
    for a, b in itertools.combinations(FACES, 2):
        ea = edges(FACES[a][0]); eb = edges(FACES[b][0])
        for e in ea:
            if frozenset(e) in {frozenset(x) for x in eb}:
                same = QUAD[FACES[a][1]] == QUAD[FACES[b][1]]
                bonds.append((a, b, tuple(e), 'crease' if same else 'hinge'))
    check('結びは17本', len(bonds) == 17, str(len(bonds)))
    # 各頂点の周りの角（素材の中の角・度）
    table = {}
    for v in MAT:
        rows = []
        for k, (vs, _, _, _) in FACES.items():
            if v in vs:
                i = vs.index(v); a = num(MAT[vs[i - 1]]); o = num(MAT[v]); b = num(MAT[vs[(i + 1) % 3]])
                ang = abs(math.degrees(math.atan2((a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), (a[0] - o[0]) * (b[0] - o[0]) + (a[1] - o[1]) * (b[1] - o[1]))))
                rows.append((k, vs[i - 1], vs[(i + 1) % 3], ang))
        table[v] = rows
    for v in ['P', "P'", 'M', 'Q3', 'Q2R', 'Q2L', 'B', 'A', 'O']:
        tot = sum(r[3] for r in table[v])
        print(f'    {v:4s} 周り {tot:6.2f}°：' + '・'.join(f'{r[0]}({r[1]}-{r[2]}) {r[3]:.2f}' for r in table[v]))
    angP = {r[0]: r[3] for r in table['P']}
    check('P の周り：T3R 45・T2R 67.5・T1R 67.5・S2R 67.5・G2R 112.5（合計360）',
          all(abs(angP[k] - x) < 1e-9 for k, x in [('T3R', 45), ('T2R', 67.5), ('T1R', 67.5), ('S2R', 67.5), ('G2R', 112.5)]))
    angQ = {r[0]: r[3] for r in table["P'"]}
    check("P' の周り：左右の鏡映で同じ角", all(abs(angQ[k.replace('R', 'L')] - angP[k]) < 1e-9 for k in angP))
    return bonds, table


def edges(vs):
    return [(vs[i], vs[(i + 1) % len(vs)]) for i in range(len(vs))]


def clip_area(p, q):
    """凸多角形 p と q の交わりの面積（Sutherland–Hodgman）"""
    if area2(p) < 0: p = p[::-1]
    if area2(q) < 0: q = q[::-1]
    out = list(p)
    for i in range(len(q)):
        a, b = q[i], q[(i + 1) % len(q)]
        inp, out = out, []
        if not inp: break
        side = lambda r: (b[0] - a[0]) * (r[1] - a[1]) - (b[1] - a[1]) * (r[0] - a[0])
        for j in range(len(inp)):
            c, d = inp[j], inp[(j + 1) % len(inp)]
            sc, sd = side(c), side(d)
            if sc >= 0: out.append(c)
            if (sc >= 0) != (sd >= 0):
                t = sc / (sc - sd); out.append((c[0] + t * (d[0] - c[0]), c[1] + t * (d[1] - c[1])))
    return abs(area2(out)) if len(out) >= 3 else 0.0


def compare_js(bonds):
    """JS の⑦の確定形と、面の素材の形・置き方・層・結びの種類を突き合わせる（相手として読むだけ）"""
    f = HERE / 'crane_step7_state.json'
    if not f.exists():
        check('JS の⑦の確定形（node test_crane_progress.js --write）', False, 'ファイルが無い'); return
    js = json.loads(f.read_text(encoding='utf-8'))

    def inv(xf, q):
        d = xf[0] * xf[3] - xf[1] * xf[2]; x, y = q[0] - xf[4], q[1] - xf[5]
        return ((xf[3] * x - xf[1] * y) / d, (-xf[2] * x + xf[0] * y) / d)
    key = lambda pts: frozenset((round(p[0], 8) + 0.0, round(p[1], 8) + 0.0) for p in pts)
    mine = {key([num(MAT[v]) for v in FACES[k][0]]): k for k in FACES}
    name = {}
    bad = 0
    for jf in js['faces']:
        mpts = [inv(jf['xf'], q) for q in jf['poly']]
        k = mine.get(key(mpts))
        if not k: bad += 1; continue
        name[jf['faceId']] = k
        if jf['layer'] != FACES[k][2]: bad += 1
        if tuple(round(c, 9) + 0 for c in jf['xf']) != QUAD[FACES[k][1]] + (0, 0): bad += 1
        if key(jf['poly']) != key([place2(k, num(MAT[v])) for v in FACES[k][0]]): bad += 1
    check('JS の14面と、素材の形・置き方・層がぜんぶ一致', bad == 0 and len(name) == 14, f'不一致 {bad}')
    jb = {(frozenset((name[b['faceIds'][0]], name[b['faceIds'][1]])), b['kind']) for b in js['bonds']}
    mb = {(frozenset((a, b)), k) for a, b, _, k in bonds}
    check('JS の結び17本と、組・種類（crease/hinge）が一致', jb == mb, f'JSだけ {len(jb - mb)}・こちらだけ {len(mb - jb)}')


# ================================================================ 2. 運動（剛体の回転の合成・厳密）
u = sp.Symbol('u', positive=True)          # u = tan(θ/2)、θ＝花弁の回転角（P'→P の軸まわり）
C67 = s / 2                                 # cos67.5°
w = C67 * u                                 # w = tan(φ/2)（連動式 tan(φ/2) = cos67.5°·tan(θ/2)）


def V(*a):
    return sp.Matrix(a)


def P3(n):
    x, y = MAT[n] if n in ('O',) else BASE[n]
    return V(x, y, 0)


BASE = {'O': (0, 0), 'Q': (-1, 1), 'A': (-1, 0), 'B': (0, 1), 'P': (0, s**2), "P'": (-s**2, 0), 'M': (-s**2 / 2, s**2 / 2)}
KP = V(R2 / 2, R2 / 2, 0)                                   # 単位ベクトル P'→P
KQ = V(-1, 1 - s**2, 0) * INV_S * R2 / 2                    # 単位ベクトル P→Q（|Q-P| = s√2）
KQL = V(-1 + s**2, 1, 0) * INV_S * R2 / 2                   # 単位ベクトル P'→Q


def rot_n(k, t, v):
    """(1+t^2)·R(k, 2atan t)·v（ロドリゲス・分母を払った形）"""
    return v * (1 - t**2) + k.cross(v) * 2 * t + k * (k.dot(v)) * 2 * t**2


def model(sig):
    """sig = (sθ, s1R, s3R, s1L, s3L)。返すのは 素材の点 → (1+u^2)(1+w^2)·3D位置 の関数（面ごと）"""
    st, s1, s3, s1l, s3l = sig
    Dp, Dk = 1 + u**2, 1 + w**2
    P, Pl = P3('P'), P3("P'")

    def fx(name):
        def base3(mp):
            x, y = place2(name, MAT[mp]); return V(x, y, 0)
        role = FACES[name][3]
        if role == 'fixed':
            return lambda mp: base3(mp) * Dp * Dk
        if role == 'petal':
            return lambda mp: P * Dp * Dk + rot_n(KP, st * u, base3(mp) - P) * Dk
        if name == 'T1R':
            return lambda mp: P * Dp * Dk + rot_n(KP, st * u, rot_n(KQ, s1 * w, base3(mp) - P))
        if name == 'S2R':
            return lambda mp: P * Dp * Dk + rot_n(KQ, s3 * w, base3(mp) - P) * Dp
        if name == 'T1L':
            return lambda mp: P * Dp * Dk + rot_n(KP, st * u, (Pl - P) * Dk + rot_n(KQL, s1l * w, base3(mp) - Pl))
        if name == 'S2L':
            return lambda mp: Pl * Dp * Dk + rot_n(KQL, s3l * w, base3(mp) - Pl) * Dp
    return {k: fx(k) for k in FACES}


def zero(e):
    return red(e) == 0


def motion_exact(bonds):
    print('\n[2] 運動：結び・閉路・剛体（厳密）')
    # 符号の総当り：右の閉路（B が T1R と S2R で一致）・左の閉路（A が T1L と S2L で一致）
    close = {}
    for s1, s3 in itertools.product((1, -1), repeat=2):
        X = model((1, s1, s3, s1, s3))
        close[(s1, s3)] = all(zero(c) for c in (X['T1R']('B') - X['S2R']('B')))
    good = [k for k, v in close.items() if v]
    check('[厳密] 右の閉路（B が T1R と S2R で一致）が恒等的に閉じる符号の組は、θ>0 でちょうど1つ（T1R は花弁に対し +φ・S2R は止まる紙に対し -φ）', good == [(1, -1)], str(good))
    closeL = {}
    for s1, s3 in itertools.product((1, -1), repeat=2):
        X = model((1, 1, -1, s1, s3))
        closeL[(s1, s3)] = all(zero(c) for c in (X['T1L']('A') - X['S2L']('A')))
    goodL = [k for k, v in closeL.items() if v]
    check('[厳密] 左の閉路（A が T1L と S2L で一致）もちょうど1つ（鏡映なので符号が逆）', goodL == [(-1, 1)], str(goodL))
    return good, goodL


def branches_exact():
    """θ を固定したときの右の閉路の解を**全部**数える（厳密）。
       B の行き先は、T1R 側では「花弁とともに回った軸 k3 = R(θ)·kQ まわりの円」、S2R 側では「止まった軸 kQ まわりの円」。
       どちらも P 中心・半径 r=|B-P| の球の上で、平面 k·(X-P)=h（h=kQ·(B-P)、回転で不変）との交わり。
       2つの平面の交線と球の交点の個数＝解の個数（交点ごとに a1・a3 は 2π を法として1つ）：
         c = k2·k3 とおくと、交点は t^2 (1-c^2) = r^2 - 2h^2/(1+c) の解。
       ⇒ c=1（軸が一致）なら円が一致して解は連続体／判別 D=(1+c)r^2-2h^2 >0 なら2つ／=0 なら1つ。"""
    print('\n[3a] 枝の数え上げ（厳密）')
    Dp = 1 + u**2
    k3n = rot_n(KP, u, KQ)                         # (1+u^2)·k3
    cn = red(KQ.dot(k3n))                          # (1+u^2)·c
    th = sp.Symbol('theta')
    # c = cos^2β + sin^2β cosθ（β＝軸 P'→P と P→Q の角 112.5°）を確かめる：kP·kQ の2乗 = cos^2 67.5° = s^2/4
    kk = red(KP.dot(KQ)**2)
    check('[厳密] (kP·kQ)^2 = cos^2 67.5° = s^2/4', zero(kk - s**2 / 4))
    check('[厳密] c(θ) = cos^2β + sin^2β·cosθ（u で書くと (1+u^2)c = (1+u^2)s^2/4 + (1-s^2/4)(1-u^2)）', zero(cn - (Dp * s**2 / 4 + (1 - s**2 / 4) * (1 - u**2))))
    Bb = V(0, 1, 0) - P3('P')
    r2 = red(Bb.dot(Bb)); h = red(KQ.dot(Bb))
    # D·(1+u^2) = ((1+u^2)+cn) r^2 - 2h^2 (1+u^2)
    Dn = red((Dp + cn) * r2 - 2 * h**2 * Dp)
    # 1+c = (1+u^2+cn)/(1+u^2)。D=0 ⇔ 1+c = 2h^2/r^2
    lim = sp.Poly(Dn, u)
    check('[厳密] 判別 D·(1+u^2) は u の2次以下で、u^2 の係数が 0（＝θ→π で D→0：終点で2つの解が1つに合わさる）',
          lim.degree() <= 2 and zero(lim.coeff_monomial(u**2)), str(lim.degree()))
    sg, info = sign_on_positive(Dn, 'D')
    check('[厳密] θ∈(0,π) で D>0 ＝ 解はちょうど2つ（花弁折りの枝と、脇が折りたたまれたままの枝）', sg == 1, info)
    one_minus_c = red(Dp - cn)
    sg2, info2 = sign_on_positive(one_minus_c, '1-c')
    check('[厳密] θ∈(0,π) で c<1（軸が一致するのは θ=0 だけ＝そこだけ解が連続体：凧形の折りの枝）', sg2 == 1, info2)


def start_ring_checks():
    """厚み0の層の組合せ（t=0 の置き場で判定）：
       出発：動く面と面積で重なる止まった面は、ぜんぶ下の層（動く面は z>0 へ離れるので、上に紙があると突き抜ける）
       軸の一周：動く面が回る軸の線分に（内部またはふちで）触れる止まった面が、軸の層より上に無い
                （上にあると、軸のまわりを回る面がその紙を横切る）"""
    print('\n[4b0] 出発と軸の一周（層の組合せ）')
    base = {k: [tuple(map(float, place2(k, num(MAT[v])))) for v in FACES[k][0]] for k in FACES}
    bad = []
    for m in MOVING:
        for f in FACES:
            if FACES[f][3] == 'fixed' and clip_area(base[m], base[f]) > 1e-12 and FACES[f][2] >= FACES[m][2]:
                bad.append((m, f))
    check('出発：動く面6枚と面積で重なる止まった面は、ぜんぶ下の層', not bad, str(bad))
    axes = [('花弁 T2R', 'P', 'M', 3), ('花弁 T2L', "P'", 'M', 3), ('S2R', 'P', 'Q', 2), ('S2L', "P'", 'Q', 2)]
    bad = []
    for lab, a, b, lay in axes:
        A = tuple(map(float, num(BASE[a]))); Bq = tuple(map(float, num(BASE[b])))
        for f in FACES:
            if FACES[f][3] != 'fixed' or FACES[f][2] <= lay:
                continue
            lo, hi = seg_in_convex(A, Bq, base[f])
            if hi - lo > 1e-12:
                bad.append((lab, f))
    check('軸の一周：花弁の軸 P-M・P’-M（層3）と S2 の軸 P-Q・P’-Q（層2）に、それより上の止まった面が触れていない', not bad, str(bad))


def seg_in_convex(A, B, poly):
    """線分 A-B のうち凸多角形（ふち含む）に入る部分のパラメータ区間"""
    lo, hi = 0.0, 1.0
    sgn = 1 if area2(poly) > 0 else -1
    for i in range(len(poly)):
        p, q = poly[i], poly[(i + 1) % len(poly)]
        f = lambda X: sgn * ((q[0] - p[0]) * (X[1] - p[1]) - (q[1] - p[1]) * (X[0] - p[0]))
        fa, fb = f(A), f(B)
        if fa < -1e-12 and fb < -1e-12: return (0.0, 0.0)
        if fa < -1e-12: lo = max(lo, fa / (fa - fb))
        if fb < -1e-12: hi = min(hi, fa / (fa - fb))
    return (lo, hi)


def all_bonds_exact(sig, bonds):
    X = model(sig)
    bad = []
    for a, b, (p, q), _ in bonds:
        for mp in (p, q):
            if not all(zero(c) for c in (X[a](mp) - X[b](mp))):
                bad.append((a, b, mp))
    return bad


# ================================================================ 符号（u>0 で一定か）の厳密な判定
def sign_on_positive(expr, label):
    """expr(u,s)（多項式）の符号が u∈(0,∞) で一定かを調べる。
       手順：s を最小多項式で割る → u の冪を外す → ノルム N(u)=Res_s(expr, MIN) の正の根を区間で分離し、
       その根で expr（s は実の値）が 0 でないことを高精度で確かめる（0 でなければ別の共役の根）→ u=1 の符号。"""
    e = red(expr)
    if e == 0:
        return 0, 'identically 0'
    pe = sp.Poly(e, u)
    k = min(m[0] for m in pe.monoms())
    e = sp.expand(e / u**k)
    N = sp.Poly(sp.resultant(sp.Poly(e, s).as_expr(), MIN, s), u).sqf_part()   # 重根を外す（区間の分離は無平方で）
    genuine = 0
    roots = [(lo, hi) for (lo, hi), mult in N.intervals(eps=sp.Rational(1, 10**30)) if hi > 0]
    for lo, hi in roots:
        mid = (lo + hi) / 2
        val = sp.N(e.subs({u: mid, s: S0}), 40)
        scale = sp.N(sum(abs(c) for c in sp.Poly(e.subs(s, S0), u).all_coeffs()) * (1 + abs(mid))**pe.degree(), 40)
        if abs(val) < scale * sp.Rational(1, 10**20):
            genuine += 1
    sg = sp.sign(sp.N(e.subs({u: 1, s: S0}), 40))
    return (int(sg) if genuine == 0 else None), f'ノルムの正の根 {len(roots)}個・本物 {genuine}個'


def nonpenetration_exact(sig):
    print('\n[4b] 非貫通（閉路・境界とは別に：符号の条件を u=tan(θ/2)∈(0,∞) で厳密に）')
    X = model(sig)
    z = lambda f, mp: X[f](mp)[2]
    res = {}
    # (i)(ii) 動く面の頂点の高さ
    for lab, e in [('Q3 の高さ z>0（花弁の先）', z('T2R', 'Q3')), ('B の高さ z>0（T1R・S2R の共有点）', z('S2R', 'B')), ("A の高さ z>0（左の共有点）", z('S2L', 'A'))]:
        sg, info = sign_on_positive(e, lab); res[lab] = sg
        check('[厳密] ' + lab, sg == 1, info)
    # 対称面（O と Q を通る鉛直面）：法線 (1,1,0)。右側＝ x+y>0
    for lab, e, want in [('B は対称面の右側（x+y>0）', X['S2R']('B')[0] + X['S2R']('B')[1], 1),
                         ('A は対称面の左側（x+y<0）', X['S2L']('A')[0] + X['S2L']('A')[1], -1)]:
        sg, info = sign_on_positive(e, lab); check('[厳密] ' + lab, sg == want, info)
    # 花弁の面の平面：P を通り、法線 nP = R(θ)·(0,0,1)
    nP = rot_n(KP, sig[0] * u, V(0, 0, 1))
    Dp, Dk = 1 + u**2, 1 + w**2
    Pn = P3('P') * Dp * Dk
    dist = lambda Xs: nP.dot(Xs - Pn)
    dQ2 = dist(X['S2R']('Q2R'))
    sgQ2, info = sign_on_positive(dQ2, 'Q2')
    check('[厳密] 止まる Q（2枚目の角）は花弁の平面の片側（こちらを「花弁の下」と呼ぶ）', sgQ2 in (1, -1), info)
    for lab, e in [('B（T1R・S2R）は花弁の下', dist(X['S2R']('B'))), ('A（T1L・S2L）は花弁の下', dist(X['S2L']('A')))]:
        sg, info = sign_on_positive(e, lab); check('[厳密] ' + lab, sg == sgQ2, info)
    # 辺を共有する2枚：相手の平面から、残りの頂点が離れている（二面角が 0 でも 2π でもない）
    def plane_dist(f, g, gp):
        a, b, c = [X[f](m) for m in FACES[f][0]]
        n = (b - a).cross(c - a)
        return n.dot(X[g](gp) - a)
    for lab, f, g, gp in [('T1R の Q3 は S2R の平面の外（P-B で二面角≠0）', 'S2R', 'T1R', 'Q3'),
                          ('S2R の Q2 は T1R の平面の外（同上）', 'T1R', 'S2R', 'Q2R'),
                          ('T1R の B は花弁の平面の外（P-Q3 で二面角≠0）', 'T2R', 'T1R', 'B')]:
        sg, info = sign_on_positive(plane_dist(f, g, gp), lab); check('[厳密] ' + lab, sg in (1, -1), info)
    return


def end_stack_exact(sig):
    """終端（θ→π）の上下を、面積が正の重なり領域ぜんぶについて求める。
       ★終端の位置と、高さの1次の係数を厳密に出す：位置 = N(u)/D(u)（D=(1+u^2)(1+w^2) は u の4次）。
         xy の極限 = N の u^4 の係数 / D の最高次係数。z は u^4 の係数が 0 で、z ≈ a1·(1/u)（1/u = tan(ε/2) > 0、ε=π-θ）。
         a1 は剛体運動の1次の項なので、面の上で素材の点について1次（アフィン）＝終端の置き場の (x,y) についてもアフィン。
         同じ (x,y) での2枚の高さの差は a1_A - a1_B + O(ε^2)（xy のずれは O(ε)・傾きも O(ε)）＝ a1 の差の符号で上下が決まる。
       ★領域：全部の面の終端の辺で平面を切った区画（shapely・浮動小数）。区画は各面の完全に内か外。
         区画ごとに：止まる面どうし＝初めの層（動かない）／動く面と止まる面＝動く面が上（[4b] z>0 の厳密な証明）／
         動く面どうし＝a1 の差を区画の全頂点と内部の点で評価し、狭義に逆の符号が混ざらないこと（＝区画の中で順序が変わらない）。
       ★stack は結果（検算値）。全区画の「上」の関係に閉路が無いこと、数値（[4d] の ε）と一致することを別に見る。"""
    print('\n[4e] 終端の上下：面積が正の重なり領域ぜんぶ（位置と高さの1次の係数は厳密・区画分けは浮動小数）')
    from shapely.geometry import Polygon, LineString, Point
    from shapely.ops import unary_union, polygonize
    X = model(sig)
    Dall = sp.Poly(red(sp.expand((1 + u**2) * (1 + w**2))), u)
    LC = Dall.LC()
    assert Dall.degree() == 4
    fin, a1, det = {}, {}, {}
    ok_z = True
    for k, (vs, q, lay, role) in FACES.items():
        pts, hs = [], []
        for mp in vs:
            p = X[k](mp)
            nx, ny, nz = [sp.Poly(red(c), u) for c in p]
            if nz.degree() >= 4 and not zero(nz.coeff_monomial(u**4)):
                ok_z = False
            xy = tuple(sp.nsimplify(0) + red(n.coeff_monomial(u**4) * INV_LC(LC)) for n in (nx, ny))
            pts.append(xy)
            hs.append(red(nz.coeff_monomial(u**3) * INV_LC(LC)))
        fin[k] = pts; a1[k] = hs
        fn = [num(p) for p in pts]; mn = [num(MAT[v]) for v in vs]
        det[k] = int(np.sign(area2(fn)) * np.sign(area2(mn)))
    check('[厳密] 終端で全頂点の z→0（u^4 の係数が0）', ok_z)
    # 区画
    polys = {k: Polygon([num(p) for p in fin[k]]) for k in FACES}
    lines = unary_union([LineString(list(pg.exterior.coords)) for pg in polys.values()])
    cells = [c for c in polygonize(lines) if c.area > 1e-9]
    area_sum = unary_union(list(polys.values())).area
    check('区画の面積の和＝終端の紙の輪郭の面積（取りこぼしなし）', abs(sum(c.area for c in cells) - area_sum) < 1e-9, f'{sum(c.area for c in cells):.12f} / {area_sum:.12f}')

    def a1_at(k, xy):
        (x0, y0), (x1, y1), (x2, y2) = [num(p) for p in fin[k]]
        h = [float(sp.N(v.subs(s, S0), 30)) for v in a1[k]]
        M = np.array([[x1 - x0, x2 - x0], [y1 - y0, y2 - y0]])
        l1, l2 = np.linalg.solve(M, np.array([xy[0] - x0, xy[1] - y0]))
        return h[0] + l1 * (h[1] - h[0]) + l2 * (h[2] - h[0])
    above = {}          # (A,B) → A が上、の証拠となる区画
    conflicts = []
    stacks = []
    for c in cells:
        rp = c.representative_point()
        on = [k for k in FACES if polys[k].buffer(-1e-9).contains(rp)]
        probe = [tuple(xy) for xy in list(c.exterior.coords)[:-1]] + [(rp.x, rp.y)]

        def cmp(A, B):
            fa, fb = FACES[A][3] == 'fixed', FACES[B][3] == 'fixed'
            if fa and fb:
                return FACES[A][2] - FACES[B][2]
            if fb:
                return 1 if a1_at(A, (rp.x, rp.y)) > 1e-12 else 0
            if fa:
                return -1 if a1_at(B, (rp.x, rp.y)) > 1e-12 else 0
            d = [a1_at(A, xy) - a1_at(B, xy) for xy in probe]
            pos = any(v > 1e-12 for v in d); neg = any(v < -1e-12 for v in d)
            if pos and neg:
                conflicts.append((A, B, c.area))
                return 0
            return 1 if pos else (-1 if neg else 0)
        import functools
        undecided = [(A, B) for A, B in itertools.combinations(on, 2) if cmp(A, B) == 0]
        if undecided:
            conflicts.append(('未決', undecided, c.area))
        order = sorted(on, key=functools.cmp_to_key(lambda A, B: -cmp(A, B)))
        for i in range(len(order)):
            for j in range(i + 1, len(order)):
                above.setdefault((order[i], order[j]), 0); above[(order[i], order[j])] += 1
        stacks.append((order, c))
    check('どの区画でも2枚の上下が決まり、区画の中で順序が変わらない（a1 の差に逆の符号が混ざらない）', not conflicts, str(conflicts[:3]))
    contra = [(a, b) for (a, b) in above if (b, a) in above]
    check('区画をまたいで「A が上」と「B が上」が両方出る組が無い', not contra, str(contra[:3]))
    # 閉路（全体の順序が付くか）
    import graphlib
    ts = graphlib.TopologicalSorter()
    for (a, b) in above:
        ts.add(b, a)
    try:
        glob = list(ts.static_order()); cyc = None      # ts.add(下, 上)＝上が先に出る＝上から順
    except graphlib.CycleError as e:
        glob = None; cyc = e.args[1]
    check('「上」の関係に閉路が無い（全体を1列に並べられる）', glob is not None, str(cyc))
    # まとめて表示（同じ積み順の区画をまとめる）
    groups = {}
    for order, c in stacks:
        key = tuple(order)
        groups.setdefault(key, []).append(c)
    side = lambda k: '表' if det[k] > 0 else '裏'
    print(f'    区画 {len(cells)}個 → 積み順 {len(groups)}通り（上から。表/裏＝素材の +z 面が上か）')
    for key, cs in sorted(groups.items(), key=lambda kv: -sum(c.area for c in kv[1])):
        ar = sum(c.area for c in cs)
        ctr = unary_union(cs).representative_point()
        print(f'      面積 {ar:.4f}（例 ({ctr.x:.2f},{ctr.y:.2f})）：' + ' > '.join(f'{k}{side(k)}' for k in key))
    # 動く面どうしの上下の式（花弁と一番上の層の脇）
    for A, B in [('T1R', 'T2R'), ('T1L', 'T2L')]:
        pa = [num(p) for p in fin[A]]
        vals = [float(sp.N((a1[A][i] - a1[B][[v for v in FACES[B][0]].index(FACES[A][0][i])] if FACES[A][0][i] in FACES[B][0] else a1[A][i]).subs(s, S0), 20)) for i in range(3)]
        print(f'      {A} の頂点での a1：' + '・'.join(f'{FACES[A][0][i]} {float(sp.N(a1[A][i].subs(s, S0), 12)):.6f}' for i in range(3))
              + f'／{B}：' + '・'.join(f'{FACES[B][0][i]} {float(sp.N(a1[B][i].subs(s, S0), 12)):.6f}' for i in range(3)))
    # T1R と T2R は終端で同じ三角形 (Q',P,M) に重なる：対応する点（同じ終端の位置）での a1 の差を厳密に
    pairs_exact = []
    for A, B in [('T1R', 'T2R')]:
        ok_pair = True
        for i, pa in enumerate(fin[A]):
            j = next((j for j, pb in enumerate(fin[B]) if all(zero(sp.expand(ca - cb)) for ca, cb in zip(pa, pb))), None)
            if j is None:
                ok_pair = False; continue
            dlt = red(a1[A][i] - a1[B][j])
            pairs_exact.append((FACES[A][0][i], FACES[B][0][j], dlt))
        signs = [int(sp.sign(sp.N(d.subs(s, S0), 30))) for _, _, d in pairs_exact]
        print('      [厳密] 終端で重なる T1R と T2R の頂点ごとの a1 の差（T1R−T2R）：' + '・'.join(f'{a}/{b} = {sp.nsimplify(d)} ≈ {float(sp.N(d.subs(s, S0))):.6f}' for a, b, d in pairs_exact))
        check('[厳密] T1R−T2R の a1 の差は、3頂点で ≧0 かつ 0 でない頂点がある（1次の関数なので三角形の内部で >0＝脇が花弁の上）',
              ok_pair and all(g >= 0 for g in signs) and any(g > 0 for g in signs), str(signs) + ('' if ok_pair else '・終端で重なる頂点が見つからない'))
    # 紙のふち（素材で両端が原紙の同じ辺の上にある面の辺）の終端の位置と、見えているか（その面が隣の区画で一番上か）
    def top_at(xy):
        pt = Point(*xy)
        for order, c in stacks:
            if c.buffer(-1e-9).contains(pt):
                return order[0]
        return None
    print('    紙のふち（開口部）の終端の位置：')
    raw = []
    for k, (vs, q, lay, role) in FACES.items():
        for i in range(3):
            a, b = vs[i], vs[(i + 1) % 3]
            ma, mb = num(MAT[a]), num(MAT[b])
            if not any(abs(ma[t]) > 1 - 1e-12 and abs(mb[t]) > 1 - 1e-12 and ma[t] * mb[t] > 0 for t in (0, 1)):
                continue
            pa, pb = num(fin[k][i]), num(fin[k][(i + 1) % 3])
            mid = ((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2)
            d = (pb[0] - pa[0], pb[1] - pa[1]); L = math.hypot(*d); nrm = (-d[1] / L * 1e-4, d[0] / L * 1e-4)
            tops = {top_at((mid[0] + nrm[0], mid[1] + nrm[1])), top_at((mid[0] - nrm[0], mid[1] - nrm[1]))}
            vis = k in tops
            raw.append((k, a, b, pa, pb, vis))
            print(f'      {k} の {a}-{b}：({pa[0]:.3f},{pa[1]:.3f})-({pb[0]:.3f},{pb[1]:.3f})  ' + ('見える（その面が一番上）' if vis else '隠れる'))
    return dict(order=glob, groups=groups, det=det, fin=fin, polys=polys, raw=raw, above=above)


def INV_LC(lc):
    """最高次係数の逆数（Q(s) の元）"""
    lc = red(lc)
    if not lc.has(s):
        return 1 / lc
    a, b, c, d = sp.symbols('a b c d')
    prod = red(sp.expand(lc * (a + b * s + c * s**2 + d * s**3)))
    sol = sp.solve([sp.Poly(prod, s).coeff_monomial(s**i) - (1 if i == 0 else 0) for i in range(4)], [a, b, c, d])
    return sol[a] + sol[b] * s + sol[c] * s**2 + sol[d] * s**3


def end_exact(sig):
    print('\n[4a] 終端（θ→π ＝ u→∞）の形：厳密な極限')
    X = model(sig)
    v = sp.Symbol('v', positive=True)
    ok = True
    want = {('T2R', 'Q3'): (1 - s**2, s**2 - 1), ('T1R', 'Q3'): (1 - s**2, s**2 - 1), ('T1R', 'B'): (-s**2 / 2, s**2 / 2),
            ('S2R', 'B'): (-s**2 / 2, s**2 / 2), ('S2R', 'Q2R'): (-1, 1), ('T1L', 'A'): (-s**2 / 2, s**2 / 2), ('S2L', 'A'): (-s**2 / 2, s**2 / 2)}
    Dall = (1 + u**2) * (1 + w**2)
    for (f, mp), (wx, wy) in want.items():
        p = X[f](mp)
        for c, target in zip(p, (wx, wy, 0)):
            # 分子・分母とも u の多項式：最高次の係数の比が極限
            nume = sp.Poly(red(c), u); den = sp.Poly(red(sp.expand(Dall)), u)
            if nume.degree() > den.degree():
                ok = False; continue
            lim = nume.coeff_monomial(u**den.degree()) / den.LC() if nume.degree() == den.degree() else 0
            if not zero(sp.numer(sp.together(lim - target)) if lim != 0 or target != 0 else 0):
                ok = False
    check("[厳密] 終端：花弁の先 Q3→Q'=(√2-1, 1-√2)・B と A→M・止まる Q はそのまま・z→0", ok)


# ================================================================ 3. 数値：独立に左右を解く・連続追跡・枝・端点
def rot_np(k, ang, v):
    k = np.asarray(k, float); v = np.asarray(v, float)
    return v * math.cos(ang) + np.cross(k, v) * math.sin(ang) + k * np.dot(k, v) * (1 - math.cos(ang))


def fnum(e):
    return float(sp.N(sp.sympify(e).subs(s, S0), 30))


PN = {k: np.array([fnum(x), fnum(y), 0.0]) for k, (x, y) in BASE.items()}
kP = np.array([fnum(c) for c in KP]); kQ = np.array([fnum(c) for c in KQ]); kQL = np.array([fnum(c) for c in KQL])
ALPHA = math.radians(67.5)


def side_solve(side, theta_guess, a1, a3, g, iters=50):
    """片側だけの閉路を、ほかの側を見ずに解く。
       右：未知 (θ, a1, a3)＝花弁を P'→P まわり θ・T1R を P→Q まわり a1（花弁の中）・S2R を P→Q まわり a3
       左：未知 (θ, a1, a3)＝花弁を **P→P'** まわり θ・T1L を P'→Q まわり a1・S2L を P'→Q まわり a3
       式：共有点（右 B・左 A）が両側の面で一致（3式）＋ 駆動 g＝花弁の先 Q3 の、対角の方向の位置（1式）"""
    if side == 'R':
        pivot, kpet, kk, shared = PN['P'], kP, kQ, PN['B']
    else:
        pivot, kpet, kk, shared = PN["P'"], -kP, kQL, PN['A']
    dQ = (PN['Q'] - PN['M']) / np.linalg.norm(PN['Q'] - PN['M'])

    def F(x):
        th, b1, b3 = x
        via3 = pivot + rot_np(kpet, th, rot_np(kk, b1, shared - pivot))
        via2 = pivot + rot_np(kk, b3, shared - pivot)
        q = PN['P'] + rot_np(kP if side == 'R' else -kP, th, PN['Q'] - PN['P']) if side == 'R' else PN["P'"] + rot_np(-kP, th, PN['Q'] - PN["P'"])
        return np.concatenate([via3 - via2, [np.dot(q - PN['M'], dQ) - g]])
    x = np.array([theta_guess, a1, a3], float)
    for _ in range(iters):
        f = F(x)
        J = np.zeros((4, 3)); h = 1e-7
        for i in range(3):
            d = np.zeros(3); d[i] = h; J[:, i] = (F(x + d) - F(x - d)) / (2 * h)
        dx = np.linalg.lstsq(J, -f, rcond=None)[0]
        x = x + dx
        if np.linalg.norm(dx) < 1e-15:
            break
    return x, float(np.abs(F(x)).max()), J


def numeric_tracking(sigR):
    print('\n[3] 数値：左右を別々に解く・連続追跡・枝・端点')
    L = float(np.linalg.norm(PN['Q'] - PN['M']))
    N = 1800
    xs = {'R': np.array([1e-3, sigR[1] * 1e-3 * math.cos(ALPHA), sigR[2] * 1e-3 * math.cos(ALPHA)]),
          'L': np.array([-1e-3, -sigR[1] * 1e-3 * math.cos(ALPHA), -sigR[2] * 1e-3 * math.cos(ALPHA)])}
    worst = {'res': 0.0, 'formula': 0.0, 'jump': 0.0, 'petal': 0.0, 'qm': 0.0}
    prev = None
    sv_min = []
    for i in range(1, N):
        th = math.pi * i / N
        g = L * math.cos(th)
        sols = {}
        for sd in ('R', 'L'):
            guess = xs[sd]
            x, r, J = side_solve(sd, guess[0], guess[1], guess[2], g)
            sols[sd] = x; xs[sd] = x
            worst['res'] = max(worst['res'], r)
            sv = np.linalg.svd(J[:3, 1:], compute_uv=False)
            sv_min.append((th, sd, sv[-1]))
        # 連動式との差（φ=2atan(cos67.5·tan(θ/2))）
        phi = 2 * math.atan(math.cos(ALPHA) * math.tan(th / 2))
        worst['formula'] = max(worst['formula'], abs(abs(sols['R'][0]) - th), abs(abs(sols['R'][1]) - phi), abs(abs(sols['R'][2]) - phi),
                               abs(abs(sols['L'][0]) - th), abs(abs(sols['L'][1]) - phi), abs(abs(sols['L'][2]) - phi))
        # 共通の面（花弁）：右の解の置き方と左の解の置き方
        RR = np.column_stack([rot_np(kP, sols['R'][0], e) for e in np.eye(3)])
        RL = np.column_stack([rot_np(-kP, sols['L'][0], e) for e in np.eye(3)])
        tR = PN['P'] - RR @ PN['P']; tL = PN["P'"] - RL @ PN["P'"]
        worst['petal'] = max(worst['petal'], float(np.abs(RR - RL).max()), float(np.abs(tR - tL).max()))
        # 花弁の2枚の結び Q3-M：T2R は右の解・T2L は左の解で置いて一致するか
        qR = PN['P'] + RR @ (PN['Q'] - PN['P']); qL = PN["P'"] + RL @ (PN['Q'] - PN["P'"])
        mR = PN['P'] + RR @ (PN['M'] - PN['P']); mL = PN["P'"] + RL @ (PN['M'] - PN["P'"])
        worst['qm'] = max(worst['qm'], float(np.linalg.norm(qR - qL)), float(np.linalg.norm(mR - mL)))
        if prev is not None:
            worst['jump'] = max(worst['jump'], float(np.abs(sols['R'] - prev).max()) * math.cos(ALPHA))
        prev = sols['R'].copy()
    check('[数値] 右・左を別々に解いた閉路の残差（1799コマ・0.1°きざみ）', worst['res'] < 1e-12, f"{worst['res']:.1e}")
    check('[数値] 別々に解いた角が連動式 tan(φ/2)=cos67.5°·tan(θ/2) と一致', worst['formula'] < 1e-9, f"{worst['formula']:.1e}")
    check('[数値] 共通の花弁の置き方（回転・平行移動）が左右の解で一致', worst['petal'] < 1e-12, f"{worst['petal']:.1e}")
    check('[数値] 花弁の2枚の結び Q3-M が左右の解で離れない', worst['qm'] < 1e-12, f"{worst['qm']:.1e}")
    check('[数値] 追跡で枝が飛ばない（隣のコマとの角の差×cos67.5° ≦ 0.1°＝式に頼らない上限：dφ/dθ≦1/cos67.5°）', worst['jump'] <= math.radians(0.1) * (1 + 1e-6), f"{math.degrees(worst['jump']):.5f}°")
    # 端点：θ→0 と θ→π で、閉路の式の (a1,a3) についてのヤコビアンが退化
    near0 = min(v for th, sd, v in sv_min if th < math.radians(1)); mid = min(v for th, sd, v in sv_min if abs(th - math.pi / 2) < 0.01)
    nearpi = min(v for th, sd, v in sv_min if th > math.radians(179))
    print(f'    閉路の式の (φ1,φ3) についての最小特異値：θ<1° {near0:.2e}／θ≈90° {mid:.3f}／θ>179° {nearpi:.2e}')
    check('[数値] 端点の近くで最小特異値→0（特異点）・途中は離れている', near0 < 1e-2 and nearpi < 1e-2 and mid > 0.1)
    # 枝：同じ θ で、ほかの初期値からは別の解へ落ちる
    th = math.radians(60); g = L * math.cos(th)
    other, r, _ = side_solve('R', th, math.pi - 0.05, math.pi - 0.05, g)
    print(f'    θ=60° の別の解：初期値 φ≈π → (θ,φ1,φ3)=({math.degrees(other[0]):.2f}°, {math.degrees(other[1]):.2f}°, {math.degrees(other[2]):.2f}°) 残差 {r:.1e}')
    check('[数値] θ=60° にほかの枝の解が実在する（φ1≡φ3≡π の「脇が折りたたまれたまま」の枝）',
          r < 1e-12 and abs(abs(math.remainder(other[1], 2 * math.pi)) - math.pi) < 1e-9 and abs(abs(math.remainder(other[2], 2 * math.pi)) - math.pi) < 1e-9)
    # θ=0 の枝：花弁が止まった紙に重なっているとき、軸 P-Q3 と P-Q2 は同じ直線＝ T1R と S2R は同じ角 ψ で一緒に起きても閉じる（⑦の凧形の折りそのもの）
    worst0 = 0.0
    for psi in np.linspace(-math.pi, math.pi, 73):
        via3 = PN['P'] + rot_np(kP, 0.0, rot_np(kQ, psi, PN['B'] - PN['P'])); via2 = PN['P'] + rot_np(kQ, psi, PN['B'] - PN['P'])
        worst0 = max(worst0, float(np.linalg.norm(via3 - via2)))
    check('[数値] θ=0 の枝（T1R と S2R が同じ角 ψ で一緒に起きる＝凧形の折り）も閉じる＝始点 (θ,φ)=(0,0) で花弁折りの枝と交わる', worst0 < 1e-12, f'{worst0:.1e}')
    return


def frames_numeric(sigR):
    """剛体の点検の補助（数値）：辺長・面積・結び・閉路・z・三角形どうしの交わり"""
    print('\n[4c] 補助（数値・1799コマ）：辺長・面積・結び・非貫通の総当り')

    def pose(th):
        phi = 2 * math.atan(math.cos(ALPHA) * math.tan(th / 2))
        out = {}
        for k, (vs, q, lay, role) in FACES.items():
            pts = []
            for mp in vs:
                b = np.array([*map(fnum, place2(k, MAT[mp])), 0.0]) if not isinstance(MAT[mp][0], float) else None
                b = np.array([fnum(place2(k, MAT[mp])[0]), fnum(place2(k, MAT[mp])[1]), 0.0])
                if role == 'fixed': x = b
                elif role == 'petal': x = PN['P'] + rot_np(kP, th, b - PN['P'])
                elif k == 'T1R': x = PN['P'] + rot_np(kP, th, rot_np(kQ, sigR[1] * phi, b - PN['P']))
                elif k == 'S2R': x = PN['P'] + rot_np(kQ, sigR[2] * phi, b - PN['P'])
                elif k == 'T1L': x = PN['P'] + rot_np(kP, th, PN["P'"] - PN['P'] + rot_np(kQL, -sigR[1] * phi, b - PN["P'"]))
                elif k == 'S2L': x = PN["P'"] + rot_np(kQL, -sigR[2] * phi, b - PN["P'"])
                pts.append(x)
            out[k] = pts
        return out
    matn = {k: [np.array(num(MAT[v])) for v in FACES[k][0]] for k in FACES}
    worst = dict(len=0.0, area=0.0, zmin=0.0, hit=0)
    hits = []
    for i in range(1, 1800):
        th = math.pi * i / 1800
        X = pose(th)
        for k in FACES:
            for a in range(3):
                l3 = np.linalg.norm(X[k][a] - X[k][(a + 1) % 3]); l2 = np.linalg.norm(matn[k][a] - matn[k][(a + 1) % 3])
                worst['len'] = max(worst['len'], abs(l3 - l2))
            a3 = 0.5 * np.linalg.norm(np.cross(X[k][1] - X[k][0], X[k][2] - X[k][0])); a2 = abs(area2([tuple(p) for p in matn[k]]))
            worst['area'] = max(worst['area'], abs(a3 - a2))
        for k in MOVING:
            worst['zmin'] = min(worst['zmin'], min(p[2] for p in X[k]))
        if i % 10 == 0:
            for a, b in itertools.combinations(FACES, 2):
                if FACES[a][3] == 'fixed' and FACES[b][3] == 'fixed':
                    continue
                r = tri_tri_crossing(X[a], X[b])
                if r:
                    worst['hit'] += 1; hits.append((round(math.degrees(th), 1), a, b, r))
    check('[数値] 辺長のずれ（剛体なので0のはず）', worst['len'] < 1e-12, f"{worst['len']:.1e}")
    check('[数値] 面積のずれ', worst['area'] < 1e-12, f"{worst['area']:.1e}")
    check('[数値] 動く面の頂点の z ≧ 0', worst['zmin'] > -1e-12, f"{worst['zmin']:.1e}")
    check('[数値・補助] 突き抜け（辺が相手の平面を横切り内部を通る）・途中の同一平面の重なり（180コマ・動く面を含む全組）＝0', worst['hit'] == 0, str(hits[:5]))
    # ⚠この総当りは「相手の紙の内部にある線を軸にして、その紙の反対側へ回り込む」形を見逃す（交わりが軸＝ふちの上だけになる）。
    #   その形は上の z≧0（止まる紙は z=0）と、[4b0] の出発・軸の一周で見ている（G331 で z≧0 だけが鳴ることを確認）。


def tri_tri_crossing(T, U, eps=1e-10):
    """厚み0の2枚が「突き抜ける」か（数値）：片方の辺が、もう片方の平面を**横切り**（両端が平面の反対側）、
       その交点が相手の三角形の**内部**（ふちから eps 以上内側）にある。
       平面に乗る辺・片側から触れるだけ（接触）は数えない。2枚が同一平面なら、xy の面積の重なりを別に返す。"""
    T = [np.asarray(p) for p in T]; U = [np.asarray(p) for p in U]

    def unit_normal(tri):
        n = np.cross(tri[1] - tri[0], tri[2] - tri[0]); return n / np.linalg.norm(n)
    for tri, other in ((T, U), (U, T)):
        n = unit_normal(tri); a, b, c = tri
        d = [float(np.dot(q - a, n)) for q in other]
        if max(abs(x) for x in d) < eps:
            return 'coplanar' if clip_area([tuple(p[:2]) for p in T], [tuple(p[:2]) for p in U]) > 1e-9 else None
        for i in range(3):
            p, q = other[i], other[(i + 1) % 3]; dp, dq = d[i], d[(i + 1) % 3]
            if not (dp > eps and dq < -eps or dp < -eps and dq > eps):
                continue
            x = p + dp / (dp - dq) * (q - p)
            s1 = np.dot(np.cross(b - a, x - a), n); s2 = np.dot(np.cross(c - b, x - b), n); s3 = np.dot(np.cross(a - c, x - c), n)
            if min(s1, s2, s3) > eps:
                return 'cross'
    return None


def end_layers_numeric(sigR):
    """終端の上下（数値）：θ=π-ε の高さで、終端で面積が重なる組の上下を決め、ε を変えても同じか見る"""
    print('\n[4d] 終端の上下（数値：θ=π-ε の高さ・ε=1e-2,1e-4,1e-6）')
    orders = []
    for eps in (1e-2, 1e-4, 1e-6):
        th = math.pi - eps
        phi = 2 * math.atan(math.cos(ALPHA) * math.tan(th / 2))
        X = {}
        for k, (vs, q, lay, role) in FACES.items():
            pts = []
            for mp in vs:
                b = np.array([fnum(place2(k, MAT[mp])[0]), fnum(place2(k, MAT[mp])[1]), 0.0])
                if role == 'fixed': x = b
                elif role == 'petal': x = PN['P'] + rot_np(kP, th, b - PN['P'])
                elif k == 'T1R': x = PN['P'] + rot_np(kP, th, rot_np(kQ, sigR[1] * phi, b - PN['P']))
                elif k == 'S2R': x = PN['P'] + rot_np(kQ, sigR[2] * phi, b - PN['P'])
                elif k == 'T1L': x = PN['P'] + rot_np(kP, th, PN["P'"] - PN['P'] + rot_np(kQL, -sigR[1] * phi, b - PN["P'"]))
                elif k == 'S2L': x = PN["P'"] + rot_np(kQL, -sigR[2] * phi, b - PN["P'"])
                pts.append(x)
            X[k] = pts
        pairs = {}
        for a, b in itertools.combinations(FACES, 2):
            A = [tuple(p[:2]) for p in X[a]]; B2 = [tuple(p[:2]) for p in X[b]]
            if clip_area(A, B2) < 1e-6: continue
            c = centroid_of_overlap(A, B2)
            za, zb = z_at(X[a], c), z_at(X[b], c)
            if abs(za - zb) < 1e-15:
                la, lb = FACES[a][2], FACES[b][2]
                pairs[(a, b)] = a if la > lb else b
            else:
                pairs[(a, b)] = a if za > zb else b
        orders.append(pairs)
        LAST_POSE['X'] = X
    check('[数値] 終端の重なる組の上下が ε によらず同じ', orders[0] == orders[1] == orders[2], f'{len(orders[2])}組')
    # 1点ごとの積み順（上から）
    fin = orders[2]
    X = LAST_POSE['X']
    stacks = {}
    for label, pt in [("O と Q' のあいだ（花弁の先の側）", (0.12, -0.1)), ('P の近く・P-P’の O 側', (-0.08, 0.45)), ('P の近く・P-P’の Q 側', (-0.1, 0.65)), ('Q の近く', (-0.8, 0.85))]:
        on = [k for k in FACES if inside2(pt, [tuple(p[:2]) for p in X[k]])]
        on.sort(key=lambda k: (-z_at(X[k], pt), -FACES[k][2]))
        stacks[label] = on
        print(f'    {label} {pt} 上から：' + ' > '.join(on))
    return fin, stacks


def inside2(pt, tri):
    s = [(tri[(i + 1) % 3][0] - tri[i][0]) * (pt[1] - tri[i][1]) - (tri[(i + 1) % 3][1] - tri[i][1]) * (pt[0] - tri[i][0]) for i in range(3)]
    return min(s) > 1e-9 or max(s) < -1e-9


LAST_POSE = {}


def centroid_of_overlap(A, B):
    # 交わりの多角形の重心（Sutherland–Hodgman を繰り返す簡易版）
    p = list(A)
    if area2(p) < 0: p = p[::-1]
    q = list(B)
    if area2(q) < 0: q = q[::-1]
    out = p
    for i in range(len(q)):
        a, b = q[i], q[(i + 1) % len(q)]
        inp, out = out, []
        side = lambda r: (b[0] - a[0]) * (r[1] - a[1]) - (b[1] - a[1]) * (r[0] - a[0])
        for j in range(len(inp)):
            c, d = inp[j], inp[(j + 1) % len(inp)]
            sc, sd = side(c), side(d)
            if sc >= 0: out.append(c)
            if (sc >= 0) != (sd >= 0):
                t = sc / (sc - sd); out.append((c[0] + t * (d[0] - c[0]), c[1] + t * (d[1] - c[1])))
    return (sum(x for x, _ in out) / len(out), sum(y for _, y in out) / len(out))


def z_at(tri, c):
    a, b, d = [np.asarray(p) for p in tri]
    M = np.array([[b[0] - a[0], d[0] - a[0]], [b[1] - a[1], d[1] - a[1]]])
    l = np.linalg.solve(M, np.array([c[0] - a[0], c[1] - a[1]]))
    return a[2] + l[0] * (b[2] - a[2]) + l[1] * (d[2] - a[2])


def main():
    bonds, table = material_checks()
    compare_js(bonds)
    good, goodL = motion_exact(bonds)
    branches_exact()
    sigR = None
    # 花弁が上へ（θ>0 で Q3 の z>0）・脇の三角も上へ、になる符号を選ぶ（非貫通の厳密な判定で確かめる）
    for s1, s3 in good:
        for s1l, s3l in goodL:
            sig = (1, s1, s3, s1l, s3l)
            X = model(sig)
            zB = red(X['S2R']('B')[2]); zA = red(X['S2L']('A')[2])
            if sp.N(zB.subs({u: 1, s: S0})) > 0 and sp.N(zA.subs({u: 1, s: S0})) > 0:
                sigR = sig
    check('脇の三角が上（z>0）へ起きる符号の組がちょうど1つに決まる', sigR is not None, str(sigR))
    if sigR is None:
        print('NG あり（閉じる運動が無いので、ここで止める）'); return 1
    bad = all_bonds_exact(sigR, bonds)
    check('[厳密] 17本の結びの両端が、全時刻で両側の面の上で一致', not bad, str(bad[:3]))
    if bad or good != [(1, -1)] or goodL != [(-1, 1)]:
        # 閉路か結びが崩れた運動に、終端の上下や非貫通を当てても意味が無い（前提が崩れている）＝検査の失敗として止める
        print('NG あり（閉路か結びが成り立たないので、終端・非貫通の検査は走らせない）'); return 1
    X = model(sigR)
    Dp, Dk = 1 + u**2, 1 + w**2
    orth = True
    for k in (KP, KQ, KQL):
        for e in (V(1, 0, 0), V(0, 1, 0), V(0, 0, 1)):
            for f in (V(1, 0, 0), V(0, 1, 0), V(0, 0, 1)):
                d = rot_n(k, u, e).dot(rot_n(k, u, f)) - (1 + u**2)**2 * e.dot(f)
                orth = orth and zero(d)
        orth = orth and zero(k.dot(k) - 1)
    check('[厳密] 回転は等長（軸は単位・R^T R = I）＝辺長・面積は定義上保たれる', orth)
    # 花弁が1枚の剛体であること：T2R は P-M、T2L は P'-M のまわりに回る。P・M・P' は一直線（同じ軸）で、
    # 共有する辺 Q3-M の Q3 は軸の外 ⇒ 両半分の角は等しい（等しくないと Q3 が2か所に分かれる）＝ Q3-M は平らなまま
    Pp, Mm, Pl = [V(*BASE[k], 0) for k in ('P', 'M', "P'")]
    check("[厳密] P・M・P' は一直線、Q は軸の外（花弁の2枚は同じ角で回るしかない＝1枚の剛体として数える）",
          all(zero(c) for c in (Pp - Mm).cross(Pl - Mm)) and not all(zero(c) for c in (Pp - Mm).cross(V(-1, 1, 0) - Mm)))
    # 左右の鏡映：対称面 x+y=0 の鏡映 σ(x,y,z)=(-y,-x,z)、素材の鏡映 τ(x,y)=(-y,-x)（Q3・O を固定し P↔P'・B↔A・Q2R↔Q2L）
    sig_m = lambda Xv: V(-Xv[1], -Xv[0], Xv[2])
    pairs = [('T2R', 'T2L'), ('T1R', 'T1L'), ('S2R', 'S2L'), ('T3R', 'T3L'), ('G2R', 'G2L')]
    swap = {'P': "P'", "P'": 'P', 'B': 'A', 'A': 'B', 'Q2R': 'Q2L', 'Q2L': 'Q2R', 'Q3': 'Q3', 'M': 'M', 'O': 'O'}
    mir = all(zero(c) for r, l in pairs for mp in FACES[r][0] for c in (sig_m(X[r](mp)) - X[l](swap[mp])))
    check('[厳密] 運動は全時刻で左右の鏡映に対して対称（右の面の像＝左の面）＝左の条件は右の条件から従う', mir)
    # 連動式の中身：P-B の二面角（T1R と S2R）の余弦 = cos θ ／ 花弁と T1R の折り角 = φ
    end_exact(sigR)
    ES = end_stack_exact(sigR)
    start_ring_checks()
    nonpenetration_exact(sigR)
    numeric_tracking(sigR)
    frames_numeric(sigR)
    numpairs, _ = end_layers_numeric(sigR)
    mism = [(a, b, t) for (a, b), t in numpairs.items() if (t, b if t == a else a) not in ES['above']]
    check('[数値↔厳密] θ=π-ε の高さで決めた重なる組の上下が、[4e] の a1 の符号で決めた上下と一致', not mism and len(numpairs) == len(ES['above']), f'不一致 {mism[:3]}・数値 {len(numpairs)}組・厳密 {len(ES["above"])}組')
    print('\n' + ('ALL OK' if OK else 'NG あり'))
    return 0 if OK else 1


def pose_numeric(th, sig=(1, 1, -1, -1, 1)):
    """検証モデルの座標（数値）：θ での14面の3D頂点。φ=2atan(cos67.5°·tan(θ/2))、θ=π は φ=π。"""
    phi = math.pi if th >= math.pi else 2 * math.atan(math.cos(ALPHA) * math.tan(th / 2))
    out = {}
    for k, (vs, q, lay, role) in FACES.items():
        pts = []
        for mp in vs:
            b = np.array([fnum(place2(k, MAT[mp])[0]), fnum(place2(k, MAT[mp])[1]), 0.0])
            if role == 'fixed': x = b
            elif role == 'petal': x = PN['P'] + rot_np(kP, th, b - PN['P'])
            elif k == 'T1R': x = PN['P'] + rot_np(kP, th, rot_np(kQ, sig[1] * phi, b - PN['P']))
            elif k == 'S2R': x = PN['P'] + rot_np(kQ, sig[2] * phi, b - PN['P'])
            elif k == 'T1L': x = PN['P'] + rot_np(kP, th, PN["P'"] - PN['P'] + rot_np(kQL, sig[3] * phi, b - PN["P'"]))
            elif k == 'S2L': x = PN["P'"] + rot_np(kQL, sig[4] * phi, b - PN["P'"])
            pts.append([float(c) for c in x])
        out[k] = pts
    return out


def write_preview_data(path):
    """独立プレビュー（petal_preview.html）が読むデータ。座標はこの検証モデルだけから作る（本体の JS は使わない）。
       同じ高さで重なる面の描き順（厚み0なので形だけでは決まらない）は、始点＝⑦の層、終点＝[4e] の計算結果の順。表示のためだけ。"""
    sig = (1, 1, -1, -1, 1)
    ES = end_stack_exact(sig)
    end_rank = {k: len(ES['order']) - i for i, k in enumerate(ES['order'])}
    frames = [pose_numeric(math.radians(d), sig) for d in range(0, 181)]
    data = {
        'note': 'python check_petal_fold.py --preview が書く。花弁折り（つる⑧⑨・1回目）の検証モデルの座標。0.5°でなく1°きざみ。',
        'faces': [{'id': k, 'material': [list(num(MAT[v])) for v in FACES[k][0]], 'vertexNames': FACES[k][0], 'role': FACES[k][3],
                   'startLayer': FACES[k][2], 'endRank': end_rank.get(k, 0)} for k in FACES],
        'thetaDeg': list(range(0, 181)),
        'frames': [[fr[k] for k in FACES] for fr in frames],
        'endOrderTopFirst': ES['order'],
        'linkage': 'tan(φ/2)=cos67.5°·tan(θ/2)',
    }
    Path(path).write_text('window.PETAL = ' + json.dumps(data, ensure_ascii=False) + ';\n', encoding='utf-8')


def write_format_example(path):
    """記録形式（op:'petal'）の実例を、この検証モデルの計算結果から作る（本体・保存形式は変えない＝見本のファイルだけ）。
       面の ID は JS の⑦の確定形（crane_step7_state.json）の faceId を、素材の形で突き合わせて引く。
       stack は袋折りと同じ「重なる領域の面を**下から**並べた配列」。[4e] の結果（検算値）をそのまま入れる。"""
    sig = (1, 1, -1, -1, 1)
    ES = end_stack_exact(sig)
    js = json.loads((HERE / 'crane_step7_state.json').read_text(encoding='utf-8'))

    def inv(xf, q):
        d = xf[0] * xf[3] - xf[1] * xf[2]; x, y = q[0] - xf[4], q[1] - xf[5]
        return ((xf[3] * x - xf[1] * y) / d, (-xf[2] * x + xf[0] * y) / d)
    key = lambda pts: frozenset((round(p[0], 8) + 0.0, round(p[1], 8) + 0.0) for p in pts)
    mine = {key([num(MAT[v]) for v in FACES[k][0]]): k for k in FACES}
    fid = {mine[key([inv(f['xf'], q) for q in f['poly']])]: f['faceId'] for f in js['faces']}
    P = [round(c, 12) + 0 for c in num(MAT['P'])]; Pl = [round(c, 12) + 0 for c in num(MAT["P'"])]
    pt = lambda n: [round(c, 12) + 0 for c in num(MAT[n])]
    stack = []
    for order, cs in sorted(ES['groups'].items(), key=lambda kv: -sum(c.area for c in kv[1])):
        if len(order) >= 2:
            stack.append([fid[k] for k in reversed(order)])
    step = {
        'id': 's9', 'diagramStep': '8-9', 'op': 'petal', 'instruction': 'はしを もちあげて ふくろを つくり、つぶす',
        'model': 'petal-rhombus-67.5',
        'base': {'faceId': fid['T2R']},
        'pivots': [P, Pl],
        'axes': [
            {'from': Pl, 'to': P, 'role': 'drive'},
            {'vertex': P, 'end': pt('Q3'), 'role': 'petal-kite'},
            {'vertex': P, 'end': pt('B'), 'role': 'side-hinge'},
            {'vertex': P, 'end': pt('Q2R'), 'role': 'fixed-kite'},
            {'vertex': P, 'end': pt('O'), 'role': 'fixed-fold'},
            {'vertex': Pl, 'end': pt('Q3'), 'role': 'petal-kite'},
            {'vertex': Pl, 'end': pt('A'), 'role': 'side-hinge'},
            {'vertex': Pl, 'end': pt('Q2L'), 'role': 'fixed-kite'},
            {'vertex': Pl, 'end': pt('O'), 'role': 'fixed-fold'},
        ],
        'branch': {'linkage': 'tan-half-cos67.5', 'name': 'petal', 'sideFold': 'toward-petal-underside', 'drive': {'fromDeg': 0, 'toDeg': 180}},
        'stack': stack,
    }
    Path(path).write_text(json.dumps({'note': 'python check_petal_fold.py --format-example が書く見本（未実装・保存形式は未変更）。つる⑦のあとの1回目の花弁折り。',
                                      'step': step, 'faceNames': {v: k for k, v in fid.items()}}, ensure_ascii=False, indent=1), encoding='utf-8')


def write_svg(path):
    """素材の図（1枚）：面の役割・折線（花弁折りで動く軸／止まったまま）・頂点・P と P' の周りの角"""
    S, cx, cy = 230, 300, 330
    X = lambda p: (cx + p[0] * S, cy - p[1] * S)
    col = {'petal': '#f4a6b8', 'side3': '#f7c173', 'side2': '#f3e58a', 'fixed': '#e4e6ea'}
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="690" viewBox="0 0 1180 690" font-family="Yu Gothic, Meiryo, sans-serif">',
           '<rect width="1180" height="690" fill="#fff"/>',
           '<text x="20" y="34" font-size="22" font-weight="bold">つる⑧⑨ 花弁折り：素材の図（原紙 [-1,1]²・右側と左側は対称）</text>']
    for k, (vs, q, lay, role) in FACES.items():
        pts = ' '.join('%.1f,%.1f' % X(num(MAT[v])) for v in vs)
        out.append(f'<polygon points="{pts}" fill="{col[role]}" stroke="none"/>')
    moving_axes = {frozenset(('P', 'M')): 'θ', frozenset(("P'", 'M')): 'θ', frozenset(('P', 'Q3')): 'φ₁', frozenset(("P'", 'Q3')): 'φ₁',
                   frozenset(('P', 'B')): 'P-B', frozenset(("P'", 'A')): "P'-A", frozenset(('P', 'Q2R')): 'φ₃', frozenset(("P'", 'Q2L')): 'φ₃'}
    seen = set()
    for a, b in itertools.combinations(FACES, 2):
        for e in edges(FACES[a][0]):
            if frozenset(e) in {frozenset(x) for x in edges(FACES[b][0])} and frozenset(e) not in seen:
                seen.add(frozenset(e))
                p, q = X(num(MAT[e[0]])), X(num(MAT[e[1]]))
                hinge = QUAD[FACES[a][1]] != QUAD[FACES[b][1]]
                if frozenset(e) in moving_axes:
                    out.append(f'<line x1="{p[0]:.1f}" y1="{p[1]:.1f}" x2="{q[0]:.1f}" y2="{q[1]:.1f}" stroke="#c0392b" stroke-width="4"{" stroke-dasharray=\"10 6\"" if not hinge else ""}/>')
                elif frozenset(e) == frozenset(('Q3', 'M')):
                    out.append(f'<line x1="{p[0]:.1f}" y1="{p[1]:.1f}" x2="{q[0]:.1f}" y2="{q[1]:.1f}" stroke="#7d3c98" stroke-width="2.5" stroke-dasharray="3 5"/>')
                else:
                    out.append(f'<line x1="{p[0]:.1f}" y1="{p[1]:.1f}" x2="{q[0]:.1f}" y2="{q[1]:.1f}" stroke="#777" stroke-width="1.6"{" stroke-dasharray=\"7 5\"" if not hinge else ""}/>')
    a0, a1 = X((-1, -1)), X((1, 1))
    out.append(f'<rect x="{a0[0]}" y="{a1[1]}" width="{2 * S}" height="{2 * S}" fill="none" stroke="#222" stroke-width="2.5"/>')
    # 面の名前
    names = {'T2R': '花弁 T2R', 'T2L': '花弁 T2L', 'T1R': 'T1R', 'T1L': 'T1L', 'S2R': 'S2R', 'S2L': 'S2L', 'T3R': 'T3R', 'T3L': 'T3L',
             'G2R': 'G2R', 'G2L': 'G2L', 'L1R': 'L1R 層1', 'L1L': 'L1L 層1', 'L0N': 'L0 層0', 'L0W': 'L0 層0'}
    for k, (vs, q, lay, role) in FACES.items():
        c = np.mean([num(MAT[v]) for v in vs], axis=0)
        if k in ('T3R', 'T3L'): c = c * 0.55                     # O 寄りへ（P・P' の角の数字と重ならないように）
        p = X(c)
        out.append(f'<text x="{p[0]:.1f}" y="{p[1] + 5:.1f}" font-size="13" text-anchor="middle" fill="#333">{names[k]}</text>')
    # 頂点
    lab = {'O': (-18, -8), 'P': (8, -10), "P'": (-30, 20), 'M': (8, 16), 'Q3': (8, 18), 'Q2R': (8, -6), 'Q2L': (-44, 18), 'B': (10, 5), 'A': (-6, 22)}
    for v, (dx, dy) in lab.items():
        p = X(num(MAT[v]))
        out.append(f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="4.5" fill="#111"/><text x="{p[0] + dx:.1f}" y="{p[1] + dy:.1f}" font-size="16" font-weight="bold">{v}</text>')
    # P と P' の周りの角
    def arcs(center, rays):
        c = num(MAT[center])
        for (d0, d1, txt, colr) in rays:
            r = 0.13 if abs(d1 - d0) < 100 else 0.10
            pts = [X((c[0] + r * math.cos(math.radians(d0 + (d1 - d0) * t / 20)), c[1] + r * math.sin(math.radians(d0 + (d1 - d0) * t / 20)))) for t in range(21)]
            out.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="2"/>' % (' '.join('%.1f,%.1f' % p for p in pts), colr))
            m = math.radians((d0 + d1) / 2); rr = 0.24
            p = X((c[0] + rr * math.cos(m), c[1] + rr * math.sin(m)))
            out.append(f'<text x="{p[0]:.1f}" y="{p[1] + 5:.1f}" font-size="12.5" text-anchor="middle" fill="{colr}" font-weight="bold">{txt}</text>')
    arcs('P', [(180, 225, '45', '#555'), (225, 292.5, '67.5', '#b03a5b'), (292.5, 360, '67.5', '#a0620a'), (0, 67.5, '67.5', '#8a7a00'), (67.5, 180, '112.5', '#555')])
    arcs("P'", [(45, 90, '45', '#555'), (-22.5, 45, '67.5', '#b03a5b'), (-90, -22.5, '67.5', '#a0620a'), (-157.5, -90, '67.5', '#8a7a00'), (90, 202.5, '112.5', '#555')])
    # 右の説明
    tx = 600
    lines = [
        ('■ 動く面（左右で6枚・花弁は1枚の剛体）', 17, True),
        ('桃：花弁 T2R+T2L（Q3-M は平らなまま）', 15, False),
        ('橙：一番上の層の脇 T1R・T1L', 15, False),
        ('黄：2枚目の脇 S2R・S2L', 15, False),
        ('灰：止まる紙（T3・G2・層1・層0）', 15, False),
        ('赤線＝花弁折りで角が変わる折線（破線は⑦までは平ら）', 15, False),
        ('灰線＝止まったまま（実線 180°・破線 平ら）', 15, False),
        ('紫点線＝Q3-M（花弁の中・平らなまま）', 15, False),
        ('', 8, False),
        ('■ 「67.5°ずつ」＝P を中心とする4本の軸の間の角', 17, True),
        ('P-M | 花弁 67.5 | P-Q3 | T1R 67.5 | P-B | S2R 67.5 | P-Q2', 15, False),
        ('残りの1辺＝止まる紙：G2R 112.5 から、P-O で 180°', 15, False),
        ('折り返した T3R 45 を引いた 67.5（112.5−45）', 15, False),
        ('＝辺が 67.5° の球面の菱形（袋折りは 45° の菱形）', 15, False),
        ("P の周り 45+67.5+67.5+67.5+112.5=360（P' は鏡映）", 15, False),
        ('M 90×4・Q3 22.5×4=90（紙の角）・B 90×2=180（紙のふち）', 15, False),
        ('', 8, False),
        ('■ 動く仕組み（1自由度）', 17, True),
        ("θ：花弁が P'-P まわり（駆動 0→180°）", 15, False),
        ('φ₁：T1R が花弁の中で P-Q3 まわり ＋φ', 15, False),
        ('φ₃：S2R が止まる紙の P-Q2 まわり −φ', 15, False),
        ('連動式  tan(φ/2) = cos67.5°·tan(θ/2)', 16, True),
        ('＝袋折りの式 tan(γ₁/2)tan(γ₂/2)=1/cosα の α=67.5°', 15, False),
        ('（内角は P-M で θ・P-Q で π−φ）', 15, False),
        ('', 8, False),
        ('■ 枝と端点', 17, True),
        ('0<θ<π：解はちょうど2つ＝花弁折り／脇が折りたたまれた枝', 15, False),
        ('θ=0：凧形の折り（T1R と S2R が一緒に起きる）と交わる', 15, False),
        ('θ=π：2つの解が合わさる（どちらも特異点）', 15, False),
    ]
    y = 70
    for t, fs, bold in lines:
        if t:
            out.append(f'<text x="{tx}" y="{y}" font-size="{fs}"{" font-weight=\"bold\"" if bold else ""}>{html.escape(t)}</text>')
        y += fs + 7
    out.append('</svg>')
    Path(path).write_text('\n'.join(out), encoding='utf-8')


if __name__ == '__main__':
    # 終了コード：0＝全部 ok／1＝検査が NG を出して最後まで走った／2＝検証コードの異常終了（例外）＝検査の合否ではない
    import traceback
    try:
        if '--svg' in sys.argv:
            write_svg(HERE / 'petal_fold_cp.svg'); print('wrote petal_fold_cp.svg')
            if '--only-svg' in sys.argv: sys.exit(0)
        if '--format-example' in sys.argv:
            write_format_example(HERE / 'petal_step_example.json'); print('wrote petal_step_example.json')
            if '--only-format' in sys.argv: sys.exit(0)
        if '--preview' in sys.argv:
            write_preview_data(HERE / 'petal_preview_data.js'); print('wrote petal_preview_data.js')
            if '--only-preview' in sys.argv: sys.exit(0)
        rc = main()
    except SystemExit:
        raise
    except BaseException:
        traceback.print_exc()
        print('ABORT 検証コードが例外で止まった（検査の合否ではない）')
        sys.exit(2)
    sys.exit(rc)
