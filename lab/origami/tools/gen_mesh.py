"""
crane_final_mitani.opx から tsuru.js と同じ形式(work.mesh)のJSデータを自動生成する。
- パネル(59枚)を三角形分割
- 木構造(58本)のヒンジをフラット状態のローカル座標(origin,axis)で出力
- 座標は Mitani の(x,y)をそのまま(x/200, 0, y/200) として X-Z平面に置く(existing tsuru.jsのN=[0,0,1]と同じ流儀)
"""
import json, math
from collections import deque
from cp_faces import load_opx, build_faces, polygon_area, pt_key

lines = load_opx('oripa_sample/crane_final_mitani.opx')
def edge_key(a,b):
    ka,kb = pt_key(a), pt_key(b)
    return (ka,kb) if ka<kb else (kb,ka)
segs = []
for l in lines:
    segs.append(((l['x0'],l['y0']),(l['x1'],l['y1'])))
faces, vpos_raw = build_faces(segs)
areas = [polygon_area(f, vpos_raw) for f in faces]
panels_raw = [(i,f) for i,(f,a) in enumerate(zip(faces,areas)) if a > 0]

S = 200.0
def to3(vid):
    x,y = vpos_raw[vid]
    return [x/S, 0.0, y/S]

# 隣接抽出(cp_adjacency.pyと同じロジック)
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
        adj.append({'panels': lst, 'v0': k[0], 'v1': k[1]})

nbrs = {p['idx'] if False else i: [] for i,_ in enumerate(panels_raw)}
for e in adj:
    p1,p2 = e['panels']
    nbrs[p1].append((p2,e)); nbrs[p2].append((p1,e))

root = max(range(len(panels_raw)), key=lambda i: areas[panels_raw[i][0]])
parent = {root: None}
tree_edge = {}
order = [root]
q = deque([root])
tset = set()
while q:
    u = q.popleft()
    for v,e in nbrs[u]:
        if v not in parent:
            parent[v]=u; tree_edge[v]=e; tset.add(id(e)); order.append(v); q.append(v)
assert len(parent) == len(panels_raw)
extra_edges = [e for e in adj if id(e) not in tset]
print("panels:", len(panels_raw), "tree edges:", len(tset), "extra:", len(extra_edges))

# 三角形分割(ファン)。凸でない多角形があればここで検出する。
def fan_triangulate(poly_ids):
    tris = []
    for i in range(1, len(poly_ids)-1):
        tris.append([poly_ids[0], poly_ids[i], poly_ids[i+1]])
    return tris

def tri_area2(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])

bad_panels = []
for pidx,(orig_i,f) in enumerate(panels_raw):
    pts = [vpos_raw[v] for v in f]
    n = len(pts)
    tris = fan_triangulate(list(range(n)))
    for (a,b,c) in tris:
        ar = tri_area2(pts[a], pts[b], pts[c])
        if ar <= 1e-6:
            bad_panels.append((pidx, n, ar))
print("panels with degenerate/negative fan triangle:", len(bad_panels))
if bad_panels[:5]: print(bad_panels[:5])

# ---- verts/tris/panel/uv/boneParent/hinge を組み立て ----
verts = []; tris_out = []; panel_out = []; uv_out = []
def uvf(p3):
    return [(p3[0]+1)/2, (p3[2]+1)/2]

for pidx,(orig_i,f) in enumerate(panels_raw):
    pts3 = [to3(v) for v in f]
    n = len(pts3)
    base = len(verts)
    for p in pts3:
        verts.append(p); panel_out.append(pidx); uv_out.append(uvf(p))
    for i in range(1, n-1):
        tris_out.append([base, base+i, base+i+1])

boneParent = [-1]*len(panels_raw)
hinge = [None]*len(panels_raw)
for v in order[1:]:
    boneParent[v] = parent[v]
    e = tree_edge[v]
    a3 = to3(e['v0']); b3 = to3(e['v1'])
    axis = [b3[0]-a3[0], b3[1]-a3[1], b3[2]-a3[2]]
    ln = math.sqrt(sum(c*c for c in axis))
    axis = [c/ln for c in axis]
    hinge[v] = {'origin': a3, 'axis': axis}

mesh = {
    'verts': verts, 'tris': tris_out, 'uv': uv_out, 'panel': panel_out,
    'boneParent': boneParent, 'hinge': hinge,
}
json.dump(mesh, open('tsuru_full_mesh.json','w'))
print("verts:", len(verts), "tris:", len(tris_out), "bones:", len(boneParent))
print("saved tsuru_full_mesh.json")

# 検算：全ヒンジをpiまで折った最終位置で、余剰56本が閉じるか(前回と同じロジックで再確認)
import numpy as np
def rot180(p0, d):
    d = np.array(d); d = d/np.linalg.norm(d)
    R3 = 2*np.outer(d,d) - np.eye(3)
    M = np.eye(4); M[:3,:3]=R3; M[:3,3] = np.array(p0) - R3@np.array(p0)
    return M
M = {root: np.eye(4)}
for v in order[1:]:
    u = parent[v]
    h = hinge[v]
    Mu = M[u]
    origin_w = (Mu @ np.append(h['origin'],1.0))[:3]
    axis_w = Mu[:3,:3] @ np.array(h['axis'])
    Rloc = rot180(origin_w, axis_w)
    M[v] = Rloc @ Mu
def apply(Mm, v3):
    return (Mm @ np.append(v3,1.0))[:3]
errs=[]
for e in extra_edges:
    p1,p2 = e['panels']
    a3, b3 = to3(e['v0']), to3(e['v1'])
    a1,b1 = apply(M[p1],a3), apply(M[p1],b3)
    a2,b2 = apply(M[p2],a3), apply(M[p2],b3)
    err = min(max(np.linalg.norm(a1-a2),np.linalg.norm(b1-b2)), max(np.linalg.norm(a1-b2),np.linalg.norm(b1-a2)))
    errs.append(err)
errs=np.array(errs)
print("re-check with actual mesh hinge data: max err=", errs.max())
