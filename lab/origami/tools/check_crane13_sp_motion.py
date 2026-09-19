# -*- coding: utf-8 -*-
"""つる⑬：単独模型の運動を、SP2（背をはさむ2層）・SP4（4層）の実際の面・折線・出発の上下に**対応を明示して**当てる（2026-09-17）

本人指示
  ・「同じ中割りだから」で流用しない。面・折線・出発の上下の対応を明示する。
  ・対応できたら、出発→分岐点→終端の連続性・全結び・非貫通を確かめ、保存した目標（crane13_terminal_target.json）の
    位置・表裏・上下と照合する。累積回転は条件にせず、経路の結果として記録する。
  ・SP2 が通ったら SP4。追加した左右の層を同じ運動と両立できるか。共有する面の位置と向きが全区間で一致するか。
  ・対応が得られなければ、合わない条件を示して止める。式で確かめた部分と数値の範囲を分けて書く。
本体・UI・保存形式は無変更。運動の探索はしない（式で決まる1本の道だけ）。

単独模型（check_crane13_single.py）の座標：曲がり角 O・背＝x 軸（先が +x）・へ の線 zA＝(cosθ, sinθ)・zB＝(cosθ, −sinθ)。
  板：元A（y≥0・x 側が元）・先A・元B（y≤0）・先B。置き方：元A＝I、元B＝R(x,c⁻)、先A＝R(zA,zA角)、先B＝R(zA,zA角)R(x,c⁺)。
  角は「広げた紙から」（0＝平ら）。出発 c⁻＝c⁺＝+π・zA＝zB＝0。
  中割りの枝（単独模型の段2・3）：zA角＝z・zB角＝−z・c⁻＝2·atan(cosθ·tan(z/2))・c⁺＝−c⁻（z：0→π）
  外へ折る枝（単独模型の対照）：c⁻＝c⁺＝π・zA角＝zB角＝z
使い方： PYTHONHASHSEED=0 python check_crane13_sp_motion.py
"""
import importlib.util
import json
import math
import os
import sys

import numpy as np
import sympy as sp
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("PYTHONHASHSEED") != "0":
    print("ABORT: PYTHONHASHSEED=0 で回すこと")
    sys.exit(2)
_s = importlib.util.spec_from_file_location("ts", os.path.join(HERE, "check_crane13_terminal_stacks.py"))
TS = importlib.util.module_from_spec(_s)
_s.loader.exec_module(TS)
MOT = TS.MOT
ng = []


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


# ======================================================================
# [式] 単独模型の閉じ（四元数で厳密に）
# ======================================================================
def symbolic_proofs():
    say("[式] 単独模型の閉路の閉じ：R(zA,a)·R(x,c⁺) = R(x,c⁻)·R(zB,b) を、四元数（正規化しない (1, tan(φ/2)·軸)）で確かめる")
    u, c, s, v = sp.symbols("u c s v", real=True)

    def qmul(p, q):
        p0, pv = p
        q0, qv = q
        return (p0 * q0 - pv.dot(qv), p0 * qv + q0 * pv + pv.cross(qv))

    ex = sp.Matrix([1, 0, 0])
    aA = sp.Matrix([c, s, 0])
    aB = sp.Matrix([c, -s, 0])
    # 中割りの枝：a=z（tan=u）・c⁺=−c⁻（tan=−v）・c⁻（tan=v）・b=−z（tan=−u）
    L = qmul((1, u * aA), (1, -v * ex))
    R = qmul((1, v * ex), (1, -u * aB))
    d = [sp.simplify(L[0] - R[0])] + [sp.simplify(x) for x in (L[1] - R[1])]
    sol = sp.solve(d[1], v)
    rest = [sp.simplify(x.subs(v, c * u)) for x in d]
    say(f"  中割りの枝：左右の差 = {d}（スカラー・x・y・z）→ 0 になる条件 v = {sol}＝tan(c⁻/2)=cosθ·tan(z/2)；代入後 {rest}")
    ok1 = all(x == 0 for x in rest)
    # 外へ折る枝：c⁻=c⁺=π（四元数 (0, x)）・a=b=z
    L2 = qmul((1, u * aA), (0, ex))
    R2 = qmul((0, ex), (1, u * aB))
    d2 = [sp.simplify(L2[0] - R2[0])] + [sp.simplify(x) for x in (L2[1] - R2[1])]
    say(f"  外へ折る枝（c⁻=c⁺=π・zA角=zB角）：左右の差 = {d2}")
    ok2 = all(x == 0 for x in d2)
    # 段1：z=0・c⁻=c⁺
    say("  段1（zA角=zB角=0・c⁻=c⁺）：両辺とも R(x,c)＝自明に閉じる")
    say("  ⚠ z=π は tan が発散するので、閉じは z∈[0,π) で恒等式・z=π は両辺の連続性から（端の値は数値でも確認）")
    if not (ok1 and ok2):
        bad("式の閉じが確かめられない")
    return ok1 and ok2


