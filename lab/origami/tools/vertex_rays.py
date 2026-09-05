"""頂点から出ている折線を確定させる ── 「この座標とこの座標を直線になるように折る」の相棒。

★何のためか（本人 2026-09-05）
   「この座標とこの座標を直線になるように折るってやると、**その頂点から出てる線を
     確定させる**ようなキットをつくりたいのよ。ただ**2Dだと表現できない部分がある**
     だろうから3Dで検査キットを作ろう」

   折りを座標で指定すると、その折線は必ずどこかの頂点に集まる。潰し折りのように
   1点に何本も集まる所では、**まだ引いていない線が残る**。ここはその頂点を見て
   「何本出ていて／偶数か／山谷の差は±2か／足りないなら**どの向きか**」まで出す。

★足りない線は計算で出せる（Kawasaki の定理）
   平坦に折れる内部の頂点では、**ひとつおきの角の和がどちらも180°**。
   既知の線が n 本あって1本足りないとき、この式は未知の角についての1次式になるので、
   **足りない線の向きが一意に決まる**。当てずっぽうで探さなくてよい。
   ⚠ Kawasaki/Maekawa を満たしても「実際に紙で折れる」保証にはならない
     （[[method_origami_cp_derivation]]§9）。ふるいであって証明ではない。

★2Dで足りない所＝3Dで測る（本人の言う「2Dだと表現できない部分」）
   **潰し折りかどうかは2Dでは分からない。**Kawasaki/Maekawa を満たし、`check_foldable`
   も通る「合法な折り」でも、潰し折りとは限らない（2026-09-05に実際に取りちがえた）。
   判定は3D側にある：**1点に集まる折線を同時に動かすと、骨の木では表せず紙が裂ける**。
   → `check_loop_closure.py` で裂ければ潰し折り＝`step.soft` が要る。裂けなければ普通の折り。

★使い方
   python vertex_rays.py                 … 潰し折りの例で動かす
   python vertex_rays.py koppu           … その作品の全頂点を診る
   ライブラリ：rays_at(st, xy) / report(st) / missing_ray(rays)
"""
import sys, math
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import cp_export as CE

TOL = 1e-6


def _ang(dx, dy):
    a = math.degrees(math.atan2(dy, dx))
    return a + 360 if a < 0 else a


def graph_of(st):
    """★2Dで済む所は既存を使う（本人 2026-09-05「2Dの計算で済む部分はあれを移植すれば」）。
       cp_export が交点で切り分けて頂点を統合した平面グラフを作ってくれる。"""
    return CE.build_planar_graph(CE.state_to_segments(st))


def rays_at(graph, vi):
    """頂点(番号 vi)から出ている折線（向き・山谷）を、角度順に返す。

    ⚠ 折線を端点だけで拾ってはいけない。**頂点を通りすぎる線**（例：紙を貫く
      まん中の折り線）は端点がそこに無いので取りこぼす——2026-09-05に実際にやった
      （5本あるのに3本しか拾えなかった）。平面グラフは交点で切ってあるので、
      そこから引けば取りこぼさない。
    """
    verts, edges, assign = graph['vertices'], graph['edges'], graph['assignment']
    vx, vy = verts[vi]
    out = []
    for (i, j), a in zip(edges, assign):
        u = j if i == vi else (i if j == vi else None)
        if u is None:
            continue
        out.append({'deg': _ang(verts[u][0] - vx, verts[u][1] - vy),
                    'kind': a, 'to': verts[u]})
    out.sort(key=lambda r: r['deg'])
    return out


def kawasaki_gap(rays):
    """ひとつおきの角の和。平坦に折れるなら どちらも180°。(和1, 和2) を返す。"""
    n = len(rays)
    if n < 2:
        return None
    gaps = [(rays[(i + 1) % n]['deg'] - rays[i]['deg']) % 360 for i in range(n)]
    return sum(gaps[0::2]), sum(gaps[1::2])


