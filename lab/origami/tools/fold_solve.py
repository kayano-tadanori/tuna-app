"""座標だけ入れたら、折り方を機械が絞る ── 私（バディ）の判断を外すための道具。

★なぜ要るか（本人 2026-09-05）
   「そこでバディの判断がはいってるんだけど、**座標入れたら計算できるようには
     できないのかな？**」

   実際そのとおりで、私は潰し折りの調査で4か所も勝手に決めていた：
     ①どの背をどの背へ重ねるか ②**何枚折るか** ③山か谷か ④どの面を根にするか
   とくに②は「いくつか試して**通った方を選ぶ**」というやり方だった。
   ところが「通った＝正しい」は今日3回とも外れている（→[[feedback_tsubushiori_2d_genkai]]）。

★でも枚数も山谷も、実は計算で決まっていた
   つるの③（ふくろを開いてつぶす）を実測すると：
       上1枚 → 中心の折り筋 5本（奇数）  ❌ Maekawa で落ちる
       上2枚 → 6本・山2谷4（|M-V|=2）    ✅
       上3枚 → 7本（奇数）               ❌
   **枚数は Maekawa が決めていた。**私が選ぶ余地は無かった。

★この道具のやること
   「この座標をこの座標へ」だけ受け取り、**折り方の候補を全部作って定理で落とす**。
   1. 折線＝2点の垂直二等分線（公理2。fold2d の fold_by_points と同じ）
   2. 動かす紙＝上からN枚／下からN枚／全部 を**全部ためす**
   3. 山谷も両方ためす
   4. 残ったものだけ返す

★🚨 いちばん大事な決まり
   **候補が複数残ったら、私が選ばない。「複数ある」と出す。**
   選んだ瞬間そこに判断が入り、しかも「通ったから正しい」で外す。
   複数残るのは折り図の絵（どの紙を動かしているか）で決まる情報が要るということ。
"""
import sys, io, contextlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import cp_export as CE


def _flat_ok(st, at=None):
    """展開図として平坦に折れるか。at を渡すとその頂点だけ見る。"""
    g = CE.build_planar_graph(CE.state_to_segments(st))
    bad = CE.check_flat_foldability(g)
    if at is not None:
        bad = [b for b in bad
               if abs(b['xy'][0] - at[0]) < 1e-6 and abs(b['xy'][1] - at[1]) < 1e-6]
    return (not bad), bad


def _tears(st, label='候補'):
    """実物の紙で折れるか（引き裂き・まん中の層）。check_foldable をそのまま使う。"""
    import check_foldable as CF
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            CF.audit(st, label)
    except Exception as e:
        return True, f'audit が落ちた: {e}'
    out = buf.getvalue()
    return ('NG' in out), out


def origin_groups(st, at, tol=1e-6):
    """★その座標に集まっている紙を「原紙のどこから来たか」でまとめる。

    「上から何枚」は私が選んだ数だったが、**原紙のどの部分か**は座標で言える。
    つるの②の角(1,1)を見ると：
        層0,1 → 原紙(+1,+1) の2枚 ／ 層2,3 → 原紙(-1,-1) の2枚
    ＝「上2枚」は恣意的な数ではなく「原紙(+1,+1)から来た紙」という**座標の話**だった
    （本人 2026-09-05「紙の重なりから、指定した座標に紙のどの部分が集まってるかは
      計算ででるよね」）。
    戻り値: [{'org': (x,y), 'panels': [i,...], 'layers': [n,...]}, ...]
    """
    import paper_links as PL
    rows = PL.at_point(st, at, tol=tol)
    groups = {}
    for r in rows:
        k = (round(r['org'][0], 6), round(r['org'][1], 6))
        g = groups.setdefault(k, {'org': k, 'panels': [], 'layers': []})
        g['panels'].append(r['panel']); g['layers'].append(r['layer'])
    return list(groups.values())


