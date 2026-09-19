# -*- coding: utf-8 -*-
"""つる⑬：成功した単独模型から、実際の脚の曲がり角と結びを段階的に足し、中割りの経路がどこで通らなくなるか（2026-09-17）

本人指示：成功した単独模型を出発点に、実際の脚の折線角度と結びを段階的に加える。まず曲がり角2つ、次に脚全体、最後に胴との結び。
既存の検証模型が使える段階は再利用。**最初に通らなくなった小さい模型で止め**、成功例との違いを図で示す。
数値追跡の失敗と、幾何的な不成立を区別する。**結びを省いた模型の成功を、鶴全体の成功として扱わない**。本体・UI・保存形式は無変更。

段階
  S0 単独模型（曲がり角1つ・1枚の紙）＝`check_crane13_single.py`（θ=75.96°・87.21° とも成功ずみ）→ 再利用
  S1 曲がり角2つ：実際の脚（⑫後・ORIPA の⑬の線で切った紙）から**連続する3層**（中心線の角1つ＋外形の側の角1つ）＝板6枚。胴は無し
  S2 脚全体：8層・曲がり角7つ＝板16枚。胴は無し（第3段の M2 と同じ紙）
  S3 胴との結びまで：56枚（M3）＝第9〜14段の結果を再利用（ここでは追い直さない）

経路の決め方（S1・S2）＝単独模型で確かめた仕組みをそのまま当てる（道を探索しない）
  段1 開く：層の折り（各曲がり角の既存の折線・先の半分と元の半分）をそろえて 0→平ら（開く向き×180°）。⑬の角は 0。
  段2 折れ方を返す／段3 閉じる：⑬ の角の大きさ z を 0→90°→180°。各曲がり角 k で単独模型の連動
      tan(φ_k/2) ＝ cosθ_k · tan(z/2)（θ_k＝その角での⑬の線と折線のなす角）を使い、
      元の半分 ＝ 開く向き×(180° − φ_k)（元へ戻る）／先の半分 ＝ 開く向き×(180° + φ_k)（反対側へ返る）。
      ⑬ の角（符号を含む）は**結びの閉じから解く**（ここは与えない）。
  ⚠ 開く向きは layer の上下から（第14段で保存原本の上下×表裏と一致を確認ずみ）。
各時点の検査（別々に）：①全結び（すべての結びの両端のずれ） ②閉じの残り（与えた角で解けたか） ③すり抜け（第9段と同じ判定・深さ 1e-6）
終わり：④目標終端の置かれ方とのずれ ⑤層順（終端の直前の高さ：先が元の層のあいだ＝中割り）

失敗の区別
  ・閉じが解けない時点：同じ目標で出発点を変えて解き直す（10回）→ どれかで解ければ**数値追跡の失敗**、どれでも解けなければ
    「与えた角の組では閉じない」（⚠数値での結果。証明ではない）→ 元/先のどちらが戻るかの組み合わせを変えて試す。
  ・すり抜け：S1・S2 では z を決めると脚の姿が（全体の鏡を除いて）決まる＝**その折線と剛体のままでは、この枝で紙が交わる**（幾何）。
    ⚠ 厚み0の模型での判定。
使い方： python check_crane13_stages.py [--only S1|S2]
終了コード： 0=ok ／ 1=NG ／ 2=異常終了
"""
import importlib.util
import json
import math
import os
import sys
import traceback

import numpy as np
from scipy.optimize import least_squares

HERE = os.path.dirname(os.path.abspath(__file__))
_argv = sys.argv
sys.argv = [sys.argv[0]]
_s = importlib.util.spec_from_file_location("open_path", os.path.join(HERE, "check_crane13_open_path.py"))
OP = importlib.util.module_from_spec(_s)
_s.loader.exec_module(OP)
sys.argv = _argv
P, M, MO = OP.P, OP.M, OP.MO
ng = []
ONLY = _argv[_argv.index("--only") + 1] if "--only" in _argv else None


def say(*a):
    print(" ".join(str(x) for x in a), flush=True)


def bad(m):
    ng.append(m)
    say("  NG:", m)


