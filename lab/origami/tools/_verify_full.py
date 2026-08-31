import json, math
import numpy as np
exec(open('gen_steps.py', encoding='utf-8').read().split("with io.open")[0])

# ---- ロドリゲスの回転(fold.jsのmat4HingeRotateと同じ規約) ----
def hinge_matrix(origin, axis, angle):
    ox, oy, oz = origin
    ax, ay, az = axis
    c, s = math.cos(angle), math.sin(angle)
    C = 1 - c
    R = np.array([
        [ax*ax*C+c,    ax*ay*C-az*s, ax*az*C+ay*s],
        [ay*ax*C+az*s, ay*ay*C+c,    ay*az*C-ax*s],
        [az*ax*C-ay*s, az*ay*C+ax*s, az*az*C+c],
    ])
    t = np.array([ox,oy,oz]) - R @ np.array([ox,oy,oz])
    M = np.eye(4)
    M[:3,:3] = R
    M[:3,3] = t
    return M

def apply(M, p):
    v = M @ np.array([p[0],p[1],p[2],1.0])
    return v[:3]

# boneParent/hinge は panels_raw のインデックス(0..n-1, root=4)と同じ
angles = [0.0]*n
for gi, members in enumerate(group_list):
    for m in members:
        angles[m] = math.pi

order = [root]
visited = {root}
q = [root]
while q:
    u = q.pop(0)
    for c in children[u]:
        order.append(c); q.append(c)

mats = {root: np.eye(4)}
for v in order[1:]:
    p = boneParent[v]
    Mp = mats[p]
    h = hinge[v]
    Mrel = hinge_matrix(h['origin'], h['axis'], angles[v])
    # fold.js: originW = Mp . origin ; axisW = Mp.dir . axis ; rot = hingeRotate(originW,axisW,angle); out = rot . Mp
    originW = apply(Mp, h['origin'])
    axisW = Mp[:3,:3] @ np.array(h['axis'])
    axisW = axisW/np.linalg.norm(axisW)
    rot = hinge_matrix(originW, axisW, angles[v])
    mats[v] = rot @ Mp

def panel_world_verts(pidx):
    pts3 = panel_verts3(pidx)
    M = mats[pidx]
    return [apply(M, p) for p in pts3]

def panel_world_map(pidx):
    orig_i, f = panels_raw[pidx]
    pts3 = [to3(v) for v in f]
    M = mats[pidx]
    return {vid: apply(M, p) for vid, p in zip(f, pts3)}

# 全ての隣接ペア(tree edge + extra)を、フィルタなしで検算
all_adj = list(adj)
max_err = 0.0
bad = []
for e in all_adj:
    p1, p2 = e['panels']
    m1 = panel_world_map(p1)
    m2 = panel_world_map(p2)
    for vid in (e['v0'], e['v1']):
        if vid in m1 and vid in m2:
            d = np.linalg.norm(m1[vid] - m2[vid])
            if d > max_err: max_err = d
            if d > 0.01:
                bad.append((p1, p2, vid, d))

print('total adjacency pairs checked:', len(all_adj))
print('max vertex error across ALL adjacencies (no filter):', max_err)
print('num bad (>0.01) pairs:', len(bad))
for b in bad[:30]:
    print(' panel', b[0], 'vs panel', b[1], 'vertex', b[2], 'err', b[3])

# 面積チェック: 全パネルの面積合計が正方形と一致するか(折りたたみ後は射影面積は減るはずなので、
# ここではflat状態(angle=0)の面積合計だけ再確認)
total_flat_area = sum(polygon_area(f, vpos_raw) for f in faces if polygon_area(f, vpos_raw) > 0)
print('flat total area (should be near 400*400=160000):', total_flat_area)