# ======================================================================
# 幾何の道具
# ======================================================================
def rot3(axis, ang):
    k = np.asarray(axis, float)
    k = k / np.linalg.norm(k)
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K


def hom(Rm, t=(0, 0, 0)):
    T = np.eye(4)
    T[:3, :3] = Rm
    T[:3, 3] = t
    return T


def rot_line(p, d, ang):
    p = np.array([p[0], p[1], 0.0])
    Rm = rot3([d[0], d[1], 0.0], ang)
    return hom(Rm, p - Rm @ p)


def xf(T, p):
    return (T @ np.array([p[0], p[1], 0.0 if len(p) < 3 else p[2], 1.0]))[:3]


def single_place(branch, z, theta):
    """単独模型の置き方（原点まわり）。branch: 'rev'（中割り）/ 'out'（外へ折る）/ 'open'（段1：z は開き c）"""
    aA = [math.cos(theta), math.sin(theta), 0]
    if branch == "open":
        c = z
        return {"元A": np.eye(3), "元B": rot3([1, 0, 0], c), "先A": np.eye(3), "先B": rot3([1, 0, 0], c)}, dict(cm=c, cp=c, za=0.0, zb=0.0)
    if branch == "rev":
        cm = math.pi if z >= math.pi else 2 * math.atan(math.cos(theta) * math.tan(z / 2))
        cp, za, zb = -cm, z, -z
    else:
        cm = cp = math.pi
        za = zb = z
    RA = rot3(aA, za)
    return {"元A": np.eye(3), "元B": rot3([1, 0, 0], cm), "先A": RA, "先B": RA @ rot3([1, 0, 0], cp)}, dict(cm=cm, cp=cp, za=za, zb=zb)


