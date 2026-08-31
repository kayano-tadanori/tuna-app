"""
折り紙CP(crease pattern)データから、線分がつくる「面(パネル)」を全部自動で見つける。
入力：線分のリスト(x0,y0,x1,y1,type)。境界線も折り線も全部まとめて1つの平面グラフとして扱う。
出力：各面のポリゴン(頂点の並び)と、面積合計(検算用)。
"""
import math

def load_opx(path):
    import xml.etree.ElementTree as ET
    tree = ET.parse(path)
    root = tree.getroot()
    lines = []
    for arr in root.iter('array'):
        if arr.get('class') == 'oripa.OriLineProxy':
            for void in arr.findall('void'):
                obj = void.find('object')
                d = {'type':0.0,'x0':0.0,'x1':0.0,'y0':0.0,'y1':0.0}
                for v in obj.findall('void'):
                    prop = v.get('property')
                    val = v.find('int')
                    if val is None: val = v.find('double')
                    d[prop] = float(val.text)
                lines.append(d)
    return lines

TOL = 1e-6

def pt_key(p):
    return (round(p[0]/TOL)*TOL, round(p[1]/TOL)*TOL)

def build_faces(segments):
    # segments: list of ((x0,y0),(x1,y1))
    # 1. 頂点を集める(端点のみ；このCPは端点でしか交わらない前提)
    verts = {}
    def vid(p):
        k = pt_key(p)
        if k not in verts:
            verts[k] = len(verts)
        return verts[k]
    vpos = {}
    edges = set()
    adj = {}
    for (a,b) in segments:
        ia, ib = vid(a), vid(b)
        vpos[ia] = a; vpos[ib] = b
        if ia == ib: continue
        edges.add((ia,ib)); edges.add((ib,ia))
        adj.setdefault(ia, []).append(ib)
        adj.setdefault(ib, []).append(ia)

    # 2. 各頂点で、隣接頂点を角度順にソート
    def ang(i,j):
        p,q = vpos[i], vpos[j]
        return math.atan2(q[1]-p[1], q[0]-p[0])
    for i in adj:
        adj[i] = sorted(set(adj[i]), key=lambda j: ang(i,j))

    # 3. half-edgeごとに「次の辺」＝到着した辺の逆から、反時計回りで次にある辺
    def next_half_edge(u,v):
        # 頂点vで、辺(v,u)の次(反時計回り)の辺(v,w)を返す
        nbrs = adj[v]
        idx = nbrs.index(u)
        w = nbrs[(idx-1) % len(nbrs)]  # 時計回りに面を辿るための向き(後で符号で判定)
        return v,w

    visited = set()
    faces = []
    for (u,v) in list(edges):
        if (u,v) in visited: continue
        face = []
        cu,cv = u,v
        while (cu,cv) not in visited:
            visited.add((cu,cv))
            face.append(cu)
            cu,cv = next_half_edge(cu,cv)
        faces.append(face)
    return faces, vpos

def polygon_area(poly, vpos):
    pts = [vpos[i] for i in poly]
    a = 0.0
    n = len(pts)
    for i in range(n):
        x0,y0 = pts[i]; x1,y1 = pts[(i+1)%n]
        a += x0*y1 - x1*y0
    return a/2.0

if __name__ == '__main__':
    lines = load_opx('oripa/sample/crane_base_mitani.opx')
    S = 200.0
    segs = []
    for l in lines:
        a = (l['x0']/S, l['y0']/S)
        b = (l['x1']/S, l['y1']/S)
        segs.append((a,b))
    faces, vpos = build_faces(segs)
    print("num raw faces (incl. outer):", len(faces))
    areas = [polygon_area(f, vpos) for f in faces]
    for i,(f,a) in enumerate(zip(faces,areas)):
        pts = [tuple(round(c,3) for c in vpos[v]) for v in f]
        print(i, "area=", round(a,4), "pts=", pts)
