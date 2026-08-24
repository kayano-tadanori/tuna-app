# -*- coding: utf-8 -*-
"""okan_model.js を読んで、UVのどこが 体のどこか を引けるようにする道具。

テクスチャを描きなおすには「この絵はどの部分か」「どっちが上か」が要る。
どちらも モデルの pos（立ち姿のワールド座標）と uv から 計算で出せる。

  load()                     … モデルを読む
  tris_by_bone(M, b)         … その骨に属する三角形
  tris_in_box(M, ...)        … 体の位置で選ぶ
  uv_bbox(M, tris)           … 選んだ三角形が テクスチャのどこを占めるか
  up_dir_in_uv(M, tris)      … 「体の上」が テクスチャ上でどっち向きか
  mask_of(M, tris, W, H)     … その三角形が塗るテクスチャの範囲（白黒画像）
"""
import base64
import io
import json
import math
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODEL_JS = os.path.join(ROOT, 'js', 'okan_model.js')

BONE = {'ROOT': 0, 'TORSO': 1, 'HEAD': 2, 'ALU': 3, 'ALF': 4,
        'ARU': 5, 'ARF': 6, 'LL': 7, 'LR': 8, 'CHI': 9}


def _f32(b64):
    raw = base64.b64decode(b64)
    return list(struct.unpack('<%df' % (len(raw) // 4), raw))


def _u16(b64):
    raw = base64.b64decode(b64)
    return list(struct.unpack('<%dH' % (len(raw) // 2), raw))


def _u32(b64):
    raw = base64.b64decode(b64)
    return list(struct.unpack('<%dI' % (len(raw) // 4), raw))


def load(path=MODEL_JS):
    s = io.open(path, encoding='utf-8').read()
    j = s[s.index('{'):s.rindex('}') + 1]
    d = json.loads(j)
    M = {
        'n': d['n'], 'dims': d['dims'], 'tex': d['tex'],
        'pos': _f32(d['pos']), 'uv': _f32(d['uv']),
        'nrm': _f32(d['nrm']), 'bone': _f32(d['bone']),
        'idx': _u32(d['idx']) if d.get('idx32') else _u16(d['idx']),
    }
    M['ntri'] = len(M['idx']) // 3
    return M


def tri_verts(M, t):
    i = M['idx']
    return i[t * 3], i[t * 3 + 1], i[t * 3 + 2]


def tri_pos(M, t):
    p = M['pos']
    return [[p[v * 3], p[v * 3 + 1], p[v * 3 + 2]] for v in tri_verts(M, t)]


def tri_uv(M, t):
    u = M['uv']
    return [[u[v * 2], u[v * 2 + 1]] for v in tri_verts(M, t)]


def vert_bone(M, v):
    """いちばん重い骨の番号"""
    b = M['bone']
    return int(b[v * 4]) if b[v * 4 + 1] >= b[v * 4 + 3] else int(b[v * 4 + 2])


def tris_by_bone(M, bone):
    out = []
    for t in range(M['ntri']):
        vs = tri_verts(M, t)
        if all(vert_bone(M, v) == bone for v in vs):
            out.append(t)
    return out


def tris_in_box(M, x=None, y=None, z=None, bone=None):
    """体のどこにあるかで選ぶ。x/y/z は (最小, 最大)。None なら気にしない。"""
    out = []
    for t in range(M['ntri']):
        ps = tri_pos(M, t)
        cx = sum(p[0] for p in ps) / 3
        cy = sum(p[1] for p in ps) / 3
        cz = sum(p[2] for p in ps) / 3
        if x and not (x[0] <= cx <= x[1]):
            continue
        if y and not (y[0] <= cy <= y[1]):
            continue
        if z and not (z[0] <= cz <= z[1]):
            continue
        if bone is not None and not all(vert_bone(M, v) == bone for v in tri_verts(M, t)):
            continue
        out.append(t)
    return out


def uv_bbox(M, tris):
    u0 = v0 = 1e9
    u1 = v1 = -1e9
    for t in tris:
        for u, v in tri_uv(M, t):
            u0 = min(u0, u); u1 = max(u1, u)
            v0 = min(v0, v); v1 = max(v1, v)
    return (u0, v0, u1, v1)


def up_dir_in_uv(M, tris):
    return dir_in_uv(M, tris, (0.0, 1.0, 0.0))


def dir_in_uv(M, tris, axis=(0.0, 1.0, 0.0)):
    """体の 好きな向き（既定は上＝+Y）が テクスチャ上でどっち向きか。
    三角形ごとに、位置の勾配から UV の向きを出して 平均する。
    返り値は (du, dv)（画像座標系ではなく UV。v は下から上）。"""
    sx = sy = 0.0
    for t in tris:
        (p0, p1, p2) = tri_pos(M, t)
        (q0, q1, q2) = tri_uv(M, t)
        e1 = [p1[i] - p0[i] for i in range(3)]
        e2 = [p2[i] - p0[i] for i in range(3)]
        d1 = [q1[i] - q0[i] for i in range(2)]
        d2 = [q2[i] - q0[i] for i in range(2)]
        # UV → 3D のヤコビアンを作り、その擬似逆で 3Dの+Y を UV へ落とす
        det = d1[0] * d2[1] - d1[1] * d2[0]
        if abs(det) < 1e-12:
            continue
        # dP/du, dP/dv
        dpu = [(e1[i] * d2[1] - e2[i] * d1[1]) / det for i in range(3)]
        dpv = [(e2[i] * d1[0] - e1[i] * d2[0]) / det for i in range(3)]
        # +Y をこの2本で表す（最小二乗）
        a = sum(x * x for x in dpu); bb = sum(dpu[i] * dpv[i] for i in range(3))
        c = sum(x * x for x in dpv)
        ry = sum(dpu[i] * axis[i] for i in range(3))    # 指定の向きとの内積
        rv = sum(dpv[i] * axis[i] for i in range(3))
        det2 = a * c - bb * bb
        if abs(det2) < 1e-16:
            continue
        du = (ry * c - rv * bb) / det2
        dv = (rv * a - ry * bb) / det2
        L = math.hypot(du, dv)
        if L < 1e-12:
            continue
        w = abs(det)                      # 面積の大きい三角形を重く
        sx += du / L * w; sy += dv / L * w
    L = math.hypot(sx, sy) or 1
    return (sx / L, sy / L)


def mask_of(M, tris, W, H, grow=0):
    """選んだ三角形が占めるテクスチャの範囲を 白で塗った画像を返す。"""
    from PIL import Image, ImageDraw, ImageFilter
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    for t in tris:
        pts = [(u * W, (1 - v) * H) for u, v in tri_uv(M, t)]
        d.polygon(pts, fill=255)
    if grow:
        im = im.filter(ImageFilter.MaxFilter(grow * 2 + 1))
    return im


if __name__ == '__main__':
    M = load()
    print('頂点 %d / 三角 %d' % (M['n'], M['ntri']))
    ps = M['pos']
    print('体の大きさ： x %.3f〜%.3f  y %.3f〜%.3f  z %.3f〜%.3f' % (
        min(ps[0::3]), max(ps[0::3]), min(ps[1::3]), max(ps[1::3]),
        min(ps[2::3]), max(ps[2::3])))
    for name, b in BONE.items():
        tris = tris_by_bone(M, b)
        if not tris:
            continue
        bb = uv_bbox(M, tris)
        up = up_dir_in_uv(M, tris)
        print('%-6s 三角%5d  UV %.3f,%.3f〜%.3f,%.3f  上むき(%.2f,%.2f)'
              % (name, len(tris), bb[0], bb[1], bb[2], bb[3], up[0], up[1]))


# ---- UVの島（つながっている面のかたまり）に分ける ----------------------
def islands(M):
    """頂点を共有している三角形どうしを つないで まとめる。
    UVは頂点ごとなので、頂点を共有＝テクスチャ上でもつながっている。"""
    n = M['ntri']
    parent = list(range(n))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    byv = {}
    for t in range(n):
        for v in tri_verts(M, t):
            byv.setdefault(v, []).append(t)
    for v, ts in byv.items():
        for k in range(1, len(ts)):
            union(ts[0], ts[k])
    groups = {}
    for t in range(n):
        groups.setdefault(find(t), []).append(t)
    return list(groups.values())


def island_info(M, tris):
    ps = [p for t in tris for p in tri_pos(M, t)]
    cx = sum(p[0] for p in ps) / len(ps)
    cy = sum(p[1] for p in ps) / len(ps)
    cz = sum(p[2] for p in ps) / len(ps)
    bb = uv_bbox(M, tris)
    # UV上の面積
    area = 0.0
    for t in tris:
        (a, b, c) = tri_uv(M, t)
        area += abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
    bones = {}
    for t in tris:
        for v in tri_verts(M, t):
            k = vert_bone(M, v)
            bones[k] = bones.get(k, 0) + 1
    main = max(bones.items(), key=lambda kv: kv[1])[0]
    name = [k for k, v in BONE.items() if v == main][0]
    return {
        'tris': tris, 'n': len(tris), 'c': (cx, cy, cz), 'uv': bb,
        'area': area, 'bone': name,
        'ymin': min(p[1] for p in ps), 'ymax': max(p[1] for p in ps),
        'zmax': max(p[2] for p in ps),
    }