# ======================================================================
# 対応（単独模型 → 実際の曲がり角）
# ======================================================================
class Vertex:
    """実際の曲がり角1つ：層 LA（A 側＝元A/先A に当てる）と層 LB（B 側）"""

    def __init__(self, P, BB, byname, LA, LB, D, label):
        self.label = label
        nm = lambda k, L: byname[f"{k}{L}"]
        self.map = {"元A": nm("元", LA), "先A": nm("先", LA), "元B": nm("元", LB), "先B": nm("先", LB)}
        ids = set(self.map.values())
        bonds = [b for b in BB if b["a"] in ids and b["b"] in ids]
        pick = lambda x, y: [b for b in bonds if {b["a"], b["b"]} == {self.map[x], self.map[y]}]
        self.b = {"c⁻": pick("元A", "元B"), "c⁺": pick("先A", "先B"), "zA": pick("元A", "先A"), "zB": pick("元B", "先B")}
        other = [b for b in bonds if not any(b in v for v in self.b.values())]
        say(f"  {label}：板 " + "・".join(f"{k}↔{TS.short(v)}" for k, v in self.map.items())
            + "／折線 " + "・".join(f"{k}↔{len(v)}本" for k, v in self.b.items()) + f"／対応しない結び {len(other)}")
        if any(len(v) != 1 for v in self.b.values()) or other:
            bad(f"{label}：折線の対応が1対1でない")
            raise SystemExit
        self.b = {k: v[0] for k, v in self.b.items()}
        segC = np.array(self.b["c⁻"]["seg0"])
        segP = np.array(self.b["c⁺"]["seg0"])
        segA = np.array(self.b["zA"]["seg0"])
        segB = np.array(self.b["zB"]["seg0"])
        dd = segC[1] - segC[0]
        dd = dd / np.linalg.norm(dd)
        n = np.array([-dd[1], dd[0]])
        col = max(abs(float((q - segC[0]) @ n)) for q in list(segP))
        # 曲がり角 V＝⑬の線分の端で背の直線の上にある点
        endsA = [q for q in segA if abs(float((q - segC[0]) @ n)) < 1e-9]
        endsB = [q for q in segB if abs(float((q - segC[0]) @ n)) < 1e-9]
        if len(endsA) != 1 or len(endsB) != 1 or np.linalg.norm(endsA[0] - endsB[0]) > 1e-9:
            bad(f"{label}：⑬の線分の端が背の直線の上で1点にならない")
            raise SystemExit
        V = endsA[0]
        onC = min(np.linalg.norm(V - q) for q in list(segC) + list(segP))
        # 先の向き d：先A の重心の側
        P0 = lambda f: np.mean(np.array(P[f]["start"]), axis=0)
        d = dd if float((P0(self.map["先A"]) - V) @ dd) > 0 else -dd
        rA = (segA[1] if np.linalg.norm(segA[1] - V) > 1e-9 else segA[0]) - V
        rA = rA / np.linalg.norm(rA)
        rB = (segB[1] if np.linalg.norm(segB[1] - V) > 1e-9 else segB[0]) - V
        rB = rB / np.linalg.norm(rB)
        th = math.acos(max(-1.0, min(1.0, float(d @ rA))))
        f = (rA - math.cos(th) * d) / math.sin(th)
        sPhi = 1 if d[0] * f[1] - d[1] * f[0] > 0 else -1
        self.V, self.d, self.f, self.th, self.sPhi, self.rA = V, d, f, th, sPhi, rA
        say(f"    幾何（出発の姿の座標）：背の2本は同じ直線（ずれ {col:.1e}）・曲がり角 V={np.round(V, 6).tolist()}（背の線分の端とのずれ {onC:.1e}）")
        say(f"    θ＝⑬の線（A 側）と背の先の向きのなす角 {math.degrees(th):.4f}°（{'先' if th < math.pi / 2 else '元'}へ傾く）"
            f"／B 側の⑬の線の向きは A と同じ直線か：ずれ {np.linalg.norm(rB - rA):.1e}（畳まれた姿では1本の直線）")
        # 板の側：元は −d・先は +d、A 側の板は +f（B は畳まれて同じ側＝広げると −f）
        chk = []
        for k, fid in self.map.items():
            c0 = P0(fid) - V
            along, across = float(c0 @ d), float(c0 @ f)
            want_along = 1 if k.startswith("先") else -1
            chk.append((k, along * want_along > 0, across > 0))
        say("    板の位置（出発）：" + "・".join(f"{k} {'先' if k.startswith('先') else '元'}側{'○' if a else '✕'}・f 側{'○' if c_ else '✕'}" for k, a, c_ in chk)
            + "（B は畳まれているので f 側で正しい）")
        if not all(a and c_ for _, a, c_ in chk):
            bad(f"{label}：板の位置が単独模型の板と対応しない")
            raise SystemExit
        say(f"    写像 Φ（単独模型の広げた紙 → 実際の広げた紙）：O→V・x→d・y→f、平面での向き det={sPhi:+d}")
        # 出発の上下で z の向きを決める
        rel, conflict, missing = TS.start_relations(D, P, sorted(ids))
        self.start_rel = rel
        a_, b_ = sorted([self.map["元A"], self.map["元B"]])
        r_eng = rel.get((a_, b_))
        want = (r_eng if b_ == self.map["元B"] else -r_eng) if r_eng is not None else None   # 元B が元A の上(+1)
        got = {}
        for sz in (1, -1):
            self.sz = sz
            T = self.world("open", math.pi - 1e-3, None)
            got[sz] = 1 if xf(T[self.map["元B"]], np.mean(np.array(P[self.map["元B"]]["start"]), axis=0))[2] > 0 else -1
        pickz = [sz for sz in (1, -1) if got[sz] == want]
        say(f"    出発の上下（engine stackAt）：{TS.short(self.map['元B'])} は {TS.short(self.map['元A'])} の{'上' if want > 0 else '下'}"
            f"／z の向き +1 なら {'上' if got[1] > 0 else '下'}・−1 なら {'上' if got[-1] > 0 else '下'} → z の向き {pickz}")
        if len(pickz) != 1:
            bad(f"{label}：出発の上下と対応する z の向きが1つに決まらない")
            raise SystemExit
        self.sz = pickz[0]
        # 先の組も同じ向きで合うか
        a_, b_ = sorted([self.map["先A"], self.map["先B"]])
        r2 = rel.get((a_, b_))
        want2 = (r2 if b_ == self.map["先B"] else -r2) if r2 is not None else None
        T = self.world("open", math.pi - 1e-3, None)
        got2 = 1 if xf(T[self.map["先B"]], np.mean(np.array(P[self.map["先B"]]["start"]), axis=0))[2] > 0 else -1
        say(f"    確かめ：{TS.short(self.map['先B'])} は {TS.short(self.map['先A'])} の{'上' if want2 > 0 else '下'}（stackAt）／この向きの写像で {'上' if got2 > 0 else '下'}"
            f" → {'一致' if got2 == want2 else '**不一致**'}")
        if got2 != want2:
            bad(f"{label}：先の組の出発の上下が対応しない")
            raise SystemExit
        say(f"    ⇒ 単独模型の角 φ は、実際の軸（Φ で写した向き）のまわりで {self.sPhi * self.sz:+d}·φ 回る（Φ₃ R(a,φ) Φ₃⁻¹ = R(Φ₃a, det Φ₃·φ)）")

    def Phi3(self):
        L = np.array([[self.d[0], self.f[0], 0], [self.d[1], self.f[1], 0], [0, 0, self.sz]], float)
        return hom(L, (self.V[0], self.V[1], 0.0))

    def world(self, branch, z, anchor):
        """実際の板の置かれ方（出発の姿の座標 → 世界）。anchor＝元A の世界の置かれ方（None なら動かない）"""
        Ts, ang = single_place(branch, z, self.th)
        F = self.Phi3()
        Fi = np.linalg.inv(F)
        UB = rot_line(self.V, self.d, math.pi)
        out = {}
        for k, fid in self.map.items():
            U = UB if k.endswith("B") else np.eye(4)
            W = F @ hom(Ts[k]) @ Fi @ U
            out[fid] = (anchor @ W) if anchor is not None else W
        self.last_angles = ang
        return out


