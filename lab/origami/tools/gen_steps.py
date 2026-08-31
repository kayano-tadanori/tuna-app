"""
gen_steps2.py の根本修正版。

★発覚した問題：木に入らなかった46本の「余剰」の折り線は、実物では必ずいつか
折られる本物の折り筋なのに、ヒンジとして一切実装していなかった。そのため、
ある部分木を折って確定させると、その部分木の中の1枚と、余剰の折り線でつながる
別の(まだ折っていない)部分木の1枚との間で、紙が本当に裂けて見えるバグが起きた
(本人が実機で「いきなり紙が切れてる」と発見)。

★正しい直し方：46本の余剰の折り線は「祖先-子孫関係にある2パネルをつなぐもの」
が0本、全部「木の上で祖先でも子孫でもない2パネル」をつなぐものだった。
つまり全部、同期して同時に折らないと紙が裂ける。Union-Findで「余剰の折り線で
直接つながっている木のボーン」をグループ化すると、58本が14グループに
まとまった(最大12本の同時グループ、単独で安全なボーンは3本のみ)。

→ 各グループを1つの「まとめて折るステップ」にする(linkedBoneIds で同じ角度に
そろえる)。グループの処理順は、木の祖先-子孫関係を守るようトポロジカルソートする。
"""
import json, math, io
from collections import deque, defaultdict
from cp_faces import load_opx, build_faces, polygon_area, pt_key

lines = load_opx('oripa_sample/crane_final_mitani.opx')
def edge_key(a,b):
    ka,kb = pt_key(a), pt_key(b)
    return (ka,kb) if ka<kb else (kb,ka)
seg_type = {}
for l in lines:
    a=(l['x0'],l['y0']); b=(l['x1'],l['y1'])
    seg_type[edge_key(a,b)] = int(l['type'])

segs = [((l['x0'],l['y0']),(l['x1'],l['y1'])) for l in lines]
faces, vpos_raw = build_faces(segs)
areas = [polygon_area(f, vpos_raw) for f in faces]
panels_raw = [(i,f) for i,(f,a) in enumerate(zip(faces,areas)) if a > 0]

S = 200.0
def to3(vid):
    x,y = vpos_raw[vid]
    return [round(x/S,6), 0.0, round(y/S,6)]

def face_edges(f):
    n=len(f); return [(f[i],f[(i+1)%n]) for i in range(n)]
edge_to_panels = {}
for pidx,(orig_i,f) in enumerate(panels_raw):
    for (u,v) in face_edges(f):
        k = tuple(sorted((u,v)))
        edge_to_panels.setdefault(k, []).append(pidx)
adj = []
for k, lst in edge_to_panels.items():
    if len(lst) == 2:
        a3, b3 = vpos_raw[k[0]], vpos_raw[k[1]]
        t = seg_type.get(edge_key(a3,b3))
        adj.append({'panels': lst, 'v0': k[0], 'v1': k[1], 'type': t})

nbrs = {i: [] for i in range(len(panels_raw))}
for e in adj:
    p1,p2 = e['panels']
    nbrs[p1].append((p2,e)); nbrs[p2].append((p1,e))

ROOT = 4
root = ROOT
parent = {root: None}
tree_edge = {}
bfs_order = [root]
q = deque([root])
tset = set()
while q:
    u = q.popleft()
    for v,e in nbrs[u]:
        if v not in parent:
            parent[v]=u; tree_edge[v]=e; tset.add(id(e)); bfs_order.append(v); q.append(v)
assert len(parent) == len(panels_raw)
n = len(panels_raw)

children = {i: [] for i in range(n)}
for v,p in parent.items():
    if p is not None: children[p].append(v)
depth = {root: 0}
for v in bfs_order[1:]:
    depth[v] = depth[parent[v]] + 1

extra = [e for e in adj if id(e) not in tset]

def is_ancestor(a, b):
    x = b
    while x != -1:
        if x == a: return True
        x = parent.get(x, -1)
    return False

need_link = [e for e in extra if not is_ancestor(e['panels'][0], e['panels'][1])
             and not is_ancestor(e['panels'][1], e['panels'][0])]

# ---- Union-Find で同期グループを作る ----
uf = list(range(n))
def find(x):
    while uf[x] != x: uf[x] = uf[uf[x]]; x = uf[x]
    return x
def union(a,b):
    ra,rb = find(a), find(b)
    if ra != rb: uf[ra] = rb
for e in need_link:
    union(*e['panels'])

groups = defaultdict(list)
for i in range(n):
    if i == root: continue
    groups[find(i)].append(i)
group_list = list(groups.values())

# ---- グループ間のトポロジカル順序(祖先-子孫関係を守る) ----
# グループ代表(根に一番近いメンバー)の親グループを見て、グループDAGを作る
gid_of = {}
for gi, members in enumerate(group_list):
    for m in members: gid_of[m] = gi

gdeps = defaultdict(set)  # gdeps[g] = gより先に処理すべきグループの集合
for gi, members in enumerate(group_list):
    for m in members:
        p = parent[m]
        if p != -1 and p != root:
            pg = gid_of[p]
            if pg != gi:
                gdeps[gi].add(pg)

