# -*- coding: utf-8 -*-
"""袋折り（degree4-45-tsuru3）の**途中**（0<t<1）で、紙どうしが通り抜けないかを、角度のサンプリングに頼らず確かめる。

★なぜ厳密に言えるか（2つの言い換え）
   ① 8枚の区間はどれも三角形 (O, R_i の端, R_{i+1} の端) で、**頂点 O を全員が共有**している。
      三角形は O から見た向きの範囲（45°の平面角）の中のどの向きにも、O の近くから中身を持つ。
      ＝**2枚が O 以外で交わる ⇔ O から見た向きの範囲（単位球面上の弧）が交わる**。弧の問題に落ちる（厳密）。
   ② 連動式 tan(γ1/2)·tan(γ2/2)=√2 と駆動 ρ2=πt は、τ=tan(πt/4)（0→1）で**有理式**になる：
        c=sin(πt/2)=2τ/(1+τ²), s=cos(πt/2)=(1−τ²)/(1+τ²)
        cosρ2=s²−c², sinρ2=2sc ／ cosρ1=(2c²−s²)/(s²+2c²), sinρ1=2√2·cs/(s²+2c²)
      骨の木の回転を掛けた光線の向きは、τ と √2 の有理式。
      弧 pq と弧 rs の「交わる／接する／離れる」が変わるのは、4つの行列式 det(p,q,r), det(p,q,s), det(r,s,p), det(r,s,q)
      のどれかが 0 になる所だけ。→ **分子の多項式の (0,1) の実根を厳密に数える**（√2 を含むので共役との積＝ノルムで有理数係数へ）。
      根の無い区間では状態が一定＝区間の中の1点で調べれば区間ぜんぶ。**サンプル間の保証はこれで取る**（サンプリングは補助）。
   ③ 接する所（光線の上で面の辺が重なる・背を共有する）は、その光線を軸にした断面の「一周の順」で通り抜けを見る
      （fold_crossing.js と同じ考え）。一周の順が変わるのは面どうしが同一平面になる所だけ＝②の根で分かる。
   ④ 端点の出発・着地：t=0 で重なっている面は、0<t の小さい所で**層（LAYER_START）の順に離れる**か、
      t=1 の手前で **LAYER_END の順に着く**かを、高さの差の多項式の符号で見る（端点の平らな状態が正しくても、ここが逆なら端で通り抜ける）。

★厳密に保証した所／数値に頼る所（2026-09-14 に仕分け）
   厳密（記号）：輪が閉じる恒等式・止まっている光線（微分≡0）・背の共有（差≡0）・行列式が恒等的に0（分子の展開が0＝同一平面）
     ・行列式の (0,1) の根が0個（ノルムの有理係数多項式の CRootOf の個数。**(0,1) にノルムの根が1つも無かった＝80桁の「共役の根か」判定は結論に一度も効いていない**）
     ・τ=1/2 の弧の分類（4 の Q(√2) 厳密な符号で決め直し）・一部だけ≡0 の組の状態一定（端の一致か3本とも止まる、を記号で）
     ・端点の上下（共役の根も捨てない出来事の区間＋CRootOf との比較＋厳密な符号）。
   数値（補強前の判定・今は厳密の結果と一致を確認）：arc_state（50桁・許容1e-40）／endpoint_order（80桁で共役の根を捨てる・40桁の符号）。
   数値のまま：光線の上の一周の順（ring_at：50桁と atan2、角度は9桁で丸めて同一視。同じ角度になるのは z=0 の止まった面だけ＝角度0かπ）
     ／1999コマの浮動小数（補助）。
   接触：端の一致は記号の一致で決め「接する」と分類（交差と数えない）。通り抜けは弧の内部どうしの交差だけ。
   端点：τ=0,1 ちょうどの根（平らな状態）は外し、その隣は出来事の区間の内側の有理数点で符号を見る。

★共用できる範囲
   受理している16通り（表・裏返し・角の選び方）の運動は「Gᵀ ∘ このモデル ∘ D、高さ z はそのまま」（squash_v2.js・check_squash_flip.py）。
   D・G は平面の直交変換で z を変えない＝3D の等長変換（鏡映もふくむ）なので、交わり・接触・高さの上下はそのまま写る
   ＝**このモデル1本の結果が16通りに共用できる**。前提は「再生が本当にその写像を使っていること」（test_squash_flip.js が固定）。

★これが言わないこと
   ⛔ 厚みのある紙（層の数だけ回り込む余裕・折り目のずれ）。並びは厚み→0 の極限。
   ⛔ degree4-45-tsuru3 以外の袋折り。

使い方： python check_squash_motion.py
関連メモリ： [[project_freefold_ui]]
"""
import sys, json, itertools, time
from pathlib import Path
import sympy as sp

