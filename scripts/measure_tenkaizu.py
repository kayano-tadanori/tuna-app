# -*- coding: utf-8 -*-
"""展開図（や多角形が並んだ図）の各面の頂点を、現物スキャンから精密に測る。

  ★直角マークは頂点の内側に接して描かれるので、面を塗りつぶすと角が四角く削れる。
    そのまま凸包を取ると角が2つに割れて、辺の長さが実際より短く出る。
    → 凸包の辺を「向きが近いものどうし」でまとめて直線をあて、
      となり合う直線の交点を取る＝辺を延長して本当の角を出す。

  2026-09-04 に HG-2202／HG-2408（ふたのない容器の展開図）で使い、
  4面の寸法（台形175cm² ／ 10×20 ／ 10×25 ／ 直角三角形5-10-11.18）を確定させた。
  それまで「短辺は9cmか10cmか分からない」と止まっていたもの。

  使い方:
    python scripts/measure_tenkaizu.py <画像> --seed 1200,540,4 --seed 1440,730,4 ...
      seed = 面の内側の1点(x,y) と その面の辺の本数
  ★PDFからの画像は「埋め込み画像をそのまま抜く」こと（get_pixmapで描き直すと再サンプリングされる）:
      pix = fitz.Pixmap(doc, doc[p].get_images(full=True)[0][0]); pix.save(...)
"""
import argparse, io, json, sys
from collections import deque

import numpy as np
from PIL import Image


def flood(free, sx, sy):
    H, W = free.shape
    seen = np.zeros((H, W), bool)
    q = deque([(sx, sy)])
    seen[sy, sx] = True
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            u, v = x + dx, y + dy
            if 0 <= u < W and 0 <= v < H and free[v, u] and not seen[v, u]:
                seen[v, u] = True
                q.append((u, v))
    return seen


def hull(pts):
    pts = sorted(set(map(tuple, pts)))
    def half(ps):
        h = []
        for p in ps:
            while len(h) >= 2 and (h[-1][0]-h[-2][0])*(p[1]-h[-2][1]) - (h[-1][1]-h[-2][1])*(p[0]-h[-2][0]) <= 0:
                h.pop()
            h.append(p)
        return h
    return half(pts)[:-1] + half(pts[::-1])[:-1]


def fitline(P):
    P = np.array(P, float)
    c = P.mean(0)
    _, _, vt = np.linalg.svd(P - c)
    return c, vt[0]


def inter(p1, d1, p2, d2):
    A = np.array([[d1[0], -d2[0]], [d1[1], -d2[1]]])
    if abs(np.linalg.det(A)) < 1e-6:
        return None
    t = np.linalg.solve(A, np.array(p2, float) - np.array(p1, float))
    return np.array(p1, float) + t[0] * np.array(d1, float)


def face_corners(free, sx, sy, want, minlen=45.0, tol_deg=12.0):
    """面の内側の点(sx,sy)から、その面の頂点（want個）を返す"""
    H, W = free.shape
    m = flood(free, sx, sy)
    ys, xs = np.nonzero(m)
    if len(xs) > H * W * 0.4:
        return None, "外にもれた（面が閉じていない）"
    hp = hull(list(zip(xs.tolist(), ys.tolist())))
    n = len(hp)
    E = []
    for i in range(n):
        p, q = np.array(hp[i], float), np.array(hp[(i + 1) % n], float)
        E.append((p, q, np.linalg.norm(q - p),
                  np.degrees(np.arctan2(q[1] - p[1], q[0] - p[0])) % 180))
    used = [False] * n
    segs = []
    for i in range(n):
        if used[i]:
            continue
        g = [i]
        used[i] = True
        j = (i + 1) % n
        while not used[j] and min(abs(E[j][3] - E[i][3]), 180 - abs(E[j][3] - E[i][3])) < tol_deg:
            g.append(j)
            used[j] = True
            j = (j + 1) % n
        tot = sum(E[k][2] for k in g)
        if tot >= minlen:
            segs.append((tot, fitline([E[k][0] for k in g] + [E[g[-1]][1]])))
    if len(segs) > want:
        keep = sorted(range(len(segs)), key=lambda i: -segs[i][0])[:want]
        segs = [segs[i] for i in sorted(keep)]
    if len(segs) != want:
        return None, "辺が%d本になった（want=%d）" % (len(segs), want)
    verts = []
    for i in range(want):
        c1, d1 = segs[i][1]
        c2, d2 = segs[(i + 1) % want][1]
        v = inter(c1, d1, c2, d2)
        if v is None or not (-20 < v[0] < W + 20 and -20 < v[1] < H + 20):
            return None, "となり合う辺が平行で交点が出ない"
        verts.append(v)
    return verts, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--seed", action="append", required=True,
                    help="面の内側の点と辺の本数: x,y,辺の本数")
    ap.add_argument("--ink", type=int, default=150, help="この値より暗ければインク")
    ap.add_argument("--scale", type=float, default=0.0,
                    help="1cm あたりの px。与えると cm でも出す")
    ap.add_argument("--json", default="")
    a = ap.parse_args()
    arr = np.asarray(Image.open(a.image).convert("L"), dtype=np.uint8)
    free = arr >= a.ink
    out = {}
    for s in a.seed:
        x, y, k = (int(t) for t in s.split(","))
        v, err = face_corners(free, x, y, k)
        name = "seed_%d_%d" % (x, y)
        if v is None:
            print("%s  ★%s" % (name, err))
            continue
        out[name] = [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in v]
        print("%s  辺%d本" % (name, k))
        for i, p in enumerate(v):
            q = v[(i + 1) % k]
            L = float(np.linalg.norm(p - q))
            cm = ("  = %6.2f cm" % (L / a.scale)) if a.scale > 0 else ""
            print("    (%7.1f,%7.1f)  辺の長さ %6.1f px%s" % (p[0], p[1], L, cm))
    if a.json:
        io.open(a.json, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
        print("書いた:", a.json)


if __name__ == "__main__":
    main()