def build():
    D, faces_all, cut, leg, geo = P.real_cut(60.0, 0.5, legno=1, oripa=True)
    legTip, _, u = geo
    # 脚の8面の並び（じゃばら）
    inner = [b for b in D["bonds"] if b["faceIds"][0] in leg and b["faceIds"][1] in leg]
    nb = {f: [] for f in leg}
    for b in inner:
        nb[b["faceIds"][0]].append((b["faceIds"][1], b))
        nb[b["faceIds"][1]].append((b["faceIds"][0], b))
    end = sorted(f for f in leg if len(nb[f]) == 1)[0]
    chain, seen = [end], {end}
    while True:
        nxt = [g for g, _ in nb[chain[-1]] if g not in seen]
        if not nxt:
            break
        chain.append(nxt[0])
        seen.add(nxt[0])
    A, B = cut["cutseg"]
    dc = np.array(B) - np.array(A)
    dc = dc / np.linalg.norm(dc)
    verts = []
    for i in range(len(chain) - 1):
        b = next(bb for g, bb in nb[chain[i]] if g == chain[i + 1])
        on_c = all(abs(M.cross(M.sub(p, legTip), u)) < 1e-9 for p in b["cur"])
        de = np.array(b["cur"][1]) - np.array(b["cur"][0])
        de = de / np.linalg.norm(de)
        th = math.degrees(math.acos(min(1.0, abs(float(dc @ de)))))
        # ⑬の線が、この曲がり角から折線の「先の側」と何度をなすか（90°未満＝先の側へ傾く）
        p0, p1 = np.array(b["cur"][0]), np.array(b["cur"][1])
        dd = p1 - p0
        tt = np.linalg.solve(np.array([dd, -(np.array(B) - np.array(A))]).T, np.array(A) - p0)[0]
        Xv = p0 + tt * dd
        tipdir = (p1 - Xv) if np.linalg.norm(p1 - np.array(legTip)) < np.linalg.norm(p0 - np.array(legTip)) else (p0 - Xv)
        other = np.array(A) if np.linalg.norm(np.array(A) - Xv) > np.linalg.norm(np.array(B) - Xv) else np.array(B)
        lean = math.degrees(math.acos(float((other - Xv) @ tipdir / np.linalg.norm(other - Xv) / np.linalg.norm(tipdir))))
        verts.append(dict(i=i, faces=(chain[i], chain[i + 1]), bond=b, center=on_c, theta=th, lean=lean))
    return D, faces_all, cut, leg, geo, chain, verts