HERE = Path(__file__).resolve().parent
ok_all = True


def check(name, ok, extra=''):
    global ok_all
    ok_all = ok_all and bool(ok)
    print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''), flush=True)


tau = sp.symbols('tau', positive=True)
R2 = sp.sqrt(2)
c = 2 * tau / (1 + tau ** 2)
s = (1 - tau ** 2) / (1 + tau ** 2)
den = s ** 2 + 2 * c ** 2
COS = {0: sp.Integer(1), 6: sp.Integer(1), 5: sp.Integer(-1), 7: sp.Integer(-1),
       2: s ** 2 - c ** 2, 4: s ** 2 - c ** 2, 1: (2 * c ** 2 - s ** 2) / den, 3: (2 * c ** 2 - s ** 2) / den}
SIN = {0: sp.Integer(0), 6: sp.Integer(0), 5: sp.Integer(0), 7: sp.Integer(0),
       2: 2 * s * c, 4: 2 * s * c, 1: 2 * R2 * c * s / den, 3: 2 * R2 * c * s / den}
H = R2 / 2


def rx(k, sign=1):
    co, si = COS[k], sign * SIN[k]
    return sp.Matrix([[1, 0, 0], [0, co, -si], [0, si, co]])


def rz(sign=1):
    return sp.Matrix([[H, -sign * H, 0], [sign * H, H, 0], [0, 0, 1]])


def simp(M):
    return M.applyfunc(lambda e: sp.cancel(sp.together(e)))


print('光線の向きを τ の有理式で組んでいます…', flush=True)
T0 = time.time()
F = {1: rz(1)}
for i in (1, 2, 3, 4):
    F[i + 1] = simp(F[i] * rx(i) * rz(1))
F[0] = simp(F[1] * rz(-1) * rx(0, -1))
F['b7'] = simp(F[0] * rz(-1) * rx(7, -1))
F['b6'] = simp(F['b7'] * rz(-1) * rx(6, -1))
F['b5'] = simp(F['b6'] * rz(-1) * rx(5, -1))
U = {k: sp.Matrix([F[k][0, 0], F[k][1, 0], F[k][2, 0]]) for k in F}
RAY_OF = [('0', '1'), ('1', '2'), ('2', '3'), ('3', '4'), ('4', '5'), ('b5', 'b6'), ('b6', 'b7'), ('b7', '0')]
key = lambda k: int(k) if k.isdigit() else k
SECTOR_FACE = ['Q_E', 'P1', 'P2', 'P3', 'P4', 'Q_S', 'Q_S', 'Q_E']
LAYER_START = [0, 3, 3, 2, 2, 1, 1, 0]
LAYER_END = [0, 0, 3, 3, 2, 1, 1, 0]
print(f'  {time.time() - T0:.1f}s', flush=True)

# ---------- 0 モデルの確認（輪が閉じる・JS の squash_model と同じ数値・動かない面） ----------
gap = simp(U[5] - U['b5'])
check('輪が閉じる（枝A の R5 と枝B の R5 が τ の恒等式として一致）', all(sp.simplify(e) == 0 for e in gap))
js = json.loads((HERE / 'squash_motion_js.json').read_text(encoding='utf-8'))
worst = 0.0
import math
for fr in js['frames']:
    tv = math.tan(math.pi * fr['t'] / 4)
    for i, (a, b) in enumerate(RAY_OF):
        for vi, k in ((1, a), (2, b)):
            got = [float(e.subs(tau, tv)) for e in U[key(k)]]
            v = fr['panels'][i][vi]
            n = math.hypot(*v)
            worst = max(worst, max(abs(got[j] - v[j] / n) for j in range(3)))
check(f'τ の式が JS の squash_model.panels と一致（{len(js["frames"])}コマ）', worst < 1e-12, f'{worst:.2e}')
stationary = [k for k in ('0', 'b5', 'b6', 'b7', '4', '5') if all(sp.diff(e, tau) == 0 or sp.simplify(sp.diff(e, tau)) == 0 for e in U[key(k)])]
check('動かない光線＝R0・R4・R5・R6・R7（P4・Q_S・Q_E が止まっている）', sorted(stationary) == sorted(['0', 'b5', 'b6', 'b7', '4', '5']), str(stationary))
check('止まっている面は z=0 の平面（基準面）', all(sp.simplify(U[key(k)][2]) == 0 for k in stationary))


