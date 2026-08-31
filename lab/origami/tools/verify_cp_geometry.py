"""折り紙のクリースパターンが幾何学的に正しいか検証するツール。
   Kawasaki's theorem: 各内部頂点で、交互の角度の和が180度(両方とも)
   Maekawa's theorem: 各内部頂点で、山折りの数 - 谷折りの数 = ±2
   を、CPデータの全ての内部頂点についてチェックする。
"""
import math
from collections import defaultdict
from cp_faces import load_opx, pt_key

def verify(opx_path):
    lines = load_opx(opx_path)
    print(f'=== {opx_path} ===')
    print('total lines (incl boundary):', len(lines))

    # build vertex -> list of (other_vertex, angle, type) adjacency
    vert_edges = defaultdict(list)
    all_verts = set()
    for l in lines:
        a = (round(l['x0'], 4), round(l['y0'], 4))
        b = (round(l['x1'], 4), round(l['y1'], 4))
        all_verts.add(a); all_verts.add(b)
        ang_ab = math.atan2(b[1]-a[1], b[0]-a[0])
        ang_ba = math.atan2(a[1]-b[1], a[0]-b[0])
        vert_edges[a].append((b, ang_ab, l['type']))
        vert_edges[b].append((a, ang_ba, l['type']))

    print('total unique vertices:', len(all_verts))

    # find bounding box to exclude boundary vertices from Kawasaki/Maekawa checks
    xs = [v[0] for v in all_verts]; ys = [v[1] for v in all_verts]
    xmin, xmax, ymin, ymax = min(xs), max(xs), min(ys), max(ys)
    def on_boundary(v):
        return abs(v[0]-xmin) < 1e-6 or abs(v[0]-xmax) < 1e-6 or abs(v[1]-ymin) < 1e-6 or abs(v[1]-ymax) < 1e-6

    interior_verts = [v for v in all_verts if not on_boundary(v)]
    print('interior vertices (to check):', len(interior_verts))

    maekawa_fail = []
    kawasaki_fail = []
    odd_degree = []
    for v in interior_verts:
        edges = vert_edges[v]
        if len(edges) < 4:
            # degree < 4 interior vertex is itself suspicious for flat-foldability (min degree 4 required)
            odd_degree.append((v, len(edges)))
            continue
        # Maekawa: count mountain(M) vs valley(V). type: 1=boundary,2=mountain,3=valley (per earlier code)
        m = sum(1 for e in edges if e[2] == 2)
        val = sum(1 for e in edges if e[2] == 3)
        diff = m - val
        if abs(diff) != 2:
            maekawa_fail.append((v, m, val, diff, len(edges)))
        # Kawasaki: sort edges by angle, sum every other gap
        angs = sorted(e[1] for e in edges)
        n = len(angs)
        gaps = [(angs[(i+1) % n] - angs[i]) % (2*math.pi) for i in range(n)]
        sum_even = sum(gaps[0::2])
        sum_odd = sum(gaps[1::2])
        if abs(sum_even - math.pi) > 0.01 or abs(sum_odd - math.pi) > 0.01:
            kawasaki_fail.append((v, math.degrees(sum_even), math.degrees(sum_odd)))

    print()
    print('vertices with degree < 4 (odd/suspicious):', len(odd_degree))
    for v, d in odd_degree[:10]:
        print(f'  {v} degree={d}')
    print()
    print('Maekawa theorem violations (M-V != +-2):', len(maekawa_fail))
    for v, m, val, diff, deg in maekawa_fail[:15]:
        print(f'  vertex={v} mountain={m} valley={val} diff={diff} degree={deg}')
    print()
    print('Kawasaki theorem violations (alternating angle sums != 180deg):', len(kawasaki_fail))
    for v, se, so in kawasaki_fail[:15]:
        print(f'  vertex={v} sum_even={se:.2f}deg sum_odd={so:.2f}deg')

    ok = len(maekawa_fail) == 0 and len(kawasaki_fail) == 0
    print()
    print('RESULT:', 'FLAT-FOLDABLE (all interior vertices pass)' if ok else 'NOT FLAT-FOLDABLE (violations found)')
    return ok

if __name__ == '__main__':
    import sys
    for path in (sys.argv[1:] or ['oripa_sample/crane_final_mitani.opx']):
        verify(path)
        print()
