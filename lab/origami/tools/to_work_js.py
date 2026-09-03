"""fold2d.py で順算した折り方を、3Dの折り紙エンジン(js/fold.js)が読む
   `ORIGAMI_WORKS.<id>` の形に変換する。

★なぜ変換できるのか
   fold.js のメッシュもヒンジも「平らな原紙の座標」で書く決まりになっている。
   fold2d.py は紙切れ1枚ごとに xf（原紙座標 → いまの座標）を持っているので、
   その逆写像で全部を平らな紙の上に戻せる。つまり
     ・紙切れの形     → xf_inv(頂点)          … メッシュ
     ・折り線の位置   → xf_inv(折る直前のxf)  … ヒンジ
   3Dの「ある直線のまわりに180°まわす」は、2Dの「その直線で鏡映する」と
   まったく同じ動きなので、順算した手順がそのまま3Dの折り手順になる。

★骨(ボーン)の決め方
   紙切れごとに hist（自分を動かした折りの番号の並び）を持たせてある。
   hist が同じ紙切れは必ず一緒に動くので、それを1つの骨にする。
   親は hist の最後を1つ取った並び。途中の並びに紙切れが残っていない場合は
   「形を持たない骨」を作る（kabuto.js に前例あり）。

★裏返し(flip)について
   3Dでは紙は最初から立体の中にあるので、「裏返す」は紙の変形ではなく
   見る側の都合。だから骨は作らず、次の手のヒントに「（裏返して）」とだけ足す。
   折り線の位置は xf 経由で計算しているので、裏返しの影響は自動的に入る。
"""
import json
import math
from fold2d import (FoldState, xf_inv_apply, xf_is_flipped, IDENTITY_XF,
                    reflect_affine, xf_compose)


def _r(v, nd=6):
    x = round(v, nd) + 0.0
    return int(x) if abs(x - round(x)) < 1e-12 else x


def _flat(p, xf):
    """いまの座標の点 p を、平らな原紙の座標に戻す。"""
    q = xf_inv_apply(xf, p)
    return (_r(q[0]), _r(q[1]))


def _poly_area(poly):
    a = 0.0
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        a += x1 * y2 - x2 * y1
    return a / 2


def build_bones(st):
    """紙切れを hist ごとにまとめて骨にし、親子・ヒンジを決める。"""
    groups = {}
    for p in st.panels:
        groups.setdefault(tuple(p['hist']), []).append(p)

    # 途中の並び（形を持たない骨）も足す
    keys = set(groups.keys())
    for k in list(keys):
        for i in range(len(k)):
            keys.add(k[:i])
    keys = sorted(keys, key=lambda k: (len(k), k))
    idx = {k: i for i, k in enumerate(keys)}

    bones = []
    for k in keys:
        panels = groups.get(k, [])
        bone = {'key': k, 'parent': idx[k[:-1]] if k else -1,
                'step': k[-1] if k else None, 'polys': [], 'hinge': None}
        for p in panels:
            src = [_flat(q, p['xf']) for q in p['poly']]
            if _poly_area(src) < 0:
                src = src[::-1]                     # 反時計回りにそろえる
            # cur = 折り終わったときの位置。重なりの枚数はこちらで数える
            #（srcは開いた紙の上の位置なので、どの紙も重ならない）。
            bone['polys'].append({'src': src, 'cur': list(p['poly']),
                                  'layer': p['layer'],
                                  'back': xf_is_flipped(p['xf'])})
        if k:
            s = st.steps[k[-1]]
            # 折る直前の xf（この骨のどの紙切れも同じ値になる）
            pre = panels[0]['pre_xf'] if panels else _pre_xf_for(st, k)
            a = _flat(s['a'], pre)
            b = _flat(s['b'], pre)
            bone['hinge'] = {'a': a, 'b': b, 'kind': s['kind']}
        bones.append(bone)
    return bones, idx


