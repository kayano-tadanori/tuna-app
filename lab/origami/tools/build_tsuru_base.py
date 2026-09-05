# -*- coding: utf-8 -*-
"""つるの土台（preliminary base）を作る。★fold2d を通さない作品ビルダ。

★なぜ別扱いか
   ①②③⑥のうち③⑥は「ふくろを開いてつぶす」＝ fold2d に**開く操作が無い**ので
   2Dで順算できない（→ [[feedback_tsubushiori_2d_genkai]]）。そこで本人の設計どおり
       公理で折線を出す → その折線にヒンジを仕込む → 実装は3Dエンジンで動かす
   の形で、面・骨・ヒンジ・手を直接組む。

★使い方
   python build_tsuru_base.py
     → 前進運動学(FK)で各手の折り上がりを実測し、折り図から読んだ姿と突き合わせる
     → 重なり（紙の厚み何枚ぶんか）も全手で突き合わせる
     → 通ったときだけ js/works/_test_tsuru_base.js を書き出す
   ⚠ 出力は **.gitignore で git の外**（作りかけなので子どもたちのアプリに出さない
     → [[feedback_wip_no_commit]]）。

★手で組むときの罠2つ（→ [[feedback_te_de_kumu_sakuhin_no_wana]]）
   ① 三角形の巻き順が逆だと **soft のときだけ表と裏が入れかわる**（板では出ない）
      → 巻き順は手で書かず、法線のy成分で機械に決めさせて assert する
   ② hingeY を「最後の重なり」から出すと間違う。潰し折りは折り目をまた開くので、
      最後には角度0＝そこの層差は無意味。**折られている手**の層差から出す
"""
import io, sys, math
from pathlib import Path
HERE = Path(__file__).parent
OUT_JS = HERE.parent / 'js' / 'works' / '_test_tsuru_base.js'

import json, math
from pathlib import Path

S2 = math.sqrt(2) / 2

# 原紙 [-1,1]^2 の点（app は x,z 平面なので (x, z) で書く）
O  = (0.0, 0.0)
E  = (1.0, 0.0);  NE = (1.0, 1.0);  N  = (0.0, 1.0);  NW = (-1.0, 1.0)
W  = (-1.0, 0.0); SW = (-1.0, -1.0); S  = (0.0, -1.0); SE = (1.0, -1.0)

# 面（まん中Oから出る8本の折線で割った8枚）
PANELS = [
    ('P0', (O, E,  NE)),
    ('P1', (O, NE, N )),
    ('P2', (O, N,  NW)),
    ('P3', (O, NW, W )),
    ('P4', (O, W,  SW)),
    ('P5', (O, SW, S )),
    ('P6', (O, S,  SE)),
    ('P7', (O, SE, E )),
]
# 骨の木。P0を根に、左まわり(P1..P4)と右まわり(P7..P5)の2本の枝に分ける。
#   ★一本道にすると「その手で動いてはいけない紙」まで枝の先にぶら下がるので、
#     折る途中に大きく裂ける（実測：②で1.41、⑥で1.86）。
#     2本の枝に分けると、各手で動く紙がちょうど1本の枝に収まる。
#   輪を閉じる最後の1本（P4-P5＝折線 O-SW）だけが木に書けない。
BONE_PARENT = [-1, 0, 1, 2, 3, 6, 7, 0]
# 各骨のヒンジ＝親と共有している折線。向きは「連動する骨どうしの符号が
# エンジンの自動判定(+1)になる」ように選んである（下の check_signs で確認する）
AXIS = {
    1: (-S2, 0.0, -S2),      # O-NE  親P0 … ②の折線
    2: (0.0, 0.0, -1.0),     # O-N   親P1 … ③の折線
    3: (S2, 0.0, -S2),       # O-NW  親P2 … ①の折線
    4: (1.0, 0.0, 0.0),      # O-W   親P3 … ③の折線
    5: (0.0, 0.0, -1.0),     # O-S   親P6 … ⑥の折線
    6: (S2, 0.0, -S2),       # O-SE  親P7 … ①の折線（3と同じ向き＝符号+1）
    7: (1.0, 0.0, 0.0),      # O-E   親P0 … ⑥の折線
}

