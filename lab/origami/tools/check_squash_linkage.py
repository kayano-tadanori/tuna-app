# -*- coding: utf-8 -*-
"""袋折り（つる③「ふくろを ひらいて つぶす」）の**連動式**を、板（剛体）のまま検証する。

★これは何を言う検査か
   4本の折線が同時に動く袋折りが、**紙を伸ばさずに（板のまま）折れるか**だけを見る。
   見ているのは頂点Oまわりの球面リンクの閉じ条件と、骨の木で置いた8枚の面のずれ。

★これが言わないこと（ここを混ぜない）
   ⛔ 紙どうしの貫通（すり抜け）は**一切見ていない**。
   ⛔ 全体の最終層順（動かない5枚の上下）は**決めていない**。厚み0なので同着になる。
   ⛔ 辺長・面積が0なのは面を剛体三角形として置いているから＝**定義上0**。
      実装（soft・メッシュ）の伸縮の証拠にはならない。そちらは別に測ること。
   ⛔ **閉路が閉じることだけで「物理的に折れる」とは言わない。** 貫通を見ていないため。
   ⛔ 既存 fold2d 系は**単一ヒンジの開きを通常の fold として再生できている**。
      未対応なのは今回の**複数軸を同時に動かす操作**のほう（→ check_squash_recipe.py の④）。

★使い方
   python check_squash_linkage.py
   → 相棒＝ test_squash_recipe.js（JSの再生器）／check_squash_recipe.py（Pythonの再生器）

関連メモリ： [[project_freefold_ui]] の 🧺／[[feedback_tsubushiori_2d_genkai]]
"""
import sys, math, itertools
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_tsuru_base as B          # ★EXPECT の出どころ（同じ折り図から読んだ姿）

PI = math.pi
ALPHA = math.radians(45.0)            # 面 P0..P7 の中心角（8枚とも45°）
RADIUS = [1.0, math.sqrt(2)] * 4      # R0=E:1 R1=NE:√2 R2=N:1 R3=NW:√2 ...
# 素材（原紙 [-1,1]^2）での各面の2頂点。P_i は 光線 R_i → R_{i+1} をまたぐ三角形。
MATERIAL = {0: ((1, 0), (1, 1)), 1: ((1, 1), (0, 1)), 2: ((0, 1), (-1, 1)),
            3: ((-1, 1), (-1, 0)), 4: ((-1, 0), (-1, -1)), 5: ((-1, -1), (0, -1)),
            6: ((0, -1), (1, -1)), 7: ((1, -1), (1, 0))}
# 骨の木（build_tsuru_base.BONE_PARENT と同じ）＝ P0 を根に2本の枝。
#   枝A： P0 →R1→ P1 →R2→ P2 →R3→ P3 →R4→ P4
#   枝B： P0 →R0→ P7 →R7→ P6 →R6→ P5
#   輪を閉じる最後の1本＝ R5（P4 と P5 のあいだ）。ここだけが「開くことがある」。
LOOP_RAY = 5


# ---------------------------------------------------------------- 幾何の芯
def rx(t):
    c, s = math.cos(t), math.sin(t)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rz(t):
    c, s = math.cos(t), math.sin(t)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def closure(rho):
    """頂点Oまわりの閉じ条件： Π_{i=0..7} Rx(ρ_i)·Rz(α) = I"""
    m = np.eye(3)
    for i in range(8):
        m = m @ rx(rho[i]) @ rz(ALPHA)
    return m


def closure_error(rho):
    return float(np.abs(closure(rho) - np.eye(3)).max())


def gamma1_of(gamma2, branch=0):
    """★連動式（安定形）  tan(γ1/2)·tan(γ2/2) = √2

    ⚠ 同じ式の arcsin 形
        cos e = ½(1+cos γ2),  γ1 = 2·arcsin( sin45°·sin γ2 / sin e )
      は γ2→0 で 0/0 になり、端点近傍で崩れる（下の負例②で固定してある）。
      atan2 形なら端点でも機械精度。
    """
    beta = math.atan2(math.sqrt(2) * math.cos(gamma2 / 2), math.sin(gamma2 / 2))
    return 2 * (PI - beta) if branch else 2 * beta


def gamma1_arcsin(gamma2):
    """負例②のための、崩れるほうの書きかた（本番では使わない）"""
    ce = 0.5 * (1 + math.cos(gamma2))
    e = math.acos(max(-1.0, min(1.0, ce)))
    if e < 1e-15:
        return PI
    return 2 * math.asin(max(-1.0, min(1.0, math.sin(ALPHA) * math.sin(gamma2) / math.sin(e))))


