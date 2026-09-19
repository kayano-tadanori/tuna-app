# -*- coding: utf-8 -*-
"""つる⑬：**分岐点（開ききった姿）の確認**（2026-09-16・⛔作りかけで停止）

🚨 **本人指示（2026-09-16）で、剛体で成立することを前提にした探索はいったん停止**。
   この中の道具（特異値と階数のしきい値つきの自由度・零空間の向きを小さく進める・接触の判定）は
   作りかけで、main も無い（走らせても何も出ない）。再開するときはここから。


**本体・UI・保存形式は無変更。**

見ること
  [P1] **開き 180°ちょうど**の姿が、全結びを保って成立するか（179°とは別に測る）。
       「開ききった所の自由度」が 179° の値か 180° の値かを分けて出し、
       **特異値の並びと、階数を決めたしきい値**も残す。
  [P2] その姿から**出る向き**（零空間）を全部調べ、向きごとに**小さく進めて閉じを確かめ直す**。
       🚨 特異点の零空間の向きが、そのまま有限の運動になるとは限らない＝**進めてみて確かめる**。
       2枚模型で分かった「中割りの枝は開ききった所で出会う」は**2枚模型の性質**として扱い、
       M2・M3 では**全結びの拘束で改めて**確かめる。
  [P3] 分岐のすぐ先で**接触・非貫通**を見て枝を絞る：
       ①重なっていた紙の上下（開く向き）が出発の並びと食い違わないか
       ②面どうしが突き抜けていないか（辺と面の交わり）
       ③同じ折り線を共有する面の、軸まわりの並びが入れかわっていないか
       （終端の層順から回転の符号を反転して選び直す、というやり方には頼らない）

使い方： python check_crane13_branch.py [--angle 度] [--pos 距離] [--only M1|M2|M3]
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util, math, os, sys, traceback
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_argv = sys.argv
sys.argv = [sys.argv[0]]
_s = importlib.util.spec_from_file_location("crane13_path", os.path.join(HERE, "check_crane13_path.py"))
P = importlib.util.module_from_spec(_s)
_s.loader.exec_module(P)
sys.argv = _argv
MO, M = P.MO, P.M
ng = []
RANK_TOL = 1e-7          # 階数を決めるしきい値（特異値がこれ以下なら「0」とみなす）


def say(*a):
    print(" ".join(str(x) for x in a))


def bad(m):
    ng.append(m)
    say("  NG:", m)


def spectrum(mo, x, n=6):
    """ヤコビの特異値（小さい方から n 個）と、しきい値で決めた階数・自由度"""
    J, _ = mo.jac(x)
    s = np.linalg.svd(J, compute_uv=False)
    rank = int((s > RANK_TOL).sum())
    return dict(sv=s, small=s[-n:][::-1], rank=rank, dof=J.shape[1] - rank, nvar=J.shape[1])


def null_dirs(mo, x):
    J, _ = mo.jac(x)
    U, s, Vt = np.linalg.svd(J)
    rank = int((s > RANK_TOL).sum())
    return Vt[rank:], s


# ---------- 接触の判定 ----------
def overlap_pairs(faces, layer_of):
    """出発（平ら）で面積をもって重なる面の組と、その重なりの代表点・出発の上下"""
    from shapely.geometry import Polygon
    ids = list(faces)
    polys = {f: Polygon(faces[f]["cur"]) for f in ids}
    out = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = ids[i], ids[j]
            it = polys[a].intersection(polys[b])
            if it.area < 1e-9:
                continue
            p = it.representative_point()
            la, lb = layer_of(a), layer_of(b)
            if la == lb:
                continue
            out.append((a, b, (p.x, p.y), 1 if la > lb else -1))   # +1＝a が上
    return out


def height_at(mo, T, faces, fid, p):
    """面 fid の、平らな出発で点 p にあった所の、いまの高さ"""
    q = np.array([p[0], p[1], 0.0])
    return float(MO.xform(T[fid], q)[2])


def contact_report(mo, x, faces, pairs):
    """①重なっていた紙の上下が出発と食い違わないか（開く向き）"""
    T = mo.placements(x)
    flip, flat = 0, 0
    worst = None
    for a, b, p, sgn in pairs:
        d = height_at(mo, T, faces, a, p) - height_at(mo, T, faces, b, p)
        if abs(d) < 1e-12:
            flat += 1
            continue
        if (d > 0) != (sgn > 0):
            flip += 1
            if worst is None or abs(d) > worst[0]:
                worst = (abs(d), a, b)
    return dict(flip=flip, flat=flat, total=len(pairs), worst=worst)


def pierce_report(mo, x, faces, tipset, sample=6):
    """②面どうしの突き抜け：動いた面の辺が、ほかの面の内部を貫いていないか（標本）"""
    T = mo.placements(x)
    tri = {}
    for fid in mo.ids:
        pts = [MO.xform(T[fid], p) for p in faces[fid]["cur"]]
        tri[fid] = pts
    def seg_tri(p0, p1, tr):
        for k in range(1, len(tr) - 1):
            a, b, c = tr[0], tr[k], tr[k + 1]
            n = np.cross(b - a, c - a)
            L = np.linalg.norm(n)
            if L < 1e-14:
                continue
            n = n / L
            d0, d1 = np.dot(p0 - a, n), np.dot(p1 - a, n)
            if d0 * d1 > 1e-18:
                continue
            if abs(d0 - d1) < 1e-15:
                continue
            t = d0 / (d0 - d1)
            X = p0 + (p1 - p0) * t
            # 三角形の中か
            u, v, w = b - a, c - a, X - a
            d00, d01, d11 = np.dot(u, u), np.dot(u, v), np.dot(v, v)
            d20, d21 = np.dot(w, u), np.dot(w, v)
            den = d00 * d11 - d01 * d01
            if abs(den) < 1e-18:
                continue
            s = (d11 * d20 - d01 * d21) / den
            t2 = (d00 * d21 - d01 * d20) / den
            if s > 1e-9 and t2 > 1e-9 and s + t2 < 1 - 1e-9:
                return True
        return False
    hits = 0
    for fid in sorted(tipset):
        pts = tri[fid]
        for i in range(len(pts)):
            p0, p1 = pts[i], pts[(i + 1) % len(pts)]
            for gid in mo.ids:
                if gid == fid:
                    continue
                if any(gid in b["faceIds"] and fid in b["faceIds"] for b in mo.bonds):
                    continue      # 結ばれている面どうしは共有の辺で触れて当たり前
                if seg_tri(p0, p1, tri[gid]):
                    hits += 1
                    break
    return hits


def axis_order_report(mo, x, faces):
    """③同じ折り線を共有する面の、軸まわりの並びが入れかわっていないか"""
    T = mo.placements(x)
    byline = {}
    for b in mo.bonds:
        ln = M.line_of([tuple(b["cur"][0][:2]), tuple(b["cur"][1][:2])])
        byline.setdefault(ln, []).append(b)
    bad_n = 0
    for ln, bs in byline.items():
        if len(bs) < 2:
            continue
        for b in bs:
            a, c = b["faceIds"]
            # 軸のまわりの角（軸の向きを基準に、面の重心の方向）
            A = MO.p3(b["cur"][0])
            B = MO.p3(b["cur"][1])
            d = (B - A) / np.linalg.norm(B - A)
            ang = []
            for fid in (a, c):
                g = np.mean([MO.xform(T[fid], p) for p in faces[fid]["cur"]], axis=0)
                # 軸から見た方向（軸方向の成分を抜く）
                v = g - A - np.dot(g - A, d) * d
                if np.linalg.norm(v) < 1e-12:
                    ang.append(None)
                else:
                    ang.append(v / np.linalg.norm(v))
            if ang[0] is None or ang[1] is None:
                bad_n += 1
    return bad_n