PI = math.pi
# 各手：{主の骨: 目標角}, 連動 [(骨, 目標角)]
STEPS = [
    dict(id=1, main=(3, PI),  linked=[(6, PI)], soft=False,
         label='はんぶんに おる（対角線）'),
    dict(id=2, main=(1, PI),  linked=[], soft=False,
         label='もう一度 はんぶんに おる'),
    dict(id=3, main=(2, PI),  linked=[(1, 0.0), (3, 0.0), (4, PI)], soft=True,
         label='☆から ふくろを ひらいて つぶす'),
    dict(id=4, main=(5, PI),  linked=[(6, 0.0), (7, PI)], soft=True,
         label='うらがえして おなじように ふくろを つぶす'),
]

# ---------- 3Dの前進運動学（エンジンと同じ式：out[i] = rot_world * M_parent） ----------
def mat_mul(a, b):
    r = [0.0] * 16
    for i in range(4):
        for j in range(4):
            r[i * 4 + j] = sum(a[k * 4 + j] * b[i * 4 + k] for k in range(4))
    return r

def mat_id():
    return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]

def hinge_rot(origin, axis, ang):
    """origin を通る axis まわりに ang 回す（列優先。OGL.mat4HingeRotate と同じ）"""
    x, y, z = axis
    n = math.sqrt(x*x + y*y + z*z) or 1.0
    x, y, z = x/n, y/n, z/n
    c, s, t = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    R = [t*x*x + c,   t*x*y + s*z, t*x*z - s*y, 0,
         t*x*y - s*z, t*y*y + c,   t*y*z + s*x, 0,
         t*x*z + s*y, t*y*z - s*x, t*z*z + c,   0,
         0, 0, 0, 1]
    ox, oy, oz = origin
    T1 = mat_id(); T1[12], T1[13], T1[14] = -ox, -oy, -oz
    T2 = mat_id(); T2[12], T2[13], T2[14] = ox, oy, oz
    return mat_mul(T2, mat_mul(R, T1))

def apply(m, v):
    return (m[0]*v[0] + m[4]*v[1] + m[8]*v[2] + m[12],
            m[1]*v[0] + m[5]*v[1] + m[9]*v[2] + m[13],
            m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14])

def bone_order():
    """親が先に来る順（エンジンの FOLD.boneOrder と同じ）"""
    done, order = [False] * 8, []
    while len(order) < 8:
        moved = False
        for i in range(8):
            if done[i]:
                continue
            p = BONE_PARENT[i]
            if p == -1 or done[p]:
                done[i] = True; order.append(i); moved = True
        assert moved, '木になっていない'
    return order

def bone_matrices(angles):
    out = [None] * 8
    for i in bone_order():
        p = BONE_PARENT[i]
        Mp = mat_id() if p == -1 else out[p]
        if i == 0:
            out[i] = Mp; continue
        ax = AXIS[i]
        originW = apply(Mp, (0.0, 0.0, 0.0))
        axW = (Mp[0]*ax[0] + Mp[4]*ax[1] + Mp[8]*ax[2],
               Mp[1]*ax[0] + Mp[5]*ax[1] + Mp[9]*ax[2],
               Mp[2]*ax[0] + Mp[6]*ax[1] + Mp[10]*ax[2])
        out[i] = mat_mul(hinge_rot(originW, axW, angles[i]), Mp)
    return out

def panel_at(angles, i):
    m = bone_matrices(angles)[i]
    return [tuple(round(c, 6) for c in apply(m, (p[0], 0.0, p[1])))
            for p in PANELS[i][1]]