def run_stage(label, cut, sub_faces, verts, note, fig_tag=None):
    say(f"\n==== {label} ====　{note}")
    panels = {f"{f}#{k}" for f in sub_faces for k in ("tip", "base")}
    faces = {k: v for k, v in cut["faces"].items() if k in panels}
    bonds = [b for b in cut["bonds"] if b["faceIds"][0] in panels and b["faceIds"][1] in panels]
    tipset = {p for p in panels if p.endswith("#tip")}
    anchor = sorted(p for p in panels if p.endswith("#base"))[0]
    mo = MO.Model(faces, bonds, anchor=anchor, last=sorted(tipset))
    OP.FACES.update(faces)
    n = len(mo.tree_ids)
    cv = P.cut_vars(mo)
    sub_verts = [v for v in verts if v["faces"][0] in sub_faces and v["faces"][1] in sub_faces]
    say(f"  板 {len(faces)}・結び {len(mo.bonds)}（木 {n}・木の外 {len(mo.loop_ids)}）・⑬の角 {len(cv)}・曲がり角 {len(sub_verts)}："
        + "／".join(f"{'中心線' if v['center'] else '外形の側'} θ={v['theta']:.4f}°（層{faces_all_layer(cut, v['faces'][0])}|{faces_all_layer(cut, v['faces'][1])}）" for v in sub_verts))
    # 各曲がり角の折線の半分（先・元）と開く向き
    halves = []
    for v in sub_verts:
        fa, fb = v["faces"]
        for part in ("tip", "base"):
            b = next(bb for bb in mo.bonds if set(bb["faceIds"]) == {f"{fa}#{part}", f"{fb}#{part}"})
            halves.append(dict(b=b, part=part, theta=v["theta"], s=OP.open_sign(faces, b)))
    adj = set()
    for b in mo.bonds:
        adj.add(tuple(b["faceIds"]))
        adj.add(tuple(reversed(b["faceIds"])))
    T0 = mo.placements(np.zeros(n))
    T0rel = lambda a, b: np.linalg.inv(T0[a]) @ T0[b]
    cuts = [b for b in mo.bonds if b["bondId"].startswith("cut:")]

    def solve_at(x_prev, ref_h, tgt, cut_zero, restarts=0, rng=None):
        def fun(xx):
            T_ = mo.placements(xx)
            ah = np.array([OP.unwrap(OP.rel_angle(T_, h["b"]), r) for h, r in zip(halves, ref_h)])
            parts = [1e3 * mo.residual(xx, T_), ah - tgt]
            if cut_zero:
                parts.append(np.array([OP.rel_angle(T_, b) for b in cuts]))
            return np.concatenate(parts)
        best = None
        for k in range(1 + restarts):
            x0 = x_prev.copy() if k == 0 else x_prev + rng.normal(0, 0.5, len(x_prev))
            r = least_squares(fun, x0, method="lm", xtol=1e-15, ftol=1e-15, gtol=1e-15, max_nfev=4000)
            v = float(np.linalg.norm(fun(r.x)))
            if best is None or v < best[0]:
                best = (v, r.x)
            if v < 1e-9:
                break
        return best

    rng = np.random.default_rng(0)
    V = len(sub_verts)
    for h in halves:
        h["vi"] = next(k for k, v in enumerate(sub_verts)
                       if set(h["b"]["faceIds"]) == {f"{v['faces'][0]}#{h['part']}", f"{v['faces'][1]}#{h['part']}"})

    def run_path(schedule, combo):
        """schedule：段1の開く順（曲がり角の番号のまとまりの並び）／combo：曲がり角ごと +1＝元が戻る・−1＝先が戻る"""
        x = np.zeros(n)
        ref_h = [0.0] * len(halves)
        worst = dict(bond=0.0, res=0.0)
        state = dict(first_pen=None)
        snaps = {}
        stop = None

        def check(xx, tag):
            T_ = mo.placements(xx)
            worst["bond"] = max(worst["bond"], OP.all_bond_error(mo, T_))
            pen, who = OP.penetration(mo, T_, faces, adj, T0rel)
            if pen > 0 and state["first_pen"] is None:
                state["first_pen"] = (tag, pen, who, xx.copy())

        done = np.zeros(V)
        for grp in schedule:
            for k in range(1, 19):
                frac = done.copy()
                frac[grp] = k / 18
                tgt = np.array([h["s"] * math.pi * frac[h["vi"]] for h in halves])
                v, xs = solve_at(x, ref_h, tgt, True)
                if v > 1e-9:
                    v2, _ = solve_at(x, ref_h, tgt, True, restarts=10, rng=rng)
                    stop = (f"段1（角{grp}を {10*k}°）：閉じが解けない（{v:.1e}）→ 出発点を変えると "
                            + ("解けた＝数値追跡の失敗" if v2 < 1e-9 else f"解けない（{v2:.1e}）＝数値では解が見つからない"))
                    break
                x = xs
                T_ = mo.placements(x)
                ref_h = [OP.unwrap(OP.rel_angle(T_, h["b"]), r) for h, r in zip(halves, ref_h)]
                worst["res"] = max(worst["res"], v)
                check(x, f"段1 角{grp} {10*k}°")
                if state["first_pen"]:
                    break
            if stop or state["first_pen"]:
                break
            done[grp] = 1.0
        if stop or state["first_pen"]:
            return dict(stop=stop, first_pen=state["first_pen"], worst=worst, snaps=snaps, x=x)
        snaps["flat"] = x.copy()
        zs = [math.radians(2 * k) for k in range(1, 90)] + [math.radians(179.5), math.radians(179.9), math.pi]
        for z in zs:
            tgt = []
            for h in halves:
                phi = 2 * math.atan(math.cos(math.radians(h["theta"])) * math.tan(z / 2)) if z < math.pi - 1e-12 else math.pi
                sg = combo[h["vi"]] * (1 if h["part"] == "base" else -1)
                tgt.append(h["s"] * (math.pi - sg * phi))
            tgt = np.array(tgt)
            v, xs = solve_at(x, ref_h, tgt, False)
            if v > 1e-9:
                v2, _ = solve_at(x, ref_h, tgt, False, restarts=10, rng=rng)
                stop = (f"z={math.degrees(z):.1f}°：前の姿から解けない（{v:.1e}）→ 出発点を変えると "
                        + ("解けた＝数値追跡の失敗（別の枝へ飛んだ可能性）" if v2 < 1e-9 else f"解けない（{v2:.1e}）＝数値では解が見つからない"))
                break
            x = xs
            T_ = mo.placements(x)
            ref_h = [OP.unwrap(OP.rel_angle(T_, h["b"]), r) for h, r in zip(halves, ref_h)]
            worst["res"] = max(worst["res"], v)
            check(x, f"z={math.degrees(z):.1f}°")
            if abs(math.degrees(z) - 90) < 1e-9:
                snaps["z90"] = x.copy()
            if abs(math.degrees(z) - 179.5) < 1e-9:
                snaps["near"] = x.copy()
            if state["first_pen"]:
                break
        out = dict(stop=stop, first_pen=state["first_pen"], worst=worst, snaps=snaps, x=x)
        if not stop and not state["first_pen"]:
            snaps["end"] = x.copy()
            T_end = P.terminal_T(mo, tipset, cut["cutseg"])
            out["gap"] = P.gap_to(mo, x, T_end, faces)
            samp = P.sample_point(faces, tipset, T_end)
            if samp is not None:
                hs = P.heights(mo, snaps["near"], faces, T_end, samp)
                out["order"] = P.classify(hs, tipset)[0].replace("**", "")
                out["stack"] = [(("先" if f in tipset else "元") + f"(層{faces[f]['layer']})") for f, _ in sorted(hs.items(), key=lambda t: t[1])]
        return out

    import itertools
    # 段1 の開き方：そろえて／外側（層の差が大きい＝ほかの層を包む角）から1つずつ
    span = [abs(faces[f"{v['faces'][0]}#tip"]["layer"] - faces[f"{v['faces'][1]}#tip"]["layer"]) for v in sub_verts]
    outer_first = [[k] for k in sorted(range(V), key=lambda k: -span[k])]
    schedules = [("そろえて開く", [list(range(V))]), ("外側（包む角）から1つずつ", outer_first)]
    say("  段1 の開き方：" + "／".join(f"{nm} {sch}" for nm, sch in schedules)
        + "（⚠開く順は道の選び方。層番号の差は順を決めるのにだけ使う）")
    stage1 = {}
    for nm, sch in schedules:
        r = run_path(sch, [1] * V)
        fp = r["first_pen"]
        if r["stop"] and r["stop"].startswith("段1") or (fp and fp[0].startswith("段1")):
            say(f"    {nm}：**平らに届かない**："
                + (r["stop"] if r["stop"] else f"すり抜け {fp[0]}（{OP.short(fp[2][0])} × {OP.short(fp[2][1])}・{fp[2][2]}・{fp[1]:.2e}）"))
            stage1[nm] = (False, r)
        else:
            say(f"    {nm}：平らまで（①全結び {r['worst']['bond']:.1e}・②閉じの残り {r['worst']['res']:.1e}・③すり抜けなし）")
            stage1[nm] = (True, r)
    ok1 = [nm for nm, (ok, _) in stage1.items() if ok]
    if not ok1:
        say("  → 段1 のどの開き方でも平らに届かない")
        return dict(label=label, stage1=stage1, fail="段1", mo=mo, faces=faces, tipset=tipset, runs={}, consistent=[], allret=False)
    sch = dict(schedules)[ok1[0]]
    xflat = stage1[ok1[0]][1]["snaps"]["flat"]
    Tf = mo.placements(xflat)
    ref_flat = [OP.unwrap(OP.rel_angle(Tf, h["b"]), h["s"] * math.pi) for h in halves]
    z = math.radians(2)
    say(f"  段2 の入口（平らな姿・開き方「{ok1[0]}」）：曲がり角ごとに「元が戻る(+)／先が戻る(−)」の組を z=2° で解く（{2**V}通り・出発点6通り）")
    consistent = []
    for combo in itertools.product((1, -1), repeat=V):
        tgt = []
        for h in halves:
            phi = 2 * math.atan(math.cos(math.radians(h["theta"])) * math.tan(z / 2))
            sg = combo[h["vi"]] * (1 if h["part"] == "base" else -1)
            tgt.append(h["s"] * (math.pi - sg * phi))
        v, _ = solve_at(xflat, ref_flat, np.array(tgt), False, restarts=5, rng=rng)
        if v < 1e-9:
            consistent.append(combo)
        if V <= 3 or combo == tuple([1] * V):
            say(f"    {combo}：閉じの残り {v:.1e}{'  ←中割りに要る「全部の元が戻る」' if combo == tuple([1] * V) else ''}")
    say(f"  閉じる組 {len(consistent)}／{2**V}：{consistent[:8]}{' …' if len(consistent) > 8 else ''}")
    # 1次（速度）の確かめ＝出発点に依らない線形の計算：平らな姿で、z の速さ 1 のとき各半分の速さは 開く向き×(−符号×cosθ)
    Jc, _ = mo.jac(xflat, 1e-7)
    Jh = np.zeros((len(halves), n))
    for k in range(n):
        xp, xm = xflat.copy(), xflat.copy()
        xp[k] += 1e-7
        xm[k] -= 1e-7
        Tp, Tm = mo.placements(xp), mo.placements(xm)
        Jh[:, k] = [(OP.unwrap(OP.rel_angle(Tp, h["b"]), r) - OP.unwrap(OP.rel_angle(Tm, h["b"]), r)) / 2e-7 for h, r in zip(halves, ref_flat)]
    lin = {}
    for combo in itertools.product((1, -1), repeat=V):
        vel = np.array([h["s"] * (-(combo[h["vi"]] * (1 if h["part"] == "base" else -1)) * math.cos(math.radians(h["theta"]))) for h in halves])
        A_ = np.vstack([Jc, Jh])
        b_ = np.concatenate([np.zeros(len(Jc)), vel])
        dx = np.linalg.lstsq(A_, b_, rcond=None)[0]
        cz = max(abs(float(dx[mo.var_of[k]])) for k in mo.tree_ids if mo.bonds[k]["bondId"].startswith("cut:"))
        lin[combo] = (float(np.linalg.norm(A_ @ dx - b_)), cz)
    say("  1次（平らな姿の速さの連立方程式・最小二乗の残り／そのときの⑬の速さの最大）："
        + "／".join(f"{c} 残り {r_:.1e}・⑬ {cz:.2f}" for c, (r_, cz) in lin.items() if V <= 3 or c == tuple([1] * V)))
    # 各曲がり角で⑬の線がどちら側へ傾くか（先の側となす角）
    say("  各曲がり角の⑬の傾き（先の側となす角）："
        + "／".join(f"{'中心線' if v['center'] else '外形の側'} {v['lean']:.4f}°（{'先' if v['lean'] < 90 else '元'}の側へ）" for v in sub_verts))
    allret = tuple([1] * V) in consistent
    runs = {}
    for combo in ([tuple([1] * V)] if allret else []) + [c for c in consistent if c != tuple([1] * V)][:2]:
        r = run_path(sch, list(combo))
        runs[combo] = r
        fp = r["first_pen"]
        if r["stop"]:
            msg = r["stop"]
        elif fp:
            msg = f"すり抜け {fp[0]}（{OP.short(fp[2][0])} × {OP.short(fp[2][1])}・{fp[2][2]}・{fp[1]:.2e}）"
        else:
            msg = (f"z=180° まで（①全結び {r['worst']['bond']:.1e}・②閉じの残り {r['worst']['res']:.1e}・③すり抜けなし・"
                   f"④終端とのずれ {r.get('gap', float('nan')):.1e}）／⑤ **{r.get('order')}**：{' ／ '.join(r.get('stack', []))}")
        say(f"  組 {combo}：{msg}")
    return dict(label=label, stage1=stage1, consistent=consistent, allret=allret, runs=runs, mo=mo, faces=faces, tipset=tipset,
                halves=halves, cut=cut, sch=sch)


