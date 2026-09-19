# -*- coding: utf-8 -*-
"""つる⑬ 終端の層順の数え上げを点検する（2026-09-17・運動の探索はしない・本体/UI/保存形式は無変更）

本人指示
  2. 胴を加えると0通りになる原因を、矛盾する上下関係の小さな組で示す。重ならない面に順位を要求していないか、
     脚だけで決めた順を胴との関係に押し込んでいないかも確認する。
  3. 終端の位置・表裏・上下と、折り角の符号・累積回転を分ける。「360°が必要」は経路に依存しない根拠が示せるまで条件に入れない。

入力（保存）：`crane13_terminal_input.json`（脚1・ORIPA 脚1 の線＝`crane13_stack_inputs/L1-O1.json` と同じ切り方）
  面ごと：終端の位置（上から見た多角形）・表裏・動くか／結びごと：終端で畳まれているか・線分／出発の上下（engine stackAt）

[O] 旧関数（stack_feasibility）の規則を SAT に写す：面ぜんぶに1本の並び（重ならない組にも上下）・元は layer の順で全部つなぐ・
    同じ直線の上の折りは線分が重ならなくても入れ子・折りをまたぐ判定は直線全体。16枚で 33通り・中割り1、32枚で 0 を再現してから、
    0 の最小の矛盾（MUS）を取り出す。
[N] 規則を点検した新しい数え方：上下は**実際に重なる組だけ**／各点で並びが1本（三つ組の輪を禁止）／
    折りの線分が面の中を通るならその面は折りのあいだに入れない（線分の所だけ）／同じ線分で重なる折りどうしは交差しない／
    平らな結びどうしは同じ側で上下をそろえる／**動かない紙の上下は出発のまま（engine stackAt で読む。layer 番号は使わない）**。
[S] 終端の性質を分ける：位置・表裏・上下（静的）と、結びの山谷（終端の静的な量）／累積回転（経路の量＝ここでは条件にしない）。
使い方： PYTHONHASHSEED=0 python check_crane13_terminal_stacks.py
"""
import importlib.util
import itertools
import json
import math
import os
import subprocess
import sys

import numpy as np
from pysat.solvers import Minisat22
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize, unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("PYTHONHASHSEED") != "0":
    print("ABORT: PYTHONHASHSEED=0 で回すこと")
    sys.exit(2)
_argv = sys.argv
sys.argv = [sys.argv[0]]
_s = importlib.util.spec_from_file_location("motion", os.path.join(HERE, "check_crane13_motion.py"))
MOT = importlib.util.module_from_spec(_s)
_s.loader.exec_module(MOT)
sys.argv = _argv
M = MOT.M
EPS_A, EPS_L = 1e-9, 1e-7
ng = []


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


NAMES = {}


def short(f):
    return NAMES.get(f, f.split("/")[-1])