# ======================================================================
# 検査
# ======================================================================
def bond_err(T, bonds):
    e = 0.0
    for b in bonds:
        for p in b["seg0"]:
            e = max(e, float(np.linalg.norm(xf(T[b["a"]], p) - xf(T[b["b"]], p))))
    return e


def shrink_poly3(T, P, f, k=0.01):
    pts = np.array(P[f]["start"])
    c = pts.mean(axis=0)
    pts = c + (pts - c) * (1 - k)
    return [xf(T[f], p) for p in pts]


def penetration(T, P, ids, flat_ok=False):
    """板どうしの交わり。出発と同じ相対の置かれ方の組は除く（厚み0で重なったまま）。
       flat_ok＝終端・出発の平らな姿では同じ平面の重なりを見ない（層順で見る）"""
    worst, who = 0.0, None
    ids = sorted(ids)
    Q = {f: shrink_poly3(T, P, f) for f in ids}
    N = {}
    for f in ids:
        n = np.cross(Q[f][1] - Q[f][0], Q[f][2] - Q[f][0])
        N[f] = n / np.linalg.norm(n)
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = ids[i], ids[j]
            rel = np.linalg.inv(T[a]) @ T[b]
            if np.allclose(rel, np.eye(4), atol=1e-9):
                continue
            na, nb = N[a], N[b]
            if np.linalg.norm(np.cross(na, nb)) < 1e-9:
                if abs(float(na @ (Q[b][0] - Q[a][0]))) > 1e-9 or flat_ok:
                    continue
                e1 = Q[a][1] - Q[a][0]
                e1 = e1 / np.linalg.norm(e1)
                e2 = np.cross(na, e1)
                pa = Polygon([(float(e1 @ p), float(e2 @ p)) for p in Q[a]])
                pb = Polygon([(float(e1 @ p), float(e2 @ p)) for p in Q[b]])
                ar = pa.intersection(pb).area
                if ar > 1e-9 and ar > worst:
                    worst, who = ar, (a, b, "同じ平面で重なる")
                continue
            sa = MOT.M and _clip(Q[a], nb, float(nb @ Q[b][0]))
            sb = _clip(Q[b], na, float(na @ Q[a][0]))
            if not sa or not sb:
                continue
            L = np.cross(na, nb)
            L = L / np.linalg.norm(L)
            ta = sorted(float(L @ p) for p in sa)
            tb = sorted(float(L @ p) for p in sb)
            ov = min(ta[-1], tb[-1]) - max(ta[0], tb[0])
            if ov > 1e-9 and ov > worst:
                worst, who = ov, (a, b, "交わる")
    return worst, who