def candidates_by_origin(make_state, p_from, p_to, vertex=None):
    """★座標だけで折り方を絞る（枚数を人が選ばない版）。

    p_from に集まっている紙を「原紙のどこから来たか」で組に分け、
    **その組ごとに折ってみる**。組は紙が決めるので、私が数を選ぶ余地が無い。
    """
    import fold2d as F
    import vertex_rays as VR
    probe = make_state()
    groups = origin_groups(probe, p_from)
    alive, seen_sig = [], {}
    ways = [('全部', None)] + [(f'原紙({g["org"][0]:+.2f},{g["org"][1]:+.2f})の紙'
                               f'（{len(g["panels"])}枚）', g) for g in groups]
    for kind in ('V', 'M'):
        for (label, grp) in ways:
            st = make_state()
            before = len(st.panels)
            ln = F.axiom2_line(p_from, p_to)
            a, b = ln
            if F.side_of_line(p_from, a, b) > 0:
                a, b = b, a
            try:
                if grp is None:
                    st.fold(a, b, kind)
                else:
                    ids = {id(st.panels[i]) for i in grp['panels']}
                    st.fold(a, b, kind, panel_filter=lambda p: id(p) in ids)
            except Exception:
                continue
            if len(st.panels) == before:
                continue
            ok, _ = _flat_ok(st, at=vertex)
            if not ok:
                continue
            tore, _ = _tears(st, label)
            if tore:
                continue
            if abs(st.total_area() - 4 * st.paper['hw'] * st.paper['hh']) > 1e-9:
                continue
            sig = tuple(sorted((round(c['a'][0], 6), round(c['a'][1], 6),
                                round(c['b'][0], 6), round(c['b'][1], 6), c['kind'])
                               for c in st.crease_pattern()))
            if sig in seen_sig:
                seen_sig[sig]['also'].append(label); continue
            rays = None
            if vertex is not None:
                g2 = VR.graph_of(st)
                vi = min(range(len(g2['vertices'])),
                         key=lambda i: abs(g2['vertices'][i][0] - vertex[0])
                         + abs(g2['vertices'][i][1] - vertex[1]))
                rays = len([r for r in VR.rays_at(g2, vi)
                            if r['kind'] not in ('B', 'F')])
            item = {'how': label, 'kind': kind, 'panels': len(st.panels),
                    'rays': rays, 'also': [], 'state': st}
            seen_sig[sig] = item
            alive.append(item)
    return alive


def report_by_origin(make_state, p_from, p_to, vertex=None, title=''):
    if title:
        print(f'\n########## {title}')
    probe = make_state()
    gs = origin_groups(probe, p_from)
    print(f'  指示: ({p_from[0]:+.3f},{p_from[1]:+.3f}) を '
          f'({p_to[0]:+.3f},{p_to[1]:+.3f}) へ')
    print(f'  その座標に集まっている紙: '
          + ' ／ '.join(f'原紙({g["org"][0]:+.2f},{g["org"][1]:+.2f})×{len(g["panels"])}枚'
                        for g in gs))
    cs = candidates_by_origin(make_state, p_from, p_to, vertex=vertex)
    if not cs:
        print('  ★生き残った折り方が無い')
        return cs
    for c in cs:
        r = f' 中心の折り筋{c["rays"]}本' if c['rays'] is not None else ''
        same = f'  （＝{"・".join(c["also"][:3])}と同じ）' if c['also'] else ''
        print(f'    ✅ {c["how"]:<26} {c["kind"]}  紙{c["panels"]}枚{r}{same}')
    if len(cs) == 1:
        print(f'  → **1つに決まった**')
    else:
        print(f'  → 残り {len(cs)}通り。**勝手に選ばない**')
    return cs