def poly2d(pts):
    """xz だけ取り出して、頂点の集合として並べ替えたもの（比較用）"""
    return sorted((round(p[0], 5), round(p[2], 5)) for p in pts)

def show(angles, title):
    print(f'\n--- {title}')
    for i in range(8):
        pts = panel_at(angles, i)
        flat = max(abs(p[1]) for p in pts)
        xz = ' '.join(f'({p[0]:+.3f},{p[2]:+.3f})' for p in pts)
        print(f'   {PANELS[i][0]}  {xz}   |y|max={flat:.6f}')

# ---------- 折り図から読んだ「あるべき姿」 ----------
def tri(*pts):
    return sorted((round(a, 5), round(b, 5)) for (a, b) in pts)

EXPECT = {
  '①のあと': {   # W,S の四半分が y=-x で折り返る。E,N はそのまま
    'P0': tri(O, E, NE), 'P1': tri(O, NE, N), 'P2': tri(O, N, NW), 'P3': tri(O, NW, N),
    'P4': tri(O, N, NE), 'P5': tri(O, NE, E), 'P6': tri(O, E, SE), 'P7': tri(O, SE, E),
  },
  '②のあと': {   # ぜんぶ三角形 (O,NE,SE) に4枚重ね
    'P0': tri(O, E, NE), 'P1': tri(O, NE, E), 'P2': tri(O, E, SE), 'P3': tri(O, SE, E),
    'P4': tri(O, E, NE), 'P5': tri(O, NE, E), 'P6': tri(O, E, SE), 'P7': tri(O, SE, E),
  },
  '③のあと': {   # 潰した2枚が正方形 O,E,NE,N に。残り2枚は三角のまま
    'P0': tri(O, E, NE), 'P1': tri(O, NE, N), 'P2': tri(O, N, NE), 'P3': tri(O, NE, E),
    'P4': tri(O, E, NE), 'P5': tri(O, NE, E), 'P6': tri(O, E, SE), 'P7': tri(O, SE, E),
  },
  '⑥のあと': {   # preliminary base ＝ 正方形 O,E,NE,N に4枚重ね
    'P0': tri(O, E, NE), 'P1': tri(O, NE, N), 'P2': tri(O, N, NE), 'P3': tri(O, NE, E),
    'P4': tri(O, E, NE), 'P5': tri(O, NE, N), 'P6': tri(O, N, NE), 'P7': tri(O, NE, E),
  },
}

def verify():
    angles = [0.0] * 8
    ok = True
    names = list(EXPECT.keys())
    for k, st in enumerate(STEPS):
        b, a = st['main']; angles[b] = a
        for (lb, la) in st['linked']:
            angles[lb] = la
        title = names[k]
        exp = EXPECT[title]
        print(f'\n=== {title}（手{st["id"]}: {st["label"]}）')
        for i in range(8):
            pts = panel_at(angles, i)
            got = poly2d(pts)
            want = exp[PANELS[i][0]]
            flat = max(abs(p[1]) for p in pts)
            good = (got == want) and flat < 1e-9
            ok = ok and good
            mark = 'OK ' if good else 'NG '
            if not good:
                print(f'   {mark}{PANELS[i][0]}  実測{got}  あるべき{want}  |y|max={flat:.2e}')
        print('   ' + ('ぜんぶ一致 ✓' if all(poly2d(panel_at(angles, i)) == exp[PANELS[i][0]]
                                          for i in range(8)) else '★ちがう'))
    return ok


def loop_gap(angles):
    """木に書けない辺 P4-P5（折線 O-SW）が、どれだけ離れているか（紙の一辺=1）"""
    m = bone_matrices(angles)
    # P4 の頂点並びは (O, W, SW)／P5 は (O, SW, S)
    p4 = [apply(m[4], (p[0], 0.0, p[1])) for p in PANELS[4][1]]
    p5 = [apply(m[5], (p[0], 0.0, p[1])) for p in PANELS[5][1]]
    d = lambda a, b: math.dist(a, b)
    return max(d(p4[0], p5[0]), d(p4[2], p5[1]))   # O どうし・SW どうし