def _clip(Pp, n, d):
    s = [float(n @ p - d) for p in Pp]
    pts = []
    for i in range(len(Pp)):
        a, b, sa, sb = Pp[i], Pp[(i + 1) % len(Pp)], s[i], s[(i + 1) % len(Pp)]
        if abs(sa) < 1e-12:
            pts.append(a)
        if (sa < -1e-12 and sb > 1e-12) or (sa > 1e-12 and sb < -1e-12):
            pts.append(a + (b - a) * (sa / (sa - sb)))
    return pts if len(pts) >= 2 else None


def rel_angle(T, b):
    Ta, Tb = T[b["a"]], T[b["b"]]
    Rm = (np.linalg.inv(Ta) @ Tb)[:3, :3]
    d = np.array(b["seg0"][1] + [0.0]) - np.array(b["seg0"][0] + [0.0])
    d = d / np.linalg.norm(d)
    s_ = 0.5 * float(d @ np.array([Rm[2, 1] - Rm[1, 2], Rm[0, 2] - Rm[2, 0], Rm[1, 0] - Rm[0, 1]]))
    c_ = 0.5 * (float(np.trace(Rm)) - 1.0)
    return math.atan2(s_, c_)


def run_model(tag, P, BB, D, target, ids, place_fn, schedule, start_rel):
    """schedule: [(段の名前, パラメータの列, 関数 τ→置かれ方)]"""
    bonds = [b for b in BB if b["a"] in ids and b["b"] in ids]
    say(f"\n  [{tag}] 経路の数値の確認：結び {len(bonds)} 本")
    wind = {b["bondId"] + "|" + b["a"]: 0.0 for b in bonds}
    hist = {k: [] for k in wind}
    worst = dict(bond=0.0, jump=0.0, pen=0.0, who=None, at=None)
    prev = None
    snaps = {}
    for name, params, fn in schedule:
        for k, t in enumerate(params):
            T = fn(t)
            e = bond_err(T, bonds)
            worst["bond"] = max(worst["bond"], e)
            if prev is not None:
                jmp = max(float(np.linalg.norm(T[f] - prev[f])) for f in ids)
                worst["jump"] = max(worst["jump"], jmp)
            flat = (name == "出発" or (name.startswith("段2") and k == len(params) - 1))
            if not flat:
                pen, who = penetration(T, P, ids)
                if pen > worst["pen"]:
                    worst.update(pen=pen, who=who, at=f"{name} {t:.6g}")
            for b in bonds:
                key = b["bondId"] + "|" + b["a"]
                wind[key] = MOT.M and (rel_angle(T, b) + 2 * math.pi * round((wind[key] - rel_angle(T, b)) / (2 * math.pi)))
            prev = T
        snaps[name] = (fn(params[-1]), {k: v for k, v in wind.items()})
    say(f"    全区間：全結びのずれ（最大）{worst['bond']:.1e}／1刻みの置かれ方の変化（最大）{worst['jump']:.2e}"
        f"／すり抜け {'なし' if worst['pen'] <= 0 else f'あり {worst[chr(112)+chr(101)+chr(110)]:.2e} {TS.short(worst[chr(119)+chr(104)+chr(111)][0])}×{TS.short(worst[chr(119)+chr(104)+chr(111)][1])} {worst[chr(119)+chr(104)+chr(111)][2]} @ {worst[chr(97)+chr(116)]}'}")
    if worst["bond"] > 1e-9:
        bad(f"{tag}：結びがつながっていない")
    if worst["pen"] > 0:
        bad(f"{tag}：すり抜けがある")
    return worst, snaps, bonds