# ---------- 多項式の (0,1) の根（√2 を含む → ノルムで有理数係数） ----------
def numer(expr):
    n, _ = sp.fraction(sp.together(sp.expand(expr)))
    return sp.expand(n)


def roots_in_open01(expr):
    """expr（τ と √2 の有理式）の分子が (0,1) で 0 になる τ を、区間で返す。恒等的に 0 なら None。"""
    n = numer(expr)
    if n == 0:
        return None
    # n = A(τ) + √2·B(τ) に分ける
    nn = sp.expand(n)
    Bp = sp.expand((nn - nn.subs(R2, -R2)) / (2 * R2))
    Ap = sp.expand((nn + nn.subs(R2, -R2)) / 2)
    N = sp.Poly(sp.expand(Ap ** 2 - 2 * Bp ** 2), tau)
    if N.is_zero:
        return None
    out = []
    # 厳密な実根（CRootOf）で数える＝端の近く（0 や 1 のすぐ隣）の根も落とさない。0 と 1 ちょうどの根（平らな端点）だけを外す。
    for r in N.sqf_part().real_roots():  # 重根は1つに（ノルムは √2 の無い多項式で2乗になる）
        if not (r > 0 and r < 1):
            continue
        rv = sp.N(r, 80)
        # ノルムの根が、元の多項式（√2 の符号がそのまま）の根か（共役の側だけの根ではないか）
        val = sp.N(nn.subs(tau, rv), 80)
        scale = max(abs(sp.N(Ap.subs(tau, rv), 80)), abs(sp.N(Bp.subs(tau, rv), 80)), 1)
        if abs(val) < sp.Float('1e-30', 80) * scale:
            out.append((float(rv), float(rv)))
    return out


def det3(p, q, r):
    return sp.Matrix([list(p), list(q), list(r)]).T.det()


# ---------- 1 区間の組ぜんぶ：弧の交わり方を (0,1) で分類 ----------
def arc_state(p, q, r, s_, tv):
    """τ=tv（有理数）での弧 pq と弧 rs の関係を、50桁で判定：
       cross＝両方の弧の内部どうしで交わる／touch＝一方の端が他方の弧の上（端をふくむ）／coplanar＝同じ大円／apart＝交わらない。"""
    P = [sp.Matrix([sp.N(e.subs(tau, tv), 50) for e in v]) for v in (p, q, r, s_)]
    p1, q1, r1, s1 = P
    n1, n2 = p1.cross(q1), r1.cross(s1)
    eps = sp.Float('1e-40', 50)
    d = n1.cross(n2)
    if d.norm() < eps:
        return 'coplanar'
    on = lambda e, a, b, n: abs(e.dot(n)) < eps and a.cross(e).dot(n) >= -eps and e.cross(b).dot(n) >= -eps
    if any(on(e, r1, s1, n2) for e in (p1, q1)) or any(on(e, p1, q1, n1) for e in (r1, s1)):
        return 'touch'
    for x in (d, -d):
        in1 = p1.cross(x).dot(n1) > eps and x.cross(q1).dot(n1) > eps
        in2 = r1.cross(x).dot(n2) > eps and x.cross(s1).dot(n2) > eps
        if in1 and in2:
            return 'cross'
    return 'apart'