def candidates(make_state, p_from, p_to, vertex=None, max_layers=6):
    """「p_from を p_to へ」の折り方の候補を全部ためして、生き残ったものを返す。

    make_state: 折る直前の状態を作って返す関数（毎回作り直すので副作用が残らない）
    vertex:     この頂点だけを見て平坦折りを判定する（省略すると全頂点）
    戻り値: [{'how': 説明, 'kind': 'M'/'V', 'count': n or None, 'side': ...,
              'panels': 枚数, 'rays': 中心の折り筋の本数}, ...]
    """
    import vertex_rays as VR
    ways = [('全部', None, None)]
    for n in range(1, max_layers + 1):
        ways.append((f'上{n}枚', n, 'top'))
        ways.append((f'下{n}枚', n, 'bottom'))

    alive = []
    seen_sig = {}
    for kind in ('V', 'M'):
        for (label, count, side) in ways:
            st = make_state()
            before = len(st.panels)
            try:
                if count is None:
                    st.fold_by_points(p_from, p_to, kind, only_containing=None)
                else:
                    # 折線は p_from→p_to の垂直二等分線（公理2）。枚数だけ変える。
                    import fold2d as F
                    ln = F.axiom2_line(p_from, p_to)
                    st.fold_layers(ln[0], ln[1], kind, count=count, side=side,
                                   cut_hint=p_from)
            except Exception:
                continue
            if len(st.panels) == before:
                continue                     # 何も動かなかった＝その折り方は無い
            ok, _bad = _flat_ok(st, at=vertex)
            if not ok:
                continue
            tore, _ = _tears(st, label)
            if tore:
                continue
            if abs(st.total_area() - 4 * st.paper['hw'] * st.paper['hh']) > 1e-9:
                continue
            # ★同じ折りを別候補として数えない。
            #   紙が4枚しかないのに「上4枚／上5枚／上6枚／全部」を別々に数えると、
            #   ありもしない曖昧さが18通りにも見える（2026-09-05に実際にやった）。
            #   結果の展開図（折線の位置と山谷）が同じなら**同じ折り**。
            sig = tuple(sorted((round(c['a'][0], 6), round(c['a'][1], 6),
                                round(c['b'][0], 6), round(c['b'][1], 6), c['kind'])
                               for c in st.crease_pattern()))
            if sig in seen_sig:
                seen_sig[sig]['also'].append(label)
                continue
            rays = None
            if vertex is not None:
                g = VR.graph_of(st)
                vi = min(range(len(g['vertices'])),
                         key=lambda i: abs(g['vertices'][i][0] - vertex[0])
                         + abs(g['vertices'][i][1] - vertex[1]))
                rs = [r for r in VR.rays_at(g, vi) if r['kind'] not in ('B', 'F')]
                rays = len(rs)
            item = {'how': label, 'kind': kind, 'count': count, 'side': side,
                    'panels': len(st.panels), 'rays': rays, 'also': []}
            seen_sig[sig] = item
            alive.append(item)
    return alive


def report(make_state, p_from, p_to, vertex=None, title=''):
    """候補を出して並べる。★複数残ったら選ばずにそのまま出す。"""
    if title:
        print(f'\n########## {title}')
    print(f'  指示: ({p_from[0]:+.3f},{p_from[1]:+.3f}) を '
          f'({p_to[0]:+.3f},{p_to[1]:+.3f}) へ')
    cs = candidates(make_state, p_from, p_to, vertex=vertex)
    if not cs:
        print('  ★生き残った折り方が無い（その座標では折れない）')
        return cs
    for c in cs:
        r = f' 中心の折り筋{c["rays"]}本' if c['rays'] is not None else ''
        same = f'  （＝{ "・".join(c["also"][:4]) }と同じ）' if c['also'] else ''
        print(f'    ✅ {c["how"]:<8} {c["kind"]}  紙{c["panels"]}枚{r}{same}')
    if len(cs) == 1:
        print(f'  → **1つに決まった**：{cs[0]["how"]} の {cs[0]["kind"]}')
    else:
        print(f'  → 🚨 **{len(cs)}通り残った。ここは座標だけでは決まらない**'
              f'（折り図のどの紙が動いているかが要る）。**勝手に選ばない。**')
    return cs