def _pre_xf_for(st, key):
    """形を持たない骨のために、その並びの xf を手順から組み直す。"""
    xf = IDENTITY_XF
    done = set(key[:-1])
    for i, s in enumerate(st.steps):
        if s['op'] == 'flip':
            F = (-1.0, 0.0, 0.0, 1.0, 0.0, 0.0) if s.get('axis') == 'v' \
                else (1.0, 0.0, 0.0, -1.0, 0.0, 0.0)
            xf = xf_compose(F, xf)
        elif i in done:
            xf = xf_compose(reflect_affine(s['a'], s['b']), xf)
        if i == key[-1]:
            break
    return xf


def _area_samples(poly, rings=(0.25, 0.55, 0.85)):
    """多角形の中の代表点をいくつか取る。★重心1点だけで重なりを数えると、
       たまたまそこが薄いときに紙が低く置かれ、下の紙と同じ高さになってしまう
       （本人指摘2026-09-02「ねこの2手目、折ってるのに同じ高さになってる」）。
       平らな紙は「下でいちばん高い所」に乗るので、面の中を何点か見て最大を取る。"""
    cx = sum(v[0] for v in poly) / len(poly)
    cy = sum(v[1] for v in poly) / len(poly)
    out = [(cx, cy)]
    for v in poly:
        for r in rings:
            out.append((cx + (v[0]-cx)*r, cy + (v[1]-cy)*r))
    for i in range(len(poly)):            # 辺の中点も（細長い紙むけ）
        mx = (poly[i][0] + poly[(i+1) % len(poly)][0]) / 2
        my = (poly[i][1] + poly[(i+1) % len(poly)][1]) / 2
        for r in rings:
            out.append((cx + (mx-cx)*r, cy + (my-cy)*r))
    return out


def _map_iso(src, dst, pt):
    """srcの多角形をdstへ移す等長変換で、点ptを移す。
       頂点の並びが同じなので、3点の対応から一次変換を解けば厳密に決まる。"""
    idx = [0, 1, 2]
    for k in range(2, len(src)):
        ax = src[1][0] - src[0][0]; ay = src[1][1] - src[0][1]
        bx = src[k][0] - src[0][0]; by = src[k][1] - src[0][1]
        if abs(ax * by - ay * bx) > 1e-9:
            idx = [0, 1, k]
            break
    (x0, y0), (x1, y1), (x2, y2) = (src[i] for i in idx)
    (u0, v0), (u1, v1), (u2, v2) = (dst[i] for i in idx)
    det = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)
    if abs(det) < 1e-12:
        return pt
    a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det
    b = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det
    c = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det
    d = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det
    dx = pt[0] - x0; dy = pt[1] - y0
    return (u0 + a * dx + b * dy, v0 + c * dx + d * dy)


def _point_in(pt, poly):
    """点が多角形の中にあるか（重なりの枚数を数えるのに使う）。"""
    x, y = pt
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xin = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xin:
                inside = not inside
    return inside


def _fan(poly):
    """多角形を三角形に割る（凸なので扇形分割でよい）。"""
    return [(0, i, i + 1) for i in range(1, len(poly) - 1)]


def stack_counts(st):
    """紙切れごとに「そこは何枚重なっているか」を数える。

    ★かたさは枚数で決まる（本人 2026-09-03「枚数で判定して」）。
      実物の紙も、何枚も重なった所（かぶとのツノ・はちまき）はしっかりして
      形が崩れず、1〜2枚の所（袋の壁）は紙らしくやわらかい。
      3Dはこの数を見て、場所ごとに「かたさ」を変える。
    """
    from fold2d import point_in_polygon
    out = []
    for p in st.panels:
        poly = p['poly']
        n = len(poly)
        # 重心だけだと凹んだ形で外に出るので、重心と各辺の中点寄りの数点で数える
        cx = sum(q[0] for q in poly) / n
        cy = sum(q[1] for q in poly) / n
        pts = [(cx, cy)]
        for i in range(n):
            mx = (poly[i][0] + poly[(i + 1) % n][0]) / 2
            my = (poly[i][1] + poly[(i + 1) % n][1]) / 2
            pts.append((cx + (mx - cx) * 0.5, cy + (my - cy) * 0.5))
        best = 1
        for pt in pts:
            if not point_in_polygon(pt, poly):
                continue
            c = sum(1 for q in st.panels if point_in_polygon(pt, q['poly']))
            best = max(best, c)
        out.append(best)
    return out