# ---------- S 道具の自己検査（自然な例では鳴らない所を、答えの分かっている合成入力で） ----------
_v = lambda x, y, z: sp.Matrix([x, y, z])
_ang = lambda deg: _v(sp.cos(sp.rad(deg)), sp.sin(sp.rad(deg)), 0)
_tilt = lambda deg, h: _v(sp.cos(sp.rad(deg)), sp.sin(sp.rad(deg)), h)
check('S 合成：交差する2本の弧を「交差」と分類', arc_state(_tilt(0, -1), _tilt(40, 1), _tilt(40, -1), _tilt(0, 1), 0) == 'cross')
check('S 合成：端が相手の弧に乗る弧を「接する」と分類', arc_state(_ang(0), _ang(45), _ang(20), _tilt(20, 1), 0) == 'touch')
check('S 合成：離れた弧を「離れている」と分類', arc_state(_ang(0), _ang(45), _ang(90), _ang(135), 0) == 'apart' or arc_state(_ang(0), _ang(45), _tilt(90, 1), _tilt(135, 1), 0) == 'apart')
check('S 合成：同じ大円の弧を「同一平面」と分類', arc_state(_ang(0), _ang(45), _ang(30), _ang(80), 0) == 'coplanar')
r_true = roots_in_open01(10 * tau - 5 - 3 * R2)       # 根 (5+3√2)/10 ≈ 0.924 は本物
r_conj = roots_in_open01(10 * tau - 5 + 3 * R2 + 6 * R2)  # 10τ−5+9√2 の根は負＝(0,1) に無い／共役 10τ−5−9√2 も (0,1) に無い
r_only_conj = roots_in_open01(10 * tau - 5 - 3 * R2 + 6 * R2)  # 10τ−5+3√2 の根 ≈0.0757 は本物、共役の根 ≈0.924 は偽物
r_near = roots_in_open01((tau - sp.Rational(1, 10 ** 12)) * (tau - 1 + sp.Rational(1, 10 ** 12)) * tau * (tau - 1))
check('S 合成：端のすぐ隣（1e-12）の根は拾い、0 と 1 ちょうどの根（平らな端点）は外す', len(r_near) == 2, str(r_near))
check('S 合成：√2 を含む多項式の本物の根を拾い、共役にしか無い根は拾わない',
      len(r_true) == 1 and abs(r_true[0][0] - 0.9243) < 1e-3 and r_conj == [] and len(r_only_conj) == 1 and abs(r_only_conj[0][0] - 0.0757) < 1e-3,
      f'{r_true} {r_conj} {r_only_conj}')

print('区間の組ごとに、4つの行列式の (0,1) の根を数えています…', flush=True)
pairs = []
T1 = time.time()
events = set()
table = []
for i, j in itertools.combinations(range(8), 2):
    if SECTOR_FACE[i] == SECTOR_FACE[j]:
        continue
    a, b = RAY_OF[i]; c_, d_ = RAY_OF[j]
    p, q, r, s_ = U[key(a)], U[key(b)], U[key(c_)], U[key(d_)]
    same = {(x, y) for x in (a, b) for y in (c_, d_) if all(sp.simplify(e) == 0 for e in simp(U[key(x)] - U[key(y)]))}
    dets = [det3(p, q, r), det3(p, q, s_), det3(r, s_, p), det3(r, s_, q)]
    info = []
    zero_all = True
    for D in dets:
        rr = roots_in_open01(D)
        if rr is None:
            info.append('≡0')
        else:
            zero_all = False
            info.append(f'根{len(rr)}')
            for lo, hi in rr:
                events.add(round((lo + hi) / 2, 9))
    table.append({'pair': (i, j), 'faces': (SECTOR_FACE[i], SECTOR_FACE[j]), 'shared': sorted(same), 'dets': info, 'zero_all': zero_all})
print(f'  {time.time() - T1:.1f}s  （組 {len(table)}）', flush=True)
check('行列式の (0,1) の根＝どの組でも0個（＝交わり方が t の途中で一度も変わらない）', not events, str(sorted(events)))

# 状態が一定なので、区間の中の1点（τ=1/2）で分類する
tv = sp.Rational(1, 2)
kinds = {}
for row in table:
    i, j = row['pair']; a, b = RAY_OF[i]; c_, d_ = RAY_OF[j]
    moving_i, moving_j = SECTOR_FACE[i] in ('P1', 'P2', 'P3'), SECTOR_FACE[j] in ('P1', 'P2', 'P3')
    st = arc_state(U[key(a)], U[key(b)], U[key(c_)], U[key(d_)], tv)
    if row['zero_all']:
        kind = '同一平面のまま（どちらも止まっている＝層の上下は t=0 のまま）' if not (moving_i or moving_j) else '★動く面が同一平面のまま'
    elif st == 'cross':
        kind = '★通り抜け（弧の内部どうしが交差）'
    elif st == 'touch':
        kind = '光線を共有（背を共有）' if row['shared'] and any(
            {x, y} <= set(RAY_OF[i]) | set(RAY_OF[j]) and abs(i - j) in (1, 7) for x, y in row['shared']) else '光線の上で接する（辺が別の面の辺・中の線に乗る）'
    elif st == 'coplanar':
        kind = '★τ=1/2 で同一平面'
    else:
        kind = '離れている（O 以外で交わらない）'
    row['kind'] = kind
    kinds.setdefault(kind, []).append(f"{row['faces'][0]}#{i}|{row['faces'][1]}#{j}")
for k, v in kinds.items():
    print(f'    {k}：{len(v)}組  {" ".join(v)}')
