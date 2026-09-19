# -*- coding: utf-8 -*-
"""つる⑬：脚8層ぜんぶ（16枚）を1つの運動として置き、分岐点の平らな姿を「胴との結びの共通基準面」として保存する（2026-09-18）

本人指示
  ① 脚の残り4層（層-18・-3・1・0）も、SP4 で使った**外へ折る枝**で層-2・層-1 に乗せる。
  ② そのうえで、**分岐点の平らな姿**を「胴との結びの共通基準面」として定義する。
  ③ **厚み0に頼っている上下の組には印**を付け、胴との結びに入るときに**どこから厚みを考慮するかを切り替えられる**ようにする。
運動は探索しない（第18段の式で決まる1本の道）。本体・UI・保存形式は無変更。

道（第18段と同じ式）
  背の角（層-2|層-1）＝中割りの枝：z：0→π、c⁻=2·atan(cosθ·tan(z/2))・c⁺=−c⁻・zB角=−zA角
  ほかの6つの角＝外へ折る枝：その角の背は畳んだまま（c⁻=c⁺=π）・両側の⑬の角は同じ
  ＝脚は「背で分かれた2つのかたまり（下4層・上4層）」として動く。段1 は背だけを平らに開く。

出力
  crane13_branchpoint_frame.json … 共通基準面（分岐点の平らな姿）：面ごとの置かれ方・表裏・その姿での多角形・
      脚から胴へ出ていく結び（8本）と、その結びで胴側に要求される回転／基準面の決め方（原点・基準線・法線の向き）
  crane13_stack_flags.json … 上下の組ごとに「高さで読めた（厚み0に依らない）」「同じ置かれ方のまま＝厚み0に頼る」の印
使い方： PYTHONHASHSEED=0 python check_crane13_leg_frame.py [--thickness 1e-4] [--fine]
  --thickness EPS ＞0：**高さが同じになる組（印）の決着**を、紙の厚みの模型（面の法線へ EPS×層の順 だけずらす）で行う。
  既定は 0（厚み0）＝その組は出発の上下を持ち越す。どちらでも幾何で決まる組には触らない（厚みを全部の高さに足すと、
  終端の手前で読む高さ 〜δ を厚みが上書きしてしまう＝2026-09-18 に実際に 34 組ひっくり返して気づいた）。
  すり抜けの判定は厚み0のまま（板の交わりだけ）＝切りかえの範囲外。
"""
import importlib.util
import json
import math
import os
import sys

import numpy as np
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
if os.environ.get("PYTHONHASHSEED") != "0":
    print("ABORT: PYTHONHASHSEED=0 で回すこと")
    sys.exit(2)
_argv = sys.argv
sys.argv = [sys.argv[0]]
_s = importlib.util.spec_from_file_location("sp", os.path.join(HERE, "check_crane13_sp_motion.py"))
SP = importlib.util.module_from_spec(_s)
_s.loader.exec_module(SP)
sys.argv = _argv
TS, MOT = SP.TS, SP.MOT
EPS = float(_argv[_argv.index("--thickness") + 1]) if "--thickness" in _argv else 0.0
FINE = "--fine" in _argv
ng = []


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


def ang_about(Rm, axis):
    """回転 Rm の、軸 axis のまわりの符号つき角"""
    a = np.asarray(axis, float)
    a = a / np.linalg.norm(a)
    s = 0.5 * float(a @ np.array([Rm[2, 1] - Rm[1, 2], Rm[0, 2] - Rm[2, 0], Rm[1, 0] - Rm[0, 1]]))
    c = 0.5 * (float(np.trace(Rm)) - 1.0)
    return math.atan2(s, c)