def to_work(st, work_id, name, emoji, difficulty, hints=None, title_note='',
            rotate_deg=0, inflate=None, color_down=False):
    """ORIGAMI_WORKS.<id> にそのまま入れられる dict を返す。
       rotate_deg: 画面で見える向きにそろえるための回転。紙の模様(uv)は
       回す前の座標で決めるので、回しても柄はずれない。
       color_down: **色のついた面を下にして置いて折り始める**作品。
       　　アプリは「最初に上を向いていた面」を色つきで描くので、この印が無いと
       　　出来上がりが真っ白になる（ハートの折り図⑦は全面ピンクなのに真っ白だった。
       　　本人指摘 2026-09-03「それ 気になってたのよ」）。表と裏の色を入れかえるだけで、
       　　形・重なり・折り線はいっさい変わらない。"""
    bones, idx = build_bones(st)
    hints = hints or {}
    rr = math.radians(rotate_deg)
    rc, rs = math.cos(rr), math.sin(rr)

    def rot(p):
        return (_r(p[0]*rc - p[1]*rs), _r(p[0]*rs + p[1]*rc))

    verts, tris, uv, panel_of_vert = [], [], [], []
    hw, hh = st.paper['hw'], st.paper['hh']
    for bi, bone in enumerate(bones):
        for pl in bone['polys']:
            base = len(verts)
            for (x, y) in pl['src']:
                uv.append([_r((x + hw) / (2 * hw)), _r((y + hh) / (2 * hh))])
            pl['src0'] = list(pl['src'])                   # 回す前（原紙のまま）の座標
            pl['src'] = [rot(q) for q in pl['src']]        # ここから先は回した座標で扱う
            for (x, y) in pl['src']:
                verts.append([x, 0, y])
                panel_of_vert.append(bi)
            for (i, j, k) in _fan(pl['src']):
                tris.append([base + i, base + j, base + k])
        if bone['hinge'] is not None:
            bone['hinge']['a'] = rot(bone['hinge']['a'])
            bone['hinge']['b'] = rot(bone['hinge']['b'])

    bone_parent = [b['parent'] for b in bones]
    hinge = []
    for b in bones:
        if b['hinge'] is None:
            hinge.append(None)
            continue
        a, bb = b['hinge']['a'], b['hinge']['b']
        dx, dz = bb[0] - a[0], bb[1] - a[1]
        L = math.hypot(dx, dz)
        hinge.append({'origin': [a[0], 0, a[1]],
                      'axis': [_r(dx / L), 0, _r(dz / L)]})

    # ---- 手順（折り1回につき1手。裏返しは手にしない）----
    steps = []
    for si, s in enumerate(st.steps):
        if s['op'] != 'fold':
            continue
        ids = [i for i, b in enumerate(bones) if b['step'] == si]
        if not ids:
            continue
        # ★その骨と、そこにぶら下がっている子孫の紙をぜんぶ集める。
        #   その手で折った紙が**あとの手で丸ごと動く**と、骨じたいの面が0枚に
        #   なる（おむすびの②、ライオンの⑤）。子孫の紙はこの手ではまだ折られて
        #   いない＝同じ平らな面にあるので、つまむ場所に使ってよい。
        #   （2026-09-03。以前はここで best=None のまま落ちていた）
        def _with_kids(i):
            out = list(bones[i]['polys'])
            for j, b in enumerate(bones):
                k = b['parent']
                while k >= 0:
                    if k == i:
                        out.extend(b['polys'])
                        break
                    k = bones[k]['parent']
            return out
        span = {i: _with_kids(i) for i in ids}
        # いちばん大きい骨を主にする（つまむ場所を取りやすい）
        ids.sort(key=lambda i: -sum(abs(_poly_area(p['src'])) for p in span[i]))
        main = ids[0]
        # つまむ点＝主の骨の中で、ヒンジからいちばん遠い頂点
        hg = bones[main]['hinge']
        best, bd = None, -1
        for pl in span[main]:
            for q in pl['src']:
                d = abs((hg['b'][0]-hg['a'][0])*(q[1]-hg['a'][1])
                        - (hg['b'][1]-hg['a'][1])*(q[0]-hg['a'][0]))
                if d > bd:
                    bd = d; best = q
        # ★折る向き：軸ベクトルuと「動く頂点への向き」vの外積のY成分が正なら
        #   紙は持ち上がる。持ち上がる向きに軸の符号をそろえる（実機で試さずに
        #   計算で決める。[[project_origami_app]]続き16の6と同じやり方）。
        #   180°まわす折りでは軸の符号は最終形に効かない＝途中の動きの向きだけ。
        # 🚨★向きは「その手で1回だけ」決めて、同じ手の骨すべてに同じ反転をかける。
        #   折り線は重なった層に共通の1本で、各骨の a→b はその1本を層ごとの
        #   変換で戻したものだから、同じ向きに揃っている。骨ごとに向きを決め直すと
        #   裏返った層だけ逆回りして、**紙が両側にひらく**
        #   （本人指摘 2026-09-02「チューリップの2手目 紙が両方にひらく」）。
        #   🚨★向きは「谷折りなら世界で上へ／山折りなら下へ」でなければならない。
        #     以前は「平らな姿勢で上へ持ち上がる向き」で決めていたが、
        #     **親が奇数回折られている（裏返っている）と、それは世界では下向き**。
        #     その結果、谷折りなのに紙が裏側へ回りこんでいた
        #     （本人指摘2026-09-02「裏を折ってるのに上面が減って、折った先の
        #       上面が増えてる」「紙の折れてる方向もみて　エンジンがおかしい」）。
        par_main = bones[main]['parent']
        parity = (-1) ** len(bones[par_main]['key']) if par_main >= 0 else 1
        want = (1 if s['kind'] == 'V' else -1) * parity
        u = hinge[main]['axis']
        v = [best[0]-hg['a'][0], 0, best[1]-hg['a'][1]]
        if (u[2]*v[0] - u[0]*v[2]) * want < 0:
            for i in ids:
                hinge[i]['axis'] = [-hinge[i]['axis'][0], 0, -hinge[i]['axis'][2]]
        step = {
            'id': len(steps) + 1,
            'handle': {'boneId': main, 'local': [best[0], 0, best[1]]},
            'targetAngle': 'PI',
            'snapDeg': 0.35, 'returnAngle': 0,
            'hintLabel': hints.get(si, s.get('name') or '折る'),
            'creaseLine': {'boneId': bones[main]['parent'] if bones[main]['parent'] >= 0 else 0,
                           'a': [hg['a'][0], 0, hg['a'][1]],
                           'b': [hg['b'][0], 0, hg['b'][1]],
                           'kind': 'valley' if s['kind'] == 'V' else 'mountain'},
        }
        if len(ids) > 1:
            step['handle']['linkedBoneIds'] = ids[1:]
        steps.append(step)

    # ★色のついた面を下にして始める作品は、1手目のヒントでそれを言う
    #   （実物の紙で折る子が、アプリと同じ色の出方になるように）。
    if color_down and steps:
        steps[0]['hintLabel'] = '色のついた面を下にして、' + steps[0]['hintLabel']

    # ★1手ごとの「重なりの高さ」。最終形の重なり順を折る途中でも使うと、
    #   親につられて動いた紙が土台と同じ高さになってちらつく
    #   （本人指摘2026-09-02「一度おってるのに折った紙の下半分が消えてる」）。
    #   各手のあとの紙の様子（snapshots）から、骨ごとの高さを作る。
    #
    # 🚨★「形を持たない骨」の高さを、親から借りてはいけない（2026-09-03）。
    #   あとの手でその紙が丸ごと動かされた骨は、**最後の形では面を1枚も持たない**。
    #   そこを「親と同じ高さ」で埋めると hingeY が 0 になり、
    #   **折ったのに土台と同じ高さのまま＝画面が縞模様にちらつく**
    #   （おにぎりの1手目・ハートの2手目・ライオンの1手目・ぱとかーの1手目で発生）。
    #   その骨の紙は子孫が持っているので、**子孫の値を採る**のが正しい。
    #   本人指摘「すいかの2手目がおかしい」を追いかけて check_hint_words.py で判明。
    kids = {i: [] for i in range(len(bones))}
    for i, b in enumerate(bones):
        if b['parent'] >= 0:
            kids[b['parent']].append(i)

    def _fill_shapeless(rows):
        """面を持たない骨の値を、その紙をいま持っている子孫から埋める。
           骨は key の短い順（＝親が先）に並んでいるので、深い方から順に埋める。"""
        for i in range(len(bones) - 1, -1, -1):
            if bones[i]['polys'] or bones[i]['parent'] < 0:
                continue
            got = [rows[j] for j in kids[i] if bones[j]['polys'] or kids[j]]
            rows[i] = max(got) if got else rows[bones[i]['parent']]
        return rows

    nsteps = sum(1 for x in st.steps if x['op'] == 'fold')
    layer_by_step = [[0] * len(bones)]          # 0行目＝まだ折っていない平らな紙
    snaps = {}
    for sn in st.snapshots:
        # ★「その手の直後」の様子を使う。裏返し(flip)も様子を控えるので、
        #   同じ手数の最後を採ると**裏返した後**の状態になり、層の上下が
        #   逆さまになる（やっこさんの4手目で、折った紙が土台の下へ潜って
        #   消えていた。2026-09-02 本人指摘）。最初に来たものを採る。
        snaps.setdefault(sn['nfold'], (sn['panels'], sn.get('nflip', 0)))
    for k in range(1, nsteps + 1):
        got = snaps.get(k)
        if got is None:
            layer_by_step.append(list(layer_by_step[-1]))
            continue
        panels, nflip = got
        # ★裏返した回数が奇数なら、2Dの層は上下が逆さま。3D側は裏返さないので戻す。
        sgn = -1 if (nflip % 2) else 1
        rows = []
        for b in bones:
            best = 0
            for pl in b['polys']:
                for (cx, cy) in _area_samples(pl['src0']):
                    mine = None
                    for pp in panels:          # この時点でこの場所にあった紙切れ
                        if _point_in((cx, cy), pp['src']):
                            mine = pp
                            break
                    if mine is None:
                        continue
                    fx, fy = _map_iso(mine['src'], mine['poly'], (cx, cy))
                    below = 0
                    for pp in panels:
                        if pp is mine or pp['layer']*sgn >= mine['layer']*sgn:
                            continue
                        if _point_in((fx, fy), pp['poly']):
                            below += 1
                    best = max(best, below)
            rows.append(best)
        _fill_shapeless(rows)                   # 形を持たない骨は子孫の値
        layer_by_step.append(rows)

    # ★何枚めに重なっているか。
    #   🚨「折った順番」や「骨の深さ」で浮かせるのは物理的に間違い
    #     （本人指摘 2026-09-02「おる順番で浮かせてるのは物理的に正しくない」）。
    #     正しくは **その場所で自分の下に何枚あるか**。重なっていない紙どうしは
    #     高さが違ってはいけない（そうしないと階段状になる）。
    #   2Dで順算したときの各紙切れの layer（上下の順）と、実際の重なり
    #   （相手の多角形の中に自分の代表点が入っているか）から数える。
    fold_index = {}          # 骨 -> 何手目で折られるか（折りの手だけ数えた番号）
    nf = 0
    for si, x in enumerate(st.steps):
        if x['op'] != 'fold':
            continue
        nf += 1
        for i, b in enumerate(bones):
            if b['step'] == si:
                fold_index[i] = nf

    #
    #   🚨★「その場所で自分の下に何枚あるか」を骨ごとに数えるだけでは足りない
    #     （2026-09-03）。土台の骨は紙のあちこちに散らばっていて場所ごとに深さが
    #     違うので、最大値で代表させると**その骨と関係ない場所の深さ**が混ざる。
    #     ハートの1手目は本当は土台の上（+1）なのに -1 ＝「後ろへ回りこむ」に、
    #     2手目は 0 ＝土台と同じ高さでちらついていた。
    #
    #     正しい決め方は「数える」ではなく「積む」。上下の順そのものは
    #     2Dの layer が持っている（全パネルを通した一貫した順序）ので、
    #        高さ[A] = max( 高さ[B] + 1 )   … B は A より下で、かつ A と重なる骨
    #     と、下から順に積み上げる。こうすると
    #       ・重なっている紙どうしは必ず順番どおりになる（ぶたの4手目で、
    #         上に来るはずの紙が下になっていたのを直した）
    #       ・重なっていない紙どうしは同じ高さのまま（階段にならない）
    total_flip = sum(1 for x in st.steps if x['op'] == 'flip')
    fsgn = -1 if (total_flip % 2) else 1

    def _span(b):
        """その骨の紙片が、2Dの重なり順でどこからどこまでを占めるか。"""
        ls = [pl['layer'] * fsgn for pl in b['polys']]
        return (min(ls), max(ls)) if ls else None

    def _overlap(b1, b2):
        """2つの骨の紙が、折り終わりで実際に重なっているか。"""
        for p1 in b1['polys']:
            for p2 in b2['polys']:
                if any(_point_in(s, p2['cur']) for s in _area_samples(p1['cur'])):
                    return True
                if any(_point_in(s, p1['cur']) for s in _area_samples(p2['cur'])):
                    return True
        return False

    spans = [_span(b) for b in bones]
    # 下から順に積むので、2Dの順の低いものから決める（形を持たない骨はあとで）
    stack_order = sorted((i for i in range(len(bones)) if spans[i] is not None),
                         key=lambda i: spans[i][0])
    layer_order = [0] * len(bones)
    for n, i in enumerate(stack_order):
        h = 0
        for j in stack_order[:n]:
            # j が i より確実に下（順序の帯が重ならない）で、紙が重なっているとき
            if spans[j][1] < spans[i][0] and _overlap(bones[i], bones[j]):
                h = max(h, layer_order[j] + 1)
        layer_order[i] = h
    # 🚨形を持たない骨（＝その紙をあとの手で丸ごと動かした骨）は、
    #   **折った当時の「親からの段差」**を使う。親の値をそのまま借りると段差0＝
    #   折ったのに高さが変わらず、その手だけ画面がちらつく（上の🚨と同じ話）。
    #   段差は同じ時点（layer_by_step の同じ行）の親との差で取るので、
    #   あとから下に紙が滑りこんでも狂わない。子孫の最終位置はこの値に影響されない
    #   （子の hingeY が (L_子 - L_親)/2 なので、L_親 が変わっても L_子 に着地する）。
    for i, b in enumerate(bones):
        if b['polys'] or b['parent'] < 0:
            continue
        par, k = b['parent'], fold_index.get(i)
        if k is None or k >= len(layer_by_step):
            layer_order[i] = layer_order[par]
            continue
        row = layer_by_step[k]
        layer_order[i] = layer_order[par] + (row[i] - row[par])

    # ★★紙の厚みは「層を数値で浮かせる」のではなく、
    #   **ヒンジの軸を紙の厚みぶん持ち上げる**ことで出す（本人指示 2026-09-02
    #   「一枚の紙だよ、折るだけできれいにやぶれたりしないよ」「ぜったいにはずれないヒンジ」）。
    #
    #   厚さtの紙を折り返すとき、折り目は紙の「外側の面」にできる。
    #   軸を高さhに置いて180°まわすと、高さHにあった紙は 2h-H に移る。
    #   折る前は子も親と同じ高さ(=親の層L_p×t)にいるので、
    #   折り終わりに子を L_c×t に置きたければ  h = (L_c + L_p)/2 × t。
    #   ヒンジは親のローカル座標で書くので、親から見た軸の高さは
    #        (L_c - L_p)/2 × t
    #   これなら重なりは幾何から自然に出る＝紙を数値で引き離さないので
    #   **折り目でつながったまま**。折る前は全部 y=0 なので段差も出ない。
    hinge_y = [0.0] * len(bones)
    for i, b in enumerate(bones):
        par = b['parent']
        k = fold_index.get(i)
        if par < 0 or k is None or k >= len(layer_by_step):
            continue
        # ★親が奇数回折られていると、その紙は上下が裏返っている。
        #   ヒンジは親のローカル座標で書くので、そのままの符号だと軸が
        #   「下」へ持ち上がってしまい、重なりの高さが合わなくなる
        #   （2026-09-02、はちまきが角の羽の下にもぐって発覚）。
        #   親の折り回数の偶奇で符号をそろえる。
        flip = -1 if (len(bones[par]['key']) % 2) else 1
        # ★親子の上下差は「折り終わりの重なり」で決める。
        #   折った後は親子は一緒に動くので、この差はもう変わらない＝これが不変量。
        #   途中の重なりで決めると、あとから下に紙が滑りこんだとき
        #   （動いていないのに重なりの数だけ増える）に合わなくなる。
        hinge_y[i] = (layer_order[i] - layer_order[par]) * 0.5 * flip

    # ★上下をそろえる。このエンジンのカメラは「zが大きいほど画面の下」に描くので、
    #   見た目の座標をそのまま z にすると上下さかさまに出る。
    #   灘中対策の問題は core.js の flipProblemZ が同じことをしている（規則もそこと同じ）：
    #     ・頂点は z の符号を反転  ・三角形の巻き順を入れかえる
    #     ・ヒンジの原点は z を反転、軸は [-x, -y, z]（回転軸は擬ベクトルなので規則が違う）
    verts = [[v[0], v[1], -v[2]] for v in verts]
    tris = [[t[0], t[2], t[1]] for t in tris]
    for h in hinge:
        if h is None:
            continue
        h['origin'] = [h['origin'][0], h['origin'][1], -h['origin'][2]]
        h['axis'] = [-h['axis'][0], -h['axis'][1], h['axis'][2]]
    for stp in steps:
        L = stp['handle']['local']
        stp['handle']['local'] = [L[0], L[1], -L[2]]
        cl = stp['creaseLine']
        cl['a'] = [cl['a'][0], cl['a'][1], -cl['a'][2]]
        cl['b'] = [cl['b'][0], cl['b'][1], -cl['b'][2]]

    return {'id': work_id, 'name': name, 'emoji': emoji, 'difficulty': difficulty,
            'note': title_note,
            # ★紙切れごとの重なり枚数（かたさを場所ごとに変えるのに使う）

            # ★ふきかけバー（💨）。{'step': 何手目の折りを, 'deg': 何度もどすか}。
            #   None の作品ではバーそのものを出さない——バーがあること自体が
            #   「完成したら形を変えられる」合図になる（本人 2026-09-03）。
            'inflate': inflate,
            # 色のついた面を下にして置いて始める作品（表と裏の色を入れかえて描く）
            'colorDown': bool(color_down),
            # flatStack: 折り終わりがぺたんこになる作品＝真上から見せてよい。
            # 3D側がこれを見て、①ほぼ真上のカメラ ②層を上へ積む紙の厚み にする。
            'mesh': {'verts': verts, 'tris': tris, 'uv': uv, 'panel': panel_of_vert,
                     'boneParent': bone_parent, 'hinge': hinge,
                     'flatStack': True, 'layerOrder': layer_order,
                     # ★紙切れごとの重なり枚数（かたさを場所ごとに変えるのに使う）
                     'stackCount': stack_counts(st),
                     'layerByStep': layer_by_step, 'hingeY': hinge_y,
                     # 各骨が何手目で折られるか（0=土台。検査で「この手までに
                     # 位置が決まった骨だけ見る」ために使う）
                     'boneFoldStep': [fold_index.get(i, 0) for i in range(len(bones))]},
            'steps': steps, '_bones': bones}