check('通り抜け（弧の交差）・動く面が同一平面のまま、の組は無い', not any('★' in k for k in kinds))


# ---------- 2 光線の上の接触：一周の順（厚み→0の並び） ----------
FACES = {'Q_E': [7, 0], 'P1': [1], 'P2': [2], 'P3': [3], 'P4': [4], 'Q_S': [5, 6]}
FACE_LAYER0 = {'Q_E': 0, 'Q_S': 1, 'P4': 2, 'P1': 3, 'P2': 3, 'P3': 2}
HINGES = [('Q_E', 'P1', '1'), ('P1', 'P2', '2'), ('P2', 'P3', '3'), ('P3', 'P4', '4'), ('P4', 'Q_S', '5'), ('Q_S', 'Q_E', 'b7')]


def ring_at(dkey, tv):
    """光線 dkey を軸にした断面の一周の順と弦（τ=tv）。止まっている面（z=0）は層で並べる。"""
    num = lambda v: sp.Matrix([sp.N(e.subs(tau, tv), 50) for e in v])
    d = num(U[key(dkey)])
    ez = sp.Matrix([0, 0, 1])
    x = ez.cross(d); x = x / x.norm(); y = d.cross(x)  # d が z=0 にあるとき y=+z
    rays = []
    for face, secs in FACES.items():
        for sidx in secs:
            a, b = RAY_OF[sidx]
            for here, other in ((a, b), (b, a)):
                if all(abs(e) < 1e-40 for e in num(U[key(here)]) - d):
                    w = num(U[key(other)])
                    ang = float(sp.atan2(w.dot(y), w.dot(x)))
                    rays.append((face, round(ang, 9)))
    # 同じ面・同じ向きの重複（Q_E の R0 のような面の中の光線）は1本にまとめ、面の中を通る光線は両側に出す
    uniq = {}
    for f, ang in rays:
        uniq.setdefault((f, ang), 0)
    rs = sorted(uniq)
    return rs


print('光線の上の接触（一周の順）を確かめています…', flush=True)
ok_ring = True
for dkey in ('1', '4', '2', '3'):
    rs = ring_at(dkey, sp.Rational(1, 2))
    # 一周の順：角度（-π,π]の昇順。同じ角度（同一平面）は層で並べる：角度 0 側は下→上、π 側は上→下
    def sort_key(r):
        f, ang = r
        base = ang if ang > -1e-9 else ang + 2 * 3.141592653589793
        lay = FACE_LAYER0[f]
        return (round(base, 6), lay if abs(base) < 1e-6 else -lay)
    order = sorted(rs, key=sort_key)
    names = [f for f, _ in order]
    chords = []
    pos = {}
    for idx, (f, ang) in enumerate(order):
        pos.setdefault(f, []).append(idx)
    for f, idxs in pos.items():
        if len(idxs) == 2:
            chords.append(tuple(idxs))  # 面の中を通る（両側に出る）
    dnum = [sp.N(e.subs(tau, sp.Rational(1, 2)), 50) for e in U[key(dkey)]]
    for fa, fb, hk in HINGES:
        hnum = [sp.N(e.subs(tau, sp.Rational(1, 2)), 50) for e in U[key(hk)]]
        if all(abs(hnum[k] - dnum[k]) < 1e-40 for k in range(3)) and fa in pos and fb in pos and len(pos[fa]) == 1 and len(pos[fb]) == 1:
            chords.append((pos[fa][0], pos[fb][0]))
    cross = [(c1, c2) for c1, c2 in itertools.combinations(chords, 2)
             if (min(c1) < min(c2) < max(c1) < max(c2)) or (min(c2) < min(c1) < max(c2) < max(c1))]
    print(f'    光線 R{dkey}：' + ' → '.join(f'{f}@{ang:+.3f}' for f, ang in order) + f'  弦{len(chords)} 交差{len(cross)}')
    ok_ring = ok_ring and not cross
    # 弦の数は構造の事実（R1＝背 Q_E–P1 と、同じ向きに重なった背 P4–Q_S／R4＝背 P3–P4 と、面の中を通る Q_E・Q_S／R2・R3＝背1本）
    want_chords = {'1': 2, '4': 3, '2': 1, '3': 1}[dkey]
    check(f'光線 R{dkey} の弦が {want_chords} 本（背・面の中を通る線を落としていない）', len(chords) == want_chords, str(len(chords)))