def build_leg_motion(D, cut, P, BB, T, verbose=True):
    """脚16枚の運動（第18・19段の式）を作る。戻り：world(branch, t)・板の集合・曲がり角・じゃばらの並び・背の位置"""
    global say
    if not verbose:
        say = lambda *a: None
    cutseg = (list(cut["cutseg"][0]), list(cut["cutseg"][1]))
    SP.TS_cutseg[0] = cutseg
    TS.NAMES.update(T["names"])
    byname = {v: k for k, v in T["names"].items()}
    g = np.array(cutseg[1]) - np.array(cutseg[0])
    g = g / np.linalg.norm(g)
    g3 = np.array([g[0], g[1], 0.0])

    # ---------- 脚のじゃばらの並び ----------
    legbase = [f for f in P if P[f]["leg"] and not P[f]["moves"]]
    nb = {f: [] for f in legbase}
    for b in BB:
        if b["a"] in nb and b["b"] in nb:
            nb[b["a"]].append(b["b"])
            nb[b["b"]].append(b["a"])
    end = sorted(f for f in legbase if len(nb[f]) == 1)[0]
    chain, seen = [end], {end}
    while True:
        nxt = [x for x in nb[chain[-1]] if x not in seen]
        if not nxt:
            break
        chain.append(nxt[0])
        seen.add(nxt[0])
    layers = [P[f]["layer"] for f in chain]
    say(f"\n脚のじゃばら（元の板の並び）：" + " → ".join(f"層{L}" for L in layers))
    if len(chain) != 8:
        raise RuntimeError("脚の元の板が8枚の一列にならない")

    # ---------- 背の角＝目標で先の組の側が入れかわる角（目標から決める・決め打ちしない） ----------
    flip = []
    for k in range(len(layers) - 1):
        LA, LB = layers[k], layers[k + 1]
        rows = [b for b in T["bonds"] if {b["a"], b["b"]} == {byname[f"先{LA}"], byname[f"先{LB}"]}]
        base = [b for b in T["bonds"] if {b["a"], b["b"]} == {byname[f"元{LA}"], byname[f"元{LB}"]}]
        ft = rows[0]["front0"] != rows[0]["front1"]
        fb = base[0]["front0"] != base[0]["front1"]
        flip.append((k, LA, LB, ft, fb))
    say("目標（静的）で側が入れかわる角：" + "／".join(f"層{a}|{b} 先{'入' if ft else '同'}・元{'入' if fb else '同'}" for _, a, b, ft, fb in flip))
    sp_idx = [k for k, _, _, ft, fb in flip if ft or fb]
    if len(sp_idx) != 1:
        raise RuntimeError("側が入れかわる角が1つに決まらない")
    si = sp_idx[0]
    say(f"  → 背の角＝層{layers[si]}|層{layers[si + 1]}（中割りの枝）。ほかの6つは両方「同じ側」＝**外へ折る枝**（第18段 §73 と同じ理由）")

    # ---------- 曲がり角の対応（背から外へ順に） ----------
    say("\n[対応] 曲がり角ごとに単独模型を当てる（A＝背に近い側＝すでに置いた層）")
    Vspine = SP.Vertex(P, BB, byname, layers[si], layers[si + 1], D, f"背の角（層{layers[si]}|層{layers[si + 1]}）")
    riders = []      # (Vertex, host層, new層)
    for k in range(si - 1, -1, -1):
        riders.append((SP.Vertex(P, BB, byname, layers[k + 1], layers[k], D,
                                 f"外形/中心線の角（層{layers[k]}|層{layers[k + 1]}）・A=層{layers[k + 1]}"), layers[k + 1], layers[k]))
    for k in range(si + 1, len(layers) - 1):
        riders.append((SP.Vertex(P, BB, byname, layers[k], layers[k + 1], D,
                                 f"外形/中心線の角（層{layers[k]}|層{layers[k + 1]}）・A=層{layers[k]}", ), layers[k], layers[k + 1]))
    ids = set(Vspine.map.values())
    for Vo, _, _ in riders:
        ids |= set(Vo.map.values())
    say(f"  板 {len(ids)} 枚（脚の16枚：{'すべて' if len(ids) == 16 else '足りない'}）")

    share = [0.0]

    def world(branch, t):
        W = dict(Vspine.world(branch, t, None))
        for Vo, hostL, newL in riders:
            host = byname[f"元{hostL}"]
            tipA = byname[f"先{hostL}"]
            psi = ang_about((np.linalg.inv(W[host]) @ W[tipA])[:3, :3], g3)       # 共有する⑬の結びの回転（共通の向き g のまわり）
            za = Vo.sPhi * Vo.sz * psi * float(np.sign(Vo.rA @ g))                # 単独模型の角へ戻す（幾何だけで決まる）
            o = Vo.world("out", za, W[host])
            share[0] = max(share[0], float(np.max(np.abs(o[tipA] - W[tipA]))))     # 共有する板の位置と向き
            W[Vo.map["元B"]] = o[Vo.map["元B"]]
            W[Vo.map["先B"]] = o[Vo.map["先B"]]
        return W

    return world, ids, Vspine, riders, layers, si, share


