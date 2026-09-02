"""fold2d.py の「原紙座標の追跡＝展開図が出せるか」を、実際に折って検算する。

★検算の考え方（[[feedback_verify_mechanism_not_just_answer]]）
   「線が出た」で満足しない。独立した2つの経路で同じ答えになることを確かめる。
   1) fold2d.py が持つパネル（折った紙の断片）の枚数・面積
   2) cp_export.py が展開図の線分から平面グラフを組み直して数えた面の枚数・面積
   この2つは実装がまったく別物なので、一致すれば折り筋の位置が正しい強い証拠になる。
"""
import sys, math
from fold2d import FoldState, xf_apply, xf_inv_apply, xf_is_flipped
import cp_export

ok_all = True


def check(name, ok, extra=''):
    global ok_all
    ok_all = ok_all and bool(ok)
    print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))


def poly_area(poly):
    a = 0.0
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def cross_check(st, label, expect_panels=None):
    """パネル枚数 vs 展開図の面の枚数、面積の合計 vs 原紙の面積。"""
    segs = cp_export.state_to_segments(st)
    g = cp_export.build_planar_graph(segs)
    faces = cp_export.extract_faces(g)
    paper_area = 4 * st.paper['hw'] * st.paper['hh']
    face_area = 0.0
    for f in faces:
        face_area += poly_area([g['vertices'][i] for i in f])
    src_area = 0.0
    for p in st.panels:
        src_area += poly_area([xf_inv_apply(p['xf'], q) for q in p['poly']])
    check(f'{label}: 展開図の面の合計面積 = 原紙の面積', abs(face_area - paper_area) < 1e-9,
          f'{face_area:.9f} vs {paper_area}')
    check(f'{label}: パネルを原紙に戻した合計面積 = 原紙の面積',
          abs(src_area - paper_area) < 1e-9, f'{src_area:.9f}')
    check(f'{label}: パネル枚数 = 展開図の面の枚数', len(st.panels) == len(faces),
          f'panels={len(st.panels)} faces={len(faces)}')
    if expect_panels is not None:
        check(f'{label}: パネル枚数が想定どおり({expect_panels})',
              len(st.panels) == expect_panels, str(len(st.panels)))
    return g, faces


print('=== (1) 座布団折り：4つの角を中心に折る ===')
st = FoldState(1.0)
for corner in [(1, 1), (-1, 1), (-1, -1), (1, -1)]:
    st.fold_by_points(corner, (0, 0), 'V')
cp = st.crease_pattern()
check('座布団折り: 折り筋は4本', len(cp) == 4, str(len(cp)))
# 期待する4本＝辺の中点どうしを結ぶ線
want = {((-1.0, 0.0), (0.0, 1.0)), ((0.0, 1.0), (1.0, 0.0)),
        ((0.0, -1.0), (1.0, 0.0)), ((-1.0, 0.0), (0.0, -1.0))}
got = set()
for c in cp:
    a = (round(c['a'][0], 9) + 0.0, round(c['a'][1], 9) + 0.0)
    b = (round(c['b'][0], 9) + 0.0, round(c['b'][1], 9) + 0.0)
    got.add((a, b) if a <= b else (b, a))
check('座布団折り: 折り筋が辺の中点どうしを結ぶ4本と一致', got == want, str(sorted(got)))
check('座布団折り: 全部谷折り', all(c['kind'] == 'V' for c in cp))
cross_check(st, '座布団折り', expect_panels=5)

print()
print('=== (2) 半分→さらに半分：重なった2枚を一度に折ると、開くと別々の筋になる ===')
st2 = FoldState(1.0)
st2.fold_by_points((-1, -1), (1, -1), 'V')      # x=0 で左を右へ
check('半分: パネル2枚', len(st2.panels) == 2, str(len(st2.panels)))
st2.fold_by_points((1, -1), (0, -1), 'V')       # x=0.5 で右を左へ(2枚同時)
cp2 = st2.crease_pattern()
xs = sorted(round(c['a'][0], 9) for c in cp2)
check('4つ折り: 折り筋は3本', len(cp2) == 3, str(len(cp2)))
check('4つ折り: 位置は x=-0.5, 0, 0.5', xs == [-0.5, 0.0, 0.5], str(xs))
kinds = {round(c['a'][0], 9): c['kind'] for c in cp2}
# ★裏返っている層(元の左半分)に付いた折り筋は、原紙の表から見ると山折りになる
check('4つ折り: x=0 は谷', kinds[0.0] == 'V', kinds[0.0])
check('4つ折り: x=0.5 は谷(表のまま折った層)', kinds[0.5] == 'V', kinds[0.5])
check('4つ折り: x=-0.5 は山(裏返った層に付いた筋)', kinds[-0.5] == 'M', kinds[-0.5])
cross_check(st2, '4つ折り', expect_panels=4)