def faces_all_layer(cut, fid):
    return cut["faces"][f"{fid}#tip"]["layer"]


def main():
    D, faces_all, cut, leg, geo, chain, verts = build()
    say("脚1の並び（じゃばら）：" + " → ".join(f"層{faces_all[f]['layer']}" for f in chain))
    say("曲がり角：" + "／".join(f"層{faces_all[v['faces'][0]]['layer']}|{faces_all[v['faces'][1]]['layer']} {'中心線' if v['center'] else '外形の側'} θ={v['theta']:.4f}°" for v in verts))
    say("🚨 S1・S2 は胴との結びを省いた模型。その成功は鶴全体の成功ではない。")
    say("\nS0 単独模型：`check_crane13_single.py` で θ=75.9638°・87.2138° とも、開く→返す→閉じるが剛体で通り、層順は中割り（第8段 §34）＝**再利用**")

    results = []

    def passed(r):
        """中割りの層順まで、すり抜けなしで通った組があるか"""
        return any((not rr["stop"]) and (not rr["first_pen"]) and "中割り" in (rr.get("order") or "") for rr in r["runs"].values())

    if ONLY in (None, "S1"):
        # 中心線の角と外形の側の角が隣り合う3層
        i = next(v["i"] for v in verts if v["center"] and verts[v["i"] + 1]["center"] is False)
        sub = chain[i:i + 3]
        r1 = run_stage("S1 曲がり角2つ（連続する3層・板6枚）", cut, sub, verts, "⚠胴・ほかの層の結びを省いた模型")
        results.append(r1)
        if not passed(r1) and ONLY is None:
            say("\n→ **S1 で通らなくなった**。ここで止める（S2・S3 は行わない）。")
            dump(results)
            return
    if ONLY in (None, "S2"):
        r2 = run_stage("S2 脚全体（8層・板16枚）", cut, chain, verts, "⚠胴との結び（8本）を省いた模型")
        results.append(r2)
        if not passed(r2):
            say("\n→ **S2 で通らなくなった**（S1 は通った）。ここで止める。")
            dump(results)
            return
    say("\nS3 胴との結びまで（56枚）：第9〜14段を再利用（追い直さない）")
    dump(results)