check('光線の上の接触（R1・R2・R3・R4）で一周の順が交差しない（行列式の根が無い＝(0,1) で順は一定）', ok_ring)


# ---------- 3 動く面は基準面より上（z>0）：出発・着地の上下（層）と合うか ----------
z2, z3 = U[2][2], U[3][2]
r2_, r3_ = roots_in_open01(z2), roots_in_open01(z3)
check('R2・R3 の端の高さ z は (0,1) で 0 にならない', r2_ == [] and r3_ == [], f'{r2_} {r3_}')
check('その符号は正（動く P1・P2・P3 は基準面の上側だけを通る）', float(z2.subs(tau, 0.5)) > 0 and float(z3.subs(tau, 0.5)) > 0)
check('t=0 の層：動く P1(3)・P2(3)・P3(2) は、重なる止まった面（Q_E0・Q_S1・P4 2）より上＝上へ離れて通り抜けない',
      all(LAYER_START[m] > LAYER_START[f] for m, f in [(1, 4), (1, 5), (1, 0), (2, 6), (2, 7), (3, 6), (3, 7)]))
check('t=1 の層：着く P3(3) は、重なる止まった面（Q_E0・Q_S1・P4 2）より上',
      all(LAYER_END[3] > LAYER_END[f] for f in (0, 4, 5)))


# 動く面どうしが端で重なる組：t=0 の P2/P3（重ねて折れた2枚が開く）・t=1 の P1/P2（開いた2枚が重なる）
def elevation_diff(i, j, psi_c, psi_s):
    """投影の向き ψ（cos,sin は有理数）で、区間 i と j の平面の「高さの傾き」の差。分母（面が立つ所）の根も返す。"""
    ns = []
    def slope(k):
        a, b = RAY_OF[k]
        n = U[key(a)].cross(U[key(b)])
        ns.append(n[2])
        return -(n[0] * psi_c + n[1] * psi_s) / n[2]
    e = sp.cancel(sp.together(slope(i) - slope(j)))
    return e, ns


def endpoint_order(i, j, pc, ps, at):
    """端（at=0 の直後／at=1 の直前）で、区間 i が区間 j より上か。
       比べてよいのは「投影の向き ψ が両方の面の中にあり、どちらの面も立っていない」区間だけ。
       その区間の端から最初の出来事（高さの差の根・面が立つ所・ψ が面の外へ出る所）までを、多項式の根で厳密に求め、その内側の1点で符号を見る。"""
    e, ns = elevation_diff(i, j, pc, ps)
    cz = lambda a, b: a[0] * b[1] - a[1] * b[0]
    psi = (pc, ps)
    polys = [e] + ns
    for k in (i, j):
        a, b = RAY_OF[k]
        pa, pb = U[key(a)], U[key(b)]
        polys += [cz(pa, psi), cz(psi, pb), cz(pa, pb)]
    evs = []
    for pol in polys:
        rr = roots_in_open01(pol)
        if rr:
            evs += [(lo + hi) / 2 for lo, hi in rr]
    first = min(evs) if (at == 0 and evs) else (max(evs) if evs else None)
    if at == 0:
        tv = sp.Rational(first).limit_denominator(10 ** 6) / 2 if first else sp.Rational(1, 2)
    else:
        tv = (1 + sp.Rational(first).limit_denominator(10 ** 6)) / 2 if first else sp.Rational(1, 2)
    num = lambda x: float(sp.N(x.subs(tau, tv), 40))
    inside = True
    for k in (i, j):
        a, b = RAY_OF[k]
        pa, pb = U[key(a)], U[key(b)]
        w = num(cz(pa, pb))
        inside = inside and num(cz(pa, psi)) * w > 0 and num(cz(psi, pb)) * w > 0
    return num(e), float(tv), first, inside


for label, (i, j), (pc, ps), at in [
    ('t=0 の直後：P2（層3）は P3（層2）より上＝重ねて折れた2枚が層の順に開く', (2, 3), (sp.Rational(4, 5), sp.Rational(-3, 5)), 0),
    ('t=1 の直前：P2（層3）は P1（層0）より上＝層の順に重なる', (2, 1), (sp.Rational(3, 5), sp.Rational(4, 5)), 1)]:
    val, tv, first, inside = endpoint_order(i, j, pc, ps, at)
    L = LAYER_START if at == 0 else LAYER_END
    want = (L[i] > L[j]) - (L[i] < L[j])  # 層の表が言う上下（期待値は表から読む＝表を書きかえたら鳴る）
    rng = f'(0, {first:.4f})' if at == 0 else f'({first:.4f}, 1)'
    check(label, want != 0 and (val > 0) == (want > 0) and inside, f'端から最初の出来事までの区間 {rng} の τ={tv:.4f} で 高さの差{val:+.3g}・層の差{L[i] - L[j]:+d}・ψ は両方の面の中={inside}')