# ======================================================================
# 入力
# ======================================================================
def build_input():
    D = M.load()
    faces = {f["faceId"]: f for f in D["faces"]}
    bonds = D["bonds"]
    lm = D["landmarks"]
    legTip, petalTip = tuple(lm["legTip"]), tuple(lm["petalTip"])
    L = M.dist(legTip, petalTip)
    u = ((petalTip[0] - legTip[0]) / L, (petalTip[1] - legTip[1]) / L)
    nrm = (-u[1], u[0])
    neck = [v["neck"] for v in lm["necks"] if M.dist(tuple(v["corner"]), legTip) < 1e-9][0]
    legs = M.tip_components(faces, bonds, legTip, u, nrm, 0.3 * neck)
    line, rec, _ = M.oripa_cut_line(1, D["meta"]["stateFingerprint"])
    if set(rec["faceIds"]) != set(legs[0]):
        raise RuntimeError("ORIPA 脚1 の線の faceIds が、いまの脚1 と違う（脚の取り違え）")
    cut = M.cut_graph(legs[0], faces, bonds, legTip, u, 0, 0, line=line)
    A, B = cut["cutseg"]
    Rpi = MOT.rot_about((A[0], A[1], 0), (B[0], B[1], 0), math.pi)
    tip = set(cut["tip"])
    P = {}
    for fid, f in cut["faces"].items():
        T = Rpi if fid in tip else np.eye(4)
        a, b, c, d = f["xf"][:4]
        det = 1 if a * d - b * c > 0 else -1
        P[fid] = dict(start=[list(map(float, p[:2])) for p in f["cur"]],
                      end=[MOT.xform(T, p)[:2].tolist() for p in f["cur"]],
                      moves=fid in tip, side0=det, side1=det * (-1 if fid in tip else 1),
                      orig=fid.split("#")[0], leg=(fid.split("#")[0] in legs[0]), layer=f["layer"])
    seen, BB = set(), []
    for b in cut["bonds"]:
        a_, c_ = b["faceIds"]
        key = (frozenset((a_, c_)), tuple(np.round(np.array(b["cur"][0][:2]) + np.array(b["cur"][1][:2]), 9)))
        dup = key in seen
        seen.add(key)
        T = Rpi if a_ in tip else np.eye(4)
        seg1 = [MOT.xform(T, p)[:2].tolist() for p in b["cur"]]
        seg0 = [list(map(float, p[:2])) for p in b["cur"]]
        BB.append(dict(bondId=b["bondId"], kind=b["kind"], a=a_, b=c_, seg0=seg0, seg1=seg1, dup=dup,
                       folded0=folded(P[a_]["start"], P[c_]["start"], seg0), folded1=folded(P[a_]["end"], P[c_]["end"], seg1)))
    return D, cut, P, BB, (list(A), list(B))


def side_of(poly, seg):
    c = np.mean(np.array(poly), axis=0)
    (x0, y0), (x1, y1) = seg
    return float((x1 - x0) * (c[1] - y0) - (y1 - y0) * (c[0] - x0))


def folded(pa, pb, seg):
    return side_of(pa, seg) * side_of(pb, seg) > 0