def dump(results):
    """図のための姿を保存（make_crane13_stage_figs.py が読む）"""
    out = []
    for r in results:
        mo, faces = r["mo"], r["faces"]
        runs = []
        items = [("段1:" + nm, rr) for nm, (ok, rr) in r["stage1"].items()] + [(f"組{list(c)}", rr) for c, rr in r["runs"].items()]
        for name, rr in items:
            snaps = {}
            for k, x in rr["snaps"].items():
                T = mo.placements(x)
                snaps[k] = {f: [MO.xform(T[f], p).tolist() for p in faces[f]["cur"]] for f in mo.ids}
            T = mo.placements(rr["x"])
            snaps["last"] = {f: [MO.xform(T[f], p).tolist() for p in faces[f]["cur"]] for f in mo.ids}
            pen = None
            if rr["first_pen"]:
                T = mo.placements(rr["first_pen"][3])
                snaps["pen"] = {f: [MO.xform(T[f], p).tolist() for p in faces[f]["cur"]] for f in mo.ids}
                pen = [rr["first_pen"][2][0], rr["first_pen"][2][1], rr["first_pen"][0]]
            runs.append(dict(name=name, stop=rr["stop"], pen=pen, order=rr.get("order"), stack=rr.get("stack"), snaps=snaps))
        out.append(dict(label=r["label"], tipset=sorted(r["tipset"]), layers={f: faces[f]["layer"] for f in mo.ids},
                        consistent=[list(c) for c in r.get("consistent", [])], allret=r.get("allret"), runs=runs))
    json.dump(out, open(os.path.join(HERE, "crane13_stages_snaps.json"), "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("ABORT: 検証コードが例外で止まった")
        sys.exit(2)
    print("\n" + ("ALL OK" if not ng else f"NG {len(ng)} 件"))
    sys.exit(0 if not ng else 1)