# ---------- 4 厳密な補強（数値の判定に頼っていた所を、Q(√2) の厳密な符号で決め直す） ----------
# τ=1/2 では光線の成分がすべて a+b√2（a,b 有理数）になる。符号は a,b の符号と a²−2b² の比較で厳密に決まる。
def q2(e):
    e2 = sp.expand(sp.radsimp(sp.cancel(sp.together(e))))
    b = e2.coeff(R2)
    a = sp.expand(e2 - b * R2)
    if not (a.is_Rational and b.is_Rational):
        raise ValueError(f'Q(√2) の外: {e2}')
    return a, b


def sgn_exact(e):
    a, b = q2(e)
    sa, sb = int(sp.sign(a)), int(sp.sign(b))
    if sb == 0 or sa == sb:
        return sa if sa else sb
    if sa == 0:
        return sb
    return sa if a * a > 2 * b * b else (sb if a * a < 2 * b * b else 0)


def arc_state_exact(p, q, r, s_, tv):
    p1, q1, r1, s1 = [sp.Matrix([e.subs(tau, tv) for e in v]) for v in (p, q, r, s_)]
    n1, n2 = p1.cross(q1), r1.cross(s1)
    d = n1.cross(n2)
    if all(sgn_exact(e) == 0 for e in d):
        return 'coplanar'
    on = lambda e, a, b, n: sgn_exact(e.dot(n)) == 0 and sgn_exact(a.cross(e).dot(n)) >= 0 and sgn_exact(e.cross(b).dot(n)) >= 0
    if any(on(e, r1, s1, n2) for e in (p1, q1)) or any(on(e, p1, q1, n1) for e in (r1, s1)):
        return 'touch'
    for x in (d, -d):
        if min(sgn_exact(p1.cross(x).dot(n1)), sgn_exact(x.cross(q1).dot(n1)), sgn_exact(r1.cross(x).dot(n2)), sgn_exact(x.cross(s1).dot(n2))) > 0:
            return 'cross'
    return 'apart'


mism = []
for row in table:
    i, j = row['pair']; a, b = RAY_OF[i]; c_, d_ = RAY_OF[j]
    args = (U[key(a)], U[key(b)], U[key(c_)], U[key(d_)])
    ex, fl50 = arc_state_exact(*args, sp.Rational(1, 2)), arc_state(*args, sp.Rational(1, 2))
    row['exact'] = ex
    if ex != fl50 or ex == 'cross':
        mism.append((row['pair'], ex, fl50))
check('厳密：τ=1/2 の弧の分類を Q(√2) の厳密な符号で決め直しても、50桁の分類と同じ・交差0', not mism, str(mism))

# 一部の行列式だけ ≡0 の組：「端が相手の大円に乗ったまま」なので、端どうしが重なる／すれ違う出来事は4つの行列式の根に現れない。
# ここは「≡0 の行列式の3本の光線が、同じ光線（記号として一致）を含む」か「3本とも止まっている（τ で微分して恒等的に0）」なら、
# 大円の上での位置関係は τ に依らない＝状態一定、と言える。そうでない組があれば、根0 だけでは保証にならない。
is_const = lambda k: all(sp.simplify(sp.diff(e, tau)) == 0 for e in U[key(k)])
same_ray = lambda x, y: all(sp.simplify(e) == 0 for e in simp(U[key(x)] - U[key(y)]))
loose = []
for row in table:
    if row['zero_all'] or '≡0' not in row['dets']:
        continue
    i, j = row['pair']; a, b = RAY_OF[i]; c_, d_ = RAY_OF[j]
    for D, trio in zip(row['dets'], [(a, b, c_), (a, b, d_), (c_, d_, a), (c_, d_, b)]):
        if D != '≡0':
            continue
        e0, e1, pt = trio
        if not (same_ray(pt, e0) or same_ray(pt, e1) or all(is_const(k) for k in trio)):
            loose.append((row['pair'], trio))
check('厳密：一部だけ ≡0 の行列式は、端の一致（記号）か3本とも止まっている光線＝状態一定が根0 と合わせて言える', not loose, str(loose))