def to_js(work, header=''):
    """JSのソースコード文字列にする。"""
    m = work['mesh']
    def arr(rows, per=1):
        out = []
        for r in rows:
            out.append('[' + ', '.join(str(x) for x in r) + ']')
        return '\n      ' + ',\n      '.join(out) + '\n    '
    lines = []
    lines.append('// ' + '='*58)
    lines.append(f"// works/{work['id']}.js — {work['name']}")
    for h in header.split('\n'):
        lines.append('//   ' + h if h else '//')
    lines.append('//')
    lines.append('//   ★このファイルは tools/works_build.py が自動で書き出したもの。')
    lines.append('//     手で直さず、折り手順のほうを直して作り直すこと。')
    lines.append('//     折り手順を2Dで順算して作っているので、')
    lines.append('//     「実際にその通り折れる」ことが作りかたから保証されている。')
    lines.append('// ' + '='*58)
    lines.append("'use strict';")
    lines.append('')
    lines.append('window.ORIGAMI_WORKS = window.ORIGAMI_WORKS || {};')
    lines.append('')
    lines.append(f"ORIGAMI_WORKS.{work['id']} = {{")
    lines.append(f"  id: '{work['id']}', name: '{work['name']}', "
                 f"emoji: '{work['emoji']}', difficulty: {work['difficulty']},")
    if work.get('inflate'):
        inf = work['inflate']
        lines.append(f"  // ふきかけバー：{inf['step']+1}手目の折り目を最大{inf['deg']}度ひらいて立体にする")
        lines.append(f"  inflate: {{ step: {inf['step']}, deg: {inf['deg']} }},")
    if work.get('colorDown'):
        lines.append('  // 色のついた面を**下**にして置いて折り始める作品。')
        lines.append('  //   表と裏の色を入れかえて描くだけ（形も折り線も変わらない）。')
        lines.append('  colorDown: true,')
    lines.append('  mesh: {')
    lines.append('    verts: [' + arr(m['verts']) + '],')
    lines.append('    tris: [' + arr(m['tris']) + '],')
    lines.append('    uv: [' + arr(m['uv']) + '],')
    lines.append('    panel: [' + ', '.join(str(x) for x in m['panel']) + '],')
    lines.append('    boneParent: [' + ', '.join(str(x) for x in m['boneParent']) + '],')
    lines.append('    flatStack: true,   // 折り終わりがぺたんこ＝真上から見せる＋層を上へ積む')
    lines.append('    layerOrder: [' + ', '.join(str(x) for x in m['layerOrder']) + '],')
    if m.get('stackCount'):
        lines.append('    // その紙が何枚重なっている所か（多いほど硬い＝形が崩れない）')
        lines.append('    stackCount: [' + ', '.join(str(x) for x in m['stackCount']) + '],')
    lines.append('    // ヒンジの軸を紙の厚み何枚ぶん持ち上げるか（重なりはここから幾何で出る）')
    lines.append('    hingeY: [' + ', '.join(str(round(x, 4)) for x in m['hingeY']) + '],')
    lines.append('    boneFoldStep: [' + ', '.join(str(x) for x in m['boneFoldStep']) + '],')
    lines.append('    // 1手ごとの重なりの高さ（参考値。描画には使わない）')
    lines.append('    layerByStep: [')
    for row in m['layerByStep']:
        lines.append('      [' + ', '.join(str(x) for x in row) + '],')
    lines.append('    ],')
    lines.append('    hinge: [')
    for h in m['hinge']:
        if h is None:
            lines.append('      null,')
        else:
            lines.append(f"      {{ origin: {json.dumps(h['origin'])}, "
                         f"axis: {json.dumps(h['axis'])} }},")
    lines.append('    ],')
    lines.append('  },')
    lines.append('  steps: [')
    for s in work['steps']:
        hd = f"{{ boneId: {s['handle']['boneId']}, local: {json.dumps(s['handle']['local'])}"
        if 'linkedBoneIds' in s['handle']:
            hd += f", linkedBoneIds: {json.dumps(s['handle']['linkedBoneIds'])}"
        hd += ' }'
        cl = s['creaseLine']
        lines.append(f"    {{ id: {s['id']}, handle: {hd}, targetAngle: Math.PI, "
                     f"snapDeg: {s['snapDeg']}, returnAngle: {s['returnAngle']},")
        lines.append(f"      hintLabel: '{s['hintLabel']}',")
        lines.append(f"      creaseLine: {{ boneId: {cl['boneId']}, "
                     f"a: {json.dumps(cl['a'])}, b: {json.dumps(cl['b'])}, "
                     f"kind: '{cl['kind']}' }} }},")
    lines.append('  ],')
    lines.append('};')
    lines.append('')
    return '\n'.join(lines)