# ★グループ間の依存が循環することがある(union-findは木の階層と無関係に
#   組んだため)。強連結成分(SCC)で丸ごと1グループに併合してから
#   トポロジカルソートする。
import networkx as nx
G = nx.DiGraph()
G.add_nodes_from(range(len(group_list)))
for gi, deps in gdeps.items():
    for d in deps:
        G.add_edge(d, gi)  # d(先に折る) -> gi(後で折る)
sccs = list(nx.strongly_connected_components(G))
if len(sccs) != len(group_list):
    print('循環を検出、%d個のグループを%d個に併合' % (len(group_list), len(sccs)))
    new_group_list = []
    for scc in sccs:
        merged = []
        for gi in scc:
            merged.extend(group_list[gi])
        new_group_list.append(merged)
    group_list = new_group_list
    gid_of = {}
    for gi, members in enumerate(group_list):
        for m in members: gid_of[m] = gi
    gdeps = defaultdict(set)
    for gi, members in enumerate(group_list):
        for m in members:
            p = parent[m]
            if p != -1 and p != root:
                pg = gid_of[p]
                if pg != gi:
                    gdeps[gi].add(pg)

# トポロジカルソート(Kahn法)。
# ★2026-08-30 続き13：単純な「木の深さ」順だと、鳥の基本形(root+8枚の骨格)と
#   無関係な仕上げパネルが先に混じって処理され、途中経過が「鶴の折り方」として
#   意味をなさない(たー実測「1手目で紙が平らなまま」「棘が飛び出る」で発覚)。
#   まず「鳥の基本形の骨格(BASE9)を含むグループ」を最優先で全部終わらせ、
#   その後の仕上げグループは従来通り深さ順にする。
BASE9 = {15, 16, 27, 29, 31, 32, 46, 53}  # root(4)を除く8枚
group_is_base = [any(m in BASE9 for m in members) for members in group_list]
# ★続き14：仕上げ側(BASE9以外)も、鳥の基本形と同じ原則(「1本の枝を根元から
#   先端まで辿ってから次の枝へ」)で並べる。単純な深さ順だと別々の枝が
#   ばらばらに混ざり「首」「羽」「脚」がどれも同時進行の中途半端な状態で
#   混線して見える(本人「なってない！」で発覚)。深さ優先探索(DFS)の訪問順を
#   グループの優先度キーにすることで、1つの部位を完成させてから次へ進む。
dfs_order = {}
_counter = [0]
def _dfs(u):
    dfs_order[u] = _counter[0]
    _counter[0] += 1
    for c in sorted(children.get(u, [])):
        _dfs(c)
_dfs(root)
group_dfs_order = [min(dfs_order[m] for m in members) for members in group_list]
group_sort_key = [(0 if group_is_base[gi] else 1, group_dfs_order[gi]) for gi in range(len(group_list))]
indeg = {gi: 0 for gi in range(len(group_list))}
for gi, deps in gdeps.items():
    indeg[gi] = len(deps)
import heapq
ready = [(group_sort_key[gi], gi) for gi in range(len(group_list)) if indeg[gi] == 0]
heapq.heapify(ready)
succ = defaultdict(list)
for gi, deps in gdeps.items():
    for d in deps: succ[d].append(gi)
order_groups = []
indeg2 = dict(indeg)
while ready:
    _, gi = heapq.heappop(ready)
    order_groups.append(gi)
    for s in succ[gi]:
        indeg2[s] -= 1
        if indeg2[s] == 0:
            heapq.heappush(ready, (group_sort_key[s], s))
assert len(order_groups) == len(group_list), f'{len(order_groups)} vs {len(group_list)} (循環あり?)'

print('groups:', len(group_list), 'sizes:', sorted((len(m) for m in group_list), reverse=True))

# ---- 三角形分割 ----
# ★2026-08-30 続き13：「裂けない仕組み」。境界(折り筋)に接する頂点は、
#   自分のパネルだけでなく隣のパネルの変換ともブレンドする(renderer.jsのaPanel2/
#   aBlend参照)。どのステップでどの順に折っても、まだ折られていない隣のパネルとの
#   継ぎ目が大きく開いて「裂けて」見えることがなくなる(正確な物理でなく見た目の
#   演出でよい、という本人方針)。
BLEND_AMOUNT = 0.35
def build_verts():
    verts=[]; tris_out=[]; panel_out=[]; uv_out=[]; panel2_out=[]; blend_out=[]
    for pidx,(orig_i,f) in enumerate(panels_raw):
        pts3 = [to3(v) for v in f]
        m = len(pts3)
        base = len(verts)
        for i, p in enumerate(pts3):
            vid = f[i]
            prev_vid = f[(i-1) % m]
            next_vid = f[(i+1) % m]
            neighbor = None
            for other_vid in (prev_vid, next_vid):
                k = tuple(sorted((vid, other_vid)))
                panels_here = edge_to_panels.get(k, [])
                if len(panels_here) == 2:
                    neighbor = panels_here[0] if panels_here[1] == pidx else panels_here[1]
                    break
            verts.append(p); panel_out.append(pidx)
            uv_out.append([(p[0]+1)/2, (p[2]+1)/2])
            if neighbor is not None:
                panel2_out.append(neighbor); blend_out.append(BLEND_AMOUNT)
            else:
                panel2_out.append(pidx); blend_out.append(0.0)
        for i in range(1, m-1):
            a,b,c = pts3[0], pts3[i], pts3[i+1]
            area2 = (b[0]-a[0])*(c[2]-a[2]) - (b[2]-a[2])*(c[0]-a[0])
            if abs(area2) < 1e-9: continue
            tris_out.append([base, base+i, base+i+1])
    return verts, tris_out, panel_out, uv_out, panel2_out, blend_out

