#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""展開図が本当に直方体（立方体）に組み立つかを、実際に折って確かめる。

使い方（ライブラリとして）:
    from check_tenkaizu import Net
    net = Net([("a",0,0,1,1), ("b",1,0,2,1), ...])   # (名前, x0,y0,x1,y1) 平面上の長方形
    ok, why = net.folds_into_box()

やっていること:
  1. 辺を共有するマスどうしをつなぐ（＝ヒンジ）。閉路があれば 2x2 の塊などなので即アウト。
  2. 根のマスを平面に置き、幅優先でたどりながら、共有辺のまわりに 90 度ずつ回して 3D に立てる。
  3. 立て終わった 6 枚の角（4隅×6枚＝24点）が「ちょうど 8 点に重なり、各点をちょうど 3 枚が共有する」
     かどうかを見る。直方体の頂点は 8 個で、それぞれに 3 面が集まる＝これが成り立てば閉じている。
  4. さらに 1 頂点から出る 3 辺が直交しているかまで見る（つぶれた形をはじく）。

⚠ 手描きの原本を測った値をそのまま入れると、対辺の長さが数%ずれていて「閉じない」と出る。
   原本の意図（同じ長さのはずの辺）にそろえた値を入れること。
"""
import math
from collections import defaultdict, deque

TOL = 1e-6


def _rot(axis, deg):
    """axis（単位ベクトル）まわりに deg 度回す 3x3 行列（ロドリゲス）。"""
    x, y, z = axis
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    C = 1 - c
    return [
        [c + x * x * C,     x * y * C - z * s, x * z * C + y * s],
        [y * x * C + z * s, c + y * y * C,     y * z * C - x * s],
        [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
    ]


def _mv(m, v):
    return tuple(m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2] for i in range(3))


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _mul(v, k):
    return (v[0] * k, v[1] * k, v[2] * k)


def _norm(v):
    n = math.sqrt(sum(c * c for c in v))
    return (v[0] / n, v[1] / n, v[2] / n)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


class Net:
    def __init__(self, cells):
        # cells: [(name, x0, y0, x1, y1), ...]  平面上の長方形（y は下向き）
        self.cells = [dict(name=n, x0=x0, y0=y0, x1=x1, y1=y1)
                      for (n, x0, y0, x1, y1) in cells]
        self.by_name = {c["name"]: c for c in self.cells}

    # ---- 隣り合わせ（共有辺）を求める --------------------------------
    def hinges(self):
        out = []
        for i, a in enumerate(self.cells):
            for b in self.cells[i + 1:]:
                h = self._shared_edge(a, b)
                if h:
                    out.append((a["name"], b["name"], h))
        return out

    @staticmethod
    def _shared_edge(a, b):
        """共有辺を返す。('v', x, ya, yb) か ('h', y, xa, xb)。無ければ None。"""
        # 縦の共有辺（左右に並ぶ）
        for p, q in ((a, b), (b, a)):
            if abs(p["x1"] - q["x0"]) < TOL:
                ya, yb = max(p["y0"], q["y0"]), min(p["y1"], q["y1"])
                if yb - ya > TOL:
                    return ("v", p["x1"], ya, yb)
        # 横の共有辺（上下に並ぶ）
        for p, q in ((a, b), (b, a)):
            if abs(p["y1"] - q["y0"]) < TOL:
                xa, xb = max(p["x0"], q["x0"]), min(p["x1"], q["x1"])
                if xb - xa > TOL:
                    return ("h", p["y1"], xa, xb)
        return None

    # ---- 実際に折る --------------------------------------------------
    def fold(self):
        hs = self.hinges()
        adj = defaultdict(list)
        for na, nb, h in hs:
            adj[na].append((nb, h))
            adj[nb].append((na, h))

        n = len(self.cells)
        if len(hs) != n - 1:
            return None, f"ヒンジが{len(hs)}本（{n-1}本でないので木でない＝2x2の塊などがある）"

        root = self.cells[0]
        frames = {root["name"]: dict(O=(root["x0"], root["y0"], 0.0),
                                     ex=(1.0, 0.0, 0.0), ey=(0.0, 1.0, 0.0))}
        seen = {root["name"]}
        dq = deque([root["name"]])
        while dq:
            pn = dq.popleft()
            P, pf = self.by_name[pn], frames[pn]

            def W(px, py):  # 親の枠で平面座標を 3D に置く
                return _add(_add(pf["O"], _mul(pf["ex"], px - P["x0"])),
                            _mul(pf["ey"], py - P["y0"]))

            nP = _cross(pf["ex"], pf["ey"])  # 親の面の向き（この側へ倒す）
            for cn, h in adj[pn]:
                if cn in seen:
                    continue
                C = self.by_name[cn]
                if h[0] == "v":
                    p1, p2 = (h[1], h[2]), (h[1], h[3])
                else:
                    p1, p2 = (h[2], h[1]), (h[3], h[1])
                w1, w2 = W(*p1), W(*p2)
                axis = _norm(_sub(w2, w1))
                # ヒンジから子へ向かう向き（まだ平らなときの 3D 向き）
                cc = W((C["x0"] + C["x1"]) / 2, (C["y0"] + C["y1"]) / 2)
                d = _sub(cc, w1)
                d = _norm(_sub(d, _mul(axis, _dot(d, axis))))
                # 90度回して d が親の法線 nP を向くほうの符号をえらぶ
                deg = 90.0 if _dot(_cross(axis, d), nP) > 0 else -90.0
                R = _rot(axis, deg)
                frames[cn] = dict(
                    O=_add(w1, _mv(R, _sub(W(C["x0"], C["y0"]), w1))),
                    ex=_mv(R, pf["ex"]),
                    ey=_mv(R, pf["ey"]),
                )
                seen.add(cn)
                dq.append(cn)
        return frames, None

    def corners(self, frames):
        out = {}
        for c in self.cells:
            f = frames[c["name"]]

            def W(px, py):
                return _add(_add(f["O"], _mul(f["ex"], px - c["x0"])),
                            _mul(f["ey"], py - c["y0"]))
            out[c["name"]] = [W(c["x0"], c["y0"]), W(c["x1"], c["y0"]),
                              W(c["x1"], c["y1"]), W(c["x0"], c["y1"])]
        return out

    # ---- 判定 --------------------------------------------------------
    def folds_into_box(self, tol=1e-3):
        if len(self.cells) != 6:
            return False, f"面が{len(self.cells)}枚（6枚でない）"
        frames, err = self.fold()
        if err:
            return False, err

        cor = self.corners(frames)
        key = lambda p: (round(p[0] / tol), round(p[1] / tol), round(p[2] / tol))
        share = defaultdict(set)
        for name, pts in cor.items():
            for p in pts:
                share[key(p)].add(name)

        if len(share) != 8:
            return False, f"角が{len(share)}点に重なった（直方体なら8点）"
        bad = [k for k, v in share.items() if len(v) != 3]
        if bad:
            return False, f"1つの頂点に集まる面の数が3でない箇所が{len(bad)}か所"

        # 1頂点から出る3辺が直交しているか
        # ⚠「いちばん近い3点」で拾ってはいけない。細長い箱だと面の対角線のほうが
        #   辺より短くなり、対角の点を辺と取りちがえる（②④で実際に誤検出した）。
        #   面の隣り合う隅どうしをつないだものだけを辺として集める。
        pts = {}
        for name, ps in cor.items():
            for p in ps:
                pts[key(p)] = p
        v0k = next(iter(share))
        v0 = pts[v0k]
        vs = []
        for name, ps in cor.items():          # 面の4隅は順に並んでいる
            for i, p in enumerate(ps):
                if key(p) != v0k:
                    continue
                for q in (ps[(i - 1) % 4], ps[(i + 1) % 4]):   # 面内での両隣＝辺の先
                    v = _sub(q, v0)
                    if not any(abs(_dot(_norm(v), _norm(u)) - 1) < 1e-6 for u in vs):
                        vs.append(v)
        if len(vs) != 3:
            return False, f"頂点から出る辺が3方向でない（{len(vs)}方向）"
        for i in range(3):
            for j in range(i + 1, 3):
                if abs(_dot(_norm(vs[i]), _norm(vs[j]))) > 1e-3:
                    return False, "頂点から出る辺が直交していない（つぶれている）"
        dims = tuple(sorted(round(math.sqrt(_dot(v, v)), 4) for v in vs))
        return True, f"組み立つ（{dims[0]} x {dims[1]} x {dims[2]}）"


def grid_net(cells, w=1.0, h=1.0):
    """(列, 行) のマス目リストから Net を作る（立方体の展開図など、正方形が並ぶとき）。"""
    return Net([(f"{c},{r}", c * w, r * h, (c + 1) * w, (r + 1) * h) for (c, r) in cells])


if __name__ == "__main__":
    # 自己テスト：立方体の展開図として有名な形で、正しく判定できるか確かめる
    tests = [
        # 十字（正しい）
        ([(1, 0), (0, 1), (1, 1), (2, 1), (1, 2), (1, 3)], True, "十字"),
        # 2x3 の塊（組み立たない）
        ([(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)], False, "2x3の塊"),
        # 一直線6マス（組み立たない）
        ([(0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (5, 0)], False, "一直線6マス"),
        # 階段（正しい）
        ([(0, 0), (0, 1), (1, 1), (1, 2), (2, 2), (2, 3)], True, "階段"),
        # T字で腕が2つ横並び（組み立たない）
        ([(0, 0), (1, 0), (2, 0), (0, 1), (0, 2), (0, 3)], False, "L字(3+4)"),
    ]
    print("=== 自己テスト ===")
    for cells, want, label in tests:
        ok, why = grid_net(cells).folds_into_box()
        mark = "OK " if ok == want else "NG!"
        print(f"{mark} {label}: {ok} ({why})")