def missing_ray(rays):
    """★1本足りないとき、その向きを Kawasaki の式から解く。

    出ている線が奇数本なら、平坦に折れる頂点にはなり得ない（Maekawa）。
    足りない1本をどこかの角の中に入れると、その角 g が g1,g2 に割れて
    ひとつおきの和が入れかわる。「どちらの和も180°」から g1 が一意に決まる。
    入れられる角が複数あるときは候補を全部返す（どれが正しいかは紙の側が決める）。
    """
    n = len(rays)
    if n % 2 == 0:
        return []                      # 偶数＝本数としては足りている
    gaps = [(rays[(i + 1) % n]['deg'] - rays[i]['deg']) % 360 for i in range(n)]
    cands = []
    for i, g in enumerate(gaps):
        # i番の角の中、rays[i] から t 度の所に1本入れる。並びはこうなる：
        #   [g_0 … g_{i-1},  t,  g_i - t,  g_{i+1} … g_{n-1}]
        # ひとつおき（偶数番）の和が180°になる t を解く（tについて一次式）。
        const = sum(gaps[j] for j in range(i) if j % 2 == 0)          # 位置は変わらない
        const += sum(gaps[k] for k in range(i + 1, n) if (k + 1) % 2 == 0)  # 1つ後ろへずれる
        coef = 0.0
        if i % 2 == 0:
            coef += 1.0                       # t が偶数番に入る
        if (i + 1) % 2 == 0:
            const += g; coef -= 1.0           # (g - t) が偶数番に入る
        if abs(coef) < TOL:
            continue                           # t が式から消える＝この隙間では決まらない
        t = (180.0 - const) / coef
        # ★隙間の端（t≈0 や t≈g）は「すでにある線と同じ向き」＝新しい線ではない。
        #   落とさないと、既存の線が候補として二重に出る（2026-09-05に踏んだ）。
        if 1e-6 < t < g - 1e-6:
            cands.append({'deg': (rays[i]['deg'] + t) % 360,
                          'between': (rays[i]['deg'], rays[(i + 1) % n]['deg']),
                          't': t, 'g': g})
    return cands


def report(st, only_bad=True, title=''):
    """展開図の内部の頂点を全部診る。"""
    if title:
        print(f'\n########## {title}')
    g = graph_of(st)
    bad = {b['vertex']: b for b in CE.check_flat_foldability(g)}
    # ★「一部の層だけ折る」手がある作品では、折り筋が紙の途中で終わる。
    #   Kawasaki/Maekawa は「1枚の紙の全層を貫く折り筋」を前提にした定理なので、
    #   そのままでは当てはまらない＝**引っかかっても不具合とは限らない**
    #   （works_build.verify も同じ理由で参考値扱いにしている）。
    if any(s.get('partial') for s in st.steps):
        print('  ※ 一部の層だけ折る手があるので、この作品では'
              'Kawasaki/Maekawa は参考値（引っかかっても不具合とは限らない）')
    verts = g['vertices']
    n_shown = 0
    for vi in range(len(verts)):
        rs_all = rays_at(g, vi)
        if any(r['kind'] == 'B' for r in rs_all):
            continue                               # 紙のふちの上＝内部の頂点ではない
        rs = [r for r in rs_all if r['kind'] != 'F']   # 折り目だけの線は数えない
        if len(rs) < 3:
            continue
        b = bad.get(vi)
        if only_bad and not b:
            continue
        n_shown += 1
        p = verts[vi]
        k1, k2 = kawasaki_gap(rs) or (0, 0)
        m = sum(1 for r in rs if r['kind'] == 'M')
        v = sum(1 for r in rs if r['kind'] == 'V')
        print(f'\n  ◆ 頂点({p[0]:+.3f},{p[1]:+.3f})  出ている線 {len(rs)}本'
              f'  山{m}谷{v}  ひとつおきの和 {k1:.1f}° / {k2:.1f}°')
        for r in rs:
            print(f'      {r["deg"]:6.1f}°  {r["kind"]}  '
                  f'→({r["to"][0]:+.3f},{r["to"][1]:+.3f})')
        if b:
            print(f'      ★ {b["detail"]}')
        for c in missing_ray(rs):
            print(f'      🔎 足りない線の向き＝ {c["deg"]:.1f}°'
                  f'（{c["between"][0]:.1f}°と{c["between"][1]:.1f}°のあいだ）')
    if not n_shown:
        print('  平坦に折れない頂点は無い')