verts, tris_out, panel_out, uv_out, panel2_out, blend_out = build_verts()

boneParent = [-1]*n
hinge = [None]*n
mv_type = [None]*n
for v in bfs_order[1:]:
    boneParent[v] = parent[v]
    e = tree_edge[v]
    a3 = to3(e['v0']); b3 = to3(e['v1'])
    axis = [b3[0]-a3[0], b3[1]-a3[1], b3[2]-a3[2]]
    ln = math.sqrt(sum(c*c for c in axis))
    axis = [c/ln for c in axis]
    hinge[v] = {'origin': a3, 'axis': axis}
    mv_type[v] = e['type']

def panel_verts3(pidx):
    orig_i, f = panels_raw[pidx]
    return [to3(v) for v in f]

def dist_to_line(p, a, b):
    ax,ay,az=a; bx,by,bz=b; px,py,pz=p
    dx,dy,dz = bx-ax,by-ay,bz-az
    L2 = dx*dx+dy*dy+dz*dz
    if L2 < 1e-12: return 0
    t = ((px-ax)*dx+(py-ay)*dy+(pz-az)*dz)/L2
    cx,cy,cz = ax+t*dx, ay+t*dy, az+t*dz
    return math.sqrt((px-cx)**2+(py-cy)**2+(pz-cz)**2)

handle_local = [None]*n
for v in bfs_order[1:]:
    h = hinge[v]
    a = h['origin']; b = [h['origin'][i]+h['axis'][i] for i in range(3)]
    pts = panel_verts3(v)
    best = max(pts, key=lambda p: dist_to_line(p,a,b))
    handle_local[v] = best

# ---- グループごとに1ステップ。代表ボーン=グループ内で最も浅いもの ----
steps = []
for gi in order_groups:
    members = sorted(group_list[gi], key=lambda m: depth[m])
    main = members[0]
    others = members[1:]
    kind_counts = defaultdict(int)
    for m in members:
        k = 'mountain' if mv_type[m] == 2 else 'valley'
        kind_counts[k] += 1
    kind = 'valley' if kind_counts['valley'] >= kind_counts['mountain'] else 'mountain'
    verb = '谷折り' if kind == 'valley' else '山折り'
    h = hinge[main]
    # ★折り線の表示は「origin+単位ベクトル」という仮の長さで描いていたため、
    #   実際の紙の辺の端まで届かず、パネルの形とズレて見える不具合があった
    #   (本人が実機で「最初からヒンジがずれてる」と発見・2026-08-30)。
    #   tree_edge(本物の辺の両端点)から正しい終点を取る。
    e_main = tree_edge[main]
    # tree_edge['v0']は必ずorigin側(親のhinge.originと同じ点)とは限らないため、
    # hinge['origin']と近い方をorigin、遠い方をb_ptとして選ぶ
    v0_pt = to3(e_main['v0']); v1_pt = to3(e_main['v1'])
    def _d(p, q): return sum((p[i]-q[i])**2 for i in range(3))
    b_pt = v1_pt if _d(v0_pt, h['origin']) <= _d(v1_pt, h['origin']) else v0_pt
    step_id = len(steps) + 1
    label = '%d/%d 番目のまとまりを%s' % (step_id, len(order_groups), verb)
    if len(members) > 1:
        label += '(%d本の折り筋を同時に)' % len(members)
    steps.append({
        'id': step_id,
        'handle': {'boneId': main, 'local': handle_local[main], **({'linkedBoneIds': others} if others else {})},
        'targetAngle': math.pi, 'snapDeg': 0.35, 'returnAngle': 0,
        'hintLabel': label,
        'creaseLine': {'boneId': boneParent[main], 'a': h['origin'], 'b': b_pt, 'kind': kind},
    })

mesh = {
    'verts': verts, 'tris': tris_out, 'uv': uv_out, 'panel': panel_out,
    'boneParent': boneParent, 'hinge': hinge,
    'panel2': panel2_out, 'blend': blend_out,
}
out = {'mesh': mesh, 'steps': steps, 'root': root, 'group_sizes': [len(m) for m in group_list]}
with io.open('tsuru_steps3.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=True)
print('bones:', n, 'steps(groups):', len(steps))
for s in steps:
    print(' ', s['id'], s['hintLabel'], 'main=', s['handle']['boneId'], 'linked=', s['handle'].get('linkedBoneIds'))