# 端点の出発・着地：出来事の区間を「ノルムの根ぜんぶ」（共役の根も捨てない＝80桁の判定を使わない）で取り直し、符号も厳密に。
def norm_roots_all(expr):
    n = numer(expr)
    if n == 0:
        return []
    nn = sp.expand(n)
    Bp = sp.expand((nn - nn.subs(R2, -R2)) / (2 * R2)); Ap = sp.expand((nn + nn.subs(R2, -R2)) / 2)
    N = sp.Poly(sp.expand(Ap ** 2 - 2 * Bp ** 2), tau)
    return [] if N.is_zero else [r for r in N.sqf_part().real_roots() if r > 0 and r < 1]


ep_bad = []
for (i, j), (pc, ps), at in [((2, 3), (sp.Rational(4, 5), sp.Rational(-3, 5)), 0), ((2, 1), (sp.Rational(3, 5), sp.Rational(4, 5)), 1)]:
    e, ns = elevation_diff(i, j, pc, ps)
    cz = lambda a, b: a[0] * b[1] - a[1] * b[0]
    psi = (pc, ps)
    polys = [e] + ns
    for k in (i, j):
        a, b = RAY_OF[k]
        polys += [cz(U[key(a)], psi), cz(psi, U[key(b)]), cz(U[key(a)], U[key(b)])]
    evs = [r for pol in polys for r in norm_roots_all(pol)]
    tv = sp.Rational(1, 2)
    if evs:
        edge = min(evs, key=lambda r: float(r)) if at == 0 else max(evs, key=lambda r: float(r))
        tv = (sp.Rational(float(edge)).limit_denominator(10 ** 6) + at) / 2
        # tv が端と最初の出来事のあいだにあることを厳密に（CRootOf との比較）
        if not all((tv < r) if at == 0 else (tv > r) for r in evs):
            ep_bad.append(('区間', (i, j)))
    L = LAYER_START if at == 0 else LAYER_END
    want = (L[i] > L[j]) - (L[i] < L[j])
    inside = all(sgn_exact(cz(U[key(RAY_OF[k][0])], psi).subs(tau, tv)) * sgn_exact(cz(U[key(RAY_OF[k][0])], U[key(RAY_OF[k][1])]).subs(tau, tv)) > 0
                 and sgn_exact(cz(psi, U[key(RAY_OF[k][1])]).subs(tau, tv)) * sgn_exact(cz(U[key(RAY_OF[k][0])], U[key(RAY_OF[k][1])]).subs(tau, tv)) > 0 for k in (i, j))
    if not (want != 0 and sgn_exact(e.subs(tau, tv)) == want and inside):
        ep_bad.append(((i, j), at, str(tv)))
check('厳密：端点の上下を、共役の根も捨てない出来事の区間と Q(√2) の厳密な符号で決め直しても層の表どおり', not ep_bad, str(ep_bad))


# ---------- 補助（保証ではない）：1999コマの浮動小数で、区間の組の分類が厳密な結果と食い違わないか ----------
import numpy as np
fl = {k: sp.lambdify(tau, list(U[k]), 'math') for k in U}
bad_frames = 0
for kf in range(1, 2000):
    tf = kf / 2000
    tvf = math.tan(math.pi * tf / 4)
    V = {k: np.array(fl[k](tvf), dtype=float) for k in U}
    for row in table:
        i, j = row['pair']
        if row['zero_all']:
            continue
        a, b = RAY_OF[i]; c2, d2 = RAY_OF[j]
        p1, q1, r1, s1 = V[key(a)], V[key(b)], V[key(c2)], V[key(d2)]
        n1, n2 = np.cross(p1, q1), np.cross(r1, s1)
        dd = np.cross(n1, n2)
        if np.linalg.norm(dd) < 1e-12:
            bad_frames += 1; continue
        for x in (dd, -dd):
            if np.dot(np.cross(p1, x), n1) > 1e-9 and np.dot(np.cross(x, q1), n1) > 1e-9 and np.dot(np.cross(r1, x), n2) > 1e-9 and np.dot(np.cross(x, s1), n2) > 1e-9:
                bad_frames += 1
check('補助：1999コマの浮動小数で、どの組も弧の内部どうしが交差しない（厳密な結果と同じ）', bad_frames == 0, f'{bad_frames}')

print('⛔ 厚みのある紙（回り込む余裕・折り目のずれ）は見ていない。degree4-45-tsuru3 のモデル1本（16通りは等長変換で共用）。')
print('ALL OK' if ok_all else 'NG あり')
sys.exit(0 if ok_all else 1)
