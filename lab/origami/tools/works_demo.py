"""実際の折り方どおりに順算して、伝承作品の展開図(CP)を作ってみる。

★ここで確かめたいこと
   fold2d.py が「本当に作品の折線を出せる道具になっているか」。
   ものさしは3つ：
     ① 面積が常に原紙と同じ（紙が消えたり増えたりしていない）
     ② パネルの枚数と、展開図から組み直した面の枚数が一致する
     ③ 出てきた折線が、手で考えた位置と合っている
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from fold2d import FoldState
import cp_export

ok_all = True
def check(name, ok, extra=''):
    global ok_all
    ok_all = ok_all and bool(ok)
    print(('OK  ' if ok else 'NG  ') + name + ((' … ' + extra) if extra else ''))

def audit(st, label):
    segs = cp_export.state_to_segments(st)
    g = cp_export.build_planar_graph(segs)
    faces = cp_export.extract_faces(g)
    paper = 4 * st.paper['hw'] * st.paper['hh']
    fa = 0.0
    for f in faces:
        poly = [g['vertices'][i] for i in f]
        a = 0.0
        for i in range(len(poly)):
            x1, y1 = poly[i]; x2, y2 = poly[(i+1) % len(poly)]
            a += x1*y2 - x2*y1
        fa += abs(a)/2
    bad = cp_export.check_flat_foldability(g)
    print(f'   [{label}] 紙{len(st.panels)}枚 / 折線{len(st.crease_pattern())}本 / '
          f'頂点{len(g["vertices"])} 辺{len(g["edges"])} 面{len(faces)} / '
          f'面積{fa:.6f} / 折れない頂点{len(bad)}か所')
    check(f'{label}: 面積が原紙と同じ', abs(st.total_area() - paper) < 1e-9,
          f'{st.total_area():.9f}')
    check(f'{label}: 展開図の面の面積合計が原紙と同じ', abs(fa - paper) < 1e-9, f'{fa:.9f}')
    check(f'{label}: 紙の枚数 = 展開図の面の枚数', len(st.panels) == len(faces),
          f'{len(st.panels)} vs {len(faces)}')
    return g, bad


def blintz(st, corners):
    """座布団折り：4つの角を中心へ。実際の紙と同じで、重なった層は一度に折る。"""
    for c in corners:
        st.fold_by_points(c, (0, 0), 'V', only_containing=None,
                          name=f'角{c}を中心へ')
    return st


print('=== やっこさん：座布団折り3回＋裏返し2回（全部ふつうの折りだけ） ===')
st = FoldState(1.0)
blintz(st, [(1, 1), (-1, 1), (-1, -1), (1, -1)])
audit(st, '1回目の座布団折り')

st.flip('v')
blintz(st, [(1, 0), (0, 1), (-1, 0), (0, -1)])
audit(st, '裏返して2回目')

st.flip('v')
blintz(st, [(0.5, 0.5), (-0.5, 0.5), (-0.5, -0.5), (0.5, -0.5)])
g, bad = audit(st, '裏返して3回目（やっこさんの土台）')

cp = st.crease_pattern()
print()
print('  出てきた折線（原紙の座標）:')
for c in sorted(cp, key=lambda c: (round(c['a'][0], 4), round(c['a'][1], 4))):
    print(f"    {c['kind']}  ({c['a'][0]:+.4f},{c['a'][1]:+.4f}) - "
          f"({c['b'][0]:+.4f},{c['b'][1]:+.4f})   {c['layers']}層")

# ★手で考えた期待値との突き合わせ
#   1回目の座布団折り＝辺の中点をむすぶ4本（±1,0),(0,±1)
#   2回目＝その内側の正方形の辺の中点をむすぶ4本 → (±0.5,±0.5)を結ぶ線
#   3回目＝さらに内側 → (±0.5,0),(0,±0.5)を結ぶ線
want_1 = {((-1.0, 0.0), (0.0, 1.0)), ((0.0, 1.0), (1.0, 0.0)),
          ((0.0, -1.0), (1.0, 0.0)), ((-1.0, 0.0), (0.0, -1.0))}
got = set()
for c in cp:
    a = (round(c['a'][0], 6) + 0.0, round(c['a'][1], 6) + 0.0)
    b = (round(c['b'][0], 6) + 0.0, round(c['b'][1], 6) + 0.0)
    got.add((a, b) if a <= b else (b, a))
check('1回目の折線（辺の中点をむすぶ4本）が全部ある', want_1 <= got,
      str(sorted(want_1 - got)))
check('折線の本数が16本（4本×3回。ただし層ごとに割れるので実際はもっと多い）',
      len(cp) >= 12, str(len(cp)))
check('やっこさんの土台: 折れない頂点0か所', len(bad) == 0,
      '; '.join(f"({b['xy'][0]:.3f},{b['xy'][1]:.3f}) {b['detail']}" for b in bad[:4]))

fold = cp_export.save_fold(st, str(Path(__file__).parent / 'preview' / 'yakko.fold'),
                           title='やっこさんの土台')
print()
print(f"  FOLD書き出し: 頂点{len(fold['vertices_coords'])} "
      f"辺{len(fold['edges_vertices'])} 面{len(fold['faces_vertices'])}")

print()
print('=== かぶと：全部ふつうの折りでできる作品 ===')
# 正方形を対角線で半分に折る → 二等辺三角形。そこから角を折り上げていく。
kb = FoldState(1.0)
kb.fold_by_points((-1, 1), (1, -1), 'V', only_containing=None, name='対角線で半分に')
audit(kb, 'かぶと1: 対角線で半分')
# いまの形は (-1,-1),(1,-1),(1,1) の直角二等辺三角形。
# 左右の下の角を、上の頂点(1,1)へ折り上げる（実際のかぶとの2手目）。
kb.fold_by_points((-1, -1), (1, 1), 'V', only_containing=None, name='左下の角を上へ')
audit(kb, 'かぶと2: 左下の角を上へ')
cpk = kb.crease_pattern()
print(f'  折線 {len(cpk)}本:')
for c in sorted(cpk, key=lambda c: (round(c['a'][0], 4), round(c['a'][1], 4))):
    print(f"    {c['kind']}  ({c['a'][0]:+.4f},{c['a'][1]:+.4f}) - "
          f"({c['b'][0]:+.4f},{c['b'][1]:+.4f})   {c['layers']}層")

print()
print('=== 総合 ===')
print('ALL OK' if ok_all else '★NGあり')