def main():
    SP.symbolic_proofs()
    D, cut, P, BB, cutseg = TS.build_input()
    SP.TS_cutseg[0] = cutseg
    T = json.load(open(os.path.join(HERE, "crane13_terminal_target.json"), encoding="utf-8"))
    TS.NAMES.update(T["names"])
    byname = {v: k for k, v in T["names"].items()}
    world, ids, Vspine, riders, layers, si, share = build_leg_motion(D, cut, P, BB, T)

    # ---------- 経路 ----------
    N1, N2 = (4000, 8000) if FINE else (800, 1600)
    sched1 = [i / N1 for i in range(N1 + 1)]
    zs = sorted(set([math.pi * i / N2 for i in range(N2 + 1)] + [math.pi * (1 - 10 ** -k) for k in range(4, 10)]))
    sched = [("出発", [0.0], lambda t: world("open", math.pi)),
             ("段1 背を開く c=π→0", sched1, lambda t: world("open", math.pi * (1 - t))),
             ("段2・3 中割りの枝 z=0→π", zs, lambda z: world("rev", z))]
    start_rel = TS.start_relations(D, P, sorted(ids))[0]
    w, snaps, bonds = SP.run_model("SL8（脚8層・16枚）", P, BB, D, T, ids, None, sched, start_rel)
    say(f"    共有する板の置かれ方：背の角の式と各角の式の差（全区間の最大）{share[0]:.1e}")
    if share[0] > 1e-9:
        bad("共有する板の位置・向きが一致しない")
    say(f"    刻み：段1 {N1 + 1}点・段2・3 {len(zs)}点{'（--fine）' if FINE else '（既定。--fine で 4000/8000 点）'}")

    Tbp = world("open", 0.0)
    pen, who = SP.penetration(Tbp, P, ids)
    say(f"    分岐点（背だけ平ら・ほかの角は畳んだまま）：同じ平面の重なり {'なし' if pen <= 0 else f'あり {pen:.2e} {TS.short(who[0])}×{TS.short(who[1])}'}")
    if pen > 0:
        bad("分岐点で板が重なる")
    Tend = world("rev", math.pi)
    nears = [(dl, world("rev", math.pi - dl)) for dl in (1e-3, 1e-4, 1e-5)]

    # ---------- 目標との照合（厚みの切りかえつき） ----------
    say(f"\n[照合] 目標との照合（厚み {'0（既定）' if EPS == 0 else f'EPS={EPS:g} の模型'}）")
    flags = compare(P, ids, Tend, nears, T, start_rel, cutseg)

    # ---------- 共通基準面 ----------
    say("\n[基準面] 分岐点の平らな姿を「胴との結びの共通基準面」として定義・保存")
    frame = build_frame(P, BB, T, ids, Tbp, cutseg, Vspine, layers, si, byname, snaps)
    json.dump(frame, open(os.path.join(HERE, "crane13_branchpoint_frame.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    flagname = "crane13_stack_flags.json" if EPS == 0 else "crane13_stack_flags_thick.json"
    json.dump(flags, open(os.path.join(HERE, flagname), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    say(f"  → crane13_branchpoint_frame.json ／ {flagname} に保存")

    tag = "zero" if EPS == 0 else "thick"
    cum = {}
    for b in bonds:
        key = b["bondId"] + "|" + b["a"]
        cum[f"{TS.short(b['a'])}|{TS.short(b['b'])}"] = dict(
            kind=("⑬" if b["bondId"].startswith("cut:") else "背"),
            branch_point_deg=round(math.degrees(snaps["段1 背を開く c=π→0"][1][key]), 6),
            end_deg=round(math.degrees(snaps["段2・3 中割りの枝 z=0→π"][1][key]), 6))
    summary = dict(model="SL8（脚8層・16枚）・胴なし", thickness=EPS, rule=flags["rule"],
                   max_tie_error=w["bond"], self_intersection=bool(w["pen"] > 0),
                   self_intersection_pairs=([dict(a=w["who"][0], b=w["who"][1], how=w["who"][2], at=w["at"])] if w["pen"] > 0 else []),
                   shared_plate_max_diff=share[0], target_pos_max_diff=flags["target_pos_max_diff"],
                   face_flip=dict(sides=f"{flags['sides_ok']}/{flags['sides_total']}", stack=f"{flags['stack_ok']}/{flags['stack_total']}",
                                  stack_decided_by_tie_rule=flags["stack_tie"], delta_unstable=flags["delta_unstable"]),
                   cumulative_rotations=cum, changed_by_thickness=flags["changed_by_thickness"],
                   body_moved_faces=None, body_note="この模型に胴は入っていない（胴受けテスト check_crane13_body_receive.py は未完）",
                   accepted=not ng, ng=list(ng))
    out = os.path.join(HERE, f"leg_frame_{tag}_summary.json")
    json.dump(summary, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    say(f"  要約 JSON：{os.path.basename(out)}")

    say("\n[累積回転（経路の結果・条件にはしていない）]")
    for b in bonds:
        key = b["bondId"] + "|" + b["a"]
        say(f"    {TS.short(b['a'])}|{TS.short(b['b'])}：分岐点 {math.degrees(snaps['段1 背を開く c=π→0'][1][key]):+.1f}° → 終端 {math.degrees(snaps['段2・3 中割りの枝 z=0→π'][1][key]):+.1f}°")


def compare(P, ids, Tend, nears, T, start_rel, cutseg):
    Tnear = nears[1][1]
    A, B = cutseg
    Rpi = MOT.rot_about((A[0], A[1], 0), (B[0], B[1], 0), math.pi)
    pos = max(float(np.linalg.norm(SP.xf(Tend[f], p) - SP.xf(Rpi if P[f]["moves"] else np.eye(4), p))) for f in ids for p in P[f]["start"])
    sides = [(f, (1 if Tend[f][2, 2] > 0 else -1) * P[f]["side0"], P[f]["side1"]) for f in ids]
    say(f"  位置：目標とのずれ（最大）{pos:.1e}／表裏：{sum(1 for _, a, b in sides if a == b)}/{len(sides)} 一致")
    if pos > 1e-9 or any(a != b for _, a, b in sides):
        bad("位置・表裏が目標と違う")
    above = {(a, b): r for a, b, r in T["above"]}
    polys = {f: Polygon(P[f]["end"]) for f in ids}
    rows, n_ok, n_ng, n_tie, n_close = [], 0, 0, 0, 0
    changed = []
    for (a, b), r in sorted(above.items()):
        if a not in ids or b not in ids:
            continue
        it = polys[a].intersection(polys[b])
        if it.area <= 1e-9:
            continue
        pt = it.representative_point()
        h, off = {}, {}
        for f in (a, b):
            Te = Rpi if P[f]["moves"] else np.eye(4)
            q = np.linalg.inv(Te) @ np.array([pt.x, pt.y, 0.0, 1.0])
            h[f] = float(SP.xf(Tnear[f], q[:2])[2])
            off[f] = P[f]["layer"] * float(Tnear[f][2, 2])      # 厚みの向き：面の法線へ「層の順」だけ
        dh = h[b] - h[a]
        dth = off[b] - off[a]
        tie = abs(dh) <= 1e-12
        got_dz = (1 if dh > 0 else -1) if not tie else None
        r0 = start_rel.get((a, b))
        got_zero = got_dz if not tie else ((r0 * (1 if Tnear[a][2, 2] > 0 else -1)) if r0 is not None else 0)
        got_thick = got_dz if not tie else (1 if dth > 0 else -1)      # 厚み＝面の法線 × 層順（tie の組だけ）
        if not tie:
            got = got_dz
            how = f"高さ dz（差 {abs(dh):.1e}）・厚みは足さない"
            sgn = set()
            for dl, Tn in nears:
                hh = {}
                for f in (a, b):
                    Te = Rpi if P[f]["moves"] else np.eye(4)
                    q = np.linalg.inv(Te) @ np.array([pt.x, pt.y, 0.0, 1.0])
                    hh[f] = float(SP.xf(Tn[f], q[:2])[2])
                sgn.add(1 if hh[b] > hh[a] else -1)
            if len(sgn) > 1:
                n_close += 1
                how += "・⚠読む位置で符号が変わる"
        else:
            n_tie += 1
            got = got_thick if EPS > 0 else got_zero
            how = (f"dz=0（同じ置かれ方）→ 厚み EPS={EPS:g}×層順 {dth:+.0f} で決めた" if EPS > 0
                   else "dz=0（同じ置かれ方）→ 出発の上下を持ち越す（厚み0）")
        if tie and got_zero != got_thick:
            changed.append(dict(a=a, b=b, name=f"{TS.short(a)}|{TS.short(b)}", zero=got_zero, thick=got_thick,
                                layer_order=float(dth)))
        ok = got == r
        n_ok += ok
        n_ng += not ok
        rows.append(dict(a=a, b=b, name=f"{TS.short(a)}|{TS.short(b)}", target=r, got=got, ok=bool(ok),
                         zero_thickness_tie=bool(tie), dz=float(dh), layer_order=float(dth),
                         delta_unstable=bool("符号が変わる" in how), rule=("dz" if not tie else ("thickness" if EPS > 0 else "carry_over")),
                         got_dz=got_dz, got_zero=got_zero, got_thick=got_thick, how=how))
        if not ok:
            say(f"  **反する**：{TS.short(a)} と {TS.short(b)}：着いた {'上' if got > 0 else '下'}／目標 {'上' if r > 0 else '下'}（{how}）")
    say(f"  上下：重なる組 {n_ok + n_ng} のうち一致 {n_ok}・反する {n_ng}")
    say(f"  **高さが同じ＝厚みの扱いで決まる組（印）**：{n_tie}／{n_ok + n_ng}"
        + ("" if EPS == 0 else f"　→ いまは厚み EPS={EPS:g} で決めた（厚み0のときは出発の上下を持ち越す）"))
    say(f"  読む位置（終端の手前 δ＝1e-3・1e-4・1e-5）で上下の符号が変わる組：{n_close}（0 なら δ の取り方に依らない）")
    if n_close:
        bad("読む位置で上下が変わる組がある")
    for r_ in rows:
        if r_["zero_thickness_tie"]:
            say(f"    印：{r_['name']}（{r_['how']}）")
    say(f"  厚みで変わった組（zero と thick の食い違い）：{len(changed)}"
        + ("" if not changed else "　→ " + "／".join(c["name"] for c in changed)))
    if n_ng:
        bad("上下が目標と違う")
    return dict(target_pos_max_diff=pos, sides_ok=sum(1 for _, a_, b_ in sides if a_ == b_), sides_total=len(sides),
                stack_ok=n_ok, stack_total=n_ok + n_ng, stack_tie=n_tie, delta_unstable=n_close,
                thickness=EPS, rule="zero_thickness_tie=true の組だけ 厚み EPS×（面の法線×層順）で決める。ほかの組は dz だけで決める。",
                changed_by_thickness=changed,
                note=("zero_thickness_tie=true の組＝終端で相手と同じ置かれ方のまま（厚み0では高さが同じ）＝上下は幾何では決まらない。"
                      "既定（thickness=0）はその組だけ出発の上下を持ち越す。胴との結びに入るときは --thickness EPS で、"
                      "その組だけ紙の厚み（面の法線へ EPS×層の順）で決める。幾何で決まる組（false）には厚みを足さない。"
                      "dz＝終端の手前 δ=1e-4 で読んだ高さの差・layer_order＝厚みで決めるときの向き（＋なら b が上）。"),
                pairs=rows)


def build_frame(P, BB, T, ids, Tbp, cutseg, Vspine, layers, si, byname, snaps):
    """分岐点の姿を共通基準面として書き出す"""
    V, d = Vspine.V, Vspine.d
    say(f"  決め方：原点＝背の角 V={np.round(V, 6).tolist()}／基準線＝背の直線（向き d={np.round(d, 6).tolist()}・先の向き）"
        f"／⑬の線＝{np.round(cutseg, 6).tolist()}／法線＝出発の紙の +z（動かない板 元{layers[si]} を固定）")
    inplane = max(abs(float(SP.xf(Tbp[f], p)[2])) for f in ids for p in P[f]["start"])
    say(f"  分岐点で16枚とも同じ平面か：|z| の最大 {inplane:.1e}（背で開いた上4層も同じ平面に戻る）")
    if inplane > 1e-9:
        bad("分岐点が平らでない")
    # 面ごと
    faces = {}
    for f in sorted(ids):
        poly = [SP.xf(Tbp[f], p)[:2].tolist() for p in P[f]["start"]]
        faces[f] = dict(name=TS.short(f), layer=P[f]["layer"], moves=P[f]["moves"],
                        placement=[list(map(float, row)) for row in Tbp[f]],
                        side_start=P[f]["side0"], side_frame=int(P[f]["side0"] * (1 if Tbp[f][2, 2] > 0 else -1)),
                        polygon=poly)
    # 脚から胴へ出ていく結び（片側だけが脚）
    out = []
    for b in BB:
        ina, inb = b["a"] in ids, b["b"] in ids
        if ina == inb:
            continue
        legf, bodyf = (b["a"], b["b"]) if ina else (b["b"], b["a"])
        Rm = Tbp[legf]
        ang = ang_about(Rm[:3, :3], np.array([d[0], d[1], 0.0]))
        moved = not np.allclose(Rm, np.eye(4), atol=1e-12)
        out.append(dict(bondId=b["bondId"], kind=b["kind"], leg=legf, legName=TS.short(legf), body=bodyf,
                        seg=b["seg0"], legMoved=bool(moved), legRotationAboutSpineDeg=math.degrees(ang),
                        note="胴側の面は、この結びを保つならこの回転に合わせて動く必要がある（胴はこの模型に入っていない）"))
    say(f"  脚から胴へ出ていく結び {len(out)} 本（種類：" + "・".join(sorted({o['kind'] for o in out})) + "）")
    for o in sorted(out, key=lambda o: o["legName"]):
        say(f"    {o['legName']}–{TS.short(o['body'])}（{o['kind']}）：分岐点で脚側は"
            f"{'動かない' if not o['legMoved'] else f'背のまわりに {o[chr(108)+chr(101)+chr(103)+chr(82)+chr(111)+chr(116)+chr(97)+chr(116)+chr(105)+chr(111)+chr(110)+chr(65)+chr(98)+chr(111)+chr(117)+chr(116)+chr(83)+chr(112)+chr(105)+chr(110)+chr(101)+chr(68)+chr(101)+chr(103)]:+.1f}° 回る'}")
    # 分岐点で同じ平面に重なっている組（厚み0では上下が読めない＝印）
    coplanar = []
    pol = {f: Polygon([SP.xf(Tbp[f], p)[:2] for p in P[f]["start"]]) for f in ids}
    for i, a in enumerate(sorted(ids)):
        for b in sorted(ids)[i + 1:]:
            if pol[a].intersection(pol[b]).area > 1e-9:
                coplanar.append(dict(a=a, b=b, name=f"{TS.short(a)}|{TS.short(b)}",
                                     same_placement=bool(np.allclose(np.linalg.inv(Tbp[a]) @ Tbp[b], np.eye(4), atol=1e-9))))
    say(f"  分岐点で重なっている組 {len(coplanar)}（うち同じ置かれ方のまま {sum(c['same_placement'] for c in coplanar)}＝厚み0では高さで読めない）")
    key = [k for k in snaps if k.startswith("段1")][0]
    return dict(fingerprint=json.load(open(os.path.join(HERE, "crane13_terminal_input.json"), encoding="utf-8"))["fingerprint"],
                definition=dict(what="つる⑬の分岐点（背だけを平らに開き、ほかの角は畳んだまま・⑬の角は0）の姿。胴との結びの共通基準面。",
                                origin=list(map(float, V)), spineDir=list(map(float, d)), cutSeg=[list(map(float, cutseg[0])), list(map(float, cutseg[1]))],
                                normal="出発の紙の +z", anchor=byname[f"元{layers[si]}"], plane="z=0",
                                path="背の角＝中割りの枝（z=0）／ほかの6つの角＝外へ折る枝（背は畳んだまま）",
                                thickness="厚み0。厚みを考える位置は crane13_stack_flags.json の印と --thickness で切りかえる"),
                legChainLayers=layers, spineVertex=[layers[si], layers[si + 1]],
                faces=faces, bondsToBody=out, coplanarPairsAtFrame=coplanar,
                windingAtFrameDeg={k: math.degrees(v) for k, v in snaps[key][1].items()})


if __name__ == "__main__":
    main()
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