def crease_for(spec, arg1, arg2, hint=None):
    """★入口：座標で折りを指定すると、折線（無限直線 (a,b)）を返す。

    ここは**決め打ちにしない**（本人 2026-09-05「なるべく幅を持たせておいて」）。
    折り図の言い方はいろいろあるので、公理をそのまま並べて選べるようにしてある。

      'to_point'  P を Q に重ねる          … 公理2（垂直二等分線）
      'line_on'   直線1 を 直線2 に重ねる  … 公理3（角の二等分線／候補2本）
      'through'   P と Q を通る            … 公理1
      'perp'      直線に垂直で P を通る    … 公理4
      'onto_line' P を直線の上へ持っていく … 公理5（候補2本）
      'both'      直線を自分自身へ、P を直線へ … 公理7

    hint（紙の中の点）を渡すと、候補が複数あるときに選ぶ。
    ⚠ 公理6（2点を2直線へ同時に）はまだ fold2d に無い。
    """
    import fold2d as F
    if spec == 'through':
        return F.axiom1_line(arg1, arg2)
    if spec == 'to_point':
        return F.axiom2_line(arg1, arg2)
    if spec == 'line_on':
        return F.choose_line(F.axiom3_lines(arg1, arg2), hint_point=hint)
    if spec == 'perp':
        return F.axiom4_line(arg1, arg2)
    if spec == 'onto_line':
        # arg1=通す点, arg2=(重ねたい点, 重ねる先の直線)
        pt, (onto_pt, onto_line) = arg1, arg2
        return F.choose_line(F.axiom5_lines(pt, onto_line, onto_pt), hint_point=hint)
    if spec == 'both':
        pass_line, (onto_pt, onto_line) = arg1, arg2
        return F.axiom7_line(pass_line, onto_line, onto_pt)
    raise ValueError(f'知らない指定のしかた: {spec}')


def fold_and_report(st, line, kind='V', cut_hint=None, count=None, side='top',
                    title=''):
    """折線を実際に折って、その頂点から出ている線を確定させるところまで一息で。"""
    if line is None:
        print('  ★折線が出なかった（その指定では折れない）')
        return st
    a, b = line
    print(f'  折線: ({a[0]:+.4f},{a[1]:+.4f})−({b[0]:+.4f},{b[1]:+.4f})')
    if count is None:
        st.fold_axiom_line(line, kind, cut_hint=cut_hint)
    else:
        st.fold_layers(a, b, kind, count=count, side=side, cut_hint=cut_hint)
    report(st, title=title)
    return st


def _demo():
    from fold2d import FoldState, axiom3_lines, choose_line
    st = FoldState(1.0)
    st.fold((0, -1), (0, 1), 'V', name='たて半分')
    st.fold((-1, 0), (1, 0), 'V', name='よこ半分')
    ln = choose_line(axiom3_lines(((0, 0), (0, 1)), ((0, 0), (-1, 0))),
                     hint_point=(-0.5, 0.5))
    st.fold_layers(ln[0], ln[1], 'V', count=1, side='top', cut_hint=(-0.5, 0.5))
    report(st, title='公理3の二等分線で「上1枚」を折った状態')
    print('\n  （この頂点は線が1本足りない。上の🔎がその向き。'
          '\n    ただし「足りない線を入れれば潰し折り」ではない——'
          '\n    潰し折りかどうかは3Dで裂けるかで決まる → check_loop_closure.py）')


def main():
    names = [a for a in sys.argv[1:] if not a.startswith('-')]
    allv = '--all' in sys.argv[1:]
    if not names:
        _demo()
        return 0
    import works_build as W
    for nm in names:
        if nm not in W.BUILDERS:
            print(f'そんな作品はない: {nm}\nある作品: {", ".join(W.BUILDERS)}')
            return 2
        st, meta = W.BUILDERS[nm]()
        report(st, only_bad=not allv, title=f'{nm}（{meta["name"]}）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