print()
print('=== (3) 裏返す：flipのあとの谷折りは、原紙では山折りとして記録される ===')
st3 = FoldState(1.0)
st3.flip('v')
st3.fold_by_points((-1, -1), (1, -1), 'V')
cp3 = st3.crease_pattern()
check('裏返して谷折り: 折り筋1本', len(cp3) == 1, str(len(cp3)))
check('裏返して谷折り: 原紙では山折り', cp3 and cp3[0]['kind'] == 'M',
      cp3[0]['kind'] if cp3 else 'なし')
check('裏返して谷折り: 位置は x=0', cp3 and abs(cp3[0]['a'][0]) < 1e-12)

print()
print('=== (4) 折り目だけつけて開く(precrease)：紙は動かず筋と参照点だけ残る ===')
st4 = FoldState(1.0)
before = st4.total_area()
st4.crease_only((-1, -1), (1, 1), 'M', name='対角線に折り目')
check('precrease: 面積は変わらない', abs(st4.total_area() - before) < 1e-12,
      f'{st4.total_area():.9f}')
check('precrease: 紙はまだ原紙と同じ広がり', abs(st4.bounding_area() - 4.0) < 1e-12,
      f'{st4.bounding_area():.9f}')
check('precrease: パネルは2枚に割れている(新しい参照点ができた)',
      len(st4.panels) == 2, str(len(st4.panels)))
cp4 = st4.crease_pattern()
check('precrease: 折り筋が1本記録された', len(cp4) == 1, str(len(cp4)))
check('precrease: 山折りとして記録', cp4 and cp4[0]['kind'] == 'M')
# ★つけた折り目を使って本当に折れるか。(-1,1)を(1,-1)に合わせる折り線は
#   その垂直二等分線＝いま折り目をつけた対角線 y=x そのもの。
st4.fold_by_points((-1, 1), (1, -1), 'V')
check('precrease後に折れる: パネルは2枚のまま(既存の筋で折れた)',
      len(st4.panels) == 2, str(len(st4.panels)))
check('precrease後に折れる: 面積は保たれる', abs(st4.total_area() - 4.0) < 1e-12,
      f'{st4.total_area():.9f}')
side_ok = all(q[1] <= q[0] + 1e-9 for p in st4.panels for q in p['poly'])
check('precrease後に折れる: 紙が全部 y=x の下側に畳まれた', side_ok)
cp4b = st4.crease_pattern()
check('precrease後に折れる: 折り筋は1本のまま(同じ位置なので増えない)',
      len(cp4b) == 1, str(len(cp4b)))
check('precrease後に折れる: 山谷は「実際に折った向き」で上書きされる(M→V)',
      cp4b and cp4b[0]['kind'] == 'V', cp4b[0]['kind'] if cp4b else 'なし')

print()
print('=== (5) 変換の逆写像そのものの検算 ===')
st5 = FoldState(1.0)
st5.fold_by_points((1, 1), (0, 0), 'V')
st5.fold_by_points((-1, -1), (0, 0), 'V')
worst = 0.0
for p in st5.panels:
    for q in p['poly']:
        back = xf_apply(p['xf'], xf_inv_apply(p['xf'], q))
        worst = max(worst, math.hypot(back[0] - q[0], back[1] - q[1]))
check('xf_apply(xf_inv_apply(p)) == p', worst < 1e-12, f'最大誤差 {worst:.3e}')
# 原紙に戻した頂点は必ず原紙の中に収まる
outside = 0
for p in st5.panels:
    for q in p['poly']:
        s = xf_inv_apply(p['xf'], q)
        if abs(s[0]) > 1.0 + 1e-9 or abs(s[1]) > 1.0 + 1e-9:
            outside += 1
check('原紙に戻した頂点が全部、原紙の中にある', outside == 0, f'はみ出し{outside}点')

print()
print('=== (6) FOLD形式の書き出し（origamisimulator.org が読める形か） ===')
fold = cp_export.state_to_fold(st, title='座布団折り')
check('FOLD: 頂点8(角4+辺の中点4)', len(fold['vertices_coords']) == 8,
      str(len(fold['vertices_coords'])))
check('FOLD: 面5(中央の正方形+角の三角4)', len(fold['faces_vertices']) == 5,
      str(len(fold['faces_vertices'])))
check('FOLD: ふちは8本(角と中点で分割される)',
      sum(1 for a in fold['edges_assignment'] if a == 'B') == 8,
      str(sum(1 for a in fold['edges_assignment'] if a == 'B')))
check('FOLD: 谷折りは4本', sum(1 for a in fold['edges_assignment'] if a == 'V') == 4,
      str(sum(1 for a in fold['edges_assignment'] if a == 'V')))
bad = cp_export.check_flat_foldability(cp_export.build_planar_graph(
    cp_export.state_to_segments(st)))
check('座布団折り: Kawasaki/Maekawa 違反0', len(bad) == 0, str(bad))

print()
print('=== 総合 ===')
print('ALL OK' if ok_all else '★NGあり')
sys.exit(0 if ok_all else 1)