def rho_of(t, mode='atan2'):
    """駆動 t∈[0,1]：γ2（=γ4）を 180°→0° に振る。返すのは ρ[0..7]。

    角度の定義： ρ_i ＝ 光線 R_i の折り角（0=平ら／±π=完全に折れている）。γ_i = π − ρ_i。
    固定： ρ5 = ρ7 = +π（状態②で折れている2本）／ρ0 = ρ6 = 0（折れていない2本）。
    駆動： ρ2。従属： ρ4 = ρ2 と ρ1 = ρ3 = π − γ1(γ2)。
    符号： ρ1〜ρ4 は**全部同符号**（下の「符号の総当り」で固定）。
    """
    g2 = PI * (1 - t)
    rho = [0.0] * 8
    rho[5] = PI
    rho[7] = PI
    rho[2] = rho[4] = PI - g2
    if mode == 'atan2':
        g1 = gamma1_of(g2)
    elif mode == 'arcsin':
        g1 = gamma1_arcsin(g2)
    elif mode == 'linear':
        # 負例①＝いまの js/fold.js の連動（従属角 ρ1 を駆動角 ρ2 と比例で配分する）
        #   ρ1 = π − ρ2 を直線でたどる ⇔ γ1 = π − γ2
        g1 = PI - g2
    else:
        raise ValueError(mode)
    rho[1] = rho[3] = PI - g1
    return rho


def rays(rho):
    """骨の木で置いたときの、各光線の3D方向。輪の R5 だけ枝Aと枝Bの2つが出る。"""
    f = {1: rz(ALPHA)}                              # P0 の面を z=0 に置く／u1 が x 軸
    for i in (1, 2, 3, 4):                          # 枝A
        f[i + 1] = f[i] @ rx(rho[i]) @ rz(ALPHA)
    f[0] = f[1] @ rz(-ALPHA) @ rx(-rho[0])          # 枝B（後ろ向きに辿る）
    f['b7'] = f[0] @ rz(-ALPHA) @ rx(-rho[7])
    f['b6'] = f['b7'] @ rz(-ALPHA) @ rx(-rho[6])
    f['b5'] = f['b6'] @ rz(-ALPHA) @ rx(-rho[5])
    u = {i: f[i][:, 0] for i in (0, 1, 2, 3, 4, 5)}
    u['b7'], u['b6'], u['b5'] = f['b7'][:, 0], f['b6'][:, 0], f['b5'][:, 0]
    return u


def panels(rho):
    """各面の3頂点（O, R_i 側, R_{i+1} 側）。**面ごとに自分の枝の光線を使う**
       ＝輪の R5 だけ、P4 側と P5 側で別の点になりうる（それがすきま）。"""
    u = rays(rho)
    o = np.zeros(3)
    return {
        0: (o, RADIUS[0] * u[0], RADIUS[1] * u[1]),
        1: (o, RADIUS[1] * u[1], RADIUS[2] * u[2]),
        2: (o, RADIUS[2] * u[2], RADIUS[3] * u[3]),
        3: (o, RADIUS[3] * u[3], RADIUS[4] * u[4]),
        4: (o, RADIUS[4] * u[4], RADIUS[5] * u[5]),        # P4 の R5 ＝枝A
        5: (o, RADIUS[5] * u['b5'], RADIUS[6] * u['b6']),  # P5 の R5 ＝枝B
        6: (o, RADIUS[6] * u['b6'], RADIUS[7] * u['b7']),
        7: (o, RADIUS[7] * u['b7'], RADIUS[0] * u[0]),
    }


SHARED = {0: (7, 0), 1: (0, 1), 2: (1, 2), 3: (2, 3),
          4: (3, 4), 5: (4, 5), 6: (5, 6), 7: (6, 7)}


def measure(rho):
    """閉路残差／全共有境界のずれ／辺長の伸び／面積の誤差 を返す。"""
    pl = panels(rho)
    gaps = {k: float(np.linalg.norm(pl[a][2] - pl[b][1])) for k, (a, b) in SHARED.items()}
    stretch = area = 0.0
    for i in range(8):
        o3, p3, q3 = pl[i]
        (ax, ay), (bx, by) = MATERIAL[i]
        o2 = np.array([0.0, 0.0]); a2 = np.array([ax, ay], float); b2 = np.array([bx, by], float)
        for (u3, v3), (u2, v2) in (((o3, p3), (o2, a2)), ((o3, q3), (o2, b2)), ((p3, q3), (a2, b2))):
            l3 = float(np.linalg.norm(u3 - v3)); l2 = float(np.linalg.norm(u2 - v2))
            stretch = max(stretch, abs(l3 / l2 - 1))
        a3 = 0.5 * float(np.linalg.norm(np.cross(p3 - o3, q3 - o3)))
        a2d = 0.5 * abs(float((a2[0] - o2[0]) * (b2[1] - o2[1]) - (a2[1] - o2[1]) * (b2[0] - o2[0])))
        area = max(area, abs(a3 / a2d - 1))
    return closure_error(rho), gaps, stretch, area