def scan():
    angles = [0.0] * 8
    print('■ 輪を閉じる辺（P7-P0＝折線 O-E）のすきま。紙の一辺=1')
    print(f'   折る前            {loop_gap(angles):.6f}')
    for st in STEPS:
        b, a = st['main']
        worst, worst_t = 0.0, 0.0
        base = list(angles)
        for k in range(0, 41):
            t = k / 40
            cur = list(base)
            cur[b] = base[b] + t * (a - base[b])
            for (lb, la) in st['linked']:
                cur[lb] = base[lb] + t * (la - base[lb])
            g = loop_gap(cur)
            if g > worst: worst, worst_t = g, t
        angles[b] = a
        for (lb, la) in st['linked']:
            angles[lb] = la
        print(f'   手{st["id"]} 折り終わり {loop_gap(angles):.6f}   '
              f'（折る途中の最大 {worst:.4f} … {worst_t*100:.0f}%地点）'
              + ('  ← soft で折る手' if st['soft'] else ''))

# ---------------- JS 書き出し ----------------
def emit(path):
    verts, tris, uv, panel = [], [], [], []
    for bi, (name, pts) in enumerate(PANELS):
        base = len(verts)
        for (x, z) in pts:
            verts.append([x, 0.0, z]); panel.append(bi)
            uv.append([(x + 1) / 2, (z + 1) / 2])
        tris.append([base, base + 1, base + 2])

    # ★★上下をそろえる（to_work_js.py と同じ規則。ここを通していなかった）
    #   このエンジンのカメラは「zが大きいほど画面の下」に描く。数学の座標のまま
    #   z を入れると上下さかさま＝**面の向きが規約と逆**になり、
    #   物理で描いている間だけ表と裏が入れかわって見える（2026-09-05に実測）。
    #   ⚠ 板の経路では出ず、soft の経路でだけ出た＝**片方の絵だけ見ていたら気づけない**。
    #     ・頂点は z の符号を反転  ・三角形の巻き順を入れかえる
    #     ・ヒンジの原点は z を反転、軸は [-x, -y, z]（回転軸は擬ベクトルなので規則が違う）
    verts = [[v[0], v[1], -v[2]] for v in verts]

    # ★三角形の巻き順は手で書かず、機械に決めさせる。
    #   規約＝「紙のおもての面の法線が +y」。ここが逆だと、
    #   **物理(soft)で描いている間だけ表と裏が入れかわって見える**
    #   （2026-09-05実測。板の経路は骨の行列で押し出すので出ない＝
    #     片方の絵だけ見ていたら絶対に気づけない型の不具合）。
    for k, tr in enumerate(tris):
        a, b, c = verts[tr[0]], verts[tr[1]], verts[tr[2]]
        u = (b[0]-a[0], b[1]-a[1], b[2]-a[2])
        v = (c[0]-a[0], c[1]-a[1], c[2]-a[2])
        ny = u[2]*v[0] - u[0]*v[2]          # 法線の y 成分
        if ny < 0:
            tris[k] = [tr[0], tr[2], tr[1]]
    # 機械で確かめる（1枚でも下を向いていたら止める）
    for tr in tris:
        a, b, c = verts[tr[0]], verts[tr[1]], verts[tr[2]]
        u = (b[0]-a[0], b[1]-a[1], b[2]-a[2])
        v = (c[0]-a[0], c[1]-a[1], c[2]-a[2])
        assert u[2]*v[0] - u[0]*v[2] > 0, '巻き順が規約どおりにならない'
    print('   ■ 三角形の巻き順: 8枚すべて おもての法線が +y ✓')
    hinge = ['null']
    for i in range(1, 8):
        ax = AXIS[i]
        hinge.append('{ origin: [0, %g, 0], axis: [%s] }'
                     % (0.0, ', '.join('%.6f' % v for v in (-ax[0], -ax[1], ax[2]))))
    L = []
    L.append('// ============================================================')
    L.append('// works/_test_tsuru_base.js — つるの土台(preliminary base)・作りかけ')
    L.append('//   ★fold2d では作れない「ふくろを開いてつぶす」を、')
    L.append('//     公理で出した折線にヒンジを仕込んで3Dエンジンで折る形にしたもの。')
    L.append('//   ★このファイルは scratchpad/emit_base.py が書き出したもの。手で直さない。')
    L.append('// ============================================================')
    L.append("'use strict';")
    L.append('window.ORIGAMI_WORKS = window.ORIGAMI_WORKS || {};')
    L.append('ORIGAMI_WORKS._test_tsuru_base = {')
    L.append("  id: '_test_tsuru_base', name: 'テスト:つるの土台', emoji: '" + chr(129514) + "', difficulty: 4,")
    L.append('  mesh: {')
    L.append('    verts: [' + ', '.join('[%g, %g, %g]' % tuple(v) for v in verts) + '],')
    L.append('    tris: [' + ', '.join(str(t) for t in tris) + '],')
    L.append('    uv: [' + ', '.join('[%g, %g]' % tuple(u) for u in uv) + '],')
    L.append('    panel: ' + str(panel) + ',')
    L.append('    boneParent: ' + str(BONE_PARENT) + ',')
    L.append('    hinge: [' + ', '.join(hinge) + '],')
    # ★重なり順（0が下）。折る流れから出した。
    #   ①: E(P0,P7)が下、動いたW/Sが上
    #   ②: 下から E, S, W, N
    #   ③: 潰した2枚が上に開く。L1={P7,P0,P1} が下、{P2,P3} が上
    #   ⑥: 下から {P0,P1}, {P6,P7}, {P4,P5}, {P2,P3}
    #     （同じ辺に来る折り目どうしが入れちがわない並び＝これしかない。
    #      24通り全部ためして残ったのが「輪の順」の2つ、うち折る流れに合うのがこれ）
    LAYER_BY_STEP = [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 1, 0],
        [0, 3, 3, 2, 2, 1, 1, 0],
        [0, 0, 3, 3, 2, 1, 1, 0],
        [0, 0, 3, 3, 2, 2, 1, 1],
    ]
    # ★紙の厚みは、ヒンジの軸を厚みぶん持ち上げて出す（不文律③）。
    #     hingeY[i] = (L[i] - L[親]) / 2 × （親が裏返っていたら -1）
    #
    #   🚨ここを「最後の重なり」から出すと間違う（2026-09-05に踏んだ）。
    #     潰し折りは一度折った折り目をまた開くので、最後には角度0になる骨がある。
    #     **角度0の骨はヒンジの原点が結果に効かない**（0回転は原点がどこでも恒等）＝
    #     最後の層差はその骨にとって無意味な数。
    #     正しくは「その折り目が**実際に折られている手**」の層差で出す。
    #     しかもそれが複数の手にまたがるときは、全部で同じ値になることを確かめる
    #     （ならなければデータかLの並びが間違っている＝止める）。
    def flip_of(mats, i):
        m = mats[i]
        return (m[0] * m[10] - m[8] * m[2]) < 0        # xz の向きが反転しているか

    # 各手の折り終わりの角度と、そのときの姿勢
    poses, ang = [], [0.0] * 8
    poses.append((list(ang), bone_matrices(ang)))       # 0行目＝折る前
    for st in STEPS:
        b, a = st['main']; ang[b] = a
        for (lb, la) in st['linked']:
            ang[lb] = la
        poses.append((list(ang), bone_matrices(ang)))

    hy, why = [0.0] * 8, {}
    for i in range(1, 8):
        par = BONE_PARENT[i]
        want = []
        for k, (aa, mm) in enumerate(poses):
            if abs(aa[i]) < 1e-9:
                continue                                # 角度0＝この手では効かない
            Lk = LAYER_BY_STEP[k]
            want.append(((Lk[i] - Lk[par]) * 0.5 * (-1 if flip_of(mm, par) else 1), k))
        if not want:
            continue
        vals = sorted(set(round(v, 9) for v, _ in want))
        if len(vals) > 1:
            raise SystemExit(f'★骨{i}: 折られている手ごとに要る高さが食いちがう {want}')
        hy[i] = vals[0]
        why[i] = [k for _, k in want]

    print('')
    print('   ■ hingeY（その折り目が折られている手の層差から出した）')
    for i in range(1, 8):
        print(f'      骨{i}  hingeY={hy[i]:+.2f}   折られている手={why.get(i, [])}')

    # ★入れた値で本当にその重なりになるか、厚みつきのFKで各手ぜんぶ測る

    def fk_height(angles):
        out = [None] * 8
        for i in bone_order():
            par = BONE_PARENT[i]
            Mp = mat_id() if par == -1 else out[par]
            if i == 0:
                out[i] = Mp; continue
            org = apply(Mp, (0.0, hy[i], 0.0))
            ax = AXIS[i]
            axW = (Mp[0]*ax[0] + Mp[4]*ax[1] + Mp[8]*ax[2],
                   Mp[1]*ax[0] + Mp[5]*ax[1] + Mp[9]*ax[2],
                   Mp[2]*ax[0] + Mp[6]*ax[1] + Mp[10]*ax[2])
            out[i] = mat_mul(hinge_rot(org, axW, angles[i]), Mp)
        return [round(apply(out[i], (0.0, 0.0, 0.0))[1], 6) for i in range(8)]

    print('')
    print('   ■ 厚みつきで折った結果の高さ（紙1枚=1）を全部の手で突き合わせる')
    ng = []
    for k, (aa, _) in enumerate(poses):
        got, want = fk_height(aa), LAYER_BY_STEP[k]
        good = all(abs(got[i] - want[i]) < 1e-9 for i in range(8))
        print(f'      手{k}  実測={got}  ねらい={want}  {"OK" if good else "★NG"}')
        if not good:
            ng.append(k)
    if ng:
        raise SystemExit(f'★重なりが狙いどおりにならない手: {ng}')

    L.append('    layerOrder: ' + str(LAYER_BY_STEP[-1]) + ',')
    L.append('    hingeY: [' + ', '.join('%g' % v for v in hy) + '],')
    L.append('    flatStack: true,')
    L.append('    layerByStep: [' + ', '.join(str(r) for r in LAYER_BY_STEP) + '],')
    L.append('    inflateSign: ' + str([0] * 8) + ',')
    L.append('  },')
    L.append('  steps: [')
    for st in STEPS:
        b, a = st['main']
        lk = ', '.join('{ boneId: %d, target: %.9f }' % (i, v) for (i, v) in st['linked'])
        soft = ' soft: true, twoWay: true,' if st['soft'] else ''
        L.append("    { id: %d, handle: { boneId: %d, local: [%s], linkedBoneIds: [%s] },"
                 % (st['id'], b, ', '.join('%g' % c for c in
                    (PANELS[b][1][2][0], 0.0, -PANELS[b][1][2][1])), lk))
        L.append("      targetAngle: %.9f, snapDeg: 0.35, returnAngle: 0,%s"
                 % (a, soft))
        L.append("      hintLabel: '%s' }," % st['label'])
    L.append('  ],')
    L.append('  labelPoints: [], poseAdjust: {}, inflate: { min: 0, max: 1, default: 0 }, cutSlots: [],')
    L.append('};')
    io.open(path, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print('\n書き出した:', path)


if __name__ == '__main__':
    print('■ 折線8本・骨8つの前進運動学で、各手の折り終わりを実測して突き合わせる')
    if not verify():
        sys.exit('★形が折り図と合わない。止める。')
    scan()
    emit(str(OUT_JS))