def compare_target(tag, P, ids, T_end, T_near, target, bonds, start_rel):
    say(f"  [{tag}] 保存した目標との照合（crane13_terminal_target.json）")
    A, B = TS_cutseg[0]
    Rpi = MOT.rot_about((A[0], A[1], 0), (B[0], B[1], 0), math.pi)
    pos = max(float(np.linalg.norm(xf(T_end[f], p) - xf(Rpi if P[f]["moves"] else np.eye(4), p))) for f in ids for p in P[f]["start"])
    side = [(f, (1 if T_end[f][2, 2] > 0 else -1) * P[f]["side0"], P[f]["side1"]) for f in ids]
    say(f"    位置：目標とのずれ（最大）{pos:.1e}／表裏：" + "・".join(f"{TS.short(f)} {'表' if s1 > 0 else '裏'}上{'' if s1 == s2 else '✕'}" for f, s1, s2 in side))
    if pos > 1e-9 or any(s1 != s2 for _, s1, s2 in side):
        bad(f"{tag}：位置・表裏が目標と違う")
    above = {(a, b): r for a, b, r in target["above"]}
    polys = {f: Polygon(P[f]["end"]) for f in ids}
    n_ok = n_ng = 0
    n_carry = 0
    rows = []
    for (a, b), r in sorted(above.items()):
        if a not in ids or b not in ids:
            continue
        it = polys[a].intersection(polys[b])
        if it.area <= 1e-9:
            continue
        pt = it.representative_point()
        h = {}
        for f in (a, b):
            Te = Rpi if P[f]["moves"] else np.eye(4)
            q = np.linalg.inv(Te) @ np.array([pt.x, pt.y, 0.0, 1.0])
            h[f] = float(xf(T_near[f], q[:2])[2])
        if abs(h[b] - h[a]) > 1e-12:
            got = 1 if h[b] > h[a] else -1
            how = f"高さの差 {abs(h[b] - h[a]):.1e}"
        else:
            # 同じ置かれ方のまま（厚み0）＝出発の上下を持ち越す：世界の上下は a の面の向きで決まる
            k = (a, b)
            r0 = start_rel.get(k)
            flip = 1 if T_near[a][2, 2] > 0 else -1
            got = r0 * flip if r0 is not None else 0
            how = "同じ置かれ方（出発の上下×向き）"
            n_carry += 1
        ok = got == r
        n_ok += ok
        n_ng += not ok
        rows.append((a, b, got, r, how))
        if not ok:
            say(f"    **反する**：{TS.short(a)} と {TS.short(b)}：着いた {TS.short(b)} が{'上' if got > 0 else '下'}／目標 {'上' if r > 0 else '下'}（{how}）")
    say(f"    上下：重なる組 {n_ok + n_ng} のうち一致 {n_ok}・反する {n_ng}（うち高さで読んだ {n_ok + n_ng - n_carry}・同じ置かれ方のまま出発の上下を持ち越した {n_carry}＝厚み0の仮定）")
    if n_ng:
        bad(f"{tag}：上下が目標と違う")
    return rows


TS_cutseg = [None]