def jac_singular(rho):
    """自由な4本（ρ1..ρ4）についての閉じ条件のヤコビアンの特異値。"""
    h = 1e-6
    cols = []
    for i in (1, 2, 3, 4):
        a = list(rho); b = list(rho)
        a[i] += h; b[i] -= h
        m = (closure(a) - closure(b)) / (2 * h)
        cols.append([m[2, 1], m[0, 2], m[1, 0]])
    return np.linalg.svd(np.array(cols).T, compute_uv=False)


# ---------------------------------------------------------------- 検査本体
TOL = 1e-9          # 閉路残差・共有境界・辺長・面積の許容（板なので機械精度で通るはず）
FRAMES = 1801       # 0.1°きざみ


def main():
    ok_all = True

    def check(name, ok, extra=''):
        nonlocal ok_all
        ok_all = ok_all and bool(ok)
        print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))

    print('■ 角度の定義')
    print('   ρ_i ＝ 光線 R_i の折り角（0=平ら／±π=完全に折れ）、γ_i = π − ρ_i、α = 45°')
    print('   閉じ条件 Π_{i=0..7} Rx(ρ_i)·Rz(α) = I')
    print('   固定 ρ5=ρ7=+π・ρ0=ρ6=0 ／ 駆動 ρ2 ／ 従属 ρ4=ρ2・ρ1=ρ3')
    print('   ★連動式  tan(γ1/2)·tan(γ2/2) = √2')
    print()

    # ---- ① 符号の総当り（混ざった符号では閉じない） ----
    g2 = math.radians(135.0)
    r1 = PI - gamma1_of(g2); r2 = PI - g2
    good = []
    for s in itertools.product([1, -1], repeat=6):
        rho = [0.0] * 8
        rho[5], rho[7] = s[0] * PI, s[1] * PI
        rho[1], rho[2], rho[3], rho[4] = s[2] * r1, s[3] * r2, s[4] * r1, s[5] * r2
        if closure_error(rho) < TOL:
            good.append(s)
    same_sign = all(s[2] == s[3] == s[4] == s[5] for s in good)
    check('符号：閉じるのは ρ1〜ρ4 が全部同符号の組だけ（32通り中%d組）' % len(good),
          same_sign and len(good) == 8)

    # ---- ② 分岐：arcsin のもう一方の枝は閉じない ----
    rho = [0.0] * 8
    rho[5] = rho[7] = PI
    rho[1] = rho[3] = PI - gamma1_of(g2, branch=1)
    rho[2] = rho[4] = r2
    other = closure_error(rho)
    check('分岐：γ1=2(π−β) の枝は閉じない（棄却できる）', other > 1e-3, '閉路残差 %.3e' % other)

    # ---- ③ 細かい刻み ----
    worst = {'閉路残差': 0.0, '共有境界・輪(R5)': 0.0, '共有境界・親子(7本)': 0.0,
             '辺長の伸び': 0.0, '面積の誤差': 0.0}
    for k in range(FRAMES):
        ce, gaps, st, ar = measure(rho_of(k / (FRAMES - 1)))
        worst['閉路残差'] = max(worst['閉路残差'], ce)
        worst['共有境界・輪(R5)'] = max(worst['共有境界・輪(R5)'], gaps[LOOP_RAY])
        worst['共有境界・親子(7本)'] = max(worst['共有境界・親子(7本)'],
                                          max(v for k2, v in gaps.items() if k2 != LOOP_RAY))
        worst['辺長の伸び'] = max(worst['辺長の伸び'], st)
        worst['面積の誤差'] = max(worst['面積の誤差'], ar)
    for name, v in worst.items():
        note = '（構成上ゼロ＝この7本は検査になっていない）' if '親子' in name else ''
        check('%dコマ通し %-18s 最大 %.3e%s' % (FRAMES, name, v, note), v < TOL)

    # ---- ④ 端点の特異値（両端は分岐点） ----
    for t, lab, want_rank in [(0.0, 'ρ2=0°（状態②）', 2), (0.5, 'ρ2=90°（途中）', 3),
                              (1.0, 'ρ2=180°（状態③）', 2)]:
        sv = jac_singular(rho_of(t))
        rank = int((sv > 1e-6).sum())
        check('特異値 %-16s %s → 階数%d・零空間%d' % (lab, np.round(sv, 6), rank, 4 - rank),
              rank == want_rank,
              '端点は分岐点＝素朴な数値追跡は別の枝へ滑る' if want_rank == 2 else '1自由度')

    # ---- ⑤ 端点近傍 ----
    bad = 0.0
    for eps_deg in (1e-1, 1e-2, 1e-3, 1e-4, 1e-6, 1e-8):
        for t in (eps_deg / 180.0, 1 - eps_deg / 180.0):
            ce, gaps, st, ar = measure(rho_of(t))
            bad = max(bad, ce, gaps[LOOP_RAY], st, ar)
    check('端点近傍 ε=1e-1〜1e-8°（両端・内側） 最大 %.3e' % bad, bad < TOL)

    # ---- ⑥ 往路と復路 ----
    fw = [rho_of(k / 900.0)[1] for k in range(901)]
    bw = [rho_of(1 - k / 900.0)[1] for k in range(901)][::-1]
    d = max(abs(a - b) for a, b in zip(fw, bw))
    jump = max(abs(fw[i + 1] - fw[i]) for i in range(len(fw) - 1))
    check('往路・復路で ρ1 が一致（差 %.3e）／隣りコマの跳び %.4f°' % (d, math.degrees(jump)),
          d < 1e-12 and math.degrees(jump) < 1.0)

    # ---- ⑦ 初期形・最終形を build_tsuru_base.EXPECT と照合 ----
    for t, key in [(0.0, '②のあと'), (1.0, '③のあと')]:
        pl = panels(rho_of(t))
        flat = max(abs(v[2]) for i in range(8) for v in pl[i])
        ng = []
        for i in range(8):
            got = sorted((round(float(v[0]), 5) + 0.0, round(float(v[1]), 5) + 0.0) for v in pl[i])
            if got != B.EXPECT[key]['P%d' % i]:
                ng.append('P%d 実測%s 期待%s' % (i, got, B.EXPECT[key]['P%d' % i]))
        check('EXPECT[%s] と8枚とも一致（平ら度 max|z|=%.1e）' % (key, flat),
              not ng and flat < 1e-12, ' / '.join(ng))

    # ---- ⑧ ふくろの2枚の上下（動く面だけ・端点の手前で見る） ----
    #     厚み0なので端点そのものでは決まらない。動かない5枚は z=0 の同着＝ここでは見ない。
    pl = panels(rho_of(1 - 1e-4))
    z = {i: float(np.mean([v[2] for v in pl[i]])) for i in range(8)}
    moving = sorted([i for i in range(8) if abs(z[i]) > 1e-12])
    check('③の手前で動いているのは P1,P2,P3 の3枚だけ', moving == [1, 2, 3], str(moving))
    check('ふくろの2枚は P1 が下・P2 が上（折り図＝P1は層0／P2は層3 と同じ向き）',
          z[1] < z[2], 'z(P1)=%.3e < z(P2)=%.3e' % (z[1], z[2]))

    # ---- 負例① 直線補間だと閉路が開く（＝いまの js/fold.js の連動） ----
    wl = wa = 0.0
    for k in range(FRAMES):
        _, gaps, _, _ = measure(rho_of(k / (FRAMES - 1), mode='linear'))
        wl = max(wl, gaps[LOOP_RAY])
        t = k / (FRAMES - 1)
        wa = max(wa, abs(rho_of(t)[1] - rho_of(t, mode='linear')[1]))
    check('負例① 直線補間では輪が開く（最大すきま %.4f・面の一辺=1／角度差 最大 %.1f°）'
          % (wl, math.degrees(wa)), wl > 0.1,
          'soft はこのすきまをバネで消すだけ＝伸びが出る。成立の根拠にしない')

    # ---- 負例② arcsin 形は端点近傍で崩れる（安定形でなければならない理由） ----
    worst_arcsin = 0.0
    for eps_deg in (1e-2, 1e-3, 1e-4):
        worst_arcsin = max(worst_arcsin, closure_error(rho_of(1 - eps_deg / 180.0, mode='arcsin')))
    check('負例② arcsin 形は ③側の端点近傍で崩れる（閉路残差 %.2e）' % worst_arcsin,
          worst_arcsin > 1e-6, 'atan2 形でなければならない')

    print()
    print('― この検査が言っていないこと ―')
    print('  ⛔ 紙どうしの貫通（すり抜け）は見ていない＝**未検証**')
    print('  ⛔ 全体の最終層順は決めていない。動かない5枚(P0,P4,P5,P6,P7)は厚み0で z=0 の同着＝**未検証**')
    print('  ⛔ 辺長・面積が0なのは面を剛体として置いているから＝**定義上0**。')
    print('     実装（soft・メッシュ）の伸縮の証拠にはならない＝**未測定**')
    print()
    print('ALL OK' if ok_all else '★NGあり')
    return 0 if ok_all else 1


if __name__ == '__main__':
    sys.exit(main())