# ======================================================================
# 出発の上下（engine stackAt）
# ======================================================================
def start_relations(D, P, ids):
    """ids のうち、出発で重なる組の上下を保存原本の stackAt で読む（layer 番号は使わない）"""
    polys = {f: Polygon(P[f]["start"]) for f in ids}
    queries, pairs = [], []
    for a, b in itertools.combinations(sorted(ids), 2):
        it = polys[a].intersection(polys[b])
        if it.area <= EPS_A:
            continue
        pts = [it.representative_point()]
        if it.geom_type == "Polygon":
            cen = np.array(it.centroid.coords[0])
            pts += [Point(*(cen + (np.array(q) - cen) * 0.5)) for q in list(it.exterior.coords)[:-1]]
        k = len(pairs)
        pairs.append((a, b))
        for p in pts:
            if it.buffer(-1e-9).contains(p):
                queries.append(dict(kind="lap", idx=k, p=[p.x, p.y], a=P[a]["orig"], b=P[b]["orig"]))
    qpath = os.path.join(HERE, "crane13_terminal_stack_query.json")
    json.dump(dict(queries=queries), open(qpath, "w", encoding="utf-8"))
    r = subprocess.run(["node", os.path.join(HERE, "export_crane13_stacks.js"), "crane", qpath], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise RuntimeError("stackAt を読めない：" + r.stderr[-500:])
    SC = json.load(open(os.path.join(HERE, "crane13_stack_crane.json"), encoding="utf-8"))
    if SC["fingerprint"] != D["meta"]["stateFingerprint"]:
        raise RuntimeError("保存原本の指紋が違う")
    got = {}
    for q in SC["results"]:
        ids_ = [s["faceId"] for s in q["stack"]]
        a, b = pairs[q["idx"]]
        if P[a]["orig"] in ids_ and P[b]["orig"] in ids_:
            ia, ib = ids_.index(P[a]["orig"]), ids_.index(P[b]["orig"])
            if ia != ib:
                got.setdefault((a, b), set()).add(1 if ib < ia else -1)      # stackAt は上から＝b が先なら b が上
    rel, conflict, missing = {}, [], []
    for a, b in pairs:
        v = got.get((a, b), set())
        if len(v) == 1:
            rel[(a, b)] = v.pop()
        elif len(v) > 1:
            conflict.append((a, b))
        else:
            missing.append((a, b))
    return rel, conflict, missing


# ======================================================================
# SAT の道具
# ======================================================================
class Pairs:
    def __init__(self):
        self.v = {}

    def lit(self, x, y):
        """x が y の下（x<y）"""
        if x == y:
            raise ValueError
        a, b = (x, y) if x < y else (y, x)
        if (a, b) not in self.v:
            self.v[(a, b)] = len(self.v) + 1
        k = self.v[(a, b)]
        return k if x < y else -k

    def has(self, x, y):
        return ((x, y) if x < y else (y, x)) in self.v


def cells_cover(polys):
    edges = unary_union([p.boundary for p in polys.values()])
    out = []
    for c in polygonize(edges):
        if c.area <= EPS_A:
            continue
        p = c.representative_point()
        cv = sorted(f for f, pl in polys.items() if pl.contains(p))
        if len(cv) >= 2:
            out.append((c, cv))
    return out


def solve_groups(nvars, hard, groups, want_count=0, project=None):
    """groups: [(名前, [節])]。全部入れて解く。解けなければ最小の矛盾（MUS）を返す"""
    sel0 = nvars + 1
    with Minisat22() as s:
        for c in hard:
            s.add_clause(c)
        sels = []
        for k, (nm, cls) in enumerate(groups):
            sv = sel0 + k
            sels.append(sv)
            for c in cls:
                s.add_clause(c + [-sv])
        if s.solve(assumptions=sels):
            sols = []
            if want_count:
                proj = project or list(range(1, nvars + 1))
                while len(sols) < want_count and s.solve(assumptions=sels):
                    m = s.get_model()
                    val = {abs(x): x > 0 for x in m}
                    sols.append({v: val.get(v, False) for v in proj})
                    s.add_clause([(-v if val.get(v, False) else v) for v in proj])
            return True, sols
        core = set(s.get_core() or [])
        # 削って最小にする
        cur = [sv for sv in sels if sv in core]
        k = 0
        while k < len(cur):
            trial = cur[:k] + cur[k + 1:]
            if not s.solve(assumptions=trial):
                cur = trial
            else:
                k += 1
        return False, [groups[sv - sel0][0] for sv in cur]


# ======================================================================
# [O] 旧関数の規則
# ======================================================================
def old_model(cut, P, BB, column, count=False):
    tip = sorted(f for f in column if P[f]["moves"])
    base = sorted(f for f in column if not P[f]["moves"])
    panels = {f: Polygon(P[f]["end"]) for f in column}
    X = Pairs()
    hard, groups = [], []
    allf = sorted(column)
    for a, b in itertools.combinations(allf, 2):
        X.lit(a, b)
    # 1本の並び（重ならない組にも）
    for a, b, c in itertools.combinations(allf, 3):
        hard.append([-X.lit(a, b), -X.lit(b, c), -X.lit(c, a)])
        hard.append([-X.lit(b, a), -X.lit(c, b), -X.lit(a, c)])
    # 元は layer の順（sorted の安定順）で全部つなぐ
    base_seq = sorted(base, key=lambda f: P[f]["layer"])
    for x, y in zip(base_seq, base_seq[1:]):
        ov = panels[x].intersection(panels[y]).area > EPS_A
        groups.append((("元の順", x, y, ov), [[X.lit(x, y)]]))
    # 折り（先と元をまたぐのは⑬の線だけ）＝種類も畳まれ方も見ない
    fl = []
    for b in BB:
        if b["a"] in column and b["b"] in column:
            if P[b["a"]]["moves"] != P[b["b"]]["moves"] and not b["bondId"].startswith("cut:"):
                continue
            fl.append(b)
    cover = cells_cover(panels)
    for b in fl:
        a, c = b["a"], b["b"]
        act = set()
        for cell, cv in cover:
            if a in cv and c in cv:
                act |= set(cv)
        for o in sorted(act - {a, c}):
            if MOT.crosses(panels[o], b["seg1"]):
                groups.append((("またぎ禁止", a, c, o, b["bondId"], b["dup"]),
                               [[-X.lit(a, o), -X.lit(o, c)], [-X.lit(c, o), -X.lit(o, a)]]))
    byline = {}
    for b in fl:
        byline.setdefault(M.line_of(b["seg1"]), []).append(b)
    for ln, bs in byline.items():
        for p, q in itertools.combinations(bs, 2):
            fs = {p["a"], p["b"], q["a"], q["b"]}
            if len(fs) < 4:
                continue
            cls = interleave_clauses(X, p["a"], p["b"], q["a"], q["b"])
            ovl = seg_overlap(p["seg1"], q["seg1"])
            groups.append((("入れ子", p["a"], p["b"], q["a"], q["b"], p["bondId"], q["bondId"], ovl), cls))
    return X, hard, groups, tip, base


def interleave_clauses(X, a, b, c, d):
    fs = [a, b, c, d]
    prs = list(itertools.combinations(fs, 2))
    allowed = set()
    for perm in itertools.permutations(fs):
        pos = {f: i for i, f in enumerate(perm)}
        lo1, hi1 = sorted((pos[a], pos[b]))
        lo2, hi2 = sorted((pos[c], pos[d]))
        cross = (lo1 < lo2 < hi1 < hi2) or (lo2 < lo1 < hi2 < hi1)
        if not cross:
            allowed.add(tuple(pos[x] < pos[y] for x, y in prs))
    cls = []
    for bits in itertools.product((True, False), repeat=6):
        if bits in allowed:
            continue
        # 輪になる組み合わせは三つ組の節が別に禁じるが、ここでも禁じてかまわない
        cls.append([(-X.lit(x, y) if bt else X.lit(x, y)) for (x, y), bt in zip(prs, bits)])
    return cls


def seg_overlap(s, t):
    p0, p1 = np.array(s[0]), np.array(s[1])
    d = (p1 - p0) / np.linalg.norm(p1 - p0)
    ta = sorted([0.0, float((p1 - p0) @ d)])
    tb = sorted([float((np.array(t[0]) - p0) @ d), float((np.array(t[1]) - p0) @ d)])
    return max(0.0, min(ta[1], tb[1]) - max(ta[0], tb[0]))


def classify_old(sol, X, tip, base, allf):
    """1本の並びの解から、先がぜんぶ元の最下と最上のあいだか"""
    below = {f: 0 for f in allf}
    for (a, b), v in X.v.items():
        if sol[v]:
            below[b] += 1
        else:
            below[a] += 1
    pos = below
    tp = [pos[f] for f in tip]
    bp = [pos[f] for f in base]
    if max(tp) < min(bp) or min(tp) > max(bp):
        return "外"
    if min(bp) < min(tp) and max(tp) < max(bp):
        return "中"
    return "他"


# ======================================================================
# [N] 点検した規則
# ======================================================================
def new_model(P, BB, column, start_rel, use_fixed=True):
    panels = {f: Polygon(P[f]["end"]) for f in column}
    X = Pairs()
    groups = []
    ov = {}
    for a, b in itertools.combinations(sorted(column), 2):
        if panels[a].intersection(panels[b]).area > EPS_A:
            X.lit(a, b)
            ov[(a, b)] = True
    cover = cells_cover(panels)
    tri = set()
    for cell, cv in cover:
        for t in itertools.combinations(cv, 3):
            tri.add(t)
    hard = []
    for a, b, c in tri:
        hard.append([-X.lit(a, b), -X.lit(b, c), -X.lit(c, a)])
        hard.append([-X.lit(b, a), -X.lit(c, b), -X.lit(a, c)])
    if use_fixed:
        for (a, b), r in start_rel.items():
            if a in column and b in column and not P[a]["moves"] and not P[b]["moves"] and X.has(a, b):
                groups.append((("出発の上下", a, b), [[X.lit(a, b) if r > 0 else X.lit(b, a)]]))
    fb = [b for b in BB if b["a"] in column and b["b"] in column and not b["dup"]]
    shrink = {f: panels[f].buffer(-1e-7) for f in column}
    for b in fb:
        if not b["folded1"]:
            continue
        a, c = b["a"], b["b"]
        ls = LineString(b["seg1"])
        for o in sorted(column):
            if o in (a, c) or not (X.has(a, o) and X.has(c, o)):
                continue
            if shrink[o].intersection(ls).length > EPS_L:
                groups.append((("折りの中を通る面", a, c, o, b["bondId"]),
                               [[-X.lit(a, o), -X.lit(o, c)], [-X.lit(c, o), -X.lit(o, a)]]))
    for p, q in itertools.combinations(fb, 2):
        if M.line_of(p["seg1"]) != M.line_of(q["seg1"]) or seg_overlap(p["seg1"], q["seg1"]) <= EPS_L:
            continue
        fs = {p["a"], p["b"], q["a"], q["b"]}
        if len(fs) < 4:
            continue
        sp = np.sign(side_of(P[p["a"]]["end"], p["seg1"]))
        if p["folded1"] and q["folded1"]:
            if np.sign(side_of(P[q["a"]]["end"], p["seg1"])) != sp:
                continue
            if not all(X.has(x, y) for x, y in itertools.combinations(fs, 2)):
                continue
            groups.append((("同じ線分の折り2つ", p["a"], p["b"], q["a"], q["b"]), interleave_clauses(X, p["a"], p["b"], q["a"], q["b"])))
        elif p["folded1"] != q["folded1"]:
            F, T = (p, q) if p["folded1"] else (q, p)
            sF = np.sign(side_of(P[F["a"]]["end"], F["seg1"]))
            x = T["a"] if np.sign(side_of(P[T["a"]]["end"], F["seg1"])) == sF else T["b"]
            if X.has(F["a"], x) and X.has(F["b"], x):
                a, c = F["a"], F["b"]
                groups.append((("折りの線分を平らな結びが通る", a, c, x),
                               [[-X.lit(a, x), -X.lit(x, c)], [-X.lit(c, x), -X.lit(x, a)]]))
        else:
            sa = np.sign(side_of(P[p["a"]]["end"], p["seg1"]))
            qa, qb = (q["a"], q["b"]) if np.sign(side_of(P[q["a"]]["end"], p["seg1"])) == sa else (q["b"], q["a"])
            if X.has(p["a"], qa) and X.has(p["b"], qb):
                l1, l2 = X.lit(p["a"], qa), X.lit(p["b"], qb)
                groups.append((("平らな結び2つ", p["a"], p["b"], qa, qb), [[-l1, l2], [l1, -l2]]))
    return X, hard, groups, cover


def inside_ok(sol, X, cover):
    """⑬の条件 (c) を各点で：先を含み元が2枚以上ある点で、どの先もその点の元のどれかより上・どれかより下"""
    def below(x, y):
        return sol[X.v[(x, y)]] if x < y else not sol[X.v[(y, x)]]
    for cell, cv in cover:
        t_ = [f for f in cv if PP[f]["moves"]]
        b_ = [f for f in cv if not PP[f]["moves"]]
        if not t_ or len(b_) < 2:
            continue
        for t in t_:
            if not (any(below(bb, t) for bb in b_) and any(below(t, bb) for bb in b_)):
                return False
    return True


def full_rel(sol, X, P, rel):
    out = {}
    for (a, b), v in X.v.items():
        if v in sol:
            out[(a, b)] = 1 if sol[v] else -1
        elif (a, b) in rel:
            out[(a, b)] = rel[(a, b)]
    return out


def compare_and_export(P, BB, store, rel):
    say("\n[T] ⑬の目標（点ごとの条件 (c) を満たす1通り）の中身")
    X16, s16 = store.get("16枚（脚だけ）", (None, []))
    X32, s32 = store.get("32枚（着地に重なる胴を入れる）", (None, []))
    if len(s16) != 1 or len(s32) != 1:
        bad(f"目標が1通りに決まらない（16枚 {len(s16)}・32枚 {len(s32)}）")
        return
    r16, r32 = full_rel(s16[0], X16, P, rel), full_rel(s32[0], X32, P, rel)
    common = [k for k in r16 if k in r32]
    diff = [k for k in common if r16[k] != r32[k]]
    say(f"  16枚の目標と32枚の目標：共通の組 {len(common)}・上下が違う組 {len(diff)}")
    # 結びの山谷（静的）：終端で畳まれた結び a|b で、a の表の側に b があるか（世界の上下 × a の表裏）
    rows = []
    for b in BB:
        a_, c_ = b["a"], b["b"]
        if not (b["folded1"] and a_ in {x for k in r32 for x in k} and c_ in {x for k in r32 for x in k}):
            continue
        k = (a_, c_) if a_ < c_ else (c_, a_)
        if k not in r32:
            continue
        w1 = r32[k] if k == (a_, c_) else -r32[k]            # c が a の上(+1)
        front1 = w1 * P[a_]["side1"]                         # c は a の表の側(+1)／裏の側(-1)
        front0 = None
        if b["folded0"]:
            k0 = (a_, c_) if a_ < c_ else (c_, a_)
            r0 = start_rel_any(P, a_, c_)
            if r0 is not None:
                front0 = r0 * P[a_]["side0"]
        rows.append(dict(bond=b["bondId"], kind=b["kind"], a=a_, b=c_, front0=front0, front1=front1))
    chg = [r for r in rows if r["front0"] is not None and r["front0"] != r["front1"]]
    say(f"  終端で畳まれている結び {len(rows)} 本の「b は a の表の側か裏の側か」（静的）。出発も畳まれていて側が入れかわる結び {len(chg)} 本：")
    for r in chg:
        say(f"    {short(r['a'])}|{short(r['b'])}（{r['kind']}）：出発 {'表' if r['front0'] > 0 else '裏'}の側 → 終端 {'表' if r['front1'] > 0 else '裏'}の側")
    json.dump(dict(condition="L1-O1・点検した規則・動かない紙の上下は stackAt・(c) は点ごと", names={f: short(f) for f in P},
                   above=[[a, b, r] for (a, b), r in sorted(r32.items())], bonds=rows),
              open(os.path.join(HERE, "crane13_terminal_target.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    say("  → crane13_terminal_target.json に保存（above＝[a, b, +1 なら b が a の上]）")


START = {}


def start_rel_any(P, a, c):
    """出発で畳まれた結びの2枚の上下（出発はどれも動いていない＝engine stackAt で読んだ表を使う）"""
    k = (a, c) if a < c else (c, a)
    if k not in START:
        return None
    return START[k] if k == (a, c) else -START[k]


PP = {}


# ======================================================================
def main():
    D, cut, P, BB, cutseg = build_input()
    json.dump(dict(fingerprint=D["meta"]["stateFingerprint"], condition="L1-O1", cutseg=cutseg, faces=P, bonds=BB),
              open(os.path.join(HERE, "crane13_terminal_input.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    tip = sorted(f for f in P if P[f]["moves"])
    for f in P:
        kind = ("先" if P[f]["moves"] else "元") if P[f]["leg"] else "胴"
        NAMES[f] = f"{kind}{P[f]['layer']}"
    dupn = {}
    for f in sorted(P):
        dupn.setdefault(NAMES[f], []).append(f)
    for nm, fs in dupn.items():
        if len(fs) > 1:
            for k, f in enumerate(fs):
                NAMES[f] = f"{nm}{'abcdefgh'[k]}"
    json.dump({f: dict(name=NAMES[f], id=f) for f in P}, open(os.path.join(HERE, "crane13_terminal_names.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    legbase = sorted(f for f in P if P[f]["leg"] and not P[f]["moves"])
    landing = unary_union([Polygon(P[f]["end"]) for f in tip])
    body = sorted(f for f in P if not P[f]["leg"] and Polygon(P[f]["start"]).intersection(landing).area > EPS_A)
    say(f"入力 crane13_terminal_input.json（L1-O1）：面 {len(P)}・結び {len(BB)}（重複 {sum(b['dup'] for b in BB)}）／先 {len(tip)}・脚の元 {len(legbase)}・着地に重なる胴 {len(body)}")

    # 結びの種類と、畳まれているかの対応
    say("\n[S0] 結びの種類と出発・終端で畳まれているか（上から見た図で両側の面が同じ側＝畳まれている）")
    tab = {}
    for b in BB:
        k = (b["kind"], "⑬" if b["bondId"].startswith("cut:") else "", b["folded0"], b["folded1"])
        tab[k] = tab.get(k, 0) + 1
    for k, v in sorted(tab.items(), key=str):
        say(f"  {k[0]}{k[1]}：出発 {'畳み' if k[2] else '平ら'} → 終端 {'畳み' if k[3] else '平ら'}　{v}本")

    # ---------- [O] ----------
    say("\n[O] 旧関数の規則を SAT に写して再現")
    for tag, col in (("16枚", tip + legbase), ("32枚", tip + legbase + body)):
        X, hard, groups, tp, bs = old_model(cut, P, BB, set(col))
        ok, res = solve_groups(len(X.v), hard, groups, want_count=200 if tag == "16枚" else 1)
        if ok:
            cls = [classify_old(s, X, tp, bs, sorted(col)) for s in res]
            say(f"  {tag}：解 {len(res)}{'（上限）' if len(res) >= 200 else ''}・中割り {cls.count('中')}・外 {cls.count('外')}・他 {cls.count('他')}")
            if tag == "16枚" and (len(res), cls.count("中")) != (33, 1):
                bad("旧関数の写しが 33通り・1 を再現しない")
        else:
            say(f"  {tag}：**解なし**（旧関数の 0通りと同じ）→ 最小の矛盾 {len(res)} 個：")
            for g in res:
                if g[0] == "元の順":
                    say(f"    元の順（layer 番号で並べた隣どうし）：{short(g[1])} < {short(g[2])}"
                        f"　{'重なる' if g[3] else '**重ならない**'}"
                        f"／{'脚' if P[g[1]]['leg'] else '胴'}–{'脚' if P[g[2]]['leg'] else '胴'}")
                elif g[0] == "またぎ禁止":
                    say(f"    またぎ禁止：{short(g[3])} は {short(g[1])}|{short(g[2])}（{g[4][:40]}{'・重複' if g[5] else ''}）のあいだに入れない")
                else:
                    say(f"    入れ子：{short(g[1])}|{short(g[2])} と {short(g[3])}|{short(g[4])}（線分の重なり {g[7]:.2e}・{g[5][:24]} / {g[6][:24]}）")
            say("    ＋ 1本の並び（重ならない組にも上下）は固い条件として入れている")

    # ---------- [N] ----------
    say("\n[N] 点検した規則（上下は重なる組だけ・各点で1本の並び・線分の所だけ・動かない紙の上下は stackAt）")
    unmoved = [f for f in P if not P[f]["moves"]]
    col32 = set(tip + legbase + body)
    PP.update(P)
    rel, conflict, missing = start_relations(D, P, [f for f in col32 if not P[f]["moves"]])
    rel_all, c_all, m_all = start_relations(D, P, sorted(col32))
    START.update(rel_all)
    say(f"  出発の上下（stackAt・先も含む32枚の出発の姿）：決まった {len(rel_all)}／食い違う {len(c_all)}／点に無い {len(m_all)}（山谷の出発側に使う）")
    say(f"  出発の上下（stackAt・動かない紙で重なる組）：決まった {len(rel)}／点で食い違う {len(conflict)}／点に無い {len(missing)}")
    lay_mis = [(a, b) for (a, b), r in rel.items() if (1 if P[b]["layer"] > P[a]["layer"] else -1 if P[b]["layer"] < P[a]["layer"] else 0) != r]
    say(f"  参考：layer 番号の大小と stackAt が食い違う組 {len(lay_mis)}（" + "、".join(f"{short(a)}(層{P[a]['layer']})/{short(b)}(層{P[b]['layer']})" for a, b in lay_mis[:6]) + "）")
    store = {}
    for tag, col in (("16枚（脚だけ）", set(tip + legbase)), ("32枚（着地に重なる胴を入れる）", col32)):
        X, hard, groups, cover = new_model(P, BB, col, rel)
        kinds = {}
        for g, _ in groups:
            kinds[g[0]] = kinds.get(g[0], 0) + 1
        say(f"  {tag}：重なる組 {len(X.v)}（全組 {len(col) * (len(col) - 1) // 2}）・三つ組の節 {len(hard)}・条件 {kinds}")
        tippairs = [v for (a, b), v in X.v.items() if P[a]["moves"] or P[b]["moves"]]
        ok, res = solve_groups(len(X.v), hard, groups, want_count=5000, project=tippairs)
        if not ok:
            say(f"    **解なし** → 最小の矛盾：")
            for g in res:
                say("     ", g[0], " / ".join(short(x) for x in g[1:] if isinstance(x, str) and "/" in x))
            continue
        say(f"    解あり：先を含む組の上下の組み合わせ {len(res)}{'（上限5000）' if len(res) >= 5000 else ''}")
        globals()["_last"] = (tag, X, res, cover)
        # ⑬の条件 (c)（先が元のあいだ）を各点で：先を含む点で、その点の元の最下と最上のあいだに先がぜんぶ入る
        nin = 0
        for sol in []:
            good = True
            for cell, cv in cover:
                t_ = [f for f in cv if P[f]["moves"]]
                b_ = [f for f in cv if not P[f]["moves"]]
                if not t_ or len(b_) < 2:
                    continue
                def below(x, y):
                    return sol[X.v[(x, y)]] if x < y else not sol[X.v[(y, x)]]
                # 先 t が、その点の元のどれかより上 かつ どれかより下
                for t in t_:
                    if not (any(below(bb, t) for bb in b_) and any(below(t, bb) for bb in b_)):
                        good = False
                        break
                if not good:
                    break
            nin += good
        nin = sum(1 for sol in res if inside_ok(sol, X, cover))
        say(f"    うち、先を含むどの点でも「先がその点の元の最下と最上のあいだ」：{nin}")
        store[tag] = (X, [sol for sol in res if inside_ok(sol, X, cover)])

    compare_and_export(P, BB, store, rel)
    say("\n[S] 終端の性質の分け方（ここでは記録だけ）")
    say("  静的（経路に依らない）：面の位置（先＝⑬の線で鏡・元＝動かない）・表裏（det(xf)×鏡）・重なる組の上下・結びの山谷（終端で畳まれた結びの、a の表から見た b の側）")
    say("  経路の量：折り角の符号の履歴・累積回転（0°/±360°）。**探索条件には入れない**。")
    say("  ⚠ 山谷（静的）と累積回転は、「その結びの2枚が途中で互いを突き抜けない」を仮定して初めて結びつく（第16段の ±360° はこの仮定つき）。")

    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))


if __name__ == "__main__":
    main()