def main():
    symbolic_proofs()
    D, cut, P, BB, cutseg = TS.build_input()
    TS_cutseg[0] = cutseg
    T = json.load(open(os.path.join(HERE, "crane13_terminal_target.json"), encoding="utf-8"))
    TS.NAMES.update(T["names"])
    byname = {v: k for k, v in T["names"].items()}
    tipB = lambda: None

    # ---------------- SP2 ----------------
    say("\n==== SP2（層-2・層-1）：単独模型の中割りの枝との対応 ====")
    Vs = Vertex(P, BB, byname, -2, -1, D, "背の角（層-2|層-1）")
    ids2 = set(Vs.map.values())
    start_rel2 = Vs.start_rel
    thdeg = math.degrees(Vs.th)
    say(f"    単独模型で使う θ＝{thdeg:.4f}°（check_crane13_single.py の既定 75.9638° と {'同じ' if abs(thdeg - 75.96375653207353) < 1e-6 else '違う'}）")
    N1, N2 = 4000, 8000
    sched1 = [i / N1 for i in range(N1 + 1)]
    zs = [math.pi * i / N2 for i in range(N2 + 1)] + [math.pi * (1 - 10 ** -k) for k in range(4, 10)]
    zs = sorted(set(zs))
    sched = [("出発", [0.0], lambda t: Vs.world("open", math.pi, None)),
             ("段1 背を開く c=π→0", sched1, lambda t: Vs.world("open", math.pi * (1 - t), None)),
             ("段2・3 中割りの枝 z=0→π", zs, lambda z: Vs.world("rev", z, None))]
    say("  道（式で決まる・探索なし）：段1 c⁻=c⁺=π(1−τ)・z=0 ／ 段2・3 z：0→π、c⁻=2atan(cosθ tan(z/2))・c⁺=−c⁻・zB角=−z")
    say("  連続性（式）：段1 の終わり（c=0,z=0）と段2 の始め（z=0 → c⁻=0）は同じ姿（分岐点＝平ら）。c⁻(z) は [0,π) で連続・z→π で π に連続。")
    w2, snaps2, bonds2 = run_model("SP2", P, BB, D, T, ids2, None, sched, start_rel2)
    # 分岐点が平らで重ならないか（同じ平面の重なり）
    Tflat = Vs.world("open", 0.0, None)
    pen, who = penetration(Tflat, P, ids2, flat_ok=False)
    say(f"    分岐点（平ら）：板どうしの同じ平面の重なり {'なし' if pen <= 0 else f'あり {pen:.2e} {who}'}")
    if pen > 0:
        bad("SP2：分岐点で板が重なる")
    Tend = Vs.world("rev", math.pi, None)
    Tnear = Vs.world("rev", math.pi - 1e-4, None)
    compare_target("SP2", P, ids2, Tend, Tnear, T, bonds2, start_rel2)
    say("    累積回転（経路の結果・出発 0 からの unwrap・条件にはしていない）：")
    for b in bonds2:
        key = b["bondId"] + "|" + b["a"]
        say(f"      {TS.short(b['a'])}|{TS.short(b['b'])}：分岐点 {math.degrees(snaps2['段1 背を開く c=π→0'][1][key]):+.1f}° → 終端 {math.degrees(snaps2['段2・3 中割りの枝 z=0→π'][1][key]):+.1f}°")
    # 対照：単独模型の角
    say("    単独模型の角（終端）：c⁻ +180°・zA +180°・c⁺ −180°・zB −180°（広げた紙から）")
    if ng:
        say("\n→ SP2 が通らないので止める")
        return

    # ---------------- SP4 ----------------
    say("\n==== SP4（層-19・-2・-1・3）：左右に足した層との両立 ====")
    Vo1 = Vertex(P, BB, byname, -2, -19, D, "外形の側の角（層-19|層-2）・A=層-2（背の角と共有）")
    Vo2 = Vertex(P, BB, byname, -1, 3, D, "外形の側の角（層-1|層3）・A=層-1（背の角と共有）")
    ids4 = ids2 | set(Vo1.map.values()) | set(Vo2.map.values())
    # 目標の結びの側（静的）で、外形の側の角の枝を選ぶ
    say("  外形の側の角に使う枝（目標の静的な量から）：")
    for Vo in (Vo1, Vo2):
        rows = [b for b in T["bonds"] if {b["a"], b["b"]} in ({Vo.map["元A"], Vo.map["元B"]}, {Vo.map["先A"], Vo.map["先B"]})]
        same = [r["front0"] == r["front1"] for r in rows]
        say(f"    {Vo.label}：目標で 元の組 {'出発と同じ側' if same[0] else '入れかわる'}・先の組 {'出発と同じ側' if same[1] else '入れかわる'}")
        say("      中割りの枝（単独模型の段2・3）は終端で c⁻=+π・c⁺=−π＝片方だけ出発と逆側（折線の2枚が途中で突き抜けない仮定のもとで）"
            "→ 目標（両方同じ側）と合わない／外へ折る枝（c⁻=c⁺=π のまま）は両方同じ側 → **外へ折る枝を使う**")
        if not all(same):
            bad(f"{Vo.label}：目標の側が外へ折る枝と合わない")
    # z の対応：共有する⑬の結びの回転を、背の角と外形の側の角で同じにする（向きは幾何から）
    def sigma(Vo, part):
        # 背の角で、その層の⑬の結び（先|元）の回転：A 側 = sPhi·sz·z（軸 rA・始点 Vs）／B 側 = sPhi·sz·(−z)（軸 rA：畳まれた姿で同じ直線）
        s_sp = Vs.sPhi * Vs.sz * (1 if part == "A" else -1)
        dirdot = float(Vs.rA @ Vo.rA)
        on_line = abs(float((Vo.V - Vs.V) @ np.array([-Vs.rA[1], Vs.rA[0]])))
        return s_sp * np.sign(dirdot) / (Vo.sPhi * Vo.sz), dirdot, on_line
    sg1, dd1, ol1 = sigma(Vo1, "A")
    sg2, dd2, ol2 = sigma(Vo2, "B")
    say(f"  ⑬の角の対応（幾何から・合わせこみなし）：外形の側の角の z ＝ σ·（背の角の z）")
    say(f"    層-2：σ={sg1:+.0f}（⑬の線の向きの内積 {dd1:+.3f}・曲がり角どうしが同じ直線の上 {ol1:.1e}）")
    say(f"    層-1：σ={sg2:+.0f}（内積 {dd2:+.3f}・同じ直線 {ol2:.1e}）")
    say("  式：外形の側の角の置かれ方＝（共有する元の板の世界の置かれ方）×Φ₃ R_single(外へ折る, σz) Φ₃⁻¹ U。外へ折る枝の閉じは [式] で恒等式。")

    def world4(branch_sp, t):
        Ts = Vs.world(branch_sp, t, None)
        z = 0.0 if branch_sp == "open" else t
        o1 = Vo1.world("out", sg1 * z, Ts[Vo1.map["元A"]])
        o2 = Vo2.world("out", sg2 * z, Ts[Vo2.map["元A"]])
        W = dict(Ts)
        share = 0.0
        for o, Vo in ((o1, Vo1), (o2, Vo2)):
            for k in ("元A", "先A"):
                share = max(share, float(np.max(np.abs(o[Vo.map[k]] - Ts[Vo.map[k]]))))
            W[Vo.map["元B"]] = o[Vo.map["元B"]]
            W[Vo.map["先B"]] = o[Vo.map["先B"]]
        world4.share = max(getattr(world4, "share", 0.0), share)
        return W

    world4.share = 0.0
    sched4 = [("出発", [0.0], lambda t: world4("open", math.pi)),
              ("段1 背を開く c=π→0", sched1, lambda t: world4("open", math.pi * (1 - t))),
              ("段2・3 中割りの枝 z=0→π", zs, lambda z: world4("rev", z))]
    say("  道：背の角は SP2 と同じ式。外形の側の角は外へ折る枝で、層-19・層3 の板を外形の側の角の式から置く（背の角の式からは置かない）")
    start_rel4 = {}
    start_rel4.update(TS.start_relations(D, P, sorted(ids4))[0])
    w4, snaps4, bonds4 = run_model("SP4", P, BB, D, T, ids4, None, sched4, start_rel4)
    say(f"    共有する板（元-2・先-2・元-1・先-1）の置かれ方：背の角の式と外形の側の角の式の差（全区間の最大・4×4 の成分）{world4.share:.1e}")
    if world4.share > 1e-9:
        bad("SP4：共有する板の位置・向きが2つの式で一致しない")
    # 対照：すり抜けの判定が働くか（わざと壊した姿）
    Tc = dict(world4("open", 0.0))
    fr = Vo1.map["先B"]
    cen = np.mean(np.array(P[fr]["start"]), axis=0)
    Tc[fr] = Tc[fr] @ rot_line(cen, [1.0, 0.3], 0.5)
    pc, wc = penetration(Tc, P, ids4)
    Tc2 = dict(world4("open", 0.0))
    mv = Vs.map["元B"]
    shift = np.mean(np.array(P[Vs.map["元A"]]["start"]), axis=0) - xf(Tc2[mv], np.mean(np.array(P[mv]["start"]), axis=0))[:2]
    Tc2[mv] = hom(np.eye(3), (shift[0], shift[1], 0.0)) @ Tc2[mv]
    pc2, wc2 = penetration(Tc2, P, ids4)
    say(f"    対照（わざと壊す）：{TS.short(fr)} を面の中の線で 0.5rad 傾ける → {'検出 ' + wc[2] if pc > 0 else '**検出しない**'}"
        f"／分岐点で {TS.short(mv)} を {TS.short(Vs.map['元A'])} の上へ平行移動 → {'検出 ' + wc2[2] if pc2 > 0 else '**検出しない**'}")
    if pc <= 0 or pc2 <= 0:
        bad("すり抜けの判定が対照を検出しない")
    Tflat4 = world4("open", 0.0)
    pen, who = penetration(Tflat4, P, ids4, flat_ok=False)
    say(f"    分岐点（背だけ平ら・外形の側は畳んだまま）：同じ平面の重なり {'なし' if pen <= 0 else f'あり {pen:.2e} {TS.short(who[0])}×{TS.short(who[1])}'}")
    if pen > 0:
        bad("SP4：分岐点で板が重なる")
    Tend4 = world4("rev", math.pi)
    Tnear4 = world4("rev", math.pi - 1e-4)
    compare_target("SP4", P, ids4, Tend4, Tnear4, T, bonds4, start_rel4)
    say("    累積回転（経路の結果）：")
    for b in bonds4:
        key = b["bondId"] + "|" + b["a"]
        say(f"      {TS.short(b['a'])}|{TS.short(b['b'])}：分岐点 {math.degrees(snaps4['段1 背を開く c=π→0'][1][key]):+.1f}° → 終端 {math.degrees(snaps4['段2・3 中割りの枝 z=0→π'][1][key]):+.1f}°")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        pass
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
